// ═══ MERIDIAN PDF — PDF Viewer & Annotation Module ═══
// Renders OA PDFs via PDF.js, annotations stored in Supabase paper_annotations

// ── State ──
let _pdfS={doc:null,numPages:0,scale:1.5,tool:'none',hlColor:'yellow',
  annotations:[],notes:'',paperKey:'',pdfUrl:'',paperTitle:'',paperDoi:'',
  autoTimer:null,dirty:false,penPath:null,hlStart:null,viewports:[]};
const _HL={yellow:'rgba(255,255,0,0.35)',green:'rgba(0,200,0,0.3)',blue:'rgba(70,130,255,0.3)',pink:'rgba(255,105,180,0.3)',red:'rgba(255,50,50,0.3)'};
let _annotCache={};
let _annotCacheLoaded=false;

function _pdfPaperKey(p){
  if(p.doi)return p.doi.replace(/^https?:\/\/doi\.org\//i,'');
  return p.id;
}

// ── Open Viewer ──
async function openPdfViewer(paper){
  const url=paper.pdfUrl||paper.oaUrl;
  if(!url){toast('No open-access PDF URL available','info');return}
  _pdfS.paperKey=_pdfPaperKey(paper);
  _pdfS.pdfUrl=url;
  _pdfS.paperTitle=paper.title||'';
  _pdfS.paperDoi=paper.doi||'';
  _pdfS.tool='none';_pdfS.annotations=[];_pdfS.notes='';
  _pdfS.dirty=false;_pdfS.scale=1.5;_pdfS.viewports=[];
  _pdfBuildModal();
  await _pdfLoadAnnotations();
  const na=document.getElementById('pdfNotesArea');
  if(na)na.value=_pdfS.notes;
  try{
    _pdfSetStatus('Loading PDF…');
    if(typeof pdfjsLib==='undefined')throw new Error('PDF.js not loaded');
    const task=pdfjsLib.getDocument({url,
      cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked:true,withCredentials:false});
    _pdfS.doc=await task.promise;
    _pdfS.numPages=_pdfS.doc.numPages;
    _pdfSetStatus('');
    _pdfUpdatePageInfo();
    await _pdfRenderAll();
    _pdfStartAutoSave();
  }catch(err){
    console.warn('PDF load error:',err);
    _pdfShowFallback(paper);
  }
}

// ── Close Viewer ──
async function closePdfViewer(){
  _pdfStopAutoSave();
  // Capture notes
  const na=document.getElementById('pdfNotesArea');
  if(na)_pdfS.notes=na.value;
  if(_pdfS.dirty)await savePdfAnnotations();
  const modal=document.getElementById('pdf-viewer-modal');
  if(modal){
    modal.style.display='none';
    modal.innerHTML='';
    if(modal._escH){document.removeEventListener('keydown',modal._escH);modal._escH=null}
  }
  document.body.style.overflow='';
  _pdfS.doc=null;_pdfS.viewports=[];
  // Refresh annotation cache & library cards
  await _loadAnnotCache();
  if(typeof renderLib==='function')renderLib();
}

// ── Build Modal ──
function _pdfBuildModal(){
  let m=document.getElementById('pdf-viewer-modal');
  if(!m){m=document.createElement('div');m.id='pdf-viewer-modal';m.className='pdf-modal';document.body.appendChild(m)}
  const t=escHTML((_pdfS.paperTitle||'').slice(0,70));
  const colorBtns=Object.keys(_HL).map(c=>{
    const solid=c==='yellow'?'#ffe066':c==='green'?'#66dd88':c==='blue'?'#6688ff':c==='pink'?'#ff88bb':'#ff6666';
    return`<button class="pdf-cdot${c==='yellow'?' active':''}" style="background:${solid}" onclick="setPdfColor('${c}')" data-color="${c}" title="${c}"></button>`;
  }).join('');
  m.innerHTML=`<div class="pdf-tb">
<div class="pdf-tb-l"><button class="pdf-btn" onclick="closePdfViewer()" title="Close viewer">✕ Close</button><span class="pdf-tb-title">${t}</span></div>
<div class="pdf-tb-c">
<div class="pdf-tg"><button class="pdf-btn pdf-tool" data-tool="highlight" onclick="setPdfTool('highlight')" title="Highlight region">Highlight</button><div class="pdf-cp">${colorBtns}</div></div>
<button class="pdf-btn pdf-tool" data-tool="sticky" onclick="setPdfTool('sticky')" title="Place sticky note">Sticky Note</button>
<button class="pdf-btn pdf-tool" data-tool="pen" onclick="setPdfTool('pen')" title="Freehand drawing">Pen</button>
<button class="pdf-btn pdf-tool" data-tool="eraser" onclick="setPdfTool('eraser')" title="Remove annotation">Eraser</button>
<span class="pdf-sep"></span>
<button class="pdf-btn" onclick="clearAllPdfAnnotations()" title="Remove all annotations">Clear All</button>
<button class="pdf-btn pdf-save" onclick="savePdfAnnotations()" title="Save to account">Save</button>
</div>
<div class="pdf-tb-r">
<button class="pdf-btn" onclick="_pdfZoom(-0.25)">−</button>
<span id="pdfZoomLbl">${Math.round(_pdfS.scale*100)}%</span>
<button class="pdf-btn" onclick="_pdfZoom(0.25)">+</button>
<span class="pdf-sep"></span>
<span id="pdfPageInfo" style="font-size:11px;color:var(--tm)">Loading…</span>
<span class="pdf-sep"></span>
<button class="pdf-btn" onclick="_pdfToggleNotes()">Notes ▶</button>
</div>
</div>
<div class="pdf-body">
<div class="pdf-pages" id="pdfPagesWrap"><div class="pdf-status" id="pdfStatus"></div></div>
<div class="pdf-notes" id="pdfNotesPanel">
<div class="pdf-notes-hdr"><h4 style="margin:0;font-size:13px;color:var(--ts);font-family:var(--sf)">Notes</h4><button class="pdf-btn" onclick="_pdfToggleNotes()">✕</button></div>
<textarea id="pdfNotesArea" class="pdf-notes-ta" placeholder="Type your notes about this paper here…" oninput="_pdfS.dirty=true"></textarea>
</div>
</div>`;
  m.style.display='flex';
  document.body.style.overflow='hidden';
  m._escH=e=>{if(e.key==='Escape')closePdfViewer()};
  document.addEventListener('keydown',m._escH);
}

// ── Render All Pages ──
async function _pdfRenderAll(){
  const wrap=document.getElementById('pdfPagesWrap');
  if(!wrap||!_pdfS.doc)return;
  wrap.innerHTML='';
  _pdfS.viewports=[];
  for(let i=1;i<=_pdfS.numPages;i++){
    const page=await _pdfS.doc.getPage(i);
    const vp=page.getViewport({scale:_pdfS.scale});
    _pdfS.viewports[i]=vp;
    const dpr=window.devicePixelRatio||1;
    // Container
    const div=document.createElement('div');
    div.className='pdf-pw';div.dataset.page=i;
    // Page label
    const lbl=document.createElement('div');
    lbl.className='pdf-plbl';lbl.textContent='Page '+i;
    div.appendChild(lbl);
    // PDF canvas
    const cv=document.createElement('canvas');
    cv.className='pdf-cv';
    cv.width=Math.floor(vp.width*dpr);cv.height=Math.floor(vp.height*dpr);
    cv.style.width=vp.width+'px';cv.style.height=vp.height+'px';
    div.appendChild(cv);
    const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    // Overlay canvas
    const ov=document.createElement('canvas');
    ov.className='pdf-ov';
    ov.width=cv.width;ov.height=cv.height;
    ov.style.width=vp.width+'px';ov.style.height=vp.height+'px';
    div.appendChild(ov);
    // Mouse events on overlay
    ov.addEventListener('mousedown',e=>_pdfMD(e,i,ov));
    ov.addEventListener('mousemove',e=>_pdfMM(e,i,ov));
    ov.addEventListener('mouseup',e=>_pdfMU(e,i,ov));
    // Touch events
    ov.addEventListener('touchstart',e=>{e.preventDefault();const t=e.touches[0];_pdfMD(_touchToMouse(t,ov),i,ov)},{passive:false});
    ov.addEventListener('touchmove',e=>{e.preventDefault();const t=e.touches[0];_pdfMM(_touchToMouse(t,ov),i,ov)},{passive:false});
    ov.addEventListener('touchend',e=>{_pdfMU({},i,ov)},{passive:false});
    wrap.appendChild(div);
    _pdfDrawAnnotations(i,ov);
  }
}

function _touchToMouse(touch,ov){
  const r=ov.getBoundingClientRect();
  return{clientX:touch.clientX,clientY:touch.clientY,
    offsetX:touch.clientX-r.left,offsetY:touch.clientY-r.top};
}

// ── Draw Annotations ──
function _pdfDrawAnnotations(pageNum,ov){
  if(!ov){const pw=document.querySelector(`.pdf-pw[data-page="${pageNum}"]`);if(pw)ov=pw.querySelector('.pdf-ov')}
  if(!ov)return;
  const dpr=window.devicePixelRatio||1;
  const ctx=ov.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ov.width,ov.height);ctx.scale(dpr,dpr);
  const w=parseFloat(ov.style.width);const h=parseFloat(ov.style.height);
  const annots=_pdfS.annotations.filter(a=>a.page===pageNum);
  // Remove old sticky icons
  const pw=ov.parentElement;
  pw.querySelectorAll('.pdf-si').forEach(el=>el.remove());
  annots.forEach(a=>{
    if(a.type==='highlight'){
      ctx.fillStyle=_HL[a.color]||_HL.yellow;
      ctx.fillRect(a.x*w,a.y*h,a.w*w,a.h*h);
    }else if(a.type==='drawing'&&a.points&&a.points.length>1){
      ctx.strokeStyle=a.color||'#ff0000';ctx.lineWidth=a.width||2;
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(a.points[0].x*w,a.points[0].y*h);
      for(let k=1;k<a.points.length;k++)ctx.lineTo(a.points[k].x*w,a.points[k].y*h);
      ctx.stroke();
    }else if(a.type==='sticky'){
      // Draw sticky icon as a DOM element for clickability
      const si=document.createElement('div');si.className='pdf-si';
      si.style.left=(a.x*w)+'px';si.style.top=(a.y*h)+'px';
      si.textContent='📝';si.title=a.content||'(empty note)';
      si.onclick=e=>{e.stopPropagation();_pdfShowStickyPopup(pageNum,a.x,a.y,a)};
      pw.appendChild(si);
    }
  });
}

// ── Mouse Handlers ──
function _pdfGetNorm(e,ov){
  const r=ov.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
}

function _pdfMD(e,pg,ov){
  const n=_pdfGetNorm(e,ov);
  if(_pdfS.tool==='highlight'){
    _pdfS.hlStart={page:pg,x:n.x,y:n.y};
  }else if(_pdfS.tool==='pen'){
    _pdfS.penPath={page:pg,points:[{x:n.x,y:n.y}],color:'#e03030',width:2};
  }else if(_pdfS.tool==='sticky'){
    _pdfShowStickyPopup(pg,n.x,n.y,null);
  }else if(_pdfS.tool==='eraser'){
    _pdfErase(pg,n.x,n.y,ov);
  }
}

function _pdfMM(e,pg,ov){
  const n=_pdfGetNorm(e,ov);
  if(_pdfS.tool==='highlight'&&_pdfS.hlStart&&_pdfS.hlStart.page===pg){
    // Live preview
    const s=_pdfS.hlStart;
    _pdfDrawAnnotations(pg,ov);
    const dpr=window.devicePixelRatio||1;
    const ctx=ov.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.scale(dpr,dpr);
    const w=parseFloat(ov.style.width);const h=parseFloat(ov.style.height);
    ctx.fillStyle=_HL[_pdfS.hlColor]||_HL.yellow;
    const rx=Math.min(s.x,n.x)*w,ry=Math.min(s.y,n.y)*h;
    const rw=Math.abs(n.x-s.x)*w,rh=Math.abs(n.y-s.y)*h;
    ctx.fillRect(rx,ry,rw,rh);
  }else if(_pdfS.tool==='pen'&&_pdfS.penPath&&_pdfS.penPath.page===pg){
    _pdfS.penPath.points.push({x:n.x,y:n.y});
    // Live draw
    const dpr=window.devicePixelRatio||1;
    const ctx=ov.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.scale(dpr,dpr);
    const w=parseFloat(ov.style.width);const h=parseFloat(ov.style.height);
    const pts=_pdfS.penPath.points;
    if(pts.length>=2){
      ctx.strokeStyle=_pdfS.penPath.color;ctx.lineWidth=_pdfS.penPath.width;
      ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
      const p1=pts[pts.length-2],p2=pts[pts.length-1];
      ctx.moveTo(p1.x*w,p1.y*h);ctx.lineTo(p2.x*w,p2.y*h);ctx.stroke();
    }
  }
}

function _pdfMU(e,pg,ov){
  if(_pdfS.tool==='highlight'&&_pdfS.hlStart&&_pdfS.hlStart.page===pg){
    const s=_pdfS.hlStart;
    const n=e.clientX?_pdfGetNorm(e,ov):{x:s.x,y:s.y};
    const x=Math.min(s.x,n.x),y=Math.min(s.y,n.y);
    const w=Math.abs(n.x-s.x),h=Math.abs(n.y-s.y);
    if(w>0.005&&h>0.003){// Minimum size threshold
      _pdfS.annotations.push({type:'highlight',page:pg,x,y,w,h,color:_pdfS.hlColor,ts:new Date().toISOString()});
      _pdfS.dirty=true;
    }
    _pdfS.hlStart=null;
    _pdfDrawAnnotations(pg,ov);
  }else if(_pdfS.tool==='pen'&&_pdfS.penPath&&_pdfS.penPath.page===pg){
    if(_pdfS.penPath.points.length>2){
      _pdfS.annotations.push({type:'drawing',page:pg,points:_pdfS.penPath.points,
        color:_pdfS.penPath.color,width:_pdfS.penPath.width,ts:new Date().toISOString()});
      _pdfS.dirty=true;
    }
    _pdfS.penPath=null;
    _pdfDrawAnnotations(pg,ov);
  }
}

// ── Eraser ──
function _pdfErase(pg,nx,ny,ov){
  const thresh=0.03;
  let idx=-1;
  for(let i=_pdfS.annotations.length-1;i>=0;i--){
    const a=_pdfS.annotations[i];
    if(a.page!==pg)continue;
    if(a.type==='highlight'){
      if(nx>=a.x&&nx<=a.x+a.w&&ny>=a.y&&ny<=a.y+a.h){idx=i;break}
    }else if(a.type==='sticky'){
      if(Math.abs(nx-a.x)<thresh&&Math.abs(ny-a.y)<thresh){idx=i;break}
    }else if(a.type==='drawing'&&a.points){
      for(const pt of a.points){
        if(Math.abs(nx-pt.x)<thresh&&Math.abs(ny-pt.y)<thresh){idx=i;break}
      }
      if(idx>=0)break;
    }
  }
  if(idx>=0){
    _pdfS.annotations.splice(idx,1);
    _pdfS.dirty=true;
    _pdfDrawAnnotations(pg,ov);
    toast('Annotation removed','ok');
  }
}

// ── Tool & Color ──
function setPdfTool(t){
  _pdfS.tool=_pdfS.tool===t?'none':t;
  document.querySelectorAll('.pdf-tool').forEach(b=>{
    b.classList.toggle('active',b.dataset.tool===_pdfS.tool);
  });
  // Update overlay cursors
  const cur=_pdfS.tool==='highlight'?'crosshair':_pdfS.tool==='pen'?'crosshair':
    _pdfS.tool==='sticky'?'cell':_pdfS.tool==='eraser'?'pointer':'default';
  document.querySelectorAll('.pdf-ov').forEach(c=>{c.style.cursor=cur});
}

function setPdfColor(c){
  _pdfS.hlColor=c;
  document.querySelectorAll('.pdf-cdot').forEach(b=>{
    b.classList.toggle('active',b.dataset.color===c);
  });
}

// ── Sticky Note Popup ──
function _pdfShowStickyPopup(pg,nx,ny,existing){
  // Remove any existing popup
  document.querySelectorAll('.pdf-sp').forEach(el=>el.remove());
  const pw=document.querySelector(`.pdf-pw[data-page="${pg}"]`);
  if(!pw)return;
  const w=parseFloat(pw.querySelector('.pdf-ov').style.width);
  const h=parseFloat(pw.querySelector('.pdf-ov').style.height);
  const pop=document.createElement('div');pop.className='pdf-sp';
  pop.style.left=Math.min(nx*w,w-220)+'px';
  pop.style.top=(ny*h+24)+'px';
  pop.innerHTML=`<textarea class="pdf-sp-ta" placeholder="Type your note…">${escHTML(existing?.content||'')}</textarea>
<div style="display:flex;gap:4px;margin-top:6px"><button class="pdf-btn pdf-sp-ok">Save Note</button><button class="pdf-btn pdf-sp-del">Delete</button><button class="pdf-btn" onclick="this.closest('.pdf-sp').remove()">Cancel</button></div>`;
  pw.appendChild(pop);
  const ta=pop.querySelector('textarea');ta.focus();
  pop.querySelector('.pdf-sp-ok').onclick=()=>{
    const txt=ta.value.trim();
    if(existing){
      existing.content=txt;
    }else if(txt){
      _pdfS.annotations.push({type:'sticky',page:pg,x:nx,y:ny,content:txt,ts:new Date().toISOString()});
    }
    _pdfS.dirty=true;
    pop.remove();
    _pdfDrawAnnotations(pg);
  };
  pop.querySelector('.pdf-sp-del').onclick=()=>{
    if(existing){
      const idx=_pdfS.annotations.indexOf(existing);
      if(idx>=0)_pdfS.annotations.splice(idx,1);
      _pdfS.dirty=true;
    }
    pop.remove();
    _pdfDrawAnnotations(pg);
  };
  pop.onclick=e=>e.stopPropagation();
}

// ── Save Annotations to Supabase ──
async function savePdfAnnotations(){
  if(!window.SB){toast('Supabase not available','err');return}
  const user=typeof _getAuthUser==='function'?await _getAuthUser():null;
  if(!user){toast('Sign in to save annotations','info');return}
  const na=document.getElementById('pdfNotesArea');
  if(na)_pdfS.notes=na.value;
  try{
    const{error}=await SB.from('paper_annotations').upsert({
      user_id:user.id,
      paper_doi:_pdfS.paperKey,
      paper_title:_pdfS.paperTitle,
      paper_pdf_url:_pdfS.pdfUrl,
      annotations:_pdfS.annotations,
      notes:_pdfS.notes,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id,paper_doi'});
    if(error)throw error;
    _pdfS.dirty=false;
    toast('Annotations saved','ok');
  }catch(e){
    console.error('Save annotations error:',e);
    toast('Failed to save annotations','err');
  }
}

// ── Load Annotations from Supabase ──
async function _pdfLoadAnnotations(){
  if(!window.SB)return;
  const user=typeof _getAuthUser==='function'?await _getAuthUser():null;
  if(!user)return;
  try{
    const{data}=await SB.from('paper_annotations')
      .select('annotations,notes')
      .eq('user_id',user.id)
      .eq('paper_doi',_pdfS.paperKey)
      .maybeSingle();
    if(data){
      _pdfS.annotations=data.annotations||[];
      _pdfS.notes=data.notes||'';
    }
  }catch(e){console.warn('Load annotations:',e)}
}

// ── Auto-save ──
function _pdfStartAutoSave(){
  _pdfStopAutoSave();
  _pdfS.autoTimer=setInterval(()=>{
    if(_pdfS.dirty)savePdfAnnotations();
  },30000);
}
function _pdfStopAutoSave(){
  if(_pdfS.autoTimer){clearInterval(_pdfS.autoTimer);_pdfS.autoTimer=null}
}

// ── Zoom ──
async function _pdfZoom(d){
  const ns=Math.max(0.5,Math.min(3,_pdfS.scale+d));
  if(ns===_pdfS.scale)return;
  // Remember scroll fraction
  const wrap=document.getElementById('pdfPagesWrap');
  const scrollFrac=wrap?(wrap.scrollTop/Math.max(1,wrap.scrollHeight)):0;
  _pdfS.scale=ns;
  const lbl=document.getElementById('pdfZoomLbl');
  if(lbl)lbl.textContent=Math.round(ns*100)+'%';
  await _pdfRenderAll();
  // Restore scroll
  if(wrap)wrap.scrollTop=scrollFrac*wrap.scrollHeight;
}

// ── Toggle Notes Panel ──
function _pdfToggleNotes(){
  const p=document.getElementById('pdfNotesPanel');
  if(p)p.classList.toggle('pdf-notes-hidden');
}

// ── Clear All ──
function clearAllPdfAnnotations(){
  if(!_pdfS.annotations.length){toast('No annotations to clear','info');return}
  if(!confirm('Remove all annotations from this paper?'))return;
  _pdfS.annotations=[];_pdfS.dirty=true;
  // Redraw all pages
  for(let i=1;i<=_pdfS.numPages;i++)_pdfDrawAnnotations(i);
  toast('All annotations cleared','ok');
}

// ── Page Info ──
function _pdfUpdatePageInfo(){
  const el=document.getElementById('pdfPageInfo');
  if(el)el.textContent=_pdfS.numPages+' page'+(_pdfS.numPages===1?'':'s');
}

// ── Status ──
function _pdfSetStatus(msg){
  const el=document.getElementById('pdfStatus');
  if(el){el.textContent=msg;el.style.display=msg?'block':'none'}
}

// ── Fallback View ──
function _pdfShowFallback(paper){
  const wrap=document.getElementById('pdfPagesWrap');
  if(!wrap)return;
  const url=_pdfS.pdfUrl;
  const annots=_pdfS.annotations;
  const notes=_pdfS.notes;
  let annotList='';
  if(annots.length){
    annotList='<ul class="pdf-fb-list">'+annots.map(a=>{
      if(a.type==='highlight')return`<li>Page ${a.page}: <span style="background:${_HL[a.color]||_HL.yellow};padding:1px 4px;border-radius:2px">Highlighted region</span></li>`;
      if(a.type==='sticky')return`<li>Page ${a.page}: Sticky note — "${escHTML((a.content||'').slice(0,100))}"</li>`;
      if(a.type==='drawing')return`<li>Page ${a.page}: Freehand drawing</li>`;
      return'';
    }).join('')+'</ul>';
  }
  wrap.innerHTML=`<div class="pdf-fb">
<h3 style="color:var(--wa);margin-bottom:8px">⚠ The open-access PDF is no longer available at the original URL</h3>
<p style="font-size:13px;color:var(--tm);margin-bottom:12px">The publisher's server may be blocking cross-origin requests, or the PDF may have moved.</p>
<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
<a class="bt sm on" href="${escHTML(safeUrl(url))}" target="_blank" rel="noopener" style="text-decoration:none">Open PDF in New Tab ↗</a>
${_pdfS.paperDoi?`<a class="bt sm" href="${escHTML(safeUrl(_pdfS.paperDoi))}" target="_blank" rel="noopener" style="text-decoration:none">Open DOI Page ↗</a>`:''}
</div>
${notes?`<div style="margin-bottom:16px"><h4 style="font-size:13px;color:var(--ts);margin-bottom:6px">Your Notes</h4><div style="font-size:13px;color:var(--tx);white-space:pre-wrap;background:var(--bi);padding:12px;border-radius:6px;border:1px solid var(--bd)">${escHTML(notes)}</div></div>`:''}
${annotList?`<div><h4 style="font-size:13px;color:var(--ts);margin-bottom:6px">Your Annotations</h4>${annotList}</div>`:'<p style="font-size:13px;color:var(--tm)">No saved annotations for this paper.</p>'}
</div>`;
}

// ══════════════════════════════════════════════
// ═══ LIBRARY CARD ENHANCEMENT ═══
// ══════════════════════════════════════════════

// Called after renderLib to add PDF buttons and indicators to library cards
function _enhanceLibCards(){
  if(!_annotCacheLoaded&&window.SB){
    _loadAnnotCache().then(()=>_doEnhance());
  }else{
    _doEnhance();
  }
}

function _doEnhance(){
  document.querySelectorAll('.lib-card').forEach(card=>{
    if(card.dataset.pdfEnhanced)return;
    card.dataset.pdfEnhanced='1';
    const pid=card.dataset.paperId;
    const paper=S.lib.find(p=>p.id===pid);
    if(!paper)return;
    const pdfUrl=paper.pdfUrl||paper.oaUrl;
    const key=_pdfPaperKey(paper);
    const cached=_annotCache[key];
    // Indicators after title
    const titleEl=card.querySelector('.lib-card-title');
    if(titleEl){
      let icons='';
      if(pdfUrl)icons+='<span style="color:var(--sg);font-size:11px;margin-left:6px" title="Open-access PDF available">📄</span>';
      if(cached&&cached.hasAnnotations)icons+='<span style="color:var(--lv);font-size:11px;margin-left:2px" title="Has annotations">✏️</span>';
      if(cached&&cached.hasNotes)icons+='<span style="color:var(--wa);font-size:11px;margin-left:2px" title="Has notes">📝</span>';
      if(icons){
        const sp=document.createElement('span');sp.className='lib-pdf-ind';
        sp.innerHTML=icons;titleEl.appendChild(sp);
      }
      // Notes preview on hover
      if(cached&&cached.notesPreview){
        card.title=cached.notesPreview;
      }
    }
    // PDF button in actions
    const actions=card.querySelector('.lib-card-actions');
    if(actions){
      if(pdfUrl){
        const btn=document.createElement('button');
        btn.className='bt sm';
        btn.style.cssText='font-size:10px;color:var(--sg);border-color:var(--sb)';
        btn.textContent=cached?.hasAnnotations?'📄 Continue Reading':'📄 Read & Annotate';
        btn.title=cached?.notesPreview||'Open PDF viewer with annotation tools';
        btn.onclick=ev=>{ev.stopPropagation();openPdfViewer(paper)};
        actions.appendChild(btn);
      }else{
        const sp=document.createElement('span');
        sp.style.cssText='font-size:10px;color:var(--tm);font-family:var(--mf)';
        if(paper.doi){
          sp.innerHTML=`<a href="${escHTML(safeUrl(paper.doi))}" target="_blank" rel="noopener" style="color:var(--tm);text-decoration:underline" onclick="event.stopPropagation()">No OA PDF · DOI ↗</a>`;
        }else{
          sp.textContent='No OA PDF';
        }
        actions.appendChild(sp);
      }
    }
  });
}

// ── Annotation Cache ──
async function _loadAnnotCache(){
  if(!window.SB)return;
  const user=typeof _getAuthUser==='function'?await _getAuthUser():null;
  if(!user){_annotCacheLoaded=true;return}
  try{
    const{data}=await SB.from('paper_annotations')
      .select('paper_doi,annotations,notes');
    _annotCache={};
    (data||[]).forEach(r=>{
      const a=r.annotations||[];
      _annotCache[r.paper_doi]={
        hasAnnotations:a.length>0,
        hasNotes:!!(r.notes&&r.notes.trim()),
        notesPreview:(r.notes||'').split('\n')[0].slice(0,100)
      };
    });
    _annotCacheLoaded=true;
  }catch(e){
    console.warn('Annotation cache load:',e);
    _annotCacheLoaded=true;
  }
}
