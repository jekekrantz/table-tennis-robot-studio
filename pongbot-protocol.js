(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PongbotProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ADVERTISEMENT_SERVICE = 0xfeff;
  const SERVICE_UUID = "02f00000-0000-0000-0000-00000000fe00";
  const WRITE_UUID = "02f00000-0000-0000-0000-00000000ff01";
  const NOTIFY_UUID = "02f00000-0000-0000-0000-00000000ff02";
  const SALT = "Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw";

  const COMMANDS = Object.freeze({
    info: new Uint8Array([0x01, 0x00, 0x00]),
    status: new Uint8Array([0x02, 0x00, 0x00]),
    access: new Uint8Array([0x07, 0x00, 0x00]),
    init: new Uint8Array([0x80, 0x01, 0x00, 0x00]),
    stop: new Uint8Array([0x80, 0x01, 0x00, 0x01]),
    pause: new Uint8Array([0x80, 0x01, 0x00, 0x02]),
    continue: new Uint8Array([0x80, 0x01, 0x00, 0x03]),
    heartbeat: new Uint8Array([0x83, 0x06, 0x00]),
  });

  const DEVICE_STATES = Object.freeze({
    0: "Uninitialized",
    2: "Initializing",
    3: "Ready",
    4: "Running",
    5: "Stopping",
    6: "Paused",
    7: "Busy",
    10: "Reading module",
    60: "Joint adjustment",
    202: "Error",
  });

  function stateName(value) {
    return DEVICE_STATES[value] || `State ${value}`;
  }

  function toUint8(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    throw new TypeError("Expected byte array");
  }

  function concatBytes(...parts) {
    const arrays = parts.map(toUint8);
    const total = arrays.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of arrays) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function hex(bytes) {
    return [...toUint8(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function bytesFromHex(text) {
    const clean = String(text).replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2) throw new Error("Hex string has an odd number of digits");
    const result = new Uint8Array(clean.length / 2);
    for (let i = 0; i < result.length; i += 1) result[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return result;
  }

  function leftRotate(value, count) {
    return ((value << count) | (value >>> (32 - count))) >>> 0;
  }

  // RFC 1321 MD5 over raw bytes. Web Crypto intentionally does not expose MD5.
  function md5Hex(input) {
    const bytes = toUint8(input);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const lengthView = new DataView(data.buffer);
    const low = bitLength >>> 0;
    const high = Math.floor(bitLength / 0x100000000) >>> 0;
    lengthView.setUint32(paddedLength - 8, low, true);
    lengthView.setUint32(paddedLength - 4, high, true);

    const shifts = [
      7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
      5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
      4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
      6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
    ];
    const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let offset = 0; offset < data.length; offset += 64) {
      const view = new DataView(data.buffer, offset, 64);
      const m = Array.from({ length: 16 }, (_, i) => view.getUint32(i * 4, true));
      let a = a0, b = b0, c = c0, d = d0;

      for (let i = 0; i < 64; i += 1) {
        let f, g;
        if (i < 16) {
          f = (b & c) | ((~b) & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | ((~d) & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | (~d));
          g = (7 * i) % 16;
        }
        const mixed = (a + (f >>> 0) + constants[i] + m[g]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + leftRotate(mixed, shifts[i])) >>> 0;
      }

      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }

    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return hex(out);
  }

  function parseResponse(input) {
    const bytes = toUint8(input);
    if (bytes.length < 4) throw new Error(`Short robot response (${bytes.length} bytes)`);
    const status = bytes[0];
    const opcode = bytes[1];
    const declaredLength = bytes[2] | (bytes[3] << 8);
    const payload = bytes.slice(4);
    return {
      bytes,
      hex: hex(bytes),
      status,
      success: status === 0,
      opcode,
      declaredLength,
      payload,
      lengthMatches: payload.length === declaredLength,
    };
  }

  function parseStatusFrame(frameOrBytes) {
    const frame = frameOrBytes?.payload ? frameOrBytes : parseResponse(frameOrBytes);
    if (frame.opcode !== 0x02) throw new Error(`Expected status opcode 0x02, got 0x${frame.opcode.toString(16)}`);
    if (!frame.success) throw new Error(`Robot status request failed (${frame.status})`);
    if (frame.payload.length < 1) throw new Error("Status response has no state byte");
    const state = frame.payload[0];
    const detail = frame.payload.length >= 3 ? frame.payload[1] | (frame.payload[2] << 8) : 0;
    return { state, detail, name: stateName(state), frame };
  }

  function parseAccessFrame(frameOrBytes) {
    const frame = frameOrBytes?.payload ? frameOrBytes : parseResponse(frameOrBytes);
    if (frame.opcode !== 0x07) throw new Error(`Expected access opcode 0x07, got 0x${frame.opcode.toString(16)}`);
    if (!frame.success) throw new Error(`Access request failed (${frame.status})`);
    const payload = frame.payload;
    if (payload.length < 2) throw new Error("Access response is too short");
    const serialLength = payload[0];
    const challengeLength = payload[1];
    const expected = 2 + serialLength + challengeLength;
    if (payload.length < expected) throw new Error(`Access response payload is truncated (${payload.length}/${expected})`);
    const serialBytes = payload.slice(2, 2 + serialLength);
    const challengeBytes = payload.slice(2 + serialLength, expected);
    const decoder = new TextDecoder();
    return {
      serialLength,
      challengeLength,
      serialBytes,
      challengeBytes,
      serial: decoder.decode(serialBytes),
      challenge: decoder.decode(challengeBytes),
      frame,
    };
  }

  function deriveVerification(access) {
    const parsed = access?.serialBytes ? access : parseAccessFrame(access);
    const salt = new TextEncoder().encode(SALT);
    const mapped = new Uint8Array(parsed.serialBytes.length);
    for (let i = 0; i < parsed.serialBytes.length; i += 1) mapped[i] = salt[parsed.serialBytes[i] % 36];
    const digest = md5Hex(concatBytes(parsed.serialBytes, mapped, parsed.challengeBytes));
    const ascii = new TextEncoder().encode(digest);
    return {
      digest,
      command: concatBytes(new Uint8Array([0x08, 0x20, 0x00]), ascii),
    };
  }

  function frequencyHzFromPercent(percent) {
    const value = Math.max(0, Math.min(100, Number(percent)));
    return 0.5 + value / 100;
  }

  function delaySecondsFromFrequencyHz(frequencyHz) {
    const value = Number(frequencyHz);
    if (!(value > 0)) throw new Error("Frequency must be positive");
    return 1 / value;
  }

  function frequencyHzFromDelaySeconds(delaySeconds) {
    const value = Number(delaySeconds);
    if (!(value > 0)) throw new Error("Delay must be positive");
    return 1 / value;
  }

  function packBallRecord({ wheelA, wheelB, pitchDeg, yawDeg, frequencyHz, count = 1 }) {
    // Wire field 16 is the robot's frequency value in Hz.
    const wireFrequency = Number(frequencyHz);
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);
    view.setInt32(0, Math.trunc(wheelA), true);
    view.setInt32(4, Math.trunc(wheelB), true);
    view.setFloat32(8, Number(pitchDeg), true);
    view.setFloat32(12, Number(yawDeg), true);
    view.setFloat32(16, wireFrequency, true);
    view.setInt32(20, Math.trunc(count), true);
    return new Uint8Array(buffer);
  }

  function buildStartPacket(records, { mode = 1, value = 1, sequence = 0 } = {}) {
    const balls = records.map(toUint8);
    for (const ball of balls) {
      if (ball.length !== 24) throw new Error(`Ball record must be 24 bytes, got ${ball.length}`);
    }
    const bodyLength = 4 + balls.length * 24;
    if (bodyLength > 0xffff) throw new Error("Start packet is too large");
    const packet = new Uint8Array(3 + bodyLength);
    packet[0] = 0x81;
    packet[1] = bodyLength & 0xff;
    packet[2] = (bodyLength >> 8) & 0xff;
    packet[3] = mode & 0xff;
    packet[4] = value & 0xff;
    packet[5] = (value >> 8) & 0xff;
    packet[6] = sequence & 0xff;
    let offset = 7;
    for (const ball of balls) {
      packet.set(ball, offset);
      offset += 24;
    }
    return packet;
  }

  function buildLiveAdjustPacket(records) {
    const balls = records.map(toUint8);
    if (!balls.length) throw new Error("Live-adjust packet needs at least one ball record");
    for (const ball of balls) {
      if (ball.length !== 24) throw new Error(`Ball record must be 24 bytes, got ${ball.length}`);
    }
    const bodyLength = balls.length * 24;
    if (bodyLength > 0xffff) throw new Error("Live-adjust packet is too large");
    const packet = new Uint8Array(3 + bodyLength);
    packet[0] = 0x84;
    packet[1] = bodyLength & 0xff;
    packet[2] = (bodyLength >> 8) & 0xff;
    let offset = 3;
    for (const ball of balls) {
      packet.set(ball, offset);
      offset += 24;
    }
    return packet;
  }

  function selfTest() {
    const failures = [];
    const expect = (name, actual, wanted) => {
      if (actual !== wanted) failures.push(`${name}: ${actual} != ${wanted}`);
    };
    expect("MD5 abc", md5Hex(new TextEncoder().encode("abc")), "900150983cd24fb0d6963f7d28e17f72");

    const accessFrame = bytesFromHex("000714000c06544553543030303030303031414243313233");
    const access = parseAccessFrame(accessFrame);
    expect("serial", access.serial, "TEST00000001");
    expect("challenge", access.challenge, "ABC123");
    const verify = deriveVerification(access);
    expect("auth digest", verify.digest, "1588a9ee94356d140d04174c3a99d35d");
    expect("verify frame length", String(verify.command.length), "35");
    expect("frequency 10%", String(frequencyHzFromPercent(10)), "0.6");
    expect("frequency 20% prepause", delaySecondsFromFrequencyHz(frequencyHzFromPercent(20)).toFixed(6), "1.428571");
    expect("frequency 50% prepause", delaySecondsFromFrequencyHz(frequencyHzFromPercent(50)).toFixed(6), "1.000000");

    const record = packBallRecord({
      wheelA: 2861,
      wheelB: 2861,
      pitchDeg: -10 / 3,
      yawDeg: 0,
      frequencyHz: 0.6,
      count: 1,
    });
    expect("known ball record", hex(record), "2d0b00002d0b0000555555c0000000009a99193f01000000");
    const knownStart = buildStartPacket([record], { mode: 0, value: 5, sequence: 0 });
    expect("known tested start", hex(knownStart), "811c00000500002d0b00002d0b0000555555c0000000009a99193f01000000");
    const knownLiveAdjust = buildLiveAdjustPacket([record]);
    expect("known live-adjust", hex(knownLiveAdjust), "8418002d0b00002d0b0000555555c0000000009a99193f01000000");

    if (failures.length) throw new Error(`Pongbot protocol self-test failed: ${failures.join("; ")}`);
    return true;
  }

  return Object.freeze({
    ADVERTISEMENT_SERVICE,
    SERVICE_UUID,
    WRITE_UUID,
    NOTIFY_UUID,
    SALT,
    COMMANDS,
    DEVICE_STATES,
    stateName,
    toUint8,
    concatBytes,
    hex,
    bytesFromHex,
    md5Hex,
    parseResponse,
    parseStatusFrame,
    parseAccessFrame,
    deriveVerification,
    frequencyHzFromPercent,
    delaySecondsFromFrequencyHz,
    frequencyHzFromDelaySeconds,
    packBallRecord,
    buildStartPacket,
    buildLiveAdjustPacket,
    selfTest,
  });
});
