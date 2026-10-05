'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const suite = path.resolve(process.argv[2] || path.join(root, 'evaluation', 'ai-intuitiveness', 'v2'));
const inputPath = path.join(suite, 'quality-input.json');
const idPrefix = String(process.env.AI_EVAL_ID_PREFIX || '');
const outputSuffix = idPrefix ? `-${idPrefix.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}` : '';
const outputPath = path.join(suite, `quality-evaluation${outputSuffix}.json`);
const usagePath = path.join(suite, `quality-usage${outputSuffix}.json`);
const model = process.env.AI_EVAL_QUALITY_MODEL || 'gpt-5.6-terra';
const effort = process.env.AI_EVAL_QUALITY_EFFORT || 'medium';
const codex = '/usr/lib/chatgpt/resources/codex';
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (idPrefix) input.cases = (input.cases || []).filter(item => item.id.startsWith(idPrefix));

const requiredIds = new Set((input.cases || []).map(item => item.id));
const prompt = `The JSON below is your entire evaluation input. Do not inspect files, use outside app knowledge, or use prior conversation. Apply its rubric directly to each query, visible context, response rounds, observations, and resulting state.

Return exactly one JSON object with this structure:
{"format":"table-tennis-robot-studio/ai-intuitiveness-quality-evaluation","formatVersion":1,"evaluator":"...","averageQualityScore":0,"cases":[{"id":"...","qualityScore":0,"rationale":"..."}],"prioritizedIssues":[{"rank":1,"issue":"...","earliestStage":"...","severity":0,"affectedCases":["case-id"]}]}

Include every case exactly once. Use numeric scores from 0 through 10. Give a concise rationale for every case, explicitly mentioning avoidable revision friction when relevant. Do not change or reinterpret the saved binary acceptance classification. If no underlying issues exist, return an empty prioritizedIssues array.

EVALUATION INPUT:
${JSON.stringify(input)}`;

function extractJson(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

function validate(result) {
  if (!result || result.format !== 'table-tennis-robot-studio/ai-intuitiveness-quality-evaluation') throw new Error('Unexpected quality-evaluation format.');
  const cases = Array.isArray(result.cases) ? result.cases : [];
  if (cases.length !== requiredIds.size) throw new Error(`Expected ${requiredIds.size} scored cases, received ${cases.length}.`);
  const seen = new Set();
  for (const item of cases) {
    if (!requiredIds.has(item.id) || seen.has(item.id)) throw new Error(`Unknown or duplicate case ${item.id}.`);
    if (!Number.isFinite(item.qualityScore) || item.qualityScore < 0 || item.qualityScore > 10) throw new Error(`Invalid quality score for ${item.id}.`);
    if (!String(item.rationale || '').trim()) throw new Error(`Missing rationale for ${item.id}.`);
    seen.add(item.id);
  }
  for (const issue of result.prioritizedIssues || []) {
    if (!Number.isFinite(issue.severity) || issue.severity < 0 || issue.severity > 10) throw new Error('Invalid issue severity.');
  }
}

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
child.on('close', code => {
  if (code !== 0) throw new Error(`Quality evaluator exited ${code}: ${stderr.slice(-1600)}`);
  let response = null;
  let usage = null;
  for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') response = event.item.text;
    if (event.type === 'turn.completed') usage = event.usage;
  }
  const result = extractJson(response);
  validate(result);
  result.evaluator = result.evaluator || `${model}/${effort}`;
  result.averageQualityScore = Number((result.cases.reduce((sum, item) => sum + item.qualityScore, 0) / result.cases.length).toFixed(2));
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(usagePath, `${JSON.stringify({
    format: 'table-tennis-robot-studio/ai-intuitiveness-quality-usage',
    formatVersion: 1,
    model,
    effort,
    usage,
  }, null, 2)}\n`);
  console.log(`Saved ${result.cases.length} AI quality scores; average ${result.averageQualityScore}/10.`);
});
child.on('error', error => { throw error; });
child.stdin.end(prompt);
