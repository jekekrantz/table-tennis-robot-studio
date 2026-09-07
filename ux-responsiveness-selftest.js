#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const { performance } = require("perf_hooks");
const Adjustments = require("./drill-adjustments.js");

require("./pongbot-protocol.js");
require("./pongbot-ble.js");

const app = fs.readFileSync("app.js", "utf8");
const bundle = fs.readFileSync("runtime.bundle.js", "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && --depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Could not parse function ${name}`);
}

// Continuous gestures must only paint while moving and commit once on change.
const intervalBindings = functionBody(app, "bindIntervalControls");
assert(intervalBindings.includes('input.addEventListener("input", () => sync(input))'));
assert(intervalBindings.includes('input.addEventListener("change", () => sync(input, true))'));

// Run sliders must not rebuild the invisible trajectory-heavy inspector.
const liveTuning = functionBody(app, "setLiveTuning");
assert(liveTuning.includes('if (appView === "editor") renderInspector()'));
assert(!/^\s*renderInspector\(\);\s*$/m.test(liveTuning), "Run tuning must not unconditionally render the inspector");

// Every streaming Start is guarded by the current playback request, and mouse
// double-click activation cannot immediately reverse the first click.
const playback = functionBody(app, "startPlayback");
assert(playback.includes("const playbackStillRequested"));
assert(playback.includes("if (!playbackStillRequested()) return;"));
assert.strictEqual((playback.match(/shouldStart: playbackStillRequested/g) || []).length, 3);
assert(app.includes("if (event.detail > 1) return;"));

// Unit-test the controller gate with pessimistic asynchronous delays. These
// tests use no Bluetooth hardware and no state that cannot arise through Play
// followed by Stop in the GUI.
async function testStartCancellation() {
  const Controller = globalThis.NovaBleController;
  const controller = new Controller();
  controller.device = { gatt: { connected: true } };
  controller.writeChar = {};
  controller.notifyChar = {};
  controller.authenticated = true;
  controller.wireState = 3;
  controller.sendHeartbeat = async () => null;
  controller.ensureReadyForStart = async () => new Promise(resolve => setTimeout(resolve, 20));
  let starts = 0;
  let stops = 0;
  let forcedStops = 0;
  controller.requestCommand = async bytes => {
    if (bytes[0] === 0x81) {
      starts += 1;
      controller.wireState = 4;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return { success: true };
  };
  controller.stopAndWaitFree = async (_timeout, options = {}) => {
    stops += 1;
    if (options.force) forcedStops += 1;
    controller.wireState = 3;
    return { state: 3 };
  };

  const packet = Uint8Array.from([0x81, 0, 0]);
  let requested = true;
  const beforeSend = controller.beginBatch(packet, { shouldStart: () => requested, description: "delayed readiness" });
  setTimeout(() => { requested = false; }, 5);
  assert.strictEqual(await beforeSend, null);
  assert.strictEqual(starts, 0, "cancellation during readiness must prevent Start transmission");

  requested = true;
  controller.ensureReadyForStart = async () => ({ state: 3 });
  const duringAck = controller.beginBatch(packet, { shouldStart: () => requested, description: "delayed acknowledgement" });
  setTimeout(() => { requested = false; }, 5);
  assert.strictEqual(await duringAck, null);
  assert.strictEqual(starts, 1, "the simulated Start should have reached the robot");
  assert.strictEqual(stops, 1, "cancellation during Start acknowledgement must reconcile with STOP");
  assert.strictEqual(forcedStops, 1, "post-Start cancellation must bypass a possibly stale Ready fast-path");

  const forceController = new Controller();
  forceController.device = { gatt: { connected: true } };
  forceController.writeChar = {};
  forceController.notifyChar = {};
  forceController.authenticated = true;
  forceController.wireState = 3; // deliberately stale Ready after accepted Start
  forceController.queryStatus = async () => ({ state: 3 });
  let forcedStopPackets = 0;
  forceController.requestCommand = async bytes => {
    if (bytes[0] === 0x80 && bytes[3] === 1) forcedStopPackets += 1;
    return { success: true };
  };
  forceController.waitForFree = async () => ({ state: 3 });
  await forceController.stopAndWaitFree(100, { force: true });
  assert.strictEqual(forcedStopPackets, 1, "forced reconciliation must send STOP even when the cached/query state says Ready");
}

function toyPredict(p) {
  const elevation = p.elevationDeg * Math.PI / 180;
  const distance = .31 * p.speedMps * Math.cos(elevation) + .018 * p.elevationDeg - .0015 * p.spinRps;
  return {
    landing: { x: distance, y: distance * Math.tan((p.aimDeg || 0) * Math.PI / 180) },
    net: { crossed: true, hit: false, clearanceM: .08 + .0075 * p.elevationDeg - .004 * p.speedMps - .0007 * p.spinRps },
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function profileGuiValidTuning() {
  const base = { speedMps: 7.5, spinRps: 20, elevationDeg: 12, aimDeg: 8 };
  const samples = [];
  let maxEvaluations = 0;
  for (let index = 0; index < 80; index += 1) {
    const tuning = {
      pacePct: -50 + index % 151,
      clearancePct: -100 + index % 301,
      speedPct: -50 + index % 101,
      spinPct: -100 + index % 401,
    };
    const started = performance.now();
    const result = Adjustments.applyShotTuning(base, tuning, toyPredict, { minSpeedMps: 1, maxSpeedMps: 20 });
    samples.push(performance.now() - started);
    maxEvaluations = Math.max(maxEvaluations, result.evaluations || 0);
  }
  const measured = samples.slice(1); // one warm-up, as required by the contract
  const p95 = percentile(measured, .95);
  const max = Math.max(...measured);
  assert(maxEvaluations <= 24, `live tuning exceeded its hard evaluation budget: ${maxEvaluations}`);
  // CI ceilings catch orders-of-magnitude regressions; browser/device profiling
  // enforces the tighter interaction targets documented for production.
  assert(p95 <= 25, `live-tuning solver p95 unexpectedly slow: ${p95.toFixed(2)} ms`);
  assert(max <= 50, `live-tuning solver tail unexpectedly slow: ${max.toFixed(2)} ms`);
  return { p95, max, maxEvaluations };
}

(async () => {
  await testStartCancellation();
  const profile = profileGuiValidTuning();
  // Deployment protection: preflight already checks full bundle equality; these
  // checks make failures explain the missing UX guarantees directly.
  for (const token of ["shouldStart: playbackStillRequested", 'if (appView === "editor") renderInspector()', "if (event.detail > 1) return;"]) {
    assert(bundle.includes(token), `Generated deployment bundle is missing UX protection: ${token}`);
  }
  console.log(`UX responsiveness self-test PASS · solver p95 ${profile.p95.toFixed(2)} ms · max ${profile.max.toFixed(2)} ms · ${profile.maxEvaluations} evaluations max`);
})().catch(error => {
  console.error("UX responsiveness self-test FAIL");
  console.error(error);
  process.exitCode = 1;
});
