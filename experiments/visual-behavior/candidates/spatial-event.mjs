// Feasibility candidate only: engineered statistics of real spatial T4/T5 model
// activity. This adds no LC11 neuron, anatomical LC11 inputs, or motor command.
export class SpatialActivityDisplacement {
  constructor(metadata) {
    this.metadata = metadata;
    this.types = Object.keys(metadata.populations);
    this.reset();
  }
  reset() {this.previous = null; this.travel = 0; this.armed = true; this.quiet = 0; this.time = null;}
  step(response) {
    if (response.modelId !== this.metadata.model.id || response.checkpointSha256 !== this.metadata.model.checkpointSha256) throw Error('Spatial candidate model mismatch');
    const time = response.captureTime;
    if (this.time !== null && time <= this.time) throw Error('Expected fresh spatial response');
    const dt = this.time === null ? 0 : time - this.time; this.time = time;
    const columns = new Map();
    for (const type of this.types) {
      const values = response.populations[type]?.delta, coordinates = this.metadata.populations[type].coordinates;
      if (!(values instanceof Float32Array) || values.length !== coordinates.length || !values.every(Number.isFinite)) throw Error('Invalid spatial activity');
      values.forEach((value, i) => {
        const c = coordinates[i], key = `${c.u},${c.v}`;
        const column = columns.get(key) ?? {x: c.azimuth, y: c.elevation, energy: 0};
        column.energy += Math.abs(value) / this.types.length; columns.set(key, column);
      });
    }
    const peak = Math.max(...[...columns.values()].map(c => c.energy));
    const active = [...columns.values()].filter(c => c.energy >= peak * .35 && c.energy > .001);
    let weight = 0, x = 0, y = 0;
    for (const c of active) {weight += c.energy; x += c.energy * c.x; y += c.energy * c.y;}
    x /= weight || 1; y /= weight || 1;
    let xx = 0, yy = 0, xy = 0;
    for (const c of active) {xx += c.energy * (c.x - x) ** 2; yy += c.energy * (c.y - y) ** 2; xy += c.energy * (c.x - x) * (c.y - y);}
    xx /= weight || 1; yy /= weight || 1; xy /= weight || 1;
    const spread = Math.hypot(xx - yy, 2 * xy), major = (xx + yy + spread) / 2, minor = (xx + yy - spread) / 2;
    const radius = Math.sqrt(xx + yy), aspect = Math.sqrt(major / Math.max(minor, .2));
    const compact = peak > .001 && active.length >= 3 && radius < 12 && aspect < 2.2;
    const result = {model: 'engineered-spatial-T4T5-displacement-probe-v1', time,
      event: false, compact, peak, cells: active.length, centroid: [x, y], radius, aspect, displacement: 0};
    if (compact && this.previous?.compact && dt > 0 && dt <= .1) {
      const d = Math.hypot(x - this.previous.centroid[0], y - this.previous.centroid[1]);
      result.displacement = d;
      if (d > .10 && d < 8) {
        this.travel += d; this.quiet = 0;
        if (this.travel >= 2 && this.armed) {result.event = true; this.armed = false;}
      } else {
        this.quiet += dt;
        if (this.quiet >= .24) {this.travel = 0; this.armed = true;}
      }
    } else {
      this.travel = 0; this.quiet += dt;
      if (this.quiet >= .24) this.armed = true;
    }
    this.previous = result;
    return result;
  }
}
