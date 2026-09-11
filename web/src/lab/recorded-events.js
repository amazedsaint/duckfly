const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const natural=value=>Number.isSafeInteger(value)&&value>=0;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function validateRecordedEvents(events, {duckIds,maximumTick=Number.MAX_SAFE_INTEGER}={}) {
  if(!Array.isArray(events)||events.length>1000)throw Error('Invalid recorded action timeline');
  const identities=new Set();
  for(const event of events){
    if(!object(event)||!natural(event.tick)||event.tick>maximumTick||!natural(event.branch)||!finite(event.time)||event.time<0||
        !Array.isArray(event.causes)||!event.causes.length||event.causes.length>8)throw Error('Invalid recorded action');
    const identity=`${event.branch}/${event.tick}`;
    if(identities.has(identity))throw Error('Duplicate recorded action');identities.add(identity);
    const ducks=new Set();
    for(const cause of event.causes){
      if(!object(cause)||typeof cause.id!=='string'||!/^[-a-zA-Z0-9_]{1,40}$/.test(cause.id)||ducks.has(cause.id)||
          (duckIds&&!duckIds.includes(cause.id))||!object(cause.input)||!object(cause.neural)||!object(cause.command))
        throw Error('Invalid recorded action signals');
      ducks.add(cause.id);
      for(const [record,keys] of [[cause.input,['forward','turn','loomL','loomR']],[cause.neural,['forward','left','right','vx','yaw']],[cause.command,['vx','yaw']]])
        if(keys.some(key=>!finite(record[key])))throw Error('Invalid recorded action values');
      if(cause.vision!=null&&!object(cause.vision))throw Error('Invalid recorded vision');
      if(cause.vision?.target!=null&&!object(cause.vision.target))throw Error('Invalid recorded target');
      if(cause.provenance!=null&&!object(cause.provenance))throw Error('Invalid recorded provenance');
      if(cause.connections!=null){
        const connection=cause.connections;
        if(!object(connection)||!Array.isArray(connection.signals)||connection.signals.length>12||
          (connection.gate!=null&&typeof connection.gate!=='string')||connection.signals.some(signal=>!object(signal)||
            ['trigger','source','action'].some(key=>typeof signal[key]!=='string'||signal[key].length>80)||
            (signal.value!==null&&!finite(signal.value))||!finite(signal.threshold)||typeof signal.active!=='boolean'||
            (signal.blocked!=null&&typeof signal.blocked!=='string')||(signal.limited!=null&&typeof signal.limited!=='string')))throw Error('Invalid recorded trigger connections');
      }
    }
  }
  return events;
}

// A guest's cache follows a particular host run, not just the scene's text.
// The lower-tick fallback also handles rewind and older hosts without run IDs.
export function changedRecording(previous,next) {
  return !previous||previous.authority!==next.authority||previous.recordingId!==next.recordingId||
    previous.sceneKey!==next.sceneKey||previous.branch!==next.branch||next.tick<previous.tick;
}
