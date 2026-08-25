#!/usr/bin/env node
"use strict";
const assert = require("assert");
const M = require("./launch-model.js");

function close(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} (tol ${tolerance})`);
}

(function run() {
  const correction = M.constants.EXIT_CORRECTION;
  assert(correction.slope > 0.6 && correction.slope < 0.9);
  assert(correction.interceptMps > 1.5 && correction.interceptMps < 2.5);

  const linear = M.constants.DEFAULT_LINEAR_EXIT_MODEL;
  close(linear.slopeMpsPerRaw, 0.0013339412562561616, 1e-12, "default linear slope");
  close(linear.interceptMps, 2.4319583819816337, 1e-12, "default linear intercept");
  close(linear.rmseMps, 0.16058948863017197, 1e-12, "default linear RMSE");
  assert.equal(linear.pointCount, 21);

  // The command/speed relation must now be one straight line, not a pointwise
  // interpolation through the noisy/quantized source table.
  for (const raw of [2000, 2500, 3807, 4437, 6000, 7000]) {
    const expected = linear.interceptMps + linear.slopeMpsPerRaw * raw;
    close(M.exitSpeedFromRaw(raw), expected, 1e-10, `linear exit speed at ${raw}`);
    close(M.rawFromExitSpeed(expected), raw, 1e-7, `linear inverse at ${raw}`);
  }

  // Local points are observations used in the fit, not exact interpolation knots.
  for (const point of M.constants.LOCAL_EXIT_SPEED_MAP) {
    assert(Math.abs(M.exitSpeedFromRaw(point.raw) - point.speedMps) < 0.20, `local point residual too large at ${point.raw}`);
  }

  const range = M.exitSpeedRange();
  assert(range.minMps > 4.8 && range.minMps < 5.1);
  assert(range.maxMps > 12.0 && range.maxMps < 12.3);

  // A custom local calibration still contributes to the joint straight-line
  // fit while the corrected Spinsight data provide the wider-range prior.
  const shifted = M.constants.LOCAL_EXIT_SPEED_MAP.map(point => ({ raw: point.raw, speedMps: point.speedMps + 0.25 }));
  const shiftedModel = M.fitLinearExitModel(shifted);
  assert(shiftedModel.interceptMps > linear.interceptMps, "custom local calibration should move the exit-speed model");
  const shiftedRaw = 2167;
  close(
    M.exitSpeedFromRaw(shiftedRaw, shifted),
    shiftedModel.interceptMps + shiftedModel.slopeMpsPerRaw * shiftedRaw,
    1e-10,
    "custom linear model is used directly"
  );

  const cap45 = M.spinCapacityAtLevel(4.5);
  close(cap45.maxSpinSetting, 10, 1e-9, "level 4.5 max spin setting");
  close(cap45.maxSpinRps, 66, 1e-9, "level 4.5 max spin rps");
  close(M.spinRpsFromSpinSetting(4.5, 5), 33, 1e-9, "half spin at 4.5");
  close(Math.abs(M.spinRpsFromRawWheels(7500, 500)), 67, 2.0, "7500/500 Spinsight cross-check");
  close(Math.abs(M.spinSettingFromRps(2.0, 100)), 6, 1e-9, "spin capacity clamp");

  console.log("launch-model self-test: PASS");
  console.log(`  in-flight -> exit correction: v_exit = ${correction.slope.toFixed(4)} * v_Spinsight + ${correction.interceptMps.toFixed(4)} m/s`);
  console.log(`  linear raw -> exit: v_exit = ${linear.interceptMps.toFixed(4)} + ${linear.slopeMpsPerRaw.toFixed(7)} * raw`);
  console.log(`  linear-fit RMSE over combined source points: ${linear.rmseMps.toFixed(4)} m/s`);
  console.log(`  supported exit-speed range: ${range.minMps.toFixed(2)} .. ${range.maxMps.toFixed(2)} m/s`);
})();
