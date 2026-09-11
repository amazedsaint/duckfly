// Native acceptance uses the same visible setup path as a person opening a scene.
// This file is prepended by the host to each smoke script.
const reportAcceptanceStage = stage => {
  window.webkit?.messageHandlers?.acceptance?.postMessage({stage, tick:window.duckflyTelemetry?.tick, scene:window.duckflyTelemetry?.scene?.name, time:Date.now()});
};
const setupWait = async (predicate, timeout = 30000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout)
      throw Error('Scene setup timed out: ' + document.querySelector('#notice')?.textContent);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const enterSceneCatalog = async () => {
  const get = selector => document.querySelector(selector);
  await setupWait(() => window.duckflyTelemetry?.ready);
  if (get('#home-page').hidden) {
    const back = get('#back-home');
    if (!back || back.closest('[hidden]')) throw Error('Scene gallery has no visible return control');
    back.click();
    await setupWait(() => !get('#home-page').hidden);
  }
  const launch = get('#launch-page');
  if (launch && !launch.hidden) {
    const enter = get('#launch-enter');
    if (!enter || enter.disabled || enter.closest('[hidden]') || enter.getBoundingClientRect().width <= 0)
      throw Error('Launch page has no visible playground entry');
    enter.click();
  }
  await setupWait(() => !get('#home-page').hidden && (!get('#scene-catalog') || !get('#scene-catalog').hidden) && (!get('#launch-page') || get('#launch-page').hidden));
};
const finishSceneSetup = async () => {
  const get = selector => document.querySelector(selector);
  await setupWait(() => get('#scene-setup')?.open);
  for (let step = 0; step < 3; step++) {
    reportAcceptanceStage('wizard step ' + step);
    const form = get('#scene-setup form');
    if (!form.reportValidity()) {
      const invalid = [...form.querySelectorAll('input,select')]
        .filter(input => !input.validity.valid)
        .map(input => ({field:input.dataset.setupPath || input.id, value:input.value, error:input.validationMessage}));
      throw Error('Default scene form is invalid at step ' + step + ': ' + JSON.stringify(invalid));
    }
    if(step===1){
      if(form.querySelectorAll('.trigger-connections').length!==1||form.querySelector('[data-connection="enabled"]')||/default connections|custom connections/i.test(form.innerText))throw Error('Competing connection editors in the wizard');
      if(!form.querySelector('.connection-rule'))throw Error('Scene has no ready connection rows');
    }
    const next = get('[data-setup-action="next"]');
    if (!next || next.hidden || next.disabled)
      throw Error('Scene setup did not expose the next step ' + step);
    next.click();
    await setupWait(() => get(`[data-setup-step="${step + 1}"]`));
  }
  if (!get('#scene-setup form').reportValidity()) throw Error('Default scene review is invalid');
  const apply = get('[data-setup-action="apply"]');
  if (!apply || apply.hidden || apply.disabled)
    throw Error('Scene setup did not expose its reviewed launch');
  apply.click();
  await setupWait(() => !get('#scene-setup').open && !get('#experiment-page').hidden);
  reportAcceptanceStage('wizard launch complete');
};
const launchScenario = async id => {
  await enterSceneCatalog();
  const tile = document.querySelector(`[data-scenario="${id}"]`);
  if (!tile || tile.closest('[hidden]')) throw Error('Missing visible scenario tile ' + id);
  tile.scrollIntoView({block:'nearest'});
  tile.click();
  if(id==='empty')await finishSceneSetup();
  else {
    await setupWait(()=>!document.querySelector('#experiment-page').hidden&&!window.duckflyTelemetry.paused);
    if(document.querySelector('#scene-setup').open)throw Error('A prebuilt scene unexpectedly opened setup');
  }
};
const loadPresetScene = async id => {
  await launchScenario(id);
  await setupWait(() => !window.duckflyTelemetry.paused);
  document.querySelector('#pause').click();
  await setupWait(() => window.duckflyTelemetry.paused);
  // Existing controller tests require an exact tick-zero starting state.
  document.querySelector('#reset').click();
  await setupWait(() => window.duckflyTelemetry.tick === 0 && window.duckflyTelemetry.paused);
};
