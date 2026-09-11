import { stimulusMovie,STIMULI } from '../../../shared/vision/stimuli.js';
import { RETINA,projectReceptor } from '../../../shared/vision/retina.js';
import { EYE_CALIBRATION } from '../../../shared/vision/frame.js';
import { VisualSystem } from './visual-system.js';
import { Brain } from '../brain.js';
import { SpatialResponseView } from './spatial-response-view.js';
import './spatial-response.css';
export function mountVisionBench(button){
  const dialog=document.createElement('dialog');dialog.id='vision-bench-dialog';dialog.className='vision-bench';
  dialog.innerHTML=`<div class="dialog-top"><strong>Vision test bench</strong><button id="bench-close" aria-label="Close retinal bench">✕</button></div><p>Run a visual pattern and inspect the neural response. The full Flyvis model shows activity across T4/T5 cells. The compact model tests inputs to the stop-reflex pathway.</p><div class="pair"><label>Stimulus<select id="bench-stimulus">${STIMULI.map(s=>`<option value="${s}">${s.replaceAll('-',' ')}</option>`).join('')}</select></label><label>Disable a pathway<select id="bench-intervention"><option value="none">None</option><option value="motion">Remove motion input</option><option value="lplc2">Silence LPLC2 bridge</option><option value="gf">Silence Giant Fiber</option></select></label><label>Model<select id="bench-model"><option value="motion-opponency-v1">Motion detection · experimental</option><option value="flyvis-000">Flyvis full reference · 45,669 neurons</option><option value="marker-v1">Color tracking</option></select></label><label>GF input gain<input id="bench-gain" type="number" min="1" max="12" value="6" step=".5"></label></div><div class="bench-views"><figure><canvas id="bench-pixels" width="384" height="256"></canvas><figcaption>Calibrated input · 96 × 64</figcaption></figure><figure><canvas id="bench-retina" width="384" height="256"></canvas><figcaption>721 retinal samples · index map v1</figcaption></figure></div><canvas id="bench-trace" width="768" height="130" aria-label="Loom response over capture time"></canvas><p class="hint" id="bench-legend">Green: normalized loom (0–1). Orange marks: GF stop event. Capture time runs left to right, 0–1.2 s.</p><div id="bench-neurons"></div><div id="bench-spatial" hidden></div><p id="bench-status" role="status">Ready. Tests run separately from your scene.</p><div class="pair"><button id="bench-run" class="primary">Run stimulus</button><button id="bench-save" disabled>Save response trace</button></div>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(id.startsWith('#')?id:'#'+id);let generation=0,report,referenceWorker,referenceReject,referenceFrames=[];
  const spatialView=new SpatialResponseView($('#bench-spatial'),index=>drawReferenceFrame(index));
  const runControls=()=>dialog.querySelectorAll(':scope > .pair select,:scope > .pair input');
  const cancel=()=>{generation++;referenceWorker?.terminate();referenceReject?.(Error('Reference run cancelled'));referenceReject=null;referenceWorker=null;$('#bench-run').disabled=false;runControls().forEach(el=>el.disabled=false);};
  const syncCompactControls=()=>{const compact=$('#bench-model').value!=='flyvis-000';for(const id of ['bench-intervention','bench-gain'])$('#'+id).closest('label').hidden=!compact;};
  $('#bench-model').onchange=syncCompactControls;
  button.onclick=()=>{syncCompactControls();dialog.showModal();};$('#bench-close').onclick=()=>{cancel();dialog.close();};dialog.addEventListener('close',cancel);
  $('#bench-run').onclick=async()=>{
    const run=++generation;report=null;window.duckflyVisionBench=null;referenceFrames=[];spatialView.reset();$('#bench-run').disabled=true;$('#bench-save').disabled=true;runControls().forEach(el=>el.disabled=true);
    try{
      if($('#bench-model').value==='flyvis-000'){await runReference();return;}
      $('#bench-trace').setAttribute('aria-label','Loom response over capture time');$('#bench-neurons').textContent='';$('#bench-legend').textContent='Green: normalized loom (0–1). Orange: GF stop events. Capture time: 0–1.2 s.';
      const circuit=await fetch('/assets/Brain/circuit.json').then(r=>{if(!r.ok)throw Error('Circuit unavailable');return r.json();});
      const model=$('#bench-model').value;
      const duck={retinaPreview:true,mode:'brain',source:'eyes',eye:'both',visionModel:model,silence:$('#bench-intervention').value};
      const brain=new Brain(circuit,'retinal-bench-v1'),encoder=new VisualSystem();brain.intervene(duck.silence);brain.sim.setGFGain(Number($('#bench-gain').value));
      const movie=stimulusMovie($('#bench-stimulus').value),trace=[];
      const pixels=$('#bench-pixels').getContext('2d'),retina=$('#bench-retina').getContext('2d'),graph=$('#bench-trace').getContext('2d');
      const small=document.createElement('canvas');small.width=96;small.height=64;const context=small.getContext('2d');
      for(const packet of movie){
        if(run!==generation)return;
        const v=encoder.encode(packet,packet.simulationTime,duck);let neural;
        for(let i=0;i<2;i++)neural=brain.step(null,v);
        trace.push({captureTime:packet.captureTime,loomL:v.loomL,loomR:v.loomR,eyes:v.eyes,spikes:neural.spikeCount,gfStop:neural.event.includes('stop reflex')});
        context.putImageData(new ImageData(new Uint8ClampedArray(packet.pixels),96,64),0,0);pixels.imageSmoothingEnabled=false;pixels.drawImage(small,0,0,384,256);
        retina.fillStyle='#101914';retina.fillRect(0,0,384,256);
        for(const c of RETINA){const [x,y]=projectReceptor(c,EYE_CALIBRATION),value=v.retina?.left[c.index]??.5;retina.fillStyle=`rgb(${value*255} ${value*255} ${value*255})`;retina.beginPath();retina.arc(x*4,y*4,3.3,0,Math.PI*2);retina.fill();}
        graph.fillStyle='#101914';graph.fillRect(0,0,768,130);graph.strokeStyle='#a5e39a';graph.lineWidth=2;graph.beginPath();trace.forEach((t,i)=>{const x=i/(movie.length-1)*768,y=115-Math.max(t.loomL,t.loomR)*100;i?graph.lineTo(x,y):graph.moveTo(x,y);});graph.stroke();
        graph.fillStyle='#edaf6d';trace.forEach((t,i)=>{if(t.gfStop)graph.fillRect(i/(movie.length-1)*768,3,4,8);});
        $('#bench-status').textContent=`${packet.captureTime.toFixed(2)} s capture · loom ${Math.max(v.loomL,v.loomR).toFixed(2)} · ${neural.event}`;
        await new Promise(r=>setTimeout(r,40));
      }
      report={format:'duckfly-retinal-bench',version:1,stimulus:$('#bench-stimulus').value,model,intervention:duck.silence,gfGain:brain.sim.gfGain,calibration:EYE_CALIBRATION,dt:.04,biologicalValidation:false,trace};
      window.duckflyVisionBench=report;$('#bench-save').disabled=false;
    }catch(e){if(run===generation)$('#bench-status').textContent=e.message;}finally{if(run===generation){$('#bench-run').disabled=false;runControls().forEach(el=>el.disabled=false);}}
  };
  function drawReferenceFrame(index){
    const data=referenceFrames[index];if(!data)return;
    const pixels=$('#bench-pixels').getContext('2d'),retina=$('#bench-retina').getContext('2d'),graph=$('#bench-trace').getContext('2d');
    const small=document.createElement('canvas');small.width=96;small.height=64;
    small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.packet.pixels),96,64),0,0);
    pixels.imageSmoothingEnabled=false;pixels.drawImage(small,0,0,384,256);
    retina.fillStyle='#182b30';retina.fillRect(0,0,384,256);
    for(const c of RETINA){const [x,y]=projectReceptor(c,data.packet.calibration),value=data.retina[c.index];retina.fillStyle=`rgb(${value*255} ${value*255} ${value*255})`;retina.beginPath();retina.arc(x*4,y*4,3.3,0,Math.PI*2);retina.fill();}
    const trace=referenceFrames.map(frame=>{const values=Object.values(frame.result.populations);return values.reduce((a,b)=>a+b,0)/values.length;});
    const max=Math.max(.01,...trace),duration=Math.max(.04,referenceFrames.at(-1).packet.captureTime);
    graph.fillStyle='#182b30';graph.fillRect(0,0,768,130);graph.strokeStyle='#b9efec';graph.lineWidth=2;graph.beginPath();
    trace.forEach((value,i)=>{const x=referenceFrames[i].packet.captureTime/duration*768,y=115-value/max*100;i?graph.lineTo(x,y):graph.moveTo(x,y);});graph.stroke();
    graph.fillStyle='#ffe63e';graph.fillRect(Math.min(766,data.packet.captureTime/duration*768),0,2,130);
    $('#bench-neurons').textContent=Object.entries(data.result.populations).map(([type,value])=>`${type} ${value.toFixed(3)}`).join(' · ');
  }
  async function runReference(){
    referenceWorker?.terminate();referenceWorker=new Worker(new URL('./flyvis.worker.js',import.meta.url),{type:'module'});
    $('#bench-legend').textContent='Overview: mean positive activity change, auto-scaled. Yellow marks the selected frame. The maps below retain signed responses at every location.';
    $('#bench-trace').setAttribute('aria-label','Mean positive T4/T5 response over recorded capture time');
    $('#bench-neurons').textContent='Loading the full Flyvis model. The compact model’s pathway controls and gain settings do not apply here.';
    try{
      await new Promise((resolve,reject)=>{
        referenceReject=reject;
        referenceWorker.onmessage=({data})=>{
          if(data.type==='status')$('#bench-status').textContent=data.message;
          if(data.type==='error'){referenceReject=null;reject(Error(data.message));}
          if(data.type==='reference')spatialView.reference(data.spatialMetadata,data.baseline);
          if(data.type==='frame'){
            referenceFrames.push(data);spatialView.append(data.result.spatial);
            $('#bench-status').textContent=`${data.packet.captureTime.toFixed(2)} s input · full Flyvis · signed spatial responses · 500 Hz integration`;
          }
          if(data.type==='done'){
            referenceReject=null;report=data.report;window.duckflyVisionBench=report;$('#bench-save').disabled=false;
            $('#bench-status').textContent=`Completed · integration p95 ${report.loopTimingMs.p95.toFixed(1)} ms per 40 ms of input · not connected to the duck`;resolve();
          }
        };
        referenceWorker.onerror=e=>{referenceReject=null;reject(Error(e.message));};
        referenceWorker.postMessage({type:'run',stimulus:$('#bench-stimulus').value});
      });
    }finally{referenceWorker?.terminate();referenceWorker=null;}
  }
  $('#bench-save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(report)],{type:'application/json'}));a.href=url;a.download='duckfly-retinal-response.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
