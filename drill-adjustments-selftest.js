#!/usr/bin/env node
"use strict";
const assert = require("assert");
const A = require("./drill-adjustments.js");

// A deliberately simple, smooth surrogate trajectory for testing optimizer
// behavior without coupling this module to the browser app. It has enough
// speed/elevation/spin interaction to exercise the compensation rules.
function toyPredict(p) {
  const e = p.elevationDeg * Math.PI / 180;
  const spin = p.spinRps;
  const distance = 0.31 * p.speedMps * Math.cos(e) + 0.018 * p.elevationDeg - 0.0015 * spin;
  const y = distance * Math.tan((p.aimDeg || 0) * Math.PI / 180);
  const clearanceM = 0.08 + 0.0075 * p.elevationDeg - 0.004 * p.speedMps - 0.0007 * spin;
  return {
    landing: { x: distance, y },
    net: { crossed: true, hit: clearanceM < 0, clearanceM },
  };
}

const base = { speedMps: 7.5, spinRps: 20, elevationDeg: 12, aimDeg: 8 };
const basePred = toyPredict(base);

assert(Math.abs(A.delayWithPace(1, { pacePct: 5 }) - 1 / 1.05) < 1e-12);
assert(Math.abs(A.delayWithPace(1, { pacePct: -5 }) - 1 / 0.95) < 1e-12);
assert.strictEqual(A.delayWithPace(1, { pacePct: 100 }), 0.5, "+100% pace should halve delays");
assert.strictEqual(A.delayWithPace(1, { pacePct: -50 }), 2, "-50% pace should double delays");
assert.deepStrictEqual(A.normalizeTuning({ speedPct: 7, pacePct: -53 }), { pacePct: -50, clearancePct: 0, spinPct: 0, speedPct: 8 });
assert.deepStrictEqual(
  A.normalizeTuning({ pacePct: 999, clearancePct: -999, spinPct: 999, speedPct: -999 }),
  { pacePct: 100, clearancePct: -100, spinPct: 300, speedPct: -50 },
  "each tuning parameter should use its own range"
);

const faster = A.applyShotTuning(base, { speedPct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(faster.params.speedMps - 8.25) < 1e-9, "speed tuning should keep requested speed exact when clearance is unchanged");
assert(Math.abs(faster.params.spinRps - 20) < 1e-9, "speed tuning should keep spin unchanged");
assert(faster.landingErrorM < 0.01, `speed compensation landing error too large: ${faster.landingErrorM}`);

const moreSpin = A.applyShotTuning(base, { spinPct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(moreSpin.params.speedMps - 7.5) < 1e-9, "spin tuning should keep speed unchanged");
assert(Math.abs(moreSpin.params.spinRps - 22) < 1e-9, "spin tuning should change spin magnitude");
assert(moreSpin.landingErrorM < 0.01, `spin compensation landing error too large: ${moreSpin.landingErrorM}`);

const higher = A.applyShotTuning(base, { clearancePct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(higher.prediction.net.clearanceM > basePred.net.clearanceM, "clearance should increase");
assert(Math.abs(higher.prediction.net.clearanceM - basePred.net.clearanceM * 1.10) < 0.002, "clearance target should be closely matched");
assert(higher.landingErrorM < 0.01, `clearance compensation landing error too large: ${higher.landingErrorM}`);
assert(Math.abs(higher.params.spinRps / higher.params.speedMps - base.spinRps / base.speedMps) < 1e-8, "clearance solve should preserve spin/speed ratio");

const underspin = { ...base, spinRps: -20 };
const moreUnder = A.applyShotTuning(underspin, { spinPct: 300 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(moreUnder.params.spinRps < -20, "positive spin tuning should increase underspin magnitude too");
assert(Math.abs(moreUnder.params.spinRps + 80) < 1e-9, "+300% spin should permit four times the stored magnitude");

const noSpin = A.applyShotTuning({ ...base, spinRps: 0 }, { spinPct: 300 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert.strictEqual(noSpin.params.spinRps, 0, "no-spin shots must remain no-spin under spin tuning");

const nearNet = A.applyShotTuning(base, { clearancePct: -100 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15, minNetClearanceM: 0.002 });
assert(nearNet.targetClearanceM >= 0.00199 && nearNet.targetClearanceM <= 0.00201, "-100% clearance should target the near-net safety floor");
assert(nearNet.prediction.net.clearanceM >= -0.0005, "near-net tuning should not intentionally drive the ball through the net");

const plusFiftySpeed = A.applyShotTuning(base, { speedPct: 50 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(plusFiftySpeed.params.speedMps - 11.25) < 1e-9, "speed tuning should allow +50% where supported");

const everyBall = A.applyTuningToShotList([
  { id: "a", params: { ...base } },
  { id: "b", params: { ...base, speedMps: 6.0, spinRps: -10 } },
  { id: "c", params: { ...base, speedMps: 9.0, spinRps: 0 } },
], { speedPct: 4 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert.strictEqual(everyBall.length, 3, "all-shot tuning must preserve every ball in the traversal");
assert(everyBall.every(item => item.adjustment.changed), "all balls should receive active live tuning");
assert(Math.abs(everyBall[0].adjustment.params.speedMps - 7.8) < 1e-9, "first ball speed tuning missing");
assert(Math.abs(everyBall[1].adjustment.params.speedMps - 6.24) < 1e-9, "second ball speed tuning missing");
assert(Math.abs(everyBall[2].adjustment.params.speedMps - 9.36) < 1e-9, "third ball speed tuning missing");

console.log("Drill adjustments self-test PASS");
