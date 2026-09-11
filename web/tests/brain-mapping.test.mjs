import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import {defaultScene,validateScene,encodeScene,decodeScene} from '../src/lab/scene.js';
import {normalizeBrainMapping,patchBrainMapping,brainMappingEnabled,brainMappingSummary,mapBrainCommand,automaticKickEnabled} from '../src/lab/brain-mapping.js';
import {newConnection} from '../src/lab/trigger-actions.js';
import {Experiment} from '../src/lab/experiment.js';
import {mountTemplate} from '../src/lab/lab-world.js';
import {TemporalDecoder} from '../../shared/vision/temporal/decoder.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url));

test('canonical wiring is bounded and idempotent while legacy scenes keep their schemas',()=>{
  for(const preset of ['empty','target','kick']){
    const legacy=defaultScene(preset);
    assert.equal(Object.hasOwn(legacy.ducks[0],'mapping'),false);
    assert.deepEqual(validateScene(legacy),legacy);
    assert.deepEqual(decodeScene(encodeScene(legacy)),legacy);
    assert.deepEqual(normalizeBrainMapping(legacy.ducks[0]),{forward:preset==='kick'?'kick':'walk',turn:'follow'});
  }
  const scene=defaultScene('flock');
  scene.ducks[0].mapping={forward:'off',turn:'reverse'};
  scene.ducks[0].kickOnSight=true;
  const canonical=validateScene(scene);
  assert.equal(canonical.version,6);
  assert.equal(canonical.ducks[0].kickOnSight,false,'Canonical wiring has one authority');
  assert.deepEqual(canonical.ducks[1].mapping,{forward:'walk',turn:'follow'});
  assert.deepEqual(validateScene(canonical),canonical);
  assert.deepEqual(decodeScene(encodeScene(canonical)),canonical);
  const toggled=patchBrainMapping(canonical.ducks[0],{kickOnSight:true,feedback:false});
  assert.deepEqual(toggled.mapping,{forward:'kick',turn:'reverse'});
  assert.equal(toggled.feedback,false);assert.equal(toggled.kickOnSight,true);
  assert.equal(patchBrainMapping(toggled,{kickOnSight:false}).mapping.forward,'walk');
  assert.equal(patchBrainMapping(toggled,{kickOnSight:true,mapping:{forward:'off',turn:'off'}}).kickOnSight,false);
  for(const mapping of [{forward:'fly',turn:'follow'},{forward:'walk',turn:'jump'},'walk',[]]){
    assert.throws(()=>validateScene({...scene,ducks:[{...scene.ducks[0],mapping}]}),/mapping|operation/);
  }
});

test('mapping reroutes existing intent without generating commands past a gate',()=>{
  const duck={mode:'brain',mapping:{forward:'off',turn:'reverse'}},command={vx:.3,yaw:.4,head:[0,0,.2,0]},provenance={};
  assert.deepEqual(mapBrainCommand(command,duck,provenance),{...command,vx:0,yaw:-.4});
  assert.equal(command.vx,.3,'Routing cannot modify neural intent');
  assert.equal(provenance.forward,'Forward connection off');
  assert.deepEqual(mapBrainCommand({...command,vx:0,yaw:0},duck),{...command,vx:0,yaw:0});
  for(const mode of ['manual','reactive','reflex']){
    const bypass={...duck,mode,mapping:{forward:'kick',turn:'off'}};
    assert.equal(brainMappingEnabled(bypass),false);
    assert.match(brainMappingSummary(bypass),/bypass/);
    assert.equal(mapBrainCommand(command,bypass),command);
    assert.equal(automaticKickEnabled(bypass,6),false);
    assert.equal(automaticKickEnabled(bypass,5),true,'Old recordings retain their skill selection');
  }
});

test('actual brain, policy and physics respect per-duck wiring and safety, including replay',async t=>{
  ort.env.wasm.numThreads=1;
  const mj=await loadMujoco(),template=JSON.parse(gunzipSync(read('../../shared/assets/Simulation/lab-template.json.gz')));
  mountTemplate(mj,template);
  const session=await ort.InferenceSession.create(new Uint8Array(read('../../shared/assets/Policies/alpha_walking.onnx')),{executionProviders:['wasm']});
  const kickSession=await ort.InferenceSession.create(new Uint8Array(read('../../shared/assets/Policies/ball_kick_left.onnx')),{executionProviders:['wasm']});
  const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
  const runtime={mj,template,session,Tensor:ort.Tensor,circuit,skillSessions:{kick:kickSession}};
  const blank=new Uint8Array(96*64*4).fill(100),pink=blank.slice();
  for(let y=20;y<38;y++)for(let x=30;x<48;x++)pink.set([240,40,130,255],(y*96+x)*4);
  const physical=value=>JSON.parse(JSON.stringify(value,(key,value)=>key==='cost'?undefined:value));
  try{
    await t.test('adding a response preserves the existing physical behavior, head tracking and recorded causes',async()=>{
      const scene=validateScene({...defaultScene('target'),version:6});scene.ducks[0].activeLook=true;
      const added=structuredClone(scene);
      added.ducks[0].connections={enabled:true,includeBrainMapping:true,rules:[{...newConnection('bright','look-left'),threshold:.99}]};
      const original=new Experiment(runtime,scene),edited=new Experiment(runtime,added),frames={'duck-1':pink};
      try{
        for(let i=0;i<100;i++){
          const a=await original.step(frames),b=await edited.step(frames);
          assert.deepEqual(physical(b.body),physical(a.body),'An inactive added response changed the body');
          assert.deepEqual(b.event.causes[0].provenance,a.event.causes[0].provenance,'An inactive response claimed the existing action');
        }
        const rule={...newConnection('seen','look-left')};
        edited.updateDuck('duck-1',{connections:{enabled:true,includeBrainMapping:true,rules:[rule]}});
        let walking=0;
        for(let i=0;i<40;i++){
          const state=await edited.step(frames),cause=state.event.causes[0];
          if(cause.neural.vx>0){walking++;assert.equal(cause.command.vx,cause.neural.vx);}
          assert.equal(cause.command.head[2],.35,'The new head response was not delivered');
        }
        assert.ok(walking>10,'Adding a head response stopped the walker');
        const recording=JSON.parse(JSON.stringify(edited.export()));
        for(let i=0;i<8;i++)await edited.step(frames);const expected=edited.checkpoint();
        edited.import(recording);for(let i=0;i<8;i++)await edited.step(frames);
        assert.deepEqual(edited.checkpoint(),expected,'Additive connections did not replay exactly');
        edited.updateDuck('duck-1',{connections:{enabled:true,includeBrainMapping:true,rules:[{...rule,action:'stop'}]}});
        assert.deepEqual((await edited.step(frames)).body.ducks[0].command,[0,0]);
        edited.updateDuck('duck-1',{connections:{enabled:true,includeBrainMapping:true,rules:[{...rule,enabled:false}]}});
        const resumed=await edited.step(frames);
        assert.equal(resumed.event.causes[0].command.vx,resumed.event.causes[0].neural.vx);
      }finally{original.dispose();edited.dispose();}
    });
    await t.test('adding an inactive head response preserves the scene visual kick and its rearming',async()=>{
      const scene=validateScene({...defaultScene('kick'),version:6});
      const added=structuredClone(scene);added.ducks[0].connections={enabled:true,includeBrainMapping:true,rules:[{...newConnection('bright','look-left'),threshold:.99}]};
      const original=new Experiment(runtime,scene),edited=new Experiment(runtime,added),frames={'duck-1':pink};let kicks=0;
      try{
        for(let i=0;i<160;i++){
          const a=await original.step(frames),b=await edited.step(frames);
          assert.deepEqual(physical(b.body),physical(a.body));
          assert.deepEqual(b.agents['duck-1'].skill,a.agents['duck-1'].skill);
          kicks+=b.event.causes[0].command.policy==='kick';
        }
        assert.equal(kicks,25,'The visual kick must still execute exactly once');
      }finally{original.dispose();edited.dispose();}
    });
    await t.test('a neuron can request a different action, with physical movement, per-duck isolation and exact replay',async()=>{
      const scene=defaultScene('empty');
      scene.ducks[0].connections={enabled:true,rules:[newConnection('forward','left')]};
      scene.ducks.push({...scene.ducks[0],id:'duck-2',name:'Walker',spawn:[0,1,0],connections:{enabled:true,rules:[newConnection('forward','walk')]}});
      const e=new Experiment(runtime,scene),frames={'duck-1':blank,'duck-2':blank};
      try{
        e.stimulus('duck-1','walk');e.stimulus('duck-2','walk');let triggered=0;
        for(let i=0;i<150;i++){
          const state=await e.step(frames);
          if(state.agents['duck-1'].neural.forward>=6){
            triggered++;assert.equal(state.body.ducks[0].command[0],.3);assert.equal(state.body.ducks[0].command[1],.65);
            assert.equal(state.body.ducks[1].command[0],.3);
            assert.equal(state.event.causes[0].connections.signals[0].source,'Fly circuit');
          }
        }
        assert.ok(triggered>30);assert.ok(Math.abs(e.state().body.ducks[0].heading)>.15,JSON.stringify(e.state().body.ducks.map(d=>({heading:d.heading,distance:d.distance,fallen:d.fallen}))));
        assert.ok(e.state().body.ducks[1].distance>.1);
        const recording=JSON.parse(JSON.stringify(e.export()));for(let i=0;i<8;i++)await e.step(frames);const expected=e.checkpoint();
        e.import(recording);for(let i=0;i<8;i++)await e.step(frames);assert.deepEqual(e.checkpoint(),expected);
        e.updateDuck('duck-1',{silence:'forward'});for(let i=0;i<100;i++)await e.step(frames);
        assert.equal(e.state().body.ducks[0].command[1],0,'Silencing the actual source must remove its mapped action');
        e.updateDuck('duck-2',{motorEnabled:false});assert.deepEqual((await e.step(frames)).body.ducks[1].command,[0,0]);
      }finally{e.dispose();}
    });
    await t.test('a custom neural skill connection executes the actual kick policy once per activation',async()=>{
      const e=new Experiment(runtime,defaultScene('trigger-kick')),frames={'duck-1':pink};let kicks=0;
      try{
        for(let i=0;i<160;i++){
          const state=await e.step(frames);
          if(state.event.causes[0].command.policy==='kick'){kicks++;assert.equal(e.world.robots[0].session,kickSession);}
        }
        assert.equal(kicks,25);assert.equal(e.state().body.ducks[0].fallen,false);
        assert.equal(e.agents.get('duck-1').skills.source,'connection');
      }finally{e.dispose();}
    });
    await t.test('one duck can turn in reverse while another walks; mapped recordings replay exactly',async()=>{
      const scene=defaultScene('empty');
      scene.ducks[0].mapping={forward:'off',turn:'reverse'};
      scene.ducks.push({...scene.ducks[0],id:'duck-2',name:'Duck 2',spawn:[0,1,0],mapping:{forward:'walk',turn:'follow'}});
      const e=new Experiment(runtime,scene),frames={'duck-1':blank,'duck-2':blank};
      try{
        for(const id of ['duck-1','duck-2']){e.stimulus(id,'walk');e.stimulus(id,'left');}
        let walking=0,turning=0;
        for(let tick=0;tick<100;tick++){
          const state=await e.step(frames);
          for(const cause of state.event.causes){
            const body=state.body.ducks.find(d=>d.id===cause.id);
            assert.equal(body.command[0],cause.id==='duck-1'?0:cause.neural.vx);
            assert.equal(body.command[1],cause.id==='duck-1'?-cause.neural.yaw:cause.neural.yaw);
            assert.equal(body.fallen,false);
          }
          walking+=state.body.ducks[1].command[0]>.1;
          turning+=Math.abs(state.body.ducks[0].command[1])>.1;
        }
        assert.ok(walking>50&&turning>25,'Stimulated neural activity must reach both body paths');
        const state=e.state();
        assert.ok(state.body.ducks[1].distance>state.body.ducks[0].distance+.1,'Walking connection must produce physical travel');
        const recording=JSON.parse(JSON.stringify(e.export()));
        for(let i=0;i<8;i++)await e.step(frames);const expected=e.checkpoint();
        e.import(recording);for(let i=0;i<8;i++)await e.step(frames);
        assert.deepEqual(e.checkpoint(),expected);
      }finally{e.dispose();}
    });
    await t.test('edited wiring respects missing vision, GF stops and body disconnection',async()=>{
      const scene=defaultScene();scene.ducks[0].mapping={forward:'walk',turn:'reverse'};
      const e=new Experiment(runtime,scene);
      try{
        e.stimulus('duck-1','walk');e.stimulus('duck-1','left');
        for(let i=0;i<30;i++)await e.step({'duck-1':pink});
        let state=await e.step({'duck-1':blank});
        assert.equal(state.agents['duck-1'].neural.vx,.3);
        assert.equal(state.body.ducks[0].command[0],0,'Lost cue must still block a mapped walking request');
        e.updateDuck('duck-1',{motorEnabled:false});
        state=await e.step({'duck-1':pink});assert.deepEqual(state.body.ducks[0].command,[0,0]);
        e.updateDuck('duck-1',{motorEnabled:true,motorGain:.5});
        state=await e.step({'duck-1':pink});
        assert.equal(state.body.ducks[0].command[0],.15);
        assert.equal(state.body.ducks[0].command[1],-state.agents['duck-1'].neural.yaw*.5);
        e.updateDuck('duck-1',{silence:'output'});
        state=await e.step({'duck-1':pink});assert.deepEqual(state.body.ducks[0].command,[0,0]);
        e.updateDuck('duck-1',{silence:'none',motorGain:1});e.stimulus('duck-1','loom');
        let held=0;
        for(let i=0;i<35;i++){
          state=await e.step({'duck-1':pink});
          if(state.agents['duck-1'].neural.gfHeld){held++;assert.deepEqual(state.body.ducks[0].command,[0,0]);}
        }
        assert.ok(held>0,'The actual giant-fiber circuit must stop the mapped body');
      }finally{e.dispose();}
    });
    await t.test('legacy kick edits update canonical wiring and switching it off cancels a pending visual skill',async()=>{
      const scene=defaultScene('empty');scene.ducks[0].mapping={forward:'kick',turn:'off'};
      const e=new Experiment(runtime,scene);
      try{
        e.stimulus('duck-1','walk');
        for(let i=0;i<20&&e.agents.get('duck-1').skills.phase==='walk';i++)await e.step({'duck-1':pink});
        assert.equal(e.agents.get('duck-1').skills.phase,'settle');
        e.updateDuck('duck-1',{mapping:{forward:'off',turn:'off'}});
        const state=await e.step({'duck-1':pink});
        assert.equal(state.agents['duck-1'].skill.phase,'walk');
        assert.equal(state.scene.ducks[0].kickOnSight,false);
        assert.deepEqual(state.body.ducks[0].command,[0,0]);
        e.updateDuck('duck-1',{kickOnSight:true});
        assert.equal(e.scene.ducks[0].mapping.forward,'kick');
        e.updateDuck('duck-1',{kickOnSight:false});
        assert.equal(e.scene.ducks[0].mapping.forward,'walk');
        e.updateDuck('duck-1',{mapping:{forward:'off',turn:'reverse'},kickOnSight:true});
        assert.equal(e.scene.ducks[0].kickOnSight,false,'Explicit canonical edit takes precedence over the old alias');
      }finally{e.dispose();}
    });
    await t.test('mapped visual activity executes the actual kick policy and replays during the kick',async()=>{
      const scene=defaultScene('empty');scene.ducks[0].mapping={forward:'kick',turn:'follow'};
      const e=new Experiment(runtime,scene),frames={'duck-1':pink};
      try{
        e.stimulus('duck-1','walk');let kicks=0,recording;
        for(let i=0;i<120;i++){
          const state=await e.step(frames),cause=state.event.causes[0];
          assert.deepEqual(state.body.ducks[0].command,[0,0]);
          if(cause.command.policy==='kick'){
            assert.equal(e.world.robots[0].session,kickSession);
            kicks++;
            if(kicks===5)recording=JSON.parse(JSON.stringify(e.export()));
          }
        }
        assert.equal(kicks,25,'The selected policy must execute for its declared 0.5-second interval');
        assert.equal(e.state().body.ducks[0].fallen,false);
        assert.ok(recording,'A checkpoint must be retained during the physical kick');
        e.import(recording);for(let i=0;i<8;i++)await e.step(frames);const expected=e.checkpoint();
        e.import(recording);for(let i=0;i<8;i++)await e.step(frames);assert.deepEqual(e.checkpoint(),expected);
      }finally{e.dispose();}
    });
    await t.test('manual mode clearly bypasses mapping while motor disconnection still stops it',async()=>{
      const scene=defaultScene('empty');Object.assign(scene.ducks[0],{mode:'manual',manual:[.15,.2],mapping:{forward:'kick',turn:'off'}});
      const e=new Experiment(runtime,scene);
      try{
        e.stimulus('duck-1','walk');
        for(let i=0;i<20;i++){
          const state=await e.step({'duck-1':pink});
          assert.deepEqual(state.body.ducks[0].command,[.15,.2]);
          assert.equal(state.event.causes[0].provenance.forward,'Manual override');
          assert.equal(state.agents['duck-1'].skill.phase,'walk');
        }
        e.updateDuck('duck-1',{motorEnabled:false});
        assert.deepEqual((await e.step({'duck-1':pink})).body.ducks[0].command,[0,0]);
      }finally{e.dispose();}
    });
    await t.test('a held GF supervisor blocks kick selection after the neural pulse has expired',async()=>{
      const scene=defaultScene('empty');Object.assign(scene.ducks[0],{temporal:'hold',mapping:{forward:'kick',turn:'follow'}});
      const temporalDecoder=new TemporalDecoder(JSON.parse(read('../../shared/vision/temporal/no-pose.json')));
      const e=new Experiment({...runtime,temporalDecoder},scene);
      try{
        e.stimulus('duck-1','loom');e.stimulus('duck-1','walk');let postPulse=0;
        // This legacy image has no stereo sequence. Missing clear evidence
        // cannot release a supervisor that the actual GF circuit engaged.
        for(let i=0;i<110;i++){
          const state=await e.step({'duck-1':pink});
          if(state.body.time>1.5&&!state.agents['duck-1'].neural.gfHeld){
            postPulse++;
            assert.equal(state.agents['duck-1'].temporal.held,true);
            assert.equal(state.agents['duck-1'].skill.phase,'walk');
            assert.equal(state.event.causes[0].command.policy??'walking','walking');
            assert.equal(state.event.causes[0].provenance.forward,'Experimental GF hazard hold');
            assert.deepEqual(state.body.ducks[0].command,[0,0]);
          }
        }
        assert.ok(postPulse>0);
        assert.equal(e.skill('duck-1','kick'),true);
        assert.equal((await e.step({'duck-1':pink})).agents['duck-1'].skill.phase,'walk','The same supervisor also cancels manual skills');
      }finally{e.dispose();}
    });
    await t.test('rewinding across live wiring edits reapplies each edit before its eye frames',async()=>{
      const scene=defaultScene('empty');scene.ducks[0].mapping={forward:'walk',turn:'follow'};
      const e=new Experiment(runtime,scene),frames={'duck-1':pink};
      try{
        e.stimulus('duck-1','walk');
        for(let i=0;i<60;i++){
          if(i===30){
            e.updateDuck('duck-1',{mapping:{forward:'off',turn:'reverse'}});
            e.updateDuck('duck-1',{eye:'left'});
            e.updateDuck('duck-1',{eye:'both',feedback:false});
          }
        if(i===45)e.updateDuck('duck-1',{mapping:{forward:'walk',turn:'off'},feedback:true});
          await e.step(e.needsFrames()?frames:null);
        }
        // An edit at the paused recording endpoint must be restored even
        // though no subsequent motor tick exists to trigger frame acquisition.
        e.updateDuck('duck-1',{activeLook:true});
        const expected=e.checkpoint(),recording=JSON.parse(JSON.stringify(e.export()));
        assert.equal(recording.version,5);assert.equal(recording.duckEdits.length,5);
        e.import(recording);e.rewind(25);
        while(e.tick<60)await e.step(e.needsFrames()?frames:null);
        assert.deepEqual(e.checkpoint(),expected,'Brain and physical continuation must include the intervening mapping edits');
        e.rewind(25);while(e.tick<30)await e.step();
        assert.equal(e.scene.ducks[0].mapping.forward,'walk');
        e.needsFrames();
        assert.equal(e.scene.ducks[0].mapping.forward,'off','The edit must precede frame acquisition, not follow it');
        assert.equal(e.scene.ducks[0].feedback,false,'All edits at a paused tick must run in order');
        const atBoundary=JSON.parse(JSON.stringify(e.export()));
        e.import(atBoundary);await e.step();const boundaryExpected=e.checkpoint();
        e.import(atBoundary);await e.step();assert.deepEqual(e.checkpoint(),boundaryExpected);
        e.rewind(25);e.updateDuck('duck-1',{mapping:{forward:'off',turn:'off'}});
        assert.equal(e.duckEdits.length,1,'Branching must discard unapplied future edits');
        assert.equal(e.duckEdits[0].tick,25);
        for(let i=0;i<25;i++)await e.step(frames);
        assert.equal(e.scene.ducks[0].mapping.forward,'off');
      }finally{e.dispose();}
    });
    await t.test('a burst of paused edits rolls the replay baseline forward without an oversized recording',async()=>{
      const scene=defaultScene('empty');scene.ducks[0].mapping={forward:'walk',turn:'follow'};
      const e=new Experiment(runtime,scene),frames={'duck-1':blank};
      try{
        for(let i=0;i<30;i++)await e.step(frames);
        for(let i=0;i<2001;i++)e.updateDuck('duck-1',{motorGain:i%2?.25:.75});
        assert.equal(e.duckEdits.length,0);assert.equal(e.history.length,1);assert.equal(e.history[0].tick,30);
        assert.ok([...e.frameTape.keys()].every(tick=>tick>=30));
        e.updateDuck('duck-1',{mapping:{forward:'off',turn:'off'}});
        const recording=JSON.parse(JSON.stringify(e.export()));
        await e.step(frames);const expected=e.checkpoint();e.import(recording);await e.step(frames);
        assert.deepEqual(e.checkpoint(),expected);
        const invalid=structuredClone(recording);invalid.duckEdits[0].tick=-1;
        assert.throws(()=>e.import(invalid),/edit timeline/);
      }finally{e.dispose();}
    });
  }finally{await session.release();await kickSession.release();}
});
