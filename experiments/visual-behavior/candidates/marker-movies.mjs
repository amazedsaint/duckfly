export const MARKER_FAMILIES=['isolated','separated-distractor','same-color-cross','brief-occlusion','ambiguous-occlusion','close-distractor','global-flash','local-flash','no-marker','camera-shift','prolonged-loss'];
const random=seed=>{let x=2166136261;for(const ch of seed)x=Math.imul(x^ch.charCodeAt(0),16777619);return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};};
export function markerCases(split,count){return MARKER_FAMILIES.flatMap(family=>Array.from({length:count},(_,index)=>{const id=`marker-v1-${split}-${family}-${index}`,r=random(id),held=split==='heldout';return{id,family,index,split,dt:held?[.025,.04,.05][index%3]:.04,duration:2,onset:0,radius:(held?2.8:3.5)+r()*2,x:22+r()*5,y:25+r()*5,speed:12+r()*6,phase:r()*6.28,color:[180+Math.floor(r()*60),25+Math.floor(r()*35),110+Math.floor(r()*40)],noise:held?r()*5:0};}));}
export function markerFrame(c,time){
  const pixels=new Uint8Array(96*64*4),noTarget=['global-flash','local-flash','no-marker'].includes(c.family),shift=c.family==='camera-shift'?5*Math.sin(time*2+c.phase):0;
  let tx=c.x+c.speed*time+shift,ty=c.y,visible=!noTarget,ambiguous=false,dist=null;
  if(c.family==='same-color-cross'){tx=25+18*time;dist={x:75-18*time,y:ty,r:c.radius};ambiguous=Math.abs(tx-dist.x)<=2*c.radius+3||time>=1.4;}
  if(c.family==='separated-distractor'&&time>=.4)dist={x:73-c.speed*time*.5,y:ty+22,r:c.radius};
  if(c.family==='brief-occlusion')visible=!(time>=.7&&time<.86);
  if(c.family==='ambiguous-occlusion'){
    if(time>=.4)dist={x:tx+(time<.65?18*(.7-time)/.3:0),y:ty,r:c.radius};
    if(time>=.7&&time<.86){visible=false;dist=null;}
    if(time>=.86)dist={x:tx+14*(time-.86),y:ty,r:c.radius};
    ambiguous=time>=.65;
  }
  if(c.family==='close-distractor'&&time>=.65){dist={x:tx+c.radius*1.5,y:ty,r:c.radius};ambiguous=true;}
  if(c.family==='prolonged-loss'){
    if(time>=.65)visible=false;
    if(time>=1.3)dist={x:tx,y:ty,r:c.radius};
    ambiguous=time>=.65;
  }
  const localFlash=c.family==='local-flash'&&((time>=.4&&time<.48)||(time>=1.2&&time<1.28));
  const globalFlash=c.family==='global-flash'&&((time>=.4&&time<.48)||(time>=1.2&&time<1.28));
  for(let y=0;y<64;y++)for(let x=0;x<96;x++){
    const texture=8*Math.sin((x-shift)*.31+y*.19+c.phase),base=165+texture+c.noise*Math.sin(x*12.9+y*7.1+time*25),j=(y*96+x)*4;
    let rgb=[base,base+8,base+3];
    const paint=(cx,cy,r)=>{const alpha=Math.max(0,Math.min(1,.5-(Math.hypot(x-cx,y-cy)-r)));rgb=rgb.map((v,k)=>v*(1-alpha)+c.color[k]*alpha);};
    if(visible)paint(tx,ty,c.radius);
    if(dist&&time>=.35)paint(dist.x,dist.y,dist.r);
    if(localFlash)paint(48,32,c.radius);
    if(globalFlash)rgb=c.color;
    for(let k=0;k<3;k++)pixels[j+k]=Math.round(rgb[k]);pixels[j+3]=255;
  }
  return{pixels,truth:{visible,center:visible?[tx,ty]:null,radius:c.radius,ambiguous,hasTarget:!noTarget,
    safeTracking:['isolated','separated-distractor','camera-shift'].includes(c.family)}};
}
export function markerTimes(c){return Array.from({length:Math.round(c.duration/c.dt)+1},(_,i)=>Number((i*c.dt).toFixed(8)));}
