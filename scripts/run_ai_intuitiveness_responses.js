'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const suite = path.resolve(process.argv[2] || path.join(root, 'evaluation', 'ai-intuitiveness', 'v2'));
const generated = JSON.parse(fs.readFileSync(path.join(suite, 'generated-requests.json'), 'utf8'));
const followupsPath = path.join(suite, 'followup-requests.json');
const outputPath = path.join(suite, 'api-responses.json');
const usagePath = path.join(suite, 'response-usage.json');
const model = process.env.AI_EVAL_MODEL || 'gpt-5.6-luna';
const effort = process.env.AI_EVAL_EFFORT || 'low';
const concurrency = Math.max(1, Math.min(4, Number(process.env.AI_EVAL_CONCURRENCY || 3)));
const codex = '/usr/lib/chatgpt/resources/codex';
const retryKeys = new Set(String(process.env.AI_EVAL_RETRY || '').split(',').map(item => item.trim()).filter(Boolean));
const idPrefix = String(process.env.AI_EVAL_ID_PREFIX || '');

const completed = new Map();
const usageByKey = new Map();
if (fs.existsSync(outputPath)) {
  const prior = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  for (const item of prior.cases || []) completed.set(item.id, item);
}
if (fs.existsSync(usagePath)) {
  const prior = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
  for (const item of prior.cases || []) usageByKey.set(`${item.id}:${item.round || 1}`, item);
}
for (const key of retryKeys) {
  const [id, roundText = '1'] = key.split(':');
  const roundNumber = Number(roundText) || 1;
  const record = completed.get(id);
  if (record) record.rounds = record.rounds.filter(round => (round.round || 1) !== roundNumber);
  usageByKey.delete(`${id}:${roundNumber}`);
}

function workItems() {
  const initial = generated.cases.map(item => ({ id: item.id, round: 1, request: item.request }));
  if (!fs.existsSync(followupsPath)) return initial;
  const followups = JSON.parse(fs.readFileSync(followupsPath, 'utf8'));
  return [...initial, ...(followups.cases || []).map(item => ({ id: item.id, round: item.round || 2, request: item.request }))];
}

function hasResponse(item) {
  return Boolean(completed.get(item.id)?.rounds?.some(round => (round.round || 1) === item.round));
}

function save() {
  const orderedResponses = generated.cases.filter(item => completed.has(item.id)).map(item => completed.get(item.id));
  const orderedUsage = [...usageByKey.values()].map(item => {
    const responseRound = completed.get(item.id)?.rounds?.find(round => (round.round || 1) === item.round);
    return { ...item, model: item.model || responseRound?.model || model, effort: item.effort || responseRound?.effort || effort };
  }).sort((a, b) => generated.cases.findIndex(item => item.id === a.id) - generated.cases.findIndex(item => item.id === b.id) || a.round - b.round);
  fs.writeFileSync(outputPath, `${JSON.stringify({
    format: 'table-tennis-robot-studio/ai-intuitiveness-api-responses',
    formatVersion: 1,
    generationRule: 'Each response was produced from only the corresponding saved request in a fresh ephemeral Luna/low invocation.',
    cases: orderedResponses,
  }, null, 2)}\n`);
  const totals = orderedUsage.reduce((sum, item) => {
    for (const key of ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']) sum[key] += item.usage[key] || 0;
    return sum;
  }, { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 });
  fs.writeFileSync(usagePath, `${JSON.stringify({
    format: 'table-tennis-robot-studio/ai-intuitiveness-response-usage',
    formatVersion: 1,
    configurations: [...new Map(orderedUsage.map(item => [`${item.model}:${item.effort}`, { model: item.model, effort: item.effort }])).values()],
    note: 'Totals cover the recorded suite response calls only. They exclude the parent evaluation task and the separate preflight calibration call.',
    totals,
    cases: orderedUsage,
  }, null, 2)}\n`);
}

function invoke(item) {
  return new Promise((resolve, reject) => {
    const args = [
      '-a', 'never', 'exec', '--ephemeral', '--ignore-rules', '--skip-git-repo-check',
      '-C', '/tmp', '-s', 'read-only', '-m', model,
      '-c', `model_reasoning_effort="${effort}"`, '--json', '-',
    ];
    const child = spawn(codex, args, { cwd: '/tmp', stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`${item.id}: Codex exited ${code}: ${stderr.slice(-1200)}`));
      let response = null;
      let usage = null;
      for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') response = event.item.text;
        if (event.type === 'turn.completed') usage = event.usage;
      }
      if (!response || !usage) return reject(new Error(`${item.id}: incomplete Codex JSON output: ${stderr.slice(-1200)}`));
      resolve({ response, usage });
    });
    child.stdin.end(item.request);
  });
}

async function main() {
  const allWork = workItems();
  const pending = allWork.filter(item => (!idPrefix || item.id.startsWith(idPrefix)) && !hasResponse(item) && (!retryKeys.size || retryKeys.has(`${item.id}:${item.round}`)));
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const item = pending[next++];
      const result = await invoke(item);
      const record = completed.get(item.id) || { id: item.id, rounds: [] };
      record.rounds.push({ round: item.round, model, effort, response: result.response });
      record.rounds.sort((a, b) => a.round - b.round);
      completed.set(item.id, record);
      usageByKey.set(`${item.id}:${item.round}`, { id: item.id, round: item.round, model, effort, usage: result.usage });
      save();
      process.stdout.write(`[${allWork.length - pending.length + next}/${allWork.length}] ${item.id} round ${item.round}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  save();
  console.log(`Saved ${[...completed.values()].reduce((sum, item) => sum + item.rounds.length, 0)} isolated response rounds and usage records.`);
}

main().catch(error => {
  save();
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
