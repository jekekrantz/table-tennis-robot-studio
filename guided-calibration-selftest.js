const assert = require('assert');
const RobotGeometry = require('./robot-geometry.js');
global.RobotGeometry = RobotGeometry;
const GuidedCalibration = require('./guided-calibration.js');

function close(actual, expected, tol, label) {
  assert(Number.isFinite(actual), `${label}: actual is not finite`);
  assert(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

// Fixed geometry: both elevation and aim change the release point after the pivots.
const p5 = RobotGeometry.releasePoint({ elevationDeg: 5, aimDeg: 0 });
const p45 = RobotGeometry.releasePoint({ elevationDeg: 45, aimDeg: 0 });
close(p5.x, 0.39171460235688094, 1e-12, '5 degree release x');
close(p5.z, 0.24653668070607435, 1e-12, '5 degree release z');
close(p45.x, 0.3700330085889911, 1e-12, '45 degree release x');
close(p45.z, 0.29303300858899106, 1e-12, '45 degree release z');
const aimed = RobotGeometry.releasePoint({ elevationDeg: 25, aimDeg: 30 });
assert(Math.abs(aimed.y) > 0.05, 'aim/yaw must move physical release y');

// Relative uncertainty: longer shots and shallower ground incidence get larger sigma.
const sigmaShort = GuidedCalibration.measurementSigmaM(1.5, 45, { distanceNoisePerM: 0.015 });
const sigmaLong = GuidedCalibration.measurementSigmaM(3.0, 45, { distanceNoisePerM: 0.015 });
const sigmaShallow = GuidedCalibration.measurementSigmaM(1.5, 10, { distanceNoisePerM: 0.015 });
assert(sigmaLong > sigmaShort, 'longer distance must be noisier');
assert(sigmaShallow > sigmaShort, 'shallower incidence must be noisier');

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
  placement: 'ground',
  distanceReference: 'base_back',
  baseBackXFromNearEdgeM: 0,
  measurementOffsetM: 0,
  distanceNoisePerM: 0.015,
  madThreshold: 3.5,
  dt: 0.004,
});

// Exactly two fitted speed parameters drive every raw setting.
assert.strictEqual(result.modelKind, 'affine-raw-speed-v1');
assert(result.speedModel);
assert(Number.isFinite(result.speedModel.interceptMps));
assert(Number.isFinite(result.speedModel.slopeMpsPerRaw));
assert(!('speedMap' in result), 'fit result must not persist speed knots');
close(result.speedModel.interceptMps, -0.27588934442191615, 3e-6, 'intercept');
close(result.speedModel.slopeMpsPerRaw, 0.002393660386425955, 3e-9, 'slope');
assert.strictEqual(result.distanceCount, 24);
assert.strictEqual(result.distanceRejectedCount, 2);
assert(result.distanceRmseM < 0.05, `included RMSE too high: ${result.distanceRmseM}`);
const rejected = result.residualRows.filter(r => r.included === false).map(r => `${r.rawSpeed}/${r.elevationDeg}`).sort();
assert.deepStrictEqual(rejected, ['2000/15', '2000/5']);
assert(!('displaySpeedSamples' in result), 'fit result should persist coefficients/residuals, not derived speed samples');

// Plan order should minimize walking, using predictions from the same affine line.
const plan = GuidedCalibration.buildPlan({
  placement: 'ground',
  distanceReference: 'base_back',
  speedModel: result.speedModel,
  elevationMinDeg: 5,
  elevationMaxDeg: 45,
  elevationCount: 5,
  speedMinRaw: 2000,
  speedMaxRaw: 3000,
  speedCount: 6,
});
for (let i = 1; i < plan.shots.length; i += 1) {
  const prev = plan.shots[i - 1].predictedDistanceM;
  const cur = plan.shots[i].predictedDistanceM;
  if (Number.isFinite(prev) && Number.isFinite(cur)) assert(prev <= cur + 1e-12, 'calibration plan must be sorted by predicted distance');
}

// Offset convention: corrected = entered + offset. Generate synthetic data from a known
// line, shift every entered value +10 cm, then recover it with a -10 cm offset.
const known = { interceptMps: -0.25, slopeMpsPerRaw: 0.0024, calibratedRawMin: 2000, calibratedRawMax: 2800 };
const synthetic = [];
for (const raw of [2000, 2400, 2800]) {
  for (const elevationDeg of [15, 25, 35]) {
    const speedMps = GuidedCalibration.speedMpsFromRaw(raw, known);
    const sim = GuidedCalibration.simulateShot({ placement: 'ground', speedMps, elevationDeg });
    const distanceM = GuidedCalibration.landingDistanceFromReference(sim, { placement: 'ground', distanceReference: 'base_back' });
    synthetic.push({ rawSpeed: raw, elevationDeg, distanceCm: distanceM * 100 + 10 });
  }
}
const offsetFit = GuidedCalibration.calibrate(synthetic, {
  placement: 'ground', distanceReference: 'base_back', measurementOffsetM: -0.10,
  distanceNoisePerM: 0.015, madThreshold: 3.5, dt: 0.004, speedModel: known,
});
close(offsetFit.speedModel.interceptMps, known.interceptMps, 5e-4, 'measurement offset intercept recovery');
close(offsetFit.speedModel.slopeMpsPerRaw, known.slopeMpsPerRaw, 5e-7, 'measurement offset slope recovery');

const source = require('fs').readFileSync(require('path').join(__dirname, 'guided-calibration.js'), 'utf8');
for (const forbidden of ['USER_SEED_SPEED_MAP', 'speedFromMap(', 'result.speedMap', 'profileSpeedForRaw']) {
  assert(!source.includes(forbidden), `forbidden piecewise/per-raw speed fitting remains: ${forbidden}`);
}

console.log('PASS guided calibration: fixed geometry + weighted MAD + global affine speed fit');
console.log(JSON.stringify({ speedModel: result.speedModel, rmseCm: result.distanceRmseM * 100, rejected }, null, 2));
