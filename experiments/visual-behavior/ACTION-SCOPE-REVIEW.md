# Action inspector recording-boundary review

Independent browser regression against the local app at `http://127.0.0.1:5182`. Five checks pass, with zero browser page errors. The collaboration checks used controlled delivery into the production `ExperimentRoom` status/state callbacks, carrying state from the actual host simulation worker. They do not establish working WebRTC transport.

## Verified behavior

| Check | Observed result |
| --- | --- |
| Rapid native dialog close/reopen | Twenty consecutive close/reopen cycles leave the current exact-image request working. |
| Malformed recording import | Setting a recorded action's causes to null is rejected. The paused world's full telemetry, run UUID and retained action/image remain unchanged. |
| Guest joins a shorter host run | A local history at tick 112 is replaced by the host at tick 32. Exactly one shared action is initially available; old local events are absent. |
| Host resets identical scene content | The scene JSON stays identical while the run UUID changes. The guest's open inspector closes, its old actions disappear, and new actions belong to the new host run. |
| Leave and rejoin | Leaving creates an empty local run. After that local run reaches tick 78, rejoining replaces it with the host's tick 19 recording. |

In the shared inspector, the camera canvas stays hidden and explains that the host retains camera images. The guest makes no additional evidence request to its local worker. The retained screenshot was visually checked: it displays the selected host event and the explicit camera-availability message.

## Transport boundary

A separate attempt used actual `RTCPeerConnection` instances in independent Chrome contexts with no ICE servers configured, avoiding the unavailable local TURN service. Both peers reached failed connection state / disconnected ICE, with no successful selected candidate pair. The actual transport attempt is retained as a failure. It is not combined with the passing fixture result.

The controlled fixture substitutes invitation/answer handling and message delivery only. The application callbacks still perform event validation, run/scene/branch cache scoping and inspector reset, and the host simulation produces the underlying state. This checks those application boundaries without asserting RTC, relay or external-network behavior.

## Remaining review outcome

The previously reported import-shape and queued-close defects are addressed. Guest event history is scoped to room authority and run identity; backward ticks and branch changes also invalidate the cache in the source. No additional blocking inspector correctness finding was identified in this bounded review. This is not a complete adversarial recording-format audit, and backward-tick/branch changes were source-reviewed rather than separately browser-exercised here.

## Evidence and reproduction

- `action-scope-browser.js`: real local RTC attempt plus local inspector/import checks.
- `action-scope-fixture-browser.js`: isolated controlled-delivery regression.
- `reports/action-scope-browser.json` and `.log`: failed RTC attempt, with passing local checks.
- `reports/action-scope-fixture-browser.json` and `.log`: five passing application checks.
- `output/playwright/action-scope-fixture-guest.png`: visually reviewed guest inspector.

Run with an independent Playwright CLI session: `npx --yes --package @playwright/cli playwright-cli -s=action-scope-review open http://127.0.0.1:5182 --browser chrome`, then `run-code --filename experiments/visual-behavior/action-scope-fixture-browser.js`. Use a fresh session for reruns, since the fixture registers an exposed page function. The installed skill wrapper referenced a CLI binary no longer exposed by its package, so the available `@playwright/cli` package was used directly.

Report source hashes were captured after the run from the shared checkout, not as an immutable served-bundle manifest. Two preliminary harness failures concerned a hidden menu and an ambiguous menu selector; their logs remain separate and are not classified as application failures. No implementation files were edited during this review.
