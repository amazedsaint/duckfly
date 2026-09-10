# Web port and folder migration validation

Verified locally on 2026-09-10. This is simulator and browser evidence. These initial checks preceded Vercel deployment. Live production evidence is retained separately in `../../deployments/production.json`. No physical robot or biological claim is validated.

## Runtime checks

`engine-tests.log` records the JavaScript suite running actual MuJoCo 3.10.0 WebAssembly and ONNX Runtime Web 1.24.3. It covers gzip loading across server behaviors, BAM parity on 128 independently generated native vectors (absolute tolerance 1e-12), and eight ONNX input/output comparisons (5e-5 tolerance).

The same suite compares initial geometry poses to native MuJoCo (1e-9 tolerance) and a 20-tick trajectory (2 mm position / 0.025 rad joint tolerance). It verifies repeated reset trajectories, command handling, physical walking, and the complete neural intent path. Long runs are behavioral checks; they are not asserted bitwise identical to the Swift/Python app.

Retained results:

| Run | Result |
| --- | --- |
| WASM fixed forward command, 10 simulated seconds | 1.5341 m travelled, foot contact onsets 24 / 25, no fall |
| WASM neural command schedule | 578 walking ticks, 1.8358 m travelled including final silence phase, no fall |
| Native rebuilt app integrated self-test | 572 walking ticks, 1.8238 m travelled, no fall; silence, loom and exact reset passed |
| Native worker suite after moving to `mac/` | 5 tests passed |

The slightly different neural trajectories reflect separate Swift and JavaScript floating-point implementations; the web tests enforce deterministic reset within the browser implementation.

## Browser checks

`browser-smoke.log` records a headed Chromium run of the **production build**, exercising controls through the UI. It verifies pause without time drift, reset pose, neural walking, the loom reflex, output silence, manual steering and stop, follow/view controls, and the About dialog. `browser-layout.log` verifies that a loaded session moves with networking disabled, and that a 390 px viewport has no horizontal overflow. Desktop and narrow viewport screenshots are retained alongside the report.

The model loader initially used MuJoCo's `MjVFS.addBuffer`, which marshaled this 82 MB expanded model byte by byte and took about 30 seconds locally. Using `FS.writeFile` before `from_binary_path` reduced the isolated module / model loading probe to 0.265 seconds. Network transfer and first browser WASM compilation add time beyond that probe.

## Packaging

`build.log` records the Vite production build. The distribution serves local copies of the WASM runtimes and all required models; no Python files or native app bundles are included. `vercel.json` at the repository root specifies the install/build commands and `web/dist` output.

`mac-self-test.json` and `mac-engine-tests.log` were generated from the restructured repository. Earlier evidence in the parent validation folder preserves the original native build before the folder migration.

A clean static build also passed from an isolated copy with the entire `mac/` folder absent. See `clean-static-build.json` and its build log. The published output contains zero Python files.
