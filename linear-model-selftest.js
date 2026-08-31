const assert = require('assert');
const path = require('path');
const RobotGeometry = require('./robot-geometry.js');
global.RobotGeometry = RobotGeometry;
const GuidedCalibration = require('./guided-calibration.js');
const LaunchModel = require('./launch-model.js');

function close(actual, expected, tol, label) {
  assert(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

// Mechanical chain.
const p5 = RobotGeometry.releasePoint({ elevationDeg: 5 });
const p45 = RobotGeometry.releasePoint({ elevationDeg: 45 });
close(p5.x, 0.39171460235688094, 1e-12, '5deg x');
close(p5.z, 0.24653668070607435, 1e-12, '5deg z');
close(p45.x, 0.3700330085889911, 1e-12, '45deg x');
close(p45.z, 0.29303300858899106, 1e-12, '45deg z');

// The launch model is one exact affine function and extrapolates with the same slope.
const M = LaunchModel.constants.DEFAULT_LINEAR_EXIT_MODEL;
for (const raw of [400, 2000, 2200, 3000, 5000, 7500]) {
  close(LaunchModel.exitSpeedFromRaw(raw, M), M.interceptMps + M.slopeMpsPerRaw * raw, 1e-12, `linear raw ${raw}`);
  close(LaunchModel.rawFromExitSpeed(LaunchModel.exitSpeedFromRaw(raw, M), M), raw, 1e-8, `inverse ${raw}`);
}
const d1 = LaunchModel.exitSpeedFromRaw(3100, M) - LaunchModel.exitSpeedFromRaw(3000, M);
const d2 = LaunchModel.exitSpeedFromRaw(2000, M) - LaunchModel.exitSpeedFromRaw(1900, M);
close(d1, d2, 1e-12, 'same extrapolation slope');
assert(!('LOCAL_EXIT_SPEED_MAP' in LaunchModel.constants), 'no operational speed map should remain');

const data = {
  2000: {5:134,15:168,25:210,35:220,45:225},
  2200: {5:160,15:203,25:245,35:258},
  2400: {15:221,25:269,35:285,45:285},
  2600: {5:186,15:245,25:300,35:319,45:320},
  2800: {5:198,15:260,25:326,35:347,45:347},
  3000: {15:282,25:350,35:375},
};
const shots = [];
for (const [raw, elevations] of Object.entries(data)) {
  for (const [elevation, distanceCm] of Object.entries(elevations)) {
    shots.push({ rawSpeed: Number(raw), elevationDeg: Number(elevation), distanceCm, saved: true });
  }
}
const fit = GuidedCalibration.calibrate(shots, {
  placement: 'ground', distanceReference: 'base_back', baseBackXFromNearEdgeM: 0,
  measurementOffsetM: 0, distanceNoisePerM: 0.015, madThreshold: 3.5, dt: 0.004,
});
assert(fit.speedModel && Number.isFinite(fit.speedModel.interceptMps));
assert(!('speedMap' in fit), 'calibration result must not contain speedMap');
assert.strictEqual(fit.distanceRejectedCount, 2);
assert.strictEqual(fit.distanceCount, 24);
const rejected = fit.residualRows.filter(r => r.included === false).map(r => `${r.rawSpeed}/${r.elevationDeg}`).sort();
assert.deepStrictEqual(rejected, ['2000/15','2000/5']);
assert(fit.distanceRmseM < 0.05, `RMSE ${fit.distanceRmseM}`);

const plan = GuidedCalibration.buildPlan({
  placement: 'ground', elevationMinDeg: 5, elevationMaxDeg: 45, elevationCount: 5,
  speedMinRaw: 2000, speedMaxRaw: 3000, speedCount: 6, speedModel: fit.speedModel,
});
for (let i = 1; i < plan.shots.length; i++) {
  const a = plan.shots[i-1].predictedDistanceM;
  const b = plan.shots[i].predictedDistanceM;
  if (Number.isFinite(a) && Number.isFinite(b)) assert(a <= b + 1e-12, 'plan must be distance-sorted');
}

console.log('PASS fully-linear calibration model');
console.log(JSON.stringify({speedModel: fit.speedModel, rmseCm: fit.distanceRmseM*100, rejected}, null, 2));
