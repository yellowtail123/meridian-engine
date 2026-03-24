// ═══ MERIDIAN BRAIN-MAP — Part 1: Engine Layer ═══
// Data model, extraction, scoring, multi-dimensional graph expansion, progress

/**
 * BrainMap node schema — extends Library paper object
 * @typedef {Object} BMNode
 *
 * Identity (from Library / OpenAlex):
 *   id {string}            — OpenAlex work ID or DOI-based fallback
 *   doi {string}
 *   title {string}
 *   authors {string[]}
 *   year {number}
 *   journal {string}
 *   abstract {string}
 *   citationCount {number}
 *   isOA {boolean}
 *   oaUrl {string}
 *   concepts {Array<{concept:string, score:number}>}  — from OpenAlex
 *
 * Graph role (set during expansion):
 *   isSeed {boolean}
 *   isInLibrary {boolean}
 *   hopDistance {number}   — minimum hops from any seed (seeds = 0)
 *   dominantEdgeType {string}  — edge type with highest strength to any seed
 *
 * Extracted metadata (computed client-side by extraction utilities):
 *   speciesDetected {Array<{name:string, confidence:'high'|'medium'}>}
 *   locationDetected {{lat:number, lon:number, regionName:string,
 *                      confidence:'coordinate'|'named'|'country'|'none'}}
 *   methodsDetected {string[]}
 *   studyDesign {'experimental'|'observational'|'modelling'|'review'|'meta_analysis'|'unknown'}
 *   sampleSizeProxy {number}   — largest n= found in abstract, 0 if none
 *
 * Scores (computed by scoring functions, all 0–1):
 *   scores {{
 *     confidence: number,
 *     application: number,
 *     relevance: number,
 *     recency: number,
 *     openness: number,
 *     costEffectiveness: number,
 *     composite: number
 *   }}
 *
 * D3 simulation state (set by layout engine in Part 2):
 *   x, y, vx, vy, fx, fy {number}
 */

/**
 * @typedef {Object} BMEdge
 *   source {string}    — node id
 *   target {string}    — node id
 *   type {string}      — 'citation_forward' | 'citation_backward' | 'concept' |
 *                        'species' | 'geographic' | 'method'
 *   strength {number}  — 0–1 connection strength
 *   metadata {Object}  — type-specific payload:
 *     citation:   { hopDepth: number }
 *     concept:    { similarity: number, sharedConcept: string }
 *     species:    { sharedSpecies: string[] }
 *     geographic: { distanceKm: number, region: string }
 *     method:     { sharedMethods: string[] }
 */

// ═══ TASK 1 — State Initialisation ═══

window._brainMap = {
  nodes: new Map(),
  edges: [],
  seeds: new Set(),
  layout: 'force',
  edgeFilters: {
    citation: true,
    concept: true,
    species: true,
    geographic: true,
    method: true
  },
  scoreWeights: {
    confidence:      0.30,
    application:     0.25,
    relevance:       0.25,
    recency:         0.15,
    openness:        0.05
  },
  thresholds: {
    minComposite: 0.30,
    maxNodes: 150
  },
  sessionCtx: null,
  mapName: '',
  lastUpdated: null,
  _building: false
};

console.assert(window._brainMap !== undefined, 'Task 1: _brainMap initialised');
console.assert(window._brainMap.nodes instanceof Map, 'Task 1: nodes is a Map');
console.log('Task 1 PASS — _brainMap initialised');

// ═══ TASK 2 — Extraction Utilities ═══

// 2a — Species extraction

const MARINE_COMMON_NAMES = [
  'coral','tuna','cod','salmon','shark','whale','dolphin','lobster',
  'crab','octopus','squid','sea turtle','kelp','seagrass','mangrove',
  'clownfish','sea bass','anchovy','sardine','herring','mackerel','eel',
  'ray','grouper','snapper','manta','dugong','manatee','seal','sea lion',
  'penguin','albatross','plankton','krill','jellyfish','sea urchin',
  'starfish','anemone','sponge','nudibranch','barnacle','mussel','oyster',
  'seabream','halibut','flounder','sprat','pilchard','cuttlefish','abalone'
];

const SPECIES_STOPLIST = [
  'United States','New Zealand','South Africa','North America',
  'South America','West Africa','East Africa','Climate Change',
  'Marine Biology','Sea Level','Ocean Acidification','Sea Surface',
  'Gulf Stream','Deep Sea','High Seas','Open Ocean'
];

function extractSpecies(text) {
  if (!text) return [];
  const results = [];
  const seen = new Set();

  const binomialPattern = /\b([A-Z][a-z]{2,})\s+([a-z]{3,})\b/g;
  let match;
  while ((match = binomialPattern.exec(text)) !== null) {
    const name = match[1] + ' ' + match[2];
    if (!seen.has(name) && !SPECIES_STOPLIST.some(s =>
      name.toLowerCase().includes(s.toLowerCase())
    )) {
      seen.add(name);
      results.push({ name, confidence: 'high' });
    }
  }

  const lowerText = text.toLowerCase();
  MARINE_COMMON_NAMES.forEach(commonName => {
    if (!seen.has(commonName) && lowerText.includes(commonName)) {
      seen.add(commonName);
      results.push({ name: commonName, confidence: 'medium' });
    }
  });

  return results;
}

// 2b — Location extraction

const OCEAN_REGIONS = {
  'Mediterranean Sea':  { lat: 35,   lon: 18   },
  'North Sea':          { lat: 57,   lon: 3    },
  'Baltic Sea':         { lat: 58,   lon: 20   },
  'Caribbean Sea':      { lat: 15,   lon: -75  },
  'Gulf of Mexico':     { lat: 25,   lon: -90  },
  'Red Sea':            { lat: 20,   lon: 38   },
  'Persian Gulf':       { lat: 26,   lon: 52   },
  'Arabian Sea':        { lat: 15,   lon: 65   },
  'Bay of Bengal':      { lat: 15,   lon: 90   },
  'South China Sea':    { lat: 12,   lon: 115  },
  'Coral Sea':          { lat: -18,  lon: 152  },
  'Tasman Sea':         { lat: -38,  lon: 160  },
  'Bering Sea':         { lat: 58,   lon: -175 },
  'Gulf of Alaska':     { lat: 57,   lon: -150 },
  'Beaufort Sea':       { lat: 72,   lon: -140 },
  'Labrador Sea':       { lat: 57,   lon: -55  },
  'North Atlantic':     { lat: 45,   lon: -40  },
  'South Atlantic':     { lat: -30,  lon: -20  },
  'Indian Ocean':       { lat: -20,  lon: 75   },
  'Southern Ocean':     { lat: -60,  lon: 0    },
  'Arctic Ocean':       { lat: 80,   lon: 0    },
  'North Pacific':      { lat: 40,   lon: -160 },
  'South Pacific':      { lat: -30,  lon: -140 },
  'Pacific Ocean':      { lat: 0,    lon: -160 },
  'Atlantic Ocean':     { lat: 10,   lon: -30  },
  'Gulf of California': { lat: 26,   lon: -110 },
  'Adriatic Sea':       { lat: 43,   lon: 16   },
  'Black Sea':          { lat: 43,   lon: 34   },
  'Caspian Sea':        { lat: 42,   lon: 51   },
  'Andaman Sea':        { lat: 12,   lon: 97   },
  'Timor Sea':          { lat: -11,  lon: 127  },
  'Arafura Sea':        { lat: -9,   lon: 135  },
  'Banda Sea':          { lat: -5,   lon: 128  },
  'Celebes Sea':        { lat: 4,    lon: 123  },
  'Sulu Sea':           { lat: 8,    lon: 120  },
  'Java Sea':           { lat: -5,   lon: 110  },
  'Flores Sea':         { lat: -8,   lon: 120  },
  'Scotia Sea':         { lat: -57,  lon: -45  },
  'Weddell Sea':        { lat: -72,  lon: -45  },
  'Ross Sea':           { lat: -75,  lon: 180  },
  'Amundsen Sea':       { lat: -73,  lon: -115 },
  'Chukchi Sea':        { lat: 69,   lon: -168 },
  'East Siberian Sea':  { lat: 73,   lon: 160  },
  'Laptev Sea':         { lat: 76,   lon: 125  },
  'Kara Sea':           { lat: 74,   lon: 65   },
  'Barents Sea':        { lat: 74,   lon: 36   },
  'Norwegian Sea':      { lat: 68,   lon: 5    },
  'Greenland Sea':      { lat: 77,   lon: -5   }
};

function extractLocation(text) {
  if (!text) return { confidence: 'none' };

  // Priority 1: decimal degrees with hemisphere letters
  const decDegPattern = /(-?\d{1,3}\.?\d*)\s*°?\s*([NS])[,\s]+(-?\d{1,3}\.?\d*)\s*°?\s*([EW])/i;
  const m1 = text.match(decDegPattern);
  if (m1) {
    let lat = parseFloat(m1[1]) * (m1[2].toUpperCase() === 'S' ? -1 : 1);
    let lon = parseFloat(m1[3]) * (m1[4].toUpperCase() === 'W' ? -1 : 1);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon, regionName: nearestOceanRegion(lat, lon), confidence: 'coordinate' };
    }
  }

  // Priority 2: degree-minute-second
  const dmsPattern = /(\d{1,3})°(\d{1,2})['′]\s*([NS])[,\s]+(\d{1,3})°(\d{1,2})['′]\s*([EW])/i;
  const m2 = text.match(dmsPattern);
  if (m2) {
    let lat = parseInt(m2[1]) + parseInt(m2[2]) / 60;
    let lon = parseInt(m2[4]) + parseInt(m2[5]) / 60;
    if (m2[3].toUpperCase() === 'S') lat = -lat;
    if (m2[6].toUpperCase() === 'W') lon = -lon;
    return { lat, lon, regionName: nearestOceanRegion(lat, lon), confidence: 'coordinate' };
  }

  // Priority 3: named ocean regions (longest match wins)
  const sortedRegions = Object.keys(OCEAN_REGIONS).sort((a, b) => b.length - a.length);
  for (const region of sortedRegions) {
    if (text.includes(region)) {
      const { lat, lon } = OCEAN_REGIONS[region];
      return { lat, lon, regionName: region, confidence: 'named' };
    }
  }

  return { confidence: 'none' };
}

function nearestOceanRegion(lat, lon) {
  let best = '', bestDist = Infinity;
  for (const [name, coords] of Object.entries(OCEAN_REGIONS)) {
    const d = Math.sqrt((lat - coords.lat) ** 2 + (lon - coords.lon) ** 2);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

function haversineKm(locA, locB) {
  const R = 6371;
  const dLat = (locB.lat - locA.lat) * Math.PI / 180;
  const dLon = (locB.lon - locA.lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(locA.lat * Math.PI / 180) *
    Math.cos(locB.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 2c — Methods extraction

const METHODS_VOCAB = [
  'trawl survey','beam trawl','otter trawl','acoustic survey','hydroacoustic',
  'echo sounder','CPUE','LPUE','mark-recapture','mark-release-recapture',
  'transect','belt transect','point count','manta tow','tow-board',
  'underwater visual census','UVC','BRUVS','baited camera','drop camera',
  'video transect','photo-quadrat','quadrat survey','line intercept',
  'acoustic telemetry','satellite tag','pop-up archival tag','PSAT',
  'data storage tag','DST','acoustic tag','VHF tag','Argos','archival tag',
  'dart tag','anchor tag','floy tag','PIT tag','passive integrated transponder',
  'otolith','age determination','scale reading','vertebra','spine',
  'stable isotope','δ13C','δ15N','trace element','otolith chemistry',
  'genetics','microsatellite','SNP','RADseq','genotyping','DNA barcoding',
  'eDNA','metabarcoding','amplicon sequencing','DADA2','QIIME','metagenomics',
  'histology','biopsied','biopsy','stomach content','gut content','diet analysis',
  'CTD','conductivity temperature depth','ADCP','current profiler',
  'Argo float','mooring','sediment core','box core','grab sample',
  'water sample','niskin bottle','secchi disk','light attenuation',
  'stock assessment','surplus production','VPA','virtual population analysis',
  'age-structured','Bayesian','hierarchical model','GLM','GLMM',
  'GAM','generalised additive','species distribution model','SDM',
  'MaxEnt','habitat model','bioenergetics','individual-based model','IBM',
  'ocean model','hydrodynamic model','particle tracking','ROMS','NEMO',
  'mark-recapture model','Cormack-Jolly-Seber','CJS','Jolly-Seber',
  'satellite imagery','Landsat','Sentinel','MODIS','chlorophyll satellite',
  'SST satellite','bathymetry','multibeam','side-scan sonar','LiDAR','drone survey',
  'mesocosm','aquarium','laboratory experiment','field experiment',
  'transplant experiment','caging experiment','exclusion experiment',
  'SIBER','MixSIAR','mixing model','isotope mixing','population genetics',
  'connectivity','larval dispersal','biophysical model','larval tracking',
  'fisheries independent','research vessel survey','bottom trawl survey',
  'longline survey','hook and line'
];

function extractMethods(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return METHODS_VOCAB.filter(m => lower.includes(m.toLowerCase()));
}

// 2d — Study design classification

function classifyStudyDesign(abstract) {
  if (!abstract) return 'unknown';
  const text = abstract.toLowerCase();

  const SIGNALS = {
    meta_analysis: [
      'meta-analysis','meta analysis','pooled effect','effect size',
      'heterogeneity I²','funnel plot','forest plot','systematic review and meta'
    ],
    review: [
      'systematic review','literature review','narrative review',
      'we reviewed','this review','review of the literature',
      'we synthesised','evidence synthesis'
    ],
    experimental: [
      'manipulative experiment','randomised','randomly assigned','treatment group',
      'control group','mesocosm experiment','laboratory experiment',
      'field experiment','we manipulated','we experimentally'
    ],
    modelling: [
      'we modelled','simulation','simulated','projected','scenario analysis',
      'model output','parameterised','calibrated model','we developed a model',
      'individual-based model','biophysical model','hydrodynamic'
    ],
    observational: [
      'we surveyed','we monitored','we sampled','we observed','we recorded',
      'field survey','monitoring programme','occurrence data',
      'abundance estimate','distribution survey'
    ]
  };

  const scores = {};
  for (const [design, keywords] of Object.entries(SIGNALS)) {
    scores[design] = keywords.filter(kw => text.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'unknown';
}

// 2e — Sample size extraction

function extractSampleSize(abstract) {
  if (!abstract) return 0;
  const patterns = [
    /\bn\s*=\s*(\d+)/i,
    /sample\s+size\s+of\s+(\d+)/i,
    /(\d+)\s+individuals/i,
    /(\d+)\s+specimens/i,
    /(\d+)\s+fish\b/i,
    /(\d+)\s+samples/i,
    /(\d+)\s+sites/i,
    /(\d+)\s+stations/i,
    /(\d+)\s+observations/i,
    /(\d+)\s+records/i,
    /(\d+)\s+occurrences/i
  ];
  const found = [];
  for (const pattern of patterns) {
    const m = abstract.match(pattern);
    if (m) {
      const n = parseInt(m[1]);
      if (n > 1 && n <= 1000000) found.push(n);
    }
  }
  return found.length > 0 ? Math.max(...found) : 0;
}

// 2f — Enrich a node with all extracted metadata

function enrichNodeMetadata(node) {
  const text = [node.title || '', node.abstract || ''].join(' ');
  node.speciesDetected  = extractSpecies(text);
  node.locationDetected = extractLocation(text);
  node.methodsDetected  = extractMethods(text);
  node.studyDesign      = classifyStudyDesign(node.abstract || '');
  node.sampleSizeProxy  = extractSampleSize(node.abstract || '');
  return node;
}

// Console checkpoint — Task 2
const _bmTestAbstract = 'We surveyed Thunnus thynnus populations in the Mediterranean Sea (36°N, 15°E) using acoustic telemetry (n=45). Bayesian stock assessment models were applied to CPUE data from 2010–2022.';
console.assert(extractSpecies(_bmTestAbstract).some(s => s.name.includes('Thunnus')), 'Task 2a PASS');
console.assert(extractLocation(_bmTestAbstract).confidence === 'coordinate', 'Task 2b PASS');
console.assert(extractMethods(_bmTestAbstract).includes('acoustic telemetry'), 'Task 2c PASS');
console.assert(classifyStudyDesign(_bmTestAbstract) === 'observational', 'Task 2d PASS');
console.assert(extractSampleSize(_bmTestAbstract) === 45, 'Task 2e PASS');
console.log('Task 2 PASS — extraction utilities working');

// ═══ TASK 3 — Scoring System ═══

// 3a — Build session context

async function buildBMSessionContext() {
  // Library papers from in-memory state (loaded at startup via loadLib → dbAll)
  const libraryPapers = S.lib || [];

  const libraryConcepts = libraryPapers
    .filter(p => p.concepts && p.concepts.length > 0)
    .map(p => p.concepts);

  // Last search query — check in-memory var first, then localStorage history
  const lastQuery = (function() {
    try {
      if (typeof _litQuery === 'string' && _litQuery) return _litQuery;
      const hist = safeParse('meridian_search_hist', []);
      if (hist.length) return hist[0];
      const el = document.getElementById('lq');
      return el?.value || '';
    } catch { return ''; }
  })();

  // Last species lookup — window._sp.sciName
  const lastSpecies = (function() {
    try {
      if (window._sp?.sciName) return window._sp.sciName;
      const sp = JSON.parse(sessionStorage.getItem('meridian_sp') || 'null');
      return sp?.sciName || '';
    } catch { return ''; }
  })();

  // Last env fetch location — read from DOM inputs
  const lastLocation = (function() {
    try {
      const lat = parseFloat(document.getElementById('elat')?.value);
      const lon = parseFloat(document.getElementById('elon')?.value);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    } catch {}
    return null;
  })();

  return { libraryConcepts, lastQuery, lastSpecies, lastLocation, libraryPapers };
}

// 3b — Concept vector cosine similarity

function conceptCosineSim(vecA, vecB) {
  if (!vecA?.length || !vecB?.length) return 0;
  const mapA = new Map(vecA.map(c => [c.concept, c.score]));
  const mapB = new Map(vecB.map(c => [c.concept, c.score]));
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const a = mapA.get(k) || 0;
    const b = mapB.get(k) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  return (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// 3c — Confidence score

function scoreConfidence(node, fieldStats) {
  const p95 = fieldStats?.p95citations || 500;
  const citScore = Math.min(1, Math.log(Math.max(1, node.citationCount || 0) + 1) /
                               Math.log(p95 + 1));

  const journalName = (node.journal || '').toLowerCase();
  const isHighImpact = ['nature', 'science ', 'proceedings', 'pnas', 'cell ',
    'current biology', 'global change', 'ecology letters',
    'fish and fisheries', 'journal of ecology'].some(kw => journalName.includes(kw));
  const journalScore = isHighImpact ? 1.0 : 0.6;

  const designScore = {
    meta_analysis: 1.0, experimental: 0.95, review: 0.8,
    observational: 0.65, modelling: 0.55, unknown: 0.45
  }[node.studyDesign || 'unknown'];

  const sampleScore = node.sampleSizeProxy > 0
    ? Math.min(1, Math.log(node.sampleSizeProxy + 1) / Math.log(1001))
    : 0.3;

  return Math.min(1, Math.max(0,
    0.35 * citScore +
    0.25 * journalScore +
    0.25 * designScore +
    0.15 * sampleScore
  ));
}

// 3d — Application score

const APPLICATION_KEYWORDS = [
  'management','conservation','fisheries management','stock management',
  'marine protected area','MPA','no-take zone','bycatch reduction',
  'sustainable harvest','ecosystem services','ecosystem-based management',
  'EBM','restoration','habitat restoration','coral restoration',
  'policy','legislation','regulation','quota','total allowable catch','TAC',
  'marine spatial planning','MSP','environmental impact','impact assessment',
  'recommendations','management implications','conservation implications',
  'actionable','guidelines','best practice','monitoring programme',
  'status assessment','threat assessment','IUCN','critically endangered',
  'vulnerable','population recovery','endangered','recovery plan',
  'ecosystem approach','adaptive management','precautionary','reference point',
  'harvest control rule','overfishing','maximum sustainable yield','MSY',
  'stock rebuilding','bycatch','incidental catch','discards'
];

function scoreApplication(node) {
  const text = ((node.title || '') + ' ' + (node.abstract || '')).toLowerCase();
  const hits = APPLICATION_KEYWORDS.filter(kw => text.includes(kw.toLowerCase())).length;
  const keywordScore = Math.min(1, hits / 5);

  const appliedJournalTerms = [
    'fisheries','conservation','management','aquaculture',
    'resources','policy','applied','sustainability'
  ];
  const journalIsApplied = appliedJournalTerms.some(w =>
    (node.journal || '').toLowerCase().includes(w)
  );

  return Math.min(1, Math.max(0, 0.65 * keywordScore + 0.35 * (journalIsApplied ? 0.85 : 0.3)));
}

// 3e — Relevance score

function scoreRelevance(node, sessionCtx) {
  if (!sessionCtx) return 0.5;

  let conceptScore = 0.5;
  if (sessionCtx.libraryConcepts?.length > 0 && node.concepts?.length > 0) {
    const sims = sessionCtx.libraryConcepts.map(lc => conceptCosineSim(node.concepts, lc));
    conceptScore = sims.reduce((a, b) => a + b, 0) / sims.length;
  }

  let speciesScore = 0.5;
  if (sessionCtx.lastSpecies && node.speciesDetected?.length > 0) {
    const lowerQuery = sessionCtx.lastSpecies.toLowerCase();
    speciesScore = node.speciesDetected.some(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      lowerQuery.includes(s.name.toLowerCase())
    ) ? 1.0 : 0.15;
  }

  let geoScore = 0.5;
  if (sessionCtx.lastLocation &&
      node.locationDetected?.confidence !== 'none' &&
      node.locationDetected?.lat !== undefined) {
    const distKm = haversineKm(sessionCtx.lastLocation, node.locationDetected);
    geoScore = Math.max(0, 1 - distKm / 4000);
  }

  let queryScore = 0.5;
  if (sessionCtx.lastQuery) {
    const words = sessionCtx.lastQuery.toLowerCase()
      .split(/\s+/).filter(w => w.length > 3);
    const nodeText = ((node.title || '') + ' ' + (node.abstract || '')).toLowerCase();
    const matched = words.filter(w => nodeText.includes(w)).length;
    queryScore = words.length > 0 ? Math.min(1, matched / Math.max(1, words.length * 0.6)) : 0.5;
  }

  return Math.min(1, Math.max(0,
    0.40 * conceptScore +
    0.30 * speciesScore +
    0.20 * geoScore +
    0.10 * queryScore
  ));
}

// 3f — Recency score

function scoreRecency(node, allNodes) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - (node.year || currentYear - 5));
  const lambda = 0.12;
  const baseScore = Math.exp(-lambda * age);

  if (allNodes && allNodes.length > 0) {
    const sorted = [...allNodes]
      .filter(n => n.citationCount !== undefined)
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    const p95idx = Math.max(0, Math.floor(sorted.length * 0.05) - 1);
    const p95threshold = sorted[p95idx]?.citationCount || 500;
    if ((node.citationCount || 0) >= p95threshold) {
      return Math.max(0.4, baseScore);
    }
  }

  return Math.min(1, Math.max(0, baseScore));
}

// 3g — Openness score

function scoreOpenness(node) {
  const oaScore = node.isOA ? (node.oaUrl ? 1.0 : 0.65) : 0.0;

  const text = ((node.abstract || '') + ' ' + (node.title || '')).toLowerCase();

  const dataSignals = [
    'data available','data are available','data is available',
    'dryad','zenodo','figshare','pangaea','gbif.org','obis.org',
    'supplementary data','supplementary material','data accessibility statement',
    'data deposit','data archive','open data'
  ];
  const dataAvail = dataSignals.some(kw => text.includes(kw)) ? 1.0 : 0.0;

  const codeSignals = [
    'github','gitlab','code available','scripts available','code is available',
    'analysis code','r package','python package','supplementary code'
  ];
  const codeAvail = codeSignals.some(kw => text.includes(kw)) ? 1.0 : 0.0;

  const methodsDetail = Math.min(1, (node.abstract?.length || 0) / 2000);

  return Math.min(1, Math.max(0,
    0.45 * oaScore +
    0.30 * dataAvail +
    0.15 * codeAvail +
    0.10 * methodsDetail
  ));
}

// 3h — Cost-effectiveness score

function scoreCostEffectiveness(node) {
  const nMethods = node.methodsDetected?.length || 0;
  const methodSimplicity = nMethods === 0 ? 0.5 :
                           nMethods <= 2  ? 1.0 :
                           nMethods <= 4  ? 0.70 : 0.40;

  const text = (node.abstract || '').toLowerCase();
  const resultWords = ['found','demonstrated','showed','revealed','confirmed',
    'detected','estimated','measured','observed','recorded'];
  const uncertaintyWords = ['unclear','uncertain','further research needed',
    'inconclusive','insufficient data','limited by','requires further study'];
  const resultHits      = resultWords.filter(w => text.includes(w)).length;
  const uncertaintyHits = uncertaintyWords.filter(w => text.includes(w)).length;
  const clarity = Math.min(1, resultHits / 4) * (1 - Math.min(0.5, uncertaintyHits / 3));

  const specialistTerms = [
    'synchrotron','proteomics','transcriptomics','metabolomics',
    'cryo-electron','NMR spectroscopy','mass spectrometry',
    'research vessel cruise','deep-sea submersible','remotely operated vehicle'
  ];
  const isSpecialist = specialistTerms.some(t => text.includes(t));

  return Math.min(1, Math.max(0,
    0.40 * methodSimplicity +
    0.35 * clarity +
    0.25 * (isSpecialist ? 0.25 : 0.85)
  ));
}

// 3i — Compute composite and stamp all scores

function computeAllScores(node, sessionCtx, fieldStats, allNodes) {
  enrichNodeMetadata(node);

  node.scores = {
    confidence:        scoreConfidence(node, fieldStats),
    application:       scoreApplication(node),
    relevance:         scoreRelevance(node, sessionCtx),
    recency:           scoreRecency(node, allNodes),
    openness:          scoreOpenness(node),
    costEffectiveness: scoreCostEffectiveness(node),
    composite: 0
  };

  const w = window._brainMap.scoreWeights;
  node.scores.composite = Math.min(1, Math.max(0,
    w.confidence  * node.scores.confidence +
    w.application * node.scores.application +
    w.relevance   * node.scores.relevance +
    w.recency     * node.scores.recency +
    w.openness    * node.scores.openness
  ));

  return node;
}

function computeFieldStats(nodes) {
  const citations = [...nodes.values()]
    .map(n => n.citationCount || 0)
    .sort((a, b) => a - b);
  const p95idx = Math.max(0, Math.floor(citations.length * 0.95) - 1);
  return { p95citations: citations[p95idx] || 100 };
}

async function scoreAllNodes() {
  updateProgress('scoring', 'Computing scores...');
  const sessionCtx = await buildBMSessionContext();
  window._brainMap.sessionCtx = sessionCtx;
  const fieldStats = computeFieldStats(window._brainMap.nodes);
  const allNodes = [...window._brainMap.nodes.values()];

  for (const node of allNodes) {
    computeAllScores(node, sessionCtx, fieldStats, allNodes);
  }

  // Stamp dominant edge type
  for (const node of allNodes) {
    const nodeEdges = window._brainMap.edges.filter(
      e => e.source === node.id || e.target === node.id
    );
    if (nodeEdges.length > 0) {
      const best = nodeEdges.reduce((a, b) => a.strength > b.strength ? a : b);
      node.dominantEdgeType = best.type.split('_')[0];
    }
  }

  updateProgress('scoring', 'Done — ' + allNodes.length + ' nodes scored');
}

// Console checkpoint — Task 3
(function _bmTask3Test() {
  const testNode = {
    id: 'test-1', title: 'Coral reef fish abundance in the Mediterranean Sea',
    abstract: 'We surveyed Diplodus sargus populations using UVC transects (n=120) across 8 MPAs. Management implications for no-take zones are discussed. Data available on GBIF.',
    year: 2021, journal: 'Marine Policy', citationCount: 45, isOA: true,
    oaUrl: 'https://example.com', concepts: [{concept:'marine conservation', score:0.9}]
  };
  enrichNodeMetadata(testNode);
  const ctx = { libraryConcepts: [], lastQuery: 'coral fish survey', lastSpecies: 'Diplodus', lastLocation: {lat:36,lon:14} };
  const stats = { p95citations: 200 };
  computeAllScores(testNode, ctx, stats, [testNode]);
  console.assert(testNode.scores.confidence >= 0 && testNode.scores.confidence <= 1, 'Task 3: confidence in range');
  console.assert(testNode.scores.application > 0.5, 'Task 3: application detects management keywords');
  console.assert(testNode.scores.openness > 0.5, 'Task 3: openness detects GBIF + OA');
  console.assert(testNode.scores.composite >= 0 && testNode.scores.composite <= 1, 'Task 3: composite in range');
  console.log('Task 3 PASS — scoring system working. Scores:', JSON.stringify(testNode.scores, null, 2));
})();

// ═══ TASK 4 — Multi-dimensional Graph Expansion ═══

// 4a — Add node / edge helpers

function bmAddNode(paperObj, hopDistance) {
  const id = paperObj.id || paperObj.doi;
  if (!id) return null;
  if (!window._brainMap.nodes.has(id)) {
    window._brainMap.nodes.set(id, {
      ...paperObj,
      id,
      isSeed: false,
      hopDistance,
      isInLibrary: (S.lib || []).some(x => x.id === id || x.doi === id),
      speciesDetected: [],
      locationDetected: { confidence: 'none' },
      methodsDetected: [],
      studyDesign: 'unknown',
      sampleSizeProxy: 0,
      scores: { confidence:0, application:0, relevance:0.5, recency:0.5, openness:0, costEffectiveness:0, composite:0 }
    });
  } else {
    // Update hop distance if shorter path found
    const existing = window._brainMap.nodes.get(id);
    if (hopDistance < existing.hopDistance) existing.hopDistance = hopDistance;
  }
  return window._brainMap.nodes.get(id);
}

function bmAddEdge(sourceId, targetId, type, strength, metadata = {}) {
  const exists = window._brainMap.edges.some(
    e => e.source === sourceId && e.target === targetId && e.type === type
  );
  if (!exists && sourceId !== targetId) {
    window._brainMap.edges.push({ source: sourceId, target: targetId, type, strength, metadata });
  }
}

// 4b — OpenAlex fetch helpers (reuse existing _oaGet infrastructure)

async function bmFetchWork(workId) {
  // workId may be full URL or bare ID (W...)
  const cleanId = workId.replace('https://openalex.org/', '');
  const d = await _oaGet('/works/' + cleanId + '?select=id,doi,display_name,authorships,publication_year,primary_location,cited_by_count,open_access,abstract_inverted_index,concepts,referenced_works');
  return d ? bmNormalise(d) : null;
}

async function bmFetchByQuery(query, perPage = 25) {
  const d = await _oaGet('/works?search=' + encodeURIComponent(query)
    + '&per_page=' + perPage
    + '&select=id,doi,display_name,authorships,publication_year,primary_location,cited_by_count,open_access,abstract_inverted_index,concepts,referenced_works');
  return (d?.results || []).map(bmNormalise).filter(Boolean);
}

function bmNormalise(w) {
  if (!w?.id) return null;
  const id = w.id.replace('https://openalex.org/', '');

  // Reconstruct abstract using existing recAbs() from meridian-core.js
  const abstract = (typeof recAbs === 'function')
    ? recAbs(w.abstract_inverted_index)
    : null;

  // Map authorships to flat name array
  const authors = (w.authorships || []).slice(0, 20).map(a => a.author?.display_name || 'Unknown');

  // Map concepts to {concept, score} array
  const concepts = (w.concepts || []).map(c => ({
    concept: c.display_name || '',
    score: c.score || 0
  })).filter(c => c.concept && c.score > 0.2);

  return {
    id,
    doi: w.doi || null,
    title: w.display_name || '',
    authors,
    year: w.publication_year || null,
    journal: w.primary_location?.source?.display_name || '',
    abstract,
    citationCount: w.cited_by_count || 0,
    isOA: w.open_access?.is_oa || false,
    oaUrl: w.open_access?.oa_url || null,
    concepts,
    referenced_works: (w.referenced_works || []).map(r => r.replace('https://openalex.org/', ''))
  };
}

// 4c — Citation expansion

async function expandCitation(seedIds, hops) {
  updateProgress('citation', 'Fetching citation network...');
  let count = 0;

  for (const seedId of seedIds) {
    try {
      const seedNode = window._brainMap.nodes.get(seedId);

      // Backward: references of this paper
      const refIds = seedNode?.referenced_works || [];
      if (refIds.length) {
        // Batch-fetch references (up to 30) via filter — single API call
        const batch = refIds.slice(0, 30);
        const d = await _oaGet('/works?filter=openalex:' + batch.join('|')
          + '&per_page=50&select=id,doi,display_name,authorships,publication_year,primary_location,cited_by_count,open_access,abstract_inverted_index,concepts,referenced_works');
        for (const w of (d?.results || [])) {
          const norm = bmNormalise(w);
          if (norm) {
            bmAddNode(norm, 1);
            bmAddEdge(seedId, norm.id, 'citation_backward', 0.75, { hopDepth: 1 });
            count++;
          }
        }
      }

      // Forward: papers that cite this seed
      const citingData = await _oaGet('/works?filter=cites:' + seedId
        + '&per_page=25&sort=cited_by_count:desc'
        + '&select=id,doi,display_name,authorships,publication_year,primary_location,cited_by_count,open_access,abstract_inverted_index,concepts,referenced_works');
      for (const w of (citingData?.results || []).slice(0, 25)) {
        const norm = bmNormalise(w);
        if (norm) {
          bmAddNode(norm, 1);
          bmAddEdge(norm.id, seedId, 'citation_forward', 0.80, { hopDepth: 1 });
          count++;
        }
      }

      updateProgress('citation', count + ' papers found via citations...');

      // Depth 2 if requested
      if (hops >= 2) {
        const tier1 = [...window._brainMap.nodes.values()]
          .filter(n => !n.isSeed && n.hopDistance === 1)
          .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
          .slice(0, 5);

        for (const t1node of tier1) {
          const refs2 = t1node.referenced_works || [];
          if (refs2.length) {
            const batch2 = refs2.slice(0, 15);
            const d2 = await _oaGet('/works?filter=openalex:' + batch2.join('|')
              + '&per_page=50&select=id,doi,display_name,authorships,publication_year,primary_location,cited_by_count,open_access,abstract_inverted_index,concepts,referenced_works');
            for (const w of (d2?.results || [])) {
              const norm = bmNormalise(w);
              if (norm) {
                bmAddNode(norm, 2);
                bmAddEdge(t1node.id, norm.id, 'citation_backward', 0.55, { hopDepth: 2 });
                count++;
              }
            }
          }
        }
      }

    } catch (err) {
      console.warn('expandCitation error for seed', seedId, err);
    }
  }

  updateProgress('citation', 'Done — ' + count + ' papers via citations');
}

// 4d — Concept similarity expansion

async function expandConcept(seedIds) {
  updateProgress('concept', 'Finding conceptually similar papers...');
  let count = 0;

  const conceptFreq = {};
  for (const seedId of seedIds) {
    const node = window._brainMap.nodes.get(seedId);
    (node?.concepts || []).forEach(c => {
      conceptFreq[c.concept] = (conceptFreq[c.concept] || 0) + (c.score || 0.5);
    });
  }

  const topConcepts = Object.entries(conceptFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([concept]) => concept);

  for (const concept of topConcepts) {
    try {
      const works = await bmFetchByQuery(concept + ' marine', 20);
      for (const w of works) {
        if (window._brainMap.nodes.has(w.id)) continue;
        const sim = Math.max(...seedIds.map(sid => {
          const seed = window._brainMap.nodes.get(sid);
          return conceptCosineSim(seed?.concepts || [], w.concepts || []);
        }));
        if (sim > 0.25) {
          bmAddNode(w, 1);
          const bestSeed = seedIds.reduce((best, sid) => {
            const s = conceptCosineSim(window._brainMap.nodes.get(sid)?.concepts || [], w.concepts || []);
            return s > best.sim ? { sid, sim: s } : best;
          }, { sid: seedIds[0], sim: 0 });
          bmAddEdge(bestSeed.sid, w.id, 'concept', sim, { similarity: sim, sharedConcept: concept });
          count++;
        }
      }
    } catch (err) {
      console.warn('expandConcept error for concept', concept, err);
    }
  }

  updateProgress('concept', 'Done — ' + count + ' papers via concept similarity');
}

// 4e — Species overlap expansion

async function expandSpecies(seedIds) {
  updateProgress('species', 'Finding papers on same species...');
  let count = 0;

  const allSpecies = new Set();
  for (const seedId of seedIds) {
    const node = window._brainMap.nodes.get(seedId);
    const text = (node?.title || '') + ' ' + (node?.abstract || '');
    extractSpecies(text).forEach(s => allSpecies.add(s.name));
  }

  if (allSpecies.size === 0) {
    updateProgress('species', 'No species detected in seed papers');
    return;
  }

  for (const species of [...allSpecies].slice(0, 5)) {
    try {
      const works = await bmFetchByQuery(species + ' marine', 20);
      for (const w of works) {
        if (window._brainMap.nodes.has(w.id)) continue;
        const wText = (w.title || '') + ' ' + (w.abstract || '');
        const wSpecies = extractSpecies(wText).map(s => s.name.toLowerCase());
        const shared = [...allSpecies].filter(s => wSpecies.includes(s.toLowerCase()));
        if (shared.length > 0) {
          bmAddNode(w, 1);
          const strength = Math.min(1, 0.6 + 0.2 * shared.length);
          seedIds.forEach(seedId => {
            bmAddEdge(seedId, w.id, 'species', strength, { sharedSpecies: shared });
          });
          count++;
        }
      }
    } catch (err) {
      console.warn('expandSpecies error for', species, err);
    }
  }

  updateProgress('species', 'Done — ' + count + ' papers via species overlap');
}

// 4f — Geographic proximity expansion

async function expandGeographic(seedIds) {
  updateProgress('geographic', 'Finding papers from same region...');
  let count = 0;

  const seedLocations = seedIds
    .map(id => window._brainMap.nodes.get(id))
    .map(n => extractLocation((n?.title || '') + ' ' + (n?.abstract || '')))
    .filter(l => l.confidence !== 'none');

  if (seedLocations.length === 0) {
    updateProgress('geographic', 'No locations detected in seed papers');
    return;
  }

  for (const loc of seedLocations.slice(0, 3)) {
    try {
      const query = loc.regionName || ('ocean ' + loc.lat.toFixed(0) + 'N ' + Math.abs(loc.lon).toFixed(0) + (loc.lon < 0 ? 'W' : 'E'));
      const works = await bmFetchByQuery(query, 20);
      for (const w of works) {
        if (window._brainMap.nodes.has(w.id)) continue;
        const wLoc = extractLocation((w.title || '') + ' ' + (w.abstract || ''));
        if (wLoc.confidence === 'none') continue;
        const distKm = haversineKm(loc, wLoc);
        if (distKm < 2000) {
          bmAddNode(w, 1);
          const strength = Math.max(0.2, 1 - distKm / 2000);
          seedIds.forEach(seedId => {
            bmAddEdge(seedId, w.id, 'geographic', strength,
              { distanceKm: Math.round(distKm), region: wLoc.regionName });
          });
          count++;
        }
      }
    } catch (err) {
      console.warn('expandGeographic error', err);
    }
  }

  updateProgress('geographic', 'Done — ' + count + ' papers via geographic proximity');
}

// 4g — Method similarity expansion

async function expandMethod(seedIds) {
  updateProgress('method', 'Finding papers using same methods...');
  let count = 0;

  const seedMethods = new Set();
  for (const seedId of seedIds) {
    const node = window._brainMap.nodes.get(seedId);
    extractMethods((node?.title || '') + ' ' + (node?.abstract || ''))
      .forEach(m => seedMethods.add(m));
  }

  if (seedMethods.size === 0) {
    updateProgress('method', 'No methods detected in seed papers');
    return;
  }

  for (const method of [...seedMethods].slice(0, 4)) {
    try {
      const works = await bmFetchByQuery(method + ' marine ecology', 20);
      for (const w of works) {
        if (window._brainMap.nodes.has(w.id)) continue;
        const wMethods = extractMethods((w.title || '') + ' ' + (w.abstract || ''));
        const shared = wMethods.filter(m => seedMethods.has(m));
        if (shared.length >= 1) {
          bmAddNode(w, 1);
          const strength = Math.min(1, 0.45 + 0.2 * shared.length);
          for (const seedId of seedIds) {
            const seedMeth = extractMethods(
              (window._brainMap.nodes.get(seedId)?.title || '') + ' ' +
              (window._brainMap.nodes.get(seedId)?.abstract || '')
            );
            const seedShared = shared.filter(m => seedMeth.includes(m));
            if (seedShared.length > 0) {
              bmAddEdge(seedId, w.id, 'method', strength, { sharedMethods: seedShared });
            }
          }
          count++;
        }
      }
    } catch (err) {
      console.warn('expandMethod error for', method, err);
    }
  }

  updateProgress('method', 'Done — ' + count + ' papers via method similarity');
}

// 4h — Prune to node limit

function pruneToLimit(maxNodes) {
  const nodes = [...window._brainMap.nodes.values()];
  if (nodes.length <= maxNodes) return;

  const nonSeeds = nodes.filter(n => !n.isSeed)
    .sort((a, b) => (b.scores?.composite || 0) - (a.scores?.composite || 0));

  const keepIds = new Set([
    ...window._brainMap.seeds,
    ...nonSeeds.slice(0, maxNodes - window._brainMap.seeds.size).map(n => n.id)
  ]);

  for (const id of [...window._brainMap.nodes.keys()]) {
    if (!keepIds.has(id)) window._brainMap.nodes.delete(id);
  }

  window._brainMap.edges = window._brainMap.edges.filter(
    e => keepIds.has(e.source) && keepIds.has(e.target)
  );
}

// 4i — Main orchestrator

async function buildBrainMap(seedIds, options = {}) {
  if (window._brainMap._building) {
    console.warn('buildBrainMap: already running');
    return;
  }
  if (!seedIds || seedIds.length === 0) {
    toast('Select at least one seed paper from your Library first.', 'err');
    return;
  }

  window._brainMap._building = true;
  showBrainMapProgress();

  // Reset state
  window._brainMap.nodes.clear();
  window._brainMap.edges = [];
  window._brainMap.seeds = new Set(seedIds);

  const hops     = options.hops     || parseInt(document.getElementById('bm-hops')?.value) || 2;
  const maxNodes = options.maxNodes || window._brainMap.thresholds.maxNodes;
  const filters  = window._brainMap.edgeFilters;

  try {
    // 1. Seed initialisation — load from Library
    updateProgress('scoring', 'Loading seed papers...');
    for (const seedId of seedIds) {
      const paper = (S.lib || []).find(x => x.id === seedId);
      if (paper) {
        // If paper lacks OpenAlex fields, try to enrich
        let enriched = paper;
        if (!paper.concepts?.length && paper.doi) {
          const oa = await bmFetchWork(paper.doi.replace(/^https?:\/\/doi\.org\//, ''));
          if (oa) enriched = { ...paper, ...oa, id: paper.id };
        }
        const node = bmAddNode(enriched, 0);
        if (node) { node.isSeed = true; node.isInLibrary = true; }
      }
    }

    // 2. Parallel multi-dimensional expansion
    const expansions = [];
    if (filters.citation)   expansions.push(expandCitation(seedIds, hops));
    if (filters.concept)    expansions.push(expandConcept(seedIds));
    if (filters.species)    expansions.push(expandSpecies(seedIds));
    if (filters.geographic) expansions.push(expandGeographic(seedIds));
    if (filters.method)     expansions.push(expandMethod(seedIds));

    await Promise.allSettled(expansions);

    // 3. Score all nodes
    await scoreAllNodes();

    // 4. Apply minimum composite threshold
    const minScore = window._brainMap.thresholds.minComposite;
    for (const [id, node] of window._brainMap.nodes) {
      if (!node.isSeed && (node.scores?.composite || 0) < minScore) {
        window._brainMap.nodes.delete(id);
      }
    }

    // 5. Prune to node limit
    pruneToLimit(maxNodes);

    // 6. Clean up edges referencing pruned nodes
    const validIds = new Set(window._brainMap.nodes.keys());
    window._brainMap.edges = window._brainMap.edges.filter(
      e => validIds.has(e.source) && validIds.has(e.target)
    );

    window._brainMap.lastUpdated = new Date().toISOString();
    console.log('buildBrainMap complete: ' + window._brainMap.nodes.size + ' nodes, ' + window._brainMap.edges.length + ' edges');
    toast('Brain Map built — ' + window._brainMap.nodes.size + ' papers, ' + window._brainMap.edges.length + ' connections', 'ok');

    // 7. Trigger render (Part 2 will implement these)
    if (typeof renderBrainMap === 'function') renderBrainMap();
    if (typeof updateRecommendationPanel === 'function') updateRecommendationPanel();

  } catch (err) {
    console.error('buildBrainMap error:', err);
    updateProgress('scoring', 'Error — check console');
    toast('Brain Map build error: ' + err.message, 'err');
  } finally {
    window._brainMap._building = false;
    hideBrainMapProgress();
  }
}

// 4j — Interactive expansion from a discovered node

async function expandFromNode(nodeId) {
  if (!window._brainMap.nodes.has(nodeId)) return;
  window._brainMap.seeds.add(nodeId);
  window._brainMap.nodes.get(nodeId).isSeed = true;

  const filters = window._brainMap.edgeFilters;
  const expansions = [];
  if (filters.citation)   expansions.push(expandCitation([nodeId], 1));
  if (filters.concept)    expansions.push(expandConcept([nodeId]));
  if (filters.species)    expansions.push(expandSpecies([nodeId]));
  if (filters.geographic) expansions.push(expandGeographic([nodeId]));
  if (filters.method)     expansions.push(expandMethod([nodeId]));

  await Promise.allSettled(expansions);
  await scoreAllNodes();
  pruneToLimit(window._brainMap.thresholds.maxNodes);

  if (typeof renderBrainMap === 'function') renderBrainMap();
  if (typeof updateRecommendationPanel === 'function') updateRecommendationPanel();
}

// 4k — Toggle edge type filter

function toggleEdgeType(type, enabled) {
  window._brainMap.edgeFilters[type] = enabled;
  if (typeof renderBrainMap === 'function') renderBrainMap();
}

// 4l — Recompute composites after weight change

function recomputeComposites() {
  const w = window._brainMap.scoreWeights;
  for (const node of window._brainMap.nodes.values()) {
    if (!node.scores) continue;
    node.scores.composite = Math.min(1, Math.max(0,
      w.confidence  * (node.scores.confidence || 0) +
      w.application * (node.scores.application || 0) +
      w.relevance   * (node.scores.relevance || 0) +
      w.recency     * (node.scores.recency || 0) +
      w.openness    * (node.scores.openness || 0)
    ));
  }
  if (typeof updateRecommendationPanel === 'function') updateRecommendationPanel();
}

// ═══ TASK 5 — Progress Reporting ═══

function updateProgress(dimension, message) {
  const el = document.getElementById('bm-prog-' + dimension);
  if (!el) return;
  el.textContent = dimension.charAt(0).toUpperCase() + dimension.slice(1) + ': ' + message;
  el.style.color = message.startsWith('Done') ? 'var(--sg)' :
                   message.startsWith('Error') ? 'var(--co)' : 'var(--tm)';
}

function showBrainMapProgress() {
  const panel = document.getElementById('bm-progress');
  if (!panel) return;
  panel.style.display = 'block';
}

function hideBrainMapProgress() {
  const panel = document.getElementById('bm-progress');
  if (!panel) return;
  panel.style.display = 'none';
}

// ═══ TASK 6 — Save and Export ═══

// IDB helpers for brainmaps store

async function _bmOpenDB() {
  // Reuse the existing db connection — brainmaps store added in IDB upgrade
  if (db) return db;
  return await openDB();
}

async function saveMapToIDB(name, data) {
  const idb = await _bmOpenDB();
  if (!idb.objectStoreNames.contains('brainmaps')) {
    // Store doesn't exist yet — fall back to localStorage
    const maps = safeParse('meridian_brainmaps', {});
    maps[name] = data;
    safeStore('meridian_brainmaps', maps);
    return;
  }
  return new Promise((res, rej) => {
    const tx = idb.transaction('brainmaps', 'readwrite');
    tx.objectStore('brainmaps').put({ id: name, ...data });
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e.target.error);
  });
}

async function loadMapFromIDB(name) {
  const idb = await _bmOpenDB();
  if (!idb.objectStoreNames.contains('brainmaps')) {
    const maps = safeParse('meridian_brainmaps', {});
    return maps[name] || null;
  }
  return new Promise((res, rej) => {
    const tx = idb.transaction('brainmaps', 'readonly');
    const req = tx.objectStore('brainmaps').get(name);
    req.onsuccess = () => res(req.result || null);
    req.onerror = e => rej(e.target.error);
  });
}

async function listSavedMaps() {
  const idb = await _bmOpenDB();
  if (!idb.objectStoreNames.contains('brainmaps')) {
    const maps = safeParse('meridian_brainmaps', {});
    return Object.keys(maps);
  }
  return new Promise((res, rej) => {
    const tx = idb.transaction('brainmaps', 'readonly');
    const req = tx.objectStore('brainmaps').getAllKeys();
    req.onsuccess = () => res(req.result || []);
    req.onerror = e => rej(e.target.error);
  });
}

async function deleteMapFromIDB(name) {
  const idb = await _bmOpenDB();
  if (!idb.objectStoreNames.contains('brainmaps')) {
    const maps = safeParse('meridian_brainmaps', {});
    delete maps[name];
    safeStore('meridian_brainmaps', maps);
    return;
  }
  return new Promise((res, rej) => {
    const tx = idb.transaction('brainmaps', 'readwrite');
    tx.objectStore('brainmaps').delete(name);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e.target.error);
  });
}

async function saveBrainMap() {
  const defaultName = 'Research map ' + new Date().toLocaleDateString('en-GB');
  const name = window._brainMap.mapName || window.prompt('Name this map:', defaultName);
  if (!name) return;

  window._brainMap.mapName = name;
  window._brainMap.lastUpdated = new Date().toISOString();

  const serialised = {
    name,
    lastUpdated: window._brainMap.lastUpdated,
    seeds: [...window._brainMap.seeds],
    nodes: [...window._brainMap.nodes.entries()].map(([id, n]) => ({
      id, doi: n.doi, title: n.title, authors: n.authors, year: n.year,
      journal: n.journal, abstract: n.abstract, citationCount: n.citationCount,
      isOA: n.isOA, oaUrl: n.oaUrl, concepts: n.concepts,
      isSeed: n.isSeed, isInLibrary: n.isInLibrary, hopDistance: n.hopDistance,
      referenced_works: n.referenced_works,
      speciesDetected: n.speciesDetected, locationDetected: n.locationDetected,
      methodsDetected: n.methodsDetected, studyDesign: n.studyDesign,
      sampleSizeProxy: n.sampleSizeProxy, scores: n.scores,
      dominantEdgeType: n.dominantEdgeType,
      x: n.x, y: n.y, fx: n.fx, fy: n.fy
    })),
    edges: window._brainMap.edges,
    layout: window._brainMap.layout,
    edgeFilters: window._brainMap.edgeFilters,
    scoreWeights: window._brainMap.scoreWeights,
    thresholds: window._brainMap.thresholds
  };

  await saveMapToIDB(name, serialised);
  toast('"' + name + '" saved', 'ok');
}

async function loadBrainMap(name) {
  const data = await loadMapFromIDB(name);
  if (!data) { toast('Map not found', 'err'); return; }

  window._brainMap.nodes = new Map(data.nodes.map(n => [n.id, { ...n }]));
  window._brainMap.edges       = data.edges || [];
  window._brainMap.seeds       = new Set(data.seeds || []);
  window._brainMap.layout      = data.layout || 'force';
  window._brainMap.edgeFilters = data.edgeFilters || window._brainMap.edgeFilters;
  window._brainMap.scoreWeights = data.scoreWeights || window._brainMap.scoreWeights;
  window._brainMap.thresholds  = data.thresholds || window._brainMap.thresholds;
  window._brainMap.mapName     = data.name;
  window._brainMap.lastUpdated = data.lastUpdated;

  toast('Loaded "' + name + '" — ' + window._brainMap.nodes.size + ' nodes', 'ok');

  if (typeof renderBrainMap === 'function') renderBrainMap();
  if (typeof updateRecommendationPanel === 'function') updateRecommendationPanel();
}

function exportBrainMapJSON() {
  const data = JSON.stringify({
    exportedAt: new Date().toISOString(),
    name: window._brainMap.mapName,
    nodes: [...window._brainMap.nodes.values()].map(n => ({
      id: n.id, title: n.title, authors: n.authors, year: n.year,
      doi: n.doi, journal: n.journal, citationCount: n.citationCount,
      scores: n.scores, isSeed: n.isSeed,
      speciesDetected: n.speciesDetected, methodsDetected: n.methodsDetected,
      locationDetected: n.locationDetected, studyDesign: n.studyDesign
    })),
    edges: window._brainMap.edges,
    scoreWeights: window._brainMap.scoreWeights
  }, null, 2);

  dl(data, 'meridian-map-' + (window._brainMap.mapName || 'export').replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
  toast('Brain Map exported as JSON', 'ok');
}

// ═══ Final Verification ═══

console.assert(window._brainMap.nodes instanceof Map, 'FINAL: nodes is a Map');
console.assert(Array.isArray(window._brainMap.edges), 'FINAL: edges is an Array');
console.assert(typeof window._brainMap.scoreWeights === 'object', 'FINAL: scoreWeights present');
console.assert(typeof buildBrainMap === 'function', 'FINAL: buildBrainMap defined');
console.assert(typeof expandFromNode === 'function', 'FINAL: expandFromNode defined');
console.assert(typeof toggleEdgeType === 'function', 'FINAL: toggleEdgeType defined');
console.assert(typeof exportBrainMapJSON === 'function', 'FINAL: exportBrainMapJSON defined');
console.log('Part 1 engine verification COMPLETE. Ready for Part 2 (rendering).');

// ═══════════════════════════════════════════════════════════════════
// ═══ PART 2 — Rendering & UI ═══
// ═══════════════════════════════════════════════════════════════════

// ═══ TASK 2 — Seed Selector ═══

let _bmSelectedSeeds = new Set();

function getSelectedSeedIds() {
  return [..._bmSelectedSeeds];
}

function openSeedSelector() {
  if (document.getElementById('bm-seed-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'bm-seed-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);padding:16px;width:min(600px,90vw);max-height:75vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:500;color:var(--t)">Select seed papers (1–10)</div>
        <button class="bt sm" onclick="document.getElementById('bm-seed-overlay').remove()">Close</button>
      </div>
      <input class="si" id="bm-seed-search" placeholder="Filter by title or author..." oninput="_bmFilterSeedList(this.value)" style="width:100%;margin-bottom:10px;font-size:12px">
      <div id="bm-seed-list-inner"></div>
    </div>`;

  document.body.appendChild(overlay);
  _bmRenderSeedList('');
}

function _bmRenderSeedList(filter) {
  const container = document.getElementById('bm-seed-list-inner');
  if (!container) return;
  const papers = S.lib || [];
  const lf = (filter || '').toLowerCase();
  const filtered = papers.filter(p => {
    if (!lf) return true;
    return (p.title || '').toLowerCase().includes(lf) ||
           (p.authors || []).join(' ').toLowerCase().includes(lf);
  });

  if (!filtered.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--ts);padding:8px 0">No papers in Library yet. Search for papers in the Literature tab first.</div>';
    return;
  }

  container.innerHTML = filtered.map(p => {
    const pid = p.id || p.doi || '';
    const checked = _bmSelectedSeeds.has(pid) ? 'checked' : '';
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:.5px solid var(--bd);cursor:pointer" onclick="_bmToggleSeed('${escHTML(pid)}',this)">
      <input type="checkbox" ${checked} style="margin-top:2px;accent-color:var(--ac);flex-shrink:0">
      <div>
        <div style="font-size:12px;color:var(--t);line-height:1.4">${escHTML((p.title || '').slice(0, 90))}${p.title?.length > 90 ? '…' : ''}</div>
        <div style="font-size:10px;color:var(--ts);margin-top:2px">${escHTML((p.authors || []).slice(0, 2).join(', '))}${p.authors?.length > 2 ? ' et al.' : ''} · ${p.year || ''} · ${escHTML(p.journal || '')}</div>
      </div>
    </div>`;
  }).join('');
}

function _bmFilterSeedList(value) { _bmRenderSeedList(value); }

function _bmToggleSeed(paperId, rowEl) {
  const cb = rowEl?.querySelector('input[type=checkbox]');
  if (_bmSelectedSeeds.has(paperId)) {
    _bmSelectedSeeds.delete(paperId);
    if (cb) cb.checked = false;
  } else {
    if (_bmSelectedSeeds.size >= 10) { toast('Maximum 10 seed papers', 'warn'); return; }
    _bmSelectedSeeds.add(paperId);
    if (cb) cb.checked = true;
  }
  _bmRenderSeedChips();
}

function _bmRenderSeedChips() {
  const container = document.getElementById('bm-seed-chips');
  const placeholder = document.getElementById('bm-seed-placeholder');
  if (!container) return;

  container.querySelectorAll('.bm-seed-chip').forEach(c => c.remove());

  if (_bmSelectedSeeds.size === 0) {
    if (placeholder) placeholder.style.display = '';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  const papers = S.lib || [];
  const pMap = new Map(papers.map(p => [p.id || p.doi, p]));
  for (const id of _bmSelectedSeeds) {
    const p = pMap.get(id);
    const chip = document.createElement('span');
    chip.className = 'bm-seed-chip';
    chip.innerHTML = escHTML((p?.title || id).slice(0, 30)) +
      ' <span style="cursor:pointer;opacity:.7;font-size:13px" onclick="event.stopPropagation();_bmRemoveSeed(\'' + escHTML(id) + '\')">×</span>';
    container.appendChild(chip);
  }
}

function _bmRemoveSeed(paperId) {
  _bmSelectedSeeds.delete(paperId);
  _bmRenderSeedChips();
}

// ═══ TASK 3 — SVG Initialisation & D3 Rendering ═══

const EDGE_COLOURS = {
  citation_forward:  '#378ADD',
  citation_backward: '#85B7EB',
  concept:           '#1D9E75',
  species:           '#D85A30',
  geographic:        '#BA7517',
  method:            '#7F77DD'
};

const EDGE_DASH = {
  citation_forward:  null,
  citation_backward: null,
  concept:           '6,3',
  species:           '3,3',
  geographic:        '3,3',
  method:            '8,2,2,2'
};

function initBrainMapSvg() {
  const svgEl = document.getElementById('citGraphSvg');
  if (!svgEl) return;
  svgEl.style.height = '500px';
  svgEl.style.width = '100%';

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const root = svg.append('g').attr('id', 'bm-root');
  root.append('g').attr('id', 'bm-layer-edges');
  root.append('g').attr('id', 'bm-layer-nodes');
  root.append('g').attr('id', 'bm-layer-labels');

  if (!document.getElementById('bm-tooltip')) {
    const tip = document.createElement('div');
    tip.id = 'bm-tooltip';
    tip.style.cssText = 'display:none;position:absolute;pointer-events:none;background:var(--bs);border:.5px solid var(--bd);border-radius:var(--rd);padding:8px 10px;z-index:50;font-size:11px;color:var(--tm);font-family:var(--mf);max-width:220px';
    document.getElementById('citGraphWrap')?.appendChild(tip);
  }

  const zoom = d3.zoom()
    .scaleExtent([0.15, 5])
    .on('zoom', event => root.attr('transform', event.transform));
  svg.call(zoom);

  window._bmZoom = zoom;
  window._bmSvg = svg;
}

function _bmRenderEdges() {
  const activeEdges = window._brainMap.edges.filter(e => {
    const bt = e.type.split('_')[0];
    return window._brainMap.edgeFilters[bt] !== false;
  });

  const sel = d3.select('#bm-layer-edges')
    .selectAll('line.bm-edge')
    .data(activeEdges, d => d.source + '--' + d.target + '--' + d.type);

  sel.enter().append('line')
    .attr('class', 'bm-edge')
    .merge(sel)
    .attr('stroke', d => EDGE_COLOURS[d.type] || 'var(--bd)')
    .attr('stroke-width', d => Math.max(0.5, d.strength * 2.5))
    .attr('stroke-dasharray', d => EDGE_DASH[d.type] || null)
    .attr('opacity', 0.45)
    .attr('fill', 'none');

  sel.exit().remove();
}

function _bmNodeRadius(d) {
  return 5 + (d.scores?.confidence || 0.4) * 13;
}

function _bmNodeFill(d) {
  if (d.isSeed) return 'var(--ac)';
  const fills = { citation:'#E6F1FB', concept:'#E1F5EE', species:'#FAECE7', geographic:'#FAEEDA', method:'#EEEDFE' };
  return fills[d.dominantEdgeType] || 'var(--bs)';
}

function _bmRecencyColour(d) {
  const r = d.scores?.recency || 0.5;
  if (r > 0.7) return '#EF9F27';
  if (r > 0.4) return '#378ADD';
  return '#888780';
}

function _bmRenderNodes() {
  const nodeData = [...window._brainMap.nodes.values()];

  const sel = d3.select('#bm-layer-nodes')
    .selectAll('g.bm-node')
    .data(nodeData, d => d.id);

  const enter = sel.enter().append('g')
    .attr('class', 'bm-node')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) window._bmSimulation?.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) window._bmSimulation?.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    )
    .on('click', (event, d) => { event.stopPropagation(); bmSelectNode(d); })
    .on('mouseenter', (event, d) => _bmShowTooltip(event, d))
    .on('mouseleave', _bmHideTooltip);

  enter.append('circle').attr('class', 'bm-node-body');
  enter.append('circle').attr('class', 'bm-seed-ring');
  enter.append('path').attr('class', 'bm-rel-arc');

  const merged = enter.merge(sel);

  merged.select('.bm-node-body')
    .attr('r', d => _bmNodeRadius(d))
    .attr('fill', d => _bmNodeFill(d))
    .attr('stroke', d => _bmRecencyColour(d))
    .attr('stroke-width', d => 1 + (d.scores?.application || 0) * 2.5)
    .attr('stroke-dasharray', d => d.isOA ? null : '4,2');

  merged.select('.bm-seed-ring')
    .attr('r', d => d.isSeed ? _bmNodeRadius(d) + 5 : 0)
    .attr('fill', 'none')
    .attr('stroke', 'var(--ac)')
    .attr('stroke-width', d => d.isSeed ? 2 : 0);

  merged.select('.bm-rel-arc')
    .attr('d', d => {
      const r = _bmNodeRadius(d) * 0.65;
      const score = d.scores?.relevance || 0;
      if (score <= 0.05) return '';
      const angle = score * 2 * Math.PI;
      const x = r * Math.cos(angle - Math.PI / 2);
      const y = r * Math.sin(angle - Math.PI / 2);
      const large = angle > Math.PI ? 1 : 0;
      return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x + ',' + y;
    })
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.45)')
    .attr('stroke-width', 2.5)
    .attr('stroke-linecap', 'round');

  sel.exit().remove();

  // Labels
  const lblSel = d3.select('#bm-layer-labels')
    .selectAll('text.bm-label')
    .data(nodeData, d => d.id);

  lblSel.enter().append('text')
    .attr('class', 'bm-label')
    .style('pointer-events', 'none')
    .merge(lblSel)
    .attr('text-anchor', 'middle')
    .style('font-size', d => d.isSeed ? '11px' : '9px')
    .style('font-weight', d => d.isSeed ? '500' : '400')
    .style('fill', 'var(--t)')
    .text(d => {
      const max = d.isSeed ? 28 : 18;
      return d.title ? (d.title.length > max ? d.title.slice(0, max) + '…' : d.title) : '';
    });

  lblSel.exit().remove();
}

function _bmTick() {
  d3.selectAll('line.bm-edge')
    .attr('x1', d => d.source?.x ?? 0).attr('y1', d => d.source?.y ?? 0)
    .attr('x2', d => d.target?.x ?? 0).attr('y2', d => d.target?.y ?? 0);

  d3.selectAll('g.bm-node')
    .attr('transform', d => 'translate(' + (d.x ?? 0) + ',' + (d.y ?? 0) + ')');

  d3.selectAll('text.bm-label')
    .attr('x', d => d.x ?? 0)
    .attr('y', d => (d.y ?? 0) + _bmNodeRadius(d) + 10);
}

function renderBrainMap() {
  initBrainMapSvg();
  _bmRenderEdges();
  _bmRenderNodes();

  const recPanel = document.getElementById('bm-rec-panel');
  if (recPanel && window._brainMap.nodes.size > 0) recPanel.style.display = '';

  const stats = document.getElementById('bmStats');
  if (stats) stats.textContent = window._brainMap.nodes.size + ' nodes · ' + window._brainMap.edges.length + ' edges';

  switchLayout(window._brainMap.layout || 'force');
  hideBrainMapProgress();
}

// ═══ TASK 4 — Hover Radar Tooltip ═══

function _bmShowTooltip(event, node) {
  const tooltip = document.getElementById('bm-tooltip');
  if (!tooltip) return;

  const scores = node.scores || {};
  const dims = ['confidence', 'application', 'relevance', 'recency', 'openness'];
  const vals = dims.map(d => scores[d] || 0);
  const sz = 56, cx = sz / 2, cy = sz / 2, r = 20;

  function radarPoly(values, radius) {
    return values.map((v, i) => {
      const a = (2 * Math.PI * i / values.length) - Math.PI / 2;
      return (cx + radius * v * Math.cos(a)) + ',' + (cy + radius * v * Math.sin(a));
    }).join(' ');
  }

  const bgPoly = radarPoly(dims.map(() => 1), r);
  const fillPoly = radarPoly(vals, r);
  const barCols = ['#378ADD','#1D9E75','#D85A30','#BA7517','#7F77DD'];

  const bars = dims.map((d, i) => {
    const pct = Math.round(vals[i] * 100);
    return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">' +
      '<span style="width:60px;font-size:9px;color:var(--ts);font-family:var(--mf)">' + d + '</span>' +
      '<div style="flex:1;height:3px;background:var(--bd);border-radius:2px;overflow:hidden">' +
      '<div style="width:' + pct + '%;height:100%;background:' + barCols[i] + ';border-radius:2px"></div></div>' +
      '<span style="width:22px;text-align:right;font-size:9px;color:var(--ts);font-family:var(--mf)">' + pct + '</span></div>';
  }).join('');

  tooltip.innerHTML =
    '<div style="font-weight:500;font-size:11px;color:var(--t);margin-bottom:4px;line-height:1.3">' +
      escHTML((node.title || '').slice(0, 55)) + ((node.title || '').length > 55 ? '…' : '') + '</div>' +
    '<div style="font-size:9px;color:var(--ts);margin-bottom:6px">' +
      escHTML((node.authors || [])[0] || '') + ' ' + (node.year || '') + '</div>' +
    '<svg width="' + sz + '" height="' + sz + '" style="display:block;margin:0 auto 6px">' +
      '<polygon points="' + bgPoly + '" fill="none" stroke="var(--bd)" stroke-width="0.5"/>' +
      '<polygon points="' + fillPoly + '" fill="rgba(55,138,221,0.18)" stroke="#378ADD" stroke-width="1"/>' +
    '</svg>' + bars +
    '<div style="margin-top:4px;padding-top:4px;border-top:.5px solid var(--bd);font-size:9px;color:var(--ac);font-family:var(--mf)">Composite: ' + Math.round((scores.composite || 0) * 100) + '</div>';

  const wrap = document.getElementById('citGraphWrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  let left = event.clientX - rect.left + 14;
  let top = event.clientY - rect.top - 20;
  if (left + 230 > wrap.offsetWidth) left = wrap.offsetWidth - 234;
  if (top < 0) top = 4;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.display = 'block';
}

function _bmHideTooltip() {
  const t = document.getElementById('bm-tooltip');
  if (t) t.style.display = 'none';
}

// ═══ TASK 5 — Layout Modes ═══

// 5a — Force-directed

function applyForceLayout() {
  const nodes = [...window._brainMap.nodes.values()];
  const activeEdges = window._brainMap.edges.filter(e => {
    const bt = e.type.split('_')[0];
    return window._brainMap.edgeFilters[bt] !== false;
  });

  const svgEl = document.getElementById('citGraphSvg');
  const W = svgEl?.clientWidth || 700;
  const H = svgEl?.clientHeight || 500;

  nodes.forEach(n => { n.fx = null; n.fy = null; });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resolvedEdges = activeEdges
    .map(e => ({ ...e, source: nodeMap.get(e.source), target: nodeMap.get(e.target) }))
    .filter(e => e.source && e.target);

  if (window._bmSimulation) window._bmSimulation.stop();

  window._bmSimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(resolvedEdges)
      .id(d => d.id)
      .strength(e => {
        const base = { citation_forward:0.75, citation_backward:0.65, concept:0.35, species:0.40, geographic:0.30, method:0.35 };
        return (base[e.type] || 0.35) * e.strength;
      })
      .distance(e => {
        const base = { citation_forward:80, citation_backward:80, concept:130, species:110, geographic:120, method:115 };
        return (base[e.type] || 100) / Math.max(0.2, e.strength);
      })
    )
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => _bmNodeRadius(d) + 6))
    .on('tick', _bmTick);
}

// 5b — Temporal

function applyTemporalLayout() {
  if (window._bmSimulation) window._bmSimulation.stop();

  const nodes = [...window._brainMap.nodes.values()];
  const svgEl = document.getElementById('citGraphSvg');
  const W = svgEl?.clientWidth || 700;
  const H = svgEl?.clientHeight || 500;

  const years = nodes.map(n => n.year).filter(Boolean);
  if (!years.length) { applyForceLayout(); return; }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([60, W - 60]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([H - 55, 40]);

  nodes.forEach((n, i) => {
    n.fx = n.year ? xScale(n.year) : W / 2;
    n.fy = yScale(n.scores?.confidence || 0.5) + ((i % 5) - 2) * 8;
  });

  _bmRenderTimeAxis(minYear, maxYear, xScale, H, W);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const resolvedEdges = window._brainMap.edges
    .map(e => ({ ...e, source: nodeMap.get(e.source), target: nodeMap.get(e.target) }))
    .filter(e => e.source && e.target);

  window._bmSimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(resolvedEdges).id(d => d.id).strength(0))
    .on('tick', _bmTick);

  setTimeout(_bmTick, 50);
}

function _bmRenderTimeAxis(minYear, maxYear, xScale, H, W) {
  d3.select('#bm-root').selectAll('.bm-axis').remove();
  const g = d3.select('#bm-root').append('g').attr('class', 'bm-axis');

  g.append('line')
    .attr('x1', 60).attr('x2', W - 60)
    .attr('y1', H - 28).attr('y2', H - 28)
    .attr('stroke', 'var(--bd)').attr('stroke-width', 0.5);

  const firstDecade = Math.ceil(minYear / 10) * 10;
  for (let yr = firstDecade; yr <= maxYear; yr += 10) {
    const x = xScale(yr);
    g.append('line').attr('x1', x).attr('x2', x).attr('y1', H - 33).attr('y2', H - 23).attr('stroke', 'var(--ts)').attr('stroke-width', 0.5);
    g.append('text').attr('x', x).attr('y', H - 12).attr('text-anchor', 'middle').style('font-size', '10px').style('fill', 'var(--ts)').text(yr);
  }

  g.append('text').attr('x', 60).attr('y', 16).style('font-size', '10px').style('fill', 'var(--ts)').text('↑ confidence');
}

// 5c — Thematic clusters

function applyClusterLayout() {
  if (window._bmSimulation) window._bmSimulation.stop();

  const nodes = [...window._brainMap.nodes.values()];
  if (!nodes.length) return;
  const svgEl = document.getElementById('citGraphSvg');
  const W = svgEl?.clientWidth || 700;
  const H = svgEl?.clientHeight || 500;

  const k = Math.min(6, Math.max(3, Math.floor(Math.sqrt(nodes.length / 4))));
  const clusters = _bmKMeans(nodes, k);

  const cxC = W / 2, cyC = H / 2;
  const rC = Math.min(W, H) * 0.28;

  clusters.forEach((cluster, ci) => {
    const angle = (2 * Math.PI * ci / clusters.length) - Math.PI / 2;
    const clCx = cxC + rC * Math.cos(angle);
    const clCy = cyC + rC * Math.sin(angle);

    cluster.members.forEach((node, ni) => {
      const innerAngle = (2 * Math.PI * ni / Math.max(1, cluster.members.length));
      const innerR = Math.min(60, 10 + ni * 7);
      node.fx = clCx + innerR * Math.cos(innerAngle);
      node.fy = clCy + innerR * Math.sin(innerAngle);
    });

    _bmRenderHull(cluster, ci);
  });

  setTimeout(_bmTick, 50);
}

function _bmRenderHull(cluster, ci) {
  if (cluster.members.length < 3) return;

  const hullPts = cluster.members.map(n => [n.fx || n.x || 0, n.fy || n.y || 0]);
  const hull = d3.polygonHull(hullPts);
  if (!hull) return;

  const hullColors = ['#E6F1FB','#E1F5EE','#FAEEDA','#EEEDFE','#FAECE7','#F0F0E8'];
  const hullStrokes = ['#378ADD','#1D9E75','#BA7517','#7F77DD','#D85A30','#888780'];

  const padded = hull.map(([x, y]) => {
    const hcx = d3.mean(hull, p => p[0]);
    const hcy = d3.mean(hull, p => p[1]);
    const dx = x - hcx, dy = y - hcy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return len > 0 ? [x + dx / len * 24, y + dy / len * 24] : [x, y];
  });

  d3.select('#bm-layer-edges').append('polygon')
    .attr('class', 'bm-hull')
    .attr('points', padded.map(p => p.join(',')).join(' '))
    .attr('fill', hullColors[ci % hullColors.length])
    .attr('fill-opacity', 0.12)
    .attr('stroke', hullStrokes[ci % hullStrokes.length])
    .attr('stroke-width', 0.8)
    .attr('stroke-dasharray', '4,3')
    .attr('stroke-opacity', 0.4);

  const labelX = d3.mean(padded, p => p[0]);
  const labelY = Math.min(...padded.map(p => p[1])) - 8;

  d3.select('#bm-layer-labels').append('text')
    .attr('class', 'bm-hull-label')
    .attr('x', labelX).attr('y', labelY)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', hullStrokes[ci % hullStrokes.length])
    .style('font-weight', '500')
    .text(cluster.label.slice(0, 22));
}

function _bmKMeans(nodes, k) {
  const vec = n => {
    const m = new Map();
    (n.concepts || []).forEach(c => m.set(c.concept, c.score || 0.5));
    return m;
  };

  function sim(a, b) {
    if (!a.size || !b.size) return 0;
    let dot = 0, na = 0, nb = 0;
    for (const [key, va] of a) {
      const vb = b.get(key) || 0;
      dot += va * vb; na += va * va;
    }
    for (const vb of b.values()) nb += vb * vb;
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }

  const shuffled = [...nodes].sort(() => 0.5 - Math.random());
  let centroids = shuffled.slice(0, k).map(n => vec(n));
  let assignments = new Array(nodes.length).fill(0);

  for (let iter = 0; iter < 15; iter++) {
    assignments = nodes.map(n => {
      const nv = vec(n);
      const sims = centroids.map(c => sim(nv, c));
      return sims.indexOf(Math.max(...sims));
    });

    centroids = centroids.map((_, ci) => {
      const members = nodes.filter((_, ni) => assignments[ni] === ci);
      if (!members.length) return centroids[ci];
      const combined = new Map();
      members.forEach(m => {
        (m.concepts || []).forEach(c => {
          combined.set(c.concept, (combined.get(c.concept) || 0) + (c.score || 0.5));
        });
      });
      const n = members.length;
      combined.forEach((v, key) => combined.set(key, v / n));
      return combined;
    });
  }

  return centroids.map((centroid, ci) => {
    const members = nodes.filter((_, ni) => assignments[ni] === ci);
    const topConcept = [...centroid.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || ('Cluster ' + (ci + 1));
    return { label: topConcept, members, index: ci };
  });
}

// 5d — Radial ego-centric

function applyRadialLayout(centreId) {
  if (window._bmSimulation) window._bmSimulation.stop();

  if (!centreId) {
    const nonSeeds = [...window._brainMap.nodes.values()]
      .filter(n => !n.isSeed)
      .sort((a, b) => (b.scores?.composite || 0) - (a.scores?.composite || 0));
    centreId = nonSeeds[0]?.id;
  }
  if (!centreId && window._brainMap.seeds.size > 0) centreId = [...window._brainMap.seeds][0];
  if (!centreId) return;

  const nodes = [...window._brainMap.nodes.values()];
  const svgEl = document.getElementById('citGraphSvg');
  const cxR = (svgEl?.clientWidth || 700) / 2;
  const cyR = (svgEl?.clientHeight || 500) / 2;

  const dist = new Map([[centreId, 0]]);
  const queue = [centreId];
  while (queue.length) {
    const cur = queue.shift();
    window._brainMap.edges
      .filter(e => e.source === cur || e.target === cur)
      .map(e => e.source === cur ? e.target : e.source)
      .filter(id => !dist.has(id))
      .forEach(id => { dist.set(id, (dist.get(cur) || 0) + 1); queue.push(id); });
  }

  const ringRadii = [0, 110, 200, 290];
  const ringBuckets = [[], [], [], []];
  nodes.forEach(n => {
    const d = Math.min(3, dist.get(n.id) ?? 3);
    ringBuckets[d].push(n);
  });

  ringBuckets.forEach((ring, ri) => {
    ring.sort((a, b) => (b.scores?.composite || 0) - (a.scores?.composite || 0));
    ring.forEach((n, ni) => {
      if (ri === 0) {
        n.fx = cxR; n.fy = cyR;
      } else {
        const angle = (2 * Math.PI * ni / Math.max(1, ring.length)) - Math.PI / 2;
        n.fx = cxR + ringRadii[ri] * Math.cos(angle);
        n.fy = cyR + ringRadii[ri] * Math.sin(angle);
      }
    });
  });

  setTimeout(_bmTick, 50);
}

// 5e — Layout switcher

function switchLayout(mode) {
  window._brainMap.layout = mode;

  d3.select('#bm-layer-edges').selectAll('.bm-hull').remove();
  d3.select('#bm-layer-labels').selectAll('.bm-hull-label').remove();
  d3.select('#bm-root').selectAll('.bm-axis').remove();

  if (window._brainMap.nodes.size === 0) return;

  switch (mode) {
    case 'force':    applyForceLayout();    break;
    case 'temporal': applyTemporalLayout(); break;
    case 'cluster':  applyClusterLayout();  break;
    case 'radial':   applyRadialLayout();   break;
    default:         applyForceLayout();
  }
}

// ═══ TASK 6 — Recommendation Panel ═══

let _bmSortDim = 'composite';

function updateRecommendationPanel() {
  const list = document.getElementById('bm-rec-list');
  if (!list) return;

  const nodes = [...window._brainMap.nodes.values()]
    .filter(n => !n.isSeed)
    .sort((a, b) => (b.scores?.[_bmSortDim] || 0) - (a.scores?.[_bmSortDim] || 0))
    .slice(0, 40);

  list.innerHTML = nodes.map(n => _bmBuildRecCard(n)).join('');
}

function _bmBuildRecCard(node) {
  const scores = node.scores || {};
  const dims = ['confidence','application','relevance','recency','openness'];
  const cols = ['#378ADD','#1D9E75','#D85A30','#BA7517','#7F77DD'];

  const bars = dims.map((d, i) => {
    const pct = Math.round((scores[d] || 0) * 100);
    return '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">' +
      '<span style="width:62px;font-size:9px;color:var(--ts);font-family:var(--mf)">' + d + '</span>' +
      '<div style="flex:1;height:3px;background:var(--bd);border-radius:2px;overflow:hidden">' +
      '<div style="width:' + pct + '%;height:100%;background:' + cols[i] + ';border-radius:2px"></div></div>' +
      '<span style="width:20px;text-align:right;font-size:9px;color:var(--ts);font-family:var(--mf)">' + pct + '</span></div>';
  }).join('');

  const edgeTypes = [...new Set(
    window._brainMap.edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => e.type.split('_')[0])
  )];

  const edgeBadges = edgeTypes.map(t => {
    const bg = { citation:'#E6F1FB',concept:'#E1F5EE',species:'#FAECE7',geographic:'#FAEEDA',method:'#EEEDFE' }[t] || 'var(--bs)';
    const tc = { citation:'#0C447C',concept:'#085041',species:'#712B13',geographic:'#633806',method:'#3C3489' }[t] || 'var(--tm)';
    return '<span style="font-size:9px;padding:1px 5px;border-radius:20px;background:' + bg + ';color:' + tc + '">' + t + '</span>';
  }).join('');

  const safeId = (node.id || '').replace(/['"]/g, '');

  return '<div class="bm-rec-card" data-id="' + safeId + '" onclick="bmSelectNode(window._brainMap.nodes.get(\'' + safeId + '\'))">' +
    '<div style="font-size:11px;font-weight:500;color:var(--t);line-height:1.35;margin-bottom:3px">' +
      escHTML((node.title || '').slice(0, 75)) + ((node.title || '').length > 75 ? '…' : '') + '</div>' +
    '<div style="font-size:10px;color:var(--ts);margin-bottom:5px">' +
      escHTML((node.authors || [])[0] || '') + ' · ' + (node.year || '') +
      (node.isOA ? ' · <span style="color:#1D9E75">OA</span>' : '') + '</div>' +
    bars +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px">' +
      '<div style="display:flex;gap:3px;flex-wrap:wrap">' + edgeBadges + '</div>' +
      '<div style="display:flex;gap:3px">' +
        '<button class="bt sm" style="font-size:9px;padding:2px 5px" onclick="event.stopPropagation();bmSaveToLib(\'' + safeId + '\')">' + (node.isInLibrary ? '✓' : '+ Lib') + '</button>' +
        '<button class="bt sm" style="font-size:9px;padding:2px 5px" onclick="event.stopPropagation();expandFromNode(\'' + safeId + '\')">Expand</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function sortRecs(dim, btn) {
  _bmSortDim = dim;
  document.querySelectorAll('.bm-sort-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  updateRecommendationPanel();
}

// ═══ TASK 7 — Node Selection Panel ═══

function bmSelectNode(node) {
  if (!node) return;

  const connectedIds = new Set([node.id]);
  window._brainMap.edges
    .filter(e => e.source === node.id || e.target === node.id)
    .forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });

  d3.selectAll('g.bm-node').attr('opacity', d => connectedIds.has(d.id) ? 1.0 : 0.12);
  d3.selectAll('line.bm-edge').attr('opacity', e => {
    const sid = typeof e.source === 'object' ? e.source.id : e.source;
    const tid = typeof e.target === 'object' ? e.target.id : e.target;
    return (sid === node.id || tid === node.id) ? 0.85 : 0.04;
  });

  document.querySelectorAll('.bm-rec-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === node.id);
  });

  window._bmSvg?.on('click.deselect', () => {
    d3.selectAll('g.bm-node').attr('opacity', 1);
    d3.selectAll('line.bm-edge').attr('opacity', 0.45);
    document.querySelectorAll('.bm-rec-card').forEach(el => el.classList.remove('selected'));
    const det = document.getElementById('graphPaperDetail');
    if (det) det.innerHTML = '';
    window._bmSvg?.on('click.deselect', null);
  });

  const scores = node.scores || {};
  const detail = document.getElementById('graphPaperDetail');
  if (!detail) return;

  const safeId = (node.id || '').replace(/['"]/g, '');
  const absText = (node.abstract || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

  detail.innerHTML =
    '<div style="padding:12px;margin-top:10px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:500;color:var(--t);line-height:1.4;margin-bottom:4px">' + escHTML(node.title || '') + '</div>' +
          '<div style="font-size:11px;color:var(--ts);line-height:1.6">' +
            escHTML((node.authors || []).slice(0, 3).join(', ')) + ((node.authors || []).length > 3 ? ' et al.' : '') +
            ' · ' + (node.year || '') + ' · ' + escHTML(node.journal || '') +
            (node.citationCount ? ' · ' + node.citationCount + ' citations' : '') +
            (node.isOA && node.oaUrl ? ' · <a href="' + escHTML(node.oaUrl) + '" target="_blank" rel="noopener" style="color:var(--sg)">Open Access</a>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">' +
          '<button class="bt sm bt-pri" onclick="bmSaveToLib(\'' + safeId + '\')">' + (node.isInLibrary ? '✓ Saved' : '+ Library') + '</button>' +
          '<button class="bt sm" onclick="expandFromNode(\'' + safeId + '\')">Expand map</button>' +
          (node.doi ? '<a class="bt sm" href="https://doi.org/' + escHTML(node.doi.replace(/^https?:\/\/doi\.org\//, '')) + '" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">DOI</a>' : '') +
        '</div>' +
      '</div>' +
      (node.abstract ? '<div style="font-size:12px;color:var(--ts);line-height:1.65;margin-bottom:8px;font-family:var(--sf)">' + escHTML(node.abstract.slice(0, 420)) + (node.abstract.length > 420 ? '…' : '') + '</div>' : '') +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--tm);font-family:var(--mf)">' +
        ((node.speciesDetected || []).length ? '<span>Species: ' + escHTML(node.speciesDetected.slice(0, 3).map(s => s.name).join(', ')) + '</span>' : '') +
        ((node.methodsDetected || []).length ? '<span>Methods: ' + escHTML(node.methodsDetected.slice(0, 3).join(', ')) + '</span>' : '') +
        (node.locationDetected?.regionName ? '<span>Region: ' + escHTML(node.locationDetected.regionName) + '</span>' : '') +
        (node.studyDesign && node.studyDesign !== 'unknown' ? '<span>Design: ' + node.studyDesign + '</span>' : '') +
      '</div>' +
    '</div>';
}

function bmSaveToLib(nodeId) {
  const node = window._brainMap.nodes.get(nodeId);
  if (!node) return;
  savePaper({
    id: node.id,
    title: node.title,
    authors: node.authors,
    year: node.year,
    journal: node.journal,
    doi: node.doi,
    abstract: node.abstract,
    cited: node.citationCount,
    citationCount: node.citationCount,
    isOA: node.isOA,
    oaUrl: node.oaUrl,
    concepts: node.concepts,
    src: 'BM'
  });
  node.isInLibrary = true;
  updateRecommendationPanel();
}

// ═══ TASK 8 — Score Weight Sliders ═══

function renderWeightSliders() {
  const container = document.getElementById('bm-weight-sliders');
  if (!container) return;

  const dims = [
    { key: 'confidence',  label: 'Confidence',  colour: '#378ADD' },
    { key: 'application', label: 'Application', colour: '#1D9E75' },
    { key: 'relevance',   label: 'Relevance',   colour: '#D85A30' },
    { key: 'recency',     label: 'Recency',     colour: '#BA7517' },
    { key: 'openness',    label: 'Openness',    colour: '#7F77DD' }
  ];

  container.innerHTML = dims.map(d =>
    '<span style="font-size:11px;color:var(--tm);font-family:var(--mf)">' + d.label + '</span>' +
    '<input type="range" min="0" max="0.6" step="0.05" value="' + (window._brainMap.scoreWeights[d.key] || 0.2) + '" style="accent-color:' + d.colour + '" oninput="updateWeight(\'' + d.key + '\',parseFloat(this.value))">' +
    '<span id="bm-w-' + d.key + '" style="font-size:11px;color:var(--tm);font-family:var(--mf);text-align:right">' + Math.round((window._brainMap.scoreWeights[d.key] || 0.2) * 100) + '%</span>'
  ).join('');
}

function updateWeight(key, value) {
  window._brainMap.scoreWeights[key] = value;
  const label = document.getElementById('bm-w-' + key);
  if (label) label.textContent = Math.round(value * 100) + '%';
  if (typeof recomputeComposites === 'function') recomputeComposites();
  updateRecommendationPanel();
}

function updateThreshold(value) {
  window._brainMap.thresholds.minComposite = value;
  const label = document.getElementById('bm-threshold-val');
  if (label) label.textContent = value.toFixed(2);
}

// ═══ TASK 9 — Initialisation ═══

function initBrainMapUI() {
  renderWeightSliders();
  if (window._brainMap.nodes.size > 0) {
    renderBrainMap();
    updateRecommendationPanel();
  }
}

console.log('Part 2 rendering layer loaded. Brain Map UI ready.');
