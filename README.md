# Meridian Engine

**A full-stack marine research platform that runs entirely in your browser.**

Meridian combines literature search, species databases, real-time environmental data, statistical analysis, and an AI research assistant into a single zero-install tool for marine scientists, fisheries researchers, and conservation practitioners.

## Features

### Literature & Library
- **Multi-database search** — OpenAlex, Semantic Scholar, CrossRef, and PubMed in one query
- **Paper library** — save, tag, full-text search, and export (persisted in IndexedDB)
- **Compile to Workshop** — extract numeric data from abstracts for immediate analysis

### Species Database
- **Taxonomy** via WoRMS (World Register of Marine Species)
- **Global occurrences** from GBIF + OBIS with interactive maps
- **Biology & ecology** from FishBase / SeaLifeBase
- **Species comparison** — side-by-side profiles

### Environmental Data
- **12+ oceanographic variables** from NOAA ERDDAP — SST, chlorophyll, salinity, currents, dissolved oxygen, CO2, and more
- **Interactive map** with toggleable GIBS satellite layers (SST, chlorophyll, DHW, bathymetry)
- **Time series charts** with trend analysis (Mann-Kendall), anomaly detection, and moving averages
- **Area analysis** — draw polygons for spatial averages with point-in-polygon filtering
- **Habitat inference** — rule-based classification suggests coral reef, seagrass, mangrove, kelp forest, and other habitats from fetched environmental data
- **Multi-source fusion** — ensemble averaging across redundant data sources
- **Climate indices** — ONI/ENSO, NAO, PDO overlays on time series

### Statistical Analysis (Workshop)
- **10 chart types** — scatter, line, bar, histogram, box plot, violin, heatmap, polar, ternary, paired
- **Built-in statistics** — t-test, ANOVA, chi-square, Mann-Whitney, Kruskal-Wallis, linear regression, correlation matrix, PCA, ANCOVA
- **Export** — CSV, TSV, JSON, R script, Python script

### AI Research Assistant
- Powered by **Claude** (Anthropic) — bring your own API key
- Context-aware: sees your library, environmental results, species data, and active charts
- Tool use: can search literature, look up species, fetch environmental data on your behalf

### Additional Tools
- **Citation graph** — build and explore citation networks from seed papers
- **Gap analysis** — AI-powered scan of your library for research gaps
- **Field data** — import and visualize catch/survey data
- **Eco-statistics** — population modeling, diversity indices, size-frequency analysis
- **Study design** — power analysis, sampling calculator, survey builder
- **Brain maps** — visual knowledge maps linking papers, species, and concepts
- **Session management** — save/restore full analysis sessions

## Architecture

Meridian is a **client-side PWA** — no backend server required. All computation runs in the browser. Data is fetched directly from public APIs (NOAA, GBIF, OpenAlex, etc.) and persisted locally in IndexedDB.

```
meridian.html          — Single-page app shell, UI structure
meridian.css           — Styles (CSS custom properties, dark theme)
meridian-core.js       — Error pipeline, state management, CORS proxy, utilities
meridian-data.js       — Literature search, species DB, environmental fetch pipeline
meridian-features.js   — AI assistant, map layers, citation graph, gap analysis
meridian-workshop.js   — Chart builder, statistical tests, data export
meridian-stats.js      — Statistical functions (t-test, ANOVA, regression, PCA, etc.)
meridian-brainmap.js   — Knowledge graph visualization
meridian-ecostats.js   — Population ecology models, diversity indices
meridian-fielddata.js  — Field data import and analysis
meridian-studydesign.js — Power analysis, sampling design
meridian-padi.js       — PADI local AI engine (TF-IDF, Bayes, graph ranking)
meridian-gapfill.js    — Research gap detection
meridian-repro.js      — Reproducibility bundle export
meridian-session.js    — Session save/restore
meridian-ui.js         — UI utilities, tab management, theme
sw.js                  — Service worker for offline PWA support
_headers               — Cloudflare Pages security headers (CSP, X-Frame-Options)
workers/               — Cloudflare Worker templates (CORS proxy, error reporting)
```

## Deployment

Meridian is designed for **Cloudflare Pages** (static site, no build step):

1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Set build output directory to `/` (root)
4. No build command needed

### Pre-deploy checklist

- [ ] Set `_CORS_WORKER` in `meridian-core.js` to your Cloudflare Worker URL
- [ ] Set `_ERROR_ENDPOINT` in `meridian-core.js` to your error reporting Worker URL
- [ ] Deploy CORS proxy worker (`workers/cors-proxy.js`)
- [ ] Deploy error reporter worker (`workers/error-reporter.js`)
- [ ] Point domain DNS to Cloudflare Pages

## Data Sources

| Source | Data | API |
|--------|------|-----|
| NOAA ERDDAP | SST, chlorophyll, salinity, currents, O2, CO2 | REST (tabledap/griddap) |
| NASA GIBS | Satellite imagery layers | WMTS |
| GMRT | Bathymetry / seafloor topography | REST |
| WoRMS | Marine species taxonomy | REST |
| GBIF | Species occurrence records | REST |
| OBIS | Ocean biodiversity occurrences | REST |
| FishBase / SeaLifeBase | Species biology & ecology | REST |
| OpenAlex | Academic literature | REST |
| Semantic Scholar | Academic literature + citations | REST |
| CrossRef | DOI metadata | REST |
| PubMed (NCBI) | Biomedical literature | E-utilities |
| Open-Meteo | Weather / climate reanalysis | REST |
| Global Fishing Watch | Fishing effort heatmaps | REST |
| Allen Coral Atlas* | Coral reef habitat maps | WMS |

*\*Currently experiencing server issues — habitat inference from environmental data is used as a fallback.*

## Privacy

- **No backend** — all data stays in your browser (IndexedDB)
- **No tracking** — no analytics, no cookies, no user accounts
- **API keys** are encrypted in localStorage via AES-GCM (Web Crypto API) and never transmitted to any server except the AI provider you choose
- **CSP enforced** — strict Content Security Policy limits which domains the app can contact

## License

All rights reserved. This is a private repository.

## Author

Built for marine research by a fisheries scientist who needed all these tools in one place.
