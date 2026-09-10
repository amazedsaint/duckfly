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
  const start = t().time;
  $("#pause").click();
  await wait(() => t().time >= start + seconds);
  $("#pause").click();
  await wait(() => t().paused);
  return t();
};
const receipt = [];
await wait(() => t()?.ready);
check(
  !$("#home-page").hidden && $("#experiment-page").hidden,
  "App must start on scenario tiles",
);
check(
  document.querySelectorAll("[data-scenario]").length === 11,
  "Scenario catalog is incomplete",
);
await wait(() =>
  [...document.querySelectorAll(".scenario-image img")].every(
    (i) => i.complete && i.naturalWidth > 0,
  ),
);
await launchScenario("target");
await wait(() => t().time > 0.3 && !t().paused);
check(
  $("#home-page").hidden && !$("#experiment-page").hidden,
  "Tile did not enter the experiment",
);
const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
};
check(
  inView($("#brain-plot")) && inView($("#eye")),
  "Connected brain and eyesight must both be visible",
);
$("#vision-controls").open = true;
$("#cover-eyes").click();
await wait(
  () => t().scene.ducks[0].eye === "none" && t().ducks[0].command[0] === 0,
);
check(
  $("#cover-eyes").textContent === "Uncover eyes",
  "Eye covering has no visible recovery control",
);
$("#cover-eyes").click();
await wait(() => t().scene.ducks[0].eye === "both");
$("#back-home").click();
await wait(() => t().paused);
check(!$("#home-page").hidden, "Back did not return to scenarios");
await launchScenario("flock");
await wait(() => t().ducks.length === 3 && t().time > 0.2);
select("#brain-duck", "duck-2");
check(
  t().connectedDuck === "duck-2" &&
    $("#brain-plot").dataset.duck === "duck-2" &&
    $("#eye").dataset.duck === "duck-2",
  "Selecting another duck did not switch both panels",
);
$('#scene-objects [data-object="target-1"]').click();
check(
  t().connectedDuck === "duck-2" && !$("#duck-inspector").hidden,
  "Selecting a prop disconnected the watched duck",
);
const beforeMove = t().scene.props[0].position[1],
  moveTime = t().time;
$('[data-prop-step="left"]').click();
await wait(() => t().scene.props[0].position[1] > beforeMove + 0.1);
check(
  t().time >= moveTime && t().connectedDuck === "duck-2",
  "Quick prop movement reset time or switched brains",
);
$("#body-details").open = true;
$("#duck-settings").click();
check(
  !$("#tools-panel").hidden && $("#selection-title").textContent === "Duck 2",
  "Duck settings did not target the connected duck",
);
select("#controller", "manual");
await wait(() => t().scene.ducks[1].mode === "manual");
check(
  $("#brain-connection").textContent.includes("bypassed"),
  "Manual control was mislabeled as neural control",
);
$("#close-tools").click();
check($("#tools-panel").hidden, "Scene tools did not close");
$("#pause").click();
await wait(() => t().paused);
receipt.push({
  check:
    "scenario home, reviewed wizard launch, visible vision and brain, eye covering, independent duck selection, prop movement and controller provenance",
});

$('[data-add-kind="duck"]').click();
await wait(() => t().ducks.length === 4);
check(
  t().connectedDuck === t().selected &&
    t().connectedDuck === t().scene.ducks.at(-1).id,
  "Adding a duck did not connect its brain",
);
$("#remove").click();
await wait(() => t().ducks.length === 3);
check(
  t().scene.ducks.some((d) => d.id === t().connectedDuck),
  "Removing the connected duck left a stale brain",
);
$("#back-home").click();
await wait(() => t().paused);
const savedTime = t().time;
$("#continue-scene").click();
check(t().time === savedTime, "Continue restarted the retained scene");
receipt.push({
  check:
    "add duck selects its brain, removal repairs selection, Continue preserves scene",
});

// Folding the workspace must change presentation without touching the experiment.
const settleLayout = async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  $('#experiment-page').getBoundingClientRect();
};
const beforeUI = JSON.stringify({time: t().time, scene: t().scene, ducks: t().ducks, connected: t().connectedDuck});
const widthBefore = $('#arena').getBoundingClientRect().width;
$('#compact-brain').click();
await settleLayout();
check($('#compact-brain').getAttribute('aria-expanded') === 'false', 'Compact state not exposed');
check(inView($('#eye')) && inView($('#brain-plot')), 'Compact mode hid a live monitor');
check($('#arena').getBoundingClientRect().width > widthBefore, 'Compact mode did not give space to the scene');
$('#compact-brain').click();
// The immersive stage starts with panels collapsed. Establish an open panel
// through its visible rail before testing that it closes and stays restored.
if (!$('#objects-panel').open) $('#panel-objects').click();
await settleLayout();
check($('#objects-panel').open, 'Object rail did not open its panel');
$('#panel-objects').click();
await settleLayout();
check(!$('#objects-panel').open, 'Object panel did not collapse');
$('#focus-mode').click();
await settleLayout();
check(document.body.classList.contains('focus-mode'), 'Focus mode did not open');
check(!$('#objects-panel').open && $('#compact-brain').getAttribute('aria-expanded') === 'false', 'Focus mode did not minimize controls');
check(inView($('#eye')) && inView($('#brain-plot')), 'Focus mode hid the brain or eye');
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
await settleLayout();
check(!document.body.classList.contains('focus-mode'), 'Escape did not leave Focus mode');
check(!$('#objects-panel').open && $('#compact-brain').getAttribute('aria-expanded') === 'true', 'Focus did not restore prior panel state');
check(beforeUI === JSON.stringify({time:t().time,scene:t().scene,ducks:t().ducks,connected:t().connectedDuck}), 'Presentation controls mutated the experiment');
$('#panel-objects').click();
await preset('gaze');
await wait(() => t().scene.lab?.id === 'gaze' && !$('#guided-lab').hidden);
check(!$('#guided-lab').hidden, 'Guided experiment missing');
const guidedTime = t().time;
if (!$('#experiment-controls').open) $('#panel-experiment').click();
await settleLayout();
check($('#experiment-controls').open, 'Experiment rail did not open guided controls');
$('#panel-experiment').click();
await settleLayout();
check(!$('#experiment-controls').open && t().time === guidedTime, 'Collapsing guided controls changed simulation time');
$('#panel-experiment').click();
await settleLayout();
check($('#experiment-controls').open && inView($('#eye')) && inView($('#brain-plot')), 'Restoring guided controls lost the live monitor');
receipt.push({check:'compact and Focus layouts preserve the complete paused scene and selected duck; Escape restores panels; guided controls collapse without resetting time'});

return receipt;
