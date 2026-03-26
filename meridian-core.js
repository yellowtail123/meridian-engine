// ═══ MERIDIAN CORE — Foundation Module ═══
// Error pipeline, state management, utilities, DOM helpers

const _DEBUG = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
window._DEBUG = _DEBUG;
if (!_DEBUG) {
  const _noop = () => {};
  console.info = _noop;
  console.log = _noop;
  // Keep console.warn and console.error visible in production
}

// ═══ API KEY SCRUBBER — strip keys from any string before logging/reporting ═══
function _scrubApiKeys(s){
  if(typeof s!=='string')return s;
  return s.replace(/sk-ant-[a-zA-Z0-9_-]+/g,'[REDACTED_API_KEY]')
          .replace(/sk-[a-zA-Z0-9_-]{20,}/g,'[REDACTED_API_KEY]')
          .replace(/AIza[a-zA-Z0-9_-]{30,}/g,'[REDACTED_API_KEY]')
          .replace(/gsk_[a-zA-Z0-9_-]+/g,'[REDACTED_API_KEY]')
          .replace(/dsk_[a-zA-Z0-9_-]+/g,'[REDACTED_API_KEY]')
          .replace(/key-[a-zA-Z0-9_-]{20,}/g,'[REDACTED_API_KEY]');
}
function _deepScrubKeys(obj){
  if(!obj||typeof obj!=='object')return typeof obj==='string'?_scrubApiKeys(obj):obj;
  if(Array.isArray(obj))return obj.map(_deepScrubKeys);
  const out={};for(const[k,v]of Object.entries(obj))out[k]=typeof v==='string'?_scrubApiKeys(v):(v&&typeof v==='object')?_deepScrubKeys(v):v;
  return out;
}

// ═══ MERIDIAN ERROR PIPELINE ═══
const _errPipeline=(function(){
  const MAX_CRUMBS=30,MAX_ERRORS=100,DEDUP_MS=5000,REPORT_INTERVAL=60000,REPORT_MAX_PER_MIN=10;
  const _crumbs=[],_errors=[];
  let _errDB=null,_lastReportT=0,_reportCount=0,_reportTimer=null,_endpointDisabled=false;
  const _ERROR_ENDPOINT='/api/errors';

  // ── Browser/OS detection ──
  function _env(){
    const ua=navigator.userAgent;
    let browser='Unknown',os='Unknown';
    if(/Firefox\//.test(ua))browser='Firefox '+ua.match(/Firefox\/([\d.]+)/)?.[1];
    else if(/Edg\//.test(ua))browser='Edge '+ua.match(/Edg\/([\d.]+)/)?.[1];
    else if(/Chrome\//.test(ua))browser='Chrome '+ua.match(/Chrome\/([\d.]+)/)?.[1];
    else if(/Safari\//.test(ua)&&!/Chrome/.test(ua))browser='Safari '+ua.match(/Version\/([\d.]+)/)?.[1];
    if(/Mac OS X/.test(ua))os='macOS '+ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g,'.');
    else if(/Windows/.test(ua))os='Windows';
    else if(/Linux/.test(ua))os='Linux';
    else if(/Android/.test(ua))os='Android';
    else if(/iPhone|iPad/.test(ua))os='iOS';
    return{browser,os,screen:screen.width+'x'+screen.height,lang:navigator.language};
  }

  // ── Breadcrumbs ──
  function crumb(type,msg,data){
    _crumbs.push({t:Date.now(),type,msg:_scrubApiKeys(msg),data:data?_deepScrubKeys(data):null});
    if(_crumbs.length>MAX_CRUMBS)_crumbs.shift();
  }

  // ── Structured error capture ──
  let _lastErrKey='',_lastErrT=0;
  function capture(msg,source,stack,extra){
    const key=msg+':'+(source||'');const now=Date.now();
    // Dedup: same error within 5s → increment count
    if(key===_lastErrKey&&now-_lastErrT<DEDUP_MS){
      const last=_errors[_errors.length-1];if(last)last.count=(last.count||1)+1;
      return;
    }
    _lastErrKey=key;_lastErrT=now;
    const activeTab=document.querySelector('.sb-item.active')?.dataset?.tab||'unknown';
    const err={
      id:'e_'+now+'_'+Math.random().toString(36).slice(2,6),
      ts:new Date(now).toISOString(),
      msg:_scrubApiKeys(String(msg).slice(0,500)),
      source:source?_scrubApiKeys(String(source)):null,
      stack:stack?_scrubApiKeys(String(stack).slice(0,2000)):null,
      tab:activeTab,
      env:_env(),
      crumbs:_crumbs.slice(-15),// last 15 breadcrumbs for context
      count:1,
      diagnosed:null,
      ...(extra||{})
    };
    _errors.push(err);
    if(_errors.length>MAX_ERRORS)_errors.shift();
    _persistError(err);
    _scheduleReport();
  }

  // ── Persist to IndexedDB ──
  // Schema: MeridianErrors v1 — stores: 'errors' (keyPath: 'id')
  // FROZEN: Do not change without adding migration in onupgradeneeded
  function _openErrDB(){
    return new Promise((res,rej)=>{
      const r=indexedDB.open('MeridianErrors',1);
      r.onupgradeneeded=e=>{e.target.result.createObjectStore('errors',{keyPath:'id'})};
      r.onsuccess=e=>{_errDB=e.target.result;res(_errDB)};
      r.onerror=e=>rej(e);
    });
  }
  async function _persistError(err){
    try{
      if(!_errDB)await _openErrDB();
      const tx=_errDB.transaction('errors','readwrite');
      tx.objectStore('errors').put(err);
      // Rotate: keep only MAX_ERRORS
      const all=tx.objectStore('errors');
      const countReq=all.count();
      countReq.onsuccess=()=>{
        if(countReq.result>MAX_ERRORS){
          const cur=all.openCursor();let toDel=countReq.result-MAX_ERRORS;
          cur.onsuccess=e=>{const c=e.target.result;if(c&&toDel>0){c.delete();toDel--;c.continue()}}
        }
      };
    }catch(e){console.warn('Error DB write failed:',e)}
  }
  async function _loadErrors(){
    try{
      if(!_errDB)await _openErrDB();
      return new Promise((res,rej)=>{
        const tx=_errDB.transaction('errors','readonly');
        const req=tx.objectStore('errors').getAll();
        req.onsuccess=()=>res(req.result||[]);
        req.onerror=()=>res([]);
      });
    }catch{return[]}
  }
  async function _clearErrors(){
    try{
      if(!_errDB)await _openErrDB();
      const tx=_errDB.transaction('errors','readwrite');
      tx.objectStore('errors').clear();
      _errors.length=0;
    }catch(e){console.warn('Clear errors failed:',e)}
  }

  // ── Fetch interception ──
  const _origFetch=window.fetch;
  function _stripKeys(url){
    return _scrubApiKeys(String(url).replace(/([?&])(key|api_key|x-api-key|apikey|token)=[^&]*/gi,'$1$2=[REDACTED]'));
  }
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:input?.url||'';
    const safeUrl=_stripKeys(url);
    const method=(init?.method||'GET').toUpperCase();
    crumb('fetch',method+' '+safeUrl.slice(0,120));
    return _origFetch.apply(this,arguments).then(r=>{
      if(!r.ok&&r.status>=500)crumb('fetch-err',r.status+' '+safeUrl.slice(0,120));
      return r;
    }).catch(e=>{
      if(e.name!=='AbortError'){
        crumb('fetch-err','FAIL '+safeUrl.slice(0,80)+' — '+e.message);
        // Only capture as error for non-abort network failures
        if(e.message&&!e.message.includes('abort'))capture('Fetch failed: '+e.message,safeUrl.slice(0,200),e.stack,{type:'network'});
      }
      throw e;
    });
  };

  // ── Global error handlers ──
  window.onerror=function(msg,src,line,col,err){
    console.error('Meridian error:',_scrubApiKeys(String(msg)));
    capture(msg,src+':'+line+':'+col,err?.stack,{type:'runtime'});
    return false;
  };
  window.addEventListener('unhandledrejection',e=>{
    console.error('Unhandled promise:',_scrubApiKeys(e.reason?.message||String(e.reason)));
    const reason=e.reason;
    const msg=reason?.message||String(reason).slice(0,300);
    const stack=reason?.stack||null;
    // Skip AbortError — these are intentional cancellations
    if(msg.includes('AbortError')||msg.includes('abort')){e.preventDefault();return}
    capture('Unhandled promise: '+msg,null,stack,{type:'promise'});
    e.preventDefault();
  });

  // ── Remote reporting ──
  function _scheduleReport(){
    if(!_ERROR_ENDPOINT||_reportTimer)return;
    _reportTimer=setTimeout(()=>{_reportTimer=null;_sendReport()},REPORT_INTERVAL);
  }
  function _sendReport(){
    if(!_ERROR_ENDPOINT||_endpointDisabled||window._DEBUG)return;
    const now=Date.now();
    if(now-_lastReportT<60000)_reportCount++;else _reportCount=1;
    _lastReportT=now;
    if(_reportCount>REPORT_MAX_PER_MIN)return;
    const unsent=_errors.filter(e=>!e._sent);
    if(!unsent.length)return;
    const batch=unsent.slice(0,20);
    try{
      const body=JSON.stringify({errors:batch.map(e=>_deepScrubKeys(e)),ts:new Date().toISOString()});
      _origFetch(_ERROR_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true})
        .then(r=>{if(r.status===405){_endpointDisabled=true;console.info('Error reporter: endpoint returned 405 (worker not deployed) — disabled')}})
        .catch(()=>{});
      batch.forEach(e=>e._sent=true);
    }catch{}
  }
  // Send on page unload
  window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')_sendReport()});

  // ── Error console UI ──
  function _escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  async function showConsole(){
    const existing=document.getElementById('err-console');
    if(existing){existing.remove();return}
    const stored=await _loadErrors();
    const all=stored.length?stored:_errors;
    const panel=document.createElement('div');
    panel.id='err-console';
    panel.style.cssText='position:fixed;inset:0;z-index:10005;background:rgba(6,5,14,.92);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
    function render(errors){
      const hasKey=!!window.S?.apiK;
      panel.innerHTML=`<div style="background:var(--bs);border:1px solid var(--ab);border-radius:14px;padding:24px;max-width:720px;width:100%;max-height:85vh;overflow-y:auto;animation:fadeIn .3s;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="font-size:18px;color:var(--co);font-family:var(--sf);margin:0">Error Console</h2>
          <div style="display:flex;gap:6px">
            <button class="bt sm" onclick="_errPipeline.downloadAllErrors()">Download All</button>
            <button class="bt sm" onclick="_errPipeline.clearAll().then(()=>document.getElementById('err-console')?.remove())">Clear All</button>
            <button style="background:0;border:0;color:var(--tm);font-size:22px;cursor:pointer" onclick="document.getElementById('err-console')?.remove()">×</button>
          </div>
        </div>
        <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:12px">${errors.length} error${errors.length!==1?'s':''} captured · ${_crumbs.length} breadcrumbs buffered</div>
        ${errors.length===0?'<div style="text-align:center;padding:30px;color:var(--tm)">No errors captured. That\'s good!</div>':''}
        ${errors.slice().reverse().map(err=>`
          <div style="background:var(--bi);border:1px solid var(--bd);border-radius:8px;padding:12px;margin-bottom:8px" data-eid="${_escH(err.id)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;color:var(--co);font-family:var(--mf);word-break:break-word">${_escH(err.msg)}${err.count>1?' <span style="color:var(--wa)">×'+err.count+'</span>':''}</div>
                <div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:3px">${_escH(err.ts)} · ${_escH(err.tab)} tab${err.source?' · '+_escH(String(err.source).slice(0,60)):''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="bt sm" style="font-size:10px;padding:3px 8px" onclick="_errPipeline.copyReport('${_escH(err.id)}')">Copy</button>
                ${hasKey?'<button class="bt sm" style="font-size:10px;padding:3px 8px;color:var(--lv);border-color:rgba(155,142,196,.3)" onclick="_errPipeline.diagnose(\''+_escH(err.id)+'\')">Diagnose</button>':''}
              </div>
            </div>
            ${err.stack?'<details style="margin-top:6px"><summary style="font-size:10px;color:var(--tm);cursor:pointer;font-family:var(--mf)">Stack trace</summary><pre style="font-size:10px;color:var(--ts);font-family:var(--mf);white-space:pre-wrap;margin-top:4px;padding:8px;background:var(--bg);border-radius:4px;max-height:150px;overflow-y:auto">'+_escH(err.stack)+'</pre></details>':''}
            ${err.crumbs?.length?'<details style="margin-top:4px"><summary style="font-size:10px;color:var(--tm);cursor:pointer;font-family:var(--mf)">Breadcrumbs ('+err.crumbs.length+')</summary><div style="font-size:10px;color:var(--ts);font-family:var(--mf);margin-top:4px;padding:8px;background:var(--bg);border-radius:4px;max-height:150px;overflow-y:auto">'+err.crumbs.map(c=>'<div style="margin-bottom:2px"><span style="color:var(--tm)">'+new Date(c.t).toLocaleTimeString()+'</span> <span style="color:var(--wa)">['+_escH(c.type)+']</span> '+_escH(c.msg)+'</div>').join('')+'</div></details>':''}
            ${err.diagnosed?'<div style="margin-top:6px;padding:8px;background:rgba(155,142,196,.08);border:1px solid rgba(155,142,196,.2);border-radius:6px;font-size:11px;color:var(--ts);line-height:1.6;font-family:var(--sf)"><div style="font-size:10px;color:var(--lv);font-family:var(--mf);margin-bottom:4px">AI DIAGNOSIS</div>'+_escH(err.diagnosed)+'</div>':''}
          </div>
        `).join('')}
      </div>`;
    }
    render(all);
    panel.addEventListener('click',e=>{if(e.target===panel)panel.remove()});
    document.body.appendChild(panel);
  }

  // ── Copy formatted report ──
  async function copyReport(id){
    let err=_errors.find(e=>e.id===id);
    if(!err){const stored=await _loadErrors();err=stored.find(e=>e.id===id)}
    if(!err)return;
    const lines=[
      '## Meridian Error Report',
      '**Time:** '+err.ts,
      '**Tab:** '+err.tab,
      '**Error:** '+err.msg,
      '**Source:** '+(err.source||'N/A'),
      '**Browser:** '+err.env?.browser+' on '+err.env?.os,
      '**Screen:** '+err.env?.screen,
      '',
      err.stack?'### Stack Trace\n```\n'+err.stack+'\n```':'',
      '',
      '### Breadcrumb Trail',
      ...(err.crumbs||[]).map(c=>new Date(c.t).toLocaleTimeString()+' ['+c.type+'] '+c.msg),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(()=>{
      if(typeof toast==='function')toast('Error report copied to clipboard','ok');
    });
  }

  // ── Download full error report ──
  function downloadAllErrors(){
    if(!_errors.length){if(typeof toast==='function')toast('No errors to download','warn');return}
    const sections=_errors.slice().reverse().map((err,i)=>{
      const lines=[
        '## Error '+(i+1)+' of '+_errors.length,
        '**Time:** '+err.ts,
        '**Tab:** '+err.tab,
        '**Error:** '+err.msg,
        '**Source:** '+(err.source||'N/A'),
        '**Count:** '+err.count,
        '**Browser:** '+(err.env?.browser||'N/A')+' on '+(err.env?.os||'N/A'),
        '**Screen:** '+(err.env?.screen||'N/A'),
        '',
        err.stack?'### Stack Trace\n```\n'+err.stack+'\n```':'',
        '',
        '### Breadcrumb Trail',
        ...(err.crumbs||[]).map(c=>new Date(c.t).toLocaleTimeString()+' ['+c.type+'] '+c.msg),
        err.diagnosed?'\n### AI Diagnosis\n'+err.diagnosed:'',
        '',
        '---',
      ];
      return lines.join('\n');
    });
    const report='# Meridian Error Report\n**Generated:** '+new Date().toISOString()+'\n**Total Errors:** '+_errors.length+'\n**Breadcrumbs Buffered:** '+_crumbs.length+'\n\n---\n\n'+sections.join('\n\n');
    const blob=new Blob([report],{type:'text/markdown'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='meridian-errors-'+new Date().toISOString().slice(0,19).replace(/:/g,'-')+'.md';
    a.click();
    URL.revokeObjectURL(url);
    if(typeof toast==='function')toast('Error report downloaded','ok');
  }

  // ── AI diagnosis ──
  async function diagnose(id){
    let err=_errors.find(e=>e.id===id);
    if(!err){const stored=await _loadErrors();err=stored.find(e=>e.id===id)}
    if(!err)return;
    if(!window.S?.apiK){if(typeof toast==='function')toast('Set an API key in the AI tab first','err');return}
    const btn=document.querySelector(`[data-eid="${id}"] button:last-child`);
    if(btn){btn.textContent='Thinking...';btn.disabled=true}
    const prompt=`You are debugging a browser-based marine research platform called Meridian. Analyze this error and provide:
1. Likely root cause (1-2 sentences)
2. Which component/feature is affected
3. Suggested fix (specific code-level if possible)

Error: ${err.msg}
Source: ${err.source||'N/A'}
Active tab: ${err.tab}
Stack trace:
${err.stack||'N/A'}

Recent user actions (breadcrumbs):
${(err.crumbs||[]).map(c=>new Date(c.t).toLocaleTimeString()+' ['+c.type+'] '+c.msg).join('\n')}

Browser: ${err.env?.browser} on ${err.env?.os}`;
    try{
      const resp=await callAI({messages:[{role:'user',content:prompt}],system:'You are a concise JavaScript debugging assistant. Keep responses under 150 words. Be specific about Meridian\'s architecture: single-file HTML, IndexedDB, Plotly charts, Leaflet maps, multi-provider AI (Anthropic/OpenAI/Google).',maxTokens:300});
      const text=resp.content?.find(b=>b.type==='text')?.text||'No diagnosis available';
      err.diagnosed=text;
      _persistError(err);
      // Re-render console
      showConsole();setTimeout(showConsole,50);
    }catch(e){
      if(typeof toast==='function')toast('Diagnosis failed: '+e.message,'err');
    }finally{
      if(btn){btn.textContent='Diagnose';btn.disabled=false}
    }
  }

  // ── Keyboard shortcut ──
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='E'){e.preventDefault();showConsole()}
  });

  return{
    crumb,capture,showConsole,copyReport,diagnose,downloadAllErrors,
    clearAll:_clearErrors,
    get errors(){return _errors},
    get breadcrumbs(){return _crumbs}
  };
})();
if(typeof Plotly==='undefined'){document.body.innerHTML='<div style="padding:40px;color:#C27878;font-family:monospace"><h2>Plotly failed to load</h2><p>Check your internet connection and reload. Plotly CDN is required.</p></div>';throw new Error('Plotly CDN unavailable')}
// Auto-purge before Plotly.newPlot to prevent memory leaks (55+ plot calls, most re-use containers)
(function(){const _origNewPlot=Plotly.newPlot;Plotly.newPlot=function(el){const t=typeof el==='string'?document.getElementById(el):el;if(t&&t._fullLayout)try{Plotly.purge(t)}catch(e){}return _origNewPlot.apply(this,arguments)}})();
const S={litR:[],oaF:false,wsD:[],wsC:[],wsCT:{},cT:'scatter',xC:'',yC:[],zC:'',envSel:new Set(['sst','chlor','wh','at']),envR:{},envTS:{},envTS2:{},lib:[],chatM:[],chatL:false,apiK:"",aiProvider:'anthropic',aiModel:'',cols:{},activeCol:'',libSort:'recent',libStatusFilter:'all',batchMode:false,batchSelected:new Set(),skillLevel:safeParse('meridian_skill','intermediate'),envProvenance:{},activeProject:safeParse('meridian_active_project','Default')||'Default'};
const CL=['#C9956B','#7B9E87','#9B8EC4','#C27878','#D4A04A','#6BA3C9','#C96BA3','#8EC49B'];
let PL={paper_bgcolor:'#272536',plot_bgcolor:'#302E40',font:{family:'Inconsolata,monospace',color:'#A99D91',size:12},xaxis:{gridcolor:'rgba(201,149,107,.06)'},yaxis:{gridcolor:'rgba(201,149,107,.06)'},margin:{l:55,r:20,t:40,b:45},legend:{bgcolor:'transparent',font:{size:11}},colorway:CL};
function _updatePL(){const lt=document.documentElement.classList.contains('light');PL.paper_bgcolor=lt?'#ffffff':'#272536';PL.plot_bgcolor=lt?'#faf8f5':'#302E40';PL.font={family:'Inconsolata,monospace',color:lt?'#2d2d2d':'#A99D91',size:12};PL.xaxis={gridcolor:lt?'rgba(208,203,195,.5)':'rgba(201,149,107,.06)'};PL.yaxis={gridcolor:lt?'rgba(208,203,195,.5)':'rgba(201,149,107,.06)'}}
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
// ═══ MODULE-SCOPE CONCURRENCY LIMITER — max 6 concurrent ERDDAP fetches ═══
const _MAX_CONC=6;let _concActive=0;const _concQueue=[];
const _acquireSlot=()=>{if(_concActive<_MAX_CONC){_concActive++;return Promise.resolve()}return new Promise(r=>_concQueue.push(r))};
const _releaseSlot=()=>{_concActive--;if(_concQueue.length){_concActive++;_concQueue.shift()()}};

// ═══ SHARED UTILITIES & INFRASTRUCTURE ═══
const _toastWrap=document.createElement('div');_toastWrap.className='toast-wrap';document.body.appendChild(_toastWrap);
let _lastToastMsg='',_lastToastT=0;
function toast(msg,type='info',ms=3500){const now=Date.now();if(msg===_lastToastMsg&&now-_lastToastT<2000)return;_lastToastMsg=msg;_lastToastT=now;if(_toastWrap.children.length>=5){_toastWrap.firstChild.remove()}const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;_toastWrap.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},ms)}
// ═══ UTILITIES ═══
function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms)}}
function escHTML(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function escJSAttr(s){const j=String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");return j.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function safeUrl(u){try{const url=new URL(u);return['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}}
function renderMD(t){if(!t)return'';let h=t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>'<pre><code>'+c+'</code></pre>');h=h.replace(/`([^`\n]+)`/g,'<code>$1</code>');h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');h=h.replace(/(?<![*\\])\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');h=h.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');h=h.replace(/^[-*] (.+)$/gm,'<li>$1</li>');h=h.replace(/((?:<li>[^]*?<\/li>\s*)+)/g,'<ul>$1</ul>');h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,text,url)=>{const safe=safeUrl(url);if(safe)return'<a href="'+escHTML(safe)+'" target="_blank" rel="noopener noreferrer" style="color:var(--ac)">'+text+'</a>';return text});return h}
// ═══ STATE ═══
function safeParse(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch(e){console.warn('Corrupt localStorage for',key,e);return fallback}}
function safeStore(key,val){try{localStorage.setItem(key,typeof val==='string'?val:JSON.stringify(val))}catch(e){console.warn('localStorage full for',key);toast('Storage full — some data may not persist','err')}}
// ═══ ENCRYPTED KEY STORAGE (Web Crypto AES-GCM) ═══
const _keyVault=(function(){
  const SALT_KEY='_meridian_ks';const ENC_PREFIX='enc:';
  async function _getSalt(){
    let s=localStorage.getItem(SALT_KEY);
    if(!s){const buf=crypto.getRandomValues(new Uint8Array(16));s=btoa(String.fromCharCode(...buf));localStorage.setItem(SALT_KEY,s)}
    return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  }
  async function _deriveKey(salt){
    const raw=new TextEncoder().encode('meridian-vault-'+location.origin);
    const base=await crypto.subtle.importKey('raw',raw,'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  return{
    async store(name,plaintext){
      try{
        const salt=await _getSalt();const key=await _deriveKey(salt);
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plaintext));
        const combined=new Uint8Array(iv.length+enc.byteLength);combined.set(iv);combined.set(new Uint8Array(enc),iv.length);
        safeStore(name,ENC_PREFIX+btoa(String.fromCharCode(...combined)));
      }catch(e){console.warn('Vault encrypt failed, storing raw:',e);safeStore(name,plaintext)}
    },
    async retrieve(name){
      const raw=localStorage.getItem(name);if(!raw)return null;
      if(!raw.startsWith(ENC_PREFIX))return raw;// plaintext legacy
      try{
        const salt=await _getSalt();const key=await _deriveKey(salt);
        const combined=Uint8Array.from(atob(raw.slice(ENC_PREFIX.length)),c=>c.charCodeAt(0));
        const iv=combined.slice(0,12),data=combined.slice(12);
        const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);
        return new TextDecoder().decode(dec);
      }catch(e){console.warn('Vault decrypt failed:',e);return null}
    },
    remove(name){localStorage.removeItem(name)}
  };
})();
let _searchHist=safeParse('meridian_search_hist',[]);
let _litPage=0,_litQuery='',_litAllResults=[],_litAbort=null,_litBoolQ=null,_litHighlightTerms=[];
let _envBounds=null,_envMap=null,_envMarker=null,_envRect=null,_mapLayers={},_mapLayerDefs=null,_drawnItems=null;
let _baseTileLayer=null,_satTileLayer=null,_labelsLayer=null,_landMaskLayer=null,_coastlineLayer=null,_envPolygon=null;
let _coordDMS=false,_measureMode=false,_measurePoints=[],_measureLayers=[],_isobathLayer=null,_isobathCache=null;
let _graticuleLayer=null,_gibsLayers={},_areaStats=null,_polygonMode='filter';
let _envAbort=null;
// ── ERDDAP Proxy — same-origin Cloudflare Worker ──
// Deployed at meridian-engine.com/api/erddap/ — all external data fetches route through here.
const _ERDDAP_PROXY='/api/erddap/?url=';
function proxyUrl(url){return _ERDDAP_PROXY+encodeURIComponent(url)}
// ── Server Health Registry ──
const _serverHealth=new Map();
const _SERVER_HEALTH_TTL=60000;
async function probeServer(serverUrl){
  const c=_serverHealth.get(serverUrl);
  if(c&&Date.now()-c.at<_SERVER_HEALTH_TTL)return c.ok;
  try{const r=await fetchT(proxyUrl(serverUrl+'/version'),8000);
    _serverHealth.set(serverUrl,{ok:r.ok,at:Date.now()});return r.ok}
  catch{_serverHealth.set(serverUrl,{ok:false,at:Date.now()});return false}}
function isServerDown(serverUrl){
  const c=_serverHealth.get(serverUrl);
  return c&&!c.ok&&Date.now()-c.at<_SERVER_HEALTH_TTL}
function H(e,h){if(typeof e==='string')e=$(e);if(e)e.innerHTML=h}
function sh(e){if(typeof e==='string')e=$(e);if(e)e.style.display=''}
function hi(e){if(typeof e==='string')e=$(e);if(e)e.style.display='none'}
const mkL=()=>'<div class="ld">'+[0,1,2,3].map(i=>`<div class="ld-d" style="animation:glow 1.4s ease ${i*.15}s infinite"></div>`).join('')+'</div>';
function dl(c,f,t){const b=new Blob([c],{type:t}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function recAbs(inv){if(!inv)return null;const w=[];for(const[word,pos]of Object.entries(inv))for(const p of pos)w[p]=word;return w.join(' ').slice(0,500)}
function goTab(id,subtab){_errPipeline.crumb('nav','Tab → '+id+(subtab?' / '+subtab:''));$$('.sb-item').forEach(x=>{x.classList.remove('active');x.classList.remove('sub-active');x.setAttribute('aria-selected','false')});$$('.tp').forEach(x=>x.classList.remove('on'));const tabBtn=document.querySelector(`.sb-item[data-tab="${id}"]`);const tabPane=$(`#tab-${id}`);if(tabBtn){tabBtn.classList.add('active');tabBtn.setAttribute('aria-selected','true')}if(tabPane)tabPane.classList.add('on');_autoExpandSbGroup(id);if(window.innerWidth<768){const _sb=$('#sidebar');const _bd=$('#sidebar-backdrop');if(_sb)_sb.classList.remove('mobile-open');if(_bd)_bd.classList.remove('show')}if(id==='env'){if(typeof initEnvMap==='function')requestAnimationFrame(initEnvMap);if(typeof _envMap==='object'&&_envMap)setTimeout(()=>_envMap.invalidateSize(),200)}if(id==='ai'&&typeof refreshAiCtxIndicator==='function')refreshAiCtxIndicator();if(id==='publications'&&typeof initPublications==='function')initPublications();if(id==='archive'&&typeof initArchive==='function')initArchive();if(id==='fielddata'&&typeof initFieldData==='function')initFieldData();if(id==='ecostats'&&typeof initEcoStats==='function')initEcoStats();if(id==='studydesign'&&typeof initStudyDesign==='function')initStudyDesign();if(id==='research'&&typeof initResearch==='function')initResearch();if(id==='research'&&subtab&&typeof _rpShowTool==='function')_rpShowTool(subtab);if(id==='prisma'&&typeof initPrisma==='function')initPrisma();if(id==='settings'&&typeof initSettings==='function')initSettings();if(id==='home'&&typeof initHome==='function')initHome()}
// Sidebar collapsible groups
const _sbGroupMap={lit:'literature',library:'literature',gaps:'literature',graph:'literature',prisma:'literature',research:'research',publications:'publish',archive:'publish',workshop:'analysis',ecostats:'analysis',studydesign:'analysis',ai:'tools'};
function _autoExpandSbGroup(tabId){const grp=_sbGroupMap[tabId];if(!grp)return;$$('.sb-collapsible').forEach(g=>{const isTarget=g.dataset.group===grp;g.dataset.expanded=isTarget?'true':'false';const h=g.querySelector('.sb-ghdr');if(h)h.setAttribute('aria-expanded',isTarget?'true':'false')})}
function toggleSbGroup(groupId){const el=document.querySelector(`.sb-collapsible[data-group="${groupId}"]`);if(!el)return;const isOpen=el.dataset.expanded==='true';$$('.sb-collapsible').forEach(g=>{g.dataset.expanded='false';const h=g.querySelector('.sb-ghdr');if(h)h.setAttribute('aria-expanded','false')});if(!isOpen){el.dataset.expanded='true';const h=el.querySelector('.sb-ghdr');if(h)h.setAttribute('aria-expanded','true')}}
function fetchT(url,ms=15000,externalSignal){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);if(externalSignal){externalSignal.addEventListener('abort',()=>c.abort(),{once:true});if(externalSignal.aborted)c.abort()}return fetch(url,{signal:c.signal}).finally(()=>clearTimeout(t))}
function envFetchT(url,ms=15000){
  if(_envAbort?.signal.aborted)return Promise.reject(new DOMException('','AbortError'));
  const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  if(_envAbort)_envAbort.signal.addEventListener('abort',()=>c.abort(),{once:true});
  return fetch(url,{signal:c.signal}).finally(()=>clearTimeout(t))}
function cancelEnvFetch(){if(_envAbort){_envAbort.abort();_envAbort=null;hi('#eprog');toast('Fetch cancelled','info')}}
function buildErddapUrl(v,tQ,lat,lon){
  if(isNaN(parseFloat(lat))||isNaN(parseFloat(lon)))throw new Error('Invalid coordinates');
  lat=parseFloat(lat);lon=parseFloat(lon);
  const lonVal=v.lon360&&lon<0?360+lon:lon;
  const zQ=v.dm===4?`[${v.z}]`:'';
  let url=`${v.server}/griddap/${v.ds}.json?${v.v}${tQ}${zQ}`;
  if(window._areaQuery){const b=window._areaQuery;
    let bw=v.lon360&&b.west<0?360+b.west:b.west,be=v.lon360&&b.east<0?360+b.east:b.east;
    if(bw>be){bw=b.west;be=b.east}
    url+=`[(${b.south}):1:(${b.north})][(${bw}):1:(${be})]`}
  else{const buf=0.025;url+=`[(${(lat-buf).toFixed(3)}):1:(${(lat+buf).toFixed(3)})][(${(lonVal-buf).toFixed(3)}):1:(${(lonVal+buf).toFixed(3)})]`}
  return url}
function encErddap(url){return url.replace(/\[/g,'%5B').replace(/\]/g,'%5D')}
// Response cache — keyed by URL, TTL 5 minutes
const _fetchCache=new Map();const _CACHE_TTL=300000;
function getCached(url){const c=_fetchCache.get(url);if(c&&Date.now()-c.t<_CACHE_TTL)return c.data;return null}
function setCache(url,data){_fetchCache.set(url,{data,t:Date.now()});if(_fetchCache.size>50){const oldest=[..._fetchCache.entries()].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<10;i++)_fetchCache.delete(oldest[i][0])}}
async function erddapFetch(url,ms){
  const eu=encErddap(url);
  const cached=getCached(eu);if(cached)return new Response(JSON.stringify(cached),{status:200});
  if(_envAbort?.signal.aborted)throw new DOMException('','AbortError');
  const serverBase=url.match(/^https?:\/\/[^/]+/)?.[0]||'';
  try{const r=await envFetchT(proxyUrl(eu),ms);
    if(r.ok){r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}
    if(r.status===504)throw new Error('Upstream timed out — try a shorter date range');
    if(r.status===502)throw new Error('Server error — upstream ERDDAP may be overloaded, try again');
    throw new Error('HTTP '+r.status)}
  catch(e){if(e.name==='AbortError'||_envAbort?.signal.aborted)throw new DOMException('','AbortError');
    throw e.message?.startsWith('HTTP ')||e.message?.startsWith('Upstream')||e.message?.startsWith('Server error')?e:new Error('Data unavailable — could not reach '+(serverBase.split('//')[1]||'server')+'.')}}
// ── Bathymetry cascade sources (best → fallback) ──
const _BATHY_SOURCES=[
  {ds:'ETOPO_2022_v1_15s',v:'z',res:0.00417},
  {ds:'srtm15plus',v:'z',res:0.00417},
  {ds:'etopo180',v:'altitude',res:0.01667}
];
const _BATHY_SERVER='https://coastwatch.pfeg.noaa.gov/erddap';
// Parse bathymetry grid rows into {depth, slope}
function _parseBathyGrid(rows){
  if(!rows.length)return null;
  const lats=[...new Set(rows.map(r=>r[0]))].sort((a,b)=>a-b);
  const lons=[...new Set(rows.map(r=>r[1]))].sort((a,b)=>a-b);
  const grid={};rows.forEach(r=>{grid[r[0]+'_'+r[1]]=r[2]});
  const ci=Math.floor(lats.length/2),cj=Math.floor(lons.length/2);
  const alt=grid[lats[ci]+'_'+lons[cj]];
  if(alt==null)return null;
  const depthVal=alt<0?Math.abs(alt):0;
  let slopeVal=0;
  if(lats.length>=3&&lons.length>=3){
    const zN=grid[lats[ci+1]+'_'+lons[cj]],zS=grid[lats[ci-1]+'_'+lons[cj]];
    const zE=grid[lats[ci]+'_'+lons[cj+1]],zW=grid[lats[ci]+'_'+lons[cj-1]];
    if(zN!=null&&zS!=null&&zE!=null&&zW!=null){
      const dy=(lats[ci+1]-lats[ci-1])*111320;
      const dx=(lons[cj+1]-lons[cj-1])*111320*Math.cos(lats[ci]*Math.PI/180);
      slopeVal=Math.atan(Math.sqrt(((zE-zW)/dx)**2+((zN-zS)/dy)**2))*180/Math.PI}}
  return{depth:parseFloat(depthVal.toFixed(1)),slope:parseFloat(slopeVal.toFixed(2))}}
// ── GMRT point fetch — CORS-friendly, works from file:// ──
async function _gmrtFetchPoint(lat,lon){
  const r=await fetchT(
    `https://www.gmrt.org/services/PointServer?latitude=${lat}&longitude=${lon}&format=json`,10000);
  if(!r.ok)throw new Error('GMRT HTTP '+r.status);
  const d=await r.json();const elev=parseFloat(d.elevation);
  if(isNaN(elev))throw new Error('GMRT: invalid elevation');
  return elev}
// ── GMRT bathymetry with slope (center + 4 neighbors) ──
async function _gmrtFetchBathymetry(lat,lon){
  const d=0.01; // ~1.1km spacing
  const pts=[{la:lat,lo:lon},{la:lat+d,lo:lon},{la:lat-d,lo:lon},{la:lat,lo:lon+d},{la:lat,lo:lon-d}];
  const elevs=await Promise.all(pts.map(p=>_gmrtFetchPoint(p.la,p.lo)));
  const depthVal=elevs[0]<0?Math.abs(elevs[0]):0;
  const dy=2*d*111320,dx=2*d*111320*Math.cos(lat*Math.PI/180);
  const slopeVal=Math.atan(Math.sqrt(((elevs[3]-elevs[4])/dx)**2+((elevs[1]-elevs[2])/dy)**2))*180/Math.PI;
  return{depth:parseFloat(depthVal.toFixed(1)),slope:parseFloat(slopeVal.toFixed(2))}}
// ── Dedicated bathymetry fetch — independent of _envAbort, direct-first ──
async function _bathyFetchDirect(url,ms=15000){
  const eu=encErddap(url);
  const cached=getCached(eu);
  if(cached)return new Response(JSON.stringify(cached),{status:200});
  try{const r=await fetchT(proxyUrl(eu),ms);
    if(r.ok){r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}
    throw new Error('HTTP '+r.status)}
  catch(e){throw new Error('Bathymetry fetch failed')}}
// ── Bathymetry helper — cache → GMRT → ERDDAP fallback ──
async function fetchBathymetry(lat,lon){
  const la=parseFloat(lat),lo=parseFloat(lon);
  const cacheKey='bathy_'+la.toFixed(3)+'_'+lo.toFixed(3);
  // Tier 1: IndexedDB permanent cache
  try{const cached=await dbGetBathy(cacheKey);
    if(cached){console.info('BATHY cache:',cached.depth+'m',cached.slope+'°');
      return{depth:cached.depth,slope:cached.slope}}}catch{}
  // Tier 2: GMRT (CORS-friendly, works from file://)
  try{const result=await _gmrtFetchBathymetry(la,lo);
    if(result.depth>0){console.info('BATHY GMRT: depth='+result.depth+'m slope='+result.slope+'°');
      try{dbPutBathy(cacheKey,{...result,lat:la,lon:lo,fetchedAt:Date.now()})}catch{}
      return result}}catch(e){if(e.name==='AbortError')throw e;console.warn('GMRT failed:',e.message)}
  // Tier 3: ERDDAP fallback (works from https://, unreliable from file://)
  const deltas=[0.025,0.05,0.1,0.25];
  for(const src of _BATHY_SOURCES){let netFails=0;
    for(const d of deltas){if(netFails>=2)break;
      try{const url=`${_BATHY_SERVER}/griddap/${src.ds}.json?${src.v}[(${(la-d).toFixed(4)}):1:(${(la+d).toFixed(4)})][(${(lo-d).toFixed(4)}):1:(${(lo+d).toFixed(4)})]`;
        const r=await _bathyFetchDirect(url);const data=await r.json();
        const rows=(data.table?.rows||[]).filter(r=>r[2]!=null);const result=_parseBathyGrid(rows);
        if(result&&result.depth>0){try{dbPutBathy(cacheKey,{...result,lat:la,lon:lo,fetchedAt:Date.now()})}catch{}
          return result}netFails=0;
      }catch(e){if(e.name==='AbortError')throw e;netFails++;
        if(netFails<2)await new Promise(r=>setTimeout(r,1500))}}
  }
  throw new Error('Bathymetry unavailable at this location — GMRT and ERDDAP sources unreachable. Try a nearby point or check your connection.')}
// ── Merge two time series by averaging overlapping timestamps ──
function mergeTimeSeries(tsA,tsB){
  const map=new Map();
  tsA.forEach(d=>map.set(d.time,{a:d.value}));
  tsB.forEach(d=>{const e=map.get(d.time)||{};e.b=d.value;map.set(d.time,e)});
  return[...map.entries()].sort((a,b)=>a[0]<b[0]?-1:1)
    .map(([time,{a,b}])=>({time,value:a!=null&&b!=null?(a+b)/2:(a??b)}))}
// ── Point-in-polygon (ray-casting) ──
function pointInPolygon(lat,lon,vertices){
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const yi=vertices[i][0],xi=vertices[i][1],yj=vertices[j][0],xj=vertices[j][1];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside}
  return inside}
// ── Area bathymetry with statistics — GMRT grid first, ERDDAP fallback ──
async function fetchAreaBathymetry(bounds,polygon){
  const latSpan=bounds.north-bounds.south,lonSpan=bounds.east-bounds.west;
  // ── Tier 1: GMRT parallel grid ──
  try{
    const targetPts=Math.min(50,Math.max(25,Math.ceil(Math.sqrt(latSpan*lonSpan)*20)));
    const side=Math.ceil(Math.sqrt(targetPts));
    const latStep=latSpan/(side-1||1),lonStep=lonSpan/(side-1||1);
    const gridPts=[];
    for(let i=0;i<side;i++)for(let j=0;j<side;j++){
      const la=bounds.south+i*latStep,lo=bounds.west+j*lonStep;
      if(polygon&&!pointInPolygon(la,lo,polygon))continue;
      gridPts.push({la,lo})}
    if(gridPts.length>=4){
      // Batch in groups of 20 to avoid overwhelming server
      const elevResults=[];
      for(let b=0;b<gridPts.length;b+=20){
        const batch=gridPts.slice(b,b+20);
        const settled=await Promise.allSettled(batch.map(p=>_gmrtFetchPoint(p.la,p.lo)));
        elevResults.push(...settled)}
      const rows=[];
      gridPts.forEach((p,i)=>{
        if(elevResults[i].status==='fulfilled')rows.push([p.la,p.lo,elevResults[i].value])});
      if(rows.length>=4){
        console.info(`BATHY area GMRT: ${rows.length}/${gridPts.length} points resolved`);
        const depths=rows.map(r=>r[2]<0?Math.abs(r[2]):0).filter(d=>d>0);
        if(depths.length){
          const depthMin=Math.min(...depths),depthMax=Math.max(...depths);
          const depthMean=depths.reduce((s,x)=>s+x,0)/depths.length;
          // Grid-based slopes
          const lats=[...new Set(rows.map(r=>r[0]))].sort((a,b)=>a-b);
          const lons=[...new Set(rows.map(r=>r[1]))].sort((a,b)=>a-b);
          const grid={};rows.forEach(r=>{grid[r[0]+'_'+r[1]]=r[2]});
          const slopes=[];
          for(let i=1;i<lats.length-1;i++)for(let j=1;j<lons.length-1;j++){
            const zN=grid[lats[i+1]+'_'+lons[j]],zS=grid[lats[i-1]+'_'+lons[j]];
            const zE=grid[lats[i]+'_'+lons[j+1]],zW=grid[lats[i]+'_'+lons[j-1]];
            if(zN!=null&&zS!=null&&zE!=null&&zW!=null){
              const dy=(lats[i+1]-lats[i-1])*111320,dx=(lons[j+1]-lons[j-1])*111320*Math.cos(lats[i]*Math.PI/180);
              slopes.push(Math.atan(Math.sqrt(((zE-zW)/dx)**2+((zN-zS)/dy)**2))*180/Math.PI)}}
          // Random-pair slope sampling for sparse grids
          if(slopes.length<3&&depths.length>=2){
            const oceanRows=rows.filter(r=>r[2]<0);
            const nPairs=Math.min(50,oceanRows.length*(oceanRows.length-1)/2);
            for(let p=0;p<nPairs;p++){
              const a=oceanRows[Math.floor(Math.random()*oceanRows.length)];
              const b=oceanRows[Math.floor(Math.random()*oceanRows.length)];
              if(a===b)continue;
              const dLat=(b[0]-a[0])*111320;
              const dLon=(b[1]-a[1])*111320*Math.cos(((a[0]+b[0])/2)*Math.PI/180);
              const dist=Math.sqrt(dLat*dLat+dLon*dLon);
              if(dist<100)continue;
              const dz=Math.abs(b[2]-a[2]);
              slopes.push(Math.atan(dz/dist)*180/Math.PI)}
            if(slopes.length)console.info(`BATHY area: supplemented with ${slopes.length} random-pair slope samples`)}
          const slopeMean=slopes.length?slopes.reduce((s,x)=>s+x,0)/slopes.length:0;
          const slopeMax=slopes.length?Math.max(...slopes):0;
          return{depthMin:+depthMin.toFixed(1),depthMax:+depthMax.toFixed(1),depthMean:+depthMean.toFixed(1),slopeMean:+slopeMean.toFixed(2),slopeMax:+slopeMax.toFixed(2),oceanPoints:depths.length}}}}
  }catch(e){if(e.name==='AbortError')throw e;console.warn('GMRT area failed:',e.message)}
  // ── Tier 2: ERDDAP fallback ──
  const maxPts=50;
  let rows=null;
  for(const src of _BATHY_SOURCES){
    try{
      const cellSize=src.res;
      const latStride=Math.max(1,Math.ceil(latSpan/(maxPts*cellSize)));
      const lonStride=Math.max(1,Math.ceil(lonSpan/(maxPts*cellSize)));
      const url=`${_BATHY_SERVER}/griddap/${src.ds}.json?${src.v}[(${bounds.south.toFixed(4)}):${latStride}:(${bounds.north.toFixed(4)})][(${bounds.west.toFixed(4)}):${lonStride}:(${bounds.east.toFixed(4)})]`;
      const r=await _bathyFetchDirect(url);
      if(!r.ok)continue;
      const data=await r.json();
      rows=(data.table?.rows||[]).filter(r=>r[2]!=null);
      if(rows.length){console.info(`BATHY area ERDDAP: ${rows.length} cells from ${src.ds}`);break}
    }catch(e){if(e.name==='AbortError')throw e;continue}
  }
  if(!rows?.length)throw new Error('All bathymetry sources failed for area');
  if(polygon)rows=rows.filter(r=>pointInPolygon(r[0],r[1],polygon));
  if(!rows.length)throw new Error('No bathymetry data in polygon');
  const depths=rows.map(r=>r[2]<0?Math.abs(r[2]):0).filter(d=>d>0);
  if(!depths.length)return{depthMin:0,depthMax:0,depthMean:0,slopeMean:0,slopeMax:0,oceanPoints:0};
  const depthMin=Math.min(...depths),depthMax=Math.max(...depths);
  const depthMean=depths.reduce((s,x)=>s+x,0)/depths.length;
  const lats=[...new Set(rows.map(r=>r[0]))].sort((a,b)=>a-b);
  const lons=[...new Set(rows.map(r=>r[1]))].sort((a,b)=>a-b);
  const grid={};rows.forEach(r=>{grid[r[0]+'_'+r[1]]=r[2]});
  const slopes=[];
  for(let i=1;i<lats.length-1;i++)for(let j=1;j<lons.length-1;j++){
    const zN=grid[lats[i+1]+'_'+lons[j]],zS=grid[lats[i-1]+'_'+lons[j]];
    const zE=grid[lats[i]+'_'+lons[j+1]],zW=grid[lats[i]+'_'+lons[j-1]];
    if(zN!=null&&zS!=null&&zE!=null&&zW!=null){
      const dy=(lats[i+1]-lats[i-1])*111320,dx=(lons[j+1]-lons[j-1])*111320*Math.cos(lats[i]*Math.PI/180);
      slopes.push(Math.atan(Math.sqrt(((zE-zW)/dx)**2+((zN-zS)/dy)**2))*180/Math.PI)}}
  if(slopes.length<3&&depths.length>=2){
    const oceanRows=rows.filter(r=>r[2]<0);
    const nPairs=Math.min(50,oceanRows.length*(oceanRows.length-1)/2);
    for(let p=0;p<nPairs;p++){
      const a=oceanRows[Math.floor(Math.random()*oceanRows.length)];
      const b=oceanRows[Math.floor(Math.random()*oceanRows.length)];
      if(a===b)continue;
      const dLat=(b[0]-a[0])*111320;
      const dLon=(b[1]-a[1])*111320*Math.cos(((a[0]+b[0])/2)*Math.PI/180);
      const dist=Math.sqrt(dLat*dLat+dLon*dLon);
      if(dist<100)continue;
      const dz=Math.abs(b[2]-a[2]);
      slopes.push(Math.atan(dz/dist)*180/Math.PI)}
    if(slopes.length)console.info(`BATHY area: supplemented with ${slopes.length} random-pair slope samples`)}
  const slopeMean=slopes.length?slopes.reduce((s,x)=>s+x,0)/slopes.length:0;
  const slopeMax=slopes.length?Math.max(...slopes):0;
  return{depthMin:+depthMin.toFixed(1),depthMax:+depthMax.toFixed(1),depthMean:+depthMean.toFixed(1),slopeMean:+slopeMean.toFixed(2),slopeMax:+slopeMax.toFixed(2),oceanPoints:depths.length}}
// ── Haversine distance (km) ──
function haversineDistance(lat1,lon1,lat2,lon2){
  const R=6371,toR=Math.PI/180;
  const dLat=(lat2-lat1)*toR,dLon=(lon2-lon1)*toR;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
// ── DMS conversion ──
function toDMS(dd){
  const d=Math.abs(dd),deg=Math.floor(d),min=Math.floor((d-deg)*60),sec=((d-deg)*60-min)*60;
  return deg+'°'+String(min).padStart(2,'0')+"'"+sec.toFixed(1).padStart(4,'0')+'"'}
function formatCoordDMS(lat,lon){
  return toDMS(lat)+(lat>=0?'N':'S')+', '+toDMS(lon)+(lon>=0?'E':'W')}
const now=new Date(),d30=new Date(now);d30.setDate(d30.getDate()-30);
setTimeout(()=>{const f=d=>d.toISOString().split('T')[0];if($('#edf'))$('#edf').value=f(d30);if($('#edt'))$('#edt').value=f(now)},0);
$$('.sb-item').forEach(t=>t.addEventListener('click',()=>goTab(t.dataset.tab,t.dataset.subtab||undefined)));
// Sidebar toggle
(function(){const sb=$('#sidebar'),tog=$('#sidebarToggle'),ham=$('#sb-hamburger'),bd=$('#sidebar-backdrop');if(tog)tog.addEventListener('click',()=>{if(window.innerWidth<768){sb.classList.toggle('mobile-open');bd.classList.toggle('show')}else{sb.classList.toggle('expanded')}});if(ham)ham.addEventListener('click',()=>{sb.classList.add('mobile-open');bd.classList.add('show')});if(bd)bd.addEventListener('click',()=>{sb.classList.remove('mobile-open');bd.classList.remove('show')})})();

// ═══ SUPABASE CLIENT — global, created at top level ═══
const SB = window.SB = supabase.createClient(
  'https://wgqfxgxnanvckgqkuqas.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncWZ4Z3huYW52Y2tncWt1cWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDA0MzEsImV4cCI6MjA4OTYxNjQzMX0.PZ6ATWCJ_qyJVTXgFNmVKzBBxOQlEpa_vXLAhKVdgzg',
  {auth:{persistSession:true,storageKey:'meridian-auth',autoRefreshToken:true,detectSessionInUrl:true}}
);

let _supaUser=null;
let _supaIsAdmin=false;
let _syncInProgress=false;

// ═══ AUTH STATE LISTENER ═══
SB.auth.onAuthStateChange((event,session)=>{
  console.log('Auth event:',event);
  if(event==='SIGNED_IN'&&session){
    closeAuthModal();
    updateUISignedIn(session.user);
  }
  if(event==='SIGNED_OUT'){
    updateUISignedOut();
    showAuthModal();
  }
});

// ═══ CHECK EXISTING SESSION ON LOAD ═══
SB.auth.getSession().then(({data:{session}})=>{
  console.log('Session restore:',session?session.user.email:'none');
  if(session){
    closeAuthModal();
    updateUISignedIn(session.user);
  }else{
    showAuthModal();
  }
}).catch(e=>{
  console.warn('getSession error:',e);
});

// ═══ SIGN IN / SIGN UP / SIGN OUT ═══
async function doSignIn(email,password){
  const{data,error}=await SB.auth.signInWithPassword({email,password});
  console.log('Sign in:',data,error);
  if(error){_showAuthError(error.message);return}
}

async function doSignUp(email,password){
  const{data,error}=await SB.auth.signUp({email,password});
  console.log('Sign up:',data,error);
  if(error){_showAuthError(error.message);return}
  if(!data.session){_showAuthError('Check your email for a confirmation link')}
}

async function doSignOut(){
  await SB.auth.signOut();
}

// ═══ UI STATE ═══
function updateUISignedIn(user){
  _supaUser=user;
  closeAuthModal();
  const el=$('#auth-btn');
  if(el){
    const email=user.email||'';
    const short=email.length>20?email.slice(0,17)+'...':email;
    const av=el.querySelector('.sb-avatar-circle');
    if(av)av.innerHTML='<span class="sb-avatar-letter">'+(email[0]||'U').toUpperCase()+'</span>';
    const lb=el.querySelector('.sb-label');
    if(lb)lb.textContent=short;
    el.title='Signed in as '+email+' — click to manage';
    el.onclick=_showAccountMenu;
  }
  _checkAdminRole().then(()=>{
    _renderAdminLink();
    if(_supaIsAdmin&&el){
      const _lb=el.querySelector('.sb-label');
      if(_lb)_lb.textContent='\u{1F6E1}\uFE0F '+_lb.textContent;
      el.title='[Admin] '+el.title;
    }
  });
  toast('Signed in as '+(user.email||''),'ok');
  _syncOnLogin().catch(e=>console.warn('Sync:',e));
  _flushQueue();
  if(typeof loadMapAnnotations==='function')setTimeout(loadMapAnnotations,800);
  if(typeof window._onAuthSuccess==='function'){window._onAuthSuccess();window._onAuthSuccess=null}
}

function updateUISignedOut(){
  _supaUser=null;
  _supaIsAdmin=false;
  const el=$('#auth-btn');
  if(el){
    const av=el.querySelector('.sb-avatar-circle');
    if(av)av.innerHTML='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="3"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/></svg>';
    const lb=el.querySelector('.sb-label');
    if(lb)lb.textContent='Sign In';
    el.title='Sign in for cross-device sync';
    el.onclick=showAuthModal;
  }
  _renderAdminLink();
  toast('Signed out','info');
}

// ═══ ADMIN ROLE CHECK ═══
async function _checkAdminRole(){
  if(!_supaUser){_supaIsAdmin=false;return}
  try{
    const{data,error}=await SB.from('user_roles').select('role').eq('user_id',_supaUser.id).single();
    _supaIsAdmin=!error&&data?.role==='admin';
  }catch(e){
    _supaIsAdmin=false;
  }
}

function _renderAdminLink(){
  const el=$('#admin-link');if(!el)return;
  el.style.display=_supaIsAdmin?'flex':'none';
  el.onclick=function(){try{showAdminDashboard()}catch(e){console.error('Admin:',e);toast('Admin dashboard failed','err')}};
}

// ═══ ACCOUNT MENU ═══
function _showAccountMenu(){
  const existing=$('#supa-account-menu');if(existing){existing.remove();return}
  const m=document.createElement('div');m.id='supa-account-menu';
  m.style.cssText='position:fixed;bottom:80px;left:55px;z-index:10005;background:var(--bs);border:1px solid var(--ab);border-radius:10px;padding:16px;min-width:220px;animation:fadeIn .2s;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  m.innerHTML=`
    <div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:8px">Signed in as</div>
    <div style="font-size:13px;color:var(--ac);font-family:var(--mf);word-break:break-all;margin-bottom:14px">${_supaUser.email}</div>
    ${_supaIsAdmin?'<button class="bt sm" style="display:block;width:100%;text-align:center;color:var(--wa);border-color:rgba(212,160,74,.3);margin-bottom:8px;font-size:12px;box-sizing:border-box" onclick="document.getElementById(\'supa-account-menu\')?.remove();try{showAdminDashboard()}catch(e){console.error(e)}">\u{1F6E1}\uFE0F Admin Dashboard</button>':''}
    <button class="bt sm" style="width:100%;color:var(--sg);border-color:var(--sb);margin-bottom:8px;font-size:12px" onclick="$('#supa-account-menu').remove();_syncOnLogin().then(()=>toast('Sync complete','ok'))">Sync Now</button>
    <button class="bt sm" style="width:100%;color:var(--co);border-color:rgba(194,120,120,.3);font-size:12px" onclick="$('#supa-account-menu').remove();doSignOut()">Sign Out</button>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  document.addEventListener('click',function _dismiss(e){if(!m.contains(e.target)&&e.target!==$('#auth-btn')){m.remove();document.removeEventListener('click',_dismiss)}},{capture:true,once:false});
  document.body.appendChild(m);
}

// ═══ AUTH MODAL ═══
// ── Modal A11y: focus trap + Escape ──
function _trapFocus(modalEl){
  const focusable=modalEl.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  first.focus();
  modalEl._trapHandler=function(e){
    if(e.key==='Escape'){e.preventDefault();modalEl._onEsc?.();return}
    if(e.key!=='Tab')return;
    if(e.shiftKey){if(document.activeElement===first){e.preventDefault();last.focus()}}
    else{if(document.activeElement===last){e.preventDefault();first.focus()}}
  };
  modalEl.addEventListener('keydown',modalEl._trapHandler);
}
function _releaseFocusTrap(modalEl){if(modalEl?._trapHandler)modalEl.removeEventListener('keydown',modalEl._trapHandler)}

function showAuthModal(){
  if(_supaUser)return;
  const existing=$('#supa-auth-modal');if(existing)return;
  const m=document.createElement('div');m.id='supa-auth-modal';
  m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','auth-modal-title');
  m.style.cssText='position:fixed;inset:0;z-index:10006;background:rgba(6,5,14,.88);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML=`<div style="background:var(--bs);border:1px solid var(--ab);border-radius:14px;padding:32px 30px 24px;max-width:380px;width:100%;animation:fadeIn .3s;position:relative">
    <button style="position:absolute;top:12px;right:16px;background:0;border:0;color:var(--tm);font-size:22px;cursor:pointer;line-height:1" onclick="closeAuthModal()">&times;</button>
    <div style="text-align:center;margin-bottom:20px">
      <div id="auth-modal-title" style="font-size:28px;font-family:var(--sf);color:var(--ac);font-weight:700;letter-spacing:.5px">Meridian</div>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-top:2px;letter-spacing:1px">Marine Research Engine</div>
    </div>
    <p style="font-size:12px;color:var(--tm);margin-bottom:18px;line-height:1.5;text-align:center">Sign in to sync your library and settings across devices.</p>
    <div id="supa-auth-error" style="display:none;padding:8px 12px;background:var(--cm);border:1px solid rgba(194,120,120,.3);border-radius:6px;font-size:12px;color:var(--co);margin-bottom:12px"></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      <button type="button" class="bt sm" style="width:100%;padding:10px;font-size:12px;color:var(--tx);border-color:var(--ab);display:flex;align-items:center;justify-content:center;gap:8px" onclick="_doOAuth('google')">
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign in with Google
      </button>
      <button type="button" class="bt sm" style="width:100%;padding:10px;font-size:12px;color:var(--tx);border-color:var(--ab);display:flex;align-items:center;justify-content:center;gap:8px" onclick="_doOAuth('github')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        Sign in with GitHub
      </button>
    </div>
    <div style="position:relative;text-align:center;margin-bottom:16px"><div style="border-top:1px solid var(--bd);position:absolute;top:50%;left:0;right:0"></div><span style="background:var(--bs);padding:0 10px;position:relative;font-size:11px;color:var(--tm);font-family:var(--mf)">or use email</span></div>
    <div id="supa-auth-tabs" style="display:flex;gap:0;margin-bottom:14px">
      <button type="button" class="bt sm" id="supa-tab-login" style="flex:1;border-radius:6px 0 0 6px;font-size:12px;color:var(--ac);border-color:var(--ab);background:var(--am)" onclick="_authTabSwitch('login')">Sign In</button>
      <button type="button" class="bt sm" id="supa-tab-signup" style="flex:1;border-radius:0 6px 6px 0;font-size:12px;color:var(--tm);border-color:var(--ab)" onclick="_authTabSwitch('signup')">Sign Up</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input class="si" id="supa-email" type="email" placeholder="Email" style="font-size:13px;padding:10px 12px">
      <input class="si" id="supa-pass" type="password" placeholder="Password" style="font-size:13px;padding:10px 12px">
      <button type="button" class="bt bt-pri" id="supa-submit" style="padding:10px;font-size:13px;margin-top:4px" onclick="_handleAuthSubmit()">Sign In</button>
    </div>
    <div style="text-align:center;margin-top:16px">
      <a href="#" onclick="event.preventDefault();closeAuthModal()" style="font-size:12px;color:var(--tm);text-decoration:none;opacity:.8">Continue without account</a>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)closeAuthModal()});
  document.body.appendChild(m);
  m._onEsc=closeAuthModal;_trapFocus(m);
}

function closeAuthModal(){
  const m=$('#supa-auth-modal');if(m){_releaseFocusTrap(m);m.remove()}
}

// ═══ AUTH FORM HELPERS ═══
let _authMode='login';

function _authTabSwitch(mode){
  _authMode=mode;
  const l=$('#supa-tab-login'),s=$('#supa-tab-signup'),b=$('#supa-submit');
  if(mode==='login'){
    if(l){l.style.color='var(--ac)';l.style.background='var(--am)'}
    if(s){s.style.color='var(--tm)';s.style.background=''}
    if(b)b.textContent='Sign In';
  }else{
    if(s){s.style.color='var(--ac)';s.style.background='var(--am)'}
    if(l){l.style.color='var(--tm)';l.style.background=''}
    if(b)b.textContent='Sign Up';
  }
}

async function _handleAuthSubmit(){
  const btn=$('#supa-submit');
  const email=$('#supa-email')?.value?.trim();
  const pass=$('#supa-pass')?.value;
  if(!email||!pass){_showAuthError('Enter email and password');return}
  if(btn){btn.disabled=true;btn.textContent='...'}
  try{
    if(_authMode==='login') await doSignIn(email,pass);
    else await doSignUp(email,pass);
  }catch(e){
    console.error('Auth error:',e);
    _showAuthError('Connection error — try again');
  }
  if(btn){btn.disabled=false;btn.textContent=_authMode==='login'?'Sign In':'Sign Up'}
}

function _showAuthError(msg){
  const el=$('#supa-auth-error');if(!el)return;
  el.textContent=msg;el.style.display='block';
}

async function _doOAuth(provider){
  const{error}=await SB.auth.signInWithOAuth({provider,options:{redirectTo:'https://meridian-engine.com'}});
  if(error)_showAuthError(error.message);
}

// ═══ CLOUD CRUD ═══
async function _supaUpsertPaper(paper){
  if(!SB||!_supaUser)return;
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
  const{data:existing}=await SB.from('library_papers').select('id').eq('user_id',_supaUser.id).eq('local_id',paper.id).maybeSingle();
  if(existing){
    await SB.from('library_papers').update(row).eq('id',existing.id);
  }else{
    await SB.from('library_papers').insert(row);
  }
}

async function _supaDeletePaper(localId){
  if(!SB||!_supaUser)return;
  await SB.from('library_papers').delete().eq('user_id',_supaUser.id).eq('local_id',localId);
}

async function _supaFetchPapers(){
  if(!SB||!_supaUser)return[];
  const{data,error}=await SB.from('library_papers').select('*').eq('user_id',_supaUser.id);
  if(error){console.warn('Supabase fetch papers:',error);return[]}
  return data||[];
}

async function _supaSaveSettings(){
  if(!SB||!_supaUser)return;
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
  const{data:existing}=await SB.from('user_settings').select('id').eq('user_id',_supaUser.id).maybeSingle();
  if(existing)await SB.from('user_settings').update(row).eq('id',existing.id);
  else await SB.from('user_settings').insert(row);
}

async function _supaLoadSettings(){
  if(!SB||!_supaUser)return null;
  const{data}=await SB.from('user_settings').select('*').eq('user_id',_supaUser.id).maybeSingle();
  return data;
}

// ═══ SYNC ON LOGIN ═══
async function _syncOnLogin(){
  if(!SB||!_supaUser||_syncInProgress)return;
  _syncInProgress=true;
  try{
    const cloudPapers=await _supaFetchPapers();
    const localPapers=S.lib||[];

    const localByDoi={};const localById={};
    for(const p of localPapers){
      if(p.doi)localByDoi[p.doi.toLowerCase()]=p;
      localById[p.id]=p;
    }

    // Flush any pending cloud deletions FIRST so they don't get re-imported
    await _flushQueue();

    let imported=0;let cloudDeleted=0;
    for(const cp of cloudPapers){
      const doi=cp.doi?.toLowerCase();
      if(doi&&localByDoi[doi])continue;
      if(cp.local_id&&localById[cp.local_id])continue;
      // Skip if paper was locally deleted (tombstone check)
      if(cp.local_id&&_isDeletedTombstone(cp.local_id)){
        try{await _supaDeletePaper(cp.local_id);cloudDeleted++}catch(e){console.warn('sync-tombstone-delete',e)}
        continue;
      }
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
    if(cloudDeleted>0)console.log('[Meridian Sync] Cleaned '+cloudDeleted+' tombstoned papers from cloud');

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

    const cloudSettings=await _supaLoadSettings();
    if(cloudSettings?.preferences_json){
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

// ═══ DELETION TOMBSTONES — prevent re-sync of deleted papers ═══
const _TOMBSTONE_KEY='meridian_deleted_ids';
const _TOMBSTONE_MAX=500;

function _trackDeletion(localId){
  const ts=safeParse(_TOMBSTONE_KEY,[]);
  if(!ts.includes(localId)){ts.push(localId);if(ts.length>_TOMBSTONE_MAX)ts.splice(0,ts.length-_TOMBSTONE_MAX);safeStore(_TOMBSTONE_KEY,ts)}
}

function _isDeletedTombstone(localId){
  return safeParse(_TOMBSTONE_KEY,[]).includes(localId);
}

function _clearTombstones(){
  safeStore(_TOMBSTONE_KEY,[]);
}

// ═══ OFFLINE QUEUE ═══
const _QUEUE_KEY='meridian_sync_queue';

function _queuePush(op){
  if(!_supaUser)return;
  const q=safeParse(_QUEUE_KEY,[]);
  q.push({...op,ts:Date.now()});
  safeStore(_QUEUE_KEY,q);
}

async function _flushQueue(){
  if(!SB||!_supaUser)return;
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

window.addEventListener('online',()=>{if(_supaUser)_flushQueue()});

// ═══ DATA LAYER HOOKS ═══
function _hookDataLayer(){
  const _origDbPut=dbPut;
  dbPut=async function(p){
    await _origDbPut(p);
    if(_supaUser){
      if(navigator.onLine)_supaUpsertPaper(p).catch(e=>console.warn('Cloud sync:',e));
      else _queuePush({type:'upsert_paper',data:p});
    }
  };

  const _origDbDel=dbDel;
  dbDel=async function(id){
    await _origDbDel(id);
    _trackDeletion(id);
    if(_supaUser){
      if(navigator.onLine){
        try{await _supaDeletePaper(id)}catch(e){console.warn('Cloud delete failed, queuing:',e);_queuePush({type:'delete_paper',localId:id})}
      }else{
        _queuePush({type:'delete_paper',localId:id});
      }
    }
  };

  let _settingsTimer=null;
  const _origSafeStore=safeStore;
  safeStore=function(key,val){
    _origSafeStore(key,val);
    if(_supaUser&&['meridian_provider','meridian_theme','meridian_skill','meridian_active_project'].some(k=>key.startsWith(k))){
      clearTimeout(_settingsTimer);
      _settingsTimer=setTimeout(()=>{
        if(navigator.onLine)_supaSaveSettings().catch(()=>{});
        else _queuePush({type:'save_settings'});
      },2000);
    }
  };
}

// ═══ ADMIN DASHBOARD OVERLAY ═══
let _admOverlay=null;
let _admAllUsers=[];
let _admSort={col:'created_at',asc:false};

function showAdminDashboard(){
  try{
  if(!_supaIsAdmin){toast('Admin access required','err');return}
  if(!SB)return;

  if(!_admOverlay){
  _admOverlay=document.createElement('div');
  _admOverlay.id='admin-overlay';
  _admOverlay.style.display='none';

  _admOverlay.innerHTML=`<style>
#admin-overlay{position:fixed;inset:0;z-index:10003;background:var(--bg);overflow-y:auto;animation:fadeIn .3s}
#admin-overlay .adm-wrap{max-width:1100px;margin:0 auto;padding:30px 30px 60px}
#admin-overlay .adm-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--bd)}
#admin-overlay .adm-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:28px}
#admin-overlay .adm-stat{background:var(--bs);border:1px solid var(--ab);border-radius:var(--rd);padding:16px;text-align:center;animation:fadeIn .3s}
#admin-overlay .adm-stat .val{font-size:24px;font-weight:700;color:var(--ac);font-family:var(--mf)}
#admin-overlay .adm-stat .lbl{font-size:12px;color:var(--tm);font-family:var(--mf);margin-top:4px;letter-spacing:.3px}
#admin-overlay .adm-card{background:var(--bs);border:1px solid var(--ab);border-radius:var(--rd);padding:20px;margin-bottom:20px;animation:fadeIn .3s}
#admin-overlay .adm-card h2{font-size:16px;color:var(--ac);margin-bottom:14px;font-family:var(--sf);display:flex;align-items:center;gap:8px}
#admin-overlay .adm-count{font-size:11px;color:var(--tm);font-family:var(--mf);font-weight:400}
#admin-overlay table{width:100%;border-collapse:collapse;font-size:12px;font-family:var(--mf)}
#admin-overlay th{text-align:left;padding:8px 10px;color:var(--tm);border-bottom:1px solid var(--ab);font-weight:500;letter-spacing:.5px;font-size:10px;white-space:nowrap;cursor:pointer;user-select:none}
#admin-overlay th:hover{color:var(--ac)}
#admin-overlay th.sorted{color:var(--ac)}
#admin-overlay td{padding:8px 10px;border-bottom:1px solid var(--bd);color:var(--ts);max-width:200px;overflow:hidden;text-overflow:ellipsis}
#admin-overlay tr:nth-child(even) td{background:rgba(255,255,255,.02)}
#admin-overlay tr:hover td{background:rgba(201,149,107,.06)}
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
  }
  // Reset to loading state each time
  const _ld=document.getElementById('adm-loading');
  const _ct=document.getElementById('adm-content');
  if(_ld)_ld.style.display='';
  if(_ct)_ct.style.display='none';
  // Update email display (may have changed)
  const _em=_admOverlay.querySelector('.adm-hdr span');
  if(_em)_em.textContent=_supaUser?.email||'';
  // Show
  _admOverlay.style.display='';
  document.body.style.overflow='hidden';
  _admLoadAll(SB);
  }catch(e){console.error('Admin dashboard error:',e);toast('Admin dashboard failed','err')}
}

function closeAdminDashboard(){
  try{
    if(_admOverlay)_admOverlay.style.display='none';
    document.body.style.overflow='';
    const lib=document.getElementById('adm-library-modal');
    if(lib)lib.style.display='none';
  }catch(e){console.error('Admin close error:',e)}
}

function _admEscHandler(e){
  if(e.key==='Escape'&&_admOverlay&&_admOverlay.style.display!=='none'){
    const lib=document.getElementById('adm-library-modal');
    if(lib&&lib.style.display!=='none'){lib.style.display='none';return}
    closeAdminDashboard();
  }
}
document.addEventListener('keydown',_admEscHandler);

function _admEsc(s){return s?s.replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'):''}

async function _admLoadAll(supa){
  try{
  const{data}=await supa.auth.getSession();
  if(!data?.session){toast('Session expired','err');closeAdminDashboard();return}
  const session=data.session;
  const{data:role}=await supa.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
  if(!role||role.role!=='admin'){toast('Admin access denied','err');closeAdminDashboard();return}
  const loading=document.getElementById('adm-loading');
  const content=document.getElementById('adm-content');
  if(loading)loading.style.display='none';
  if(content)content.style.display='block';
  _admLoadStats(supa).catch(e=>console.warn('Admin stats:',e));
  _admLoadUsers(supa).catch(e=>console.warn('Admin users:',e));
  _admLoadChart(supa).catch(e=>console.warn('Admin chart:',e));
  _admLoadLogs(supa).catch(e=>console.warn('Admin logs:',e));
  }catch(e){console.error('Admin load error:',e);toast('Admin data failed to load','err')}
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
  try{
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
  }catch(e){console.error('Admin filter error:',e)}
}

function _admSortUsers(col){
  try{
  if(_admSort.col===col)_admSort.asc=!_admSort.asc;
  else{_admSort.col=col;_admSort.asc=true}
  _admFilterUsers();
  }catch(e){console.error('Admin sort error:',e)}
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
  try{
  if(!SB)return;const supa=SB;
  const action=newRole==='banned'?'ban':'set role to '+newRole+' for';
  if(!confirm('Are you sure you want to '+action+' this user?'))return _admLoadUsers(supa);
  const{error}=await supa.rpc('admin_set_user_role',{target_user_id:userId,new_role:newRole});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa).catch(()=>{});_admLoadLogs(supa).catch(()=>{});
  }catch(e){console.error('Admin role change error:',e)}
}

async function _admDeleteUser(userId,email){
  try{
  if(!SB)return;const supa=SB;
  if(!confirm('Permanently delete user '+email+'? This removes all their data and cannot be undone.'))return;
  if(!confirm('Final confirmation: DELETE '+email+'?'))return;
  const{error}=await supa.rpc('admin_delete_user',{target_user_id:userId});
  if(error){alert('Error: '+error.message);return}
  _admLoadUsers(supa).catch(()=>{});_admLoadStats(supa).catch(()=>{});_admLoadLogs(supa).catch(()=>{});
  }catch(e){console.error('Admin delete error:',e)}
}

async function _admViewLibrary(userId,email){
  try{
  if(!SB)return;const supa=SB;
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
  }catch(e){console.error('Admin view library error:',e)}
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

// ═══ INIT — hook data layer after all scripts loaded ═══
const _ab=$('#auth-btn');if(_ab)_ab.onclick=showAuthModal;
document.addEventListener('DOMContentLoaded',()=>{_hookDataLayer();
  // ARIA init: set role/aria-selected on tabs, aria-expanded on group headers
  $$('.sb-item').forEach(btn=>{btn.setAttribute('role','tab');btn.setAttribute('aria-selected',btn.classList.contains('active')?'true':'false')});
  $$('.sb-ghdr').forEach(btn=>{const grp=btn.closest('.sb-collapsible');btn.setAttribute('aria-expanded',grp?.dataset.expanded==='true'?'true':'false')});
});
