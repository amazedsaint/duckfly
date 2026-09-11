const BASE='http://127.0.0.1:5182/';
export async function runArenaMarker(){
 const[{LabArena},{LabWorld,mountTemplate},{defaultScene},{fetchBytes},{default:load}]=await Promise.all([
  import(BASE+'src/lab/lab-arena.js'),import(BASE+'src/lab/lab-world.js'),import(BASE+'src/lab/scene.js'),import(BASE+'src/assets.js'),import(BASE+'runtime/mujoco.js')]);
 const[mj,db,tb]=await Promise.all([load({locateFile:n=>BASE+'runtime/'+n}),fetchBytes(BASE+'assets/scene.json.gz'),fetchBytes(BASE+'assets/Simulation/lab-template.json.gz')]);
 const data=JSON.parse(new TextDecoder().decode(db)),template=JSON.parse(new TextDecoder().decode(tb));mountTemplate(mj,template);
 const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:960px;height:640px';document.body.append(host);
 const arena=new LabArena(host,data);arena.renderer.setAnimationLoop(null);const records=[];
 const families=['isolated','separated-distractor','same-color-cross','brief-occlusion','ambiguous-occlusion','global-flash','local-flash','no-marker'];
 for(const family of families)for(let index=0;index<4;index++){
  const scene=defaultScene('target'),p=scene.props[0],distance=[.65,.8,.95,1][index],diameter=[.05,.065,.08,.1][index];
  p.position=[distance,-.15,.17];p.size=[diameter,diameter,diameter];p.color='#ee4581';
  const distractor={...structuredClone(p),id:'distractor',name:'Identical marker',position:[distance,.16,.17]};
  const block={...structuredClone(p),id:'occluder',name:'Opaque occluder',kind:'block',position:[distance*.7,0,.16],size:[.025,.025,.25],color:'#87969a'};
  if(['separated-distractor','same-color-cross','ambiguous-occlusion'].includes(family))scene.props.push(distractor);
  if(family.includes('occlusion'))scene.props.push(block);
  if(family==='global-flash')scene.props.push({...structuredClone(p),id:'flash-panel',name:'Flash panel',kind:'block',position:[.25,0,.17],size:[.025,2,2]});
  const world=new LabWorld(mj,template,null,null,scene);arena.setScene(scene);const frames=[];let ambiguous=false;
  try{
   for(let i=0;i<=50;i++){
    const time=i*.04,position=[distance,-.15+.15*time,.17];
    world.moveProp(p.id,position,0);
    if(scene.props.some(p=>p.id===distractor.id))world.moveProp(distractor.id,[distance,family==='separated-distractor'?.23:.16-.15*time,family==='separated-distractor'?.33:.17],0);
    const state=world.state();arena.updateLab(state);const target=arena.props.get(p.id),noTarget=['global-flash','local-flash','no-marker'].includes(family),flash=(time>=.4&&time<.48)||(time>=1.2&&time<1.28);
    target.visible=!noTarget||(family==='local-flash'&&flash);
    const other=arena.props.get(distractor.id);if(other)other.visible=time>=.36;
    const panel=arena.props.get('flash-panel');if(panel)panel.visible=flash;
    const camera=arena.ducks.get('duck-1').camera;camera.updateMatrixWorld(true);
    const project=mesh=>{const v=mesh.position.clone().project(camera);return[(v.x+1)*95/2,(1-v.y)*63/2];},center=project(target),otherCenter=other?.visible?project(other):null;
    // Ground-truth labels only. These never enter the tracker or baseline.
    const cp=state.ducks[0].cameraPose,occluder=scene.props.find(p=>p.id==='occluder');let blocked=false;
    if(occluder){const direction=position.map((v,k)=>v-cp[k]);let lo=0,hi=1;for(let k=0;k<3;k++){const min=occluder.position[k]-occluder.size[k]/2,max=occluder.position[k]+occluder.size[k]/2;if(Math.abs(direction[k])<1e-9){if(cp[k]<min||cp[k]>max)hi=-1;}else{const a=(min-cp[k])/direction[k],b=(max-cp[k])/direction[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}blocked=hi>=lo&&hi>=0&&lo<1;}
    const radiusPixels=diameter/distance*63/(2*Math.tan(75*Math.PI/360))/2;
    if(otherCenter&&family!=='separated-distractor'&&Math.hypot(center[0]-otherCenter[0],center[1]-otherCenter[1])<=2*radiusPixels+4)ambiguous=true;
    const packet=arena.captureEyes(time,i)['duck-1'];frames.push({time,rgba:btoa(String.fromCharCode(...packet.pixels)),cameraPose:packet.pose,
      truth:{hasTarget:!noTarget,visible:!noTarget&&!blocked&&center[0]>=0&&center[0]<=95&&center[1]>=0&&center[1]<=63,center:!noTarget?center:null,blocked,ambiguous,safeTracking:['isolated','separated-distractor'].includes(family)}});
   }
   records.push({id:`arena-marker-v1-${family}-${index}`,family,index,scene,frames});
  }finally{world.dispose();}
 }
 const payload={version:1,probe:'actual-arena-marker-v1',createdAt:new Date().toISOString(),interpretation:'Actual rendered target and opaque occluder. Posed objects; no body policy. Object IDs/poses used only for ground-truth labels; inference receives RGBA and capture identity.',records};
 const response=await fetch(new URL('./result',import.meta.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw Error(await response.text());return response.json();
}
