// Morning Routine - tunable values. ES5 only.
var MR = window.MR = window.MR || {};

MR.config = {
  // Scene list, in play order. Labels are upper case for the bitmap font.
  SCENES: [
    { id: 'shower',    label: 'SHOWER',          defaultSec: 300 },
    { id: 'dressing',  label: 'GETTING DRESSED', defaultSec: 300 },
    { id: 'breakfast', label: 'BREAKFAST',       defaultSec: 600 },
    { id: 'teeth',     label: 'BRUSHING TEETH',  defaultSec: 180 },
    { id: 'shoes',     label: 'SHOES',           defaultSec: 120 }
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
  MAX_SPEED: 3,
  SPEED_RAMP_START: 0.5,
  RED_ALERT: 0.98,
  FLASH_HZ: 3,           // never above 3 (photosensitivity)
  TRANSITION_MS: 2000,
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

  // Per-scene tuning
  SHOWER: {
    KID_SCALE: 2,        // kid pixel size inside the 256x224 scene
    RIM_Y: 150           // top of the bathtub rim
  },

  // Dev checks (palette budget, missing overlays). tools/ pages turn it on.
  DEV: false
};
