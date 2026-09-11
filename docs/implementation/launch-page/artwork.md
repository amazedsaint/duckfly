# DuckFly launch artwork

Created on 2026-09-10 with the built-in `image_gen.imagegen` tool, default mode. No external API/CLI was used. Final PNGs were copied without transformation from the built-in generated-image directory, preserving their generated alpha channels and metadata.

These are independent stylized illustrations, not official Microduck project assets. The repository's `web/public/scenarios/target.png` was inspected to identify the robot's biped proportions and exposed mechanical legs. It was not passed as an image input. Both final assets were generated from text descriptions.

## Final files

- `web/public/launch/duck-hero.png`: source `/Users/madhusudanaa/.codex/generated_images/01a08df8-d85d-7d30-9e25-b8708223e9a1/exec-2432c747-8243-448a-9140-29e36ffa07a1.png`.
- `web/public/launch/fly-hero.png`: source `/Users/madhusudanaa/.codex/generated_images/01a08df8-d85d-7d30-9e25-b8708223e9a1/exec-193f606d-5bc2-4c78-890c-34e90fba2f84.png`.

Both have actual RGBA alpha with fully transparent exterior pixels and opaque subject pixels. Visual review confirmed full character framing and separate cutouts suited to CSS animation. Small antialiased character-edge highlights are retained.

## Duck final prompt

```text
A single full-body stylized 3D robotic Microduck character asset, isolated on a completely transparent background. PNG with clean actual alpha-channel transparency, crisp edges, no backdrop, no glow, no atmospheric haze, no drop shadow and no checkerboard pattern.

The robot has a large rounded box-shaped cream-white camera head, two black lens eyes in yellow rings, a short yellow duck beak, a small cream-white torso, two exposed dark graphite articulated mechanical legs with cylindrical joint motors and broad chunky white-and-yellow mechanical feet. No arms. No feathers or organic duck body. Friendly, inquisitive personality, one foot lifted in a jaunty walking step, three-quarter view turned toward the left. The feet and head are fully inside the image with generous margins. Entire character centered in a square asset canvas.

A premium colorful 3D toy-robot render. Solid opaque white plastic, glossy warm yellow beak and feet, black metal legs, very restrained pink and cyan reflections confined to the robot surfaces. Crisp dimensional lighting ON THE CHARACTER ONLY. Smooth polished surfaces with clearly visible mechanical details. Do not include any floor, props, text or labels.
```

## Fly final prompt

```text
Use case: stylized-concept.
Asset type: transparent PNG character cutout for DuckFly's animated website launch hero.
Create ONE charming stylized 3D fly character in a lively flying pose, three-quarter facing toward the RIGHT. Large expressive compound eyes dominate the head, each faceted like an insect eye, mixing saturated teal and hot fuchsia reflections. Small dark violet head and compact deep violet-black segmented body, six small graceful insect legs tucked naturally for flight, two delicate translucent iridescent wings extended diagonally upward with visible subtle veins. It should read clearly as a fly, not a bee, butterfly, bird, or toy drone. Charming and clever instead of creepy.
Style: premium playful stylized 3D character illustration, dimensional candy-poster art, rounded surfaces and crisp dark ink contour accents, polished materials and strong studio lighting. Saturated teal and fuchsia compound eyes, dark violet body, delicate translucent cyan-pink wing reflections, a hint of lemon reflected light. Same art direction as a cream-white and yellow robot duck with graphite mechanisms. Keep the silhouette clear and the wing edges crisp.
Composition: full fly including wing tips and every leg, centered in a square canvas, occupies approximately 80 percent of canvas with generous transparent margins. Genuinely transparent background with actual alpha channel. No floor, environment, colored background, shadow, glow cloud, or motion trail.
No text, labels, logos, watermark, UI, frame, border, checkerboard pattern, props, extra characters, extra wings, missing legs, or cropped appendages.
```

## Iteration record

The first duck generation produced a diffuse halo outside the subject. Two built-in background-removal edits failed the alpha check, retaining an opaque checkered backdrop. They were rejected and not copied into the project. The final duck was regenerated from the narrower prompt above and passed alpha inspection. Discarded outputs remain at the tool's original paths.

Initial duck prompt:

```text
Use case: stylized-concept.
Asset type: transparent PNG character cutout for DuckFly's animated website launch hero.
Create ONE beautiful stylized 3D Microduck biped robot, full body, in a dynamic walking pose with one chunky foot raised forward, three-quarter facing toward the LEFT. This is a small physical ROBOT, not an organic or feathered duck. Recognizable proportions: an oversized rounded rectangular white camera head angled slightly inquisitively, short broad yellow beak at the front, small black lens eyes with warm yellow surrounds; compact cream-white upper body; exposed dark black articulated metal legs and visible round joint motors; broad chunky yellow-and-white mechanical feet. NO arms and NO feathered wings. Capture the charming personality of a compact open-source walking robotics kit. Keep every part of the body visible and leave generous margins around the feet and head.
Style: premium playful stylized 3D product illustration, rounded surfaces, crisp dark ink contour accents, expressive confident pose. Polished white/cream plastic with warm lemon-yellow accents, restrained pink and cyan rim highlights, exposed black and dark graphite mechanisms. Cheerful candy-poster art with dimensional studio lighting and crisp silhouette. High detail without clutter.
Composition: character centered, fills approximately 82 percent of canvas height. Transparent background with actual alpha channel, no floor, no environment, no colored backdrop, no cast shadow detached from robot. Exactly one character.
No text, labels, logos, watermark, UI, poster frame, border, checkerboard pattern, pedestal, props, duplicate limbs, arms, organic duck feathers, or cropped feet.
```

First edit prompt, source `exec-ae02f4d1-7a06-44d8-90f6-014e06e5251c.png`, output `exec-30e9cede-caa2-4ef5-8ca1-6b134c97070b.png`:

```text
Use case: background-extraction. Edit only the supplied robot cutout. Preserve the robot's exact appearance, full walking pose, colors, geometry, framing, and dimensional studio lighting on the robot itself. Remove ALL background and ALL the diffuse pink, cyan, cream and yellow glow haze outside its crisp silhouette. Produce a clean professional transparent PNG cutout with true alpha: the robot's solid plastic and metal surfaces fully opaque, every background pixel outside the robot fully transparent. Keep precisely the contour of the robot and thin antialiased edges. Keep the same margins. Do not alter the character, add anything, crop, repaint the robot, add a drop shadow, create a checkerboard, or retain any atmospheric halo.
```

Second edit prompt, source `exec-30e9cede-caa2-4ef5-8ca1-6b134c97070b.png`, output `exec-097c273a-da4c-44f6-b128-1470e2088487.png`:

```text
Remove the grey grid backdrop completely and return only this same robot character as a PNG with a transparent background. Use actual alpha-channel transparency, not a visual depiction of transparency. Preserve the robot exactly, including the pose, dimensions, full body, white plastic, yellow beak and mechanical feet, black leg joints and its shading. The outside of the robot silhouette must be transparent. No background, no shadow or haze around the character.
```
