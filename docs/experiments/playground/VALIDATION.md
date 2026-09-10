# Guided playground validation

The new scenarios expose measured simulator behavior; they do not promote the temporal model as a validated default controller.

- `tests.log`: 54 tests pass, none skipped. Includes packaged-model numerical parity, invalid-camera handling, and exact neural/physics continuation after JSON recording import. The replay crosses both scheduled object-motion transitions. A matched physical nudge changes lateral displacement and the walking fixture remains upright.
- `browser.json`: the initial 12 rendered-camera trials plus controls for actual wall occlusion, circuit cuts and physical nudging. The initial near-miss-0 example was replaced after its GF-disconnected condition made contact.
- `browser-final.json`: the replacement near-miss-15 runs, including the GF-disconnected counterfactual with no contacts; also the longest control panel at desktop and narrow layouts. Brain/eye visibility is checked with hit testing, so a panel painted over them cannot pass just by having a valid bounding box.
- `retained-parity.json`: all 12 final examples match their retained Chromium study endpoints exactly, with identical contact and GF outcomes. Nine final cases come from `browser.json`; the replacement path's conditions come from `browser-final.json`. These are selected regression examples, not independent evidence for a new controller.
- `native-guided.log`: the final packaged WKWebView app reproduces incoming-object hold/timer/GF-disconnection behavior. The hold avoids contacts and releases. It also keeps neural activity visible while output is cut.
- `native-playground.log`: the original scenario workflow still passes, including separate duck selection and reversible eye covering.
- `mac-build.log`: native 0.5.0 build and code-signature verification. This is the local Apple Silicon package, not a notarized distribution release.

The incoming-object demonstration has 0 contacts with the hold, 2 with the timer, and 2 with GF disconnected. The selected harmless-passing example has no contacts in any of those conditions; the temporal adapter nevertheless triggers GF twice. Switching off GF changes the body trajectory, so compare the complete trajectory rather than treating neural scores alone as success.

Research limitations remain in the visible experiment notes and in `README.md`. The full 45,669-cell Flyvis model remains in the separate reference bench. The playground's temporal classifier is an engineered adapter.

For narrow windows, the scene pane scrolls independently so experiment controls cannot cover the connected brain. The worst-case stop panel is checked at 390 × 844 and 560 × 640, as well as desktop sizes.

Reproduction: run `npm test --prefix web`, build with `mac/scripts/build.sh`, then launch the built executable with `--self-test-guided` and `--self-test-playground`. The Playwright function files under `web/tests/browser-guided*.js` exercise the browser UI against a local preview. The retained CLI logs show the executed scripts and results. Browser screenshots are in the local ignored `output/playwright/` folder; the four scenario thumbnails are checked in under `web/public/scenarios/`.

## Release

Code commit: `9126e84`, on `codex/vision-lab`. Published to the existing ContextMind project at [duckfly.vercel.app](https://duckfly.vercel.app). Deployment `dpl_B41JMuxFyUYvHzuNR4wgcEkpJNS8`; immutable URL: [duckfly-jex1sb7dw-contextmind.vercel.app](https://duckfly-jex1sb7dw-contextmind.vercel.app).

`production.json` verifies byte equality of the public HTML and app bundles, including the model chunk, with the tested local output. Physical assets and the new thumbnails are also checked. This verifies served build identity; the interaction checks were run against the local production preview, not repeated against production while the Mac was locked.

The installed `/Users/madhusudanaa/Applications/DuckFly.app` is version 0.5.0 (build 5). Its signature verifies and all 52 web payload files match the build. The application was launched and its process was confirmed running. The Mac was locked when foreground inspection was attempted, so visibility after installation was not checked. Native self-tests had passed against the same packaged app.
