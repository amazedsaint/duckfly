# Shared assets

`assets/Brain` contains DesktopFly's selected 668-neuron FlyWire circuit and data terms. Both experiment apps load `circuit.json`. `assets/Policies/alpha_walking.onnx` is the pinned Microduck walking policy. Source meshes and MJCF remain in `assets/Robot`.

`assets/scene.json` contains render meshes exported by the native MuJoCo engine. Every rendered robot part uses a live physical geometry pose. There is no independent gait animation.

`assets/Simulation/lab-template.json.gz` is the editable physical template used by both experiment apps. `web/scripts/export-lab-template.py` preserves source inertia, BAM configuration and collision geometry, with shared mesh assets and an outward-facing head camera. Runtime assembly prefixes each duck's names before compiling one shared MuJoCo world. Physical parity evidence is retained in `docs/implementation/lab-template-evidence.json`.

`assets/Simulation/microduck.mjb.gz` and `config.json` remain as the original MuJoCo 3.10.0 reference model. They support independent numeric checks and can be regenerated using `web/scripts/export-reference.py`. The large compiled model is excluded from normal app packaging and web deployment.

Licenses are in `licenses/` and alongside the circuit data. Full provenance is in the root `THIRD_PARTY_NOTICES.md`.
