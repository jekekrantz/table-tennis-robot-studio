(function(root,factory){const api=factory(root.TTRSFeaturesCore);if(typeof module==='object'&&module.exports)module.exports=api;root.TTRSDebugAdvisor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Core){'use strict';
  class LocalGuidedAdvisor{
    constructor(pack){this.pack=pack;}
    next(session){const tests=this.pack?.tests||[];if(!session?.currentTestId)return {type:'propose_test',test:tests[0]};const current=tests.find(t=>t.id===session.currentTestId);const obs=(session.observations||[]).filter(o=>o.testId===current?.id).at(-1);if(!obs)return {type:'ask_user',question:current?.question||'What did you observe?',options:current?.answers||['yes','no','other']};const next=Core.chooseDebugNext(current,obs.answer);if(!next||next==='conclude')return {type:'conclude',summary:'The deterministic branch has reached a conclusion. Export the handoff if you want a deeper protocol analysis.'};const test=tests.find(t=>t.id===next);return test?{type:'propose_test',test}:{type:'conclude',summary:'The selected branch is complete.'};}
  }
  class OpenAIAdvisor{
    constructor({endpoint='',model=''}={}){this.endpoint=endpoint;this.model=model;this.previousResponseId='';}
    async next(session){if(!this.endpoint)throw new Error('No debug-advisor backend endpoint is configured.');const res=await fetch(this.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:this.model,session:Core.debugHandoff(session),previous_response_id:this.previousResponseId||undefined})});if(!res.ok)throw new Error(`Advisor backend returned ${res.status}.`);const value=await res.json();if(value?._responseId)this.previousResponseId=value._responseId;const check=Core.validateAdvisorResponse(value);if(!check.valid)throw new Error(check.error);return check.value;}
  }
  return Object.freeze({LocalGuidedAdvisor,OpenAIAdvisor});
});
