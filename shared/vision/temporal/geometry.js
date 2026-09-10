export const multiply=(a,b)=>[
 a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
 a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
 a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
 a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
export const conjugate=q=>[q[0],-q[1],-q[2],-q[3]];
export function opticalHeading(pose){
  if(!pose||pose.length!==7)return null;
  const [w,x,y,z]=pose.slice(3);
  const forward=[-2*(x*z+w*y),-2*(y*z-w*x)];
  return Math.hypot(...forward)>1e-6?Math.atan2(forward[1],forward[0]):null;
}
