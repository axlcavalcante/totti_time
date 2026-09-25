// Scene lighting from the time of day and the weather (MR.weather.sky):
// recolors a pre-rendered canvas for a "look" (sunrise, daylight, evening,
// night x clear / grey / wet / snow) and snaps the result back to the Mega
// Drive color levels, so it stays pixel art. Used by the outdoor END screen.
// Graded canvases are cached per look; getImageData runs only when a look is
// first needed (at init or when the real time/weather changes), never per
// frame. ES5 only.
var MR = window.MR = window.MR || {};

(function () {
  var LEVELS = [0, 36, 73, 109, 146, 182, 219, 255];

  // phase: multiply + add per channel
  var PHASE = {
    day:   { m: [1, 1, 1],          a: [0, 0, 0] },
    dawn:  { m: [1.0, 0.86, 0.8],   a: [24, 6, 12] },     // soft warm pink-gold
    dusk:  { m: [1.0, 0.7, 0.52],   a: [18, 0, 0] },      // warm orange, dimmer
    night: { m: [0.34, 0.4, 0.66],  a: [0, 0, 22] }       // dark blue
  };
  // weather: desaturate toward grey, then tint
  var WEATHER = {
    clear: { desat: 0,   m: [1, 1, 1],        a: [0, 0, 0] },
    grey:  { desat: 0.6, m: [0.9, 0.92, 1.0], a: [0, 0, 0] },
    wet:   { desat: 0.5, m: [0.74, 0.8, 0.95], a: [0, 0, 0] },
    snow:  { desat: 0.3, m: [0.95, 1.0, 1.08], a: [10, 10, 16] }
  };

  function snap(v) {
    var i, best = 0, d = 999;
    v = Math.max(0, Math.min(255, v));
    for (i = 0; i < LEVELS.length; i++) { if (Math.abs(LEVELS[i] - v) < d) { d = Math.abs(LEVELS[i] - v); best = LEVELS[i]; } }
    return best;
  }

  function groupFor(kind) {
    if (kind === 'overcast' || kind === 'fog') { return 'grey'; }
    if (kind === 'rain' || kind === 'storm') { return 'wet'; }
    if (kind === 'snow') { return 'snow'; }
    return 'clear';
  }

  // { phase, kind, group, key } for a MR.weather.sky() result
  function lookFor(sky) {
    var phase = (sky && PHASE[sky.phase]) ? sky.phase : 'day', kind = (sky && sky.kind) || 'clear',
      group = groupFor(kind);
    return { phase: phase, kind: kind, group: group, key: phase + '|' + group };
  }

  function build(canvas, look) {
    var c = MR.sprites.createCanvas(canvas.width, canvas.height), ctx = c.getContext('2d'),
      ph = PHASE[look.phase], we = WEATHER[look.group], img, d, i, r, g, b, l, k;
    ctx.drawImage(canvas, 0, 0);
    if (look.key === 'day|clear') { return c; }
    img = ctx.getImageData(0, 0, c.width, c.height);
    d = img.data;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) { continue; }
      r = d[i]; g = d[i + 1]; b = d[i + 2];
      l = 0.299 * r + 0.587 * g + 0.114 * b;
      k = we.desat;
      r = (r + (l - r) * k) * we.m[0] + we.a[0];
      g = (g + (l - g) * k) * we.m[1] + we.a[1];
      b = (b + (l - b) * k) * we.m[2] + we.a[2];
      d[i] = snap(r * ph.m[0] + ph.a[0]);
      d[i + 1] = snap(g * ph.m[1] + ph.a[1]);
      d[i + 2] = snap(b * ph.m[2] + ph.a[2]);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Graded (cached) version of a canvas for a look.
  function grade(canvas, look) {
    if (!canvas._grades) { canvas._grades = {}; }
    if (!canvas._grades[look.key]) { canvas._grades[look.key] = build(canvas, look); }
    return canvas._grades[look.key];
  }

  MR.lighting = { lookFor: lookFor, grade: grade };
}());
