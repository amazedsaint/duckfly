// BAM M6 / XL330 browser port, derived from Rhoban/bam (Apache-2.0).
// Copyright 2025 Marc Duclusaud & Grégoire Passault. See THIRD_PARTY_NOTICES.md.
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function motorTorque(p, target, q, dq, vin = p.vin) {
  const duty = clamp((target - q) * p.kp * p.errorGain, -p.maxPWM, p.maxPWM);
  return p.kt * (vin * duty) / p.R - (p.kt ** 2) * dq / p.R;
}
export function frictionBudget(p, motor, external, dq) {
  const s = Math.exp(-(Math.abs(dq / p.dtheta_stribeck) ** p.alpha));
  let friction = p.friction_base
    + Math.abs(external * p.load_friction_external - motor * p.load_friction_motor)
    + s * p.friction_stribeck
    + s * Math.abs(external * p.load_friction_external_stribeck - motor * p.load_friction_motor_stribeck);
  if (Math.sign(external) !== Math.sign(motor)) {
    if (Math.abs(external) < Math.abs(motor)) friction += s * p.load_friction_external_quad * Math.abs(external) ** 2;
    if (Math.abs(external) > Math.abs(motor)) friction += s * p.load_friction_motor_quad * Math.abs(motor) ** 2;
  }
  return friction;
}
export class BAM {
  constructor(mj, model, data, config) {
    this.mj = mj; this.m = model; this.d = data; this.c = config;
    this.targets = new Float64Array(14); this.previous = new Float64Array(14);
  }
  reset() { this.previous.fill(0); this.targets.set(this.c.defaultPose); }
  update() {
    const {m, d, c} = this, p = c.bam;
    const vin = Math.max(p.voltageMin, p.vin - p.voltageDrop * this.previous.reduce((sum, v) => sum + Math.abs(v), 0));
    // Constraint arrays must be reacquired after stepping: WASM memory can grow.
    const frictionForces = new Float64Array(m.njnt);
    const ids=d.efc_id, types=d.efc_type, forces=d.efc_force;
    for (let j=0;j<d.nefc;j++) if (types[j]===this.mj.mjtConstraint.mjCNSTR_FRICTION_DOF.value) frictionForces[ids[j]]+=forces[j];
    for (let i=0;i<14;i++) {
      const qi=c.qpos[i], vi=c.qvel[i], velocity=d.qvel[vi];
      const torque=motorTorque(p, this.targets[i], d.qpos[qi], velocity, vin);
      d.ctrl[c.actuators?.[i]??i]=torque; this.previous[i]=torque;
      const external=-d.qfrc_bias[vi]+d.qfrc_constraint[vi]-frictionForces[c.joints[i]];
      m.dof_frictionloss[vi]=frictionBudget(p, d.qfrc_actuator[vi], external, velocity);
      m.dof_damping[vi]=p.friction_viscous;
    }
  }
}
