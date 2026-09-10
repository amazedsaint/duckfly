export const SCENARIOS = [
  {
    id: "target",
    title: "Follow the beacon",
    tag: "Start here",
    description:
      "Move the pink beacon and watch visual input become a turn, then a step.",
    action: "Lead the way",
    guide:
      "Drag the pink beacon. Watch its position in the eye view change the duck’s direction.",
    alt: "Microduck facing a pink beacon in the arena",
  },
  {id: "stop-go", title: "Stop, wait, go", tag: "New · research", description: "Should a duck restart on a timer, or wait for danger to clear? Try both and test false alarms.", action: "Test the feedback loop", guide: "Choose an object path and stop response. Each choice restarts an encounter. Keep experimenting for as long as you like.", alt: "Duck watching an approaching object in the stop-loop experiment"},
  {id: "gaze", title: "Find it again", tag: "New · active vision", description: "Send a beacon out of view. Let the duck look for it, or hold its head still.", action: "Play with eyesight", guide: "Move or hide the beacon with the buttons below. Toggle active looking to compare.", alt: "Duck seeking a beacon beside an occluding wall"},
  {id: "switchboard", title: "Brain switchboard", tag: "New · causal experiment", description: "Disconnect a neural pathway while the brain stays visible. Find what really moves the duck.", action: "Follow the signal", guide: "Cut a pathway below, then watch neural firing and movement. Connect all to restore it.", alt: "Duck following a beacon in the neural intervention experiment"},
  {id: "recovery", title: "Bump and recover", tag: "Body feedback", description: "Nudge the walking duck. If it falls, try a real standing policy and watch the handoff.", action: "Test its balance", guide: "Nudge the duck. Try Help stand after a fall; compare with an identical reset.", alt: "Microduck walking across an open balance-testing arena"},
  {id: "kick", title: "See it, kick it", tag: "New · neural trigger", description: "A visible beacon excites forward neurons. Their response selects a real kicking policy.", action: "Try the visual kick", guide: "Move the beacon out of view, then bring it ahead to rearm. Place the ball by the left foot to try again.", alt: "Microduck with a ball beside its left foot and a pink visual cue"},
  {
    id: "occlusion",
    title: "Out of sight",
    tag: "Vision experiment",
    description:
      "Slide a wall across the duck’s view. What happens when the beacon disappears?",
    action: "Play hide and seek",
    guide:
      "Drag the wall out of the way, then put it back. Watch the eye view and forward signal.",
    alt: "A wall between Microduck and its beacon",
  },
  {
    id: "flock",
    title: "Follow the flock",
    tag: "Multiple brains",
    description:
      "Each duck has its own circuit. Pick a duck to watch through its eyes.",
    action: "Meet the flock",
    guide:
      "Click any duck to connect its brain panel. Move the beacon to guide the leader.",
    alt: "A flock of Microducks with a shared beacon",
  },
  {
    id: "loom",
    title: "Approaching threat",
    tag: "Reflex experiment",
    description:
      "A ball approaches the duck. See whether growing motion triggers a stop reflex.",
    action: "Watch the reflex",
    guide:
      "Watch the approaching ball in the eye view. Reset to repeat, or drag the ball to move it.",
    alt: "A red ball approaching Microduck",
  },
  {
    id: "vision",
    title: "Retinal motion lab",
    tag: "Experimental",
    description:
      "Explore left and right eye motion with a compact experimental vision model.",
    action: "Explore motion",
    guide:
      "Move a prop across the eye view. Switch between left and right eyes to compare motion.",
    alt: "Microduck viewing a beacon with the experimental motion pathway",
  },
  {
    id: "empty",
    title: "Your own playground",
    tag: "Free play",
    description:
      "Start with one duck. Add props or more ducks, and send pulses into the circuit.",
    action: "Make a scene",
    guide:
      "Add an object below the arena, or send a Walk pulse to the connected duck.",
    alt: "One Microduck in an open arena",
  },
];
