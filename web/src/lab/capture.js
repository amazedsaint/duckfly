import { framePacket,WEBCAM_CALIBRATION } from '../../../shared/vision/frame.js';
// Decode callbacks establish identity. Rendering requests never mint camera frames.
export class WebcamCapture {
  constructor(video){
    this.video=video;this.sourceId=`webcam-${crypto.randomUUID()}`;this.id=0;this.latest=null;this.stopped=false;this.clock=null;this.lastMediaTime=null;
    this.canvas=document.createElement('canvas');this.canvas.width=96;this.canvas.height=64;this.context=this.canvas.getContext('2d',{willReadFrequently:true});
    if(!video.requestVideoFrameCallback)throw Error('This browser cannot timestamp decoded webcam frames. Use the duck-eye camera.');
    const next=(now,metadata)=>{if(this.stopped)return;
      this.context.drawImage(video,0,0,96,64);
      this.id++;
      // Some WKWebView canvas streams report mediaTime=0 for every decoded frame.
      // Select a declared decode-arrival clock after observing the first pair.
      if(this.lastMediaTime!==null&&!this.clock)this.clock=metadata.mediaTime>this.lastMediaTime?'media':'decode-arrival';
      this.lastMediaTime=metadata.mediaTime;
      if(this.clock)this.latest={pixels:new Uint8Array(this.context.getImageData(0,0,96,64).data),frameId:this.id,captureTime:this.clock==='media'?metadata.mediaTime:performance.now()/1000,receivedAt:performance.now()};
      this.callback=video.requestVideoFrameCallback(next);
    };
    this.callback=video.requestVideoFrameCallback(next);
  }
  reset(){this.latest=null;} // After resume, require a newly decoded frame; no flow across the pause.
  frame(simulationTime){const f=this.latest;return f?framePacket({pixels:f.pixels.slice(),sourceId:this.sourceId,frameId:f.frameId,captureTime:f.captureTime,simulationTime,age:Math.max(0,(performance.now()-f.receivedAt)/1000),clock:this.clock,calibration:WEBCAM_CALIBRATION}):null;}
  stop(){this.stopped=true;this.video.cancelVideoFrameCallback?.(this.callback);this.latest=null;}
}
