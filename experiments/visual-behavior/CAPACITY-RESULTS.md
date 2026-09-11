# Full-reference stereo capacity result

The full packaged Flyvis model preserved independent eye state and released its eye allocations, but the first lifecycle check failed: a disposed eye handle could still read and overwrite the state memory after it had been reused by another eye. This defect has since been repaired and regression-tested. The failed result and its exact original source remain unchanged under `reports/capacity-v1/`.

This is an offline diagnostic on an Apple M2 Max with 12 logical CPUs, 64 GiB RAM and Node v24.19.0. Each measured group interval updates every eye for 40 ms of neural time (20 actual 2 ms WASM steps), extracts the signed 8-population spatial maps, then runs the frozen v2 map-flow decoder. Values below are percentiles of 64 measured **complete group intervals**, after four warmup intervals. They are not sums of per-eye percentiles.

| Ducks | Independent eyes | Complete group median | Complete group p95 | Complete group max | Core-only group median |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 66.42 ms | 67.75 ms | 72.40 ms | 63.96 ms |
| 2 | 4 | 132.45 ms | 134.46 ms | 137.45 ms | 127.40 ms |
| 8 | 16 | 529.49 ms | 907.54 ms | 1,138.23 ms | 509.62 ms |

Included: recurrent updates and model input mapping, signed map extraction/copies, decoder and loop overhead. Excluded: model loading, conditioning, generating retinal inputs, image capture/projection, worker transfer, JSON export, UI and physical simulation. Conditioning used 500 actual model steps per eye and is reported separately. This is not an end-to-end or 25 Hz capacity claim. Even one duck's measured core group exceeded its 40 ms neural interval on this configuration.

The machine was not idle. Separate Node work was near 100% CPU at samples before and after groups. A concurrent Next server rose from approximately 102% to 433% by the end of the eight-duck group, alongside other system activity. Those sampled observations do not identify the cause of each slow interval. The order was always 1, 2, 8 ducks; workload and order can confound comparisons. All raw group durations and sampled process summaries are retained.

## Ownership and allocation checks

Stepping one eye left every untouched eye bit-identical at all group sizes. Restoring the stepped eye restored its exact initial state without changing peers. Each eye used three allocations totalling 548,028 bytes. The 16-eye group added 8,768,448 live bytes to the 18,524,124-byte fixed model allocations.

Disposing all eyes returned every group to five fixed allocations and zero live eyes. Repeating create/dispose 64 times caused no additional WASM reservation growth. Disposing the model left zero live allocations. The reserved linear memory remained at its 28,442,624-byte high-water mark, which is distinct from a leak in live allocations.

The original stale-handle probe failed. `step()` rejected a disposed handle, but `checkpoint()` and `restore()` did not. After confirming that a replacement eye occupied the same live state pointer, restoring through the old disposed handle changed the replacement's full state hash. No write was attempted into an unallocated block. Allocation release alone cannot establish ownership safety.

The repair rejects checkpoint/restore after eye or model disposal, and rejects allocation after model disposal. It does not change the neural update, WASM, model weights or frozen v2 decoder. A focused regression verifies actual pointer reuse, rejects the old handle's reads/writes, and confirms that the replacement remains unchanged. It also rechecks all 16 eyes' independence, repeated allocation release and disposed-model operations. The full 1,000-step numerical oracle, spatial extraction and v2 tests pass with the repair: 14 tests, zero failures. The performance benchmark was not repeated for this guard-only change, so the timing table describes its archived original runtime. See `reports/lifecycle-fix/summary.json` and `reports/lifecycle-fix/tests.log`.

## Retained evidence

- Protocol: `CAPACITY-PROTOCOL.md`.
- Runner: `run-capacity.mjs`.
- Full raw timings, ownership checks, source/model hashes and machine/load metadata: `reports/capacity-v1/summary.json`.
- Exact source archive: `reports/capacity-v1/sources/`.
- Run log: `reports/capacity-run.log`.
- An earlier attempt was deliberately stopped during harness review before the stale-handle probe. Its partial timings remain in `reports/capacity-aborted-harness-review.log`; they are not included in the result. The review changed the probe so it only writes through an old handle after a replacement has reused the allocation.

The frozen v2 readout remains unchanged. No body behavior or ordinary scene was promoted by this benchmark.
