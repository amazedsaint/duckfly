const wait = async (condition, timeout = 30000) => {
  const start = Date.now(),
    waitingAt = new Error().stack;
  while (!condition()) {
    if (Date.now() - start > timeout)
      throw Error(
        "Timed out at " +
          waitingAt +
          " state=" +
          JSON.stringify({
            time: t()?.time,
            paused: t()?.paused,
            scene: t()?.scene?.name,
            screen: t()?.screen,
            last: receipt.at(-1)?.check,
            notice: $("#notice")?.textContent,
          }),
      );
    await new Promise((r) => setTimeout(r, 25));
  }
};
const $ = (s) => document.querySelector(s),
  t = () => window.duckflyTelemetry;
const check = (v, message) => {
  if (!v) throw Error(message);
};
const select = (selector, value) => {
  const el = $(selector);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const preset = async (value) => {
  await loadPresetScene(value);
};
const run = async (seconds) => {
  reportAcceptanceStage("physical run " + seconds + "s");
  const start = t().time;
  $("#pause").click();
  await wait(() => t().time >= start + seconds);
  $("#pause").click();
  await wait(() => t().paused);
  return t();
};
const receipt = [];
await wait(() => t()?.ready);
await preset("target");
let state = await run(4);
check(
  state.ducks[0].position[0] > 0.2 && !state.ducks[0].fallen,
  "Native camera-driven approach failed",
);
receipt.push({
  check: "camera-driven approach",
  position: state.ducks[0].position,
  distance: state.ducks[0].distance,
});
const pausedTime = state.time;
await new Promise((r) => setTimeout(r, 100));
check(t().time === pausedTime, "Pause did not freeze simulation");
select("#eyes", "none");
state = await run(0.25);
check(
  !state.agents["duck-1"].vision.target.visible &&
    state.ducks[0].command[0] === 0,
  "Eye covering failed",
);
receipt.push({ check: "eye intervention" });
await preset("occlusion");
state = await run(0.3);
check(
  !state.agents["duck-1"].vision.target.visible,
  "Physical wall did not occlude target",
);
receipt.push({ check: "wall occlusion" });
await preset("loom");
select("#vision-model", "marker-v1");
$("#pause").click();
await wait(() => t().agents["duck-1"].neural?.event.includes("stop reflex"));
$("#pause").click();
await wait(() => t().paused);
receipt.push({ check: "rendered visual threat", time: t().time });
await preset("flock");
state = await run(2);
check(
  state.ducks.length === 3 &&
    state.ducks
      .slice(1)
      .some((d) => state.agents[d.id].vision.neighbor.visible),
  "Native companion vision failed",
);
receipt.push({ check: "independent ducks and companion vision" });
select("#add-kind", "ball");
$("#add").click();
await wait(() => t().scene.props.some((p) => p.kind === "ball"));
check(
  t().scene.props.find((p) => p.kind === "ball").movable,
  "Ball is not a physical body",
);
await run(1);
const before = t().time;
const ball = t().scene.props.find((p) => p.kind === "ball");
$('[data-number="position.0"]').value = ".35";
$("#move-prop").click();
await wait(
  () => t().scene.props.find((p) => p.id === ball.id).position[0] === 0.35,
);
check(t().time === before, "Moving a prop reset the running experiment");
receipt.push({ check: "physical prop edit preserves time" });
$("#rewind").value = "1";
$("#rewind").dispatchEvent(new Event("change"));
await wait(() => Math.abs(t().time - 0.5) < 1e-8);
$("#branch").click();
await wait(() => t().branch > 0);
receipt.push({ check: "rewind and branch" });
await preset("target");
let mediaRequests = 0,
  synthetic;
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  configurable: true,
  value: async () => {
    mediaRequests++;
    throw new DOMException("Denied test camera", "NotAllowedError");
  },
});
$("#webcam").click();
await wait(() => $("#notice").textContent.includes("Camera unavailable"));
check(mediaRequests === 1, "Camera permission path failed");
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  configurable: true,
  value: async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const c = canvas.getContext("2d");
    const draw = () => {
      c.fillStyle = "#666";
      c.fillRect(0, 0, 96, 64);
      c.fillStyle = "#f02882";
      c.fillRect(28, 20, 18, 20);
    };
    draw();
    synthetic = canvas.captureStream(20);
    window.__nativeCameraTimer = setInterval(draw, 50);
    return synthetic;
  },
});
$("#webcam").click();
await wait(() => $("#webcam").textContent === "Stop webcam");
select("#source", "webcam");
state = await run(1);
check(
  state.agents["duck-1"].vision?.target.visible,
  "Synthetic camera did not reach native adapter: " +
    JSON.stringify(state.agents["duck-1"].vision),
);
$("#webcam").click();
clearInterval(window.__nativeCameraTimer);
check(
  synthetic.getTracks().every((t) => t.readyState === "ended"),
  "Camera tracks not released",
);
receipt.push({
  check: "denied and synthetic webcam paths",
  physicalCameraUsed: false,
});
await preset("target");
const clone = (v) => JSON.parse(JSON.stringify(v));
const base = clone(t().scene);
const load = async (scene) => {
  const transfer = new DataTransfer();
  transfer.items.add(
    new File([JSON.stringify(scene)], "experiment.json", {
      type: "application/json",
    }),
  );
  $("#file").files = transfer.files;
  $("#file").dispatchEvent(new Event("change"));
  await wait(() => t().scene.name === scene.name && t().time === 0);
};
let downloadPromise;
const anchorClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  if (this.download) downloadPromise = fetch(this.href).then((r) => r.json());
  else anchorClick.call(this);
};
state = await run(1.1);
const saved = clone(state);
$("#export").click();
await wait(() => downloadPromise);
const recording = await downloadPromise;
$("#reset").click();
await wait(() => t().time === 0);
const transfer = new DataTransfer();
transfer.items.add(
  new File([JSON.stringify(recording)], "recording.json", {
    type: "application/json",
  }),
);
$("#file").files = transfer.files;
$("#file").dispatchEvent(new Event("change"));
await wait(() => t().time === saved.time);
check(
  JSON.stringify(t().ducks) === JSON.stringify(saved.ducks) &&
    JSON.stringify(t().agents) === JSON.stringify(saved.agents),
  "Native recording import changed body or neural state",
);
$("#inspect-event").click();
check(
  $("#event-time").textContent.includes("tick " + saved.tick),
  "Native causal inspector tick mismatch",
);
$('[data-close="event-dialog"]').click();
receipt.push({
  check: "recording export/import and same-tick inspector",
  time: saved.time,
});
for (const kind of ["odor", "light"]) {
  const signals = [];
  for (const strength of [0, 3]) {
    const scene = clone(base);
    scene.name = kind + "-" + strength;
    scene.ducks[0].mode = kind;
    scene.props = [
      {
        id: "surface",
        kind: "wall",
        color: "#eeeeee",
        position: [0.6, 0, 0.2],
        size: [0.05, 1, 0.4],
      },
    ];
    scene.fields = [
      { id: "field", kind, position: [0.25, 0.25], strength, radius: 0.6 },
    ];
    await load(scene);
    state = await run(0.14);
    signals.push(state.agents["duck-1"].input.forward);
  }
  check(
    signals[1] > signals[0] + 0.001,
    "Native " + kind + " field has no sensory effect",
  );
  receipt.push({ check: kind + " field response", signals });
}
const challenge = clone(base);
challenge.name = "Native prop challenge";
challenge.ducks[0].silence = "output";
challenge.props = [
  {
    id: "goal-ball",
    kind: "ball",
    position: [0.5, 0.25, 0.08],
    size: [0.12, 0.12, 0.12],
    movable: true,
    mass: 0.05,
  },
];
challenge.challenge = {
  duration: 1,
  goal: [0.5, 0.25],
  radius: 0.15,
  subject: "goal-ball",
};
await load(challenge);
$("#pause").click();
await wait(() => t().time >= 1.2);
check(!t().paused, "Imported scenes must remain open after their observation window");
$("#pause").click();
await wait(() => t().paused);
check(
  t().scores["goal-ball"].reachedAt !== null && t().props[0].position[2] < 0.08,
  "Native prop challenge failed",
);
receipt.push({
  check: "physical prop goal in an open-ended scene",
  time: t().time,
});
await load({ ...base, name: "Native batch source" });
for (const job of ["compare", "learn"]) {
  reportAcceptanceStage("workspace " + job);
  downloadPromise = null;
  $("#" + job).click();
  await wait(() => !$("#save-report").hidden, 180000);
  $("#save-report").click();
  await wait(() => downloadPromise);
  const report = await downloadPromise;
  check(
    report.format ===
      (job === "compare" ? "duckfly-comparison" : "duckfly-adapter"),
    "Native batch report missing",
  );
  $("#close-job").click();
  await wait(() => t().scene.name === "Native batch source" && t().time === 0);
  receipt.push({ check: "native " + job, report });
}
HTMLAnchorElement.prototype.click = anchorClick;
await preset("target");
return receipt;
