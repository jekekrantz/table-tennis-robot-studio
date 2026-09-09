const assert = require("assert");
const Timing = require("./adaptive-timing.js");

const model = Timing.normalizePlayerModel(Timing.DEFAULT_PLAYER_MODEL);
assert.strictEqual(Timing.normalizePlayerModel({ id: "partial", name: "Partial" }).timingSpeedPct, 100, "partial saved models inherit balanced defaults");
const migrated = Timing.normalizePlayerModel({ id: "player-balanced", name: "Balanced player", ...{
  baseStrokeRecoverySeconds:.30, minimumContactGapSeconds:.50, lateralAccelerationMps2:7, lateralMaxSpeedMps:2.8,
  depthAccelerationMps2:5, depthMaxSpeedMps:2, returnTurnaroundSeconds:.08, returnSpeedRatio:.75,
  minimumReturnSpeedMps:4, maximumReturnSpeedMps:10, servePreparationSeconds:.65,
} });
assert.strictEqual(migrated.modelVersion, 2, "legacy Balanced model migrates to the current tuning");
assert.strictEqual(migrated.servePreparationSeconds, .9, "legacy Balanced model receives the safer serve reset");
assert.strictEqual(Timing.normalizePlayerModel({ id: "custom", servePreparationSeconds: .65 }).servePreparationSeconds, .65, "custom player models retain authored values");
assert.strictEqual(Timing.axisMovementTime(0, 7, 2.8), 0);
assert(Timing.axisMovementTime(.8, 7, 2.8) > Timing.axisMovementTime(.2, 7, 2.8));

const center = { x: 2.2, y: 0, z: .25, t: .62, speedMps: 7, spinRps: 20 };
const wide = { x: 2.3, y: .65, z: .22, t: .58, speedMps: 8, spinRps: 24 };
const same = Timing.delaySeconds({ contactA: center, contactB: center, table: { length: 2.74 }, playerModel: model });
const moved = Timing.delaySeconds({ contactA: center, contactB: wide, table: { length: 2.74 }, playerModel: model });
assert(moved > same, "wide recovery must take longer than a repeated center ball");
assert(same > .85 && same < .98, "Balanced repeated-ball cadence should stay near ordinary club-practice speed");

const fast = Timing.delaySeconds({ contactA: center, contactB: wide, table: { length: 2.74 }, playerModel: model, edgeSpeedPct: 130 });
assert(fast < moved, "higher timing speed must reduce the delay");

const serve = Timing.delaySeconds({ contactA: center, contactB: wide, targetType: "serve", table: { length: 2.74 }, playerModel: model });
assert(serve > moved, "a new serve must include preparation time");

const backspin = { ...wide, spinRps: -24 };
const spinSwitch = Timing.delaySeconds({ contactA: center, contactB: backspin, table: { length: 2.74 }, playerModel: model });
const noSpinSwitch = Timing.delaySeconds({ contactA: { ...center, spinRps: -24 }, contactB: backspin, table: { length: 2.74 }, playerModel: model });
assert(spinSwitch > noSpinSwitch, "a large spin reversal must include recognition time");
assert(spinSwitch - noSpinSwitch >= .1, "a large spin reversal needs a perceptible recognition allowance");

console.log("Adaptive timing self-test PASS");
