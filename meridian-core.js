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

// ═══ MERIDIAN ERROR PIPELINE ═══
const _errPipeline=(function(){
  const MAX_CRUMBS=30,MAX_ERRORS=100,DEDUP_MS=5000,REPORT_INTERVAL=60000,REPORT_MAX_PER_MIN=10;
  const _crumbs=[],_errors=[];
  let _errDB=null,_lastReportT=0,_reportCount=0,_reportTimer=null;
  // ── DEPLOY: Set this to your error reporting Worker URL before going live ──
  // e.g. 'https://meridian-engine.com/api/errors'
  const _ERROR_ENDPOINT='';

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
    _crumbs.push({t:Date.now(),type,msg,data:data||null});
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
    const activeTab=document.querySelector('.tab.on')?.dataset?.tab||'unknown';
    const err={
      id:'e_'+now+'_'+Math.random().toString(36).slice(2,6),
      ts:new Date(now).toISOString(),
      msg:String(msg).slice(0,500),
      source:source||null,
      stack:stack?String(stack).slice(0,2000):null,
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
    // Remove API keys from logged URLs
    return String(url).replace(/([?&])(key|api_key|x-api-key|apikey|token)=[^&]*/gi,'$1$2=[REDACTED]')
                      .replace(/(sk-ant-[a-zA-Z0-9-]{8})[a-zA-Z0-9-]*/g,'$1...')
                      .replace(/(sk-[a-zA-Z0-9]{8})[a-zA-Z0-9]*/g,'$1...')
                      .replace(/(AIza[a-zA-Z0-9]{8})[a-zA-Z0-9]*/g,'$1...');
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
    console.error('Meridian error:',msg,src,line,err);
    capture(msg,src+':'+line+':'+col,err?.stack,{type:'runtime'});
    return false;
  };
  window.addEventListener('unhandledrejection',e=>{
    console.error('Unhandled promise:',e.reason);
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
    if(!_ERROR_ENDPOINT)return;
    const now=Date.now();
    if(now-_lastReportT<60000)_reportCount++;else _reportCount=1;
    _lastReportT=now;
    if(_reportCount>REPORT_MAX_PER_MIN)return;
    const unsent=_errors.filter(e=>!e._sent);
    if(!unsent.length)return;
    const batch=unsent.slice(0,20);
    try{
      const body=JSON.stringify({errors:batch,ts:new Date().toISOString()});
      if(navigator.sendBeacon){navigator.sendBeacon(_ERROR_ENDPOINT,body)}
      else{_origFetch(_ERROR_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{})}
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
  function copyReport(id){
    const err=_errors.find(e=>e.id===id);
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
    const err=_errors.find(e=>e.id===id);
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
function _updatePL(){const lt=document.documentElement.classList.contains('light');PL.paper_bgcolor=lt?'#FFFFFF':'#272536';PL.plot_bgcolor=lt?'#E4E0D8':'#302E40';PL.font={family:'Inconsolata,monospace',color:lt?'#3D342A':'#A99D91',size:12};PL.xaxis={gridcolor:lt?'rgba(80,60,20,.16)':'rgba(201,149,107,.06)'};PL.yaxis={gridcolor:lt?'rgba(80,60,20,.16)':'rgba(201,149,107,.06)'}}
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
// ═══ MODULE-SCOPE CONCURRENCY LIMITER — max 6 concurrent ERDDAP fetches ═══
const _MAX_CONC=6;let _concActive=0;const _concQueue=[];
const _acquireSlot=()=>{if(_concActive<_MAX_CONC){_concActive++;return Promise.resolve()}return new Promise(r=>_concQueue.push(r))};
const _releaseSlot=()=>{_concActive--;if(_concQueue.length){_concActive++;_concQueue.shift()()}};

// ═══ SHARED UTILITIES & INFRASTRUCTURE ═══
const _toastWrap=document.createElement('div');_toastWrap.className='toast-wrap';document.body.appendChild(_toastWrap);
function toast(msg,type='info',ms=3500){if(_toastWrap.children.length>=5){_toastWrap.firstChild.remove()}const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;_toastWrap.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},ms)}
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
let _litPage=0,_litQuery='',_litAllResults=[],_litAbort=null;
let _envBounds=null,_envMap=null,_envMarker=null,_envRect=null,_mapLayers={},_mapLayerDefs=null,_drawnItems=null;
let _baseTileLayer=null,_satTileLayer=null,_labelsLayer=null,_landMaskLayer=null,_coastlineLayer=null,_envPolygon=null;
let _coordDMS=false,_measureMode=false,_measurePoints=[],_measureLayers=[],_isobathLayer=null,_isobathCache=null;
let _graticuleLayer=null,_gibsLayers={},_areaStats=null,_polygonMode='filter';
let _envAbort=null;
// ── DEPLOY: Set this to your Cloudflare Worker URL before going live ──
// e.g. 'https://proxy.meridian-engine.com/?url='
// When set, all ERDDAP/external fetches route through this proxy (CORS-safe, cached, rate-limited).
// When empty, falls back to public CORS proxies (development only — will fail under real traffic).
const _CORS_WORKER='';
const CORS_PROXIES=_CORS_WORKER?[url=>_CORS_WORKER+encodeURIComponent(url)]:[
  url=>'https://corsproxy.org/?url='+encodeURIComponent(url),
  url=>'https://corsproxy.io/?'+encodeURIComponent(url),
  url=>'https://api.allorigins.win/raw?url='+encodeURIComponent(url)];
let _proxyHit=-1,_proxyHitT=0;
// ── Server Health Registry ──
const _serverHealth=new Map();
const _SERVER_HEALTH_TTL=60000;
async function probeServer(serverUrl){
  const c=_serverHealth.get(serverUrl);
  if(c&&Date.now()-c.at<_SERVER_HEALTH_TTL)return c.ok;
  try{const r=await fetchT(serverUrl+'/version',8000);
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
function goTab(id){_errPipeline.crumb('nav','Tab → '+id);$$('.tab').forEach(x=>x.classList.remove('on'));$$('.tp').forEach(x=>x.classList.remove('on'));const tabBtn=document.querySelector(`[data-tab="${id}"]`);const tabPane=$(`#tab-${id}`);if(tabBtn)tabBtn.classList.add('on');if(tabPane)tabPane.classList.add('on');if(id==='env'){if(typeof initEnvMap==='function')requestAnimationFrame(initEnvMap);if(typeof _envMap==='object'&&_envMap)setTimeout(()=>_envMap.invalidateSize(),200)}if(id==='ai'&&typeof refreshAiCtxIndicator==='function')refreshAiCtxIndicator();if(id==='fielddata'&&typeof initFieldData==='function')initFieldData();if(id==='ecostats'&&typeof initEcoStats==='function')initEcoStats();if(id==='studydesign'&&typeof initStudyDesign==='function')initStudyDesign()}
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
  else url+=`[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
  return url}
function encErddap(url){return url.replace(/\[/g,'%5B').replace(/\]/g,'%5D')}
// Response cache — keyed by URL, TTL 5 minutes
const _fetchCache=new Map();const _CACHE_TTL=300000;
function getCached(url){const c=_fetchCache.get(url);if(c&&Date.now()-c.t<_CACHE_TTL)return c.data;return null}
function setCache(url,data){_fetchCache.set(url,{data,t:Date.now()});if(_fetchCache.size>50){const oldest=[..._fetchCache.entries()].sort((a,b)=>a[1].t-b[1].t);for(let i=0;i<10;i++)_fetchCache.delete(oldest[i][0])}}
async function erddapFetch(url,ms){
  const eu=encErddap(url);
  const cached=getCached(eu);if(cached)return new Response(JSON.stringify(cached),{status:200});
  const serverBase=url.match(/^https?:\/\/[^/]+\/erddap/)?.[0]||url.match(/^https?:\/\/[^/]+/)?.[0];
  if(serverBase&&isServerDown(serverBase))throw new Error('Server '+serverBase.split('//')[1]+' unreachable');
  // Direct fetch runs in background — resolves to Response or null on CORS/network failure
  const directP=(async()=>{try{const r=await envFetchT(eu,ms);
    if(r.ok)r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}catch{return null}})();
  // Give direct a 1.5s head start before trying proxies
  const quick=await Promise.race([directP,new Promise(r=>setTimeout(()=>r(null),1500))]);
  if(quick)return quick;
  if(!quick)console.info('ERDDAP direct fetch slow — falling through to proxies for: '+serverBase);
  // Direct still pending or failed (CORS/network) — cascade through proxies
  const si=(_proxyHit>=0&&Date.now()-_proxyHitT<300000)?_proxyHit:0;
  for(let i=0;i<CORS_PROXIES.length;i++){
    const idx=(si+i)%CORS_PROXIES.length;
    if(_envAbort?.signal.aborted)throw new DOMException('','AbortError');
    try{const r=await envFetchT(CORS_PROXIES[idx](eu),20000);
      if(r.ok){_proxyHit=idx;_proxyHitT=Date.now();
        r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}
    }catch(e){if(_envAbort?.signal.aborted)throw new DOMException('','AbortError')}}
  // All proxies failed — wait for direct as last resort
  try{const d=await directP;if(d)return d}catch{}
  if(_envAbort?.signal.aborted)throw new DOMException('','AbortError');
  throw new Error('Data unavailable — could not reach '+(serverBase?.split('//')[1]||'server')+' (tried direct + '+CORS_PROXIES.length+' proxies). Check your network connection or try again in a few minutes.')}
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
  // Direct fetch runs in background — ERDDAP supports CORS *
  const directP=(async()=>{try{const r=await fetchT(eu,ms);
    if(r.ok){r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}}catch{}return null})();
  // Give direct 1.5s head start
  const quick=await Promise.race([directP,new Promise(r=>setTimeout(()=>r(null),1500))]);
  if(quick)return quick;
  // Direct still pending — cascade proxies with shorter timeout
  const si=(_proxyHit>=0&&Date.now()-_proxyHitT<300000)?_proxyHit:0;
  for(let i=0;i<CORS_PROXIES.length;i++){
    const idx=(si+i)%CORS_PROXIES.length;
    try{const r=await fetchT(CORS_PROXIES[idx](eu),8000);
      if(r.ok){_proxyHit=idx;_proxyHitT=Date.now();
        r.clone().json().then(d=>setCache(eu,d)).catch(()=>{});return r}
    }catch{}}
  // All proxies failed — wait for direct as last resort
  try{const d=await directP;if(d)return d}catch{}
  throw new Error('Bathymetry fetch failed (direct + '+CORS_PROXIES.length+' proxies)')}
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
$$('.tab').forEach(t=>t.addEventListener('click',()=>goTab(t.dataset.tab)));
// Tab scroll indicator
(function(){const tw=document.querySelector('.hdr-tabwrap');const tabs=tw?.querySelector('.tabs');if(tw&&tabs){const updateScroll=()=>{tw.classList.toggle('scroll-left',tabs.scrollLeft>8)};tabs.addEventListener('scroll',updateScroll,{passive:true});updateScroll()}})();
