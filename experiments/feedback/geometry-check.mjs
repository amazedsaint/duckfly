import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EYE_CALIBRATION } from '../../shared/vision/frame.js';
import { multiply,conjugate,warpPrevious } from './rotation-motion.js';
import { opticalHeading } from './candidates.js';
const yaw=a=>[Math.cos(a/2),0,Math.sin(a/2),0];
const render=q=>Float32Array.from({length:96*64},(_,i)=>{
 const f=32/Math.tan(75*Math.PI/360),v=[0,(i%96+.5-48)/f,-(Math.floor(i/96)+.5-32)/f,-1],r=multiply(multiply(q,v),conjugate(q));
 return .5+.2*Math.sin(9*r[1]/-r[3])+.2*Math.cos(8*r[2]/-r[3]);
});
const previous=render(yaw(0)),current=render(yaw(.08));
const corrected=warpPrevious(previous,current,yaw(.08),EYE_CALIBRATION).pixels;
const inverted=warpPrevious(previous,current,yaw(-.08),EYE_CALIBRATION).pixels;
const error=arr=>{let n=0,s=0;for(let y=8;y<56;y++)for(let x=8;x<88;x++){s+=Math.abs(arr[y*96+x]-current[y*96+x]);n++;}return s/n;};
const result={correctedError:error(corrected),rawError:error(previous),invertedError:error(inverted)};
assert.ok(result.correctedError<result.rawError*.05);assert.ok(result.invertedError>result.rawError);
// MuJoCo camera forward is local -Z. A +90-degree rotation around local Y looks toward world -X.
assert.ok(Math.abs(Math.abs(opticalHeading([0,0,0,...yaw(Math.PI/2)]))-Math.PI)<1e-8);
fs.writeFileSync(new URL('./reports/geometry-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
