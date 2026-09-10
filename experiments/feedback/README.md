# Vision and feedback studies

These are research harnesses for the actual DuckFly eye renderer, MuJoCo physics and fixed ONNX walking policy. Candidate adapters live here; product defaults remain separate. See [protocol.md](protocol.md) for the questions, controls and promotion gates written before each study.

## Reproduce

From the repository root, with the existing web dependencies installed:

```sh
npm run prepare:assets --prefix web
web/node_modules/.bin/vite --config experiments/feedback/vite.config.mjs
```

Open one of these in a WebGL-capable browser. Each `run` name must be new; completed evidence cannot be overwritten by the runner.

- Pursuit pilot: `http://127.0.0.1:5188/tests/feedback-harness.html?split=pilot&seeds=4&run=pilot-replication`
- Pursuit confirmation: `http://127.0.0.1:5188/tests/feedback-harness.html?split=heldout&seeds=24&conditions=original,active-head,body-coordinates,body-no-pose&run=pursuit-replication`
- Rotation pilot: `http://127.0.0.1:5188/tests/motion-feedback-harness.html?split=pilot&seeds=4&run=rotation-replication`
- Fixed gain-10 follow-up: `http://127.0.0.1:5188/tests/motion-feedback-harness.html?split=gainpilot&seeds=4&gain=10&conditions=baseline,original,rotation,inverted&run=gain-replication`

The local server writes each completed trial to `reports/<run>.jsonl`, then a losslessly compressed `reports/<run>.json.gz` on completion. An interrupted run retains its completed trials but cannot receive a promotion decision. Compact progress appears in the browser. The server binds to localhost, checks the request origin, and accepts only restricted report names.

```sh
node experiments/feedback/geometry-check.mjs
python3 experiments/feedback/analyze.py experiments/feedback/reports/pursuit-heldout-v1.json.gz --candidate body-coordinates --ablation body-no-pose
python3 experiments/feedback/analyze-motion.py experiments/feedback/reports/motion-pilot-v1.json.gz
python3 experiments/feedback/analyze-motion.py experiments/feedback/reports/motion-gain10-pilot-v1.json.gz --baseline baseline
python3 experiments/feedback/verify.py
shasum -a 256 -c experiments/feedback/fixed-controller.sha256
```

Both analyzers retain all failures and use a deterministic paired bootstrap, stratified by scenario family. The study files include per-motor-tick traces, with actual commands and measured camera pose. Scene coordinates define the environment and evaluation metrics; controllers receive camera pixels and camera/body feedback.

## Scope

The perception candidates are engineered adapters around the selected DesktopFly circuit. They are not reconstructions of a fly's visual system. Full Flyvis remains in the retinal bench; it is not driving the duck in these studies. The experiments assess a virtual duck and do not establish performance on hardware or arbitrary webcam scenes.

`fixed-controller.sha256` pins the circuit, policy and motor implementation. `pursuit-frozen.sha256` records the held-out pursuit candidate. The gain-6 motion source snapshot in `sources/gain6` matches `motion-frozen.sha256`; its subsequent optional gain argument and baseline condition are recorded in `motion-gain10-frozen.sha256`.

The research server disables automatic file watching so editing reports cannot reset a running study. Restart it deliberately after changing experiment code. A stopped pursuit run can resume with the same URL plus `&resume=1`; only unfinished case/condition pairs run again. It checks matching study metadata and rejects duplicate trials before marking completion.

The held-out pursuit run was interrupted by the earlier development server's global reload after 284 trials. Its candidate and scene-source hashes still matched the frozen files. Those trials were retained, and the remaining 100 were continued using the resume path. The JSONL receipt records the resume boundary. No results were dropped or retuned.

[RESULTS.md](RESULTS.md) contains the findings and next experiments. [verification.json](reports/verification.json) records completed counts, compressed-data hashes and the resume boundary. Optional `verify.py --mac-assets <installed-app>/Contents/Resources/Web/assets` also checks the installed Mac entry bundles against this build.
