const $ = selector => document.querySelector(selector);
const t = () => window.duckflyTelemetry;
const clone = value => JSON.parse(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw Error(message); };
const receipts = [];
let stage = 'initialization';
const wait = async (predicate, timeout = 35000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout)
      throw Error('Setup acceptance timed out at ' + stage + ': ' + JSON.stringify({tick:t()?.tick, scene:t()?.scene?.name, paused:t()?.paused, notice:$('#notice')?.textContent}));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const change = (selector, value) => {
  const element = $(selector);
  check(element, 'Missing control ' + selector);
  if (element.type === 'checkbox') element.checked = value;
  else element.value = String(value);
  element.dispatchEvent(new Event('change', {bubbles:true}));
};
const action = name => {
  const button = $(`[data-setup-action="${name}"]`);
  check(button && !button.hidden && !button.disabled, 'Setup action unavailable: ' + name);
  button.click();
};
// Functional acceptance checks computed DOM layout even if a locked display
// suspends painting. Visible browser screenshots cover the actual rendered UI.
const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  $('#experiment-page').getBoundingClientRect();
};
const physicalState = () => JSON.stringify({tick:t().tick, scene:t().scene, ducks:t().ducks, agents:t().agents});
const inView = selector => {
  const r = $(selector).getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
};
const openTile = async id => {
  $(`[data-scenario="${id}"]`).click();
  await wait(() => $('#scene-setup')?.open && t().paused);
};
let downloadPromise;
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const originalConsoleError = console.error;
const errors = [];
const onError = event => errors.push(String(event.error?.stack || event.message));
const onRejection = event => errors.push(String(event.reason?.stack || event.reason));
window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);
console.error = (...args) => { errors.push(args.map(String).join(' ')); originalConsoleError.apply(console, args); };
HTMLAnchorElement.prototype.click = function () {
  if (this.download) downloadPromise = fetch(this.href).then(response => response.json());
  else originalAnchorClick.call(this);
};
const exportJSON = async selector => {
  downloadPromise = null;
  $(selector).click();
  await wait(() => downloadPromise);
  return downloadPromise;
};
const importJSON = async value => {
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(value)], 'setup-test.json', {type:'application/json'}));
  $('#file').files = transfer.files;
  $('#file').dispatchEvent(new Event('change', {bubbles:true}));
};

try {
  await wait(() => t()?.ready);
  check(!$('#home-page').hidden && $('#experiment-page').hidden, 'App did not begin at scenario tiles');
  stage = 'draft cancellation'; reportAcceptanceStage(stage);
  const initial = physicalState();
  await openTile('target');
  check(physicalState() === initial, 'Opening a tile started or replaced the scene before review');
  action('add-duck');
  action('next');
  change('#setup-forward', 'off');
  await new Promise(resolve => setTimeout(resolve, 160));
  check(physicalState() === initial, 'Draft changes leaked into the retained experiment');
  action('cancel');
  await wait(() => !$('#scene-setup').open);
  check(physicalState() === initial && !$('#home-page').hidden, 'Cancelling changed the retained scene or screen');
  receipts.push({check:'tile opens isolated setup; cancellation preserves the scene and neural state'});

  stage = 'build a scene through the wizard'; reportAcceptanceStage(stage);
  await openTile('target');
  action('add-duck');
  change('[data-setup-path="name"]', 'Observer');
  change('[data-setup-path="spawn.0"]', 0);
  change('[data-setup-path="spawn.1"]', -.35);
  change('[data-setup-path="spawn.2"]', 0);
  action('next');
  change('#setup-duck-select', 'duck-2');
  change('#setup-forward', 'off');
  change('#setup-turn', 'off');
  change('#setup-duck-select', 'duck-1');
  check($('#setup-forward').value === 'walk' && $('#setup-turn').value === 'follow', 'Editing the second duck rewired the first duck');
  action('next');
  $('[data-add-prop="ball"]').click();
  change('#setup-prop-profile', 'heavy');
  change('[data-setup-path="position.0"]', .25);
  change('[data-setup-path="position.1"]', 1.15);
  change('[data-setup-path="position.2"]', .28);
  const ballMapId = $('#scene-setup .setup-entity.is-selected').dataset.setupSelect;
  const mapItem = $(`[data-map-entity="${ballMapId}"]`);
  mapItem.focus();
  mapItem.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
  check(Number($('[data-setup-path="position.0"]').value) === .3, 'The visual map did not edit the selected object position');
  change('[data-setup-path="position.0"]', .25);
  change('[data-setup-path="mass"]', 0);
  action('next');
  check($('[data-setup-step="2"]'), 'Invalid object physics passed the wizard validation');
  change('[data-setup-path="mass"]', 1);
  const nameInput = $('[data-setup-path="name"]');
  nameInput.value = 'Practice ball';
  nameInput.dispatchEvent(new Event('input', {bubbles:true}));
  action('next');
  check($('#setup-review').textContent.includes('Observer') && $('#setup-review').textContent.includes('Practice ball'), 'Review omitted added scene members');
  check(physicalState() === initial, 'Review advanced the old simulation');
  $('#setup-scene-name').value = 'Wizard loop study';
  $('#setup-scene-name').dispatchEvent(new Event('input', {bubbles:true}));
  action('apply');
  await wait(() => !$('#scene-setup').open && t().ducks.length === 2 && t().tick >= 150 && !t().paused);
  $('#pause').click();
  await wait(() => t().paused);
  const initialRun = clone(t());
  const ball = t().scene.props.find(p => p.name === 'Practice ball');
  check(t().scene.name === 'Wizard loop study', 'Apply lost the experiment name entered before the click');
  check(t().scene.version === 6, 'An explicit mapping was not saved in scene schema 6');
  check(ball?.movable && ball.mass === 1 && t().props.find(p => p.id === ball.id).position[2] < .1, 'Upfront heavy-body physics did not reach MuJoCo gravity');
  check(t().ducks.every(d => !d.fallen), 'The configured scene fell during its initial run');
  check(t().ducks.find(d => d.id === 'duck-1').distance > .1, 'The default vision-to-walking path did not move the first duck');
  const initialRecording = await exportJSON('#export');
  const firstCommands = initialRecording.events.flatMap(e => e.causes.filter(c => c.id === 'duck-1'));
  const secondCommands = initialRecording.events.flatMap(e => e.causes.filter(c => c.id === 'duck-2'));
  check(firstCommands.some(c => c.command.vx > .2), 'No walking command reached the first duck');
  check(secondCommands.length > 50 && secondCommands.every(c => c.command.vx === 0 && c.command.yaw === 0), 'Disconnected mappings leaked movement commands');
  check(secondCommands.some(c => c.neural.forward > 6), 'The second duck’s circuit was stopped instead of disconnecting its body mapping');
  receipts.push({check:'wizard mappings reach independent neural controllers; added heavy ball falls under gravity', duck1Distance:initialRun.ducks[0].distance, deliveredEvents:secondCommands.length, ballHeight:t().props.find(p => p.id === ball.id).position[2]});

  stage = 'edit setup without restarting for a mapping change'; reportAcceptanceStage(stage);
  change('#brain-duck', 'duck-2');
  const beforeEdit = clone(t());
  $('#edit-setup').click();
  await wait(() => $('#scene-setup').open);
  check($('[data-setup-select="duck-2"]'), 'Later setup did not retain the added duck');
  action('next');
  change('#setup-duck-select', 'duck-2');
  check($('#setup-forward').value === 'off' && $('#setup-turn').value === 'off', 'Later setup did not retain the mapping');
  change('#setup-forward', 'walk');
  change('#setup-turn', 'follow');
  action('next');
  $(`[data-setup-select="${ball.id}"]`).click();
  check($('#setup-prop-profile').value === 'heavy', 'Later setup did not retain object physics');
  action('next');
  action('apply');
  await wait(() => !$('#scene-setup').open && t().scene.ducks[1].mapping.forward === 'walk');
  check(t().paused && t().tick === beforeEdit.tick, 'Editing only mappings restarted or resumed a paused scene');
  check(JSON.stringify(t().ducks) === JSON.stringify(beforeEdit.ducks) && JSON.stringify(t().agents['duck-1']) === JSON.stringify(beforeEdit.agents['duck-1']), 'Mapping-only setup edited the other brain or physical world');

  stage = 'live selected-duck controls'; reportAcceptanceStage(stage);
  $('#panel-connections').click();
  await settle();
  check($('#brain-mapping-panel').open, 'The connection rail did not open its settings panel');
  check($('#mapping-forward').value === 'walk' && $('#mapping-turn').value === 'follow', 'Live settings did not reflect setup changes');
  change('#mapping-forward', 'off');
  await wait(() => t().scene.ducks[1].mapping.forward === 'off');
  check(t().scene.ducks[0].mapping.forward === 'walk' && t().tick === beforeEdit.tick, 'Live edit changed another duck or reset the clock');
  change('#brain-duck', 'duck-1');
  check($('#mapping-forward').value === 'walk', 'Selected-duck mapping did not switch with the monitored brain');
  change('#brain-duck', 'duck-2');
  check($('#mapping-forward').value === 'off', 'Second duck lost its independently edited mapping');
  change('#mapping-forward', 'walk');
  await wait(() => t().scene.ducks[1].mapping.forward === 'walk');
  const secondBefore = t().ducks.find(d => d.id === 'duck-2').distance;
  const resumedAt = t().tick;
  $('#pause').click();
  await wait(() => t().tick >= resumedAt + 100);
  $('#pause').click();
  await wait(() => t().paused);
  const secondDistance = t().ducks.find(d => d.id === 'duck-2').distance - secondBefore;
  check(secondDistance > .025, 'Reconnecting the second duck did not produce physical movement');
  check(t().ducks.every(d => !d.fallen), 'Live mapping change caused a fall');
  receipts.push({check:'later setup and live controls stay synchronized; mapping-only changes preserve time and the other brain', secondDuckMovement:secondDistance});

  stage = 'save and reload exact mappings and runtime'; reportAcceptanceStage(stage);
  const saved = clone(t());
  const sceneFile = await exportJSON('#save');
  check(sceneFile.version === 6 && JSON.stringify(sceneFile.ducks.map(d => d.mapping)) === JSON.stringify(saved.scene.ducks.map(d => d.mapping)), 'Scene export lost the versioned mappings');
  const recording = await exportJSON('#export');
  check(recording.format === 'duckfly-recording' && recording.version >= 4 && recording.checkpoint.scene.version === 6, 'Recording did not retain a versioned mapping scene');
  $('#reset').click();
  await wait(() => t().tick === 0);
  await importJSON(sceneFile);
  await wait(() => t().tick === 0 && JSON.stringify(t().scene) === JSON.stringify(sceneFile));
  await importJSON(recording);
  await wait(() => t().tick === saved.tick);
  check(JSON.stringify(t().ducks) === JSON.stringify(saved.ducks) && JSON.stringify(t().agents) === JSON.stringify(saved.agents) && JSON.stringify(t().scene) === JSON.stringify(saved.scene), 'Recording roundtrip changed physical state, neural state, or settings');
  receipts.push({check:'scene schema 6 and recording preserve mappings, props, complete neural state, and physical state', sceneVersion:sceneFile.version, recordingVersion:recording.version, tick:saved.tick});

  stage = 'immersive panel layout'; reportAcceptanceStage(stage);
  const beforePresentation = physicalState();
  if ($('#brain-mapping-panel').open) $('#panel-connections').click();
  $('#compact-brain').click();
  await settle();
  check(inView('#eye') && inView('#brain-plot'), 'Collapsing the monitor hid the connected brain or eyesight');
  $('#focus-mode').click();
  await settle();
  check(document.body.classList.contains('focus-mode'), 'Focus mode did not open');
  check(inView('#eye') && inView('#brain-plot'), 'Focus mode hid the connected brain or eyesight');
  check(physicalState() === beforePresentation, 'Panel changes mutated the experiment');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  await settle();
  check(!document.body.classList.contains('focus-mode'), 'Escape did not restore the editing workspace');
  receipts.push({check:'computed DOM layout keeps brain and eyes inside the viewport when controls collapse or focus mode opens; no experiment change', nativePaintVerified:false});

  stage = 'cancel from a running scene'; reportAcceptanceStage(stage);
  $('#pause').click();
  await wait(() => !t().paused && t().tick > saved.tick);
  $('#edit-setup').click();
  await wait(() => $('#scene-setup').open && t().paused);
  const retained = clone(t());
  action('add-duck');
  await new Promise(resolve => setTimeout(resolve, 120));
  check(t().tick === retained.tick && JSON.stringify(t().scene) === JSON.stringify(retained.scene), 'Running scene kept advancing or adopted the draft');
  action('cancel');
  await wait(() => !$('#scene-setup').open && !t().paused && t().tick > retained.tick);
  check(JSON.stringify(t().scene) === JSON.stringify(retained.scene) && t().ducks.length === 2, 'Cancelling failed to resume the original scene');
  $('#pause').click();
  await wait(() => t().paused);
  receipts.push({check:'cancelling setup resumes a previously running scene with its original objects'});
  check(errors.length === 0, 'Console or uncaught errors: ' + errors.join('\n'));
  return {format:'duckfly-native-setup', version:1, passed:true, checks:receipts, errors};
} finally {
  HTMLAnchorElement.prototype.click = originalAnchorClick;
  console.error = originalConsoleError;
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
}
