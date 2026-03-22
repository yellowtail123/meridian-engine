// ═══ MERIDIAN DATA — Data Layer Module ═══
// IndexedDB, screening, literature search, species, environmental data

// ═══ IndexedDB Paper Library ═══
// Schema: MeridianLib v9 — stores: 'papers' (keyPath: 'id'), 'collections' (keyPath: 'id'),
// 'chats' (keyPath: 'id'), 'geo' (keyPath: 'id'), 'screening' (keyPath: 'paperId'),
// 'padi_tfidf' (keyPath: 'id'), 'padi_bayes' (keyPath: 'id'), 'padi_graph' (keyPath: 'id'),
// 'bathymetry' (keyPath: 'key'), 'brainmaps' (keyPath: 'id')
// FROZEN: Do not change without adding migration in onupgradeneeded
let db=null;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('MeridianLib',9);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('papers'))d.createObjectStore('papers',{keyPath:'id'});if(!d.objectStoreNames.contains('collections'))d.createObjectStore('collections',{keyPath:'id'});if(!d.objectStoreNames.contains('chats'))d.createObjectStore('chats',{keyPath:'id'});if(!d.objectStoreNames.contains('geo'))d.createObjectStore('geo',{keyPath:'id'});if(!d.objectStoreNames.contains('screening'))d.createObjectStore('screening',{keyPath:'paperId'});if(!d.objectStoreNames.contains('padi_tfidf'))d.createObjectStore('padi_tfidf',{keyPath:'id'});if(!d.objectStoreNames.contains('padi_bayes'))d.createObjectStore('padi_bayes',{keyPath:'id'});if(!d.objectStoreNames.contains('padi_graph'))d.createObjectStore('padi_graph',{keyPath:'id'});if(!d.objectStoreNames.contains('bathymetry'))d.createObjectStore('bathymetry',{keyPath:'key'});if(!d.objectStoreNames.contains('brainmaps'))d.createObjectStore('brainmaps',{keyPath:'id'})};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=e=>rej(e)})}
function dbPutChat(msgs){return new Promise((r,j)=>{const tx=db.transaction('chats','readwrite');tx.objectStore('chats').put({id:'main',messages:msgs,updatedAt:new Date().toISOString()});tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
function dbGetChat(){return new Promise((r,j)=>{const tx=db.transaction('chats','readonly');const req=tx.objectStore('chats').get('main');req.onsuccess=()=>r(req.result?.messages||[]);req.onerror=e=>j(e.target.error)})}
function dbPut(p){return new Promise((r,j)=>{const tx=db.transaction('papers','readwrite');tx.objectStore('papers').put(p);tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
function dbAll(){return new Promise((r,j)=>{const tx=db.transaction('papers','readonly');const req=tx.objectStore('papers').getAll();req.onsuccess=()=>r(req.result);req.onerror=e=>j(e.target.error)})}
function dbDel(id){return new Promise((r,j)=>{const tx=db.transaction('papers','readwrite');tx.objectStore('papers').delete(id);tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
// ═══ SCREENING DB HELPERS ═══
function dbPutScreen(s){return new Promise((r,j)=>{const tx=db.transaction('screening','readwrite');tx.objectStore('screening').put(s);tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
function dbGetScreen(paperId){return new Promise((r,j)=>{const tx=db.transaction('screening','readonly');const req=tx.objectStore('screening').get(paperId);req.onsuccess=()=>r(req.result||null);req.onerror=e=>j(e.target.error)})}
function dbGetAllScreening(){return new Promise((r,j)=>{const tx=db.transaction('screening','readonly');const req=tx.objectStore('screening').getAll();req.onsuccess=()=>r(req.result||[]);req.onerror=e=>j(e.target.error)})}
function saveCol(col){return new Promise((r,j)=>{const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put(col);tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
function loadCols(){return new Promise((r,j)=>{const tx=db.transaction('collections','readonly');const req=tx.objectStore('collections').getAll();req.onsuccess=()=>{const cols={};(req.result||[]).forEach(c=>{cols[c.id]=c});r(cols)};req.onerror=e=>j(e.target.error)})}
// ═══ BATHYMETRY CACHE HELPERS ═══
function dbPutBathy(key,data){return new Promise((r,j)=>{const tx=db.transaction('bathymetry','readwrite');tx.objectStore('bathymetry').put({key,...data});tx.oncomplete=()=>r();tx.onerror=e=>j(e.target.error)})}
function dbGetBathy(key){return new Promise((r,j)=>{const tx=db.transaction('bathymetry','readonly');const req=tx.objectStore('bathymetry').get(key);req.onsuccess=()=>r(req.result||null);req.onerror=e=>j(e.target.error)})}
function saveNote(id,txt){const p=S.lib.find(x=>x.id===id);if(p){p.notes=txt;dbPut(p).catch(()=>toast('Failed to save note','err'));if(typeof PADI!=='undefined'&&PADI.engTrack)PADI.engTrack(id,'note',{len:txt.length})}}
async function savePaper(p){_errPipeline.crumb('action','Save paper: '+(p.title||'').slice(0,50));if(!db)await openDB();const existing=S.lib.find(x=>x.id===p.id);const pp={...p,id:p.id||'m'+Date.now()+Math.random(),savedAt:existing?.savedAt||new Date().toISOString(),tags:existing?.tags||p.tags||[],notes:existing?.notes||p.notes||'',findings:existing?.findings||p.findings||null,project:existing?.project||p.project||S.activeProject||'Default'};await dbPut(pp);await loadLib();
if(typeof PADI!=='undefined'&&PADI.onPaperSaved)PADI.onPaperSaved(pp);
// Flash confirmation on the button that triggered this
const btns=document.querySelectorAll('.bt.sm.on');btns.forEach(b=>{if(b.textContent.includes('Save')&&!b._flashing){b._flashing=true;const orig=b.textContent;b.textContent='✓ Saved!';b.style.color='var(--sg)';b.style.borderColor='var(--sb)';setTimeout(()=>{b.textContent=orig;b.style.color='';b.style.borderColor='';b._flashing=false},1200)}})}
async function saveAllToLib(){for(const p of S.litR)await savePaper(p);goTab('library')}
async function loadLib(){if(!db)await openDB();S.lib=await dbAll();const c=$('#libc');if(c){if(S.lib.length){c.textContent=S.lib.length;sh(c)}else hi(c)}}

function renderLib(resetLimit){
  if(resetLimit)_libLimit=30;
  if(typeof _simCardCount!=='undefined')_simCardCount=0;
  const sq=$('#lib-search-input')?.value?.trim()||'';
  const sqLower=sq.toLowerCase();
  const advTokens=parseAdvancedQuery(sq);
  let fl=sq?(advTokens?S.lib.filter(p=>matchAdvancedQuery(p,advTokens)):S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' '),(p.tags||[]).join(' '),p.journal||''].join(' ').toLowerCase();return sqLower.split(/\s+/).every(w=>hay.includes(w))})):S.lib;
  // Project filter (applied before collection filter)
  const projects=getProjects();const curProj=S.activeProject||'Default';
  if(projects.length>1)fl=fl.filter(p=>(p.project||'Default')===curProj);
  if(S.activeCol&&S.cols[S.activeCol])fl=fl.filter(p=>S.cols[S.activeCol].paperIds.includes(p.id));
  const numP=/(\d+\.?\d*)\s*(°C|ppm|mg\/[lL]|cm|mm|kg|g|m|%|PSU|yr|years?|samples?|specimens?)/gi;
  const colKeys=Object.keys(S.cols);
  const projBar=projects.length>1||S.lib.length>0?`<div style="margin-bottom:10px;display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:var(--tm);font-family:var(--mf)">Project:</span>${projects.map(p=>`<button class="bt sm ${curProj===p?'on':''}" onclick="switchProject('${escJSAttr(p)}')" ondblclick="renameProject('${escJSAttr(p)}')" title="Click to switch, double-click to rename">${escHTML(p)} (${S.lib.filter(x=>(x.project||'Default')===p).length})</button>`).join('')}<button class="bt sm" onclick="createProject()" title="Create a new project">+ New Project</button></div>`:'';
  const colBar=`<div style="margin-bottom:10px;display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:var(--tm);font-family:var(--mf)">Collections:</span><button class="bt sm" onclick="newCol()">+ New</button>${colKeys.map(k=>`<button class="bt sm ${S.activeCol===k?'on':''}" onclick="S.activeCol=S.activeCol==='${k}'?'':('${k}');renderLib(true)">${S.cols[k].name} (${S.cols[k].paperIds.length})</button>`).join('')}${S.activeCol?`<button class="bt sm" onclick="S.activeCol='';renderLib(true)">All Papers</button>`:''}</div>`;
  // Apply reading status filter
  if(S.libStatusFilter&&S.libStatusFilter!=='all'){fl=fl.filter(p=>{const st=_readingStatus[p.id]||'unread';return st===S.libStatusFilter})}
  // Apply sort
  const sortKey=S.libSort||'recent';
  if(sortKey==='oldest')fl=[...fl].reverse();
  else if(sortKey==='year-new')fl=[...fl].sort((a,b)=>(b.year||0)-(a.year||0));
  else if(sortKey==='year-old')fl=[...fl].sort((a,b)=>(a.year||0)-(b.year||0));
  else if(sortKey==='cited-most')fl=[...fl].sort((a,b)=>(b.cited||0)-(a.cited||0));
  else if(sortKey==='cited-least')fl=[...fl].sort((a,b)=>(a.cited||0)-(b.cited||0));
  else if(sortKey==='title-az')fl=[...fl].sort((a,b)=>(a.title||'').localeCompare(b.title||''));
  else if(sortKey==='status')fl=[...fl].sort((a,b)=>{const order={reviewed:0,read:1,skimming:2,unread:3};return(order[_readingStatus[a.id]||'unread']||3)-(order[_readingStatus[b.id]||'unread']||3)});
  // Compute status counts from current filtered set (before status filter is applied)
  const statusCounts={all:fl.length,unread:0,skimming:0,read:0,reviewed:0};
  fl.forEach(p=>{const st=_readingStatus[p.id]||'unread';if(statusCounts.hasOwnProperty(st))statusCounts[st]++});
  if(_picoMode){_renderPicoView(fl);return}
  H('#lib-content',`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="bt sm on" onclick="_picoMode=false;renderLib(true)">Standard View</button><button class="bt sm" onclick="_picoMode=true;renderLib(true)">Systematic Review</button></div>
  <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap"><input class="si" id="lib-search-input" placeholder="Search papers... (try author:Smith year:2023)" value="${sq}" oninput="_dRenderLib()" style="flex:1;min-width:200px;padding:8px 14px;font-size:13px;font-family:var(--mf)"/>
  <select class="fs" id="lib-sort" onchange="S.libSort=this.value;renderLib()" style="padding:8px;font-size:12px"><option value="recent"${sortKey==='recent'?' selected':''}>Recently Added</option><option value="oldest"${sortKey==='oldest'?' selected':''}>Oldest Added</option><option value="year-new"${sortKey==='year-new'?' selected':''}>Year (Newest)</option><option value="year-old"${sortKey==='year-old'?' selected':''}>Year (Oldest)</option><option value="cited-most"${sortKey==='cited-most'?' selected':''}>Most Cited</option><option value="cited-least"${sortKey==='cited-least'?' selected':''}>Least Cited</option><option value="title-az"${sortKey==='title-az'?' selected':''}>Title A-Z</option><option value="status"${sortKey==='status'?' selected':''}>Reading Status</option></select></div>
  ${typeof PADI!=='undefined'?PADI.statusHTML():''}
  ${typeof PADI!=='undefined'&&PADI.tfidf&&PADI.tfidf.N>=5?(()=>{const terms=PADI.tfidf.profile();return terms.length?`<div style="margin-bottom:10px;padding:10px 14px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd)"><div style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">PADI Insights</div><div style="display:flex;flex-wrap:wrap;gap:4px">${terms.slice(0,5).map(t=>`<span style="display:inline-block;font-size:12px;padding:3px 10px;border-radius:4px;background:var(--ab);color:var(--ac);border:1px solid var(--bd);cursor:pointer" onclick="goTab('lit');setTimeout(()=>{const q=document.getElementById('lq');if(q){q.value='${escJSAttr(t.term)}';q.dispatchEvent(new Event('input'))}},100)" title="Search literature for: ${escJSAttr(t.term)}">${escHTML(t.term)}</span>`).join('')}</div></div>`:''})():''}
  ${projBar}
  <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">${[['all','All'],['unread','Unread'],['skimming','Skimming'],['read','Read'],['reviewed','Reviewed']].map(([k,l])=>`<button class="bt sm ${(S.libStatusFilter||'all')===k?'on':''}" onclick="S.libStatusFilter='${k}';renderLib(true)">${l} (${statusCounts[k]||0})</button>`).join('')}</div>
  ${colBar}
  ${typeof PADI!=='undefined'?PADI.profileHTML():''}
  <div id="lib-action-row" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;font-size:12px;color:var(--tm);font-family:var(--mf);align-items:center"><span>${fl.length}/${S.lib.length} papers${S.activeCol?' (filtered by collection)':''}</span>
  <button class="bt sm on" onclick="compileLibWS()">Compile → Workshop</button>
  <button class="bt sm" onclick="extractLibNums()">Extract Numbers</button>
  <button class="bt sm" onclick="extractAllFindings()">🔬 Extract All Findings</button>
  <button class="bt sm" style="border-color:var(--sb);color:var(--sg)" onclick="aiSummarize()">🧠 AI Summary & Compare</button>
  <button class="bt sm" onclick="dlLibCSV()">Export CSV</button><button class="bt sm" onclick="exportBibTeX()">BibTeX</button><button class="bt sm" onclick="exportRIS()">RIS</button><button class="bt sm" onclick="openCitePanel()">Citations</button><button class="bt sm" style="color:var(--co)" onclick="deleteFiltered()">Delete Filtered</button><button class="bt sm" style="color:var(--co)" onclick="clearAllLibrary()">Clear All Library</button>
  <button class="bt sm ${S.batchMode?'on':''}" onclick="toggleBatchMode()">☐ Select</button></div>
  ${S.batchMode?`<div id="batch-bar" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:var(--am);border:1px solid var(--ab);border-radius:6px;font-size:12px;font-family:var(--mf)"><span style="color:var(--ac)">${S.batchSelected.size} selected</span><button class="bt sm" onclick="batchTag()">Tag All</button><button class="bt sm" onclick="batchSetStatus()">Set Status</button><button class="bt sm" onclick="batchAddToCol()">Add to Collection</button><button class="bt sm" onclick="batchExport()">Export Selected</button><button class="bt sm" style="color:var(--co)" onclick="batchDelete()">Delete Selected</button><button class="bt sm" onclick="S.batchSelected=new Set(fl.map(p=>p.id));renderLib()">Select All</button><button class="bt sm" onclick="S.batchSelected.clear();renderLib()">Clear</button></div>`:''}
  <div id="lib-summary"></div>
  ${!fl.length?emptyState('<svg width="36" height="36" viewBox="0 0 16 16" style="stroke:var(--ac);fill:none;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round"><rect x="2" y="3" width="4" height="11" rx="0.5"/><rect x="7" y="2" width="3.5" height="12" rx="0.5"/><path d="M12 14l2-12"/></svg>','No Papers Yet','Save papers from Literature search, or import by DOI. Papers persist locally between sessions.','<button class="bt on" onclick="goTab(\'lit\')">Go to Literature</button><button class="bt sm" onclick="goTab(\'lit\');setTimeout(()=>$(\'#doi-input\').focus(),100)">Import by DOI</button>'):''}
  ${fl.slice(0,_libLimit).map((p,i)=>{const nums=(p.abstract||'').match(numP)||[];return`<div class="lib-card" data-paper-id="${escJSAttr(p.id)}">${S.batchMode?`<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;font-size:12px;font-family:var(--mf);color:var(--ac)"><input type="checkbox" ${S.batchSelected.has(p.id)?'checked':''} onchange="this.checked?S.batchSelected.add('${escJSAttr(p.id)}'):S.batchSelected.delete('${escJSAttr(p.id)}');document.querySelector('#batch-bar span').textContent=S.batchSelected.size+' selected'" style="accent-color:var(--ac)"/> Select</label>`:''}<div style="display:flex;justify-content:space-between;gap:8px"><div style="flex:1;min-width:0"><div class="lib-card-title" style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(p.title||'')}</div><div style="font-size:12px;color:var(--tm)">${(p.authors||[]).slice(0,3).join(', ')} · ${p.year||''} · ${p.journal||''}${p.cited?' · '+p.cited+' cited':''}</div>${(p.tags||[]).length?`<div style="margin-top:2px">${p.tags.map(t=>`<span class="lib-tag">${t}</span>`).join('')}</div>`:''}${nums.length?`<div style="margin-top:3px;font-size:12px;color:var(--sg);font-family:var(--mf)">Data: ${nums.slice(0,4).join(', ')}</div>`:''}${p.findings?`<div style="margin-top:3px;font-size:12px;color:var(--lv);font-family:var(--mf)">🔬 ${[p.findings.location&&'📍'+p.findings.location,p.findings.n&&'n='+p.findings.n,p.findings.method,p.findings.finding].filter(Boolean).join(' · ')}</div>`:''}
<div style="margin-top:4px">
  <textarea id="note-${escHTML(p.id)}" style="display:none;width:100%;padding:6px;background:var(--bi);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px;font-family:var(--mf);resize:vertical;min-height:60px" onblur="saveNote('${escJSAttr(p.id)}',this.value)" placeholder="Research notes...">${escHTML(p.notes||'')}</textarea>
  <span style="font-size:12px;color:var(--tm);cursor:pointer" onclick="document.getElementById('note-${escJSAttr(p.id)}').style.display=document.getElementById('note-${escJSAttr(p.id)}').style.display==='none'?'block':'none';if(typeof PADI!=='undefined'&&PADI.engTrack)PADI.engTrack('${escJSAttr(p.id)}','view')">${p.notes?'📝 '+escHTML(p.notes.slice(0,60))+(p.notes.length>60?'…':''):'📝 Add note'}</span>
</div>${typeof PADI!=='undefined'?PADI.similarHTML(p.id):''}</div><div class="lib-card-actions" style="flex-shrink:0;display:flex;flex-direction:column;gap:4px"><div style="display:flex;gap:4px"><button class="bt sm" aria-label="Add tags" onclick="promptTag('${escJSAttr(p.id)}')">🏷</button> <button class="bt sm" aria-label="Extract findings" onclick="event.stopPropagation();extractFindings('${escJSAttr(p.id)}')">🔬</button> <button class="bt sm" aria-label="Delete paper" style="color:var(--co)" onclick="dbDelWithUndo('${escJSAttr(p.id)}').then(loadLib).then(renderLib)">×</button></div>${colKeys.length?`<button class="bt sm" style="font-size:10px" onclick="addToCol('${escJSAttr(p.id)}')">+Col</button>`:''}${projects.length>1?`<button class="bt sm" style="font-size:10px" onclick="moveToProject('${escJSAttr(p.id)}')">Move</button>`:''}</div></div></div>`}).join('')}`);
  if(fl.length>_libLimit){const lmc=document.createElement('button');lmc.className='load-more-btn';lmc.textContent='Load more (showing '+Math.min(_libLimit,fl.length)+'/'+fl.length+')';lmc.onclick=()=>{_libLimit+=30;renderLib()};$('#lib-content')?.appendChild(lmc)}
}
let _libLimit=30;
let _picoMode=false;
let _picoScreenIdx=0;

function _renderPicoView(papers){
  const pico=safeParse('meridian_pico',{});
  const screening=safeParse('meridian_screening',{});
  const screened=Object.keys(screening).length;
  const included=Object.values(screening).filter(s=>s.decision==='include').length;
  const excluded=Object.values(screening).filter(s=>s.decision==='exclude').length;
  const uncertain=Object.values(screening).filter(s=>s.decision==='uncertain').length;

  H('#lib-content',`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="bt sm" onclick="_picoMode=false;renderLib(true)">Standard View</button><button class="bt sm on" onclick="_picoMode=true;renderLib(true)">Systematic Review</button></div>

  <div class="sec" style="margin-bottom:12px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.querySelector('span:last-child').textContent=this.nextElementSibling.style.display==='none'?'&#9656;':'&#9662;'"><h4>Step 1: PICO Criteria</h4><span style="color:var(--tm)">&#9662;</span></div><div class="sb">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:700px">
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Population:
        <input class="si" id="pico-pop" value="${escHTML(pico.population||'')}" placeholder="e.g. Coral reef ecosystems, Indo-Pacific" style="width:100%;margin-top:2px">
      </label>
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Intervention / Exposure:
        <input class="si" id="pico-int" value="${escHTML(pico.intervention||'')}" placeholder="e.g. Ocean warming events" style="width:100%;margin-top:2px">
      </label>
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Comparison:
        <input class="si" id="pico-comp" value="${escHTML(pico.comparison||'')}" placeholder="e.g. Bleaching vs non-bleaching periods" style="width:100%;margin-top:2px">
      </label>
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Outcome:
        <input class="si" id="pico-out" value="${escHTML(pico.outcome||'')}" placeholder="e.g. Species diversity, coral cover" style="width:100%;margin-top:2px">
      </label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:700px;margin-top:8px">
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Inclusion criteria (one per line):
        <textarea class="si" id="pico-inc" rows="3" style="width:100%;margin-top:2px;font-size:12px;resize:vertical">${escHTML((pico.inclusion||[]).join('\n'))}</textarea>
      </label>
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Exclusion criteria (one per line):
        <textarea class="si" id="pico-exc" rows="3" style="width:100%;margin-top:2px;font-size:12px;resize:vertical">${escHTML((pico.exclusion||[]).join('\n'))}</textarea>
      </label>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;align-items:center">
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Date range: <input class="si" id="pico-yf" type="number" value="${pico.dateFrom||''}" placeholder="From year" style="width:80px"> to <input class="si" id="pico-yt" type="number" value="${pico.dateTo||''}" placeholder="To year" style="width:80px"></label>
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Study types:
        ${['Observational','Experimental','Modelling','Review','Meta-analysis'].map(st=>`<label style="margin-left:6px;cursor:pointer"><input type="checkbox" class="pico-st" value="${st}" ${(pico.studyTypes||[]).includes(st)?'checked':''}> ${st}</label>`).join('')}
      </label>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="bt on" onclick="_savePicoConfig()">Save PICO</button>
      <button class="bt sm" onclick="_aiScreenBatch()">Screen Library against PICO</button>
    </div>
  </div></div>

  <div class="sec" style="margin-bottom:12px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.querySelector('span:last-child').textContent=this.nextElementSibling.style.display==='none'?'&#9656;':'&#9662;'"><h4>Step 2: Title/Abstract Screening (${screened}/${papers.length})</h4><span style="color:var(--tm)">&#9662;</span></div><div class="sb" id="pico-screen-area">
    ${papers.length?'':'<p style="color:var(--tm);font-size:12px">No papers in library. Save papers from Literature search first.</p>'}
  </div></div>

  ${screened?`<div class="eg" style="margin-bottom:12px">
    <div class="ec"><div class="el">Screened</div><div class="ev">${screened}/${papers.length}</div></div>
    <div class="ec"><div class="el">Included</div><div class="ev" style="color:var(--sg)">${included}</div></div>
    <div class="ec"><div class="el">Excluded</div><div class="ev" style="color:var(--co)">${excluded}</div></div>
    <div class="ec"><div class="el">Uncertain</div><div class="ev" style="color:var(--wa)">${uncertain}</div></div>
  </div>`:''}

  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <button class="bt sm" onclick="_picoExportScreening()">Export Screening Data</button>
    <button class="bt sm" onclick="_picoImportRater()">Import Colleague's Screening</button>
    <button class="bt sm" onclick="buildPRISMADiagram()">PRISMA Diagram</button>
  </div>
  <div id="pico-kappa" style="margin-top:12px"></div>
  `);

  // Render screening cards if papers exist
  if(papers.length){
    _picoScreenIdx=Math.max(0,Math.min(_picoScreenIdx,papers.length-1));
    _renderScreeningCard(papers,screening);
  }
}

function _savePicoConfig(){
  const pico={
    population:$('#pico-pop')?.value||'',
    intervention:$('#pico-int')?.value||'',
    comparison:$('#pico-comp')?.value||'',
    outcome:$('#pico-out')?.value||'',
    inclusion:($('#pico-inc')?.value||'').split('\n').filter(Boolean),
    exclusion:($('#pico-exc')?.value||'').split('\n').filter(Boolean),
    dateFrom:$('#pico-yf')?.value||'',
    dateTo:$('#pico-yt')?.value||'',
    studyTypes:[...document.querySelectorAll('.pico-st:checked')].map(c=>c.value)
  };
  safeStore('meridian_pico',pico);
  toast('PICO criteria saved','ok');
}

function _renderScreeningCard(papers,screening){
  const area=$('#pico-screen-area');if(!area)return;
  const p=papers[_picoScreenIdx];if(!p)return;
  const sc=screening[p.id];
  const aiSc=sc?.aiDecision;
  const humanSc=sc?.decision;

  const decBadge=(d)=>{
    if(!d)return'';
    const colors={include:'var(--sg)',exclude:'var(--co)',uncertain:'var(--wa)'};
    return`<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--mf);background:${colors[d]||'var(--tm)'};color:#000">${d.toUpperCase()}</span>`;
  };

  area.innerHTML=`<div style="padding:14px;background:var(--be);border:1px solid var(--bd);border-radius:var(--rd)">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:11px;color:var(--tm);font-family:var(--mf)">
      <span>Paper ${_picoScreenIdx+1} of ${papers.length}</span>
      <span>${humanSc?'Your decision: '+decBadge(humanSc):'Not yet screened'}</span>
    </div>
    <h4 style="font-size:14px;color:var(--tx);margin-bottom:4px">${escHTML(p.title||'')}</h4>
    <div style="font-size:12px;color:var(--ts);margin-bottom:6px">${escHTML((p.authors||[]).join(', '))} (${p.year||'n.d.'})</div>
    ${p.abstract?`<div style="font-size:12px;color:var(--ts);line-height:1.6;margin-bottom:10px;max-height:200px;overflow-y:auto">${escHTML(p.abstract)}</div>`:'<div style="font-size:12px;color:var(--tm);font-style:italic;margin-bottom:10px">No abstract available</div>'}
    ${aiSc?`<div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:8px">AI pre-screening: ${decBadge(aiSc)} ${sc.aiReason?'&mdash; '+escHTML(sc.aiReason):''}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="bt on" style="border-color:var(--sb);color:var(--sg);min-height:36px" onclick="_picoScreenPaper('include')">Include</button>
      <button class="bt" style="border-color:rgba(194,120,120,.3);color:var(--co);min-height:36px" onclick="_picoScreenPaper('exclude')">Exclude</button>
      <button class="bt" style="border-color:rgba(212,160,74,.3);color:var(--wa);min-height:36px" onclick="_picoScreenPaper('uncertain')">Uncertain</button>
    </div>
    <div style="display:flex;gap:6px;justify-content:space-between;align-items:center">
      <button class="bt sm" onclick="_picoScreenIdx=Math.max(0,_picoScreenIdx-1);renderLib()" ${_picoScreenIdx===0?'disabled':''}>&larr; Prev</button>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf)">${p.doi?`<a href="${escHTML(p.doi)}" target="_blank" style="color:var(--ac)">Open DOI</a>`:''}</div>
      <button class="bt sm" onclick="_picoScreenIdx=Math.min(${papers.length-1},_picoScreenIdx+1);renderLib()" ${_picoScreenIdx>=papers.length-1?'disabled':''}>Next &rarr;</button>
    </div>
  </div>`;
}

function _picoScreenPaper(decision){
  const papers=S.lib;
  const p=papers[_picoScreenIdx];if(!p)return;
  const screening=safeParse('meridian_screening',{});
  screening[p.id]=screening[p.id]||{};
  screening[p.id].decision=decision;
  screening[p.id].timestamp=new Date().toISOString();
  screening[p.id].rater='local';
  safeStore('meridian_screening',screening);
  // Auto-advance to next
  if(_picoScreenIdx<papers.length-1)_picoScreenIdx++;
  renderLib();
}

async function _aiScreenBatch(){
  const pico=safeParse('meridian_pico',null);
  if(!pico||!pico.population)return toast('Save PICO criteria first','err');
  if(!S.apiK||typeof callAI!=='function')return toast('Configure an AI API key in the AI Assistant tab first','err');
  if(!S.lib.length)return toast('No papers in library','err');

  const screening=safeParse('meridian_screening',{});
  const unscreened=S.lib.filter(p=>!screening[p.id]?.aiDecision);
  if(!unscreened.length)return toast('All papers already AI-screened','ok');

  const total=unscreened.length;
  toast(`AI screening ${total} papers...`,'info',60000);

  for(let i=0;i<total;i++){
    const p=unscreened[i];
    if(typeof _showActivity==='function')_showActivity(`Screening ${i+1}/${total}...`);
    try{
      const resp=await callAI({
        messages:[{role:'user',content:`Given these PICO criteria: ${JSON.stringify(pico)}\n\nDoes this paper meet inclusion criteria? Reply ONLY with JSON:\n{"decision": "include"|"exclude"|"uncertain", "reason": "one sentence"}\n\nPaper:\nTitle: ${p.title||''}\nAbstract: ${(p.abstract||'').slice(0,400)}\nYear: ${p.year||''}`}],
        maxTokens:150
      });
      const text=resp?.content?.[0]?.text||'';
      const match=text.match(/\{[\s\S]*?\}/);
      if(match){
        const parsed=JSON.parse(match[0]);
        screening[p.id]=screening[p.id]||{};
        screening[p.id].aiDecision=parsed.decision;
        screening[p.id].aiReason=parsed.reason||'';
      }
    }catch(e){console.warn('AI screen error for',p.id,e)}
    safeStore('meridian_screening',screening);
  }
  if(typeof _hideActivity==='function')_hideActivity();
  toast(`AI screening complete: ${total} papers processed`,'ok');
  renderLib();
}

function _picoExportScreening(){
  const screening=safeParse('meridian_screening',{});
  if(!Object.keys(screening).length)return toast('No screening data','err');
  dl(JSON.stringify(screening,null,2),'meridian-screening-'+new Date().toISOString().slice(0,10)+'.json','application/json');
  toast('Screening data exported','ok');
}

function _picoImportRater(){
  const input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const rater2=JSON.parse(ev.target.result);
        const rater1=safeParse('meridian_screening',{});
        // Find papers screened by both
        const commonIds=Object.keys(rater1).filter(id=>rater2[id]&&rater1[id].decision&&rater2[id].decision);
        if(commonIds.length<3)return toast('Need at least 3 papers screened by both raters','err');
        const r1=commonIds.map(id=>rater1[id].decision);
        const r2=commonIds.map(id=>rater2[id].decision);
        const result=_cohensKappa(r1,r2);
        _renderKappaResult(result,commonIds.length);
      }catch(err){toast('Invalid screening JSON file','err')}
    };
    reader.readAsText(file);
  };
  input.click();
}

function _cohensKappa(ratings1,ratings2){
  const cats=['include','exclude','uncertain'];
  const n=ratings1.length;
  // Build confusion matrix
  const matrix={};
  cats.forEach(c1=>{matrix[c1]={};cats.forEach(c2=>{matrix[c1][c2]=0})});
  for(let i=0;i<n;i++){
    const r1=ratings1[i],r2=ratings2[i];
    if(matrix[r1]&&matrix[r1][r2]!=null)matrix[r1][r2]++;
  }
  // Compute observed agreement
  let po=0;
  cats.forEach(c=>{po+=matrix[c][c]});
  po/=n;
  // Compute expected agreement
  let pe=0;
  cats.forEach(c=>{
    const row=cats.reduce((s,c2)=>s+matrix[c][c2],0);
    const col=cats.reduce((s,c1)=>s+matrix[c1][c],0);
    pe+=(row*col);
  });
  pe/=(n*n);
  const kappa=pe===1?1:(po-pe)/(1-pe);
  let interpretation;
  if(kappa<0)interpretation='No agreement';
  else if(kappa<0.2)interpretation='Slight agreement';
  else if(kappa<0.4)interpretation='Fair agreement';
  else if(kappa<0.6)interpretation='Moderate agreement';
  else if(kappa<0.8)interpretation='Substantial agreement';
  else interpretation='Almost perfect agreement';
  return{kappa,po,pe,interpretation,matrix,cats,n};
}

function _renderKappaResult(result,nPapers){
  const el=$('#pico-kappa');if(!el)return;
  el.innerHTML=`<div class="sec"><div class="sh"><h4>Inter-Rater Reliability</h4></div><div class="sb">
    <div class="eg" style="margin-bottom:10px">
      <div class="ec"><div class="el">Cohen's &kappa;</div><div class="ev" style="color:${result.kappa>=0.6?'var(--sg)':result.kappa>=0.4?'var(--wa)':'var(--co)'}">${result.kappa.toFixed(3)}</div></div>
      <div class="ec"><div class="el">Interpretation</div><div class="ev" style="font-size:13px">${result.interpretation}</div></div>
      <div class="ec"><div class="el">Papers compared</div><div class="ev">${nPapers}</div></div>
      <div class="ec"><div class="el">Observed agreement</div><div class="ev">${(result.po*100).toFixed(1)}%</div></div>
    </div>
    <div style="overflow-x:auto"><table style="font-size:11px;font-family:var(--mf);border-collapse:collapse">
      <tr><th style="padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">Rater 1 \\ Rater 2</th>${result.cats.map(c=>`<th style="padding:4px 8px;color:var(--ac);border-bottom:1px solid var(--bd)">${c}</th>`).join('')}</tr>
      ${result.cats.map(c1=>`<tr><td style="padding:4px 8px;color:var(--ac);border-bottom:1px solid var(--bd);font-weight:600">${c1}</td>${result.cats.map(c2=>`<td style="padding:4px 8px;color:${c1===c2?'var(--sg)':'var(--ts)'};border-bottom:1px solid var(--bd);text-align:center;font-weight:${c1===c2?'700':'400'}">${result.matrix[c1][c2]}</td>`).join('')}</tr>`).join('')}
    </table></div>
  </div></div>`;
}

const _dRenderLib=debounce(()=>renderLib(),200);
function highlightTerms(text,terms){
  if(!terms||!terms.length||!text)return escHTML(text);
  let safe=escHTML(text);
  terms.forEach(t=>{if(t.length<2)return;try{const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');safe=safe.replace(re,'<mark style="background:rgba(201,149,107,.25);color:var(--ac);padding:0 1px;border-radius:2px">$1</mark>')}catch{}});
  return safe}
function parseAdvancedQuery(q){
  if(!q||!/\b(title|author|year|journal|tag|abstract|status|AND|OR|NOT)\b/i.test(q))return null;
  const tokens=[];const re=/(?:(title|author|year|journal|tag|abstract|status):)?("([^"]+)"|(\S+))/gi;
  let m,lastOp='AND';
  while((m=re.exec(q))!==null){
    const raw=m[3]||m[4]||'';
    if(/^(AND|OR|NOT)$/i.test(raw)){lastOp=raw.toUpperCase();continue}
    tokens.push({field:(m[1]||'').toLowerCase(),op:lastOp,term:raw.toLowerCase()});lastOp='AND'}
  return tokens.length?tokens:null}
function matchAdvancedQuery(p,tokens){
  const fields={title:(p.title||'').toLowerCase(),author:(p.authors||[]).join(' ').toLowerCase(),year:String(p.year||''),journal:(p.journal||'').toLowerCase(),tag:(p.tags||[]).join(' ').toLowerCase(),abstract:(p.abstract||'').toLowerCase(),status:(_readingStatus[p.id]||'unread')};
  const hay=Object.values(fields).join(' ');
  // Split into OR-separated groups of AND/NOT terms
  const groups=[[]];
  for(const t of tokens){if(t.op==='OR'){groups.push([]);groups[groups.length-1].push({...t,op:'AND'})}else groups[groups.length-1].push(t)}
  // Any OR group matching = true; within a group, all AND/NOT must match
  return groups.some(group=>{
    return group.every(t=>{
      const src=t.field?fields[t.field]:hay;
      if(!src)return true;
      const hit=src.includes(t.term);
      return t.op==='NOT'?!hit:hit})})}
async function deleteFiltered(){const sq=$('#lib-search-input')?.value?.toLowerCase()||'';const fl=sq?S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' '),(p.tags||[]).join(' '),p.journal||''].join(' ').toLowerCase();return sq.split(/\s+/).every(w=>hay.includes(w))}):S.lib;if(!fl.length)return;if(!confirm('Delete '+fl.length+' papers?'))return;for(const p of fl){if(typeof dbDelWithUndo==='function')await dbDelWithUndo(p.id);else await dbDel(p.id)}await loadLib();renderLib()}
function toggleBatchMode(){S.batchMode=!S.batchMode;if(!S.batchMode)S.batchSelected.clear();renderLib()}
// ═══ PROJECT NAMESPACING ═══
function getProjects(){const set=new Set();S.lib.forEach(p=>set.add(p.project||'Default'));set.add(S.activeProject||'Default');return[...set].sort()}
function switchProject(name){S.activeProject=name;safeStore('meridian_active_project',JSON.stringify(name));renderLib(true)}
function createProject(){const name=prompt('New project name:');if(!name||!name.trim())return;const trimmed=name.trim();S.activeProject=trimmed;safeStore('meridian_active_project',JSON.stringify(trimmed));renderLib(true);toast('Switched to project: '+trimmed,'ok')}
function renameProject(old){const name=prompt('Rename project "'+old+'" to:',old);if(!name||!name.trim()||name.trim()===old)return;const trimmed=name.trim();S.lib.forEach(p=>{if((p.project||'Default')===old){p.project=trimmed;dbPut(p)}});if(S.activeProject===old){S.activeProject=trimmed;safeStore('meridian_active_project',JSON.stringify(trimmed))}renderLib(true);toast('Project renamed to '+trimmed,'ok')}
function moveToProject(paperId){const projects=getProjects();const opts=projects.map((p,i)=>`${i+1}: ${p}`).join('\n');const choice=prompt('Move paper to project:\n'+opts+'\n\nOr type a new project name:');if(!choice)return;let target;const num=parseInt(choice);if(num>=1&&num<=projects.length)target=projects[num-1];else target=choice.trim();if(!target)return;const paper=S.lib.find(x=>x.id===paperId);if(paper){paper.project=target;dbPut(paper).then(()=>{loadLib().then(renderLib)});toast('Moved to '+target,'ok')}}
function batchTag(){if(!S.batchSelected.size)return toast('Select papers first','err');const t=prompt('Add tags to '+S.batchSelected.size+' papers (comma-separated):');if(!t)return;const tags=t.split(',').map(x=>x.trim()).filter(Boolean);S.batchSelected.forEach(id=>{const p=S.lib.find(x=>x.id===id);if(p){p.tags=p.tags||[];tags.forEach(tag=>{if(!p.tags.includes(tag))p.tags.push(tag)});dbPut(p)}});toast(tags.length+' tag(s) added to '+S.batchSelected.size+' papers','ok');loadLib().then(renderLib)}
async function batchDelete(){if(!S.batchSelected.size)return toast('Select papers first','err');if(!confirm('Delete '+S.batchSelected.size+' selected papers?'))return;for(const id of S.batchSelected){if(typeof dbDelWithUndo==='function')await dbDelWithUndo(id);else await dbDel(id)}S.batchSelected.clear();await loadLib();renderLib();toast('Papers deleted','ok')}
async function clearAllLibrary(){
  const count=S.lib.length;
  if(!count)return toast('Library is already empty','info');
  if(!confirm('Permanently delete ALL '+count+' papers from your library?\n\nThis removes papers from local storage AND cloud sync.\nThis cannot be undone.'))return;
  if(!confirm('Are you sure? This will delete '+count+' papers permanently.'))return;
  for(const p of[...S.lib]){await dbDel(p.id)}
  if(typeof _clearTombstones==='function')_clearTombstones();
  S.batchSelected.clear();
  await loadLib();renderLib();
  toast('All '+count+' papers deleted','ok');
}
function batchAddToCol(){if(!S.batchSelected.size)return toast('Select papers first','err');const keys=Object.keys(S.cols);if(!keys.length)return toast('Create a collection first','err');const opts=keys.map((k,i)=>`${i+1}: ${S.cols[k].name}`).join('\n');const choice=prompt('Add '+S.batchSelected.size+' papers to collection:\n'+opts+'\n(enter number)');if(!choice)return;const col=S.cols[keys[parseInt(choice)-1]];if(!col)return;S.batchSelected.forEach(id=>{if(!col.paperIds.includes(id))col.paperIds.push(id)});saveCol(col).then(renderLib);toast(S.batchSelected.size+' papers added to '+col.name,'ok')}
function batchSetStatus(){if(!S.batchSelected.size)return toast('Select papers first','err');const st=prompt('Set status for '+S.batchSelected.size+' papers:\n1: unread\n2: skimming\n3: read\n4: reviewed');const map={'1':'unread','2':'skimming','3':'read','4':'reviewed'};if(!map[st])return;S.batchSelected.forEach(id=>{_readingStatus[id]=map[st]});safeStore('meridian_reading_status',_readingStatus);renderLib();toast('Status set to '+map[st],'ok')}
function batchExport(){if(!S.batchSelected.size)return toast('Select papers first','err');const papers=S.lib.filter(p=>S.batchSelected.has(p.id));const rows=['Title,Authors,Year,Journal,Citations,Tags',...papers.map(p=>[`"${(p.title||'').replace(/"/g,"'")}"`,`"${(p.authors||[]).join('; ')}"`,p.year||'',`"${p.journal||''}"`,p.cited||'',`"${(p.tags||[]).join('; ')}"`].join(','))];dl(rows.join('\n'),'selected_papers.csv','text/csv');toast(papers.length+' papers exported','ok')}
function promptTag(id){const t=prompt('Add tags (comma-separated):');if(t){const p=S.lib.find(x=>x.id===id);if(p){p.tags=p.tags||[];t.split(',').map(x=>x.trim()).filter(Boolean).forEach(tag=>p.tags.push(tag));dbPut(p).then(loadLib).then(renderLib).catch(()=>toast('Failed to save tags','err'));if(typeof PADI!=='undefined'&&PADI.engTrack)PADI.engTrack(id,'tag')}}}
function newCol(){const n=prompt('Collection name:');if(!n)return;const id='col'+Date.now();S.cols[id]={id,name:n,paperIds:[]};saveCol(S.cols[id]).then(renderLib).catch(()=>toast('Failed to create collection','err'))}
function addToCol(paperId){const keys=Object.keys(S.cols);if(!keys.length)return toast('Create a collection first (Library tab)','err');const opts=keys.map((k,i)=>`${i+1}: ${S.cols[k].name}`).join('\n');const choice=prompt('Add to collection:\n'+opts+'\n(enter number)');if(!choice)return;const col=S.cols[keys[parseInt(choice)-1]];if(!col)return;if(!col.paperIds.includes(paperId))col.paperIds.push(paperId);saveCol(col).then(renderLib).catch(()=>toast('Failed to add to collection','err'))}
async function extractFindings(id){
  if(!S.apiK){toast('Set API key in the AI tab first','err');return}
  const p=S.lib.find(x=>x.id===id);if(!p||(!p.abstract&&!p.fullText))return toast('No abstract or full text available for this paper','err');
  const srcText=(p.fullText||p.abstract).slice(0,4000);
  let d;try{d=await callAI({messages:[{role:'user',content:`Extract from this ${p.fullText?'paper text':'abstract'} as JSON only (no markdown): {"location":"study location or region","n":"sample size","method":"main methodology","variables":"key measured variables","finding":"main quantitative finding","year_range":"study period"}\n\nText: ${srcText}`}],maxTokens:400})}catch(e){return toast('Extract failed: '+e.message,'err')}
  try{
    const txt=d.content?.[0]?.text||'{}';
    const findings=JSON.parse(txt.replace(/```json|```/g,'').trim());
    p.findings=findings;await dbPut(p);renderLib();
    if(typeof PADI!=='undefined'&&PADI.engTrack)PADI.engTrack(id,'finding');
  }catch{toast('Could not parse AI response','err')}
}
async function extractAllFindings(){
  if(!S.apiK)return toast('Set API key first','err');
  const toProcess=S.lib.filter(p=>p.abstract&&!p.findings);
  if(!toProcess.length)return toast('All papers already processed or have no abstracts','info');
  if(!confirm(`Extract findings from ${toProcess.length} papers? This uses API credits.`))return;
  // Process 3 at a time for speed
  for(let i=0;i<toProcess.length;i+=3){
    const batch=toProcess.slice(i,i+3);
    await Promise.allSettled(batch.map(p=>extractFindings(p.id)));
    toast(`Processed ${Math.min(i+3,toProcess.length)}/${toProcess.length}`,'info');
    if(i+3<toProcess.length)await new Promise(r=>setTimeout(r,300))}
  toast('All findings extracted','ok')}
// ═══ SCREENING WORKFLOW ═══
let _screeningActive=false,_screeningData=[],_screenIdx=0,_screenFilter='all';
async function loadScreeningData(){_screeningData=await dbGetAllScreening();return _screeningData}
async function openScreening(){
  _screeningActive=true;_screenIdx=0;_screenFilter='all';
  await loadScreeningData();renderScreeningView()}
function closeScreening(){_screeningActive=false;renderLib()}
async function screenPaper(decision,reason){
  const papers=getScreenableList();if(!papers.length)return;
  const p=papers[_screenIdx];if(!p)return;
  await dbPutScreen({paperId:p.id,decision,reason:reason||'',screenedAt:new Date().toISOString(),phase:'title-abstract'});
  if(typeof PADI!=='undefined'&&PADI.onScreened)PADI.onScreened(p.id,decision);
  await loadScreeningData();
  if(_screenIdx>=getScreenableList().length-1)_screenIdx=Math.max(0,getScreenableList().length-1);
  renderScreeningView()}
function getScreenableList(){
  const screenMap=Object.fromEntries(_screeningData.map(s=>[s.paperId,s]));
  if(_screenFilter==='all')return S.lib;
  if(_screenFilter==='unscreened')return S.lib.filter(p=>!screenMap[p.id]);
  return S.lib.filter(p=>screenMap[p.id]?.decision===_screenFilter)}
function renderScreeningView(){
  const screenMap=Object.fromEntries(_screeningData.map(s=>[s.paperId,s]));
  const total=S.lib.length,screened=_screeningData.length;
  const inc=_screeningData.filter(s=>s.decision==='include').length;
  const exc=_screeningData.filter(s=>s.decision==='exclude').length;
  const may=_screeningData.filter(s=>s.decision==='maybe').length;
  const papers=getScreenableList();const p=papers[_screenIdx];
  const pctI=total?(inc/total*100):0,pctE=total?(exc/total*100):0,pctM=total?(may/total*100):0;
  H('#lib-content',`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="color:var(--ac);font-size:16px;font-family:var(--mf)">Screening</h3><button class="bt sm" onclick="closeScreening()">Back to Library</button></div>
  <div style="font-size:12px;color:var(--ts);font-family:var(--mf);margin-bottom:8px">Screened ${screened}/${total} · <span style="color:var(--sg)">${inc} included</span> · <span style="color:var(--co)">${exc} excluded</span> · <span style="color:var(--wa)">${may} maybe</span></div>
  <div class="screen-progress"><div class="sp-inc" style="width:${pctI}%"></div><div class="sp-exc" style="width:${pctE}%"></div><div class="sp-may" style="width:${pctM}%"></div></div>
  <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">${[['all','All'],['unscreened','Unscreened'],['include','Included'],['exclude','Excluded'],['maybe','Maybe']].map(([k,l])=>`<button class="bt sm ${_screenFilter===k?'on':''}" onclick="_screenFilter='${k}';_screenIdx=0;renderScreeningView()">${l}${k==='all'?' ('+total+')':k==='unscreened'?' ('+(total-screened)+')':k==='include'?' ('+inc+')':k==='exclude'?' ('+exc+')':' ('+may+')'}</button>`).join('')}</div>
  ${p?`<div class="screen-card"><div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">${_screenIdx+1} / ${papers.length}${screenMap[p.id]?` · Previous: <span style="color:${screenMap[p.id].decision==='include'?'var(--sg)':screenMap[p.id].decision==='exclude'?'var(--co)':'var(--wa)'}">${screenMap[p.id].decision}</span>`:''}</div>
  <h3 style="font-size:16px;line-height:1.5;margin-bottom:6px">${escHTML(p.title||'')}</h3>
  <div style="font-size:13px;color:var(--ts);margin-bottom:8px">${(p.authors||[]).slice(0,4).join(', ')} · ${p.year||''} · <span style="color:var(--ac)">${p.journal||''}</span>${p.cited?' · '+p.cited+' cited':''}</div>
  ${p.abstract?`<div style="font-size:14px;color:var(--ts);line-height:1.7;margin-bottom:12px;max-height:300px;overflow-y:auto">${(()=>{const sq=$('#lib-search-input')?.value?.trim()||'';const terms=sq?sq.split(/\s+/).filter(t=>t.length>=2&&!/^(title|author|year|journal|tag|abstract|status|AND|OR|NOT):?$/i.test(t)):[];return terms.length?highlightTerms(p.abstract,terms):escHTML(p.abstract)})()}</div>`:'<div style="color:var(--tm);font-size:13px;margin-bottom:12px">No abstract available</div>'}
  <div class="screen-btns"><button class="s-inc" onclick="screenPaper('include')">Include (Y)</button><button class="s-exc" onclick="screenPaper('exclude')">Exclude (N)</button><button class="s-may" onclick="screenPaper('maybe')">Maybe (M)</button></div>
  <div style="margin-top:8px"><input class="fi" id="screenReason" placeholder="Optional reason..." style="width:100%;padding:8px" onkeydown="if(event.key==='Enter'){const d=event.shiftKey?'maybe':'include';screenPaper(d,$('#screenReason').value)}"/></div>
  <div style="display:flex;gap:6px;margin-top:8px">${_screenIdx>0?'<button class="bt sm" onclick="_screenIdx--;renderScreeningView()">← Prev</button>':''}<span style="flex:1"></span>${_screenIdx<papers.length-1?'<button class="bt sm" onclick="_screenIdx++;renderScreeningView()">Next →</button>':''}</div></div>`:'<p style="color:var(--tm);text-align:center;padding:40px">No papers in this filter.</p>'}
  <div style="margin-top:12px"><button class="bt sm" onclick="exportScreeningReport()">Export Screening CSV</button></div>`)}
async function exportScreeningReport(){
  await loadScreeningData();const screenMap=Object.fromEntries(_screeningData.map(s=>[s.paperId,s]));
  const rows=['Paper ID,Title,Decision,Reason,Screened At,Phase',...S.lib.map(p=>{const s=screenMap[p.id];return['"'+p.id+'"','"'+(p.title||'').replace(/"/g,"'")+'"',s?.decision||'unscreened','"'+(s?.reason||'')+'"',s?.screenedAt||'',s?.phase||''].join(',')})];
  dl(rows.join('\n'),'screening_report.csv','text/csv');toast('Screening report exported','ok')}
function compileLibWS(){const sq=$('#lib-search-input')?.value?.toLowerCase()||'';const fl=sq?S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' '),(p.tags||[]).join(' ')].join(' ').toLowerCase();return sq.split(/\s+/).every(w=>hay.includes(w))}):S.lib;if(!fl.length)return;compileLibWSBody(fl)}

async function aiSummarize(){
  if(!S.apiK){toast('Set your API key in the AI tab (△) first','err');return}
  const sq=$('#lib-search-input')?.value?.toLowerCase()||'';
  const fl=sq?S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' ')].join(' ').toLowerCase();return sq.split(/\s+/).every(w=>hay.includes(w))}):S.lib;
  if(!fl.length){toast('No papers to summarize — add papers from the Literature tab','err');return}
  if(fl.length>20){toast('Too many papers (max 20). Use the search filter to narrow down','err');return}
  const sumDiv=$('#lib-summary');if(sumDiv)sumDiv.innerHTML='<div style="padding:20px;text-align:center;color:var(--tm)">'+mkL()+'<p style="margin-top:12px;font-size:12px">Analyzing '+fl.length+' papers with AI...</p></div>';
  else{const d=document.createElement('div');d.id='lib-summary';d.innerHTML='<div style="padding:20px;text-align:center;color:var(--tm)">'+mkL()+'</div>';$('#lib-content').prepend(d)}
  const paperList=fl.map((p,i)=>`[${i+1}] "${p.title}" (${p.year||'n.d.'}) — ${(p.authors||[]).slice(0,2).join(', ')} — ${p.journal||'Unknown'} — ${p.cited||0} citations\nAbstract: ${(p.abstract||'No abstract available').slice(0,300)}`).join('\n\n');
  const prompt=`Analyze these ${fl.length} academic papers and provide a comparative summary in under 300 words. Categorize by:\n1. CONTENT THEMES — group papers by topic\n2. DATA QUALITY — rank by citation count and journal reputation\n3. KEY FINDINGS — most important results across papers\n4. FEASIBILITY & APPLICATIONS — practical real-world applications\n5. GAPS — what's missing across this body of work\n\nBe concise and specific. Use paper numbers [1], [2] etc.\n\nPapers:\n${paperList}`;
  try{
    const text=await streamAI({messages:[{role:'user',content:prompt}],maxTokens:2000,onDelta:t=>{
      const sd=$('#lib-summary');if(sd)sd.innerHTML=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>AI Comparative Summary (${fl.length} papers)</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><div style="font-size:13px;line-height:1.75;color:var(--ts)">${renderMD(t)}▋</div></div></div>`}});
    window._lastSummary=text;
    const sd=$('#lib-summary');if(sd)sd.innerHTML=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>AI Comparative Summary (${fl.length} papers)</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><div style="font-size:13px;line-height:1.75;color:var(--ts)">${renderMD(text)}</div><div style="margin-top:10px;display:flex;gap:6px"><button class="bt sm" onclick="dl(window._lastSummary||'','summary.txt','text/plain')">Download Summary</button><button class="bt sm" onclick="$('#lib-summary').remove()">Dismiss</button></div></div></div>`;
  }catch(e){const sd=$('#lib-summary');if(sd)sd.innerHTML=`<div class="sec"><div class="sb"><p style="color:var(--co)">Error: ${escHTML(e.message)}</p></div></div>`}
}
function compileLibWSBody(fl){
  S.wsC=['Title','Authors','Year','Journal','Citations','OA','Concepts','Tags','Notes','Location','Method','Finding'];
  S.wsD=fl.map(p=>({
    Title:p.title,Authors:(p.authors||[]).join('; '),Year:p.year,Journal:p.journal,
    Citations:p.cited,OA:p.isOA?'Y':'N',Concepts:(p.concepts||[]).join('; '),
    Tags:(p.tags||[]).join('; '),Notes:p.notes||'',
    Location:p.findings?.location||'',Method:p.findings?.method||'',Finding:p.findings?.finding||''
  }));
  autoTypes();initWS();goTab('workshop')
}
function extractLibNums(){const numP=/(\d+\.?\d*)\s*(°C|°F|ppm|ppb|mg\/[lL]|µg\/[lL]|cm|mm|m|km|kg|g|mg|%|‰|PSU|mL|L|yr|years?|months?|days?|individuals|specimens|samples)/gi;const rows=[];S.lib.forEach(p=>{const abs=p.abstract||'';[...abs.matchAll(numP)].forEach(m=>{rows.push({Paper:p.title?.slice(0,60),Year:p.year,Value:parseFloat(m[1]),Unit:m[2],Context:abs.slice(Math.max(0,m.index-30),m.index+m[0].length+30).trim()})})});if(!rows.length){toast('No numeric data found in abstracts','info');return}S.wsC=['Paper','Year','Value','Unit','Context'];S.wsD=rows;autoTypes();initWS();goTab('workshop')}
function dlLibCSV(){dl(['Title,Authors,Year,Journal,Citations,Tags',...S.lib.map(p=>[`"${(p.title||'').replace(/"/g,"'")}"`,`"${(p.authors||[]).join('; ')}"`,p.year||'',`"${p.journal||''}"`,p.cited||'',`"${(p.tags||[]).join('; ')}"`].join(','))].join('\n'),'library.csv','text/csv')}

// ═══ LITERATURE ═══
async function sOA(q,f,sig){const p=new URLSearchParams({search:q,per_page:"20",sort:"relevance_score:desc",mailto:"r@meridian.app"});if(f.yf)p.append("filter",`from_publication_date:${f.yf}-01-01`);if(f.yt)p.append("filter",`to_publication_date:${f.yt}-12-31`);if(f.oa)p.append("filter","is_oa:true");const r=await fetchT(`https://api.openalex.org/works?${p}`,15000,sig);if(!r.ok)throw new Error('OpenAlex HTTP '+r.status);const d=await r.json();return(d.results||[]).map(w=>({id:w.id,title:w.title,authors:(w.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean),year:w.publication_year,journal:w.primary_location?.source?.display_name||"",doi:w.doi,cited:w.cited_by_count||0,isOA:w.open_access?.is_oa||false,oaUrl:w.open_access?.oa_url,pdfUrl:w.best_oa_location?.pdf_url,abstract:recAbs(w.abstract_inverted_index),concepts:(w.concepts||[]).slice(0,6).map(c=>c.display_name),url:w.doi||w.id,src:'OA'}))}
async function sSS(q,f,sig){const p=new URLSearchParams({query:q,limit:"20",fields:"title,authors,year,venue,externalIds,citationCount,isOpenAccess,openAccessPdf,abstract,tldr,fieldsOfStudy"});if(f.yf||f.yt)p.append("year",`${f.yf||"1900"}-${f.yt||"2026"}`);const r=await fetchT(`https://api.semanticscholar.org/graph/v1/paper/search?${p}`,15000,sig);if(!r.ok)throw new Error('SemanticScholar HTTP '+r.status);const d=await r.json();return(d.data||[]).map(p=>({id:p.paperId,title:p.title,authors:(p.authors||[]).slice(0,5).map(a=>a.name),year:p.year,journal:p.venue||"",doi:p.externalIds?.DOI?`https://doi.org/${p.externalIds.DOI}`:null,cited:p.citationCount||0,isOA:p.isOpenAccess||false,pdfUrl:p.openAccessPdf?.url,abstract:p.tldr?.text||(p.abstract?p.abstract.slice(0,500):null),concepts:p.fieldsOfStudy||[],url:p.externalIds?.DOI?`https://doi.org/${p.externalIds.DOI}`:'',src:'SS'}))}
async function sCR(q,f,sig){const r=await fetchT(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=15&sort=relevance&order=desc&mailto=r@meridian.app`,15000,sig);if(!r.ok)throw new Error('CrossRef HTTP '+r.status);const d=await r.json();return(d.message?.items||[]).map(w=>({id:w.DOI,title:Array.isArray(w.title)?w.title[0]:w.title||"",authors:(w.author||[]).slice(0,5).map(a=>`${a.given||""} ${a.family||""}`),year:w.published?.["date-parts"]?.[0]?.[0],journal:w["container-title"]?.[0]||"",doi:`https://doi.org/${w.DOI}`,cited:w["is-referenced-by-count"]||0,isOA:w.license?.some(l=>l.URL?.includes("creativecommons"))||false,abstract:w.abstract?w.abstract.replace(/<[^>]+>/g,"").slice(0,500):null,concepts:w.subject||[],url:`https://doi.org/${w.DOI}`,src:'CR'}))}
async function sPM(q,f,sig){const sr=await fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=15&sort=relevance&retmode=json`,15000,sig);if(!sr.ok)throw new Error('PubMed HTTP '+sr.status);const sd=await sr.json();const ids=sd.esearchresult?.idlist||[];if(!ids.length)return[];const dr=await fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`,15000,sig);if(!dr.ok)return[];const xml=await dr.text();const xp=new DOMParser(),xd=xp.parseFromString(xml,'text/xml');return Array.from(xd.querySelectorAll('PubmedArticle')).map(art=>{const pmid=art.querySelector('PMID')?.textContent||'';const title=art.querySelector('ArticleTitle')?.textContent||'';const absParts=art.querySelectorAll('AbstractText');const abstract=absParts.length?Array.from(absParts).map(a=>a.textContent).join(' ').slice(0,500):null;const authors=Array.from(art.querySelectorAll('Author')).slice(0,5).map(a=>{const ln=a.querySelector('LastName')?.textContent||'';const fn=a.querySelector('ForeName')?.textContent||'';return fn?fn+' '+ln:ln}).filter(Boolean);const journal=art.querySelector('ISOAbbreviation')?.textContent||'';const yearEl=art.querySelector('PubDate > Year');const year=yearEl?parseInt(yearEl.textContent):null;const doi=Array.from(art.querySelectorAll('ArticleId')).find(a=>a.getAttribute('IdType')==='doi')?.textContent;return{id:'pm-'+pmid,title,authors,year,journal,doi:doi?'https://doi.org/'+doi:null,cited:null,isOA:false,abstract,concepts:[],url:'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/',src:'PM'}})}

// ═══ PREPRINT SEARCH ═══
async function sES(q,f,sig){
  try{
    const url=`https://api.osf.io/v2/preprints/?filter[provider]=essoar&filter[title]=${encodeURIComponent(q)}&page[size]=15`;
    const r=await fetchT(url,15000,sig);if(!r.ok)throw new Error('ESSOAr HTTP '+r.status);
    const d=await r.json();
    return(d.data||[]).map(p=>{
      const attrs=p.attributes||{};
      const yr=attrs.date_published?new Date(attrs.date_published).getFullYear():attrs.date_created?new Date(attrs.date_created).getFullYear():null;
      const doi=attrs.doi||'';
      return{id:'es-'+(p.id||''),title:attrs.title||'',authors:[],year:yr,journal:'ESSOAr Preprint',doi:doi?'https://doi.org/'+doi:'',cited:null,isOA:true,abstract:(attrs.description||'').slice(0,500),concepts:[],url:doi?'https://doi.org/'+doi:attrs.preprint_doi_created?'https://essoar.org/doi/'+attrs.preprint_doi_created:'',src:'ES',isPreprint:true,source:'ESSOAr'}
    })
  }catch(e){console.warn('ESSOAr search error:',e);throw e}
}
async function sBR(q,f,sig){
  try{
    // bioRxiv content API — date-range based, client-side title filter
    const now=new Date();const from=new Date(now.getFullYear()-2,0,1);
    const df=from.toISOString().slice(0,10);const dt=now.toISOString().slice(0,10);
    const r=await fetchT(`https://api.biorxiv.org/details/biorxiv/${df}/${dt}/0/30`,15000,sig);
    if(!r.ok)throw new Error('bioRxiv HTTP '+r.status);
    const d=await r.json();
    const qLower=q.toLowerCase().split(/\s+/);
    return(d.collection||[]).filter(p=>{
      const t=(p.title||'').toLowerCase();const a=(p.abstract||'').toLowerCase();
      return qLower.every(w=>t.includes(w)||a.includes(w))
    }).slice(0,15).map(p=>({
      id:'br-'+(p.doi||p.title?.slice(0,30)),title:p.title||'',authors:p.authors?p.authors.split(';').map(a=>a.trim()).filter(Boolean).slice(0,5):[],year:p.date?new Date(p.date).getFullYear():null,journal:'bioRxiv Preprint',doi:p.doi?'https://doi.org/'+p.doi:'',cited:null,isOA:true,abstract:(p.abstract||'').slice(0,500),concepts:p.category?[p.category]:[],url:p.doi?'https://doi.org/'+p.doi:'',src:'BR',isPreprint:true,source:'bioRxiv'
    }))
  }catch(e){console.warn('bioRxiv search error:',e);throw e}
}

function mkPC(p,i){const bgs=[];if(p.isPreprint)bgs.push('<span class="bg" style="background:rgba(212,160,74,.15);color:var(--wa);border:1px solid rgba(212,160,74,.3);font-size:10px" title="This paper has not been peer-reviewed. Treat results with appropriate caution.">PREPRINT</span>');if(p.isOA)bgs.push('<span class="bg oa">OA</span>');if(p.year)bgs.push(`<span class="bg yr">${escHTML(String(p.year))}</span>`);if(p.src)bgs.push(`<span class="src-badge src-${escHTML(p.src.toLowerCase())}">${escHTML(p.src)}</span>`);const _hlTerms=_litQuery?_litQuery.split(/\s+/).filter(t=>t.length>=2):[];const pid=escJSAttr(p.id);const inLib=S.lib.some(x=>x.id===p.id);const doiHref=p.doi?escHTML(safeUrl(p.doi)):'';return`<div class="pc" style="animation:fadeIn .3s ease ${Math.min(i*.03,.6)}s both" onclick="const d=this.querySelector('.pd');const a=this.querySelector('.pc-expand-hint');d.style.display=d.style.display==='none'?'block':'none';if(a)a.textContent=d.style.display==='none'?'click to expand':'click to collapse';if(typeof PADI!=='undefined'&&PADI.engTrack&&S.lib.some(function(x){return x.id==='${pid}'}))PADI.engTrack('${pid}','view')"><div style="display:flex;justify-content:space-between;gap:12px"><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${bgs.join('')}${inLib?'<span class="bg" style="background:var(--sm);color:var(--sg);border:1px solid var(--sb);font-size:10px">In Library</span>':''}</div><h3 style="margin:4px 0 2px;font-size:15px;font-weight:500;line-height:1.45">${escHTML(p.title||'')}</h3><p style="margin:3px 0 0;font-size:13px;color:var(--ts)">${escHTML((p.authors||[]).join(', '))}${p.journal?` <span style="color:var(--tm)">— ${escHTML(p.journal)}</span>`:''}</p>${p.concepts&&p.concepts.length?`<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">${p.concepts.slice(0,4).map(c=>`<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:var(--be);color:var(--tm);font-family:var(--mf)">${escHTML(c)}</span>`).join('')}</div>`:''}</div>${p.cited!=null?`<div style="text-align:right;flex-shrink:0;font-family:var(--mf)"><div style="font-size:20px;font-weight:700;color:var(--ac)">${Number(p.cited).toLocaleString()}</div><div style="font-size:11px;color:var(--tm)">cited</div></div>`:''}</div><span class="pc-expand-hint">click to expand</span><div class="pd" style="display:none;margin-top:12px;border-top:1px solid var(--bd);padding-top:12px">${p.abstract?`<p style="font-size:14px;color:var(--ts);line-height:1.65;margin:0 0 12px">${_hlTerms.length?highlightTerms(p.abstract,_hlTerms):escHTML(p.abstract)}</p>`:'<p style="font-size:13px;color:var(--tm);font-style:italic;margin:0 0 12px">No abstract available</p>'}<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button class="bt sm on" onclick="event.stopPropagation();var _p=S.litR.find(function(x){return x.id==='${pid}'});if(_p)savePaper(_p);this.textContent='Saved';this.style.color='var(--sg)';this.style.borderColor='var(--sb)';this.disabled=true">Save to Library</button>${p.pdfUrl?`<button class="bt sm" style="color:var(--sg)" onclick="event.stopPropagation();window.open('${escJSAttr(safeUrl(p.pdfUrl))}')">PDF</button>`:''}${doiHref?`<a class="bt sm" href="${doiHref}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="text-decoration:none">DOI</a>`:''}<button class="bt sm" onclick="event.stopPropagation();searchCitedBy('${escJSAttr((p.title||'').slice(0,80))}')">Cited By</button>${p.src==='SS'?`<a class="bt sm" href="https://www.semanticscholar.org/paper/${escHTML(p.id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="text-decoration:none">Refs</a>`:''}</div></div></div>`}
function compileToWS(){if(!S.litR.length)return;S.wsC=['Title','Authors','Year','Journal','Citations','OA','Concepts','DOI'];S.wsD=S.litR.map(p=>({Title:p.title,Authors:(p.authors||[]).join('; '),Year:p.year,Journal:p.journal,Citations:p.cited,OA:p.isOA?'Y':'N',Concepts:(p.concepts||[]).join('; '),DOI:p.doi||''}));autoTypes();initWS();goTab('workshop')}
async function litSearch(){const q=$('#lq').value.trim();if(!q)return;_errPipeline.crumb('search','Lit search: '+q.slice(0,60));if(_litAbort)_litAbort.abort();_litAbort=new AbortController();hi('#searchHist');saveSearchHist(q);const f={yf:$('#yf').value,yt:$('#yt').value,oa:S.oaF};_litQuery=q;H('#lres','');H('#lemp','');hi('#lstat');
// Live progress bar
const engineNames={OA:'OpenAlex',SS:'Semantic Scholar',CR:'CrossRef',PM:'PubMed',ES:'ESSOAr',BR:'bioRxiv'};
const engineFns={OA:sOA,SS:sSS,CR:sCR,PM:sPM,ES:sES,BR:sBR};
const engines=['OA','SS','CR','PM'];
if($('#eng-es')?.checked)engines.push('ES');
if($('#eng-br')?.checked)engines.push('BR');
const lp=$('#litProgress');
H(lp,`<div class="lit-progress"><div class="lp-bar"><div class="lp-fill" id="lpFill"></div></div>${engines.map(e=>`<span class="lp-engine" id="lpe-${e}"><span class="engine-dot pending"></span>${e}</span>`).join('')}</div>`);sh(lp);
const all=[];const engineStatus={};let done=0;const totalEngines=engines.length;
const updateProgress=()=>{const pct=Math.round((done/totalEngines)*100);const fill=$('#lpFill');if(fill)fill.style.width=pct+'%'};
const markEngine=(name,status,count)=>{const el=$('#lpe-'+name);if(el){el.className='lp-engine '+status;el.querySelector('.engine-dot').className='engine-dot '+status;if(status==='ok')el.innerHTML=`<span class="engine-dot ok"></span>${name} <span style="color:var(--sg)">${count}</span>`;else el.innerHTML=`<span class="engine-dot err"></span><s>${name}</s>`}};
const sig=_litAbort.signal;
const wrappedFns=engines.map((eng,i)=>engineFns[eng](q,f,sig).then(res=>{engineStatus[eng]='ok';markEngine(eng,'ok',res.length);all.push(...res);done++;updateProgress();return res}).catch(e=>{engineStatus[eng]='err';markEngine(eng,'err',0);done++;updateProgress();throw e}));
await Promise.allSettled(wrappedFns);
const seen=new Set();let dd=all.filter(r=>{const k=r.title?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);if(!k||seen.has(k))return false;seen.add(k);return true});const seenDOI=new Set();dd=dd.filter(r=>{if(!r.doi)return true;const d=r.doi.toLowerCase();if(seenDOI.has(d))return false;seenDOI.add(d);return true});const s=$('#sby').value;if(s==='citations')dd.sort((a,b)=>(b.cited||0)-(a.cited||0));else if(s==='year')dd.sort((a,b)=>(b.year||0)-(a.year||0));if(f.oa)dd=dd.filter(r=>r.isOA);// DOI dedup: prefer published over preprint when same DOI
dd=dd.filter(r=>{if(!r.doi||!r.isPreprint)return true;const d=r.doi.toLowerCase();return!dd.some(o=>o!==r&&o.doi&&o.doi.toLowerCase()===d&&!o.isPreprint)});
S.litR=dd;const srcCounts={OA:0,SS:0,CR:0,PM:0,ES:0,BR:0};dd.forEach(r=>{if(r.src&&srcCounts.hasOwnProperty(r.src))srcCounts[r.src]++});logSearchAudit(q,f,engineStatus,srcCounts,all.length,dd.length);
// Results summary bar
const oaCount=dd.filter(r=>r.isOA).length;
const srcStr=Object.entries(srcCounts).map(([k,v])=>`<span class="engine-dot ${engineStatus[k]||'err'}"></span>${engineNames[k]}: ${v}`).join('<span style="opacity:.3;margin:0 4px">·</span>');
const allFailed=Object.values(engineStatus).every(s=>s==='err');
if(dd.length){
H(lp,`<div class="lit-results-bar"><span class="lrb-count">${dd.length}</span><span class="lrb-meta">results${dd.length!==all.length?` (${all.length-dd.length} duplicates removed)`:''}</span><span class="lrb-meta">${oaCount} Open Access</span><span style="flex:1"></span><span class="lrb-meta">${srcStr}</span></div>`);
sh('#compileBtn');sh('#saveAllBtn');
}else{hi('#compileBtn');hi('#saveAllBtn');
if(allFailed){H(lp,`<div class="lit-results-bar" style="border-color:rgba(194,120,120,.3);background:var(--cm)"><span style="color:var(--co);font-weight:600">All search engines failed</span><span class="lrb-meta" style="color:var(--co)">Check your internet connection and try again.</span><span style="flex:1"></span><span class="lrb-meta">${srcStr}</span></div>`);
H('#lemp','');return}
H(lp,`<div class="lit-results-bar"><span class="lrb-count">0</span><span class="lrb-meta">results</span><span style="flex:1"></span><span class="lrb-meta">${srcStr}</span></div>`);
H('#lemp',`<div class="no-results-help"><h4>No results found for "${escHTML(q)}"</h4><ul><li>Check spelling or try broader terms</li><li>Use fewer keywords (e.g., "reef fish" instead of "coral reef fish ecology")</li><li>Remove year filters if set</li><li>Try synonyms: "otolith" ↔ "ear stone", "SST" ↔ "sea surface temperature"</li></ul><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">${['reef fish biodiversity','stock assessment fisheries','marine protected area'].map(s=>`<button class="bt sm" onclick="$('#lq').value='${escJSAttr(s)}';$('#lsb').click()">${escHTML(s)}</button>`).join('')}</div></div>`);return}
_litAllResults=dd;renderLitPage();
if(typeof PADI!=='undefined'){if(PADI.graphRecordQuery)PADI.graphRecordQuery(q);if(PADI.scoreResults)PADI.scoreResults()}}
function renderLitPage(){const perPage=20;const start=_litPage*perPage;const page=_litAllResults.slice(start,start+perPage);const totalPages=Math.ceil(_litAllResults.length/perPage);S.litR=_litAllResults;
const pageInfo=totalPages>1?`<div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:8px;display:flex;align-items:center;gap:8px"><span>Showing ${start+1}–${Math.min(start+perPage,_litAllResults.length)} of ${_litAllResults.length}</span>${totalPages>1?`<span style="display:flex;gap:4px">${Array.from({length:totalPages},(_,i)=>`<button class="bt sm${i===_litPage?' on':''}" style="padding:4px 8px;min-height:auto;font-size:11px" onclick="_litPage=${i};renderLitPage();document.getElementById('litSearchRow').scrollIntoView({behavior:'smooth'})">${i+1}</button>`).join('')}</span>`:''}</div>`:'';
H('#lres',pageInfo+page.map((p,i)=>mkPC(p,start+i)).join('')+(totalPages>1?`<div class="page-nav">${_litPage>0?`<button class="bt sm" onclick="_litPage--;renderLitPage();document.getElementById('litSearchRow').scrollIntoView({behavior:'smooth'})">← Previous</button>`:''}<span style="font-size:12px;color:var(--tm);font-family:var(--mf);padding:8px">Page ${_litPage+1} of ${totalPages}</span>${_litPage<totalPages-1?`<button class="bt sm" onclick="_litPage++;renderLitPage();document.getElementById('litSearchRow').scrollIntoView({behavior:'smooth'})">Next →</button>`:''}</div>`:''));if(typeof PADI!=='undefined'&&PADI.scoreResults)PADI.scoreResults()}
$('#lsb').addEventListener('click',()=>{_litPage=0;litSearch()});$('#lq').addEventListener('keydown',e=>{if(e.key==='Enter'){_litPage=0;litSearch()}});$('#oaf').addEventListener('click',function(){S.oaF=!S.oaF;this.classList.toggle('on')});
document.addEventListener('click',e=>{if(!e.target.closest('.search-hist')&&!e.target.closest('#lq'))hi('#searchHist')});
// ═══ DOI IMPORT ═══
async function importDOI(){const raw=$('#doi-input').value.trim();if(!raw)return;const doi=raw.replace(/^https?:\/\/doi\.org\//,'');toast('Looking up DOI...','info');try{const r=await fetchT('https://api.crossref.org/works/'+encodeURIComponent(doi),10000);if(!r.ok)throw new Error('DOI not found');const d=await r.json();const w=d.message;const paper={id:w.DOI,title:Array.isArray(w.title)?w.title[0]:w.title||'',authors:(w.author||[]).slice(0,5).map(a=>`${a.given||''} ${a.family||''}`),year:w.published?.['date-parts']?.[0]?.[0],journal:w['container-title']?.[0]||'',doi:'https://doi.org/'+w.DOI,cited:w['is-referenced-by-count']||0,isOA:w.license?.some(l=>l.URL?.includes('creativecommons'))||false,abstract:w.abstract?w.abstract.replace(/<[^>]+>/g,'').slice(0,500):null,concepts:w.subject||[],url:'https://doi.org/'+w.DOI,src:'CR'};await savePaper(paper);$('#doi-input').value='';toast('Paper saved to Library','ok')}catch(e){toast('DOI lookup failed: '+e.message,'err')}}
// ═══ BATCH DOI IMPORT ═══
function openBatchImport(){
  const existing=document.getElementById('batchImportModal');if(existing)existing.remove();
  const modal=document.createElement('div');modal.id='batchImportModal';
  modal.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`<div style="background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);padding:24px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.4)">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="font-size:16px;color:var(--ac);font-family:var(--mf);margin:0">Batch DOI Import</h3><button class="dx" onclick="document.getElementById('batchImportModal').remove()" style="background:0;border:0;color:var(--tm);cursor:pointer;font-size:20px">×</button></div>
<p style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:10px;line-height:1.5">Paste one DOI per line. Accepts bare DOIs or full URLs. Example:<br><span style="color:var(--ts)">10.1038/s41586-020-2649-2<br>https://doi.org/10.1111/faf.12233</span></p>
<textarea id="batchDoiInput" class="si" style="width:100%;height:160px;font-size:12px;font-family:var(--mf);resize:vertical;box-sizing:border-box" placeholder="10.1038/s41586-020-2649-2\n10.1111/faf.12233\nhttps://doi.org/10.1016/j.fishres.2020.105746"></textarea>
<div id="batchDoiProgress" style="display:none;margin-top:10px"></div>
<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end"><button class="bt sm" onclick="document.getElementById('batchImportModal').remove()">Cancel</button><button class="bt on" id="batchDoiGo" onclick="runBatchImport()">Import All</button></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove()})}
async function runBatchImport(){
  const raw=document.getElementById('batchDoiInput').value.trim();if(!raw)return;
  const lines=raw.split(/[\n,;]+/).map(l=>l.trim().replace(/^https?:\/\/doi\.org\//,'')).filter(Boolean);
  if(!lines.length)return toast('No DOIs found','err');
  const btn=document.getElementById('batchDoiGo');btn.disabled=true;btn.textContent='Importing...';
  const prog=document.getElementById('batchDoiProgress');prog.style.display='block';
  let ok=0,fail=0;
  for(let i=0;i<lines.length;i++){
    const doi=lines[i];
    H(prog,`<div style="font-size:12px;font-family:var(--mf);color:var(--tm)"><div style="margin-bottom:4px">${i+1}/${lines.length}: <span style="color:var(--ac)">${escHTML(doi)}</span></div><div class="fpb"><div class="fpbb" style="width:${((i+1)/lines.length*100).toFixed(0)}%"></div></div><div style="margin-top:4px;color:var(--sg)">${ok} saved</div>${fail?`<div style="color:var(--co)">${fail} failed</div>`:''}</div>`);
    try{const r=await fetchT('https://api.crossref.org/works/'+encodeURIComponent(doi),10000);
      if(!r.ok)throw new Error('Not found');const d=await r.json();const w=d.message;
      const paper={id:w.DOI,title:Array.isArray(w.title)?w.title[0]:w.title||'',authors:(w.author||[]).slice(0,5).map(a=>`${a.given||''} ${a.family||''}`),year:w.published?.['date-parts']?.[0]?.[0],journal:w['container-title']?.[0]||'',doi:'https://doi.org/'+w.DOI,cited:w['is-referenced-by-count']||0,isOA:w.license?.some(l=>l.URL?.includes('creativecommons'))||false,abstract:w.abstract?w.abstract.replace(/<[^>]+>/g,'').slice(0,500):null,concepts:w.subject||[],url:'https://doi.org/'+w.DOI,src:'CR'};
      await savePaper(paper);ok++}catch{fail++}
    if(i<lines.length-1)await new Promise(r=>setTimeout(r,300))}
  H(prog,`<div style="font-size:13px;font-family:var(--mf);padding:8px 0"><span style="color:var(--sg);font-weight:700">${ok}</span> papers saved${fail?`, <span style="color:var(--co)">${fail}</span> failed`:''}</div>`);
  btn.disabled=false;btn.textContent='Done';
  if(ok)toast(ok+' papers imported to Library','ok')}
// ═══ SEARCH HISTORY ═══
function saveSearchHist(q){if(!q)return;_searchHist=_searchHist.filter(h=>h!==q);_searchHist.unshift(q);if(_searchHist.length>20)_searchHist=_searchHist.slice(0,20);safeStore('meridian_search_hist',_searchHist)}
function showSearchHist(){const el=$('#searchHist');if(!_searchHist.length){hi(el);return}const q=$('#lq').value.toLowerCase();const fl=q?_searchHist.filter(h=>h.toLowerCase().includes(q)):_searchHist;if(!fl.length){hi(el);return}H(el,fl.slice(0,10).map(h=>{const origIdx=_searchHist.indexOf(h);return`<div onclick="$('#lq').value=_searchHist[${origIdx}]||'';hi('#searchHist');_litPage=0;litSearch()"><span>${escHTML(h)}</span><span class="sh-del" onclick="event.stopPropagation();delSearchHistIdx(${origIdx})">×</span></div>`}).join(''));sh(el)}
function filterSearchHist(){showSearchHist()}
function delSearchHistIdx(idx){if(idx>=0&&idx<_searchHist.length)_searchHist.splice(idx,1);safeStore('meridian_search_hist',_searchHist);showSearchHist()}
function delSearchHist(q){const idx=_searchHist.indexOf(q);if(idx!==-1)_searchHist.splice(idx,1);safeStore('meridian_search_hist',_searchHist);showSearchHist()}
// ═══ SEARCH AUDIT LOG ═══
let _searchAudit=safeParse('meridian_search_audit',[]);
function logSearchAudit(query,filters,engineStatus,srcCounts,totalHits,dedupedCount){
  _searchAudit.push({id:'sa-'+Date.now(),query,filters:{yf:filters.yf||'',yt:filters.yt||'',oa:filters.oa||false},timestamp:new Date().toISOString(),apis:Object.fromEntries(Object.entries(srcCounts).map(([k,v])=>([k,{ok:engineStatus[k]==='ok',count:v}]))),totalHits,dedupedCount});
  safeStore('meridian_search_audit',_searchAudit)}
function renderSearchLog(){
  const el=$('#searchLogContent');if(!el)return;
  if(!_searchAudit.length){el.innerHTML='<p style="color:var(--tm);font-size:12px">No searches recorded yet.</p>';return}
  el.innerHTML=`<div style="overflow-x:auto"><table class="dt"><thead><tr><th>Date</th><th>Query</th><th>Filters</th><th>OA</th><th>SS</th><th>CR</th><th>PM</th><th>Total</th><th>Deduped</th></tr></thead><tbody>${_searchAudit.slice().reverse().map(a=>`<tr><td style="white-space:nowrap">${a.timestamp.slice(0,16).replace('T',' ')}</td><td>${escHTML(a.query)}</td><td>${[a.filters.yf&&'from:'+a.filters.yf,a.filters.yt&&'to:'+a.filters.yt,a.filters.oa&&'OA'].filter(Boolean).join(', ')||'—'}</td>${['OA','SS','CR','PM'].map(k=>`<td style="color:${a.apis[k]?.ok?'var(--sg)':'var(--co)'}">${a.apis[k]?.count??'—'}</td>`).join('')}<td>${a.totalHits}</td><td style="color:var(--ac)">${a.dedupedCount}</td></tr>`).join('')}</tbody></table></div><button class="bt sm" onclick="exportSearchLog()" style="margin-top:8px">Export CSV</button><button class="bt sm" style="color:var(--co);margin-top:8px;margin-left:6px" onclick="_searchAudit=[];safeStore('meridian_search_audit',[]);renderSearchLog()">Clear</button>`}
function exportSearchLog(){
  const rows=['Date,Query,Year From,Year To,OA Only,OA Count,SS Count,CR Count,PM Count,Total Hits,Deduped',..._searchAudit.map(a=>[a.timestamp.slice(0,16),'"'+a.query.replace(/"/g,"'")+'"',a.filters.yf,a.filters.yt,a.filters.oa,a.apis.OA?.count||0,a.apis.SS?.count||0,a.apis.CR?.count||0,a.apis.PM?.count||0,a.totalHits,a.dedupedCount].join(','))];
  dl(rows.join('\n'),'search_audit_log.csv','text/csv');toast('Search log exported','ok')}
// ═══ CITATION SEARCH ═══
async function searchCitedBy(title){$('#lq').value='cites: '+title;_litPage=0;const lp=$('#litProgress');H(lp,`<div class="lit-progress"><div class="lp-bar"><div class="lp-fill" style="width:30%"></div></div><span class="lp-engine"><span class="engine-dot pending"></span>Searching citations via Semantic Scholar...</span></div>`);sh(lp);try{const r=await fetchT('https://api.semanticscholar.org/graph/v1/paper/search?query='+encodeURIComponent(title)+'&limit=1&fields=citationCount,citations.title,citations.authors,citations.year,citations.venue,citations.citationCount,citations.isOpenAccess,citations.externalIds',12000);if(!r.ok)throw new Error('Search failed');const d=await r.json();if(!d.data?.length)throw new Error('Paper not found');const cits=d.data[0].citations||[];S.litR=cits.map(c=>({id:c.paperId||'',title:c.title||'',authors:(c.authors||[]).map(a=>a.name),year:c.year,journal:c.venue||'',doi:c.externalIds?.DOI?'https://doi.org/'+c.externalIds.DOI:null,cited:c.citationCount||0,isOA:c.isOpenAccess||false,abstract:null,concepts:[],url:c.externalIds?.DOI?'https://doi.org/'+c.externalIds.DOI:'',src:'SS'}));H(lp,`<div class="lit-results-bar"><span class="lrb-count">${S.litR.length}</span><span class="lrb-meta">papers cite this work</span></div>`);if(S.litR.length){sh('#compileBtn');sh('#saveAllBtn')}_litAllResults=S.litR;renderLitPage();toast(S.litR.length+' citing papers found','ok')}catch(e){hi(lp);toast('Citation search failed: '+e.message,'err')}}

// Engines & Journals
const ENGINES=[{n:"Google Scholar",u:q=>`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`},{n:"Semantic Scholar",u:q=>`https://www.semanticscholar.org/search?q=${encodeURIComponent(q)}`,api:1},{n:"PubMed",u:q=>`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`,api:1},{n:"CrossRef",u:q=>`https://search.crossref.org/?q=${encodeURIComponent(q)}`,api:1},{n:"CORE",u:q=>`https://core.ac.uk/search?q=${encodeURIComponent(q)}`},{n:"DOAJ",u:q=>`https://doaj.org/search/articles?source={"query":{"query_string":{"query":"${encodeURIComponent(q)}"}}}`},{n:"BASE",u:q=>`https://www.base-search.net/Search/Results?lookfor=${encodeURIComponent(q)}`},{n:"Dimensions",u:q=>`https://app.dimensions.ai/discover/publication?search_text=${encodeURIComponent(q)}`},{n:"The Lens",u:q=>`https://www.lens.org/lens/search/scholar/list?q=${encodeURIComponent(q)}`},{n:"bioRxiv",u:q=>`https://www.biorxiv.org/search/${encodeURIComponent(q)}`},{n:"arXiv",u:q=>`https://arxiv.org/search/?query=${encodeURIComponent(q)}`},{n:"Zenodo",u:q=>`https://zenodo.org/search?q=${encodeURIComponent(q)}`},{n:"JSTOR",u:q=>`https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`},{n:"Scopus",u:q=>`https://www.scopus.com/results/results.uri?s=TITLE-ABS-KEY(${encodeURIComponent(q)})`},{n:"ResearchGate",u:q=>`https://www.researchgate.net/search?q=${encodeURIComponent(q)}`},{n:"FAO Docs",u:q=>`https://www.fao.org/publications/search/en/?query=${encodeURIComponent(q)}`,grey:1},{n:"ICES",u:()=>`https://www.ices.dk/publications/library/Pages/default.aspx`,grey:1},{n:"NOAA",u:q=>`https://repository.library.noaa.gov/gsearch?terms=${encodeURIComponent(q)}`,grey:1}];
const JNL=[{n:"Nature",f:"Multi",t:"S"},{n:"Science",f:"Multi",t:"S"},{n:"PNAS",f:"Multi",t:"S"},{n:"Nature Comms",f:"Multi",t:"A",oa:1},{n:"Science Advances",f:"Multi",t:"A",oa:1},{n:"PLOS ONE",f:"Multi",t:"B",oa:1},{n:"MEPS",f:"Marine",t:"A"},{n:"ICES J Mar Sci",f:"Fish",t:"A"},{n:"Fish and Fisheries",f:"Fish",t:"S"},{n:"Can J Fish Aquat",f:"Fish",t:"A"},{n:"Fisheries Research",f:"Fish",t:"A"},{n:"Marine Biology",f:"Marine",t:"A"},{n:"J Fish Biology",f:"Fish",t:"B"},{n:"Marine Policy",f:"Policy",t:"A"},{n:"Aquaculture",f:"Aqua",t:"A"},{n:"Front Mar Sci",f:"Marine",t:"A",oa:1},{n:"Prog Oceanogr",f:"Ocean",t:"S"},{n:"Limnol Oceanogr",f:"Ocean",t:"S"},{n:"Ecology Letters",f:"Ecology",t:"S"},{n:"Conserv Biology",f:"Conserv",t:"S"},{n:"Nature Clim Change",f:"Climate",t:"S"},{n:"Global Change Biol",f:"Climate",t:"S"},{n:"GRL",f:"Earth",t:"S"},{n:"ES&T",f:"Environ",t:"S"},{n:"Methods Ecol Evol",f:"Methods",t:"S",oa:1},{n:"Remote Sens Env",f:"RS",t:"S"},{n:"Molecular Ecology",f:"Genetics",t:"S"},{n:"Mar Pollut Bull",f:"Environ",t:"B"},{n:"Deep-Sea Res I",f:"Ocean",t:"A"},{n:"J Biogeography",f:"Biogeog",t:"A"},{n:"Zootaxa",f:"Taxonomy",t:"A"},{n:"Biol Conserv",f:"Conserv",t:"A"},{n:"Ecol Applications",f:"Ecology",t:"A"},{n:"Oikos",f:"Ecology",t:"A",oa:1}];

$('#togEng').addEventListener('click',function(){const p=$('#engPanel');if(p.style.display==='none'){this.classList.add('on');hi('#jnlPanel');$('#togJnl').classList.remove('on');const q=$('#lq').value;H(p,`<div class="sec"><div class="sh"><h4>Search Engines (${ENGINES.length}) — click to search with your query</h4></div><div class="sb"><div style="margin-bottom:10px;padding:10px 12px;background:var(--am);border:1px solid var(--ab);border-radius:6px"><div style="font-size:11px;color:var(--ac);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Preprint Servers (supplementary)</div><div style="display:flex;gap:12px;flex-wrap:wrap"><label style="font-size:12px;color:var(--ts);font-family:var(--mf);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="eng-es" style="accent-color:var(--wa)"> ESSOAr (Earth science preprints)</label><label style="font-size:12px;color:var(--ts);font-family:var(--mf);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="eng-br" style="accent-color:var(--wa)"> bioRxiv / medRxiv (life science preprints)</label></div></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px">${ENGINES.map(e=>`<a href="${q?e.u(q):'#'}" target="_blank" style="display:block;padding:8px 12px;background:var(--be);border:1px solid var(--bd);border-radius:5px;text-decoration:none;font-size:13px;color:var(--ac);${q?'':'opacity:0.4'}">${e.n}${e.api?' <span style="font-size:9px;padding:2px 5px;border-radius:2px;background:var(--sm);color:var(--sg)">API</span>':''}${e.grey?' <span style="font-size:9px;padding:2px 5px;border-radius:2px;background:var(--am);color:var(--ac)">Grey</span>':''}</a>`).join('')}</div></div></div>`);sh(p)}else{this.classList.remove('on');hi(p)}});
$('#togJnl').addEventListener('click',function(){const p=$('#jnlPanel');if(p.style.display==='none'){this.classList.add('on');hi('#engPanel');$('#togEng').classList.remove('on');const fields=[...new Set(JNL.map(j=>j.f))].sort();H(p,`<div class="sec"><div class="sh"><h4>Journals (${JNL.length})</h4></div><div class="sb"><div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap"><button class="bt sm on" onclick="filterJnl('')">All</button>${fields.map(f=>`<button class="bt sm" onclick="filterJnl('${f}')">${f}</button>`).join('')}</div><div id="jnlList">${renderJnlList('')}</div></div></div>`);sh(p)}else{this.classList.remove('on');hi(p)}});
function filterJnl(f){H('#jnlList',renderJnlList(f))}
function renderJnlList(f){const fl=f?JNL.filter(j=>j.f===f):JNL;return`<table class="dt" style="font-size:12px"><thead><tr><th>Journal</th><th>Field</th><th>Tier</th><th>OA</th></tr></thead><tbody>${fl.map(j=>`<tr><td>${j.n}</td><td style="color:var(--ts)">${j.f}</td><td style="color:${j.t==='S'?'var(--ac)':j.t==='A'?'var(--sg)':'var(--tm)'};font-weight:700;font-family:var(--mf)">${j.t}</td><td style="color:${j.oa?'var(--sg)':'var(--tm)'}">${j.oa?'✓':''}</td></tr>`).join('')}</tbody></table>`}
H('#lemp','<p style="color:var(--tm);text-align:center;padding:50px;font-size:13px;line-height:1.6">Search 4 APIs simultaneously. Save papers to Library for later analysis.</p>');

function clusterOcc(points,gridSize){
  if(!gridSize){
    // Adaptive grid: compute from data spread
    if(points.length<2){gridSize=5}else{
      const lats=points.map(p=>p.lat).filter(v=>v!=null),lons=points.map(p=>p.lon).filter(v=>v!=null);
      if(!lats.length||!lons.length){gridSize=5}else{
      const latRange=Math.max(...lats)-Math.min(...lats),lonRange=Math.max(...lons)-Math.min(...lons);
      gridSize=Math.max(1,Math.min(10,Math.max(latRange,lonRange)/20))}
    }
  }
  const grid={};
  points.forEach(p=>{
    const key=`${Math.round(p.lat/gridSize)*gridSize},${Math.round(p.lon/gridSize)*gridSize}`;
    if(!grid[key])grid[key]={lat:0,lon:0,n:0};
    grid[key].lat+=p.lat;grid[key].lon+=p.lon;grid[key].n++;
  });
  return Object.values(grid).map(c=>({lat:c.lat/c.n,lon:c.lon/c.n,n:c.n}));
}
const _speciesCache=new Map();
const FB_PROXY='/api/fishbase';
// ═══ SPECIES — WoRMS primary, GBIF+OBIS parallel, FishBase via proxy ═══
async function speciesSearch(){const q=$('#sq').value.trim();if(!q)return;_errPipeline.crumb('search','Species: '+q.slice(0,40));
const cacheKey=q.toLowerCase().trim();if(_speciesCache.has(cacheKey)){window._sp=_speciesCache.get(cacheKey);renderSpeciesResult();return}
H('#sres','');H('#sload',mkL());sh('#sload');
let genus='',species='',sciName='',worms=null,gbifTax=null,gbifOcc=[],obisOcc=[],fb={},gbifKey=null,rank='';
// 1: WoRMS (CORS-safe) — fuzzy name match
try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(q)}&marine_only=false`,12000);if(r.ok){const d=await r.json();if(d?.[0]?.length){worms=d[0][0];genus=worms.genus||'';species=worms.species||'';sciName=worms.scientificname||q;rank=worms.rank||''}}}catch{}
// 2: No scientific match — search by common name (WoRMS vernacular + GBIF suggest)
if(!worms){
let candidates=[];const seen=new Set();
const [vernR,gbifSugR]=await Promise.allSettled([
fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByVernacular/${encodeURIComponent(q)}?like=true`,10000),
fetchT(`https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(q)}&limit=12`,10000)
]);
if(vernR.status==='fulfilled'&&vernR.value.ok){try{const vd=await vernR.value.json();let recs=Array.isArray(vd)?vd:[];const acc=recs.filter(r=>r.status==='accepted');if(acc.length)recs=acc;
recs.forEach(rec=>{if(!rec.scientificname)return;const key=rec.scientificname.toLowerCase();if(seen.has(key))return;seen.add(key);
candidates.push({sciName:rec.scientificname,rank:rec.rank||'',family:rec.family||'',genus:rec.genus||'',source:'WoRMS',aphiaId:rec.AphiaID,vernacular:''});})}catch{}}
if(gbifSugR.status==='fulfilled'&&gbifSugR.value.ok){try{const gd=await gbifSugR.value.json();
(Array.isArray(gd)?gd:[]).forEach(rec=>{if(!rec.scientificName)return;const key=rec.scientificName.toLowerCase();
const ex=candidates.find(c=>c.sciName.toLowerCase()===key);if(ex){if(!ex.vernacular&&rec.vernacularName)ex.vernacular=rec.vernacularName;return}
if(seen.has(key))return;seen.add(key);
candidates.push({sciName:rec.scientificName,rank:rec.rank||'',family:rec.family||'',genus:rec.genus||'',source:'GBIF',vernacular:rec.vernacularName||'',gbifKey:rec.key});})}catch{}}
if(candidates.length>1){hi('#sload');
const qSafe=q.replace(/</g,'&lt;').replace(/>/g,'&gt;');
let h=`<div class="sec"><div class="sh"><h4 style="letter-spacing:0;text-transform:none">Multiple species match "<span style="color:var(--ac)">${qSafe}</span>" — select one</h4></div><div class="sb">`;
candidates.slice(0,15).forEach(c=>{const esc=c.sciName.replace(/'/g,"\\'");
h+=`<div class="pc" onclick="pickSpecies('${esc}')"><div style="font-style:italic;color:var(--ac);font-size:15px">${c.sciName}</div><div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-top:4px">${c.family?c.family+' · ':''}${c.rank||''}${c.source?' · '+c.source:''}${c.vernacular?' · <span style="color:var(--sg)">'+c.vernacular+'</span>':''}</div></div>`;});
h+=`</div></div>`;H('#sres',h);return}
if(candidates.length===1){const c=candidates[0];
if(c.aphiaId){try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordByAphiaID/${c.aphiaId}`,10000);if(r.ok){worms=await r.json();genus=worms.genus||'';species=worms.species||'';sciName=worms.scientificname||c.sciName;rank=worms.rank||''}}catch{}}
if(!worms){sciName=c.sciName;genus=c.genus||'';rank=c.rank||''}}
}
// 3: GBIF species match (works for families, common names, any rank)
try{const r=await fetchT(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sciName||q)}&verbose=true`,10000);if(r.ok){gbifTax=await r.json();gbifKey=gbifTax.usageKey;if(!genus&&gbifTax.genus){genus=gbifTax.genus;species=gbifTax.species||'';sciName=gbifTax.scientificName||sciName||q}if(!sciName)sciName=gbifTax.scientificName||q;if(!rank)rank=gbifTax.rank||''}}catch{}
// If we have neither WoRMS nor GBIF key, fail
if(!worms&&!gbifKey){hi('#sload');H('#sres','<p style="color:var(--tm);text-align:center;padding:40px">Not found. Try a scientific name (e.g. "Carcharodon carcharias") or common name (e.g. "humpback whale").</p>');return}
// 2: Parallel GBIF occ + OBIS + FishBase + WoRMS extras
let vernaculars=[],attributes=[],distributions=[];
await Promise.all([
(async()=>{try{const r=await fetchT(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(sciName)}&limit=300&hasCoordinate=true`,12000);if(r.ok){const d=await r.json();gbifOcc=d.results||[]}}catch{}})(),
(async()=>{try{const r=await fetchT(`https://api.obis.org/v3/occurrence?scientificname=${encodeURIComponent(sciName)}&size=300`,12000);if(r.ok){const d=await r.json();obisOcc=d.results||[]}}catch{}})(),
(async()=>{if(!genus)return;try{
  const r=await fetchT(`${FB_PROXY}/species?Genus=${encodeURIComponent(genus)}&Species=${encodeURIComponent(species)}&limit=3`,8000);
  if(r.ok){const d=await r.json();fb=(d.data||[])[0]||{};
    if(fb.SpecCode){try{const er=await fetchT(`${FB_PROXY}/ecology?SpecCode=${fb.SpecCode}&limit=1`,6000);
    if(er.ok){const ed=await er.json();fb._eco=(ed.data||[])[0]||{}}}catch{}}
  }}catch{}})(),
(async()=>{window._spIUCN=gbifTax?.iucnRedListCategory||null;if(!window._spIUCN){const k=gbifKey||gbifTax?.usageKey;if(!k)return;try{const r=await fetchT(`https://api.gbif.org/v1/species/${k}`,8000);if(r.ok){const d=await r.json();window._spIUCN=d.iucnRedListCategory||d.threatStatus||null}}catch{window._spIUCN=null}}})(),
(async()=>{if(!worms?.AphiaID)return;try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaVernacularsByAphiaID/${worms.AphiaID}`,8000);if(r.ok)vernaculars=await r.json()||[]}catch{}})(),
(async()=>{if(!worms?.AphiaID)return;try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaAttributesByAphiaID/${worms.AphiaID}`,8000);if(r.ok)attributes=await r.json()||[]}catch{}})(),
(async()=>{if(!worms?.AphiaID)return;try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaDistributionsByAphiaID/${worms.AphiaID}`,8000);if(r.ok)distributions=await r.json()||[]}catch{}})(),
(async()=>{try{const nm=sciName||q;const r=await fetchT(`https://www.boldsystems.org/index.php/API_Public/combined?taxon=${encodeURIComponent(nm)}&format=json`,10000);if(r.ok){const txt=await r.text();try{const d=JSON.parse(txt);const recs=d.bold_records?.records;window._spBOLD=recs?Object.keys(recs).length:0}catch{window._spBOLD=0}}else window._spBOLD=0}catch{window._spBOLD=0}})(),
(async()=>{try{const nm=sciName||q;const r=await fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nucleotide&term=${encodeURIComponent(nm)}[Organism]&retmode=json`,8000);if(r.ok){const d=await r.json();window._spGenBank=parseInt(d.esearchresult?.count||'0')}else window._spGenBank=0}catch{window._spGenBank=0}})()
]);
hi('#sload');
window._sp={genus,species,sciName,worms,gbifTax,gbifOcc,obisOcc,fb,rank,gbifKey,vernaculars,attributes,distributions};
_speciesCache.set(cacheKey,window._sp);if(_speciesCache.size>10){const oldest=[..._speciesCache.keys()];_speciesCache.delete(oldest[0])}
renderSpeciesResult()}
function renderSpeciesResult(){
const{genus,species,sciName,worms,gbifTax,gbifOcc,obisOcc,fb,rank,gbifKey,vernaculars,attributes,distributions}=window._sp;
const tot=gbifOcc.length+obisOcc.length;
if(window._spMap){try{window._spMap.remove()}catch{};window._spMap=null}
const iucnColors={LC:'#7B9E87',NT:'#D4A04A',VU:'#C9956B',EN:'#C27878',CR:'#8B2020',EW:'#9B8EC4',EX:'#333',DD:'#8A837E',NE:'#8A837E'};
const iucnFull={LC:'Least Concern',NT:'Near Threatened',VU:'Vulnerable',EN:'Endangered',CR:'Critically Endangered',EW:'Extinct in the Wild',EX:'Extinct',DD:'Data Deficient',NE:'Not Evaluated'};
const iucn=window._spIUCN;
const vNames=(vernaculars||[]).slice(0,5);
const commonName=vNames.find(v=>v.language_code==='eng'||v.language==='English')?.vernacular||fb.FBname||'';
let h='<div class="sec"><div class="sb">';
// ── HEADER ──
h+=`<div style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h4 style="color:var(--ac);font-style:italic;font-size:18px;letter-spacing:0;margin:0">${sciName}</h4>`;
if(rank&&rank!=='Species')h+=`<span style="font-size:11px;color:var(--tm);text-transform:uppercase;font-family:var(--mf)">${rank}</span>`;
if(iucn){const ic=iucnColors[iucn]||'#8A837E';h+=`<span style="display:inline-flex;align-items:center;gap:4px;background:${ic}22;color:${ic};border:1px solid ${ic}44;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600;font-family:var(--mf)">${iucn} <span style="font-weight:400;font-size:11px">${iucnFull[iucn]||iucn}</span></span>`}
h+=`</div>`;
if(commonName||vNames.length)h+=`<div style="font-size:13px;color:var(--ts);margin-top:4px">${commonName?`<b style="color:var(--tx)">${escHTML(commonName)}</b>`:''}${vNames.length>1?' · '+vNames.filter(v=>v.vernacular!==commonName).slice(0,3).map(v=>`<span style="color:var(--tm)">${escHTML(v.vernacular)} <span style="font-size:10px;opacity:.6">(${escHTML(v.language_code||v.language||'')})</span></span>`).join(' · '):''}</div>`;
h+=`</div>`;
// ── DISTRIBUTION MAP ──
if(tot>0||gbifKey)h+=`<div id="spmap" style="height:400px;border-radius:8px;border:1px solid var(--bd);overflow:hidden;margin-bottom:16px;position:relative"></div>`;
// ── DATA CARDS ──
h+=`<div class="sp-info">`;
// Biology (FishBase)
const bio=[];if(fb.FBname)bio.push(['Common Name',fb.FBname]);if(fb.DepthRangeShallow!=null)bio.push(['Depth',`${fb.DepthRangeShallow}–${fb.DepthRangeDeep||'?'} m`]);if(fb.LongevityWild)bio.push(['Longevity',fb.LongevityWild+' yr']);if(fb.Length)bio.push(['Max Length',fb.Length+' cm']);if(fb.Weight)bio.push(['Max Weight',fb.Weight+' g']);if(fb.Vulnerability)bio.push(['Vulnerability',fb.Vulnerability+'/100']);
if(fb._eco){if(fb._eco.FoodTroph)bio.push(['Trophic Level',fb._eco.FoodTroph.toFixed(2)]);if(fb._eco.DietTroph)bio.push(['Diet Troph',fb._eco.DietTroph.toFixed(2)]);if(fb._eco.Benthic!=null&&fb._eco.Benthic)bio.push(['Habitat','Benthic']);else if(fb._eco.Pelagic!=null&&fb._eco.Pelagic)bio.push(['Habitat','Pelagic']);else if(fb._eco.Reef!=null&&fb._eco.Reef)bio.push(['Habitat','Reef-associated'])}
if(bio.length)h+=`<div class="sp-card"><div class="lbl">Biology (FishBase)</div><div class="val">${bio.map(([k,v])=>`<span style="color:var(--tm)">${k}:</span> ${v}`).join('<br>')}</div></div>`;
else h+=`<div class="sp-card"><div class="lbl">Biology</div><div class="val" style="color:var(--tm);font-size:12px">FishBase data unavailable</div></div>`;
// Taxonomy
const tax=[];if(worms){['kingdom','phylum','class','order','family','genus','species'].forEach(k=>{if(worms[k])tax.push([k[0].toUpperCase()+k.slice(1),worms[k]])})}else if(gbifTax){['kingdom','phylum','class','order','family','genus','species'].forEach(k=>{if(gbifTax[k])tax.push([k[0].toUpperCase()+k.slice(1),gbifTax[k]])})}
if(tax.length)h+=`<div class="sp-card"><div class="lbl">Taxonomy ${worms?'(WoRMS #'+worms.AphiaID+')':'(GBIF)'}</div><div class="val">${tax.map(([k,v])=>`<span style="color:var(--tm)">${k}:</span> ${v}`).join('<br>')}</div></div>`;
// WoRMS
if(worms){const wi=[];if(worms.status)wi.push(['Status',worms.status]);if(worms.isMarine!=null)wi.push(['Marine',worms.isMarine?'Yes':'No']);if(worms.authority)wi.push(['Authority',worms.authority]);if(wi.length)h+=`<div class="sp-card"><div class="lbl">WoRMS</div><div class="val">${wi.map(([k,v])=>`<span style="color:var(--tm)">${k}:</span> ${v}`).join('<br>')}</div></div>`}
// WoRMS Ecology/Attributes
const attrs=attributes||[];const ecoItems=[];attrs.forEach(a=>{const mt=(a.measurementType||'').toLowerCase();const mv=a.measurementValue||'';if(mt.includes('body size'))ecoItems.push(['Body Size',mv]);else if(mt.includes('habitat'))ecoItems.push(['Habitat',mv]);else if(mt.includes('feeding'))ecoItems.push(['Feeding Type',mv]);else if(mt.includes('functional group'))ecoItems.push(['Functional Group',mv])});
if(ecoItems.length)h+=`<div class="sp-card"><div class="lbl">Ecology (WoRMS)</div><div class="val">${ecoItems.map(([k,v])=>`<span style="color:var(--tm)">${k}:</span> ${v}`).join('<br>')}</div></div>`;
// WoRMS Distributions
const dists=distributions||[];
if(dists.length)h+=`<div class="sp-card"><div class="lbl">Known Regions</div><div class="val" style="font-size:12px;line-height:1.6">${dists.slice(0,12).map(d=>`<span style="color:var(--ts)">${escHTML(d.locality||d.locationID||'')}</span>`).join(' · ')}${dists.length>12?` <span style="color:var(--tm)">+${dists.length-12} more</span>`:''}</div></div>`;
// Occurrences
h+=`<div class="sp-card"><div class="lbl">Occurrences</div><div class="val">GBIF: <b>${gbifOcc.length}</b> · OBIS: <b>${obisOcc.length}</b> · Total: <b style="color:var(--ac)">${tot}</b></div></div>`;
// BOLD Barcodes
if(window._spBOLD>0)h+=`<div class="sp-card"><div class="lbl">BOLD Barcodes</div><div class="val"><b style="color:var(--ac)">${window._spBOLD.toLocaleString()}</b> records<br><a href="https://www.boldsystems.org/index.php/Taxbrowser_Taxonpage?taxon=${encodeURIComponent(sciName)}" target="_blank" style="font-size:11px">View on BOLD →</a></div></div>`;
// GenBank
if(window._spGenBank>0)h+=`<div class="sp-card"><div class="lbl">GenBank</div><div class="val"><b style="color:var(--ac)">${window._spGenBank.toLocaleString()}</b> sequences<br><a href="https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(sciName)}[Organism]" target="_blank" style="font-size:11px">View on NCBI →</a></div></div>`;
h+=`</div>`;
// ── CHARTS ──
const depths=[...gbifOcc.filter(o=>o.depth!=null).map(o=>o.depth),...obisOcc.filter(o=>o.depth!=null).map(o=>o.depth)];
const years=[...gbifOcc.filter(o=>o.year).map(o=>o.year),...obisOcc.filter(o=>o.date_year).map(o=>o.date_year)];
if(depths.length>3||years.length>3){h+=`<div style="display:grid;grid-template-columns:${depths.length>3&&years.length>3?'1fr 1fr':'1fr'};gap:12px;margin:14px 0">`;if(depths.length>3)h+=`<div class="pcc" id="spdepth" style="height:220px"></div>`;if(years.length>3)h+=`<div class="pcc" id="spyr" style="height:220px"></div>`;h+=`</div>`}
// ── EXTERNAL LINKS ──
h+=`<div style="display:flex;gap:6px;margin:14px 0;flex-wrap:wrap">`;
if(worms?.AphiaID)h+=`<a href="https://www.marinespecies.org/aphia.php?p=taxdetails&id=${worms.AphiaID}" target="_blank" class="bt sm">WoRMS →</a>`;
if(gbifKey)h+=`<a href="https://www.gbif.org/species/${gbifKey}" target="_blank" class="bt sm">GBIF →</a>`;
h+=`<a href="https://www.iucnredlist.org/search?query=${encodeURIComponent(sciName)}" target="_blank" class="bt sm">IUCN Red List →</a>`;
if(worms?.AphiaID)h+=`<a href="https://obis.org/taxon/${worms.AphiaID}" target="_blank" class="bt sm">OBIS →</a>`;
if(genus&&species){h+=`<a href="https://www.fishbase.se/summary/${encodeURIComponent(genus+'+'+species)}" target="_blank" class="bt sm">FishBase →</a>`;
h+=`<a href="https://www.aquamaps.org/receive.php?type_of_map=regular&Genus=${encodeURIComponent(genus)}&Species=${encodeURIComponent(species)}" target="_blank" class="bt sm" style="color:var(--sg)">Predicted Range (AquaMaps) →</a>`}
h+=`</div>`;
// ── EXPANDABLE PANELS ──
// P2.1 Conservation & Protection Panel
h+=`<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadConservation()"><h4>Conservation & Protection</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-conservation" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
// P2.2 Fisheries Data (conditional: fish classes only)
const fishClasses=['Actinopteri','Elasmobranchii','Holocephali','Cladistii','Coelacanthiformes','Dipnoi','Myxini','Petromyzonti'];
const taxClass=worms?.class||gbifTax?.class||'';
if(fishClasses.some(c=>taxClass.toLowerCase()===c.toLowerCase()))
h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadFisheries()"><h4>Fisheries Data</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-fisheries" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
// P2.5 Paleobiology / Fossil Record
if(genus)h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadPaleobiology()"><h4>Fossil Record</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-paleo" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
// P5: Phylogeny (Open Tree of Life)
h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadPhylogeny()"><h4>Phylogeny</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-phylogeny" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
// P5: Genetic Resources (eDNA + SRA links)
h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadGeneticResources()"><h4>Genetic Resources</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-genetics" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';if(this.nextElementSibling.style.display!=='none')loadOTN()"><h4>Telemetry (OTN)</h4><span style="color:var(--tm)">▸</span></div><div class="sb" id="sp-otn" style="display:none"><div style="color:var(--tm);font-size:12px">Click to load...</div></div></div>`;
h+=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'"><h4>Species Distribution Model</h4><span style="color:var(--tm)">▸</span></div><div class="sb" style="display:none"><div style="margin-bottom:8px;font-size:12px;color:var(--tm);font-family:var(--mf)">Bioclimatic envelope model using occurrence records + environmental variables.</div><button class="bt sm on" onclick="modelDistribution()" id="btn-sdm" ${tot&&Object.keys(S.envR||{}).length?'':'disabled'} title="${tot&&Object.keys(S.envR||{}).length?'Run envelope model':'Requires occurrence data + env variables'}">Model Distribution</button>${!tot?'<span style="font-size:11px;color:var(--tm);margin-left:8px">Need occurrence data</span>':''}${!Object.keys(S.envR||{}).length?'<span style="font-size:11px;color:var(--tm);margin-left:8px">Need env variables (fetch in Env Data tab)</span>':''}<div id="sp-sdm-results" style="margin-top:10px"></div></div></div>`;
// ── ACTION BUTTONS ──
h+=`<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">${tot?`<button class="bt sm on" onclick="sendOccWS()">Occurrences → Workshop</button>`:''}<button class="bt sm" onclick="sendProfWS()">Profile → Workshop</button>${tot?`<button class="bt sm" onclick="dlSpCSV()">Download CSV</button>`:''}<button class="bt sm" onclick="searchSpeciesLit()">Search Literature</button>${(gbifOcc.length>=300||obisOcc.length>=300)?`<button class="bt sm" onclick="loadMoreOcc()" id="loadMoreOccBtn" style="color:var(--sg)">Load More Occurrences</button>`:''}<button class="bt sm" onclick="fetchEnvAtCentroid()">Env at Centroid</button><button class="bt sm" onclick="searchSpeciesGaps()">Find Gaps</button>${tot?`<button class="bt sm" onclick="dlDarwinCore()">Darwin Core</button><button class="bt sm" onclick="dlGeoJSON()">GeoJSON</button>`:''}</div>`;
h+=`<div id="sp-imgs" style="margin-top:12px"></div>`;
h+=`</div></div>`;
H('#sres',h);try{sessionStorage.setItem('meridian_sp',JSON.stringify({sciName:window._sp.sciName,gbifOcc:window._sp.gbifOcc.slice(0,50),obisOcc:window._sp.obisOcc.slice(0,50),worms:window._sp.worms,gbifTax:window._sp.gbifTax,fb:window._sp.fb,rank:window._sp.rank,genus:window._sp.genus,species:window._sp.species}));}catch{}
setTimeout(()=>{
// ── LEAFLET DISTRIBUTION MAP ──
if($('#spmap')&&(tot||gbifKey)&&typeof L!=='undefined'){
  const spMap=L.map('spmap',{center:[0,0],zoom:2,zoomControl:true,attributionControl:false,preferCanvas:true});
  window._spMap=spMap;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,subdomains:'abcd'}).addTo(spMap);
  const overlays={};
  // GBIF density tile overlay (amber/orange dots rendered server-side)
  if(gbifKey){const gbifTiles=L.tileLayer(`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${gbifKey}&style=scaled.circles&srs=EPSG:3857`,{opacity:0.8});gbifTiles.addTo(spMap);overlays['GBIF Occurrences']=gbifTiles}
  // OBIS circle markers (green)
  const oL=obisOcc.filter(o=>o.decimalLatitude);
  if(oL.length){const obisGroup=L.layerGroup();const oC=clusterOcc(oL.map(o=>({lat:o.decimalLatitude,lon:o.decimalLongitude})));
    oC.forEach(c=>{L.circleMarker([c.lat,c.lon],{radius:Math.min(14,3+Math.sqrt(c.n)*1.5),fillColor:'#7B9E87',color:'#7B9E87',weight:1,opacity:.7,fillOpacity:.5}).bindPopup(`OBIS: ${c.n} records`).addTo(obisGroup)});
    obisGroup.addTo(spMap);overlays['OBIS Occurrences']=obisGroup}
  // Layer control (top-right)
  if(Object.keys(overlays).length)L.control.layers(null,overlays,{collapsed:false,position:'topright'}).addTo(spMap);
  // Legend (bottom-right)
  const legend=L.control({position:'bottomright'});
  legend.onAdd=function(){const d=L.DomUtil.create('div');d.style.cssText='background:rgba(39,37,54,.9);padding:8px 12px;border-radius:6px;font-size:11px;font-family:var(--mf);color:var(--ts);line-height:1.6;border:1px solid var(--bd)';
    d.innerHTML=`<div style="margin-bottom:4px;font-weight:600;color:var(--tx)">Sources</div><div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#C9956B;margin-right:6px;vertical-align:middle"></span>GBIF (${gbifOcc.length})</div><div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7B9E87;margin-right:6px;vertical-align:middle"></span>OBIS (${obisOcc.length})</div>`;return d};
  legend.addTo(spMap);
  // Fit bounds via GBIF capabilities
  if(gbifKey){fetchT(`https://api.gbif.org/v2/map/occurrence/density/capabilities.json?taxonKey=${gbifKey}`,6000).then(r=>r.json()).then(d=>{if(d.minLat!=null&&d.maxLat!=null)spMap.fitBounds([[d.minLat,d.minLng],[d.maxLat,d.maxLng]],{padding:[30,30],maxZoom:8})}).catch(()=>{const allPts=[...gbifOcc.filter(o=>o.decimalLatitude).map(o=>[o.decimalLatitude,o.decimalLongitude]),...oL.map(o=>[o.decimalLatitude,o.decimalLongitude])];if(allPts.length)spMap.fitBounds(allPts,{padding:[30,30],maxZoom:8})})}
  else{const allPts=[...gbifOcc.filter(o=>o.decimalLatitude).map(o=>[o.decimalLatitude,o.decimalLongitude]),...oL.map(o=>[o.decimalLatitude,o.decimalLongitude])];if(allPts.length)spMap.fitBounds(allPts,{padding:[30,30],maxZoom:8})}
  loadSEAMAP();
}
// Depth + Year histograms (Plotly)
if($('#spdepth')&&depths.length>3)Plotly.newPlot('spdepth',[{x:depths,type:'histogram',marker:{color:'#9B8EC4'},nbinsx:25}],{...PL,height:220,title:{text:'Depth (m)',font:{size:12}}},{responsive:true});
if($('#spyr')&&years.length>3)Plotly.newPlot('spyr',[{x:years,type:'histogram',marker:{color:'#C9956B'},nbinsx:30}],{...PL,height:220,title:{text:'Records by Year',font:{size:12}}},{responsive:true});
if(gbifKey){fetchT(`https://api.gbif.org/v1/occurrence/search?taxonKey=${gbifKey}&mediaType=StillImage&limit=5`,8000)
  .then(r=>r.json()).then(d=>{const imgs=(d.results||[]).filter(o=>o.media?.[0]?.identifier).slice(0,3);if(imgs.length){H('#sp-imgs',`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${imgs.map(o=>`<div style="flex:1;min-width:150px;max-width:220px"><img src="${o.media[0].identifier}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;border:1px solid var(--bd)" onerror="this.parentNode.remove()" loading="lazy"/><div style="font-size:10px;color:var(--tm);margin-top:2px;font-family:var(--mf)">${o.country||''} ${o.year||''}</div></div>`).join('')}</div>`)}}).catch(()=>{})}
},200)}
function sendOccWS(){const d=window._sp;if(!d)return;S.wsC=['Src','Species','Lat','Lon','Depth','Year','Country'];S.wsD=[...d.gbifOcc.map(o=>({Src:'GBIF',Species:d.sciName,Lat:o.decimalLatitude,Lon:o.decimalLongitude,Depth:o.depth,Year:o.year,Country:o.country||''})),...d.obisOcc.map(o=>({Src:'OBIS',Species:d.sciName,Lat:o.decimalLatitude,Lon:o.decimalLongitude,Depth:o.depth,Year:o.date_year,Country:o.country||''}))];autoTypes();initWS();goTab('workshop')}
function sendProfWS(){const d=window._sp;if(!d)return;S.wsC=['Field','Value'];S.wsD=[{Field:'Name',Value:d.sciName},{Field:'Family',Value:d.worms?.family||d.gbifTax?.family||d.fb?.Family||''},{Field:'MaxLength',Value:d.fb?.Length||''},{Field:'MaxDepth',Value:d.fb?.DepthRangeDeep||''},{Field:'GBIF',Value:d.gbifOcc.length},{Field:'OBIS',Value:d.obisOcc.length}];autoTypes();initWS();goTab('workshop')}
function dlSpCSV(){const d=window._sp;if(!d)return;dl(['Source,Species,Lat,Lon,Depth,Year,Country',...d.gbifOcc.map(o=>`GBIF,"${d.sciName}",${o.decimalLatitude||''},${o.decimalLongitude||''},${o.depth||''},${o.year||''},${o.country||''}`),...d.obisOcc.map(o=>`OBIS,"${d.sciName}",${o.decimalLatitude||''},${o.decimalLongitude||''},${o.depth||''},${o.date_year||''},${o.country||''}`)].join('\n'),d.sciName.replace(/ /g,'_')+'.csv','text/csv')}
async function loadMoreOcc(){
  if(!window._sp)return;const d=window._sp;const btn=$('#loadMoreOccBtn');if(btn)btn.textContent='Loading...';
  try{const r=await fetchT(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(d.sciName)}&limit=300&hasCoordinate=true&offset=${d.gbifOcc.length}`,12000);
    if(r.ok){const rd=await r.json();d.gbifOcc=[...d.gbifOcc,...(rd.results||[])]}}catch{}
  try{const r=await fetchT(`https://api.obis.org/v3/occurrence?scientificname=${encodeURIComponent(d.sciName)}&size=300&after=${d.obisOcc.length}`,12000);
    if(r.ok){const rd=await r.json();d.obisOcc=[...d.obisOcc,...(rd.results||[])]}}catch{}
  toast(`Now ${d.gbifOcc.length} GBIF + ${d.obisOcc.length} OBIS occurrences`,'ok');renderSpeciesResult()}
$('#ssb').addEventListener('click',speciesSearch);$('#sq').addEventListener('keydown',e=>{if(e.key==='Enter')speciesSearch()});
function pickSpecies(name){$('#sq').value=name;speciesSearch()}
function searchSpeciesLit(){if(window._sp){$('#lq').value=window._sp.sciName;goTab('lit');_litPage=0;litSearch()}}
function searchSpeciesGaps(){if(window._sp){goTab('gaps');const gi=$('#gapsSpecies');if(gi)gi.value=window._sp.sciName}}
// ═══ P2.1 CONSERVATION & PROTECTION (lazy) ═══
async function loadConservation(){
  const el=$('#sp-conservation');if(!el||el.dataset.loaded)return;el.dataset.loaded='1';
  const d=window._sp;if(!d)return;el.innerHTML='<div class="ld"><div class="ld-d" style="animation:pulse 1s infinite"></div><div class="ld-d" style="animation:pulse 1s .2s infinite"></div><div class="ld-d" style="animation:pulse 1s .4s infinite"></div></div>';
  let h='<div class="sp-info">';
  // IUCN status
  const ts=window._spIUCN;if(ts){const iucnColors={CR:'#C27878',EN:'#D4A04A',VU:'#D4A04A',NT:'#7B9E87',LC:'#7B9E87',DD:'#8A837E'};const iucnFull={CR:'Critically Endangered',EN:'Endangered',VU:'Vulnerable',NT:'Near Threatened',LC:'Least Concern',DD:'Data Deficient'};
  h+=`<div class="sp-card"><div class="lbl">IUCN Red List</div><div class="val"><span class="bg" style="background:${iucnColors[ts]||'var(--tm)'}22;color:${iucnColors[ts]||'var(--tm)'};border:1px solid ${iucnColors[ts]||'var(--tm)'}44;font-weight:600">${ts}</span> ${iucnFull[ts]||ts}</div></div>`}
  // CITES check
  try{const r=await fetchT(`https://api.speciesplus.net/api/v1/taxon_concepts?name=${encodeURIComponent(d.sciName)}`,10000);
  if(r.ok){const cd=await r.json();const taxa=cd.taxon_concepts||[];if(taxa.length){const t=taxa[0];const listings=(t.cites_listings||[]).map(l=>l.appendix).filter(Boolean);
  h+=`<div class="sp-card"><div class="lbl">CITES</div><div class="val">${listings.length?listings.map(a=>`<span class="bg" style="background:var(--cm);color:var(--co);border:1px solid rgba(194,120,120,.3)">Appendix ${a}</span>`).join(''):'Not listed'}</div></div>`}}}catch{}
  // MPA proximity (from occurrence centroid)
  if(d.gbifOcc.length||d.obisOcc.length){
    const allLat=[...d.gbifOcc.filter(o=>o.decimalLatitude).map(o=>o.decimalLatitude),...d.obisOcc.filter(o=>o.decimalLatitude).map(o=>o.decimalLatitude)];
    const allLon=[...d.gbifOcc.filter(o=>o.decimalLongitude).map(o=>o.decimalLongitude),...d.obisOcc.filter(o=>o.decimalLongitude).map(o=>o.decimalLongitude)];
    if(allLat.length){const cLat=(Math.min(...allLat)+Math.max(...allLat))/2;const cLon=(Math.min(...allLon)+Math.max(...allLon))/2;
    h+=`<div class="sp-card"><div class="lbl">Range Centroid</div><div class="val">${cLat.toFixed(2)}°N, ${cLon.toFixed(2)}°E<br><a href="https://www.protectedplanet.net/en/search-areas?geo_type=site&marine=true&lat=${cLat}&lng=${cLon}" target="_blank" style="font-size:11px">Search MPAs nearby →</a></div></div>`}}
  // WoRMS invasive attributes (P2.3)
  if(d.worms?.AphiaID){try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaAttributesByAphiaID/${d.worms.AphiaID}`,10000);
  if(r.ok){const attrs=await r.json();const invasive=attrs.filter(a=>(a.measurementType||'').toLowerCase().includes('invasive')||(a.measurementType||'').toLowerCase().includes('alien')||(a.measurementValue||'').toLowerCase().includes('invasive'));
  if(invasive.length)h+=`<div class="sp-card"><div class="lbl">Invasive Status</div><div class="val"><span class="bg" style="background:var(--cm);color:var(--co);border:1px solid rgba(194,120,120,.3)">Invasive/Alien</span><br><span style="font-size:11px;color:var(--tm)">${invasive.map(a=>`${a.measurementType}: ${a.measurementValue}`).join('<br>')}</span><br><a href="https://www.iucngisd.org/gisd/search.php?search_type=species&searchQuery=${encodeURIComponent(d.sciName)}" target="_blank" style="font-size:11px">GISD →</a></div></div>`}}catch{}}
  h+='</div>';el.innerHTML=h||'<div style="color:var(--tm);font-size:12px">No conservation data found.</div>'}
// ═══ P2.2 FISHERIES DATA (lazy) ═══
async function loadFisheries(){
  const el=$('#sp-fisheries');if(!el||el.dataset.loaded)return;el.dataset.loaded='1';
  const d=window._sp;if(!d)return;el.innerHTML='<div class="ld"><div class="ld-d" style="animation:pulse 1s infinite"></div><div class="ld-d" style="animation:pulse 1s .2s infinite"></div><div class="ld-d" style="animation:pulse 1s .4s infinite"></div></div>';
  let h='';
  // Sea Around Us
  try{const r=await fetchT(`https://api.seaaroundus.org/api/v1/taxa/search?q=${encodeURIComponent(d.sciName)}`,12000);
  if(r.ok){const sd=await r.json();if(sd.length){const taxon=sd[0];const tid=taxon.taxon_key;
  h+=`<div class="sp-card" style="grid-column:1/-1"><div class="lbl">Sea Around Us</div><div class="val"><b>${taxon.common_name||d.sciName}</b> (Key: ${tid})<br><a href="https://www.seaaroundus.org/data/#/taxa/${tid}" target="_blank" style="font-size:11px">View catch data →</a></div></div>`;
  // Try to get catch time-series
  try{const cr=await fetchT(`https://api.seaaroundus.org/api/v1/global/taxa/tonnage/?sciname=${encodeURIComponent(d.sciName)}`,12000);
  if(cr.ok){const cd=await cr.json();if(cd.data&&cd.data.length){window._spCatchData=cd.data;
  h+=`<div class="pcc" id="sp-catch-chart" style="height:250px;grid-column:1/-1"></div>`;
  h+=`<div style="grid-column:1/-1"><button class="bt sm" onclick="sendCatchToWS()">Catch Data → Workshop</button></div>`}}}catch{}}}}catch{}
  // RAM Legacy static index
  h+=`<div class="sp-card"><div class="lbl">RAM Legacy</div><div class="val"><a href="https://www.ramlegacy.org/" target="_blank" style="font-size:12px">Search RAM Legacy Stock DB →</a><br><span style="font-size:11px;color:var(--tm)">Global stock assessment database</span></div></div>`;
  el.innerHTML=h?`<div class="sp-info">${h}</div>`:'<div style="color:var(--tm);font-size:12px">No fisheries data found.</div>';
  // Render catch chart
  if(window._spCatchData&&$('#sp-catch-chart')){const cd=window._spCatchData;
  setTimeout(()=>{Plotly.newPlot('sp-catch-chart',[{x:cd.map(r=>r.year||r[0]),y:cd.map(r=>r.tonnage||r.value||r[1]),type:'scatter',mode:'lines',fill:'tozeroy',line:{color:'#C9956B',width:2},fillcolor:'rgba(201,149,107,.15)'}],{...PL,height:250,title:{text:'Global Catch: '+d.sciName,font:{size:12}},yaxis:{...PL.yaxis,title:{text:'Tonnes',font:{size:11}}}},{responsive:true})},100)}}
function sendCatchToWS(){if(!window._spCatchData)return;const cd=window._spCatchData;S.wsC=['Year','Catch_Tonnes'];S.wsD=cd.map(r=>({Year:r.year||r[0],Catch_Tonnes:r.tonnage||r.value||r[1]}));autoTypes();initWS();goTab('workshop')}
// ═══ P2.5 PALEOBIOLOGY (lazy) ═══
async function loadPaleobiology(){
  const el=$('#sp-paleo');if(!el||el.dataset.loaded)return;el.dataset.loaded='1';
  const d=window._sp;if(!d||!d.genus)return;el.innerHTML='<div class="ld"><div class="ld-d" style="animation:pulse 1s infinite"></div><div class="ld-d" style="animation:pulse 1s .2s infinite"></div><div class="ld-d" style="animation:pulse 1s .4s infinite"></div></div>';
  try{const r=await fetchT(`https://paleobiodb.org/data1.2/occs/list.json?base_name=${encodeURIComponent(d.genus)}&show=coords,loc,class&limit=200`,15000);
  if(!r.ok){el.innerHTML='<div style="color:var(--tm);font-size:12px">No fossil data available.</div>';return}
  const pd=await r.json();const recs=pd.records||[];
  if(!recs.length){el.innerHTML='<div style="color:var(--tm);font-size:12px">No fossil occurrences found for <i>'+d.genus+'</i>.</div>';return}
  const ages=recs.map(r=>r.eag).filter(Boolean);const lats=recs.filter(r=>r.lat).map(r=>r.lat);const lons=recs.filter(r=>r.lng).map(r=>r.lng);
  let h=`<div style="font-size:13px;color:var(--ts);margin-bottom:8px"><b>${recs.length}</b> fossil occurrences for <i>${d.genus}</i></div>`;
  if(ages.length>3)h+=`<div class="pcc" id="sp-paleo-hist" style="height:200px"></div>`;
  if(lats.length>3)h+=`<div class="pcc" id="sp-paleo-map" style="height:280px"></div>`;
  h+=`<div style="margin-top:6px"><a href="https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=&taxon_name=${encodeURIComponent(d.genus)}" target="_blank" style="font-size:11px">View on PBDB →</a></div>`;
  el.innerHTML=h;
  if($('#sp-paleo-hist')&&ages.length>3)setTimeout(()=>{Plotly.newPlot('sp-paleo-hist',[{x:ages,type:'histogram',marker:{color:'#9B8EC4'},nbinsx:20}],{...PL,height:200,title:{text:'Fossil Occurrences by Age (Ma)',font:{size:12}},xaxis:{...PL.xaxis,title:{text:'Million years ago',font:{size:11}},autorange:'reversed'}},{responsive:true})},100);
  if($('#sp-paleo-map')&&lats.length>3)setTimeout(()=>{if(typeof L==='undefined')return;const pm=L.map('sp-paleo-map',{center:[0,0],zoom:2,attributionControl:false,preferCanvas:true});L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,subdomains:'abcd'}).addTo(pm);const bounds=[];recs.filter(r=>r.lat).forEach(r=>{bounds.push([r.lat,r.lng]);L.circleMarker([r.lat,r.lng],{radius:5,fillColor:'#9B8EC4',color:'#9B8EC4',weight:1,opacity:.7,fillOpacity:.5}).bindPopup((r.tna||'')+' '+((r.eag||0).toFixed(1))+'Ma').addTo(pm)});if(bounds.length)pm.fitBounds(bounds,{padding:[20,20]})},150);
  }catch(e){el.innerHTML='<div style="color:var(--co);font-size:12px">Error loading fossil data: '+escHTML(e.message)+'</div>'}}
// ═══ P2.4 SEAMAP Megafauna Overlay ═══
async function loadSEAMAP(){
  const d=window._sp;if(!d)return;
  const megaClasses=['Mammalia','Reptilia','Aves'];const taxClass=d.worms?.class||d.gbifTax?.class||'';
  if(!megaClasses.some(c=>taxClass.toLowerCase()===c.toLowerCase()))return;
  try{const r=await fetchT(`https://seamap.env.duke.edu/api/v1/species/search?query=${encodeURIComponent(d.sciName)}`,10000);
  if(r.ok){const sd=await r.json();const results=sd.results||sd||[];
  if(results.length){const sp=results[0];const spId=sp.id||sp.species_id;
  toast('OBIS-SEAMAP: Loading tracking data for '+d.sciName,'info');
  if(spId){try{const dr=await fetchT(`https://seamap.env.duke.edu/api/v1/species/${spId}/observations?limit=500`,15000);
  if(dr.ok){const dd=await dr.json();const obs=dd.results||dd||[];
  if(obs.length){window._seamapObs=obs;
  const lats=obs.filter(o=>o.latitude).map(o=>o.latitude);const lons=obs.filter(o=>o.longitude).map(o=>o.longitude);
  if(window._spMap&&lats.length){try{const seamapGroup=L.layerGroup();obs.filter(o=>o.latitude).forEach(o=>{L.circleMarker([o.latitude,o.longitude],{radius:4,fillColor:'#D4A04A',color:'#D4A04A',weight:1,opacity:.8,fillOpacity:.6}).bindPopup('SEAMAP '+(o.date||'')).addTo(seamapGroup)});seamapGroup.addTo(window._spMap)}catch{}}
  toast('SEAMAP: '+obs.length+' observations loaded','ok')}}}catch{}}
  else toast('OBIS-SEAMAP: Found '+d.sciName+' but no observation endpoint','info')}}}catch{}}

// ═══ PHYLOGENY (Open Tree of Life) ═══
async function loadPhylogeny(){
  const el=$('#sp-phylogeny');if(!el)return;const d=window._sp;if(!d)return;
  H(el,'<div style="color:var(--tm);font-size:12px">Loading phylogeny...</div>');
  try{
    const r=await fetchT('https://api.opentreeoflife.org/v3/tnrs/match_names',12000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:[d.sciName]})});
    if(!r.ok)throw new Error('API error');const j=await r.json();
    const match=j.results?.[0]?.matches?.[0];if(!match||!match.taxon)throw new Error('No match');
    const ottId=match.taxon.ott_id;const taxName=match.taxon.unique_name||d.sciName;
    // Get lineage
    const lr=await fetchT('https://api.opentreeoflife.org/v3/taxonomy/taxon_info',10000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ott_id:ottId,include_lineage:true})});
    if(!lr.ok)throw new Error('Lineage error');const ld=await lr.json();
    const lineage=(ld.lineage||[]).slice(0,10).reverse();
    let html='<div style="font-size:12px"><strong>Taxonomic Lineage (Open Tree of Life)</strong>';
    html+='<div style="margin:8px 0;padding:8px;background:var(--s2);border-radius:6px;font-family:monospace;font-size:11px">';
    lineage.forEach((n,i)=>{html+='<div style="padding-left:'+i*16+'px;color:'+(i===lineage.length-1?'var(--ac)':'var(--tm)')+'">'+('│ '.repeat(i))+(i===lineage.length-1?'└─ ':'├─ ')+(n.unique_name||n.name||'?')+(n.rank?' <span style="opacity:.6">('+n.rank+')</span>':'')+'</div>'});
    html+='<div style="padding-left:'+lineage.length*16+'px;color:#7B9E87;font-weight:bold">└─ '+taxName+'</div>';
    html+='</div>';
    html+='<div style="margin-top:6px"><a href="https://tree.opentreeoflife.org/taxonomy/browse?id='+ottId+'" target="_blank" style="color:var(--ac);font-size:11px">View in Open Tree of Life →</a></div>';
    // Get nearby subtree
    try{const sr=await fetchT('https://api.opentreeoflife.org/v3/tree_of_life/subtree',10000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ott_id:ottId,height:2})});
      if(sr.ok){const sd=await sr.json();if(sd.newick){html+='<div style="margin-top:8px;padding:6px;background:var(--s2);border-radius:4px;font-size:10px;max-height:80px;overflow:auto;word-break:break-all"><strong>Newick:</strong> '+escHTML(sd.newick.substring(0,500))+(sd.newick.length>500?'...':'')+'</div>'}}}catch{}
    html+='</div>';
    H(el,html);
  }catch(e){H(el,'<p style="color:var(--co);font-size:12px">Phylogeny data not available for this taxon.</p>')}
}

// ═══ GENETIC RESOURCES (NCBI SRA + GenBank) ═══
async function loadGeneticResources(){
  const el=$('#sp-genetics');if(!el)return;const d=window._sp;if(!d)return;
  H(el,'<div style="color:var(--tm);font-size:12px">Loading genetic resources...</div>');
  try{
    const [sraR,nucR,protR]=await Promise.all([
      fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=sra&term=${encodeURIComponent(d.sciName)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null),
      fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nucleotide&term=${encodeURIComponent(d.sciName)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null),
      fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=protein&term=${encodeURIComponent(d.sciName)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    const sraCount=parseInt(sraR?.esearchresult?.count||'0');
    const nucCount=parseInt(nucR?.esearchresult?.count||'0');
    const protCount=parseInt(protR?.esearchresult?.count||'0');
    const enc=encodeURIComponent(d.sciName);
    let html='<div style="font-size:12px"><strong>NCBI Genetic Resources</strong>';
    html+='<div class="eg" style="margin:8px 0">';
    html+=`<div class="ec"><div class="el">SRA Experiments</div><div class="ev">${sraCount.toLocaleString()}</div></div>`;
    html+=`<div class="ec"><div class="el">Nucleotide Seq.</div><div class="ev">${nucCount.toLocaleString()}</div></div>`;
    html+=`<div class="ec"><div class="el">Protein Seq.</div><div class="ev">${protCount.toLocaleString()}</div></div>`;
    html+='</div>';
    html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">';
    if(sraCount>0)html+=`<a href="https://www.ncbi.nlm.nih.gov/sra/?term=${enc}[Organism]" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Browse SRA →</a>`;
    if(nucCount>0)html+=`<a href="https://www.ncbi.nlm.nih.gov/nuccore/?term=${enc}[Organism]" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Browse Nucleotide →</a>`;
    if(protCount>0)html+=`<a href="https://www.ncbi.nlm.nih.gov/protein/?term=${enc}[Organism]" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Browse Protein →</a>`;
    html+='</div>';
    // BOLD link
    html+=`<div style="margin-top:8px"><a href="https://www.boldsystems.org/index.php/Taxbrowser_Taxonpage?taxon=${enc}" target="_blank" style="color:var(--ac);font-size:11px">View on BOLD Systems →</a></div>`;
    html+='</div>';
    H(el,html);
  }catch{H(el,'<p style="color:var(--co);font-size:12px">Genetic resource data unavailable.</p>')}
}

// ═══ OCEAN TRACKING NETWORK (OTN) ═══
async function loadOTN(){
  const el=$('#sp-otn');if(!el)return;const d=window._sp;if(!d)return;
  H(el,'<div style="color:var(--tm);font-size:12px">Searching OTN/ATN...</div>');
  try{
    // Query ERDDAP for OTN tagged animal detections
    const name=encodeURIComponent(d.sciName);
    const [otnR,atnR]=await Promise.all([
      fetchT(`https://members.oceantrack.org/erddap/tabledap/otn_animals.json?commonname,scientificname,latitude,longitude,yearcollected,catalognumber&scientificname=%22${name}%22&orderBy(%22yearcollected%22)&.draw=markers`,10000).then(r=>r.ok?r.json():null).catch(()=>null),
      fetchT(`https://coastwatch.pfeg.noaa.gov/erddap/tabledap/animaltags.json?commonName,scientificName,latitude,longitude,time&scientificName=%22${name}%22&orderBy(%22time%22)`,10000).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    let detections=[];
    if(otnR?.table?.rows?.length){const cols=otnR.table.columnNames;const latI=cols.indexOf('latitude'),lonI=cols.indexOf('longitude'),yrI=cols.indexOf('yearcollected');
      otnR.table.rows.forEach(r=>{if(r[latI]&&r[lonI])detections.push({lat:r[latI],lon:r[lonI],year:r[yrI]||'',src:'OTN'})})}
    if(atnR?.table?.rows?.length){const cols=atnR.table.columnNames;const latI=cols.indexOf('latitude'),lonI=cols.indexOf('longitude'),tI=cols.indexOf('time');
      atnR.table.rows.forEach(r=>{if(r[latI]&&r[lonI])detections.push({lat:r[latI],lon:r[lonI],year:r[tI]?r[tI].substring(0,4):'',src:'ATN'})})}
    if(!detections.length){
      H(el,`<div style="font-size:12px"><p style="color:var(--tm)">No telemetry detections found for ${escHTML(d.sciName)}.</p>
      <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://members.oceantrack.org/data/discovery/${encodeURIComponent(d.sciName)}" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Search OTN →</a>
      <a href="https://oceanview.pfeg.noaa.gov/ATN/" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Browse ATN →</a>
      <a href="https://www.movebank.org/cms/webapp?a=taxon&taxon=${encodeURIComponent(d.sciName)}" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">Movebank →</a></div></div>`);
      return}
    // Summary stats
    const otnCount=detections.filter(d=>d.src==='OTN').length;
    const atnCount=detections.filter(d=>d.src==='ATN').length;
    const years=detections.filter(d=>d.year).map(d=>d.year).sort();
    const lats=detections.map(d=>d.lat).filter(Boolean);
    const lons=detections.map(d=>d.lon).filter(Boolean);
    const latSpan=lats.length?Math.abs(Math.max(...lats)-Math.min(...lats)):0;
    const lonSpan=lons.length?Math.abs(Math.max(...lons)-Math.min(...lons)):0;
    const spanKm=Math.round(Math.sqrt(latSpan*latSpan+lonSpan*lonSpan)*111);

    let html=`<div style="font-size:12px"><strong>Animal Tracking & Telemetry</strong>`;
    html+=`<div class="eg" style="margin:8px 0">
    <div class="ec"><div class="el">Total detections</div><div class="ev">${detections.length.toLocaleString()}</div></div>
    <div class="ec"><div class="el">OTN</div><div class="ev" style="color:#7B9E87">${otnCount}</div></div>
    <div class="ec"><div class="el">ATN</div><div class="ev" style="color:#9B8EC4">${atnCount}</div></div>
    <div class="ec"><div class="el">Year range</div><div class="ev">${years[0]||'?'} – ${years[years.length-1]||'?'}</div></div>
    <div class="ec"><div class="el">Spatial extent</div><div class="ev">~${spanKm} km</div></div></div>`;

    // Leaflet tracking map
    html+=`<div id="sp-track-map" style="height:300px;margin-bottom:10px;border-radius:var(--rd);border:1px solid var(--bd)"></div>`;

    // Timeline chart
    html+=`<div id="sp-track-timeline" style="height:220px;margin-bottom:8px"></div>`;

    html+=`<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
    <a href="https://members.oceantrack.org/data/discovery/${encodeURIComponent(d.sciName)}" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">OTN Data &rarr;</a>
    <a href="https://oceanview.pfeg.noaa.gov/ATN/" target="_blank" class="bt sm" style="font-size:11px;text-decoration:none">ATN Portal &rarr;</a></div></div>`;
    H(el,html);

    // Initialize Leaflet tracking map
    setTimeout(()=>{
      const mapEl=$('#sp-track-map');
      if(mapEl&&typeof L!=='undefined'){
        const trackMap=L.map(mapEl,{zoomControl:true}).setView([lats.reduce((a,b)=>a+b,0)/lats.length||0,lons.reduce((a,b)=>a+b,0)/lons.length||0],4);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,attribution:'CartoDB'}).addTo(trackMap);
        const srcColors={OTN:'#7B9E87',ATN:'#9B8EC4',SEAMAP:'#D4A04A'};
        const bounds=[];
        detections.forEach(det=>{
          if(!det.lat||!det.lon)return;
          bounds.push([det.lat,det.lon]);
          L.circleMarker([det.lat,det.lon],{radius:4,fillColor:srcColors[det.src]||'#C9956B',color:srcColors[det.src]||'#C9956B',weight:1,opacity:0.7,fillOpacity:0.6}).bindPopup(`${det.src} ${det.year}`).addTo(trackMap);
        });
        if(bounds.length)trackMap.fitBounds(bounds,{padding:[30,30]});
      }

      // Plotly timeline
      const tlEl=$('#sp-track-timeline');
      if(tlEl&&typeof Plotly!=='undefined'){
        // Group by year and source
        const byYear={};
        detections.forEach(det=>{
          const yr=det.year||'Unknown';
          if(!byYear[yr])byYear[yr]={OTN:0,ATN:0};
          if(det.src==='OTN')byYear[yr].OTN++;
          else byYear[yr].ATN++;
        });
        const sortedYears=Object.keys(byYear).sort();
        Plotly.newPlot(tlEl,[
          {x:sortedYears,y:sortedYears.map(y=>byYear[y].OTN),type:'bar',name:'OTN',marker:{color:'#7B9E87'}},
          {x:sortedYears,y:sortedYears.map(y=>byYear[y].ATN),type:'bar',name:'ATN',marker:{color:'#9B8EC4'}}
        ],{...PL,height:220,barmode:'stack',title:{text:'Detections by Year',font:{size:12}},
          xaxis:{...PL.xaxis,title:'Year'},yaxis:{...PL.yaxis,title:'Detections'}},{responsive:true});
      }
    },100);
  }catch{H(el,'<p style="color:var(--co);font-size:12px">Telemetry data unavailable.</p>')}
}

// ═══ DARWIN CORE EXPORT ═══
function dlDarwinCore(){
  const d=window._sp;if(!d)return toast('No species data loaded','err');
  const allOcc=[...d.gbifOcc.map(o=>({basisOfRecord:o.basisOfRecord||'HumanObservation',occurrenceID:o.key||'',scientificName:d.sciName,kingdom:d.worms?.kingdom||d.gbifTax?.kingdom||'',phylum:d.worms?.phylum||d.gbifTax?.phylum||'',class:d.worms?.class||d.gbifTax?.class||'',order:d.worms?.order||d.gbifTax?.order||'',family:d.worms?.family||d.gbifTax?.family||'',genus:d.worms?.genus||d.gbifTax?.genus||'',specificEpithet:d.sciName.split(' ')[1]||'',decimalLatitude:o.decimalLatitude||'',decimalLongitude:o.decimalLongitude||'',coordinateUncertaintyInMeters:o.coordinateUncertaintyInMeters||'',eventDate:o.eventDate||'',year:o.year||'',month:o.month||'',day:o.day||'',depth:o.depth||'',country:o.country||'',datasetName:'GBIF',catalogNumber:o.catalogNumber||'',institutionCode:o.institutionCode||''})),...d.obisOcc.map(o=>({basisOfRecord:'HumanObservation',occurrenceID:o.id||'',scientificName:d.sciName,kingdom:d.worms?.kingdom||'',phylum:d.worms?.phylum||'',class:d.worms?.class||'',order:d.worms?.order||'',family:d.worms?.family||'',genus:d.worms?.genus||'',specificEpithet:d.sciName.split(' ')[1]||'',decimalLatitude:o.decimalLatitude||'',decimalLongitude:o.decimalLongitude||'',coordinateUncertaintyInMeters:'',eventDate:o.eventDate||'',year:o.date_year||'',month:'',day:'',depth:o.depth||'',country:o.country||'',datasetName:'OBIS',catalogNumber:'',institutionCode:o.institutionCode||''}))];
  if(!allOcc.length)return toast('No occurrence records to export','err');
  const cols=Object.keys(allOcc[0]);
  const csv=[cols.join(','),...allOcc.map(r=>cols.map(c=>{const v=String(r[c]||'');return v.includes(',')?'"'+v.replace(/"/g,'""')+'"':v}).join(','))].join('\n');
  dl(csv,d.sciName.replace(/ /g,'_')+'_DarwinCore.csv','text/csv');
  toast('Darwin Core CSV exported ('+allOcc.length+' records)','ok');
}

// ═══ GEOJSON EXPORT ═══
function dlGeoJSON(){
  const d=window._sp;if(!d)return toast('No species data loaded','err');
  const features=[...d.gbifOcc.filter(o=>o.decimalLatitude&&o.decimalLongitude).map(o=>({type:'Feature',geometry:{type:'Point',coordinates:[o.decimalLongitude,o.decimalLatitude]},properties:{source:'GBIF',species:d.sciName,year:o.year||null,depth:o.depth||null,country:o.country||null,basisOfRecord:o.basisOfRecord||null}})),...d.obisOcc.filter(o=>o.decimalLatitude&&o.decimalLongitude).map(o=>({type:'Feature',geometry:{type:'Point',coordinates:[o.decimalLongitude,o.decimalLatitude]},properties:{source:'OBIS',species:d.sciName,year:o.date_year||null,depth:o.depth||null,country:o.country||null}}))];
  if(!features.length)return toast('No georeferenced records to export','err');
  const geojson={type:'FeatureCollection',features};
  dl(JSON.stringify(geojson,null,2),d.sciName.replace(/ /g,'_')+'.geojson','application/geo+json');
  toast('GeoJSON exported ('+features.length+' features)','ok');
}

// ═══ P4.2 CROSS-MODULE: Species → Env Data ═══
function fetchEnvAtCentroid(){
  const d=window._sp;if(!d)return;
  const allLat=[...d.gbifOcc.filter(o=>o.decimalLatitude).map(o=>o.decimalLatitude),...d.obisOcc.filter(o=>o.decimalLatitude).map(o=>o.decimalLatitude)];
  const allLon=[...d.gbifOcc.filter(o=>o.decimalLongitude).map(o=>o.decimalLongitude),...d.obisOcc.filter(o=>o.decimalLongitude).map(o=>o.decimalLongitude)];
  if(!allLat.length)return toast('No occurrence coordinates available','err');
  const cLat=((Math.min(...allLat)+Math.max(...allLat))/2).toFixed(4);const cLon=((Math.min(...allLon)+Math.max(...allLon))/2).toFixed(4);
  goTab('envdata');setTimeout(()=>{$('#elat').value=cLat;$('#elon').value=cLon;if(typeof updateEnvLocCtx==='function')updateEnvLocCtx();toast('Coordinates set to occurrence centroid: '+cLat+'°N, '+cLon+'°E','ok')},200)}
// ═══ COMPARATIVE SPECIES VIEW ═══
let _compareSpecies=[];
async function openSpeciesCompare(){
  const names=prompt('Enter 2-3 species names separated by commas:');if(!names)return;
  _compareSpecies=names.split(',').map(n=>n.trim()).filter(Boolean).slice(0,3);
  if(_compareSpecies.length<2)return toast('Need at least 2 species','err');
  toast('Fetching data for '+_compareSpecies.length+' species...','info');
  const results=[];
  for(const name of _compareSpecies){
    let data={name,sciName:name,gbifOcc:[],obisOcc:[],fb:{},worms:null,gbifTax:null,depths:[],years:[]};
    try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(name)}&marine_only=false`,10000);
      if(r.ok){const d=await r.json();if(d?.[0]?.length){data.worms=d[0][0];data.sciName=d[0][0].scientificname||name}}}catch{}
    try{const r=await fetchT(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(data.sciName)}&verbose=true`,8000);
      if(r.ok){data.gbifTax=await r.json()}}catch{}
    try{const r=await fetchT(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(data.sciName)}&limit=300&hasCoordinate=true`,10000);
      if(r.ok){const d=await r.json();data.gbifOcc=d.results||[]}}catch{}
    try{const r=await fetchT(`https://api.obis.org/v3/occurrence?scientificname=${encodeURIComponent(data.sciName)}&size=300`,10000);
      if(r.ok){const d=await r.json();data.obisOcc=d.results||[]}}catch{}
    if(data.worms?.genus){try{const r=await fetchT(`${FB_PROXY}/species?Genus=${encodeURIComponent(data.worms.genus)}&Species=${encodeURIComponent(data.worms.species||'')}&limit=3`,8000);
      if(r.ok){const d=await r.json();data.fb=(d.data||[])[0]||{}}}catch{}}
    data.depths=[...data.gbifOcc.filter(o=>o.depth!=null).map(o=>o.depth),...data.obisOcc.filter(o=>o.depth!=null).map(o=>o.depth)];
    data.years=[...data.gbifOcc.filter(o=>o.year).map(o=>o.year),...data.obisOcc.filter(o=>o.date_year).map(o=>o.date_year)];
    results.push(data);await new Promise(r=>setTimeout(r,200))}
  renderSpeciesComparison(results)}
function renderSpeciesComparison(results){
  const colors=['#C9956B','#7B9E87','#9B8EC4'];
  let h=`<div class="sec"><div class="sh"><h4>Species Comparison (${results.length})</h4></div><div class="sb">`;
  // Side-by-side panels
  h+=`<div style="display:grid;grid-template-columns:repeat(${results.length},1fr);gap:12px;margin-bottom:14px">${results.map((d,i)=>`<div style="background:var(--be);border:1px solid var(--bd);border-radius:6px;padding:12px"><h4 style="color:${colors[i]};font-style:italic;font-size:14px;margin-bottom:8px">${escHTML(d.sciName)}</h4>
  <div style="font-size:11px;font-family:var(--mf);color:var(--ts);line-height:1.8">${d.worms?`<div>Family: ${d.worms.family||'—'}</div><div>Order: ${d.worms.order||'—'}</div>`:d.gbifTax?`<div>Family: ${d.gbifTax.family||'—'}</div>`:''}<div>GBIF: ${d.gbifOcc.length} occ</div><div>OBIS: ${d.obisOcc.length} occ</div>${d.depths.length?`<div>Depth: ${Math.min(...d.depths).toFixed(0)}–${Math.max(...d.depths).toFixed(0)}m</div>`:''}${d.fb?.Length?`<div>Max Length: ${d.fb.Length}cm</div>`:''}${d.fb?.Vulnerability?`<div>Vulnerability: ${d.fb.Vulnerability}/100</div>`:''}</div></div>`).join('')}</div>`;
  // Side-by-side Leaflet maps
  h+=`<div style="display:grid;grid-template-columns:repeat(${results.length},1fr);gap:12px;margin-bottom:14px">${results.map((d,i)=>`<div id="compareMap-${i}" style="height:280px;border-radius:8px;border:1px solid var(--bd);overflow:hidden"></div>`).join('')}</div>`;
  // Depth comparison
  if(results.some(d=>d.depths.length>3))h+=`<div class="pcc" id="compareDepth" style="height:250px"></div>`;
  // Temporal comparison
  if(results.some(d=>d.years.length>3))h+=`<div class="pcc" id="compareYears" style="height:250px"></div>`;
  h+=`<button class="bt sm" onclick="sendCompareToWS()" style="margin-top:8px">Send All → Workshop</button></div></div>`;
  H('#sres',h);
  window._compareResults=results;
  setTimeout(()=>{
    // Leaflet maps per species
    if(typeof L!=='undefined'){results.forEach((d,i)=>{const mapEl=document.getElementById('compareMap-'+i);if(!mapEl)return;
      const cMap=L.map(mapEl,{center:[0,0],zoom:1,zoomControl:false,attributionControl:false,preferCanvas:true});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,subdomains:'abcd'}).addTo(cMap);
      const key=d.gbifTax?.usageKey;if(key)L.tileLayer(`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${key}&style=scaled.circles&srs=EPSG:3857`,{opacity:0.8}).addTo(cMap);
      const oL=d.obisOcc.filter(o=>o.decimalLatitude);if(oL.length){const oC=clusterOcc(oL.map(o=>({lat:o.decimalLatitude,lon:o.decimalLongitude})));
        oC.forEach(c=>{L.circleMarker([c.lat,c.lon],{radius:Math.min(10,3+Math.sqrt(c.n)),fillColor:'#7B9E87',color:'#7B9E87',weight:1,opacity:.7,fillOpacity:.5}).addTo(cMap)})}
      const allPts=[...d.gbifOcc.filter(o=>o.decimalLatitude).map(o=>[o.decimalLatitude,o.decimalLongitude]),...oL.map(o=>[o.decimalLatitude,o.decimalLongitude])];
      if(allPts.length)cMap.fitBounds(allPts,{padding:[15,15],maxZoom:6});
      // Species label
      const lbl=L.control({position:'topleft'});lbl.onAdd=function(){const el=L.DomUtil.create('div');el.style.cssText='background:rgba(39,37,54,.85);padding:4px 8px;border-radius:4px;font-size:12px;font-style:italic;color:'+colors[i];el.textContent=d.sciName;return el};lbl.addTo(cMap)})}
    // Depth
    if($('#compareDepth')){Plotly.newPlot('compareDepth',results.filter(d=>d.depths.length>3).map((d,i)=>({y:d.depths,type:'box',name:d.sciName,marker:{color:colors[i]},boxmean:'sd'})),{...PL,height:250,title:{text:'Depth Range Comparison',font:{size:12}},yaxis:{...PL.yaxis,title:'Depth (m)',autorange:'reversed'}},{responsive:true})}
    if($('#compareYears')){Plotly.newPlot('compareYears',results.filter(d=>d.years.length>3).map((d,i)=>({x:d.years,type:'histogram',name:d.sciName,marker:{color:colors[i]},opacity:.7})),{...PL,height:250,title:{text:'Temporal Coverage',font:{size:12}},barmode:'overlay'},{responsive:true})}
  },100)}
function sendCompareToWS(){if(!window._compareResults)return;S.wsC=['Species','Source','Lat','Lon','Depth','Year'];S.wsD=[];
  window._compareResults.forEach(d=>{d.gbifOcc.forEach(o=>S.wsD.push({Species:d.sciName,Source:'GBIF',Lat:o.decimalLatitude,Lon:o.decimalLongitude,Depth:o.depth,Year:o.year}));
    d.obisOcc.forEach(o=>S.wsD.push({Species:d.sciName,Source:'OBIS',Lat:o.decimalLatitude,Lon:o.decimalLongitude,Depth:o.depth,Year:o.date_year}))});
  autoTypes();initWS();goTab('workshop')}

// ═══ ENV DATA — verified datasets + timeouts ═══
const EV=[
{id:'sst',nm:'SST',u:'°C',cat:'Physical',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon',v:'sst',dm:4,z:'(0)',lon360:true,lag:14,minDate:'1981-09-01',alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplMURSST41',v:'analysed_sst',dm:3,lag:2,minDate:'2002-06-01'}},
{id:'sst_anom',nm:'SST Anomaly',u:'°C',cat:'Physical',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon',v:'anom',dm:4,z:'(0)',lon360:true,lag:14,minDate:'1981-09-01',alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplMURSST41anom',v:'sstAnom',dm:3,lag:2,minDate:'2002-06-01'}},
{id:'chlor',nm:'Chlorophyll-a',u:'mg/m³',cat:'Biogeochem',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018chla1day',v:'chla',dm:3,lag:2,minDate:'2012-01-01',alt:{server:'https://coastwatch.noaa.gov/erddap',ds:'noaacwNPPVIIRSchlaDaily',v:'chlor_a',dm:4,z:'(0.0)',lag:3,minDate:'2017-01-01'}},
{id:'par',nm:'Kd490',u:'m⁻¹',cat:'Biogeochem',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018k4901day',v:'k490',dm:3,lag:2,minDate:'2012-01-01',alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018k4908day',v:'k490',dm:3,minDate:'2003-01-01'}},
{id:'co2',nm:'CO₂',u:'ppm',cat:'Biogeochem',src:'co2'},
{id:'wh',nm:'Wave Height',u:'m',cat:'Waves',src:'m',p:'wave_height',pd:'wave_height_max'},
{id:'wd',nm:'Wave Dir',u:'°',cat:'Waves',src:'m',p:'wave_direction',pd:'wave_direction_dominant'},
{id:'wp',nm:'Wave Period',u:'s',cat:'Waves',src:'m',p:'wave_period',pd:'wave_period_max'},
{id:'sh',nm:'Swell Height',u:'m',cat:'Waves',src:'m',p:'swell_wave_height',pd:'swell_wave_height_max'},
{id:'at',nm:'Air Temp',u:'°C',cat:'Atmos',src:'w',p:'temperature_2m',pd:'temperature_2m_mean'},
{id:'ws',nm:'Wind Speed',u:'m/s',cat:'Atmos',src:'w',p:'wind_speed_10m',pd:'wind_speed_10m_max'},
{id:'wdir',nm:'Wind Dir',u:'°',cat:'Atmos',src:'w',p:'wind_direction_10m',pd:'wind_direction_10m_dominant'},
{id:'pr',nm:'Pressure',u:'hPa',cat:'Atmos',src:'w',p:'pressure_msl',pd:'pressure_msl_mean'},
{id:'pp',nm:'Precip',u:'mm',cat:'Atmos',src:'w',p:'precipitation',pd:'precipitation_sum'},
{id:'cl',nm:'Cloud',u:'%',cat:'Atmos',src:'w',p:'cloud_cover',pd:'cloud_cover_mean'},
{id:'sr',nm:'Solar',u:'W/m²',cat:'Atmos',src:'w',p:'shortwave_radiation',pd:'shortwave_radiation_sum'},
{id:'hm',nm:'Humidity',u:'%',cat:'Atmos',src:'w',p:'relative_humidity_2m',pd:'relative_humidity_2m_mean'},
{id:'sal',nm:'Salinity',u:'PSU',cat:'Physical',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'coastwatchSMOSv662SSS3day',v:'sss',dm:4,z:'(0.0)',minDate:'2010-06-01',lag:3,alt:{server:'https://coastwatch.noaa.gov/erddap',ds:'noaacwSMAPsssDaily',v:'sss',dm:4,z:'(0.0)',minDate:'2015-04-01'}},
{id:'npp',nm:'Net Primary Productivity',u:'mgC/m²/day',cat:'Biogeochem',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1pp8day',v:'productivity',dm:4,z:'(0.0)',minDate:'2003-01-01',lag:8,alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1pp8day',v:'productivity',dm:4,z:'(0.0)',minDate:'2003-01-01',lag:8}},
{id:'curr_u',nm:'Current (U)',u:'m/s',cat:'Physical',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'ugos',dm:3,minDate:'2017-02-13',lag:14,alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplOscar',v:'u',dm:4,z:'(15.0)',lon360:true,minDate:'1992-10-06',lag:30}},
{id:'curr_v',nm:'Current (V)',u:'m/s',cat:'Physical',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'vgos',dm:3,minDate:'2017-02-13',lag:14,alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplOscar',v:'v',dm:4,z:'(15.0)',lon360:true,minDate:'1992-10-06',lag:30}},
{id:'sla',nm:'Sea Level Anomaly',u:'m',cat:'Physical',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'sla',dm:3,minDate:'2017-02-13',lag:14},
{id:'dhw',nm:'Degree Heating Weeks',u:'°C-weeks',cat:'Coral',src:'e',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_DHW',dm:3,minDate:'1985-04-01',lag:5},
{id:'baa',nm:'Bleaching Alert Area',u:'level',cat:'Coral',src:'e',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_BAA',dm:3,minDate:'1985-04-01',lag:5},
{id:'hotspot',nm:'Coral Hotspot',u:'°C',cat:'Coral',src:'e',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_HOTSPOT',dm:3,minDate:'1985-04-01',lag:5},
{id:'seaice',nm:'Sea Ice',u:'fraction',cat:'Cryosphere',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISSTIce',v:'sic',dm:3,minDate:'1870-01-16',lag:45},
{id:'depth',nm:'Depth',u:'m',cat:'Physical',src:'bath'},
{id:'slope',nm:'Slope Angle',u:'°',cat:'Physical',src:'bath'},
{id:'co2_keeling',nm:'Atmos CO\u2082 (Keeling)',u:'ppm',cat:'Carbon',src:'co2_keeling'},
{id:'pco2',nm:'Surface pCO\u2082',u:'\u00b5atm',cat:'Carbon',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'noaa_psl_5b56_2d90_a498',v:'fco2_ave_weighted',dm:3,minDate:'1970-01-01',lag:365,alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'noaa_psl_5b56_2d90_a498',v:'fco2_ave_weighted',dm:3}},
{id:'omega_ar',nm:'\u03a9arag (estimated)',u:'',cat:'Carbon',src:'calc'},
// ── New: Physical Oceanography ──
{id:'mld',nm:'Mixed Layer Depth',u:'m',cat:'Physical',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'Hycom_sfc_3d',v:'mixed_layer_thickness',dm:4,z:'(0)',lon360:true,minDate:'1994-01-01',lag:14,alt:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISST',v:'sst',dm:3,lag:45,minDate:'1870-01-16'}},
// ── New: Biogeochemistry ──
{id:'poc',nm:'Particulate Organic Carbon',u:'mg/m³',cat:'Biogeochem',src:'e',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1poc8day',v:'poc',dm:4,z:'(0.0)',minDate:'2003-01-01',lag:8},
{id:'dox',nm:'Dissolved Oxygen',u:'mL/L',cat:'Biogeochem',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'noaacwWOA18o_t00an01',v:'o_an',dm:4,z:'(0.0)',lag:365,minDate:'1955-01-01'},
{id:'no3',nm:'Nitrate',u:'\u00b5mol/kg',cat:'Biogeochem',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'noaacwWOA18n_t00an01',v:'n_an',dm:4,z:'(0.0)',lag:365,minDate:'1955-01-01'},
{id:'po4',nm:'Phosphate',u:'\u00b5mol/kg',cat:'Biogeochem',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'noaacwWOA18p_t00an01',v:'p_an',dm:4,z:'(0.0)',lag:365,minDate:'1955-01-01'},
{id:'sio4',nm:'Silicate',u:'\u00b5mol/kg',cat:'Biogeochem',src:'e',server:'https://www.ncei.noaa.gov/erddap',ds:'noaacwWOA18i_t00an01',v:'i_an',dm:4,z:'(0.0)',lag:365,minDate:'1955-01-01'},
{id:'ph_est',nm:'pH (estimated)',u:'',cat:'Biogeochem',src:'calc'},
// ── New: Climate & Atmospheric ──
{id:'uv',nm:'UV Index',u:'',cat:'Climate',src:'w',p:'uv_index',pd:'uv_index_max'},
{id:'oni',nm:'ENSO ONI',u:'\u00b0C',cat:'Climate',src:'oni'},
{id:'nao',nm:'NAO Index',u:'',cat:'Climate',src:'nao'},
{id:'mhw',nm:'Marine Heatwave',u:'\u00b0C above 90th pct',cat:'Climate',src:'mhw'},
];
// ── Multi-Source Fusion Registry ──
let _fusionMode=false;
const _fusionSources={
  sst:[
    {id:'oisst',nm:'OISST v2.1 (NCEI)',server:'https://www.ncei.noaa.gov/erddap',ds:'ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon',v:'sst',dm:4,z:'(0)',lon360:true,lag:14,minDate:'1981-09-01',res:'25 km'},
    {id:'mur',nm:'MUR SST v4.1 (JPL)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplMURSST41',v:'analysed_sst',dm:3,lag:2,minDate:'2002-06-01',res:'1 km'},
    {id:'crw_sst',nm:'CRW CoralTemp (PIFSC)',server:'https://oceanwatch.pifsc.noaa.gov/erddap',ds:'CRW_sst_v3_1',v:'analysed_sst',dm:3,lag:3,minDate:'1985-01-01',res:'5 km'},
    {id:'pathfinder',nm:'Pathfinder v5.3 Night (PolarWatch)',server:'https://polarwatch.noaa.gov/erddap',ds:'erdPH53sstn8day',v:'sst',dm:3,lag:14,minDate:'1981-08-25',res:'4 km'},
    {id:'hadisst',nm:'HadISST (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISST',v:'sst',dm:3,lag:45,minDate:'1870-01-16',res:'1°'}],
  sst_anom:[
    {id:'oisst_anom',nm:'OISST Anomaly (NCEI)',server:'https://www.ncei.noaa.gov/erddap',ds:'ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon',v:'anom',dm:4,z:'(0)',lon360:true,lag:14,minDate:'1981-09-01',res:'25 km'},
    {id:'mur_anom',nm:'MUR SST Anomaly (JPL)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplMURSST41anom',v:'sstAnom',dm:3,lag:2,minDate:'2002-06-01',res:'1 km'},
    {id:'crw_anom',nm:'CRW SST Anomaly (PIFSC)',server:'https://oceanwatch.pifsc.noaa.gov/erddap',ds:'CRW_sst_anom_v1_0',v:'sst_anomaly',dm:3,lag:3,minDate:'1985-01-01',res:'5 km'}],
  chlor:[
    {id:'viirs_vh',nm:'VIIRS VH 2018 Chl-a (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018chla1day',v:'chla',dm:3,lag:2,minDate:'2012-01-01',res:'4 km'},
    {id:'viirs_cw',nm:'VIIRS SNPP NRT (CoastWatch)',server:'https://coastwatch.noaa.gov/erddap',ds:'noaacwNPPVIIRSchlaDaily',v:'chlor_a',dm:4,z:'(0.0)',lag:3,minDate:'2017-01-01',res:'4 km'},
    {id:'viirs_nrt',nm:'VIIRS SNPP NRT Prod (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'productivity_viirs_snpp_nrt_daily',v:'chlor_a',dm:3,lag:2,minDate:'2017-11-01',res:'4 km'},
    {id:'modis_chla',nm:'MODIS Aqua Chl-a (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1chla1day',v:'chlorophyll',dm:4,z:'(0.0)',minDate:'2003-01-01',lag:8,res:'4 km'}],
  par:[
    {id:'viirs_kd_vh',nm:'VIIRS VH 2018 Kd490 (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018k4901day',v:'k490',dm:3,lag:2,minDate:'2012-01-01',res:'4 km'},
    {id:'viirs_kd_8d',nm:'VIIRS VH 2018 Kd490 8-day (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdVH2018k4908day',v:'k490',dm:3,lag:8,minDate:'2012-01-01',res:'4 km'},
    {id:'viirs_kd_wk',nm:'VIIRS SQ Kd490 Weekly (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisVHNSQkd490Weekly',v:'kd_490',dm:3,lag:8,minDate:'2012-01-01',res:'4 km'},
    {id:'modis_kd_r22',nm:'MODIS Kd490 R2022 8-day (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1kd4908day_R2022SQ',v:'k490',dm:3,minDate:'2003-01-01',res:'4 km'}],
  sal:[
    {id:'smos',nm:'SMOS SSS 3-day (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'coastwatchSMOSv662SSS3day',v:'sss',dm:4,z:'(0.0)',lag:3,minDate:'2010-06-01',res:'25 km'},
    {id:'smap',nm:'SMAP SSS (CoastWatch)',server:'https://coastwatch.noaa.gov/erddap',ds:'noaacwSMAPsssDaily',v:'sss',dm:4,z:'(0.0)',minDate:'2015-04-01',res:'40 km'}],
  curr_u:[
    {id:'nesdis_u',nm:'NESDIS SSH ugos (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'ugos',dm:3,minDate:'2017-02-13',lag:14,res:'25 km'},
    {id:'oscar_u',nm:'OSCAR Currents U (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplOscar',v:'u',dm:4,z:'(15.0)',lon360:true,minDate:'1992-10-06',lag:30,res:'0.33°'},
    {id:'hycom_u',nm:'HYCOM Global U (NCEI)',server:'https://www.ncei.noaa.gov/erddap',ds:'Hycom_sfc_3d',v:'water_u',dm:4,z:'(0)',lon360:true,minDate:'1994-01-01',lag:14,res:'0.08°'}],
  curr_v:[
    {id:'nesdis_v',nm:'NESDIS SSH vgos (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'vgos',dm:3,minDate:'2017-02-13',lag:14,res:'25 km'},
    {id:'oscar_v',nm:'OSCAR Currents V (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'jplOscar',v:'v',dm:4,z:'(15.0)',lon360:true,minDate:'1992-10-06',lag:30,res:'0.33°'},
    {id:'hycom_v',nm:'HYCOM Global V (NCEI)',server:'https://www.ncei.noaa.gov/erddap',ds:'Hycom_sfc_3d',v:'water_v',dm:4,z:'(0)',lon360:true,minDate:'1994-01-01',lag:14,res:'0.08°'}],
  sla:[
    {id:'nesdis_sla',nm:'NESDIS SSH SLA (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'nesdisSSH1day',v:'sla',dm:3,minDate:'2017-02-13',lag:14,res:'25 km'}],
  npp:[
    {id:'modis_pp8',nm:'MODIS Aqua PP 8-day (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdMH1pp8day',v:'productivity',dm:4,z:'(0.0)',minDate:'2003-01-01',lag:8,res:'4 km'},
    {id:'viirs_nrt_npp',nm:'VIIRS SNPP NRT Prod (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'productivity_viirs_snpp_nrt_daily',v:'productivity',dm:3,lag:2,minDate:'2017-11-01',res:'4 km'}],
  dhw:[
    {id:'crw_dhw',nm:'CRW DHW (PaciOOS)',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_DHW',dm:3,minDate:'1985-04-01',lag:5,res:'5 km'}],
  baa:[
    {id:'crw_baa',nm:'CRW BAA (PaciOOS)',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_BAA',dm:3,minDate:'1985-04-01',lag:5,res:'5 km'}],
  hotspot:[
    {id:'crw_hotspot',nm:'CRW Hotspot (PaciOOS)',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_HOTSPOT',dm:3,minDate:'1985-04-01',lag:5,res:'5 km'}],
  seaice:[
    {id:'hadisst_ice',nm:'HadISST Ice (PFEG)',server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISSTIce',v:'sic',dm:3,lag:45,minDate:'1870-01-16',res:'1°'},
    {id:'crw_seaice',nm:'CRW Sea Ice (PaciOOS)',server:'https://pae-paha.pacioos.hawaii.edu/erddap',ds:'dhw_5km',v:'CRW_SEAICE',dm:3,minDate:'1985-04-01',lag:5,res:'5 km'}]
};
// ── Cascade Fetch — tries all known sources for a variable until data is found ──
async function _cascadeErddap(v,mode,df,dt,lat,lon,_stride,isHist,triedDS){
  const sources=_fusionSources[v.id];
  if(!sources)return null;
  let merged=null;const usedSources=[];
  for(const src of sources){
    if(triedDS.has(src.ds))continue;
    triedDS.add(src.ds);
    if(isServerDown(src.server))continue;
    if(_envAbort?.signal.aborted)return null;
    try{
      const srcV={...v,...src,lon360:src.lon360??false};
      let tQ;
      if(mode==='latest'){tQ='[(last)]'}
      else{const cr=clampRange(df,dt,srcV);if(!cr)continue;tQ=`[(${cr.start}T00:00:00Z):${_stride}:(${cr.end}T00:00:00Z)]`}
      const url=buildErddapUrl(srcV,tQ,lat,lon);
      const r=await erddapFetch(url,isHist?45000:20000);
      if(!r.ok)continue;
      const d=await r.json();
      const rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
      if(!rows.length)continue;
      console.info(`ENV cascade ${v.id}: got ${rows.length} rows from ${src.nm} (${src.ds})`);
      // Latest mode: return immediately on first success
      if(mode==='latest')return{rows,src,srcCount:1};
      // Timeseries mode: collect partial data and merge across sources
      usedSources.push(src);
      const byTime={};
      rows.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
      const ts=Object.keys(byTime).sort().map(t=>({time:t,value:byTime[t].reduce((s,x)=>s+x,0)/byTime[t].length}));
      if(!merged)merged=ts;
      else merged=mergeTimeSeries(merged,ts);
    }catch(e){
      if(e.name==='AbortError')return null;
      console.warn(`ENV cascade ${v.id}: ${src.ds} failed:`,e.message);
      continue}
  }
  if(!merged||!merged.length)return null;
  return{synthesized:true,ts:merged,srcCount:usedSources.length,
    srcNames:usedSources.map(s=>s.nm).join(' + '),src:usedSources[0]};
}
// ═══ Aragonite Saturation Estimation (Jiang et al. 2015 / simplified) ═══
function estimateAragoniteSaturation(sst,sal){
  sal=sal||35;
  // Empirical polynomial fit from Jiang et al. 2015 for surface open ocean
  // Omega_arag = f(SST, SSS) — simplified from full carbonate chemistry
  // Coefficients calibrated to global surface ocean data
  const omega=(-0.0081*sst*sst+0.3673*sst-0.4304)*(sal/35);
  const clamped=Math.max(0,Math.round(omega*100)/100);
  let interpretation,thresholdColor;
  if(clamped<1){interpretation='Undersaturated (corrosive to aragonite shells)';thresholdColor='var(--co)'}
  else if(clamped<1.5){interpretation='Marginal';thresholdColor='var(--wa)'}
  else{interpretation='Supersaturated (favourable)';thresholdColor='var(--sg)'}
  return{omega_ar:clamped,interpretation,thresholdColor,note:'Empirical estimate from SST'+(sal!==35?' & SSS':'')+'. For accurate values, use measured DIC/TA data from GLODAP or CO2SYS.'}
}

const EC=[...new Set(EV.map(v=>v.cat))];
// ── Grouped variable selector with collapsible sections ──
const EV_GROUPS=[
  {name:'Physical Oceanography',ids:['sst','sst_anom','sal','sla','mld','curr_u','curr_v','wh','wd','wp','sh','ws','wdir','par','depth','slope']},
  {name:'Biogeochemical',ids:['chlor','npp','poc','dox','no3','po4','sio4','ph_est','co2','co2_keeling','pco2','omega_ar','sr']},
  {name:'Climate & Atmospheric',ids:['at','pr','pp','cl','hm','uv','oni','nao','mhw']},
  {name:'Coral & Ecological',ids:['dhw','baa','hotspot','seaice']}
];
const EV_INFO={
  sst:{full:'Sea Surface Temperature',source:'NOAA OISST v2.1 / MUR SST',res:'25 km / 1 km',cov:'1981\u2013present'},
  sst_anom:{full:'SST Anomaly (departure from climatology)',source:'NOAA OISST / MUR',res:'25 km',cov:'1981\u2013present'},
  chlor:{full:'Chlorophyll-a concentration',source:'VIIRS / MODIS Aqua satellite',res:'4 km',cov:'2003\u2013present'},
  par:{full:'Diffuse attenuation at 490nm (water clarity/turbidity)',source:'VIIRS satellite',res:'4 km',cov:'2012\u2013present'},
  co2:{full:'Global atmospheric CO\u2082 (Mauna Loa)',source:'NOAA GML / Scripps',res:'daily',cov:'1958\u2013present'},
  wh:{full:'Significant wave height',source:'Open-Meteo Marine',res:'~5 km',cov:'90 days'},
  wd:{full:'Mean wave direction',source:'Open-Meteo Marine',res:'~5 km',cov:'90 days'},
  wp:{full:'Peak wave period',source:'Open-Meteo Marine',res:'~5 km',cov:'90 days'},
  sh:{full:'Swell wave height',source:'Open-Meteo Marine',res:'~5 km',cov:'90 days'},
  at:{full:'Air temperature at 2m above ground',source:'Open-Meteo Archive/Forecast',res:'~11 km',cov:'1940\u2013present'},
  ws:{full:'Wind speed at 10m',source:'Open-Meteo Archive/Forecast',res:'~11 km',cov:'1940\u2013present'},
  wdir:{full:'Wind direction at 10m',source:'Open-Meteo Archive/Forecast',res:'~11 km',cov:'1940\u2013present'},
  pr:{full:'Mean sea level pressure',source:'Open-Meteo Archive',res:'~11 km',cov:'1940\u2013present'},
  pp:{full:'Total precipitation',source:'Open-Meteo Archive',res:'~11 km',cov:'1940\u2013present'},
  cl:{full:'Cloud cover',source:'Open-Meteo Archive',res:'~11 km',cov:'1940\u2013present'},
  sr:{full:'Shortwave radiation (proxy for PAR)',source:'Open-Meteo Archive',res:'~11 km',cov:'1940\u2013present'},
  hm:{full:'Relative humidity at 2m',source:'Open-Meteo Archive',res:'~11 km',cov:'1940\u2013present'},
  sal:{full:'Sea surface salinity',source:'SMOS / SMAP satellite',res:'25\u201340 km',cov:'2010\u2013present'},
  npp:{full:'Net Primary Productivity (VGPM model)',source:'MODIS Aqua / VIIRS',res:'4 km',cov:'2003\u2013present'},
  curr_u:{full:'Eastward ocean surface current velocity',source:'NESDIS SSH / OSCAR',res:'25 km / 0.33\u00b0',cov:'1992\u2013present'},
  curr_v:{full:'Northward ocean surface current velocity',source:'NESDIS SSH / OSCAR',res:'25 km / 0.33\u00b0',cov:'1992\u2013present'},
  sla:{full:'Sea level anomaly from altimetry',source:'NESDIS SSH',res:'25 km',cov:'2017\u2013present'},
  dhw:{full:'Degree Heating Weeks \u2014 thermal stress accumulated over 12 weeks',source:'NOAA Coral Reef Watch',res:'5 km',cov:'1985\u2013present'},
  baa:{full:'Bleaching Alert Area level (0\u20134)',source:'NOAA Coral Reef Watch',res:'5 km',cov:'1985\u2013present'},
  hotspot:{full:'Coral bleaching hotspot (\u00b0C above MMM)',source:'NOAA Coral Reef Watch',res:'5 km',cov:'1985\u2013present'},
  seaice:{full:'Sea ice concentration fraction',source:'HadISST / CRW',res:'1\u00b0 / 5 km',cov:'1870\u2013present'},
  depth:{full:'Bottom depth at coordinates',source:'GMRT / GEBCO via ERDDAP',res:'~100 m',cov:'static'},
  slope:{full:'Seafloor slope angle',source:'Derived from bathymetry',res:'~100 m',cov:'static'},
  co2_keeling:{full:'Atmospheric CO\u2082 (Keeling Curve, Scripps)',source:'Scripps CO2 Program',res:'daily',cov:'1958\u2013present'},
  pco2:{full:'Surface ocean partial pressure of CO\u2082',source:'SOCAT / NOAA PSL',res:'1\u00b0',cov:'1970\u2013present'},
  omega_ar:{full:'Aragonite saturation state (estimated from SST + salinity)',source:'Empirical (Jiang et al. 2015)',res:'computed',cov:'requires SST'},
  mld:{full:'Mixed layer depth from ocean reanalysis',source:'HYCOM global reanalysis',res:'0.08\u00b0',cov:'1994\u2013present'},
  poc:{full:'Particulate Organic Carbon from ocean colour',source:'MODIS Aqua satellite',res:'4 km',cov:'2003\u2013present'},
  dox:{full:'Dissolved oxygen concentration (WOA climatology)',source:'World Ocean Atlas 2018',res:'1\u00b0',cov:'climatology (1955\u20132017)'},
  no3:{full:'Nitrate concentration (WOA climatology)',source:'World Ocean Atlas 2018',res:'1\u00b0',cov:'climatology (1955\u20132017)'},
  po4:{full:'Phosphate concentration (WOA climatology)',source:'World Ocean Atlas 2018',res:'1\u00b0',cov:'climatology (1955\u20132017)'},
  sio4:{full:'Silicate concentration (WOA climatology)',source:'World Ocean Atlas 2018',res:'1\u00b0',cov:'climatology (1955\u20132017)'},
  ph_est:{full:'Ocean pH (estimated from SST + salinity)',source:'Empirical estimation',res:'computed',cov:'requires SST'},
  uv:{full:'UV index (solar ultraviolet radiation)',source:'Open-Meteo Archive/Forecast',res:'~11 km',cov:'1940\u2013present'},
  oni:{full:'ENSO Oceanic Ni\u00f1o Index \u2014 3-month running mean SST anomaly in Ni\u00f1o 3.4 region',source:'NOAA CPC',res:'global index',cov:'1950\u2013present'},
  nao:{full:'North Atlantic Oscillation index \u2014 pressure difference between Azores and Iceland',source:'NOAA CPC',res:'global index',cov:'1950\u2013present'},
  mhw:{full:'Marine heatwave flag \u2014 SST exceeding local 90th percentile (Hobday et al. 2016)',source:'Computed from fetched SST',res:'computed',cov:'requires SST time series'}
};
let _evGroupState={};
function renderEV(){
  // Use EV_GROUPS for ordered, collapsible display
  const html=EV_GROUPS.map(g=>{
    const vars=g.ids.map(id=>EV.find(v=>v.id===id)).filter(Boolean);
    if(!vars.length)return'';
    const open=_evGroupState[g.name]!==false;
    const selCount=vars.filter(v=>S.envSel.has(v.id)).length;
    return`<div class="ev-group" style="margin-bottom:10px;border:1px solid var(--bd);border-radius:6px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--be);cursor:pointer;user-select:none" onclick="_evGroupState['${g.name}']=!_evGroupState['${g.name}'];renderEV()">
        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--tm)">${open?'\u25BE':'\u25B8'}</span><span style="font-size:11px;color:var(--ac);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px">${g.name}</span>${selCount?`<span style="font-size:9px;color:var(--sg);font-family:var(--mf)">${selCount}/${vars.length}</span>`:''}</div>
        <div style="display:flex;gap:4px" onclick="event.stopPropagation()"><button class="bt sm" style="font-size:9px;padding:1px 6px" onclick="event.stopPropagation();_evSelGroup('${g.name}',true)">All</button><button class="bt sm" style="font-size:9px;padding:1px 6px" onclick="event.stopPropagation();_evSelGroup('${g.name}',false)">None</button></div>
      </div>
      ${open?`<div style="padding:6px 10px;display:flex;flex-wrap:wrap;gap:4px">${vars.map(v=>{
        const info=EV_INFO[v.id];
        const tip=info?`${info.full}\nSource: ${info.source}\nResolution: ${info.res}\nCoverage: ${info.cov}\nUnits: ${v.u||'dimensionless'}`:'';
        const tag=v.src==='bath'?' <span style="font-size:8px;opacity:.45">static</span>':v.src==='calc'||v.src==='mhw'?' <span style="font-size:8px;opacity:.45">computed</span>':v.src==='oni'||v.src==='nao'?' <span style="font-size:8px;opacity:.45">index</span>':'';
        return`<span class="vc ${S.envSel.has(v.id)?'sel':''}" data-id="${v.id}" onclick="tEV('${v.id}',this)" title="${escHTML(tip)}">${v.nm}${tag}${info?' <span style="font-size:9px;opacity:.4;cursor:help" title="'+escHTML(tip)+'">i</span>':''}</span>`}).join('')}</div>`:''}</div>`}).join('');
  // Append any vars not in groups (safety net)
  const grouped=new Set(EV_GROUPS.flatMap(g=>g.ids));
  const ungrouped=EV.filter(v=>!grouped.has(v.id));
  const extra=ungrouped.length?`<div style="margin-top:6px"><div style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;margin-bottom:3px">Other</div>${ungrouped.map(v=>`<span class="vc ${S.envSel.has(v.id)?'sel':''}" data-id="${v.id}" onclick="tEV('${v.id}',this)">${v.nm}</span>`).join('')}</div>`:'';
  H('#evars',html+extra);
}
function tEV(id,el){S.envSel.has(id)?S.envSel.delete(id):S.envSel.add(id);el.classList.toggle('sel');_updateQueryMeter()}
function _evSelGroup(name,selectAll){
  const g=EV_GROUPS.find(x=>x.name===name);if(!g)return;
  g.ids.forEach(id=>{if(selectAll)S.envSel.add(id);else S.envSel.delete(id)});
  renderEV();_updateQueryMeter();
}
$('#esa').addEventListener('click',()=>{EV.forEach(v=>S.envSel.add(v.id));renderEV();_updateQueryMeter()});$('#eca').addEventListener('click',()=>{S.envSel.clear();renderEV();_updateQueryMeter()});renderEV();
// ═══ QUERY WEIGHT METER — warns before heavy fetches ═══
function _updateQueryMeter(){
  const n=S.envSel.size;const dfV=$('#edf')?.value,dtV=$('#edt')?.value,mode=$('#emode')?.value;
  const meter=$('#qmeter'),fill=$('#qm-fill'),txt=$('#qm-txt');
  if(!meter||!n){if(meter)meter.style.display='none';return}
  const erddapN=[...S.envSel].filter(id=>{const v=EV.find(x=>x.id===id);return v&&v.src==='e'}).length;
  const bathN=[...S.envSel].filter(id=>{const v=EV.find(x=>x.id===id);return v&&v.src==='bath'}).length;
  let days=1;
  if(mode==='timeseries'&&dfV&&dtV)days=Math.max(1,Math.round((new Date(dtV)-new Date(dfV))/86400000));
  // Weight: ERDDAP vars are heavy, API vars light, bath has zero network cost
  const activeN=n-bathN;
  const weight=erddapN*Math.min(days,26000)/730+(activeN-erddapN)*0.5;
  // Thresholds: 0-15 light, 15-40 moderate, 40-80 heavy, 80+ extreme
  let pct=Math.min(100,weight/80*100);
  let color,label;
  if(weight<15){color='var(--sg)';label=n+' vars · '+days.toLocaleString()+'d — light query'}
  else if(weight<40){color='var(--wa)';label=n+' vars · '+days.toLocaleString()+'d — moderate load'}
  else if(weight<80){color='var(--co)';label=n+' vars · '+days.toLocaleString()+'d — heavy load, may be slow'}
  else{color='#e05555';label=n+' vars · '+days.toLocaleString()+'d — very heavy! Consider fewer vars or shorter range'}
  meter.style.display='flex';fill.style.width=pct+'%';fill.style.background=color;txt.innerHTML=label;
  // Update fetch button style as visual cue
  const fb=$('#efb');if(fb){fb.style.borderColor=weight>=80?'#e05555':weight>=40?'var(--co)':'';fb.style.color=weight>=80?'#e05555':''}}
$('#edf')?.addEventListener('change',_updateQueryMeter);$('#edt')?.addEventListener('change',_updateQueryMeter);$('#emode')?.addEventListener('change',_updateQueryMeter);
// ═══ ENV GROUP TOGGLE ═══
function toggleEnvGroup(g){const b=$('#env-'+g+'-body'),a=$('#env-'+g+'-arrow');if(!b)return;const show=b.style.display==='none';b.style.display=show?'':'none';if(a)a.textContent=show?'▾':'▸';if(g==='map'&&show&&_envMap)setTimeout(()=>_envMap.invalidateSize(),50)}
function openEnvGroup(g){const b=$('#env-'+g+'-body'),a=$('#env-'+g+'-arrow');if(!b||b.style.display!=='none')return;b.style.display='';if(a)a.textContent='▾'}
function updateEnvLocCtx(){const lat=$('#elat')?.value,lon=$('#elon')?.value,ctx=$('#env-loc-ctx');if(ctx)ctx.textContent=lat&&lon?'· '+parseFloat(lat).toFixed(2)+'°N, '+parseFloat(lon).toFixed(2)+'°E':''}
function updateEnvVarsCtx(){const n=S.envSel.size,ctx=$('#env-vars-ctx');if(ctx)ctx.textContent=n?'· '+n+' selected':''}
$('#emode').addEventListener('change',function(){$('#edts').style.display=this.value==='latest'?'none':'';$('#edepth-ctrl').style.display=this.value==='depthprofile'?'':'none'});
function setDateRange(days){const t=new Date(),f=new Date(t);f.setDate(f.getDate()-days);const fmt=d=>d.toISOString().split('T')[0];$('#edf').value=fmt(f);$('#edt').value=fmt(t);_updateQueryMeter()}
function setCustomRange(from){$('#edf').value=from;$('#edt').value=new Date().toISOString().split('T')[0];_updateQueryMeter()}
// ── Date clamping (global — used by envFetch + retryEnvVar) ──
let _clampNotes=[];
function clampRange(s,e,v){
  let cs=s,ce=e,clamped=false;
  if(v.minDate&&cs<v.minDate){cs=v.minDate;clamped=true}
  if(v.maxDate&&ce>v.maxDate){ce=v.maxDate;clamped=true}
  if(v.lag>0){const lagD=new Date(Date.now()-v.lag*86400000).toISOString().split('T')[0];if(ce>lagD){ce=lagD;clamped=true}}
  if(cs>ce)return null;
  if(clamped)_clampNotes.push(v.nm+' → '+cs+' to '+ce);
  return{start:cs,end:ce}}
async function envFetch(){try{
if(_envAbort)_envAbort.abort();
_envAbort=new AbortController();
const lat=$('#elat').value,lon=$('#elon').value,mode=$('#emode').value,df=$('#edf').value,dt=$('#edt').value;
_errPipeline.crumb('action','Env fetch: '+[...S.envSel].join(',')+' @ '+lat+','+lon+' ('+mode+')');
if(!lat||!lon||isNaN(+lat)||isNaN(+lon))return toast('Set coordinates first — click the map or enter lat/lon','err');
const sel=[...S.envSel];if(!sel.length)return toast('Select at least one variable (SST, Chlorophyll, etc.)','err');
// Heavy query gate — warn before extreme fetches
const _erddapCount=sel.filter(id=>{const v=EV.find(x=>x.id===id);return v&&v.src==='e'}).length;
const _qDays=mode==='timeseries'&&df&&dt?Math.max(1,Math.round((new Date(dt)-new Date(df))/86400000)):1;
const _qWeight=_erddapCount*Math.min(_qDays,26000)/730+(sel.length-_erddapCount)*0.5;
if(_qWeight>=80&&!confirm('Heavy query: '+sel.length+' variables × '+_qDays.toLocaleString()+' days.\n\nThis may be slow or cause the browser to lag. Charts will lazy-render as you scroll.\n\nProceed?'))return;
if(mode==='depthprofile')return fetchDepthProfiles(lat,lon,sel,df||new Date().toISOString().split('T')[0]);
if(mode==='timeseries'&&df&&dt&&df>dt)return toast('Start date must be before end date','err');
const isHist=df&&(new Date()-new Date(df))/(86400000)>90;
// ── Stride: reduce server-side data volume for long historical ranges ──
const _daySpan=mode!=='latest'&&df&&dt?Math.max(1,Math.round((new Date(dt)-new Date(df))/86400000)):1;
const _stride=Math.max(1,Math.ceil(_daySpan/730));
if(_stride>1)console.info(`ENV stride=${_stride} for ${_daySpan}-day range (≈${Math.ceil(_daySpan/_stride)} pts/var)`);
// ── Reset module-scope concurrency limiter for this fetch batch ──
_concActive=0;_concQueue.length=0;
if(_envBounds){window._areaQuery=_envBounds;toast('Fetching area average','info')}else{window._areaQuery=null}
// Purge old Plotly charts
$$('#echarts .pcc').forEach(el=>{try{Plotly.purge(el)}catch{}});
H('#esum','');H('#echarts','');H('#esyn','');hi('#eact');
openEnvGroup('vars');updateEnvVarsCtx();
const _fetchStart=Date.now();
H('#eprog',`<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div class="fpb"><div class="fpbb" id="epb" style="width:0%"></div></div></div><button class="bt sm" onclick="cancelEnvFetch()" style="color:var(--co);border-color:rgba(194,120,120,.3)">Cancel</button></div><div style="font-size:12px;color:var(--tm);font-family:var(--mf)" id="est">0/${sel.length}</div>`);sh('#eprog');
S.envR={};S.envTS={};let dn=0;
// Cache DOM refs for progress updater — avoid repeated querySelector in hot path
const _pbEl=$('#epb'),_esEl=$('#est');
const up=(varName)=>{dn++;const elapsed=((Date.now()-_fetchStart)/1000).toFixed(1);if(_pbEl)_pbEl.style.width=dn/sel.length*100+'%';if(_esEl)_esEl.textContent=(varName||'')+' ('+dn+'/'+sel.length+') · '+elapsed+'s'};
function _envErrReason(msg){if(!msg)return'Unknown error';const m=msg.toLowerCase();
  if(m.includes('abort'))return'Request cancelled';
  if(m.includes('timeout')||m.includes('timed out'))return'Request timed out — server may be slow';
  if(m.includes('http 404')||m.includes('not found'))return'Dataset not found on server';
  if(m.includes('http 400')||m.includes('bad request'))return'Invalid query — check coordinates or date range';
  if(m.includes('http 5'))return'Server error — try again later';
  if(m.includes('http'))return'Server returned '+msg;
  if(m.includes('unreachable'))return'Server temporarily unreachable — alt source used if available';
  if(m.includes('failed to fetch')||m.includes('networkerror')||m.includes('network'))return'Network error — check connection';
  if(m.includes('no ocean data')||m.includes('no data at this'))return'No ocean data — location may be on land';
  if(m.includes('empty')||m.includes('no data'))return'No data available at this location/time';
  if(m.includes('all null'))return'Server returned empty values — try a different date';
  if(m.includes('filtered out'))return'All values removed by active filters';
  if(m.includes('inside polygon'))return'No grid points fall inside the polygon — try a larger area';
  if(m.includes('covers')&&m.includes('only'))return msg;
  return msg}
const _envErrors={};const _envGaps={};
const mc=(id,c,note)=>{$$(`[data-id="${id}"]`).forEach(e=>{e.classList.remove('sel','ok','err','gap');e.classList.add(c==='err'?'gap':c);if(c==='ok'&&!e.dataset.orig)e.dataset.orig=e.textContent;const base=(e.dataset.orig||e.textContent.replace(/[✓✗◌]/g,'').replace(/retry|gap/gi,'').trim());if(c==='ok'){e.innerHTML=escHTML(base)+' ✓';delete _envErrors[id];delete _envGaps[id]}
  if(c==='err'){const reason=_envErrReason(note);_envErrors[id]=reason;const vDef=EV.find(x=>x.id===id);
  const cov=vDef&&(vDef.minDate||vDef.maxDate)?' ('+((vDef.minDate||'?')+' – '+(vDef.maxDate||'now'))+')':'';
  _envGaps[id]={nm:vDef?.nm||id,reason,cov};
  e.innerHTML=escHTML(base)+' ◌ <span style="font-size:9px;color:var(--tm);font-weight:400;opacity:.7" title="'+escHTML(reason)+'">data gap</span>'+cov+' <button class="retry-btn" onclick="event.stopPropagation();retryEnvVar(\''+escHTML(id)+'\')" style="opacity:.6">retry</button>'}});if(note)console.info(`ENV ${id}: ${note}`)};
const eV=sel.map(id=>EV.find(v=>v.id===id)).filter(v=>v&&v.src==='e');
const mV=sel.map(id=>EV.find(v=>v.id===id)).filter(v=>v&&v.src==='m');
const wV=sel.map(id=>EV.find(v=>v.id===id)).filter(v=>v&&v.src==='w');
const bV=sel.map(id=>EV.find(v=>v.id===id)).filter(v=>v&&v.src==='bath');
const hC=sel.includes('co2');
// Pre-flight: probe all ERDDAP servers in parallel (3s max)
const _erddapServers=[...new Set(eV.map(v=>v.server).concat(eV.filter(v=>v.alt).map(v=>v.alt.server)))];
await Promise.allSettled(_erddapServers.map(s=>probeServer(s)));
// ── ERDDAP fetches (SST, Chlorophyll via new servers) ──
_clampNotes.length=0;
if(_polygonMode==='cut'&&_envPolygon)_clampNotes.push('Polygon cut: '+_envPolygon.length+' vertices clipped');
const ep=eV.map(async v=>{
  await _acquireSlot();
  try{
  // Promote alt to primary if server is dead
  let effV=v;let altPromoted=false;
  if(isServerDown(v.server)&&v.alt&&!isServerDown(v.alt.server)){
    effV={...v,...v.alt,lon360:v.alt.lon360??false};altPromoted=true;
    console.info(`ENV ${v.id}: ${v.server.split('//')[1]} down → using ${effV.server.split('//')[1]}/${effV.ds}`)}
  if(mode!=='latest'){
    const cr=clampRange(df,dt,effV);
    if(!cr){mc(v.id,'err',`${v.nm} covers ${effV.minDate||'?'} – ${effV.maxDate||'now'} only`);up(v.nm);return}}
  // Fire alt source fetch in parallel (non-blocking) — skip if alt was promoted or alt server is down
  const altP=(!altPromoted&&v.alt&&!isServerDown(v.alt.server))?(async()=>{
    try{if(_envAbort?.signal.aborted)return null;
      const altV={...v,...v.alt,lon360:v.alt.lon360??false};
      let tQ;
      if(mode==='latest'){tQ='[(last)]'}
      else{const cr=clampRange(df,dt,altV);if(!cr)return null;tQ=`[(${cr.start}T00:00:00Z):${_stride}:(${cr.end}T00:00:00Z)]`}
      const url=buildErddapUrl(altV,tQ,lat,lon);
      const r=await erddapFetch(url,isHist?45000:20000);
      if(!r.ok)return null;
      const d=await r.json();
      return(d.table?.rows||[]).filter(r=>r[r.length-1]!=null)||null;
    }catch{return null}
  })():Promise.resolve(null);
  async function tryDS(dsObj,dsId,timeQ){
    const cr=clampRange(df,dt,effV);
    const tQ=timeQ||(mode==='latest'?'[(last)]':`[(${cr.start}T00:00:00Z):${_stride}:(${cr.end}T00:00:00Z)]`);
    const url=buildErddapUrl({...dsObj,ds:dsId},tQ,lat,lon);
    const r=await erddapFetch(url,isHist?45000:20000);
    if(!r.ok)throw new Error(`${dsId} HTTP ${r.status}`);
    const d=await r.json();const rows=d.table?.rows||[];
    if(!rows.length)throw new Error(`${dsId} empty`);
    const filtered=rows.filter(r=>r[r.length-1]!=null);
    if(!filtered.length)throw new Error(`${dsId} all null`);
    return filtered}
  try{let rows;
    try{rows=await tryDS(effV,effV.ds)}catch(e1){
      if(!altPromoted&&v.dsFb){console.warn(`ERDDAP ${v.id} primary failed (${e1.message}), trying ${v.dsFb}`);
        try{rows=await tryDS(v,v.dsFb)}catch(e2){
          if(mode==='latest'){const d7=new Date();d7.setDate(d7.getDate()-7);
            const tQ7=`[(${d7.toISOString().split('T')[0]}T00:00:00Z):1:(${(v.lag>0?new Date(Date.now()-v.lag*86400000).toISOString().split('T')[0]:new Date().toISOString().split('T')[0])}T00:00:00Z)]`;
            try{rows=await tryDS(v,v.dsFb,tQ7)}catch{throw e2}}
          else throw e2}}
      else if(mode==='latest'){
        console.warn(`ERDDAP ${v.id} latest null, trying last 7 days:`,e1.message);
        const d7=new Date();d7.setDate(d7.getDate()-7);
        const tQ7=`[(${d7.toISOString().split('T')[0]}T00:00:00Z):1:(${(effV.lag>0?new Date(Date.now()-effV.lag*86400000).toISOString().split('T')[0]:new Date().toISOString().split('T')[0])}T00:00:00Z)]`;
        try{rows=await tryDS(effV,effV.ds,tQ7)}catch{
          const d30=new Date();d30.setDate(d30.getDate()-30);
          const tQ30=`[(${d30.toISOString().split('T')[0]}T00:00:00Z):1:(${(effV.lag>0?new Date(Date.now()-effV.lag*86400000).toISOString().split('T')[0]:new Date().toISOString().split('T')[0])}T00:00:00Z)]`;
          try{rows=await tryDS(effV,effV.ds,tQ30)}catch{throw e1}}}
      else if(mode!=='latest'){
        console.warn(`ERDDAP ${v.id} timeseries failed, trying [(last)]:`,e1.message);
        const lastUrl=buildErddapUrl(effV,'[(last)]',lat,lon);
        const lr=await erddapFetch(lastUrl,20000);
        if(lr.ok){const ld=await lr.json();rows=(ld.table?.rows||[]).filter(r=>r[r.length-1]!=null)}
        if(!rows?.length)throw e1}
      else throw e1}
    if(!rows?.length)throw new Error('No data');
    // Apply NOAA filters if active
    if(window._noaaFilters&&rows.length){
      const nf=window._noaaFilters;
      if((v.id==='sst'||v.id==='sst_anom')&&nf.sstMin!=null)rows=rows.filter(r=>{const val=r[r.length-1];return val>=nf.sstMin&&val<=nf.sstMax});
      if(v.id==='chlor'&&nf.chlorMin!=null)rows=rows.filter(r=>{const val=r[r.length-1];return val>=nf.chlorMin&&val<=nf.chlorMax});
      if(!rows.length)throw new Error('All data filtered out by NOAA filters')}
    // Filter by polygon if active
    if(_envPolygon&&_polygonMode!=='crop'&&window._areaQuery&&rows.length>1){
      const latIdx=effV.dm===4?2:effV.dm===3?1:0,lonIdx=latIdx+1;
      rows=rows.filter(r=>pointInPolygon(r[latIdx],r[lonIdx],_envPolygon));
      if(!rows.length)throw new Error('No data inside polygon')}
    // Await alt source — altP was launched at the start so no extra timeout needed
    let altRows=await altP;
    if(_envAbort?.signal.aborted)throw new DOMException('','AbortError');
    // Apply polygon PIP filter to alt rows too
    if(altRows?.length&&_envPolygon&&_polygonMode!=='crop'&&window._areaQuery){
      const altV={...v,...v.alt,lon360:v.alt?.lon360??false};
      const aLatIdx=altV.dm===4?2:altV.dm===3?1:0,aLonIdx=aLatIdx+1;
      altRows=altRows.filter(r=>pointInPolygon(r[aLatIdx],r[aLonIdx],_envPolygon));
      if(!altRows.length)altRows=null}
    const srcNote=altPromoted?'alt:'+effV.server.split('//')[1]?.split('.')[0]:undefined;
    if(mode==='latest'){const vals=rows.map(r=>r[r.length-1]);
      let value=vals.reduce((s,x)=>s+x,0)/vals.length;let srcCount=1;
      if(altRows?.length){const altVals=altRows.map(r=>r[r.length-1]);
        const altMean=altVals.reduce((s,x)=>s+x,0)/altVals.length;
        value=(value+altMean)/2;srcCount=2}
      S.envR[v.id]={nm:v.nm,value,u:v.u,srcCount,srcNote}}
    else{const byTime={};rows.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
      let ts=Object.keys(byTime).sort().map(t=>{const vs=byTime[t];return{time:t,value:vs.reduce((s,x)=>s+x,0)/vs.length}});
      let srcCount=1;
      if(altRows?.length){const altByTime={};
        altRows.forEach(r=>{const t=r[0];if(!altByTime[t])altByTime[t]=[];altByTime[t].push(r[r.length-1])});
        const altTS=Object.keys(altByTime).sort().map(t=>{const vs=altByTime[t];return{time:t,value:vs.reduce((s,x)=>s+x,0)/vs.length}});
        ts=mergeTimeSeries(ts,altTS);srcCount=2}
      S.envR[v.id]={nm:v.nm,value:ts[ts.length-1]?.value,u:v.u,srcCount,srcNote};
      if(ts.length>1){S.envTS[v.id]={nm:v.nm,u:v.u,data:ts};stampProvenance(v.id,{server:v.server,dataset:v.ds,variable:v.v,lat,lon,from:df,to:dt,source:'erddap'+(altPromoted?' (alt)':'')})}
      else mc(v.id,'ok','Single data point (latest only)')}
    mc(v.id,'ok',altPromoted?'(alt source)':undefined)}
  catch(e){if(e.name==='AbortError')return;
    // altP has been running in parallel — just await it, no extra timeout
    let altFb=null;
    try{altFb=await altP}catch{}
    if(altFb?.length){
      console.warn(`ERDDAP ${v.id} primary failed, using alt source`);
      const srcNote='alt:'+(v.alt?.server?.split('//')[1]?.split('.')[0]||'?');
      if(mode==='latest'){const vals=altFb.map(r=>r[r.length-1]);
        S.envR[v.id]={nm:v.nm,value:vals.reduce((s,x)=>s+x,0)/vals.length,u:v.u,srcCount:1,srcNote}}
      else{const byTime={};altFb.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
        const ts=Object.keys(byTime).sort().map(t=>{const vs=byTime[t];return{time:t,value:vs.reduce((s,x)=>s+x,0)/vs.length}});
        S.envR[v.id]={nm:v.nm,value:ts[ts.length-1]?.value,u:v.u,srcCount:1,srcNote};
        if(ts.length>1)S.envTS[v.id]={nm:v.nm,u:v.u,data:ts}}
      mc(v.id,'ok','(alt source)')}
    else{
      // ── CASCADE: try all known sources from fusion registry ──
      const triedDS=new Set([v.ds,v.alt?.ds,v.dsFb].filter(Boolean));
      const cascadeResult=await _cascadeErddap(v,mode,df,dt,lat,lon,_stride,isHist,triedDS);
      if(cascadeResult){
        if(cascadeResult.synthesized){
          // Multi-source synthesis: merged time series from multiple partial sources
          const srcNote='synthesized:'+cascadeResult.srcNames;
          S.envR[v.id]={nm:v.nm,value:cascadeResult.ts[cascadeResult.ts.length-1]?.value,u:v.u,srcCount:cascadeResult.srcCount,srcNote};
          if(cascadeResult.ts.length>1){S.envTS[v.id]={nm:v.nm,u:v.u,data:cascadeResult.ts};
            stampProvenance(v.id,{server:cascadeResult.src.server,dataset:cascadeResult.src.ds,variable:cascadeResult.src.v,lat,lon,from:df,to:dt,source:'erddap (synthesized: '+cascadeResult.srcNames+')'})}
          mc(v.id,'ok','(synthesized: '+cascadeResult.srcCount+' sources)')}
        else{
          // Single cascade source hit (latest mode)
          const{rows:cRows,src:cSrc}=cascadeResult;
          const vals=cRows.map(r=>r[r.length-1]);
          S.envR[v.id]={nm:v.nm,value:vals.reduce((s,x)=>s+x,0)/vals.length,u:v.u,srcCount:1,srcNote:'cascade:'+cSrc.nm};
          mc(v.id,'ok','(cascade: '+cSrc.nm+')')}}
      else{
        // ── GAP-FILL: spatial/temporal/climatology pipeline ──
        const gf=typeof _gapFillPipeline==='function'?await _gapFillPipeline(v,mode,df,dt,lat,lon,_stride,isHist):null;
        if(gf){
          S.envR[v.id]={nm:v.nm,value:gf.value,u:v.u,confidence:gf.confidence,srcNote:'gapfill:'+gf.detail};
          if(gf.ts?.length>1)S.envTS[v.id]={nm:v.nm,u:v.u,data:gf.ts};
          mc(v.id,'ok','(gap-fill: '+gf.confidence.label+')')}
        else{
          const nSrc=1+(v.alt?1:0)+(_fusionSources[v.id]?.length||0);
          console.error(`ERDDAP ${v.id} failed all ${nSrc} sources + gap-fill:`,e);
          mc(v.id,'err',e.message+' (tried '+nSrc+' sources + gap-fill)')}}}}up(v.nm)
  }finally{_releaseSlot()}});
// ── Open-Meteo Marine (waves) ──
const mp=mV.length?(async()=>{try{
  const marineMaxHist=new Date();marineMaxHist.setMonth(marineMaxHist.getMonth()-3);
  const mdf=df&&new Date(df)<marineMaxHist?marineMaxHist.toISOString().split('T')[0]:df;
  if(mdf!==df)_clampNotes.push('Wave data → '+mdf+' to '+dt);
  const useDaily=isHist;const ps=mV.map(v=>useDaily?(v.pd||v.p):v.p).join(',');
  const r=await envFetchT(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&${useDaily?'daily':'hourly'}=${ps}&${mode==='latest'?'forecast_days=1':`start_date=${mdf}&end_date=${dt}`}`,20000);
  if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();
  if(d.error)throw new Error(d.reason||'Marine API: no ocean data at this location');
  const timeKey=useDaily?'daily':'hourly';
  mV.forEach(v=>{const pk=useDaily?(v.pd||v.p):v.p;const vs=d[timeKey]?.[pk],ts=d[timeKey]?.time;
    if(vs&&ts){const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);
      if(vd.length){S.envR[v.id]={nm:v.nm,value:vd[vd.length-1]?.value,u:v.u};
        if(mode==='timeseries')S.envTS[v.id]={nm:v.nm,u:v.u,data:vd};stampProvenance(v.id,{server:'marine-api.open-meteo.com',dataset:'Open-Meteo Marine',variable:v.p,lat,lon,from:df,to:dt,source:'open-meteo-marine'});mc(v.id,'ok')}
      else mc(v.id,'err','All null values for '+v.nm)}else mc(v.id,'err','Parameter not available at this location');up(v.nm)})
}catch(e){if(e.name==='AbortError')return;console.error('Marine API error:',e);
  mV.forEach(v=>{mc(v.id,'err',e.message);up(v.nm)})}})():Promise.resolve();
// ── Open-Meteo Weather (atmos) ──
const wp=wV.length?(async()=>{try{
  const useDaily=isHist;const ps=wV.map(v=>useDaily?(v.pd||v.p):v.p).join(',');
  // Clamp end date: archive API doesn't serve future dates, forecast API doesn't serve far-past dates
  let wDf=df,wDt=dt;const today=new Date().toISOString().split('T')[0];
  if(isHist&&wDt>today)wDt=today;
  const base=isHist?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
  const r=await envFetchT(`${base}?latitude=${lat}&longitude=${lon}&${useDaily?'daily':'hourly'}=${ps}&${mode==='latest'?'forecast_days=1':`start_date=${wDf}&end_date=${wDt}`}`,isHist?45000:20000);
  if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();
  if(d.error)throw new Error(d.reason||'Weather API error');
  const timeKey=useDaily?'daily':'hourly';
  wV.forEach(v=>{const pk=useDaily?(v.pd||v.p):v.p;const vs=d[timeKey]?.[pk],ts=d[timeKey]?.time;
    if(vs&&ts){const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);
      if(vd.length){S.envR[v.id]={nm:v.nm,value:vd[vd.length-1]?.value,u:v.u};
        if(mode==='timeseries')S.envTS[v.id]={nm:v.nm,u:v.u,data:vd};stampProvenance(v.id,{server:isHist?'archive-api.open-meteo.com':'api.open-meteo.com',dataset:'Open-Meteo Weather',variable:v.p,lat,lon,from:df,to:dt,source:'open-meteo-weather'});mc(v.id,'ok')}
      else mc(v.id,'err','All null values for '+v.nm)}else mc(v.id,'err','Parameter not available at this location');up(v.nm)})
}catch(e){if(e.name==='AbortError')return;console.error('Weather API error:',e);
  wV.forEach(v=>{mc(v.id,'err',e.message);up(v.nm)})}})():Promise.resolve();
// ── CO2 (global — with fallback URL) ──
const _CO2_URLS=['https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv','https://scrippsco2.ucsd.edu/assets/data/atmospheric/stations/in_situ_co2/daily/daily_in_situ_co2_mlo.csv'];
const cp=hC?(async()=>{try{
  let t=null;
  for(const co2Url of _CO2_URLS){
    try{const r=await envFetchT(co2Url,15000);if(r.ok){t=await r.text();break}}catch{}}
  if(!t)throw new Error('All CO2 sources failed');
  const allData=t.trim().split('\n').filter(l=>!l.startsWith('#')&&l.includes(',')).slice(1)
    .map(l=>{const p=l.split(',');return{time:`${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`,value:parseFloat(p[p.length-1])||parseFloat(p[4])}}).filter(r=>r.value>0);
  const data=(df&&dt)?allData.filter(d=>d.time>=df&&d.time<=dt):allData;
  if(!data.length)throw new Error('No CO2 data in range');
  S.envR.co2={nm:'CO₂',value:data[data.length-1]?.value,u:'ppm'};
  if(mode==='timeseries')S.envTS.co2={nm:'CO₂',u:'ppm',data};mc('co2','ok')
}catch(e){if(e.name==='AbortError')return;console.error('CO2 error:',e);mc('co2','err',e.message)}up('CO\u2082')})():Promise.resolve();
// ── Keeling Curve CO2 (from Scripps — higher resolution) ──
const hKeeling=sel.includes('co2_keeling');
const kp=hKeeling?(async()=>{try{
  const kUrl='https://scrippsco2.ucsd.edu/assets/data/atmospheric/stations/in_situ_co2/daily/daily_in_situ_co2_mlo.csv';
  const r=await envFetchT(kUrl,15000);if(!r.ok)throw new Error('Scripps CO2 HTTP '+r.status);
  const t=await r.text();
  const allData=t.trim().split('\n').filter(l=>!l.startsWith('"')&&l.includes(',')).slice(1)
    .map(l=>{const p=l.split(',');const date=p[0]?.trim();const ppm=parseFloat(p[p.length-1]);return date&&ppm>0?{time:date,value:ppm}:null}).filter(Boolean);
  const data=(df&&dt)?allData.filter(d=>d.time>=df&&d.time<=dt):allData;
  if(!data.length)throw new Error('No Keeling data in range');
  S.envR.co2_keeling={nm:'Atmos CO\u2082 (Keeling)',value:data[data.length-1]?.value,u:'ppm'};
  if(mode==='timeseries')S.envTS.co2_keeling={nm:'Atmos CO\u2082 (Keeling)',u:'ppm',data};
  stampProvenance('co2_keeling',{server:'scrippsco2.ucsd.edu',dataset:'Scripps CO2 Program Mauna Loa',variable:'co2_ppm',lat:'19.5',lon:'-155.6',from:df,to:dt,source:'scripps-co2'});
  mc('co2_keeling','ok')
}catch(e){if(e.name==='AbortError')return;console.error('Keeling error:',e);mc('co2_keeling','err',e.message)}up('Keeling CO\u2082')})():Promise.resolve();
// ── Aragonite Saturation (computed from SST) ──
const hOmega=sel.includes('omega_ar');
const op=hOmega?(async()=>{try{
  // Wait for SST to be available
  await Promise.all(ep);
  const sst=S.envR.sst?.value;
  if(sst==null)throw new Error('SST required — fetch SST first');
  const sal=S.envR.sal?.value||35;
  const est=estimateAragoniteSaturation(sst,sal);
  S.envR.omega_ar={nm:'\u03a9arag (estimated)',value:est.omega_ar,u:'',interpretation:est.interpretation,note:'Empirical estimate from SST'+(sal!==35?' & salinity':'')};
  if(mode==='timeseries'&&S.envTS.sst){
    S.envTS.omega_ar={nm:'\u03a9arag (estimated)',u:'',data:S.envTS.sst.data.map(d=>({time:d.time,value:estimateAragoniteSaturation(d.value,sal).omega_ar}))};
  }
  mc('omega_ar','ok')
}catch(e){if(e.name==='AbortError')return;console.error('Omega_ar error:',e);mc('omega_ar','err',e.message)}up('\u03a9arag')})():Promise.resolve();
// ── pH Estimation (from SST + Salinity — Takahashi et al. empirical) ──
const hPh=sel.includes('ph_est');
const php=hPh?(async()=>{try{
  await Promise.all(ep);
  const sst=S.envR.sst?.value;
  if(sst==null)throw new Error('SST required \u2014 select SST to estimate pH');
  const salV=S.envR.sal?.value||35;
  // Empirical: pH decreases ~0.015 per °C increase, baseline 8.1 at 25°C, 35 PSU
  const phVal=Math.round((8.1-0.015*(sst-25)+0.004*(salV-35))*1000)/1000;
  S.envR.ph_est={nm:'pH (estimated)',value:phVal,u:'',note:'Empirical estimate from SST'+(salV!==35?' & salinity':'')};
  if(mode==='timeseries'&&S.envTS.sst){
    S.envTS.ph_est={nm:'pH (estimated)',u:'',data:S.envTS.sst.data.map(d=>{
      const sv=S.envTS.sal?.data?.find(x=>x.time===d.time)?.value||salV;
      return{time:d.time,value:Math.round((8.1-0.015*(d.value-25)+0.004*(sv-35))*1000)/1000}})}}
  mc('ph_est','ok')
}catch(e){if(e.name==='AbortError')return;mc('ph_est','err',e.message)}up('pH')})():Promise.resolve();
// ── ENSO ONI Index (NOAA CPC) ──
const hOni=sel.includes('oni');
const onip=hOni?(async()=>{try{
  const oniUrl='https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
  const r=await envFetchT(oniUrl,15000);
  if(!r.ok)throw new Error('ONI HTTP '+r.status);
  const t=await r.text();
  const lines=t.trim().split('\n').filter(l=>l.trim()&&!/^SEAS|^APTS/i.test(l.trim()));
  const seasonMap={DJF:'01',JFM:'02',FMA:'03',MAM:'04',AMJ:'05',MJJ:'06',JJA:'07',JAS:'08',ASO:'09',SON:'10',OND:'11',NDJ:'12'};
  const allData=[];
  for(const line of lines){
    const p=line.trim().split(/\s+/);if(p.length<4)continue;
    const seas=p[0],yr=p[1],anom=parseFloat(p[p.length-1]);
    if(isNaN(anom)||!seasonMap[seas])continue;
    allData.push({time:`${yr}-${seasonMap[seas]}-15`,value:anom})}
  const data=(df&&dt)?allData.filter(d=>d.time>=df&&d.time<=dt):allData;
  if(!data.length)throw new Error('No ONI data in range');
  S.envR.oni={nm:'ENSO ONI',value:data[data.length-1]?.value,u:'\u00b0C'};
  if(mode==='timeseries'){S.envTS.oni={nm:'ENSO ONI',u:'\u00b0C',data};
    stampProvenance('oni',{server:'cpc.ncep.noaa.gov',dataset:'ONI Index',variable:'oni_anom',lat:'global',lon:'Ni\u00f1o 3.4',from:df,to:dt,source:'noaa-cpc'})}
  mc('oni','ok')
}catch(e){if(e.name==='AbortError')return;mc('oni','err',e.message)}up('ONI')})():Promise.resolve();
// ── NAO Index (NOAA CPC) ──
const hNao=sel.includes('nao');
const naop=hNao?(async()=>{try{
  const naoUrl='https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.monthly.b5001.current.ascii.table';
  const r=await envFetchT(naoUrl,15000);
  if(!r.ok)throw new Error('NAO HTTP '+r.status);
  const t=await r.text();
  const lines=t.trim().split('\n').filter(l=>l.trim()&&!/^\s*$/.test(l));
  const allData=[];
  for(const line of lines){
    const p=line.trim().split(/\s+/);if(p.length<13)continue;
    const yr=p[0];if(isNaN(parseInt(yr)))continue;
    for(let m=1;m<=12;m++){const val=parseFloat(p[m]);
      if(!isNaN(val)&&val>-99){allData.push({time:`${yr}-${String(m).padStart(2,'0')}-15`,value:val})}}}
  const data=(df&&dt)?allData.filter(d=>d.time>=df&&d.time<=dt):allData;
  if(!data.length)throw new Error('No NAO data in range');
  S.envR.nao={nm:'NAO Index',value:data[data.length-1]?.value,u:''};
  if(mode==='timeseries'){S.envTS.nao={nm:'NAO Index',u:'',data};
    stampProvenance('nao',{server:'cpc.ncep.noaa.gov',dataset:'NAO Index',variable:'nao_monthly',lat:'global',lon:'Atlantic',from:df,to:dt,source:'noaa-cpc'})}
  mc('nao','ok')
}catch(e){if(e.name==='AbortError')return;mc('nao','err',e.message)}up('NAO')})():Promise.resolve();
// ── Marine Heatwave Detection (computed from SST time series) ──
const hMhw=sel.includes('mhw');
const mhwp=hMhw?(async()=>{try{
  await Promise.all(ep);
  if(!S.envTS.sst?.data?.length)throw new Error('SST time series required \u2014 select SST with a date range');
  const sstData=S.envTS.sst.data;
  // Calculate climatological 90th percentile by day-of-year (Hobday et al. 2016)
  const byDOY={};sstData.forEach(d=>{const doy=d.time.slice(5,10);if(!byDOY[doy])byDOY[doy]=[];byDOY[doy].push(d.value)});
  const pct90={};Object.keys(byDOY).forEach(doy=>{const vs=byDOY[doy].sort((a,b)=>a-b);pct90[doy]=vs[Math.floor(vs.length*0.9)]||vs[vs.length-1]});
  // Flag MHW days: SST > 90th percentile for that day-of-year
  const mhwData=sstData.map(d=>{const doy=d.time.slice(5,10);const thresh=pct90[doy]||0;
    return{time:d.time,value:d.value>thresh?Math.round((d.value-thresh)*100)/100:0}});
  const mhwDays=mhwData.filter(d=>d.value>0).length;
  S.envR.mhw={nm:'Marine Heatwave',value:mhwDays,u:'days above 90th pct',note:mhwDays+' MHW days detected in period'};
  if(mode==='timeseries'){S.envTS.mhw={nm:'Marine Heatwave (\u00b0C above 90th pct)',u:'\u00b0C',data:mhwData};
    stampProvenance('mhw',{server:'computed',dataset:'MHW from SST',variable:'sst_exceedance_90pct',lat,lon,from:df,to:dt,source:'hobday2016'})}
  mc('mhw','ok',mhwDays+' MHW days')
}catch(e){if(e.name==='AbortError')return;mc('mhw','err',e.message)}up('MHW')})():Promise.resolve();
// ── Bathymetry (Depth + Slope from ETOPO1) ──
const bp=bV.length?(async()=>{try{
  _areaStats=null;
  if(_envBounds){
    const as=await fetchAreaBathymetry(_envBounds,_polygonMode!=='crop'?_envPolygon:null);
    _areaStats=as;
    if(bV.find(v=>v.id==='depth')){S.envR.depth={nm:'Depth',value:as.depthMean,u:'m',areaStats:as};mc('depth','ok');up('Depth')}
    if(bV.find(v=>v.id==='slope')){S.envR.slope={nm:'Slope Angle',value:as.slopeMean,u:'°',areaStats:as};mc('slope','ok');up('Slope Angle')}
    // Validate NOAA depth filter
    if(window._noaaFilters&&(as.depthMin>window._noaaFilters.depthMax||as.depthMax<window._noaaFilters.depthMin))
      toast('Warning: area depths ('+as.depthMin+'–'+as.depthMax+'m) outside filter range','err',5000);
  }else{
    const b=await fetchBathymetry(lat,lon);
    if(bV.find(v=>v.id==='depth')){S.envR.depth={nm:'Depth',value:b.depth,u:'m'};mc('depth','ok');up('Depth')}
    if(bV.find(v=>v.id==='slope')){S.envR.slope={nm:'Slope Angle',value:b.slope,u:'°'};mc('slope','ok');up('Slope Angle')}}
}catch(e){if(e.name==='AbortError')return;console.error('Bathymetry error:',e);
  bV.forEach(v=>{mc(v.id,'err',e.message);up(v.nm)})}})():Promise.resolve();
// ── Await all, render results ──
const _myAbort=_envAbort;
try{await Promise.all([...ep,mp,wp,cp,kp,op,php,onip,naop,mhwp,bp])}catch(e){
  if(e.name==='AbortError')throw e;
  console.error('envFetch batch error:',e)}
if(_myAbort.signal.aborted){if(_envAbort===_myAbort){_envAbort=null;hi('#eprog')};return}
if(_envAbort===_myAbort){_envAbort=null;hi('#eprog')}
// ── Cross-Variable Prediction Pass (Layer D of gap-fill) ──
if(typeof _crossVariablePredict==='function'){
  const predicted=_crossVariablePredict();
  if(predicted.length){
    console.info('GAP-FILL cross-variable predicted:',predicted.join(', '));
    predicted.forEach(id=>{if(sel.includes(id))mc(id,'ok','(predicted)')});
    toast(predicted.length+' variable'+(predicted.length>1?'s':'')+' estimated via cross-variable prediction','info',4000)}}
// Purge corrupt/empty envTS entries before rendering
Object.keys(S.envTS).forEach(id=>{
  const ts=S.envTS[id];
  if(!ts?.data?.length||!ts.data[0]?.time){delete S.envTS[id];console.warn('Purged invalid envTS:',id)}});
if(_clampNotes.length)toast('Date adjusted — '+_clampNotes.join('; '),'info',6000);
// Seasonal post-filter (string-based month extraction, no Date construction)
const sfMonths=getSeasonalMonths();
if(sfMonths&&sfMonths.length<12){const sfSet=new Set(sfMonths);Object.keys(S.envTS).forEach(id=>{
  S.envTS[id].data=S.envTS[id].data.filter(d=>{const m=parseInt(d.time.slice(5,7));return sfSet.has(m)});
  if(!S.envTS[id].data.length)delete S.envTS[id]})}
// ── Multi-Source Fusion (when enabled) ──
S.envFusion={};
if(_fusionMode){
  const fusibleIds=sel.filter(id=>_fusionSources[id]&&_fusionSources[id].length>=2);
  if(fusibleIds.length){
    toast('Fetching multi-source data for '+fusibleIds.length+' parameter'+(fusibleIds.length>1?'s':'')+'...','info');
    try{S.envFusion=await fetchFusionData(fusibleIds,lat,lon,mode,df,dt,isHist)}catch(e){console.error('Fusion error:',e)}
    if(Object.keys(S.envFusion).length)toast(Object.keys(S.envFusion).length+' parameter'+(Object.keys(S.envFusion).length>1?'s':'')+' with multi-source ensemble','ok')}}
const fk=Object.keys(S.envR);
const _gapIds=Object.keys(_envGaps);
// Data Coverage Report — replaces old error diagnostic
if(!fk.length){
  const gapList=_gapIds.map(id=>{const g=_envGaps[id];return`<div style="display:flex;gap:6px;align-items:baseline;margin:3px 0"><span style="color:var(--tm);opacity:.5">◌</span><span style="color:var(--ac)">${escHTML(g.nm)}</span><span style="opacity:.5;font-size:10px">${escHTML(g.reason)}</span></div>`}).join('');
  const errs=Object.values(_envErrors).join(' ').toLowerCase();
  let hint='';
  if(errs.includes('no ocean')||errs.includes('on land'))hint='The selected coordinates may be on land — ocean datasets require ocean coordinates.';
  else if(errs.includes('unreachable')||errs.includes('network')||errs.includes('failed to fetch'))hint='Data servers may be temporarily unreachable — retry individual variables or try again later.';
  else if(errs.includes('timeout'))hint='Requests timed out — the data servers may be slow. Try a shorter date range.';
  else hint='These variables have no data at this location/time. Hover the chips above for details.';
  H('#esum',`<div style="padding:16px"><div style="font-size:13px;color:var(--tm);margin-bottom:10px"><span style="font-weight:700">Data Coverage:</span> 0/${sel.length} variables returned data</div><div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:10px;max-height:180px;overflow-y:auto;padding:8px;background:rgba(169,157,145,.04);border-radius:6px"><div style="font-size:10px;text-transform:uppercase;color:var(--ac);margin-bottom:6px">Data Gaps (${_gapIds.length})</div>${gapList||'<span style="opacity:.6">No details</span>'}</div><div style="font-size:12px;color:var(--tm);font-family:var(--mf);line-height:1.5;opacity:.7">${hint}</div></div>`);return}
// Partial coverage summary — data gaps reported alongside successes
if(_gapIds.length){
  toast(fk.length+'/'+sel.length+' variables returned data — '+_gapIds.length+' data gap'+ (_gapIds.length>1?'s':''),'info',5000)}
// Pre-compute Mann-Kendall trends for summary cards
const _mkTrends={};Object.keys(S.envTS).forEach(id=>{let d=S.envTS[id].data;if(d&&d.length>=10){if(d.length>300)d=lttb(d,300);_mkTrends[id]=mannKendall(d)}});
// Summary cards with sparklines + trend
// Quality + Shapiro-Wilk + provenance for each variable
const _qualScores={},_swTests={};
Object.keys(S.envTS).forEach(id=>{_qualScores[id]=assessQuality(S.envTS[id].data);
  const vals=S.envTS[id].data.map(d=>d.value).filter(v=>typeof v==='number'&&isFinite(v));
  if(vals.length>=3&&vals.length<=5000)_swTests[id]=shapiroWilk(vals)});
H('#esum',`<div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:8px"><span style="color:var(--sg);font-weight:700">${fk.length}</span>/${sel.length} · ${lat}°N ${lon}°E${_gapIds.length?' <span style="opacity:.6">· '+_gapIds.length+' data gap'+(_gapIds.length>1?'s':'')+'</span>':''}${_envBounds?(_envPolygon?' <span class="area-badge">Polygon '+_polygonMode+'</span>':' <span class="area-badge">Area avg</span>'):''} <button class="bt sm" onclick="exportReproBundle()" style="font-size:10px;padding:3px 8px">Export Bundle</button> <button class="bt sm" onclick="shareAnalysisLink()" style="font-size:10px;padding:3px 8px">Share Link</button></div><div class="eg">${fk.map((id,ci)=>{const r=S.envR[id];const mk=_mkTrends[id];const trendArrow=mk?(mk.trend==='increasing'?'↑':mk.trend==='decreasing'?'↓':'→'):'';const trendCol=mk?(mk.p<0.05?'var(--sg)':mk.p<0.1?'var(--wa)':'var(--tm)'):'var(--tm)';const spark=S.envTS[id]?sparklineSVG(S.envTS[id].data,120,28,CL[ci%8]):'';const fus=S.envFusion[id];const confBadge=r.confidence&&typeof _confidenceBadgeHTML==='function'?_confidenceBadgeHTML(r.confidence):'';const srcBadge=confBadge||(fus?.sources?.length>=2?' <span style="font-size:9px;color:var(--ac);opacity:.8">ensemble ('+fus.sources.length+')</span>':r.srcNote&&!r.confidence?' <span style="font-size:9px;color:var(--wa);opacity:.7">alt source</span>':r.srcCount>1?' <span style="font-size:9px;color:var(--sg);opacity:.7">multi-source</span>':'');const fusSub=fus?.ensemble?.length?`<div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:2px">\u03C3=${(fus.ensemble.reduce((s,d)=>s+d.std,0)/fus.ensemble.length).toFixed(3)} ${r.u}${fus.pairs?.length?' · r='+fus.pairs[0].r.toFixed(2):''}</div>`:(fus?.mode==='latest'&&fus.n>=2?`<div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:2px">\u03BC=${fus.mean.toFixed(2)} \u00B1${fus.std.toFixed(3)} ${r.u} (${fus.n} src)</div>`:'');const areaSub=r.areaStats?`<div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:2px">min ${r.areaStats.depthMin} / max ${r.areaStats.depthMax}${r.areaStats.oceanPoints?' · '+r.areaStats.oceanPoints+' pts':''}</div>`:'';const qs=_qualScores[id];const qBadge=qs?`<span class="quality-badge ${qs.color}" title="Data quality: ${qs.score}/100\n${qs.issues.join('\n')}"></span>`:'';const swt=_swTests[id];const swBadge=swt?`<span style="font-size:8px;color:${swt.normal?'var(--sg)':'var(--wa)'}"> ${swt.normal?'N':'!N'}</span>`:'';const provBadge=getProvenanceHTML(id);return`<div class="ec"><div class="el">${qBadge}${r.nm}${srcBadge}${swBadge}${trendArrow?` <span style="color:${trendCol}">${trendArrow}</span>`:''}</div><div class="ev">${typeof r.value==='number'?r.value.toFixed(r.u==='ppm'?1:r.u==='hPa'?1:2):r.value||'N/A'}<span class="eu">${r.u}</span></div>${areaSub}${fusSub}${provBadge}${spark?`<div class="sparkline-wrap">${spark}</div>`:''}</div>`}).join('')}</div>`);
// ── Habitat inference card ──
try {
  const prev = document.getElementById('env-habitat-card'); if (prev) prev.remove();
  const _hLat = parseFloat($('#elat')?.value);
  const _hLon = parseFloat($('#elon')?.value);
  const _hData = {};
  for (const [id, r] of Object.entries(S.envR)) {
    if (id === 'bath' || r.nm?.toLowerCase().includes('depth') || r.nm?.toLowerCase().includes('bath')) _hData.depth = parseFloat(r.value);
    if (id === 'sst' || r.nm?.toLowerCase().includes('sst') || r.nm?.toLowerCase().includes('temperature')) _hData.sst = parseFloat(r.value);
    if (id === 'chlor' || r.nm?.toLowerCase().includes('chlor')) _hData.chlor = parseFloat(r.value);
  }
  if (S.envR.depth?.value != null) _hData.depth = parseFloat(S.envR.depth.value);
  if (S.envR.slope?.value != null) _hData.slope = parseFloat(S.envR.slope.value);
  if (_hData.depth != null || _hData.sst != null) {
    const habs = inferMarineHabitat(_hLat, _hLon, _hData);
    if (habs.length) {
      const habHtml = '<div style="margin:12px 0;padding:12px 16px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">' +
        '<div style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Suggested Marine Habitats</div>' +
        habs.filter(h => h.confidence >= 0.2).map(h =>
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
            '<div style="width:40px;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--sg) ' + (h.confidence * 100) + '%,var(--bd) ' + (h.confidence * 100) + '%)"></div>' +
            '<span style="font-size:13px;color:var(--ts);font-family:var(--sf);font-weight:600">' + h.type + '</span>' +
            '<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">' + (h.confidence * 100).toFixed(0) + '%</span>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-left:48px;margin-bottom:6px">' + h.reasoning + '</div>'
        ).join('') +
        '</div>';
      const esumEl = document.getElementById('esum');
      if (esumEl) esumEl.insertAdjacentHTML('afterend', '<div id="env-habitat-card">' + habHtml + '</div>');
    }
    S.envR._habitat = { habitats: habs.filter(h => h.confidence >= 0.2) };
  }
} catch (e) { console.warn('Habitat inference:', e.message); }
// Individual time series charts + anomaly detection
const tk=Object.keys(S.envTS);
if(tk.length){let ch='';tk.forEach(id=>{ch+=`<div style="position:relative"><div class="pcc" id="ep-${id}" style="height:240px"></div><div id="ep-${id}-anom" style="font-size:11px;font-family:var(--mf);color:var(--tm);margin:-10px 0 14px 8px"></div></div>`;
    if(S.envFusion[id]?.ensemble){ch+=`<div style="position:relative;margin-bottom:8px"><div class="pcc" id="ep-${id}-ens" style="height:260px"></div><div id="ep-${id}-fstats" style="font-size:11px;font-family:var(--mf);color:var(--tm);margin:-6px 0 14px 8px"></div></div>`}});
  H('#echarts',ch);
  // Pre-compute all chart data synchronously, then batch-render in one rAF
  const chartJobs=tk.map((id,i)=>{
    let pd=S.envTS[id].data;if(pd.length>350)pd=lttb(pd,350);
    const times=pd.map(d=>d.time),vals=pd.map(d=>d.value);
    let trcs;
    // Special rendering for ONI (red/blue bars) and MHW (red fill)
    if(id==='oni'){
      const colors=vals.map(v=>v>=0.5?'#C27878':v<=-0.5?'#6BA3C9':'#888');
      trcs=[{x:times,y:vals,type:'bar',marker:{color:colors},name:'ENSO ONI',
        hovertemplate:'%{x}<br>ONI: %{y:.2f}°C<br>%{text}<extra></extra>',
        text:vals.map(v=>v>=0.5?'El Niño':v<=-0.5?'La Niña':'Neutral')}];
    }else if(id==='mhw'){
      trcs=[{x:times,y:vals,type:'scatter',mode:'lines',fill:'tozeroy',
        line:{color:'#C27878',width:1.5},fillcolor:'rgba(194,120,120,0.35)',name:'MHW Exceedance'}];
    }else{
      trcs=[{x:times,y:vals,type:'scatter',mode:'lines',line:{color:CL[i%8],width:2},fill:'tozeroy',fillcolor:CL[i%8]+'15',name:S.envTS[id].nm}];
    }
    // Moving average — batch into initial traces
    if(pd.length>14){const win=Math.min(30,Math.floor(pd.length/5));
      const ma=new Array(pd.length);let rsum=0;
      for(let k=0;k<pd.length;k++){rsum+=vals[k];if(k>=win){rsum-=vals[k-win]}
        ma[k]=k>=win-1?rsum/win:null}
      trcs.push({x:times,y:ma,type:'scatter',mode:'lines',line:{color:'rgba(255,255,255,0.4)',width:1.5,dash:'dot'},name:`${S.envTS[id].nm} (${win}d avg)`,hoverinfo:'skip'})}
    // Anomaly detection
    const anoms=detectAnomalies(S.envTS[id].data);
    if(anoms.length){const ad=anoms.length>200?lttb(anoms,200):anoms;
      trcs.push({x:ad.map(d=>d.time),y:ad.map(d=>d.value),type:'scatter',mode:'markers',marker:{color:'#C27878',size:6,symbol:'diamond'},name:`Anomalies (${anoms.length})`,text:ad.map(d=>`z=${d.zScore.toFixed(1)}`)})}
    // Climate index traces — prepare inline
    const idxTraces=[];
    if(_activeIndices.size){const minT=S.envTS[id].data[0]?.time,maxT=S.envTS[id].data[S.envTS[id].data.length-1]?.time;
      if(minT&&maxT)_activeIndices.forEach(type=>{const idx=_climateIndices[type];if(!idx?.data?.length)return;
        const filtered=idx.data.filter(d=>d.time>=minT&&d.time<=maxT);if(!filtered.length)return;
        idxTraces.push({x:filtered.map(d=>d.time),y:filtered.map(d=>d.value),type:'scatter',mode:'lines',
          line:{color:type==='oni'?'#D4A04A':type==='nao'?'#9B8EC4':'#6BA3C9',width:1.5,dash:'dashdot'},
          name:_climateIndices[type].nm,yaxis:'y2',opacity:0.7})})}
    const mk=_mkTrends[id]||null;
    return{id,trcs:[...trcs,...idxTraces],anoms,hasIdx:idxTraces.length>0,mk}});
  // Lazy chart rendering — only render charts visible in viewport via IntersectionObserver
  const _chartJobMap=new Map();
  chartJobs.forEach(job=>{_chartJobMap.set('ep-'+job.id,job);
    if(S.envFusion[job.id]?.ensemble)_chartJobMap.set('ep-'+job.id+'-ens',job)});
  function _materializeChart(el){
    const elId=el.id;const isEns=elId.endsWith('-ens');
    const jobId=isEns?elId.replace('ep-','').replace('-ens',''):elId.replace('ep-','');
    const job=_chartJobMap.get(isEns?'ep-'+jobId+'-ens':'ep-'+jobId);
    if(!job||!S.envTS[job.id])return;
    if(isEns){
      // Render ensemble chart
      const fData=S.envFusion[job.id];
      if(!fData?.ensemble?.length)return;
      const ens=fData.ensemble.length>500?lttb(fData.ensemble.map(d=>({time:d.time,value:d.value})),500).map((d,i)=>{
        const orig=fData.ensemble.find(e=>e.time===d.time)||fData.ensemble[Math.round(i*fData.ensemble.length/500)];
        return orig||d}):fData.ensemble;
      const ensTimes=ens.map(d=>d.time);
      const ensTraces=[
        {x:ensTimes,y:ens.map(d=>d.value+d.std),type:'scatter',mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip'},
        {x:ensTimes,y:ens.map(d=>d.value-d.std),type:'scatter',mode:'lines',line:{width:0},fill:'tonexty',
          fillcolor:'rgba(99,190,255,0.15)',name:'\u00B11\u03C3 range',showlegend:true},
        {x:ensTimes,y:ens.map(d=>d.value),type:'scatter',mode:'lines',line:{color:'#63BEFF',width:2.5},name:'Ensemble Mean'}
      ];
      const srcColors=['#C9956B','#9B8EC4','#6BA3C9','#D4A04A','#82B882'];
      (fData.sources||[]).forEach((s,si)=>{
        if(!s.data?.length)return;let sd=s.data;if(sd.length>400)sd=lttb(sd,400);
        ensTraces.push({x:sd.map(d=>d.time),y:sd.map(d=>d.value),type:'scatter',mode:'lines',
          line:{color:srcColors[si%5],width:1.2,dash:'dot'},name:s.nm+(s.res?' ('+s.res+')':''),opacity:0.8})});
      const ensLayout={...PL,height:260,
        title:{text:S.envTS[job.id].nm+' — Multi-Source Ensemble ('+((fData.sources||[]).length)+' sources)',font:{size:12}},
        xaxis:{...PL.xaxis,type:'date'},hovermode:'x unified'};
      Plotly.newPlot(elId,ensTraces,ensLayout,{responsive:true});
      const fsEl=$(`#${elId.replace('-ens','')}-fstats`);
      if(fsEl){let fhtml='<span style="color:var(--ac)">Sources:</span> ';
        (fData.sources||[]).forEach((s,si)=>{
          const v=EV.find(x=>x.id===job.id);const u=v?.u||'';
          const srcMean=s.data?.length?s.data.reduce((a,d)=>a+d.value,0)/s.data.length:s.value;
          fhtml+=`<span style="color:${srcColors[si%5]}">${s.nm}</span> \u03BC=${srcMean?.toFixed(2)||'?'}${u} `;});
        if(fData.pairs?.length){fhtml+='<br><span style="color:var(--ac)">Agreement:</span> ';
          fData.pairs.forEach(p=>{const col=Math.abs(p.r)>0.9?'var(--sg)':Math.abs(p.r)>0.7?'var(--wa)':'var(--co)';
            fhtml+=`<span style="color:${col}">r=${p.r.toFixed(3)}</span> bias=${p.bias.toFixed(3)} RMSE=${p.rmse.toFixed(3)} (n=${p.n}) `})}
        fsEl.innerHTML=fhtml}
    }else{
      // Render main time series chart
      const layout={...PL,height:240,title:{text:S.envTS[job.id].nm+' ('+S.envTS[job.id].u+')',font:{size:12}},
        xaxis:{...PL.xaxis,type:'date',showspikes:true,spikemode:'across',spikecolor:'rgba(201,149,107,0.3)'},
        hovermode:'x unified'};
      if(job.hasIdx)layout.yaxis2={overlaying:'y',side:'right',showgrid:false,font:{size:10}};
      Plotly.newPlot(elId,job.trcs,layout,{responsive:true});
      const anomEl=$(`#${elId}-anom`);
      if(anomEl){let html='';
        if(job.anoms.length)html+=`<span class="anomaly-dot"></span> ${job.anoms.length} anomalies (>2\u03C3)`;
        if(job.mk){const arrow=job.mk.trend==='increasing'?'↑':job.mk.trend==='decreasing'?'↓':'→';
          const cls=job.mk.p<0.05?'sig':job.mk.p<0.1?'marginal':'ns';
          html+=`<span class="trend-badge ${cls}">${arrow} ${Math.abs(job.mk.senSlope).toFixed(4)} ${S.envTS[job.id].u}/yr (MK p=${job.mk.p.toFixed(3)})</span>`}
        anomEl.innerHTML=html}
      renderAnnotationsOnChart(job.id)}}
  const _chartObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting&&!entry.target._plotlyRendered){
        try{_materializeChart(entry.target);entry.target._plotlyRendered=true}
        catch(e){console.error('Chart render error:',entry.target.id,e)}}})},{rootMargin:'200px 0px'});
  $$('#echarts .pcc').forEach(el=>_chartObserver.observe(el));
  // Synthesis uses S.envTS data directly — render immediately (no chart DOM dependency)
  async function renderSynthesis(tk){
    // Crosshair sync across all env charts
    const chartIds=[...tk.map(id=>'ep-'+id),...tk.filter(id=>S.envFusion[id]?.ensemble).map(id=>'ep-'+id+'-ens')];
    chartIds.forEach(srcId=>{const srcEl=document.getElementById(srcId);if(!srcEl)return;
      srcEl.on('plotly_hover',function(evData){if(!evData.points?.length)return;const xval=evData.points[0].x;
        chartIds.forEach(tgtId=>{if(tgtId===srcId)return;try{Plotly.Fx.hover(tgtId,[{xval}])}catch{}})});
      srcEl.on('plotly_unhover',function(){chartIds.forEach(tgtId=>{if(tgtId===srcId)return;try{Plotly.Fx.hover(tgtId,[])}catch{}})})});
    // Synthesis + correlation
    if(tk.length>=2){
      const traces=tk.map((id,i)=>{let pd=S.envTS[id].data;if(pd.length>350)pd=lttb(pd,350);
        const vals=pd.map(d=>d.value),mean=vals.reduce((a,v)=>a+v,0)/vals.length,sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length)||1;
        return{x:pd.map(d=>d.time),y:vals.map(v=>(v-mean)/sd),type:'scatter',mode:'lines',line:{color:CL[i%8],width:2},name:S.envTS[id].nm}});
      H('#esyn',`<div class="sec" style="margin-top:18px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Synthesis — Multi-Variable Comparison</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><div class="pcc" id="ep-overlay" style="height:300px"></div><div id="corr-matrix" style="margin-top:14px"></div></div></div>`);
      Plotly.newPlot('ep-overlay',traces,{...PL,height:300,title:{text:'Normalized Comparison (z-scores)',font:{size:12}},xaxis:{...PL.xaxis,type:'date'},yaxis:{...PL.yaxis,title:{text:'Standard deviations',font:{size:11}}}},{responsive:true});
      // Batched correlation — yields to main thread every 25 pairs to prevent freeze
      const pairs=[];const timeMaps={};
      tk.forEach(id=>{const m={};S.envTS[id].data.forEach(d=>{m[d.time]=d.value});timeMaps[id]=m});
      const pairIndices=[];
      for(let i=0;i<tk.length;i++)for(let j=i+1;j<tk.length;j++)pairIndices.push([i,j]);
      const _skipSpearman=pairIndices.length>200;
      const _CORR_BATCH=25;
      for(let b=0;b<pairIndices.length;b+=_CORR_BATCH){
        const chunk=pairIndices.slice(b,b+_CORR_BATCH);
        for(const[i,j]of chunk){
          const mA=timeMaps[tk[i]],mB=timeMaps[tk[j]];const xs=[],ys=[];
          for(const t in mA){if(mB[t]!=null){xs.push(mA[t]);ys.push(mB[t])}}
          if(xs.length>5){const n=xs.length;
            let sx=0,sy=0;for(let k=0;k<n;k++){sx+=xs[k];sy+=ys[k]}
            const mx=sx/n,my=sy/n;let num=0,dx2=0,dy2=0;
            for(let k=0;k<n;k++){num+=(xs[k]-mx)*(ys[k]-my);dx2+=(xs[k]-mx)**2;dy2+=(ys[k]-my)**2}
            const rP=Math.sqrt(dx2)*Math.sqrt(dy2)?num/(Math.sqrt(dx2)*Math.sqrt(dy2)):0;
            const rS=_skipSpearman?rP:spearmanCorr(xs,ys);
            pairs.push({a:S.envTS[tk[i]].nm,b:S.envTS[tk[j]].nm,r:rP,rs:rS,n})}}
        if(b+_CORR_BATCH<pairIndices.length)await new Promise(r=>setTimeout(r,0))}
      if(pairs.length){H('#corr-matrix',`<div style="font-size:12px;font-family:var(--mf);color:var(--tm);margin-bottom:8px">Pairwise Correlations${_skipSpearman?' <span style="opacity:.6">(Spearman skipped — '+pairIndices.length+' pairs)</span>':''}</div><div style="display:flex;flex-wrap:wrap;gap:8px">${pairs.map(p=>{
        const col=Math.abs(p.r)>0.7?'var(--sg)':Math.abs(p.r)>0.4?'var(--wa)':'var(--tm)';
        const colS=Math.abs(p.rs)>0.7?'var(--sg)':Math.abs(p.rs)>0.4?'var(--wa)':'var(--tm)';
        const dir=p.r>0.1?'↑':p.r<-0.1?'↓':'→';
        return`<div style="background:var(--be);border:1px solid var(--bd);border-radius:6px;padding:10px 14px;min-width:180px"><div style="font-size:11px;color:var(--tm)">${p.a} × ${p.b}</div><div style="display:flex;gap:12px;margin-top:4px"><div><div style="font-size:9px;color:var(--tm)">Pearson</div><div style="font-size:18px;font-weight:700;color:${col}">${dir} ${p.r.toFixed(3)}</div></div><div><div style="font-size:9px;color:var(--tm)">Spearman</div><div style="font-size:18px;font-weight:700;color:${colS}">${p.rs>0.1?'↑':p.rs<-0.1?'↓':'→'} ${p.rs.toFixed(3)}</div></div></div><div style="font-size:10px;color:var(--tm)">n=${p.n}</div></div>`}).join('')}</div>`)}
      renderLagCorrPanel(tk)}
    renderSeasonalityPanel(tk)}
  renderSynthesis(tk).catch(e=>console.error('Synthesis render error:',e));
}
// Annotations + threshold panels
renderAnnotationsPanel(tk);
renderThresholdPanel(tk);
// Action buttons
try{sessionStorage.setItem('meridian_env_meta',JSON.stringify({lat,lon,keys:fk}))}catch{}
H('#eact',`<div style="display:flex;gap:6px;margin:12px 0;flex-wrap:wrap"><button class="bt on" onclick="sendEnvWS()">→ Workshop</button><button class="bt sm" onclick="dlEnvCSV()">CSV</button><button class="bt sm" onclick="dlReproScript('python')">Python</button><button class="bt sm" onclick="dlReproScript('r')">R Script</button><button class="bt sm" onclick="exportReproBundle()" style="color:var(--sg);border-color:var(--sb)">Export Bundle</button><button class="bt sm" onclick="shareAnalysisLink()">Share Link</button><button class="bt sm" onclick="saveCurrentAsWorkflow()" style="color:var(--ac)">Save as Workflow</button>${S.envTS.sst?'<button class="bt sm" style="color:var(--co)" onclick="detectMHW()">Detect Marine Heatwaves</button>':''}<button class="bt sm" onclick="fetchArgoProfiles()">Argo Profiles</button>${tk.length?tk.map(id=>`<button class="bt sm" onclick="exportChart('ep-${id}')">📷 ${S.envTS[id].nm}</button>`).join(''):''}</div>
${window._activeWorkflow?`<div class="tip" style="margin-top:8px"><b>Workflow: ${escHTML(window._activeWorkflow.name)}</b><br>${escHTML(window._activeWorkflow.guidance)}<button class="dx" onclick="this.closest('.tip').remove();window._activeWorkflow=null">×</button></div>`:''}
<div class="sec" style="margin-top:10px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Normality & Quality Assessment</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none">
<table class="dt"><thead><tr><th>Variable</th><th>n</th><th>W</th><th>p</th><th>Normal?</th><th>Quality</th><th>Coverage</th><th>Max Gap</th></tr></thead>
<tbody>${tk.map(id=>{const sw=_swTests[id];const q=_qualScores[id];return`<tr><td class="cn">${S.envTS[id].nm}</td><td>${S.envTS[id].data.length}</td><td>${sw?sw.W.toFixed(4):'—'}</td><td style="color:${sw?(sw.p<0.05?'var(--co)':'var(--sg)'):'var(--tm)'}">${sw?sw.p.toFixed(4):'—'}</td><td>${sw?(sw.normal?'Yes':'No'):'—'}</td><td><span class="quality-badge ${q?.color||''}"></span>${q?q.score+'/100':'—'}</td><td>${q?.stats?.coverage||'—'}%</td><td>${q?.stats?.maxGap||'—'}d</td></tr>`}).join('')}</tbody></table></div></div>
<div class="sec" style="margin-top:10px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>ANOVA & Forecasting</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none">
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><select class="fs" id="envAnovaVar">${tk.map(id=>`<option value="${id}">${S.envTS[id].nm}</option>`).join('')}</select>
<select class="fs" id="envAnovaSplit"><option value="year">By Year</option><option value="season">By Season</option><option value="quarter">By Quarter</option></select>
<button class="bt on" onclick="runEnvAnova()">ANOVA</button>
<button class="bt sm" onclick="runEnvForecast()">Forecast (90d)</button>
<button class="bt sm" onclick="runEnvGLM()">GLM</button></div>
<div id="envAnovaResult"></div><div class="pcc" id="envForecastChart" style="height:280px;display:none"></div><div id="envGLMResult"></div></div></div>`);sh('#eact');
// Plankton/productivity links panel (P2.9)
const plnk=$('#env-plankton');if(plnk&&(S.envSel.has('npp')||S.envSel.has('chlor'))){const plat=$('#elat').value,plon=$('#elon').value;
plnk.innerHTML=`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'"><h4>Plankton & Productivity Resources</h4><span style="color:var(--tm)">▸</span></div><div class="sb" style="display:none"><div style="display:flex;gap:8px;flex-wrap:wrap"><a href="https://www.st.nmfs.noaa.gov/copepod/atlas/html/ptindx_00_000000.html" target="_blank" class="bt sm">COPEPOD Atlas</a><a href="https://www.marine.copernicus.eu/" target="_blank" class="bt sm">Copernicus Marine</a><a href="https://oceancolor.gsfc.nasa.gov/" target="_blank" class="bt sm">NASA Ocean Color</a></div><div style="font-size:11px;color:var(--tm);margin-top:6px;font-family:var(--mf)">Coordinates: ${plat}°N, ${plon}°E · Selected: NPP + Chlorophyll data</div></div></div>`}
// ── Location 2 comparison ──
const loc2=$('#eloc2');
if(loc2&&loc2.style.display!=='none'){
  const lat2=$('#elat2').value,lon2=$('#elon2').value;
  S.envTS2={};const tk2=Object.keys(S.envTS);
  const loc2eV=tk2.map(id=>EV.find(x=>x.id===id)).filter(v=>v&&v.src==='e');
  const loc2mV=tk2.map(id=>EV.find(x=>x.id===id)).filter(v=>v&&v.src==='m');
  const loc2wV=tk2.map(id=>EV.find(x=>x.id===id)).filter(v=>v&&v.src==='w');
  await Promise.all([
    ...loc2eV.map(async v=>{await _acquireSlot();try{
      const cr=clampRange(df,dt,v);if(!cr)return;
      const tQ=`[(${cr.start}T00:00:00Z):${_stride}:(${cr.end}T00:00:00Z)]`;
      const url=buildErddapUrl(v,tQ,lat2,lon2);
      const r2=await erddapFetch(url,20000);
      if(r2.ok){const d2=await r2.json();const rows2=(d2.table?.rows||[]).filter(r=>r[r.length-1]!=null);
        if(rows2.length)S.envTS2[v.id]={nm:v.nm+' (Loc2)',u:v.u,data:rows2.map(r=>({time:r[0],value:r[r.length-1]}))}}
    }catch{}finally{_releaseSlot()}}),
    loc2mV.length?(async()=>{try{const useDaily=isHist;const ps=loc2mV.map(v=>useDaily?(v.pd||v.p):v.p).join(',');
      const r2=await envFetchT(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat2}&longitude=${lon2}&${useDaily?'daily':'hourly'}=${ps}&start_date=${df}&end_date=${dt}`,20000);
      if(r2.ok){const d2=await r2.json();if(!d2.error){const timeKey=useDaily?'daily':'hourly';loc2mV.forEach(v=>{const pk=useDaily?(v.pd||v.p):v.p;const vs=d2[timeKey]?.[pk],ts=d2[timeKey]?.time;
        if(vs&&ts){const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);if(vd.length)S.envTS2[v.id]={nm:v.nm+' (Loc2)',u:v.u,data:vd}}})}}
    }catch{}})():Promise.resolve(),
    loc2wV.length?(async()=>{try{const useDaily=isHist;const ps=loc2wV.map(v=>useDaily?(v.pd||v.p):v.p).join(',');
      const base=isHist?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
      const r2=await envFetchT(`${base}?latitude=${lat2}&longitude=${lon2}&${useDaily?'daily':'hourly'}=${ps}&start_date=${df}&end_date=${dt}`,isHist?45000:20000);
      if(r2.ok){const d2=await r2.json();if(!d2.error){const timeKey=useDaily?'daily':'hourly';loc2wV.forEach(v=>{const pk=useDaily?(v.pd||v.p):v.p;const vs=d2[timeKey]?.[pk],ts=d2[timeKey]?.time;
        if(vs&&ts){const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);if(vd.length)S.envTS2[v.id]={nm:v.nm+' (Loc2)',u:v.u,data:vd}}})}}
    }catch{}})():Promise.resolve()
  ]);
  setTimeout(()=>{tk2.forEach((id,i)=>{if(S.envTS2[id]?.data?.length){let pd2=S.envTS2[id].data;if(pd2.length>350)pd2=lttb(pd2,350);
    Plotly.addTraces(`ep-${id}`,[{x:pd2.map(d=>d.time),y:pd2.map(d=>d.value),type:'scatter',mode:'lines',line:{color:'#9B8EC4',width:2,dash:'dash'},name:S.envTS2[id].nm}]);
    // Add Loc2 to overlay synthesis chart if it exists
    if($('#ep-overlay')){const vals=pd2.map(d=>d.value),mean=vals.reduce((a,v)=>a+v,0)/vals.length,sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length)||1;
      try{Plotly.addTraces('ep-overlay',[{x:pd2.map(d=>d.time),y:vals.map(v=>(v-mean)/sd),type:'scatter',mode:'lines',line:{color:'#9B8EC4',width:1.5,dash:'dash'},name:S.envTS2[id].nm}])}catch{}}}})},200);
}
}catch(e){
  if(e.name==='AbortError')return;
  console.error('envFetch crashed:',e);
  hi('#eprog');_envAbort=null;
  const msg=e.message||'Unknown error';
  H('#esum',`<div style="padding:16px"><p style="color:var(--co);font-size:14px;margin-bottom:8px">Environmental data fetch failed</p><div style="font-size:12px;color:var(--tm);font-family:var(--mf);line-height:1.6;padding:12px;background:rgba(194,120,120,.08);border-radius:6px"><strong>Error:</strong> ${escHTML(msg)}<br><br><strong>Possible causes:</strong><ul style="margin:4px 0 0 16px"><li>Too many variables selected with a very long date range — try fewer variables or a shorter range</li><li>Browser ran out of memory — close other tabs and retry</li><li>Network interruption during fetch</li></ul><br><button class="bt sm" onclick="envFetch()" style="color:var(--ac);border-color:var(--ac)">Retry Fetch</button></div></div>`);
  toast('Fetch crashed — see error details above','err',6000);
}}
async function retryEnvVar(id){
  const v=EV.find(x=>x.id===id);if(!v)return;
  const lat=$('#elat').value,lon=$('#elon').value,mode=$('#emode').value,df=$('#edf').value,dt=$('#edt').value;
  if(!lat||!lon||isNaN(+lat)||isNaN(+lon))return toast('Invalid coordinates','err');
  const isHist=df&&(new Date()-new Date(df))/(86400000)>90;
  toast('Retrying '+v.nm+'...','info');
  $$(`[data-id="${id}"]`).forEach(e=>{e.classList.remove('err');e.classList.add('sel');e.innerHTML=escHTML(e.dataset.orig||v.nm)+' ⏳'});
  // Re-probe server health before retry
  if(v.src==='e')await probeServer(v.server);
  let effV=v;let altPromoted=false;
  if(v.src==='e'&&isServerDown(v.server)&&v.alt&&!isServerDown(v.alt.server)){
    effV={...v,...v.alt,lon360:v.alt.lon360??false};altPromoted=true;
    console.info(`ENV retry ${v.id}: using alt ${effV.server.split('//')[1]}/${effV.ds}`)}
  const cr=clampRange(df,dt,effV);
  if(!cr&&mode!=='latest'){toast(v.nm+' covers '+(effV.minDate||'?')+' – '+(effV.maxDate||'now')+' only','err');return}
  const _rDaySpan=mode!=='latest'&&cr?Math.max(1,Math.round((new Date(cr.end)-new Date(cr.start))/86400000)):1;
  const _rStride=Math.max(1,Math.ceil(_rDaySpan/730));
  try{
    if(v.src==='e'){
      const tQ=mode==='latest'?'[(last)]':`[(${cr.start}T00:00:00Z):${_rStride}:(${cr.end}T00:00:00Z)]`;
      const url=buildErddapUrl(effV,tQ,lat,lon);const r=await erddapFetch(url,isHist?45000:20000);
      if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();let rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
      if(!rows.length)throw new Error('No data');
      // Apply polygon PIP filter on retry
      if(_envPolygon&&_polygonMode!=='crop'&&_envBounds&&rows.length>1){
        const latIdx=effV.dm===4?2:effV.dm===3?1:0,lonIdx=latIdx+1;
        rows=rows.filter(r=>pointInPolygon(r[latIdx],r[lonIdx],_envPolygon));
        if(!rows.length)throw new Error('No data inside polygon')}
      // Try alt source — skip if alt was promoted or alt server is down
      let altRows=null;
      if(!altPromoted&&v.alt&&!isServerDown(v.alt.server)){try{const altV={...v,...v.alt,lon360:v.alt.lon360??false};const altCr=mode==='latest'?true:clampRange(df,dt,altV);
        if(altCr){const altTQ=mode==='latest'?'[(last)]':`[(${altCr.start}T00:00:00Z):${_rStride}:(${altCr.end}T00:00:00Z)]`;
          const altUrl=buildErddapUrl(altV,altTQ,lat,lon);const altR=await erddapFetch(altUrl,20000);
          if(altR.ok){const altD=await altR.json();altRows=(altD.table?.rows||[]).filter(r=>r[r.length-1]!=null);if(!altRows.length)altRows=null;
            // PIP filter alt rows
            if(altRows&&_envPolygon&&_polygonMode!=='crop'&&_envBounds){const aLatIdx=altV.dm===4?2:altV.dm===3?1:0,aLonIdx=aLatIdx+1;
              altRows=altRows.filter(r=>pointInPolygon(r[aLatIdx],r[aLonIdx],_envPolygon));if(!altRows.length)altRows=null}}}
      }catch{}}
      const srcNote=altPromoted?'alt:'+effV.server.split('//')[1]?.split('.')[0]:undefined;
      if(mode==='latest'){const vals=rows.map(r=>r[r.length-1]);let value=vals.reduce((s,x)=>s+x,0)/vals.length;let srcCount=1;
        if(altRows?.length){const altMean=altRows.map(r=>r[r.length-1]).reduce((s,x)=>s+x,0)/altRows.length;value=(value+altMean)/2;srcCount=2}
        S.envR[v.id]={nm:v.nm,value,u:v.u,srcCount,srcNote}}
      else{const byTime={};rows.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
        let ts=Object.keys(byTime).sort().map(t=>({time:t,value:byTime[t].reduce((s,x)=>s+x,0)/byTime[t].length}));let srcCount=1;
        if(altRows?.length){const altByTime={};altRows.forEach(r=>{const t=r[0];if(!altByTime[t])altByTime[t]=[];altByTime[t].push(r[r.length-1])});
          const altTS=Object.keys(altByTime).sort().map(t=>({time:t,value:altByTime[t].reduce((s,x)=>s+x,0)/altByTime[t].length}));
          ts=mergeTimeSeries(ts,altTS);srcCount=2}
        S.envR[v.id]={nm:v.nm,value:ts[ts.length-1]?.value,u:v.u,srcCount,srcNote};if(ts.length>1)S.envTS[v.id]={nm:v.nm,u:v.u,data:ts}}
    }else if(v.src==='m'){
      const useDaily=isHist;const r=await envFetchT(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&${useDaily?'daily':'hourly'}=${useDaily?(v.pd||v.p):v.p}&${mode==='latest'?'forecast_days=1':`start_date=${df}&end_date=${dt}`}`,20000);
      if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();const pk=useDaily?(v.pd||v.p):v.p;const vs=d[useDaily?'daily':'hourly']?.[pk],ts=d[useDaily?'daily':'hourly']?.time;
      if(!vs||!ts)throw new Error('No data');const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);if(!vd.length)throw new Error('All null');
      S.envR[v.id]={nm:v.nm,value:vd[vd.length-1]?.value,u:v.u};if(mode==='timeseries')S.envTS[v.id]={nm:v.nm,u:v.u,data:vd};
    }else if(v.src==='w'){
      const useDaily=isHist;const base=isHist?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
      const r=await envFetchT(`${base}?latitude=${lat}&longitude=${lon}&${useDaily?'daily':'hourly'}=${useDaily?(v.pd||v.p):v.p}&${mode==='latest'?'forecast_days=1':`start_date=${df}&end_date=${dt}`}`,isHist?45000:20000);
      if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();const pk=useDaily?(v.pd||v.p):v.p;const vs=d[useDaily?'daily':'hourly']?.[pk],ts=d[useDaily?'daily':'hourly']?.time;
      if(!vs||!ts)throw new Error('No data');const vd=vs.map((val,i)=>({time:ts[i],value:val})).filter(r=>r.value!=null);if(!vd.length)throw new Error('All null');
      S.envR[v.id]={nm:v.nm,value:vd[vd.length-1]?.value,u:v.u};if(mode==='timeseries')S.envTS[v.id]={nm:v.nm,u:v.u,data:vd};
    }else if(v.src==='bath'){
      if(_envBounds){const as=await fetchAreaBathymetry(_envBounds,_polygonMode!=='crop'?_envPolygon:null);
        S.envR[v.id]={nm:v.nm,value:v.id==='depth'?as.depthMean:as.slopeMean,u:v.u,areaStats:as}}
      else{const b=await fetchBathymetry(lat,lon);
        S.envR[v.id]={nm:v.nm,value:v.id==='depth'?b.depth:b.slope,u:v.u}}
    }
    $$(`[data-id="${id}"]`).forEach(e=>{e.classList.remove('sel');e.classList.add('ok');e.innerHTML=escHTML(e.dataset.orig||v.nm)+' ✓'});
    toast(v.nm+' recovered!','ok');
  }catch(e){
    // ── CASCADE on retry: try all fusion sources before giving up ──
    if(v.src==='e'&&_fusionSources[v.id]){
      const triedDS=new Set([v.ds,v.alt?.ds,v.dsFb].filter(Boolean));
      const cascadeResult=await _cascadeErddap(v,mode,df,dt,lat,lon,_rStride,isHist,triedDS);
      if(cascadeResult){
        if(cascadeResult.synthesized){
          S.envR[v.id]={nm:v.nm,value:cascadeResult.ts[cascadeResult.ts.length-1]?.value,u:v.u,srcCount:cascadeResult.srcCount,srcNote:'synthesized:'+cascadeResult.srcNames};
          if(cascadeResult.ts.length>1)S.envTS[v.id]={nm:v.nm,u:v.u,data:cascadeResult.ts}}
        else{const vals=cascadeResult.rows.map(r=>r[r.length-1]);
          S.envR[v.id]={nm:v.nm,value:vals.reduce((s,x)=>s+x,0)/vals.length,u:v.u,srcCount:1,srcNote:'cascade:'+cascadeResult.src.nm}}
        $$(`[data-id="${id}"]`).forEach(el=>{el.classList.remove('sel');el.classList.add('ok');el.innerHTML=escHTML(el.dataset.orig||v.nm)+' ✓'});
        toast(v.nm+' recovered'+(cascadeResult.synthesized?' (synthesized '+cascadeResult.srcCount+' sources)':' via '+cascadeResult.src.nm),'ok');return}}
    // ── GAP-FILL on retry: spatial/temporal/climatology pipeline ──
    if(v.src==='e'&&typeof _gapFillPipeline==='function'){
      const gf=await _gapFillPipeline(v,mode,df,dt,lat,lon,_rStride,isHist);
      if(gf){
        S.envR[v.id]={nm:v.nm,value:gf.value,u:v.u,confidence:gf.confidence,srcNote:'gapfill:'+gf.detail};
        if(gf.ts?.length>1)S.envTS[v.id]={nm:v.nm,u:v.u,data:gf.ts};
        $$(`[data-id="${id}"]`).forEach(el=>{el.classList.remove('sel');el.classList.add('ok');el.innerHTML=escHTML(el.dataset.orig||v.nm)+' ✓'});
        toast(v.nm+' recovered (gap-fill: '+gf.confidence.label+')','ok');return}}
    $$(`[data-id="${id}"]`).forEach(el=>{el.classList.remove('sel');el.classList.add('err');el.innerHTML=escHTML(el.dataset.orig||v.nm)+' ✗ <button class="retry-btn" onclick="event.stopPropagation();retryEnvVar(\''+escHTML(id)+'\')">retry</button>'});toast(v.nm+' retry failed: '+e.message,'err')}}
$('#efb').addEventListener('click',()=>envFetch());
function bldET(){const tk=Object.keys(S.envTS);if(!tk.length){const cols=['Lat','Lon',...Object.keys(S.envR).map(id=>S.envR[id].nm)];const row={Lat:+$('#elat').value,Lon:+$('#elon').value};Object.keys(S.envR).forEach(id=>{row[S.envR[id].nm]=S.envR[id].value});return{cols,rows:[row]}}const at=new Set();tk.forEach(id=>S.envTS[id].data.forEach(d=>at.add(d.time)));const st=[...at].sort();const hr=st.length>400;if(hr){const dm={};st.forEach(t=>{const d=t.slice(0,10);if(!dm[d])dm[d]={}});tk.forEach(id=>{const lk={};S.envTS[id].data.forEach(d=>{const dy=d.time.slice(0,10);if(!lk[dy])lk[dy]=[];lk[dy].push(d.value)});Object.keys(dm).forEach(dy=>{dm[dy][id]=lk[dy]?lk[dy].reduce((s,v)=>s+v,0)/lk[dy].length:null})});return{cols:['Date',...tk.map(id=>S.envTS[id].nm)],rows:Object.keys(dm).sort().map(d=>{const r={Date:d};tk.forEach(id=>{r[S.envTS[id].nm]=dm[d][id]!=null?+dm[d][id].toFixed(4):null});return r})}}const lk={};tk.forEach(id=>{lk[id]={};S.envTS[id].data.forEach(d=>{lk[id][d.time]=d.value})});return{cols:['Date',...tk.map(id=>S.envTS[id].nm)],rows:st.map(t=>{const r={Date:t};tk.forEach(id=>{r[S.envTS[id].nm]=lk[id][t]!=null?+lk[id][t].toFixed(4):null});return r})}}
function sendEnvWS(){const{cols,rows}=bldET();S.wsC=cols;S.wsD=rows;autoTypes();initWS();goTab('workshop')}
function dlEnvCSV(){const{cols,rows}=bldET();
  const lat=$('#elat').value,lon=$('#elon').value,df=$('#edf').value,dt=$('#edt').value;
  const hdr=['# Meridian Environmental Data Export','# Generated: '+new Date().toISOString(),
    '# Location: '+lat+'N, '+lon+'E'+(_envBounds?' (Area avg: '+_envBounds.south.toFixed(2)+'–'+_envBounds.north.toFixed(2)+'N, '+_envBounds.west.toFixed(2)+'–'+_envBounds.east.toFixed(2)+'E)':''),
    '# Date Range: '+(df||'latest')+' to '+(dt||'latest'),
    '# Variables:'];
  Object.keys(S.envTS).forEach(id=>{const v=EV.find(x=>x.id===id);if(v){
    if(v.src==='e')hdr.push(`#   ${v.nm}: ERDDAP dataset=${v.ds}, server=${v.server}, var=${v.v}`);
    else if(v.src==='m')hdr.push(`#   ${v.nm}: Open-Meteo Marine, param=${v.p}`);
    else if(v.src==='w')hdr.push(`#   ${v.nm}: Open-Meteo Weather, param=${v.p}`);
    else if(v.src==='co2')hdr.push(`#   ${v.nm}: NOAA GML Mauna Loa CO2`)
    if(S.envFusion[id]?.sources?.length>=2)hdr.push(`#     Ensemble sources: ${S.envFusion[id].sources.map(s=>s.nm).join(', ')}`)}});
  if(Object.keys(S.envFusion).length)hdr.push('# Multi-Source Fusion: enabled');
  hdr.push('#');
  dl([...hdr,cols.join(','),...rows.map(r=>cols.map(c=>r[c]??'').join(','))].join('\n'),'env.csv','text/csv')}

// ═══ SAVED PRESETS ═══
function saveEnvPreset(){
  const name=prompt('Preset name:');if(!name)return;
  const presets=safeParse('meridian_env_presets',[]);
  presets.push({name,lat:$('#elat').value,lon:$('#elon').value,sel:[...S.envSel],
    mode:$('#emode').value,df:$('#edf').value,dt:$('#edt').value,
    sfrom:$('#sfrom')?.value||'',sto:$('#sto')?.value||''});
  safeStore('meridian_env_presets',presets);
  renderEnvPresets();toast('Preset saved','ok')}
function loadEnvPreset(idx){
  const presets=safeParse('meridian_env_presets',[]);
  const p=presets[idx];if(!p)return;
  $('#elat').value=p.lat;$('#elon').value=p.lon;$('#emode').value=p.mode||'timeseries';
  if(p.df)$('#edf').value=p.df;if(p.dt)$('#edt').value=p.dt;
  S.envSel=new Set(p.sel||[]);renderEV();
  if(p.sfrom&&$('#sfrom'))$('#sfrom').value=p.sfrom;
  if(p.sto&&$('#sto'))$('#sto').value=p.sto;
  if(_envMarker)_envMarker.setLatLng([parseFloat(p.lat),parseFloat(p.lon)]);
  if(_envMap)_envMap.setView([parseFloat(p.lat),parseFloat(p.lon)],6);
  toast('Loaded: '+p.name,'ok')}
function deleteEnvPreset(idx){
  const presets=safeParse('meridian_env_presets',[]);
  presets.splice(idx,1);safeStore('meridian_env_presets',presets);
  renderEnvPresets()}
function renderEnvPresets(){
  const presets=safeParse('meridian_env_presets',[]);
  const el=$('#presetList');if(!el)return;
  el.innerHTML=presets.map((p,i)=>`<span class="preset-btn"><button class="bt sm" onclick="loadEnvPreset(${i})">${p.name}</button><button class="pdel" onclick="event.stopPropagation();deleteEnvPreset(${i})">×</button></span>`).join('')}
renderEnvPresets();

// ═══ ENV ANOVA, FORECAST, GLM RUNNERS ═══
function runEnvAnova(){
  const id=$('#envAnovaVar')?.value;const split=$('#envAnovaSplit')?.value;
  if(!S.envTS[id])return toast('No data','err');
  const data=S.envTS[id].data;
  const groupMap={};
  data.forEach(d=>{const dt=new Date(d.time);let key;
    if(split==='year')key=dt.getFullYear().toString();
    else if(split==='season'){const m=dt.getMonth();key=m<3?'Winter':m<6?'Spring':m<9?'Summer':'Fall'}
    else key='Q'+(Math.floor(dt.getMonth()/3)+1);
    if(!groupMap[key])groupMap[key]=[];groupMap[key].push(d.value)});
  const labels=Object.keys(groupMap).sort();const groups=labels.map(k=>groupMap[k]);
  if(groups.length<2)return toast('Need ≥2 groups for ANOVA','err');
  const result=tukeyHSD(groups,labels);
  if(!result)return toast('ANOVA failed — check data','err');
  const a=result.anova;
  let html=`<div style="margin-top:8px"><div class="eg"><div class="ec"><div class="el">F-statistic</div><div class="ev">${a.F.toFixed(3)}</div></div>
    <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${a.p<0.05?'var(--sg)':'var(--tm)'}">${a.p.toFixed(4)}</div></div>
    <div class="ec"><div class="el">η²</div><div class="ev">${a.eta2.toFixed(3)}</div></div>
    <div class="ec"><div class="el">Groups</div><div class="ev">${groups.length}</div></div></div>
    <div style="font-size:12px;color:${a.p<0.05?'var(--sg)':'var(--tm)'};margin:8px 0">${a.p<0.05?'Significant difference between '+split+'s (p<0.05)':'No significant difference between '+split+'s (p≥0.05)'}</div>`;
  if(result.pairs.length<=20){html+=`<table class="dt" style="margin-top:8px"><thead><tr><th>Pair</th><th>Diff</th><th>q</th><th>p</th><th>Sig?</th></tr></thead><tbody>`;
    result.pairs.forEach(p=>{html+=`<tr><td class="cn">${p.a} vs ${p.b}</td><td>${p.diff.toFixed(3)}</td><td>${p.q.toFixed(2)}</td><td style="color:${p.sig?'var(--sg)':'var(--tm)'}">${p.p.toFixed(4)}</td><td>${p.sig?'Yes':'No'}</td></tr>`});
    html+=`</tbody></table>`}
  html+=`<div style="font-size:10px;color:var(--tm);margin-top:6px">One-way ANOVA with Tukey HSD post-hoc · ${S.envTS[id].nm} by ${split} · df(${a.dfBetween},${a.dfWithin})</div></div>`;
  H('#envAnovaResult',html)}

function runEnvForecast(){
  const id=$('#envAnovaVar')?.value;
  if(!S.envTS[id]||S.envTS[id].data.length<60)return toast('Need ≥60 data points for forecasting','err');
  const data=S.envTS[id].data;
  const seasonLen=data.length>400?365:data.length>60?30:7;
  const hw=holtWinters(data,seasonLen,90);
  if(!hw)return toast('Insufficient data for seasonal decomposition','err');
  const el=$('#envForecastChart');el.style.display='block';
  const histD=data.length>500?lttb(data,500):data;
  Plotly.newPlot('envForecastChart',[
    {x:histD.map(d=>d.time),y:histD.map(d=>d.value),type:'scatter',mode:'lines',line:{color:CL[0],width:2},name:'Observed'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.value),type:'scatter',mode:'lines',line:{color:'var(--sg)',width:2,dash:'dash'},name:'Forecast (90d)'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.hi),type:'scatter',mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.lo),type:'scatter',mode:'lines',line:{width:0},fill:'tonexty',fillcolor:'rgba(123,158,135,0.15)',name:'95% CI'}
  ],{...PL,height:280,title:{text:S.envTS[id].nm+' — Holt-Winters Forecast',font:{size:12}},xaxis:{...PL.xaxis,type:'date'}},{responsive:true});
  toast('Forecast generated with Holt-Winters (season='+seasonLen+'d)','ok')}

function runEnvGLM(){
  const tk=Object.keys(S.envTS);
  if(tk.length<2)return toast('Need ≥2 variables for GLM','err');
  // Use first variable as response, rest as predictors
  const yId=tk[0];const xIds=tk.slice(1,Math.min(6,tk.length));
  // Align by time
  const yMap={};S.envTS[yId].data.forEach(d=>{yMap[d.time]=d.value});
  const xMaps=xIds.map(id=>{const m={};S.envTS[id].data.forEach(d=>{m[d.time]=d.value});return m});
  const times=Object.keys(yMap).filter(t=>xMaps.every(m=>m[t]!=null));
  if(times.length<xIds.length+5)return toast('Insufficient overlapping data for GLM','err');
  const yVals=times.map(t=>yMap[t]);
  const xMatrix=times.map(t=>xIds.map((id,j)=>xMaps[j][t]));
  const result=fitGLM(yVals,xMatrix,'gaussian');
  if(!result)return toast('GLM fitting failed','err');
  const labels=['(Intercept)',...xIds.map(id=>S.envTS[id].nm)];
  let html=`<div style="margin-top:10px"><div class="eg"><div class="ec"><div class="el">AIC</div><div class="ev">${result.aic.toFixed(1)}</div></div>
    <div class="ec"><div class="el">Deviance</div><div class="ev">${result.deviance.toFixed(2)}</div></div>
    <div class="ec"><div class="el">n</div><div class="ev">${result.n}</div></div>
    <div class="ec"><div class="el">Family</div><div class="ev">${result.family}</div></div></div>
    <div style="font-size:11px;color:var(--tm);margin:6px 0">Response: ${S.envTS[yId].nm} ~ ${xIds.map(id=>S.envTS[id].nm).join(' + ')}</div>
    <table class="dt"><thead><tr><th>Predictor</th><th>Coef</th><th>SE</th><th>z</th><th>p</th><th>Sig</th></tr></thead><tbody>`;
  labels.forEach((l,i)=>{html+=`<tr><td class="cn">${escHTML(l)}</td><td>${result.beta[i].toFixed(4)}</td><td>${result.se[i].toFixed(4)}</td><td>${result.z[i].toFixed(2)}</td><td style="color:${result.p[i]<0.05?'var(--sg)':'var(--tm)'}">${result.p[i].toFixed(4)}</td><td>${result.p[i]<0.05?'*':''}</td></tr>`});
  html+=`</tbody></table><div style="font-size:10px;color:var(--tm);margin-top:6px">Gaussian GLM via IRLS · Significance: * p<0.05</div></div>`;
  H('#envGLMResult',html)}

// ═══ SEASONAL FILTER ═══
let _seasonalMonths=null;
function setSeasonalFilter(months){
  _seasonalMonths=months;
  const names=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  toast('Seasonal filter: '+months.map(m=>names[m]).join(', '),'info');
  sh('#clearSeasonBtn')}
function clearSeasonalFilter(){_seasonalMonths=null;$('#sfrom').value='';$('#sto').value='';hi('#clearSeasonBtn');toast('Seasonal filter cleared','info')}
function getSeasonalMonths(){
  if(_seasonalMonths)return _seasonalMonths;
  const from=parseInt($('#sfrom')?.value),to=parseInt($('#sto')?.value);
  if(!from&&!to)return null;
  const f=from||1,t=to||12,months=[];
  if(f<=t){for(let m=f;m<=t;m++)months.push(m)}
  else{for(let m=f;m<=12;m++)months.push(m);for(let m=1;m<=t;m++)months.push(m)}
  return months.length?months:null}

// ═══ CLIMATE INDEX OVERLAYS ═══
const _climateIndices={};const _activeIndices=new Set();
async function corsFetchT(url,ms){try{const r=await fetchT(url,ms);if(r.ok)return r}catch{}
  for(const pf of CORS_PROXIES){try{const r=await fetchT(pf(url),ms);if(r.ok)return r}catch{}}
  throw new Error('All sources failed')}
async function fetchClimateIndex(type){
  if(_climateIndices[type])return _climateIndices[type];
  try{
    if(type==='oni'){
      const r=await corsFetchT('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',15000);
      const t=await r.text();const lines=t.trim().split('\n').filter(l=>l.trim()&&!l.startsWith('SEAS'));
      const data=[];const mMap={DJF:1,JFM:2,FMA:3,MAM:4,AMJ:5,MJJ:6,JJA:7,JAS:8,ASO:9,SON:10,OND:11,NDJ:12};
      lines.forEach(l=>{const p=l.trim().split(/\s+/);if(p.length>=4){const yr=p[0],seas=p[1],anom=parseFloat(p[p.length-1]);
        if(!isNaN(anom)){const m=mMap[seas]||1;data.push({time:`${yr}-${String(m).padStart(2,'0')}-15`,value:anom})}}});
      _climateIndices.oni={nm:'ONI (ENSO)',data,u:'°C'};return _climateIndices.oni}
    if(type==='nao'){
      const r=await corsFetchT('https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.monthly.b5001.current.ascii',15000);
      const t=await r.text();const data=[];
      t.trim().split('\n').forEach(l=>{const p=l.trim().split(/\s+/);if(p.length>=3){const yr=p[0],mo=p[1],v=parseFloat(p[2]);
        if(!isNaN(v))data.push({time:`${yr}-${mo.padStart(2,'0')}-15`,value:v})}});
      _climateIndices.nao={nm:'NAO',data,u:'index'};return _climateIndices.nao}
    if(type==='pdo'){
      const r=await corsFetchT('https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat',15000);
      const t=await r.text();const data=[];
      t.trim().split('\n').forEach(l=>{const p=l.trim().split(/\s+/);if(p.length>=13&&!isNaN(parseInt(p[0]))){
        const yr=p[0];for(let m=1;m<=12;m++){const v=parseFloat(p[m]);if(!isNaN(v)&&v<90)data.push({time:`${yr}-${String(m).padStart(2,'0')}-15`,value:v})}}});
      _climateIndices.pdo={nm:'PDO',data,u:'index'};return _climateIndices.pdo}
  }catch(e){console.error('Climate index fetch error:',e);return null}}
function toggleClimateIndex(type){
  const btn=$('#idx-'+type);
  if(_activeIndices.has(type)){_activeIndices.delete(type);btn?.classList.remove('on');toast(type.toUpperCase()+' overlay removed','info')}
  else{_activeIndices.add(type);btn?.classList.add('on');fetchClimateIndex(type).then(()=>toast(type.toUpperCase()+' overlay ready — refetch to apply','ok'))}}
function renderClimateOverlays(chartId,chartData){
  if(!_activeIndices.size)return;
  const minT=chartData[0]?.time,maxT=chartData[chartData.length-1]?.time;
  if(!minT||!maxT)return;
  _activeIndices.forEach(type=>{
    const idx=_climateIndices[type];if(!idx?.data?.length)return;
    const filtered=idx.data.filter(d=>d.time>=minT&&d.time<=maxT);
    if(!filtered.length)return;
    try{Plotly.addTraces(chartId,[{x:filtered.map(d=>d.time),y:filtered.map(d=>d.value),type:'scatter',mode:'lines',
      line:{color:type==='oni'?'#D4A04A':type==='nao'?'#9B8EC4':'#6BA3C9',width:1.5,dash:'dashdot'},
      name:idx.nm,yaxis:'y2',opacity:0.7}]);
    const el=document.getElementById(chartId);if(el){Plotly.relayout(chartId,{yaxis2:{overlaying:'y',side:'right',showgrid:false,title:{text:idx.nm,font:{size:10}},color:type==='oni'?'#D4A04A':type==='nao'?'#9B8EC4':'#6BA3C9'}})}}catch{}})}

// ═══ LAG CROSS-CORRELATION PANEL ═══
function renderLagCorrPanel(tk){
  if(tk.length<2){H('#elagcorr','');return}
  const opts=tk.map(id=>`<option value="${id}">${S.envTS[id].nm}</option>`).join('');
  H('#elagcorr',`<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Lag Cross-Correlation</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none"><div class="lag-panel"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">A:</span><select class="fs" id="lagVarA">${opts}</select><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">B:</span><select class="fs" id="lagVarB">${tk.length>1?tk.map(id=>`<option value="${id}" ${id===tk[1]?'selected':''}>${S.envTS[id].nm}</option>`).join(''):opts}</select><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Max lag:</span><input type="number" class="fi" id="lagMax" value="30" style="width:60px" min="1" max="365"/><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">days</span><button class="bt on" onclick="computeLagCorr()">Compute</button></div><div class="pcc" id="lagCorrChart" style="height:280px"></div><div id="lagCorrResult" style="font-size:12px;font-family:var(--mf);color:var(--ts);margin-top:8px"></div></div></div></div>`)}
function computeLagCorr(){
  const idA=$('#lagVarA').value,idB=$('#lagVarB').value,maxLag=parseInt($('#lagMax').value)||30;
  if(!S.envTS[idA]||!S.envTS[idB]){toast('Select two variables with data','err');return}
  if(idA===idB){toast('Select different variables','err');return}
  const results=crossCorrelation(S.envTS[idA].data,S.envTS[idB].data,maxLag);
  if(!results.length){toast('Not enough overlapping data for lag analysis','err');return}
  const peak=results.reduce((best,r)=>Math.abs(r.r)>Math.abs(best.r)?r:best,results[0]);
  const colors=results.map(r=>r.lag===peak.lag?'var(--ac)':Math.abs(r.r)>0.5?'var(--sg)':'var(--tm)');
  Plotly.newPlot('lagCorrChart',[{x:results.map(r=>r.lag),y:results.map(r=>r.r),type:'bar',marker:{color:colors}}],
    {...PL,height:280,title:{text:`${S.envTS[idA].nm} vs ${S.envTS[idB].nm} — Lag Correlation`,font:{size:12}},
    xaxis:{...PL.xaxis,title:{text:'Lag (days)',font:{size:11}}},yaxis:{...PL.yaxis,title:{text:'Pearson r',font:{size:11}},range:[-1,1]}},{responsive:true});
  const leadText=peak.lag>0?`${S.envTS[idA].nm} leads ${S.envTS[idB].nm} by ${peak.lag} days`:peak.lag<0?`${S.envTS[idB].nm} leads ${S.envTS[idA].nm} by ${Math.abs(peak.lag)} days`:'Maximum at zero lag (simultaneous)';
  H('#lagCorrResult',`<span style="color:var(--ac);font-weight:700">Peak r = ${peak.r.toFixed(3)}</span> at lag = ${peak.lag} days (n=${peak.n}). ${leadText}.`)}

// ═══ SEASONALITY & CLIMATOLOGY ═══
function renderSeasonalityPanel(tk){
  if(!tk.length){H('#eseason','');return}
  const opts=tk.map(id=>`<option value="${id}">${S.envTS[id].nm}</option>`).join('');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  H('#eseason',`<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Seasonality & Climatology</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Variable:</span><select class="fs" id="seasonVar">${opts}</select><button class="bt on" onclick="runSeasonalDecomp()">Decompose</button><button class="bt sm" onclick="runClimatology()">Climatology</button></div><div class="season-ctrl"><span style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-right:4px">Plot by month:</span>${months.map((m,i)=>`<button class="season-month-btn" onclick="plotByMonth('${tk[0]}',${i+1},this)">${m}</button>`).join('')}</div><div class="pcc" id="seasonChart1" style="height:280px"></div><div class="pcc" id="seasonChart2" style="height:280px;display:none"></div><div class="pcc" id="seasonChart3" style="height:280px;display:none"></div></div></div>`)}
function runSeasonalDecomp(){
  const id=$('#seasonVar').value;if(!S.envTS[id])return;
  const data=S.envTS[id].data;const period=data.length>400?365:data.length>50?12:7;
  const result=seasonalDecompose(data,period);
  if(!result){toast('Not enough data for decomposition (need 2+ cycles)','err');return}
  const times=data.map(d=>d.time);
  sh('#seasonChart2');sh('#seasonChart3');
  Plotly.newPlot('seasonChart1',[{x:times,y:result.trend,type:'scatter',mode:'lines',line:{color:CL[0],width:2},name:'Trend'}],
    {...PL,height:280,title:{text:S.envTS[id].nm+' — Trend Component',font:{size:12}},xaxis:{...PL.xaxis,type:'date'}},{responsive:true});
  Plotly.newPlot('seasonChart2',[{x:times,y:result.seasonal,type:'scatter',mode:'lines',line:{color:CL[1],width:1.5},name:'Seasonal',fill:'tozeroy',fillcolor:CL[1]+'15'}],
    {...PL,height:280,title:{text:S.envTS[id].nm+' — Seasonal Component',font:{size:12}},xaxis:{...PL.xaxis,type:'date'}},{responsive:true});
  Plotly.newPlot('seasonChart3',[{x:times,y:result.residual,type:'scatter',mode:'lines',line:{color:CL[2],width:1},name:'Residual',fill:'tozeroy',fillcolor:CL[2]+'10'}],
    {...PL,height:280,title:{text:S.envTS[id].nm+' — Residual',font:{size:12}},xaxis:{...PL.xaxis,type:'date'}},{responsive:true})}
function runClimatology(){
  const id=$('#seasonVar').value;if(!S.envTS[id])return;
  const data=S.envTS[id].data;
  const byMonth={};data.forEach(d=>{const m=new Date(d.time).getMonth();if(!byMonth[m])byMonth[m]=[];byMonth[m].push(d.value)});
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const means=[],sds=[],lo=[],hi=[];
  for(let m=0;m<12;m++){const vs=byMonth[m]||[];const mean=vs.length?vs.reduce((a,v)=>a+v,0)/vs.length:0;
    const sd=vs.length>1?Math.sqrt(vs.reduce((a,v)=>a+(v-mean)**2,0)/vs.length):0;
    means.push(mean);sds.push(sd);lo.push(mean-sd);hi.push(mean+sd)}
  hi('#seasonChart2');hi('#seasonChart3');
  Plotly.newPlot('seasonChart1',[
    {x:months,y:hi,type:'scatter',mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip'},
    {x:months,y:lo,type:'scatter',mode:'lines',line:{width:0},fill:'tonexty',fillcolor:CL[0]+'20',showlegend:false,hoverinfo:'skip'},
    {x:months,y:means,type:'scatter',mode:'lines+markers',line:{color:CL[0],width:2.5},marker:{size:8},name:'Monthly Mean',
      error_y:{type:'data',array:sds,visible:true,color:CL[0]+'60'}}],
    {...PL,height:280,title:{text:S.envTS[id].nm+' — Monthly Climatology (mean ± 1σ)',font:{size:12}},
    xaxis:{...PL.xaxis},yaxis:{...PL.yaxis,title:{text:S.envTS[id].u,font:{size:11}}}},{responsive:true})}
function plotByMonth(defaultId,month,btn){
  const id=$('#seasonVar')?.value||defaultId;if(!S.envTS[id])return;
  $$('.season-month-btn').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');
  const data=S.envTS[id].data.filter(d=>new Date(d.time).getMonth()===month-1);
  if(!data.length){toast('No data for this month','err');return}
  const byYear={};data.forEach(d=>{const yr=new Date(d.time).getFullYear();if(!byYear[yr])byYear[yr]=[];byYear[yr].push(d.value)});
  const years=Object.keys(byYear).sort(),means=years.map(yr=>byYear[yr].reduce((a,v)=>a+v,0)/byYear[yr].length);
  hi('#seasonChart2');hi('#seasonChart3');
  const monthNames=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  Plotly.newPlot('seasonChart1',[{x:years,y:means,type:'scatter',mode:'lines+markers',line:{color:CL[0],width:2},marker:{size:6},name:monthNames[month]+' avg'}],
    {...PL,height:280,title:{text:`${S.envTS[id].nm} — All ${monthNames[month]}s by Year`,font:{size:12}},
    xaxis:{...PL.xaxis,title:{text:'Year',font:{size:11}}},yaxis:{...PL.yaxis,title:{text:S.envTS[id].u,font:{size:11}}}},{responsive:true})}

// ═══ ANNOTATIONS ═══
function getAnnotations(){return safeParse('meridian_env_annotations',[])}
function saveAnnotations(a){safeStore('meridian_env_annotations',a)}
function addAnnotation(varId){
  const date=prompt('Date (YYYY-MM-DD):');if(!date)return;
  const text=prompt('Note:');if(!text)return;
  const annots=getAnnotations();annots.push({id:'a'+Date.now(),date,text,varId,createdAt:new Date().toISOString()});
  saveAnnotations(annots);renderAnnotationsOnChart(varId);renderAnnotationsPanel(Object.keys(S.envTS));toast('Annotation added','ok')}
function deleteAnnotation(id){
  let annots=getAnnotations();annots=annots.filter(a=>a.id!==id);saveAnnotations(annots);
  Object.keys(S.envTS).forEach(vid=>renderAnnotationsOnChart(vid));renderAnnotationsPanel(Object.keys(S.envTS))}
function renderAnnotationsOnChart(varId){
  const el=document.getElementById('ep-'+varId);if(!el)return;
  const annots=getAnnotations().filter(a=>a.varId===varId);if(!annots.length)return;
  const shapes=annots.map(a=>({type:'line',x0:a.date,x1:a.date,y0:0,y1:1,yref:'paper',line:{color:'var(--wa)',width:1.5,dash:'dash'}}));
  const annotations=annots.map(a=>({x:a.date,y:1,yref:'paper',text:a.text,showarrow:true,arrowhead:2,arrowcolor:'var(--wa)',font:{size:10,color:'var(--wa)'},bgcolor:'var(--be)',bordercolor:'var(--wa)',borderwidth:1}));
  try{Plotly.relayout('ep-'+varId,{shapes,annotations})}catch{}}
function renderAnnotationsPanel(tk){
  if(!tk||!tk.length){H('#eannotations','');return}
  const annots=getAnnotations();const relevant=annots.filter(a=>tk.includes(a.varId));
  H('#eannotations',`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Annotations:</span>${tk.map(id=>`<button class="bt sm" onclick="addAnnotation('${id}')">+ ${S.envTS[id]?.nm||id}</button>`).join('')}${relevant.length?relevant.map(a=>`<span class="annot-pin">${a.date}: ${a.text.slice(0,20)}${a.text.length>20?'...':''} <span class="adel" onclick="deleteAnnotation('${a.id}')">×</span></span>`).join(''):''}</div>`)}

// ═══ DEPTH PROFILES ═══
async function fetchDepthProfiles(lat,lon,sel,date){
  const eV=sel.map(id=>EV.find(v=>v.id===id)).filter(v=>v&&v.src==='e'&&v.dm>=3);
  if(!eV.length){toast('Depth profiles require ERDDAP variables (SST, Chlor, etc.)','err');return}
  const multiZ=eV.filter(v=>!(v.z==='(0)'||v.z==='(0.0)'));
  if(!multiZ.length){toast('Depth profiles require multi-level datasets. Selected variables ('+eV.map(v=>v.nm).join(', ')+') are surface-only.','info');hi('#eprog');return}
  H('#edepthchart','');H('#echarts','');H('#esum','');H('#esyn','');H('#elagcorr','');H('#eseason','');hi('#eact');
  H('#eprog',`<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div class="fpb"><div class="fpbb" id="epb" style="width:50%"></div></div></div></div><div style="font-size:12px;color:var(--tm);font-family:var(--mf)">Fetching depth profiles...</div>`);sh('#eprog');
  let charts='';
  for(const v of multiZ){
    try{
      // Try fetching all depths — use z range
      const lonVal=v.lon360&&parseFloat(lon)<0?360+parseFloat(lon):lon;
      const url=`${v.server}/griddap/${v.ds}.json?${v.v}[(${date}T00:00:00Z)][(0):1:(5000)][(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
      const r=await erddapFetch(url,30000);
      if(!r.ok)continue;const d=await r.json();const rows=d.table?.rows||[];
      if(rows.length<2)continue;
      // rows format varies — depth is usually column 1 or 2
      const depthCol=d.table.columnNames?.indexOf('depth')??d.table.columnNames?.indexOf('zlev')??1;
      const valCol=rows[0].length-1;
      const profile=rows.map(r=>({depth:r[depthCol],value:r[valCol]})).filter(r=>r.value!=null&&r.depth!=null);
      if(!profile.length)continue;
      const cid='dp-'+v.id;charts+=`<div class="pcc depth-profile-chart" id="${cid}" style="height:350px"></div>`;
      setTimeout(()=>{Plotly.newPlot(cid,[{x:profile.map(p=>p.value),y:profile.map(p=>p.depth),type:'scatter',mode:'lines+markers',
        line:{color:CL[eV.indexOf(v)%8],width:2},marker:{size:4},name:v.nm}],
        {...PL,height:350,title:{text:v.nm+' Depth Profile — '+date,font:{size:12}},
        xaxis:{...PL.xaxis,title:{text:v.nm+' ('+v.u+')',font:{size:11}}},
        yaxis:{...PL.yaxis,autorange:'reversed',title:{text:'Depth (m)',font:{size:11}}}},{responsive:true})},100);
    }catch(e){console.error('Depth profile error for',v.id,e)}}
  hi('#eprog');
  if(charts)H('#edepthchart',`<div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:8px">Depth Profiles — ${lat}°N ${lon}°E — ${date}</div>`+charts);
  else H('#edepthchart','<div style="padding:20px;text-align:center;color:var(--co)">No depth profile data available for these variables/location. Depth profiles work best with gridded ocean datasets.</div>')}

// ═══ P2.6 MARINE HEATWAVE DETECTION ═══
function detectMHW(){
  if(!S.envTS.sst||!S.envTS.sst.data||S.envTS.sst.data.length<365){toast('Need at least 1 year of SST data for MHW detection','err');return}
  const data=S.envTS.sst.data.map(d=>({time:new Date(d.time),val:d.value})).filter(d=>!isNaN(d.val)&&d.time instanceof Date&&!isNaN(d.time));
  if(data.length<365){toast('Not enough valid SST data points','err');return}
  // Compute day-of-year climatology + 90th percentile threshold (Hobday et al. 2016)
  const byDOY={};data.forEach(d=>{const doy=Math.floor((d.time-new Date(d.time.getFullYear(),0,0))/(86400000));if(!byDOY[doy])byDOY[doy]=[];byDOY[doy].push(d.val)});
  const clim={},thresh={};
  for(let doy=1;doy<=366;doy++){const vals=[];for(let w=-5;w<=5;w++){const k=((doy+w-1+366)%366)+1;if(byDOY[k])vals.push(...byDOY[k])}
  if(vals.length<3){clim[doy]=vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:NaN;thresh[doy]=clim[doy];continue}
  vals.sort((a,b)=>a-b);clim[doy]=vals.reduce((a,v)=>a+v,0)/vals.length;thresh[doy]=vals[Math.floor(vals.length*0.9)]}
  // Detect events: consecutive days above threshold
  const events=[];let evt=null;
  data.forEach(d=>{const doy=Math.floor((d.time-new Date(d.time.getFullYear(),0,0))/(86400000))||1;const t90=thresh[doy]||thresh[1];const anom=d.val-(clim[doy]||clim[1]);
  if(d.val>t90){if(!evt)evt={start:d.time,end:d.time,maxInt:anom,cumInt:anom,days:1,maxVal:d.val};
  else{evt.end=d.time;evt.days++;evt.maxInt=Math.max(evt.maxInt,anom);evt.cumInt+=anom;evt.maxVal=Math.max(evt.maxVal,d.val)}}
  else{if(evt&&evt.days>=5)events.push(evt);evt=null}});
  if(evt&&evt.days>=5)events.push(evt);
  // Categorize (Hobday): I=moderate, II=strong, III=severe, IV=extreme
  events.forEach(e=>{const cat=e.maxInt>4*1?4:e.maxInt>3*1?3:e.maxInt>2*1?2:1;e.category=['I','II','III','IV'][cat-1];e.catName=['Moderate','Strong','Severe','Extreme'][cat-1];e.meanInt=(e.cumInt/e.days)});
  window._mhwEvents=events;
  // Render on SST chart
  const shapes=events.map(e=>{const catColors={I:'rgba(255,200,50,.2)',II:'rgba(255,150,50,.3)',III:'rgba(255,80,50,.3)',IV:'rgba(200,30,30,.4)'};
  return{type:'rect',xref:'x',yref:'paper',x0:e.start.toISOString(),x1:e.end.toISOString(),y0:0,y1:1,fillcolor:catColors[e.category]||'rgba(255,100,50,.2)',line:{width:0}}});
  const sstChart=$('#ep-sst');if(sstChart){Plotly.relayout(sstChart,{shapes})}
  // Summary
  let sumH=`<div class="sec" style="margin-top:14px"><div class="sh"><h4>Marine Heatwave Detection (Hobday et al. 2016)</h4></div><div class="sb">`;
  sumH+=`<div class="eg"><div class="ec"><div class="el">Events</div><div class="ev">${events.length}</div></div>`;
  if(events.length){const maxDur=Math.max(...events.map(e=>e.days));const maxInt=Math.max(...events.map(e=>e.maxInt));const cumI=events.reduce((s,e)=>s+e.cumInt,0);
  sumH+=`<div class="ec"><div class="el">Max Duration</div><div class="ev">${maxDur}<span class="eu">days</span></div></div>`;
  sumH+=`<div class="ec"><div class="el">Max Intensity</div><div class="ev">${maxInt.toFixed(2)}<span class="eu">°C</span></div></div>`;
  sumH+=`<div class="ec"><div class="el">Cumulative</div><div class="ev">${cumI.toFixed(1)}<span class="eu">°C·days</span></div></div></div>`}
  // Event table
  if(events.length){sumH+=`<table class="dt" style="margin-top:10px"><thead><tr><th>Start</th><th>End</th><th>Duration</th><th>Max Intensity</th><th>Mean Intensity</th><th>Category</th></tr></thead><tbody>`;
  events.forEach(e=>{sumH+=`<tr><td>${e.start.toISOString().split('T')[0]}</td><td>${e.end.toISOString().split('T')[0]}</td><td>${e.days} d</td><td>${e.maxInt.toFixed(2)}°C</td><td>${e.meanInt.toFixed(2)}°C</td><td style="color:${e.category==='IV'?'var(--co)':e.category==='III'?'var(--wa)':'var(--ts)'}">${e.category} (${e.catName})</td></tr>`});
  sumH+=`</tbody></table>`;sumH+=`<div style="margin-top:8px"><button class="bt sm" onclick="sendMHWToWS()">MHW Events → Workshop</button></div>`}
  sumH+=`</div></div>`;
  const mhwDiv=document.getElementById('env-mhw');if(mhwDiv)mhwDiv.innerHTML=sumH;else{const cont=document.getElementById('echarts');if(cont)cont.insertAdjacentHTML('afterend','<div id="env-mhw">'+sumH+'</div>')}}
// P3.8 MHW Export to Workshop
function sendMHWToWS(){if(!window._mhwEvents)return;S.wsC=['Event','Start','End','Duration_days','Max_Intensity_C','Mean_Intensity_C','Cumulative_C_days','Category'];
S.wsD=window._mhwEvents.map((e,i)=>({Event:i+1,Start:e.start.toISOString().split('T')[0],End:e.end.toISOString().split('T')[0],Duration_days:e.days,Max_Intensity_C:+e.maxInt.toFixed(2),Mean_Intensity_C:+e.meanInt.toFixed(2),Cumulative_C_days:+e.cumInt.toFixed(1),Category:e.category+' ('+e.catName+')'}));autoTypes();initWS();goTab('workshop')}
// ═══ P1.8 ARGO FLOAT PROFILES ═══
async function fetchArgoProfiles(){
  const lat=$('#elat').value,lon=$('#elon').value;
  if(!lat||!lon)return toast('Set coordinates first','err');
  toast('Searching for Argo floats near '+lat+'°N, '+lon+'°E...','info');
  const delta=2;const latMin=(+lat-delta).toFixed(2),latMax=(+lat+delta).toFixed(2),lonMin=(+lon-delta).toFixed(2),lonMax=(+lon+delta).toFixed(2);
  try{const r=await fetchT(`https://coastwatch.pfeg.noaa.gov/erddap/tabledap/ArgoFloats.json?platform_number,latitude,longitude,time,temp,psal,pres&latitude>=${latMin}&latitude<=${latMax}&longitude>=${lonMin}&longitude<=${lonMax}&orderByMax("time")&distinct()`,20000);
  if(!r.ok){toast('No Argo data found in this area','info');return}
  const d=await r.json();const rows=d.table?.rows||[];
  if(!rows.length){toast('No Argo profiles found','info');return}
  // Parse profiles
  const temps=rows.map(r=>r[4]).filter(v=>v!=null);const sals=rows.map(r=>r[5]).filter(v=>v!=null);const pres=rows.map(r=>r[6]).filter(v=>v!=null);
  if(!temps.length){toast('No Argo T/S data found','info');return}
  let h=`<div class="sec" style="margin-top:14px"><div class="sh"><h4>Argo Float Profiles (${rows.length} measurements near ${lat}°N ${lon}°E)</h4></div><div class="sb">`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
  h+=`<div class="pcc" id="argo-temp-prof" style="height:300px"></div>`;
  h+=`<div class="pcc" id="argo-ts-diagram" style="height:300px"></div>`;
  h+=`</div></div></div>`;
  const cont=document.getElementById('edepthchart')||document.getElementById('echarts');
  if(cont)cont.insertAdjacentHTML('afterend',h);
  setTimeout(()=>{
    if($('#argo-temp-prof'))Plotly.newPlot('argo-temp-prof',[{x:temps,y:pres,type:'scatter',mode:'markers',marker:{size:4,color:temps,colorscale:'RdBu',reversescale:true,showscale:true,colorbar:{title:'°C',len:.8}},name:'Temperature'}],{...PL,height:300,title:{text:'Temperature Profile',font:{size:12}},xaxis:{...PL.xaxis,title:'Temperature (°C)'},yaxis:{...PL.yaxis,autorange:'reversed',title:'Pressure (dbar)'}},{responsive:true});
    if($('#argo-ts-diagram')&&sals.length)Plotly.newPlot('argo-ts-diagram',[{x:sals,y:temps,type:'scatter',mode:'markers',marker:{size:5,color:pres,colorscale:'Viridis',showscale:true,colorbar:{title:'dbar',len:.8}},name:'T-S'}],{...PL,height:300,title:{text:'T-S Diagram',font:{size:12}},xaxis:{...PL.xaxis,title:'Salinity (PSU)'},yaxis:{...PL.yaxis,title:'Temperature (°C)'}},{responsive:true});
  },150);toast(`Found ${rows.length} Argo measurements`,'ok')}catch(e){toast('Argo fetch error: '+e.message,'err')}}
// ═══ REPRODUCIBLE EXPORT ═══
function dlReproScript(lang){
  const lat=$('#elat').value,lon=$('#elon').value,df=$('#edf').value,dt=$('#edt').value;
  const mode=$('#emode').value;const tk=Object.keys(S.envTS);
  if(lang==='python'){
    let sc=`#!/usr/bin/env python3
"""Meridian Reproducibility Script
Generated: ${new Date().toISOString()}
Location: ${lat}N, ${lon}E
Date Range: ${df||'latest'} to ${dt||'latest'}
"""
import requests
import pandas as pd
from io import StringIO

results = {}
`;
    if(_polygonMode==='cut'&&_envPolygon)sc+=`\n# Polygon boundary (Cut mode — ${_envPolygon.length} vertices)\npolygon = ${JSON.stringify(_envPolygon.map(v=>[+v[0].toFixed(4),+v[1].toFixed(4)]))}\n# Clip: pip install shapely; from shapely.geometry import Polygon, Point\n# poly = Polygon([(lon, lat) for lat, lon in polygon])\n# df_clipped = df[df.apply(lambda r: poly.contains(Point(r.longitude, r.latitude)), axis=1)]\n`;
    tk.forEach(id=>{const v=EV.find(x=>x.id===id);if(!v)return;
      if(v.src==='e'){
        const lonVal=v.lon360&&parseFloat(lon)<0?360+parseFloat(lon):lon;
        const tQ=mode==='latest'?'[(last)]':`[(${df}T00:00:00Z):1:(${dt}T00:00:00Z)]`;
        const zQ=v.dm===4?`[(${v.z||'0'})]`:'';
        sc+=`\n# ${v.nm}\nurl_${v.id} = "${v.server}/griddap/${v.ds}.csv?${v.v}${tQ}${zQ}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]"\nr = requests.get(url_${v.id}, timeout=30)\nif r.ok:\n    results['${v.nm}'] = pd.read_csv(StringIO(r.text), skiprows=[1])\n    print(f"${v.nm}: {len(results['${v.nm}'])} rows")\n`}
      else if(v.src==='m'){
        sc+=`\n# ${v.nm} (Open-Meteo Marine)\nurl_${v.id} = "https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${v.p}&start_date=${df}&end_date=${dt}"\nr = requests.get(url_${v.id}, timeout=20)\nif r.ok:\n    d = r.json()\n    results['${v.nm}'] = pd.DataFrame({'time': d['hourly']['time'], '${v.nm}': d['hourly']['${v.p}']})\n    print(f"${v.nm}: {len(results['${v.nm}'])} rows")\n`}
      else if(v.src==='w'){
        const base=df&&(new Date()-new Date(df))/(86400000)>90?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast';
        sc+=`\n# ${v.nm} (Open-Meteo Weather)\nurl_${v.id} = "${base}?latitude=${lat}&longitude=${lon}&hourly=${v.p}&start_date=${df}&end_date=${dt}"\nr = requests.get(url_${v.id}, timeout=20)\nif r.ok:\n    d = r.json()\n    results['${v.nm}'] = pd.DataFrame({'time': d['hourly']['time'], '${v.nm}': d['hourly']['${v.p}']})\n    print(f"${v.nm}: {len(results['${v.nm}'])} rows")\n`}
      else if(v.src==='co2'){sc+=`\n# CO2 (NOAA Mauna Loa)\nurl_co2 = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv"\nresults['CO2'] = pd.read_csv(url_co2, comment='#')\nprint(f"CO2: {len(results['CO2'])} rows")\n`}});
    sc+=`\nprint("\\nDone. Available datasets:", list(results.keys()))\n`;
    dl(sc,`meridian_repro_${df||'latest'}.py`,'text/x-python')}
  else if(lang==='r'){
    let sc=`# Meridian Reproducibility Script (R)
# Generated: ${new Date().toISOString()}
# Location: ${lat}N, ${lon}E
# Date Range: ${df||'latest'} to ${dt||'latest'}

library(httr)
library(readr)

results <- list()
`;
    if(_polygonMode==='cut'&&_envPolygon)sc+=`\n# Polygon boundary (Cut mode — ${_envPolygon.length} vertices)\npolygon_lat <- c(${_envPolygon.map(v=>v[0].toFixed(4)).join(', ')})\npolygon_lon <- c(${_envPolygon.map(v=>v[1].toFixed(4)).join(', ')})\n# Clip: library(sf); poly_sf <- st_polygon(list(cbind(polygon_lon, polygon_lat)))\n`;
    tk.forEach(id=>{const v=EV.find(x=>x.id===id);if(!v)return;
      if(v.src==='e'){
        const lonVal=v.lon360&&parseFloat(lon)<0?360+parseFloat(lon):lon;
        const tQ=mode==='latest'?'[(last)]':`[(${df}T00:00:00Z):1:(${dt}T00:00:00Z)]`;
        const zQ=v.dm===4?`[(${v.z||'0'})]`:'';
        sc+=`\n# ${v.nm}\nurl_${v.id} <- "${v.server}/griddap/${v.ds}.csv?${v.v}${tQ}${zQ}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]"\ntryCatch({\n  r <- GET(url_${v.id}, timeout(30))\n  if (status_code(r) == 200) {\n    results[["${v.nm}"]] <- read_csv(content(r, "text"), skip = 1, show_col_types = FALSE)\n    cat("${v.nm}:", nrow(results[["${v.nm}"]]), "rows\\n")\n  }\n}, error = function(e) cat("${v.nm}: failed -", e$message, "\\n"))\n`}
      else if(v.src==='w'||v.src==='m'){
        const base=v.src==='m'?'https://marine-api.open-meteo.com/v1/marine':(df&&(new Date()-new Date(df))/(86400000)>90?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast');
        sc+=`\n# ${v.nm}\nurl_${v.id} <- "${base}?latitude=${lat}&longitude=${lon}&hourly=${v.p}&start_date=${df}&end_date=${dt}"\ntryCatch({\n  r <- GET(url_${v.id}, timeout(20))\n  if (status_code(r) == 200) {\n    d <- content(r, "parsed")\n    results[["${v.nm}"]] <- data.frame(time = unlist(d$hourly$time), value = unlist(d$hourly[["${v.p}"]]))\n    cat("${v.nm}:", nrow(results[["${v.nm}"]]), "rows\\n")\n  }\n}, error = function(e) cat("${v.nm}: failed -", e$message, "\\n"))\n`}});
    sc+=`\ncat("\\nDone. Available datasets:", paste(names(results), collapse=", "), "\\n")\n`;
    dl(sc,`meridian_repro_${df||'latest'}.R`,'text/x-r')}}

// ═══ TASK 6: CMIP6 CLIMATE PROJECTIONS ═══
// Open-Meteo Climate API: 7 CMIP6 HighResMIP models, all ~SSP5-8.5/RCP8.5, range 1950-2050
const _CMIP6_MODELS=['CMCC_CM2_VHR4','FGOALS_f3_H','HiRAM_SIT_HR','MRI_AGCM3_2_S','EC_Earth3P_HR','MPI_ESM1_2_XR','NICAM16_8S'];
const _CMIP6_COLORS=['#C9956B','#5B8FA8','#7B9E87','#9B8EC4','#D4A04A','#6BA3C9','#C27878'];

async function fetchCMIP6Projection(){
  const lat=parseFloat($('#elat')?.value),lon=parseFloat($('#elon')?.value);
  if(isNaN(lat)||isNaN(lon))return toast('Set coordinates on the map first','err');

  const chartEl=$('#cmip6-chart');const interpEl=$('#cmip6-interp');
  if(chartEl)chartEl.innerHTML=mkL();

  try{
    const modelParam=_CMIP6_MODELS.join(',');
    const url=`https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&start_date=2024-01-01&end_date=2050-12-31&models=${modelParam}&daily=temperature_2m_mean`;

    const r=await fetchT(url,30000);
    if(!r.ok){toast('CMIP6 fetch failed (HTTP '+r.status+')','err');if(chartEl)chartEl.innerHTML='';return}
    const data=await r.json();

    const times=data.daily?.time||[];
    const traces=[];const annualByModel={};

    // Process each model's daily data into annual means
    for(const key of Object.keys(data.daily||{})){
      if(key==='time')continue;
      const modelName=key.replace('temperature_2m_mean_','');
      const vals=data.daily[key]||[];
      if(!vals.length)continue;

      const byYear={};
      times.forEach((t,i)=>{
        if(vals[i]==null)return;
        const yr=parseInt(t.split('-')[0]);
        if(!byYear[yr])byYear[yr]=[];
        byYear[yr].push(vals[i]);
      });

      const annual=Object.entries(byYear).map(([yr,vs])=>({
        year:parseInt(yr),mean:vs.reduce((s,v)=>s+v,0)/vs.length
      })).sort((a,b)=>a.year-b.year);

      if(annual.length){
        const mi=_CMIP6_MODELS.findIndex(m=>key.includes(m));
        traces.push({
          x:annual.map(d=>d.year),y:annual.map(d=>d.mean),
          mode:'lines',name:modelName.replace(/_/g,' '),
          line:{color:_CMIP6_COLORS[mi>=0?mi:traces.length%7],width:1.5},
          type:'scatter'
        });
        annualByModel[modelName]=annual;
      }
    }

    // Compute ensemble mean ± 1σ
    const modelKeys=Object.keys(annualByModel);
    if(modelKeys.length>=2){
      const allYears=[...new Set(modelKeys.flatMap(k=>annualByModel[k].map(d=>d.year)))].sort((a,b)=>a-b);
      const ensMean=[],ensHi=[],ensLo=[];
      allYears.forEach(yr=>{
        const vals=modelKeys.map(k=>annualByModel[k].find(d=>d.year===yr)?.mean).filter(v=>v!=null);
        if(!vals.length)return;
        const m=vals.reduce((s,v)=>s+v,0)/vals.length;
        const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-m)**2,0)/vals.length);
        ensMean.push({year:yr,mean:m});ensHi.push({year:yr,val:m+sd});ensLo.push({year:yr,val:m-sd});
      });
      // Envelope
      traces.unshift({x:ensMean.map(d=>d.year),y:ensHi.map(d=>d.val),mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip',type:'scatter'});
      traces.splice(1,0,{x:ensMean.map(d=>d.year),y:ensLo.map(d=>d.val),mode:'lines',line:{width:0},fill:'tonexty',fillcolor:'rgba(201,149,107,0.12)',name:'±1σ range',showlegend:true,type:'scatter'});
      traces.splice(2,0,{x:ensMean.map(d=>d.year),y:ensMean.map(d=>d.mean),mode:'lines',line:{color:'#fff',width:2.5},name:'Ensemble mean',type:'scatter'});
    }

    if(!traces.length){
      if(chartEl)chartEl.innerHTML='<div style="color:var(--tm);font-size:12px;padding:20px;text-align:center">No projection data available for this location.</div>';
      return;
    }

    if(chartEl){
      chartEl.innerHTML='';
      Plotly.newPlot(chartEl,traces,{
        ...PL,
        title:{text:`CMIP6 temperature projection — ${lat.toFixed(1)}°${lat>=0?'N':'S'} ${Math.abs(lon).toFixed(1)}°${lon>=0?'E':'W'} (${modelKeys.length} models)`,font:{size:12}},
        xaxis:{...PL.xaxis,title:'Year',range:[2024,2050]},
        yaxis:{...PL.yaxis,title:'Temperature (°C)'},
        height:350
      },{responsive:true});
    }

    if(interpEl&&modelKeys.length>=2){
      const lastYearVals=modelKeys.map(k=>{const a=annualByModel[k];return a[a.length-1]?.mean}).filter(v=>v!=null);
      const meanEnd=lastYearVals.reduce((s,v)=>s+v,0)/lastYearVals.length;
      const spread=(Math.max(...lastYearVals)-Math.min(...lastYearVals)).toFixed(1);
      interpEl.style.display='';
      interpEl.innerHTML=`Ensemble of ${modelKeys.length} CMIP6 HighResMIP models (≈SSP5-8.5). By 2050, mean projected temperature is <b>${meanEnd.toFixed(1)}°C</b> (model spread: ${spread}°C).`;
    }

    stampProvenance('cmip6',{server:'climate-api.open-meteo.com',dataset:'CMIP6 HighResMIP '+modelKeys.join(', '),
      variable:'temperature_2m_mean',lat,lon,from:'2024-01-01',to:'2050-12-31',source:'Open-Meteo Climate API (CMIP6)'});
    toast('Climate projections loaded ('+modelKeys.length+' models)','ok');
  }catch(e){
    toast('CMIP6 fetch error: '+e.message,'err');
    if(chartEl)chartEl.innerHTML='';
  }
}

// ═══ TASK 14 — Species Distribution Modelling (Bioclimatic Envelope) ═══

async function modelDistribution() {
  const sp = window._sp;
  if (!sp) return toast('No species data loaded', 'err');
  const occ = [...(sp.gbifOcc || []), ...(sp.obisOcc || [])];
  if (!occ.length) return toast('No occurrence records available', 'err');
  const envKeys = Object.keys(S.envR || {});
  if (!envKeys.length) return toast('No environmental data — fetch variables in the Env Data tab first', 'err');

  const el = $('#sp-sdm-results');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tm);font-size:12px;font-family:var(--mf)">Building envelope model...</div>';

  try {
    // Extract environmental envelope from occurrence points
    const envelope = extractEnvelope(occ, S.envR, envKeys);
    if (!envelope || !Object.keys(envelope).length) {
      el.innerHTML = '<div style="color:var(--co);font-size:12px">Could not extract environmental envelope from occurrences.</div>';
      return;
    }

    // Build prediction grid
    const grid = predictHabitat(envelope, occ, envKeys);

    // Render results
    _renderSDMResults(el, envelope, grid, sp.sciName, occ.length);

    // Render map overlay
    _renderSDMOverlay(grid, sp.sciName);

  } catch (e) {
    console.error('SDM error', e);
    el.innerHTML = `<div style="color:var(--co);font-size:12px">Model error: ${escHTML(e.message)}</div>`;
  }
}

function extractEnvelope(occ, envR, envKeys) {
  // For each env variable, find the range observed at occurrence locations
  // We use a simplified approach: the env data represents conditions at the fetched location/time,
  // and we characterize the species' tolerance from occurrence lat/lon distributions + available env values
  const envelope = {};

  // Extract occurrence coordinate stats for spatial envelope
  const lats = occ.map(o => parseFloat(o.lat || o.decimalLatitude)).filter(v => !isNaN(v));
  const lons = occ.map(o => parseFloat(o.lon || o.decimalLongitude)).filter(v => !isNaN(v));
  if (!lats.length) return null;

  lats.sort((a, b) => a - b);
  lons.sort((a, b) => a - b);

  envelope._spatial = {
    latMin: _percentile(lats, 5), latMax: _percentile(lats, 95),
    lonMin: _percentile(lons, 5), lonMax: _percentile(lons, 95),
    latMean: lats.reduce((a, b) => a + b, 0) / lats.length,
    lonMean: lons.reduce((a, b) => a + b, 0) / lons.length
  };

  // For each env variable, extract the value range
  envKeys.forEach(key => {
    const ev = envR[key];
    if (!ev) return;
    // Use timeseries data if available
    let values = [];
    if (ev.ts && ev.ts.length) {
      values = ev.ts.map(p => parseFloat(p.v || p.value)).filter(v => !isNaN(v));
    } else if (ev.value != null && !isNaN(parseFloat(ev.value))) {
      values = [parseFloat(ev.value)];
    }
    if (!values.length) return;

    values.sort((a, b) => a - b);
    envelope[key] = {
      name: ev.nm || key,
      unit: ev.u || '',
      min: values[0],
      max: values[values.length - 1],
      p5: _percentile(values, 5),
      p95: _percentile(values, 95),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      sd: _stdDev(values)
    };
  });

  return envelope;
}

function _percentile(sorted, pct) {
  const idx = (pct / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function _stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function predictHabitat(envelope, occ, envKeys) {
  // Generate a grid around occurrence extent and score suitability
  const sp = envelope._spatial;
  if (!sp) return [];

  // Expand grid 20% beyond occurrence range
  const latPad = (sp.latMax - sp.latMin) * 0.2 || 2;
  const lonPad = (sp.lonMax - sp.lonMin) * 0.2 || 2;
  const latMin = Math.max(-90, sp.latMin - latPad);
  const latMax = Math.min(90, sp.latMax + latPad);
  const lonMin = Math.max(-180, sp.lonMin - lonPad);
  const lonMax = Math.min(180, sp.lonMax + lonPad);

  // Resolution: ~50x50 grid
  const latStep = Math.max((latMax - latMin) / 50, 0.1);
  const lonStep = Math.max((lonMax - lonMin) / 50, 0.1);

  const grid = [];
  const envVars = envKeys.filter(k => envelope[k]);

  for (let lat = latMin; lat <= latMax; lat += latStep) {
    for (let lon = lonMin; lon <= lonMax; lon += lonStep) {
      // Score based on spatial distance to occurrence centroid + env envelope
      let score = 1.0;
      let factors = 0;

      // Spatial component: distance from centroid relative to range
      const latRange = sp.latMax - sp.latMin || 1;
      const lonRange = sp.lonMax - sp.lonMin || 1;
      const latDist = Math.abs(lat - sp.latMean) / latRange;
      const lonDist = Math.abs(lon - sp.lonMean) / lonRange;
      const spatialDist = Math.sqrt(latDist ** 2 + lonDist ** 2);

      if (spatialDist <= 0.5) { score *= 1.0; }
      else if (spatialDist <= 1.0) { score *= Math.max(0, 1.0 - (spatialDist - 0.5)); }
      else { score *= Math.max(0, 0.5 - (spatialDist - 1.0) * 0.3); }
      factors++;

      // Environmental component: how well grid cell matches env envelope
      // Since we only have env data at the fetched point, we use the envelope ranges
      // as tolerance bounds — cells within the spatial range are scored by env suitability
      envVars.forEach(key => {
        const env = envelope[key];
        if (!env || env.sd === 0) return;
        // Latitude-based env estimation (simple linear interpolation)
        const latFrac = (lat - latMin) / (latMax - latMin || 1);
        // Use spatial position to estimate how env varies (gradient assumption)
        const estValue = env.mean + (latFrac - 0.5) * env.sd * 2;
        if (estValue >= env.p5 && estValue <= env.p95) {
          score *= 1.0; // Within core envelope
        } else if (estValue >= env.min - env.sd && estValue <= env.max + env.sd) {
          score *= 0.5; // Within extended envelope
        } else {
          score *= 0.1; // Outside envelope
        }
        factors++;
      });

      if (factors > 0) score = Math.max(0, Math.min(1, score));
      grid.push({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, suitability: Math.round(score * 100) / 100 });
    }
  }

  return grid;
}

function _renderSDMOverlay(grid, speciesName) {
  goTab('env');
  setTimeout(() => {
    if (!_envMap) { toast('Map not initialized', 'err'); return; }

    // Remove existing SDM layer
    if (window._sdmLayer) { _envMap.removeLayer(window._sdmLayer); }

    const rects = [];
    const latStep = grid.length > 1 ? Math.abs(grid[1].lat - grid[0].lat) || 0.5 : 0.5;
    const lonStep = grid.length > 1 ? Math.abs(grid[grid.length > 50 ? 1 : 0].lon - grid[0].lon) || 0.5 : 0.5;

    grid.forEach(cell => {
      if (cell.suitability < 0.1) return; // Skip very low
      const color = cell.suitability >= 0.7 ? '#2d8a4e' :
                    cell.suitability >= 0.4 ? '#a3c44a' :
                    '#e8d44d';
      const opacity = 0.15 + cell.suitability * 0.45;
      const rect = L.rectangle(
        [[cell.lat - latStep / 2, cell.lon - lonStep / 2], [cell.lat + latStep / 2, cell.lon + lonStep / 2]],
        { color: 'none', weight: 0, fillColor: color, fillOpacity: opacity }
      ).bindPopup(`<div style="font-size:11px"><b>Suitability:</b> ${(cell.suitability * 100).toFixed(0)}%<br><b>Lat:</b> ${cell.lat}° <b>Lon:</b> ${cell.lon}°</div>`);
      rects.push(rect);
    });

    window._sdmLayer = L.layerGroup(rects).addTo(_envMap);

    // Fit bounds to grid
    const lats = grid.map(g => g.lat), lons = grid.map(g => g.lon);
    if (lats.length) _envMap.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [20, 20] });

    toast('Distribution model overlay added to map', 'ok');

    // Add toggle button
    if (!$('#ml-sdm')) {
      const toolRow = $('.map-toolbar-row');
      if (toolRow) {
        const btn = document.createElement('button');
        btn.className = 'bt sm on';
        btn.id = 'ml-sdm';
        btn.textContent = 'SDM';
        btn.title = 'Toggle species distribution model overlay';
        btn.onclick = () => {
          if (_envMap.hasLayer(window._sdmLayer)) {
            _envMap.removeLayer(window._sdmLayer);
            btn.classList.remove('on');
          } else {
            window._sdmLayer.addTo(_envMap);
            btn.classList.add('on');
          }
        };
        const layersGroup = toolRow.querySelector('.ctrl-group');
        if (layersGroup) layersGroup.appendChild(btn);
      }
    }

    // Add legend
    if (!$('#sdm-legend')) {
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', '');
        div.id = 'sdm-legend';
        div.innerHTML = `<div style="background:var(--bs);padding:8px 10px;border-radius:6px;border:1px solid var(--bd);font-size:10px;font-family:var(--mf)">
          <div style="font-weight:600;margin-bottom:4px;color:var(--ts)">${escHTML(speciesName)} — Envelope SDM</div>
          <div style="display:flex;align-items:center;gap:4px;margin:2px 0"><span style="width:14px;height:10px;background:#2d8a4e;display:inline-block;border-radius:2px"></span><span style="color:var(--tm)">High (≥70%)</span></div>
          <div style="display:flex;align-items:center;gap:4px;margin:2px 0"><span style="width:14px;height:10px;background:#a3c44a;display:inline-block;border-radius:2px"></span><span style="color:var(--tm)">Medium (40-70%)</span></div>
          <div style="display:flex;align-items:center;gap:4px;margin:2px 0"><span style="width:14px;height:10px;background:#e8d44d;display:inline-block;border-radius:2px"></span><span style="color:var(--tm)">Low (10-40%)</span></div>
        </div>`;
        return div;
      };
      legend.addTo(_envMap);
    }
  }, 300);
}

function _renderSDMResults(el, envelope, grid, speciesName, nOcc) {
  const envVars = Object.keys(envelope).filter(k => k !== '_spatial');
  const suitable = grid.filter(c => c.suitability >= 0.5).length;
  const pctSuitable = grid.length ? ((suitable / grid.length) * 100).toFixed(1) : 0;

  let html = `<div style="margin-top:10px">`;

  // Caveat
  html += _sdmCaveatHTML();

  // Summary
  html += `<div class="eg" style="margin:10px 0">
    <div class="ec"><div class="el">Occurrences used</div><div class="ev">${nOcc}</div></div>
    <div class="ec"><div class="el">Env variables</div><div class="ev">${envVars.length}</div></div>
    <div class="ec"><div class="el">Grid cells</div><div class="ev">${grid.length}</div></div>
    <div class="ec"><div class="el">Suitable area</div><div class="ev" style="color:var(--ac)">${pctSuitable}%</div></div>
  </div>`;

  // Envelope table
  if (envVars.length) {
    html += `<h5 style="font-size:12px;color:var(--tm);font-family:var(--mf);margin:10px 0 6px">Environmental Envelope</h5>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--mf)">
      <thead><tr>
        <th style="text-align:left;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">Variable</th>
        <th style="text-align:right;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">P5</th>
        <th style="text-align:right;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">Mean</th>
        <th style="text-align:right;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">P95</th>
        <th style="text-align:right;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">SD</th>
        <th style="text-align:left;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">Unit</th>
      </tr></thead><tbody>${envVars.map(k => {
        const v = envelope[k];
        return `<tr>
          <td style="padding:3px 8px;color:var(--ts)">${escHTML(v.name)}</td>
          <td style="padding:3px 8px;color:var(--ts);text-align:right">${v.p5.toFixed(2)}</td>
          <td style="padding:3px 8px;color:var(--ac);text-align:right;font-weight:600">${v.mean.toFixed(2)}</td>
          <td style="padding:3px 8px;color:var(--ts);text-align:right">${v.p95.toFixed(2)}</td>
          <td style="padding:3px 8px;color:var(--tm);text-align:right">${v.sd.toFixed(2)}</td>
          <td style="padding:3px 8px;color:var(--tm)">${escHTML(v.unit)}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // Spatial extent
  const sp = envelope._spatial;
  if (sp) {
    html += `<h5 style="font-size:12px;color:var(--tm);font-family:var(--mf);margin:10px 0 6px">Spatial Envelope (5th–95th percentile)</h5>
    <div class="eg">
      <div class="ec"><div class="el">Latitude</div><div class="ev">${sp.latMin.toFixed(2)}° – ${sp.latMax.toFixed(2)}°</div></div>
      <div class="ec"><div class="el">Longitude</div><div class="ev">${sp.lonMin.toFixed(2)}° – ${sp.lonMax.toFixed(2)}°</div></div>
    </div>`;
  }

  // Interpretation
  html += `<div style="margin-top:10px;padding:10px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);font-size:12px;color:var(--ts);line-height:1.5">
    <b>Interpretation:</b> Based on ${nOcc} occurrence records and ${envVars.length} environmental variable${envVars.length !== 1 ? 's' : ''},
    approximately <b>${pctSuitable}%</b> of the modelled area shows moderate-to-high habitat suitability for <i>${escHTML(speciesName)}</i>.
    ${parseFloat(pctSuitable) > 50 ? 'The species appears to have broad environmental tolerance within this region.' :
      parseFloat(pctSuitable) > 20 ? 'Suitable habitat is patchy — the species may be restricted to specific environmental conditions.' :
      'Very limited suitable habitat predicted — the species may have narrow environmental requirements.'}
    The overlay has been added to the Env Data map.
  </div>`;

  html += `</div>`;
  el.innerHTML = html;
}

function _sdmCaveatHTML() {
  return `<div style="padding:10px;background:rgba(212,160,74,.1);border:1px solid rgba(212,160,74,.3);border-radius:var(--rd);margin-bottom:10px">
    <div style="font-size:12px;color:var(--wa);font-family:var(--mf);font-weight:600;margin-bottom:4px">Simplified Model — Use With Caution</div>
    <div style="font-size:11px;color:var(--ts);line-height:1.5">This is a bioclimatic envelope model (BIOCLIM-style). It does <b>not</b> account for dispersal barriers, biotic interactions, species adaptation, habitat fragmentation, or sampling bias. It assumes equilibrium between species distribution and current climate. Suitable for exploratory analysis and hypothesis generation — not for conservation planning without further validation.</div>
  </div>`;
}
