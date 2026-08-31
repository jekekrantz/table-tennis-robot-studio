(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TTRSFeaturesCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const DRILL_FORMAT='table-tennis-robot-studio/drill';
  const DRILL_VERSION=1;
  const MAX_SHARE_CHARS=12000;
  const MAX_FILE_BYTES=512*1024;
  const MAX_NODES=240;
  const MAX_EDGES=600;
  const MAX_DEBUG_ACTIONS=120;
  const MAX_DEBUG_TEST_MS=5*60*1000;
  const MAX_RAW_BYTES=2048;
  function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function makePortableDrill(drill,meta={}){
    if(!drill||typeof drill!=='object')throw new Error('A drill is required.');
    return {format:DRILL_FORMAT,formatVersion:DRILL_VERSION,name:String(drill.name||'Shared drill').slice(0,90),description:String(drill.description||'').slice(0,600),createdWith:'Table Tennis Robot Studio',createdAt:meta.createdAt||new Date().toISOString(),trainingGoal:meta.trainingGoal||drill.trainingGoal||'',level:meta.level||drill.level||'',instructions:meta.instructions||drill.instructions||'',drill:clone(drill)};
  }
  function validateShotVariation(variation,errors){
    if(!variation?.enabled)return;
    const checks=[
      ['placement.depthCm',variation.placement?.depthCm,0,120],['placement.lateralCm',variation.placement?.lateralCm,0,120],
      ['clearance.minCm',variation.clearance?.minCm,.2,80],['clearance.maxCm',variation.clearance?.maxCm,.2,80],
      ['speed.minMps',variation.speed?.minMps,1,20],['speed.maxMps',variation.speed?.maxMps,1,20],
      ['spin.minRps',variation.spin?.minRps,-120,120],['spin.maxRps',variation.spin?.maxRps,-120,120],
    ];
    for(const [name,value,min,max]of checks){const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)errors.push(`Shot variation ${name} must be ${min}…${max}.`);}
    if(Number(variation.clearance?.minCm)>Number(variation.clearance?.maxCm))errors.push('Shot variation clearance minimum exceeds maximum.');
    if(Number(variation.speed?.minMps)>Number(variation.speed?.maxMps))errors.push('Shot variation speed minimum exceeds maximum.');
    if(Number(variation.spin?.minRps)>Number(variation.spin?.maxRps))errors.push('Shot variation spin minimum exceeds maximum.');
  }
  function validatePortableDrill(data){
    const errors=[];
    if(!data||typeof data!=='object'||Array.isArray(data))errors.push('The file must contain an object.');
    if(data?.format!==DRILL_FORMAT)errors.push(`Expected format ${DRILL_FORMAT}.`);
    if(Number(data?.formatVersion)!==DRILL_VERSION)errors.push(`Unsupported drill format version ${data?.formatVersion??'missing'}.`);
    const d=data?.drill;
    if(!d||typeof d!=='object')errors.push('Missing drill data.');
    const nodes=Array.isArray(d?.nodes)?d.nodes:[];
    const edges=Array.isArray(d?.edges)?d.edges:[];
    if(nodes.length>MAX_NODES)errors.push(`Too many nodes (${nodes.length}; maximum ${MAX_NODES}).`);
    if(edges.length>MAX_EDGES)errors.push(`Too many connections (${edges.length}; maximum ${MAX_EDGES}).`);
    if(!Array.isArray(d?.nodes)||!Array.isArray(d?.edges))errors.push('Drill nodes/connections are malformed.');
    for(const n of nodes){
      if(!['shot','random','drill','counter'].includes(n?.type))errors.push(`Unsupported node type ${String(n?.type)}.`);
      if(n?.type==='shot'){
        const p=n.params||{};
        for(const [key,min,max] of [['speedMps',1,20],['spinRps',-120,120],['elevationDeg',-20,45],['aimDeg',-60,60]]){
          const x=Number(p[key]); if(!Number.isFinite(x)||x<min||x>max)errors.push(`Shot ${key} must be ${min}…${max}.`);
        }
        validateShotVariation(n.variation,errors);
      }
    }
    return {valid:errors.length===0,errors:[...new Set(errors)].slice(0,20)};
  }
  function utf8ToBase64Url(text){
    if(typeof Buffer!=='undefined')return Buffer.from(String(text),'utf8').toString('base64url');
    const bytes=new TextEncoder().encode(String(text));let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function base64UrlToUtf8(encoded){
    if(typeof Buffer!=='undefined')return Buffer.from(String(encoded),'base64url').toString('utf8');
    let s=String(encoded).replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);
  }
  function serializePortableDrill(data){const check=validatePortableDrill(data);if(!check.valid)throw new Error(check.errors[0]);return utf8ToBase64Url(JSON.stringify(data));}
  function deserializePortableDrill(input){if(String(input).length>MAX_SHARE_CHARS*2)throw new Error('Shared drill payload is too large.');let obj;try{obj=JSON.parse(base64UrlToUtf8(String(input)));}catch(e){throw new Error('The shared drill payload is malformed.');}const check=validatePortableDrill(obj);if(!check.valid)throw new Error(check.errors[0]);return obj;}
  function makeShareUrl(data,baseUrl){const payload=serializePortableDrill(data);if(payload.length>MAX_SHARE_CHARS)throw new Error('This drill is too large for a reliable share link. Share the .ttdrill file instead.');const base=String(baseUrl||'').split('#')[0];return `${base}#drill=${payload}`;}
  function parseShareHash(hash){const text=String(hash||'');const m=text.match(/(?:^#|[&#])drill=([^&]+)/);return m?deserializePortableDrill(decodeURIComponent(m[1])):null;}
  function safeFilename(name,ext='.ttdrill'){const base=String(name||'drill').normalize('NFKD').replace(/[^a-zA-Z0-9._ -]+/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,72)||'drill';return `${base}${ext}`;}
  function extractJsonCandidates(text){
    const src=String(text||'').trim();const candidates=[];
    const marked=/TABLE_TENNIS_ROBOT_STUDIO_DRILL_BEGIN\s*([\s\S]*?)\s*TABLE_TENNIS_ROBOT_STUDIO_DRILL_END/gi;let m;while((m=marked.exec(src)))candidates.push(m[1]);
    const fenced=/```(?:json)?\s*([\s\S]*?)```/gi;while((m=fenced.exec(src)))candidates.push(m[1]);
    candidates.push(src);
    // balanced object candidates, bounded to avoid pathological work
    let depth=0,start=-1,inStr=false,esc=false;for(let i=0;i<Math.min(src.length,300000);i++){const ch=src[i];if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue;}if(ch==='"'){inStr=true;continue;}if(ch==='{'){if(depth===0)start=i;depth++;}else if(ch==='}'&&depth){depth--;if(depth===0&&start>=0)candidates.push(src.slice(start,i+1));}}
    return [...new Set(candidates)];
  }
  function parseExternalAiResult(text){
    const valid=[];for(const candidate of extractJsonCandidates(text)){try{const obj=JSON.parse(candidate);const wrapped=obj?.format===DRILL_FORMAT?obj:(obj?.drill&&obj?.formatVersion?obj:null);if(!wrapped)continue;const check=validatePortableDrill(wrapped);if(check.valid)valid.push(wrapped);}catch(_){}}
    if(!valid.length)throw new Error('No valid Table Tennis Robot Studio drill was found in the AI response.');
    return valid[valid.length-1];
  }
  function buildExternalAiRequest({currentDrill=null,userRequest='' }={}){
    const mode=currentDrill?'EDIT':'CREATE';const current=currentDrill?JSON.stringify(makePortableDrill(currentDrill),null,2):'(none — create a new drill)';
    return `This file was generated by Table Tennis Robot Studio.\n\nUpload or paste this entire file into your preferred AI assistant, then describe the drill you want in ordinary table-tennis language. You do not need to understand or edit anything below this line.\n\nTASK MODE: ${mode}\nUSER REQUEST: ${userRequest||'(ask the user what they want)'}\n\nYou are helping a table-tennis player, not a robotics engineer. Interpret ordinary table-tennis language and make sensible assumptions. Ask a question only when genuinely necessary. Never ask for Bluetooth bytes, wheel raw values, PWM, servo values, calibration coefficients, or protocol commands. Preserve unspecified behavior when editing.\n\nTerminology defaults: wide FH/BH = wide forehand/backhand target; elbow = crossover area; deep = toward end line; short = short/double-bounce-style target if feasible; heavy topspin/backspin = strong positive/negative spin; random = controlled stochastic variation; Falkenberg = backhand + forehand-from-backhand + wide forehand movement pattern; match-like = realistic controlled variation rather than chaos.\n\nReturn ONE complete drill in this exact wrapper format and include no executable code:\nTABLE_TENNIS_ROBOT_STUDIO_DRILL_BEGIN\n{\n  "format": "${DRILL_FORMAT}",\n  "formatVersion": 1,\n  "name": "...",\n  "description": "...",\n  "trainingGoal": "...",\n  "level": "beginner|intermediate|advanced",\n  "instructions": "...",\n  "createdWith": "Table Tennis Robot Studio",\n  "drill": {\n    "name": "...", "description": "...", "tags": [], "robotPoseReference":"base_back", "robotPose":{"x":0,"y":0,"yawDeg":0},\n    "startNodeId": "node-id", "settings":{"repetitions":3,"delayBetweenSets":1},\n    "nodes": [{"id":"shot-1","type":"shot","label":"Ball 1","x":300,"y":260,"params":{"speedMps":6,"spinRps":0,"elevationDeg":10,"aimDeg":0}}],\n    "edges": [{"id":"edge-1","source":"shot-1","sourceSlot":"next","target":"shot-2","weight":1,"delaySeconds":1}]\n  }\n}\nTABLE_TENNIS_ROBOT_STUDIO_DRILL_END\n\nConstraints: speedMps 1..20; spinRps -120..120; elevationDeg -20..45; aimDeg -60..60; edge delays 0..3600 s; at most ${MAX_NODES} nodes. A missing outgoing edge ends the sequence. Keep parameters semantic; do not output raw Nova protocol values.\n\nCURRENT DRILL WHEN EDITING:\n${current}\n`;
  }
  function normalizeHexBytes(value){
    if(value instanceof Uint8Array)return value;
    if(Array.isArray(value)){if(value.length>MAX_RAW_BYTES)throw new Error('Raw command is too long.');const out=value.map(Number);if(out.some(n=>!Number.isInteger(n)||n<0||n>255))throw new Error('Raw command bytes must be 0..255.');return Uint8Array.from(out);}
    const clean=String(value||'').replace(/0x/gi,' ').replace(/[^0-9a-fA-F]/g,'');if(clean.length%2)throw new Error('Raw command hex must contain complete bytes.');if(clean.length/2>MAX_RAW_BYTES)throw new Error('Raw command is too long.');const out=[];for(let i=0;i<clean.length;i+=2)out.push(parseInt(clean.slice(i,i+2),16));return Uint8Array.from(out);
  }
  function validateDebugPack(pack){
    const errors=[];if(!pack||typeof pack!=='object')errors.push('Test pack must be an object.');if(!Array.isArray(pack?.tests)||!pack.tests.length)errors.push('Test pack needs at least one test.');if((pack?.tests||[]).length>80)errors.push('Test pack is too large.');const ids=new Set();
    for(const test of pack?.tests||[]){const id=String(test?.id||'');if(!id)errors.push('Every test needs an id.');if(ids.has(id))errors.push(`Duplicate test id ${id}.`);ids.add(id);if(!Array.isArray(test.actions)||test.actions.length>MAX_DEBUG_ACTIONS)errors.push(`${id||'Test'} has too many actions.`);let duration=0;for(const action of test.actions||[]){if(!['status','heartbeat','wait','raw','start_sequence','active_append','stop'].includes(action?.type))errors.push(`${id}: unsupported action ${String(action?.type)}.`);if(action?.type==='wait')duration+=Math.max(0,finite(action.ms,0));if(action?.type==='raw'){try{normalizeHexBytes(action.bytes);}catch(e){errors.push(`${id}: ${e.message}`);}}if(action?.type==='start_sequence'){const count=Math.max(1,Math.trunc(finite(action.count,1)));if(count>40)errors.push(`${id}: sequence count above 40.`);duration+=count*Math.max(667,finite(action.delayMs,1000));}}
      if(duration>MAX_DEBUG_TEST_MS)errors.push(`${id}: estimated duration exceeds 5 minutes.`);
    }
    for(const test of pack?.tests||[]){for(const next of Object.values(test?.next||{})){if(next&&next!=='conclude'&&!ids.has(String(next)))errors.push(`${test.id}: branch target ${next} is missing.`);}}
    return {valid:errors.length===0,errors:[...new Set(errors)]};
  }
  function chooseDebugNext(test,answer){if(!test)return null;const key=String(answer||'').toLowerCase();return test.next?.[key]??test.next?.other??test.next?.default??null;}
  function compactTelemetry(events,{limit=120}={}){
    const list=Array.isArray(events)?events:[];if(list.length<=limit)return clone(list);const keep=[];const head=Math.min(20,list.length);keep.push(...list.slice(0,head));const anomaly=list.filter(e=>e.kind==='error'||e.direction==='error'||e.direction==='warn'||e.kind==='disconnect'||e.kind==='observation');for(const e of anomaly)if(!keep.includes(e))keep.push(e);keep.push(...list.slice(-Math.max(30,limit-keep.length)));return clone(keep.slice(0,limit));
  }
  function validateAdvisorResponse(value){
    const allowed=['explain','propose_test','ask_user','conclude','request_more_telemetry'];if(!value||typeof value!=='object'||!allowed.includes(value.type))return {valid:false,error:'Unsupported advisor action.'};if(value.type==='propose_test'){const check=validateDebugPack({tests:[value.test]});if(!check.valid)return {valid:false,error:check.errors[0]};}return {valid:true,value:clone(value)};
  }
  function debugHandoff(session){return {format:'table-tennis-robot-studio/debug-handoff',version:1,objective:session?.objective||'',currentTestId:session?.currentTestId||null,observations:clone(session?.observations||[]),tests:clone(session?.testsRun||[]),telemetry:compactTelemetry(session?.telemetry||[],{limit:100}),conclusions:clone(session?.conclusions||[])};}
  return Object.freeze({DRILL_FORMAT,DRILL_VERSION,MAX_SHARE_CHARS,MAX_FILE_BYTES,makePortableDrill,validatePortableDrill,serializePortableDrill,deserializePortableDrill,makeShareUrl,parseShareHash,safeFilename,parseExternalAiResult,buildExternalAiRequest,validateDebugPack,chooseDebugNext,compactTelemetry,validateAdvisorResponse,normalizeHexBytes,debugHandoff});
});
