# Dashboard and workspace refinement

The dashboard now has a prominent New scene button in a sticky header. The same action is available above the stage. It opens an isolated, empty playground in the guided setup; cancelling preserves the current experiment and returns keyboard focus to the action that opened setup.

Object selection and behavior controls share the Objects & physics panel group. Selecting a prop keeps its object switcher and movement controls available. Escape dismisses the nearest open menu or settings surface, with dialogs taking precedence. Opening Advanced closes floating stage panels. Selecting an object inside Advanced keeps that editor open.

Wizard form changes validate pending inputs before replacing the editor. Scroll position and collapsed sections survive settings changes. The wizard also finishes its own close lifecycle before another draft can take over, preventing rapid cancel/reopen from losing the next setup session. Pending pause requests also retain their intent until the matching worker acknowledgement, so cancelling a rapidly reopened wizard resumes the original run.

Custom prop physics is shown as its actual current values. The kick ball remains 25 g with friction 0.6; it no longer appears to already use the 80 g preset. Choosing a replacement preset is explicit.

The phone layout retains the live brain/vision dock while settings are open. The header fits widths down to 320 CSS pixels. Engine behavior and scenario defaults are unchanged.

## Verification

Current test receipts and release verification are retained in this directory. Native startup failure logs are retained separately from final acceptance results. Screenshots show the browser UI; native tests use the real WebKit, MuJoCo and ONNX runtime.

## Final results and release

All 88 Node tests passed. All eight native suites passed on the exact installed bundle, including all 11 scene presets and the 14-check full workspace workflow. See [native verification](native-verification.md) and the [artifact-pinned manifest](native-acceptance.json).

Browser checks covered guided creation, multi-duck configuration, live object controls, keyboard dismissal and phone layouts. The persistent header was verified while scrolled 959 pixels down the dashboard. The final browser console had no errors or warnings. See [browser checks](browser-checks.json).

Published to [DuckFly](https://duckfly.vercel.app/) under ContextMind. Deployment `dpl_HkXGxyoN2c1Rvm3HDRecmhVzbYkb` is production-ready; the main script, stylesheet and simulation worker served by the public alias match the tested build byte for byte. See [production verification](production-verification.json). A fresh production scene detected the beacon and produced a 0.30 m/s body request; measured speed after the first 0.10 seconds was 0.07 m/s.

Mac version 0.9.1, build 10, is installed at `/Users/madhusudanaa/Applications/DuckFly.app`. All 68 files match the tested bundle and the ad hoc signature verifies. The existing app process was left running; quit and reopen it to load the update. Native numerical and UI-flow tests passed, while visual acceptance used the browser because native paint could not be inspected on the locked Mac.
