const assert = require('assert');
const LaunchModel = require('./launch-model.js');

function close(actual, expected, tol, label) {
  assert(Number.isFinite(actual), `${label}: actual is not finite`);
  assert(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

const model = LaunchModel.constants.DEFAULT_LINEAR_EXIT_MODEL;

// Raw -> speed is exactly one affine equation over the entire hardware domain
// and beyond the calibrated range. The calibrated range is metadata only.
for (const raw of [0, 400, 1500, 2000, 2200, 3000, 3500, 5000, 7500, 8000]) {
  const expected = model.interceptMps + model.slopeMpsPerRaw * raw;
  close(LaunchModel.exitSpeedFromRaw(raw, model), expected, 1e-12, `affine raw=${raw}`);
  close(LaunchModel.rawFromExitSpeed(expected, model), raw, 1e-8, `inverse raw=${raw}`);
}
close(
  LaunchModel.exitSpeedFromRaw(3100, model) - LaunchModel.exitSpeedFromRaw(3000, model),
  LaunchModel.exitSpeedFromRaw(2000, model) - LaunchModel.exitSpeedFromRaw(1900, model),
  1e-12,
  'same slope on both sides of calibrated range'
);
assert.strictEqual(LaunchModel.isRawCalibrated(1999, model), false);
assert.strictEqual(LaunchModel.isRawCalibrated(2000, model), true);
assert.strictEqual(LaunchModel.isRawCalibrated(3000, model), true);
assert.strictEqual(LaunchModel.isRawCalibrated(3001, model), false);
assert.strictEqual(LaunchModel.clampRawToHardware(50), 100);
assert.strictEqual(LaunchModel.clampRawToHardware(200), 200);
assert.strictEqual(LaunchModel.clampRawToHardware(9000), 7500);

// Nova speed-level scaling is a separate coordinate transform and must honor app settings.
const scaling = {
  rawAtZeroSpeedLevel: 1000,
  rawPerSpeedLevel: 500,
  rawDeltaPerSpinLevel: 250,
};
for (const level of [-1, 0, 1.5, 4, 9.25]) {
  const raw = LaunchModel.rawFromLevel(level, scaling);
  close(raw, 1000 + 500 * level, 1e-12, `rawFromLevel ${level}`);
  close(LaunchModel.levelFromRaw(raw, scaling), level, 1e-12, `levelFromRaw ${level}`);
}
const level = 4;
const spinSetting = 2;
const baseRaw = LaunchModel.rawFromLevel(level, scaling);
const wheelA = baseRaw + scaling.rawDeltaPerSpinLevel * spinSetting;
const wheelB = baseRaw - scaling.rawDeltaPerSpinLevel * spinSetting;
close(
  LaunchModel.spinRpsFromRawWheels(wheelA, wheelB, scaling),
  LaunchModel.spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity: false }),
  1e-12,
  'custom spin raw scaling'
);

// The Spinsight curve stores spin capacity only; it contains no competing speed model,
// and an app-edited curve is honored by the motor estimate.
assert(LaunchModel.constants.SPINSIGHT_MEASURED_CURVE.every(point => !("speedKmh" in point)));
const editedCurve = LaunchModel.constants.SPINSIGHT_MEASURED_CURVE.map(point => ({ ...point }));
const edited4 = editedCurve.find(point => point.level === 4);
edited4.maxSpinRps = 80;
const scalingWithCurve = { ...scaling, spinsightCurve: editedCurve };
close(
  LaunchModel.spinRpsFromRawWheels(wheelA, wheelB, scalingWithCurve),
  LaunchModel.spinRpsFromSpinSetting(level, spinSetting, { clampToMeasuredCapacity: false, curve: editedCurve }),
  1e-12,
  'edited spin-capacity curve is operational'
);
assert(LaunchModel.spinRpsFromRawWheels(wheelA, wheelB, scalingWithCurve) !== LaunchModel.spinRpsFromRawWheels(wheelA, wheelB, scaling), 'editing spin-capacity curve must change the spin model');

const source = require('fs').readFileSync(require('path').join(__dirname, 'launch-model.js'), 'utf8');
for (const forbidden of ['LOCAL_EXIT_SPEED_MAP', 'USER_SEED_SPEED_MAP', 'speedFromMap(', 'interpolateExitSpeed']) {
  assert(!source.includes(forbidden), `forbidden map-based motor model token remains: ${forbidden}`);
}

console.log('PASS launch-model: one global affine raw->speed law');
