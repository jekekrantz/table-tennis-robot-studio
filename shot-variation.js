(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ShotVariation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTROL_KEYS = ["speedMps", "spinRps", "elevationDeg", "aimDeg"];
  const DEFAULT_LIMITS = Object.freeze({
    speedMps: Object.freeze([1, 20]),
    spinRps: Object.freeze([-120, 120]),
    elevationDeg: Object.freeze([-20, 45]),
    aimDeg: Object.freeze([-60, 60]),
  });

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  function orderedRange(a, b, fallbackA, fallbackB) {
    const x = finite(a, fallbackA);
    const y = finite(b, fallbackB);
    return x <= y ? [x, y] : [y, x];
  }

  function normalizeVariation(input = {}, baseParams = {}, nominalClearanceM = 0.08) {
    const speed = orderedRange(input.speed?.minMps, input.speed?.maxMps,
      finite(baseParams.speedMps, 6) - 0.6, finite(baseParams.speedMps, 6) + 0.6);
    const spin = orderedRange(input.spin?.minRps, input.spin?.maxRps,
      finite(baseParams.spinRps, 0) - 5, finite(baseParams.spinRps, 0) + 5);
    const clearance = orderedRange(input.clearance?.minCm, input.clearance?.maxCm,
      nominalClearanceM * 100, nominalClearanceM * 100);
    return {
      enabled: Boolean(input.enabled),
      placement: {
        depthCm: clamp(Math.abs(finite(input.placement?.depthCm, 15)), 0, 120),
        lateralCm: clamp(Math.abs(finite(input.placement?.lateralCm, 20)), 0, 120),
      },
      clearance: {
        minCm: clamp(clearance[0], 0.2, 80),
        maxCm: clamp(clearance[1], 0.2, 80),
      },
      speed: {
        minMps: clamp(speed[0], DEFAULT_LIMITS.speedMps[0], DEFAULT_LIMITS.speedMps[1]),
        maxMps: clamp(speed[1], DEFAULT_LIMITS.speedMps[0], DEFAULT_LIMITS.speedMps[1]),
      },
      spin: {
        minRps: clamp(spin[0], DEFAULT_LIMITS.spinRps[0], DEFAULT_LIMITS.spinRps[1]),
        maxRps: clamp(spin[1], DEFAULT_LIMITS.spinRps[0], DEFAULT_LIMITS.spinRps[1]),
      },
    };
  }

  function createRng(seed = 0x9e3779b9) {
    let state = (Number(seed) >>> 0) || 0x9e3779b9;
    return function random() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    };
  }

  function outcome(prediction) {
    if (prediction?.serve && !prediction.serve.valid) return null;
    if (!prediction?.landing || !prediction?.net?.crossed || !Number.isFinite(prediction.net.clearanceM)) return null;
    return [prediction.landing.x, prediction.landing.y, prediction.net.clearanceM];
  }

  function determinant3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
      + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  // Generalized cross product: the cofactors form a null vector of a 3x4 matrix.
  function nullVector3x4(matrix) {
    const vector = [];
    for (let column = 0; column < 4; column += 1) {
      const minor = matrix.map(row => row.filter((_, index) => index !== column));
      vector.push((column % 2 ? -1 : 1) * determinant3(minor));
    }
    const norm = Math.hypot(...vector);
    if (!(norm > 1e-10)) return null;
    const normalized = vector.map(value => value / norm);
    const pivot = normalized.reduce((best, value, index) => Math.abs(value) > Math.abs(normalized[best]) ? index : best, 0);
    return normalized[pivot] < 0 ? normalized.map(value => -value) : normalized;
  }

  function solveLinear(matrix, rhs) {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i]]);
    for (let column = 0; column < n; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < n; row += 1) {
        if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
      }
      if (Math.abs(a[pivot][column]) < 1e-10) return null;
      [a[column], a[pivot]] = [a[pivot], a[column]];
      const divisor = a[column][column];
      for (let j = column; j <= n; j += 1) a[column][j] /= divisor;
      for (let row = 0; row < n; row += 1) {
        if (row === column) continue;
        const factor = a[row][column];
        for (let j = column; j <= n; j += 1) a[row][j] -= factor * a[column][j];
      }
    }
    return a.map(row => row[n]);
  }

  function dot(a, b) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
  }

  function norm(values) {
    return Math.hypot(...values);
  }

  function paramsFromNormalized(prepared, normalized) {
    return Object.fromEntries(CONTROL_KEYS.map((key, index) => [key,
      prepared.baseParams[key] + prepared.controlScales[index] * normalized[index]
    ]));
  }

  function normalizedBounds(prepared) {
    return CONTROL_KEYS.map((key, index) => {
      const [lo, hi] = prepared.controlLimits[key];
      const center = prepared.baseParams[key];
      const scale = prepared.controlScales[index];
      return [(lo - center) / scale, (hi - center) / scale];
    });
  }

  function insideBounds(values, bounds) {
    return values.every((value, index) => value >= bounds[index][0] - 1e-9 && value <= bounds[index][1] + 1e-9);
  }

  function evaluateNormalized(prepared, normalized, evaluate) {
    prepared.evaluations += 1;
    const prediction = evaluate(paramsFromNormalized(prepared, normalized));
    const values = outcome(prediction);
    return values ? { values, prediction } : null;
  }

  function prepare(baseParams, variationInput, evaluate, options = {}) {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const basePrediction = evaluate(baseParams);
    const baseOutcome = outcome(basePrediction);
    if (!baseOutcome) return { ok: false, reason: "The nominal shot has no usable landing/net crossing." };
    const variation = normalizeVariation(variationInput, baseParams, baseOutcome[2]);
    const speedHalfRange = Math.max(0.2, (variation.speed.maxMps - variation.speed.minMps) / 2);
    const spinHalfRange = Math.max(2, (variation.spin.maxRps - variation.spin.minRps) / 2);
    const prepared = {
      ok: true,
      baseParams: Object.fromEntries(CONTROL_KEYS.map(key => [key, finite(baseParams[key], 0)])),
      baseOutcome,
      basePrediction,
      variation,
      controlScales: [speedHalfRange, spinHalfRange, finite(options.elevationScaleDeg, 8), finite(options.aimScaleDeg, 8)],
      controlLimits: {
        speedMps: [variation.speed.minMps, variation.speed.maxMps],
        spinRps: [variation.spin.minRps, variation.spin.maxRps],
        elevationDeg: [...DEFAULT_LIMITS.elevationDeg],
        aimDeg: [...DEFAULT_LIMITS.aimDeg],
      },
      outputScales: [
        Math.max(0.06, variation.placement.depthCm / 100),
        Math.max(0.06, variation.placement.lateralCm / 100),
        Math.max(0.02, (variation.clearance.maxCm - variation.clearance.minCm) / 100),
      ],
      evaluations: 1,
      preparedMs: 0,
    };
    const baseNormalized = [0, 0, 0, 0];
    const jacobian = [[], [], []];
    const step = finite(options.differenceStep, 0.02);
    for (let column = 0; column < 4; column += 1) {
      const shifted = [...baseNormalized];
      shifted[column] += step;
      const result = evaluateNormalized(prepared, shifted, evaluate);
      if (!result) return { ok: false, reason: `Could not differentiate ${CONTROL_KEYS[column]}.` };
      for (let row = 0; row < 3; row += 1) {
        jacobian[row][column] = (result.values[row] - baseOutcome[row]) / step / prepared.outputScales[row];
      }
    }
    const tangent = nullVector3x4(jacobian);
    if (!tangent) return { ok: false, reason: "The nominal shot constraint Jacobian is rank-deficient." };
    prepared.jacobian = jacobian;
    prepared.tangent = tangent;
    prepared.bounds = normalizedBounds(prepared);
    let phaseMin = -1.25;
    let phaseMax = 1.25;
    for (let index = 0; index < 4; index += 1) {
      if (Math.abs(tangent[index]) < 1e-8) continue;
      const candidates = prepared.bounds[index].map(bound => bound / tangent[index]).sort((a, b) => a - b);
      phaseMin = Math.max(phaseMin, candidates[0]);
      phaseMax = Math.min(phaseMax, candidates[1]);
    }
    if (!(phaseMax - phaseMin > 1e-4)) return { ok: false, reason: "Speed/spin ranges leave no free manifold interval around the nominal shot." };
    prepared.phaseRange = [phaseMin, phaseMax];
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    prepared.preparedMs = ended - started;
    return prepared;
  }

  function sampleTarget(prepared, random) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const depth = prepared.variation.placement.depthCm / 100;
    const lateral = prepared.variation.placement.lateralCm / 100;
    const minClearance = prepared.variation.clearance.minCm / 100;
    const maxClearance = prepared.variation.clearance.maxCm / 100;
    return [
      prepared.baseOutcome[0] + radius * Math.cos(angle) * depth,
      prepared.baseOutcome[1] + radius * Math.sin(angle) * lateral,
      minClearance + random() * (maxClearance - minClearance),
    ];
  }

  function physicalResidual(values, target) {
    return {
      landingM: Math.hypot(values[0] - target[0], values[1] - target[1]),
      clearanceM: Math.abs(values[2] - target[2]),
    };
  }

  function solveSample(prepared, target, phase, evaluate, options = {}) {
    const maxIterations = Math.round(clamp(finite(options.maxIterations, 7), 2, 12));
    const evaluationDeadline = finite(options.evaluationDeadline, Infinity);
    const landingToleranceM = finite(options.landingToleranceM, 0.012);
    const clearanceToleranceM = finite(options.clearanceToleranceM, 0.004);
    let point = prepared.tangent.map(value => value * phase);
    if (!insideBounds(point, prepared.bounds)) return null;
    if (prepared.evaluations >= evaluationDeadline) return null;
    let current = evaluateNormalized(prepared, point, evaluate);
    if (!current) return null;
    let jacobian = prepared.jacobian.map(row => [...row]);

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
      const residual3 = current.values.map((value, index) => (value - target[index]) / prepared.outputScales[index]);
      const phaseResidual = dot(point, prepared.tangent) - phase;
      const physical = physicalResidual(current.values, target);
      if (physical.landingM <= landingToleranceM && physical.clearanceM <= clearanceToleranceM && Math.abs(phaseResidual) <= 0.025) {
        return {
          params: paramsFromNormalized(prepared, point),
          prediction: current.prediction,
          target: { landing: { x: target[0], y: target[1] }, clearanceM: target[2] },
          actual: { landing: { x: current.values[0], y: current.values[1] }, clearanceM: current.values[2] },
          landingErrorM: physical.landingM,
          clearanceErrorM: physical.clearanceM,
          phase,
          iterations: iteration,
        };
      }
      if (iteration === maxIterations) break;
      const system = [...jacobian.map(row => [...row]), [...prepared.tangent]];
      const delta = solveLinear(system, [...residual3.map(value => -value), -phaseResidual]);
      if (!delta || norm(delta) > 3.5) return null;

      let accepted = null;
      const oldScore = norm([...residual3, phaseResidual]);
      for (const factor of [1, 0.5, 0.25, 0.125]) {
        if (prepared.evaluations >= evaluationDeadline) return null;
        const candidatePoint = point.map((value, index) => value + factor * delta[index]);
        if (!insideBounds(candidatePoint, prepared.bounds)) continue;
        const candidate = evaluateNormalized(prepared, candidatePoint, evaluate);
        if (!candidate) continue;
        const candidateResidual = candidate.values.map((value, index) => (value - target[index]) / prepared.outputScales[index]);
        const candidatePhase = dot(candidatePoint, prepared.tangent) - phase;
        if (norm([...candidateResidual, candidatePhase]) < oldScore) {
          accepted = { point: candidatePoint, result: candidate, residual: candidateResidual };
          break;
        }
      }
      if (!accepted) return null;

      const dx = accepted.point.map((value, index) => value - point[index]);
      const denominator = dot(dx, dx);
      if (denominator > 1e-10) {
        const oldNormalized = current.values.map((value, index) => value / prepared.outputScales[index]);
        const newNormalized = accepted.result.values.map((value, index) => value / prepared.outputScales[index]);
        const actualChange = newNormalized.map((value, index) => value - oldNormalized[index]);
        const predictedChange = jacobian.map(row => dot(row, dx));
        const correction = actualChange.map((value, index) => value - predictedChange[index]);
        jacobian = jacobian.map((row, rowIndex) => row.map((value, column) => value + correction[rowIndex] * dx[column] / denominator));
      }
      point = accepted.point;
      current = accepted.result;
    }
    return null;
  }

  function sample(prepared, evaluate, random = Math.random, options = {}) {
    if (!prepared?.ok || !prepared.variation?.enabled) return null;
    const attempts = Math.round(clamp(finite(options.attempts, 5), 1, 12));
    const maxEvaluations = Math.round(clamp(finite(options.maxEvaluations, 36), 1, 120));
    const startEvaluations = prepared.evaluations;
    const solveOptions = { ...options, evaluationDeadline: startEvaluations + maxEvaluations };
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (prepared.evaluations >= solveOptions.evaluationDeadline) break;
      const target = sampleTarget(prepared, random);
      const phase = prepared.phaseRange[0] + random() * (prepared.phaseRange[1] - prepared.phaseRange[0]);
      const result = solveSample(prepared, target, phase, evaluate, solveOptions);
      if (result) return { ...result, attempts: attempt + 1, evaluations: prepared.evaluations - startEvaluations };
    }
    return null;
  }

  function sampleMany(prepared, count, evaluate, random = Math.random, options = {}) {
    const results = [];
    const failures = [];
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    for (let index = 0; index < count; index += 1) {
      const result = sample(prepared, evaluate, random, options);
      if (result) results.push(result);
      else failures.push(index);
    }
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      results,
      failures,
      elapsedMs: ended - started,
      evaluations: results.reduce((sum, result) => sum + result.evaluations, 0),
    };
  }

  return Object.freeze({
    constants: Object.freeze({ CONTROL_KEYS: Object.freeze([...CONTROL_KEYS]), DEFAULT_LIMITS }),
    normalizeVariation,
    createRng,
    prepare,
    sample,
    sampleMany,
    _test: Object.freeze({ nullVector3x4, solveLinear }),
  });
});
