const assert = require('assert');
const Variation = require('./shot-variation.js');

function analyticPrediction(params) {
  const { speedMps: v, spinRps: w, elevationDeg: e, aimDeg: a } = params;
  return {
    landing: {
      x: 0.22 * v - 0.006 * w + 0.035 * e + 0.00008 * a * a,
      y: 0.032 * a + 0.0015 * w,
    },
    net: {
      crossed: true,
      hit: false,
      clearanceM: 0.008 * v + 0.0007 * w + 0.013 * e,
    },
    table: { length: 2.74, width: 1.525 },
  };
}

const base = { speedMps: 7, spinRps: 18, elevationDeg: 10, aimDeg: 0 };
const nominal = analyticPrediction(base);
const clearanceCm = nominal.net.clearanceM * 100;
const config = {
  enabled: true,
  placement: { depthCm: 8, lateralCm: 10 },
  clearance: { minCm: clearanceCm, maxCm: clearanceCm },
  speed: { minMps: 5.5, maxMps: 8.5 },
  spin: { minRps: 5, maxRps: 32 },
};

const prepared = Variation.prepare(base, config, analyticPrediction);
assert(prepared.ok, prepared.reason);
const invalidServe = Variation.prepare(base, config, params => ({ ...analyticPrediction(params), serve: { valid: false } }));
assert(!invalidServe.ok, 'serve variation must reject trajectories without a legal second bounce');
const netContact = Variation.prepare(base, config, params => ({
  ...analyticPrediction(params), status: 'net', net: { ...analyticPrediction(params).net, hit: true },
}));
assert(!netContact.ok, 'variation must reject a trajectory that physically contacts the net');
const edgeContact = Variation.prepare(base, config, params => ({ ...analyticPrediction(params), status: 'edge' }));
assert(!edgeContact.ok, 'variation must reject a table-edge contact');
const hardwareRejected = Variation.prepare(base, config, params => ({ ...analyticPrediction(params), hardwareRepresentable: false }));
assert(!hardwareRejected.ok, 'variation must reject commands outside the calibrated Nova actuator envelope');
const servePrepared = Variation.prepare(base, config, params => {
  const prediction = analyticPrediction(params);
  return { ...prediction, secondBounce: { x: prediction.landing.x + .5, y: prediction.landing.y - .1 }, serve: { valid: true } };
});
assert(servePrepared.ok, servePrepared.reason);
assert(Math.abs(servePrepared.baseOutcome[0] - (nominal.landing.x + .5)) < 1e-9, 'serve variation must target the receiver-side bounce');
assert(Math.abs(servePrepared.baseOutcome[1] - (nominal.landing.y - .1)) < 1e-9, 'serve lateral target must use the receiver-side bounce');
assert.strictEqual(prepared.evaluations, 5, 'preparation must use one base + four finite-difference evaluations');
assert(Math.abs(prepared.tangent.reduce((sum, value) => sum + value * value, 0) - 1) < 1e-9);

const batch = Variation.sampleMany(prepared, 240, analyticPrediction, Variation.createRng(12345), {
  attempts: 4,
  maxIterations: 7,
  landingToleranceM: 0.002,
  clearanceToleranceM: 0.0008,
});
assert(batch.results.length >= 225, `expected high acceptance, got ${batch.results.length}/240`);

let minSpeed = Infinity, maxSpeed = -Infinity, minSpin = Infinity, maxSpin = -Infinity;
let positivePhase = 0, negativePhase = 0;
for (const result of batch.results) {
  assert(result.landingErrorM <= 0.002 + 1e-12, `landing error ${result.landingErrorM}`);
  assert(result.clearanceErrorM <= 0.0008 + 1e-12, `clearance error ${result.clearanceErrorM}`);
  assert(result.params.speedMps >= config.speed.minMps - 1e-9 && result.params.speedMps <= config.speed.maxMps + 1e-9);
  assert(result.params.spinRps >= config.spin.minRps - 1e-9 && result.params.spinRps <= config.spin.maxRps + 1e-9);
  minSpeed = Math.min(minSpeed, result.params.speedMps);
  maxSpeed = Math.max(maxSpeed, result.params.speedMps);
  minSpin = Math.min(minSpin, result.params.spinRps);
  maxSpin = Math.max(maxSpin, result.params.spinRps);
  if (result.phase > 0) positivePhase += 1;
  if (result.phase < 0) negativePhase += 1;
}
assert(maxSpeed - minSpeed > 0.35, 'free manifold sampling should vary speed');
assert(maxSpin - minSpin > 2, 'free manifold sampling should vary spin');
assert(positivePhase > 60 && negativePhase > 60, 'both manifold directions should be sampled');
assert(batch.evaluations / batch.results.length < 10, `evaluation budget too high: ${batch.evaluations / batch.results.length}`);

const rectangleConfig = {
  ...config,
  placement: { depthMinCm: 35, depthMaxCm: 48, lateralMinCm: -6, lateralMaxCm: 8 },
};
const rectanglePrepared = Variation.prepare(base, rectangleConfig, analyticPrediction);
assert(rectanglePrepared.ok, rectanglePrepared.reason);
const rectangleBatch = Variation.sampleMany(rectanglePrepared, 80, analyticPrediction, Variation.createRng(2468), {
  attempts: 5, maxIterations: 7, landingToleranceM: 0.003, clearanceToleranceM: 0.001,
});
assert(rectangleBatch.results.length >= 65, `expected usable rectangle acceptance, got ${rectangleBatch.results.length}/80`);
for (const result of rectangleBatch.results) {
  const depthCm = (result.target.landing.x - 1.37) * 100;
  const lateralCm = result.target.landing.y * 100;
  assert(depthCm >= 35 && depthCm <= 48, `rectangle depth target ${depthCm}`);
  assert(lateralCm >= -6 && lateralCm <= 8, `rectangle lateral target ${lateralCm}`);
}

const launchConfig = {
  ...config,
  mode: 'launch',
  speed: { minMps: 6.5, maxMps: 7.5 },
  spin: { minRps: 10, maxRps: 24 },
  launch: { minElevationDeg: 7, maxElevationDeg: 13, minAimDeg: -8, maxAimDeg: 6 },
};
const launchPrepared = Variation.prepare(base, launchConfig, analyticPrediction);
assert(launchPrepared.ok, launchPrepared.reason);
assert.strictEqual(launchPrepared.preparationEvaluations, 1, 'launch intervals only need the nominal preparation evaluation');
const launchBatch = Variation.sampleMany(launchPrepared, 120, analyticPrediction, Variation.createRng(4321), { attempts: 5 });
assert.strictEqual(launchBatch.results.length, 120, 'valid launch intervals should produce direct samples');
for (const result of launchBatch.results) {
  assert(result.params.speedMps >= 6.5 && result.params.speedMps <= 7.5);
  assert(result.params.spinRps >= 10 && result.params.spinRps <= 24);
  assert(result.params.elevationDeg >= 7 && result.params.elevationDeg <= 13);
  assert(result.params.aimDeg >= -8 && result.params.aimDeg <= 6);
}

// Broad requested ranges are an allowed set, not a demand to sample the
// impossible Cartesian product uniformly. Preparation independently projects
// known-valid support onto each variable and retains a valid fallback.
const supportParams = [
  { speedMps: 6.6, spinRps: 12, elevationDeg: 9, aimDeg: -4 },
  { speedMps: 7.0, spinRps: 18, elevationDeg: 10, aimDeg: 0 },
  { speedMps: 7.4, spinRps: 24, elevationDeg: 11, aimDeg: 4 },
];
const support = supportParams.map(params => ({ params, outcome: (() => {
  const p = analyticPrediction(params);
  return [p.landing.x, p.landing.y, p.net.clearanceM];
})() }));
const broadLaunch = {
  ...launchConfig,
  speed: { minMps: 1, maxMps: 20 }, spin: { minRps: -120, maxRps: 120 },
  launch: { minElevationDeg: -20, maxElevationDeg: 45, minAimDeg: -60, maxAimDeg: 60 },
};
const narrowSupported = Variation.prepare(base, launchConfig, analyticPrediction, { feasibleSamples: support });
const broadSupported = Variation.prepare(base, broadLaunch, analyticPrediction, { feasibleSamples: support });
assert(broadSupported.feasibleSamples.length >= narrowSupported.feasibleSamples.length,
  'widening intervals must never remove previously feasible support');
assert.deepStrictEqual(broadSupported.feasibleControlRanges.speedMps, [6.6, 7.4]);
assert.deepStrictEqual(broadSupported.feasibleControlRanges.spinRps, [12, 24]);

const exactSeed = support[1];
const sparseEvaluator = params => Object.keys(params).every(key => Math.abs(params[key] - exactSeed.params[key]) < 1e-12)
  ? analyticPrediction(params) : null;
const sparsePrepared = Variation.prepare(exactSeed.params, broadLaunch, sparseEvaluator, { feasibleSamples: [exactSeed] });
const sparseSample = Variation.sample(sparsePrepared, sparseEvaluator, Variation.createRng(99));
assert(sparseSample, 'a broad interval with known valid support must sample from its internal feasible projection');
assert.deepStrictEqual(sparseSample.params, exactSeed.params);

// An impossible exact clearance must fail rather than be clamped onto a command boundary.
const impossible = Variation.prepare(base, {
  ...config,
  clearance: { minCm: 70, maxCm: 70 },
}, analyticPrediction);
assert(impossible.ok);
const failed = Variation.sample(impossible, analyticPrediction, Variation.createRng(7), { attempts: 3, maxIterations: 6 });
assert.strictEqual(failed, null, 'infeasible targets must be rejected');
const beforeImpossible = impossible.evaluations;
Variation.sample(impossible, analyticPrediction, Variation.createRng(8), {
  attempts: 12,
  maxIterations: 12,
  maxEvaluations: 11,
});
assert(impossible.evaluations - beforeImpossible <= 11, 'per-shot trajectory evaluation budget must be a hard cap');

const started = performance.now();
const profilePrepared = Variation.prepare(base, config, analyticPrediction);
const profile = Variation.sampleMany(profilePrepared, 1000, analyticPrediction, Variation.createRng(9981), { attempts: 4, maxIterations: 7 });
const elapsed = performance.now() - started;
assert(profile.results.length >= 930);
assert(elapsed < 1000, `pure solver benchmark unexpectedly slow: ${elapsed.toFixed(1)} ms`);

console.log('Shot variation self-test PASS');
console.log(JSON.stringify({
  accepted: batch.results.length,
  requested: 240,
  evaluationsPerAcceptedShot: Number((batch.evaluations / batch.results.length).toFixed(2)),
  speedRangeMps: [Number(minSpeed.toFixed(3)), Number(maxSpeed.toFixed(3))],
  spinRangeRps: [Number(minSpin.toFixed(3)), Number(maxSpin.toFixed(3))],
  analyticProfile: {
    requested: 1000,
    accepted: profile.results.length,
    elapsedMs: Number(elapsed.toFixed(2)),
    microsecondsPerShot: Number((elapsed * 1000 / profile.results.length).toFixed(2)),
  },
}, null, 2));
