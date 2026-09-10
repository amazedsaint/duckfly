// Explicit axial-coordinate ordering. This is DuckFly's map, not FlyGym's index order.
// 721 hexagonal columns (radius 15). Angular spacing is an experimental calibration.
export const RETINA_MAP_ID='duckfly-hex-r15-v1';
export const RETINA=Object.freeze((()=>{const cells=[];for(let u=-15;u<=15;u++)for(let v=Math.max(-15,-u-15);v<=Math.min(15,-u+15);v++)cells.push(Object.freeze({index:cells.length,u,v,azimuth:2.3*(u+v/2),elevation:2.3*Math.sqrt(3)/2*v}));return cells;})());
const DEG=Math.PI/180;
export function projectReceptor(cell,calibration,width=96,height=64){
  const y=Math.tan(cell.elevation*DEG)/Math.tan(calibration.verticalFov*DEG/2),x=Math.tan(cell.azimuth*DEG)/(Math.tan(calibration.verticalFov*DEG/2)*calibration.aspect);
  return [(1+x)*(width-1)/2,(1-y)*(height-1)/2];
}
export function sampleRetina(pixels,calibration){
  return Float32Array.from(RETINA,cell=>{const [x,y]=projectReceptor(cell,calibration),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const gray=(px,py)=>{const j=(Math.max(0,Math.min(63,py))*96+Math.max(0,Math.min(95,px)))*4;return (pixels[j]*.299+pixels[j+1]*.587+pixels[j+2]*.114)/255;};
    return gray(ix,iy)*(1-fx)*(1-fy)+gray(ix+1,iy)*fx*(1-fy)+gray(ix,iy+1)*(1-fx)*fy+gray(ix+1,iy+1)*fx*fy;
  });
}
export function coordinatePermutation(coordinates){
  if(coordinates.length!==RETINA.length)throw Error('Retinal column count differs');
  const own=new Map(RETINA.map(c=>[`${c.u},${c.v}`,c.index])),indices=coordinates.map(([u,v])=>own.get(`${u},${v}`));
  if(indices.some(i=>i===undefined)||new Set(indices).size!==RETINA.length)throw Error('Retinal coordinates are not a bijection');
  return Uint16Array.from(indices);
}
