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
    const nominalClearanceCm = finite(nominalClearanceM, 0.08) * 100;
    const clearance = orderedRange(input.clearance?.minCm, input.clearance?.maxCm,
      nominalClearanceCm, nominalClearanceCm);
    const elevation = orderedRange(input.launch?.minElevationDeg, input.launch?.maxElevationDeg,
      DEFAULT_LIMITS.elevationDeg[0], DEFAULT_LIMITS.elevationDeg[1]);
    const aim = orderedRange(input.launch?.minAimDeg, input.launch?.maxAimDeg,
      DEFAULT_LIMITS.aimDeg[0], DEFAULT_LIMITS.aimDeg[1]);
    const rectangleRequested = ["depthMinCm", "depthMaxCm", "lateralMinCm", "lateralMaxCm"]
      .every(key => Number.isFinite(Number(input.placement?.[key])));
    const depthRange = orderedRange(input.placement?.depthMinCm, input.placement?.depthMaxCm, 0, 137);
    const lateralRange = orderedRange(input.placement?.lateralMinCm, input.placement?.lateralMaxCm, -76.25, 76.25);
    return {
      enabled: Boolean(input.enabled),
      mode: input.mode === "launch" ? "launch" : "outcome",
      placement: {
        depthCm: clamp(Math.abs(finite(input.placement?.depthCm, 15)), 0, 120),
        lateralCm: clamp(Math.abs(finite(input.placement?.lateralCm, 20)), 0, 120),
        ...(rectangleRequested ? {
          depthMinCm: clamp(depthRange[0], 0, 500),
          depthMaxCm: clamp(depthRange[1], 0, 500),
          lateralMinCm: clamp(lateralRange[0], -250, 250),
          lateralMaxCm: clamp(lateralRange[1], -250, 250),
        } : {}),
      },
      clearance: {
        minCm: clamp(clearance[0], -30, 100),
        maxCm: clamp(clearance[1], -30, 100),
      },
      speed: {
        minMps: clamp(speed[0], DEFAULT_LIMITS.speedMps[0], DEFAULT_LIMITS.speedMps[1]),
        maxMps: clamp(speed[1], DEFAULT_LIMITS.speedMps[0], DEFAULT_LIMITS.speedMps[1]),
      },
      spin: {
        minRps: clamp(spin[0], DEFAULT_LIMITS.spinRps[0], DEFAULT_LIMITS.spinRps[1]),
        maxRps: clamp(spin[1], DEFAULT_LIMITS.spinRps[0], DEFAULT_LIMITS.spinRps[1]),
      },
      launch: {
        minElevationDeg: clamp(elevation[0], DEFAULT_LIMITS.elevationDeg[0], DEFAULT_LIMITS.elevationDeg[1]),
        maxElevationDeg: clamp(elevation[1], DEFAULT_LIMITS.elevationDeg[0], DEFAULT_LIMITS.elevationDeg[1]),
        minAimDeg: clamp(aim[0], DEFAULT_LIMITS.aimDeg[0], DEFAULT_LIMITS.aimDeg[1]),
        maxAimDeg: clamp(aim[1], DEFAULT_LIMITS.aimDeg[0], DEFAULT_LIMITS.aimDeg[1]),
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
    if (prediction?.hardwareRepresentable === false) return null;
    if (prediction?.serve && !prediction.serve.valid) return null;
    const landing = prediction?.serve ? prediction.secondBounce : prediction?.landing;
    if (!landing || prediction?.status === "net" || prediction?.status === "edge" || prediction?.net?.hit
      || !prediction?.net?.crossed || !Number.isFinite(prediction.net.clearanceM)) return null;
    if (!prediction.serve && (prediction.onTable === false
      || (prediction.table && (landing.x < prediction.table.length / 2 || landing.x > prediction.table.length
        || Math.abs(landing.y) > prediction.table.width / 2)))) return null;
    return [landing.x, landing.y, prediction.net.clearanceM];
  }

  function inside(value, range) {
    return value >= range[0] - 1e-9 && value <= range[1] + 1e-9;
  }

  function seedInside(seed, variation, baseOutcome, table) {
    if (!seed?.params || !Array.isArray(seed.outcome) || seed.outcome.length !== 3) return false;
    if (!CONTROL_KEYS.every(key => Number.isFinite(Number(seed.params[key])))) return false;
    if (!seed.outcome.every(Number.isFinite)) return false;
    const controlRanges = {
      speedMps: [variation.speed.minMps, variation.speed.maxMps],
      spinRps: [variation.spin.minRps, variation.spin.maxRps],
      elevationDeg: [variation.launch.minElevationDeg, variation.launch.maxElevationDeg],
      aimDeg: [variation.launch.minAimDeg, variation.launch.maxAimDeg],
    };
    if (!CONTROL_KEYS.every(key => inside(seed.params[key], controlRanges[key]))) return false;
    if (variation.mode === "launch") return true;
    const placement = variation.placement;
    const rectangle = Number.isFinite(placement.depthMinCm);
    const placementInside = rectangle
      ? inside((seed.outcome[0] - table.length / 2) * 100, [placement.depthMinCm, placement.depthMaxCm])
        && inside(seed.outcome[1] * 100, [placement.lateralMinCm, placement.lateralMaxCm])
      : Boolean(baseOutcome) && ((seed.outcome[0] - baseOutcome[0]) / Math.max(.0001, placement.depthCm / 100)) ** 2
        + ((seed.outcome[1] - baseOutcome[1]) / Math.max(.0001, placement.lateralCm / 100)) ** 2 <= 1 + 1e-9;
    return placementInside && inside(seed.outcome[2] * 100, [variation.clearance.minCm, variation.clearance.maxCm]);
  }

  function projectedRange(samples, getter) {
    const values = samples.map(getter).filter(Number.isFinite);
    return values.length ? [Math.min(...values), Math.max(...values)] : null;
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

  function supportOnly(prepared, started) {
    if (!prepared.feasibleSamples?.length) return null;
    prepared.supportOnly = true;
    prepared.preparedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
    return prepared;
  }

  function prepare(baseParams, variationInput, evaluate, options = {}) {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const basePrediction = evaluate(baseParams);
    const baseOutcome = outcome(basePrediction);
    const variation = normalizeVariation(variationInput, baseParams, baseOutcome?.[2]);
    const table = basePrediction?.table || { length: 2.74, width: 1.525 };
    const feasibleSamples = (Array.isArray(options.feasibleSamples) ? options.feasibleSamples : [])
      .filter(seed => seedInside(seed, variation, baseOutcome, table))
      .map(seed => ({ params: Object.fromEntries(CONTROL_KEYS.map(key => [key, Number(seed.params[key])])), outcome: seed.outcome.map(Number) }));
    const feasibleControlRanges = Object.fromEntries(CONTROL_KEYS.map(key => [key, projectedRange(feasibleSamples, seed => seed.params[key])]));
    const feasibleOutcomeRanges = [0, 1, 2].map(index => projectedRange(feasibleSamples, seed => seed.outcome[index]));
    if (variation.mode === "launch") return {
      ok: true,
      baseParams: Object.fromEntries(CONTROL_KEYS.map(key => [key, finite(baseParams[key], 0)])),
      baseOutcome,
      basePrediction,
      variation,
      feasibleSamples,
      feasibleControlRanges,
      feasibleOutcomeRanges,
      evaluations: 1,
      preparationEvaluations: 1,
      preparedMs: (typeof performance !== "undefined" ? performance.now() : Date.now()) - started,
    };
    if (!baseOutcome) return { ok: false, reason: "The nominal shot has no usable landing/net crossing." };
    const rectanglePlacement = Number.isFinite(variation.placement.depthMinCm);
    const speedHalfRange = Math.max(0.2, (variation.speed.maxMps - variation.speed.minMps) / 2);
    const spinHalfRange = Math.max(2, (variation.spin.maxRps - variation.spin.minRps) / 2);
    const elevationHalfRange = Math.max(.5, (variation.launch.maxElevationDeg - variation.launch.minElevationDeg) / 2);
    const aimHalfRange = Math.max(.5, (variation.launch.maxAimDeg - variation.launch.minAimDeg) / 2);
    const prepared = {
      ok: true,
      baseParams: Object.fromEntries(CONTROL_KEYS.map(key => [key, finite(baseParams[key], 0)])),
      baseOutcome,
      basePrediction,
      variation,
      feasibleSamples,
      feasibleControlRanges,
      feasibleOutcomeRanges,
      controlScales: [speedHalfRange, spinHalfRange, elevationHalfRange, aimHalfRange],
      controlLimits: {
        speedMps: [variation.speed.minMps, variation.speed.maxMps],
        spinRps: [variation.spin.minRps, variation.spin.maxRps],
        elevationDeg: [variation.launch.minElevationDeg, variation.launch.maxElevationDeg],
        aimDeg: [variation.launch.minAimDeg, variation.launch.maxAimDeg],
      },
      outputScales: [
        Math.max(0.06, rectanglePlacement ? (variation.placement.depthMaxCm - variation.placement.depthMinCm) / 100 : variation.placement.depthCm / 100),
        Math.max(0.06, rectanglePlacement ? (variation.placement.lateralMaxCm - variation.placement.lateralMinCm) / 100 : variation.placement.lateralCm / 100),
        Math.max(0.02, (variation.clearance.maxCm - variation.clearance.minCm) / 100),
      ],
      evaluations: 1,
      preparationEvaluations: 5,
      preparedMs: 0,
    };
    const baseNormalized = [0, 0, 0, 0];
    const jacobian = [[], [], []];
    const step = finite(options.differenceStep, 0.02);
    for (let column = 0; column < 4; column += 1) {
      const shifted = [...baseNormalized];
      shifted[column] += step;
      const result = evaluateNormalized(prepared, shifted, evaluate);
      if (!result) return supportOnly(prepared, started)
        || { ok: false, reason: `Could not differentiate ${CONTROL_KEYS[column]}.` };
      for (let row = 0; row < 3; row += 1) {
        jacobian[row][column] = (result.values[row] - baseOutcome[row]) / step / prepared.outputScales[row];
      }
    }
    const tangent = nullVector3x4(jacobian);
    if (!tangent) return supportOnly(prepared, started)
      || { ok: false, reason: "The nominal shot constraint Jacobian is rank-deficient." };
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
    if (!(phaseMax - phaseMin > 1e-4)) return supportOnly(prepared, started)
      || { ok: false, reason: "Speed/spin ranges leave no free manifold interval around the nominal shot." };
    prepared.phaseRange = [phaseMin, phaseMax];
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    prepared.preparedMs = ended - started;
    return prepared;
  }

  function sampleTarget(prepared, random) {
    if (prepared.feasibleSamples?.length) {
      const seed = prepared.feasibleSamples[Math.min(prepared.feasibleSamples.length - 1,
        Math.floor(random() * prepared.feasibleSamples.length))];
      return [...seed.outcome];
    }
    const placement = prepared.variation.placement;
    const rectangle = Number.isFinite(placement.depthMinCm);
    const angle = rectangle ? 0 : random() * Math.PI * 2;
    const radius = rectangle ? 0 : Math.sqrt(random());
    const depth = placement.depthCm / 100;
    const lateral = placement.lateralCm / 100;
    const minClearance = prepared.variation.clearance.minCm / 100;
    const maxClearance = prepared.variation.clearance.maxCm / 100;
    return [
      rectangle
        ? prepared.basePrediction.table.length / 2 + (placement.depthMinCm + random() * (placement.depthMaxCm - placement.depthMinCm)) / 100
        : prepared.baseOutcome[0] + radius * Math.cos(angle) * depth,
      rectangle
        ? (placement.lateralMinCm + random() * (placement.lateralMaxCm - placement.lateralMinCm)) / 100
        : prepared.baseOutcome[1] + radius * Math.sin(angle) * lateral,
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
    if (prepared.supportOnly && prepared.feasibleSamples?.length) {
      const seed = prepared.feasibleSamples[Math.min(prepared.feasibleSamples.length - 1,
        Math.floor(random() * prepared.feasibleSamples.length))];
      prepared.evaluations += 1;
      const prediction = evaluate(seed.params);
      const actual = outcome(prediction);
      return actual ? {
        params: { ...seed.params }, prediction,
        target: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
        actual: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
        landingErrorM: 0, clearanceErrorM: 0, phase: 0, iterations: 0,
        attempts: 1, evaluations: 1, fallback: true,
      } : null;
    }
    if (prepared.variation.mode === "launch") {
      const variation = prepared.variation;
      const attempts = Math.round(clamp(Math.max(12, finite(options.attempts, 12)), 12, 24));
      const ranges = {
        speedMps: prepared.feasibleControlRanges?.speedMps || [variation.speed.minMps, variation.speed.maxMps],
        spinRps: prepared.feasibleControlRanges?.spinRps || [variation.spin.minRps, variation.spin.maxRps],
        elevationDeg: prepared.feasibleControlRanges?.elevationDeg || [variation.launch.minElevationDeg, variation.launch.maxElevationDeg],
        aimDeg: prepared.feasibleControlRanges?.aimDeg || [variation.launch.minAimDeg, variation.launch.maxAimDeg],
      };
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const params = Object.fromEntries(CONTROL_KEYS.map(key => [key, ranges[key][0] + random() * (ranges[key][1] - ranges[key][0])]));
        prepared.evaluations += 1;
        const prediction = evaluate(params);
        const actual = outcome(prediction);
        if (!actual) continue;
        return {
          params,
          prediction,
          target: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
          actual: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
          landingErrorM: 0,
          clearanceErrorM: 0,
          attempts: attempt + 1,
          evaluations: attempt + 1,
        };
      }
      if (prepared.feasibleSamples?.length) {
        const seed = prepared.feasibleSamples[Math.min(prepared.feasibleSamples.length - 1,
          Math.floor(random() * prepared.feasibleSamples.length))];
        prepared.evaluations += 1;
        const prediction = evaluate(seed.params);
        const actual = outcome(prediction);
        if (actual) return {
          params: { ...seed.params }, prediction,
          target: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
          actual: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
          landingErrorM: 0, clearanceErrorM: 0, attempts, evaluations: attempts + 1,
          fallback: true,
        };
      }
      return null;
    }
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
    if (prepared.feasibleSamples?.length && prepared.evaluations < solveOptions.evaluationDeadline) {
      const seed = prepared.feasibleSamples[Math.min(prepared.feasibleSamples.length - 1,
        Math.floor(random() * prepared.feasibleSamples.length))];
      prepared.evaluations += 1;
      const prediction = evaluate(seed.params);
      const actual = outcome(prediction);
      if (actual) return {
        params: { ...seed.params }, prediction,
        target: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
        actual: { landing: { x: actual[0], y: actual[1] }, clearanceM: actual[2] },
        landingErrorM: 0, clearanceErrorM: 0, phase: 0, iterations: 0,
        attempts, evaluations: prepared.evaluations - startEvaluations, fallback: true,
      };
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
