# One connection editor

The setup wizard and **Brain → duck** inspector now show a single list of signal/response rows. Scene connections are ready to use. Response tuning and input/body settings stay collapsed until opened.

Use **Duck does** to change an existing response. **Add a connection** opens a small composer with the 13 available signals and 10 actions; nothing changes until both choices are made and Add is pressed. Each added row can be switched off or removed. The selected duck owns its settings, including when another object is selected on the stage.

The scene's original walking and steering connections remain active when a response is added. An active added response owns only the channels it uses. A head action preserves walking; an arc supplies forward motion and turning. Pause has priority over movement. When a rule stops applying, the original connection resumes on its channel. Existing scenes with a complete user-defined rule list retain their behavior of waiting between signals.

Continuous neural connections are preserved in the portable scene rather than approximated with fixed thresholds. Selecting a different action on one of those rows converts that route into explicit, editable signal rules while retaining unrelated routes. The two directions of the steering pathway become separate rows when assigned another action.

## Compatibility

`connections.includeBrainMapping` opts into channel-level overrides. Scenes using it are version 8 so older clients reject them rather than silently dropping their retained behavior. Version 7 and older scenes/recordings keep their existing semantics. An inactive added rule preserves the original physical trajectory and action provenance. The original visual-kick timing is also retained when it is unaffected by a new response.

Manual and direct-camera controllers show a clear inactive state and disable the connection fields. **Use fly connections** resumes them. Live rows distinguish an active response from a paused scene or disconnected body. Numeric readings and thresholds remain available under **Tune response**.

## Verification

The focused checks in `web/tests/brain-mapping.test.mjs` compare actual MuJoCo/ONNX trajectories before and after an inactive rule is added, including head tracking and the visual kick. They also verify physical walking with an added head response and exact recording replay. Trigger tests cover channel ownership, stop conditions, and portable version 8 scenes.

`experiments/visual-behavior/simple-connections-browser.js` exercises the actual wizard and inspector, including numeric-field blur, direct remapping, manual-mode transitions, per-duck isolation and draft cancellation. It checks layouts at 1440, 1280, 390 and 320 px. The catalog acceptance in `mac/Tests/scenario-audit.js`, with `setup-helpers.js`, checks every scene through the wizard, running the body, editing controls and interacting with scene objects. The same acceptance is exercised in the browser.

Retained results are in `validation.json`. Screenshots from local browser checks are written to `output/playwright/`.
