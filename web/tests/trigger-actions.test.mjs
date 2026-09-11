import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Brain} from '../src/brain.js';
import {TRIGGERS,ACTIONS,TriggerActions,newConnection,normalizeConnections} from '../src/lab/trigger-actions.js';
import {defaultScene,validateScene,encodeScene,decodeScene} from '../src/lab/scene.js';
const context=(patch={})=>({time:1,duck:{motorEnabled:true,motorGain:1,silence:'none'},body:{fallen:false},
  input:{fresh:true,gate:false,loomL:.5,loomR:.3},neural:{forward:20,left:25,right:2,backward:15,loom:12,gfHeld:false,yaw:.4},
  vision:{target:{visible:true,bearing:.4},brightness:[.8,.8]},...patch});
const config=(pairs)=>({enabled:true,rules:pairs.map(([trigger,action],i)=>newConnection(trigger,action,'r'+i))});

test('the public trigger/action matrix is portable and never requests unsupported joint movement',()=>{
  for(const trigger of TRIGGERS)for(const action of ACTIONS){
    const connections=config([[trigger.id,action.id]]),scene=defaultScene('empty');
    scene.ducks[0].connections=connections;
    const normalized=validateScene(scene);
    assert.equal(normalized.version,7);assert.deepEqual(decodeScene(encodeScene(normalized)),normalized);
    assert.deepEqual(normalizeConnections(connections),connections);
    const result=new TriggerActions().step(connections,context());
    assert.ok(result.command.vx>=0&&result.command.vx<=.3);
    assert.ok(Math.abs(result.command.yaw)<=.65);
    assert.ok(Math.abs(result.command.head[2])<=.35);
    assert.equal(result.signals[0].source,trigger.source);
  }
  assert.throws(()=>normalizeConnections({...config([['forward','walk']]),rules:[{...newConnection(),action:'fly'}]}),/Invalid/);
  assert.throws(()=>normalizeConnections({enabled:true,rules:[{...newConnection(),trigger:'missing'}]}),/Invalid/);
});

test('conflicting connections cancel turns, and pause/GF/stale/disconnected states win',()=>{
  const engine=new TriggerActions(),rules=config([['forward','walk'],['forward','left'],['forward','right']]);
  assert.equal(engine.step(rules,context()).command.yaw,0);
  rules.rules.push(newConnection('seen','stop','pause'));
  const paused=engine.step(rules,context());assert.equal(paused.command.vx,0);assert.equal(paused.paused,true);
  for(const patch of [{neural:{...context().neural,gfHeld:true}},{input:{...context().input,fresh:false}},{duck:{...context().duck,motorEnabled:false}},{duck:{...context().duck,silence:'output'}}]){
    const result=new TriggerActions().step(config([['forward','walk'],['forward','kick']]),context(patch));
    assert.deepEqual([result.command.vx,result.command.yaw],[0,0]);assert.equal(result.skill,null);assert.ok(result.gate);
  }
});

test('holds and once-per-activation skill requests restore exactly and edits discard previous hold state',()=>{
  const engine=new TriggerActions(),rules=config([['forward','kick']]);rules.rules[0].hold=.5;
  assert.equal(engine.step(rules,context()).skill.kind,'kick');
  assert.equal(engine.step(rules,context({time:1.1})).skill,null);
  const checkpoint=JSON.parse(JSON.stringify(engine.checkpoint())),low=context({time:1.3,neural:{...context().neural,forward:0}});
  const expected=engine.step(rules,low);engine.restore(checkpoint);assert.deepEqual(engine.step(rules,low),expected);
  assert.equal(expected.signals[0].active,true);
  engine.step(rules,context({time:2,neural:{...context().neural,forward:0}}));
  assert.equal(engine.step(rules,context({time:2.1})).skill.kind,'kick');
  rules.rules[0].action='walk';assert.equal(engine.step(rules,low).signals[0].active,false);
});

test('new scene tiles contain distinct runnable mappings and retain independent duck configuration',()=>{
  for(const id of ['cue-workshop','lookout','crossed-wires','trigger-kick']){
    const scene=defaultScene(id);assert.equal(scene.version,7);assert.ok(scene.ducks[0].connections.enabled);
    assert.deepEqual(validateScene(scene),scene);
  }
  const pair=defaultScene('crossed-wires');
  assert.equal(pair.ducks[0].connections.rules[0].action,'left');
  assert.equal(pair.ducks[1].connections.rules[0].action,'right');
});

test('the MDN trigger reads a real circuit response to its population stimulus',()=>{
  const circuit=JSON.parse(fs.readFileSync(new URL('../../shared/assets/Brain/circuit.json',import.meta.url)));
  const stimulated=new Brain(circuit,'mdn-trigger-check'),control=new Brain(circuit,'mdn-trigger-check');
  assert.ok(stimulated.sim.mdn.length>0);
  stimulated.stimulate('backward');let active,baseline;
  for(let i=0;i<20;i++){active=stimulated.step(null,{});baseline=control.step(null,{});}
  assert.ok(active.backward>baseline.backward+6,'The selected MDN population must respond above the matched unstimulated circuit');
  const result=new TriggerActions().step(config([['mdn','look-left']]),context({neural:active}));
  assert.ok(result.signals[0].active);assert.equal(result.signals[0].value,active.backward);
  assert.equal(result.command.head[2],.35);assert.equal(result.command.vx,0);
});
