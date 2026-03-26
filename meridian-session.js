// ═══ MERIDIAN SESSION — Context Injection Module ═══
// Builds structured session summaries for AI context awareness

async function buildSessionSummary() {
  const sections = [];

  // ── LIBRARY ──
  try {
    if (S.lib && S.lib.length) {
      const concepts = {};
      let minYear = Infinity, maxYear = -Infinity;
      const titles = [];
      S.lib.forEach(p => {
        if (p.year) { minYear = Math.min(minYear, p.year); maxYear = Math.max(maxYear, p.year); }
        if (titles.length < 3 && p.title) titles.push(p.title.slice(0, 80));
        (p.concepts || []).forEach(c => { concepts[c] = (concepts[c] || 0) + 1; });
      });
      const topConcepts = Object.entries(concepts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
      let s = `LIBRARY\n- ${S.lib.length} papers saved`;
      if (topConcepts.length) s += `\n- Top concepts: ${topConcepts.join(', ')}`;
      if (minYear < Infinity) s += `\n- Date range: ${minYear} – ${maxYear}`;
      if (titles.length) s += `\n- Example titles: ${titles.join('; ')}`;
      sections.push(s);
    }
  } catch (e) { console.warn('Session: library error', e); }

  // ── ACTIVE PROJECT ──
  try {
    if(typeof MeridianProjects!=='undefined'&&MeridianProjects.active){
      const p=MeridianProjects.active;
      let s=`ACTIVE PROJECT\n- Name: ${p.name}`;
      if(p.description)s+=`\n- Description: ${p.description}`;
      const sp=MeridianProjects.focusSpecies;
      if(sp&&sp.length)s+=`\n- Focus species: ${sp.map(x=>x.scientific_name).join(', ')}`;
      sections.push(s);
    }else{
      const proj = S.activeProject || safeParse('meridian_active_project', 'Default') || 'Default';
      sections.push(`ACTIVE PROJECT\n- Name: ${proj}`);
    }
  } catch (e) {}

  // ── LITERATURE SEARCHES ──
  try {
    const hist = safeParse('meridian_search_hist', []);
    if (hist.length) {
      const lastQ = hist[0];
      const engines = ['OpenAlex', 'Semantic Scholar', 'CrossRef', 'PubMed'];
      let s = `LITERATURE SEARCHES (recent)\n- Last search query: "${lastQ}"`;
      s += `\n- Databases searched: ${engines.join(', ')}`;
      if (_litAllResults && _litAllResults.length) s += `\n- Results found: ${_litAllResults.length}`;
      sections.push(s);
    }
  } catch (e) {}

  // ── ENVIRONMENTAL DATA ──
  try {
    const lat = $('#elat')?.value, lon = $('#elon')?.value;
    const envKeys = Object.keys(S.envR || {});
    if (envKeys.length && lat && lon) {
      const df = $('#edf')?.value, dt = $('#edt')?.value;
      const vars = envKeys.map(id => S.envR[id]?.nm || id);
      const sources = new Set();
      Object.values(S.envProvenance || {}).forEach(p => { if (p.source) sources.add(p.source); });
      let s = `ENVIRONMENTAL DATA (last fetch)\n- Location: ${lat}, ${lon}`;
      s += `\n- Variables fetched: ${vars.join(', ')}`;
      if (df && dt) s += `\n- Date range: ${df} to ${dt}`;
      if (sources.size) s += `\n- Source: ${[...sources].join(', ')}`;
      sections.push(s);
    }
  } catch (e) {}

  // ── SPECIES ──
  try {
    const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null');
    if (sp && sp.sciName) {
      const dataSources = [];
      if (sp.worms) dataSources.push('WoRMS');
      if (sp.gbifOcc?.length) dataSources.push('GBIF');
      if (sp.obisOcc?.length) dataSources.push('OBIS');
      let s = `SPECIES (last lookup)\n- Species: ${sp.sciName}`;
      if (dataSources.length) s += `\n- Data sources: ${dataSources.join(', ')}`;
      const occCount = (sp.gbifOcc?.length || 0) + (sp.obisOcc?.length || 0);
      if (occCount) s += `\n- Occurrence records: ${occCount}`;
      sections.push(s);
    }
  } catch (e) {}

  // ── GAP ANALYSIS ──
  try {
    const gaps = window._gapData;
    if (gaps && gaps.length) {
      let s = `GAP ANALYSIS (last run)\n- Gaps identified: ${gaps.length}`;
      if (gaps[0]?.title) s += `\n- Top gap: ${gaps[0].title}`;
      sections.push(s);
    }
  } catch (e) {}

  // ── FIELD DATA ──
  try {
    const datasets = safeParse('meridian_field_datasets', []);
    if (datasets.length) {
      const ds = datasets[datasets.length - 1];
      let s = `FIELD DATA (uploaded)\n- Dataset name: ${ds.name || 'Unnamed'}`;
      s += `\n- Records: ${ds.rows?.length || 0}`;
      if (ds.columns?.length) s += `\n- Variables: ${ds.columns.join(', ')}`;
      sections.push(s);
    }
  } catch (e) {}

  // ── ACTIVE MAP LAYERS ──
  try {
    if (_envMap && _mapLayers) {
      const active = Object.keys(_mapLayers).filter(id => _envMap.hasLayer(_mapLayers[id]));
      if (active.length) {
        sections.push(`ACTIVE MAP LAYERS\n- ${active.join(', ')}`);
      }
    }
  } catch (e) {}

  if (!sections.length) return '';
  return 'MERIDIAN SESSION CONTEXT\n========================\n\n' + sections.join('\n\n');
}

// ── One-line summary for the context indicator ──
function buildSessionOneLiner() {
  const parts = [];
  try { if (S.lib?.length) parts.push(S.lib.length + ' papers'); } catch {}
  try {
    const lat = $('#elat')?.value, lon = $('#elon')?.value;
    if (lat && lon && Object.keys(S.envR || {}).length) parts.push(`fetch ${lat}°N`);
  } catch {}
  try {
    const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null');
    if (sp?.sciName) parts.push(sp.sciName);
  } catch {}
  try {
    const gaps = window._gapData;
    if (gaps?.length) parts.push(gaps.length + ' gaps');
  } catch {}
  try {
    const ds = safeParse('meridian_field_datasets', []);
    if (ds.length) parts.push(ds.length + ' field dataset' + (ds.length > 1 ? 's' : ''));
  } catch {}
  return parts.length ? 'Session context: ' + parts.join(' · ') : 'Session context: no data yet';
}

// ── Refresh the AI context indicator ──
async function refreshAiCtxIndicator() {
  // Sync toggle checkbox state
  const tog = $('#ai-ctx-toggle');
  const tog2 = $('#ai-ctx-toggle-panel');
  if (tog && typeof _aiCtxOn !== 'undefined') tog.checked = _aiCtxOn;
  if (tog2 && typeof _aiCtxOn !== 'undefined') tog2.checked = _aiCtxOn;
  if (typeof _updateCtxProviderInfo === 'function') _updateCtxProviderInfo();
  if (typeof _updateSessionTokenDisplay === 'function') _updateSessionTokenDisplay();
  // Delegate to features.js _updateCtxIndicator if available
  if (typeof _updateCtxIndicator === 'function') { _updateCtxIndicator(); return; }
  // Fallback
  const detail = $('#ai-ctx-detail');
  if (!detail) return;
  const parts = [];
  const tab = document.querySelector('.sb-item.active')?.dataset?.tab;
  if (tab) parts.push('<div style="margin-bottom:6px"><strong style="color:var(--ac)">Tab:</strong> ' + tab + '</div>');
  if (S.lib.length) parts.push('<div><strong>Library:</strong> ' + S.lib.length + ' papers</div>');
  if (S.wsD.length) parts.push('<div><strong>Workshop:</strong> ' + S.wsD.length + ' rows, ' + S.wsC.length + ' cols</div>');
  const envKeys = Object.keys(S.envR);
  if (envKeys.length) parts.push('<div><strong>Env:</strong> ' + envKeys.length + ' variables loaded</div>');
  try { const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null'); if (sp) parts.push('<div><strong>Species:</strong> ' + sp.sciName + '</div>'); } catch {}
  detail.innerHTML = parts.length ? parts.join('') : '<div style="color:var(--tm)">No data loaded yet. Search literature, explore species, or fetch environmental data.</div>';
}
