#!/usr/bin/env node
"use strict";

require("./pongbot-protocol.js");
const P = globalThis.PongbotProtocol;

function frame(opcode, payload = []) {
  const body = Uint8Array.from(payload);
  return P.concatBytes(Uint8Array.from([0, opcode, body.length & 0xff, body.length >> 8]), body);
}

let state = 3;
let disconnected = false;
globalThis.NativeApp = {
  isNativeHost:() => true,
  supportsNativeBluetooth:() => true,
  bluetoothConnect:() => setTimeout(() => globalThis.__nativeBluetoothEvent(JSON.stringify({ type:"connected", name:"NOVA_NATIVE_TEST", id:"native-test" })), 1),
  bluetoothDisconnect:() => {
    if (disconnected) return;
    disconnected = true;
    setTimeout(() => globalThis.__nativeBluetoothEvent(JSON.stringify({ type:"disconnected", expected:true })), 1);
  },
  bluetoothWrite:(requestId, hex) => {
    const command = P.bytesFromHex(hex);
    setTimeout(() => globalThis.__nativeBluetoothEvent(JSON.stringify({ type:"write-complete", requestId })), 1);
    let response;
    if (command[0] === 0x07) response = P.bytesFromHex("000714000c06544553543030303030303031414243313233");
    else if (command[0] === 0x08) response = frame(0x08);
    else if (command[0] === 0x01) response = frame(0x01, [1, 2, 3]);
    else if (command[0] === 0x02) response = frame(0x02, [state, 0, 0]);
    else if (command[0] === 0x83) response = frame(0x83);
    else throw new Error(`Unexpected native command ${hex}`);
    setTimeout(() => globalThis.__nativeBluetoothEvent(JSON.stringify({ type:"notification", hex:P.hex(response) })), 2);
  },
};

require("./pongbot-ble.js");

(async () => {
  const controller = new globalThis.NovaBleController();
  if (!controller.nativeSupported || controller.snapshot().transport !== "native-android") throw new Error("Native transport was not selected");
  await controller.connect();
  if (!controller.ready || controller.serial !== "TEST00000001") throw new Error(`Native controller did not reach Ready: ${JSON.stringify(controller.snapshot())}`);
  if (controller.snapshot().deviceName !== "NOVA_NATIVE_TEST") throw new Error("Native device identity was not retained");
  await controller.sendHeartbeat();
  await controller.disconnect({ stopFirst:false });
  console.log("Native Android BLE transport self-test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
