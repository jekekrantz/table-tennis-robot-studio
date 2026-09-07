const assert = require("assert");
const Timing = require("./adaptive-timing.js");

const model = Timing.normalizePlayerModel(Timing.DEFAULT_PLAYER_MODEL);
assert.strictEqual(Timing.normalizePlayerModel({ id: "partial", name: "Partial" }).timingSpeedPct, 100, "partial saved models inherit balanced defaults");
assert.strictEqual(Timing.axisMovementTime(0, 7, 2.8), 0);
assert(Timing.axisMovementTime(.8, 7, 2.8) > Timing.axisMovementTime(.2, 7, 2.8));

const center = { x: 2.2, y: 0, z: .25, t: .62, speedMps: 7, spinRps: 20 };
const wide = { x: 2.3, y: .65, z: .22, t: .58, speedMps: 8, spinRps: 24 };
const same = Timing.delaySeconds({ contactA: center, contactB: center, table: { length: 2.74 }, playerModel: model });
const moved = Timing.delaySeconds({ contactA: center, contactB: wide, table: { length: 2.74 }, playerModel: model });
assert(moved > same, "wide recovery must take longer than a repeated center ball");

const fast = Timing.delaySeconds({ contactA: center, contactB: wide, table: { length: 2.74 }, playerModel: model, edgeSpeedPct: 130 });
assert(fast < moved, "higher timing speed must reduce the delay");

const serve = Timing.delaySeconds({ contactA: center, contactB: wide, targetType: "serve", table: { length: 2.74 }, playerModel: model });
assert(serve > moved, "a new serve must include preparation time");

console.log("Adaptive timing self-test PASS");
