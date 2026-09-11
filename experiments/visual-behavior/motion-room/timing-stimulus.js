export const TIMING_DT=.04,TIMING_FRAMES=100;
export const TIMING_PULSES=Object.freeze({
  train:[[.80,.96,.9],[1.52,1.88,-.4],[2.36,2.84,.3],[3.36,3.52,-.9]],
  A:[[.64,.84,.6],[1.16,1.36,.3],[1.80,2.10,-.6],[2.56,2.80,.5],[3.20,3.60,-.3]],
  B:[[.60,1.00,-.3],[1.44,1.60,.75],[2.08,2.32,-.5],[2.88,3.28,.3]],
  stationary:[],
});
export function timingCases(){
  return [...[12,24].map(stripes=>({id:`train-${stripes}`,split:'train',stripes,contrast:.8,phase:0,schedule:'train'})),
    ...[17,23,29].flatMap((stripes,i)=>['A','B'].map(schedule=>({id:`heldout-${stripes}-${schedule}`,split:'heldout',stripes,contrast:[.45,.7,.55][i],phase:[1.1,2.2,.37][i],schedule}))),
    ...[17,29].map(stripes=>({id:`stationary-${stripes}`,split:'stationary',stripes,contrast:.65,phase:.91,schedule:'stationary'}))];
}
export function timingAngle(test,time){return TIMING_PULSES[test.schedule].reduce((sum,[start,end,rate])=>sum+rate*Math.max(0,Math.min(end-start,time-start)),0);}
export function timingRate(test,frame){return frame?-(timingAngle(test,frame*TIMING_DT)-timingAngle(test,(frame-1)*TIMING_DT))/TIMING_DT:0;}
