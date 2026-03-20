import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */
const DARK = {
  bg:"#1F1D2B", bs:"#272536", be:"#302E40", bi:"#1A1828",
  ac:"#C9956B", am:"rgba(201,149,107,.10)", ab:"rgba(201,149,107,.20)", ag:"rgba(201,149,107,.35)",
  sg:"#7B9E87", sm:"rgba(123,158,135,.10)", sb:"rgba(123,158,135,.20)",
  co:"#C27878", cm:"rgba(194,120,120,.10)",
  lv:"#9B8EC4", wa:"#D4A04A",
  tx:"#E8E0D6", ts:"#B5A99D", tm:"#8A837E",
  bd:"rgba(201,149,107,.06)", bh:"rgba(201,149,107,.16)",
  sf:"'Source Serif 4',Georgia,serif", mf:"'JetBrains Mono',monospace",
};
const LIGHT = {
  bg:"#F5F2EE", bs:"#FFFFFF", be:"#EDE9E3", bi:"#F9F7F4",
  ac:"#8B6914", am:"rgba(139,105,20,.08)", ab:"rgba(139,105,20,.15)", ag:"rgba(139,105,20,.25)",
  sg:"#3D7A4F", sm:"rgba(61,122,79,.08)", sb:"rgba(61,122,79,.15)",
  co:"#B84040", cm:"rgba(184,64,64,.08)",
  lv:"#6B5CA5", wa:"#B8860B",
  tx:"#2C2416", ts:"#5A4E3E", tm:"#8A7E72",
  bd:"rgba(139,105,20,.10)", bh:"rgba(139,105,20,.20)",
  sf:"'Source Serif 4',Georgia,serif", mf:"'JetBrains Mono',monospace",
};
const COLORS = ["#C9956B","#7B9E87","#9B8EC4","#C27878","#D4A04A","#6BA3C9","#C96BA3","#8EC49B"];

/* ═══════════════════════════════════════════════════════════════
   JOURNAL DATABASE
   ═══════════════════════════════════════════════════════════════ */
const JOURNALS = [
  {name:"Nature",field:"Multidisciplinary",tier:"S",oa:"Hybrid"},{name:"Science",field:"Multidisciplinary",tier:"S",oa:"Hybrid"},
  {name:"PNAS",field:"Multidisciplinary",tier:"S",oa:"Hybrid"},{name:"Nature Communications",field:"Multidisciplinary",tier:"A",oa:"Full OA"},
  {name:"PLOS ONE",field:"Multidisciplinary",tier:"B",oa:"Full OA"},{name:"Scientific Reports",field:"Multidisciplinary",tier:"B",oa:"Full OA"},
  {name:"Marine Ecology Progress Series",field:"Marine Biology",tier:"A",oa:"Hybrid"},{name:"ICES Journal of Marine Science",field:"Fisheries Science",tier:"A",oa:"Hybrid"},
  {name:"Fish and Fisheries",field:"Fisheries Science",tier:"S",oa:"Hybrid"},{name:"Canadian Journal of Fisheries and Aquatic Sciences",field:"Fisheries Science",tier:"A",oa:"Hybrid"},
  {name:"Fisheries Research",field:"Fisheries Science",tier:"A",oa:"Hybrid"},{name:"Marine Biology",field:"Marine Biology",tier:"A",oa:"Hybrid"},
  {name:"Journal of Fish Biology",field:"Fisheries Science",tier:"B",oa:"Hybrid"},{name:"Marine Policy",field:"Marine Policy",tier:"A",oa:"Hybrid"},
  {name:"Aquaculture",field:"Aquaculture",tier:"A",oa:"Hybrid"},{name:"Frontiers in Marine Science",field:"Marine Biology",tier:"A",oa:"Full OA"},
  {name:"Ecology Letters",field:"Ecology",tier:"S",oa:"Hybrid"},{name:"Ecology",field:"Ecology",tier:"A",oa:"Hybrid"},
  {name:"Molecular Ecology",field:"Genetics",tier:"S",oa:"Hybrid"},{name:"Conservation Biology",field:"Conservation",tier:"S",oa:"Hybrid"},
  {name:"Global Change Biology",field:"Climate Science",tier:"S",oa:"Hybrid"},{name:"Limnology and Oceanography",field:"Oceanography",tier:"S",oa:"Hybrid"},
  {name:"Progress in Oceanography",field:"Oceanography",tier:"S",oa:"Hybrid"},{name:"Deep-Sea Research Part I",field:"Oceanography",tier:"A",oa:"Hybrid"},
  {name:"Methods in Ecology and Evolution",field:"Methods",tier:"S",oa:"Full OA"},{name:"Environmental Science & Technology",field:"Environmental Science",tier:"S",oa:"Hybrid"},
  {name:"Marine Pollution Bulletin",field:"Environmental Science",tier:"B",oa:"Hybrid"},{name:"Biological Conservation",field:"Conservation",tier:"A",oa:"Hybrid"},
  {name:"Estuarine, Coastal and Shelf Science",field:"Marine Biology",tier:"A",oa:"Hybrid"},{name:"Journal of Experimental Marine Biology and Ecology",field:"Marine Biology",tier:"B",oa:"Hybrid"},
  {name:"Reviews in Fisheries Science & Aquaculture",field:"Fisheries Science",tier:"A",oa:"Hybrid"},{name:"North American Journal of Fisheries Management",field:"Fisheries Science",tier:"B",oa:"Hybrid"},
  {name:"Transactions of the American Fisheries Society",field:"Fisheries Science",tier:"B",oa:"Hybrid"},
];

/* ═══════════════════════════════════════════════════════════════
   SEARCH ENGINES (for external link-outs)
   ═══════════════════════════════════════════════════════════════ */
const ENGINES = [
  {name:"Google Scholar",url:q=>`https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`},
  {name:"Scopus",url:q=>`https://www.scopus.com/results/results.uri?src=s&sot=b&sdt=b&sl=35&s=TITLE-ABS-KEY(${encodeURIComponent(q)})`},
  {name:"Web of Science",url:q=>`https://www.webofscience.com/wos/woscc/summary/TS=${encodeURIComponent(q)}/relevance/1`},
  {name:"JSTOR",url:q=>`https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`},
  {name:"BASE",url:q=>`https://www.base-search.net/Search/Results?lookfor=${encodeURIComponent(q)}`},
  {name:"CORE",url:q=>`https://core.ac.uk/search?q=${encodeURIComponent(q)}`},
  {name:"Dimensions",url:q=>`https://app.dimensions.ai/discover/publication?search_text=${encodeURIComponent(q)}`},
  {name:"Lens.org",url:q=>`https://www.lens.org/lens/search/scholar/list?q=${encodeURIComponent(q)}`},
  {name:"DOAJ",url:q=>`https://doaj.org/search/articles?source={"query":{"query_string":{"query":"${encodeURIComponent(q)}","default_operator":"AND"}}}`},
];

/* ═══════════════════════════════════════════════════════════════
   API FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */
async function searchOpenAlex(q, yearFrom, yearTo) {
  let url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=25&mailto=meridian@example.com`;
  if (yearFrom) url += `&filter=from_publication_date:${yearFrom}-01-01`;
  if (yearTo) url += (yearFrom ? "," : "&filter=") + `to_publication_date:${yearTo}-12-31`;
  const r = await fetch(url); if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).map(w => ({
    id: w.id, title: w.title, year: w.publication_year,
    authors: (w.authorships || []).slice(0, 10).map(a => a.author?.display_name).filter(Boolean),
    journal: w.primary_location?.source?.display_name || "",
    cited: w.cited_by_count || 0, doi: w.doi?.replace("https://doi.org/", ""),
    oa: w.open_access?.is_oa || false, abstract: w.abstract_inverted_index ? rebuildAbstract(w.abstract_inverted_index) : "",
    url: w.doi || w.id, source: "OpenAlex",
    concepts: (w.concepts || []).slice(0, 5).map(c => c.display_name),
    type: w.type, refs: w.referenced_works?.length || 0,
  }));
}
function rebuildAbstract(inv) {
  if (!inv) return "";
  const arr = [];
  for (const [word, positions] of Object.entries(inv)) for (const p of positions) arr[p] = word;
  return arr.join(" ");
}
async function searchSemanticScholar(q) {
  const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=20&fields=title,year,authors,citationCount,externalIds,isOpenAccess,abstract,journal,fieldsOfStudy`);
  if (!r.ok) return []; const d = await r.json();
  return (d.data || []).map(p => ({
    id: "s2_" + p.paperId, title: p.title, year: p.year,
    authors: (p.authors || []).slice(0, 10).map(a => a.name),
    journal: p.journal?.name || "", cited: p.citationCount || 0,
    doi: p.externalIds?.DOI, oa: p.isOpenAccess || false,
    abstract: p.abstract || "", url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : `https://api.semanticscholar.org/CorpusID:${p.paperId}`,
    source: "Semantic Scholar", concepts: p.fieldsOfStudy || [],
  }));
}
async function searchCrossRef(q) {
  const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=20&mailto=meridian@example.com`);
  if (!r.ok) return []; const d = await r.json();
  return (d.message?.items || []).map(w => ({
    id: "cr_" + w.DOI, title: Array.isArray(w.title) ? w.title[0] : w.title || "",
    year: w.published?.["date-parts"]?.[0]?.[0] || w.created?.["date-parts"]?.[0]?.[0],
    authors: (w.author || []).slice(0, 10).map(a => [a.given, a.family].filter(Boolean).join(" ")),
    journal: w["container-title"]?.[0] || "", cited: w["is-referenced-by-count"] || 0,
    doi: w.DOI, oa: w.license?.some(l => l.URL?.includes("creativecommons")) || false,
    abstract: w.abstract?.replace(/<[^>]*>/g, "") || "",
    url: `https://doi.org/${w.DOI}`, source: "CrossRef",
  }));
}
async function searchPubMed(q) {
  const sr = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=15&retmode=json`);
  if (!sr.ok) return []; const sd = await sr.json();
  const ids = sd.esearchresult?.idlist || []; if (!ids.length) return [];
  const fr = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`);
  if (!fr.ok) return []; const fd = await fr.json();
  return ids.map(id => { const p = fd.result?.[id]; if (!p) return null; return {
    id: "pm_" + id, title: p.title || "", year: parseInt(p.pubdate) || null,
    authors: (p.authors || []).slice(0, 10).map(a => a.name),
    journal: p.fulljournalname || p.source || "", cited: 0, doi: (p.elocationid || "").replace("doi: ", ""),
    oa: false, abstract: "", url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, source: "PubMed",
  }}).filter(Boolean);
}
function dedup(papers) {
  const seen = new Map();
  for (const p of papers) {
    const key = p.doi || p.title?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!key) { seen.set(p.id, p); continue; }
    const ex = seen.get(key);
    if (!ex || (p.abstract && !ex.abstract) || (p.cited > (ex.cited || 0))) seen.set(key, p);
    else if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

/* Species APIs */
async function searchWoRMS(q) {
  const r = await fetch(`https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames%5B%5D=${encodeURIComponent(q)}&marine_only=false`);
  if (!r.ok) return null; const d = await r.json();
  return d?.[0]?.[0] || null;
}
async function searchWoRMSVernacular(q) {
  const r = await fetch(`https://www.marinespecies.org/rest/AphiaRecordsByVernacular/${encodeURIComponent(q)}?like=true&offset=1`);
  if (!r.ok) return null; const d = await r.json();
  return d?.[0] || null;
}
async function fetchGBIF(name) {
  const sr = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`);
  if (!sr.ok) return { count: 0, results: [] }; const sd = await sr.json();
  if (!sd.usageKey) return { count: 0, results: [] };
  const or = await fetch(`https://api.gbif.org/v1/occurrence/search?taxonKey=${sd.usageKey}&limit=300`);
  if (!or.ok) return { count: 0, results: [] }; const od = await or.json();
  return { count: od.count || 0, results: (od.results || []).filter(r => r.decimalLatitude && r.decimalLongitude) };
}
async function fetchOBIS(name) {
  const r = await fetch(`https://api.obis.org/v3/occurrence?scientificname=${encodeURIComponent(name)}&size=300`);
  if (!r.ok) return { total: 0, results: [] }; const d = await r.json();
  return { total: d.total || 0, results: (d.results || []).filter(r => r.decimalLatitude && r.decimalLongitude) };
}

/* Environmental Data */
const ERDDAP_SERVERS = [
  { id: "pfeg", base: "https://coastwatch.pfeg.noaa.gov/erddap" },
  { id: "ncei", base: "https://www.ncei.noaa.gov/erddap" },
];
const ENV_VARS = [
  { id: "sst", name: "SST", unit: "°C", dataset: "ncdcOisst21Agg_LonPM180", variable: "sst", server: "ncei", color: "#C9956B" },
  { id: "chlor", name: "Chlorophyll-a", unit: "mg/m³", dataset: "erdMH1chlamday", variable: "chlorophyll", server: "pfeg", color: "#7B9E87" },
  { id: "sst_anom", name: "SST Anomaly", unit: "°C", dataset: "ncdcOisst21Agg_LonPM180", variable: "anom", server: "ncei", color: "#C27878" },
];

async function fetchERDDAP(varDef, lat, lon, dateFrom, dateTo) {
  const srv = ERDDAP_SERVERS.find(s => s.id === varDef.server);
  if (!srv) return null;
  const url = `${srv.base}/griddap/${varDef.dataset}.json?${varDef.variable}[(${dateFrom}T00:00:00Z):(${dateTo}T00:00:00Z)][(${lat}):1:(${lat})][(${lon}):1:(${lon})]`;
  try {
    const r = await fetch(url); if (!r.ok) return null; const d = await r.json();
    const cols = d.table.columnNames; const rows = d.table.rows;
    const tIdx = cols.indexOf("time"); const vIdx = cols.indexOf(varDef.variable);
    if (tIdx < 0 || vIdx < 0) return null;
    return rows.map(r => ({ time: r[tIdx], value: r[vIdx] })).filter(r => r.value !== null && !isNaN(r.value));
  } catch { return null; }
}

async function fetchBathymetry(lat, lon) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!r.ok) return null; const d = await r.json();
    return d.elevation?.[0] ?? d.elevation ?? null;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════
   STATS UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stdev(arr) { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)); }
function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pearsonR(x, y) {
  const n = Math.min(x.length, y.length); if (n < 3) return { r: 0, p: 1 };
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
  const r = num / Math.sqrt(dx * dy) || 0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r)); const p = n > 30 ? Math.exp(-0.717 * t * t - 0.416 * Math.abs(t)) : Math.min(1, 2 / (1 + Math.abs(t)));
  return { r, p };
}
function linReg(x, y) {
  const n = Math.min(x.length, y.length); const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  const slope = den ? num / den : 0; const intercept = my - slope * mx;
  return { slope, intercept };
}
function tTest(a, b) {
  const n1 = a.length, n2 = b.length, m1 = mean(a), m2 = mean(b), s1 = stdev(a), s2 = stdev(b);
  const se = Math.sqrt(s1 * s1 / n1 + s2 * s2 / n2); const t = se ? (m1 - m2) / se : 0;
  const df = n1 + n2 - 2; const p = df > 30 ? Math.exp(-0.717 * t * t - 0.416 * Math.abs(t)) : Math.min(1, 2 / (1 + Math.abs(t)));
  return { t, p, df, mean1: m1, mean2: m2, sd1: s1, sd2: s2 };
}

/* ═══════════════════════════════════════════════════════════════
   HABITAT INFERENCE
   ═══════════════════════════════════════════════════════════════ */
function inferHabitat(lat, lon, data) {
  const habitats = [];
  const depth = data.depth ?? data.elevation ?? null;
  const sst = data.sst ?? null;
  const chlor = data.chlor ?? null;
  const absLat = Math.abs(parseFloat(lat));
  if (sst >= 23 && depth != null && depth >= -60 && depth <= 0 && absLat <= 35) habitats.push({ name: "Coral Reef", confidence: 0.7, icon: "\uD83E\uDEA7" });
  if (depth != null && depth >= -15 && depth <= 0 && sst >= 15 && absLat <= 45) habitats.push({ name: "Seagrass Meadow", confidence: 0.5, icon: "\uD83C\uDF3F" });
  if (sst >= 20 && absLat <= 30 && depth != null && depth >= -5) habitats.push({ name: "Mangrove", confidence: 0.4, icon: "\uD83C\uDF33" });
  if (depth != null && depth < -200 && chlor != null && chlor < 0.5) habitats.push({ name: "Deep Sea / Pelagic", confidence: 0.6, icon: "\uD83C\uDF0A" });
  if (depth != null && depth >= -200 && depth < -15) habitats.push({ name: "Continental Shelf", confidence: 0.5, icon: "\uD83C\uDFD6\uFE0F" });
  if (sst != null && sst < 15 && chlor != null && chlor > 1 && absLat > 30) habitats.push({ name: "Kelp Forest", confidence: 0.4, icon: "\uD83E\uDEB4" });
  habitats.sort((a, b) => b.confidence - a.confidence);
  return habitats;
}

/* ═══════════════════════════════════════════════════════════════
   IndexedDB HELPERS
   ═══════════════════════════════════════════════════════════════ */
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("MeridianLib", 9);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      ["papers","collections","chats","geo","screening","padi_tfidf","padi_bayes","padi_graph","bathymetry","brainmaps"].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s === "bathymetry" ? "key" : s === "screening" ? "paperId" : "id" });
      });
    };
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror = e => rej(e);
  });
}
async function dbPut(p) { if (!_db) await openDB(); const tx = _db.transaction("papers", "readwrite"); tx.objectStore("papers").put(p); }
async function dbAll() { if (!_db) await openDB(); return new Promise(r => { const req = _db.transaction("papers", "readonly").objectStore("papers").getAll(); req.onsuccess = () => r(req.result); req.onerror = () => r([]); }); }
async function dbDel(id) { if (!_db) await openDB(); const tx = _db.transaction("papers", "readwrite"); tx.objectStore("papers").delete(id); }

/* ═══════════════════════════════════════════════════════════════
   GLOBE SVG (header artwork)
   ═══════════════════════════════════════════════════════════════ */
function Globe() {
  return (
    <svg className="hdr-globe" width="140" height="140" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="gOcean" cx="42%" cy="40%"><stop offset="0%" stopColor="#1b6090"/><stop offset="20%" stopColor="#175580"/><stop offset="45%" stopColor="#124868"/><stop offset="70%" stopColor="#0c3550"/><stop offset="100%" stopColor="#072438"/></radialGradient>
        <radialGradient id="gSun" cx="30%" cy="25%"><stop offset="0%" stopColor="rgba(255,255,255,.15)"/><stop offset="60%" stopColor="rgba(0,0,0,0)"/></radialGradient>
        <radialGradient id="gShadow" cx="75%" cy="78%"><stop offset="0%" stopColor="rgba(0,0,0,0)"/><stop offset="75%" stopColor="rgba(0,0,15,.12)"/><stop offset="100%" stopColor="rgba(0,0,20,.28)"/></radialGradient>
        <clipPath id="gc"><circle cx="100" cy="100" r="72"/></clipPath>
      </defs>
      <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(80,160,255,.03)" strokeWidth="6"/>
      <circle cx="100" cy="100" r="72" fill="url(#gOcean)"/>
      <g clipPath="url(#gc)">
        {/* North America */}
        <path d="M30,38 L28,36 L26,37 L24,35 L26,33 L29,32 L32,30 L35,31 L37,29 L40,30 L42,28 L44,30 L42,33 L40,35 L38,34 L36,36 L34,35 L32,37Z" fill="#2a6840" stroke="#388550" strokeWidth=".4"/>
        <path d="M44,33 L46,35 L48,37 L50,38 L52,37 L54,39 L56,38 L58,40 L60,38 L62,40 L64,38 L66,40 L68,38 L70,40 L72,38 L74,36 L76,38 L78,36 L80,38 L82,40 L80,42 L78,44 L76,42 L74,44 L72,46 L70,44 L68,46 L66,48 L68,50 L66,52 L64,54 L62,52 L60,54 L58,56 L56,54 L54,56 L52,58 L50,56 L48,54 L46,52 L44,50 L42,48 L40,46 L38,44 L36,42 L34,40 L36,38 L38,36 L40,38 L42,36Z" fill="#2a6840" stroke="#388550" strokeWidth=".4"/>
        <path d="M58,56 L60,58 L62,62 L64,66 L62,68 L60,66 L58,62 L56,60 L56,58Z" fill="#2a6840" stroke="#388550" strokeWidth=".3"/>
        <path d="M36,52 L38,50 L40,52 L42,54 L44,56 L46,58 L48,60 L46,62 L44,64 L42,66 L40,68 L38,66 L36,64 L34,62 L32,60 L34,58 L36,56Z" fill="#2a6840" stroke="#388550" strokeWidth=".4"/>
        {/* South America */}
        <path d="M50,78 L54,76 L58,78 L62,76 L66,78 L70,76 L74,78 L78,80 L82,78 L84,80 L86,84 L88,88 L88,92 L86,96 L84,100 L82,104 L80,108 L78,112 L76,116 L72,120 L68,124 L64,126 L60,128 L56,126 L54,122 L52,118 L50,114 L48,108 L46,102 L46,96 L48,90 L50,86 L48,82Z" fill="#2a6840" stroke="#388550" strokeWidth=".4"/>
        {/* Europe */}
        <path d="M97,32 L98,30 L99,28 L101,30 L100,33 L99,35 L97,34Z" fill="#2a6840" stroke="#388550" strokeWidth=".3" opacity=".85"/>
        <path d="M105,30 L110,28 L114,30 L118,32 L120,34 L122,36 L120,38 L116,38 L112,38 L108,38 L106,36 L104,34Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".85"/>
        <path d="M93,38 L96,36 L99,37 L100,40 L98,43 L96,44 L93,44 L91,42 L92,40Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".88"/>
        {/* Africa */}
        <path d="M92,48 L96,46 L100,47 L104,46 L108,48 L112,47 L114,50 L112,54 L108,52 L104,54 L100,52 L96,52 L92,52 L90,50Z" fill="#4a8050" stroke="#388550" strokeWidth=".35" opacity=".88"/>
        <path d="M100,62 L106,62 L112,62 L118,64 L122,62 L126,64 L128,68 L130,72 L128,78 L126,82 L124,86 L122,88 L118,90 L114,92 L110,90 L106,88 L102,86 L100,82 L98,78 L96,74 L94,70 L96,66Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".88"/>
        <path d="M102,86 L106,88 L110,90 L114,92 L116,96 L114,100 L112,104 L108,108 L104,110 L100,108 L96,104 L94,100 L94,96 L96,92 L98,88Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".88"/>
        {/* Asia */}
        <path d="M136,28 L140,26 L146,24 L152,22 L158,20 L164,22 L168,24 L172,22 L174,26 L170,30 L166,28 L162,30 L158,28 L154,30 L150,28 L146,30 L142,28 L138,30Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".75"/>
        <path d="M140,50 L144,48 L148,50 L150,54 L152,60 L150,66 L146,70 L142,68 L138,64 L136,60 L138,56 L140,52Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".85"/>
        <path d="M150,32 L156,30 L162,32 L168,34 L172,38 L174,42 L172,46 L168,50 L164,52 L160,50 L156,48 L152,46 L150,42 L148,38 L150,34Z" fill="#2a6840" stroke="#388550" strokeWidth=".35" opacity=".82"/>
        {/* Australia */}
        <path d="M164,84 L168,82 L174,80 L180,82 L184,86 L186,90 L184,96 L180,102 L176,106 L170,108 L164,106 L160,102 L158,96 L158,90 L160,86Z" fill="#3a7450" stroke="#388550" strokeWidth=".35" opacity=".8"/>
        {/* Cloud hints */}
        <path d="M34,42 Q40,38 48,42 Q54,38 58,42" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M120,58 Q128,54 138,58 Q144,54 150,58" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1.5" strokeLinecap="round"/>
      </g>
      <circle cx="100" cy="100" r="72" fill="url(#gSun)"/><circle cx="100" cy="100" r="72" fill="url(#gShadow)"/>
      <circle cx="100" cy="100" r="71.5" fill="none" stroke="rgba(120,180,240,.05)" strokeWidth="1"/>
      <ellipse cx="74" cy="64" rx="16" ry="20" fill="rgba(255,255,255,.025)"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB ICONS (SVG)
   ═══════════════════════════════════════════════════════════════ */
const TabIcon = ({ type }) => {
  const svgs = {
    lit: <><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></>,
    library: <><rect x="2" y="3" width="4" height="11" rx="0.5"/><rect x="7" y="2" width="3.5" height="12" rx="0.5"/><path d="M12 14l2-12" strokeWidth="1.5"/></>,
    species: <><path d="M2 8c2-3 5-5 8-4 2.5.6 4 2.5 4.5 4-.5 1.5-2 3.4-4.5 4-3 1-6-1-8-4z"/><circle cx="12" cy="8" r="1" style={{fill:"currentColor"}} stroke="none"/><path d="M2 8L0 5.5M2 8L0 10.5"/></>,
    env: <><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M2.5 5h11M2.5 11h11"/></>,
    workshop: <><rect x="1" y="10" width="3" height="4" rx="0.5"/><rect x="5.5" y="6" width="3" height="8" rx="0.5"/><rect x="10" y="2" width="3" height="12" rx="0.5"/></>,
    graph: <><circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.8"/><circle cx="3" cy="13" r="1.5"/><circle cx="13" cy="13" r="1.5"/><line x1="4.3" y1="3.7" x2="6.5" y2="7"/><line x1="11.7" y1="3.7" x2="9.5" y2="7"/><line x1="6.5" y1="9" x2="4.3" y2="12"/><line x1="9.5" y1="9" x2="11.7" y2="12"/></>,
    gaps: <path d="M3 2h4l1.5 2L10 2h3v4l-2 1.5L13 9v4h-4l-1-2-1 2H3V9l2-1.5L3 6z"/>,
    fielddata: <><path d="M8 1v9M4 6l4 4 4-4"/><path d="M2 12h12v2H2z"/></>,
    ecostats: <text x="3" y="13" fontSize="14" fontWeight="700" fill="currentColor" stroke="none">{"\u03A3"}</text>,
    studydesign: <><path d="M3 2h10v12H3z" fill="none"/><path d="M5 5h6M5 8h6M5 11h4"/></>,
  };
  return <span className="tab-icon"><svg viewBox="0 0 16 16" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{svgs[type]}</svg></span>;
};

/* ═══════════════════════════════════════════════════════════════
   CSS (injected)
   ═══════════════════════════════════════════════════════════════ */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Source Serif 4',Georgia,serif;font-size:15px;line-height:1.6;min-height:100vh;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:0}::-webkit-scrollbar-thumb{border-radius:3px}
input,textarea,select{font-family:'JetBrains Mono',monospace;font-size:13px}
a{text-decoration:none}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes drift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.hdr-title{padding:16px 30px 14px;position:relative;overflow:hidden;background:linear-gradient(160deg,#06050e 0%,#0a0918 30%,#0d0c1e 60%,#080a14 100%);border-bottom:1px solid rgba(42,90,140,.2);min-height:105px}
.hdr-globe{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 0 20px rgba(40,100,180,.12))}
.hdr-stars{position:absolute;inset:0;pointer-events:none}
.hdr-stars span{position:absolute;width:2px;height:2px;border-radius:50%;background:#c8c0b8}
.tab-icon{display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle}
.tab-lbl{white-space:nowrap}
.leaflet-container{font-family:'JetBrains Mono',monospace!important}
@media(max-width:768px){.tab-lbl{display:none}.tab-icon{margin-right:0}}
`;

/* ═══════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════ */
let _toastId = 0;

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Meridian() {
  const [theme, setTheme] = useState(() => localStorage.getItem("meridian_theme") || "dark");
  const T = theme === "dark" ? DARK : LIGHT;
  const [tab, setTab] = useState("lit");
  const [toasts, setToasts] = useState([]);

  // Literature state
  const [litQuery, setLitQuery] = useState("");
  const [litResults, setLitResults] = useState([]);
  const [litLoading, setLitLoading] = useState(false);
  const [litExpanded, setLitExpanded] = useState(null);
  const [litYearFrom, setLitYearFrom] = useState("");
  const [litYearTo, setLitYearTo] = useState("");
  const [litOA, setLitOA] = useState(false);
  const [litSort, setLitSort] = useState("relevance");
  const [litSources, setLitSources] = useState({});
  const [showEngines, setShowEngines] = useState(false);
  const [showJournals, setShowJournals] = useState(false);

  // Library state
  const [library, setLibrary] = useState([]);
  const [libSearch, setLibSearch] = useState("");
  const [libSort, setLibSort] = useState("recent");

  // Species state
  const [specQuery, setSpecQuery] = useState("");
  const [specResult, setSpecResult] = useState(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [gbifData, setGbifData] = useState(null);
  const [obisData, setObisData] = useState(null);

  // Environmental state
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapMarkersRef = useRef([]);
  const [envLat, setEnvLat] = useState("");
  const [envLon, setEnvLon] = useState("");
  const [envDateFrom, setEnvDateFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
  const [envDateTo, setEnvDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [envData, setEnvData] = useState({});
  const [envLoading, setEnvLoading] = useState(false);
  const [envVars, setEnvVars] = useState(["sst", "chlor"]);
  const [envCharts, setEnvCharts] = useState([]);
  const [envElevation, setEnvElevation] = useState(null);
  const [envHabitats, setEnvHabitats] = useState([]);
  const [mapLayers, setMapLayers] = useState({ sst: false, chlor: false, bath: false });
  const [basemap, setBasemap] = useState("dark");

  // Workshop state
  const [wsData, setWsData] = useState([]);
  const [wsColumns, setWsColumns] = useState([]);
  const [wsChartType, setWsChartType] = useState("line");
  const [wsXCol, setWsXCol] = useState("");
  const [wsYCol, setWsYCol] = useState("");
  const [wsStats, setWsStats] = useState(null);

  // Field data state
  const [fieldData, setFieldData] = useState(null);
  const [fieldCols, setFieldCols] = useState([]);

  // Eco stats state
  const [ecoInput, setEcoInput] = useState("");
  const [ecoResult, setEcoResult] = useState(null);

  // Study design state
  const [sdEffect, setSdEffect] = useState(0.5);
  const [sdAlpha, setSdAlpha] = useState(0.05);
  const [sdPower, setSdPower] = useState(0.8);
  const [sdResult, setSdResult] = useState(null);

  const toast = useCallback((msg, type = "info") => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Theme toggle
  useEffect(() => {
    document.body.style.background = T.bg;
    document.body.style.color = T.tx;
    localStorage.setItem("meridian_theme", theme);
  }, [theme, T]);

  // Load library on mount
  useEffect(() => { loadLibrary(); }, []);

  async function loadLibrary() {
    try { const papers = await dbAll(); setLibrary(papers); } catch (e) { console.warn("Library load error:", e); }
  }

  // Initialize Leaflet map
  useEffect(() => {
    if (tab !== "env" || mapRef.current) return;
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current, { center: [20, 0], zoom: 3, zoomControl: true, preferCanvas: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 19,
      }).addTo(map);
      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        setEnvLat(lat.toFixed(4));
        setEnvLon(lng.toFixed(4));
        mapMarkersRef.current.forEach(m => map.removeLayer(m));
        const marker = L.circleMarker([lat, lng], { radius: 6, color: "#C9956B", fillColor: "#C9956B", fillOpacity: 0.8, weight: 2 }).addTo(map);
        mapMarkersRef.current = [marker];
      });
      mapRef.current = map;
    }, 100);
    return () => clearTimeout(timer);
  }, [tab]);

  // ── LITERATURE SEARCH ──
  async function searchLit() {
    if (!litQuery.trim()) return;
    setLitLoading(true); setLitResults([]); setLitSources({});
    const sources = {};
    try {
      const [oa, s2, cr, pm] = await Promise.allSettled([
        searchOpenAlex(litQuery, litYearFrom, litYearTo),
        searchSemanticScholar(litQuery),
        searchCrossRef(litQuery),
        searchPubMed(litQuery),
      ]);
      const all = [];
      if (oa.status === "fulfilled") { all.push(...oa.value); sources.OpenAlex = oa.value.length; }
      if (s2.status === "fulfilled") { all.push(...s2.value); sources["Semantic Scholar"] = s2.value.length; }
      if (cr.status === "fulfilled") { all.push(...cr.value); sources.CrossRef = cr.value.length; }
      if (pm.status === "fulfilled") { all.push(...pm.value); sources.PubMed = pm.value.length; }
      let results = dedup(all);
      if (litOA) results = results.filter(p => p.oa);
      if (litSort === "citations") results.sort((a, b) => (b.cited || 0) - (a.cited || 0));
      else if (litSort === "year") results.sort((a, b) => (b.year || 0) - (a.year || 0));
      setLitResults(results);
      setLitSources(sources);
      toast(`Found ${results.length} papers from ${Object.keys(sources).length} sources`, "ok");
    } catch (e) { toast("Search error: " + e.message, "err"); }
    setLitLoading(false);
  }

  async function savePaperToLib(paper) {
    const p = { ...paper, id: paper.id || "m" + Date.now(), savedAt: new Date().toISOString(), tags: [], notes: "", project: "Default" };
    await dbPut(p);
    await loadLibrary();
    toast("Saved to library", "ok");
  }

  // ── SPECIES SEARCH ──
  async function searchSpec() {
    if (!specQuery.trim()) return;
    setSpecLoading(true); setSpecResult(null); setGbifData(null); setObisData(null);
    try {
      let worms = await searchWoRMS(specQuery);
      if (!worms) worms = await searchWoRMSVernacular(specQuery);
      if (worms) {
        setSpecResult(worms);
        const name = worms.scientificname || worms.valid_name || specQuery;
        const [gbif, obis] = await Promise.allSettled([fetchGBIF(name), fetchOBIS(name)]);
        if (gbif.status === "fulfilled") setGbifData(gbif.value);
        if (obis.status === "fulfilled") setObisData(obis.value);
        toast(`Found ${name} — loading occurrences`, "ok");
      } else { toast("Species not found. Try the scientific name.", "err"); }
    } catch (e) { toast("Species search error: " + e.message, "err"); }
    setSpecLoading(false);
  }

  // ── ENVIRONMENTAL FETCH ──
  async function fetchEnv() {
    if (!envLat || !envLon) { toast("Click the map or enter coordinates", "err"); return; }
    setEnvLoading(true); setEnvCharts([]); setEnvHabitats([]);
    const results = {};
    try {
      const fetches = envVars.map(async vid => {
        const vd = ENV_VARS.find(v => v.id === vid);
        if (!vd) return;
        const data = await fetchERDDAP(vd, envLat, envLon, envDateFrom, envDateTo);
        if (data && data.length) results[vid] = { def: vd, data };
      });
      const elevFetch = fetchBathymetry(envLat, envLon).then(e => setEnvElevation(e));
      await Promise.allSettled([...fetches, elevFetch]);
      setEnvData(results);
      // Build chart data
      const charts = [];
      for (const [vid, { def, data }] of Object.entries(results)) {
        const values = data.map(d => d.value);
        const chartData = data.map(d => ({ time: d.time.slice(0, 10), [def.name]: d.value }));
        const { slope } = linReg(data.map((_, i) => i), values);
        charts.push({
          id: vid, name: def.name, unit: def.unit, color: def.color,
          data: chartData, mean: mean(values), min: Math.min(...values), max: Math.max(...values),
          std: values.length > 1 ? stdev(values) : 0, trend: slope, n: values.length,
        });
      }
      setEnvCharts(charts);
      // Habitat inference
      const habData = { sst: results.sst?.data?.slice(-1)[0]?.value, chlor: results.chlor?.data?.slice(-1)[0]?.value, elevation: envElevation };
      setEnvHabitats(inferHabitat(envLat, envLon, habData));
      toast(`Fetched ${Object.keys(results).length} variables, ${charts.reduce((s, c) => s + c.n, 0)} data points`, "ok");
    } catch (e) { toast("Fetch error: " + e.message, "err"); }
    setEnvLoading(false);
  }

  // ── WORKSHOP ──
  function compileToWorkshop() {
    const source = tab === "library" ? library : litResults;
    if (!source.length) { toast("No data to compile", "err"); return; }
    const cols = ["title", "year", "authors", "journal", "cited", "doi", "oa"];
    const data = source.map(p => ({
      title: p.title || "", year: p.year || "", authors: (p.authors || []).join("; "),
      journal: p.journal || "", cited: p.cited || 0, doi: p.doi || "", oa: p.oa ? "Yes" : "No",
    }));
    setWsColumns(cols);
    setWsData(data);
    setWsXCol(cols[1] || "");
    setWsYCol(cols[4] || "");
    setTab("workshop");
    toast(`Compiled ${data.length} rows to Workshop`, "ok");
  }

  function runStats() {
    if (!wsData.length || !wsXCol || !wsYCol) return;
    const x = wsData.map(d => parseFloat(d[wsXCol])).filter(v => !isNaN(v));
    const y = wsData.map(d => parseFloat(d[wsYCol])).filter(v => !isNaN(v));
    if (x.length < 3 || y.length < 3) { toast("Need at least 3 numeric values", "err"); return; }
    const corr = pearsonR(x, y);
    const reg = linReg(x, y);
    setWsStats({
      xCol: wsXCol, yCol: wsYCol,
      n: Math.min(x.length, y.length),
      r: corr.r, p: corr.p,
      slope: reg.slope, intercept: reg.intercept,
      xMean: mean(x), yMean: mean(y),
      xSD: stdev(x), ySD: stdev(y),
    });
  }

  function exportCSV() {
    if (!wsData.length) return;
    const header = wsColumns.join(",");
    const rows = wsData.map(d => wsColumns.map(c => `"${String(d[c] || "").replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "meridian_data.csv"; a.click();
  }

  // ── FIELD DATA ──
  function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      if (!lines.length) return;
      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));
      const data = lines.slice(1).map(line => {
        const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
        const row = {};
        headers.forEach((h, i) => { row[h] = isNaN(vals[i]) ? vals[i] : parseFloat(vals[i]); });
        return row;
      });
      setFieldData(data);
      setFieldCols(headers);
      toast(`Loaded ${data.length} rows, ${headers.length} columns`, "ok");
    };
    reader.readAsText(file);
  }

  function fieldToWorkshop() {
    if (!fieldData) return;
    setWsData(fieldData);
    setWsColumns(fieldCols);
    setWsXCol(fieldCols[0] || "");
    setWsYCol(fieldCols[1] || "");
    setTab("workshop");
    toast("Field data sent to Workshop", "ok");
  }

  // ── ECO STATS ──
  function calcDiversity() {
    const vals = ecoInput.split(/[\n,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0);
    if (vals.length < 2) { toast("Enter species abundances (comma or newline separated)", "err"); return; }
    const total = vals.reduce((a, b) => a + b, 0);
    const proportions = vals.map(v => v / total);
    const shannon = -proportions.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
    const simpson = 1 - proportions.reduce((s, p) => s + p * p, 0);
    const richness = vals.length;
    const evenness = shannon / Math.log(richness);
    const margalef = (richness - 1) / Math.log(total);
    setEcoResult({ shannon, simpson, richness, evenness, margalef, total, n: vals.length });
  }

  // ── STUDY DESIGN ──
  function calcSampleSize() {
    const zAlpha = sdAlpha <= 0.01 ? 2.576 : sdAlpha <= 0.05 ? 1.96 : 1.645;
    const zBeta = sdPower >= 0.9 ? 1.282 : sdPower >= 0.8 ? 0.842 : 0.524;
    const n = Math.ceil(((zAlpha + zBeta) ** 2 * 2) / (sdEffect ** 2));
    setSdResult({ n, totalN: n * 2, effect: sdEffect, alpha: sdAlpha, power: sdPower });
  }

  // ── SHARED STYLES ──
  const s = {
    si: { flex:1, padding:"13px 18px", background:T.bi, border:`1px solid ${T.bd}`, borderRadius:10, color:T.tx, fontSize:15, outline:"none", fontFamily:T.sf },
    fi: { padding:"7px 11px", background:T.bi, border:`1px solid ${T.bd}`, borderRadius:5, color:T.tx, fontSize:13, fontFamily:T.mf, outline:"none" },
    bt: { padding:"9px 18px", borderRadius:6, border:`1px solid ${T.bd}`, background:"transparent", color:T.tm, cursor:"pointer", fontFamily:T.mf, fontSize:13, whiteSpace:"nowrap" },
    btOn: { padding:"9px 18px", borderRadius:6, border:`1px solid ${T.ab}`, background:T.am, color:T.ac, cursor:"pointer", fontFamily:T.mf, fontSize:13, whiteSpace:"nowrap" },
    btSm: { padding:"8px 14px", borderRadius:5, border:`1px solid ${T.bd}`, background:"transparent", color:T.tm, cursor:"pointer", fontFamily:T.mf, fontSize:12, minHeight:36 },
    btSmOn: { padding:"8px 14px", borderRadius:5, border:`1px solid ${T.ab}`, background:T.am, color:T.ac, cursor:"pointer", fontFamily:T.mf, fontSize:12, minHeight:36 },
    sec: { marginBottom:18, background:T.bs, border:`1px solid ${T.bd}`, borderRadius:10, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,.1)" },
    sh: { padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", borderBottom:`1px solid ${T.bd}` },
    shH4: { fontSize:12, color:T.tm, fontFamily:T.mf, letterSpacing:1, textTransform:"uppercase", fontWeight:400 },
    sb: { padding:18 },
    tip: { padding:"15px 20px", background:`linear-gradient(135deg,${T.am},rgba(123,158,135,.06))`, border:`1px solid ${T.ab}`, borderRadius:10, marginBottom:18, fontSize:13, color:T.ts, lineHeight:1.65 },
    card: { padding:"16px 20px", background:T.bs, border:`1px solid ${T.bd}`, borderRadius:10, cursor:"pointer", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" },
    ec: { background:`linear-gradient(135deg,${T.bs},${T.be})`, border:`1px solid ${T.bd}`, borderRadius:10, padding:16 },
    el: { fontSize:12, color:T.tm, fontFamily:T.mf, textTransform:"uppercase", marginBottom:8, letterSpacing:.5 },
    ev: { fontSize:26, fontWeight:700, color:T.ac, fontFamily:T.mf },
    eu: { fontSize:12, fontWeight:400, color:T.ts, marginLeft:4 },
    tag: { display:"inline-block", fontSize:12, padding:"3px 9px", borderRadius:4, fontFamily:T.mf, textTransform:"uppercase", margin:"0 5px 4px 0" },
    tagOA: { background:T.sm, color:T.sg, border:`1px solid ${T.sb}` },
    empty: { textAlign:"center", padding:"40px 20px", color:T.tm, fontFamily:T.sf, fontSize:13, lineHeight:1.6 },
    emptyIcon: { fontSize:24, marginBottom:12, opacity:0.3 },
  };

  const TABS = [
    { id:"lit", label:"Literature" },
    { id:"library", label:"Library" },
    { id:"species", label:"Species" },
    { id:"env", label:"Environmental Data" },
    { id:"workshop", label:"Analysis" },
    { id:"graph", label:"Citations" },
    { id:"gaps", label:"Gap Analysis" },
    { id:"fielddata", label:"Field Data" },
    { id:"ecostats", label:"Eco Stats" },
    { id:"studydesign", label:"Study Design" },
  ];

  // ── RENDER ──
  return (
    <>
      <style>{CSS}</style>
      <div style={{ background:T.bg, color:T.tx, minHeight:"100vh" }}>
        {/* ═══ HEADER ═══ */}
        <header>
          <div className="hdr-title">
            <div className="hdr-stars">
              {[[8,2,.3],[55,7,.2],[14,19,.35],[72,15,.15],[5,33,.25],[82,26,.18],[18,73,.3],[66,80,.2],[9,89,.28],[76,93,.15],[42,97,.22],[28,3,.18],[88,46,.12],[4,56,.25],[50,40,.1],[35,62,.12]].map(([t,l,o],i) =>
                <span key={i} style={{top:`${t}%`,left:`${l}%`,opacity:o}}/>
              )}
            </div>
            <Globe />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",zIndex:2}}>
              <div>
                <h1 style={{fontSize:35,fontWeight:700,background:"linear-gradient(135deg,#C9956B,#D4A04A,#E8C49B,#C9956B)",backgroundSize:"300% 300%",animation:"drift 8s ease infinite",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontFamily:T.sf}}>
                  Meridian{" "}
                  <span style={{fontSize:18,fontFamily:T.mf,letterSpacing:6,textTransform:"uppercase",WebkitTextFillColor:"#C27878",textShadow:"0 0 7px rgba(194,120,120,.6),0 0 20px rgba(194,120,120,.35)",background:"none",WebkitBackgroundClip:"unset",animation:"none",marginLeft:18}}>THE WORLD IS YOURS</span>
                </h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button style={{...s.btSm,width:28,height:28,padding:0,borderRadius:"50%",fontSize:15,color:T.ac,borderColor:T.ab}} onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} title="Toggle theme">{theme==="dark"?"\u263D":"\u2600"}</button>
                <div style={{fontSize:12,color:T.tm,textAlign:"right",fontFamily:T.mf,lineHeight:1.6}}>
                  <div>WoRMS+GBIF+OBIS</div>
                  <div><span style={{display:"inline-block",fontSize:10,padding:"2px 7px",borderRadius:8,background:T.cm,color:T.co}}>Free</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ TABS ═══ */}
          <div style={{background:T.bg,padding:"0 30px",borderBottom:`1px solid ${T.bd}`}}>
            <div style={{display:"flex",overflowX:"auto",gap:2,scrollbarWidth:"none"}}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  padding:"10px 16px",fontSize:13,cursor:"pointer",fontFamily:T.mf,
                  color:tab===t.id?T.ac:T.tm,background:tab===t.id?T.bs:"transparent",
                  fontWeight:tab===t.id?600:400,
                  border:`1px solid ${tab===t.id?T.bd:"transparent"}`,
                  borderBottom:tab===t.id?`1px solid ${T.bg}`:`1px solid ${T.bd}`,
                  borderTop:tab===t.id?`2px solid ${T.ac}`:"1px solid transparent",
                  borderRadius:"6px 6px 0 0",marginBottom:-1,whiteSpace:"nowrap",
                }}>
                  <TabIcon type={t.id}/><span className="tab-lbl">{t.label}</span>
                  {t.id==="library"&&library.length>0&&<span style={{marginLeft:6,fontSize:10,padding:"2px 7px",borderRadius:8,background:T.cm,color:T.co}}>{library.length}</span>}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main style={{padding:"24px 30px",maxWidth:1200,margin:"0 auto"}}>

          {/* ── LITERATURE TAB ── */}
          {tab==="lit" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Literature Search.</b> Searches OpenAlex, Semantic Scholar, CrossRef & PubMed simultaneously. Click a result to see its abstract, then save to Library or compile all to Workshop.</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <input style={s.si} value={litQuery} onChange={e=>setLitQuery(e.target.value)} placeholder="Search academic databases... (try: coral bleaching, otolith, CPUE)" onKeyDown={e=>e.key==="Enter"&&searchLit()}/>
                <button style={s.btOn} onClick={searchLit}>Search</button>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
                <span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>Year:</span>
                <input style={{...s.fi,width:70}} type="number" placeholder="From" value={litYearFrom} onChange={e=>setLitYearFrom(e.target.value)}/>
                <span style={{color:T.tm,fontSize:11}}>&ndash;</span>
                <input style={{...s.fi,width:70}} type="number" placeholder="To" value={litYearTo} onChange={e=>setLitYearTo(e.target.value)}/>
                <button style={litOA?s.btSmOn:s.btSm} onClick={()=>setLitOA(!litOA)}>OA Only</button>
                <span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>Sort:</span>
                <select style={s.fi} value={litSort} onChange={e=>setLitSort(e.target.value)}>
                  <option value="relevance">Relevance</option><option value="citations">Most Cited</option><option value="year">Newest First</option>
                </select>
                <button style={showEngines?s.btSmOn:s.btSm} onClick={()=>setShowEngines(!showEngines)}>Engines</button>
                <button style={showJournals?s.btSmOn:s.btSm} onClick={()=>setShowJournals(!showJournals)}>Journals</button>
                {litResults.length>0 && <>
                  <span style={{flex:1}}/>
                  <button style={s.btSm} onClick={()=>{litResults.forEach(p=>savePaperToLib(p))}}>Save All</button>
                  <button style={s.btSmOn} onClick={compileToWorkshop}>Compile &rarr; Workshop</button>
                </>}
              </div>
              {showEngines && <div style={{...s.sec,padding:14,marginBottom:14}}>
                <div style={{fontSize:11,color:T.tm,fontFamily:T.mf,marginBottom:8}}>EXTERNAL SEARCH ENGINES</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ENGINES.map(e=><a key={e.name} href={e.url(litQuery||"marine")} target="_blank" rel="noopener" style={{...s.btSm,color:T.ac,textDecoration:"none"}}>{e.name}</a>)}</div>
              </div>}
              {showJournals && <div style={{...s.sec,padding:14,marginBottom:14}}>
                <div style={{fontSize:11,color:T.tm,fontFamily:T.mf,marginBottom:8}}>JOURNAL DATABASE ({JOURNALS.length})</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{[...new Set(JOURNALS.map(j=>j.field))].map(f=><span key={f} style={{...s.tag,...s.tagOA}}>{f} ({JOURNALS.filter(j=>j.field===f).length})</span>)}</div>
              </div>}
              {litLoading && <div style={{padding:40,display:"flex",justifyContent:"center",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.ac,animation:`pulse 1s ${i*.2}s infinite`}}/>)}</div>}
              {Object.keys(litSources).length>0 && <div style={{fontSize:12,color:T.tm,fontFamily:T.mf,marginBottom:10}}>
                {Object.entries(litSources).map(([src,n])=><span key={src} style={{marginRight:12}}>{src}: {n}</span>)}
                <span style={{color:T.ac}}>Total: {litResults.length} (deduplicated)</span>
              </div>}
              {litResults.map((p,i)=>(
                <div key={p.id||i} style={{...s.card,borderColor:litExpanded===i?T.ab:T.bd}} onClick={()=>setLitExpanded(litExpanded===i?null:i)}>
                  <div style={{fontSize:15,fontWeight:600,marginBottom:4,lineHeight:1.4,color:T.tx}}>{p.title}</div>
                  <div style={{fontSize:12,color:T.ts,fontFamily:T.mf,marginBottom:4}}>{(p.authors||[]).slice(0,3).join(", ")}{p.authors?.length>3?" et al.":""}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",fontSize:12,fontFamily:T.mf}}>
                    {p.year&&<span style={{color:T.tm}}>{p.year}</span>}
                    {p.journal&&<span style={{color:T.ts}}>{p.journal}</span>}
                    {p.cited>0&&<span style={{color:T.ac}}>{p.cited} cited</span>}
                    {p.oa&&<span style={{...s.tag,...s.tagOA,margin:0}}>OA</span>}
                    <span style={{color:T.tm,fontSize:10}}>{p.source}</span>
                  </div>
                  {litExpanded===i && (
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.bd}`,animation:"fadeIn .2s"}}>
                      {p.abstract&&<div style={{fontSize:13,color:T.ts,lineHeight:1.7,marginBottom:12}}>{p.abstract}</div>}
                      {p.concepts?.length>0&&<div style={{marginBottom:8}}>{p.concepts.map(c=><span key={c} style={{...s.tag,background:T.am,color:T.ac,border:`1px solid ${T.bd}`}}>{c}</span>)}</div>}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button style={s.btSmOn} onClick={e=>{e.stopPropagation();savePaperToLib(p)}}>Save to Library</button>
                        {p.doi&&<a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener" style={{...s.btSm,color:T.ac,textDecoration:"none"}} onClick={e=>e.stopPropagation()}>DOI</a>}
                        {p.url&&<a href={p.url} target="_blank" rel="noopener" style={{...s.btSm,color:T.sg,textDecoration:"none"}} onClick={e=>e.stopPropagation()}>View</a>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!litLoading&&!litResults.length&&<div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDD0D"}</div>Multi-source academic literature search<br/><span style={{fontSize:12,color:T.tm}}>Simultaneously queries 4 APIs, deduplicates results, and links to 25+ additional search engines.</span></div>}
            </div>
          )}

          {/* ── LIBRARY TAB ── */}
          {tab==="library" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Paper Library.</b> Papers saved from Literature search persist in IndexedDB between sessions. Search, tag, and export your collection.</div>
              <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
                <input style={{...s.si,maxWidth:400}} placeholder="Search papers..." value={libSearch} onChange={e=>setLibSearch(e.target.value)}/>
                <select style={s.fi} value={libSort} onChange={e=>setLibSort(e.target.value)}>
                  <option value="recent">Recently Added</option><option value="year-new">Year (Newest)</option><option value="cited">Most Cited</option><option value="title">Title A-Z</option>
                </select>
                <span style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>{library.length} papers</span>
                <span style={{flex:1}}/>
                <button style={s.btSmOn} onClick={compileToWorkshop}>Compile &rarr; Workshop</button>
                <button style={s.btSm} onClick={exportCSV}>Export CSV</button>
              </div>
              {library.filter(p=>{
                if(!libSearch)return true;
                const q=libSearch.toLowerCase();
                return (p.title||"").toLowerCase().includes(q)||(p.authors||[]).join(" ").toLowerCase().includes(q)||(p.journal||"").toLowerCase().includes(q);
              }).sort((a,b)=>{
                if(libSort==="year-new")return(b.year||0)-(a.year||0);
                if(libSort==="cited")return(b.cited||0)-(a.cited||0);
                if(libSort==="title")return(a.title||"").localeCompare(b.title||"");
                return 0;
              }).map((p,i)=>(
                <div key={p.id||i} style={{background:T.be,border:`1px solid ${T.bd}`,borderRadius:8,padding:"13px 16px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>{p.title}</div>
                      <div style={{fontSize:12,color:T.ts,fontFamily:T.mf}}>{(p.authors||[]).slice(0,3).join(", ")} {p.year&&`(${p.year})`} {p.journal&&`— ${p.journal}`}</div>
                      {p.cited>0&&<span style={{fontSize:11,color:T.ac,fontFamily:T.mf}}>{p.cited} citations</span>}
                    </div>
                    <button style={{...s.btSm,color:T.co,borderColor:"rgba(194,120,120,.3)",fontSize:11}} onClick={async()=>{await dbDel(p.id);await loadLibrary();toast("Removed","ok")}}>Remove</button>
                  </div>
                </div>
              ))}
              {!library.length&&<div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDCDA"}</div>Your library is empty. Search for papers in the Literature tab and save them here.</div>}
            </div>
          )}

          {/* ── SPECIES TAB ── */}
          {tab==="species" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Species Database.</b> Enter a scientific or common name to retrieve taxonomy (WoRMS), global occurrences (GBIF+OBIS), and biology.</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <input style={s.si} value={specQuery} onChange={e=>setSpecQuery(e.target.value)} placeholder="Scientific or common name (e.g. Tursiops truncatus, clownfish)" onKeyDown={e=>e.key==="Enter"&&searchSpec()}/>
                <button style={s.btOn} onClick={searchSpec}>Search</button>
              </div>
              {specLoading&&<div style={{padding:40,display:"flex",justifyContent:"center",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.sg,animation:`pulse 1s ${i*.2}s infinite`}}/>)}</div>}
              {specResult && (
                <div style={{animation:"fadeIn .35s"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:18}}>
                    {[
                      ["Scientific Name",specResult.scientificname],
                      ["Authority",specResult.authority],
                      ["Status",specResult.status],
                      ["Rank",specResult.rank],
                      ["Kingdom",specResult.kingdom],
                      ["Phylum",specResult.phylum],
                      ["Class",specResult.class],
                      ["Order",specResult.order],
                      ["Family",specResult.family],
                      ["Genus",specResult.genus],
                      ["AphiaID",specResult.AphiaID],
                      ["Marine",specResult.isMarine?"Yes":"No"],
                    ].filter(([,v])=>v).map(([label,val])=>(
                      <div key={label} style={s.ec}>
                        <div style={s.el}>{label}</div>
                        <div style={{fontSize:13,lineHeight:1.55,color:T.tx}}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {gbifData && <div style={s.sec}>
                    <div style={s.sh}><h4 style={s.shH4}>GBIF Occurrences</h4><span style={{color:T.ac,fontFamily:T.mf,fontSize:12}}>{gbifData.count?.toLocaleString()} total</span></div>
                    <div style={s.sb}><div style={{fontSize:12,color:T.ts,fontFamily:T.mf}}>{gbifData.results?.length || 0} georeferenced records loaded for mapping</div></div>
                  </div>}
                  {obisData && <div style={{...s.sec,marginTop:10}}>
                    <div style={s.sh}><h4 style={s.shH4}>OBIS Occurrences</h4><span style={{color:T.sg,fontFamily:T.mf,fontSize:12}}>{obisData.total?.toLocaleString()} total</span></div>
                    <div style={s.sb}><div style={{fontSize:12,color:T.ts,fontFamily:T.mf}}>{obisData.results?.length || 0} records with coordinates</div></div>
                  </div>}
                </div>
              )}
              {!specLoading&&!specResult&&<div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDC1F"}</div>Search for a species by scientific or common name to see taxonomy, occurrences, and biology.</div>}
            </div>
          )}

          {/* ── ENVIRONMENTAL TAB ── */}
          {tab==="env" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Environmental Data.</b> Click the map to select a point. Fetch SST, chlorophyll, and other variables from NOAA ERDDAP servers. <span style={{color:T.wa,fontWeight:500}}>SST has ~2 week lag, Chlorophyll ~8 day lag.</span></div>

              {/* Map section */}
              <div style={s.sec}>
                <div style={s.sh}><h4 style={s.shH4}>Map & Layers</h4></div>
                <div style={s.sb}>
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>Layers:</span>
                    {[["sst","SST"],["chlor","Chlorophyll"],["bath","Bathymetry"]].map(([id,label])=>(
                      <button key={id} style={envVars.includes(id)?s.btSmOn:s.btSm} onClick={()=>setEnvVars(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}>{label}</button>
                    ))}
                    <span style={{flex:1}}/>
                    <span style={{fontSize:12,color:T.ac,fontFamily:T.mf}}>{envLat&&envLon?`${envLat}, ${envLon}`:"Click map to select point"}</span>
                  </div>
                  <div ref={mapContainerRef} style={{height:520,borderRadius:10,border:`1px solid ${T.bd}`,marginBottom:14,zIndex:1}}/>
                </div>
              </div>

              {/* Location & Time */}
              <div style={s.sec}>
                <div style={s.sh}><h4 style={s.shH4}>Location & Time {envLat&&<span style={{fontWeight:400,color:T.ts,textTransform:"none",letterSpacing:0,fontSize:11}}>{envLat}, {envLon}</span>}</h4></div>
                <div style={s.sb}>
                  <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap",alignItems:"flex-end"}}>
                    <div><label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>LAT</label><br/><input style={{...s.fi,width:85,padding:8,fontSize:13}} value={envLat} onChange={e=>setEnvLat(e.target.value)} placeholder="36.13"/></div>
                    <div><label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>LON</label><br/><input style={{...s.fi,width:85,padding:8,fontSize:13}} value={envLon} onChange={e=>setEnvLon(e.target.value)} placeholder="-5.35"/></div>
                    <div><label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>FROM</label><br/><input type="date" style={{...s.fi,width:130,padding:6}} value={envDateFrom} onChange={e=>setEnvDateFrom(e.target.value)}/></div>
                    <div><label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>TO</label><br/><input type="date" style={{...s.fi,width:130,padding:6}} value={envDateTo} onChange={e=>setEnvDateTo(e.target.value)}/></div>
                    <button style={s.btOn} onClick={fetchEnv}>{envLoading?"Fetching...":"Fetch"}</button>
                  </div>
                  <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:T.tm,fontFamily:T.mf,marginRight:4}}>Quick:</span>
                    {[[30,"30d"],[90,"90d"],[365,"1yr"],[1825,"5yr"],[3650,"10yr"]].map(([days,label])=>(
                      <button key={days} style={s.btSm} onClick={()=>{const d=new Date();d.setDate(d.getDate()-days);setEnvDateFrom(d.toISOString().slice(0,10));setEnvDateTo(new Date().toISOString().slice(0,10))}}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Results */}
              {envLoading&&<div style={{padding:40,display:"flex",justifyContent:"center",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.ac,animation:`pulse 1s ${i*.2}s infinite`}}/>)}</div>}

              {envCharts.length>0 && (
                <div style={{animation:"fadeIn .35s"}}>
                  {/* Summary cards */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10,marginBottom:20}}>
                    {envCharts.map(c=>(
                      <div key={c.id} style={s.ec}>
                        <div style={s.el}>{c.name}</div>
                        <div style={s.ev}>{c.mean.toFixed(2)}<span style={s.eu}>{c.unit}</span></div>
                        <div style={{fontSize:11,color:T.tm,fontFamily:T.mf,marginTop:4}}>
                          Range: {c.min.toFixed(2)} – {c.max.toFixed(2)} | n={c.n}
                        </div>
                        <div style={{fontSize:11,color:c.trend>0?T.co:T.sg,fontFamily:T.mf}}>
                          Trend: {c.trend>0?"+":""}{c.trend.toFixed(4)}/step
                        </div>
                      </div>
                    ))}
                    {envElevation!==null&&<div style={s.ec}>
                      <div style={s.el}>Elevation / Depth</div>
                      <div style={s.ev}>{envElevation}<span style={s.eu}>m</span></div>
                    </div>}
                  </div>

                  {/* Habitat inference */}
                  {envHabitats.length>0&&<div style={{...s.sec,marginBottom:18}}>
                    <div style={s.sh}><h4 style={s.shH4}>Inferred Habitats</h4></div>
                    <div style={s.sb}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {envHabitats.map(h=><span key={h.name} style={{...s.tag,background:T.am,color:T.ac,border:`1px solid ${T.ab}`}}>{h.icon} {h.name} ({(h.confidence*100).toFixed(0)}%)</span>)}
                    </div></div>
                  </div>}

                  {/* Time series charts */}
                  {envCharts.map(c=>(
                    <div key={c.id} style={{...s.sec,marginBottom:14}}>
                      <div style={s.sh}><h4 style={s.shH4}>{c.name} Time Series</h4><span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>n={c.n}</span></div>
                      <div style={{...s.sb,height:300}}>
                        <ResponsiveContainer>
                          <LineChart data={c.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke={T.bd}/>
                            <XAxis dataKey="time" tick={{fontSize:10,fill:T.tm}} interval="preserveStartEnd"/>
                            <YAxis tick={{fontSize:10,fill:T.tm}}/>
                            <Tooltip contentStyle={{background:T.bs,border:`1px solid ${T.bd}`,borderRadius:6,fontFamily:T.mf,fontSize:12}}/>
                            <Line type="monotone" dataKey={c.name} stroke={c.color} dot={false} strokeWidth={1.5}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── WORKSHOP / ANALYSIS TAB ── */}
          {tab==="workshop" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Data Workshop.</b> Chart builder with built-in stats. Export to CSV, R, or Python.</div>
              {wsData.length>0 ? (
                <div>
                  {/* Controls */}
                  <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                    <select style={s.fi} value={wsChartType} onChange={e=>setWsChartType(e.target.value)}>
                      <option value="line">Line</option><option value="bar">Bar</option><option value="scatter">Scatter</option><option value="area">Area</option><option value="pie">Pie</option>
                    </select>
                    <span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>X:</span>
                    <select style={s.fi} value={wsXCol} onChange={e=>setWsXCol(e.target.value)}>{wsColumns.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <span style={{fontSize:11,color:T.tm,fontFamily:T.mf}}>Y:</span>
                    <select style={s.fi} value={wsYCol} onChange={e=>setWsYCol(e.target.value)}>{wsColumns.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <button style={s.btSmOn} onClick={runStats}>Run Stats</button>
                    <span style={{flex:1}}/>
                    <button style={s.btSm} onClick={exportCSV}>CSV</button>
                    <span style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>{wsData.length} rows</span>
                  </div>

                  {/* Chart */}
                  <div style={{...s.sec,marginBottom:14}}>
                    <div style={{padding:18,height:350}}>
                      <ResponsiveContainer>
                        {wsChartType==="bar" ? (
                          <BarChart data={wsData}><CartesianGrid strokeDasharray="3 3" stroke={T.bd}/><XAxis dataKey={wsXCol} tick={{fontSize:10,fill:T.tm}}/><YAxis tick={{fontSize:10,fill:T.tm}}/><Tooltip contentStyle={{background:T.bs,border:`1px solid ${T.bd}`,borderRadius:6}}/><Bar dataKey={wsYCol} fill={T.ac}/></BarChart>
                        ) : wsChartType==="scatter" ? (
                          <ScatterChart><CartesianGrid strokeDasharray="3 3" stroke={T.bd}/><XAxis dataKey={wsXCol} tick={{fontSize:10,fill:T.tm}} type="number" name={wsXCol}/><YAxis dataKey={wsYCol} tick={{fontSize:10,fill:T.tm}} type="number" name={wsYCol}/><Tooltip contentStyle={{background:T.bs,border:`1px solid ${T.bd}`,borderRadius:6}}/><Scatter data={wsData} fill={T.ac}/></ScatterChart>
                        ) : wsChartType==="area" ? (
                          <AreaChart data={wsData}><CartesianGrid strokeDasharray="3 3" stroke={T.bd}/><XAxis dataKey={wsXCol} tick={{fontSize:10,fill:T.tm}}/><YAxis tick={{fontSize:10,fill:T.tm}}/><Tooltip contentStyle={{background:T.bs,border:`1px solid ${T.bd}`,borderRadius:6}}/><Area type="monotone" dataKey={wsYCol} fill={T.am} stroke={T.ac}/></AreaChart>
                        ) : wsChartType==="pie" ? (
                          <PieChart><Pie data={wsData.slice(0,12).map((d,i)=>({name:String(d[wsXCol]),value:parseFloat(d[wsYCol])||0}))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120}>{wsData.slice(0,12).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart>
                        ) : (
                          <LineChart data={wsData}><CartesianGrid strokeDasharray="3 3" stroke={T.bd}/><XAxis dataKey={wsXCol} tick={{fontSize:10,fill:T.tm}}/><YAxis tick={{fontSize:10,fill:T.tm}}/><Tooltip contentStyle={{background:T.bs,border:`1px solid ${T.bd}`,borderRadius:6}}/><Line type="monotone" dataKey={wsYCol} stroke={T.ac} dot={false} strokeWidth={2}/></LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Stats results */}
                  {wsStats && <div style={{...s.sec,marginBottom:14}}>
                    <div style={s.sh}><h4 style={s.shH4}>Statistical Summary</h4></div>
                    <div style={{...s.sb,fontFamily:T.mf,fontSize:13}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                        <div style={s.ec}><div style={s.el}>Pearson r</div><div style={s.ev}>{wsStats.r.toFixed(4)}</div><div style={{fontSize:11,color:wsStats.p<0.05?T.sg:T.co}}>p = {wsStats.p.toFixed(4)}</div></div>
                        <div style={s.ec}><div style={s.el}>Regression</div><div style={{fontSize:14,color:T.ac}}>y = {wsStats.slope.toFixed(4)}x + {wsStats.intercept.toFixed(2)}</div></div>
                        <div style={s.ec}><div style={s.el}>{wsStats.xCol} Mean</div><div style={s.ev}>{wsStats.xMean.toFixed(2)}</div><div style={{fontSize:11,color:T.tm}}>SD: {wsStats.xSD.toFixed(2)}</div></div>
                        <div style={s.ec}><div style={s.el}>{wsStats.yCol} Mean</div><div style={s.ev}>{wsStats.yMean.toFixed(2)}</div><div style={{fontSize:11,color:T.tm}}>SD: {wsStats.ySD.toFixed(2)}</div></div>
                        <div style={s.ec}><div style={s.el}>n</div><div style={s.ev}>{wsStats.n}</div></div>
                      </div>
                    </div>
                  </div>}

                  {/* Data table */}
                  <div style={{...s.sec,maxHeight:400,overflow:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:T.mf}}>
                      <thead><tr>{wsColumns.map(c=><th key={c} style={{padding:"7px 12px",textAlign:"left",color:T.tm,fontSize:11,borderBottom:`1px solid ${T.bd}`,position:"sticky",top:0,background:T.bs}}>{c}</th>)}</tr></thead>
                      <tbody>{wsData.slice(0,100).map((row,i)=><tr key={i}>{wsColumns.map(c=><td key={c} style={{padding:"6px 12px",borderBottom:`1px solid ${T.bd}`,color:T.tx}}>{String(row[c]??"")}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDCCA"}</div>No data loaded. Compile papers from Literature, or upload data in Field Data tab.</div>
              )}
            </div>
          )}

          {/* ── CITATION GRAPH TAB ── */}
          {tab==="graph" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Citation Network.</b> Select a seed paper from your Library. Explore forward (cited by) and backward (references) citation chains.</div>
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <select style={{...s.fi,flex:1,maxWidth:400}}>
                  <option value="">Select seed paper from Library...</option>
                  {library.map(p=><option key={p.id} value={p.id}>{(p.title||"").slice(0,80)}</option>)}
                </select>
                <button style={s.btOn}>Build Graph</button>
              </div>
              <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:T.tm,fontFamily:T.mf,display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:T.ac,display:"inline-block"}}/>Seed</span>
                <span style={{fontSize:11,color:T.tm,fontFamily:T.mf,display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:T.sg,display:"inline-block"}}/>Forward</span>
                <span style={{fontSize:11,color:T.tm,fontFamily:T.mf,display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:T.lv,display:"inline-block"}}/>Backward</span>
              </div>
              <div style={{background:T.bi,border:`1px solid ${T.bd}`,borderRadius:10,height:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDD78\uFE0F"}</div>Select a seed paper from your Library to build a citation network.</div>
              </div>
            </div>
          )}

          {/* ── GAP ANALYSIS TAB ── */}
          {tab==="gaps" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Gap Analysis.</b> Scans your library for research gaps — weighted by importance. Gaps connect through shared species, regions, and methods.</div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <button style={s.btOn}>Discover Gaps</button>
                <button style={s.btSm}>Contradictions</button>
                <button style={{...s.btSm,color:T.lv,borderColor:"rgba(155,142,196,.3)"}}>Effect Size Calculator</button>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:T.tm,fontFamily:T.mf,textTransform:"uppercase",letterSpacing:.5}}>Visualise:</span>
                <button style={s.btSm}>Temporal Coverage</button>
                <button style={s.btSm}>Sample Size Plot</button>
                <button style={s.btSm}>Keyword Network</button>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:T.tm,fontFamily:T.mf,textTransform:"uppercase",letterSpacing:.5}}>Export:</span>
                <button style={s.btSm}>Evidence Table</button>
                <button style={s.btSm}>PRISMA Flow</button>
                <button style={{...s.btSm,color:T.sg,borderColor:T.sb}}>Generate Report</button>
              </div>
              <div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDD0D"}</div>Click &lsquo;Discover Gaps&rsquo; to scan your library for research gaps. Add papers to your library first.</div>
            </div>
          )}

          {/* ── FIELD DATA TAB ── */}
          {tab==="fielddata" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Field Data Upload.</b> Import CSV or TSV files from your field work. Preview data, then send to the Workshop for analysis and visualization.</div>
              <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
                <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{fontFamily:T.mf,fontSize:12,color:T.ts}}/>
                {fieldData&&<button style={s.btSmOn} onClick={fieldToWorkshop}>Send to Workshop</button>}
              </div>
              {fieldData ? (
                <div>
                  <div style={{fontSize:12,color:T.ac,fontFamily:T.mf,marginBottom:10}}>{fieldData.length} rows, {fieldCols.length} columns: {fieldCols.join(", ")}</div>
                  <div style={{...s.sec,maxHeight:400,overflow:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:T.mf}}>
                      <thead><tr>{fieldCols.map(c=><th key={c} style={{padding:"7px 10px",textAlign:"left",color:T.tm,fontSize:11,borderBottom:`1px solid ${T.bd}`,position:"sticky",top:0,background:T.bs}}>{c}</th>)}</tr></thead>
                      <tbody>{fieldData.slice(0,50).map((row,i)=><tr key={i}>{fieldCols.map(c=><td key={c} style={{padding:"6px 10px",borderBottom:`1px solid ${T.bd}`}}>{String(row[c]??"")}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={s.empty}><div style={s.emptyIcon}>{"\uD83D\uDCC1"}</div>Upload a CSV or TSV file to preview and analyze your field data.</div>
              )}
            </div>
          )}

          {/* ── ECO STATS TAB ── */}
          {tab==="ecostats" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Ecological Statistics.</b> Calculate diversity indices, similarity matrices, and community analysis metrics.</div>
              <div style={s.sec}>
                <div style={s.sh}><h4 style={s.shH4}>Diversity Indices</h4></div>
                <div style={s.sb}>
                  <div style={{marginBottom:10,fontSize:12,color:T.ts,fontFamily:T.mf}}>Enter species abundances (comma or newline separated):</div>
                  <textarea style={{...s.fi,width:"100%",minHeight:80,fontFamily:T.mf}} value={ecoInput} onChange={e=>setEcoInput(e.target.value)} placeholder="e.g. 45, 23, 12, 8, 5, 3, 2, 1, 1"/>
                  <div style={{marginTop:8}}><button style={s.btOn} onClick={calcDiversity}>Calculate</button></div>
                  {ecoResult && (
                    <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10}}>
                      <div style={s.ec}><div style={s.el}>Shannon H&prime;</div><div style={s.ev}>{ecoResult.shannon.toFixed(3)}</div></div>
                      <div style={s.ec}><div style={s.el}>Simpson 1-D</div><div style={s.ev}>{ecoResult.simpson.toFixed(3)}</div></div>
                      <div style={s.ec}><div style={s.el}>Richness (S)</div><div style={s.ev}>{ecoResult.richness}</div></div>
                      <div style={s.ec}><div style={s.el}>Evenness (J&prime;)</div><div style={s.ev}>{ecoResult.evenness.toFixed(3)}</div></div>
                      <div style={s.ec}><div style={s.el}>Margalef</div><div style={s.ev}>{ecoResult.margalef.toFixed(3)}</div></div>
                      <div style={s.ec}><div style={s.el}>Total Individuals</div><div style={s.ev}>{ecoResult.total}</div></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STUDY DESIGN TAB ── */}
          {tab==="studydesign" && (
            <div style={{animation:"fadeIn .35s"}}>
              <div style={s.tip}><b style={{color:T.ac}}>Study Design.</b> Sample size calculators and power analysis for common ecological study designs.</div>
              <div style={s.sec}>
                <div style={s.sh}><h4 style={s.shH4}>Sample Size Calculator (Two-sample t-test)</h4></div>
                <div style={s.sb}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:14}}>
                    <div>
                      <label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>Effect Size (Cohen&rsquo;s d)</label>
                      <input type="number" style={{...s.fi,width:"100%",marginTop:4}} value={sdEffect} onChange={e=>setSdEffect(parseFloat(e.target.value)||0)} step="0.1" min="0.1"/>
                      <div style={{fontSize:10,color:T.tm,fontFamily:T.mf,marginTop:2}}>Small: 0.2 | Medium: 0.5 | Large: 0.8</div>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>Alpha (&alpha;)</label>
                      <select style={{...s.fi,width:"100%",marginTop:4}} value={sdAlpha} onChange={e=>setSdAlpha(parseFloat(e.target.value))}>
                        <option value="0.01">0.01</option><option value="0.05">0.05</option><option value="0.10">0.10</option>
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:T.tm,fontFamily:T.mf}}>Power (1-&beta;)</label>
                      <select style={{...s.fi,width:"100%",marginTop:4}} value={sdPower} onChange={e=>setSdPower(parseFloat(e.target.value))}>
                        <option value="0.7">0.70</option><option value="0.8">0.80</option><option value="0.9">0.90</option><option value="0.95">0.95</option>
                      </select>
                    </div>
                  </div>
                  <button style={s.btOn} onClick={calcSampleSize}>Calculate</button>
                  {sdResult && (
                    <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10}}>
                      <div style={s.ec}><div style={s.el}>Per Group</div><div style={s.ev}>{sdResult.n}</div></div>
                      <div style={s.ec}><div style={s.el}>Total Required</div><div style={s.ev}>{sdResult.totalN}</div></div>
                      <div style={s.ec}><div style={s.el}>Effect Size</div><div style={s.ev}>{sdResult.effect}</div></div>
                      <div style={s.ec}><div style={s.el}>Power</div><div style={s.ev}>{(sdResult.power*100).toFixed(0)}%</div></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ═══ FOOTER ═══ */}
        <footer style={{padding:"12px 30px",textAlign:"center",fontSize:11,color:T.tm,fontFamily:T.mf,borderTop:`1px solid ${T.bd}`}}>
          <span>Meridian Engine</span>
          <span style={{margin:"0 6px"}}>&middot;</span>
          <span>Free &amp; Open</span>
        </footer>

        {/* ═══ TOASTS ═══ */}
        <div style={{position:"fixed",bottom:20,right:20,zIndex:10000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
          {toasts.map(t=>(
            <div key={t.id} style={{
              padding:"12px 20px",borderRadius:8,fontSize:13,fontFamily:T.mf,animation:"fadeIn .3s",maxWidth:400,
              boxShadow:"0 4px 12px rgba(0,0,0,.3)",pointerEvents:"auto",
              background:t.type==="ok"?T.sm:t.type==="err"?T.cm:T.am,
              color:t.type==="ok"?T.sg:t.type==="err"?T.co:T.ac,
              border:`1px solid ${t.type==="ok"?T.sb:t.type==="err"?"rgba(194,120,120,.3)":T.ab}`,
            }}>{t.msg}</div>
          ))}
        </div>
      </div>
    </>
  );
}
