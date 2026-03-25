// ═══ MERIDIAN PADI — Personal Adaptive Discovery Intelligence ═══
// Tier 1 Local AI Learning Engine

// ═══════════════════════════════════════════════════════════════
// ═══ PADI — Personal Adaptive Discovery Intelligence ═══
// ═══ Tier 1 Local AI Learning Engine ═══
// ═══════════════════════════════════════════════════════════════

const PADI=(function(){
const _STOP=new Set(['the','and','for','that','this','with','from','are','was','were','been','have','has','had','not','but','what','all','can','her','one','our','out','you','its','his','how','did','two','may','who','each','more','some','them','than','then','into','only','very','when','also','most','such','both','through','between','under','after','before','over','about','these','those','other','which','their','there','where','would','could','should','being','same','during','while','because','against','among','within','without','along','another','around','however','since','upon','often','across','still','already','although','further','rather','whether','either','neither','always','toward','towards','perhaps','usually','according','particularly','especially','therefore','thus','hence','moreover','furthermore','addition','regard','respect','despite','beyond','above','below','several','various','specific','particular','following','including','related','based','using','used','found','known','given','present','recent','previous','first','second','third','study','studies','research','result','results','analysis','method','methods','data','model','system','level','effect','effects','number','group','groups','case','time','year','years','work','paper','article','journal','review','figure','table','sample','samples','test','value','values','rate','total','mean','range','area','population','species','fish','water','marine','sea','ocean','temperature','size','length','weight','growth','age','stock','fishing','catch','abundance','density','distribution','habitat','coastal','region','south','north','east','west','gulf','mediterranean','atlantic','pacific','environmental','ecological','biological','condition','assessment','management','conservation','estimate','estimated','observed','measured','significant','significantly','increase','decreased','showed','indicate','suggests','compared','similar','different','high','higher','low','lower','large','small']);

function tokenize(text){
  if(!text)return[];
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>2&&!_STOP.has(w)).map(w=>{
    if(w.length>6&&w.endsWith('tion'))return w.slice(0,-4);
    if(w.length>5&&w.endsWith('ing'))return w.slice(0,-3);
    if(w.length>4&&w.endsWith('ed'))return w.slice(0,-2);
    if(w.length>4&&w.endsWith('ly'))return w.slice(0,-2);
    if(w.length>4&&w.endsWith('es'))return w.slice(0,-2);
    if(w.length>4&&w.endsWith('er'))return w.slice(0,-2);
    if(w.length>5&&w.endsWith('ment'))return w.slice(0,-4);
    return w;
  }).filter(w=>w.length>2);
}

function paperText(paper){
  const t=paper.title||'';
  return[t,t,t,paper.abstract||'',(paper.concepts||[]).join(' '),(paper.tags||[]).join(' '),paper.notes||''].join(' ');
}

function padiDbPut(store,obj){
  return new Promise((res,rej)=>{
    if(!db)return rej(new Error('DB not ready'));
    const tx=db.transaction(store,'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete=()=>res();
    tx.onerror=e=>rej(e.target.error);
  });
}
function padiDbGet(store,id){
  return new Promise((res,rej)=>{
    if(!db)return rej(new Error('DB not ready'));
    const tx=db.transaction(store,'readonly');
    const req=tx.objectStore(store).get(id);
    req.onsuccess=()=>res(req.result||null);
    req.onerror=e=>rej(e.target.error);
  });
}

// ═══ TF-IDF INDEX ═══
const tfidf={
  vocab:new Map(),_revVocab:new Map(),df:null,idf:null,docVecs:new Map(),N:0,_nextId:0,_dirty:false,_persistTimer:null,
  _termId(term){
    let id=this.vocab.get(term);
    if(id===undefined){id=this._nextId++;this.vocab.set(term,id);this._revVocab.set(id,term)}
    return id;
  },
  _growArrays(minSize){
    const newSize=Math.max(minSize,this._nextId)*2;
    if(!this.df||this.df.length<newSize){
      const ndf=new Uint16Array(newSize);const nidf=new Float32Array(newSize);
      if(this.df){ndf.set(this.df);nidf.set(this.idf)}
      this.df=ndf;this.idf=nidf;
    }
  },
  buildFull(papers){
    this.vocab.clear();this._revVocab.clear();this.docVecs.clear();this.N=0;this._nextId=0;
    const size=Math.max(papers.length*80,1024);
    this.df=new Uint16Array(size);this.idf=new Float32Array(size);
    const chunk=20;let idx=0;
    const process=()=>{
      const end=Math.min(idx+chunk,papers.length);
      for(;idx<end;idx++){
        const p=papers[idx];
        const tokens=tokenize(paperText(p));
        const tf=new Map();
        tokens.forEach(t=>{const id=this._termId(t);tf.set(id,(tf.get(id)||0)+1)});
        this._growArrays(this._nextId);
        const seen=new Set();
        tf.forEach((_,id)=>{if(!seen.has(id)){seen.add(id);this.df[id]++}});
        const maxTf=Math.max(...tf.values(),1);
        const vec=new Map();
        tf.forEach((c,id)=>{vec.set(id,0.5+0.5*c/maxTf)});
        this.docVecs.set(p.id,vec);
        this.N++;
      }
      if(idx<papers.length){
        _showActivity('Indexing papers... '+idx+'/'+papers.length);
        (typeof requestIdleCallback==='function'?requestIdleCallback:setTimeout)(process);
      }else{
        this._computeIdf();this._applyIdf();this._dirty=true;this._schedulePersist();
        _showActivity('Index complete — '+this.N+' papers, '+this.vocab.size+' terms',2500);
        _updateStatus();
      }
    };
    if(papers.length)process();else _updateStatus();
  },
  _computeIdf(){
    for(let i=0;i<this._nextId;i++){
      this.idf[i]=this.N>0?Math.log((this.N+1)/(this.df[i]+1))+1:0;
    }
  },
  _applyIdf(){
    this.docVecs.forEach(vec=>{
      vec.forEach((tf,id)=>{vec.set(id,tf*this.idf[id])});
    });
  },
  addDoc(paper){
    const tokens=tokenize(paperText(paper));
    if(!tokens.length)return;
    _showActivity('Learning from: '+(paper.title||'').slice(0,50)+'...',2000);
    if(this.docVecs.has(paper.id))this.removeDoc(paper.id);
    const tf=new Map();
    tokens.forEach(t=>{const id=this._termId(t);tf.set(id,(tf.get(id)||0)+1)});
    this._growArrays(this._nextId);
    const seen=new Set();
    tf.forEach((_,id)=>{if(!seen.has(id)){seen.add(id);this.df[id]++}});
    this.N++;
    this._computeIdf();
    const maxTf=Math.max(...tf.values(),1);
    const vec=new Map();
    tf.forEach((c,id)=>{vec.set(id,(0.5+0.5*c/maxTf)*this.idf[id])});
    this.docVecs.set(paper.id,vec);
    this._dirty=true;this._schedulePersist();
  },
  removeDoc(paperId){
    const vec=this.docVecs.get(paperId);
    if(!vec)return;
    vec.forEach((_,id)=>{if(this.df[id]>0)this.df[id]--});
    this.docVecs.delete(paperId);
    this.N=Math.max(0,this.N-1);
    this._computeIdf();
    this._dirty=true;this._schedulePersist();
  },
  _cosine(a,b){
    let dot=0,na=0,nb=0;
    a.forEach((v,id)=>{na+=v*v;const bv=b.get(id);if(bv)dot+=v*bv});
    b.forEach(v=>{nb+=v*v});
    return(na&&nb)?dot/Math.sqrt(na*nb):0;
  },
  similar(paperId,topK=5){
    const vec=this.docVecs.get(paperId);
    if(!vec)return[];
    const scores=[];
    this.docVecs.forEach((v,id)=>{if(id!==paperId){scores.push({id,score:this._cosine(vec,v)})}});
    scores.sort((a,b)=>b.score-a.score);
    return scores.slice(0,topK).filter(s=>s.score>0.01);
  },
  query(text,topK=10){
    const tokens=tokenize(text);
    if(!tokens.length)return[];
    const tf=new Map();
    tokens.forEach(t=>{const id=this.vocab.get(t);if(id!==undefined)tf.set(id,(tf.get(id)||0)+1)});
    if(!tf.size)return[];
    const maxTf=Math.max(...tf.values(),1);
    const qvec=new Map();
    tf.forEach((c,id)=>{qvec.set(id,(0.5+0.5*c/maxTf)*this.idf[id])});
    const scores=[];
    this.docVecs.forEach((v,id)=>{scores.push({id,score:this._cosine(qvec,v)})});
    scores.sort((a,b)=>b.score-a.score);
    return scores.slice(0,topK).filter(s=>s.score>0.01);
  },
  keywords(paperId,topK=8){
    const vec=this.docVecs.get(paperId);
    if(!vec)return[];
    const terms=[];
    vec.forEach((w,id)=>{
      const term=this._revVocab.get(id);
      if(term)terms.push({term,weight:w});
    });
    terms.sort((a,b)=>b.weight-a.weight);
    return terms.slice(0,topK);
  },
  profile(){
    const eng=_engagement.scores;
    const agg=new Map();
    this.docVecs.forEach((vec,paperId)=>{
      const w=eng[paperId]?_engagement.compute(paperId):0.1;
      vec.forEach((v,id)=>{agg.set(id,(agg.get(id)||0)+v*w)});
    });
    const terms=[];
    agg.forEach((w,id)=>{
      const term=this._revVocab.get(id);
      if(term)terms.push({term,weight:w});
    });
    terms.sort((a,b)=>b.weight-a.weight);
    return terms.slice(0,20);
  },
  _schedulePersist(){
    if(this._persistTimer)return;
    this._persistTimer=setTimeout(()=>{this._persistTimer=null;this.persist()},30000);
  },
  async persist(){
    if(!this._dirty)return;
    const vocabArr=[];this.vocab.forEach((id,term)=>vocabArr.push([term,id]));
    const docs=[];this.docVecs.forEach((vec,id)=>{
      const entries=[];vec.forEach((w,tid)=>entries.push([tid,w]));
      docs.push([id,entries]);
    });
    const dfArr=this.df?Array.from(this.df.subarray(0,this._nextId)):[];
    _showActivity('Saving index...',1200);
    await padiDbPut('padi_tfidf',{id:'main',vocab:vocabArr,docs,df:dfArr,N:this.N,nextId:this._nextId});
    this._dirty=false;
  },
  async load(){
    const d=await padiDbGet('padi_tfidf','main');
    if(!d)return false;
    this.vocab.clear();this._revVocab.clear();this.docVecs.clear();
    d.vocab.forEach(([t,id])=>{this.vocab.set(t,id);this._revVocab.set(id,t)});
    this._nextId=d.nextId||0;this.N=d.N||0;
    const size=Math.max(this._nextId*2,1024);
    this.df=new Uint16Array(size);this.idf=new Float32Array(size);
    (d.df||[]).forEach((v,i)=>{this.df[i]=v});
    this._computeIdf();
    d.docs.forEach(([id,entries])=>{
      const vec=new Map();entries.forEach(([tid,w])=>vec.set(tid,w));
      this.docVecs.set(id,vec);
    });
    return true;
  }
};

// ═══ ENGAGEMENT TRACKER ═══
const _engagement={
  scores:safeParse('meridian_padi_engagement',{}),
  track(paperId,event,meta){
    if(!paperId)return;
    const s=this.scores[paperId]||(this.scores[paperId]={views:0,viewMs:0,tags:0,notes:0,findings:0,cited:0,_lastView:0});
    switch(event){
      case 'view':s.views++;s._lastView=Date.now();break;
      case 'note':s.notes=Math.max(s.notes,(meta?.len)||0);break;
      case 'tag':s.tags++;break;
      case 'finding':s.findings=1;break;
      case 'cite':s.cited=1;break;
    }
    this._dirty=true;
  },
  compute(paperId){
    const s=this.scores[paperId];
    if(!s)return 0;
    return Math.min(1,
      Math.log(1+s.views)*0.2+
      Math.log(1+s.viewMs/60000)*0.3+
      (s.tags>0?0.15:0)+
      Math.log(1+s.notes/100)*0.2+
      (s.findings?0.1:0)+
      (s.cited?0.05:0)
    );
  },
  topEngaged(topK=5){
    const scores=[];
    for(const id in this.scores)scores.push({id,score:this.compute(id)});
    scores.sort((a,b)=>b.score-a.score);
    return scores.slice(0,topK).filter(s=>s.score>0);
  },
  persist(){
    safeStore('meridian_padi_engagement',this.scores);
    this._dirty=false;
  },
  _dirty:false
};

// Track view duration via beforeunload
let _viewStart=0,_viewPaperId=null;
function _trackViewStart(id){
  if(_viewPaperId&&_viewStart){
    const s=_engagement.scores[_viewPaperId];
    if(s)s.viewMs=(s.viewMs||0)+(Date.now()-_viewStart);
  }
  _viewPaperId=id;_viewStart=Date.now();
}
window.addEventListener('beforeunload',()=>{
  if(_viewPaperId&&_viewStart){
    const s=_engagement.scores[_viewPaperId];
    if(s)s.viewMs=(s.viewMs||0)+(Date.now()-_viewStart);
  }
  _engagement.persist();
  // IDB writes are async and may not complete in beforeunload.
  // Schedule them (best-effort) but don't rely on them — the 30s timer handles normal ops.
  try{tfidf.persist()}catch(e){}
  try{graph.persist()}catch(e){}
});

// ═══ NAIVE BAYES CLASSIFIER ═══
const bayes={
  classCounts:{},tokenCounts:{},totalTokens:{},vocabSize:0,_trained:false,_trainCount:0,
  _features(paper){
    const tokens=tokenize((paper.title||'')+' '+(paper.abstract||''));
    const jterm=paper.journal?'_j_'+paper.journal.toLowerCase().replace(/[^a-z]/g,'').slice(0,20):'_j_unknown';
    tokens.push(jterm);
    const yr=paper.year||0;
    tokens.push(yr<2000?'_yr_pre2000':yr<2010?'_yr_2000s':yr<2020?'_yr_2010s':'_yr_2020s');
    const c=paper.cited||0;
    tokens.push(c===0?'_cite_0':c<=10?'_cite_low':c<=50?'_cite_mid':c<=200?'_cite_high':'_cite_vhigh');
    if(paper.concepts)paper.concepts.forEach(c=>{const t=c.toLowerCase().replace(/[^a-z]/g,'');if(t.length>2)tokens.push('_con_'+t)});
    return tokens;
  },
  async train(){
    const screenData=await dbGetAllScreening();
    if(screenData.length<5)return;
    const classes=new Set(screenData.map(s=>s.decision));
    if(classes.size<2)return;
    _showActivity('Training classifier on '+screenData.length+' decisions...');
    this.classCounts={};this.tokenCounts={};this.totalTokens={};
    const byId=Object.fromEntries(screenData.map(s=>[s.paperId,s.decision]));
    const chunk=20;let idx=0;
    const papers=S.lib.filter(p=>byId[p.id]);
    const process=()=>{
      const end=Math.min(idx+chunk,papers.length);
      for(;idx<end;idx++){
        const p=papers[idx];const cls=byId[p.id];
        this.classCounts[cls]=(this.classCounts[cls]||0)+1;
        if(!this.tokenCounts[cls])this.tokenCounts[cls]={};
        this.totalTokens[cls]=this.totalTokens[cls]||0;
        const tokens=this._features(p);
        tokens.forEach(t=>{
          this.tokenCounts[cls][t]=(this.tokenCounts[cls][t]||0)+1;
          this.totalTokens[cls]++;
        });
      }
      if(idx<papers.length){
        (typeof requestIdleCallback==='function'?requestIdleCallback:setTimeout)(process);
      }else{
        const allTokens=new Set();
        Object.values(this.tokenCounts).forEach(tc=>Object.keys(tc).forEach(t=>allTokens.add(t)));
        this.vocabSize=allTokens.size;
        this._trained=true;this._trainCount=screenData.length;
        _showActivity('Classifier trained — '+[...classes].join(', ')+' ('+screenData.length+' decisions)',2500);
        this.persist();_updateStatus();
      }
    };
    process();
  },
  trainIncremental(paper,decision){
    _showActivity('Learning: '+decision+' — '+(paper.title||'').slice(0,40)+'...',1500);
    this.classCounts[decision]=(this.classCounts[decision]||0)+1;
    if(!this.tokenCounts[decision])this.tokenCounts[decision]={};
    this.totalTokens[decision]=this.totalTokens[decision]||0;
    const tokens=this._features(paper);
    tokens.forEach(t=>{
      this.tokenCounts[decision][t]=(this.tokenCounts[decision][t]||0)+1;
      this.totalTokens[decision]++;
    });
    const allTokens=new Set();
    Object.values(this.tokenCounts).forEach(tc=>Object.keys(tc).forEach(t=>allTokens.add(t)));
    this.vocabSize=allTokens.size;
    this._trainCount++;
    if(this._trainCount%10===0)this.train();
    else{
      const totalDocs=Object.values(this.classCounts).reduce((a,b)=>a+b,0);
      const numClasses=Object.keys(this.classCounts).length;
      this._trained=totalDocs>=5&&numClasses>=2;
      if(this._trained)this.persist();
    }
  },
  predict(paper){
    if(!this._trained)return null;
    const tokens=this._features(paper);
    const classes=Object.keys(this.classCounts);
    const totalDocs=Object.values(this.classCounts).reduce((a,b)=>a+b,0);
    const scores={};
    classes.forEach(cls=>{
      let logProb=Math.log((this.classCounts[cls]+1)/(totalDocs+classes.length));
      const tc=this.tokenCounts[cls]||{};
      const total=this.totalTokens[cls]||0;
      tokens.forEach(t=>{
        logProb+=Math.log(((tc[t]||0)+1)/(total+this.vocabSize));
      });
      scores[cls]=logProb;
    });
    const maxCls=classes.reduce((a,b)=>scores[a]>scores[b]?a:b);
    // Log-sum-exp trick for numerical stability
    const maxScore=scores[maxCls];
    const logSum=maxScore+Math.log(Object.values(scores).reduce((s,v)=>s+Math.exp(v-maxScore),0));
    const confidence=Math.exp(scores[maxCls]-logSum);
    return{decision:maxCls,confidence:isNaN(confidence)?0.5:confidence,scores};
  },
  async persist(){
    await padiDbPut('padi_bayes',{id:'main',classCounts:this.classCounts,tokenCounts:this.tokenCounts,totalTokens:this.totalTokens,vocabSize:this.vocabSize,trainCount:this._trainCount});
  },
  async load(){
    const d=await padiDbGet('padi_bayes','main');
    if(!d)return false;
    this.classCounts=d.classCounts||{};this.tokenCounts=d.tokenCounts||{};
    this.totalTokens=d.totalTokens||{};this.vocabSize=d.vocabSize||0;
    this._trainCount=d.trainCount||0;
    const totalDocs=Object.values(this.classCounts).reduce((a,b)=>a+b,0);
    const classes=Object.keys(this.classCounts);
    this._trained=totalDocs>=5&&classes.length>=2;
    return this._trained;
  }
};

// ═══ SEARCH TERM GRAPH ═══
const graph={
  nodes:new Map(),edges:new Map(),querySaves:[],_dirty:false,
  recordQuery(queryText){
    const terms=tokenize(queryText);
    if(!terms.length)return;
    _showActivity('Mapping search terms: '+terms.slice(0,4).join(', ')+(terms.length>4?'...':''),1500);
    const now=Date.now();
    terms.forEach(t=>{
      const n=this.nodes.get(t)||{freq:0,lastUsed:0};
      n.freq++;n.lastUsed=now;
      this.nodes.set(t,n);
    });
    for(let i=0;i<terms.length;i++){
      for(let j=i+1;j<terms.length;j++){
        const key=[terms[i],terms[j]].sort().join('|');
        const e=this.edges.get(key)||{weight:0,lastUsed:0};
        e.weight++;e.lastUsed=now;
        this.edges.set(key,e);
      }
    }
    this._dirty=true;this._schedulePersist();
  },
  recordSave(queryText,paperId){
    this.querySaves.push({query:queryText,paperId,timestamp:Date.now()});
    if(this.querySaves.length>500)this.querySaves=this.querySaves.slice(-500);
    this._dirty=true;this._schedulePersist();
  },
  suggest(currentTerms,topK=5){
    const ct=new Set(tokenize(currentTerms.join(' ')));
    if(!ct.size)return[];
    const now=Date.now();
    const candidates=new Map();
    this.edges.forEach((e,key)=>{
      const[a,b]=key.split('|');
      let match=null,other=null;
      if(ct.has(a)){match=a;other=b}
      else if(ct.has(b)){match=b;other=a}
      if(other&&!ct.has(other)){
        const decay=1/(1+(now-e.lastUsed)/(30*86400000));
        const score=(candidates.get(other)||0)+e.weight*decay;
        candidates.set(other,score);
      }
    });
    const sorted=[...candidates.entries()].sort((a,b)=>b[1]-a[1]);
    return sorted.slice(0,topK).map(([term,score])=>{
      const saves=this.querySaves.filter(qs=>tokenize(qs.query).includes(term)).length;
      return{term,score,saves};
    });
  },
  productiveTerms(topK=10){
    const termSaves=new Map();
    this.querySaves.forEach(qs=>{
      tokenize(qs.query).forEach(t=>{termSaves.set(t,(termSaves.get(t)||0)+1)});
    });
    return[...termSaves.entries()].sort((a,b)=>b[1]-a[1]).slice(0,topK).map(([term,saves])=>({term,saves}));
  },
  _persistTimer:null,
  _schedulePersist(){
    if(this._persistTimer)return;
    this._persistTimer=setTimeout(()=>{this._persistTimer=null;this.persist()},30000);
  },
  async persist(){
    if(!this._dirty)return;
    const nodes=[];this.nodes.forEach((v,k)=>nodes.push([k,v]));
    const edges=[];this.edges.forEach((v,k)=>edges.push([k,v]));
    await padiDbPut('padi_graph',{id:'main',nodes,edges,querySaves:this.querySaves.slice(-500)});
    this._dirty=false;
  },
  async load(){
    const d=await padiDbGet('padi_graph','main');
    if(!d)return false;
    this.nodes.clear();this.edges.clear();
    (d.nodes||[]).forEach(([k,v])=>this.nodes.set(k,v));
    (d.edges||[]).forEach(([k,v])=>this.edges.set(k,v));
    this.querySaves=d.querySaves||[];
    return true;
  }
};

// ═══ UI COMPONENTS ═══

function _badgeHTML(pred){
  if(!pred)return'';
  const d=pred.decision;const pct=Math.round(pred.confidence*100);
  const color=d==='include'?'var(--sg)':d==='exclude'?'var(--co)':'var(--wa)';
  const bg=d==='include'?'var(--sm)':d==='exclude'?'var(--be)':'var(--be)';
  const label=d==='include'?'Relevant':d==='exclude'?'Unlikely':'Maybe';
  return`<span style="display:inline-block;font-size:10px;font-family:var(--mf);padding:2px 6px;border-radius:3px;background:${bg};color:${color};border:1px solid var(--bd);margin-left:4px">${label} ${pct}%</span>`;
}

function _termSuggestionDropdown(terms){
  if(!terms||!terms.length)return'';
  return terms.map(t=>
    `<div style="padding:6px 12px;font-size:12px;font-family:var(--mf);cursor:pointer;display:flex;justify-content:space-between;color:var(--ts)" onmousedown="event.preventDefault();const i=$('#lq');i.value=i.value+' '+this.dataset.term;hi('#padi-suggest')" data-term="${escHTML(t.term)}"><span style="color:var(--ac)">${escHTML(t.term)}</span>${t.saves?`<span style="color:var(--sg);font-size:10px">${t.saves} saves</span>`:''}</div>`
  ).join('');
}

let _simCardCount=0;
function _similarHTML(paperId){
  if(tfidf.N<5)return'';
  const sims=tfidf.similar(paperId,3);
  if(!sims.length)return'';
  _simCardCount++;
  const autoShow=_simCardCount<=3;
  return`<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--bd)"><span style="font-size:11px;color:var(--tm);font-family:var(--mf);cursor:pointer" onclick="const el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none'">Similar Papers ${autoShow?'▾':'▸'}</span><div style="${autoShow?'':'display:none'}">${sims.map(s=>{
    const p=S.lib.find(x=>x.id===s.id);
    if(!p)return'';
    return`<div style="font-size:11px;color:var(--ts);padding:3px 0;line-height:1.4">${escHTML((p.title||'').slice(0,80))}${p.title?.length>80?'…':''} <span style="color:var(--tm);font-family:var(--mf)">${Math.round(s.score*100)}%</span></div>`;
  }).join('')}</div></div>`;
}

function _statusHTML(){
  const st=_status();
  const pct=Math.min(100,Math.round(st.papers/5*100));
  return`<div id="padi-status" style="font-size:12px;color:var(--tm);font-family:var(--mf);padding:6px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${st.ready?'var(--sg)':'var(--wa)'};${st.ready?'':'animation:pulse 2s infinite'}" aria-label="PADI status"></span><span>PADI: ${st.msg}</span>${!st.ready?`<span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:60px;height:4px;background:var(--be);border-radius:2px;overflow:hidden"><span style="display:block;width:${pct}%;height:100%;background:linear-gradient(90deg,var(--ac),var(--sg));transition:width .3s"></span></span><span style="font-size:10px">${st.papers}/5</span></span>`:''}</div>`;
}

function _profileHTML(){
  const terms=tfidf.profile();
  const topPapers=_engagement.topEngaged(5);
  const productive=graph.productiveTerms(5);
  if(!terms.length&&!topPapers.length)return'';
  const autoExpand=tfidf.N>=10;
  return`<div style="margin:8px 0"><span style="font-size:12px;color:var(--tm);font-family:var(--mf);cursor:pointer" onclick="const el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none'">Research Profile ${autoExpand?'▾':'▸'}</span><div style="${autoExpand?'':'display:none;'}padding:8px 0">${
    terms.length?`<div style="margin-bottom:6px"><div style="font-size:10px;color:var(--tm);margin-bottom:4px">Top Research Terms</div><div style="display:flex;flex-wrap:wrap;gap:3px">${terms.slice(0,15).map(t=>`<span style="display:inline-block;font-size:12px;padding:2px 7px;border-radius:3px;background:var(--ab);color:var(--ac);border:1px solid var(--bd);cursor:pointer" onclick="goTab('lit');setTimeout(()=>{const q=document.getElementById('lq');if(q){q.value='${escJSAttr(t.term)}';q.dispatchEvent(new Event('input'))}},100)" title="Search for this term">${escHTML(t.term)}</span>`).join('')}</div></div>`:''
  }${topPapers.length?`<div style="margin-bottom:6px"><div style="font-size:10px;color:var(--tm);margin-bottom:4px">Most Engaged Papers</div>${topPapers.map(e=>{
    const p=S.lib.find(x=>x.id===e.id);
    return p?`<div style="font-size:11px;color:var(--ts);padding:2px 0">${escHTML((p.title||'').slice(0,70))}${p.title?.length>70?'…':''} <span style="color:var(--sg);font-family:var(--mf)">${Math.round(e.score*100)}%</span></div>`:'';
  }).join('')}</div>`:''
  }${productive.length?`<div><div style="font-size:10px;color:var(--tm);margin-bottom:4px">Productive Search Terms</div><div style="display:flex;flex-wrap:wrap;gap:3px">${productive.map(t=>`<span style="display:inline-block;font-size:11px;padding:2px 7px;border-radius:3px;background:var(--sm);color:var(--sg);border:1px solid var(--bd)">${escHTML(t.term)} (${t.saves})</span>`).join('')}</div></div>`:''
  }</div></div>`;
}

function _updateStatus(){
  const el=$('#padi-status');
  if(el){const st=_status();el.querySelector('span:last-child').textContent='PADI: '+st.msg;const dot=el.querySelector('span:first-child');if(dot){dot.style.background=st.ready?'var(--sg)':'var(--wa)';dot.style.animation=st.ready?'':'pulse 2s infinite'}}
}

function _status(){
  const papers=tfidf.N;
  const screened=Object.values(bayes.classCounts).reduce((a,b)=>a+b,0);
  const searches=graph.nodes.size;
  const ready=papers>=5;
  let msg=`${papers} papers indexed`;
  if(screened)msg+=`, ${screened} screened`;
  if(searches)msg+=`, ${searches} terms tracked`;
  if(papers<5)msg+=' — add '+(5-papers)+' more papers to enable similarity';
  if(!bayes._trained&&screened<5)msg+=(screened?` — screen ${5-screened} more to enable predictions`:' — screen papers to enable predictions');
  return{papers,screened,searches,ready,msg};
}

// ═══ ACTIVITY BAR ═══
let _activityTimer=null;
function _showActivity(msg,durationMs){
  const bar=$('#padi-bar');if(!bar)return;
  const label=bar.querySelector('.pb-label');
  if(label)label.textContent=msg;
  bar.classList.add('active');
  clearTimeout(_activityTimer);
  if(durationMs){_activityTimer=setTimeout(()=>bar.classList.remove('active'),durationMs)}
}
function _hideActivity(){
  const bar=$('#padi-bar');if(bar)bar.classList.remove('active');
  clearTimeout(_activityTimer);
}

// ═══ ORCHESTRATOR ═══

async function init(){
  try{
    _showActivity('Loading learned data...');
    const loaded=await tfidf.load();
    await bayes.load();
    await graph.load();
    if(!loaded&&S.lib.length){_showActivity('Building paper index ('+S.lib.length+' papers)...');tfidf.buildFull(S.lib)}
    else if(!loaded){_hideActivity()}
    else if(loaded){
      // Check for new papers not in the index
      const missing=S.lib.filter(p=>!tfidf.docVecs.has(p.id));
      missing.forEach(p=>tfidf.addDoc(p));
      // Check for removed papers still in the index
      const libIds=new Set(S.lib.map(p=>p.id));
      const staleIds=[];
      tfidf.docVecs.forEach((_,id)=>{if(!libIds.has(id))staleIds.push(id)});
      staleIds.forEach(id=>tfidf.removeDoc(id));
    }
    if(!bayes._trained&&S.lib.length>=5)bayes.train();
    else _showActivity('PADI ready — '+tfidf.N+' papers, '+tfidf.vocab.size+' terms',2500);
    _updateStatus();
  }catch(e){console.warn('PADI init error:',e);_hideActivity()}
}

function onPaperSaved(paper){
  tfidf.addDoc(paper);
  _engagement.track(paper.id,'view');
  // If a search was active, record the save for the graph
  const q=$('#lq')?.value?.trim();
  if(q)graph.recordSave(q,paper.id);
  _updateStatus();
}

function onPaperRemoved(paperId){
  tfidf.removeDoc(paperId);
  _updateStatus();
}

function onScreened(paperId,decision){
  const paper=S.lib.find(p=>p.id===paperId);
  if(paper)bayes.trainIncremental(paper,decision);
  _engagement.track(paperId,'view');
  _updateStatus();
}

function scoreResults(){
  if(!bayes._trained||!_litAllResults)return;
  // Score only the currently visible page of results
  setTimeout(()=>{
    const cards=document.querySelectorAll('.pc');
    const perPage=20;
    const start=(_litPage||0)*perPage;
    const page=_litAllResults.slice(start,start+perPage);
    page.forEach((p,i)=>{
      if(i>=cards.length)return;
      const pred=bayes.predict(p);
      if(!pred)return;
      const badge=_badgeHTML(pred);
      const h3=cards[i]?.querySelector('h3');
      if(h3&&!h3.querySelector('[data-padi-badge]')){
        const span=document.createElement('span');
        span.dataset.padiBadge='1';
        span.innerHTML=badge;
        h3.appendChild(span);
      }
    });
  },100);
}

function graphRecordQuery(queryText){
  graph.recordQuery(queryText);
}

function engTrack(id,event,meta){
  _engagement.track(id,event,meta);
  if(event==='view')_trackViewStart(id);
}

function recommendSimilar(paperId){
  return tfidf.similar(paperId,5);
}

// ═══ SEARCH TERM SUGGESTION LISTENER ═══
// Persistent container lives in #litSearchRow (not .si-wrap) to avoid DOM
// mutations inside the input's parent flex container, which causes focus
// loss in WebKit/Safari during typing.
let _suggestTimer=null;
const lqEl=$('#lq');
if(lqEl){
  let _suggestEl=null;
  function _getSuggestEl(){
    if(!_suggestEl){
      _suggestEl=document.createElement('div');
      _suggestEl.id='padi-suggest';
      _suggestEl.style.cssText='position:absolute;left:0;right:0;top:100%;background:var(--bs);border:1px solid var(--bd);border-radius:0 0 6px 6px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.3);display:none';
      ($('#litSearchRow')||lqEl.parentElement).appendChild(_suggestEl);
    }
    return _suggestEl;
  }
  lqEl.addEventListener('input',function(){
    clearTimeout(_suggestTimer);
    hi(_getSuggestEl());
    _suggestTimer=setTimeout(()=>{
      const el=_getSuggestEl();
      const val=lqEl.value.trim();
      if(!val||graph.nodes.size<3){hi(el);return}
      const terms=val.split(/\s+/);
      const suggestions=graph.suggest(terms,5);
      if(!suggestions.length){hi(el);return}
      el.innerHTML=_termSuggestionDropdown(suggestions);
      sh(el);
    },400);
  });
  lqEl.addEventListener('blur',()=>{setTimeout(()=>hi(_getSuggestEl()),200)});
}

// Public API
return{
  init,tokenize,tfidf,bayes,graph,engTrack,
  onPaperSaved,onPaperRemoved,onScreened,
  scoreResults,graphRecordQuery,recommendSimilar,
  status:_status,
  _engagement,
  showActivity:_showActivity,hideActivity:_hideActivity,
  // UI helpers for renderLib integration
  statusHTML:_statusHTML,
  profileHTML:_profileHTML,
  similarHTML:_similarHTML,
  badgeHTML:_badgeHTML
};
})();

// ═══ END PADI ═══

