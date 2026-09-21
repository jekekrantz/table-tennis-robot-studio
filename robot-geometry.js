(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RobotGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // User-measured geometry. These are fixed physical constants, not fit parameters.
  const GEOMETRY_REFERENCE = "base-back-pivots-v1";
  const BASE_BACK_TO_YAW_PIVOT_M = 0.242;
  const YAW_TO_PITCH_PIVOT_M = 0.075;
  const PITCH_PIVOT_TO_WHEELS_M = 0.075;
  const YAW_PIVOT_HEIGHT_M = 0.240;

  // Published Nova S Pro physical envelope. The manufacturer diagram gives
  // 465 mm overall length, 176 mm width and 325 mm standing height.
  const NOVA_LENGTH_M = 0.465;
  const NOVA_WIDTH_M = 0.176;
  const NOVA_HEIGHT_M = 0.325;

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function radians(deg) {
    return finite(deg, 0) * Math.PI / 180;
  }

  function rotateX(vector, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: vector.x, y: vector.y * c - vector.z * s, z: vector.y * s + vector.z * c };
  }

  // Positive installation pitch raises the robot's forward (+x) axis. Rotation
  // order is intrinsic roll, pitch, yaw: Rz(yaw) * Ry(-pitch) * Rx(roll).
  function installationVector(vector, options = {}) {
    const roll = rotateX(vector, radians(options.baseRollDeg));
    const pitchAngle = -radians(options.basePitchDeg);
    const cp = Math.cos(pitchAngle), sp = Math.sin(pitchAngle);
    const pitch = { x: roll.x * cp + roll.z * sp, y: roll.y, z: -roll.x * sp + roll.z * cp };
    const yaw = radians(options.baseYawDeg);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    return { x: pitch.x * cy - pitch.y * sy, y: pitch.x * sy + pitch.y * cy, z: pitch.z };
  }

  function add(origin, vector) {
    return { x: origin.x + vector.x, y: origin.y + vector.y, z: origin.z + vector.z };
  }

  function installationOrigin(options = {}) {
    return { x: finite(options.baseX, 0), y: finite(options.baseY, 0), z: finite(options.supportZ, 0) };
  }

  function yawPivot(options = {}) {
    return add(installationOrigin(options), installationVector({
      x: BASE_BACK_TO_YAW_PIVOT_M,
      y: 0,
      z: YAW_PIVOT_HEIGHT_M,
    }, options));
  }

  function pitchPivot(options = {}) {
    const yaw = yawPivot(options);
    const aim = radians(options.aimDeg);
    return add(yaw, installationVector({
      x: YAW_TO_PITCH_PIVOT_M * Math.cos(aim),
      y: YAW_TO_PITCH_PIVOT_M * Math.sin(aim),
      z: 0,
    }, options));
  }

  function releasePoint(options = {}) {
    const pitch = pitchPivot(options);
    const aim = radians(options.aimDeg);
    const elevation = radians(options.elevationDeg);
    const horizontal = PITCH_PIVOT_TO_WHEELS_M * Math.cos(elevation);
    return add(pitch, installationVector({
      x: horizontal * Math.cos(aim),
      y: horizontal * Math.sin(aim),
      z: PITCH_PIVOT_TO_WHEELS_M * Math.sin(elevation),
    }, options));
  }

  function launchFrame(options = {}) {
    const aim = radians(options.aimDeg);
    const elevation = radians(options.elevationDeg);
    const forward = installationVector({
      x: Math.cos(elevation) * Math.cos(aim),
      y: Math.cos(elevation) * Math.sin(aim),
      z: Math.sin(elevation),
    }, options);
    // Positive spin uses the local lateral axis, matching the previous
    // (-sin(yaw), cos(yaw), 0) convention for a level installation.
    const spinAxis = installationVector({ x: -Math.sin(aim), y: Math.cos(aim), z: 0 }, options);
    return { forward, spinAxis };
  }

  return Object.freeze({
    GEOMETRY_REFERENCE,
    constants: Object.freeze({
      BASE_BACK_TO_YAW_PIVOT_M,
      YAW_TO_PITCH_PIVOT_M,
      PITCH_PIVOT_TO_WHEELS_M,
      YAW_PIVOT_HEIGHT_M,
      NOVA_LENGTH_M,
      NOVA_WIDTH_M,
      NOVA_HEIGHT_M,
    }),
    yawPivot,
    pitchPivot,
    releasePoint,
    launchFrame,
    installationVector,
  });
});
