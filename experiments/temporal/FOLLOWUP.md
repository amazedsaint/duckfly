# Frozen no-pose follow-up, 2026-09-10

Written after validation and before any physical candidate results. The preregistered full temporal decoder had AUROC 0.9919 but no allowed threshold met the harmless-trajectory false-trigger limit. It failed its gate and is not eligible for the original physical promotion study. The static model reached only 45.8% timely detection at its qualifying threshold.

The separately retrained, preregistered no-pose control passed the same perception criteria: AUROC 0.9907, 21/24 timely hazardous trajectories and 4/40 false-trigger harmless trajectories at threshold 0.98. Its inputs still contain stereo temporal history and measured body speed / gait phase; camera angular velocity and head alignment are zeroed. This supports testing a simpler temporal candidate, not a claim that learned pose compensation improved vision.

Freeze that existing artifact without retraining or changing its threshold. Run the same 16 fresh seeds per family and six physical conditions from `PROTOCOL.md`, substituting the no-pose temporal model wherever the original full temporal decoder was specified. Keep the static control's own validation-selected threshold of 0.95. Use split `confirm`, which has not been collected or inspected. Use `decoder=no-pose` in the runner; its report must explicitly identify the artifact and its hash. The original default full-model study remains locked by its failed perception gate.

Every physical promotion gate is unchanged. Retain all outcomes; do not select only successful families. This is a validation-selected follow-up with an independent physical test, not a successful preregistered full-pose experiment. If it fails, retain the runnable code and findings without promoting either learned controller.

The fixed-threshold full-model diagnostic at 0.98, including reversed history and incorrect-pose interventions, may still be reported as a failed-model diagnostic. It cannot unlock physical promotion or replace its null selected threshold.
