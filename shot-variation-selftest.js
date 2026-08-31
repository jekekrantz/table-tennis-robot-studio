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
