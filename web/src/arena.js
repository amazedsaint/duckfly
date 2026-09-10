import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const decode=(s,Type)=>new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
export class Arena {
  constructor(host,sceneData) {
    this.host=host;this.follow=true;this.target=new THREE.Vector3(0,.12,0);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.setClearColor(0xdce4df);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.renderer.domElement.setAttribute('aria-label','Live 3D Microduck simulation. Drag to orbit; scroll to zoom.');
    host.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xdce4df,1.8,5);
    this.camera=new THREE.PerspectiveCamera(42,1,.005,30);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.minDistance=.3;this.controls.maxDistance=3;this.controls.maxPolarAngle=Math.PI*.49;
    this.home();
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x81988a,2.5));
    const key=new THREE.DirectionalLight(0xfff6e9,3.5);key.position.set(.5,1,.6);key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.7;key.shadow.camera.right=.7;key.shadow.camera.top=.7;key.shadow.camera.bottom=-.7;key.shadow.camera.near=.01;key.shadow.camera.far=3;key.shadow.normalBias=.001;
    this.key=key;this.scene.add(key,key.target);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xcfdad2,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;this.scene.add(floor);
    this.grid=new THREE.GridHelper(10,100,0x9eafa5,0xb7c5bb);this.grid.position.y=.0001;this.grid.material.transparent=true;this.grid.material.opacity=.55;this.scene.add(this.grid);
    const meshes={};
    for(const [id,m] of Object.entries(sceneData.meshes)){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(decode(m.vertices,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(decode(m.normals,Float32Array),3));g.setIndex(new THREE.BufferAttribute(decode(m.indices,Uint32Array),1));g.computeBoundingSphere();meshes[id]=g;
    }
    this.robot=sceneData.geometries.map(g=>{
      const [r,b,c,a]=g.color;const material=new THREE.MeshStandardMaterial({color:new THREE.Color(r,b,c),roughness:.55,metalness:.07,opacity:a,transparent:a<1});
      const mesh=new THREE.Mesh(meshes[g.mesh],material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.visible=false;this.scene.add(mesh);return mesh;
    });
    this.conversion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera);});
  }
  home(){this.camera.position.copy(this.target).add(new THREE.Vector3(.44,.24,.46));this.controls.target.copy(this.target);this.controls.update();}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  update(body){
    body.poses.forEach((p,i)=>{const mesh=this.robot[i];mesh.visible=true;mesh.position.set(p[0],p[2],-p[1]);mesh.quaternion.set(p[4],p[5],p[6],p[3]).premultiply(this.conversion);});
    const next=new THREE.Vector3(body.position[0],.12,-body.position[1]);
    if(this.follow){const delta=next.clone().sub(this.target).multiplyScalar(.2);this.camera.position.add(delta);this.controls.target.add(delta);this.target.add(delta);}
    else this.target.copy(next);
    this.key.position.copy(next).add(new THREE.Vector3(.5,1,.6));this.key.target.position.copy(next);
    this.grid.position.x=Math.round(next.x);this.grid.position.z=Math.round(next.z);
  }
}
