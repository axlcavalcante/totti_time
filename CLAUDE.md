# CLAUDE.md — Morning Routine Timer (Mega Drive style)

## What this project is

This is a browser "game" that is really a **sequenced timer** for a child's morning routine, with Sega Mega Drive / Genesis–style pixel art. The art direction is inspired by *Flashback: The Quest for Identity*, meaning cinematic framing, smooth rotoscoped-feeling animation, and muted but rich palettes. All art is original; nothing from Flashback is copied.

The flow goes like this. On the options screen the player sets five timers, picks which scenes to play (checkboxes) and their order (numbered dropdowns). The chosen scenes then play in that order. Each scene shows a looping animation of the same kid character, with a shrinking time bar and a STOP button underneath. Pressing STOP moves on to the next scene. If the timer runs out before STOP is pressed, a GAME OVER screen appears showing the kid crying.

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

No modules exist, so files are loaded **in dependency order** by a tiny loader in `index.html` that `document.write`s one `<script>` per file with a `?v=<timestamp>` cache-buster, so the browser never runs a stale copy (simple static servers send no cache headers). **Add new files to that list.** Everything hangs off a single global namespace, `window.MR` ("Morning Routine").

```
index.html          // canvas + script tags, minimal CSS
src/config.js       // scene list, labels, default durations, tuning constants
src/palette.js      // Mega Drive palette, color ramps, red-alert palette mapping
src/weather.js      // optional live sky (Open-Meteo), local sun math fallback
src/sky.js          // draws the live sky into any window pane (MR.sky.draw)
src/lighting.js     // recolors outdoor scenes for the time of day / weather (END)
src/font.js         // bitmap pixel font (drawn from data, no web fonts)
src/sprites.js      // sprite data format + pre-render/cache utilities
src/character.js    // THE kid: all body parts, expressions, outfits (reused everywhere)
src/scenes/shower.js
src/scenes/dressing.js
src/scenes/breakfast.js
src/scenes/teeth.js
src/scenes/shoes.js
src/scenes/end.js   // END screen art (house front, school bag, hydrangea)
src/ui.js           // time bar, buttons, checkbox, dropdown, touch hit-testing
src/sound.js        // notification sounds: plays the files in sounds/ (MR.sound)
src/states.js       // state machine (options, transition, scene, gameover, end)
src/testmode.js     // TEST MODE: jump to any screen, speed slider, END OF TIMER
src/main.js         // boot, resize, main loop
sounds/             // bells.wav, hurry.wav, level-up.wav + README (user-replaceable)
```

The game must run when `index.html` is served over plain HTTP (local network server or static hosting). Don't rely on anything that needs a backend.

**Optional live sky (`src/weather.js` data + `src/sky.js` drawing, shared by every window):** the bedroom and kitchen windows show the real sky of Locmariaquer (`config.WEATHER`), meaning the current weather and time of day, from **Open-Meteo** (free, no API key). It uses `XMLHttpRequest` only (no `fetch`/`Promise`), tries https and then http (old KitKat devices may reject modern certificates), and has a 6 s timeout. The result is cached in `localStorage` and refreshed every 30 min. It **never blocks the game**: offline, sunrise and sunset are computed locally (NOAA equation) and the weather defaults to partly cloudy. Only the fixed city coordinates are sent. The sky canvas is rebuilt only when the look changes, never per frame. Dev override for testing: `?sky=rain&tod=dawn` (kinds: clear, partly, overcast, fog, rain, snow, storm; phases: night, dawn, day, dusk).

## Screen layout

The game is designed for **portrait** orientation on a phone and recomputes its layout on `resize`/`orientationchange`.

- **Scene viewport:** a rectangle taking up to **2/3 of the screen height**, centered, containing the animation. Native resolution is **256×224** (Mega Drive H32 mode), scaled up with nearest-neighbor, using integer scaling when it fits and letterboxing otherwise.
- **Padding** separates the viewport from the UI below it.
- **Time bar:** full width of the viewport, shrinking from right to left as time passes. Its color goes green → yellow (at 50%) → orange (at 80%) → red. A small bitmap-font `mm:ss` remaining-time readout is optional.
- **STOP button:** below the bar, large. The touch target must be at least 48 CSS px tall, ideally much bigger, because a 6-year-old is using it. It is styled like a Mega Drive button or menu.
- UI is drawn on the same canvas for a consistent pixel look, with touch hit-testing done in `ui.js`. The page background is black.

## State machine

```
OPTIONS -> TRANSITION(1) -> SCENE(1) --STOP--> GREAT JOB -> TRANSITION(2) -> SCENE(2) ... SCENE(k) --STOP--> END -> OPTIONS
                                 \--time runs out--> GAMEOVER --tap CONTINUE--> TRANSITION(next) (or OPTIONS after the last)
```

**Playlist:** the scenes that play, and their order, come from OPTIONS (`MR.settings.loadPlaylist()`, key `MR.playlist.v1`, stored by scene id). Run params are `{ index, pos, order, durations }`: `index` is the scene's index in `config.SCENES` (art, title, duration), `order` the chosen scene indices and `pos` the place in it. Always move on with `MR.playlist.next(params)` (null after the last one) and show "n/k" with `MR.playlist.label(params)`. Never assume `index + 1`. `MR.playlist.normalize(p)` fills `order`/`pos` for callers that only give an index (test mode, `?scene=`).

- **OPTIONS:** Five rows, one per scene: the label, then `[x] [n v]  [-] mm:ss [+]`. The **checkbox** (the whole left column is the touch target) picks whether the scene plays. Unchecking closes the gap in the order, and checking adds the scene last. The **order dropdown** opens a list of 1..k (k = checked scenes), placed below the box or above it if there's no room; choosing m moves the scene to place m. Unchecked rows are dimmed and their dropdown shows `-`. TOTAL counts only the checked scenes, and START is disabled when none is checked. A speaker button in the header toggles SOUND ON/OFF (`MR.sound.v1`). There is no text input, to avoid the Android keyboard. The step is 30 s and the range is 30 s–20 min. Durations and the playlist are saved to `localStorage` (inside try/catch) and restored on the next launch. A big START button is at the bottom.
- **TRANSITION:** A stand-alone ~4 s title card (`TRANSITION_MS`) shown *before* the scene, full screen with no time bar or STOP. Letterbox bars slide in, "SCENE n/k" types out (k = scenes chosen), the scene's French `title` from `config.js` (e.g. "L'HEURE DU BAIN") drops in letter by letter in the title font (`MR.font.title`: gradient, outline and shadow, derived from the UI glyphs), an underline grows, a shine sweeps across, then the bars close and the scene starts. **The timer does not run during transitions.** Taps are ignored.
- **SCENE:** The looping animation, time bar and STOP button. The timer starts when the transition ends. Sound cues: `bells` at 50% of the time, `hurry` at 90% (10% left), and `levelUp` when STOP is pressed (see Sound).
- **GAMEOVER:** Shown when time reaches 0 before STOP. The **same kid** (the normal rig, drawn up to 4x) cries: sad brows and eyes shut tight (`eyes: 'cryA'/'cryB'`), a wailing mouth (`mouth: 'wailA'/'wailB'`) and sobbing dips. Tears well up in the outer eye corners (anchored to the baked `head.eyes` point), roll down the cheeks and drip off below the chin, with wet trails on the cheeks. Big red "GAME OVER" letters (title font, `red` color set) thud in. A CONTINUE button appears after 1.5 s and goes to the next scene's title card (OPTIONS after the last one) so the routine isn't blocked.
- **GREAT JOB (`sceneDone`):** After STOP, the kid jumps with both arms up, lands and claps under falling confetti. After `GREAT_JOB_MS` (6 s, with a small fill bar) it goes **automatically** to the next scene's title card, or OPTIONS after the last scene until END exists. Taps are ignored.
- **END (`end` state + art in `src/scenes/end.js`):** Reached by pressing STOP on the last scene in time (a scene 5 time-out goes GAME OVER -> OPTIONS instead). The screen is the house front, after `photo_sample.jpeg`, framed close on the entrance: an anthracite arched door with a glass strip under a dark porch canopy, a beige stone wall on the left, a cream wall with a small window and a lamp, a HOME doormat, terracotta pots, light-brown tiles, and a blue/violet/pink **hydrangea as tall as the kid** on the right. The same kid, **fully dressed with his shoes on** (`ready`), waves goodbye while holding his **wheeled school bag** (black with green trim, drawn at 3x so it's waist-high), with happy hops. "ALL DONE!" drops in (title font) with a shine and confetti. The whole scene is **lit for the real time of day and weather** in Locmariaquer (`src/lighting.js`: `MR.lighting.grade(canvas, look)`, cached per look, Mega Drive-snapped): pink-gold sunrise, normal day, orange evening with the lamp on, blue night with the lamp glow and lit window and door glass, grey for cloudy or fog (plus haze), grey-blue for rain or storm (plus rain streaks; storm adds the same rare gentle glow as the windows), and snow with flakes. "TAP TO PLAY AGAIN" and taps are enabled after `END.TAP_AT` (2.5 s), and a tap goes to OPTIONS.

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
MAX_SPEED = 3.3   // tunable in config.js
```

## Red alert (time almost up)

- **Trigger:** on while `remaining <= max(2% of the timer, min(5 s, 25% of the timer))`, so short timers still get a noticeable warning (`RED_ALERT`, `RED_ALERT_MIN_MS`, `RED_ALERT_MAX_FRAC` in `config.js`). Examples: 20 s timer -> last 5 s; 5 min -> last 6 s; 20 min -> last 24 s.
- The whole screen (scene, bar area and UI) switches to a **red high-contrast palette**: each color is mapped to `MR.palette.RED_RAMP` by luminance (darks to deep red/black, lights to pink/white). STOP and the bar fill keep their own bright colors.
- Implemented by **pre-rendering a red variant of every cached layer and sprite at scene init** with `MR.sprites.withRed(canvas)` (sets `canvas.red`). It uses `getImageData`, so it must **never** run in the frame loop. Scenes receive `render(ctx, clock, alert)` and draw `img.red` when `alert.red`. The UI swaps its color table with `MR.ui.setPalette(true)` (`MR.palette.UI_RED`).
- **Smooth, not strobing:** the red version cross-fades in over `RED_FADE_MS` (300 ms). Then a sine "breathing" overlay of deep red pulses over the whole screen, speeding up from `RED_PULSE_HZ_MIN` (1.25 Hz) to `RED_PULSE_HZ_MAX` (2 Hz) as time runs out. Its phase is integrated so speed changes never jump. **It is hard-capped at `FLASH_HZ` = 3 flashes per second** (photosensitivity guideline). This is non-negotiable even if a faster rate "looks better".
- **The kid gets worried:** scenes swap to `eyes: 'worried'` and `mouth: 'worried'` poses (pre-baked in `init`). The shower also shows a bobbing sweat drop.

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
- Proportions are chibi-leaning but not super-deformed: a full-body sprite is about **32×56 px** at native resolution. Close-up moments reuse **the same rig drawn at a bigger scale** with extra part variants. Never make a separate model of the kid (a close-up feet version was tried for the shoes scene and replaced by the full-body kid crouching).
- **Sprite data format:** arrays of strings where each character is a palette index (`.` = transparent). A single `buildSprite(data, palette)` function converts them into cached canvases (normal plus red-alert variants).
- **Modesty rule:** the character is a child. His chest may be bare only in the bath/dressing contexts (`torso: 'bare'`), but **below the waist he is always covered**: the base underwear shorts are always drawn, and towels/pants go on top. The shower scene must be fully non-revealing. Only the head and shoulders show above an opaque shower curtain or the tub edge, with steam and bubbles. In the dressing scene he starts in an undershirt and underwear shorts. Never draw him unclothed.

### Scenes (each is an endless loop)

The scene names below are defaults in `config.js` and are easy to rename or translate. The bitmap font must include French accented capitals (É È Ê À Ç Ô Î Ù) in case labels are translated.

1. **SHOWER:** Bathroom tiles in the background. The kid's head and shoulders show above an opaque curtain. The loop: water streaming from the shower head, the kid scrubbing his hair with shampoo foam, bubbles floating up, steam drifting.
2. **GETTING DRESSED (`src/scenes/dressing.js`):** His bedroom: star wallpaper, a curtained window, wall shelves with toys (a small red car, ball, teddy, robot, blocks) and his bed with a **small panda teddy next to the pillow**. The loop (steps x `DRESSING.TEMPO`): bare-chested with his bath towel around his waist down to the knees (underwear shorts always on beneath), he pulls his underwear on under it and drops the towel on the bed. He hops into his pants, sits on the bed edge (the seat height comes from the rig's `sit` legs), pulls the t-shirt over his head (head pops through, `tshirtRolled`) and puts on both socks (`sockLeft`, then `socks`), then the loop restarts. **No shoes in this scene.** Dressing stages use the pose `clothes: [...]` override, and props sit in his hands through each arm's `hand` point.
3. **BREAKFAST (`src/scenes/breakfast.js`):** The kid sits **facing us across the kitchen table** (a front view, so the same rig is reused; the kid is drawn at 3x). The checked tablecloth hides him below the chest. The kitchen has a warm wall, a tiled backsplash, wooden cabinets, a **wall clock showing the real time**, and a window with the live sky and a plant on the sill. The loop (steps x `BREAKFAST.TEMPO`), done twice: the spoon dips into the bowl of cereal, lifts (`spoonMid`), goes to his mouth (`toMouth`), and he chews with his cheeks puffing (`head: 'puff'` + `chewA`/`chewB`). Then he sips his milk (`armL: 'toMouth'` with a tilted glass) and gets a **milk mustache** (`mouth: 'milky'`).
4. **BRUSHING TEETH (`src/scenes/teeth.js`):** Seen **from the mirror's point of view**, with no mirror frame drawn: the kid (4x, front view) stands behind the sink facing us, low in the frame. In the foreground there is only the counter's **top slab** (no cabinet doors) with the basin rim, a cup with two toothbrushes, a toothpaste tube, and a **big faucet in the middle seen from behind**, cut off by the bottom of the screen. Behind him, placed low and sized plausibly: a wooden door with the red striped towel on its hook, and a wicker laundry basket, on the white tiles with blue trim. The loop (steps x `TEETH.TEMPO`): the toothbrush moves side to side at his mouth (`armR: 'toMouth'` + `offsets: { armR: [+-1, 0] }`, `mouth: 'brush'` showing teeth) while foam builds up (3 sizes). Then he leans toward the sink (`offsets: { torso: [0, 3] }`, `mouth: 'spit'`), a foam drop arcs down into the basin, and he comes back up happy.
5. **SHOES (`src/scenes/shoes.js`):** The **house entrance**, with the same camera and full-body kid (2x) as the dressing scene. There is a green front door about 1.8x his height, with a small window showing the live sky, and a doormat; a framed sea picture, wall hooks with a coat and a scarf, an umbrella, a console table with a bowl of keys and a plant, a rug and a wooden floor. A **little cat** (light brown back, head, ears and tail, white muzzle, chest and paws) sits by the console: its tail swishes, it blinks, and its ears twitch when he stomps. The loop (steps x `SHOES.TEMPO`): standing in socks with his shoes on the floor beside his feet, he **crouches** (`legs: 'crouch'`), picks up the left shoe and puts it on (`shoeLeft` overlay, hands wiggling), does the same with the right one (`shoes`), then stands up and stomps happily. In the red alert: the worried face and sweat drop, like every scene.

## Sound

- **The sounds are plain files in `sounds/`**, so the user can replace them (same name, or new paths in `config.SOUND.FILES`). See `sounds/README.md`. **Never synthesize the game's sounds in JS.** The defaults (16-bit mono 22050 Hz WAV) are regenerated by the dev-only `tools/make-sounds.py`.
- `src/sound.js` (`MR.sound`): `load()` at boot never blocks. With Web Audio (`AudioContext` / `webkitAudioContext`), files are fetched by `XMLHttpRequest` (arraybuffer, `?v=` cache-buster) and decoded with the callback form of `decodeAudioData`. Without it, or when the page is opened from disk (`file://`, where Chrome blocks XHR), it uses one `<audio>` element per sound, else silence. Any sound Web Audio fails to load or decode also falls back to `<audio>`. A missing or undecodable file just stays silent with one warning. Everything is in try/catch.
- Audio starts only after a user tap: `main.js` calls `MR.sound.unlock()` on every touch/mouse down and touch end.
- Cues: `MR.sound.cues()` gives `{ reset, update(progress) }`, used by SCENE and by the test mode END OF TIMER. It plays `bells` at `SOUND.HALF_AT` (0.5) and `hurry` at `SOUND.HURRY_AT` (0.9), each once, only the latest one after a stall, and none at progress 1. STOP plays `levelUp`.
- Optional: the SOUND ON/OFF header button on OPTIONS (default `SOUND.ENABLED`), with volume `SOUND.VOLUME`.

## Dev tools

- `tools/character-preview.html`: every part, overlay and pose at 4x, with dev warnings on.
- `tools/sound-preview.html`: plays each file in `sounds/` through `MR.sound` (works even when sound is switched off).
- `tools/make-sounds.py`: rewrites the default sound files.
- `tools/scene-strip.html?scene=<id>&t=0,500,...&red=1`: a filmstrip of one scene at the given animation-clock times. Add `&sky=<kind>&tod=<phase>` to force a window-sky look. It also works with headless Chrome `--screenshot` when no browser is attached.

## Test mode (`src/testmode.js`)

The **TEST MODE** button on OPTIONS (header, bottom-right) (`config.SHOW_TEST_BUTTON`) opens a plain menu with one link per implemented screen: each scene, each scene's title card, GREAT JOB and GAME OVER. The list is built from `config.SCENES` plus `MR.scenes`, so new scenes appear automatically. A link shows **only the animation**, a **speed slider** (x0.25 to x4) and **BACK**. It never advances to another screen.
- **Scenes** run on a test clock. **END OF TIMER** simulates the last 10 s of a 20 s timer with the real speed-up and red alert, using the shared `MR.timerFx`, the same code as the game, and plays the same `bells`/`hurry` sound cues (`MR.sound.cues()`).
- **Full-screen states** (title, GREAT JOB, GAME OVER, ALL DONE) are rendered with a virtual `MR.now`, swapped only during their render, and restarted in a loop. Their `update` is never called.
- **Sky picker** in the test menu: TIME OF DAY (AUTO, SUNRISE, DAY, EVENING, NIGHT) and WEATHER (AUTO, CLEAR, CLOUDY, RAIN, SNOW, FOG, STORM) force `MR.weather.setOverride(phase, kind)`. That applies to every window (bedroom, kitchen, entrance door) and the END lighting. The override is reset to AUTO when leaving test mode, so a real morning always uses the real sky.

## How to work on this project

- Keep **everything ES5** and run the ES5 lint before considering a task done.
- Keep all tunable values in `config.js`: durations, MAX_SPEED, the red-alert threshold (0.98), the speed-ramp start (0.5), flash rate, and colors.
- Any change to the character happens in `character.js` only. Scenes compose parts and never redraw the kid themselves.
- Prefer small, reviewable changes: one scene or one system per task.
- When unsure whether an API works on Chrome 30, assume it doesn't and ask or add a fallback.