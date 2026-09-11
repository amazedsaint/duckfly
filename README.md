# DuckFly

[Open DuckFly](https://makeduckfly.com) · [GitHub](https://github.com/amazedsaint/duckfly)

Connect a simulated fly circuit to a Microduck robot. Map **13 available signals to 10 robot actions** in the setup wizard or **Brain → duck** editor, then inspect the live activity and resulting movement.

The app runs on your device, in a browser or a standalone Mac app. Each duck has its own 668-neuron circuit. Scenes have no time limit.

## Try a scene

Choose **Open studio** to browse the scene gallery, or **Try a connection** to start with a visual follower. The setup wizard lets you add ducks and arrange objects, then review their connections before starting.

- **Build a visual follower:** connect walking-pathway activity to movement, or assign a different action.
- **Look without chasing:** use circuit activity to track a beacon with the head.
- **Reverse the steering:** give two ducks opposite mappings and compare their responses.
- **Trigger a kick:** connect a signal to the robot’s trained kick controller.

Scenes come with their connections ready to use. Change **Duck does** on a row, or choose **Add a connection** to pick another signal and response. Added responses keep the duck’s other connections in place.

The studio keeps the selected duck’s camera and fly circuit visible. Drag objects to change its view. Use **Brain → duck** to edit connections while the scene runs, or **Objects & physics** to configure movement paths and physical properties. **Why?** shows the recorded inputs behind an action, including the exact camera frame when available.

Signals are labeled by source. Fly-circuit activity comes from simulated neurons; camera rules and body feedback are separate inputs. The robot’s trained controllers handle joint movement and balance. The full Flyvis model is available in a separate vision test bench and does not drive the live duck.

## Run locally

Requires Node.js 24 and npm. No API keys are needed to run the app.

```sh
git clone https://github.com/amazedsaint/duckfly.git
cd duckfly
npm ci --prefix web
npm run dev --prefix web
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

```sh
npm test --prefix web
npm run build --prefix web
npm run preview --prefix web
```

The build prepares the shared models and copies the required WebAssembly runtimes into `web/public/`. These generated copies and `web/dist/` are ignored by Git.

## Build the Mac app

On an Apple Silicon Mac with Xcode Command Line Tools installed:

```sh
npm ci --prefix web
./mac/scripts/build.sh
open mac/build/DuckFly.app
```

The package contains its own runtime assets and works without the deployed website or a separate Python installation. It is a local development build; see [Mac packaging](mac/README.md) for distribution details.

## Repository layout

| Folder | Contents |
| --- | --- |
| `mac/` | Native host, app packaging and Mac acceptance checks |
| `web/` | Studio UI, browser runtime and app tests |
| `shared/` | Robot assets, common vision models and reference fixtures |
| `experiments/` | Experiment runners and retained research results |
| `research/` | Pinned reference implementations and numerical validation tools |
| `docs/` | Design notes, research proposals and acceptance records |

The web and Mac apps use the same studio and simulation. Keep shared assets at the repository root when building either app.

## GitHub and Vercel

The public repository is `amazedsaint/duckfly`. The Vercel project is `contextmind/duckfly`, with `makeduckfly.com` as the public app domain.

Vercel builds from the repository root using [`vercel.json`](vercel.json):

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Install command | `npm ci --prefix web` |
| Build command | `npm run build --prefix web` |
| Output directory | `web/dist` |
| Production branch | `main` |

Pushes to `main` deploy to production. Other branches receive preview deployments through the Vercel GitHub integration. GitHub Actions runs the app tests and production build on pushes and pull requests.

Keep credentials in your local environment or Vercel settings. `.env*` files and `.vercel/` are excluded from Git. Neither the Mac app nor the browser needs a Vercel token to run.

## Experiment notes

The repository retains failed trials alongside passing results. A working demonstration does not establish biological accuracy or performance on a physical robot.

- [Visual triggers and action mappings](docs/research/visual-behavior-proposal/selected-connections.md)
- [Brain and body experiments](experiments/embodied/RESULTS.md)
- [Vision and feedback experiments](docs/experiments/playground/README.md)
- [Scene interaction audit](docs/experiments/scene-audit/README.md)

Webcam input is optional. Frames stay on the device unless included in an exported recording. Collaboration shares scene edits and decision signals; camera images remain with the host.

## Sources and licenses

DuckFly builds on [DesktopFly](https://github.com/DenisSergeevitch/desktop-fly) and [Microduck RL](https://github.com/pollen-robotics/microduck_rl). Physics uses MuJoCo with BAM actuator models. The reference vision bench uses [Flyvis](https://github.com/TuragaLab/flyvis).

Code and bundled assets retain their respective licenses. The root [Apache-2.0 license](LICENSE) does not replace third-party terms. In particular, the included FlyWire circuit data is **CC BY-NC 4.0**. See [third-party notices](THIRD_PARTY_NOTICES.md) for source revisions, attribution and model provenance.
