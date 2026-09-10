import * as THREE from 'three';
import { Arena } from '../arena.js';
import { EYE_WIDTH as W,EYE_HEIGHT as H } from './vision.js';
import { COLORS } from './scene.js';
export class LabArena extends Arena {
  constructor(host,assets){
    super(host,assets);this.follow=false;this.selected='duck-1';this.ducks=new Map();this.props=new Map();this.fields=[];this.body=null;
    this.target.set(.3,.12,0);this.camera.position.set(1.15,.7,1.15);this.controls.target.copy(this.target);
    this.controls.maxDistance=12;
    this.robot.forEach(mesh=>this.scene.remove(mesh));
    this.scene.fog.far=12;this.scene.fog.near=6;
    this.installPropDragging();
    this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera);});
  }
  installPropDragging(){
    const canvas=this.renderer.domElement,ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag;
    const cast=event=>{const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,this.camera);};
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;cast(event);
      const hit=ray.intersectObjects([...this.props.values()],false)[0];if(!hit)return;
      const id=[...this.props].find(([,mesh])=>mesh===hit.object)[0],position=hit.object.position.clone();
      const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-position.y),point=new THREE.Vector3();
      if(!ray.ray.intersectPlane(plane,point))return;
      drag={id,object:hit.object,position,plane,offset:position.clone().sub(point),pointerId:event.pointerId};
      this.draggedProp=id;
      event.preventDefault();event.stopImmediatePropagation();this.controls.enabled=false;canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';this.onPropDragStart?.(id);
    },true);
    canvas.addEventListener('pointermove',event=>{
      if(!drag)return;cast(event);const point=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,point))return;
      point.add(drag.offset);point.x=THREE.MathUtils.clamp(point.x,-10,10);point.z=THREE.MathUtils.clamp(point.z,-10,10);drag.object.position.copy(point);
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    const finish=(event,cancelled)=>{
      if(!drag)return;event.preventDefault();event.stopImmediatePropagation();const current=drag;drag=null;this.draggedProp=null;
      this.controls.enabled=true;canvas.style.cursor='';if(canvas.hasPointerCapture(current.pointerId))canvas.releasePointerCapture(current.pointerId);
      if(cancelled)current.object.position.copy(current.position);
      else{const p=current.object.position;this.onPropDrop?.(current.id,[p.x,-p.z,p.y]);}
    };
    canvas.addEventListener('pointerup',event=>finish(event,false),true);
    canvas.addEventListener('pointercancel',event=>finish(event,true),true);
  }
  setScene(scene){
    this.definition=scene;this.fitPending=true;
    const hasLight=scene.fields.some(f=>f.kind==='light');this.key.intensity=hasLight?.4:3.5;
    this.scene.children.find(c=>c.isHemisphereLight).intensity=hasLight?.3:2.5;
    for(const d of this.ducks.values()){this.scene.remove(d.group);d.target.dispose();d.marker.traverse(o=>o.geometry?.dispose());d.marker.material.dispose();}
    for(const p of this.props.values()){this.scene.remove(p);p.geometry.dispose();p.material.dispose();}
    for(const f of this.fields){this.scene.remove(f);f.geometry?.dispose();f.material?.dispose();}
    this.ducks.clear();this.props.clear();this.fields=[];
    for(const duck of scene.ducks){
      const group=new THREE.Group(),meshes=this.robot.map(mesh=>{const clone=mesh.clone();clone.visible=true;group.add(clone);return clone;});
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.022,12,8),new THREE.MeshBasicMaterial({color:COLORS.neighbor}));
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(.0015,.0015,.065,6),marker.material);
      stem.rotation.z=Math.PI/2;stem.position.x=-.0325;marker.add(stem);
      group.add(marker);this.scene.add(group);
      const camera=new THREE.PerspectiveCamera(75,W/H,.004,12),target=new THREE.WebGLRenderTarget(W,H,{depthBuffer:true});
      // Readback pixels use the same sRGB encoding as webcam ImageData.
      target.texture.colorSpace=THREE.SRGBColorSpace;
      this.ducks.set(duck.id,{group,meshes,marker,camera,target});
    }
    for(const prop of scene.props){
      const sphere=['ball','target'].includes(prop.kind);
      const mesh=new THREE.Mesh(sphere?new THREE.SphereGeometry(prop.size[0]/2,24,16):new THREE.BoxGeometry(...prop.size),
        prop.kind==='target'?new THREE.MeshBasicMaterial({color:prop.color}):new THREE.MeshStandardMaterial({color:prop.color,roughness:.75}));
      mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);this.props.set(prop.id,mesh);
    }
    for(const f of scene.fields){
      const disc=new THREE.Mesh(new THREE.CircleGeometry(f.radius,48),new THREE.MeshBasicMaterial({color:f.kind==='odor'?0x76c79c:0xf5d98b,transparent:true,opacity:.12,depthWrite:false}));
      disc.rotation.x=-Math.PI/2;disc.position.set(f.position[0],.002,-f.position[1]);this.scene.add(disc);this.fields.push(disc);
      if(f.kind==='light'){const light=new THREE.PointLight(0xffdda5,f.strength*.18,f.radius*3);light.position.set(f.position[0],.25,-f.position[1]);this.scene.add(light);this.fields.push(light);}
    }
    const goal=new THREE.Mesh(new THREE.RingGeometry(Math.max(.005,scene.challenge.radius-.008),scene.challenge.radius,48),new THREE.MeshBasicMaterial({color:0x628c6d,transparent:true,opacity:.5,depthWrite:false}));
    goal.rotation.x=-Math.PI/2;goal.position.set(scene.challenge.goal[0],.002,-scene.challenge.goal[1]);this.scene.add(goal);this.fields.push(goal);
  }
  pose(object,p){object.position.set(p[0],p[2],-p[1]);object.quaternion.set(p[4],p[5],p[6],p[3]).premultiply(this.conversion);}
  updateLab(body){
    this.body=body;
    for(const s of body.ducks){const duck=this.ducks.get(s.id);if(!duck)continue;
      s.poses.forEach((p,i)=>this.pose(duck.meshes[i],p));
      this.pose(duck.camera,s.cameraPose);
      this.pose(duck.marker,s.headPose);duck.marker.translateX(.08);duck.marker.translateZ(.025);
    }
    for(const p of body.props){const object=this.props.get(p.id);if(object&&this.draggedProp!==p.id)this.pose(object,[...p.position,...p.quaternion]);}
    const selected=body.ducks.find(d=>d.id===this.selected)??body.ducks[0];
    if(selected){const next=new THREE.Vector3(selected.position[0],.12,-selected.position[1]);
      if(this.follow){const delta=next.clone().sub(this.target).multiplyScalar(.2);this.camera.position.add(delta);this.controls.target.add(delta);}
      this.target.copy(next);this.key.position.copy(next).add(new THREE.Vector3(.5,1,.6));this.key.target.position.copy(next);
    }
    if(this.fitPending){this.home();this.fitPending=false;}
  }
  captureEyes(){
    const frames={};
    for(const [id,duck] of this.ducks){
      duck.group.visible=false;
      this.renderer.setRenderTarget(duck.target);this.renderer.render(this.scene,duck.camera);
      const raw=new Uint8Array(W*H*4);this.renderer.readRenderTargetPixels(duck.target,0,0,W,H,raw);
      // WebGL's framebuffer begins at the bottom; the encoder uses top-left.
      const pixels=new Uint8Array(raw.length);
      for(let y=0;y<H;y++)pixels.set(raw.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);
      frames[id]=pixels;duck.group.visible=true;
    }
    this.renderer.setRenderTarget(null);return frames;
  }
  home(){
    if(!this.controls)return;
    const points=[...(this.body?.ducks??[]),...(this.body?.props??[])].map(d=>new THREE.Vector3(d.position[0],d.position[2],-d.position[1]));
    if(points.length){const bounds=new THREE.Box3().setFromPoints(points).expandByScalar(.12),center=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length()/2;
      const distance=radius/Math.sin(THREE.MathUtils.degToRad(this.camera.fov/2))/Math.min(1,this.camera.aspect)*1.05;
      this.camera.position.copy(center).add(new THREE.Vector3(.9,.7,1).normalize().multiplyScalar(Math.max(.65,distance)));this.controls.target.copy(center);
    }else{this.camera.position.copy(this.target).add(new THREE.Vector3(.8,.55,.8));this.controls.target.copy(this.target);}
    this.controls.update();
  }
  resize(){const previous=this.camera.aspect;super.resize();if(this.body&&Math.max(previous/this.camera.aspect,this.camera.aspect/previous)>1.3)this.home();}
}
