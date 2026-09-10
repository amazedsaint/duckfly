# Pinned visual reference

The application does not require Python. This directory reproduces the numerical
oracle used to validate the shared WebAssembly core.

```sh
./research/fly-vision/setup.sh
./research/fly-vision/run-reference.sh
./shared/vision/wasm/build.sh
node research/fly-vision/verify-port.mjs
node research/fly-vision/package-model.mjs
```

Development prerequisites: `uv`, Rust with the `wasm32-unknown-unknown` target,
and Node. The isolated Python 3.12 environment is ignored by Git. Full dependency
versions are retained in `requirements.txt`. Download uses the public archive,
without the API key embedded in upstream's older download helper. Its SHA-256
must match before extraction. Dotenv loading is disabled.

The source is Flyvis commit `92b3845cc426dd309a1a0e1b3890156c42e14021`.
Published checkpoint `flow/0000/000/best_chkpt` is compared tensor by tensor to the
checkpoint loaded by NetworkView. Both file hashes are in the model manifest.
NetworkView converts the published checkpoint to its current directory format;
the different container hashes do not imply different neural weights.

Export preserves all 45,669 modeled cells and 1,513,231 edges, in their original
accumulation order. Parameters are obtained after upstream clamping. The update
uses Float32 and 2 ms integration. A 1 s fade-in uses the upstream implementation.
The port test checks the complete initial fade-in, then full states at retained
checkpoints across 1,000 integration steps. It also tests exact continuation and
separate eye state. Tolerances were set to absolute/relative 2e-5 before running;
the observed maximum difference on this Mac was zero.

`artifacts/` retains the larger oracle traces locally. Small golden fixtures are
checked in under `shared/vision/fixtures/` so `npm test --prefix web` needs no
Python environment or network access. Application model assets are packaged only
after the parity gate passes. The compact retinal map has explicit axial
coordinates; input is reordered by coordinate identity rather than array length.

## Claim boundary

This is numerical reproduction of one published model. The ON/OFF and directional
probes in its manifest are synthetic tuning measurements. They have not been fit
to calcium data or validated against held-out physiological recordings. Some
individual cell-type tuning differs from the expected idealized response.

Flyvis ends before the LPLC2/GF pathway. The app therefore exposes full Flyvis
responses in the retinal bench, with its body bridge explicitly unpromoted. The
compact motion path can drive the experimental LPLC2 current input independently.
Its GF gain dependence is retained as a failed robustness gate. Neither result
establishes a complete fly nervous system or control superiority.
