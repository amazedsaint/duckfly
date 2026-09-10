// Shared WASM instance, immutable weights and separately allocated recurrent states.
export class SparseVisionModel {
  static async create(wasmBytes,manifest,arrays){
    if(manifest.format!=='duckfly-flyvis-sparse'||manifest.version!==1||manifest.nodes!==45669||manifest.edges!==1513231)throw Error('Unsupported Flyvis model manifest');
    const {instance}=await WebAssembly.instantiate(wasmBytes,{});return new SparseVisionModel(instance.exports,manifest,arrays);
  }
  constructor(core,manifest,arrays){
    this.core=core;this.manifest=manifest;this.arrays=arrays;this.allocations=[];this.disposed=false;this.states=new Set();
    for(const name of ['source','target','weight','bias','timeConstant']){
      const a=arrays[name],expected=['source','target','weight'].includes(name)?manifest.edges:manifest.nodes;
      if(!a||a.length!==expected||!a.every(Number.isFinite))throw Error(`Invalid ${name} array`);
      if((name==='source'||name==='target')&&a.some(v=>v>=manifest.nodes))throw Error('Edge outside model');
      this[name]=this.allocate(a);
    }
    this.inputIndex=arrays.inputIndex;if(this.inputIndex.length!==721*8||this.inputIndex.some(v=>v>=manifest.nodes))throw Error('Invalid retinal input map');
  }
  allocate(array){const pointer=this.core.allocate(array.length);new Uint8Array(this.core.memory.buffer,pointer,array.byteLength).set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));this.allocations.push([pointer,array.length]);return pointer;}
  eye(initial=this.arrays.steadyState){
    if(this.disposed)throw Error('Model disposed');
    const n=this.manifest.nodes;
    if(!initial||initial.length!==n)throw Error('Invalid initial neural state');
    const state=this.allocate(initial),input=this.allocate(new Float32Array(n)),current=this.allocate(new Float32Array(n));
    const eye={step:retina=>{
      if(this.disposed||eye.disposed)throw Error('Model disposed');
      if(retina.length!==721||!retina.every(Number.isFinite))throw Error('Expected 721 retinal samples');
      const x=new Float32Array(this.core.memory.buffer,input,n);x.fill(0);
      for(let i=0;i<this.inputIndex.length;i++)x[this.inputIndex[i]]=retina[i%721];
      this.core.step(n,this.manifest.edges,this.source,this.target,this.weight,this.bias,this.timeConstant,input,state,current,this.manifest.dt);
      return new Float32Array(this.core.memory.buffer,state,n);
    },checkpoint:()=>new Float32Array(this.core.memory.buffer,state,n).slice(),restore:v=>{
      if(v.length!==n||!v.every(Number.isFinite))throw Error('Invalid recurrent state');new Float32Array(this.core.memory.buffer,state,n).set(v);
    },dispose:()=>{if(!eye.disposed){eye.disposed=true;for(const ptr of [state,input,current]){this.core.release(ptr,n);this.allocations=this.allocations.filter(([p])=>p!==ptr);}this.states.delete(eye);}}};
    this.states.add(eye);return eye;
  }
  dispose(){if(!this.disposed){for(const eye of this.states)eye.dispose();for(const [ptr,n] of this.allocations)this.core.release(ptr,n);this.allocations=[];this.disposed=true;}}
}
