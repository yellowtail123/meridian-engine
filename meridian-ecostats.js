// ═══ MERIDIAN ECO STATS — Ecological Statistics Module ═══

let _esInitialized = false;
let _esData = null; // {matrix: [[]], labels: [], colNames: [], source: ''}

function initEcoStats() {
  if (_esInitialized && $('#es-content')?.children.length) return;
  _esInitialized = true;
  _renderEcoStatsUI();
}

function _renderEcoStatsUI() {
  H('#es-content', `
    <div class="tip-wrap"><button class="tip-toggle" onclick="toggleTipPopover(this)" title="About this tab">i</button><div class="tip tip-pop"><b>Ecological Statistics.</b> Diversity indices, PERMANOVA, NMDS, Mann-Kendall trends, linear regression, and Chao1 richness estimation. Pure JS implementations — no external stat libraries.<button class="dx" onclick="this.closest('.tip').style.display='none'">×</button></div></div>

    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;color:var(--tm);font-family:var(--mf)">Data source:</span>
      <button class="bt sm ${_esData?.source==='workshop'?'on':''}" onclick="_esLoadWorkshop()">Use Workshop data</button>
      <button class="bt sm ${_esData?.source==='field'?'on':''}" onclick="_esLoadFieldData()">Use field data</button>
      <button class="bt sm ${_esData?.source==='occurrence'?'on':''}" onclick="_esLoadOccurrence()">Use occurrence data</button>
      <button class="bt sm ${_esData?.source==='paste'?'on':''}" onclick="_esShowPaste()">Paste data</button>
      <span id="es-data-info" style="margin-left:auto;font-size:11px;color:var(--tm);font-family:var(--mf)">${_esData?_esData.matrix.length+' samples × '+(_esData.colNames?.length||0)+' variables':'No data loaded'}</span>
    </div>
    <div id="es-paste" style="display:none;margin-bottom:12px">
      <textarea class="si" id="es-paste-area" rows="6" placeholder="Paste tab-separated values (rows = samples, columns = species/variables)&#10;Species1&#9;Species2&#9;Species3&#10;5&#9;3&#9;0&#10;2&#9;8&#9;1" style="width:100%;font-family:var(--mf);font-size:11px"></textarea>
      <button class="bt sm bt-pri" onclick="_esParsePaste()" style="margin-top:4px">Load pasted data</button>
    </div>
    <div id="es-preview" style="display:none;margin-bottom:14px"></div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      <button class="bt bt-pri" onclick="_esRunDiversity()" ${!_esData?'disabled':''}>Diversity Indices</button>
      <button class="bt sm" onclick="_esRunPermanova()" ${!_esData?'disabled':''}>PERMANOVA</button>
      <button class="bt sm" onclick="_esRunNMDS()" ${!_esData?'disabled':''}>NMDS</button>
      <button class="bt sm" onclick="_esRunMannKendall()" ${!_esData?'disabled':''}>Mann-Kendall</button>
      <button class="bt sm" onclick="_esRunRegression()" ${!_esData?'disabled':''}>Linear Regression</button>
      <button class="bt sm" onclick="_esRunChao1()" ${!_esData?'disabled':''}>Chao1 Richness</button>
    </div>
    <div id="es-results"></div>
  `);
}

// ── Data loaders ──
function _esLoadWorkshop() {
  if (!S.wsD?.length) return toast('No data in Workshop', 'err');
  const numCols = S.wsC.filter(c => S.wsCT[c] === 'continuous');
  if (!numCols.length) return toast('No numeric columns in Workshop data', 'err');
  _esData = {
    matrix: S.wsD.map(r => numCols.map(c => typeof r[c] === 'number' ? r[c] : 0)),
    labels: S.wsD.map((r, i) => {
      const catCol = S.wsC.find(c => S.wsCT[c] === 'categorical');
      return catCol ? String(r[catCol]) : 'S' + (i + 1);
    }),
    colNames: numCols, source: 'workshop'
  };
  _esShowPreview();
  _renderEcoStatsUI();
}

function _esLoadFieldData() {
  const datasets = safeParse('meridian_field_datasets', []);
  if (!datasets.length) return toast('No field datasets imported', 'err');
  const ds = datasets[datasets.length - 1];
  const mapping = ds.mapping || {};
  const numCols = Object.keys(mapping).filter(k => {
    const role = mapping[k];
    return role !== 'Ignore' && role !== 'Date' && role !== 'Species name' && role !== 'Site/station ID'
      && ds.rows.some(r => typeof r[k] === 'number');
  });
  if (!numCols.length) return toast('No numeric columns in field data', 'err');
  _esData = {
    matrix: ds.rows.map(r => numCols.map(c => typeof r[c] === 'number' ? r[c] : 0)),
    labels: ds.rows.map((r, i) => {
      const siteCol = Object.keys(mapping).find(k => mapping[k] === 'Site/station ID');
      return siteCol ? String(r[siteCol]) : 'S' + (i + 1);
    }),
    colNames: numCols, source: 'field'
  };
  _esShowPreview();
  _renderEcoStatsUI();
}

function _esLoadOccurrence() {
  try {
    const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null');
    if (!sp?.gbifOcc?.length && !sp?.obisOcc?.length) return toast('No occurrence data available', 'err');
    const occ = [...(sp.gbifOcc || []), ...(sp.obisOcc || [])];
    const numFields = ['decimalLatitude', 'decimalLongitude', 'coordinateUncertaintyInMeters', 'depth', 'year'];
    const validFields = numFields.filter(f => occ.some(r => typeof r[f] === 'number'));
    if (!validFields.length) return toast('No numeric fields in occurrence data', 'err');
    _esData = {
      matrix: occ.map(r => validFields.map(f => typeof r[f] === 'number' ? r[f] : 0)),
      labels: occ.map((r, i) => r.basisOfRecord || 'occ' + (i + 1)),
      colNames: validFields, source: 'occurrence'
    };
    _esShowPreview();
    _renderEcoStatsUI();
  } catch { toast('Could not load occurrence data', 'err'); }
}

function _esShowPaste() {
  const el = $('#es-paste');
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function _esParsePaste() {
  const text = $('#es-paste-area')?.value;
  if (!text?.trim()) return toast('Paste some data first', 'err');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return toast('Need header + at least 1 row', 'err');
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delim).map(h => h.trim());
  const matrix = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(delim).map(v => parseFloat(v.trim()));
    if (vals.length === headers.length && vals.every(v => !isNaN(v))) matrix.push(vals);
  }
  if (!matrix.length) return toast('No valid numeric rows', 'err');
  _esData = { matrix, labels: matrix.map((_, i) => 'S' + (i + 1)), colNames: headers, source: 'paste' };
  _esShowPreview();
  _renderEcoStatsUI();
}

function _esShowPreview() {
  if (!_esData) return;
  const el = $('#es-preview');
  if (!el) return;
  el.style.display = '';
  const rows = _esData.matrix.slice(0, 5);
  el.innerHTML = `<div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:4px">${_esData.matrix.length} samples × ${_esData.colNames.length} variables</div>
    <div style="overflow-x:auto"><table style="font-size:10px;font-family:var(--mf);border-collapse:collapse">
    <tr>${_esData.colNames.map(c => `<th style="padding:2px 6px;color:var(--tm);border-bottom:1px solid var(--bd)">${escHTML(c)}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${r.map(v => `<td style="padding:2px 6px;color:var(--ts)">${typeof v==='number'?v.toFixed(2):v}</td>`).join('')}</tr>`).join('')}
    </table></div>`;
}

// ═══ STATISTICAL FUNCTIONS ═══

// ── 3a. Diversity Indices ──
function calcDiversityIndices(abundanceVector) {
  const N = abundanceVector.reduce((s, v) => s + v, 0);
  if (N === 0) return null;
  const S_rich = abundanceVector.filter(v => v > 0).length;
  let shannonH = 0;
  abundanceVector.forEach(ni => {
    if (ni > 0) { const pi = ni / N; shannonH -= pi * Math.log(pi); }
  });
  let simpsonD = 0;
  if (N > 1) {
    abundanceVector.forEach(ni => { simpsonD += ni * (ni - 1); });
    simpsonD = 1 - simpsonD / (N * (N - 1));
  }
  const evenness = S_rich > 1 ? shannonH / Math.log(S_rich) : 0;
  const dominance = Math.max(...abundanceVector) / N;
  return { N, S: S_rich, shannonH: +shannonH.toFixed(4), simpsonD: +simpsonD.toFixed(4), evenness: +evenness.toFixed(4), dominance: +dominance.toFixed(4) };
}

function ecoRarefactionCurve(abundanceVector, steps) {
  const N = abundanceVector.reduce((s, v) => s + v, 0);
  const S_obs = abundanceVector.filter(v => v > 0).length;
  if (N === 0) return [];
  steps = steps || Math.min(N, 50);
  const curve = [];
  for (let n = 1; n <= N; n += Math.max(1, Math.floor(N / steps))) {
    let ES = S_obs;
    abundanceVector.forEach(ni => {
      if (ni > 0 && ni <= N) {
        // E(S_n) = S - sum(C(N-ni, n)/C(N, n)) using log-space for large N
        let logRatio = 0;
        for (let k = 0; k < n; k++) logRatio += Math.log(N - ni - k) - Math.log(N - k);
        ES -= Math.exp(logRatio);
      }
    });
    curve.push({ n, expected_S: Math.max(0, +ES.toFixed(2)) });
  }
  return curve;
}

// ── 3b. PERMANOVA ──
function brayCurtis(a, b) {
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) { num += Math.abs(a[i] - b[i]); den += a[i] + b[i]; }
  return den === 0 ? 0 : num / den;
}

function buildDistanceMatrix(matrix, distFn) {
  const n = matrix.length;
  const dm = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = distFn(matrix[i], matrix[j]);
      dm[i][j] = d; dm[j][i] = d;
    }
  return dm;
}

function permanova(distanceMatrix, groupLabels, nPermutations) {
  nPermutations = nPermutations || 999;
  const N = groupLabels.length;
  const groups = [...new Set(groupLabels)];
  const a = groups.length;
  if (a < 2) return null;

  function calcF(labels) {
    let SST = 0, SSW = 0;
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const d2 = distanceMatrix[i][j] ** 2;
        SST += d2;
        if (labels[i] === labels[j]) SSW += d2;
      }
    SST /= N;
    const groupSizes = {};
    labels.forEach(l => { groupSizes[l] = (groupSizes[l] || 0) + 1; });
    // Recompute SSW properly
    SSW = 0;
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++)
        if (labels[i] === labels[j]) SSW += distanceMatrix[i][j] ** 2;
    // Normalize by group sizes
    let SSW_norm = 0;
    groups.forEach(g => {
      const members = labels.map((l, i) => i).filter(i => labels[i] === g);
      let sumD2 = 0;
      for (let ii = 0; ii < members.length; ii++)
        for (let jj = ii + 1; jj < members.length; jj++)
          sumD2 += distanceMatrix[members[ii]][members[jj]] ** 2;
      if (members.length > 0) SSW_norm += sumD2 / members.length;
    });
    const SSB = SST / N - SSW_norm;
    const dfB = a - 1, dfW = N - a;
    if (dfW === 0 || SSW_norm === 0) return Infinity;
    return (SSB / dfB) / (SSW_norm / dfW);
  }

  const F_obs = calcF(groupLabels);
  const R2 = 1 - (1 / (1 + F_obs * (a - 1) / (N - a)));
  let nGreater = 0;
  for (let p = 0; p < nPermutations; p++) {
    const perm = [...groupLabels];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (calcF(perm) >= F_obs) nGreater++;
  }
  return { F_stat: +F_obs.toFixed(4), R2: +R2.toFixed(4), p_value: +((nGreater + 1) / (nPermutations + 1)).toFixed(4), n_permutations: nPermutations };
}

// ── 3c. NMDS (2D) ──
function nmds(distanceMatrix, maxIter, epsilon) {
  maxIter = maxIter || 200; epsilon = epsilon || 1e-4;
  const n = distanceMatrix.length;
  // Random initial 2D configuration
  let coords = Array.from({ length: n }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1]);

  function configDist(c) {
    const d = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = c[i][0] - c[j][0], dy = c[i][1] - c[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        d[i][j] = dist; d[j][i] = dist;
      }
    return d;
  }

  // Isotonic regression (PAVA)
  function isotonic(target, current) {
    const pairs = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        pairs.push({ delta: target[i][j], d: current[i][j], i, j });
    pairs.sort((a, b) => a.delta - b.delta);
    const fitted = pairs.map(p => p.d);
    // Pool Adjacent Violators
    let i = 0;
    while (i < fitted.length - 1) {
      if (fitted[i] > fitted[i + 1]) {
        let j = i;
        while (j < fitted.length - 1 && fitted[j] > fitted[j + 1]) j++;
        const avg = fitted.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1);
        for (let k = i; k <= j; k++) fitted[k] = avg;
        i = 0;
      } else i++;
    }
    const result = Array.from({ length: n }, () => new Float64Array(n));
    pairs.forEach((p, idx) => { result[p.i][p.j] = fitted[idx]; result[p.j][p.i] = fitted[idx]; });
    return result;
  }

  let stress = Infinity;
  for (let iter = 0; iter < maxIter; iter++) {
    const cDist = configDist(coords);
    const dHat = isotonic(distanceMatrix, cDist);

    // Compute STRESS
    let num = 0, den = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        num += (cDist[i][j] - dHat[i][j]) ** 2;
        den += cDist[i][j] ** 2;
      }
    stress = den > 0 ? Math.sqrt(num / den) : 0;
    if (stress < epsilon) break;

    // Gradient descent update
    const lr = 0.05;
    const newCoords = coords.map(c => [...c]);
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || cDist[i][j] === 0) continue;
        const scale = (cDist[i][j] - dHat[i][j]) / cDist[i][j];
        gx += scale * (coords[i][0] - coords[j][0]);
        gy += scale * (coords[i][1] - coords[j][1]);
      }
      newCoords[i][0] -= lr * gx;
      newCoords[i][1] -= lr * gy;
    }
    coords = newCoords;
  }
  return { coords, stress: +stress.toFixed(4), converged: stress < epsilon };
}

// ── 3d. Mann-Kendall ──
function ecoMannKendall(timeSeries) {
  // timeSeries: [[timestamp_ms, value], ...] sorted by time
  const n = timeSeries.length;
  if (n < 10) return null;
  let S_stat = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) {
      const diff = timeSeries[j][1] - timeSeries[i][1];
      S_stat += diff > 0 ? 1 : diff < 0 ? -1 : 0;
    }
  // Variance with tie correction
  const ties = {};
  timeSeries.forEach(p => { const v = p[1]; ties[v] = (ties[v] || 0) + 1; });
  let tieCorr = 0;
  Object.values(ties).forEach(t => { if (t > 1) tieCorr += t * (t - 1) * (2 * t + 5); });
  const varS = (n * (n - 1) * (2 * n + 5) - tieCorr) / 18;
  const Z = varS > 0 ? (S_stat - Math.sign(S_stat)) / Math.sqrt(varS) : 0;

  // Normal CDF approximation
  const absZ = Math.abs(Z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2);
  const p_one = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const p_value = 2 * p_one;

  // Sen's slope
  const slopes = [];
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) {
      const dt = timeSeries[j][0] - timeSeries[i][0];
      if (dt > 0) slopes.push((timeSeries[j][1] - timeSeries[i][1]) / (dt / (365.25 * 86400000)));
    }
  slopes.sort((a, b) => a - b);
  const sen_slope = slopes.length ? slopes[Math.floor(slopes.length / 2)] : 0;

  // Tau-b
  const tauB = S_stat / (n * (n - 1) / 2);

  const trend = p_value < 0.05 ? (S_stat > 0 ? 'increasing' : 'decreasing') : 'no trend';
  return { S: S_stat, varS, Z: +Z.toFixed(4), p_value: +p_value.toFixed(4), trend, tauB: +tauB.toFixed(4), sen_slope: +sen_slope.toFixed(6) };
}

// ── 3e. Linear Regression ──
function ecoLinearRegression(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, v) => a + v, 0) / n;
  const my = y.reduce((a, v) => a + v, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const r2 = r * r;
  const fitted = x.map(v => slope * v + intercept);
  const residuals = y.map((v, i) => v - fitted[i]);
  const ssr = residuals.reduce((a, v) => a + v * v, 0);
  const mse = ssr / (n - 2);
  const se_slope = Math.sqrt(mse / sxx);
  const se_intercept = Math.sqrt(mse * (1 / n + mx * mx / sxx));
  // t-test for slope significance
  const t_stat = slope / se_slope;
  // p-value from t-distribution (approximation)
  const df = n - 2;
  const p_value = 2 * (1 - _tCDF(Math.abs(t_stat), df));
  return { slope: +slope.toFixed(6), intercept: +intercept.toFixed(4), r2: +r2.toFixed(4), r: +r.toFixed(4),
    p_value: +Math.max(0, p_value).toFixed(4), se_slope: +se_slope.toFixed(6), se_intercept: +se_intercept.toFixed(4),
    residuals, fitted, n };
}

// t-distribution CDF approximation
function _tCDF(t, df) {
  const x = df / (df + t * t);
  return 1 - 0.5 * _incompleteBeta(df / 2, 0.5, x);
}

function _incompleteBeta(a, b, x) {
  // Simple continued fraction approximation
  if (x === 0 || x === 1) return x;
  const lbeta = _logGamma(a) + _logGamma(b) - _logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  // Lentz's algorithm
  let f = 1, c = 1, d = 1 - (a + 1) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d; f = d;
  for (let i = 1; i <= 100; i++) {
    let m = i;
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const delta = d * c; f *= delta;
    if (Math.abs(delta - 1) < 1e-8) break;
  }
  return front * f;
}

function _logGamma(x) {
  const c = [76.18009173, -86.50532033, 24.01409822, -1.231739516, 0.00120858003, -5.36382e-6];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ── 3f. Chao1 ──
function chao1(abundanceVector) {
  const S_obs = abundanceVector.filter(v => v > 0).length;
  const f1 = abundanceVector.filter(v => v === 1).length;
  const f2 = abundanceVector.filter(v => v === 2).length;
  let estimate;
  if (f2 > 0) estimate = S_obs + (f1 * f1) / (2 * f2);
  else estimate = S_obs + f1 * (f1 - 1) / 2;
  // 95% CI
  const K = f2 > 0 ? f1 / f2 : f1;
  const var_est = f2 > 0 ? f2 * (0.5 * K * K + K * K * K + 0.25 * K * K * K * K) : f1 * (f1 - 1) / 2 + f1 * (2 * f1 - 1) * (2 * f1 - 1) / 4;
  const C = Math.exp(1.96 * Math.sqrt(Math.log(1 + var_est / Math.max(1, (estimate - S_obs)) ** 2)));
  return { chao1: +estimate.toFixed(1), S_observed: S_obs, singletons: f1, doubletons: f2,
    lowerCI: +(S_obs + (estimate - S_obs) / C).toFixed(1),
    upperCI: +(S_obs + (estimate - S_obs) * C).toFixed(1) };
}

// ═══ UI RUNNERS ═══

function _esRunDiversity() {
  if (!_esData) return toast('Load data first', 'err');
  const results = _esData.matrix.map((row, i) => {
    const d = calcDiversityIndices(row);
    return d ? { sample: _esData.labels[i], ...d } : null;
  }).filter(Boolean);
  if (!results.length) return toast('No valid abundance data', 'err');

  // Rarefaction for first sample
  const rare = ecoRarefactionCurve(_esData.matrix[0], 40);

  let html = `<div style="margin-bottom:16px;padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Diversity Indices</h4>
    <div style="overflow-x:auto"><table style="font-size:11px;font-family:var(--mf);border-collapse:collapse;width:100%">
    <tr>${['Sample','N','S','Shannon H\'','Simpson D','Evenness J','Dominance'].map(h => `<th style="padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd);text-align:left">${h}</th>`).join('')}</tr>
    ${results.map(r => `<tr>${[r.sample, r.N, r.S, r.shannonH, r.simpsonD, r.evenness, r.dominance].map(v => `<td style="padding:4px 8px;color:var(--ts);border-bottom:1px solid var(--bd)">${v}</td>`).join('')}</tr>`).join('')}
    </table></div>
    <div style="font-size:12px;color:var(--ts);margin-top:8px;line-height:1.6">Mean Shannon H' = ${(results.reduce((s,r)=>s+r.shannonH,0)/results.length).toFixed(3)}, Mean Simpson D = ${(results.reduce((s,r)=>s+r.simpsonD,0)/results.length).toFixed(3)}</div>
  </div>`;

  // Rarefaction chart
  if (rare.length) {
    html += '<div id="es-rare-plot" style="margin-bottom:16px"></div>';
  }
  H('#es-results', html);

  if (rare.length) {
    Plotly.newPlot('es-rare-plot', [{
      x: rare.map(r => r.n), y: rare.map(r => r.expected_S),
      mode: 'lines+markers', marker: { size: 4, color: CL[0] },
      line: { color: CL[0] }, name: 'Expected S'
    }], { ...PL, title: 'Rarefaction Curve (Sample 1)', xaxis: { ...PL.xaxis, title: 'Sample size' }, yaxis: { ...PL.yaxis, title: 'Expected species richness' } }, { responsive: true });
  }
}

function _esRunPermanova() {
  if (!_esData || _esData.matrix.length < 4) return toast('Need at least 4 samples', 'err');
  const groups = [...new Set(_esData.labels)];
  if (groups.length < 2) return toast('Need at least 2 groups (detected from labels)', 'err');

  toast('Running PERMANOVA (999 permutations)...', 'info');
  setTimeout(() => {
    const dm = buildDistanceMatrix(_esData.matrix, brayCurtis);
    const result = permanova(dm, _esData.labels);
    if (!result) return toast('PERMANOVA failed', 'err');
    H('#es-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">PERMANOVA (Bray-Curtis, ${result.n_permutations} permutations)</h4>
      <table style="font-size:12px;font-family:var(--mf);border-collapse:collapse">
        <tr><td style="padding:4px 12px;color:var(--tm)">F statistic</td><td style="padding:4px 12px;color:var(--ts)">${result.F_stat}</td></tr>
        <tr><td style="padding:4px 12px;color:var(--tm)">R²</td><td style="padding:4px 12px;color:var(--ts)">${result.R2}</td></tr>
        <tr><td style="padding:4px 12px;color:var(--tm)">p-value</td><td style="padding:4px 12px;color:${result.p_value<0.05?'var(--sg)':'var(--ts)'};font-weight:${result.p_value<0.05?'700':'400'}">${result.p_value}</td></tr>
        <tr><td style="padding:4px 12px;color:var(--tm)">Groups</td><td style="padding:4px 12px;color:var(--ts)">${groups.length} (${groups.join(', ')})</td></tr>
      </table>
      <div style="font-size:12px;color:var(--ts);margin-top:8px;line-height:1.6">${result.p_value<0.05?'The PERMANOVA indicates <b>significant differences</b> between groups':'No significant differences detected between groups'} (F=${result.F_stat}, R²=${result.R2}, p=${result.p_value}).</div>
    </div>`);
  }, 50);
}

function _esRunNMDS() {
  if (!_esData || _esData.matrix.length < 4) return toast('Need at least 4 samples', 'err');
  toast('Running NMDS...', 'info');
  setTimeout(() => {
    const dm = buildDistanceMatrix(_esData.matrix, brayCurtis);
    const result = nmds(dm);
    const groups = [...new Set(_esData.labels)];
    const traces = groups.map((g, gi) => {
      const idx = _esData.labels.map((l, i) => l === g ? i : -1).filter(i => i >= 0);
      return {
        x: idx.map(i => result.coords[i][0]), y: idx.map(i => result.coords[i][1]),
        mode: 'markers+text', text: idx.map(i => _esData.labels[i]),
        textposition: 'top center', textfont: { size: 9, color: CL[gi % CL.length] },
        marker: { size: 8, color: CL[gi % CL.length] }, name: g, type: 'scatter'
      };
    });

    H('#es-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:4px">NMDS Ordination (2D, Bray-Curtis)</h4>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:8px">STRESS = ${result.stress} ${result.stress<0.1?'(good)':result.stress<0.2?'(fair)':'(poor)'} · ${result.converged?'Converged':'Did not converge'}</div>
      <div id="es-nmds-plot"></div>
    </div>`);

    Plotly.newPlot('es-nmds-plot', traces, {
      ...PL, title: `NMDS (STRESS = ${result.stress})`,
      xaxis: { ...PL.xaxis, title: 'NMDS1' }, yaxis: { ...PL.yaxis, title: 'NMDS2', scaleanchor: 'x' }
    }, { responsive: true });
  }, 50);
}

function _esRunMannKendall() {
  if (!_esData || _esData.matrix.length < 10) return toast('Need at least 10 data points', 'err');
  // Use first numeric column as time series
  const ts = _esData.matrix.map((r, i) => [i, r[0]]);
  const result = ecoMannKendall(ts);
  if (!result) return toast('Not enough data for Mann-Kendall', 'err');
  const arrow = result.trend === 'increasing' ? '↑' : result.trend === 'decreasing' ? '↓' : '→';
  H('#es-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Mann-Kendall Trend Test</h4>
    <table style="font-size:12px;font-family:var(--mf);border-collapse:collapse">
      <tr><td style="padding:4px 12px;color:var(--tm)">S statistic</td><td style="padding:4px 12px;color:var(--ts)">${result.S}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Z</td><td style="padding:4px 12px;color:var(--ts)">${result.Z}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">p-value</td><td style="padding:4px 12px;color:${result.p_value<0.05?'var(--sg)':'var(--ts)'}">${result.p_value}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Trend</td><td style="padding:4px 12px;color:var(--ts)">${arrow} ${result.trend}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Kendall's tau-b</td><td style="padding:4px 12px;color:var(--ts)">${result.tauB}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Sen's slope</td><td style="padding:4px 12px;color:var(--ts)">${result.sen_slope}/yr</td></tr>
    </table>
    <div style="font-size:12px;color:var(--ts);margin-top:8px;line-height:1.6">${result.p_value<0.05?`${arrow} Significant ${result.trend} trend detected`:'No significant trend detected'} (Z=${result.Z}, p=${result.p_value}, Sen's slope=${result.sen_slope}/yr).</div>
  </div>`);
}

function _esRunRegression() {
  if (!_esData || _esData.colNames.length < 2) return toast('Need at least 2 columns', 'err');
  const x = _esData.matrix.map(r => r[0]);
  const y = _esData.matrix.map(r => r[1]);
  const result = ecoLinearRegression(x, y);
  if (!result) return toast('Regression failed', 'err');

  H('#es-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Linear Regression: ${escHTML(_esData.colNames[1])} ~ ${escHTML(_esData.colNames[0])}</h4>
    <table style="font-size:12px;font-family:var(--mf);border-collapse:collapse">
      <tr><td style="padding:4px 12px;color:var(--tm)">Slope</td><td style="padding:4px 12px;color:var(--ts)">${result.slope} ± ${result.se_slope}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Intercept</td><td style="padding:4px 12px;color:var(--ts)">${result.intercept} ± ${result.se_intercept}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">R²</td><td style="padding:4px 12px;color:var(--ts)">${result.r2}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">r</td><td style="padding:4px 12px;color:var(--ts)">${result.r}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">p-value</td><td style="padding:4px 12px;color:${result.p_value<0.05?'var(--sg)':'var(--ts)'}">${result.p_value}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">n</td><td style="padding:4px 12px;color:var(--ts)">${result.n}</td></tr>
    </table>
    <div id="es-reg-plot" style="margin-top:10px"></div>
  </div>`);

  const xSorted = [...x].sort((a, b) => a - b);
  Plotly.newPlot('es-reg-plot', [
    { x, y, mode: 'markers', marker: { size: 6, color: CL[0] }, name: 'Data', type: 'scatter' },
    { x: [xSorted[0], xSorted[xSorted.length - 1]], y: [result.slope * xSorted[0] + result.intercept, result.slope * xSorted[xSorted.length - 1] + result.intercept],
      mode: 'lines', line: { color: CL[1], dash: 'dash' }, name: `y = ${result.slope.toFixed(3)}x + ${result.intercept.toFixed(3)}` }
  ], { ...PL, xaxis: { ...PL.xaxis, title: _esData.colNames[0] }, yaxis: { ...PL.yaxis, title: _esData.colNames[1] } }, { responsive: true });
}

function _esRunChao1() {
  if (!_esData) return toast('Load data first', 'err');
  // Aggregate across all samples
  const totals = _esData.colNames.map((_, j) => _esData.matrix.reduce((s, r) => s + r[j], 0));
  const result = chao1(totals);
  H('#es-results', `<div style="padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
    <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Chao1 Richness Estimator</h4>
    <table style="font-size:12px;font-family:var(--mf);border-collapse:collapse">
      <tr><td style="padding:4px 12px;color:var(--tm)">Observed S</td><td style="padding:4px 12px;color:var(--ts)">${result.S_observed}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Chao1 estimate</td><td style="padding:4px 12px;color:var(--ts);font-weight:700">${result.chao1}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">95% CI</td><td style="padding:4px 12px;color:var(--ts)">${result.lowerCI} – ${result.upperCI}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Singletons (f₁)</td><td style="padding:4px 12px;color:var(--ts)">${result.singletons}</td></tr>
      <tr><td style="padding:4px 12px;color:var(--tm)">Doubletons (f₂)</td><td style="padding:4px 12px;color:var(--ts)">${result.doubletons}</td></tr>
    </table>
    <div style="font-size:12px;color:var(--ts);margin-top:8px;line-height:1.6">Chao1 estimates ${result.chao1} total species (observed: ${result.S_observed}). Approximately ${Math.max(0, Math.round(result.chao1 - result.S_observed))} species remain undetected.</div>
  </div>`);
}

// ═══ Mann-Kendall badge injection for Env Data tab ═══
function injectMannKendallBadge(varId, data) {
  if (!data || data.length < 10) return;
  const ts = data.map(d => [new Date(d.time).getTime(), d.value]).filter(d => !isNaN(d[1]));
  if (ts.length < 10) return;
  const mk = ecoMannKendall(ts);
  if (!mk) return;
  const arrow = mk.trend === 'increasing' ? '↑' : mk.trend === 'decreasing' ? '↓' : '→';
  const badge = document.createElement('div');
  badge.style.cssText = 'font-size:11px;color:var(--tm);font-family:var(--mf);margin-top:4px;padding:4px 8px;background:var(--bs);border-radius:4px;display:inline-block';
  badge.innerHTML = `${arrow} ${mk.trend} · p=${mk.p_value} · Sen's slope: ${mk.sen_slope.toFixed(4)}/yr`;
  // Find the chart container for this variable
  const charts = $('#echarts');
  if (charts) {
    const plotEls = charts.querySelectorAll('.js-plotly-plot');
    if (plotEls.length) {
      const lastPlot = plotEls[plotEls.length - 1];
      lastPlot.parentElement.insertBefore(badge, lastPlot.nextSibling);
    }
  }
}
