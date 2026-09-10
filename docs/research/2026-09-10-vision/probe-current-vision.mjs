// Read-only research probes of the existing encoder. Does not change the app.
import fs from 'node:fs';
import { VisionEncoder, SensoryAdapter, EYE_WIDTH as W, EYE_HEIGHT as H } from '../../../web/src/lab/vision.js';
import { Brain } from '../../../web/src/brain.js';

function disk(radius, color, x = 24) {
  const pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let u = 0; u < W; u++) {
    const rgb = (u - x) ** 2 + (y - H / 2) ** 2 <= radius ** 2 ? color : [120, 120, 120];
    pixels.set([...rgb, 255], (y * W + u) * 4);
  }
  return pixels;
}
function texture(scale, shift = 0) {
  const pixels = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = Math.floor((x - W / 2) / scale + W / 2 - shift);
    const py = Math.floor((y - H / 2) / scale + H / 2);
    const value = ((Math.floor(px / 4) * 7 + Math.floor(py / 5) * 11) % 17 + 17) % 17 * 12;
    pixels.set([value, value, value, 255], (y * W + x) * 4);
  }
  return pixels;
}
function uniform(color) {
  const pixels = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) pixels.set([...color, 255], p * 4);
  return pixels;
}
function pair(first, second, dt = .1, motionLoom = false) {
  const encoder = new VisionEncoder();
  encoder.encode(first, W, H, 0, 'both', motionLoom);
  const v = encoder.encode(second, W, H, dt, 'both', motionLoom);
  return { loom: [v.loomL, v.loomR], flowExpansion: v.flow.expansion, flowX: v.flow.x, vectors: v.flow.vectors.length };
}
const gray = uniform([120, 120, 120]);
const circuit = JSON.parse(fs.readFileSync(new URL('../../../shared/assets/Brain/circuit.json', import.meta.url)));
const flashEncoder = new VisionEncoder();
flashEncoder.encode(gray, W, H, 0);
const flash = flashEncoder.encode(uniform([240, 30, 30]), W, H, .1);
const brain = new Brain(circuit, 'flash-falsifier');
const flashResponses = Array.from({ length: 5 }, () => brain.step(null, flash));
const staleEncoder = new VisionEncoder(), adapter = new SensoryAdapter();
const fixedPixels = disk(8, [240, 40, 130]);
staleEncoder.encode(fixedPixels, W, H, 0);
const relabeled = staleEncoder.encode(fixedPixels, W, H, 10);
const input = adapter.sense(relabeled, { mode: 'target', source: 'webcam', activeLook: false }, 10);

console.log(JSON.stringify({
  format: 'duckfly-research-probes', version: 1,
  scope: 'Synthetic image probes of unchanged current code; no physical webcam or full-body trial.',
  redDiskExpansion: pair(disk(3, [240,30,30]), disk(10, [240,30,30])),
  blackDiskExpansion: pair(disk(3, [0,0,0]), disk(10, [0,0,0])),
  redDiskAppearanceWithoutExpansion: pair(gray, disk(10, [240,30,30])),
  redDiskTranslation: pair(disk(8, [240,30,30], 20), disk(8, [240,30,30], 24)),
  radialTextureDuckEyeMode: pair(texture(1), texture(1.08), .1, false),
  radialTextureWebcamMode: pair(texture(1), texture(1.08), .1, true),
  uniformRedFlash: { loom: [flash.loomL, flash.loomR], neuralStopTriggered: flashResponses.some(r => r.event.includes('stop reflex')) },
  identicalMotionDifferentAssignedDt: { assigned100ms: pair(texture(1), texture(1, 2), .1, true), assigned200ms: pair(texture(1), texture(1, 2), .2, true) },
  oldFrameRelabeledWithCurrentSimulationTime: { assignedTime: relabeled.time, forward: input.forward, gate: input.gate, limitation: 'Code has no capture timestamp/frame ID; this proves relabeling is accepted, not a physical camera freeze.' }
}, null, 2));
