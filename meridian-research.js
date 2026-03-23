// ═══ MERIDIAN RESEARCH PLANNING — Five Sub-Tools ═══
// Keyword Analysis | Question Builder | Gap Map | Methods Advisor | Sample Size Calculator

let _rpInitialized = false;
let _rpCurrentTool = 'keywords';
let _rpQuestions = [];

// ── Stopwords for keyword extraction ──
const _rpStop = new Set('a an the in on of for and or to from by with is are was were be been has have had do does did will would shall should may might can could this that these those it its he she they we i my our your at as but not no nor so if then than too very just about above after again all also am any because been before being below between both but by d did do does doing down during each few from further get got had has have having her here hers herself him himself his how however i if in into is it its itself let ll m me might more most must my myself no nor not now o of off on once only or other our ours ourselves out over own re s same she should so some such t than that the their theirs them themselves then there these they this those through to too under until up us ve very was we were what when where which while who whom why will with won would y you your yours yourself yourselves using used use uses study studies studied between among within across along during although however therefore moreover furthermore nevertheless meanwhile whereas whereby wherein therein herein thereof whereof'.split(' '));

function initResearch() {
  if (_rpInitialized && $('#rp-content')?.children.length) return;
  _rpInitialized = true;
  _rpQuestions = safeParse('meridian_rq', []);
  _rpRender();
}

function _rpRender() {
  H('#rp-content', `
    <div class="tip-wrap"><button class="tip-toggle" onclick="toggleTipPopover(this)" title="About this tab">i</button><div class="tip tip-pop"><b>Research Planning.</b> Five tools to design and refine your research: keyword analysis, question formulation (PICO), literature gap mapping, methods selection, and sample size calculation. All tools draw from your Library.<button class="dx" onclick="this.closest('.tip').style.display='none'">&times;</button></div></div>
    <div class="rp-tabs" id="rp-tabs">
      <button class="rp-tab${_rpCurrentTool==='keywords'?' on':''}" data-tool="keywords" onclick="_rpShowTool('keywords')">Keywords</button>
      <button class="rp-tab${_rpCurrentTool==='questions'?' on':''}" data-tool="questions" onclick="_rpShowTool('questions')">Questions</button>
      <button class="rp-tab${_rpCurrentTool==='gapmap'?' on':''}" data-tool="gapmap" onclick="_rpShowTool('gapmap')">Gap Map</button>
      <button class="rp-tab${_rpCurrentTool==='methods'?' on':''}" data-tool="methods" onclick="_rpShowTool('methods')">Methods</button>
      <button class="rp-tab${_rpCurrentTool==='samplesize'?' on':''}" data-tool="samplesize" onclick="_rpShowTool('samplesize')">Sample Size</button>
    </div>
    <div id="rp-tool-content"></div>
  `);
  _rpShowTool(_rpCurrentTool);
}

function _rpShowTool(id) {
  _rpCurrentTool = id;
  $$('#rp-tabs .rp-tab').forEach(b => b.classList.toggle('on', b.dataset.tool === id));
  $$('.sb-item[data-subtab]').forEach(b => {
    if (b.dataset.tab === 'research') b.classList.toggle('sub-active', b.dataset.subtab === id);
  });
  const fn = {keywords: _rpKeywords, questions: _rpQuestionBuilder, gapmap: _rpGapMap, methods: _rpMethods, samplesize: _rpSampleSize};
  if (fn[id]) fn[id]();
}

// ═══════════════════════════════════════════════════════════════
// 1. KEYWORD ANALYSIS
// ═══════════════════════════════════════════════════════════════

function _rpExtractKeywords() {
  const lib = S.lib || [];
  if (!lib.length) return {};
  const freq = {};
  const byYear = {};
  const cooccur = {};
  lib.forEach(p => {
    const kws = new Set();
    // From keywords array
    if (Array.isArray(p.keywords)) p.keywords.forEach(k => kws.add(k.toLowerCase().trim()));
    // From concepts
    if (Array.isArray(p.concepts)) p.concepts.forEach(c => {
      const n = (c.display_name || c.name || c).toString().toLowerCase().trim();
      if (n.length > 2 && !_rpStop.has(n)) kws.add(n);
    });
    // From title words
    if (p.title) {
      p.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).forEach(w => {
        if (w.length > 3 && !_rpStop.has(w)) kws.add(w);
      });
    }
    const kwArr = [...kws];
    const yr = p.year || (p.published && parseInt(p.published));
    kwArr.forEach(k => {
      freq[k] = (freq[k] || 0) + 1;
      if (yr) {
        if (!byYear[k]) byYear[k] = {};
        byYear[k][yr] = (byYear[k][yr] || 0) + 1;
      }
    });
    // Co-occurrence pairs
    for (let i = 0; i < kwArr.length; i++) {
      for (let j = i + 1; j < kwArr.length; j++) {
        const pair = [kwArr[i], kwArr[j]].sort().join('|||');
        cooccur[pair] = (cooccur[pair] || 0) + 1;
      }
    }
  });
  return {freq, byYear, cooccur};
}

function _rpKeywords() {
  const el = $('#rp-tool-content');
  if (!el) return;
  const lib = S.lib || [];
  if (!lib.length) {
    el.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--tm);font-family:var(--sf);font-size:13px;line-height:1.6"><div style="font-size:24px;margin-bottom:12px;opacity:0.3">&#x1F50D;</div>Add papers to your Library first, then return here for keyword analysis.</div>';
    return;
  }
  const {freq, byYear, cooccur} = _rpExtractKeywords();
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const top50 = sorted.slice(0, 50);
  const maxFreq = top50[0]?.[1] || 1;

  // Build tag cloud HTML
  const tagCloud = top50.map(([w, f]) => {
    const size = Math.max(12, Math.min(48, 12 + (f / maxFreq) * 36));
    const opacity = 0.5 + (f / maxFreq) * 0.5;
    return `<span style="font-size:${size}px;opacity:${opacity};color:var(--ac);padding:2px 6px;display:inline-block;cursor:default;font-family:var(--sf)" title="${w}: ${f} papers">${w}</span>`;
  }).join(' ');

  // Frequency table (top 30)
  const tableRows = sorted.slice(0, 30).map(([w, f], i) => {
    const bar = Math.round((f / maxFreq) * 100);
    return `<tr><td style="color:var(--tm);font-size:11px;width:24px">${i + 1}</td><td style="font-size:12px;font-family:var(--mf)">${w}</td><td style="width:50px;text-align:right;font-size:12px;color:var(--ac);font-family:var(--mf)">${f}</td><td style="width:120px"><div style="height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="width:${bar}%;height:100%;background:var(--ac);border-radius:3px"></div></div></td></tr>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <button class="bt sm on" onclick="_rpKwView('cloud')">Tag Cloud</button>
      <button class="bt sm" onclick="_rpKwView('table')">Frequency Table</button>
      <button class="bt sm" onclick="_rpKwView('trend')">Trend Chart</button>
      <button class="bt sm" onclick="_rpKwView('network')">Co-occurrence</button>
      <button class="bt sm" style="margin-left:auto" onclick="_rpExportKeywords()">Export CSV</button>
    </div>
    <div id="rp-kw-cloud" style="padding:16px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);line-height:2;text-align:center">${tagCloud}</div>
    <div id="rp-kw-table" style="display:none;max-height:500px;overflow:auto">
      <table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--bd)"><th></th><th style="text-align:left;font-size:11px;color:var(--tm);font-family:var(--mf)">Keyword</th><th style="text-align:right;font-size:11px;color:var(--tm);font-family:var(--mf)">Count</th><th></th></tr></thead><tbody>${tableRows}</tbody></table>
    </div>
    <div id="rp-kw-trend" style="display:none"></div>
    <div id="rp-kw-network" style="display:none"></div>
    <div style="margin-top:10px;font-size:11px;color:var(--tm);font-family:var(--mf)">${sorted.length} unique keywords from ${lib.length} papers</div>
  `;
}

function _rpKwView(view) {
  ['cloud', 'table', 'trend', 'network'].forEach(v => {
    const el = $(`#rp-kw-${v}`);
    if (el) el.style.display = v === view ? '' : 'none';
  });
  $$('#rp-tool-content .bt[onclick^="_rpKwView"]').forEach(b => {
    b.classList.toggle('on', b.getAttribute('onclick').includes(`'${view}'`));
  });
  if (view === 'trend') _rpRenderTrend();
  if (view === 'network') _rpRenderNetwork();
}

function _rpRenderTrend() {
  const el = $('#rp-kw-trend');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  const {freq, byYear} = _rpExtractKeywords();
  const top8 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  const allYears = new Set();
  top8.forEach(k => { if (byYear[k]) Object.keys(byYear[k]).forEach(y => allYears.add(+y)); });
  const years = [...allYears].sort();
  if (years.length < 2) { el.innerHTML = '<div style="padding:20px;color:var(--tm);font-size:12px;text-align:center">Need papers from multiple years for trend analysis.</div>'; return; }
  const traces = top8.map(k => ({
    x: years, y: years.map(y => (byYear[k] || {})[y] || 0),
    name: k, type: 'scatter', mode: 'lines+markers', line: {width: 2}
  }));
  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: {family: 'Inter, sans-serif', size: 11, color: getComputedStyle(document.documentElement).getPropertyValue('--tm').trim()},
    margin: {t: 30, r: 20, b: 40, l: 40}, height: 350,
    xaxis: {title: 'Year', gridcolor: 'rgba(201,149,107,.1)'},
    yaxis: {title: 'Papers', gridcolor: 'rgba(201,149,107,.1)'},
    legend: {orientation: 'h', y: -0.2}
  };
  Plotly.newPlot(el, traces, layout, {responsive: true, displayModeBar: false});
}

function _rpRenderNetwork() {
  const el = $('#rp-kw-network');
  if (!el || el.dataset.rendered) return;
  el.dataset.rendered = '1';
  if (typeof d3 === 'undefined') { el.innerHTML = '<div style="padding:20px;color:var(--tm);font-size:12px;text-align:center">D3.js not available.</div>'; return; }
  const {freq, cooccur} = _rpExtractKeywords();
  const top20 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => e[0]);
  const topSet = new Set(top20);
  const nodes = top20.map(k => ({id: k, freq: freq[k]}));
  const links = [];
  Object.entries(cooccur).forEach(([pair, count]) => {
    const [a, b] = pair.split('|||');
    if (topSet.has(a) && topSet.has(b) && count >= 2) links.push({source: a, target: b, value: count});
  });
  if (!links.length) { el.innerHTML = '<div style="padding:20px;color:var(--tm);font-size:12px;text-align:center">Not enough co-occurrence data (need keywords appearing together in 2+ papers).</div>'; return; }
  const maxF = Math.max(...nodes.map(n => n.freq));
  const W = el.clientWidth || 600, H2 = 400;
  el.innerHTML = '';
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H2).attr('viewBox', `0 0 ${W} ${H2}`);
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(W / 2, H2 / 2))
    .force('collision', d3.forceCollide().radius(d => 8 + (d.freq / maxF) * 16));
  const link = svg.append('g').selectAll('line').data(links).enter().append('line')
    .attr('stroke', 'rgba(201,149,107,.3)').attr('stroke-width', d => Math.min(4, d.value));
  const node = svg.append('g').selectAll('g').data(nodes).enter().append('g').call(
    d3.drag().on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
  );
  node.append('circle').attr('r', d => 4 + (d.freq / maxF) * 12)
    .attr('fill', 'rgba(201,149,107,.6)').attr('stroke', 'var(--ac)').attr('stroke-width', 1);
  node.append('text').text(d => d.id).attr('x', d => 6 + (d.freq / maxF) * 12)
    .attr('y', 3).attr('font-size', '10px').attr('fill', 'var(--ts)').attr('font-family', 'var(--mf)');
  sim.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

function _rpExportKeywords() {
  const {freq} = _rpExtractKeywords();
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const csv = 'Keyword,Count\n' + sorted.map(([k, c]) => `"${k}",${c}`).join('\n');
  dl(csv, 'meridian-keywords.csv', 'text/csv');
  toast('Keywords exported', 'ok');
}

// ═══════════════════════════════════════════════════════════════
// 2. RESEARCH QUESTION BUILDER (PICO/PECO)
// ═══════════════════════════════════════════════════════════════

function _rpQuestionBuilder() {
  const el = $('#rp-tool-content');
  if (!el) return;
  const saved = _rpQuestions;
  const _s = 'font-size:11px;color:var(--tm);font-family:var(--mf)';
  const _box = 'padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)';
  el.innerHTML = `
    <div style="${_box};margin-bottom:14px">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:6px">PICO/PECO Framework</h4>
      <p style="${_s};line-height:1.5;margin-bottom:12px">Build a structured research question. PICO = Population, Intervention, Comparison, Outcome. Use PECO (Exposure) for observational studies.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:600px">
        <label style="${_s}"><b style="color:var(--ac)">P</b> — Population / Species / Ecosystem
          <input class="si" id="rp-pico-p" placeholder="e.g. Juvenile Pagrus auratus in BGTW" style="width:100%;margin-top:2px">
        </label>
        <label style="${_s}"><b style="color:var(--ac)">I/E</b> — Intervention or Exposure
          <input class="si" id="rp-pico-i" placeholder="e.g. catch-and-release angling stress" style="width:100%;margin-top:2px">
        </label>
        <label style="${_s}"><b style="color:var(--ac)">C</b> — Comparison / Control
          <input class="si" id="rp-pico-c" placeholder="e.g. non-angled controls" style="width:100%;margin-top:2px">
        </label>
        <label style="${_s}"><b style="color:var(--ac)">O</b> — Outcome
          <input class="si" id="rp-pico-o" placeholder="e.g. post-release mortality rate" style="width:100%;margin-top:2px">
        </label>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label style="${_s}">Study type:
          <select class="fs" id="rp-pico-type" style="margin-left:4px">
            <option value="experimental">Experimental (PICO)</option>
            <option value="observational">Observational (PECO)</option>
            <option value="descriptive">Descriptive</option>
          </select>
        </label>
        <button class="bt on" onclick="_rpGenerateQuestion()">Generate Question</button>
      </div>
      <div id="rp-question-output" style="margin-top:12px"></div>
    </div>
    <div style="${_box};margin-bottom:14px">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">FINER Checklist</h4>
      <div id="rp-finer" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-width:600px">
        ${['Feasible — Can this be answered with available resources, time, and expertise?',
           'Interesting — Is it scientifically interesting and worth investigating?',
           'Novel — Does it add new knowledge beyond what is already published?',
           'Ethical — Are there ethical issues with the study design or species involved?',
           'Relevant — Is it relevant to conservation, management, or the field?']
          .map((item, i) => {
            const [label, desc] = item.split(' — ');
            return `<label style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;background:var(--be);border-radius:6px;cursor:pointer">
              <input type="checkbox" id="rp-finer-${i}" style="accent-color:var(--sg);margin-top:2px">
              <span style="${_s};line-height:1.5"><b style="color:var(--sg)">${label}</b> — ${desc}</span></label>`;
          }).join('')}
      </div>
      <div id="rp-finer-score" style="margin-top:8px;font-size:12px;color:var(--tm);font-family:var(--mf)"></div>
    </div>
    <div style="${_box}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf)">Saved Questions (${saved.length})</h4>
        ${saved.length ? '<button class="bt sm" onclick="_rpExportQuestions()">Export</button>' : ''}
      </div>
      <div id="rp-saved-q">${saved.length ? saved.map((q, i) => `
        <div style="padding:8px;background:var(--be);border-radius:6px;margin-bottom:6px;position:relative">
          <div style="font-size:12px;color:var(--ts);font-family:var(--sf);line-height:1.5">${q.question}</div>
          <div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-top:4px">${q.type} · FINER ${q.finer}/5 · ${q.date}</div>
          <button class="dx" style="position:absolute;top:4px;right:4px" onclick="_rpDeleteQuestion(${i})">&times;</button>
        </div>`).join('') : '<div style="font-size:12px;color:var(--tm);font-family:var(--mf)">No saved questions yet. Generate and save one above.</div>'}</div>
    </div>
  `;
  // Wire FINER checkboxes
  for (let i = 0; i < 5; i++) {
    const cb = $(`#rp-finer-${i}`);
    if (cb) cb.addEventListener('change', _rpUpdateFiner);
  }
}

function _rpGenerateQuestion() {
  const p = $('#rp-pico-p')?.value?.trim() || '';
  const i = $('#rp-pico-i')?.value?.trim() || '';
  const c = $('#rp-pico-c')?.value?.trim() || '';
  const o = $('#rp-pico-o')?.value?.trim() || '';
  const type = $('#rp-pico-type')?.value || 'experimental';
  if (!p) return toast('Enter at least the Population field', 'err');
  let question = '';
  if (type === 'experimental') {
    question = c ? `In ${p}, does ${i} compared to ${c} affect ${o}?` : `In ${p}, does ${i} affect ${o}?`;
  } else if (type === 'observational') {
    question = c ? `In ${p}, is ${i} compared to ${c} associated with ${o}?` : `In ${p}, is ${i} associated with ${o}?`;
  } else {
    question = `What is the ${o || 'pattern'} of ${i || 'the variable of interest'} in ${p}?`;
  }
  // Novelty check
  let novelty = '';
  const lib = S.lib || [];
  if (lib.length) {
    const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !_rpStop.has(w));
    let bestOverlap = 0;
    let bestTitle = '';
    lib.forEach(paper => {
      const titleWords = (paper.title || '').toLowerCase().split(/\s+/);
      const overlap = qWords.filter(w => titleWords.includes(w)).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; bestTitle = paper.title; }
    });
    const score = qWords.length ? Math.round((1 - bestOverlap / qWords.length) * 100) : 100;
    const color = score > 70 ? 'var(--sg)' : score > 40 ? 'var(--wa)' : 'var(--co)';
    novelty = `<div style="margin-top:8px;font-size:11px;font-family:var(--mf)"><span style="color:${color};font-weight:600">Novelty: ${score}%</span> <span style="color:var(--tm)">${bestOverlap > 0 ? `— closest match: "${bestTitle?.slice(0, 80)}..."` : '— no close matches in your library'}</span></div>`;
  }
  H('#rp-question-output', `
    <div style="padding:10px;background:var(--be);border:1px solid var(--bd);border-radius:6px">
      <div style="font-size:13px;color:var(--ts);font-family:var(--sf);font-weight:500;line-height:1.6">${question}</div>
      ${novelty}
      <button class="bt sm" onclick="_rpSaveQuestion('${question.replace(/'/g, "\\'")}','${type}')" style="margin-top:8px">Save Question</button>
    </div>
  `);
}

function _rpUpdateFiner() {
  let score = 0;
  for (let i = 0; i < 5; i++) if ($(`#rp-finer-${i}`)?.checked) score++;
  const color = score >= 4 ? 'var(--sg)' : score >= 2 ? 'var(--wa)' : 'var(--co)';
  H('#rp-finer-score', `<span style="color:${color};font-weight:600">${score}/5</span> criteria met`);
}

function _rpSaveQuestion(question, type) {
  let finer = 0;
  for (let i = 0; i < 5; i++) if ($(`#rp-finer-${i}`)?.checked) finer++;
  _rpQuestions.push({question, type, finer, date: new Date().toISOString().split('T')[0]});
  localStorage.setItem('meridian_rq', JSON.stringify(_rpQuestions));
  toast('Question saved', 'ok');
  _rpQuestionBuilder();
}

function _rpDeleteQuestion(idx) {
  _rpQuestions.splice(idx, 1);
  localStorage.setItem('meridian_rq', JSON.stringify(_rpQuestions));
  _rpQuestionBuilder();
}

function _rpExportQuestions() {
  const csv = 'Question,Type,FINER Score,Date\n' + _rpQuestions.map(q => `"${q.question}",${q.type},${q.finer},${q.date}`).join('\n');
  dl(csv, 'meridian-research-questions.csv', 'text/csv');
  toast('Questions exported', 'ok');
}

// ═══════════════════════════════════════════════════════════════
// 3. LITERATURE GAP MAP
// ═══════════════════════════════════════════════════════════════

function _rpGapMap() {
  const el = $('#rp-tool-content');
  if (!el) return;
  const lib = S.lib || [];
  if (lib.length < 3) {
    el.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--tm);font-family:var(--sf);font-size:13px;line-height:1.6"><div style="font-size:24px;margin-bottom:12px;opacity:0.3">&#x1F5FA;</div>Add at least 3 papers to your Library to generate a gap map.</div>';
    return;
  }
  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;color:var(--tm);font-family:var(--mf)">Matrix:</span>
      <select class="fs" id="rp-gm-rows" onchange="_rpBuildGapMatrix()">
        <option value="topics" selected>Topics (rows)</option>
        <option value="species">Species</option>
        <option value="regions">Regions</option>
      </select>
      <span style="font-size:11px;color:var(--tm)">×</span>
      <select class="fs" id="rp-gm-cols" onchange="_rpBuildGapMatrix()">
        <option value="methods">Methods (cols)</option>
        <option value="regions" selected>Regions</option>
        <option value="years">Year Bins</option>
      </select>
      <button class="bt sm" style="margin-left:auto" onclick="_rpExportGapMap()">Export CSV</button>
    </div>
    <div id="rp-gm-chart" style="min-height:300px"></div>
    <div id="rp-gm-gaps" style="margin-top:12px"></div>
  `;
  _rpBuildGapMatrix();
}

function _rpExtractDimension(dim) {
  const lib = S.lib || [];
  const items = {};
  lib.forEach(p => {
    const vals = new Set();
    if (dim === 'topics') {
      if (Array.isArray(p.concepts)) p.concepts.slice(0, 5).forEach(c => vals.add((c.display_name || c.name || c).toString()));
      else if (Array.isArray(p.keywords)) p.keywords.slice(0, 5).forEach(k => vals.add(k));
      else if (p.title) p.title.split(/\s+/).filter(w => w.length > 4 && !_rpStop.has(w.toLowerCase())).slice(0, 3).forEach(w => vals.add(w));
    } else if (dim === 'methods') {
      if (Array.isArray(p._methods)) p._methods.forEach(m => vals.add(m));
      else if (Array.isArray(p.concepts)) {
        const methodWords = ['survey', 'experiment', 'modelling', 'tagging', 'sampling', 'genetics', 'otolith', 'acoustic', 'visual census', 'remote sensing', 'meta-analysis', 'review', 'simulation', 'field study'];
        p.concepts.forEach(c => {
          const n = (c.display_name || c).toString().toLowerCase();
          methodWords.forEach(m => { if (n.includes(m)) vals.add(m); });
        });
      }
      if (!vals.size) vals.add('unspecified');
    } else if (dim === 'species') {
      if (Array.isArray(p._species)) p._species.forEach(s => vals.add(s));
      else if (p.title) {
        const italicMatch = p.title.match(/[A-Z][a-z]+ [a-z]+/g);
        if (italicMatch) italicMatch.forEach(s => vals.add(s));
      }
      if (!vals.size) vals.add('unspecified');
    } else if (dim === 'regions') {
      if (Array.isArray(p._regions)) p._regions.forEach(r => vals.add(r));
      else {
        const regionWords = ['Atlantic', 'Pacific', 'Indian', 'Mediterranean', 'Caribbean', 'Arctic', 'Antarctic', 'Tropical', 'Temperate', 'Coral reef', 'Estuary', 'Deep sea', 'Coastal', 'Pelagic'];
        const text = ((p.title || '') + ' ' + (p.abstract || '')).toLowerCase();
        regionWords.forEach(r => { if (text.includes(r.toLowerCase())) vals.add(r); });
        if (!vals.size) vals.add('unspecified');
      }
    } else if (dim === 'years') {
      const yr = p.year || (p.published && parseInt(p.published));
      if (yr) {
        const bin = Math.floor(yr / 5) * 5;
        vals.add(`${bin}-${bin + 4}`);
      }
    }
    vals.forEach(v => {
      if (!items[v]) items[v] = [];
      items[v].push(p);
    });
  });
  return items;
}

let _rpGapMatrixData = null;

function _rpBuildGapMatrix() {
  const rowDim = $('#rp-gm-rows')?.value || 'topics';
  const colDim = $('#rp-gm-cols')?.value || 'regions';
  const rowData = _rpExtractDimension(rowDim);
  const colData = _rpExtractDimension(colDim);
  // Take top items by frequency
  const rowKeys = Object.entries(rowData).sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(e => e[0]);
  const colKeys = Object.entries(colData).sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(e => e[0]);
  // Build count matrix
  const matrix = [];
  const gaps = [];
  rowKeys.forEach((r, ri) => {
    const row = [];
    colKeys.forEach((c, ci) => {
      const rPapers = new Set(rowData[r].map(p => p.title));
      const count = (colData[c] || []).filter(p => rPapers.has(p.title)).length;
      row.push(count);
      if (count === 0) gaps.push({row: r, col: c, opportunity: (rowData[r]?.length || 0) + (colData[c]?.length || 0)});
    });
    matrix.push(row);
  });
  _rpGapMatrixData = {rowKeys, colKeys, matrix, gaps};
  // Render heatmap with Plotly
  const chartEl = $('#rp-gm-chart');
  if (chartEl && typeof Plotly !== 'undefined') {
    const trace = {
      z: matrix, x: colKeys, y: rowKeys, type: 'heatmap',
      colorscale: [[0, 'rgba(39,37,54,1)'], [0.5, 'rgba(201,149,107,.5)'], [1, 'rgba(201,149,107,1)']],
      hovertemplate: '%{y} × %{x}: %{z} papers<extra></extra>'
    };
    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: {family: 'Inter, sans-serif', size: 10, color: getComputedStyle(document.documentElement).getPropertyValue('--tm').trim()},
      margin: {t: 10, r: 20, b: 100, l: 120}, height: Math.max(300, rowKeys.length * 28 + 120),
      xaxis: {tickangle: -45}, yaxis: {autorange: 'reversed'}
    };
    Plotly.newPlot(chartEl, [trace], layout, {responsive: true, displayModeBar: false});
  }
  // Render gaps
  gaps.sort((a, b) => b.opportunity - a.opportunity);
  const gapEl = $('#rp-gm-gaps');
  if (gapEl) {
    if (gaps.length) {
      gapEl.innerHTML = `<h4 style="font-size:12px;color:var(--wa);font-family:var(--mf);margin-bottom:6px">Identified Gaps (${gaps.length})</h4>` +
        gaps.slice(0, 10).map(g => `<div style="padding:6px 10px;background:var(--be);border-radius:6px;margin-bottom:4px;font-size:12px;font-family:var(--mf);display:flex;justify-content:space-between">
          <span style="color:var(--ts)">${g.row} <span style="color:var(--tm)">&times;</span> ${g.col}</span>
          <span style="color:var(--wa)">opportunity score: ${g.opportunity}</span>
        </div>`).join('');
    } else {
      gapEl.innerHTML = '<div style="font-size:12px;color:var(--sg);font-family:var(--mf)">No empty cells found — good coverage across dimensions!</div>';
    }
  }
}

function _rpExportGapMap() {
  if (!_rpGapMatrixData) return toast('Build a gap map first', 'err');
  const {rowKeys, colKeys, matrix} = _rpGapMatrixData;
  let csv = ',' + colKeys.map(c => `"${c}"`).join(',') + '\n';
  rowKeys.forEach((r, i) => { csv += `"${r}",${matrix[i].join(',')}\n`; });
  dl(csv, 'meridian-gap-map.csv', 'text/csv');
  toast('Gap map exported', 'ok');
}

// ═══════════════════════════════════════════════════════════════
// 4. METHODS ADVISOR
// ═══════════════════════════════════════════════════════════════

const _rpMethodsDB = [
  {name:'Independent t-test',when:'Compare means of 2 independent groups',assumptions:'Normality, equal variance, independence',
    r:'t.test(group1, group2, var.equal = TRUE)',py:'from scipy.stats import ttest_ind\nstat, p = ttest_ind(group1, group2)',
    ex:'Comparing mean fish length between MPA and fished sites',
    match:a=>a.data==='continuous'&&a.groups==='2'&&a.indep==='yes'&&a.normal==='yes'},
  {name:'Welch t-test',when:'Compare means of 2 groups with unequal variance',assumptions:'Normality, independence (no equal variance needed)',
    r:'t.test(group1, group2)',py:'from scipy.stats import ttest_ind\nstat, p = ttest_ind(group1, group2, equal_var=False)',
    ex:'Comparing CPUE between seasons with different sampling effort',
    match:a=>a.data==='continuous'&&a.groups==='2'&&a.indep==='yes'&&a.normal==='yes'&&a.size!=='small'},
  {name:'Mann-Whitney U test',when:'Compare 2 independent groups (non-parametric)',assumptions:'Independence, ordinal or continuous data',
    r:'wilcox.test(group1, group2)',py:'from scipy.stats import mannwhitneyu\nstat, p = mannwhitneyu(group1, group2)',
    ex:'Comparing abundance rankings between impacted and control reefs',
    match:a=>a.data==='continuous'&&a.groups==='2'&&a.indep==='yes'&&a.normal==='no'},
  {name:'Paired t-test',when:'Compare means from matched/paired observations',assumptions:'Normality of differences, paired data',
    r:'t.test(before, after, paired = TRUE)',py:'from scipy.stats import ttest_rel\nstat, p = ttest_rel(before, after)',
    ex:'Comparing fish weight before and after a feeding trial',
    match:a=>a.data==='continuous'&&a.groups==='2'&&a.indep==='repeated'},
  {name:'Wilcoxon signed-rank test',when:'Compare paired observations (non-parametric)',assumptions:'Paired data, symmetric differences',
    r:'wilcox.test(before, after, paired = TRUE)',py:'from scipy.stats import wilcoxon\nstat, p = wilcoxon(before, after)',
    ex:'Before-after coral cover at permanently marked quadrats',
    match:a=>a.data==='continuous'&&a.groups==='2'&&a.indep==='repeated'&&a.normal==='no'},
  {name:'One-way ANOVA',when:'Compare means across 3+ independent groups',assumptions:'Normality, homogeneity of variance, independence',
    r:'aov(response ~ group, data = df)\nsummary(model)',py:'from scipy.stats import f_oneway\nstat, p = f_oneway(group1, group2, group3)',
    ex:'Comparing species richness across 4 habitat types',
    match:a=>a.data==='continuous'&&a.groups==='3+'&&a.indep==='yes'&&a.normal==='yes'},
  {name:'Kruskal-Wallis test',when:'Compare 3+ independent groups (non-parametric)',assumptions:'Independence, ordinal or continuous data',
    r:'kruskal.test(response ~ group, data = df)',py:'from scipy.stats import kruskal\nstat, p = kruskal(group1, group2, group3)',
    ex:'Comparing reef health scores across multiple marine zones',
    match:a=>a.data==='continuous'&&a.groups==='3+'&&a.indep==='yes'&&a.normal==='no'},
  {name:'Linear mixed model (LMM)',when:'Compare groups with nested/hierarchical data structure',assumptions:'Normality of residuals, random effects structure',
    r:'library(lme4)\nmodel <- lmer(response ~ treatment + (1|site), data = df)\nsummary(model)',
    py:'import statsmodels.formula.api as smf\nmodel = smf.mixedlm("response ~ treatment", df, groups=df["site"])\nresult = model.fit()',
    ex:'Fish growth rates across treatments, with fish nested within tanks',
    match:a=>a.data==='continuous'&&a.indep==='nested'},
  {name:'Repeated measures ANOVA',when:'Compare means across time points within subjects',assumptions:'Sphericity, normality',
    r:'library(ez)\nezANOVA(data=df, dv=response, wid=subject, within=time)',
    py:'from statsmodels.stats.anova import AnovaRM\nmodel = AnovaRM(df, "response", "subject", within=["time"]).fit()',
    ex:'Tracking fish condition factor across monthly sampling events',
    match:a=>a.data==='continuous'&&a.groups==='3+'&&a.indep==='repeated'&&a.normal==='yes'},
  {name:'Linear regression',when:'Model relationship between continuous predictor and response',assumptions:'Linearity, normality of residuals, homoscedasticity',
    r:'model <- lm(y ~ x, data = df)\nsummary(model)',py:'from sklearn.linear_model import LinearRegression\nmodel = LinearRegression().fit(X, y)',
    ex:'Modeling fish length as a function of age from otolith data',
    match:a=>a.goal==='prediction'&&a.data==='continuous'&&a.normal==='yes'},
  {name:'GLM (Poisson)',when:'Model count data with Poisson distribution',assumptions:'Mean equals variance, log link',
    r:'model <- glm(count ~ predictor, family = poisson, data = df)\nsummary(model)',
    py:'import statsmodels.api as sm\nmodel = sm.GLM(y, X, family=sm.families.Poisson()).fit()',
    ex:'Modeling species abundance counts as a function of habitat variables',
    match:a=>a.data==='count'&&a.goal!=='classification'},
  {name:'GLM (Binomial / Logistic regression)',when:'Model binary or proportional outcomes',assumptions:'Independence, binary response',
    r:'model <- glm(outcome ~ predictor, family = binomial, data = df)\nsummary(model)',
    py:'from sklearn.linear_model import LogisticRegression\nmodel = LogisticRegression().fit(X, y)',
    ex:'Predicting post-release survival (alive/dead) from handling time',
    match:a=>a.data==='categorical'},
  {name:'Chi-square test of independence',when:'Test association between two categorical variables',assumptions:'Expected cell counts >= 5',
    r:'chisq.test(table(df$var1, df$var2))',py:'from scipy.stats import chi2_contingency\nchi2, p, dof, expected = chi2_contingency(table)',
    ex:'Testing if bycatch species composition differs between gear types',
    match:a=>a.data==='categorical'&&a.goal==='comparison'},
  {name:'Pearson correlation',when:'Measure linear association between two continuous variables',assumptions:'Normality, linearity',
    r:'cor.test(x, y, method = "pearson")',py:'from scipy.stats import pearsonr\nr, p = pearsonr(x, y)',
    ex:'Correlation between SST and chlorophyll-a concentration',
    match:a=>a.goal==='correlation'&&a.normal==='yes'},
  {name:'Spearman rank correlation',when:'Measure monotonic association (non-parametric)',assumptions:'Ordinal or continuous data',
    r:'cor.test(x, y, method = "spearman")',py:'from scipy.stats import spearmanr\nrho, p = spearmanr(x, y)',
    ex:'Correlation between depth and species diversity rank',
    match:a=>a.goal==='correlation'&&a.normal==='no'},
  {name:'PERMANOVA',when:'Test multivariate community composition differences between groups',assumptions:'Homogeneity of dispersions',
    r:'library(vegan)\nadonis2(species_matrix ~ group, data = env, method = "bray")',
    py:'from skbio.stats.distance import permanova\nresult = permanova(dm, grouping)',
    ex:'Testing if fish assemblage composition differs between protected and fished reefs',
    match:a=>a.goal==='comparison'&&a.data==='continuous'&&a.spatial==='none'&&a.groups!=='1'},
  {name:'NMDS ordination',when:'Visualize multivariate community data in 2D',assumptions:'Stress < 0.2 for reliable interpretation',
    r:'library(vegan)\nnmds <- metaMDS(species_matrix, distance = "bray")\nplot(nmds)',
    py:'from sklearn.manifold import MDS\nmds = MDS(n_components=2, dissimilarity="precomputed")\ncoords = mds.fit_transform(dist_matrix)',
    ex:'Ordinating benthic community samples to visualize habitat groupings',
    match:a=>a.goal==='ordination'},
  {name:'GAM (Generalized Additive Model)',when:'Model non-linear relationships with smooth terms',assumptions:'Response distribution specified, smooth functions',
    r:'library(mgcv)\nmodel <- gam(y ~ s(x1) + s(x2), family = gaussian, data = df)\nsummary(model)',
    py:'from pygam import LinearGAM, s\ngam = LinearGAM(s(0) + s(1)).fit(X, y)',
    ex:'Modeling species distribution as a smooth function of SST and depth',
    match:a=>a.goal==='prediction'&&a.normal==='no'},
  {name:'Cox proportional hazards',when:'Model time-to-event data with covariates',assumptions:'Proportional hazards, non-informative censoring',
    r:'library(survival)\nmodel <- coxph(Surv(time, event) ~ predictor, data = df)\nsummary(model)',
    py:'from lifelines import CoxPHFitter\ncph = CoxPHFitter()\ncph.fit(df, duration_col="time", event_col="event")',
    ex:'Modeling post-release survival time as a function of hook depth and fight time',
    match:a=>a.data==='survival'},
  {name:'Spatial autocorrelation (Moran\'s I) + GLS',when:'Handle spatially correlated residuals',assumptions:'Known spatial coordinates',
    r:'library(nlme)\nmodel <- gls(y ~ x, correlation = corExp(form = ~lon+lat), data = df)',
    py:'from pysal.explore.esda import Moran\nmoran = Moran(y, weights)',
    ex:'Modeling fish density across survey sites accounting for spatial dependence',
    match:a=>a.spatial==='spatial'},
  {name:'Time series analysis (ARIMA)',when:'Model temporal trends and autocorrelation in sequential data',assumptions:'Stationarity (after differencing)',
    r:'library(forecast)\nmodel <- auto.arima(ts_data)\nforecast(model, h = 12)',
    py:'from statsmodels.tsa.arima.model import ARIMA\nmodel = ARIMA(ts_data, order=(1,1,1)).fit()',
    ex:'Forecasting monthly CPUE from a 20-year fisheries time series',
    match:a=>a.spatial==='temporal'}
];

function _rpMethods() {
  const el = $('#rp-tool-content');
  if (!el) return;
  const _s = 'font-size:11px;color:var(--tm);font-family:var(--mf)';
  const _box = 'padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)';
  el.innerHTML = `
    <div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:10px">Methods Decision Tree</h4>
      <p style="${_s};margin-bottom:14px;line-height:1.5">Answer these questions about your study and data to get a tailored statistical method recommendation with R and Python code.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:600px">
        <label style="${_s}">1. What type of data is your response variable?
          <select class="fs" id="rp-ma-data" style="width:100%;margin-top:2px">
            <option value="continuous">Continuous (length, weight, concentration)</option>
            <option value="count">Count (abundance, number of events)</option>
            <option value="categorical">Categorical / Binary (alive/dead, present/absent)</option>
            <option value="survival">Survival / Time-to-event</option>
          </select>
        </label>
        <label style="${_s}">2. What is your research goal?
          <select class="fs" id="rp-ma-goal" style="width:100%;margin-top:2px">
            <option value="comparison">Compare groups</option>
            <option value="correlation">Test association / correlation</option>
            <option value="prediction">Predict / model relationship</option>
            <option value="ordination">Visualize community structure</option>
            <option value="classification">Classify observations</option>
          </select>
        </label>
        <label style="${_s}">3. How many groups / treatments?
          <select class="fs" id="rp-ma-groups" style="width:100%;margin-top:2px">
            <option value="1">1 (single population)</option>
            <option value="2" selected>2</option>
            <option value="3+">3 or more</option>
          </select>
        </label>
        <label style="${_s}">4. Are observations independent?
          <select class="fs" id="rp-ma-indep" style="width:100%;margin-top:2px">
            <option value="yes" selected>Yes — independent</option>
            <option value="nested">No — nested / hierarchical</option>
            <option value="repeated">No — repeated measures / paired</option>
          </select>
        </label>
        <label style="${_s}">5. Approximate sample size (per group)?
          <select class="fs" id="rp-ma-size" style="width:100%;margin-top:2px">
            <option value="small">&lt; 30</option>
            <option value="medium" selected>30 – 100</option>
            <option value="large">&gt; 100</option>
          </select>
        </label>
        <label style="${_s}">6. Is your data normally distributed?
          <select class="fs" id="rp-ma-normal" style="width:100%;margin-top:2px">
            <option value="yes">Yes / approximately</option>
            <option value="no">No / strongly skewed</option>
            <option value="unknown" selected>Unknown</option>
          </select>
        </label>
        <label style="${_s}">7. Spatial or temporal component?
          <select class="fs" id="rp-ma-spatial" style="width:100%;margin-top:2px">
            <option value="none" selected>None</option>
            <option value="spatial">Spatial (geographic coordinates)</option>
            <option value="temporal">Temporal (time series)</option>
            <option value="both">Spatio-temporal</option>
          </select>
        </label>
      </div>
      <button class="bt on" onclick="_rpGetRecommendation()" style="margin-top:14px">Get Recommendation</button>
    </div>
    <div id="rp-ma-result" style="margin-top:14px"></div>
  `;
}

function _rpGetRecommendation() {
  const a = {
    data: $('#rp-ma-data')?.value || 'continuous',
    goal: $('#rp-ma-goal')?.value || 'comparison',
    groups: $('#rp-ma-groups')?.value || '2',
    indep: $('#rp-ma-indep')?.value || 'yes',
    size: $('#rp-ma-size')?.value || 'medium',
    normal: $('#rp-ma-normal')?.value || 'unknown',
    spatial: $('#rp-ma-spatial')?.value || 'none'
  };
  // If unknown normal + small sample → assume no
  if (a.normal === 'unknown' && a.size === 'small') a.normal = 'no';
  if (a.normal === 'unknown') a.normal = 'yes';
  // Find best matching methods
  const matches = _rpMethodsDB.filter(m => {
    try { return m.match(a); } catch { return false; }
  });
  // Fallback: score all methods by partial match
  let results = matches;
  if (!results.length) {
    const scored = _rpMethodsDB.map(m => {
      let score = 0;
      try {
        if (m.match({...a})) score += 10;
      } catch {}
      // Partial scoring by keyword matching in 'when' field
      if (m.when.toLowerCase().includes(a.data)) score += 2;
      if (m.when.toLowerCase().includes(a.goal)) score += 2;
      if (a.indep === 'nested' && m.name.toLowerCase().includes('mixed')) score += 3;
      if (a.spatial === 'temporal' && m.name.toLowerCase().includes('time')) score += 3;
      if (a.spatial === 'spatial' && m.name.toLowerCase().includes('spatial')) score += 3;
      if (a.data === 'count' && m.name.toLowerCase().includes('poisson')) score += 3;
      if (a.data === 'categorical' && (m.name.toLowerCase().includes('logistic') || m.name.toLowerCase().includes('chi'))) score += 3;
      if (a.data === 'survival' && m.name.toLowerCase().includes('cox')) score += 3;
      return {method: m, score};
    }).sort((a, b) => b.score - a.score);
    results = scored.slice(0, 3).filter(s => s.score > 0).map(s => s.method);
  }
  if (!results.length) results = [_rpMethodsDB[0]]; // Fallback to t-test
  const el = $('#rp-ma-result');
  if (!el) return;
  el.innerHTML = results.map((m, i) => `
    <div style="padding:14px;background:var(--bs);border:1px solid ${i === 0 ? 'var(--ab)' : 'var(--bd)'};border-radius:var(--rd);margin-bottom:10px">
      <h4 style="font-size:14px;color:var(--ac);font-family:var(--sf);margin-bottom:4px">${i === 0 ? '&#x2713; ' : ''}${m.name}</h4>
      <p style="font-size:12px;color:var(--ts);font-family:var(--mf);line-height:1.5;margin-bottom:8px">${m.when}</p>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-bottom:8px"><b>Assumptions:</b> ${m.assumptions}</div>
      <div style="font-size:11px;color:var(--sg);font-family:var(--mf);margin-bottom:10px"><b>Marine example:</b> ${m.ex}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-bottom:3px">R code:</div>
          <pre style="padding:8px;background:var(--bi);border:1px solid var(--bd);border-radius:6px;font-size:11px;color:var(--sg);font-family:var(--mf);white-space:pre-wrap;line-height:1.5;margin:0">${m.r}</pre>
        </div>
        <div>
          <div style="font-size:10px;color:var(--tm);font-family:var(--mf);margin-bottom:3px">Python code:</div>
          <pre style="padding:8px;background:var(--bi);border:1px solid var(--bd);border-radius:6px;font-size:11px;color:var(--lv);font-family:var(--mf);white-space:pre-wrap;line-height:1.5;margin:0">${m.py}</pre>
        </div>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// 5. SAMPLE SIZE CALCULATOR
// ═══════════════════════════════════════════════════════════════

// Normal CDF (Abramowitz & Stegun)
function _rpPhi(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign=x<0?-1:1; x=Math.abs(x)/Math.SQRT2;
  const t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
// Inverse normal CDF (Abramowitz & Stegun 26.2.23)
function _rpZInv(prob) {
  if(prob<=0)return -Infinity;if(prob>=1)return Infinity;
  if(prob>0.5)return -_rpZInv(1-prob);
  const t=Math.sqrt(-2*Math.log(prob));
  return -(t-(2.515517+0.802853*t+0.010328*t*t)/(1+1.432788*t+0.189269*t*t+0.001308*t*t*t));
}

function _rpSampleSize() {
  const el=$('#rp-tool-content');
  if(!el)return;
  const _s='font-size:11px;color:var(--tm);font-family:var(--mf)';
  const _box='padding:14px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)';
  el.innerHTML=`
    <div style="${_box}">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:6px">Power-Based Sample Size Calculator</h4>
      <p style="${_s};line-height:1.5;margin-bottom:12px">Calculate the sample size needed to detect an effect with specified power and significance level.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        <button class="bt on" data-ss="ttest" onclick="_rpSSCalc('ttest')">t-test</button>
        <button class="bt sm" data-ss="anova" onclick="_rpSSCalc('anova')">ANOVA</button>
        <button class="bt sm" data-ss="chi2" onclick="_rpSSCalc('chi2')">Chi-square</button>
        <button class="bt sm" data-ss="corr" onclick="_rpSSCalc('corr')">Correlation</button>
        <button class="bt sm" data-ss="regression" onclick="_rpSSCalc('regression')">Regression</button>
      </div>
      <div id="rp-ss-form"></div>
    </div>
    <div id="rp-ss-result" style="margin-top:14px"></div>
    <div id="rp-ss-curve" style="margin-top:14px"></div>
  `;
  _rpSSCalc('ttest');
}

function _rpSSCalc(type) {
  $$('#rp-tool-content .bt[data-ss]').forEach(b=>b.classList.toggle('on',b.dataset.ss===type));
  const _s='font-size:11px;color:var(--tm);font-family:var(--mf)';
  const form=$('#rp-ss-form');
  if(!form)return;
  H('#rp-ss-result','');H('#rp-ss-curve','');
  const effectGuide={
    ttest:'<b>Cohen\'s d:</b> Small=0.2, Medium=0.5, Large=0.8. In marine ecology, d=0.3–0.5 is common for environmental comparisons.',
    anova:'<b>Cohen\'s f:</b> Small=0.10, Medium=0.25, Large=0.40. Derived from eta-squared: f = sqrt(eta2/(1-eta2)).',
    chi2:'<b>Cohen\'s w:</b> Small=0.10, Medium=0.30, Large=0.50. For 2x2 tables, w ≈ phi coefficient.',
    corr:'<b>Correlation r:</b> Small=0.10, Medium=0.30, Large=0.50. In ecology, r=0.2–0.4 is typical.',
    regression:'<b>R²:</b> Small=0.02, Medium=0.13, Large=0.26. f² = R²/(1-R²).'
  };
  if(type==='ttest'){
    form.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
      <label style="${_s}">Test type:<select class="fs" id="rp-ss-tt" style="width:100%;margin-top:2px">
        <option value="two">Two-sample independent</option><option value="one">One-sample</option><option value="paired">Paired</option></select></label>
      <label style="${_s}">Effect size (d): <span id="rp-ss-d-v" style="color:var(--ac)">0.50</span>
        <input type="range" id="rp-ss-d" min="0.1" max="2.0" step="0.05" value="0.50" oninput="$('#rp-ss-d-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
      <label style="${_s}">Alpha (α):<select class="fs" id="rp-ss-alpha" style="width:100%;margin-top:2px">
        <option value="0.001">0.001</option><option value="0.01">0.01</option><option value="0.05" selected>0.05</option><option value="0.10">0.10</option></select></label>
      <label style="${_s}">Power (1-β): <span id="rp-ss-pow-v" style="color:var(--ac)">0.80</span>
        <input type="range" id="rp-ss-pow" min="0.50" max="0.99" step="0.01" value="0.80" oninput="$('#rp-ss-pow-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
    </div>
    <div style="margin-top:8px;${_s};line-height:1.5">${effectGuide.ttest}</div>
    <button class="bt on" onclick="_rpCalcSS('ttest')" style="margin-top:10px">Calculate</button>`;
  } else if(type==='anova'){
    form.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
      <label style="${_s}">Number of groups (k):<input type="number" class="si" id="rp-ss-k" value="3" min="2" max="20" style="width:100%;margin-top:2px"></label>
      <label style="${_s}">Effect size (f): <span id="rp-ss-f-v" style="color:var(--ac)">0.25</span>
        <input type="range" id="rp-ss-f" min="0.05" max="1.0" step="0.05" value="0.25" oninput="$('#rp-ss-f-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
      <label style="${_s}">Alpha:<select class="fs" id="rp-ss-alpha" style="width:100%;margin-top:2px"><option value="0.01">0.01</option><option value="0.05" selected>0.05</option></select></label>
      <label style="${_s}">Power: <span id="rp-ss-pow-v" style="color:var(--ac)">0.80</span>
        <input type="range" id="rp-ss-pow" min="0.50" max="0.99" step="0.01" value="0.80" oninput="$('#rp-ss-pow-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
    </div>
    <div style="margin-top:8px;${_s};line-height:1.5">${effectGuide.anova}</div>
    <button class="bt on" onclick="_rpCalcSS('anova')" style="margin-top:10px">Calculate</button>`;
  } else if(type==='chi2'){
    form.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
      <label style="${_s}">Degrees of freedom (df):<input type="number" class="si" id="rp-ss-df" value="1" min="1" max="100" style="width:100%;margin-top:2px"></label>
      <label style="${_s}">Effect size (w): <span id="rp-ss-w-v" style="color:var(--ac)">0.30</span>
        <input type="range" id="rp-ss-w" min="0.05" max="1.0" step="0.05" value="0.30" oninput="$('#rp-ss-w-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
      <label style="${_s}">Alpha:<select class="fs" id="rp-ss-alpha" style="width:100%;margin-top:2px"><option value="0.01">0.01</option><option value="0.05" selected>0.05</option></select></label>
      <label style="${_s}">Power: <span id="rp-ss-pow-v" style="color:var(--ac)">0.80</span>
        <input type="range" id="rp-ss-pow" min="0.50" max="0.99" step="0.01" value="0.80" oninput="$('#rp-ss-pow-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
    </div>
    <div style="margin-top:8px;${_s};line-height:1.5">${effectGuide.chi2}</div>
    <button class="bt on" onclick="_rpCalcSS('chi2')" style="margin-top:10px">Calculate</button>`;
  } else if(type==='corr'){
    form.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
      <label style="${_s}">Expected correlation (r): <span id="rp-ss-r-v" style="color:var(--ac)">0.30</span>
        <input type="range" id="rp-ss-r" min="0.05" max="0.95" step="0.05" value="0.30" oninput="$('#rp-ss-r-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
      <label style="${_s}">Alpha:<select class="fs" id="rp-ss-alpha" style="width:100%;margin-top:2px"><option value="0.01">0.01</option><option value="0.05" selected>0.05</option></select></label>
      <label style="${_s}">Power: <span id="rp-ss-pow-v" style="color:var(--ac)">0.80</span>
        <input type="range" id="rp-ss-pow" min="0.50" max="0.99" step="0.01" value="0.80" oninput="$('#rp-ss-pow-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
    </div>
    <div style="margin-top:8px;${_s};line-height:1.5">${effectGuide.corr}</div>
    <button class="bt on" onclick="_rpCalcSS('corr')" style="margin-top:10px">Calculate</button>`;
  } else if(type==='regression'){
    form.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:540px">
      <label style="${_s}">Number of predictors:<input type="number" class="si" id="rp-ss-p" value="3" min="1" max="50" style="width:100%;margin-top:2px"></label>
      <label style="${_s}">Expected R²: <span id="rp-ss-r2-v" style="color:var(--ac)">0.13</span>
        <input type="range" id="rp-ss-r2" min="0.02" max="0.80" step="0.01" value="0.13" oninput="$('#rp-ss-r2-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
      <label style="${_s}">Alpha:<select class="fs" id="rp-ss-alpha" style="width:100%;margin-top:2px"><option value="0.01">0.01</option><option value="0.05" selected>0.05</option></select></label>
      <label style="${_s}">Power: <span id="rp-ss-pow-v" style="color:var(--ac)">0.80</span>
        <input type="range" id="rp-ss-pow" min="0.50" max="0.99" step="0.01" value="0.80" oninput="$('#rp-ss-pow-v').textContent=parseFloat(this.value).toFixed(2)" style="width:100%;accent-color:var(--ac)"></label>
    </div>
    <div style="margin-top:8px;${_s};line-height:1.5">${effectGuide.regression}</div>
    <button class="bt on" onclick="_rpCalcSS('regression')" style="margin-top:10px">Calculate</button>`;
  }
}

function _rpCalcSS(type) {
  const alpha=parseFloat($('#rp-ss-alpha')?.value||'0.05');
  const power=parseFloat($('#rp-ss-pow')?.value||'0.80');
  const za=_rpZInv(1-alpha/2);
  const zb=_rpZInv(power);
  let n=0,formula='',perGroup='';

  if(type==='ttest'){
    const d=parseFloat($('#rp-ss-d')?.value||'0.50');
    const tt=$('#rp-ss-tt')?.value||'two';
    if(tt==='two'){
      n=Math.ceil(2*Math.pow((za+zb)/d,2));
      perGroup=`${n} per group (${n*2} total)`;
      formula=`n = 2 × ((z<sub>α/2</sub> + z<sub>β</sub>) / d)² = 2 × ((${za.toFixed(3)} + ${zb.toFixed(3)}) / ${d})² = ${n}`;
    } else {
      n=Math.ceil(Math.pow((za+zb)/d,2));
      perGroup=`${n} total`;
      formula=`n = ((z<sub>α/2</sub> + z<sub>β</sub>) / d)² = ((${za.toFixed(3)} + ${zb.toFixed(3)}) / ${d})² = ${n}`;
    }
  } else if(type==='anova'){
    const f=parseFloat($('#rp-ss-f')?.value||'0.25');
    const k=parseInt($('#rp-ss-k')?.value||'3');
    // Approximation: n per group ≈ ((za + zb)² × (1 + 1/(k-1))) / (f²)  / k * correction
    n=Math.ceil(Math.pow((za+zb)/f,2));
    perGroup=`${n} per group (${n*k} total for ${k} groups)`;
    formula=`n/group ≈ ((z<sub>α/2</sub> + z<sub>β</sub>) / f)² = ((${za.toFixed(3)} + ${zb.toFixed(3)}) / ${f})² = ${n}`;
  } else if(type==='chi2'){
    const w=parseFloat($('#rp-ss-w')?.value||'0.30');
    n=Math.ceil(Math.pow((za+zb)/w,2));
    perGroup=`${n} total`;
    formula=`n = ((z<sub>α/2</sub> + z<sub>β</sub>) / w)² = ((${za.toFixed(3)} + ${zb.toFixed(3)}) / ${w})² = ${n}`;
  } else if(type==='corr'){
    const r=parseFloat($('#rp-ss-r')?.value||'0.30');
    const zr=0.5*Math.log((1+r)/(1-r)); // Fisher z-transform
    n=Math.ceil(Math.pow((za+zb)/zr,2)+3);
    perGroup=`${n} total (pairs of observations)`;
    formula=`n = ((z<sub>α/2</sub> + z<sub>β</sub>) / arctanh(r))² + 3 = ((${za.toFixed(3)} + ${zb.toFixed(3)}) / ${zr.toFixed(3)})² + 3 = ${n}`;
  } else if(type==='regression'){
    const p=parseInt($('#rp-ss-p')?.value||'3');
    const r2=parseFloat($('#rp-ss-r2')?.value||'0.13');
    const f2=r2/(1-r2);
    n=Math.ceil(Math.pow((za+zb),2)/f2+p+1);
    perGroup=`${n} total (with ${p} predictors)`;
    formula=`n = (z<sub>α/2</sub> + z<sub>β</sub>)² / f² + p + 1 = (${za.toFixed(3)} + ${zb.toFixed(3)})² / ${f2.toFixed(3)} + ${p} + 1 = ${n}`;
  }

  const resEl=$('#rp-ss-result');
  if(resEl){
    resEl.innerHTML=`<div style="padding:14px;background:var(--bs);border:1px solid var(--ab);border-radius:var(--rd)">
      <div style="font-size:20px;color:var(--ac);font-weight:700;font-family:var(--sf);margin-bottom:4px">n = ${n}</div>
      <div style="font-size:13px;color:var(--ts);font-family:var(--mf);margin-bottom:8px">${perGroup}</div>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);line-height:1.6"><b>Formula:</b> ${formula}</div>
      <div style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-top:6px"><b>Parameters:</b> α = ${alpha}, power = ${power}, z<sub>α/2</sub> = ${za.toFixed(3)}, z<sub>β</sub> = ${zb.toFixed(3)}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="bt sm" onclick="_rpExportSS(${n},'${type}')">Export</button>
      </div>
    </div>`;
  }

  // Power curve
  _rpDrawPowerCurve(type, alpha);
}

function _rpDrawPowerCurve(type, alpha) {
  const curveEl=$('#rp-ss-curve');
  if(!curveEl||typeof Plotly==='undefined')return;
  const za=_rpZInv(1-alpha/2);
  // Generate curves for 3 effect sizes
  let effectSizes=[],effectLabel='';
  if(type==='ttest'){
    effectSizes=[{v:0.2,l:'d=0.2 (small)'},{v:0.5,l:'d=0.5 (medium)'},{v:0.8,l:'d=0.8 (large)'}];
    effectLabel='Cohen\'s d';
  } else if(type==='anova'){
    effectSizes=[{v:0.1,l:'f=0.10'},{v:0.25,l:'f=0.25'},{v:0.4,l:'f=0.40'}];
    effectLabel='Cohen\'s f';
  } else if(type==='chi2'){
    effectSizes=[{v:0.1,l:'w=0.10'},{v:0.3,l:'w=0.30'},{v:0.5,l:'w=0.50'}];
    effectLabel='Cohen\'s w';
  } else if(type==='corr'){
    effectSizes=[{v:0.1,l:'r=0.10'},{v:0.3,l:'r=0.30'},{v:0.5,l:'r=0.50'}];
    effectLabel='Correlation r';
  } else if(type==='regression'){
    effectSizes=[{v:0.02,l:'R²=0.02'},{v:0.13,l:'R²=0.13'},{v:0.26,l:'R²=0.26'}];
    effectLabel='R²';
  }
  const traces=effectSizes.map(es=>{
    const ns=[];const powers=[];
    for(let n=5;n<=500;n+=5){
      ns.push(n);
      let pw;
      if(type==='ttest'){
        const ncp=es.v*Math.sqrt(n/2);
        pw=1-_rpPhi(za-ncp);
      } else if(type==='anova'||type==='chi2'){
        const ncp=es.v*Math.sqrt(n);
        pw=1-_rpPhi(za-ncp);
      } else if(type==='corr'){
        const zr=0.5*Math.log((1+es.v)/(1-es.v));
        const ncp=zr*Math.sqrt(n-3);
        pw=1-_rpPhi(za-ncp);
      } else if(type==='regression'){
        const f2=es.v/(1-es.v);
        const ncp=Math.sqrt(f2*n);
        pw=1-_rpPhi(za-ncp);
      }
      powers.push(Math.min(1,Math.max(0,pw)));
    }
    return{x:ns,y:powers,name:es.l,type:'scatter',mode:'lines',line:{width:2}};
  });
  // Add 0.80 power reference line
  traces.push({x:[5,500],y:[0.8,0.8],name:'80% power',type:'scatter',mode:'lines',line:{dash:'dash',color:'rgba(201,149,107,.4)',width:1},showlegend:false});
  const layout={
    paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    font:{family:'Inter, sans-serif',size:11,color:getComputedStyle(document.documentElement).getPropertyValue('--tm').trim()},
    margin:{t:30,r:20,b:50,l:50},height:300,
    xaxis:{title:'Sample size (n)',gridcolor:'rgba(201,149,107,.1)'},
    yaxis:{title:'Power',range:[0,1.05],gridcolor:'rgba(201,149,107,.1)'},
    legend:{orientation:'h',y:-0.2},
    title:{text:'Power Curve',font:{size:12}}
  };
  Plotly.newPlot(curveEl,traces,layout,{responsive:true,displayModeBar:false});
}

function _rpExportSS(n, type) {
  const alpha=$('#rp-ss-alpha')?.value||'0.05';
  const power=$('#rp-ss-pow')?.value||'0.80';
  let txt=`Meridian Sample Size Calculation\n${'='.repeat(40)}\nTest: ${type}\nRequired n: ${n}\nAlpha: ${alpha}\nPower: ${power}\n`;
  if(type==='ttest')txt+=`Effect size (d): ${$('#rp-ss-d')?.value}\nTest type: ${$('#rp-ss-tt')?.value}\n`;
  else if(type==='anova')txt+=`Effect size (f): ${$('#rp-ss-f')?.value}\nGroups: ${$('#rp-ss-k')?.value}\n`;
  else if(type==='chi2')txt+=`Effect size (w): ${$('#rp-ss-w')?.value}\ndf: ${$('#rp-ss-df')?.value}\n`;
  else if(type==='corr')txt+=`Correlation (r): ${$('#rp-ss-r')?.value}\n`;
  else if(type==='regression')txt+=`R²: ${$('#rp-ss-r2')?.value}\nPredictors: ${$('#rp-ss-p')?.value}\n`;
  txt+=`\nGenerated: ${new Date().toISOString().split('T')[0]}\nTool: Meridian Research Planning\n`;
  dl(txt,'meridian-sample-size.txt','text/plain');
  toast('Sample size calculation exported','ok');
}
