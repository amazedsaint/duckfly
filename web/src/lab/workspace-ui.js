import { SCENARIOS } from "./scenarios.js";
export function workspaceShell(W, H) {
  return `
<header class="topbar"><button class="brand" id="home-button" aria-label="DuckFly home"><img src="/duck.svg" alt="">DuckFly</button><span class="platform" id="platform">A fly circuit. A duck body.</span><div class="top-actions"><button id="share">Share scene</button><details class="app-menu"><summary>More</summary><div class="menu-content"><button id="room-button">Collaborate</button><button id="save">Save scene</button><button id="open">Open file</button><button id="about">About the experiment</button></div></details></div></header>
<main id="home-page" class="home-page">
<div class="home-intro"><span class="eyebrow">THE DUCKFLY PLAYGROUND</span><h1>A fly brain. A duck’s world.</h1><p>Give a duck a fly’s neural circuit. Change what it sees, and watch how its body responds.</p><div class="home-meta"><span id="home-status" role="status">Preparing your playground…</span><button id="continue-scene" hidden>Continue your scene</button></div></div>
<div class="section-heading"><h2>Choose an experiment</h2><span>Open a scene and start playing</span></div>
<div class="scenario-grid">${SCENARIOS.map((s, i) => `<button class="scenario-tile" data-scenario="${s.id}" data-control disabled><div class="scenario-image"><img src="/scenarios/${s.id}.png" alt="${s.alt}"><span class="tile-tag">${s.tag}</span></div><div class="tile-copy"><span class="tile-number">EXPERIMENT ${String(i + 1).padStart(2, "0")}</span><h3>${s.title}</h3><p>${s.description}</p><span class="tile-launch">${s.action}<span aria-hidden="true">↗</span></span></div></button>`).join("")}</div>
<footer class="home-footer"><span>Runs on your device. No account needed.</span><span>A modeled vision adapter connects a 668-neuron fly circuit to Microduck.</span></footer>
</main>
<main id="experiment-page" hidden>
<header class="experiment-heading"><button id="back-home" aria-label="Back to scenarios">← Scenarios</button><div><h1 id="arena-title">Follow the beacon</h1><p id="scenario-guide">Move the pink beacon. Watch the duck respond.</p></div></header>
<div class="toolbar"><button id="pause" class="primary" data-control disabled>▶ Run</button><button id="reset" data-control disabled>Reset</button><span id="clock">0.00 s</span><span class="toolbar-spacer"></span><button id="tools-button" aria-expanded="false" aria-controls="tools-panel">Scene tools</button></div>
<div class="lab-layout">
<section class="workspace"><div id="arena" class="arena" aria-label="Physical experiment arena"><div class="arena-label"><span id="connected-label">Watching Duck 1</span><span id="live">Paused</span></div><div class="view-actions"><button id="follow" aria-pressed="false">Follow duck</button><button id="view">Fit view</button></div><div id="loading" class="loading"><div class="spinner"></div><strong>Preparing the experiment</strong><span id="loading-detail" role="status">Loading robot geometry</span></div><div class="arena-hint" id="interaction-hint">Drag a prop to move it · Click a duck to see its brain</div></div>
<div class="object-tray"><div id="scene-objects" class="object-chips" aria-label="Objects in the scene"></div><details id="quick-add" class="app-menu"><summary>Add object</summary><div class="menu-content">${[
    ["duck", "Duck"],
    ["target", "Beacon"],
    ["wall", "Wall"],
    ["ball", "Ball"],
    ["block", "Block"],
  ]
    .map(
      ([id, label]) =>
        `<button data-add-kind="${id}" data-control disabled>${label}</button>`,
    )
    .join(
      "",
    )}<span class="hint">Adding an object restarts this scene.</span></div></details></div>
<div id="prop-actions" class="prop-actions" hidden><span id="prop-label"></span><span class="hint">Move</span><button data-prop-step="left" aria-label="Move selected object left">←</button><button data-prop-step="right" aria-label="Move selected object right">→</button><button data-prop-step="near" aria-label="Move selected object closer">↓</button><button data-prop-step="far" aria-label="Move selected object farther">↑</button><button id="edit-object">Edit</button><button id="delete-object">Remove</button></div>
<footer class="statusbar"><span id="status">Loading local engines</span><span id="cost"></span></footer></section>
<aside class="brain-panel" aria-label="Connected duck brain and vision"><div class="brain-heading"><div><span class="eyebrow">CONNECTED TO</span><select id="brain-duck" aria-label="Duck whose brain is shown"></select></div><button id="duck-settings" aria-label="Configure connected duck">Settings</button></div>
<section id="duck-inspector"><section class="vision-card"><div class="eye-heading"><strong>What the duck sees</strong><select id="eye-view" aria-label="Displayed eye"><option value="center">Head</option><option value="left">Left</option><option value="right">Right</option></select></div><div class="eye-frame"><canvas id="eye" width="${W}" height="${H}" aria-label="Selected duck camera and optical flow"></canvas><span id="eye-empty">Run to see through its eyes</span></div><div class="vision-caption"><span id="vision-status">No camera sample</span><label class="inline"><input id="flow-overlay" type="checkbox" checked>Flow</label></div><div class="vision-actions"><button id="cover-eyes" aria-pressed="false" data-control disabled>Cover eyes</button><button id="webcam">Use my camera</button></div></section>
<section class="neural-card"><div class="neural-heading"><strong>Fly brain</strong><span id="brain-connection">668 neurons · connected</span></div><canvas id="brain-plot" aria-label="Fly circuit neural activity"></canvas><div class="neural-legend"><span>Forward</span><span>Turn</span><span>Stop reflex</span></div><canvas id="trace" aria-label="Neural firing history"></canvas><div class="pulse-label">Send a neural pulse</div><div class="pulses">${[
    ["walk", "Walk"],
    ["left", "Turn left"],
    ["right", "Turn right"],
    ["loom", "Stop reflex"],
  ]
    .map(
      ([id, name]) =>
        `<button data-stimulus="${id}" data-control disabled>${name}</button>`,
    )
    .join("")}</div></section>
<section class="body-response"><div class="response-heading"><strong id="body-response">Waiting for visual input</strong><button id="inspect-event" title="Inspect the latest causal event">Why?</button></div><div class="signal-bars"><div><span>Forward <b id="forward">0 Hz</b></span><meter id="forward-meter" min="0" max="150" value="0" aria-label="Forward neuron activity"></meter></div><div><span>Turn <b id="yaw">0 rad/s</b></span><meter id="turn-meter" min="0" max="0.8" value="0" aria-label="Turn command strength"></meter></div></div><span id="metrics">0.00 m/s · 0.00 m</span><span id="tilt" hidden>0°</span><span id="feet" hidden>L · R</span><p id="model-note">Modeled vision → fly circuit → duck walking policy</p></section></section>
</aside>
<aside id="tools-panel" class="tools-panel" aria-label="Scene tools" hidden><div class="panel-title"><h2>Scene tools</h2><button id="close-tools" aria-label="Close scene tools">Close</button></div><details open><summary>Selected object</summary><div class="panel-title"><span id="selection-title">Duck 1</span><button id="remove" aria-label="Remove selected object">Remove</button></div><div id="object-editor"></div><button id="push" data-control disabled>Nudge connected duck</button></details><section class="scene-panel"><div class="panel-title">Scene <span id="object-count"></span></div><input id="scene-name" aria-label="Scene name" maxlength="80"><div id="scene-tree"></div><div class="add-controls"><select id="add-kind" aria-label="Object to add"><option value="duck">Duck</option><option value="target">Target</option><option value="wall">Wall</option><option value="block">Block</option><option value="ball">Ball</option><option value="light">Light field</option><option value="odor">Odor field</option></select><button id="add" data-control disabled>＋ Add</button></div><p class="hint">Shape edits restart the arena. Move props or change controllers to branch from the current state.</p><details class="challenge"><summary>Challenge</summary><label>Score object<select id="challenge-subject"></select></label><label>Duration <input id="duration" type="number" min="1" max="600" step="1"> s</label><div class="pair"><label>Goal X<input id="goal-x" type="number" step=".1"></label><label>Goal Y<input id="goal-y" type="number" step=".1"></label></div><button id="challenge-apply">Apply goal</button><div id="scores"></div></details><details class="challenge"><summary>Experiment tools</summary><button id="vision-bench">Retinal stimulus bench</button><button id="loom-compare" data-control disabled>Looming trials</button><button id="compare" data-control disabled>Compare controllers</button><button id="learn" data-control disabled>Learn sensory adapter</button><p class="hint">Runs isolated camera-based trials. Learning is checked on held-out placements before changing the adapter.</p></details></section>
<details><summary>Recordings & replay</summary><section class="timeline"><div class="timeline-head"><strong>Recording</strong><span id="branch-label">Branch 0</span><span class="toolbar-spacer"></span><button id="export" data-control disabled>Export recording</button><button id="branch" data-control disabled>Branch here</button></div><div class="timeline-track"><span id="timeline-start">0 s</span><input id="rewind" aria-label="Rewind to checkpoint" type="range" min="0" max="0" value="0" step="1"><span id="timeline-end">0 s</span></div><p>Rewind to a checkpoint, then change a cue or controller to branch. Recent history retained; the window scales with duck count.</p></section>
</details><details><summary>Load another preset</summary><select id="preset" aria-label="Experiment preset"><option value="">Choose an experiment</option>${SCENARIOS.map((s) => `<option value="${s.id}">${s.title}</option>`).join("")}</select></details></aside>
</div></main><div id="notice" role="status" hidden></div><input id="file" type="file" accept=".json,application/json" hidden>
`;
}
