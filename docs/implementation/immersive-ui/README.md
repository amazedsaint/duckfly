# Immersive workspace · 0.6.0

The scene now gets the main work surface. Open a scenario tile, fold the controls, and keep watching the selected duck's actual camera and neural activity.

## Changes

- A compact scene header and Focus mode give the arena more space. Escape leaves Focus and restores previous panel states.
- The live connection panel has expanded and compact views. Both use the same camera and neural canvases. Vision controls, neural stimulation, and movement details use native disclosure controls.
- Scene objects and guided experiment controls fold independently. The layout remembers panel choices locally, outside scene exports and recordings. Small windows initially use compact monitors and folded workspace controls; opening controls reveals them within the workspace's own scroll area.
- Home filters make the existing ten scenarios easier to explore. Scene tools use consistent sections, and completion messages appear within the arena so they cannot cover the brain dock.

The MuJoCo environment, fly circuit, walking policy, camera adapters, and research trial definitions are unchanged.

## Verification

1. Home to experiment: browser filter selects the four introductory scenes. A tile starts the actual simulation. Native acceptance covers all ten tiles, image loading, switching watched ducks, covering eyes, moving props, adding/removing ducks, and controller provenance.
2. Folding and Focus: native acceptance compares paused scene configuration, duck telemetry, simulation time, and selected duck before/after layout operations. All remain identical. Enter toggles a native disclosure; Escape restores Focus layout. Browser reload restores saved disclosure choices.
3. Compact windows: inspected 390×844 and 560×640, plus the 1280×720 desktop. Both camera and neural canvas remain visible. The tools drawer measures the dock height and stays above it. `layout-560.json` verifies both experiment selectors are reachable and both monitors are unobstructed after opening controls. No horizontal overflow.
4. Runtime: all 54 existing Node simulation tests pass (`tests.log`). The signed Mac package builds (`build.log`) and its expanded playground acceptance test passes (`native-playground.log`). The first test attempt exposed a harness race that checked a newly selected preset before the worker delivered it; the test now waits for that scene identity.

Screenshots record the current-run review and its refinements. `before-narrow.png` is the previous production interface. `focus-desktop.png` and `narrow.png` show the new layout; `guided-560.png` shows controls deliberately opened inside the compact workspace. Opening controls in a short window can scroll the arena out of that pane until the controls are folded again. The brain stays in its own dock.

Keyboard and layout checks are bounded checks, not a full accessibility certification. This release changes the interface, not the scientific validation status of the experiments.
