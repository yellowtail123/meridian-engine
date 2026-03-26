// ═══════════════════════════════════════════════════════════════════
// MERIDIAN ENGINE — Research Projects System (Phase 1–3)
// State, switcher, CRUD, tab scoping, dashboard, activity, species
// ═══════════════════════════════════════════════════════════════════

const MeridianProjects=(function(){
'use strict';

// ── Constants ──
const MAX_FREE_PROJECTS=5;
const PROJECT_COLORS={
  amber:{bg:'rgba(201,149,107,.15)',fg:'#C9956B',ring:'rgba(201,149,107,.4)'},
  teal:{bg:'rgba(94,186,172,.15)',fg:'#5EBAAC',ring:'rgba(94,186,172,.4)'},
  rose:{bg:'rgba(194,120,120,.15)',fg:'#C27878',ring:'rgba(194,120,120,.4)'},
  violet:{bg:'rgba(155,142,196,.15)',fg:'#9B8EC4',ring:'rgba(155,142,196,.4)'},
  emerald:{bg:'rgba(123,158,135,.15)',fg:'#7B9E87',ring:'rgba(123,158,135,.4)'},
  sky:{bg:'rgba(107,163,201,.15)',fg:'#6BA3C9',ring:'rgba(107,163,201,.4)'},
  orange:{bg:'rgba(212,160,74,.15)',fg:'#D4A04A',ring:'rgba(212,160,74,.4)'},
  fuchsia:{bg:'rgba(201,107,163,.15)',fg:'#C96BA3',ring:'rgba(201,107,163,.4)'}
};
const ICONS=['🐢','🐬','🐋','🦈','🐙','🐠','🪸','🌊','🏝️','🧬','🔬','🌡️','📊','🗺️','🦑','🐟','🦐','🪼','🐚','🌿','🧪','🎓','📝','🔍'];

// ── State ──
let _projects=[];
let _activeId=null;
let _switcherOpen=false;
let _initialized=false;
let _projectPaperIds=new Set();   // paper IDs in active project
let _focusSpecies=[];             // species for active project
let _projectActivity=[];          // activity for active project
let _crossProjectSearch=false;    // cross-project search toggle

// ── Helpers ──
function _col(c){return PROJECT_COLORS[c]||PROJECT_COLORS.amber}
function _active(){return _projects.find(p=>p.id===_activeId)||_projects.find(p=>p.is_default)||_projects[0]||null}
function _nonArchived(){return _projects.filter(p=>!p.is_archived)}
function _isSignedIn(){return typeof _supaUser!=='undefined'&&_supaUser}
function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _timeAgo(iso){const d=Date.now()-new Date(iso).getTime();if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';if(d<604800000)return Math.floor(d/86400000)+'d ago';return new Date(iso).toLocaleDateString()}
const _actionIcons={paper_added:'📄',paper_removed:'📄',species_searched:'🐟',annotation_saved:'📌',data_fetched:'🌊',ai_chat_started:'✨',search_performed:'🔍',prisma_updated:'📊',species_added:'🧬',species_removed:'🧬'};

// ═══ INITIALIZATION ═══
async function init(){
  if(_initialized)return;
  _initialized=true;
  const savedId=safeParse('meridian_active_project_id',null);

  if(_isSignedIn()){
    await _fetchProjects();
  }else{
    _loadLocalProjects();
  }

  if(savedId&&_projects.find(p=>p.id===savedId)){
    _activeId=savedId;
  }else{
    const def=_projects.find(p=>p.is_default);
    _activeId=def?def.id:(_projects[0]?.id||null);
  }

  if(!_projects.length){
    const gen=_createLocalProject('General','Default project for general research','🔬','amber',true);
    _projects.push(gen);
    _activeId=gen.id;
    _saveLocalProjects();
  }

  // Legacy migration
  if(typeof S!=='undefined'&&S.activeProject&&typeof S.activeProject==='string'&&S.activeProject!=='Default'){
    const match=_projects.find(p=>p.name===S.activeProject);
    if(match)_activeId=match.id;
  }

  _persistActiveId();
  _renderSwitcher();
  _syncActiveProjectToLegacy();
  _applyProjectColor();
  await _loadProjectPapers();
  _loadFocusSpecies();
  _loadProjectActivity();
}

async function onSignIn(){
  _initialized=false;
  await init();
}

// ═══ SUPABASE FETCH ═══
async function _fetchProjects(){
  if(!_isSignedIn()||typeof SB==='undefined')return;
  try{
    const{data,error}=await SB.from('projects')
      .select('*')
      .or(`owner_id.eq.${_supaUser.id},id.in.(${_sharedProjectIds()})`)
      .order('is_default',{ascending:false})
      .order('created_at',{ascending:true});
    if(error)throw error;
    if(data&&data.length){
      _projects=data;
      _saveLocalProjects();
      return;
    }
  }catch(e){
    console.warn('Projects fetch failed, using local:',e);
  }
  _loadLocalProjects();
}

function _sharedProjectIds(){
  return"00000000-0000-0000-0000-000000000000";
}

// ═══ LOCAL STORAGE ═══
function _loadLocalProjects(){_projects=safeParse('meridian_projects',[])}
function _saveLocalProjects(){safeStore('meridian_projects',_projects)}
function _persistActiveId(){safeStore('meridian_active_project_id',_activeId?JSON.stringify(_activeId):null)}
function _createLocalProject(name,desc,icon,color,isDefault){
  return{
    id:crypto.randomUUID?crypto.randomUUID():('lp-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),
    owner_id:_isSignedIn()?_supaUser.id:null,
    name,description:desc||'',color:color||'amber',icon:icon||'📁',
    is_default:!!isDefault,is_archived:false,
    created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    last_active_tab:'home',settings:{}
  };
}

function _syncActiveProjectToLegacy(){
  const p=_active();
  if(!p)return;
  if(typeof S!=='undefined'){
    S.activeProject=p.name;
    safeStore('meridian_active_project',JSON.stringify(p.name));
  }
}

// ═══ PROJECT PAPERS (junction table) ═══
async function _loadProjectPapers(){
  if(!_activeId)return;
  _projectPaperIds=new Set();
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{data,error}=await SB.from('project_papers')
        .select('paper_id')
        .eq('project_id',_activeId);
      if(!error&&data)data.forEach(r=>_projectPaperIds.add(r.paper_id));
      return;
    }catch(e){console.warn('Load project papers:',e)}
  }
  // Fallback: use legacy project name matching
  if(typeof S!=='undefined'&&S.lib){
    const p=_active();
    if(p)S.lib.forEach(x=>{if((x.project||'Default')===p.name)_projectPaperIds.add(x.id)});
  }
}

async function assignPaper(paperId,projectId){
  const pid=projectId||_activeId;
  if(!pid||!paperId)return;
  _projectPaperIds.add(paperId);
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      await SB.from('project_papers').upsert({
        project_id:pid,paper_id:paperId,added_by:_supaUser.id
      },{onConflict:'project_id,paper_id'});
    }catch(e){console.warn('Assign paper:',e)}
  }
}

async function unassignPaper(paperId,projectId){
  const pid=projectId||_activeId;
  if(!pid||!paperId)return;
  if(pid===_activeId)_projectPaperIds.delete(paperId);
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      await SB.from('project_papers').delete()
        .eq('project_id',pid).eq('paper_id',paperId);
    }catch(e){console.warn('Unassign paper:',e)}
  }
}

async function getPaperProjectIds(paperId){
  if(!_isSignedIn()||typeof SB==='undefined')return[];
  try{
    const{data}=await SB.from('project_papers').select('project_id').eq('paper_id',paperId);
    return(data||[]).map(r=>r.project_id);
  }catch{return[]}
}

function isPaperInProject(paperId){
  return _projectPaperIds.has(paperId);
}

function getProjectPaperIds(){
  return _projectPaperIds;
}

// Show assign-to-project checklist modal
async function showAssignModal(paperId){
  document.getElementById('proj-assign-modal')?.remove();
  const current=await getPaperProjectIds(paperId);
  const overlay=document.createElement('div');
  overlay.id='proj-assign-modal';
  overlay.className='proj-modal-overlay';
  const visible=_nonArchived();
  overlay.innerHTML=`
<div class="proj-modal-card" style="max-width:380px">
  <div class="proj-modal-hdr"><h3>Assign to Projects</h3><button class="dx" id="proj-assign-close">&times;</button></div>
  <div class="proj-modal-body">
    ${visible.map(p=>{
      const c=_col(p.color);
      const checked=current.includes(p.id);
      return`<label class="proj-assign-row">
        <input type="checkbox" data-pid="${p.id}" ${checked?'checked':''} style="accent-color:${c.fg}"/>
        <span class="proj-sw-icon" style="background:${c.bg};color:${c.fg};width:24px;height:24px;font-size:12px">${p.icon}</span>
        <span style="font-size:13px;color:var(--ts)">${_esc(p.name)}</span>
      </label>`;
    }).join('')}
  </div>
  <div class="proj-modal-footer">
    <button class="bt" id="proj-assign-cancel">Cancel</button>
    <button class="bt bt-pri" id="proj-assign-save">Save</button>
  </div>
</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));
  const close=()=>{overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200)};
  document.getElementById('proj-assign-close').addEventListener('click',close);
  document.getElementById('proj-assign-cancel').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.getElementById('proj-assign-save').addEventListener('click',async()=>{
    const checks=overlay.querySelectorAll('input[type="checkbox"]');
    for(const cb of checks){
      const pid=cb.dataset.pid;
      const was=current.includes(pid);
      if(cb.checked&&!was)await assignPaper(paperId,pid);
      if(!cb.checked&&was)await unassignPaper(paperId,pid);
    }
    close();
    toast('Project assignments updated','ok');
    if(typeof renderLib==='function')renderLib();
  });
}

// ═══ FOCUS SPECIES ═══
async function _loadFocusSpecies(){
  _focusSpecies=[];
  if(!_activeId)return;
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{data,error}=await SB.from('project_species')
        .select('*').eq('project_id',_activeId).order('added_at',{ascending:false});
      if(!error&&data){_focusSpecies=data;return}
    }catch(e){console.warn('Load species:',e)}
  }
  _focusSpecies=safeParse('meridian_proj_species_'+_activeId,[]);
}

async function addFocusSpecies(sciName,commonName,speccode,source){
  if(!_activeId||!sciName)return;
  if(_focusSpecies.some(s=>s.scientific_name===sciName)){toast(sciName+' already in project','info');return}
  const entry={id:crypto.randomUUID(),project_id:_activeId,scientific_name:sciName,
    common_name:commonName||null,speccode:speccode||null,source:source||null,added_at:new Date().toISOString()};
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{data,error}=await SB.from('project_species').insert({
        project_id:_activeId,scientific_name:sciName,common_name:commonName||null,
        speccode:speccode||null,source:source||null
      }).select().single();
      if(!error&&data){_focusSpecies.unshift(data);logActivity('species_added',{name:sciName});toast('Added '+sciName+' to project','ok');return}
    }catch(e){console.warn('Add species:',e)}
  }
  _focusSpecies.unshift(entry);
  safeStore('meridian_proj_species_'+_activeId,_focusSpecies);
  logActivity('species_added',{name:sciName});
  toast('Added '+sciName+' to project','ok');
}

async function removeFocusSpecies(sciName){
  if(!_activeId)return;
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{await SB.from('project_species').delete().eq('project_id',_activeId).eq('scientific_name',sciName)}catch(e){console.warn('Remove species:',e)}
  }
  _focusSpecies=_focusSpecies.filter(s=>s.scientific_name!==sciName);
  safeStore('meridian_proj_species_'+_activeId,_focusSpecies);
  toast('Removed '+sciName+' from project','ok');
}

function renderSpeciesChips(){
  const el=document.getElementById('proj-species-chips');
  if(!el)return;
  if(!_focusSpecies.length){el.innerHTML='';el.style.display='none';return}
  el.style.display='';
  const p=_active();
  const c=p?_col(p.color):_col('amber');
  el.innerHTML=`<div class="proj-sp-bar"><span class="proj-sp-label" style="color:${c.fg}">Focus Species</span>${_focusSpecies.slice(0,8).map(s=>
    `<button class="proj-sp-chip" onclick="if(typeof speciesLookup==='function')speciesLookup('${_esc(s.scientific_name)}')" title="${_esc(s.common_name||'')}"><em>${_esc(s.scientific_name)}</em><span class="proj-sp-x" onclick="event.stopPropagation();MeridianProjects.removeFocusSpecies('${_esc(s.scientific_name)}');MeridianProjects.renderSpeciesChips()">×</span></button>`
  ).join('')}${_focusSpecies.length>8?`<span style="font-size:11px;color:var(--tm)">+${_focusSpecies.length-8} more</span>`:''}</div>`;
}

// ═══ ACTIVITY LOG ═══
async function logActivity(action,details){
  if(!_activeId)return;
  const entry={project_id:_activeId,action,details:details||{},created_at:new Date().toISOString()};
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      await SB.from('project_activity').insert({
        project_id:_activeId,user_id:_supaUser.id,action,details:details||{}
      });
    }catch(e){console.warn('Log activity:',e)}
  }
  _projectActivity.unshift(entry);
  if(_projectActivity.length>50)_projectActivity=_projectActivity.slice(0,50);
}

async function _loadProjectActivity(){
  _projectActivity=[];
  if(!_activeId||!_isSignedIn()||typeof SB==='undefined')return;
  try{
    const{data,error}=await SB.from('project_activity')
      .select('*').eq('project_id',_activeId)
      .order('created_at',{ascending:false}).limit(30);
    if(!error&&data)_projectActivity=data;
  }catch(e){console.warn('Load activity:',e)}
}

// ═══ SEARCH SCOPING ═══
async function logProjectSearch(query,engines,resultCount,filters){
  if(!_activeId||!_isSignedIn()||typeof SB==='undefined')return;
  try{
    await SB.from('project_searches').insert({
      project_id:_activeId,user_id:_supaUser.id,
      query,engines:engines||[],result_count:resultCount||0,filters:filters||{}
    });
  }catch(e){console.warn('Log search:',e)}
}

function getCrossProjectSearch(){return _crossProjectSearch}
function setCrossProjectSearch(v){_crossProjectSearch=!!v}

// ═══ PROJECT CRUD ═══
async function createProject(name,desc,icon,color){
  const nonArch=_nonArchived();
  if(nonArch.length>=MAX_FREE_PROJECTS){
    toast('Project limit reached ('+MAX_FREE_PROJECTS+'). Archive a project to create a new one.','err');
    return null;
  }
  if(!name||!name.trim()){toast('Project name is required','err');return null}
  const trimmed=name.trim().slice(0,60);

  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{data:sess}=await SB.auth.getSession();
      if(!sess?.session){
        toast('Session expired — sign in again to save to cloud','err');
      }else{
        const uid=sess.session.user.id;
        const{data,error}=await SB.from('projects').insert({
          owner_id:uid,name:trimmed,description:desc||'',
          icon:icon||'📁',color:color||'amber'
        }).select().single();
        if(error)throw error;
        _projects.push(data);
        _saveLocalProjects();
        switchTo(data.id);
        toast('Project created: '+trimmed,'ok');
        return data;
      }
    }catch(e){
      console.error('Create project cloud error:',e);
      toast('Cloud save failed — saved locally','err');
    }
  }

  const proj=_createLocalProject(trimmed,desc,icon,color,false);
  _projects.push(proj);
  _saveLocalProjects();
  switchTo(proj.id);
  toast('Project created: '+trimmed,'ok');
  return proj;
}

async function updateProject(id,updates){
  const proj=_projects.find(p=>p.id===id);
  if(!proj)return;
  Object.assign(proj,updates,{updated_at:new Date().toISOString()});
  _saveLocalProjects();
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{const{error}=await SB.from('projects').update(updates).eq('id',id);
      if(error)console.warn('Project update cloud error:',error);
    }catch(e){console.warn('Project update failed:',e)}
  }
  _renderSwitcher();
  if(id===_activeId){_syncActiveProjectToLegacy();_applyProjectColor()}
}

async function archiveProject(id){
  const proj=_projects.find(p=>p.id===id);
  if(!proj||proj.is_default){toast('Cannot archive the default project','err');return}
  await updateProject(id,{is_archived:true});
  if(id===_activeId){const def=_projects.find(p=>p.is_default);if(def)switchTo(def.id)}
  toast('Project archived: '+proj.name,'ok');
  _renderSwitcher();
}

async function unarchiveProject(id){
  if(_nonArchived().length>=MAX_FREE_PROJECTS){
    toast('Cannot unarchive — project limit reached ('+MAX_FREE_PROJECTS+')','err');return}
  await updateProject(id,{is_archived:false});
  toast('Project restored','ok');
  _renderSwitcher();
}

async function deleteProject(id){
  const proj=_projects.find(p=>p.id===id);
  if(!proj||proj.is_default){toast('Cannot delete the default project','err');return}
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{const{error}=await SB.from('projects').delete().eq('id',id);
      if(error)console.warn('Delete cloud error:',error);
    }catch(e){console.warn('Delete failed:',e)}
  }
  _projects=_projects.filter(p=>p.id!==id);
  _saveLocalProjects();
  if(id===_activeId){const def=_projects.find(p=>p.is_default);switchTo(def?def.id:_projects[0]?.id)}
  toast('Project deleted','ok');
  _renderSwitcher();
}

// ═══ SWITCHING ═══
function switchTo(id){
  if(id===_activeId)return;
  const prev=_active();
  if(prev){
    const activeTab=document.querySelector('.sb-item.active[data-tab]');
    if(activeTab){prev.last_active_tab=activeTab.dataset.tab;_saveLocalProjects()}
  }

  _activeId=id;
  _persistActiveId();
  _syncActiveProjectToLegacy();
  _renderSwitcher();
  _closeSwitcher();
  _applyProjectColor();

  // Animate content transition (150ms)
  const mw=document.getElementById('main-wrap');
  if(mw){
    mw.style.opacity='0';
    mw.style.transition='opacity 150ms ease';
    setTimeout(async()=>{
      await _loadProjectPapers();
      _loadFocusSpecies();
      _loadProjectActivity();
      if(typeof renderLib==='function')renderLib(true);
      renderSpeciesChips();
      mw.style.opacity='1';
      const proj=_active();
      if(proj&&proj.last_active_tab&&typeof goTab==='function'){
        goTab(proj.last_active_tab);
      }
    },150);
  }
}

// ═══ PROJECT COLOR ACCENTS ═══
function _applyProjectColor(){
  const p=_active();
  if(!p)return;
  const c=_col(p.color);
  document.documentElement.style.setProperty('--proj-fg',c.fg);
  document.documentElement.style.setProperty('--proj-bg',c.bg);
  document.documentElement.style.setProperty('--proj-ring',c.ring);
  // Update active sidebar indicator color
  const sb=document.getElementById('sidebar');
  if(sb)sb.style.setProperty('--proj-color',c.fg);
}

// ═══ SWITCHER UI ═══
function _renderSwitcher(){
  const el=document.getElementById('proj-switcher');
  if(!el)return;
  const p=_active();
  if(!p){el.innerHTML='';return}
  const c=_col(p.color);
  const paperCount=_projectPaperIds.size;

  el.innerHTML=`<button class="proj-sw-btn" id="proj-sw-trigger" title="${_esc(p.name)} (${paperCount} papers)">
<span class="proj-sw-icon" style="background:${c.bg};color:${c.fg}">${p.icon}</span>
<span class="proj-sw-name sb-label">${_esc(p.name)}</span>
<span class="proj-sw-dot sb-label" style="background:${c.fg}"></span>
<svg class="proj-sw-chev sb-label" viewBox="0 0 10 6" width="10" height="6"><polyline points="1 1 5 5 9 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
</button>`;

  document.getElementById('proj-sw-trigger')?.addEventListener('click',_toggleSwitcher);
}

function _toggleSwitcher(e){
  e?.stopPropagation();
  _switcherOpen?_closeSwitcher():_openSwitcher();
}

function _openSwitcher(){
  _switcherOpen=true;
  const trigger=document.getElementById('proj-sw-trigger');
  if(!trigger)return;
  document.getElementById('proj-sw-dd')?.remove();
  const dd=document.createElement('div');
  dd.id='proj-sw-dd';
  dd.className='proj-sw-dropdown';
  const visible=_nonArchived();
  const archived=_projects.filter(p=>p.is_archived);

  let html='<div class="proj-dd-list">';
  visible.forEach(p=>{
    const c=_col(p.color);
    const isActive=p.id===_activeId;
    const paperCount=typeof S!=='undefined'?S.lib.filter(x=>(x.project||'Default')===p.name).length:0;
    html+=`<button class="proj-dd-item${isActive?' active':''}" data-id="${p.id}">
<span class="proj-dd-icon" style="background:${c.bg};color:${c.fg}">${p.icon}</span>
<div class="proj-dd-info">
<span class="proj-dd-name">${_esc(p.name)}</span>
<span class="proj-dd-meta">${paperCount} paper${paperCount!==1?'s':''}</span>
</div>
${isActive?'<svg class="proj-dd-check" viewBox="0 0 16 16" width="14" height="14"><polyline points="3 8 7 12 13 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
</button>`;
  });
  html+='</div>';

  html+='<div class="proj-dd-actions">';
  if(visible.length<MAX_FREE_PROJECTS){
    html+='<button class="proj-dd-action" id="proj-new-btn"><svg viewBox="0 0 16 16" width="14" height="14"><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> New Project</button>';
  }else{
    html+='<span class="proj-dd-limit">Project limit reached ('+MAX_FREE_PROJECTS+')</span>';
  }
  html+='<button class="proj-dd-action proj-dd-manage" id="proj-manage-btn"><svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1" fill="none"/></svg> Manage Projects'+(archived.length?' <span class="proj-dd-arch-count">'+archived.length+' archived</span>':'')+'</button>';
  html+='</div>';

  dd.innerHTML=html;
  trigger.parentElement.appendChild(dd);
  requestAnimationFrame(()=>dd.classList.add('open'));

  dd.querySelectorAll('.proj-dd-item').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.id;
      if(id&&id!==_activeId)switchTo(id);
      _closeSwitcher();
    });
  });
  document.getElementById('proj-new-btn')?.addEventListener('click',()=>{_closeSwitcher();showNewProjectModal()});
  document.getElementById('proj-manage-btn')?.addEventListener('click',()=>{_closeSwitcher();showManageProjects()});
  setTimeout(()=>{document.addEventListener('click',_outsideClickClose,{once:true,capture:true})},10);
}

function _outsideClickClose(e){
  const dd=document.getElementById('proj-sw-dd');
  const trigger=document.getElementById('proj-sw-trigger');
  if(dd&&!dd.contains(e.target)&&trigger&&!trigger.contains(e.target)){_closeSwitcher()}
  else if(_switcherOpen){setTimeout(()=>document.addEventListener('click',_outsideClickClose,{once:true,capture:true}),10)}
}

function _closeSwitcher(){
  _switcherOpen=false;
  const dd=document.getElementById('proj-sw-dd');
  if(dd){dd.classList.remove('open');setTimeout(()=>dd.remove(),200)}
}

// ═══ NEW PROJECT MODAL ═══
function showNewProjectModal(){
  document.getElementById('proj-modal')?.remove();
  const overlay=document.createElement('div');
  overlay.id='proj-modal';
  overlay.className='proj-modal-overlay';
  overlay.innerHTML=`
<div class="proj-modal-card">
  <div class="proj-modal-hdr"><h3>New Project</h3><button class="dx" id="proj-modal-close">&times;</button></div>
  <div class="proj-modal-body">
    <label class="proj-label">Name</label>
    <input class="si proj-name-input" id="proj-new-name" placeholder="e.g. Sea Turtle Recovery" maxlength="60" autofocus/>
    <label class="proj-label">Description <span class="proj-optional">(optional)</span></label>
    <input class="si" id="proj-new-desc" placeholder="Brief description of your research focus"/>
    <label class="proj-label">Icon</label>
    <div class="proj-icon-grid" id="proj-icon-grid">
      ${ICONS.map(ic=>'<button class="proj-icon-btn'+(ic==='📁'?' selected':'')+'" data-icon="'+ic+'">'+ic+'</button>').join('')}
    </div>
    <label class="proj-label">Color</label>
    <div class="proj-color-grid" id="proj-color-grid">
      ${Object.keys(PROJECT_COLORS).map(c=>{const col=PROJECT_COLORS[c];return'<button class="proj-color-btn'+(c==='amber'?' selected':'')+'" data-color="'+c+'" style="background:'+col.fg+'" title="'+c+'"></button>'}).join('')}
    </div>
    <div class="proj-preview" id="proj-preview">
      <span class="proj-sw-icon" style="background:${PROJECT_COLORS.amber.bg};color:${PROJECT_COLORS.amber.fg}">📁</span>
      <span class="proj-preview-name">New Project</span>
    </div>
  </div>
  <div class="proj-modal-footer">
    <button class="bt" id="proj-modal-cancel">Cancel</button>
    <button class="bt bt-pri" id="proj-modal-create">Create Project</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));
  let selIcon='📁',selColor='amber';
  const nameInput=document.getElementById('proj-new-name');
  const descInput=document.getElementById('proj-new-desc');

  document.getElementById('proj-icon-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.proj-icon-btn');if(!btn)return;
    document.querySelectorAll('.proj-icon-btn.selected').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');selIcon=btn.dataset.icon;_updatePreview()});
  document.getElementById('proj-color-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.proj-color-btn');if(!btn)return;
    document.querySelectorAll('.proj-color-btn.selected').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');selColor=btn.dataset.color;_updatePreview()});
  nameInput.addEventListener('input',_updatePreview);
  function _updatePreview(){
    const preview=document.getElementById('proj-preview');if(!preview)return;
    const c=PROJECT_COLORS[selColor]||PROJECT_COLORS.amber;
    const n=nameInput.value.trim()||'New Project';
    preview.innerHTML=`<span class="proj-sw-icon" style="background:${c.bg};color:${c.fg}">${selIcon}</span><span class="proj-preview-name">${_esc(n)}</span>`}

  document.getElementById('proj-modal-create').addEventListener('click',async()=>{
    const name=nameInput.value.trim();
    if(!name){nameInput.focus();nameInput.style.borderColor='var(--co)';return}
    overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200);
    await createProject(name,descInput.value.trim(),selIcon,selColor)});
  const close=()=>{overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200)};
  document.getElementById('proj-modal-cancel').addEventListener('click',close);
  document.getElementById('proj-modal-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  setTimeout(()=>nameInput.focus(),100);
}

// ═══ MANAGE PROJECTS PANEL ═══
function showManageProjects(){
  document.getElementById('proj-manage-modal')?.remove();
  const overlay=document.createElement('div');
  overlay.id='proj-manage-modal';
  overlay.className='proj-modal-overlay';

  function render(){
    const active=_nonArchived();
    const archived=_projects.filter(p=>p.is_archived);
    overlay.innerHTML=`
<div class="proj-modal-card proj-manage-card">
  <div class="proj-modal-hdr"><h3>Manage Projects</h3><button class="dx" id="proj-mgmt-close">&times;</button></div>
  <div class="proj-modal-body" style="max-height:60vh;overflow-y:auto">
    <div class="proj-mgmt-section">
      <div class="proj-mgmt-hdr-row"><span class="proj-mgmt-title">Active (${active.length}/${MAX_FREE_PROJECTS})</span></div>
      ${active.map(p=>{
        const c=_col(p.color);
        const paperCount=typeof S!=='undefined'?S.lib.filter(x=>(x.project||'Default')===p.name).length:0;
        return`<div class="proj-mgmt-row" data-id="${p.id}">
          <span class="proj-sw-icon" style="background:${c.bg};color:${c.fg};width:28px;height:28px;font-size:14px">${p.icon}</span>
          <div class="proj-mgmt-info">
            <span class="proj-mgmt-name">${_esc(p.name)}${p.is_default?' <span class="proj-mgmt-def">default</span>':''}</span>
            <span class="proj-mgmt-meta">${paperCount} papers${p.description?' · '+_esc(p.description.slice(0,40)):''}</span>
          </div>
          <div class="proj-mgmt-actions">
            ${!p.is_default?'<button class="bt sm proj-mgmt-btn" data-action="archive" data-id="'+p.id+'">Archive</button>':''}
            ${!p.is_default?'<button class="bt sm proj-mgmt-btn" data-action="delete" data-id="'+p.id+'" style="color:var(--co)">Delete</button>':''}
          </div>
        </div>`}).join('')}
    </div>
    ${archived.length?`<div class="proj-mgmt-section">
      <div class="proj-mgmt-hdr-row"><span class="proj-mgmt-title">Archived (${archived.length})</span></div>
      ${archived.map(p=>{const c=_col(p.color);
        return`<div class="proj-mgmt-row archived" data-id="${p.id}">
          <span class="proj-sw-icon" style="background:${c.bg};color:${c.fg};width:28px;height:28px;font-size:14px;opacity:.5">${p.icon}</span>
          <div class="proj-mgmt-info" style="opacity:.6">
            <span class="proj-mgmt-name">${_esc(p.name)}</span><span class="proj-mgmt-meta">Archived</span>
          </div>
          <div class="proj-mgmt-actions">
            <button class="bt sm proj-mgmt-btn" data-action="unarchive" data-id="${p.id}">Restore</button>
          </div>
        </div>`}).join('')}
    </div>`:''}
  </div>
  <div class="proj-modal-footer"><button class="bt" id="proj-mgmt-done">Done</button></div>
</div>`;
    document.getElementById('proj-mgmt-close')?.addEventListener('click',closeModal);
    document.getElementById('proj-mgmt-done')?.addEventListener('click',closeModal);
    overlay.querySelectorAll('.proj-mgmt-btn').forEach(btn=>{
      btn.addEventListener('click',async(e)=>{
        e.stopPropagation();const action=btn.dataset.action;const id=btn.dataset.id;
        if(action==='archive')await archiveProject(id);
        if(action==='unarchive')await unarchiveProject(id);
        if(action==='delete')await _confirmDelete(id);
        render()})});
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()})}

  function closeModal(){overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200)}
  document.body.appendChild(overlay);render();
  requestAnimationFrame(()=>overlay.classList.add('open'));
}

// ═══ DELETE CONFIRMATION ═══
async function _confirmDelete(id){
  const proj=_projects.find(p=>p.id===id);if(!proj)return;
  return new Promise(resolve=>{
    document.getElementById('proj-del-modal')?.remove();
    const overlay=document.createElement('div');overlay.id='proj-del-modal';overlay.className='proj-modal-overlay';
    overlay.innerHTML=`
<div class="proj-modal-card" style="max-width:400px">
  <div class="proj-modal-hdr"><h3 style="color:var(--co)">Delete Project</h3><button class="dx" id="proj-del-close">&times;</button></div>
  <div class="proj-modal-body">
    <p style="font-size:13px;color:var(--ts);line-height:1.6;margin:0 0 12px">This will permanently delete <b>${_esc(proj.name)}</b> and all project-scoped data. Papers in your library will NOT be deleted.</p>
    <p style="font-size:12px;color:var(--tm);margin:0 0 8px">Type <b>${_esc(proj.name)}</b> to confirm:</p>
    <input class="si" id="proj-del-confirm" placeholder="Type project name..." autocomplete="off"/>
  </div>
  <div class="proj-modal-footer">
    <button class="bt" id="proj-del-cancel">Cancel</button>
    <button class="bt" id="proj-del-btn" style="background:var(--cm);color:var(--co);border-color:rgba(194,120,120,.3)" disabled>Delete Forever</button>
  </div>
</div>`;
    document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('open'));
    const inp=document.getElementById('proj-del-confirm');const btn=document.getElementById('proj-del-btn');
    inp.addEventListener('input',()=>{btn.disabled=inp.value.trim()!==proj.name});
    btn.addEventListener('click',async()=>{overlay.remove();await deleteProject(id);resolve(true)});
    const close=()=>{overlay.classList.remove('open');setTimeout(()=>{overlay.remove();resolve(false)},200)};
    document.getElementById('proj-del-cancel').addEventListener('click',close);
    document.getElementById('proj-del-close').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    setTimeout(()=>inp.focus(),100)})
}

// ═══ DASHBOARD ═══
async function renderDashboard(){
  const el=document.getElementById('proj-dash');
  if(!el)return;
  const p=_active();
  if(!p){el.innerHTML='';return}
  const c=_col(p.color);

  // Gather stats
  const paperCount=_projectPaperIds.size;
  const speciesCount=_focusSpecies.length;
  let annotationCount=0,searchCount=0,chatCount=0;
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const[annRes,srchRes,chatRes]=await Promise.all([
        SB.from('map_annotations').select('id',{count:'exact',head:true}).eq('project_id',_activeId),
        SB.from('project_searches').select('id',{count:'exact',head:true}).eq('project_id',_activeId),
        SB.from('project_ai_chats').select('id',{count:'exact',head:true}).eq('project_id',_activeId)
      ]);
      annotationCount=annRes.count||0;
      searchCount=srchRes.count||0;
      chatCount=chatRes.count||0;
    }catch(e){console.warn('Dashboard stats:',e)}
  }

  const stats=[
    {n:'Papers',v:paperCount,icon:'📄',color:'var(--ac)'},
    {n:'Species',v:speciesCount,icon:'🧬',color:'var(--sg)'},
    {n:'Annotations',v:annotationCount,icon:'📌',color:'var(--lv)'},
    {n:'Searches',v:searchCount,icon:'🔍',color:'var(--wa)'},
    {n:'AI Chats',v:chatCount,icon:'✨',color:'var(--ac)'}
  ];

  const actRows=_projectActivity.slice(0,10).map(a=>{
    const icon=_actionIcons[a.action]||'▪';
    const detail=a.details?.name||a.details?.query||a.action.replace(/_/g,' ');
    return`<div class="proj-dash-act-row"><span class="proj-dash-act-icon">${icon}</span><div class="proj-dash-act-body"><span class="proj-dash-act-title">${_esc(detail)}</span><span class="proj-dash-act-time">${_timeAgo(a.created_at)}</span></div></div>`;
  }).join('');

  const speciesGrid=_focusSpecies.slice(0,6).map(s=>{
    return`<button class="proj-dash-sp" onclick="if(typeof speciesLookup==='function'){speciesLookup('${_esc(s.scientific_name)}')}"><span class="proj-dash-sp-name">${_esc(s.scientific_name)}</span>${s.common_name?'<span class="proj-dash-sp-common">'+_esc(s.common_name)+'</span>':''}</button>`;
  }).join('');

  el.innerHTML=`
<div class="proj-dash-header" style="border-left:4px solid ${c.fg}">
  <div class="proj-dash-title-row">
    <span class="proj-sw-icon" style="background:${c.bg};color:${c.fg};width:44px;height:44px;font-size:24px">${p.icon}</span>
    <div>
      <h2 class="proj-dash-title">${_esc(p.name)}</h2>
      ${p.description?'<p class="proj-dash-desc">'+_esc(p.description)+'</p>':''}
    </div>
  </div>
</div>

<div class="proj-dash-stats">
  ${stats.map(s=>`<div class="proj-dash-stat"><div class="proj-dash-stat-icon" style="color:${s.color}">${s.icon}</div><div class="proj-dash-stat-val">${s.v}</div><div class="proj-dash-stat-label">${s.n}</div></div>`).join('')}
</div>

<div class="proj-dash-grid">
  <div class="proj-dash-card">
    <h4 class="proj-dash-card-title">Recent Activity</h4>
    ${actRows||'<div class="proj-dash-empty">No activity recorded yet</div>'}
  </div>
  <div class="proj-dash-card">
    <h4 class="proj-dash-card-title">Focus Species${_focusSpecies.length?' ('+_focusSpecies.length+')':''}</h4>
    ${speciesGrid||'<div class="proj-dash-empty">No focus species yet — search for a species and add it</div>'}
  </div>
</div>

<div class="proj-dash-actions">
  <button class="proj-dash-qa" onclick="goTab('lit')"><span style="font-size:18px">🔍</span><div><strong>Search Literature</strong><span>4 databases</span></div></button>
  <button class="proj-dash-qa" onclick="goTab('species')"><span style="font-size:18px">🐟</span><div><strong>Explore Species</strong><span>WoRMS · GBIF · OBIS</span></div></button>
  <button class="proj-dash-qa" onclick="goTab('env')"><span style="font-size:18px">🌊</span><div><strong>Environmental Data</strong><span>SST · Chlorophyll · 20+ vars</span></div></button>
  <button class="proj-dash-qa" onclick="goTab('library')"><span style="font-size:18px">📚</span><div><strong>View Library</strong><span>${paperCount} papers</span></div></button>
</div>`;
}

// ═══ PUBLIC API ═══
return{
  init,onSignIn,
  get projects(){return _projects},
  get activeId(){return _activeId},
  get active(){return _active()},
  get colors(){return PROJECT_COLORS},
  get icons(){return ICONS},
  switchTo,createProject,updateProject,archiveProject,unarchiveProject,deleteProject,
  showNewProjectModal,showManageProjects,
  // Phase 2
  assignPaper,unassignPaper,getPaperProjectIds,isPaperInProject,getProjectPaperIds,showAssignModal,
  addFocusSpecies,removeFocusSpecies,renderSpeciesChips,get focusSpecies(){return _focusSpecies},
  logActivity,logProjectSearch,
  getCrossProjectSearch,setCrossProjectSearch,
  // Phase 3
  renderDashboard,
  MAX_FREE_PROJECTS
};
})();
