import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultScene, validateScene } from '../src/lab/scene.js';
import { cloneSetupScene, addSetupDuck, addSetupProp, addSetupField, removeSetupEntity, setSetupProfile, setSetupValue, setupWarnings } from '../src/lab/scene-setup-draft.js';

test('setup edits an isolated draft and preserves the preset research configuration',()=>{
  const original=defaultScene('stop-go'),before=structuredClone(original),draft=cloneSetupScene(original);
  draft.ducks[0].mapping={forward:'off',turn:'reverse'};
  setSetupValue(draft,'duck-1','mapping.forward','kick');
  setSetupValue(draft,'duck-1','adapter.flow',.19);
  addSetupField(draft,'odor');
  assert.deepEqual(original,before);
  const final=validateScene({...draft,version:6});
  assert.deepEqual(final.lab,before.lab);
  assert.equal(final.ducks[0].temporal,before.ducks[0].temporal);
  assert.equal(final.ducks[0].mapping.forward,'kick');
  assert.equal(final.ducks[0].adapter.flow,.19);
  assert.equal(final.fields.length,1);
});

test('added ducks have independent wiring, unique IDs, and bounded counts',()=>{
  const draft=cloneSetupScene(defaultScene('target'));
  draft.props[0].id='duck-2';
  const id=addSetupDuck(draft);
  assert.equal(id,'duck-3');
  setSetupValue(draft,id,'mapping.turn','reverse');
  assert.equal(draft.ducks[0].mapping.turn,'follow');
  assert.equal(draft.ducks[1].mapping.turn,'reverse');
  while(draft.ducks.length<8)addSetupDuck(draft);
  assert.throws(()=>addSetupDuck(draft),/up to 8/);
  assert.doesNotThrow(()=>validateScene(draft));
});

test('new entities clear actual rotated object footprints',()=>{
  const draft=cloneSetupScene(defaultScene('empty'));
  draft.ducks[0].spawn=[3,3,0];
  draft.props.push({id:'large-block',kind:'block',name:'Large block',position:[0,0,.1],size:[2,2,.2],yaw:Math.PI/4});
  Object.assign(draft,validateScene(draft));
  for(const id of [addSetupDuck(draft),addSetupProp(draft,'ball')]){
    const e=[...draft.ducks,...draft.props].find(p=>p.id===id),[x,y]=e.spawn??e.position,c=Math.cos(Math.PI/4),s=Math.sin(Math.PI/4);
    const separation=Math.hypot(Math.max(0,Math.abs(x*c+y*s)-1),Math.max(0,Math.abs(-x*s+y*c)-1));
    assert.ok(separation>.1,`${id} overlaps large rotated prop`);
  }
});

test('physics profiles stay exclusive and explicitly hand scripted objects to the user',()=>{
  const original=defaultScene('stop-go'),draft=cloneSetupScene(original);
  setSetupProfile(draft,'object','patrol');
  let prop=draft.props.find(p=>p.id==='object');
  assert.equal(prop.movable,false);assert.equal(prop.behavior.kind,'patrol');assert.deepEqual(prop.motion,[0,0,0]);
  assert.equal(draft.lab.scripted,false);
  assert.ok(setupWarnings(draft,original).some(w=>w.includes('replace the preset encounter')));
  setSetupProfile(draft,'object','slippery');
  prop=draft.props.find(p=>p.id==='object');
  assert.equal(prop.movable,true);assert.equal(prop.behavior,null);assert.equal(prop.friction,.05);
  assert.doesNotThrow(()=>validateScene(draft));
});

test('remove handles challenge subjects, last duck, fields, and prop limits',()=>{
  const draft=cloneSetupScene(defaultScene('target'));
  draft.challenge.subject=draft.props[0].id;
  removeSetupEntity(draft,draft.props[0].id);
  assert.equal(draft.challenge.subject,'ducks');
  assert.throws(()=>removeSetupEntity(draft,draft.ducks[0].id),/at least one/);
  const field1=addSetupField(draft,'odor'),field2=addSetupField(draft,'odor');
  assert.notDeepEqual(draft.fields[0].position,draft.fields[1].position);
  removeSetupEntity(draft,field1);assert.equal(draft.fields[0].id,field2);
  while(draft.props.length<40)addSetupProp(draft,'ball');
  assert.throws(()=>addSetupProp(draft,'wall'),/up to 40/);
  assert.doesNotThrow(()=>validateScene(draft));
});

test('setup rejects unsafe property paths instead of altering prototypes',()=>{
  const draft=cloneSetupScene(defaultScene('target'));
  assert.throws(()=>setSetupValue(draft,'duck-1','__proto__.bad',true),/Unknown/);
  assert.equal({}.bad,undefined);
});
