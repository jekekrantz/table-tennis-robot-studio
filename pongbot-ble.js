(function (root) {
  "use strict";

  const P = root.PongbotProtocol;
  if (!P) throw new Error("pongbot-protocol.js must load before pongbot-ble.js");

  class NovaBleController extends EventTarget {
    constructor() {
      super();
      this.device = null;
      this.server = null;
      this.writeChar = null;
      this.notifyChar = null;
      this.phase = "disconnected";
      this.authenticated = false;
      this.serial = "";
      this.deviceInfoHex = "";
      this.wireState = null;
      this.stateDetail = 0;
      this.lastStateAt = 0;
      this.lastResponse = null;
      this.waiters = new Map();
      this.writeLock = Promise.resolve();
      this.heartbeatTimer = null;
      this.doneCounter = 0;
      this.lastDoneSignature = "";
      this.lastStartAt = 0;
      this.disconnectRequested = false;
      this.onCharacteristicValueChanged = this.onCharacteristicValueChanged.bind(this);
      this.onGattDisconnected = this.onGattDisconnected.bind(this);
    }

    get connected() {
      return Boolean(this.device?.gatt?.connected && this.writeChar && this.notifyChar);
    }

    get ready() {
      return this.connected && this.authenticated && this.wireState === 3;
    }

    get browserSupported() {
      return Boolean(root.isSecureContext && root.navigator?.bluetooth);
    }

    snapshot() {
      return {
        connected: this.connected,
        ready: this.ready,
        authenticated: this.authenticated,
        phase: this.phase,
        serial: this.serial,
        deviceName: this.device?.name || "",
        deviceId: this.device?.id || "",
        wireState: this.wireState,
        stateDetail: this.stateDetail,
        stateName: this.wireState == null ? "Unknown" : P.stateName(this.wireState),
        browserSupported: this.browserSupported,
      };
    }

    emitState() {
      this.dispatchEvent(new CustomEvent("statechange", { detail: this.snapshot() }));
    }

    setPhase(phase) {
      this.phase = phase;
      this.emitState();
    }

    log(message, direction = "info", bytes = null) {
      const detail = {
        time: new Date(),
        direction,
        message,
        hex: bytes ? P.hex(bytes) : "",
      };
      this.dispatchEvent(new CustomEvent("log", { detail }));
      this.dispatchEvent(new CustomEvent("telemetry", { detail: { ...detail, perfMs: typeof performance !== "undefined" ? performance.now() : Date.now() } }));
      if (direction === "error") console.error(`[Nova] ${message}`, detail.hex);
      else console.debug(`[Nova] ${message}`, detail.hex);
    }

    async connect() {
      if (!this.browserSupported) {
        throw new Error(root.isSecureContext
          ? "This browser does not expose Web Bluetooth. Use Chrome/Chromium with Web Bluetooth enabled."
          : "Web Bluetooth requires a secure context. Open this app on https:// or http://localhost.");
      }
      if (this.connected) return this.snapshot();

      this.disconnectRequested = false;
      this.setPhase("choosing-device");
      this.log("Opening Nova device chooser");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [P.ADVERTISEMENT_SERVICE] }],
        optionalServices: [P.SERVICE_UUID],
      });
      this.device = device;
      device.addEventListener("gattserverdisconnected", this.onGattDisconnected);

      try {
        this.setPhase("connecting");
        this.log(`Connecting to ${device.name || "selected device"}`);
        this.server = await device.gatt.connect();
        const service = await this.server.getPrimaryService(P.SERVICE_UUID);
        this.writeChar = await service.getCharacteristic(P.WRITE_UUID);
        this.notifyChar = await service.getCharacteristic(P.NOTIFY_UUID);
        await this.notifyChar.startNotifications();
        this.notifyChar.addEventListener("characteristicvaluechanged", this.onCharacteristicValueChanged);
        this.log("Notifications enabled");

        await this.authenticate();
        await this.refreshDeviceInfo().catch(error => this.log(`Device-info query skipped: ${error.message}`, "warn"));
        await this.prepareConnectionState();
        await this.sendHeartbeat().catch(error => this.log(`Initial heartbeat failed: ${error.message}`, "warn"));
        this.startHeartbeat();
        this.emitState();
        return this.snapshot();
      } catch (error) {
        this.log(`Connection failed: ${error.message}`, "error");
        this.forceDisconnect();
        throw error;
      }
    }

    async authenticate() {
      this.setPhase("authenticating");
      const accessFrame = await this.requestCommand(P.COMMANDS.access, 0x07, 5000, "access-info");
      const access = P.parseAccessFrame(accessFrame);
      this.serial = access.serial;
      this.log("Access challenge received");
      const verification = P.deriveVerification(access);
      await this.requestCommand(verification.command, 0x08, 5000, "verification");
      this.authenticated = true;
      this.log("Authentication accepted");
      this.emitState();
    }

    async refreshDeviceInfo() {
      const frame = await this.requestCommand(P.COMMANDS.info, 0x01, 4000, "device-info");
      this.deviceInfoHex = P.hex(frame.payload);
      return frame;
    }

    async prepareConnectionState() {
      const status = await this.queryStatus();
      if (status.state === 0) {
        this.setPhase("initializing");
        this.log("Robot is uninitialized; sending INIT");
        await this.requestCommand(P.COMMANDS.init, 0x80, 5000, "initialize");
        await this.waitForFree(45000);
      } else if (status.state === 2) {
        this.setPhase("initializing");
        this.log("Robot is already initializing; waiting for Ready");
        await this.waitForFree(45000);
      } else if (status.state === 3) {
        this.setPhase("ready");
      } else {
        // Do not automatically stop a robot that was already active when we connected.
        this.setPhase("connected-busy");
        this.log(`Connected while robot is ${P.stateName(status.state)}; Play will wait for Ready or require Stop`, "warn");
      }
      this.emitState();
    }

    startHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (!this.connected || !this.authenticated) return;
        this.sendHeartbeat().catch(error => this.log(`Heartbeat failed: ${error.message}`, "warn"));
      }, 10000);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    async sendHeartbeat() {
      if (!this.connected || !this.authenticated) return null;
      return this.requestCommand(P.COMMANDS.heartbeat, 0x83, 3500, "heartbeat", { quiet: true });
    }

    async queryStatus() {
      const frame = await this.requestCommand(P.COMMANDS.status, 0x02, 4000, "status", { quiet: true });
      return P.parseStatusFrame(frame);
    }

    async ensureReadyForStart() {
      if (!this.connected || !this.authenticated) throw new Error("Nova is not connected and authenticated");
      let status = await this.queryStatus();
      if (status.state === 3) {
        this.setPhase("ready");
        return status;
      }
      if (status.state === 0) {
        this.setPhase("initializing");
        this.log("Robot needs initialization before Start");
        await this.requestCommand(P.COMMANDS.init, 0x80, 5000, "initialize");
        status = await this.waitForFree(45000);
        return status;
      }
      if (status.state === 2 || status.state === 5) {
        this.setPhase(status.state === 2 ? "initializing" : "stopping");
        return this.waitForFree(status.state === 2 ? 45000 : 25000);
      }
      throw new Error(`Robot is ${P.stateName(status.state)} (wire state ${status.state}); press Stop before starting a new drill`);
    }

    async waitForFree(timeoutMs = 25000) {
      const deadline = performance.now() + timeoutMs;
      let last = null;
      while (performance.now() < deadline) {
        if (!this.connected) throw new Error("Nova disconnected while waiting for Ready");
        last = await this.queryStatus();
        if (last.state === 3) {
          this.setPhase("ready");
          return last;
        }
        if (last.state === 202) throw new Error("Nova reported an error state");
        await delay(350);
      }
      throw new Error(`Timed out waiting for Ready; last state was ${last ? P.stateName(last.state) : "unknown"}`);
    }

    async startBatch(packet, { timeoutMs = 30000, description = "batch", expectedDurationMs = 0 } = {}) {
      await this.ensureReadyForStart();
      await this.sendHeartbeat().catch(() => null);
      const doneBaseline = this.doneCounter;
      this.lastStartAt = performance.now();
      this.log(`Starting ${description}`, "tx", packet);
      await this.requestCommand(packet, 0x81, 6000, "start", { logTx: false });
      this.setPhase("running");
      return this.waitForBatchComplete(doneBaseline, timeoutMs, expectedDurationMs);
    }

    async waitForBatchComplete(doneBaseline, timeoutMs, expectedDurationMs = 0) {
      const startedAt = performance.now();
      const deadline = startedAt + timeoutMs;
      let seenActive = this.wireState === 4 || this.wireState === 5 || this.wireState === 6;
      let last = null;

      while (performance.now() < deadline) {
        if (!this.connected) throw new Error("Nova disconnected while a batch was running");
        if (this.doneCounter > doneBaseline) seenActive = true;
        last = await this.queryStatus();
        if ([4, 5, 6].includes(last.state)) seenActive = true;
        if (last.state === 202) throw new Error("Nova reported an error while serving");
        if (last.state === 3 && (seenActive || this.doneCounter > doneBaseline)) {
          this.setPhase("ready");
          return last;
        }
        // A very short run can enter and leave Running between status polls.
        // Only use the fallback after the packet's expected pre-pause/run time;
        // this avoids declaring a 2-second first-ball pre-pause complete at 1.5 s.
        const fallbackAfterMs = Math.max(1800, Number(expectedDurationMs) + 1200);
        if (last.state === 3 && performance.now() - startedAt > fallbackAfterMs) {
          this.log("Batch returned Ready without an observed Running/done transition", "warn");
          this.setPhase("ready");
          return last;
        }
        await delay(260);
      }
      throw new Error(`Timed out waiting for batch completion; last state was ${last ? P.stateName(last.state) : "unknown"}`);
    }

    async stopAndWaitFree(timeoutMs = 25000) {
      if (!this.connected || !this.authenticated) return null;
      let status;
      try {
        status = await this.queryStatus();
      } catch (error) {
        this.log(`Could not read status before Stop: ${error.message}`, "warn");
      }
      if (status?.state === 3) {
        this.setPhase("ready");
        return status;
      }

      this.setPhase("stopping");
      this.log("Sending STOP");
      try {
        await this.requestCommand(P.COMMANDS.stop, 0x80, 6000, "stop");
      } catch (error) {
        this.log(`STOP acknowledgement failed: ${error.message}; still polling state`, "warn");
      }
      return this.waitForFree(timeoutMs);
    }

    emergencyShutdown() {
      // Browser page-exit handlers cannot reliably await BLE writes. Start a
      // best-effort STOP immediately, then disconnect GATT and clear timers.
      this.disconnectRequested = true;
      this.stopHeartbeat();
      try {
        if (this.connected && this.authenticated && this.writeChar) {
          const payload = P.toUint8(P.COMMANDS.stop);
          if (typeof this.writeChar.writeValueWithoutResponse === "function") {
            void this.writeChar.writeValueWithoutResponse(payload).catch(() => {});
          } else if (typeof this.writeChar.writeValue === "function") {
            void this.writeChar.writeValue(payload).catch(() => {});
          }
          this.log("Page closing: best-effort STOP queued", "tx", payload);
        }
      } catch (_) {}
      try { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); } catch (_) {}
      this.forceDisconnect();
    }

    async disconnect({ stopFirst = true } = {}) {
      this.disconnectRequested = true;
      if (stopFirst && this.connected && this.authenticated && this.wireState !== 3 && this.wireState !== 0) {
        await this.stopAndWaitFree().catch(error => this.log(`Could not confirm Ready before disconnect: ${error.message}`, "warn"));
      }
      this.forceDisconnect();
    }

    forceDisconnect() {
      this.stopHeartbeat();
      this.rejectAllWaiters(new Error("Nova disconnected"));
      try {
        this.notifyChar?.removeEventListener("characteristicvaluechanged", this.onCharacteristicValueChanged);
      } catch (_) {}
      try {
        this.device?.removeEventListener("gattserverdisconnected", this.onGattDisconnected);
      } catch (_) {}
      try {
        if (this.device?.gatt?.connected) this.device.gatt.disconnect();
      } catch (_) {}
      this.server = null;
      this.writeChar = null;
      this.notifyChar = null;
      this.authenticated = false;
      this.wireState = null;
      this.stateDetail = 0;
      this.phase = "disconnected";
      this.emitState();
    }

    onGattDisconnected() {
      const wasExpected = this.disconnectRequested;
      this.stopHeartbeat();
      this.rejectAllWaiters(new Error("Nova disconnected"));
      this.server = null;
      this.writeChar = null;
      this.notifyChar = null;
      this.authenticated = false;
      this.wireState = null;
      this.stateDetail = 0;
      this.phase = "disconnected";
      this.log(wasExpected ? "Disconnected" : "Unexpected Bluetooth disconnect", wasExpected ? "info" : "error");
      this.emitState();
      this.dispatchEvent(new CustomEvent("disconnect", { detail: { expected: wasExpected } }));
      this.disconnectRequested = false;
    }

    onCharacteristicValueChanged(event) {
      const value = event.target.value;
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      let frame;
      try {
        frame = P.parseResponse(bytes);
      } catch (error) {
        this.log(`Malformed RX frame: ${error.message}`, "error", bytes);
        return;
      }
      this.lastResponse = frame;
      this.log(`RX opcode 0x${frame.opcode.toString(16).padStart(2, "0")}${frame.success ? "" : ` failure ${frame.status}`}`, "rx", bytes);

      if (frame.opcode === 0x02 && frame.success && frame.payload.length) {
        const previousSignature = `${this.wireState}:${this.stateDetail}`;
        const status = P.parseStatusFrame(frame);
        this.wireState = status.state;
        this.stateDetail = status.detail;
        this.lastStateAt = performance.now();
        const signature = `${status.state}:${status.detail}`;
        if (status.state === 5 && status.detail === 1 && signature !== previousSignature) this.doneCounter += 1;
        if (status.state === 3 && this.authenticated) this.phase = "ready";
        else if (status.state === 4) this.phase = "running";
        else if (status.state === 5) this.phase = "stopping";
        else if (status.state === 6) this.phase = "paused";
        else if (status.state === 2) this.phase = "initializing";
        this.dispatchEvent(new CustomEvent("status", { detail: status }));
        this.emitState();
      }

      const queue = this.waiters.get(frame.opcode);
      if (queue?.length) {
        const waiter = queue.shift();
        if (!queue.length) this.waiters.delete(frame.opcode);
        clearTimeout(waiter.timer);
        waiter.resolve(frame);
      }
    }

    async sendRaw(bytes, { label = "debug raw" } = {}) {
      if (!this.connected) throw new Error("Nova is not connected");
      const command = P.toUint8(bytes);
      this.log(`TX ${label}`, "tx", command);
      await this.enqueueWrite(command);
      return command;
    }

    requestRaw(bytes, expectedOpcode, timeoutMs = 5000, label = "debug request") {
      const opcode = Number(expectedOpcode);
      if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
        return Promise.reject(new Error("Expected response opcode must be 0..255"));
      }
      return this.requestCommand(bytes, opcode, timeoutMs, label);
    }

    requestCommand(bytes, expectedOpcode, timeoutMs = 5000, label = "command", options = {}) {
      if (!this.connected) return Promise.reject(new Error("Nova is not connected"));
      const command = P.toUint8(bytes);
      const { quiet = false, logTx = true } = options;

      return new Promise((resolve, reject) => {
        const queue = this.waiters.get(expectedOpcode) || [];
        const waiter = { resolve: null, reject, timer: null };
        waiter.timer = setTimeout(() => {
          this.removeWaiter(expectedOpcode, waiter);
          reject(new Error(`${label} timed out waiting for opcode 0x${expectedOpcode.toString(16)}`));
        }, timeoutMs);
        waiter.resolve = frame => {
          if (!frame.success) {
            reject(new Error(`${label} rejected by Nova (status ${frame.status}, opcode 0x${frame.opcode.toString(16)})`));
            return;
          }
          resolve(frame);
        };
        queue.push(waiter);
        this.waiters.set(expectedOpcode, queue);

        if (!quiet && logTx) this.log(`TX ${label}`, "tx", command);
        this.enqueueWrite(command).catch(error => {
          clearTimeout(waiter.timer);
          this.removeWaiter(expectedOpcode, waiter);
          reject(error);
        });
      });
    }

    removeWaiter(opcode, waiter) {
      const queue = this.waiters.get(opcode);
      if (!queue) return;
      const index = queue.indexOf(waiter);
      if (index >= 0) queue.splice(index, 1);
      if (!queue.length) this.waiters.delete(opcode);
    }

    rejectAllWaiters(error) {
      for (const queue of this.waiters.values()) {
        for (const waiter of queue) {
          clearTimeout(waiter.timer);
          waiter.reject(error);
        }
      }
      this.waiters.clear();
    }

    enqueueWrite(bytes) {
      this.writeLock = this.writeLock.catch(() => {}).then(async () => {
        if (!this.writeChar) throw new Error("Nova write characteristic is unavailable");
        const payload = P.toUint8(bytes);
        const properties = this.writeChar.properties || {};
        const failures = [];

        if (properties.write !== false && typeof this.writeChar.writeValueWithResponse === "function") {
          try {
            await this.writeChar.writeValueWithResponse(payload);
            return;
          } catch (error) {
            failures.push(`with-response: ${error.message}`);
          }
        }
        if (typeof this.writeChar.writeValue === "function") {
          try {
            await this.writeChar.writeValue(payload);
            return;
          } catch (error) {
            failures.push(`writeValue: ${error.message}`);
          }
        }
        if (properties.writeWithoutResponse !== false && typeof this.writeChar.writeValueWithoutResponse === "function") {
          try {
            await this.writeChar.writeValueWithoutResponse(payload);
            return;
          } catch (error) {
            failures.push(`without-response: ${error.message}`);
          }
        }
        throw new Error(`No GATT write method succeeded${failures.length ? ` (${failures.join("; ")})` : ""}`);
      });
      return this.writeLock;
    }

  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  root.NovaBleController = NovaBleController;
})(typeof globalThis !== "undefined" ? globalThis : this);
