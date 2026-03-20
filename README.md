# Meridian Engine

A browser-based research tool for marine scientists. Literature search, environmental data, species lookup, and statistical analysis in one place.

## What it does

- **Literature** — search OpenAlex, Semantic Scholar, CrossRef, and PubMed simultaneously. Save papers to a local library.
- **Species** — taxonomy (WoRMS), occurrences (GBIF/OBIS), biology (FishBase/SeaLifeBase).
- **Environmental data** — fetch SST, chlorophyll, salinity, bathymetry, and other variables from NOAA ERDDAP. Interactive map with satellite layers. Time series with trend analysis.
- **Workshop** — chart builder with built-in stats (t-test, ANOVA, regression, PCA, etc.). Export to CSV, R, or Python.
- **AI assistant** — Claude (Anthropic, BYOK) with access to your data context.
- **Extras** — citation graphs, gap analysis, field data import, study design tools.

## How it works

Client-side PWA — no backend. Everything runs in the browser and persists in IndexedDB. Data comes directly from public APIs.

## Deployment

Static site on Cloudflare Pages. No build step.

1. Connect repo to Cloudflare Pages
2. Build output directory: `/`
3. Optionally deploy the CORS proxy worker (`workers/cors-proxy.js`) and set `_CORS_WORKER` in `meridian-core.js`

## Privacy

No backend, no tracking, no cookies. API keys are encrypted locally (AES-GCM) and only sent to the provider you choose.
