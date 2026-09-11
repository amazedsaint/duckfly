import test from 'node:test';
import assert from 'node:assert/strict';
import {propPosition,propProfile,profileFor} from '../src/lab/prop-behavior.js';
import {defaultScene,validateScene,encodeScene,decodeScene} from '../src/lab/scene.js';
import {currentPropProfile} from '../src/lab/prop-controls.js';

test('patrol and orbit start without a jump and stay bounded over an open run',()=>{
  for(const kind of ['patrol','orbit']){
    const p={position:[.8,.1,.15],...propProfile(kind,{speed:.2,range:.4,time:123})};
    assert.deepEqual(propPosition(p,123),p.position);
    for(let t=123;t<1123;t+=.23){const q=propPosition(p,t);assert.equal(q[2],.15);
      if(kind==='patrol'){assert.equal(q[0],.8);assert.ok(Math.abs(q[1]-.1)<=.4+1e-12);}
      else assert.ok(Math.abs(Math.hypot(q[0]-.4,q[1]-.1)-.4)<1e-12);
    }
    assert.deepEqual(propPosition(JSON.parse(JSON.stringify(p)),128),propPosition(p,128));
  }
});
test('physical and scripted profiles are exclusive; invalid motion cannot enter a scene',()=>{
  for(const kind of ['fixed','pushable','heavy','slippery','patrol','orbit']){
    const s=defaultScene(),p={...s.props[0],...propProfile(kind)};s.props[0]=p;
    const scene=validateScene(s);assert.equal(profileFor(p),kind);
    assert.deepEqual(decodeScene(encodeScene(scene)),scene);
  }
  const s=defaultScene();Object.assign(s.props[0],propProfile('orbit'),{movable:true});
  assert.throws(()=>validateScene(s),/both freely moving and animated/);
  s.props[0].movable=false;s.props[0].behavior.range=0;assert.throws(()=>validateScene(s));
});

test('live physics controls preserve the real kick ball values instead of selecting a replacement preset',()=>{
  const ball=defaultScene('kick').props.find(p=>p.id==='kick-ball'),before=structuredClone(ball);
  assert.equal(ball.mass,.025);assert.equal(ball.friction,.6);
  assert.equal(currentPropProfile(ball),'existing-physics');
  assert.deepEqual(ball,before);
  for(const profile of ['pushable','heavy','slippery'])assert.equal(currentPropProfile({...ball,...propProfile(profile)}),profile);
  assert.equal(currentPropProfile({...ball,...propProfile('heavy'),friction:.6}),'existing-physics');
  assert.equal(currentPropProfile({...ball,...propProfile('slippery'),mass:.025}),'existing-physics');
  assert.equal(currentPropProfile({...ball,...propProfile('patrol')}),'patrol');
});
