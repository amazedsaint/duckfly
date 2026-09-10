// Research only. Rotate the previous image into the current camera orientation.
// This removes rotational image motion; translation and object motion remain.
import { MotionOpponent } from '../../shared/vision/motion.js';
export const multiply=(a,b)=>[
 a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
 a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
 a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
 a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
export const conjugate=q=>[q[0],-q[1],-q[2],-q[3]];
export function warpPrevious(old,current,relative,calibration){
 const [w,x,y,z]=relative,f=32/Math.tan(calibration.verticalFov*Math.PI/360);
 const r=[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y),2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x),2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)];
 const warped=new Float32Array(old.length);let overlap=0;
 for(let py=0;py<64;py++)for(let px=0;px<96;px++){
  const rx=(px+.5-48)/f,ry=-(py+.5-32)/f;
  const X=r[0]*rx+r[1]*ry-r[2],Y=r[3]*rx+r[4]*ry-r[5],Z=r[6]*rx+r[7]*ry-r[8];
  const ox=f*X/-Z+47.5,oy=-f*Y/-Z+31.5,i=py*96+px;
  if(Z>=0||ox<0||ox>=95||oy<0||oy>=63){warped[i]=current[i];continue;}
  const ix=Math.floor(ox),iy=Math.floor(oy),dx=ox-ix,dy=oy-iy,j=iy*96+ix;
  warped[i]=(old[j]*(1-dx)+old[j+1]*dx)*(1-dy)+(old[j+96]*(1-dx)+old[j+97]*dx)*dy;overlap++;
 }
 return {pixels:warped,overlap:overlap/old.length};
}
export class RotationMotion extends MotionOpponent{
 constructor(direction=1){super();this.direction=direction;this.pose=null;}
 step(pixels,time,calibration,pose){
  const q=pose?.slice(3);let overlap=null;
  if(this.previous&&q&&this.pose){
   let relative=multiply(conjugate(this.pose),q);if(this.direction<0)relative=conjugate(relative);
   const gray=Float32Array.from({length:96*64},(_,i)=>(pixels[i*4]*.299+pixels[i*4+1]*.587+pixels[i*4+2]*.114)/255);
   const result=warpPrevious(this.previous,gray,relative,calibration);overlap=result.overlap;
   if(overlap<.6){this.previous=null;this.persistence=0;}else this.previous=result.pixels;
  }else if(this.previous){this.previous=null;this.persistence=0;}
  const output=super.step(pixels,time,calibration);this.pose=q;return {...output,rotationOverlap:overlap};
 }
}
