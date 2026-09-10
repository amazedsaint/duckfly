import { World,quaternion } from '../world.js';
import { sceneXML,validateScene } from './scene.js';

// mj_getState in 3.10's JS binding does not copy its temporary output back to
// a JS typed array. Read the same ordered mjSTATE_INTEGRATION fields directly.
const stateFields=['qpos','qvel','act','history','qacc_warmstart','ctrl','qfrc_applied',
  'xfrc_applied','mocap_pos','mocap_quat','userdata','plugin_state'];
function integrationState(d){return [d.time,...stateFields.flatMap(key=>Array.from(d[key]))];}

export function mountTemplate(mj,template){
  try{mj.FS.mkdir('/collision');}catch(e){if(!mj.FS.analyzePath('/collision').exists)throw e;}
  for(const [name,base64] of Object.entries(template.files)){
    if(!/^[a-zA-Z0-9_.-]+\.stl$/.test(name))throw Error('Invalid collision asset name');
    mj.FS.writeFile(`/collision/${name}`,Uint8Array.from(atob(base64),x=>x.charCodeAt(0)));
  }
}
export class LabWorld {
  constructor(mj,template,session,Tensor,scene){
    this.mj=mj;this.scene=validateScene(scene);this.template=template;
    this.m=mj.MjModel.from_xml_string(sceneXML(template,this.scene));this.d=new mj.MjData(this.m);
    // This template has no equality constraints. The pinned WASM binding cannot
    // expose bool eq_active; reject future models needing it instead of losing it.
    if(this.m.neq!==0)throw Error('Equality state requires a newer MuJoCo JS binding');
    const m=this.m;
    const named=(type,name)=>{const v=mj.mj_name2id(m,mj.mjtObj[`mjOBJ_${type}`].value,name);if(v<0)throw Error(`Missing ${type}: ${name}`);return v;};
    this.robots=this.scene.ducks.map(duck=>{
      const p=`${duck.id}/`,names=template.names;
      const actuators=names.actuators.map(n=>named('ACTUATOR',p+n));
      const joints=actuators.map(i=>m.actuator_trnid[i*2]);
      const root=named('JOINT',p+'trunk_base_freejoint');
      const config={...template.config,actuators,joints,spawn:duck.spawn,
        qpos:joints.map(i=>m.jnt_qposadr[i]),qvel:joints.map(i=>m.jnt_dofadr[i]),
        trunk:named('BODY',p+names.trunk),head:named('BODY',p+names.head),camera:named('CAMERA',p+names.camera),qa:m.jnt_qposadr[root],qva:m.jnt_dofadr[root],
        gyro:m.sensor_adr[named('SENSOR',p+names.gyro)],floor:named('GEOM','floor'),
        feet:names.feet.map(n=>named('GEOM',p+n)),visualIds:names.visual.map(n=>named('GEOM',p+n))};
      const robot=new World(mj,m,config,session,Tensor,this.d);robot.id=duck.id;return robot;
    });
    this.props=this.scene.props.map(p=>({...p,bodyId:named('BODY',`prop/${p.id}`),geomId:named('GEOM',`prop/${p.id}/geom`)}));
    this.initialFriction=Float64Array.from(m.dof_frictionloss);this.initialDamping=Float64Array.from(m.dof_damping);
    this.reset();
  }
  reset(){
    const {mj,m,d}=this;mj.mj_resetData(m,d);
    m.dof_frictionloss.set(this.initialFriction);m.dof_damping.set(this.initialDamping);
    for(const r of this.robots)r.reset();
    mj.mj_forward(m,d);this.contactPairs=[];this.collisionCount=0;this.previousCollisions=[];this.replayAnchor=null;
    return this.state();
  }
  async step(commands){
    const start=performance.now(),{mj,m,d}=this;
    // Serial session calls avoid provider-specific inference reentrancy.
    for(const r of this.robots){const c=commands[r.id]??{vx:0,yaw:0};await r.infer(c.vx,c.yaw,c.head);}
    d.xfrc_applied.fill(0);for(const r of this.robots)r.applyPush();
    for(let sub=0;sub<4;sub++){
      for(const p of this.props){const mocap=m.body_mocapid[p.bodyId];if(mocap>=0)d.mocap_pos.set(p.position.map((v,i)=>v+p.motion[i]*(d.time+.005)),mocap*3);}
      for(const r of this.robots)r.bam.update();
      if(sub===3)this.replayAnchor=integrationState(d);
      mj.mj_step(m,d);
      const cs=d.contact,pairs=[];
      try{for(let i=0;i<cs.size();i++){const c=cs.get(i);pairs.push([c.geom1,c.geom2]);c.delete();}}finally{cs.delete();}
      this.contactPairs=pairs;for(const r of this.robots)r.sampleContacts(pairs);
      const collisions=[...new Set(pairs.filter(([a,b])=>a!==0&&b!==0&&this.owner(a)!==this.owner(b)).map(([a,b])=>[this.owner(a),this.owner(b)].sort().join('|')))];
      for(const c of collisions)if(!this.previousCollisions.includes(c))this.collisionCount++;
      this.previousCollisions=collisions;
    }
    if(!d.qpos.every(Number.isFinite))throw Error('Non-finite physics state');
    for(const r of this.robots)r.finish();
    return this.state(performance.now()-start);
  }
  owner(geom){
    let body=this.m.geom_bodyid[geom];
    for(const p of this.props)if(p.bodyId===body)return p.id;
    while(body>0){const r=this.robots.find(r=>r.c.trunk===body);if(r)return r.id;body=this.m.body_parentid[body];}
    return 'floor';
  }
  moveProp(id,position,yaw){
    const p=this.props.find(p=>p.id===id);if(!p)throw Error('Prop no longer exists');
    const quat=[Math.cos(yaw/2),0,0,Math.sin(yaw/2)],mocap=this.m.body_mocapid[p.bodyId];
    p.position=[...position];p.yaw=yaw;p.motion=[0,0,0];
    if(mocap>=0){this.d.mocap_pos.set(position,mocap*3);this.d.mocap_quat.set(quat,mocap*4);}
    else {const j=this.m.body_jntadr[p.bodyId],qa=this.m.jnt_qposadr[j],va=this.m.jnt_dofadr[j];this.d.qpos.set([...position,...quat],qa);this.d.qvel.fill(0,va,va+6);}
    this.mj.mj_forward(this.m,this.d);this.replayAnchor=null;
  }
  state(cost=0){
    const d=this.d;
    return {time:d.time,cost,ducks:this.robots.map(r=>({...r.state(cost),id:r.id,
      headPose:[...d.xpos.slice(r.c.head*3,r.c.head*3+3),...d.xquat.slice(r.c.head*4,r.c.head*4+4)],
      cameraPose:[...d.cam_xpos.slice(r.c.camera*3,r.c.camera*3+3),...quaternion(d.cam_xmat.slice(r.c.camera*9,r.c.camera*9+9))]})),
      props:this.props.map(p=>({id:p.id,position:Array.from(d.xpos.slice(p.bodyId*3,p.bodyId*3+3)),quaternion:Array.from(d.xquat.slice(p.bodyId*4,p.bodyId*4+4))})),
      collisions:this.previousCollisions,collisionCount:this.collisionCount};
  }
  checkpoint(){
    return {integration:integrationState(this.d),replayAnchor:this.replayAnchor,friction:Array.from(this.m.dof_frictionloss),damping:Array.from(this.m.dof_damping),
      robots:this.robots.map(r=>r.checkpoint()),collisionCount:this.collisionCount,previousCollisions:[...this.previousCollisions]};
  }
  restore(s){
    if(s.integration.length!==this.mj.mj_stateSize(this.m,16383)||!s.integration.every(Number.isFinite))throw Error('Incompatible physics checkpoint');
    this.m.dof_frictionloss.set(s.friction);this.m.dof_damping.set(s.damping);
    this.mj.mj_resetData(this.m,this.d);
    // Re-run the final physics substep to reconstruct its exact sensor and
    // constraint caches. A forward at the integrated position changes the next
    // policy observation and BAM load estimate, so it is not a faithful rewind.
    this.mj.mj_setState(this.m,this.d,s.replayAnchor??s.integration,16383);
    if(s.replayAnchor)this.mj.mj_step(this.m,this.d);else this.mj.mj_forward(this.m,this.d);
    this.replayAnchor=s.replayAnchor;
    s.robots.forEach((state,i)=>this.robots[i].restore(state));this.collisionCount=s.collisionCount;this.previousCollisions=[...s.previousCollisions];
    return this.state();
  }
  dispose(){this.d.delete();this.m.delete();}
}
