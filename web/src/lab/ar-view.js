import * as THREE from 'three';
import {arSupport,horizontalHit,placementMatrix,scenePoint} from './ar-placement.js';
import {AR_OBJECTS} from './ar-scene.js';
import {FIELD_LABELS} from './senses.js';
import './ar-view.css';
const option=(value,label)=>Object.assign(document.createElement('option'),{value,textContent:label});

export class ARView {
  constructor(arena,callbacks) {
    this.arena=arena;this.callbacks=callbacks;this.mode='off';this.active=false;this.scale=1;this.heading=0;this.generation=0;
    this.room=new THREE.Scene();this.content=new THREE.Group();this.content.matrixAutoUpdate=false;this.room.add(this.content);
    this.reticle=new THREE.Mesh(new THREE.RingGeometry(.055,.075,32),new THREE.MeshBasicMaterial({color:'#63cbb2',side:THREE.DoubleSide,depthTest:false}));
    this.reticle.rotation.x=-Math.PI/2;this.reticle.visible=false;this.room.add(this.reticle);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.ShadowMaterial({opacity:.16}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-.001;shadow.receiveShadow=true;this.content.add(shadow);
    this.previewCamera=new THREE.PerspectiveCamera(45,1,.005,40);this.previewCamera.layers.enable(1);
    this.previewCamera.position.set(1.2,1,1.6);this.previewCamera.lookAt(.3,0,0);
    this.xrCamera=this.previewCamera.clone();this.ray=new THREE.Raycaster();
    this.dialog=document.createElement('dialog');this.dialog.id='ar-dialog';
    this.dialog.innerHTML='<div class="dialog-top"><strong>Bring your scene into the room</strong><button id="ar-cancel" aria-label="Close AR options">Close</button></div><p id="ar-support" role="status">Checking this browser…</p><div class="ar-choice-art" aria-hidden="true">⌗ <span>DuckFly</span> ↗</div><button id="ar-start" class="primary" disabled>Start surface AR</button><button id="ar-camera" disabled>Use camera preview</button><p class="hint">The duck sees virtual objects in its scene. Real furniture is not part of the physics simulation. Camera preview has no room tracking.</p>';
    this.root=document.createElement('section');this.root.id='ar-view';this.root.hidden=true;this.root.setAttribute('aria-label','AR scene');
    this.root.innerHTML=[
      '<div id="ar-viewport"><video id="ar-video" autoplay muted playsinline></video></div>',
      '<header class="ar-top"><button id="ar-exit">← Studio</button><div><strong id="ar-title">AR scene</strong><span id="ar-mode-label"></span></div><button id="ar-run" class="primary" disabled>Run</button><button id="ar-step" title="Advance 0.1 seconds, then pause" disabled>Step</button></header>',
      '<aside class="ar-monitor"><div class="ar-monitor-heading"><strong>Fly brain</strong><select id="ar-duck" aria-label="Duck to watch in AR"></select></div><div id="ar-brain-slot"></div><p id="ar-neural-readout">Waiting for input</p><details><summary>Duck view & senses</summary><div id="ar-eye-slot"></div><p id="ar-senses-readout"></p><span>Virtual scene camera</span></details></aside>',
      '<div class="ar-bottom"><p id="ar-status" role="status">Find a clear horizontal surface.</p><button id="ar-place" class="primary" disabled>Place scene & run</button>',
      '<details id="ar-tools"><summary>Objects & placement</summary><div class="ar-tools-content"><div class="ar-form-row"><label>Add<select id="ar-kind"></select></label><label>Physics<select id="ar-profile"><option value="fixed">Fixed in place</option><option value="pushable">Pushable</option><option value="heavy">Heavy</option><option value="slippery">Slippery</option><option value="patrol">Move back and forth</option><option value="orbit">Move in a circle</option></select></label></div><button id="ar-add" disabled>Place new object</button>',
      '<label>Selected object<select id="ar-object"></select></label><div class="ar-form-row"><button id="ar-move" disabled>Move selected</button><button id="ar-remove" disabled>Remove</button></div><button id="ar-physics" disabled>Apply physics to selected</button>',
      '<div class="ar-form-row"><label>Display scale<select id="ar-scale"><option value="0.25">¼ size</option><option value="0.5">½ size</option><option value="1" selected>Life size</option><option value="2">2× size</option></select></label><button id="ar-rotate">Rotate scene 45°</button></div><div class="ar-form-row"><button id="ar-reposition">Place scene again</button><button id="ar-reset">Reset simulation</button></div><p class="hint">Adding a duck or changing physics restarts the controllers at the current positions. Connections stay the same. Edit Brain → duck in the studio.</p></div></details></div>'
    ].join('');
    document.body.append(this.dialog,this.root);
    this.$=id=>this.root.querySelector('#'+id);this.video=this.$('ar-video');
    for(const [id,label]of AR_OBJECTS)this.$('ar-kind').append(option(id,label));
    this.$('ar-kind').onchange=()=>{if(this.$('ar-kind').value==='ball'&&this.$('ar-profile').value==='fixed')this.$('ar-profile').value='pushable';};
    this.dialog.querySelector('#ar-cancel').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('close',()=>{if(!this.active&&this.resumeOnCancel){callbacks.pause(false);this.resumeOnCancel=false;}});
    this.dialog.querySelector('#ar-start').onclick=()=>this.startXR();
    this.dialog.querySelector('#ar-camera').onclick=()=>this.startCamera();
    this.$('ar-exit').onclick=()=>this.stop();
    this.$('ar-run').onclick=()=>{if(this.placed&&this.tracking)callbacks.pause(!callbacks.isPaused());};
    this.$('ar-step').onclick=()=>{if(this.placed&&this.tracking)callbacks.step();};
    this.$('ar-reset').onclick=()=>{callbacks.reset();this.status('Simulation reset. The room placement is unchanged.');};
    this.$('ar-place').onclick=()=>this.place();
    this.$('ar-duck').onchange=e=>callbacks.select(e.target.value);
    this.$('ar-object').onchange=e=>{this.selected=e.target.value;callbacks.select(e.target.value);this.syncControls();};
    this.$('ar-add').onclick=()=>this.arm('add');
    this.$('ar-move').onclick=()=>this.arm('move');
    this.$('ar-remove').onclick=()=>this.perform(()=>callbacks.remove(this.selected));
    this.$('ar-physics').onclick=()=>this.perform(()=>callbacks.physics(this.selected,this.$('ar-profile').value));
    this.$('ar-scale').onchange=e=>{this.scale=Number(e.target.value);this.refreshPlacement();};
    this.$('ar-rotate').onclick=()=>{this.heading+=Math.PI/4;this.refreshPlacement();};
    this.$('ar-reposition').onclick=()=>{callbacks.pause(true);this.placed=false;this.intent=null;this.point=null;this.status('Point at a surface to place this scene again.');this.syncControls();};
    const tools=this.$('ar-tools'),senses=this.root.querySelector('.ar-monitor details');
    tools.addEventListener('toggle',()=>{if(tools.open)senses.open=false;});
    senses.addEventListener('toggle',()=>{if(senses.open)tools.open=false;});
    this.root.addEventListener('beforexrselect',event=>{if(event.target.closest('button,select,details,.ar-monitor'))event.preventDefault();});
    this.$('ar-viewport').addEventListener('pointerup',event=>this.cameraPoint(event));
    this.root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();this.stop();}});
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{if(this.active&&document.hidden){callbacks.pause(true);if(this.mode==='camera')this.stop();}});
    this.probe();
  }
  async probe(message=null) {
    const generation=this.probeGeneration=(this.probeGeneration??0)+1,support=await arSupport();
    if(generation!==this.probeGeneration)return support;
    this.support=support;
    const text=this.dialog.querySelector('#ar-support');text.textContent=message??this.support.reason;
    this.dialog.querySelector('#ar-start').disabled=!this.support.xr;
    this.dialog.querySelector('#ar-camera').disabled=!this.support.camera;
    this.dialog.dataset.xr=String(this.support.xr);return this.support;
  }
  open(message=null) {
    if(this.active||this.dialog.open)return;
    this.resumeOnCancel=!this.callbacks.isPaused();this.callbacks.pause(true);
    this.dialog.showModal();this.probe(message);
  }
  prepare(mode) {
    this.resumeOnCancel=false;this.active=true;this.mode=mode;this.starting=true;this.placed=false;this.tracking=false;this.point=null;this.origin=null;this.intent=null;
    this.saved={follow:this.arena.follow,controls:this.arena.controls.enabled,pixelRatio:this.arena.renderer.getPixelRatio(),xrEnabled:this.arena.renderer.xr.enabled,activeElement:document.activeElement};
    this.callbacks.pause(true);this.dialog.close();this.root.hidden=false;this.root.dataset.mode=mode;
    this.root.dataset.placed='false';this.root.classList.add('is-active');
    document.body.classList.add('ar-active');document.querySelector('#app').inert=true;
    this.arena.follow=false;this.arena.controls.enabled=false;
    this.$('ar-viewport').append(this.arena.renderer.domElement);
    this.returnSlots=[];
    for(const [id,slot]of [['brain-plot','ar-brain-slot'],['eye','ar-eye-slot']]){
      const element=document.getElementById(id),placeholder=document.createComment('AR return '+id);element.before(placeholder);this.returnSlots.push({element,placeholder});this.$(slot).append(element);
    }
    this.$('ar-mode-label').textContent=mode==='xr'?'Surface AR':'Camera preview · no room tracking';
    this.video.hidden=mode!=='camera';this.$('ar-tools').open=false;
    this.status(mode==='xr'?'Starting AR…':'Waiting for camera permission…');
    this.syncControls();this.resize();this.$('ar-exit').focus();
  }
  async startXR() {
    if(this.active)return;
    const generation=++this.generation;this.prepare('xr');let session;
    try{
      session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test','dom-overlay'],optionalFeatures:['local-floor'],domOverlay:{root:this.root}});
      if(generation!==this.generation){await session.end();return;}
      this.session=session;
      session.addEventListener('end',()=>queueMicrotask(()=>{if(this.session===session)this.cleanup();}),{once:true});
      session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible'){this.tracking=false;this.callbacks.pause(true);this.status('Tracking paused. Return to the scene before running.');this.syncControls();}});
      session.addEventListener('select',()=>{if(!this.starting&&(!this.placed||this.intent))this.place();});
      this.arena.renderer.xr.enabled=true;this.arena.renderer.xr.setReferenceSpaceType('local');
      await this.arena.renderer.xr.setSession(session);
      if(generation!==this.generation)return;
      this.referenceSpace=this.arena.renderer.xr.getReferenceSpace();
      this.referenceSpace.addEventListener('reset',()=>{this.placed=false;this.point=null;this.callbacks.pause(true);this.status('The room reference changed. Place the scene again.');this.syncControls();});
      const viewer=await session.requestReferenceSpace('viewer');
      const source=await session.requestHitTestSource({space:viewer});
      if(generation!==this.generation){source.cancel();return;}
      this.hitSource=source;this.starting=false;
      this.status('Move your phone slowly over a floor or table. Place the scene when the ring appears.');
    }catch(error){
      if(generation!==this.generation)return;
      await this.stop();this.open(error.name==='NotAllowedError'?'AR permission was declined. Your scene is still available in the studio.':'This browser could not start surface AR with scene controls. Try camera preview, or open DuckFly in an AR-capable browser.');this.resumeOnCancel=false;
    }
  }
  async startCamera() {
    if(this.active)return;
    const generation=++this.generation;this.prepare('camera');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      if(generation!==this.generation)return;
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(this.stream===stream)this.stop();},{once:true}));
      this.starting=false;this.tracking=true;this.point=[0,0,0];this.fitPreview();
      this.status('Camera preview is not room tracked. Tap the view to choose a position, then place the scene.');this.syncControls();
    }catch(error){
      if(generation!==this.generation)return;
      await this.stop();this.open(error.name==='NotAllowedError'?'Camera permission was declined. Allow it in browser settings to use camera preview.':'The camera could not start. Close other camera apps and try again, or continue in the studio.');this.resumeOnCancel=false;
    }
  }
  status(message) {this.$('ar-status').textContent=message;}
  perform(action) {
    try{this.callbacks.pause(true);const result=action();if(result===false)throw Error('The change could not be applied.');this.status('Scene updated. Press Run when ready.');return result;}
    catch(error){this.status(error.message);return false;}
  }
  arm(kind) {
    if(!this.placed)return;
    this.callbacks.pause(true);this.intent={kind,object:this.selected};
    this.status(kind==='add'?'Aim at a clear point on the same surface, then place the new object.':'Aim at a new point on the same surface, then move the selected object.');
    this.syncControls();
  }
  refreshPlacement() {
    if(this.origin)this.content.matrix.copy(placementMatrix(this.origin,this.scale,this.heading));
  }
  place() {
    if(!this.point||!this.tracking||this.starting)return;
    if(!this.placed){
      this.origin=[...this.point];this.refreshPlacement();this.placed=true;this.intent=null;this.root.dataset.placed='true';
      this.status(this.mode==='xr'?'Scene placed. Walk around it to watch the experiment.':'Scene placed in camera preview. It stays fixed on the screen when you move the phone.');
      this.callbacks.pause(false);
    }else if(this.intent){
      try{
        const point=scenePoint(this.point,this.content.matrix);
        const id=this.intent.kind==='add'?this.callbacks.add(this.$('ar-kind').value,point,this.$('ar-profile').value):this.callbacks.move(this.intent.object,point);
        if(id===false)return;
        if(typeof id==='string')this.selected=id;
        this.intent=null;this.status('Object placed. Press Run to simulate, or add another object.');
      }catch(error){this.status(error.message);}
    }
    this.syncControls();
  }
  cameraPoint(event) {
    if(this.mode!=='camera'||this.starting||event.target!==this.arena.renderer.domElement)return;
    const rect=this.$('ar-viewport').getBoundingClientRect();
    this.previewCamera.updateMatrixWorld(true);
    this.ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.previewCamera);
    const point=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-(this.origin?.[1]??0));
    if(this.ray.ray.intersectPlane(plane,point)&&point.distanceTo(this.previewCamera.position)<15){this.point=point.toArray();this.syncControls();}
  }
  updateXR(frame) {
    if(!frame||!this.referenceSpace||this.starting)return;
    const pose=frame.getViewerPose(this.referenceSpace),tracked=!!pose&&this.session.visibilityState==='visible';
    if(!tracked&&this.tracking){this.callbacks.pause(true);this.status('Tracking lost. Hold the phone still, then press Run after tracking returns.');}
    if(tracked&&!this.tracking&&this.placed)this.status('Tracking restored. Press Run to continue.');
    this.tracking=tracked;this.point=null;
    if(tracked&&this.hitSource){
      for(const result of frame.getHitTestResults(this.hitSource)){
        const hit=result.getPose(this.referenceSpace);if(!hit||!horizontalHit(hit.transform.matrix))continue;
        const matrix=hit.transform.matrix,point=[matrix[12],matrix[13],matrix[14]];
        if(this.placed){try{scenePoint(point,this.content.matrix);}catch{continue;}}
        this.point=point;break;
      }
    }
    this.syncControls();
  }
  render(time,frame) {
    if(!this.active)return false;
    if(this.mode==='xr'){
      if(!this.arena.renderer.xr.isPresenting||!frame)return true;
      this.updateXR(frame);
    }
    const renderer=this.arena.renderer,scene=this.arena.scene;
    this.content.visible=this.placed&&this.tracking;
    this.reticle.visible=!!this.point&&this.tracking&&(!this.placed||!!this.intent);
    if(this.point)this.reticle.position.set(this.point[0],this.point[1]+.003,this.point[2]);
    const floor=this.arena.floor.visible,grid=this.arena.grid.visible,color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
    try{
      this.arena.floor.visible=false;this.arena.grid.visible=false;
      this.content.add(scene);renderer.setClearColor(0x000000,0);
      renderer.render(this.room,this.mode==='xr'?this.xrCamera:this.previewCamera);
    }finally{
      this.content.remove(scene);scene.updateMatrixWorld(true);
      this.arena.floor.visible=floor;this.arena.grid.visible=grid;renderer.setClearColor(color,alpha);
    }
    return true;
  }
  syncControls() {
    this.root.dataset.placed=String(!!this.placed);this.root.dataset.tracking=String(!!this.tracking);
    const ready=this.placed&&this.tracking&&!this.starting;
    this.$('ar-run').disabled=!ready;this.$('ar-run').textContent=this.paused?'Run':'Pause';
    this.$('ar-step').disabled=!ready;this.$('ar-reset').disabled=!this.placed;
    this.$('ar-place').hidden=this.placed&&!this.intent;
    this.$('ar-place').disabled=!this.point||!this.tracking||this.starting;
    this.$('ar-place').textContent=!this.placed?'Place scene & run':this.intent?.kind==='add'?'Place object here':'Move object here';
    this.$('ar-add').disabled=!ready;this.$('ar-move').disabled=!ready||!this.selected;
    const duck=this.scene?.ducks.find(d=>d.id===this.selected),prop=this.scene?.props.find(p=>p.id===this.selected);
    this.$('ar-remove').disabled=!ready||!this.selected||!!duck&&this.scene.ducks.length===1;
    this.$('ar-physics').disabled=!ready||!prop;
    this.$('ar-scale').disabled=!this.placed;this.$('ar-rotate').disabled=!this.placed;this.$('ar-reposition').disabled=this.starting;
  }
  update(scene,state,connectedDuck,selected,paused) {
    this.scene=scene;this.paused=paused;this.selected=selected;
    if(!this.active)return;
    this.$('ar-title').textContent=scene.name;
    const setOptions=(select,items,value)=>{
      const key=JSON.stringify(items);if(select.dataset.key!==key){select.replaceChildren(...items.map(([id,label])=>option(id,label)));select.dataset.key=key;}
      if(document.activeElement!==select)select.value=value;
    };
    setOptions(this.$('ar-duck'),scene.ducks.map(d=>[d.id,d.name]),connectedDuck);
    setOptions(this.$('ar-object'),[...scene.ducks,...scene.props,...scene.fields].map(e=>[e.id,e.name??FIELD_LABELS[e.kind]??e.kind]),selected);
    const a=state?.agents[connectedDuck],senses=a?.input?.senses;
    this.$('ar-neural-readout').textContent=a?.neural?(a.neural.gfHeld?'Stop reflex active':Math.round(a.neural.forward)+' Hz walking activity')+' · '+(paused?'Paused':'Running'):'Waiting for circuit input';
    this.$('ar-senses-readout').textContent=senses?'Scent '+Math.round(senses.scent.strength*100)+'% · Air '+Math.round(senses.air.strength*100)+'% · '+(senses.touch.active?'Touch detected':'No contact'):'Sensors update when the scene runs.';
    this.syncControls();
  }
  resize() {
    if(!this.active||this.arena.renderer.xr.isPresenting)return;
    const {width,height}=this.$('ar-viewport').getBoundingClientRect();if(!width||!height)return;
    this.arena.renderer.setSize(width,height);this.previewCamera.aspect=width/height;this.previewCamera.updateProjectionMatrix();
  }
  fitPreview() {
    const points=[...(this.scene?.ducks??[]).map(d=>new THREE.Vector3(d.spawn[0],.12,-d.spawn[1])),...(this.scene?.props??[]).map(p=>new THREE.Vector3(p.position[0],p.position[2],-p.position[1]))];
    if(!points.length)return;
    const box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3()),radius=Math.max(.5,box.getSize(new THREE.Vector3()).length()/2+.12);
    const angle=Math.atan(Math.tan(THREE.MathUtils.degToRad(this.previewCamera.fov)/2)*Math.min(1,this.previewCamera.aspect));
    const distance=Math.max(1.8,radius/Math.sin(angle));
    this.previewCamera.position.copy(center).add(new THREE.Vector3(.9,.8,1.6).normalize().multiplyScalar(distance));
    this.previewCamera.lookAt(center);this.previewCamera.updateMatrixWorld(true);
  }
  async stop() {
    ++this.generation;
    const session=this.session;
    if(session){try{await session.end();}catch{/* Cleanup also handles a session the browser already ended. */}}
    if(this.active)this.cleanup();
  }
  cleanup() {
    if(!this.active)return;
    ++this.generation;this.callbacks.pause(true);this.hitSource?.cancel();this.hitSource=null;this.referenceSpace=null;this.session=null;
    const stream=this.stream;this.stream=null;stream?.getTracks().forEach(track=>track.stop());this.video.srcObject=null;
    this.active=false;this.mode='off';this.starting=false;this.placed=false;this.tracking=false;this.point=null;this.intent=null;
    for(const {element,placeholder}of this.returnSlots??[]){placeholder.replaceWith(element);}
    this.arena.host.prepend(this.arena.renderer.domElement);this.arena.follow=this.saved.follow;this.arena.controls.enabled=this.saved.controls;
    this.arena.renderer.xr.enabled=this.saved.xrEnabled;this.root.hidden=true;this.root.classList.remove('is-active');this.root.dataset.mode='off';
    document.body.classList.remove('ar-active');document.querySelector('#app').inert=false;
    this.arena.resize();this.arena.home();this.callbacks.redraw();document.querySelector('#view-ar')?.focus();
  }
}
