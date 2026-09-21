const assert = require("assert");
const Geometry = require("./robot-geometry.js");

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

close(Geometry.constants.NOVA_LENGTH_M, .465);
close(Geometry.constants.NOVA_WIDTH_M, .176);
close(Geometry.constants.NOVA_HEIGHT_M, .325);

const level = Geometry.releasePoint({ elevationDeg: 0, aimDeg: 0 });
close(level.x, .392);
close(level.y, 0);
close(level.z, .240);

const pitched = Geometry.releasePoint({ elevationDeg: 0, aimDeg: 0, basePitchDeg: 10 });
assert.ok(pitched.z > level.z, "positive body pitch must raise the forward release geometry");
const pitchFrame = Geometry.launchFrame({ elevationDeg: 0, aimDeg: 0, basePitchDeg: 10 });
close(pitchFrame.forward.z, Math.sin(10 * Math.PI / 180));

const rolled = Geometry.launchFrame({ elevationDeg: 0, aimDeg: 0, baseRollDeg: 8 });
assert.ok(Math.abs(rolled.spinAxis.z) > .1, "body roll must rotate the spin axis out of the table plane");

const frame = Geometry.launchFrame({ elevationDeg: 17, aimDeg: -12, baseYawDeg: 23, basePitchDeg: 9, baseRollDeg: -4 });
close(Math.hypot(frame.forward.x, frame.forward.y, frame.forward.z), 1);
close(Math.hypot(frame.spinAxis.x, frame.spinAxis.y, frame.spinAxis.z), 1);
close(frame.forward.x * frame.spinAxis.x + frame.forward.y * frame.spinAxis.y + frame.forward.z * frame.spinAxis.z, 0);

console.log("Robot installation geometry self-test PASS");
