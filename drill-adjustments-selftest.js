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
assert.deepStrictEqual(A.normalizeTuning({ speedPct: 7, pacePct: -53 }), { pacePct: -50, clearancePct: 0, spinPct: 0, speedPct: 7 });
assert.deepStrictEqual(
  A.normalizeTuning({ pacePct: 999, clearancePct: -999, spinPct: 999, speedPct: -999 }),
  { pacePct: 100, clearancePct: -100, spinPct: 300, speedPct: -50 },
  "each tuning parameter should use its own range"
);

const faster = A.applyShotTuning(base, { speedPct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(faster.params.speedMps - 8.25) < 0.01, "speed tuning should closely keep the requested speed");
assert(Math.abs(faster.params.spinRps - 20) < 0.01, "speed tuning should closely keep spin unchanged");
assert(faster.landingErrorM < 0.01, `speed compensation landing error too large: ${faster.landingErrorM}`);

const moreSpin = A.applyShotTuning(base, { spinPct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(moreSpin.params.speedMps - 7.5) < 0.01, "spin tuning should closely keep speed unchanged");
assert(Math.abs(moreSpin.params.spinRps - 22) < 0.01, "spin tuning should change spin magnitude");
assert(moreSpin.landingErrorM < 0.01, `spin compensation landing error too large: ${moreSpin.landingErrorM}`);

const higher = A.applyShotTuning(base, { clearancePct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(higher.prediction.net.clearanceM > basePred.net.clearanceM, "clearance should increase");
assert(Math.abs(higher.prediction.net.clearanceM - basePred.net.clearanceM * 1.10) < 0.002, "clearance target should be closely matched");
assert(higher.landingErrorM < 0.01, `clearance compensation landing error too large: ${higher.landingErrorM}`);
assert(higher.evaluations <= 24, "clearance solve should respect the phone-sized evaluation budget");

const combined = A.applyShotTuning(base, { speedPct: 10, spinPct: 10, clearancePct: 10 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(combined.changed && combined.feasible, "combined tuning should produce one feasible adjusted trajectory");
assert(combined.params.speedMps > base.speedMps && combined.params.spinRps > base.spinRps, "combined tuning should move speed and spin in the requested directions");
assert(combined.prediction.net.clearanceM > basePred.net.clearanceM, "combined tuning should move clearance in the requested direction");
assert(combined.landingErrorM < .10, `combined tuning landing error too large: ${combined.landingErrorM}`);
assert(combined.evaluations <= 24, "combined tuning should respect the phone-sized evaluation budget");

const underspin = { ...base, spinRps: -20 };
const moreUnder = A.applyShotTuning(underspin, { spinPct: 300 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(moreUnder.params.spinRps < -20, "positive spin tuning should increase underspin magnitude too");
assert(Math.abs(moreUnder.params.spinRps + 80) < 0.01, "+300% spin should permit four times the stored magnitude");

const noSpin = A.applyShotTuning({ ...base, spinRps: 0 }, { spinPct: 300 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert.strictEqual(noSpin.params.spinRps, 0, "no-spin shots must remain no-spin under spin tuning");

const nearNet = A.applyShotTuning(base, { clearancePct: -100 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15, minNetClearanceM: 0.002 });
assert(nearNet.targetClearanceM >= 0.00199 && nearNet.targetClearanceM <= 0.00201, "-100% clearance should target the near-net safety floor");
assert(nearNet.prediction.net.clearanceM >= -0.0005, "near-net tuning should not intentionally drive the ball through the net");

const plusFiftySpeed = A.applyShotTuning(base, { speedPct: 50 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert(Math.abs(plusFiftySpeed.params.speedMps - 11.25) < 0.05, "speed tuning should still seek the requested +50% speed");
assert.strictEqual(plusFiftySpeed.feasible, false, "an impossible speed/landing combination should be reported, not silently accepted");

const everyBall = A.applyTuningToShotList([
  { id: "a", params: { ...base } },
  { id: "b", params: { ...base, speedMps: 6.0, spinRps: -10 } },
  { id: "c", params: { ...base, speedMps: 9.0, spinRps: 0 } },
], { speedPct: 4 }, toyPredict, { minSpeedMps: 3, maxSpeedMps: 15 });
assert.strictEqual(everyBall.length, 3, "all-shot tuning must preserve every ball in the traversal");
assert(everyBall.every(item => item.adjustment.changed), "all balls should receive active live tuning");
assert(Math.abs(everyBall[0].adjustment.params.speedMps - 7.8) < 0.01, "first ball speed tuning missing");
assert(Math.abs(everyBall[1].adjustment.params.speedMps - 6.24) < 0.01, "second ball speed tuning missing");
assert(Math.abs(everyBall[2].adjustment.params.speedMps - 9.36) < 0.01, "third ball speed tuning missing");
assert(everyBall.every(item => item.adjustment.evaluations <= 24), "each ball must stay within the evaluation budget");

// A current physical robot pose can differ from the drill's authored pose. The
// same solve should compensate that SE(2) shift and live tuning together.
function posePredict(pose) {
  return params => {
    const local = toyPredict(params);
    const angle = pose.yawDeg * Math.PI / 180;
    const x = local.landing.x * Math.cos(angle) - local.landing.y * Math.sin(angle) + pose.x;
    const y = local.landing.x * Math.sin(angle) + local.landing.y * Math.cos(angle) + pose.y;
    return { ...local, landing: { x, y } };
  };
}
const authoredPredict = posePredict({ x: 0, y: 0, yawDeg: 0 });
const movedPredict = posePredict({ x: .04, y: -.03, yawDeg: 1 });
const poseCompensated = A.applyShotTuning(base, { speedPct: 4, spinPct: 5, clearancePct: 5 }, movedPredict, {
  minSpeedMps: 3, maxSpeedMps: 15, basePrediction: authoredPredict(base), forceSolve: true, preserveClearance: true,
});
assert(poseCompensated.feasible, "combined pose and live adjustment solve should be feasible for a small move");
assert(poseCompensated.evaluations <= 24, "pose compensation must use the same bounded evaluation budget");
assert(poseCompensated.landingErrorM < .12, "pose compensation should preserve the authored landing within its feasibility tolerance");

console.log("Drill adjustments self-test PASS");
