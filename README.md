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

Start with a scenario tile on the home page. Each tile explains what to try and opens a running experiment. **Follow the beacon** uses camera input to follow a magenta target; **Out of sight** lets you block that view with a wall. **Follow the flock** gives every duck its own circuit in the same physical world.

The brain dock stays visible beside the scene, or below it in a compact window. Click a duck in the arena or its object chip to watch its eye view and neural activity. Selecting a prop keeps the same duck connected. **Cover eyes** is a one-click reversible intervention. The **Why?** button explains the latest visual input and resulting body command. Manual and reactive controllers are labeled as bypassing circuit control.

Drag props to reposition them, or select one and use the directional buttons below the arena. A running experiment resumes when the drag ends. **Add object** offers ducks and common props; adding one restarts the scene. New ducks connect to the brain dock immediately. **Scene tools** holds exact object settings and advanced experiment controls. Shape changes use **Apply and reset**; position edits use **Move in current run**.

**Scene tools → Recordings & replay** retains the bounded timeline. Rewind to replay recorded input or change a cue and branch. **More → Save scene** exports the scene and seed. **Export recording** also includes physical/neural state and low-resolution frames. **More → Open file** accepts scenes, recordings and adapter reports. Returning to **Scenarios** pauses the local world; **Continue your scene** returns without restarting it.

Under **Scene tools → Experiment tools**, compare controllers on matched target trials or search sensory-adapter weights. Learning uses held-out placements and retains the original weights if the promotion gate fails. These bounded experiments do not establish biological validity or general superiority.

**Use my camera** requests access and connects the camera to the watched duck immediately. Frames stay on the device unless you export a recording. **Stop webcam** releases the camera and returns connected ducks to their own eye cameras.

**More → Collaborate** pairs a host with one guest through manually exchanged invitation/reply codes. The host owns the physics clock; both can edit the scene. Restricted networks may require a TURN relay configured in the connection settings. No shared room directory or hosted relay is included. See the retained [acceptance ledger](docs/implementation/experiment-workspace.md) for measured coverage and remaining checks.

## Deploy and verify

```sh
npm test --prefix web
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test-playground
npx vercel deploy --prod --scope contextmind
```

Deploy from the repository root. `vercel.json` installs `web/` dependencies and publishes `web/dist`; it does not build the native executable. Runtime simulation needs no API key or backend. The website continues running after its assets have loaded, but has no service worker for offline reloads.

## Vision laboratory

Open **Scene tools → Experiment tools → Retinal stimulus bench** to compare the compact motion
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
