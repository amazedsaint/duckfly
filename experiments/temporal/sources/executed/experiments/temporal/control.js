import {TemporalFeatures} from './features.js';
import {HazardFeedback} from './feedback.js';
export const CONDITIONS = ['motion', 'motion-both', 'temporal-timed', 'temporal-hazard', 'static-hazard', 'temporal-gf-silenced'];
export class ResearchController {
  constructor(experiment, condition, decoder) {
    if (!CONDITIONS.includes(condition)) throw Error('Unknown condition');
    this.condition = condition; this.features = new TemporalFeatures(); this.decoder = decoder; this.risk = null;
    this.feedback = decoder ? new HazardFeedback(decoder.threshold, condition !== 'temporal-timed') : null;
    const agent = experiment.agents.get('duck-1'), brain = agent.brain;
    if (condition === 'temporal-gf-silenced') brain.intervene('gf');
    const step = brain.step.bind(brain);
    brain.step = (body, sensory) => {
      const time = brain.sim.simMs / 1000, before = brain.escapeUntil;
      if (this.feedback) sensory = {...sensory, ...this.feedback.sensory(time)};
      else if (condition === 'motion-both') sensory = {...sensory, loomPathway: 'both'};
      const neural = step(body, sensory), gfEvent = brain.escapeUntil > before;
      const motor = this.feedback?.motor(neural, {time, speed: body.speed, gfEvent}) ?? neural;
      this.last = {gfEvent, held: this.feedback?.state.held ?? false, rawVx: neural.vx, loomL: sensory.loomL, loomR: sensory.loomR};
      return {...motor, event: this.last.held ? 'GF hazard hold' : neural.event};
    };
  }
  observe(packet, body, eye = 'both') {
    if (!this.feedback) return;
    const valid = eye === 'both' && Array.isArray(packet?.pose) && packet.pose.length === 7 && packet.pose.every(Number.isFinite);
    if (valid && this.features.observe(packet, body)) this.risk = this.decoder.predict(this.features.input(this.decoder.mode));
    else this.risk = null;
    this.feedback.observe({risk: this.risk, valid: valid && this.risk !== null, time: packet.captureTime, source: packet.sourceId});
  }
}
