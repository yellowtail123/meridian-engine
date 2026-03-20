// ═══ MERIDIAN STATS — Statistical Functions Module ═══
// Pure mathematical functions, no DOM dependencies

// ═══ STATISTICS ═══
function normCDF(x){const t=1/(1+0.2316419*Math.abs(x));const d=0.3989423*Math.exp(-x*x/2);const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p}
function pFromZ(z){return 2*normCDF(-Math.abs(z))}
function pFromT(t,df){if(df>=100)return pFromZ(t);const a=df/2;const x=df/(df+t*t);let bt=Math.exp(a*Math.log(x)+0.5*Math.log(1-x)-Math.log(2*a));let sum=1,term=1;for(let k=1;k<200;k++){term*=(a+k-1)*x/k;sum+=term;if(Math.abs(term)<1e-12)break}bt*=sum;return Math.min(1,Math.max(0,bt))||pFromZ(t)}
// ═══ LTTB DOWNSAMPLING ═══
function lttb(data,threshold){
  if(data.length<=threshold)return data;
  // Pre-compute timestamps once to avoid repeated new Date() in inner loops
  const ts=new Float64Array(data.length);
  for(let i=0;i<data.length;i++)ts[i]=new Date(data[i].time).getTime();
  const out=[data[0]];const bSize=(data.length-2)/(threshold-2);
  let a=0;
  for(let i=0;i<threshold-2;i++){
    const bStart=Math.floor((i+1)*bSize)+1,bEnd=Math.min(Math.floor((i+2)*bSize)+1,data.length);
    const nStart=Math.floor((i+2)*bSize)+1,nEnd=Math.min(Math.floor((i+3)*bSize)+1,data.length-1);
    let avgX=0,avgY=0,cnt=0;
    for(let j=nStart;j<nEnd&&j<data.length;j++){avgX+=ts[j];avgY+=data[j].value;cnt++}
    if(!cnt){avgX=ts[data.length-1];avgY=data[data.length-1].value}else{avgX/=cnt;avgY/=cnt}
    let maxArea=-1,maxIdx=bStart;
    const ax=ts[a],ay=data[a].value;
    for(let j=bStart;j<bEnd&&j<data.length;j++){
      const area=Math.abs((ax-avgX)*(data[j].value-ay)-(ax-ts[j])*(avgY-ay));
      if(area>maxArea){maxArea=area;maxIdx=j}}
    out.push(data[maxIdx]);a=maxIdx}
  out.push(data[data.length-1]);return out}

// ═══ ANOMALY DETECTION (rolling window, O(n)) ═══
function detectAnomalies(data,win=30,sigma=2){
  const n=data.length;if(n<win)return[];
  const anomalies=[];const half=Math.floor(win/2);
  // Pre-extract values
  const vals=new Float64Array(n);for(let i=0;i<n;i++)vals[i]=data[i].value;
  // Rolling sum + sum-of-squares
  let sum=0,sq=0,cnt=0;
  // Init window for first point
  const e0=Math.min(n,half+1);for(let j=0;j<e0;j++){sum+=vals[j];sq+=vals[j]*vals[j];cnt++}
  for(let i=0;i<n;i++){
    // Expand window right
    const re=Math.min(n-1,i+half);const rs=Math.min(n-1,(i>0?i-1+half:half));
    if(re>rs&&i>0){for(let j=rs+1;j<=re;j++){sum+=vals[j];sq+=vals[j]*vals[j];cnt++}}
    // Shrink window left
    const ls=Math.max(0,i-half);const lp=Math.max(0,(i>0?i-1-half:-1));
    if(ls>lp){for(let j=lp;j<ls;j++){sum-=vals[j];sq-=vals[j]*vals[j];cnt--}}
    if(cnt<2)continue;
    const m=sum/cnt;const variance=sq/cnt-m*m;
    if(variance<=0)continue;const sd=Math.sqrt(variance);
    const z=(vals[i]-m)/sd;
    if(Math.abs(z)>sigma)anomalies.push({time:data[i].time,value:vals[i],mean:m,sd,zScore:z})}
  return anomalies}

// ═══ MANN-KENDALL TREND TEST + SEN'S SLOPE ═══
function mannKendall(data){
  const n=data.length;if(n<10)return null;
  const vals=data.map(d=>d.value);
  let mk=0;
  for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++){const d=vals[j]-vals[i];if(d>0)mk++;else if(d<0)mk--}
  // Variance with tie correction
  const tieGroups={};vals.forEach(v=>{tieGroups[v]=(tieGroups[v]||0)+1});
  let tieCorr=0;Object.values(tieGroups).forEach(t=>{if(t>1)tieCorr+=t*(t-1)*(2*t+5)});
  const varMK=(n*(n-1)*(2*n+5)-tieCorr)/18;
  const z=mk>0?(mk-1)/Math.sqrt(varMK):mk<0?(mk+1)/Math.sqrt(varMK):0;
  const p=pFromZ(z);
  const trend=p<0.05?(mk>0?'increasing':'decreasing'):'no trend';
  // Sen's slope
  const slopes=[];
  for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++){
    const dt=(new Date(data[j].time)-new Date(data[i].time))/(365.25*86400000);
    if(dt>0)slopes.push((vals[j]-vals[i])/dt)}
  slopes.sort((a,b)=>a-b);
  const senSlope=slopes.length?slopes[Math.floor(slopes.length/2)]:0;
  return{S:mk,z,p,trend,senSlope}}

// ═══ MULTI-SOURCE FUSION STATS ═══
function pearsonR(xs,ys){
  const n=xs.length;if(n<3)return NaN;
  let sx=0,sy=0;for(let i=0;i<n;i++){sx+=xs[i];sy+=ys[i]}
  const mx=sx/n,my=sy/n;let num=0,dx2=0,dy2=0;
  for(let i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);dx2+=(xs[i]-mx)**2;dy2+=(ys[i]-my)**2}
  const denom=Math.sqrt(dx2)*Math.sqrt(dy2);return denom?num/denom:0}
function rmse(xs,ys){const n=xs.length;if(!n)return NaN;let s=0;for(let i=0;i<n;i++)s+=(xs[i]-ys[i])**2;return Math.sqrt(s/n)}
function computeEnsembleTS(sourceSeries){
  // sourceSeries: [{id,nm,data:[{time,value}],res}]
  const allTimes=new Set();
  sourceSeries.forEach(s=>s.data.forEach(d=>allTimes.add(d.time)));
  const sorted=[...allTimes].sort();
  // Build lookup maps
  const maps=sourceSeries.map(s=>{const m={};s.data.forEach(d=>{m[d.time]=d.value});return m});
  const ensemble=sorted.map(t=>{
    const vals=maps.map(m=>m[t]).filter(v=>v!=null);
    if(!vals.length)return null;
    const mean=vals.reduce((s,x)=>s+x,0)/vals.length;
    const std=vals.length>1?Math.sqrt(vals.reduce((s,x)=>s+(x-mean)**2,0)/vals.length):0;
    return{time:t,value:mean,std,n:vals.length,min:Math.min(...vals),max:Math.max(...vals)}}).filter(Boolean);
  // Inter-source agreement
  const pairs=[];
  for(let i=0;i<sourceSeries.length;i++){
    for(let j=i+1;j<sourceSeries.length;j++){
      const mA=maps[i],mB=maps[j],xs=[],ys=[];
      for(const t in mA){if(mB[t]!=null){xs.push(mA[t]);ys.push(mB[t])}}
      if(xs.length>=5){const r=pearsonR(xs,ys);const bias=xs.reduce((s,x,k)=>s+(x-ys[k]),0)/xs.length;
        pairs.push({a:sourceSeries[i].nm,b:sourceSeries[j].nm,r,bias,rmse:rmse(xs,ys),n:xs.length})}}}
  return{ensemble,pairs,sources:sourceSeries}}
async function fetchFusionData(paramIds,lat,lon,mode,df,dt,isHist){
  const results={};
  const _fDaySpan=mode!=='latest'&&df&&dt?Math.max(1,Math.round((new Date(dt)-new Date(df))/86400000)):1;
  const _fStride=Math.max(1,Math.ceil(_fDaySpan/730));
  const jobs=paramIds.filter(id=>_fusionSources[id]&&_fusionSources[id].length>=2).map(async paramId=>{
    const sources=_fusionSources[paramId];
    const fetched=await Promise.allSettled(sources.map(async src=>{
      await _acquireSlot();
      try{
      if(isServerDown(src.server))return{id:src.id,nm:src.nm,data:null,error:'Server unreachable',res:src.res};
      const cr=mode!=='latest'?clampRange(df,dt,src):null;
      if(mode!=='latest'&&!cr)return{id:src.id,nm:src.nm,data:null,error:'Outside date range',res:src.res};
      const tQ=mode==='latest'?'[(last)]':`[(${cr.start}T00:00:00Z):${_fStride}:(${cr.end}T00:00:00Z)]`;
      try{const url=buildErddapUrl(src,tQ,lat,lon);
        const r=await erddapFetch(url,isHist?45000:20000);
        if(!r.ok)throw new Error('HTTP '+r.status);
        const d=await r.json();const rows=(d.table?.rows||[]).filter(r=>r[r.length-1]!=null);
        if(!rows.length)throw new Error('No data');
        if(mode==='latest'){const vals=rows.map(r=>r[r.length-1]);
          return{id:src.id,nm:src.nm,value:vals.reduce((s,x)=>s+x,0)/vals.length,res:src.res}}
        const byTime={};rows.forEach(r=>{const t=r[0];if(!byTime[t])byTime[t]=[];byTime[t].push(r[r.length-1])});
        const ts=Object.keys(byTime).sort().map(t=>({time:t,value:byTime[t].reduce((s,x)=>s+x,0)/byTime[t].length}));
        return{id:src.id,nm:src.nm,data:ts,res:src.res}
      }catch(e){return{id:src.id,nm:src.nm,data:null,error:e.message,res:src.res}}
      }finally{_releaseSlot()}}));
    const ok=fetched.filter(r=>r.status==='fulfilled'&&(r.value.data!=null||r.value.value!=null)).map(r=>r.value);
    const failed=fetched.filter(r=>r.status==='fulfilled'&&r.value.data==null&&r.value.value==null).map(r=>r.value);
    const errored=fetched.filter(r=>r.status==='rejected');
    if(ok.length>=1){
      if(mode==='latest'){const vals=ok.map(s=>s.value);const mean=vals.reduce((s,x)=>s+x,0)/vals.length;
        const std=vals.length>1?Math.sqrt(vals.reduce((s,x)=>s+(x-mean)**2,0)/vals.length):0;
        results[paramId]={mode:'latest',mean,std,range:[Math.min(...vals),Math.max(...vals)],
          sources:ok.map(s=>({id:s.id,nm:s.nm,value:s.value,res:s.res})),failed,n:ok.length}}
      else{results[paramId]=computeEnsembleTS(ok);results[paramId].failed=failed}}
    else{results[paramId]={mode:'none',sources:[],failed:[...failed,...errored.map(r=>({nm:'?',error:r.reason?.message||'Unknown'}))],n:0}}});
  await Promise.allSettled(jobs);
  return results}

// ═══ SPARKLINE SVG GENERATOR ═══
function sparklineSVG(data,w,h,color){
  if(!data||data.length<3)return'';
  const step=Math.max(1,Math.floor(data.length/30));
  const pts=[];for(let i=0;i<data.length;i+=step)pts.push(data[i].value);
  if(pts.length<2)return'';
  const mn=Math.min(...pts),mx=Math.max(...pts),rng=mx-mn||1;
  const coords=pts.map((v,i)=>`${(i/(pts.length-1)*w).toFixed(1)},${(h-((v-mn)/rng)*h*.8-h*.1).toFixed(1)}`).join(' ');
  return`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}

// ═══ SEASONAL DECOMPOSITION ═══
function seasonalDecompose(data,period){
  if(!period)period=data.length>400?365:12;
  const n=data.length;if(n<period*2)return null;
  // Moving average for trend
  const trend=new Array(n).fill(null);
  const half=Math.floor(period/2);
  for(let i=half;i<n-half;i++){let s=0;for(let j=i-half;j<=i+half;j++)s+=data[j].value;trend[i]=s/period}
  // Seasonal: average residual by position in cycle
  const seasonal=new Array(n).fill(0);
  const buckets={};
  for(let i=0;i<n;i++){if(trend[i]==null)continue;const pos=i%period;if(!buckets[pos])buckets[pos]=[];buckets[pos].push(data[i].value-trend[i])}
  for(let i=0;i<n;i++){const pos=i%period;seasonal[i]=buckets[pos]?.length?buckets[pos].reduce((a,v)=>a+v,0)/buckets[pos].length:0}
  // Residual
  const residual=data.map((d,i)=>trend[i]!=null?d.value-trend[i]-seasonal[i]:null);
  return{trend,seasonal,residual}}

// ═══ CROSS-CORRELATION ═══
function crossCorrelation(a,b,maxLag=30){
  // Align by time
  const bMap={};b.forEach(d=>{bMap[d.time]=d.value});
  const times=a.filter(d=>bMap[d.time]!=null);
  if(times.length<maxLag*2)return[];
  const av=times.map(d=>d.value),bv=times.map(d=>bMap[d.time]);
  const ma=av.reduce((s,v)=>s+v,0)/av.length,mb=bv.reduce((s,v)=>s+v,0)/bv.length;
  const results=[];
  for(let lag=-maxLag;lag<=maxLag;lag++){
    let num=0,da=0,db=0,cnt=0;
    for(let i=0;i<av.length;i++){
      const j=i+lag;if(j<0||j>=bv.length)continue;
      num+=(av[i]-ma)*(bv[j]-mb);da+=(av[i]-ma)**2;db+=(bv[j]-mb)**2;cnt++}
    const r=Math.sqrt(da)*Math.sqrt(db)?num/(Math.sqrt(da)*Math.sqrt(db)):0;
    results.push({lag,r,n:cnt})}
  return results}

// ═══ SPEARMAN RANK ═══
function spearmanRank(arr){
  const indexed=arr.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
  const ranks=new Array(arr.length);
  let i=0;
  while(i<indexed.length){
    let j=i;while(j<indexed.length&&indexed[j].v===indexed[i].v)j++;
    const avgRank=(i+j-1)/2+1;
    for(let k=i;k<j;k++)ranks[indexed[k].i]=avgRank;
    i=j}
  return ranks}
function spearmanCorr(x,y){
  const rx=spearmanRank(x),ry=spearmanRank(y);
  const n=rx.length,mx=rx.reduce((a,v)=>a+v,0)/n,my=ry.reduce((a,v)=>a+v,0)/n;
  let num=0,dx=0,dy=0;
  for(let i=0;i<n;i++){num+=(rx[i]-mx)*(ry[i]-my);dx+=(rx[i]-mx)**2;dy+=(ry[i]-my)**2}
  return Math.sqrt(dx)*Math.sqrt(dy)?num/(Math.sqrt(dx)*Math.sqrt(dy)):0}

// ═══ SHAPIRO-WILK TEST ═══
function shapiroWilk(data){
  const n=data.length;
  if(n<3||n>5000)return{W:NaN,p:NaN,normal:null,reason:n<3?'n<3':'n>5000'};
  const sorted=[...data].sort((a,b)=>a-b);
  const mean=data.reduce((s,v)=>s+v,0)/n;
  const ss=data.reduce((s,v)=>s+(v-mean)**2,0);
  if(ss===0)return{W:1,p:1,normal:true};
  // Approximate a-coefficients using Royston's algorithm
  const m=new Array(n);
  for(let i=0;i<n;i++){const p=(i+1-0.375)/(n+0.25);m[i]=_qnorm(p)}
  const mSq=m.reduce((s,v)=>s+v*v,0);
  const a=m.map(v=>v/Math.sqrt(mSq));
  let b=0;
  for(let i=0;i<n;i++)b+=a[i]*sorted[i];
  const W=b*b/ss;
  // P-value approximation (Royston 1992)
  const logn=Math.log(n);
  let mu,sigma,z;
  if(n<=11){mu=-0.0006714*logn*logn*logn+0.025054*logn*logn-0.39978*logn+0.544;sigma=Math.exp(-0.0020322*logn*logn*logn+0.062767*logn*logn-0.77857*logn+1.3822)}
  else{mu=0.0038915*logn*logn*logn-0.083751*logn*logn-0.31082*logn-1.5851;sigma=Math.exp(0.0030302*logn*logn*logn-0.082676*logn*logn-0.4803)}
  z=(-Math.log(1-W)-mu)/sigma;
  const p=1-normCDF(z);
  return{W:Math.min(1,Math.max(0,W)),p:Math.min(1,Math.max(0,p)),normal:p>=0.05}}
function _qnorm(p){
  // Rational approximation for inverse normal CDF
  if(p<=0)return-Infinity;if(p>=1)return Infinity;if(p===0.5)return 0;
  const a=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239e0];
  const b=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
  const c=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838e0,-2.549732539343734e0,4.374664141464968e0,2.938163982698783e0];
  const d=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996e0,3.754408661907416e0];
  const pLow=0.02425,pHigh=1-pLow;
  let q,r;
  if(p<pLow){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  if(p<=pHigh){q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}

// ═══ ANOVA + TUKEY HSD ═══
function oneWayAnova(groups){
  const k=groups.length;
  const allVals=groups.flat();
  const N=allVals.length;
  if(k<2||N<k+1)return null;
  const grandMean=allVals.reduce((s,v)=>s+v,0)/N;
  let ssBetween=0,ssWithin=0;
  const groupStats=groups.map(g=>{
    const m=g.reduce((s,v)=>s+v,0)/g.length;
    ssBetween+=g.length*(m-grandMean)**2;
    g.forEach(v=>ssWithin+=(v-m)**2);
    return{mean:m,n:g.length,sd:Math.sqrt(g.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,g.length-1))}});
  const dfBetween=k-1,dfWithin=N-k;
  if(dfWithin<=0)return null;
  const msBetween=ssBetween/dfBetween,msWithin=ssWithin/dfWithin;
  const F=msWithin>0?msBetween/msWithin:0;
  // F-distribution p-value approximation
  const p=_pFromF(F,dfBetween,dfWithin);
  return{F,p,dfBetween,dfWithin,msBetween,msWithin,ssBetween,ssWithin,ssTotal:ssBetween+ssWithin,groupStats,eta2:ssBetween/(ssBetween+ssWithin)}}
function _pFromF(F,df1,df2){
  if(F<=0)return 1;
  const x=df2/(df2+df1*F);
  return _regBetaInc(df2/2,df1/2,x)}
function _regBetaInc(a,b,x){
  // Regularized incomplete beta via continued fraction
  if(x<=0)return 0;if(x>=1)return 1;
  const lnBeta=_lnGamma(a)+_lnGamma(b)-_lnGamma(a+b);
  const front=Math.exp(Math.log(x)*a+Math.log(1-x)*b-lnBeta);
  if(x<(a+1)/(a+b+2))return front*_betaCF(a,b,x)/a;
  return 1-front*_betaCF(b,a,1-x)/b}
function _betaCF(a,b,x){
  let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<1e-30)d=1e-30;d=1/d;let h=d;
  for(let m=1;m<=200;m++){let m2=2*m,aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;
    c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<3e-7)break}
  return h}
function _lnGamma(x){
  const g=7;const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5)return Math.log(Math.PI/Math.sin(Math.PI*x))-_lnGamma(1-x);
  x-=1;let a=c[0];const t=x+g+0.5;for(let i=1;i<g+2;i++)a+=c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a)}
function tukeyHSD(groups,labels){
  const anova=oneWayAnova(groups);
  if(!anova)return null;
  const{msWithin,dfWithin,groupStats}=anova;
  const k=groups.length;const pairs=[];
  for(let i=0;i<k;i++){for(let j=i+1;j<k;j++){
    const diff=Math.abs(groupStats[i].mean-groupStats[j].mean);
    const se=Math.sqrt(msWithin*0.5*(1/groupStats[i].n+1/groupStats[j].n));
    const q=se>0?diff/se:0;
    // Approximate p-value from studentized range distribution
    const p=Math.min(1,Math.max(0,Math.exp(-0.6*q*q/k)*k));
    pairs.push({a:labels?labels[i]:i,b:labels?labels[j]:j,diff,se,q,p,sig:p<0.05})}}
  return{anova,pairs}}

// ═══ HOLT-WINTERS FORECASTING ═══
function holtWinters(data,seasonLen,forecastN){
  const n=data.length;
  if(n<seasonLen*2)return null;
  const vals=data.map(d=>d.value);
  // Initialize
  let level=vals.slice(0,seasonLen).reduce((s,v)=>s+v,0)/seasonLen;
  let trend=0;
  for(let i=0;i<seasonLen;i++)trend+=(vals[seasonLen+i]-vals[i])/seasonLen;
  trend/=seasonLen;
  const seasonal=new Array(seasonLen);
  for(let i=0;i<seasonLen;i++)seasonal[i]=vals[i]-level;
  const alpha=0.3,beta=0.1,gamma=0.2;
  const fitted=[];
  // Fit
  for(let i=0;i<n;i++){
    const si=i%seasonLen;const prev=level;
    level=alpha*(vals[i]-seasonal[si])+(1-alpha)*(level+trend);
    trend=beta*(level-prev)+(1-beta)*trend;
    seasonal[si]=gamma*(vals[i]-level)+(1-gamma)*seasonal[si];
    fitted.push(level+trend+seasonal[si])}
  // Forecast
  const forecast=[];
  const lastTime=new Date(data[n-1].time);
  for(let i=1;i<=forecastN;i++){
    const si=(n+i-1)%seasonLen;
    const val=level+i*trend+seasonal[si];
    const d=new Date(lastTime);d.setDate(d.getDate()+i);
    // Confidence interval widens with horizon
    const ci=1.96*Math.sqrt(i)*Math.abs(trend+seasonal[si])*0.5;
    forecast.push({time:d.toISOString().split('T')[0],value:val,lo:val-ci,hi:val+ci})}
  return{fitted,forecast,level,trend,seasonal:[...seasonal]}}

// ═══ DATA QUALITY ASSESSMENT ═══
function assessQuality(tsData,metadata){
  if(!tsData||!tsData.length)return{score:0,color:'red',issues:['No data']};
  const issues=[];let score=100;
  // Temporal coverage
  const times=tsData.map(d=>new Date(d.time).getTime());
  const range=times[times.length-1]-times[0];
  const expectedDays=range/86400000;
  const coverage=tsData.length/Math.max(1,expectedDays);
  if(coverage<0.3){score-=30;issues.push('Low temporal coverage ('+Math.round(coverage*100)+'%)')}
  else if(coverage<0.7){score-=15;issues.push('Moderate gaps ('+Math.round(coverage*100)+'% coverage)')}
  // Gap analysis
  let maxGap=0,gapCount=0;
  for(let i=1;i<times.length;i++){const gap=(times[i]-times[i-1])/86400000;
    if(gap>3){gapCount++;maxGap=Math.max(maxGap,gap)}}
  if(maxGap>30){score-=20;issues.push('Large gap: '+Math.round(maxGap)+' days')}
  else if(maxGap>7){score-=10;issues.push('Max gap: '+Math.round(maxGap)+' days')}
  if(gapCount>tsData.length*0.1){score-=10;issues.push(gapCount+' data gaps detected')}
  // Outlier check
  const vals=tsData.map(d=>d.value);
  const mean=vals.reduce((s,v)=>s+v,0)/vals.length;
  const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length);
  const outliers=vals.filter(v=>Math.abs(v-mean)>3*sd).length;
  if(outliers>vals.length*0.05){score-=15;issues.push(outliers+' extreme outliers (>3σ)')}
  // Data age
  const lastDate=new Date(tsData[tsData.length-1].time);
  const ageDays=(Date.now()-lastDate.getTime())/86400000;
  if(ageDays>90){score-=10;issues.push('Data is '+Math.round(ageDays)+' days old')}
  score=Math.max(0,Math.min(100,score));
  const color=score>=70?'green':score>=40?'yellow':'red';
  return{score,color,issues,stats:{coverage:Math.round(coverage*100),maxGap:Math.round(maxGap),gapCount,outliers,ageDays:Math.round(ageDays),n:tsData.length}}}

// ═══ GLM (Generalized Linear Model) ═══
function fitGLM(yVals,xMatrix,family){
  family=family||'gaussian';
  const n=yVals.length,p=xMatrix[0].length;
  if(n<p+2)return null;
  // Add intercept column
  const X=xMatrix.map(row=>[1,...row]);const cols=p+1;
  let beta=new Array(cols).fill(0);
  const link=family==='poisson'?v=>Math.log(Math.max(v,1e-8)):family==='binomial'?v=>Math.log(v/(1-v+1e-8)):v=>v;
  const invLink=family==='poisson'?v=>Math.exp(v):family==='binomial'?v=>1/(1+Math.exp(-v)):v=>v;
  const varFn=family==='poisson'?mu=>Math.max(mu,1e-8):family==='binomial'?mu=>Math.max(mu*(1-mu),1e-8):()=>1;
  // IRLS (Iteratively Reweighted Least Squares)
  for(let iter=0;iter<25;iter++){
    const eta=X.map(row=>row.reduce((s,x,j)=>s+x*beta[j],0));
    const mu=eta.map(invLink);
    const W=mu.map(m=>1/varFn(m));
    const z=eta.map((e,i)=>e+(yVals[i]-mu[i])/varFn(mu[i]));
    // Weighted least squares: (X'WX)^-1 X'Wz
    const XtWX=Array.from({length:cols},()=>new Array(cols).fill(0));
    const XtWz=new Array(cols).fill(0);
    for(let i=0;i<n;i++){for(let j=0;j<cols;j++){XtWz[j]+=X[i][j]*W[i]*z[i];
      for(let k=0;k<cols;k++)XtWX[j][k]+=X[i][j]*W[i]*X[i][k]}}
    const newBeta=_solveLinear(XtWX,XtWz);
    if(!newBeta)break;
    const converged=newBeta.every((b,i)=>Math.abs(b-beta[i])<1e-8);
    beta=newBeta;if(converged)break}
  // Fitted values and residuals
  const eta=X.map(row=>row.reduce((s,x,j)=>s+x*beta[j],0));
  const fitted=eta.map(invLink);
  const residuals=yVals.map((y,i)=>y-fitted[i]);
  // Deviance
  let deviance=0;
  if(family==='gaussian')deviance=residuals.reduce((s,r)=>s+r*r,0);
  else if(family==='poisson')yVals.forEach((y,i)=>{const m=fitted[i];deviance+=2*(y>0?y*Math.log(y/m):0)-(y-m)});
  else if(family==='binomial')yVals.forEach((y,i)=>{const m=Math.max(1e-8,Math.min(1-1e-8,fitted[i]));deviance-=2*(y*Math.log(m)+(1-y)*Math.log(1-m))});
  // AIC
  const logLik=-deviance/2;
  const aic=-2*logLik+2*cols;
  // Standard errors via (X'WX)^-1 diagonal
  const W=fitted.map(m=>1/varFn(m));
  const XtWX=Array.from({length:cols},()=>new Array(cols).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<cols;j++)for(let k=0;k<cols;k++)XtWX[j][k]+=X[i][j]*W[i]*X[i][k];
  const covMat=_invertMatrix(XtWX);
  const se=covMat?covMat.map((row,i)=>Math.sqrt(Math.max(0,row[i]))):new Array(cols).fill(NaN);
  const zVals=beta.map((b,i)=>se[i]?b/se[i]:0);
  const pVals=zVals.map(z=>pFromZ(z));
  return{beta,se,z:zVals,p:pVals,fitted,residuals,deviance,aic,family,n,df:n-cols}}
function _solveLinear(A,b){
  const n=A.length;const aug=A.map((row,i)=>[...row,b[i]]);
  for(let i=0;i<n;i++){let max=Math.abs(aug[i][i]),maxR=i;
    for(let r=i+1;r<n;r++){if(Math.abs(aug[r][i])>max){max=Math.abs(aug[r][i]);maxR=r}}
    if(max<1e-12)return null;[aug[i],aug[maxR]]=[aug[maxR],aug[i]];
    for(let r=i+1;r<n;r++){const f=aug[r][i]/aug[i][i];for(let c=i;c<=n;c++)aug[r][c]-=f*aug[i][c]}}
  const x=new Array(n);
  for(let i=n-1;i>=0;i--){x[i]=aug[i][n];for(let j=i+1;j<n;j++)x[i]-=aug[i][j]*x[j];x[i]/=aug[i][i]}
  return x}
function _invertMatrix(M){
  const n=M.length;const aug=M.map((row,i)=>{const r=[...row];for(let j=0;j<n;j++)r.push(i===j?1:0);return r});
  for(let i=0;i<n;i++){let max=Math.abs(aug[i][i]),maxR=i;
    for(let r=i+1;r<n;r++){if(Math.abs(aug[r][i])>max){max=Math.abs(aug[r][i]);maxR=r}}
    if(max<1e-12)return null;[aug[i],aug[maxR]]=[aug[maxR],aug[i]];
    const piv=aug[i][i];for(let j=0;j<2*n;j++)aug[i][j]/=piv;
    for(let r=0;r<n;r++){if(r===i)continue;const f=aug[r][i];for(let j=0;j<2*n;j++)aug[r][j]-=f*aug[i][j]}}
  return aug.map(row=>row.slice(n))}

// ═══ POWER ANALYSIS EXPANDED ═══
function powerTwoSampleT(n1,n2,d,alpha){
  alpha=alpha||0.05;const za=Math.abs(_qnorm(1-alpha/2));
  const se=d*Math.sqrt(n1*n2/(n1+n2));
  return Math.max(0,Math.min(1,1-normCDF(za-se)+normCDF(-za-se)))}
function powerChiSquare(n,w,df,alpha){
  alpha=alpha||0.05;const ncp=n*w*w;
  // Chi-square power approx: P(χ²>χ²_crit | ncp)
  const critZ=_qnorm(1-alpha);const adjCrit=df+critZ*Math.sqrt(2*df);
  const z=(adjCrit-df-ncp)/Math.sqrt(2*(df+2*ncp));
  return Math.max(0,Math.min(1,1-normCDF(z)))}
function powerCorrelation(n,r,alpha){
  alpha=alpha||0.05;const za=Math.abs(_qnorm(1-alpha/2));
  const zr=0.5*Math.log((1+Math.abs(r))/(1-Math.abs(r)));
  const se=zr*Math.sqrt(n-3);
  return Math.max(0,Math.min(1,1-normCDF(za-se)+normCDF(-za-se)))}
function powerAnova(k,n,f,alpha){
  alpha=alpha||0.05;const dfB=k-1,dfW=k*(n-1);
  const ncp=k*n*f*f;
  const critZ=_qnorm(1-alpha);const adjCrit=dfB+critZ*Math.sqrt(2*dfB);
  const z=(adjCrit-dfB-ncp)/Math.sqrt(2*(dfB+2*ncp));
  return Math.max(0,Math.min(1,1-normCDF(z)))}
function sampleSizeForPower(powerFn,targetPower,params){
  targetPower=targetPower||0.8;
  for(let n=4;n<=2000;n++){if(powerFn(n,...params)>=targetPower)return n}
  return '>2000'}

// ═══ HARDY-WEINBERG + F-STATISTICS (GENETICS) ═══
function hardyWeinberg(obsAA,obsAa,obsaa){
  const n=obsAA+obsAa+obsaa;if(n<1)return null;
  const p=(2*obsAA+obsAa)/(2*n);const q=1-p;
  const expAA=p*p*n,expAa=2*p*q*n,expaa=q*q*n;
  const chi2=((obsAA-expAA)**2/expAA)+((obsAa-expAa)**2/expAa)+((obsaa-expaa)**2/expaa);
  const pVal=1-normCDF(Math.sqrt(chi2)-Math.sqrt(1));// approx for df=1
  return{p,q,expAA:expAA.toFixed(1),expAa:expAa.toFixed(1),expaa:expaa.toFixed(1),chi2:chi2.toFixed(3),pVal:Math.max(0,pVal).toFixed(4),inHWE:pVal>0.05}}
function fStatistics(populations){
  // populations: array of arrays, each inner array = allele frequencies per individual
  // Simplified Weir & Cockerham approach
  const k=populations.length;
  const allAlleles=populations.flat();
  const grandP=allAlleles.reduce((s,v)=>s+v,0)/allAlleles.length;
  let msgVar=0,betweenVar=0;
  const popStats=populations.map(pop=>{
    const pI=pop.reduce((s,v)=>s+v,0)/pop.length;
    betweenVar+=pop.length*(pI-grandP)**2;
    pop.forEach(v=>msgVar+=(v-pI)**2);
    return{p:pI,n:pop.length}});
  const totalVar=allAlleles.reduce((s,v)=>s+(v-grandP)**2,0);
  const N=allAlleles.length;
  const Fst=totalVar>0?betweenVar/totalVar:0;
  const Fis=totalVar>0?1-msgVar/(totalVar-betweenVar+1e-10):0;
  const Fit=totalVar>0?1-msgVar/totalVar:0;
  return{Fst:Math.max(0,Math.min(1,Fst)),Fis:Math.max(-1,Math.min(1,Fis)),Fit:Math.max(-1,Math.min(1,Fit)),k,N,popStats}}

// ═══ DIVERSITY INDICES ═══
function shannonDiversity(counts){
  const N=counts.reduce((s,c)=>s+c,0);if(N===0)return{H:0,J:0,S:0};
  const S=counts.filter(c=>c>0).length;
  let H=0;
  counts.forEach(c=>{if(c>0){const p=c/N;H-=p*Math.log(p)}});
  const Hmax=Math.log(S);const J=Hmax>0?H/Hmax:0;
  return{H,J,S,N,Hmax}}
function simpsonDiversity(counts){
  const N=counts.reduce((s,c)=>s+c,0);if(N<2)return{D:0,oneMinusD:0};
  let sum=0;counts.forEach(c=>sum+=c*(c-1));
  const D=sum/(N*(N-1));
  return{D,oneMinusD:1-D,invD:D>0?1/D:Infinity}}
function rarefactionCurve(counts,steps){
  steps=steps||20;const N=counts.reduce((s,c)=>s+c,0);
  const S=counts.filter(c=>c>0).length;
  const maxN=N;const curve=[];
  for(let i=1;i<=steps;i++){
    const n=Math.round(i*maxN/steps);
    // Hurlbert's rarefaction formula
    let eSn=0;
    counts.forEach(c=>{if(c>0&&c<=N){
      let logProb=0;for(let j=0;j<n;j++)logProb+=Math.log(Math.max(1,N-c-j))-Math.log(Math.max(1,N-j));
      eSn+=1-Math.exp(logProb)}});
    curve.push({n,expectedS:Math.min(S,eSn)})}
  return curve}

// ═══ POPULATION DYNAMICS SIMULATOR ═══
function leslieMatrix(survivalRates,fecundities,initialPop,years){
  const nClasses=survivalRates.length;
  let pop=[...initialPop];const trajectory=[{year:0,pop:[...pop],total:pop.reduce((s,v)=>s+v,0)}];
  for(let y=1;y<=years;y++){
    const newPop=new Array(nClasses).fill(0);
    // Births from all classes
    newPop[0]=fecundities.reduce((s,f,i)=>s+f*pop[i],0);
    // Survival transitions
    for(let i=1;i<nClasses;i++)newPop[i]=survivalRates[i-1]*pop[i-1];
    pop=newPop;
    trajectory.push({year:y,pop:[...pop],total:pop.reduce((s,v)=>s+v,0)})}
  return trajectory}
function logisticGrowth(N0,r,K,years,dt){
  dt=dt||1;const trajectory=[{year:0,N:N0}];let N=N0;
  for(let t=dt;t<=years;t+=dt){N=N+r*N*(1-N/K)*dt;N=Math.max(0,N);
    trajectory.push({year:t,N})}
  return trajectory}
function bevertonHolt(R0,alpha,beta,years){
  const trajectory=[{year:0,R:R0,S:R0}];let S=R0;
  for(let y=1;y<=years;y++){const R=alpha*S/(1+beta*S);
    trajectory.push({year:y,R,S:R});S=R}
  return trajectory}

