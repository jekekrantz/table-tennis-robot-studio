#!/usr/bin/env node
'use strict';
require('./pongbot-protocol.js');
require('./pongbot-ble.js');
const assert = require('assert');
const P = globalThis.PongbotProtocol;
const Controller = globalThis.NovaBleController;

async function main() {
  const controller = new Controller();
  const writes = [];
  let disconnects = 0;
  let connected = true;
  const deviceEvents = new EventTarget();
  const device = {
    name: 'NOVA_TEST', id: 'exit-test',
    addEventListener: (...args) => deviceEvents.addEventListener(...args),
    removeEventListener: (...args) => deviceEvents.removeEventListener(...args),
    gatt: {
      get connected() { return connected; },
      disconnect() { disconnects += 1; connected = false; },
    },
  };
  controller.device = device;
  controller.writeChar = {
    async writeValueWithoutResponse(data) { writes.push(P.hex(data)); },
  };
  controller.notifyChar = new EventTarget();
  controller.authenticated = true;
  controller.phase = 'running';
  controller.heartbeatTimer = setInterval(() => {}, 10000);

  controller.emergencyShutdown();
  // emergencyShutdown intentionally does not await the BLE write; flush microtasks.
  await Promise.resolve();
  assert(writes.includes(P.hex(P.COMMANDS.stop)), 'page-exit shutdown must attempt STOP');
  assert.strictEqual(disconnects, 1, 'page-exit shutdown must disconnect GATT');
  assert.strictEqual(controller.heartbeatTimer, null, 'page-exit shutdown must stop heartbeat timer');
  assert.strictEqual(controller.connected, false, 'controller must finish disconnected');
  assert.strictEqual(controller.authenticated, false, 'controller auth state must be cleared');
  console.log('Emergency page-exit STOP/disconnect self-test: PASS');
}
main().catch(err => { console.error(err.stack || err); process.exit(1); });
