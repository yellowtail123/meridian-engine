// ═══ MERIDIAN ARCHIVE — Archived Datasets Browse / Upload / Detail ═══

let _archInit=false;
let _archDatasets=[];      // cached dataset list
let _archFilters={search:'',region:[],species:[],dataType:[],variables:[],format:[],license:[],dateStart:null,dateEnd:null,sort:'newest'};
let _archUploadFile=null;  // pending file for upload
let _archUploadHeaders=[]; // detected CSV/XLSX headers
let _archUploadPreview=[];  // first 10 rows

function initArchive(){
  if(_archInit&&$('#arch-content')?.children.length)return;
  _archInit=true;
  _renderArchiveUI();
  _archLoadDatasets();
}

// ═══════════════════════════════════════════════════════════════
// 1. BROWSE / SEARCH VIEW
// ═══════════════════════════════════════════════════════════════

function _renderArchiveUI(){
  H('#arch-content',`
    <div class="tip-wrap"><button class="tip-toggle" onclick="toggleTipPopover(this)" title="About this tab">i</button><div class="tip tip-pop"><b>Archived Data.</b> Browse, search, and download community-shared datasets. Logged-in users can upload their own datasets for archiving and sharing.<button class="dx" onclick="this.closest('.tip').style.display='none'">&times;</button></div></div>
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div class="si-wrap" style="flex:1;min-width:240px"><input class="si" id="arch-search" placeholder="Search datasets — title, species, variables, authors..." oninput="_archApplyFilters()" style="font-size:14px"/><button class="si-clear" type="button" onclick="$('#arch-search').value='';_archApplyFilters()" aria-label="Clear">&times;</button></div>
      <select class="fs" id="arch-sort" onchange="_archFilters.sort=this.value;_archRenderCards()" style="min-width:150px">
        <option value="newest">Newest first</option>
        <option value="downloads">Most downloaded</option>
        <option value="largest">Largest files</option>
        <option value="species_az">Species A–Z</option>
      </select>
      <button class="bt sm" onclick="_archToggleFilters()" id="arch-filter-btn" style="position:relative">Filters <span id="arch-filter-count" style="display:none;background:var(--ac);color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px"></span></button>
      ${_supaUser?'<button class="bt sm on" onclick="_archShowUpload()">+ Upload Dataset</button>':''}
    </div>
    <div id="arch-filters" style="display:none;margin-bottom:16px;padding:16px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)"></div>
    <div id="arch-cards">${mkL()}</div>
    <div id="arch-detail" style="display:none"></div>
    <div id="arch-upload" style="display:none"></div>
  `);
}

async function _archLoadDatasets(){
  try{
    const{data,error}=await SB.from('archived_datasets')
      .select('*')
      .order('created_at',{ascending:false});
    if(error)throw error;
    _archDatasets=data||[];
    _archBuildFilterOptions();
    _archRenderCards();
  }catch(e){
    console.warn('Archive load:',e);
    H('#arch-cards','<div style="text-align:center;padding:30px;color:var(--co);font-size:13px">Failed to load datasets. '+e.message+'</div>');
  }
}

function _archBuildFilterOptions(){
  const regions=new Map(),species=new Map(),vars=new Map(),formats=new Set(),licenses=new Set();
  for(const d of _archDatasets){
    if(d.status!=='published')continue;
    if(d.region){regions.set(d.region,(regions.get(d.region)||0)+1)}
    if(d.species)for(const s of d.species){species.set(s,(species.get(s)||0)+1)}
    if(d.variables_included)for(const v of d.variables_included){vars.set(v,(vars.get(v)||0)+1)}
    if(d.file_format)formats.add(d.file_format);
    if(d.license)licenses.add(d.license);
  }
  // Sort maps by count desc
  const sortMap=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
  window._archFilterOpts={regions:sortMap(regions),species:sortMap(species),vars:sortMap(vars),
    formats:[...formats].sort(),licenses:[...licenses].sort(),
    dataTypes:['Catch Data','Survey Data','Environmental Monitoring','Genetic/Genomic','Acoustic/Telemetry','Photo/Video Transect','Water Quality','Population Census','Tagging/Recapture','Socioeconomic','Other']};
  _archRenderFilterPanel();
}

function _archRenderFilterPanel(){
  const o=window._archFilterOpts;if(!o)return;
  const chk=(arr,name,label,count)=>{
    const id='af-'+name+'-'+label.replace(/[^a-zA-Z0-9]/g,'');
    const checked=arr.includes(label)?'checked':'';
    return`<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ts);cursor:pointer;padding:2px 0"><input type="checkbox" ${checked} onchange="_archToggleFilter('${name}','${label.replace(/'/g,"\\'")}',this.checked)" style="accent-color:var(--ac)"/> ${label}${count?' <span style="color:var(--tm);font-size:10px">('+count+')</span>':''}</label>`;
  };
  const section=(title,items)=>{
    if(!items.length)return'';
    return`<div style="margin-bottom:12px"><div style="font-size:11px;font-family:var(--mf);color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${title}</div><div style="display:flex;flex-wrap:wrap;gap:4px 16px;max-height:120px;overflow-y:auto">${items.join('')}</div></div>`;
  };
  H('#arch-filters',`
    ${section('Region',o.regions.map(([r,c])=>chk(_archFilters.region,'region',r,c)))}
    ${section('Species',o.species.map(([s,c])=>chk(_archFilters.species,'species',s,c)))}
    ${section('Data Type',o.dataTypes.map(t=>chk(_archFilters.dataType,'dataType',t)))}
    ${section('Variables',o.vars.map(([v,c])=>chk(_archFilters.variables,'variables',v,c)))}
    ${section('File Format',o.formats.map(f=>chk(_archFilters.format,'format',f)))}
    ${section('License',o.licenses.map(l=>chk(_archFilters.license,'license',l)))}
    <div style="margin-bottom:8px"><div style="font-size:11px;font-family:var(--mf);color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Time Period</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="date" class="fi" id="arch-date-start" value="${_archFilters.dateStart||''}" onchange="_archFilters.dateStart=this.value||null;_archRenderCards()" style="font-size:12px"/>
        <span style="color:var(--tm);font-size:12px">to</span>
        <input type="date" class="fi" id="arch-date-end" value="${_archFilters.dateEnd||''}" onchange="_archFilters.dateEnd=this.value||null;_archRenderCards()" style="font-size:12px"/>
      </div>
    </div>
    <button class="bt sm" onclick="_archClearFilters()" style="margin-top:4px;color:var(--co);border-color:rgba(194,120,120,.3)">Clear all filters</button>
  `);
}

function _archToggleFilters(){
  const el=$('#arch-filters');
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function _archToggleFilter(name,val,checked){
  const arr=_archFilters[name];
  if(checked){if(!arr.includes(val))arr.push(val)}
  else{const i=arr.indexOf(val);if(i>=0)arr.splice(i,1)}
  _archUpdateFilterCount();
  _archRenderCards();
}

function _archClearFilters(){
  _archFilters={search:'',region:[],species:[],dataType:[],variables:[],format:[],license:[],dateStart:null,dateEnd:null,sort:_archFilters.sort};
  const el=$('#arch-search');if(el)el.value='';
  _archUpdateFilterCount();
  _archBuildFilterOptions();
  _archRenderCards();
}

function _archUpdateFilterCount(){
  let count=0;
  for(const k of['region','species','dataType','variables','format','license']){count+=_archFilters[k].length}
  if(_archFilters.dateStart)count++;
  if(_archFilters.dateEnd)count++;
  const badge=$('#arch-filter-count');
  if(badge){
    if(count>0){badge.style.display='inline';badge.textContent=count}
    else{badge.style.display='none'}
  }
}

function _archApplyFilters(){
  _archFilters.search=($('#arch-search')?.value||'').toLowerCase().trim();
  _archRenderCards();
}

function _archRenderCards(){
  let filtered=_archDatasets.filter(d=>{
    if(d.status!=='published'&&(!_supaUser||d.user_id!==_supaUser.id)&&!_supaIsAdmin)return false;
    const f=_archFilters;
    // Search
    if(f.search){
      const s=f.search;
      const hay=[d.title,d.description,d.region,...(d.species||[]),...(d.variables_included||[]),
        ...(d.authors||[]).map(a=>a.name||''),d.data_type,d.meridian_data_id].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(s))return false;
    }
    if(f.region.length&&!f.region.includes(d.region))return false;
    if(f.species.length&&!(d.species||[]).some(s=>f.species.includes(s)))return false;
    if(f.dataType.length&&!f.dataType.includes(d.data_type))return false;
    if(f.variables.length&&!(d.variables_included||[]).some(v=>f.variables.includes(v)))return false;
    if(f.format.length&&!f.format.includes(d.file_format))return false;
    if(f.license.length&&!f.license.includes(d.license))return false;
    if(f.dateStart&&d.time_frame_end&&d.time_frame_end<f.dateStart)return false;
    if(f.dateEnd&&d.time_frame_start&&d.time_frame_start>f.dateEnd)return false;
    return true;
  });
  // Sort
  const s=_archFilters.sort;
  if(s==='newest')filtered.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  else if(s==='downloads')filtered.sort((a,b)=>(b.download_count||0)-(a.download_count||0));
  else if(s==='largest')filtered.sort((a,b)=>(b.file_size_bytes||0)-(a.file_size_bytes||0));
  else if(s==='species_az')filtered.sort((a,b)=>{
    const sa=(a.species||[])[0]||'zzz',sb=(b.species||[])[0]||'zzz';
    return sa.localeCompare(sb);
  });

  if(!filtered.length){
    H('#arch-cards','<div style="text-align:center;padding:40px 20px;color:var(--tm);font-size:13px"><div style="font-size:24px;margin-bottom:10px;opacity:.3">&#x1F4C2;</div>No datasets found'+((_archFilters.search||_archFilters.region.length)?' matching your filters':'')+'.<br>'+ (_supaUser?'<button class="bt sm on" onclick="_archShowUpload()" style="margin-top:12px">Upload the first dataset</button>':'Sign in to upload datasets.')+'</div>');
    return;
  }
  H('#arch-cards',filtered.map(d=>_archCard(d)).join(''));
}

function _archCard(d){
  const authors=(d.authors||[]).map(a=>a.name||'Unknown').join(', ')||'Unknown author';
  const dateRange=d.time_frame_start?(d.time_frame_start.slice(0,7)+(d.time_frame_end?' – '+d.time_frame_end.slice(0,7):'')):'';
  const size=d.file_size_bytes?_archFormatBytes(d.file_size_bytes):'';
  const speciesTags=(d.species||[]).slice(0,4).map(s=>`<span class="bg oa" style="font-size:10px;padding:2px 6px">${_esc(s)}</span>`).join('')+((d.species||[]).length>4?`<span style="font-size:10px;color:var(--tm)">+${d.species.length-4}</span>`:'');
  const isOwn=_supaUser&&d.user_id===_supaUser.id;
  return`<div class="pc" style="cursor:pointer" onclick="_archShowDetail('${d.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:10px;font-family:var(--mf);color:var(--ac);background:var(--am);padding:2px 6px;border-radius:3px;border:1px solid var(--ab)">${_esc(d.meridian_data_id||'')}</span>
          <span class="bg oa" style="font-size:10px;padding:2px 6px">${_esc(d.data_type)}</span>
          ${d.region?'<span class="bg yr" style="font-size:10px;padding:2px 6px">'+_esc(d.region)+'</span>':''}
          ${d.status!=='published'?'<span style="font-size:10px;color:var(--co);font-family:var(--mf)">'+d.status+'</span>':''}
        </div>
        <div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:3px">${_esc(d.title)}</div>
        <div style="font-size:12px;color:var(--tm);margin-bottom:6px">${_esc(authors)}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">${speciesTags}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:120px">
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          ${d.file_format?'<span style="font-size:11px;font-family:var(--mf);color:var(--ts);background:var(--be);padding:2px 8px;border-radius:3px">'+_esc(d.file_format)+'</span>':''}
          ${size?'<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">'+size+'</span>':''}
          <span style="font-size:11px;color:var(--tm);font-family:var(--mf)" title="Downloads">&#x2B07; ${d.download_count||0}</span>
          ${d.license?'<span style="font-size:10px;color:var(--sg);font-family:var(--mf)">'+_esc(d.license)+'</span>':''}
          ${dateRange?'<span style="font-size:10px;color:var(--tm);font-family:var(--mf)">'+dateRange+'</span>':''}
        </div>
      </div>
    </div>
    ${d.file_url?'<button class="bt sm on" onclick="event.stopPropagation();_archDownload(\''+d.id+'\')" style="margin-top:8px;font-size:11px">Download</button>':''}
    ${isOwn?'<button class="bt sm" onclick="event.stopPropagation();_archDeleteOwn(\''+d.id+'\')" style="margin-top:8px;margin-left:6px;font-size:11px;color:var(--co);border-color:rgba(194,120,120,.3)">Delete</button>':''}
  </div>`;
}

function _archFormatBytes(b){
  if(b<1024)return b+' B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  if(b<1073741824)return(b/1048576).toFixed(1)+' MB';
  return(b/1073741824).toFixed(2)+' GB';
}

function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

async function _archDownload(id){
  const d=_archDatasets.find(x=>x.id===id);
  if(!d||!d.file_url){toast('No file available','err');return}
  // Increment download count
  try{await SB.rpc('increment_download',{dataset_id:id})}catch(e){console.warn('Download count:',e)}
  // Update local count
  if(d)d.download_count=(d.download_count||0)+1;
  // Get public URL and open
  const{data}=SB.storage.from('archived-datasets').getPublicUrl(d.file_url);
  if(data?.publicUrl){
    window.open(data.publicUrl,'_blank');
    _archRenderCards();
  }else{
    toast('Download URL not available','err');
  }
}

async function _archDeleteOwn(id){
  if(!confirm('Delete this dataset? This cannot be undone.'))return;
  try{
    const d=_archDatasets.find(x=>x.id===id);
    // Delete file from storage
    if(d?.file_url){
      await SB.storage.from('archived-datasets').remove([d.file_url]);
    }
    // Delete record
    const{error}=await SB.from('archived_datasets').delete().eq('id',id);
    if(error)throw error;
    _archDatasets=_archDatasets.filter(x=>x.id!==id);
    _archRenderCards();
    toast('Dataset deleted','ok');
  }catch(e){
    toast('Delete failed: '+e.message,'err');
  }
}


// ═══════════════════════════════════════════════════════════════
// 2. INDIVIDUAL DATASET DETAIL VIEW
// ═══════════════════════════════════════════════════════════════

async function _archShowDetail(id){
  const d=_archDatasets.find(x=>x.id===id);
  if(!d){toast('Dataset not found','err');return}
  hi('#arch-cards');
  sh('#arch-detail');
  hi('#arch-upload');

  const authors=(d.authors||[]).map(a=>{
    let s=_esc(a.name||'');
    if(a.affiliation)s+=' <span style="color:var(--tm)">— '+_esc(a.affiliation)+'</span>';
    if(a.orcid)s+=' <a href="https://orcid.org/'+_esc(a.orcid)+'" target="_blank" style="font-size:10px">ORCID</a>';
    return s;
  }).join('<br>')||'Unknown';

  const speciesHtml=(d.species||[]).map(s=>`<span class="bg oa" style="font-size:11px">${_esc(s)}</span>`).join(' ')||'—';
  const varsHtml=(d.variables_included||[]).map(v=>`<span class="bg yr" style="font-size:11px">${_esc(v)}</span>`).join(' ')||'—';
  const dateRange=d.time_frame_start?(d.time_frame_start+(d.time_frame_end?' to '+d.time_frame_end:'')):'—';
  const size=d.file_size_bytes?_archFormatBytes(d.file_size_bytes):'—';

  let pubCard='';
  if(d.linked_publication_id){
    try{
      const{data:pub}=await SB.from('publications').select('id,title,meridian_id,authors,status').eq('id',d.linked_publication_id).single();
      if(pub){
        const pubAuthors=(pub.authors||[]).map(a=>a.name).join(', ');
        pubCard=`<div class="sec" style="margin-top:16px"><div class="sh"><h4>Related Publication</h4></div><div class="sb">
          <div style="font-size:13px;font-weight:600;color:var(--ac)">${_esc(pub.meridian_id||'')} — ${_esc(pub.title)}</div>
          <div style="font-size:12px;color:var(--tm);margin-top:4px">${_esc(pubAuthors)}</div>
        </div></div>`;
      }
    }catch(e){console.warn('Related pub:',e)}
  }

  H('#arch-detail',`
    <button class="bt sm" onclick="_archBackToBrowse()" style="margin-bottom:14px">&larr; Back to datasets</button>
    <div class="sec">
      <div class="sh" style="cursor:default">
        <div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:11px;font-family:var(--mf);color:var(--ac);background:var(--am);padding:2px 8px;border-radius:3px;border:1px solid var(--ab)">${_esc(d.meridian_data_id||'')}</span>
            <span class="bg oa">${_esc(d.data_type)}</span>
            ${d.region?'<span class="bg yr">'+_esc(d.region)+'</span>':''}
            ${d.license?'<span style="font-size:11px;color:var(--sg);font-family:var(--mf)">'+_esc(d.license)+'</span>':''}
          </div>
          <h4 style="font-size:18px;color:var(--tx);text-transform:none;letter-spacing:0;font-weight:700">${_esc(d.title)}</h4>
        </div>
      </div>
      <div class="sb">
        <div style="font-size:13px;color:var(--ts);line-height:1.7;margin-bottom:16px">${_esc(d.description)}</div>
        <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 16px;font-size:12px;font-family:var(--mf)">
          <span style="color:var(--tm)">Authors</span><span style="color:var(--ts)">${authors}</span>
          <span style="color:var(--tm)">Data Type</span><span style="color:var(--ts)">${_esc(d.data_type)}</span>
          <span style="color:var(--tm)">Region</span><span style="color:var(--ts)">${_esc(d.region||'—')}</span>
          <span style="color:var(--tm)">Species</span><span>${speciesHtml}</span>
          <span style="color:var(--tm)">Variables</span><span>${varsHtml}</span>
          <span style="color:var(--tm)">Collection Method</span><span style="color:var(--ts)">${_esc(d.collection_method||'—')}</span>
          <span style="color:var(--tm)">Sample Size</span><span style="color:var(--ts)">${d.sample_size!=null?d.sample_size.toLocaleString():'—'}</span>
          <span style="color:var(--tm)">Time Frame</span><span style="color:var(--ts)">${dateRange}</span>
          <span style="color:var(--tm)">File Format</span><span style="color:var(--ts)">${_esc(d.file_format||'—')}</span>
          <span style="color:var(--tm)">File Size</span><span style="color:var(--ts)">${size}</span>
          <span style="color:var(--tm)">Downloads</span><span style="color:var(--ts)">${d.download_count||0}</span>
          <span style="color:var(--tm)">License</span><span style="color:var(--ts)">${_esc(d.license||'—')}</span>
          <span style="color:var(--tm)">Uploaded</span><span style="color:var(--ts)">${d.created_at?new Date(d.created_at).toLocaleDateString():''}</span>
          ${d.location_lat!=null?'<span style="color:var(--tm)">Location</span><span style="color:var(--ts)">'+d.location_lat.toFixed(4)+', '+d.location_lng.toFixed(4)+'</span>':''}
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          ${d.file_url?'<button class="bt on" onclick="_archDownload(\''+d.id+'\')">Download Dataset</button>':''}
          <button class="bt sm" onclick="_archShowFlagForm('${d.id}')" style="color:var(--co);border-color:rgba(194,120,120,.3)">Flag this dataset</button>
        </div>
      </div>
    </div>
    ${pubCard}
    <div id="arch-preview-section" style="margin-top:16px">${d.file_url&&(d.file_format==='CSV'||d.file_format==='XLSX')?'<div style="text-align:center;padding:20px"><button class="bt sm" onclick="_archLoadPreview(\''+d.id+'\')">Load data preview (first 10 rows)</button></div>':''}</div>
    <div id="arch-flag-form" style="display:none;margin-top:16px"></div>
  `);
}

function _archBackToBrowse(){
  hi('#arch-detail');
  hi('#arch-upload');
  sh('#arch-cards');
}

async function _archLoadPreview(id){
  const d=_archDatasets.find(x=>x.id===id);
  if(!d||!d.file_url)return;
  H('#arch-preview-section','<div style="text-align:center;padding:20px;color:var(--tm);font-size:12px">Loading preview...</div>');
  try{
    const{data}=SB.storage.from('archived-datasets').getPublicUrl(d.file_url);
    if(!data?.publicUrl)throw new Error('No URL');
    const resp=await fetch(data.publicUrl);
    if(!resp.ok)throw new Error('Fetch failed');

    if(d.file_format==='CSV'){
      const text=await resp.text();
      const lines=text.split(/\r?\n/).filter(l=>l.trim());
      if(lines.length<2){H('#arch-preview-section','<div style="color:var(--tm);padding:10px;font-size:12px">No data rows</div>');return}
      const headers=_archParseCSVLine(lines[0]);
      const rows=[];
      for(let i=1;i<Math.min(lines.length,11);i++){
        rows.push(_archParseCSVLine(lines[i]));
      }
      _archRenderPreviewTable(headers,rows);
    }else if(d.file_format==='XLSX'){
      const buf=await resp.arrayBuffer();
      if(typeof XLSX==='undefined'){H('#arch-preview-section','<div style="color:var(--co);padding:10px;font-size:12px">SheetJS not loaded — XLSX preview unavailable</div>');return}
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const json=XLSX.utils.sheet_to_json(ws,{header:1});
      if(json.length<2){H('#arch-preview-section','<div style="color:var(--tm);padding:10px;font-size:12px">No data rows</div>');return}
      _archRenderPreviewTable(json[0],json.slice(1,11));
    }
  }catch(e){
    H('#arch-preview-section','<div style="color:var(--co);padding:10px;font-size:12px">Preview failed: '+e.message+'</div>');
  }
}

function _archRenderPreviewTable(headers,rows){
  let html='<div class="sec"><div class="sh"><h4>Data Preview (first '+rows.length+' rows)</h4></div><div class="sb" style="overflow-x:auto"><table class="dt"><thead><tr>';
  for(const h of headers)html+='<th>'+_esc(h)+'</th>';
  html+='</tr></thead><tbody>';
  for(const row of rows){
    html+='<tr>';
    for(let i=0;i<headers.length;i++){
      html+='<td>'+_esc(row[i]!=null?row[i]:'')+'</td>';
    }
    html+='</tr>';
  }
  html+='</tbody></table></div></div>';
  H('#arch-preview-section',html);
}

function _archParseCSVLine(line){
  const result=[];let current='',inQuotes=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(inQuotes){if(c==='"'&&line[i+1]==='"'){current+='"';i++}else if(c==='"'){inQuotes=false}else{current+=c}}
    else{if(c==='"'){inQuotes=true}else if(c===','){result.push(current.trim());current=''}else{current+=c}}
  }
  result.push(current.trim());
  return result;
}

function _archShowFlagForm(id){
  const el=$('#arch-flag-form');
  if(!el)return;
  if(!_supaUser){toast('Sign in to flag datasets','err');return}
  sh(el);
  H(el,`
    <div class="sec"><div class="sh"><h4>Flag this Dataset</h4></div><div class="sb">
      <div style="display:flex;flex-direction:column;gap:10px">
        <select class="fs" id="arch-flag-reason">
          <option value="">Select a reason...</option>
          <option value="inaccurate">Inaccurate data</option>
          <option value="incomplete">Incomplete / missing data</option>
          <option value="duplicate">Duplicate of another dataset</option>
          <option value="spam">Spam / not a real dataset</option>
          <option value="other">Other</option>
        </select>
        <textarea class="fi" id="arch-flag-desc" placeholder="Additional details (optional)" rows="3" style="resize:vertical;width:100%"></textarea>
        <div style="display:flex;gap:8px">
          <button class="bt on" onclick="_archSubmitFlag('${id}')">Submit Flag</button>
          <button class="bt sm" onclick="hi('#arch-flag-form')">Cancel</button>
        </div>
      </div>
    </div></div>
  `);
}

async function _archSubmitFlag(id){
  const reason=$('#arch-flag-reason')?.value;
  const desc=$('#arch-flag-desc')?.value?.trim();
  if(!reason){toast('Select a reason','err');return}
  try{
    const{error}=await SB.from('dataset_flags').insert({
      dataset_id:id,user_id:_supaUser.id,reason,description:desc||null
    });
    if(error)throw error;
    toast('Dataset flagged — thank you','ok');
    hi('#arch-flag-form');
  }catch(e){
    if(e.message?.includes('dataset_flags')){
      toast('Flag table not yet created — run the migration first','err');
    }else{
      toast('Flag failed: '+e.message,'err');
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// 3. UPLOAD VIEW
// ═══════════════════════════════════════════════════════════════

function _archShowUpload(){
  if(!_supaUser){toast('Sign in to upload datasets','err');return}
  hi('#arch-cards');
  hi('#arch-detail');
  sh('#arch-upload');
  _archUploadFile=null;
  _archUploadHeaders=[];
  _archUploadPreview=[];

  H('#arch-upload',`
    <button class="bt sm" onclick="_archBackToBrowse()" style="margin-bottom:14px">&larr; Back to datasets</button>
    <div class="sec"><div class="sh"><h4>Upload Dataset</h4></div><div class="sb">
      <div style="display:grid;gap:14px">
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Title *</label>
          <input class="si" id="arch-u-title" placeholder="Dataset title" style="font-size:13px"/>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Description *</label>
          <textarea class="fi" id="arch-u-desc" placeholder="Describe the dataset — what it measures, how it was collected, and what it can be used for" rows="4" style="resize:vertical;width:100%;font-size:13px"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Data Type *</label>
            <select class="fs" id="arch-u-type" style="width:100%">
              <option value="">Select...</option>
              <option>Catch Data</option><option>Survey Data</option><option>Environmental Monitoring</option>
              <option>Genetic/Genomic</option><option>Acoustic/Telemetry</option><option>Photo/Video Transect</option>
              <option>Water Quality</option><option>Population Census</option><option>Tagging/Recapture</option>
              <option>Socioeconomic</option><option>Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Region</label>
            <input class="fi" id="arch-u-region" placeholder="e.g. Mediterranean, Caribbean" style="width:100%"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Species (comma-separated)</label>
            <input class="fi" id="arch-u-species" placeholder="e.g. Pagrus auratus, Chrysophrys auratus" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Collection Method</label>
            <input class="fi" id="arch-u-method" placeholder="e.g. Bottom trawl, ROV survey" style="width:100%"/>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Authors (one per line: Name | Affiliation | Email | ORCID)</label>
          <textarea class="fi" id="arch-u-authors" placeholder="Jane Smith | University of Sydney | jane@uni.edu | 0000-0001-2345-6789" rows="3" style="resize:vertical;width:100%;font-size:12px"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Time Frame Start</label>
            <input type="date" class="fi" id="arch-u-start" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Time Frame End</label>
            <input type="date" class="fi" id="arch-u-end" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Sample Size</label>
            <input type="number" class="fi" id="arch-u-sample" placeholder="e.g. 5000" style="width:100%"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Coordinates (lat, lng)</label>
            <input class="fi" id="arch-u-coords" placeholder="e.g. -33.86, 151.21" style="width:100%"/>
          </div>
          <div>
            <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">License</label>
            <select class="fs" id="arch-u-license" style="width:100%">
              <option value="">Select...</option>
              <option>CC-BY</option><option>CC-BY-NC</option><option>CC-BY-SA</option><option>CC0</option><option>Custom</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Link to Publication (optional — enter Meridian ID)</label>
          <input class="fi" id="arch-u-publink" placeholder="e.g. ME-2026-0012" style="width:100%"/>
        </div>
        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Variables Included</label>
          <div id="arch-u-vars-auto" style="margin-bottom:6px"></div>
          <input class="fi" id="arch-u-vars" placeholder="Comma-separated: SST, Length, Weight, Depth, Salinity" style="width:100%"/>
        </div>

        <div>
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Dataset File *</label>
          <div id="arch-u-dropzone" style="border:2px dashed var(--bd);border-radius:var(--rd);padding:24px;text-align:center;cursor:pointer;transition:border-color .2s;background:var(--bs)"
            ondragover="event.preventDefault();this.style.borderColor='var(--ac)'"
            ondragleave="this.style.borderColor='var(--bd)'"
            ondrop="event.preventDefault();this.style.borderColor='var(--bd)';_archHandleUploadFile(event.dataTransfer.files)"
            onclick="$('#arch-u-file').click()">
            <div style="font-size:13px;color:var(--ts);margin-bottom:4px">Drop file here or click to browse</div>
            <div style="font-size:11px;color:var(--tm);font-family:var(--mf)">CSV, XLSX, JSON, NetCDF, ZIP — max 200 MB</div>
            <input type="file" id="arch-u-file" accept=".csv,.xlsx,.xls,.json,.nc,.netcdf,.zip,.rdata,.rds" style="display:none" onchange="_archHandleUploadFile(this.files)"/>
          </div>
          <div id="arch-u-file-info" style="display:none;margin-top:8px;padding:8px 12px;background:var(--be);border-radius:6px;font-size:12px;color:var(--ts);font-family:var(--mf)"></div>
        </div>
        <div id="arch-u-preview" style="display:none"></div>

        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="bt on" onclick="_archSubmitUpload()" id="arch-u-submit">Publish Dataset</button>
          <button class="bt sm" onclick="_archBackToBrowse()">Cancel</button>
        </div>
        <div id="arch-u-status" style="display:none;margin-top:8px;font-size:12px;font-family:var(--mf)"></div>
      </div>
    </div></div>
  `);
}

function _archHandleUploadFile(files){
  if(!files||!files.length)return;
  const file=files[0];
  const maxSize=200*1024*1024;
  if(file.size>maxSize){toast('File too large (max 200 MB)','err');return}

  _archUploadFile=file;
  const ext=file.name.split('.').pop().toLowerCase();
  const formatMap={csv:'CSV',xlsx:'XLSX',xls:'XLSX',json:'JSON',nc:'NetCDF',netcdf:'NetCDF',zip:'ZIP',rdata:'R Data',rds:'R Data'};
  const format=formatMap[ext]||'Other';

  const info=$('#arch-u-file-info');
  if(info){
    sh(info);
    H(info,`<strong>${_esc(file.name)}</strong> — ${_archFormatBytes(file.size)} — ${format}`);
  }

  // Auto-detect headers for CSV/XLSX
  if(format==='CSV'){
    const reader=new FileReader();
    reader.onload=e=>{
      const text=e.target.result;
      const lines=text.split(/\r?\n/).filter(l=>l.trim());
      if(lines.length>=2){
        _archUploadHeaders=_archParseCSVLine(lines[0]);
        _archUploadPreview=[];
        for(let i=1;i<Math.min(lines.length,11);i++){
          _archUploadPreview.push(_archParseCSVLine(lines[i]));
        }
        _archSuggestVariables(_archUploadHeaders);
        _archShowUploadPreview(_archUploadHeaders,_archUploadPreview);
      }
    };
    reader.readAsText(file.slice(0,500000));// Read first 500KB for preview
  }else if(format==='XLSX'&&typeof XLSX!=='undefined'){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const json=XLSX.utils.sheet_to_json(ws,{header:1});
        if(json.length>=2){
          _archUploadHeaders=json[0].map(String);
          _archUploadPreview=json.slice(1,11);
          _archSuggestVariables(_archUploadHeaders);
          _archShowUploadPreview(_archUploadHeaders,_archUploadPreview);
        }
      }catch(ex){console.warn('XLSX parse:',ex)}
    };
    reader.readAsArrayBuffer(file);
  }
}

function _archSuggestVariables(headers){
  // Map common column headers to variable suggestions
  const known={sst:'SST',temperature:'SST',temp:'SST',length:'Length',tl:'Length',sl:'Length',fl:'Length',
    weight:'Weight',wt:'Weight',depth:'Depth',salinity:'Salinity',sal:'Salinity',
    chlorophyll:'Chlorophyll',chl:'Chlorophyll',lat:'Latitude',latitude:'Latitude',
    lon:'Longitude',longitude:'Longitude',lng:'Longitude',date:'Date',time:'Time',
    cpue:'CPUE',catch:'Catch',effort:'Effort',age:'Age',sex:'Sex',
    ph:'pH',do:'DO',dissolved_oxygen:'DO',turbidity:'Turbidity',
    biomass:'Biomass',abundance:'Abundance',density:'Density'};
  const suggestions=[];
  for(const h of headers){
    const lc=h.toLowerCase().replace(/[^a-z]/g,'');
    if(known[lc])suggestions.push(known[lc]);
  }
  const unique=[...new Set(suggestions)];
  if(unique.length){
    const el=$('#arch-u-vars');
    if(el&&!el.value)el.value=unique.join(', ');
    const autoEl=$('#arch-u-vars-auto');
    if(autoEl)H(autoEl,'<div style="font-size:11px;color:var(--sg);font-family:var(--mf)">Auto-detected: '+unique.join(', ')+'</div>');
  }
}

function _archShowUploadPreview(headers,rows){
  const el=$('#arch-u-preview');
  if(!el)return;
  sh(el);
  let html='<div style="margin-top:4px;font-size:11px;color:var(--tm);font-family:var(--mf);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Preview (first '+rows.length+' rows)</div>';
  html+='<div style="overflow-x:auto;max-height:300px;border:1px solid var(--bd);border-radius:6px"><table class="dt"><thead><tr>';
  for(const h of headers)html+='<th>'+_esc(h)+'</th>';
  html+='</tr></thead><tbody>';
  for(const row of rows){
    html+='<tr>';
    for(let i=0;i<headers.length;i++){
      html+='<td>'+_esc(row[i]!=null?row[i]:'')+'</td>';
    }
    html+='</tr>';
  }
  html+='</tbody></table></div>';
  H(el,html);
}

async function _archSubmitUpload(){
  const title=$('#arch-u-title')?.value?.trim();
  const desc=$('#arch-u-desc')?.value?.trim();
  const dataType=$('#arch-u-type')?.value;
  if(!title){toast('Title is required','err');return}
  if(!desc){toast('Description is required','err');return}
  if(!dataType){toast('Data type is required','err');return}
  if(!_archUploadFile){toast('Select a file to upload','err');return}

  const btn=$('#arch-u-submit');
  if(btn){btn.disabled=true;btn.textContent='Uploading...'}
  const status=$('#arch-u-status');
  if(status){sh(status);H(status,'<span style="color:var(--ac)">Uploading file to storage...</span>')}

  try{
    // 1. Upload file to Supabase Storage
    const ext=_archUploadFile.name.split('.').pop().toLowerCase();
    const formatMap={csv:'CSV',xlsx:'XLSX',xls:'XLSX',json:'JSON',nc:'NetCDF',netcdf:'NetCDF',zip:'ZIP',rdata:'R Data',rds:'R Data'};
    const fileFormat=formatMap[ext]||'Other';
    const filePath=`${_supaUser.id}/${Date.now()}-${_archUploadFile.name}`;

    const{error:uploadErr}=await SB.storage.from('archived-datasets').upload(filePath,_archUploadFile,{
      cacheControl:'3600',upsert:false
    });
    if(uploadErr)throw uploadErr;

    if(status)H(status,'<span style="color:var(--ac)">Creating dataset record...</span>');

    // 2. Parse form fields
    const region=$('#arch-u-region')?.value?.trim()||null;
    const speciesRaw=$('#arch-u-species')?.value?.trim();
    const species=speciesRaw?speciesRaw.split(',').map(s=>s.trim()).filter(Boolean):null;
    const method=$('#arch-u-method')?.value?.trim()||null;
    const start=$('#arch-u-start')?.value||null;
    const end=$('#arch-u-end')?.value||null;
    const sample=$('#arch-u-sample')?.value?parseInt($('#arch-u-sample').value):null;
    const coordsRaw=$('#arch-u-coords')?.value?.trim();
    let lat=null,lng=null;
    if(coordsRaw){
      const parts=coordsRaw.split(',').map(s=>parseFloat(s.trim()));
      if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])){lat=parts[0];lng=parts[1]}
    }
    const license=$('#arch-u-license')?.value||null;
    const varsRaw=$('#arch-u-vars')?.value?.trim();
    const variables=varsRaw?varsRaw.split(',').map(v=>v.trim()).filter(Boolean):null;

    // Parse authors
    const authorsRaw=$('#arch-u-authors')?.value?.trim();
    let authors=null;
    if(authorsRaw){
      authors=authorsRaw.split('\n').filter(l=>l.trim()).map(l=>{
        const parts=l.split('|').map(p=>p.trim());
        return{name:parts[0]||'',affiliation:parts[1]||'',email:parts[2]||'',orcid:parts[3]||''};
      });
    }

    // Resolve linked publication
    let linkedPubId=null;
    const pubLink=$('#arch-u-publink')?.value?.trim();
    if(pubLink){
      const{data:pub}=await SB.from('publications').select('id').eq('meridian_id',pubLink).single();
      if(pub)linkedPubId=pub.id;
      else toast('Publication '+pubLink+' not found — uploading without link','warn');
    }

    // 3. Insert record
    const{data:newDataset,error:insertErr}=await SB.from('archived_datasets').insert({
      user_id:_supaUser.id,
      title,
      description:desc,
      authors,
      data_type:dataType,
      file_format:fileFormat,
      file_url:filePath,
      file_size_bytes:_archUploadFile.size,
      region,
      location_lat:lat,
      location_lng:lng,
      species,
      time_frame_start:start,
      time_frame_end:end,
      variables_included:variables,
      collection_method:method,
      sample_size:sample,
      license,
      linked_publication_id:linkedPubId,
      status:'published'
    }).select().single();
    if(insertErr)throw insertErr;

    toast('Dataset published!','ok');
    _archDatasets.unshift(newDataset);
    _archBuildFilterOptions();
    _archBackToBrowse();
    _archRenderCards();

  }catch(e){
    toast('Upload failed: '+e.message,'err');
    if(status)H(status,'<span style="color:var(--co)">Error: '+_esc(e.message)+'</span>');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Publish Dataset'}
  }
}
