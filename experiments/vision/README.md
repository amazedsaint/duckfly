# Visual experiments

`node experiments/vision/evaluate.mjs` runs 30 fixed parameter variations for each
synthetic stimulus family, including ON/OFF expansion and the flash/translation
controls. The report keeps every outcome, with Wilson 95% intervals. It also
sweeps the LPLC2-to-GF gain across seeded neural runs. No parameters are learned
from this evaluation.

The app's **Experiment tools → Looming trials** runs 30 matched seeds per family
in isolated MuJoCo arenas. It compares the compact motion pathway with a reactive
readout and neural interventions. All use 0.30 m/s forward limits. Tests observe
three seconds, retain failed/fallen trials, and distinguish a stop command from
actual stopping distance. Exported reports include contacts after a stop.

This is an engineering evaluation. A lateral moving object can still cause
retinal changes through the duck's own movement. The compact baseline can produce
false alarms in such scenes even though idealized image controls pass. The study
does not establish superiority of a connectome, physiological fidelity, or safety
on a physical robot. Tracking and larger Flyvis flocks remain beyond the current
promotion gate.
