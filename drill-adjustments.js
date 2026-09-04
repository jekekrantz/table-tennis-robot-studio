(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrillAdjustments = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TUNING_SPECS = Object.freeze({
    pacePct: Object.freeze({ step: 1, min: -50, max: 100 }),
    clearancePct: Object.freeze({ step: 1, min: -100, max: 200 }),
    spinPct: Object.freeze({ step: 1, min: -100, max: 300 }),
    speedPct: Object.freeze({ step: 1, min: -50, max: 50 }),
  });
  const DEFAULT_TUNING = Object.freeze({ pacePct: 0, clearancePct: 0, spinPct: 0, speedPct: 0 });

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function normalizePercent(key, value) {
    const spec = TUNING_SPECS[key] || { step: 5, min: -50, max: 50 };
    const stepped = Math.round(finite(value, 0) / spec.step) * spec.step;
    return clamp(stepped, spec.min, spec.max);
  }

  function normalizeTuning(input = {}) {
    return {
      pacePct: normalizePercent("pacePct", input.pacePct),
      clearancePct: normalizePercent("clearancePct", input.clearancePct),
      spinPct: normalizePercent("spinPct", input.spinPct),
      speedPct: normalizePercent("speedPct", input.speedPct),
    };
  }

  function hasActiveTuning(input = {}) {
    const tuning = normalizeTuning(input);
    return Object.values(tuning).some(value => Math.abs(value) > 1e-9);
  }

  // Pace is a rate multiplier. +100% means twice the pace (half the delay),
  // while -50% means half the pace (twice the delay). This behaves sensibly
  // across the wider player-preference range and never collapses to zero delay.
  function delayWithPace(delaySeconds, input = {}) {
    const tuning = normalizeTuning(input);
    const delay = Math.max(0, finite(delaySeconds, 0));
    const paceMultiplier = Math.max(0.05, 1 + tuning.pacePct / 100);
    return delay / paceMultiplier;
  }

  function landingErrorM(prediction, targetLanding) {
    if (!prediction?.landing || !targetLanding) return Infinity;
    return Math.hypot(
      finite(prediction.landing.x, 0) - finite(targetLanding.x, 0),
      finite(prediction.landing.y, 0) - finite(targetLanding.y, 0)
    );
  }

  function safePredict(predict, params) {
    try {
      return predict(params);
    } catch (_) {
      return null;
    }
  }

  const CONTROL_KEYS = Object.freeze(["speedMps", "spinRps", "elevationDeg", "aimDeg"]);

  function solveLinear(matrix, rhs) {
    const n = rhs.length;
    const augmented = matrix.map((row, index) => [...row, rhs[index]]);
    for (let column = 0; column < n; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < n; row += 1) {
        if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
      }
      if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
      const divisor = augmented[column][column];
      for (let j = column; j <= n; j += 1) augmented[column][j] /= divisor;
      for (let row = 0; row < n; row += 1) {
        if (row === column) continue;
        const factor = augmented[row][column];
        for (let j = column; j <= n; j += 1) augmented[row][j] -= factor * augmented[column][j];
      }
    }
    return augmented.map(row => row[n]);
  }

  function dot(a, b) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
  }

  function vectorNorm(values) {
    return Math.hypot(...values);
  }

  function paramsFromVector(vector) {
    return Object.fromEntries(CONTROL_KEYS.map((key, index) => [key, vector[index]]));
  }

  function goalResidual(params, prediction, goals, options) {
    if (!prediction?.landing || prediction.net?.clearanceM == null) return null;
    const residual = [];
    if (goals.targetLanding) {
      residual.push((prediction.landing.x - goals.targetLanding.x) / finite(options.landingScaleM, .025));
      residual.push((prediction.landing.y - goals.targetLanding.y) / finite(options.landingScaleM, .025));
    }
    if (Number.isFinite(goals.targetClearanceM)) {
      residual.push((prediction.net.clearanceM - goals.targetClearanceM) / finite(options.clearanceScaleM, .008));
    }
    if (Number.isFinite(goals.desiredSpeedMps)) {
      residual.push((params.speedMps - goals.desiredSpeedMps) / finite(options.speedScaleMps, .10));
    }
    if (Number.isFinite(goals.desiredSpinRps)) {
      residual.push((params.spinRps - goals.desiredSpinRps) / finite(options.spinScaleRps, 1.5));
    }
    if (prediction.net.hit) residual.push(8);
    return residual;
  }

  function solveShotGoals(seedParams, goals, predict, options = {}) {
    const bounds = [
      [finite(options.minSpeedMps, 1), finite(options.maxSpeedMps, 20)],
      [finite(options.minSpinRps, -120), finite(options.maxSpinRps, 120)],
      [finite(options.minElevationDeg, -20), finite(options.maxElevationDeg, 45)],
      [finite(options.minAimDeg, -60), finite(options.maxAimDeg, 60)],
    ];
    let point = CONTROL_KEYS.map((key, index) => clamp(finite(seedParams?.[key], 0), bounds[index][0], bounds[index][1]));
    let evaluations = 0;
    const evaluate = vector => {
      evaluations += 1;
      const params = paramsFromVector(vector);
      const prediction = safePredict(predict, params);
      const residual = goalResidual(params, prediction, goals, options);
      return residual ? { params, prediction, residual, score: vectorNorm(residual) } : null;
    };
    let current = evaluate(point);
    if (!current) return null;
    let best = current;
    const steps = [0.04, 0.4, 0.08, 0.08];
    const jacobian = Array.from({ length: current.residual.length }, () => Array(4).fill(0));
    for (let column = 0; column < 4; column += 1) {
      let step = steps[column];
      if (point[column] + step > bounds[column][1]) step = -step;
      const shifted = [...point];
      shifted[column] += step;
      const result = evaluate(shifted);
      if (!result || result.residual.length !== current.residual.length) return null;
      for (let row = 0; row < current.residual.length; row += 1) jacobian[row][column] = (result.residual[row] - current.residual[row]) / step;
    }
    const maxIterations = Math.round(clamp(finite(options.maxIterations, 8), 1, 14));
    const maxEvaluations = Math.round(clamp(finite(options.maxEvaluations, 24), 5, 60));
    for (let iteration = 0; iteration < maxIterations && evaluations < maxEvaluations; iteration += 1) {
      const normal = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) =>
        jacobian.reduce((sum, source) => sum + source[row] * source[column], row === column ? .002 : 0)));
      const rhs = Array.from({ length: 4 }, (_, column) => -jacobian.reduce((sum, row, index) => sum + row[column] * current.residual[index], 0));
      const delta = solveLinear(normal, rhs);
      if (!delta || delta.some(value => !Number.isFinite(value))) break;
      let accepted = null;
      for (const factor of [1, .5, .25, .125]) {
        const candidatePoint = point.map((value, index) => value + factor * delta[index]);
        if (candidatePoint.some((value, index) => value < bounds[index][0] || value > bounds[index][1])) continue;
        if (evaluations >= maxEvaluations) break;
        const candidate = evaluate(candidatePoint);
        if (candidate && candidate.score < current.score) { accepted = { point: candidatePoint, result: candidate }; break; }
      }
      if (!accepted) break;
      const dx = accepted.point.map((value, index) => value - point[index]);
      const denominator = dot(dx, dx);
      if (denominator > 1e-10) {
        const residualChange = accepted.result.residual.map((value, index) => value - current.residual[index]);
        const predictedChange = jacobian.map(row => dot(row, dx));
        jacobian.forEach((row, rowIndex) => row.forEach((value, column) => {
          row[column] = value + (residualChange[rowIndex] - predictedChange[rowIndex]) * dx[column] / denominator;
        }));
      }
      point = accepted.point;
      current = accepted.result;
      if (current.score < best.score) best = current;
      if (current.score < .04) break;
    }
    return { ...best, evaluations };
  }

  function applyShotTuning(baseParams, inputTuning, predict, options = {}) {
    const tuning = normalizeTuning(inputTuning);
    const original = {
      speedMps: finite(baseParams?.speedMps, 8),
      spinRps: finite(baseParams?.spinRps, 0),
      elevationDeg: finite(baseParams?.elevationDeg, 4),
      aimDeg: finite(baseParams?.aimDeg, 0),
    };
    const tuningActive = hasActiveTuning({ ...tuning, pacePct: 0 });
    const basePrediction = options.basePrediction || safePredict(options.referencePredict || predict, original);
    if (!tuningActive && !options.forceSolve) {
      const prediction = basePrediction;
      return {
        params: { ...original },
        basePrediction: prediction,
        prediction,
        landingErrorM: 0,
        clearanceErrorM: 0,
        targetClearanceM: prediction?.net?.clearanceM ?? null,
        warnings: [],
        changed: false,
        feasible: true,
        evaluations: 0,
      };
    }

    if (!basePrediction?.landing) {
      return {
        params: { ...original }, basePrediction, prediction: basePrediction,
        landingErrorM: Infinity, clearanceErrorM: Infinity, targetClearanceM: null,
        warnings: ["Stored shot has no modeled landing, so trajectory tuning was skipped."], changed: false,
        feasible: false, evaluations: 0,
      };
    }

    const minSpeedMps = Math.max(0.1, finite(options.minSpeedMps, 1));
    const maxSpeedMps = Math.max(minSpeedMps + 0.01, finite(options.maxSpeedMps, 20));
    const desiredSpeedMps = clamp(original.speedMps * (1 + tuning.speedPct / 100), minSpeedMps, maxSpeedMps);
    const desiredSpinRps = original.spinRps * (1 + tuning.spinPct / 100);
    const targetLanding = basePrediction.landing;
    const warnings = [];
    const clearanceRequested = Math.abs(tuning.clearancePct) > 1e-9;
    let targetClearanceM = clearanceRequested || options.preserveClearance
      ? basePrediction?.net?.clearanceM ?? null
      : null;
    if (clearanceRequested && basePrediction?.net?.crossed && Number.isFinite(targetClearanceM)) {
      const requestedClearanceM = targetClearanceM * (1 + tuning.clearancePct / 100);
      const minNetClearanceM = Math.max(0, finite(options.minNetClearanceM, 0.002));
      targetClearanceM = Math.max(minNetClearanceM, requestedClearanceM);
      if (requestedClearanceM < minNetClearanceM - 1e-9) {
        warnings.push(`Net-clearance tuning is limited to ${(minNetClearanceM * 100).toFixed(1)} cm above the net to avoid numerical net contact.`);
      }
    } else if (clearanceRequested) {
      warnings.push("This shot does not have a usable modeled net clearance, so the clearance adjustment was skipped.");
      targetClearanceM = null;
    }
    const solution = solveShotGoals(
      { ...original, speedMps: desiredSpeedMps, spinRps: desiredSpinRps },
      { targetLanding, targetClearanceM, desiredSpeedMps, desiredSpinRps },
      predict,
      { ...options, minSpeedMps, maxSpeedMps }
    );

    if (!solution?.prediction || !solution.params) {
      return {
        params: { ...original }, basePrediction, prediction: basePrediction,
        landingErrorM: Infinity, clearanceErrorM: Infinity, targetClearanceM,
        warnings: [...warnings, "No stable adjusted trajectory was found; the stored shot is used unchanged."], changed: false,
        feasible: false, evaluations: 0,
      };
    }

    const params = {
      ...original,
      speedMps: finite(solution.params?.speedMps, desiredSpeedMps),
      spinRps: finite(solution.params?.spinRps, desiredSpinRps),
      elevationDeg: finite(solution.params?.elevationDeg, original.elevationDeg),
      aimDeg: finite(solution.params?.aimDeg, original.aimDeg),
    };
    const prediction = solution.prediction;
    const clearanceErrorM = targetClearanceM != null && prediction?.net?.clearanceM != null
      ? prediction.net.clearanceM - targetClearanceM
      : 0;

    const solvedLandingErrorM = landingErrorM(prediction, targetLanding);
    if (solvedLandingErrorM > finite(options.landingToleranceM, 0.04)) {
      warnings.push(`Combined solver misses the requested landing by ${(solvedLandingErrorM * 100).toFixed(1)} cm.`);
    }
    if (Math.abs(tuning.clearancePct) > 1e-9 && Math.abs(clearanceErrorM) > finite(options.clearanceToleranceM, 0.01)) {
      warnings.push(`Best adjusted trajectory misses the requested clearance by ${(Math.abs(clearanceErrorM) * 100).toFixed(1)} cm.`);
    }

    return {
      params,
      basePrediction,
      prediction,
      landingErrorM: solvedLandingErrorM,
      clearanceErrorM,
      targetClearanceM,
      desiredSpeedMps,
      desiredSpinRps,
      evaluations: solution.evaluations,
      warnings,
      changed: tuningActive || Boolean(options.forceSolve),
      feasible: !prediction?.net?.hit && solvedLandingErrorM <= finite(options.maximumLandingErrorM, .12),
    };
  }

  function applyTuningToShotList(shots, inputTuning, predict, options = {}) {
    const list = Array.isArray(shots) ? shots : [];
    return list.map(shot => ({
      shot,
      adjustment: applyShotTuning(shot?.params || {}, inputTuning, predict, options),
    }));
  }

  return {
    TUNING_SPECS,
    DEFAULT_TUNING,
    normalizeTuning,
    hasActiveTuning,
    delayWithPace,
    solveShotGoals,
    applyShotTuning,
    applyTuningToShotList,
  };
});
