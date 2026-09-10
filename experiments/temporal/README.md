# Temporal camera decoder and GF feedback study

This directory contains the implemented research candidates and their measured evidence. **The current candidate failed its false-stop promotion gate.** See [RESULTS.md](RESULTS.md) for the measured benefit and failure boundary. The app's default vision models and recorded-scene semantics are separate. [PROTOCOL.md](PROTOCOL.md) records the initial experiment; [FOLLOWUP.md](FOLLOWUP.md) records the validation-selected no-pose candidate before its independent physical test.

The decoder consumes pooled stereo camera sequences captured from the walking duck. Its scalar risk score enters the existing LC4/LPLC2 route as a bounded pulse. An actual GF event can engage a stop supervisor; fresh low-risk evidence and measured slowing are both required to release that hold. Neither the circuit weights nor the ONNX walking policy were trained in this study.

## Run the retained visual replay

`replay.html` is self-contained and can be opened directly in a browser, or served locally:

```sh
python3 -m http.server 5191 --bind 127.0.0.1 --directory experiments/temporal
```

Open `http://127.0.0.1:5191/replay.html`. Choose a recorded scene and scrub the timeline to compare retinal inputs with each model's score. This is an input replay, not a live brain-controlled simulation. The training recordings used independently scheduled motion.

## Reproduce the study

From the repository root, using the existing web dependencies:

```sh
npm run prepare:assets --prefix web
web/node_modules/.bin/vite --config experiments/temporal/server.mjs
```

Open these URLs in a WebGL-capable browser. Use new run names for replicas; the server will not replace completed evidence.

- Training collection: `http://127.0.0.1:5190/tests/temporal-harness.html?split=train&seeds=32&run=replica-train`
- Validation collection: `http://127.0.0.1:5190/tests/temporal-harness.html?split=validation&seeds=8&run=replica-validation`

Train with Python, NumPy, PyTorch and scikit-learn. The exact versions used are recorded in `reports/environment.json`. The default inputs below use the retained original camera data; use `--train` and `--validation` to select newly collected reports.

```sh
python3 experiments/temporal/train.py --out experiments/temporal/models/replica
node experiments/temporal/bridge-probe.mjs
node --test web/tests/temporal-feedback.test.mjs
```

The runner imports the frozen `models/v1` files. It checks the selected model's perception gate before starting. The full-pose model failed that gate. The passing no-pose candidate's independent physical follow-up is:

`http://127.0.0.1:5190/tests/temporal-physical.html?split=confirm&seeds=16&decoder=no-pose&run=replica-physical`

```sh
python3 experiments/temporal/analyze-physical.py experiments/temporal/reports/temporal-physical-confirm-v1.json.gz --output experiments/temporal/reports/physical-summary.json
python3 experiments/temporal/inspect-models.py
python3 experiments/temporal/verify.py
shasum -a 256 -c experiments/temporal/guarded-frozen.sha256
shasum -a 256 -c experiments/feedback/fixed-controller.sha256
```

Restart the research server after code edits. Each new run supplies hashes embedded in the served modules; stale modules or model artifacts are rejected before collection starts. Accepted starts archive the checked sources alongside the report. The historical v1 cadence deviation and intended/executed source archives are explained in [RESULTS.md](RESULTS.md); `verify.py` checks those historical manifests against the appropriate archive.

The server retains each completed trial in an append-only JSONL file. A complete, duplicate-free run also gets a losslessly compressed JSON report. The JSONL working files remain on disk but are excluded from Git. An interrupted or partial physical study cannot receive a promotion decision. This runner does not currently resume interrupted physical studies.

## Claim boundaries

The labels use programmed scene geometry during supervised training and evaluation. The decoder receives camera inputs and measured feedback only; inference does not read object positions or velocities. It is an engineered collision-risk adapter, not a reconstruction of biological fly vision. Full Flyvis remains a separate retinal-bench model.

The experiments cover a procedural simulator distribution with grayscale objects and bounded motion. They do not establish arbitrary webcam, real-camera or physical-robot performance. The learned scores are not calibrated collision probabilities. No-pose means camera angular velocity and head-alignment features are zeroed; measured body speed and gait feedback are still present.

`control.js` installs research-only wrappers around an `Experiment`. Those wrappers are not part of production recordings. Their internal feature and hold states have JSON replay tests, but production recording integration is a separate gate. Camera source changes and missing/covered input must discard old clear evidence while preserving an already-engaged hold.
