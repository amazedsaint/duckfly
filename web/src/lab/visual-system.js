import { VisionEncoder } from './vision.js';
import { MotionOpponent } from '../../../shared/vision/motion.js';
import { framePacket,validateFrame,EYE_CALIBRATION } from '../../../shared/vision/frame.js';
import { sampleRetina,RETINA_MAP_ID } from '../../../shared/vision/retina.js';
const blank=()=>new Uint8Array(96*64*4);
// One instance per camera/duck, two independent eye histories. Legacy mode is
// retained solely for previous recordings and the labeled marker comparison.
export class VisualSystem {
  constructor(){this.legacy=new VisionEncoder();this.reset();}
  reset(){this.left=new MotionOpponent();this.right=new MotionOpponent();this.features=[new VisionEncoder(),new VisionEncoder()];this.last=null;this.lastPacket=null;this.model=null;this.legacy=new VisionEncoder();}
  encode(value,time,duck){
    const p=value instanceof Uint8Array?framePacket({pixels:value,sourceId:'legacy-pixels',frameId:Math.round(time*50),captureTime:time,simulationTime:time}):validateFrame(value);
    const model=duck.visionModel??'marker-v1',key=JSON.stringify([model,duck.eye,p.sourceId,p.clock,p.calibration]);
    if(this.model!==key){if(!this.migratedLegacy)this.reset();this.migratedLegacy=false;this.model=key;}
    if(this.lastPacket&&(p.frameId<=this.lastPacket.frameId||p.captureTime<=this.lastPacket.captureTime)){
      // A duplicate is not a new observation. Its reported age can only grow.
      const age=Math.max(this.last?.capture?.age??0,p.age,Math.max(0,time-(this.last?.time??time)));
      return this.last?{...this.last,capture:{...this.last.capture,age,accepted:false,reason:'Repeated or out-of-order frame'}}:null;
    }
    if(this.lastPacket&&p.captureTime-this.lastPacket.captureTime>.25){this.left.reset();this.right.reset();}
    let result;
    if(model==='marker-v1')result=this.legacy.encode(p.pixels,96,64,p.captureTime,duck.eye,duck.source==='webcam');
    else{
      const stereo=!!p.views,l=p.views?.left??p.pixels,r=p.views?.right??p.pixels;
      const visible=[duck.eye!=='right'&&duck.eye!=='none',duck.eye!=='left'&&duck.eye!=='none'];
      const pixels=[visible[0]?l:blank(),visible[1]?r:blank()];
      const motion=[this.left.step(pixels[0],p.captureTime,p.calibration),this.right.step(pixels[1],p.captureTime,p.calibration)];
      if(duck.silence==='motion')for(const m of motion)m.loom=0;
      const features=pixels.map((px,i)=>this.features[i].encode(px,96,64,p.captureTime));
      const choose=name=>{const scored=features.map((f,i)=>({...f[name],view:i===0?'left':'right',bearing:Math.max(-1,Math.min(1,((stereo?(i===0?1:-1)*p.calibration.eyeYaw:0)+Math.atan(f[name].bearing*Math.tan(p.calibration.verticalFov*Math.PI/360)*p.calibration.aspect)*180/Math.PI)/50))}));return scored.sort((a,b)=>b.area-a.area)[0];};
      result={target:choose('target'),neighbor:choose('neighbor'),brightness:features.map(f=>(f.brightness[0]+f.brightness[1])/2),eye:duck.eye,
        loomL:duck.silence==='lplc2'?0:motion[0].loom,loomR:duck.silence==='lplc2'?0:motion[1].loom,
        flow:motion[0].flow,eyes:motion.map((m,i)=>({side:i?'right':'left',loom:m.loom,on:m.on,off:m.off,opponency:m.opponency,sectors:m.sectors,valid:m.valid})),
        retina:duck.retinaPreview?{map:RETINA_MAP_ID,left:Array.from(sampleRetina(pixels[0],p.calibration)),right:Array.from(sampleRetina(pixels[1],p.calibration))}:undefined,
        pathway:'motion-opponency → modeled LPLC2 current → GF',loomPathway:'lplc2',biologicalValidation:false};
    }
    result={...result,time,model,capture:{sourceId:p.sourceId,frameId:p.frameId,captureTime:p.captureTime,simulationTime:p.simulationTime,clock:p.clock,age:p.age,accepted:true,calibration:p.calibration.id,calibrated:p.calibration.calibrated!==false,pose:p.pose}};
    this.last=result;this.lastPacket={frameId:p.frameId,captureTime:p.captureTime};return result;
  }
  checkpoint(){return {version:2,model:this.model,last:this.last,lastPacket:this.lastPacket,legacy:this.legacy.checkpoint(),left:this.left.checkpoint(),right:this.right.checkpoint(),features:this.features.map(f=>f.checkpoint())};}
  restore(s){
    this.reset();if(s.version!==2){this.legacy.restore(s);this.migratedLegacy=true;return;}
    this.model=s.model;this.last=structuredClone(s.last);this.lastPacket=structuredClone(s.lastPacket);this.legacy.restore(s.legacy);this.left.restore(s.left);this.right.restore(s.right);this.features.forEach((f,i)=>f.restore(s.features[i]));
  }
}
