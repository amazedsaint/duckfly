import { newConnection } from './trigger-actions.js';
export const SENSORY_SCENES = ['scent','air','touch'];

export function sensoryScene(preset) {
  const scene={version:9,seed:'senses-v1',name:'Follow a scent',ducks:[{id:'duck-1',name:'Duck 1',spawn:[0,0,0],mode:'odor',eye:'none',mapping:{forward:'walk',turn:'follow'}}],props:[],fields:[],challenge:{goal:[.75,.18],radius:.3}};
  if(preset==='scent')scene.fields=[{id:'scent-1',kind:'odor',position:[.75,.18],strength:1,radius:.5}];
  if(preset==='air'){
    scene.name='Feel the air';scene.ducks[0].mode='target';scene.ducks[0].eye='both';
    scene.props=[{id:'target-1',name:'Beacon',kind:'target',position:[1.1,0,.13],size:[.07,.07,.07]}];
    scene.fields=[{id:'air-1',kind:'air',position:[.5,0],strength:1,radius:.14}];
  }
  if(preset==='touch'){
    scene.name='Touch and pause';scene.ducks[0].mode='target';scene.ducks[0].eye='both';
    scene.ducks[0].connections={enabled:true,includeBrainMapping:true,rules:[{...newConnection('contact','stop','touch-stop'),hold:1}]};
    scene.props=[{id:'target-1',name:'Beacon',kind:'target',position:[1.1,0,.13],size:[.07,.07,.07]},
      {id:'touch-block',name:'Touch block',kind:'block',position:[.55,0,.06],size:[.12,.25,.12],color:'#dfac5c'}];
  }
  return scene;
}
