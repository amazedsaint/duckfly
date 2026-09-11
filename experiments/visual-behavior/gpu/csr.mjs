// Stable target-CSR: incoming edges retain their exact original accumulation order.
export function stableTargetCSR(manifest, arrays){
 const n=manifest.nodes,e=manifest.edges,offsets=new Uint32Array(n+1);
 if(arrays.source.length!==e||arrays.target.length!==e||arrays.weight.length!==e)throw Error('Edge shape mismatch');
 for(const target of arrays.target){if(target>=n)throw Error('Target outside model');offsets[target+1]++;}
 for(let i=0;i<n;i++)offsets[i+1]+=offsets[i];
 const cursor=offsets.slice(0,n),source=new Uint32Array(e),weight=new Float32Array(e),originalEdge=new Uint32Array(e);
 for(let k=0;k<e;k++){const i=cursor[arrays.target[k]]++;source[i]=arrays.source[k];weight[i]=arrays.weight[k];originalEdge[i]=k;}
 let maximumDegree=0;
 for(let node=0;node<n;node++){
  maximumDegree=Math.max(maximumDegree,offsets[node+1]-offsets[node]);let previous=-1;
  for(let i=offsets[node];i<offsets[node+1];i++){const edge=originalEdge[i];if(edge<=previous||arrays.target[edge]!==node||source[i]!==arrays.source[edge]||weight[i]!==arrays.weight[edge])throw Error('CSR order or value changed');previous=edge;}
 }
 const inputSlot=new Uint32Array(n).fill(0xffffffff);
 for(let i=0;i<arrays.inputIndex.length;i++)inputSlot[arrays.inputIndex[i]]=i%721;
 return{offsets,source,weight,inputSlot,originalEdge,maximumDegree};
}
