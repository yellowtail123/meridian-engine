// ═══ MERIDIAN PUBLICATIONS — Browse, Submit, Detail views ═══

let _pubInit=false;
let _pubList=[];
let _pubFilters={search:'',category:[],region:[],species:[],sort:'newest'};

const _PUB_SECTIONS=['Abstract','Introduction','Methods','Results','Discussion','Conclusion','Acknowledgements','Data Availability Statement','References'];

function initPublications(){
  if(_pubInit&&$('#pub-content')?.children.length)return;
  _pubInit=true;
  _renderPubUI();
  _pubLoadList();
}

// ═══════════════════════════════════════════════════════════════
// 1. BROWSE VIEW
// ═══════════════════════════════════════════════════════════════

function _renderPubUI(){
  H('#pub-content',`
    <div style="margin-bottom:20px">
      <h2 style="font-size:22px;font-weight:700;color:var(--ac);font-family:var(--sf);margin:0 0 4px">Meridian Publications</h2>
      <p style="font-size:13px;color:var(--tm);font-family:var(--sf);margin:0">A platform for researchers to share and discover non-journal scientific work</p>
    </div>
    <div style="margin-bottom:14px;padding:12px 16px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span style="font-size:12px;color:var(--ts)">All submissions must follow the Meridian Publication Template format.</span>
      <a href="/template/Meridian_Publication_Template.docx" download class="bt sm on" style="text-decoration:none;font-size:12px;display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink:0"><path d="M8 1v9M4 6l4 4 4-4"/><path d="M2 12h12v2H2z"/></svg> Download Publication Template</a>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div class="si-wrap" style="flex:1;min-width:240px"><input class="si" id="pub-search" placeholder="Search publications by title, author, species, keyword..." oninput="_pubApplySearch()" style="font-size:14px"/><button class="si-clear" type="button" onclick="$('#pub-search').value='';_pubApplySearch()" aria-label="Clear">&times;</button></div>
      <select class="fs" id="pub-sort" onchange="_pubFilters.sort=this.value;_pubRenderCards()" style="min-width:150px">
        <option value="newest">Newest first</option>
        <option value="endorsed">Most endorsed</option>
        <option value="category_az">Category A-Z</option>
      </select>
      <select class="fs" id="pub-cat-filter" onchange="_pubFilterCat(this.value)" style="min-width:140px">
        <option value="">All categories</option>
        <option>Field Study</option><option>Technical Report</option><option>Thesis/Dissertation</option>
        <option>Review</option><option>Dataset Description</option><option>Monitoring Report</option>
        <option>Methodology</option><option>Policy Brief</option><option>Preprint</option><option>Other</option>
      </select>
      ${_supaUser?'<button class="bt sm on" onclick="_pubShowSubmit()">+ Submit Publication</button>':'<button class="bt sm" onclick="showAuthModal()" style="color:var(--tm)">Sign in to submit</button>'}
    </div>
    <div id="pub-cards"></div>
    <div id="pub-detail" style="display:none"></div>
    <div id="pub-submit" style="display:none"></div>
  `);
}

async function _pubLoadList(){
  try{
    const{data,error}=await SB.from('publications').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    _pubList=data||[];
  }catch(e){
    console.warn('Pub load:',e);
    _pubList=[];
  }
  _pubRenderCards();
}

function _pubApplySearch(){
  _pubFilters.search=($('#pub-search')?.value||'').toLowerCase().trim();
  _pubRenderCards();
}
function _pubFilterCat(v){
  _pubFilters.category=v?[v]:[];
  _pubRenderCards();
}

function _pubRenderCards(){
  let list=_pubList.filter(p=>{
    if(p.status!=='published'&&(!_supaUser||p.user_id!==_supaUser.id)&&!_supaIsAdmin)return false;
    const f=_pubFilters;
    if(f.search){
      const hay=[p.title,p.abstract,p.location_region,...(p.species_studied||[]),...(p.keywords||[]),
        ...(p.authors||[]).map(a=>a.name||''),p.meridian_id,p.category].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(f.search))return false;
    }
    if(f.category.length&&!f.category.includes(p.category))return false;
    return true;
  });
  const s=_pubFilters.sort;
  if(s==='newest')list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  else if(s==='endorsed')list.sort((a,b)=>(b.endorsement_count||0)-(a.endorsement_count||0));
  else if(s==='category_az')list.sort((a,b)=>(a.category||'').localeCompare(b.category||''));

  if(!list.length){
    H('#pub-cards',`<div style="text-align:center;padding:50px 20px">
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="var(--ab)" stroke-width="1.5" style="margin-bottom:16px;opacity:.5"><rect x="12" y="4" width="40" height="56" rx="4"/><path d="M20 16h24M20 24h24M20 32h16"/><path d="M36 36l8 8M44 36l-8 8" stroke="var(--ac)" stroke-width="2"/></svg>
      <div style="font-size:15px;color:var(--ts);font-family:var(--sf);font-weight:500;margin-bottom:6px">No publications yet</div>
      <div style="font-size:13px;color:var(--tm);font-family:var(--sf);margin-bottom:16px">Be the first to share your research with the Meridian community</div>
      ${_supaUser?'<button class="bt on" onclick="_pubShowSubmit()" style="font-size:14px;padding:10px 24px">Submit a Publication</button>':'<button class="bt sm" onclick="showAuthModal()" style="font-size:13px">Sign in to submit</button>'}
    </div>`);
    return;
  }
  H('#pub-cards',list.map(p=>_pubCard(p)).join(''));
}

function _pubCard(p){
  const authors=(p.authors||[]).map(a=>a.name||'').join(', ')||'Unknown';
  const speciesTags=(p.species_studied||[]).slice(0,3).map(s=>`<span class="bg oa" style="font-size:10px;padding:2px 6px">${_pesc(s)}</span>`).join('');
  const isOwn=_supaUser&&p.user_id===_supaUser.id;
  return`<div class="pc" style="cursor:pointer" onclick="_pubShowDetail('${p.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:10px;font-family:var(--mf);color:var(--ac);background:var(--am);padding:2px 6px;border-radius:3px;border:1px solid var(--ab)">${_pesc(p.meridian_id||'')}</span>
          <span class="bg oa" style="font-size:10px;padding:2px 6px">${_pesc(p.category)}</span>
          ${p.location_region?'<span class="bg yr" style="font-size:10px;padding:2px 6px">'+_pesc(p.location_region)+'</span>':''}
          ${p.is_trusted_author?'<span style="font-size:10px;color:var(--sg);font-family:var(--mf)" title="Trusted author">&#x2705;</span>':''}
          ${p.status!=='published'?'<span style="font-size:10px;color:var(--wa);font-family:var(--mf)">'+p.status+'</span>':''}
        </div>
        <div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:3px">${_pesc(p.title)}</div>
        <div style="font-size:12px;color:var(--tm);margin-bottom:4px">${_pesc(authors)}</div>
        <div style="font-size:12px;color:var(--ts);line-height:1.5;max-height:40px;overflow:hidden">${_pesc((p.abstract||'').slice(0,180))}${(p.abstract||'').length>180?'...':''}</div>
        <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">${speciesTags}${(p.keywords||[]).slice(0,3).map(k=>'<span style="font-size:10px;color:var(--tm);font-family:var(--mf)">#'+_pesc(k)+'</span>').join(' ')}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:90px">
        <div style="font-size:13px;color:var(--sg);font-family:var(--mf);font-weight:600" title="Endorsements">&#x1F44D; ${p.endorsement_count||0}</div>
        ${p.flag_count>0?'<div style="font-size:11px;color:var(--co);font-family:var(--mf);margin-top:2px">&#x1F6A9; '+p.flag_count+'</div>':''}
        <div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:4px">${p.created_at?new Date(p.created_at).toLocaleDateString():''}</div>
        ${p.word_count?'<div style="font-size:10px;color:var(--tm);font-family:var(--mf)">'+p.word_count.toLocaleString()+' words</div>':''}
      </div>
    </div>
  </div>`;
}

function _pesc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// ═══════════════════════════════════════════════════════════════
// 2. DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

async function _pubShowDetail(id){
  const p=_pubList.find(x=>x.id===id);
  if(!p){toast('Publication not found','err');return}
  hi('#pub-cards');hi('#pub-submit');sh('#pub-detail');

  const authors=(p.authors||[]).map(a=>{
    let s=_pesc(a.name||'');
    if(a.affiliation)s+=' <span style="color:var(--tm)">— '+_pesc(a.affiliation)+'</span>';
    if(a.orcid)s+=' <a href="https://orcid.org/'+_pesc(a.orcid)+'" target="_blank" style="font-size:10px">ORCID</a>';
    if(a.email)s+=' <span style="font-size:10px;color:var(--tm)">('+_pesc(a.email)+')</span>';
    return s;
  }).join('<br>')||'Unknown';

  const collabs=(p.collaborators||[]).map(c=>_pesc(c.name||'')+' <span style="color:var(--tm)">'+_pesc(c.type||'')+(c.country?', '+_pesc(c.country):'')+'</span>').join('<br>');
  const speciesHtml=(p.species_studied||[]).map(s=>`<span class="bg oa" style="font-size:11px">${_pesc(s)}</span>`).join(' ')||'—';
  const kwHtml=(p.keywords||[]).map(k=>`<span style="font-size:11px;color:var(--ac);font-family:var(--mf)">#${_pesc(k)}</span>`).join(' ')||'—';
  const dateRange=p.time_frame_start?(p.time_frame_start+(p.time_frame_end?' to '+p.time_frame_end:'')):'—';
  const sections=p.sections_detected||{};
  const sectionBadges=_PUB_SECTIONS.map(s=>{
    const key=s.toLowerCase().replace(/\s+/g,'_');
    const found=sections[key];
    return`<span style="font-size:10px;font-family:var(--mf);padding:2px 6px;border-radius:3px;${found?'color:var(--sg);background:var(--sm);border:1px solid var(--sb)':'color:var(--co);background:var(--cm);border:1px solid rgba(194,120,120,.2)'}">${s} ${found?'&#x2713;':'&#x2717;'}</span>`;
  }).join(' ');

  // Check if user already endorsed
  let userEndorsed=false;
  if(_supaUser){
    try{
      const{data}=await SB.from('publication_endorsements').select('id').eq('publication_id',id).eq('user_id',_supaUser.id).maybeSingle();
      userEndorsed=!!data;
    }catch(e){}
  }

  // Load linked datasets
  let linkedDatasetsHtml='';
  if(p.linked_dataset_ids&&p.linked_dataset_ids.length){
    try{
      const{data:datasets}=await SB.from('archived_datasets').select('id,title,meridian_data_id,file_format,file_size_bytes,file_url,download_count').in('id',p.linked_dataset_ids);
      if(datasets&&datasets.length){
        linkedDatasetsHtml=`<div class="sec" style="margin-top:16px"><div class="sh"><h4>Linked Datasets</h4></div><div class="sb">${datasets.map(d=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">
            <div>
              <span style="font-size:10px;font-family:var(--mf);color:var(--ac);background:var(--am);padding:2px 6px;border-radius:3px;border:1px solid var(--ab)">${_pesc(d.meridian_data_id||'')}</span>
              <span style="font-size:13px;color:var(--tx);margin-left:8px;font-weight:500">${_pesc(d.title)}</span>
              ${d.file_format?'<span style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-left:6px">'+_pesc(d.file_format)+'</span>':''}
              ${d.file_size_bytes?'<span style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-left:4px">('+_pubFormatBytes(d.file_size_bytes)+')</span>':''}
            </div>
            ${d.file_url?'<button class="bt sm on" onclick="_pubDownloadDataset(\''+d.id+'\')" style="font-size:11px">Download</button>':''}
          </div>`).join('')}</div></div>`;
      }
    }catch(e){console.warn('Linked datasets:',e)}
  }

  // Load comments
  let commentsHtml='';
  try{
    const{data:comments}=await SB.from('publication_comments').select('*').eq('publication_id',id).order('created_at',{ascending:true});
    if(comments&&comments.length){
      commentsHtml=comments.map(c=>`<div style="padding:8px 0;border-bottom:1px solid var(--bd);font-size:12px">
        <div style="color:var(--tm);font-family:var(--mf);margin-bottom:4px">${new Date(c.created_at).toLocaleString()}</div>
        <div style="color:var(--ts)">${_pesc(c.comment_text)}</div>
      </div>`).join('');
    }
  }catch(e){}

  const isOwn=_supaUser&&p.user_id===_supaUser.id;
  const canEdit=isOwn&&(p.status==='draft'||p.status==='pending_review');

  H('#pub-detail',`
    <button class="bt sm" onclick="_pubBackToBrowse()" style="margin-bottom:14px">&larr; Back to publications</button>
    <div class="sec">
      <div class="sh" style="cursor:default">
        <div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:11px;font-family:var(--mf);color:var(--ac);background:var(--am);padding:2px 8px;border-radius:3px;border:1px solid var(--ab)">${_pesc(p.meridian_id||'')}</span>
            <span class="bg oa">${_pesc(p.category)}</span>
            ${p.location_region?'<span class="bg yr">'+_pesc(p.location_region)+'</span>':''}
            ${p.is_trusted_author?'<span style="font-size:11px;color:var(--sg);font-family:var(--mf)">&#x2705; Trusted Author</span>':''}
            <span style="font-size:11px;color:var(--wa);font-family:var(--mf)">${p.status}</span>
          </div>
          <h4 style="font-size:18px;color:var(--tx);text-transform:none;letter-spacing:0;font-weight:700">${_pesc(p.title)}</h4>
        </div>
      </div>
      <div class="sb">
        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 16px;font-size:12px;font-family:var(--mf)">
          <span style="color:var(--tm)">Authors</span><span style="color:var(--ts)">${authors}</span>
          ${collabs?'<span style="color:var(--tm)">Collaborators</span><span style="color:var(--ts)">'+collabs+'</span>':''}
          <span style="color:var(--tm)">Category</span><span style="color:var(--ts)">${_pesc(p.category)}</span>
          <span style="color:var(--tm)">Region</span><span style="color:var(--ts)">${_pesc(p.location_region||'—')}</span>
          <span style="color:var(--tm)">Species</span><span>${speciesHtml}</span>
          <span style="color:var(--tm)">Keywords</span><span>${kwHtml}</span>
          <span style="color:var(--tm)">Time Frame</span><span style="color:var(--ts)">${dateRange}</span>
          ${p.word_count?'<span style="color:var(--tm)">Word Count</span><span style="color:var(--ts)">'+p.word_count.toLocaleString()+'</span>':''}
          ${p.reference_count!=null?'<span style="color:var(--tm)">References</span><span style="color:var(--ts)">'+p.reference_count+'</span>':''}
          <span style="color:var(--tm)">Endorsements</span><span style="color:var(--sg);font-weight:600">${p.endorsement_count||0}</span>
          <span style="color:var(--tm)">Uploaded</span><span style="color:var(--ts)">${p.created_at?new Date(p.created_at).toLocaleDateString():''}</span>
          ${p.location_lat!=null?'<span style="color:var(--tm)">Location</span><span style="color:var(--ts)">'+p.location_lat.toFixed(4)+', '+p.location_lng.toFixed(4)+'</span>':''}
        </div>

        <div style="margin-top:16px"><div style="font-size:11px;font-family:var(--mf);color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Sections Detected</div>${sectionBadges}</div>

        <div style="margin-top:16px;padding:14px;background:var(--be);border-radius:var(--rd)">
          <div style="font-size:11px;font-family:var(--mf);color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Abstract</div>
          <div style="font-size:13px;color:var(--ts);line-height:1.7">${_pesc(p.abstract)}</div>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          ${p.pdf_url?'<button class="bt on" onclick="_pubDownloadPDF(\''+p.id+'\')">View PDF</button>':''}
          ${_supaUser?`<button class="bt sm" id="pub-endorse-btn" onclick="_pubToggleEndorse('${p.id}')" style="color:var(--sg);border-color:var(--sb)">${userEndorsed?'&#x2705; Endorsed':'&#x1F44D; Endorse'}</button>`:''}
          ${_supaUser?`<button class="bt sm" onclick="_pubShowFlagForm('${p.id}')" style="color:var(--co);border-color:rgba(194,120,120,.3)">&#x1F6A9; Flag</button>`:''}
          ${canEdit?`<button class="bt sm" onclick="_pubDeleteOwn('${p.id}')" style="color:var(--co);border-color:rgba(194,120,120,.3)">Delete</button>`:''}
        </div>
      </div>
    </div>

    ${linkedDatasetsHtml}

    <div class="sec" style="margin-top:16px"><div class="sh"><h4>Comments</h4></div><div class="sb">
      <div id="pub-comments">${commentsHtml||'<div style="color:var(--tm);font-size:12px">No comments yet.</div>'}</div>
      ${_supaUser?`<div style="display:flex;gap:8px;margin-top:12px"><input class="fi" id="pub-comment-input" placeholder="Add a comment..." style="flex:1"/><button class="bt sm on" onclick="_pubAddComment('${p.id}')">Post</button></div>`:''}
    </div></div>

    <div id="pub-flag-form" style="display:none;margin-top:16px"></div>
  `);
}

function _pubBackToBrowse(){
  hi('#pub-detail');hi('#pub-submit');sh('#pub-cards');
}

async function _pubDownloadPDF(id){
  const p=_pubList.find(x=>x.id===id);
  if(!p||!p.pdf_url){toast('No PDF available','err');return}
  const{data}=SB.storage.from('publication-pdfs').getPublicUrl(p.pdf_url);
  if(data?.publicUrl)window.open(data.publicUrl,'_blank');
  else toast('PDF URL not available','err');
}

async function _pubDownloadDataset(id){
  try{
    const{data:d}=await SB.from('archived_datasets').select('file_url').eq('id',id).single();
    if(!d?.file_url){toast('No file','err');return}
    try{await SB.rpc('increment_download',{dataset_id:id})}catch(e){}
    const{data:url}=SB.storage.from('archived-datasets').getPublicUrl(d.file_url);
    if(url?.publicUrl)window.open(url.publicUrl,'_blank');
  }catch(e){toast('Download failed','err')}
}

async function _pubToggleEndorse(id){
  if(!_supaUser){toast('Sign in to endorse','err');return}
  const btn=$('#pub-endorse-btn');
  const p=_pubList.find(x=>x.id===id);
  try{
    const{data:existing}=await SB.from('publication_endorsements').select('id').eq('publication_id',id).eq('user_id',_supaUser.id).maybeSingle();
    if(existing){
      await SB.rpc('remove_endorsement',{pub_id:id});
      if(p)p.endorsement_count=Math.max(0,(p.endorsement_count||1)-1);
      if(btn)btn.innerHTML='&#x1F44D; Endorse';
      toast('Endorsement removed','info');
    }else{
      await SB.rpc('increment_endorsement',{pub_id:id});
      if(p)p.endorsement_count=(p.endorsement_count||0)+1;
      if(btn)btn.innerHTML='&#x2705; Endorsed';
      toast('Publication endorsed!','ok');
    }
  }catch(e){toast('Endorsement failed: '+e.message,'err')}
}

async function _pubAddComment(id){
  const input=$('#pub-comment-input');
  const text=input?.value?.trim();
  if(!text){toast('Enter a comment','err');return}
  try{
    const{error}=await SB.from('publication_comments').insert({publication_id:id,user_id:_supaUser.id,comment_text:text});
    if(error)throw error;
    input.value='';
    toast('Comment posted','ok');
    _pubShowDetail(id);// refresh
  }catch(e){toast('Comment failed: '+e.message,'err')}
}

function _pubShowFlagForm(id){
  if(!_supaUser){toast('Sign in to flag','err');return}
  const el=$('#pub-flag-form');if(!el)return;
  sh(el);
  H(el,`<div class="sec"><div class="sh"><h4>Flag this Publication</h4></div><div class="sb">
    <select class="fs" id="pub-flag-reason" style="margin-bottom:8px;width:100%">
      <option value="">Select a reason...</option>
      <option value="plagiarism">Plagiarism</option>
      <option value="misleading_data">Misleading data</option>
      <option value="insufficient_methods">Insufficient methods</option>
      <option value="factual_errors">Factual errors</option>
      <option value="spam">Spam</option>
      <option value="other">Other</option>
    </select>
    <textarea class="fi" id="pub-flag-desc" placeholder="Additional details (optional)" rows="3" style="resize:vertical;width:100%;margin-bottom:8px"></textarea>
    <div style="display:flex;gap:8px"><button class="bt on" onclick="_pubSubmitFlag('${id}')">Submit Flag</button><button class="bt sm" onclick="hi('#pub-flag-form')">Cancel</button></div>
  </div></div>`);
}

async function _pubSubmitFlag(id){
  const reason=$('#pub-flag-reason')?.value;
  if(!reason){toast('Select a reason','err');return}
  try{
    const{error}=await SB.from('publication_flags').insert({
      publication_id:id,user_id:_supaUser.id,reason,description:$('#pub-flag-desc')?.value?.trim()||null
    });
    if(error)throw error;
    toast('Publication flagged — thank you','ok');
    hi('#pub-flag-form');
  }catch(e){toast('Flag failed: '+e.message,'err')}
}

async function _pubDeleteOwn(id){
  if(!confirm('Delete this publication? This cannot be undone.'))return;
  try{
    const p=_pubList.find(x=>x.id===id);
    if(p?.pdf_url)await SB.storage.from('publication-pdfs').remove([p.pdf_url]);
    const{error}=await SB.from('publications').delete().eq('id',id);
    if(error)throw error;
    _pubList=_pubList.filter(x=>x.id!==id);
    _pubBackToBrowse();
    _pubRenderCards();
    toast('Publication deleted','ok');
  }catch(e){toast('Delete failed: '+e.message,'err')}
}

function _pubFormatBytes(b){
  if(b<1024)return b+' B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  if(b<1073741824)return(b/1048576).toFixed(1)+' MB';
  return(b/1073741824).toFixed(2)+' GB';
}


// ═══════════════════════════════════════════════════════════════
// 3. SUBMISSION FORM
// ═══════════════════════════════════════════════════════════════

let _pubUploadPDF=null;
let _pubPDFAnalysis=null;

function _pubShowSubmit(){
  if(!_supaUser){toast('Sign in to submit','err');return}
  hi('#pub-cards');hi('#pub-detail');sh('#pub-submit');
  _pubUploadPDF=null;_pubPDFAnalysis=null;

  H('#pub-submit',`
    <button class="bt sm" onclick="_pubBackToBrowse()" style="margin-bottom:14px">&larr; Back to publications</button>
    <div style="margin-bottom:16px;padding:14px 18px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd)">
      <div style="font-size:13px;color:var(--ts);line-height:1.6">
        <b style="color:var(--ac)">All submissions must follow the Meridian Publication Template.</b><br>
        <a href="/template/Meridian_Publication_Template.docx" download style="color:var(--sg);font-weight:600;font-size:14px">&#x1F4E5; Download the Meridian Publication Template (.docx)</a>
        <span style="font-size:11px;color:var(--tm);margin-left:6px">Required sections: Title, Authors, Abstract, Introduction, Methods, Results, Discussion, Conclusion, References</span>
      </div>
    </div>

    <div class="sec"><div class="sh"><h4>Submit Publication</h4></div><div class="sb">
      <div style="display:grid;gap:14px">
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Title *</label>
          <input class="si" id="pub-s-title" placeholder="Publication title" style="font-size:13px"/>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Abstract *</label>
          <textarea class="fi" id="pub-s-abstract" placeholder="Publication abstract — minimum 100 words" rows="5" style="resize:vertical;width:100%;font-size:13px"></textarea>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Authors * (one per line: Name | Affiliation | Email | ORCID)</label>
          <textarea class="fi" id="pub-s-authors" placeholder="Jane Smith | University of Sydney | jane@uni.edu | 0000-0001-2345-6789" rows="3" style="resize:vertical;width:100%;font-size:12px"></textarea>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Collaborators (one per line: Name | Type | Country)</label>
          <textarea class="fi" id="pub-s-collabs" placeholder="CSIRO | Government Agency | Australia" rows="2" style="resize:vertical;width:100%;font-size:12px"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Category *</label>
            <select class="fs" id="pub-s-category" style="width:100%">
              <option value="">Select...</option>
              <option>Field Study</option><option>Technical Report</option><option>Thesis/Dissertation</option>
              <option>Review</option><option>Dataset Description</option><option>Monitoring Report</option>
              <option>Methodology</option><option>Policy Brief</option><option>Preprint</option><option>Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Region</label>
            <input class="fi" id="pub-s-region" placeholder="e.g. Mediterranean, Western Atlantic" style="width:100%"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Species Studied (comma-separated)</label>
            <input class="fi" id="pub-s-species" placeholder="e.g. Pagrus auratus, Chrysophrys auratus" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Keywords (comma-separated)</label>
            <input class="fi" id="pub-s-keywords" placeholder="e.g. otolith, growth, age estimation" style="width:100%"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Time Frame Start</label>
            <input type="date" class="fi" id="pub-s-start" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Time Frame End</label>
            <input type="date" class="fi" id="pub-s-end" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Coordinates (lat, lng)</label>
            <input class="fi" id="pub-s-coords" placeholder="e.g. -33.86, 151.21" style="width:100%"/>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Link Datasets (optional — enter Meridian Data IDs, comma-separated)</label>
          <input class="fi" id="pub-s-datasets" placeholder="e.g. MD-2026-0001, MD-2026-0003" style="width:100%"/>
        </div>

        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Upload PDF *</label>
          <div id="pub-s-dropzone" style="border:2px dashed var(--bd);border-radius:var(--rd);padding:24px;text-align:center;cursor:pointer;transition:border-color .2s;background:var(--bs)"
            ondragover="event.preventDefault();this.style.borderColor='var(--ac)'"
            ondragleave="this.style.borderColor='var(--bd)'"
            ondrop="event.preventDefault();this.style.borderColor='var(--bd)';_pubHandlePDF(event.dataTransfer.files)"
            onclick="$('#pub-s-file').click()">
            <div style="font-size:13px;color:var(--ts);margin-bottom:4px">Drop PDF here or click to browse</div>
            <div style="font-size:11px;color:var(--tm);font-family:var(--mf)">PDF only — max 50 MB</div>
            <input type="file" id="pub-s-file" accept=".pdf" style="display:none" onchange="_pubHandlePDF(this.files)"/>
          </div>
          <div id="pub-s-file-info" style="display:none;margin-top:8px;padding:8px 12px;background:var(--be);border-radius:6px;font-size:12px;color:var(--ts);font-family:var(--mf)"></div>
        </div>
        <div id="pub-s-validation" style="display:none"></div>

        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="bt on" onclick="_pubSubmitPublication()" id="pub-s-btn">Submit for Review</button>
          <button class="bt sm" onclick="_pubBackToBrowse()">Cancel</button>
        </div>
        <div id="pub-s-status" style="display:none;margin-top:8px;font-size:12px;font-family:var(--mf)"></div>
      </div>
    </div></div>
  `);
}

async function _pubHandlePDF(files){
  if(!files||!files.length)return;
  const file=files[0];
  if(file.size>50*1024*1024){toast('PDF too large (max 50 MB)','err');return}
  if(!file.name.toLowerCase().endsWith('.pdf')){toast('Only PDF files accepted','err');return}
  _pubUploadPDF=file;

  const info=$('#pub-s-file-info');
  if(info){sh(info);H(info,`<strong>${_pesc(file.name)}</strong> — ${_pubFormatBytes(file.size)}`)}

  // Validate sections against template
  _pubValidatePDF(file);
}

async function _pubValidatePDF(file){
  const valEl=$('#pub-s-validation');
  if(!valEl)return;
  sh(valEl);
  H(valEl,'<div style="color:var(--ac);font-size:12px;padding:8px">Analyzing PDF structure...</div>');

  if(typeof pdfjsLib==='undefined'){
    H(valEl,'<div style="color:var(--wa);font-size:12px;padding:8px">PDF.js not loaded — section validation skipped</div>');
    return;
  }

  try{
    const buf=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;
    let fullText='';
    let wordCount=0;
    const refPattern=/^\[\d+\]|^\d+\.\s|^[A-Z][a-z]+,\s[A-Z]\./;
    let refCount=0;
    let inRefs=false;

    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      const text=content.items.map(it=>it.str).join(' ');
      fullText+=text+'\n';
    }

    // Word count
    wordCount=fullText.split(/\s+/).filter(w=>w.length>0).length;

    // Detect sections
    const sectionsFound={};
    const sectionNames=['abstract','introduction','methods','methodology','results','discussion','conclusion','conclusions','acknowledgements','acknowledgments','data availability statement','data availability','references','bibliography'];
    const lines=fullText.split('\n');

    for(const line of lines){
      const trimmed=line.trim().toLowerCase().replace(/^\d+[\.\)]\s*/,'');
      for(const sec of sectionNames){
        if(trimmed===sec||trimmed===sec+':'||trimmed.startsWith(sec+' ')||trimmed.startsWith(sec+':')){
          const key=sec.replace('methodology','methods').replace('conclusions','conclusion').replace('acknowledgments','acknowledgements').replace('bibliography','references').replace('data availability','data_availability_statement').replace(/\s+/g,'_');
          sectionsFound[key]=true;
          if(sec==='references'||sec==='bibliography')inRefs=true;
        }
      }
      if(inRefs&&refPattern.test(line.trim()))refCount++;
    }

    _pubPDFAnalysis={wordCount,sectionsFound,refCount,numPages:pdf.numPages};

    // Render validation results
    const required=['abstract','introduction','methods','results','discussion','conclusion','references'];
    const optional=['acknowledgements','data_availability_statement'];
    let html='<div class="sec"><div class="sh"><h4>Template Validation</h4></div><div class="sb">';
    html+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;font-size:12px;font-family:var(--mf)">
      <div><span style="color:var(--tm)">Pages:</span> <span style="color:var(--ts)">${pdf.numPages}</span></div>
      <div><span style="color:var(--tm)">Words:</span> <span style="color:${wordCount<500?'var(--co)':'var(--ts)'}">~${wordCount.toLocaleString()}</span></div>
      <div><span style="color:var(--tm)">References:</span> <span style="color:var(--ts)">~${refCount}</span></div>
    </div>`;

    let missingRequired=0;
    html+='<div style="font-size:11px;font-family:var(--mf);color:var(--tm);margin-bottom:6px">REQUIRED SECTIONS</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">';
    for(const s of required){
      const found=sectionsFound[s];
      if(!found)missingRequired++;
      const label=s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      html+=`<span style="font-size:11px;font-family:var(--mf);padding:3px 8px;border-radius:4px;${found?'color:var(--sg);background:var(--sm);border:1px solid var(--sb)':'color:var(--co);background:var(--cm);border:1px solid rgba(194,120,120,.2)'}">${label} ${found?'&#x2713;':'&#x2717; missing'}</span>`;
    }
    html+='</div>';

    html+='<div style="font-size:11px;font-family:var(--mf);color:var(--tm);margin-bottom:6px">OPTIONAL SECTIONS</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">';
    for(const s of optional){
      const found=sectionsFound[s];
      const label=s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      html+=`<span style="font-size:11px;font-family:var(--mf);padding:3px 8px;border-radius:4px;${found?'color:var(--sg);background:var(--sm);border:1px solid var(--sb)':'color:var(--tm);background:var(--be);border:1px solid var(--bd)'}">${label} ${found?'&#x2713;':'—'}</span>`;
    }
    html+='</div>';

    if(missingRequired>0){
      html+=`<div style="padding:8px 12px;background:var(--cm);border:1px solid rgba(194,120,120,.2);border-radius:6px;font-size:12px;color:var(--co);margin-bottom:8px">&#x26A0; ${missingRequired} required section${missingRequired>1?'s':''} not detected. Make sure your PDF follows the <a href="/template/Meridian_Publication_Template.docx" download style="color:var(--co);text-decoration:underline">Meridian Publication Template</a>. You can still submit, but it may delay review.</div>`;
    }else{
      html+=`<div style="padding:8px 12px;background:var(--sm);border:1px solid var(--sb);border-radius:6px;font-size:12px;color:var(--sg)">&#x2705; All required sections detected. PDF matches the template structure.</div>`;
    }
    html+='</div></div>';
    H(valEl,html);

    // Auto-fill word count title if empty
    const titleEl=$('#pub-s-title');
    if(titleEl&&!titleEl.value){
      // Try to extract title from first page text
      const p1=await pdf.getPage(1);
      const c1=await p1.getTextContent();
      const items=c1.items;
      // Find the largest font text as likely title
      let maxSize=0,titleText='';
      for(const it of items){
        const sz=it.transform?Math.abs(it.transform[3]):it.height||0;
        if(sz>maxSize&&it.str.trim().length>3){maxSize=sz;titleText=it.str.trim()}
      }
      if(titleText&&titleText.length>5)titleEl.value=titleText;
    }

  }catch(e){
    console.warn('PDF validation:',e);
    H(valEl,`<div style="color:var(--wa);font-size:12px;padding:8px">PDF analysis failed: ${_pesc(e.message)}. You can still submit.</div>`);
  }
}

async function _pubSubmitPublication(){
  const title=$('#pub-s-title')?.value?.trim();
  const abstract=$('#pub-s-abstract')?.value?.trim();
  const category=$('#pub-s-category')?.value;
  if(!title){toast('Title is required','err');return}
  if(!abstract){toast('Abstract is required','err');return}
  if(!category){toast('Category is required','err');return}
  if(!_pubUploadPDF){toast('Upload a PDF file','err');return}

  const authorsRaw=$('#pub-s-authors')?.value?.trim();
  if(!authorsRaw){toast('At least one author is required','err');return}

  const btn=$('#pub-s-btn');
  if(btn){btn.disabled=true;btn.textContent='Uploading...'}
  const status=$('#pub-s-status');
  if(status){sh(status);H(status,'<span style="color:var(--ac)">Uploading PDF...</span>')}

  try{
    // 1. Upload PDF
    const filePath=`${_supaUser.id}/${Date.now()}-${_pubUploadPDF.name}`;
    const{error:upErr}=await SB.storage.from('publication-pdfs').upload(filePath,_pubUploadPDF,{cacheControl:'3600',upsert:false});
    if(upErr)throw upErr;

    if(status)H(status,'<span style="color:var(--ac)">Creating publication record...</span>');

    // 2. Parse form
    const authors=authorsRaw.split('\n').filter(l=>l.trim()).map(l=>{
      const parts=l.split('|').map(p=>p.trim());
      return{name:parts[0]||'',affiliation:parts[1]||'',email:parts[2]||'',orcid:parts[3]||''};
    });
    const collabsRaw=$('#pub-s-collabs')?.value?.trim();
    const collaborators=collabsRaw?collabsRaw.split('\n').filter(l=>l.trim()).map(l=>{
      const parts=l.split('|').map(p=>p.trim());
      return{name:parts[0]||'',type:parts[1]||'',country:parts[2]||''};
    }):null;
    const region=$('#pub-s-region')?.value?.trim()||null;
    const speciesRaw=$('#pub-s-species')?.value?.trim();
    const species=speciesRaw?speciesRaw.split(',').map(s=>s.trim()).filter(Boolean):null;
    const kwRaw=$('#pub-s-keywords')?.value?.trim();
    const keywords=kwRaw?kwRaw.split(',').map(k=>k.trim()).filter(Boolean):null;
    const start=$('#pub-s-start')?.value||null;
    const end=$('#pub-s-end')?.value||null;
    const coordsRaw=$('#pub-s-coords')?.value?.trim();
    let lat=null,lng=null;
    if(coordsRaw){
      const parts=coordsRaw.split(',').map(s=>parseFloat(s.trim()));
      if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])){lat=parts[0];lng=parts[1]}
    }

    // Resolve linked datasets
    let linkedDatasetIds=null;
    const dsRaw=$('#pub-s-datasets')?.value?.trim();
    if(dsRaw){
      const dsIds=dsRaw.split(',').map(s=>s.trim()).filter(Boolean);
      if(dsIds.length){
        const{data:datasets}=await SB.from('archived_datasets').select('id,meridian_data_id').in('meridian_data_id',dsIds);
        if(datasets&&datasets.length){
          linkedDatasetIds=datasets.map(d=>d.id);
          const foundIds=datasets.map(d=>d.meridian_data_id);
          const missing=dsIds.filter(d=>!foundIds.includes(d));
          if(missing.length)toast('Datasets not found: '+missing.join(', '),'warn');
        }else{toast('No matching datasets found','warn')}
      }
    }

    // Quality checks from PDF analysis
    const qc=_pubPDFAnalysis?{
      word_count:_pubPDFAnalysis.wordCount,
      sections_detected:_pubPDFAnalysis.sectionsFound,
      reference_count:_pubPDFAnalysis.refCount,
      pages:_pubPDFAnalysis.numPages,
      abstract_length:abstract.split(/\s+/).length,
      has_all_required:['abstract','introduction','methods','results','discussion','conclusion','references'].every(s=>_pubPDFAnalysis.sectionsFound[s])
    }:null;

    // 3. Insert
    const{data:newPub,error:insertErr}=await SB.from('publications').insert({
      user_id:_supaUser.id,
      title,abstract,
      authors,collaborators,
      category,
      location_region:region,
      location_lat:lat,location_lng:lng,
      species_studied:species,
      keywords,
      time_frame_start:start,time_frame_end:end,
      pdf_url:filePath,
      word_count:_pubPDFAnalysis?.wordCount||null,
      sections_detected:_pubPDFAnalysis?.sectionsFound||null,
      reference_count:_pubPDFAnalysis?.refCount||null,
      quality_checks:qc,
      linked_dataset_ids:linkedDatasetIds,
      status:'pending_review'
    }).select().single();
    if(insertErr)throw insertErr;

    toast('Publication submitted for review!','ok');
    _pubList.unshift(newPub);
    _pubBackToBrowse();
    _pubRenderCards();

  }catch(e){
    toast('Submission failed: '+e.message,'err');
    if(status)H(status,'<span style="color:var(--co)">Error: '+_pesc(e.message)+'</span>');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Submit for Review'}
  }
}
