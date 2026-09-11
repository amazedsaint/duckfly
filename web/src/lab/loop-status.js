// Describe the last delivered command, never infer it from firing or a UI switch.
import { normalizeBrainMapping, brainMappingEnabled, brainMappingSummary } from './brain-mapping.js';
import { ACTIONS } from './trigger-actions.js';
export function loopStatus(state, id) {
  const duck = state.scene.ducks.find(d => d.id === id);
  const body = state.body.ducks.find(d => d.id === id);
  const agent = state.agents[id], cause = state.event?.causes.find(c => c.id === id);
  const neural = agent?.neural, input = agent?.input;
  const object = duck.mode === 'flock' ? agent?.vision?.neighbor : agent?.vision?.target;
  const pixels = object?.candidatePixels;
  const perception = duck.eye === 'none' ? 'Eyes covered' : !input ? 'No frame yet' : !input.fresh ? 'Waiting for a new camera frame' :
    agent?.temporal ? (agent.temporal.fresh ? 'Stereo sequence active' : 'Stereo sequence unavailable') :
    object?.visible ? (duck.mode === 'flock' ? 'Companion visible' : 'Beacon visible') :
    pixels > 0 && pixels < 5 ? `Cue too small · ${pixels}/5 pixels` : 'No cue detected';
  let reason = cause ? cause.provenance.forward : 'Waiting for the first step';
  if (reason === 'Fly circuit intent') reason = neural?.gfHeld ? 'GF stop reflex active' : neural?.vx ? 'Fly circuit drives walking' : 'Forward neurons below walking threshold';
  const skill=agent?.skill;
  const status = skill&&skill.phase!=='walk' ? skill.message : body.fallen ? 'Duck fell · select Stand up' :
    state.paused ? 'Paused · Run or Step to advance' :
    cause?.command.vx === 0 && input?.gate && !['manual','reactive','reflex'].includes(duck.mode) && reason === input.gateReason ?
      (input.gateReason === 'Target absent' ? `${duck.mode === 'flock' ? 'Companion' : 'Beacon'} lost · forward blocked` : `${reason} · forward blocked`) :
    Math.abs(body.command[0]) > .01 ? body.speed > .025 ? 'Walking · body responding' : 'Movement requested · body settling' :
    Math.abs(body.command[1]) > .08 ? 'Turn requested' : reason;
  const requestedActions = cause?.connections?.signals.filter(signal=>signal.active&&!signal.blocked).map(signal=>ACTIONS.find(action=>action.id===signal.action)?.label??signal.action);
  const displayReason = requestedActions?.length && !cause.connections.gate
    ? 'Requested actions: ' + [...new Set(requestedActions)].join(' · ')
    : reason;
  return {status, perception, reason:displayReason, neural:neural ? [neural.vx,neural.yaw] : null,
    mapping:normalizeBrainMapping(duck),mappingActive:brainMappingEnabled(duck),mappingSummary:brainMappingSummary(duck),
    command:body.command, speed:body.speed, feedback:neural?.feedback ?? null,
    sampledAt:state.event?.time ?? 0, pixels:pixels ?? null};
}
