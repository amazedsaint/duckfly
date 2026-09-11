import{stableTargetCSR}from'./csr.mjs';
const finite=(a,n)=>a instanceof Float32Array&&a.length===n&&a.every(Number.isFinite);
export class ExperimentalGPUFlyvis{
 static async create(device,manifest,arrays,wgsl){
  const started=performance.now(),model=new ExperimentalGPUFlyvis(device,manifest,arrays),csr=stableTargetCSR(manifest,arrays);model.csr=csr;
  const module=device.createShaderModule({code:wgsl,label:'Pinned Flyvis stable CSR'}),info=await module.getCompilationInfo();
  if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));
  model.compilationMessages=info.messages.map(m=>({type:m.type,message:m.message,lineNum:m.lineNum}));
  model.pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'step'}});
  const nodes=new ArrayBuffer(manifest.nodes*16),f=new Float32Array(nodes),u=new Uint32Array(nodes);
  for(let i=0;i<manifest.nodes;i++){f[4*i]=arrays.bias[i];f[4*i+1]=arrays.timeConstant[i];u[4*i+2]=csr.inputSlot[i];}
  model.immutable=[csr.offsets,csr.source,csr.weight,new Uint8Array(nodes)].map((a,i)=>model.buffer(a,GPUBufferUsage.STORAGE,`immutable-${i}`));
  model.setupMilliseconds=performance.now()-started;return model;
 }
 constructor(device,manifest,arrays){this.device=device;this.manifest=structuredClone(manifest);this.steadyState=arrays.steadyState.slice();this.groups=new Set();this.disposed=false;}
 buffer(data,usage,label){const b=this.device.createBuffer({label,size:data.byteLength,usage,mappedAtCreation:true});new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));b.unmap();return b;}
 group(count,initials=null){
  if(this.disposed)throw Error('Model disposed');if(!Number.isSafeInteger(count)||count<1||count>16)throw Error('Expected1–16 eyes');
  const n=this.manifest.nodes,state=new Float32Array(n*count);
  for(let eye=0;eye<count;eye++){const a=initials?.[eye]??this.steadyState;if(!finite(a,n))throw Error('Invalid initial neural state');state.set(a,eye*n);}
  const group=new GPUFlyvisGroup(this,count,state);this.groups.add(group);return group;
 }
 dispose(){if(this.disposed)return;if([...this.groups].some(g=>g.busy))throw Error('GPU operation pending');for(const group of [...this.groups])group.dispose();for(const b of this.immutable)b.destroy();this.disposed=true;}
}
class GPUFlyvisGroup{
 constructor(model,count,initial){
  this.model=model;this.device=model.device;this.count=count;this.nodes=model.manifest.nodes;this.bytes=initial.byteLength;this.current=0;this.disposed=false;this.busy=false;
  this.states=[0,1].map(i=>model.buffer(initial,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST,`eyes-${count}-state-${i}`));
  this.input=model.buffer(new Float32Array(count*721),GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,'eye-owned retinal inputs');
  const parameters=new ArrayBuffer(16),u=new Uint32Array(parameters);u[0]=this.nodes;u[1]=count;u[2]=721;new Float32Array(parameters)[3]=model.manifest.dt;
  this.parameters=model.buffer(new Uint8Array(parameters),GPUBufferUsage.UNIFORM,'eye-group dimensions');
  this.staging=this.device.createBuffer({size:this.bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,label:'owned full-state readback'});
  this.bindGroups=[0,1].map(i=>this.device.createBindGroup({layout:model.pipeline.getBindGroupLayout(0),entries:[...model.immutable,this.states[i],this.states[1-i],this.input,this.parameters].map((buffer,binding)=>({binding,resource:{buffer}}))}));
 }
 async exclusive(fn){if(this.disposed||this.model.disposed)throw Error('Group disposed');if(this.busy)throw Error('GPU operation pending');this.busy=true;try{return await fn();}finally{this.busy=false;}}
 async readMapped(){await this.staging.mapAsync(GPUMapMode.READ);try{return new Float32Array(this.staging.getMappedRange().slice(0));}finally{this.staging.unmap();}}
 advance(retinas,steps=20){return this.exclusive(async()=>{
  if(retinas.length!==this.count||retinas.some(a=>!finite(a,721))||!Number.isSafeInteger(steps)||steps<1||steps>500)throw Error('Invalid neural input group');
  const inputs=new Float32Array(this.count*721);retinas.forEach((a,i)=>inputs.set(a,i*721));
  this.device.queue.writeBuffer(this.input,0,inputs);
  const encoder=this.device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(this.model.pipeline);
  for(let step=0;step<steps;step++){pass.setBindGroup(0,this.bindGroups[this.current]);pass.dispatchWorkgroups(Math.ceil(this.nodes/64),this.count);this.current=1-this.current;}
  pass.end();encoder.copyBufferToBuffer(this.states[this.current],0,this.staging,0,this.bytes);this.device.queue.submit([encoder.finish()]);
  return this.readMapped();
 });}
 checkpoint(){return this.exclusive(async()=>{const encoder=this.device.createCommandEncoder();encoder.copyBufferToBuffer(this.states[this.current],0,this.staging,0,this.bytes);this.device.queue.submit([encoder.finish()]);return this.readMapped();});}
 restore(state){return this.exclusive(async()=>{if(!finite(state,this.nodes*this.count))throw Error('Invalid neural checkpoint');this.device.queue.writeBuffer(this.states[0],0,state);this.current=0;await this.device.queue.onSubmittedWorkDone();});}
 dispose(){if(this.busy)throw Error('GPU operation pending');if(this.disposed)return;for(const b of [...this.states,this.input,this.parameters,this.staging])b.destroy();this.disposed=true;this.model.groups.delete(this);}
}
