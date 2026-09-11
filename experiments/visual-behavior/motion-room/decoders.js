import {RETINA} from '../../../shared/vision/retina.js';
export const TYPES=Object.freeze(['T4a','T4b','T4c','T4d','T5a','T5b','T5c','T5d']);
export const LIMITS=Object.freeze({directionAccuracy:.9,rateMAE:.08,stationaryMAE:.03,falseTurnRate:.05,falseTurnThreshold:.05});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const RAD=Math.PI/180;
const map=new Map(RETINA.map((c,i)=>[`${c.u},${c.v}`,i]));
const neighbors=RETINA.map(c=>[[1,0],[-1,0],[0,1],[0,-1]].map(([u,v])=>map.get(`${c.u+u},${c.v+v}`)));

export function spatialFeatures(response,metadata){
  const features=[];
  for(const type of TYPES){
    const values=response.populations[type].delta,coords=metadata.populations[type].coordinates;
    const sums=new Float64Array(8),counts=new Uint16Array(8);
    for(let i=0;i<values.length;i++){
      const c=coords[i],x=clamp(Math.floor((c.azimuth+36)/72*4),0,3),y=clamp(Math.floor((c.elevation+31)/62*2),0,1),b=y*4+x;
      sums[b]+=values[i];counts[b]++;
    }
    features.push(...sums.map((v,i)=>v/(counts[i]||1)));
  }
  return features;
}

// Conventional Lucas–Kanade flow on the same angular hex samples as Flyvis.
// Both horizontal and vertical gradients participate, avoiding a hidden
// assumption that every frame change is horizontal motion.
export function retinalFlow(previous,current,dt,{minimumCondition=.1}={}){
  if(!previous)return {horizontal:0,vertical:0,condition:0,available:false,reason:'no-history'};
  if(previous.length!==721||current.length!==721||!(dt>0))throw Error('Invalid flow samples');
  const meanChange=current.reduce((sum,v,i)=>sum+(v-previous[i])/dt,0)/721;
  let xx=0,xy=0,yy=0,xt=0,yt=0,n=0;
  for(let i=0;i<721;i++){
    const [up,um,vp,vm]=neighbors[i];if([up,um,vp,vm].some(v=>v===undefined))continue;
    const mid=j=>(previous[j]+current[j])*.5;
    const gx=(mid(up)-mid(um))/(4.6*RAD);
    const alongV=(mid(vp)-mid(vm))/2;
    const gy=(alongV-gx*1.15*RAD)/(2.3*Math.sqrt(3)/2*RAD);
    const temporal=(current[i]-previous[i])/dt-meanChange;
    xx+=gx*gx;xy+=gx*gy;yy+=gy*gy;xt+=gx*temporal;yt+=gy*temporal;n++;
  }
  const regularization=(xx+yy)*1e-5+1e-9,det=(xx+regularization)*(yy+regularization)-xy*xy;
  const condition=(xx+yy)/Math.max(1,n),available=condition>=minimumCondition;
  return {horizontal:available?(-(yy+regularization)*xt+xy*yt)/det:0,vertical:available?(xy*xt-(xx+regularization)*yt)/det:0,condition,available,reason:available?'conditioned-flow':'insufficient-spatial-gradient',meanChange};
}

export function neuralFlowFeature(record,minimumGradient){
  return [record.neuralFlows.reduce((sum,flow)=>sum+(flow.available&&flow.gradientRms>=minimumGradient?flow.velocity.x*Math.PI/180:0),0)/2];
}

function solve(matrix,target){
  const a=matrix.map((row,i)=>[...row,target[i]]),n=target.length;
  for(let j=0;j<n;j++){
    let best=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[best][j]))best=i;
    [a[j],a[best]]=[a[best],a[j]];
    if(Math.abs(a[j][j])<1e-12)throw Error('Singular calibration');
    const scale=a[j][j];for(let k=j;k<=n;k++)a[j][k]/=scale;
    for(let i=0;i<n;i++)if(i!==j){const v=a[i][j];for(let k=j;k<=n;k++)a[i][k]-=v*a[j][k];}
  }
  return a.map(row=>row[n]);
}
export function fitRidge(rows,targets,lambda=.1){
  if(!rows.length||rows.length!==targets.length)throw Error('Calibration rows differ');
  const p=rows[0].length,n=rows.length;
  if(!rows.every(r=>r.length===p&&r.every(Number.isFinite))||!targets.every(Number.isFinite))throw Error('Invalid calibration features');
  const mean=Array.from({length:p},(_,j)=>rows.reduce((s,r)=>s+r[j],0)/n);
  const scale=mean.map((m,j)=>Math.max(1e-6,Math.sqrt(rows.reduce((s,r)=>s+(r[j]-m)**2,0)/n)));
  const x=rows.map(r=>[1,...r.map((v,j)=>(v-mean[j])/scale[j])]);
  const gram=Array.from({length:p+1},()=>Array(p+1).fill(0)),cross=Array(p+1).fill(0);
  x.forEach((row,k)=>{for(let i=0;i<=p;i++){cross[i]+=row[i]*targets[k];for(let j=0;j<=p;j++)gram[i][j]+=row[i]*row[j];}});
  for(let j=1;j<=p;j++)gram[j][j]+=lambda*n;
  return {format:'motion-room-ridge',version:1,lambda,mean,scale,weights:solve(gram,cross),rows:n};
}
export function predict(decoder,features){
  if(features.length!==decoder.mean.length||!features.every(Number.isFinite))throw Error('Invalid decoder input');
  return decoder.weights[0]+features.reduce((sum,value,j)=>sum+decoder.weights[j+1]*(value-decoder.mean[j])/decoder.scale[j],0);
}
export function scoreDecoder(decoder,records,key){
  const moving=[],stationary=[];
  for(const record of records){if(record.time<.2||(record.rate!==0&&record.time<.6))continue;const predicted=predict(decoder,record[key]),row={truth:record.rate,predicted,family:record.family};(record.rate===0?stationary:moving).push(row);}
  const mae=rows=>rows.length?rows.reduce((s,r)=>s+Math.abs(r.predicted-r.truth),0)/rows.length:null;
  const directionAccuracy=moving.length?moving.filter(r=>r.predicted*r.truth>0).length/moving.length:null;
  const rateMAE=mae(moving),stationaryMAE=mae(stationary);
  const confounds=Object.fromEntries(['unchanged','flat-flash','flicker','illumination'].map(family=>{
    const rows=stationary.filter(r=>r.family===family),falseTurns=rows.filter(r=>Math.abs(r.predicted)>LIMITS.falseTurnThreshold).length;
    return [family,{frames:rows.length,falseTurns,falseTurnRate:rows.length?falseTurns/rows.length:null,mae:mae(rows),peak:rows.length?Math.max(...rows.map(r=>Math.abs(r.predicted))):null}];
  }));
  return {movingFrames:moving.length,stationaryFrames:stationary.length,directionAccuracy,rateMAE,stationaryMAE,confounds,
    passed:!!moving.length&&directionAccuracy>=LIMITS.directionAccuracy&&rateMAE<=LIMITS.rateMAE&&stationaryMAE<=LIMITS.stationaryMAE&&Object.values(confounds).every(c=>c.frames>0&&c.falseTurnRate<=LIMITS.falseTurnRate)};
}

export class MotionController{
  constructor(condition){
    if(!CONDITIONS.includes(condition))throw Error('Unknown motion condition');
    this.condition=condition;this.pending=[];this.angle=0;this.rate=0;this.lastObservation=null;this.lastTime=null;
  }
  observe({captureTime,availableAt,flyvis,conventional}){
    if(![captureTime,availableAt,flyvis,conventional].every(Number.isFinite)||availableAt<captureTime+.04-1e-8)throw Error('Invalid or premature visual result');
    if(this.lastObservation!==null&&captureTime<=this.lastObservation)throw Error('Repeated visual observation');
    this.lastObservation=captureTime;this.pending.push({captureTime,availableAt,flyvis,conventional});
  }
  command(time,intent=0){
    if(this.lastTime!==null&&time<this.lastTime)throw Error('Motor clock moved backwards');
    const dt=this.lastTime===null?0:time-this.lastTime;this.lastTime=time;
    while(this.pending.length&&this.pending[0].availableAt<=time+1e-9){const value=this.pending.shift();this.rate=this.condition.startsWith('flyvis')?value.flyvis:this.condition.startsWith('conventional')?value.conventional:0;this.delivered=value.captureTime;}
    const fresh=this.delivered!==undefined&&time-this.delivered<=.2;
    if(!fresh)this.rate=0;
    this.angle=this.condition.startsWith('none')?0:clamp(this.angle+(this.rate+intent)*dt,-.5,.5);
    const yaw=clamp(intent+1.5*this.angle,-.65,.65),turn=clamp(yaw*.18,-.12,.12);
    return {yaw,turn,angle:this.angle,rate:this.rate,fresh,route:this.condition.includes('direct')?'direct':'dna'};
  }
  checkpoint(){return structuredClone({...this});}
  restore(state){if(state.condition!==this.condition)throw Error('Wrong controller checkpoint');Object.assign(this,structuredClone(state));}
}
export const CONDITIONS=Object.freeze(['flyvis-direct','conventional-direct','none-direct','flyvis-dna','conventional-dna','none-dna','flyvis-dna-silenced']);
