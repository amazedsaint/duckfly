struct Node { bias: f32, tau: f32, inputSlot: u32, padding: u32 }
struct Parameters { nodes: u32, eyes: u32, receptors: u32, dt: f32 }
@group(0) @binding(0) var<storage, read> offsets: array<u32>;
@group(0) @binding(1) var<storage, read> sources: array<u32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<storage, read> nodes: array<Node>;
@group(0) @binding(4) var<storage, read> previous: array<f32>;
@group(0) @binding(5) var<storage, read_write> next: array<f32>;
@group(0) @binding(6) var<storage, read> retina: array<f32>;
@group(0) @binding(7) var<uniform> parameters: Parameters;

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) id: vec3<u32>) {
  let neuron = id.x;
  let eye = id.y;
  if (neuron >= parameters.nodes || eye >= parameters.eyes) { return; }
  let base = eye * parameters.nodes;
  var current = 0.0f;
  for (var edge = offsets[neuron]; edge < offsets[neuron + 1u]; edge++) {
    let product = weights[edge] * max(previous[base + sources[edge]], 0.0f);
    current = current + product;
  }
  let node = nodes[neuron];
  var input = 0.0f;
  if (node.inputSlot != 0xffffffffu) { input = retina[eye * parameters.receptors + node.inputSlot]; }
  let v = previous[base + neuron];
  let a = -v + node.bias;
  let b = a + current;
  let c = b + input;
  let inverseTau = 1.0f / max(node.tau, parameters.dt);
  let derivative = inverseTau * c;
  let increment = derivative * parameters.dt;
  next[base + neuron] = v + increment;
}
