import { projectReceptor } from '../../../shared/vision/retina.js';
import { EYE_CALIBRATION } from '../../../shared/vision/frame.js';

const TYPES=['T4a','T4b','T4c','T4d','T5a','T5b','T5c','T5d'];
const format=value=>Number(value).toFixed(4);

// A view of measured model output. No population name is assigned a motor role.
export class SpatialResponseView {
  constructor(root,onSelectFrame=()=>{}){
    this.root=root;this.onSelectFrame=onSelectFrame;
    root.innerHTML=`<details class="spatial-inspector" open>
      <summary>Where the visual model responds <span>8 populations · 721 locations each</span></summary>
      <p class="hint">Coral means activity rose from baseline; blue means it fell. These are continuous model units, not spikes. Every map uses the same color scale.</p>
      <div class="spatial-playback"><label>Recorded frame <input id="spatial-frame" type="range" min="0" max="0" value="0" step="1" disabled></label><output id="spatial-time">Waiting for a response</output><label class="spatial-follow"><input id="spatial-follow" type="checkbox" checked> Follow live</label></div>
      <div class="spatial-maps">${TYPES.map(type=>`<figure data-population="${type}"><figcaption>${type}</figcaption><canvas width="240" height="160" aria-label="${type} signed activity change at retinal locations"></canvas></figure>`).join('')}</div>
      <div class="spatial-scale" id="spatial-scale">Color scale pending</div>
      <details class="spatial-cell"><summary>Inspect a cell</summary><div class="pair"><label>Population<select id="spatial-population">${TYPES.map(type=>`<option>${type}</option>`).join('')}</select></label><label>Retinal location<input id="spatial-cell" type="number" min="0" max="720" value="360" step="1"></label></div><output id="spatial-values">Choose a map location to see its signed response.</output></details>
      <p id="spatial-provenance" class="hint"></p>
    </details>`;
    this.$=id=>root.querySelector('#'+id);
    this.$('spatial-frame').oninput=()=>{this.$('spatial-follow').checked=false;this.select(Number(this.$('spatial-frame').value));};
    this.$('spatial-follow').onchange=()=>{if(this.$('spatial-follow').checked)this.select(this.frames.length-1);};
    this.$('spatial-population').onchange=()=>this.render();
    this.$('spatial-cell').oninput=()=>this.render();
    for(const figure of root.querySelectorAll('figure'))figure.querySelector('canvas').onclick=event=>{
      const type=figure.dataset.population,coordinates=this.metadata?.populations?.[type]?.coordinates;if(!coordinates)return;
      const canvas=event.currentTarget,rect=canvas.getBoundingClientRect(),point=[(event.clientX-rect.left)/rect.width*96,(event.clientY-rect.top)/rect.height*64];
      let selected=0,distance=Infinity;
      coordinates.forEach((cell,index)=>{const p=projectReceptor(cell,EYE_CALIBRATION),d=Math.hypot(p[0]-point[0],p[1]-point[1]);if(d<distance){distance=d;selected=index;}});
      this.$('spatial-population').value=type;this.$('spatial-cell').value=selected;
      root.querySelector('.spatial-cell').open=true;this.render();
    };
    this.reset();
  }
  reset(){
    this.metadata=null;this.baseline=null;this.frames=[];this.index=-1;this.scale=0;
    this.root.hidden=true;this.$('spatial-frame').disabled=true;this.$('spatial-frame').max='0';this.$('spatial-frame').value='0';this.$('spatial-follow').checked=true;
  }
  reference(metadata,baseline){
    this.metadata=metadata;this.baseline=baseline;this.root.hidden=false;
    this.$('spatial-provenance').textContent='Flyvis reference · experimental eye-relative angular map · baseline after a 1 s fade-in · not connected to the duck';
  }
  append(frame){
    this.frames.push(frame);
    for(const type of TYPES)for(const value of frame.populations[type].delta)this.scale=Math.max(this.scale,Math.abs(value));
    this.$('spatial-frame').disabled=false;this.$('spatial-frame').max=String(this.frames.length-1);
    if(this.$('spatial-follow').checked)this.select(this.frames.length-1);else this.render();
  }
  select(index){
    if(!this.frames.length)return;
    this.index=Math.max(0,Math.min(this.frames.length-1,index));this.$('spatial-frame').value=String(this.index);
    this.render();this.onSelectFrame(this.index);
  }
  render(){
    const frame=this.frames[this.index];if(!frame||!this.metadata)return;
    const scale=Math.max(this.scale,1e-8),selectedType=this.$('spatial-population').value;
    const selectedIndex=Math.max(0,Math.min(720,Math.round(Number(this.$('spatial-cell').value)||0)));
    for(const figure of this.root.querySelectorAll('figure')){
      const type=figure.dataset.population,canvas=figure.querySelector('canvas'),c=canvas.getContext('2d');
      const coordinates=this.metadata.populations[type].coordinates,delta=frame.populations[type].delta;
      c.fillStyle='#182b30';c.fillRect(0,0,240,160);
      for(let index=0;index<coordinates.length;index++){
        const [x,y]=projectReceptor(coordinates[index],EYE_CALIBRATION),value=delta[index],amount=Math.min(1,Math.abs(value)/scale);
        const base=[25,47,52],color=value>=0?[255,117,88]:[92,191,249];
        c.fillStyle=`rgb(${base.map((channel,i)=>Math.round(channel+(color[i]-channel)*amount)).join(' ')})`;
        c.beginPath();c.arc(x*2.5,y*2.5,2.1,0,Math.PI*2);c.fill();
      }
      if(type===selectedType){const [x,y]=projectReceptor(coordinates[selectedIndex],EYE_CALIBRATION);c.strokeStyle='#ffe63e';c.lineWidth=1.5;c.beginPath();c.arc(x*2.5,y*2.5,4,0,Math.PI*2);c.stroke();}
      figure.classList.toggle('selected',type===selectedType);
    }
    const timing=frame.timing??frame;
    this.$('spatial-time').textContent=`${Number(timing.captureTime).toFixed(2)} s input · frame ${this.index+1}/${this.frames.length}`;
    this.$('spatial-scale').textContent=`−${format(scale)} ← below baseline · above baseline → +${format(scale)} · shared run scale`;
    const population=frame.populations[selectedType],cell=this.metadata.populations[selectedType].coordinates[selectedIndex];
    const baseline=this.baseline.populations[selectedType][selectedIndex];
    this.$('spatial-values').textContent=`${selectedType} location ${selectedIndex} · axial (${cell.u}, ${cell.v}) · ${cell.azimuth.toFixed(1)}° azimuth, ${cell.elevation.toFixed(1)}° elevation. Raw ${format(population.raw[selectedIndex])} · baseline ${format(baseline)} · change ${format(population.delta[selectedIndex])}.`;
  }
}
