// Clear-marker engineering baseline. No biological circuit is represented.
export const MARKER_SETTINGS=Object.freeze({version:1,width:96,height:64,minArea:5,maxArea:350,maxAspect:3,
  acquireSeconds:.12,acquireFrames:3,maxGap:.3,occlusionGrace:.24,associationRadius:6,
  appearanceDistance:.2,areaRatio:1.65,mergeMargin:5,maxSpeed:75});
const cfg=MARKER_SETTINGS,copy=x=>structuredClone(x),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function markerComponents(pixels){
  if(!(pixels instanceof Uint8Array)||pixels.length!==96*64*4)throw Error('Expected96x64 RGBA');
  const mask=new Uint8Array(96*64),queue=new Int32Array(96*64),components=[];
  for(let i=0;i<mask.length;i++){const j=i*4,r=pixels[j],g=pixels[j+1],b=pixels[j+2];mask[i]=+(r>95&&r>g*1.35&&b>g*1.1&&b>r*.48);}
  for(let start=0;start<mask.length;start++){
    if(!mask[start])continue;mask[start]=0;queue[0]=start;let head=0,tail=1,count=0,xs=0,ys=0,minX=96,maxX=0,minY=64,maxY=0,red=0,green=0,blue=0;
    while(head<tail){const i=queue[head++],x=i%96,y=Math.floor(i/96),j=i*4;count++;xs+=x;ys+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);red+=pixels[j];green+=pixels[j+1];blue+=pixels[j+2];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,k=ny*96+nx;if(nx>=0&&nx<96&&ny>=0&&ny<64&&mask[k]){mask[k]=0;queue[tail++]=k;}}
    }
    const width=maxX-minX+1,height=maxY-minY+1,total=red+green+blue;
    components.push({x:xs/count,y:ys/count,area:count,width,height,bounds:[minX,minY,maxX,maxY],
      color:[red/total,green/total,blue/total],compact:count>=cfg.minArea&&count<=cfg.maxArea&&Math.max(width/height,height/width)<=cfg.maxAspect});
  }
  return components;
}
const appearance=(a,b)=>Math.hypot(...a.color.map((v,i)=>v-b.color[i]));
const areaCompatible=(a,b)=>Math.max(a.area/b.area,b.area/a.area)<=cfg.areaRatio;
const closeBounds=(a,b)=>Math.hypot(Math.max(0,a.bounds[0]-b.bounds[2],b.bounds[0]-a.bounds[2]),Math.max(0,a.bounds[1]-b.bounds[3],b.bounds[1]-a.bounds[3]))<=cfg.mergeMargin;
export class ClearMarkerTracker{
  constructor(){this.reset();}
  reset(){this.state={version:1,sourceId:null,frameId:null,time:null,track:null,acquire:null,latch:null,lastVisibleTime:null,velocity:[0,0],identity:0};}
  checkpoint(){return copy(this.state);}
  restore(saved){
    if(saved?.version!==1||!(saved.sourceId===null||typeof saved.sourceId==='string')||!(saved.time===null||Number.isFinite(saved.time))||!Number.isSafeInteger(saved.identity))throw Error('Invalid marker checkpoint');
    const validate=b=>b===null||(b&&['x','y','area','width','height'].every(k=>Number.isFinite(b[k]))&&b.area>0&&Array.isArray(b.color)&&b.color.length===3&&b.color.every(Number.isFinite)&&Array.isArray(b.bounds)&&b.bounds.length===4&&b.bounds.every(Number.isFinite));
    if(!validate(saved.track)||!validate(saved.acquire?.blob??null)||!Array.isArray(saved.velocity)||saved.velocity.length!==2||!saved.velocity.every(Number.isFinite)||!(saved.latch===null||['identity-ambiguous','lost','capture-gap'].includes(saved.latch)))throw Error('Invalid marker checkpoint state');
    this.state=copy(saved);
  }
  step({pixels,captureTime,frameId,sourceId}){
    if(!Number.isFinite(captureTime)||captureTime<0||!Number.isSafeInteger(frameId)||frameId<0||typeof sourceId!=='string'||!sourceId)throw Error('Invalid capture identity');
    const components=markerComponents(pixels);let s=this.state;
    if(s.sourceId!==null&&sourceId!==s.sourceId){this.reset();s=this.state;}
    if(s.time!==null&&(captureTime<s.time||frameId<s.frameId))throw Error('Out-of-order marker capture');
    const result=(status,blob=null)=>({status,visible:!!blob,identity:s.identity,center:blob?[blob.x,blob.y]:null,bearing:blob?1-2*blob.x/95:null,
      area:blob?blob.area/(96*64):null,components:components.map(b=>({center:[b.x,b.y],area:b.area,compact:b.compact})),captureTime,frameId,sourceId});
    if(s.time!==null&&(captureTime===s.time||frameId===s.frameId))return result('duplicate');
    const dt=s.time===null?0:captureTime-s.time;s.sourceId=sourceId;s.time=captureTime;s.frameId=frameId;
    if(s.track&&dt>cfg.maxGap)s.latch='capture-gap';
    if(s.latch)return result(s.latch);
    const valid=components.filter(b=>b.compact);
    if(!s.track){
      if(valid.length!==1||components.some(b=>b.area>cfg.maxArea)){s.acquire=null;return result(valid.length?'acquisition-ambiguous':'absent');}
      const b=valid[0],a=s.acquire;
      if(!a||distance(a.blob,b)>cfg.associationRadius+cfg.maxSpeed*dt||!areaCompatible(a.blob,b)||appearance(a.blob,b)>cfg.appearanceDistance)s.acquire={blob:b,start:captureTime,frames:1};
      else{s.acquire={blob:b,start:a.start,frames:a.frames+1};}
      if(captureTime-s.acquire.start+1e-8<cfg.acquireSeconds||s.acquire.frames<cfg.acquireFrames)return result('acquiring');
      s.track=b;s.lastVisibleTime=captureTime;s.identity++;s.acquire=null;return result('tracked',b);
    }
    const age=captureTime-s.lastVisibleTime;
    if(age>cfg.occlusionGrace+1e-8){s.latch='lost';return result(s.latch);}
    const prediction={x:s.track.x+s.velocity[0]*age,y:s.track.y+s.velocity[1]*age};
    const radius=cfg.associationRadius+cfg.maxSpeed*age;
    const nearby=components.filter(b=>distance(prediction,b)<=radius&&appearance(s.track,b)<=cfg.appearanceDistance);
    // A large merged component or multiple plausible identities requires an
    // explicit reset. Predicted coordinates are never exposed as observations.
    if(nearby.some(b=>b.area>s.track.area*cfg.areaRatio)||nearby.length>1){s.latch='identity-ambiguous';return result(s.latch);}
    const best=nearby[0];
    if(!best||!best.compact||!areaCompatible(s.track,best))return result('occluded');
    if(valid.some(b=>b!==best&&appearance(best,b)<=cfg.appearanceDistance&&closeBounds(best,b))){s.latch='identity-ambiguous';return result(s.latch);}
    const elapsed=Math.max(.001,age),vx=(best.x-s.track.x)/elapsed,vy=(best.y-s.track.y)/elapsed,speed=Math.hypot(vx,vy),scale=Math.min(1,cfg.maxSpeed/Math.max(speed,.001));
    s.velocity=[vx*scale,vy*scale];s.track=best;s.lastVisibleTime=captureTime;
    return result(age>dt*1.5?'reacquired':'tracked',best);
  }
}
