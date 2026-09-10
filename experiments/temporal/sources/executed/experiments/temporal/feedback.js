// Only a measured GF event may engage this supervisor. It never creates motion.
export class HazardFeedback {
  constructor(threshold, enabled = true) {
    if (!(threshold > 0 && threshold < 1)) throw Error('A validated trigger threshold is required');
    this.threshold = threshold; this.enabled = enabled;
    this.state = {source: null, risk: null, captureTime: null, valid: false, lowSince: null, lowThrough: null,
      armed: true, pulseUntil: null, held: false, slowSince: null, triggers: 0, gfEvents: 0, releases: 0};
  }
  observe({risk, time, source, valid = true}) {
    const s = this.state;
    if (!Number.isFinite(time) || typeof source !== 'string') throw Error('Invalid risk metadata');
    if (s.source !== source) {
      // Preserve a GF hold across a changed or missing camera, but discard old clear evidence.
      Object.assign(s, {source, risk: null, captureTime: null, valid: false, lowSince: null, lowThrough: null, pulseUntil: null, armed: true});
    }
    if (s.captureTime !== null && time <= s.captureTime) return false;
    if (s.captureTime !== null && time - s.captureTime > .12 + 1e-9) s.lowSince = s.lowThrough = null;
    s.captureTime = time; s.valid = valid && Number.isFinite(risk) && risk >= 0 && risk <= 1;
    s.risk = s.valid ? risk : null;
    if (s.valid && risk < this.threshold / 2) {
      s.lowSince ??= time; s.lowThrough = time;
      if (s.lowThrough - s.lowSince >= .4 - 1e-9) s.armed = true;
    } else s.lowSince = s.lowThrough = null;
    if (!s.valid) s.pulseUntil = null;
    return true;
  }
  fresh(time) {
    const s = this.state;
    return s.valid && s.captureTime !== null && time >= s.captureTime - 1e-9 && time - s.captureTime <= .12 + 1e-9;
  }
  sensory(time) {
    const s = this.state;
    if (!this.fresh(time)) return {loomL: 0, loomR: 0, loomPathway: 'both'};
    if (s.armed && s.risk >= this.threshold) {
      s.armed = false; s.pulseUntil = time + .2; s.triggers++;
    }
    const pulse = Number(s.pulseUntil !== null && time < s.pulseUntil - 1e-9);
    return {loomL: pulse, loomR: pulse, loomPathway: 'both'};
  }
  motor(command, {time, speed, gfEvent}) {
    const s = this.state;
    if (gfEvent) {s.gfEvents++; if (this.enabled) {s.held = true; s.slowSince = null;}}
    if (!Number.isFinite(speed) || speed >= .04) s.slowSince = null;
    else s.slowSince ??= time;
    const clear = this.fresh(time) && s.lowSince !== null && s.lowThrough - s.lowSince >= .4 - 1e-9;
    const slow = s.slowSince !== null && time - s.slowSince >= .12 - 1e-9;
    if (s.held && clear && slow) {s.held = false; s.releases++;}
    return s.held ? {...command, vx: 0, yaw: 0} : {...command};
  }
  checkpoint() {return {version: 1, threshold: this.threshold, enabled: this.enabled, state: structuredClone(this.state)};}
  restore(saved) {
    if (saved?.version !== 1 || saved.threshold !== this.threshold || saved.enabled !== this.enabled) throw Error('Incompatible feedback state');
    const s = saved.state;
    if (!s || Object.keys(s).length !== Object.keys(this.state).length || Object.keys(this.state).some(k => !(k in s))) throw Error('Incomplete feedback state');
    this.state = structuredClone(s);
  }
}
