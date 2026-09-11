# Full Flyvis WebGPU feasibility gate

Separate experiment only. Do not modify packaged weights, WASM, shared runtime or production UI. Reuse every pinned float32 parameter and original state. Build a target-CSR representation by stable insertion in original edge order. Each output neuron accumulates incoming edges sequentially in that order; do not use parallel tree reduction or redesign neurons. Double-buffer recurrent states between complete dispatches.

First record actual browser adapter information, including fallback status, and host identity. An unavailable adapter is unsupported. A software fallback result cannot establish hardware speed. Read primary WebGPU/WGSL documentation for buffer ownership, queue completion and numeric accuracy.

Before benchmark timing, compare every neuron in retained complete states against the current WASM implementation on fixed held stimuli. Include neutral/black/white inputs, translating ON/OFF patterns and flicker, deterministic spatial noise, and actual retained arena frames. Check early transitions and continued evolution. Use the existing model-port tolerance: absolute2e-5 plus relative2e-5 times the expected value, chosen before this GPU run. Report all element violations, maximum absolute error and retained state arrays. No tuning against a failed tolerance.

Require exact same-backend checkpoint continuation. Test independently owned eye states with different inputs, inactive-eye preservation, fresh-group initialization, caller mutation after submission, returned-snapshot isolation and refusal of overlapping operations on one group. Disposed groups must reject further work. Report WebGPU validation errors/device loss and stop timing if any numerical or ownership gate fails.

If all gates pass, benchmark1/2/8 ducks as2/4/16 independent eyes. One group means20 model steps per eye at dt2ms, representing40ms of neural time. Measure upload, command encoding/submission and full-state readback/copy in the GPU group timing. Measure the equivalent WASM input/scatter plus full-state checkpoint workload in the same browser. Exclude initial weight upload/compilation and report setup separately. Use bounded warm-up and repeated groups; report median/p95 and every raw timing. Camera rendering and body physics are outside this neural-backend benchmark.

Passing this gate permits further backend integration work, not deployment or a claim of additional biological fidelity.
