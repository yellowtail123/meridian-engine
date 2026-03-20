# Meridian Audit Fixes Log

Exhaustive 15-section audit of ~16,013 lines across 14 JS files + HTML.
Date: 2026-03-19

---

## Fix 1 — CSP Missing Domains
**File:** `meridian.html` (lines 26-73)
**Section:** 1 (HTML Structural Integrity)
**Severity:** HIGH (security — blocked network requests)

Added 6 missing domains to Content Security Policy:
- `connect-src`: `www.gmrt.org` (GMRT bathymetry, used in core.js:499), `gateway.api.globalfishingwatch.org` (fishing layer, features.js:602), `raw.githubusercontent.com` (Natural Earth GeoJSON, features.js:722)
- `img-src`: `tiles.arcgis.com` (GEBCO bathymetry tiles, features.js:562), `allencoralatlas.org` and `geoserver-apia.sprep.org` (WMS coral/SPREP layers, features.js:568-578)

**Impact:** Without these, CSP would silently block GMRT bathymetry fetches, Global Fishing Watch overlay, Natural Earth borders, ArcGIS basemap tiles, and coral atlas layers.

---

## Fix 2 — Plotly Memory Leak (Auto-Purge)
**File:** `meridian-core.js` (after line 329)
**Section:** 13 (Performance)
**Severity:** HIGH (memory leak — 55+ newPlot calls, 1 purge call)

Added monkey-patch to `Plotly.newPlot` that auto-purges containers with `_fullLayout` before re-rendering:
```javascript
(function(){const _origNewPlot=Plotly.newPlot;Plotly.newPlot=function(el){
  const t=typeof el==='string'?document.getElementById(el):el;
  if(t&&t._fullLayout)try{Plotly.purge(t)}catch(e){}
  return _origNewPlot.apply(this,arguments)}})();
```

**Impact:** Without this, every re-render of env data charts, workshop charts, ecostats plots, and study design power curves leaked the previous Plotly instance. Over a session with heavy chart usage, this could consume hundreds of MB.

---

## Fix 3 — Event Listener Leak in snowballDiscover
**File:** `meridian-features.js` (line 1259)
**Section:** 6 (Event Listeners)
**Severity:** MEDIUM (memory/performance leak)

Changed anonymous `addEventListener('click',...)` on `#graphPaperDetail` to a named handler stored on the element, with cleanup before re-adding:
```javascript
if(gpd._canonicalHandler)gpd.removeEventListener('click',gpd._canonicalHandler);
gpd._canonicalHandler=function(e){...};
gpd.addEventListener('click',gpd._canonicalHandler);
```

**Impact:** Each snowball discovery run was adding a new click listener to the persistent `#graphPaperDetail` container, causing duplicate event fires and memory accumulation.

---

## Fix 4 — Event Listener Leak in Graph Node Click
**File:** `meridian-features.js` (line 1280)
**Section:** 6 (Event Listeners)
**Severity:** LOW (cosmetic — button was recreated each time, old listener GC'd)

Replaced `$('#graphSaveBtn')?.addEventListener('click',...)` with inline `onclick` handler to make the pattern explicit and consistent.

---

## Fix 5 — Shared State URL Hash Injection
**File:** `meridian-ui.js` (lines 397-406)
**Section:** 11 (Security)
**Severity:** HIGH (input validation — URL hash parsed and applied without checks)

Added comprehensive input validation to `loadSharedState()`:
- Type checking (`typeof state !== 'object'`)
- Numeric validation for lat/lon (`isFinite()`)
- Variable ID validation against EV catalogue whitelist
- Mode value whitelist (`latest`, `timeseries`, `depthprofile`)
- Date regex validation (`/^\d{4}-\d{2}-\d{2}$/`)
- Skill level whitelist (`beginner`, `intermediate`, `advanced`)

**Impact:** Before fix, a crafted `#state=` URL hash could inject arbitrary values into env data controls, localStorage, and UI state via base64-decoded JSON.

---

## Fix 6 — Duplicate rarefactionCurve Function (Global Collision)
**Files:** `meridian-ecostats.js` (line 157)
**Section:** 2 (JS Function Inventory)
**Severity:** HIGH (functional bug — Workshop rarefaction chart broken)

Renamed `rarefactionCurve` in ecostats.js to `ecoRarefactionCurve` and updated its call site (ecostats.js line 467).

**Root cause:** Both `meridian-stats.js:499` and `meridian-ecostats.js:157` defined `rarefactionCurve`. Since ecostats loads after stats, the ecostats version shadowed the stats version globally. The two versions returned different field names:
- stats.js: `{n, expectedS}`
- ecostats.js: `{n, expected_S}`

The Workshop's `runWSRarefaction()` (workshop.js:931) reads `c.expectedS`, which was `undefined` after shadowing, causing the rarefaction chart to render with no Y-axis data.

---

## Fix 7 — Escape Key for All Modals
**File:** `meridian-features.js` (line 1093)
**Section:** 7 (UI/Rendering)
**Severity:** MEDIUM (UX — some modals had no keyboard dismiss)

Extended the Escape key handler to close all modal types:
- PDF viewer (`#pdfModal`) — already handled
- Citation panel (`#citePanelOverlay`) — already handled
- **Added:** Error console (`#err-console`)
- **Added:** Batch DOI import (`#batchImportModal`)
- **Added:** Brain Map seed overlay (`#bm-seed-overlay`)
- **Added:** Any `.meridian-modal-overlay` (glossary, workflows, provenance, etc.)

---

## Fix 8 — Repro Modal Click Propagation
**File:** `meridian-repro.js` (line 10)
**Section:** 7 (UI/Rendering)
**Severity:** LOW (cosmetic — progress modal inner click propagation)

Added `onclick="event.stopPropagation()"` to the inner `.meridian-modal` div to prevent clicks inside the progress modal from accidentally closing it.

---

## Audit Findings: No Fix Required

### Confirmed Safe Patterns
1. **All `JSON.parse` calls** — wrapped in try/catch or use `safeParse()` wrapper
2. **All `innerHTML` assignments via `H()`** — user-controlled data passes through `escHTML()` / `escJSAttr()`
3. **`renderMD()` markdown renderer** — escapes `<`, `>`, `&` before applying markdown transforms
4. **`safeUrl()` link handler** — only allows `http:`/`https:` protocols
5. **`highlightTerms()` search highlighting** — calls `escHTML()` first, then applies regex
6. **`new Function()` in Workshop** — sandboxed with `DANGEROUS_NAMES` blocklist, `Math` whitelist, `Object.create(null)`, strict mode
7. **`_keyVault` encrypted key storage** — AES-GCM via Web Crypto API with random salt
8. **`initEnvMap()` / `initStudyDesign()` / `initFieldData()`** — all have initialization guards preventing re-entry
9. **`Plotly.toImage` in repro bundle** — async/await with per-figure try/catch
10. **`URL.createObjectURL`** — all calls have matching `revokeObjectURL` with cleanup timer
11. **`sessionStorage` for species data** — all reads wrapped in try/catch with `|| 'null'` fallback
12. **No `setInterval` calls** — all timers use `setTimeout` with proper cleanup
13. **No `eval()` calls** — only `new Function()` in workshop (sandboxed)
14. **208 HTML IDs** — all unique, no duplicates
15. **All wizard button functions** — every `rec:['runXxx']` in method wizard maps to a defined function

### Structural Observations
- **14 JS files, ~16,013 lines** — well-modularized by concern
- **122 innerHTML assignments** across 11 files — all audited, user data escaped
- **55+ Plotly.newPlot calls** — now auto-purged via monkey-patch
- **50+ fetch() calls** — all use `fetchT()`/`erddapFetch()` with timeout + AbortController
- **30+ external API domains** — all in CSP connect-src whitelist
- **75 glossary terms** — hardcoded, not user-editable
- **18 search engines + 34 journals** — hardcoded reference arrays

---

## Test Harness

Created `meridian-audit-tests.js` — automated browser-console test suite covering all 14 audit sections + stats math validation.

Usage:
```javascript
// Run all tests
MeridianAudit.runAll()

// Run specific section
MeridianAudit.run('security')
MeridianAudit.run('functions')
MeridianAudit.run('stats')
```

Sections: `html`, `functions`, `indexeddb`, `localstorage`, `api`, `events`, `ui`, `tabs`, `crosscutting`, `dataflow`, `security`, `accessibility`, `performance`, `stats`
