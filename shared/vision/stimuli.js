import { WIDTH as W,HEIGHT as H,EYE_CALIBRATION,framePacket } from './frame.js';
export const STIMULI=['expand-off','expand-on','contract','translate','flash','appearance','edge-on','edge-off','rotation','field-entry'];
// Canonical movies use visual degrees and capture seconds, independent of simulation speed.
export function stimulusFrame(kind,time,{contrast=.8,bearing=0,speed=14,seed=0,calibration=EYE_CALIBRATION}={}){
  if(!STIMULI.includes(kind))throw Error('Unknown retinal stimulus');
  const pixels=new Uint8Array(W*H*4),phase=Math.max(0,time-.2),radius=kind==='contract'?Math.max(2,17-speed*phase):4+speed*phase;
  const direction=seed%2?1:-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const az=Math.atan((2*x/(W-1)-1)*Math.tan(calibration.verticalFov*Math.PI/360)*calibration.aspect)*180/Math.PI;
    const el=Math.atan((1-2*y/(H-1))*Math.tan(calibration.verticalFov*Math.PI/360))*180/Math.PI;
    const cx=kind==='translate'?bearing+direction*speed*phase:kind==='field-entry'?-60+speed*phase*5:bearing;
    let inside=Math.hypot(az-cx,el)<(kind==='translate'||kind==='field-entry'?12:kind==='appearance'?15:radius);
    let v=.5;
    if(kind==='flash')v=time<.3?.5:.5+contrast/2;
    else if(kind==='edge-on'||kind==='edge-off')v=az<(phase*speed*4-25)?(kind==='edge-on'?.5+contrast/2:.5-contrast/2):.5;
    else if(kind==='rotation')v=.5+contrast/2*Math.sin((az-direction*speed*phase)*Math.PI/8);
    else if((kind!=='appearance'||time>=.3)&&inside)v=.5+(kind==='expand-on'?1:-1)*contrast/2;
    const i=(y*W+x)*4,c=Math.round(v*255);pixels.set([c,c,c,255],i);
  }
  return pixels;
}
export function stimulusMovie(kind,options={}){
  const {dt=.04,duration=1.2,sourceId='stimulus',simulationRate=1,...stimulus}=options;
  return Array.from({length:Math.round(duration/dt)+1},(_,frameId)=>framePacket({pixels:stimulusFrame(kind,frameId*dt,stimulus),sourceId,frameId,captureTime:frameId*dt,simulationTime:frameId*dt*simulationRate,calibration:stimulus.calibration??EYE_CALIBRATION}));
}
