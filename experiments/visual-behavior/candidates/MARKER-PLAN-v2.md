# Clear-marker v2, before new held-out evaluation

Keep v1 source and results unchanged. V1 passed its aggregate synthetic gates, but four safe movies had no acquisition; the actual separated-distractor cohort reached only87.5% coverage. The original color predicate leaves disconnected edge fragments for some of the sampled colors. The broad motion gate also treated a distant blob as equally plausible even when the tracked blob remained close to its predicted position.

V2 joins small mask fragments within2.5 pixels, using the unchanged color predicate. It compares candidate distances to the predicted position and latches ambiguity when the runner-up is within3 pixels of the best candidate; close-boundary merge and area-growth safeguards remain. No object label or hidden position is admitted. This is an engineering repair learned from v1, not an untouched hypothesis.

Use fresh `marker-v2-*` seeds for6 calibration and24 held-out movies per family, with identical family definitions to allow comparison. Freeze sources before held-out evaluation. Strengthen the safe tracking coverage gate: at least90% in every safe movie, not only in pooled family totals. Keep zero confident ambiguous association and zero brief-flash/no-marker acquisition requirements. Conditional wrong-position rate remains≤1%, with all abstentions and movie counts reported. Exact continuation and source/reset tests must still pass.

The original rendered cohort becomes a diagnostic repair check. It cannot be called new validation. Capture a separate rendered transfer cohort with changed distances, marker sizes and speeds before recommending an app trial. Short occlusion recovery and persistent identical-object ambiguity remain explicit limits; no biological or body-policy claim follows.
