import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DT=.02,FRAME_DT=.04,WARM_TICKS=100,TRIAL_TICKS=200;

// This is a renderer-only panorama. Its rotation is never a physical torque.
export class Panorama{
  constructor(arena){
    this.arena=arena;this.texture=new THREE.DataTexture(new Uint8Array(1024*8*4),1024,8,THREE.RGBAFormat);
    this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.wrapS=THREE.RepeatWrapping;
    this.mesh=new THREE.Mesh(new THREE.CylinderGeometry(4,4,4,256,1,true),new THREE.MeshBasicMaterial({map:this.texture,side:THREE.BackSide,toneMapped:false}));
    this.mesh.position.y=2;arena.scene.add(this.mesh);arena.scene.fog=null;arena.grid.visible=false;
    this.floor=arena.scene.children.find(c=>c.geometry?.type==='PlaneGeometry');
    if(this.floor){this.floor.material=new THREE.MeshBasicMaterial({color:0x808080,toneMapped:false});this.floor.receiveShadow=false;}
  }
  render({stripes=12,contrast=.8,phase=0,mean=.5,angle=0}={}){
    const key=[stripes,contrast,phase,mean].join('/');
    if(key!==this.key){const data=this.texture.image.data;for(let y=0;y<8;y++)for(let x=0;x<1024;x++){
      const value=Math.round(255*clamp(mean+contrast*.5*Math.sin(x/1024*Math.PI*2*stripes+phase),0,1)),i=(y*1024+x)*4;
      data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
    }this.texture.needsUpdate=true;this.key=key;}
    this.mesh.rotation.y=angle;
    if(this.floor)this.floor.material.color.setRGB(mean,mean,mean,THREE.SRGBColorSpace);
  }
  dispose(){this.arena.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}

export function calibrationCases(split){
  const held=split==='heldout',frequencies=held?[15,21]:[12,24],cases=[];
  for(const stripes of frequencies)for(const rate of held?[-.3,-.2,.2,.3,0]:[-.25,.25,0])cases.push({id:`${split}-${stripes}-${rate}`,split,family:rate?'rotation':'unchanged',stripes,rate,contrast:held?(stripes===15?.45:.7):.8,phase:held?(stripes===15?1.17:2.11):0});
  for(const family of ['flat-flash','flicker','illumination'])cases.push({id:`${split}-${family}`,split,family,stripes:held?21:12,rate:0,contrast:held?.55:.8,phase:held?1.83:0,frequency:held?3.3:.8});
  return cases;
}
export function calibrationPattern(c,time){
  let mean=.5,contrast=c.contrast,stripes=c.stripes;
  const active=time>.4&&time<1.7;
  if(c.family==='flat-flash'){stripes=0;contrast=0;mean=active&&time>(c.split==='heldout'?.56:.4)&&time<(c.split==='heldout'?1.04:.68)?(c.split==='heldout'?.08:.85):.5;}
  if(c.family==='flicker'&&active)contrast=c.contrast*Math.sin((time-.4)*Math.PI*2*c.frequency);
  if(c.family==='illumination'&&active)mean=c.split==='heldout'?(time<1.02?.2:.75):.7;
  return {stripes,contrast,phase:c.phase,mean,angle:c.rate*Math.max(0,time-.4)};
}
export function physicalCases(seeds=2,families=['panorama','perturbation','intentional']){
  if(!Number.isInteger(seeds)||seeds<1||seeds>100)throw Error('Use 1–100 seeds');
  if(families.some(f=>!['panorama','perturbation','intentional'].includes(f)))throw Error('Invalid trial family');
  return families.flatMap(family=>Array.from({length:seeds},(_,seed)=>({id:`${family}-${seed}`,family,seed,direction:seed%2?-1:1,stripes:seed%2?18:12,contrast:seed%2?.6:.8,phase:seed*.41})));
}
export function trialStimulus(c,time){
  const panoramaAngle=c.family==='panorama'?c.direction*.25*clamp(time-.8,0,1.6):0;
  const torque=c.family==='perturbation'&&time>=.8-1e-9&&time<.96-1e-9?c.direction*.003:0;
  const intent=c.family==='intentional'&&time>=.8&&time<2.4?c.direction*.25:0;
  return {panoramaAngle,torque,intent};
}
export const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function summarizeTrial(trial,condition,trace,startHeading,elapsedSeconds){
  const headingErrors=trace.map(r=>Math.abs(wrap(r.body.heading-startHeading-r.desiredHeading))),panoramaErrors=trace.map(r=>Math.abs(wrap(r.body.heading-startHeading-r.panoramaAngle))),after=trace.filter(r=>r.time>=.96);
  const mean=values=>values.reduce((s,v)=>s+v,0)/Math.max(1,values.length);
  let recoveryTime=null;
  if(trial.family==='perturbation')for(let i=0;i<after.length-25;i++)if(after.slice(i,i+25).every(r=>Math.abs(wrap(r.body.heading-startHeading))<.03)){recoveryTime=after[i].time-.96;break;}
  const evoked=trace.filter(r=>r.time>=.8&&r.time<2.4);
  const final=trace.at(-1),initial=trace[0];
  return {id:trial.id,condition,family:trial.family,seed:trial.seed,parameters:trial,elapsedSeconds,simulationSeconds:trace.length*DT,
    metrics:{worldHeadingErrorIntegral:headingErrors.reduce((a,b)=>a+b,0)*DT,meanAbsWorldHeadingError:mean(headingErrors),panoramaTrackingErrorIntegral:panoramaErrors.reduce((a,b)=>a+b,0)*DT,primaryObjective:trial.family==='panorama'?'panorama directional following':trial.family==='perturbation'?'fixed-world heading recovery':'preserve intentional turn',recoveryTime,
      postDisturbancePeakError:after.length?Math.max(...after.map(r=>Math.abs(wrap(r.body.heading-startHeading)))):0,
      finalHeadingChange:wrap(final.body.heading-startHeading),directionalHeadingChange:trial.direction*wrap(final.body.heading-startHeading),
      meanEvokedYaw:mean(evoked.map(r=>r.body.command[1])),falls:trace.some(r=>r.body.fallen)?1:0,maxTilt:Math.max(...trace.map(r=>r.body.tilt)),
      collisions:final.collisions-initial.collisions,distance:final.body.distance-initial.body.distance,
      maxAppliedTorque:Math.max(...trace.map(r=>Math.abs(r.torque))),retinalFrames:trace.filter(r=>r.frame).length},
    validation:{calibrationAdmission:true,physicalBenefit:false,fullProposalComplete:false},trace};
}
