# CLAUDE.md — Morning Routine Timer (Mega Drive style)

## What this project is

This is a browser "game" that is really a **sequenced timer** for a child's morning routine, with Sega Mega Drive / Genesis–style pixel art. The art direction is inspired by *Flashback: The Quest for Identity*, meaning cinematic framing, smooth rotoscoped-feeling animation, and muted but rich palettes. All art is original; nothing from Flashback is copied.

The flow goes like this. The player sets five timers on an options screen. Five scenes then play in order. Each scene shows a looping animation of the same kid character, with a shrinking time bar and a STOP button underneath. Pressing STOP moves on to the next scene. If the timer runs out before STOP is pressed, a GAME OVER screen appears showing the kid crying.

## HARD CONSTRAINT: target device

**The game must run on Chrome on Android 4.4.2 (KitKat), on old and weak hardware.** Every decision is subordinate to this.

The newest Chrome available on KitKat is about v81, but the real device may be much older, and the system WebView on 4.4 is Chromium 30–33. **Code must work on Chrome 30.**

### Language and syntax rules (non-negotiable)

- **ES5 JavaScript only.** Do not use `let`, `const`, arrow functions, `class`, template literals, destructuring, default params, spread, `for...of`, or ES modules (`import`/`export`).
- **Do not use these APIs:** `Promise`, `fetch`, `async/await`, `Object.assign`, `Array.prototype.find/findIndex/includes/fill`, `Array.from`, `Map`/`Set`, `Symbol`, `String.prototype.startsWith/endsWith/includes/repeat/padStart`, Pointer Events, `IntersectionObserver`, CSS `image-rendering: pixelated`, CSS custom properties, CSS grid.
- **These are allowed:** `requestAnimationFrame`, Canvas 2D, `performance.now()` (with a `Date.now()` fallback), touch events (`touchstart`/`touchend`), `localStorage` (always wrapped in try/catch), `JSON`, `Array.prototype.forEach/map/filter`, `Function.prototype.bind`.
- **Use prefixed fallbacks** where needed: `ctx.webkitImageSmoothingEnabled`, `webkitAudioContext`, `document.webkitHidden` / `webkitvisibilitychange`, `webkitRequestFullscreen`.
- **No frameworks, no npm runtime dependencies, no build step, no transpiler.** The shipped code is exactly what the device runs.
- Before using any API not listed above, check its Chrome version on MDN/caniuse. If it is newer than Chrome 30, don't use it or add a fallback.

### Performance rules

- Render each scene into a **small native-resolution offscreen canvas**, then copy it to the visible canvas with one scaled `drawImage` call with image smoothing disabled.
- Pre-render every sprite frame once at startup into cached offscreen canvases. **Never** call `getImageData`/`putImageData` in the frame loop.
- Avoid `shadowBlur`, gradients in the frame loop, filters, and large numbers of `save()`/`restore()` calls.
- Everything must be **time-based** (delta time), never frame-count-based. The device may run at 30 fps or less.
- A stable 30 fps is acceptable. Smoothness matters less than timer accuracy.

### Checking compatibility

- Lint for ES5 before committing: `npx eslint --no-eslintrc --parser-options=ecmaVersion:5 --env browser "src/**/*.js"`. A syntax error on the device means a blank screen with no message.
- Test on the real device via USB remote debugging (`chrome://inspect` on desktop Chrome). Desktop device emulation does **not** catch syntax or API incompatibilities.

## File structure

No modules exist, so files are loaded with plain `<script>` tags **in dependency order**. Everything hangs off a single global namespace, `window.MR` ("Morning Routine").

```
index.html          // canvas + script tags, minimal CSS
src/config.js       // scene list, labels, default durations, tuning constants
src/palette.js      // Mega Drive palette, color ramps, red-alert palette mapping
src/font.js         // bitmap pixel font (drawn from data, no web fonts)
src/sprites.js      // sprite data format + pre-render/cache utilities
src/character.js    // THE kid: all body parts, expressions, outfits (reused everywhere)
src/scenes/shower.js
src/scenes/dressing.js
src/scenes/breakfast.js
src/scenes/teeth.js
src/scenes/shoes.js
src/ui.js           // time bar, buttons, touch hit-testing
src/states.js       // state machine (options, transition, scene, gameover, end)
src/main.js         // boot, resize, main loop
```

The game must run when `index.html` is served over plain HTTP (local network server or static hosting). Don't rely on anything that needs a backend.

## Screen layout

The game is designed for **portrait** orientation on a phone and recomputes its layout on `resize`/`orientationchange`.

- **Scene viewport:** a rectangle taking up to **2/3 of the screen height**, centered, containing the animation. Native resolution is **256×224** (Mega Drive H32 mode), scaled up with nearest-neighbor, using integer scaling when it fits and letterboxing otherwise.
- **Padding** separates the viewport from the UI below it.
- **Time bar:** full width of the viewport, shrinking from right to left as time passes. Its color goes green → yellow (at 50%) → orange (at 80%) → red. A small bitmap-font `mm:ss` remaining-time readout is optional.
- **STOP button:** below the bar, large. The touch target must be at least 48 CSS px tall, ideally much bigger, because a 6-year-old is using it. It is styled like a Mega Drive button or menu.
- UI is drawn on the same canvas for a consistent pixel look, with touch hit-testing done in `ui.js`. The page background is black.

## State machine

```
OPTIONS -> TRANSITION(1) -> SCENE(1) --STOP--> TRANSITION(2) -> SCENE(2) ... SCENE(5) --STOP--> END -> OPTIONS
                                 \--time runs out--> GAMEOVER --tap CONTINUE--> TRANSITION(next) (or END after scene 5)
```

- **OPTIONS:** Five rows, one per scene, each with its label and `[-] mm:ss [+]` buttons. There is no text input, to avoid the Android keyboard. The step is 30 s and the range is 30 s–20 min. Values are saved to `localStorage` (inside try/catch) and restored on the next launch. A big START button is at the bottom.
- **TRANSITION:** A ~2 s title card announcing the next scene's name, in a Flashback-style cinematic look (for example, letterbox bars sliding in, the name typed out letter by letter, then a wipe into the scene). **The timer does not run during transitions.**
- **SCENE:** The looping animation, time bar and STOP button. The timer starts when the transition ends.
- **GAMEOVER:** Shown when time reaches 0 before STOP is pressed. It displays a close-up of the kid **crying**, with clearly animated tears welling up and dropping from the eyes in a loop, and big "GAME OVER" text over it. A CONTINUE button goes to the next scene so the routine isn't blocked.
- **END:** A short "ALL DONE!" celebration with the kid happy, then a tap returns to OPTIONS.

## Timer logic

- Timer state is based on **timestamps**: store `startTime` and `duration`, and compute `elapsed = now - startTime`. Don't accumulate per-frame deltas. This keeps the timer correct even if frames drop or the tab is briefly backgrounded (`requestAnimationFrame` pauses when hidden).
- `progress = clamp(elapsed / duration, 0, 1)`.
- Time runs out when `progress >= 1` and STOP hasn't been pressed, which leads to GAMEOVER.
- Old Chrome has no Wake Lock API. Screen sleep is a known limitation, so document in the README that the device's screen timeout should be set high. Don't add hacks unless asked.

## Animation speed curve

Each scene's loop is a list of frames with **base durations**, played slowly at first (roughly 4–6 fps feel).

The **animation clock** advances by `dt * speed(progress)`, and the current frame is derived from that clock. Never compute the frame as `elapsed * speed`, because that makes the animation jump when the speed changes.

```
speed(p) = 1                                   if p < 0.5
speed(p) = 1 + (MAX_SPEED - 1) * ((p - 0.5) / 0.5)^2   if p >= 0.5   // smooth ease-in
MAX_SPEED = 3   // tunable in config.js
```

## Red alert (progress >= 98%)

- The whole screen (scene, bar and UI) switches to a **red high-contrast palette**. Each color is mapped to a red ramp by luminance: darks become deep red/black, lights become bright red/pink/white.
- This is implemented by **pre-rendering a red variant of every cached sprite and background at startup**, then swapping which cache is drawn. It must never involve per-pixel work at runtime.
- **Flashing:** alternate between the red palette and an inverted or brighter red frame. **Keep flashing at or below 3 flashes per second** (photosensitivity safety guideline). This is non-negotiable even if a faster rate "looks better".
- On a short timer, 2% can be very brief (1.2 s for 60 s). That's expected.

## Art direction

### Mega Drive palette rules

- Colors use the Mega Drive 9-bit color space: 8 levels per channel, `[0, 36, 73, 109, 146, 182, 219, 255]`. Snap every color to these levels.
- Each sprite uses **at most 15 colors plus transparency** (one Mega Drive palette line). A scene uses at most 4 palette lines total.
- The look to aim for is Flashback-style: muted, slightly desaturated backgrounds, detailed and readable characters, careful shading ramps, and smooth multi-frame motion rather than jerky 2-frame cycles.

### THE character (defined once in `character.js`, reused everywhere)

He is a **white boy, about 6–7 years old**, with **slightly red/rosy cheeks** and **hair shading from blond to light brown**. The hair ramp goes blond highlights → golden → light brown in the shadows, using 3–4 colors. His palette is fixed and shared by every scene. Sock and clothing colors must match between the dressing and shoes scenes.

- The character is built from **reusable layered parts** with shared anchor points (a simple "rig"), so all scenes stay on-model:
  - **head** with expression variants: neutral, happy, sleepy, chewing, mouth-open (brushing), crying (eyes squeezed, tear sources at the eyes)
  - **hair** as a separate layer (plus a wet variant for the shower)
  - **torso** variants: undershirt/vest, t-shirt
  - **legs** variants: underwear shorts, pants
  - **feet** variants: bare, socks, shoes
  - **arms/hands** in poses needed by the scenes (holding a spoon, a toothbrush, pulling on a shirt, and so on)
- Proportions are chibi-leaning but not super-deformed: a full-body sprite is about **32×56 px** at native resolution. Close-ups (game over head, shoes scene feet) are **separate larger sprites** drawn to match the same palette and design.
- **Sprite data format:** arrays of strings where each character is a palette index (`.` = transparent). A single `buildSprite(data, palette)` function converts them into cached canvases (normal plus red-alert variants).
- **Modesty rule:** the character is a child, so the shower scene must be fully non-revealing. Only the head and shoulders show above an opaque shower curtain or the tub edge, with steam and bubbles. In the dressing scene he starts in an undershirt and underwear shorts. Never draw him unclothed.

### Scenes (each is an endless loop)

The scene names below are defaults in `config.js` and are easy to rename or translate. The bitmap font must include French accented capitals (É È Ê À Ç Ô Î Ù) in case labels are translated.

1. **SHOWER:** Bathroom tiles in the background. The kid's head and shoulders show above an opaque curtain. The loop: water streaming from the shower head, the kid scrubbing his hair with shampoo foam, bubbles floating up, steam drifting.
2. **GETTING DRESSED:** Bedroom. The loop: he puts on the t-shirt (arms up, head pops through), then the pants (hop on one foot), then the socks (sitting on the bed edge), then resets. **No shoes in this scene.**
3. **BREAKFAST:** Kitchen table seen from the side. The loop: spoon goes into the bowl, lifts to the mouth, he chews with cheeks puffing, and sips from a glass of milk now and then.
4. **BRUSHING TEETH:** A bathroom mirror framing. The loop: toothbrush moves side to side, foam builds at the mouth, and he spits into the sink now and then.
5. **SHOES (close-up):** A low camera near the floor showing only his lower legs and socked feet (same socks as scene 2). The loop: a foot slides into a shoe, he pulls the strap or tongue, closes the velcro, and switches feet.

## Sound

Sound is out of scope for v1. If added later, it must be optional, use Web Audio with the `webkitAudioContext` fallback, and start only after a user tap (autoplay rules).

## How to work on this project

- Keep **everything ES5** and run the ES5 lint before considering a task done.
- Keep all tunable values in `config.js`: durations, MAX_SPEED, the red-alert threshold (0.98), the speed-ramp start (0.5), flash rate, and colors.
- Any change to the character happens in `character.js` only. Scenes compose parts and never redraw the kid themselves.
- Prefer small, reviewable changes: one scene or one system per task.
- When unsure whether an API works on Chrome 30, assume it doesn't and ask or add a fallback.