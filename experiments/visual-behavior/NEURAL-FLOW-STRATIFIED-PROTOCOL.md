# Candidate 2: stratified coverage confirmation

Source review found that consecutive seeds into the earlier simple LCG produced narrow first draws. Candidate 1's actual held-out wavelengths were 17.290–17.380 degrees; candidate 2's were 15.491–15.581 degrees. Contrast, speed and phase were broad, but those runs cannot establish broad spatial-frequency performance. Their original evidence remains retained and their summaries receive an explicitly dated coverage annotation with the pre-annotation summary preserved.

This confirmation does **not** change candidate 2's algorithm or confidence threshold. The same 16 calibration movies are rerun, and the runner must reproduce the exact threshold from `neural-flow-v2/calibration.json` or stop. No parameter retuning is allowed.

Fresh held-out identities are seeds **8000–8029**, with directions **33.75+45k** degrees, disjoint from both previous held-out angle sets. Thirty explicit strata cover each declared wavelength, speed, contrast and phase interval. Coprime permutations alter each parameter's stratum order. Every matched movie family receives the same parameter tuple for a seed.

Before loading the model, `assertNeuralFlowCoverage` must verify all eight bins and at least 80% of the declared interval span for every varied scalar parameter. It also checks held-out/calibration angle separation, direction-bin coverage and the required seed/family counts. The original narrow generators are regression fixtures that must fail this check. This admission is a generator check, not evidence that the model passes the task.

The nine movie families, 286-trial count, frame timing, conditioning, neural decoder and motor-unpromoted boundary remain unchanged. All motion, rate, sustained-confound and ablation gates from candidate 2 remain fixed. Isolated false frames stay visible. Every failure remains in the denominator. Representative replay must match neural-map hashes and decoder diagnostics exactly.
