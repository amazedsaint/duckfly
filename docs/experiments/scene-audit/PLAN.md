# Scene and feedback-loop audit

Goal: inspect every shipped scene/experiment for silent movement failures; make the vision-to-brain-to-body loop visible and controllable; provide useful interactions in every scene.

## Acceptance requirements

- Exercise all ten catalog scenes through rendered duck-eye frames and the real walking policy. Distinguish expected stops (occlusion, no stimulus, GF hold, output cut) from broken operation.
- Reproduce the distant-beacon failure. Test candidate detection/recovery against negative controls, occlusion, stale/covered cameras, and physical pursuit before changing defaults. Retain the original research conditions and compare using identical scenes/seeds.
- Show perception evidence, neural intent, delivered commands, and measured movement with the actual gate/override reason. Keep the selected duck's camera and neural view available in compact layouts.
- Make feedback and output connections directly controllable. Provide meaningful scene-specific actions throughout the catalog, with clear paused and queued-input behavior. All opened scenes must continue without a duration cap, including Stop, wait, go. Explicit comparison tools may retain fixed measurement windows.
- Provide simple prop behavior and physics presets. Motion edits preserve the clock and neural state; physical model changes explain and perform a restart. Reset preserves added props and user physics; custom motion takes ownership from encounter scripts. Test real gravity and bounded motion, with recording/replay coverage.
- Validate interventions, selection changes, recording/replay, and portable scene data. Check the full browser workflow and native host. Publish the validated web build to the existing ContextMind project and install the matching Mac package.

## Evidence

Start with a rendered-camera baseline across the catalog. Add deterministic unit/physical tests where behavior changes. A green unit suite alone does not establish scene usability or successful pursuit. A candidate that fails physical or negative-control checks remains optional or is rejected; failures must be visible and recoverable in the UI.
