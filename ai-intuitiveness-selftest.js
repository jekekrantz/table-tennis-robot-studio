'use strict';

const assert = require('assert');
const Eval = require('./scripts/ai_intuitiveness_eval.js');

const modelPolicy = require('./evaluation/ai-intuitiveness/model-policy.json');
assert.strictEqual(modelPolicy.format, 'table-tennis-robot-studio/ai-intuitiveness-model-policy');
assert.deepStrictEqual(modelPolicy.suiteProfiles.v1.singleConfigurationFallback, { model: 'gpt-5.6-luna', effort: 'low' });
assert.deepStrictEqual(modelPolicy.suiteProfiles.v2.singleConfigurationFallback, { model: 'gpt-5.6-luna', effort: 'medium' });
assert.deepStrictEqual(modelPolicy.suiteProfiles.v3.singleConfigurationFallback, { model: 'gpt-5.6-terra', effort: 'medium' });
assert.deepStrictEqual(modelPolicy.preferredStagePolicy.isolatedApiResponse, {
  model: 'gpt-5.6-luna',
  effort: 'low',
  appliesTo: ['initial requests', 'feasibility follow-up requests'],
  isolation: 'Give the model exactly one saved request string and no other evaluation or app context.'
});
assert.strictEqual(modelPolicy.preferredStagePolicy.diagnosisAndRepair.model, 'gpt-5.6-terra');
assert.strictEqual(modelPolicy.preferredStagePolicy.hardCaseEscalation.model, 'gpt-5.6-sol');

for (const name of ['generateRequests', 'observeResponses', 'applyResponses', 'report', 'buildQualityInput', 'deriveState', 'classifyState']) {
  assert.strictEqual(typeof Eval[name], 'function', `Missing reusable evaluator function: ${name}`);
}

console.log('AI intuitiveness reusable procedure self-test PASS');
