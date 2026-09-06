(() => {
  'use strict';
  const api = globalThis.TableTennisRobotStudio;
  const Core = globalThis.TTRSFeaturesCore;
  if (!api || !Core) return;

  const $ = id => document.getElementById(id);
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'html') el.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value === true) el.setAttribute(key, '');
      else if (value !== false && value != null) el.setAttribute(key, String(value));
    }
    for (const child of children.flat()) if (child != null) el.append(child.nodeType ? child : document.createTextNode(String(child)));
    return el;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));
  function download(name, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  async function copyText(text, label = 'Copied') {
    try { await navigator.clipboard.writeText(text); api.toast(label); }
    catch (_) { const area = h('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand?.('copy'); area.remove(); api.toast(label); }
  }
  function showDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }

  // ---------------------------------------------------------------------------
  // Portable drill sharing/import
  // ---------------------------------------------------------------------------
  let pendingPortable = null;
  let pendingPortableSource = '';

  const shareDialog = h('dialog', { id: 'shareDrillDialog', class: 'app-dialog feature-dialog' });
  shareDialog.innerHTML = `
    <div class="dialog-frame feature-dialog-frame">
      <header><div><p class="eyebrow">Portable drill</p><h2>Share drill</h2><p>Send this drill without an account or robot connection.</p></div><button class="icon-button" data-close type="button" aria-label="Close">×</button></header>
      <div class="share-summary" id="shareSummary"></div>
      <div class="feature-action-grid">
        <button id="shareCopyLinkBtn" class="button primary" type="button">Copy link</button>
        <button id="shareNativeBtn" class="button ghost" type="button">Share…</button>
        <button id="shareQrBtn" class="button ghost" type="button">Show QR code</button>
        <button id="shareFileBtn" class="button ghost" type="button">Save .ttdrill file</button>
      </div>
      <p id="shareStatus" class="helper"></p>
    </div>`;
  document.body.appendChild(shareDialog);
  shareDialog.querySelector('[data-close]').addEventListener('click', () => shareDialog.close());

  const qrDialog = h('dialog', { id: 'shareQrDialog', class: 'app-dialog feature-dialog' });
  qrDialog.innerHTML = `<div class="dialog-frame small feature-dialog-frame"><header><div><h2>Scan drill</h2><p id="qrDrillName"></p></div><button class="icon-button" data-close type="button">×</button></header><div id="shareQrCanvas" class="qr-canvas"></div><p id="qrStatus" class="helper"></p><div class="dialog-actions"><button id="qrCopyBtn" class="button ghost" type="button">Copy link</button><button class="button primary" data-close type="button">Done</button></div></div>`;
  document.body.appendChild(qrDialog);
  qrDialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => qrDialog.close()));

  const importDialog = h('dialog', { id: 'portableImportDialog', class: 'app-dialog feature-dialog' });
  importDialog.innerHTML = `<div class="dialog-frame small feature-dialog-frame"><header><div><p class="eyebrow">Import preview</p><h2 id="portableImportName">Shared drill</h2><p id="portableImportDescription"></p></div><button class="icon-button" data-close type="button">×</button></header><div id="portableImportStats" class="portable-preview-stats"></div><p class="helper">Imported drills become independent copies in My drills. Existing drills are never overwritten.</p><div class="dialog-actions"><button class="button ghost" data-close type="button">Cancel</button><button id="portableImportConfirmBtn" class="button primary" type="button">Add to My drills</button></div></div>`;
  document.body.appendChild(importDialog);
  importDialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => importDialog.close()));

  function portableForActive() { const drill = api.getActiveDrill(); if (!drill) throw new Error('Choose a drill first.'); return Core.makePortableDrill(drill); }
  function openShareDialog() {
    try {
      const portable = portableForActive(); const d = portable.drill;
      const balls=d.nodes.filter(n=>n.type==='shot'||n.type==='serve'); const serves=balls.filter(n=>n.type==='serve');
      $('shareSummary').innerHTML = `<strong>${escapeHtml(portable.name)}</strong><span>${balls.length} ball nodes${serves.length?` · ${serves.length} serves`:''} · ${d.nodes.length} total nodes</span>`;
      $('shareNativeBtn').hidden = typeof navigator.share !== 'function';
      $('shareStatus').textContent = 'Links use the URL fragment, so the drill payload is not normally sent to the web server.';
      showDialog(shareDialog);
    } catch (e) { api.toast(e.message); }
  }
  function currentShareUrl() { return Core.makeShareUrl(portableForActive(), location.href); }
  $('shareCopyLinkBtn').addEventListener('click', async () => { try { await copyText(currentShareUrl(), 'Drill link copied'); } catch (e) { $('shareStatus').textContent = e.message; } });
  $('shareNativeBtn').addEventListener('click', async () => { try { const p = portableForActive(); await navigator.share({ title: p.name, text: `Try this Table Tennis Robot Studio drill: ${p.name}`, url: currentShareUrl() }); } catch (e) { if (e?.name !== 'AbortError') $('shareStatus').textContent = e.message; } });
  $('shareFileBtn').addEventListener('click', () => { const p = portableForActive(); download(Core.safeFilename(p.name), JSON.stringify(p, null, 2), 'application/vnd.table-tennis-robot-studio.drill+json'); });
  $('shareQrBtn').addEventListener('click', () => {
    try {
      const url = currentShareUrl(); const p = portableForActive(); $('qrDrillName').textContent = p.name; const target = $('shareQrCanvas'); target.replaceChildren();
      if (!globalThis.TTRSQRCode) throw new Error('QR renderer did not load. Copy the link instead.');
      if (url.length > 2900) throw new Error('This drill link is too large for a reliable QR code. Use Copy link or Save .ttdrill file.');
      globalThis.TTRSQRCode.render(target, url, { size: 320 }); $('qrStatus').textContent = 'Scan with another phone to open the same import preview.'; showDialog(qrDialog);
    } catch (e) { $('shareStatus').textContent = e.message; }
  });
  $('qrCopyBtn').addEventListener('click', async () => { try { await copyText(currentShareUrl(), 'Drill link copied'); } catch (e) { $('qrStatus').textContent = e.message; } });

  function previewPortable(portable, source = 'import') {
    const check = Core.validatePortableDrill(portable); if (!check.valid) throw new Error(check.errors[0]);
    pendingPortable = portable; pendingPortableSource = source;
    const d = portable.drill; $('portableImportName').textContent = portable.name; $('portableImportDescription').textContent = portable.description || 'Portable Table Tennis Robot Studio drill.';
    $('portableImportStats').innerHTML = `<span>${d.nodes.filter(n => n.type === 'shot'||n.type === 'serve').length} balls</span><span>${d.nodes.filter(n => n.type === 'serve').length} serves</span><span>${d.nodes.length} nodes</span><span>${d.settings?.repetitions <= 0 ? '∞' : d.settings?.repetitions ?? 1} repetitions</span>`;
    showDialog(importDialog);
  }
  $('portableImportConfirmBtn').addEventListener('click', () => {
    if (!pendingPortable) return;
    try {
      const raw = clone(pendingPortable.drill); raw.name = api.uniqueDrillName(pendingPortable.name || raw.name || 'Imported drill'); raw.id = api.makeId('drill'); raw.robotPoseReference = 'base_back';
      const added = api.addUserDrill(raw); closeDialog(importDialog); pendingPortable = null; api.toast(`Added “${added.name}” to My drills`); api.navigateApp('run', { push: true });
      if (pendingPortableSource === 'share-url' && location.hash.includes('drill=')) history.replaceState(null, '', location.pathname + location.search);
    } catch (e) { api.toast(e.message); }
  });

  const portableInput = h('input', { type: 'file', accept: '.ttdrill,.json,application/json', hidden: true }); document.body.appendChild(portableInput);
  portableInput.addEventListener('change', async () => { const file = portableInput.files?.[0]; portableInput.value = ''; if (!file) return; if (file.size > Core.MAX_FILE_BYTES) { api.toast('Drill file is too large.'); return; } try { previewPortable(JSON.parse(await file.text()), 'file'); } catch (e) { api.toast(`Could not import drill: ${e.message}`); } });

  function installShareButtons() {
    const editorHeader = document.querySelector('.editor-screen-header');
    if (editorHeader && !$('editorShareBtn')) editorHeader.insertBefore(h('button', { id: 'editorShareBtn', class: 'button compact ghost', type: 'button', text: 'Share', 'aria-label': 'Share drill', onclick: openShareDialog }), $('editorRunBtn'));
    const actions = document.querySelector('.library-actions-row');
    if (actions && !$('portableImportBtn')) actions.prepend(h('button', { id: 'portableImportBtn', class: 'button ghost', type: 'button', text: 'Import .ttdrill', onclick: () => portableInput.click() }));
  }
  window.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
  window.addEventListener('drop', async e => { const file = [...(e.dataTransfer?.files || [])].find(f => /\.ttdrill$/i.test(f.name)); if (!file) return; e.preventDefault(); try { previewPortable(JSON.parse(await file.text()), 'drop'); } catch (err) { api.toast(err.message); } });

  // ---------------------------------------------------------------------------
  // AI drill assistant
  // ---------------------------------------------------------------------------
  const aiState = { mode: 'builtin', provider: 'openai', key: '', model: '', proposal: null, proposalPortable: null, proposalIntent: 'edit', recognition: null, listening: false };
  const aiDialog = h('dialog', { id: 'aiDrillDialog', class: 'app-dialog feature-dialog ai-drill-dialog' });
  aiDialog.innerHTML = `<div class="dialog-frame feature-dialog-frame ai-frame">
    <header><div><p class="eyebrow">AI drill assistant</p><h2>Describe a drill or a change</h2><p>Use table-tennis language. The proposal is validated locally before it can be applied.</p></div><button class="icon-button" data-close type="button">×</button></header>
    <div class="ai-prompt-box"><textarea id="aiDrillPrompt" rows="5" placeholder="Make this more match-like and occasionally surprise me with a wide forehand."></textarea><div class="ai-prompt-actions"><button id="aiMicBtn" class="button ghost" type="button" aria-label="Speech input">🎙 Speak</button><button id="aiGenerateBtn" class="button primary" type="button">Generate</button></div><p id="aiSpeechHint" class="helper"></p></div>
    <details class="feature-details"><summary>AI options / use another AI</summary>
      <div class="ai-mode-grid"><label><input type="radio" name="aiMode" value="builtin" checked> Built-in assistant</label><label><input type="radio" name="aiMode" value="byok"> Use my API key</label><label><input type="radio" name="aiMode" value="external"> Use another AI manually</label></div>
      <div id="aiByokPanel" hidden><div class="field-grid two"><label class="field"><span>Provider</span><select id="aiProvider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option></select></label><label class="field"><span>API key (session only)</span><input id="aiKeyInput" type="password" autocomplete="off" placeholder="Not saved"></label><label class="field"><span>Model ID</span><input id="aiModelInput" type="text" autocomplete="off" placeholder="Provider model ID"></label></div><div class="dialog-action-row"><button id="aiForgetKeyBtn" class="button compact ghost" type="button">Forget key</button><button id="aiProviderHelpBtn" class="button compact ghost" type="button">Get an API key</button></div><p class="helper">The key stays only in memory for this page. It is never written to localStorage, exports, URLs, or logs.</p></div>
      <div id="aiExternalPanel" hidden><div class="feature-action-grid"><button id="aiCopyRequestBtn" class="button ghost" type="button">Copy AI request</button><button id="aiDownloadRequestBtn" class="button ghost" type="button">Download AI request</button><button id="aiPasteResultBtn" class="button ghost" type="button">Paste AI result</button><button id="aiImportResultBtn" class="button ghost" type="button">Import AI drill file</button></div><div class="external-ai-links"><a href="https://chatgpt.com" target="_blank" rel="noopener">Open ChatGPT</a><a href="https://claude.ai" target="_blank" rel="noopener">Open Claude</a><a href="https://gemini.google.com" target="_blank" rel="noopener">Open Gemini</a><a href="https://copilot.microsoft.com" target="_blank" rel="noopener">Open Copilot</a></div></div>
    </details>
    <div id="aiStatus" class="feature-status" aria-live="polite"></div>
    <section id="aiProposal" class="ai-proposal" hidden><div class="section-title-row"><div><h3>Proposed drill</h3><p id="aiProposalSummary"></p></div><span class="status-badge valid">Validated</span></div><div id="aiProposalDetails" class="proposal-details"></div><div class="dialog-actions"><button id="aiTryAgainBtn" class="button ghost" type="button">Try another</button><button id="aiApplyBtn" class="button primary" type="button">Apply</button></div></section>
  </div>`;
  document.body.appendChild(aiDialog); aiDialog.querySelector('[data-close]').addEventListener('click', () => aiDialog.close());
  const aiPasteDialog = h('dialog', { id: 'aiPasteDialog', class: 'app-dialog feature-dialog' }); aiPasteDialog.innerHTML = `<div class="dialog-frame small"><header><div><h2>Paste AI result</h2><p>Prose around the JSON is okay.</p></div><button data-close class="icon-button" type="button">×</button></header><textarea id="aiPasteArea" rows="12" placeholder="Paste what your AI gave you here"></textarea><div class="dialog-actions"><button data-close class="button ghost" type="button">Cancel</button><button id="aiParsePasteBtn" class="button primary" type="button">Preview result</button></div></div>`; document.body.appendChild(aiPasteDialog); aiPasteDialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => aiPasteDialog.close()));
  const aiImportInput = h('input', { type: 'file', accept: '.ttdrill,.json,application/json', hidden: true }); document.body.appendChild(aiImportInput);

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function newShot(id, label, params, x, y) { return { id, type: params.type==='serve'?'serve':'shot', label, x, y, params: { speedMps: clamp(params.speedMps, 1, 20), spinRps: clamp(params.spinRps, -120, 120), elevationDeg: clamp(params.elevationDeg, -20, 45), aimDeg: clamp(params.aimDeg, -60, 60) } }; }
  function makeLinearDrill(name, description, shots, delay = 0.9) {
    const nodes = shots.map((s, i) => newShot(`shot-${Date.now()}-${i}`, s.label || `Ball ${i+1}`, s, 260 + i*270, 260));
    const edges = nodes.slice(0,-1).map((n,i) => ({ id:`edge-${Date.now()}-${i}`, source:n.id, sourceSlot:'next', target:nodes[i+1].id, weight:1, delaySeconds:delay }));
    return { id:`ai-${Date.now()}`, name, description, tags:['ai-created'], robotPoseReference:'base_back', robotPose:{x:0,y:0,yawDeg:0}, startNodeId:nodes[0]?.id||null, settings:{repetitions:3,delayBetweenSets:1}, nodes, edges };
  }
  function promptRequestsFreshDrill(prompt) { return /\b(give me|create(?: me)?|new drill|make me|build me|design me)\b/i.test(String(prompt || '')); }
  function localGenerate(prompt, current) {
    const p = String(prompt||'').toLowerCase();
    const asksForFreshDrill = promptRequestsFreshDrill(prompt);
    let drill = current && !asksForFreshDrill ? clone(current) : null;
    const summary=[];
    if (!drill) {
      if (p.includes('serve')) { drill = makeLinearDrill('Serve practice','Serve feed with three rendered arcs: server bounce, receiver first bounce, then receiver second bounce or the display limit.',[{type:'serve',label:'Serve',speedMps:5.0,spinRps:-8,elevationDeg:-16,aimDeg:0}],1); summary.push('Created a serve practice drill with a dedicated Serve node.'); }
      else if (p.includes('falkenberg')) { drill = makeLinearDrill('Falkenberg practice','Classic movement pattern: backhand, forehand from backhand corner, wide forehand.',[{label:'Backhand',speedMps:7.0,spinRps:20,elevationDeg:9,aimDeg:-10},{label:'Forehand from BH corner',speedMps:7.2,spinRps:22,elevationDeg:9,aimDeg:-4},{label:'Wide forehand',speedMps:7.5,spinRps:22,elevationDeg:8.5,aimDeg:14}],0.9); summary.push('Created a three-ball Falkenberg-style footwork pattern.'); }
      else if (p.includes('backspin') || p.includes('underspin') || p.includes('opening')) { drill = makeLinearDrill('Backspin opening practice','Start against underspin, then recover to a topspin ball.',[{label:'Underspin',speedMps:5.0,spinRps:-22,elevationDeg:13,aimDeg:-4},{label:'Underspin variation',speedMps:5.2,spinRps:-18,elevationDeg:12.5,aimDeg:6},{label:'Recovery topspin',speedMps:7.0,spinRps:20,elevationDeg:9,aimDeg:0}],1.05); summary.push('Created an opening drill with two underspin feeds and a recovery topspin.'); }
      else if (p.includes('warm') || p.includes('alternate')) { drill = makeLinearDrill('Alternating warm-up','Comfortable alternating forehand/backhand warm-up.',[{label:'Backhand',speedMps:5.8,spinRps:8,elevationDeg:10.5,aimDeg:-8},{label:'Forehand',speedMps:5.8,spinRps:8,elevationDeg:10.5,aimDeg:8}],1.05); drill.settings.repetitions=0; summary.push('Created an indefinitely repeating two-point warm-up.'); }
      else { drill = makeLinearDrill('Two-point consistency','A simple controllable forehand/backhand consistency drill.',[{label:'Backhand',speedMps:6.2,spinRps:12,elevationDeg:10,aimDeg:-8},{label:'Forehand',speedMps:6.2,spinRps:12,elevationDeg:10,aimDeg:8}],1); summary.push('Created a balanced two-point starting drill.'); }
    }
    if (current && /\badd\b.*\bserve\b/.test(p) && !drill.nodes.some(n=>n.type==='serve')) {
      const id=`serve-${Date.now()}`; const serve=newShot(id,'Serve',{type:'serve',speedMps:5,spinRps:-8,elevationDeg:-16,aimDeg:0},260+drill.nodes.length*270,260);
      const terminal=drill.nodes.find(n=>['shot','serve','drill'].includes(n.type)&&!drill.edges.some(e=>e.source===n.id)); drill.nodes.push(serve);
      if(terminal)drill.edges.push({id:`edge-${Date.now()}-serve`,source:terminal.id,sourceSlot:'next',target:id,weight:1,delaySeconds:1});
      if(!drill.startNodeId)drill.startNodeId=id; summary.push('Added a dedicated Serve node.');
    }
    const shots = drill.nodes.filter(n => n.type === 'shot' || n.type === 'serve');
    const pct = p.match(/(\d+(?:\.\d+)?)\s*%\s*(?:faster|more speed)/);
    if (pct) { const factor=1+Number(pct[1])/100; shots.forEach(n=>n.params.speedMps=clamp(n.params.speedMps*factor,1,20)); summary.push(`Increased ball speed by ${pct[1]}%.`); }
    if (p.includes('slower')) { shots.forEach(n=>n.params.speedMps=clamp(n.params.speedMps*.9,1,20)); summary.push('Reduced ball speed by about 10%.'); }
    if (p.includes('less spin') || p.includes('reduce the spin')) { shots.forEach(n=>n.params.spinRps*=.8); summary.push('Reduced spin by about 20%.'); }
    if (p.includes('more spin') || p.includes('heavy')) { shots.forEach(n=>n.params.spinRps=clamp(n.params.spinRps*1.2,-120,120)); summary.push('Increased spin while preserving the pattern.'); }
    if (p.includes('recovery') || p.includes('longer delay')) { drill.edges.forEach(e=>e.delaySeconds=Math.min(2,e.delaySeconds+.2)); summary.push('Added recovery time between balls.'); }
    if (p.includes('wide forehand')) { const last=shots.at(-1); if(last){last.params.aimDeg=Math.max(last.params.aimDeg,14); last.label='Wide forehand'; summary.push('Added/emphasized a wide forehand placement.');} }
    if (p.includes('harder')) { shots.forEach(n=>{n.params.speedMps=clamp(n.params.speedMps*1.08,1,20); n.params.spinRps=clamp(n.params.spinRps*1.1,-120,120);}); drill.edges.forEach(e=>e.delaySeconds=Math.max(.667,e.delaySeconds*.92)); summary.push('Made the drill harder with modestly more speed/spin and less recovery time.'); }
    if (p.includes('easier')) { shots.forEach(n=>{n.params.speedMps=clamp(n.params.speedMps*.9,1,20); n.params.spinRps*=.85;}); drill.edges.forEach(e=>e.delaySeconds=Math.min(2,e.delaySeconds*1.1)); summary.push('Made the drill easier with less speed/spin and more recovery time.'); }
    if (p.includes('match-like')) { drill.tags=[...new Set([...(drill.tags||[]),'match-like'])]; shots.forEach((n,i)=>{if(i%2)n.params.aimDeg=clamp(n.params.aimDeg*1.12,-60,60);}); summary.push('Made placements a little more demanding while preserving the training pattern.'); }
    drill.description = drill.description || String(prompt).slice(0,300); return { drill, summary:summary.join(' ')||'Prepared a validated drill proposal.' };
  }
  function proposalPortableFromDrill(drill) { return Core.makePortableDrill(drill); }
  function showAiProposal(portable, summary, { intent = null } = {}) {
    const check=Core.validatePortableDrill(portable); if(!check.valid)throw new Error(check.errors[0]);
    const validation=api.validateDrill(portable.drill); if(!validation.valid)throw new Error(validation.errors[0]);
    aiState.proposalPortable=portable; aiState.proposal=portable.drill;
    aiState.proposalIntent=intent || (api.getActiveDrill() ? 'edit' : 'create');
    $('aiProposalSummary').textContent=summary||`Ready to ${aiState.proposalIntent === 'create' ? 'create' : 'update'} “${portable.name}”.`;
    $('aiApplyBtn').textContent=aiState.proposalIntent === 'create' ? 'Create drill' : 'Apply changes';
    const shots=portable.drill.nodes.filter(n=>n.type==='shot'||n.type==='serve'); const serves=shots.filter(n=>n.type==='serve'); $('aiProposalDetails').innerHTML=`<div><strong>${escapeHtml(portable.name)}</strong><span>${shots.length} ball nodes${serves.length?` · ${serves.length} serves`:''} · ${portable.drill.edges.length} connections</span></div><ul>${shots.slice(0,6).map(s=>`<li>${escapeHtml(s.label)} · ${s.type==='serve'?'serve · ':''}${s.params.speedMps.toFixed(1)} m/s · ${s.params.spinRps.toFixed(0)} rps · aim ${s.params.aimDeg.toFixed(1)}°</li>`).join('')}</ul>`;
    $('aiProposal').hidden=false; $('aiStatus').textContent='Proposal passed local structure and range validation.';
  }
  function openAiDialog() { aiState.proposalIntent='edit'; $('aiDrillPrompt').value=''; $('aiProposal').hidden=true; $('aiApplyBtn').textContent='Apply changes'; $('aiStatus').textContent=api.isActiveBuiltIn()?'This is a built-in drill. Ask for a change to copy it first, or explicitly ask for a new drill.':'Describe what you want to create or change.'; showDialog(aiDialog); }
  function externalRequest() { const request=$('aiDrillPrompt').value.trim(); return Core.buildExternalAiRequest({ currentDrill: promptRequestsFreshDrill(request) ? null : api.getActiveDrill(), userRequest: request }); }
  function updateAiMode() { aiState.mode=document.querySelector('input[name="aiMode"]:checked')?.value||'builtin'; $('aiByokPanel').hidden=aiState.mode!=='byok'; $('aiExternalPanel').hidden=aiState.mode!=='external'; $('aiGenerateBtn').textContent=aiState.mode==='external'?'Prepare request':'Generate'; }
  aiDialog.querySelectorAll('input[name="aiMode"]').forEach(r=>r.addEventListener('change',updateAiMode));
  $('aiProvider').addEventListener('change',()=>{aiState.provider=$('aiProvider').value;}); $('aiKeyInput').addEventListener('input',()=>{aiState.key=$('aiKeyInput').value;}); $('aiModelInput').addEventListener('input',()=>{aiState.model=$('aiModelInput').value.trim();});
  $('aiForgetKeyBtn').addEventListener('click',()=>{aiState.key='';$('aiKeyInput').value='';api.toast('API key forgotten');});
  $('aiProviderHelpBtn').addEventListener('click',()=>{const urls={openai:'https://platform.openai.com/api-keys',anthropic:'https://console.anthropic.com/settings/keys',gemini:'https://aistudio.google.com/app/apikey',openrouter:'https://openrouter.ai/settings/keys'};window.open(urls[aiState.provider]||urls.openai,'_blank','noopener');});
  async function callByok(prompt) {
    if(!aiState.key)throw new Error('Enter an API key first.');if(!aiState.model)throw new Error('Enter the provider model ID first.');const req=Core.buildExternalAiRequest({currentDrill:promptRequestsFreshDrill(prompt)?null:api.getActiveDrill(),userRequest:prompt});
    if(aiState.provider==='openai'){const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${aiState.key}`},body:JSON.stringify({model:aiState.model,input:req})});if(!r.ok)throw new Error(`OpenAI returned ${r.status}.`);const j=await r.json();return j.output_text||j.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'';}
    if(aiState.provider==='anthropic'){const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':aiState.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:aiState.model,max_tokens:5000,messages:[{role:'user',content:req}]})});if(!r.ok)throw new Error(`Anthropic returned ${r.status}.`);const j=await r.json();return (j.content||[]).map(x=>x.text||'').join('\n');}
    if(aiState.provider==='gemini'){const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiState.model)}:generateContent?key=${encodeURIComponent(aiState.key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:req}]}]})});if(!r.ok)throw new Error(`Gemini returned ${r.status}.`);const j=await r.json();return j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n')||'';}
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${aiState.key}`},body:JSON.stringify({model:aiState.model,messages:[{role:'user',content:req}]})});if(!r.ok)throw new Error(`OpenRouter returned ${r.status}.`);const j=await r.json();return j.choices?.[0]?.message?.content||'';
  }
  $('aiGenerateBtn').addEventListener('click', async()=>{
    const prompt=$('aiDrillPrompt').value.trim(); if(!prompt){api.toast('Describe the drill or change first.');return;}
    if(aiState.mode==='external'){await copyText(externalRequest(),'Self-contained AI request copied');$('aiStatus').textContent='Paste that request into your preferred AI, then use Paste AI result or Import AI drill file.';return;}
    $('aiGenerateBtn').disabled=true;$('aiStatus').textContent='Generating and validating proposal…';try{
      const intent=promptRequestsFreshDrill(prompt)?'create':(api.getActiveDrill()?'edit':'create');
      if(aiState.mode==='byok'){const text=await callByok(prompt);showAiProposal(Core.parseExternalAiResult(text),'Proposal returned by your selected AI provider.',{intent});}
      else {const result=localGenerate(prompt,api.getActiveDrill());showAiProposal(proposalPortableFromDrill(result.drill),result.summary,{intent});}
    }catch(e){$('aiStatus').textContent=`Could not generate: ${e.message} You can edit manually or use another AI.`;}finally{$('aiGenerateBtn').disabled=false;}
  });
  $('aiTryAgainBtn').addEventListener('click',()=>{$('aiProposal').hidden=true;$('aiDrillPrompt').focus();});
  $('aiApplyBtn').addEventListener('click',()=>{if(!aiState.proposal)return;try{if(aiState.proposalIntent==='create'){api.addUserDrill(aiState.proposal);}else{let current=api.getActiveDrill();if(current&&api.isActiveBuiltIn()){api.copyActiveBuiltInToMyDrills();current=api.getActiveDrill();}if(current)api.replaceActiveUserDrill(aiState.proposal);else api.addUserDrill(aiState.proposal);}closeDialog(aiDialog);api.navigateApp('editor',{push:true,allowBuiltInEditor:true});api.toast(aiState.proposalIntent==='create'?'New drill created':'AI changes applied');}catch(e){$('aiStatus').textContent=e.message;}});
  $('aiCopyRequestBtn').addEventListener('click',()=>copyText(externalRequest(),'AI request copied'));
  $('aiDownloadRequestBtn').addEventListener('click',()=>{const fresh=promptRequestsFreshDrill($('aiDrillPrompt').value.trim());download(fresh?'table-tennis-robot-create-drill.md':'table-tennis-robot-edit-drill.md',externalRequest(),'text/markdown');});
  $('aiPasteResultBtn').addEventListener('click',()=>showDialog(aiPasteDialog));
  $('aiParsePasteBtn').addEventListener('click',()=>{try{const p=Core.parseExternalAiResult($('aiPasteArea').value);closeDialog(aiPasteDialog);showAiProposal(p,'Imported from external AI response.',{intent:promptRequestsFreshDrill($('aiDrillPrompt').value.trim())?'create':(api.getActiveDrill()?'edit':'create')});}catch(e){api.toast(e.message);}});
  $('aiImportResultBtn').addEventListener('click',()=>aiImportInput.click()); aiImportInput.addEventListener('change',async()=>{const f=aiImportInput.files?.[0];aiImportInput.value='';if(!f)return;try{showAiProposal(JSON.parse(await f.text()),'Imported AI drill file.',{intent:promptRequestsFreshDrill($('aiDrillPrompt').value.trim())?'create':(api.getActiveDrill()?'edit':'create')});}catch(e){api.toast(e.message);}});
  const SpeechRecognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
  if(SpeechRecognition){const rec=new SpeechRecognition();rec.continuous=false;rec.interimResults=true;rec.lang=document.documentElement.lang||'en-US';aiState.recognition=rec;let base='';rec.onstart=()=>{aiState.listening=true;base=$('aiDrillPrompt').value.trim();$('aiMicBtn').textContent='■ Stop';$('aiSpeechHint').textContent='Listening… transcript will remain editable before Generate.';};rec.onresult=e=>{let spoken='';for(let i=e.resultIndex;i<e.results.length;i++)spoken+=e.results[i][0].transcript;$('aiDrillPrompt').value=[base,spoken].filter(Boolean).join(base?' ':'');};rec.onend=()=>{aiState.listening=false;$('aiMicBtn').textContent='🎙 Speak';$('aiSpeechHint').textContent='Speech stopped. Review the transcript, then press Generate.';};rec.onerror=e=>{$('aiSpeechHint').textContent=`Speech input stopped: ${e.error}. Typing still works.`;};$('aiMicBtn').addEventListener('click',()=>{try{aiState.listening?rec.stop():rec.start();}catch(_){}});}else{$('aiMicBtn').disabled=true;$('aiSpeechHint').textContent='Speech recognition is not available in this browser; type your request instead.';}
  function installAiButton(){const header=document.querySelector('.editor-screen-header');if(header&&!$('aiDrillBtn'))header.insertBefore(h('button',{id:'aiDrillBtn',class:'button compact ghost',type:'button',text:'✨ AI assist','aria-label':'AI assist',onclick:openAiDialog}),$('editorShareBtn')||$('editorRunBtn'));const mount=$('inspectorAiMount');if(mount&&!$('inspectorAiBtn'))mount.appendChild(h('button',{id:'inspectorAiBtn',class:'button compact ghost',type:'button',text:'✨',title:'AI assist','aria-label':'AI assist',onclick:openAiDialog}));}

  // Install UI after the base app has initialized.
  installShareButtons(); installAiButton();
  const coreScript=document.querySelector('script[src="studio-features-core.js"]'); void coreScript;

  // Shared URL import is deliberately preview-only.
  try { const shared=Core.parseShareHash(location.hash); if(shared) setTimeout(()=>previewPortable(shared,'share-url'),40); } catch(e) { setTimeout(()=>api.toast(`Shared drill could not be opened: ${e.message}`),100); }
})();
