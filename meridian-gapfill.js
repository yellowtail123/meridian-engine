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
  const sources=_fusionSources[v.id];
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
  const sources=_fusionSources[v.id];
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
  sst:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISST',v:'sst',dm:3,minDate:'1870-01-16'},
  sst_anom:{server:'https://coastwatch.pfeg.noaa.gov/erddap',ds:'erdHadISST',v:'sst',dm:3,minDate:'1870-01-16',isProxy:true}
};

// Global ocean mean values by month (absolute last resort)
const _globalOceanMeans={
  sst:     [20.5,20.2,20.0,19.8,19.8,20.0,20.3,20.7,21.0,21.1,21.0,20.7],
  sst_anom:[0,0,0,0,0,0,0,0,0,0,0,0],
  chlor:   [0.30,0.32,0.35,0.38,0.36,0.28,0.22,0.20,0.22,0.25,0.28,0.29],
  sal:     [34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.7],
  par:     [0.06,0.06,0.06,0.05,0.05,0.05,0.05,0.05,0.05,0.06,0.06,0.06],
  npp:     [400,420,450,480,460,380,320,300,320,360,380,390],
  curr_u:  [0,0,0,0,0,0,0,0,0,0,0,0],
  curr_v:  [0,0,0,0,0,0,0,0,0,0,0,0],
  baa:     [0,0,0,0,0,0,0,0,0,0,0,0],
  hotspot: [0,0,0,0,0.2,0.5,0.8,1.0,0.8,0.3,0,0],
  seaice:  [0.08,0.09,0.09,0.08,0.07,0.06,0.05,0.05,0.06,0.07,0.08,0.08],
  sla:     [0,0,0,0,0,0,0,0,0,0,0,0]
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

// ── C5: Layer D — Cross-Variable Empirical Prediction ──
// Runs as a post-fetch pass — pure computation, no network calls.
function _crossVariablePredict(){
  const predicted=[];

  // Kd490 from Chlorophyll (Morel 2007)
  if(!S.envR.par&&S.envR.chlor?.value!=null){
    const chl=S.envR.chlor.value;
    const kd=0.0166+0.07242*Math.pow(Math.max(chl,0.01),0.69);
    S.envR.par={nm:'Kd490',value:+kd.toFixed(4),u:'m⁻¹',confidence:CONFIDENCE.PREDICTED,
      srcNote:'predicted:Morel2007(Chl→Kd490)'};
    predicted.push('par');
    console.info(`GAP-FILL predicted par (Kd490) = ${kd.toFixed(4)} from Chl = ${chl}`);
  }

  // NPP from SST + Chlorophyll (simplified VGPM, Behrenfeld & Falkowski 1997)
  if(!S.envR.npp&&S.envR.sst?.value!=null&&S.envR.chlor?.value!=null){
    const sst=S.envR.sst.value,chl=S.envR.chlor.value;
    // Simplified VGPM: Pb_opt as function of SST
    const pbOpt=-3.27e-8*Math.pow(sst,7)+3.4132e-6*Math.pow(sst,6)-1.348e-4*Math.pow(sst,5)
      +2.462e-3*Math.pow(sst,4)-0.0205*Math.pow(sst,3)+0.0617*Math.pow(sst,2)+0.2749*sst+1.2956;
    const dirr=33.0; // avg daily irradiance (Einstein/m²/day) estimate
    const zeu=4.6/Math.max(0.01,0.0166+0.07242*Math.pow(Math.max(chl,0.01),0.69));
    const npp=Math.max(0,pbOpt*chl*dirr*zeu*0.66125);
    S.envR.npp={nm:'Net Primary Productivity',value:+npp.toFixed(1),u:'mgC/m²/day',
      confidence:CONFIDENCE.PREDICTED,srcNote:'predicted:VGPM(SST+Chl→NPP)'};
    predicted.push('npp');
    console.info(`GAP-FILL predicted npp = ${npp.toFixed(1)} from SST=${sst}, Chl=${chl}`);
  }

  // Hotspot from SST
  if(!S.envR.hotspot&&S.envR.sst?.value!=null){
    const sst=S.envR.sst.value;
    const mmm=27; // tropical default — if better estimate available, use it
    const hotspot=Math.max(0,sst-mmm);
    S.envR.hotspot={nm:'Coral Hotspot',value:+hotspot.toFixed(2),u:'°C',
      confidence:CONFIDENCE.PREDICTED,srcNote:'predicted:SST−MMM'};
    predicted.push('hotspot');
  }

  // Chlorophyll from SST (rough inverse relationship, low confidence)
  if(!S.envR.chlor&&S.envR.sst?.value!=null){
    const sst=S.envR.sst.value;
    // Empirical: tropical warm waters = oligotrophic, cold upwelling = productive
    const chl=Math.max(0.01,Math.min(20,Math.exp(-0.1*(sst-15)+Math.log(0.5))));
    S.envR.chlor={nm:'Chlorophyll-a',value:+chl.toFixed(3),u:'mg/m³',
      confidence:CONFIDENCE.PREDICTED,srcNote:'predicted:empirical(SST→Chl)'};
    predicted.push('chlor');
    console.info(`GAP-FILL predicted chlor = ${chl.toFixed(3)} from SST=${sst}`);
  }

  return predicted;
}

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
