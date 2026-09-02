(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PoseCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_UNCERTAINTY = Object.freeze({ xCm: 5, yCm: 5, yawDeg: 3, landingCm: 6, measurementCm: 2 });
  const DEFAULT_STALE_DAYS = 14;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function sanitizePose(pose = {}) {
    return {
      x: clamp(finite(pose.x, 0), -1.5, 4.2),
      y: clamp(finite(pose.y, 0), -2, 2),
      yawDeg: clamp(finite(pose.yawDeg, 0), -180, 180),
    };
  }

  function sanitizeUncertainty(input = {}) {
    return {
      xCm: clamp(Math.abs(finite(input.xCm, DEFAULT_UNCERTAINTY.xCm)), .2, 100),
      yCm: clamp(Math.abs(finite(input.yCm, DEFAULT_UNCERTAINTY.yCm)), .2, 100),
      yawDeg: clamp(Math.abs(finite(input.yawDeg, DEFAULT_UNCERTAINTY.yawDeg)), .1, 45),
      landingCm: clamp(Math.abs(finite(input.landingCm, DEFAULT_UNCERTAINTY.landingCm)), .5, 50),
      measurementCm: clamp(Math.abs(finite(input.measurementCm, DEFAULT_UNCERTAINTY.measurementCm)), .2, 30),
    };
  }

  function sanitizeSession(input = {}, pose = {}) {
    return {
      pose: sanitizePose(input.pose || pose),
      uncertainty: sanitizeUncertainty(input.uncertainty),
      updatedAt: input.updatedAt ? String(input.updatedAt) : null,
      verifiedAt: input.verifiedAt ? String(input.verifiedAt) : null,
      lastRobotUseAt: input.lastRobotUseAt ? String(input.lastRobotUseAt) : null,
      observations: Array.isArray(input.observations) ? input.observations.slice(-24).map(observation => ({
        targetId: String(observation.targetId || ""),
        targetX: finite(observation.targetX, 0),
        targetY: finite(observation.targetY, 0),
        longitudinalErrorCm: finite(observation.longitudinalErrorCm, 0),
        lateralErrorCm: finite(observation.lateralErrorCm, 0),
        measuredClearanceCm: observation.measuredClearanceCm == null ? null : finite(observation.measuredClearanceCm, null),
        repeatCount: clamp(Math.round(finite(observation.repeatCount, 1)), 1, 12),
      })) : [],
    };
  }

  function ageDays(iso, now = Date.now()) {
    const timestamp = Date.parse(String(iso || ""));
    return Number.isFinite(timestamp) ? Math.max(0, (Number(now) - timestamp) / 86400000) : Infinity;
  }

  function isStale(session, now = Date.now(), staleDays = DEFAULT_STALE_DAYS) {
    const latest = [session?.verifiedAt, session?.updatedAt, session?.lastRobotUseAt]
      .map(value => Date.parse(String(value || "")))
      .filter(Number.isFinite)
      .reduce((best, value) => Math.max(best, value), -Infinity);
    return ageDays(Number.isFinite(latest) ? new Date(latest).toISOString() : null, now)
      >= Math.max(1, finite(staleDays, DEFAULT_STALE_DAYS));
  }

  function sensitivityRows(target, pose) {
    const dx = finite(target.x, 0) - finite(pose.x, 0);
    const dy = finite(target.y, 0) - finite(pose.y, 0);
    // Small-angle SE(2) landing sensitivity. Yaw is represented in radians.
    return [
      [1, 0, -dy],
      [0, 1, dx],
    ];
  }

  function determinant3(matrix) {
    return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
      - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
      + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
  }

  function inverse3(matrix) {
    const det = determinant3(matrix);
    if (Math.abs(det) < 1e-12) return null;
    const result = Array.from({ length: 3 }, () => Array(3).fill(0));
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const minor = matrix.filter((_, index) => index !== column)
          .map(source => source.filter((_, index) => index !== row));
        const cofactor = ((row + column) % 2 ? -1 : 1)
          * (minor[0][0] * minor[1][1] - minor[0][1] * minor[1][0]);
        result[row][column] = cofactor / det;
      }
    }
    return result;
  }

  function multiplyMatrixVector(matrix, vector) {
    return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
  }

  function informationForTargets(targets, pose, uncertainty) {
    const u = sanitizeUncertainty(uncertainty);
    const shotSigmaM = Math.hypot(u.landingCm, u.measurementCm) / 100;
    const information = [
      [1 / Math.pow(u.xCm / 100, 2), 0, 0],
      [0, 1 / Math.pow(u.yCm / 100, 2), 0],
      [0, 0, 1 / Math.pow(u.yawDeg * Math.PI / 180, 2)],
    ];
    for (const target of targets) {
      const repeatWeight = Math.max(1, finite(target.repeatCount, 1)) / (shotSigmaM * shotSigmaM);
      for (const row of sensitivityRows(target, pose)) {
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) information[i][j] += repeatWeight * row[i] * row[j];
        }
      }
    }
    return information;
  }

  function proposeVerificationTargets(table = {}, poseInput = {}, uncertaintyInput = {}) {
    const length = clamp(finite(table.length, 2.74), .5, 10);
    const width = clamp(finite(table.width, 1.525), .3, 5);
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const totalNoiseCm = Math.hypot(uncertainty.landingCm, uncertainty.measurementCm);
    const repeatCount = clamp(Math.ceil(Math.pow(totalNoiseCm / 5, 2)), 1, 4);
    const candidates = [
      { id: "deep-center", label: "Deep centre-line", x: length - .34, y: 0, clearanceCm: 10, reference: "End line + centre line", purpose: "Separates forward/back error from lateral error and gives strong yaw leverage." },
      { id: "wide-left", label: "Deep left reference", x: length - .42, y: width / 2 - .27, clearanceCm: 11, reference: "Left sideline + end line", purpose: "Distinguishes lateral offset from direction error." },
      { id: "wide-right", label: "Deep right reference", x: length - .42, y: -width / 2 + .27, clearanceCm: 11, reference: "Right sideline + end line", purpose: "Pairs with the left shot to make yaw observable." },
      { id: "net-center", label: "Net / centre-line check", x: length / 2 + .55, y: 0, clearanceCm: 5, reference: "Centre line + top of net", purpose: "The shorter flight separates lateral offset from yaw and gives a direct net-height reference." },
    ];
    const priorInformation = informationForTargets([], pose, uncertainty);
    const priorDet = Math.max(1e-12, determinant3(priorInformation));
    return candidates.map(candidate => {
      const target = { ...candidate, repeatCount };
      const info = informationForTargets([target], pose, uncertainty);
      const informationGain = Math.max(0, Math.log(Math.max(priorDet, determinant3(info)) / priorDet) / 2);
      return { ...target, informationGain, expectedNoiseCm: totalNoiseCm };
    }).sort((a, b) => b.informationGain - a.informationGain);
  }

  function estimatePoseCorrection(poseInput, uncertaintyInput, observations = []) {
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const valid = observations.filter(observation => Number.isFinite(Number(observation?.longitudinalErrorCm)) && Number.isFinite(Number(observation?.lateralErrorCm)));
    const information = informationForTargets([], pose, uncertainty);
    const rhs = [0, 0, 0];
    const sigmaM = Math.hypot(uncertainty.landingCm, uncertainty.measurementCm) / 100;
    for (const observation of valid) {
      const weight = clamp(Math.round(finite(observation.repeatCount, 1)), 1, 12) / (sigmaM * sigmaM);
      const target = { x: finite(observation.targetX, 0), y: finite(observation.targetY, 0) };
      const errors = [finite(observation.longitudinalErrorCm, 0) / 100, finite(observation.lateralErrorCm, 0) / 100];
      sensitivityRows(target, pose).forEach((row, rowIndex) => {
        for (let i = 0; i < 3; i += 1) {
          rhs[i] += weight * row[i] * errors[rowIndex];
          for (let j = 0; j < 3; j += 1) information[i][j] += weight * row[i] * row[j];
        }
      });
    }
    const covariance = inverse3(information);
    if (!covariance) return null;
    const delta = multiplyMatrixVector(covariance, rhs);
    const correctedPose = sanitizePose({
      x: pose.x + delta[0],
      y: pose.y + delta[1],
      yawDeg: pose.yawDeg + delta[2] * 180 / Math.PI,
    });
    return {
      observationCount: valid.length,
      delta: { xCm: delta[0] * 100, yCm: delta[1] * 100, yawDeg: delta[2] * 180 / Math.PI },
      correctedPose,
      uncertainty: {
        ...uncertainty,
        xCm: Math.sqrt(Math.max(0, covariance[0][0])) * 100,
        yCm: Math.sqrt(Math.max(0, covariance[1][1])) * 100,
        yawDeg: Math.sqrt(Math.max(0, covariance[2][2])) * 180 / Math.PI,
      },
    };
  }

  return Object.freeze({
    DEFAULT_UNCERTAINTY,
    DEFAULT_STALE_DAYS,
    sanitizePose,
    sanitizeUncertainty,
    sanitizeSession,
    ageDays,
    isStale,
    sensitivityRows,
    informationForTargets,
    proposeVerificationTargets,
    estimatePoseCorrection,
  });
});
