#!/usr/bin/env node
"use strict";

/*
 * Offline protocol + controller integration test.
 * No Bluetooth hardware is touched. Run with: node selftest.js
 */

require("./pongbot-protocol.js");
require("./pongbot-ble.js");

const P = globalThis.PongbotProtocol;
const NovaBleController = globalThis.NovaBleController;

function frame(opcode, payload = []) {
  const body = Uint8Array.from(payload);
  return P.concatBytes(Uint8Array.from([0, opcode, body.length & 0xff, body.length >> 8]), body);
}

class FakeNotify extends EventTarget {
  constructor() {
    super();
    this.value = new DataView(new ArrayBuffer(0));
  }
  async startNotifications() { return this; }
  emit(data) {
    const copy = new Uint8Array(P.toUint8(data));
    this.value = new DataView(copy.buffer);
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }
}

class FakeWrite {
  constructor(fake) {
    this.fake = fake;
    this.writes = [];
  }
  async writeValueWithResponse(data) {
    const command = new Uint8Array(data);
    this.writes.push(P.hex(command));
    this.fake.onWrite(command);
  }
}

class FakeNova {
  constructor(initialState = 0) {
    this.state = initialState;
    this.detail = 0;
    this.connected = false;
    this.notify = new FakeNotify();
    this.write = new FakeWrite(this);
    this.disconnectEvents = new EventTarget();

    const service = {
      getCharacteristic: async uuid => uuid === P.WRITE_UUID ? this.write : this.notify,
    };
    const self = this;
    this.device = {
      name: "NOVA_TEST",
      id: "mock-nova",
      addEventListener: (...args) => self.disconnectEvents.addEventListener(...args),
      removeEventListener: (...args) => self.disconnectEvents.removeEventListener(...args),
      gatt: {
        get connected() { return self.connected; },
        connect: async () => {
          self.connected = true;
          return { getPrimaryService: async () => service };
        },
        disconnect: () => {
          if (!self.connected) return;
          self.connected = false;
          self.disconnectEvents.dispatchEvent(new Event("gattserverdisconnected"));
        },
      },
    };
  }

  later(ms, callback) { setTimeout(callback, ms); }
  emit(data) { this.later(2, () => this.notify.emit(data)); }
  statusFrame() { return frame(0x02, [this.state, this.detail & 0xff, this.detail >> 8]); }

  onWrite(command) {
    const opcode = command[0];
    if (opcode === 0x07) {
      this.emit(P.bytesFromHex("000714000c06544553543030303030303031414243313233"));
      return;
    }
    if (opcode === 0x08) { this.emit(frame(0x08)); return; }
    if (opcode === 0x01) { this.emit(frame(0x01, [1, 2, 3])); return; }
    if (opcode === 0x02) { this.emit(this.statusFrame()); return; }
    if (opcode === 0x83) { this.emit(frame(0x83)); return; }

    if (opcode === 0x80) {
      const action = command[3];
      this.emit(frame(0x80));
      if (action === 0) {
        this.state = 2;
        this.detail = 0;
        this.later(40, () => { this.state = 3; this.detail = 0; });
      } else if (action === 1) {
        this.state = 5;
        this.detail = 0;
        this.later(40, () => { this.state = 3; this.detail = 0; });
      }
      return;
    }

    if (opcode === 0x81) {
      this.emit(frame(0x81));
      this.later(20, () => { this.state = 4; this.detail = 0; });
      this.later(100, () => {
        this.state = 5;
        this.detail = 1;
        this.notify.emit(this.statusFrame());
      });
      this.later(180, () => { this.state = 3; this.detail = 0; });
      return;
    }

    throw new Error(`Mock does not implement command ${P.hex(command)}`);
  }
}

async function main() {
  P.selfTest();

  const fake = new FakeNova();
  Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(globalThis.navigator, "bluetooth", {
    value: { requestDevice: async () => fake.device },
    configurable: true,
  });

  const controller = new NovaBleController();
  await controller.connect();
  if (!controller.ready || controller.serial !== "TEST00000001") {
    throw new Error(`Mock connection did not reach Ready: ${JSON.stringify(controller.snapshot())}`);
  }

  const rawStatus = await controller.requestRaw(P.COMMANDS.status, 0x02, 2000, "mock raw status");
  const parsedRawStatus = P.parseStatusFrame(rawStatus);
  if (parsedRawStatus.state !== 3) throw new Error("requestRaw did not return the Ready status frame");
  await controller.sendRaw(P.COMMANDS.heartbeat, { label: "mock fire-and-forget heartbeat" });

  const ball = P.packBallRecord({
    wheelA: 2861,
    wheelB: 2861,
    pitchDeg: -10 / 3,
    yawDeg: 0,
    frequencyHz: 0.6,
    count: 1,
  });
  const packet = P.buildStartPacket([ball], { mode: 1, value: 1, sequence: 0 });
  await controller.startBatch(packet, { timeoutMs: 3000, description: "mock one-ball batch" });
  if (controller.wireState !== 3 || controller.doneCounter < 1) {
    throw new Error("Mock Start did not complete and return Ready");
  }

  // Calibration Test Shot uses the same one-run Start path, exactly one
  // 24-byte record, count=1, and waits for Ready again after completion.
  const calibrationBall = P.packBallRecord({
    wheelA: 3400,
    wheelB: 2600,
    pitchDeg: 4,
    yawDeg: -3,
    frequencyHz: 1.5,
    count: 1,
  });
  const calibrationPacket = P.buildStartPacket([calibrationBall], { mode: 1, value: 1, sequence: 0 });
  if (calibrationPacket.length !== 31) throw new Error(`Calibration packet should be 31 bytes, got ${calibrationPacket.length}`);
  await controller.startBatch(calibrationPacket, {
    timeoutMs: 3000,
    expectedDurationMs: (1 / 1.5) * 1000,
    description: "mock calibration test shot",
  });
  if (controller.wireState !== 3 || controller.doneCounter < 2) {
    throw new Error("Mock calibration test shot did not complete and return Ready");
  }
  if (!fake.write.writes.includes(P.hex(calibrationPacket))) {
    throw new Error("Calibration one-ball Start packet was not written");
  }

  fake.state = 4;
  fake.detail = 0;
  await controller.queryStatus();
  await controller.stopAndWaitFree(3000);
  if (controller.wireState !== 3) throw new Error("Mock Stop did not return Ready");

  await controller.disconnect({ stopFirst: true });

  // Critical state-gate regression tests: Ready must never be re-initialized,
  // and an already-Initializing robot must only be waited out.
  for (const initialState of [3, 2]) {
    const gateFake = new FakeNova(initialState);
    if (initialState === 2) gateFake.later(80, () => { gateFake.state = 3; gateFake.detail = 0; });
    navigator.bluetooth.requestDevice = async () => gateFake.device;
    const gateController = new NovaBleController();
    await gateController.connect();
    if (!gateController.ready) throw new Error(`State-gate test ${initialState} did not reach Ready`);
    if (gateFake.write.writes.includes("80010000")) {
      throw new Error(`State-gate regression: Init was sent while initial state was ${initialState}`);
    }
    await gateController.disconnect({ stopFirst: true });
  }

  const expectedVerify = "0820003135383861396565393433353664313430643034313734633361393964333564";
  if (!fake.write.writes.includes(expectedVerify)) throw new Error("Known verification frame was not written");
  if (!fake.write.writes.some(value => value.startsWith("811c0001010000"))) {
    throw new Error("One-run Start packet was not written");
  }

  console.log("Table Tennis Robot Studio self-test: PASS");
  console.log(`  protocol MD5/auth/known Start vectors: PASS`);
  console.log(`  mock BLE auth/init/heartbeat/Start/done/Stop/Ready: PASS\n  repeated one-ball calibration Start/Ready cycle: PASS`);
  console.log(`  Ready/Initializing state gate (no redundant Init): PASS`);
  console.log(`  mock GATT writes: ${fake.write.writes.length}`);
}

main().catch(error => {
  console.error("Table Tennis Robot Studio self-test: FAIL");
  console.error(error.stack || error);
  process.exit(1);
});
