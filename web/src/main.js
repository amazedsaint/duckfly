import { mountPropControls } from "./lab/prop-controls.js";
import { mountSceneSetup } from "./lab/scene-setup.js";
import { mountMappingControls } from "./lab/mapping-controls.js";
import { patchBrainMapping } from "./lab/brain-mapping.js";
import { propProfile } from "./lab/prop-behavior.js";
import { loopStatus } from "./lab/loop-status.js";
import { mountWorkspaceLayout } from "./lab/workspace-layout.js";
import { workspaceShell } from "./lab/workspace-ui.js";
import { mountGuidedLab } from "./lab/guided-ui.js";
import { SCENARIOS } from "./lab/scenarios.js";
import "./style.css";
import "./workspace.css";
import { fetchBytes } from "./assets.js";
import { BrainPlot, trace } from "./plots.js";
import { LabArena } from "./lab/lab-arena.js";
import { ExperimentRoom } from "./lab/room.js";
import {
  defaultScene,
  changeEncounter,
  validateScene,
  encodeScene,
  decodeScene,
} from "./lab/scene.js";
import { WebcamCapture } from "./lab/capture.js";
import { packetBuffers } from "../../shared/vision/frame.js";
import { mountVisionBench } from "./lab/vision-bench.js";
import { EYE_WIDTH as W, EYE_HEIGHT as H } from "./lab/vision.js";
const $ = (s) => document.querySelector(s),
  escapeHTML = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let scene = defaultScene(),
  selected = "duck-1",
  connectedDuck = "duck-1",
  arena,
  plot,
  state,
  ready = false,
  paused = true,
  stream,
  video,
  webcamCapture,
  webcamError = "",
  lastPixels = {},
  samples = [];
try {
  const encoded = new URLSearchParams(location.hash.slice(1)).get("scene");
  if (encoded) scene = decodeScene(encoded);
  else if (localStorage.getItem("duckfly.scene.v1"))
    scene = validateScene(JSON.parse(localStorage.getItem("duckfly.scene.v1")));
} catch (e) {
  webcamError = e.message;
}
$("#app").innerHTML =
  workspaceShell(W, H) +
  `<dialog id="room-dialog"><div class="dialog-top"><strong>Collaborative experiment</strong><button data-close="room-dialog" aria-label="Close collaboration">✕</button></div><p id="room-status">Pair one collaborator. The host runs the shared world; both people can edit props and controllers.</p><div class="pair"><button id="room-host">Create invitation</button><button id="room-join">Join with invitation</button></div><label>Invitation or reply<textarea id="room-input" rows="3" spellcheck="false" placeholder="Paste a pairing code"></textarea></label><button id="room-accept">Accept collaborator reply</button><label>Your pairing code<textarea id="room-output" rows="3" readonly spellcheck="false"></textarea></label><button id="room-copy">Copy pairing code</button><button id="room-leave">Leave room</button><details><summary>Connection settings</summary><p class="hint">Direct WebRTC connection. If your networks require a relay, supply a TURN server. Pair again after a disconnect. Webcam frames are not shared.</p><label>TURN server<input id="turn-url" placeholder="turn:your-server:3478"></label><div class="pair"><label>Username<input id="turn-user" autocomplete="off"></label><label>Password<input id="turn-password" type="password" autocomplete="off"></label></div></details></dialog><dialog id="job-dialog"><div class="dialog-top"><strong id="job-title">Experiment batch</strong><button id="cancel-job">Cancel</button></div><p id="job-progress">Preparing isolated trials</p><progress id="job-meter" max="1" value="0"></progress><div id="job-results"></div><button id="save-report" hidden>Save report</button><button id="close-job" hidden>Close</button></dialog><dialog id="event-dialog"><div class="dialog-top"><strong>Causal inspector</strong><button data-close="event-dialog" aria-label="Close causal inspector">✕</button></div><p id="event-time"></p><div id="event-content"></div><label>Recorded event <input id="event-index" type="range" min="0" max="0" value="0"></label></dialog>
<dialog id="about-dialog"><div class="dialog-top"><strong>About DuckFly</strong><button data-close="about-dialog" aria-label="Close about">✕</button></div><h2>A small circuit in a physical world.</h2><p>Camera pixels become sensory signals for DesktopFly’s 668-neuron FlyWire circuit. Neural activity selects movement intent, and Microduck’s pretrained policy controls the joints. MuJoCo and BAM calculate the physical response.</p><p>The sensory adapters are modeling assumptions. This is not a complete fly nervous system, and the connectome has not learned biped balance. Each duck has independent neural state in a shared physical arena.</p><p>Webcam access is optional. Camera frames stay on this device; exported recordings include the low-resolution frames used by the experiment.</p><p><a href="https://github.com/DenisSergeevitch/desktop-fly" target="_blank" rel="noreferrer">DesktopFly</a> · <a href="https://github.com/pollen-robotics/microduck_rl" target="_blank" rel="noreferrer">Microduck RL</a></p><p class="hint">FlyWire data is CC BY-NC 4.0. <a href="/assets/THIRD_PARTY_NOTICES.md" target="_blank">Source and license notices</a>.</p></dialog>`;
let lastReport,
  room,
  jobBusy = false,
  lastRoomSent = 0,
  remoteSceneKey,
  pendingPropMove;
const worker = new Worker(new URL("./lab/lab.worker.js", import.meta.url), {
  type: "module",
});
const remoteActions = new Set([
  "scene",
  "duck",
  "move-prop",
  "prop-behavior",
  "stimulus",
  "push",
  "skill",
]);
let pauseRequestId = 0, pendingPause;
const send = (type, extra = {}) => {
  if (room?.role === "guest") {
    if (remoteActions.has(type)) {
      if (!room.command({ type, ...extra }))
        notify("Room is disconnected. Pair again to send edits.");
    } else notify("The host controls the simulation clock and recordings.");
    return;
  }
  if(type==='pause'){
    // Retain the requested state until this exact command is acknowledged.
    // A quick wizard reopen can happen before the worker delivers its state.
    pendingPause={id:++pauseRequestId,value:extra.value};
    extra={...extra,pauseRequestId};
  }else if(['scene','reset','step','rewind','import','compare','learn','loom-compare'].includes(type))pendingPause=undefined;
  worker.postMessage({ type, ...extra });
};
let setupSession, pendingSetupSelection;
const physicalSceneKey = value => JSON.stringify({...value, version:undefined, ducks:value.ducks.map(({id,spawn}) => ({id,spawn}))});
const sceneSetup = mountSceneSetup({
  requiresRestart: draft => physicalSceneKey(validateScene(draft)) !== physicalSceneKey(setupSession.original),
  onApply: (draft, {editing, selectedDuckId} = {}) => {
    if (!ready || jobBusy || room?.role === 'guest') {notify('Wait for the local experiment to be ready. A shared room is configured by its host.');return false;}
    const next = validateScene(draft);
    const rebuild = !editing || physicalSceneKey(next) !== physicalSceneKey(setupSession.original);
    const shouldRun = rebuild || setupSession?.wasRunning;
    const nextDuck=next.ducks.some(d=>d.id===selectedDuckId) ? selectedDuckId : next.ducks[0].id;
    if(nextDuck!==connectedDuck){samples=[];plot?.flashes.fill(0);}
    connectedDuck = selected = nextDuck;
    if (rebuild) {
      if (!sceneChanged(next)) return false;
      pendingSetupSelection=connectedDuck;
    } else {
      // Settings are worker actions, so they retain the physical state and enter
      // the recording just like edits made from the live connection panel.
      const patches=new Map();
      for (const duck of next.ducks) {
        const previous=setupSession.original.ducks.find(d=>d.id===duck.id);
        const patch=Object.fromEntries(Object.entries(duck).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(previous[key])));
        if (Object.keys(patch).length) {patches.set(duck.id,patch);send('duck',{id:duck.id,patch});}
      }
      // A last in-flight tick may have advanced a scripted prop while pause was
      // queued. Keep that state rather than restoring the draft's old position.
      scene=validateScene({...scene,version:6,ducks:scene.ducks.map(duck=>patchBrainMapping(duck,patches.get(duck.id)??{}))});
      persistScene();
    }
    setupSession.applied = true;
    setTools(false);
    workspaceLayout.closePanels();
    showExperiment();
    renderScene();renderInspector();
    if (shouldRun) send('pause',{value:false});
    notify(rebuild ? 'Your scene is ready. Select a duck to watch its brain, or drag an object.' : 'Connections updated in this run. The scene clock and physical state were kept.');
    return true;
  },
  onClose: () => {
    if (setupSession?.wasRunning && !setupSession.applied && room?.role !== 'guest') send('pause',{value:false});
    const applied=setupSession?.applied;
    const trigger=setupSession?.trigger;
    setupSession=undefined;
    if(applied)$('#pause').focus();
    else if(trigger?.isConnected)trigger.focus({preventScroll:true});
  },
});
function openSetup(next = scene, editing = true, trigger = document.activeElement) {
  if (!ready || jobBusy) {notify('Wait for the experiment to finish loading or running its comparison.');return;}
  if (room?.role === 'guest') {notify('The host configures the shared scene. You can still edit its objects and duck controls.');return;}
  if (sceneSetup.isOpen()) return;
  setupSession={wasRunning:!(pendingPause?.value??paused),applied:false,original:structuredClone(validateScene(next)),trigger};
  send('pause',{value:true});
  sceneSetup.open(next,{editing,selectedDuckId:editing?connectedDuck:next.ducks[0].id});
}
const updateMappingControls = mountMappingControls({patch:patchConnected,editSetup:()=>openSetup()});
const updateGuidedLab = mountGuidedLab({
  restart: (id, options) => {sceneChanged(id==='stop-go'?changeEncounter(scene,options):defaultScene(id,options));send("pause", {value:false});},
  patch: patchConnected,
  move: (id, position, yaw) => {send("move-prop", {id, position:position.map(v=>Math.max(-10,Math.min(10,v))), yaw});},
  push: id => send("push", {id, strength:2.5}),
  skill: kind => send("skill", {id:connectedDuck,kind}),
  reset: () => {send("reset");send("pause", {value:false});},
  add: kind => addObject(kind),
  selectDuck: id => {$("#brain-duck").value=id;$("#brain-duck").dispatchEvent(new Event("change"));},
  stimulus: kind => stimulate(kind),
  configure: next => {sceneChanged(next);send("pause", {value:false});},
  save: report => download("duckfly-playground-trials.json", report),
});
const updatePropControls = mountPropControls({apply: (id, patch) => {
  const prop=scene.props.find(p=>p.id===id);if(!prop)return;
  const restart=patch.movable!==prop.movable||patch.movable&&(patch.mass!==prop.mass||patch.friction!==prop.friction);
  if(restart){
    const position=state?.body.props.find(p=>p.id===id)?.position??prop.position;
    sceneChanged({...scene,props:scene.props.map(p=>p.id===id?{...p,...patch,position}:p)});
    notify('Physics applied. The scene has restarted; use Run or Step to see the result.');
  }else if(!prop.movable)send('prop-behavior',{id,behavior:patch.behavior});
  else notify('This object already has those physical properties.');
}});
const workspaceLayout = mountWorkspaceLayout({onOpenPanel:()=>setTools(false),onResize: () => {
  arena?.resize();
  plot?.draw();
  if ($("#trace").offsetWidth) trace($("#trace"), samples);
  drawEye();
}});
if (window.duckflyHost)
  $("#platform").textContent = "Mac · on-device playground";
function persistScene() {
  localStorage.setItem("duckfly.scene.v1", JSON.stringify(scene));
  window.webkit?.messageHandlers?.scene?.postMessage(scene);
}
const current = () =>
  scene.ducks.find((d) => d.id === selected) ??
  scene.props.find((p) => p.id === selected) ??
  scene.fields.find((f) => f.id === selected);
function notify(message) {
  $("#notice").textContent = message;
  $("#notice").hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => ($("#notice").hidden = true), 7000);
}
function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sceneChanged(next) {
  try {
    scene = validateScene(next);
    send("scene", { scene });
    persistScene();
    return true;
  } catch (e) {
    notify(e.message);
  }
}
function selectObject(id, revealPanel = true) {
  selected = id;
  if (scene.ducks.some((d) => d.id === id) && connectedDuck !== id) {
    connectedDuck = id;
    samples = [];
    plot?.flashes.fill(0);
  }
  syncConnectedDuck();
  renderScene();
  renderInspector();
  if (state) update(state);
  if(revealPanel&&scene.props.some(p=>p.id===selected))workspaceLayout.openPanel('objects-panel');
  drawEye();
}
function syncConnectedDuck() {
  if (!scene.ducks.some((d) => d.id === connectedDuck))
    connectedDuck = scene.ducks[0].id;
  if (arena) {
    arena.selected = connectedDuck;
    arena.setSelection?.(connectedDuck, selected);
  }
  const duck = scene.ducks.find((d) => d.id === connectedDuck);
  updateMappingControls(duck);
  $("#brain-duck").innerHTML = options(
    scene.ducks.map((d) => [d.id, d.name]),
    connectedDuck,
  );
  $("#connected-label").textContent = "Watching " + duck.name;
  $("#cover-eyes").textContent =
    duck.eye === "none" ? "Uncover eyes" : "Cover eyes";
  $("#cover-eyes").setAttribute("aria-pressed", String(duck.eye === "none"));
  $("#model-note").textContent =
    duck.kickOnSight
      ? "Camera → forward neurons → engineered skill selector → Microduck kick policy"
      : duck.temporal !== "off"
      ? "Research: learned image sequence → fly GF → stop loop. Failed false-alarm gate; not Flyvis."
      : duck.visionModel === "marker-v1"
      ? "Modeled marker vision → fly circuit → walking policy"
      : "Experimental motion adapter → fly circuit → walking policy. Full Flyvis stays in the reference bench.";
  const bypass = ["manual", "reactive", "reflex"].includes(duck.mode);
  $("#brain-connection").textContent = bypass
    ? "668 neurons · control bypassed"
    : !duck.motorEnabled
      ? "668 neurons · body disconnected"
    : duck.silence === "output"
      ? "668 neurons · output silenced"
      : "668 neurons · connected";
  $("#brain-connection").classList.toggle(
    "bypassed",
    bypass || !duck.motorEnabled || duck.silence === "output",
  );
}
function showExperiment() {
  $("#arena").append($("#notice"));
  $("#home-page").hidden = true;
  $("#experiment-page").hidden = false;
  document.body.classList.add("in-experiment");
  $("#continue-scene").hidden = false;
  requestAnimationFrame(() => {
    arena?.resize();
    arena?.home();
    plot?.draw();
    drawEye();
  });
}
function showHome() {
  $("#app").append($("#notice"));
  workspaceLayout.setFocus(false);
  workspaceLayout.closePanels();
  if (ready && room?.role !== "guest") send("pause", { value: true });
  $("#home-page").hidden = false;
  $("#experiment-page").hidden = true;
  document.body.classList.remove("in-experiment");
  setTools(false);
  $("#back-home").blur();
}
function setTools(open) {
  $("#tools-panel").hidden = !open;
  $("#tools-button").setAttribute("aria-expanded", String(open));
  if (open) {
    workspaceLayout.closePanels();
    $("#selected-object-panel").open = true;
    $("#close-tools").focus();
  }
  else if (document.activeElement?.closest("#tools-panel"))
    $("#tools-button").focus();
}
function chooseScenario(id) {
  openSetup(defaultScene(id),false);
}
function patchConnected(patch) {
  scene = validateScene({
    ...scene,
    ducks: scene.ducks.map((d) =>
      d.id === connectedDuck ? patchBrainMapping(d,patch) : d,
    ),
  });
  send("duck", { id: connectedDuck, patch });
  persistScene();
  syncConnectedDuck();
  renderInspector();
  drawEye();
}

function renderScene() {
  syncConnectedDuck();
  $("#scenario-guide").textContent =
    SCENARIOS.find(
      (s) =>
        s.title === scene.name ||
        (s.id === "empty" && scene.name === "Open arena"),
    )?.guide ??
    "Click a duck to watch its brain. Drag props to change what it sees.";
  $("#scene-name").value = scene.name;
  $("#arena-title").textContent = scene.name;
  $("#object-count").textContent =
    scene.ducks.length + scene.props.length + scene.fields.length;
  $("#scene-tree").innerHTML = [
    ["Ducks", scene.ducks],
    ["Props", scene.props],
    ["Sensory fields", scene.fields],
  ]
    .map(
      ([label, items]) =>
        `<div class="tree-group">${label}</div>${items.map((o) => `<button class="tree-item" data-object="${o.id}" aria-pressed="${o.id === selected}"><span>${scene.ducks.includes(o) ? "◈" : o.kind === "light" ? "☀" : o.kind === "odor" ? "◌" : "◇"}</span><span>${escapeHTML(o.name ?? o.kind)}</span><small>${escapeHTML(o.mode ?? o.kind)}</small></button>`).join("")}`,
    )
    .join("");
  $("#scene-objects").innerHTML = [...scene.ducks, ...scene.props]
    .map(
      (o) =>
        `<button class="object-chip" data-object="${o.id}" aria-pressed="${o.id === selected}">${scene.ducks.includes(o) ? '<img src="/duck.svg" alt="">' : `<span class="prop-dot" style="background:${o.color}"></span>`}${escapeHTML(o.name === "target" ? "Beacon" : o.name)}</button>`,
    )
    .join("");
  const prop = scene.props.find((p) => p.id === selected);
  $("#prop-actions").hidden = !prop;
  if (prop)
    $("#prop-label").textContent =
      prop.name === "target" ? "Beacon" : prop.name;
  document
    .querySelectorAll("[data-object]")
    .forEach((el) => (el.onclick = () => {
      const inInspector=!!el.closest('#tools-panel');
      selectObject(el.dataset.object,!inInspector);
      if(inInspector){
        $('#selected-object-panel').open=true;
        $('#selected-object-panel > summary').focus({preventScroll:true});
        $('#tools-panel').scrollTop=0;
      }else $('#scene-objects [data-object="'+CSS.escape(el.dataset.object)+'"]')?.focus({preventScroll:true});
    }));
  $("#challenge-subject").innerHTML = options(
    [["ducks", "Each duck"], ...scene.props.map((p) => [p.id, p.name])],
    scene.challenge.subject,
  );
  $("#goal-x").value = scene.challenge.goal[0];
  $("#goal-y").value = scene.challenge.goal[1];
}
const options = (values, value) =>
  values
    .map(
      ([id, text]) =>
        `<option value="${id}" ${value === id ? "selected" : ""}>${escapeHTML(text)}</option>`,
    )
    .join("");
const numeric = (key, text, value, step = ".01") =>
  `<label>${text}<input data-number="${key}" type="number" value="${value}" step="${step}"></label>`;
function renderInspector() {
  const o = current();
  if (!o) return;
  const duck = scene.ducks.includes(o);
  $("#selection-title").textContent = o.name ?? o.kind;
  $("#remove").disabled = duck && scene.ducks.length === 1;
  $("#duck-inspector").hidden = false;
  let html = "";
  if (duck) {
    html = `<label>Controller<select id="controller">${options(
      [
        ["target", "Follow target"],
        ["flock", "Follow companions"],
        ["brain", "Fly brain pulses"],
        ["reactive", "Reactive comparison"],
        ["reflex", "Motion reflex comparison"],
        ["manual", "Manual"],
        ["light", "Light seeking"],
        ["odor", "Odor seeking"],
      ],
      o.mode,
    )}</select></label><label>Visual model<select id="vision-model">${options(
      [
        ["motion-opponency-v1", "Motion opponency (experimental)"],
        ["marker-v1", "Original marker baseline"],
      ],
      o.visionModel,
    )}</select></label><label>Research stop loop<select id="temporal-loop">${options([["off","Off"],["timer","Temporal adapter + GF timer"],["hold","Temporal adapter + wait until clear"]],o.temporal)}</select></label><label>Vision source<select id="source">${options(
      [
        ["eyes", "Duck-eye camera"],
        ["webcam", "Mac / device webcam"],
      ],
      o.source,
    )}</select></label>${o.source === "webcam" ? '<p class="hint">Show a magenta object to follow. Expanding image motion can trigger loom. Frames stay on this device.</p>' : ""}<div class="pair"><label>Eyes<select id="eyes">${options(
      [
        ["both", "Both eyes"],
        [
          "left",
          o.visionModel === "marker-v1" ? "Left image half" : "Left retina",
        ],
        [
          "right",
          o.visionModel === "marker-v1" ? "Right image half" : "Right retina",
        ],
        ["none", "Both covered"],
      ],
      o.eye,
    )}</select></label><label>Silence<select id="silence">${options(
      [
        ["none", "None"],
        ["output", "All output"],
        ["forward", "DNp09 forward"],
        ["left", "DNa left"],
        ["right", "DNa right"],
        ["loom", "LC / LPLC"],
        ["gf", "Giant Fiber"],
        ["motion", "Motion input"],
        ["lplc2", "LPLC2 bridge"],
      ],
      o.silence,
    )}</select></label></div><label class="check"><input id="active-look" type="checkbox" ${o.activeLook ? "checked" : ""}>Active head looking</label><label class="check"><input id="head-stabilization" type="checkbox" ${o.headStabilization ? "checked" : ""}>Stabilize head yaw</label><label>GF input gain<input id="gf-gain" type="number" min="1" max="12" step=".5" value="${o.gfGain}"></label><p class="hint">Gain is an experimental parameter. Flyvis reference validation is separate from this compact motion baseline.</p><label class="check"><input id="flow-steer" type="checkbox" ${o.flowSteer ? "checked" : ""}>Steer using optical flow</label><label class="check"><input id="feedback" type="checkbox" ${o.feedback ? "checked" : ""}>Motion feedback</label>${o.mode === "manual" ? '<div class="pulses"><button data-manual="walk">↑ Walk</button><button data-manual="stop">■ Stop</button><button data-manual="left">↰ Left</button><button data-manual="right">↱ Right</button></div>' : ""}<details><summary>Starting pose</summary><div class="pair">${numeric("spawn.0", "X (m)", o.spawn[0])}${numeric("spawn.1", "Y (m)", o.spawn[1])}${numeric("spawn.2", "Yaw (rad)", o.spawn[2])}</div><button id="apply-object">Apply and reset</button></details>`;
  } else if (scene.props.includes(o)) {
    html = `<label>Name<input id="object-name" value="${escapeHTML(o.name)}" maxlength="80"></label><div class="pair">${o.position.map((v, i) => numeric("position." + i, ["X (m)", "Y (m)", "Z (m)"][i], v)).join("")}${numeric("yaw", "Yaw (rad)", o.yaw)}</div><details><summary>Physical shape</summary><div class="pair">${o.size.map((v, i) => numeric("size." + i, ["Width / diameter", "Depth", "Height"][i], v)).join("")}${numeric("mass", "Mass (kg)", o.mass)}${numeric("friction", "Friction", o.friction)}</div><label class="check"><input id="movable" type="checkbox" ${o.movable ? "checked" : ""}>Free physical body</label><label>Color<input id="object-color" type="color" value="${o.color}"></label></details><details><summary>Animated motion (m/s)</summary><p class="hint">For fixed props. Free bodies move through physics.</p><div class="pair">${o.motion.map((v, i) => numeric("motion." + i, ["X speed", "Y speed", "Z speed"][i], v)).join("")}</div></details><button id="move-prop">Move in current run</button><button id="apply-object" class="primary">Apply and reset</button>`;
  } else {
    html = `<p class="hint">${o.kind === "odor" ? "A modeled scalar gradient sampled near the head." : "A physical scene light; camera brightness drives the modeled adapter."}</p><div class="pair">${o.position.map((v, i) => numeric("position." + i, ["X (m)", "Y (m)"][i], v)).join("")}${numeric("strength", "Strength", o.strength)}${numeric("radius", "Radius (m)", o.radius)}</div><button id="apply-object" class="primary">Apply and reset</button>`;
  }
  $("#object-editor").innerHTML = html;
  const patch = (value) => {
    scene = validateScene({
      ...scene,
      ducks: scene.ducks.map((d) => (d.id === o.id ? patchBrainMapping(d,value) : d)),
    });
    send("duck", { id: o.id, patch: value });
    persistScene();
    renderScene();
  };
  for (const [selector, key] of [
    ["controller", "mode"],
    ["source", "source"],
    ["eyes", "eye"],
    ["silence", "silence"],
    ["vision-model", "visionModel"],
    ["temporal-loop", "temporal"],
  ])
    if ($("#" + selector))
      $("#" + selector).onchange = (e) => {
        patch({ [key]: e.target.value });
        syncConnectedDuck();
        drawEye();
        if (["controller", "source", "vision-model"].includes(selector))
          renderInspector();
      };
  for (const [selector, key] of [
    ["active-look", "activeLook"],
    ["flow-steer", "flowSteer"],
    ["feedback", "feedback"],
    ["head-stabilization", "headStabilization"],
  ])
    if ($("#" + selector))
      $("#" + selector).onchange = (e) => patch({ [key]: e.target.checked });
  if ($("#gf-gain"))
    $("#gf-gain").onchange = (e) => {
      try {
        patch({ gfGain: Number(e.target.value) });
      } catch (error) {
        notify(error.message);
        renderInspector();
      }
    };
  document.querySelectorAll("[data-manual]").forEach(
    (el) =>
      (el.onclick = () =>
        patch({
          manual: {
            walk: [0.3, 0],
            stop: [0, 0],
            left: [0.25, 0.65],
            right: [0.25, -0.65],
          }[el.dataset.manual],
        })),
  );
  if ($("#move-prop"))
    $("#move-prop").onclick = () => {
      const position = [0, 1, 2].map((i) =>
          Number(
            document.querySelector('[data-number="position.' + i + '"]').value,
          ),
        ),
        yaw = Number(document.querySelector('[data-number="yaw"]').value);
      pendingPropMove = { id: o.id, position };
      send("move-prop", { id: o.id, position, yaw });
    };
  if ($("#apply-object"))
    $("#apply-object").onclick = () => {
      const next = structuredClone(scene),
        object = [...next.ducks, ...next.props, ...next.fields].find(
          (x) => x.id === o.id,
        );
      document.querySelectorAll("[data-number]").forEach((el) => {
        const [key, index] = el.dataset.number.split(".");
        if (index !== undefined) object[key][+index] = Number(el.value);
        else object[key] = Number(el.value);
      });
      if ($("#object-name")) object.name = $("#object-name").value;
      if ($("#movable")) object.movable = $("#movable").checked;
      if ($("#object-color")) object.color = $("#object-color").value;
      if(object.movable){object.behavior=null;object.motion=[0,0,0];}
      else if(object.motion?.some(Boolean))object.behavior=null;
      if(next.lab?.id==='stop-go'&&object.id==='object')next.lab.scripted=false;
      sceneChanged(next);
    };
}
function drawEye() {
  const duck = scene.ducks.find((d) => d.id === connectedDuck);
  if (!duck) return;
  const packet = lastPixels[duck.source === "webcam" ? "webcam" : duck.id],
    view = $("#eye-view").value;
  const pixels =
      packet instanceof Uint8Array
        ? packet
        : (packet?.views?.[view] ?? packet?.pixels),
    canvas = $("#eye"),
    ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  $("#eye-empty").hidden = !!pixels;
  if (pixels)
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), W, H), 0, 0);
  ctx.fillStyle = "#08110d";
  if (
    duck.eye === "none" ||
    (duck.visionModel !== "marker-v1" &&
      view !== "center" &&
      duck.eye !== "both" &&
      duck.eye !== view)
  )
    ctx.fillRect(0, 0, W, H);
  else if (duck.visionModel === "marker-v1")
    if (duck.eye === "left") ctx.fillRect(W / 2, 0, W / 2, H);
    else if (duck.eye === "right") ctx.fillRect(0, 0, W / 2, H);
  const v = state?.agents?.[duck.id]?.vision;
  if (!v) return;
  const object = duck.mode === "flock" ? v.neighbor : v.target;
  if (
    object.visible &&
    (duck.visionModel === "marker-v1" || view === object.view)
  ) {
    ctx.strokeStyle = duck.mode === "flock" ? "#8eefff" : "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(...object.bounds);
  }
  if (
    $("#flow-overlay").checked &&
    (duck.visionModel === "marker-v1" || view === "left")
  ) {
    ctx.strokeStyle = "#d3ff9b";
    ctx.lineWidth = 0.7;
    for (const f of v.flow.vectors) {
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + f.dx * 2, f.y + f.dy * 2);
      ctx.stroke();
    }
  }
}
function update(data) {
  state = data;
  paused = data.paused;
  if(pendingPause?.id===data.pauseRequestId)pendingPause=undefined;
  scene = data.scene;
  if (arena) arena.definition = scene;
  arena?.updateLab(data.body);
  const connectionKey = JSON.stringify([connectedDuck, scene.ducks]);
  if (update.connectionKey !== connectionKey) {syncConnectedDuck();update.connectionKey = connectionKey;}
  updateGuidedLab(scene, data, connectedDuck);
  updatePropControls(scene, data, selected);
  if (
    pendingPropMove &&
    scene.props.some(
      (p) =>
        p.id === pendingPropMove.id &&
        p.position.every((v, i) => v === pendingPropMove.position[i]),
    )
  ) {
    pendingPropMove = null;
    persistScene();
    renderInspector();
  }
  $("#pause").textContent = paused ? "▶ Run" : "Ⅱ Pause";
  $("#step").disabled = !ready || jobBusy;
  $("#clock").textContent = data.body.time.toFixed(2) + " s";
  $("#live").textContent = paused ? "Paused" : "● Running";
  $("#branch-label").textContent =
    `Branch ${data.branch}${data.replaying ? " · replay" : ""}`;
  const s =
      data.body.ducks.find((d) => d.id === connectedDuck) ?? data.body.ducks[0],
    a = data.agents[s.id],
    n = a?.neural;
  $("#metrics").textContent =
    `${s.speed.toFixed(2)} m/s · ${s.distance.toFixed(2)} m · ${data.body.collisionCount} contacts`;
  $("#inspect-event").title = s.fallen
    ? "Duck fell. Try Help stand in Experiment controls."
    : n?.event.includes("stop reflex")
      ? n.event
      : (a?.input?.reason ?? "Paused at starting state");
  $("#forward").textContent = (n?.forward ?? 0).toFixed(1) + " Hz";
  $("#yaw").textContent = s.command[1].toFixed(2) + " rad/s";
  $("#tilt").textContent = s.tilt.toFixed(1) + "°";
  $("#feet").textContent = s.contacts
    .map((c, i) => `${i ? "R" : "L"} ${c ? "●" : "○"}`)
    .join("  ");
  const duck = scene.ducks.find((d) => d.id === s.id);
  const loop = loopStatus(data, s.id);
  $("#body-response").textContent = loop.status;
  $("#vision-status").textContent = loop.perception;
  const pair = values => values ? `${values[0].toFixed(2)} m/s · ${values[1].toFixed(2)} rad/s` : 'No sample yet';
  $("#loop-intent").textContent = pair(loop.neural);
  $("#loop-command").textContent = pair(loop.command);
  $("#loop-speed").textContent = `${loop.speed.toFixed(2)} m/s`;
  $("#loop-feedback").textContent = !loop.feedback ? 'No sample yet' : loop.feedback.enabled ? `${Math.round(loop.feedback.drive*100)}% gait drive` : 'Disconnected';
  $("#loop-reason").textContent = `${loop.reason}${paused ? ` · sampled at ${loop.sampledAt.toFixed(2)} s` : ''}`;
  $("#feedback-loop").textContent = !loop.feedback ? "Run or Step to measure the returning body feedback." : loop.feedback.enabled ?
    `↻ Measured speed sets gait drive to ${loop.feedback.drive.toFixed(2)}; gait phase ${loop.feedback.phase.toFixed(2)} returns to the fly circuit.` :
    '↻ Speed and gait phase feedback to the fly circuit is off. The active Microduck policy still receives body observations.';
  for (const [selector, value, label] of [['#motor-link',duck.motorEnabled,'Body commands'],['#feedback-link',duck.feedback,'Feedback']]) {
    $(selector).setAttribute('aria-pressed', String(value));$(selector).textContent = `${label}: ${value?'on':'off'}`;
  }
  if(document.activeElement!==$("#motor-gain"))$("#motor-gain").value=String(duck.motorGain);
  $("#forward-meter").value = n?.forward ?? 0;
  $("#turn-meter").value = Math.abs(s.command[1]);
  $("#brain-plot").dataset.duck = s.id;
  $("#eye").dataset.duck = s.id;
  $("#cost").textContent =
    `${data.body.ducks.length} duck${data.body.ducks.length > 1 ? "s" : ""} · ${data.body.cost.toFixed(1)} ms physics`;
  $("#status").textContent = stream
    ? "Webcam active · frames stay on this device"
    : paused
      ? "Ready · Space to run"
      : "Running on this device";
  if (!n) {
    plot?.draw();
    if ($("#trace").offsetWidth) trace($("#trace"), []);
  }
  if (n) {
    plot?.draw(n.fired);
    if (data.tick % 2 === 0) {
      samples.push(n);
      if (samples.length > 150) samples.shift();
      if ($("#trace").offsetWidth) trace($("#trace"), samples);
    }
  }
  $("#rewind").max = Math.max(0, data.history.length - 1);
  $("#rewind").value = data.history.findLastIndex((h) => h.tick <= data.tick);
  $("#timeline-start").textContent =
    (data.history[0]?.time ?? 0).toFixed(1) + " s";
  $("#timeline-end").textContent =
    (data.history.at(-1)?.time ?? 0).toFixed(1) + " s";
  $("#scores").innerHTML = (
    scene.challenge.subject === "ducks"
      ? scene.ducks
      : scene.props.filter((p) => p.id === scene.challenge.subject)
  )
    .map((d) => {
      const s = data.scores[d.id];
      return `<p>${escapeHTML(d.name)}: ${s?.reachedAt != null ? "goal at " + s.reachedAt.toFixed(1) + " s" : s ? "closest " + s.minGoalDistance.toFixed(2) + " m" : "waiting"}</p>`;
    })
    .join("");
  if (data.event) {
    events.set(data.event.tick, data.event);
    if (events.size > 1000) events.delete(events.keys().next().value);
  }
  drawEye();
  window.duckflyTelemetry = {
    ready,
    loop,
    connectedDuck,
    selected,
    screen: $("#home-page").hidden ? "experiment" : "home",
    paused,
    time: data.body.time,
    tick: data.tick,
    ducks: data.body.ducks.map((d) => ({
      id: d.id,
      position: d.position,
      headPose: d.headPose,
      cameraPose: d.cameraPose,
      command: d.command,
      distance: d.distance,
      speed: d.speed, tilt: d.tilt, contacts: d.contacts,
      fallen: d.fallen,
    })),
    agents: data.agents,
    props: data.body.props,
    scores: data.scores,
    event: data.event,
    collisions: data.body.collisions,
    collisionCount: data.body.collisionCount,
    history: data.history,
    branch: data.branch,
    scene,
  };
}
const events = new Map();
worker.onmessage = ({ data }) => {
  if(data.type==='prop-behavior-applied'){
    scene=data.scene;if(arena)arena.definition=scene;
    persistScene();renderScene();renderInspector();updatePropControls(scene,state,selected);
  }
  if (data.type === "loading") {
    $("#loading-detail").textContent = data.message;
    $("#home-status").textContent = data.message;
  }
  if (data.type === "error") {
    notify(data.message);
    $("#loading-detail").textContent = data.message;
  }
  if (data.type === "ready") {
    ready = true;
    $("#home-status").textContent = "Ready to explore · runs on your device";
    scene = data.scene;
    arena.setScene(scene);
    if (!current()) selected = scene.ducks[0].id;
    renderScene();
    renderInspector();
    $("#loading").hidden = true;
    document
      .querySelectorAll("[data-control]")
      .forEach((el) => (el.disabled = false));
  }
  if (data.type === "scene") {
    scene = data.scene;
    if(pendingSetupSelection){
      if(scene.ducks.some(duck=>duck.id===pendingSetupSelection))selected=connectedDuck=pendingSetupSelection;
      pendingSetupSelection=undefined;
    }
    arena.setScene(scene);
    if (!current()) selected = scene.ducks[0].id;
    renderScene();
    renderInspector();
    samples = [];
    plot?.flashes.fill(0);
    if ($("#trace").offsetWidth) trace($("#trace"), []);
    plot?.draw();
    lastPixels = {};
    events.clear();
  }
  if (data.type === "recording-view") {
    lastPixels = data.frames;
    events.clear();
    for (const event of data.events) events.set(event.tick, event);
  }
  if (data.type === "state" && room?.role !== "guest") {
    update(data);
    if (
      room?.role === "host" &&
      !jobBusy &&
      (data.paused || performance.now() - lastRoomSent > 100)
    ) {
      room.sendState(data);
      lastRoomSent = performance.now();
    }
  }
  if (data.type === "capture-reset") webcamCapture?.reset();
  if (data.type === "vision-request") {
    arena.updateLab(data.body);
    const frames = arena.captureEyes(data.time, Math.round(data.time * 50));
    const webcam = webcamCapture?.frame(data.time);
    if (webcam) frames.webcam = webcam;
    lastPixels = structuredClone(frames);
    drawEye();
    worker.postMessage(
      { type: "frames", ticket: data.ticket, frames },
      packetBuffers(frames),
    );
  }
  if (data.type === "job-progress") {
    $("#job-progress").textContent = data.label;
    $("#job-meter").max = data.total;
    $("#job-meter").value = data.done;
  }
  if (data.type === "job-result") {
    jobBusy = false;
    lastReport = data.report;
    $("#job-meter").value = $("#job-meter").max;
    $("#job-progress").textContent = data.report.interpretation;
    $("#cancel-job").hidden = true;
    $("#close-job").hidden = false;
    $("#save-report").hidden = false;
    $("#job-results").innerHTML =
      data.report.format === "duckfly-looming-comparison"
        ? loomTable(data.report)
        : data.report.rows
          ? "<table><thead><tr><th>Controller</th><th>Mean score</th><th>Falls</th></tr></thead><tbody>" +
            data.report.rows
              .map(
                (r) =>
                  "<tr><td>" +
                  escapeHTML(r.condition) +
                  "</td><td>" +
                  r.meanScore.toFixed(3) +
                  "</td><td>" +
                  r.trials.filter((t) => t.fallen).length +
                  "</td></tr>",
              )
              .join("") +
            "</tbody></table>"
          : "<p>Held-out improvement: <strong>" +
            data.report.gate.meanGain.toFixed(3) +
            "</strong></p><p>Promotion: <strong>" +
            (data.report.gate.promote ? "passed" : "not passed") +
            "</strong></p><pre>" +
            escapeHTML(JSON.stringify(data.report.weights, null, 2)) +
            "</pre>";
  }
  if (data.type === "job-error") {
    jobBusy = false;
    $("#job-progress").textContent = data.message;
    $("#cancel-job").hidden = true;
    $("#close-job").hidden = false;
  }
  if (data.type === "export")
    download("duckfly-recording.json", data.recording);
};
worker.onerror = (e) => notify(e.message || "Simulation worker failed");
async function load() {
  try {
    const [bytes, circuit] = await Promise.all([
      fetchBytes("/assets/scene.json.gz"),
      fetch("/assets/Brain/circuit.json").then((r) => r.json()),
    ]);
    arena = new LabArena(
      $("#arena"),
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    arena.onDuckSelect = selectObject;
    let resumeAfterDrag = false;
    arena.onPropDragStart = (id) => {
      selectObject(id);
      resumeAfterDrag = !paused && room?.role !== "guest";
      if (resumeAfterDrag) send("pause", { value: true });
    };
    arena.onPropDrop = (id, position) => {
      pendingPropMove = { id, position };
      send("move-prop", {
        id,
        position,
        yaw: scene.props.find((p) => p.id === id).yaw,
      });
      if (resumeAfterDrag) send("pause", { value: false });
      resumeAfterDrag = false;
    };
    arena.onPropDragCancel = () => {
      if (resumeAfterDrag) send("pause", { value: false });
      resumeAfterDrag = false;
    };
    plot = new BrainPlot($("#brain-plot"), circuit);
    renderScene();
    renderInspector();
    send("init", { base: new URL("/", location.href).href, scene });
    if (localStorage.getItem("duckfly.scene.v1"))
      $("#continue-scene").hidden = false;
    if (webcamError) notify(webcamError);
  } catch (e) {
    $("#loading-detail").textContent = e.message;
  }
}
load();
if (new URLSearchParams(location.hash.slice(1)).has("scene")) showExperiment();
$("#pause").onclick = () => {
  send("pause", { value: !(pendingPause?.value??paused) });
};
$("#step").onclick = () => send("step");
$("#motor-link").onclick = () => patchConnected({motorEnabled:!scene.ducks.find(d=>d.id===connectedDuck).motorEnabled});
$("#feedback-link").onclick = () => patchConnected({feedback:!scene.ducks.find(d=>d.id===connectedDuck).feedback});
$("#motor-gain").onchange = e => patchConnected({motorGain:Number(e.target.value)});
$("#reset").onclick = () => send("reset");
$("#view").onclick = () => arena?.home();
$("#follow").onclick = () => {
  arena.follow = !arena.follow;
  $("#follow").setAttribute("aria-pressed", String(arena.follow));
};
$("#preset").onchange = (e) => {
  if (e.target.value) {
    chooseScenario(e.target.value, false);
    e.target.value = "";
  }
};
$("#scene-name").onchange = (e) =>
  sceneChanged({ ...scene, name: e.target.value });
$("#challenge-apply").onclick = () =>
  sceneChanged({
    ...scene,
    challenge: {
      ...scene.challenge,
      subject: $("#challenge-subject").value,
      goal: [Number($("#goal-x").value), Number($("#goal-y").value)],
    },
  });
function addObject(kind, profile) {
  const next = structuredClone(scene),
    id = kind + "-" + Date.now().toString(36);
  if (kind === "duck") {
    let number = scene.ducks.length + 1;
    while (scene.ducks.some((d) => d.name === "Duck " + number)) number++;
    next.ducks.push({
      id,
      name: "Duck " + number,
      spawn: [-0.3 * scene.ducks.length, 0.2, 0],
      mode: "flock",
    });
  } else if (["odor", "light"].includes(kind))
    next.fields.push({
      id,
      kind,
      position: [0.6, 0.2],
      strength: 1,
      radius: 0.5,
    });
  else
    next.props.push({
      id,
      kind,
      position: [0.5, 0.25, kind === "wall" ? 0.15 : 0.06],
      size: kind === "wall" ? [0.06, 0.35, 0.3] : [0.12, 0.12, 0.12],
      movable: kind === "ball",
    });
  if(profile){
    const prop=next.props.find(p=>p.id===id);
    Object.assign(prop,propProfile(profile),{name:profile==='patrol'?'Patrol wall':profile==='orbit'?'Orbiting beacon':'Pushable ball'});
    if(profile==='patrol'){prop.position=[.8,0,.17];prop.size=[.07,.25,.34];}
    if(profile==='orbit')prop.position=[.9,0,.13];
  }
  if (!sceneChanged(next)) return;
  selected = id;
  if (kind === "duck") connectedDuck = id;
  else if(scene.props.some(p=>p.id===selected)){
    updatePropControls(scene,state,selected);
    workspaceLayout.openPanel('objects-panel');
  }
  showExperiment();
  $("#quick-add").open = false;
}
$("#add").onclick = () => addObject($("#add-kind").value);
$("#remove").onclick = () =>
  sceneChanged({
    ...scene,
    challenge: {
      ...scene.challenge,
      subject:
        scene.challenge.subject === selected
          ? "ducks"
          : scene.challenge.subject,
    },
    ducks: scene.ducks.filter((d) => d.id !== selected),
    props: scene.props.filter((d) => d.id !== selected),
    fields: scene.fields.filter((d) => d.id !== selected),
  });
$("#save").onclick = () => download("duckfly-scene.json", validateScene(scene));
$("#share").onclick = async () => {
  const url = new URL(
    window.duckflyHost ? "https://duckfly.vercel.app/" : location.href,
  );
  url.hash = "scene=" + encodeScene(scene);
  try {
    await navigator.clipboard.writeText(url.href);
    notify("Scene link copied. It includes the arena and seed.");
  } catch {
    if (!window.duckflyHost) {
      history.replaceState(null, "", url);
      notify("Scene saved in the address bar. Copy its URL to share.");
    } else notify("Clipboard unavailable. Use Save to share the scene file.");
  }
};
$("#open").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) throw Error("File is too large");
    const value = JSON.parse(await file.text());
    if (value.format === "duckfly-recording")
      send("import", { recording: value });
    else if (value.format === "duckfly-adapter")
      send("weights", { id: connectedDuck, weights: value.weights });
    else sceneChanged(value);
    showExperiment();
  } catch (e) {
    notify(e.message);
  }
  e.target.value = "";
};
$("#export").onclick = () => send("export");
$("#branch").onclick = () => {
  send("branch");
  notify(
    "Future inputs will use the current scene. Change a controller or add a stimulus, then run.",
  );
};
$("#rewind").onchange = (e) => {
  const checkpoint = state.history[+e.target.value];
  if (checkpoint) send("rewind", { tick: checkpoint.tick });
};
function stimulate(kind) {
  send("stimulus", { id: connectedDuck, kind });
  if(paused)notify('Pulse queued for the connected duck. Use Run or Step to advance the brain and body.');
  else if(state?.agents[connectedDuck]?.input?.gate)notify('Pulse sent. The vision gate still blocks forward movement; bring the cue into view or use the direct brain controller.');
}
for (const el of document.querySelectorAll("[data-stimulus]"))
  el.onclick = () => stimulate(el.dataset.stimulus);
$("#push").onclick = () => send("push", { id: connectedDuck });
$("#flow-overlay").onchange = drawEye;
$("#eye-view").onchange = drawEye;
function stopWebcam() {
  webcamCapture?.stop();
  webcamCapture = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  for (const d of scene.ducks.filter((d) => d.source === "webcam")) {
    scene = validateScene({
      ...scene,
      ducks: scene.ducks.map((x) =>
        x.id === d.id ? { ...x, source: "eyes" } : x,
      ),
    });
    send("duck", { id: d.id, patch: { source: "eyes" } });
  }
  persistScene();
  syncConnectedDuck();
  renderInspector();
  if (video) video.srcObject = null;
  $("#webcam").textContent = "Use my camera";
  $("#webcam").classList.remove("active-camera");
  notify("Webcam stopped");
}
$("#webcam").onclick = async () => {
  if (stream) {
    stopWebcam();
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 },
      audio: false,
    });
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    webcamCapture = new WebcamCapture(video);
    $("#webcam").textContent = "Stop webcam";
    $("#webcam").classList.add("active-camera");
    stream
      .getVideoTracks()[0]
      .addEventListener("ended", stopWebcam, { once: true });
    patchConnected({ source: "webcam" });
    notify(
      "Your camera is connected to " +
        scene.ducks.find((d) => d.id === connectedDuck).name +
        ". Frames stay on this device.",
    );
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    notify("Camera unavailable: " + e.message);
  }
};
window.addEventListener("pagehide", () =>
  stream?.getTracks().forEach((t) => t.stop()),
);
$("#about").onclick = () => $("#about-dialog").showModal();
document
  .querySelectorAll("[data-close]")
  .forEach((el) => (el.onclick = () => $("#" + el.dataset.close).close()));
function showEvent(index) {
  const event = [...events.values()].sort((a, b) => a.tick - b.tick)[index];
  if (!event) return;
  $("#event-time").textContent =
    `${event.time.toFixed(2)} s · tick ${event.tick} · branch ${event.branch}`;
  $("#event-content").innerHTML = event.causes
    .map(
      (c) =>
        `<section><h3>${escapeHTML(scene.ducks.find((d) => d.id === c.id)?.name ?? c.id)}</h3><p>${escapeHTML(c.input.reason)}</p><table><tbody><tr><td>Vision</td><td>target ${c.vision?.target.visible ? "seen" : "absent"}, bearing ${(c.vision?.target.bearing ?? 0).toFixed(2)}</td></tr><tr><td>Sensory input</td><td>forward ${c.input.forward.toFixed(3)}, turn ${c.input.turn.toFixed(3)}</td></tr><tr><td>Loom left / right</td><td>${c.input.loomL.toFixed(2)} / ${c.input.loomR.toFixed(2)}</td></tr><tr><td>Neural rates</td><td>DNp09 ${c.neural.forward.toFixed(1)} Hz, DNa ${c.neural.left.toFixed(1)} / ${c.neural.right.toFixed(1)} Hz</td></tr><tr><td>Neural intent</td><td>${c.neural.vx.toFixed(2)} m/s, ${c.neural.yaw.toFixed(2)} rad/s</td></tr><tr><td>Command source</td><td>${escapeHTML(c.provenance?.forward ?? "Legacy recording")}<br>${escapeHTML(c.provenance?.head ?? "Legacy head adapter")}</td></tr><tr><td>Capture</td><td>${escapeHTML(c.vision?.capture?.sourceId ?? "Legacy")} · frame ${c.vision?.capture?.frameId ?? "?"} · ${c.vision?.capture?.captureTime?.toFixed(3) ?? "?"} s capture clock</td></tr><tr><td>Body policy</td><td>${escapeHTML(c.command.policy??"walking")}${c.skill?" · "+escapeHTML(c.skill.message):""}</td></tr><tr><td>Body command</td><td>${c.command.vx.toFixed(2)} m/s, ${c.command.yaw.toFixed(2)} rad/s</td></tr></tbody></table></section>`,
    )
    .join("");
}
$("#inspect-event").onclick = () => {
  $("#event-index").max = Math.max(0, events.size - 1);
  $("#event-index").value = events.size - 1;
  showEvent(events.size - 1);
  $("#event-dialog").showModal();
};
$("#event-index").oninput = (e) => showEvent(+e.target.value);
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
  if (e.key === "Escape" && !$("#tools-panel").hidden) {
    e.preventDefault();
    setTools(false);
    return;
  }
  if (
    $("#home-page").hidden === false ||
    !ready ||
    document.querySelector("dialog[open]") ||
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
      document.activeElement.tagName,
    )
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    $("#pause").click();
  }
});


function loomTable(report) {
  return (
    '<p class="hint">' +
    report.seeds +
    " matched seeds per family · " +
    report.gfGain +
    " GF gain · 3 s observation window. Rates include every trial.</p><table><thead><tr><th>Controller</th><th>Approach contacts</th><th>Missed alarms</th><th>Lateral stops</th><th>Falls</th></tr></thead><tbody>" +
    report.rows
      .map((row) => {
        const approach = row.trials.filter((t) => t.family === "approach"),
          lateral = row.trials.filter((t) => t.family === "lateral-control");
        const contacts = approach.filter(
            (t) => t.firstContactAt !== null,
          ).length,
          misses = approach.filter(
            (t) =>
              t.firstContactAt !== null &&
              (t.stopIntentAt === null || t.stopIntentAt >= t.firstContactAt),
          ).length;
        return (
          "<tr><td>" +
          escapeHTML(row.condition) +
          "</td><td>" +
          contacts +
          "/" +
          approach.length +
          "</td><td>" +
          misses +
          "/" +
          approach.length +
          "</td><td>" +
          lateral.filter((t) => t.stopIntentAt !== null).length +
          "/" +
          lateral.length +
          "</td><td>" +
          row.trials.filter((t) => t.fallen).length +
          "</td></tr>"
        );
      })
      .join("") +
    "</tbody></table><p>Save the report for actual stopping distances and residual travel. The simple target-progress score is not a measure of reflex quality.</p>"
  );
}
function beginJob(type) {
  jobBusy = true;
  const duck =
    scene.ducks.find((d) => d.id === connectedDuck) ?? scene.ducks[0];
  $("#job-title").textContent =
    type === "learn"
      ? "Learn sensory adapter"
      : type === "loom-compare"
        ? "Matched looming trials"
        : "Matched controller comparison";
  $("#job-progress").textContent = "Preparing isolated trials";
  $("#job-results").innerHTML = "";
  $("#job-meter").value = 0;
  $("#cancel-job").hidden = false;
  $("#close-job").hidden = true;
  $("#save-report").hidden = true;
  $("#job-dialog").showModal();
  send(type, {
    id: duck.id,
    intervention: duck.silence === "none" ? "gf" : duck.silence,
  });
}
mountVisionBench($("#vision-bench"));
$("#loom-compare").onclick = () => beginJob("loom-compare");
$("#compare").onclick = () => beginJob("compare");
$("#learn").onclick = () => beginJob("learn");
$("#cancel-job").onclick = () => {
  send("cancel-job");
  $("#job-progress").textContent = "Stopping after the current camera frame";
};
$("#close-job").onclick = () => $("#job-dialog").close();
$("#save-report").onclick = () =>
  download(lastReport.format + ".json", lastReport);

room = new ExperimentRoom({
  onStatus: (info) => {
    $("#room-status").textContent = info.message;
    $("#room-button").textContent =
      info.role === "local" ? "Collaborate" : `Room · ${info.role}`;
    for (const id of [
      "pause",
      "reset",
      "compare",
      "loom-compare",
      "learn",
      "export",
      "branch",
      "rewind",
    ])
      $("#" + id).disabled = info.role === "guest" || !ready;
    window.duckflyRoomTelemetry = { role: info.role, state: info.state };
    if (info.role === "guest")
      worker.postMessage({ type: "pause", value: true });
    if (info.state === "connected" && info.role === "host" && state)
      room.sendState(state);
  },
  onCommand: (command) => {
    if (jobBusy || !command || !remoteActions.has(command.type)) return;
    if (
      command.type === "stimulus" &&
      !["walk", "left", "right", "loom"].includes(command.kind)
    )
      return;
    worker.postMessage(command);
  },
  onState: (data) => {
    if (
      !data?.body ||
      !Array.isArray(data.body.ducks) ||
      data.body.ducks.length > 8
    )
      throw Error("Invalid shared state");
    const next = validateScene(data.scene);
    for (const d of data.body.ducks)
      if (
        !Array.isArray(d.poses) ||
        d.poses.length !== 70 ||
        d.poses.some((p) => p.length !== 7 || !p.every(Number.isFinite))
      )
        throw Error("Invalid shared body pose");
    const key = JSON.stringify(next);
    if (key !== remoteSceneKey) {
      scene = next;
      remoteSceneKey = key;
      arena.setScene(scene);
      if (!current()) selected = scene.ducks[0].id;
      renderScene();
      renderInspector();
    }
    update(data);
    lastPixels = arena.captureEyes();
    drawEye();
    $("#status").textContent = "Shared world · simulation runs on the host";
    window.duckflyRoomTelemetry = {
      role: "guest",
      state: "connected",
      sequence: room.lastSequence,
    };
  },
});
function iceServers() {
  const url = $("#turn-url").value.trim();
  if (url && !/^turns?:[^\s]+$/.test(url))
    throw Error("Use a turn: or turns: server URL");
  return [
    { urls: "stun:stun.l.google.com:19302" },
    ...(url
      ? [
          {
            urls: url,
            username: $("#turn-user").value,
            credential: $("#turn-password").value,
          },
        ]
      : []),
  ];
}
$("#room-button").onclick = () => $("#room-dialog").showModal();
$("#room-host").onclick = async () => {
  try {
    $("#room-output").value = "";
    $("#room-status").textContent = "Gathering connection candidates…";
    $("#room-output").value = await room.invite(iceServers());
    $("#room-status").textContent =
      "Send this invitation. Paste the collaborator reply here, then accept it.";
  } catch (e) {
    notify(e.message);
  }
};
$("#room-join").onclick = async () => {
  try {
    $("#room-output").value = "";
    $("#room-status").textContent = "Preparing a reply…";
    $("#room-output").value = await room.join(
      $("#room-input").value,
      iceServers(),
    );
    $("#room-status").textContent =
      "Return this reply to the host. Keep this window open until connected.";
  } catch (e) {
    notify(e.message);
  }
};
$("#room-accept").onclick = async () => {
  try {
    await room.accept($("#room-input").value);
    $("#room-status").textContent = "Connecting to collaborator…";
  } catch (e) {
    notify(e.message);
  }
};
$("#room-copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#room-output").value);
    notify("Pairing code copied");
  } catch {
    $("#room-output").select();
    notify("Select and copy the pairing code.");
  }
};
$("#room-leave").onclick = () => {
  room.disconnect();
  remoteSceneKey = null;
  worker.postMessage({ type: "scene", scene });
  $("#room-output").value = "";
  $("#room-input").value = "";
};

$("#home-button").onclick = showHome;
$("#new-scene").onclick = event => openSetup({...defaultScene('empty'),name:'Your own playground'},false,event.currentTarget);
$("#back-home").onclick = showHome;
$("#continue-scene").onclick = showExperiment;
for (const tile of document.querySelectorAll("[data-scenario]"))
  tile.onclick = () => chooseScenario(tile.dataset.scenario);
$("#tools-button").onclick = () => setTools($("#tools-panel").hidden);
$("#edit-setup").onclick = () => openSetup();
$("#close-tools").onclick = () => setTools(false);
$("#brain-duck").onchange = (e) => selectObject(e.target.value);
$("#duck-settings").onclick = () => {
  selectObject(connectedDuck);
  setTools(true);
};
$("#cover-eyes").onclick = () =>
  patchConnected({
    eye:
      scene.ducks.find((d) => d.id === connectedDuck).eye === "none"
        ? "both"
        : "none",
  });
for (const el of document.querySelectorAll("[data-add-kind]"))
  el.onclick = () => addObject(el.dataset.addKind);
$("#edit-object").onclick = () => setTools(true);
$("#delete-object").onclick = () => $("#remove").click();
for (const el of document.querySelectorAll("[data-prop-step]"))
  el.onclick = () => {
    const prop = scene.props.find((p) => p.id === selected);
    if (!prop) return;
    const position = [
      ...(state?.body.props.find((p) => p.id === prop.id)?.position ??
        prop.position),
    ];
    const step = {
      left: [0, 0.12],
      right: [0, -0.12],
      near: [-0.12, 0],
      far: [0.12, 0],
    }[el.dataset.propStep];
    position[0] = Math.max(-10, Math.min(10, position[0] + step[0]));
    position[1] = Math.max(-10, Math.min(10, position[1] + step[1]));
    pendingPropMove = { id: prop.id, position };
    send("move-prop", { id: prop.id, position, yaw: prop.yaw });
  };
document.addEventListener("click", (e) => {
  for (const menu of document.querySelectorAll(".app-menu[open]"))
    if (!menu.contains(e.target) || e.target.closest("button"))
      menu.open = false;
});

for(const el of document.querySelectorAll('[data-add-preset]'))el.onclick=()=>{
  const [profile,kind]=el.dataset.addPreset.split('-');addObject(kind,profile);
};
