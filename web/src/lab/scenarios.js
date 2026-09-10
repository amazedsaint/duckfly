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
