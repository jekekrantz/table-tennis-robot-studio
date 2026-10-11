const assert = require("assert");
const Analysis = require("./developer-shot-analysis.js");

assert.deepStrictEqual(Analysis.sanitizeSettings({}), {
  enabled: false,
  retainLogs: false,
  retainVideo: false,
  retainImages: false,
  captureAudio: true,
  cameraSide: "left",
  cameraDistanceCm: 50,
  cameraHeightAboveNetCm: 30,
  cameraPitchDeg: 2,
  datasetRepetitions: 10,
  datasetIntervalSeconds: 1.25,
  calibration: null,
});

const landmarks = [
  { x: .15, y: .85 },
  { x: .85, y: .85 },
  { x: .68, y: .18 },
  { x: .32, y: .18 },
];
const table = { length: 2.74, width: 1.525 };
const homography = Analysis.tableHomography(landmarks, table);
const expected = [
  { x: 0, y: table.width / 2 },
  { x: 0, y: -table.width / 2 },
  { x: table.length, y: -table.width / 2 },
  { x: table.length, y: table.width / 2 },
];
landmarks.forEach((point, index) => {
  const projected = Analysis.projectToTable(homography, point);
  assert(Math.abs(projected.x - expected[index].x) < 1e-8);
  assert(Math.abs(projected.y - expected[index].y) < 1e-8);
});
const rightHomography = Analysis.tableHomography(landmarks, table, "right");
assert(Math.abs(Analysis.projectToTable(rightHomography, landmarks[0]).y + table.width / 2) < 1e-8);

const calibration = Analysis.normalizeCalibration({ landmarks, homography, camera: { width: 1920 }, updatedAt: "2026-10-09T00:00:00Z" });
assert.strictEqual(calibration.landmarks.length, 4);
assert.strictEqual(calibration.camera.width, 1920);
assert.strictEqual(Analysis.normalizeCalibration({ landmarks: landmarks.slice(0, 3) }), null);

const fakeRecorder = { isTypeSupported: type => type.includes("vp8") };
assert.strictEqual(Analysis.preferredRecorderMimeType(fakeRecorder), "video/webm;codecs=vp8,opus");

const mainFov = Analysis.cameraHorizontalFovDeg({ physicalSizeMm:{ width:5.6 }, focalLengthsMm:[4.6] });
const ultraWideFov = Analysis.cameraHorizontalFovDeg({ physicalSizeMm:{ width:5.6 }, focalLengthsMm:[1.8] });
assert(mainFov > 60 && mainFov < 80);
assert(ultraWideFov > mainFov && ultraWideFov < 130);
assert(Analysis.cameraHorizontalFovDeg({ physicalSizeMm:{ width:5.6 }, focalLengthsMm:[1.8,4.6], activeFocalLengthMm:4.6 }) < 80);
assert.strictEqual(Analysis.cameraHorizontalFovDeg({}, 81), 81);
assert.strictEqual(Analysis.calibrationMatchesCamera({ camera:{ cameraId:"0" } }, "0"), true);
assert.strictEqual(Analysis.calibrationMatchesCamera({ camera:{ cameraId:"0" } }, "2"), false);
assert.strictEqual(Analysis.calibrationMatchesCamera({ camera:{} }, "2"), true);

const schedule = Analysis.balancedDatasetSchedule(["a", "b", "c"], 3);
assert.strictEqual(schedule.length, 9);
assert.deepStrictEqual(schedule.map(item => item.conditionId), ["a", "b", "c", "b", "c", "a", "c", "a", "b"]);
assert.deepStrictEqual(schedule.filter(item => item.conditionId === "a").map(item => item.position), [1, 3, 2]);

console.log("developer shot analysis self-test: PASS");
