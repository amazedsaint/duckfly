export const SCENARIOS = [
  {id:'scent',image:'scent',title:'Follow a scent',tag:'Smell',description:'Guide a duck with a scent source while its eyes are covered. Compare the left and right antenna readings.',action:'Open scene',guide:'Drag the purple scent source. Switch off its scent or disable an antenna in Senses to compare the response.',alt:'Duck with two scent sensors approaching a purple source'},
  {id:'air',image:'air',title:'Feel the air',tag:'Air sensing',description:'An air current feeds the fly’s sensory pathway. Move the source and watch for the stop reflex.',action:'Open scene',guide:'Select the turquoise air source to switch it off or change its reach. Air sensing can be disabled in Senses.',alt:'Duck approaching a turquoise air current'},
  {id:'touch',image:'touch',title:'Touch and pause',tag:'Touch',description:'Physical contact pauses the duck. Move the block into its path, or map touch to another response.',action:'Open scene',guide:'Drag the block into the duck’s path. Touch means real contact with an object; ordinary steps on the floor do not trigger it.',alt:'Duck touching a block with a contact indicator'},
  {id:'cue-workshop',image:'target',title:'Build a visual follower',tag:'Signal to action',description:'Use a pink beacon to activate the walking pathway. Map its signal to walking, or assign an action of your own.',action: 'Open scene',guide:'Move the beacon and watch the duck follow. Open Brain → duck to edit a connection and compare the response.',alt:'Duck following a movable pink beacon'},
  {id:'lookout',image:'gaze',title:'Look without chasing',tag:'Head control',description:'Connect walking-pathway activity to head tracking. Hide the beacon to activate a search response.',action: 'Open scene',guide:'Hide the beacon to switch from tracking to searching. Open Brain → duck to assign a different action.',alt:'Duck looking toward a beacon beside a wall'},
  {id:'crossed-wires',image:'flock',title:'Reverse the steering',tag:'Compare connections',description:'Give two ducks opposite steering connections. Move the same beacon and compare their responses.',action: 'Open scene',guide:'Move the beacon and select each duck to inspect its signals. Their steering connections request opposite turns.',alt:'Ducks with independently mapped neural connections'},
  {id:'trigger-kick',image:'kick',title:'Trigger a kick',tag:'Action triggers',description:'Connect DNp09 activity to a kick. The duck waits for a steady stance before moving its leg.',action: 'Open scene',guide:'Show the beacon to trigger one kick. Hide it until activity falls, then reveal it to try again. Place the ball beside the left foot.',alt:'Duck with a ball next to its left foot'},
  {
    id: "target",
    title: "Follow the beacon",
    tag: "Start here",
    description:
      "Drag the pink beacon to guide the duck. Watch its camera view and steering activity as it follows.",
    action: 'Open scene',
    guide:
      "Drag the pink beacon. Watch its position in the eye view change the duck’s direction.",
    alt: "Microduck facing a pink beacon in the arena",
  },
  {id: "stop-go", title: "Stop, wait, go", tag: "Stop response", description: "Compare a timed stop with a response that waits for an object to move away. Test approaches and near misses.", action: 'Open scene', guide: "Choose an object path and stop response. Each change restarts the encounter; the scene has no time limit.", alt: "Duck watching an approaching object in the stop-loop experiment"},
  {id: "gaze", title: "Find it again", tag: "Head tracking", description: "Send a beacon out of view. Let the duck look for it, or hold its head still.", action: 'Open scene', guide: "Move or hide the beacon with the buttons below. Toggle active looking to compare.", alt: "Duck seeking a beacon beside an occluding wall"},
  {id: "switchboard", title: "Brain switchboard", tag: "Neural pathways", description: "Disable a neural pathway and compare its effect on movement. The brain monitor stays active.", action: 'Open scene', guide: "Disable a pathway in Experiment controls. Compare neural activity with movement, then restore all pathways.", alt: "Duck following a beacon in the neural intervention experiment"},
  {id: "recovery", title: "Bump and recover", tag: "Body feedback", description: "Nudge the duck to test its balance. After a fall, try the standing controller and watch its recovery.", action: 'Open scene', guide: "Nudge the duck and select Stand up after a fall. Reset to compare the same starting conditions.", alt: "Microduck walking across an open balance-testing arena"},
  {id: "kick", title: "See it, kick it", tag: "Visual actions", description: "A visible beacon activates the walking pathway. Sustained activity triggers a trained kick.", action: 'Open scene', guide: "Move the beacon out of view, then bring it ahead to rearm. Place the ball by the left foot to try again.", alt: "Microduck with a ball beside its left foot and a pink visual cue"},
  {
    id: "occlusion",
    title: "Out of sight",
    tag: "Vision experiment",
    description:
      "Block the beacon with a wall and see how the duck responds when visual input is lost.",
    action: 'Open scene',
    guide:
      "Drag the wall out of the way, then put it back. Watch the eye view and forward signal.",
    alt: "A wall between Microduck and its beacon",
  },
  {
    id: "flock",
    title: "Follow the flock",
    tag: "Multiple brains",
    description:
      "Run several ducks with independent circuits. Select one to inspect its camera and brain activity.",
    action: 'Open scene',
    guide:
      "Select a duck to inspect its brain. Move the beacon to guide the leader.",
    alt: "A flock of Microducks with a shared beacon",
  },
  {
    id: "loom",
    title: "Approaching threat",
    tag: "Reflex experiment",
    description:
      "Send a ball toward the duck and check whether the growing image activates its stop reflex.",
    action: 'Open scene',
    guide:
      "Watch the approaching ball in the eye view. Reset to repeat, or drag the ball to move it.",
    alt: "A red ball approaching Microduck",
  },
  {
    id: "vision",
    title: "Retinal motion lab",
    tag: "Experimental",
    description:
      "Compare motion signals from each eye using an experimental vision adapter.",
    action: 'Open scene',
    guide:
      "Move a prop across the eye view. Switch between left and right eyes to compare motion.",
    alt: "Microduck viewing a beacon with the experimental motion pathway",
  },
  {
    id: "empty",
    title: "Blank scene",
    tag: "Custom scene",
    description:
      "Start with one duck and an empty stage. Add objects and build your own signal-to-action connections.",
    action: 'Create scene',
    guide:
      "Add an object in Objects & physics. Use Send a signal to stimulate the selected duck’s circuit.",
    alt: "One Microduck in an open arena",
  },
];
