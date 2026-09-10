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
  const tile = document.querySelector(`[data-scenario="${id}"]`);
  if (!tile) throw Error('Missing scenario tile ' + id);
  tile.click();
  await finishSceneSetup();
};
const loadPresetScene = async id => {
  const preset = document.querySelector('#preset');
  preset.value = id;
  preset.dispatchEvent(new Event('change', {bubbles: true}));
  await finishSceneSetup();
  await setupWait(() => !window.duckflyTelemetry.paused);
  document.querySelector('#pause').click();
  await setupWait(() => window.duckflyTelemetry.paused);
  // Existing controller tests require an exact tick-zero starting state.
  document.querySelector('#reset').click();
  await setupWait(() => window.duckflyTelemetry.tick === 0 && window.duckflyTelemetry.paused);
};
