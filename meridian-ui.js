// ═══ MERIDIAN UI — Interface Components Module ═══
// Theme, glossary, workflows, onboarding, modals

// ═══ THEME TOGGLE ═══
function toggleTheme(){
  const html=document.documentElement;
  const isLight=html.classList.toggle('light');
  localStorage.setItem('meridian_theme',isLight?'light':'dark');
  _updatePL();
  $('#themeToggle').innerHTML=isLight?'&#9788;':'&#9789;';
  // Update Plotly chart backgrounds if any exist
  document.querySelectorAll('.js-plotly-plot').forEach(el=>{
    try{Plotly.relayout(el,{'paper_bgcolor':PL.paper_bgcolor,'plot_bgcolor':PL.plot_bgcolor,
      'font.color':PL.font.color,'xaxis.gridcolor':PL.xaxis.gridcolor,
      'yaxis.gridcolor':PL.yaxis.gridcolor})}catch{}})}
// Restore theme on load
(function(){const t=localStorage.getItem('meridian_theme');if(t==='light'){document.documentElement.classList.add('light');_updatePL();const btn=$('#themeToggle');if(btn)btn.innerHTML='&#9788;'}})();

// ═══ TIP POPOVER ═══
function toggleTipPopover(btn){const tip=btn.nextElementSibling;if(!tip)return;const isOpen=tip.classList.toggle('open');tip.style.display=isOpen?'flex':'none'}

// ═══ GLOSSARY ═══
const _GLOSSARY={
  'Mann-Kendall':'Non-parametric trend test. Determines if a time series has a monotonic upward or downward trend without assuming normality.',
  'Sen\'s Slope':'Robust estimator of linear trend rate, paired with Mann-Kendall. Resistant to outliers — uses median of all pairwise slopes.',
  'Pearson r':'Parametric correlation coefficient (-1 to +1). Measures linear relationship strength. Assumes both variables are normally distributed.',
  'Spearman ρ':'Rank-based correlation coefficient. Non-parametric alternative to Pearson — works with monotonic (not just linear) relationships.',
  'LTTB':'Largest-Triangle-Three-Buckets. Downsampling algorithm that preserves visual shape of time series while reducing point count.',
  'Anomaly':'A data point that deviates significantly (typically >2 standard deviations) from the local mean.',
  'ANOVA':'Analysis of Variance. Tests whether means differ among 3+ groups. One-way ANOVA assumes normality and equal variances.',
  'Tukey HSD':'Honest Significant Difference. Post-hoc test after ANOVA to determine which specific group pairs differ significantly.',
  'Shapiro-Wilk':'Normality test. Tests whether data comes from a normal distribution. Low p-value (<0.05) suggests non-normality.',
  'p-value':'Probability of observing results at least as extreme as measured, if the null hypothesis were true. Not the probability the hypothesis is true.',
  'Effect Size':'Magnitude of a difference or relationship, independent of sample size. Cohen\'s d: 0.2=small, 0.5=medium, 0.8=large.',
  'Power':'Probability of detecting a real effect (1 - Type II error rate). Conventionally, 80% power is considered adequate.',
  'SST':'Sea Surface Temperature. Measured by satellites (AVHRR, MODIS, VIIRS) and in situ (buoys, Argo floats).',
  'Chlorophyll-a':'Photosynthetic pigment used as a proxy for phytoplankton biomass. Higher values indicate greater primary productivity.',
  'ERDDAP':'Environmental Research Division Data Access Program. NOAA server protocol for distributing scientific gridded datasets.',
  'GLM':'Generalized Linear Model. Extends linear regression to non-normal response distributions (Poisson for counts, Binomial for proportions).',
  'AIC':'Akaike Information Criterion. Model selection metric — lower is better. Balances goodness of fit against model complexity.',
  'BIC':'Bayesian Information Criterion. Similar to AIC but penalizes complexity more heavily. Preferred for larger datasets.',
  'PERMANOVA':'Permutational ANOVA. Non-parametric multivariate test using distance matrices. Tests whether group centroids differ in multivariate space.',
  'PCA':'Principal Component Analysis. Reduces many correlated variables into fewer uncorrelated components that explain most variance.',
  'Kruskal-Wallis':'Non-parametric alternative to one-way ANOVA. Compares medians across 3+ groups without assuming normality.',
  'R²':'Coefficient of determination. Proportion of variance in the dependent variable explained by the model (0 to 1).',
  'VIF':'Variance Inflation Factor. Detects multicollinearity between predictors. VIF >5 suggests problematic correlation between predictors.',
  'Eta²':'Effect size for ANOVA. Proportion of total variance explained by the grouping factor. Similar interpretation to R².',
  'Hardy-Weinberg':'Equilibrium model predicting genotype frequencies from allele frequencies in idealized populations (no selection, drift, migration, mutation).',
  'Fst':'Fixation index. Measures genetic differentiation between populations (0=no differentiation, 1=complete fixation).',
  'Shannon H\'':'Shannon-Wiener diversity index. Higher values indicate greater diversity. Accounts for both richness and evenness.',
  'Simpson D':'Probability that two randomly chosen individuals belong to the same species. 1-D gives diversity; higher = more diverse.',
  'Rarefaction':'Technique to estimate expected species richness at standardized sample sizes. Enables fair comparison across unequal sampling effort.',
  'Holt-Winters':'Triple exponential smoothing method for time series forecasting that handles level, trend, and seasonal components.',
  'ARIMA':'Autoregressive Integrated Moving Average. Statistical model for time series forecasting combining AR, differencing, and MA components.',
  'Leslie Matrix':'Age-structured population model. Projects population growth using age-specific survival rates and fecundities.',
  'Beverton-Holt':'Stock-recruitment model. Describes relationship between spawning biomass and recruitment with density-dependent regulation.',
  'MaxEnt':'Maximum Entropy. Machine learning method for species distribution modeling using presence-only data and environmental predictors.',
  'SDM':'Species Distribution Model. Predicts geographic range of species based on environmental conditions at known occurrence locations.',
  'Mark-Recapture':'Population estimation method. Capture, mark, release, recapture — ratio of marked to unmarked estimates total population (Lincoln-Petersen).',
  'CPUE':'Catch Per Unit Effort. Standard fisheries abundance index. Assumes proportionality between catch rate and population size.',
  'DHW':'Degree Heating Weeks. Cumulative thermal stress metric for coral bleaching. DHW ≥4 = significant bleaching likely, ≥8 = mass bleaching.',
  'SLA':'Sea Level Anomaly. Deviation of sea surface height from the long-term mean. Indicates ocean circulation patterns and eddies.',
  'ONI':'Oceanic Niño Index. 3-month running mean of SST anomalies in Niño 3.4 region. El Niño ≥+0.5°C, La Niña ≤-0.5°C.',
  'PDO':'Pacific Decadal Oscillation. Long-lived pattern of Pacific climate variability. Warm/cool phases lasting 20-30 years.',
  'NAO':'North Atlantic Oscillation. Pressure difference between Icelandic Low and Azores High. Influences weather patterns across Atlantic.',
  'Bayes Factor':'Ratio of evidence for one hypothesis over another. BF>3 = moderate evidence, BF>10 = strong evidence.',
  'MCMC':'Markov Chain Monte Carlo. Computational method for sampling from probability distributions. Used in Bayesian statistics.',
  'Random Forest':'Ensemble of decision trees. Each tree trained on bootstrap sample with random feature subsets. Robust to overfitting.',
  'K-means':'Unsupervised clustering algorithm. Partitions data into K groups by minimizing within-cluster variance.',
  'Cross-validation':'Model evaluation technique. Splits data into folds — trains on all-but-one fold, tests on held-out fold. Reduces overfitting.',
  'Confidence Interval':'Range of values likely to contain the true parameter. 95% CI: if we repeated the study 100 times, ~95 intervals would contain the true value.',
  'Null Hypothesis':'Default assumption of no effect or no difference. Statistical tests evaluate evidence against this assumption.',
  'Type I Error':'False positive. Rejecting the null hypothesis when it is actually true. Probability = α (usually 0.05).',
  'Type II Error':'False negative. Failing to reject the null hypothesis when it is actually false. Probability = β; Power = 1-β.'
};
function showGlossary(){
  const overlay=document.createElement('div');overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  const terms=Object.entries(_GLOSSARY).sort((a,b)=>a[0].localeCompare(b[0]));
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative"><button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>Scientific Glossary</h3>
    <input class="glossary-search" id="glossaryFilter" placeholder="Search terms..." oninput="filterGlossary(this.value)"/>
    <div id="glossaryList">${terms.map(([t,d])=>`<div class="glossary-item"><div class="gl-term">${escHTML(t)}</div><div class="gl-def">${escHTML(d)}</div></div>`).join('')}</div></div>`;
  document.body.appendChild(overlay);$('#glossaryFilter')?.focus()}
function filterGlossary(q){
  q=q.toLowerCase();const items=$$('#glossaryList .glossary-item');
  items.forEach(el=>{const t=el.querySelector('.gl-term').textContent.toLowerCase();
    const d=el.querySelector('.gl-def').textContent.toLowerCase();
    el.style.display=(t.includes(q)||d.includes(q))?'':'none'})}

// ═══ GUIDED WORKFLOWS ═══
// ═══ CUSTOMIZABLE WORKFLOWS ═══
const _DEFAULT_WORKFLOWS=[
  {name:'Coral Bleaching Assessment',desc:'Analyze thermal stress indicators and bleaching risk using SST, SST anomaly, DHW, chlorophyll, and bleaching alert area.',
    vars:['sst','sst_anom','dhw','baa','hotspot','chlor'],dateRange:365,
    guidance:'Look for SST >29°C, DHW ≥4 (bleaching likely) or ≥8 (mass bleaching). Declining chlorophyll may indicate reef stress. Compare BAA levels across time.',
    thresholds:[{var:'sst',op:'>',val:29,label:'Bleaching risk SST'},{var:'dhw',op:'>=',val:4,label:'Significant bleaching'},{var:'dhw',op:'>=',val:8,label:'Mass bleaching'}],builtin:true},
  {name:'Upwelling Detection',desc:'Identify coastal upwelling events via SST cooling, wind patterns, and chlorophyll blooms.',
    vars:['sst','ws','wdir','chlor','sal','curr_u','curr_v'],dateRange:180,
    guidance:'Upwelling signatures: sudden SST drops (2-5°C), elevated chlorophyll (>1 mg/m³), equatorward winds. Check current direction for offshore Ekman transport.',
    thresholds:[{var:'chlor',op:'>',val:1,label:'Bloom indicator'}],builtin:true},
  {name:'Water Quality Report',desc:'Comprehensive water quality snapshot using turbidity proxies, chlorophyll, salinity, and atmospheric conditions.',
    vars:['chlor','sal','sst','par','at','pp','cl'],dateRange:90,
    guidance:'Kd490 >0.3 m⁻¹ suggests turbid water. High chlorophyll + low Kd490 = algal bloom. Compare salinity deviations with precipitation events.',
    thresholds:[{var:'par',op:'>',val:0.3,label:'Turbid water'}],builtin:true},
  {name:'Climate Trend Analysis',desc:'Long-term climate signals using SST trends, CO₂, sea level, and sea ice extent.',
    vars:['sst','co2','sla','seaice','at','sst_anom'],dateRange:3650,
    guidance:'Apply Mann-Kendall trend tests. Look for accelerating SST trends, CO₂ >420 ppm baseline, positive SLA trends, declining sea ice fraction.',
    thresholds:[{var:'co2',op:'>',val:420,label:'Above baseline'}],builtin:true},
  {name:'Fisheries Habitat Assessment',desc:'Evaluate habitat suitability for target species using temperature, productivity, currents, and depth.',
    vars:['sst','chlor','npp','sal','curr_u','curr_v','depth','wh'],dateRange:365,
    guidance:'Cross-reference species thermal preferences with SST range. High NPP areas indicate productive feeding grounds. Current patterns reveal larval transport routes.',
    thresholds:[],builtin:true},
  {name:'Storm Impact Analysis',desc:'Assess storm impacts on marine environments using wave, wind, SST, and atmospheric data.',
    vars:['wh','sh','wp','ws','wdir','pr','sst','at','pp'],dateRange:30,
    guidance:'Wave height >4m = significant storm. Track SST cooling from mixing (storm-induced upwelling). Compare pre/post atmospheric pressure drops.',
    thresholds:[{var:'wh',op:'>',val:4,label:'Significant storm'}],builtin:true}
];
function _loadWorkflows(){
  const saved=safeParse('meridian_workflows',null);
  if(!saved)return _DEFAULT_WORKFLOWS.map(w=>({...w}));
  return saved}
function _saveWorkflows(wfs){safeStore('meridian_workflows',wfs)}
function _getWorkflows(){return _loadWorkflows()}

function showWorkflows(){
  const wfs=_getWorkflows();
  const overlay=document.createElement('div');overlay.className='meridian-modal-overlay';overlay.id='wf-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  _renderWorkflowList(overlay,wfs);
  document.body.appendChild(overlay)}

function _renderWorkflowList(overlay,wfs){
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative;max-width:780px">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>Analysis Workflows</h3>
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <p style="font-size:12px;color:var(--ts);flex:1">Select a workflow to load, or create your own custom analysis recipe.</p>
      <button class="bt on" onclick="openWorkflowEditor(-1)" style="white-space:nowrap">+ New Workflow</button>
      <button class="bt sm" onclick="resetWorkflowDefaults()" style="font-size:10px;white-space:nowrap">Reset Defaults</button>
    </div>
    <div id="wf-list">${wfs.map((w,i)=>_workflowCardHTML(w,i)).join('')}</div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="bt sm" onclick="exportWorkflows()">Export All</button>
      <button class="bt sm" onclick="importWorkflows()">Import</button>
    </div></div>`}

function _workflowCardHTML(w,i){
  const varNames=w.vars.map(v=>{const ev=EV.find(x=>x.id===v);return ev?ev.nm:v}).join(', ');
  const rangeLabel=w.dateRange>=365?Math.round(w.dateRange/365)+'yr':w.dateRange+'d';
  const threshCount=w.thresholds?.length||0;
  return`<div class="wf-card" style="position:relative">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;cursor:pointer" onclick="applyWorkflow(${i})">
        <h4>${escHTML(w.name)}${w.builtin?'<span style="font-size:9px;color:var(--tm);font-weight:400;margin-left:6px">BUILT-IN</span>':''}</h4>
        <p>${escHTML(w.desc)}</p>
        <div class="wf-vars">${w.vars.length} vars: ${varNames} · ${rangeLabel}${threshCount?' · '+threshCount+' threshold'+(threshCount>1?'s':''):''}</div>
      </div>
      <div style="display:flex;gap:3px;flex-shrink:0">
        <button class="bt sm" onclick="event.stopPropagation();openWorkflowEditor(${i})" title="Edit" style="padding:4px 8px;font-size:11px">Edit</button>
        <button class="bt sm" onclick="event.stopPropagation();duplicateWorkflow(${i})" title="Duplicate" style="padding:4px 8px;font-size:11px">Dup</button>
        <button class="bt sm" onclick="event.stopPropagation();deleteWorkflow(${i})" title="Delete" style="padding:4px 8px;font-size:11px;color:var(--co)">×</button>
      </div>
    </div></div>`}

function applyWorkflow(idx){
  const wfs=_getWorkflows();const w=wfs[idx];if(!w)return;
  goTab('env');
  S.envSel=new Set(w.vars);renderEV();
  setDateRange(w.dateRange);
  openEnvGroup('loc');openEnvGroup('vars');
  window._activeWorkflow=w;
  document.querySelector('.meridian-modal-overlay')?.remove();
  toast('Workflow loaded: '+w.name+'. Set coordinates and click Fetch.','ok',5000);
  _updateQueryMeter()}

function openWorkflowEditor(idx){
  const wfs=_getWorkflows();
  const isNew=idx<0;
  const w=isNew?{name:'',desc:'',vars:[],dateRange:365,guidance:'',thresholds:[]}:{...wfs[idx],thresholds:[...(wfs[idx].thresholds||[])]};
  // Replace the modal content with the editor
  const overlay=$('#wf-overlay');if(!overlay)return;
  const cats=[...new Set(EV.map(v=>v.cat))];
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative;max-width:780px">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>${isNew?'Create':'Edit'} Workflow</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">NAME</label>
        <input class="si" id="wfe-name" value="${escHTML(w.name)}" placeholder="e.g. Reef Monitoring Protocol" style="width:100%"/>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">DESCRIPTION</label>
        <input class="si" id="wfe-desc" value="${escHTML(w.desc)}" placeholder="What this workflow analyzes and why" style="width:100%"/>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">VARIABLES <span id="wfe-var-count" style="color:var(--ac)">(${w.vars.length} selected)</span></label>
        <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
          <button class="bt sm" onclick="_wfeSelectAll()" style="font-size:10px">All</button>
          <button class="bt sm" onclick="_wfeClearAll()" style="font-size:10px">Clear</button>
          ${cats.map(c=>`<button class="bt sm" onclick="_wfeToggleCat('${c}')" style="font-size:10px" title="Toggle ${c}">${c}</button>`).join('')}
        </div>
        <div id="wfe-vars" style="display:flex;flex-wrap:wrap;gap:4px;max-height:160px;overflow-y:auto;padding:8px;background:var(--bi);border:1px solid var(--bd);border-radius:6px">
          ${EV.map(v=>`<span class="vc ${w.vars.includes(v.id)?'sel':''}" data-id="${v.id}" onclick="_wfeToggleVar('${v.id}',this)" title="${v.cat}: ${v.nm} (${v.u})">${v.nm}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">DATE RANGE (days)</label>
          <input class="fi" id="wfe-range" type="number" value="${w.dateRange}" min="1" max="36500" style="width:100%"/>
          <div style="display:flex;gap:3px;margin-top:4px">
            <button class="bt sm" onclick="$('#wfe-range').value=30" style="font-size:10px;padding:2px 6px">30d</button>
            <button class="bt sm" onclick="$('#wfe-range').value=90" style="font-size:10px;padding:2px 6px">90d</button>
            <button class="bt sm" onclick="$('#wfe-range').value=365" style="font-size:10px;padding:2px 6px">1yr</button>
            <button class="bt sm" onclick="$('#wfe-range').value=1825" style="font-size:10px;padding:2px 6px">5yr</button>
            <button class="bt sm" onclick="$('#wfe-range').value=3650" style="font-size:10px;padding:2px 6px">10yr</button>
          </div>
        </div>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">INTERPRETIVE GUIDANCE</label>
        <textarea class="si" id="wfe-guidance" rows="3" placeholder="What to look for in the results, threshold values, interpretation tips..." style="width:100%;resize:vertical;font-size:13px;line-height:1.5">${escHTML(w.guidance)}</textarea>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">ALERT THRESHOLDS <button class="bt sm" onclick="_wfeAddThreshold()" style="font-size:10px;padding:2px 8px;margin-left:6px">+ Add</button></label>
        <div id="wfe-thresholds" style="display:flex;flex-direction:column;gap:4px">
          ${(w.thresholds||[]).map((t,ti)=>_thresholdRowHTML(t,ti)).join('')}
        </div>
        <div style="font-size:10px;color:var(--tm);margin-top:4px">Thresholds trigger visual alerts on charts when values cross the defined limits.</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;justify-content:flex-end">
        <button class="bt sm" onclick="_renderWorkflowList($('#wf-overlay'),_getWorkflows())">Cancel</button>
        <button class="bt on" onclick="saveWorkflowFromEditor(${idx})">${isNew?'Create Workflow':'Save Changes'}</button>
      </div>
    </div></div>`;
  // Store current threshold data for the editor
  window._wfeThresholds=w.thresholds||[]}

function _thresholdRowHTML(t,ti){
  const varOpts=EV.map(v=>`<option value="${v.id}" ${t.var===v.id?'selected':''}>${v.nm} (${v.u})</option>`).join('');
  return`<div class="wfe-thresh-row" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap" data-idx="${ti}">
    <select class="fs" style="font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].var=this.value">${varOpts}</select>
    <select class="fs" style="font-size:11px;padding:4px;width:50px" onchange="window._wfeThresholds[${ti}].op=this.value">
      <option value=">" ${t.op==='>'?'selected':''}>&gt;</option><option value=">=" ${t.op==='>='?'selected':''}>&ge;</option>
      <option value="<" ${t.op==='<'?'selected':''}>&lt;</option><option value="<=" ${t.op==='<='?'selected':''}>&le;</option>
    </select>
    <input class="fi" type="number" step="any" value="${t.val}" style="width:70px;font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].val=parseFloat(this.value)"/>
    <input class="fi" value="${escHTML(t.label||'')}" placeholder="Label" style="flex:1;min-width:80px;font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].label=this.value"/>
    <button class="bt sm" onclick="_wfeRemoveThreshold(${ti})" style="padding:2px 6px;font-size:11px;color:var(--co)">×</button></div>`}

function _wfeToggleVar(id,el){el.classList.toggle('sel');
  const cnt=$$('#wfe-vars .vc.sel').length;$('#wfe-var-count').textContent='('+cnt+' selected)'}
function _wfeSelectAll(){$$('#wfe-vars .vc').forEach(el=>el.classList.add('sel'));
  $('#wfe-var-count').textContent='('+EV.length+' selected)'}
function _wfeClearAll(){$$('#wfe-vars .vc').forEach(el=>el.classList.remove('sel'));
  $('#wfe-var-count').textContent='(0 selected)'}
function _wfeToggleCat(cat){const ids=EV.filter(v=>v.cat===cat).map(v=>v.id);
  const chips=$$('#wfe-vars .vc');const catChips=[...chips].filter(c=>ids.includes(c.dataset.id));
  const allSel=catChips.every(c=>c.classList.contains('sel'));
  catChips.forEach(c=>c.classList.toggle('sel',!allSel));
  const cnt=$$('#wfe-vars .vc.sel').length;$('#wfe-var-count').textContent='('+cnt+' selected)'}
function _wfeAddThreshold(){
  window._wfeThresholds=window._wfeThresholds||[];
  const t={var:EV[0].id,op:'>',val:0,label:''};
  window._wfeThresholds.push(t);
  const el=$('#wfe-thresholds');
  el.insertAdjacentHTML('beforeend',_thresholdRowHTML(t,window._wfeThresholds.length-1))}
function _wfeRemoveThreshold(ti){
  window._wfeThresholds.splice(ti,1);
  // Re-render all thresholds to fix indices
  const el=$('#wfe-thresholds');
  el.innerHTML=window._wfeThresholds.map((t,i)=>_thresholdRowHTML(t,i)).join('')}

function saveWorkflowFromEditor(idx){
  const name=$('#wfe-name').value.trim();
  if(!name){toast('Workflow needs a name','err');return}
  const vars=[...$$('#wfe-vars .vc.sel')].map(el=>el.dataset.id);
  if(!vars.length){toast('Select at least one variable','err');return}
  const wf={
    name,
    desc:$('#wfe-desc').value.trim(),
    vars,
    dateRange:parseInt($('#wfe-range').value)||365,
    guidance:$('#wfe-guidance').value.trim(),
    thresholds:(window._wfeThresholds||[]).filter(t=>t.var&&t.val!==undefined),
    builtin:false
  };
  const wfs=_getWorkflows();
  if(idx<0)wfs.push(wf);
  else wfs[idx]=wf;
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast(idx<0?'Workflow created':'Workflow updated','ok')}

function duplicateWorkflow(idx){
  const wfs=_getWorkflows();const w=wfs[idx];if(!w)return;
  const copy={...w,name:w.name+' (copy)',vars:[...w.vars],thresholds:[...(w.thresholds||[]).map(t=>({...t}))],builtin:false};
  wfs.splice(idx+1,0,copy);
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast('Workflow duplicated','ok')}

function deleteWorkflow(idx){
  const wfs=_getWorkflows();
  if(!confirm('Delete workflow "'+wfs[idx].name+'"?'))return;
  wfs.splice(idx,1);
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast('Workflow deleted','ok')}

function resetWorkflowDefaults(){
  if(!confirm('Reset all workflows to defaults? Custom workflows will be lost.'))return;
  localStorage.removeItem('meridian_workflows');
  _renderWorkflowList($('#wf-overlay'),_getWorkflows());
  toast('Workflows reset to defaults','ok')}

function exportWorkflows(){
  const wfs=_getWorkflows();
  dl(JSON.stringify(wfs,null,2),'meridian-workflows.json','application/json');
  toast('Workflows exported','ok')}

function importWorkflows(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=e=>{const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{
      const imported=JSON.parse(ev.target.result);
      if(!Array.isArray(imported)){toast('Invalid workflow file','err');return}
      const valid=imported.filter(w=>w.name&&Array.isArray(w.vars));
      if(!valid.length){toast('No valid workflows found in file','err');return}
      const wfs=_getWorkflows();
      valid.forEach(w=>{w.builtin=false;wfs.push(w)});
      _saveWorkflows(wfs);
      _renderWorkflowList($('#wf-overlay'),wfs);
      toast(valid.length+' workflow(s) imported','ok')}
    catch{toast('Failed to parse workflow file','err')}};
    reader.readAsText(file)};
  input.click()}

// Save current env state as a new workflow (quick capture)
function saveCurrentAsWorkflow(){
  const vars=[...S.envSel];
  if(!vars.length){toast('Select some variables first','err');return}
  const name=prompt('Workflow name:');if(!name)return;
  const df=$('#edf')?.value,dt=$('#edt')?.value;
  let dateRange=365;
  if(df&&dt){dateRange=Math.max(1,Math.round((new Date(dt)-new Date(df))/86400000))}
  const wf={name,desc:'Custom workflow saved from current selection',vars,dateRange,
    guidance:'',thresholds:[],builtin:false};
  const wfs=_getWorkflows();wfs.push(wf);_saveWorkflows(wfs);
  toast('Workflow saved: '+name,'ok')}

// ═══ DATA PROVENANCE STAMPS ═══
function stampProvenance(varId,meta){
  S.envProvenance[varId]={fetchedAt:new Date().toISOString(),server:meta.server||'N/A',dataset:meta.dataset||'N/A',
    stride:meta.stride||'1',coordsUsed:{lat:meta.lat,lon:meta.lon},dateRange:{from:meta.from,to:meta.to},
    variable:meta.variable||varId,source:meta.source||'unknown'}}
function getProvenanceHTML(varId){
  const p=S.envProvenance[varId];if(!p)return'';
  return`<span class="prov-badge" title="Provenance: ${escHTML(p.server)}\nDataset: ${escHTML(p.dataset)}\nFetched: ${p.fetchedAt}\nCoords: ${p.coordsUsed?.lat||'?'}°N, ${p.coordsUsed?.lon||'?'}°E\nRange: ${p.dateRange?.from||'?'} to ${p.dateRange?.to||'?'}">&#x1f4cb; Provenance</span>`}

// ═══ REPRODUCIBILITY BUNDLE EXPORT ═══
function exportReproBundle(){
  const bundle={version:'1.0',exportedAt:new Date().toISOString(),platform:'Meridian',
    settings:{lat:$('#elat')?.value,lon:$('#elon')?.value,mode:$('#emode')?.value,
      dateFrom:$('#edf')?.value,dateTo:$('#edt')?.value,selectedVars:[...S.envSel],
      fusionMode:_fusionMode,seasonalFilter:getSeasonalMonths(),skillLevel:S.skillLevel},
    provenance:S.envProvenance,
    data:{},statistics:{},workflow:window._activeWorkflow||null};
  // Include all env time series data
  Object.keys(S.envTS).forEach(id=>{
    bundle.data[id]={name:S.envTS[id].nm,unit:S.envTS[id].u,points:S.envTS[id].data.length,
      values:S.envTS[id].data}});
  // Include summary stats
  Object.keys(S.envR).forEach(id=>{
    bundle.statistics[id]={value:S.envR[id].value,unit:S.envR[id].u,name:S.envR[id].nm}});
  // Mann-Kendall trends
  Object.keys(S.envTS).forEach(id=>{
    let d=S.envTS[id].data;if(d&&d.length>=10){if(d.length>300)d=lttb(d,300);
      const mk=mannKendall(d);if(mk)bundle.statistics[id+'_trend']={test:'Mann-Kendall',trend:mk.trend,p:mk.p,slope:mk.slope,label:mk.label}}});
  // Quality assessments
  Object.keys(S.envTS).forEach(id=>{
    const q=assessQuality(S.envTS[id].data);bundle.statistics[id+'_quality']=q});
  const json=JSON.stringify(bundle,null,2);
  dl(json,'meridian-analysis-bundle-'+new Date().toISOString().slice(0,10)+'.json','application/json');
  toast('Reproducibility bundle exported','ok')}

// ═══ SHAREABLE ANALYSIS LINKS ═══
function shareAnalysisLink(){
  const state={lat:$('#elat')?.value||'',lon:$('#elon')?.value||'',vars:[...S.envSel].join(','),
    mode:$('#emode')?.value||'timeseries',df:$('#edf')?.value||'',dt:$('#edt')?.value||'',
    skill:S.skillLevel};
  const encoded=btoa(JSON.stringify(state));
  const url=location.origin+location.pathname+'#state='+encoded;
  navigator.clipboard?.writeText(url).then(()=>toast('Link copied to clipboard','ok')).catch(()=>{
    prompt('Copy this link:',url)})}
function loadSharedState(){
  const hash=location.hash;if(!hash.includes('#state='))return;
  try{const encoded=hash.split('#state=')[1];const state=JSON.parse(atob(encoded));
    if(typeof state!=='object'||state===null)return;
    // Validate numeric lat/lon
    if(state.lat&&isFinite(+state.lat))$('#elat').value=+state.lat;
    if(state.lon&&isFinite(+state.lon))$('#elon').value=+state.lon;
    // Validate var IDs against known EV catalogue
    if(state.vars&&typeof state.vars==='string'){const known=typeof EV!=='undefined'?new Set(EV.map(v=>v.id)):null;const ids=state.vars.split(',').filter(v=>v&&(!known||known.has(v)));S.envSel=new Set(ids);if(typeof renderEV==='function')renderEV()}
    if(state.mode&&['latest','timeseries','depthprofile'].includes(state.mode))$('#emode').value=state.mode;
    if(state.df&&/^\d{4}-\d{2}-\d{2}$/.test(state.df))$('#edf').value=state.df;
    if(state.dt&&/^\d{4}-\d{2}-\d{2}$/.test(state.dt))$('#edt').value=state.dt;
    if(state.skill&&['beginner','intermediate','advanced'].includes(state.skill)){S.skillLevel=state.skill;safeStore('meridian_skill',state.skill)}
    goTab('env');openEnvGroup('loc');
    toast('Shared analysis loaded','ok');location.hash=''}catch(e){console.warn('Invalid shared state',e)}}

// ═══ SKILL LEVEL MANAGEMENT ═══
function setSkillLevel(level){
  S.skillLevel=level;safeStore('meridian_skill',level);
  document.querySelectorAll('[data-skill]').forEach(el=>{
    const req=el.dataset.skill;
    if(req==='advanced')el.classList.toggle('skill-hidden',level==='beginner');
    else if(req==='expert')el.classList.toggle('skill-hidden',level!=='advanced')});
  toast('Skill level: '+level,'ok')}

// ═══ SETTINGS PAGE ═══
function toggleSettingsGroup(g){
  const b=$('#settings-'+g+'-body'),a=$('#settings-'+g+'-arrow');
  if(!b)return;
  const show=b.style.display==='none';
  b.style.display=show?'':'none';
  if(a)a.textContent=show?'▾':'▸';
}

let _settingsInit=false;
function initSettings(){
  _refreshDisplayButtons();
  _refreshSidebarBehaviorButtons();
  if(_settingsInit)return;
  _settingsInit=true;
  // Apply saved font size on load
  const savedSize=localStorage.getItem('meridian_fontsize');
  if(savedSize)document.body.style.fontSize=savedSize+'px';
  // Apply saved sidebar behavior
  const sbBehavior=localStorage.getItem('meridian_sb_behavior')||'hover';
  _applySidebarBehavior(sbBehavior);
  // Load profile if signed in
  _loadProfile();
}

// ── Display settings ──
function setThemeFromSettings(theme){
  const isLight=document.documentElement.classList.contains('light');
  if((theme==='light')!==isLight)toggleTheme();
  _refreshDisplayButtons();
}

function setFontSize(px){
  document.body.style.fontSize=px+'px';
  localStorage.setItem('meridian_fontsize',px);
  _refreshDisplayButtons();
  toast('Font size: '+px+'px','ok');
}

function setSidebarBehavior(mode){
  localStorage.setItem('meridian_sb_behavior',mode);
  _applySidebarBehavior(mode);
  _refreshSidebarBehaviorButtons();
  toast('Sidebar: '+mode,'ok');
}

function _applySidebarBehavior(mode){
  const sb=$('#sidebar');
  if(!sb)return;
  if(mode==='click'){
    sb.classList.add('sb-no-hover');
  }else{
    sb.classList.remove('sb-no-hover');
  }
}

function _refreshDisplayButtons(){
  const isLight=document.documentElement.classList.contains('light');
  $$('.set-theme-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.theme===(isLight?'light':'dark'));
  });
  const curSize=parseInt(localStorage.getItem('meridian_fontsize'))||15;
  $$('.set-font-btn').forEach(b=>{
    b.classList.toggle('on',parseInt(b.dataset.size)===curSize);
  });
}

function _refreshSidebarBehaviorButtons(){
  const cur=localStorage.getItem('meridian_sb_behavior')||'hover';
  $$('.set-sb-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.sbbehavior===cur);
  });
}

// ── Profile settings ──
async function _loadProfile(){
  if(!window.SB||!window._supaUser)return;
  try{
    const{data}=await SB.from('user_profiles').select('*').eq('user_id',_supaUser.id).maybeSingle();
    if(data){
      const dn=$('#set-displayname'),af=$('#set-affiliation'),or=$('#set-orcid');
      if(dn)dn.value=data.display_name||'';
      if(af)af.value=data.affiliation||'';
      if(or)or.value=data.orcid||'';
      const nc=$('#set-notify-comments'),nf=$('#set-notify-flags'),pp=$('#set-public-profile');
      if(nc)nc.checked=!!data.notify_comments;
      if(nf)nf.checked=!!data.notify_flags;
      if(pp)pp.checked=!!data.public_profile;
    }
  }catch(e){console.warn('Load profile:',e)}
}

async function saveProfile(){
  if(!window.SB||!window._supaUser){toast('Sign in to save your profile','err');return}
  const msg=$('#set-profile-msg');
  if(msg){msg.style.color='var(--ac)';msg.textContent='Saving…'}
  const orcid=$('#set-orcid')?.value?.trim();
  if(orcid){
    const valid=await _validateOrcid(orcid);
    if(!valid){
      if(msg){msg.style.color='var(--co)';msg.textContent='Invalid ORCID iD'}
      return;
    }
  }
  const row={
    user_id:_supaUser.id,
    display_name:$('#set-displayname')?.value?.trim()||null,
    affiliation:$('#set-affiliation')?.value?.trim()||null,
    orcid:orcid||null,
    notify_comments:!!$('#set-notify-comments')?.checked,
    notify_flags:!!$('#set-notify-flags')?.checked,
    public_profile:!!$('#set-public-profile')?.checked,
    updated_at:new Date().toISOString()
  };
  try{
    const{data:existing}=await SB.from('user_profiles').select('id').eq('user_id',_supaUser.id).maybeSingle();
    if(existing)await SB.from('user_profiles').update(row).eq('id',existing.id);
    else await SB.from('user_profiles').insert(row);
    if(msg){msg.style.color='var(--sg)';msg.textContent='Saved';setTimeout(()=>msg.textContent='',3000)}
  }catch(e){
    console.error('Save profile:',e);
    if(msg){msg.style.color='var(--co)';msg.textContent='Error saving profile'}
  }
}

async function _validateOrcid(orcid){
  const status=$('#set-orcid-status');
  const pattern=/^\d{4}-\d{4}-\d{4}-[\dX]$/;
  if(!pattern.test(orcid)){
    if(status){status.style.color='var(--co)';status.textContent='✕ Invalid format'}
    return false;
  }
  if(status){status.style.color='var(--ac)';status.textContent='Verifying…'}
  try{
    const r=await fetch('https://pub.orcid.org/v3.0/'+orcid+'/record',{headers:{'Accept':'application/json'}});
    if(r.ok){
      if(status){status.style.color='var(--sg)';status.textContent='✓ Verified'}
      return true;
    }
    if(status){status.style.color='var(--co)';status.textContent='✕ Not found'}
    return false;
  }catch(e){
    if(status){status.style.color='var(--wa)';status.textContent='⚠ Could not verify'}
    return true;// allow save if API unreachable
  }
}

// ── Data & Privacy ──
async function exportMyData(){
  toast('Exporting data…','info');
  const out={exportedAt:new Date().toISOString(),user:null,publications:[],library:[],settings:null};
  try{
    if(window.SB&&window._supaUser){
      out.user={id:_supaUser.id,email:_supaUser.email};
      const{data:pubs}=await SB.from('publications').select('*').eq('user_id',_supaUser.id);
      out.publications=pubs||[];
      const{data:papers}=await SB.from('library_papers').select('*').eq('user_id',_supaUser.id);
      out.library=papers||[];
      const{data:settings}=await SB.from('user_settings').select('*').eq('user_id',_supaUser.id).maybeSingle();
      out.settings=settings;
      const{data:profile}=await SB.from('user_profiles').select('*').eq('user_id',_supaUser.id).maybeSingle();
      out.profile=profile;
    }
    // Include local library
    if(typeof dbAll==='function'){
      const local=await dbAll();
      out.localLibrary=local||[];
    }
  }catch(e){console.warn('Export error:',e)}
  dl(JSON.stringify(out,null,2),'meridian-export-'+new Date().toISOString().slice(0,10)+'.json','application/json');
  toast('Data exported','ok');
}

async function clearLocalLibrary(){
  const overlay=document.createElement('div');
  overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML=`<div class="meridian-modal" style="max-width:440px;position:relative">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3 style="color:var(--wa)">Clear Local Library</h3>
    <p style="font-size:14px;color:var(--ts);line-height:1.6;margin-bottom:18px">This will remove all saved papers from your local library. Cloud-synced data will not be affected.</p>
    <p style="font-size:14px;color:var(--ts);margin-bottom:18px">Are you sure?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="bt" onclick="this.closest('.meridian-modal-overlay').remove()">Cancel</button>
      <button class="bt" style="color:var(--co);border-color:rgba(194,120,120,.3)" onclick="_doClearLocal(this)">Yes, Clear Library</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function _doClearLocal(btn){
  btn.textContent='Clearing…';btn.disabled=true;
  try{
    const req=indexedDB.deleteDatabase('MeridianLib');
    req.onsuccess=()=>{
      window.db=null;
      if(typeof openDB==='function')openDB();
      btn.closest('.meridian-modal-overlay').remove();
      toast('Local library cleared','ok');
    };
    req.onerror=()=>{toast('Error clearing library','err');btn.closest('.meridian-modal-overlay').remove()};
  }catch(e){toast('Error: '+e.message,'err');btn.closest('.meridian-modal-overlay').remove()}
}

function deleteAccountStep1(){
  const overlay=document.createElement('div');
  overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML=`<div class="meridian-modal" style="max-width:440px;position:relative">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3 style="color:var(--co)">Delete Account</h3>
    <p style="font-size:14px;color:var(--ts);line-height:1.6;margin-bottom:14px">This is permanent and cannot be undone. All your data will be deleted, including your publications, library, and profile.</p>
    <p style="font-size:14px;color:var(--ts);margin-bottom:12px">Type <strong style="color:var(--co)">DELETE</strong> to confirm:</p>
    <input class="si" id="delete-confirm-input" placeholder="Type DELETE" style="max-width:200px;margin-bottom:18px"/>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="bt" onclick="this.closest('.meridian-modal-overlay').remove()">Cancel</button>
      <button class="bt" id="delete-confirm-btn" style="color:#fff;background:var(--co);border-color:var(--co);opacity:.5;cursor:not-allowed" disabled onclick="_doDeleteAccount(this)">Delete My Account</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const inp=overlay.querySelector('#delete-confirm-input');
  const btn=overlay.querySelector('#delete-confirm-btn');
  inp.addEventListener('input',()=>{
    const ok=inp.value.trim()==='DELETE';
    btn.disabled=!ok;
    btn.style.opacity=ok?'1':'.5';
    btn.style.cursor=ok?'pointer':'not-allowed';
  });
}

async function _doDeleteAccount(btn){
  btn.textContent='Deleting…';btn.disabled=true;
  try{
    if(window.SB&&window._supaUser){
      const uid=_supaUser.id;
      await SB.from('library_papers').delete().eq('user_id',uid);
      await SB.from('user_settings').delete().eq('user_id',uid);
      await SB.from('user_profiles').delete().eq('user_id',uid);
      await SB.from('publications').delete().eq('user_id',uid);
      await SB.from('user_roles').delete().eq('user_id',uid);
      // Sign out — full account deletion requires a server-side admin call
      // but we clear all user data and sign out
      await SB.auth.signOut();
    }
    // Clear local data
    indexedDB.deleteDatabase('MeridianLib');
    localStorage.clear();
    btn.closest('.meridian-modal-overlay').remove();
    toast('Account data deleted. You have been signed out.','ok');
    setTimeout(()=>location.reload(),1500);
  }catch(e){
    console.error('Delete account:',e);
    toast('Error deleting account: '+e.message,'err');
    btn.textContent='Delete My Account';btn.disabled=false;
  }
}

// Apply saved display preferences on page load
(function(){
  const fs=localStorage.getItem('meridian_fontsize');
  if(fs)document.body.style.fontSize=fs+'px';
  const sb=localStorage.getItem('meridian_sb_behavior');
  if(sb==='click'){const el=$('#sidebar');if(el)el.classList.add('sb-no-hover')}
})();

// ═══ TOAST ═══
