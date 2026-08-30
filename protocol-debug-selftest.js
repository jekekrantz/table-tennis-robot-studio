"use strict";
const assert = require("assert");
const D = require("./protocol-debug.js");

const source = `
# Comments and blank lines are ignored
MARK before heartbeat
STATUS  # macro
WAIT 250ms
TX 83 06 00 // fire-and-forget heartbeat
WAIT 1.5s
REQ 83 0x83 0x06 0x00 TIMEOUT 2s
HEARTBEAT
`;
const parsed = D.parseScript(source);
assert.deepStrictEqual(parsed.errors, []);
assert.strictEqual(parsed.actions.length, 7);
assert.strictEqual(parsed.actions[1].type, "request");
assert.strictEqual(parsed.actions[1].expectedOpcode, 0x02);
assert.strictEqual(parsed.actions[2].durationMs, 250);
assert.strictEqual(parsed.actions[3].hex, "830600");
assert.strictEqual(parsed.actions[4].durationMs, 1500);
assert.strictEqual(parsed.actions[5].expectedOpcode, 0x83);
assert.strictEqual(parsed.actions[5].timeoutMs, 2000);
assert.strictEqual(parsed.actions[6].hex, "830600");
assert.strictEqual(D.normalizeHex("0x81 1c,00"), "811c00");
assert.strictEqual(D.parseDuration("2.5s"), 2500);
assert.strictEqual(D.parseDuration("25"), 25);
assert.ok(D.parseScript("WAIT nope\nTX 1").errors.length === 2);
const summary = D.summarize(parsed.actions);
assert.strictEqual(summary.waitMs, 1750);
assert.strictEqual(summary.request, 3);
assert.strictEqual(summary.send, 1);
console.log("Protocol debug parser self-test PASS");
