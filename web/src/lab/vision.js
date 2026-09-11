import { clamp } from '../bam.js';
export const EYE_WIDTH=96,EYE_HEIGHT=64;
const blankBlob=()=>({count:0,x:0,y:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
const pixel=(b,x,y)=>{b.count++;b.x+=x;b.y+=y;b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y);};
function blob(b,w,h){return b.count<5?{visible:false,area:0,bearing:0,candidatePixels:b.count}: {visible:true,candidatePixels:b.count,area:b.count/(w*h),bearing:1-2*b.x/b.count/(w-1),
  center:[b.x/b.count,b.y/b.count],bounds:[b.minX,b.minY,b.maxX-b.minX+1,b.maxY-b.minY+1]};}
export class VisionEncoder {
  constructor(){this.previous=null;this.previousThreat=[0,0];this.previousTime=null;}
  encode(rgba,width=EYE_WIDTH,height=EYE_HEIGHT,time=0,eye='both',motionLoom=false){
    if(width!==EYE_WIDTH||height!==EYE_HEIGHT||rgba.length!==width*height*4)throw Error('Unexpected camera frame dimensions');
    const gray=new Float32Array(width*height),target=blankBlob(),neighbor=blankBlob(),threat=[0,0],brightness=[0,0],counts=[0,0];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const side=x<width/2?0:1,i=y*width+x,j=i*4;
      const visible=eye==='both'||(eye==='left'&&side===0)||(eye==='right'&&side===1);
      if(!visible)continue;
      const [r,g,b]=rgba.subarray(j,j+3);gray[i]=(r*.299+g*.587+b*.114)/255;
      brightness[side]+=gray[i];counts[side]++;
      const isTarget=r>95&&r>g*1.35&&b>g*1.1&&b>r*.48;
      if(isTarget)pixel(target,x,y);
      if(g>80&&b>90&&g>r*1.2&&b>r*1.3)pixel(neighbor,x,y);
      if(!isTarget&&r>90&&r>g*1.8&&r>b*1.4&&b>g*.7)threat[side]++;
    }
    const dt=this.previousTime===null?0:time-this.previousTime;
    const flow={x:0,y:0,left:0,right:0,divergence:0,expansion:0,vectors:[]};let weight=0,sides=[0,0];
    if(this.previous&&dt>.001&&dt<.6){
      const old=this.previous;
      for(let y=8;y<height-8;y+=12)for(let x=8;x<width-8;x+=12){
        const side=x<width/2?0:1;if(!counts[side])continue;
        let mean=0,square=0;
        for(let py=-3;py<=3;py++)for(let px=-3;px<=3;px++){const v=old[(y+py)*width+x+px];mean+=v;square+=v*v;}
        if(square/49-(mean/49)**2<.001)continue;
        let best=Infinity,bx=0,by=0;
        for(let dy=-3;dy<=3;dy++)for(let dx=-4;dx<=4;dx++){
          let error=(Math.abs(dx)+Math.abs(dy))*.00002;
          for(let py=-3;py<=3;py++)for(let px=-3;px<=3;px++)error+=Math.abs(old[(y+py)*width+x+px]-gray[(y+py+dy)*width+x+px+dx]);
          if(error<best){best=error;bx=dx;by=dy;}
        }
        if(best/49>.16)continue;
        const vx=bx/width/dt,vy=by/height/dt;
        flow.vectors.push({x,y,dx:bx,dy:by});flow.x+=vx;flow.y+=vy;weight++;
        flow[side===0?'left':'right']+=Math.hypot(vx,vy);sides[side]++;
        const rx=x-width/2,ry=y-height/2;
        flow.expansion+=(rx*bx+ry*by)/(Math.max(100,rx*rx+ry*ry)*dt);
        if(y<height*.65)flow.divergence+=((x-width/2)*bx+(y-height/2)*by)/(width*height*dt);
      }
    }
    if(weight){flow.x/=weight;flow.y/=weight;flow.divergence/=weight;flow.expansion/=weight;}
    flow.left/=Math.max(1,sides[0]);flow.right/=Math.max(1,sides[1]);
    const areas=threat.map(n=>n/(width*height/2));
    const loom=areas.map((a,i)=>dt>0&&dt<.6&&a>.002?clamp((Math.sqrt(a)-Math.sqrt(this.previousThreat[i]))/dt*2,0,1):0);
    if(motionLoom&&weight>=4){const expansion=clamp((flow.expansion-.12)*1.6,0,1);for(let i=0;i<2;i++)if(counts[i])loom[i]=Math.max(loom[i],expansion);}
    this.previous=gray;this.previousThreat=areas;this.previousTime=time;
    return {time,target:blob(target,width,height),neighbor:blob(neighbor,width,height),
      loomL:loom[0],loomR:loom[1],threat:areas,flow,brightness:brightness.map((v,i)=>v/Math.max(1,counts[i])),eye};
  }
  checkpoint(){return {previous:this.previous?btoa(Array.from(new Uint8Array(this.previous.buffer),n=>String.fromCharCode(n)).join('')):null,previousThreat:[...this.previousThreat],previousTime:this.previousTime};}
  restore(s){
    if(typeof s.previous==='string'){
      const bytes=Uint8Array.from(atob(s.previous),c=>c.charCodeAt(0));if(bytes.length!==EYE_WIDTH*EYE_HEIGHT*4)throw Error('Invalid saved vision frame');
      this.previous=new Float32Array(bytes.buffer);
    }else this.previous=s.previous?Float32Array.from(s.previous):null;
    this.previousThreat=[...s.previousThreat];this.previousTime=s.previousTime;
  }
}

export const DEFAULT_WEIGHTS={forward:.12,turn:.18,flow:.08,field:.12};
export class SensoryAdapter {
  constructor(weights=DEFAULT_WEIGHTS){this.weights={...weights};this.lastSeen=0;this.lastBearing=0;}
  sense(vision,duck,time,fields={odor:[0,0],light:[0,0]},body=null,senses=null){
    const v=vision??{target:{visible:false},neighbor:{visible:false},flow:{left:0,right:0},brightness:[0,0],loomL:0,loomR:0};
    const object=duck.mode==='flock'?v.neighbor:v.target;
    const following=['target','flock','reactive'].includes(duck.mode),fieldMode=['odor','light'].includes(duck.mode);
    let forward=0,turn=0;
    if(following&&object.visible){
      this.lastSeen=time;this.lastBearing=object.bearing;
      const tooNear=object.area>(duck.mode==='flock'?.08:.1);
      forward=tooNear?0:this.weights.forward;
      turn=object.bearing*this.weights.turn;
      if(tooNear&&duck.mode==='flock')turn=-Math.sign(object.bearing||1)*.15;
    }
    if(fieldMode){
      const sides=duck.mode==='light'?v.brightness:fields.odor;
      forward=clamp((sides[0]+sides[1])*this.weights.field,0,.15);turn=clamp((sides[0]-sides[1])*this.weights.turn,-.2,.2);
    }
    const scentMode=duck.mode==='odor'&&!!duck.senses;
    if(scentMode){
      const scent=senses?.scent;
      forward=scent?.available&&scent.detected&&scent.strength<.92?this.weights.field:0;
      turn=scent?.available&&scent.detected?clamp(scent.contrast*this.weights.turn*8,-.2,.2):0;
    }
    if(duck.flowSteer)turn+=clamp((v.flow.right-v.flow.left)*this.weights.flow,-.12,.12);
    const age=vision?Math.max(vision.capture?.age??0,time-vision.time):Infinity;
    const fresh=!!vision&&age<=.3;
    if(!fresh&&duck.source==='webcam'&&!scentMode){forward=0;turn=0;}
    const head=duck.activeLook?[0,0,object.visible?clamp(object.bearing*.3,-.35,.35):Math.sin(time*1.3)*.3,0]:[0,0,0,0];
    let headReason=duck.activeLook?(object.visible?'Marker tracking':'Search oscillator'):'Neutral head';
    if(duck.headStabilization&&body){
      const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
      this.headingReference??=body.heading;
      const delta=wrap(body.heading-this.headingReference);
      this.headingReference=wrap(this.headingReference+delta*.05);
      head[2]=clamp(head[2]-delta,-.35,.35);headReason+=' + bounded yaw stabilization';
    }else this.headingReference=null;
    const scentReason=!senses?.scent.available?'Scent sensors off':!senses.scent.detected?'No scent detected':senses.scent.strength>=.92?'Scent source reached':'Scent gradient';
    return {forward,turn,loomL:fresh?v.loomL:0,loomR:fresh?v.loomR:0,loomPathway:v.loomPathway??'both',head,headReason,fresh,age:Number.isFinite(age)?age:null,
      ...(senses?{senses,air:senses.air.strength,brainFresh:scentMode?!!senses.scent.available:fresh}:{}),
      gateReason:scentMode?scentReason:!fresh?'Camera stale or absent':following&&!object.visible?'Target absent':following&&forward===0?'Target near':'None',
      gate:scentMode?forward===0:following&&(!object.visible||!fresh||forward===0),
      reason:scentMode?scentReason:!fresh?'Camera stale or absent':following?(object.visible?'Target visible through camera':'Target absent from camera'):fieldMode?`${duck.mode} sensory adapter`:'Direct neural experiment'};
  }
  checkpoint(){return {weights:{...this.weights},lastSeen:this.lastSeen,lastBearing:this.lastBearing,headingReference:this.headingReference??null};}
  restore(s){Object.assign(this,structuredClone(s));}
}
