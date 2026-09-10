// Camera clocks are seconds. Pixels are top-left, unmirrored sRGB RGBA.
export const WIDTH=96,HEIGHT=64;
export const EYE_CALIBRATION=Object.freeze({id:'duckfly-pinhole-v2',projection:'pinhole',verticalFov:75,aspect:WIDTH/HEIGHT,eyeYaw:25,eyeSeparationMeters:.036,units:'degrees',colorSpace:'srgb',mirrored:false});
export const WEBCAM_CALIBRATION=Object.freeze({...EYE_CALIBRATION,id:'webcam-uncalibrated-v1',eyeYaw:0,eyeSeparationMeters:0,calibrated:false});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function framePacket({pixels,views,sourceId,frameId,captureTime,simulationTime,age=0,clock='simulation',calibration=EYE_CALIBRATION,pose=null}){
  return validateFrame({version:2,width:WIDTH,height:HEIGHT,pixels,views,sourceId,frameId,captureTime,simulationTime,age,clock,calibration,pose});
}
export function validateFrame(p){
  if(!p||p.version!==2||p.width!==WIDTH||p.height!==HEIGHT)throw Error('Invalid camera packet dimensions');
  if(typeof p.sourceId!=='string'||p.sourceId.length>120||!Number.isSafeInteger(p.frameId)||p.frameId<0)throw Error('Invalid camera identity');
  if(!finite(p.captureTime)||p.captureTime<0||!finite(p.simulationTime)||p.simulationTime<0||!finite(p.age)||p.age<0||!['simulation','media','presentation','decode-arrival'].includes(p.clock))throw Error('Invalid camera clock');
  const c=p.calibration;if(!c||c.projection!=='pinhole'||!finite(c.verticalFov)||c.verticalFov<=0||c.verticalFov>=180||c.aspect!==WIDTH/HEIGHT||!finite(c.eyeYaw)||Math.abs(c.eyeYaw)>90||c.colorSpace!=='srgb'||c.mirrored!==false)throw Error('Unsupported camera calibration');
  for(const a of [p.pixels,...Object.values(p.views??{})])if(!(a instanceof Uint8Array)||a.length!==WIDTH*HEIGHT*4)throw Error('Invalid camera pixels');
  if(p.views&&(!p.views.left||!p.views.right||Object.keys(p.views).some(k=>!['left','right'].includes(k))))throw Error('Expected a pair of eye views');
  if(p.pose&&(!Array.isArray(p.pose)||p.pose.length!==7||!p.pose.every(finite)))throw Error('Invalid camera pose');
  return p;
}
export function packetBuffers(frames){return [...new Set(Object.values(frames).filter(Boolean).flatMap(p=>p instanceof Uint8Array?[p.buffer]:[p.pixels.buffer,...Object.values(p.views??{}).map(v=>v.buffer)]))];}
const toBase64=v=>btoa(Array.from(v,n=>String.fromCharCode(n)).join(''));
const fromBase64=s=>{if(typeof s!=='string'||s.length!==WIDTH*HEIGHT*4*4/3)throw Error('Invalid recorded image');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));};
export function serializeFrame(p){return p instanceof Uint8Array?toBase64(p):{...p,pixels:toBase64(p.pixels),views:p.views?Object.fromEntries(Object.entries(p.views).map(([k,v])=>[k,toBase64(v)])):undefined};}
export function deserializeFrame(p){return typeof p==='string'?fromBase64(p):validateFrame({...p,pixels:fromBase64(p.pixels),views:p.views?Object.fromEntries(Object.entries(p.views).map(([k,v])=>[k,fromBase64(v)])):undefined});}
