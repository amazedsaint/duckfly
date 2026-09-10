import { TemporalFeatures } from './features.js';
import { HazardFeedback } from './feedback.js';

// Opt-in research adapter. The score is not a calibrated collision probability.
// The public simulator uses the frozen no-pose artifact, not a Flyvis model.
export class TemporalLoop {
  constructor(decoder, mode) {
    this.decoder = decoder;
    this.mode = mode;
    this.features = new TemporalFeatures();
    this.feedback = new HazardFeedback(decoder.threshold, mode === 'hold');
    this.risk = null;
  }
  observe(packet, body, duck) {
    const valid = duck.source === 'eyes' && duck.eye === 'both' && packet?.views &&
      packet.calibration?.id === 'duckfly-pinhole-v2' && packet.clock === 'simulation' &&
      packet.pose?.length === 7 && packet.pose.every(Number.isFinite);
    if (!valid) {
      this.features.reset(); this.risk = null;
      this.feedback.observe({risk: null, valid: false, time: body.time ?? 0, source: packet?.sourceId ?? 'unavailable'});
      return;
    }
    if (this.features.observe(packet, body)) this.risk = this.decoder.predict(this.features.input(this.decoder.mode));
    this.feedback.observe({risk: this.risk, time: packet.captureTime, source: packet.sourceId});
  }
  invalidate(time) {
    this.features.reset(); this.risk = null;
    this.feedback.observe({risk: null, valid: false, time, source: this.feedback.state.source ?? 'unavailable'});
  }
  sensory(time) { return this.feedback.sensory(time); }
  motor(command, body, time, gfEvent) { return this.feedback.motor(command, {speed: body.speed, time, gfEvent}); }
  status(time) {
    const s = this.feedback.state;
    return {mode: this.mode, risk: s.valid ? s.risk : null, fresh: this.feedback.fresh(time),
      threshold: this.decoder.threshold, held: s.held, triggers: s.triggers, gfEvents: s.gfEvents,
      releases: s.releases, clearSeconds: s.lowSince === null ? 0 : Math.max(0, s.lowThrough - s.lowSince)};
  }
  checkpoint() { return {version: 1, mode: this.mode, features: this.features.checkpoint(), feedback: this.feedback.checkpoint(), risk: this.risk}; }
  restore(s) {
    if (s?.version !== 1 || s.mode !== this.mode) throw Error('Incompatible temporal loop checkpoint');
    this.features.restore(s.features); this.feedback.restore(s.feedback); this.risk = s.risk;
  }
}
