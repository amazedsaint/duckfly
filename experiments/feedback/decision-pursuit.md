# Pursuit decision, before held-out evaluation

Pilot `pilot-v1`: coordinate-only mean final error 0.297684 m; coordinated gaze 0.298472 m; original 0.260352 m. Neither candidate merits promotion. Complete the planned held-out evaluation with the coordinate-only candidate, selected by the preregistered mean-error rule, to quantify the negative result on fresh seeds.

The ablation `body-no-pose` retains exactly the coordinate-only candidate's head command (`0.3 × corrected bearing`) while removing correction from neural steering input. This differs from the stronger-gaze pilot ablation, and is necessary for a matched comparison. No coefficients are tuned. Compare original, active-head, body-coordinates and body-no-pose on 24 fresh seeds per family.

Do not expand the gait-feedback branch. In the coordinated controller pilot, measured phase (0.298472 m) did not outperform feedback disabled (0.295775 m) or unrelated phase (0.292695 m). This does not justify a useful phase-specific feedback claim or a production change to feedback settings.
