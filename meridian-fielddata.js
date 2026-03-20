// ═══ MERIDIAN FIELD DATA — CSV/TSV Upload & Integration Module ═══

let _fdInitialized = false;

function initFieldData() {
  if (_fdInitialized && $('#fd-content')?.children.length) return;
  _fdInitialized = true;
  _renderFieldDataUI();
}

function _renderFieldDataUI() {
  const datasets = safeParse('meridian_field_datasets', []);
  H('#fd-content', `
    <div class="tip-wrap"><button class="tip-toggle" onclick="toggleTipPopover(this)" title="About this tab">i</button><div class="tip tip-pop"><b>Field Data.</b> Import your own CSV/TSV observational data. Map columns to standard roles, then visualize on the map or send to Workshop for analysis.<button class="dx" onclick="this.closest('.tip').style.display='none'">×</button></div></div>
    <div id="fd-upload" style="margin-bottom:16px">
      <div id="fd-dropzone" style="border:2px dashed var(--bd);border-radius:var(--rd);padding:30px;text-align:center;cursor:pointer;transition:border-color .2s;background:var(--bs)"
        ondragover="event.preventDefault();this.style.borderColor='var(--ac)'"
        ondragleave="this.style.borderColor='var(--bd)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--bd)';_fdHandleFiles(event.dataTransfer.files)"
        onclick="$('#fd-file-input').click()">
        <div style="font-size:14px;color:var(--ts);margin-bottom:6px">Drop CSV/TSV file here or click to browse</div>
        <div style="font-size:11px;color:var(--tm);font-family:var(--mf)">Supports .csv, .tsv, .txt — auto-detects delimiter</div>
        <input type="file" id="fd-file-input" accept=".csv,.tsv,.txt" style="display:none" onchange="_fdHandleFiles(this.files)"/>
      </div>
    </div>
    <div id="fd-mapping" style="display:none"></div>
    <div id="fd-datasets">${datasets.length ? _renderDatasetList(datasets) : ''}</div>
    <div id="fd-preview" style="display:none"></div>
  `);
}

function _fdHandleFiles(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = e => _fdParseFile(e.target.result, file.name);
  reader.readAsText(file);
}

function _fdParseFile(text, fileName) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return toast('File has no data rows', 'err');

  // Auto-detect delimiter
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  // Parse header
  const headers = _fdParseLine(firstLine, delimiter);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length && rows.length < 50000; i++) {
    const vals = _fdParseLine(lines[i], delimiter);
    if (vals.length === headers.length) {
      const row = {};
      headers.forEach((h, j) => {
        const v = vals[j];
        const num = parseFloat(v);
        row[h] = (!isNaN(num) && v.trim() !== '') ? num : v;
      });
      rows.push(row);
    }
  }

  if (!rows.length) return toast('No valid data rows found', 'err');
  if (lines.length - 1 > 50000) toast('Imported first 50,000 of ' + (lines.length - 1) + ' rows', 'warn');

  // Show column mapping
  window._fdPending = { fileName, headers, rows, delimiter };
  _renderColumnMapping(headers, rows);
}

function _fdParseLine(line, delim) {
  if (delim === ',') {
    // Handle CSV with quoted fields
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }
  return line.split(delim).map(s => s.trim());
}

const FD_ROLES = ['Latitude', 'Longitude', 'Date', 'Species name', 'Depth (m)', 'Temperature',
  'Salinity', 'pH', 'Abundance count', 'Biomass', 'Site/station ID', 'Ignore', 'Custom variable'];

function _autoDetectRole(col) {
  const lc = col.toLowerCase().replace(/[_\-\s]/g, '');
  if (/^(lat|latitude|y)$/i.test(lc)) return 'Latitude';
  if (/^(lon|lng|longitude|long|x)$/i.test(lc)) return 'Longitude';
  if (/^(date|datecollected|eventdate|datetime|samplingdate)$/i.test(lc)) return 'Date';
  if (/^(species|speciesname|scientificname|taxon|sciname)$/i.test(lc)) return 'Species name';
  if (/^(depth|depthm|depthmeter)$/i.test(lc)) return 'Depth (m)';
  if (/^(temp|temperature|tempc|sst|watertemp)$/i.test(lc)) return 'Temperature';
  if (/^(sal|salinity|psu)$/i.test(lc)) return 'Salinity';
  if (/^(ph)$/i.test(lc)) return 'pH';
  if (/^(count|abundance|n|number|individuals)$/i.test(lc)) return 'Abundance count';
  if (/^(biomass|weight|mass|biomassg)$/i.test(lc)) return 'Biomass';
  if (/^(site|station|stationid|siteid|sitename)$/i.test(lc)) return 'Site/station ID';
  return 'Custom variable';
}

function _renderColumnMapping(headers, rows) {
  const mapping = $('#fd-mapping');
  mapping.style.display = '';
  const rowsHtml = headers.map((h, i) => {
    const detected = _autoDetectRole(h);
    const opts = FD_ROLES.map(r => `<option value="${r}" ${r === detected ? 'selected' : ''}>${r}</option>`).join('');
    return `<tr><td style="font-family:var(--mf);font-size:12px;padding:6px 10px;color:var(--ts)">${escHTML(h)}</td><td style="padding:6px 10px"><select class="fs fd-role-sel" data-col="${escHTML(h)}" style="padding:6px;font-size:11px">${opts}</select></td></tr>`;
  }).join('');

  mapping.innerHTML = `
    <div style="margin-bottom:12px;padding:12px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Column Mapping — ${rows.length} rows detected</h4>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left;font-size:11px;color:var(--tm);font-family:var(--mf);padding:4px 10px">Column name</th><th style="text-align:left;font-size:11px;color:var(--tm);font-family:var(--mf);padding:4px 10px">Map to role</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div id="fd-map-error" style="display:none;color:var(--co);font-size:12px;font-family:var(--mf);margin-top:8px"></div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="bt on" onclick="_fdImport()">Import ${rows.length} records</button>
        <button class="bt sm" onclick="$('#fd-mapping').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

function _fdImport() {
  const pending = window._fdPending;
  if (!pending) return;

  // Read mapping
  const mapping = {};
  $$('.fd-role-sel').forEach(sel => { mapping[sel.dataset.col] = sel.value; });

  // Validate: must have lat & lon
  const latCol = Object.keys(mapping).find(k => mapping[k] === 'Latitude');
  const lonCol = Object.keys(mapping).find(k => mapping[k] === 'Longitude');
  if (!latCol || !lonCol) {
    const err = $('#fd-map-error');
    if (err) { err.textContent = 'Latitude and Longitude columns must be mapped.'; err.style.display = ''; }
    return;
  }

  const columns = Object.keys(mapping).filter(k => mapping[k] !== 'Ignore');
  const dataset = {
    id: 'fd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: pending.fileName.replace(/\.\w+$/, ''),
    uploadedAt: new Date().toISOString(),
    columns,
    mapping,
    rows: pending.rows
  };

  // Save to localStorage
  const datasets = safeParse('meridian_field_datasets', []);
  datasets.push(dataset);
  safeStore('meridian_field_datasets', datasets);

  // Clean up
  window._fdPending = null;
  $('#fd-mapping').style.display = 'none';
  toast(pending.rows.length + ' records imported', 'ok');
  _renderFieldDataUI();
  _renderPreview(dataset);
}

function _renderDatasetList(datasets) {
  if (!datasets.length) return '';
  return `<div style="margin-bottom:16px"><h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Imported Datasets</h4>
    ${datasets.map((ds, i) => `
      <div class="lib-card" style="padding:10px 14px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div>
            <span style="font-size:13px;color:var(--ts);cursor:pointer" onclick="_fdRenameDataset(${i})" title="Click to rename">${escHTML(ds.name)}</span>
            <span style="font-size:11px;color:var(--tm);font-family:var(--mf);margin-left:8px">${ds.rows?.length || 0} records · ${new Date(ds.uploadedAt).toLocaleDateString()}</span>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="bt sm" onclick="_fdPreviewDataset(${i})">Preview</button>
            <button class="bt sm on" onclick="_fdSendToWorkshop(${i})">Send to Workshop</button>
            <button class="bt sm" onclick="_fdShowOnMap(${i})">Show on Map</button>
            <button class="bt sm" onclick="_fdPrepSubmission(${i})">Submit to Repository</button>
            <button class="bt sm" style="color:var(--co)" onclick="_fdDeleteDataset(${i})">Delete</button>
          </div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function _fdRenameDataset(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[idx]; if (!ds) return;
  const name = prompt('Rename dataset:', ds.name);
  if (name && name.trim()) { ds.name = name.trim(); safeStore('meridian_field_datasets', datasets); _renderFieldDataUI(); }
}

function _fdDeleteDataset(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  if (!confirm('Delete "' + datasets[idx]?.name + '"?')) return;
  datasets.splice(idx, 1);
  safeStore('meridian_field_datasets', datasets);
  _renderFieldDataUI();
  toast('Dataset deleted', 'ok');
}

function _fdPreviewDataset(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  _renderPreview(datasets[idx]);
}

function _renderPreview(ds) {
  if (!ds || !ds.rows?.length) return;
  const preview = $('#fd-preview');
  preview.style.display = '';
  const cols = ds.columns || Object.keys(ds.rows[0]);
  const previewRows = ds.rows.slice(0, 20);
  preview.innerHTML = `
    <div style="margin-top:12px;padding:12px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
      <h4 style="font-size:12px;color:var(--ac);font-family:var(--mf);margin-bottom:8px">Preview: ${escHTML(ds.name)} (first ${previewRows.length} of ${ds.rows.length} rows)</h4>
      <div style="overflow-x:auto;max-height:350px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--mf)">
          <thead><tr>${cols.map(c => `<th style="text-align:left;padding:4px 8px;color:var(--tm);border-bottom:1px solid var(--bd);white-space:nowrap">${escHTML(c)}</th>`).join('')}</tr></thead>
          <tbody>${previewRows.map(r => `<tr>${cols.map(c => `<td style="padding:3px 8px;color:var(--ts);border-bottom:1px solid var(--bd);white-space:nowrap">${escHTML(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function _fdSendToWorkshop(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[idx]; if (!ds) return;
  const mapping = ds.mapping || {};
  // Build workshop columns using mapped role names where available
  const colMap = {};
  Object.keys(mapping).forEach(col => {
    const role = mapping[col];
    if (role !== 'Ignore') colMap[col] = role === 'Custom variable' ? col : role;
  });
  S.wsC = Object.values(colMap);
  S.wsD = ds.rows.map(r => {
    const row = {};
    Object.entries(colMap).forEach(([origCol, newCol]) => { row[newCol] = r[origCol]; });
    return row;
  });
  if (typeof autoTypes === 'function') autoTypes();
  if (typeof initWS === 'function') initWS();
  goTab('workshop');
  toast('Field data sent to Workshop', 'ok');
}

function _fdShowOnMap(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[idx]; if (!ds) return;
  const mapping = ds.mapping || {};
  const latCol = Object.keys(mapping).find(k => mapping[k] === 'Latitude');
  const lonCol = Object.keys(mapping).find(k => mapping[k] === 'Longitude');
  if (!latCol || !lonCol) return toast('No lat/lon columns mapped', 'err');

  // Switch to Env Data tab and ensure map is visible
  goTab('env');
  setTimeout(() => {
    if (!_envMap) { toast('Map not initialized', 'err'); return; }

    // Remove existing field data layer
    if (window._fieldDataLayer) { _envMap.removeLayer(window._fieldDataLayer); }

    const markers = [];
    const bounds = [];
    ds.rows.forEach(r => {
      const lat = parseFloat(r[latCol]), lon = parseFloat(r[lonCol]);
      if (isNaN(lat) || isNaN(lon)) return;
      bounds.push([lat, lon]);
      const popupParts = Object.keys(mapping)
        .filter(k => mapping[k] !== 'Ignore')
        .map(k => `<b>${escHTML(mapping[k])}:</b> ${escHTML(String(r[k] ?? ''))}`)
        .join('<br>');
      const marker = L.circleMarker([lat, lon], {
        radius: 5, color: '#fff', weight: 1, fillColor: '#C9956B', fillOpacity: 0.8
      }).bindPopup(`<div style="font-size:11px;line-height:1.5">${popupParts}</div>`);
      markers.push(marker);
    });

    window._fieldDataLayer = L.layerGroup(markers).addTo(_envMap);
    if (bounds.length) _envMap.fitBounds(bounds, { padding: [30, 30] });
    toast(markers.length + ' points plotted on map', 'ok');

    // Add toggle button if not already present
    if (!$('#ml-fielddata')) {
      const toolRow = $('.map-toolbar-row');
      if (toolRow) {
        const btn = document.createElement('button');
        btn.className = 'bt sm on';
        btn.id = 'ml-fielddata';
        btn.textContent = 'Field Data';
        btn.title = 'Toggle field data points';
        btn.onclick = () => {
          if (_envMap.hasLayer(window._fieldDataLayer)) {
            _envMap.removeLayer(window._fieldDataLayer);
            btn.classList.remove('on');
          } else {
            window._fieldDataLayer.addTo(_envMap);
            btn.classList.add('on');
          }
        };
        const layersGroup = toolRow.querySelector('.ctrl-group');
        if (layersGroup) layersGroup.appendChild(btn);
      }
    }
  }, 200);
}

// ═══ TASK 13 — Data Repository Submission Prep ═══

const DWC_TERM_MAP = {
  'Latitude': 'decimalLatitude',
  'Longitude': 'decimalLongitude',
  'Date': 'eventDate',
  'Species name': 'scientificName',
  'Depth (m)': 'minimumDepthInMeters',
  'Temperature': 'measurementValue',
  'Salinity': 'measurementValue',
  'pH': 'measurementValue',
  'Abundance count': 'individualCount',
  'Biomass': 'measurementValue',
  'Site/station ID': 'locationID'
};

const DWC_MEASURE_TYPE = {
  'Temperature': 'temperature',
  'Salinity': 'salinity',
  'pH': 'pH',
  'Biomass': 'biomass'
};

function _fdPrepSubmission(idx) {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[idx]; if (!ds) return;
  window._fdSubmitIdx = idx;
  window._fdSubmitRepo = 'obis';

  const preview = $('#fd-preview');
  preview.style.display = '';
  preview.innerHTML = `
    <div style="margin-top:12px;padding:16px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">
      <h4 style="font-size:13px;color:var(--ac);font-family:var(--mf);margin-bottom:12px">Repository Submission — ${escHTML(ds.name)}</h4>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <button class="bt sm on" id="repo-obis" onclick="_fdSetRepo('obis')">OBIS (Darwin Core)</button>
        <button class="bt sm" id="repo-pangaea" onclick="_fdSetRepo('pangaea')">PANGAEA</button>
        <button class="bt sm" id="repo-bcodmo" onclick="_fdSetRepo('bcodmo')">BCO-DMO</button>
      </div>
      <div id="fd-repo-panel"></div>
    </div>`;
  _fdRenderRepoPanel(ds);
}

function _fdSetRepo(repo) {
  window._fdSubmitRepo = repo;
  ['obis','pangaea','bcodmo'].forEach(r => {
    const btn = $('#repo-' + r);
    if (btn) btn.classList.toggle('on', r === repo);
  });
  const datasets = safeParse('meridian_field_datasets', []);
  _fdRenderRepoPanel(datasets[window._fdSubmitIdx]);
}

function _fdRenderRepoPanel(ds) {
  if (!ds) return;
  const panel = $('#fd-repo-panel');
  if (!panel) return;
  const repo = window._fdSubmitRepo;

  if (repo === 'obis') {
    panel.innerHTML = _renderDarwinCoreMapping(ds) + _fdDwcRequiredFields(ds) +
      `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="bt on" onclick="_fdRunValidation()">Validate</button>
        <button class="bt sm" onclick="_fdExportDarwinCore()">Export Darwin Core Archive</button>
      </div><div id="fd-validation-result"></div>`;
  } else if (repo === 'pangaea') {
    panel.innerHTML = `
      <div style="font-size:12px;color:var(--ts);font-family:var(--mf);margin-bottom:10px">
        PANGAEA uses a tab-separated format with structured header metadata. Fill in the required fields below.
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;max-width:500px;margin-bottom:12px">
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">Campaign:</label>
        <input class="si" id="pg-campaign" placeholder="e.g. Survey 2024" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">PI Name:</label>
        <input class="si" id="pg-pi" placeholder="Last, First" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">PI Email:</label>
        <input class="si" id="pg-email" placeholder="pi@institution.edu" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">Method:</label>
        <input class="si" id="pg-method" placeholder="e.g. CTD cast, trawl survey" style="font-size:11px"/>
      </div>
      <div style="display:flex;gap:8px">
        <button class="bt on" onclick="_fdExportPangaea()">Export PANGAEA Template</button>
      </div>`;
  } else {
    panel.innerHTML = `
      <div style="font-size:12px;color:var(--ts);font-family:var(--mf);margin-bottom:10px">
        BCO-DMO accepts CSV with metadata comment headers. Fill in dataset details below.
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;max-width:500px;margin-bottom:12px">
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">Project:</label>
        <input class="si" id="bco-project" placeholder="Project name" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">PI Name:</label>
        <input class="si" id="bco-pi" placeholder="Last, First" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">Funding:</label>
        <input class="si" id="bco-funding" placeholder="e.g. NSF OCE-1234567" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">Description:</label>
        <textarea class="si" id="bco-desc" rows="2" placeholder="Brief dataset description" style="font-size:11px"></textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="bt on" onclick="_fdExportBCODMO()">Export BCO-DMO Template</button>
      </div>`;
  }
}

function _renderDarwinCoreMapping(ds) {
  const mapping = ds.mapping || {};
  const cols = ds.columns || Object.keys(ds.rows[0] || {});
  const rows = cols.map(col => {
    const role = mapping[col] || 'Custom variable';
    const dwc = DWC_TERM_MAP[role] || '';
    const measureType = DWC_MEASURE_TYPE[role] || '';
    return `<tr>
      <td style="font-family:var(--mf);font-size:11px;padding:5px 8px;color:var(--ts)">${escHTML(col)}</td>
      <td style="font-size:11px;padding:5px 8px;color:var(--tm)">${escHTML(role)}</td>
      <td style="padding:5px 8px"><input class="si dwc-term" data-col="${escHTML(col)}" data-measure="${measureType}" value="${escHTML(dwc)}" style="font-size:11px;font-family:var(--mf);width:100%" placeholder="DwC term"/></td>
    </tr>`;
  }).join('');

  return `
    <div style="margin-bottom:12px">
      <h5 style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Darwin Core Column Mapping</h5>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:10px;color:var(--tm);font-family:var(--mf);padding:4px 8px;border-bottom:1px solid var(--bd)">Original</th>
            <th style="text-align:left;font-size:10px;color:var(--tm);font-family:var(--mf);padding:4px 8px;border-bottom:1px solid var(--bd)">Role</th>
            <th style="text-align:left;font-size:10px;color:var(--tm);font-family:var(--mf);padding:4px 8px;border-bottom:1px solid var(--bd)">DwC Term</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _fdDwcRequiredFields(ds) {
  return `
    <div style="margin-bottom:12px">
      <h5 style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Required Metadata</h5>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;max-width:500px">
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">basisOfRecord:</label>
        <select class="fs" id="dwc-basis" style="font-size:11px;padding:4px">
          <option value="HumanObservation">HumanObservation</option>
          <option value="MachineObservation">MachineObservation</option>
          <option value="MaterialSample">MaterialSample</option>
          <option value="PreservedSpecimen">PreservedSpecimen</option>
          <option value="Occurrence">Occurrence</option>
        </select>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">institutionCode:</label>
        <input class="si" id="dwc-inst" placeholder="e.g. AIMS, NOAA, MBARI" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">datasetName:</label>
        <input class="si" id="dwc-dsname" value="${escHTML(ds.name || '')}" style="font-size:11px"/>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);align-self:center">License:</label>
        <select class="fs" id="dwc-license" style="font-size:11px;padding:4px">
          <option value="CC0">CC0 (Public Domain)</option>
          <option value="CC-BY" selected>CC-BY 4.0</option>
          <option value="CC-BY-NC">CC-BY-NC 4.0</option>
        </select>
      </div>
    </div>`;
}

function _fdReadDwcMapping() {
  const mapping = {};
  const measures = {};
  $$('.dwc-term').forEach(inp => {
    const col = inp.dataset.col;
    const term = inp.value.trim();
    if (term) {
      mapping[col] = term;
      if (inp.dataset.measure) measures[col] = inp.dataset.measure;
    }
  });
  return { mapping, measures };
}

function _fdRunValidation() {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[window._fdSubmitIdx]; if (!ds) return;
  const { mapping, measures } = _fdReadDwcMapping();
  const meta = {
    basis: $('#dwc-basis')?.value || '',
    inst: $('#dwc-inst')?.value?.trim() || '',
    dsname: $('#dwc-dsname')?.value?.trim() || '',
    license: $('#dwc-license')?.value || ''
  };
  const result = _validateSubmission(ds, mapping, measures, meta);
  const el = $('#fd-validation-result');
  if (el) el.innerHTML = _renderValidationChecklist(result);
}

function _validateSubmission(ds, mapping, measures, meta) {
  const errors = [], warnings = [], passes = [];
  const terms = Object.values(mapping);

  // Required DwC fields
  if (terms.includes('decimalLatitude')) passes.push('decimalLatitude mapped');
  else errors.push('decimalLatitude is required — map a Latitude column');

  if (terms.includes('decimalLongitude')) passes.push('decimalLongitude mapped');
  else errors.push('decimalLongitude is required — map a Longitude column');

  if (terms.includes('eventDate')) passes.push('eventDate mapped');
  else warnings.push('eventDate recommended — temporal coverage improves discoverability');

  if (terms.includes('scientificName')) passes.push('scientificName mapped');
  else warnings.push('scientificName recommended for biological datasets');

  // Metadata
  if (meta.basis) passes.push('basisOfRecord: ' + meta.basis);
  else errors.push('basisOfRecord is required');

  if (meta.inst) passes.push('institutionCode provided');
  else warnings.push('institutionCode recommended');

  if (meta.dsname) passes.push('datasetName provided');
  else errors.push('datasetName is required');

  if (meta.license) passes.push('License: ' + meta.license);
  else warnings.push('License should be specified (CC0 or CC-BY recommended for OBIS)');

  // Data quality checks
  const rows = ds.rows || [];
  const latCol = Object.keys(mapping).find(k => mapping[k] === 'decimalLatitude');
  const lonCol = Object.keys(mapping).find(k => mapping[k] === 'decimalLongitude');

  if (latCol && lonCol) {
    let outOfRange = 0;
    rows.forEach(r => {
      const lat = parseFloat(r[latCol]), lon = parseFloat(r[lonCol]);
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) outOfRange++;
    });
    if (outOfRange === 0) passes.push('All coordinates within valid range');
    else errors.push(outOfRange + ' rows have coordinates outside valid range (-90/90, -180/180)');
  }

  const dateCol = Object.keys(mapping).find(k => mapping[k] === 'eventDate');
  if (dateCol) {
    let badDates = 0;
    rows.forEach(r => { if (r[dateCol] && isNaN(Date.parse(String(r[dateCol])))) badDates++; });
    if (badDates === 0) passes.push('All dates parseable');
    else warnings.push(badDates + ' rows have unparseable dates — use ISO 8601 (YYYY-MM-DD)');
  }

  if (rows.length >= 10) passes.push(rows.length + ' records — sufficient volume');
  else warnings.push('Only ' + rows.length + ' records — consider whether dataset is complete');

  // Measurement columns need measurementType
  const measCols = Object.keys(measures).filter(k => measures[k] && mapping[k] === 'measurementValue');
  if (measCols.length) passes.push(measCols.length + ' measurement column(s) with type annotations');

  return { errors, warnings, passes };
}

function _renderValidationChecklist(result) {
  const icon = (type) => type === 'error' ? '✗' : type === 'warn' ? '!' : '✓';
  const color = (type) => type === 'error' ? 'var(--co)' : type === 'warn' ? 'var(--wa)' : 'var(--cg,#7B9E87)';
  const bg = (type) => type === 'error' ? 'rgba(192,80,80,.1)' : type === 'warn' ? 'rgba(212,160,74,.1)' : 'rgba(123,158,135,.1)';

  const items = [
    ...result.errors.map(m => ({ type: 'error', msg: m })),
    ...result.warnings.map(m => ({ type: 'warn', msg: m })),
    ...result.passes.map(m => ({ type: 'pass', msg: m }))
  ];

  const canExport = result.errors.length === 0;
  return `
    <div style="margin-top:12px">
      <h5 style="font-size:12px;color:var(--tm);font-family:var(--mf);margin-bottom:6px">Validation Results</h5>
      ${items.map(it => `<div style="padding:4px 8px;margin-bottom:3px;border-radius:4px;background:${bg(it.type)};font-size:11px;font-family:var(--mf);display:flex;align-items:center;gap:6px">
        <span style="color:${color(it.type)};font-weight:700;font-size:13px;min-width:14px;text-align:center">${icon(it.type)}</span>
        <span style="color:var(--ts)">${escHTML(it.msg)}</span>
      </div>`).join('')}
      <div style="margin-top:8px;font-size:12px;font-family:var(--mf);color:${canExport ? 'var(--cg,#7B9E87)' : 'var(--co)'}">
        ${canExport ? 'Ready to export — no blocking errors.' : result.errors.length + ' error(s) must be resolved before export.'}
      </div>
    </div>`;
}

function _fdExportDarwinCore() {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[window._fdSubmitIdx]; if (!ds) return;
  const { mapping, measures } = _fdReadDwcMapping();
  const meta = {
    basis: $('#dwc-basis')?.value || 'HumanObservation',
    inst: $('#dwc-inst')?.value?.trim() || '',
    dsname: $('#dwc-dsname')?.value?.trim() || ds.name,
    license: $('#dwc-license')?.value || 'CC-BY'
  };

  // Validate first
  const result = _validateSubmission(ds, mapping, measures, meta);
  if (result.errors.length) {
    const el = $('#fd-validation-result');
    if (el) el.innerHTML = _renderValidationChecklist(result);
    return toast('Fix validation errors before export', 'err');
  }

  const rows = ds.rows || [];
  const cols = Object.keys(mapping);
  const dwcCols = cols.map(c => mapping[c]);

  // Add basisOfRecord column
  const hasBasis = dwcCols.includes('basisOfRecord');
  const allCols = hasBasis ? dwcCols : [...dwcCols, 'basisOfRecord'];

  // Build occurrence CSV
  const csvLines = [allCols.join(',')];
  rows.forEach(r => {
    const vals = cols.map(c => {
      const v = String(r[c] ?? '');
      return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
    });
    if (!hasBasis) vals.push(meta.basis);
    csvLines.push(vals.join(','));
  });

  // Build measurementOrFact extension if needed
  const measCols = cols.filter(c => measures[c] && mapping[c] === 'measurementValue');
  let mofCsv = '';
  if (measCols.length > 1) {
    const mofLines = ['occurrenceID,measurementType,measurementValue'];
    rows.forEach((r, i) => {
      measCols.forEach(c => {
        const v = r[c];
        if (v !== '' && v != null) mofLines.push(`occ_${i},${measures[c]},${v}`);
      });
    });
    mofCsv = mofLines.join('\n');
  }

  // Generate EML
  const eml = _generateEML(ds, meta);

  // Download occurrence.csv
  dl(csvLines.join('\n'), 'occurrence.csv', 'text/csv');

  // Download eml.xml after short delay
  setTimeout(() => dl(eml, 'eml.xml', 'application/xml'), 300);

  // Download measurementOrFact.csv if applicable
  if (mofCsv) setTimeout(() => dl(mofCsv, 'measurementorfact.csv', 'text/csv'), 600);

  toast('Darwin Core archive files downloaded', 'ok');
}

function _generateEML(ds, meta) {
  const rows = ds.rows || [];
  const mapping = ds.mapping || {};
  const latCol = Object.keys(mapping).find(k => mapping[k] === 'Latitude');
  const lonCol = Object.keys(mapping).find(k => mapping[k] === 'Longitude');
  const dateCol = Object.keys(mapping).find(k => mapping[k] === 'Date');

  let west = 180, east = -180, south = 90, north = -90;
  let minDate = '', maxDate = '';
  rows.forEach(r => {
    if (latCol && lonCol) {
      const lat = parseFloat(r[latCol]), lon = parseFloat(r[lonCol]);
      if (!isNaN(lat) && !isNaN(lon)) {
        if (lat < south) south = lat; if (lat > north) north = lat;
        if (lon < west) west = lon; if (lon > east) east = lon;
      }
    }
    if (dateCol && r[dateCol]) {
      const d = String(r[dateCol]);
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  });

  const licenseUrl = meta.license === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' :
    meta.license === 'CC-BY-NC' ? 'https://creativecommons.org/licenses/by-nc/4.0/' :
    'https://creativecommons.org/licenses/by/4.0/';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<eml:eml xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="https://eml.ecoinformatics.org/eml-2.2.0 https://eml.ecoinformatics.org/eml-2.2.0/eml.xsd"
         packageId="${esc(ds.id)}" system="Meridian">
  <dataset>
    <title>${esc(meta.dsname)}</title>
    <creator>
      <organizationName>${esc(meta.inst || 'Unknown')}</organizationName>
    </creator>
    <pubDate>${new Date().toISOString().slice(0,10)}</pubDate>
    <language>en</language>
    <intellectualRights>
      <para>This work is licensed under <ulink url="${licenseUrl}"><citetitle>${esc(meta.license)}</citetitle></ulink></para>
    </intellectualRights>
    <coverage>
      <geographicCoverage>
        <geographicDescription>Bounding box of dataset observations</geographicDescription>
        <boundingCoordinates>
          <westBoundingCoordinate>${west}</westBoundingCoordinate>
          <eastBoundingCoordinate>${east}</eastBoundingCoordinate>
          <northBoundingCoordinate>${north}</northBoundingCoordinate>
          <southBoundingCoordinate>${south}</southBoundingCoordinate>
        </boundingCoordinates>
      </geographicCoverage>${minDate && maxDate ? `
      <temporalCoverage>
        <rangeOfDates>
          <beginDate><calendarDate>${esc(minDate)}</calendarDate></beginDate>
          <endDate><calendarDate>${esc(maxDate)}</calendarDate></endDate>
        </rangeOfDates>
      </temporalCoverage>` : ''}
    </coverage>
  </dataset>
</eml:eml>`;
}

function _fdExportPangaea() {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[window._fdSubmitIdx]; if (!ds) return;
  const mapping = ds.mapping || {};
  const campaign = $('#pg-campaign')?.value?.trim() || '';
  const pi = $('#pg-pi')?.value?.trim() || '';
  const email = $('#pg-email')?.value?.trim() || '';
  const method = $('#pg-method')?.value?.trim() || '';

  const cols = ds.columns || Object.keys(ds.rows[0] || {});

  // PANGAEA header
  const headerLines = [
    '/* PANGAEA data submission template */',
    '/* Generated by Meridian */',
    `/* Dataset: ${ds.name} */`,
    campaign ? `/* Campaign: ${campaign} */` : null,
    pi ? `/* PI: ${pi} */` : null,
    email ? `/* Contact: ${email} */` : null,
    method ? `/* Method: ${method} */` : null,
    `/* Records: ${ds.rows.length} */`,
    `/* Date exported: ${new Date().toISOString().slice(0,10)} */`,
    ''
  ].filter(Boolean);

  // Map roles to PANGAEA parameter names
  const pgNames = {
    'Latitude': 'LATITUDE', 'Longitude': 'LONGITUDE', 'Date': 'DATE/TIME',
    'Depth (m)': 'DEPTH, water [m]', 'Temperature': 'Temp [°C]',
    'Salinity': 'Sal', 'pH': 'pH', 'Species name': 'Species',
    'Abundance count': 'Abundance [#]', 'Biomass': 'Biomass [g]',
    'Site/station ID': 'Station'
  };

  const pgHeaders = cols.map(c => {
    const role = mapping[c] || 'Custom variable';
    return pgNames[role] || c;
  });

  const tsvLines = [pgHeaders.join('\t')];
  ds.rows.forEach(r => {
    tsvLines.push(cols.map(c => String(r[c] ?? '')).join('\t'));
  });

  dl(headerLines.join('\n') + tsvLines.join('\n'), ds.name + '_pangaea.tab', 'text/tab-separated-values');
  toast('PANGAEA template exported', 'ok');
}

function _fdExportBCODMO() {
  const datasets = safeParse('meridian_field_datasets', []);
  const ds = datasets[window._fdSubmitIdx]; if (!ds) return;
  const project = $('#bco-project')?.value?.trim() || '';
  const pi = $('#bco-pi')?.value?.trim() || '';
  const funding = $('#bco-funding')?.value?.trim() || '';
  const desc = $('#bco-desc')?.value?.trim() || '';

  const cols = ds.columns || Object.keys(ds.rows[0] || {});

  const headerLines = [
    '# BCO-DMO Dataset Submission',
    '# Generated by Meridian',
    `# Dataset: ${ds.name}`,
    project ? `# Project: ${project}` : null,
    pi ? `# PI: ${pi}` : null,
    funding ? `# Funding: ${funding}` : null,
    desc ? `# Description: ${desc}` : null,
    `# Records: ${ds.rows.length}`,
    `# Date exported: ${new Date().toISOString().slice(0,10)}`,
    '#'
  ].filter(Boolean);

  const csvLines = [cols.join(',')];
  ds.rows.forEach(r => {
    csvLines.push(cols.map(c => {
      const v = String(r[c] ?? '');
      return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(','));
  });

  dl(headerLines.join('\n') + '\n' + csvLines.join('\n'), ds.name + '_bcodmo.csv', 'text/csv');
  toast('BCO-DMO template exported', 'ok');
}
