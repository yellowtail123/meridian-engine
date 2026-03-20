// ═══ MERIDIAN REPRO — Reproducibility Bundle Export (ZIP) ═══

async function exportReproZipBundle() {
  if (typeof JSZip === 'undefined') { toast('JSZip not loaded — cannot create ZIP bundle', 'err'); return; }

  // Show progress modal
  const overlay = document.createElement('div');
  overlay.className = 'meridian-modal-overlay';
  overlay.id = 'repro-progress';
  overlay.innerHTML = `<div class="meridian-modal" style="max-width:420px;text-align:center" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:12px">Building Reproducibility Bundle</h3>
    <div id="repro-steps" style="text-align:left;font-size:12px;color:var(--ts);font-family:var(--mf);line-height:2"></div>
    <div style="margin-top:12px">${mkL()}</div>
  </div>`;
  document.body.appendChild(overlay);

  const stepEl = $('#repro-steps');
  function step(msg) { if (stepEl) stepEl.innerHTML += `<div>✓ ${msg}</div>`; }

  const zip = new JSZip();

  try {
    // ── 1. Session state ──
    step('Reading session state…');
    const sessionCtx = typeof buildSessionSummary === 'function' ? await buildSessionSummary() : '';

    const sessionLog = {
      exportedAt: new Date().toISOString(),
      meridianVersion: '1.0',
      activeProject: S.activeProject || 'Default',
      literatureSearches: [],
      environmentalFetches: [],
      speciesLookups: [],
      fieldDatasets: [],
      gapAnalysisRuns: []
    };

    // Literature search history
    const searchHist = safeParse('meridian_search_hist', []);
    sessionLog.literatureSearches = searchHist.map(q => ({
      query: q, databases: ['OpenAlex', 'Semantic Scholar', 'CrossRef', 'PubMed'],
      timestamp: null, resultCount: null
    }));

    // Environmental fetches
    Object.entries(S.envProvenance || {}).forEach(([id, p]) => {
      sessionLog.environmentalFetches.push({
        location: { lat: p.coordsUsed?.lat, lon: p.coordsUsed?.lon },
        variables: [p.variable || id],
        dateRange: { start: p.dateRange?.from, end: p.dateRange?.to },
        source: p.source || 'unknown',
        endpoint: p.server || '',
        retrievedAt: p.fetchedAt || '',
        citationHint: p.dataset ? `${p.server} dataset ${p.dataset}` : ''
      });
    });

    // Species
    try {
      const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null');
      if (sp) sessionLog.speciesLookups.push({
        sciName: sp.sciName, sources: ['WoRMS', 'GBIF', 'OBIS'].filter(s => sp[s.toLowerCase()] || sp[s.toLowerCase() + 'Occ']?.length),
        gbifOccurrences: sp.gbifOcc?.length || 0, obisOccurrences: sp.obisOcc?.length || 0
      });
    } catch {}

    // Field datasets
    const fieldDs = safeParse('meridian_field_datasets', []);
    sessionLog.fieldDatasets = fieldDs.map(ds => ({
      name: ds.name, records: ds.rows?.length || 0, columns: ds.columns || [],
      uploadedAt: ds.uploadedAt
    }));

    // Gap analysis
    if (window._gapData?.length) {
      sessionLog.gapAnalysisRuns.push({
        gapsFound: window._gapData.length,
        topGaps: window._gapData.slice(0, 5).map(g => g.title || 'Untitled')
      });
    }

    zip.file('session-log.json', JSON.stringify(sessionLog, null, 2));

    // ── 2. Library exports ──
    step('Exporting library…');
    if (S.lib?.length) {
      // BibTeX
      const bibtex = S.lib.map(p => {
        const key = (p.authors?.[0]?.split(/\s+/).pop() || 'anon') + (p.year || 'nd');
        return `@article{${key},
  title = {${(p.title || '').replace(/[{}]/g, '')}},
  author = {${(p.authors || []).join(' and ')}},
  year = {${p.year || ''}},
  journal = {${p.journal || ''}},
  doi = {${p.doi || ''}}
}`;
      }).join('\n\n');
      zip.file('library.bib', bibtex);

      // RIS
      const ris = S.lib.map(p => {
        const lines = ['TY  - JOUR'];
        if (p.title) lines.push('TI  - ' + p.title);
        (p.authors || []).forEach(a => lines.push('AU  - ' + a));
        if (p.year) lines.push('PY  - ' + p.year);
        if (p.journal) lines.push('JO  - ' + p.journal);
        if (p.doi) lines.push('DO  - ' + p.doi);
        if (p.abstract) lines.push('AB  - ' + p.abstract);
        lines.push('ER  - ');
        return lines.join('\n');
      }).join('\n\n');
      zip.file('library.ris', ris);
    }

    // ── 3. Figures ──
    step('Generating figures…');
    const figFolder = zip.folder('figures');
    const plotEls = document.querySelectorAll('.js-plotly-plot');
    let figNum = 1;
    for (const el of plotEls) {
      try {
        const svg = await Plotly.toImage(el, { format: 'svg', width: 1200, height: 600 });
        const svgData = svg.replace(/^data:image\/svg\+xml;base64,/, '');
        figFolder.file(`figure-${String(figNum).padStart(2, '0')}.svg`, atob(svgData));
        figNum++;
      } catch {}
    }

    // ── 4. Data provenance ──
    step('Building provenance table…');
    const provEntries = Object.entries(S.envProvenance || {});
    if (provEntries.length) {
      const provMd = ['| Source | Dataset | Parameters | Retrieved | Citation |',
        '|--------|---------|------------|-----------|----------|',
        ...provEntries.map(([id, p]) =>
          `| ${p.source || p.server || 'N/A'} | ${p.dataset || 'N/A'} | lat=${p.coordsUsed?.lat || '?'} lon=${p.coordsUsed?.lon || '?'} ${p.dateRange?.from || '?'}–${p.dateRange?.to || '?'} | ${p.fetchedAt || '?'} | ${p.server || ''} dataset ${p.dataset || ''} |`
        )].join('\n');
      zip.file('data-provenance.md', provMd);
    }

    // ── 5. Field data CSVs ──
    if (fieldDs.length) {
      const fdFolder = zip.folder('field-data');
      fieldDs.forEach(ds => {
        if (!ds.rows?.length) return;
        const cols = ds.columns || Object.keys(ds.rows[0]);
        const csv = [cols.join(','), ...ds.rows.map(r => cols.map(c => {
          const v = String(r[c] ?? '');
          return v.includes(',') ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(','))].join('\n');
        fdFolder.file((ds.name || 'dataset') + '.csv', csv);
      });
    }

    // ── 6. Methods draft ──
    step('Drafting methods section…');
    let methodsDraft = '';
    if (S.apiK && sessionCtx) {
      try {
        const methodsPrompt = `You are helping a marine researcher write a methods section for a scientific paper.
Based on their Meridian session, draft a concise Methods section covering:
1. Literature search strategy (databases, search terms, inclusion criteria if gap analysis was run)
2. Environmental data acquisition (sources, variables, spatial/temporal coverage, data citations)
3. Species occurrence data (databases, taxa, geographic extent, any QA/QC applied)
4. Field data collection (if applicable, based on uploaded datasets)
5. Statistical analyses performed (if Workshop was used)

Use passive voice, past tense, and standard scientific writing conventions.
Be specific: use actual values from the session (coordinates, date ranges, variable names).
Format as a Methods section with sub-headings. Approx 400–600 words.

SESSION DATA:
${sessionCtx}`;
        const resp = await callAI({ messages: [{ role: 'user', content: methodsPrompt }], maxTokens: 2000 });
        methodsDraft = resp.content?.find(b => b.type === 'text')?.text || '';
      } catch (e) {
        methodsDraft = '# Methods\n\n*AI methods draft could not be generated: ' + e.message + '*\n\n[Replace this with your methods section]';
      }
    } else {
      methodsDraft = `# Methods

## Literature Search
Literature was searched across [databases] using the query "[query]".
Results were filtered by [criteria] and managed in the Meridian platform.

## Environmental Data
Environmental data were obtained from [source] for coordinates [lat, lon]
covering the period [start] to [end]. Variables included [list variables].

## Species Occurrence
Species occurrence records for [species] were retrieved from [GBIF/OBIS/WoRMS].

## Statistical Analysis
[Describe analyses performed]

*This is a template — replace bracketed values with your actual parameters.*`;
    }
    zip.file('methods-draft.md', methodsDraft);

    // ── 7. README ──
    step('Building archive…');
    const readme = `# Meridian Reproducibility Bundle

**Exported:** ${new Date().toISOString()}
**Platform:** Meridian Marine Research Platform (https://meridian-engine.com)

## Contents

- \`session-log.json\` — Complete session state (searches, fetches, analyses)
- \`library.bib\` — BibTeX export of saved papers
- \`library.ris\` — RIS export of saved papers
- \`methods-draft.md\` — AI-generated draft methods section
- \`data-provenance.md\` — Data source citations and retrieval metadata
- \`figures/\` — Exported charts (SVG)
- \`field-data/\` — Uploaded field datasets (CSV)

## How to Use

1. Open \`session-log.json\` to review the complete analysis pipeline
2. Import \`library.bib\` into your reference manager (Zotero, Mendeley, etc.)
3. Edit \`methods-draft.md\` for your manuscript
4. Reference \`data-provenance.md\` for proper data citations
`;
    zip.file('README.md', readme);

    // ── Generate and download ──
    step('Done!');
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meridian-bundle-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Reproducibility bundle downloaded', 'ok');

  } catch (e) {
    toast('Bundle export failed: ' + e.message, 'err');
    console.error('Repro bundle error:', e);
  }

  // Remove progress modal
  setTimeout(() => { overlay.remove(); }, 1500);
}
