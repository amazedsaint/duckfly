# DuckFly

**Web app:** [duckfly.vercel.app](https://duckfly.vercel.app) · Vercel organization: `contextmind`.

An experiment workspace coupling a selected FlyWire neural circuit to a simulated Microduck robot. Camera pixels become sensory input; circuit activity selects movement intent; Microduck's pretrained walking policy controls the joints. MuJoCo and BAM calculate the physical response.

## Repository layout

| Folder | Contents |
| --- | --- |
| `mac/` | Native AppKit/WebKit host, standalone app packaging and native acceptance checks; retained SwiftUI/RealityKit reference implementation |
| `web/` | Shared experiment UI, camera encoder, neural/physics worker, scene editor and browser checks |
| `shared/` | Robot assets and common visual models, retinal maps, WASM kernel and reference fixtures |
| `research/fly-vision/` | Pinned Python oracle, verified checkpoint export and numerical parity tools |
| `experiments/vision/` | Synthetic falsifiers and retained matched-trial reports |
| `docs/` | Research, deployment records and experiment acceptance evidence |

Both apps run the same experiment workspace. The Mac package includes all runtime assets; it does not require the deployed website or a separately installed Python runtime.

## Run

```sh
npm ci --prefix web
npm run dev --prefix web
```

Open http://localhost:5173. To build and preview production output:

```sh
npm run build --prefix web
npm run preview --prefix web
```

For the standalone Apple Silicon Mac app, with Xcode Command Line Tools installed:

```sh
./mac/scripts/build.sh
open mac/build/DuckFly.app
```

Node 22.12+ is required for development. The resulting Mac app can be copied to `~/Applications`. See [Mac packaging](mac/README.md) and [browser runtime](web/README.md).

## Conduct an experiment

Choose **Follow the beacon** and press **Run**. The duck uses its head camera to detect the magenta target. **Out of sight** adds a physical wall; **Approaching threat** introduces a moving visual hazard. **Follow the flock** gives each duck an independent circuit and camera in the same physical world.

The left panel edits the scene. Drag props in the arena to reposition them, or select an object to edit exact properties in the right inspector. **Apply and reset** rebuilds the arena; **Move in current run** changes a prop without restarting. Add light or odor fields and choose the matching controller to explore modeled sensory responses.

The inspector exposes eye covering and neuron silencing. Open **Neural activity** for the circuit view. Click the explanation below the arena to inspect the visual signal, neural response and resulting command from a recorded tick.

The timeline keeps a bounded recent history. Rewind to a checkpoint and run to replay recorded visual input, or change a cue and branch. **Save** exports the scene and seed; **Export recording** includes complete physical/neural state and low-resolution camera frames. **Open** accepts scenes, recordings and saved adapter reports.

Under **Experiment tools**, compare controllers on matched target trials or search sensory-adapter weights. Learning uses separate training and held-out target placements and retains the original weights if its promotion gate fails. These are bounded experiments, not evidence of biological validity or general superiority.

**Enable webcam** requests camera access only when clicked. Choose the webcam as a duck's vision source. Frames are processed locally and are included only if you export a recording. **Stop webcam** releases the camera.

**Collaborate** pairs a host with one guest through manually exchanged invitation/reply codes. The host owns the physics clock; both can edit the scene. Restricted networks may require a TURN relay configured in the connection settings. No shared room directory or hosted relay is included. See the retained [acceptance ledger](docs/implementation/experiment-workspace.md) for measured coverage and remaining checks.

## Deploy and verify

```sh
npm test --prefix web
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test
npx vercel deploy --prod --scope contextmind
```

Deploy from the repository root. `vercel.json` installs `web/` dependencies and publishes `web/dist`; it does not build the native executable. Runtime simulation needs no API key or backend. The website continues running after its assets have loaded, but has no service worker for offline reloads.

## Vision laboratory

Open **Experiment tools → Retinal stimulus bench** to compare the compact motion
baseline with the full Flyvis reference. The viewer shows a calibrated image and
its 721 retinal samples; Flyvis runs all 45,669 modeled cells locally and displays
T4/T5 activity. The full reference has not been promoted to body control.

The established marker controller remains the default after the new pathway failed
its physical promotion gate. Choose **Retinal motion lab** to try the candidate.
The compact experimental pathway detects ON/OFF expansion and injects modeled
LPLC2 current without also driving LC4. It has an explicit GF gain control and
upstream interventions. Its neural-to-body calibration remains sensitive to gain.
The original marker model is available for comparison and old recordings.

The **Retinal motion lab** preset uses separate left/right views with explicit geometry. This
is a bounded retinal window, not a complete anatomical reconstruction of fly eyes.
Optional head yaw stabilization is a separate engineered controller. Decoded webcam
frames carry their capture clock; duplicated/frozen frames cannot renew freshness.
Pause/resume requires a new camera observation and discards flow across the gap.
Webcam angular calibration is explicitly unknown until measured.

See [validation and limitations](docs/implementation/vision-v2/implementation.md)
and the [reference reproduction instructions](research/fly-vision/README.md).

## Sources and scope

Based on [DesktopFly](https://github.com/DenisSergeevitch/desktop-fly) and [Microduck RL](https://github.com/pollen-robotics/microduck_rl). Original DuckFly code is Apache-2.0. DesktopFly code is MIT. Included FlyWire-derived data is **CC BY-NC 4.0**, requiring attribution and noncommercial use. See [third-party notices](THIRD_PARTY_NOTICES.md).

This uses a selected 668-neuron circuit. Sensory tuning, social drives and the fly-to-duck adapter are modeling assumptions. The walking policy was trained separately; the connectome has not learned biped balance. Simulator results do not establish performance on a physical robot.
