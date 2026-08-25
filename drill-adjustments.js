(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrillAdjustments = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TUNING_SPECS = Object.freeze({
    pacePct: Object.freeze({ step: 5, min: -50, max: 100 }),
    clearancePct: Object.freeze({ step: 5, min: -100, max: 200 }),
    spinPct: Object.freeze({ step: 5, min: -100, max: 300 }),
    speedPct: Object.freeze({ step: 2, min: -50, max: 50 }),
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

  function elevationCandidate(params, elevationDeg, predict, targetLanding) {
    const candidate = { ...params, elevationDeg };
    const prediction = safePredict(predict, candidate);
    const error = landingErrorM(prediction, targetLanding);
    const netPenalty = prediction?.net?.hit ? 2 : 0;
    const missingPenalty = Number.isFinite(error) ? 0 : 100;
    return { params: candidate, prediction, landingErrorM: error, score: (Number.isFinite(error) ? error : 10) + netPenalty + missingPenalty };
  }

  function solveElevationForLanding(params, targetLanding, predict, options = {}) {
    const minElevationDeg = finite(options.minElevationDeg, -20);
    const maxElevationDeg = finite(options.maxElevationDeg, 30);
    const lo = Math.min(minElevationDeg, maxElevationDeg);
    const hi = Math.max(minElevationDeg, maxElevationDeg);
    const coarseStepDeg = clamp(finite(options.coarseStepDeg, 1), 0.25, 5);

    let best = null;
    for (let elevation = lo; elevation <= hi + 1e-9; elevation += coarseStepDeg) {
      const result = elevationCandidate(params, elevation, predict, targetLanding);
      if (!best || result.score < best.score) best = result;
    }
    if (!best) return null;

    let left = Math.max(lo, best.params.elevationDeg - coarseStepDeg * 1.5);
    let right = Math.min(hi, best.params.elevationDeg + coarseStepDeg * 1.5);
    for (let iteration = 0; iteration < 14 && right - left > 0.001; iteration += 1) {
      const m1 = left + (right - left) / 3;
      const m2 = right - (right - left) / 3;
      const r1 = elevationCandidate(params, m1, predict, targetLanding);
      const r2 = elevationCandidate(params, m2, predict, targetLanding);
      if (r1.score <= r2.score) {
        right = m2;
        if (r1.score < best.score) best = r1;
      } else {
        left = m1;
        if (r2.score < best.score) best = r2;
      }
    }
    const midpoint = elevationCandidate(params, (left + right) / 2, predict, targetLanding);
    if (midpoint.score < best.score) best = midpoint;
    return best;
  }

  function clearanceAtSolution(speedMps, spinPerSpeed, baseParams, targetLanding, predict, options) {
    const params = {
      ...baseParams,
      speedMps,
      spinRps: spinPerSpeed * speedMps,
    };
    const landingSolution = solveElevationForLanding(params, targetLanding, predict, options);
    if (!landingSolution?.prediction?.net?.crossed || landingSolution.prediction.net.clearanceM == null) {
      return { ...landingSolution, clearanceM: null, clearanceErrorM: Infinity };
    }
    return { ...landingSolution, clearanceM: landingSolution.prediction.net.clearanceM };
  }

  function solveClearanceAndLanding(baseParams, desiredSpeedMps, desiredSpinRps, targetLanding, targetClearanceM, predict, options = {}) {
    const minSpeedMps = Math.max(0.1, finite(options.minSpeedMps, desiredSpeedMps * 0.65));
    const maxSpeedMps = Math.max(minSpeedMps + 0.01, finite(options.maxSpeedMps, desiredSpeedMps * 1.35));
    // Search the whole supported speed range for clearance changes. Bracket
    // selection still prefers the solution nearest the desired speed, so the
    // wider search is used only when preserving landing/clearance requires it.
    const lo = minSpeedMps;
    const hi = maxSpeedMps;
    const spinPerSpeed = Math.abs(desiredSpeedMps) > 1e-9 ? desiredSpinRps / desiredSpeedMps : 0;
    const samples = [];
    const sampleCount = 41;

    for (let i = 0; i < sampleCount; i += 1) {
      const speed = sampleCount === 1 ? desiredSpeedMps : lo + (hi - lo) * i / (sampleCount - 1);
      const solution = clearanceAtSolution(speed, spinPerSpeed, baseParams, targetLanding, predict, options);
      if (!solution?.prediction || solution.clearanceM == null || !Number.isFinite(solution.landingErrorM)) continue;
      solution.speedMps = speed;
      solution.clearanceErrorM = solution.clearanceM - targetClearanceM;
      samples.push(solution);
    }

    const atDesired = clearanceAtSolution(clamp(desiredSpeedMps, minSpeedMps, maxSpeedMps), spinPerSpeed, baseParams, targetLanding, predict, options);
    if (atDesired?.prediction && atDesired.clearanceM != null && Number.isFinite(atDesired.landingErrorM)) {
      atDesired.speedMps = clamp(desiredSpeedMps, minSpeedMps, maxSpeedMps);
      atDesired.clearanceErrorM = atDesired.clearanceM - targetClearanceM;
      samples.push(atDesired);
    }
    if (!samples.length) return null;

    samples.sort((a, b) => a.speedMps - b.speedMps);
    let best = samples.reduce((a, b) => {
      const scoreA = Math.abs(a.clearanceErrorM) + 0.25 * a.landingErrorM;
      const scoreB = Math.abs(b.clearanceErrorM) + 0.25 * b.landingErrorM;
      if (Math.abs(scoreA - scoreB) < 1e-6) return Math.abs(a.speedMps - desiredSpeedMps) <= Math.abs(b.speedMps - desiredSpeedMps) ? a : b;
      return scoreA <= scoreB ? a : b;
    });

    const brackets = [];
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1];
      const b = samples[i];
      if (a.clearanceErrorM === 0 || b.clearanceErrorM === 0 || a.clearanceErrorM * b.clearanceErrorM < 0) {
        brackets.push([a, b]);
      }
    }
    if (!brackets.length) return best;

    let [left, right] = brackets.reduce((chosen, pair) => {
      if (!chosen) return pair;
      const pairDistance = Math.abs((pair[0].speedMps + pair[1].speedMps) / 2 - desiredSpeedMps);
      const chosenDistance = Math.abs((chosen[0].speedMps + chosen[1].speedMps) / 2 - desiredSpeedMps);
      return pairDistance < chosenDistance ? pair : chosen;
    }, null);

    for (let iteration = 0; iteration < 14; iteration += 1) {
      const speed = (left.speedMps + right.speedMps) / 2;
      const mid = clearanceAtSolution(speed, spinPerSpeed, baseParams, targetLanding, predict, options);
      if (!mid?.prediction || mid.clearanceM == null || !Number.isFinite(mid.landingErrorM)) break;
      mid.speedMps = speed;
      mid.clearanceErrorM = mid.clearanceM - targetClearanceM;
      if (Math.abs(mid.clearanceErrorM) + 0.25 * mid.landingErrorM < Math.abs(best.clearanceErrorM) + 0.25 * best.landingErrorM) best = mid;
      if (Math.abs(mid.clearanceErrorM) < 0.0001) break;
      if (left.clearanceErrorM * mid.clearanceErrorM <= 0) right = mid;
      else left = mid;
    }
    return best;
  }

  function applyShotTuning(baseParams, inputTuning, predict, options = {}) {
    const tuning = normalizeTuning(inputTuning);
    const original = {
      speedMps: finite(baseParams?.speedMps, 8),
      spinRps: finite(baseParams?.spinRps, 0),
      elevationDeg: finite(baseParams?.elevationDeg, 4),
      aimDeg: finite(baseParams?.aimDeg, 0),
    };
    if (!hasActiveTuning({ ...tuning, pacePct: 0 })) {
      const prediction = safePredict(predict, original);
      return {
        params: { ...original },
        basePrediction: prediction,
        prediction,
        landingErrorM: 0,
        clearanceErrorM: 0,
        targetClearanceM: prediction?.net?.clearanceM ?? null,
        warnings: [],
        changed: false,
      };
    }

    const basePrediction = safePredict(predict, original);
    if (!basePrediction?.landing) {
      return {
        params: { ...original }, basePrediction, prediction: basePrediction,
        landingErrorM: Infinity, clearanceErrorM: Infinity, targetClearanceM: null,
        warnings: ["Stored shot has no modeled landing, so trajectory tuning was skipped."], changed: false,
      };
    }

    const minSpeedMps = Math.max(0.1, finite(options.minSpeedMps, 1));
    const maxSpeedMps = Math.max(minSpeedMps + 0.01, finite(options.maxSpeedMps, 20));
    const desiredSpeedMps = clamp(original.speedMps * (1 + tuning.speedPct / 100), minSpeedMps, maxSpeedMps);
    const desiredSpinRps = original.spinRps * (1 + tuning.spinPct / 100);
    const targetLanding = basePrediction.landing;
    const warnings = [];
    let solution = null;
    let targetClearanceM = basePrediction?.net?.clearanceM ?? null;

    if (Math.abs(tuning.clearancePct) > 1e-9 && basePrediction?.net?.crossed && Number.isFinite(targetClearanceM)) {
      const requestedClearanceM = targetClearanceM * (1 + tuning.clearancePct / 100);
      const minNetClearanceM = Math.max(0, finite(options.minNetClearanceM, 0.002));
      targetClearanceM = Math.max(minNetClearanceM, requestedClearanceM);
      if (requestedClearanceM < minNetClearanceM - 1e-9) {
        warnings.push(`Net-clearance tuning is limited to ${(minNetClearanceM * 100).toFixed(1)} cm above the net to avoid numerical net contact.`);
      }
      solution = solveClearanceAndLanding(
        original,
        desiredSpeedMps,
        desiredSpinRps,
        targetLanding,
        targetClearanceM,
        predict,
        { ...options, minSpeedMps, maxSpeedMps }
      );
      if (!solution) warnings.push("Could not solve the requested net-clearance adjustment; speed/spin tuning was used instead.");
    } else if (Math.abs(tuning.clearancePct) > 1e-9) {
      warnings.push("This shot does not have a usable modeled net clearance, so the clearance adjustment was skipped.");
    }

    if (!solution) {
      solution = solveElevationForLanding(
        { ...original, speedMps: desiredSpeedMps, spinRps: desiredSpinRps },
        targetLanding,
        predict,
        options
      );
    }

    if (!solution?.prediction || !Number.isFinite(solution.landingErrorM)) {
      return {
        params: { ...original }, basePrediction, prediction: basePrediction,
        landingErrorM: Infinity, clearanceErrorM: Infinity, targetClearanceM,
        warnings: [...warnings, "No stable adjusted trajectory was found; the stored shot is used unchanged."], changed: false,
      };
    }

    const params = {
      ...original,
      speedMps: finite(solution.params?.speedMps, desiredSpeedMps),
      spinRps: finite(solution.params?.spinRps, desiredSpinRps),
      elevationDeg: finite(solution.params?.elevationDeg, original.elevationDeg),
      aimDeg: original.aimDeg,
    };
    const prediction = solution.prediction;
    const clearanceErrorM = targetClearanceM != null && prediction?.net?.clearanceM != null
      ? prediction.net.clearanceM - targetClearanceM
      : 0;

    if (solution.landingErrorM > finite(options.landingToleranceM, 0.04)) {
      warnings.push(`Best adjusted trajectory shifts the modeled landing by ${(solution.landingErrorM * 100).toFixed(1)} cm.`);
    }
    if (Math.abs(tuning.clearancePct) > 1e-9 && Math.abs(clearanceErrorM) > finite(options.clearanceToleranceM, 0.01)) {
      warnings.push(`Best adjusted trajectory misses the requested clearance by ${(Math.abs(clearanceErrorM) * 100).toFixed(1)} cm.`);
    }

    return {
      params,
      basePrediction,
      prediction,
      landingErrorM: solution.landingErrorM,
      clearanceErrorM,
      targetClearanceM,
      warnings,
      changed: true,
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
    solveElevationForLanding,
    solveClearanceAndLanding,
    applyShotTuning,
    applyTuningToShotList,
  };
});
