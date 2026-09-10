import * as THREE from "three";
import { Arena } from "../arena.js";
import { EYE_WIDTH as W, EYE_HEIGHT as H } from "./vision.js";
import { framePacket, EYE_CALIBRATION } from "../../../shared/vision/frame.js";
import { COLORS } from "./scene.js";
import { propPosition } from "./prop-behavior.js";
export class LabArena extends Arena {
  constructor(host, assets) {
    super(host, assets);
    this.follow = false;
    this.selected = "duck-1";
    this.ducks = new Map();
    this.props = new Map();
    this.fields = [];
    this.body = null;
    this.target.set(0.3, 0.12, 0);
    this.camera.position.set(1.15, 0.7, 1.15);
    this.controls.target.copy(this.target);
    this.controls.maxDistance = 12;
    this.robot.forEach((mesh) => this.scene.remove(mesh));
    this.scene.fog.far = 12;
    this.scene.fog.near = 6;
    // Selection graphics are a UI layer; eye cameras must never see them.
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.085, 0.092, 48),
      new THREE.MeshBasicMaterial({
        color: 0x548962,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.layers.set(1);
    this.camera.layers.enable(1);
    this.scene.add(this.selectionRing);
    this.propOutline = new THREE.BoxHelper(new THREE.Object3D(), 0x587b46);
    this.propOutline.layers.set(1);
    this.propOutline.visible = false;
    this.scene.add(this.propOutline);
    this.motionPath = new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0x437fac,dashSize:.025,gapSize:.02,transparent:true,opacity:.8}));
    this.motionPath.layers.set(1);this.motionPath.visible=false;this.scene.add(this.motionPath);
    this.installPropDragging();
    this.renderer.setAnimationLoop(() => {
      if (!this.host.clientWidth || !this.host.clientHeight) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }
  installPropDragging() {
    const canvas = this.renderer.domElement,
      ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let drag, duckClick;
    const cast = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      );
      ray.setFromCamera(pointer, this.camera);
    };
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        cast(event);
        const candidates = [
          ...this.props.values(),
          ...[...this.ducks.values()].flatMap((d) => d.meshes),
        ];
        const hit = ray.intersectObjects(candidates, false)[0];
        if (!hit) return;
        const clickedDuck = [...this.ducks].find(([, d]) =>
          d.meshes.includes(hit.object),
        );
        if (clickedDuck) {
          duckClick = {
            id: clickedDuck[0],
            x: event.clientX,
            y: event.clientY,
          };
          return;
        }
        const id = [...this.props].find(([, mesh]) => mesh === hit.object)[0],
          position = hit.object.position.clone();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -position.y),
          point = new THREE.Vector3();
        if (!ray.ray.intersectPlane(plane, point)) return;
        drag = {
          id,
          object: hit.object,
          position,
          plane,
          offset: position.clone().sub(point),
          pointerId: event.pointerId,
        };
        this.draggedProp = id;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        this.onPropDragStart?.(id);
      },
      true,
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (!drag) {
          cast(event);
          const hit = ray.intersectObjects(
            [
              ...this.props.values(),
              ...[...this.ducks.values()].flatMap((d) => d.meshes),
            ],
            false,
          )[0];
          canvas.style.cursor = hit ? "pointer" : "";
          return;
        }
        cast(event);
        const point = new THREE.Vector3();
        if (!ray.ray.intersectPlane(drag.plane, point)) return;
        point.add(drag.offset);
        point.x = THREE.MathUtils.clamp(point.x, -10, 10);
        point.z = THREE.MathUtils.clamp(point.z, -10, 10);
        drag.object.position.copy(point);
        this.propOutline.setFromObject(drag.object);
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    const finish = (event, cancelled) => {
      if (!drag) {
        if (
          duckClick &&
          !cancelled &&
          Math.hypot(event.clientX - duckClick.x, event.clientY - duckClick.y) <
            6
        )
          this.onDuckSelect?.(duckClick.id);
        duckClick = null;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = drag;
      drag = null;
      this.draggedProp = null;
      this.controls.enabled = true;
      canvas.style.cursor = "";
      if (canvas.hasPointerCapture(current.pointerId))
        canvas.releasePointerCapture(current.pointerId);
      if (cancelled) {
        current.object.position.copy(current.position);
        this.onPropDragCancel?.();
      } else {
        const p = current.object.position;
        this.onPropDrop?.(current.id, [p.x, -p.z, p.y]);
      }
    };
    canvas.addEventListener("pointerup", (event) => finish(event, false), true);
    canvas.addEventListener(
      "pointercancel",
      (event) => finish(event, true),
      true,
    );
  }
  setSelection(duckId, objectId) {
    this.selected = duckId;
    this.selectedObject = objectId;
    const prop = this.props.get(objectId);
    this.propOutline.visible = !!prop;
    if (prop) this.propOutline.setFromObject(prop);
    const definition=this.definition?.props.find(p=>p.id===objectId),behavior=definition?.behavior;
    this.motionPath.visible=!!behavior;
    const key=JSON.stringify([objectId,definition?.position,behavior]);
    if(behavior&&key!==this.pathKey){
      const duration=2*Math.PI*behavior.range/behavior.speed;
      const points=Array.from({length:81},(_,i)=>{const p=propPosition(definition,behavior.startedAt+i/80*duration);return new THREE.Vector3(p[0],p[2],-p[1]);});
      this.motionPath.geometry.dispose();this.motionPath.geometry=new THREE.BufferGeometry().setFromPoints(points);this.motionPath.computeLineDistances();
    }
    this.pathKey=key;
    const body = this.body?.ducks.find((d) => d.id === duckId);
    if (body)
      this.selectionRing.position.set(
        body.position[0],
        0.002,
        -body.position[1],
      );
  }
  setScene(scene) {
    this.definition = scene;
    this.fitPending = true;
    const hasLight = scene.fields.some((f) => f.kind === "light");
    this.key.intensity = hasLight ? 0.4 : 3.5;
    this.scene.children.find((c) => c.isHemisphereLight).intensity = hasLight
      ? 0.3
      : 2.5;
    for (const d of this.ducks.values()) {
      this.scene.remove(d.group);
      d.target.dispose();
      d.marker.traverse((o) => o.geometry?.dispose());
      d.marker.material.dispose();
    }
    for (const p of this.props.values()) {
      this.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    }
    for (const f of this.fields) {
      this.scene.remove(f);
      f.geometry?.dispose();
      f.material?.dispose();
    }
    this.ducks.clear();
    this.props.clear();
    this.fields = [];
    for (const duck of scene.ducks) {
      const group = new THREE.Group(),
        meshes = this.robot.map((mesh) => {
          const clone = mesh.clone();
          clone.visible = true;
          group.add(clone);
          return clone;
        });
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 12, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.neighbor }),
      );
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0015, 0.0015, 0.065, 6),
        marker.material,
      );
      stem.rotation.z = Math.PI / 2;
      stem.position.x = -0.0325;
      marker.add(stem);
      group.add(marker);
      this.scene.add(group);
      const camera = new THREE.PerspectiveCamera(75, W / H, 0.004, 12),
        target = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true });
      // Readback pixels use the same sRGB encoding as webcam ImageData.
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const eyes = [camera.clone(), camera.clone()];
      this.ducks.set(duck.id, { group, meshes, marker, camera, eyes, target });
    }
    for (const prop of scene.props) {
      const sphere = ["ball", "target"].includes(prop.kind);
      const mesh = new THREE.Mesh(
        sphere
          ? new THREE.SphereGeometry(prop.size[0] / 2, 24, 16)
          : new THREE.BoxGeometry(...prop.size),
        prop.kind === "target"
          ? new THREE.MeshBasicMaterial({ color: prop.color })
          : new THREE.MeshStandardMaterial({
              color: prop.color,
              roughness: 0.75,
            }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.props.set(prop.id, mesh);
    }
    for (const f of scene.fields) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(f.radius, 48),
        new THREE.MeshBasicMaterial({
          color: f.kind === "odor" ? 0x76c79c : 0xf5d98b,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(f.position[0], 0.002, -f.position[1]);
      this.scene.add(disc);
      this.fields.push(disc);
      if (f.kind === "light") {
        const light = new THREE.PointLight(
          0xffdda5,
          f.strength * 0.18,
          f.radius * 3,
        );
        light.position.set(f.position[0], 0.25, -f.position[1]);
        this.scene.add(light);
        this.fields.push(light);
      }
    }
    const goal = new THREE.Mesh(
      new THREE.RingGeometry(
        Math.max(0.005, scene.challenge.radius - 0.008),
        scene.challenge.radius,
        48,
      ),
      new THREE.MeshBasicMaterial({
        color: 0x628c6d,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    goal.rotation.x = -Math.PI / 2;
    goal.position.set(scene.challenge.goal[0], 0.002, -scene.challenge.goal[1]);
    this.scene.add(goal);
    this.fields.push(goal);
  }
  pose(object, p) {
    object.position.set(p[0], p[2], -p[1]);
    object.quaternion.set(p[4], p[5], p[6], p[3]).premultiply(this.conversion);
  }
  updateLab(body) {
    this.body = body;
    for (const s of body.ducks) {
      const duck = this.ducks.get(s.id);
      if (!duck) continue;
      s.poses.forEach((p, i) => this.pose(duck.meshes[i], p));
      this.pose(duck.camera, s.cameraPose);
      duck.eyes.forEach((eye, i) => {
        this.pose(eye, s.cameraPose);
        eye.translateX(i === 0 ? -0.018 : 0.018);
        eye.rotateY(
          ((i === 0 ? 1 : -1) * EYE_CALIBRATION.eyeYaw * Math.PI) / 180,
        );
      });
      this.pose(duck.marker, s.headPose);
      duck.marker.translateX(0.08);
      duck.marker.translateZ(0.025);
    }
    for (const p of body.props) {
      const object = this.props.get(p.id);
      if (object && this.draggedProp !== p.id)
        this.pose(object, [...p.position, ...p.quaternion]);
    }
    const selected =
      body.ducks.find((d) => d.id === this.selected) ?? body.ducks[0];
    if (selected) {
      const next = new THREE.Vector3(
        selected.position[0],
        0.12,
        -selected.position[1],
      );
      if (this.follow) {
        const delta = next.clone().sub(this.target).multiplyScalar(0.2);
        this.camera.position.add(delta);
        this.controls.target.add(delta);
      }
      this.target.copy(next);
      this.key.position.copy(next).add(new THREE.Vector3(0.5, 1, 0.6));
      this.key.target.position.copy(next);
    }
    this.setSelection(this.selected, this.selectedObject);
    if (this.fitPending) {
      this.home();
      this.fitPending = false;
    }
  }
  captureEyes(time = this.body?.time ?? 0, frameId = Math.round(time * 50)) {
    const frames = {};
    const read = (duck, camera) => {
      this.renderer.setRenderTarget(duck.target);
      this.renderer.render(this.scene, camera);
      const raw = new Uint8Array(W * H * 4);
      this.renderer.readRenderTargetPixels(duck.target, 0, 0, W, H, raw);
      const pixels = new Uint8Array(raw.length);
      for (let y = 0; y < H; y++)
        pixels.set(
          raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4),
          y * W * 4,
        );
      return pixels;
    };
    try {
      for (const [id, duck] of this.ducks) {
        duck.group.visible = false;
        try {
          const pixels = read(duck, duck.camera),
            definition = this.definition.ducks.find((d) => d.id === id);
          const views =
            definition.visionModel === "marker-v1" && definition.temporal === "off"
              ? undefined
              : {
                  left: read(duck, duck.eyes[0]),
                  right: read(duck, duck.eyes[1]),
                };
          frames[id] = framePacket({
            pixels,
            views,
            sourceId: `eyes:${id}`,
            frameId,
            captureTime: time,
            simulationTime: time,
            pose: this.body?.ducks.find((d) => d.id === id)?.cameraPose,
          });
        } finally {
          duck.group.visible = true;
        }
      }
    } finally {
      this.renderer.setRenderTarget(null);
    }
    return frames;
  }
  home() {
    if (!this.controls) return;
    const points = [
      ...(this.body?.ducks ?? []),
      ...(this.body?.props ?? []),
    ].map(
      (d) => new THREE.Vector3(d.position[0], d.position[2], -d.position[1]),
    );
    if (points.length) {
      const bounds = new THREE.Box3()
          .setFromPoints(points)
          .expandByScalar(0.12),
        center = bounds.getCenter(new THREE.Vector3()),
        radius = bounds.getSize(new THREE.Vector3()).length() / 2;
      const distance =
        (radius /
          Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) /
          Math.min(1, this.camera.aspect)) *
        1.05;
      this.camera.position
        .copy(center)
        .add(
          new THREE.Vector3(0.9, 0.7, 1)
            .normalize()
            .multiplyScalar(Math.max(0.65, distance)),
        );
      this.controls.target.copy(center);
    } else {
      this.camera.position
        .copy(this.target)
        .add(new THREE.Vector3(0.8, 0.55, 0.8));
      this.controls.target.copy(this.target);
    }
    this.controls.update();
  }
  resize() {
    const previous = this.camera.aspect;
    super.resize();
    if (
      this.body &&
      Math.max(previous / this.camera.aspect, this.camera.aspect / previous) >
        1.3
    )
      this.home();
  }
}
