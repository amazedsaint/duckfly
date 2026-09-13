// Independent of the simulator so import failures can still show a useful
// screen. Diagnostics stay on the device until the user copies them.
const state = {status: 'loading', stage: 'Opening DuckFly…', history: []};
let slowTimer, stalledTimer;

export function browserSupport(scope = globalThis) {
  let simd = false;
  try {
    // A tiny module using i8x16.splat, as required by the ONNX runtime.
    simd = scope.WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,
      10,10,1,8,0,65,0,253,15,253,98,11,
    ]));
  } catch { /* Includes browsers with WebAssembly disabled. */ }
  return {
    wasmSIMD: simd,
    workers: typeof scope.Worker === 'function',
    webgl2: typeof scope.WebGL2RenderingContext === 'function',
    structuredClone: typeof scope.structuredClone === 'function',
  };
}

export function startStartup() {
  window.duckflyStartup = state;
  state.support = browserSupport();
  progressStartup(state.stage);
  window.addEventListener('unhandledrejection', event => {
    if (state.status === 'loading') failStartup(event.reason);
  });
  window.addEventListener('error', event => {
    if (state.status === 'loading' && event.error) failStartup(event.error);
  });
  const missing = Object.entries(state.support).filter(([, supported]) => !supported).map(([name]) => name);
  if (missing.length) {
    const error = new Error('Missing browser features: ' + missing.join(', '));
    error.code = 'BROWSER_UNSUPPORTED';
    throw error;
  }
}

export function progressStartup(message) {
  if (state.status !== 'loading') return;
  state.stage = message;
  state.history.push({ms: Math.round(performance.now()), stage: message});
  if (state.history.length > 40) state.history.shift();
  for (const id of ['loading-detail', 'home-status', 'launch-status']) {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  }
  clearTimeout(slowTimer);
  clearTimeout(stalledTimer);
  slowTimer = setTimeout(() => {
    const retry = document.getElementById('loading-retry');
    if (retry) retry.hidden = false;
    for (const id of ['loading-detail', 'home-status', 'launch-status']) {
      const element = document.getElementById(id);
      if (element) element.textContent = `${state.stage} The first load can take longer on a phone. You can reload if it has stopped.`;
    }
  }, 30000);
  // Active downloads reset this timer. Broken module imports and WASM
  // initialization must not leave an endless spinner.
  stalledTimer = setTimeout(() => failStartup(new Error('Startup stopped responding during: ' + state.stage)), 120000);
}

export function completeStartup() {
  if (state.status === 'error') return;
  state.status = 'ready';
  state.readyMs = Math.round(performance.now());
  clearTimeout(slowTimer);
  clearTimeout(stalledTimer);
  document.getElementById('boot-fallback')?.remove();
}

export function failStartup(error) {
  if (state.status === 'error') return;
  clearTimeout(slowTimer);
  clearTimeout(stalledTimer);
  state.status = 'error';
  state.error = error?.message || String(error);
  window.duckflyStartup = state;
  window.dispatchEvent(new Event('duckfly-startup-error'));
  const unsupported = error?.code === 'BROWSER_UNSUPPORTED';
  const graphics = error?.code === 'GRAPHICS_UNAVAILABLE';
  const panel = document.createElement('section');
  panel.id = 'startup-error';
  panel.setAttribute('role', 'alert');
  panel.innerHTML = '<div class="startup-card"><span class="startup-brand">DuckFly</span><h1></h1><p></p><div class="startup-actions"><button id="startup-reload" type="button">Reload</button><button id="startup-copy" type="button">Copy details</button></div><details><summary>Loading details</summary><pre></pre></details></div>';
  panel.querySelector('h1').textContent = unsupported ? 'This browser needs an update' : graphics ? 'The 3D view stopped' : 'The scene couldn’t load';
  panel.querySelector('p').textContent = unsupported
    ? 'Update iOS and open this page in Safari. On Android, update Chrome. The simulator needs browser features that are unavailable here.'
    : graphics ? 'Reload to reopen the scene. If the view stops again, copy the details so we can find the cause.'
    : 'Check your connection, then reload. If it still stops here, copy the details so we can find the cause.';
  const details = JSON.stringify({
    page: location.origin + location.pathname + location.search,
    browser: navigator.userAgent, online: navigator.onLine,
    ...state,
  }, null, 2);
  panel.querySelector('pre').textContent = details;
  panel.querySelector('#startup-reload').onclick = () => location.reload();
  panel.querySelector('#startup-copy').onclick = async event => {
    try { await navigator.clipboard.writeText(details); event.target.textContent = 'Copied'; }
    catch { panel.querySelector('details').open = true; event.target.textContent = 'Select the details below'; }
  };
  document.getElementById('boot-fallback')?.remove();
  document.body.append(panel);
  panel.querySelector('#startup-reload').focus();
}
