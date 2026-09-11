import {Matrix4,Vector3,Quaternion} from 'three';

export function horizontalHit(matrix) {
  if(!matrix||matrix.length!==16||!Array.from(matrix).every(Number.isFinite))return false;
  return matrix[5]>.94&&Math.abs(matrix[3])+Math.abs(matrix[7])+Math.abs(matrix[11])<1e-4&&Math.abs(matrix[15]-1)<1e-4;
}
export function placementMatrix(position,scale=1,heading=0) {
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Number.isFinite(scale)||scale<.25||scale>2||!Number.isFinite(heading))throw Error('Invalid AR placement');
  return new Matrix4().compose(new Vector3(...position),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),heading),new Vector3(scale,scale,scale));
}
export function scenePoint(worldPoint,matrix) {
  if(!worldPoint||worldPoint.length!==3||!Array.from(worldPoint).every(Number.isFinite)||!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-8)throw Error('Invalid placement point');
  const p=new Vector3(...worldPoint).applyMatrix4(matrix.clone().invert());
  if(Math.abs(p.x)>10||Math.abs(p.z)>10)throw Error('Place the object closer to the scene.');
  if(Math.abs(p.y)>.15)throw Error('Choose a point on the same surface as the scene.');
  return [p.x,-p.z];
}
export async function arSupport(environment=globalThis) {
  if(!environment.isSecureContext)return {xr:false,camera:false,reason:'Open the HTTPS version of DuckFly to use AR or the camera.'};
  let xr=false;
  try{xr=!!await environment.navigator?.xr?.isSessionSupported('immersive-ar');}catch{/* A denied capability probe must not block the studio. */}
  return {xr,camera:!!environment.navigator?.mediaDevices?.getUserMedia,reason:xr?'Surface tracking is available. Point your phone at a clear floor or table.':'This browser does not offer room tracking. Camera preview places the simulation over video, without anchoring it to the room.'};
}
