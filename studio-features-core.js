(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TTRSFeaturesCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const DRILL_FORMAT='table-tennis-robot-studio/drill';
  const DRILL_VERSION=1;
  const SKILL_FORMAT='table-tennis-robot-studio/skill';
  const SKILL_VERSION=2;
  const INTUITIVE_DRILL_FORMAT='table-tennis-robot-studio/intuitive-drill';
  const INTUITIVE_DRILL_VERSION=1;
  const ASSISTANT_ACTION_FORMAT='table-tennis-robot-studio/assistant-action';
  const ASSISTANT_ACTION_VERSION=1;
  const MAX_SHARE_CHARS=12000;
  const MAX_FILE_BYTES=512*1024;
  const MAX_NODES=240;
  const MAX_EDGES=600;
  const APP_CAPABILITIES=`Table Tennis Robot Studio is a browser-based controller and drill builder for Pongbot Nova.
- Library: browse built-in drills or My drills, use folders and search, create drills, and import/export or share drills.
- Run: preview sampled receiver-side landing positions, calibrate the robot pose, play continuously until Stop, and use Player tuning while a drill runs. Timing is authored on drill graph connections. Starting may include app-side preparation before the first ball: reconnecting or initializing Nova when needed, waiting for Ready, preparing the first command batch, and honoring first-shot timing.
- Drill editor: build sequences with Shot, Serve, Random choice, Repeat/loop, and Sub-drill nodes; configure placement, speed, spin, trajectory, variation, and timing.
- Robot: connect/disconnect Nova, select and edit saved player models for Adaptive Auto timing, inspect status and diagnostics, open calibration, and configure idle STOP and BLE-disconnect timers. Idle STOP leaves BLE connected for a quick re-initialization; BLE disconnect releases the radio and requires reconnecting later.
- Calibration: guided launch calibration, robot-pose calibration, and table/trajectory model settings.
- AI assist: answer app questions or create/revise validated drills. AI suggestions never directly control the robot; the app validates drill structure and ranges, and the user still applies and starts a drill.
- Spin capability: the intuitive outcome API controls only forward/backward spin (topspin, backspin, or no-spin). It cannot request sidespin. If a user asks for sidespin, explain this limitation explicitly instead of creating or labeling a substitute drill.`;
  function normalizedWords(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();}
  function editDistance(a,b){a=normalizedWords(a).replace(/ /g,'');b=normalizedWords(b).replace(/ /g,'');const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i+=1){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j+=1){const hold=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=hold;}}return row[b.length];}
  function builtInMatch(prompt,catalog=[]){
    const text=normalizedWords(prompt).replace(/\b(built in|builtin|drill|preset|please|the|a|an|open|show|find|run|play|start|take me to|i want(?: to)?(?: do)?|give me|get me)\b/g,' ').replace(/\s+/g,' ').trim();
    if(!text)return null;let best=null;
    for(const item of Array.isArray(catalog)?catalog:[]){const name=normalizedWords(item?.name);if(!name)continue;const distance=editDistance(text,name),score=distance/Math.max(text.replace(/ /g,'').length,name.replace(/ /g,'').length,1);if(name.includes(text)||text.includes(name)||score<=.34){if(!best||score<best.score)best={item,score};}}
    return best?.item||null;
  }
  function resolveAssistantIntent(prompt,{builtIns=[],hasCurrentDrill=false,currentScreen=''}={}){
    const raw=String(prompt||'').trim(),text=normalizedWords(raw);
    const asksToOpen=/\b(open|show|find|run|play|start|take me to|go to|go back to)\b/.test(text);
    const asksForBuiltInChoices=/\b(?:which|what|show me|find)\b.*\b(?:built in|builtin)\b.*\bdrills\b/.test(text);
    const asksForSidespin=/\b(?:side spin|sidespin)\b/.test(text);
    const directNavigationQuestion=/^(?:can|could|would) you (?:open|show|take)\b/.test(text);
    const imperativeDoNot=/^(?:do not|don t)\b/.test(text);
    const isQuestion=!directNavigationQuestion&&!imperativeDoNot&&(/^(?:how|where|what|why|when|which|can|could|would|will|does|do|is|are|should)\b/.test(text)||/\?$/.test(raw));
    const explicitFresh=/\b(?:completely new|brand new|new drill|separate drill|new(?: [a-z0-9-]+){0,8} (?:drill|copy)|(?:copy|duplicate)\b.*\b(?:pattern|current|this|drill)|instead of (?:adding|editing)|keep\b.*\b(?:built in|builtin|original|current drill)\b.*\bunchanged)\b/.test(text);
    const explicitCreate=/\b(?:create|build|design|generate)(?: me)?\b/.test(text)||/\bmake (?:me|a new|an? .* new)\b/.test(text);
    const editMutation=hasCurrentDrill&&(/\b(?:add|prepend|change|modify|reduce|increase|slow|slower|faster|keep|leave|give|move|set)\b/.test(text)||/^start (?:this|the|same)\b/.test(text));
    const catalogMatch=builtInMatch(raw,builtIns);
    if(asksForSidespin)return {action:'answer'};
    if(asksForBuiltInChoices)return {action:'answer'};
    if(isQuestion)return {action:'answer'};
    if(asksToOpen&&/\b(?:built in|builtin|preset)\b/.test(text)&&!/\b(?:copy|duplicate|new)\b/.test(text)&&catalogMatch)return {action:'open_builtin_drill',builtInDrillId:String(catalogMatch.id),destination:'run'};
    if(asksToOpen){
      if(/\b(robot|nova)( settings| setup| screen)?\b/.test(text))return {action:'open_screen',screen:'robot'};
      if(/\bcalibrat/.test(text))return {action:'open_screen',screen:'calibration'};
      if(/\b(library|drill library|my drills|built in drills)\b/.test(text))return {action:'open_screen',screen:'library'};
      if(/\b(editor|edit drill)\b/.test(text)&&hasCurrentDrill)return {action:'open_screen',screen:'editor'};
      if(/\b(run screen|current drill|this drill)\b/.test(text)&&hasCurrentDrill&&!editMutation)return {action:'open_screen',screen:'run'};
    }
    if(explicitFresh||explicitCreate||(!hasCurrentDrill&&/\bmake\b.*\b(?:drill|pattern)\b/.test(text)))return {action:'create_drill',destination:currentScreen==='Run drill'?'run':'editor'};
    if(editMutation)return {action:'edit_drill',destination:currentScreen==='Run drill'?'run':'editor'};
    if(/\b(built in|builtin|preset)\b/.test(text)){const match=builtInMatch(raw,builtIns);if(match)return {action:'open_builtin_drill',builtInDrillId:String(match.id),destination:'run'};}
    if(asksToOpen){
      if(catalogMatch)return {action:'open_builtin_drill',builtInDrillId:String(catalogMatch.id),destination:'run'};
    }
    if(catalogMatch&&/\b(?:want to do|want the|use the|select)\b/.test(text))return {action:'open_builtin_drill',builtInDrillId:String(catalogMatch.id),destination:'run'};
    if(hasCurrentDrill&&!/^(how|where|what|why|help)\b/.test(text))return {action:'edit_drill',destination:currentScreen==='Run drill'?'run':'editor'};
    return {action:'answer'};
  }
  function validateAssistantAction(data,{builtIns=[]}={}){
    const errors=[];if(!data||typeof data!=='object'||Array.isArray(data))errors.push('The assistant action must be an object.');
    if(data?.format!==ASSISTANT_ACTION_FORMAT)errors.push(`Expected format ${ASSISTANT_ACTION_FORMAT}.`);
    if(Number(data?.formatVersion)!==ASSISTANT_ACTION_VERSION)errors.push(`Unsupported assistant action version ${data?.formatVersion??'missing'}.`);
    const action=String(data?.action||'');if(!['create_drill','edit_drill','open_builtin_drill','open_screen','answer'].includes(action))errors.push('Unsupported assistant action.');
    if(['create_drill','edit_drill'].includes(action)&&!validateIntuitiveDrillPlan(data?.drillPlan).valid)errors.push('A create/edit action needs a valid drillPlan.');
    if(action==='open_builtin_drill'&&!builtIns.some(item=>String(item?.id)===String(data?.builtInDrillId)))errors.push('The built-in drill ID is not available.');
    if(action==='open_screen'&&!['library','run','editor','robot','calibration'].includes(String(data?.screen)))errors.push('The screen is not available.');
    if(action==='answer'&&!String(data?.answer||'').trim())errors.push('An answer action needs answer text.');
    return {valid:errors.length===0,errors:[...new Set(errors)]};
  }
  function parseExternalAssistantAction(text,options={}){for(const candidate of extractJsonCandidates(text).reverse()){try{const obj=JSON.parse(candidate),check=validateAssistantAction(obj,options);if(check.valid)return clone(obj);}catch(_){}}throw new Error('No valid Table Tennis Robot Studio assistant action was found in the AI response.');}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function makePortableDrill(drill,meta={}){
    if(!drill||typeof drill!=='object')throw new Error('A drill is required.');
    const clean=clone(drill);delete clean.aiHistory;delete clean.training;delete clean.customSkillId;
    return {format:DRILL_FORMAT,formatVersion:DRILL_VERSION,name:String(drill.name||'Shared drill').slice(0,90),description:String(drill.description||'').slice(0,600),createdWith:'Table Tennis Robot Studio',createdAt:meta.createdAt||new Date().toISOString(),trainingGoal:meta.trainingGoal||drill.trainingGoal||'',level:meta.level||drill.level||'',instructions:meta.instructions||drill.instructions||'',drill:clean};
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
      if(!['shot','serve','random','drill','counter'].includes(n?.type))errors.push(`Unsupported node type ${String(n?.type)}.`);
      if(n?.type==='shot'||n?.type==='serve'){
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
  function rangePair(value,min,max){return Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)&&value[0]>=min&&value[1]<=max&&value[0]<=value[1];}
  function validateSkillProposal(data){
    const errors=[];
    if(!data||typeof data!=='object'||Array.isArray(data))errors.push('The skill must be an object.');
    if(data?.format!==SKILL_FORMAT)errors.push(`Expected format ${SKILL_FORMAT}.`);
    if(Number(data?.formatVersion)!==SKILL_VERSION)errors.push(`Unsupported skill format version ${data?.formatVersion??'missing'}.`);
    if(!String(data?.name||'').trim())errors.push('The skill needs a name.');
    const stages=Array.isArray(data?.stages)?data.stages:[];
    if(stages.length<1||stages.length>12)errors.push('A skill must contain 1 to 12 learning stages.');
    let drillCount=0;
    stages.forEach((stage,index)=>{
      for(const key of ['title','goal','focus','target'])if(!String(stage?.[key]||'').trim())errors.push(`Step ${index+1} needs ${key}.`);
      const drills=Array.isArray(stage?.drills)?stage.drills:[];drillCount+=drills.length;
      if(drills.length<1||drills.length>6)errors.push(`Stage ${index+1} must contain 1 to 6 drills.`);
      drills.forEach((drill,drillIndex)=>{
        if(!String(drill?.name||'').trim())errors.push(`Stage ${index+1}, drill ${drillIndex+1} needs a name.`);
        const balls=Array.isArray(drill?.balls)?drill.balls:[];
        if(balls.length<1||balls.length>24)errors.push(`Stage ${index+1}, drill ${drillIndex+1} must contain 1 to 24 balls.`);
        balls.forEach((ball,ballIndex)=>{
          if(!['shot','serve'].includes(ball?.type))errors.push(`Stage ${index+1}, drill ${drillIndex+1}, ball ${ballIndex+1} has an unsupported type.`);
          const o=ball?.outcome||{};
          for(const [key,min,max] of [['depthCm',0,137],['lateralCm',-76,76],['speedMps',1,20],['spinRps',-120,120],['netClearanceCm',.2,80]])if(!rangePair(o[key],min,max))errors.push(`Stage ${index+1}, drill ${drillIndex+1}, ball ${ballIndex+1} ${key} must be a [minimum, maximum] range inside ${min}…${max}.`);
        });
      });
    });
    if(drillCount>36)errors.push('A skill may contain at most 36 drills.');
    return {valid:errors.length===0,errors:[...new Set(errors)].slice(0,20)};
  }
  function parseExternalSkillResult(text){
    const valid=[];for(const candidate of extractJsonCandidates(text)){try{const obj=JSON.parse(candidate);const check=validateSkillProposal(obj);if(check.valid)valid.push(obj);}catch(_){}}
    if(!valid.length)throw new Error('No valid Table Tennis Robot Studio skill was found in the AI response.');
    return clone(valid.at(-1));
  }
  function skillHistoryText(history){const safe=(Array.isArray(history)?history:[]).slice(-12).map((turn,index)=>({turn:index+1,userRequest:String(turn?.userRequest||'').slice(0,2000),assistantOutput:turn?.assistantOutput||null,feasibility:turn?.feasibility||null}));return safe.length?`CREATION/EDIT HISTORY (oldest to newest):\n${JSON.stringify(safe,null,2)}\n\n`:'';}
  function buildExternalSkillRequest({userRequest='',currentSkill=null,history=[]}={}){
    return `You design progressive table-tennis training for a player using a Pongbot Nova. The app, not you, converts desired outcomes into physical launch parameters.\n\nPLAYER REQUEST:\n${userRequest||'(no request supplied)'}\n\n${skillHistoryText(history)}${currentSkill?`CURRENT SAVED SKILL (preserve anything the player did not ask to change):\n${JSON.stringify(currentSkill,null,2)}\n\n`:''}INTUITIVE DRILL API AND COORDINATES:\n- Output desired ball outcomes, never wheel values, launch elevation, launch aim, or guessed robot parameters.\n- The robot stands centered at the back edge of its table half and faces the receiver.\n- depthCm is measured on the RECEIVER half: 0 at the net and 137 at the receiver end line.\n- lateralCm is measured from the center line: positive is toward the ROBOT'S LEFT (the forehand side of a right-handed receiver); negative is toward the robot's right.\n- speedMps is launch speed. spinRps is positive for topspin, negative for backspin, and near zero for no-spin.\n- netClearanceCm is the ball's height above the top of the net while crossing it.\n- Every outcome field is an inclusive [minimum, maximum] interval, matching the app's Intuitive shot editor. Use meaningful ranges rather than identical endpoints unless precision is essential.\n- type "shot" lands at depthCm/lateralCm on the receiver's first bounce. type "serve" uses the receiver-side second physical bounce as its placement target.\n- A drill's balls play sequentially. repetitions is the number of sequence repetitions. adaptiveSpeedPct 50…200 controls timing; 100 is a normal training rhythm.\n\nTABLE-TENNIS INTERPRETATION:\n- Assume a right-handed player unless stated otherwise. State important assumptions in the description.\n- A step-around forehand means moving around the backhand corner to use the forehand. An opening normally means the first topspin attack against backspin.\n- Down the line from a right-hander's backhand corner targets the receiver's forehand side, so use positive lateralCm. Crosscourt from there targets negative lateralCm.\n- Use progressive overload: isolate contact first, then footwork/timing, placement, recovery, and realistic uncertainty when useful. Do not force a fixed number of stages or drills. Use only as many as serve the learning goal.\n- Robot feeds must train the stated skill: choose incoming spin, depth, placement, pace, sequence, and recovery ball deliberately.\n\nReturn exactly one JSON object with no prose using this schematic contract:\n{"format":"${SKILL_FORMAT}","formatVersion":${SKILL_VERSION},"name":"...","description":"include assumptions","accent":"#55c98c","stages":[{"title":"...","goal":"...","focus":"specific player instructions","target":"measurable completion test","drills":[{"name":"...","description":"why this feed trains the stage","repetitions":3,"adaptiveSpeedPct":90,"balls":[{"id":"unique-ball-id","type":"shot","label":"Backspin to backhand corner","outcome":{"depthCm":[85,105],"lateralCm":[-55,-40],"speedMps":[4.5,5.5],"spinRps":[-24,-16],"netClearanceCm":[8,14]}}]}]}]}.\n\nLimits: 1…12 stages; 1…6 drills per stage; at most 36 drills total; 1…24 balls per drill. The app will reject or return feasibility feedback for outcome combinations its calibrated trajectory model cannot produce.`;
  }
  function buildExternalSkillRevisionRequest({userRequest='',proposal=null,report=null,currentSkill=null,history=[]}={}){
    return `${buildCorrectedExternalSkillRequest({userRequest,currentSkill,history})}\n\nTHE APP TESTED YOUR LAST PROPOSAL WITH ITS CALIBRATED TRAJECTORY AND NOVA HARDWARE MODEL. Revise the complete skill to resolve the failures while preserving its coaching intent. Do not merely copy launch parameters; adjust the intuitive outcome intervals.\n\nLAST PROPOSAL:\n${JSON.stringify(proposal,null,2)}\n\nFEASIBILITY REPORT:\n${JSON.stringify(report,null,2)}\n`;
  }
  function buildCorrectedExternalSkillRequest(input){
    return buildExternalSkillRequest(input).replace(
      "- Down the line from a right-hander's backhand corner targets the receiver's forehand side, so use positive lateralCm. Crosscourt from there targets negative lateralCm.",
      "- Outcome ranges describe the ROBOT'S INCOMING FEED. A requested direction for the player's return (for example, open down the line) belongs in focus/target coaching text; do not move the incoming feed to that return target."
    );
  }
  function validateIntuitiveDrillPlan(data){
    const errors=[];
    if(!data||typeof data!=='object'||Array.isArray(data))errors.push('The drill plan must be an object.');
    if(data?.format!==INTUITIVE_DRILL_FORMAT)errors.push(`Expected format ${INTUITIVE_DRILL_FORMAT}.`);
    if(Number(data?.formatVersion)!==INTUITIVE_DRILL_VERSION)errors.push(`Unsupported intuitive drill version ${data?.formatVersion??'missing'}.`);
    if(!String(data?.name||'').trim())errors.push('The drill needs a name.');
    const nodes=Array.isArray(data?.nodes)?data.nodes:[],edges=Array.isArray(data?.edges)?data.edges:[];
    if(!nodes.length||nodes.length>MAX_NODES)errors.push(`A drill needs 1 to ${MAX_NODES} nodes.`);
    if(edges.length>MAX_EDGES)errors.push(`A drill may contain at most ${MAX_EDGES} connections.`);
    const ids=new Set();
    nodes.forEach((node,index)=>{
      const id=String(node?.id||'');if(!id)errors.push(`Node ${index+1} needs an id.`);else if(ids.has(id))errors.push(`Node id ${id} is duplicated.`);else ids.add(id);
      if(!['shot','serve','random','drill','counter'].includes(node?.type))errors.push(`Node ${id||index+1} has unsupported type ${String(node?.type)}.`);
      if(node?.type==='shot'||node?.type==='serve'){
        const o=node?.outcome||{};
        for(const [key,min,max]of[['depthCm',0,137],['lateralCm',-76,76],['speedMps',1,20],['spinRps',-120,120],['netClearanceCm',.2,80]])if(!rangePair(o[key],min,max))errors.push(`Node ${id||index+1} ${key} must be a [minimum, maximum] range inside ${min}…${max}.`);
      }
      if(node?.type==='drill'&&!String(node?.referencedDrillId||''))errors.push(`Sub-drill node ${id||index+1} needs referencedDrillId.`);
    });
    if(data?.startNodeId&&!ids.has(String(data.startNodeId)))errors.push('startNodeId does not name a node.');
    edges.forEach((edge,index)=>{
      if(!ids.has(String(edge?.source))||!ids.has(String(edge?.target)))errors.push(`Connection ${index+1} references a missing node.`);
      if(!['next','branch','A','B'].includes(edge?.sourceSlot))errors.push(`Connection ${index+1} has an unsupported sourceSlot.`);
    });
    return {valid:errors.length===0,errors:[...new Set(errors)].slice(0,20)};
  }
  function parseExternalIntuitiveDrillResult(text){
    const valid=[];for(const candidate of extractJsonCandidates(text)){try{const obj=JSON.parse(candidate);const check=validateIntuitiveDrillPlan(obj);if(check.valid)valid.push(obj);}catch(_){}}
    if(!valid.length)throw new Error('No valid intuitive Table Tennis Robot Studio drill was found in the AI response.');
    return clone(valid.at(-1));
  }
  function drillHistoryText(history){const safe=(Array.isArray(history)?history:[]).slice(-12).map((turn,index)=>({turn:index+1,userRequest:String(turn?.userRequest||'').slice(0,2000),assistantOutput:turn?.assistantOutput||null,feasibility:turn?.feasibility||null}));return safe.length?`DRILL CREATION/EDIT HISTORY (oldest to newest):\n${JSON.stringify(safe,null,2)}\n\n`:'';}
  function safeFeasibilityGuide(guide){
    if(!guide||typeof guide!=='object')return null;
    const examples=(Array.isArray(guide.examples)?guide.examples:[]).slice(0,12).map(item=>({type:item?.type==='serve'?'serve':'shot',label:String(item?.label||'Feasible example').slice(0,80),outcome:clone(item?.outcome||{})})).filter(item=>['depthCm','lateralCm','speedMps','spinRps','netClearanceCm'].every(key=>rangePair(item.outcome[key],key==='lateralCm'?-76:key==='spinRps'?-120:key==='netClearanceCm'?.2:key==='speedMps'?1:0,key==='depthCm'?137:key==='lateralCm'?76:key==='speedMps'?20:key==='spinRps'?120:80)));
    return examples.length?{basis:String(guide.basis||'Locally verified feasible outcome examples.').slice(0,240),guidance:String(guide.guidance||'Use these as anchors, not hard limits.').slice(0,320),examples}:null;
  }
  function buildExternalDrillRequestBase({userRequest='',currentPlan=null,history=[],appContext=null,feasibilityGuide=null}={}){
    const safeContext=appContext&&typeof appContext==='object'?{screen:String(appContext.screen||''),activeDrill:appContext.activeDrill?String(appContext.activeDrill):null,drillSource:appContext.drillSource?String(appContext.drillSource):null,selection:appContext.selection?String(appContext.selection):null,localContext:Array.isArray(appContext.localContext)?appContext.localContext.slice(0,8).map(item=>String(item).slice(0,160)):[]}:null;
    const guide=safeFeasibilityGuide(feasibilityGuide);
    return `You design one executable table-tennis robot drill for a Pongbot Nova. The app, not you, converts desired ball outcomes into physical launch parameters.\n\nPLAYER REQUEST:\n${userRequest||'(no request supplied)'}\n\n${drillHistoryText(history)}${currentPlan?`CURRENT DRILL IN THE SAME INTUITIVE API (preserve anything not requested):\n${JSON.stringify(currentPlan,null,2)}\n\n`:''}VISIBLE APP CONTEXT:\n${safeContext?JSON.stringify(safeContext,null,2):'(none)'}\n\n${guide?`CURRENT CALIBRATED FEASIBILITY GUIDE (outcomes only; do not expose or infer hidden robot parameters):\n${JSON.stringify(guide,null,2)}\n\n`:''}INTUITIVE BALL API AND COORDINATES:\n- Output desired outcomes, never wheel values, launch elevation, launch aim, PWM, calibration coefficients, or protocol commands.\n- The coordinate frame is fixed to the table: the robot normally stands centered at the back edge of its table half and faces the receiver. The app applies the saved calibrated robot pose when it solves the outcomes.\n- depthCm is on the RECEIVER half: 0 at the net, 137 at the receiver end line.\n- lateralCm is from center: positive toward the ROBOT'S LEFT (right-handed receiver's forehand), negative toward robot's right.\n- speedMps is launch speed. spinRps: positive topspin, negative backspin, near-zero no-spin. netClearanceCm is above the net top.\n- Each is an inclusive [minimum, maximum] interval matching the player's Intuitive editor. Prefer useful ranges over identical endpoints.\n- shot placement is its receiver-side first bounce. serve placement is its receiver-side second physical bounce.\n- Outcome ranges describe the incoming robot feed, not the direction of the player's return.\n\nDRILL GRAPH API:\n- Ball node types: shot and serve. Structural types: random and counter. A current drill may also contain a drill node with referencedDrillId: preserve it when editing, but never invent a new sub-drill reference because unrelated saved drills are not shared with you.\n- A shot/serve node has id, type, label, and outcome. random selects one outgoing branch using positive edge weights. counter uses startCount and A/B edges for Repeat/Finish.\n- Connections use source, sourceSlot (next, branch, A, or B), target, weight, timingMode, delaySeconds, and autoSpeedPct. adaptive timing normally uses autoSpeedPct 50…200; manual timing uses delaySeconds.\n- Missing outgoing connection ends a path. Every path should terminate. Keep graphs compact and purposeful.\n- settings.repetitions: 0 repeats indefinitely, otherwise 1…999999. firstShotTiming uses {"mode":"adaptive","speedPct":100} or {"mode":"manual","delaySeconds":1}.\n\nTABLE-TENNIS DEFAULTS:\n- Assume a right-handed receiver unless stated. wide FH/BH means receiver forehand/backhand; elbow is crossover; deep is near the end line; short normally needs a serve node when two table bounces are required.\n- Falkenberg means backhand, forehand from backhand corner, wide forehand. Match-like means controlled, purposeful uncertainty rather than chaos.\n- Make feeds train the stated action. State important assumptions in description.\n\nReturn exactly one JSON object, without prose, using this schematic contract:\n{"format":"${INTUITIVE_DRILL_FORMAT}","formatVersion":${INTUITIVE_DRILL_VERSION},"name":"...","description":"...","tags":["..."],"startNodeId":"ball-1","settings":{"repetitions":3,"delayBetweenSets":0,"firstShotTiming":{"mode":"adaptive","speedPct":100}},"nodes":[{"id":"ball-1","type":"shot","label":"Backspin to backhand","outcome":{"depthCm":[65,85],"lateralCm":[-55,-38],"speedMps":[4.6,5.5],"spinRps":[-24,-15],"netClearanceCm":[8,14]}}],"edges":[]}.\n\nMaximum ${MAX_NODES} nodes and ${MAX_EDGES} connections. The app will return per-ball feasibility feedback and nearest modeled outcomes when a combination cannot be produced.`;
  }
  function buildExternalDrillRequest(input={}){
    return buildExternalDrillRequestBase(input).replace(
      "- Each is an inclusive [minimum, maximum] interval matching the player's Intuitive editor. Prefer useful ranges over identical endpoints.",
      "- Each is an inclusive [minimum, maximum] interval matching the player's Intuitive editor. Legal bounds: depthCm 0…137, lateralCm -76…76, speedMps 1…20, spinRps -120…120, and netClearanceCm 0.2…80. Prefer useful ranges over identical endpoints."
    ).replace(
      'Missing outgoing connection ends a path. Every path should terminate. Keep graphs compact and purposeful.',
      "Missing outgoing connection ends a path. There is no literal END node or END edge target: terminate by omitting the final node's outgoing connection. Every reachable path should terminate. Keep graphs compact and purposeful."
    );
  }
  function buildExternalDrillRevisionRequestBase({userRequest='',proposal=null,report=null,currentPlan=null,history=[],appContext=null,feasibilityGuide=null}={}){
    return `${buildExternalDrillRequest({userRequest,currentPlan,history,appContext,feasibilityGuide})}\n\nTHE APP TESTED THE LAST PROPOSAL WITH ITS CALIBRATED TRAJECTORY AND NOVA HARDWARE MODEL. Revise the complete drill so every ball is feasible while preserving the requested training intent and graph behavior. Adjust intuitive outcome intervals, not hidden launch parameters.\n\nLAST PROPOSAL:\n${JSON.stringify(proposal,null,2)}\n\nFEASIBILITY REPORT:\n${JSON.stringify(report,null,2)}\n`;
  }
  function buildExternalDrillRevisionRequest(input={}){
    return buildExternalDrillRevisionRequestBase(input).replace(
      'Adjust intuitive outcome intervals, not hidden launch parameters.',
      'Adjust intuitive outcome intervals, not hidden launch parameters. Keep every interval inside the documented legal bounds, especially netClearanceCm at or above 0.2. Revise only nodes reported infeasible or structurally invalid. On an infeasible node, preserve every outcome dimension that the player did not ask to change; use nearestModeledOutcome only for the requested dimension whenever possible. If feasibility genuinely requires another dimension to move, make the smallest necessary change and do not alter any feasible node. Preserve all existing labels except the specific duplicate label named by a structural error, which must be made unique. When nearestModeledOutcome is present, widen a legal interval around that outcome rather than copying an illegal endpoint.'
    );
  }
  function buildExternalAssistantRequestBase({userRequest='',intent=null,currentPlan=null,history=[],appContext=null,actionCatalog=null,feasibilityGuide=null}={}){
    const catalog={screens:['library','run','editor','robot','calibration'],builtIns:(Array.isArray(actionCatalog?.builtIns)?actionCatalog.builtIns:[]).slice(0,160).map(item=>({id:String(item.id),name:String(item.name),folder:String(item.folder||'')}))};
    const routed=intent||resolveAssistantIntent(userRequest,{builtIns:catalog.builtIns,hasCurrentDrill:Boolean(currentPlan),currentScreen:appContext?.screen});
    const base=`You are the action planner for Table Tennis Robot Studio. The app has already routed the user's request, but you must communicate the result using the exact allow-listed action contract below. Never invent a screen or built-in drill ID. The app validates every response and never lets AI directly control the robot.\n\nUSER REQUEST:\n${userRequest||'(none)'}\n\nROUTED INTENT:\n${JSON.stringify(routed,null,2)}\n\nAVAILABLE UI TARGETS:\n${JSON.stringify(catalog,null,2)}\n\nAPP CAPABILITIES:\n${APP_CAPABILITIES}\n\nACTION CONTRACT (return exactly one JSON object, no prose):\n- Create: {"format":"${ASSISTANT_ACTION_FORMAT}","formatVersion":${ASSISTANT_ACTION_VERSION},"action":"create_drill","destination":"editor|run","drillPlan":{...}}\n- Edit: {"format":"${ASSISTANT_ACTION_FORMAT}","formatVersion":${ASSISTANT_ACTION_VERSION},"action":"edit_drill","destination":"editor|run","drillPlan":{...}}\n- Open a listed built-in: {"format":"${ASSISTANT_ACTION_FORMAT}","formatVersion":${ASSISTANT_ACTION_VERSION},"action":"open_builtin_drill","builtInDrillId":"exact-listed-id","destination":"run"}\n- Navigate: {"format":"${ASSISTANT_ACTION_FORMAT}","formatVersion":${ASSISTANT_ACTION_VERSION},"action":"open_screen","screen":"library|run|editor|robot|calibration"}\n- Answer: {"format":"${ASSISTANT_ACTION_FORMAT}","formatVersion":${ASSISTANT_ACTION_VERSION},"action":"answer","answer":"concise app guidance"}\n\nFollow ROUTED INTENT. If it is create_drill or edit_drill, include drillPlan and use the drill-design instructions that follow. For other actions, do not include a drillPlan.\n\n`;
    if(!['create_drill','edit_drill'].includes(routed.action))return base;
    const referencesCurrent=/\b(?:copy|duplicate|this|current|same|pattern|original)\b/.test(normalizedWords(userRequest));
    const suppliedPlan=routed.action==='edit_drill'||referencesCurrent?currentPlan:null;
    return base+buildExternalDrillRequest({userRequest,currentPlan:suppliedPlan,history,appContext,feasibilityGuide});
  }
  function buildExternalAssistantRequest(input={}){
    const request=buildExternalAssistantRequestBase(input).replace(
      'Follow ROUTED INTENT. If it is create_drill or edit_drill, include drillPlan and use the drill-design instructions that follow. For other actions, do not include a drillPlan.',
      'Follow ROUTED INTENT exactly. Do not replace open_screen or open_builtin_drill with written navigation instructions. For answer requests, answer the question directly and reuse its important user-facing terms instead of silently replacing them with internal synonyms. For answer requests about a category of built-ins, name concrete matching entries from AVAILABLE UI TARGETS. Use exact visible status terminology from VISIBLE APP CONTEXT when it answers the question. If it is create_drill or edit_drill, include drillPlan and use the drill-design instructions that follow. For other actions, do not include a drillPlan.'
    );
    if(!['create_drill','edit_drill'].includes(input.intent?.action))return request;
    return request.replace(
      'Return exactly one JSON object, without prose, using this schematic contract:',
      'Construct the drillPlan property using this schematic contract. Do not return this object by itself; the final response must be the assistant-action envelope required above:'
    ).replace(
      '- Make feeds train the stated action. State important assumptions in description.',
      "- Make feeds train the stated action. State important assumptions in description. VISIBLE APP CONTEXT selection identifies the exact selected node, including its stable ID; when the user's wording could name more than one ball, apply the requested change to that selected node and not a different semantic match. Before returning, cross-check that every label and description agrees with its numeric lateral/depth/spin ranges. Every shot/serve label must be unique within the drill; when adding or repeating a ball, give the new node a distinct useful label without renaming existing nodes. For a supplied current drill, preserve every unrequested node, edge, setting, label, and outcome field exactly. Treat each outcome dimension independently: if the user changes only lateral placement, preserve depth, speed, spin, and clearance exactly; if the user changes only depth, preserve lateral placement, speed, spin, and clearance exactly; if the user changes only spin, preserve placement, speed, and clearance exactly. When a request varies only one dimension such as depth or placement, keep the other outcome ranges identical across those alternatives unless the user explicitly requests additional variation. If a new placement pattern does not specify spin, use one consistent controlled spin type across comparable balls instead of inventing unrelated spin changes. When the user asks only for a copy or timing change, preserve all outcome intervals exactly."
    ).replace(
      '- Falkenberg means backhand, forehand from backhand corner, wide forehand. Match-like means controlled, purposeful uncertainty rather than chaos.',
      '- Falkenberg always includes the ordered core sequence: backhand, pivot forehand from the backhand corner, then wide forehand. A Falkenberg-style request must preserve all three stages; attach requested random alternatives only after or around that complete core rather than replacing the pivot stage. Match-like means controlled, purposeful uncertainty rather than chaos.'
    );
  }
  function buildExternalAiRequest({currentDrill=null,userRequest='',appContext=null,requestKind='drill' }={}){
    const safeContext=appContext&&typeof appContext==='object'?{screen:String(appContext.screen||''),activeDrill:appContext.activeDrill?String(appContext.activeDrill):null,drillSource:appContext.drillSource?String(appContext.drillSource):null,selection:appContext.selection?String(appContext.selection):null,localContext:Array.isArray(appContext.localContext)?appContext.localContext.slice(0,8).map(item=>String(item).slice(0,160)):[],robotStatus:appContext.robotStatus?String(appContext.robotStatus):null,activity:appContext.activity?String(appContext.activity):null}:null;
    const contextText=`${safeContext?JSON.stringify(safeContext,null,2):'(no visible screen context supplied)'}\n\nAPP CAPABILITIES:\n${APP_CAPABILITIES}`;
    if(requestKind==='help')return `This request was generated by Table Tennis Robot Studio.\n\nTASK MODE: APP HELP\nUSER QUESTION: ${userRequest||'(ask the user what they need help with)'}\n\nVISIBLE APP CONTEXT:\n${contextText}\n\nAnswer as a concise product guide for Table Tennis Robot Studio. Use the visible local context first, then the general capability guide when relevant. Do not claim to see Bluetooth logs, device identifiers, API keys, calibration values, other stored drills, or anything else not included above. Do not propose raw Bluetooth or firmware commands. If a capability is not established above, say what the user should inspect in the app instead of inventing behavior.`;
    const mode=currentDrill?'EDIT':'CREATE';const current=currentDrill?JSON.stringify(makePortableDrill(currentDrill),null,2):'(none — create a new drill)';
    return `This file was generated by Table Tennis Robot Studio.\n\nUpload or paste this entire file into your preferred AI assistant, then describe the drill you want in ordinary table-tennis language. You do not need to understand or edit anything below this line.\n\nTASK MODE: ${mode}\nUSER REQUEST: ${userRequest||'(ask the user what they want)'}\n\nVISIBLE APP CONTEXT:\n${contextText}\n\nYou are helping a table-tennis player, not a robotics engineer. Interpret ordinary table-tennis language and make sensible assumptions. Ask a question only when genuinely necessary. Never ask for Bluetooth bytes, wheel raw values, PWM, servo values, calibration coefficients, or protocol commands. Preserve unspecified behavior when editing.\n\nTerminology defaults: wide FH/BH = wide forehand/backhand target; elbow = crossover area; deep = toward end line; short = short/double-bounce-style target if feasible; heavy topspin/backspin = strong positive/negative spin; random = controlled stochastic variation; serve = a node with type \"serve\" whose modeled path bounces on the robot side, crosses the net, then bounces on the player side; Falkenberg = backhand + forehand-from-backhand + wide forehand movement pattern; match-like = realistic controlled variation rather than chaos.\n\nReturn ONE complete drill in this exact wrapper format and include no executable code:\nTABLE_TENNIS_ROBOT_STUDIO_DRILL_BEGIN\n{\n  "format": "${DRILL_FORMAT}",\n  "formatVersion": 1,\n  "name": "...",\n  "description": "...",\n  "trainingGoal": "...",\n  "level": "beginner|intermediate|advanced",\n  "instructions": "...",\n  "createdWith": "Table Tennis Robot Studio",\n  "drill": {\n    "name": "...", "description": "...", "tags": [], "robotPoseReference":"base_back", "robotPose":{"x":0,"y":0,"yawDeg":0},\n    "startNodeId": "node-id", "settings":{"repetitions":3,"delayBetweenSets":1},\n    "nodes": [{"id":"serve-1","type":"serve","label":"Serve 1","x":300,"y":260,"params":{"speedMps":5,"spinRps":-8,"elevationDeg":-4,"aimDeg":0}}],\n    "edges": [{"id":"edge-1","source":"serve-1","sourceSlot":"next","target":"shot-2","weight":1,"delaySeconds":1}]\n  }\n}\nTABLE_TENNIS_ROBOT_STUDIO_DRILL_END\n\nNode types: shot, serve, random, drill, counter. Constraints: speedMps 1..20; spinRps -120..120; elevationDeg -20..45; aimDeg -60..60; edge delays 0..3600 s; at most ${MAX_NODES} nodes. A missing outgoing edge ends the sequence. Keep parameters semantic; do not output raw Nova protocol values.\n\nCURRENT DRILL WHEN EDITING:\n${current}\n`;
  }
  function buildValidatedExternalAiRequest(input){
    return buildExternalAiRequest(input)
      .replace('"elevationDeg":-4,"aimDeg":0','"elevationDeg":-16,"aimDeg":0')
      .replace('"settings":{"repetitions":3,"delayBetweenSets":1}', '"settings":{"repetitions":3,"delayBetweenSets":0,"firstShotTiming":{"mode":"adaptive","speedPct":100}}')
      .replace('"weight":1,"delaySeconds":1}', '"weight":1,"delaySeconds":0,"timingMode":"adaptive","autoSpeedPct":100}')
      .replace('edge delays 0..3600 s;', 'connection timingMode adaptive or manual; adaptive autoSpeedPct 50..200; manual delaySeconds 0..3600 s;');
  }
  return Object.freeze({DRILL_FORMAT,DRILL_VERSION,SKILL_FORMAT,SKILL_VERSION,INTUITIVE_DRILL_FORMAT,INTUITIVE_DRILL_VERSION,ASSISTANT_ACTION_FORMAT,ASSISTANT_ACTION_VERSION,MAX_SHARE_CHARS,MAX_FILE_BYTES,makePortableDrill,validatePortableDrill,validateSkillProposal,validateIntuitiveDrillPlan,validateAssistantAction,resolveAssistantIntent,serializePortableDrill,deserializePortableDrill,makeShareUrl,parseShareHash,safeFilename,parseExternalAiResult,parseExternalSkillResult,parseExternalIntuitiveDrillResult,parseExternalAssistantAction,buildExternalSkillRequest:buildCorrectedExternalSkillRequest,buildExternalSkillRevisionRequest,buildExternalDrillRequest,buildExternalDrillRevisionRequest,buildExternalAssistantRequest,buildExternalAiRequest:buildValidatedExternalAiRequest});
});
