import { BAM, clamp } from './bam.js';
const f=Math.fround;
export function quaternion(a) {
  const [m00,m01,m02,m10,m11,m12,m20,m21,m22]=a;
  const t=m00+m11+m22;
  if(t>0) {const s=Math.sqrt(t+1)*2;return [s/4,(m21-m12)/s,(m02-m20)/s,(m10-m01)/s];}
  if(m00>m11&&m00>m22) {const s=Math.sqrt(1+m00-m11-m22)*2;return [(m21-m12)/s,s/4,(m01+m10)/s,(m02+m20)/s];}
  if(m11>m22) {const s=Math.sqrt(1+m11-m00-m22)*2;return [(m02-m20)/s,(m01+m10)/s,s/4,(m12+m21)/s];}
  const s=Math.sqrt(1+m22-m00-m11)*2;return [(m10-m01)/s,(m02+m20)/s,(m12+m21)/s,s/4];
}
export class World {
  constructor(mj,model,config,session,Tensor,sharedData=null) {
    this.mj=mj;this.m=model;this.c=config;this.session=session;this.Tensor=Tensor;
    this.ownsModel=!sharedData;
    if(this.ownsModel&&(model.nu!==14||model.nq!==21)) throw new Error('Incompatible Microduck model');
    this.d=sharedData??new mj.MjData(model);this.bam=new BAM(mj,model,this.d,config);
    this.initialFriction=Float64Array.from(model.dof_frictionloss);
    this.initialDamping=Float64Array.from(model.dof_damping);
    this.reset();
  }
  reset() {
    const {mj,m,d,c}=this;
    if(this.ownsModel){m.dof_frictionloss.set(this.initialFriction);m.dof_damping.set(this.initialDamping);mj.mj_resetData(m,d);}
    const spawn=c.spawn??[0,0,0];
    d.qpos.set([spawn[0],spawn[1],.125,Math.cos(spawn[2]/2),0,0,Math.sin(spawn[2]/2)],c.qa);
    c.qpos.forEach((q,i)=>d.qpos[q]=c.defaultPose[i]);
    this.bam.reset();this.lastAction=new Float32Array(14);this.command=[0,0];this.headCommand=[0,0,0,0];
    mj.mj_forward(m,d);
    this.distance=0;this.lastPosition=spawn.slice(0,2);this.fallen=false;
    this.contacts=[false,false];this.onsets=[0,0];this.pushTicks=0;this.pushForce=.8;
    return this.state(0);
  }
  gravity() {
    const q=Array.from(this.d.xquat.slice(4*this.c.trunk,4*this.c.trunk+4),f);
    const [w,x,y]=q,z=q[3],tx=f(-2*y),ty=f(2*x);
    return [f(f(-w*tx)-f(z*ty)),f(f(-w*ty)+f(z*tx)),f(-1+f(f(x*ty)-f(y*tx)))];
  }
  observations() {
    const {d,c}=this,obs=new Float32Array(61);
    obs.set(d.sensordata.slice(c.gyro,c.gyro+3),0);obs.set(this.gravity(),3);
    c.qpos.forEach((q,i)=>obs[6+i]=f(f(d.qpos[q])-c.defaultPose[i]));
    c.qvel.forEach((q,i)=>obs[20+i]=d.qvel[q]);
    obs.set(this.lastAction,34);obs[48]=this.command[0];obs[50]=this.command[1];obs.set(this.headCommand,51);
    return obs;
  }
  async infer(vx,yaw,head=[0,0,0,0]) {
    const {c}=this;
    if(!Number.isFinite(vx)||!Number.isFinite(yaw)) throw new Error('Non-finite command');
    if(head.length!==4||!head.every(Number.isFinite))throw new Error('Invalid head command');
    this.command=this.fallen?[0,0]:[clamp(vx,0,.3),clamp(yaw,-.8,.8)];
    this.headCommand=head.map((v,i)=>clamp(v,-(i===2?.35:.15),i===2?.35:.15));
    const input=new this.Tensor('float32',this.observations(),[1,61]);
    const outputs=await this.session.run({[this.session.inputNames[0]]:input});
    const tensor=outputs[this.session.outputNames[0]],action=tensor.data;
    if(action.length!==14||!action.every(Number.isFinite)) throw new Error('Invalid policy action');
    this.lastAction.set(action);
    for(let i=0;i<14;i++) this.bam.targets[i]=f(c.defaultPose[i]+f(action[i]*c.actionScale));
    input.dispose();Object.values(outputs).forEach(t=>t.dispose());
  }
  applyPush(){
    const {d,c}=this;
    if(this.pushTicks>0){d.xfrc_applied[c.trunk*6+1]=this.pushForce;this.pushTicks--;}
  }
  sampleContacts(pairs){
    const contacts=this.c.feet.map(foot=>pairs.some(([a,b])=>(a===foot&&b===this.c.floor)||(b===foot&&a===this.c.floor)));
    for(let i=0;i<2;i++)if(contacts[i]&&!this.contacts[i])this.onsets[i]++;
    this.contacts=contacts;
  }
  finish(){
    const xy=Array.from(this.d.qpos.slice(this.c.qa,this.c.qa+2));
    this.distance+=Math.hypot(xy[0]-this.lastPosition[0],xy[1]-this.lastPosition[1]);this.lastPosition=xy;
  }
  async step(vx,yaw,head) {
    const start=performance.now(),{mj,m,d}=this;
    await this.infer(vx,yaw,head);
    d.xfrc_applied.fill(0);
    this.applyPush();
    for(let sub=0;sub<4;sub++) {
      this.bam.update();mj.mj_step(m,d);
      const pairs=[],cs=d.contact;
      try {
        for(let i=0;i<cs.size();i++) {
          const contact=cs.get(i);
          pairs.push([contact.geom1,contact.geom2]);
          contact.delete();
        }
      } finally {cs.delete();}
      this.sampleContacts(pairs);
    }
    if(!d.qpos.every(Number.isFinite)) throw new Error('Non-finite physics state');
    this.finish();
    return this.state(performance.now()-start);
  }
  state(cost) {
    const {d,c}=this,tilt=Math.acos(clamp(-this.gravity()[2],-1,1))*180/Math.PI;
    this.fallen=this.fallen||tilt>60||d.qpos[c.qa+2]<.055;
    const q=d.qpos.slice(c.qa+3,c.qa+7);
    const jp=c.qpos.map((q,i)=>f(f(d.qpos[q])-c.defaultPose[i]));
    const jv=c.qvel.map(q=>f(d.qvel[q]));
    return {kind:'state',time:d.time,position:Array.from(d.qpos.slice(c.qa,c.qa+3)),
      heading:Math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]**2+q[3]**2)),
      speed:Math.hypot(d.qvel[c.qva??0],d.qvel[(c.qva??0)+1]),tilt,distance:this.distance,contacts:this.contacts,onsets:[...this.onsets],
      joints:c.qpos.map(q=>d.qpos[q]),phase:(Math.atan2(f(jv[2]-jv[11])*.05,f(jp[2]-jp[11]))/(2*Math.PI)+1)%1,
      poses:c.visualIds.map(id=>[...d.geom_xpos.slice(id*3,id*3+3),...quaternion(d.geom_xmat.slice(id*9,id*9+9))]),
      fallen:this.fallen,cost,command:[...this.command]};
  }
  checkpoint(){
    return {lastAction:Array.from(this.lastAction),targets:Array.from(this.bam.targets),previous:Array.from(this.bam.previous),
      command:[...this.command],headCommand:[...this.headCommand],distance:this.distance,lastPosition:[...this.lastPosition],
      fallen:this.fallen,contacts:[...this.contacts],onsets:[...this.onsets],pushTicks:this.pushTicks,pushForce:this.pushForce};
  }
  restore(s){
    this.pushForce=s.pushForce??.8;
    this.lastAction.set(s.lastAction);this.bam.targets.set(s.targets);this.bam.previous.set(s.previous);
    for(const key of ['command','headCommand','distance','lastPosition','fallen','contacts','onsets','pushTicks'])this[key]=structuredClone(s[key]);
  }
  dispose(){if(this.ownsModel){this.d.delete();this.m.delete();}}
}
