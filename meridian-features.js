// ═══ MERIDIAN FEATURES — Extended Features Module ═══
// AI agent, map tools, citation graph, gap analysis, library enhancements

// ═══ AI — Multi-Provider Support ═══
// Gemini CORS proxy fallback — set to your deployed worker URL, or empty to skip
const _GEMINI_PROXY = location.hostname === 'meridian-engine.com' || location.hostname === 'www.meridian-engine.com'
  ? '/api/gemini/' : '';
function _geminiUrl(model, action) {
  const path = `models/${model}:${action}`;
  return {
    direct: `https://generativelanguage.googleapis.com/v1beta/${path}`,
    proxy: _GEMINI_PROXY ? `${_GEMINI_PROXY}${path}` : null
  };
}
const AI_PROVIDERS={
  anthropic:{name:'Anthropic (Claude)',displayModels:{'claude-sonnet-4-20250514':'Claude Sonnet 4','claude-haiku-4-5-20251001':'Claude Haiku 4.5'},placeholder:'sk-ant-...',models:['claude-sonnet-4-20250514','claude-haiku-4-5-20251001'],defaultModel:'claude-sonnet-4-20250514'},
  openai:{name:'OpenAI (GPT)',displayModels:{'gpt-4o':'GPT-4o','gpt-4o-mini':'GPT-4o Mini'},placeholder:'sk-...',models:['gpt-4o','gpt-4o-mini'],defaultModel:'gpt-4o'},
  google:{name:'Google (Gemini)',displayModels:{'gemini-2.0-flash':'Gemini 2.0 Flash','gemini-1.5-pro':'Gemini 1.5 Pro'},placeholder:'AIza...',models:['gemini-2.0-flash','gemini-1.5-pro'],defaultModel:'gemini-2.0-flash'}
};
// ═══ Unified model selector — populates all provider dropdowns ═══
function _buildProviderOptions(){
  let html='';
  for(const[prov,info]of Object.entries(AI_PROVIDERS)){
    for(const m of info.models){
      const display=info.displayModels?.[m]||m;
      html+=`<option value="${prov}:${m}">${display}</option>`;
    }
  }
  return html;
}
function _syncAllProviderDropdowns(){
  const val=S.aiProvider+':'+S.aiModel;
  const opts=_buildProviderOptions();
  ['#aip','#fc-provider'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    el.innerHTML=opts;
    if(el.querySelector(`option[value="${val}"]`))el.value=val;
  });
}
function _onProviderChange(val){
  const[prov,model]=val.split(':');
  S.aiProvider=prov;S.aiModel=model;
  safeStore('meridian_provider',prov);
  safeStore('meridian_model_'+prov,model);
  _syncAllProviderDropdowns();
  if(typeof _updateCtxProviderInfo==='function')_updateCtxProviderInfo();
  // Load key for this provider
  _keyVault.retrieve('meridian_key_'+prov).then(sk=>{
    S.apiK=sk||'';
    const aki=$('#aki');if(aki)aki.value=sk||'';
    _updateKeyPromptVisibility();
  });
}
function _updateKeyPromptVisibility(){
  const fcPrompt=$('#fc-key-prompt');
  const fcProvName=$('#fc-key-provider-name');
  if(fcPrompt){
    if(!S.apiK){
      fcPrompt.style.display='';
      if(fcProvName)fcProvName.textContent=AI_PROVIDERS[S.aiProvider]?.name||S.aiProvider;
      const fcAki=$('#fc-aki');if(fcAki)fcAki.placeholder=AI_PROVIDERS[S.aiProvider]?.placeholder||'API key...';
    }else{
      fcPrompt.style.display='none';
    }
  }
  const aki=$('#aki');
  if(aki){aki.placeholder=AI_PROVIDERS[S.aiProvider]?.placeholder||'sk-...';}
  /* 3A: Toggle onboarding card vs connected chat */
  const ob=$('#ai-onboard'),conn=$('#ai-connected'),sb=$('#ai-sb-info');
  if(ob&&conn){
    if(S.apiK){
      ob.style.display='none';conn.style.display='flex';
      if(sb){const prov=AI_PROVIDERS[S.aiProvider];sb.textContent=(prov?.name||S.aiProvider)+' \u00B7 '+(prov?.displayModels?.[S.aiModel]||S.aiModel)+' \u00B7 Connected \u2713'}
    }else{
      ob.style.display='flex';conn.style.display='none';
    }
  }
}
/* 3A: Onboarding helpers */
function _aiShowOnboard(){S.apiK='';_updateKeyPromptVisibility();const aki=$('#aki');if(aki){aki.value='';aki.focus()}}
function _onObProviderChange(prov){
  _onProviderChange(prov);
  const ms=$('#ai-ob-model');if(!ms)return;
  const info=AI_PROVIDERS[prov];if(!info)return;
  ms.innerHTML=info.models.map(m=>`<option value="${m}"${m===info.defaultModel?' selected':''}>${info.displayModels?.[m]||m}</option>`).join('');
}
function _initOnboardDropdowns(){
  const ps=$('#ai-ob-provider');if(!ps)return;
  ps.innerHTML=Object.entries(AI_PROVIDERS).map(([k,v])=>`<option value="${k}"${k===S.aiProvider?' selected':''}>${v.name}</option>`).join('');
  _onObProviderChange(S.aiProvider);
}
async function updateAIProvider(prov){
  prov=prov||S.aiProvider||'anthropic';
  S.aiProvider=prov;
  const info=AI_PROVIDERS[prov];if(!info)return;
  if(!S.aiModel||!info.models.includes(S.aiModel))S.aiModel=info.defaultModel;
  _syncAllProviderDropdowns();
  const saved=await _keyVault.retrieve('meridian_key_'+prov);
  S.apiK=saved||'';
  const aki=$('#aki');if(aki)aki.value=saved||'';
  _updateKeyPromptVisibility();
}
async function callAI({messages,system,tools,maxTokens=4096,signal}){
  const prov=S.aiProvider||'anthropic',model=S.aiModel||AI_PROVIDERS[prov].defaultModel,key=S.apiK;
  if(prov==='anthropic'){
    const body={model,max_tokens:maxTokens,messages};
    if(system)body.system=system;if(tools?.length)body.tools=tools;
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body),signal});
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    return await r.json();
  }
  if(prov==='google'){
    const gc=[];
    for(const m of messages){
      if(m.role==='user'){
        if(Array.isArray(m.content)&&m.content[0]?.type==='tool_result'){
          gc.push({role:'user',parts:m.content.map(tr=>({functionResponse:{name:tr._name||'tool',response:JSON.parse(typeof tr.content==='string'?tr.content:'{}')}}))});
        }else gc.push({role:'user',parts:[{text:typeof m.content==='string'?m.content:JSON.stringify(m.content)}]});
      }else if(m.role==='assistant'){
        const parts=[];
        if(Array.isArray(m.content)){m.content.forEach(b=>{if(b.type==='text'&&b.text)parts.push({text:b.text});if(b.type==='tool_use')parts.push({functionCall:{name:b.name,args:b.input}})})}
        else if(m.content)parts.push({text:m.content});
        if(parts.length)gc.push({role:'model',parts});
      }
    }
    const body={contents:gc,generationConfig:{maxOutputTokens:maxTokens}};
    if(system)body.systemInstruction={parts:[{text:system}]};
    if(tools?.length)body.tools=[{functionDeclarations:tools.map(t=>({name:t.name,description:t.description,parameters:t.input_schema}))}];
    const urls=_geminiUrl(model,'generateContent');
    let r;
    try{r=await fetch(urls.direct,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal})}
    catch(corsErr){if(urls.proxy){r=await fetch(urls.proxy+'?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})}else throw corsErr}
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    const data=await r.json();if(!data.candidates?.length)throw new Error('No response from Gemini');
    const parts=data.candidates[0].content?.parts||[],content=[];
    for(const p of parts){if(p.text)content.push({type:'text',text:p.text});if(p.functionCall)content.push({type:'tool_use',id:'gem_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name:p.functionCall.name,input:p.functionCall.args||{}})}
    return{content,stop_reason:content.some(c=>c.type==='tool_use')?'tool_use':'end_turn'};
  }
  // OpenAI
  if(prov==='openai'){
    const oaiMsgs=[];if(system)oaiMsgs.push({role:'system',content:system});
    for(const m of messages){
      if(m.role==='user'){
        if(Array.isArray(m.content)&&m.content[0]?.type==='tool_result'){
          for(const tr of m.content)oaiMsgs.push({role:'tool',tool_call_id:tr.tool_use_id,content:typeof tr.content==='string'?tr.content:JSON.stringify(tr.content)});
        }else oaiMsgs.push({role:'user',content:typeof m.content==='string'?m.content:JSON.stringify(m.content)});
      }else if(m.role==='assistant'){
        if(Array.isArray(m.content)){
          const txt=m.content.filter(b=>b.type==='text').map(b=>b.text).join('');
          const tcs=m.content.filter(b=>b.type==='tool_use');
          const msg={role:'assistant',content:txt||null};
          if(tcs.length)msg.tool_calls=tcs.map(tc=>({id:tc.id,type:'function',function:{name:tc.name,arguments:JSON.stringify(tc.input)}}));
          oaiMsgs.push(msg);
        }else oaiMsgs.push({role:'assistant',content:m.content});
      }
    }
    const body={model,max_tokens:maxTokens,messages:oaiMsgs};
    if(tools?.length)body.tools=tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.input_schema}}));
    const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body),signal});
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    const data=await r.json();if(!data.choices?.[0])throw new Error('No response from OpenAI');
    const ch=data.choices[0],content=[];
    if(ch.message.content)content.push({type:'text',text:ch.message.content});
    if(ch.message.tool_calls)for(const tc of ch.message.tool_calls){try{content.push({type:'tool_use',id:tc.id,name:tc.function.name,input:JSON.parse(tc.function.arguments)})}catch{content.push({type:'tool_use',id:tc.id,name:tc.function.name,input:{}})}}
    return{content,stop_reason:ch.finish_reason==='tool_calls'?'tool_use':'end_turn'};
  }
  throw new Error('Unknown provider: '+prov);
}
async function streamAI({messages,system,maxTokens=2000,onDelta}){
  const prov=S.aiProvider||'anthropic',model=S.aiModel||AI_PROVIDERS[prov].defaultModel,key=S.apiK;
  if(prov==='anthropic'){
    const body={model,max_tokens:maxTokens,stream:true,messages};if(system)body.system=system;
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    const reader=r.body.getReader(),dec=new TextDecoder();let text='';
    while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value,{stream:true});
      for(const line of chunk.split('\n')){if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();if(d==='[DONE]')continue;
        try{const ev=JSON.parse(d);if(ev.type==='content_block_delta'&&ev.delta?.type==='text_delta'){text+=ev.delta.text;onDelta(text)}}catch{}}}
    return text;
  }
  if(prov==='google'){
    const gc=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    const body={contents:gc,generationConfig:{maxOutputTokens:maxTokens}};if(system)body.systemInstruction={parts:[{text:system}]};
    const urls=_geminiUrl(model,'streamGenerateContent');
    const streamDirect=urls.direct+'?alt=sse';const streamProxy=urls.proxy?(urls.proxy+'?key='+key+'&alt=sse'):null;
    let r;
    try{r=await fetch(streamDirect,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)})}
    catch(corsErr){if(streamProxy){r=await fetch(streamProxy,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}else throw corsErr}
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    const reader=r.body.getReader(),dec=new TextDecoder();let text='';
    while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value,{stream:true});
      for(const line of chunk.split('\n')){if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();
        try{const ev=JSON.parse(d);const pts=ev.candidates?.[0]?.content?.parts;if(pts)for(const p of pts)if(p.text){text+=p.text;onDelta(text)}}catch{}}}
    return text;
  }
  // OpenAI
  if(prov==='openai'){
    const oaiMsgs=[];if(system)oaiMsgs.push({role:'system',content:system});
    messages.forEach(m=>oaiMsgs.push({role:m.role,content:m.content}));
    const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model,max_tokens:maxTokens,stream:true,messages:oaiMsgs})});
    if(!r.ok){let em='HTTP '+r.status;try{const e=await r.json();em=e.error?.message||em}catch{}throw new Error(_scrubApiKeys(em))}
    const reader=r.body.getReader(),dec=new TextDecoder();let text='';
    while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value,{stream:true});
      for(const line of chunk.split('\n')){if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();if(d==='[DONE]')continue;
        try{const ev=JSON.parse(d);const delta=ev.choices?.[0]?.delta?.content;if(delta){text+=delta;onDelta(text)}}catch{}}}
    return text;
  }
  throw new Error('Unknown provider');
}

// ═══ AI — Research Buddy Agent ═══
const AGENT_TOOLS=[
  {name:'search_literature',description:'Search academic databases (OpenAlex, Semantic Scholar, CrossRef, PubMed) for papers. Returns titles, authors, year, journal, citations, OA status, abstracts. Use when the user asks about published research.',input_schema:{type:'object',properties:{query:{type:'string',description:'Search query'},year_from:{type:'integer',description:'Earliest publication year'},year_to:{type:'integer',description:'Latest publication year'},open_access_only:{type:'boolean',description:'Only OA papers'}},required:['query']}},
  {name:'search_grey_literature',description:'Search grey literature: FAO/UNEP documents, theses/dissertations, and marine agency reports (ICES, IUCN, NOAA, CSIRO). Use for non-journal sources and technical reports.',input_schema:{type:'object',properties:{query:{type:'string',description:'Search query'}},required:['query']}},
  {name:'lookup_species',description:'Look up a marine species. Returns taxonomy (WoRMS), GBIF+OBIS occurrence counts, biology (FishBase via proxy), vernacular names, ecological attributes, distribution localities, depth range, and year range of observations. Use when the user asks about a species.',input_schema:{type:'object',properties:{name:{type:'string',description:'Scientific name (e.g. Tursiops truncatus) or common name (e.g. blue whale)'}},required:['name']}},
  {name:'search_library',description:"Search the user's saved paper library. Returns matching papers with title, authors, year, journal, citations, tags, notes, and extracted findings. Use when the user refers to 'my papers' or 'my library'.",input_schema:{type:'object',properties:{query:{type:'string',description:'Search terms (matched against titles, abstracts, authors, concepts, tags). Empty string returns all.'}},required:['query']}},
  {name:'get_library_stats',description:"Get summary statistics about the user's library: total papers, year range, top journals, species mentioned, regions covered, methods used, and research gaps.",input_schema:{type:'object',properties:{},required:[]}},
  {name:'get_workshop_data',description:'Get the current Workshop dataset: columns, types, row count, and descriptive stats (mean, median, min, max, SD) for numeric columns. Optionally includes sample rows.',input_schema:{type:'object',properties:{include_sample_rows:{type:'boolean',description:'Include first 5 rows for context'}},required:[]}},
  {name:'screen_papers',description:'AI-assisted paper screening. Evaluates unscreened papers against user criteria and returns recommendations.',input_schema:{type:'object',properties:{criteria:{type:'string',description:'Inclusion criteria (e.g. "studies on coral bleaching with sample size > 30")'},limit:{type:'integer',description:'Max papers to screen (default 10)'}},required:['criteria']}},
  {name:'get_evidence_table',description:'Get accumulated evidence from extracted findings across library papers. Returns structured data about species, locations, methods, and findings.',input_schema:{type:'object',properties:{species_filter:{type:'string',description:'Filter by species name'},region_filter:{type:'string',description:'Filter by region name'}},required:[]}},
  {name:'get_screening_progress',description:'Get screening progress stats: total papers, screened count, included, excluded, maybe counts.',input_schema:{type:'object',properties:{},required:[]}},
  {name:'get_conservation_status',description:'Get conservation status of a marine species: IUCN Red List, CITES appendix, invasive status. Use when user asks about threatened/endangered status or conservation.',input_schema:{type:'object',properties:{name:{type:'string',description:'Species name (scientific or common)'}},required:['name']}},
  {name:'get_env_data',description:'Get environmental data (SST, chlorophyll, salinity, nutrients, etc.) for a location. Returns latest values or summary of time-series.',input_schema:{type:'object',properties:{lat:{type:'number',description:'Latitude'},lon:{type:'number',description:'Longitude'},variables:{type:'array',items:{type:'string'},description:'Variable IDs: sst, sst_anom, chlor, par, sal, npp, curr_u, curr_v, sla, co2, wh, wd, wp, sh, at, ws, pr, pp, cl, sr, hm, dhw, baa, hotspot, seaice, depth, slope'},start_date:{type:'string',description:'Start date YYYY-MM-DD'},end_date:{type:'string',description:'End date YYYY-MM-DD'}},required:['lat','lon']}},
  {name:'get_fisheries_data',description:'Get fisheries catch data for a species from Sea Around Us. Returns catch time-series if available.',input_schema:{type:'object',properties:{species:{type:'string',description:'Species name'}},required:['species']}},
  {name:'detect_marine_heatwaves',description:'Detect marine heatwave events from SST data at a location. Returns events with duration, intensity, and category.',input_schema:{type:'object',properties:{lat:{type:'number',description:'Latitude'},lon:{type:'number',description:'Longitude'},start_date:{type:'string',description:'Start date YYYY-MM-DD'},end_date:{type:'string',description:'End date YYYY-MM-DD'}},required:['lat','lon','start_date','end_date']}},
  {name:'compute_diversity',description:'Compute diversity indices (Shannon H\', Simpson 1-D, Pielou J, Chao1) from the current Workshop data.',input_schema:{type:'object',properties:{species_column:{type:'string',description:'Column containing species names'},abundance_column:{type:'string',description:'Column containing abundance counts'}},required:['species_column','abundance_column']}},
{name:'run_analysis',description:'Run a statistical analysis on the current Workshop data. Switches to Workshop tab and executes the specified test.',input_schema:{type:'object',properties:{test:{type:'string',description:'Test name: pca, permanova, anosim, kruskal_wallis, chi_squared, weight_length, selectivity, ypr, stock_recruitment, maturity_ogive, regime_shift, acf, diversity, rarefaction, dissimilarity, nmds, vbgf, catch_curve, surplus_production, meta_analysis, funnel_plot, indicator_species, power_analysis'}},required:['test']}},
{name:'check_data_quality',description:'Run data quality checks on loaded Workshop data, reporting missing values, outliers, and column types.',input_schema:{type:'object',properties:{}}},
{name:'run_sdm',description:'Run habitat suitability / species distribution model on Workshop data with lat, lon, and environmental columns.',input_schema:{type:'object',properties:{env_vars:{type:'string',description:'Comma-separated environmental variable column names'}}}},
{name:'run_trophic_network',description:'Visualize trophic/food web network from predator-prey data in Workshop.',input_schema:{type:'object',properties:{}}},
{name:'get_genetic_resources',description:'Get genetic sequence counts from NCBI (SRA, nucleotide, protein) for a species.',input_schema:{type:'object',properties:{species:{type:'string',description:'Scientific name'}},required:['species']}},
{name:'get_phylogeny',description:'Get taxonomic lineage from Open Tree of Life for a species.',input_schema:{type:'object',properties:{species:{type:'string',description:'Scientific name'}},required:['species']}},
  {name:'save_to_library',description:'Save a paper to the user\'s library by DOI or by providing title/authors/year. Returns confirmation.',input_schema:{type:'object',properties:{doi:{type:'string',description:'DOI of the paper'},title:{type:'string',description:'Paper title (if no DOI)'},authors:{type:'array',items:{type:'string'},description:'Author names'},year:{type:'integer',description:'Publication year'},journal:{type:'string',description:'Journal name'}},required:[]}},
  {name:'export_library',description:'Export the user\'s library as BibTeX, RIS, or JSON. Returns the export string.',input_schema:{type:'object',properties:{format:{type:'string',description:'Export format: bibtex, ris, or json (default bibtex)'}},required:[]}},
  {name:'compare_species',description:'Compare two marine species side by side: taxonomy, occurrences, depth ranges, biology.',input_schema:{type:'object',properties:{species_a:{type:'string',description:'First species name'},species_b:{type:'string',description:'Second species name'}},required:['species_a','species_b']}},
  {name:'get_current_environmental',description:'Get the environmental data currently loaded in the Env tab (already fetched by user). No API call needed.',input_schema:{type:'object',properties:{},required:[]}},
  {name:'recommend_test',description:'Recommend an appropriate statistical test for the user\'s workshop data given their research question.',input_schema:{type:'object',properties:{question:{type:'string',description:'Research question or goal (e.g. "compare lengths between sites", "correlate temperature and growth")'}},required:['question']}},
  {name:'calculate_sample_size',description:'Calculate required sample size given effect size, alpha, power, and test type.',input_schema:{type:'object',properties:{test:{type:'string',description:'Test type: t_test, anova, chi_squared, correlation'},effect_size:{type:'number',description:'Expected effect size (Cohen\'s d for t-test, f for ANOVA, w for chi-sq, r for correlation)'},alpha:{type:'number',description:'Significance level (default 0.05)'},power:{type:'number',description:'Desired power (default 0.8)'},groups:{type:'integer',description:'Number of groups (for ANOVA)'}},required:['test','effect_size']}},
  {name:'analyse_keywords',description:'Analyse keyword frequency and co-occurrence across the user\'s library papers.',input_schema:{type:'object',properties:{},required:[]}},
  {name:'find_gaps',description:'Identify research gaps from the user\'s library: under-represented species, regions, methods, or time periods.',input_schema:{type:'object',properties:{focus:{type:'string',description:'Focus area: species, regions, methods, temporal, or all (default all)'}},required:[]}},
  {name:'build_question',description:'Help build a structured research question using PICO/PEO framework from user input.',input_schema:{type:'object',properties:{topic:{type:'string',description:'Rough research topic or idea'},framework:{type:'string',description:'Framework: pico or peo (default pico)'}},required:['topic']}},
  {name:'search_datasets',description:'Search for open marine/environmental datasets from OBIS, GBIF, PANGAEA, and ERDDAP.',input_schema:{type:'object',properties:{query:{type:'string',description:'Search terms'}},required:['query']}},
  {name:'go_to_tab',description:'Navigate the Meridian app to a specific tab. Use when the user asks to "go to", "show me", or "open" a section.',input_schema:{type:'object',properties:{tab:{type:'string',description:'Tab ID: home, lit, library, gaps, graph, species, env, research, publications, archive, workshop, ecostats, studydesign, fielddata, ai, settings'},subtab:{type:'string',description:'Optional subtab for research tab: keywords, questions, gapmap, methods, samplesize'}},required:['tab']}},
  {name:'open_paper',description:'Open a specific paper from the library by title search. Shows its details in the Library tab.',input_schema:{type:'object',properties:{query:{type:'string',description:'Paper title or keywords to match'}},required:['query']}},
];
const TOOL_LABELS={search_literature:'Searching literature',search_grey_literature:'Searching grey literature',lookup_species:'Looking up species',search_library:'Searching library',get_library_stats:'Analyzing library',get_workshop_data:'Reading workshop data',screen_papers:'Screening papers',get_evidence_table:'Getting evidence table',get_screening_progress:'Checking screening progress',get_conservation_status:'Checking conservation status',get_env_data:'Fetching environmental data',get_fisheries_data:'Fetching fisheries data',detect_marine_heatwaves:'Detecting marine heatwaves',compute_diversity:'Computing diversity indices',run_analysis:'Running analysis',check_data_quality:'Checking data quality',run_sdm:'Running habitat suitability model',run_trophic_network:'Building trophic network',get_genetic_resources:'Fetching genetic resources',get_phylogeny:'Looking up phylogeny',save_to_library:'Saving to library',export_library:'Exporting library',compare_species:'Comparing species',get_current_environmental:'Reading env data',recommend_test:'Recommending test',calculate_sample_size:'Calculating sample size',analyse_keywords:'Analysing keywords',find_gaps:'Finding research gaps',build_question:'Building research question',search_datasets:'Searching datasets',go_to_tab:'Navigating',open_paper:'Opening paper'};
const AGENT_PROMPTS=["Review my library and identify research gaps","Find recent papers on coral bleaching in the Great Barrier Reef","Look up Tursiops truncatus — what's known about its distribution?","What statistical tests would work for my workshop data?","Search for grey literature on Mediterranean marine protected areas","Find papers on otolith microchemistry in sparids","Look up Diplodus sargus and find recent stock assessment papers","Summarize the methods used across my library papers","Screen my papers for studies on [topic]","Show the evidence table for [species]","What's my screening progress?","Export my library as BibTeX","What is the conservation status of blue whale?","Show me environmental data at 25°N 80°W","Are there any marine heatwaves in the Mediterranean this year?","Compute diversity indices for my workshop data","What fisheries data exists for Atlantic bluefin tuna?"];
function summarizeToolInput(name,input){
  if(name==='search_literature'||name==='search_grey_literature')return'"'+input.query+'"';
  if(name==='lookup_species')return input.name;
  if(name==='search_library')return input.query?'"'+input.query+'"':'all papers';
  if(name==='get_workshop_data')return input.include_sample_rows?'with sample rows':'';
  if(name==='screen_papers')return'"'+input.criteria+'"';
  if(name==='get_evidence_table')return[input.species_filter,input.region_filter].filter(Boolean).join(', ')||'all';
  if(name==='get_screening_progress')return'';
  if(name==='get_conservation_status')return input.name;
  if(name==='get_env_data')return input.lat+','+input.lon+(input.variables?' ('+input.variables.join(',')+')':'');
  if(name==='get_fisheries_data')return input.species;
  if(name==='detect_marine_heatwaves')return input.lat+','+input.lon+' '+input.start_date+'→'+input.end_date;
  if(name==='compute_diversity')return input.species_column+'/'+input.abundance_column;
  if(name==='save_to_library')return input.doi||input.title||'';
  if(name==='export_library')return input.format||'bibtex';
  if(name==='compare_species')return input.species_a+' vs '+input.species_b;
  if(name==='recommend_test')return'"'+input.question+'"';
  if(name==='calculate_sample_size')return input.test+' d='+input.effect_size;
  if(name==='analyse_keywords')return S.lib.length+' papers';
  if(name==='find_gaps')return input.focus||'all';
  if(name==='build_question')return'"'+input.topic+'"';
  if(name==='search_datasets')return'"'+input.query+'"';
  if(name==='go_to_tab')return _TAB_NAMES[input.tab]||input.tab;
  if(name==='open_paper')return'"'+input.query+'"';
  return'';
}
/* ── 3A: Friendly error messages ── */
function _friendlyAIError(raw){
  const lc=(raw||'').toLowerCase();
  if(lc.includes('429')||lc.includes('quota')||lc.includes('rate limit'))return'__AI_ERROR__You have reached your API usage limit. Please check your billing details on your provider\u2019s dashboard.';
  if(lc.includes('401')||lc.includes('authentication')||lc.includes('invalid'))return'__AI_ERROR__This API key does not appear to be valid. Please double-check it and try again.';
  if(lc.includes('403')||lc.includes('forbidden'))return'__AI_ERROR__Access denied. Your API key may not have the required permissions for this model.';
  if(lc.includes('fetch')||lc.includes('network')||lc.includes('failed to fetch')||lc.includes('ERR_'))return'__AI_ERROR__Could not connect to the AI provider. Please check your internet connection and try again.';
  if(lc.includes('500')||lc.includes('internal server'))return'__AI_ERROR__The AI provider is experiencing issues right now. Please try again in a moment.';
  if(lc.includes('400')||lc.includes('bad request'))return'__AI_ERROR__There was a problem with the request. Try rephrasing or switching models.';
  return'__AI_ERROR__Something went wrong. Please try again or switch to a different model.';
}
function renderToolCards(toolCalls){
  if(!toolCalls||!toolCalls.length)return'';
  return'<div class="tool-calls">'+toolCalls.map(tc=>{
    const status=tc.status||'running';
    const icon=status==='running'?'⟳':status==='done'?'✓':'✗';
    const label=TOOL_LABELS[tc.name]||tc.name;
    const summary=summarizeToolInput(tc.name,tc.input||{});
    const preview=tc.result?JSON.stringify(tc.result,null,2).slice(0,500):'';
    return`<div class="tool-card ${status}" onclick="this.classList.toggle('expanded')"><div class="tool-card-header"><span class="tool-icon">${icon}</span><span class="tool-label">${label}</span><span class="tool-summary">${escHTML(summary)}</span><span class="tool-expand">▸</span></div>${preview?`<div class="tool-card-body"><pre>${escHTML(preview)}</pre></div>`:''}</div>`;
  }).join('')+'</div>';
}
function _buildChatHTML(compact){
  if(!S.chatM.length){
    if(compact)return`<div class="fc-empty"><div class="fc-empty-title">Meridian AI</div>Ask about your research, data, or methods</div>`;
    const prompts=AGENT_PROMPTS.sort(()=>Math.random()-.5).slice(0,3);
    return`<div style="text-align:center;padding:20px 0 8px"><div style="font-size:20px;font-weight:700;color:var(--ac);margin-bottom:4px">Meridian AI</div><p style="font-size:13px;color:var(--tm);margin-bottom:16px;line-height:1.5">Search papers, look up species, and analyze your library and data.<br>Try one of these to get started:</p></div><div class="csg">${prompts.map(s=>`<button class="csb" onclick="_chatInsert(this.textContent)">${s}</button>`).join('')}</div>`;
  }
  let html='';const now=new Date();
  for(let i=0;i<S.chatM.length;i++){
    const m=S.chatM[i];
    const ts=m._ts?new Date(m._ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(!m._ts)m._ts=Date.now();
    if(m.role==='user'){
      if(Array.isArray(m.content)&&m.content[0]?.type==='tool_result')continue;
      const text=typeof m.content==='string'?m.content:(m.content[0]?.text||'');
      html+=`<div class="msg u"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('.ct').textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1200)">Copy</button><div class="rl">You</div><div class="ct">${escHTML(text)}</div><div class="msg-time">${ts}</div></div>`;
    }else if(m.role==='assistant'){
      const text=typeof m.content==='string'?m.content:
        (Array.isArray(m.content)?m.content.filter(b=>b.type==='text').map(b=>b.text).join(''):'');
      /* 3A: Error card rendering */
      if(text.startsWith('__AI_ERROR__')){
        const errMsg=text.replace('__AI_ERROR__','');
        html+=`<div class="msg a" style="max-width:90%"><div class="ai-error-card"><div class="ai-err-title">Request Failed</div>${escHTML(errMsg)}<div class="ai-err-actions"><button class="bt bt-sec" onclick="_retryLastChat()">Retry</button><button class="ai-err-link" onclick="_aiShowOnboard()">Switch Model</button></div></div><div class="msg-time">${ts}</div></div>`;
        continue;
      }
      html+=`<div class="msg a"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('.ct').textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1200)">Copy</button><div class="rl">Meridian AI</div>`;
      if(!compact&&m._toolCalls&&m._toolCalls.length)html+=renderToolCards(m._toolCalls);
      const rendered=typeof _linkCitations==='function'?_linkCitations(renderMD(text)):renderMD(text);
      html+=`<div class="ct">${rendered}</div>`;
      if(!compact&&m._usage){const u=m._usage;html+=`<div class="msg-cost">${u.input+u.output} tok`+(u.cost?` · ${_fmtCost(u.cost)}`:'')+`</div>`}
      html+=`<div class="msg-time">${ts}</div></div>`;
    }
  }
  if(S.chatL)html+=mkL();
  return html;
}
function _retryLastChat(){
  /* Remove last error message and re-send the previous user message */
  while(S.chatM.length&&S.chatM[S.chatM.length-1]._isError)S.chatM.pop();
  if(!S.chatM.length||S.chatM[S.chatM.length-1].role!=='user')return;
  S.chatL=true;rCh();_runAgentLoop();
}
function rCh(){
  // Render into AI tab
  const c=$('#cmsg');
  if(c){c.innerHTML=_buildChatHTML(false);c.scrollTop=c.scrollHeight;_injectCodeCopyBtns(c)}
  // Render into floating chat
  const fc=$('#fc-msgs');
  if(fc){fc.innerHTML=_buildChatHTML(true);fc.scrollTop=fc.scrollHeight;}
  // Toggle stop button
  const stopBtn=$('#cstop');if(stopBtn)stopBtn.style.display=S.chatL?'':'none';
  const sendBtn=$('#csnd');if(sendBtn)sendBtn.style.display=S.chatL?'none':'';
  // Update unread badge on floating chat (if panel is closed and new assistant message)
  _fcUpdateBadge();
}
function _injectCodeCopyBtns(container){
  container.querySelectorAll('.ct pre').forEach(pre=>{
    if(pre.querySelector('.code-copy'))return;
    const btn=document.createElement('button');btn.className='code-copy';btn.textContent='Copy';
    btn.onclick=()=>{navigator.clipboard.writeText(pre.textContent.replace('Copy','').trim());btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1200)};
    pre.style.position='relative';pre.appendChild(btn);
  });
}
function _chatInsert(text){
  // Insert into whichever input is visible
  const fcPanel=$('#fc-panel');
  if(fcPanel&&fcPanel.style.display!=='none'){
    const inp=$('#fc-ci');if(inp){inp.value=text;inp.focus()}
  }else{
    const inp=$('#ci');if(inp){inp.value=text;inp.focus()}
  }
}
// ── Context toggle state ──
let _aiCtxOn=true,_lastCtxTags=[];
function _toggleAiCtx(on){_aiCtxOn=on;_updateCtxIndicator();safeStore('meridian_ctx_on',on?'1':'0');
  const t1=$('#ai-ctx-toggle'),t2=$('#ai-ctx-toggle-panel');if(t1)t1.checked=on;if(t2)t2.checked=on}
try{_aiCtxOn=localStorage.getItem('meridian_ctx_on')!=='0'}catch{}

const _TAB_NAMES={home:'Home',lit:'Literature Search',library:'Library',gaps:'Gap Analysis',graph:'Citations',species:'Species Explorer',env:'Environmental Data',research:'Research Planning',publications:'Publications',archive:'Archived Data',workshop:'Workshop / Analysis',ecostats:'Ecological Statistics',studydesign:'Study Design',fielddata:'Field Data',ai:'AI Assistant',settings:'Settings'};

function buildAIContext(){
  const SYS='You are Meridian AI, an expert marine science research assistant built into the Meridian Engine platform. You have direct access to the user\'s current research context including their search results, saved papers, species data, environmental data, and analysis. You can execute platform functions when asked. Be concise, precise, and scientific. Provide specific data, citations, code, and actionable recommendations. When referencing papers, use the data available in the user\'s library or search results.\n\nYou have tools to search academic databases, look up marine species, and explore the user\'s paper library and workshop data. Use them proactively:\n- Questions about published research → search_literature\n- References to "my papers" or "my library" → search_library or get_library_stats\n- Questions about a species → lookup_species\n- Questions about data in the Workshop → get_workshop_data\n- Need for technical reports → search_grey_literature\n- Conservation status or endangered species → get_conservation_status\n- Environmental conditions at a location → get_env_data or get_current_environmental\n- Fisheries catch data → get_fisheries_data\n- Marine heatwave detection → detect_marine_heatwaves\n- Diversity/ecological indices → compute_diversity\n- Navigate the app → go_to_tab\n- Save or export papers → save_to_library, export_library\n- Compare species → compare_species\n- Statistical guidance → recommend_test, calculate_sample_size\n- Research planning → analyse_keywords, find_gaps, build_question\n- Open a paper from library → open_paper\n- Chain tools when useful: e.g., look up species → get conservation status → search literature\n\nGuidelines:\n- Always use tools for factual lookups — never fabricate data.\n- Be concise. Cite specific numbers from tool results.\n- If a tool errors, explain what happened and suggest alternatives.\n- You are limited to 5 tool calls per response. Plan calls efficiently.';

  if(!_aiCtxOn){_lastCtxTags=[];_updateCtxIndicator();return SYS}

  const CTX_BUDGET=4000;
  const estTok=s=>Math.ceil(s.length/4);
  const blocks=[];// {text,tag,pri}

  // Priority 1 — current tab context
  const tab=document.querySelector('.sb-item.active')?.dataset?.tab||'home';
  blocks.push({text:`Current tab: ${_TAB_NAMES[tab]||tab}`,tag:'Tab: '+(_TAB_NAMES[tab]||tab),pri:1});

  if(tab==='lit'&&S.litR?.length){blocks.push({text:`Literature results: ${S.litR.length} papers. Top: ${S.litR.slice(0,5).map(p=>`"${p.title}" (${p.year||'n.d.'})`).join('; ')}`,tag:`${S.litR.length} search results`,pri:1})}
  if(tab==='species'){try{const sp=JSON.parse(sessionStorage.getItem('meridian_sp')||'null');if(sp)blocks.push({text:`Active species: ${sp.sciName} (${sp.rank||''}), GBIF: ${sp.gbifOcc?.length||0} occ, OBIS: ${sp.obisOcc?.length||0} occ`,tag:sp.sciName,pri:1})}catch{}}
  if(tab==='env'){const ek=Object.keys(S.envR);if(ek.length)blocks.push({text:`Env data at (${$('#elat')?.value}, ${$('#elon')?.value}): ${ek.map(id=>S.envR[id].nm+': '+S.envR[id].value+' '+S.envR[id].u).join(', ')}`,tag:`${ek.length} env variables`,pri:1})}
  if(tab==='workshop'&&S.wsD.length){const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous');let wsCtx=`Workshop: ${S.wsD.length} rows × ${S.wsC.length} cols. Columns: ${S.wsC.join(', ')}. Types: ${S.wsC.map(c=>c+':'+S.wsCT[c]).join(', ')}`;if(nc.length){const preview=nc.slice(0,4).map(c=>{const vs=S.wsD.map(r=>r[c]).filter(v=>typeof v==='number');return vs.length?`${c}: ${Math.min(...vs).toFixed(2)}–${Math.max(...vs).toFixed(2)}, μ=${(vs.reduce((a,v)=>a+v,0)/vs.length).toFixed(2)}`:c}).join('; ');wsCtx+=` Stats: ${preview}`}blocks.push({text:wsCtx,tag:`Workshop ${S.wsD.length}×${S.wsC.length}`,pri:1})}
  if(tab==='library'&&S.lib.length)blocks.push({text:`Viewing library (${S.lib.length} papers)`,tag:`Library (${S.lib.length})`,pri:1});
  if(tab==='gaps'&&window._gapData?.length)blocks.push({text:`Gap analysis: ${window._gapData.length} gaps. Top: ${window._gapData.slice(0,3).map(g=>g.title||g.gap||'').join('; ')}`,tag:`${window._gapData.length} gaps`,pri:1});
  if(tab==='research'){const sub=document.querySelector('.sb-item.active')?.dataset?.subtab;if(sub)blocks.push({text:`Research planning subtab: ${sub}`,tag:'Research: '+sub,pri:1})}
  if(tab==='fielddata'){const ds=safeParse('meridian_field_datasets',[]);if(ds.length)blocks.push({text:`Field data: ${ds.length} datasets, latest "${ds[ds.length-1]?.name||'Unnamed'}" (${ds[ds.length-1]?.rows?.length||0} records)`,tag:`${ds.length} field datasets`,pri:1})}

  // Priority 2 — active data not on current tab
  if(tab!=='species'){try{const sp=JSON.parse(sessionStorage.getItem('meridian_sp')||'null');if(sp)blocks.push({text:`Species in session: ${sp.sciName}`,tag:sp.sciName,pri:2})}catch{}}
  if(tab!=='env'){const ek=Object.keys(S.envR);if(ek.length)blocks.push({text:`Env data: ${ek.length} variables at (${$('#elat')?.value}, ${$('#elon')?.value})`,tag:`${ek.length} env vars`,pri:2})}
  if(tab!=='workshop'&&S.wsD.length)blocks.push({text:`Workshop: ${S.wsD.length} rows, ${S.wsC.length} cols (${S.wsC.join(', ')})`,tag:`Workshop ${S.wsD.length}r`,pri:2});
  if(typeof _screeningData!=='undefined'&&_screeningData?.length){const inc=_screeningData.filter(s=>s.decision==='include').length;blocks.push({text:`Screening: ${_screeningData.length}/${S.lib.length} screened (${inc} included)`,tag:'Screening progress',pri:2})}
  const wF=S.lib.filter(p=>p.findings);if(wF.length)blocks.push({text:`Evidence: ${wF.length} papers have extracted findings`,tag:`${wF.length} evidence entries`,pri:2});
  if(typeof _searchAudit!=='undefined'&&_searchAudit.length)blocks.push({text:`Search log: ${_searchAudit.length} recorded searches`,tag:'Search audit',pri:2});

  // Priority 3 — library paper titles
  if(S.lib.length){const titles=S.lib.slice(0,15).map(p=>`"${p.title}" (${p.year||'n.d.'}, ${p.journal||''})`).join('; ');blocks.push({text:`Library (${S.lib.length} papers): ${titles}${S.lib.length>15?' ...and more':''}`,tag:`${S.lib.length} papers`,pri:3})}

  // Assemble within budget
  blocks.sort((a,b)=>a.pri-b.pri);
  let budget=CTX_BUDGET,ctx='',tags=[];
  for(const b of blocks){const cost=estTok(b.text);if(cost<=budget){ctx+='\n'+b.text;budget-=cost;tags.push(b.tag)}}
  _lastCtxTags=tags;
  _updateCtxIndicator();
  return SYS+(ctx?'\n\nCurrent Research Context:'+ctx:'');
}
// ── Update "AI can see" indicators ──
function _updateCtxIndicator(){
  // Full AI tab context panel
  const detail=$('#ai-ctx-detail');
  if(detail){
    if(!_aiCtxOn){detail.innerHTML='<div style="color:var(--tm)">Context injection disabled</div>';return}
    if(!_lastCtxTags.length){detail.innerHTML='<div style="color:var(--tm)">No data loaded yet. Search literature, explore species, or fetch environmental data.</div>';return}
    detail.innerHTML='<div style="margin-bottom:4px;color:var(--ac);font-weight:600">AI can see:</div>'+_lastCtxTags.map(t=>`<div style="padding:2px 0">· ${escHTML(t)}</div>`).join('');
  }
  // Floating chat indicator
  const fcInd=$('#fc-ctx-indicator');
  if(fcInd){
    if(_aiCtxOn&&_lastCtxTags.length){fcInd.style.display='';fcInd.title='AI can see: '+_lastCtxTags.join(', ')}
    else{fcInd.style.display='none'}
  }
}

// ── Tool Executor ──
async function executeAgentTool(name,input){
  switch(name){
    case 'search_literature':{
      const q=input.query,f={yf:input.year_from||'',yt:input.year_to||'',oa:input.open_access_only||false};
      const results=await Promise.allSettled([sOA(q,f),sSS(q,f),sCR(q),sPM(q)]);
      const all=[];const failed=[];results.forEach((r,i)=>{if(r.status==='fulfilled')all.push(...r.value);else failed.push(['OpenAlex','Semantic Scholar','CrossRef','PubMed'][i])});
      if(!all.length&&failed.length)return{papers:[],message:'All search APIs failed ('+failed.join(', ')+'). Try again in a moment.'};
      // Deduplicate
      const seen=new Set();let dd=all.filter(r=>{const k=r.title?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);if(!k||seen.has(k))return false;seen.add(k);return true});
      const seenDOI=new Set();dd=dd.filter(r=>{if(!r.doi)return true;const d=r.doi.toLowerCase();if(seenDOI.has(d))return false;seenDOI.add(d);return true});
      if(f.oa)dd=dd.filter(r=>r.isOA);
      dd.sort((a,b)=>(b.cited||0)-(a.cited||0));
      S.litR=dd;_litAllResults=dd;_litPage=0;
      return dd.slice(0,15).map(p=>({title:p.title,authors:(p.authors||[]).slice(0,3),year:p.year,journal:p.journal,cited:p.cited,isOA:p.isOA,abstract:p.abstract?p.abstract.slice(0,200):null,doi:p.doi,src:p.src}));
    }
    case 'search_grey_literature':{
      const q=input.query;
      const[fao,theses,ices]=await Promise.allSettled([searchFAO(q,true),searchTheses(q,true),searchICES(q,true)]);
      const all=[...(fao.value||[]),...(theses.value||[]),...(ices.value||[])];
      const seen=new Set();const dd=all.filter(r=>{const k=r.title?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);if(!k||seen.has(k))return false;seen.add(k);return true});
      return dd.slice(0,12).map(p=>({title:p.title,authors:(p.authors||[]).slice(0,3),year:p.year,journal:p.journal,cited:p.cited,isOA:p.isOA,abstract:p.abstract?p.abstract.slice(0,200):null,doi:p.doi}));
    }
    case 'lookup_species':{
      const q=input.name;
      let genus='',species='',sciName='',worms=null,gbifTax=null,gbifOcc=[],obisOcc=[],fb={},gbifKey=null,rank='';
      // WoRMS name match
      try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(q)}&marine_only=false`,12000);if(r.ok){const d=await r.json();if(d?.[0]?.length){worms=d[0][0];genus=worms.genus||'';species=worms.species||'';sciName=worms.scientificname||q;rank=worms.rank||''}}}catch{}
      // WoRMS vernacular fallback
      if(!worms){try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByVernacular/${encodeURIComponent(q)}?like=true`,10000);if(r.ok){const d=await r.json();if(d.length){worms=d[0];genus=worms.genus||'';species=worms.species||'';sciName=worms.scientificname||q;rank=worms.rank||''}}}catch{}}
      // GBIF species match
      try{const r=await fetchT(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sciName||q)}&verbose=true`,10000);if(r.ok){gbifTax=await r.json();gbifKey=gbifTax.usageKey;if(!genus&&gbifTax.genus){genus=gbifTax.genus;species=gbifTax.species||'';sciName=gbifTax.scientificName||sciName||q}if(!sciName)sciName=gbifTax.scientificName||q;if(!rank)rank=gbifTax.rank||''}}catch{}
      if(!worms&&!gbifKey)return{error:'Species not found. Try a scientific name or common name.'};
      // Parallel: GBIF occ + OBIS + FishBase + WoRMS extras
      let aiVernaculars=[],aiDistributions=[];
      await Promise.all([
        (async()=>{try{const r=await fetchT(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(sciName)}&limit=300&hasCoordinate=true`,12000);if(r.ok){const d=await r.json();gbifOcc=d.results||[]}}catch{}})(),
        (async()=>{try{const r=await fetchT(`https://api.obis.org/v3/occurrence?scientificname=${encodeURIComponent(sciName)}&size=300`,12000);if(r.ok){const d=await r.json();obisOcc=d.results||[]}}catch{}})(),
        (async()=>{if(!genus)return;try{const r=await fetchT(`${FB_PROXY}/species?Genus=${encodeURIComponent(genus)}&Species=${encodeURIComponent(species)}&limit=3`,8000);if(r.ok){const d=await r.json();fb=(d.data||[])[0]||{}}}catch{}})(),
        (async()=>{if(!worms?.AphiaID)return;try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaVernacularsByAphiaID/${worms.AphiaID}`,8000);if(r.ok)aiVernaculars=await r.json()||[]}catch{}})(),
        (async()=>{if(!worms?.AphiaID)return;try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaDistributionsByAphiaID/${worms.AphiaID}`,8000);if(r.ok)aiDistributions=await r.json()||[]}catch{}})()
      ]);
      // Compute summary stats
      const allOcc=[...gbifOcc.map(o=>({lat:o.decimalLatitude,lon:o.decimalLongitude,yr:o.year,depth:o.depth})),...obisOcc.map(o=>({lat:o.decimalLatitude,lon:o.decimalLongitude,yr:o.date_year,depth:o.depth}))];
      const years=allOcc.map(o=>o.yr).filter(Boolean);const depths=allOcc.map(o=>o.depth).filter(d=>d!=null&&!isNaN(d));
      const result={scientificName:sciName,rank,taxonomy:{kingdom:worms?.kingdom||gbifTax?.kingdom,phylum:worms?.phylum||gbifTax?.phylum,class:worms?.class||gbifTax?.class,order:worms?.order||gbifTax?.order,family:worms?.family||gbifTax?.family,genus},gbifOccurrences:gbifOcc.length,obisOccurrences:obisOcc.length,yearRange:years.length?{min:Math.min(...years),max:Math.max(...years)}:null,depthRange:depths.length?{min:Math.min(...depths).toFixed(1),max:Math.max(...depths).toFixed(1)}:null};
      if(fb.FBname||fb.Length)result.biology={commonName:fb.FBname,maxLength:fb.Length?fb.Length+'cm':null,depthRange:fb.DepthRangeShallow!=null?`${fb.DepthRangeShallow}–${fb.DepthRangeDeep||'?'}m`:null,longevity:fb.LongevityWild?fb.LongevityWild+'yr':null,vulnerability:fb.Vulnerability};
      if(aiVernaculars.length)result.vernacularNames=aiVernaculars.slice(0,5).map(v=>({name:v.vernacular,lang:v.language_code}));
      if(aiDistributions.length)result.distributions=aiDistributions.slice(0,10).map(d=>d.locality);
      if(gbifTax?.iucnRedListCategory)result.conservationStatus=gbifTax.iucnRedListCategory;
      return result;
    }
    case 'search_library':{
      const sq=(input.query||'').toLowerCase();
      let fl=sq?S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' '),(p.tags||[]).join(' '),p.journal||'',p.notes||''].join(' ').toLowerCase();return sq.split(/\s+/).every(w=>hay.includes(w))}):S.lib;
      return{total:S.lib.length,matched:fl.length,papers:fl.slice(0,10).map(p=>({title:p.title,authors:(p.authors||[]).slice(0,3),year:p.year,journal:p.journal,cited:p.cited,tags:p.tags,notes:p.notes?p.notes.slice(0,100):null,findings:p.findings||null}))};
    }
    case 'get_library_stats':{
      if(!S.lib.length)return{total:0,message:'Library is empty'};
      extractAllMetadata();
      const years=S.lib.map(p=>p.year).filter(Boolean);
      const journals={};S.lib.forEach(p=>{if(p.journal){journals[p.journal]=(journals[p.journal]||0)+1}});
      const topJ=Object.entries(journals).sort((a,b)=>b[1]-a[1]).slice(0,10);
      const speciesSet=new Set(),regionSet=new Set(),methodSet=new Set();
      S.lib.forEach(p=>{(p._species||[]).forEach(s=>speciesSet.add(s));(p._regions||[]).forEach(r=>regionSet.add(r));(p._methods||[]).forEach(m=>methodSet.add(m))});
      // Simple gap analysis
      const gaps=[];
      const specArr=[...speciesSet],regArr=[...regionSet];
      if(specArr.length&&regArr.length){
        const matrix={};S.lib.forEach(p=>{(p._species||[]).forEach(s=>(p._regions||[]).forEach(r=>{matrix[s+'|||'+r]=(matrix[s+'|||'+r]||0)+1}))});
        specArr.forEach(s=>{const covered=regArr.filter(r=>matrix[s+'|||'+r]);if(covered.length<regArr.length*0.3&&regArr.length>2)gaps.push(`${s}: missing coverage in ${regArr.filter(r=>!matrix[s+'|||'+r]).slice(0,4).join(', ')}`)});
      }
      return{total:S.lib.length,yearRange:years.length?{min:Math.min(...years),max:Math.max(...years)}:null,topJournals:topJ,species:[...speciesSet].slice(0,20),regions:[...regionSet].slice(0,15),methods:[...methodSet].slice(0,15),gaps:gaps.slice(0,10)};
    }
    case 'get_workshop_data':{
      if(!S.wsD.length)return{message:'No data loaded in Workshop'};
      const stats={};
      S.wsC.forEach(col=>{
        if(S.wsCT[col]==='continuous'){
          const vals=S.wsD.map(r=>r[col]).filter(v=>typeof v==='number'&&!isNaN(v));
          if(vals.length){
            vals.sort((a,b)=>a-b);
            const n=vals.length,sum=vals.reduce((a,v)=>a+v,0),mean=sum/n;
            const median=n%2?vals[Math.floor(n/2)]:(vals[n/2-1]+vals[n/2])/2;
            const sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/n);
            stats[col]={n,min:+vals[0].toFixed(4),max:+vals[n-1].toFixed(4),mean:+mean.toFixed(4),median:+median.toFixed(4),sd:+sd.toFixed(4)};
          }
        }
      });
      const result={rows:S.wsD.length,columns:S.wsC,types:S.wsCT,numericStats:stats};
      if(input.include_sample_rows)result.sampleRows=S.wsD.slice(0,5);
      return result;
    }
    case 'screen_papers':{
      const criteria=input.criteria;const limit=input.limit||10;
      if(!S.apiK)return{error:'API key not set'};
      const screenData=await dbGetAllScreening();
      const screenedIds=new Set(screenData.map(s=>s.paperId));
      const unscreened=S.lib.filter(p=>!screenedIds.has(p.id)).slice(0,limit);
      if(!unscreened.length)return{message:'All papers have been screened',total:S.lib.length,screened:screenData.length};
      const recommendations=[];
      for(const p of unscreened){
        const text=`Title: ${p.title}\nAbstract: ${(p.abstract||'No abstract').slice(0,400)}`;
        const match=criteria.toLowerCase().split(/\s+/).some(w=>text.toLowerCase().includes(w));
        recommendations.push({paperId:p.id,title:(p.title||'').slice(0,80),year:p.year,recommendation:match?'include':'maybe',reason:match?'Matches criteria keywords':'No clear match to criteria'});}
      return{criteria,screened:recommendations.length,recommendations};}
    case 'get_evidence_table':{
      const papers=S.lib.filter(p=>p.findings);
      if(!papers.length)return{message:'No papers with extracted findings. Run "Extract All Findings" in Library first.',total:S.lib.length};
      let rows=papers.map(p=>({species:(p._species||[]).join('; '),location:p.findings.location||'',n:p.findings.n||'',method:p.findings.method||'',finding:p.findings.finding||'',yearRange:p.findings.year_range||String(p.year||''),paper:(p.title||'').slice(0,60)}));
      if(input.species_filter)rows=rows.filter(r=>r.species.toLowerCase().includes(input.species_filter.toLowerCase()));
      if(input.region_filter)rows=rows.filter(r=>r.location.toLowerCase().includes(input.region_filter.toLowerCase()));
      return{total:rows.length,evidence:rows.slice(0,20)};}
    case 'get_screening_progress':{
      const screenData=await dbGetAllScreening();
      return{total:S.lib.length,screened:screenData.length,included:screenData.filter(s=>s.decision==='include').length,excluded:screenData.filter(s=>s.decision==='exclude').length,maybe:screenData.filter(s=>s.decision==='maybe').length,unscreened:S.lib.length-screenData.length};}
    case 'get_conservation_status':{
      const q=input.name;let result={species:q};
      // GBIF threat status
      try{const r=await fetchT(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(q)}`,8000);
      if(r.ok){const d=await r.json();if(d.usageKey){const sr=await fetchT(`https://api.gbif.org/v1/species/${d.usageKey}`,8000);
      if(sr.ok){const sd=await sr.json();result.iucn=sd.threatStatus||'Not assessed';result.scientificName=sd.scientificName||q}}}}catch{}
      // CITES
      try{const r=await fetchT(`https://api.speciesplus.net/api/v1/taxon_concepts?name=${encodeURIComponent(result.scientificName||q)}`,10000);
      if(r.ok){const cd=await r.json();const taxa=cd.taxon_concepts||[];if(taxa.length){const listings=(taxa[0].cites_listings||[]).map(l=>l.appendix).filter(Boolean);
      result.cites=listings.length?listings.join(', '):'Not listed'}}}catch{}
      // Invasive check via WoRMS
      try{const r=await fetchT(`https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(result.scientificName||q)}?like=true&marine_only=true`,10000);
      if(r.ok){const d=await r.json();if(d.length&&d[0].AphiaID){const ar=await fetchT(`https://www.marinespecies.org/rest/AphiaAttributesByAphiaID/${d[0].AphiaID}`,10000);
      if(ar.ok){const attrs=await ar.json();const inv=attrs.filter(a=>(a.measurementType||'').toLowerCase().includes('invasive'));
      result.invasive=inv.length?inv.map(a=>a.measurementValue).join('; '):'Not reported'}}}}catch{}
      return result;}
    case 'get_env_data':{
      const lat=input.lat,lon=input.lon,vars=input.variables||['sst','chlor','sal'];
      const results={};
      for(const vid of vars.slice(0,6)){const v=EV.find(e=>e.id===vid);if(!v||v.src!=='e')continue;
      try{const lonVal=v.lon360&&lon<0?360+lon:lon;
      const url=`${v.server}/griddap/${v.ds}.json?${v.v}[(last)]${v.dm===4?`[(${v.z||'0'})]`:''}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
      const r=await fetchT(url,15000);if(r.ok){const d=await r.json();const rows=d.table?.rows;
      if(rows?.length)results[v.nm]={value:rows[0][rows[0].length-1],unit:v.u}}}catch{}}
      return{location:{lat,lon},variables:results};}
    case 'get_fisheries_data':{
      const q=input.species;
      try{const r=await fetchT(`https://api.seaaroundus.org/api/v1/taxa/search?q=${encodeURIComponent(q)}`,12000);
      if(r.ok){const d=await r.json();if(d.length){const t=d[0];
      try{const cr=await fetchT(`https://api.seaaroundus.org/api/v1/global/taxa/tonnage/?sciname=${encodeURIComponent(q)}`,12000);
      if(cr.ok){const cd=await cr.json();if(cd.data?.length)return{species:t.common_name||q,taxon_key:t.taxon_key,catches:cd.data.slice(-20).map(r=>({year:r.year||r[0],tonnage:r.tonnage||r.value||r[1]}))}}}catch{}
      return{species:t.common_name||q,taxon_key:t.taxon_key,message:'Found in Sea Around Us but no catch data available'}}}}catch{}
      return{error:'Species not found in fisheries databases'};}
    case 'detect_marine_heatwaves':{
      const lat=input.lat,lon=input.lon;const v=EV.find(e=>e.id==='sst');if(!v)return{error:'SST variable not configured'};
      try{const lonVal=v.lon360&&lon<0?360+lon:lon;
      const url=`${v.server}/griddap/${v.ds}.json?${v.v}[(${input.start_date}T00:00:00Z):1:(${input.end_date}T00:00:00Z)]${v.dm===4?`[(${v.z||'0'})]`:''}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
      const r=await fetchT(url,30000);if(!r.ok)return{error:'Could not fetch SST data'};
      const d=await r.json();const rows=d.table?.rows||[];
      if(rows.length<365)return{error:'Need at least 365 days of data',dataPoints:rows.length};
      // Simplified MHW detection inline
      const data=rows.map(r=>({time:new Date(r[0]),val:r[r.length-1]})).filter(d=>!isNaN(d.val));
      const byDOY={};data.forEach(d=>{const doy=Math.floor((d.time-new Date(d.time.getFullYear(),0,0))/86400000);if(!byDOY[doy])byDOY[doy]=[];byDOY[doy].push(d.val)});
      const thresh={};for(let doy=1;doy<=366;doy++){const vals=[];for(let w=-5;w<=5;w++){const k=((doy+w-1+366)%366)+1;if(byDOY[k])vals.push(...byDOY[k])}
      vals.sort((a,b)=>a-b);thresh[doy]=vals.length?vals[Math.floor(vals.length*0.9)]:Infinity}
      const events=[];let evt=null;
      data.forEach(d=>{const doy=Math.floor((d.time-new Date(d.time.getFullYear(),0,0))/86400000)||1;
      if(d.val>thresh[doy]){if(!evt)evt={start:d.time.toISOString().split('T')[0],days:1,maxVal:d.val};
      else{evt.end=d.time.toISOString().split('T')[0];evt.days++;evt.maxVal=Math.max(evt.maxVal,d.val)}}
      else{if(evt&&evt.days>=5)events.push(evt);evt=null}});
      if(evt&&evt.days>=5)events.push(evt);
      return{location:{lat,lon},period:`${input.start_date} to ${input.end_date}`,dataPoints:data.length,events:events.slice(0,20).map(e=>({start:e.start,end:e.end||e.start,duration_days:e.days,max_sst:+e.maxVal.toFixed(2)}))};}catch(e){return{error:e.message}}}
    case 'compute_diversity':{
      if(!S.wsD.length)return{error:'No data in Workshop'};
      const specCol=input.species_column,abunCol=input.abundance_column;
      if(!S.wsC.includes(specCol)||!S.wsC.includes(abunCol))return{error:'Columns not found: '+specCol+', '+abunCol};
      const spp={};S.wsD.forEach(r=>{const sp=r[specCol];const n=r[abunCol];if(sp&&typeof n==='number'&&n>0){spp[sp]=(spp[sp]||0)+n}});
      const abundances=Object.values(spp);const N=abundances.reduce((a,v)=>a+v,0);const Srich=Object.keys(spp).length;
      if(Srich<2)return{error:'Need at least 2 species'};
      const H_prime=-abundances.reduce((s,n)=>{const p=n/N;return s+(p>0?p*Math.log(p):0)},0);
      const simpson=1-abundances.reduce((s,n)=>s+(n*(n-1)),0)/(N*(N-1));
      const J=H_prime/Math.log(Srich);
      return{richness:Srich,total_abundance:N,shannon_H:+H_prime.toFixed(4),simpson_1D:+simpson.toFixed(4),pielou_J:+J.toFixed(4),species:Object.keys(spp).slice(0,20)};}
case 'run_analysis':{const testMap={pca:runPCA,permanova:runPERMANOVA,anosim:runANOSIM,kruskal_wallis:runKruskalWallis,chi_squared:runChiSquared,weight_length:runWeightLength,selectivity:runSelectivity,ypr:runYPR,stock_recruitment:runStockRecruitment,maturity_ogive:runMaturityOgive,regime_shift:runRegimeShift,acf:runACF,diversity:runDiversity,rarefaction:runRarefaction,dissimilarity:runDissimilarity,nmds:runNMDS,vbgf:runVBGF,catch_curve:runCatchCurve,surplus_production:runSurplusProduction,meta_analysis:runMetaAnalysis,funnel_plot:runFunnelPlot,indicator_species:runIndicatorSpecies,power_analysis:runPowerAnalysis};const fn=testMap[input.test];if(fn){goTab('workshop');setTimeout(()=>{fn();resolve({status:'ok',test:input.test,note:'Analysis rendered in Workshop tab'})},300)}else resolve({error:'Unknown test: '+input.test});break}
case 'check_data_quality':{goTab('workshop');setTimeout(()=>{detectDataQuality();resolve({status:'ok',note:'Data quality report rendered'})},300);break}
case 'run_sdm':{goTab('workshop');setTimeout(()=>{runSDM();resolve({status:'ok',note:'SDM rendered in Workshop tab'})},300);break}
case 'run_trophic_network':{goTab('workshop');setTimeout(()=>{runTrophicNetwork();resolve({status:'ok',note:'Trophic network rendered'})},300);break}
case 'get_genetic_resources':{const name=input.species||'';try{const[sra,nuc,prot]=await Promise.all([fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=sra&term=${encodeURIComponent(name)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null),fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nucleotide&term=${encodeURIComponent(name)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null),fetchT(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=protein&term=${encodeURIComponent(name)}[Organism]&retmode=json&retmax=0`,8000).then(r=>r.ok?r.json():null).catch(()=>null)]);resolve({species:name,sra_experiments:parseInt(sra?.esearchresult?.count||'0'),nucleotide_sequences:parseInt(nuc?.esearchresult?.count||'0'),protein_sequences:parseInt(prot?.esearchresult?.count||'0')})}catch{resolve({error:'NCBI lookup failed'})}break}
case 'get_phylogeny':{const name=input.species||'';try{const r=await fetchT('https://api.opentreeoflife.org/v3/tnrs/match_names',12000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:[name]})});if(!r.ok)throw 0;const j=await r.json();const match=j.results?.[0]?.matches?.[0];if(!match?.taxon)throw 0;const lr=await fetchT('https://api.opentreeoflife.org/v3/taxonomy/taxon_info',10000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ott_id:match.taxon.ott_id,include_lineage:true})});if(!lr.ok)throw 0;const ld=await lr.json();resolve({species:name,ott_id:match.taxon.ott_id,lineage:(ld.lineage||[]).slice(0,10).map(n=>({name:n.unique_name||n.name,rank:n.rank}))})}catch{resolve({error:'Phylogeny lookup failed'})}break}
    case 'save_to_library':{
      const paper={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:input.title||'Untitled',authors:input.authors||[],year:input.year||null,journal:input.journal||'',doi:input.doi||'',dateAdded:new Date().toISOString(),src:'ai'};
      if(input.doi&&!input.title){
        try{const r=await fetchT(`https://api.crossref.org/works/${encodeURIComponent(input.doi)}`,10000);
        if(r.ok){const d=await r.json();const w=d.message;paper.title=w.title?.[0]||paper.title;paper.authors=(w.author||[]).map(a=>[a.given,a.family].filter(Boolean).join(' '));paper.year=w.published?.['date-parts']?.[0]?.[0]||paper.year;paper.journal=w['container-title']?.[0]||paper.journal;paper.abstract=w.abstract?.replace(/<[^>]+>/g,'')||''}}catch{}}
      S.lib.push(paper);if(db)try{await dbPutPaper(paper)}catch{};
      const libc=$('#libc');if(libc){libc.textContent=S.lib.length;libc.style.display=''}
      return{saved:true,title:paper.title,library_size:S.lib.length}}
    case 'export_library':{
      const fmt=(input.format||'bibtex').toLowerCase();
      if(!S.lib.length)return{error:'Library is empty'};
      if(fmt==='json')return{format:'json',papers:S.lib.length,data:JSON.stringify(S.lib.slice(0,50).map(p=>({title:p.title,authors:p.authors,year:p.year,journal:p.journal,doi:p.doi})))};
      if(fmt==='ris'){const lines=S.lib.slice(0,50).map(p=>`TY  - JOUR\nTI  - ${p.title||''}\n${(p.authors||[]).map(a=>'AU  - '+a).join('\n')}\nPY  - ${p.year||''}\nJO  - ${p.journal||''}\nDO  - ${p.doi||''}\nER  -`);return{format:'ris',papers:S.lib.length,data:lines.join('\n\n')}}
      // bibtex default
      const entries=S.lib.slice(0,50).map((p,i)=>{const key=(p.authors?.[0]||'Unknown').replace(/\s/g,'')+(p.year||'nd')+'_'+i;return`@article{${key},\n  title={${p.title||''}},\n  author={${(p.authors||[]).join(' and ')}},\n  year={${p.year||''}},\n  journal={${p.journal||''}},\n  doi={${p.doi||''}}\n}`});
      return{format:'bibtex',papers:S.lib.length,data:entries.join('\n\n')}}
    case 'compare_species':{
      const[a,b]=await Promise.all([executeAgentTool('lookup_species',{name:input.species_a}),executeAgentTool('lookup_species',{name:input.species_b})]);
      return{species_a:a,species_b:b}}
    case 'get_current_environmental':{
      const ek=Object.keys(S.envR);if(!ek.length)return{message:'No environmental data loaded. User needs to fetch data in the Env tab first.'};
      const lat=$('#elat')?.value,lon=$('#elon')?.value;
      return{location:{lat,lon},variables:ek.map(id=>({id,name:S.envR[id].nm,value:S.envR[id].value,unit:S.envR[id].u}))}}
    case 'recommend_test':{
      const q=(input.question||'').toLowerCase();
      const recs=[];
      if(!S.wsD.length)return{note:'No Workshop data loaded.',recommendations:['Load data into the Workshop tab first, then ask again.']};
      const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'),cc=S.wsC.filter(c=>S.wsCT[c]==='categorical');
      if(q.includes('compar')||q.includes('differ')){
        if(cc.length&&nc.length)recs.push({test:'kruskal_wallis',reason:'Compare numeric variable across categorical groups (non-parametric)'},
          {test:'permanova',reason:'Multivariate comparison across groups'},
          {test:'anosim',reason:'Analysis of similarity between groups'});
      }
      if(q.includes('correlat')||q.includes('relat')||q.includes('associat'))recs.push({test:'pca',reason:'Explore relationships among multiple continuous variables'});
      if(q.includes('growth')||q.includes('length')||q.includes('age'))recs.push({test:'vbgf',reason:'Von Bertalanffy growth model'},{test:'weight_length',reason:'Weight-length relationship'});
      if(q.includes('catch')||q.includes('mortal'))recs.push({test:'catch_curve',reason:'Mortality estimation from catch data'},{test:'ypr',reason:'Yield-per-recruit analysis'});
      if(q.includes('divers')||q.includes('communit'))recs.push({test:'diversity',reason:'Shannon, Simpson diversity indices'},{test:'nmds',reason:'Non-metric multidimensional scaling'});
      if(q.includes('sample size')||q.includes('power'))recs.push({test:'power_analysis',reason:'Power analysis for sample size planning'});
      if(!recs.length)recs.push({test:'pca',reason:'Exploratory analysis'},{test:'kruskal_wallis',reason:'Group comparisons'});
      return{data_summary:{rows:S.wsD.length,numeric_columns:nc,categorical_columns:cc},recommendations:recs.slice(0,4)}}
    case 'calculate_sample_size':{
      const test=input.test||'t_test',es=input.effect_size||0.5,alpha=input.alpha||0.05,power=input.power||0.8;
      const za=test==='t_test'?1.96:test==='anova'?1.96:1.96;// normal approx
      const zb=power>=0.9?1.28:power>=0.8?0.84:0.67;
      let n;
      if(test==='t_test'){n=Math.ceil(2*((za+zb)/es)**2)}
      else if(test==='anova'){const k=input.groups||3;n=Math.ceil(k*((za+zb)/(es||0.25))**2)}
      else if(test==='chi_squared'){n=Math.ceil(((za+zb)/(es||0.3))**2)}
      else if(test==='correlation'){n=Math.ceil(((za+zb)/(0.5*Math.log((1+es)/(1-Math.min(es,0.99)))))**2+3)}
      else{n=Math.ceil(2*((za+zb)/(es||0.5))**2)}
      return{test,effect_size:es,alpha,power,required_n:n,note:'Approximate — for precise power analysis use the Sample Size Calculator tab'}}
    case 'analyse_keywords':{
      if(!S.lib.length)return{error:'Library is empty'};
      const freq={};S.lib.forEach(p=>{(p.concepts||[]).forEach(c=>{freq[c]=(freq[c]||0)+1});
        const words=(p.title||'').toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(w=>w.length>4);
        words.forEach(w=>{freq[w]=(freq[w]||0)+1})});
      const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
      // Co-occurrence (top 10 pairs)
      const pairs={};S.lib.forEach(p=>{const kws=[...(p.concepts||[])].slice(0,8);for(let i=0;i<kws.length;i++)for(let j=i+1;j<kws.length;j++){const k=[kws[i],kws[j]].sort().join(' + ');pairs[k]=(pairs[k]||0)+1}});
      const topPairs=Object.entries(pairs).sort((a,b)=>b[1]-a[1]).slice(0,10);
      return{total_papers:S.lib.length,top_keywords:sorted.slice(0,25).map(([k,n])=>({keyword:k,count:n})),co_occurrences:topPairs.map(([k,n])=>({pair:k,count:n}))}}
    case 'find_gaps':{
      if(!S.lib.length)return{error:'Library is empty — add papers first'};
      extractAllMetadata();
      const focus=(input.focus||'all').toLowerCase();
      const gaps={species:[],regions:[],methods:[],temporal:[]};
      const speciesSet=new Set(),regionSet=new Set(),methodSet=new Set();
      S.lib.forEach(p=>{(p._species||[]).forEach(s=>speciesSet.add(s));(p._regions||[]).forEach(r=>regionSet.add(r));(p._methods||[]).forEach(m=>methodSet.add(m))});
      // Species-region matrix gaps
      if(focus==='all'||focus==='species'||focus==='regions'){
        const specArr=[...speciesSet],regArr=[...regionSet];
        if(specArr.length&&regArr.length>1){
          const matrix={};S.lib.forEach(p=>{(p._species||[]).forEach(s=>(p._regions||[]).forEach(r=>{matrix[s+'|||'+r]=(matrix[s+'|||'+r]||0)+1}))});
          specArr.forEach(s=>{const missing=regArr.filter(r=>!matrix[s+'|||'+r]);if(missing.length>regArr.length*0.5)gaps.species.push({species:s,missing_regions:missing.slice(0,5)})})}}
      // Temporal gaps
      if(focus==='all'||focus==='temporal'){
        const years=S.lib.map(p=>p.year).filter(Boolean).sort((a,b)=>a-b);
        if(years.length>2){const min=years[0],max=years[years.length-1];const yearCounts={};years.forEach(y=>{yearCounts[y]=(yearCounts[y]||0)+1});
          for(let y=min;y<=max;y++){if(!yearCounts[y])gaps.temporal.push(y)}}}
      // Method gaps
      if(focus==='all'||focus==='methods'){
        const common=['GLM','GLMM','PCA','ANOVA','t-test','chi-squared','regression','meta-analysis','Bayesian'];
        common.forEach(m=>{if(![...methodSet].some(ms=>ms.toLowerCase().includes(m.toLowerCase())))gaps.methods.push(m)})}
      return{library_size:S.lib.length,species_count:speciesSet.size,region_count:regionSet.size,method_count:methodSet.size,gaps}}
    case 'build_question':{
      const topic=input.topic||'';const fw=(input.framework||'pico').toLowerCase();
      if(fw==='peo')return{framework:'PEO',population:'[Define study population, e.g., Diplodus sargus in the Mediterranean]',exposure:'[Define exposure/variable, e.g., marine protected area presence]',outcome:'[Define measurable outcome, e.g., abundance, size distribution]',draft_question:`In [population], what is the effect of [exposure] on [outcome]?`,topic,tip:'Fill in the brackets with specifics from your research. Use search_literature to check if this question has been addressed.'};
      return{framework:'PICO',population:'[Define study population, e.g., juvenile sparids in BGTW]',intervention:'[Define intervention/variable]',comparison:'[Define comparison group or condition]',outcome:'[Define measurable outcome]',draft_question:`In [population], does [intervention] compared to [comparison] affect [outcome]?`,topic,tip:'Fill in the brackets. Use find_gaps to check novelty.'}}
    case 'search_datasets':{
      const q=input.query;const results=[];
      // OBIS datasets
      try{const r=await fetchT(`https://api.obis.org/v3/dataset?q=${encodeURIComponent(q)}&size=5`,10000);if(r.ok){const d=await r.json();(d.results||[]).forEach(ds=>results.push({source:'OBIS',title:ds.title,records:ds.records,url:`https://obis.org/dataset/${ds.id}`}))}}catch{}
      // GBIF datasets
      try{const r=await fetchT(`https://api.gbif.org/v1/dataset/search?q=${encodeURIComponent(q)}&limit=5`,10000);if(r.ok){const d=await r.json();(d.results||[]).forEach(ds=>results.push({source:'GBIF',title:ds.title,records:ds.recordCount,url:`https://www.gbif.org/dataset/${ds.key}`}))}}catch{}
      return{query:q,datasets:results}}
    case 'go_to_tab':{
      const t=input.tab;if(!_TAB_NAMES[t])return{error:'Unknown tab: '+t+'. Valid: '+Object.keys(_TAB_NAMES).join(', ')};
      goTab(t,input.subtab);return{navigated:true,tab:_TAB_NAMES[t],subtab:input.subtab||null}}
    case 'open_paper':{
      const q=(input.query||'').toLowerCase();if(!S.lib.length)return{error:'Library is empty'};
      const match=S.lib.find(p=>(p.title||'').toLowerCase().includes(q));
      if(!match)return{error:'No paper matching "'+input.query+'" in library'};
      goTab('library');
      return{found:true,title:match.title,authors:(match.authors||[]).slice(0,3),year:match.year,journal:match.journal,doi:match.doi,abstract:match.abstract?match.abstract.slice(0,300):null}}
    default:return{error:'Unknown tool: '+name};
  }
}

// ── Build API messages from S.chatM ──
function buildApiMessages(){
  const msgs=[];
  for(const m of S.chatM){
    if(m.role==='user'){
      if(typeof m.content==='string')msgs.push({role:'user',content:m.content});
      else msgs.push({role:'user',content:m.content});// tool_result arrays pass through
    }else if(m.role==='assistant'){
      if(m._apiContent)msgs.push({role:'assistant',content:m._apiContent});
      else if(typeof m.content==='string')msgs.push({role:'assistant',content:m.content});
    }
  }
  // Truncate to last 40 messages
  return msgs.length>40?msgs.slice(-40):msgs;
}

// ── Agent abort ──
let _agentAbort=null;
function abortAgent(){if(_agentAbort){_agentAbort.abort();_agentAbort=null;toast('Agent stopped','info')}}

// ── Token/cost pricing per 1M tokens ──
const _AI_PRICING={
  'claude-sonnet-4-20250514':{input:3,output:15},'claude-haiku-4-5-20251001':{input:1,output:5},
  'gpt-4o':{input:2.5,output:10},'gpt-4o-mini':{input:0.15,output:0.6},
  'gemini-2.0-flash':{input:0.10,output:0.40},'gemini-1.5-pro':{input:1.25,output:5}
};
function _fmtCost(usd){return usd<0.001?'<$0.001':'$'+usd.toFixed(4)}

// ── Agent loop (shared between AI tab and floating chat) ──
async function _runAgentLoop(){
  _agentAbort=new AbortController();
  const signal=_agentAbort.signal;
  let iterations=0;const MAX_ITER=8;
  const MAX_TOOLS_PER_RESPONSE=5;
  let totalIn=0,totalOut=0;

  let _sessionCtx='';
  try{_sessionCtx=await buildSessionSummary()}catch{}
  const systemPrompt=_sessionCtx
    ?buildAIContext()+'\n\n'+_sessionCtx+'\n\nUse this session context to give specific, relevant answers. Reference actual papers, species, or data from their session when relevant.'
    :buildAIContext();

  try{
    while(iterations<MAX_ITER){
      if(signal.aborted)throw new Error('Stopped');
      iterations++;
      const apiMsgs=buildApiMessages();
      const data=await callAI({messages:apiMsgs,system:systemPrompt,tools:AGENT_TOOLS,maxTokens:4096,signal});
      // Track tokens
      if(data.usage){totalIn+=(data.usage.input_tokens||0);totalOut+=(data.usage.output_tokens||0)}
      const textParts=data.content.filter(b=>b.type==='text');
      let toolParts=data.content.filter(b=>b.type==='tool_use');

      // Enforce 5-tool-call limit per response
      if(toolParts.length>MAX_TOOLS_PER_RESPONSE)toolParts=toolParts.slice(0,MAX_TOOLS_PER_RESPONSE);

      if(toolParts.length){
        const assistantMsg={role:'assistant',content:textParts.map(b=>b.text).join('')||'',_apiContent:data.content,_toolCalls:toolParts.map(tc=>({id:tc.id,name:tc.name,input:tc.input,status:'running',result:null}))};
        S.chatM.push(assistantMsg);rCh();

        const toolResults=[];
        for(const tc of toolParts){
          if(signal.aborted)throw new Error('Stopped');
          const tcMeta=assistantMsg._toolCalls.find(t=>t.id===tc.id);
          try{
            const result=await executeAgentTool(tc.name,tc.input);
            if(tcMeta){tcMeta.status='done';tcMeta.result=result}
            toolResults.push({type:'tool_result',tool_use_id:tc.id,_name:tc.name,content:JSON.stringify(result)});
          }catch(e){
            if(tcMeta){tcMeta.status='error';tcMeta.result={error:e.message}}
            toolResults.push({type:'tool_result',tool_use_id:tc.id,_name:tc.name,content:JSON.stringify({error:e.message}),is_error:true});
          }
          rCh();
        }
        S.chatM.push({role:'user',content:toolResults});
        rCh();
        if(data.stop_reason==='end_turn')break;
      }else{
        const finalText=textParts.map(b=>b.text).join('')||'No response.';
        const pricing=_AI_PRICING[S.aiModel];
        const cost=pricing?((totalIn/1e6)*pricing.input+(totalOut/1e6)*pricing.output):0;
        const _u={input:totalIn,output:totalOut,cost};
        S.chatM.push({role:'assistant',content:finalText,_apiContent:data.content,_usage:_u});
        if(typeof _trackSessionTokens==='function')_trackSessionTokens(_u);
        if(!_fcOpen)_fcUnread++;
        break;
      }
    }
    if(iterations>=MAX_ITER)toast('Agent reached max iterations','info');
  }catch(e){
    if(e.name!=='AbortError'&&e.message!=='Stopped'){
      const msg=_friendlyAIError(e.message);
      S.chatM.push({role:'assistant',content:msg,_isError:true});
    }else{
      S.chatM.push({role:'assistant',content:'*Stopped by user.*'});
    }
  }
  S.chatL=false;_agentAbort=null;rCh();
  if(db)try{
    const toStore=S.chatM.map(m=>{
      if(m._apiContent||m._toolCalls){
        const stored={role:m.role,content:typeof m.content==='string'?m.content:(Array.isArray(m.content)?m.content:'')};
        if(m._toolCalls)stored._toolCalls=m._toolCalls;
        return stored;
      }return{role:m.role,content:m.content};
    });
    dbPutChat(toStore);
  }catch{}
}
// AI tab send handler
async function sCh(){
  const inp=$('#ci'),m=inp.value.trim();if(!m||S.chatL)return;
  if(!S.apiK){_aiShowOnboard();toast('Connect an AI provider first','info');return}
  inp.value='';S.chatM.push({role:'user',content:m,_ts:Date.now()});S.chatL=true;rCh();
  _runAgentLoop();
}
$('#akb').addEventListener('click',async()=>{
  const obModel=$('#ai-ob-model');
  if(obModel&&obModel.value)S.aiModel=obModel.value;
  const obProv=$('#ai-ob-provider');
  if(obProv&&obProv.value){S.aiProvider=obProv.value;_syncAllProviderDropdowns()}
  S.apiK=$('#aki').value.trim();
  if(S.apiK){await _keyVault.store('meridian_key_'+S.aiProvider,S.apiK);safeStore('meridian_provider',S.aiProvider);safeStore('meridian_model_'+S.aiProvider,S.aiModel);toast('Connected to '+AI_PROVIDERS[S.aiProvider].name,'ok');_updateKeyPromptVisibility()}else{toast('Enter an API key first','err')}
});
$('#aki').addEventListener('keydown',e=>{if(e.key==='Enter')$('#akb').click()});
// Unified provider dropdown handlers
$('#aip')?.addEventListener('change',function(){_onProviderChange(this.value)});
$('#fc-provider')?.addEventListener('change',function(){_onProviderChange(this.value)});
// Init onboarding dropdowns
setTimeout(_initOnboardDropdowns,200);

// ═══ FLOATING CHATBOT ENGINE ═══
let _fcOpen=false,_fcUnread=0;
function _fcToggle(){if(_fcOpen)_fcClose();else _fcOpenPanel()}
function _fcOpenPanel(){
  const panel=$('#fc-panel');const bubble=$('#fc-bubble');
  if(!panel)return;
  panel.style.display='flex';_fcOpen=true;_fcUnread=0;_fcUpdateBadge();
  if(bubble)bubble.classList.remove('has-unread');
  _updateKeyPromptVisibility();
  const fc=$('#fc-msgs');if(fc){fc.innerHTML=_buildChatHTML(true);fc.scrollTop=fc.scrollHeight;}
  setTimeout(()=>{const inp=$('#fc-ci');if(inp)inp.focus()},150);
}
function _fcClose(){
  const panel=$('#fc-panel');if(panel)panel.style.display='none';
  _fcOpen=false;
}
function _fcUpdateBadge(){
  const badge=$('#fc-badge');const bubble=$('#fc-bubble');
  if(!badge||!bubble)return;
  if(_fcUnread>0&&!_fcOpen){
    badge.textContent=_fcUnread>9?'9+':_fcUnread;
    badge.style.display='';
    bubble.classList.add('has-unread');
  }else{
    badge.style.display='none';
    bubble.classList.remove('has-unread');
  }
}
function _fcSend(){
  const inp=$('#fc-ci');if(!inp)return;
  const m=inp.value.trim();if(!m||S.chatL)return;
  if(!S.apiK){toast('Enter an API key first','err');return}
  inp.value='';
  // Reuse the main chat input path
  const mainInp=$('#ci');if(mainInp)mainInp.value=m;
  S.chatM.push({role:'user',content:m});S.chatL=true;rCh();
  // Trigger the agent loop directly
  _runAgentLoop();
}
function _fcSaveKey(){
  const inp=$('#fc-aki');if(!inp)return;
  const key=inp.value.trim();if(!key){toast('Enter an API key','err');return}
  S.apiK=key;
  _keyVault.store('meridian_key_'+S.aiProvider,key);
  safeStore('meridian_provider',S.aiProvider);
  // Sync main tab
  const aki=$('#aki');if(aki)aki.value=key;
  _updateKeyPromptVisibility();
  toast('Key saved for '+AI_PROVIDERS[S.aiProvider].name,'ok');
}
function _clearChat(){
  S.chatM=[];S.chatL=false;_currentSessionId=null;rCh();
  if(db)try{dbPutChat([])}catch{}
  if(typeof _renderSavedSessions==='function')_renderSavedSessions();
  if(typeof _refreshAllChips==='function')_refreshAllChips();
  toast('Chat cleared','ok',1500);
}
// ═══ API KEY SECURITY ═══
const _KEY_TIMEOUT_MS=15*60*1000;
let _keyInactivityTimer=null;
function _resetKeyTimer(){clearTimeout(_keyInactivityTimer);if(!S.apiK)return;_keyInactivityTimer=setTimeout(_onKeyTimeout,_KEY_TIMEOUT_MS)}
function _onKeyTimeout(){_clearApiKey(true);S.aiProvider='anthropic';S.aiModel=AI_PROVIDERS.anthropic.defaultModel;_syncAllProviderDropdowns();_updateKeyPromptVisibility();_showKeyTimeoutNotice()}
function _showKeyTimeoutNotice(){const existing=$('#key-timeout-notice');if(existing)existing.remove();const n=document.createElement('div');n.id='key-timeout-notice';n.style.cssText='position:fixed;top:0;left:0;right:0;z-index:10010;padding:14px 20px;background:linear-gradient(135deg,rgba(194,120,120,.15),rgba(212,160,74,.1));border-bottom:1px solid rgba(194,120,120,.3);text-align:center;font-size:13px;color:var(--co);font-family:var(--mf);animation:fadeIn .3s';n.innerHTML='\uD83D\uDD12 Your API key was cleared for security due to inactivity. Please re-enter your key to continue. <button class="bt sm" style="margin-left:12px;font-size:11px;color:var(--ac);border-color:var(--ab)" onclick="goTab(\'ai\');this.parentElement.remove()">Go to AI Settings</button>';document.body.appendChild(n)}
function _clearApiKey(silent){S.apiK='';const aki=$('#aki');if(aki)aki.value='';const akb=$('#akb');if(akb)akb.textContent='Save';clearTimeout(_keyInactivityTimer);_keyInactivityTimer=null;_updateKeyPromptVisibility();if(!silent)toast('Key cleared.','ok',2000)}
['mousemove','keydown','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,_resetKeyTimer,{passive:true}));
$('#akb').addEventListener('click',()=>setTimeout(_resetKeyTimer,200));
$('#aip').addEventListener('change',()=>setTimeout(_resetKeyTimer,200));
$('#akcl')?.addEventListener('click',()=>{if(S.apiK)_clearApiKey();else toast('No key to clear','info',1500)});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='K'){e.preventDefault();if(S.apiK){_clearApiKey();toast('API key cleared','ok',2000)}else{toast('No API key set','info',1500)}}});
$('#aki')?.addEventListener('paste',()=>{if(sessionStorage.getItem('meridian_paste_warned'))return;sessionStorage.setItem('meridian_paste_warned','1');const inp=$('#aki');if(!inp)return;const rect=inp.getBoundingClientRect();const tip=document.createElement('div');tip.id='key-paste-tip';tip.style.cssText='position:fixed;z-index:10008;padding:10px 14px;background:var(--bs);border:1px solid var(--sb);border-radius:8px;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.5;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.3);animation:fadeIn .3s;opacity:1;transition:opacity .5s;pointer-events:none;left:'+Math.min(rect.left,window.innerWidth-360)+'px;top:'+(rect.bottom+8)+'px';tip.textContent='\uD83D\uDD12 Your key is stored in memory only \u2014 never saved to disk, never sent to our servers. It will be cleared when you close this tab or after 15 minutes of inactivity.';document.body.appendChild(tip);setTimeout(()=>{tip.style.opacity='0';setTimeout(()=>tip.remove(),500)},5000)});
$('#csnd').addEventListener('click',sCh);$('#ci').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey)sCh()});
// ═══ CHART EXPORT ═══
function exportChart(id){const el=$('#'+id)||document.getElementById(id);if(!el)return;Plotly.downloadImage(el,{format:'png',width:1200,height:600,filename:'meridian_chart'}).then(()=>toast('Chart saved','ok')).catch(()=>toast('Chart export failed','err'))}

// ═══ ENV MAP ═══
function gibsDate(daysAgo=2){const d=new Date();d.setDate(d.getDate()-daysAgo);return d.toISOString().split('T')[0]}
function initEnvMap(){
  if(_envMap)return;
  const lat=parseFloat($('#elat').value)||0,lon=parseFloat($('#elon').value)||0;
  /*
   * MAP CRS ARCHITECTURE
   * ====================
   * The Leaflet map uses EPSG:3857 (Web Mercator) — the web tile standard.
   *
   * Layer CRS requirements:
   *
   * CartoDB basemap (dark/labels):   EPSG:3857 XYZ tiles ✓
   * ArcGIS satellite:                EPSG:3857 XYZ tiles ✓
   * GEBCO Bathymetry:                EPSG:3857 XYZ tiles ✓
   * NOAA ERDDAP WMS (Kd490/PAR):
   *   → Using WMS 1.3.0 — Leaflet auto-sends CRS=EPSG:3857
   *   → Do NOT set 'crs' option on L.tileLayer.wms — inherits from map
   * NASA GIBS WMTS (SST, SST Anom, Chlor, DHW, True Color, Sea Ice):
   *   → Using epsg3857 WMTS endpoint (/wmts/epsg3857/best/...)
   *   → Do NOT use the epsg4326 endpoint on this map
   * Habitat WMS (Coral, Mangrove, Seagrass + supplementary):
   *   → Allen Coral Atlas (benthic + geomorphic): EPSG:3857 via GeoServer ows
   *   → SPREP mangrove GMWv2: native EPSG:4326, reprojects to 3857 fine
   *   → SPREP seagrass IMSUA: native EPSG:3975 (Sinusoidal) — EXCEPTION:
   *       uses crs:L.CRS.EPSG4326 + WMS 1.1.1 because GeoServer can't
   *       reproject Sinusoidal→3857 properly. Sinusoidal→4326 works.
   *   → EMODnet (European seagrass): EPSG:3857 native
   *   → Dead: UNEP-WCMC Ocean+ (NXDOMAIN), SEI mangrove tiles (NXDOMAIN)
   *   → Do NOT set 'crs' on other layers — inherits EPSG:3857 from map
   * GFW Fishing:
   *   → Custom GridLayer with XYZ tiles in EPSG:3857 ✓
   *
   * If adding a new layer: always check GetCapabilities for CRS support.
   * Never hardcode SRS= or CRS= in WMS URLs — let Leaflet handle it.
   */
  _envMap=L.map('envMap',{
    crs:L.CRS.EPSG3857,
    center:[lat,lon],zoom:2,zoomControl:true,attributionControl:false,
    preferCanvas:true,updateWhenZooming:false,updateWhenIdle:true
  });
  // Custom panes: base tiles(200) → WMS data(250) → land mask(300) → labels(350) → markers(600+)
  const wmsPane=_envMap.createPane('wmsPane');wmsPane.style.zIndex=250;
  const lmPane=_envMap.createPane('landMask');lmPane.style.zIndex=300;
  const lblPane=_envMap.createPane('labelsPane');lblPane.style.zIndex=350;
  // Base tiles (available for satellite toggle, not shown in default ocean view)
  _baseTileLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{
    maxZoom:18,subdomains:'abcd',keepBuffer:4,updateWhenZooming:false,updateWhenIdle:true,crossOrigin:'anonymous'
  });
  // Satellite tile layer (Esri World Imagery) — created but not added until toggled
  _satTileLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:18,keepBuffer:4,updateWhenZooming:false,updateWhenIdle:true,crossOrigin:'anonymous'
  });
  // Land mask — covers WMS bleed over coastlines (cached in IndexedDB)
  loadLandMask();
  // Labels on top of WMS + land mask
  _labelsLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{
    maxZoom:18,subdomains:'abcd',pane:'labelsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true,crossOrigin:'anonymous'
  }).addTo(_envMap);
  // ERDDAP WMS config — inherits map CRS (EPSG:3857); do NOT set crs or hardcode SRS/CRS params
  const wmsErddap={styles:'',format:'image/png',transparent:true,opacity:0.75,version:'1.3.0',
    tileSize:128,pane:'wmsPane',keepBuffer:4,updateWhenZooming:false,updateWhenIdle:true};
  _mapLayerDefs={
    sst:()=>L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      {time:gibsDate(),maxZoom:7,maxNativeZoom:7,opacity:0.75,pane:'wmsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true}),
    sst_anom:()=>L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      {time:gibsDate(),maxZoom:7,maxNativeZoom:7,opacity:0.75,pane:'wmsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true}),
    chlor:()=>L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_L2_Chlorophyll_A/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      {time:gibsDate(),maxZoom:7,maxNativeZoom:7,opacity:0.75,pane:'wmsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true}),
    par:()=>{
      const srv='https://coastwatch.pfeg.noaa.gov';
      const ds='nesdisVHNSQkd490Daily';
      const vr='kd_490';
      const layer=L.tileLayer.wms(srv+'/erddap/wms/'+ds+'/request',{...wmsErddap,layers:ds+':'+vr});
      let errCount=0;layer.on('tileerror',()=>{if(++errCount>8){layer.setOpacity(0);toast('Kd(PAR) WMS layer unavailable','err')}});
      return layer},
    bath:()=>L.tileLayer('https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/GEBCO_basemap_NCEI/MapServer/tile/{z}/{y}/{x}',{
      opacity:0.5,maxZoom:10,keepBuffer:4,updateWhenZooming:false,updateWhenIdle:true}),
    dhw:()=>L.tileLayer(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_G1SST_Sea_Surface_Temperature/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      {time:gibsDate(),maxZoom:7,maxNativeZoom:7,opacity:0.7,pane:'wmsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true}),
    // ── GFW Fishing: auth token + generate-png workflow + wavy mask ──
    gfw:()=>{
      let token='';try{token=localStorage.getItem('meridian_gfw_token')||''}catch{}
      if(!token){const t=prompt('GFW Fishing requires a free API token.\n\nGet yours at:\nglobalfishingwatch.org/our-apis/tokens\n\nPaste your token:');
        if(!t){toast('GFW layer requires an API token','info');return null}
        token=t.trim();try{localStorage.setItem('meridian_gfw_token',token)}catch{}}
      const layer=new(L.GridLayer.extend({_gfwUrl:null,_gfwToken:token,
        createTile:function(coords,done){const tile=document.createElement('canvas'),size=this.getTileSize();
          tile.width=size.x;tile.height=size.y;
          if(!this._gfwUrl){done(null,tile);return tile}
          const url=this._gfwUrl.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',coords.y);
          fetch(url,{headers:{'Authorization':'Bearer '+this._gfwToken}})
            .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.blob()})
            .then(blob=>{const img=new Image();
              img.onload=()=>{tile.getContext('2d').drawImage(img,0,0,size.x,size.y);URL.revokeObjectURL(img.src);done(null,tile)};
              img.onerror=()=>{URL.revokeObjectURL(img.src);done(new Error('decode'),tile)};
              img.src=URL.createObjectURL(blob)})
            .catch(()=>done(new Error('fetch'),tile));
          return tile}}))({opacity:0.8,maxZoom:12,pane:'wmsPane'});
      fetch('https://gateway.api.globalfishingwatch.org/v3/4wings/generate-png'+
        '?interval=YEAR&datasets[0]=public-global-fishing-effort:latest'+
        '&date-range=2023-01-01,2023-12-31&color=%234A90D9',
        {method:'POST',headers:{'Authorization':'Bearer '+token}})
        .then(r=>{if(r.status===401){try{localStorage.removeItem('meridian_gfw_token')}catch{}
          throw new Error('Invalid token — re-toggle to enter a new one')}
          if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
        .then(data=>{if(data.url){layer._gfwUrl=data.url;layer.redraw();
          console.info('GFW tile URL ready');toast('GFW fishing effort loaded','ok')}})
        .catch(e=>{toast('GFW: '+e.message,'err');try{localStorage.removeItem('meridian_gfw_token')}catch{}});
      layer.on('add',function(){const c=this.getContainer();if(c){
        const svg=encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='30' height='10'><path d='M0,5 Q7.5,0 15,5 T30,5' fill='none' stroke='white' stroke-width='2.5'/></svg>");
        c.style.webkitMaskImage=c.style.maskImage='url(\"data:image/svg+xml,'+svg+'\")';
        c.style.webkitMaskSize=c.style.maskSize='30px 10px';c.style.webkitMaskRepeat=c.style.maskRepeat='repeat'}});
      return layer}};
  // Scale bar
  L.control.scale({position:'bottomleft',imperial:false,maxWidth:150}).addTo(_envMap);
  // Live coordinate readout (named handler for DMS toggle swap)
  window._coordReadoutHandler=function(e){const c=document.getElementById('coordReadout');
    if(c)c.textContent=_coordDMS?formatCoordDMS(e.latlng.lat,e.latlng.lng):e.latlng.lat.toFixed(4)+'°N, '+e.latlng.lng.toFixed(4)+'°E'};
  _envMap.on('mousemove',window._coordReadoutHandler);
  _envMap.on('mouseout',()=>{const c=document.getElementById('coordReadout');if(c)c.textContent='—'});
  // WMS tile loading indicator
  const loadingEl=document.createElement('div');loadingEl.className='map-loading';loadingEl.textContent='Loading tiles…';loadingEl.style.display='none';document.getElementById('envMap').appendChild(loadingEl);
  let _tileLoading=0;
  _envMap.on('tileloadstart',()=>{_tileLoading++;loadingEl.style.display=''});
  _envMap.on('tileload tileerror',()=>{_tileLoading=Math.max(0,_tileLoading-1);if(!_tileLoading)loadingEl.style.display='none'});
  // Fullscreen listener
  document.addEventListener('fullscreenchange',()=>{setTimeout(()=>_envMap&&_envMap.invalidateSize(),100)});
  // Themed marker + click
  const markerIcon=L.divIcon({className:'env-marker',iconSize:[16,16],iconAnchor:[8,8]});
  _envMarker=L.marker([lat,lon],{draggable:true,icon:markerIcon}).addTo(_envMap);
  _envMarker.on('dragend',function(){const p=_envMarker.getLatLng();$('#elat').value=p.lat.toFixed(4);$('#elon').value=p.lng.toFixed(4)});
  _envMap.on('click',function(e){
    if(_measureMode||_wmsQueryMode){if(_wmsQueryMode)queryWmsLayers(e.latlng);return}
    _envMarker.setLatLng(e.latlng);const _el=$('#elat'),_lo=$('#elon');
    if(_el)_el.value=e.latlng.lat.toFixed(4);if(_lo)_lo.value=e.latlng.lng.toFixed(4);
    if(_envBounds){clearAreaSelection()}
    openEnvGroup('loc');updateEnvLocCtx();
    [_el,_lo].forEach(el=>{if(!el)return;el.style.transition='background .3s';el.style.background='rgba(27,96,144,0.15)';setTimeout(()=>{el.style.background=''},500)})});
  // Draw controls — custom toolbar replaces L.Control.Draw (avoids sprite image dependency)
  _drawnItems=new L.FeatureGroup();_envMap.addLayer(_drawnItems);
  let _activeDrawHandler=null,_editActive=false;
  const _MeridianDraw=L.Control.extend({options:{position:'topleft'},onAdd:function(map){
    const c=L.DomUtil.create('div','meridian-draw-ctrl');L.DomEvent.disableClickPropagation(c);L.DomEvent.disableScrollPropagation(c);
    function deactivate(){if(_activeDrawHandler){try{_activeDrawHandler.disable()}catch(ex){}_activeDrawHandler=null}
      if(_editActive){_drawnItems.eachLayer(function(l){if(l.editing)l.editing.disable()});
        // Update bounds from edited shape
        _drawnItems.eachLayer(function(l){if(l.getBounds){const b=l.getBounds();_envBounds={south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()}}});
        _editActive=false}
      c.querySelectorAll('.mdc-btn').forEach(function(b){b.classList.remove('active')})}
    [{id:'marker',label:'📍 Point',mk:function(){return new L.Draw.Marker(map,{})}},
     {id:'polygon',label:'⬡ Polygon',mk:function(){return new L.Draw.Polygon(map,{shapeOptions:{color:'#7B9E87',weight:2,fillOpacity:0.15}})}},
     {id:'polyline',label:'📏 Line',mk:function(){return new L.Draw.Polyline(map,{shapeOptions:{color:'#C9956B',weight:2}})}},
     {id:'rectangle',label:'▭ Rectangle',mk:function(){return new L.Draw.Rectangle(map,{shapeOptions:{color:'#C9956B',weight:2,fillOpacity:0.15}})}}
    ].forEach(function(t){var a=L.DomUtil.create('a','mdc-btn',c);a.href='#';a.title=t.label;a.textContent=t.label;a.dataset.tool=t.id;
      L.DomEvent.on(a,'click',function(ev){L.DomEvent.preventDefault(ev);var was=a.classList.contains('active');deactivate();
        if(!was){_activeDrawHandler=t.mk();_activeDrawHandler.enable();a.classList.add('active')}})});
    L.DomUtil.create('div','mdc-sep',c);
    var eb=L.DomUtil.create('a','mdc-btn',c);eb.href='#';eb.title='Edit shapes';eb.textContent='✏️ Edit';eb.dataset.tool='edit';
    L.DomEvent.on(eb,'click',function(ev){L.DomEvent.preventDefault(ev);var was=eb.classList.contains('active');deactivate();
      if(!was&&_drawnItems.getLayers().length){_drawnItems.eachLayer(function(l){if(l.editing)l.editing.enable()});_editActive=true;eb.classList.add('active')}});
    var db=L.DomUtil.create('a','mdc-btn mdc-del',c);db.href='#';db.title='Delete drawn shapes';db.textContent='🗑️ Delete';db.dataset.tool='delete';
    L.DomEvent.on(db,'click',function(ev){L.DomEvent.preventDefault(ev);deactivate();if(_drawnItems.getLayers().length)clearAreaSelection()});
    // Clear active button state when drawing completes or is cancelled
    map.on('draw:created draw:drawstop',function(){_activeDrawHandler=null;c.querySelectorAll('.mdc-btn').forEach(function(b){b.classList.remove('active')})});
    return c}});
  _envMap.addControl(new _MeridianDraw());
  _envMap.on(L.Draw.Event.CREATED,function(e){_drawnItems.clearLayers();_drawnItems.addLayer(e.layer);
    // Marker → set lat/lon like a map click, no area selection
    if(e.layerType==='marker'){const p=e.layer.getLatLng();$('#elat').value=p.lat.toFixed(4);$('#elon').value=p.lng.toFixed(4);_envMarker.setLatLng(p);openEnvGroup('loc');updateEnvLocCtx();return}
    const b=e.layer.getBounds();_envBounds={south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()};
    const cLat=(b.getSouth()+b.getNorth())/2,cLon=(b.getWest()+b.getEast())/2;
    if(e.layerType==='polygon'){const ll=e.layer.getLatLngs()[0];_envPolygon=ll.map(p=>[p.lat,p.lng]);
      // Compute area via spherical excess approximation
      let area=0;for(let i=0;i<ll.length;i++){const j=(i+1)%ll.length;area+=(ll[j].lng-ll[i].lng)*(2+Math.sin(ll[i].lat*Math.PI/180)+Math.sin(ll[j].lat*Math.PI/180))}
      area=Math.abs(area*6371**2*Math.PI/360/2);
      $('#area-indicator').innerHTML='<span class="area-badge">Polygon: '+ll.length+' vertices · ~'+area.toFixed(0)+' km²</span>';
      // Populate polygon filter panel
      const pf=$('#polygon-filter');if(pf)pf.style.display='block';
      const ps=$('#polygon-stats');if(ps){
        const selVars=[...S.envSel].map(id=>EV.find(v=>v.id===id)).filter(Boolean);
        const erddapVars=selVars.filter(v=>v.src==='e').map(v=>v.nm);
        const pointVars=selVars.filter(v=>v.src==='m'||v.src==='w').map(v=>v.nm);
        const bathVars=selVars.filter(v=>v.src==='bath').map(v=>v.nm);
        ps.innerHTML='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:4px">'+
          '<div><strong>Vertices:</strong> '+ll.length+'</div>'+
          '<div><strong>Area:</strong> ~'+area.toFixed(0)+' km²</div>'+
          '<div><strong>Centroid:</strong> '+cLat.toFixed(3)+'°N, '+cLon.toFixed(3)+'°E</div>'+
          '<div><strong>Bbox:</strong> '+b.getSouth().toFixed(2)+'–'+b.getNorth().toFixed(2)+'°N, '+b.getWest().toFixed(2)+'–'+b.getEast().toFixed(2)+'°E</div></div>'+
          (erddapVars.length?'<div style="margin-top:4px"><span style="color:var(--sg)">● Grid-cropped:</span> '+erddapVars.join(', ')+'</div>':'')+
          (bathVars.length?'<div><span style="color:var(--sg)">● Area stats:</span> '+bathVars.join(', ')+'</div>':'')+
          (pointVars.length?'<div><span style="color:var(--wa)">● Centroid point:</span> '+pointVars.join(', ')+' <span style="opacity:.6">(no grid data)</span></div>':'')
      }
      $$('.pm-btn').forEach(b=>b.classList.toggle('sel',b.dataset.mode===_polygonMode));
    }else{_envPolygon=null;
      $('#area-indicator').innerHTML='<span class="area-badge">Area: '+b.getSouth().toFixed(1)+'°–'+b.getNorth().toFixed(1)+'°N, '+b.getWest().toFixed(1)+'°–'+b.getEast().toFixed(1)+'°E</span>';
      const pf=$('#polygon-filter');if(pf)pf.style.display='none'}
    $('#elat').value=cLat.toFixed(4);$('#elon').value=cLon.toFixed(4);_envMarker.setLatLng([cLat,cLon]);sh('#clearAreaBtn');$('#noaa-filters').style.display='block'});
  _envMap.on(L.Draw.Event.DELETED,function(){clearAreaSelection()});
  requestAnimationFrame(()=>_envMap.invalidateSize());
  // Load HD coastline after map stabilizes
  setTimeout(()=>loadHDCoastline(),2000);
}
function toggleEnvTools(){const el=$('#env-secondary-tools');const btn=$('#envMoreTools');if(!el)return;const show=el.style.display==='none';el.style.display=show?'flex':'none';btn.textContent=show?'More Tools ▴':'More Tools ▾';btn.classList.toggle('on',show);try{localStorage.setItem('meridian_env_tools_open',show?'1':'0')}catch{};if(_envMap)setTimeout(()=>_envMap.invalidateSize(),50)}
(function(){try{if(localStorage.getItem('meridian_env_tools_open')==='1'){const el=$('#env-secondary-tools');const btn=$('#envMoreTools');if(el){el.style.display='flex';if(btn){btn.textContent='More Tools ▴';btn.classList.add('on')}}}}catch{}})();
function toggleCompareLocation(){const el=$('#eloc2'),btn=$('#etog2');if(!el)return;const opening=el.style.display==='none'||el.style.display==='';el.style.display=opening?'block':'none';btn?.classList.toggle('on',opening);if(_envMap)setTimeout(()=>_envMap.invalidateSize(),50)}
function toggleMapLayer(id){const btn=$('#ml-'+id);if(!_envMap)return;
  if(!_mapLayers[id]&&_mapLayerDefs?.[id]){
    btn.classList.add('loading');
    _mapLayers[id]=_mapLayerDefs[id]();
    // Apply current opacity from slider
    const curOpacity=parseFloat($('#wmsOpacity')?.value||0.75);
    if(_mapLayers[id].setOpacity)_mapLayers[id].setOpacity(curOpacity);
    _mapLayers[id].on('load',()=>{btn.classList.remove('loading')});
    // GIBS date fallback — retry with older dates if tiles fail
    if(id==='sst'||id==='sst_anom'||id==='chlor'){
      let retries=0,loadCount=0,lastDate='';
      _mapLayers[id].on('tileerror',()=>{
        if(loadCount>=2||retries>=3)return;
        retries++;const older=gibsDate(retries+2);
        if(older===lastDate)return;lastDate=older;
        _mapLayers[id].setUrl(_mapLayers[id]._url.replace(/default\/[^/]+\//,'default/'+older+'/'))});
      _mapLayers[id].on('tileload',()=>{loadCount++})}
    // General tileerror handler — show error state but never remove user-activated layers
    else{let errC=0,loadC=0;
      _mapLayers[id].on('tileerror',()=>{errC++;
        if(errC>=8&&loadC===0){
          btn.classList.add('layer-err');
          btn.title='Layer experiencing errors — data may be incomplete';
          console.warn('Layer '+id+': '+errC+' tile errors, 0 successful loads');
        }});
      _mapLayers[id].on('tileload',()=>{loadC++;errC=Math.max(0,errC-1);
        if(loadC>2)btn.classList.remove('layer-err')});}}
  if(!_mapLayers[id])return;
  if(_envMap.hasLayer(_mapLayers[id])){_envMap.removeLayer(_mapLayers[id]);btn.classList.remove('on');btn.classList.remove('loading')}
  else{_mapLayers[id].addTo(_envMap);btn.classList.add('on')}
  updateLegendControl()}
function clearAreaSelection(){_envBounds=null;_envPolygon=null;_areaStats=null;if(_drawnItems)_drawnItems.clearLayers();$('#area-indicator').innerHTML='';hi('#clearAreaBtn');$('#noaa-filters').style.display='none';const pf=$('#polygon-filter');if(pf)pf.style.display='none'}
function setPolygonMode(m){_polygonMode=m;$$('.pm-btn').forEach(b=>b.classList.toggle('sel',b.dataset.mode===m));const d={crop:'Bounding box only — data is fetched for the rectangular extent of the polygon. Fastest, may include points outside boundary.',filter:'Point-in-polygon — grid points outside the polygon boundary are excluded from analysis.',cut:'Strict clip — filtered to polygon boundary, vertices embedded in exports, summary annotated with clip region.'};H('#polygon-mode-desc',d[m]||'');toast('Polygon mode: '+m.charAt(0).toUpperCase()+m.slice(1),'info')}
function updateFilterLabel(el,labelId,unit){const v=$('#'+labelId);if(v)v.textContent=el.value+(unit||'')}
// ═══ HABITAT INFERENCE — suggests marine habitats from fetched environmental data ═══
function inferMarineHabitat(lat, lon, data) {
  const habitats = [];
  const depth = typeof data.depth === 'number' ? data.depth : (data.bathymetry?.depth ?? null);
  const sst = typeof data.sst === 'number' ? data.sst : null;
  const chlor = typeof data.chlor === 'number' ? data.chlor : null;
  const slope = typeof data.slope === 'number' ? data.slope : (data.bathymetry?.slope ?? null);
  const absLat = Math.abs(parseFloat(lat));

  if (depth === null || depth <= 0) {
    if (depth !== null && depth >= -5 && depth <= 0 && absLat <= 32) {
      let conf = 0.4, r = ['intertidal zone (elev ~' + depth + 'm)'];
      if (sst !== null && sst >= 20) { conf += 0.2; r.push('warm SST ' + sst + '°C'); }
      if (absLat <= 25) { conf += 0.1; r.push('core mangrove latitude'); }
      habitats.push({ type: 'Mangrove', confidence: Math.min(1, conf), reasoning: r.join('; ') });
    }
    if (!habitats.length) return habitats;
  }

  const d = Math.abs(depth);

  if (absLat <= 30 && d > 0 && d <= 40) {
    let conf = 0.5, r = ['tropical (' + absLat.toFixed(1) + '°)', 'depth ' + d + 'm'];
    if (sst !== null && sst >= 22 && sst <= 32) { conf += 0.2; r.push('SST ' + sst + '°C optimal'); }
    if (sst !== null && sst < 20) { conf -= 0.3; r.push('SST ' + sst + '°C too cold'); }
    if (chlor !== null && chlor < 1) { conf += 0.1; r.push('clear water (low chlor)'); }
    if (conf > 0.15) habitats.push({ type: 'Coral Reef', confidence: Math.max(0, Math.min(1, conf)), reasoning: r.join('; ') });
  }

  if (absLat <= 60 && d > 0 && d <= 50) {
    let conf = 0.35, r = ['depth ' + d + 'm (photic zone)'];
    if (d <= 20) { conf += 0.15; r.push('very shallow'); }
    if (sst !== null && sst >= 10 && sst <= 32) { conf += 0.1; r.push('SST within tolerance'); }
    if (slope !== null && slope < 2) { conf += 0.15; r.push('flat substrate (slope ' + slope + '°)'); }
    habitats.push({ type: 'Seagrass Meadow', confidence: Math.min(1, conf), reasoning: r.join('; ') });
  }

  if (absLat <= 32 && d >= 0 && d <= 5) {
    let conf = 0.4, r = ['intertidal depth (' + d + 'm)'];
    if (sst !== null && sst >= 20) { conf += 0.2; r.push('warm SST ' + sst + '°C'); }
    if (absLat <= 25) { conf += 0.1; r.push('core mangrove latitude'); }
    habitats.push({ type: 'Mangrove', confidence: Math.min(1, conf), reasoning: r.join('; ') });
  }

  if (d > 0 && d <= 100 && slope !== null && slope >= 3) {
    let conf = 0.35, r = ['depth ' + d + 'm', 'slope ' + slope + '°'];
    if (slope >= 8) { conf += 0.2; r.push('steep — strong indicator'); }
    if (sst !== null && sst >= 8 && sst <= 24) { conf += 0.1; r.push('temperate SST'); }
    habitats.push({ type: 'Rocky Reef', confidence: Math.min(1, conf), reasoning: r.join('; ') });
  }

  if (absLat >= 30 && absLat <= 65 && d > 0 && d <= 40) {
    let conf = 0.25, r = ['temperate latitude (' + absLat.toFixed(1) + '°)'];
    if (sst !== null && sst >= 5 && sst <= 20) { conf += 0.25; r.push('cool SST ' + sst + '°C'); }
    if (slope !== null && slope >= 2) { conf += 0.1; r.push('substrate relief'); }
    habitats.push({ type: 'Kelp Forest', confidence: Math.min(1, conf), reasoning: r.join('; ') });
  }

  if (d >= 0 && d <= 10 && chlor !== null && chlor > 3) {
    habitats.push({ type: 'Estuarine / Lagoon', confidence: 0.4, reasoning: 'very shallow, high chlorophyll (' + chlor.toFixed(1) + ' mg/m³)' });
  }

  if (d > 200) {
    habitats.push({ type: 'Deep Sea / Pelagic', confidence: 0.85, reasoning: 'depth ' + d + 'm — beyond shelf' });
    if (slope !== null && slope > 10 && d > 1500) {
      habitats.push({ type: 'Hydrothermal Vent Zone (speculative)', confidence: 0.15, reasoning: 'extreme depth + steep slope (' + slope + '°)' });
    }
  } else if (d > 100) {
    habitats.push({ type: 'Continental Shelf (outer)', confidence: 0.6, reasoning: 'depth ' + d + 'm' });
  } else if (d > 50) {
    habitats.push({ type: 'Continental Shelf (inner)', confidence: 0.5, reasoning: 'depth ' + d + 'm' });
  }

  habitats.sort((a, b) => b.confidence - a.confidence);
  return habitats;
}
window.inferMarineHabitat = inferMarineHabitat;
// ═══ NOAA FILTERS — active filtering ═══
const _filterMap={sst:{min:'noaa-sst-min',max:'noaa-sst-max'},chlor:{min:'noaa-chlor-min',max:'noaa-chlor-max'}};
window._noaaFilters=null;
function applyNoaaFilters(){
  window._noaaFilters={
    sstMin:parseFloat($('#noaa-sst-min').value),sstMax:parseFloat($('#noaa-sst-max').value),
    depthMin:parseFloat($('#noaa-depth-min').value),depthMax:parseFloat($('#noaa-depth-max').value),
    chlorMin:parseFloat($('#noaa-chlor-min').value),chlorMax:parseFloat($('#noaa-chlor-max').value)};
  const btn=document.querySelector('#noaa-filters .bt');
  if(btn){btn.textContent='Filters applied \u2713';setTimeout(()=>{btn.textContent='Apply to Fetch'},2000)}
  toast('Filters active — fetch will filter data: SST '+window._noaaFilters.sstMin+'–'+window._noaaFilters.sstMax+'°C, Chlor '+window._noaaFilters.chlorMin+'–'+window._noaaFilters.chlorMax+'mg/m³','ok')}

// ═══ LAND MASK (IndexedDB-cached) ═══
async function loadLandMask(){
  if(!_envMap)return;
  const geoKey='ne_110m_land';
  const renderGeo=geo=>{_landMaskLayer=L.geoJSON(geo,{pane:'landMask',style:{fillColor:'#4A4A4A',fillOpacity:1,color:'#666666',weight:1.2},interactive:false}).addTo(_envMap)};
  try{
    if(!db)await openDB();
    const tx=db.transaction('geo','readonly');const req=tx.objectStore('geo').get(geoKey);
    req.onsuccess=()=>{
      if(req.result&&req.result.data){renderGeo(req.result.data);return}
      fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')
        .then(r=>r.json()).then(geo=>{renderGeo(geo);try{const wtx=db.transaction('geo','readwrite');wtx.objectStore('geo').put({id:geoKey,data:geo})}catch(e){}}).catch(()=>{})};
    req.onerror=()=>{
      fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')
        .then(r=>r.json()).then(geo=>renderGeo(geo)).catch(()=>{})}
  }catch(e){
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')
      .then(r=>r.json()).then(geo=>renderGeo(geo)).catch(()=>{})}}

// ═══ HD COASTLINE (10m, IndexedDB-cached) ═══
async function loadHDCoastline(){
  if(!_envMap)return;
  const geoKey='ne_10m_coastline';
  const renderCoast=geo=>{const style=_satTileLayer&&_envMap.hasLayer(_satTileLayer)?{color:'#FFD700',weight:1,opacity:0.7}:{color:'#666666',weight:0.8,opacity:0.6};
    _coastlineLayer=L.geoJSON(geo,{pane:'landMask',style,interactive:false}).addTo(_envMap)};
  try{
    if(!db)await openDB();
    const tx=db.transaction('geo','readonly');const req=tx.objectStore('geo').get(geoKey);
    req.onsuccess=()=>{
      if(req.result?.data){renderCoast(req.result.data);return}
      fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson')
        .then(r=>r.json()).then(geo=>{renderCoast(geo);try{const wtx=db.transaction('geo','readwrite');wtx.objectStore('geo').put({id:geoKey,data:geo})}catch{}}).catch(()=>{})};
    req.onerror=()=>{fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson')
      .then(r=>r.json()).then(geo=>renderCoast(geo)).catch(()=>{})}
  }catch{fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson')
    .then(r=>r.json()).then(geo=>renderCoast(geo)).catch(()=>{})}}

// ═══ BASEMAP TOGGLE ═══
function switchBasemap(mode){
  if(!_envMap)return;
  const darkBtn=$('#base-dark'),satBtn=$('#base-sat');
  if(mode==='satellite'){
    if(_baseTileLayer&&_envMap.hasLayer(_baseTileLayer))_envMap.removeLayer(_baseTileLayer);
    if(_satTileLayer&&!_envMap.hasLayer(_satTileLayer)){_satTileLayer.addTo(_envMap);_satTileLayer.bringToBack()}
    if(_landMaskLayer)_landMaskLayer.setStyle({fillOpacity:0,color:'#FFD700',weight:1.5});
    if(_coastlineLayer)_coastlineLayer.setStyle({color:'#FFD700',weight:1,opacity:0.8});
    if(darkBtn)darkBtn.classList.remove('on');if(satBtn)satBtn.classList.add('on');
  }else{
    if(_satTileLayer&&_envMap.hasLayer(_satTileLayer))_envMap.removeLayer(_satTileLayer);
    if(_baseTileLayer&&_envMap.hasLayer(_baseTileLayer))_envMap.removeLayer(_baseTileLayer);
    if(_landMaskLayer)_landMaskLayer.setStyle({fillOpacity:1,fillColor:'#4A4A4A',color:'#666666',weight:1.2});
    if(_coastlineLayer)_coastlineLayer.setStyle({color:'#666666',weight:0.8,opacity:0.6});
    if(darkBtn)darkBtn.classList.add('on');if(satBtn)satBtn.classList.remove('on')}}

// ═══ MEASUREMENT TOOLS ═══
function toggleMeasure(){
  _measureMode=!_measureMode;
  const btn=$('#measureBtn');if(btn)btn.classList.toggle('on',_measureMode);
  if(!_envMap)return;
  if(_measureMode){
    _measurePoints=[];_measureLayers.forEach(l=>_envMap.removeLayer(l));_measureLayers=[];
    _envMap.getContainer().style.cursor='crosshair';
    _envMap.doubleClickZoom.disable();
    _envMap.on('click',measureClick);_envMap.on('dblclick',measureFinish);
    document.addEventListener('keydown',measureEscape);
    toast('Click to add points, double-click to finish, Esc to cancel','info');
  }else{clearMeasure()}}
function measureClick(e){
  if(!_measureMode)return;
  _measurePoints.push(e.latlng);
  const m=L.circleMarker(e.latlng,{radius:4,color:'#D4A04A',fillColor:'#D4A04A',fillOpacity:1}).addTo(_envMap);
  _measureLayers.push(m);
  if(_measurePoints.length>1){
    const p=_measurePoints,i=p.length-1;
    const line=L.polyline([p[i-1],p[i]],{color:'#D4A04A',weight:2,dashArray:'5,5'}).addTo(_envMap);
    _measureLayers.push(line);
    const dist=haversineDistance(p[i-1].lat,p[i-1].lng,p[i].lat,p[i].lng);
    const mid=L.latLng((p[i-1].lat+p[i].lat)/2,(p[i-1].lng+p[i].lng)/2);
    const tip=L.tooltip({permanent:true,direction:'center',className:'measure-tip'}).setLatLng(mid).setContent(dist<1?(dist*1000).toFixed(0)+' m':dist.toFixed(2)+' km').addTo(_envMap);
    _measureLayers.push(tip)}}
function measureFinish(){if(!_measureMode||_measurePoints.length<2)return;
  let total=0;for(let i=1;i<_measurePoints.length;i++)total+=haversineDistance(_measurePoints[i-1].lat,_measurePoints[i-1].lng,_measurePoints[i].lat,_measurePoints[i].lng);
  toast('Total: '+(total<1?(total*1000).toFixed(0)+' m':total.toFixed(2)+' km'),'ok',5000);
  _measureMode=false;$('#measureBtn')?.classList.remove('on');_envMap.getContainer().style.cursor='';
  _envMap.off('click',measureClick);_envMap.off('dblclick',measureFinish);_envMap.doubleClickZoom.enable();document.removeEventListener('keydown',measureEscape)}
function measureEscape(e){if(e.key==='Escape'&&_measureMode)clearMeasure()}
function clearMeasure(){_measureMode=false;_measurePoints=[];_measureLayers.forEach(l=>{if(_envMap)_envMap.removeLayer(l)});_measureLayers=[];
  if(_envMap){_envMap.getContainer().style.cursor='';_envMap.off('click',measureClick);_envMap.off('dblclick',measureFinish);_envMap.doubleClickZoom.enable()}
  document.removeEventListener('keydown',measureEscape);$('#measureBtn')?.classList.remove('on')}

// ═══ ISOBATHS (bathymetric contours via D3) ═══
function toggleIsobaths(){
  if(!_envMap)return;
  const btn=$('#isobathBtn');
  if(_isobathLayer){_envMap.removeLayer(_isobathLayer);_isobathLayer=null;btn?.classList.remove('on');return}
  btn?.classList.add('on');
  toast('Loading isobaths...','info');
  fetchIsobaths()}
async function fetchIsobaths(){
  if(!_envMap)return;
  const b=_envMap.getBounds(),sw=b.getSouthWest(),ne=b.getNorthEast();
  const latSpan=ne.lat-sw.lat,lonSpan=ne.lng-sw.lng;
  const maxPts=100,latStride=Math.max(1,Math.ceil(latSpan/(maxPts*0.0166667))),lonStride=Math.max(1,Math.ceil(lonSpan/(maxPts*0.0166667)));
  const sLat=Math.max(-90,Math.floor(sw.lat*10)/10),nLat=Math.min(90,Math.ceil(ne.lat*10)/10),wLon=Math.max(-180,Math.floor(sw.lng*10)/10),eLon=Math.min(180,Math.ceil(ne.lng*10)/10);
  const cacheKey=sLat+'_'+nLat+'_'+wLon+'_'+eLon+'_'+latStride;
  if(_isobathCache?.key===cacheKey&&_isobathCache.layer){_isobathLayer=_isobathCache.layer.addTo(_envMap);return}
  try{
    const url=`https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.json?altitude[(${sLat}):${latStride}:(${nLat})][(${wLon}):${lonStride}:(${eLon})]`;
    const r=await erddapFetch(url,30000);if(!r.ok)throw new Error('ETOPO HTTP '+r.status);
    const data=await r.json();const rows=data.table?.rows||[];
    if(!rows.length){toast('No bathymetry data in view','err');return}
    const lats=[...new Set(rows.map(r=>r[0]))].sort((a,b)=>a-b);
    const lons=[...new Set(rows.map(r=>r[1]))].sort((a,b)=>a-b);
    const nx=lons.length,ny=lats.length;
    const grid={};rows.forEach(r=>{grid[r[0]+'_'+r[1]]=r[2]});
    const values=new Array(nx*ny);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)values[j*nx+i]=-(grid[lats[j]+'_'+lons[i]]||0);
    const thresholds=[50,100,200,500,1000,2000];
    const contours=d3.contours().size([nx,ny]).thresholds(thresholds)(values);
    const features=[];
    contours.forEach(c=>{
      const coords=c.coordinates.map(ring=>ring.map(poly=>poly.map(pt=>{
        const xi=pt[0],yi=pt[1];
        const lonV=lons[0]+(xi/Math.max(1,nx-1))*(lons[lons.length-1]-lons[0]);
        const latV=lats[0]+(yi/Math.max(1,ny-1))*(lats[lats.length-1]-lats[0]);
        return[lonV,latV]})));
      features.push({type:'Feature',properties:{depth:c.value},geometry:{type:c.type==='MultiPolygon'?'MultiPolygon':'Polygon',coordinates:c.type==='MultiPolygon'?coords:coords[0]||[]}})});
    const gj={type:'FeatureCollection',features};
    const colors={'50':'#4A6B8A','100':'#3A5B7A','200':'#2E4F6E','500':'#234060','1000':'#1A3050','2000':'#112040'};
    _isobathLayer=L.geoJSON(gj,{style:f=>{const d=f.properties.depth;return{color:colors[d]||'#2A4A6A',weight:1.2,opacity:0.7,fill:false}},
      onEachFeature:(f,layer)=>{layer.bindTooltip(f.properties.depth+'m',{sticky:true,className:'isobath-tip'})}}).addTo(_envMap);
    _isobathCache={key:cacheKey,layer:_isobathLayer};
  }catch(e){console.error('Isobath error:',e);toast('Failed to load isobaths: '+e.message,'err');$('#isobathBtn')?.classList.remove('on')}}

// ═══ GRATICULE (coordinate grid) ═══
function toggleGraticule(){
  if(!_envMap)return;
  const btn=$('#gratBtn');
  if(_graticuleLayer){_envMap.removeLayer(_graticuleLayer);_graticuleLayer=null;_envMap.off('moveend',updateGraticule);btn?.classList.remove('on');return}
  btn?.classList.add('on');
  _graticuleLayer=L.layerGroup().addTo(_envMap);
  updateGraticule();
  _envMap.on('moveend',updateGraticule)}
function updateGraticule(){
  if(!_graticuleLayer||!_envMap)return;
  _graticuleLayer.clearLayers();
  const z=_envMap.getZoom();
  const step=z<=2?30:z<=4?10:z<=6?5:z<=8?2:1;
  const b=_envMap.getBounds();
  const startLat=Math.floor(b.getSouth()/step)*step,endLat=Math.ceil(b.getNorth()/step)*step;
  const startLon=Math.floor(b.getWest()/step)*step,endLon=Math.ceil(b.getEast()/step)*step;
  // Cap total lines to prevent DOM overload
  const maxLines=60,latCount=Math.round((endLat-startLat)/step),lonCount=Math.round((endLon-startLon)/step);
  const effStep=(latCount+lonCount>maxLines)?step*Math.ceil((latCount+lonCount)/maxLines):step;
  const sLat=Math.floor(b.getSouth()/effStep)*effStep,eLat=Math.ceil(b.getNorth()/effStep)*effStep;
  const sLon=Math.floor(b.getWest()/effStep)*effStep,eLon=Math.ceil(b.getEast()/effStep)*effStep;
  for(let lat=sLat;lat<=eLat;lat+=effStep){
    L.polyline([[lat,sLon],[lat,eLon]],{color:'rgba(201,149,107,0.15)',weight:0.5,interactive:false}).addTo(_graticuleLayer);
    L.tooltip({permanent:true,direction:'right',className:'grat-label'}).setLatLng([lat,b.getWest()]).setContent(_coordDMS?toDMS(Math.abs(lat))+(lat>=0?'N':'S'):lat+'°').addTo(_graticuleLayer)}
  for(let lon=sLon;lon<=eLon;lon+=effStep){
    L.polyline([[sLat,lon],[eLat,lon]],{color:'rgba(201,149,107,0.15)',weight:0.5,interactive:false}).addTo(_graticuleLayer);
    L.tooltip({permanent:true,direction:'top',className:'grat-label'}).setLatLng([b.getSouth(),lon]).setContent(_coordDMS?toDMS(Math.abs(lon))+(lon>=0?'E':'W'):lon+'°').addTo(_graticuleLayer)}}

// ═══ DMS COORDINATE FORMAT TOGGLE ═══
function toggleDMS(){
  _coordDMS=!_coordDMS;
  const btn=$('#dmsBtn');if(btn)btn.classList.toggle('on',_coordDMS);
  // Readout handler already checks _coordDMS flag — no rebinding needed
  if(_graticuleLayer)updateGraticule();
  toast(_coordDMS?'DMS format enabled':'Decimal degrees format','info')}

// ═══ ADDITIONAL GIBS LAYERS ═══
function toggleGIBSLayer(type){
  if(!_envMap)return;
  const cfg={
    truecolor:{id:'gibsTC',url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
      maxZoom:9,btn:'gibsTCBtn'},
    seaice:{id:'gibsIce',url:'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Sea_Ice/default/{time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
      maxZoom:7,btn:'gibsIceBtn'}};
  const c=cfg[type];if(!c)return;
  const btn=$('#'+c.btn);
  if(_gibsLayers[c.id]){
    if(_envMap.hasLayer(_gibsLayers[c.id])){_envMap.removeLayer(_gibsLayers[c.id]);btn?.classList.remove('on')}
    else{_gibsLayers[c.id].addTo(_envMap);btn?.classList.add('on')}
    return}
  _gibsLayers[c.id]=L.tileLayer(c.url,{time:gibsDate(),maxZoom:c.maxZoom,maxNativeZoom:c.maxZoom,
    opacity:0.85,pane:'wmsPane',keepBuffer:2,updateWhenZooming:false,updateWhenIdle:true,crossOrigin:'anonymous'}).addTo(_envMap);
  btn?.classList.add('on')}

// ═══ MAP EXPORT ═══
function exportMap(){
  if(!_envMap){toast('Map not initialized','err');return}
  toast('Preparing export...','info');
  try{
    const mapEl=document.getElementById('envMap');
    const canvas=document.createElement('canvas');
    const rect=mapEl.getBoundingClientRect();
    canvas.width=rect.width*2;canvas.height=rect.height*2;
    const ctx=canvas.getContext('2d');ctx.scale(2,2);
    // Capture all tile layers
    const tiles=mapEl.querySelectorAll('.leaflet-tile-pane img');
    const paneTransform=mapEl.querySelector('.leaflet-map-pane')?.style.transform||'';
    const match=paneTransform.match(/translate3d\(([^,]+),\s*([^,]+)/);
    const panX=match?parseFloat(match[1]):0,panY=match?parseFloat(match[2]):0;
    tiles.forEach(img=>{try{
      const tilePane=img.closest('.leaflet-tile-container');
      const tpT=tilePane?.style.transform||'';const tpM=tpT.match(/translate3d\(([^,]+),\s*([^,]+)/);
      const tpX=tpM?parseFloat(tpM[1]):0,tpY=tpM?parseFloat(tpM[2]):0;
      const s=img.style;const left=parseFloat(s.left||img.offsetLeft);const top=parseFloat(s.top||img.offsetTop);
      const w=img.width||256,h=img.height||256;
      ctx.drawImage(img,panX+tpX+left,panY+tpY+top,w,h)}catch{}});
    // Draw overlay: coordinates + timestamp
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,rect.height-35,rect.width,35);
    ctx.fillStyle='#E8E0D6';ctx.font='11px Inconsolata, monospace';
    const center=_envMap.getCenter();
    const coordText=_coordDMS?formatCoordDMS(center.lat,center.lng):center.lat.toFixed(4)+'°N, '+center.lng.toFixed(4)+'°E';
    ctx.fillText('Meridian · '+coordText+' · z'+_envMap.getZoom()+' · '+new Date().toISOString().split('T')[0],8,rect.height-12);
    // Download
    canvas.toBlob(blob=>{if(!blob){toast('Export failed — cross-origin tiles','err');return}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='meridian-map-'+Date.now()+'.png';a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Map exported','ok')},'image/png');
  }catch(e){console.error('Map export error:',e);toast('Export failed: '+e.message,'err')}}

// ═══ FULLSCREEN TOGGLE ═══
function toggleMapFullscreen(){
  const el=document.getElementById('envMap');if(!el)return;
  const btn=$('#mapFullscreen');
  if(!document.fullscreenElement){
    el.requestFullscreen().then(()=>{if(btn)btn.textContent='Exit';setTimeout(()=>_envMap&&_envMap.invalidateSize(),150)}).catch(()=>{})}
  else{document.exitFullscreen().then(()=>{if(btn)btn.textContent='Expand';setTimeout(()=>_envMap&&_envMap.invalidateSize(),150)}).catch(()=>{})}}

// ═══ WMS LEGEND CONTROL ═══
const _mapLegendUrls={
  sst:'inline:sst',
  sst_anom:'inline:sst_anom',
  chlor:'inline:chlor',
  par:'inline:par'};
const _inlineLegends={
  sst:{grad:'linear-gradient(90deg,#00008B,#0000FF,#00BFFF,#00FF00,#FFFF00,#FF8C00,#FF0000)',min:'0°C',max:'32°C'},
  sst_anom:{grad:'linear-gradient(90deg,#00008B,#4169E1,#B0C4DE,#FFFFFF,#F0C0C0,#DC143C,#8B0000)',min:'-5°C',max:'+5°C'},
  chlor:{grad:'linear-gradient(90deg,#440154,#3B528B,#21918C,#5EC962,#FDE725)',min:'0.01',max:'20 mg/m³'},
  par:{grad:'linear-gradient(90deg,#440154,#3B528B,#21918C,#5EC962,#FDE725)',min:'0',max:'0.5 m⁻¹'}};
let _legendControl=null;
function updateLegendControl(){
  if(!_envMap)return;
  const active=Object.keys(_mapLayers).filter(id=>_envMap.hasLayer(_mapLayers[id])&&_mapLegendUrls[id]);
  if(!active.length){if(_legendControl){_envMap.removeControl(_legendControl);_legendControl=null}return}
  if(!_legendControl){
    const Leg=L.Control.extend({options:{position:'bottomright'},
      onAdd:function(){const div=L.DomUtil.create('div','map-legend');L.DomEvent.disableClickPropagation(div);return div}});
    _legendControl=new Leg();_envMap.addControl(_legendControl)}
  const container=_legendControl.getContainer();
  container.innerHTML='<div class="ml-title">Legend</div>'+active.map(id=>{
    const nm={sst:'SST',sst_anom:'SST Anomaly',chlor:'Chlorophyll',par:'Kd(PAR)'}[id]||id;
    const url=_mapLegendUrls[id];
    if(url.startsWith('inline:')){const k=url.split(':')[1],il=_inlineLegends[k];if(!il)return'';
      return`<div style="font-size:10px;color:var(--ts);margin:4px 0 2px">${nm}</div><div class="inline-legend" style="background:${il.grad}"></div><div class="inline-legend-labels"><span>${il.min}</span><span>${il.max}</span></div>`}
    return`<div style="font-size:10px;color:var(--ts);margin:4px 0 2px">${nm}</div><img src="${url}" alt="${nm} legend" onerror="this.style.display='none'"/>`}).join('')}

// ═══ WMS OPACITY SLIDER ═══
function setWmsOpacity(val){const v=parseFloat(val);Object.keys(_mapLayers).forEach(id=>{if(_mapLayers[id]?.setOpacity)_mapLayers[id].setOpacity(v)});Object.keys(_gibsLayers).forEach(id=>{if(_gibsLayers[id]?.setOpacity)_gibsLayers[id].setOpacity(v)})}

// ═══ CLICK-TO-QUERY (GetFeatureInfo via griddap) ═══
let _wmsQueryMode=false;
function getWmsQueryDefs(){
  const defs={};
  ['sst','sst_anom','chlor','par'].forEach(id=>{
    const v=EV.find(x=>x.id===id);if(!v)return;
    let src=v;
    if(isServerDown(v.server)&&v.alt&&!isServerDown(v.alt.server)){src={...v,...v.alt}}
    defs[id]={ds:src.ds,v:src.v,server:src.server,nm:v.nm,u:v.u,dm:src.dm||v.dm,z:src.z||v.z,lon360:src.lon360??v.lon360??false}});
  defs.bath={ds:'etopo180',v:'altitude',server:'https://coastwatch.pfeg.noaa.gov/erddap',nm:'Depth',u:'m',dm:2};
  return defs}
function toggleWmsQuery(){
  const btn=$('#wmsQueryBtn');
  // Guard: if turning on, check for active queryable layers
  if(!_wmsQueryMode){
    const defs=getWmsQueryDefs();
    const active=Object.keys(_mapLayers).filter(id=>_envMap&&_envMap.hasLayer(_mapLayers[id])&&defs[id]);
    if(!active.length){toast('Enable a data layer first (SST, Chlor, etc.) before using Query','info');return}}
  _wmsQueryMode=!_wmsQueryMode;
  if(btn)btn.classList.toggle('on',_wmsQueryMode);
  if(_envMap){const el=_envMap.getContainer();el.style.cursor=_wmsQueryMode?'crosshair':''}}
async function queryWmsLayers(latlng){
  const _qDefs=getWmsQueryDefs();
  const active=Object.keys(_mapLayers).filter(id=>_envMap.hasLayer(_mapLayers[id])&&_qDefs[id]);
  if(!active.length){toast('Enable a WMS layer first (SST, Chlor, etc.)','err');return}
  const lat=latlng.lat.toFixed(2),lon=latlng.lng.toFixed(2);
  const popup=L.popup({className:'dark-popup'}).setLatLng(latlng).setContent('<span style="color:var(--tm)">Querying...</span>').openOn(_envMap);
  const results=[];
  for(const id of active){
    const q=_qDefs[id];const lonVal=q.lon360&&parseFloat(lon)<0?(360+parseFloat(lon)).toFixed(2):lon;
    try{
      if(q.dm===2){
        const b=await fetchBathymetry(lat,lon);
        results.push(`<b>${q.nm}:</b> ${b.depth.toFixed(1)} m`);
        results.push(`<b>Slope:</b> ${b.slope.toFixed(2)}°`);
      }else{
        const zQ=q.dm===4?`[${q.z}]`:'';
        const url=`${q.server}/griddap/${q.ds}.json?${q.v}[(last)]${zQ}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
        const r=await erddapFetch(url,12000);if(r.ok){const d=await r.json();const rows=d.table?.rows||[];
          const val=rows.length?rows[rows.length-1][rows[0].length-1]:null;
          if(val!=null)results.push(`<b>${q.nm}:</b> ${val.toFixed(3)} ${q.u}`)
          else results.push(`<b>${q.nm}:</b> <span style="color:var(--tm)">no data</span>`)
        }else results.push(`<b>${q.nm}:</b> <span style="color:var(--co)">error</span>`)}
    }catch(e){results.push(`<b>${q.nm}:</b> <span style="color:var(--co)">${e.message?.slice(0,30)||'error'}</span>`)}}
  popup.setContent(`<div style="font-size:12px;line-height:1.8"><div style="color:var(--tm);margin-bottom:4px">${lat}°N, ${lon}°E (latest)</div>${results.join('<br>')}</div>`)}

// ═══ PLACE SEARCH (Nominatim Geocoding) ═══
let _geoLastReq=0;
const _geoDebounce=debounce(geoLookup,300);
$('#geoSearch')?.addEventListener('input',function(){if(this.value.length>=3)_geoDebounce()});
function geoLookup(){
  const q=$('#geoSearch')?.value?.trim();if(!q||q.length<2)return;
  const dd=$('#geoResults');if(!dd)return;
  const now=Date.now();if(now-_geoLastReq<1000){setTimeout(geoLookup,1000-(now-_geoLastReq));return}
  _geoLastReq=Date.now();
  dd.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--ts);pointer-events:none">Searching\u2026</div>';dd.style.display='block';
  fetchT('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q)+'&limit=5',10000)
  .then(r=>r.json()).then(results=>{
    if(!results.length){dd.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--ts);pointer-events:none">No results for \u201c'+escHTML(q)+'\u201d</div>';return}
    window._geoResults=results.map(r=>({lat:parseFloat(r.lat),lon:parseFloat(r.lon),name:r.display_name.slice(0,60)}));
    dd.innerHTML=results.map((r,i)=>`<div data-geo-idx="${i}">${escHTML(r.display_name.slice(0,55))}${r.display_name.length>55?'...':''}<small>${r.type||''} · ${parseFloat(r.lat).toFixed(2)}°N ${parseFloat(r.lon).toFixed(2)}°E</small></div>`).join('')
  }).catch(()=>{dd.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--co);pointer-events:none">Search failed</div>'})}
function geoSelect(lat,lon,name){
  $('#elat').value=parseFloat(lat).toFixed(4);$('#elon').value=parseFloat(lon).toFixed(4);
  if(_envMap){_envMap.setView([lat,lon],8);if(_envMarker)_envMarker.setLatLng([lat,lon])}
  const dd=$('#geoResults');if(dd)dd.style.display='none';
  $('#geoSearch').value=name;toast('Location: '+name,'ok')}
// Delegated geo result click handler (avoids inline onclick XSS)
$('#geoResults')?.addEventListener('click',function(e){const row=e.target.closest('[data-geo-idx]');if(!row)return;const idx=+row.dataset.geoIdx;const r=window._geoResults?.[idx];if(r)geoSelect(r.lat,r.lon,r.name)});
document.addEventListener('click',function(e){const dd=$('#geoResults');if(dd&&!e.target.closest('.geo-wrap'))dd.style.display='none'});
$('#geoSearch')?.addEventListener('keydown',function(e){if(e.key==='Escape'){$('#geoResults').style.display='none';this.blur()}});

// ═══ THRESHOLD / EXCEEDANCE HIGHLIGHTING ═══
function renderThresholdPanel(tk){
  if(!tk||!tk.length){H('#ethresholds','');return}
  const opts=tk.map(id=>`<option value="${id}">${S.envTS[id]?.nm||id}</option>`).join('');
  H('#ethresholds',`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Threshold:</span><select class="fs" id="threshVar">${opts}</select><select class="fs" id="threshOp" style="width:50px"><option value=">">&gt;</option><option value="<">&lt;</option><option value=">=">&ge;</option><option value="<=">&le;</option></select><input class="fi" id="threshVal" placeholder="Value" style="width:70px" type="number" step="any"/><button class="bt sm bt-pri" onclick="applyThreshold()">Highlight</button><button class="bt sm" onclick="clearThreshold()" style="color:var(--co)">Clear</button></div><div id="threshStats" style="font-size:11px;font-family:var(--mf);color:var(--tm)"></div>`)}
function applyThreshold(){
  const id=$('#threshVar')?.value;const op=$('#threshOp')?.value;const val=parseFloat($('#threshVal')?.value);
  if(!id||!S.envTS[id]||isNaN(val)){toast('Set variable and threshold value','err');return}
  const data=S.envTS[id].data;
  const test=op==='>'?(v=>v>val):op==='<'?(v=>v<val):op==='>='?(v=>v>=val):(v=>v<=val);
  // Find exceedance runs
  const shapes=[];let inRun=false,runStart=null,exceed=0,maxRun=0,curRun=0;
  data.forEach((d,i)=>{
    if(test(d.value)){exceed++;curRun++;if(!inRun){inRun=true;runStart=d.time}}
    else{if(inRun){shapes.push({type:'rect',xref:'x',yref:'paper',x0:runStart,x1:data[i-1].time,y0:0,y1:1,
      fillcolor:'rgba(194,120,120,0.15)',line:{width:0}});if(curRun>maxRun)maxRun=curRun;curRun=0;inRun=false}}});
  if(inRun){shapes.push({type:'rect',xref:'x',yref:'paper',x0:runStart,x1:data[data.length-1].time,y0:0,y1:1,
    fillcolor:'rgba(194,120,120,0.15)',line:{width:0}});if(curRun>maxRun)maxRun=curRun}
  // Also add threshold line
  shapes.push({type:'line',xref:'paper',x0:0,x1:1,yref:'y',y0:val,y1:val,line:{color:'#C27878',width:1.5,dash:'dash'}});
  try{Plotly.relayout('ep-'+id,{shapes})}catch{}
  const pct=data.length?(exceed/data.length*100).toFixed(1):'0';
  H('#threshStats',`${S.envTS[id].nm} ${op} ${val}: <span style="color:var(--co)">${pct}%</span> exceedance (${exceed}/${data.length} points), longest run: ${maxRun} points`);
  toast(`Threshold applied: ${pct}% exceedance`,'ok')}
function clearThreshold(){
  const id=$('#threshVar')?.value;if(!id)return;
  try{Plotly.relayout('ep-'+id,{shapes:[]})}catch{}
  H('#threshStats','');toast('Threshold cleared','info')}

// ═══ REPLACE ALERTS WITH TOAST (only for short, known Meridian alerts) ═══
const _origAlert=window.alert;
window.alert=function(msg){
  if(typeof msg==='string'&&msg.length<200&&!msg.includes('[object')){toast(msg,msg.toLowerCase().includes('error')||msg.toLowerCase().includes('fail')||msg.toLowerCase().includes('need')?'err':'info')}
  else{_origAlert(msg)}
};

// ═══ KEYBOARD SHORTCUTS ═══
document.addEventListener('keydown',e=>{
  // Ctrl/Cmd+1-6 for tab switching
  if((e.ctrlKey||e.metaKey)&&e.key>='1'&&e.key<='8'){
    e.preventDefault();const tabs=['lit','species','env','library','publications','archive','fielddata','workshop'];const idx=parseInt(e.key)-1;
    if(tabs[idx])goTab(tabs[idx]);if(tabs[idx]==='env')requestAnimationFrame(initEnvMap)}
  // Ctrl+B toggle sidebar
  if((e.ctrlKey||e.metaKey)&&e.key==='b'&&!e.shiftKey&&!e.altKey){e.preventDefault();const sb=document.getElementById('sidebar');if(sb){if(window.innerWidth<768){sb.classList.toggle('mobile-open');document.getElementById('sidebar-backdrop')?.classList.toggle('show')}else{sb.classList.toggle('expanded')}}}
  // Ctrl/Cmd+Enter to trigger search on active tab
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    e.preventDefault();
    if($('#tab-lit.on'))$('#lsb').click();
    else if($('#tab-species.on'))$('#ssb').click();
    else if($('#tab-env.on'))$('#efb').click();
    else if($('#tab-ai.on'))sCh()}
  // Ctrl/Cmd+Z in Workshop for undo
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&$('#tab-workshop.on')&&_wsUndo.length){e.preventDefault();wsUndo()}
  // Y/N/M for screening (only when screening active and not in input)
  // Escape key closes modals
  if(e.key==='Escape'){
    const pdfM=$('#pdf-viewer-modal');if(pdfM&&pdfM.style.display==='flex'){closePdfViewer();return}
    const citeO=$('#citePanelOverlay');if(citeO){citeO.remove();return}
    const errC=$('#err-console');if(errC){errC.remove();return}
    const batchM=$('#batchImportModal');if(batchM){batchM.remove();return}
    const bmSeed=$('#bm-seed-overlay');if(bmSeed){bmSeed.remove();return}
    const overlay=document.querySelector('.meridian-modal-overlay');if(overlay){overlay.remove();return}}
  if(_screeningActive&&!e.ctrlKey&&!e.metaKey&&!e.target.closest('input,textarea,select')){
    if(e.key==='y'||e.key==='Y'){e.preventDefault();screenPaper('include',$('#screenReason')?.value)}
    if(e.key==='n'||e.key==='N'){e.preventDefault();screenPaper('exclude',$('#screenReason')?.value)}
    if(e.key==='m'||e.key==='M'){e.preventDefault();screenPaper('maybe',$('#screenReason')?.value)}}
});

// ═══ TAB-AWARE MAP INIT ═══
$$('.sb-item').forEach(t=>t.addEventListener('click',()=>{if(t.dataset.tab==='env')requestAnimationFrame(initEnvMap)}));

openDB().then(loadLib).then(async()=>{S.cols=await loadCols();renderLib();
  // Load persisted chat
  try{const saved=await dbGetChat();if(saved?.length){S.chatM=saved}}catch(e){console.warn('Chat load:',e)}
  try{rCh()}catch(e){console.warn('Chat render:',e)}
  // Migrate legacy key (plaintext → encrypted)
  const legacyKey=localStorage.getItem('meridian_key');
  if(legacyKey){_keyVault.store('meridian_key_anthropic',legacyKey).then(()=>localStorage.removeItem('meridian_key'))}
  // Migrate any existing plaintext keys to encrypted
  for(const prov of Object.keys(AI_PROVIDERS)){
    const raw=localStorage.getItem('meridian_key_'+prov);
    if(raw&&!raw.startsWith('enc:')){_keyVault.store('meridian_key_'+prov,raw)}
  }
  // Restore provider and model
  const savedProv=localStorage.getItem('meridian_provider')||'anthropic';
  S.aiProvider=AI_PROVIDERS[savedProv]?savedProv:'anthropic';
  const savedModel=localStorage.getItem('meridian_model_'+S.aiProvider);
  const provInfo=AI_PROVIDERS[S.aiProvider];
  if(savedModel&&provInfo?.models.includes(savedModel))S.aiModel=savedModel;
  else if(provInfo)S.aiModel=provInfo.defaultModel;
  _syncAllProviderDropdowns();
  _keyVault.retrieve('meridian_key_'+S.aiProvider).then(sk=>{
    if(sk){S.apiK=sk;const ai=$('#aki');if(ai)ai.value=sk;$('#akb').textContent='\u2713'}
    _updateKeyPromptVisibility();
  })
  if(typeof PADI!=='undefined'&&PADI.init)PADI.init().catch(e=>console.warn('PADI init:',e));
  setTimeout(autoRestoreSession,500);
}).catch(e=>{console.warn('DB init:',e);rCh()});
// ═══════════════════════════════════════════════════════════════
// ═══ FEATURE PACK: Citation Graph, Metadata Extraction,
// ═══ Gap Analysis, Advanced Search, Citation Mgmt,
// ═══ PDF Viewer/Annotations, Collaboration, Data Lineage,
// ═══ Grey Literature
// ═══════════════════════════════════════════════════════════════

// ═══ 1. CITATION GRAPH & NETWORK EXPLORATION ═══
let _citNodes=[],_citLinks=[],_citSim=null;
function populateGraphSeed(){
  const sel=$('#graphSeedSel');if(!sel)return;
  sel.innerHTML='<option value="">Select seed paper from Library...</option>'+S.lib.map((p,i)=>`<option value="${i}">${escHTML((p.title||'').slice(0,80))} (${p.year||'n.d.'})</option>`).join('');
}
// ── OpenAlex Engine (default — free, 10 req/s, no key needed) ──
const _OA='https://api.openalex.org';
async function _oaGet(path){
  try{const sep=path.includes('?')?'&':'?';
    const r=await fetchT(_OA+path+sep+'mailto=meridian-research@users.noreply',15000);
    if(!r.ok){console.warn('OA',r.status,path.slice(0,80));return null}return await r.json()}catch(e){console.warn('OA err:',e);return null}}
function _oaNorm(w){if(!w?.id)return null;const id=w.id.replace('https://openalex.org/','');
  return{paperId:id,title:w.display_name||'',year:w.publication_year,citationCount:w.cited_by_count||0,
    doi:w.doi,_refs:(w.referenced_works||[]).map(r=>r.replace('https://openalex.org/',''))}}
async function oaExpandPaper(query,oaId,doi){
  let paper;
  if(oaId){const d=await _oaGet('/works/'+oaId+'?select=id,display_name,publication_year,cited_by_count,referenced_works');paper=_oaNorm(d)}
  else if(doi){const cleanDoi=doi.replace(/^https?:\/\/doi\.org\//,'');
    const d=await _oaGet('/works/https://doi.org/'+encodeURIComponent(cleanDoi)+'?select=id,display_name,publication_year,cited_by_count,referenced_works');paper=_oaNorm(d)}
  if(!paper){const d=await _oaGet('/works?search='+encodeURIComponent(query)+'&per_page=1&select=id,display_name,publication_year,cited_by_count,referenced_works');
    paper=_oaNorm(d?.results?.[0])}
  if(!paper)return null;
  // Batch-fetch references (up to 15) in 1 request via filter
  const refIds=paper._refs.slice(0,15);
  if(refIds.length){const d=await _oaGet('/works?filter=openalex:'+refIds.join('|')+'&per_page=50&select=id,display_name,publication_year,cited_by_count');
    paper.references=(d?.results||[]).map(_oaNorm).filter(Boolean)}else paper.references=[];
  // Fetch top citing papers (sorted by citation count)
  const cd=await _oaGet('/works?filter=cites:'+paper.paperId+'&per_page=15&sort=cited_by_count:desc&select=id,display_name,publication_year,cited_by_count');
  paper.citations=(cd?.results||[]).map(_oaNorm).filter(Boolean);
  return paper}
// ── Semantic Scholar Engine (fallback — stricter rate limits) ──
async function _s2Fetch(url,retries=4){
  for(let i=0;i<retries;i++){
    try{const r=await fetchT(url,20000);
      if(r.status===429){const wait=Math.min(2000*Math.pow(2,i),30000);console.warn('S2 429 — retry in '+wait+'ms');await new Promise(w=>setTimeout(w,wait));continue}
      if(!r.ok)return null;return await r.json()}catch(e){console.warn('S2 fetch err:',e);return null}}
  return null}
async function fetchSSPaperByTitle(title){
  const d=await _s2Fetch('https://api.semanticscholar.org/graph/v1/paper/search?query='+encodeURIComponent(title)+'&limit=1&fields=paperId,title,year,citationCount,authors,venue,externalIds');
  const hit=d?.data?.[0];if(!hit?.paperId)return null;
  await new Promise(w=>setTimeout(w,300));
  return await fetchSSPaperById(hit.paperId)}
async function fetchSSPaperById(id){
  return await _s2Fetch('https://api.semanticscholar.org/graph/v1/paper/'+id+'?fields=paperId,title,year,citationCount,authors,venue,externalIds,references.paperId,references.title,references.year,references.citationCount,citations.paperId,citations.title,citations.year,citations.citationCount')}
// ── Unified Graph Builder ──
async function buildCitGraph(){
  const idx=$('#graphSeedSel').value;if(idx===''&&!S.lib.length)return toast('Save papers to Library first','err');
  const seed=S.lib[parseInt(idx)];if(!seed)return toast('Select a seed paper','err');
  const engine=$('#graphEngine')?.value||'openalex';
  const isOA=engine==='openalex';
  toast('Building citation graph via '+(isOA?'OpenAlex':'Semantic Scholar')+'...','info');
  const depth=parseInt($('#graphDepth').value)||1;
  const nodes=new Map(),links=[];
  const NODE_CAP=500;
  async function expand(title,extId,d,type,doi){
    if(d>depth||nodes.size>=NODE_CAP)return;
    $('#graphStats').textContent='Fetching: '+(title||extId||'').slice(0,40)+'… ('+nodes.size+' papers)';
    let paper;
    if(isOA){paper=await oaExpandPaper(title,extId,doi)}
    else{paper=extId?await fetchSSPaperById(extId):await fetchSSPaperByTitle(title)}
    if(!paper){console.warn(engine+': no result for',title||extId);return}
    const nid=paper.paperId;
    if(!nodes.has(nid))nodes.set(nid,{id:nid,title:paper.title||title,year:paper.year,cited:paper.citationCount||0,type:d===0?'seed':type,depth:d,doi:paper.doi});
    // Forward citations
    const cits=(paper.citations||[]).slice(0,15);
    for(const c of cits){if(!c.paperId||!c.title)continue;
      if(!nodes.has(c.paperId))nodes.set(c.paperId,{id:c.paperId,title:c.title,year:c.year,cited:c.citationCount||0,type:'forward',depth:d+1,doi:c.doi});
      links.push({source:nid,target:c.paperId});
      if(d+1<depth)await expand(c.title,c.paperId,d+1,'forward',c.doi)}
    // Backward references
    const refs=(paper.references||[]).slice(0,15);
    for(const ref of refs){if(!ref.paperId||!ref.title)continue;
      if(!nodes.has(ref.paperId))nodes.set(ref.paperId,{id:ref.paperId,title:ref.title,year:ref.year,cited:ref.citationCount||0,type:'backward',depth:d+1,doi:ref.doi});
      links.push({source:ref.paperId,target:nid});
      if(d+1<depth)await expand(ref.title,ref.paperId,d+1,'backward',ref.doi)}
    if(d<depth)await new Promise(r=>setTimeout(r,isOA?150:1000))}
  await expand(seed.title,null,0,'seed',seed.doi||seed.url);
  if(!nodes.size)return toast('Could not find paper on '+(isOA?'OpenAlex':'Semantic Scholar')+' — try the other engine or a different seed','err');
  _citNodes=[...nodes.values()];_citLinks=links.filter(l=>nodes.has(l.source)&&nodes.has(l.target));
  $('#graphStats').textContent=_citNodes.length+' papers · '+_citLinks.length+' links';
  renderCitGraph();toast(_citNodes.length+' papers mapped','ok')}
async function _oaRefsOnly(oaId){
  if(!oaId)return null;
  const d=await _oaGet('/works/'+oaId+'?select=id,display_name,publication_year,cited_by_count,referenced_works');
  const paper=_oaNorm(d);if(!paper)return null;
  const refIds=paper._refs.slice(0,20);
  if(refIds.length){const rd=await _oaGet('/works?filter=openalex:'+refIds.join('|')+'&per_page=50&select=id,display_name,publication_year,cited_by_count');
    paper.references=(rd?.results||[]).map(_oaNorm).filter(Boolean)}else paper.references=[];
  return paper}
async function snowballDiscover(){
  const idx=$('#graphSeedSel').value;if(idx==='')return toast('Select a seed paper','err');
  const seed=S.lib[parseInt(idx)];
  const engine=$('#graphEngine')?.value||'openalex';const isOA=engine==='openalex';
  toast('Snowball discovery via '+(isOA?'OpenAlex':'Semantic Scholar')+'...','info');
  const statEl=$('#graphStats');
  if(statEl)statEl.textContent='Snowball: fetching seed paper...';
  let paper;
  if(isOA){paper=await oaExpandPaper(seed.title,null,seed.doi||seed.url)}
  else{paper=await fetchSSPaperByTitle(seed.title)}
  if(!paper)return toast('Paper not found — try the other engine','err');
  const refCounts=new Map();
  const refs=(paper.references||[]).slice(0,15);
  if(!refs.length)return toast('Seed paper has no references in '+engine,'err');
  let fetched=0;
  for(const ref of refs){if(!ref.paperId)continue;
    await new Promise(r=>setTimeout(r,isOA?250:600));
    fetched++;
    if(statEl)statEl.textContent='Snowball: expanding ref '+fetched+'/'+refs.length+'...';
    let rp;
    if(isOA){rp=await _oaRefsOnly(ref.paperId)}else{rp=await fetchSSPaperById(ref.paperId)}
    if(!rp)continue;
    (rp.references||[]).slice(0,20).forEach(rr=>{if(!rr.paperId)return;
      const prev=refCounts.get(rr.paperId)||{...rr,count:0};prev.count++;refCounts.set(rr.paperId,prev)})}
  if(statEl)statEl.textContent='Snowball: analyzing '+refCounts.size+' candidate papers...';
  // Remove the seed and its direct references from candidates
  const seedRefIds=new Set(refs.map(r=>r.paperId).filter(Boolean));
  seedRefIds.add(paper.paperId);
  let canonical=[...refCounts.values()].filter(r=>r.count>=2&&!seedRefIds.has(r.paperId)).sort((a,b)=>b.count-a.count||((b.citationCount||0)-(a.citationCount||0))).slice(0,15);
  // Fallback: if strict threshold yields nothing, try count>=1 sorted by citations
  if(!canonical.length)canonical=[...refCounts.values()].filter(r=>!seedRefIds.has(r.paperId)).sort((a,b)=>((b.citationCount||0)-(a.citationCount||0))).slice(0,10);
  if(!canonical.length){if(statEl)statEl.textContent='';return toast('No canonical papers found — seed may have too few references','info')}
  const isStrict=canonical[0]?.count>=2;
  // Store canonical papers for delegated click handler
  window._canonicalPapers=canonical.map(c=>({title:c.title||'Unknown',year:c.year||null,cited:c.citationCount||0,src:isOA?'OA':'SS',id:c.paperId}));
  H('#graphPaperDetail',`<div class="sec"><div class="sh"><h4>${isStrict?'Canonical':'Related'} Papers (from ${refs.length} of seed's references)</h4></div><div class="sb">${canonical.map((c,ci)=>`<div class="pc" style="margin-bottom:6px;padding:10px 14px"><div style="display:flex;justify-content:space-between"><div style="flex:1"><div style="font-size:13px">${escHTML(c.title||'Unknown')}</div><div style="font-size:11px;color:var(--tm)">${c.year||''} · referenced by ${c.count} paper${c.count!==1?'s':''} · ${c.citationCount||0} total citations</div></div><button class="bt sm" data-save-canonical="${ci}">Save</button></div></div>`).join('')}</div></div>`);
  // Delegated click handler for canonical paper save buttons (use named fn to avoid listener leak on re-runs)
  const gpd=$('#graphPaperDetail');if(gpd){if(gpd._canonicalHandler)gpd.removeEventListener('click',gpd._canonicalHandler);gpd._canonicalHandler=function(e){const btn=e.target.closest('[data-save-canonical]');if(btn){const idx=+btn.dataset.saveCanonical;const p=window._canonicalPapers?.[idx];if(p)savePaper(p)}};gpd.addEventListener('click',gpd._canonicalHandler)}
  if(statEl)statEl.textContent=canonical.length+(isStrict?' canonical':' related')+' papers found';
  toast(canonical.length+(isStrict?' canonical':' related')+' papers found','ok')}
function renderCitGraph(){
  if(typeof d3==='undefined')return toast('D3.js not loaded — cannot render graph','err');
  const svg=d3.select('#citGraphSvg');svg.selectAll('*').remove();
  const w=svg.node().clientWidth||800,h=500;svg.attr('viewBox',`0 0 ${w} ${h}`);
  // Arrow marker
  svg.append('defs').append('marker').attr('id','arrowhead').attr('viewBox','0 -5 10 10').attr('refX',20).attr('refY',0).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto').append('path').attr('d','M0,-5L10,0L0,5').attr('fill','rgba(201,149,107,.3)');
  const sim=d3.forceSimulation(_citNodes).force('link',d3.forceLink(_citLinks).id(d=>d.id).distance(80)).force('charge',d3.forceManyBody().strength(-200)).force('center',d3.forceCenter(w/2,h/2)).force('collision',d3.forceCollide(25));
  _citSim=sim;
  const link=svg.append('g').selectAll('line').data(_citLinks).join('line').attr('class','cit-link').attr('stroke-width',1);
  const node=svg.append('g').selectAll('g').data(_citNodes).join('g').attr('class',d=>'cit-node '+d.type)
    .call(d3.drag().on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y}).on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y}).on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));
  node.append('circle').attr('r',d=>Math.max(6,Math.min(18,4+Math.sqrt(d.cited||1)))).attr('fill',d=>d.type==='seed'?'#C9956B':d.type==='forward'?'#7B9E87':'#9B8EC4').attr('stroke','rgba(255,255,255,.1)').attr('stroke-width',1);
  node.append('text').text(d=>(d.title||'').slice(0,20)+(d.title?.length>20?'…':'')).attr('dx',12).attr('dy',4);
  const isOA=$('#graphEngine')?.value==='openalex';
  node.on('click',(e,d)=>{const viewUrl=isOA?'https://openalex.org/'+d.id:'https://www.semanticscholar.org/paper/'+d.id;const src=isOA?'OA':'SS';
    // Store selected node data for safe delegated handler
    window._graphSelectedNode={title:d.title||'',year:d.year||null,cited:d.cited||0,src,id:d.id,doi:d.doi};
    H('#graphPaperDetail',`<div class="sec"><div class="sb"><h3 style="font-size:14px;margin-bottom:4px">${escHTML(d.title)}</h3><div style="font-size:12px;color:var(--tm);font-family:var(--mf)">${d.year||'n.d.'} · ${d.cited||0} citations · Depth: ${d.depth}</div><div style="margin-top:8px;display:flex;gap:6px"><button class="bt sm" onclick="(function(){var n=window._graphSelectedNode;if(n)savePaper({title:n.title,year:n.year,cited:n.cited,src:n.src,id:n.id})})()">Save to Library</button><a class="bt sm" href="${escHTML(viewUrl)}" target="_blank">View on ${src==='OA'?'OpenAlex':'S2'}</a>${d.doi?`<a class="bt sm" href="${escHTML(d.doi)}" target="_blank">DOI</a>`:''}</div></div></div>`)});
  node.append('title').text(d=>`${d.title} (${d.year||'?'}) — ${d.cited||0} citations`);
  sim.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform',d=>`translate(${d.x},${d.y})`)})}

// ═══ CO-AUTHORSHIP NETWORK ═══
let _graphMode='citation';
let _coauthNodes=[],_coauthLinks=[],_coauthSim=null;
let _coauthFilterText='';

function _setGraphMode(mode){
  _graphMode=mode;
  $('#gm-cit')?.classList.toggle('on',mode==='citation');
  $('#gm-coauth')?.classList.toggle('on',mode==='coauthor');
  $('#gm-brain')?.classList.toggle('on',mode==='brainmap');
  const citCtrl=$('#graph-cit-controls');
  const coauthCtrl=$('#graph-coauth-controls');
  if(citCtrl)citCtrl.style.display=mode==='citation'?'':'none';
  if(coauthCtrl)coauthCtrl.style.display=mode==='coauthor'?'':'none';
  const isBM=mode==='brainmap';
  const bmSeed=$('#bm-seed-section');if(bmSeed)bmSeed.style.display=isBM?'':'none';
  const bmExp=$('#bm-expansion-row');if(bmExp)bmExp.style.display=isBM?'':'none';
  const bmWt=$('#bm-score-weights');if(bmWt)bmWt.style.display=isBM?'':'none';
  const bmRec=$('#bm-rec-panel');if(bmRec)bmRec.style.display=isBM&&window._brainMap?.nodes?.size>0?'':'none';
  const bmLegend=$('#bm-legend');if(bmLegend){bmLegend.querySelector('.idx-legend').parentElement.style.display='';}
  if(isBM&&typeof initBrainMapUI==='function')initBrainMapUI();
}

async function buildCoauthorGraph(){
  if(typeof d3==='undefined')return toast('D3.js not loaded','err');
  if(!S.lib.length)return toast('Save papers to Library first','err');
  toast('Fetching co-authorship data from OpenAlex...','info',10000);

  const authorMap=new Map(); // authorId -> {id, name, institution, works, cited, papers:[]}
  const edgeMap=new Map(); // 'a1-a2' -> weight

  // Process library papers through OpenAlex
  const papers=S.lib.slice(0,30); // Limit for performance
  for(const p of papers){
    if(!p.doi&&!p.id)continue;
    try{
      const oaId=p.id?.startsWith('https://openalex.org/')?p.id.replace('https://openalex.org/',''):null;
      const doi=p.doi?.replace('https://doi.org/','');
      const q=oaId?`/works/${oaId}`:doi?`/works/doi:${doi}`:null;
      if(!q)continue;
      const w=await _oaGet(q+'?select=id,authorships');
      if(!w||!w.authorships)continue;
      const authors=w.authorships.slice(0,10).map(a=>({
        id:a.author?.id||'',
        name:a.author?.display_name||'',
        institution:a.institutions?.[0]?.display_name||'Unknown',
        instId:a.institutions?.[0]?.id||''
      })).filter(a=>a.id);

      // Register authors
      authors.forEach(a=>{
        if(!authorMap.has(a.id))authorMap.set(a.id,{id:a.id,name:a.name,institution:a.institution,instId:a.instId,works:0,cited:0,papers:[]});
        authorMap.get(a.id).papers.push(p.title||'');
      });

      // Build co-authorship edges
      for(let i=0;i<authors.length;i++){
        for(let j=i+1;j<authors.length;j++){
          const key=[authors[i].id,authors[j].id].sort().join('|');
          edgeMap.set(key,(edgeMap.get(key)||0)+1);
        }
      }
    }catch(e){/* skip */}
  }

  if(authorMap.size<2)return toast('Could not build co-authorship graph — too few authors found','err');

  // Fetch author details (works count, cited count) for top nodes
  const topAuthors=[...authorMap.values()].sort((a,b)=>b.papers.length-a.papers.length).slice(0,100);
  for(const a of topAuthors.slice(0,20)){
    try{
      const aId=a.id.replace('https://openalex.org/','');
      const data=await _oaGet(`/authors/${aId}?select=id,works_count,cited_by_count`);
      if(data){a.works=data.works_count||0;a.cited=data.cited_by_count||0}
    }catch{}
  }

  // Build graph data
  const nodeIds=new Set(topAuthors.map(a=>a.id));
  _coauthNodes=topAuthors.map(a=>({...a}));
  _coauthLinks=[];
  edgeMap.forEach((weight,key)=>{
    const[s,t]=key.split('|');
    if(nodeIds.has(s)&&nodeIds.has(t))_coauthLinks.push({source:s,target:t,weight});
  });

  toast(`Co-authorship graph: ${_coauthNodes.length} authors, ${_coauthLinks.length} collaborations`,'ok');
  renderCoauthorGraph();
}

function renderCoauthorGraph(){
  if(typeof d3==='undefined'||!_coauthNodes.length)return;
  const svg=d3.select('#citGraphSvg');svg.selectAll('*').remove();
  const w=svg.node().clientWidth||800,h=500;svg.attr('viewBox',`0 0 ${w} ${h}`);

  // Institution color mapping
  const institutions=[...new Set(_coauthNodes.map(n=>n.institution))];
  const instColors={};
  institutions.forEach((inst,i)=>{instColors[inst]=i<CL.length?CL[i]:'#666'});

  if(_coauthSim)_coauthSim.stop();
  const sim=d3.forceSimulation(_coauthNodes)
    .force('link',d3.forceLink(_coauthLinks).id(d=>d.id).distance(100))
    .force('charge',d3.forceManyBody().strength(-150))
    .force('center',d3.forceCenter(w/2,h/2))
    .force('collision',d3.forceCollide(30));
  _coauthSim=sim;

  const link=svg.append('g').selectAll('line').data(_coauthLinks).join('line')
    .attr('stroke','rgba(201,149,107,.2)')
    .attr('stroke-width',d=>Math.min(5,d.weight));

  const node=svg.append('g').selectAll('g').data(_coauthNodes).join('g')
    .attr('class','cit-node coauthor')
    .call(d3.drag()
      .on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y})
      .on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y})
      .on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));

  node.append('circle')
    .attr('r',d=>Math.max(6,Math.min(20,3+Math.sqrt(d.works||1)/3)))
    .attr('fill',d=>instColors[d.institution]||'#666')
    .attr('stroke','rgba(255,255,255,.1)').attr('stroke-width',1)
    .style('display',d=>{
      if(!_coauthFilterText)return'';
      return d.institution.toLowerCase().includes(_coauthFilterText)?'':'none';
    });

  node.append('text')
    .text(d=>{const parts=d.name.split(' ');return parts[parts.length-1]||d.name})
    .attr('dx',12).attr('dy',4)
    .style('display',d=>{
      if(!_coauthFilterText)return'';
      return d.institution.toLowerCase().includes(_coauthFilterText)?'':'none';
    });

  node.on('click',(e,d)=>{
    H('#graphPaperDetail',`<div class="sec"><div class="sb">
      <h3 style="font-size:14px;margin-bottom:4px">${escHTML(d.name)}</h3>
      <div style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">${escHTML(d.institution)}</div>
      <div class="eg" style="margin-bottom:8px">
        <div class="ec"><div class="el">Works</div><div class="ev">${d.works||'?'}</div></div>
        <div class="ec"><div class="el">Citations</div><div class="ev">${d.cited||'?'}</div></div>
        <div class="ec"><div class="el">Papers in library</div><div class="ev">${d.papers?.length||0}</div></div>
      </div>
      ${d.papers?.length?`<div style="font-size:11px;color:var(--ts);font-family:var(--mf)"><b>Library papers:</b><br>${d.papers.slice(0,3).map(t=>escHTML(t.slice(0,80))).join('<br>')}</div>`:''}
      <div style="margin-top:8px;display:flex;gap:6px">
        <a class="bt sm" href="https://openalex.org/${escHTML(d.id.replace('https://openalex.org/',''))}" target="_blank" style="text-decoration:none">View on OpenAlex</a>
        <button class="bt sm" onclick="goTab('lit');setTimeout(()=>{const q=$('#lq');if(q){q.value='${escJSAttr(d.name)}';q.dispatchEvent(new Event('input'))}},100)">Search their papers</button>
      </div>
    </div></div>`);
  });

  node.append('title').text(d=>`${d.name} — ${d.institution} — ${d.works||'?'} works`);

  sim.on('tick',()=>{
    link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform',d=>`translate(${d.x},${d.y})`)});

  // Update legend
  const legendHTML=institutions.slice(0,8).map(inst=>`<span class="idx-legend"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${instColors[inst]};margin-right:3px"></span>${escHTML(inst.length>25?inst.slice(0,25)+'...':inst)}</span>`).join('');
  const legendEl=document.querySelector('#tab-graph .idx-legend')?.parentElement;
  if(legendEl)legendEl.innerHTML=legendHTML;
}

function _coauthFilter(text){
  _coauthFilterText=text.toLowerCase().trim();
  if(!_coauthNodes.length)return;
  const svg=d3.select('#citGraphSvg');
  svg.selectAll('.coauthor circle').style('display',d=>{
    if(!_coauthFilterText)return'';
    return d.institution.toLowerCase().includes(_coauthFilterText)?'':'none';
  });
  svg.selectAll('.coauthor text').style('display',d=>{
    if(!_coauthFilterText)return'';
    return d.institution.toLowerCase().includes(_coauthFilterText)?'':'none';
  });
}

// ═══ 2. STRUCTURED METADATA EXTRACTION ═══
const MARINE_METHODS=['otolith microchemistry','acoustic telemetry','eDNA','environmental DNA','mark-recapture','capture-mark-recapture','CMR','stock assessment','visual census','underwater visual census','UVC','trawl survey','seine','gillnet','longline','hook and line','stable isotope','fatty acid','genetic','microsatellite','SNP','RADseq','morphometric','growth model','von Bertalanffy','VBGF','length-frequency','age-length key','length-weight','maturity','otolith','tagging','PIT tag','satellite tag','acoustic survey','ROV','baited remote','BRUV','ichthyoplankton','larval','recruitment','CPUE','catch per unit effort','biomass','abundance','density','electrofishing','hydroacoustic','side-scan sonar','CTD','remote sensing','GIS','habitat model','SDM','species distribution model','MaxEnt','GAM','GLM','GLMM','mixed model','Bayesian','Monte Carlo','bootstrap','simulation','Leslie matrix','surplus production','VPA','virtual population','cohort analysis',
'coral bleaching survey','reef transect','quadrat survey','photo-transect','coral coring',
'skeletal growth band','calcification rate','PAM fluorometry','symbiont density',
'plankton net','flow cytometry','qPCR','16S rRNA','metabarcoding','metagenomics',
'microscopy','phytoplankton count','zooplankton count','Niskin bottle','pigment analysis',
'HPLC','primary production','chlorophyll fluorescence',
'photo-identification','photo-ID','biopsy sampling','blow sampling','passive acoustic monitoring',
'PAM','drone survey','mark-resight','line transect','distance sampling',
'stranding survey','satellite telemetry','GPS tracking','accelerometer','TDR',
'nest monitoring','colony census','band resight','GPS logger','geolocator',
'stable isotope analysis','regurgitate analysis','at-sea survey','strip transect',
'dredge sampling','suction sampling','settlement plate','larval trap',
'population genetics','connectivity analysis','parentage analysis',
'water sampling','nutrient analysis','sediment coring','radioisotope dating',
'ocean glider','Argo float','mooring','current meter','ADCP',
'ecosystem model','Ecopath','Atlantis','coupled model','downscaling',
'MPA assessment','IUCN Red List assessment','population viability analysis','PVA'];
const SPECIES_REGEX=/\b([A-Z][a-z]{2,})\s+([a-z]{3,})\b/g;
const GEO_REGIONS=['Mediterranean','Atlantic','Pacific','Indian Ocean','Caribbean','Red Sea','Gulf of Mexico','North Sea','Baltic','Black Sea','Adriatic','Aegean','Arabian Gulf','Persian Gulf','South China Sea','East China Sea','Bay of Bengal','Coral Sea','Tasman Sea','Great Barrier Reef','Western Australia','Eastern Australia','Southern Ocean','Antarctic','Arctic','Strait of Gibraltar','Alboran Sea','Bay of Biscay','English Channel','Celtic Sea','Irish Sea','Benguela','Canary Current','Humboldt','California Current','Gulf Stream','Kuroshio','Agulhas','Mozambique Channel','Mascarene','Seychelles','Maldives','Hawaii','Galápagos','Azores','Canary Islands','Cape Verde','Bermuda','Florida Keys','Chesapeake Bay','Gulf of California','Patagonian Shelf',
'Ross Sea','Weddell Sea','Barents Sea','Beaufort Sea','Chukchi Sea','Bering Sea',
'Greenland Sea','Norwegian Sea','Labrador Sea','Scotia Sea',
'Java Sea','Banda Sea','Arafura Sea','Timor Sea','Sulu Sea','Celebes Sea',
'Yellow Sea','Sea of Japan','Sea of Okhotsk','Mariana Trench','Philippine Sea',
'Andaman Sea','Gulf of Thailand','Strait of Malacca','Torres Strait',
'Gulf of Maine','Georges Bank','Scotian Shelf','Grand Banks',
'Gulf of Panama','Golfo de Fonseca','Mar del Plata','Amazon Plume',
'Somali Current','Gulf of Guinea','Gulf of Aden','Comoros',
'Laccadive Sea','Chagos Archipelago','Ningaloo','Shark Bay',
'Mid-Atlantic Ridge','East Pacific Rise','hydrothermal vent','abyssal plain',
'mesopelagic','bathypelagic','hadal zone','seamount','cold seep','oxygen minimum zone'];
function extractSpecies(text){const matches=new Set();let m;const re=new RegExp(SPECIES_REGEX.source,'g');re.lastIndex=0;while((m=re.exec(text))!==null){const genus=m[1],sp=m[2];if(['The','This','That','These','Those','However','Although','Because','Results','Methods','Study','Table','Figure','During','Between','Within','Using'].includes(genus))continue;matches.add(genus+' '+sp)}return[...matches]}
function extractRegions(text){return GEO_REGIONS.filter(r=>text.toLowerCase().includes(r.toLowerCase()))}
function extractMethods(text){const tl=text.toLowerCase();return MARINE_METHODS.filter(m=>tl.includes(m.toLowerCase()))}
function extractAllMetadata(){
  let updated=0;
  S.lib.forEach(p=>{
    const text=[p.title||'',p.abstract||'',p.notes||''].join(' ');
    const species=extractSpecies(text);const regions=extractRegions(text);const methods=extractMethods(text);
    if(species.length||regions.length||methods.length){
      p._species=species;p._regions=regions;p._methods=methods;
      dbPut(p);updated++}});
  toast(`Extracted metadata from ${updated} papers`,'ok');return updated}

// ═══ 3. SYNTHESIS & GAP ANALYSIS ═══
// ═══ GAP NETWORK — Weighted Research Gap Discovery ═══
//
// Importance weights (1-10 scale):
//   Actionable    10 — sample size gaps, missing baselines, replication needs → you can go do this
//   Methodological 8 — species studied but key methods never applied
//   Geographic     7 — species known but unstudied in regions where it likely occurs
//   Temporal       6 — no recent data (>10yr old), or only single time-point
//   Contradictory  5 — conflicting findings that need resolution
//   Taxonomic      4 — genus studied but congeners ignored
//   Connective     3 — two well-studied areas with no cross-linkage
//   Theoretical    1 — conceptual gaps noted in abstracts but not tied to specific fieldwork
//
const GAP_WEIGHTS={actionable:10,methodological:8,geographic:7,temporal:6,contradictory:5,taxonomic:4,connective:3,theoretical:1};
const GAP_LABELS={actionable:'Actionable',methodological:'Methodological',geographic:'Geographic',temporal:'Temporal',contradictory:'Contradictory',taxonomic:'Taxonomic',connective:'Connective',theoretical:'Theoretical'};
const GAP_COLORS={actionable:'var(--co)',methodological:'#D4A04A',geographic:'var(--ac)',temporal:'var(--ac)',contradictory:'#D4A04A',taxonomic:'var(--lv)',connective:'var(--lv)',theoretical:'var(--tm)'};

function _gapTier(score){
  if(score>=8)return{tier:'critical',label:'Critical',color:'var(--co)',bg:'var(--cm)'};
  if(score>=6)return{tier:'high',label:'High',color:'#D4A04A',bg:'rgba(212,160,74,.1)'};
  if(score>=4)return{tier:'moderate',label:'Moderate',color:'var(--ac)',bg:'var(--am)'};
  if(score>=2)return{tier:'low',label:'Low',color:'var(--lv)',bg:'rgba(155,142,196,.1)'};
  return{tier:'theoretical',label:'Theoretical',color:'var(--tm)',bg:'var(--be)'};
}

/* ── 2G: Gap Analysis mode switcher ── */
function _gapSetMode(mode){
const modes=['discover','viz','export'];
modes.forEach(m=>{const p=$('#gap-panel-'+m);const b=$('#gap-mode-'+m);if(p)p.style.display=m===mode?'':'none';if(b)b.classList.toggle('on',m===mode)});
}

function buildGapMap(){
  extractAllMetadata();
  const speciesSet=new Set(),regionSet=new Set(),methodSet=new Set();
  const srMatrix={},smMatrix={};
  const speciesPapers={},regionPapers={},methodPapers={};
  const yearsBySpecies={};

  S.lib.forEach(p=>{
    const text=[p.title||'',p.abstract||''].join(' ');
    const sp=p._species||extractSpecies(text);
    const reg=p._regions||extractRegions(text);
    const meth=p._methods||extractMethods(text);
    sp.forEach(s=>{
      speciesSet.add(s);
      if(!speciesPapers[s])speciesPapers[s]=[];
      speciesPapers[s].push(p);
      if(p.year){if(!yearsBySpecies[s])yearsBySpecies[s]=[];yearsBySpecies[s].push(p.year)}
      reg.forEach(r=>{regionSet.add(r);const k=s+'|||'+r;srMatrix[k]=(srMatrix[k]||0)+1;
        if(!regionPapers[r])regionPapers[r]=[];regionPapers[r].push(p)});
      meth.forEach(m=>{methodSet.add(m);const k=s+'|||'+m;smMatrix[k]=(smMatrix[k]||0)+1;
        if(!methodPapers[m])methodPapers[m]=[];methodPapers[m].push(p)})});
    if(!sp.length){reg.forEach(r=>{regionSet.add(r);if(!regionPapers[r])regionPapers[r]=[];regionPapers[r].push(p)});
      meth.forEach(m=>{methodSet.add(m);if(!methodPapers[m])methodPapers[m]=[];methodPapers[m].push(p)})}});

  const species=[...speciesSet].sort(),regions=[...regionSet].sort(),methods=[...methodSet].sort();
  if(!species.length&&!regions.length)return toast('No species or regions detected — add papers with abstracts','err');

  // ── Detect gaps ──
  const gaps=[];
  const now=new Date().getFullYear();

  // 1. ACTIONABLE — species with very low sample sizes or no sample size data
  species.forEach(s=>{
    const papers=speciesPapers[s]||[];
    const withN=papers.filter(p=>{
      if(p.findings?.n){const m=String(p.findings.n).match(/(\d+)/);return m&&parseInt(m[1])>0}
      if(p.abstract){const m=p.abstract.match(/[Nn]\s*=\s*(\d+)/);return!!m}return false});
    const nVals=withN.map(p=>{
      if(p.findings?.n){const m=String(p.findings.n).match(/(\d+)/);return m?parseInt(m[1]):0}
      const m=p.abstract.match(/[Nn]\s*=\s*(\d+)/);return m?parseInt(m[1]):0}).filter(n=>n>0);
    if(papers.length>=2&&withN.length===0)
      gaps.push({type:'actionable',species:s,title:'No sample size data for '+s,detail:'None of the '+papers.length+' papers report sample sizes. Replication and meta-analysis impossible without n values.',
        dims:['sample size','replication'],related:[s],papers,boost:papers.length>=4?1.5:1});
    else if(nVals.length&&Math.max(...nVals)<30)
      gaps.push({type:'actionable',species:s,title:'Low sample sizes for '+s+' (max n='+Math.max(...nVals)+')',detail:'All studies have small samples. Statistical power is limited — larger field campaigns needed.',
        dims:['sample size','statistical power'],related:[s],papers:withN,boost:1});
  });

  // 2. METHODOLOGICAL — species studied but key method categories missing
  const methodCats={genetics:['genetic','microsatellite','SNP','RADseq','eDNA','environmental DNA','molecular','metabarcoding','metagenomics','16S rRNA','qPCR'],
    ageing:['otolith','age-length key','von Bertalanffy','VBGF','growth model','length-frequency','skeletal growth band'],
    movement:['acoustic telemetry','satellite tag','PIT tag','tagging','mark-recapture','GPS tracking','satellite telemetry','photo-identification','mark-resight'],
    assessment:['stock assessment','CPUE','catch per unit effort','biomass','abundance','VPA','surplus production','population viability','Leslie matrix'],
    imaging:['ROV','BRUV','baited remote','underwater visual census','UVC','visual census','drone survey','remote sensing','side-scan sonar','photo-transect']};
  species.forEach(s=>{
    const appliedMethods=methods.filter(m=>smMatrix[s+'|||'+m]);
    const appliedLower=appliedMethods.map(m=>m.toLowerCase());
    Object.entries(methodCats).forEach(([cat,keywords])=>{
      const has=keywords.some(k=>appliedLower.some(m=>m.includes(k.toLowerCase())));
      if(!has&&(speciesPapers[s]||[]).length>=2){
        gaps.push({type:'methodological',species:s,title:'No '+cat+' studies for '+s,
          detail:'This species has '+(speciesPapers[s]||[]).length+' papers but none apply '+cat+' methods ('+keywords.slice(0,3).join(', ')+').',
          dims:[cat,s],related:[s,...keywords.slice(0,2)],papers:speciesPapers[s]||[],boost:1})}})});

  // 3. GEOGRAPHIC — species covered in some regions but absent from others in the library
  species.forEach(s=>{
    const covered=regions.filter(r=>srMatrix[s+'|||'+r]);
    const missing=regions.filter(r=>!srMatrix[s+'|||'+r]);
    if(covered.length>=1&&missing.length>=2&&covered.length<regions.length*0.4)
      gaps.push({type:'geographic',species:s,title:s+' — unstudied in '+missing.length+' region'+(missing.length>1?'s':''),
        detail:'Found in '+covered.join(', ')+' but absent from '+missing.slice(0,5).join(', ')+(missing.length>5?' and '+(missing.length-5)+' more':'')+'.',
        dims:[s,...missing.slice(0,3)],related:[s,...covered.slice(0,2),...missing.slice(0,2)],papers:speciesPapers[s]||[],boost:missing.length>4?1.3:1})});

  // 4. TEMPORAL — species with no recent studies or only a single time point
  species.forEach(s=>{
    const yrs=yearsBySpecies[s]||[];
    if(!yrs.length)return;
    const maxYr=Math.max(...yrs);const minYr=Math.min(...yrs);
    if(maxYr<now-10)
      gaps.push({type:'temporal',species:s,title:s+' — no data since '+maxYr,
        detail:'Most recent study is '+(now-maxYr)+' years old. Updated baselines needed for current stock assessment or conservation status.',
        dims:['temporal','baseline',s],related:[s],papers:speciesPapers[s]||[],boost:now-maxYr>20?1.4:1});
    else if(yrs.length>=3&&maxYr-minYr<3)
      gaps.push({type:'temporal',species:s,title:s+' — all studies within '+minYr+'-'+maxYr,
        detail:yrs.length+' papers but all from a narrow time window. Long-term trends cannot be assessed.',
        dims:['temporal','trend',s],related:[s],papers:speciesPapers[s]||[],boost:1})});

  // 5. CONTRADICTORY — conflicting directional findings
  const increase=/increas|higher|greater|more|positive|upward|grew|risen|elevated/i;
  const decrease=/decreas|lower|less|fewer|negative|downward|declin|reduc|diminish/i;
  const findingsBySpecies={};
  S.lib.filter(p=>p.findings?.finding).forEach(p=>{
    const sp=p._species||extractSpecies([p.title||'',p.abstract||''].join(' '));
    const f=p.findings.finding;const dir=increase.test(f)?'up':decrease.test(f)?'down':'neutral';
    const key=sp.length?sp[0]:'general';
    if(!findingsBySpecies[key])findingsBySpecies[key]=[];
    findingsBySpecies[key].push({paper:p,dir,finding:f})});
  Object.entries(findingsBySpecies).forEach(([sp,entries])=>{
    const ups=entries.filter(e=>e.dir==='up'),downs=entries.filter(e=>e.dir==='down');
    if(ups.length&&downs.length)
      gaps.push({type:'contradictory',species:sp,title:'Conflicting findings for '+sp,
        detail:ups.length+' study/ies report increase, '+downs.length+' report decrease. Reconciliation study needed — may reflect regional or temporal differences.',
        dims:[sp,'direction','reconciliation'],related:[sp],papers:[...ups,...downs].map(e=>e.paper),
        boost:Math.min(ups.length,downs.length)>1?1.3:1,
        _ups:ups.map(u=>u.finding.slice(0,80)),_downs:downs.map(d=>d.finding.slice(0,80))})});

  // 6. TAXONOMIC — genera with only 1 species studied
  const genera={};
  species.forEach(s=>{const parts=s.split(' ');if(parts.length>=2){const g=parts[0];if(!genera[g])genera[g]=[];genera[g].push(s)}});
  Object.entries(genera).forEach(([genus,spp])=>{
    if(spp.length===1){
      const totalPapers=(speciesPapers[spp[0]]||[]).length;
      if(totalPapers>=3)
        gaps.push({type:'taxonomic',species:spp[0],title:'Only '+spp[0]+' studied in genus '+genus,
          detail:totalPapers+' papers on this species but no congeners in the library. Comparative studies could reveal genus-level patterns.',
          dims:[genus,spp[0],'congener'],related:[spp[0],genus],papers:speciesPapers[spp[0]]||[],boost:1})}});

  // 7. CONNECTIVE — regions or methods that are well-studied independently but never co-occur
  if(regions.length>=3&&species.length>=2){
    const regionPairs=[];
    for(let i=0;i<regions.length;i++){
      for(let j=i+1;j<regions.length;j++){
        const r1=regions[i],r2=regions[j];
        const r1spp=species.filter(s=>srMatrix[s+'|||'+r1]);
        const r2spp=species.filter(s=>srMatrix[s+'|||'+r2]);
        const shared=r1spp.filter(s=>r2spp.includes(s));
        if(r1spp.length>=2&&r2spp.length>=2&&shared.length===0)
          regionPairs.push({r1,r2,r1spp,r2spp})}}
    regionPairs.slice(0,3).forEach(rp=>{
      gaps.push({type:'connective',title:rp.r1+' — '+rp.r2+' comparison gap',species:null,
        detail:rp.r1+' has data on '+rp.r1spp.slice(0,3).join(', ')+'; '+rp.r2+' on '+rp.r2spp.slice(0,3).join(', ')+'. No shared species — cross-regional comparison impossible.',
        dims:[rp.r1,rp.r2],related:[...rp.r1spp.slice(0,2),...rp.r2spp.slice(0,2)],papers:[],boost:1})})}

  // 8. THEORETICAL — abstract mentions "gap", "future research", "poorly understood" etc.
  const theoRe=/\b(poorly understood|knowledge gap|understudied|under-studied|data.deficient|rarely studied|future research|further research needed|limited data|no data exist|remains unknown|yet to be|not well known|warrants further|warrants investigation|little is known|scarcely studied)\b/gi;
  S.lib.forEach(p=>{
    const text=p.abstract||'';
    const matches=[...text.matchAll(theoRe)].map(m=>m[0]);
    if(matches.length){
      const sp=(p._species||extractSpecies([p.title||'',text].join(' ')))[0]||'General';
      gaps.push({type:'theoretical',species:sp,title:'Knowledge gap noted: '+(p.title||'').slice(0,60),
        detail:'Paper mentions: "'+matches[0]+'"'+(matches.length>1?' and '+(matches.length-1)+' similar phrase(s)':'')+'. Author-identified gap — may lack specificity for direct action.',
        dims:[sp,'literature gap'],related:[sp],papers:[p],boost:matches.length>2?1.2:1})}});

  // ── Score and sort ──
  gaps.forEach(g=>{
    const base=GAP_WEIGHTS[g.type]||1;
    const paperCount=Math.min((g.papers||[]).length,10)/10;// 0-1, more papers = more evidence
    g.score=Math.min(10,base*(g.boost||1)+paperCount);
    g.tierInfo=_gapTier(g.score);
  });
  gaps.sort((a,b)=>b.score-a.score);

  // ── Build network edges (shared dimensions) ──
  const edges=[];
  for(let i=0;i<gaps.length;i++){
    for(let j=i+1;j<gaps.length;j++){
      const shared=(gaps[i].related||[]).filter(r=>(gaps[j].related||[]).includes(r));
      if(shared.length)edges.push({from:i,to:j,shared})}}

  // ── Stats ──
  $('#gapStats').textContent=`${gaps.length} gaps · ${species.length} species · ${regions.length} regions · ${methods.length} methods`;

  // ── Render ──
  let html='';

  // Scale legend
  html+=`<div style="margin-bottom:14px;padding:10px 14px;background:var(--be);border-radius:6px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:11px;font-family:var(--mf)"><span style="color:var(--tm)">Importance:</span>`;
  [{w:10,l:'Actionable',c:'var(--co)'},{w:8,l:'Methodological',c:'#D4A04A'},{w:7,l:'Geographic',c:'var(--ac)'},{w:6,l:'Temporal',c:'var(--ac)'},{w:5,l:'Contradictory',c:'#D4A04A'},{w:4,l:'Taxonomic',c:'var(--lv)'},{w:3,l:'Connective',c:'var(--lv)'},{w:1,l:'Theoretical',c:'var(--tm)'}].forEach(x=>{
    html+=`<span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:${x.c};display:inline-block"></span><span style="color:var(--ts)">${x.l}</span><span style="color:var(--tm)">${x.w}</span></span>`});
  html+='</div>';

  // Filter bar
  const typeCounts={};gaps.forEach(g=>{typeCounts[g.type]=(typeCounts[g.type]||0)+1});
  html+=`<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap"><button class="bt sm on" onclick="_gapFilter='';_renderGapCards()">All (${gaps.length})</button>`;
  Object.entries(typeCounts).sort((a,b)=>GAP_WEIGHTS[b[0]]-GAP_WEIGHTS[a[0]]).forEach(([t,c])=>{
    html+=`<button class="bt sm" onclick="_gapFilter='${t}';_renderGapCards()">${GAP_LABELS[t]} (${c})</button>`});
  html+='</div>';

  // Card container
  html+='<div id="gapCards"></div>';

  // Network graph container
  if(gaps.length>=3&&typeof d3!=='undefined')
    html+=`<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Gap Network</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><svg id="gapNetSvg" style="width:100%;height:400px;background:var(--bi);border-radius:6px"></svg></div></div>`;

  // Evidence matrices (collapsed)
  html+=_buildMatrixHTML(species,regions,methods,srMatrix,smMatrix);

  H('#gapContent',html);

  // Store for filtering
  window._gapData=gaps;window._gapEdges=edges;window._gapFilter='';
  _renderGapCards();
  if(gaps.length>=3&&typeof d3!=='undefined')setTimeout(()=>_renderGapNetwork(gaps,edges),100);
}

let _gapFilter='';
function _renderGapCards(){
  const gaps=window._gapData||[];
  const filtered=_gapFilter?gaps.filter(g=>g.type===_gapFilter):gaps;
  // Update active filter button
  const btns=$('#gapContent')?.querySelectorAll('.bt.sm');
  if(btns)btns.forEach(b=>{const isAll=b.textContent.startsWith('All');
    b.classList.toggle('on',_gapFilter?b.textContent.includes(GAP_LABELS[_gapFilter]):isAll)});

  H('#gapCards',filtered.length?filtered.map((g,i)=>{
    const t=g.tierInfo;const gi=gaps.indexOf(g);
    return`<div class="gn-card gn-${t.tier}" onclick="const e=this.querySelector('.gn-expand');e.style.display=e.style.display==='none'?'block':'none'">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
<div style="flex:1;min-width:0"><div style="font-size:13px;line-height:1.45">${escHTML(g.title)}</div>
<div style="margin-top:3px">${g.dims.map(d=>'<span class="gn-tag">'+escHTML(d)+'</span>').join('')}</div></div>
<div style="flex-shrink:0;text-align:right"><span class="gn-score" style="background:${t.bg};color:${t.color}">${g.score.toFixed(1)}</span>
<div class="gn-dim">${t.label}</div></div></div>
<div class="gn-expand" style="display:none"><div style="margin-bottom:6px">${escHTML(g.detail)}</div>${
  g._ups?'<div style="color:var(--sg);font-size:11px;margin-bottom:2px">Increase: '+g._ups.map(u=>escHTML(u)).join('; ')+'</div><div style="color:var(--co);font-size:11px;margin-bottom:4px">Decrease: '+g._downs.map(d=>escHTML(d)).join('; ')+'</div>':''
}${(g.papers||[]).length?'<div class="gn-dim" style="margin-top:4px">Based on '+(g.papers||[]).length+' paper'+(g.papers.length!==1?'s':'')+': '+g.papers.slice(0,3).map(p=>'<em>'+escHTML((p.title||'').slice(0,50))+'</em>').join(', ')+(g.papers.length>3?' ...':'')+'</div>':''}${
  // Connected gaps
  (window._gapEdges||[]).filter(e=>e.from===gi||e.to===gi).length?
    '<div style="margin-top:6px;font-size:11px;color:var(--ac)">Connected to '+(window._gapEdges||[]).filter(e=>e.from===gi||e.to===gi).length+' other gap'+(((window._gapEdges||[]).filter(e=>e.from===gi||e.to===gi).length!==1)?'s':'')+' via shared dimensions</div>':''
}</div></div>`}).join(''):'<p style="color:var(--tm);text-align:center;padding:20px">No gaps of this type found.</p>');
}

function _renderGapNetwork(gaps,edges){
  const svg=d3.select('#gapNetSvg');if(!svg.node())return;
  svg.selectAll('*').remove();
  const w=svg.node().clientWidth||800,h=400;svg.attr('viewBox','0 0 '+w+' '+h);
  const maxScore=Math.max(...gaps.map(g=>g.score),1);
  const nodes=gaps.map((g,i)=>({id:i,label:(g.species||g.title.slice(0,25)),type:g.type,score:g.score,tier:g.tierInfo.tier,color:GAP_COLORS[g.type]||'var(--tm)',r:Math.max(6,4+g.score/maxScore*14)}));
  const links=edges.map(e=>({source:e.from,target:e.to,value:e.shared.length}));
  const sim=d3.forceSimulation(nodes)
    .force('link',d3.forceLink(links).id(d=>d.id).distance(60))
    .force('charge',d3.forceManyBody().strength(-120))
    .force('center',d3.forceCenter(w/2,h/2))
    .force('collision',d3.forceCollide(d=>d.r+4));
  const link=svg.append('g').selectAll('line').data(links).join('line')
    .attr('stroke','rgba(201,149,107,.12)').attr('stroke-width',d=>Math.min(d.value,3));
  const node=svg.append('g').selectAll('g').data(nodes).join('g').style('cursor','pointer')
    .call(d3.drag().on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y})
      .on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y}).on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));
  node.append('circle').attr('r',d=>d.r).attr('fill',d=>d.color).attr('fill-opacity',.7).attr('stroke','rgba(255,255,255,.1)').attr('stroke-width',1);
  node.append('text').text(d=>d.label.length>20?d.label.slice(0,18)+'…':d.label)
    .attr('dx',d=>d.r+3).attr('dy',3).attr('fill','var(--ts)').attr('font-size','10px').attr('font-family','var(--mf)');
  node.append('title').text(d=>gaps[d.id].title+' ('+d.score.toFixed(1)+')');
  node.on('click',(e,d)=>{const cards=document.querySelectorAll('.gn-card');if(cards[d.id]){cards[d.id].scrollIntoView({behavior:'smooth',block:'center'});
    const exp=cards[d.id].querySelector('.gn-expand');if(exp)exp.style.display='block'}});
  sim.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform',d=>'translate('+d.x+','+d.y+')')});
}

function _buildMatrixHTML(species,regions,methods,srMatrix,smMatrix){
  let html='<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'"><h4>Evidence Matrices</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none">';
  if(species.length&&regions.length){
    html+='<h4 style="font-size:12px;color:var(--ac);margin-bottom:6px">Species × Region</h4>';
    html+='<div class="gap-legend"><span style="background:var(--bi)"></span>No studies <span style="background:rgba(123,158,135,.3)"></span>1 <span style="background:rgba(123,158,135,.6)"></span>2-3 <span style="background:var(--sg)"></span>4+</div>';
    html+='<div style="overflow-x:auto;margin-bottom:14px"><table class="dt" style="font-size:11px"><thead><tr><th style="position:sticky;left:0;background:var(--bs);z-index:2">Species</th>'+regions.map(r=>'<th style="writing-mode:vertical-lr;text-orientation:mixed;min-width:30px;padding:4px">'+r+'</th>').join('')+'</tr></thead><tbody>';
    species.forEach(s=>{html+='<tr><td style="position:sticky;left:0;background:var(--bs);z-index:1;font-style:italic;white-space:nowrap">'+escHTML(s)+'</td>';
      regions.forEach(r=>{const n=srMatrix[s+'|||'+r]||0;const bg=n===0?'var(--bi)':n===1?'rgba(123,158,135,.3)':n<=3?'rgba(123,158,135,.6)':'var(--sg)';
        html+=`<td class="gap-cell" style="background:${bg};text-align:center;color:${n?'var(--tx)':'var(--tm)'};cursor:pointer" title="${s} in ${r}: ${n} studies" onclick="filterLibByMeta('${escHTML(s)}','${escHTML(r)}')">${n||'·'}</td>`});html+='</tr>'});
    html+='</tbody></table></div>'}
  if(species.length&&methods.length){
    html+='<h4 style="font-size:12px;color:var(--lv);margin-bottom:6px">Species × Method</h4>';
    html+='<div style="overflow-x:auto"><table class="dt" style="font-size:11px"><thead><tr><th style="position:sticky;left:0;background:var(--bs);z-index:2">Species</th>'+methods.map(m=>'<th style="writing-mode:vertical-lr;text-orientation:mixed;min-width:30px;padding:4px">'+m+'</th>').join('')+'</tr></thead><tbody>';
    species.forEach(s=>{html+='<tr><td style="position:sticky;left:0;background:var(--bs);z-index:1;font-style:italic;white-space:nowrap">'+escHTML(s)+'</td>';
      methods.forEach(m=>{const n=smMatrix[s+'|||'+m]||0;const bg=n===0?'var(--bi)':n===1?'rgba(155,142,196,.3)':n<=3?'rgba(155,142,196,.6)':'var(--lv)';
        html+=`<td class="gap-cell" style="background:${bg};text-align:center;color:${n?'var(--tx)':'var(--tm)'}">${n||'·'}</td>`});html+='</tr>'});
    html+='</tbody></table></div>'}
  html+='</div></div>';
  return html;
}
function filterLibByMeta(species,region){goTab('library');setTimeout(()=>{const inp=$('#lib-search-input');if(inp){inp.value=species+' '+region;_dRenderLib()}},100)}
function buildTimeline(){
  extractAllMetadata();
  const speciesYears={};
  S.lib.forEach(p=>{const sp=p._species||extractSpecies([p.title||'',p.abstract||''].join(' '));const yr=p.year;if(!yr)return;
    sp.forEach(s=>{if(!speciesYears[s])speciesYears[s]=[];speciesYears[s].push(yr)})});
  const species=Object.keys(speciesYears).sort();
  if(!species.length)return toast('No species with year data found','err');
  const traces=species.map((s,i)=>{const yrs=speciesYears[s].sort();
    return{x:yrs,y:Array(yrs.length).fill(s),type:'scatter',mode:'markers',marker:{color:CL[i%8],size:8},name:s}});
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Temporal Coverage by Species</h4></div><div class="sb"><div class="pcc" id="timelinePlot" style="height:${Math.max(300,species.length*30)}px"></div></div></div>`);
  setTimeout(()=>Plotly.newPlot('timelinePlot',traces,{...PL,height:Math.max(300,species.length*30),xaxis:{...PL.xaxis,title:'Year'},yaxis:{...PL.yaxis,type:'category',autorange:'reversed'},showlegend:false},{responsive:true}),50)}
function buildForestPlot(){
  // If we have papers with computed effect sizes, use enhanced version
  if(S.lib.filter(p=>p.effectSize&&p.effectSize.type==='d').length>=2)return buildForestPlotEnhanced();
  const papers=S.lib.filter(p=>p.findings?.n||p.abstract);
  const data=[];
  papers.forEach(p=>{
    let n=null;
    if(p.findings?.n){const m=String(p.findings.n).match(/(\d+)/);if(m)n=parseInt(m[1])}
    if(!n&&p.abstract){const m=p.abstract.match(/[Nn]\s*=\s*(\d+)/);if(m)n=parseInt(m[1])}
    if(n&&n>0)data.push({title:(p.title||'').slice(0,50),n,year:p.year||0})});
  data.sort((a,b)=>b.n-a.n);
  if(!data.length)return toast('No sample sizes found — extract findings first','err');
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Sample Size Overview (${data.length} papers)</h4></div><div class="sb"><div class="pcc" id="forestPlot" style="height:${Math.max(300,data.length*25)}px"></div></div></div>`);
  setTimeout(()=>Plotly.newPlot('forestPlot',[{y:data.map(d=>d.title),x:data.map(d=>d.n),type:'bar',orientation:'h',marker:{color:data.map(d=>d.n>100?'var(--sg)':d.n>30?'var(--wa)':'var(--co)')},text:data.map(d=>'n='+d.n),textposition:'outside'}],{...PL,height:Math.max(300,data.length*25),xaxis:{...PL.xaxis,title:'Sample Size (n)',type:'log'},yaxis:{...PL.yaxis,autorange:'reversed'},margin:{...PL.margin,l:300}},{responsive:true}),50)}
function detectContradictions(){
  const findings=S.lib.filter(p=>p.findings?.finding);
  if(findings.length<2)return toast('Need at least 2 papers with extracted findings','err');
  const increase=/increas|higher|greater|more|positive|upward|grew|risen|elevated/i;
  const decrease=/decreas|lower|less|fewer|negative|downward|declin|reduc|diminish/i;
  const groups={};
  findings.forEach(p=>{const sp=p._species||extractSpecies([p.title||'',p.abstract||''].join(' '));
    const f=p.findings.finding;const dir=increase.test(f)?'up':decrease.test(f)?'down':'neutral';
    const key=sp.length?sp[0]:'general';
    if(!groups[key])groups[key]=[];groups[key].push({paper:p,dir,finding:f})});
  const contradictions=[];
  Object.entries(groups).forEach(([key,papers])=>{
    const ups=papers.filter(p=>p.dir==='up'),downs=papers.filter(p=>p.dir==='down');
    if(ups.length&&downs.length)contradictions.push({species:key,ups,downs})});
  if(!contradictions.length){H('#gapContent','<div class="sec"><div class="sb"><p style="color:var(--sg)">No contradictory findings detected across '+findings.length+' papers.</p></div></div>');return}
  H('#gapContent','<div class="sec"><div class="sh"><h4>Potential Contradictions ('+contradictions.length+')</h4></div><div class="sb">'+contradictions.map(c=>
    `<div style="margin-bottom:14px;padding:12px;background:var(--bi);border:1px solid var(--bd);border-radius:6px"><div style="font-style:italic;color:var(--ac);margin-bottom:6px">${escHTML(c.species)}</div><div style="color:var(--sg);font-size:12px;margin-bottom:4px">↑ Increase/positive:</div>${c.ups.map(u=>`<div style="font-size:12px;margin-left:12px;margin-bottom:2px">• ${escHTML(u.paper.title?.slice(0,60))} — <span style="color:var(--ts)">${escHTML(u.finding)}</span></div>`).join('')}<div style="color:var(--co);font-size:12px;margin:6px 0 4px">↓ Decrease/negative:</div>${c.downs.map(d=>`<div style="font-size:12px;margin-left:12px;margin-bottom:2px">• ${escHTML(d.paper.title?.slice(0,60))} — <span style="color:var(--ts)">${escHTML(d.finding)}</span></div>`).join('')}</div>`).join('')+'</div></div>')}

// ═══ EFFECT SIZE CALCULATOR ═══
function showEffectSizeCalc(){
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Effect Size Calculator</h4></div><div class="sb">
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
    <div style="flex:1;min-width:250px"><div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Two-Group Comparison (Cohen's d)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
      <div><label style="font-size:11px;color:var(--tm)">Mean 1</label><input class="fi" id="es-m1" type="number" step="any" style="width:100%"/></div>
      <div><label style="font-size:11px;color:var(--tm)">SD 1</label><input class="fi" id="es-sd1" type="number" step="any" min="0" style="width:100%"/></div>
      <div><label style="font-size:11px;color:var(--tm)">n1</label><input class="fi" id="es-n1" type="number" min="2" style="width:100%"/></div>
      <div><label style="font-size:11px;color:var(--tm)">Mean 2</label><input class="fi" id="es-m2" type="number" step="any" style="width:100%"/></div>
      <div><label style="font-size:11px;color:var(--tm)">SD 2</label><input class="fi" id="es-sd2" type="number" step="any" min="0" style="width:100%"/></div>
      <div><label style="font-size:11px;color:var(--tm)">n2</label><input class="fi" id="es-n2" type="number" min="2" style="width:100%"/></div>
    </div>
    <button class="bt bt-pri" onclick="calcEffectSize()" style="margin-top:8px">Calculate</button></div>
    <div style="flex:1;min-width:250px"><div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">2×2 Table (Odds Ratio)</div>
    <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:4px;align-items:center;font-size:12px;font-family:var(--mf)">
      <span></span><span style="color:var(--tm);text-align:center">Event</span><span style="color:var(--tm);text-align:center">No Event</span>
      <span style="color:var(--ts)">Exposed</span><input class="fi" id="es-a" type="number" min="0" style="width:70px"/><input class="fi" id="es-b" type="number" min="0" style="width:70px"/>
      <span style="color:var(--ts)">Control</span><input class="fi" id="es-c" type="number" min="0" style="width:70px"/><input class="fi" id="es-d" type="number" min="0" style="width:70px"/>
    </div>
    <button class="bt bt-pri" onclick="calcOddsRatio()" style="margin-top:8px">Calculate OR/RR</button></div>
  </div>
  <div id="es-results"></div>
  <div id="es-plot" style="margin-top:10px"></div>
  <div style="margin-top:10px"><select class="fs" id="es-paper-select" style="max-width:300px"><option value="">Attach to paper...</option>${S.lib.map(p=>`<option value="${escJSAttr(p.id)}">${escHTML((p.title||'').slice(0,60))}</option>`).join('')}</select>
  <button class="bt sm" onclick="saveEffectSize()" style="margin-left:6px">Save to Paper</button></div>
  </div></div>`)}
function calcEffectSize(){
  const m1=+$('#es-m1')?.value,m2=+$('#es-m2')?.value,sd1=+$('#es-sd1')?.value,sd2=+$('#es-sd2')?.value,n1=+$('#es-n1')?.value,n2=+$('#es-n2')?.value;
  if(!sd1||!sd2||!n1||!n2||n1<2||n2<2)return toast('Fill all fields (n≥2, SD>0)','err');
  const pooledSD=Math.sqrt(((n1-1)*sd1*sd1+(n2-1)*sd2*sd2)/(n1+n2-2));
  const cohenD=(m1-m2)/pooledSD;
  const cf=1-3/(4*(n1+n2-2)-1);
  const hedgesG=cohenD*cf;
  const glassDelta=(m1-m2)/sd2;
  const seD=Math.sqrt((n1+n2)/(n1*n2)+(cohenD*cohenD)/(2*(n1+n2)));
  const ci95=[cohenD-1.96*seD,cohenD+1.96*seD];
  const mag=Math.abs(cohenD)<0.2?'negligible':Math.abs(cohenD)<0.5?'small':Math.abs(cohenD)<0.8?'medium':'large';
  window._lastES={type:'d',cohenD,hedgesG,glassDelta,ci95,se:seD,n1,n2,m1,m2,sd1,sd2,mag};
  H('#es-results',`<div style="padding:12px;background:var(--bi);border:1px solid var(--bd);border-radius:6px;font-family:var(--mf);font-size:13px;line-height:2">
    <span style="color:var(--ac);font-weight:700">Cohen's d = ${cohenD.toFixed(4)}</span> (${mag})<br>
    <span style="color:var(--sg)">Hedges' g = ${hedgesG.toFixed(4)}</span><br>
    Glass's Δ = ${glassDelta.toFixed(4)}<br>
    95% CI: [${ci95[0].toFixed(4)}, ${ci95[1].toFixed(4)}]<br>
    SE = ${seD.toFixed(4)}, Pooled SD = ${pooledSD.toFixed(4)}</div>`);
  // Mini forest plot
  const plotEl=$('#es-plot');if(plotEl)Plotly.newPlot(plotEl,[{x:[cohenD],y:['Effect'],error_x:{type:'data',array:[ci95[1]-cohenD],arrayminus:[cohenD-ci95[0]],color:'#C9956B',thickness:2},type:'scatter',mode:'markers',marker:{size:12,color:'#C9956B'}}],{...PL,height:120,xaxis:{...PL.xaxis,title:'Effect Size (d)',zeroline:true,zerolinecolor:'rgba(255,255,255,.2)'},yaxis:{...PL.yaxis,visible:false},margin:{l:20,r:20,t:10,b:40},shapes:[{type:'line',x0:0,x1:0,y0:0,y1:1,yref:'paper',line:{color:'rgba(255,255,255,.3)',dash:'dot'}}]},{responsive:true})}
function calcOddsRatio(){
  let a=+$('#es-a')?.value,b=+$('#es-b')?.value,c=+$('#es-c')?.value,d=+$('#es-d')?.value;
  if(isNaN(a)||isNaN(b)||isNaN(c)||isNaN(d))return toast('Fill all cells with numbers','err');
  if(a<0||b<0||c<0||d<0)return toast('Values must be non-negative','err');
  // Haldane continuity correction for zero cells
  const hasZero=a===0||b===0||c===0||d===0;
  if(hasZero){a+=0.5;b+=0.5;c+=0.5;d+=0.5}
  const or=(a*d)/(b*c);
  const rr=(a/(a+b))/(c/(c+d));
  const seLogOR=Math.sqrt(1/a+1/b+1/c+1/d);
  const ciOR=[Math.exp(Math.log(or)-1.96*seLogOR),Math.exp(Math.log(or)+1.96*seLogOR)];
  const seLogRR=Math.sqrt(1/a-1/(a+b)+1/c-1/(c+d));
  const ciRR=[Math.exp(Math.log(rr)-1.96*seLogRR),Math.exp(Math.log(rr)+1.96*seLogRR)];
  window._lastES={type:'or',or,rr,ciOR,ciRR,a,b,c,d,corrected:hasZero};
  H('#es-results',`<div style="padding:12px;background:var(--bi);border:1px solid var(--bd);border-radius:6px;font-family:var(--mf);font-size:13px;line-height:2">
    <span style="color:var(--ac);font-weight:700">Odds Ratio = ${or.toFixed(4)}</span><br>
    OR 95% CI: [${ciOR[0].toFixed(4)}, ${ciOR[1].toFixed(4)}]<br>
    <span style="color:var(--sg)">Risk Ratio = ${rr.toFixed(4)}</span><br>
    RR 95% CI: [${ciRR[0].toFixed(4)}, ${ciRR[1].toFixed(4)}]${hasZero?'<br><span style="color:var(--wa)">⚠ Haldane correction (+0.5) applied for zero cells</span>':''}</div>`)}
function saveEffectSize(){
  const sel=$('#es-paper-select')?.value;if(!sel)return toast('Select a paper','err');
  if(!window._lastES)return toast('Calculate first','err');
  const p=S.lib.find(x=>x.id===sel);if(!p)return;
  p.effectSize=window._lastES;dbPut(p);toast('Effect size saved to paper','ok')}

// ═══ ENHANCED FOREST PLOT ═══
function buildForestPlotEnhanced(){
  const papers=S.lib.filter(p=>p.effectSize&&p.effectSize.type==='d');
  if(papers.length<2)return toast('Need at least 2 papers with computed effect sizes. Use the Effect Size Calculator first.','err');
  const data=papers.map(p=>({title:(p.title||'').slice(0,45),d:p.effectSize.cohenD,ci:[p.effectSize.ci95[0],p.effectSize.ci95[1]],n:p.effectSize.n1+p.effectSize.n2,w:1/(p.effectSize.se*p.effectSize.se)}));
  // Fixed-effect summary
  const sumW=data.reduce((s,d)=>s+d.w,0);
  const sumWD=data.reduce((s,d)=>s+d.w*d.d,0);
  const feD=sumWD/sumW;
  const feSE=1/Math.sqrt(sumW);
  const feCI=[feD-1.96*feSE,feD+1.96*feSE];
  // I² heterogeneity
  const Q=data.reduce((s,d)=>s+d.w*(d.d-feD)*(d.d-feD),0);
  const df=data.length-1;
  const I2=df>0?Math.max(0,(Q-df)/Q*100):0;
  const labels=[...data.map(d=>d.title),'Summary (FE)'];
  const xs=[...data.map(d=>d.d),feD];
  const errPlus=[...data.map(d=>d.ci[1]-d.d),feCI[1]-feD];
  const errMinus=[...data.map(d=>d.d-d.ci[0]),feD-feCI[0]];
  const colors=[...data.map(()=>'#C9956B'),'#7B9E87'];
  const sizes=[...data.map(d=>Math.max(6,Math.min(18,Math.sqrt(d.w)*2))),14];
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Forest Plot (${data.length} studies) — I² = ${I2.toFixed(1)}%</h4></div><div class="sb"><div class="pcc" id="enhForestPlot" style="height:${Math.max(250,labels.length*35)}px"></div><div style="font-size:12px;color:var(--ts);font-family:var(--mf);margin-top:8px">Summary effect (fixed): d = ${feD.toFixed(3)} [${feCI[0].toFixed(3)}, ${feCI[1].toFixed(3)}] · Q = ${Q.toFixed(2)}, df = ${df}, I² = ${I2.toFixed(1)}%${I2>50?' ⚠ substantial heterogeneity':''}</div></div></div>`);
  setTimeout(()=>Plotly.newPlot('enhForestPlot',[{y:labels,x:xs,error_x:{type:'data',array:errPlus,arrayminus:errMinus,color:'rgba(201,149,107,.6)',thickness:2},type:'scatter',mode:'markers',marker:{size:sizes,color:colors},text:data.map(d=>`d=${d.d.toFixed(3)} [${d.ci[0].toFixed(3)},${d.ci[1].toFixed(3)}]`).concat(`FE=${feD.toFixed(3)}`),hoverinfo:'text'}],{...PL,height:Math.max(250,labels.length*35),xaxis:{...PL.xaxis,title:'Effect Size (Cohen\'s d)',zeroline:true,zerolinecolor:'rgba(255,255,255,.3)'},yaxis:{...PL.yaxis,autorange:'reversed'},margin:{...PL.margin,l:280},shapes:[{type:'line',x0:0,x1:0,y0:0,y1:1,yref:'paper',line:{color:'rgba(255,255,255,.2)',dash:'dot'}},{type:'line',x0:feD,x1:feD,y0:0,y1:1,yref:'paper',line:{color:'rgba(123,158,135,.4)',dash:'dash'}}]},{responsive:true}),50)}

// ═══ REPORT GENERATION ═══
function generateReport(){
  if(!S.lib.length)return toast('No papers in library','err');
  const screenMap=typeof _screeningData!=='undefined'?Object.fromEntries(_screeningData.map(s=>[s.paperId,s])):{};
  const total=S.lib.length;
  const inc=Object.values(screenMap).filter(s=>s.decision==='include').length;
  const exc=Object.values(screenMap).filter(s=>s.decision==='exclude').length;
  const may=Object.values(screenMap).filter(s=>s.decision==='maybe').length;
  const unscreened=total-inc-exc-may;
  const withFindings=S.lib.filter(p=>p.findings);
  const withES=S.lib.filter(p=>p.effectSize);
  const yearRange=S.lib.filter(p=>p.year).map(p=>p.year);
  const minY=yearRange.length?Math.min(...yearRange):'N/A';
  const maxY=yearRange.length?Math.max(...yearRange):'N/A';
  const journals=[...new Set(S.lib.map(p=>p.journal).filter(Boolean))];
  // Build HTML report
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Meridian Research Report</title>
<style>
@media print{body{font-size:11pt}h1{font-size:18pt}h2{font-size:14pt}.no-print{display:none!important}}
body{font-family:'Inter',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#2a2a2a;line-height:1.7}
h1{color:#1a1a2e;border-bottom:2px solid #C9956B;padding-bottom:8px;font-size:24px}
h2{color:#C9956B;margin-top:28px;font-size:18px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
th{background:#f5f0eb;padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;font-size:11px;letter-spacing:.5px}
td{padding:6px 10px;border-bottom:1px solid #eee}
tr:nth-child(even){background:#faf8f5}
.stat{display:inline-block;padding:4px 12px;margin:2px;border-radius:4px;background:#f5f0eb;font-family:monospace;font-size:13px}
.meta{font-size:12px;color:#888;font-family:monospace}
.prisma{text-align:center;padding:20px;font-family:monospace;font-size:13px}
.prisma-box{display:inline-block;padding:8px 16px;border:2px solid #C9956B;border-radius:6px;margin:4px}
.prisma-arrow{color:#C9956B;font-size:18px}
</style></head><body>
<div class="no-print" style="text-align:right;margin-bottom:20px"><button onclick="window.print()" style="padding:8px 20px;background:#C9956B;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print / Save PDF</button></div>
<h1>Research Report</h1>
<p class="meta">Generated ${new Date().toISOString().slice(0,10)} by Meridian Research Platform</p>
<h2>Executive Summary</h2>
<p>This report covers <strong>${total} papers</strong> spanning ${minY}–${maxY} across ${journals.length} journals.
${inc?' '+inc+' papers were included after screening.':''}
${withFindings.length?' Findings were extracted from '+withFindings.length+' papers.':''}
${withES.length?' Effect sizes were computed for '+withES.length+' papers.':''}</p>
<h2>Methods</h2>
<h3>PRISMA Flow</h3>
<div class="prisma">
<div class="prisma-box">Identified: ${total}</div><br><span class="prisma-arrow">↓</span><br>
<div class="prisma-box">Screened: ${total-unscreened}</div> <span style="color:#888">→ Excluded: ${exc}</span><br><span class="prisma-arrow">↓</span><br>
<div class="prisma-box">Eligible: ${inc+may}</div> <span style="color:#888">→ Maybe: ${may}</span><br><span class="prisma-arrow">↓</span><br>
<div class="prisma-box" style="border-color:#7B9E87">Included: ${inc||total}</div>
</div>
<p><strong>Screening statistics:</strong></p>
<div><span class="stat">Total: ${total}</span><span class="stat">Screened: ${total-unscreened}</span><span class="stat" style="background:#e8f5e9">Included: ${inc}</span><span class="stat" style="background:#fce4ec">Excluded: ${exc}</span><span class="stat" style="background:#fff8e1">Maybe: ${may}</span></div>
<h2>Results</h2>
<h3>Paper Overview</h3>
<table><thead><tr><th>Title</th><th>Authors</th><th>Year</th><th>Journal</th><th>Citations</th></tr></thead><tbody>
${S.lib.slice(0,100).map(p=>`<tr><td>${escHTML((p.title||'').slice(0,80))}</td><td>${escHTML((p.authors||[]).slice(0,2).join(', '))}</td><td>${p.year||''}</td><td>${escHTML(p.journal||'')}</td><td>${p.cited||0}</td></tr>`).join('')}
</tbody></table>
${withFindings.length?`<h3>Extracted Findings</h3><table><thead><tr><th>Paper</th><th>Location</th><th>n</th><th>Method</th><th>Finding</th></tr></thead><tbody>
${withFindings.map(p=>`<tr><td>${escHTML((p.title||'').slice(0,50))}</td><td>${escHTML(p.findings.location||'')}</td><td>${p.findings.n||''}</td><td>${escHTML(p.findings.method||'')}</td><td>${escHTML(p.findings.finding||'')}</td></tr>`).join('')}
</tbody></table>`:''}
${withES.length?`<h3>Effect Sizes</h3><table><thead><tr><th>Paper</th><th>Type</th><th>Estimate</th><th>95% CI</th></tr></thead><tbody>
${withES.map(p=>{const es=p.effectSize;return`<tr><td>${escHTML((p.title||'').slice(0,50))}</td><td>${es.type==='d'?"Cohen's d":'OR'}</td><td>${es.type==='d'?es.cohenD.toFixed(3):es.or.toFixed(3)}</td><td>${es.type==='d'?'['+es.ci95[0].toFixed(3)+', '+es.ci95[1].toFixed(3)+']':'['+es.ciOR[0].toFixed(3)+', '+es.ciOR[1].toFixed(3)+']'}</td></tr>`}).join('')}
</tbody></table>`:''}
<h2>Bibliography</h2>
<ol style="font-size:13px;line-height:1.8">
${S.lib.map(p=>`<li>${escHTML((p.authors||[]).slice(0,3).join(', '))} (${p.year||'n.d.'}). ${escHTML(p.title||'')}. <em>${escHTML(p.journal||'')}</em>.${p.doi?' <a href="'+p.doi+'">'+p.doi+'</a>':''}</li>`).join('')}
</ol>
<hr style="margin-top:30px;border:0;border-top:1px solid #ddd">
<p class="meta" style="text-align:center">Generated by Meridian Research Platform</p>
</body></html>`;
  const w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();toast('Report opened in new tab','ok')}
  else toast('Popup blocked — allow popups for this page','err')}

// ═══ EVIDENCE TABLE ═══
let _evSortCol='',_evSortDir=1,_evFilters={};
function buildEvidenceTable(){
  const papers=S.lib.filter(p=>p.findings);
  if(!papers.length)return toast('No papers with extracted findings. Use "Extract All Findings" in Library first.','err');
  const rows=papers.map(p=>({species:(p._species||extractSpecies([p.title||'',p.abstract||''].join(' '))).join('; '),location:p.findings.location||'',n:p.findings.n||'',method:p.findings.method||'',finding:p.findings.finding||'',yearRange:p.findings.year_range||String(p.year||''),paper:(p.title||'').slice(0,60),doi:p.doi||''}));
  _evSortCol='';_evSortDir=1;_evFilters={};
  renderEvidenceTableHTML(rows)}
function getFilteredEvidenceRows(rows){
  let fl=rows;
  Object.entries(_evFilters).forEach(([col,val])=>{if(val)fl=fl.filter(r=>String(r[col]||'').toLowerCase().includes(val.toLowerCase()))});
  if(_evSortCol){fl=[...fl].sort((a,b)=>{const av=String(a[_evSortCol]||''),bv=String(b[_evSortCol]||'');return av.localeCompare(bv)*_evSortDir})}
  return fl}
function renderEvidenceTableHTML(rows){
  const cols=['species','location','n','method','finding','yearRange','paper','doi'];
  const labels=['Species','Location','n','Method','Key Finding','Year Range','Paper','DOI'];
  const fl=getFilteredEvidenceRows(rows);
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Evidence Table (${fl.length}/${rows.length} entries)</h4></div><div class="sb"><div style="overflow:auto;max-height:500px"><table class="ev-table"><thead><tr>${labels.map((l,i)=>`<th onclick="window._evRows=${JSON.stringify(rows).replace(/"/g,'&quot;').replace(/'/g,'&#39;')};void 0" data-col="${cols[i]}">${l}${_evSortCol===cols[i]?(_evSortDir===1?' ↑':' ↓'):''}</th>`).join('')}</tr><tr>${cols.map(c=>`<td><input class="ev-filter" placeholder="Filter..." value="${escHTML(_evFilters[c]||'')}" data-evcol="${c}"/></td>`).join('')}</tr></thead><tbody>${fl.map(r=>`<tr>${cols.map(c=>`<td title="${escHTML(String(r[c]||''))}">${c==='doi'&&r[c]?`<a href="${r[c]}" target="_blank" style="color:var(--ac)">Link</a>`:escHTML(String(r[c]||''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div style="margin-top:8px;display:flex;gap:6px"><button class="bt sm" onclick="exportEvidenceCSV()">Export CSV</button><button class="bt sm" onclick="exportEvidenceMarkdown()">Export Markdown</button></div></div></div>`);
  // Store rows globally for sort/filter
  window._evAllRows=rows;
  // Bind sort
  document.querySelectorAll('.ev-table th[data-col]').forEach(th=>{th.onclick=()=>{const c=th.dataset.col;if(_evSortCol===c)_evSortDir*=-1;else{_evSortCol=c;_evSortDir=1}renderEvidenceTableHTML(window._evAllRows)}});
  // Bind filters
  document.querySelectorAll('.ev-filter').forEach(inp=>{inp.oninput=debounce(()=>{_evFilters[inp.dataset.evcol]=inp.value;renderEvidenceTableHTML(window._evAllRows)},200)})}
function exportEvidenceCSV(){
  if(!window._evAllRows)return;const rows=getFilteredEvidenceRows(window._evAllRows);
  const cols=['species','location','n','method','finding','yearRange','paper','doi'];
  dl(['Species,Location,n,Method,Key Finding,Year Range,Paper,DOI',...rows.map(r=>cols.map(c=>'"'+(String(r[c]||'').replace(/"/g,"'"))+'"').join(','))].join('\n'),'evidence_table.csv','text/csv');toast('Evidence table exported','ok')}
function exportEvidenceMarkdown(){
  if(!window._evAllRows)return;const rows=getFilteredEvidenceRows(window._evAllRows);
  const hdr='| Species | Location | n | Method | Key Finding | Year Range | Paper | DOI |';
  const sep='|---|---|---|---|---|---|---|---|';
  const body=rows.map(r=>`| ${r.species} | ${r.location} | ${r.n} | ${r.method} | ${r.finding} | ${r.yearRange} | ${r.paper} | ${r.doi} |`).join('\n');
  dl(hdr+'\n'+sep+'\n'+body,'evidence_table.md','text/plain');toast('Evidence Markdown exported','ok')}

// ═══ PRISMA FLOW DIAGRAM ═══
async function buildPRISMADiagram(){
  const screenData=await dbGetAllScreening();
  if(!_searchAudit.length&&!screenData.length)return toast('Run searches and screen papers first','err');
  // Compute PRISMA numbers
  const totalByAPI={OA:0,SS:0,CR:0,PM:0};
  let totalRecords=0;
  _searchAudit.forEach(a=>{Object.entries(a.apis).forEach(([k,v])=>{if(v.count)totalByAPI[k]+=v.count});totalRecords+=a.totalHits});
  const dedupedTotal=_searchAudit.reduce((s,a)=>s+a.dedupedCount,0);
  const duplicatesRemoved=totalRecords-dedupedTotal;
  const screenMap=Object.fromEntries(screenData.map(s=>[s.paperId,s]));
  const totalScreened=screenData.length;
  const included=screenData.filter(s=>s.decision==='include').length;
  const excluded=screenData.filter(s=>s.decision==='exclude').length;
  const maybe=screenData.filter(s=>s.decision==='maybe').length;
  const inLib=S.lib.length;
  // Sankey diagram
  const labels=['OpenAlex','Semantic Scholar','CrossRef','PubMed','All Records','After Dedup','Screened','Included','Excluded','Maybe'];
  const source=[0,1,2,3,4,5,6,6,6];
  const target=[4,4,4,4,5,6,7,8,9];
  const value=[totalByAPI.OA||1,totalByAPI.SS||1,totalByAPI.CR||1,totalByAPI.PM||1,totalRecords||1,dedupedTotal||inLib||1,included||0,excluded||0,maybe||0].map(v=>Math.max(v,0.5));
  H('#gapContent',`<div class="sec"><div class="sh"><h4>PRISMA 2020 Flow Diagram</h4></div><div class="sb"><div class="pcc" id="prismaPlot" style="height:500px"></div>
  <div style="margin-top:12px;font-size:12px;font-family:var(--mf);color:var(--ts)"><table class="dt"><tbody>
  <tr><td style="color:var(--ac)">Identification</td><td>OA: ${totalByAPI.OA} · SS: ${totalByAPI.SS} · CR: ${totalByAPI.CR} · PM: ${totalByAPI.PM} = ${totalRecords} total</td></tr>
  <tr><td style="color:var(--ac)">Deduplication</td><td>${duplicatesRemoved} duplicates removed → ${dedupedTotal||inLib} unique</td></tr>
  <tr><td style="color:var(--ac)">Screening</td><td>${totalScreened} screened of ${inLib} in library</td></tr>
  <tr><td style="color:var(--sg)">Included</td><td>${included}</td></tr>
  <tr><td style="color:var(--co)">Excluded</td><td>${excluded}</td></tr>
  <tr><td style="color:var(--wa)">Maybe</td><td>${maybe}</td></tr>
  </tbody></table></div>
  <div style="margin-top:8px"><button class="bt sm" onclick="exportChart('prismaPlot')">Export PNG</button></div></div></div>`);
  setTimeout(()=>{Plotly.newPlot('prismaPlot',[{type:'sankey',orientation:'h',node:{pad:20,thickness:20,line:{color:CL[0],width:0.5},label:labels,color:['#6BA3C9','#9B8EC4','#D4A04A','#C96BA3','var(--ac)','var(--ts)','var(--ac)','var(--sg)','var(--co)','var(--wa)']},link:{source,target,value,color:['rgba(107,163,201,.3)','rgba(155,142,196,.3)','rgba(212,160,74,.3)','rgba(201,107,163,.3)','rgba(201,149,107,.2)','rgba(201,149,107,.2)','rgba(123,158,135,.3)','rgba(194,120,120,.3)','rgba(212,160,74,.3)']}}],{...PL,height:500,title:{text:'PRISMA 2020 Flow',font:{size:14,color:'#A99D91'}}},{responsive:true})},50)}

// ═══ 4. BETTER SEARCH & DISCOVERY ═══
let _queryRows=[{field:'all',op:'AND',term:''}];
let _savedAlerts=safeParse('meridian_alerts',[]);
let _orcidTracking=safeParse('meridian_orcids',[]);
function renderQueryBuilder(){
  const panel=$('#qbPanel');if(!panel)return;
  panel.innerHTML=`<div style="margin-bottom:10px">${_queryRows.map((r,i)=>`<div class="qb-row">${i>0?`<select class="qb-op" onchange="_queryRows[${i}].op=this.value"><option value="AND" ${r.op==='AND'?'selected':''}>AND</option><option value="OR" ${r.op==='OR'?'selected':''}>OR</option><option value="NOT" ${r.op==='NOT'?'selected':''}>NOT</option></select>`:''}<select class="qb-field" onchange="_queryRows[${i}].field=this.value"><option value="all" ${r.field==='all'?'selected':''}>All fields</option><option value="title" ${r.field==='title'?'selected':''}>Title</option><option value="abstract" ${r.field==='abstract'?'selected':''}>Abstract</option><option value="author" ${r.field==='author'?'selected':''}>Author</option><option value="journal" ${r.field==='journal'?'selected':''}>Journal</option><option value="taxon" ${r.field==='taxon'?'selected':''}>Taxon</option></select><input class="fi" style="flex:1" value="${escHTML(r.term)}" placeholder="Search term..." oninput="_queryRows[${i}].term=this.value" onkeydown="if(event.key==='Enter'){buildBooleanQuery();_litPage=0;litSearch()}"/>${i>0?`<button class="bt sm" style="color:var(--co)" onclick="_queryRows.splice(${i},1);renderQueryBuilder()">×</button>`:''}</div>`).join('')}</div><div style="display:flex;gap:6px"><button class="bt sm" onclick="_queryRows.push({field:'all',op:'AND',term:''});renderQueryBuilder()">+ Add term</button><button class="bt sm on" onclick="buildBooleanQuery();_litPage=0;litSearch()">Search</button><button class="bt sm" onclick="saveSearchAlert()">Save Alert</button></div>`;
}
function buildBooleanQuery(){
  const parts=_queryRows.filter(r=>r.term.trim()).map((r,i)=>{
    let term=r.term.trim();
    if(r.field==='title')term='title:'+term;
    else if(r.field==='author')term='author:'+term;
    else if(r.field==='journal')term='journal:'+term;
    if(i>0&&r.op==='NOT')term='-'+term;
    return term});
  const q=parts.join(' ');$('#lq').value=q}
function saveSearchAlert(){
  const q=$('#lq').value.trim();if(!q)return toast('Enter a search query first','err');
  _savedAlerts.push({query:q,created:new Date().toISOString(),lastRun:null,newResults:0});
  safeStore('meridian_alerts',_savedAlerts);toast('Alert saved — run "Check Alerts" to find new papers','ok');renderAlerts()}
function renderAlerts(){
  const el=$('#alertsList');if(!el)return;
  el.innerHTML=_savedAlerts.length?_savedAlerts.map((a,i)=>`<div class="alert-card"><div><div class="alert-query">${escHTML(a.query)}</div><div class="alert-meta">Created: ${a.created.slice(0,10)}${a.lastRun?' · Last checked: '+a.lastRun.slice(0,10):''}</div></div><div style="display:flex;gap:4px"><button class="bt sm" onclick="runAlert(${i})">Run</button><button class="bt sm" style="color:var(--co)" onclick="_savedAlerts.splice(${i},1);safeStore('meridian_alerts',_savedAlerts);renderAlerts()">×</button></div></div>`).join(''):'<p style="color:var(--tm);font-size:12px">No saved alerts. Search and click "Save Alert".</p>'}
async function runAlert(idx){
  const a=_savedAlerts[idx];if(!a)return;
  $('#lq').value=a.query;const prevResults=a.lastResults||[];a.lastRun=new Date().toISOString();
  safeStore('meridian_alerts',_savedAlerts);
  goTab('lit');_litPage=0;await litSearch();
  // Detect new results
  if(prevResults.length&&_litAllResults.length){
    const prevSet=new Set(prevResults);
    const newPapers=_litAllResults.filter(p=>{const key=(p.doi||p.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);return!prevSet.has(key)});
    if(newPapers.length)toast(newPapers.length+' new papers since last check!','ok');
    else toast('No new papers since last check','info')}
  // Store current result keys
  a.lastResults=_litAllResults.map(p=>(p.doi||p.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50));
  safeStore('meridian_alerts',_savedAlerts)}
async function moreLikeThis(paperId){
  const p=S.lib.find(x=>x.id===paperId);if(!p)return;
  toast('Finding similar papers...','info');
  try{const sp=await fetchSSPaperByTitle(p.title);
    if(!sp)return toast('Paper not found on Semantic Scholar','err');
    const r=await fetchT('https://api.semanticscholar.org/recommendations/v1/papers/forpaper/'+sp.paperId+'?limit=20&fields=title,authors,year,venue,citationCount,isOpenAccess,externalIds',15000);
    if(!r.ok)throw new Error('Recommendations API failed');
    const d=await r.json();
    S.litR=(d.recommendedPapers||[]).map(c=>({id:c.paperId||'',title:c.title||'',authors:(c.authors||[]).map(a=>a.name),year:c.year,journal:c.venue||'',doi:c.externalIds?.DOI?'https://doi.org/'+c.externalIds.DOI:null,cited:c.citationCount||0,isOA:c.isOpenAccess||false,abstract:null,concepts:[],url:c.externalIds?.DOI?'https://doi.org/'+c.externalIds.DOI:'',src:'SS'}));
    _litAllResults=S.litR;_litPage=0;goTab('lit');
    H('#lstat',`<span style="color:var(--ac);font-weight:700">${S.litR.length}</span> papers similar to "${p.title.slice(0,40)}..."`);sh('#lstat');
    if(S.litR.length){sh('#compileBtn');sh('#saveAllBtn')}
    renderLitPage();toast(S.litR.length+' similar papers found','ok');
  }catch(e){toast('Similar search failed: '+e.message,'err')}}
async function trackOrcid(){
  const orcid=prompt('Enter ORCID (e.g. 0000-0002-1234-5678):');if(!orcid)return;
  toast('Looking up ORCID...','info');
  try{const r=await fetchT('https://api.openalex.org/authors/orcid:'+orcid+'?mailto=r@meridian.app',10000);
    if(!r.ok)throw new Error('ORCID not found');
    const d=await r.json();
    _orcidTracking.push({orcid,name:d.display_name,works:d.works_count,lastChecked:new Date().toISOString(),oaId:d.id});
    safeStore('meridian_orcids',_orcidTracking);
    toast('Now tracking: '+d.display_name+' ('+d.works_count+' works)','ok');renderOrcidPanel()}
  catch(e){toast('ORCID lookup failed: '+e.message,'err')}}
function renderOrcidPanel(){
  const el=$('#orcidList');if(!el)return;
  el.innerHTML=_orcidTracking.length?_orcidTracking.map((o,i)=>`<div class="alert-card"><div><div class="alert-query">${escHTML(o.name)}</div><div class="alert-meta">ORCID: ${o.orcid} · ${o.works||0} works</div></div><div style="display:flex;gap:4px"><button class="bt sm" onclick="searchByOrcid(${i})">Papers</button><button class="bt sm" style="color:var(--co)" onclick="_orcidTracking.splice(${i},1);safeStore('meridian_orcids',_orcidTracking);renderOrcidPanel()">×</button></div></div>`).join(''):'<p style="color:var(--tm);font-size:12px">No tracked authors.</p>'}
async function searchByOrcid(idx){
  const o=_orcidTracking[idx];if(!o)return;
  toast('Fetching works by '+o.name+'...','info');
  try{const r=await fetchT('https://api.openalex.org/works?filter=author.orcid:'+o.orcid+'&per_page=30&sort=publication_year:desc&mailto=r@meridian.app',15000);
    if(!r.ok)throw 0;const d=await r.json();
    S.litR=(d.results||[]).map(w=>({id:w.id,title:w.title,authors:(w.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean),year:w.publication_year,journal:w.primary_location?.source?.display_name||'',doi:w.doi,cited:w.cited_by_count||0,isOA:w.open_access?.is_oa||false,pdfUrl:w.best_oa_location?.pdf_url,abstract:recAbs(w.abstract_inverted_index),concepts:(w.concepts||[]).slice(0,6).map(c=>c.display_name),url:w.doi||w.id,src:'OA'}));
    _litAllResults=S.litR;_litPage=0;goTab('lit');
    H('#lstat',`<span style="color:var(--ac);font-weight:700">${S.litR.length}</span> works by ${o.name}`);sh('#lstat');if(S.litR.length){sh('#compileBtn');sh('#saveAllBtn')}renderLitPage();
  }catch{toast('Failed to fetch works','err')}}

// ═══ 5. PROPER CITATION MANAGEMENT ═══
let _bibKeyCount={};
function toBibTeX(p){
  const surname=(p.authors?.[0]?.split(' ').pop()||'Unknown').replace(/[^a-zA-Z]/g,'');
  const yr=p.year||'XXXX';
  let key=surname+yr;
  if(_bibKeyCount[key]){_bibKeyCount[key]++;key+=String.fromCharCode(96+_bibKeyCount[key])}else{_bibKeyCount[key]=1}
  const doi=p.doi?p.doi.replace('https://doi.org/',''):'';
  const fields=[`  title = {${p.title||''}}`,`  author = {${(p.authors||[]).join(' and ')}}`,`  year = {${yr}}`,`  journal = {${p.journal||''}}`,doi?`  doi = {${doi}}`:null,p.abstract?`  abstract = {${p.abstract.replace(/[{}]/g,'')}}`:null,p.url||p.doi?`  url = {${p.url||p.doi}}`:null,(p.concepts||[]).length?`  keywords = {${p.concepts.join(', ')}}`:null].filter(Boolean);
  return `@article{${key},\n${fields.join(',\n')}\n}`}
function toRIS(p){
  const lines=['TY  - JOUR','TI  - '+(p.title||''),...(p.authors||[]).map(a=>'AU  - '+a),'PY  - '+(p.year||''),'JO  - '+(p.journal||'')];
  if(p.doi)lines.push('DO  - '+p.doi.replace('https://doi.org/',''));
  if(p.abstract)lines.push('AB  - '+p.abstract.replace(/\n/g,' '));
  if(p.url||p.doi)lines.push('UR  - '+(p.url||p.doi));
  if((p.concepts||[]).length)p.concepts.forEach(c=>lines.push('KW  - '+c));
  lines.push('ER  - ','');
  return lines.join('\n')}
const CITE_STYLES={
  apa:{name:'APA 7th',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'',doi=p.doi||'';
    const aStr=a.length>2?a[0]+' et al.':a.join(' & ');
    return `${aStr} (${yr}). ${t}. *${j}*.${doi?' '+doi:''}`}},
  harvard:{name:'Harvard',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.length>3?a[0]+' et al.':a.join(', ');
    return `${aStr}, ${yr}. ${t}. ${j}.${p.doi?' Available at: '+p.doi:''}`}},
  vancouver:{name:'Vancouver',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.slice(0,6).join(', ')+(a.length>6?', et al.':'');
    return `${aStr}. ${t}. ${j}. ${yr}.${p.doi?' doi:'+p.doi.replace('https://doi.org/',''):''}`}},
  chicago:{name:'Chicago',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.length>3?a[0]+' et al.':a.join(', ');
    return `${aStr}. ${yr}. "${t}." ${j}.${p.doi?' '+p.doi:''}`}},
  ieee:{name:'IEEE',fmt:(p,i)=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.slice(0,6).join(', ')+(a.length>6?' et al.':'');
    return `[${(i||0)+1}] ${aStr}, "${t}," ${j}, ${yr}.${p.doi?' doi: '+p.doi.replace('https://doi.org/',''):''}`}},
  nature:{name:'Nature',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.slice(0,5).join(', ')+(a.length>5?' et al.':'');
    return `${aStr}. ${t}. *${j}* (${yr}).${p.doi?' '+p.doi:''}`}},
  frontiers:{name:'Frontiers',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.join(', ');
    return `${aStr} (${yr}). ${t}. *${j}*.${p.doi?' doi: '+p.doi.replace('https://doi.org/',''):''}`}},
  mla:{name:'MLA 9th',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.length>2?a[0]+', et al.':a.length===2?a[0]+', and '+a[1]:a[0]||'';
    return `${aStr}. "${t}." *${j}*, ${yr}.${p.doi?' '+p.doi:''}`}},
  cell:{name:'Cell/Elsevier',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.slice(0,10).join(', ')+(a.length>10?', et al.':'');
    return `${aStr} (${yr}). ${t}. ${j}.${p.doi?' '+p.doi:''}`}},
  science:{name:'Science',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.slice(0,5).join(', ')+(a.length>5?' et al.':'');
    return `${aStr}, ${t}. *${j}* (${yr}).${p.doi?' doi:'+p.doi.replace('https://doi.org/',''):''}`}},
  ices:{name:'ICES J Mar Sci',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'',j=p.journal||'';
    const aStr=a.length>2?a[0]+' et al.':a.join(', and ');
    return `${aStr} ${yr}. ${t}. ${j}.${p.doi?' '+p.doi:''}`}},
  meps:{name:'Mar Ecol Prog Ser',fmt:p=>{const a=p.authors||[],yr=p.year||'n.d.',t=p.title||'';
    const aStr=a.length>2?a.slice(0,2).map(x=>{const parts=x.split(' ');return parts.length>1?parts.pop()+' '+parts.map(p=>p[0]).join(''):x}).join(', ')+' and others':a.map(x=>{const parts=x.split(' ');return parts.length>1?parts.pop()+' '+parts.map(p=>p[0]).join(''):x}).join(', ');
    return `${aStr} (${yr}) ${t}. Mar Ecol Prog Ser${p.doi?' doi:'+p.doi.replace('https://doi.org/',''):''}`}}
};
function toFormattedCitation(p,style='apa',idx){
  const s=CITE_STYLES[style];return s?s.fmt(p,idx):`${(p.authors||[]).join(', ')} (${p.year||'n.d.'}). ${p.title||''}. ${p.journal||''}.`}
function exportBibTeX(){
  _bibKeyCount={};
  const papers=S.activeCol&&S.cols[S.activeCol]?S.lib.filter(p=>S.cols[S.activeCol].paperIds.includes(p.id)):S.lib;
  if(!papers.length)return toast('No papers to export','err');
  dl(papers.map(toBibTeX).join('\n\n'),'meridian_library.bib','text/plain');toast(papers.length+' papers exported as BibTeX','ok')}
function copyPaperBibTeX(id){_bibKeyCount={};const p=S.lib.find(x=>x.id===id);if(!p)return;navigator.clipboard.writeText(toBibTeX(p));toast('BibTeX copied','ok')}
function exportRIS(){
  const papers=S.activeCol&&S.cols[S.activeCol]?S.lib.filter(p=>S.cols[S.activeCol].paperIds.includes(p.id)):S.lib;
  if(!papers.length)return toast('No papers to export','err');
  dl(papers.map(toRIS).join('\n'),'meridian_library.ris','text/plain');toast(papers.length+' papers exported as RIS','ok')}
function copyFormattedCitation(id,style){
  const p=S.lib.find(x=>x.id===id);if(!p)return;
  navigator.clipboard.writeText(toFormattedCitation(p,style));toast('Citation copied ('+(CITE_STYLES[style]?.name||style)+')','ok')}
let _citeStyle=safeParse('meridian_cite_style','apa');
function openCitePanel(singleId){
  if(singleId&&typeof PADI!=='undefined'&&PADI.engTrack)PADI.engTrack(singleId,'cite');
  const papers=singleId?S.lib.filter(x=>x.id===singleId):
    (S.activeCol&&S.cols[S.activeCol]?S.lib.filter(p=>S.cols[S.activeCol].paperIds.includes(p.id)):S.lib);
  if(!papers.length)return toast('No papers','err');
  const styleOpts=Object.entries(CITE_STYLES).map(([k,v])=>`<option value="${k}"${k===_citeStyle?' selected':''}>${v.name}</option>`).join('');
  const overlay=document.createElement('div');
  overlay.id='citePanelOverlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10002;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`<div style="background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);width:90%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.4)">
    <div style="padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <h3 style="font-size:14px;color:var(--ac);font-family:var(--mf)">Citation Export</h3>
        <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">${papers.length} paper${papers.length>1?'s':''}</span>
      </div>
      <button class="bt sm" onclick="document.getElementById('citePanelOverlay').remove()" style="font-size:16px;border:none;color:var(--tm)">✕</button>
    </div>
    <div style="padding:12px 18px;border-bottom:1px solid var(--bd);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <label style="font-size:11px;color:var(--tm);font-family:var(--mf)">Style:</label>
      <select class="fs" id="citeStyleSelect" onchange="_citeStyle=this.value;safeStore('meridian_cite_style',_citeStyle);renderCitePreview()">${styleOpts}</select>
      <button class="bt sm" onclick="copyCiteAll()">Copy All</button>
      <button class="bt sm" onclick="downloadCiteAll()">Download .txt</button>
      <button class="bt sm" onclick="downloadCiteDocx()">Download .docx (plain)</button>
    </div>
    <div id="citePreviewArea" style="padding:18px;overflow-y:auto;flex:1"></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  window._citePapers=papers;
  renderCitePreview()}
function renderCitePreview(){
  const papers=window._citePapers||[];const el=$('#citePreviewArea');if(!el)return;
  const formatted=papers.map((p,i)=>toFormattedCitation(p,_citeStyle,i));
  el.innerHTML=formatted.map((c,i)=>`<div style="padding:10px 12px;border-bottom:1px solid var(--bd);font-size:13px;line-height:1.7;cursor:pointer;transition:background .15s" onclick="navigator.clipboard.writeText(this.dataset.cite);toast('Copied','ok')" data-cite="${escHTML(c)}" title="Click to copy"><span style="color:var(--tm);font-family:var(--mf);font-size:10px;margin-right:8px">${i+1}</span>${escHTML(c)}</div>`).join('')}
function copyCiteAll(){
  const papers=window._citePapers||[];if(!papers.length)return;
  const text=papers.map((p,i)=>toFormattedCitation(p,_citeStyle,i)).join('\n\n');
  navigator.clipboard.writeText(text);toast(papers.length+' citations copied ('+CITE_STYLES[_citeStyle].name+')','ok')}
function downloadCiteAll(){
  const papers=window._citePapers||[];if(!papers.length)return;
  const text=papers.map((p,i)=>toFormattedCitation(p,_citeStyle,i)).join('\n\n');
  dl(text,'citations_'+_citeStyle+'.txt','text/plain');toast('Downloaded','ok')}
function downloadCiteDocx(){
  const papers=window._citePapers||[];if(!papers.length)return;
  const lines=papers.map((p,i)=>toFormattedCitation(p,_citeStyle,i));
  const xmlBody=lines.map(l=>'<w:p><w:r><w:t>'+l.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</w:t></w:r></w:p>').join('');
  const docxml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xmlBody}</w:body></w:document>`;
  const ct='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  // Minimal .docx via JSZip-less approach: just download as plain text with .docx hint
  dl(lines.join('\n\n'),'citations_'+_citeStyle+'.txt','text/plain');toast('Downloaded as text (paste into Word)','ok')}
function importBibFile(){
  const input=document.createElement('input');input.type='file';input.accept='.bib';
  input.onchange=async e=>{const file=e.target.files[0];if(!file)return;
    const text=await file.text();
    const entries=text.split(/(?=@\w+\{)/);let imported=0;
    for(const entry of entries){if(!entry.trim())continue;
      const title=(entry.match(/title\s*=\s*\{([^}]+)\}/i)||[])[1]||'';
      const authors=(entry.match(/author\s*=\s*\{([^}]+)\}/i)||[])[1]?.split(' and ')||[];
      const year=parseInt((entry.match(/year\s*=\s*\{?(\d{4})\}?/i)||[])[1])||null;
      const journal=(entry.match(/journal\s*=\s*\{([^}]+)\}/i)||[])[1]||'';
      const doi=(entry.match(/doi\s*=\s*\{([^}]+)\}/i)||[])[1]||'';
      if(title){await savePaper({title,authors:authors.map(a=>a.trim()),year,journal,doi:doi?'https://doi.org/'+doi:'',src:'BIB'});imported++}}
    toast(imported+' papers imported from .bib','ok')};
  input.click()}
function importRISFile(){
  const input=document.createElement('input');input.type='file';input.accept='.ris';
  input.onchange=async e=>{const file=e.target.files[0];if(!file)return;
    const text=await file.text();
    const entries=text.split(/\nER\s*-/);let imported=0;
    for(const entry of entries){if(!entry.trim())continue;
      const get=tag=>{const m=entry.match(new RegExp(tag+'\\s*-\\s*(.+)','i'));return m?m[1].trim():''};
      const getAll=tag=>[...entry.matchAll(new RegExp(tag+'\\s*-\\s*(.+)','gi'))].map(m=>m[1].trim());
      const title=get('TI')||get('T1');const authors=getAll('AU').concat(getAll('A1'));
      const year=parseInt(get('PY')||get('Y1'))||null;const journal=get('JO')||get('JF')||get('T2');
      const doi=get('DO');const abstract=get('AB');
      if(title){await savePaper({title,authors,year,journal,doi:doi?'https://doi.org/'+doi:'',abstract:abstract||null,src:'RIS'});imported++}}
    toast(imported+' papers imported from .ris','ok')};
  input.click()}

// ═══ 6. PDF VIEWER & ANNOTATIONS ═══
let _pdfDoc=null,_pdfPage=1,_pdfAnnots=safeParse('meridian_pdf_annots',{});
let _readingStatus=safeParse('meridian_reading_status',{});
function openPdfViewer(url,paperId){
  if(typeof pdfjsLib==='undefined')return toast('PDF.js not loaded','err');
  const modal=document.createElement('div');modal.className='pdf-modal';modal.id='pdfModal';
  modal.innerHTML=`<div class="pdf-toolbar"><button class="bt sm" onclick="pdfPrev()">← Prev</button><span id="pdfPageInfo" style="font-size:12px;color:var(--ts);font-family:var(--mf)">Loading...</span><button class="bt sm" onclick="pdfNext()">Next →</button><button class="bt sm" onclick="pdfZoom(1.2)">+</button><button class="bt sm" onclick="pdfZoom(0.8)">−</button><span style="flex:1"></span><button class="bt sm" onclick="addPdfAnnotation('${escJSAttr(paperId)}')">+ Annotation</button><button class="bt sm" onclick="exportPdfAnnotations('${escJSAttr(paperId)}')">Export Notes</button><button class="bt sm" style="color:var(--co)" onclick="closePdfViewer()">Close</button></div><div class="pdf-canvas-wrap" id="pdfCanvasWrap"><canvas id="pdfCanvas"></canvas></div>`;
  document.body.appendChild(modal);
  _pdfPage=1;window._pdfScale=1.5;window._pdfPaperId=paperId;
  pdfjsLib.getDocument(url).promise.then(doc=>{_pdfDoc=doc;renderPdfPage()}).catch(()=>{toast('Failed to load PDF — may be CORS restricted','err');closePdfViewer()})}
function renderPdfPage(){
  if(!_pdfDoc)return;
  _pdfDoc.getPage(_pdfPage).then(page=>{
    const vp=page.getViewport({scale:window._pdfScale||1.5});
    const canvas=$('#pdfCanvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');canvas.height=vp.height;canvas.width=vp.width;
    page.render({canvasContext:ctx,viewport:vp});
    $('#pdfPageInfo').textContent=`Page ${_pdfPage} / ${_pdfDoc.numPages}`})}
function pdfPrev(){if(_pdfPage>1){_pdfPage--;renderPdfPage()}}
function pdfNext(){if(_pdfDoc&&_pdfPage<_pdfDoc.numPages){_pdfPage++;renderPdfPage()}}
function pdfZoom(factor){window._pdfScale=(window._pdfScale||1.5)*factor;renderPdfPage()}
function closePdfViewer(){const m=$('#pdfModal');if(m)m.remove();_pdfDoc=null}
// ═══ FULL-TEXT PDF EXTRACTION ═══
async function extractPdfText(source,paperId){
  if(typeof pdfjsLib==='undefined')return toast('PDF.js not loaded','err');
  toast('Extracting text from PDF...','info');
  try{
    let doc;
    if(source instanceof File){const buf=await source.arrayBuffer();doc=await pdfjsLib.getDocument({data:buf}).promise}
    else{doc=await pdfjsLib.getDocument(source).promise}
    let text='';
    for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const tc=await page.getTextContent();text+=tc.items.map(it=>it.str).join(' ')+'\n'}
    text=text.slice(0,50000);// Cap at 50K chars
    if(paperId){const p=S.lib.find(x=>x.id===paperId);if(p){p.fullText=text;await dbPut(p)}}
    toast('Extracted '+text.length+' chars from '+doc.numPages+' pages','ok');
    return text;
  }catch(e){toast('PDF extraction failed: '+e.message,'err');return null}}
function uploadPdfForPaper(paperId){
  const input=document.createElement('input');input.type='file';input.accept='.pdf';
  input.onchange=async e=>{const file=e.target.files[0];if(!file)return;
    const text=await extractPdfText(file,paperId);
    if(text){const p=S.lib.find(x=>x.id===paperId);
      if(p&&S.apiK){if(confirm('Text extracted. Run AI finding extraction on full text?'))await extractFindingsFromText(paperId,text)}}};
  input.click()}
async function extractFindingsFromText(id,text){
  if(!S.apiK)return toast('Set API key in AI tab','err');
  const p=S.lib.find(x=>x.id===id);if(!p)return;
  const src=text||(p.fullText)||(p.abstract);if(!src)return toast('No text available','err');
  const snippet=src.slice(0,4000);
  try{const d=await callAI({messages:[{role:'user',content:`Extract from this paper text as JSON only (no markdown): {"location":"study location or region","n":"sample size","method":"main methodology","variables":"key measured variables","finding":"main quantitative finding","year_range":"study period"}\n\nText: ${snippet}`}],maxTokens:400});
    const txt=d.content?.[0]?.text||'{}';p.findings=JSON.parse(txt.replace(/```json|```/g,'').trim());
    await dbPut(p);renderLib();toast('Findings extracted from full text','ok');
  }catch{toast('AI extraction failed','err')}}
function addPdfAnnotation(paperId){
  const text=prompt('Annotation for page '+_pdfPage+':');if(!text)return;
  if(!_pdfAnnots[paperId])_pdfAnnots[paperId]=[];
  _pdfAnnots[paperId].push({page:_pdfPage,text,created:new Date().toISOString()});
  safeStore('meridian_pdf_annots',_pdfAnnots);toast('Annotation saved','ok')}
function exportPdfAnnotations(paperId){
  const annots=_pdfAnnots[paperId];if(!annots?.length)return toast('No annotations','info');
  const p=S.lib.find(x=>x.id===paperId);
  dl(annots.map(a=>`[Page ${a.page}] ${a.text}`).join('\n'),((p?.title||'paper').slice(0,30))+'_annotations.txt','text/plain')}
function cycleReadingStatus(id){
  const states=['unread','skimming','read','reviewed'];
  const current=_readingStatus[id]||'unread';
  const next=states[(states.indexOf(current)+1)%states.length];
  _readingStatus[id]=next;
  safeStore('meridian_reading_status',_readingStatus);
  renderLib()}

// ═══ 7. COLLABORATION & SHARING ═══
function exportCollectionJSON(colId){
  const col=S.cols[colId];if(!col)return toast('Collection not found','err');
  const papers=S.lib.filter(p=>col.paperIds.includes(p.id)).map(p=>({title:p.title,authors:p.authors,year:p.year,journal:p.journal,doi:p.doi,cited:p.cited,isOA:p.isOA,abstract:p.abstract,concepts:p.concepts,tags:p.tags,notes:p.notes,findings:p.findings,src:p.src}));
  const bundle={collection:col.name,exported:new Date().toISOString(),papers};
  dl(JSON.stringify(bundle,null,2),col.name.replace(/\s+/g,'_')+'_collection.json','application/json');
  toast('Collection exported: '+papers.length+' papers','ok')}
function importCollectionJSON(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=async e=>{const file=e.target.files[0];if(!file)return;
    try{const data=JSON.parse(await file.text());
      if(!data.papers?.length)return toast('No papers in file','err');
      const colName=data.collection||file.name.replace('.json','');
      const colId='col'+Date.now();S.cols[colId]={id:colId,name:colName,paperIds:[]};
      for(const p of data.papers){const pp={...p,id:'m'+Date.now()+Math.random(),savedAt:new Date().toISOString(),tags:p.tags||[]};
        await dbPut(pp);S.cols[colId].paperIds.push(pp.id)}
      await saveCol(S.cols[colId]);await loadLib();renderLib();
      toast('Imported: '+data.papers.length+' papers into "'+colName+'"','ok');
    }catch(err){toast('Import failed: '+err.message,'err')}};
  input.click()}
function shareCollectionURL(colId){
  const col=S.cols[colId];if(!col)return;
  const papers=S.lib.filter(p=>col.paperIds.includes(p.id)).map(p=>({t:p.title,a:p.authors?.slice(0,2),y:p.year,j:p.journal,d:p.doi}));
  try{const compressed=btoa(JSON.stringify({n:col.name,p:papers}));
    const url='data:application/json;base64,'+compressed;
    navigator.clipboard.writeText(url);toast('Collection data copied to clipboard (paste to share)','ok');
  }catch{toast('Collection too large for URL sharing — use JSON export instead','info')}}
function addComment(paperId){
  const text=prompt('Add comment:');if(!text)return;
  const p=S.lib.find(x=>x.id===paperId);if(!p)return;
  if(!p._comments)p._comments=[];
  p._comments.push({text,author:'You',date:new Date().toISOString()});
  dbPut(p);renderLib();toast('Comment added','ok')}

// ═══ 8. DATA LINEAGE TO WORKSHOP ═══
const MARINE_PARAMS=[
  'L_inf','K','t0','M','F','Lm50','Lm95','a_LW','b_LW','Wmax','Lmax','tmax',
  'CPUE','SSB','Fmsy','Bmsy',
  'abundance','biomass','density','recruitment','survival_rate','mortality_rate',
  'population_size','growth_rate','fecundity','generation_time',
  'coral_cover','bleaching_prevalence','calcification_rate','rugosity',
  'symbiont_density','skeletal_density','linear_extension',
  'cell_density','biovolume','primary_production','Chl_a','POC','DOC',
  'species_richness','Shannon_H','Simpson_D','evenness',
  'home_range','dive_depth','dive_duration','migration_distance',
  'calving_interval','body_condition','blubber_thickness',
  'SST','salinity','pH','dissolved_O2','turbidity','PAR','MLD'
];
let _paramTable=safeParse('meridian_params',[]);
function compileWithLineage(){
  const sq=$('#lib-search-input')?.value?.toLowerCase()||'';
  const fl=sq?S.lib.filter(p=>{const hay=[p.title||'',p.abstract||'',(p.authors||[]).join(' '),(p.concepts||[]).join(' '),(p.tags||[]).join(' ')].join(' ').toLowerCase();return sq.split(/\s+/).every(w=>hay.includes(w))}):S.lib;
  if(!fl.length)return;
  S.wsC=['Title','Authors','Year','Journal','Citations','OA','Concepts','Tags','Notes','Location','Method','Finding','DOI','PaperID'];
  S.wsD=fl.map(p=>({
    Title:p.title,Authors:(p.authors||[]).join('; '),Year:p.year,Journal:p.journal,
    Citations:p.cited,OA:p.isOA?'Y':'N',Concepts:(p.concepts||[]).join('; '),
    Tags:(p.tags||[]).join('; '),Notes:p.notes||'',
    Location:p.findings?.location||'',Method:p.findings?.method||'',Finding:p.findings?.finding||'',
    DOI:p.doi||'',PaperID:p.id
  }));
  autoTypes();initWS();goTab('workshop');toast('Compiled with lineage — PaperID links to source','ok')}
function renderParamTable(){
  const el=$('#paramTableContent');if(!el)return;
  const species=[...new Set(_paramTable.map(r=>r.species))].sort();
  el.innerHTML=`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap"><button class="bt sm bt-pri" onclick="addParam()">+ Add Parameter</button><button class="bt sm" onclick="paramToWorkshop()">→ Workshop</button><button class="bt sm" onclick="exportParamCSV()">Export CSV</button></div>`+
    (species.length?species.map(sp=>`<div class="sec" style="margin-bottom:10px"><div class="sh"><h4 style="font-style:italic">${escHTML(sp)}</h4></div><div class="sb"><table class="param-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Source Paper</th><th>Year</th><th></th></tr></thead><tbody>${_paramTable.filter(r=>r.species===sp).map((r,i)=>{const gi=_paramTable.indexOf(r);return`<tr><td>${escHTML(r.param)}</td><td>${r.value}</td><td>${escHTML(r.unit||'')}</td><td style="font-size:11px">${escHTML((r.paperTitle||'').slice(0,40))}</td><td>${r.year||''}</td><td><button class="bt sm" style="color:var(--co);font-size:10px" onclick="_paramTable.splice(${gi},1);safeStore('meridian_params',_paramTable);renderParamTable()">×</button></td></tr>`}).join('')}</tbody></table></div></div>`).join(''):'<p style="color:var(--tm);font-size:12px">No parameters. Click "+ Add Parameter" to enter species-specific data from your papers.</p>')}
function addParam(){
  const species=prompt('Taxon (e.g. Tursiops truncatus, Acropora millepora):');if(!species)return;
  const param=prompt('Parameter:\n'+MARINE_PARAMS.join(', '));if(!param)return;
  const value=prompt('Value:');if(!value)return;
  const unit=prompt('Unit (optional):');
  const paperTitle=prompt('Source paper title (optional):');
  const year=prompt('Year (optional):');
  _paramTable.push({species,param,value:parseFloat(value)||value,unit:unit||'',paperTitle:paperTitle||'',year:parseInt(year)||null,added:new Date().toISOString()});
  safeStore('meridian_params',_paramTable);renderParamTable();toast('Parameter added','ok')}
function paramToWorkshop(){
  if(!_paramTable.length)return toast('No parameters','err');
  S.wsC=['Species','Parameter','Value','Unit','Source','Year'];
  S.wsD=_paramTable.map(r=>({Species:r.species,Parameter:r.param,Value:r.value,Unit:r.unit,Source:r.paperTitle,Year:r.year}));
  autoTypes();initWS();goTab('workshop')}
function exportParamCSV(){
  if(!_paramTable.length)return toast('No parameters','err');
  dl(['Species,Parameter,Value,Unit,Source,Year',..._paramTable.map(r=>[`"${r.species}"`,`"${r.param}"`,r.value,`"${r.unit||''}"`,`"${(r.paperTitle||'').replace(/"/g,"'")}"`,r.year||''].join(','))].join('\n'),'parameters.csv','text/csv')}

// ═══ 9. GREY LITERATURE & REGIONAL SOURCES ═══
async function searchFAO(q,silent){
  if(!silent)toast('Searching FAO & UNEP...','info');
  try{const r=await fetchT('https://api.openalex.org/works?search='+encodeURIComponent(q+' FAO OR UNEP OR IOC-UNESCO')+'&per_page=15&filter=institutions.country_code:!null&mailto=r@meridian.app',15000);
    if(!r.ok)throw new Error('FAO search failed');
    const d=await r.json();return(d.results||[]).map(w=>({id:w.id,title:w.title,authors:(w.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean),year:w.publication_year,journal:w.primary_location?.source?.display_name||'Grey Literature',doi:w.doi,cited:w.cited_by_count||0,isOA:w.open_access?.is_oa||false,abstract:recAbs(w.abstract_inverted_index),concepts:(w.concepts||[]).slice(0,6).map(c=>c.display_name),url:w.doi||w.id,src:'OA'}))}
  catch{return[]}}
async function searchTheses(q,silent){
  if(!silent)toast('Searching theses/dissertations...','info');
  try{const r=await fetchT('https://api.openalex.org/works?search='+encodeURIComponent(q)+'&per_page=15&filter=type:dissertation&mailto=r@meridian.app',15000);
    if(!r.ok)throw new Error('Thesis search failed');
    const d=await r.json();return(d.results||[]).map(w=>({id:w.id,title:w.title,authors:(w.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean),year:w.publication_year,journal:'Thesis/Dissertation',doi:w.doi,cited:w.cited_by_count||0,isOA:w.open_access?.is_oa||false,abstract:recAbs(w.abstract_inverted_index),concepts:(w.concepts||[]).slice(0,6).map(c=>c.display_name),url:w.doi||w.id,src:'OA'}))}
  catch{return[]}}
async function searchICES(q,silent){
  if(!silent)toast('Searching marine agencies...','info');
  try{const r=await fetchT('https://api.openalex.org/works?search='+encodeURIComponent(q+' ICES OR IUCN OR NOAA OR CSIRO')+'&per_page=15&mailto=r@meridian.app',15000);
    if(!r.ok)return[];const d=await r.json();
    return(d.results||[]).map(w=>({id:w.id,title:w.title,authors:(w.authorships||[]).slice(0,5).map(a=>a.author?.display_name).filter(Boolean),year:w.publication_year,journal:w.primary_location?.source?.display_name||'Grey Literature',doi:w.doi,cited:w.cited_by_count||0,isOA:w.open_access?.is_oa||false,abstract:recAbs(w.abstract_inverted_index),concepts:[],url:w.doi||w.id,src:'OA'}))}catch{return[]}}
async function greyLitSearch(){
  const q=$('#lq').value.trim();if(!q)return toast('Enter a search query','err');
  toast('Searching grey literature sources...','info');
  const[fao,theses,ices]=await Promise.allSettled([searchFAO(q),searchTheses(q),searchICES(q)]);
  const all=[...(fao.value||[]),...(theses.value||[]),...(ices.value||[])];
  // Deduplicate
  const seen=new Set();const dd=all.filter(r=>{const k=r.title?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,50);if(!k||seen.has(k))return false;seen.add(k);return true});
  S.litR=dd;_litAllResults=dd;_litPage=0;
  H('#lstat',`<span style="color:var(--ac);font-weight:700">${dd.length}</span> grey literature results · FAO:${(fao.value||[]).length} Theses:${(theses.value||[]).length} Agencies:${(ices.value||[]).length}`);sh('#lstat');
  if(dd.length){sh('#compileBtn');sh('#saveAllBtn')}
  renderLitPage();toast(dd.length+' grey literature results','ok')}
let _preprintTracker=safeParse('meridian_preprints',[]);
function trackPreprint(paperId){
  const p=S.lib.find(x=>x.id===paperId);if(!p)return;
  if(!p.doi)return toast('Paper needs a DOI to track','err');
  _preprintTracker.push({doi:p.doi,title:p.title,added:new Date().toISOString(),published:false});
  safeStore('meridian_preprints',_preprintTracker);toast('Tracking preprint publication status','ok')}
async function checkPreprints(){
  let updated=0;
  for(const pp of _preprintTracker){
    if(pp.published)continue;
    try{const r=await fetchT('https://api.crossref.org/works/'+encodeURIComponent(pp.doi.replace('https://doi.org/',''))+'?mailto=r@meridian.app',8000);
      if(r.ok){const d=await r.json();if(d.message?.type==='journal-article'){pp.published=true;pp.publishedDate=new Date().toISOString();updated++}}
    }catch{}await new Promise(r=>setTimeout(r,200))}
  safeStore('meridian_preprints',_preprintTracker);
  toast(updated?updated+' preprints now published!':'No new publications detected','ok')}

// ═══ ENHANCED LIBRARY RENDERING (add new buttons) ═══
const _origRenderLib=renderLib;
renderLib=function(){
  _origRenderLib();
  // Inject new buttons after existing ones
  const libContent=$('#lib-content');if(!libContent)return;
  // Add advanced buttons row
  const existingBtnRow=$('#lib-action-row');
  if(existingBtnRow&&!$('#lib-enhanced-btns')){
    // Add new buttons
    const newBtns=document.createElement('div');
    newBtns.id='lib-enhanced-btns';
    newBtns.style.cssText='display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;font-size:12px;align-items:center';
    newBtns.innerHTML=`<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Advanced:</span>
      <button class="bt sm" style="color:var(--sg);border-color:var(--sb)" onclick="openScreening()">Screen Papers</button>
      <button class="bt sm" style="color:var(--ac);border-color:var(--ab)" onclick="openCitePanel()">Cite All</button>
      <button class="bt sm" onclick="exportBibTeX()">BibTeX</button>
      <button class="bt sm" onclick="exportRIS()">RIS</button>
      <button class="bt sm" onclick="importBibFile()">Import .bib</button>
      <button class="bt sm" onclick="importRISFile()">Import .ris</button>
      <button class="bt sm" onclick="importCollectionJSON()">Import Collection</button>
      <button class="bt sm" onclick="compileWithLineage()">Compile + Lineage</button>
      <button class="bt sm" onclick="extractAllMetadata()">Extract Metadata</button>`;
    existingBtnRow.after(newBtns);
    // Add param table and alerts sections
    const paramSection=document.createElement('div');
    paramSection.innerHTML=`<div class="sec" style="margin-top:14px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Citation Metrics</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none" id="metricsContent"></div></div>
    <div class="sec" style="margin-top:10px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Species Parameter Table</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none" id="paramTableContent"></div></div>
    <div class="sec" style="margin-top:10px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Saved Search Alerts</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none"><div id="alertsList"></div></div></div>
    <div class="sec" style="margin-top:10px"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Author Tracking (ORCID)</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none"><div style="margin-bottom:8px"><button class="bt sm bt-pri" onclick="trackOrcid()">+ Track Author</button></div><div id="orcidList"></div></div></div>`;
    existingBtnRow.parentNode.appendChild(paramSection);
    setTimeout(()=>{renderParamTable();renderAlerts();renderOrcidPanel();renderMetricsSection()},50)}
  // Enhance library cards with new features
  libContent.querySelectorAll('.lib-card').forEach((card,i)=>{
    if(card.dataset.enhanced)return;card.dataset.enhanced='1';
    const pid=card.dataset.paperId;
    const p=pid?S.lib.find(x=>x.id===pid):null;if(!p)return;
    const status=_readingStatus[p.id]||'unread';
    const btnDiv=card.querySelector('.lib-card-actions');
    if(btnDiv){
      // Add reading status badge
      const statusBadge=document.createElement('span');
      statusBadge.className='read-status '+status;
      statusBadge.textContent=status;
      statusBadge.onclick=()=>cycleReadingStatus(p.id);
      statusBadge.title='Click to cycle: unread → skimming → read → reviewed';
      btnDiv.prepend(statusBadge);
      // Add more actions
      const extraBtns=document.createElement('div');
      extraBtns.style.cssText='display:flex;gap:3px;flex-wrap:wrap;margin-top:3px';
      const _mkBtn=(txt,title,fn)=>{const b=document.createElement('button');b.className='bt sm';b.style.fontSize='10px';b.textContent=txt;b.title=title;b.setAttribute('aria-label',title);b.onclick=e=>{e.stopPropagation();fn()};return b};
      extraBtns.appendChild(_mkBtn('≈','Find similar',()=>moreLikeThis(p.id)));
      extraBtns.appendChild(_mkBtn('Cite','Format citation in any style',()=>openCitePanel(p.id)));
      extraBtns.appendChild(_mkBtn('Bib','Copy BibTeX',()=>copyPaperBibTeX(p.id)));
      extraBtns.appendChild(_mkBtn('PDF↑','Upload PDF for text extraction',()=>uploadPdfForPaper(p.id)));
      if(p.pdfUrl)extraBtns.appendChild(_mkBtn('📄','Open PDF viewer',()=>openPdfViewer(p.pdfUrl,p.id)));
      if(p.fullText)extraBtns.appendChild(_mkBtn('FT','Has full text ('+p.fullText.length+' chars)',()=>toast('Full text available: '+p.fullText.length+' chars','info')));
      if(Object.keys(S.cols).length)extraBtns.appendChild(_mkBtn('Share','Export collection',()=>exportCollectionJSON(Object.keys(S.cols)[0])));
      btnDiv.appendChild(extraBtns)}
    // Show extracted metadata
    if(p._species?.length||p._regions?.length||p._methods?.length){
      const metaDiv=document.createElement('div');
      metaDiv.style.cssText='margin-top:3px;font-size:12px;font-family:var(--mf)';
      metaDiv.innerHTML=`${p._species?.length?'<span style="color:var(--ac)">🐟 '+escHTML(p._species.join(', '))+'</span> ':''}${p._regions?.length?'<span style="color:var(--sg)">📍 '+escHTML(p._regions.join(', '))+'</span> ':''}${p._methods?.length?'<span style="color:var(--lv)">🔬 '+escHTML(p._methods.slice(0,3).join(', '))+'</span>':''}`;
      const titleDiv=card.querySelector('.lib-card-title');
      if(titleDiv)titleDiv.parentNode.insertBefore(metaDiv,titleDiv.nextSibling?.nextSibling?.nextSibling||null)}
  })}

// ═══ CITATION METRICS ═══
function calculateHIndex(papers){
  const cited=papers.map(p=>p.cited||0).sort((a,b)=>b-a);
  let h=0;for(let i=0;i<cited.length;i++){if(cited[i]>=i+1)h=i+1;else break}return h}
let _journalMetricsCache={};
async function fetchJournalMetrics(journal){
  if(_journalMetricsCache[journal])return _journalMetricsCache[journal];
  try{const r=await fetchT('https://api.openalex.org/sources?search='+encodeURIComponent(journal)+'&per_page=1&mailto=r@meridian.app',8000);
    if(!r.ok)return null;const d=await r.json();const src=(d.results||[])[0];if(!src)return null;
    const m={name:src.display_name,worksCount:src.works_count,citedBy:src.cited_by_count,hIndex:src.summary_stats?.h_index||null};
    _journalMetricsCache[journal]=m;return m}catch{return null}}
function renderCitationMetrics(){
  if(S.lib.length<2)return;
  const hIndex=calculateHIndex(S.lib);
  // Author leaderboard
  const authors={};S.lib.forEach(p=>(p.authors||[]).forEach(a=>{if(!authors[a])authors[a]={papers:[],totalCited:0};authors[a].papers.push(p);authors[a].totalCited+=(p.cited||0)}));
  const topAuthors=Object.entries(authors).sort((a,b)=>b[1].papers.length-a[1].papers.length).slice(0,15).map(([name,d])=>({name,count:d.papers.length,hIndex:calculateHIndex(d.papers),totalCited:d.totalCited}));
  // Journal ranking
  const journals={};S.lib.forEach(p=>{if(p.journal){if(!journals[p.journal])journals[p.journal]={count:0,totalCited:0};journals[p.journal].count++;journals[p.journal].totalCited+=(p.cited||0)}});
  const topJournals=Object.entries(journals).sort((a,b)=>b[1].count-a[1].count).slice(0,15).map(([name,d])=>({name,count:d.count,meanCited:d.count?(d.totalCited/d.count).toFixed(1):0}));
  return{hIndex,topAuthors,topJournals}}
function renderMetricsSection(){
  const el=$('#metricsContent');if(!el)return;
  const m=renderCitationMetrics();if(!m)return el.innerHTML='<p style="color:var(--tm);font-size:12px">Need at least 2 papers.</p>';
  el.innerHTML=`<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap"><div class="ec"><div class="el">Library h-index</div><div class="ev">${m.hIndex}</div></div><div class="ec"><div class="el">Total Papers</div><div class="ev">${S.lib.length}</div></div><div class="ec"><div class="el">Total Citations</div><div class="ev">${S.lib.reduce((s,p)=>s+(p.cited||0),0).toLocaleString()}</div></div></div>
  <div style="display:flex;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:250px"><h4 style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Top Authors</h4><table class="dt"><thead><tr><th>Author</th><th>Papers</th><th>h-idx</th><th>Cited</th></tr></thead><tbody>${m.topAuthors.map(a=>`<tr><td>${escHTML(a.name)}</td><td>${a.count}</td><td style="color:var(--ac)">${a.hIndex}</td><td>${a.totalCited}</td></tr>`).join('')}</tbody></table></div>
  <div style="flex:1;min-width:250px"><h4 style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Top Journals</h4><table class="dt"><thead><tr><th>Journal</th><th>Papers</th><th>Mean Cited</th></tr></thead><tbody>${m.topJournals.map(j=>`<tr><td>${escHTML(j.name)}</td><td>${j.count}</td><td style="color:var(--ac)">${j.meanCited}</td></tr>`).join('')}</tbody></table></div></div>`}

// ═══ KEYWORD CO-OCCURRENCE NETWORK ═══
function buildKeywordNetwork(){
  if(S.lib.length<3)return toast('Need at least 3 papers in library','err');
  extractAllMetadata();
  // Collect concepts/keywords from all papers
  const kwFreq={};
  S.lib.forEach(p=>{const kws=new Set([...(p.concepts||[]),...(p._species||[]),...(p._methods||[])]);
    kws.forEach(k=>{kwFreq[k]=(kwFreq[k]||0)+1})});
  // Filter to keywords appearing 2+ times
  const keywords=Object.entries(kwFreq).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).slice(0,50);
  if(keywords.length<3)return toast('Not enough recurring keywords — need papers with concepts/abstracts','err');
  const kwNames=keywords.map(k=>k[0]);
  // Build co-occurrence matrix
  const cooc={};
  S.lib.forEach(p=>{const kws=[...(p.concepts||[]),...(p._species||[]),...(p._methods||[])].filter(k=>kwNames.includes(k));
    for(let i=0;i<kws.length;i++)for(let j=i+1;j<kws.length;j++){const key=[kws[i],kws[j]].sort().join('|||');cooc[key]=(cooc[key]||0)+1}});
  // Build D3 graph data
  const nodes=keywords.map(([name,count])=>({id:name,count}));
  const links=Object.entries(cooc).filter(([,v])=>v>=1).map(([key,value])=>{const[s,t]=key.split('|||');return{source:s,target:t,value}});
  if(!links.length)return toast('No co-occurring keywords found','err');
  H('#gapContent',`<div class="sec"><div class="sh"><h4>Keyword Co-occurrence Network (${nodes.length} keywords, ${links.length} links)</h4></div><div class="sb"><div style="display:flex;gap:6px;margin-bottom:8px;align-items:center"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Min co-occurrence:</span><input type="range" id="kwThreshold" min="1" max="5" value="1" style="width:120px;accent-color:var(--ac)" oninput="filterKwNetwork(this.value)"/><span id="kwThreshVal" style="font-size:11px;color:var(--ac);font-family:var(--mf)">1</span></div><svg id="kwNetworkSvg" width="100%" height="500" style="background:var(--bi);border:1px solid var(--bd);border-radius:var(--rd)"></svg><div style="margin-top:8px"><button class="bt sm" onclick="exportKwMatrix()">Export Adjacency CSV</button></div></div></div>`);
  window._kwNodes=nodes;window._kwLinks=links;window._kwCooc=cooc;window._kwNames=kwNames;
  renderKwNetwork(nodes,links)}
function renderKwNetwork(nodes,links){
  const svg=d3.select('#kwNetworkSvg');svg.selectAll('*').remove();
  const w=svg.node().getBoundingClientRect().width||800,h=500;
  svg.attr('viewBox',`0 0 ${w} ${h}`);
  const maxCount=Math.max(...nodes.map(n=>n.count));
  const sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(80)).force('charge',d3.forceManyBody().strength(-200)).force('center',d3.forceCenter(w/2,h/2)).force('collision',d3.forceCollide().radius(d=>Math.sqrt(d.count/maxCount)*20+10));
  const link=svg.append('g').selectAll('line').data(links).join('line').attr('stroke','var(--bd)').attr('stroke-width',d=>Math.min(d.value*1.5,6)).attr('stroke-opacity',.5);
  const node=svg.append('g').selectAll('g').data(nodes).join('g').call(d3.drag().on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y}).on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y}).on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));
  node.append('circle').attr('r',d=>Math.sqrt(d.count/maxCount)*15+5).attr('fill','var(--ac)').attr('fill-opacity',.7).attr('stroke','var(--ab)').attr('stroke-width',1).style('cursor','pointer').on('click',(e,d)=>{goTab('library');setTimeout(()=>{const inp=$('#lib-search-input');if(inp){inp.value=d.id;_dRenderLib()}},100)});
  node.append('text').text(d=>d.id.length>20?d.id.slice(0,18)+'…':d.id).attr('dx',d=>Math.sqrt(d.count/maxCount)*15+8).attr('dy',4).attr('fill','var(--ts)').attr('font-size','10px').attr('font-family','var(--mf)');
  sim.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform',d=>`translate(${d.x},${d.y})`)})}
function filterKwNetwork(threshold){
  $('#kwThreshVal').textContent=threshold;
  const fl=window._kwLinks.filter(l=>l.value>=parseInt(threshold));
  const nodeIds=new Set();fl.forEach(l=>{nodeIds.add(l.source.id||l.source);nodeIds.add(l.target.id||l.target)});
  const nodes=window._kwNodes.filter(n=>nodeIds.has(n.id));
  const links=fl.map(l=>({source:l.source.id||l.source,target:l.target.id||l.target,value:l.value}));
  renderKwNetwork(nodes,links)}
function exportKwMatrix(){
  if(!window._kwNames)return;const names=window._kwNames;const cooc=window._kwCooc;
  const rows=[','+names.join(','),...names.map(n1=>n1+','+names.map(n2=>{const k=[n1,n2].sort().join('|||');return cooc[k]||0}).join(','))];
  dl(rows.join('\n'),'keyword_cooccurrence.csv','text/csv');toast('Adjacency matrix exported','ok')}

// ═══ ENHANCED LITERATURE TAB (add query builder, grey lit, alerts) ═══
function enhanceLitTab(){
  const litTab=$('#tab-lit');if(!litTab||litTab.dataset.enhanced)return;litTab.dataset.enhanced='1';
  // Add query builder panel (hidden, opened via Filters dropdown)
  const qbDiv=document.createElement('div');
  qbDiv.id='qbPanel';qbDiv.style.cssText='display:none;margin-bottom:12px;padding:12px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)';
  const searchRow=$('#litSearchRow');
  if(searchRow)searchRow.after(qbDiv);
  // Add Grey Lit button to filter row (before Filters dropdown)
  const filterRow=$('#litFilterRow');
  if(filterRow){
    const greyBtn=document.createElement('button');greyBtn.className='bt sm';greyBtn.textContent='Grey Lit';
    greyBtn.onclick=greyLitSearch;greyBtn.style.cssText='color:var(--wa);border-color:rgba(212,160,74,.2)';
    const filtersBtn=$('#litFiltersBtn');
    if(filtersBtn)filterRow.insertBefore(greyBtn,filtersBtn)}
  // Add search log section — collapsed by default with summary line
  const logSection=document.createElement('div');logSection.id='litLogSection';
  logSection.innerHTML=`<div class="sec" style="margin-top:14px"><div class="sh" onclick="const sb=this.nextElementSibling;const open=sb.style.display!=='none';sb.style.display=open?'none':'block';this.querySelector('.sh-chevron').style.transform=open?'rotate(-90deg)':'';if(!open&&typeof renderSearchLog==='function')renderSearchLog()"><h4>Search Audit Log · ${_searchAudit.length} searches</h4><span class="sh-chevron" style="margin-left:auto;display:inline-flex;transform:rotate(-90deg);transition:transform .25s"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--tm)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"/></svg></span></div><div class="sb" style="display:none" id="searchLogContent"></div></div>`;
  litTab.appendChild(logSection)}
setTimeout(enhanceLitTab,100);

// ═══ UPDATE TAB NAVIGATION ═══
// (goTab extensions consolidated into single patch below at breadcrumb section)
// Update keyboard shortcuts for new tabs
const tabsList=['lit','species','env','library','publications','archive','fielddata','workshop','graph','gaps','ecostats','studydesign','ai'];

// Keyboard hint
const kbHint=document.createElement('div');kbHint.className='kbd-hint';kbHint.innerHTML='Ctrl+1-8 tabs · Ctrl+B sidebar · Ctrl+Enter search · Ctrl+Z undo · Ctrl+Shift+E errors';document.body.appendChild(kbHint);

// ═══ PHASE 3a: ONBOARDING OVERLAY ═══
function showOnboarding(){
  const features=[
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--ac)" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>',title:'Literature',desc:'Search OpenAlex, Semantic Scholar, CrossRef & PubMed simultaneously. PRISMA-compliant screening workflow.'},
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--sg)" fill="none" stroke-width="1.5" stroke-linecap="round"><path d="M2 8c2-3 5-5 8-4 2.5.6 4 2.5 4.5 4-.5 1.5-2 3.4-4.5 4-3 1-6-1-8-4z"/><circle cx="12" cy="8" r="1" fill="var(--sg)" stroke="none"/></svg>',title:'Species',desc:'Taxonomy from WoRMS, occurrences from GBIF & OBIS, biology from FishBase. Mapped and exportable.'},
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--lv)" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/></svg>',title:'Environmental Data',desc:'30+ NOAA ERDDAP variables — SST, chlorophyll, currents, nutrients. Time series from 1955 to present.'},
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--wa)" fill="none" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="10" width="3" height="4" rx="0.5"/><rect x="5.5" y="6" width="3" height="8" rx="0.5"/><rect x="10" y="2" width="3" height="12" rx="0.5"/></svg>',title:'Analysis',desc:'10+ chart types, statistical tests, growth models, diversity indices. Export to R, Python, or CSV.'},
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--co)" fill="none" stroke-width="1.5" stroke-linecap="round"><path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-1z"/></svg>',title:'AI Assistant',desc:'Claude, GPT, or Gemini as your research buddy — with tool use for search, species lookup, and analysis.'},
    {icon:'<svg viewBox="0 0 16 16" width="28" height="28" stroke="var(--ac)" fill="none" stroke-width="1.5" stroke-linecap="round"><path d="M2 13V3h12v10H2z"/><path d="M5 7h6M5 9.5h4"/></svg>',title:'Privacy First',desc:'Everything runs in your browser. No accounts, no tracking, no server. Your data stays on your device.'}
  ];
  const ov=document.createElement('div');
  ov.id='onboard-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:10003;background:rgba(6,5,14,.92);display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px';
  ov.innerHTML=`<div style="background:linear-gradient(160deg,var(--bs),var(--be));border:1px solid var(--ab);border-radius:16px;padding:36px 32px;max-width:620px;width:100%;animation:fadeIn .4s;position:relative">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:38px;font-weight:700;background:linear-gradient(135deg,var(--ac),#D4A04A,#E8C49B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:var(--sf);margin-bottom:6px">Meridian</div>
      <div style="font-size:14px;color:var(--ts);line-height:1.6;max-width:440px;margin:0 auto">A free research platform for marine & fisheries science.<br>Search literature, explore species, analyze environmental data — all in one place.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:24px">
      ${features.map(f=>`<div style="background:var(--bi);border:1px solid var(--bd);border-radius:10px;padding:14px 12px;text-align:center">
        <div style="margin-bottom:6px">${f.icon}</div>
        <div style="font-size:13px;font-weight:600;color:var(--ac);font-family:var(--mf);margin-bottom:4px">${f.title}</div>
        <div style="font-size:12px;color:var(--tm);line-height:1.5">${f.desc}</div>
      </div>`).join('')}
    </div>
    <div style="background:var(--bi);border:1px solid var(--bd);border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);letter-spacing:1px;margin-bottom:8px">Optional — AI API Key</div>
      <div style="font-size:12px;color:var(--ts);margin-bottom:10px;line-height:1.5">Bring your own key to enable the AI research assistant. You can also set this later in the AI tab.</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="fs" id="splash-aip" style="min-width:130px"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google</option></select>
        <input type="password" class="si" id="splash-aki" placeholder="sk-ant-..." style="font-size:12px;flex:1;padding:9px 12px">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap">
      <button class="bt bt-pri" style="padding:12px 32px;font-size:14px" onclick="_splashEnter()">Get Started</button>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:11px;color:var(--tm)">
      <a href="#" onclick="event.preventDefault();showPrivacyPolicy()" style="color:var(--tm);text-decoration:underline">Privacy Policy</a>
      <span style="margin:0 6px">·</span>
      <a href="#" onclick="event.preventDefault();showTerms()" style="color:var(--tm);text-decoration:underline">Terms of Service</a>
    </div>
  </div>`;
  // Sync splash provider select
  const splashAip=ov.querySelector('#splash-aip');
  splashAip.addEventListener('change',()=>{
    const p=splashAip.value;
    const ph=AI_PROVIDERS[p]?.placeholder||'API key';
    ov.querySelector('#splash-aki').placeholder=ph;
  });
  window._splashEnter=function(){
    const key=ov.querySelector('#splash-aki').value.trim();
    const prov=splashAip.value;
    if(key){
      S.apiK=key;S.aiProvider=prov;S.aiModel=AI_PROVIDERS[prov]?.defaultModel||'';
      _keyVault.store('meridian_key_'+prov,key);safeStore('meridian_provider',prov);
      const mainAki=$('#aki');if(mainAki)mainAki.value=key;
      _syncAllProviderDropdowns();_updateKeyPromptVisibility();
    }
    ov.remove();
    safeStore('meridian_onboarded','1');
    document.removeEventListener('keydown',_splashEsc);
  };
  function _splashEsc(e){if(e.key==='Escape')_splashEnter()}
  document.addEventListener('keydown',_splashEsc);
  document.body.appendChild(ov);
}
if(!localStorage.getItem('meridian_onboarded'))setTimeout(showOnboarding,800);
// Load shared analysis state from URL if present
setTimeout(loadSharedState,500);

// ═══ PRIVACY POLICY & TERMS ═══
function _showLegalModal(title,body){
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;z-index:10004;background:rgba(6,5,14,.88);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML=`<div style="background:var(--bs);border:1px solid var(--ab);border-radius:14px;padding:28px 30px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;animation:fadeIn .3s;position:relative">
    <button style="position:absolute;top:12px;right:16px;background:0;border:0;color:var(--tm);font-size:22px;cursor:pointer" onclick="this.closest('div[style]').parentElement.remove()">×</button>
    <h2 style="font-size:20px;color:var(--ac);margin-bottom:16px;font-family:var(--sf)">${title}</h2>
    <div style="font-size:13px;color:var(--ts);line-height:1.75;font-family:var(--sf)">${body}</div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  document.body.appendChild(m);
}
function showPrivacyPolicy(){
  _showLegalModal('Privacy Policy',`
    <p><b>Last updated:</b> March 2026</p>
    <p style="margin-top:12px"><b>Meridian Engine</b> is a client-side research tool. Here is how your data is handled:</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Data Storage</h3>
    <p>All your research data — saved papers, collections, chat history, screening decisions, and settings — is stored <b>locally in your browser</b> using IndexedDB and localStorage. Nothing is sent to or stored on our servers.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Third-Party APIs</h3>
    <p>When you use Meridian's features, your search queries and coordinates are sent to these public academic APIs:</p>
    <ul style="margin:8px 0 8px 20px">
      <li><b>Literature:</b> OpenAlex, Semantic Scholar, CrossRef, PubMed (NCBI)</li>
      <li><b>Species:</b> WoRMS, GBIF, OBIS, FishBase, BOLD Systems</li>
      <li><b>Environmental:</b> NOAA ERDDAP, Open-Meteo, NOAA Mauna Loa</li>
      <li><b>Maps:</b> OpenStreetMap tiles, Nominatim geocoding</li>
    </ul>
    <p>Each of these services has its own privacy policy. Meridian sends only the minimum data required (search terms, coordinates, DOIs).</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">AI API Keys</h3>
    <p>If you provide an API key for Claude, GPT, or Gemini, it is stored in your browser's localStorage and sent <b>directly</b> to the respective provider (Anthropic, OpenAI, or Google). Your key never passes through our servers.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Analytics</h3>
    <p>We use privacy-respecting, cookie-free analytics (Cloudflare Web Analytics) to understand aggregate usage. No personal data is collected, and no tracking cookies are set.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Contact</h3>
    <p>Questions? Email <b>privacy@meridian-engine.com</b></p>
  `);
}
function showTerms(){
  _showLegalModal('Terms of Service',`
    <p><b>Last updated:</b> March 2026</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Acceptance</h3>
    <p>By using Meridian Engine ("the Service"), you agree to these terms. If you do not agree, do not use the Service.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">What Meridian Does</h3>
    <p>Meridian is a browser-based research tool that aggregates data from public academic APIs and provides analysis tools. It is provided for research and educational purposes.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">No Warranty</h3>
    <p>The Service is provided "as is" without warranty of any kind. We do not guarantee the accuracy, completeness, or availability of data from third-party APIs. Research conclusions should be independently verified.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Your Data</h3>
    <p>You retain full ownership of any data you enter or generate in Meridian. Since data is stored locally in your browser, <b>you are responsible for backups</b>. Clearing browser data will delete your saved papers and settings.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">API Keys</h3>
    <p>You are responsible for any API keys you enter. Meridian sends these keys directly to the provider you select. We are not responsible for charges incurred from AI API usage.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Acceptable Use</h3>
    <p>Do not use Meridian to: violate any laws, abuse third-party APIs beyond their rate limits, or misrepresent AI-generated content as human-authored research.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Changes</h3>
    <p>We may update these terms as the service evolves. Continued use after changes constitutes acceptance.</p>
    <h3 style="color:var(--ac);font-size:14px;margin:16px 0 6px">Contact</h3>
    <p>Questions? Email <b>legal@meridian-engine.com</b></p>
  `);
}

// Help button is now inline in the header HTML (no JS append needed)

// ═══ PHASE 3b: RICH EMPTY STATES ═══
function emptyState(icon,title,desc,actions){
  return`<div style="text-align:center;padding:40px 20px;color:var(--tm)">
    <div style="font-size:32px;margin-bottom:10px;opacity:.5">${icon}</div>
    <div style="font-size:15px;font-weight:600;color:var(--ts);margin-bottom:6px">${title}</div>
    <p style="font-size:13px;line-height:1.6;max-width:400px;margin:0 auto 14px">${desc}</p>
    ${actions?`<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${actions}</div>`:''}
  </div>`;
}
// Literature empty state
H('#lemp',emptyState(
  '<svg width="36" height="36" viewBox="0 0 16 16" style="stroke:var(--ac);fill:none;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round"><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>',
  'Search Academic Databases',
  'Query OpenAlex, Semantic Scholar, CrossRef & PubMed simultaneously. Try a search to get started:',
  ['coral bleaching Great Barrier Reef','otolith microchemistry sparidae','marine protected area effectiveness','fish stock assessment Mediterranean']
    .map(q=>`<button class="bt sm" onclick="$('#lq').value='${q}';$('#lsb').click()" style="text-align:left">${q}</button>`).join('')
));
// Workshop empty state
(function(){const wc=$('#wcon');if(wc&&!wc.innerHTML.trim()){
  H('#wcon',emptyState(
    '<svg width="36" height="36" viewBox="0 0 16 16" style="stroke:var(--ac);fill:none;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round"><rect x="1" y="10" width="3" height="4" rx="0.5"/><rect x="5.5" y="6" width="3" height="8" rx="0.5"/><rect x="10" y="2" width="3" height="12" rx="0.5"/></svg>',
    'Data Workshop',
    'Compile paper metadata from your Library, or paste CSV data directly. Supports 10 chart types with Plotly.',
    `<button class="bt bt-pri" onclick="goTab('library')">Go to Library</button><button class="bt sm" onclick="goTab('lit')">Search Papers First</button>`
  ))}})();
// Graph empty state
(function(){const gs=$('#citGraphSvg');if(gs&&!gs.innerHTML.trim()){
  const wrap=$('#citGraphWrap');if(wrap){wrap.insertAdjacentHTML('afterbegin',emptyState(
    '<svg width="36" height="36" viewBox="0 0 16 16" style="stroke:var(--ac);fill:none;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="8" cy="13" r="2"/><line x1="5.5" y1="5.5" x2="7" y2="11.5"/><line x1="10.5" y1="5.5" x2="9" y2="11.5"/><line x1="6" y1="4" x2="10" y2="4"/></svg>',
    'Citation Network',
    'Save papers to your Library first, then select a seed paper to explore its citation network.',
    `<button class="bt bt-pri" onclick="goTab('library')">Go to Library</button>`
  ))}}})();
// Gaps empty state
(function(){const gc=$('#gapContent');if(gc&&!gc.innerHTML.trim()){
  H('#gapContent',emptyState(
    '<svg width="36" height="36" viewBox="0 0 16 16" style="stroke:var(--ac);fill:none;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round"><path d="M3 2h4l1.5 2L10 2h3v4l-2 1.5L13 9v4h-4l-1-2-1 2H3V9l2-1.5L3 6z"/></svg>',
    'Research Gap Analysis',
    'Need 5+ papers in your Library to build meaningful evidence maps. Save papers from Literature search, then click "Build Evidence Map".',
    `<button class="bt bt-pri" onclick="goTab('lit')">Search Papers</button><button class="bt sm" onclick="buildGapMap()">Discover Gaps</button>`
  ))}})();

// ═══ PHASE 3c: WORKFLOW BREADCRUMB ═══
const bcStrip=document.createElement('div');
bcStrip.id='workflow-bc';
bcStrip.style.cssText='display:none;padding:6px 30px;background:var(--bi);border-bottom:1px solid var(--bd);font-family:var(--mf);font-size:11px;color:var(--tm)';
bcStrip.innerHTML=['lit','library','workshop'].map((id,i)=>{
  const labels={lit:'Search',library:'Library',workshop:'Analysis'};
  return `<span class="bc-step" data-bc="${id}" style="cursor:pointer;padding:2px 8px;border-radius:3px;transition:all .2s" onclick="goTab('${id}')">${labels[id]}</span>${i<2?'<span style="margin:0 4px;opacity:.4">→</span>':''}`;
}).join('');
const _hdrEl=document.querySelector('.hdr');if(_hdrEl)_hdrEl.after(bcStrip);
// Consolidated goTab extension — single patch for graph seed, library panels, and breadcrumb
const _origGoTabBase=goTab;
goTab=function(id){_origGoTabBase(id);
  if(id==='graph'&&typeof populateGraphSeed==='function')populateGraphSeed();
  if(id==='library')setTimeout(()=>{if(typeof renderParamTable==='function')renderParamTable();if(typeof renderAlerts==='function')renderAlerts();if(typeof renderOrcidPanel==='function')renderOrcidPanel()},100);
  const bcTabs=['lit','library','workshop'];
  const bc=$('#workflow-bc');
  if(bc){
    bc.style.display=bcTabs.includes(id)?'':'none';
    $$('.bc-step').forEach(s=>{
      const isActive=s.dataset.bc===id;
      s.style.color=isActive?'var(--ac)':'var(--tm)';
      s.style.background=isActive?'var(--am)':'transparent';
      s.style.fontWeight=isActive?'600':'400';
    });
  }
};
// Initialize breadcrumb — hidden on home (default landing)
(function(){const bc=$('#workflow-bc');if(bc){bc.style.display='none'}})();

// ═══ PHASE 5a: SEARCH HISTORY INDICATOR ═══
(function(){
  const row=$('#litSearchRow');if(!row)return;
  const wrap=row.querySelector('.si-wrap');if(!wrap)return;
  const badge=document.createElement('span');
  badge.id='search-hist-badge';
  badge.style.cssText='position:absolute;right:34px;top:50%;transform:translateY(-50%);font-size:11px;font-family:var(--mf);color:var(--tm);cursor:pointer;display:none;opacity:.6;transition:opacity .2s;z-index:1';
  badge.onmouseenter=()=>badge.style.opacity='1';
  badge.onmouseleave=()=>badge.style.opacity='.6';
  badge.onclick=()=>{const lq=$('#lq');if(lq){lq.focus();showSearchHist()}};
  wrap.appendChild(badge);
  // Update badge on search
  const _origSaveHist=window.saveSearchHist;
  window.saveSearchHist=function(q){_origSaveHist(q);updateHistBadge()};
  function updateHistBadge(){
    const n=_searchHist.length;
    badge.style.display=n?'':'none';
    badge.innerHTML='<svg width="12" height="12" viewBox="0 0 16 16" style="stroke:currentColor;fill:none;stroke-width:1.5;vertical-align:middle;margin-right:2px"><circle cx="8" cy="8" r="6"/><polyline points="8,4 8,8 11,10"/></svg>'+n;
  }
  updateHistBadge();
})();

// ═══ PHASE 5b: AI TAB PREVIEW ═══
(function(){
  const aks=$('#aks');if(!aks||S.apiK)return;
  const preview=document.createElement('div');
  preview.id='ai-preview';
  preview.style.cssText='margin-top:12px;padding:16px 20px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd)';
  const caps=AGENT_TOOLS.map(t=>`<div style="font-size:12px;color:var(--ts);padding:3px 0">• ${t.description.split('.')[0]}</div>`).join('');
  const samples=AGENT_PROMPTS.slice(0,3).map(p=>`<button class="bt sm" style="text-align:left;font-size:12px" onclick="$('#ci').value=this.textContent">${p}</button>`).join('');
  preview.innerHTML=`<div style="font-size:13px;font-weight:600;color:var(--ac);margin-bottom:8px">Research Buddy can:</div>${caps}<div style="margin-top:10px;font-size:12px;color:var(--tm);margin-bottom:6px">Try these prompts:</div><div style="display:flex;flex-direction:column;gap:4px">${samples}</div>`;
  aks.after(preview);
  // Remove preview when key is saved
  const origAkb=$('#akb');if(origAkb){origAkb.addEventListener('click',()=>{if($('#aki')?.value?.trim()){const p=$('#ai-preview');if(p)p.remove()}})}
})();

// ═══ PHASE 6a: INPUT WIDTH CLASSES ═══
// (applied via CSS, classes available for future use)

// ═══ PHASE 6b: TOGGLE BUTTON ENHANCEMENT ═══
// .bt.tog.on already exists via .bt.on — add left accent for toggle buttons
(function(){const style=document.createElement('style');
style.textContent=`.bt.tog.on{border-left:3px solid var(--ac)}.page-nav{position:sticky;bottom:0;background:var(--bg);z-index:5;padding:14px 0;border-top:1px solid var(--bd)}.fi-xs{width:60px}.fi-sm{width:85px}.fi-md{width:125px}.fi-lg{width:200px}`;
document.head.appendChild(style)})();

// ═══ PHASE 6d: UNDO FOR PAPER DELETION (stack-based) ═══
function _removeTombstone(id){
  const key='meridian_deleted_ids';
  try{const ts=JSON.parse(localStorage.getItem(key)||'[]');const idx=ts.indexOf(id);if(idx>=0){ts.splice(idx,1);localStorage.setItem(key,JSON.stringify(ts))}}catch(e){}
}
let _undoStack=[],_undoTimer=null;
function undoDelete(){
  if(!_undoStack.length)return;
  const paper=_undoStack.pop();
  _removeTombstone(paper.id);
  dbPut(paper).then(loadLib).then(renderLib).then(()=>toast('Paper restored'+(paper.title?' — '+paper.title.slice(0,40):''),'ok')).catch(()=>toast('Failed to restore paper','err'));
  _refreshUndoBar();
}
function _refreshUndoBar(){
  const existing=$('.undo-bar');if(existing)existing.remove();
  if(_undoTimer)clearTimeout(_undoTimer);
  if(!_undoStack.length)return;
  const bar=document.createElement('div');
  bar.className='undo-bar';
  bar.innerHTML=`${_undoStack.length} paper${_undoStack.length>1?'s':''} deleted. <button class="bt sm" id="undoBtn">Undo</button>${_undoStack.length>1?` <button class="bt sm" id="undoAllBtn">Undo All</button>`:''}`;
  document.body.appendChild(bar);
  $('#undoBtn')?.addEventListener('click',undoDelete);
  $('#undoAllBtn')?.addEventListener('click',undoDeleteAll);
  _undoTimer=setTimeout(()=>{_undoStack=[];const b=$('.undo-bar');if(b)b.remove()},8000);
}
function undoDeleteAll(){
  if(!_undoStack.length)return;
  const count=_undoStack.length;
  _undoStack.forEach(p=>_removeTombstone(p.id));
  Promise.all(_undoStack.map(p=>dbPut(p))).then(()=>{_undoStack=[];return loadLib()}).then(renderLib).then(()=>toast(count+' papers restored','ok')).catch(()=>toast('Failed to restore papers','err'));
  _refreshUndoBar();
}
// Patch dbDel calls in library card rendering
const _origDbDel=window.dbDel;
window.dbDelWithUndo=function(id){
  const paper=S.lib.find(p=>p.id===id);
  if(!paper)return _origDbDel(id);
  _undoStack.push(JSON.parse(JSON.stringify(paper)));
  _refreshUndoBar();
  if(typeof PADI!=='undefined'&&PADI.onPaperRemoved)PADI.onPaperRemoved(id);
  return _origDbDel(id);
};

// ═══ TASK 5: OCCURRENCE QA/QC ═══
const _LAND_BOXES=[
  {minLat:25,maxLat:72,minLon:-130,maxLon:-60,name:'North America'},
  {minLat:-35,maxLat:12,minLon:-82,maxLon:-34,name:'South America'},
  {minLat:35,maxLat:72,minLon:-10,maxLon:40,name:'Europe'},
  {minLat:-35,maxLat:37,minLon:-20,maxLon:55,name:'Africa'},
  {minLat:10,maxLat:55,minLon:60,maxLon:140,name:'Asia'},
  {minLat:-40,maxLat:-10,minLon:110,maxLon:155,name:'Australia'}
];
function assessOccurrenceQuality(records){
  const flags={
    ZERO_COORDS:r=>r.decimalLatitude===0&&r.decimalLongitude===0,
    HIGH_UNCERTAINTY:r=>(r.coordinateUncertaintyInMeters||0)>10000,
    ON_LAND:r=>{
      const lat=r.decimalLatitude,lon=r.decimalLongitude;
      if(lat==null||lon==null)return false;
      if(r.basisOfRecord==='PRESERVED_SPECIMEN')return false;
      const unc=r.coordinateUncertaintyInMeters;
      if(unc!=null&&unc>=5000)return false;
      return _LAND_BOXES.some(b=>lat>=b.minLat&&lat<=b.maxLat&&lon>=b.minLon&&lon<=b.maxLon);
    },
    NO_DATE:r=>!r.eventDate&&!r.year&&!r.date_year,
    OLD_RECORD:r=>(r.year||r.date_year)&&(r.year||r.date_year)<1950,
    BASIS_LITERATURE:r=>r.basisOfRecord==='LITERATURE',
    LOW_TAXONOMIC_PRECISION:r=>!r.species&&!r.infraspecificEpithet&&!r.scientificName?.includes(' '),
    GBIF_QUALITY_FLAG:r=>r.issues&&r.issues.length>0
  };
  return records.map(r=>{
    const qcFlags=Object.entries(flags).filter(([,test])=>{try{return test(r)}catch{return false}}).map(([name])=>name);
    return{...r,_qcFlags:qcFlags,_qcScore:qcFlags.length===0?2:qcFlags.length<=2?1:0};
  });
}

let _qcAssessed=null;
let _qcFilter='all'; // 'all','green_amber','green'

function renderQCPanel(records){
  if(!records||!records.length)return'';
  _qcAssessed=assessOccurrenceQuality(records);
  const green=_qcAssessed.filter(r=>r._qcScore===2).length;
  const amber=_qcAssessed.filter(r=>r._qcScore===1).length;
  const red=_qcAssessed.filter(r=>r._qcScore===0).length;
  const flagCounts={};
  _qcAssessed.forEach(r=>r._qcFlags.forEach(f=>{flagCounts[f]=(flagCounts[f]||0)+1}));
  return`<div style="margin:12px 0;padding:12px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <div style="font-size:12px;font-family:var(--mf);color:var(--tm);margin-bottom:8px">
      <b>QA/QC:</b> ${records.length} records total &nbsp;
      <span style="color:#7B9E87">●${green} clean</span> &nbsp;
      <span style="color:#D4A04A">●${amber} minor issues</span> &nbsp;
      <span style="color:#C27878">●${red} major issues</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="bt sm ${_qcFilter==='all'?'on':''}" onclick="_qcSetFilter('all')">Show all</button>
      <button class="bt sm ${_qcFilter==='green_amber'?'on':''}" onclick="_qcSetFilter('green_amber')">Clean + minor only</button>
      <button class="bt sm ${_qcFilter==='green'?'on':''}" onclick="_qcSetFilter('green')">Clean only</button>
      <button class="bt sm" onclick="_qcColorMap()" style="margin-left:auto;color:var(--ac);border-color:var(--ab)">Color map by QC</button>
    </div>
    <div id="qc-filter-info" style="font-size:10px;color:var(--ts);font-family:var(--mf);margin-bottom:6px">${_qcFilterInfo()}</div>
    <details style="font-size:11px;color:var(--ts);font-family:var(--mf)">
      <summary style="cursor:pointer;color:var(--tm)">Flag details</summary>
      <div style="margin-top:6px;line-height:1.8">
        ${Object.entries(flagCounts).map(([f,n])=>`<div><b>${f}</b>: ${n} records — ${_qcFlagDesc(f)}</div>`).join('')}
      </div>
    </details>
  </div>`;
}

function _qcFilterInfo(){
  if(!_qcAssessed)return'';
  const filtered=_qcGetFiltered();
  return`Showing ${filtered.length}/${_qcAssessed.length} records (filter: ${_qcFilter==='all'?'all':_qcFilter==='green_amber'?'score ≥ 1':'score = 2'})`;
}

function _qcGetFiltered(){
  if(!_qcAssessed)return[];
  if(_qcFilter==='green')return _qcAssessed.filter(r=>r._qcScore===2);
  if(_qcFilter==='green_amber')return _qcAssessed.filter(r=>r._qcScore>=1);
  return _qcAssessed;
}

function _qcSetFilter(mode){
  _qcFilter=mode;
  // Re-render QC panel
  const d=window._sp;if(!d)return;
  const allOcc=[...(d.gbifOcc||[]),...(d.obisOcc||[])];
  if(!allOcc.length)return;
  const sres=$('#sres');if(!sres)return;
  const existing=sres.querySelector('.qc-panel');if(existing)existing.remove();
  const div=document.createElement('div');div.className='qc-panel';div.innerHTML=renderQCPanel(allOcc);
  const firstCard=sres.querySelector('.sp-card');
  if(firstCard)firstCard.parentNode.insertBefore(div,firstCard.nextSibling);
  // Update stored filtered occurrences for downstream use
  window._qcFilteredOcc=_qcGetFiltered();
}

function _qcColorMap(){
  if(!_qcAssessed||!window._envMap)return toast('No map or QC data available','err');
  // Remove existing QC layer
  if(window._qcMapLayer){window._envMap.removeLayer(window._qcMapLayer);window._qcMapLayer=null}
  const filtered=_qcGetFiltered();
  if(!filtered.length)return toast('No records to display','info');
  const qcColors={2:'#7B9E87',1:'#D4A04A',0:'#C27878'};
  const markers=filtered.filter(r=>r.decimalLatitude!=null&&r.decimalLongitude!=null).map(r=>
    L.circleMarker([r.decimalLatitude,r.decimalLongitude],{
      radius:4,fillColor:qcColors[r._qcScore]||'#999',color:qcColors[r._qcScore]||'#999',
      weight:1,fillOpacity:0.7,opacity:0.9
    }).bindPopup(`<b>${r.species||r.scientificName||'Unknown'}</b><br>QC: ${r._qcScore===2?'Clean':r._qcScore===1?'Minor issues':'Major issues'}<br>Flags: ${r._qcFlags.join(', ')||'none'}`,{maxWidth:250})
  );
  if(!markers.length)return toast('No geolocated records','info');
  window._qcMapLayer=L.layerGroup(markers).addTo(window._envMap);
  window._envMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
  goTab('env');
  toast(markers.length+' occurrences colored by QC score on map','ok');
}

function _qcFlagDesc(flag){
  const descs={ZERO_COORDS:'Coordinates at 0°N 0°E (likely error)',HIGH_UNCERTAINTY:'Coordinate uncertainty >10 km',ON_LAND:'Point falls within major continental bounding box',NO_DATE:'Missing collection/event date',OLD_RECORD:'Record from before 1950',BASIS_LITERATURE:'Record sourced from literature (not direct observation)',LOW_TAXONOMIC_PRECISION:'Missing species-level identification',GBIF_QUALITY_FLAG:'GBIF flagged quality issue'};
  return descs[flag]||flag;
}

// Hook into species render to inject QA/QC
(function(){
  const origRender=window.renderSpeciesResult;
  if(typeof origRender==='function'){
    window.renderSpeciesResult=function(){
      origRender.apply(this,arguments);
      setTimeout(()=>{
        const d=window._sp;if(!d)return;
        const allOcc=[...(d.gbifOcc||[]),...(d.obisOcc||[])];
        if(!allOcc.length)return;
        const qcHtml=renderQCPanel(allOcc);
        const sres=$('#sres');
        if(sres){
          const existing=sres.querySelector('.qc-panel');if(existing)existing.remove();
          const div=document.createElement('div');div.className='qc-panel';div.innerHTML=qcHtml;
          const firstCard=sres.querySelector('.sp-card');
          if(firstCard)firstCard.parentNode.insertBefore(div,firstCard.nextSibling);
          else sres.insertAdjacentHTML('afterbegin',qcHtml);
        }
      },500);
    };
  }
})();

// ═══════════════════════════════════════════════════════════════
// PHASE 3 — Quick Actions, Data Interpreter, Bookmarks, Ask AI
// ═══════════════════════════════════════════════════════════════

// ── Quick Actions Chip System ──
const _QUICK_ACTIONS=[
  // Literature
  {id:'summarize_paper',label:'Summarize this paper',icon:'📄',tabs:['lit','library'],
    build(){const p=_getSelectedPaper();return p?`Summarize this paper: "${p.title}". Abstract: ${(p.abstract||'No abstract available').slice(0,600)}`:'Summarize this paper: [select or paste a paper title]'}},
  {id:'compare_papers',label:'Compare these papers',icon:'⚖️',tabs:['library'],
    build(){const sel=_getSelectedPapers(3);return sel.length>=2?`Compare these papers:\n${sel.map((p,i)=>`${i+1}. "${p.title}" (${p.year||'n.d.'}) — ${(p.abstract||'').slice(0,200)}`).join('\n')}`:'Compare these papers: [select 2-3 papers in Library using batch mode]'}},
  {id:'find_related',label:'Find related papers',icon:'🔗',tabs:['lit','library'],
    build(){const p=_getSelectedPaper();return p?`Find related papers to: "${p.title}". Key concepts: ${(p.concepts||[]).slice(0,5).join(', ')||'unknown'}. Suggest search queries I should try.`:'Find papers related to: [select a paper first]'}},
  {id:'extract_findings',label:'Extract key findings',icon:'🔬',tabs:['lit','library'],
    build(){const p=_getSelectedPaper();return p?`Extract the key findings from: "${p.title}". Abstract: ${(p.abstract||'').slice(0,600)}`:'Extract key findings from: [select a paper first]'}},
  // Data Analysis
  {id:'analyse_data',label:'Analyse this data',icon:'📊',tabs:['workshop','env','fielddata','ecostats'],
    build(){if(S.wsD.length)return`Analyse my workshop data: ${S.wsD.length} rows, columns: ${S.wsC.join(', ')}. Column types: ${S.wsC.map(c=>c+':'+S.wsCT[c]).join(', ')}. What patterns, relationships, or issues do you see?`;const ek=Object.keys(S.envR);if(ek.length)return`Analyse my environmental data at (${$('#elat')?.value}, ${$('#elon')?.value}): ${ek.map(id=>S.envR[id].nm+': '+S.envR[id].value+' '+S.envR[id].u).join(', ')}`;return'Analyse this data: [load data in Workshop or fetch environmental data first]'}},
  {id:'suggest_viz',label:'Suggest visualizations',icon:'📈',tabs:['workshop','env','fielddata'],
    build(){if(S.wsD.length)return`I have a dataset with ${S.wsD.length} rows and columns: ${S.wsC.map(c=>c+' ('+S.wsCT[c]+')').join(', ')}. What visualizations would best reveal patterns in this data? Suggest specific chart types and which columns to use.`;return'Suggest visualizations for: [load data first]'}},
  {id:'identify_outliers',label:'Identify outliers',icon:'🎯',tabs:['workshop','fielddata'],
    build(){if(S.wsD.length)return`Scan my workshop data for outliers and anomalies. ${S.wsD.length} rows, numeric columns: ${S.wsC.filter(c=>S.wsCT[c]==='continuous').join(', ')}. Flag any suspicious values and explain why.`;return'Identify outliers in: [load data first]'}},
  {id:'explain_trend',label:'Explain this trend',icon:'📉',tabs:['env'],
    build(){const ek=Object.keys(S.envR);if(ek.length)return`Interpret these environmental data trends at (${$('#elat')?.value}, ${$('#elon')?.value}): ${ek.map(id=>S.envR[id].nm+': '+S.envR[id].value+' '+S.envR[id].u).join(', ')}. What do these values suggest? Are they typical? Any concerning patterns?`;return'Explain this trend: [fetch environmental data first]'}},
  // Writing
  {id:'draft_abstract',label:'Draft an abstract',icon:'✍️',tabs:['_always'],
    build(){return'Draft an abstract for my study. I will provide: research question, methods, key results, and conclusions. Ask me for each piece of information you need.'}},
  {id:'draft_methods',label:'Draft methods section',icon:'📝',tabs:['_always'],
    build(){if(S.wsD.length)return`Draft a methods section. My data has ${S.wsD.length} observations with variables: ${S.wsC.join(', ')}. Ask me about the study design, sampling protocol, and statistical approach.`;return'Draft a methods section for my study. Ask me about the study design, sampling protocol, statistical methods, and sample size.'}},
  {id:'draft_results',label:'Draft results paragraph',icon:'📋',tabs:['_always'],
    build(){return'Draft a results paragraph in academic prose. I will provide the statistical test results and key numbers. Ask me for the specific results to describe.'}},
  {id:'improve_text',label:'Improve this text',icon:'✨',tabs:['_always'],
    build(){return'Improve the following text for clarity and academic tone:\n\n[paste your text here]'}},
  {id:'gen_citation',label:'Generate citation',icon:'📚',tabs:['lit','library','_always'],
    build(){const p=_getSelectedPaper();return p?`Generate a citation in APA, MLA, Chicago, and BibTeX for: "${p.title}" by ${(p.authors||[]).join(', ')} (${p.year||'n.d.'}), ${p.journal||''}. DOI: ${p.doi||'none'}`:'Generate a citation for: [select a paper, or provide title, authors, year, journal]'}},
  // Research Design
  {id:'design_study',label:'Design my study',icon:'🧪',tabs:['_always'],
    build(){return'Help me design a marine research study. I\'ll describe my species, location, and research question. Guide me through choosing methods, sample size, and timeline.'}},
  {id:'what_stat_test',label:'What stat test?',icon:'🧮',tabs:['workshop','_always'],
    build(){if(S.wsD.length)return`What statistical test should I use? My data: ${S.wsD.length} rows, numeric columns: ${S.wsC.filter(c=>S.wsCT[c]==='continuous').join(', ')}, categorical: ${S.wsC.filter(c=>S.wsCT[c]==='categorical').join(', ')}. Ask me clarifying questions about my research question.`;return'What statistical test should I use for my data? Ask me clarifying questions about my data structure and research question.'}},
  {id:'identify_gaps',label:'Identify research gaps',icon:'🔍',tabs:['library','gaps','research'],
    build(){if(S.lib.length)return`Analyse my library of ${S.lib.length} papers and identify research gaps — under-studied species, regions, methods, or time periods. Use the find_gaps and analyse_keywords tools.`;return'Identify research gaps in: [add papers to your library first]'}},
  // Species (shown on species tab)
  {id:'tell_species',label:'Tell me about this species',icon:'🐟',tabs:['species'],
    build(){try{const sp=JSON.parse(sessionStorage.getItem('meridian_sp')||'null');if(sp)return`Tell me about ${sp.sciName}: ecology, distribution, conservation status, and current research. Use lookup_species and get_conservation_status tools.`}catch{}return'Tell me about: [look up a species first]'}},
];

function _getSelectedPaper(){
  // Try batch selection first
  if(S.batchSelected?.size)for(const id of S.batchSelected){const p=S.lib.find(x=>x.id===id);if(p)return p}
  // Try most recent search result that's expanded (has visible .pd)
  const expanded=document.querySelector('.pc .pd[style*="display: block"], .pc .pd[style*="display:block"]');
  if(expanded){const card=expanded.closest('.pc');const idx=[...document.querySelectorAll('.pc')].indexOf(card);if(idx>=0&&S.litR?.[idx])return S.litR[idx]}
  // Fall back to first library paper or first search result
  if(S.lib.length)return S.lib[0];
  if(S.litR?.length)return S.litR[0];
  return null;
}
function _getSelectedPapers(max){
  if(S.batchSelected?.size){const sel=[];for(const id of S.batchSelected){const p=S.lib.find(x=>x.id===id);if(p)sel.push(p);if(sel.length>=max)break}return sel}
  return S.lib.slice(0,max);
}

function _getChipsForTab(){
  const tab=document.querySelector('.sb-item.active')?.dataset?.tab||'home';
  return _QUICK_ACTIONS.filter(a=>a.tabs.includes(tab)||a.tabs.includes('_always'));
}

function _renderChips(containerId){
  const el=$(containerId);if(!el)return;
  const chips=_getChipsForTab();
  if(!chips.length){el.innerHTML='';return}
  el.innerHTML=chips.map(a=>`<button class="qa-chip" onclick="_chipClick('${a.id}')" title="${escHTML(a.label)}">${a.icon} ${escHTML(a.label)}</button>`).join('');
}

function _chipClick(id){
  const action=_QUICK_ACTIONS.find(a=>a.id===id);if(!action)return;
  const text=action.build();
  // Populate whichever input is visible
  const fcPanel=$('#fc-panel');
  if(fcPanel&&fcPanel.style.display!=='none'){
    const inp=$('#fc-ci');if(inp){inp.value=text;inp.focus()}
  }else{
    const inp=$('#ci');if(inp){inp.value=text;inp.focus()}
  }
}

function _refreshAllChips(){_renderChips('#qa-chips');_renderChips('#fc-qa-chips');_renderCtxQuickActions()}
function _renderCtxQuickActions(){
  const el=$('#ctx-quick-actions');if(!el)return;
  const chips=_getChipsForTab();
  if(!chips.length){el.innerHTML='<div style="color:var(--tm)">Navigate to a tab to see relevant actions</div>';return}
  el.innerHTML=chips.map(a=>`<div class="ctx-qa-item" onclick="_chipClick('${a.id}')">${a.icon} <span>${escHTML(a.label)}</span></div>`).join('');
}
function _updateCtxProviderInfo(){
  const el=$('#ctx-provider-info');if(!el)return;
  const prov=AI_PROVIDERS[S.aiProvider];
  const model=prov?.displayModels?.[S.aiModel]||S.aiModel;
  el.innerHTML=`${prov?.name||S.aiProvider}<br>${model}`;
}
// Refresh chips on tab change — hook into goTab
const _origGoTab=window.goTab;
if(typeof _origGoTab==='function'){window.goTab=function(id,sub){_origGoTab(id,sub);setTimeout(_refreshAllChips,50)}}
// Initial render after DOM ready
setTimeout(()=>{_refreshAllChips();_updateCtxProviderInfo();_updateSessionTokenDisplay()},200);

// ── Data Interpreter ──
// Enhanced tool: get full env time series for AI interpretation
AGENT_TOOLS.push(
  {name:'get_env_timeseries',description:'Get environmental time series data (actual values) for AI interpretation. Returns timestamps + values, truncated to ~100 data points. Use when user says "analyse my SST data" or "interpret this time series".',input_schema:{type:'object',properties:{variable:{type:'string',description:'Variable ID: sst, chlor, sal, npp, sla, etc.'},lat:{type:'number'},lon:{type:'number'},start_date:{type:'string',description:'YYYY-MM-DD'},end_date:{type:'string',description:'YYYY-MM-DD'}},required:['variable','lat','lon']}},
  {name:'describe_dataset',description:'Get a full description of the current Workshop dataset including summary stats and sample rows for AI interpretation. Returns column names, types, stats, and first 10 rows. Use when user says "describe this dataset" or "what does my data look like".',input_schema:{type:'object',properties:{},required:[]}},
);
TOOL_LABELS['get_env_timeseries']='Fetching time series';
TOOL_LABELS['describe_dataset']='Describing dataset';

// Insert before the default case — we need to add to the switch.
// We'll do this by overriding executeAgentTool with a wrapper.
const _origExecuteAgentTool=executeAgentTool;
window.executeAgentTool=async function(name,input){
  if(name==='get_env_timeseries'){
    const vid=input.variable||'sst';const v=EV.find(e=>e.id===vid);
    if(!v||v.src!=='e')return{error:'Variable not found: '+vid};
    const lat=input.lat,lon=input.lon;
    const sd=input.start_date||'2020-01-01',ed=input.end_date||new Date().toISOString().split('T')[0];
    try{
      const lonVal=v.lon360&&lon<0?360+lon:lon;
      const url=`${v.server}/griddap/${v.ds}.json?${v.v}[(${sd}T00:00:00Z):1:(${ed}T00:00:00Z)]${v.dm===4?`[(${v.z||'0'})]`:''}[(${lat}):1:(${lat})][(${lonVal}):1:(${lonVal})]`;
      const r=await fetchT(url,30000);if(!r.ok)return{error:'Could not fetch data'};
      const d=await r.json();let rows=d.table?.rows||[];
      // Truncate to ~100 points
      if(rows.length>100){const step=Math.ceil(rows.length/100);rows=rows.filter((_,i)=>i%step===0)}
      const values=rows.map(r=>({time:r[0],value:r[r.length-1]})).filter(d=>d.value!=null&&!isNaN(d.value));
      const vals=values.map(d=>d.value);
      const mean=vals.reduce((a,v)=>a+v,0)/vals.length;
      const trend=vals.length>10?(vals[vals.length-1]-vals[0])/(vals.length-1):0;
      return{variable:v.nm,unit:v.u,location:{lat,lon},period:`${sd} to ${ed}`,data_points:values.length,original_points:d.table?.rows?.length||0,summary:{min:+Math.min(...vals).toFixed(3),max:+Math.max(...vals).toFixed(3),mean:+mean.toFixed(3),trend_per_step:+trend.toFixed(4)},values:values.slice(0,100),code_suggestion:{python:`import pandas as pd\ndf = pd.read_csv('your_data.csv')\ndf['${v.v}'].plot(title='${v.nm} Time Series')`,r:`library(ggplot2)\ndf <- read.csv('your_data.csv')\nggplot(df, aes(x=time, y=${v.v})) + geom_line() + ggtitle('${v.nm}')`}};
    }catch(e){return{error:e.message}}
  }
  if(name==='describe_dataset'){
    if(!S.wsD.length)return{message:'No dataset loaded in Workshop. Upload a CSV first.'};
    const stats={};
    S.wsC.forEach(col=>{
      if(S.wsCT[col]==='continuous'){
        const vals=S.wsD.map(r=>r[col]).filter(v=>typeof v==='number'&&!isNaN(v));
        if(vals.length){vals.sort((a,b)=>a-b);const n=vals.length,sum=vals.reduce((a,v)=>a+v,0),mean=sum/n;
          const med=n%2?vals[Math.floor(n/2)]:(vals[n/2-1]+vals[n/2])/2;
          const sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/n);
          const iqr=vals[Math.floor(n*.75)]-vals[Math.floor(n*.25)];
          stats[col]={n,min:+vals[0].toFixed(4),max:+vals[n-1].toFixed(4),mean:+mean.toFixed(4),median:+med.toFixed(4),sd:+sd.toFixed(4),iqr:+iqr.toFixed(4),missing:S.wsD.length-n}}
      }else{
        const counts={};let missing=0;S.wsD.forEach(r=>{const v=r[col];if(v==null||v==='')missing++;else counts[String(v)]=(counts[String(v)]||0)+1});
        const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
        stats[col]={type:'categorical',unique:Object.keys(counts).length,missing,top_values:top.map(([k,n])=>({value:k,count:n}))}
      }
    });
    return{rows:S.wsD.length,columns:S.wsC,types:S.wsCT,stats,sample_rows:S.wsD.slice(0,10),
      code_suggestion:{python:`import pandas as pd\ndf = pd.read_csv('your_data.csv')\ndf.describe()\ndf.info()`,r:`df <- read.csv('your_data.csv')\nsummary(df)\nstr(df)`}};
  }
  return _origExecuteAgentTool(name,input);
};

// ── Conversation Persistence (Supabase Bookmarks) ──
let _savedSessions=[];
let _currentSessionId=null;

async function _bookmarkChat(){
  if(!_supaUser){toast('Sign in to bookmark conversations','err');return}
  if(!S.chatM.length){toast('Nothing to bookmark','err');return}
  const title=(S.chatM.find(m=>m.role==='user'&&typeof m.content==='string')?.content||'Untitled').slice(0,80);
  const msgs=S.chatM.map(m=>{
    const o={role:m.role,content:typeof m.content==='string'?m.content:(Array.isArray(m.content)?JSON.stringify(m.content):'')};
    if(m._toolCalls)o._toolCalls=m._toolCalls;
    if(m._usage)o._usage=m._usage;
    return o;
  });
  try{
    if(_currentSessionId){
      // Update existing
      const{error}=await SB.from('chat_sessions').update({messages:msgs,provider:S.aiProvider,model:S.aiModel,updated_at:new Date().toISOString()}).eq('id',_currentSessionId);
      if(error)throw error;
      toast('Conversation updated','ok');
    }else{
      // Check cap
      const{count}=await SB.from('chat_sessions').select('id',{count:'exact',head:true}).eq('user_id',_supaUser.id).eq('bookmarked',true);
      if(count>=100){toast('Limit reached (100 saved conversations). Delete some first.','err');return}
      if(count>=90)toast(`You have ${count}/100 saved conversations`,'info');
      const{data,error}=await SB.from('chat_sessions').insert({user_id:_supaUser.id,title,provider:S.aiProvider,model:S.aiModel,messages:msgs,bookmarked:true}).select().single();
      if(error)throw error;
      _currentSessionId=data.id;
      toast('Conversation bookmarked','ok');
    }
    _loadSavedSessions();
  }catch(e){toast('Bookmark failed: '+e.message,'err')}
}

async function _loadSavedSessions(){
  if(!_supaUser)return;
  try{
    const{data,error}=await SB.from('chat_sessions').select('id,title,provider,model,messages,created_at,updated_at').eq('user_id',_supaUser.id).eq('bookmarked',true).order('updated_at',{ascending:false}).limit(100);
    if(error)throw error;
    _savedSessions=data||[];
    _renderSavedSessions();
  }catch(e){console.warn('Load sessions:',e)}
}

function _renderSavedSessions(){
  const el=$('#saved-sessions-list');if(!el)return;
  if(!_savedSessions.length){el.innerHTML='<div style="color:var(--tm);font-size:11px;padding:8px 0">No saved conversations yet. Click the bookmark icon to save one.</div>';return}
  el.innerHTML=_savedSessions.map(s=>{
    const msgCount=Array.isArray(s.messages)?s.messages.filter(m=>m.role==='user'||m.role==='assistant').length:0;
    const date=new Date(s.updated_at||s.created_at).toLocaleDateString();
    const prov=(AI_PROVIDERS[s.provider]?.name||s.provider||'').split('(')[0].trim();
    const active=s.id===_currentSessionId?'style="background:var(--am);border-color:var(--ab)"':'';
    return`<div class="saved-session" ${active} onclick="_loadSession('${s.id}')">
      <div class="ss-title">${escHTML(s.title.slice(0,50))}</div>
      <div class="ss-meta">${prov} · ${msgCount} msgs · ${date}</div>
      <div class="ss-actions"><button class="ss-btn" onclick="event.stopPropagation();_renameSession('${s.id}')" title="Rename">✏️</button><button class="ss-btn" onclick="event.stopPropagation();_deleteSession('${s.id}')" title="Delete">🗑</button></div>
    </div>`;
  }).join('');
}

async function _loadSession(id){
  const s=_savedSessions.find(s=>s.id===id);if(!s)return;
  S.chatM=(s.messages||[]).map(m=>{
    const msg={role:m.role,content:m.content};
    if(m._toolCalls)msg._toolCalls=m._toolCalls;
    if(m._usage)msg._usage=m._usage;
    // Restore stringified arrays
    if(typeof msg.content==='string'&&msg.content.startsWith('['))try{msg.content=JSON.parse(msg.content)}catch{}
    return msg;
  });
  _currentSessionId=id;
  if(s.provider&&s.model){
    _onProviderChange(s.provider+':'+s.model);
  }
  rCh();
  _renderSavedSessions();
  toast('Loaded: '+s.title.slice(0,40),'ok');
}

async function _renameSession(id){
  const s=_savedSessions.find(s=>s.id===id);if(!s)return;
  const name=prompt('Rename conversation:',s.title);
  if(!name||name===s.title)return;
  try{
    const{error}=await SB.from('chat_sessions').update({title:name}).eq('id',id);
    if(error)throw error;
    s.title=name;_renderSavedSessions();
  }catch(e){toast('Rename failed','err')}
}

async function _deleteSession(id){
  if(!confirm('Delete this saved conversation?'))return;
  try{
    const{error}=await SB.from('chat_sessions').delete().eq('id',id);
    if(error)throw error;
    _savedSessions=_savedSessions.filter(s=>s.id!==id);
    if(_currentSessionId===id)_currentSessionId=null;
    _renderSavedSessions();
    toast('Conversation deleted','ok');
  }catch(e){toast('Delete failed','err')}
}

function _newChat(){
  S.chatM=[];_currentSessionId=null;S.chatL=false;rCh();_renderSavedSessions();_refreshAllChips();
}

// Load saved sessions when user signs in
const _origUpdateUISignedIn=window.updateUISignedIn;
if(typeof _origUpdateUISignedIn==='function'){
  window.updateUISignedIn=function(user){_origUpdateUISignedIn(user);setTimeout(_loadSavedSessions,500)};
}

// ── "Ask AI About This" Helper ──
function _askAI(text){
  // Open floating chat and populate
  const panel=$('#fc-panel');
  if(panel&&panel.style.display==='none')_fcOpenPanel();
  else if(!panel)return;
  setTimeout(()=>{
    const inp=$('#fc-ci');
    if(inp){inp.value=text;inp.focus()}
  },100);
}
// Global so card renderers can call it
window._askAI=_askAI;

// ── Citation Linking ──
function _linkCitations(html){
  // Build a map of known paper titles from library + search results
  const papers=[...S.lib];
  if(S.litR?.length)papers.push(...S.litR);
  if(!papers.length)return html;
  // Sort by title length descending (match longer titles first to avoid partial matches)
  const known=papers.filter(p=>p.title&&p.title.length>15).sort((a,b)=>(b.title||'').length-(a.title||'').length);
  // For performance, only check first 50
  for(const p of known.slice(0,50)){
    const safe=escHTML(p.title).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Only match if the title appears as a complete phrase (not inside HTML tags)
    const re=new RegExp(`(?<![">])("?)(${safe})("?)(?![<])`,'i');
    if(re.test(html)){
      const doi=p.doi||'';const id=p.id||'';
      html=html.replace(re,`$1<a class="cite-link" href="#" onclick="event.preventDefault();_citationNav('${escJSAttr(id)}','${escJSAttr(doi)}')" title="View in Library">${'$2'}</a>$3`);
    }
  }
  return html;
}

function _citationNav(id,doi){
  // Try to find and highlight in library
  const inLib=S.lib.find(p=>p.id===id);
  if(inLib){
    goTab('library');
    setTimeout(()=>{
      const card=document.querySelector(`.lib-card[data-paper-id="${CSS.escape(id)}"]`);
      if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.style.outline='2px solid var(--ac)';card.style.outlineOffset='2px';setTimeout(()=>{card.style.outline='';card.style.outlineOffset=''},3000)}
    },200);
    return;
  }
  // Try search results
  const inLit=S.litR?.findIndex(p=>p.id===id);
  if(inLit>=0){
    goTab('lit');
    setTimeout(()=>{
      const cards=document.querySelectorAll('.pc');
      // Account for pagination
      const pageIdx=inLit%20;
      if(cards[pageIdx]){cards[pageIdx].scrollIntoView({behavior:'smooth',block:'center'});cards[pageIdx].style.outline='2px solid var(--ac)';cards[pageIdx].style.outlineOffset='2px';setTimeout(()=>{cards[pageIdx].style.outline='';cards[pageIdx].style.outlineOffset=''},3000)}
    },200);
  }
}

// ── Session token tracking ──
let _sessionTokens={input:0,output:0,cost:0};
function _trackSessionTokens(usage){
  if(!usage)return;
  _sessionTokens.input+=(usage.input||0);
  _sessionTokens.output+=(usage.output||0);
  _sessionTokens.cost+=(usage.cost||0);
  _updateSessionTokenDisplay();
}
function _updateSessionTokenDisplay(){
  const el=$('#ctx-session-tokens');if(!el)return;
  if(!_sessionTokens.input&&!_sessionTokens.output){el.innerHTML='No tokens used yet';return}
  el.innerHTML=`In: ${_sessionTokens.input.toLocaleString()} · Out: ${_sessionTokens.output.toLocaleString()}<br>Est. cost: ${_fmtCost(_sessionTokens.cost)}`;
}

/* ── 2F: Citations / Graph Tab Enhancement ── */
let _graphTabEnhanced=false;
function _enhanceGraphTab(){
if(_graphTabEnhanced)return;_graphTabEnhanced=true;
const tab=$('#tab-graph');if(!tab)return;
/* Score weights: convert <details> to collapsible .sec */
const sw=$('#bm-score-weights');
if(sw){
  const sec=document.createElement('div');sec.className='sec collapsed';sec.id='bm-score-weights-sec';sec.style.cssText=sw.style.cssText;
  const sh=document.createElement('div');sh.className='sh';sh.innerHTML='<h4>Score Weights</h4><span class="sh-chevron"><svg viewBox="0 0 10 6" width="10" height="6"><polyline points="1,1 5,5 9,1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>';
  const sb=document.createElement('div');sb.className='sb';
  /* move children from details into sb */
  const sliders=$('#bm-weight-sliders');if(sliders)sb.appendChild(sliders);
  const hint=sw.querySelector('div[style*="margin-top:6px"]');if(hint)sb.appendChild(hint);
  sec.appendChild(sh);sec.appendChild(sb);
  sw.replaceWith(sec);
  sh.addEventListener('click',()=>{sec.classList.toggle('collapsed')});
}
/* Controls sections: wrap in card borders */
['graph-cit-controls','graph-coauth-controls'].forEach(id=>{
  const el=$('#'+id);if(!el)return;
  el.style.padding='10px 12px';el.style.borderRadius='var(--rd)';el.style.background='var(--bs)';el.style.border='1px solid var(--bd)';
});
/* Expansion row: card style */
const expRow=$('#bm-expansion-row');
if(expRow){expRow.style.padding='10px 12px';expRow.style.borderRadius='var(--rd)';expRow.style.background='var(--bs)';expRow.style.border='1px solid var(--bd)'}
/* Graph SVG: min-height 400px */
const svg=$('#citGraphSvg');if(svg){svg.setAttribute('height','500');svg.style.minHeight='400px'}
const wrap=$('#citGraphWrap');if(wrap)wrap.style.minHeight='400px';
/* Rec panel: min-height */
const rec=$('#bm-rec-panel');if(rec)rec.style.minHeight='400px';
/* Standardise selects and inputs */
tab.querySelectorAll('select.fs,select.fi').forEach(s=>{s.style.height='40px';s.style.borderRadius='8px';s.style.fontSize='14px'});
tab.querySelectorAll('input.fi,input.si').forEach(i=>{i.style.height='40px';i.style.borderRadius='8px';i.style.fontSize='14px'});
}
/* Hook into goTab */
const _origGoTabGraph=window.goTab;
if(typeof _origGoTabGraph==='function'){window.goTab=function(id,sub){_origGoTabGraph(id,sub);if(id==='graph')setTimeout(_enhanceGraphTab,50)}}
