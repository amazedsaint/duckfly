import {newConnection} from './trigger-actions.js';
export const CONNECTION_SCENES=['cue-workshop','lookout','crossed-wires','trigger-kick'];
export function connectionScene(id){
  const connect=(pairs)=>({enabled:true,rules:pairs.map(([trigger,action,strength=1],i)=>({...newConnection(trigger,action,'connection-'+(i+1)),strength}))});
  const scene={version:7,seed:'connections-'+id,name:'',ducks:[{id:'duck-1',name:'Duck 1',spawn:[0,0,0],mode:'target',mapping:{forward:'off',turn:'off'},
    connections:connect([['forward','walk',1],['forward','steer',.8],['seen','look-cue']])}],
    props:[{id:'target-1',kind:'target',name:'Move me',position:[.8,.15,.14],size:[.09,.09,.09]}]};
  if(id==='cue-workshop')scene.name='Build a visual follower';
  if(id==='lookout'){
    scene.name='Look without chasing';
    scene.ducks[0].connections=connect([['forward','look-cue'],['lost','look-left',.7]]);
    scene.props.push({id:'wall-1',kind:'wall',name:'Slide to hide the cue',position:[.4,-.45,.17],size:[.05,.32,.34]});
  }
  if(id==='crossed-wires'){
    scene.name='Reverse the steering';
    scene.ducks[0].name='Follows the signal';scene.ducks[0].spawn=[0,-.35,0];
    scene.ducks[0].connections=connect([['left','left',.5],['right','right',.5]]);
    scene.ducks.push({...scene.ducks[0],id:'duck-2',name:'Reverses the signal',spawn:[0,.35,0],connections:connect([['left','right',.5],['right','left',.5]])});
    scene.props[0].position=[.9,0,.14];
  }
  if(id==='trigger-kick'){
    scene.name='Trigger a kick';
    scene.ducks[0].connections=connect([['forward','kick']]);
    scene.props[0].position=[.7,0,.14];
    scene.props.push({id:'kick-ball',name:'Kick ball',kind:'ball',position:[.09,.042,.035],size:[.07,.07,.07],movable:true,mass:.025,friction:.6});
  }
  return scene;
}
