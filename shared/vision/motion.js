// Small motion-opponency baseline. These are image measurements, not Flyvis neurons.
// Lucas-Kanade normal flow preserves both ON and OFF edges. Four opposing sectors
// must agree on expansion; a flash or a translated object cannot supply that evidence.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class MotionOpponent {
  constructor(){this.reset();}
  reset(){this.previous=null;this.time=null;this.persistence=0;}
  step(pixels,time,calibration){
    const w=96,h=64,gray=new Float32Array(w*h);
    for(let i=0;i<gray.length;i++)gray[i]=(pixels[i*4]*.299+pixels[i*4+1]*.587+pixels[i*4+2]*.114)/255;
    const dt=this.time===null?0:time-this.time,flow={x:0,y:0,left:0,right:0,expansion:0,vectors:[]};
    const output={loom:0,on:0,off:0,flow,opponency:0,sectors:[0,0,0,0],valid:false};
    if(this.previous&&dt>0&&dt<=.25){
      const old=this.previous,vectors=[];
      for(let y=5;y<h-5;y+=4)for(let x=5;x<w-5;x+=4){
        let xx=0,xy=0,yy=0,xt=0,yt=0,energy=0,on=0,off=0;
        for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++){
          const i=(y+py)*w+x+px,gx=(old[i+1]-old[i-1])/2,gy=(old[i+w]-old[i-w])/2,t=gray[i]-old[i];
          xx+=gx*gx;xy+=gx*gy;yy+=gy*gy;xt+=gx*t;yt+=gy*t;energy+=t*t;on+=Math.max(0,t);off+=Math.max(0,-t);
        }
        if(xx+yy<.025||energy<.0001)continue;
        const regularizer=.01*(xx+yy),det=(xx+regularizer)*(yy+regularizer)-xy*xy;
        const dx=clamp((-xt*(yy+regularizer)+yt*xy)/det,-4,4),dy=clamp((-yt*(xx+regularizer)+xt*xy)/det,-4,4);
        if(!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<.02)continue;
        vectors.push({x,y,dx,dy,on:on/25,off:off/25});
      }
      // Fit expansion at a grid of receptive-field centers. This supports off-axis
      // approaches without treating a global translation as collision evidence.
      let best=0,bestSectors=[0,0,0,0];
      for(let cy=16;cy<=48;cy+=8)for(let cx=16;cx<=80;cx+=8){
        const outward=[0,0,0,0],inward=[0,0,0,0],counts=[0,0,0,0];
        for(const f of vectors){const rx=f.x-cx,ry=f.y-cy,r=Math.hypot(rx,ry);if(r<4||r>32)continue;
          const sector=Math.abs(rx)>Math.abs(ry)?(rx>0?0:1):(ry>0?2:3),radial=(rx*f.dx+ry*f.dy)/r/dt;
          outward[sector]+=Math.max(0,radial);inward[sector]+=Math.max(0,-radial);counts[sector]++;
        }
        const sectors=outward.map((v,i)=>counts[i]>=2?(v-1.5*inward[i])/counts[i]:0);
        const response=Math.max(0,Math.min(...sectors));if(response>best){best=response;bestSectors=sectors;}
      }
      this.persistence=best>1?this.persistence+dt:0;
      output.loom=this.persistence>=.04?clamp((best-1)/12,0,1):0;
      output.opponency=best;output.sectors=bestSectors;output.valid=true;
      flow.vectors=vectors;const n=Math.max(1,vectors.length),sideN=[0,0];
      for(const f of vectors){flow.x+=f.dx/w/dt/n;flow.y+=f.dy/h/dt/n;const side=f.x<w/2?0:1;flow[side?'right':'left']+=Math.hypot(f.dx/w,f.dy/h)/dt;sideN[side]++;output.on+=f.on/n;output.off+=f.off/n;}
      flow.left/=Math.max(1,sideN[0]);flow.right/=Math.max(1,sideN[1]);flow.expansion=best/w;
      flow.degreesPerSecond=flow.x*2*Math.atan(Math.tan(calibration.verticalFov*Math.PI/360)*calibration.aspect)*180/Math.PI;
    }else this.persistence=0;
    this.previous=gray;this.time=time;return output;
  }
  checkpoint(){return {previous:this.previous?Array.from(this.previous):null,time:this.time,persistence:this.persistence};}
  restore(s){if(s.previous&&(s.previous.length!==96*64||!s.previous.every(Number.isFinite)))throw Error('Invalid motion state');this.previous=s.previous?Float32Array.from(s.previous):null;this.time=s.time;this.persistence=s.persistence;}
}
