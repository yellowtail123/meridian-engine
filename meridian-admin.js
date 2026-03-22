// ═══ MERIDIAN ADMIN — Dashboard Overlay ═══
// Full-screen overlay admin dashboard within the SPA.
// Loads after meridian-auth.js and meridian-supabase.js.

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
  // Don't close if library sub-modal is open
  if(e.key==='Escape'){
    const lib=document.getElementById('adm-library-modal');
    if(lib&&lib.style.display!=='none'){lib.style.display='none';return}
    closeAdminDashboard();
  }
}

function _admEsc(s){return s?s.replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'):''}

async function _admLoadAll(supa){
  // Verify admin session
  const{data:{session}}=await supa.auth.getSession();
  if(!session){toast('Session expired','err');closeAdminDashboard();return}
  const{data:role}=await supa.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
  if(!role||role.role!=='admin'){toast('Admin access denied','err');closeAdminDashboard();return}

  const loading=document.getElementById('adm-loading');
  const content=document.getElementById('adm-content');
  if(loading)loading.style.display='none';
  if(content)content.style.display='block';

  _admLoadStats(supa);
  _admLoadUsers(supa);
  _admLoadChart(supa);
  _admLoadLogs(supa);
}

// ═══ STATS ═══
async function _admLoadStats(supa){
  const el=document.getElementById('adm-stats');if(!el)return;
  const{data,error}=await supa.rpc('admin_get_stats');
  if(error){el.innerHTML='<div class="adm-empty">Failed to load stats</div>';return}
  const items=[
    {val:data.total_users,lbl:'Total Users'},
    {val:data.active_7d,lbl:'Active (7d)'},
    {val:data.users_today,lbl:'Signups Today'},
    {val:data.users_this_week,lbl:'This Week'},
    {val:data.total_papers,lbl:'Papers Saved'},
    {val:data.total_presets,lbl:'Env Presets'},
    {val:data.total_workshop,lbl:'Workshop Sets'},
    {val:data.total_analyses,lbl:'Analyses'}
  ];
  el.innerHTML=items.map(s=>'<div class="adm-stat"><div class="val">'+(s.val||0)+'</div><div class="lbl">'+s.lbl+'</div></div>').join('');
}

// ═══ SIGNUP CHART ═══
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

// ═══ USERS ═══
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

// ═══ ADMIN ACTIONS ═══
async function _admChangeRole(userId,newRole){
  const supa=_supaGetClient();if(!supa)return;
  const action=newRole==='banned'?'ban':'set role to '+newRole+' for';
  if(!confirm('Are you sure you want to '+action+' this user?'))return _admLoadUsers(supa);
  const{error}=await supa.rpc('admin_set_user_role',{target_user_id:userId,new_role:newRole});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa);
  _admLoadLogs(supa);
}

async function _admDeleteUser(userId,email){
  const supa=_supaGetClient();if(!supa)return;
  if(!confirm('Permanently delete user '+email+'? This removes all their data and cannot be undone.'))return;
  if(!confirm('Final confirmation: DELETE '+email+'?'))return;
  const{error}=await supa.rpc('admin_delete_user',{target_user_id:userId});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa);
  _admLoadStats(supa);
  _admLoadLogs(supa);
}

// ═══ VIEW USER LIBRARY ═══
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

// ═══ ADMIN LOGS ═══
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
