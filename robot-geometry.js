(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RobotGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Measured Nova geometry. These are intentionally fixed, not fit parameters.
  const GEOMETRY_REFERENCE = "base-back-pivots-v1";
  const BASE_BACK_TO_YAW_PIVOT_M = 0.242;
  const YAW_TO_PITCH_PIVOT_M = 0.075;
  const PITCH_PIVOT_TO_WHEELS_M = 0.075;
  const YAW_PIVOT_HEIGHT_M = 0.240;

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function radians(deg) {
    return finite(deg, 0) * Math.PI / 180;
  }

  function yawPivot(options = {}) {
    const baseX = finite(options.baseX, 0);
    const baseY = finite(options.baseY, 0);
    const supportZ = finite(options.supportZ, 0);
    const baseYaw = radians(options.baseYawDeg);
    return {
      x: baseX + BASE_BACK_TO_YAW_PIVOT_M * Math.cos(baseYaw),
      y: baseY + BASE_BACK_TO_YAW_PIVOT_M * Math.sin(baseYaw),
      z: supportZ + YAW_PIVOT_HEIGHT_M,
    };
  }

  function pitchPivot(options = {}) {
    const yaw = yawPivot(options);
    const headYaw = radians(finite(options.baseYawDeg, 0) + finite(options.aimDeg, 0));
    return {
      x: yaw.x + YAW_TO_PITCH_PIVOT_M * Math.cos(headYaw),
      y: yaw.y + YAW_TO_PITCH_PIVOT_M * Math.sin(headYaw),
      z: yaw.z,
    };
  }

  function releasePoint(options = {}) {
    const pitch = pitchPivot(options);
    const headYaw = radians(finite(options.baseYawDeg, 0) + finite(options.aimDeg, 0));
    const elevation = radians(options.elevationDeg);
    const horizontal = PITCH_PIVOT_TO_WHEELS_M * Math.cos(elevation);
    return {
      x: pitch.x + horizontal * Math.cos(headYaw),
      y: pitch.y + horizontal * Math.sin(headYaw),
      z: pitch.z + PITCH_PIVOT_TO_WHEELS_M * Math.sin(elevation),
    };
  }

  return Object.freeze({
    GEOMETRY_REFERENCE,
    constants: Object.freeze({
      BASE_BACK_TO_YAW_PIVOT_M,
      YAW_TO_PITCH_PIVOT_M,
      PITCH_PIVOT_TO_WHEELS_M,
      YAW_PIVOT_HEIGHT_M,
    }),
    yawPivot,
    pitchPivot,
    releasePoint,
  });
});
