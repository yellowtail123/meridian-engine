// ═══════════════════════════════════════════════════════════════════════════
// MERIDIAN BOOLEAN SEARCH — Parser, API translators, syntax highlighting
// ═══════════════════════════════════════════════════════════════════════════
// Supports: AND, OR, NOT, "exact phrases", (grouping), wildcards*, field:value
// Backward-compatible: plain queries without operators work exactly as before.

const BoolSearch=(function(){
'use strict';

// ── Token types ──
const T={AND:'AND',OR:'OR',NOT:'NOT',LP:'(',RP:')',TERM:'TERM',PHRASE:'PHRASE',FIELD:'FIELD',WILD:'WILD'};
const FIELDS=['author','title','journal','year','doi','abstract'];

// ═══ TOKENIZER ═══
function tokenize(input){
  const tokens=[];
  let i=0;const s=input;
  while(i<s.length){
    if(/\s/.test(s[i])){i++;continue}
    // Parentheses
    if(s[i]==='('){tokens.push({type:T.LP,pos:i,len:1});i++;continue}
    if(s[i]===')'){tokens.push({type:T.RP,pos:i,len:1});i++;continue}
    // Quoted string
    if(s[i]==='"'){
      const st=i;i++;
      while(i<s.length&&s[i]!=='"')i++;
      const closed=i<s.length;
      if(closed)i++;
      const val=s.slice(st+1,closed?i-1:i);
      tokens.push({type:T.PHRASE,value:val,pos:st,len:i-st,closed});
      continue;
    }
    // Word
    const st=i;
    while(i<s.length&&!/[\s()"]/.test(s[i]))i++;
    const word=s.slice(st,i);
    // Field:value or field:"quoted"
    const ci=word.indexOf(':');
    if(ci>0){
      const fld=word.slice(0,ci).toLowerCase();
      if(FIELDS.includes(fld)){
        let val=word.slice(ci+1);
        // field:"quoted value"
        if(!val&&i<s.length&&s[i]==='"'){
          i++;const qs=i;
          while(i<s.length&&s[i]!=='"')i++;
          val=s.slice(qs,i);
          if(i<s.length)i++;
        }
        tokens.push({type:T.FIELD,field:fld,value:val,pos:st,len:i-st});
        continue;
      }
    }
    const up=word.toUpperCase();
    if(up==='AND'){tokens.push({type:T.AND,pos:st,len:word.length});continue}
    if(up==='OR'){tokens.push({type:T.OR,pos:st,len:word.length});continue}
    if(up==='NOT'){tokens.push({type:T.NOT,pos:st,len:word.length});continue}
    if(word.includes('*')){tokens.push({type:T.WILD,value:word,pos:st,len:word.length});continue}
    tokens.push({type:T.TERM,value:word,pos:st,len:word.length});
  }
  return tokens;
}

// ═══ PARSER — recursive descent, precedence: NOT > AND > OR ═══
function parse(tokens){
  let pos=0;
  function peek(){return pos<tokens.length?tokens[pos]:null}
  function advance(){return tokens[pos++]}
  function isTermStart(t){return t&&(t.type===T.TERM||t.type===T.PHRASE||t.type===T.WILD||t.type===T.FIELD||t.type===T.LP||t.type===T.NOT)}

  function parseOr(){
    let left=parseAnd();
    while(peek()?.type===T.OR){
      advance();
      left={type:'OR',left,right:parseAnd()};
    }
    return left;
  }
  function parseAnd(){
    let left=parseNot();
    while(true){
      const nx=peek();
      if(!nx||nx.type===T.OR||nx.type===T.RP)break;
      if(nx.type===T.AND){advance();} // explicit AND
      else if(!isTermStart(nx))break;  // not implicit AND
      left={type:'AND',left,right:parseNot()};
    }
    return left;
  }
  function parseNot(){
    if(peek()?.type===T.NOT){
      advance();
      return{type:'NOT',child:parsePrimary()};
    }
    return parsePrimary();
  }
  function parsePrimary(){
    const t=peek();
    if(!t)return{type:'TERM',value:''};
    if(t.type===T.LP){
      advance();
      const expr=parseOr();
      if(peek()?.type===T.RP)advance();
      return expr;
    }
    if(t.type===T.FIELD){advance();return{type:'FIELD',field:t.field,value:t.value}}
    if(t.type===T.PHRASE){advance();return{type:'PHRASE',value:t.value}}
    if(t.type===T.WILD){advance();return{type:'WILD',value:t.value}}
    if(t.type===T.TERM){advance();return{type:'TERM',value:t.value}}
    // Unexpected token — skip
    advance();
    return{type:'TERM',value:''};
  }
  if(!tokens.length)return{type:'TERM',value:''};
  const ast=parseOr();
  return ast;
}

// ═══ DETECT if query uses Boolean syntax ═══
function isBoolean(q){
  if(!q)return false;
  return/\b(AND|OR|NOT)\b/i.test(q)||/".+"/.test(q)||/[()]/.test(q)||/\w\*/.test(q)||/\b(author|title|journal|year|doi|abstract):/i.test(q);
}

// ═══ COLLECT positive terms (for result highlighting) ═══
function positiveTerms(ast){
  const terms=[];
  function walk(n){
    if(!n)return;
    if(n.type==='NOT')return; // skip negated
    if(n.type==='TERM')terms.push(n.value);
    if(n.type==='PHRASE')terms.push(n.value);
    if(n.type==='WILD')terms.push(n.value.replace(/\*/g,''));
    if(n.type==='FIELD'&&n.field!=='year'&&n.field!=='doi')terms.push(n.value);
    if(n.left)walk(n.left);
    if(n.right)walk(n.right);
  }
  walk(ast);
  return terms.filter(t=>t.length>=2);
}

// ═══ COLLECT NOT terms (for client-side filtering) ═══
function notTerms(ast){
  const terms=[];
  function walk(n){
    if(!n)return;
    if(n.type==='NOT'){
      collectLeaves(n.child,terms);
      return;
    }
    if(n.left)walk(n.left);
    if(n.right)walk(n.right);
  }
  function collectLeaves(n,arr){
    if(!n)return;
    if(n.type==='TERM'||n.type==='PHRASE')arr.push(n.value.toLowerCase());
    if(n.type==='WILD')arr.push(n.value.toLowerCase());
    if(n.left)collectLeaves(n.left,arr);
    if(n.right)collectLeaves(n.right,arr);
  }
  walk(ast);
  return terms;
}

// ═══ COLLECT field filters ═══
function fieldFilters(ast){
  const fields={};
  function walk(n){
    if(!n)return;
    if(n.type==='FIELD')fields[n.field]=n.value;
    if(n.left)walk(n.left);
    if(n.right)walk(n.right);
  }
  walk(ast);
  return fields;
}

// ═══ FLATTEN OR branches ═══
// Returns array of sub-ASTs, one per OR branch
function orBranches(ast){
  if(ast.type==='OR'){
    return[...orBranches(ast.left),...orBranches(ast.right)];
  }
  return[ast];
}

// ═══ AST → plain query string (strips NOT/field nodes) ═══
function astToPlain(ast){
  if(!ast)return'';
  if(ast.type==='TERM')return ast.value;
  if(ast.type==='PHRASE')return'"'+ast.value+'"';
  if(ast.type==='WILD')return ast.value.replace(/\*/g,'');
  if(ast.type==='FIELD')return''; // handled separately
  if(ast.type==='NOT')return'';   // excluded from API query
  if(ast.type==='AND'){
    const l=astToPlain(ast.left),r=astToPlain(ast.right);
    return[l,r].filter(Boolean).join(' ');
  }
  if(ast.type==='OR'){
    const l=astToPlain(ast.left),r=astToPlain(ast.right);
    return[l,r].filter(Boolean).join(' ');
  }
  return'';
}

// ═══ API-SPECIFIC QUERY BUILDERS ═══

// OpenAlex: uses search param + filter syntax
function toOpenAlex(branch,fields){
  const q=astToPlain(branch);
  const filters=[];
  if(fields.title)filters.push('title.search:'+fields.title);
  if(fields.author)filters.push('author.search:'+fields.author);
  if(fields.journal)filters.push('primary_location.source.display_name.search:'+fields.journal);
  return{search:q||undefined,extraFilters:filters};
}

// CrossRef: uses query.bibliographic + query.title/query.author
function toCrossRef(branch,fields){
  const q=astToPlain(branch);
  const params={};
  if(q)params['query.bibliographic']=q;
  if(fields.title)params['query.title']=fields.title;
  if(fields.author)params['query.author']=fields.author;
  // If only field searches and no general query, use query param
  if(!q&&!params['query.title']&&!params['query.author']){
    const allVals=Object.values(fields).filter(Boolean).join(' ');
    if(allVals)params['query.bibliographic']=allVals;
  }
  return params;
}

// PubMed: supports full Boolean natively
function toPubMed(ast){
  function conv(n){
    if(!n)return'';
    if(n.type==='TERM')return n.value;
    if(n.type==='PHRASE')return'"'+n.value+'"';
    if(n.type==='WILD')return n.value;
    if(n.type==='FIELD'){
      const map={author:'[au]',title:'[ti]',journal:'[ta]',year:'[dp]',doi:'[aid]',abstract:'[tiab]'};
      return n.value+(map[n.field]||'');
    }
    if(n.type==='NOT')return'NOT '+conv(n.child);
    if(n.type==='AND'){
      const l=conv(n.left),r=conv(n.right);
      if(!l)return r;if(!r)return l;
      return'('+l+' AND '+r+')';
    }
    if(n.type==='OR'){
      const l=conv(n.left),r=conv(n.right);
      if(!l)return r;if(!r)return l;
      return'('+l+' OR '+r+')';
    }
    return'';
  }
  return conv(ast);
}

// Semantic Scholar: basic keyword query
function toSemScholar(branch,fields){
  const parts=[];
  const q=astToPlain(branch);
  if(q)parts.push(q);
  if(fields.title)parts.push(fields.title);
  if(fields.author)parts.push(fields.author);
  return parts.join(' ');
}

// bioRxiv/ESSOAr: simple text, client-side filter
function toSimple(branch,fields){
  const parts=[];
  const q=astToPlain(branch);
  if(q)parts.push(q);
  Object.values(fields).forEach(v=>{if(v)parts.push(v)});
  return parts.join(' ');
}

// ═══ FULL QUERY ANALYSIS ═══
// Returns everything litSearch needs
function analyze(raw){
  if(!raw||!raw.trim())return null;
  const q=raw.trim();
  const isBool=isBoolean(q);

  if(!isBool){
    return{
      isBoolean:false,
      raw:q,
      branches:[q],
      notTerms:[],
      fields:{},
      positiveTerms:q.split(/\s+/).filter(t=>t.length>=2),
      pubmed:q,
      perEngine:null
    };
  }

  const tokens=tokenize(q);
  const ast=parse(tokens);
  const nots=notTerms(ast);
  const fields=fieldFilters(ast);
  const branches=orBranches(ast);
  const posTms=positiveTerms(ast);

  // Build per-engine queries for each OR branch
  const perEngine={OA:[],SS:[],CR:[],PM:[],ES:[],BR:[]};
  branches.forEach(br=>{
    const oa=toOpenAlex(br,fields);
    perEngine.OA.push(oa);
    perEngine.SS.push(toSemScholar(br,fields));
    const cr=toCrossRef(br,fields);
    perEngine.CR.push(cr);
    perEngine.ES.push(toSimple(br,fields));
    perEngine.BR.push(toSimple(br,fields));
  });
  // PubMed gets the full Boolean query (it supports it natively)
  perEngine.PM=[toPubMed(ast)];

  return{
    isBoolean:true,
    raw:q,
    ast,
    tokens,
    branches:branches.map(br=>astToPlain(br)).filter(Boolean),
    notTerms:nots,
    fields,
    positiveTerms:posTms,
    pubmed:toPubMed(ast),
    perEngine
  };
}

// ═══ CLIENT-SIDE NOT FILTER ═══
function applyNotFilter(results,nots){
  if(!nots||!nots.length)return{filtered:results,excluded:0};
  const before=results.length;
  const filtered=results.filter(r=>{
    const hay=((r.title||'')+' '+(r.abstract||'')).toLowerCase();
    return!nots.some(term=>{
      if(term.includes('*')){
        const re=new RegExp(term.replace(/\*/g,'.*'),'i');
        return re.test(hay);
      }
      return hay.includes(term);
    });
  });
  return{filtered,excluded:before-filtered.length};
}

// ═══ CLIENT-SIDE WILDCARD FILTER ═══
function matchesWildcard(text,pattern){
  const re=new RegExp('^'+pattern.replace(/\*/g,'.*')+'$','i');
  return re.test(text);
}

// ═══ CLIENT-SIDE FIELD FILTER ═══
function applyFieldFilter(results,fields){
  if(!fields||!Object.keys(fields).length)return results;
  return results.filter(r=>{
    for(const[fld,val]of Object.entries(fields)){
      const v=val.toLowerCase();
      if(fld==='author'){
        if(!(r.authors||[]).some(a=>a.toLowerCase().includes(v)))return false;
      }else if(fld==='title'){
        if(!(r.title||'').toLowerCase().includes(v))return false;
      }else if(fld==='journal'){
        if(!(r.journal||'').toLowerCase().includes(v))return false;
      }else if(fld==='year'){
        if(String(r.year||'')!==val)return false;
      }else if(fld==='doi'){
        if(!(r.doi||'').toLowerCase().includes(v))return false;
      }else if(fld==='abstract'){
        if(!(r.abstract||'').toLowerCase().includes(v))return false;
      }
    }
    return true;
  });
}

// ═══ QUERY VALIDATION ═══
function validate(raw){
  const errors=[];
  if(!raw||!raw.trim())return errors;
  const s=raw.trim();

  // Unmatched parentheses
  let depth=0,unmatchedOpen=-1,unmatchedClose=-1;
  for(let i=0;i<s.length;i++){
    if(s[i]==='('){if(depth===0)unmatchedOpen=i;depth++}
    if(s[i]===')'){depth--;if(depth<0){unmatchedClose=i;depth=0}}
  }
  if(depth>0)errors.push({pos:unmatchedOpen,msg:'Unmatched opening parenthesis'});
  if(unmatchedClose>=0)errors.push({pos:unmatchedClose,msg:'Unmatched closing parenthesis'});

  // Unmatched quotes
  const quoteCount=(s.match(/"/g)||[]).length;
  if(quoteCount%2!==0){
    const lastQ=s.lastIndexOf('"');
    errors.push({pos:lastQ,msg:'Unmatched quotation mark'});
  }

  // Operator at start (except NOT)
  if(/^\s*(AND|OR)\b/i.test(s)){
    errors.push({pos:0,msg:'Missing search term before '+ s.match(/^\s*(AND|OR)/i)[1].toUpperCase()});
  }
  // Operator at end
  const endMatch=s.match(/\b(AND|OR|NOT)\s*$/i);
  if(endMatch){
    errors.push({pos:s.length-endMatch[0].length,msg:'Missing search term after '+endMatch[1].toUpperCase()});
  }
  // Double operators
  const dblMatch=s.match(/\b(AND|OR|NOT)\s+(AND|OR)\b/i);
  if(dblMatch){
    const idx=s.indexOf(dblMatch[0]);
    errors.push({pos:idx,msg:'Adjacent operators: '+dblMatch[1].toUpperCase()+' '+dblMatch[2].toUpperCase()});
  }
  // Empty field value
  const emptyField=s.match(/\b(author|title|journal|year|doi|abstract):\s*(?=\s|$|AND|OR|NOT)/i);
  if(emptyField){
    const idx=s.indexOf(emptyField[0]);
    errors.push({pos:idx,msg:'Missing value after '+emptyField[1]+':'});
  }

  return errors;
}

// ═══ SYNTAX HIGHLIGHTING ═══
function highlight(raw){
  if(!raw)return'';
  const tokens=tokenize(raw);
  // Build highlighted HTML by walking through original string
  let html='';
  let last=0;
  tokens.forEach(tk=>{
    // Gap between tokens (spaces)
    if(tk.pos>last)html+=escH(raw.slice(last,tk.pos));
    const chunk=raw.slice(tk.pos,tk.pos+tk.len);
    switch(tk.type){
      case T.AND:case T.OR:case T.NOT:
        html+='<span class="bh-op">'+escH(chunk)+'</span>';break;
      case T.PHRASE:
        html+='<span class="bh-phrase">'+escH(chunk)+'</span>';break;
      case T.FIELD:
        // Color the field prefix and the value separately
        const colonPos=chunk.indexOf(':');
        html+='<span class="bh-field">'+escH(chunk.slice(0,colonPos+1))+'</span>'+escH(chunk.slice(colonPos+1));
        break;
      case T.LP:case T.RP:
        html+='<span class="bh-paren">'+escH(chunk)+'</span>';break;
      case T.WILD:
        html+=escH(chunk.replace(/\*/g,''))+'<span class="bh-op">*</span>';break;
      default:
        html+=escH(chunk);
    }
    last=tk.pos+tk.len;
  });
  if(last<raw.length)html+=escH(raw.slice(last));
  return html;
}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

// ═══ INIT UI ═══
// Called once after DOM ready — sets up the highlight overlay, chips, tooltip, validation
function initUI(){
  const row=$('#litSearchRow');
  const wrap=row?.querySelector('.si-wrap');
  const input=$('#lq');
  if(!row||!wrap||!input)return;

  // ── Syntax highlight mirror ──
  const mirror=document.createElement('div');
  mirror.id='bool-mirror';
  mirror.setAttribute('aria-hidden','true');
  wrap.insertBefore(mirror,input);

  // ── Validation hint ──
  const vHint=document.createElement('div');
  vHint.id='bool-validation';
  row.parentNode.insertBefore(vHint,row.nextSibling);

  // ── Helper chips ──
  const chips=document.createElement('div');
  chips.id='bool-chips';
  chips.innerHTML=['AND','OR','NOT','&quot; &quot;','( )','author:','title:','year:','journal:'].map(label=>{
    const insert=label.replace(/&quot;/g,'"');
    return'<button type="button" class="bool-chip" data-insert="'+escH(insert)+'">'+label+'</button>';
  }).join('');
  // Insert chips after the batch import link row
  const batchRow=row.nextElementSibling;
  if(batchRow&&batchRow.querySelector('.lit-batch-link')){
    batchRow.parentNode.insertBefore(chips,batchRow);
  }else{
    row.parentNode.insertBefore(chips,row.nextSibling);
  }
  // Move validation hint after chips
  chips.parentNode.insertBefore(vHint,chips.nextSibling);

  // Chip click handler
  chips.addEventListener('click',e=>{
    const btn=e.target.closest('.bool-chip');
    if(!btn)return;
    const ins=btn.dataset.insert;
    const pos=input.selectionStart||input.value.length;
    const before=input.value.slice(0,pos);
    const after=input.value.slice(pos);
    const needSpace=before.length&&!/\s$/.test(before);
    const trailSpace=after.length&&!/^\s/.test(after);
    const text=(needSpace?' ':'')+ins+(trailSpace?' ':'');
    input.value=before+text+after;
    const newPos=pos+text.length;
    input.setSelectionRange(newPos,newPos);
    input.focus();
    updateMirror();
  });

  // ── Search tips tooltip (? button) ──
  const tipBtn=document.createElement('button');
  tipBtn.type='button';
  tipBtn.id='bool-tips-btn';
  tipBtn.className='bt sm';
  tipBtn.textContent='?';
  tipBtn.title='Boolean search tips';
  tipBtn.setAttribute('aria-label','Boolean search tips');
  // Insert after the Search button
  const searchBtn=$('#lsb');
  if(searchBtn)searchBtn.after(tipBtn);

  const tipCard=document.createElement('div');
  tipCard.id='bool-tips-card';
  tipCard.innerHTML=`<div class="btc-title">Boolean Search Tips</div>
<div class="btc-row"><code>coral AND bleaching</code><span>both terms required</span></div>
<div class="btc-row"><code>tuna OR mackerel</code><span>either term</span></div>
<div class="btc-row"><code>shark NOT whale</code><span>exclude a term</span></div>
<div class="btc-row"><code>"sea surface temperature"</code><span>exact phrase</span></div>
<div class="btc-row"><code>(coral OR reef) AND climate</code><span>group terms</span></div>
<div class="btc-row"><code>author:Smith AND year:2024</code><span>field search</span></div>
<div class="btc-row"><code>fish*</code><span>wildcard matching</span></div>
<div class="btc-note">Operators are case-insensitive. Simple searches still work as before.</div>`;
  row.appendChild(tipCard);

  tipBtn.addEventListener('click',e=>{
    e.stopPropagation();
    tipCard.classList.toggle('open');
  });
  document.addEventListener('click',e=>{
    if(!tipCard.contains(e.target)&&e.target!==tipBtn)tipCard.classList.remove('open');
  });

  // ── Mirror updates ──
  function updateMirror(){
    const val=input.value;
    if(!val){
      mirror.innerHTML='';
      mirror.style.display='none';
      input.style.color='';
      input.style.caretColor='';
      vHint.style.display='none';
      return;
    }
    if(isBoolean(val)){
      mirror.innerHTML=highlight(val);
      mirror.style.display='';
      input.style.color='transparent';
      input.style.caretColor='var(--ts)';
      // Validation
      const errs=validate(val);
      if(errs.length){
        vHint.textContent=errs[0].msg;
        vHint.style.display='';
      }else{
        vHint.style.display='none';
      }
    }else{
      mirror.innerHTML='';
      mirror.style.display='none';
      input.style.color='';
      input.style.caretColor='';
      vHint.style.display='none';
    }
  }

  input.addEventListener('input',updateMirror);
  input.addEventListener('focus',updateMirror);
  input.addEventListener('blur',()=>{
    // Keep mirror visible if there's Boolean content
    if(!input.value||!isBoolean(input.value)){
      mirror.style.display='none';
      input.style.color='';
      input.style.caretColor='';
    }
  });

  // Sync scroll
  input.addEventListener('scroll',()=>{mirror.scrollLeft=input.scrollLeft});
}

// ═══ PUBLIC API ═══
return{
  tokenize,parse,isBoolean,analyze,validate,highlight,
  positiveTerms,notTerms,fieldFilters,orBranches,
  applyNotFilter,applyFieldFilter,matchesWildcard,
  toPubMed,toOpenAlex,toCrossRef,toSemScholar,toSimple,
  astToPlain,initUI,
  FIELDS
};
})();

// Init UI when DOM is ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>BoolSearch.initUI());
}else{
  // Script loaded after DOMContentLoaded — run immediately
  // Use setTimeout to ensure other scripts have initialized first
  setTimeout(()=>BoolSearch.initUI(),0);
}
