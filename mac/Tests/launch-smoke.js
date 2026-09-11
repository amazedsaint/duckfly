// This native acceptance uses timers and computed layout. A locked Mac may
// suspend painting, so it does not infer visual smoothness from these checks.
const $ = selector => document.querySelector(selector);
const t = () => window.duckflyTelemetry;
const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const checks = [], errors = [];
let stage = 'startup', sharedFrame;
const wait = async (predicate, timeout = 30000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw Error('Launch acceptance timed out at ' + stage + ': ' + JSON.stringify({tick:t()?.tick, paused:t()?.paused, launch:$('#launch-page')?.hidden, gallery:$('#scene-catalog')?.hidden, notice:$('#notice')?.textContent}));
    await delay(25);
  }
};
const visible = element => !!element && !element.closest('[hidden]') && getComputedStyle(element).visibility !== 'hidden' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
const rect = element => {
  const value = element.getBoundingClientRect();
  return Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(key => [key,Math.round(value[key] * 100) / 100]));
};
const inView = element => { const r = rect(element); return visible(element) && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; };
const physicalState = () => JSON.stringify({tick:t().tick, scene:t().scene, ducks:t().ducks, agents:t().agents});
const pauseAndSettle = async () => {
  if (!t().paused) $('#pause').click();
  await wait(() => t().paused);
  await delay(120);
};
const motionStates = () => [...$('#launch-page').querySelectorAll('[data-launch-animation]')].map(element => {
  const css = getComputedStyle(element);
  return {element:element.dataset.launchAnimation || element.className, name:css.animationName, state:css.animationPlayState};
});
const openIntro = async () => {
  const button = $('#show-launch');
  check(button, 'More menu does not expose the introduction');
  if (!visible(button)) {
    const summary = button.closest('details')?.querySelector('summary');
    check(summary && visible(summary), 'Introduction has no visible More menu control');
    summary.click();
  }
  await wait(() => visible(button));
  button.click();
  await wait(() => visible($('#launch-page')) && t().paused);
  await delay(120);
};
const onError = event => errors.push(String(event.error?.stack || event.message));
const onRejection = event => errors.push(String(event.reason?.stack || event.reason));
window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);

try {
  await wait(() => t()?.ready);
  check(!new URLSearchParams(location.hash.slice(1)).has('scene'), 'Launch test needs a fresh no-hash startup');
  await delay(120);
  check(visible($('#launch-page')) && !$('#home-page').hidden, 'Fresh startup did not show the introduction');
  check($('#scene-catalog').hidden && $('#experiment-page').hidden, 'Fresh startup exposed a gallery or running stage behind the introduction');
  check(t().paused && t().tick === 0, 'Decorative launch started the experiment');
  for (const selector of ['#launch-enter','#launch-beacon','#launch-motion','#new-scene']) check(inView($(selector)), 'Initial launch control is clipped or unavailable: ' + selector);
  const initial = physicalState();
  stage = 'hero assets'; reportAcceptanceStage(stage);
  const images = [...$('#launch-page').querySelectorAll('img')];
  for (const path of ['/launch/duck-hero.png','/launch/fly-hero.png']) {
    const image = images.find(image => new URL(image.src, location.href).pathname === path);
    check(image, 'Missing bundled hero asset ' + path);
    await wait(() => image.complete && image.naturalWidth > 0);
    check(image.naturalWidth >= 128 && image.naturalHeight >= 128, 'Hero image has no usable resolution: ' + path);
    check(visible(image), 'Hero image is hidden: ' + path);
  }
  check($('#launch-page').querySelector('h1')?.textContent.trim().length, 'Launch has no readable heading');
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Launch overflows the native viewport horizontally');
  checks.push({check:'fresh startup, visible primary controls, and packaged hero images', viewport:[innerWidth,innerHeight], controls:Object.fromEntries(['#launch-enter','#launch-beacon','#launch-motion','#new-scene'].map(selector=>[selector,rect($(selector))])), assets:images.map(image=>({path:new URL(image.src,location.href).pathname,width:image.naturalWidth,height:image.naturalHeight,layout:rect(image)}))});

  stage = 'decorative motion isolation'; reportAcceptanceStage(stage);
  const motion = $('#launch-motion'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  check(['true','false'].includes(motion.getAttribute('aria-pressed')), 'Motion pause control has no accessible state');
  check(motionStates().length > 0, 'Launch has no inspectable decorative animation');
  const configured = motionStates();
  if (!reduced) check(configured.some(value=>value.name !== 'none'), 'Decorative animation has no CSS animation');
  await delay(300);
  check(physicalState() === initial, 'Launch animation mutated brain state or physical simulation');
  if (motion.getAttribute('aria-pressed') !== 'true') motion.click();
  await wait(() => $('#launch-motion').getAttribute('aria-pressed') === 'true');
  await delay(60);
  const pausedMotion = motionStates();
  check(pausedMotion.every(value=>value.name === 'none' || value.state.split(',').every(state=>state.trim() === 'paused')), 'Motion pause did not pause decorative animation');
  await delay(160);
  check(physicalState() === initial, 'Pausing decoration changed a brain or body');
  $('#launch-motion').click();
  await wait(() => $('#launch-motion').getAttribute('aria-pressed') === 'false');
  if (!document.hidden) {
    check(motionStates().some(value=>value.name !== 'none' && value.state.split(',').some(state=>state.trim()==='running')), 'Motion cannot resume after pausing');
    check($('#launch-page').dataset.motion === 'playing', 'Enabled visible illustration did not enter playing state');
  } else check($('#launch-page').dataset.motion === 'paused', 'Hidden document did not suspend decorative motion');
  $('#launch-motion').click();
  await wait(() => $('#launch-motion').getAttribute('aria-pressed') === 'true');
  $('#launch-spark').click();
  check($('#launch-page').classList.contains('launch-sparking') && $('#launch-spark-status').textContent.includes('Spark sent'), 'Send a spark gave no decorative feedback');
  await delay(200);
  check(physicalState() === initial, 'Send a spark stimulated the actual brain or moved the body');
  await wait(() => !$('#launch-page').classList.contains('launch-sparking'), 4000);
  check(physicalState() === initial && $('#launch-spark-status').textContent.includes('Make the illustration react'), 'Decorative spark did not reset independently of the experiment');
  checks.push({check:'decorative animation pauses/resumes and Send a spark reacts independently of the real circuit and physics', reducedMotion:reduced, documentHidden:document.hidden, configured, paused:pausedMotion});

  stage = 'new scene cancellation'; reportAcceptanceStage(stage);
  $('#new-scene').click();
  await wait(() => $('#scene-setup').open);
  check($('#setup-title').textContent === 'Blank scene', 'Global New scene is unavailable from the introduction');
  $('[data-setup-action="cancel"]').click();
  await wait(() => !$('#scene-setup').open && visible($('#launch-page')));
  check(physicalState() === initial, 'Cancelling a new scene changed the launch experiment');
  checks.push({check:'global New scene uses isolated setup; cancelling returns to the introduction with state retained'});

  stage = 'direct quick start'; reportAcceptanceStage(stage);
  $('#launch-beacon').click();
  await wait(() => !$('#experiment-page').hidden && !t().paused && t().tick >= 100);
  check(!$('#scene-setup').open && t().scene.name === 'Build a visual follower', 'Quick start did not launch the selected prebuilt scene directly');
  check(t().ducks[0].distance > .01, 'Quick start did not produce physical movement');
  checks.push({check:'Try a connection launches directly and moves the duck',tick:t().tick,distance:t().ducks[0].distance});
  await openIntro();
  const galleryBaseline=physicalState();

  stage = 'gallery entry and real scene launch'; reportAcceptanceStage(stage);
  $('#launch-enter').click();
  await wait(() => $('#launch-page').hidden && visible($('#scene-catalog')));
  check(physicalState() === galleryBaseline && $('#experiment-page').hidden, 'Opening the gallery ran or replaced the experiment');
  check(document.querySelectorAll('#scene-catalog [data-scenario]').length === 18, 'Gallery entry lost experiment tiles');
  await launchScenario('target');
  await wait(() => !$('#experiment-page').hidden && !t().paused && t().tick >= 100);
  check($('#home-page').hidden && $('#launch-page').hidden, 'Direct scene launch left the introduction on the stage');
  check(t().ducks[0].distance > .01, 'Direct beacon scene did not produce actual physical movement');
  checks.push({check:'Open studio reveals the gallery; selecting a prebuilt scene runs the neural and physical experiment directly', tick:t().tick, distance:t().ducks[0].distance});

  stage = 'reopen introduction without losing the running scene'; reportAcceptanceStage(stage);
  await openIntro();
  check($('#scene-catalog').hidden && $('#experiment-page').hidden, 'Reopened introduction did not own its home surface');
  const retained = physicalState(), retainedTick = t().tick;
  await delay(220);
  check(physicalState() === retained, 'Reopened introduction kept changing the paused circuit or world');
  $('#launch-enter').click();
  await wait(() => $('#launch-page').hidden && visible($('#scene-catalog')));
  check(visible($('#continue-scene')), 'Gallery lost Continue your scene');
  $('#continue-scene').click();
  await wait(() => !$('#experiment-page').hidden);
  check(t().paused && physicalState() === retained, 'Continue replaced, rewired, or automatically ran the retained scene');
  $('#pause').click();
  await wait(() => !t().paused && t().tick > retainedTick + 15);
  await pauseAndSettle();
  $('#back-home').click();
  await wait(() => visible($('#scene-catalog')));
  check($('#launch-page').hidden, 'Stage Back opened the introduction instead of the gallery');
  $('#continue-scene').click();
  await wait(() => !$('#experiment-page').hidden);
  $('#home-button').click();
  await wait(() => visible($('#scene-catalog')));
  check($('#launch-page').hidden, 'Brand button opened the introduction instead of the gallery');
  checks.push({check:'More reopens the introduction and pauses without replacement; gallery Continue preserves the exact run; Run resumes it; Back and brand return to the gallery', retainedTick, resumedTick:t().tick});

  stage = 'shared scene bypass'; reportAcceptanceStage(stage);
  const shared = JSON.parse(JSON.stringify(t().scene));
  shared.name = 'Shared launch acceptance'; shared.seed = 'launch-shared-acceptance';
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shared)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const url = new URL('/', location.href); url.hash = 'scene=' + encoded;
  sharedFrame = document.createElement('iframe');
  sharedFrame.setAttribute('aria-hidden','true'); sharedFrame.tabIndex = -1;
  sharedFrame.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;height:800px;border:0';
  sharedFrame.src = url.href; document.body.append(sharedFrame);
  await wait(() => sharedFrame.contentWindow?.duckflyTelemetry?.ready, 60000);
  const sharedDocument = sharedFrame.contentDocument, sharedState = sharedFrame.contentWindow.duckflyTelemetry;
  check(sharedDocument.querySelector('#home-page').hidden && sharedDocument.querySelector('#launch-page').hidden && !sharedDocument.querySelector('#experiment-page').hidden, 'A shared-scene link was intercepted by the introduction');
  check(sharedState.scene.name === shared.name && sharedState.scene.seed === shared.seed, 'Shared-scene entry replaced the linked scene');
  check(!sharedDocument.querySelector('#scene-setup')?.open, 'Shared-scene entry unnecessarily opened setup');
  sharedFrame.remove(); sharedFrame = null;
  checks.push({check:'a real same-origin shared-scene URL initializes directly on the linked stage without launch or setup', scene:sharedState.scene.name});
  check(errors.length === 0, 'Launch produced JavaScript errors: ' + errors.join('\n'));
  return {format:'duckfly-native-launch',version:1,passed:true,checks,errors};
} finally {
  sharedFrame?.remove();
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
}
