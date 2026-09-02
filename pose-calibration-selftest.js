const assert = require("assert");
const { performance } = require("perf_hooks");
const Pose = require("./pose-calibration.js");

const table = { length: 2.74, width: 1.525, netHeight: .1525 };
const base = { x: 0, y: 0, yawDeg: 0 };
const uncertainty = { xCm: 5, yCm: 5, yawDeg: 3, landingCm: 5, measurementCm: 2 };
const covariance = Pose.covarianceFromUncertainty(uncertainty);

const candidates = Pose.targetCandidates(table, base, uncertainty);
assert(candidates.length > 100, "calibration placement must be selected from a dense table grid, not a fixed target list");
assert.strictEqual(new Set(candidates.map(target => target.id)).size, candidates.length);
assert(candidates.every(target => target.observationKind === "table"));
assert(candidates.every(target => target.x > table.length / 2 && Math.abs(target.y) < table.width / 2));
assert(new Set(candidates.map(target => target.watchGroup)).size >= 6, "candidate placements should cover distinct viewing areas");

const initialStatus = Pose.calibrationStatus(table, base, covariance, uncertainty);
assert(!initialStatus.converged);
assert(initialStatus.worstPoseLandingCm > initialStatus.acceptableLandingCm);
const defaultPlan = Pose.planCalibrationSequence(table, base, uncertainty, { covariance, maxShots: 7 });
assert(defaultPlan.sequence.length >= 1 && defaultPlan.sequence.length <= 7);
assert(defaultPlan.status.converged, "expected plan should reach a noise-relative landing-accuracy goal");
const independentTarget = Pose.proposeCalibrationTargets(table, base, uncertainty, {
  covariance: defaultPlan.sequence[0].expectedCovariance,
  recentTargets: [defaultPlan.sequence[0]],
  currentWatchGroup: defaultPlan.sequence[0].watchGroup,
  verification: true,
})[0];
assert(independentTarget.watchGroup !== defaultPlan.sequence[0].watchGroup);
assert(Math.hypot(independentTarget.x - defaultPlan.sequence[0].x, independentTarget.y - defaultPlan.sequence[0].y) >= .45);

const loose = { ...uncertainty, xCm: 15, yCm: 15, yawDeg: 8 };
const loosePlan = Pose.planCalibrationSequence(table, base, loose, { covariance: Pose.covarianceFromUncertainty(loose), maxShots: 7 });
assert(loosePlan.sequence.length >= 2, "a loose prior should require multiple measurements");
const zoneSwitches = loosePlan.sequence.slice(1).filter((target, index) => target.watchGroup !== loosePlan.sequence[index].watchGroup).length;
assert(zoneSwitches <= 2, "sequence planning should cluster useful placements to reduce walking");

const truePose = { x: .035, y: -.024, yawDeg: 1.7 };
let sequentialPose = { ...base };
let sequentialUncertainty = { ...loose, landingCm: 1, measurementCm: 1 };
let sequentialCovariance = Pose.covarianceFromUncertainty(sequentialUncertainty);
let currentWatchGroup = null;
const recentTargets = [];
for (let index = 0; index < 5; index += 1) {
  const target = Pose.proposeCalibrationTargets(table, sequentialPose, sequentialUncertainty, {
    covariance: sequentialCovariance, recentTargets, currentWatchGroup,
  })[0];
  const poseError = [truePose.x - sequentialPose.x, truePose.y - sequentialPose.y, (truePose.yawDeg - sequentialPose.yawDeg) * Math.PI / 180];
  const [xRow, yRow] = Pose.sensitivityRows(target, sequentialPose);
  const project = row => row.reduce((sum, value, component) => sum + value * poseError[component], 0);
  const update = Pose.estimatePoseObservation(sequentialPose, sequentialCovariance, {
    targetX: target.x, targetY: target.y,
    longitudinalErrorCm: project(xRow) * 100,
    lateralErrorCm: project(yRow) * 100,
    shotSigmaCm: 1,
    humanSigmaLongitudinalCm: 1,
    humanSigmaLateralCm: 1,
  }, sequentialUncertainty);
  assert(update.accepted);
  sequentialPose = update.correctedPose;
  sequentialUncertainty = update.uncertainty;
  sequentialCovariance = update.covariance;
  recentTargets.push(target);
  currentWatchGroup = target.watchGroup;
}
assert(Math.abs(sequentialPose.x - truePose.x) < .012);
assert(Math.abs(sequentialPose.y - truePose.y) < .015);
assert(Math.abs(sequentialPose.yawDeg - truePose.yawDeg) < .4);

const centreTarget = candidates.reduce((best, target) => Math.abs(target.y) < Math.abs(best.y) ? target : best, candidates[0]);
const anisotropic = Pose.estimatePoseObservation(base, covariance, {
  targetX: centreTarget.x, targetY: centreTarget.y,
  longitudinalErrorCm: 4, lateralErrorCm: 4,
  shotSigmaCm: 1,
  humanSigmaLongitudinalCm: 2,
  humanSigmaLateralCm: 30,
}, uncertainty);
assert(anisotropic.uncertainty.xCm < 3, "a precise endline-direction report should constrain forward/back pose");
assert(anisotropic.uncertainty.yCm > 4.8, "poor lateral reference must not pretend to constrain lateral pose");

const nearLeftEdge = Pose.feedbackMeasurementNoise(table, { x: 2.67, y: table.width / 2 - .005 }, { gridCm: 20, pointerSigmaCm: 2 });
assert(nearLeftEdge.lateralSigmaCm < nearLeftEdge.longitudinalSigmaCm, "sideline proximity should improve only the lateral measurement");
const outside = Pose.feedbackMeasurementNoise(table, { x: table.length + .04, y: table.width / 2 + .08 }, { gridCm: 20, pointerSigmaCm: 2 });
assert(outside.outsideLongitudinal && outside.outsideLateral);
assert(outside.longitudinalSigmaCm >= 5 && outside.lateralSigmaCm >= 5, "outside position is noisier even though the outside classification is certain");
const onLocalGrid = Pose.feedbackMeasurementNoise(table, { x: table.length/2 + .10, y: -.6625 }, {
  gridCm: 10, pointerSigmaCm: 2, longitudinalGridOriginM: table.length/2, lateralGridOriginM: -table.width/2,
});
const betweenLocalGrid = Pose.feedbackMeasurementNoise(table, { x: table.length/2 + .15, y: -.6125 }, {
  gridCm: 10, pointerSigmaCm: 2, longitudinalGridOriginM: table.length/2, lateralGridOriginM: -table.width/2,
});
assert(onLocalGrid.longitudinalSigmaCm < betweenLocalGrid.longitudinalSigmaCm && onLocalGrid.lateralSigmaCm < betweenLocalGrid.lateralSigmaCm,
  "measurement noise must follow the local ruler grid shown to the user");

const rightNetView = Pose.localMeasurementView(table, { x: 1.7, y: -.70 }, uncertainty, { pose: base, covariance });
assert.strictEqual(rightNetView.xReference.kind, "net");
assert.strictEqual(rightNetView.yReference.kind, "right-sideline");
assert(rightNetView.longitudinalLabel.includes("past net") && rightNetView.lateralLabel.includes("right sideline"));
assert(rightNetView.minX < 1.7 && rightNetView.maxX > 1.7 && rightNetView.minY < -.70 && rightNetView.maxY > -.70);
assert(rightNetView.minX < table.length/2 && rightNetView.maxX > table.length/2, "local view must contain its longitudinal reference");
assert(rightNetView.minY < -table.width/2 && rightNetView.maxY > -table.width/2, "local view must contain its lateral reference and some outside ground");
assert([2, 5, 10, 20, 50].includes(rightNetView.gridCm), "ruler interval must use a clean 1-2-5 centimetre/decimetre scale");
for (const [bound, reference] of [[rightNetView.minX, rightNetView.xReference.value], [rightNetView.maxX, rightNetView.xReference.value], [rightNetView.minY, rightNetView.yReference.value], [rightNetView.maxY, rightNetView.yReference.value]]) {
  const cells = Math.abs(bound - reference) * 100 / rightNetView.gridCm;
  assert(Math.abs(cells - Math.round(cells)) < 1e-8, "measurement window bounds must snap to the ruler grid");
}
const farCentreView = Pose.localMeasurementView(table, { x: 2.6, y: 0 }, uncertainty, { pose: base, covariance });
assert.strictEqual(farCentreView.xReference.kind, "far-endline");
assert.strictEqual(farCentreView.yReference.kind, "centre-line");
assert.strictEqual(farCentreView.lateralLabel, "on centre line");
const looseView = Pose.localMeasurementView(table, { x: 1.7, y: -.70 }, loose, { pose: base, covariance: Pose.covarianceFromUncertainty(loose) });
assert(looseView.maxX - looseView.minX >= rightNetView.maxX - rightNetView.minX);
assert(looseView.maxY - looseView.minY >= rightNetView.maxY - rightNetView.minY, "measurement window must expand with landing uncertainty");
const refined = { ...uncertainty, xCm: 1, yCm: 1, yawDeg: .5 };
const refinedView = Pose.localMeasurementView(table, { x: 1.47, y: -.71 }, refined, { pose: base, covariance: Pose.covarianceFromUncertainty(refined) });
assert.strictEqual(refinedView.gridCm, 5);

const shortNoise = Pose.modeledLandingNoiseCm({ x: 1.5, y: 0, incidenceDeg: 35 }, base, uncertainty);
const longNoise = Pose.modeledLandingNoiseCm({ x: 2.7, y: 0, incidenceDeg: 35 }, base, uncertainty);
const shallowNoise = Pose.modeledLandingNoiseCm({ x: 2.7, y: 0, incidenceDeg: 12 }, base, uncertainty);
assert(longNoise >= shortNoise, "longer flights must not receive less landing noise");
assert(shallowNoise > longNoise, "shallow incidence should increase landing uncertainty as in guided shot calibration");
const expectedLandingCovariance = Pose.expectedLandingCovariance({ x: 1.7, y: -.7, incidenceDeg: 30 }, base, covariance, uncertainty);
assert(expectedLandingCovariance[0][0] > .0025 && expectedLandingCovariance[1][1] > .0025,
  "expected landing region must combine the 5 cm shot-noise floor with pose uncertainty");
assert.strictEqual(expectedLandingCovariance[0][1], expectedLandingCovariance[1][0]);
assert(expectedLandingCovariance[0][0]*expectedLandingCovariance[1][1] - expectedLandingCovariance[0][1]**2 > 0,
  "expected landing covariance must remain positive definite");

const outlier = Pose.estimatePoseObservation(base, covariance, {
  targetX: centreTarget.x, targetY: centreTarget.y,
  longitudinalErrorCm: 100,
  shotSigmaCm: 3,
  humanSigmaLongitudinalCm: 2,
}, uncertainty);
assert(outlier.accepted && outlier.downweighted, "grossly inconsistent feedback should be robustly downweighted");
const unseen = Pose.estimatePoseObservation(base, covariance, {
  targetX: centreTarget.x, targetY: centreTarget.y,
  longitudinalErrorCm: null, lateralErrorCm: null,
}, uncertainty);
assert(!unseen.accepted && unseen.reason === "no-measurement");

const profileIterations = 200;
const profileStarted = performance.now();
for (let index = 0; index < profileIterations; index += 1) {
  Pose.planCalibrationSequence(table, base, uncertainty, { covariance, maxShots: 4 });
}
const profileElapsedMs = performance.now() - profileStarted;
assert(profileElapsedMs < 2000, `adaptive sequence planner unexpectedly slow: ${profileElapsedMs.toFixed(1)} ms`);

const now = Date.UTC(2026, 8, 1);
assert(Pose.isStale({ verifiedAt: "2026-08-01T00:00:00.000Z" }, now));
assert(!Pose.isStale({ verifiedAt: "2026-08-25T00:00:00.000Z" }, now));
assert(!Pose.isStale({ verifiedAt: "2026-07-01T00:00:00.000Z", lastRobotUseAt: "2026-08-31T00:00:00.000Z" }, now));

console.log(`Pose calibration self-test PASS · ${(profileElapsedMs / profileIterations).toFixed(2)} ms planned sequence`);
