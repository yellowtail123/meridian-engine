// ═══════════════════════════════════════════════════════════════════
// MERIDIAN ENGINE — Research Projects System (Phase 1)
// State management, switcher UI, CRUD, modals
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
let _projects=[];       // All user projects (from Supabase or localStorage)
let _activeId=null;     // Current project UUID
let _switcherOpen=false;
let _initialized=false;

// ── Helpers ──
function _col(c){return PROJECT_COLORS[c]||PROJECT_COLORS.amber}
function _active(){return _projects.find(p=>p.id===_activeId)||_projects.find(p=>p.is_default)||_projects[0]||null}
function _nonArchived(){return _projects.filter(p=>!p.is_archived)}
function _isSignedIn(){return typeof _supaUser!=='undefined'&&_supaUser}

// ═══ INITIALIZATION ═══
async function init(){
  if(_initialized)return;
  _initialized=true;
  // Restore last active project from localStorage
  const savedId=safeParse('meridian_active_project_id',null);

  if(_isSignedIn()){
    await _fetchProjects();
  }else{
    // Offline / not signed in — use localStorage projects
    _loadLocalProjects();
  }

  // Set active project
  if(savedId&&_projects.find(p=>p.id===savedId)){
    _activeId=savedId;
  }else{
    const def=_projects.find(p=>p.is_default);
    _activeId=def?def.id:(_projects[0]?.id||null);
  }

  // Ensure at least a General project exists
  if(!_projects.length){
    const gen=_createLocalProject('General','Default project for general research','🔬','amber',true);
    _projects.push(gen);
    _activeId=gen.id;
    _saveLocalProjects();
  }

  // Legacy migration: if S.activeProject is a string name (old system), find matching project
  if(typeof S!=='undefined'&&S.activeProject&&typeof S.activeProject==='string'&&S.activeProject!=='Default'){
    const match=_projects.find(p=>p.name===S.activeProject);
    if(match)_activeId=match.id;
  }

  _persistActiveId();
  _renderSwitcher();
  _syncActiveProjectToLegacy();
}

// Re-init after sign-in (fetch cloud projects)
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
  // Fallback to local
  _loadLocalProjects();
}

function _sharedProjectIds(){
  // Placeholder — will be populated by a separate members query in Phase 4
  return"'00000000-0000-0000-0000-000000000000'";
}

// ═══ LOCAL STORAGE (offline fallback) ═══
function _loadLocalProjects(){
  _projects=safeParse('meridian_projects',[]);
}
function _saveLocalProjects(){
  safeStore('meridian_projects',_projects);
}
function _persistActiveId(){
  safeStore('meridian_active_project_id',_activeId?JSON.stringify(_activeId):null);
}
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

// ═══ SYNC WITH LEGACY SYSTEM ═══
// Bridge between new UUID-based projects and old S.activeProject string
function _syncActiveProjectToLegacy(){
  const p=_active();
  if(!p)return;
  if(typeof S!=='undefined'){
    S.activeProject=p.name;
    safeStore('meridian_active_project',JSON.stringify(p.name));
  }
}

// ═══ PROJECT CRUD ═══

async function createProject(name,desc,icon,color){
  // Free tier check
  const nonArch=_nonArchived();
  if(nonArch.length>=MAX_FREE_PROJECTS){
    toast('Project limit reached ('+MAX_FREE_PROJECTS+'). Archive a project to create a new one.','err');
    return null;
  }
  if(!name||!name.trim()){toast('Project name is required','err');return null}
  const trimmed=name.trim().slice(0,60);

  // Cloud save
  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{data,error}=await SB.from('projects').insert({
        owner_id:_supaUser.id,name:trimmed,description:desc||'',
        icon:icon||'📁',color:color||'amber'
      }).select().single();
      if(error)throw error;
      _projects.push(data);
      _saveLocalProjects();
      switchTo(data.id);
      toast('Project created: '+trimmed,'ok');
      return data;
    }catch(e){
      console.error('Create project cloud error:',e);
      toast('Cloud save failed — saved locally','err');
    }
  }

  // Local fallback
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
    try{
      const{error}=await SB.from('projects').update(updates).eq('id',id);
      if(error)console.warn('Project update cloud error:',error);
    }catch(e){console.warn('Project update failed:',e)}
  }
  _renderSwitcher();
  if(id===_activeId)_syncActiveProjectToLegacy();
}

async function archiveProject(id){
  const proj=_projects.find(p=>p.id===id);
  if(!proj||proj.is_default){toast('Cannot archive the default project','err');return}
  await updateProject(id,{is_archived:true});
  // If archiving the active project, switch to default
  if(id===_activeId){
    const def=_projects.find(p=>p.is_default);
    if(def)switchTo(def.id);
  }
  toast('Project archived: '+proj.name,'ok');
  _renderSwitcher();
}

async function unarchiveProject(id){
  // Check limit
  if(_nonArchived().length>=MAX_FREE_PROJECTS){
    toast('Cannot unarchive — project limit reached ('+MAX_FREE_PROJECTS+')','err');
    return;
  }
  await updateProject(id,{is_archived:false});
  toast('Project restored','ok');
  _renderSwitcher();
}

async function deleteProject(id){
  const proj=_projects.find(p=>p.id===id);
  if(!proj||proj.is_default){toast('Cannot delete the default project','err');return}

  if(_isSignedIn()&&typeof SB!=='undefined'){
    try{
      const{error}=await SB.from('projects').delete().eq('id',id);
      if(error)console.warn('Delete cloud error:',error);
    }catch(e){console.warn('Delete failed:',e)}
  }

  _projects=_projects.filter(p=>p.id!==id);
  _saveLocalProjects();
  if(id===_activeId){
    const def=_projects.find(p=>p.is_default);
    switchTo(def?def.id:_projects[0]?.id);
  }
  toast('Project deleted','ok');
  _renderSwitcher();
}

// ═══ SWITCHING ═══
function switchTo(id){
  if(id===_activeId)return;
  const prev=_active();
  // Save last tab on previous project
  if(prev){
    const activeTab=document.querySelector('.sb-item.active[data-tab]');
    if(activeTab)prev.last_active_tab=activeTab.dataset.tab;
  }

  _activeId=id;
  _persistActiveId();
  _syncActiveProjectToLegacy();
  _renderSwitcher();
  _closeSwitcher();

  // Animate content transition
  const main=document.getElementById('main');
  if(main){
    main.style.opacity='0';
    main.style.transition='opacity 120ms ease';
    setTimeout(()=>{
      // Re-render active tab
      if(typeof renderLib==='function')renderLib(true);
      main.style.opacity='1';
      // Restore last tab
      const proj=_active();
      if(proj&&proj.last_active_tab&&typeof goTab==='function'){
        goTab(proj.last_active_tab);
      }
    },120);
  }
}

// ═══ SWITCHER UI ═══
function _renderSwitcher(){
  const el=document.getElementById('proj-switcher');
  if(!el)return;
  const p=_active();
  if(!p){el.innerHTML='';return}
  const c=_col(p.color);

  el.innerHTML=`<button class="proj-sw-btn" id="proj-sw-trigger" title="${_esc(p.name)}">
<span class="proj-sw-icon" style="background:${c.bg};color:${c.fg}">${p.icon}</span>
<span class="proj-sw-name sb-label">${_esc(p.name)}</span>
<span class="proj-sw-dot sb-label" style="background:${c.fg}"></span>
<svg class="proj-sw-chev sb-label" viewBox="0 0 10 6" width="10" height="6"><polyline points="1 1 5 5 9 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
</button>`;

  // Re-bind click
  document.getElementById('proj-sw-trigger')?.addEventListener('click',_toggleSwitcher);

  // Update project color accent on sidebar
  const sb=document.getElementById('sidebar');
  if(sb)sb.style.setProperty('--proj-color',c.fg);
}

function _toggleSwitcher(e){
  e?.stopPropagation();
  _switcherOpen?_closeSwitcher():_openSwitcher();
}

function _openSwitcher(){
  _switcherOpen=true;
  const trigger=document.getElementById('proj-sw-trigger');
  if(!trigger)return;

  // Remove existing dropdown
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

  // Actions
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

  // Animate in
  requestAnimationFrame(()=>dd.classList.add('open'));

  // Bind events
  dd.querySelectorAll('.proj-dd-item').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.id;
      if(id&&id!==_activeId)switchTo(id);
      _closeSwitcher();
    });
  });
  document.getElementById('proj-new-btn')?.addEventListener('click',()=>{
    _closeSwitcher();
    showNewProjectModal();
  });
  document.getElementById('proj-manage-btn')?.addEventListener('click',()=>{
    _closeSwitcher();
    showManageProjects();
  });

  // Close on outside click
  setTimeout(()=>{
    document.addEventListener('click',_outsideClickClose,{once:true,capture:true});
  },10);
}

function _outsideClickClose(e){
  const dd=document.getElementById('proj-sw-dd');
  const trigger=document.getElementById('proj-sw-trigger');
  if(dd&&!dd.contains(e.target)&&trigger&&!trigger.contains(e.target)){
    _closeSwitcher();
  }else if(_switcherOpen){
    setTimeout(()=>document.addEventListener('click',_outsideClickClose,{once:true,capture:true}),10);
  }
}

function _closeSwitcher(){
  _switcherOpen=false;
  const dd=document.getElementById('proj-sw-dd');
  if(dd){
    dd.classList.remove('open');
    setTimeout(()=>dd.remove(),200);
  }
}

// ═══ NEW PROJECT MODAL ═══
function showNewProjectModal(){
  document.getElementById('proj-modal')?.remove();

  const overlay=document.createElement('div');
  overlay.id='proj-modal';
  overlay.className='proj-modal-overlay';
  overlay.innerHTML=`
<div class="proj-modal-card">
  <div class="proj-modal-hdr">
    <h3>New Project</h3>
    <button class="dx" id="proj-modal-close">&times;</button>
  </div>
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
      ${Object.keys(PROJECT_COLORS).map(c=>{
        const col=PROJECT_COLORS[c];
        return'<button class="proj-color-btn'+(c==='amber'?' selected':'')+'" data-color="'+c+'" style="background:'+col.fg+'" title="'+c+'"></button>';
      }).join('')}
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

  // State
  let selIcon='📁',selColor='amber';
  const nameInput=document.getElementById('proj-new-name');
  const descInput=document.getElementById('proj-new-desc');

  // Icon selection
  document.getElementById('proj-icon-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.proj-icon-btn');
    if(!btn)return;
    document.querySelectorAll('.proj-icon-btn.selected').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selIcon=btn.dataset.icon;
    _updatePreview();
  });

  // Color selection
  document.getElementById('proj-color-grid').addEventListener('click',e=>{
    const btn=e.target.closest('.proj-color-btn');
    if(!btn)return;
    document.querySelectorAll('.proj-color-btn.selected').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selColor=btn.dataset.color;
    _updatePreview();
  });

  // Live preview
  nameInput.addEventListener('input',_updatePreview);
  function _updatePreview(){
    const preview=document.getElementById('proj-preview');
    if(!preview)return;
    const c=PROJECT_COLORS[selColor]||PROJECT_COLORS.amber;
    const n=nameInput.value.trim()||'New Project';
    preview.innerHTML=`<span class="proj-sw-icon" style="background:${c.bg};color:${c.fg}">${selIcon}</span><span class="proj-preview-name">${_esc(n)}</span>`;
  }

  // Create
  document.getElementById('proj-modal-create').addEventListener('click',async()=>{
    const name=nameInput.value.trim();
    if(!name){nameInput.focus();nameInput.style.borderColor='var(--co)';return}
    overlay.classList.remove('open');
    setTimeout(()=>overlay.remove(),200);
    await createProject(name,descInput.value.trim(),selIcon,selColor);
  });

  // Cancel / close
  const close=()=>{overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200)};
  document.getElementById('proj-modal-cancel').addEventListener('click',close);
  document.getElementById('proj-modal-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});

  // Focus
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
  <div class="proj-modal-hdr">
    <h3>Manage Projects</h3>
    <button class="dx" id="proj-mgmt-close">&times;</button>
  </div>
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
            ${!p.is_default?'<button class="bt sm proj-mgmt-btn" data-action="archive" data-id="'+p.id+'" title="Archive">Archive</button>':''}
            ${!p.is_default?'<button class="bt sm proj-mgmt-btn" data-action="delete" data-id="'+p.id+'" title="Delete" style="color:var(--co)">Delete</button>':''}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${archived.length?`<div class="proj-mgmt-section">
      <div class="proj-mgmt-hdr-row"><span class="proj-mgmt-title">Archived (${archived.length})</span></div>
      ${archived.map(p=>{
        const c=_col(p.color);
        return`<div class="proj-mgmt-row archived" data-id="${p.id}">
          <span class="proj-sw-icon" style="background:${c.bg};color:${c.fg};width:28px;height:28px;font-size:14px;opacity:.5">${p.icon}</span>
          <div class="proj-mgmt-info" style="opacity:.6">
            <span class="proj-mgmt-name">${_esc(p.name)}</span>
            <span class="proj-mgmt-meta">Archived</span>
          </div>
          <div class="proj-mgmt-actions">
            <button class="bt sm proj-mgmt-btn" data-action="unarchive" data-id="${p.id}">Restore</button>
          </div>
        </div>`;
      }).join('')}
    </div>`:''}
  </div>
  <div class="proj-modal-footer">
    <button class="bt" id="proj-mgmt-done">Done</button>
  </div>
</div>`;

    // Bind events
    document.getElementById('proj-mgmt-close')?.addEventListener('click',closeModal);
    document.getElementById('proj-mgmt-done')?.addEventListener('click',closeModal);
    overlay.querySelectorAll('.proj-mgmt-btn').forEach(btn=>{
      btn.addEventListener('click',async(e)=>{
        e.stopPropagation();
        const action=btn.dataset.action;
        const id=btn.dataset.id;
        if(action==='archive')await archiveProject(id);
        if(action==='unarchive')await unarchiveProject(id);
        if(action==='delete')await _confirmDelete(id);
        render(); // re-render the list
      });
    });
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});
  }

  function closeModal(){overlay.classList.remove('open');setTimeout(()=>overlay.remove(),200)}

  document.body.appendChild(overlay);
  render();
  requestAnimationFrame(()=>overlay.classList.add('open'));
}

// ═══ DELETE CONFIRMATION ═══
async function _confirmDelete(id){
  const proj=_projects.find(p=>p.id===id);
  if(!proj)return;

  return new Promise(resolve=>{
    document.getElementById('proj-del-modal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='proj-del-modal';
    overlay.className='proj-modal-overlay';
    overlay.innerHTML=`
<div class="proj-modal-card" style="max-width:400px">
  <div class="proj-modal-hdr"><h3 style="color:var(--co)">Delete Project</h3><button class="dx" id="proj-del-close">&times;</button></div>
  <div class="proj-modal-body">
    <p style="font-size:13px;color:var(--ts);line-height:1.6;margin:0 0 12px">This will permanently delete <b>${_esc(proj.name)}</b> and all project-scoped data (search history, species, AI chats, activity). Papers in your library will NOT be deleted.</p>
    <p style="font-size:12px;color:var(--tm);margin:0 0 8px">Type <b>${_esc(proj.name)}</b> to confirm:</p>
    <input class="si" id="proj-del-confirm" placeholder="Type project name..." autocomplete="off"/>
  </div>
  <div class="proj-modal-footer">
    <button class="bt" id="proj-del-cancel">Cancel</button>
    <button class="bt" id="proj-del-btn" style="background:var(--cm);color:var(--co);border-color:rgba(194,120,120,.3)" disabled>Delete Forever</button>
  </div>
</div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('open'));

    const inp=document.getElementById('proj-del-confirm');
    const btn=document.getElementById('proj-del-btn');
    inp.addEventListener('input',()=>{
      btn.disabled=inp.value.trim()!==proj.name;
    });
    btn.addEventListener('click',async()=>{
      overlay.remove();
      await deleteProject(id);
      resolve(true);
    });
    const close=()=>{overlay.classList.remove('open');setTimeout(()=>{overlay.remove();resolve(false)},200)};
    document.getElementById('proj-del-cancel').addEventListener('click',close);
    document.getElementById('proj-del-close').addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    setTimeout(()=>inp.focus(),100);
  });
}

// ═══ UTILITY ═══
function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

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
  MAX_FREE_PROJECTS
};
})();
