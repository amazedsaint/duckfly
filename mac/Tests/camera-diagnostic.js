// Synthetic compositor diagnostic. This never requests a physical camera.
const receipts=[];
for(const attached of [false,true])for(const changing of [false,true]){
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;
  const context=canvas.getContext('2d');let draws=0;
  const visibility=[];
  const draw=()=>{
    draws++;visibility.push({at:performance.now(),state:document.visibilityState,focus:document.hasFocus()});context.fillStyle='#777';context.fillRect(0,0,96,64);
    context.fillStyle='#f02882';context.fillRect(32,22,16,18);
    if(changing){context.fillStyle=`rgb(${20+draws%50} ${20+draws%50} ${20+draws%50})`;context.fillRect(0,62,2,2);}
  };
  draw();const stream=canvas.captureStream(25),video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.srcObject=stream;
  video.style.cssText='position:fixed;bottom:12px;left:12px;width:96px;height:64px;z-index:99999';
  if(attached)document.body.append(video);
  const timer=setInterval(draw,40);
  await video.play();
  const frames=[];let callback,stopped=false;
  const observe=(now,metadata)=>{
    if(stopped)return;
    frames.push({at:performance.now(),mediaTime:metadata.mediaTime,presentedFrames:metadata.presentedFrames});
    callback=video.requestVideoFrameCallback(observe);
  };
  callback=video.requestVideoFrameCallback(observe);
  await new Promise(resolve=>setTimeout(resolve,1600));
  stopped=true;clearInterval(timer);video.cancelVideoFrameCallback(callback);
  const gaps=frames.slice(1).map((frame,index)=>frame.at-frames[index].at);
  receipts.push({attached,changing,draws,decodedFrames:frames.length,maximumGapMs:gaps.length?Math.max(...gaps):null,visibility,frames});
  stream.getTracks().forEach(track=>track.stop());video.srcObject=null;video.remove();
}
return {format:'duckfly-native-camera-compositor-diagnostic',receipts};
