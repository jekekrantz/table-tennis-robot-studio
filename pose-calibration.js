(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PoseCalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_UNCERTAINTY = Object.freeze({ xCm: 5, yCm: 5, yawDeg: 3, landingCm: 5, measurementCm: 2 });
  const DEFAULT_STALE_DAYS = 14;
  const DISTANCE_NOISE_PER_M = .015;

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
    const uncertainty = sanitizeUncertainty(input.uncertainty);
    return {
      pose: sanitizePose(input.pose || pose),
      uncertainty,
      covariance: sanitizeCovariance(input.covariance, uncertainty),
      updatedAt: input.updatedAt ? String(input.updatedAt) : null,
      verifiedAt: input.verifiedAt ? String(input.verifiedAt) : null,
      lastRobotUseAt: input.lastRobotUseAt ? String(input.lastRobotUseAt) : null,
      observations: Array.isArray(input.observations) ? input.observations.slice(-24).map(observation => ({
        targetId: String(observation.targetId || ""),
        kind: ["table", "category", "unobserved"].includes(observation.kind) ? observation.kind : "table",
        quality: String(observation.quality || "tap"),
        accepted: observation.accepted !== false,
        downweighted: Boolean(observation.downweighted),
        targetX: finite(observation.targetX, 0),
        targetY: finite(observation.targetY, 0),
        longitudinalErrorCm: observation.longitudinalErrorCm == null ? null : finite(observation.longitudinalErrorCm, 0),
        lateralErrorCm: observation.lateralErrorCm == null ? null : finite(observation.lateralErrorCm, 0),
        outsideLongitudinal: Boolean(observation.outsideLongitudinal),
        outsideLateral: Boolean(observation.outsideLateral),
        humanSigmaLongitudinalCm: clamp(Math.abs(finite(observation.humanSigmaLongitudinalCm, uncertainty.measurementCm)), .2, 60),
        humanSigmaLateralCm: clamp(Math.abs(finite(observation.humanSigmaLateralCm, uncertainty.measurementCm)), .2, 60),
        shotSigmaCm: clamp(Math.abs(finite(observation.shotSigmaCm, uncertainty.landingCm)), .5, 60),
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

  function covarianceFromUncertainty(input = {}) {
    const u = sanitizeUncertainty(input);
    return [
      [Math.pow(u.xCm / 100, 2), 0, 0],
      [0, Math.pow(u.yCm / 100, 2), 0],
      [0, 0, Math.pow(u.yawDeg * Math.PI / 180, 2)],
    ];
  }

  function sanitizeCovariance(input, uncertainty = {}) {
    const fallback = covarianceFromUncertainty(uncertainty);
    if (!Array.isArray(input) || input.length !== 3 || input.some(row => !Array.isArray(row) || row.length !== 3)) return fallback;
    const result = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, column) => finite(input[row][column], fallback[row][column])));
    for (let row = 0; row < 3; row += 1) {
      result[row][row] = clamp(Math.abs(result[row][row]), row === 2 ? 1e-8 : 4e-6, row === 2 ? 1 : 4);
    }
    for (let row = 0; row < 3; row += 1) {
      for (let column = row + 1; column < 3; column += 1) {
        const symmetric = (result[row][column] + result[column][row]) / 2;
        const limit = Math.sqrt(result[row][row] * result[column][column]) * .999;
        result[row][column] = result[column][row] = clamp(symmetric, -limit, limit);
      }
    }
    const leadingMinor2 = result[0][0] * result[1][1] - result[0][1] * result[1][0];
    return leadingMinor2 > 1e-16 && determinant3(result) > 1e-16 ? result : fallback;
  }

  function uncertaintyFromCovariance(covarianceInput, base = {}) {
    const covariance = sanitizeCovariance(covarianceInput, base);
    const defaults = sanitizeUncertainty(base);
    return {
      ...defaults,
      xCm: Math.sqrt(covariance[0][0]) * 100,
      yCm: Math.sqrt(covariance[1][1]) * 100,
      yawDeg: Math.sqrt(covariance[2][2]) * 180 / Math.PI,
    };
  }

  function determinant3(matrix) {
    return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
      - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
      + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
  }

  function dot(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
  }

  function multiplyMatrixVector(matrix, vector) {
    return matrix.map(row => dot(row, vector));
  }

  function observationRows(target, pose) {
    return sensitivityRows(target, pose);
  }

  function modeledLandingNoiseCm(target, pose, uncertaintyInput = {}) {
    const u = sanitizeUncertainty(uncertaintyInput);
    const distanceM = Math.max(.25, Math.hypot(finite(target.x, 0) - finite(pose.x, 0), finite(target.y, 0) - finite(pose.y, 0)));
    const incidenceDeg = clamp(Math.abs(finite(target.incidenceDeg, 30)), 8, 85);
    const relativeNoiseCm = DISTANCE_NOISE_PER_M * distanceM / Math.max(.15, Math.sin(incidenceDeg * Math.PI / 180)) * 100;
    return clamp(Math.max(u.landingCm, relativeNoiseCm), .5, 50);
  }

  function expectedLandingCovariance(target = {}, poseInput = {}, covarianceInput, uncertaintyInput = {}) {
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const covariance = sanitizeCovariance(covarianceInput, uncertainty);
    const rows = sensitivityRows(target, pose);
    const projectedX = multiplyMatrixVector(covariance, rows[0]);
    const projectedY = multiplyMatrixVector(covariance, rows[1]);
    const shotSigmaM = clamp(Math.abs(finite(target.shotSigmaCm, modeledLandingNoiseCm(target, pose, uncertainty))), .5, 50) / 100;
    const shotVariance = shotSigmaM * shotSigmaM;
    const cross = (dot(rows[0], projectedY) + dot(rows[1], projectedX)) / 2;
    return [
      [Math.max(1e-10, dot(rows[0], projectedX) + shotVariance), cross],
      [cross, Math.max(1e-10, dot(rows[1], projectedY) + shotVariance)],
    ];
  }

  function gridResolutionCm(uncertaintyInput = {}) {
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    return clamp(Math.round(Math.max(10, uncertainty.landingCm * 2) / 5) * 5, 10, 25);
  }

  function rulerDistanceCm(valueM, minimumM, maximumM, gridCm, extras = [], originM = minimumM) {
    const valueCm = valueM * 100;
    const minimumCm = minimumM * 100;
    const maximumCm = maximumM * 100;
    const references = [minimumCm, maximumCm, ...extras.map(value => value * 100)];
    const originCm = originM * 100;
    for (let position = originCm + Math.floor((minimumCm - originCm) / gridCm) * gridCm; position <= maximumCm + .001; position += gridCm) references.push(position);
    return Math.min(...references.map(reference => Math.abs(valueCm - reference)));
  }

  function feedbackMeasurementNoise(table = {}, point = {}, options = {}) {
    const length = clamp(finite(table.length, 2.74), .5, 10);
    const width = clamp(finite(table.width, 1.525), .3, 5);
    const gridCm = clamp(finite(options.gridCm, 10), 5, 50);
    const pointerSigmaCm = clamp(finite(options.pointerSigmaCm, 2), .5, 12);
    const x = finite(point.x, 0);
    const y = finite(point.y, 0);
    const outsideLongitudinalCm = Math.max(0, -x, x - length) * 100;
    const outsideLateralCm = Math.max(0, -width / 2 - y, y - width / 2) * 100;
    const longitudinalRulerDistanceCm = rulerDistanceCm(x, 0, length, gridCm, [length / 2], finite(options.longitudinalGridOriginM, 0));
    const lateralRulerDistanceCm = rulerDistanceCm(y, -width / 2, width / 2, gridCm, [0], finite(options.lateralGridOriginM, -width / 2));
    const axisSigma = (distanceCm, outsideCm) => {
      const referenced = pointerSigmaCm + distanceCm * .22;
      return outsideCm > 0 ? clamp(Math.max(5, referenced * 1.65 + outsideCm * .12), 5, 30) : clamp(referenced, pointerSigmaCm, 12);
    };
    return {
      gridCm,
      longitudinalRulerDistanceCm,
      lateralRulerDistanceCm,
      outsideLongitudinal: outsideLongitudinalCm > 0,
      outsideLateral: outsideLateralCm > 0,
      longitudinalSigmaCm: axisSigma(longitudinalRulerDistanceCm, outsideLongitudinalCm),
      lateralSigmaCm: axisSigma(lateralRulerDistanceCm, outsideLateralCm),
    };
  }

  function localMeasurementView(table = {}, targetInput = {}, uncertaintyInput = {}, options = {}) {
    const length = clamp(finite(table.length, 2.74), .5, 10);
    const width = clamp(finite(table.width, 1.525), .3, 5);
    const pose = sanitizePose(options.pose);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const target = { x: finite(targetInput.x, length * .75), y: finite(targetInput.y, 0) };
    const covariance = sanitizeCovariance(options.covariance, uncertainty);
    const xReferences = [
      { value: 0, label: "NEAR ENDLINE", kind: "near-endline" },
      { value: length / 2, label: "NET", kind: "net" },
      { value: length, label: "FAR ENDLINE", kind: "far-endline" },
    ];
    const yReferences = [
      { value: width / 2, label: "LEFT SIDELINE", kind: "left-sideline" },
      { value: 0, label: "CENTRE LINE", kind: "centre-line" },
      { value: -width / 2, label: "RIGHT SIDELINE", kind: "right-sideline" },
    ];
    const xReference = xReferences.reduce((best, item) => Math.abs(item.value - target.x) < Math.abs(best.value - target.x) ? item : best);
    const yReference = yReferences.reduce((best, item) => Math.abs(item.value - target.y) < Math.abs(best.value - target.y) ? item : best);
    const rows = sensitivityRows(target, pose);
    const poseLongitudinalCm = Math.sqrt(Math.max(0, dot(rows[0], multiplyMatrixVector(covariance, rows[0])))) * 100;
    const poseLateralCm = Math.sqrt(Math.max(0, dot(rows[1], multiplyMatrixVector(covariance, rows[1])))) * 100;
    const shotSigmaCm = clamp(Math.abs(finite(targetInput.shotSigmaCm, modeledLandingNoiseCm(target, pose, uncertainty))), .5, 50);
    const longitudinalSigmaCm = Math.hypot(shotSigmaCm, poseLongitudinalCm, finite(targetInput.humanSigmaLongitudinalCm, uncertainty.measurementCm));
    const lateralSigmaCm = Math.hypot(shotSigmaCm, poseLateralCm, finite(targetInput.humanSigmaLateralCm, uncertainty.measurementCm));
    const desiredLongitudinalSpanCm = Math.max(36, longitudinalSigmaCm * 5 + 12, Math.abs(target.x - xReference.value) * 100 + 20);
    const desiredLateralSpanCm = Math.max(32, lateralSigmaCm * 5 + 12, Math.abs(target.y - yReference.value) * 100 + 20);
    const rawStepCm = Math.max(desiredLongitudinalSpanCm / 9, desiredLateralSpanCm / 7);
    const niceStepsCm = [2, 5, 10, 20, 50];
    const gridCm = clamp(niceStepsCm.reduce((best, step) => Math.abs(step - rawStepCm) < Math.abs(best - rawStepCm) ? step : best), 2, 50);
    const stepM = gridCm / 100;
    const longitudinalMarginM = Math.max(.16, (longitudinalSigmaCm * 2.5 + gridCm) / 100);
    const lateralMarginM = Math.max(.14, (lateralSigmaCm * 2.5 + gridCm) / 100);
    const unsnappedMinX = Math.min(target.x - longitudinalMarginM, xReference.value - stepM);
    const unsnappedMaxX = Math.max(target.x + longitudinalMarginM, xReference.value + stepM);
    const unsnappedMinY = Math.min(target.y - lateralMarginM, yReference.value - stepM);
    const unsnappedMaxY = Math.max(target.y + lateralMarginM, yReference.value + stepM);
    const snapDown = (value, origin) => origin + Math.floor((value - origin) / stepM + 1e-9) * stepM;
    const snapUp = (value, origin) => origin + Math.ceil((value - origin) / stepM - 1e-9) * stepM;
    let minX = snapDown(unsnappedMinX, xReference.value);
    let maxX = snapUp(unsnappedMaxX, xReference.value);
    let minY = snapDown(unsnappedMinY, yReference.value);
    let maxY = snapUp(unsnappedMaxY, yReference.value);
    const plotAspect = 304 / 420; // lateral metres / longitudinal metres at equal scale
    const xCells = () => Math.round((maxX - minX) / stepM);
    const yCells = () => Math.round((maxY - minY) / stepM);
    if (yCells() / xCells() > plotAspect) {
      const extra = Math.max(0, Math.ceil(yCells() / plotAspect) - xCells());
      minX -= Math.floor(extra / 2) * stepM;
      maxX += Math.ceil(extra / 2) * stepM;
    } else {
      const extra = Math.max(0, Math.ceil(xCells() * plotAspect) - yCells());
      minY -= Math.floor(extra / 2) * stepM;
      maxY += Math.ceil(extra / 2) * stepM;
    }
    const xDeltaCm = Math.round((target.x - xReference.value) * 100);
    const yDeltaCm = Math.round((target.y - yReference.value) * 100);
    const longitudinalLabel = Math.abs(xDeltaCm) < 1 ? `at ${xReference.label.toLowerCase()}` : xReference.kind === "net"
      ? `${Math.abs(xDeltaCm)} cm ${xDeltaCm >= 0 ? "past" : "before"} net`
      : xReference.kind === "far-endline"
        ? `${Math.abs(xDeltaCm)} cm ${xDeltaCm <= 0 ? "short of" : "past"} far endline`
        : `${Math.abs(xDeltaCm)} cm ${xDeltaCm >= 0 ? "from" : "behind"} near endline`;
    const lateralLabel = Math.abs(yDeltaCm) < 1 ? `on ${yReference.label.toLowerCase()}` : yReference.kind === "centre-line"
      ? `${Math.abs(yDeltaCm)} cm ${yDeltaCm >= 0 ? "left" : "right"} of centre line`
      : `${Math.abs(yDeltaCm)} cm from ${yReference.kind === "left-sideline" ? "left" : "right"} sideline`;
    return {
      minX, maxX, minY, maxY, gridCm,
      xReference, yReference,
      longitudinalSigmaCm, lateralSigmaCm,
      longitudinalLabel, lateralLabel,
    };
  }

  function targetSigmasM(target, uncertainty, pose) {
    const u = sanitizeUncertainty(uncertainty);
    const shotSigmaCm = clamp(Math.abs(finite(target.shotSigmaCm, modeledLandingNoiseCm(target, pose, u))), .5, 60);
    return [
      Math.hypot(shotSigmaCm, clamp(Math.abs(finite(target.humanSigmaLongitudinalCm, u.measurementCm)), .2, 60)) / 100,
      Math.hypot(shotSigmaCm, clamp(Math.abs(finite(target.humanSigmaLateralCm, u.measurementCm)), .2, 60)) / 100,
    ];
  }

  function covarianceAfterRows(covarianceInput, rows, sigmasM) {
    let covariance = sanitizeCovariance(covarianceInput);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const sigmaM = Array.isArray(sigmasM) ? sigmasM[rowIndex] : sigmasM;
      const projected = multiplyMatrixVector(covariance, row);
      const innovationVariance = Math.max(1e-12, dot(row, projected) + sigmaM * sigmaM);
      const gain = projected.map(value => value / innovationVariance);
      const next = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => covariance[i][j] - gain[i] * projected[j]));
      covariance = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => (next[i][j] + next[j][i]) / 2));
    }
    return sanitizeCovariance(covariance, uncertaintyFromCovariance(covariance));
  }

  function covarianceAfterTarget(covariance, target, pose, uncertainty) {
    return covarianceAfterRows(covariance, observationRows(target, pose), targetSigmasM(target, uncertainty, pose));
  }

  function informationGainForTarget(target, pose, covariance, uncertainty) {
    const before = Math.max(1e-16, determinant3(covariance));
    const afterCovariance = covarianceAfterTarget(covariance, target, pose, uncertainty);
    const after = Math.max(1e-16, determinant3(afterCovariance));
    return Math.max(0, .5 * Math.log(before / after));
  }

  function calibrationStatus(table = {}, poseInput = {}, covarianceInput, uncertaintyInput = {}) {
    const length = clamp(finite(table.length, 2.74), .5, 10);
    const width = clamp(finite(table.width, 1.525), .3, 5);
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const covariance = sanitizeCovariance(covarianceInput, uncertainty);
    const checkpoints = [];
    for (const x of [length * .58, length * .78, length - .10]) {
      for (const y of [-width / 2 + .10, 0, width / 2 - .10]) checkpoints.push({ x, y });
    }
    let worstRatio = 0;
    let worstPoseLandingCm = 0;
    let excess = 0;
    for (const checkpoint of checkpoints) {
      const rows = sensitivityRows(checkpoint, pose);
      const allowedCm = modeledLandingNoiseCm(checkpoint, pose, uncertainty);
      for (const row of rows) {
        const sigmaCm = Math.sqrt(Math.max(0, dot(row, multiplyMatrixVector(covariance, row)))) * 100;
        const ratio = sigmaCm / allowedCm;
        worstRatio = Math.max(worstRatio, ratio);
        worstPoseLandingCm = Math.max(worstPoseLandingCm, sigmaCm);
        excess += Math.pow(Math.max(0, ratio * ratio - 1), 2);
      }
    }
    return {
      converged: worstRatio <= 1,
      worstRatio,
      worstPoseLandingCm,
      acceptableLandingCm: modeledLandingNoiseCm({ x: length - .10, y: 0 }, pose, uncertainty),
      excess,
    };
  }

  function targetCandidates(table = {}, poseInput = {}, uncertaintyInput = {}) {
    const length = clamp(finite(table.length, 2.74), .5, 10);
    const width = clamp(finite(table.width, 1.525), .3, 5);
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const gridCm = gridResolutionCm(uncertainty);
    const stepM = gridCm / 100;
    const edgeMarginM = Math.max(.08, uncertainty.landingCm * 1.5 / 100);
    const candidates = [];
    const xStart = Math.ceil((length / 2 + .12) / stepM) * stepM;
    const xEnd = length - edgeMarginM;
    for (let x = xStart; x <= xEnd + 1e-6; x += stepM) {
      for (let fromLeft = stepM; fromLeft <= width - edgeMarginM + 1e-6; fromLeft += stepM) {
        const y = width / 2 - fromLeft;
        if (Math.abs(y) > width / 2 - edgeMarginM) continue;
        const depthZone = x > length * .73 ? "far" : "mid";
        const lateralZone = y > width / 6 ? "left" : y < -width / 6 ? "right" : "centre";
        const watchGroup = `${depthZone}-${lateralZone}`;
        const zoneLabel = `${lateralZone} side ${depthZone === "far" ? "near the far end" : "near the net"}`;
        const target = { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
        const measurement = feedbackMeasurementNoise(table, target, { gridCm, pointerSigmaCm: uncertainty.measurementCm });
        const shotSigmaCm = modeledLandingNoiseCm(target, pose, uncertainty);
        candidates.push({
          id: `grid-${Math.round(x * 100)}-${Math.round(y * 100)}`,
          label: `${depthZone === "far" ? "far" : "mid-table"} ${lateralZone} grid point`,
          coordinateLabel: `${Math.round(x * 100)} cm from the near edge · ${Math.round(Math.abs(y) * 100)} cm ${y >= 0 ? "left" : "right"} of centre`,
          x: target.x,
          y: target.y,
          clearanceCm: clamp(Math.round(9 + (x / length) * 3), 9, 12),
          observationKind: "table",
          reference: `${gridCm} cm table grid`,
          gridCm,
          watchGroup,
          watchInstruction: `Stand at the ${zoneLabel} and judge the first bounce on the numbered table grid.`,
          shotSigmaCm,
          humanSigmaLongitudinalCm: measurement.longitudinalSigmaCm,
          humanSigmaLateralCm: measurement.lateralSigmaCm,
        });
      }
    }
    return candidates;
  }

  function proposeCalibrationTargets(table = {}, poseInput = {}, uncertaintyInput = {}, options = {}) {
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    const covariance = sanitizeCovariance(options.covariance, uncertainty);
    const before = calibrationStatus(table, pose, covariance, uncertainty);
    const recentTargets = Array.isArray(options.recentTargets) ? options.recentTargets : [];
    const verification = Boolean(options.verification);
    return targetCandidates(table, pose, uncertainty).map(target => {
      const expectedCovariance = covarianceAfterTarget(covariance, target, pose, uncertainty);
      const after = calibrationStatus(table, pose, expectedCovariance, uncertainty);
      const convergenceGain = Math.max(0, before.excess - after.excess);
      const relativeConvergenceGain = convergenceGain / Math.max(1, before.excess);
      const informationGain = informationGainForTarget(target, pose, covariance, uncertainty);
      const nearestRecentM = recentTargets.length
        ? Math.min(...recentTargets.map(recent => Math.hypot(target.x - finite(recent.x, 0), target.y - finite(recent.y, 0))))
        : Infinity;
      const movementPenalty = options.currentWatchGroup && options.currentWatchGroup !== target.watchGroup ? .32 : 0;
      const repeatPenalty = nearestRecentM < .08 ? .42 : nearestRecentM < .22 ? .16 : 0;
      const verificationPenalty = verification
        ? (nearestRecentM < .45 ? 10 : 0) + (options.currentWatchGroup === target.watchGroup ? .8 : 0)
        : 0;
      return {
        ...target,
        informationGain,
        convergenceGain,
        relativeConvergenceGain,
        expectedCovariance,
        expectedStatus: after,
        selectionScore: relativeConvergenceGain * 1.8 + Math.min(1, informationGain) * .12 - movementPenalty - repeatPenalty - verificationPenalty,
      };
    }).sort((a, b) => b.selectionScore - a.selectionScore);
  }

  function planCalibrationSequence(table = {}, poseInput = {}, uncertaintyInput = {}, options = {}) {
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    let covariance = sanitizeCovariance(options.covariance, uncertainty);
    let watchGroup = options.currentWatchGroup || null;
    const recentTargets = Array.isArray(options.recentTargets) ? [...options.recentTargets] : [];
    const sequence = [];
    const maxShots = Math.round(clamp(finite(options.maxShots, 4), 1, 8));
    for (let index = 0; index < maxShots; index += 1) {
      const candidates = proposeCalibrationTargets(table, pose, uncertainty, {
        covariance,
        currentWatchGroup: watchGroup,
        recentTargets,
        verification: options.verification && index === 0,
      });
      const target = candidates[0];
      if (!target || target.selectionScore < -5) break;
      sequence.push(target);
      covariance = target.expectedCovariance;
      watchGroup = target.watchGroup;
      recentTargets.push(target);
      if (!options.verification && target.expectedStatus.converged) break;
      if (options.verification) break;
    }
    return { sequence, covariance, status: calibrationStatus(table, pose, covariance, uncertainty) };
  }

  function estimatePoseObservation(poseInput, covarianceInput, observation = {}, uncertaintyInput = {}) {
    const pose = sanitizePose(poseInput);
    const uncertainty = sanitizeUncertainty(uncertaintyInput);
    let covariance = sanitizeCovariance(covarianceInput, uncertainty);
    const target = { x: finite(observation.targetX, 0), y: finite(observation.targetY, 0) };
    const allRows = sensitivityRows(target, pose);
    const shotSigmaCm = clamp(Math.abs(finite(observation.shotSigmaCm, uncertainty.landingCm)), .5, 60);
    const components = [];
    if (observation.longitudinalErrorCm != null && Number.isFinite(Number(observation.longitudinalErrorCm))) components.push({
      row: allRows[0], residualM: Number(observation.longitudinalErrorCm) / 100,
      sigmaM: Math.hypot(shotSigmaCm, clamp(Math.abs(finite(observation.humanSigmaLongitudinalCm, uncertainty.measurementCm)), .2, 60)) / 100,
    });
    if (observation.lateralErrorCm != null && Number.isFinite(Number(observation.lateralErrorCm))) components.push({
      row: allRows[1], residualM: Number(observation.lateralErrorCm) / 100,
      sigmaM: Math.hypot(shotSigmaCm, clamp(Math.abs(finite(observation.humanSigmaLateralCm, uncertainty.measurementCm)), .2, 60)) / 100,
    });
    if (!components.length) return { accepted: false, reason: "no-measurement", correctedPose: pose, covariance, uncertainty: uncertaintyFromCovariance(covariance, uncertainty) };
    const delta = [0, 0, 0];
    let maxZ = 0;
    let downweighted = false;
    for (const component of components) {
      const projected = multiplyMatrixVector(covariance, component.row);
      const innovationVariance = Math.max(1e-12, dot(component.row, projected) + component.sigmaM * component.sigmaM);
      let innovation = component.residualM - dot(component.row, delta);
      const z = Math.abs(innovation) / Math.sqrt(innovationVariance);
      maxZ = Math.max(maxZ, z);
      if (z > 4.5) {
        innovation *= 4.5 / z;
        downweighted = true;
      }
      const gain = projected.map(value => value / innovationVariance);
      for (let index = 0; index < 3; index += 1) delta[index] += gain[index] * innovation;
      const next = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => covariance[i][j] - gain[i] * projected[j]));
      covariance = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => (next[i][j] + next[j][i]) / 2));
    }
    const correctedPose = sanitizePose({
      x: pose.x + delta[0],
      y: pose.y + delta[1],
      yawDeg: pose.yawDeg + delta[2] * 180 / Math.PI,
    });
    return {
      accepted: true,
      downweighted,
      normalizedInnovation: maxZ,
      delta: { xCm: delta[0] * 100, yCm: delta[1] * 100, yawDeg: delta[2] * 180 / Math.PI },
      correctedPose,
      covariance,
      uncertainty: uncertaintyFromCovariance(covariance, uncertainty),
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
    covarianceFromUncertainty,
    sanitizeCovariance,
    uncertaintyFromCovariance,
    observationRows,
    modeledLandingNoiseCm,
    expectedLandingCovariance,
    gridResolutionCm,
    feedbackMeasurementNoise,
    localMeasurementView,
    informationGainForTarget,
    calibrationStatus,
    targetCandidates,
    proposeCalibrationTargets,
    planCalibrationSequence,
    estimatePoseObservation,
  });
});
