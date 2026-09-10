# DuckFly

**Web app:** [duckfly.vercel.app](https://duckfly.vercel.app) · Vercel organization: `contextmind`.

An experiment workspace coupling a selected FlyWire neural circuit to a simulated Microduck robot. Camera pixels become sensory input; circuit activity selects movement intent; Microduck's pretrained walking policy controls the joints. MuJoCo and BAM calculate the physical response.

## Repository layout

| Folder | Contents |
| --- | --- |
| `mac/` | Native AppKit/WebKit host, standalone app packaging and native acceptance checks; retained SwiftUI/RealityKit reference implementation |
| `web/` | Shared experiment UI, camera encoder, neural/physics worker, scene editor and browser checks |
| `shared/` | Robot geometry, physical model template, ONNX policy and attributed circuit data |
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

## Sources and scope

Based on [DesktopFly](https://github.com/DenisSergeevitch/desktop-fly) and [Microduck RL](https://github.com/pollen-robotics/microduck_rl). Original DuckFly code is Apache-2.0. DesktopFly code is MIT. Included FlyWire-derived data is **CC BY-NC 4.0**, requiring attribution and noncommercial use. See [third-party notices](THIRD_PARTY_NOTICES.md).

This uses a selected 668-neuron circuit. Sensory tuning, social drives and the fly-to-duck adapter are modeling assumptions. The walking policy was trained separately; the connectome has not learned biped balance. Simulator results do not establish performance on a physical robot.
