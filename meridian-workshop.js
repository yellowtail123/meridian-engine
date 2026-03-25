// ═══ MERIDIAN WORKSHOP — Analysis Module ═══
// Workshop tab, chart types, statistical test runners, modeling

// ═══ WORKSHOP ═══
const _wsUndo=[];const _WS_UNDO_MAX=10;
function wsPushUndo(label){_wsUndo.push({label,wsC:[...S.wsC],wsD:S.wsD.map(r=>({...r})),cT:S.cT,xC:S.xC,yC:[...S.yC]});if(_wsUndo.length>_WS_UNDO_MAX)_wsUndo.shift();showUndoBar()}
function wsUndo(){const snap=_wsUndo.pop();if(!snap)return;S.wsC=snap.wsC;S.wsD=snap.wsD;S.cT=snap.cT;S.xC=snap.xC;S.yC=snap.yC;autoTypes();initWS();toast('Undone: '+snap.label,'ok');if(!_wsUndo.length)hideUndoBar()}
function showUndoBar(){let bar=$('#wsUndoBar');if(!bar){bar=document.createElement('div');bar.id='wsUndoBar';bar.className='undo-bar';document.body.appendChild(bar)}bar.innerHTML='<span>'+_wsUndo.length+' undo step'+((_wsUndo.length>1)?'s':'')+'</span><button class="bt sm" onclick="wsUndo()" style="color:var(--ac)">Undo</button>';bar.style.display='flex'}
function hideUndoBar(){const bar=$('#wsUndoBar');if(bar)bar.style.display='none'}
function autoTypes(){const t={};S.wsC.forEach(h=>{const vs=S.wsD.map(r=>r[h]);t[h]=vs.every(v=>typeof v==='number'&&v!=null)?(new Set(vs).size<=10?'ordinal':'continuous'):(vs.every(v=>typeof v==='string'&&/^\d{4}-\d{2}/.test(v))?'datetime':'categorical')});S.wsCT=t}
function initWS(){const has=S.wsD.length>0;H('#wcon',`
<div id="wsDrop" style="border:2px dashed var(--bd);border-radius:var(--rd);padding:18px;text-align:center;margin-bottom:14px;transition:all .2s;cursor:pointer" ondragover="event.preventDefault();this.style.borderColor='var(--ac)';this.style.background='var(--am)'" ondragleave="this.style.borderColor='var(--bd)';this.style.background=''" ondrop="event.preventDefault();this.style.borderColor='var(--bd)';this.style.background='';handleFileDrop(event.dataTransfer.files)" onclick="document.getElementById('wsFileIn').click()"><input type="file" id="wsFileIn" accept=".csv,.tsv,.xlsx,.xls,.json" style="display:none" onchange="handleFileDrop(this.files)"/><div style="font-size:14px;color:var(--ts);margin-bottom:3px">Drop file here or click to import</div><div style="font-size:11px;color:var(--tm);font-family:var(--mf)">CSV · TSV · Excel (.xlsx/.xls) · JSON</div></div>
<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Data ${has?'('+S.wsD.length+' × '+S.wsC.length+')':'— paste or import'}</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><textarea id="wd" rows="5" style="width:100%;padding:10px;background:var(--be);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:13px;font-family:var(--mf);outline:none;resize:vertical">${has?S.wsC.join(',')+'\n'+S.wsD.slice(0,100).map(r=>S.wsC.map(c=>typeof r[c]==='string'&&String(r[c]).includes(',')?'"'+r[c]+'"':r[c]??'').join(',')).join('\n'):"Year,SST,Chlor,CPUE\n2018,18.2,0.45,12.3\n2019,18.7,0.38,11.1\n2020,19.1,0.42,10.8"}</textarea><div style="display:flex;gap:8px;margin-top:8px"><button class="bt bt-pri" onclick="parseWS()">Parse</button><span id="wpi" style="font-size:12px;color:var(--tm);font-family:var(--mf)">${has?S.wsD.length+' × '+S.wsC.length:''}</span></div></div></div><div id="wst"></div><div id="wclean"></div><div id="wtb"></div><div id="wch"></div><div id="wstat"></div><div id="wtests"></div><div id="wex"></div>`);if(has)setTimeout(renderWP,50);else setTimeout(parseWS,50)}
function handleFileDrop(files){if(!files||!files.length)return;const file=files[0];const ext=file.name.split('.').pop().toLowerCase();const reader=new FileReader();
if(ext==='csv'||ext==='tsv'){reader.onload=e=>{const txt=e.target.result;$('#wd').value=ext==='tsv'?txt.replace(/\t/g,','):txt;parseWS()};reader.readAsText(file)}
else if(ext==='xlsx'||ext==='xls'){if(typeof XLSX==='undefined'){toast('Excel support unavailable — try CSV instead','err');return}reader.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const csv=XLSX.utils.sheet_to_csv(ws);$('#wd').value=csv;parseWS()}catch(err){toast('Error reading Excel: '+err.message,'err')}};reader.readAsArrayBuffer(file)}
else if(ext==='json'){reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.columns&&d.data){S.wsC=d.columns;S.wsD=d.data;autoTypes();initWS()}else if(Array.isArray(d)&&d.length){S.wsC=Object.keys(d[0]);S.wsD=d;autoTypes();initWS()}else toast('JSON must be [{...},...] or {columns:[],data:[]}','err');}catch(err){toast('Invalid JSON: '+err.message,'err')}};reader.readAsText(file)}
else toast('Unsupported format. Use CSV, TSV, XLSX, or JSON.','err')}
function parseCSVLine(line){const r=[];let c='',q=false;for(let i=0;i<line.length;i++){if(line[i]==='"'){if(q&&line[i+1]==='"'){c+='"';i++}else{q=!q}}else if(line[i]===','&&!q){r.push(c);c=''}else c+=line[i]}r.push(c);return r}
function parseWS(){const raw=$('#wd')?.value?.trim();if(!raw)return;const lines=raw.split('\n').filter(l=>l.trim());if(lines.length<2)return;const hd=parseCSVLine(lines[0]).map(h=>h.trim());const rows=lines.slice(1).map(l=>{const vs=parseCSVLine(l).map(v=>v.trim());const o={};hd.forEach((h,i)=>{const v=vs[i]||'';o[h]=isNaN(v)||v===''?v:parseFloat(v)});return o});S.wsD=rows;S.wsC=hd;autoTypes();S.xC=hd[0];const nc=hd.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');S.yC=nc.slice(0,2);$('#wpi').textContent=rows.length+' × '+hd.length;renderWP()}
function renderWP(){const cols=S.wsC,rows=S.wsD,nc=cols.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
if(nc.length){const stats={};nc.forEach(c=>{const vs=rows.map(r=>r[c]).filter(v=>typeof v==='number');if(!vs.length)return;const s=[...vs].sort((a,b)=>a-b),m=vs.reduce((a,v)=>a+v,0)/vs.length,va=vs.reduce((a,v)=>a+(v-m)**2,0)/vs.length;stats[c]={n:vs.length,mn:s[0],mx:s[vs.length-1],avg:m.toFixed(3),med:s[~~(vs.length/2)].toFixed(3),sd:Math.sqrt(va).toFixed(3)}});H('#wst',`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Stats</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><table class="st"><thead><tr><th style="text-align:left">Var</th><th>n</th><th>Min</th><th>Max</th><th>Mean</th><th>Med</th><th>SD</th></tr></thead><tbody>${Object.entries(stats).map(([c,s])=>`<tr><td class="cn">${c}</td><td>${s.n}</td><td>${s.mn}</td><td>${s.mx}</td><td>${s.avg}</td><td>${s.med}</td><td>${s.sd}</td></tr>`).join('')}</tbody></table></div></div>`)}else H('#wst','');
H('#wclean',`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Clean & Transform</h4><span style="color:var(--tm)">▾</span></div><div class="sb" style="display:none"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
<button class="bt sm" onclick="dropNulls()">Drop Null Rows</button>
<button class="bt sm" onclick="dropOutliers()">Remove Outliers (IQR)</button>
<button class="bt sm" onclick="addColumn()">+ New Column</button>
</div>
<div style="font-size:12px;color:var(--tm);font-family:var(--mf)">${S.wsD.length} rows · ${S.wsC.length} columns</div>
</div></div>`);
H('#wtb',`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Table (${rows.length})</h4><span style="color:var(--tm)">▾</span></div><div class="sb"><div style="overflow:auto;max-height:250px"><table class="dt"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,200).map(r=>`<tr>${cols.map(c=>`<td>${r[c]!=null?r[c]:''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`);
const ct=[['scatter','Scatter'],['line','Line'],['bar','Bar'],['histogram','Hist'],['box','Box'],['violin','Violin'],['heatmap','Corr'],['scatter3d','3D'],['bubble','Bubble'],['area','Area']];
H('#wch',`<div class="sec"><div class="sh"><h4>Chart</h4></div><div class="sb"><div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px">${ct.map(([k,l])=>`<button class="bt sm ${S.cT===k?'on':''}" onclick="S.cT='${k}';renderWP()">${l}</button>`).join('')}</div><div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">X:</span><select class="fs" onchange="S.xC=this.value;rPC()">${cols.map(c=>`<option value="${c}" ${S.xC===c?'selected':''}>${c}</option>`).join('')}</select><span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Y:</span>${nc.map((c,i)=>`<button class="bt sm ${S.yC.includes(c)?'on':''}" style="${S.yC.includes(c)?`border-color:${CL[i%8]}55;background:${CL[i%8]}18;color:${CL[i%8]}`:''}" onclick="toggleY('${c}')">${c}</button>`).join('')}${S.cT==='scatter3d'?`<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Z:</span><select class="fs" onchange="S.zC=this.value;rPC()">${cols.map(c=>`<option value="${c}" ${S.zC===c?'selected':''}>${c}</option>`).join('')}</select>`:''}<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Color:</span><select class="fs" id="wsColorBy" onchange="S._colorBy=this.value;rPC()"><option value="">None</option>${cols.filter(c=>S.wsCT[c]==='categorical').map(c=>'<option value="'+c+'"'+(S._colorBy===c?' selected':'')+'>'+c+'</option>').join('')}</select><button class="bt sm" onclick="exportChart('wpl')" style="margin-left:auto">📷 Save Chart</button></div><div class="pcc" id="wpl" style="height:370px"></div></div></div>`);setTimeout(rPC,50);
H('#wex',`<div class="sec"><div class="sh"><h4>Export</h4></div><div class="sb"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt sm on" onclick="xCSV()">CSV</button><button class="bt sm" onclick="xR()">R (ggplot2)</button><button class="bt sm" onclick="xPy()">Python (seaborn)</button><button class="bt sm" onclick="xTSV()">TSV</button><button class="bt sm" onclick="xJSON()">JSON</button>
<button class="bt sm" onclick="saveSession()" title="Save current session">💾 Save Session</button>
<button class="bt sm" onclick="loadSession()" title="Load saved session">📂 Load Session</button></div><div style="display:flex;gap:6px;margin-top:10px"><button class="bt sm" style="color:var(--co)" onclick="S.wsD=[];S.wsC=[];initWS()">Clear Workshop</button><button class="bt sm" onclick="mergeToWS()">Merge (append new data)</button></div></div></div>`);
H('#wtests',`<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"><h4>Statistical Tests</h4><span style="color:var(--tm)">▾</span></div><div class="sb" id="wtest-body">
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runPearson()">Pearson Correlation</button>
<button class="bt sm" onclick="runSpearmanMatrix()">Spearman Correlation</button>
<button class="bt sm" onclick="runCorrelationMatrix()">Correlation Matrix</button>
<button class="bt sm" onclick="runMannKendall()">Mann-Kendall Trend</button>
<button class="bt sm" onclick="runTTest()">Two-Sample t-test</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Community Ecology</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runDiversity()">Diversity Indices</button>
<button class="bt sm" onclick="runRarefaction()">Rarefaction Curve</button>
<button class="bt sm" onclick="runDissimilarity()">Dissimilarity Matrix</button>
<button class="bt sm" onclick="runNMDS()">NMDS Ordination</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Fisheries Models</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runVBGF()">Von Bertalanffy Growth</button>
<button class="bt sm" onclick="runLengthFreq()">Length-Frequency</button>
<button class="bt sm" onclick="runCatchCurve()">Catch Curve / Mortality</button>
<button class="bt sm" onclick="runSurplusProduction()">Surplus Production (Schaefer)</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Multivariate</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runPCA()">PCA</button>
<button class="bt sm" onclick="runPERMANOVA()">PERMANOVA</button>
<button class="bt sm" onclick="runANOSIM()">ANOSIM</button>
<button class="bt sm" onclick="runIndicatorSpecies()">Indicator Species</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Time Series & Temporal</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runACF()">ACF / PACF</button>
<button class="bt sm" onclick="runRegimeShift()">Regime Shift (STARS)</button>
<button class="bt sm" onclick="runKruskalWallis()">Kruskal-Wallis</button>
<button class="bt sm" onclick="runChiSquared()">Chi-Squared</button>
<button class="bt sm" onclick="runPowerAnalysis()">Power Analysis</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Fisheries Advanced</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runWeightLength()">Weight-Length (W=aLb)</button>
<button class="bt sm" onclick="runSelectivity()">Selectivity Curve</button>
<button class="bt sm" onclick="runYPR()">Yield-per-Recruit</button>
<button class="bt sm" onclick="runStockRecruitment()">Stock-Recruitment</button>
<button class="bt sm" onclick="runMaturityOgive()">Maturity Ogive</button>
<button class="bt sm" onclick="runMarkRecapture()">Mark-Recapture</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Normality & Group Comparison</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runWSShapiroWilk()">Shapiro-Wilk</button>
<button class="bt sm" onclick="runWSAnova()">One-Way ANOVA</button>
<button class="bt sm" onclick="runWSExpandedPower()">Power Analysis (Expanded)</button>
<button class="bt sm" onclick="runWSGLM()">GLM</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Ecology & Genetics</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runWSDiversity()">Shannon/Simpson Diversity</button>
<button class="bt sm" onclick="runWSRarefaction()">Rarefaction Curve</button>
<button class="bt sm" onclick="runWSHardyWeinberg()">Hardy-Weinberg</button>
<button class="bt sm" onclick="runWSFStats()">F-Statistics (Fst)</button>
<button class="bt sm" onclick="runWSPopDyn()">Population Dynamics</button>
</div>
<div style="font-size:11px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;letter-spacing:.5px">Forecasting</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button class="bt sm" onclick="runWSForecast()">Holt-Winters Forecast</button>
</div>
<div style="margin-top:6px"><span style="font-size:10px;color:var(--tm);letter-spacing:1px">Meta-Analysis & QC</span></div>
<button class="bt sm" onclick="runMetaAnalysis()">Meta-Analysis (RE)</button>
<button class="bt sm" onclick="runFunnelPlot()">Funnel Plot</button>
<button class="bt sm" onclick="detectDataQuality()">Data Quality Check</button>
<button class="bt sm" onclick="exportSVG()">Export SVG</button>
<div style="margin-top:6px"><span style="font-size:10px;color:var(--tm);letter-spacing:1px">Modeling & Simulation</span></div>
<button class="bt sm" onclick="runSDM()">Habitat Suitability (SDM)</button>
<button class="bt sm" onclick="runTrophicNetwork()">Trophic Network</button>
<button class="bt sm" onclick="runLarvalDispersal()">Larval Dispersal</button>
<div style="margin-top:8px;border-top:1px solid var(--brd);padding-top:8px"><button class="bt" style="width:100%;background:var(--s2)" onclick="openMethodWizard()">🧭 Method Selector Wizard</button></div>
<div id="wtest-result" style="font-size:13px;color:var(--ts);font-family:var(--mf)"></div>
</div></div>`);
_enhanceStatGrid();
_enhanceWorkshop();
}
/* ── 2E: Analysis Tools Grid Enhancement ── */
const _STAT_TOOLTIPS={
'Pearson r':'Measures linear correlation between two continuous variables (−1 to +1). Assumes normality and homoscedasticity.',
'Spearman ρ':'Rank-based monotonic correlation. Robust to non-normality and outliers; ideal for ordinal data.',
'Correlation Matrix':'Pairwise correlation heatmap across all numeric columns. Quickly reveals collinear predictors.',
'Mann-Kendall':'Non-parametric trend test for monotonic increases or decreases in time series data.',
't-test':'Compares means of two groups assuming approximate normality. Reports p-value, effect size (Cohen\'s d), and CI.',
'Diversity':'Shannon (H′) and Simpson (1−D) diversity indices for community composition data.',
'Rarefaction':'Estimates expected species richness at standardised sample sizes; compare sites with unequal effort.',
'Dissimilarity':'Bray-Curtis or Jaccard dissimilarity between sites/samples based on species abundances.',
'NMDS':'Non-metric multidimensional scaling — ordination that preserves rank-order distances in 2-D.',
'VBGF':'Von Bertalanffy Growth Function — fits L∞, K, and t₀ to length-at-age data for fish growth modelling.',
'Length-Freq':'Length-frequency histogram with optional modal progression analysis (Bhattacharya method).',
'Catch Curve':'Age- or length-based catch curve to estimate total instantaneous mortality (Z).',
'Surplus Prod':'Schaefer or Fox surplus-production model — estimates MSY, B_MSY, and F_MSY from catch and effort.',
'PCA':'Principal Component Analysis — reduces dimensionality and reveals dominant gradients in multivariate data.',
'PERMANOVA':'Permutational MANOVA — tests multivariate group differences using distance matrices; non-parametric.',
'ANOSIM':'Analysis of Similarities — tests whether between-group dissimilarity exceeds within-group dissimilarity.',
'Indicator Spp':'Indicator Species Analysis (IndVal) — identifies taxa significantly associated with site groups.',
'ACF / PACF':'Auto- and partial-autocorrelation plots to diagnose temporal dependence and guide ARIMA model selection.',
'Regime Shift':'Sequential t-test (STARS) algorithm to detect abrupt shifts in mean level of a time series.',
'Kruskal-Wallis':'Non-parametric one-way ANOVA by ranks — compares medians of ≥3 independent groups.',
'Chi-Squared':'Tests independence between two categorical variables using a contingency table.',
'Power Analysis':'Estimates required sample size, detectable effect size, or achievable power for a planned study design.',
'Weight-Length':'Fits W = a·Lᵇ allometric relationship; reports a, b, r², and condition indices.',
'Selectivity':'Estimates gear selectivity curve (logistic or normal) from catch-at-length data.',
'Yield per Recruit':'Beverton-Holt YPR model — evaluates yield trade-offs across fishing mortality and age at first capture.',
'Stock-Recruit':'Fits Ricker or Beverton-Holt stock-recruitment curves; estimates steepness and unfished recruitment.',
'Maturity Ogive':'Logistic regression of maturity stage on length or age to estimate L₅₀ / A₅₀.',
'Mark-Recapture':'Lincoln-Petersen, Schnabel, or Jolly-Seber abundance estimators from capture-recapture data.',
'Shapiro-Wilk':'Tests whether a sample comes from a normal distribution. Essential pre-check for parametric tests.',
'ANOVA':'One-way Analysis of Variance — compares means of ≥3 groups; reports F-statistic and post-hoc tests.',
'Power (Expanded)':'Extended power analysis with multiple test families: t-test, ANOVA, correlation, regression.',
'GLM':'Generalised Linear Model — fits Gaussian, Poisson, Binomial, or Gamma families with link functions.',
'Shannon/Simpson':'Computes Shannon H′, Simpson 1−D, and evenness from species-by-site abundance data.',
'Rarefaction (Eco)':'Individual- and sample-based rarefaction with extrapolation and 95% confidence bands.',
'Hardy-Weinberg':'Chi-squared test of Hardy-Weinberg equilibrium for genotype frequency data at one locus.',
'F-Statistics':'Hierarchical F-statistics (F_IS, F_ST, F_IT) for population genetic structure analysis.',
'Pop Dynamics':'Discrete logistic population growth model with harvest — projects N(t) under varying F scenarios.',
'Holt-Winters':'Triple exponential smoothing for seasonal time-series forecasting with trend and seasonality.',
'Meta RE':'Random-effects meta-analysis — pools effect sizes across studies with DerSimonian-Laird estimator.',
'Funnel Plot':'Plots effect size vs precision to visually detect publication bias; includes Egger\'s regression test.',
'Data Quality':'Audits dataset completeness, detects outliers (IQR & Z-score), and flags suspicious patterns.',
'Export SVG':'Exports the current chart as a publication-ready SVG vector graphic.',
'SDM':'Species Distribution Model — fits presence/absence or abundance to environmental predictors (GLM/GAM).',
'Trophic Network':'Builds a food-web network diagram from predator-prey or diet composition data.',
'Larval Dispersal':'Simple 2-D advection-diffusion particle tracking model for larval connectivity estimation.'
};
const _pinnedTests=JSON.parse(localStorage.getItem('meridian_pinned_tests')||'[]');
function _enhanceStatGrid(){
const wrap=$('#wtest-body');if(!wrap)return;
/* search bar */
let sb=wrap.querySelector('.stat-search');
if(!sb){sb=document.createElement('div');sb.className='stat-search';sb.style.cssText='margin-bottom:10px';sb.innerHTML='<input class="si" placeholder="Search tests\u2026" style="width:100%;font-size:13px" oninput="_filterStatTests(this.value)">';wrap.prepend(sb)}
/* pinned row */
_buildPinRow(wrap);
/* tooltips + header restyle */
const btns=wrap.querySelectorAll('button.bt.sm');
btns.forEach(b=>{const nm=b.textContent.trim().replace(/^[\u{1F4CA}\u{1F9EA}\u{1F4D0}\u{1F30A}\u{1F3AF}\u{1F52C}\u{1F4C8}\u{2696}\u{1F333}\u{1F9EC}\u{1F52E}\u{1F9F0}\u{2699}\u{FE0F}\u{26A1}\u{1F4C9}\u{1F4D1}\u{1F4BE}\u{1F3A8}\u{2728}\u{1F4DD}\u{1F4C3}]\s*/u,'');
const tip=_STAT_TOOLTIPS[nm];if(tip){b.classList.add('m-tip');b.setAttribute('data-tip',tip)}
b.addEventListener('contextmenu',e=>{e.preventDefault();_pinTest(nm)})});
/* category headers */
wrap.querySelectorAll('div[style*="letter-spacing"]').forEach(h=>{if(h.querySelector('button'))return;h.classList.add('stat-cat-hdr');h.style.cssText='font-weight:600;font-size:13px;color:var(--ac);font-family:var(--mf);margin:10px 0 4px;padding-left:12px;border-left:3px solid var(--ac);letter-spacing:.5px'});
}
function _filterStatTests(q){const wrap=$('#wtest-body');if(!wrap)return;const lq=q.toLowerCase();
wrap.querySelectorAll('button.bt.sm').forEach(b=>{const nm=b.textContent.toLowerCase();const tip=(b.getAttribute('data-tip')||'').toLowerCase();b.style.display=(nm.includes(lq)||tip.includes(lq))?'':'none'});
wrap.querySelectorAll('.stat-cat-hdr').forEach(h=>{const sec=h.nextElementSibling;if(!sec)return;const vis=[...sec.querySelectorAll('button.bt.sm')].some(b=>b.style.display!=='none');h.style.display=vis?'':'none'})}
function _pinTest(name){const i=_pinnedTests.indexOf(name);if(i>-1){_pinnedTests.splice(i,1)}else{if(_pinnedTests.length>=8)return;_pinnedTests.push(name)}
localStorage.setItem('meridian_pinned_tests',JSON.stringify(_pinnedTests));const wrap=$('#wtest-body');if(wrap)_buildPinRow(wrap)}
function _buildPinRow(wrap){let row=wrap.querySelector('.stat-pinned');
if(!_pinnedTests.length){if(row)row.remove();return}
if(!row){row=document.createElement('div');row.className='stat-pinned';row.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:8px;margin-bottom:8px;border-radius:var(--rd);background:var(--s2);border:1px dashed var(--ac)';const sb=wrap.querySelector('.stat-search');if(sb)sb.after(row);else wrap.prepend(row)}
row.innerHTML='<span style="font-size:11px;color:var(--tm);width:100%;margin-bottom:2px">📌 Pinned Tests (right-click to unpin)</span>'+_pinnedTests.map(nm=>{const allBtns=[...wrap.querySelectorAll('button.bt.sm')];const src=allBtns.find(b=>b.textContent.trim().replace(/^[\u{1F4CA}\u{1F9EA}\u{1F4D0}\u{1F30A}\u{1F3AF}\u{1F52C}\u{1F4C8}\u{2696}\u{1F333}\u{1F9EC}\u{1F52E}\u{1F9F0}\u{2699}\u{FE0F}\u{26A1}\u{1F4C9}\u{1F4D1}\u{1F4BE}\u{1F3A8}\u{2728}\u{1F4DD}\u{1F4C3}]\s*/u,'')===nm);
if(!src)return'';const cl=src.cloneNode(true);cl.addEventListener('contextmenu',e=>{e.preventDefault();_pinTest(nm)});return cl.outerHTML}).join('')}
/* ── end 2E ── */
/* ── 2H: Workshop Enhancement ── */
const _WS_TITLES={'Stats':'Summary Statistics','Clean & Transform':'Clean & Transform','Export':'Export Data','Chart':'Chart','Statistical Tests':'Statistical Tests'};
function _enhanceWorkshop(){
const con=$('#wcon');if(!con)return;
/* Title Case headers & chevrons */
con.querySelectorAll('.sec > .sh').forEach(sh=>{
  const h4=sh.querySelector('h4');if(!h4)return;
  const key=h4.textContent.replace(/\s*\(.*\)/,'').trim();
  if(_WS_TITLES[key])h4.textContent=h4.textContent.replace(key,_WS_TITLES[key]);
  /* replace text ▾ with SVG chevron */
  const arrow=sh.querySelector('span[style*="color:var(--tm)"]');
  if(arrow&&arrow.textContent.trim()==='▾'){arrow.className='sh-chevron';arrow.innerHTML='<svg viewBox="0 0 10 6" width="10" height="6"><polyline points="1,1 5,5 9,1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'}
});
/* Zebra striping on data table */
con.querySelectorAll('table.dt tbody tr').forEach((tr,i)=>{tr.style.background=i%2?'var(--s2)':''});
/* Style file drop zone */
const drop=$('#wsDrop');
if(drop){drop.style.borderColor='var(--ab)';drop.style.borderRadius='var(--rd)';drop.style.padding='24px 18px'}
}
/* ── end 2H ── */
function toggleY(c){if(S.yC.includes(c))S.yC=S.yC.filter(x=>x!==c);else S.yC.push(c);rPC()}
function mergeToWS(){const raw=prompt('Paste CSV to merge (same columns, or new columns will be added):');if(!raw)return;const lines=raw.trim().split('\n');if(lines.length<2)return;const hd=parseCSVLine(lines[0]).map(h=>h.trim());const newRows=lines.slice(1).map(l=>{const vs=parseCSVLine(l).map(v=>v.trim());const o={};hd.forEach((h,i)=>{const v=vs[i]||'';o[h]=isNaN(v)||v===''?v:parseFloat(v)});return o});const allCols=[...new Set([...S.wsC,...hd])];S.wsC=allCols;S.wsD=[...S.wsD,...newRows];autoTypes();initWS()}
function rPC(){const el=$('#wpl');if(!el)return;const rows=S.wsD,xC=S.xC,yC=S.yC,ct=S.cT;if(!rows.length||(!yC.length&&ct!=='histogram')){el.innerHTML='<p style="text-align:center;color:var(--tm);padding:40px">Select columns.</p>';return}
// Filter out rows with null values in selected columns
const clean=rows.filter(r=>{if(ct==='histogram')return r[yC[0]||xC]!=null;return yC.every(c=>r[c]!=null)&&r[xC]!=null});
if(!clean.length){el.innerHTML='<p style="text-align:center;color:var(--tm);padding:40px">No valid data for selected columns.</p>';return}
const L={...PL,height:370};
// Auto-detect if x-axis is date
const isDate=S.wsCT[xC]==='datetime'||clean.every(r=>typeof r[xC]==='string'&&/^\d{4}-\d{2}/.test(r[xC]));
if(isDate)L.xaxis={...PL.xaxis,type:'date'};
let tr=[];
if('scatter line area'.includes(ct)){const colorBy=S._colorBy||'';
  if(colorBy&&yC.length===1){const groups={};clean.forEach(r=>{const g=r[colorBy]||'Other';if(!groups[g])groups[g]=[];groups[g].push(r)});
    Object.keys(groups).forEach((g,i)=>{const gd=groups[g];tr.push({x:gd.map(r=>r[xC]),y:gd.map(r=>r[yC[0]]),type:'scatter',mode:ct==='scatter'?'markers':'lines',fill:ct==='area'?'tozeroy':undefined,name:g,marker:{color:CL[i%8]},line:{color:CL[i%8],width:2}})})}
  else{yC.forEach((c,i)=>{tr.push({x:clean.map(r=>r[xC]),y:clean.map(r=>r[c]),type:'scatter',mode:ct==='scatter'?'markers':'lines',fill:ct==='area'?'tozeroy':undefined,name:c,marker:{color:CL[i%8]},line:{color:CL[i%8],width:2}})})}}
else if(ct==='bar'){yC.forEach((c,i)=>{tr.push({x:clean.map(r=>r[xC]),y:clean.map(r=>r[c]),type:'bar',name:c,marker:{color:CL[i%8]}})})}
else if(ct==='histogram'){tr.push({x:clean.map(r=>r[yC[0]||xC]),type:'histogram',marker:{color:CL[0]}})}
else if(ct==='box'){yC.forEach((c,i)=>{tr.push({y:clean.map(r=>r[c]),type:'box',name:c,marker:{color:CL[i%8]},boxmean:'sd'})})}
else if(ct==='violin'){yC.forEach((c,i)=>{tr.push({y:clean.map(r=>r[c]),type:'violin',name:c,marker:{color:CL[i%8]},box:{visible:true},meanline:{visible:true}})})}
else if(ct==='heatmap'){const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');if(nc.length<2)return;const co=[];nc.forEach(c1=>{const row=[];nc.forEach(c2=>{const pairs=clean.filter(r=>r[c1]!=null&&r[c2]!=null);const n=pairs.length;if(n<2){row.push(0);return}const m1=pairs.reduce((s,r)=>s+r[c1],0)/n,m2=pairs.reduce((s,r)=>s+r[c2],0)/n;const num=pairs.reduce((s,r)=>s+(r[c1]-m1)*(r[c2]-m2),0);const d1=Math.sqrt(pairs.reduce((s,r)=>s+(r[c1]-m1)**2,0)),d2=Math.sqrt(pairs.reduce((s,r)=>s+(r[c2]-m2)**2,0));row.push(d1&&d2?+(num/(d1*d2)).toFixed(3):0)});co.push(row)});tr.push({z:co,x:nc,y:nc,type:'heatmap',colorscale:[[0,'#C27878'],[.5,'#302E40'],[1,'#7B9E87']],zmin:-1,zmax:1,text:co.map(r=>r.map(v=>v.toFixed(2))),texttemplate:'%{text}'})}
else if(ct==='scatter3d'){const zC=S.zC||yC[1]||yC[0];tr.push({x:clean.map(r=>r[xC]),y:clean.map(r=>r[yC[0]]),z:clean.map(r=>r[zC]),type:'scatter3d',mode:'markers',marker:{color:clean.map(r=>r[yC[0]]),colorscale:'Viridis',size:5,showscale:true}});L.scene={xaxis:{title:xC},yaxis:{title:yC[0]},zaxis:{title:zC},bgcolor:'#302E40'}}
else if(ct==='bubble'){const sC=yC[1]||yC[0];tr.push({x:clean.map(r=>r[xC]),y:clean.map(r=>r[yC[0]]),mode:'markers',marker:{size:clean.map(r=>Math.max(5,Math.abs(r[sC])||5)),sizemode:'area',sizeref:2*Math.max(...clean.map(r=>Math.abs(r[sC])||1))/(40**2),color:clean.map(r=>r[yC[0]]),colorscale:'Viridis',showscale:true}})}
Plotly.newPlot(el,tr,L,{responsive:true});
// Regression panel
if((ct==='scatter'||ct==='line')&&yC.length>=1&&S.wsCT[xC]!=='categorical'&&S.wsCT[xC]!=='datetime'){
  const xs=clean.map(r=>r[xC]),ys=clean.map(r=>r[yC[0]]);
  const n=xs.length,sx=xs.reduce((a,v)=>a+v,0),sy=ys.reduce((a,v)=>a+v,0);
  const mx=sx/n,my=sy/n;
  const sxy=xs.reduce((a,v,i)=>a+(v-mx)*(ys[i]-my),0);
  const sxx=xs.reduce((a,v)=>a+(v-mx)**2,0),syy=ys.reduce((a,v)=>a+(v-my)**2,0);
  if(sxx>0){
    const b=sxy/sxx,a=my-b*mx,r2=sxx&&syy?(sxy**2)/(sxx*syy):0;
    const se=Math.sqrt(Math.max(0,ys.reduce((s,v,i)=>s+(v-(a+b*xs[i]))**2,0)/(n-2))/sxx);
    const t=se>0?Math.abs(b/se):0;
    const pApprox=n>3?pFromT(t,n-2):1;
    const pStr=pApprox<0.001?'<0.001':pApprox.toFixed(3);
    const el2=$('#wstat');if(el2)el2.innerHTML=`<div class="sec" style="margin-top:10px"><div class="sh"><h4>Regression: ${yC[0]} ~ ${xC}</h4></div><div class="sb"><div style="display:flex;gap:18px;flex-wrap:wrap;font-family:var(--mf);font-size:13px"><div><span style="color:var(--tm)">Slope:</span> <b style="color:var(--ac)">${b.toFixed(4)}</b></div><div><span style="color:var(--tm)">Intercept:</span> <b>${a.toFixed(4)}</b></div><div><span style="color:var(--tm)">R²:</span> <b style="color:${r2>0.7?'var(--sg)':r2>0.4?'var(--wa)':'var(--co)'}">${r2.toFixed(4)}</b></div><div><span style="color:var(--tm)">n:</span> ${n}</div><div><span style="color:var(--tm)">p-value:</span> <b style="color:${parseFloat(pStr)<0.05?'var(--sg)':'var(--co)'}">${pStr}</b></div></div><div style="font-size:11px;color:var(--tm);margin-top:6px">y = ${b.toFixed(4)}x + ${a.toFixed(4)} · p-value is approximate</div></div></div>`;
    const xmin=Math.min(...xs),xmax=Math.max(...xs);
    Plotly.addTraces(el,[{x:[xmin,xmax],y:[a+b*xmin,a+b*xmax],type:'scatter',mode:'lines',line:{color:'rgba(255,255,255,0.5)',width:1.5,dash:'dash'},name:'Regression',showlegend:false}]);
  }
}else{const el2=$('#wstat');if(el2)el2.innerHTML=''}
}
function xCSV(){dl([S.wsC.join(','),...S.wsD.map(r=>S.wsC.map(c=>typeof r[c]==='string'&&String(r[c]).includes(',')?'"'+r[c]+'"':r[c]??'').join(','))].join('\n'),'meridian.csv','text/csv')}
function xTSV(){dl([S.wsC.join('\t'),...S.wsD.map(r=>S.wsC.map(c=>r[c]??'').join('\t'))].join('\n'),'meridian.tsv','text/tab-separated-values')}
function xJSON(){dl(JSON.stringify({columns:S.wsC,data:S.wsD},null,2),'meridian.json','application/json')}
let _testHistory=[];
function logTest(name,params){_testHistory.push({name,params,timestamp:new Date().toISOString()})}
function xR(){const c=S.wsC,d=S.wsD,nc=c.filter(x=>S.wsCT[x]==='continuous'||S.wsCT[x]==='ordinal'),dc=c.filter(x=>S.wsCT[x]==='datetime');
const l=['library(tidyverse)\nlibrary(ggplot2)\n\ndata <- tibble('];c.forEach((col,i)=>{l.push(`  \`${col}\` = c(${d.map(r=>typeof r[col]==='string'?`"${r[col]}"`:r[col]??'NA').join(', ')})${i<c.length-1?',':''}`)});l.push(')\n');
if(dc.length)l.push(`data <- data %>% mutate(\`${dc[0]}\` = as.Date(\`${dc[0]}\`))\n`);
l.push('summary(data)\n');
if(nc.length>=2)l.push(`# Scatter with regression\nggplot(data, aes(x = \`${nc[0]}\`, y = \`${nc[1]}\`)) +\n  geom_point(color = "#C9956B", alpha = 0.7, size = 2) +\n  geom_smooth(method = "lm", color = "#7B9E87", se = TRUE) +\n  labs(title = "Meridian Export", x = "${nc[0]}", y = "${nc[1]}") +\n  theme_minimal(base_family = "sans") +\n  theme(plot.background = element_rect(fill = "#F8F6F3"))\n`);
if(nc.length>=2)l.push(`# Correlation matrix\ncor_mat <- cor(data %>% select(${nc.map(x=>`\`${x}\``).join(', ')}), use = "complete.obs")\nprint(round(cor_mat, 3))\n`);
if(dc.length&&nc.length)l.push(`# Time series facet\ndata %>%\n  pivot_longer(c(${nc.slice(0,4).map(x=>`\`${x}\``).join(', ')}), names_to = "variable", values_to = "value") %>%\n  ggplot(aes(x = \`${dc[0]}\`, y = value, color = variable)) +\n  geom_line(linewidth = 0.7) +\n  facet_wrap(~variable, scales = "free_y", ncol = 1) +\n  theme_minimal() + theme(legend.position = "none")\n`);
// Append statistical test code from history
if(_testHistory.length){l.push('\n# ═══ Statistical Tests (from your Meridian session) ═══\n');
  _testHistory.forEach(t=>{if(t.name==='pearson'&&nc.length>=2)l.push(`# Pearson correlation\ncor.test(data$\`${nc[0]}\`, data$\`${nc[1]}\`, method = "pearson")\n`);
    if(t.name==='spearman'&&nc.length>=2)l.push(`# Spearman correlation\ncor.test(data$\`${nc[0]}\`, data$\`${nc[1]}\`, method = "spearman")\n`);
    if(t.name==='mannkendall')l.push(`# Mann-Kendall trend test\nlibrary(trend)\n${nc.slice(0,3).map(x=>`mk.test(data$\`${x}\`)`).join('\n')}\n`);
    if(t.name==='ttest'){const cat=c.filter(x=>S.wsCT[x]==='categorical');if(cat.length&&nc.length)l.push(`# Two-sample t-test\nt.test(data$\`${nc[0]}\` ~ data$\`${cat[0]}\`)\n`)}})}
dl(l.join('\n'),'meridian.R','text/plain')}
function xPy(){const c=S.wsC,d=S.wsD,nc=c.filter(x=>S.wsCT[x]==='continuous'||S.wsCT[x]==='ordinal'),dc=c.filter(x=>S.wsCT[x]==='datetime');
const l=['import pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nimport numpy as np\n\ndata = {'];c.forEach(col=>{l.push(`    "${col}": [${d.map(r=>typeof r[col]==='string'?`"${r[col]}"`:r[col]??'None').join(', ')}],`)});l.push('}\ndf = pd.DataFrame(data)\n');
if(dc.length)l.push(`df["${dc[0]}"] = pd.to_datetime(df["${dc[0]}"])\n`);
l.push('print(df.describe())\n');
if(nc.length>=2)l.push(`# Correlation heatmap\nplt.figure(figsize=(10, 8))\nsns.heatmap(df[${JSON.stringify(nc)}].corr(), annot=True, cmap="RdYlGn", center=0,\n            square=True, linewidths=0.5)\nplt.title("Correlation Matrix — Meridian Export")\nplt.tight_layout()\nplt.savefig("meridian_correlation.png", dpi=150)\nplt.show()\n`);
if(nc.length>=2)l.push(`# Scatter with regression\nfig, ax = plt.subplots(figsize=(8, 6))\nsns.regplot(data=df, x="${nc[0]}", y="${nc[1]}", color="#C9956B",\n           scatter_kws={"alpha": 0.7}, line_kws={"color": "#7B9E87"})\nplt.title("${nc[0]} vs ${nc[1]}")\nplt.tight_layout()\nplt.savefig("meridian_scatter.png", dpi=150)\nplt.show()\n`);
if(dc.length&&nc.length>=2)l.push(`# Multi-panel time series\nncols = ${JSON.stringify(nc.slice(0,4))}\nfig, axes = plt.subplots(len(ncols), 1, figsize=(12, len(ncols)*3), sharex=True)\nif len(ncols)==1: axes=[axes]\nfor i, col in enumerate(ncols):\n    axes[i].plot(df["${dc[0]}"], df[col], linewidth=0.8)\n    axes[i].set_ylabel(col)\n    axes[i].grid(True, alpha=0.3)\nplt.tight_layout()\nplt.savefig("meridian_timeseries.png", dpi=150)\nplt.show()\n`);
if(_testHistory.length){l.push('\n# ═══ Statistical Tests (from your Meridian session) ═══\nfrom scipy import stats\n');
  _testHistory.forEach(t=>{if(t.name==='pearson'&&nc.length>=2)l.push(`# Pearson correlation\nr, p = stats.pearsonr(df["${nc[0]}"].dropna(), df["${nc[1]}"].dropna())\nprint(f"Pearson r={r:.4f}, p={p:.4f}")\n`);
    if(t.name==='spearman'&&nc.length>=2)l.push(`# Spearman correlation\nrho, p = stats.spearmanr(df["${nc[0]}"].dropna(), df["${nc[1]}"].dropna())\nprint(f"Spearman rho={rho:.4f}, p={p:.4f}")\n`);
    if(t.name==='mannkendall')l.push(`# Mann-Kendall trend test\nimport pymannkendall as mk\n${nc.slice(0,3).map(x=>`result = mk.original_test(df["${x}"].dropna())\nprint(f"${x}: trend={result.trend}, p={result.p:.4f}, slope={result.slope:.4f}")`).join('\n')}\n`);
    if(t.name==='ttest'){const cat=c.filter(x=>S.wsCT[x]==='categorical');if(cat.length&&nc.length)l.push(`# Two-sample t-test\ngroups = df.groupby("${cat[0]}")["${nc[0]}"].apply(list).values\nt, p = stats.ttest_ind(groups[0], groups[1], equal_var=False)\nprint(f"t={t:.4f}, p={p:.4f}")\n`)}})}
dl(l.join('\n'),'meridian.py','text/plain')}
function runPearson(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nc.length<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 numeric columns.</p>');
  logTest('pearson',{cols:nc});const rows=[];
  nc.forEach(c1=>{nc.forEach(c2=>{if(c1>=c2)return;
    const pairs=S.wsD.filter(r=>r[c1]!=null&&r[c2]!=null);const n=pairs.length;if(n<3)return;
    const mx=pairs.reduce((s,r)=>s+r[c1],0)/n,my=pairs.reduce((s,r)=>s+r[c2],0)/n;
    const num=pairs.reduce((s,r)=>s+(r[c1]-mx)*(r[c2]-my),0);
    const d1=Math.sqrt(pairs.reduce((s,r)=>s+(r[c1]-mx)**2,0)),d2=Math.sqrt(pairs.reduce((s,r)=>s+(r[c2]-my)**2,0));
    const rr=d1&&d2?num/(d1*d2):0;
    const t=Math.abs(rr)*Math.sqrt(n-2)/Math.sqrt(1-rr*rr+1e-10);
    const p=n>3?pFromT(t,n-2):1;
    rows.push({Var1:c1,Var2:c2,r:rr.toFixed(4),p:p<0.001?'<0.001':p.toFixed(3),n,sig:p<0.05?'*':'ns'});
  })});
  H('#wtest-result',`<table class="dt"><thead><tr><th>Var 1</th><th>Var 2</th><th>r</th><th>p-value</th><th>n</th><th>Sig</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.Var1}</td><td>${r.Var2}</td><td style="color:${Math.abs(parseFloat(r.r))>0.7?'var(--sg)':Math.abs(parseFloat(r.r))>0.4?'var(--wa)':'var(--tx)'}">${r.r}</td><td style="color:${r.sig==='*'?'var(--sg)':'var(--co)'}">${r.p}</td><td>${r.n}</td><td>${r.sig}</td></tr>`).join('')}</tbody></table><p style="font-size:11px;color:var(--tm);margin-top:6px">p-values are approximate</p>`)
}
function runMannKendall(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">No numeric columns.</p>');
  logTest('mannkendall',{cols:nc});const results=nc.map(col=>{
    const vals=S.wsD.map(r=>r[col]).filter(v=>typeof v==='number');
    if(vals.length<4)return null;
    let mk=0;
    for(let i=0;i<vals.length-1;i++)for(let j=i+1;j<vals.length;j++)mk+=Math.sign(vals[j]-vals[i]);
    const n=vals.length,vS=n*(n-1)*(2*n+5)/18;
    const z=mk===0||vS===0?0:(mk>0?(mk-1):(mk+1))/Math.sqrt(vS);
    const p=pFromZ(z);
    const trend=mk>0?'↑ Upward':mk<0?'↓ Downward':'→ No trend';
    return {col,S:mk,z:z.toFixed(3),p:p<0.001?'<0.001':p.toFixed(3),trend,sig:p<0.05?'*':'ns'};
  }).filter(Boolean);
  H('#wtest-result',`<table class="dt"><thead><tr><th>Variable</th><th>S</th><th>z</th><th>p-value</th><th>Trend</th><th>Sig</th></tr></thead><tbody>${results.map(r=>`<tr><td>${r.col}</td><td>${r.S}</td><td>${r.z}</td><td style="color:${r.sig==='*'?'var(--sg)':'var(--co)'}">${r.p}</td><td>${r.trend}</td><td>${r.sig}</td></tr>`).join('')}</tbody></table>`)
}
function runTTest(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const cat=S.wsC.filter(c=>S.wsCT[c]==='categorical');
  if(nc.length<1||cat.length<1)return H('#wtest-result','<p style="color:var(--co)">Need 1 categorical column (grouping) and 1 numeric column.</p>');
  logTest('ttest',{numCol:nc[0],catCol:cat[0]});const grpCol=cat[0],valCol=nc[0];
  const groups={};S.wsD.forEach(r=>{const g=r[grpCol];if(!groups[g])groups[g]=[];if(typeof r[valCol]==='number')groups[g].push(r[valCol])});
  const gk=Object.keys(groups).filter(k=>groups[k].length>=2);
  if(gk.length<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 groups with data in '+grpCol+'</p>');
  const g1=groups[gk[0]],g2=groups[gk[1]];
  const n1=g1.length,n2=g2.length;
  const m1=g1.reduce((a,v)=>a+v,0)/n1,m2=g2.reduce((a,v)=>a+v,0)/n2;
  const v1=g1.reduce((a,v)=>a+(v-m1)**2,0)/(n1-1),v2=g2.reduce((a,v)=>a+(v-m2)**2,0)/(n2-1);
  const se=Math.sqrt(v1/n1+v2/n2);
  const t=se>0?(m1-m2)/se:0;
  const df=se>0?(v1/n1+v2/n2)**2/((v1/n1)**2/(n1-1)+(v2/n2)**2/(n2-1)):1;
  const p=pFromT(Math.abs(t),Math.round(df));
  H('#wtest-result',`<div style="display:flex;gap:18px;flex-wrap:wrap;font-family:var(--mf)"><div><span style="color:var(--tm)">${gk[0]} mean:</span> <b>${m1.toFixed(4)}</b> (n=${n1})</div><div><span style="color:var(--tm)">${gk[1]} mean:</span> <b>${m2.toFixed(4)}</b> (n=${n2})</div><div><span style="color:var(--tm)">t:</span> <b>${t.toFixed(4)}</b></div><div><span style="color:var(--tm)">df:</span> ${df.toFixed(1)}</div><div><span style="color:var(--tm)">p-value:</span> <b style="color:${p<0.05?'var(--sg)':'var(--co)'}">${p<0.001?'<0.001':p.toFixed(3)}</b></div></div><p style="font-size:11px;color:var(--tm);margin-top:6px">Welch's t-test: ${gk[0]} vs ${gk[1]} on ${valCol}. p-value approximate.</p>`)
}
function runSpearmanMatrix(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nc.length<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 numeric columns.</p>');
  logTest('spearman',{cols:nc});const rows=[];
  nc.forEach(c1=>{nc.forEach(c2=>{if(c1>=c2)return;
    const pairs=S.wsD.filter(r=>r[c1]!=null&&r[c2]!=null);const n=pairs.length;if(n<3)return;
    const x=pairs.map(r=>r[c1]),y=pairs.map(r=>r[c2]);
    const rho=spearmanCorr(x,y);
    const t=Math.abs(rho)*Math.sqrt(n-2)/Math.sqrt(1-rho*rho+1e-10);
    const p=n>3?pFromT(t,n-2):1;
    rows.push({Var1:c1,Var2:c2,rho:rho.toFixed(4),p:p<0.001?'<0.001':p.toFixed(3),n,sig:p<0.05?'*':'ns'})})});
  H('#wtest-result',`<table class="dt"><thead><tr><th>Var 1</th><th>Var 2</th><th>ρ (Spearman)</th><th>p-value</th><th>n</th><th>Sig</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.Var1}</td><td>${r.Var2}</td><td style="color:${Math.abs(parseFloat(r.rho))>0.7?'var(--sg)':Math.abs(parseFloat(r.rho))>0.4?'var(--wa)':'var(--tx)'}">${r.rho}</td><td style="color:${r.sig==='*'?'var(--sg)':'var(--co)'}">${r.p}</td><td>${r.n}</td><td>${r.sig}</td></tr>`).join('')}</tbody></table><p style="font-size:11px;color:var(--tm);margin-top:6px">Spearman rank correlation. p-values approximate.</p>`)}
function runCorrelationMatrix(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nc.length<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 numeric columns.</p>');
  const useSpearman=confirm('Use Spearman rank correlation? (OK=Spearman, Cancel=Pearson)');
  const co=[],pvals=[];
  nc.forEach(c1=>{const row=[],prow=[];nc.forEach(c2=>{
    const pairs=S.wsD.filter(r=>r[c1]!=null&&r[c2]!=null);const n=pairs.length;
    if(n<3){row.push(0);prow.push(1);return}
    let rr;
    if(useSpearman){rr=spearmanCorr(pairs.map(r=>r[c1]),pairs.map(r=>r[c2]))}
    else{const m1=pairs.reduce((s,r)=>s+r[c1],0)/n,m2=pairs.reduce((s,r)=>s+r[c2],0)/n;
      const num=pairs.reduce((s,r)=>s+(r[c1]-m1)*(r[c2]-m2),0);
      const d1=Math.sqrt(pairs.reduce((s,r)=>s+(r[c1]-m1)**2,0)),d2=Math.sqrt(pairs.reduce((s,r)=>s+(r[c2]-m2)**2,0));
      rr=d1&&d2?num/(d1*d2):0}
    const t=Math.abs(rr)*Math.sqrt(n-2)/Math.sqrt(1-rr*rr+1e-10);
    const p=n>3?pFromT(t,n-2):1;
    row.push(+rr.toFixed(3));prow.push(p)});co.push(row);pvals.push(prow)});
  // Render as heatmap with p-value annotations
  const text=co.map((row,i)=>row.map((v,j)=>{const p=pvals[i][j];return v.toFixed(2)+(p<0.001?'***':p<0.01?'**':p<0.05?'*':'')}));
  H('#wtest-result',`<div class="pcc" id="corrMatPlot" style="height:400px"></div><div style="margin-top:6px;display:flex;gap:6px"><button class="bt sm" onclick="exportCorrMatrix()">Export CSV</button><button class="bt sm" onclick="exportChart('corrMatPlot')">Export PNG</button></div><p style="font-size:11px;color:var(--tm);margin-top:4px">${useSpearman?'Spearman':'Pearson'} correlation. ***p<0.001 **p<0.01 *p<0.05</p>`);
  window._corrMatrixData={nc,co,pvals,method:useSpearman?'Spearman':'Pearson'};
  setTimeout(()=>Plotly.newPlot('corrMatPlot',[{z:co,x:nc,y:nc,type:'heatmap',colorscale:[[0,'#C27878'],[.5,'#302E40'],[1,'#7B9E87']],zmin:-1,zmax:1,text,texttemplate:'%{text}',hovertemplate:'%{x} vs %{y}: %{z}<extra></extra>'}],{...PL,height:400,title:{text:(useSpearman?'Spearman':'Pearson')+' Correlation Matrix',font:{size:12}}},{responsive:true}),50)}
function exportCorrMatrix(){
  if(!window._corrMatrixData)return;const{nc,co}=window._corrMatrixData;
  const rows=[','+nc.join(','),...nc.map((n,i)=>n+','+co[i].join(','))];
  dl(rows.join('\n'),'correlation_matrix.csv','text/csv');toast('Correlation matrix exported','ok')}
// ═══ P3.1 DIVERSITY INDICES ═══
function runDiversity(){
  const cols=S.wsC;const catC=cols.filter(c=>S.wsCT[c]==='categorical');const numC=cols.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!catC.length||!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need at least 1 categorical column (species) and 1 numeric column (abundance).</p>');
  const specCol=catC[0],abunCol=numC[0];logTest('diversity',{specCol,abunCol});
  // Aggregate abundances per species
  const spp={};S.wsD.forEach(r=>{const sp=r[specCol];const n=r[abunCol];if(sp&&typeof n==='number'&&n>0){spp[sp]=(spp[sp]||0)+n}});
  const species=Object.keys(spp);const abundances=Object.values(spp);const N=abundances.reduce((a,v)=>a+v,0);const Srich=species.length;
  if(Srich<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 species.</p>');
  // Shannon-Wiener H'
  const H_prime=-abundances.reduce((s,n)=>{const p=n/N;return s+(p>0?p*Math.log(p):0)},0);
  // Simpson 1-D
  const simpson=1-abundances.reduce((s,n)=>s+(n*(n-1)),0)/(N*(N-1));
  // Pielou's evenness J
  const J=H_prime/Math.log(Srich);
  // Chao1 estimator
  const f1=abundances.filter(n=>n===1).length;const f2=abundances.filter(n=>n===2).length;
  const chao1=f2>0?Srich+f1*(f1-1)/(2*(f2+1)):Srich+f1*(f1-1)/2;
  H('#wtest-result',`<div class="eg" style="margin-bottom:12px">
  <div class="ec"><div class="el">Richness (S)</div><div class="ev">${Srich}</div></div>
  <div class="ec"><div class="el">Shannon H'</div><div class="ev">${H_prime.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Simpson 1-D</div><div class="ev">${simpson.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Pielou J</div><div class="ev">${J.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Chao1</div><div class="ev">${chao1.toFixed(1)}</div></div>
  <div class="ec"><div class="el">Total N</div><div class="ev">${N.toLocaleString()}</div></div></div>
  <p style="font-size:11px;color:var(--tm)">Species: ${specCol} · Abundance: ${abunCol} · ${Srich} species detected</p>
  <div style="margin-top:8px;font-family:var(--mf);font-size:12px;color:var(--ts)">
  <b>R:</b> <code>library(vegan); diversity(x, "shannon"); diversity(x, "simpson")</code><br>
  <b>Python:</b> <code>from skbio.diversity.alpha import shannon, simpson; shannon(x); simpson(x)</code></div>`)}
// ═══ P3.2 RAREFACTION CURVE ═══
function runRarefaction(){
  const cols=S.wsC;const catC=cols.filter(c=>S.wsCT[c]==='categorical');const numC=cols.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!catC.length)return H('#wtest-result','<p style="color:var(--co)">Need a species/taxon column.</p>');
  const specCol=catC[0];logTest('rarefaction',{specCol});
  // Build sample-level species lists: each row = 1 sample
  const samples=S.wsD.map(r=>r[specCol]).filter(Boolean);if(samples.length<5)return H('#wtest-result','<p style="color:var(--co)">Need at least 5 samples.</p>');
  // Random accumulation (100 permutations)
  const nPerm=100,nSamp=samples.length;const acc=Array.from({length:nSamp},()=>[]);
  for(let p=0;p<nPerm;p++){const shuffled=[...samples].sort(()=>Math.random()-.5);const seen=new Set();
  shuffled.forEach((sp,i)=>{seen.add(sp);acc[i].push(seen.size)})}
  const mean=acc.map(a=>a.reduce((s,v)=>s+v,0)/a.length);
  const sd=acc.map((a,i)=>{const m=mean[i];return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)});
  const x=Array.from({length:nSamp},(_, i)=>i+1);
  // Chao1 asymptote
  const allSpp={};samples.forEach(s=>{allSpp[s]=(allSpp[s]||0)+1});const counts=Object.values(allSpp);
  const f1=counts.filter(n=>n===1).length,f2=counts.filter(n=>n===2).length;
  const chao1=f2>0?Object.keys(allSpp).length+f1*(f1-1)/(2*(f2+1)):Object.keys(allSpp).length+f1*(f1-1)/2;
  H('#wtest-result',`<div class="pcc" id="rarefPlot" style="height:350px"></div><p style="font-size:11px;color:var(--tm);margin-top:6px">${nPerm} random permutations · Chao1 estimate: ${chao1.toFixed(1)} species · Observed: ${Object.keys(allSpp).length} species</p>`);
  setTimeout(()=>{Plotly.newPlot('rarefPlot',[
  {x,y:mean.map((m,i)=>m+1.96*sd[i]),type:'scatter',mode:'lines',line:{width:0},showlegend:false},
  {x,y:mean.map((m,i)=>Math.max(0,m-1.96*sd[i])),type:'scatter',mode:'lines',line:{width:0},fill:'tonexty',fillcolor:'rgba(201,149,107,.15)',showlegend:false},
  {x,y:mean,type:'scatter',mode:'lines',line:{color:'#C9956B',width:2},name:'Accumulation'},
  {x:[1,nSamp],y:[chao1,chao1],type:'scatter',mode:'lines',line:{color:'#7B9E87',width:1.5,dash:'dash'},name:'Chao1 ('+chao1.toFixed(0)+')'}
  ],{...PL,height:350,title:{text:'Species Accumulation / Rarefaction',font:{size:12}},xaxis:{...PL.xaxis,title:{text:'Samples',font:{size:11}}},yaxis:{...PL.yaxis,title:{text:'Species',font:{size:11}}}},{responsive:true})},100)}
// ═══ P3.3 COMMUNITY DISSIMILARITY ═══
function runDissimilarity(){
  const catC=S.wsC.filter(c=>S.wsCT[c]==='categorical');const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(catC.length<2||!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need: site column, species column, abundance column.</p>');
  const siteCol=catC[0],specCol=catC[1],abunCol=numC[0];logTest('dissimilarity',{siteCol,specCol,abunCol});
  // Build site-by-species matrix
  const sites=[...new Set(S.wsD.map(r=>r[siteCol]).filter(Boolean))];const spp=[...new Set(S.wsD.map(r=>r[specCol]).filter(Boolean))];
  if(sites.length<2||spp.length<2)return H('#wtest-result','<p style="color:var(--co)">Need at least 2 sites and 2 species.</p>');
  const matrix=sites.map(site=>spp.map(sp=>{const rows=S.wsD.filter(r=>r[siteCol]===site&&r[specCol]===sp);return rows.reduce((s,r)=>s+(typeof r[abunCol]==='number'?r[abunCol]:0),0)}));
  // Bray-Curtis dissimilarity
  const n=sites.length;const bc=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){let sumMin=0,sumTotal=0;
  for(let k=0;k<spp.length;k++){sumMin+=Math.min(matrix[i][k],matrix[j][k]);sumTotal+=matrix[i][k]+matrix[j][k]}
  const d=sumTotal>0?1-2*sumMin/sumTotal:0;bc[i][j]=+d.toFixed(3);bc[j][i]=+d.toFixed(3)}
  window._dissimMatrix={sites,bc};
  H('#wtest-result',`<div class="pcc" id="dissimPlot" style="height:400px"></div><p style="font-size:11px;color:var(--tm);margin-top:6px">Bray-Curtis dissimilarity · ${sites.length} sites × ${spp.length} species · Site: ${siteCol} · Species: ${specCol} · Abundance: ${abunCol}</p>`);
  setTimeout(()=>{Plotly.newPlot('dissimPlot',[{z:bc,x:sites,y:sites,type:'heatmap',colorscale:[[0,'#7B9E87'],[0.5,'#302E40'],[1,'#C27878']],zmin:0,zmax:1,text:bc.map(r=>r.map(v=>v.toFixed(2))),texttemplate:'%{text}'}],{...PL,height:400,title:{text:'Bray-Curtis Dissimilarity',font:{size:12}}},{responsive:true})},100)}
// ═══ P3.4 NMDS ORDINATION ═══
function runNMDS(){
  if(!window._dissimMatrix)return H('#wtest-result','<p style="color:var(--co)">Run Dissimilarity Matrix first.</p>');
  const{sites,bc}=window._dissimMatrix;const n=sites.length;
  if(n>100)return H('#wtest-result','<p style="color:var(--co)">NMDS limited to 100 sites for performance.</p>');
  logTest('nmds',{n});
  // Simple NMDS via Kruskal's iterative stress minimization
  let coords=sites.map(()=>[Math.random()*2-1,Math.random()*2-1]);
  const maxIter=200,lr=0.05;
  for(let iter=0;iter<maxIter;iter++){
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const dx=coords[i][0]-coords[j][0],dy=coords[i][1]-coords[j][1];
    const d=Math.sqrt(dx*dx+dy*dy+1e-10);const target=bc[i][j];const diff=(d-target)/d;
    const move=lr*diff;coords[i][0]-=move*dx/2;coords[i][1]-=move*dy/2;coords[j][0]+=move*dx/2;coords[j][1]+=move*dy/2}}
  // Compute stress
  let num=0,den=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const dx=coords[i][0]-coords[j][0],dy=coords[i][1]-coords[j][1];
  const d=Math.sqrt(dx*dx+dy*dy);num+=(d-bc[i][j])**2;den+=bc[i][j]**2}
  const stress=Math.sqrt(num/(den+1e-10));
  // Color by grouping if available
  const catC=S.wsC.filter(c=>S.wsCT[c]==='categorical');
  const groupCol=catC.length>2?catC[2]:null;
  const groups=groupCol?sites.map(s=>{const row=S.wsD.find(r=>r[catC[0]]===s);return row?row[groupCol]:'Unknown'}):sites.map(()=>'All');
  H('#wtest-result',`<div class="pcc" id="nmdsPlot" style="height:400px"></div><p style="font-size:11px;color:var(--tm);margin-top:6px">NMDS 2D · Stress: ${stress.toFixed(4)} · ${n} sites${stress<0.05?' (Excellent fit)':stress<0.1?' (Good fit)':stress<0.2?' (Acceptable)':' (Poor fit — interpret with caution)'}</p>`);
  setTimeout(()=>{const uniqueG=[...new Set(groups)];const traces=uniqueG.map((g,gi)=>{const idx=groups.map((gr,i)=>gr===g?i:-1).filter(i=>i>=0);
  return{x:idx.map(i=>coords[i][0]),y:idx.map(i=>coords[i][1]),text:idx.map(i=>sites[i]),type:'scatter',mode:'markers+text',textposition:'top center',textfont:{size:9,color:'var(--tm)'},marker:{size:10,color:CL[gi%8]},name:g}});
  Plotly.newPlot('nmdsPlot',traces,{...PL,height:400,title:{text:'NMDS Ordination (Stress: '+stress.toFixed(3)+')',font:{size:12}},xaxis:{...PL.xaxis,title:'NMDS1'},yaxis:{...PL.yaxis,title:'NMDS2'}},{responsive:true})},100)}
// ═══ P3.5 VON BERTALANFFY GROWTH ═══
function runVBGF(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need age and length columns (at least 2 numeric columns).</p>');
  const ageCol=numC[0],lenCol=numC[1];logTest('vbgf',{ageCol,lenCol});
  const data=S.wsD.filter(r=>typeof r[ageCol]==='number'&&typeof r[lenCol]==='number'&&r[ageCol]>=0).map(r=>({age:r[ageCol],len:r[lenCol]}));
  if(data.length<5)return H('#wtest-result','<p style="color:var(--co)">Need at least 5 data points.</p>');
  // Levenberg-Marquardt-style fitting: L(t) = Linf * (1 - exp(-K*(t-t0)))
  let Linf=Math.max(...data.map(d=>d.len))*1.1,K=0.2,t0=-0.5;
  const predict=(age,Li,Ki,ti)=>Li*(1-Math.exp(-Ki*(age-ti)));
  const sse=(Li,Ki,ti)=>data.reduce((s,d)=>s+(d.len-predict(d.age,Li,Ki,ti))**2,0);
  // Grid search + refinement
  let bestSSE=sse(Linf,K,t0);
  for(let li=0.8;li<=1.5;li+=0.1)for(let ki=0.05;ki<=1;ki+=0.05)for(let ti=-2;ti<=1;ti+=0.5){
  const cLinf=Math.max(...data.map(d=>d.len))*li,e=sse(cLinf,ki,ti);if(e<bestSSE){bestSSE=e;Linf=cLinf;K=ki;t0=ti}}
  // Refinement (simple gradient descent)
  for(let i=0;i<500;i++){const h=0.001;
  const dLinf=(sse(Linf+h,K,t0)-sse(Linf-h,K,t0))/(2*h);
  const dK=(sse(Linf,K+h,t0)-sse(Linf,K-h,t0))/(2*h);
  const dt0=(sse(Linf,K,t0+h)-sse(Linf,K,t0-h))/(2*h);
  const lr=0.00001;Linf-=lr*dLinf*100;K-=lr*dK;t0-=lr*dt0;
  K=Math.max(0.001,K);Linf=Math.max(1,Linf)}
  const ssTotal=data.reduce((s,d)=>{const m=data.reduce((a,d)=>a+d.len,0)/data.length;return s+(d.len-m)**2},0);
  const R2=1-bestSSE/ssTotal;
  // Generate fitted curve
  const maxAge=Math.max(...data.map(d=>d.age))*1.2;const fitX=Array.from({length:50},(_, i)=>i*maxAge/49);const fitY=fitX.map(a=>predict(a,Linf,K,t0));
  H('#wtest-result',`<div class="pcc" id="vbgfPlot" style="height:350px"></div>
  <div class="eg" style="margin-top:10px">
  <div class="ec"><div class="el">L∞</div><div class="ev">${Linf.toFixed(2)}</div></div>
  <div class="ec"><div class="el">K</div><div class="ev">${K.toFixed(4)}</div></div>
  <div class="ec"><div class="el">t₀</div><div class="ev">${t0.toFixed(3)}</div></div>
  <div class="ec"><div class="el">R²</div><div class="ev" style="color:${R2>0.8?'var(--sg)':R2>0.5?'var(--wa)':'var(--co)'}">${R2.toFixed(4)}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">L(t) = ${Linf.toFixed(2)} × (1 − e^(−${K.toFixed(4)} × (t − ${t0.toFixed(3)}))) · Age: ${ageCol} · Length: ${lenCol} · n=${data.length}</p>
  <div style="margin-top:6px;font-family:var(--mf);font-size:12px;color:var(--ts)">
  <b>R:</b> <code>nls(${lenCol} ~ Linf*(1-exp(-K*(${ageCol}-t0))), start=list(Linf=${Linf.toFixed(1)},K=${K.toFixed(3)},t0=${t0.toFixed(2)}))</code><br>
  <b>Python:</b> <code>scipy.optimize.curve_fit(lambda t,Li,K,t0: Li*(1-np.exp(-K*(t-t0))), age, length, p0=[${Linf.toFixed(1)},${K.toFixed(3)},${t0.toFixed(2)}])</code></div>`);
  setTimeout(()=>{Plotly.newPlot('vbgfPlot',[
  {x:data.map(d=>d.age),y:data.map(d=>d.len),type:'scatter',mode:'markers',marker:{color:'#C9956B',size:6,opacity:.7},name:'Observed'},
  {x:fitX,y:fitY,type:'scatter',mode:'lines',line:{color:'#7B9E87',width:2.5},name:'VBGF Fit'},
  {x:[0,maxAge],y:[Linf,Linf],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},name:'L∞'}
  ],{...PL,height:350,title:{text:'Von Bertalanffy Growth (R²='+R2.toFixed(3)+')',font:{size:12}},xaxis:{...PL.xaxis,title:{text:'Age ('+ageCol+')',font:{size:11}}},yaxis:{...PL.yaxis,title:{text:'Length ('+lenCol+')',font:{size:11}}}},{responsive:true})},100)}
// ═══ P3.6 LENGTH-FREQUENCY ANALYSIS ═══
function runLengthFreq(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need a length column.</p>');
  const lenCol=numC[0];logTest('lfq',{lenCol});
  const vals=S.wsD.map(r=>r[lenCol]).filter(v=>typeof v==='number'&&v>0);
  if(vals.length<10)return H('#wtest-result','<p style="color:var(--co)">Need at least 10 length measurements.</p>');
  // Compute histogram
  const mn=Math.min(...vals),mx=Math.max(...vals);const binW=Math.max(1,(mx-mn)/25);
  const bins=[];for(let b=mn;b<=mx+binW;b+=binW)bins.push(b);
  const counts=Array(bins.length-1).fill(0);
  vals.forEach(v=>{const i=Math.min(bins.length-2,Math.floor((v-mn)/binW));counts[i]++});
  const binCenters=bins.slice(0,-1).map((b,i)=>(b+bins[i+1])/2);
  // Bhattacharya's modal separation: find peaks
  const logDiff=[];for(let i=1;i<counts.length;i++)logDiff.push(counts[i]>0&&counts[i-1]>0?Math.log(counts[i])-Math.log(counts[i-1]):0);
  const peaks=[];for(let i=1;i<logDiff.length-1;i++){if(logDiff[i-1]>0&&logDiff[i]<=0&&counts[i]>2)peaks.push({center:binCenters[i],count:counts[i],idx:i})}
  // Fit Gaussian curves for each mode
  const gaussians=peaks.map(p=>{const sd=binW*2;return binCenters.map(x=>p.count*Math.exp(-0.5*((x-p.center)/sd)**2))});
  H('#wtest-result',`<div class="pcc" id="lfqPlot" style="height:350px"></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Length column: ${lenCol} · n=${vals.length} · ${peaks.length} mode(s) detected · Bin width: ${binW.toFixed(1)}</p>
  ${peaks.length?`<div style="font-size:12px;color:var(--ts);margin-top:4px">Modes: ${peaks.map((p,i)=>`<span style="color:${CL[(i+1)%8]}">${p.center.toFixed(1)}</span> (n≈${p.count})`).join(' · ')}</div>`:''}`);
  setTimeout(()=>{const traces=[{x:binCenters,y:counts,type:'bar',marker:{color:'#C9956B',opacity:.7},name:'Frequency'}];
  gaussians.forEach((g,i)=>{traces.push({x:binCenters,y:g,type:'scatter',mode:'lines',line:{color:CL[(i+1)%8],width:2},name:'Mode '+(i+1)})});
  Plotly.newPlot('lfqPlot',traces,{...PL,height:350,title:{text:'Length-Frequency Distribution',font:{size:12}},xaxis:{...PL.xaxis,title:{text:'Length',font:{size:11}}},yaxis:{...PL.yaxis,title:{text:'Frequency',font:{size:11}}}},{responsive:true})},100)}
// ═══ P3.7 CATCH CURVE & SURPLUS PRODUCTION ═══
function runCatchCurve(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need age and frequency/abundance columns.</p>');
  const ageCol=numC[0],freqCol=numC[1];logTest('catchcurve',{ageCol,freqCol});
  const data=S.wsD.filter(r=>typeof r[ageCol]==='number'&&typeof r[freqCol]==='number'&&r[freqCol]>0)
  .map(r=>({age:r[ageCol],n:r[freqCol]})).sort((a,b)=>a.age-b.age);
  if(data.length<4)return H('#wtest-result','<p style="color:var(--co)">Need at least 4 age groups.</p>');
  // Find peak and use descending limb
  const peakIdx=data.reduce((m,d,i)=>d.n>data[m].n?i:m,0);
  const desc=data.slice(peakIdx).filter(d=>d.n>0);
  if(desc.length<3)return H('#wtest-result','<p style="color:var(--co)">Not enough data on descending limb.</p>');
  const lnN=desc.map(d=>({age:d.age,lnN:Math.log(d.n)}));
  // Linear regression on ln(N) vs age
  const n=lnN.length,sx=lnN.reduce((s,d)=>s+d.age,0),sy=lnN.reduce((s,d)=>s+d.lnN,0);
  const mx=sx/n,my=sy/n;
  const sxy=lnN.reduce((s,d)=>s+(d.age-mx)*(d.lnN-my),0);
  const sxx=lnN.reduce((s,d)=>s+(d.age-mx)**2,0);
  const Z=-sxy/sxx;const a_int=my+Z*mx;const A=1-Math.exp(-Z);
  H('#wtest-result',`<div class="pcc" id="catchCurvePlot" style="height:300px"></div>
  <div class="eg" style="margin-top:10px">
  <div class="ec"><div class="el">Z (Total Mortality)</div><div class="ev">${Z.toFixed(4)}</div></div>
  <div class="ec"><div class="el">A (Annual Mortality)</div><div class="ev">${(A*100).toFixed(1)}%</div></div>
  <div class="ec"><div class="el">Survival S</div><div class="ev">${((1-A)*100).toFixed(1)}%</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">ln(N) = ${a_int.toFixed(3)} − ${Z.toFixed(4)} × age · Descending limb from age ${desc[0].age}</p>`);
  setTimeout(()=>{const fitX=[desc[0].age,desc[desc.length-1].age];const fitY=fitX.map(x=>a_int-Z*x);
  Plotly.newPlot('catchCurvePlot',[
  {x:data.map(d=>d.age),y:data.map(d=>Math.log(Math.max(d.n,0.1))),type:'scatter',mode:'markers',marker:{color:'#C9956B',size:7},name:'ln(N)'},
  {x:fitX,y:fitY,type:'scatter',mode:'lines',line:{color:'#C27878',width:2.5,dash:'dash'},name:'Z = '+Z.toFixed(3)}
  ],{...PL,height:300,title:{text:'Catch Curve (Z = '+Z.toFixed(3)+')',font:{size:12}},xaxis:{...PL.xaxis,title:'Age'},yaxis:{...PL.yaxis,title:'ln(N)'}},{responsive:true})},100)}
function runSurplusProduction(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need columns: year/effort and catch/CPUE.</p>');
  const yearCol=numC[0],catchCol=numC[1];logTest('surplus',{yearCol,catchCol});
  const data=S.wsD.filter(r=>typeof r[yearCol]==='number'&&typeof r[catchCol]==='number').map(r=>({year:r[yearCol],catch:r[catchCol]})).sort((a,b)=>a.year-b.year);
  if(data.length<5)return H('#wtest-result','<p style="color:var(--co)">Need at least 5 years of data.</p>');
  // Schaefer model: B(t+1) = B(t) + r*B(t)*(1-B(t)/K) - C(t)
  // Grid search for r, K
  const catches=data.map(d=>d.catch);const maxC=Math.max(...catches);
  let bestR=0.3,bestK=maxC*10,bestSSE=Infinity;
  for(let r=0.05;r<=1.5;r+=0.05)for(let kMult=3;kMult<=30;kMult+=1){
  const K=maxC*kMult;let B=K*0.5;let sse=0;
  catches.forEach(C=>{const pred=B>0?C/B*K:0;sse+=(pred-C)**2;B=Math.max(0.01,B+r*B*(1-B/K)-C)});
  if(sse<bestSSE){bestSSE=sse;bestR=r;bestK=K}}
  const MSY=bestR*bestK/4;const Bmsy=bestK/2;const Fmsy=bestR/2;
  // Simulate trajectory
  let B=bestK*0.5;const trajectory=catches.map(C=>{const Bt=B;B=Math.max(0.01,B+bestR*B*(1-B/bestK)-C);return{Bt,C,BoverBmsy:Bt/Bmsy,FoverFmsy:Bt>0?(C/Bt)/Fmsy:0}});
  H('#wtest-result',`<div class="pcc" id="sprodPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:10px">
  <div class="ec"><div class="el">r</div><div class="ev">${bestR.toFixed(3)}</div></div>
  <div class="ec"><div class="el">K</div><div class="ev">${bestK.toFixed(0)}</div></div>
  <div class="ec"><div class="el">MSY</div><div class="ev">${MSY.toFixed(0)}</div></div>
  <div class="ec"><div class="el">Bmsy</div><div class="ev">${Bmsy.toFixed(0)}</div></div>
  <div class="ec"><div class="el">Fmsy</div><div class="ev">${Fmsy.toFixed(4)}</div></div></div>
  <div class="pcc" id="kobeRefPlot" style="height:300px;margin-top:10px"></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Schaefer surplus production · Catch: ${catchCol} · MSY = rK/4</p>`);
  setTimeout(()=>{
  Plotly.newPlot('sprodPlot',[
  {x:data.map(d=>d.year),y:trajectory.map(t=>t.Bt),type:'scatter',mode:'lines',line:{color:'#7B9E87',width:2},name:'Biomass',fill:'tozeroy',fillcolor:'rgba(123,158,135,.1)'},
  {x:data.map(d=>d.year),y:catches,type:'bar',marker:{color:'#C9956B',opacity:.6},name:'Catch',yaxis:'y2'}
  ],{...PL,height:300,title:{text:'Surplus Production Model',font:{size:12}},yaxis:{...PL.yaxis,title:'Biomass'},yaxis2:{overlaying:'y',side:'right',title:'Catch',gridcolor:'transparent',tickfont:{color:'var(--tm)'},titlefont:{color:'var(--tm)'}}},{responsive:true});
  // Kobe plot
  Plotly.newPlot('kobeRefPlot',[
  {x:trajectory.map(t=>t.BoverBmsy),y:trajectory.map(t=>t.FoverFmsy),type:'scatter',mode:'lines+markers',marker:{size:5,color:data.map(d=>d.year),colorscale:'Viridis',showscale:true,colorbar:{title:'Year',len:.8}},line:{color:'rgba(255,255,255,.3)',width:1},text:data.map(d=>d.year.toString()),name:'Trajectory'},
  {x:[1,1],y:[0,Math.max(...trajectory.map(t=>t.FoverFmsy))*1.2],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},showlegend:false},
  {x:[0,Math.max(...trajectory.map(t=>t.BoverBmsy))*1.2],y:[1,1],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},showlegend:false}
  ],{...PL,height:300,title:{text:'Kobe Reference Points',font:{size:12}},xaxis:{...PL.xaxis,title:'B/Bmsy'},yaxis:{...PL.yaxis,title:'F/Fmsy'},
  shapes:[{type:'rect',x0:0,x1:1,y0:1,y1:10,fillcolor:'rgba(194,120,120,.1)',line:{width:0}},{type:'rect',x0:1,x1:10,y0:0,y1:1,fillcolor:'rgba(123,158,135,.1)',line:{width:0}}]},{responsive:true})},100)}
// ═══ PHASE 5-6 WORKSHOP STATISTICAL TOOLS ═══
function _gammaLn(x){const c=[76.18009173,-86.50532033,24.01409822,-1.231739516,.00120858003,-5.36382e-6];let y=x,tmp=x+5.5;tmp-=(x+0.5)*Math.log(tmp);let ser=1.000000000190015;for(let j=0;j<6;j++)ser+=c[j]/++y;return-tmp+Math.log(2.5066282746310005*ser/x)}
function _factorial(n){if(n<=1)return 1;let r=1;for(let i=2;i<=n;i++)r*=i;return r}
function _zFromP(p){const a=[0,-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];const b=[0,-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];const c=[0,-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];const d=[0,7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];const pL=0.02425,pH=1-pL;let q,r;if(p<pL){q=Math.sqrt(-2*Math.log(p));return(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)}if(p<=pH){q=p-0.5;r=q*q;return(((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q/(((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1)}q=Math.sqrt(-2*Math.log(1-p));return-(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)}
function _chiCDF(x,k){if(x<=0||k<=0)return 0;const a=k/2;let s=Math.exp(-x/2+a*Math.log(x/2)-_gammaLn(a));let sum=1,term=1;for(let i=1;i<300;i++){term*=(x/2)/(a+i);sum+=term;if(Math.abs(term)<1e-12)break}return Math.min(1,s*sum/a)}
function _fCDF(f,d1,d2){if(f<=0||d1<=0||d2<=0)return 0;const x=d1*f/(d1*f+d2);let bt=Math.exp(_gammaLn((d1+d2)/2)-_gammaLn(d1/2)-_gammaLn(d2/2)+(d1/2)*Math.log(x)+(d2/2)*Math.log(1-x));let sum=1,term=1;for(let i=1;i<300;i++){term*=(d1/2+d2/2-1+i)*x/((d1/2+i));sum+=term;if(Math.abs(term)<1e-12)break}return Math.min(1,bt*sum/(d1/2))}

function runPCA(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 numeric columns for PCA.</p>');
  logTest('pca',{cols:numC});
  const n=S.wsD.length;const p=numC.length;
  // Standardize
  const means=numC.map(c=>{let s=0,ct=0;S.wsD.forEach(r=>{if(typeof r[c]==='number'){s+=r[c];ct++}});return ct?s/ct:0});
  const sds=numC.map((c,i)=>{let s=0,ct=0;S.wsD.forEach(r=>{if(typeof r[c]==='number'){s+=(r[c]-means[i])**2;ct++}});return ct>1?Math.sqrt(s/(ct-1)):1});
  const Z=S.wsD.map(r=>numC.map((c,i)=>typeof r[c]==='number'?(r[c]-means[i])/(sds[i]||1):0));
  // Correlation matrix
  const R=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>{let s=0;Z.forEach(r=>s+=r[i]*r[j]);return s/(n-1)}));
  // Power iteration for top 2 eigenvalues/vectors
  function eigenPair(M,deflated){const sz=M.length;let v=Array.from({length:sz},()=>Math.random());for(let it=0;it<200;it++){let nv=Array(sz).fill(0);for(let i=0;i<sz;i++)for(let j=0;j<sz;j++)nv[i]+=M[i][j]*v[j];let norm=Math.sqrt(nv.reduce((s,x)=>s+x*x,0))||1;v=nv.map(x=>x/norm)}let ev=0;let Mv=Array(sz).fill(0);for(let i=0;i<sz;i++){for(let j=0;j<sz;j++)Mv[i]+=M[i][j]*v[j]}ev=v.reduce((s,x,i)=>s+x*Mv[i],0);return{value:ev,vector:v}}
  const e1=eigenPair(R);
  const R2=R.map((row,i)=>row.map((val,j)=>val-e1.value*e1.vector[i]*e1.vector[j]));
  const e2=eigenPair(R2);
  const totalVar=numC.length;const pct1=(e1.value/totalVar*100).toFixed(1);const pct2=(e2.value/totalVar*100).toFixed(1);
  // Project data
  const pc1=Z.map(r=>r.reduce((s,v,i)=>s+v*e1.vector[i],0));
  const pc2=Z.map(r=>r.reduce((s,v,i)=>s+v*e2.vector[i],0));
  // Nominal column for coloring
  const nomC=S.wsC.find(c=>S.wsCT[c]==='nominal');
  const groups=nomC?[...new Set(S.wsD.map(r=>r[nomC]))]:['All'];
  const traces=groups.map((g,gi)=>{const idx=S.wsD.map((r,i)=>(!nomC||r[nomC]===g)?i:-1).filter(i=>i>=0);return{x:idx.map(i=>pc1[i]),y:idx.map(i=>pc2[i]),type:'scatter',mode:'markers',marker:{size:6,color:CL[gi%CL.length],opacity:.7},name:String(g)}});
  // Loading arrows
  const loadTraces=numC.map((c,i)=>({x:[0,e1.vector[i]*Math.sqrt(e1.value)*2],y:[0,e2.vector[i]*Math.sqrt(e2.value)*2],type:'scatter',mode:'lines+text',line:{color:'var(--tm)',width:1},text:['',c],textposition:'top center',textfont:{size:9,color:'var(--tm)'},showlegend:false}));
  H('#wtest-result',`<div class="pcc" id="pcaPlot" style="height:350px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">PC1</div><div class="ev">${pct1}% var</div></div>
  <div class="ec"><div class="el">PC2</div><div class="ev">${pct2}% var</div></div>
  <div class="ec"><div class="el">Variables</div><div class="ev">${p}</div></div>
  <div class="ec"><div class="el">n</div><div class="ev">${n}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">PCA via power iteration on correlation matrix${nomC?' · Colored by '+nomC:''}</p>`);
  setTimeout(()=>Plotly.newPlot('pcaPlot',[...traces,...loadTraces],{...PL,height:350,title:{text:'PCA Biplot',font:{size:12}},xaxis:{...PL.xaxis,title:'PC1 ('+pct1+'%)'},yaxis:{...PL.yaxis,title:'PC2 ('+pct2+'%)'}},{responsive:true}),100);
}

function runPERMANOVA(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  if(numC.length<2||!nomC.length)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 numeric columns and 1 grouping column.</p>');
  const grpCol=nomC[0];logTest('permanova',{numC,grpCol});
  const groups=[...new Set(S.wsD.map(r=>r[grpCol]))].filter(Boolean);
  if(groups.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 groups.</p>');
  // Bray-Curtis distance
  function bcDist(a,b){let num=0,den=0;numC.forEach(c=>{const va=typeof a[c]==='number'?a[c]:0;const vb=typeof b[c]==='number'?b[c]:0;num+=Math.abs(va-vb);den+=va+vb});return den?num/den:0}
  const n=S.wsD.length;
  // Total SS
  let SSt=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)SSt+=bcDist(S.wsD[i],S.wsD[j])**2;SSt/=n;
  // Within-group SS
  let SSw=0;groups.forEach(g=>{const members=S.wsD.filter(r=>r[grpCol]===g);const ng=members.length;for(let i=0;i<ng;i++)for(let j=i+1;j<ng;j++)SSw+=bcDist(members[i],members[j])**2;SSw/=ng||1});
  const SSa=SSt-SSw;const a=groups.length;
  const Fobs=((SSa/(a-1))/(SSw/(n-a)))||0;
  // Permutation test (999 permutations)
  let pCount=0;const perms=999;
  for(let p=0;p<perms;p++){const shuffled=S.wsD.map(r=>({...r}));const labels=shuffled.map(r=>r[grpCol]);
    for(let i=labels.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[labels[i],labels[j]]=[labels[j],labels[i]]}
    shuffled.forEach((r,i)=>r[grpCol]=labels[i]);
    let pSSw=0;groups.forEach(g=>{const m=shuffled.filter(r=>r[grpCol]===g);const ng=m.length;for(let i=0;i<ng;i++)for(let j=i+1;j<ng;j++)pSSw+=bcDist(m[i],m[j])**2;pSSw/=ng||1});
    const pSSa=SSt-pSSw;const pF=((pSSa/(a-1))/(pSSw/(n-a)))||0;
    if(pF>=Fobs)pCount++}
  const pVal=(pCount+1)/(perms+1);
  const R2=(SSa/SSt).toFixed(4);
  H('#wtest-result',`<div class="eg">
  <div class="ec"><div class="el">Pseudo-F</div><div class="ev">${Fobs.toFixed(3)}</div></div>
  <div class="ec"><div class="el">R²</div><div class="ev">${R2}</div></div>
  <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${pVal<.05?'#7B9E87':'var(--co)'}">${pVal.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Groups</div><div class="ev">${a} (${grpCol})</div></div>
  <div class="ec"><div class="el">Permutations</div><div class="ev">${perms}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">PERMANOVA (Bray-Curtis) · ${numC.length} variables · ${n} observations · ${perms} permutations</p>`);
}

function runANOSIM(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  if(numC.length<2||!nomC.length)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 numeric columns and 1 grouping column.</p>');
  const grpCol=nomC[0];logTest('anosim',{numC,grpCol});
  function bcDist(a,b){let num=0,den=0;numC.forEach(c=>{const va=typeof a[c]==='number'?a[c]:0;const vb=typeof b[c]==='number'?b[c]:0;num+=Math.abs(va-vb);den+=va+vb});return den?num/den:0}
  const n=S.wsD.length;const labels=S.wsD.map(r=>r[grpCol]);
  // Compute rank-based R statistic
  const dists=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)dists.push({i,j,d:bcDist(S.wsD[i],S.wsD[j])});
  dists.sort((a,b)=>a.d-b.d);dists.forEach((d,i)=>d.rank=i+1);
  let rB=0,nB=0,rW=0,nW=0;
  dists.forEach(d=>{if(labels[d.i]===labels[d.j]){rW+=d.rank;nW++}else{rB+=d.rank;nB++}});
  rB=nB?rB/nB:0;rW=nW?rW/nW:0;
  const M=n*(n-1)/4;const Robs=(rB-rW)/M;
  let pCount=0;const perms=999;
  for(let p=0;p<perms;p++){const pLabels=[...labels];for(let i=pLabels.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pLabels[i],pLabels[j]]=[pLabels[j],pLabels[i]]}
    let pRB=0,pNB=0,pRW=0,pNW=0;
    dists.forEach(d=>{if(pLabels[d.i]===pLabels[d.j]){pRW+=d.rank;pNW++}else{pRB+=d.rank;pNB++}});
    pRB=pNB?pRB/pNB:0;pRW=pNW?pRW/pNW:0;
    if((pRB-pRW)/M>=Robs)pCount++}
  const pVal=(pCount+1)/(perms+1);
  H('#wtest-result',`<div class="eg">
  <div class="ec"><div class="el">R statistic</div><div class="ev">${Robs.toFixed(4)}</div></div>
  <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${pVal<.05?'#7B9E87':'var(--co)'}">${pVal.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Groups</div><div class="ev">${[...new Set(labels)].length} (${grpCol})</div></div>
  <div class="ec"><div class="el">Permutations</div><div class="ev">${perms}</div></div></div>
  <p style="font-size:11px;color:var(--tm)">ANOSIM (Bray-Curtis) · R∈[−1,1]: R>0 means between-group dissimilarity > within</p>`);
}

function runIndicatorSpecies(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  if(!numC.length||!nomC.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric (abundance) columns and 1 grouping column.</p>');
  const grpCol=nomC[0];logTest('indval',{numC,grpCol});
  const groups=[...new Set(S.wsD.map(r=>r[grpCol]))].filter(Boolean);
  const results=[];
  numC.forEach(sp=>{let bestIV=0,bestGrp='';
    groups.forEach(g=>{
      const inG=S.wsD.filter(r=>r[grpCol]===g);const outG=S.wsD.filter(r=>r[grpCol]!==g);
      const presIn=inG.filter(r=>typeof r[sp]==='number'&&r[sp]>0).length;
      const B=inG.length?presIn/inG.length:0;// Fidelity
      const sumIn=inG.reduce((s,r)=>s+(typeof r[sp]==='number'?r[sp]:0),0);
      const sumAll=S.wsD.reduce((s,r)=>s+(typeof r[sp]==='number'?r[sp]:0),0);
      const A=sumAll?sumIn/sumAll:0;// Specificity
      const IV=Math.sqrt(A*B)*100;
      if(IV>bestIV){bestIV=IV;bestGrp=g}});
    if(bestIV>25)results.push({species:sp,group:bestGrp,indval:bestIV})});
  results.sort((a,b)=>b.indval-a.indval);
  let html='<div style="font-size:12px"><strong>Indicator Species Analysis (IndVal)</strong>';
  html+='<table style="width:100%;font-size:11px;margin-top:8px;border-collapse:collapse"><tr style="border-bottom:1px solid var(--brd)"><th style="text-align:left;padding:4px">Variable</th><th>Best Group</th><th>IndVal (%)</th></tr>';
  results.slice(0,20).forEach(r=>{html+=`<tr style="border-bottom:1px solid var(--s2)"><td style="padding:4px">${escHTML(r.species)}</td><td style="text-align:center">${escHTML(r.group)}</td><td style="text-align:center;color:${r.indval>70?'#7B9E87':'var(--tm)'}">${r.indval.toFixed(1)}</td></tr>`});
  html+='</table>';
  if(!results.length)html+='<p style="color:var(--tm)">No strong indicators found (IndVal > 25%).</p>';
  html+=`<p style="font-size:10px;color:var(--tm);margin-top:6px">Dufrêne-Legendre IndVal · Grouping: ${grpCol} · ${groups.length} groups · ${numC.length} variables</p></div>`;
  H('#wtest-result',html);
}

function runACF(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need a numeric column.</p>');
  const col=numC[0];logTest('acf',{col});
  const vals=S.wsD.map(r=>typeof r[col]==='number'?r[col]:null).filter(v=>v!==null);
  const n=vals.length;if(n<10)return H('#wtest-result','<p style="color:var(--co)">Need ≥10 data points.</p>');
  const mean=vals.reduce((a,b)=>a+b,0)/n;
  const maxLag=Math.min(Math.floor(n/3),40);
  const denom=vals.reduce((s,v)=>s+(v-mean)**2,0);
  const acf=[],pacf=[];
  for(let k=0;k<=maxLag;k++){let num=0;for(let i=0;i<n-k;i++)num+=(vals[i]-mean)*(vals[i+k]-mean);acf.push(denom?num/denom:0)}
  // PACF via Durbin-Levinson
  let phi=[];
  for(let k=1;k<=maxLag;k++){
    if(k===1){pacf.push(acf[1]);phi=[acf[1]];continue}
    let num=acf[k];for(let j=0;j<k-1;j++)num-=phi[j]*acf[k-1-j];
    let den=1;for(let j=0;j<k-1;j++)den-=phi[j]*acf[j+1];
    const pk=den?num/den:0;
    const newPhi=[];for(let j=0;j<k-1;j++)newPhi.push(phi[j]-pk*phi[k-2-j]);
    newPhi.push(pk);phi=newPhi;pacf.push(pk)}
  const ci=1.96/Math.sqrt(n);const lags=Array.from({length:maxLag+1},(_,i)=>i);
  H('#wtest-result',`<div class="pcc" id="acfPlot" style="height:250px"></div><div class="pcc" id="pacfPlot" style="height:250px;margin-top:10px"></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">ACF/PACF · ${col} · n=${n} · Max lag=${maxLag} · Blue dashed = 95% CI</p>`);
  setTimeout(()=>{
    Plotly.newPlot('acfPlot',[{x:lags,y:acf,type:'bar',marker:{color:'#7B9E87'},width:.5}],{...PL,height:250,title:{text:'Autocorrelation (ACF) — '+col,font:{size:12}},xaxis:{...PL.xaxis,title:'Lag'},yaxis:{...PL.yaxis,title:'ACF',range:[-1,1]},shapes:[{type:'line',x0:0,x1:maxLag,y0:ci,y1:ci,line:{color:'#5B8FA8',width:1,dash:'dash'}},{type:'line',x0:0,x1:maxLag,y0:-ci,y1:-ci,line:{color:'#5B8FA8',width:1,dash:'dash'}}]},{responsive:true});
    Plotly.newPlot('pacfPlot',[{x:lags.slice(1),y:pacf,type:'bar',marker:{color:'#C9956B'},width:.5}],{...PL,height:250,title:{text:'Partial Autocorrelation (PACF) — '+col,font:{size:12}},xaxis:{...PL.xaxis,title:'Lag'},yaxis:{...PL.yaxis,title:'PACF',range:[-1,1]},shapes:[{type:'line',x0:1,x1:maxLag,y0:ci,y1:ci,line:{color:'#5B8FA8',width:1,dash:'dash'}},{type:'line',x0:1,x1:maxLag,y0:-ci,y1:-ci,line:{color:'#5B8FA8',width:1,dash:'dash'}}]},{responsive:true})},100);
}

function runRegimeShift(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need a numeric column.</p>');
  const col=numC[0];logTest('regime',{col});
  const vals=S.wsD.map(r=>typeof r[col]==='number'?r[col]:null);
  const valid=vals.filter(v=>v!==null);
  if(valid.length<10)return H('#wtest-result','<p style="color:var(--co)">Need ≥10 data points.</p>');
  // Rodionov STARS algorithm
  const L=Math.max(5,Math.floor(valid.length/5));const pThresh=0.05;
  const tCrit=Math.abs(_zFromP(pThresh/2));
  const mean0=valid.slice(0,L).reduce((a,b)=>a+b,0)/L;
  const sd0=Math.sqrt(valid.slice(0,L).reduce((s,v)=>s+(v-mean0)**2,0)/(L-1))||1;
  const shifts=[];let currentMean=mean0;let regime=0;
  for(let i=L;i<valid.length;i++){
    const diff=Math.abs(valid[i]-currentMean)/sd0;
    if(diff>tCrit){
      // Confirm shift over next L points
      const window=valid.slice(i,i+L);if(window.length<3)continue;
      const wMean=window.reduce((a,b)=>a+b,0)/window.length;
      const wDiff=Math.abs(wMean-currentMean)/sd0;
      if(wDiff>tCrit*0.7){regime++;shifts.push({index:i,from:currentMean,to:wMean,rsi:wDiff.toFixed(2)});currentMean=wMean}}}
  // Build chart with regime shading
  const xVals=Array.from({length:valid.length},(_,i)=>i);
  const dateCol=S.wsC.find(c=>S.wsCT[c]==='date');
  const xLabels=dateCol?S.wsD.map(r=>r[dateCol]):xVals;
  const shapes=[];const colors=['rgba(123,158,135,.1)','rgba(201,149,107,.1)','rgba(91,143,168,.1)','rgba(194,120,120,.1)'];
  let prev=0;shifts.forEach((s,i)=>{shapes.push({type:'rect',x0:prev,x1:s.index,y0:Math.min(...valid)*0.9,y1:Math.max(...valid)*1.1,fillcolor:colors[i%colors.length],line:{width:0}});prev=s.index});
  shapes.push({type:'rect',x0:prev,x1:valid.length-1,y0:Math.min(...valid)*0.9,y1:Math.max(...valid)*1.1,fillcolor:colors[shifts.length%colors.length],line:{width:0}});
  H('#wtest-result',`<div class="pcc" id="regimePlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Regimes</div><div class="ev">${regime+1}</div></div>
  <div class="ec"><div class="el">Shifts</div><div class="ev">${shifts.length}</div></div>
  <div class="ec"><div class="el">Cut-off (L)</div><div class="ev">${L}</div></div>
  <div class="ec"><div class="el">p threshold</div><div class="ev">${pThresh}</div></div></div>
  ${shifts.length?'<table style="width:100%;font-size:11px;margin-top:8px;border-collapse:collapse"><tr style="border-bottom:1px solid var(--brd)"><th style="text-align:left;padding:4px">Index</th><th>From</th><th>To</th><th>RSI</th></tr>'+shifts.map(s=>`<tr style="border-bottom:1px solid var(--s2)"><td style="padding:4px">${s.index}</td><td style="text-align:center">${s.from.toFixed(2)}</td><td style="text-align:center">${s.to.toFixed(2)}</td><td style="text-align:center">${s.rsi}</td></tr>`).join('')+'</table>':''}
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Rodionov STARS · ${col} · n=${valid.length}</p>`);
  setTimeout(()=>{
    const shiftLines=shifts.map(s=>({type:'line',x0:s.index,x1:s.index,y0:Math.min(...valid)*0.9,y1:Math.max(...valid)*1.1,line:{color:'var(--co)',width:2,dash:'dot'}}));
    Plotly.newPlot('regimePlot',[{x:xLabels.slice(0,valid.length),y:valid,type:'scatter',mode:'lines+markers',marker:{size:4,color:'#7B9E87'},line:{width:1.5},name:col}],{...PL,height:300,title:{text:'Regime Shift Detection — '+col,font:{size:12}},xaxis:{...PL.xaxis,title:dateCol||'Index'},yaxis:{...PL.yaxis,title:col},shapes:[...shapes,...shiftLines]},{responsive:true})},100);
}

function runKruskalWallis(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  if(!numC.length||!nomC.length)return H('#wtest-result','<p style="color:var(--co)">Need 1 numeric and 1 grouping column.</p>');
  const valCol=numC[0],grpCol=nomC[0];logTest('kruskal',{valCol,grpCol});
  const groups=[...new Set(S.wsD.map(r=>r[grpCol]))].filter(Boolean);
  if(groups.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 groups.</p>');
  // Rank all values
  const allVals=S.wsD.filter(r=>typeof r[valCol]==='number'&&r[grpCol]).map(r=>({val:r[valCol],grp:r[grpCol]}));
  allVals.sort((a,b)=>a.val-b.val);allVals.forEach((v,i)=>v.rank=i+1);
  // Handle ties
  let i=0;while(i<allVals.length){let j=i;while(j<allVals.length&&allVals[j].val===allVals[i].val)j++;const avgR=(allVals[i].rank+allVals[j-1].rank)/2;for(let k=i;k<j;k++)allVals[k].rank=avgR;i=j}
  const N=allVals.length;const grpData={};groups.forEach(g=>{grpData[g]=allVals.filter(v=>v.grp===g)});
  let Hstat=0;groups.forEach(g=>{const ni=grpData[g].length;if(!ni)return;const Ri=grpData[g].reduce((s,v)=>s+v.rank,0);Hstat+=Ri*Ri/ni});
  Hstat=(12/(N*(N+1)))*Hstat-3*(N+1);
  const df=groups.length-1;const pVal=1-_chiCDF(Hstat,df);
  // Box plot
  const traces=groups.map((g,gi)=>({y:grpData[g].map(v=>v.val),type:'box',name:String(g),marker:{color:CL[gi%CL.length]},boxpoints:'outliers'}));
  H('#wtest-result',`<div class="pcc" id="kwPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">H statistic</div><div class="ev">${Hstat.toFixed(3)}</div></div>
  <div class="ec"><div class="el">df</div><div class="ev">${df}</div></div>
  <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${pVal<.05?'#7B9E87':'var(--co)'}">${pVal.toFixed(4)}</div></div>
  <div class="ec"><div class="el">N</div><div class="ev">${N}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Kruskal-Wallis H test · ${valCol} by ${grpCol} · ${groups.length} groups</p>`);
  setTimeout(()=>Plotly.newPlot('kwPlot',traces,{...PL,height:300,title:{text:'Kruskal-Wallis: '+valCol+' by '+grpCol,font:{size:12}}},{responsive:true}),100);
}

function runChiSquared(){
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  if(nomC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 categorical columns.</p>');
  const col1=nomC[0],col2=nomC[1];logTest('chi2',{col1,col2});
  const cats1=[...new Set(S.wsD.map(r=>r[col1]))].filter(Boolean);
  const cats2=[...new Set(S.wsD.map(r=>r[col2]))].filter(Boolean);
  const observed=cats1.map(c1=>cats2.map(c2=>S.wsD.filter(r=>r[col1]===c1&&r[col2]===c2).length));
  const rowTotals=observed.map(row=>row.reduce((a,b)=>a+b,0));
  const colTotals=cats2.map((_,j)=>observed.reduce((s,row)=>s+row[j],0));
  const N=rowTotals.reduce((a,b)=>a+b,0);
  let chi2=0;const expected=cats1.map((c1,i)=>cats2.map((c2,j)=>{const e=rowTotals[i]*colTotals[j]/N;chi2+=e>0?(observed[i][j]-e)**2/e:0;return e}));
  const df=(cats1.length-1)*(cats2.length-1);const pVal=1-_chiCDF(chi2,df);
  const V=Math.sqrt(chi2/(N*Math.min(cats1.length-1,cats2.length-1)));// Cramér's V
  let html=`<div style="font-size:12px"><strong>χ² Test of Independence</strong>`;
  html+=`<div style="overflow-x:auto;margin:8px 0"><table style="width:100%;font-size:11px;border-collapse:collapse"><tr><th style="padding:4px;border-bottom:1px solid var(--brd)"></th>`;
  cats2.forEach(c=>html+=`<th style="padding:4px;border-bottom:1px solid var(--brd)">${escHTML(String(c))}</th>`);
  html+='<th style="padding:4px;border-bottom:1px solid var(--brd)">Total</th></tr>';
  cats1.forEach((c1,i)=>{html+=`<tr><td style="padding:4px;font-weight:bold;border-bottom:1px solid var(--s2)">${escHTML(String(c1))}</td>`;
    cats2.forEach((c2,j)=>{const o=observed[i][j],e=expected[i][j];const res=(o-e)/Math.sqrt(e||1);html+=`<td style="padding:4px;text-align:center;border-bottom:1px solid var(--s2);color:${Math.abs(res)>2?'var(--co)':'var(--tm)'}">${o} <span style="font-size:9px;opacity:.6">(${e.toFixed(1)})</span></td>`});
    html+=`<td style="padding:4px;text-align:center;border-bottom:1px solid var(--s2)">${rowTotals[i]}</td></tr>`});
  html+='</table></div>';
  html+=`<div class="eg"><div class="ec"><div class="el">χ²</div><div class="ev">${chi2.toFixed(3)}</div></div>
  <div class="ec"><div class="el">df</div><div class="ev">${df}</div></div>
  <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${pVal<.05?'#7B9E87':'var(--co)'}">${pVal.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Cramér's V</div><div class="ev">${V.toFixed(3)}</div></div></div>
  <p style="font-size:10px;color:var(--tm);margin-top:6px">${col1} × ${col2} · Observed (Expected) · Colored cells: |residual| > 2</p></div>`;
  H('#wtest-result',html);
}

function runPowerAnalysis(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric data to estimate effect size.</p>');
  logTest('power',{});
  const nomC=S.wsC.find(c=>S.wsCT[c]==='nominal');
  let d=0.5;// default medium effect
  if(nomC){const groups=[...new Set(S.wsD.map(r=>r[nomC]))].filter(Boolean);
    if(groups.length>=2){const g1=S.wsD.filter(r=>r[nomC]===groups[0]).map(r=>r[numC[0]]).filter(v=>typeof v==='number');
      const g2=S.wsD.filter(r=>r[nomC]===groups[1]).map(r=>r[numC[0]]).filter(v=>typeof v==='number');
      if(g1.length>2&&g2.length>2){const m1=g1.reduce((a,b)=>a+b,0)/g1.length;const m2=g2.reduce((a,b)=>a+b,0)/g2.length;
        const sd1=Math.sqrt(g1.reduce((s,v)=>s+(v-m1)**2,0)/(g1.length-1));
        const sd2=Math.sqrt(g2.reduce((s,v)=>s+(v-m2)**2,0)/(g2.length-1));
        const pooledSD=Math.sqrt(((g1.length-1)*sd1**2+(g2.length-1)*sd2**2)/(g1.length+g2.length-2));
        d=pooledSD?Math.abs(m1-m2)/pooledSD:0.5}}}
  // Compute power curve
  const alpha=0.05;const zAlpha=Math.abs(_zFromP(alpha/2));
  const sampleSizes=Array.from({length:20},(_,i)=>(i+1)*5);
  const powers=sampleSizes.map(n=>{const se=d*Math.sqrt(n/2);const power=1-normCDF(zAlpha-se)+normCDF(-zAlpha-se);return Math.max(0,Math.min(1,power))});
  // Find required n for 80% power
  const n80=sampleSizes.find((_,i)=>powers[i]>=0.8)||'>'+sampleSizes[sampleSizes.length-1];
  H('#wtest-result',`<div class="pcc" id="powerPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Effect size (d)</div><div class="ev">${d.toFixed(3)}</div></div>
  <div class="ec"><div class="el">α</div><div class="ev">${alpha}</div></div>
  <div class="ec"><div class="el">n for 80% power</div><div class="ev">${n80}</div></div>
  <div class="ec"><div class="el">Current n</div><div class="ev">${S.wsD.length}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Two-sample z-approximation · Effect size ${nomC?'estimated from '+nomC+' groups':'= 0.5 (medium, default)'}</p>`);
  setTimeout(()=>Plotly.newPlot('powerPlot',[{x:sampleSizes,y:powers,type:'scatter',mode:'lines+markers',marker:{size:5,color:'#7B9E87'},line:{width:2},name:'Power'},{x:[sampleSizes[0],sampleSizes[sampleSizes.length-1]],y:[.8,.8],type:'scatter',mode:'lines',line:{color:'var(--co)',width:1,dash:'dash'},name:'80% threshold'}],{...PL,height:300,title:{text:'Power Analysis (d = '+d.toFixed(2)+')',font:{size:12}},xaxis:{...PL.xaxis,title:'Sample Size (per group)'},yaxis:{...PL.yaxis,title:'Power',range:[0,1.05]}},{responsive:true}),100);
}

function runWeightLength(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need length and weight columns.</p>');
  const lenCol=numC[0],wtCol=numC[1];logTest('wl',{lenCol,wtCol});
  const data=S.wsD.filter(r=>typeof r[lenCol]==='number'&&r[lenCol]>0&&typeof r[wtCol]==='number'&&r[wtCol]>0).map(r=>({L:r[lenCol],W:r[wtCol]}));
  if(data.length<5)return H('#wtest-result','<p style="color:var(--co)">Need ≥5 valid length-weight pairs.</p>');
  // Log-linear regression: ln(W) = ln(a) + b*ln(L)
  const lnL=data.map(d=>Math.log(d.L)),lnW=data.map(d=>Math.log(d.W));
  const n=data.length;const mX=lnL.reduce((a,b)=>a+b,0)/n;const mY=lnW.reduce((a,b)=>a+b,0)/n;
  let ssXY=0,ssXX=0,ssYY=0;for(let i=0;i<n;i++){ssXY+=(lnL[i]-mX)*(lnW[i]-mY);ssXX+=(lnL[i]-mX)**2;ssYY+=(lnW[i]-mY)**2}
  const b=ssXX?ssXY/ssXX:3;const lnA=mY-b*mX;const a=Math.exp(lnA);
  const R2=ssXX&&ssYY?(ssXY**2)/(ssXX*ssYY):0;
  const fitL=Array.from({length:50},(_,i)=>Math.min(...data.map(d=>d.L))+(Math.max(...data.map(d=>d.L))-Math.min(...data.map(d=>d.L)))*i/49);
  const fitW=fitL.map(l=>a*Math.pow(l,b));
  H('#wtest-result',`<div class="pcc" id="wlPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">a (intercept)</div><div class="ev">${a.toExponential(4)}</div></div>
  <div class="ec"><div class="el">b (slope)</div><div class="ev">${b.toFixed(4)}</div></div>
  <div class="ec"><div class="el">R²</div><div class="ev">${R2.toFixed(4)}</div></div>
  <div class="ec"><div class="el">n</div><div class="ev">${n}</div></div>
  <div class="ec"><div class="el">Isometric?</div><div class="ev" style="color:${Math.abs(b-3)<0.1?'#7B9E87':'var(--co)'}">${Math.abs(b-3)<0.1?'Yes (b≈3)':'No (b='+b.toFixed(2)+')'}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">W = aL^b · ${lenCol} vs ${wtCol} · Log-linear regression</p>`);
  setTimeout(()=>Plotly.newPlot('wlPlot',[{x:data.map(d=>d.L),y:data.map(d=>d.W),type:'scatter',mode:'markers',marker:{size:4,color:'#5B8FA8',opacity:.6},name:'Observed'},{x:fitL,y:fitW,type:'scatter',mode:'lines',line:{color:'#C9956B',width:2},name:'W='+a.toExponential(2)+'·L^'+b.toFixed(2)}],{...PL,height:300,title:{text:'Weight-Length Relationship',font:{size:12}},xaxis:{...PL.xaxis,title:lenCol},yaxis:{...PL.yaxis,title:wtCol}},{responsive:true}),100);
}

// ═══ NEW WORKSHOP STAT RUNNERS ═══
function runWSShapiroWilk(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric columns.</p>');
  let html='<table class="dt"><thead><tr><th>Variable</th><th>n</th><th>W</th><th>p-value</th><th>Normal?</th></tr></thead><tbody>';
  nc.forEach(c=>{const vals=S.wsD.map(r=>r[c]).filter(v=>typeof v==='number'&&isFinite(v));
    const sw=shapiroWilk(vals);
    html+=`<tr><td class="cn">${escHTML(c)}</td><td>${vals.length}</td><td>${sw.W.toFixed(4)}</td><td style="color:${sw.p<0.05?'var(--co)':'var(--sg)'}">${sw.p.toFixed(4)}</td><td>${sw.normal===null?sw.reason:sw.normal?'Yes (p≥0.05)':'No (p<0.05)'}</td></tr>`});
  html+='</tbody></table><p style="font-size:11px;color:var(--tm);margin-top:6px">Shapiro-Wilk test of normality. p<0.05 suggests data is not normally distributed. Prerequisite for parametric tests.</p>';
  H('#wtest-result',html)}

function runWSAnova(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const catC=S.wsC.filter(c=>S.wsCT[c]==='categorical'||S.wsCT[c]==='nominal');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric response variable.</p>');
  if(!catC.length)return H('#wtest-result','<p style="color:var(--co)">Need a categorical grouping variable (column with text labels).</p>');
  const respCol=nc[0],grpCol=catC[0];
  const groupMap={};
  S.wsD.forEach(r=>{const g=r[grpCol];const v=r[respCol];if(g!=null&&typeof v==='number'){
    if(!groupMap[g])groupMap[g]=[];groupMap[g].push(v)}});
  const labels=Object.keys(groupMap);const groups=labels.map(k=>groupMap[k]);
  if(groups.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 groups for ANOVA.</p>');
  const result=tukeyHSD(groups,labels);
  if(!result)return H('#wtest-result','<p style="color:var(--co)">ANOVA computation failed.</p>');
  const a=result.anova;
  let html=`<div class="eg"><div class="ec"><div class="el">F</div><div class="ev">${a.F.toFixed(3)}</div></div>
    <div class="ec"><div class="el">p</div><div class="ev" style="color:${a.p<0.05?'var(--sg)':'var(--tm)'}">${a.p.toFixed(4)}</div></div>
    <div class="ec"><div class="el">η²</div><div class="ev">${a.eta2.toFixed(3)}</div></div>
    <div class="ec"><div class="el">df</div><div class="ev">${a.dfBetween},${a.dfWithin}</div></div></div>
    <div style="font-size:12px;color:${a.p<0.05?'var(--sg)':'var(--tm)'};margin:8px 0">${a.p<0.05?'Significant':'Not significant'} · ${respCol} by ${grpCol}</div>`;
  html+=`<table class="dt"><thead><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th></tr></thead><tbody>`;
  labels.forEach((l,i)=>{const g=a.groupStats[i];html+=`<tr><td class="cn">${escHTML(l)}</td><td>${g.n}</td><td>${g.mean.toFixed(3)}</td><td>${g.sd.toFixed(3)}</td></tr>`});
  html+=`</tbody></table>`;
  if(result.pairs.length<=30){html+=`<h4 style="font-size:11px;color:var(--ac);margin:10px 0 4px;font-family:var(--mf)">TUKEY HSD POST-HOC</h4>
    <table class="dt"><thead><tr><th>Comparison</th><th>Diff</th><th>q</th><th>p</th><th>Sig</th></tr></thead><tbody>`;
    result.pairs.forEach(p=>{html+=`<tr><td class="cn">${escHTML(p.a)} vs ${escHTML(p.b)}</td><td>${p.diff.toFixed(3)}</td><td>${p.q.toFixed(2)}</td><td style="color:${p.sig?'var(--sg)':'var(--tm)'}">${p.p.toFixed(4)}</td><td>${p.sig?'*':''}</td></tr>`});
    html+=`</tbody></table>`}
  html+='<p style="font-size:11px;color:var(--tm);margin-top:6px">One-way ANOVA with Tukey HSD post-hoc. * = p<0.05.</p>';
  H('#wtest-result',html)}

function runWSExpandedPower(){
  let html=`<div style="font-size:12px;color:var(--ts);margin-bottom:10px">Power analysis for common test designs. Enter parameters below:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
    <select class="fs" id="pwrTest"><option value="ttest">Two-Sample t-test</option><option value="corr">Correlation</option><option value="chisq">Chi-Square</option><option value="anova">ANOVA</option></select>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Effect:</span><input class="fi" id="pwrEffect" value="0.5" style="width:60px" type="number" step="0.1"/>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">α:</span><input class="fi" id="pwrAlpha" value="0.05" style="width:60px" type="number" step="0.01"/>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Groups (ANOVA):</span><input class="fi" id="pwrK" value="3" style="width:50px" type="number"/>
    <button class="bt bt-pri" onclick="computeExpandedPower()">Compute</button></div>
    <div class="pcc" id="pwrExpandedPlot" style="height:300px"></div><div id="pwrExpandedResult" style="font-size:12px;font-family:var(--mf);color:var(--ts);margin-top:6px"></div>`;
  H('#wtest-result',html)}
function computeExpandedPower(){
  const test=$('#pwrTest').value;const d=parseFloat($('#pwrEffect').value)||0.5;
  const alpha=parseFloat($('#pwrAlpha').value)||0.05;const k=parseInt($('#pwrK').value)||3;
  const ns=Array.from({length:40},(_,i)=>(i+2)*5);let powers;
  if(test==='ttest')powers=ns.map(n=>powerTwoSampleT(n,n,d,alpha));
  else if(test==='corr')powers=ns.map(n=>powerCorrelation(n,d,alpha));
  else if(test==='chisq')powers=ns.map(n=>powerChiSquare(n,d,1,alpha));
  else powers=ns.map(n=>powerAnova(k,n,d,alpha));
  const n80=ns.find((_,i)=>powers[i]>=0.8);
  Plotly.newPlot('pwrExpandedPlot',[
    {x:ns,y:powers,type:'scatter',mode:'lines+markers',marker:{size:4,color:'#7B9E87'},line:{width:2},name:'Power'},
    {x:[ns[0],ns[ns.length-1]],y:[.8,.8],type:'scatter',mode:'lines',line:{color:'var(--co)',width:1,dash:'dash'},name:'80% threshold'}
  ],{...PL,height:300,title:{text:`Power: ${test} (effect=${d})`,font:{size:12}},xaxis:{...PL.xaxis,title:'Sample size per group'},yaxis:{...PL.yaxis,title:'Power',range:[0,1.05]}},{responsive:true});
  H('#pwrExpandedResult',`<b>n for 80% power:</b> ${n80||'>200'} per group · Effect size: ${d} · α: ${alpha}${test==='anova'?' · Groups: '+k:''}`)}

function runWSGLM(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nc.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 numeric columns (1 response + ≥1 predictor).</p>');
  const yCol=nc[0];const xCols=nc.slice(1,Math.min(6,nc.length));
  const validRows=S.wsD.filter(r=>typeof r[yCol]==='number'&&xCols.every(c=>typeof r[c]==='number'));
  if(validRows.length<xCols.length+5)return H('#wtest-result','<p style="color:var(--co)">Insufficient valid rows.</p>');
  const yVals=validRows.map(r=>r[yCol]);
  const xMatrix=validRows.map(r=>xCols.map(c=>r[c]));
  const result=fitGLM(yVals,xMatrix,'gaussian');
  if(!result)return H('#wtest-result','<p style="color:var(--co)">GLM fitting failed.</p>');
  const labels=['(Intercept)',...xCols];
  let html=`<div class="eg"><div class="ec"><div class="el">AIC</div><div class="ev">${result.aic.toFixed(1)}</div></div>
    <div class="ec"><div class="el">Deviance</div><div class="ev">${result.deviance.toFixed(2)}</div></div>
    <div class="ec"><div class="el">n</div><div class="ev">${result.n}</div></div></div>
    <div style="font-size:11px;color:var(--tm);margin:6px 0">${yCol} ~ ${xCols.join(' + ')}</div>
    <table class="dt"><thead><tr><th>Term</th><th>Coef</th><th>SE</th><th>z</th><th>p</th><th></th></tr></thead><tbody>`;
  labels.forEach((l,i)=>{html+=`<tr><td class="cn">${escHTML(l)}</td><td>${result.beta[i].toFixed(4)}</td><td>${result.se[i].toFixed(4)}</td><td>${result.z[i].toFixed(2)}</td><td style="color:${result.p[i]<0.05?'var(--sg)':'var(--tm)'}">${result.p[i].toFixed(4)}</td><td>${result.p[i]<0.001?'***':result.p[i]<0.01?'**':result.p[i]<0.05?'*':''}</td></tr>`});
  html+=`</tbody></table><p style="font-size:11px;color:var(--tm);margin-top:6px">Gaussian GLM (IRLS). First numeric column = response, rest = predictors.</p>`;
  html+=`<div class="pcc" id="glmResidPlot" style="height:260px;margin-top:10px"></div>`;
  H('#wtest-result',html);
  setTimeout(()=>Plotly.newPlot('glmResidPlot',[{x:result.fitted,y:result.residuals,type:'scatter',mode:'markers',marker:{size:4,color:'#9B8EC4',opacity:.6},name:'Residuals'}],{...PL,height:260,title:{text:'Residuals vs Fitted',font:{size:12}},xaxis:{...PL.xaxis,title:'Fitted'},yaxis:{...PL.yaxis,title:'Residuals'}},{responsive:true}),100)}

function runWSDiversity(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric abundance/count columns.</p>');
  // Treat each numeric column as species counts from first row, or aggregate
  const counts=nc.map(c=>{const vals=S.wsD.map(r=>r[c]).filter(v=>typeof v==='number'&&v>=0);return vals.reduce((s,v)=>s+v,0)});
  const sh=shannonDiversity(counts);const si=simpsonDiversity(counts);
  let html=`<div class="eg"><div class="ec"><div class="el">Shannon H'</div><div class="ev">${sh.H.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Evenness J'</div><div class="ev">${sh.J.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Simpson 1-D</div><div class="ev">${si.oneMinusD.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Species (S)</div><div class="ev">${sh.S}</div></div>
    <div class="ec"><div class="el">Total N</div><div class="ev">${sh.N}</div></div>
    <div class="ec"><div class="el">Hmax (ln S)</div><div class="ev">${sh.Hmax.toFixed(4)}</div></div></div>
    <p style="font-size:11px;color:var(--tm);margin-top:6px">Shannon-Wiener (H') and Simpson (1-D) diversity indices. Each numeric column treated as a species; values summed as total abundance.</p>`;
  H('#wtest-result',html)}

function runWSRarefaction(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric abundance columns.</p>');
  const counts=nc.map(c=>Math.round(S.wsD.map(r=>r[c]).filter(v=>typeof v==='number'&&v>=0).reduce((s,v)=>s+v,0)));
  const curve=rarefactionCurve(counts,25);
  let html='<div class="pcc" id="rarefPlot" style="height:300px"></div><p style="font-size:11px;color:var(--tm);margin-top:6px">Expected species richness at increasing sample sizes (Hurlbert rarefaction).</p>';
  H('#wtest-result',html);
  setTimeout(()=>Plotly.newPlot('rarefPlot',[{x:curve.map(c=>c.n),y:curve.map(c=>c.expectedS),type:'scatter',mode:'lines+markers',marker:{size:5,color:'#C9956B'},line:{width:2},name:'Expected S'}],{...PL,height:300,title:{text:'Rarefaction Curve',font:{size:12}},xaxis:{...PL.xaxis,title:'Sample Size'},yaxis:{...PL.yaxis,title:'Expected Species'}},{responsive:true}),100)}

function runWSHardyWeinberg(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nc.length<3)return H('#wtest-result','<p style="color:var(--co)">Need 3 columns: AA count, Aa count, aa count (observed genotype frequencies).</p>');
  const AA=S.wsD.reduce((s,r)=>s+(typeof r[nc[0]]==='number'?r[nc[0]]:0),0);
  const Aa=S.wsD.reduce((s,r)=>s+(typeof r[nc[1]]==='number'?r[nc[1]]:0),0);
  const aa=S.wsD.reduce((s,r)=>s+(typeof r[nc[2]]==='number'?r[nc[2]]:0),0);
  const hw=hardyWeinberg(AA,Aa,aa);
  if(!hw)return H('#wtest-result','<p style="color:var(--co)">Need valid genotype counts.</p>');
  H('#wtest-result',`<div class="eg"><div class="ec"><div class="el">p (freq A)</div><div class="ev">${hw.p.toFixed(4)}</div></div>
    <div class="ec"><div class="el">q (freq a)</div><div class="ev">${hw.q.toFixed(4)}</div></div>
    <div class="ec"><div class="el">χ²</div><div class="ev">${hw.chi2}</div></div>
    <div class="ec"><div class="el">p-value</div><div class="ev" style="color:${hw.inHWE?'var(--sg)':'var(--co)'}">${hw.pVal}</div></div></div>
    <table class="dt"><thead><tr><th></th><th>AA</th><th>Aa</th><th>aa</th></tr></thead><tbody>
    <tr><td class="cn">Observed</td><td>${AA}</td><td>${Aa}</td><td>${aa}</td></tr>
    <tr><td class="cn">Expected</td><td>${hw.expAA}</td><td>${hw.expAa}</td><td>${hw.expaa}</td></tr>
    </tbody></table>
    <p style="font-size:12px;color:${hw.inHWE?'var(--sg)':'var(--co)'}; margin-top:6px">${hw.inHWE?'Population IS in Hardy-Weinberg equilibrium (p≥0.05)':'Population is NOT in Hardy-Weinberg equilibrium (p<0.05)'}</p>
    <p style="font-size:11px;color:var(--tm)">Uses columns: ${nc[0]}=AA, ${nc[1]}=Aa, ${nc[2]}=aa</p>`)}

function runWSFStats(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const catC=S.wsC.filter(c=>S.wsCT[c]==='categorical');
  if(!nc.length||!catC.length)return H('#wtest-result','<p style="color:var(--co)">Need: 1 numeric column (allele freq 0-1) + 1 categorical column (population ID).</p>');
  const freqCol=nc[0],popCol=catC[0];
  const popMap={};
  S.wsD.forEach(r=>{const p=r[popCol];const v=r[freqCol];if(p!=null&&typeof v==='number'){
    if(!popMap[p])popMap[p]=[];popMap[p].push(v)}});
  const pops=Object.values(popMap);
  if(pops.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 populations.</p>');
  const fs=fStatistics(pops);
  H('#wtest-result',`<div class="eg"><div class="ec"><div class="el">Fst</div><div class="ev">${fs.Fst.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Fis</div><div class="ev">${fs.Fis.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Fit</div><div class="ev">${fs.Fit.toFixed(4)}</div></div>
    <div class="ec"><div class="el">Populations</div><div class="ev">${fs.k}</div></div>
    <div class="ec"><div class="el">Total N</div><div class="ev">${fs.N}</div></div></div>
    <p style="font-size:12px;color:var(--ts);margin:6px 0">Fst: ${fs.Fst<0.05?'Little differentiation':fs.Fst<0.15?'Moderate differentiation':fs.Fst<0.25?'Great differentiation':'Very great differentiation'} (Wright 1978)</p>
    <p style="font-size:11px;color:var(--tm)">Simplified Weir & Cockerham F-statistics. ${freqCol} by ${popCol}.</p>`)}

function runWSPopDyn(){
  let html=`<div style="font-size:12px;color:var(--ts);margin-bottom:10px">Simulate population dynamics. Choose a model:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    <select class="fs" id="pdModel"><option value="logistic">Logistic Growth</option><option value="bh">Beverton-Holt</option></select>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">N₀:</span><input class="fi" id="pdN0" value="100" style="width:60px" type="number"/>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">r:</span><input class="fi" id="pdR" value="0.3" style="width:60px" type="number" step="0.05"/>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">K:</span><input class="fi" id="pdK" value="1000" style="width:70px" type="number"/>
    <span style="font-size:11px;color:var(--tm);font-family:var(--mf)">Years:</span><input class="fi" id="pdYrs" value="50" style="width:60px" type="number"/>
    <button class="bt bt-pri" onclick="computePopDyn()">Simulate</button></div>
    <div class="pcc" id="pdPlot" style="height:300px"></div>`;
  H('#wtest-result',html)}
function computePopDyn(){
  const model=$('#pdModel').value;const N0=parseFloat($('#pdN0').value)||100;
  const r=parseFloat($('#pdR').value)||0.3;const K=parseFloat($('#pdK').value)||1000;
  const years=parseInt($('#pdYrs').value)||50;
  let traj;
  if(model==='logistic')traj=logisticGrowth(N0,r,K,years);
  else traj=bevertonHolt(N0,r/K,1/K,years);
  const yKey=model==='logistic'?'N':'R';
  Plotly.newPlot('pdPlot',[{x:traj.map(d=>d.year),y:traj.map(d=>d[yKey]),type:'scatter',mode:'lines',line:{color:'#C9956B',width:2},fill:'tozeroy',fillcolor:'rgba(201,149,107,0.1)',name:model==='logistic'?'Population (N)':'Recruitment (R)'}],
    {...PL,height:300,title:{text:model==='logistic'?`Logistic Growth (r=${r}, K=${K})`:`Beverton-Holt (α=${(r/K).toFixed(4)})`,font:{size:12}},xaxis:{...PL.xaxis,title:'Year'},yaxis:{...PL.yaxis,title:yKey}},{responsive:true})}

function runWSForecast(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  const dtC=S.wsC.find(c=>S.wsCT[c]==='datetime');
  if(!nc.length)return H('#wtest-result','<p style="color:var(--co)">Need numeric data to forecast.</p>');
  const yCol=nc[0];
  const data=S.wsD.filter(r=>typeof r[yCol]==='number').map((r,i)=>({time:dtC?r[dtC]:`${2000+Math.floor(i/12)}-${String((i%12)+1).padStart(2,'0')}-15`,value:r[yCol]}));
  if(data.length<20)return H('#wtest-result','<p style="color:var(--co)">Need ≥20 data points for forecasting.</p>');
  const seasonLen=data.length>100?12:Math.max(4,Math.floor(data.length/5));
  const hw=holtWinters(data,seasonLen,Math.min(90,Math.floor(data.length*0.3)));
  if(!hw)return H('#wtest-result','<p style="color:var(--co)">Holt-Winters failed — try more data.</p>');
  H('#wtest-result','<div class="pcc" id="wsFcPlot" style="height:300px"></div><p style="font-size:11px;color:var(--tm);margin-top:6px">Holt-Winters triple exponential smoothing. Season length: '+seasonLen+'.</p>');
  setTimeout(()=>Plotly.newPlot('wsFcPlot',[
    {x:data.map(d=>d.time),y:data.map(d=>d.value),type:'scatter',mode:'lines',line:{color:CL[0],width:2},name:'Observed'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.value),type:'scatter',mode:'lines',line:{color:'var(--sg)',width:2,dash:'dash'},name:'Forecast'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.hi),type:'scatter',mode:'lines',line:{width:0},showlegend:false,hoverinfo:'skip'},
    {x:hw.forecast.map(d=>d.time),y:hw.forecast.map(d=>d.lo),type:'scatter',mode:'lines',line:{width:0},fill:'tonexty',fillcolor:'rgba(123,158,135,0.15)',name:'95% CI'}
  ],{...PL,height:300,title:{text:yCol+' — Holt-Winters Forecast',font:{size:12}},xaxis:{...PL.xaxis}},{responsive:true}),100)}

function runSelectivity(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!numC.length)return H('#wtest-result','<p style="color:var(--co)">Need a length/size column.</p>');
  const col=numC[0];logTest('selectivity',{col});
  const vals=S.wsD.map(r=>typeof r[col]==='number'?r[col]:null).filter(v=>v!==null&&v>0);
  if(vals.length<20)return H('#wtest-result','<p style="color:var(--co)">Need ≥20 data points.</p>');
  // Build length-frequency and fit logistic selectivity: S(L) = 1/(1+exp(-a*(L-L50)))
  const minV=Math.min(...vals),maxV=Math.max(...vals);const binW=(maxV-minV)/20;
  const bins=Array.from({length:20},(_,i)=>minV+binW*(i+0.5));
  const counts=bins.map(b=>vals.filter(v=>v>=b-binW/2&&v<b+binW/2).length);
  const maxCount=Math.max(...counts);const freq=counts.map(c=>c/maxCount);
  // Cumulative proportion for logistic fit
  const cumFreq=[];let cum=0;counts.forEach(c=>{cum+=c;cumFreq.push(cum)});
  const total=cum;const cumProp=cumFreq.map(c=>c/total);
  // Fit L50 and a via least squares on logit transform
  const validPts=bins.map((b,i)=>({L:b,p:cumProp[i]})).filter(pt=>pt.p>0.01&&pt.p<0.99);
  if(validPts.length<3){H('#wtest-result','<p style="color:var(--co)">Insufficient range for logistic fit.</p>');return}
  const logitP=validPts.map(pt=>Math.log(pt.p/(1-pt.p)));const logitL=validPts.map(pt=>pt.L);
  const n=logitP.length;const mX=logitL.reduce((a,b)=>a+b,0)/n;const mY=logitP.reduce((a,b)=>a+b,0)/n;
  let sxy=0,sxx=0;for(let i=0;i<n;i++){sxy+=(logitL[i]-mX)*(logitP[i]-mY);sxx+=(logitL[i]-mX)**2}
  const slope=sxx?sxy/sxx:1;const L50=slope?mX-mY/slope:mX;const steepness=Math.abs(slope);
  const fitBins=Array.from({length:50},(_,i)=>minV+(maxV-minV)*i/49);
  const fitSel=fitBins.map(L=>1/(1+Math.exp(-slope*(L-L50))));
  H('#wtest-result',`<div class="pcc" id="selPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">L₅₀</div><div class="ev">${L50.toFixed(2)}</div></div>
  <div class="ec"><div class="el">Steepness</div><div class="ev">${steepness.toFixed(3)}</div></div>
  <div class="ec"><div class="el">n</div><div class="ev">${vals.length}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Logistic selectivity · S(L)=1/(1+exp(−a(L−L₅₀))) · ${col}</p>`);
  setTimeout(()=>Plotly.newPlot('selPlot',[{x:bins,y:freq,type:'bar',marker:{color:'rgba(91,143,168,.5)'},name:'Relative Freq.',width:binW*0.8},{x:fitBins,y:fitSel,type:'scatter',mode:'lines',line:{color:'#C9956B',width:2.5},name:'Selectivity curve',yaxis:'y2'},{x:[L50,L50],y:[0,1],type:'scatter',mode:'lines',line:{color:'var(--co)',width:1,dash:'dot'},name:'L₅₀',yaxis:'y2'}],{...PL,height:300,title:{text:'Selectivity Curve — '+col,font:{size:12}},xaxis:{...PL.xaxis,title:col},yaxis:{...PL.yaxis,title:'Relative Frequency'},yaxis2:{overlaying:'y',side:'right',title:'Selectivity',range:[0,1.05],gridcolor:'transparent',tickfont:{color:'var(--tm)'},titlefont:{color:'var(--tm)'}}},{responsive:true}),100);
}

function runYPR(){
  logTest('ypr',{});
  // Interactive parameter form
  H('#wtest-result',`<div style="font-size:12px"><strong>Yield-per-Recruit (Beverton-Holt)</strong>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0">
  <label style="font-size:11px">M (natural mortality):<input id="ypr-M" type="number" value="0.2" step="0.05" min="0.01" max="2" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">K (growth coeff):<input id="ypr-K" type="number" value="0.15" step="0.05" min="0.01" max="2" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">L∞ (cm):<input id="ypr-Linf" type="number" value="100" step="5" min="1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">t₀:<input id="ypr-t0" type="number" value="-0.5" step="0.1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">tᵣ (recruitment age):<input id="ypr-tr" type="number" value="1" step="0.5" min="0" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">tₘₐₓ:<input id="ypr-tmax" type="number" value="20" step="1" min="2" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">W∞ (g):<input id="ypr-Winf" type="number" value="10000" step="100" min="1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">tₑ (entry to fishery):<input id="ypr-tc" type="number" value="3" step="0.5" min="0" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  </div><button class="bt sm" onclick="computeYPR()">Compute YPR</button></div>`);
}
function computeYPR(){
  const M=parseFloat($('#ypr-M')?.value)||0.2;const K=parseFloat($('#ypr-K')?.value)||0.15;
  const Linf=parseFloat($('#ypr-Linf')?.value)||100;const t0=parseFloat($('#ypr-t0')?.value)||-0.5;
  const tr=parseFloat($('#ypr-tr')?.value)||1;const tmax=parseFloat($('#ypr-tmax')?.value)||20;
  const Winf=parseFloat($('#ypr-Winf')?.value)||10000;const tc=parseFloat($('#ypr-tc')?.value)||3;
  const Fvals=Array.from({length:50},(_,i)=>i*0.04);
  const ypr=Fvals.map(F=>{
    const Z=F+M;const S=[-1,3,-3,1];
    let Y=0;for(let n=0;n<4;n++){const c=S[n];const Zn=Z+n*K;
    Y+=c*F*Winf/Zn*(1-Math.exp(-Zn*(tmax-tc)))*Math.exp(-M*(tc-tr)-n*K*(tc-t0))}
    return Math.max(0,Y)});
  const Fmax=Fvals[ypr.indexOf(Math.max(...ypr))];
  // F0.1: slope = 10% of slope at origin
  const slope0=ypr.length>1?(ypr[1]-ypr[0])/0.04:0;
  let F01=Fmax;for(let i=1;i<ypr.length-1;i++){const slope=(ypr[i+1]-ypr[i])/0.04;if(slope<=slope0*0.1){F01=Fvals[i];break}}
  const el=$('#wtest-result');
  el.innerHTML+=`<div class="pcc" id="yprPlot" style="height:300px;margin-top:10px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">F_max</div><div class="ev">${Fmax.toFixed(3)}</div></div>
  <div class="ec"><div class="el">F₀.₁</div><div class="ev">${F01.toFixed(3)}</div></div>
  <div class="ec"><div class="el">Max YPR</div><div class="ev">${Math.max(...ypr).toFixed(1)} g</div></div>
  <div class="ec"><div class="el">M/K</div><div class="ev">${(M/K).toFixed(2)}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Beverton-Holt Y/R · M=${M} K=${K} L∞=${Linf} tₑ=${tc}</p>`;
  setTimeout(()=>Plotly.newPlot('yprPlot',[{x:Fvals,y:ypr,type:'scatter',mode:'lines',line:{color:'#7B9E87',width:2.5},name:'Y/R'},{x:[Fmax,Fmax],y:[0,Math.max(...ypr)*1.1],type:'scatter',mode:'lines',line:{color:'var(--co)',dash:'dot',width:1},name:'F_max'},{x:[F01,F01],y:[0,Math.max(...ypr)*1.1],type:'scatter',mode:'lines',line:{color:'#5B8FA8',dash:'dot',width:1},name:'F₀.₁'}],{...PL,height:300,title:{text:'Yield-per-Recruit',font:{size:12}},xaxis:{...PL.xaxis,title:'Fishing Mortality (F)'},yaxis:{...PL.yaxis,title:'Y/R (g)'}},{responsive:true}),100);
}

function runStockRecruitment(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need stock (SSB) and recruitment columns.</p>');
  const sCol=numC[0],rCol=numC[1];logTest('sr',{sCol,rCol});
  const data=S.wsD.filter(r=>typeof r[sCol]==='number'&&r[sCol]>0&&typeof r[rCol]==='number'&&r[rCol]>0).map(r=>({S:r[sCol],R:r[rCol]}));
  if(data.length<5)return H('#wtest-result','<p style="color:var(--co)">Need ≥5 stock-recruit pairs.</p>');
  // Beverton-Holt: R = aS/(1+bS)  →  S/R = 1/a + (b/a)*S
  const srRatio=data.map(d=>d.S/d.R);const Svals=data.map(d=>d.S);
  const n=data.length;const mS=Svals.reduce((a,b)=>a+b,0)/n;const mSR=srRatio.reduce((a,b)=>a+b,0)/n;
  let ssxy=0,ssxx=0;for(let i=0;i<n;i++){ssxy+=(Svals[i]-mS)*(srRatio[i]-mSR);ssxx+=(Svals[i]-mS)**2}
  const bh_ba=ssxx?ssxy/ssxx:0;const bh_1a=mSR-bh_ba*mS;
  const bh_a=bh_1a>0?1/bh_1a:1;const bh_b=bh_ba*bh_a;
  // Ricker: R = aS*exp(-bS)  →  ln(R/S) = ln(a) - b*S
  const lnRS=data.map(d=>Math.log(d.R/d.S));
  const mLnRS=lnRS.reduce((a,b)=>a+b,0)/n;
  let rssxy=0;for(let i=0;i<n;i++)rssxy+=(Svals[i]-mS)*(lnRS[i]-mLnRS);
  const ri_b=ssxx?-rssxy/ssxx:0;const ri_lna=mLnRS+ri_b*mS;const ri_a=Math.exp(ri_lna);
  const fitS=Array.from({length:50},(_,i)=>Math.min(...Svals)+(Math.max(...Svals)-Math.min(...Svals))*i/49);
  const bhFit=fitS.map(s=>bh_a*s/(1+bh_b*s));
  const riFit=fitS.map(s=>ri_a*s*Math.exp(-ri_b*s));
  H('#wtest-result',`<div class="pcc" id="srPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">BH α</div><div class="ev">${bh_a.toFixed(2)}</div></div>
  <div class="ec"><div class="el">BH β</div><div class="ev">${bh_b.toExponential(3)}</div></div>
  <div class="ec"><div class="el">Ricker α</div><div class="ev">${ri_a.toFixed(2)}</div></div>
  <div class="ec"><div class="el">Ricker β</div><div class="ev">${ri_b.toExponential(3)}</div></div>
  <div class="ec"><div class="el">n</div><div class="ev">${n}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Stock-Recruitment · ${sCol} (SSB) vs ${rCol} (Recruits) · Beverton-Holt + Ricker</p>`);
  setTimeout(()=>Plotly.newPlot('srPlot',[{x:data.map(d=>d.S),y:data.map(d=>d.R),type:'scatter',mode:'markers',marker:{size:6,color:'#5B8FA8',opacity:.7},name:'Observed'},{x:fitS,y:bhFit,type:'scatter',mode:'lines',line:{color:'#7B9E87',width:2},name:'Beverton-Holt'},{x:fitS,y:riFit,type:'scatter',mode:'lines',line:{color:'#C9956B',width:2,dash:'dash'},name:'Ricker'}],{...PL,height:300,title:{text:'Stock-Recruitment',font:{size:12}},xaxis:{...PL.xaxis,title:sCol+' (SSB)'},yaxis:{...PL.yaxis,title:rCol+' (Recruitment)'}},{responsive:true}),100);
}

function runMaturityOgive(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need length/age column and maturity (0/1) column.</p>');
  const sizeCol=numC[0],matCol=numC[1];logTest('maturity',{sizeCol,matCol});
  const data=S.wsD.filter(r=>typeof r[sizeCol]==='number'&&(r[matCol]===0||r[matCol]===1)).map(r=>({x:r[sizeCol],m:r[matCol]})).sort((a,b)=>a.x-b.x);
  if(data.length<10)return H('#wtest-result','<p style="color:var(--co)">Need ≥10 rows with binary maturity (0/1).</p>');
  // Fit logistic: P(mature) = 1/(1+exp(-(a+b*x))) via IRLS (1 iteration approx)
  const n=data.length;const X=data.map(d=>d.x);const Y=data.map(d=>d.m);
  const mX=X.reduce((a,b)=>a+b,0)/n;
  // Bin data for smoother fit
  const minX=Math.min(...X),maxX=Math.max(...X);const bw=(maxX-minX)/15;
  const binned=[];for(let b=minX;b<maxX;b+=bw){const pts=data.filter(d=>d.x>=b&&d.x<b+bw);if(pts.length>=2){const prop=pts.reduce((s,p)=>s+p.m,0)/pts.length;const mid=b+bw/2;if(prop>0.01&&prop<0.99)binned.push({x:mid,logit:Math.log(prop/(1-prop))})}}
  if(binned.length<2)return H('#wtest-result','<p style="color:var(--co)">Insufficient maturity variation for logistic fit.</p>');
  const bX=binned.map(b=>b.x),bY=binned.map(b=>b.logit);
  const bmX=bX.reduce((a,b)=>a+b,0)/bX.length;const bmY=bY.reduce((a,b)=>a+b,0)/bY.length;
  let sxy=0,sxx=0;for(let i=0;i<bX.length;i++){sxy+=(bX[i]-bmX)*(bY[i]-bmY);sxx+=(bX[i]-bmX)**2}
  const slope=sxx?sxy/sxx:1;const intercept=bmY-slope*bmX;
  const L50=slope?-intercept/slope:mX;const L95=slope?-(intercept+Math.log(19))/slope:mX;
  const fitX=Array.from({length:50},(_,i)=>minX+(maxX-minX)*i/49);
  const fitY=fitX.map(x=>1/(1+Math.exp(-(intercept+slope*x))));
  H('#wtest-result',`<div class="pcc" id="matPlot" style="height:300px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">L₅₀ / A₅₀</div><div class="ev">${L50.toFixed(2)}</div></div>
  <div class="ec"><div class="el">L₉₅ / A₉₅</div><div class="ev">${L95.toFixed(2)}</div></div>
  <div class="ec"><div class="el">Slope</div><div class="ev">${slope.toFixed(4)}</div></div>
  <div class="ec"><div class="el">n</div><div class="ev">${data.length}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Maturity ogive (logistic GLM) · ${sizeCol} vs ${matCol} · L₅₀ = size at 50% maturity</p>`);
  setTimeout(()=>Plotly.newPlot('matPlot',[{x:X,y:Y.map(v=>v+((Math.random()-0.5)*0.05)),type:'scatter',mode:'markers',marker:{size:4,color:Y.map(v=>v?'#7B9E87':'#C27878'),opacity:.5},name:'Observations'},{x:fitX,y:fitY,type:'scatter',mode:'lines',line:{color:'#C9956B',width:2.5},name:'Ogive'},{x:[L50,L50],y:[0,1],type:'scatter',mode:'lines',line:{color:'var(--co)',width:1,dash:'dot'},name:'L₅₀'},{x:[L95,L95],y:[0,1],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},name:'L₉₅'}],{...PL,height:300,title:{text:'Maturity Ogive',font:{size:12}},xaxis:{...PL.xaxis,title:sizeCol},yaxis:{...PL.yaxis,title:'P(Mature)',range:[-0.05,1.05]}},{responsive:true}),100);
}

function runMarkRecapture(){
  logTest('mr',{});
  H('#wtest-result',`<div style="font-size:12px"><strong>Mark-Recapture Population Estimate</strong>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0">
  <label style="font-size:11px">M (marked in 1st sample):<input id="mr-M" type="number" value="100" min="1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">C (2nd sample size):<input id="mr-C" type="number" value="80" min="1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">R (recaptured marks):<input id="mr-R" type="number" value="10" min="0" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  </div><button class="bt sm" onclick="computeMR()">Estimate N</button>
  <p style="font-size:10px;color:var(--tm);margin-top:6px">Or load Workshop data with columns: marked, captured, recaptured</p></div>`);
  // Auto-fill from workshop data if available
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length>=3){const row=S.wsD[0];if(row){
    const mEl=$('#mr-M'),cEl=$('#mr-C'),rEl=$('#mr-R');
    if(mEl&&typeof row[numC[0]]==='number')mEl.value=row[numC[0]];
    if(cEl&&typeof row[numC[1]]==='number')cEl.value=row[numC[1]];
    if(rEl&&typeof row[numC[2]]==='number')rEl.value=row[numC[2]]}}
}
function computeMR(){
  const M=parseInt($('#mr-M')?.value)||0;const C=parseInt($('#mr-C')?.value)||0;const R=parseInt($('#mr-R')?.value)||0;
  if(!M||!C||R<0)return toast('Invalid parameters','err');
  if(R===0)return toast('No recaptures — population estimate is infinite','err');
  // Lincoln-Petersen: N = MC/R
  const N_LP=M*C/R;
  // Chapman: N = (M+1)(C+1)/(R+1) - 1
  const N_Ch=(M+1)*(C+1)/(R+1)-1;
  // Approximate 95% CI (Chapman)
  const varN=(M+1)*(C+1)*(M-R)*(C-R)/((R+1)**2*(R+2));
  const se=Math.sqrt(varN);const ci95=[Math.max(0,N_Ch-1.96*se),N_Ch+1.96*se];
  const el=$('#wtest-result');
  el.innerHTML+=`<div class="eg" style="margin-top:10px">
  <div class="ec"><div class="el">Lincoln-Petersen N̂</div><div class="ev">${Math.round(N_LP).toLocaleString()}</div></div>
  <div class="ec"><div class="el">Chapman N̂</div><div class="ev">${Math.round(N_Ch).toLocaleString()}</div></div>
  <div class="ec"><div class="el">SE</div><div class="ev">${Math.round(se).toLocaleString()}</div></div>
  <div class="ec"><div class="el">95% CI</div><div class="ev">${Math.round(ci95[0]).toLocaleString()} – ${Math.round(ci95[1]).toLocaleString()}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">M=${M} C=${C} R=${R} · Chapman estimator preferred (bias-corrected)</p>`;
}

// ═══ PHASE 6: META-ANALYSIS, FUNNEL PLOT, DATA QUALITY, SVG ═══
function runMetaAnalysis(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need effect-size and SE/variance columns (or 2 numeric cols).</p>');
  const esCol=numC[0],seCol=numC[1];logTest('meta',{esCol,seCol});
  const data=S.wsD.filter(r=>typeof r[esCol]==='number'&&typeof r[seCol]==='number'&&r[seCol]>0).map((r,i)=>({es:r[esCol],se:r[seCol],label:S.wsC.find(c=>S.wsCT[c]==='nominal')?r[S.wsC.find(c=>S.wsCT[c]==='nominal')]:'Study '+(i+1)}));
  if(data.length<3)return H('#wtest-result','<p style="color:var(--co)">Need ≥3 studies with effect size and SE.</p>');
  // Fixed-effect meta-analysis
  const feW=data.map(d=>1/(d.se**2));const feSum=feW.reduce((a,b)=>a+b,0);
  const feES=feW.reduce((s,w,i)=>s+w*data[i].es,0)/feSum;const feSE=Math.sqrt(1/feSum);
  // DerSimonian-Laird random-effects
  const Q=data.reduce((s,d,i)=>s+feW[i]*(d.es-feES)**2,0);
  const C=feSum-feW.reduce((s,w)=>s+w**2,0)/feSum;
  const tau2=Math.max(0,(Q-(data.length-1))/C);
  const reW=data.map(d=>1/(d.se**2+tau2));const reSum=reW.reduce((a,b)=>a+b,0);
  const reES=reW.reduce((s,w,i)=>s+w*data[i].es,0)/reSum;const reSE=Math.sqrt(1/reSum);
  const I2=Q>data.length-1?((Q-(data.length-1))/Q*100).toFixed(1):'0.0';
  // Forest plot
  const studies=[...data.map((d,i)=>({label:d.label,es:d.es,lo:d.es-1.96*d.se,hi:d.es+1.96*d.se,w:reW[i]/reSum*100})),{label:'RE Summary',es:reES,lo:reES-1.96*reSE,hi:reES+1.96*reSE,w:100,summary:true}];
  const yLabels=studies.map(s=>s.label);const yIdx=studies.map((_,i)=>i);
  H('#wtest-result',`<div class="pcc" id="forestPlot" style="height:${Math.max(250,studies.length*28+60)}px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">RE Effect</div><div class="ev">${reES.toFixed(4)}</div></div>
  <div class="ec"><div class="el">RE SE</div><div class="ev">${reSE.toFixed(4)}</div></div>
  <div class="ec"><div class="el">95% CI</div><div class="ev">[${(reES-1.96*reSE).toFixed(3)}, ${(reES+1.96*reSE).toFixed(3)}]</div></div>
  <div class="ec"><div class="el">τ²</div><div class="ev">${tau2.toFixed(4)}</div></div>
  <div class="ec"><div class="el">I²</div><div class="ev">${I2}%</div></div>
  <div class="ec"><div class="el">Q</div><div class="ev">${Q.toFixed(2)} (df=${data.length-1})</div></div>
  <div class="ec"><div class="el">k studies</div><div class="ev">${data.length}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">DerSimonian-Laird random-effects · ${esCol} ± ${seCol}</p>`);
  setTimeout(()=>{
    const traces=[
      {x:studies.map(s=>s.es),y:yIdx,type:'scatter',mode:'markers',marker:{size:studies.map(s=>s.summary?12:Math.max(4,Math.sqrt(s.w)*2)),color:studies.map(s=>s.summary?'#C9956B':'#5B8FA8'),symbol:studies.map(s=>s.summary?'diamond':'circle')},error_x:{type:'data',symmetric:false,array:studies.map(s=>s.hi-s.es),arrayminus:studies.map(s=>s.es-s.lo),color:'var(--tm)',thickness:1.5},showlegend:false},
      {x:[0,0],y:[-0.5,studies.length-0.5],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},showlegend:false}
    ];
    Plotly.newPlot('forestPlot',traces,{...PL,height:Math.max(250,studies.length*28+60),title:{text:'Forest Plot (Random Effects)',font:{size:12}},xaxis:{...PL.xaxis,title:'Effect Size',zeroline:true},yaxis:{...PL.yaxis,ticktext:yLabels,tickvals:yIdx,autorange:'reversed'},margin:{l:120,r:30,t:40,b:40}},{responsive:true})},100);
}

function runFunnelPlot(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<2)return H('#wtest-result','<p style="color:var(--co)">Need effect-size and SE columns.</p>');
  const esCol=numC[0],seCol=numC[1];logTest('funnel',{esCol,seCol});
  const data=S.wsD.filter(r=>typeof r[esCol]==='number'&&typeof r[seCol]==='number'&&r[seCol]>0).map(r=>({es:r[esCol],se:r[seCol]}));
  if(data.length<3)return H('#wtest-result','<p style="color:var(--co)">Need ≥3 studies.</p>');
  // Weighted mean
  const W=data.map(d=>1/d.se**2);const wSum=W.reduce((a,b)=>a+b,0);
  const meanES=W.reduce((s,w,i)=>s+w*data[i].es,0)/wSum;
  const maxSE=Math.max(...data.map(d=>d.se));
  // Egger's regression test: regress standardized effect (ES/SE) on precision (1/SE)
  const prec=data.map(d=>1/d.se);const stdES=data.map(d=>d.es/d.se);
  const n=data.length;const mP=prec.reduce((a,b)=>a+b,0)/n;const mS=stdES.reduce((a,b)=>a+b,0)/n;
  let sxy=0,sxx=0;for(let i=0;i<n;i++){sxy+=(prec[i]-mP)*(stdES[i]-mS);sxx+=(prec[i]-mP)**2}
  const slope=sxx?sxy/sxx:0;const intercept=mS-slope*mP;
  const residuals=data.map((d,i)=>stdES[i]-(intercept+slope*prec[i]));
  const resVar=residuals.reduce((s,r)=>s+r**2,0)/(n-2);
  const seIntercept=Math.sqrt(resVar*(1/n+mP**2/sxx));
  const tStat=seIntercept?intercept/seIntercept:0;
  const pEgger=pFromT(Math.abs(tStat),n-2);
  H('#wtest-result',`<div class="pcc" id="funnelPlot" style="height:350px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Mean ES</div><div class="ev">${meanES.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Egger intercept</div><div class="ev">${intercept.toFixed(3)}</div></div>
  <div class="ec"><div class="el">Egger t</div><div class="ev">${tStat.toFixed(3)}</div></div>
  <div class="ec"><div class="el">Egger p</div><div class="ev" style="color:${pEgger<.05?'var(--co)':'#7B9E87'}">${pEgger.toFixed(4)} ${pEgger<.05?'(asymmetry)':'(symmetric)'}</div></div>
  <div class="ec"><div class="el">k</div><div class="ev">${n}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Funnel plot · ${esCol} vs ${seCol} · Egger's regression test for publication bias</p>`);
  setTimeout(()=>{
    const funnelX=[meanES-1.96*maxSE,meanES,meanES+1.96*maxSE,meanES-1.96*maxSE];
    const funnelY=[maxSE*1.05,0,maxSE*1.05,maxSE*1.05];
    Plotly.newPlot('funnelPlot',[
      {x:funnelX,y:funnelY,type:'scatter',mode:'lines',fill:'toself',fillcolor:'rgba(123,158,135,.08)',line:{color:'rgba(123,158,135,.3)',width:1},name:'95% CI'},
      {x:data.map(d=>d.es),y:data.map(d=>d.se),type:'scatter',mode:'markers',marker:{size:6,color:'#5B8FA8',opacity:.7},name:'Studies'},
      {x:[meanES,meanES],y:[0,maxSE*1.1],type:'scatter',mode:'lines',line:{color:'var(--tm)',width:1,dash:'dot'},name:'Mean'}
    ],{...PL,height:350,title:{text:'Funnel Plot',font:{size:12}},xaxis:{...PL.xaxis,title:'Effect Size'},yaxis:{...PL.yaxis,title:'Standard Error',autorange:'reversed'}},{responsive:true})},100);
}

function detectDataQuality(){
  if(!S.wsD.length)return H('#wtest-result','<p style="color:var(--co)">Load data first.</p>');
  logTest('dq',{});
  const n=S.wsD.length;const issues=[];let html='<div style="font-size:12px"><strong>Data Quality Report</strong>';
  html+='<table style="width:100%;font-size:11px;margin-top:8px;border-collapse:collapse"><tr style="border-bottom:1px solid var(--brd)"><th style="text-align:left;padding:4px">Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Issues</th></tr>';
  S.wsC.forEach(col=>{
    const vals=S.wsD.map(r=>r[col]);const missing=vals.filter(v=>v==null||v==='').length;
    const unique=new Set(vals.filter(v=>v!=null&&v!=='')).size;
    const colIssues=[];
    if(missing>n*0.5)colIssues.push('⚠ >50% missing');
    if(unique===1)colIssues.push('⚠ Constant');
    if(unique===n&&S.wsCT[col]==='nominal')colIssues.push('⚠ All unique (ID?)');
    if(S.wsCT[col]==='continuous'||S.wsCT[col]==='ordinal'){
      const nums=vals.filter(v=>typeof v==='number');
      if(nums.length>5){
        const mean=nums.reduce((a,b)=>a+b,0)/nums.length;
        const sd=Math.sqrt(nums.reduce((s,v)=>s+(v-mean)**2,0)/(nums.length-1));
        const outliers=nums.filter(v=>Math.abs(v-mean)>3*sd).length;
        if(outliers>0)colIssues.push(outliers+' outlier'+(outliers>1?'s':''));
        // Check for negative values in typically positive fields
        if(nums.some(v=>v<0)&&col.toLowerCase().match(/length|weight|age|count|depth|abundance/))colIssues.push('⚠ Negatives');
      }
    }
    const hasIssue=colIssues.length>0;
    html+=`<tr style="border-bottom:1px solid var(--s2)${hasIssue?';background:rgba(194,120,120,.05)':''}"><td style="padding:4px">${escHTML(col)}</td><td style="text-align:center">${S.wsCT[col]||'?'}</td><td style="text-align:center;color:${missing?'var(--co)':'var(--tm)'}">${missing} (${(missing/n*100).toFixed(1)}%)</td><td style="text-align:center">${unique}</td><td style="padding:4px;font-size:10px;color:var(--co)">${colIssues.join(', ')||'✓'}</td></tr>`;
    if(hasIssue)issues.push({col,issues:colIssues});
  });
  html+='</table>';
  // Summary stats
  const totalMissing=S.wsC.reduce((s,c)=>s+S.wsD.filter(r=>r[c]==null||r[c]==='').length,0);
  const totalCells=n*S.wsC.length;
  html+=`<div class="eg" style="margin-top:10px">
  <div class="ec"><div class="el">Rows</div><div class="ev">${n.toLocaleString()}</div></div>
  <div class="ec"><div class="el">Columns</div><div class="ev">${S.wsC.length}</div></div>
  <div class="ec"><div class="el">Completeness</div><div class="ev" style="color:${totalMissing/totalCells<.1?'#7B9E87':'var(--co)'}">${((1-totalMissing/totalCells)*100).toFixed(1)}%</div></div>
  <div class="ec"><div class="el">Issues</div><div class="ev" style="color:${issues.length?'var(--co)':'#7B9E87'}">${issues.length} column${issues.length!==1?'s':''}</div></div></div>
  <p style="font-size:10px;color:var(--tm);margin-top:6px">Automated QC · ${S.wsC.length} columns × ${n} rows</p></div>`;
  H('#wtest-result',html);
}

function exportSVG(){
  const plots=document.querySelectorAll('.js-plotly-plot');
  if(!plots.length)return toast('No charts to export — run an analysis first','err');
  const target=plots[plots.length-1];// Export most recent plot
  Plotly.downloadImage(target,{format:'svg',width:1200,height:600,filename:'meridian_chart'}).then(()=>toast('SVG exported','ok')).catch(()=>{
    // Fallback: try PNG
    Plotly.downloadImage(target,{format:'png',width:1200,height:600,filename:'meridian_chart'}).then(()=>toast('PNG exported (SVG not supported in this browser)','ok')).catch(()=>toast('Export failed','err'))});
}

// ═══ PHASE 7: MODELING & SIMULATION ═══
function runSDM(){
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(numC.length<3)return H('#wtest-result','<p style="color:var(--co)">Need: lat, lon, and ≥1 environmental variable column.</p>');
  logTest('sdm',{});
  // Assume first two numeric cols are lat/lon, rest are env predictors
  const latCol=S.wsC.find(c=>c.toLowerCase().match(/lat/i))||numC[0];
  const lonCol=S.wsC.find(c=>c.toLowerCase().match(/lon/i))||numC[1];
  const envCols=numC.filter(c=>c!==latCol&&c!==lonCol);
  if(!envCols.length)return H('#wtest-result','<p style="color:var(--co)">Need environmental predictor columns beyond lat/lon.</p>');
  const presCol=S.wsC.find(c=>c.toLowerCase().match(/pres|occur|presence/i));
  const data=S.wsD.filter(r=>typeof r[latCol]==='number'&&typeof r[lonCol]==='number'&&envCols.every(c=>typeof r[c]==='number'));
  if(data.length<10)return H('#wtest-result','<p style="color:var(--co)">Need ≥10 complete rows.</p>');
  // Maxent-like approach: logistic regression on environmental envelope
  // Standardize env vars
  const envMeans={},envSDs={};
  envCols.forEach(c=>{const vals=data.map(r=>r[c]);envMeans[c]=vals.reduce((a,b)=>a+b,0)/vals.length;envSDs[c]=Math.sqrt(vals.reduce((s,v)=>s+(v-envMeans[c])**2,0)/(vals.length-1))||1});
  // Simple environmental envelope: score = product of Gaussian probabilities
  const scores=data.map(r=>{let s=0;envCols.forEach(c=>{const z=(r[c]-envMeans[c])/envSDs[c];s+=z*z});return Math.exp(-s/2/envCols.length)});
  const maxScore=Math.max(...scores);const normScores=scores.map(s=>s/maxScore);
  // Variable importance (based on variance in standardized values)
  const importance=envCols.map(c=>{const vals=data.map(r=>(r[c]-envMeans[c])/envSDs[c]);const variance=vals.reduce((s,v)=>s+v**2,0)/vals.length;return{col:c,imp:variance}}).sort((a,b)=>b.imp-a.imp);
  const totalImp=importance.reduce((s,v)=>s+v.imp,0);
  H('#wtest-result',`<div class="pcc" id="sdmMap" style="height:350px"></div>
  <div style="margin-top:8px"><strong style="font-size:12px">Variable Importance</strong>
  <table style="width:100%;font-size:11px;margin-top:4px;border-collapse:collapse"><tr style="border-bottom:1px solid var(--brd)"><th style="text-align:left;padding:4px">Variable</th><th>Contribution (%)</th><th>Bar</th></tr>
  ${importance.map(v=>`<tr style="border-bottom:1px solid var(--s2)"><td style="padding:4px">${escHTML(v.col)}</td><td style="text-align:center">${(v.imp/totalImp*100).toFixed(1)}</td><td><div style="width:${v.imp/totalImp*100}%;height:12px;background:#7B9E87;border-radius:2px"></div></td></tr>`).join('')}
  </table></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Points</div><div class="ev">${data.length}</div></div>
  <div class="ec"><div class="el">Predictors</div><div class="ev">${envCols.length}</div></div>
  <div class="ec"><div class="el">Mean suitability</div><div class="ev">${(normScores.reduce((a,b)=>a+b,0)/normScores.length).toFixed(3)}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Mahalanobis-envelope SDM · ${envCols.join(', ')} · Score = multivariate Gaussian distance</p>`);
  setTimeout(()=>Plotly.newPlot('sdmMap',[{type:'scattergeo',lat:data.map(r=>r[latCol]),lon:data.map(r=>r[lonCol]),marker:{size:6,color:normScores,colorscale:[[0,'#2a2a3a'],[0.25,'#5B8FA8'],[0.5,'#C9956B'],[0.75,'#D4A04A'],[1,'#7B9E87']],showscale:true,colorbar:{title:'Suitability',len:.6},opacity:.8},text:normScores.map(s=>'Score: '+s.toFixed(3)),mode:'markers'}],{...PL,height:350,title:{text:'Habitat Suitability Map',font:{size:12}},geo:{showland:true,landcolor:'#1a1a2e',showocean:true,oceancolor:'#0d1b2a',coastlinecolor:'#444',projection:{type:'natural earth'},showframe:false}},{responsive:true}),100);
}

function runTrophicNetwork(){
  const nomC=S.wsC.filter(c=>S.wsCT[c]==='nominal');
  const numC=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(nomC.length<2)return H('#wtest-result',`<p style="color:var(--co)">Need 2 categorical columns (predator, prey) and optionally 1 numeric (weight/frequency).</p>
  <div style="font-size:11px;margin-top:8px;color:var(--tm)">Expected format: Column 1 = predator/source, Column 2 = prey/target, Column 3 (optional) = interaction strength</div>`);
  const srcCol=nomC[0],tgtCol=nomC[1];const wtCol=numC.length?numC[0]:null;
  logTest('trophic',{srcCol,tgtCol,wtCol});
  // Build adjacency
  const nodes=new Set();const links=[];
  S.wsD.forEach(r=>{if(!r[srcCol]||!r[tgtCol])return;nodes.add(String(r[srcCol]));nodes.add(String(r[tgtCol]));
    links.push({source:String(r[srcCol]),target:String(r[tgtCol]),weight:wtCol&&typeof r[wtCol]==='number'?r[wtCol]:1})});
  const nodeArr=[...nodes];if(nodeArr.length<2)return H('#wtest-result','<p style="color:var(--co)">Need ≥2 unique nodes.</p>');
  // Calculate network metrics
  const inDeg={},outDeg={};nodeArr.forEach(n=>{inDeg[n]=0;outDeg[n]=0});
  links.forEach(l=>{outDeg[l.source]=(outDeg[l.source]||0)+1;inDeg[l.target]=(inDeg[l.target]||0)+1});
  const connectance=links.length/(nodeArr.length**2);
  // Assign trophic levels (simple: nodes with no prey = level 1)
  const tl={};nodeArr.forEach(n=>{tl[n]=inDeg[n]===0&&outDeg[n]>0?1:(outDeg[n]===0?3:2)});
  // Sankey diagram via Plotly
  const nodeIdx={};nodeArr.forEach((n,i)=>nodeIdx[n]=i);
  H('#wtest-result',`<div class="pcc" id="trophicPlot" style="height:400px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Nodes</div><div class="ev">${nodeArr.length}</div></div>
  <div class="ec"><div class="el">Links</div><div class="ev">${links.length}</div></div>
  <div class="ec"><div class="el">Connectance</div><div class="ev">${connectance.toFixed(4)}</div></div>
  <div class="ec"><div class="el">Producers</div><div class="ev">${nodeArr.filter(n=>tl[n]===1).length}</div></div>
  <div class="ec"><div class="el">Consumers</div><div class="ev">${nodeArr.filter(n=>tl[n]===2).length}</div></div>
  <div class="ec"><div class="el">Top predators</div><div class="ev">${nodeArr.filter(n=>tl[n]===3).length}</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Trophic network · ${srcCol} → ${tgtCol} · Sankey visualization</p>`);
  setTimeout(()=>Plotly.newPlot('trophicPlot',[{type:'sankey',node:{label:nodeArr,color:nodeArr.map(n=>tl[n]===1?'#7B9E87':tl[n]===2?'#5B8FA8':'#C9956B'),pad:15,thickness:15,line:{color:'rgba(201,149,107,.12)',width:.5}},link:{source:links.map(l=>nodeIdx[l.source]),target:links.map(l=>nodeIdx[l.target]),value:links.map(l=>l.weight),color:links.map(()=>'rgba(200,200,200,.15)')}}],{...PL,height:400,title:{text:'Trophic Network',font:{size:12}}},{responsive:true}),100);
}

function runLarvalDispersal(){
  logTest('larval',{});
  H('#wtest-result',`<div style="font-size:12px"><strong>Larval Dispersal Simulation</strong>
  <p style="font-size:11px;color:var(--tm);margin-top:4px">Passive particle tracking using idealized current field</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0">
  <label style="font-size:11px">Release lat:<input id="ld-lat" type="number" value="${$('#elat')?$('#elat').value:'25'}" step="0.5" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">Release lon:<input id="ld-lon" type="number" value="${$('#elon')?$('#elon').value:'-80'}" step="0.5" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">Particles:<input id="ld-n" type="number" value="50" min="5" max="500" step="5" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">PLD (days):<input id="ld-pld" type="number" value="30" min="1" max="180" step="1" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">Current speed (m/s):<input id="ld-spd" type="number" value="0.2" min="0.01" max="2" step="0.05" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">Current dir (°):<input id="ld-dir" type="number" value="45" min="0" max="360" step="15" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  <label style="font-size:11px">Diffusion (km²/s):<input id="ld-diff" type="number" value="100" min="1" max="1000" step="10" style="width:80px;margin-left:4px;background:var(--s2);border:1px solid var(--brd);color:var(--fg);border-radius:4px;padding:2px 4px"></label>
  </div><button class="bt sm" onclick="computeDispersal()">Run Simulation</button></div>`);
}
function computeDispersal(){
  const lat0=parseFloat($('#ld-lat')?.value)||25;const lon0=parseFloat($('#ld-lon')?.value)||-80;
  const nPart=parseInt($('#ld-n')?.value)||50;const pld=parseInt($('#ld-pld')?.value)||30;
  const spd=parseFloat($('#ld-spd')?.value)||0.2;const dir=parseFloat($('#ld-dir')?.value)||45;
  const diff=parseFloat($('#ld-diff')?.value)||100;
  const dt=3600*6;const steps=Math.floor(pld*24*3600/dt);// 6-hour timesteps
  const dirRad=dir*Math.PI/180;const uMean=spd*Math.sin(dirRad);const vMean=spd*Math.cos(dirRad);
  const sigma=Math.sqrt(2*diff*dt)/111000;// Convert diffusion to degrees (approx)
  const uDeg=uMean*dt/111000;const vDeg=vMean*dt/(111000*Math.cos(lat0*Math.PI/180));
  // Simulate particles
  const particles=[];
  for(let p=0;p<nPart;p++){
    let lat=lat0,lon=lon0;const track=[{lat,lon}];
    for(let s=0;s<steps;s++){
      lat+=vDeg+sigma*(Math.random()*2-1);
      lon+=uDeg+sigma*(Math.random()*2-1);
      if(s%4===0)track.push({lat,lon})}// Store every 24h
    particles.push({track,finalLat:lat,finalLon:lon})}
  // Calculate dispersal kernel
  const dists=particles.map(p=>{const dLat=p.finalLat-lat0;const dLon=(p.finalLon-lon0)*Math.cos(lat0*Math.PI/180);return Math.sqrt(dLat**2+dLon**2)*111});
  const meanDist=dists.reduce((a,b)=>a+b,0)/dists.length;const maxDist=Math.max(...dists);
  const el=$('#wtest-result');
  el.innerHTML+=`<div class="pcc" id="dispersalMap" style="height:350px;margin-top:10px"></div>
  <div class="eg" style="margin-top:8px">
  <div class="ec"><div class="el">Particles</div><div class="ev">${nPart}</div></div>
  <div class="ec"><div class="el">PLD</div><div class="ev">${pld} days</div></div>
  <div class="ec"><div class="el">Mean dispersal</div><div class="ev">${meanDist.toFixed(1)} km</div></div>
  <div class="ec"><div class="el">Max dispersal</div><div class="ev">${maxDist.toFixed(1)} km</div></div>
  <div class="ec"><div class="el">Current</div><div class="ev">${spd} m/s @ ${dir}°</div></div></div>
  <p style="font-size:11px;color:var(--tm);margin-top:6px">Passive Lagrangian particle tracking · Gaussian random walk + advection · ${steps} steps × ${dt/3600}h</p>`;
  setTimeout(()=>{
    const traces=[{type:'scattergeo',lat:[lat0],lon:[lon0],marker:{size:12,color:'#C9956B',symbol:'star'},name:'Release',mode:'markers'}];
    // Plot subset of tracks
    const show=Math.min(20,nPart);
    for(let i=0;i<show;i++){const t=particles[i].track;traces.push({type:'scattergeo',lat:t.map(p=>p.lat),lon:t.map(p=>p.lon),mode:'lines',line:{width:1,color:'rgba(91,143,168,.3)'},showlegend:i===0,name:'Tracks'})}
    traces.push({type:'scattergeo',lat:particles.map(p=>p.finalLat),lon:particles.map(p=>p.finalLon),marker:{size:5,color:'#7B9E87',opacity:.6},name:'Final positions',mode:'markers'});
    const allLats=[lat0,...particles.map(p=>p.finalLat)];const allLons=[lon0,...particles.map(p=>p.finalLon)];
    const latPad=(Math.max(...allLats)-Math.min(...allLats))*0.2+1;const lonPad=(Math.max(...allLons)-Math.min(...allLons))*0.2+1;
    Plotly.newPlot('dispersalMap',traces,{...PL,height:350,title:{text:'Larval Dispersal ('+pld+' days)',font:{size:12}},geo:{showland:true,landcolor:'#1a1a2e',showocean:true,oceancolor:'#0d1b2a',coastlinecolor:'#444',lataxis:{range:[Math.min(...allLats)-latPad,Math.max(...allLats)+latPad]},lonaxis:{range:[Math.min(...allLons)-lonPad,Math.max(...allLons)+lonPad]},showframe:false}},{responsive:true})},100);
}

// ═══ METHOD SELECTOR WIZARD ═══
function openMethodWizard(){
  const questions=[
    {q:'What is your primary goal?',opts:[
      {label:'Compare groups',next:1},{label:'Find relationships',next:2},{label:'Explore community structure',next:3},{label:'Model populations/fisheries',next:4},{label:'Analyze time series',next:5},{label:'Meta-analysis',next:6}]},
    {q:'How many groups are you comparing?',opts:[
      {label:'2 groups',rec:['runTTest','runKruskalWallis'],note:'t-test (parametric) or Kruskal-Wallis (non-parametric)'},
      {label:'3+ groups',rec:['runKruskalWallis','runPERMANOVA'],note:'Kruskal-Wallis (univariate) or PERMANOVA (multivariate)'},
      {label:'Groups × species composition',rec:['runANOSIM','runPERMANOVA','runIndicatorSpecies'],note:'ANOSIM/PERMANOVA for composition, Indicator Species for diagnostic taxa'}]},
    {q:'What type of relationship?',opts:[
      {label:'Two variables (correlation)',rec:['runPearson','runSpearmanMatrix'],note:'Pearson (linear) or Spearman (monotonic)'},
      {label:'Length vs weight',rec:['runWeightLength'],note:'Power regression: W = aLᵇ'},
      {label:'Size/age vs maturity',rec:['runMaturityOgive'],note:'Logistic GLM for L₅₀/A₅₀'},
      {label:'Many variables (reduce dimensions)',rec:['runPCA'],note:'PCA biplot for variable relationships'},
      {label:'Environment → species distribution',rec:['runSDM'],note:'Mahalanobis envelope habitat suitability model'}]},
    {q:'Which community analysis?',opts:[
      {label:'Alpha diversity (within-site)',rec:['runDiversity','runRarefaction'],note:'Shannon, Simpson, Pielou + rarefaction curves'},
      {label:'Beta diversity (between-sites)',rec:['runDissimilarity','runNMDS'],note:'Bray-Curtis/Jaccard dissimilarity + ordination'},
      {label:'Food web / trophic structure',rec:['runTrophicNetwork'],note:'Sankey diagram from predator-prey data'}]},
    {q:'Which population/fisheries model?',opts:[
      {label:'Growth (age-length)',rec:['runVBGF'],note:'Von Bertalanffy: L(t) = L∞(1 - e^(-K(t-t₀)))'},
      {label:'Mortality / catch curve',rec:['runCatchCurve'],note:'Linearized catch curve for Z estimate'},
      {label:'Stock assessment (surplus production)',rec:['runSurplusProduction'],note:'Schaefer model with Kobe plot'},
      {label:'Yield optimization',rec:['runYPR'],note:'Beverton-Holt yield-per-recruit'},
      {label:'Stock-recruitment',rec:['runStockRecruitment'],note:'Beverton-Holt + Ricker models'},
      {label:'Selectivity / gear',rec:['runSelectivity'],note:'Logistic selectivity curve from length frequency'},
      {label:'Population size (mark-recapture)',rec:['runMarkRecapture'],note:'Lincoln-Petersen / Chapman estimators'},
      {label:'Length cohorts',rec:['runLengthFreq'],note:'Length-frequency with Bhattacharya modal separation'}]},
    {q:'Which time series analysis?',opts:[
      {label:'Autocorrelation structure',rec:['runACF'],note:'ACF/PACF for lag dependency'},
      {label:'Regime shifts / breakpoints',rec:['runRegimeShift'],note:'Rodionov STARS algorithm'},
      {label:'Seasonal decomposition',rec:['runSeasonalDecomp'],note:'Additive decomposition: trend + seasonal + residual'},
      {label:'Trend detection',rec:['runMannKendall'],note:'Mann-Kendall monotonic trend test'},
      {label:'Trend detection (seasonal)',rec:['runSeasonalDecomp','runMannKendall'],note:'Decompose then test for monotonic trend'}]},
    {q:'Which meta-analysis tool?',opts:[
      {label:'Pool effect sizes',rec:['runMetaAnalysis'],note:'DerSimonian-Laird random-effects forest plot'},
      {label:'Check publication bias',rec:['runFunnelPlot'],note:'Funnel plot + Egger regression test'},
      {label:'Study power / sample size',rec:['runPowerAnalysis'],note:'Power curve for effect size detection'}]}
  ];
  let step=0;
  function renderStep(s){
    const q=questions[s];
    let html=`<div style="font-size:13px;margin-bottom:12px"><strong>${q.q}</strong></div>`;
    html+='<div style="display:flex;flex-direction:column;gap:6px">';
    q.opts.forEach(opt=>{
      if(opt.next!==undefined){
        html+=`<button class="bt" style="text-align:left;padding:8px 12px;background:var(--s2);width:100%" onclick="document.getElementById('wtest-result').innerHTML='';(${renderStep.toString()})(${opt.next})">${opt.label}</button>`;
      }else{
        html+=`<div style="padding:8px 12px;background:var(--s2);border-radius:6px;cursor:pointer" onclick="this.querySelector('.wiz-detail').style.display=this.querySelector('.wiz-detail').style.display==='none'?'block':'none'">
        <div style="font-weight:bold;font-size:12px">${opt.label}</div>
        <div class="wiz-detail" style="display:none;margin-top:6px;font-size:11px;color:var(--tm)">
        <p>${opt.note||''}</p>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        ${(opt.rec||[]).map(fn=>`<button class="bt sm" onclick="event.stopPropagation();${fn}()" style="font-size:11px">${fn.replace('run','').replace(/([A-Z])/g,' $1').trim()}</button>`).join('')}
        </div></div></div>`;
      }
    });
    html+='</div>';
    if(s>0)html+=`<button class="bt sm" style="margin-top:10px;opacity:.6" onclick="(${renderStep.toString()})(0)">← Start over</button>`;
    H('#wtest-result',html);
  }
  renderStep(0);
}

// ═══ PROJECT / SESSION MANAGEMENT ═══
function saveSession(){
  if(!S.wsD.length&&!S.lib.length)return toast('Nothing to save — load data first','err');
  const session={
    version:2,
    timestamp:new Date().toISOString(),
    workshop:{data:S.wsD,columns:S.wsC,types:S.wsCT},
    envData:{lat:$('#elat')?.value||'',lon:$('#elon')?.value||'',selected:S.envSel instanceof Set?[...S.envSel]:(S.envSel||[]),timeSeries:S.envTS||{}},
    speciesQuery:$('#sq')?.value||'',
    activeTab:document.querySelector('.sb-item.active')?.dataset?.tab||'lit'
  };
  const blob=new Blob([JSON.stringify(session)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='meridian_session_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  // Also save to IndexedDB for auto-restore
  try{const tx=db.transaction('collections','readwrite');
    tx.objectStore('collections').put({id:'__session__',type:'session',...session});
    toast('Session saved (file + IndexedDB)','ok')}
  catch(e){toast('Session file saved','ok')}
}

function loadSession(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const text=await file.text();const session=JSON.parse(text);
      if(!session.version)return toast('Invalid session file','err');
      // Restore workshop data
      if(session.workshop&&session.workshop.data?.length){
        S.wsD=session.workshop.data;S.wsC=session.workshop.columns||Object.keys(S.wsD[0]);
        S.wsCT=session.workshop.types||{};
        if(!Object.keys(S.wsCT).length)autoTypes();
        initWS();toast('Workshop data restored ('+S.wsD.length+' rows)','ok')}
      // Restore env data coords
      if(session.envData){
        if(session.envData.lat&&$('#elat'))$('#elat').value=session.envData.lat;
        if(session.envData.lon&&$('#elon'))$('#elon').value=session.envData.lon;
        if(session.envData.selected)S.envSel=new Set(session.envData.selected);
        if(session.envData.timeSeries)S.envTS=session.envData.timeSeries}
      // Restore species query
      if(session.speciesQuery&&$('#sq'))$('#sq').value=session.speciesQuery;
      // Switch to saved tab
      if(session.activeTab)goTab(session.activeTab);
      toast('Session loaded: '+file.name,'ok');
    }catch(e){toast('Failed to load session: '+e.message,'err')}
  };input.click();
}

// Auto-restore last session on load
function autoRestoreSession(){
  try{if(!db)return;const tx=db.transaction('collections','readonly');
    const req=tx.objectStore('collections').get('__session__');
    req.onsuccess=()=>{const s=req.result;if(!s||!s.workshop?.data?.length)return;
      // Only auto-restore if workshop is empty
      if(S.wsD.length)return;
      S.wsD=s.workshop.data;S.wsC=s.workshop.columns||Object.keys(S.wsD[0]);
      S.wsCT=s.workshop.types||{};if(!Object.keys(S.wsCT).length)autoTypes();
      initWS();toast('Previous session restored','info')}}catch{}}

function dropNulls(){
  wsPushUndo('Drop nulls');const before=S.wsD.length;
  S.wsD=S.wsD.filter(r=>S.wsC.every(c=>r[c]!=null&&r[c]!==''));
  toast(`Removed ${before-S.wsD.length} rows. ${S.wsD.length} remain.`,'ok');
  autoTypes();initWS();
}
function dropOutliers(){
  const nc=S.wsC.filter(c=>S.wsCT[c]==='continuous'||S.wsCT[c]==='ordinal');
  if(!nc.length)return toast('No numeric columns','err');
  wsPushUndo('Remove outliers');let removed=0;
  nc.forEach(col=>{
    const vals=S.wsD.map(r=>r[col]).filter(v=>typeof v==='number').sort((a,b)=>a-b);
    const q1=vals[Math.floor(vals.length*0.25)],q3=vals[Math.floor(vals.length*0.75)];
    const iqr=q3-q1,lo=q1-1.5*iqr,hiQ=q3+1.5*iqr;
    const before=S.wsD.length;
    S.wsD=S.wsD.filter(r=>r[col]==null||r[col]===''||(r[col]>=lo&&r[col]<=hiQ));
    removed+=before-S.wsD.length;
  });
  toast(`Removed ${removed} outlier rows (1.5×IQR). ${S.wsD.length} remain.`,'ok');
  autoTypes();initWS();
}
function addColumn(){
  const name=prompt('New column name:');if(!name)return;
  const DANGEROUS_NAMES=/^(__proto__|prototype|constructor|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__|hasOwnProperty|toString|valueOf|toLocaleString)$/;
  if(DANGEROUS_NAMES.test(name)){return toast('Column name "'+name+'" is reserved','err')}
  const formula=prompt(`Formula using column names as variables.\nAvailable: ${S.wsC.join(', ')}\nExample: Year * 2 or Column_A / Column_B`);
  if(!formula)return;
  // Block dangerous patterns: comments, template literals, assignment, property access chains
  if(/\/[\/\*]|`|\.\s*constructor|\.\s*__proto__|\[.*\]|=(?!=)|import|require|fetch|XMLHttp|eval|Function|window|document|globalThis|self|top|parent|frames|location|navigator|localStorage|sessionStorage|indexedDB|crypto|alert|confirm|prompt(?!\()|setTimeout|setInterval|postMessage/.test(formula)){
    return toast('Formula contains disallowed pattern','err');
  }
  // Only allow: column refs, numbers, math operators, Math.*, parens, ternary
  const MATH_WHITELIST=['Math','abs','sqrt','pow','log','exp','min','max','round','floor','ceil','sin','cos','tan','atan2','PI','E','NaN','Infinity','null','true','false','isNaN','isFinite','Number'];
  const safeFormula=formula.replace(/[a-zA-Z_]\w*/g,tok=>{
    if(DANGEROUS_NAMES.test(tok))return 'undefined';
    if(S.wsC.some(c=>c.replace(/[^a-zA-Z0-9_]/g,'_')===tok))return tok;
    if(MATH_WHITELIST.includes(tok))return tok;
    return 'undefined'});
  wsPushUndo('Add column '+name);
  try{
    // Use Object.create(null) to prevent prototype chain access
    S.wsD=S.wsD.map(r=>{
      try{
        const safeR=Object.create(null);for(const c of S.wsC){const k=c.replace(/[^a-zA-Z0-9_]/g,'_');if(!DANGEROUS_NAMES.test(k))safeR[k]=r[c]}
        const vars=S.wsC.filter(c=>!DANGEROUS_NAMES.test(c.replace(/[^a-zA-Z0-9_]/g,'_'))).map(c=>`const ${c.replace(/[^a-zA-Z0-9_]/g,'_')}=safeR['${c.replace(/[^a-zA-Z0-9_]/g,'_')}']`).join(';');
        const val=new Function('safeR',`"use strict";${vars};return ${safeFormula}`)(safeR);
        return{...r,[name]:val};
      }catch{return{...r,[name]:null}}
    });
    S.wsC.push(name);autoTypes();initWS();toast('Column "'+name+'" added','ok');
  }catch(e){wsUndo();toast('Formula error: '+escHTML(e.message),'err')}
}
initWS();
