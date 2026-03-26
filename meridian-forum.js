// ═══════════════════════════════════════════════════════════════════
// MERIDIAN ENGINE — Research Hub (Reddit-style Community Forum)
// Feed, threads, voting, comments, moderation, UserBadge
// ═══════════════════════════════════════════════════════════════════

(function(){
'use strict';

// ── State ──
let _posts=[];
let _currentPost=null;
let _comments=[];
let _profiles={};        // cache: userId → profile
let _userVotes={};       // postId/commentId → 1|-1
let _sort='hot';
let _timePeriod='all';
let _flairFilter=null;
let _searchQuery='';
let _page=0;
let _totalCount=0;
const PAGE_SIZE=20;
let _commentSort='best';
let _loading=false;
let _searchTimer=null;

// ── Flair config ──
const FLAIRS={
  question:{label:'Question',color:'#D4A04A',bg:'rgba(212,160,74,.15)'},
  discussion:{label:'Discussion',color:'#6BA3C9',bg:'rgba(107,163,201,.15)'},
  methods_help:{label:'Methods Help',color:'#7B9E87',bg:'rgba(123,158,135,.15)'},
  data_request:{label:'Data Request',color:'#9B8EC4',bg:'rgba(155,142,196,.15)'},
  collaboration:{label:'Collaboration',color:'#D4A04A',bg:'rgba(212,160,74,.15)'},
  field_report:{label:'Field Report',color:'#C27878',bg:'rgba(194,120,120,.15)'},
  announcement:{label:'Announcement',color:'#c2b8ae',bg:'rgba(194,184,174,.15)'},
  meta:{label:'Meta',color:'#999',bg:'rgba(153,153,153,.15)'}
};

const REP_TIERS=[
  [2500,'Distinguished'],[1000,'Expert'],[500,'Trusted Researcher'],
  [200,'Active Researcher'],[50,'Contributor'],[0,'New Researcher']
];

// ── Helpers ──
function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _uid(){return window._supaUser?.id||null}
function _isAdmin(){return window._supaIsAdmin===true}
function _ago(iso){const d=Date.now()-new Date(iso).getTime();if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';if(d<2592000000)return Math.floor(d/86400000)+'d ago';return new Date(iso).toLocaleDateString()}
function _repTier(r){for(const[min,label]of REP_TIERS)if(r>=min)return label;return'New Researcher'}

// ── Simple markdown renderer ──
function _md(text){
  if(!text)return'';
  let h=_esc(text);
  // code blocks
  h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(_,lang,code)=>'<pre class="fh-codeblock"><code>'+code+'</code></pre>');
  // inline code
  h=h.replace(/`([^`]+)`/g,'<code class="fh-inline-code">$1</code>');
  // headings
  h=h.replace(/^### (.+)$/gm,'<h4 class="fh-h">$1</h4>');
  h=h.replace(/^## (.+)$/gm,'<h3 class="fh-h">$1</h3>');
  h=h.replace(/^# (.+)$/gm,'<h2 class="fh-h">$1</h2>');
  // blockquote
  h=h.replace(/^&gt; (.+)$/gm,'<blockquote class="fh-bq">$1</blockquote>');
  // bold/italic
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  // links
  h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:var(--ac)">$1</a>');
  // lists
  h=h.replace(/^- (.+)$/gm,'<li>$1</li>');
  h=h.replace(/(<li>.*<\/li>\n?)+/g,'<ul class="fh-list">$&</ul>');
  h=h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  // paragraphs
  h=h.replace(/\n\n/g,'</p><p>');
  h=h.replace(/\n/g,'<br>');
  return'<p>'+h+'</p>';
}

// ── Strip markdown for previews ──
function _stripMd(text,max){
  let s=(text||'').replace(/```[\s\S]*?```/g,'').replace(/`[^`]+`/g,'')
    .replace(/[#*>\[\]()_~`-]/g,'').replace(/\n+/g,' ').trim();
  if(max&&s.length>max)s=s.slice(0,max)+'...';
  return s;
}

// ═══ PROFILE CACHE ═══
async function _fetchProfile(userId){
  if(_profiles[userId])return _profiles[userId];
  if(!window.SB)return null;
  try{
    const{data}=await SB.from('user_profiles').select('*').eq('user_id',userId).maybeSingle();
    if(data)_profiles[userId]=data;
    return data;
  }catch(e){return null}
}

async function _fetchProfiles(userIds){
  const missing=userIds.filter(id=>id&&!_profiles[id]);
  if(!missing.length||!window.SB)return;
  try{
    const{data}=await SB.from('user_profiles').select('*').in('user_id',missing);
    (data||[]).forEach(p=>{_profiles[p.user_id]=p});
  }catch(e){console.warn('Fetch profiles:',e)}
}

// ═══ USER BADGE ═══
function _userBadge(userId,profile,opts={}){
  const p=profile||_profiles[userId];
  const compact=opts.compact!==false;
  let displayName=p?.display_name||p?.full_name||(window._supaUser?.id===userId?window._supaUser?.email?.split('@')[0]:'Researcher');
  if(p?.title&&p.title!=='None')displayName=p.title+' '+displayName;
  const verified=p?.verified?'<span class="fh-verified" title="Verified Researcher">&#10003;</span>':'';
  const rep=p?.reputation||0;
  const repStr=rep>0?'<span class="fh-rep">'+rep+' rep</span>':'';
  const orcid=p?.orcid?`<a href="https://orcid.org/${_esc(p.orcid)}" target="_blank" rel="noopener" class="fh-orcid" title="ORCID iD">iD</a>`:'';

  if(compact){
    let cred='';
    if(p?.affiliation&&(p.credential_visibility==='public'||(p.credential_visibility==='members_only'&&_uid()))){
      cred=_esc(p.affiliation);
      if(p.department)cred+=' &middot; '+_esc(p.department);
    }
    return`<span class="fh-badge compact" data-uid="${userId}">
      <span class="fh-badge-name" onclick="event.stopPropagation();MeridianForum._showProfilePopover('${userId}',this)">${_esc(displayName)}</span>${verified}${orcid}
      ${cred?'<span class="fh-badge-cred">&middot; '+cred+'</span>':''}
      ${repStr}
    </span>`;
  }

  // Expanded badge
  let lines=`<span class="fh-badge-name" onclick="event.stopPropagation();MeridianForum._showProfilePopover('${userId}',this)">${_esc(displayName)}</span>${verified}${orcid}${repStr}`;
  if(p?.affiliation&&(p.credential_visibility==='public'||(p.credential_visibility==='members_only'&&_uid()))){
    let line2=_esc(p.affiliation);
    if(p.department)line2+=' &middot; '+_esc(p.department);
    lines+=`<div class="fh-badge-cred">${line2}</div>`;
  }
  return`<div class="fh-badge expanded" data-uid="${userId}">${lines}</div>`;
}

// ═══ PROFILE POPOVER ═══
window.MeridianForum={};
MeridianForum._showProfilePopover=async function(userId,anchor){
  document.querySelectorAll('.fh-popover').forEach(p=>p.remove());
  const profile=await _fetchProfile(userId);
  if(!profile)return;
  const p=profile;
  const pop=document.createElement('div');
  pop.className='fh-popover';
  const name=p.title&&p.title!=='None'?p.title+' '+(p.display_name||p.full_name||''):p.display_name||p.full_name||'Researcher';
  const tier=_repTier(p.reputation||0);
  let interests='';
  if(p.research_interests?.length){
    interests='<div class="fh-pop-tags">'+p.research_interests.map(t=>'<span class="fh-pop-tag">'+_esc(t)+'</span>').join('')+'</div>';
  }
  pop.innerHTML=`
    <div class="fh-pop-name">${_esc(name)}${p.verified?'<span class="fh-verified">&#10003;</span>':''}</div>
    ${p.affiliation?'<div class="fh-pop-line">'+_esc(p.affiliation)+(p.department?' &middot; '+_esc(p.department):'')+'</div>':''}
    ${p.bio?'<div class="fh-pop-bio">'+_esc(p.bio)+'</div>':''}
    ${interests}
    <div class="fh-pop-stats">
      <span>${p.reputation||0} reputation &middot; ${tier}</span>
      ${p.orcid?'<a href="https://orcid.org/'+_esc(p.orcid)+'" target="_blank" class="fh-orcid" style="margin-left:6px">ORCID</a>':''}
      ${p.website?'<a href="'+_esc(p.website)+'" target="_blank" style="color:var(--ac);font-size:11px;margin-left:6px">Website</a>':''}
    </div>
    ${p.country?'<div class="fh-pop-line" style="margin-top:4px">'+_esc(p.country)+'</div>':''}
    <div class="fh-pop-line" style="margin-top:6px;font-size:10px;color:var(--tm)">Joined ${new Date(p.created_at||Date.now()).toLocaleDateString()}</div>`;
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect();
  pop.style.top=(r.bottom+6)+'px';
  pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-320))+'px';
  setTimeout(()=>{
    const close=e=>{if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',close)}};
    document.addEventListener('click',close);
  },50);
};

// ═══ INITIALIZATION ═══
async function initForum(){
  const el=document.getElementById('tab-forum');
  if(!el)return;

  // Check hash for thread view
  const hash=location.hash;
  if(hash.startsWith('#research-hub/post/')){
    const postId=hash.replace('#research-hub/post/','');
    await _loadThread(postId);
    return;
  }

  _currentPost=null;
  await _loadFeed();
}

// ═══ FEED ═══
async function _loadFeed(){
  const el=document.getElementById('tab-forum');
  if(!el)return;
  _currentPost=null;

  el.innerHTML=`
<div class="fh-wrap">
  <div class="fh-topbar">
    <div class="fh-sort-row">
      <div class="seg-ctrl fh-sorts">
        <button class="seg-btn ${_sort==='hot'?'on':''}" onclick="MeridianForum._setSort('hot')">Hot</button>
        <button class="seg-btn ${_sort==='new'?'on':''}" onclick="MeridianForum._setSort('new')">New</button>
        <button class="seg-btn ${_sort==='top'?'on':''}" onclick="MeridianForum._setSort('top')">Top</button>
        <button class="seg-btn ${_sort==='unanswered'?'on':''}" onclick="MeridianForum._setSort('unanswered')">Unanswered</button>
      </div>
      ${_sort==='top'?`<select class="fh-time-select" onchange="MeridianForum._setTimePeriod(this.value)">
        <option value="day"${_timePeriod==='day'?' selected':''}>Today</option>
        <option value="week"${_timePeriod==='week'?' selected':''}>This Week</option>
        <option value="month"${_timePeriod==='month'?' selected':''}>This Month</option>
        <option value="all"${_timePeriod==='all'?' selected':''}>All Time</option>
      </select>`:''}
      <button class="bt bt-pri fh-new-post-btn" onclick="MeridianForum._showComposer()">New Post</button>
    </div>
    <div class="fh-flair-row">
      ${Object.entries(FLAIRS).map(([k,f])=>`<button class="fh-flair-pill ${_flairFilter===k?'active':''}" style="--fc:${f.color};--fb:${f.bg}" onclick="MeridianForum._toggleFlair('${k}')">${f.label}</button>`).join('')}
    </div>
    <div class="fh-search-row">
      <input class="si fh-search-input" placeholder="Search Research Hub..." value="${_esc(_searchQuery)}" oninput="MeridianForum._onSearch(this.value)"/>
    </div>
  </div>
  <div id="fh-feed-list">
    <div class="fh-skeleton"><div class="fh-skel-card"></div><div class="fh-skel-card"></div><div class="fh-skel-card"></div></div>
  </div>
  <div id="fh-feed-footer" style="display:none"></div>
</div>`;

  await _fetchPosts();
}

async function _fetchPosts(){
  if(_loading)return;
  _loading=true;
  if(!window.SB){_renderEmpty();_loading=false;return}
  try{
    let q=SB.from('forum_posts').select('*',{count:'exact'});

    // Filters
    if(_flairFilter)q=q.eq('flair',_flairFilter);
    if(_sort==='unanswered')q=q.eq('flair','question').eq('has_accepted_answer',false);
    if(_searchQuery)q=q.or(`title.ilike.%${_searchQuery}%,body.ilike.%${_searchQuery}%`);
    if(!_isAdmin())q=q.eq('hidden',false);

    // Time filter for "top"
    if(_sort==='top'&&_timePeriod!=='all'){
      const now=new Date();
      let since;
      if(_timePeriod==='day')since=new Date(now-86400000);
      else if(_timePeriod==='week')since=new Date(now-604800000);
      else if(_timePeriod==='month')since=new Date(now-2592000000);
      if(since)q=q.gte('created_at',since.toISOString());
    }

    // Sort
    if(_sort==='new'||_sort==='unanswered')q=q.order('created_at',{ascending:false});
    else if(_sort==='top')q=q.order('score',{ascending:false});
    else q=q.order('pinned',{ascending:false}).order('last_activity_at',{ascending:false});

    // Pagination
    q=q.range(_page*PAGE_SIZE,(_page+1)*PAGE_SIZE-1);

    const{data,count,error}=await q;
    if(error)throw error;
    _posts=data||[];
    _totalCount=count||0;

    // Hot sort client-side
    if(_sort==='hot'){
      _posts.sort((a,b)=>{
        if(a.pinned!==b.pinned)return a.pinned?-1:1;
        const hoursA=(Date.now()-new Date(a.created_at).getTime())/3600000;
        const hoursB=(Date.now()-new Date(b.created_at).getTime())/3600000;
        return((b.upvotes-b.downvotes)/Math.pow(hoursB+2,1.5))-((a.upvotes-a.downvotes)/Math.pow(hoursA+2,1.5));
      });
    }

    // Fetch author profiles
    const authorIds=[...new Set(_posts.map(p=>p.author_id))];
    await _fetchProfiles(authorIds);

    // Fetch user votes
    if(_uid()){
      const postIds=_posts.map(p=>p.id);
      try{
        const{data:votes}=await SB.from('forum_votes').select('post_id,vote_type').in('post_id',postIds);
        _userVotes={};
        (votes||[]).forEach(v=>{_userVotes[v.post_id]=v.vote_type});
      }catch(e){}
    }

    _renderFeed();
  }catch(e){
    console.error('Forum fetch:',e);
    toast('Failed to load posts','err');
  }
  _loading=false;
}

function _renderFeed(){
  const list=document.getElementById('fh-feed-list');
  if(!list)return;
  if(!_posts.length){_renderEmpty();return}
  list.innerHTML=_posts.map(p=>_postCard(p)).join('');
  const footer=document.getElementById('fh-feed-footer');
  if(footer){
    footer.style.display='';
    const showing=Math.min((_page+1)*PAGE_SIZE,_totalCount);
    footer.innerHTML=`<div class="fh-feed-meta">Showing ${showing} of ${_totalCount} posts</div>
      ${_totalCount>(_page+1)*PAGE_SIZE?'<button class="bt" onclick="MeridianForum._loadMore()">Load More</button>':''}`;
  }
}

function _renderEmpty(){
  const list=document.getElementById('fh-feed-list');
  if(!list)return;
  list.innerHTML=`<div class="fh-empty">
    <div class="fh-empty-icon">💬</div>
    <div class="fh-empty-title">No Posts Yet</div>
    <div class="fh-empty-desc">Be the first to start a conversation.</div>
    <button class="bt bt-pri" onclick="MeridianForum._showComposer()" style="margin-top:16px">Create a Post</button>
  </div>`;
}

// ═══ POST CARD ═══
function _postCard(p){
  const f=FLAIRS[p.flair]||FLAIRS.discussion;
  const score=p.upvotes-p.downvotes;
  const userVote=_userVotes[p.id]||0;
  const profile=_profiles[p.author_id];

  let linkedTag='';
  if(p.linked_species)linkedTag=`<span class="fh-linked" onclick="event.stopPropagation();if(typeof speciesLookup==='function'){goTab('species');speciesLookup('${_esc(p.linked_species)}')}">&#x1F41F; ${_esc(p.linked_species)}</span>`;
  else if(p.linked_paper_doi)linkedTag=`<span class="fh-linked">&#x1F4C4; ${_esc(p.linked_paper_doi)}</span>`;

  return`<div class="fh-post-card" onclick="MeridianForum._openThread('${p.id}')">
  <div class="fh-vote-col">
    <button class="fh-vote-btn ${userVote===1?'active-up':''}" onclick="event.stopPropagation();MeridianForum._votePost('${p.id}',1)" title="Upvote">
      <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 3L3 10h10z" fill="currentColor"/></svg>
    </button>
    <span class="fh-score ${score>0?'pos':score<0?'neg':''}">${score}</span>
    <button class="fh-vote-btn ${userVote===-1?'active-down':''}" onclick="event.stopPropagation();MeridianForum._votePost('${p.id}',-1)" title="Downvote">
      <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 13L3 6h10z" fill="currentColor"/></svg>
    </button>
  </div>
  <div class="fh-post-content">
    <div class="fh-post-top">
      ${p.pinned?'<span class="fh-pinned">&#x1F4CC; Pinned</span>':''}
      <span class="fh-flair-tag" style="background:${f.bg};color:${f.color}">${f.label}</span>
    </div>
    <div class="fh-post-title">${_esc(p.title)}</div>
    <div class="fh-post-author">
      ${_userBadge(p.author_id,profile,{compact:true})}
      <span class="fh-post-time" title="${new Date(p.created_at).toLocaleString()}">&middot; ${_ago(p.created_at)}</span>
    </div>
    <div class="fh-post-preview">${_esc(_stripMd(p.body,200))}</div>
    <div class="fh-post-footer">
      <span>&#x1F4AC; ${p.comment_count} comment${p.comment_count!==1?'s':''}</span>
      <span>&#x1F441; ${p.view_count} view${p.view_count!==1?'s':''}</span>
      ${p.has_accepted_answer?'<span class="fh-answered">&#10003; Answered</span>':''}
      ${linkedTag}
    </div>
  </div>
</div>`;
}

// ═══ VOTING ═══
MeridianForum._votePost=async function(postId,type){
  if(!_uid()){toast('Sign in to vote','info');return}
  // Optimistic update
  const old=_userVotes[postId]||0;
  const post=_posts.find(p=>p.id===postId);
  if(old===type){
    _userVotes[postId]=0;
    if(post){if(type===1)post.upvotes--;else post.downvotes--}
  }else{
    if(old===1&&post)post.upvotes--;
    if(old===-1&&post)post.downvotes--;
    _userVotes[postId]=type;
    if(post){if(type===1)post.upvotes++;else post.downvotes++}
  }
  _renderFeed();
  try{
    await SB.rpc('vote_on_post',{p_post_id:postId,p_vote_type:type});
  }catch(e){
    _userVotes[postId]=old;
    if(post){const{data}=await SB.from('forum_posts').select('upvotes,downvotes').eq('id',postId).single();if(data){post.upvotes=data.upvotes;post.downvotes=data.downvotes}}
    _renderFeed();
    toast('Vote failed','err');
  }
};

// ═══ SORT / FILTER ═══
MeridianForum._setSort=function(s){_sort=s;_page=0;_fetchPosts()};
MeridianForum._setTimePeriod=function(t){_timePeriod=t;_page=0;_fetchPosts()};
MeridianForum._toggleFlair=function(f){_flairFilter=_flairFilter===f?null:f;_page=0;_loadFeed()};
MeridianForum._onSearch=function(q){
  clearTimeout(_searchTimer);
  _searchTimer=setTimeout(()=>{_searchQuery=q.trim();_page=0;_fetchPosts()},300);
};
MeridianForum._loadMore=function(){_page++;_fetchPosts()};

// ═══ POST COMPOSER ═══
MeridianForum._showComposer=function(){
  if(!_uid()){toast('Sign in to create a post','info');return}
  document.querySelectorAll('.fh-composer-overlay').forEach(e=>e.remove());
  const overlay=document.createElement('div');
  overlay.className='fh-composer-overlay';
  overlay.innerHTML=`
<div class="fh-composer">
  <h3 style="color:var(--ac);margin-bottom:16px;font-family:var(--sf)">New Post</h3>
  <input class="si fh-comp-title" id="fh-comp-title" placeholder="What's your question or topic?" maxlength="200" style="font-size:16px;padding:12px 14px"/>
  <div class="fh-comp-flairs" id="fh-comp-flairs">
    ${Object.entries(FLAIRS).filter(([k])=>k!=='announcement'||_isAdmin()).map(([k,f])=>
      `<button class="fh-flair-pill" data-flair="${k}" style="--fc:${f.color};--fb:${f.bg}" onclick="MeridianForum._selectFlair(this,'${k}')">${f.label}</button>`
    ).join('')}
  </div>
  <div class="fh-comp-toolbar">
    <button onclick="MeridianForum._insertMd('**','**')" title="Bold"><b>B</b></button>
    <button onclick="MeridianForum._insertMd('*','*')" title="Italic"><i>I</i></button>
    <button onclick="MeridianForum._insertMd('# ','')" title="Heading">H</button>
    <button onclick="MeridianForum._insertMd('[','](url)')" title="Link">&#x1F517;</button>
    <button onclick="MeridianForum._insertMd('\`','\`')" title="Code">&lt;/&gt;</button>
    <button onclick="MeridianForum._insertMd('- ','')" title="List">&#x2022;</button>
    <button onclick="MeridianForum._insertMd('> ','')" title="Quote">&#x275D;</button>
    <div style="flex:1"></div>
    <button class="fh-comp-preview-btn" onclick="MeridianForum._togglePreview()">Preview</button>
  </div>
  <textarea class="si fh-comp-body" id="fh-comp-body" placeholder="Write your post (supports Markdown)..." rows="10" style="min-height:200px;resize:vertical;font-size:14px"></textarea>
  <div id="fh-comp-preview" class="fh-comp-preview-area" style="display:none"></div>
  <details class="fh-comp-links" style="margin-top:12px">
    <summary style="cursor:pointer;color:var(--tm);font-size:13px">Link Meridian Data (optional)</summary>
    <div style="display:grid;gap:10px;margin-top:10px">
      <input class="si" id="fh-comp-species" placeholder="Link a species (scientific name)"/>
      <input class="si" id="fh-comp-doi" placeholder="Link a paper DOI"/>
    </div>
  </details>
  <div class="fh-comp-actions">
    <span class="fh-comp-cancel" onclick="MeridianForum._closeComposer()">Cancel</span>
    <button class="bt bt-pri" id="fh-comp-submit" onclick="MeridianForum._submitPost()" disabled>Post</button>
  </div>
</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));
  overlay.addEventListener('click',e=>{if(e.target===overlay)MeridianForum._closeComposer()});
  // Enable/disable submit
  const title=document.getElementById('fh-comp-title');
  const body=document.getElementById('fh-comp-body');
  const check=()=>{
    const btn=document.getElementById('fh-comp-submit');
    const hasFlair=!!document.querySelector('.fh-comp-flairs .fh-flair-pill.active');
    if(btn)btn.disabled=!(title.value.trim()&&body.value.trim().length>=20&&hasFlair);
  };
  title.addEventListener('input',check);
  body.addEventListener('input',check);
};

MeridianForum._selectFlair=function(btn,flair){
  document.querySelectorAll('.fh-comp-flairs .fh-flair-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  btn.dataset.selected='true';
  // Re-check submit
  const title=document.getElementById('fh-comp-title');
  const body=document.getElementById('fh-comp-body');
  const submit=document.getElementById('fh-comp-submit');
  if(submit)submit.disabled=!(title?.value.trim()&&body?.value.trim().length>=20);
};

MeridianForum._insertMd=function(before,after){
  const ta=document.getElementById('fh-comp-body');
  if(!ta)return;
  const s=ta.selectionStart,e=ta.selectionEnd;
  const sel=ta.value.substring(s,e);
  ta.value=ta.value.substring(0,s)+before+sel+after+ta.value.substring(e);
  ta.focus();
  ta.selectionStart=ta.selectionEnd=s+before.length+sel.length;
};

MeridianForum._togglePreview=function(){
  const ta=document.getElementById('fh-comp-body');
  const prev=document.getElementById('fh-comp-preview');
  if(!ta||!prev)return;
  const showing=prev.style.display!=='none';
  prev.style.display=showing?'none':'';
  ta.style.display=showing?'':'none';
  if(!showing)prev.innerHTML=_md(ta.value);
};

MeridianForum._closeComposer=function(){
  const body=document.getElementById('fh-comp-body');
  if(body?.value.trim()&&!confirm('Discard this post?'))return;
  document.querySelectorAll('.fh-composer-overlay').forEach(e=>{e.classList.remove('open');setTimeout(()=>e.remove(),200)});
};

MeridianForum._submitPost=async function(){
  const title=document.getElementById('fh-comp-title')?.value.trim();
  const body=document.getElementById('fh-comp-body')?.value.trim();
  const flairBtn=document.querySelector('.fh-comp-flairs .fh-flair-pill.active');
  const flair=flairBtn?.dataset.flair;
  const species=document.getElementById('fh-comp-species')?.value.trim()||null;
  const doi=document.getElementById('fh-comp-doi')?.value.trim()||null;

  if(!title||!body||!flair)return;
  const btn=document.getElementById('fh-comp-submit');
  if(btn){btn.disabled=true;btn.textContent='Posting...'}

  try{
    const{data,error}=await SB.from('forum_posts').insert({
      author_id:_uid(),title,body,flair,
      linked_species:species,linked_paper_doi:doi
    }).select().single();
    if(error)throw error;
    document.querySelectorAll('.fh-composer-overlay').forEach(e=>e.remove());
    toast('Post created','ok');
    _page=0;
    await _loadFeed();
  }catch(e){
    console.error('Post submit:',e);
    toast('Failed to create post: '+(e.message||''),'err');
    if(btn){btn.disabled=false;btn.textContent='Post'}
  }
};

// ═══ THREAD VIEW ═══
MeridianForum._openThread=async function(postId){
  location.hash='research-hub/post/'+postId;
  await _loadThread(postId);
};

async function _loadThread(postId){
  const el=document.getElementById('tab-forum');
  if(!el||!window.SB)return;

  el.innerHTML='<div class="fh-wrap"><div style="text-align:center;padding:40px;color:var(--tm)">Loading...</div></div>';

  try{
    // Fetch post
    const{data:post,error}=await SB.from('forum_posts').select('*').eq('id',postId).single();
    if(error)throw error;
    _currentPost=post;

    // Fetch comments
    const{data:comments}=await SB.from('forum_comments').select('*').eq('post_id',postId).order('created_at',{ascending:true});
    _comments=comments||[];

    // Fetch profiles
    const allIds=[post.author_id,..._comments.map(c=>c.author_id)];
    await _fetchProfiles([...new Set(allIds)]);

    // Fetch user votes
    if(_uid()){
      const cIds=_comments.map(c=>c.id);
      try{
        const[pv,cv]=await Promise.all([
          SB.from('forum_votes').select('post_id,vote_type').eq('post_id',postId),
          cIds.length?SB.from('forum_votes').select('comment_id,vote_type').in('comment_id',cIds):Promise.resolve({data:[]})
        ]);
        _userVotes={};
        (pv.data||[]).forEach(v=>{_userVotes[v.post_id]=v.vote_type});
        (cv.data||[]).forEach(v=>{_userVotes[v.comment_id]=v.vote_type});
      }catch(e){}
    }

    // Increment view count (once per session)
    const viewKey='fh_viewed_'+postId;
    if(!sessionStorage.getItem(viewKey)){
      sessionStorage.setItem(viewKey,'1');
      SB.rpc('increment_post_views',{p_post_id:postId}).catch(()=>{});
    }

    _renderThread();
  }catch(e){
    console.error('Thread load:',e);
    el.innerHTML='<div class="fh-wrap"><div class="fh-empty"><div class="fh-empty-title">Post Not Found</div><button class="bt" onclick="MeridianForum._backToFeed()">Back to Research Hub</button></div></div>';
  }
}

function _renderThread(){
  const el=document.getElementById('tab-forum');
  if(!el||!_currentPost)return;
  const p=_currentPost;
  const f=FLAIRS[p.flair]||FLAIRS.discussion;
  const score=p.upvotes-p.downvotes;
  const userVote=_userVotes[p.id]||0;
  const isAuthor=_uid()===p.author_id;

  // Build comment tree
  const tree=_buildCommentTree();
  const sorted=_sortComments(tree);

  el.innerHTML=`
<div class="fh-wrap">
  <button class="fh-back" onclick="MeridianForum._backToFeed()">&larr; Research Hub</button>

  <div class="fh-thread-post">
    <div class="fh-vote-col fh-vote-lg">
      <button class="fh-vote-btn ${userVote===1?'active-up':''}" onclick="MeridianForum._votePostThread('${p.id}',1)">
        <svg viewBox="0 0 16 16" width="18" height="18"><path d="M8 3L3 10h10z" fill="currentColor"/></svg>
      </button>
      <span class="fh-score ${score>0?'pos':score<0?'neg':''}">${score}</span>
      <button class="fh-vote-btn ${userVote===-1?'active-down':''}" onclick="MeridianForum._votePostThread('${p.id}',-1)">
        <svg viewBox="0 0 16 16" width="18" height="18"><path d="M8 13L3 6h10z" fill="currentColor"/></svg>
      </button>
    </div>
    <div class="fh-thread-body">
      <div class="fh-post-top">
        ${p.pinned?'<span class="fh-pinned">&#x1F4CC; Pinned</span>':''}
        <span class="fh-flair-tag" style="background:${f.bg};color:${f.color}">${f.label}</span>
      </div>
      <h2 class="fh-thread-title">${_esc(p.title)}</h2>
      <div class="fh-thread-author">
        ${_userBadge(p.author_id,null,{compact:false})}
        <span class="fh-post-time" title="${new Date(p.created_at).toLocaleString()}">${_ago(p.created_at)}</span>
      </div>
      <div class="fh-thread-content">${_md(p.body)}</div>
      ${p.linked_species?'<div class="fh-linked-card" onclick="if(typeof speciesLookup===\'function\'){goTab(\'species\');speciesLookup(\''+_esc(p.linked_species)+'\')}">&#x1F41F; '+_esc(p.linked_species)+'</div>':''}
      ${p.linked_paper_doi?'<div class="fh-linked-card">&#x1F4C4; '+_esc(p.linked_paper_doi)+'</div>':''}
      <div class="fh-thread-actions">
        ${!p.locked&&_uid()?'<button class="bt sm" onclick="MeridianForum._focusReply()">Reply</button>':''}
        <button class="bt sm" onclick="MeridianForum._share('${p.id}')">Share</button>
        ${_uid()&&!isAuthor?'<button class="bt sm" onclick="MeridianForum._showFlagModal(\'post\',\''+p.id+'\')">&#x1F6A9; Flag</button>':''}
        ${isAuthor?'<button class="bt sm" onclick="MeridianForum._editPost(\''+p.id+'\')">Edit</button>':''}
        ${isAuthor?'<button class="bt sm" onclick="MeridianForum._deletePost(\''+p.id+'\')">Delete</button>':''}
        ${_isAdmin()?'<button class="bt sm" onclick="MeridianForum._togglePin(\''+p.id+'\','+(!p.pinned)+')" style="color:var(--wa)">'+(p.pinned?'Unpin':'Pin')+'</button>':''}
        ${_isAdmin()?'<button class="bt sm" onclick="MeridianForum._toggleLock(\''+p.id+'\','+(!p.locked)+')" style="color:var(--wa)">'+(p.locked?'Unlock':'Lock')+'</button>':''}
      </div>
    </div>
  </div>

  <div class="fh-comments-section">
    <div class="fh-comments-header">
      <h3>${p.comment_count} Comment${p.comment_count!==1?'s':''}</h3>
      <div class="seg-ctrl fh-comment-sort">
        <button class="seg-btn ${_commentSort==='best'?'on':''}" onclick="MeridianForum._setCommentSort('best')">Best</button>
        <button class="seg-btn ${_commentSort==='new'?'on':''}" onclick="MeridianForum._setCommentSort('new')">New</button>
        <button class="seg-btn ${_commentSort==='old'?'on':''}" onclick="MeridianForum._setCommentSort('old')">Old</button>
      </div>
    </div>

    ${_uid()&&!p.locked?`
    <div class="fh-add-comment">
      <textarea class="si" id="fh-comment-input" placeholder="Add a comment..." rows="3" style="min-height:80px;resize:vertical"></textarea>
      <button class="bt bt-pri sm" id="fh-comment-submit" onclick="MeridianForum._submitComment()" disabled>Comment</button>
    </div>`:''}
    ${!_uid()?'<div class="fh-sign-in-prompt">Sign in to comment</div>':''}
    ${p.locked?'<div class="fh-locked-msg">&#x1F512; This thread has been locked by a moderator.</div>':''}

    <div id="fh-comments-list">
      ${sorted.map(c=>_renderComment(c,0,p)).join('')}
    </div>
  </div>
</div>`;

  // Enable comment submit
  const ci=document.getElementById('fh-comment-input');
  const cs=document.getElementById('fh-comment-submit');
  if(ci&&cs)ci.addEventListener('input',()=>{cs.disabled=ci.value.trim().length<5});
}

// ═══ COMMENT TREE ═══
function _buildCommentTree(){
  const map={};
  const roots=[];
  _comments.forEach(c=>{map[c.id]={...c,children:[]}});
  _comments.forEach(c=>{
    const node=map[c.id];
    if(c.parent_comment_id&&map[c.parent_comment_id]){
      map[c.parent_comment_id].children.push(node);
    }else{
      roots.push(node);
    }
  });
  return roots;
}

function _sortComments(nodes){
  // Float accepted answer to top
  nodes.sort((a,b)=>{
    if(a.is_accepted_answer!==b.is_accepted_answer)return a.is_accepted_answer?-1:1;
    if(_commentSort==='new')return new Date(b.created_at)-new Date(a.created_at);
    if(_commentSort==='old')return new Date(a.created_at)-new Date(b.created_at);
    return(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes);
  });
  nodes.forEach(n=>{if(n.children.length)_sortComments(n.children)});
  return nodes;
}

function _renderComment(c,depth,post){
  const score=c.upvotes-c.downvotes;
  const userVote=_userVotes[c.id]||0;
  const isAuthor=_uid()===c.author_id;
  const isOP=c.author_id===post?.author_id;
  const isQuestionPost=post?.flair==='question';
  const canAccept=isOP?false:(_uid()===post?.author_id&&isQuestionPost);
  const maxDepth=5;
  const indent=Math.min(depth,maxDepth)*24;

  return`<div class="fh-comment ${c.is_accepted_answer?'accepted':''} ${c.hidden?'hidden-comment':''}" style="margin-left:${indent}px" id="comment-${c.id}">
  ${depth>0?'<div class="fh-comment-line" style="left:${indent-12}px"></div>':''}
  <div class="fh-comment-inner">
    <div class="fh-vote-col fh-vote-sm">
      <button class="fh-vote-btn ${userVote===1?'active-up':''}" onclick="MeridianForum._voteComment('${c.id}',1)">
        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 3L3 10h10z" fill="currentColor"/></svg>
      </button>
      <span class="fh-score-sm ${score>0?'pos':score<0?'neg':''}">${score}</span>
      <button class="fh-vote-btn ${userVote===-1?'active-down':''}" onclick="MeridianForum._voteComment('${c.id}',-1)">
        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 13L3 6h10z" fill="currentColor"/></svg>
      </button>
    </div>
    <div class="fh-comment-body">
      ${c.is_accepted_answer?'<div class="fh-accepted-label">&#10003; Accepted Answer</div>':''}
      <div class="fh-comment-meta">
        ${_userBadge(c.author_id,null,{compact:true})}
        ${isOP?'<span class="fh-op-badge">OP</span>':''}
        <span class="fh-post-time" title="${new Date(c.created_at).toLocaleString()}">&middot; ${_ago(c.created_at)}</span>
        ${c.edited?'<span class="fh-edited">(edited)</span>':''}
      </div>
      <div class="fh-comment-text">${_md(c.body)}</div>
      <div class="fh-comment-actions">
        ${_uid()&&!post?.locked?'<button class="fh-act-btn" onclick="MeridianForum._showReplyInput(\''+c.id+'\')">Reply</button>':''}
        ${canAccept&&!c.is_accepted_answer?'<button class="fh-act-btn fh-accept-btn" onclick="MeridianForum._acceptAnswer(\''+c.id+'\')">&#10003; Accept</button>':''}
        ${_uid()&&!isAuthor?'<button class="fh-act-btn" onclick="MeridianForum._showFlagModal(\'comment\',\''+c.id+'\')">Flag</button>':''}
        ${isAuthor?'<button class="fh-act-btn" onclick="MeridianForum._editComment(\''+c.id+'\')">Edit</button>':''}
        ${isAuthor||_isAdmin()?'<button class="fh-act-btn" onclick="MeridianForum._deleteComment(\''+c.id+'\')">Delete</button>':''}
        ${_isAdmin()&&c.hidden?'<button class="fh-act-btn" onclick="MeridianForum._unhideComment(\''+c.id+'\')" style="color:var(--wa)">Unhide</button>':''}
      </div>
      <div id="reply-input-${c.id}"></div>
    </div>
  </div>
  ${c.children.map(child=>_renderComment(child,depth+1,post)).join('')}
</div>`;
}

// ═══ COMMENT ACTIONS ═══
MeridianForum._votePostThread=async function(postId,type){
  if(!_uid()){toast('Sign in to vote','info');return}
  const old=_userVotes[postId]||0;
  if(old===type)_userVotes[postId]=0;
  else _userVotes[postId]=type;
  if(_currentPost){
    if(old===1)_currentPost.upvotes--;if(old===-1)_currentPost.downvotes--;
    if(_userVotes[postId]===1)_currentPost.upvotes++;if(_userVotes[postId]===-1)_currentPost.downvotes++;
  }
  _renderThread();
  try{await SB.rpc('vote_on_post',{p_post_id:postId,p_vote_type:type})}
  catch(e){_userVotes[postId]=old;toast('Vote failed','err')}
};

MeridianForum._voteComment=async function(commentId,type){
  if(!_uid()){toast('Sign in to vote','info');return}
  const old=_userVotes[commentId]||0;
  const c=_comments.find(x=>x.id===commentId);
  if(old===type){_userVotes[commentId]=0;if(c){if(type===1)c.upvotes--;else c.downvotes--}}
  else{
    if(old===1&&c)c.upvotes--;if(old===-1&&c)c.downvotes--;
    _userVotes[commentId]=type;
    if(c){if(type===1)c.upvotes++;else c.downvotes++}
  }
  _renderThread();
  try{await SB.rpc('vote_on_comment',{p_comment_id:commentId,p_vote_type:type})}
  catch(e){_userVotes[commentId]=old;toast('Vote failed','err')}
};

MeridianForum._setCommentSort=function(s){_commentSort=s;_renderThread()};

MeridianForum._submitComment=async function(parentId){
  const inputId=parentId?'reply-textarea-'+parentId:'fh-comment-input';
  const input=document.getElementById(inputId);
  if(!input||input.value.trim().length<5)return;
  const body=input.value.trim();
  try{
    const{error}=await SB.from('forum_comments').insert({
      post_id:_currentPost.id,author_id:_uid(),body,
      parent_comment_id:parentId||null
    });
    if(error)throw error;
    toast('Comment posted','ok');
    await _loadThread(_currentPost.id);
  }catch(e){toast('Failed to post comment','err')}
};

MeridianForum._showReplyInput=function(commentId){
  const container=document.getElementById('reply-input-'+commentId);
  if(!container)return;
  if(container.innerHTML){container.innerHTML='';return}
  container.innerHTML=`
    <div class="fh-reply-box">
      <textarea class="si" id="reply-textarea-${commentId}" placeholder="Reply..." rows="3" style="min-height:60px;resize:vertical;font-size:13px"></textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="bt bt-pri sm" onclick="MeridianForum._submitComment('${commentId}')">Reply</button>
        <button class="bt sm" onclick="document.getElementById('reply-input-${commentId}').innerHTML=''">Cancel</button>
      </div>
    </div>`;
};

MeridianForum._focusReply=function(){
  const el=document.getElementById('fh-comment-input');
  if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'})}
};

MeridianForum._acceptAnswer=async function(commentId){
  if(!_currentPost)return;
  try{
    await SB.from('forum_comments').update({is_accepted_answer:false}).eq('post_id',_currentPost.id).eq('is_accepted_answer',true);
    await SB.from('forum_comments').update({is_accepted_answer:true}).eq('id',commentId);
    await SB.from('forum_posts').update({has_accepted_answer:true,accepted_answer_id:commentId}).eq('id',_currentPost.id);
    toast('Answer accepted','ok');
    await _loadThread(_currentPost.id);
  }catch(e){toast('Failed to accept answer','err')}
};

// ═══ POST ACTIONS ═══
MeridianForum._share=function(postId){
  const url=location.origin+location.pathname+'#research-hub/post/'+postId;
  navigator.clipboard.writeText(url).then(()=>toast('Link copied','ok')).catch(()=>toast('Copy failed','err'));
};

MeridianForum._editPost=async function(postId){
  const p=_currentPost||_posts.find(x=>x.id===postId);
  if(!p)return;
  const newBody=prompt('Edit post body:',p.body);
  if(newBody===null||!newBody.trim())return;
  try{
    await SB.from('forum_posts').update({body:newBody.trim(),updated_at:new Date().toISOString()}).eq('id',postId);
    toast('Post updated','ok');
    if(_currentPost)await _loadThread(postId);
    else await _fetchPosts();
  }catch(e){toast('Edit failed','err')}
};

MeridianForum._deletePost=async function(postId){
  if(!confirm('Delete this post? This cannot be undone.'))return;
  try{
    await SB.from('forum_posts').delete().eq('id',postId);
    toast('Post deleted','ok');
    MeridianForum._backToFeed();
  }catch(e){toast('Delete failed','err')}
};

MeridianForum._editComment=async function(commentId){
  const c=_comments.find(x=>x.id===commentId);
  if(!c)return;
  const newBody=prompt('Edit comment:',c.body);
  if(newBody===null||!newBody.trim())return;
  try{
    await SB.from('forum_comments').update({body:newBody.trim(),edited:true,updated_at:new Date().toISOString()}).eq('id',commentId);
    toast('Comment updated','ok');
    await _loadThread(_currentPost.id);
  }catch(e){toast('Edit failed','err')}
};

MeridianForum._deleteComment=async function(commentId){
  if(!confirm('Delete this comment?'))return;
  try{
    await SB.from('forum_comments').delete().eq('id',commentId);
    toast('Comment deleted','ok');
    await _loadThread(_currentPost.id);
  }catch(e){toast('Delete failed','err')}
};

// ═══ ADMIN ACTIONS ═══
MeridianForum._togglePin=async function(postId,pin){
  try{await SB.from('forum_posts').update({pinned:pin}).eq('id',postId);toast(pin?'Pinned':'Unpinned','ok');
    if(_currentPost)await _loadThread(postId);else await _fetchPosts()}
  catch(e){toast('Action failed','err')}
};

MeridianForum._toggleLock=async function(postId,lock){
  try{await SB.from('forum_posts').update({locked:lock}).eq('id',postId);toast(lock?'Locked':'Unlocked','ok');
    if(_currentPost)await _loadThread(postId);else await _fetchPosts()}
  catch(e){toast('Action failed','err')}
};

MeridianForum._unhideComment=async function(commentId){
  try{await SB.from('forum_comments').update({hidden:false}).eq('id',commentId);toast('Comment unhidden','ok');
    await _loadThread(_currentPost.id)}catch(e){toast('Failed','err')}
};

// ═══ FLAG MODAL ═══
MeridianForum._showFlagModal=function(type,targetId){
  if(!_uid()){toast('Sign in to report content','info');return}
  document.querySelectorAll('.fh-flag-overlay').forEach(e=>e.remove());
  const reasons=['spam','offensive','misinformation','off_topic','harassment','other'];
  const labels={spam:'Spam',offensive:'Offensive Content',misinformation:'Misinformation',off_topic:'Off-Topic',harassment:'Harassment',other:'Other'};
  const overlay=document.createElement('div');
  overlay.className='fh-flag-overlay fh-composer-overlay';
  overlay.innerHTML=`
<div class="fh-composer" style="max-width:420px">
  <h3 style="color:var(--ac);margin-bottom:16px;font-family:var(--sf)">Report This ${type==='post'?'Post':'Comment'}</h3>
  <div class="fh-flag-options">
    ${reasons.map(r=>`<label class="fh-flag-option"><input type="radio" name="fh-flag-reason" value="${r}"/><span>${labels[r]}</span></label>`).join('')}
  </div>
  <textarea class="si" id="fh-flag-details" placeholder="Additional details (optional)..." rows="3" style="margin-top:12px;display:none;resize:vertical"></textarea>
  <div class="fh-comp-actions" style="margin-top:16px">
    <span class="fh-comp-cancel" onclick="this.closest('.fh-flag-overlay').remove()">Cancel</span>
    <button class="bt bt-pri" id="fh-flag-submit" onclick="MeridianForum._submitFlag('${type}','${targetId}')">Submit Report</button>
  </div>
</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('open'));
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  // Show details textarea when "other" selected
  overlay.querySelectorAll('input[name="fh-flag-reason"]').forEach(r=>{
    r.addEventListener('change',()=>{
      document.getElementById('fh-flag-details').style.display=r.value==='other'?'':'none';
    });
  });
};

MeridianForum._submitFlag=async function(type,targetId){
  const reason=document.querySelector('input[name="fh-flag-reason"]:checked')?.value;
  if(!reason){toast('Select a reason','err');return}
  const details=document.getElementById('fh-flag-details')?.value.trim()||null;
  const row={reporter_id:_uid(),reason,details};
  if(type==='post')row.post_id=targetId;else row.comment_id=targetId;
  try{
    const{error}=await SB.from('forum_flags').insert(row);
    if(error){
      if(error.code==='23505'){toast('You have already reported this','info')}
      else throw error;
    }else{toast('Thank you \u2014 we\'ll review this.','ok')}
    document.querySelectorAll('.fh-flag-overlay').forEach(e=>e.remove());
  }catch(e){toast('Report failed','err')}
};

// ═══ NAVIGATION ═══
MeridianForum._backToFeed=function(){
  location.hash='research-hub';
  _currentPost=null;
  _loadFeed();
};

// Hash change listener
window.addEventListener('hashchange',()=>{
  const hash=location.hash;
  if(hash==='#research-hub'||hash==='#research-hub/'){
    const tabPane=document.getElementById('tab-forum');
    if(tabPane?.classList.contains('on'))_loadFeed();
  }else if(hash.startsWith('#research-hub/post/')){
    const tabPane=document.getElementById('tab-forum');
    if(tabPane?.classList.contains('on')){
      const postId=hash.replace('#research-hub/post/','');
      _loadThread(postId);
    }
  }
});

// ═══ PUBLIC API ═══
window.initForum=initForum;
MeridianForum.initForum=initForum;
MeridianForum._loadFeed=_loadFeed;

})();
