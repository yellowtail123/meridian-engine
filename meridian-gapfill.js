// ═══ MERIDIAN GAP-FILL ENGINE ═══
// Intelligent fallback pipeline when all ERDDAP cascade sources fail.
// Layers: Spatial Relaxation → Temporal Relaxation → Climatology → Cross-Variable Prediction
// Each layer tags results with a confidence tier for UI rendering.

// ── C1: Confidence Tier System ──
const CONFIDENCE={
  DIRECT:       {tier:1,label:'Direct',color:'var(--sg)',badge:'green'},
  MULTI_SOURCE: {tier:2,label:'Multi-source',color:'var(--sg)',badge:'green'},
  SPATIAL_RELAX:{tier:3,label:'Nearby interp.',color:'var(--ac)',badge:'blue'},
  TEMPORAL_RELAX:{tier:4,label:'Temporal interp.',color:'var(--ac)',badge:'blue'},
  CLIMATOLOGY:  {tier:5,label:'Climatology',color:'var(--wa)',badge:'yellow'},
  PREDICTED:    {tier:6,label:'Predicted',color:'var(--co)',badge:'orange'}
};

// ── C2: Layer A — Spatial Relaxation ──
// Widens spatial window around the target point and averages nearby grid cells.
async function _spatialRelax(v,mode,df,dt,lat,lon,stride,isHist){
  const expansions=[0.25,0.5,1.0]; // degrees (~25km, ~50km, ~100km)
  const sources=(typeof _fusionSources!=='undefined'&&_fusionSources)?_fusionSources[v.id]:null;
  // Use top 2 sources per expansion step
  const topSrc=sources?sources.slice(0,2):[];
  const directSrc=[{server:v.server,ds:v.ds,v:v.v,dm:v.dm,z:v.z,lon360:v.lon360,lag:v.lag,minDate:v.minDate}];
  if(v.alt)directSrc.push({server:v.alt.server,ds:v.alt.ds,v:v.alt.v,dm:v.alt.dm,z:v.alt.z,lon360:v.alt.lon360,lag:v.alt.lag,minDate:v.alt.minDate});
  const candidates=[...directSrc,...topSrc];

  for(const delta of expansions){
    for(const src of candidates){
      if(_envAbort?.signal.aborted)return null;
      if(isServerDown(src.server))continue;
      try{
        const srcV={...v,...src,lon360:src.lon360??false};
        let tQ;
        if(mode==='latest')tQ='[(last)]';
        else{const cr=clampRange(df,dt,srcV);if(!cr)continue;tQ=`[(${cr.start}T00:00:00Z):${stride}:(${cr.end}T00:00:00Z)]`}
        const latF=parseFloat(lat),lonF=parseFloat(lon);
        const lonVal=srcV.lon360&&lonF<0?360+lonF:lonF;
        const zQ=srcV.dm===4?`[${srcV.z}]`:'';
        const url=`${srcV.server}/griddap/${srcV.ds}.json?${srcV.v}${tQ}${zQ}[(${(latF-delta).toFixed(2)}):1:(${(latF+delta).toFixed(2)})][(${(lonVal-delta).toFixed(2)}):1:(${(lonVal+delta).toFixed(2)})]`;
        const r=await erddapFetch(url,isHist?30000:15000);
        if(!r.ok)continue;
        const d=await r.json();
        const rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
        if(!rows.length)continue;
        // Average all grid cells
        const vals=rows.map(r=>r[r.length-1]);
        const mean=vals.reduce((s,x)=>s+x,0)/vals.length;
        console.info(`GAP-FILL spatial ${v.id}: got ${rows.length} cells at ±${delta}° from ${src.ds}`);
        if(mode==='latest'){
          return{value:mean,confidence:CONFIDENCE.SPATIAL_RELAX,detail:`±${delta}° (${vals.length} cells) via ${src.ds}`}}
        // Timeseries: aggregate by time
        const byTime={};
        rows.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
        const ts=Object.keys(byTime).sort().map(t=>({time:t,value:byTime[t].reduce((s,x)=>s+x,0)/byTime[t].length}));
        return{ts,value:ts[ts.length-1]?.value,confidence:CONFIDENCE.SPATIAL_RELAX,detail:`±${delta}° avg via ${src.ds}`}
      }catch(e){
        if(e.name==='AbortError')return null;
        continue}
    }
  }
  return null;
}

// ── C3: Layer B — Temporal Relaxation ──
// For "latest" mode: look progressively further back in time.
async function _temporalRelax(v,lat,lon,isHist){
  if(isHist)return null; // Only applies to latest mode
  const windows=[14,30,90]; // days back
  const sources=(typeof _fusionSources!=='undefined'&&_fusionSources)?_fusionSources[v.id]:null;
  const directSrc={server:v.server,ds:v.ds,v:v.v,dm:v.dm,z:v.z,lon360:v.lon360,lag:v.lag,minDate:v.minDate};
  const candidates=[directSrc,...(sources||[]).slice(0,2)];

  for(const days of windows){
    const end=new Date();
    const start=new Date(end.getTime()-days*86400000);
    const dtS=end.toISOString().split('T')[0];
    const dfS=start.toISOString().split('T')[0];
    for(const src of candidates){
      if(_envAbort?.signal.aborted)return null;
      if(isServerDown(src.server))continue;
      try{
        const srcV={...v,...src,lon360:src.lon360??false};
        const cr=clampRange(dfS,dtS,srcV);if(!cr)continue;
        const tQ=`[(${cr.end}T00:00:00Z)]`; // Most recent available
        const url=buildErddapUrl(srcV,tQ,lat,lon);
        const r=await erddapFetch(url,15000);
        if(!r.ok)continue;
        const d=await r.json();
        const rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
        if(!rows.length)continue;
        const val=rows[rows.length-1][rows[0].length-1];
        const dataTime=rows[rows.length-1][0];
        const ageMs=Date.now()-new Date(dataTime).getTime();
        const ageDays=Math.round(ageMs/86400000);
        const conf=ageDays>30?CONFIDENCE.CLIMATOLOGY:CONFIDENCE.TEMPORAL_RELAX;
        console.info(`GAP-FILL temporal ${v.id}: found data ${ageDays}d old from ${src.ds}`);
        return{value:val,confidence:conf,detail:`${ageDays}d old via ${src.ds}`,dataTime}
      }catch(e){
        if(e.name==='AbortError')return null;
        continue}
    }
  }
  return null;
}

// ── C4: Layer C — Climatological Fallback ──
// Uses long-term monthly averages from coarse-resolution datasets.
const _climatologySources={
  sst:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISST',v:'sst',dm:3,minDate:'1870-01-16'}
};

// Global ocean mean values by month (absolute last resort)
const _globalOceanMeans={
  sst:   [20.5,20.2,20.0,19.8,19.8,20.0,20.3,20.7,21.0,21.1,21.0,20.7],
  chlor: [0.30,0.32,0.35,0.38,0.36,0.28,0.22,0.20,0.22,0.25,0.28,0.29]
};

async function _climatologyFallback(v,mode,df,dt,lat,lon){
  const climSrc=_climatologySources[v.id];
  if(climSrc&&!climSrc.isProxy){
    // Try fetching from a climatology-class dataset with a wide time window
    try{
      const year=new Date().getFullYear();
      const month=String(new Date().getMonth()+1).padStart(2,'0');
      // Request same month from last available year
      const tQ=`[(${year-1}-${month}-15T00:00:00Z)]`;
      const srcV={...v,...climSrc,lon360:climSrc.lon360??false};
      const url=buildErddapUrl(srcV,tQ,lat,lon);
      const r=await erddapFetch(url,15000);
      if(r.ok){
        const d=await r.json();
        const rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
        if(rows.length){
          const val=rows[0][rows[0].length-1];
          console.info(`GAP-FILL climatology ${v.id}: got value from ${climSrc.ds}`);
          return{value:val,confidence:CONFIDENCE.CLIMATOLOGY,detail:`climatology via ${climSrc.ds}`}}}
    }catch(e){if(e.name==='AbortError')return null}
  }
  // Global ocean mean fallback
  const means=_globalOceanMeans[v.id];
  if(means){
    const month=mode==='latest'?new Date().getMonth():(df?new Date(df).getMonth():new Date().getMonth());
    const val=means[month];
    console.info(`GAP-FILL global mean ${v.id}: month ${month+1} → ${val}`);
    return{value:val,confidence:CONFIDENCE.CLIMATOLOGY,detail:'global ocean monthly mean'}
  }
  return null;
}

function _crossVariablePredict(){return[]}

// ── C6: Orchestrator — called when all cascade sources fail for a variable ──
async function _gapFillPipeline(v,mode,df,dt,lat,lon,stride,isHist){
  console.info(`GAP-FILL pipeline starting for ${v.id} (${v.nm})`);

  // Layer A: Spatial Relaxation
  const spatial=await _spatialRelax(v,mode,df,dt,lat,lon,stride,isHist);
  if(spatial){
    console.info(`GAP-FILL ${v.id}: resolved via spatial relaxation`);
    return spatial;
  }

  // Layer B: Temporal Relaxation (latest mode only)
  if(mode==='latest'){
    const temporal=await _temporalRelax(v,lat,lon,isHist);
    if(temporal){
      console.info(`GAP-FILL ${v.id}: resolved via temporal relaxation`);
      return temporal;
    }
  }

  // Layer C: Climatological Fallback
  const clim=await _climatologyFallback(v,mode,df,dt,lat,lon);
  if(clim){
    console.info(`GAP-FILL ${v.id}: resolved via climatology`);
    return clim;
  }

  // Layer D (cross-variable) runs separately in post-fetch pass
  console.warn(`GAP-FILL ${v.id}: all layers exhausted — deferring to cross-variable pass`);
  return null;
}

// ── Confidence badge HTML generator (used in UI rendering) ──
function _confidenceBadgeHTML(conf){
  if(!conf)return '';
  const c=conf.badge==='green'?'var(--sg)':conf.badge==='blue'?'var(--ac)':conf.badge==='yellow'?'var(--wa)':'var(--co)';
  return ` <span class="conf-badge" style="font-size:8px;padding:1px 4px;border-radius:3px;background:${c}20;color:${c};font-family:var(--mf)" title="${conf.label}">${conf.label}</span>`;
}
