#!/usr/bin/env node
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'http://127.0.0.1:8000';

if (!API_KEY) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}
if (!DEFAULT_MODEL) {
  console.error('OPENAI_MODEL is required. Choose a model available to your OpenAI account.');
  process.exit(1);
}

const actionTypes = ['status','heartbeat','wait','raw','start_sequence','active_append','stop'];
const actionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: actionTypes },
    ms: { type: ['number','null'] },
    bytes: { type: ['string','null'] },
    count: { type: ['integer','null'], minimum: 1, maximum: 40 },
    delayMs: { type: ['number','null'], minimum: 0, maximum: 10000 },
    wheelA: { type: ['integer','null'], minimum: 0, maximum: 10000 },
    wheelB: { type: ['integer','null'], minimum: 0, maximum: 10000 },
    pitchDeg: { type: ['number','null'], minimum: -30, maximum: 60 },
    yawPattern: { type: ['array','null'], items: { type: 'number', minimum: -60, maximum: 60 }, maxItems: 20 },
    firstCount: { type: ['integer','null'], minimum: 1, maximum: 40 },
    secondCount: { type: ['integer','null'], minimum: 0, maximum: 40 },
    appendAfterMs: { type: ['number','null'], minimum: 0, maximum: 60000 },
    diagnosticTraffic: { type: ['boolean','null'] }
  },
  required: ['type','ms','bytes','count','delayMs','wheelA','wheelB','pitchDeg','yawPattern','firstCount','secondCount','appendAfterMs','diagnosticTraffic']
};
const testSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 80 },
    title: { type: 'string', minLength: 1, maxLength: 160 },
    purpose: { type: 'string', minLength: 1, maxLength: 800 },
    summary: { type: 'string', minLength: 1, maxLength: 800 },
    heartbeat: { type: 'string', maxLength: 200 },
    expectedDurationMs: { type: 'integer', minimum: 0, maximum: 300000 },
    actions: { type: 'array', minItems: 1, maxItems: 120, items: actionSchema },
    question: { type: 'string', maxLength: 500 },
    answers: { type: 'array', items: { type: 'string', enum: ['yes','no','other'] }, minItems: 1, maxItems: 3 },
    next: {
      type: 'object',
      additionalProperties: false,
      properties: {
        yes: { type: ['string','null'], maxLength: 80 },
        no: { type: ['string','null'], maxLength: 80 },
        other: { type: ['string','null'], maxLength: 80 },
        default: { type: ['string','null'], maxLength: 80 }
      },
      required: ['yes','no','other','default']
    }
  },
  required: ['id','title','purpose','summary','heartbeat','expectedDurationMs','actions','question','answers','next']
};
const advisorSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['explain','propose_test','ask_user','conclude','request_more_telemetry'] },
    message: { type: ['string','null'], maxLength: 2000 },
    question: { type: ['string','null'], maxLength: 800 },
    options: { type: ['array','null'], items: { type: 'string', maxLength: 120 }, maxItems: 8 },
    summary: { type: ['string','null'], maxLength: 2000 },
    test: { anyOf: [{ type: 'null' }, testSchema] }
  },
  required: ['type','message','question','options','summary','test']
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}
function json(res, status, value) {
  cors(res); res.statusCode = status; res.setHeader('content-type','application/json; charset=utf-8'); res.end(JSON.stringify(value));
}
async function readJson(req, limit = 512 * 1024) {
  const chunks=[]; let total=0;
  for await (const chunk of req) { total += chunk.length; if (total > limit) throw new Error('Request too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = http.createServer(async (req,res) => {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode=204; return res.end(); }
  if (req.method === 'GET' && req.url === '/health') return json(res,200,{ok:true});
  if (req.method !== 'POST' || req.url !== '/debug-advisor') return json(res,404,{error:'Not found'});
  try {
    const body=await readJson(req);
    if (!body.session || typeof body.session !== 'object') return json(res,400,{error:'session is required'});
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
    const request = {
      model,
      instructions: 'You are a diagnostic planner for a table-tennis robot protocol investigation. The browser executes hardware actions. Return only the next structured advisor action. Never emit JavaScript. Keep motion tests bounded, short, reversible, and require human Run confirmation in the UI. Prefer software telemetry over asking the user; ask only for physical observations. Raw bytes are allowed only when needed for protocol research.',
      input: JSON.stringify(body.session),
      text: { format: { type:'json_schema', name:'debug_advisor_action', strict:true, schema:advisorSchema } },
      store: true
    };
    if (typeof body.previous_response_id === 'string' && body.previous_response_id) request.previous_response_id = body.previous_response_id;
    const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':`Bearer ${API_KEY}`,'content-type':'application/json'},body:JSON.stringify(request)});
    const raw=await upstream.text();
    if (!upstream.ok) { console.error('OpenAI error', upstream.status); return json(res,502,{error:`OpenAI returned ${upstream.status}`}); }
    const response=JSON.parse(raw);
    const text=response.output_text || (response.output||[]).flatMap(item=>item.content||[]).find(part=>part.type==='output_text')?.text;
    if (!text) return json(res,502,{error:'OpenAI response contained no structured output'});
    const action=JSON.parse(text);
    action._responseId=response.id || null;
    return json(res,200,action);
  } catch (error) {
    console.error(error?.stack || error);
    return json(res,400,{error:error?.message || String(error)});
  }
});
server.listen(PORT,'127.0.0.1',()=>console.log(`OpenAI companion listening on http://127.0.0.1:${PORT}`));
