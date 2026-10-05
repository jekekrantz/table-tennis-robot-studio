'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../studio-features-core.js');
const { loadHeadlessApp } = require('./headless_app_runtime.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SUITE = path.join(ROOT, 'evaluation', 'ai-intuitiveness', 'v1');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function byId(items) {
  return new Map((items || []).map(item => [item.id, item]));
}

function destinationFor(intent, context) {
  if (intent.destination) return intent.destination;
  return context?.appContext?.screen === 'Run drill' ? 'run' : 'editor';
}

function generateRequests(suite) {
  const queries = readJson(path.join(suite, 'queries.json'));
  const contexts = readJson(path.join(suite, 'contexts.json'));
  const contextById = byId(contexts.cases);
  const feasibilityGuide = loadHeadlessApp(ROOT).getAiFeasibilityGuide();
  const cases = queries.cases.map(query => {
    const context = contextById.get(query.id);
    if (!context) throw new Error(`Missing context for ${query.id}`);
    const builtIns = contexts.sharedBuiltIns || [];
    const intent = Core.resolveAssistantIntent(query.query, {
      builtIns,
      hasCurrentDrill: Boolean(context.appContext?.activeDrill),
      currentScreen: context.appContext?.screen,
    });
    return {
      id: query.id,
      query: query.query,
      routedIntent: intent,
      feasibilityGuide,
      request: Core.buildExternalAssistantRequest({
        userRequest: query.query,
        intent,
        currentPlan: context.currentPlan || null,
        appContext: context.appContext,
        actionCatalog: { builtIns },
        feasibilityGuide,
      }),
    };
  });
  const output = {
    format: 'table-tennis-robot-studio/ai-intuitiveness-generated-requests',
    formatVersion: 1,
    generatedBy: 'scripts/ai_intuitiveness_eval.js',
    cases,
  };
  writeJson(path.join(suite, 'generated-requests.json'), output);
  return output;
}

function responseText(record) {
  if (typeof record?.response === 'string') return record.response;
  if (record?.response && typeof record.response === 'object') return JSON.stringify(record.response);
  return '';
}

function deriveState(context, action, observation) {
  const state = { ...context.initialAppState, modal: null };
  if (action.action === 'open_builtin_drill') return { ...state, view: 'run', activeDrillSource: 'builtin', activeDrillId: action.builtInDrillId, phase: 'ready' };
  if (action.action === 'open_screen') return { ...state, view: action.screen, phase: 'ready' };
  if (action.action === 'answer') return { ...state, underlyingView: context.initialAppState.view, view: context.appContext?.screen || context.initialAppState.view, modal: 'ai-assist', returnModal: context.initialAppState.modal || null, phase: 'answer-visible', answer: action.answer };
  const destination = action.destination || destinationFor(action, context);
  if (observation?.feasibility?.valid === false) return { ...state, view: context.initialAppState.view, modal: 'ai-assist', phase: 'revision-required', destination, feasibility: observation.feasibility };
  return {
    ...state,
    view: destination,
    activeDrillSource: 'user',
    activeDrillId: action.action === 'edit_drill' && context.initialAppState.activeDrillSource === 'user' ? context.initialAppState.activeDrillId : `created:${action.drillPlan.name}`,
    phase: observation?.feasibility?.valid === true ? 'ready' : 'proposal-ready-needs-app-feasibility-check',
    drillName: action.drillPlan.name,
    feasibility: observation?.feasibility || null,
  };
}

function generateFollowup(query, context, action, observation, feasibilityGuide = null) {
  if (!['create_drill', 'edit_drill'].includes(action.action) || observation?.feasibility?.valid !== false) return null;
  return Core.buildExternalDrillRevisionRequest({
    userRequest: query,
    proposal: action.drillPlan,
    report: observation.feasibility,
    currentPlan: context.currentPlan || null,
    history: [],
    appContext: context.appContext,
    feasibilityGuide,
  });
}

function applyResponses(suite) {
  const queries = readJson(path.join(suite, 'queries.json'));
  const contexts = readJson(path.join(suite, 'contexts.json'));
  const responses = readJson(path.join(suite, 'api-responses.json'));
  const generated = readJson(path.join(suite, 'generated-requests.json'));
  const observationsPath = path.join(suite, 'app-observations.json');
  const observations = fs.existsSync(observationsPath) ? readJson(observationsPath) : { cases: [] };
  const queryById = byId(queries.cases);
  const contextById = byId(contexts.cases);
  const generatedById = byId(generated.cases);
  const observationByKey = new Map((observations.cases || []).map(item => [`${item.id}:${item.round || 1}`, item]));
  const states = [];
  const followups = [];
  for (const responseCase of responses.cases || []) {
    const query = queryById.get(responseCase.id);
    const context = contextById.get(responseCase.id);
    if (!query || !context) throw new Error(`Response ${responseCase.id} has no input case`);
    const rounds = responseCase.rounds || [responseCase];
    for (const round of rounds) {
      const roundNumber = round.round || 1;
      let action = null;
      let parseError = null;
      try {
        action = Core.parseExternalAssistantAction(responseText(round), { builtIns: contexts.sharedBuiltIns || [] });
      } catch (error) {
        const routed = generatedById.get(responseCase.id)?.routedIntent;
        try {
          if (!['create_drill', 'edit_drill'].includes(routed?.action)) throw error;
          action = { format: Core.ASSISTANT_ACTION_FORMAT, formatVersion: Core.ASSISTANT_ACTION_VERSION, action: routed.action, destination: routed.destination, drillPlan: Core.parseExternalIntuitiveDrillResult(responseText(round)) };
        } catch (fallbackError) {
          parseError = fallbackError.message;
        }
      }
      const observation = observationByKey.get(`${responseCase.id}:${roundNumber}`) || null;
      const state = action ? deriveState(context, action, observation) : { ...context.initialAppState, modal: 'ai-assist', phase: 'error-visible', error: parseError };
      states.push({ id: responseCase.id, round: roundNumber, action, parseError, observation, state });
      const followup = action && generateFollowup(query.query, context, action, observation, generatedById.get(responseCase.id)?.feasibilityGuide);
      if (followup) followups.push({ id: responseCase.id, round: roundNumber + 1, responded: rounds.some(candidate => (candidate.round || 1) === roundNumber + 1), request: followup });
    }
  }
  writeJson(path.join(suite, 'app-states.json'), { format: 'table-tennis-robot-studio/ai-intuitiveness-app-states', formatVersion: 1, cases: states });
  writeJson(path.join(suite, 'followup-requests.json'), { format: 'table-tennis-robot-studio/ai-intuitiveness-followup-requests', formatVersion: 1, cases: followups });
  return states;
}

function observeResponses(suite) {
  const contexts = readJson(path.join(suite, 'contexts.json'));
  const responses = readJson(path.join(suite, 'api-responses.json'));
  const generated = readJson(path.join(suite, 'generated-requests.json'));
  const generatedById = byId(generated.cases);
  const app = loadHeadlessApp(ROOT);
  const cases = [];
  for (const responseCase of responses.cases || []) {
    const routed = generatedById.get(responseCase.id)?.routedIntent;
    for (const round of responseCase.rounds || [responseCase]) {
      let action;
      try {
        action = Core.parseExternalAssistantAction(responseText(round), { builtIns: contexts.sharedBuiltIns || [] });
      } catch (error) {
        if (!['create_drill', 'edit_drill'].includes(routed?.action)) continue;
        try {
          action = { action: routed.action, destination: routed.destination, drillPlan: Core.parseExternalIntuitiveDrillResult(responseText(round)) };
        } catch (_) {
          continue;
        }
      }
      if (!['create_drill', 'edit_drill'].includes(action.action)) continue;
      const resolved = app.materializeIntuitiveDrillPlan(action.drillPlan, null);
      cases.push({
        id: responseCase.id,
        round: round.round || 1,
        method: 'Headless Node VM invoking the production runtime bundle materializeIntuitiveDrillPlan function.',
        feasibility: resolved.report,
      });
    }
  }
  const output = {
    format: 'table-tennis-robot-studio/ai-intuitiveness-app-observations',
    formatVersion: 1,
    method: 'The production runtime bundle ran in Node with an inert DOM shim; no browser or GUI interaction was used.',
    cases,
  };
  writeJson(path.join(suite, 'app-observations.json'), output);
  return output;
}

function containsAll(value, required) {
  const text = JSON.stringify(value || '').toLowerCase();
  return (required || []).every(item => text.includes(String(item).toLowerCase()));
}

function classifyState(expectation, item) {
  const reasons = [];
  const action = item.action;
  if (!action) reasons.push(item.parseError || 'No valid action');
  const allowed = expectation.expectedActionOneOf || [expectation.expectedAction];
  if (action && !allowed.includes(action.action)) reasons.push(`Expected ${allowed.join(' or ')}, received ${action.action}`);
  if (action && expectation.expectedDestination && action.destination !== expectation.expectedDestination) reasons.push(`Expected destination ${expectation.expectedDestination}, received ${action.destination || 'none'}`);
  if (action && expectation.expectedBuiltInDrillId && action.builtInDrillId !== expectation.expectedBuiltInDrillId) reasons.push(`Expected built-in ${expectation.expectedBuiltInDrillId}`);
  if (action && expectation.expectedScreen && action.screen !== expectation.expectedScreen) reasons.push(`Expected screen ${expectation.expectedScreen}`);
  if (action && expectation.mustContain && !containsAll(action, expectation.mustContain)) reasons.push(`Response omitted required meaning: ${expectation.mustContain.join(', ')}`);
  if (action?.drillPlan && expectation.mustContainNodeTypes) {
    const types = new Set(action.drillPlan.nodes.map(node => node.type));
    for (const type of expectation.mustContainNodeTypes) if (!types.has(type)) reasons.push(`Drill omitted ${type} node`);
  }
  if (action?.drillPlan && expectation.mustPreserveNodeIds) {
    const ids = new Set(action.drillPlan.nodes.map(node => node.id));
    for (const id of expectation.mustPreserveNodeIds) if (!ids.has(id)) reasons.push(`Edit dropped node ${id}`);
  }
  if (expectation.mustOfferUsefulChoice) {
    const useful = action?.action === 'open_builtin_drill' || (action?.action === 'answer' && containsAll(action.answer, ['footwork']) && /Falkenberg|alternating|two-point/i.test(action.answer));
    if (!useful) reasons.push('Did not open a sensible match or offer concrete footwork choices');
  }
  if (item.state.phase === 'error-visible') reasons.push('The app would show an error');
  if (item.state.phase === 'revision-required') reasons.push('The initial proposal requires an AI feasibility revision');
  if (item.state.phase === 'proposal-ready-needs-app-feasibility-check') reasons.push('No app feasibility observation was recorded');
  return { acceptable: reasons.length === 0, reasons };
}

function report(suite) {
  const expectations = readJson(path.join(suite, 'expectations.json'));
  const states = readJson(path.join(suite, 'app-states.json'));
  const latest = new Map();
  for (const item of states.cases) if (!latest.has(item.id) || latest.get(item.id).round < item.round) latest.set(item.id, item);
  const results = expectations.cases.map(expectation => {
    const item = latest.get(expectation.id);
    if (!item) return { id: expectation.id, category: 'unacceptable', reasons: ['No resulting app state'] };
    const classification = classifyState(expectation, item);
    return { id: expectation.id, category: classification.acceptable ? 'acceptable' : 'unacceptable', reasons: classification.reasons, action: item.action?.action || null, state: item.state.phase };
  });
  const acceptable = results.filter(item => item.category === 'acceptable').length;
  const output = { format: 'table-tennis-robot-studio/ai-intuitiveness-report', formatVersion: 1, summary: { total: results.length, acceptable, unacceptable: results.length - acceptable }, results };
  writeJson(path.join(suite, 'report.json'), output);
  return output;
}

function buildQualityInput(suite) {
  const queries = readJson(path.join(suite, 'queries.json'));
  const contexts = readJson(path.join(suite, 'contexts.json'));
  const expectations = readJson(path.join(suite, 'expectations.json'));
  const generated = readJson(path.join(suite, 'generated-requests.json'));
  const responses = readJson(path.join(suite, 'api-responses.json'));
  const states = readJson(path.join(suite, 'app-states.json'));
  const reportData = readJson(path.join(suite, 'report.json'));
  const maps = {
    context: byId(contexts.cases), expectation: byId(expectations.cases), generated: byId(generated.cases),
    response: byId(responses.cases), result: byId(reportData.results),
  };
  const statesById = new Map();
  for (const item of states.cases || []) {
    if (!statesById.has(item.id)) statesById.set(item.id, []);
    statesById.get(item.id).push(item);
  }
  const summarizeResponse = raw => {
    if (raw && typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw || '')); } catch (_) { return String(raw || '').slice(0, 1200); }
  };
  const summarizeState = item => ({
    round: item.round,
    action: item.action ? { action: item.action.action, destination: item.action.destination, builtInDrillId: item.action.builtInDrillId, screen: item.action.screen } : null,
    parseError: item.parseError,
    phase: item.state?.phase,
    view: item.state?.view,
    feasibility: item.observation?.feasibility ? {
      valid: item.observation.feasibility.valid,
      summary: item.observation.feasibility.summary,
      failedShots: (item.observation.feasibility.shots || []).filter(shot => !shot.feasible).map(shot => ({ id: shot.id, reason: shot.reason })),
      structureErrors: item.observation.feasibility.structureErrors || [],
    } : null,
  });
  const cases = queries.cases.map(query => ({
    id: query.id,
    query: query.query,
    visibleContext: maps.context.get(query.id)?.appContext || null,
    expectedBehavior: maps.expectation.get(query.id) || null,
    routedIntent: maps.generated.get(query.id)?.routedIntent || null,
    responseRounds: (maps.response.get(query.id)?.rounds || []).map(round => ({ round: round.round || 1, model: round.model, effort: round.effort, response: summarizeResponse(round.response) })),
    appStates: (statesById.get(query.id) || []).map(summarizeState),
    binaryResult: maps.result.get(query.id) || null,
  }));
  const output = {
    format: 'table-tennis-robot-studio/ai-intuitiveness-quality-input',
    formatVersion: 1,
    rubric: readJson(path.join(path.dirname(suite), 'quality-rubric.json')),
    instruction: 'Act as an independent UX evaluator. Return one qualityScore 0-10 and concise rationale per case, identify underlying issues, assign each issue severity 0-10, and sort issues by severity, recurrence likelihood, then leverage. Do not alter the binary acceptance result.',
    cases,
  };
  writeJson(path.join(suite, 'quality-input.json'), output);
  return output;
}

function main() {
  const command = process.argv[2] || 'all';
  const suite = path.resolve(process.argv[3] || DEFAULT_SUITE);
  if (!fs.existsSync(suite)) throw new Error(`Suite not found: ${suite}`);
  if (command === 'generate' || command === 'all') generateRequests(suite);
  if (command === 'observe' || command === 'all') observeResponses(suite);
  if (command === 'apply' || command === 'all') applyResponses(suite);
  if (command === 'report' || command === 'all') console.log(JSON.stringify(report(suite).summary));
  if (command === 'quality-input' || command === 'all') buildQualityInput(suite);
}

if (require.main === module) main();

module.exports = { generateRequests, observeResponses, applyResponses, report, buildQualityInput, deriveState, classifyState };
