async page => {
  const origin = await page.evaluate(() => location.origin), results = [], errors = [];
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const visit = async (name, configure, verify) => {
    const tab = await page.context().newPage();
    try {
      await configure(tab);
      await tab.goto(origin + '/?ar=1');
      const result = await verify(tab);
      results.push({name, ...result});
    } finally { await tab.close(); }
  };
  await visit('worker download failure and reload', async tab => {
    await tab.route('**/lab.worker-*.js', route => route.abort());
  }, async tab => {
    await tab.locator('#startup-reload').waitFor({state: 'visible'});
    const failure = await tab.evaluate(() => ({...window.duckflyStartup}));
    check(failure.status === 'error', 'Worker failure was not surfaced');
    await tab.screenshot({path: 'output/playwright/mobile-worker-failure-after.png'});
    await tab.unroute('**/lab.worker-*.js');
    await tab.locator('#startup-reload').click();
    await tab.waitForFunction(() => window.duckflyTelemetry?.ready, null, {timeout: 60000});
    return {failure, recovered: true};
  });
  await visit('unsupported browser stops before large downloads', async tab => {
    await tab.addInitScript(() => { WebAssembly.validate = () => false; });
  }, async tab => {
    await tab.locator('#startup-error').waitFor({state: 'visible'});
    const result = await tab.evaluate(() => ({status: window.duckflyStartup.status, error: window.duckflyStartup.error,
      downloads: performance.getEntriesByType('resource').map(entry => entry.name)}));
    check(result.error.includes('wasmSIMD'), 'Unsupported WASM was not explained');
    check(!result.downloads.some(url => /scene\.json|mujoco|\.onnx|lab\.worker/.test(url)), 'Unsupported browser fetched the simulation');
    return result;
  });
  await visit('main script import failure', async tab => {
    await tab.route('**/main-*.js', route => route.abort());
  }, async tab => {
    await tab.locator('#startup-reload').waitFor({state: 'visible'});
    return {status: await tab.evaluate(() => window.duckflyStartup.status)};
  });
  await visit('failed scene download', async tab => {
    await tab.route('**/assets/scene.json.gz', route => route.fulfill({status: 503, body: 'Unavailable'}));
  }, async tab => {
    await tab.locator('#startup-error').waitFor({state: 'visible'});
    const error = await tab.evaluate(() => window.duckflyStartup.error);
    check(error.includes('Robot appearance') && error.includes('503'), 'Asset failure lost its cause');
    return {error};
  });
  await visit('gzip fallback and mobile scene', async tab => {
    tab.on('pageerror', error => errors.push(error.message));
    await tab.addInitScript(() => { window.DecompressionStream = undefined; });
  }, async tab => {
    await tab.waitForFunction(() => window.duckflyTelemetry?.ready && document.querySelector('#ar-dialog')?.open, null, {timeout: 60000});
    const initial = await tab.evaluate(() => {
      const canvas = document.querySelector('#arena canvas'), rect = canvas.getBoundingClientRect();
      return {startup: window.duckflyStartup, ua: navigator.userAgent, displayRatio: canvas.width / rect.width,
        hiddenArtwork: performance.getEntriesByType('resource').filter(entry => /\/(launch|scenarios)\//.test(entry.name)).map(entry => entry.name),
        surfaceHidden: document.querySelector('#ar-start').hidden, cameraPrimary: document.querySelector('#ar-camera').classList.contains('primary')};
    });
    check(initial.hiddenArtwork.length === 0, 'AR downloaded hidden home artwork');
    check(initial.surfaceHidden && initial.cameraPrimary, 'Camera preview was not the available primary action');
    await tab.locator('#ar-cancel').click();
    await tab.locator('#back-home').click();
    await tab.locator('[data-scenario="cue-workshop"]').click();
    await tab.waitForFunction(() => window.duckflyTelemetry?.tick >= 100, null, {timeout: 45000});
    await tab.locator('#pause').click();
    await tab.waitForFunction(() => window.duckflyTelemetry.paused);
    const scene = await tab.evaluate(() => {
      const t = window.duckflyTelemetry;
      return {tick: t.tick, distance: t.ducks[0].distance, fallen: t.ducks[0].fallen, input: t.agents['duck-1'].input};
    });
    check(scene.distance > 0.15 && !scene.fallen, 'Visual connection did not drive a stable duck');
    await tab.screenshot({path: 'output/playwright/mobile-webkit-scene.png'});
    return {initial, scene};
  });
  check(!errors.length, errors.join('; '));
  return {format: 'duckfly-mobile-startup', origin, passed: true, results, errors};
}
