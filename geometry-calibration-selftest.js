const assert = require("assert");
const path = require("path");
const RobotGeometry = require("./robot-geometry.js");
global.RobotGeometry = RobotGeometry;
const GuidedCalibration = require("./guided-calibration.js");

function near(actual, expected, tol, label) {
  assert(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

const p5 = RobotGeometry.releasePoint({ elevationDeg: 5 });
const p45 = RobotGeometry.releasePoint({ elevationDeg: 45 });
near(p5.x, 0.39171460235688094, 1e-12, "5 deg release x");
near(p5.z, 0.24653668070607435, 1e-12, "5 deg release z");
near(p45.x, 0.3700330085889911, 1e-12, "45 deg release x");
near(p45.z, 0.29303300858899106, 1e-12, "45 deg release z");

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
const result = GuidedCalibration.calibrate(shots, {
  placement: "ground",
  distanceReference: "base_back",
  baseBackXFromNearEdgeM: 0,
  measurementOffsetM: 0,
  distanceNoisePerM: 0.015,
  madThreshold: 3.5,
  dt: 0.004,
});

near(result.speedModel.interceptMps, -0.2758895085, 2e-6, "speed intercept");
near(result.speedModel.slopeMpsPerRaw, 0.0023936604543, 2e-9, "speed slope");
near(result.distanceRmseM, 0.0443697168, 2e-7, "included distance RMSE");
near(result.distanceAllRmseM, 0.0590975732, 2e-7, "all distance RMSE");
assert.strictEqual(result.distanceCount, 24);
assert.strictEqual(result.distanceRejectedCount, 2);
const rejected = result.residualRows.filter(r => r.included === false).map(r => `${r.rawSpeed}/${r.elevationDeg}`).sort();
assert.deepStrictEqual(rejected, ["2000/15", "2000/5"]);

const plan = GuidedCalibration.buildPlan({
  placement: "ground",
  elevationMinDeg: 5,
  elevationMaxDeg: 45,
  elevationCount: 5,
  speedMinRaw: 2000,
  speedMaxRaw: 3000,
  speedCount: 6,
});
for (let i = 1; i < plan.shots.length; i += 1) {
  const a = plan.shots[i - 1].predictedDistanceM;
  const b = plan.shots[i].predictedDistanceM;
  if (Number.isFinite(a) && Number.isFinite(b)) assert(a <= b + 1e-12, "plan not sorted by predicted distance");
}

console.log("PASS geometry/calibration self-test");
console.log(JSON.stringify({
  speedModel: result.speedModel,
  included: result.distanceCount,
  rejected: result.distanceRejectedCount,
  includedRmseCm: result.distanceRmseM * 100,
  allRmseCm: result.distanceAllRmseM * 100,
  rejectedPoints: result.residualRows.filter(r => r.included === false).map(r => ({
    raw: r.rawSpeed,
    elevationDeg: r.elevationDeg,
    errorCm: r.distanceErrorM * 100,
    incidenceDeg: r.incidenceDeg,
    sigmaCm: r.measurementSigmaM * 100,
    standardizedResidual: r.standardizedResidual,
  })),
}, null, 2));
