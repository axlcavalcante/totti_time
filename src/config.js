// Morning Routine - tunable values. ES5 only.
var MR = window.MR = window.MR || {};

MR.config = {
  // Scene list, in play order. Upper case for the bitmap font. `label` is
  // shown on OPTIONS, `title` on the cinematic title card before the scene
  // (accents as \u escapes: \u00C9 = E acute, \u00C0 = A grave).
  SCENES: [
    { id: 'shower',    label: 'SHOWER',          defaultSec: 300, title: 'L\'HEURE DU BAIN' },
    { id: 'dressing',  label: 'GETTING DRESSED', defaultSec: 300, title: 'ON S\'HABILLE' },
    { id: 'breakfast', label: 'BREAKFAST',       defaultSec: 600, title: 'LE PETIT-D\u00C9JEUNER' },
    { id: 'teeth',     label: 'BRUSHING TEETH',  defaultSec: 180, title: 'BROSSE \u00C0 DENTS' },
    { id: 'shoes',     label: 'SHOES',           defaultSec: 120, title: 'LES CHAUSSURES' }
  ],

  // Options screen timer range
  STEP_SEC: 30,
  MIN_SEC: 30,
  MAX_SEC: 1200,
  STORAGE_KEY: 'MR.durations.v1',

  // Layout
  NATIVE_W: 256,       // Mega Drive H32 width
  SCENE_H: 224,        // native scene viewport height (used by scene states)
  MIN_TOUCH_CSS: 48,   // minimum touch target height in CSS px

  // Hold-to-repeat on [-]/[+] (ms)
  REPEAT_DELAY: 400,
  REPEAT_SLOW: 150,
  REPEAT_FAST: 60,
  REPEAT_ACCEL_AFTER: 2000,

  // Options screen idle animation (ms)
  IDLE_BREATH_MS: 700,      // time per breathing half-cycle
  IDLE_BLINK_MS: 120,
  IDLE_BLINK_EVERY: 3500,
  IDLE_WAVE_EVERY: 6000,
  IDLE_WAVE_FRAME_MS: 180,
  IDLE_WAVE_CYCLES: 3,

  // Scene playback (future tasks)
  MAX_SPEED: 3.3,
  SPEED_RAMP_START: 0.5,
  // Red alert: on while remaining <= max(RED_ALERT share, min(MIN_MS,
  // MAX_FRAC of the timer)), so short timers still get a noticeable warning.
  RED_ALERT: 0.98,
  RED_ALERT_MIN_MS: 5000,
  RED_ALERT_MAX_FRAC: 0.25,
  RED_FADE_MS: 300,      // cross-fade into the red palette
  RED_PULSE_HZ_MIN: 1.25, // smooth pulse speeds up as time runs out...
  RED_PULSE_HZ_MAX: 2,
  FLASH_HZ: 3,           // ...but never above 3 (photosensitivity hard cap)
  TRANSITION_MS: 4000,   // title card before each scene; the timer waits
  MAX_DT: 100,           // anim clock never jumps more than this per frame (ms)

  // Time bar: color from each threshold of progress upward (MR.palette.UI keys)
  BAR_COLORS: [
    [0,    'barGreen'],
    [0.5,  'barYellow'],
    [0.8,  'barOrange'],
    [0.95, 'barRed']
  ],

  // SCENE layout (native px)
  SCENE_BAR_H: 10,
  SCENE_READOUT_H: 9,
  SCENE_PAD: 4,
  SCENE_STOP_MAX_H: 90,

  // Live sky in the bedroom window (optional; see src/weather.js)
  WEATHER: {
    CITY: 'LOCMARIAQUER',
    LAT: 47.5697,
    LON: -2.9458,
    REFRESH_MIN: 30,
    TIMEOUT_MS: 6000
  },

  // GREAT JOB screen: shown after STOP, then the next scene starts by itself
  GREAT_JOB_MS: 6000,

  // GAME OVER screen
  GAMEOVER: {
    KID_SCALE: 4,        // the same kid, drawn bigger (shrinks to 3/2 if short)
    TEAR_PERIOD: 900,    // one tear per eye per period (right eye offset half)
    CONTINUE_AT: 1500    // CONTINUE appears (and becomes tappable) after this
  },

  // Per-scene tuning
  DRESSING: {
    KID_SCALE: 2,
    FLOOR_Y: 196,        // where his feet touch the floor
    TEMPO: 1.25          // step durations x1.25 = 20% slower loop
  },
  BREAKFAST: {
    KID_SCALE: 3,        // closer framing across the table
    TEMPO: 1.25,         // same calm pace as the dressing scene
    TABLE_Y: 170         // top of the table; he is hidden below chest level
  },
  TEETH: {
    KID_SCALE: 4,        // his reflection in the mirror, head and shoulders
    TEMPO: 1.25,
    COUNTER_Y: 198       // top of the sink counter (low in the frame); hides him below the chest
  },
  SHOES: {
    KID_SCALE: 2,        // full body, like the dressing scene
    TEMPO: 1.25,
    FLOOR_Y: 196         // where his feet touch the floor
  },
  SHOWER: {
    KID_SCALE: 2,        // kid pixel size inside the 256x224 scene
    RIM_Y: 150           // top of the bathtub rim
  },

  // Small TEST button on OPTIONS -> test mode (jump to any screen)
  SHOW_TEST_BUTTON: true,

  // Dev checks (palette budget, missing overlays). tools/ pages turn it on.
  DEV: false
};
