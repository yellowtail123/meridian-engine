// ═══ MERIDIAN SUPABASE — User Accounts & Cloud Sync ═══
// Optional cloud persistence — app works fully without an account.
// Loads after meridian-core.js (needs S, $, safeStore, safeParse, toast)

const SUPA_URL='https://wgqfxgxnanvckgqkuqas.supabase.co';
const SUPA_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncWZ4Z3huYW52Y2tncWt1cWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDA0MzEsImV4cCI6MjA4OTYxNjQzMX0.PZ6ATWCJ_qyJVTXgFNmVKzBBxOQlEpa_vXLAhKVdgzg';

let _supa=null;
let _supaUser=null;
let _supaIsAdmin=false;
let _syncInProgress=false;

// ═══ 1. INIT ═══
function _supaInit(){
  // Set onclick immediately so button always works, even if SDK fails
  const btn=$('#auth-btn');
  if(btn)btn.onclick=_showAuthModal;

  if(typeof window.supabase==='undefined'){
    console.warn('Supabase SDK not loaded');
    _maybeAutoShowModal();
    return;
  }
  try{
    _supa=window.supabase.createClient(SUPA_URL,SUPA_ANON);
    console.log('[Meridian Auth] Supabase client created:', !!_supa);
  }catch(e){console.warn('Supabase init failed:',e);_maybeAutoShowModal();return}

  _supa.auth.onAuthStateChange(async(event,session)=>{
    try{
      _supaUser=session?.user||null;
      if(_supaUser){await _checkAdminRole();_dismissAuthModal(false)}else{_supaIsAdmin=false}
      _renderAuthUI();
      _renderAdminLink();
      if(event==='SIGNED_IN'&&_supaUser){
        toast('Signed in as '+_supaUser.email,'ok');
        await _syncOnLogin();
        _flushQueue();
      }
      if(event==='SIGNED_OUT'){
        _supaUser=null;
        _supaIsAdmin=false;
        _renderAdminLink();
        toast('Signed out','info');
      }
    }catch(e){console.warn('Auth state change error:',e)}
  });

  _supa.auth.getSession().then(async({data})=>{
    _supaUser=data.session?.user||null;
    if(_supaUser)await _checkAdminRole();
    _renderAuthUI();
    _renderAdminLink();
    if(!_supaUser)_maybeAutoShowModal();
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
    el.textContent=short;
    el.title='Signed in as '+email+' — click to manage';
    el.onclick=_showAccountMenu;
  }else{
    el.textContent='Sign In';
    el.title='Sign in for cross-device sync';
    el.onclick=_showAuthModal;
  }
}

async function _checkAdminRole(){
  if(!_supa||!_supaUser){_supaIsAdmin=false;console.log('[Meridian Auth] admin check skipped — no client or user');return}
  try{
    const{data,error}=await _supa.from('user_roles').select('role').eq('user_id',_supaUser.id).maybeSingle();
    console.log('[Meridian Auth] admin check result:', data, error||'no error');
    _supaIsAdmin=data?.role==='admin';
  }catch(e){console.warn('[Meridian Auth] admin check failed:', e);_supaIsAdmin=false}
  console.log('[Meridian Auth] isAdmin:', _supaIsAdmin);
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
  console.log('[Meridian Auth] _supaEmailAuth called');
  const btn=$('#supa-submit');
  try{
    const email=$('#supa-email')?.value?.trim();
    const pass=$('#supa-pass')?.value;
    console.log('[Meridian Auth] email:', email, 'pass length:', pass?.length||0);

    if(!email||!pass){_showAuthError('Enter email and password');return}

    if(!_supa){
      console.error('[Meridian Auth] Supabase client is null — SDK may not have loaded');
      _showAuthError('Connection error — please reload the page');
      return;
    }

    if(btn){btn.disabled=true;btn.textContent='...';}

    console.log('[Meridian Auth] calling signInWithPassword, mode:', _authMode);
    let result;
    if(_authMode==='login'){
      result=await _supa.auth.signInWithPassword({email,password:pass});
    }else{
      result=await _supa.auth.signUp({email,password:pass});
    }
    console.log('[Meridian Auth] auth result:', result.error?'error: '+result.error.message:'success');

    if(result.error)throw result.error;
    if(_authMode==='signup'&&!result.data.session){
      _showAuthError('Check your email for a confirmation link');
      if(btn){btn.disabled=false;btn.textContent='Sign Up';}
      return;
    }
    _dismissAuthModal(false);
  }catch(e){
    console.error('[Meridian Auth] error:', e);
    _showAuthError(e?.message||'Authentication failed');
    if(btn){btn.disabled=false;btn.textContent=_authMode==='login'?'Sign In':'Sign Up';}
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
  _supaUser=null;
  _renderAuthUI();
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

// ═══ 7. INIT ═══
// Run immediately — this script loads at bottom of <body>, DOM is ready
_supaInit();
_hookDataLayer();
