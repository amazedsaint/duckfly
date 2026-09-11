# Spatial vision and recorded-action inspection

These are product checks for the new inspection tools. They do not establish a useful neural motor controller. The initial inspection checks preceded the selected trigger/action pack. Release status is recorded separately in the selected pack receipts.

## What passed

- **Current web suite:** 104 tests passed, no failures or skips. [Raw log](reports/trigger-actions-tests-release.log). This includes checks for exact camera identity, independently owned stereo images, retained stale frames and rejection of conflicting identities. The initial 88-test baseline remains separately retained.
- **Full-model browser bench:** 31 actual Flyvis frames, eight populations and 721 locations per population. Both response signs survive; every delta equals the Float32 raw-minus-baseline result. Recorded-cell scrubbing, cancellation, invalid model rejection and mobile layout passed. [Receipt](reports/bench-browser.json).
- **Recorded-action browser flow:** opening a scene through its wizard, choosing earlier actions and switching eyes leave the paused body/neural state unchanged. The displayed image agrees in all 24,576 RGBA values with the exact exported packet. An open inspector does not pause a running scene. The 390 px viewport has no horizontal overflow. No page errors occurred. [Receipt](reports/action-browser.json), [script](action-browser.js).
- **Packaged Mac subset:** actual stereo approach, full Flyvis inference, signed map inspection, compact stimulus controls and the recorded-action image flow passed in WKWebView. Its 31 reference frames contained 94,415 positive and 84,393 negative delta values. The normal signed research bundle contains the current test script, not the temporary diagnostic override. [Receipt and bundle hashes](reports/native-vision-bench.json).

Desktop and narrow browser screenshots were visually inspected. That review caught an inherited dark panel color obscuring the inspector title; the header and eyebrow colors were corrected and the browser flow rerun. Screenshots are local QA artifacts under `output/playwright/action-inspector-*.png` and `spatial-bench-*.png`.

The native command deliberately names a limited scope:

```sh
DUCKFLY_APP_DEST="$PWD/mac/build/DuckFlyResearch.app" ./mac/scripts/build.sh
mac/build/DuckFlyResearch.app/Contents/MacOS/DuckFly --self-test-vision --vision-bench-only
```

## What did not pass

The full native vision suite reached its synthetic webcam stage and failed the positive fresh-camera check. Its repeated image was about 0.97 seconds old, and the adapter correctly withheld forward motion. The full-suite failure is retained in [native-vision-v1-failure.log](reports/native-vision-v1-failure.log); the subset above is not a replacement claim that the full suite passed.

A separate four-condition diagnostic crossed detached/attached video with identical/changing canvas content. All conditions suffered long delivery gaps. Explicitly bringing the test window forward did not resolve it. The later diagnostic measured `document.visibilityState === 'hidden'` throughout, with canvas draws slowing to roughly one per second. [Visibility receipt](reports/native-camera-visibility-diagnostic.log), [diagnostic source](../../mac/Tests/camera-diagnostic.js).

WebKit documents hidden-page timer throttling, and its video-frame callback implementation has had visibility-dependent behavior. These sources support the scheduling explanation, not a claim that a physical camera was tested: [WebKit power behavior](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/), [WebKit video callback report](https://bugs.webkit.org/show_bug.cgi?id=282797).

Trying the public inactive-scheduling preference also failed to restore cadence. That experimental host change and the foreground override were removed. Camera freshness was never relaxed, and rendering requests never mint new camera frames. Native foreground camera acceptance and real-camera transfer remain open checks. The original full-suite command continues to include the webcam tests.

## Boundaries of the inspector

An event is recorded after a physics step; its request was computed before that step. Images are joined by the complete recorded camera identity and only from earlier samples. No nearest-image fallback is used. The inspector distinguishes modeled visual input, actual circuit rates and applied requests; an applied request is not a speed measurement. Recorded actions are a trace of the executed path, not independent proof of biological causality.

The snapshot list remains stable while the scene runs. If the recording buffer expires before a selected image is requested, the inspector explains that it is unavailable. Collaborator views show decision metadata only; camera images remain on the host. Source hashes in each receipt identify the tested implementation.

## Selected trigger/action pack

The subsequent user request selected a smaller product step: 13 available signals, ten actions and four new scene tiles. The wizard and live panel share the same scene configuration. All new browser launch flows and the native connection flow pass, including live remapping and recorded decisions. See [the selected implementation](../../docs/research/visual-behavior-proposal/selected-connections.md) and its versioned logs under `reports/`. The expanded 104-test suite includes real neural intervention, physical movement and exact replay. This does not close the earlier full-native camera or full-model steering gates.
