import { stimulusMovie,STIMULI } from '../../../shared/vision/stimuli.js';
import { RETINA,projectReceptor } from '../../../shared/vision/retina.js';
import { EYE_CALIBRATION } from '../../../shared/vision/frame.js';
import { VisualSystem } from './visual-system.js';
import { Brain } from '../brain.js';
export function mountVisionBench(button){
  const dialog=document.createElement('dialog');dialog.id='vision-bench-dialog';dialog.className='vision-bench';
  dialog.innerHTML=`<div class="dialog-top"><strong>Retinal stimulus bench</strong><button id="bench-close" aria-label="Close retinal bench">✕</button></div><p>Play a known visual stimulus through the motion baseline and the fly circuit. This bench measures modeled responses; physiological validation remains pending.</p><div class="pair"><label>Stimulus<select id="bench-stimulus">${STIMULI.map(s=>`<option value="${s}">${s.replaceAll('-',' ')}</option>`).join('')}</select></label><label>Intervention<select id="bench-intervention"><option value="none">None</option><option value="motion">Remove motion input</option><option value="lplc2">Silence LPLC2 bridge</option><option value="gf">Silence Giant Fiber</option></select></label><label>Model<select id="bench-model"><option value="motion-opponency-v1">Motion opponency</option><option value="flyvis-000">Flyvis full reference · 45,669 neurons</option><option value="marker-v1">Original marker baseline</option></select></label><label>GF input gain<input id="bench-gain" type="number" min="1" max="12" value="6" step=".5"></label></div><div class="bench-views"><figure><canvas id="bench-pixels" width="384" height="256"></canvas><figcaption>Calibrated input · 96 × 64</figcaption></figure><figure><canvas id="bench-retina" width="384" height="256"></canvas><figcaption>721 retinal samples · index map v1</figcaption></figure></div><canvas id="bench-trace" width="768" height="130" aria-label="Loom response over capture time"></canvas><p class="hint" id="bench-legend">Green: normalized loom (0–1). Orange marks: GF stop event. Capture time runs left to right, 0–1.2 s.</p><div id="bench-neurons"></div><p id="bench-status" role="status">Ready. The bench runs independently of your arena.</p><div class="pair"><button id="bench-run" class="primary">Run stimulus</button><button id="bench-save" disabled>Save response trace</button></div>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(id.startsWith('#')?id:'#'+id);let generation=0,report,referenceWorker,referenceReject;
  const cancel=()=>{generation++;referenceWorker?.terminate();referenceReject?.(Error('Reference run cancelled'));referenceReject=null;referenceWorker=null;$('#bench-run').disabled=false;dialog.querySelectorAll('select,input').forEach(el=>el.disabled=false);};
  button.onclick=()=>dialog.showModal();$('#bench-close').onclick=()=>{cancel();dialog.close();};dialog.addEventListener('close',cancel);
  $('#bench-run').onclick=async()=>{
    const run=++generation;$('#bench-run').disabled=true;$('#bench-save').disabled=true;dialog.querySelectorAll('select,input').forEach(el=>el.disabled=true);
    try{
      if($('#bench-model').value==='flyvis-000'){await runReference();return;}
      $('#bench-neurons').textContent='';$('#bench-legend').textContent='Green: normalized loom (0–1). Orange: GF stop events. Capture time: 0–1.2 s.';
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
    }catch(e){if(run===generation)$('#bench-status').textContent=e.message;}finally{if(run===generation){$('#bench-run').disabled=false;dialog.querySelectorAll('select,input').forEach(el=>el.disabled=false);}}
  };
  async function runReference(){
    // Reference run executes off the UI thread. No unvalidated body current is emitted.
    referenceWorker?.terminate();referenceWorker=new Worker(new URL('./flyvis.worker.js',import.meta.url),{type:'module'});
    const small=document.createElement('canvas');small.width=96;small.height=64;const context=small.getContext('2d');
    const trace=[];$('#bench-legend').textContent='Green: mean positive T4/T5 activity change (model units, auto-scaled). This reference has no promoted LPLC2/body bridge.';
    $('#bench-neurons').textContent='Intervention and GF gain controls apply to the compact pathway. This run records the intact Flyvis reference.';
    await new Promise((resolve,reject)=>{
      referenceReject=reject;
      referenceWorker.onmessage=({data})=>{
        if(data.type==='status')$('#bench-status').textContent=data.message;
        if(data.type==='error'){referenceReject=null;reject(Error(data.message));}
        if(data.type==='frame'){
          const pixels=$('#bench-pixels').getContext('2d'),retina=$('#bench-retina').getContext('2d'),graph=$('#bench-trace').getContext('2d');
          context.putImageData(new ImageData(new Uint8ClampedArray(data.packet.pixels),96,64),0,0);pixels.imageSmoothingEnabled=false;pixels.drawImage(small,0,0,384,256);
          retina.fillStyle='#101914';retina.fillRect(0,0,384,256);for(const c of RETINA){const [x,y]=projectReceptor(c,EYE_CALIBRATION),value=data.retina[c.index];retina.fillStyle=`rgb(${value*255} ${value*255} ${value*255})`;retina.beginPath();retina.arc(x*4,y*4,3.3,0,Math.PI*2);retina.fill();}
          const values=Object.values(data.result.populations);trace.push(values.reduce((a,b)=>a+b,0)/values.length);
          graph.fillStyle='#101914';graph.fillRect(0,0,768,130);graph.strokeStyle='#a5e39a';graph.lineWidth=2;graph.beginPath();const max=Math.max(.01,...trace);trace.forEach((v,i)=>{const x=i/30*768,y=115-v/max*100;i?graph.lineTo(x,y):graph.moveTo(x,y);});graph.stroke();
          $('#bench-neurons').textContent=Object.entries(data.result.populations).map(([t,v])=>`${t} ${v.toFixed(3)}`).join(' · ');
          $('#bench-status').textContent=`${data.packet.captureTime.toFixed(2)} s capture · full Flyvis · 500 Hz neural integration`;
        }
        if(data.type==='done'){referenceReject=null;report=data.report;window.duckflyVisionBench=report;$('#bench-save').disabled=false;$('#bench-status').textContent=`Completed · p95 ${report.loopTimingMs.p95.toFixed(1)} ms per 40 ms of input · body bridge pending`;resolve();}
      };
      referenceWorker.onerror=e=>reject(Error(e.message));referenceWorker.postMessage({type:'run',stimulus:$('#bench-stimulus').value});
    });
  }
  $('#bench-save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(report)],{type:'application/json'}));a.href=url;a.download='duckfly-retinal-response.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
