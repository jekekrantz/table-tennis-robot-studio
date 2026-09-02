const assert = require("assert");
const Pose = require("./pose-calibration.js");

const table = { length: 2.74, width: 1.525, netHeight: .1525 };
const base = { x: 0, y: 0, yawDeg: 0 };
const uncertainty = { xCm: 8, yCm: 7, yawDeg: 5, landingCm: 5, measurementCm: 2 };
const targets = Pose.proposeVerificationTargets(table, base, uncertainty);
assert.strictEqual(targets.length, 4);
assert(targets.every(target => target.x > table.length / 2 && Math.abs(target.y) < table.width / 2));
assert(targets.some(target => target.reference.includes("net")));
assert(targets.every(target => target.repeatCount >= 1 && target.repeatCount <= 4));

const actualDelta = { x: .035, y: -.024, yawRad: 1.7 * Math.PI / 180 };
const observations = targets.map(target => {
  const [xRow, yRow] = Pose.sensitivityRows(target, base);
  const vector = [actualDelta.x, actualDelta.y, actualDelta.yawRad];
  const project = row => row.reduce((sum, value, index) => sum + value * vector[index], 0);
  return {
    targetX: target.x,
    targetY: target.y,
    longitudinalErrorCm: project(xRow) * 100,
    lateralErrorCm: project(yRow) * 100,
    repeatCount: target.repeatCount,
  };
});
const estimate = Pose.estimatePoseCorrection(base, uncertainty, observations);
assert(estimate);
assert(Math.abs(estimate.delta.xCm - actualDelta.x * 100) < 1.2);
assert(estimate.delta.yCm < 0 && Math.abs(estimate.delta.yCm - actualDelta.y * 100) < 2.2);
assert(Math.abs(estimate.delta.yawDeg - actualDelta.yawRad * 180 / Math.PI) < .7);
assert(estimate.uncertainty.xCm < uncertainty.xCm);
assert(estimate.uncertainty.yawDeg < uncertainty.yawDeg);

let sequentialPose = { ...base };
let sequentialUncertainty = { ...uncertainty };
for (const observation of observations) {
  const previous = sequentialUncertainty;
  const update = Pose.estimatePoseCorrection(sequentialPose, sequentialUncertainty, [observation]);
  assert(update, "each landing-feedback update should be solvable");
  assert(update.uncertainty.xCm <= previous.xCm);
  assert(update.uncertainty.yCm <= previous.yCm);
  assert(update.uncertainty.yawDeg <= previous.yawDeg);
  sequentialPose = update.correctedPose;
  sequentialUncertainty = update.uncertainty;
}
assert(sequentialUncertainty.xCm < uncertainty.xCm);
assert(sequentialUncertainty.yawDeg < uncertainty.yawDeg);

const now = Date.UTC(2026, 8, 1);
assert(Pose.isStale({ verifiedAt: "2026-08-01T00:00:00.000Z" }, now));
assert(!Pose.isStale({ verifiedAt: "2026-08-25T00:00:00.000Z" }, now));
assert(!Pose.isStale({ verifiedAt: "2026-07-01T00:00:00.000Z", lastRobotUseAt: "2026-08-31T00:00:00.000Z" }, now), "recent robot use should prevent an inactivity reminder");

console.log("Pose calibration self-test PASS");
