import { multiply,conjugate } from '../feedback/rotation-motion.js';
import { opticalHeading } from '../feedback/candidates.js';
export const SNAPSHOT=264,WINDOW=5,STRIDE=3,INPUT=SNAPSHOT*WINDOW;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function pool(pixels){
 const out=new Float32Array(128);let mean=0;
 for(let y=0;y<8;y++)for(let x=0;x<16;x++){
  let sum=0;for(let dy=0;dy<8;dy++)for(let dx=0;dx<6;dx++){const i=((y*8+dy)*96+x*6+dx)*4;sum+=(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)/255;}
  out[y*16+x]=sum/48;mean+=sum/48/128;
 }
 let variance=0;for(const value of out)variance+=(value-mean)**2/128;
 const scale=Math.max(.1,Math.sqrt(variance));return Array.from(out,v=>clamp((v-mean)/scale,-3,3)/3);
}
export class TemporalFeatures{
 constructor(){this.reset();}
 reset(){this.history=[];this.pose=null;this.time=null;this.source=null;this.frameId=null;}
 observe(packet,body){
  if(this.source!==packet.sourceId||this.time!==null&&packet.captureTime-this.time>.25)this.reset();
  if(this.time!==null&&(packet.captureTime<=this.time||packet.frameId<=this.frameId))return null;
  const q=packet.pose?.slice(3),dt=this.time===null?0:packet.captureTime-this.time;
  const relative=q&&this.pose?multiply(conjugate(this.pose),q):[1,0,0,0];
  const sign=relative[0]<0?-1:1,angle=2*Math.atan2(Math.hypot(...relative.slice(1)),Math.abs(relative[0])),length=Math.hypot(...relative.slice(1));
  const angular=relative.slice(1).map(v=>dt&&length?clamp(sign*v/length*angle/dt/10,-1,1):0);
  const [w,x,y,z]=q??[1,0,0,0],head=wrap((opticalHeading(packet.pose)??body.heading)-body.heading)/Math.PI;
  const feedback=[...angular,head,2*(x*x+y*y)-1,clamp(body.speed/.3,0,2),Math.sin(body.phase*2*Math.PI),Math.cos(body.phase*2*Math.PI)];
  const snapshot=[...pool(packet.views?.left??packet.pixels),...pool(packet.views?.right??packet.pixels),...feedback];
  this.history.push(snapshot);if(this.history.length>13)this.history.shift();this.pose=q;this.time=packet.captureTime;this.source=packet.sourceId;this.frameId=packet.frameId;
  return snapshot;
 }
 input(mode='temporal'){
  if(!this.history.length)return null;
  const last=this.history.length-1,result=[];
  for(let k=WINDOW-1;k>=0;k--){const s=[...this.history[Math.max(0,last-(mode==='static'?0:k*STRIDE))]];
   if(mode==='no-pose')s.fill(0,256,261);
   if(mode==='wrong-pose')for(let i=256;i<261;i++)s[i]=-s[i];
   result.push(...s);
  }
  if(mode==='reverse-time'){const frames=Array.from({length:5},(_,i)=>result.slice(i*SNAPSHOT,(i+1)*SNAPSHOT));return frames.reverse().flat();}
  return result;
 }
 checkpoint(){return structuredClone({history:this.history,pose:this.pose,time:this.time,source:this.source,frameId:this.frameId});}
 restore(s){Object.assign(this,structuredClone(s));}
}
