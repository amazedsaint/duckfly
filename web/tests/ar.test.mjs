import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {arSupport,horizontalHit,placementMatrix,scenePoint} from '../src/lab/ar-placement.js';
import {AR_OBJECTS,createARScene,addARObject} from '../src/lab/ar-scene.js';
import {validateScene,encodeScene,decodeScene,defaultScene} from '../src/lab/scene.js';

test('AR placement converts room coordinates back into the same physics plane at every display scale',()=>{
  for(const scale of [.25,.5,1,2])for(const angle of [0,Math.PI/4,Math.PI,-Math.PI/2]){
    const matrix=placementMatrix([2,.7,-3],scale,angle),point=new Vector3(.4,0,-.2).applyMatrix4(matrix);
    const local=scenePoint(point.toArray(),matrix);
    assert.ok(Math.abs(local[0]-.4)<1e-10&&Math.abs(local[1]-.2)<1e-10);
  }
  assert.throws(()=>scenePoint([0,1,0],placementMatrix([0,0,0])),/same surface/);
  assert.throws(()=>scenePoint([20,0,0],new Matrix4()),/closer/);
  assert.throws(()=>placementMatrix([0,0,0],0),/Invalid/);
  assert.throws(()=>scenePoint([0,0,0],new Matrix4().makeScale(0,0,0)),/Invalid/);
});
test('placement accepts horizontal tracked surfaces and rejects walls or malformed tracking data',()=>{
  assert.equal(horizontalHit(new Matrix4().toArray()),true);
  assert.equal(horizontalHit(new Matrix4().makeRotationX(Math.PI/2).toArray()),false);
  assert.equal(horizontalHit(new Matrix4().makeRotationX(.5).toArray()),false);
  assert.equal(horizontalHit([NaN]),false);
  assert.equal(horizontalHit(null),false);
});
test('capability checks are read-only and handle absent, denied and insecure XR',async()=>{
  let sessions=0,cameras=0;
  const environment={isSecureContext:true,navigator:{xr:{isSessionSupported:async mode=>mode==='immersive-ar',requestSession:()=>sessions++},mediaDevices:{getUserMedia:()=>cameras++}}};
  assert.equal((await arSupport(environment)).xr,true);assert.equal(sessions+cameras,0);
  assert.equal((await arSupport({...environment,isSecureContext:false})).camera,false);
  assert.equal((await arSupport({isSecureContext:true,navigator:{}})).xr,false);
  environment.navigator.xr.isSessionSupported=async()=>{throw Error('Denied');};
  const fallback=await arSupport(environment);assert.equal(fallback.xr,false);assert.equal(fallback.camera,true);
});
test('AR scenes retain portable connections and presentation without storing a room anchor or camera',()=>{
  const scene=createARScene();assert.equal(scene.version,10);assert.deepEqual(decodeScene(encodeScene(scene)),scene);
  assert.deepEqual(scene.presentation,{view:'ar'});assert.equal(defaultScene().version,2);
  assert.throws(()=>validateScene({...scene,presentation:{view:'room-scan'}}),/presentation/);
  assert.throws(()=>validateScene({...scene,presentation:[]}),/presentation/);
});
test('AR placement creates the existing simulated bodies and sensor sources with validated physics',()=>{
  const original=createARScene();
  for(const kind of AR_OBJECTS.map(([kind])=>kind)){
    const {scene,id}=addARObject(original,kind,[2,-1],'pushable');
    assert.deepEqual(scene.ducks[0],original.ducks[0]);assert.equal(scene.version,10);
    const entity=[...scene.ducks,...scene.props,...scene.fields].find(e=>e.id===id);
    assert.deepEqual((entity.spawn??entity.position).slice(0,2),[2,-1]);
    if(scene.props.includes(entity))assert.equal(entity.movable,true);
  }
  assert.equal(original.ducks.length,1);assert.equal(original.props.length,1);assert.equal(original.fields.length,0);
  assert.throws(()=>addARObject(original,'duck',[0,0]),/away/);
  assert.throws(()=>addARObject(original,'ball',[NaN,0]),/Invalid/);
  assert.throws(()=>addARObject(original,'script',[1,1]),/Invalid/);
  assert.equal(addARObject(original,'ball',[2,1],'fixed').scene.props.at(-1).movable,false,'An explicit fixed-body choice must be honored');
  const orbit=addARObject(original,'target',[2,1],'orbit').scene.props.at(-1);assert.equal(orbit.behavior.kind,'orbit');assert.equal(orbit.movable,false);
});
