// ═══ MERIDIAN SUPABASE — Auth Client, User Accounts, Cloud Sync & Admin ═══
// All auth/admin code in one file — no separate script loads.
// Loads after supabase-js SDK and meridian-core.js (S, $, toast)

// ─── Supabase Client Singleton ───
const SUPA_URL='https://wgqfxgxnanvckgqkuqas.supabase.co';
const SUPA_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncWZ4Z3huYW52Y2tncWt1cWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDA0MzEsImV4cCI6MjA4OTYxNjQzMX0.PZ6ATWCJ_qyJVTXgFNmVKzBBxOQlEpa_vXLAhKVdgzg';
let _supaClientInstance=null;
function _supaGetClient(){
  if(!_supaClientInstance&&typeof window.supabase!=='undefined'){
    try{
      _supaClientInstance=window.supabase.createClient(SUPA_URL,SUPA_ANON,{
        auth:{
          persistSession:true,
          storageKey:'meridian-auth',
          storage:window.localStorage,
          autoRefreshToken:true,
          detectSessionInUrl:true
        }
      });
    }catch(e){console.warn('Supabase client creation failed:',e)}
  }
  return _supaClientInstance;
}

// ─── Auth State ───
let _supa=null;
let _supaUser=null;
let _supaIsAdmin=false;
let _syncInProgress=false;

// ═══ 1. INIT ═══
function _supaInit(){
  const btn=$('#auth-btn');
  if(btn)btn.onclick=_showAuthModal;

  _supa=_supaGetClient();
  if(!_supa){console.warn('Supabase client unavailable');_maybeAutoShowModal();return}

  // Listen for future auth state changes (SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED).
  // INITIAL_SESSION is skipped — getSession() below handles startup.
  _supa.auth.onAuthStateChange(async(event,session)=>{
    if(event==='INITIAL_SESSION')return;
    try{
      if(event==='SIGNED_IN'&&session){
        _supaUser=session.user;
        _dismissAuthModal(false);
        await _checkAdminRole();
        _renderAuthUI();
        _renderAdminLink();
        toast('Signed in as '+_supaUser.email,'ok');
        await _syncOnLogin();
        _flushQueue();
      }
      if(event==='SIGNED_OUT'){
        _supaUser=null;
        _supaIsAdmin=false;
        _renderAuthUI();
        _renderAdminLink();
        toast('Signed out','info');
      }
      if(event==='TOKEN_REFRESHED'&&session){
        _supaUser=session.user;
      }
    }catch(e){console.warn('Auth state change error:',e)}
  });

  // Restore existing session from localStorage on startup.
  _supa.auth.getSession().then(async({data})=>{
    if(data.session){
      _supaUser=data.session.user;
      await _checkAdminRole();
      _renderAuthUI();
      _renderAdminLink();
    }else{
      _renderAuthUI();
      _maybeAutoShowModal();
    }
  }).catch(e=>{
    console.warn('getSession error:',e);
    _maybeAutoShowModal();
  });
}

function _maybeAutoShowModal(){
  if(_supaUser)return;
  if(sessionStorage.getItem('meridian_modal_dismissed'))return;
  _showAuthModal();
}

function _dismissAuthModal(remember){
  const m=$('#supa-auth-modal');if(m)m.remove();
  if(remember)sessionStorage.setItem('meridian_modal_dismissed','1');
}

// ═══ 2. AUTH UI ═══
function _renderAuthUI(){
  const el=$('#auth-btn');if(!el)return;
  if(_supaUser){
    const email=_supaUser.email||'';
    const short=email.length>20?email.slice(0,17)+'...':email;
    const prefix=_supaIsAdmin?'\u{1F6E1}\uFE0F ':'';
    el.textContent=prefix+short;
    el.title=(_supaIsAdmin?'[Admin] ':'')+'Signed in as '+email+' — click to manage';
    el.onclick=_showAccountMenu;
  }else{
    el.textContent='Sign In';
    el.title='Sign in for cross-device sync';
    el.onclick=_showAuthModal;
  }
}

async function _checkAdminRole(){
  if(!_supa||!_supaUser){_supaIsAdmin=false;return}
  try{
    const{data,error}=await _supa.from('user_roles').select('role').eq('user_id',_supaUser.id).single();
    _supaIsAdmin=!error&&data?.role==='admin';
  }catch(e){
    _supaIsAdmin=false;
  }
}

function _renderAdminLink(){
  const el=$('#admin-link');if(!el)return;
  el.style.display=_supaIsAdmin?'inline-flex':'none';
}

function _showAccountMenu(){
  const existing=$('#supa-account-menu');if(existing){existing.remove();return}
  const m=document.createElement('div');m.id='supa-account-menu';
  m.style.cssText='position:fixed;top:60px;right:20px;z-index:10005;background:var(--bs);border:1px solid var(--ab);border-radius:10px;padding:16px;min-width:220px;animation:fadeIn .2s;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  m.innerHTML=`
    <div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:8px">Signed in as</div>
    <div style="font-size:13px;color:var(--ac);font-family:var(--mf);word-break:break-all;margin-bottom:14px">${_supaUser.email}</div>
    ${_supaIsAdmin?'<button class="bt sm" style="display:block;width:100%;text-align:center;color:var(--wa);border-color:rgba(212,160,74,.3);margin-bottom:8px;font-size:12px;box-sizing:border-box" onclick="document.getElementById(\'supa-account-menu\')?.remove();showAdminDashboard()">\u{1F6E1}\uFE0F Admin Dashboard</button>':''}
    <button class="bt sm" style="width:100%;color:var(--sg);border-color:var(--sb);margin-bottom:8px;font-size:12px" onclick="$('#supa-account-menu').remove();_syncOnLogin().then(()=>toast('Sync complete','ok'))">Sync Now</button>
    <button class="bt sm" style="width:100%;color:var(--co);border-color:rgba(194,120,120,.3);font-size:12px" onclick="$('#supa-account-menu').remove();_supaSignOut()">Sign Out</button>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  document.addEventListener('click',function _dismiss(e){if(!m.contains(e.target)&&e.target!==$('#auth-btn')){m.remove();document.removeEventListener('click',_dismiss)}},{capture:true,once:false});
  document.body.appendChild(m);
}

function _showAuthModal(){
  const existing=$('#supa-auth-modal');if(existing)existing.remove();
  const m=document.createElement('div');m.id='supa-auth-modal';
  m.style.cssText='position:fixed;inset:0;z-index:10006;background:rgba(6,5,14,.88);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML=`<div style="background:var(--bs);border:1px solid var(--ab);border-radius:14px;padding:32px 30px 24px;max-width:380px;width:100%;animation:fadeIn .3s;position:relative">
    <button style="position:absolute;top:12px;right:16px;background:0;border:0;color:var(--tm);font-size:22px;cursor:pointer;line-height:1" onclick="_dismissAuthModal(true)">&times;</button>
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:28px;font-family:var(--sf);color:var(--ac);font-weight:700;letter-spacing:.5px">Meridian</div>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-top:2px;letter-spacing:1px;text-transform:uppercase">Marine Research Engine</div>
    </div>
    <p style="font-size:12px;color:var(--tm);margin-bottom:18px;line-height:1.5;text-align:center">Sign in to sync your library and settings across devices.</p>
    <div id="supa-auth-error" style="display:none;padding:8px 12px;background:var(--cm);border:1px solid rgba(194,120,120,.3);border-radius:6px;font-size:12px;color:var(--co);margin-bottom:12px"></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      <button type="button" class="bt sm" style="width:100%;padding:10px;font-size:12px;color:var(--tx);border-color:var(--ab);display:flex;align-items:center;justify-content:center;gap:8px" onclick="_supaOAuth('google')">
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign in with Google
      </button>
      <button type="button" class="bt sm" style="width:100%;padding:10px;font-size:12px;color:var(--tx);border-color:var(--ab);display:flex;align-items:center;justify-content:center;gap:8px" onclick="_supaOAuth('github')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        Sign in with GitHub
      </button>
    </div>
    <div style="position:relative;text-align:center;margin-bottom:16px"><div style="border-top:1px solid var(--bd);position:absolute;top:50%;left:0;right:0"></div><span style="background:var(--bs);padding:0 10px;position:relative;font-size:11px;color:var(--tm);font-family:var(--mf)">or use email</span></div>
    <div id="supa-auth-tabs" style="display:flex;gap:0;margin-bottom:14px">
      <button type="button" class="bt sm" id="supa-tab-login" style="flex:1;border-radius:6px 0 0 6px;font-size:12px;color:var(--ac);border-color:var(--ab);background:var(--am)" onclick="_supaAuthTab('login')">Sign In</button>
      <button type="button" class="bt sm" id="supa-tab-signup" style="flex:1;border-radius:0 6px 6px 0;font-size:12px;color:var(--tm);border-color:var(--ab)" onclick="_supaAuthTab('signup')">Sign Up</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input class="si" id="supa-email" type="email" placeholder="Email" style="font-size:13px;padding:10px 12px">
      <input class="si" id="supa-pass" type="password" placeholder="Password" style="font-size:13px;padding:10px 12px">
      <button type="button" class="bt on" id="supa-submit" style="padding:10px;font-size:13px;margin-top:4px" onclick="_supaEmailAuth()">Sign In</button>
    </div>
    <div style="text-align:center;margin-top:16px">
      <a href="#" onclick="event.preventDefault();_dismissAuthModal(true)" style="font-size:12px;color:var(--tm);text-decoration:none;opacity:.8">Continue without account</a>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)_dismissAuthModal(true)});
  document.body.appendChild(m);
}

let _authMode='login';
function _supaAuthTab(mode){
  _authMode=mode;
  const l=$('#supa-tab-login'),s=$('#supa-tab-signup'),b=$('#supa-submit');
  if(mode==='login'){
    l.style.color='var(--ac)';l.style.background='var(--am)';
    s.style.color='var(--tm)';s.style.background='';
    b.textContent='Sign In';
  }else{
    s.style.color='var(--ac)';s.style.background='var(--am)';
    l.style.color='var(--tm)';l.style.background='';
    b.textContent='Sign Up';
  }
}

async function _supaEmailAuth(){
  const btn=$('#supa-submit');
  const email=$('#supa-email')?.value?.trim();
  const pass=$('#supa-pass')?.value;

  if(!email||!pass){_showAuthError('Enter email and password');return}
  if(!_supa){_showAuthError('Connection error — please reload the page');return}

  if(btn){btn.disabled=true;btn.textContent='...';}

  const{data,error}=_authMode==='login'
    ?await _supa.auth.signInWithPassword({email,password:pass})
    :await _supa.auth.signUp({email,password:pass});

  if(error){
    _showAuthError(error.message);
    if(btn){btn.disabled=false;btn.textContent=_authMode==='login'?'Sign In':'Sign Up';}
    return;
  }

  if(_authMode==='signup'&&!data.session){
    _showAuthError('Check your email for a confirmation link');
    if(btn){btn.disabled=false;btn.textContent='Sign Up';}
    return;
  }

  // Session acquired — close modal and update UI immediately.
  // onAuthStateChange SIGNED_IN will also fire for sync/admin check.
  if(data.session){
    _supaUser=data.session.user;
    _dismissAuthModal(false);
    _renderAuthUI();
    _renderAdminLink();
  }
}

function _showAuthError(msg){
  const el=$('#supa-auth-error');if(!el)return;
  el.textContent=msg;el.style.display='block';
}

async function _supaOAuth(provider){
  if(!_supa)return;
  const{error}=await _supa.auth.signInWithOAuth({provider,options:{redirectTo:'https://meridian-engine.com'}});
  if(error)_showAuthError(error.message);
}

async function _supaSignOut(){
  if(!_supa)return;
  await _supa.auth.signOut();
  // onAuthStateChange SIGNED_OUT handler clears _supaUser, _supaIsAdmin and updates UI
}

// ═══ 3. CLOUD CRUD ═══
async function _supaUpsertPaper(paper){
  if(!_supa||!_supaUser)return;
  const row={
    user_id:_supaUser.id,
    title:paper.title||null,
    authors:Array.isArray(paper.authors)?paper.authors.join('; '):paper.authors||null,
    abstract:paper.abstract||null,
    doi:paper.doi||null,
    source:paper.source||null,
    year:paper.year||null,
    journal:paper.journal||null,
    concepts:paper.concepts||[],
    tags:paper.tags||[],
    notes:paper.notes||null,
    findings:paper.findings||null,
    project:paper.project||'Default',
    local_id:paper.id,
    saved_at:paper.savedAt||new Date().toISOString()
  };
  // Upsert by user_id + local_id
  const{data:existing}=await _supa.from('library_papers').select('id').eq('user_id',_supaUser.id).eq('local_id',paper.id).maybeSingle();
  if(existing){
    await _supa.from('library_papers').update(row).eq('id',existing.id);
  }else{
    await _supa.from('library_papers').insert(row);
  }
}

async function _supaDeletePaper(localId){
  if(!_supa||!_supaUser)return;
  await _supa.from('library_papers').delete().eq('user_id',_supaUser.id).eq('local_id',localId);
}

async function _supaFetchPapers(){
  if(!_supa||!_supaUser)return[];
  const{data,error}=await _supa.from('library_papers').select('*').eq('user_id',_supaUser.id);
  if(error){console.warn('Supabase fetch papers:',error);return[]}
  return data||[];
}

async function _supaSaveSettings(){
  if(!_supa||!_supaUser)return;
  const row={
    user_id:_supaUser.id,
    ai_provider:S.aiProvider||'anthropic',
    ai_model:S.aiModel||'',
    theme:document.documentElement.classList.contains('light')?'light':'dark',
    preferences_json:{
      skillLevel:S.skillLevel,
      activeProject:S.activeProject
    }
  };
  const{data:existing}=await _supa.from('user_settings').select('id').eq('user_id',_supaUser.id).maybeSingle();
  if(existing)await _supa.from('user_settings').update(row).eq('id',existing.id);
  else await _supa.from('user_settings').insert(row);
}

async function _supaLoadSettings(){
  if(!_supa||!_supaUser)return null;
  const{data}=await _supa.from('user_settings').select('*').eq('user_id',_supaUser.id).maybeSingle();
  return data;
}

// ═══ 4. SYNC ON LOGIN ═══
async function _syncOnLogin(){
  if(!_supa||!_supaUser||_syncInProgress)return;
  _syncInProgress=true;
  try{
    // Fetch cloud papers
    const cloudPapers=await _supaFetchPapers();
    const localPapers=S.lib||[];

    // Build DOI and local_id indexes for dedup
    const localByDoi={};const localById={};
    for(const p of localPapers){
      if(p.doi)localByDoi[p.doi.toLowerCase()]=p;
      localById[p.id]=p;
    }

    let imported=0;
    for(const cp of cloudPapers){
      const doi=cp.doi?.toLowerCase();
      // Skip if already exists locally (by DOI or local_id)
      if(doi&&localByDoi[doi])continue;
      if(cp.local_id&&localById[cp.local_id])continue;
      // Import cloud paper to local IDB
      const lp={
        id:cp.local_id||('m'+Date.now()+Math.random()),
        title:cp.title||'',
        authors:cp.authors?cp.authors.split('; '):[],
        abstract:cp.abstract||'',
        doi:cp.doi||'',
        source:cp.source||'',
        year:cp.year||null,
        journal:cp.journal||'',
        concepts:cp.concepts||[],
        tags:cp.tags||[],
        notes:cp.notes||'',
        findings:cp.findings||null,
        project:cp.project||'Default',
        savedAt:cp.saved_at||new Date().toISOString()
      };
      await dbPut(lp);
      imported++;
    }

    // Push local papers that aren't in cloud
    const cloudByDoi={};const cloudByLocalId={};
    for(const cp of cloudPapers){
      if(cp.doi)cloudByDoi[cp.doi.toLowerCase()]=true;
      if(cp.local_id)cloudByLocalId[cp.local_id]=true;
    }
    let pushed=0;
    for(const lp of localPapers){
      const doi=lp.doi?.toLowerCase();
      if(doi&&cloudByDoi[doi])continue;
      if(cloudByLocalId[lp.id])continue;
      await _supaUpsertPaper(lp);
      pushed++;
    }

    if(imported>0){
      await loadLib();renderLib();
      toast(imported+' paper'+(imported>1?'s':'')+' synced from cloud','ok');
    }
    if(pushed>0)toast(pushed+' local paper'+(pushed>1?'s':'')+' backed up to cloud','ok');

    // Sync settings
    const cloudSettings=await _supaLoadSettings();
    if(cloudSettings?.preferences_json){
      // Only apply if user hasn't set locally
      if(cloudSettings.theme){
        const curTheme=document.documentElement.classList.contains('light')?'light':'dark';
        if(curTheme!==cloudSettings.theme&&typeof toggleTheme==='function'){toggleTheme()}
      }
    }else{
      await _supaSaveSettings();
    }
  }catch(e){
    console.warn('Sync error:',e);
  }
  _syncInProgress=false;
}

// ═══ 5. OFFLINE QUEUE ═══
const _QUEUE_KEY='meridian_sync_queue';

function _queuePush(op){
  if(!_supaUser)return;
  const q=safeParse(_QUEUE_KEY,[]);
  q.push({...op,ts:Date.now()});
  safeStore(_QUEUE_KEY,q);
}

async function _flushQueue(){
  if(!_supa||!_supaUser)return;
  const q=safeParse(_QUEUE_KEY,[]);
  if(!q.length)return;
  safeStore(_QUEUE_KEY,[]);
  for(const op of q){
    try{
      if(op.type==='upsert_paper')await _supaUpsertPaper(op.data);
      else if(op.type==='delete_paper')await _supaDeletePaper(op.localId);
      else if(op.type==='save_settings')await _supaSaveSettings();
    }catch(e){
      console.warn('Queue flush error:',e);
    }
  }
}

// Flush when coming back online
window.addEventListener('online',()=>{if(_supaUser)_flushQueue()});

// ═══ 6. HOOKS INTO DATA LAYER ═══
function _hookDataLayer(){
  // Wrap dbPut to sync papers to cloud
  const _origDbPut=dbPut;
  dbPut=async function(p){
    await _origDbPut(p);
    if(_supaUser){
      if(navigator.onLine)_supaUpsertPaper(p).catch(e=>console.warn('Cloud sync:',e));
      else _queuePush({type:'upsert_paper',data:p});
    }
  };

  // Wrap dbDel to sync deletions
  const _origDbDel=dbDel;
  dbDel=async function(id){
    await _origDbDel(id);
    if(_supaUser){
      if(navigator.onLine)_supaDeletePaper(id).catch(e=>console.warn('Cloud delete:',e));
      else _queuePush({type:'delete_paper',localId:id});
    }
  };

  // Periodically save settings when logged in
  let _settingsTimer=null;
  const _origSafeStore=safeStore;
  safeStore=function(key,val){
    _origSafeStore(key,val);
    // Debounce settings sync for relevant keys
    if(_supaUser&&['meridian_provider','meridian_theme','meridian_skill','meridian_active_project'].some(k=>key.startsWith(k))){
      clearTimeout(_settingsTimer);
      _settingsTimer=setTimeout(()=>{
        if(navigator.onLine)_supaSaveSettings().catch(()=>{});
        else _queuePush({type:'save_settings'});
      },2000);
    }
  };
}

// ═══ 7. ADMIN DASHBOARD OVERLAY ═══
let _admOverlay=null;
let _admAllUsers=[];
let _admSort={col:'created_at',asc:false};

function showAdminDashboard(){
  if(_admOverlay)return;
  if(!_supaIsAdmin){toast('Admin access required','err');return}
  const supa=_supaGetClient();
  if(!supa)return;

  _admOverlay=document.createElement('div');
  _admOverlay.id='admin-overlay';

  _admOverlay.innerHTML=`<style>
#admin-overlay{position:fixed;inset:0;z-index:10003;background:var(--bg);overflow-y:auto;animation:fadeIn .3s}
#admin-overlay .adm-wrap{max-width:1100px;margin:0 auto;padding:30px 30px 60px}
#admin-overlay .adm-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--bd)}
#admin-overlay .adm-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:28px}
#admin-overlay .adm-stat{background:var(--bs);border:1px solid var(--ab);border-radius:var(--rd);padding:16px;text-align:center;animation:fadeIn .3s}
#admin-overlay .adm-stat .val{font-size:26px;font-weight:700;color:var(--ac);font-family:var(--mf)}
#admin-overlay .adm-stat .lbl{font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
#admin-overlay .adm-card{background:var(--bs);border:1px solid var(--ab);border-radius:var(--rd);padding:20px;margin-bottom:20px;animation:fadeIn .3s}
#admin-overlay .adm-card h2{font-size:16px;color:var(--ac);margin-bottom:14px;font-family:var(--sf);display:flex;align-items:center;gap:8px}
#admin-overlay .adm-count{font-size:11px;color:var(--tm);font-family:var(--mf);font-weight:400}
#admin-overlay table{width:100%;border-collapse:collapse;font-size:12px;font-family:var(--mf)}
#admin-overlay th{text-align:left;padding:8px 10px;color:var(--tm);border-bottom:1px solid var(--ab);font-weight:500;text-transform:uppercase;letter-spacing:.5px;font-size:10px;white-space:nowrap;cursor:pointer;user-select:none}
#admin-overlay th:hover{color:var(--ac)}
#admin-overlay th.sorted{color:var(--ac)}
#admin-overlay td{padding:8px 10px;border-bottom:1px solid var(--bd);color:var(--ts);max-width:200px;overflow:hidden;text-overflow:ellipsis}
#admin-overlay tr:hover td{background:rgba(201,149,107,.03)}
#admin-overlay .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
#admin-overlay .badge.admin{background:var(--am);color:var(--ac)}
#admin-overlay .badge.user{background:rgba(123,158,135,.10);color:var(--sg)}
#admin-overlay .badge.banned{background:rgba(194,120,120,.10);color:var(--co)}
#admin-overlay .adm-filters{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
#admin-overlay .adm-filters input,#admin-overlay .adm-filters select{background:var(--bi);border:1px solid var(--ab);border-radius:6px;padding:6px 10px;font-size:12px;font-family:var(--mf);color:var(--tx);outline:none}
#admin-overlay .adm-filters input:focus,#admin-overlay .adm-filters select:focus{border-color:var(--ac)}
#admin-overlay .adm-filters input{flex:1;min-width:180px}
#admin-overlay .adm-filters select{min-width:100px}
#admin-overlay .adm-chart-wrap{height:160px;margin-bottom:8px;display:flex;align-items:flex-end;gap:2px;padding:10px 0}
#admin-overlay .adm-bar{background:var(--ac);border-radius:3px 3px 0 0;min-width:6px;flex:1;transition:height .3s;position:relative;cursor:default}
#admin-overlay .adm-bar:hover{opacity:.8}
#admin-overlay .adm-bar .tip{display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--bi);border:1px solid var(--ab);border-radius:4px;padding:3px 6px;font-size:10px;font-family:var(--mf);color:var(--tx);white-space:nowrap;margin-bottom:4px}
#admin-overlay .adm-bar:hover .tip{display:block}
#admin-overlay .adm-chart-labels{display:flex;gap:2px;font-size:9px;font-family:var(--mf);color:var(--tm)}
#admin-overlay .adm-chart-labels span{flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis}
#admin-overlay .adm-log{display:grid;grid-template-columns:140px 1fr;gap:8px;padding:8px 0;border-bottom:1px solid var(--bd);font-family:var(--mf);font-size:11px}
#admin-overlay .adm-log:last-child{border-bottom:0}
#admin-overlay .adm-log-time{color:var(--tm);font-size:10px}
#admin-overlay .adm-log-action{color:var(--ts)}
#admin-overlay .adm-log-action .act{font-weight:600}
#admin-overlay .adm-log-action .act.ban_user,#admin-overlay .adm-log-action .act.delete_user{color:var(--co)}
#admin-overlay .adm-log-action .act.unban_user{color:var(--sg)}
#admin-overlay .adm-log-action .act.change_role{color:rgba(212,160,74,1)}
#admin-overlay .adm-role-select{background:var(--bi);border:1px solid var(--ab);border-radius:4px;padding:2px 4px;font-size:10px;font-family:var(--mf);color:var(--tx);cursor:pointer}
#admin-overlay .adm-actions-cell{display:flex;gap:4px;flex-wrap:nowrap}
#admin-overlay .adm-empty{text-align:center;padding:30px;color:var(--tm);font-size:13px}
#adm-library-modal{position:fixed;inset:0;z-index:10006;background:rgba(6,5,14,.88);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
#adm-library-modal .adm-modal-box{background:var(--bs);border:1px solid var(--ab);border-radius:14px;padding:24px;max-width:700px;width:100%;max-height:80vh;overflow-y:auto;animation:fadeIn .3s;position:relative}
</style>
<div class="adm-wrap">
  <div class="adm-hdr">
    <h1 style="font-size:22px;color:var(--ac);font-family:var(--sf)">Admin Dashboard</h1>
    <div style="display:flex;align-items:center;gap:14px">
      <span style="font-family:var(--mf);font-size:11px;color:var(--ts)">${_admEsc(_supaUser?.email||'')}</span>
      <button class="bt sm" onclick="closeAdminDashboard()" style="color:var(--tm);border-color:var(--ab);font-size:12px">&larr; Back to Meridian</button>
    </div>
  </div>
  <div id="adm-loading" style="text-align:center;padding:60px 20px;color:var(--tm);font-family:var(--mf);font-size:13px">Loading dashboard...</div>
  <div id="adm-content" style="display:none">
    <div id="adm-stats" class="adm-stats"></div>
    <div class="adm-card" id="adm-chart-card">
      <h2>Signups Over Time <span class="adm-count">(last 30 days)</span></h2>
      <div id="adm-signup-chart" class="adm-chart-wrap"></div>
      <div id="adm-signup-labels" class="adm-chart-labels"></div>
    </div>
    <div class="adm-card">
      <h2>Users <span id="adm-user-count" class="adm-count"></span></h2>
      <div class="adm-filters">
        <input type="text" id="adm-filter-email" placeholder="Search by email..." oninput="_admFilterUsers()">
        <select id="adm-filter-role" onchange="_admFilterUsers()">
          <option value="">All roles</option><option value="admin">Admin</option><option value="user">User</option><option value="banned">Banned</option>
        </select>
        <select id="adm-filter-provider" onchange="_admFilterUsers()">
          <option value="">All providers</option><option value="google">Google</option><option value="github">GitHub</option><option value="email">Email</option>
        </select>
      </div>
      <div id="adm-users-table" style="overflow-x:auto"></div>
    </div>
    <div class="adm-card">
      <h2>Admin Actions Log <span id="adm-log-count" class="adm-count"></span></h2>
      <div id="adm-logs"></div>
    </div>
  </div>
</div>
<div id="adm-library-modal" style="display:none" onclick="if(event.target===this)this.style.display='none'">
  <div class="adm-modal-box">
    <button style="position:absolute;top:12px;right:16px;background:0;border:0;color:var(--tm);font-size:22px;cursor:pointer;line-height:1" onclick="document.getElementById('adm-library-modal').style.display='none'">&times;</button>
    <h3 id="adm-library-title" style="color:var(--ac);font-size:16px;margin-bottom:14px">User Library</h3>
    <div id="adm-library-content"></div>
  </div>
</div>`;

  document.body.appendChild(_admOverlay);
  document.body.style.overflow='hidden';
  document.addEventListener('keydown',_admEscHandler);
  _admLoadAll(supa);
}

function closeAdminDashboard(){
  if(!_admOverlay)return;
  _admOverlay.remove();
  _admOverlay=null;
  _admAllUsers=[];
  document.body.style.overflow='';
  document.removeEventListener('keydown',_admEscHandler);
}

function _admEscHandler(e){
  if(e.key==='Escape'){
    const lib=document.getElementById('adm-library-modal');
    if(lib&&lib.style.display!=='none'){lib.style.display='none';return}
    closeAdminDashboard();
  }
}

function _admEsc(s){return s?s.replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'):''}

async function _admLoadAll(supa){
  const{data:{session}}=await supa.auth.getSession();
  if(!session){toast('Session expired','err');closeAdminDashboard();return}
  const{data:role}=await supa.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
  if(!role||role.role!=='admin'){toast('Admin access denied','err');closeAdminDashboard();return}
  const loading=document.getElementById('adm-loading');
  const content=document.getElementById('adm-content');
  if(loading)loading.style.display='none';
  if(content)content.style.display='block';
  _admLoadStats(supa);_admLoadUsers(supa);_admLoadChart(supa);_admLoadLogs(supa);
}

async function _admLoadStats(supa){
  const el=document.getElementById('adm-stats');if(!el)return;
  const{data,error}=await supa.rpc('admin_get_stats');
  if(error){el.innerHTML='<div class="adm-empty">Failed to load stats</div>';return}
  const items=[
    {val:data.total_users,lbl:'Total Users'},{val:data.active_7d,lbl:'Active (7d)'},
    {val:data.users_today,lbl:'Signups Today'},{val:data.users_this_week,lbl:'This Week'},
    {val:data.total_papers,lbl:'Papers Saved'},{val:data.total_presets,lbl:'Env Presets'},
    {val:data.total_workshop,lbl:'Workshop Sets'},{val:data.total_analyses,lbl:'Analyses'}
  ];
  el.innerHTML=items.map(s=>'<div class="adm-stat"><div class="val">'+(s.val||0)+'</div><div class="lbl">'+s.lbl+'</div></div>').join('');
}

async function _admLoadChart(supa){
  const chartCard=document.getElementById('adm-chart-card');
  const{data,error}=await supa.rpc('admin_signups_over_time');
  if(error||!data){if(chartCard)chartCard.style.display='none';return}
  const max=Math.max(...data.map(d=>d.signups),1);
  let bars='',labels='';
  for(const d of data){
    const h=Math.max((d.signups/max)*130,2);
    const dt=new Date(d.day);
    const label=(dt.getMonth()+1)+'/'+dt.getDate();
    bars+='<div class="adm-bar" style="height:'+h+'px"><span class="tip">'+label+': '+d.signups+'</span></div>';
    labels+='<span>'+label+'</span>';
  }
  const chart=document.getElementById('adm-signup-chart');
  const lbls=document.getElementById('adm-signup-labels');
  if(chart)chart.innerHTML=bars;
  if(lbls)lbls.innerHTML=labels;
}

async function _admLoadUsers(supa){
  const el=document.getElementById('adm-users-table');if(!el)return;
  const{data,error}=await supa.rpc('admin_list_users');
  if(error){el.innerHTML='<div class="adm-empty">Failed to load users: '+error.message+'</div>';return}
  _admAllUsers=data||[];
  const ct=document.getElementById('adm-user-count');
  if(ct)ct.textContent='('+_admAllUsers.length+')';
  _admRenderUsers(_admAllUsers);
}

function _admFilterUsers(){
  const q=(document.getElementById('adm-filter-email')?.value||'').toLowerCase().trim();
  const role=document.getElementById('adm-filter-role')?.value||'';
  const provider=document.getElementById('adm-filter-provider')?.value||'';
  let filtered=_admAllUsers;
  if(q)filtered=filtered.filter(u=>u.email&&u.email.toLowerCase().includes(q));
  if(role){
    if(role==='banned')filtered=filtered.filter(u=>u.is_banned);
    else filtered=filtered.filter(u=>u.role===role&&!u.is_banned);
  }
  if(provider)filtered=filtered.filter(u=>u.provider===provider);
  _admRenderUsers(filtered);
}

function _admSortUsers(col){
  if(_admSort.col===col)_admSort.asc=!_admSort.asc;
  else{_admSort.col=col;_admSort.asc=true}
  _admFilterUsers();
}

function _admRenderUsers(users){
  const el=document.getElementById('adm-users-table');if(!el)return;
  if(!users.length){el.innerHTML='<div class="adm-empty">No users found</div>';return}
  const{col,asc}=_admSort;
  users=[...users].sort((a,b)=>{
    let va=a[col],vb=b[col];
    if(va==null)va='';if(vb==null)vb='';
    if(typeof va==='number')return asc?va-vb:vb-va;
    if(typeof va==='string')return asc?va.localeCompare(vb):vb.localeCompare(va);
    return 0;
  });
  const arrow=_admSort.asc?' &#9650;':' &#9660;';
  const sc=c=>_admSort.col===c?'sorted':'';
  let html='<table><thead><tr>';
  html+='<th class="'+sc('email')+'" onclick="_admSortUsers(\'email\')">Email'+(sc('email')?arrow:'')+'</th>';
  html+='<th class="'+sc('provider')+'" onclick="_admSortUsers(\'provider\')">Provider'+(sc('provider')?arrow:'')+'</th>';
  html+='<th class="'+sc('role')+'" onclick="_admSortUsers(\'role\')">Role'+(sc('role')?arrow:'')+'</th>';
  html+='<th class="'+sc('created_at')+'" onclick="_admSortUsers(\'created_at\')">Signed Up'+(sc('created_at')?arrow:'')+'</th>';
  html+='<th class="'+sc('last_sign_in_at')+'" onclick="_admSortUsers(\'last_sign_in_at\')">Last Login'+(sc('last_sign_in_at')?arrow:'')+'</th>';
  html+='<th class="'+sc('papers_count')+'" onclick="_admSortUsers(\'papers_count\')">Papers'+(sc('papers_count')?arrow:'')+'</th>';
  html+='<th class="'+sc('presets_count')+'" onclick="_admSortUsers(\'presets_count\')">Presets'+(sc('presets_count')?arrow:'')+'</th>';
  html+='<th>Actions</th>';
  html+='</tr></thead><tbody>';
  for(const u of users){
    const signup=u.created_at?new Date(u.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
    const last=u.last_sign_in_at?_admTimeAgo(new Date(u.last_sign_in_at)):'Never';
    const providerLabel=u.provider==='google'?'Google':u.provider==='github'?'GitHub':'Email';
    const roleBadge=u.is_banned?'<span class="badge banned">banned</span>'
      :u.role==='admin'?'<span class="badge admin">admin</span>'
      :'<span class="badge user">user</span>';
    const viewLib=(u.papers_count||0)>0?'<button class="bt sm" style="padding:2px 6px;font-size:10px;color:var(--ac);border-color:var(--ab)" onclick="_admViewLibrary(\''+u.id+'\',\''+_admEsc(u.email)+'\')">View</button>':'—';
    html+='<tr>';
    html+='<td style="color:var(--tx)">'+_admEsc(u.email)+'</td>';
    html+='<td>'+providerLabel+'</td>';
    html+='<td>'+roleBadge+'</td>';
    html+='<td>'+signup+'</td>';
    html+='<td>'+last+'</td>';
    html+='<td style="text-align:center">'+(u.papers_count||0)+' '+viewLib+'</td>';
    html+='<td style="text-align:center">'+(u.presets_count||0)+'</td>';
    html+='<td><div class="adm-actions-cell">'+_admRenderActions(u)+'</div></td>';
    html+='</tr>';
  }
  html+='</tbody></table>';
  el.innerHTML=html;
}

function _admRenderActions(u){
  const isSelf=u.email===_supaUser?.email;
  if(isSelf)return '<span style="color:var(--tm);font-size:10px">you</span>';
  let btns='<select class="adm-role-select" onchange="_admChangeRole(\''+u.id+'\',this.value)">';
  btns+='<option value="user"'+(u.role!=='admin'&&!u.is_banned?' selected':'')+'>user</option>';
  btns+='<option value="admin"'+(u.role==='admin'?' selected':'')+'>admin</option>';
  btns+='<option value="banned"'+(u.is_banned?' selected':'')+'>banned</option>';
  btns+='</select>';
  btns+=' <button class="bt sm" style="padding:2px 6px;font-size:10px;color:var(--co);border-color:rgba(194,120,120,.3)" onclick="_admDeleteUser(\''+u.id+'\',\''+_admEsc(u.email)+'\')">Delete</button>';
  return btns;
}

function _admTimeAgo(date){
  const s=Math.floor((Date.now()-date.getTime())/1000);
  if(s<60)return 'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  if(s<604800)return Math.floor(s/86400)+'d ago';
  return date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

async function _admChangeRole(userId,newRole){
  const supa=_supaGetClient();if(!supa)return;
  const action=newRole==='banned'?'ban':'set role to '+newRole+' for';
  if(!confirm('Are you sure you want to '+action+' this user?'))return _admLoadUsers(supa);
  const{error}=await supa.rpc('admin_set_user_role',{target_user_id:userId,new_role:newRole});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa);_admLoadLogs(supa);
}

async function _admDeleteUser(userId,email){
  const supa=_supaGetClient();if(!supa)return;
  if(!confirm('Permanently delete user '+email+'? This removes all their data and cannot be undone.'))return;
  if(!confirm('Final confirmation: DELETE '+email+'?'))return;
  const{error}=await supa.rpc('admin_delete_user',{target_user_id:userId});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa);_admLoadStats(supa);_admLoadLogs(supa);
}

async function _admViewLibrary(userId,email){
  const supa=_supaGetClient();if(!supa)return;
  const modal=document.getElementById('adm-library-modal');
  const content=document.getElementById('adm-library-content');
  const title=document.getElementById('adm-library-title');
  if(!modal||!content)return;
  if(title)title.textContent='Library: '+email;
  content.innerHTML='<div class="adm-empty">Loading...</div>';
  modal.style.display='flex';
  const{data,error}=await supa.rpc('admin_get_user_papers',{target_user_id:userId});
  if(error){content.innerHTML='<div class="adm-empty">Error: '+error.message+'</div>';return}
  if(!data||!data.length){content.innerHTML='<div class="adm-empty">No papers</div>';return}
  let html='<table><thead><tr><th>Title</th><th>Authors</th><th>Journal</th><th>Year</th><th>DOI</th><th>Project</th></tr></thead><tbody>';
  for(const p of data){
    const doi=p.doi?'<a href="https://doi.org/'+_admEsc(p.doi)+'" target="_blank" rel="noopener" style="font-size:10px">'+_admEsc(p.doi)+'</a>':'—';
    html+='<tr><td style="color:var(--tx);max-width:250px">'+_admEsc(p.title||'Untitled')+'</td><td style="max-width:150px">'+_admEsc(p.authors||'—')+'</td><td>'+_admEsc(p.journal||'—')+'</td><td>'+(p.year||'—')+'</td><td>'+doi+'</td><td>'+_admEsc(p.project||'—')+'</td></tr>';
  }
  html+='</tbody></table>';
  content.innerHTML=html;
}

async function _admLoadLogs(supa){
  const el=document.getElementById('adm-logs');if(!el)return;
  const{data,error}=await supa.rpc('admin_get_logs',{lim:50});
  if(error){el.innerHTML='<div class="adm-empty">Failed to load logs</div>';return}
  if(!data||!data.length){el.innerHTML='<div class="adm-empty">No admin actions recorded yet</div>';return}
  const ct=document.getElementById('adm-log-count');
  if(ct)ct.textContent='('+data.length+')';
  let html='';
  for(const log of data){
    const time=new Date(log.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    html+='<div class="adm-log"><div class="adm-log-time">'+time+'</div><div class="adm-log-action">'+_admFormatAction(log)+'</div></div>';
  }
  el.innerHTML=html;
}

function _admFormatAction(log){
  const admin='<span style="color:var(--ac)">'+_admEsc(log.admin_email||'unknown')+'</span>';
  const target='<span style="color:var(--tx)">'+_admEsc(log.target_email||'deleted user')+'</span>';
  switch(log.action){
    case 'ban_user':return admin+' <span class="act ban_user">banned</span> '+target;
    case 'unban_user':return admin+' <span class="act unban_user">unbanned</span> '+target;
    case 'change_role':{
      const d=log.details||{};
      return admin+' <span class="act change_role">changed role</span> of '+target+' from <b>'+_admEsc(d.old_role||'?')+'</b> to <b>'+_admEsc(d.new_role||'?')+'</b>';
    }
    case 'delete_user':{
      const email=log.details?.email||'unknown';
      return admin+' <span class="act delete_user">deleted</span> '+_admEsc(email);
    }
    default:return admin+' <span class="act">'+_admEsc(log.action)+'</span> '+target;
  }
}

// ═══ 8. INIT ═══
// Run immediately — this script loads at bottom of <body>, DOM is ready
_supaInit();
_hookDataLayer();
