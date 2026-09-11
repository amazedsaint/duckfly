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
await enterSceneCatalog();
check(
  !$("#home-page").hidden && $("#experiment-page").hidden,
  "App must start on scenario tiles",
);
check(
  document.querySelectorAll("[data-scenario]").length === 18,
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
$('#scene-tree [data-object="target-1"]').click();
check(!$('#tools-panel').hidden && $('#object-editor [data-number="position.0"]'), 'Selecting a prop in Advanced closed the drawer instead of showing its editor');
check(t().connectedDuck === 'duck-2', 'Selecting an Advanced prop replaced the watched brain');
$('#scene-tree [data-object="duck-2"]').click();
check(!$('#tools-panel').hidden && $('#selection-title').textContent === 'Duck 2', 'Selecting a duck in Advanced closed the drawer');
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
// Real Escape events are cancelable. This lets the first handler consume the
// event before the global keyboard shortcuts see it.
const inspectorGeometry = () => {
  const inspector = $('#scene-control-panels'), workspace = $('.workspace');
  const pane = inspector.getBoundingClientRect(), arena = $('#arena').getBoundingClientRect();
  const rail = $('.stage-settings-rail').getBoundingClientRect(), brain = $('#brain-panel').getBoundingClientRect();
  const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const mode = matchMedia('(min-width: 1200px)').matches ? 'docked' : 'drawer';
  check(!inspector.hidden && pane.width > 0 && pane.height > 0, 'Open inspector has no visible geometry');
  check(workspace.dataset.inspectorLayout === mode, 'Inspector layout does not follow the viewport');
  check(!overlaps(pane, brain), 'Inspector covers the connected brain monitor');
  check(pane.bottom <= rail.top + 1, 'Inspector covers the scene settings rail');
  check(inView($('#eye')) && inView($('#brain-plot')), 'Editing hid the connected brain or eyesight');
  check(getComputedStyle(inspector).overflowY === 'auto', 'Inspector is not the shared vertical scroll owner');
  if (mode === 'docked') {
    check(pane.left >= arena.right - 1 && Math.abs(pane.width - 320) < 2, 'Wide inspector is not docked beside the stage');
    check(arena.width >= 240 && arena.height >= 160, 'Docked inspector leaves no usable stage');
  } else {
    check(pane.left >= arena.left - 1 && pane.right <= arena.right + 1, 'Compact inspector leaves the stage boundary');
    check(pane.top - arena.top >= 50, 'Compact inspector covers the whole arena');
    check(pane.bottom <= arena.bottom + 1, 'Compact inspector leaves the arena vertically');
  }
  return {mode, viewport:innerWidth, inspectorWidth:Math.round(pane.width), arenaWidth:Math.round(arena.width), nativePaintVerified:false};
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
const inspector = $('#scene-control-panels'), tools = $('#tools-panel'), objectEditor = $('#object-editor');
check(tools.parentElement === inspector && document.querySelectorAll('#tools-panel').length === 1, 'Advanced controls do not share the mounted inspector slot');
check(inspector.dataset.inspectorIntent === 'objects' && tools.hidden, 'Object intent also shows Advanced controls');
const layoutEvidence = inspectorGeometry();
$('#focus-mode').click();
await settleLayout();
check(inspector.hidden && !$('.workspace').classList.contains('inspector-open'), 'Focus leaves an inspector beside or over the stage');
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
await settleLayout();
check($('#objects-panel').open && !inspector.hidden && inspector.dataset.inspectorIntent === 'objects', 'Focus did not restore the previous object inspector');
$('#tools-button').click();
await settleLayout();
check(!tools.hidden && !$('#objects-panel').open && !$('#brain-mapping-panel').open && inspector.dataset.inspectorIntent === 'advanced', 'Advanced does not replace the current inspector intent');
check($('#selected-object-panel').open && document.activeElement === $('#close-tools'), 'Advanced did not expose its selected object or focus its close control');
inspectorGeometry();
$('#scene-settings-panel').open = true;
await settleLayout();
inspector.scrollTop = Math.min(120, inspector.scrollHeight - inspector.clientHeight);
const inspectorScroll = inspector.scrollTop;
check(inspectorScroll > 0 && getComputedStyle(tools).overflowY === 'visible', 'Advanced did not use the shared scrolling container');
$('#focus-mode').click();
await settleLayout();
check(inspector.hidden && tools.hidden, 'Focus failed to hide Advanced');
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
await settleLayout();
check(!tools.hidden && inspector.dataset.inspectorIntent === 'advanced' && $('#scene-settings-panel').open, 'Focus did not restore the Advanced inspector and disclosure');
check(Math.abs(inspector.scrollTop - inspectorScroll) < 2, 'Focus lost the Advanced reading position');
check($('#tools-panel') === tools && $('#object-editor') === objectEditor, 'Folding inspectors replaced the mounted editors');
const moreMenu = $('#show-launch').closest('details');
moreMenu.querySelector('summary').click();
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
await settleLayout();
check(!moreMenu.open && !tools.hidden, 'Escape closed the inspector before its open menu');
$('#close-tools').focus({preventScroll:true});
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
await settleLayout();
check(tools.hidden && inspector.hidden && document.activeElement === $('#tools-button'), 'Escape did not close Advanced and return focus');
$('#tools-button').click();
$('#panel-connections').click();
await settleLayout();
check(tools.hidden && $('#brain-mapping-panel').open && inspector.dataset.inspectorIntent === 'connections', 'Connections did not replace Advanced in the inspector');
$('#panel-objects').click();
await settleLayout();
check(!$('#brain-mapping-panel').open && $('#objects-panel').open && inspector.dataset.inspectorIntent === 'objects', 'Object intent left another inspector group open');
$('#panel-objects').click();
await settleLayout();
check(!$('#objects-panel').open, 'Object panel did not collapse');
$('#focus-mode').click();
await settleLayout();
check(document.body.classList.contains('focus-mode'), 'Focus mode did not open');
check(!$('#objects-panel').open && $('#compact-brain').getAttribute('aria-expanded') === 'false', 'Focus mode did not minimize controls');
check(inView($('#eye')) && inView($('#brain-plot')), 'Focus mode hid the brain or eye');
document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
await settleLayout();
check(!document.body.classList.contains('focus-mode'), 'Escape did not leave Focus mode');
check(!$('#objects-panel').open && $('#compact-brain').getAttribute('aria-expanded') === 'true', 'Focus did not restore prior panel state');
check(beforeUI === JSON.stringify({time:t().time,scene:t().scene,ducks:t().ducks,connected:t().connectedDuck}), 'Presentation controls mutated the experiment');
receipt.push({check:'one mounted inspector slot, viewport-appropriate geometry, menu Escape priority, Advanced and object Focus restoration with preserved scroll, unchanged physical state', ...layoutEvidence});
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
