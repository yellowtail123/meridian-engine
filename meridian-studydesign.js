// ═══ MERIDIAN STUDY DESIGN — Sample Size & Power Calculators ═══

let _sdInitialized = false;

function initStudyDesign() {
  if (_sdInitialized && $('#sd-content')?.children.length) return;
  _sdInitialized = true;
  _renderStudyDesignUI();
}

function _renderStudyDesignUI() {
  const plans = safeParse('meridian_study_plan', []);
  H('#sd-content', `
    <div class="tip-wrap"><button class="tip-toggle" onclick="toggleTipPopover(this)" title="About this tab">i</button><div class="tip tip-pop"><b>Study Design.</b> Power analysis and sampling design calculators for marine ecology. Integrates with gap analysis to suggest appropriate sample sizes. Export and accumulate study plans.<button class="dx" onclick="this.closest('.tip').style.display='none'">&times;</button></div></div>

    ${window._gapData && window._gapData.length ? `<button class="bt sm" onclick="_sdFromGap()" style="margin-bottom:10px">From gap analysis</button>` : ''}

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      <button class="bt sm on" onclick="_sdShowCalc('ttest')">t-test / Means</button>
      <button class="bt sm" onclick="_sdShowCalc('proportion')">Proportion Test</button>
      <button class="bt sm" onclick="_sdShowCalc('rarefaction')">Species Rarefaction</button>
      <button class="bt sm" onclick="_sdShowCalc('transect')">Transect / Quadrat</button>
    </div>
    <div id="sd-calc"></div>
    <div id="sd-results" style="margin-top:16px"></div>
    <div id="sd-plan-section" style="margin-top:24px"></div>
  `);
  _sdShowCalc('ttest');
  _sdRenderStudyPlan();
}

// ═══ Calculator UIs ═══

function _sdShowCalc(type) {
  const el = $('#sd-calc');
  if (!el) return;
  el.closest('.tp')?.querySelectorAll('.bt[onclick^="_sdShowCalc"]').forEach(b => b.classList.remove('on'));
  el.closest('.tp')?.querySelector(`.bt[onclick="_sdShowCalc('${type}')"]`)?.classList.add('on');
  H('#sd-results', '');

  const _lbl = 'font-size:11px;color:var(--tm);font-family:var(--mf)';
  const _box = 'padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)';

  if (type === 'ttest') {
    el.innerHTML = `<div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:10px">Sample Size for Means Comparison (t-test)</h4>
      <p style="font-size:11px;color:var(--ts);font-family:var(--mf);margin-bottom:12px;line-height:1.5">Calculate the sample size needed to detect a specified effect size between groups.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
        <label style="${_lbl}">Test type:
          <select class="fs" id="sd-tt-type" style="width:100%;margin-top:2px">
            <option value="two" selected>Two-sample independent</option>
            <option value="one">One-sample</option>
            <option value="paired">Paired</option>
          </select>
        </label>
        <label style="${_lbl}">Effect size (Cohen's d): <span id="sd-tt-d-val" style="color:var(--ac)">0.50</span>
          <input type="range" id="sd-tt-d" min="0.1" max="2.0" step="0.05" value="0.50" oninput="$('#sd-tt-d-val').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;margin-top:2px;accent-color:var(--ac)">
        </label>
        <label style="${_lbl}">Significance level (&alpha;):
          <select class="fs" id="sd-tt-alpha" style="width:100%;margin-top:2px">
            <option value="0.001">0.001</option>
            <option value="0.01">0.01</option>
            <option value="0.05" selected>0.05</option>
          </select>
        </label>
        <label style="${_lbl}">Target power (1&minus;&beta;): <span id="sd-tt-pow-val" style="color:var(--ac)">0.80</span>
          <input type="range" id="sd-tt-power" min="0.70" max="0.99" step="0.01" value="0.80" oninput="$('#sd-tt-pow-val').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;margin-top:2px;accent-color:var(--ac)">
        </label>
      </div>
      <button class="bt bt-pri" onclick="_sdCalcTTest()" style="margin-top:12px">Calculate Sample Size</button>
    </div>`;
  } else if (type === 'proportion') {
    el.innerHTML = `<div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:10px">Sample Size for Proportion Tests</h4>
      <p style="font-size:11px;color:var(--ts);font-family:var(--mf);margin-bottom:12px;line-height:1.5">Compare two proportions (e.g. survival rates, prevalence, occupancy between groups).</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
        <label style="${_lbl}">Baseline proportion (p1):
          <input type="number" class="si" id="sd-pr-p1" value="0.30" step="0.01" min="0.01" max="0.99" style="width:100%;margin-top:2px">
        </label>
        <label style="${_lbl}">Target proportion (p2):
          <input type="number" class="si" id="sd-pr-p2" value="0.50" step="0.01" min="0.01" max="0.99" style="width:100%;margin-top:2px">
        </label>
        <label style="${_lbl}">Alpha (&alpha;):
          <select class="fs" id="sd-pr-alpha" style="width:100%;margin-top:2px">
            <option value="0.001">0.001</option>
            <option value="0.01">0.01</option>
            <option value="0.05" selected>0.05</option>
          </select>
        </label>
        <label style="${_lbl}">Target power (1&minus;&beta;): <span id="sd-pr-pow-val" style="color:var(--ac)">0.80</span>
          <input type="range" id="sd-pr-power" min="0.70" max="0.99" step="0.01" value="0.80" oninput="$('#sd-pr-pow-val').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;margin-top:2px;accent-color:var(--ac)">
        </label>
        <label style="${_lbl}">Tails:
          <select class="fs" id="sd-pr-tails" style="width:100%;margin-top:2px">
            <option value="2" selected>Two-tailed</option>
            <option value="1">One-tailed</option>
          </select>
        </label>
      </div>
      <button class="bt bt-pri" onclick="_sdCalcProportion()" style="margin-top:12px">Calculate Sample Size</button>
    </div>`;
  } else if (type === 'rarefaction') {
    el.innerHTML = `<div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:10px">Species Richness Sampling (Rarefaction)</h4>
      <p style="font-size:11px;color:var(--ts);font-family:var(--mf);margin-bottom:12px;line-height:1.5">Paste or upload a pilot abundance matrix (rows = sites, columns = species, values = counts). Estimates how many additional sites are needed to reach 95% of asymptotic richness (Chao1).</p>
      <div style="margin-bottom:10px">
        <label style="${_lbl}">Abundance matrix (tab or comma separated, one site per row):
          <textarea class="si" id="sd-rar-data" rows="6" placeholder="sp1&#9;sp2&#9;sp3\n5&#9;0&#9;3\n2&#9;1&#9;0\n0&#9;4&#9;1" style="width:100%;margin-top:4px;font-family:var(--mf);font-size:12px;resize:vertical"></textarea>
        </label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <label class="bt sm" style="cursor:pointer">Upload CSV <input type="file" accept=".csv,.tsv,.txt" onchange="_sdLoadRarFile(this)" style="display:none"></label>
        <button class="bt sm" onclick="_sdLoadRarExample()">Load example</button>
      </div>
      <button class="bt bt-pri" onclick="_sdCalcRarefaction()" style="margin-top:8px">Analyse Sampling Effort</button>
    </div>`;
  } else if (type === 'transect') {
    el.innerHTML = `<div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:10px">Transect / Quadrat Design</h4>
      <p style="font-size:11px;color:var(--ts);font-family:var(--mf);margin-bottom:12px;line-height:1.5">Determine the number of transects or quadrats needed based on pilot data variability and desired precision.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
        <label style="${_lbl}">Target parameter:
          <select class="fs" id="sd-tr-param" style="width:100%;margin-top:2px">
            <option value="density" selected>Density</option>
            <option value="cover">Cover (%)</option>
            <option value="biomass">Biomass</option>
          </select>
        </label>
        <label style="${_lbl}">Pilot mean (x&#772;):
          <input type="number" class="si" id="sd-tr-mean" value="12.5" step="0.1" min="0.001" style="width:100%;margin-top:2px">
        </label>
        <label style="${_lbl}">Pilot standard deviation (s):
          <input type="number" class="si" id="sd-tr-sd" value="6.3" step="0.1" min="0.001" style="width:100%;margin-top:2px">
        </label>
        <label style="${_lbl}">Acceptable margin of error (% of mean): <span id="sd-tr-marg-val" style="color:var(--ac)">20%</span>
          <input type="range" id="sd-tr-margin" min="5" max="50" step="1" value="20" oninput="$('#sd-tr-marg-val').textContent=this.value+'%'" style="width:100%;margin-top:2px;accent-color:var(--ac)">
        </label>
        <label style="${_lbl}">Alpha (&alpha;):
          <select class="fs" id="sd-tr-alpha" style="width:100%;margin-top:2px">
            <option value="0.01">0.01</option>
            <option value="0.05" selected>0.05</option>
            <option value="0.10">0.10</option>
          </select>
        </label>
        <label style="${_lbl}" id="sd-tr-width-wrap">Strip width (m, for density):
          <input type="number" class="si" id="sd-tr-width" value="2" step="0.5" min="0.1" style="width:100%;margin-top:2px">
        </label>
      </div>
      <button class="bt bt-pri" onclick="_sdCalcTransect()" style="margin-top:12px">Calculate Design</button>
    </div>`;
    $('#sd-tr-param')?.addEventListener('change', function() {
      const w = $('#sd-tr-width-wrap');
      if (w) w.style.display = this.value === 'density' ? '' : 'none';
    });
  }
}

// ═══ Statistical Engines ═══

// Normal CDF (Horner approximation)
function _sdNormCDF(z) {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * a);
  const d = 0.3989423 * Math.exp(-a * a / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Inverse normal (Beasley-Springer-Moro)
function _sdNormInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const dd = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((dd[0]*q+dd[1])*q+dd[2])*q+dd[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((dd[0]*q+dd[1])*q+dd[2])*q+dd[3])*q+1);
  }
}

// Power for t-test (normal approximation)
// testType: 'two','one','paired'
function _sdTTestPower(n, d, alpha, testType) {
  const k = testType === 'one' ? 1 : 2; // multiplier for two-sample/paired
  const zAlpha = _sdNormInv(1 - alpha / 2);
  const se = d * Math.sqrt(n / k);
  return 1 - _sdNormCDF(zAlpha - se) + _sdNormCDF(-zAlpha - se);
}

// Sample size for t-test
function _sdTTestN(d, alpha, targetPower, testType) {
  for (let n = 2; n <= 10000; n++) {
    if (_sdTTestPower(n, d, alpha, testType) >= targetPower) return n;
  }
  return 10001;
}

// Proportion test sample size
function _sdProportionN(p1, p2, alpha, power, tails) {
  const za = _sdNormInv(1 - alpha / tails);
  const zb = _sdNormInv(power);
  const pBar = (p1 + p2) / 2;
  const num = za * Math.sqrt(2 * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((num * num) / ((p1 - p2) ** 2));
}

// Proportion test power at given n
function _sdProportionPower(n, p1, p2, alpha, tails) {
  const za = _sdNormInv(1 - alpha / tails);
  const pBar = (p1 + p2) / 2;
  const se0 = Math.sqrt(2 * pBar * (1 - pBar) / n);
  const se1 = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / n);
  const z = (Math.abs(p1 - p2) - za * se0) / se1;
  return _sdNormCDF(z);
}

// ═══ Calculator Runners ═══

function _sdCalcTTest() {
  const testType = $('#sd-tt-type')?.value || 'two';
  const d = parseFloat($('#sd-tt-d')?.value);
  const alpha = parseFloat($('#sd-tt-alpha')?.value);
  const targetPower = parseFloat($('#sd-tt-power')?.value);
  if (isNaN(d) || d <= 0) return toast('Enter a valid effect size', 'err');

  const nRequired = _sdTTestN(d, alpha, targetPower, testType);
  if (nRequired > 10000) return toast('Sample size exceeds 10,000 — consider a larger effect size', 'err');

  const typeLabels = { two: 'Two-sample independent', one: 'One-sample', paired: 'Paired' };
  const totalN = testType === 'one' ? nRequired : nRequired * 2;
  const mde = _sdMinDetectableEffect(nRequired, alpha, targetPower, testType);

  // Power curve
  const maxN = Math.max(nRequired * 2, 50);
  const step = Math.max(1, Math.floor(maxN / 50));
  const sampleSizes = [];
  for (let n = 2; n <= maxN; n += step) sampleSizes.push(n);
  if (!sampleSizes.includes(nRequired)) sampleSizes.push(nRequired);
  sampleSizes.sort((a, b) => a - b);
  const powers = sampleSizes.map(n => _sdTTestPower(n, d, alpha, testType));

  // Sensitivity table
  const sensHTML = _sdSensitivityTable('ttest', alpha, testType);

  H('#sd-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">${typeLabels[testType]} t-test — Required Sample Size</h4>
    <div class="eg" style="margin-bottom:10px">
      <div class="ec"><div class="el">n per group</div><div class="ev" style="font-size:22px;color:var(--sg)">${nRequired}</div></div>
      <div class="ec"><div class="el">Total N</div><div class="ev">${totalN}</div></div>
      <div class="ec"><div class="el">Effect size (d)</div><div class="ev">${d.toFixed(2)}</div></div>
      <div class="ec"><div class="el">Alpha</div><div class="ev">${alpha}</div></div>
      <div class="ec"><div class="el">Power</div><div class="ev">${targetPower}</div></div>
      <div class="ec"><div class="el">Min detectable effect</div><div class="ev">${mde.toFixed(3)}</div></div>
    </div>
    <div class="pcc" id="sd-power-plot" style="height:300px"></div>
    <div style="margin-top:12px">${sensHTML}</div>
    <div style="margin-top:10px;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.6">
      To detect a ${d<0.3?'small':d<0.6?'medium':'large'} effect (d=${d.toFixed(2)}) with ${(targetPower*100).toFixed(0)}% power at &alpha;=${alpha}, you need at least <b>${nRequired} samples per group</b> (${totalN} total).
      ${d<0.3?' Small effects require large samples — consider whether this effect size is ecologically meaningful.':''}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="bt sm bt-pri" onclick="_sdAddToPlan('ttest',{testType:'${testType}',n:${nRequired},totalN:${totalN},d:${d},alpha:${alpha},power:${targetPower},mde:${mde.toFixed(3)}})">Add to Study Plan</button>
      <button class="bt sm" onclick="_sdExportSingle('ttest',{testType:'${testType}',n:${nRequired},totalN:${totalN},d:${d},alpha:${alpha},power:${targetPower}})">Export as Markdown</button>
    </div>
  </div>`);

  Plotly.newPlot('sd-power-plot', [
    { x: sampleSizes, y: powers, type: 'scatter', mode: 'lines+markers', marker: { size: 4, color: CL[1] }, line: { width: 2, color: CL[1] }, name: 'Power' },
    { x: [sampleSizes[0], sampleSizes[sampleSizes.length - 1]], y: [targetPower, targetPower], type: 'scatter', mode: 'lines', line: { color: 'var(--co)', width: 1, dash: 'dash' }, name: `${(targetPower*100).toFixed(0)}% target` },
    { x: [nRequired, nRequired], y: [0, 1], type: 'scatter', mode: 'lines', line: { color: 'var(--wa)', width: 1, dash: 'dot' }, name: `n=${nRequired}`, showlegend: true }
  ], { ...PL, height: 300, title: { text: `Power Curve (${typeLabels[testType]}, d=${d.toFixed(2)}, \u03b1=${alpha})`, font: { size: 12 } },
    xaxis: { ...PL.xaxis, title: 'Sample size per group' }, yaxis: { ...PL.yaxis, title: 'Statistical power', range: [0, 1.05] } }, { responsive: true });
}

function _sdCalcProportion() {
  const p1 = parseFloat($('#sd-pr-p1')?.value);
  const p2 = parseFloat($('#sd-pr-p2')?.value);
  const alpha = parseFloat($('#sd-pr-alpha')?.value);
  const targetPower = parseFloat($('#sd-pr-power')?.value);
  const tails = parseInt($('#sd-pr-tails')?.value);
  if (isNaN(p1) || isNaN(p2) || p1 === p2) return toast('p1 and p2 must be different', 'err');
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1) return toast('Proportions must be between 0 and 1', 'err');

  const nRequired = _sdProportionN(p1, p2, alpha, targetPower, tails);
  const totalN = nRequired * 2;

  // Power curve
  const maxN = Math.max(nRequired * 2, 50);
  const step = Math.max(1, Math.floor(maxN / 50));
  const sampleSizes = [];
  for (let n = 2; n <= maxN; n += step) sampleSizes.push(n);
  if (!sampleSizes.includes(nRequired)) sampleSizes.push(nRequired);
  sampleSizes.sort((a, b) => a - b);
  const powers = sampleSizes.map(n => _sdProportionPower(n, p1, p2, alpha, tails));

  // Sensitivity table for proportions
  const sensHTML = _sdProportionSensTable(p1, alpha, tails);

  H('#sd-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Proportion Test — Required Sample Size</h4>
    <div class="eg" style="margin-bottom:10px">
      <div class="ec"><div class="el">n per group</div><div class="ev" style="font-size:22px;color:var(--sg)">${nRequired}</div></div>
      <div class="ec"><div class="el">Total N</div><div class="ev">${totalN}</div></div>
      <div class="ec"><div class="el">p1 (baseline)</div><div class="ev">${p1}</div></div>
      <div class="ec"><div class="el">p2 (target)</div><div class="ev">${p2}</div></div>
      <div class="ec"><div class="el">Alpha</div><div class="ev">${alpha}</div></div>
      <div class="ec"><div class="el">Power</div><div class="ev">${targetPower}</div></div>
    </div>
    <div class="pcc" id="sd-prop-plot" style="height:300px"></div>
    <div style="margin-top:12px">${sensHTML}</div>
    <div style="margin-top:10px;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.6">
      To detect a difference from p1=${p1} to p2=${p2} (${tails===1?'one':'two'}-tailed) with ${(targetPower*100).toFixed(0)}% power at &alpha;=${alpha}, you need <b>${nRequired} per group</b> (${totalN} total).
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="bt sm bt-pri" onclick="_sdAddToPlan('proportion',{n:${nRequired},totalN:${totalN},p1:${p1},p2:${p2},alpha:${alpha},power:${targetPower},tails:${tails}})">Add to Study Plan</button>
      <button class="bt sm" onclick="_sdExportSingle('proportion',{n:${nRequired},totalN:${totalN},p1:${p1},p2:${p2},alpha:${alpha},power:${targetPower},tails:${tails}})">Export as Markdown</button>
    </div>
  </div>`);

  Plotly.newPlot('sd-prop-plot', [
    { x: sampleSizes, y: powers, type: 'scatter', mode: 'lines+markers', marker: { size: 4, color: CL[2] }, line: { width: 2, color: CL[2] }, name: 'Power' },
    { x: [sampleSizes[0], sampleSizes[sampleSizes.length - 1]], y: [targetPower, targetPower], type: 'scatter', mode: 'lines', line: { color: 'var(--co)', width: 1, dash: 'dash' }, name: `${(targetPower*100).toFixed(0)}% target` },
    { x: [nRequired, nRequired], y: [0, 1], type: 'scatter', mode: 'lines', line: { color: 'var(--wa)', width: 1, dash: 'dot' }, name: `n=${nRequired}` }
  ], { ...PL, height: 300, title: { text: `Power Curve (p1=${p1}, p2=${p2}, \u03b1=${alpha})`, font: { size: 12 } },
    xaxis: { ...PL.xaxis, title: 'Sample size per group' }, yaxis: { ...PL.yaxis, title: 'Statistical power', range: [0, 1.05] } }, { responsive: true });
}

function _sdCalcRarefaction() {
  const raw = $('#sd-rar-data')?.value?.trim();
  if (!raw) return toast('Paste an abundance matrix first', 'err');

  // Parse matrix: rows = sites, columns = species
  const delim = raw.includes('\t') ? '\t' : ',';
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  // Check if first row is header (non-numeric first cell)
  let startRow = 0;
  const firstCells = lines[0].split(delim);
  if (firstCells.length > 1 && isNaN(parseFloat(firstCells[1]))) startRow = 1;

  const matrix = [];
  for (let i = startRow; i < lines.length; i++) {
    const vals = lines[i].split(delim).map(v => Math.max(0, parseInt(v) || 0));
    if (vals.some(v => v > 0)) matrix.push(vals);
  }
  if (matrix.length < 2) return toast('Need at least 2 sites (rows)', 'err');

  const nSites = matrix.length;
  const nSpeciesCols = Math.max(...matrix.map(r => r.length));

  // Build pooled abundance vector (total individuals per species across all sites)
  const pooled = new Array(nSpeciesCols).fill(0);
  matrix.forEach(row => row.forEach((v, j) => { pooled[j] = (pooled[j] || 0) + v; }));
  const abundanceVec = pooled.filter(v => v > 0);

  if (abundanceVec.length < 2) return toast('Need at least 2 species detected', 'err');

  // Chao1 asymptote (use ecostats if available, else local)
  let chao1Est;
  if (typeof chao1 === 'function') {
    chao1Est = chao1(abundanceVec);
  } else {
    const S_obs = abundanceVec.length;
    const f1 = abundanceVec.filter(v => v === 1).length;
    const f2 = abundanceVec.filter(v => v === 2).length;
    const est = f2 > 0 ? S_obs + (f1 * f1) / (2 * f2) : S_obs + f1 * (f1 - 1) / 2;
    chao1Est = { chao1: est, S_observed: S_obs, singletons: f1, doubletons: f2 };
  }

  // Species accumulation by site (sampling-based rarefaction)
  const accum = [];
  const seen = new Set();
  const siteOrder = [...Array(nSites).keys()];
  // Average over 50 random permutations for smoother curve
  const nPerms = 50;
  const accumAvg = new Array(nSites).fill(0);
  for (let perm = 0; perm < nPerms; perm++) {
    const shuffled = [...siteOrder].sort(() => Math.random() - 0.5);
    const permSeen = new Set();
    shuffled.forEach((si, idx) => {
      matrix[si].forEach((v, j) => { if (v > 0) permSeen.add(j); });
      accumAvg[idx] += permSeen.size;
    });
  }
  for (let i = 0; i < nSites; i++) {
    accum.push({ sites: i + 1, species: accumAvg[i] / nPerms });
  }

  const target95 = chao1Est.chao1 * 0.95;
  const currentRichness = accum[accum.length - 1].species;
  const reached95 = currentRichness >= target95;

  // Extrapolate: simple Michaelis-Menten fit S = Smax * n / (K + n)
  // Fit using last two points
  const Smax = chao1Est.chao1;
  const lastPt = accum[accum.length - 1];
  const K_mm = lastPt.sites * (Smax / lastPt.species - 1);
  let additionalSites = 0;
  if (!reached95) {
    for (let n = nSites + 1; n <= nSites * 20; n++) {
      const predicted = Smax * n / (K_mm + n);
      if (predicted >= target95) { additionalSites = n - nSites; break; }
    }
    if (additionalSites === 0) additionalSites = '> ' + (nSites * 20 - nSites);
  }

  // Build extended curve for plot
  const extendTo = typeof additionalSites === 'number' ? nSites + Math.max(additionalSites * 1.5, 10) : nSites * 3;
  const plotX = [], plotY = [], plotYAsym = [];
  for (let n = 1; n <= extendTo; n++) {
    plotX.push(n);
    if (n <= nSites) plotY.push(accum[n - 1].species);
    else plotY.push(Smax * n / (K_mm + n));
    plotYAsym.push(chao1Est.chao1);
  }

  H('#sd-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Species Rarefaction Analysis</h4>
    <div class="eg" style="margin-bottom:10px">
      <div class="ec"><div class="el">Sites sampled</div><div class="ev">${nSites}</div></div>
      <div class="ec"><div class="el">Species observed</div><div class="ev">${chao1Est.S_observed}</div></div>
      <div class="ec"><div class="el">Chao1 estimate</div><div class="ev" style="color:var(--sg)">${chao1Est.chao1.toFixed(1)}</div></div>
      <div class="ec"><div class="el">Singletons / Doubletons</div><div class="ev">${chao1Est.singletons} / ${chao1Est.doubletons}</div></div>
      <div class="ec"><div class="el">95% of asymptote</div><div class="ev">${target95.toFixed(1)} species</div></div>
      <div class="ec"><div class="el">Additional sites needed</div><div class="ev" style="color:${reached95?'var(--sg)':'var(--wa)'}">${reached95 ? 'Already reached' : additionalSites}</div></div>
    </div>
    <div class="pcc" id="sd-rar-plot" style="height:320px"></div>
    <div style="margin-top:10px;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.6">
      ${reached95
        ? `Your ${nSites} sites captured ${currentRichness.toFixed(1)} species, which is &ge; 95% of the Chao1 asymptotic estimate (${chao1Est.chao1.toFixed(1)}). Sampling effort appears sufficient.`
        : `With ${nSites} sites you observed ${chao1Est.S_observed} species (${(currentRichness/chao1Est.chao1*100).toFixed(0)}% of asymptote). To reach 95% (${target95.toFixed(1)} species), approximately <b>${additionalSites} more sites</b> are recommended.`}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="bt sm bt-pri" onclick="_sdAddToPlan('rarefaction',{sites:${nSites},S_obs:${chao1Est.S_observed},chao1:${chao1Est.chao1.toFixed(1)},target95:${target95.toFixed(1)},additionalSites:'${additionalSites}'})">Add to Study Plan</button>
      <button class="bt sm" onclick="_sdExportSingle('rarefaction',{sites:${nSites},S_obs:${chao1Est.S_observed},chao1:${chao1Est.chao1.toFixed(1)},target95:${target95.toFixed(1)},additionalSites:'${additionalSites}'})">Export as Markdown</button>
    </div>
  </div>`);

  Plotly.newPlot('sd-rar-plot', [
    { x: plotX.slice(0, nSites), y: plotY.slice(0, nSites), type: 'scatter', mode: 'lines+markers', marker: { size: 5, color: CL[0] }, line: { width: 2, color: CL[0] }, name: 'Observed' },
    { x: plotX.slice(nSites - 1), y: plotY.slice(nSites - 1), type: 'scatter', mode: 'lines', line: { width: 2, color: CL[0], dash: 'dot' }, name: 'Extrapolated' },
    { x: plotX, y: plotYAsym, type: 'scatter', mode: 'lines', line: { color: CL[2], width: 1, dash: 'dash' }, name: `Chao1 = ${chao1Est.chao1.toFixed(1)}` },
    { x: plotX, y: plotX.map(() => target95), type: 'scatter', mode: 'lines', line: { color: 'var(--wa)', width: 1, dash: 'dash' }, name: '95% of Chao1' }
  ], { ...PL, height: 320, title: { text: 'Species Accumulation Curve', font: { size: 12 } },
    xaxis: { ...PL.xaxis, title: 'Number of sites' }, yaxis: { ...PL.yaxis, title: 'Cumulative species', rangemode: 'tozero' } }, { responsive: true });
}

function _sdCalcTransect() {
  const param = $('#sd-tr-param')?.value || 'density';
  const mean = parseFloat($('#sd-tr-mean')?.value);
  const sd = parseFloat($('#sd-tr-sd')?.value);
  const marginPct = parseFloat($('#sd-tr-margin')?.value) / 100;
  const alpha = parseFloat($('#sd-tr-alpha')?.value);
  const stripWidth = parseFloat($('#sd-tr-width')?.value) || 2;

  if (isNaN(mean) || mean <= 0) return toast('Enter a valid pilot mean', 'err');
  if (isNaN(sd) || sd <= 0) return toast('Enter a valid standard deviation', 'err');

  const zAlpha = _sdNormInv(1 - alpha / 2);
  const margin = marginPct * mean;
  const nRequired = Math.ceil((zAlpha * sd / margin) ** 2);
  const cv = (sd / mean) * 100;

  const paramLabels = { density: 'Density', cover: 'Cover (%)', biomass: 'Biomass' };
  const transectLength = param === 'density' ? Math.ceil(nRequired * 10 / stripWidth) : null;

  // Sensitivity: n vs margin of error
  const margins = [5, 10, 15, 20, 25, 30, 40, 50];
  const nsByMargin = margins.map(m => {
    const mg = (m / 100) * mean;
    return Math.ceil((zAlpha * sd / mg) ** 2);
  });

  H('#sd-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Transect / Quadrat Design — ${paramLabels[param]}</h4>
    <div class="eg" style="margin-bottom:10px">
      <div class="ec"><div class="el">Required n</div><div class="ev" style="font-size:22px;color:var(--sg)">${nRequired}</div></div>
      <div class="ec"><div class="el">Pilot mean</div><div class="ev">${mean}</div></div>
      <div class="ec"><div class="el">Pilot SD</div><div class="ev">${sd}</div></div>
      <div class="ec"><div class="el">CV</div><div class="ev">${cv.toFixed(1)}%</div></div>
      <div class="ec"><div class="el">Margin of error</div><div class="ev">&plusmn;${(marginPct*100).toFixed(0)}% (${margin.toFixed(2)})</div></div>
      ${transectLength ? `<div class="ec"><div class="el">Transect length (${stripWidth}m strip)</div><div class="ev">${transectLength} m</div></div>` : ''}
    </div>
    <div class="pcc" id="sd-trans-plot" style="height:300px"></div>
    <div style="margin-top:12px;overflow-x:auto">
      <table style="font-size:11px;font-family:var(--mf);border-collapse:collapse;width:100%">
        <tr><th style="padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd);text-align:left">Margin (%)</th>${margins.map(m => `<th style="padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd)">${m}%</th>`).join('')}</tr>
        <tr><td style="padding:4px 8px;color:var(--ts);border-bottom:1px solid var(--bd)">n required</td>${nsByMargin.map((n, i) => `<td style="padding:4px 8px;color:${margins[i]===Math.round(marginPct*100)?'var(--sg)':'var(--ts)'};font-weight:${margins[i]===Math.round(marginPct*100)?'700':'400'};border-bottom:1px solid var(--bd)">${n}</td>`).join('')}</tr>
      </table>
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.6">
      With pilot CV of ${cv.toFixed(1)}%, <b>${nRequired} ${param === 'density' ? 'transects' : 'quadrats'}</b> are needed to estimate ${paramLabels[param].toLowerCase()} within &plusmn;${(marginPct*100).toFixed(0)}% of the true mean at &alpha;=${alpha}.
      ${transectLength ? ` For density with a ${stripWidth}m strip width, this corresponds to approximately ${transectLength}m total transect length.` : ''}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="bt sm bt-pri" onclick="_sdAddToPlan('transect',{param:'${param}',n:${nRequired},mean:${mean},sd:${sd},marginPct:${marginPct},alpha:${alpha}${transectLength?',transectLength:'+transectLength:''}})">Add to Study Plan</button>
      <button class="bt sm" onclick="_sdExportSingle('transect',{param:'${param}',n:${nRequired},mean:${mean},sd:${sd},marginPct:${marginPct},alpha:${alpha}${transectLength?',transectLength:'+transectLength:''}})">Export as Markdown</button>
    </div>
  </div>`);

  Plotly.newPlot('sd-trans-plot', [
    { x: margins, y: nsByMargin, type: 'scatter', mode: 'lines+markers', marker: { size: 6, color: CL[4] }, line: { width: 2, color: CL[4] }, name: 'n required' },
    { x: [marginPct * 100], y: [nRequired], type: 'scatter', mode: 'markers', marker: { size: 12, color: CL[1], symbol: 'star' }, name: 'Your design', showlegend: true }
  ], { ...PL, height: 300, title: { text: `Sample Size vs Precision (CV=${cv.toFixed(1)}%)`, font: { size: 12 } },
    xaxis: { ...PL.xaxis, title: 'Margin of error (% of mean)' }, yaxis: { ...PL.yaxis, title: 'Required n', rangemode: 'tozero' } }, { responsive: true });
}

// ═══ Sensitivity Tables ═══

function _sdSensitivityTable(type, alpha, testType) {
  const ds = [0.2, 0.3, 0.5, 0.8, 1.0, 1.5];
  const pows = [0.70, 0.80, 0.90, 0.95];
  let html = '<div style="overflow-x:auto"><table style="font-size:11px;font-family:var(--mf);border-collapse:collapse;width:100%">';
  html += '<tr><th style="padding:4px 6px;color:var(--tm);border-bottom:1px solid var(--bd);text-align:left">d \\ Power</th>';
  pows.forEach(pw => { html += `<th style="padding:4px 6px;color:var(--tm);border-bottom:1px solid var(--bd)">${pw}</th>`; });
  html += '</tr>';
  ds.forEach(d => {
    html += `<tr><td style="padding:4px 6px;color:var(--ac);border-bottom:1px solid var(--bd);font-weight:600">${d}</td>`;
    pows.forEach(pw => {
      const n = _sdTTestN(d, alpha, pw, testType || 'two');
      html += `<td style="padding:4px 6px;color:var(--ts);border-bottom:1px solid var(--bd);text-align:center">${n > 10000 ? '>10k' : n}</td>`;
    });
    html += '</tr>';
  });
  html += '</table></div>';
  return html;
}

function _sdProportionSensTable(p1, alpha, tails) {
  const p2s = [p1 + 0.05, p1 + 0.10, p1 + 0.15, p1 + 0.20, p1 + 0.30].filter(p => p < 1);
  const pows = [0.70, 0.80, 0.90, 0.95];
  let html = '<div style="overflow-x:auto"><table style="font-size:11px;font-family:var(--mf);border-collapse:collapse;width:100%">';
  html += '<tr><th style="padding:4px 6px;color:var(--tm);border-bottom:1px solid var(--bd);text-align:left">p2 \\ Power</th>';
  pows.forEach(pw => { html += `<th style="padding:4px 6px;color:var(--tm);border-bottom:1px solid var(--bd)">${pw}</th>`; });
  html += '</tr>';
  p2s.forEach(p2 => {
    html += `<tr><td style="padding:4px 6px;color:var(--ac);border-bottom:1px solid var(--bd);font-weight:600">${p2.toFixed(2)}</td>`;
    pows.forEach(pw => {
      const n = _sdProportionN(p1, p2, alpha, pw, tails);
      html += `<td style="padding:4px 6px;color:var(--ts);border-bottom:1px solid var(--bd);text-align:center">${n}</td>`;
    });
    html += '</tr>';
  });
  html += '</table></div>';
  return html;
}

// Minimum detectable effect at given n
function _sdMinDetectableEffect(n, alpha, power, testType) {
  const k = testType === 'one' ? 1 : 2;
  const zAlpha = _sdNormInv(1 - alpha / 2);
  const zBeta = _sdNormInv(power);
  return (zAlpha + zBeta) / Math.sqrt(n / k);
}

// ═══ Rarefaction Helpers ═══

function _sdLoadRarFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const ta = $('#sd-rar-data');
    if (ta) ta.value = e.target.result;
    toast('File loaded: ' + file.name, 'ok');
  };
  reader.readAsText(file);
}

function _sdLoadRarExample() {
  const ta = $('#sd-rar-data');
  if (!ta) return;
  // Simulated reef fish abundance data: 8 sites × 12 species
  ta.value = [
    'sp1\tsp2\tsp3\tsp4\tsp5\tsp6\tsp7\tsp8\tsp9\tsp10\tsp11\tsp12',
    '12\t5\t0\t3\t1\t0\t8\t0\t0\t2\t0\t0',
    '8\t3\t2\t0\t0\t1\t6\t0\t1\t0\t0\t0',
    '15\t7\t1\t4\t2\t0\t10\t1\t0\t3\t0\t0',
    '6\t0\t3\t1\t0\t2\t4\t0\t0\t0\t1\t0',
    '10\t4\t0\t2\t1\t0\t7\t0\t0\t1\t0\t0',
    '3\t1\t1\t0\t0\t0\t2\t0\t0\t0\t0\t1',
    '9\t6\t0\t5\t3\t1\t11\t2\t1\t4\t0\t0',
    '7\t2\t2\t1\t0\t0\t5\t0\t0\t0\t0\t0'
  ].join('\n');
  toast('Example reef fish data loaded (8 sites, 12 species)', 'ok');
}

// ═══ Gap Analysis Integration ═══

function _sdFromGap() {
  if (!window._gapData || !window._gapData.length) return toast('Run gap analysis first', 'err');

  const gaps = window._gapData.slice(0, 10);
  let html = '<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);margin-bottom:12px">';
  html += '<h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Select a Research Gap</h4>';
  html += '<p style="font-size:11px;color:var(--ts);font-family:var(--mf);margin-bottom:10px">Choose a gap to pre-fill calculator inputs based on associated literature.</p>';
  gaps.forEach((g, i) => {
    const nPapers = g.papers ? g.papers.length : 0;
    html += `<div style="padding:8px 12px;border:1px solid var(--bd);border-radius:6px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="_sdApplyGap(${i})" onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--bd)'">
      <div>
        <div style="font-size:12px;color:var(--tx)">${escHTML(g.title)}</div>
        <div style="font-size:10px;color:var(--tm);font-family:var(--mf)">${g.type} gap &middot; ${nPapers} papers &middot; score ${g.score?.toFixed(1) || '?'}</div>
      </div>
      <span style="color:var(--ac);font-size:11px">Use &rarr;</span>
    </div>`;
  });
  html += '</div>';

  const calc = $('#sd-calc');
  if (calc) calc.insertAdjacentHTML('beforebegin', `<div id="sd-gap-panel">${html}</div>`);
}

async function _sdApplyGap(idx) {
  const gap = window._gapData?.[idx];
  if (!gap) return;

  // Remove gap panel
  const panel = $('#sd-gap-panel');
  if (panel) panel.remove();

  const nPapers = gap.papers?.length || 0;
  let infoHTML = `<div style="padding:10px 14px;background:var(--am);border:1px solid var(--ab);border-radius:var(--rd);margin-bottom:12px;font-size:12px;font-family:var(--mf);color:var(--ts)">
    <b style="color:var(--ac)">Gap: ${escHTML(gap.title)}</b><br>`;

  // Try to extract effect sizes from gap papers using AI
  if (typeof callAI === 'function' && S.apiK) {
    infoHTML += `Querying AI for typical effect sizes in this area...`;
    H('#sd-results', infoHTML + '</div>');

    try {
      const paperTitles = (gap.papers || []).slice(0, 5).map(p => p.title || '').filter(Boolean).join('; ');
      const resp = await callAI({
        messages: [{ role: 'user', content: `Based on ${nPapers} studies on "${gap.title}" (example titles: ${paperTitles}), what is a typical Cohen's d effect size for the primary outcome in this research area? Reply ONLY with JSON: {"d_min": number, "d_median": number, "d_max": number, "note": "one sentence"}` }],
        maxTokens: 200
      });
      const text = resp?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        infoHTML = `<div style="padding:10px 14px;background:var(--am);border:1px solid var(--ab);border-radius:var(--rd);margin-bottom:12px;font-size:12px;font-family:var(--mf);color:var(--ts)">
          <b style="color:var(--ac)">Based on ${nPapers} studies on: ${escHTML(gap.title)}</b><br>
          Reported effect sizes range from d=${parsed.d_min} to d=${parsed.d_max} (median: d=${parsed.d_median})<br>
          ${parsed.note ? `<span style="color:var(--tm)">${escHTML(parsed.note)}</span><br>` : ''}
          <button class="bt sm bt-sec" onclick="$('#sd-tt-d').value=${parsed.d_median};$('#sd-tt-d-val').textContent='${parsed.d_median.toFixed(2)}'" style="margin-top:4px">Use d=${parsed.d_median} &rarr;</button>
        </div>`;
      }
    } catch (e) {
      infoHTML += `Could not estimate effect sizes automatically.`;
    }
    infoHTML += '</div>';
  } else {
    infoHTML += `${nPapers} papers found. Configure an AI API key for automatic effect size estimation, or use conventional values (d=0.5 for medium effect).</div>`;
  }

  H('#sd-results', infoHTML);
  _sdShowCalc('ttest');
}

// ═══ Study Plan Accumulation ═══

function _sdAddToPlan(type, params) {
  const plans = safeParse('meridian_study_plan', []);
  const labels = { ttest: 't-test', proportion: 'Proportion test', rarefaction: 'Rarefaction', transect: 'Transect/Quadrat' };
  plans.push({
    type,
    label: labels[type] || type,
    params,
    createdAt: new Date().toISOString()
  });
  safeStore('meridian_study_plan', plans);
  toast('Added to study plan', 'ok');
  _sdRenderStudyPlan();
}

function _sdRemoveFromPlan(idx) {
  const plans = safeParse('meridian_study_plan', []);
  plans.splice(idx, 1);
  safeStore('meridian_study_plan', plans);
  _sdRenderStudyPlan();
}

function _sdRenderStudyPlan() {
  const el = $('#sd-plan-section');
  if (!el) return;
  const plans = safeParse('meridian_study_plan', []);

  if (!plans.length) {
    el.innerHTML = '';
    return;
  }

  let html = `<div class="sec"><div class="sh" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.querySelector('span:last-child').textContent=this.nextElementSibling.style.display==='none'?'&#9656;':'&#9662;'"><h4>Study Plan (${plans.length} item${plans.length!==1?'s':''})</h4><span style="color:var(--tm)">&#9662;</span></div><div class="sb">`;

  plans.forEach((p, i) => {
    const date = new Date(p.createdAt).toLocaleDateString();
    let detail = '';
    if (p.type === 'ttest') detail = `n=${p.params.n}/group, d=${p.params.d}, power=${p.params.power}`;
    else if (p.type === 'proportion') detail = `n=${p.params.n}/group, p1=${p.params.p1}, p2=${p.params.p2}`;
    else if (p.type === 'rarefaction') detail = `${p.params.sites} sites, Chao1=${p.params.chao1}, +${p.params.additionalSites} sites`;
    else if (p.type === 'transect') detail = `n=${p.params.n} ${p.params.param}, margin=${(p.params.marginPct*100).toFixed(0)}%`;

    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">
      <div>
        <div style="font-size:12px;color:var(--tx)">${escHTML(p.label)}</div>
        <div style="font-size:10px;color:var(--tm);font-family:var(--mf)">${detail} &middot; ${date}</div>
      </div>
      <button class="bt sm" style="color:var(--co)" onclick="_sdRemoveFromPlan(${i})">&times;</button>
    </div>`;
  });

  html += `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
    <button class="bt sm bt-pri" onclick="_sdExportAllPlans()">Export Study Plan</button>
    <button class="bt sm" style="color:var(--co)" onclick="if(confirm('Clear all study plan items?')){safeStore('meridian_study_plan',[]);_sdRenderStudyPlan()}">Clear All</button>
  </div>`;
  html += '</div></div>';
  el.innerHTML = html;
}

// ═══ Export Functions ═══

function _sdExportSingle(type, params) {
  const now = new Date().toISOString();
  let text = `# Meridian Study Design Plan\n# Generated: ${now}\n# Calculator: ${type}\n\n`;
  text += _sdFormatPlanMarkdown(type, params);
  text += `\n\n---\n*Generated by Meridian Marine Research Platform (meridian-engine.com)*\n`;
  dl(text, `study-plan-${type}-${now.slice(0, 10)}.md`, 'text/markdown');
  toast('Study plan exported', 'ok');
}

function _sdExportAllPlans() {
  const plans = safeParse('meridian_study_plan', []);
  if (!plans.length) return toast('No plans to export', 'err');

  const now = new Date().toISOString();
  let text = `# Meridian Study Design Plan\n# Generated: ${now}\n# Items: ${plans.length}\n\n`;

  plans.forEach((p, i) => {
    text += `## ${i + 1}. ${p.label}\n*Added: ${new Date(p.createdAt).toLocaleDateString()}*\n\n`;
    text += _sdFormatPlanMarkdown(p.type, p.params);
    text += '\n\n---\n\n';
  });

  text += `*Generated by Meridian Marine Research Platform (meridian-engine.com)*\n`;
  dl(text, `study-plan-full-${now.slice(0, 10)}.md`, 'text/markdown');
  toast(`Exported ${plans.length} plan items`, 'ok');
}

function _sdFormatPlanMarkdown(type, p) {
  if (type === 'ttest') {
    const typeLabels = { two: 'Two-sample independent', one: 'One-sample', paired: 'Paired' };
    return `### ${typeLabels[p.testType] || 'Two-sample'} t-test

- **Required sample size**: ${p.n} per group (${p.totalN} total)
- **Effect size (Cohen's d)**: ${p.d}
- **Significance level**: ${p.alpha}
- **Statistical power**: ${p.power}
- **Minimum detectable effect**: ${p.mde || 'N/A'}

#### Assumptions
- ${p.testType === 'one' ? 'One sample compared to known population mean' : p.testType === 'paired' ? 'Paired observations (before/after, matched sites)' : 'Two independent groups'}
- Approximately normal distribution (or n > 30)
- ${p.testType === 'two' ? 'Equal variances assumed (Welch correction recommended if uncertain)' : ''}

#### Recommendations
- Add 15-20% to account for dropouts/missing data
- Recommended total with buffer: ${Math.ceil(p.totalN * 1.15)}`;
  }
  if (type === 'proportion') {
    return `### Two-Proportion z-test

- **Required sample size**: ${p.n} per group (${p.totalN} total)
- **Baseline proportion (p1)**: ${p.p1}
- **Target proportion (p2)**: ${p.p2}
- **Significance level**: ${p.alpha}
- **Statistical power**: ${p.power}
- **Tails**: ${p.tails === 1 ? 'One-tailed' : 'Two-tailed'}

#### Recommendations
- Recommended total with 15% buffer: ${Math.ceil(p.totalN * 1.15)}
- Consider stratified sampling if proportions vary by site or season`;
  }
  if (type === 'rarefaction') {
    return `### Species Richness Rarefaction

- **Pilot sites sampled**: ${p.sites}
- **Species observed**: ${p.S_obs}
- **Chao1 asymptotic estimate**: ${p.chao1}
- **95% of asymptote target**: ${p.target95} species
- **Additional sites recommended**: ${p.additionalSites}

#### Method
- Species accumulation curve with sample-based rarefaction
- Asymptote estimated using Chao1 (bias-corrected)
- Extrapolation via Michaelis-Menten fit`;
  }
  if (type === 'transect') {
    const paramLabels = { density: 'Density', cover: 'Cover (%)', biomass: 'Biomass' };
    return `### Transect / Quadrat Design — ${paramLabels[p.param] || p.param}

- **Required number of replicates**: ${p.n}
- **Pilot mean**: ${p.mean}
- **Pilot SD**: ${p.sd}
- **CV**: ${((p.sd / p.mean) * 100).toFixed(1)}%
- **Acceptable margin of error**: ±${(p.marginPct * 100).toFixed(0)}% of mean
- **Significance level**: ${p.alpha}
${p.transectLength ? `- **Recommended total transect length**: ${p.transectLength} m` : ''}

#### Field Protocol
- Use ${p.n} ${p.param === 'density' ? 'transects' : 'quadrats'} placed using stratified random sampling
- Standardize survey method across all replicates
- Record environmental covariates alongside target measurements`;
  }
  return '';
}
