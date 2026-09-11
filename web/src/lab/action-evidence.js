// Read-only join from an applied command to its retained sensory evidence.
// A nearby image is not evidence for a command. Match the complete identity.
export function recordedActionEvidence(experiment, {tick, branch, duckId}) {
  const missing = reason => ({status:'unavailable', reason, tick, branch, duckId});
  if (!Number.isSafeInteger(tick) || tick < 0 || !Number.isSafeInteger(branch) || branch < 0 || typeof duckId !== 'string')
    return missing('Invalid recorded action');
  const event = experiment.events?.find(event => event?.tick === tick && event?.branch === branch);
  const cause = Array.isArray(event?.causes)?event.causes.find(cause => cause?.id === duckId):null;
  if (!cause) return missing('This action is no longer in the retained recording.');
  const capture = cause.vision?.capture;
  if (!capture) return missing('This action has no identified camera frame.');
  // The event is recorded after its physics step. Only earlier captures could
  // have caused it. Source changes and rewind branches must not borrow images.
  const entries = [...experiment.frameTape].filter(([sampleTick]) => sampleTick < tick).sort((a,b) => b[0]-a[0]);
  let retained;
  const samePixels=(a,b)=>!!a===!!b&&(!a||(a.length===b.length&&a.every((value,i)=>value===b[i])));
  for (const [sampleTick, frames] of entries) {
    for (const [owner, packet] of Object.entries(frames)) {
      if (owner !== duckId && owner !== 'webcam') continue;
      if (!packet || packet instanceof Uint8Array) continue;
      if (packet.sourceId !== capture.sourceId || packet.frameId !== capture.frameId ||
          packet.captureTime !== capture.captureTime || packet.clock !== capture.clock ||
          packet.calibration?.id !== capture.calibration) continue;
      if(retained && (!samePixels(retained.packet.pixels,packet.pixels)||
          !samePixels(retained.packet.views?.left,packet.views?.left)||!samePixels(retained.packet.views?.right,packet.views?.right)))
        return missing('Conflicting images share this frame identity. No image can be attributed reliably.');
      retained??={sampleTick,packet};
    }
  }
  if(retained)return {status:'retained',tick,branch,duckId,sampleTick:retained.sampleTick,eventTime:event.time,
    cause:structuredClone(cause),frame:structuredClone(retained.packet)};
  return missing('The exact camera frame has expired or was not saved. The recorded command is still available.');
}
