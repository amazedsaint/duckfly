// Experimental pixel readouts. These are not LC11/LPLC2 neuron simulations.
// Their deliberately narrow domain is a contrasting silhouette against a locally
// uniform image border. Unsupported backgrounds are reported, never called clear.
export const WIDTH = 96;
export const HEIGHT = 64;
const N = WIDTH * HEIGHT;
export const CANDIDATE_SETTINGS = Object.freeze({
  version: 1, width: WIDTH, height: HEIGHT, minimumContrast: .12,
  borderSpreadLimit: .08, relativeThreshold: .48, minimumArea: 5,
  smallMaximumDiameter: 16, smallMaximumAspect: 1.8,
  eventTravelPixels: 1.6, eventQuietSeconds: .24,
  historySeconds: .20, expansionMinimumWindow: .12,
  expansionRatePixelsPerSecond: 2, expansionFitMinimum: .82,
});

const copy = x => structuredClone(x);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const quantile = (sorted, q) => sorted[Math.floor(q * (sorted.length - 1))];

function silhouettes(pixels) {
  if (!(pixels instanceof Uint8Array) || pixels.length !== N * 4) throw Error('Expected 96x64 RGBA Uint8Array');
  const gray = new Float32Array(N), border = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x, j = i * 4;
    gray[i] = (.299 * pixels[j] + .587 * pixels[j + 1] + .114 * pixels[j + 2]) / 255;
    if (x < 2 || x >= WIDTH - 2 || y < 2 || y >= HEIGHT - 2) border.push(gray[i]);
  }
  border.sort((a, b) => a - b);
  const background = quantile(border, .5), spread = quantile(border, .95) - quantile(border, .05);
  if (spread > CANDIDATE_SETTINGS.borderSpreadLimit) return {supported: false, reason: 'nonuniform-border', components: [], spread};
  const components = [];
  for (const polarity of [-1, 1]) {
    let peak = 0;
    for (const v of gray) peak = Math.max(peak, polarity * (v - background));
    if (peak < CANDIDATE_SETTINGS.minimumContrast) continue;
    const threshold = Math.max(.08, peak * CANDIDATE_SETTINGS.relativeThreshold);
    const seen = new Uint8Array(N), queue = new Int32Array(N);
    for (let start = 0; start < N; start++) {
      if (seen[start] || polarity * (gray[start] - background) < threshold) continue;
      let head = 0, tail = 1, sx = 0, sy = 0, minX = WIDTH, maxX = 0, minY = HEIGHT, maxY = 0;
      queue[0] = start; seen[start] = 1;
      while (head < tail) {
        const i = queue[head++], x = i % WIDTH, y = Math.floor(i / WIDTH);
        sx += x; sy += y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const neighbors = [];
        if (x > 0) neighbors.push(i - 1);
        if (x + 1 < WIDTH) neighbors.push(i + 1);
        if (y > 0) neighbors.push(i - WIDTH);
        if (y + 1 < HEIGHT) neighbors.push(i + WIDTH);
        for (const j of neighbors) if (!seen[j] && polarity * (gray[j] - background) >= threshold) {seen[j] = 1; queue[tail++] = j;}
      }
      if (tail < CANDIDATE_SETTINGS.minimumArea) continue;
      components.push({x: sx / tail, y: sy / tail, area: tail, width: maxX - minX + 1,
        height: maxY - minY + 1, radius: Math.sqrt(tail / Math.PI), polarity,
        clipped: minX <= 1 || maxX >= WIDTH - 2 || minY <= 1 || maxY >= HEIGHT - 2});
    }
  }
  return {supported: true, reason: null, components, spread};
}

function match(previous, components, maxDistance = 9) {
  if (!previous) return null;
  let best = null, bestDistance = maxDistance;
  for (const c of components) {
    const d = distance(previous, c), ratio = c.area / previous.area;
    if (c.polarity === previous.polarity && ratio > .45 && ratio < 2.2 && d < bestDistance) {best = c; bestDistance = d;}
  }
  return best;
}

function fit(history, key) {
  const mt = history.reduce((s, h) => s + h.time, 0) / history.length;
  const my = history.reduce((s, h) => s + h[key], 0) / history.length;
  let tt = 0, ty = 0, yy = 0;
  for (const h of history) {const t = h.time - mt, y = h[key] - my; tt += t * t; ty += t * y; yy += y * y;}
  return {slope: tt > 0 ? ty / tt : 0, r2: tt * yy > 1e-12 ? ty * ty / tt / yy : 0};
}

class CandidateState {
  constructor(model) {this.model = model; this.reset();}
  reset() {this.time = null; this.previous = null; this.history = []; this.travel = 0; this.armed = true; this.quietSince = null; this.persistence = 0;}
  clock(time) {
    if (!Number.isFinite(time) || time < 0) throw Error('Invalid capture time');
    if (this.time !== null && time < this.time) throw Error('Capture time moved backwards');
    if (time === this.time) return {accepted: false, reason: 'duplicate-frame', dt: 0};
    const dt = this.time === null ? 0 : time - this.time;
    if (dt > .25) this.reset();
    this.time = time;
    return {accepted: true, dt: dt <= .25 ? dt : 0};
  }
  checkpoint() {return copy({version: 1, model: this.model, time: this.time, previous: this.previous,
    history: this.history, travel: this.travel, armed: this.armed, quietSince: this.quietSince, persistence: this.persistence});}
  restore(s) {
    const finiteTree = x => x === null || typeof x === 'boolean' || typeof x === 'string' ||
      (typeof x === 'number' && Number.isFinite(x)) || (x && typeof x === 'object' && Object.values(x).every(finiteTree));
    if (!s || s.version !== 1 || s.model !== this.model || !finiteTree(s) || !Array.isArray(s.history) ||
        s.history.length > 100 || typeof s.armed !== 'boolean' || typeof s.travel !== 'number' || s.travel < 0 ||
        typeof s.persistence !== 'number' || s.persistence < 0 ||
        !(s.time === null || typeof s.time === 'number') || !(s.quietSince === null || typeof s.quietSince === 'number')) throw Error('Invalid candidate checkpoint');
    for (const h of [s.previous, ...s.history].filter(Boolean)) {
      if (!['x', 'y', 'area', 'radius', 'width', 'height', 'polarity'].every(k => typeof h[k] === 'number') ||
          h.area <= 0 || ![-1, 1].includes(h.polarity)) throw Error('Invalid candidate component');
    }
    Object.assign(this, copy(s));
  }
}

export class EngineeredDisplacementEvent extends CandidateState {
  constructor() {super('engineered-compact-displacement-v1');}
  step(pixels, time) {
    const image = silhouettes(pixels), clock = this.clock(time);
    const result = {model: this.model, time, valid: clock.accepted, supported: image.supported,
      reason: clock.reason ?? image.reason, event: false, score: 0, centroid: null, displacement: 0};
    if (!clock.accepted) return result;
    if (!image.supported) {this.previous = null; this.travel = 0; return result;}
    const small = image.components.filter(c => c.polarity === -1 && !c.clipped &&
      Math.max(c.width, c.height) <= CANDIDATE_SETTINGS.smallMaximumDiameter &&
      Math.max(c.width / c.height, c.height / c.width) <= CANDIDATE_SETTINGS.smallMaximumAspect);
    const current = match(this.previous, small);
    if (current && clock.dt > 0) {
      const d = distance(current, this.previous), areaChange = Math.abs(Math.log(current.area / this.previous.area));
      result.centroid = [current.x, current.y]; result.displacement = d;
      if (d > .12 && areaChange < .3) {
        this.travel += d; this.quietSince = null;
        result.score = Math.min(1, this.travel / CANDIDATE_SETTINGS.eventTravelPixels);
        if (this.armed && this.travel >= CANDIDATE_SETTINGS.eventTravelPixels) {result.event = true; this.armed = false;}
      } else {
        if (this.quietSince === null) this.quietSince = time;
        if (time - this.quietSince >= CANDIDATE_SETTINGS.eventQuietSeconds) {this.armed = true; this.travel = 0;}
      }
      this.previous = current;
    } else {
      this.previous = small.sort((a, b) => b.area - a.area)[0] ?? null;
      this.travel = 0;
      if (this.quietSince === null) this.quietSince = time;
      if (time - this.quietSince >= CANDIDATE_SETTINGS.eventQuietSeconds) this.armed = true;
    }
    return result;
  }
}

export class EngineeredSilhouetteExpansion extends CandidateState {
  constructor() {super('engineered-silhouette-expansion-v1');}
  step(pixels, time) {
    const image = silhouettes(pixels), clock = this.clock(time);
    const result = {model: this.model, time, valid: clock.accepted, supported: image.supported,
      reason: clock.reason ?? image.reason, loom: 0, event: false, radius: null, radiusRate: 0,
      expansionFit: 0, widthRate: 0, heightRate: 0, centerSpeed: 0};
    if (!clock.accepted) return result;
    if (!image.supported) {this.previous = null; this.history = []; this.persistence = 0; return result;}
    const eligible = image.components.filter(c => !c.clipped && c.area < N * .55);
    let current = match(this.previous, eligible);
    if (!current) {current = eligible.sort((a, b) => b.area - a.area)[0] ?? null; this.history = []; this.persistence = 0;}
    this.previous = current;
    if (!current) return result;
    this.history.push({...current, time});
    this.history = this.history.filter(h => time - h.time <= CANDIDATE_SETTINGS.historySeconds + 1e-8);
    result.radius = current.radius;
    if (this.history.length < 4 || time - this.history[0].time < CANDIDATE_SETTINGS.expansionMinimumWindow - 1e-8) return result;
    const r = fit(this.history, 'radius'), w = fit(this.history, 'width'), h = fit(this.history, 'height');
    const x = fit(this.history, 'x'), y = fit(this.history, 'y');
    Object.assign(result, {radiusRate: r.slope, expansionFit: r.r2, widthRate: w.slope, heightRate: h.slope,
      centerSpeed: Math.hypot(x.slope, y.slope)});
    const expansion = r.slope >= CANDIDATE_SETTINGS.expansionRatePixelsPerSecond && r.r2 >= CANDIDATE_SETTINGS.expansionFitMinimum &&
      w.slope >= 1 && h.slope >= 1 && result.centerSpeed <= 1.5 * r.slope + 3;
    this.persistence = expansion ? this.persistence + clock.dt : 0;
    result.loom = this.persistence >= .06 ? Math.min(1, r.slope / 12) : 0;
    result.event = result.loom > 0;
    return result;
  }
}
