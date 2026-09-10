const colors={dnp09:'#e8aa6a',dna01:'#7cc9b3',dna02:'#7cc9b3',lc4:'#b09edd',lplc2:'#b09edd',gf:'#f87968',other:'#6e9285'};
export class BrainPlot {
  constructor(canvas,circuit){this.canvas=canvas;this.circuit=circuit;this.flashes=new Float32Array(circuit.neurons.length);this.draw();}
  draw(fired=[]){
    for(let i=0;i<this.flashes.length;i++)this.flashes[i]*=.76;
    for(const i of fired)this.flashes[i]=1;
    const c=this.canvas,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr;c.height=h*dpr;}
    const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
    const points=this.circuit.neurons.map(n=>[w/2+n.pos[0]*w/15,h*.52-n.pos[1]*h/10+n.pos[2]*h/25]);
    x.strokeStyle='rgba(119,177,151,.035)';x.lineWidth=.6;x.beginPath();
    for(const e of this.circuit.edges){const a=points[e[0]],b=points[e[1]];x.moveTo(...a);x.lineTo(...b);}x.stroke();
    points.forEach((p,i)=>{const glow=this.flashes[i];x.globalAlpha=glow>.2?1:.4;x.fillStyle=colors[this.circuit.neurons[i].role]||'#789286';x.beginPath();x.arc(...p,glow>.2?2.4:1.2,0,Math.PI*2);x.fill();});x.globalAlpha=1;
  }
}
export function trace(canvas,samples){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);
  if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}
  const x=canvas.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  x.strokeStyle='#2c3933';x.lineWidth=1;
  for(let i=0;i<3;i++){x.beginPath();x.moveTo(0,8+i*(h-16)/2);x.lineTo(w,8+i*(h-16)/2);x.stroke();}
  for(const [key,color] of [['forward','#e8aa6a'],['left','#7cc9b3'],['right','#a79bd8']]){
    x.strokeStyle=color;x.lineWidth=1.6;x.beginPath();samples.forEach((s,i)=>{const px=w*(i+150-samples.length)/149,py=h-8-Math.min(220,s[key])/220*(h-16);if(i===0)x.moveTo(px,py);else x.lineTo(px,py);});x.stroke();
  }
}
