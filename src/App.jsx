import { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from "recharts";

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
const T = {
  bg: "#232030", bgSurface: "#2A2735", bgElevated: "#322F3D",
  accent: "#C9956B", accentMuted: "rgba(201,149,107,0.15)", accentBorder: "rgba(201,149,107,0.25)",
  sage: "#7B9E87", sageMuted: "rgba(123,158,135,0.15)", sageBorder: "rgba(123,158,135,0.25)",
  coral: "#C27878", coralMuted: "rgba(194,120,120,0.15)",
  lavender: "#9B8EC4", lavenderMuted: "rgba(155,142,196,0.15)",
  text: "#E2D9CF", textMuted: "#8A7F74", textDim: "#5A524A",
  border: "rgba(201,149,107,0.08)", borderHover: "rgba(201,149,107,0.2)",
  success: "#7B9E87", warning: "#D4A04A", error: "#C27878",
};

const CHART_COLORS = ["#C9956B", "#7B9E87", "#9B8EC4", "#C27878", "#D4A04A", "#6BA3C9", "#C96BA3", "#8EC49B"];

// ═══════════════════════════════════════════════════════════════
// JOURNAL DATABASE (~120 journals across fields)
// ═══════════════════════════════════════════════════════════════
const JOURNALS = [
  // Multidisciplinary
  { name: "Nature", field: "Multidisciplinary", tier: "S", oa: "Hybrid", publisher: "Springer Nature" },
  { name: "Science", field: "Multidisciplinary", tier: "S", oa: "Hybrid", publisher: "AAAS" },
  { name: "PNAS", field: "Multidisciplinary", tier: "S", oa: "Hybrid", publisher: "NAS" },
  { name: "Nature Communications", field: "Multidisciplinary", tier: "A", oa: "Full OA", publisher: "Springer Nature" },
  { name: "Science Advances", field: "Multidisciplinary", tier: "A", oa: "Full OA", publisher: "AAAS" },
  { name: "PLOS ONE", field: "Multidisciplinary", tier: "B", oa: "Full OA", publisher: "PLOS" },
  { name: "Scientific Reports", field: "Multidisciplinary", tier: "B", oa: "Full OA", publisher: "Springer Nature" },
  { name: "PeerJ", field: "Multidisciplinary", tier: "B", oa: "Full OA", publisher: "PeerJ" },
  { name: "Royal Society Open Science", field: "Multidisciplinary", tier: "B", oa: "Full OA", publisher: "Royal Society" },
  // Marine & Fisheries
  { name: "Marine Ecology Progress Series", field: "Marine Biology", tier: "A", oa: "Hybrid", publisher: "Inter-Research" },
  { name: "ICES Journal of Marine Science", field: "Fisheries Science", tier: "A", oa: "Hybrid", publisher: "Oxford" },
  { name: "Fish and Fisheries", field: "Fisheries Science", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Canadian Journal of Fisheries and Aquatic Sciences", field: "Fisheries Science", tier: "A", oa: "Hybrid", publisher: "NRC" },
  { name: "Fisheries Research", field: "Fisheries Science", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Marine Biology", field: "Marine Biology", tier: "A", oa: "Hybrid", publisher: "Springer" },
  { name: "Journal of Fish Biology", field: "Fisheries Science", tier: "B", oa: "Hybrid", publisher: "Wiley" },
  { name: "Marine Policy", field: "Marine Policy", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Ocean & Coastal Management", field: "Marine Policy", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Reviews in Fisheries Science & Aquaculture", field: "Fisheries Science", tier: "A", oa: "Hybrid", publisher: "Taylor & Francis" },
  { name: "Aquaculture", field: "Aquaculture", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Aquaculture Research", field: "Aquaculture", tier: "B", oa: "Hybrid", publisher: "Wiley" },
  { name: "North American Journal of Fisheries Management", field: "Fisheries Science", tier: "B", oa: "Hybrid", publisher: "AFS" },
  { name: "Transactions of the American Fisheries Society", field: "Fisheries Science", tier: "B", oa: "Hybrid", publisher: "AFS" },
  { name: "Journal of Sea Research", field: "Marine Biology", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Estuarine, Coastal and Shelf Science", field: "Marine Biology", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Deep-Sea Research Part I", field: "Oceanography", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Deep-Sea Research Part II", field: "Oceanography", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Journal of Marine Systems", field: "Oceanography", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Continental Shelf Research", field: "Oceanography", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Progress in Oceanography", field: "Oceanography", tier: "S", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Limnology and Oceanography", field: "Oceanography", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Journal of Physical Oceanography", field: "Oceanography", tier: "A", oa: "Hybrid", publisher: "AMS" },
  { name: "Ocean Science", field: "Oceanography", tier: "A", oa: "Full OA", publisher: "EGU" },
  { name: "Frontiers in Marine Science", field: "Marine Biology", tier: "A", oa: "Full OA", publisher: "Frontiers" },
  { name: "Marine Environmental Research", field: "Marine Biology", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Journal of Experimental Marine Biology and Ecology", field: "Marine Biology", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  // Ecology & Evolution
  { name: "Ecology Letters", field: "Ecology", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Ecology", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "ESA" },
  { name: "Journal of Ecology", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "BES" },
  { name: "Journal of Animal Ecology", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "BES" },
  { name: "Functional Ecology", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "BES" },
  { name: "Oecologia", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "Springer" },
  { name: "Ecological Modelling", field: "Ecology", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Ecological Applications", field: "Ecology", tier: "A", oa: "Hybrid", publisher: "ESA" },
  { name: "Oikos", field: "Ecology", tier: "A", oa: "Full OA", publisher: "Wiley" },
  { name: "Molecular Ecology", field: "Genetics", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Evolution", field: "Genetics", tier: "A", oa: "Hybrid", publisher: "Oxford" },
  { name: "Biological Conservation", field: "Conservation", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Conservation Biology", field: "Conservation", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Conservation Letters", field: "Conservation", tier: "S", oa: "Full OA", publisher: "Wiley" },
  // Climate & Atmospheric
  { name: "Nature Climate Change", field: "Climate Science", tier: "S", oa: "Hybrid", publisher: "Springer Nature" },
  { name: "Global Change Biology", field: "Climate Science", tier: "S", oa: "Hybrid", publisher: "Wiley" },
  { name: "Climate Dynamics", field: "Climate Science", tier: "A", oa: "Hybrid", publisher: "Springer" },
  { name: "Journal of Climate", field: "Climate Science", tier: "A", oa: "Hybrid", publisher: "AMS" },
  { name: "Geophysical Research Letters", field: "Earth Sciences", tier: "S", oa: "Hybrid", publisher: "AGU" },
  { name: "Journal of Geophysical Research: Oceans", field: "Oceanography", tier: "A", oa: "Hybrid", publisher: "AGU" },
  { name: "Biogeosciences", field: "Earth Sciences", tier: "A", oa: "Full OA", publisher: "EGU" },
  { name: "Earth-Science Reviews", field: "Earth Sciences", tier: "S", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Global Biogeochemical Cycles", field: "Earth Sciences", tier: "A", oa: "Hybrid", publisher: "AGU" },
  { name: "Atmospheric Chemistry and Physics", field: "Atmospheric Science", tier: "A", oa: "Full OA", publisher: "EGU" },
  // Environmental
  { name: "Environmental Science & Technology", field: "Environmental Science", tier: "S", oa: "Hybrid", publisher: "ACS" },
  { name: "Environment International", field: "Environmental Science", tier: "A", oa: "Full OA", publisher: "Elsevier" },
  { name: "Science of the Total Environment", field: "Environmental Science", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Environmental Pollution", field: "Environmental Science", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Marine Pollution Bulletin", field: "Environmental Science", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  // Statistics / Methods
  { name: "Methods in Ecology and Evolution", field: "Methods", tier: "S", oa: "Full OA", publisher: "BES" },
  { name: "Ecological Informatics", field: "Methods", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Journal of Statistical Software", field: "Methods", tier: "A", oa: "Full OA", publisher: "JSS" },
  { name: "Environmental Modelling & Software", field: "Methods", tier: "A", oa: "Hybrid", publisher: "Elsevier" },
  // Biochemistry & Physiology
  { name: "Journal of Experimental Biology", field: "Physiology", tier: "A", oa: "Hybrid", publisher: "Company of Biologists" },
  { name: "Comparative Biochemistry and Physiology", field: "Physiology", tier: "B", oa: "Hybrid", publisher: "Elsevier" },
  // Remote Sensing / GIS
  { name: "Remote Sensing of Environment", field: "Remote Sensing", tier: "S", oa: "Hybrid", publisher: "Elsevier" },
  { name: "ISPRS Journal of Photogrammetry and Remote Sensing", field: "Remote Sensing", tier: "S", oa: "Hybrid", publisher: "Elsevier" },
  { name: "Remote Sensing", field: "Remote Sensing", tier: "A", oa: "Full OA", publisher: "MDPI" },
  // Taxonomy & Systematics
  { name: "Zootaxa", field: "Taxonomy", tier: "A", oa: "Hybrid", publisher: "Magnolia Press" },
  { name: "Systematics and Biodiversity", field: "Taxonomy", tier: "B", oa: "Hybrid", publisher: "Taylor & Francis" },
  { name: "Journal of Biogeography", field: "Biogeography", tier: "A", oa: "Hybrid", publisher: "Wiley" },
];

const JOURNAL_FIELDS = [...new Set(JOURNALS.map(j => j.field))].sort();
const TIERS = ["S", "A", "B"];

// ═══════════════════════════════════════════════════════════════
// SEARCH ENGINES & DATABASES
// ═══════════════════════════════════════════════════════════════
const SEARCH_ENGINES = [
  { id: "google_scholar", name: "Google Scholar", url: q => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`, desc: "Broadest academic search engine" },
  { id: "semantic", name: "Semantic Scholar", url: q => `https://www.semanticscholar.org/search?q=${encodeURIComponent(q)}`, desc: "AI-curated papers with TLDR summaries", api: true },
  { id: "pubmed", name: "PubMed / PMC", url: q => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`, desc: "Biomedical & life sciences (NLM/NIH)", api: true },
  { id: "crossref", name: "CrossRef", url: q => `https://search.crossref.org/?from_ui=yes&q=${encodeURIComponent(q)}`, desc: "DOI metadata & citation linking", api: true },
  { id: "core", name: "CORE", url: q => `https://core.ac.uk/search?q=${encodeURIComponent(q)}`, desc: "Open access repository aggregator (200M+ papers)" },
  { id: "doaj", name: "DOAJ", url: q => `https://doaj.org/search/articles?ref=homepage-box&source={"query":{"query_string":{"query":"${encodeURIComponent(q)}"}}}`, desc: "Directory of Open Access Journals" },
  { id: "base", name: "BASE (Bielefeld)", url: q => `https://www.base-search.net/Search/Results?lookfor=${encodeURIComponent(q)}`, desc: "380M+ documents from 11,000+ sources" },
  { id: "dimensions", name: "Dimensions", url: q => `https://app.dimensions.ai/discover/publication?search_text=${encodeURIComponent(q)}`, desc: "Linked research data (Digital Science)" },
  { id: "lens", name: "The Lens", url: q => `https://www.lens.org/lens/search/scholar/list?q=${encodeURIComponent(q)}`, desc: "Open scholarly & patent data" },
  { id: "biorxiv", name: "bioRxiv", url: q => `https://www.biorxiv.org/search/${encodeURIComponent(q)}`, desc: "Biology preprints (Cold Spring Harbor)" },
  { id: "arxiv", name: "arXiv", url: q => `https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(q)}`, desc: "Physics, math, CS, quantitative biology preprints" },
  { id: "eartharxiv", name: "EarthArXiv", url: q => `https://eartharxiv.org/repository/search/?search=${encodeURIComponent(q)}`, desc: "Earth science preprints" },
  { id: "unpaywall", name: "Unpaywall", url: q => `https://unpaywall.org/products/extension`, desc: "Browser extension to find legal free PDFs" },
  { id: "openaire", name: "OpenAIRE", url: q => `https://explore.openaire.eu/search/find?q=${encodeURIComponent(q)}`, desc: "European open science infrastructure" },
  { id: "scielo", name: "SciELO", url: q => `https://search.scielo.org/?q=${encodeURIComponent(q)}`, desc: "Latin American & Caribbean journals" },
  { id: "researchgate", name: "ResearchGate", url: q => `https://www.researchgate.net/search?q=${encodeURIComponent(q)}`, desc: "Author preprints & networking" },
  { id: "zenodo", name: "Zenodo", url: q => `https://zenodo.org/search?q=${encodeURIComponent(q)}`, desc: "Open datasets & papers (CERN)" },
  { id: "dryad", name: "Dryad", url: q => `https://datadryad.org/search?q=${encodeURIComponent(q)}`, desc: "Research data repository" },
  { id: "jstor", name: "JSTOR", url: q => `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`, desc: "Historical journal archives" },
  { id: "scopus", name: "Scopus", url: q => `https://www.scopus.com/results/results.uri?sort=plf-f&src=s&sot=b&sdt=b&sl=50&s=TITLE-ABS-KEY(${encodeURIComponent(q)})`, desc: "Elsevier abstract/citation database" },
  // Grey Literature
  { id: "fao", name: "FAO Documents", url: q => `https://www.fao.org/publications/search/en/?query=${encodeURIComponent(q)}`, desc: "UN Food & Agriculture Organization", grey: true },
  { id: "ices", name: "ICES Library", url: q => `https://www.ices.dk/publications/library/Pages/default.aspx`, desc: "Intl Council for Exploration of the Sea", grey: true },
  { id: "noaa_pubs", name: "NOAA Publications", url: q => `https://repository.library.noaa.gov/gsearch?terms=${encodeURIComponent(q)}`, desc: "NOAA institutional repository", grey: true },
  { id: "worldbank", name: "World Bank Open Knowledge", url: q => `https://openknowledge.worldbank.org/search?query=${encodeURIComponent(q)}`, desc: "Development research & reports", grey: true },
  { id: "unep", name: "UNEP Publications", url: q => `https://www.unep.org/resources?search_api_fulltext=${encodeURIComponent(q)}`, desc: "UN Environment Programme", grey: true },
  { id: "iucn", name: "IUCN Library", url: q => `https://portals.iucn.org/library/dir/publications-list?field_pub_organization_tid=All&title=${encodeURIComponent(q)}`, desc: "Conservation publications", grey: true },
];

// ═══════════════════════════════════════════════════════════════
// SPECIES DATABASES
// ═══════════════════════════════════════════════════════════════
const SPECIES_DBS = [
  { name: "FishBase", url: q => `https://www.fishbase.se/search.php?CommonName=${encodeURIComponent(q)}`, desc: "Comprehensive fish species database", api: true },
  { name: "SeaLifeBase", url: q => `https://www.sealifebase.ca/search.php?CommonName=${encodeURIComponent(q)}`, desc: "Non-fish marine organisms" },
  { name: "WoRMS", url: q => `https://www.marinespecies.org/aphia.php?p=taxlist&tName=${encodeURIComponent(q)}`, desc: "World Register of Marine Species — authoritative taxonomy" },
  { name: "GBIF", url: q => `https://www.gbif.org/species/search?q=${encodeURIComponent(q)}`, desc: "Global Biodiversity Information Facility — occurrence records" },
  { name: "OBIS", url: q => `https://obis.org/taxon/${encodeURIComponent(q)}`, desc: "Ocean Biodiversity Information System" },
  { name: "IUCN Red List", url: q => `https://www.iucnredlist.org/search?query=${encodeURIComponent(q)}`, desc: "Conservation status assessments" },
  { name: "Catalog of Fishes", url: q => `https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatmain.asp`, desc: "California Academy — taxonomic authority" },
  { name: "ITIS", url: q => `https://www.itis.gov/servlet/SingleRpt/SingleRpt?search_topic=Scientific_Name&search_value=${encodeURIComponent(q)}`, desc: "Integrated Taxonomic Information System" },
  { name: "AlgaeBase", url: q => `https://www.algaebase.org/search/?genus=${encodeURIComponent(q)}`, desc: "Algae taxonomy & distribution" },
  { name: "Marine Species ID Portal", url: q => `https://species-identification.org`, desc: "Visual identification guides" },
  { name: "FAO Species Fact Sheets", url: q => `https://www.fao.org/fishery/en/search?q=${encodeURIComponent(q)}`, desc: "FAO aquatic species profiles" },
  { name: "RAM Legacy Stock DB", url: () => `https://www.ramlegacy.org`, desc: "Global stock assessment database" },
  { name: "FishStatJ (FAO)", url: () => `https://www.fao.org/fishery/en/statistics/software/fishstatj`, desc: "Global fishery production statistics" },
  { name: "Global Fishing Watch", url: () => `https://globalfishingwatch.org/map`, desc: "Satellite vessel tracking & fishing effort" },
  { name: "AquaMaps", url: q => `https://www.aquamaps.org/search.php?genus=${encodeURIComponent(q)}`, desc: "Species distribution predictions" },
  { name: "GenBank", url: q => `https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(q)}`, desc: "Genetic sequence database" },
  { name: "BOLD Systems", url: q => `https://boldsystems.org/index.php/Taxbrowser_Taxonpage?searchTerm=${encodeURIComponent(q)}`, desc: "DNA barcoding database" },
];

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENTAL DATA PORTALS
// ═══════════════════════════════════════════════════════════════
const ENV_PORTALS = [
  { cat: "Oceanographic", items: [
    { name: "NOAA ERDDAP", url: "https://coastwatch.pfeg.noaa.gov/erddap/index.html", desc: "Gridded ocean data server — SST, chlorophyll, salinity, currents" },
    { name: "Copernicus Marine (CMEMS)", url: "https://marine.copernicus.eu", desc: "EU ocean monitoring — reanalysis, forecasts, satellite products" },
    { name: "NASA Ocean Color", url: "https://oceancolor.gsfc.nasa.gov", desc: "MODIS/VIIRS — chlorophyll, SST, PAR, Kd490" },
    { name: "World Ocean Atlas", url: "https://www.ncei.noaa.gov/products/world-ocean-atlas", desc: "T, S, O₂, PO₄, NO₃, SiO₄ climatologies" },
    { name: "HYCOM", url: "https://www.hycom.org", desc: "Hybrid Coordinate Ocean Model — circulation data" },
    { name: "ARGO", url: "https://argo.ucsd.edu", desc: "3,800+ profiling floats — T/S profiles to 2000m" },
    { name: "SODA (Simple Ocean Data Assimilation)", url: "https://www2.atmos.umd.edu/~ocean/", desc: "Ocean reanalysis since 1958" },
    { name: "GLORYS (Mercator)", url: "https://marine.copernicus.eu", desc: "Global 1/12° ocean reanalysis" },
  ]},
  { cat: "Atmospheric & Climate", items: [
    { name: "NOAA GML (Mauna Loa CO₂)", url: "https://gml.noaa.gov/ccgg/trends/", desc: "Atmospheric CO₂, CH₄, N₂O concentrations" },
    { name: "NCEP/NCAR Reanalysis", url: "https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.html", desc: "Atmospheric reanalysis data since 1948" },
    { name: "ERA5 (ECMWF)", url: "https://cds.climate.copernicus.eu", desc: "Global atmospheric reanalysis — wind, precip, temp, pressure" },
    { name: "NASA GISS Surface Temp", url: "https://data.giss.nasa.gov/gistemp/", desc: "Global surface temperature anomalies" },
    { name: "NOAA Climate Data Online", url: "https://www.ncdc.noaa.gov/cdo-web/", desc: "Historical weather & climate data" },
    { name: "CRU (Climate Research Unit)", url: "https://crudata.uea.ac.uk/cru/data/hrg/", desc: "Gridded climate dataset — temp, precip" },
    { name: "IPCC Data Portal", url: "https://www.ipcc-data.org", desc: "Climate model outputs & scenarios" },
  ]},
  { cat: "Satellite & Remote Sensing", items: [
    { name: "NASA Earthdata", url: "https://earthdata.nasa.gov", desc: "Gateway to all NASA Earth observation data" },
    { name: "NOAA CoastWatch", url: "https://coastwatch.noaa.gov", desc: "Near-real-time satellite ocean data" },
    { name: "Sentinel Hub", url: "https://www.sentinel-hub.com/explore/eobrowser/", desc: "ESA Sentinel satellite imagery" },
    { name: "Google Earth Engine", url: "https://earthengine.google.com", desc: "Planetary-scale geospatial analysis" },
    { name: "GEBCO Bathymetry", url: "https://www.gebco.net", desc: "Global ocean floor topography" },
    { name: "ETOPO Global Relief", url: "https://www.ncei.noaa.gov/products/etopo-global-relief-model", desc: "Combined topo-bathymetric elevation" },
  ]},
  { cat: "Biogeochemical", items: [
    { name: "GLODAP", url: "https://www.glodap.info", desc: "Global ocean carbon & biogeochemistry" },
    { name: "SOCAT", url: "https://www.socat.info", desc: "Surface ocean CO₂ observations" },
    { name: "Ocean Acidification Data Portal", url: "https://www.nodc.noaa.gov/oads/", desc: "pH, pCO₂, alkalinity measurements" },
    { name: "PANGAEA", url: "https://www.pangaea.de", desc: "Earth & environmental science data archive" },
    { name: "Bio-ORACLE", url: "https://www.bio-oracle.org", desc: "Marine environmental layers for species modeling" },
    { name: "MARSPEC", url: "http://www.marspec.org", desc: "Ocean climate layers for ecological niche modeling" },
  ]},
  { cat: "Fisheries & Effort", items: [
    { name: "Global Fishing Watch", url: "https://globalfishingwatch.org/map", desc: "AIS-based fishing effort maps" },
    { name: "FAO FishStatJ", url: "https://www.fao.org/fishery/en/statistics/software/fishstatj", desc: "Global capture & aquaculture production" },
    { name: "Sea Around Us", url: "https://www.seaaroundus.org", desc: "Reconstructed catch data by EEZ" },
    { name: "ICES Stock Assessment Graphs", url: "https://standardgraphs.ices.dk/stockList.aspx", desc: "European stock status & advice" },
    { name: "NOAA Fisheries Data", url: "https://www.fisheries.noaa.gov/resources/data", desc: "US fisheries landings, surveys, observer data" },
    { name: "GFCM Data Collection", url: "https://www.fao.org/gfcm/data/en/", desc: "Mediterranean & Black Sea fisheries data" },
  ]},
];

// ═══════════════════════════════════════════════════════════════
// API SEARCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function reconstructAbstract(inverted) {
  if (!inverted) return null;
  const words = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.join(" ").slice(0, 500);
}

async function searchOpenAlexAPI(query, filters = {}) {
  const params = new URLSearchParams({ search: query, per_page: "20", sort: "relevance_score:desc", mailto: "researcher@meridian.app" });
  if (filters.yearFrom) params.append("filter", `from_publication_date:${filters.yearFrom}-01-01`);
  if (filters.yearTo) params.append("filter", `to_publication_date:${filters.yearTo}-12-31`);
  if (filters.openAccess) params.append("filter", "is_oa:true");
  const res = await fetch(`https://api.openalex.org/works?${params}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data.results.map(w => ({
    id: w.id, title: w.title,
    authors: (w.authorships||[]).slice(0,5).map(a => a.author?.display_name).filter(Boolean),
    year: w.publication_year, journal: w.primary_location?.source?.display_name || "",
    doi: w.doi, citedBy: w.cited_by_count||0,
    isOA: w.open_access?.is_oa||false, oaUrl: w.open_access?.oa_url||null,
    pdfUrl: w.best_oa_location?.pdf_url||null,
    abstract: reconstructAbstract(w.abstract_inverted_index),
    concepts: (w.concepts||[]).slice(0,6).map(c => c.display_name),
    source: "Multi-Source", type: w.type, url: w.doi||w.id,
  }));
}

async function searchSemanticScholarAPI(query, filters = {}) {
  const params = new URLSearchParams({ query, limit: "20", fields: "title,authors,year,venue,externalIds,citationCount,isOpenAccess,openAccessPdf,abstract,tldr,fieldsOfStudy" });
  if (filters.yearFrom || filters.yearTo) params.append("year", `${filters.yearFrom||"1900"}-${filters.yearTo||"2026"}`);
  const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.data||[]).map(p => ({
    id: p.paperId, title: p.title,
    authors: (p.authors||[]).slice(0,5).map(a => a.name),
    year: p.year, journal: p.venue || "",
    doi: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null,
    citedBy: p.citationCount||0,
    isOA: p.isOpenAccess||false, oaUrl: p.openAccessPdf?.url||null, pdfUrl: p.openAccessPdf?.url||null,
    abstract: p.tldr?.text || (p.abstract ? p.abstract.slice(0,500) : null),
    concepts: p.fieldsOfStudy||[],
    source: "Semantic Scholar", type: "article",
    url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : `https://www.semanticscholar.org/paper/${p.paperId}`,
  }));
}

async function searchCrossRefAPI(query) {
  const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=15&sort=relevance&order=desc&mailto=researcher@meridian.app`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.message?.items||[]).map(w => ({
    id: w.DOI, title: Array.isArray(w.title) ? w.title[0] : w.title||"Untitled",
    authors: (w.author||[]).slice(0,5).map(a => `${a.given||""} ${a.family||""}`),
    year: w.published?.["date-parts"]?.[0]?.[0], journal: w["container-title"]?.[0]||"",
    doi: `https://doi.org/${w.DOI}`, citedBy: w["is-referenced-by-count"]||0,
    isOA: w.license?.some(l => l.URL?.includes("creativecommons"))||false,
    abstract: w.abstract ? w.abstract.replace(/<[^>]+>/g,"").slice(0,500) : null,
    concepts: w.subject||[], source: "CrossRef", type: w.type, url: `https://doi.org/${w.DOI}`,
  }));
}

async function searchPubMedAPI(query) {
  const sRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=15&sort=relevance&retmode=json`);
  if (!sRes.ok) throw new Error("Search failed");
  const sData = await sRes.json();
  const ids = sData.esearchresult?.idlist||[];
  if (!ids.length) return [];
  const dRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`);
  if (!dRes.ok) return [];
  const dData = await dRes.json();
  return ids.map(id => {
    const item = dData.result?.[id]; if (!item) return null;
    return {
      id: `pm-${id}`, title: item.title||"Untitled",
      authors: (item.authors||[]).slice(0,5).map(a => a.name), year: parseInt(item.pubdate)||null,
      journal: item.fulljournalname||item.source||"", citedBy: null,
      isOA: false, abstract: null, concepts: [], source: "PubMed", type: "article",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, pmid: id,
    };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════
function LoadingBar() {
  return (
    <div style={{ padding: "40px 0", display: "flex", justifyContent: "center", gap: 8 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: T.accent,
          animation: `glow 1.4s ease-in-out ${i*0.15}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function Badge({ children, color = T.accent, bg }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 3, letterSpacing: 0.4,
      fontFamily: "'Inconsolata', monospace", textTransform: "uppercase",
      background: bg || `${color}22`, color, border: `1px solid ${color}33`,
    }}>{children}</span>
  );
}

function Btn({ children, onClick, active, color = T.accent, small, disabled, style: sx }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontSize: small ? 11 : 13, padding: small ? "4px 10px" : "8px 16px", borderRadius: 4,
      border: `1px solid ${active ? `${color}55` : T.border}`,
      background: active ? `${color}18` : "transparent",
      color: active ? color : T.textMuted, cursor: disabled ? "default" : "pointer",
      fontFamily: "'Inconsolata', monospace", transition: "all 0.2s", opacity: disabled ? 0.4 : 1,
      ...sx,
    }}>{children}</button>
  );
}

function Section({ title, children, collapsible, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div onClick={() => collapsible && setOpen(!open)} style={{
        padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: collapsible ? "pointer" : "default", borderBottom: open ? `1px solid ${T.border}` : "none",
      }}>
        <h4 style={{ margin: 0, fontSize: 11, color: T.textMuted, fontFamily: "'Inconsolata', monospace", letterSpacing: 1, textTransform: "uppercase" }}>{title}</h4>
        {collapsible && <span style={{ color: T.textDim, fontSize: 12 }}>{open ? "▾" : "▸"}</span>}
      </div>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

function PaperCard({ paper, idx, onAddToWorkshop }) {
  const [open, setOpen] = useState(false);
  const tierColor = paper.isOA ? T.sage : T.textDim;
  return (
    <div onClick={() => setOpen(!open)} style={{
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: "14px 18px", marginBottom: 8, cursor: "pointer", transition: "all 0.2s",
      animation: `fadeIn 0.3s ease ${idx*0.03}s both`,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = T.accentBorder}
    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {paper.isOA && <Badge color={T.sage}>Open Access</Badge>}
            {paper.year && <Badge color={T.textMuted}>{paper.year}</Badge>}
            {paper.type && paper.type !== "article" && <Badge color={T.lavender}>{paper.type}</Badge>}
          </div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.45, fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            {paper.title}
          </h3>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: T.textMuted, lineHeight: 1.3 }}>
            {paper.authors?.join(", ")}
            {paper.journal && <span style={{ color: T.textDim }}> — {paper.journal}</span>}
          </p>
        </div>
        {paper.citedBy != null && (
          <div style={{ textAlign: "right", flexShrink: 0, fontFamily: "'Inconsolata', monospace" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{paper.citedBy.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: T.textDim }}>cited</div>
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {paper.abstract && <p style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, margin: "0 0 10px" }}>{paper.abstract}</p>}
          {paper.concepts?.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {paper.concepts.map((c,i) => <Badge key={i} color={T.textDim}>{c}</Badge>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {paper.url && <a href={paper.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize: 11, color: T.accent, textDecoration: "none", padding: "3px 10px", borderRadius: 3, border: `1px solid ${T.accentBorder}` }}>View Source →</a>}
            {paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize: 11, color: T.sage, textDecoration: "none", padding: "3px 10px", borderRadius: 3, border: `1px solid ${T.sageBorder}` }}>PDF ↓</a>}
            {paper.oaUrl && paper.oaUrl !== paper.pdfUrl && <a href={paper.oaUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize: 11, color: T.warning, textDecoration: "none", padding: "3px 10px", borderRadius: 3, border: "1px solid rgba(212,160,74,0.25)" }}>Free Copy →</a>}
            {paper.pmid && <a href={`https://www.ncbi.nlm.nih.gov/pmc/articles/pmid/${paper.pmid}/`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize: 11, color: T.lavender, textDecoration: "none", padding: "3px 10px", borderRadius: 3, border: `1px solid ${T.lavender}33` }}>Check PMC</a>}
            <button onClick={e => { e.stopPropagation(); onAddToWorkshop?.(paper); }} style={{ fontSize: 11, color: T.coral, padding: "3px 10px", borderRadius: 3, border: `1px solid ${T.coral}33`, background: "transparent", cursor: "pointer" }}>+ Workshop</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: LITERATURE SEARCH
// ═══════════════════════════════════════════════════════════════
function LiteratureTab({ onAddToWorkshop }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ yearFrom: "", yearTo: "", openAccess: false, sortBy: "relevance" });
  const [stats, setStats] = useState(null);
  const [showEngines, setShowEngines] = useState(false);
  const [showJournals, setShowJournals] = useState(false);
  const [journalFilter, setJournalFilter] = useState({ field: "", tier: "", oa: "", search: "" });

  const filteredJournals = useMemo(() => {
    return JOURNALS.filter(j =>
      (!journalFilter.field || j.field === journalFilter.field) &&
      (!journalFilter.tier || j.tier === journalFilter.tier) &&
      (!journalFilter.oa || j.oa === journalFilter.oa) &&
      (!journalFilter.search || j.name.toLowerCase().includes(journalFilter.search.toLowerCase()))
    );
  }, [journalFilter]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]);
    const all = [];
    const fns = [searchOpenAlexAPI, searchSemanticScholarAPI, searchCrossRefAPI, searchPubMedAPI];
    const res = await Promise.allSettled(fns.map(fn => fn(query, filters)));
    res.forEach(r => { if (r.status === "fulfilled") all.push(...r.value); });
    const seen = new Set();
    const deduped = all.filter(r => {
      const k = r.title?.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,50);
      if (!k || seen.has(k)) return false; seen.add(k); return true;
    });
    let sorted = deduped;
    if (filters.sortBy === "citations") sorted = [...deduped].sort((a,b) => (b.citedBy||0)-(a.citedBy||0));
    if (filters.sortBy === "year") sorted = [...deduped].sort((a,b) => (b.year||0)-(a.year||0));
    if (filters.openAccess) sorted = sorted.filter(r => r.isOA);
    setResults(sorted);
    setStats({ total: sorted.length, oa: sorted.filter(r => r.isOA).length });
    setLoading(false);
  };

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && search()}
          placeholder="Search across academic databases..."
          style={{ flex: 1, padding: "11px 16px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 14, outline: "none", fontFamily: "'Libre Baskerville', serif" }}
        />
        <Btn onClick={search} active disabled={loading} style={{ fontWeight: 700 }}>{loading ? "Searching..." : "Search"}</Btn>
      </div>

      {/* Quick filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <input type="number" placeholder="From" value={filters.yearFrom} onChange={e => setFilters({...filters, yearFrom: e.target.value})}
            style={{ width: 65, padding: "5px 8px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, outline: "none", fontFamily: "'Inconsolata', monospace" }}/>
          <input type="number" placeholder="To" value={filters.yearTo} onChange={e => setFilters({...filters, yearTo: e.target.value})}
            style={{ width: 65, padding: "5px 8px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, outline: "none", fontFamily: "'Inconsolata', monospace" }}/>
        </div>
        <Btn small active={filters.openAccess} color={T.sage} onClick={() => setFilters({...filters, openAccess: !filters.openAccess})}>Open Access</Btn>
        <select value={filters.sortBy} onChange={e => setFilters({...filters, sortBy: e.target.value})}
          style={{ padding: "5px 8px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
          <option value="relevance">Relevance</option>
          <option value="citations">Most Cited</option>
          <option value="year">Most Recent</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn small active={showEngines} onClick={() => { setShowEngines(!showEngines); setShowJournals(false); }}>Search Engines</Btn>
          <Btn small active={showJournals} color={T.lavender} onClick={() => { setShowJournals(!showJournals); setShowEngines(false); }}>Journals</Btn>
        </div>
      </div>

      {/* External search engines panel */}
      {showEngines && (
        <Section title="Academic Search Engines & Databases" collapsible={false}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: T.textDim, margin: "0 0 8px" }}>Click any engine to search with your current query. Engines with API are included in main search results automatically.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
            {SEARCH_ENGINES.map(se => (
              <a key={se.id} href={query ? se.url(query) : "#"} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 5, textDecoration: "none", transition: "all 0.2s", opacity: query ? 1 : 0.5 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.accentBorder}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, display: "flex", gap: 5, alignItems: "center" }}>
                    {se.name}
                    {se.api && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 2, background: T.sageMuted, color: T.sage }}>API</span>}
                    {se.grey && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 2, background: T.lavenderMuted, color: T.lavender }}>Grey Lit</span>}
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{se.desc}</div>
                </div>
                <span style={{ color: T.textDim, fontSize: 11 }}>↗</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Journals panel */}
      {showJournals && (
        <Section title={`Scientific Journals (${filteredJournals.length} of ${JOURNALS.length})`} collapsible={false}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input placeholder="Search journals..." value={journalFilter.search} onChange={e => setJournalFilter({...journalFilter, search: e.target.value})}
              style={{ flex: "1 1 160px", padding: "5px 10px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, outline: "none", fontFamily: "'Inconsolata', monospace" }}/>
            <select value={journalFilter.field} onChange={e => setJournalFilter({...journalFilter, field: e.target.value})}
              style={{ padding: "5px 8px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
              <option value="">All Fields</option>
              {JOURNAL_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={journalFilter.tier} onChange={e => setJournalFilter({...journalFilter, tier: e.target.value})}
              style={{ padding: "5px 8px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
              <option value="">All Tiers</option>
              <option value="S">S — Flagship</option>
              <option value="A">A — Top Field</option>
              <option value="B">B — Established</option>
            </select>
            <select value={journalFilter.oa} onChange={e => setJournalFilter({...journalFilter, oa: e.target.value})}
              style={{ padding: "5px 8px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
              <option value="">All Access</option>
              <option value="Full OA">Full Open Access</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div style={{ maxHeight: 350, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Journal","Field","Tier","Access","Publisher"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: T.textDim, fontFamily: "'Inconsolata', monospace", fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{filteredJournals.map((j,i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bgElevated}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "6px 8px", color: T.text, fontFamily: "'Libre Baskerville', serif" }}>{j.name}</td>
                  <td style={{ padding: "6px 8px", color: T.textMuted }}>{j.field}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: j.tier === "S" ? T.accent : j.tier === "A" ? T.sage : T.textMuted, fontFamily: "'Inconsolata', monospace", fontWeight: 700 }}>{j.tier}</span>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ fontSize: 10, color: j.oa === "Full OA" ? T.sage : T.textDim }}>{j.oa}</span>
                  </td>
                  <td style={{ padding: "6px 8px", color: T.textDim, fontSize: 11 }}>{j.publisher}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Stats */}
      {stats && !loading && (
        <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'Inconsolata', monospace", marginBottom: 10, animation: "fadeIn 0.3s ease" }}>
          <span style={{ color: T.accent, fontWeight: 700 }}>{stats.total}</span> results · <span style={{ color: T.sage }}>{stats.oa}</span> open access
        </div>
      )}

      {loading && <LoadingBar />}
      {results.map((p,i) => <PaperCard key={p.id+i} paper={p} idx={i} onAddToWorkshop={onAddToWorkshop} />)}

      {!loading && results.length === 0 && !query && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.25 }}>◉</div>
          <h2 style={{ fontSize: 16, color: T.textDim, fontWeight: 400, fontFamily: "'Libre Baskerville', serif", margin: "0 0 8px" }}>Multi-source academic literature search</h2>
          <p style={{ fontSize: 12, color: T.textDim, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Simultaneously queries 4 APIs, deduplicates results, and links to 25+ additional search engines and databases. Click any result to expand details, find PDFs, and add data to your workshop.
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            {["Sparidae otolith microchemistry","demersal fish climate Mediterranean","marine protected area spillover","CPUE standardization GLM"].map(s => (
              <button key={s} onClick={() => setQuery(s)} style={{ fontSize: 10, padding: "5px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: "transparent", color: T.textDim, cursor: "pointer", fontFamily: "'Inconsolata', monospace" }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && results.some(r => !r.isOA) && (
        <div style={{ marginTop: 16, padding: 14, background: `${T.warning}08`, border: `1px solid ${T.warning}20`, borderRadius: 6, fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
          <strong style={{ color: T.warning }}>Finding paywalled papers:</strong> Use the{" "}
          <a href="https://unpaywall.org/products/extension" target="_blank" rel="noopener" style={{ color: T.warning }}>Unpaywall extension</a>, check{" "}
          <a href="https://core.ac.uk" target="_blank" rel="noopener" style={{ color: T.warning }}>CORE</a> /{" "}
          <a href="https://www.base-search.net" target="_blank" rel="noopener" style={{ color: T.warning }}>BASE</a> repositories, search preprint servers ({" "}
          <a href="https://www.biorxiv.org" target="_blank" rel="noopener" style={{ color: T.warning }}>bioRxiv</a>,{" "}
          <a href="https://arxiv.org" target="_blank" rel="noopener" style={{ color: T.warning }}>arXiv</a>), check{" "}
          <a href="https://www.researchgate.net" target="_blank" rel="noopener" style={{ color: T.warning }}>ResearchGate</a> for author copies, or use interlibrary loan.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: SPECIES
// ═══════════════════════════════════════════════════════════════
function SpeciesTab() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("common");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      let url;
      if (searchType === "genus") url = `https://fishbase.ropensci.org/species?Genus=${encodeURIComponent(query)}&limit=15`;
      else if (searchType === "scientific") {
        const [g, s] = query.trim().split(/\s+/);
        url = s ? `https://fishbase.ropensci.org/species?Genus=${encodeURIComponent(g)}&Species=${encodeURIComponent(s)}&limit=15`
               : `https://fishbase.ropensci.org/species?Genus=${encodeURIComponent(g)}&limit=15`;
      } else url = `https://fishbase.ropensci.org/species?FBname=${encodeURIComponent(query)}&limit=15`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["common","Common Name"],["genus","Genus"],["scientific","Binomial"]].map(([k,l]) => (
            <Btn key={k} small active={searchType===k} onClick={() => setSearchType(k)}>{l}</Btn>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter"&&search()}
            placeholder={searchType==="common"?"e.g. Gilthead seabream":searchType==="genus"?"e.g. Sparus":"e.g. Sparus aurata"}
            style={{ flex: 1, padding: "10px 14px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 14, outline: "none", fontFamily: "'Libre Baskerville', serif" }}/>
          <Btn onClick={search} active>Search FishBase</Btn>
        </div>
      </div>

      {loading && <LoadingBar />}
      {results && results.length === 0 && <p style={{ color: T.textDim, textAlign: "center", padding: 30, fontSize: 13 }}>No species found. Try a different search type or spelling.</p>}
      {results && results.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {results.map((sp, i) => (
            <div key={i} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, animation: `fadeIn 0.3s ease ${i*0.04}s both` }}>
              <h3 style={{ margin: 0, fontSize: 15, color: T.accent, fontStyle: "italic", fontFamily: "'Libre Baskerville', serif" }}>
                {sp.Genus} {sp.Species}
              </h3>
              {sp.FBname && <p style={{ margin: "3px 0 0", fontSize: 13, color: T.text }}>{sp.FBname}</p>}
              {sp.Family && <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textDim, fontFamily: "'Inconsolata', monospace" }}>
                {[sp.Class, sp.Order, sp.Family].filter(Boolean).join(" → ")}
              </p>}
              <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: T.textMuted, fontFamily: "'Inconsolata', monospace", flexWrap: "wrap" }}>
                {sp.DepthRangeShallow != null && <span>Depth: {sp.DepthRangeShallow}–{sp.DepthRangeDeep||"?"}m</span>}
                {sp.LongevityWild && <span>Longevity: {sp.LongevityWild} yr</span>}
                {sp.Length && <span>Length: {sp.Length} cm</span>}
                {sp.Weight && <span>Weight: {sp.Weight} g</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <a href={`https://www.fishbase.se/summary/${sp.Genus}-${sp.Species}.html`} target="_blank" rel="noopener" style={{ fontSize: 10, color: T.accent, textDecoration: "none", padding: "3px 8px", borderRadius: 3, border: `1px solid ${T.accentBorder}` }}>FishBase →</a>
                <a href={`https://www.gbif.org/species/search?q=${sp.Genus}+${sp.Species}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: T.sage, textDecoration: "none", padding: "3px 8px", borderRadius: 3, border: `1px solid ${T.sageBorder}` }}>GBIF →</a>
                <a href={`https://www.marinespecies.org/aphia.php?p=taxlist&tName=${sp.Genus}+${sp.Species}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: T.lavender, textDecoration: "none", padding: "3px 8px", borderRadius: 3, border: `1px solid ${T.lavender}33` }}>WoRMS →</a>
                <a href={`https://www.iucnredlist.org/search?query=${sp.Genus}+${sp.Species}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: T.coral, textDecoration: "none", padding: "3px 8px", borderRadius: 3, border: `1px solid ${T.coral}33` }}>IUCN →</a>
                <a href={`https://obis.org/taxon/${encodeURIComponent(sp.Genus+" "+sp.Species)}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: T.warning, textDecoration: "none", padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(212,160,74,0.25)" }}>OBIS →</a>
              </div>
            </div>
          ))}
        </div>
      )}

      <Section title="All Species & Taxonomy Databases" collapsible defaultOpen={!results || results.length === 0}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
          {SPECIES_DBS.map(db => (
            <a key={db.name} href={query ? db.url(query) : db.url("")} target="_blank" rel="noopener"
              style={{ display: "block", padding: "8px 12px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 5, textDecoration: "none", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.accentBorder}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{db.name}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{db.desc}</div>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ENVIRONMENTAL DATA
// ═══════════════════════════════════════════════════════════════
function EnvironmentalTab() {
  const [lat, setLat] = useState("36.13");
  const [lon, setLon] = useState("-5.35");
  const [loading, setLoading] = useState(false);
  const [envData, setEnvData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const r = {};
    try {
      const res = await fetch(`https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.json?sst[(last)][(0.0)][(${lat}):1:(${lat})][(${lon}):1:(${lon})]`);
      if (res.ok) { const d = await res.json(); const v = d?.table?.rows?.[0]?.[3]; if (v!=null) r.SST = { value: v.toFixed(2), unit: "°C", src: "NOAA OISST v2.1" }; }
    } catch {}
    try {
      const res = await fetch(`https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdMH1chlamday_LonPM180.json?chlorophyll[(last)][(${lat}):1:(${lat})][(${lon}):1:(${lon})]`);
      if (res.ok) { const d = await res.json(); const v = d?.table?.rows?.[0]?.[2]; if (v!=null) r["Chlorophyll-a"] = { value: v.toFixed(4), unit: "mg/m³", src: "MODIS Aqua" }; }
    } catch {}
    try {
      const res = await fetch("https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv");
      if (res.ok) { const txt = await res.text(); const lines = txt.trim().split("\n").filter(l => !l.startsWith("#")&&l.trim()); const last = lines[lines.length-1].split(","); r["Atmospheric CO₂"] = { value: parseFloat(last[last.length-1])||parseFloat(last[4]), unit: "ppm", src: "NOAA Mauna Loa" }; }
    } catch {}
    setEnvData(r);
    setLoading(false);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
        Query live environmental datasets from NOAA, NASA, and global observation networks. Enter ocean coordinates to fetch current conditions, then explore the full portal directory below.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", display: "block", marginBottom: 3 }}>LAT</label>
          <input value={lat} onChange={e => setLat(e.target.value)} style={{ width: 80, padding: "8px 10px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inconsolata', monospace" }}/>
        </div>
        <div>
          <label style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", display: "block", marginBottom: 3 }}>LON</label>
          <input value={lon} onChange={e => setLon(e.target.value)} style={{ width: 80, padding: "8px 10px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inconsolata', monospace" }}/>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <Btn onClick={fetchData} active>{loading ? "Fetching..." : "Fetch Live Data"}</Btn>
        </div>
      </div>

      {loading && <LoadingBar />}
      {envData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginBottom: 20 }}>
          {Object.entries(envData).map(([k,d]) => (
            <div key={k} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", textTransform: "uppercase", marginBottom: 6 }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.accent, fontFamily: "'Inconsolata', monospace" }}>
                {d.value}<span style={{ fontSize: 11, fontWeight: 400, color: T.textMuted, marginLeft: 4 }}>{d.unit}</span>
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>{d.src}</div>
            </div>
          ))}
        </div>
      )}

      {ENV_PORTALS.map(cat => (
        <Section key={cat.cat} title={cat.cat} collapsible defaultOpen={true}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
            {cat.items.map(p => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener"
                style={{ display: "block", padding: "8px 12px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 5, textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.accentBorder}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{p.desc}</div>
              </a>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: DATA WORKSHOP
// ═══════════════════════════════════════════════════════════════
function DataWorkshop({ workshopData, setWorkshopData }) {
  const [rawInput, setRawInput] = useState("Year,SST,Chlorophyll,CPUE,Category\n2018,18.2,0.45,12.3,High\n2019,18.7,0.38,11.1,Medium\n2020,19.1,0.42,10.8,Medium\n2021,19.5,0.31,9.2,Low\n2022,19.8,0.35,8.5,Low\n2023,20.1,0.29,7.1,Low");
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [colTypes, setColTypes] = useState({});
  const [chartType, setChartType] = useState("line");
  const [xCol, setXCol] = useState("");
  const [yCols, setYCols] = useState([]);
  const [exportFormat, setExportFormat] = useState("csv");

  const parseData = useCallback(() => {
    const lines = rawInput.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(l => {
      const vals = l.split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => {
        const v = vals[i] || "";
        obj[h] = isNaN(v) || v === "" ? v : parseFloat(v);
      });
      return obj;
    });
    setColumns(headers);
    setData(rows);
    setXCol(headers[0]);
    setYCols(headers.slice(1, 3).filter(h => typeof rows[0]?.[h] === "number"));
    // Auto-detect types
    const types = {};
    headers.forEach(h => {
      const vals = rows.map(r => r[h]);
      const allNum = vals.every(v => typeof v === "number");
      if (allNum) {
        const unique = new Set(vals);
        types[h] = unique.size <= 10 && vals.every(v => Number.isInteger(v)) ? "ordinal" : "continuous";
      } else {
        const unique = new Set(vals);
        types[h] = unique.size <= 20 ? "categorical" : "text";
      }
    });
    setColTypes(types);
  }, [rawInput]);

  useEffect(() => { parseData(); }, []);

  const numericCols = columns.filter(c => colTypes[c] === "continuous" || colTypes[c] === "ordinal");

  const exportData = () => {
    if (exportFormat === "csv") {
      const csv = [columns.join(","), ...data.map(r => columns.map(c => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
      downloadFile(csv, "meridian_export.csv", "text/csv");
    } else if (exportFormat === "python") {
      const pyLines = [`import pandas as pd\n`, `data = {`];
      columns.forEach(c => {
        const vals = data.map(r => typeof r[c] === "string" ? `"${r[c]}"` : r[c]);
        pyLines.push(`    "${c}": [${vals.join(", ")}],`);
      });
      pyLines.push(`}\ndf = pd.DataFrame(data)\nprint(df.describe())\n`);
      downloadFile(pyLines.join("\n"), "meridian_export.py", "text/plain");
    } else if (exportFormat === "r") {
      const rLines = [`# R script generated by Meridian`, `library(tidyverse)\n`, `data <- tibble(`];
      columns.forEach((c, i) => {
        const vals = data.map(r => typeof r[c] === "string" ? `"${r[c]}"` : r[c]);
        rLines.push(`  \`${c}\` = c(${vals.join(", ")})${i < columns.length - 1 ? "," : ""}`);
      });
      rLines.push(`)\nsummary(data)\n`);
      downloadFile(rLines.join("\n"), "meridian_export.R", "text/plain");
    } else if (exportFormat === "excel") {
      const tsv = [columns.join("\t"), ...data.map(r => columns.map(c => r[c] ?? "").join("\t"))].join("\n");
      downloadFile(tsv, "meridian_export.tsv", "text/tab-separated-values");
    }
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    if (!data.length || !xCol || yCols.length === 0) return <p style={{ color: T.textDim, textAlign: "center", padding: 30, fontSize: 12 }}>Select X and Y columns to visualize data.</p>;
    const chartData = data.map(r => ({ ...r }));
    const commonProps = { width: "100%", height: 300 };

    if (chartType === "line") return (
      <ResponsiveContainer {...commonProps}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke={T.border} />
          <XAxis dataKey={xCol} stroke={T.textDim} fontSize={11} />
          <YAxis stroke={T.textDim} fontSize={11} />
          <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          <Legend />
          {yCols.map((c, i) => <Line key={c} type="monotone" dataKey={c} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />)}
        </LineChart>
      </ResponsiveContainer>
    );
    if (chartType === "bar") return (
      <ResponsiveContainer {...commonProps}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke={T.border} />
          <XAxis dataKey={xCol} stroke={T.textDim} fontSize={11} />
          <YAxis stroke={T.textDim} fontSize={11} />
          <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          <Legend />
          {yCols.map((c, i) => <Bar key={c} dataKey={c} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
    if (chartType === "area") return (
      <ResponsiveContainer {...commonProps}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke={T.border} />
          <XAxis dataKey={xCol} stroke={T.textDim} fontSize={11} />
          <YAxis stroke={T.textDim} fontSize={11} />
          <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          <Legend />
          {yCols.map((c, i) => <Area key={c} type="monotone" dataKey={c} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={`${CHART_COLORS[i % CHART_COLORS.length]}33`} />)}
        </AreaChart>
      </ResponsiveContainer>
    );
    if (chartType === "scatter" && yCols.length >= 1) return (
      <ResponsiveContainer {...commonProps}>
        <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke={T.border} />
          <XAxis dataKey={xCol} name={xCol} stroke={T.textDim} fontSize={11} type="number" />
          <YAxis dataKey={yCols[0]} name={yCols[0]} stroke={T.textDim} fontSize={11} type="number" />
          <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          <Scatter data={chartData} fill={T.accent} />
        </ScatterChart>
      </ResponsiveContainer>
    );
    if (chartType === "pie") {
      const pieData = chartData.map(r => ({ name: String(r[xCol]), value: r[yCols[0]] || 0 }));
      return (
        <ResponsiveContainer {...commonProps}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "radar" && yCols.length >= 1) {
      return (
        <ResponsiveContainer {...commonProps}>
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={100}>
            <PolarGrid stroke={T.border} />
            <PolarAngleAxis dataKey={xCol} stroke={T.textDim} fontSize={10} />
            <PolarRadiusAxis stroke={T.textDim} fontSize={10} />
            {yCols.map((c, i) => <Radar key={c} dataKey={c} stroke={CHART_COLORS[i]} fill={`${CHART_COLORS[i]}33`} />)}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!data.length) return {};
    const stats = {};
    numericCols.forEach(c => {
      const vals = data.map(r => r[c]).filter(v => typeof v === "number" && !isNaN(v));
      if (!vals.length) return;
      const sorted = [...vals].sort((a, b) => a - b);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      stats[c] = {
        n: vals.length, min: sorted[0], max: sorted[sorted.length - 1],
        mean: mean.toFixed(3), median: sorted[Math.floor(sorted.length / 2)].toFixed(3),
        sd: Math.sqrt(variance).toFixed(3),
        cv: ((Math.sqrt(variance) / mean) * 100).toFixed(1),
      };
    });
    return stats;
  }, [data, numericCols]);

  return (
    <div>
      <Section title="Data Input — Paste CSV or Enter Manually" collapsible defaultOpen={true}>
        <textarea value={rawInput} onChange={e => setRawInput(e.target.value)} rows={8}
          style={{ width: "100%", boxSizing: "border-box", padding: 12, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 12, fontFamily: "'Inconsolata', monospace", outline: "none", resize: "vertical", lineHeight: 1.5 }}
          placeholder="Paste CSV data here: headers in first row, comma-separated..."/>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Btn onClick={parseData} active>Parse Data</Btn>
          <span style={{ fontSize: 11, color: T.textDim, alignSelf: "center" }}>
            {data.length > 0 && `${data.length} rows × ${columns.length} cols parsed`}
          </span>
        </div>
      </Section>

      {/* Column type detection */}
      {columns.length > 0 && (
        <Section title="Column Types (Auto-Detected — Click to Override)" collapsible>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {columns.map(c => (
              <div key={c} style={{ padding: "6px 10px", background: T.bgElevated, borderRadius: 4, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, color: T.text, marginBottom: 3 }}>{c}</div>
                <select value={colTypes[c] || "text"} onChange={e => setColTypes({ ...colTypes, [c]: e.target.value })}
                  style={{ padding: "3px 6px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3, color: T.accent, fontSize: 10, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
                  <option value="continuous">Continuous</option>
                  <option value="ordinal">Ordinal</option>
                  <option value="categorical">Categorical</option>
                  <option value="text">Text</option>
                  <option value="datetime">DateTime</option>
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Summary Statistics */}
      {Object.keys(summaryStats).length > 0 && (
        <Section title="Descriptive Statistics" collapsible>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Inconsolata', monospace" }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Variable", "n", "Min", "Max", "Mean", "Median", "SD", "CV%"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "right", color: T.textDim, fontSize: 10, fontWeight: 400, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{Object.entries(summaryStats).map(([col, s]) => (
                <tr key={col} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 10px", textAlign: "left", color: T.accent }}>{col}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.n}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.min}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.max}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.mean}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.median}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.sd}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: T.text }}>{s.cv}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Data Table */}
      {data.length > 0 && (
        <Section title="Data Table" collapsible>
          <div style={{ overflowX: "auto", maxHeight: 250 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {columns.map(c => <th key={c} style={{ padding: "5px 10px", textAlign: "left", color: T.textDim, fontFamily: "'Inconsolata', monospace", fontSize: 10, fontWeight: 400, position: "sticky", top: 0, background: T.bgSurface }}>{c}</th>)}
              </tr></thead>
              <tbody>{data.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {columns.map(c => <td key={c} style={{ padding: "4px 10px", color: typeof r[c] === "number" ? T.text : T.textMuted, fontFamily: "'Inconsolata', monospace", fontSize: 12 }}>{r[c]}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Visualization */}
      {data.length > 0 && (
        <Section title="Visualization" collapsible defaultOpen={true}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", display: "block", marginBottom: 3 }}>CHART TYPE</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[["line","Line"],["bar","Bar"],["area","Area"],["scatter","Scatter"],["pie","Pie"],["radar","Radar"]].map(([k,l]) => (
                  <Btn key={k} small active={chartType===k} onClick={() => setChartType(k)}>{l}</Btn>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", display: "block", marginBottom: 3 }}>X AXIS</label>
              <select value={xCol} onChange={e => setXCol(e.target.value)}
                style={{ padding: "5px 8px", background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "'Inconsolata', monospace", outline: "none" }}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textDim, fontFamily: "'Inconsolata', monospace", display: "block", marginBottom: 3 }}>Y AXIS (click to toggle)</label>
              <div style={{ display: "flex", gap: 4 }}>
                {numericCols.map(c => (
                  <Btn key={c} small active={yCols.includes(c)} color={CHART_COLORS[numericCols.indexOf(c) % CHART_COLORS.length]}
                    onClick={() => setYCols(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}>{c}</Btn>
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: T.bgElevated, borderRadius: 6, padding: "16px 8px 8px", border: `1px solid ${T.border}` }}>
            {renderChart()}
          </div>
        </Section>
      )}

      {/* Export */}
      {data.length > 0 && (
        <Section title="Export Data" collapsible>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[["csv","CSV (RStudio/Excel)"],["r","R Script (tidyverse)"],["python","Python (pandas)"],["excel","TSV (Excel)"]].map(([k,l]) => (
              <Btn key={k} small active={exportFormat===k} onClick={() => setExportFormat(k)}>{l}</Btn>
            ))}
            <Btn onClick={exportData} active style={{ marginLeft: 8 }}>Download {exportFormat.toUpperCase()}</Btn>
          </div>
          <p style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>
            {exportFormat === "csv" && "Comma-separated values — opens directly in RStudio, Excel, Google Sheets, SPSS, or any CSV reader."}
            {exportFormat === "r" && "R script with tidyverse data frame — ready for statistical analysis, ggplot2 visualization, and modeling."}
            {exportFormat === "python" && "Python script with pandas DataFrame — ready for data analysis, matplotlib/seaborn plotting, and scikit-learn modeling."}
            {exportFormat === "excel" && "Tab-separated values — paste directly into Excel. For .xlsx, open as TSV then save as Excel Workbook."}
          </p>
        </Section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: "lit", label: "Literature", icon: "◉" },
  { id: "species", label: "Species", icon: "⟡" },
  { id: "env", label: "Environmental", icon: "◈" },
  { id: "workshop", label: "Data Workshop", icon: "⬡" },
];

export default function Meridian() {
  const [tab, setTab] = useState("lit");
  const [workshopData, setWorkshopData] = useState([]);

  const addToWorkshop = (paper) => {
    setWorkshopData(prev => [...prev, paper]);
    setTab("workshop");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Libre Baskerville', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inconsolata:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.accentBorder}; border-radius: 3px; }
        input:focus, textarea:focus { border-color: ${T.accentBorder} !important; }
        select { cursor: pointer; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes drift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        body { margin: 0; background: #232030; }
      `}</style>

      {/* Header */}
      <header style={{ padding: "20px 28px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.5,
              background: `linear-gradient(135deg, ${T.accent}, #D4A04A, ${T.accent})`,
              backgroundSize: "200% 200%", animation: "drift 8s ease infinite",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontFamily: "'Libre Baskerville', serif",
            }}>Meridian</h1>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textDim, fontFamily: "'Inconsolata', monospace", letterSpacing: 0.5 }}>
              Academic Research Platform — Literature · Species · Environment · Analysis
            </p>
          </div>
          <div style={{ fontSize: 10, color: T.textDim, textAlign: "right", fontFamily: "'Inconsolata', monospace", lineHeight: 1.6 }}>
            <div>4 APIs · 25+ Search Engines · 75+ Journals</div>
            <div>17 Species DBs · 40+ Data Portals</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "9px 18px", fontSize: 12, cursor: "pointer",
              fontFamily: "'Inconsolata', monospace", fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? T.accent : T.textDim,
              background: tab === t.id ? T.bgSurface : "transparent",
              border: "1px solid transparent",
              borderBottom: tab === t.id ? `1px solid ${T.bg}` : `1px solid ${T.border}`,
              borderTop: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
              borderLeft: tab === t.id ? `1px solid ${T.border}` : "1px solid transparent",
              borderRight: tab === t.id ? `1px solid ${T.border}` : "1px solid transparent",
              borderRadius: "5px 5px 0 0", transition: "all 0.15s",
              marginBottom: -1,
            }}>
              <span style={{ marginRight: 6, fontSize: 13 }}>{t.icon}</span>{t.label}
              {t.id === "workshop" && workshopData.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: T.coralMuted, color: T.coral }}>{workshopData.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: "20px 28px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "lit" && <LiteratureTab onAddToWorkshop={addToWorkshop} />}
        {tab === "species" && <SpeciesTab />}
        {tab === "env" && <EnvironmentalTab />}
        {tab === "workshop" && <DataWorkshop workshopData={workshopData} setWorkshopData={setWorkshopData} />}
      </main>
    </div>
  );
}
