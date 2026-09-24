// State machine: options, scene (+ stubs); transition/gameover/end come later.
// ES5 only.
//
// A state is an object with any of:
//   enter(params, now), exit(), minHeight(metrics), layout(w, h, metrics),
//   update(now), render(ctx, w, h),
//   pointerDown(x, y, now), pointerMove(x, y, now), pointerUp(x, y, now),
//   pointerCancel(now)
// Coordinates are native buffer pixels. Call MR.states.invalidate() whenever
// the screen needs to be redrawn.
var MR = window.MR = window.MR || {};

(function () {
  var registry = {}, current = null, currentName = '', lastLayout = null;

  function add(name, state) { registry[name] = state; }

  function go(name, params) {
    var now = MR.now();
    if (current && current.exit) { current.exit(); }
    current = registry[name];
    currentName = name;
    if (current.enter) { current.enter(params || {}, now); }
    if (lastLayout && current.layout) { current.layout(lastLayout.w, lastLayout.h, lastLayout.metrics); }
    invalidate();
  }

  // The tallest layout any state needs; main.js uses it to pick one scale
  // for the whole game so the pixel size never jumps between screens.
  function minHeight(metrics) {
    var h = 0, k, v;
    for (k in registry) {
      if (registry.hasOwnProperty(k) && registry[k].minHeight) {
        v = registry[k].minHeight(metrics);
        if (v > h) { h = v; }
      }
    }
    return h;
  }

  function layout(w, h, metrics) {
    lastLayout = { w: w, h: h, metrics: metrics };
    if (current && current.layout) { current.layout(w, h, metrics); }
  }

  function invalidate() { if (MR.main) { MR.main.invalidate(); } }

  function call(method, a, b, c) {
    if (current && current[method]) { current[method](a, b, c); }
  }

  MR.states = {
    add: add,
    go: go,
    minHeight: minHeight,
    layout: layout,
    invalidate: invalidate,
    update: function (now) { call('update', now); },
    render: function (ctx, w, h) { call('render', ctx, w, h); },
    pointerDown: function (x, y, now) { call('pointerDown', x, y, now); },
    pointerMove: function (x, y, now) { call('pointerMove', x, y, now); },
    pointerUp: function (x, y, now) { call('pointerUp', x, y, now); },
    pointerCancel: function (now) { call('pointerCancel', now); },
    currentName: function () { return currentName; },
    get: function (name) { return registry[name]; }
  };
}());

// ------------------------------------------------------------------ settings
(function () {
  var cfg = MR.config;

  function clampSnap(sec) {
    sec = Math.round(sec / cfg.STEP_SEC) * cfg.STEP_SEC;
    return Math.max(cfg.MIN_SEC, Math.min(cfg.MAX_SEC, sec));
  }

  function defaults() {
    var out = [], i;
    for (i = 0; i < cfg.SCENES.length; i++) { out.push(cfg.SCENES[i].defaultSec); }
    return out;
  }

  function load() {
    var d = defaults(), raw, arr, i;
    try {
      raw = window.localStorage.getItem(cfg.STORAGE_KEY);
      if (raw) {
        arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === d.length) {
          for (i = 0; i < arr.length; i++) {
            if (typeof arr[i] !== 'number' || !isFinite(arr[i])) { return defaults(); }
          }
          for (i = 0; i < arr.length; i++) { d[i] = clampSnap(arr[i]); }
        }
      }
    } catch (e) {
      return defaults();
    }
    return d;
  }

  function save(durations) {
    try {
      window.localStorage.setItem(cfg.STORAGE_KEY, JSON.stringify(durations));
    } catch (e) { /* private mode / storage full: keep going */ }
  }

  MR.settings = { load: load, save: save, clampSnap: clampSnap };
}());

// ------------------------------------------------------------------ OPTIONS
(function () {
  var cfg = MR.config, C = MR.palette.UI, ui = MR.ui, font = MR.font;

  var MARGIN = 4, ROW_GAP = 2, ROW_PAD = 3, LABEL_H = 8, FLOOR_H = 3;
  var DIGIT_SCALE = 2;

  var durations = [];
  var rows = [];          // [{ minus, plus, y, h, ctrlY, ctrlH }]
  var buttons = [];       // all buttons, for hit-testing
  var startBtn = null;
  var active = null;      // button currently held
  var nextRepeat = 0, holdStart = 0;

  var L = null;           // current layout
  var t0 = 0, waveStart = -1e9, poseKey = '';
  var poses = {};         // idle pose key -> pose object (pre-baked)

  // ----- idle animation

  function poseFor(breath, blink, arm) {
    var key = breath + '|' + blink + '|' + arm;
    if (!poses[key]) {
      poses[key] = {
        outfit: 'ready',
        armR: arm,
        eyes: blink ? 'closed' : 'open',
        offsets: breath ? { torso: [0, 1] } : null
      };
    }
    return key;
  }

  function prebake() {
    var arms = ['down', 'waveUp', 'waveMid'], a, b, e;
    for (a = 0; a < arms.length; a++) {
      for (b = 0; b < 2; b++) {
        for (e = 0; e < 2; e++) { MR.character.bake(poses[poseFor(b, e, arms[a])]); }
      }
    }
  }

  function idleKey(now) {
    var t = now - t0, waveDur = cfg.IDLE_WAVE_FRAME_MS * 2 * cfg.IDLE_WAVE_CYCLES,
      breath = Math.floor(t / cfg.IDLE_BREATH_MS) % 2,
      blink = ((t + 1500) % cfg.IDLE_BLINK_EVERY) < cfg.IDLE_BLINK_MS ? 1 : 0,
      waveT = -1, ct, arm = 'down';
    if (now - waveStart < waveDur) {
      waveT = now - waveStart;
    } else {
      ct = t % cfg.IDLE_WAVE_EVERY;
      if (ct >= cfg.IDLE_WAVE_EVERY - waveDur) { waveT = ct - (cfg.IDLE_WAVE_EVERY - waveDur); }
    }
    if (waveT >= 0) {
      arm = Math.floor(waveT / cfg.IDLE_WAVE_FRAME_MS) % 2 === 0 ? 'waveMid' : 'waveUp';
    }
    return poseFor(breath, blink, arm);
  }

  // ----- values

  function refreshEnabled() {
    var i;
    for (i = 0; i < rows.length; i++) {
      rows[i].minus.enabled = durations[i] > cfg.MIN_SEC;
      rows[i].plus.enabled = durations[i] < cfg.MAX_SEC;
    }
  }

  function change(i, delta) {
    var v = MR.settings.clampSnap(durations[i] + delta);
    if (v !== durations[i]) {
      durations[i] = v;
      refreshEnabled();
      MR.states.invalidate();
    }
  }

  function totalSec() {
    var s = 0, i;
    for (i = 0; i < durations.length; i++) { s += durations[i]; }
    return s;
  }

  function buildButtons() {
    var i;
    function stepper(index, delta, label) {
      return ui.button({
        label: label, fireOnDown: true, repeat: true,
        onPress: function () { change(index, delta); }
      });
    }
    rows = [];
    buttons = [];
    for (i = 0; i < cfg.SCENES.length; i++) {
      rows.push({
        minus: stepper(i, -cfg.STEP_SEC, '-'),
        plus: stepper(i, cfg.STEP_SEC, '+')
      });
      buttons.push(rows[i].minus, rows[i].plus);
    }
    startBtn = ui.button({
      label: 'START', style: 'start',
      onPress: function () {
        MR.settings.save(durations);
        MR.states.go('transition', { index: 0, durations: durations.slice() });
      }
    });
    buttons.push(startBtn);
  }

  // ----- layout

  function kidSize() {
    var b = MR.character.bake(poses[poseFor(0, 0, 'down')]);
    return { w: b.canvas.width, h: b.canvas.height, ax: b.ax };
  }

  function sizes(metrics) {
    var ctrlH = Math.max(metrics.minTouch, 22);
    return {
      ctrlH: ctrlH,
      rowH: ROW_PAD + LABEL_H + ROW_PAD + ctrlH + ROW_PAD,
      startH: Math.max(metrics.minTouch + 8, 28),
      totalH: 12,
      headerH: kidSize().h + FLOOR_H + 6
    };
  }

  function minHeight(metrics) {
    var s = sizes(metrics), n = cfg.SCENES.length;
    return MARGIN + s.headerH + MARGIN + n * s.rowH + (n - 1) * ROW_GAP +
      MARGIN + s.totalH + s.startH + MARGIN;
  }

  function layout(w, h, metrics) {
    var s = sizes(metrics), n = cfg.SCENES.length, kid = kidSize(),
      spare = h - minHeight(metrics), kidScale = 1, grow, gap, y, i, r,
      btnW, digitsW, ctrlW, cx, panelW = w - MARGIN * 2;

    // Spend spare height on: a 2x kid, then taller rows, then even gaps.
    if (spare >= kid.h + 8) { kidScale = 2; spare -= kid.h; s.headerH += kid.h; }
    grow = Math.max(0, Math.min(10, Math.floor(spare / (n + 1))));
    s.ctrlH += grow;
    s.rowH += grow;
    s.startH += grow;
    spare -= grow * (n + 1);
    gap = Math.max(0, Math.floor(spare / 4));

    L = { w: w, h: h, kidScale: kidScale, kid: kid };

    y = MARGIN + gap;
    L.headerY = y;
    L.headerH = s.headerH;
    L.floorY = y + s.headerH - FLOOR_H - 2;
    L.kidX = MARGIN + 2 + kid.ax * kidScale;
    L.kidRect = { x: 0, y: y, w: MARGIN + (kid.w + 6) * kidScale, h: s.headerH };
    L.textX = L.kidRect.x + L.kidRect.w + 4;
    y += s.headerH + MARGIN + gap;

    btnW = Math.max(s.ctrlH + 8, 40);
    digitsW = font.measure('00:00', DIGIT_SCALE) - DIGIT_SCALE;
    ctrlW = btnW * 2 + digitsW + 24;
    cx = Math.round((w - ctrlW) / 2);
    for (i = 0; i < n; i++) {
      r = rows[i];
      r.y = y;
      r.h = s.rowH;
      r.ctrlY = y + ROW_PAD + LABEL_H + ROW_PAD;
      r.ctrlH = s.ctrlH;
      ui.setRect(r.minus, cx, r.ctrlY, btnW, s.ctrlH);
      ui.setRect(r.plus, cx + ctrlW - btnW, r.ctrlY, btnW, s.ctrlH);
      r.digitsX = cx + btnW + 12;
      r.digitsY = r.ctrlY + Math.round((s.ctrlH - font.CAP_H * DIGIT_SCALE) / 2);
      y += s.rowH + ROW_GAP;
    }
    y += MARGIN - ROW_GAP + gap;
    L.panelX = MARGIN;
    L.panelW = panelW;
    L.totalY = y + 2;
    y += s.totalH;
    ui.setRect(startBtn, MARGIN, y, panelW, s.startH);
    startBtn.labelScale = s.startH >= 40 ? 3 : 2;
  }

  // ----- drawing

  function render(ctx, w, h) {
    var i, r, sc, label, titleW, titleScale, blockH, ty;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    if (!L) { return; }

    // Header: stage floor, the kid, title.
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, L.floorY, w, FLOOR_H);
    ctx.fillStyle = C.floorDark;
    ctx.fillRect(0, L.floorY + FLOOR_H, w, 1);
    MR.character.draw(ctx, poses[poseKey], L.kidX, L.floorY + 1, L.kidScale);

    titleScale = 2;
    titleW = font.measure('MORNING ROUTINE', titleScale);
    if (L.textX + titleW > w - MARGIN) { titleScale = 1; titleW = font.measure('MORNING ROUTINE', 1); }
    blockH = font.CAP_H * titleScale + 6 + font.CAP_H;
    ty = L.headerY + Math.round((L.floorY - L.headerY - blockH) / 2);
    sc = L.textX + Math.round((w - MARGIN - L.textX) / 2);
    font.drawCentered(ctx, 'MORNING ROUTINE', sc, ty, 'yellow', titleScale);
    font.drawCentered(ctx, 'SET THE TIMERS', sc, ty + font.CAP_H * titleScale + 6, 'dim', 1);

    // One panel per scene: "1 SHOWER" then [-] mm:ss [+]
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      ui.drawPanel(ctx, L.panelX, r.y, L.panelW, r.h);
      font.drawCaps(ctx, String(i + 1), L.panelX + 6, r.y + ROW_PAD + 1, 'yellow', 1);
      label = cfg.SCENES[i].label;
      font.drawCaps(ctx, label, L.panelX + 6 + font.ADVANCE * 2, r.y + ROW_PAD + 1, 'white', 1);
      ui.drawButton(ctx, r.minus);
      ui.drawButton(ctx, r.plus);
      font.drawCaps(ctx, ui.formatTime(durations[i]), r.digitsX, r.digitsY, 'white', DIGIT_SCALE);
    }

    font.drawCentered(ctx, 'TOTAL ' + ui.formatTime(totalSec()), Math.round(w / 2), L.totalY, 'dim', 1);
    ui.drawButton(ctx, startBtn);
  }

  // ----- input

  function release(fire, x, y) {
    var b = active;
    if (!b) { return; }
    active = null;
    if (fire && !b.fireOnDown && b.pressed && ui.contains(b, x, y)) {
      b.pressed = false;
      b.onPress();
    }
    b.pressed = false;
    if (b.repeat) { MR.settings.save(durations); }
    MR.states.invalidate();
  }

  MR.states.add('options', {
    enter: function (params, now) {
      if (!rows.length) { buildButtons(); prebake(); }
      durations = MR.settings.load();
      refreshEnabled();
      active = null;
      t0 = now;
      poseKey = idleKey(now);
    },

    minHeight: minHeight,
    layout: layout,

    update: function (now) {
      var key = idleKey(now), interval;
      if (key !== poseKey) { poseKey = key; MR.states.invalidate(); }

      if (active && active.repeat && active.pressed && active.enabled && now >= nextRepeat) {
        active.onPress();
        interval = now - holdStart > cfg.REPEAT_ACCEL_AFTER ? cfg.REPEAT_FAST : cfg.REPEAT_SLOW;
        nextRepeat += interval;
        if (nextRepeat < now) { nextRepeat = now + interval; }  // after a long frame
      }
    },

    render: render,

    pointerDown: function (x, y, now) {
      var b = ui.hitTest(buttons, x, y);
      if (L && !b && ui.contains(L.kidRect, x, y)) { waveStart = now; return; }
      if (!b) { return; }
      active = b;
      b.pressed = true;
      if (b.fireOnDown) { b.onPress(); }
      if (b.repeat) { holdStart = now; nextRepeat = now + cfg.REPEAT_DELAY; }
      MR.states.invalidate();
    },

    pointerMove: function (x, y) {
      var inside;
      if (!active) { return; }
      inside = ui.contains(active, x, y);
      if (inside !== active.pressed) {
        active.pressed = inside;
        MR.states.invalidate();
      }
    },

    pointerUp: function (x, y) { release(true, x, y); },
    pointerCancel: function () { release(false, 0, 0); }
  });
}());

// ------------------------------------------------------------------ TRANSITION
// Stand-alone title card before each scene (TRANSITION_MS, ~4 s). The timer
// is not running. Letterbox bars slide in, "SCENE n/5" types out, the title
// letters drop in one by one with a bounce, an underline grows, a shine
// sweeps across, then the bars close to black and the scene starts.
(function () {
  var cfg = MR.config, C = MR.palette.UI, font = MR.font, title = MR.font.title;
  var params = {}, t0 = 0, L = null, bg = null, done = false;
  var info = null;          // { size, lines, x[], capY[], count, lineH }

  var BAR_H = 28, BARS_MS = 400, SUB_AT = 300, SUB_MS = 45,
    DROP_AT = 600, DROP_STEP = 90, DROP_MS = 350, DROP_H = 40,
    LINE_MS = 400, SHINE_MIN_AT = 2650, SHINE_MS = 750, CLOSE_AT = 3400;

  function easeOutBack(k) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }
  function easeInOut(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }

  // Pre-rendered background: navy with subtle darker scanline bands.
  function buildBg(w, h) {
    var c = MR.sprites.createCanvas(w, h), ctx = c.getContext('2d'), y;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.bevelDark;
    for (y = 0; y < h; y += 4) { ctx.fillRect(0, y, w, 1); }
    return c;
  }

  function prepare() {
    var t = cfg.SCENES[params.index].title || cfg.SCENES[params.index].label,
      lay = title.layout(t, L.w - 8), capH = title.capH(lay.size), gap = lay.size === 'L' ? 10 : 6,
      blockH, top, i, n = 0;
    info = { size: lay.size, lines: lay.lines, x: [], capY: [], start: [], capH: capH };
    blockH = lay.lines.length * capH + (lay.lines.length - 1) * gap;
    top = Math.round((L.h - blockH) / 2);
    for (i = 0; i < lay.lines.length; i++) {
      info.x.push(Math.round((L.w - title.measure(lay.lines[i], lay.size)) / 2));
      info.capY.push(top + i * (capH + gap));
      info.start.push(n);                       // global letter index of the line
      n += lay.lines[i].length;
    }
    info.count = n;
    info.top = top;
    info.bottom = top + blockH;
    info.landed = DROP_AT + (n - 1) * DROP_STEP + DROP_MS;
    info.shineAt = Math.max(info.landed + LINE_MS, SHINE_MIN_AT);
  }

  function render(ctx, w, h) {
    var t = MR.now() - t0, i, j, bars, sub, n, lineW, s, k, cx = Math.round(w / 2), close, uy, sw;
    if (!L || !info) { return; }
    ctx.drawImage(bg, 0, 0);

    // "SCENE 1/5", typed
    sub = 'SCENE ' + (params.index + 1) + '/' + cfg.SCENES.length;
    n = Math.max(0, Math.min(sub.length, Math.floor((t - SUB_AT) / SUB_MS) + 1));
    if (n > 0) {
      font.drawCaps(ctx, sub.substr(0, n), Math.round(cx - (font.measure(sub, 1) - 1) / 2),
        info.top - 22, 'dim', 1);
    }

    // title letters drop in with a bounce; the shine sweeps left to right
    s = (t - info.shineAt) / SHINE_MS * (info.count + 3) - 1.5;
    for (i = 0; i < info.lines.length; i++) {
      (function (line) {
        title.draw(ctx, info.lines[line], info.x[line], info.capY[line], info.size, function (j2) {
          var gi = info.start[line] + j2, st = DROP_AT + gi * DROP_STEP, kk;
          if (t < st) { return { hidden: true }; }
          kk = Math.min(1, (t - st) / DROP_MS);
          return { dy: -(1 - easeOutBack(kk)) * DROP_H, shine: t >= info.shineAt && Math.abs(gi - s) < 1.5 };
        });
      }(i));
    }

    // underline grows outward from the center once every letter landed
    if (t > info.landed) {
      k = Math.min(1, (t - info.landed) / LINE_MS);
      lineW = 0;
      for (j = 0; j < info.lines.length; j++) { lineW = Math.max(lineW, title.measure(info.lines[j], info.size)); }
      sw = Math.round(lineW * easeInOut(k));
      uy = info.bottom + (info.size === 'L' ? 10 : 7);
      ctx.fillStyle = MR.palette.TITLE.ramp[1];
      ctx.fillRect(cx - Math.round(sw / 2), uy, sw, 2);
      ctx.fillStyle = MR.palette.TITLE.ramp[3];
      ctx.fillRect(cx - Math.round(sw / 2), uy + 2, sw, 1);
    }

    // twinkling stars around the title during the shine
    if (t > info.shineAt) {
      for (j = 0; j < 4; j++) {
        if ((Math.floor(t / 180) + j) % 3 !== 0) {
          font.drawCentered(ctx, '+', [20, w - 20, 36, w - 36][j],
            [info.top - 6, info.top + 4, info.bottom + 2, info.bottom - 10][j], j % 2 ? 'white' : 'yellow', 1);
        }
      }
    }

    // letterbox bars: slide in, then close to black at the end
    bars = Math.round(BAR_H * easeInOut(Math.min(1, t / BARS_MS)));
    if (t > CLOSE_AT) {
      close = easeInOut(Math.min(1, (t - CLOSE_AT) / (cfg.TRANSITION_MS - CLOSE_AT)));
      bars = Math.round(BAR_H + (Math.ceil(h / 2) - BAR_H) * close);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, bars);
    ctx.fillRect(0, h - bars, w, bars);
  }

  MR.states.add('transition', {
    enter: function (p, now) {
      params = p;
      t0 = now;
      done = false;
      if (L) { prepare(); }
    },
    layout: function (w, h) {
      L = { w: w, h: h };
      bg = buildBg(w, h);
      prepare();
    },
    update: function (now) {
      MR.states.invalidate();
      if (!done && now - t0 >= cfg.TRANSITION_MS) {
        done = true;
        MR.states.go('scene', params);
      }
    },
    render: render
    // taps are ignored so the card can't be skipped by accident
  });
}());

// ------------------------------------------------------------------ SCENE
// Generic scene player: timestamp timer, shrinking time bar, STOP button and
// the animation clock. The scene art lives in src/scenes/<id>.js as
// MR.scenes[id] = { init(), render(ctx, clock) } drawing a 256x224 frame.
// The timer starts on enter (the title card is the separate 'transition').
(function () {
  var cfg = MR.config, C = MR.palette.UI, ui = MR.ui, font = MR.font;

  var index = 0, durations = [], mod = null;
  var startTime = 0, duration = 1, last = 0, clock = 0, progress = 0, finished = false;
  var active = null, L = null;
  // red alert
  var alertOn = false, alertStart = 0, alertWindow = 0, pulsePhase = 0, pulseHz = 0, fade = 0;
  var NORMAL = { red: false }, RED = { red: true };
  var PULSE_COLOR = 'rgb(' + MR.palette.RED_RAMP[1].join(',') + ')';
  var stopBtn = ui.button({ label: 'STOP', style: 'stop', onPress: function () { finish('sceneDone'); } });

  // Animation speed multiplier: 1 until SPEED_RAMP_START, then eases in to
  // MAX_SPEED at the end. Applied to the clock's dt, never to elapsed time.
  function speed(p) {
    var r0 = cfg.SPEED_RAMP_START, k;
    if (p < r0) { return 1; }
    k = (p - r0) / (1 - r0);
    return 1 + (cfg.MAX_SPEED - 1) * k * k;
  }

  function finish(next) {
    if (finished) { return; }
    finished = true;
    MR.states.go(next, { index: index, durations: durations });
  }

  function stopMin(metrics) { return Math.max(metrics.minTouch + 8, 28); }

  function fixedHeight() {
    return cfg.SCENE_PAD + cfg.SCENE_H + cfg.SCENE_PAD + cfg.SCENE_READOUT_H +
      cfg.SCENE_BAR_H + cfg.SCENE_PAD + cfg.SCENE_PAD;
  }

  function minHeight(metrics) { return fixedHeight() + stopMin(metrics); }

  function layout(w, h, metrics) {
    var stopH = Math.min(cfg.SCENE_STOP_MAX_H, Math.max(stopMin(metrics), h - fixedHeight())),
      top = Math.max(0, Math.floor((h - fixedHeight() - stopH) / 2));
    L = { w: w };
    L.viewY = top + cfg.SCENE_PAD;
    L.readoutY = L.viewY + cfg.SCENE_H + cfg.SCENE_PAD;
    L.barY = L.readoutY + cfg.SCENE_READOUT_H;
    ui.setRect(stopBtn, 4, L.barY + cfg.SCENE_BAR_H + cfg.SCENE_PAD, w - 8, stopH);
    stopBtn.labelScale = stopH >= 40 ? 3 : 2;
  }

  // Red alert window (ms): the last 2% of the timer, but at least ~5 s so
  // short timers still get a noticeable warning, and never over 25% of it.
  function alertWindowFor(d) {
    return Math.max((1 - cfg.RED_ALERT) * d, Math.min(cfg.RED_ALERT_MIN_MS, cfg.RED_ALERT_MAX_FRAC * d));
  }

  // Pulse speed: RED_PULSE_HZ_MIN -> MAX as time runs out, hard-capped at
  // FLASH_HZ (photosensitivity: never more than 3 flashes per second).
  function pulseHzFor(remainingMs) {
    var k = 1 - Math.max(0, Math.min(1, remainingMs / alertWindow));
    return Math.min(cfg.FLASH_HZ, cfg.RED_PULSE_HZ_MIN + (cfg.RED_PULSE_HZ_MAX - cfg.RED_PULSE_HZ_MIN) * k);
  }

  function renderPlaceholder(ctx) {
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, 0, cfg.NATIVE_W, cfg.SCENE_H);
    font.drawCentered(ctx, cfg.SCENES[index].label, cfg.NATIVE_W / 2, 90, 'yellow', 2);
    font.drawCentered(ctx, 'SCENE COMING SOON', cfg.NATIVE_W / 2, 120, 'dim', 1);
  }

  function renderScene(ctx, alert) {
    if (mod) { mod.render(ctx, clock, alert); } else { renderPlaceholder(ctx); }
  }

  function render(ctx, w, h) {
    var remaining, redUI = alertOn && fade >= 0.5;
    ui.setPalette(redUI);
    ctx.fillStyle = redUI ? MR.palette.UI_RED.bevelDark : C.bevelDark;
    ctx.fillRect(0, 0, w, h);
    if (!L) { ui.setPalette(false); return; }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.viewY, cfg.NATIVE_W, cfg.SCENE_H);
    ctx.clip();
    ctx.translate(0, L.viewY);
    if (!alertOn) {
      renderScene(ctx, NORMAL);
    } else if (fade < 1) {
      // smooth entry: red version cross-fades over the normal one
      renderScene(ctx, NORMAL);
      ctx.globalAlpha = fade;
      renderScene(ctx, RED);
      ctx.globalAlpha = 1;
    } else {
      renderScene(ctx, RED);
    }
    ctx.restore();

    remaining = Math.ceil(duration * (1 - progress) / 1000);
    font.drawCaps(ctx, (index + 1) + '/' + cfg.SCENES.length + ' ' + cfg.SCENES[index].label,
      4, L.readoutY + 1, 'dim', 1);
    font.drawCaps(ctx, ui.formatTime(remaining), w - 4 - (font.measure('00:00', 1) - 1),
      L.readoutY + 1, 'white', 1);
    ui.drawTimeBar(ctx, 4, L.barY, w - 8, cfg.SCENE_BAR_H, progress);
    ui.drawButton(ctx, stopBtn);

    // smooth "breathing" deep-red pulse over the whole screen
    if (alertOn) {
      ctx.globalAlpha = (0.10 + 0.35 * (1 - Math.cos(2 * Math.PI * pulsePhase)) / 2) * fade;
      ctx.fillStyle = PULSE_COLOR;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    ui.setPalette(false);
  }

  MR.speedAt = speed;

  MR.states.add('scene', {
    enter: function (params, now) {
      index = params.index || 0;
      durations = params.durations || MR.settings.load();
      mod = MR.scenes && MR.scenes[cfg.SCENES[index].id] || null;
      if (mod && !mod.ready) { mod.init(); mod.ready = true; }
      startTime = now;
      last = now;
      duration = Math.max(1, durations[index]) * 1000;
      clock = 0;
      progress = 0;
      finished = false;
      alertWindow = alertWindowFor(duration);
      alertOn = false;
      pulsePhase = 0;
      pulseHz = 0;
      fade = 0;
      active = null;
      stopBtn.pressed = false;
    },

    minHeight: minHeight,
    layout: layout,

    update: function (now) {
      var dt;
      if (finished) { return; }
      // Timer: from timestamps only, so dropped frames never skew it.
      progress = Math.min(1, Math.max(0, (now - startTime) / duration));
      // Animation: clamp dt so a stall (tab hidden) doesn't jump the loop.
      dt = Math.min(Math.max(now - last, 0), cfg.MAX_DT);
      last = now;
      clock += dt * speed(progress);

      // red alert: fade in, then a pulse whose phase is integrated so a
      // change of speed never jumps
      if (!alertOn && duration - (now - startTime) <= alertWindow) { alertOn = true; alertStart = now; }
      if (alertOn) {
        fade = Math.min(1, (now - alertStart) / cfg.RED_FADE_MS);
        pulseHz = pulseHzFor(duration - (now - startTime));
        pulsePhase += dt / 1000 * pulseHz;
      }
      MR.states.invalidate();
      if (progress >= 1) { finish('gameover'); }
    },

    render: render,

    pointerDown: function (x, y) {
      if (ui.contains(stopBtn, x, y)) { active = stopBtn; stopBtn.pressed = true; }
    },
    pointerMove: function (x, y) {
      if (active) { active.pressed = ui.contains(active, x, y); }
    },
    pointerUp: function (x, y) {
      var b = active;
      active = null;
      if (b) {
        b.pressed = false;
        if (ui.contains(b, x, y)) { b.onPress(); }
      }
    },
    pointerCancel: function () {
      if (active) { active.pressed = false; active = null; }
    },

    // For tests / debugging.
    exit: function () { ui.setPalette(false); },

    debug: function () {
      return { progress: progress, clock: clock, index: index, alert: alertOn, pulseHz: pulseHz, fade: fade };
    }
  });
}());

// ------------------------------------------------------------------ GREAT JOB
// After STOP: the kid crouches, jumps with both arms up, lands and claps
// three times, under falling confetti. Tap -> OPTIONS (next scene: later).
(function () {
  var cfg = MR.config, C = MR.palette.UI, T = MR.palette.TEXT, font = MR.font;
  var params = {}, t0 = 0, L = null;

  var SCALE = 2, JUMP_H = 16;
  var STEPS = [
    { dur: 160, armL: 'down',       armR: 'down',       mouth: 'smile', crouch: true },
    { dur: 520, armL: 'waveUp',     armR: 'waveUp',     mouth: 'open',  jump: true },
    { dur: 140, armL: 'down',       armR: 'down',       mouth: 'open',  crouch: true },
    { dur: 150, armL: 'clapOpen',   armR: 'clapOpen',   mouth: 'open' },
    { dur: 150, armL: 'clapClosed', armR: 'clapClosed', mouth: 'open',  clap: true },
    { dur: 150, armL: 'clapOpen',   armR: 'clapOpen',   mouth: 'open' },
    { dur: 150, armL: 'clapClosed', armR: 'clapClosed', mouth: 'open',  clap: true },
    { dur: 150, armL: 'clapOpen',   armR: 'clapOpen',   mouth: 'open' },
    { dur: 150, armL: 'clapClosed', armR: 'clapClosed', mouth: 'open',  clap: true },
    { dur: 380, armL: 'down',       armR: 'down',       mouth: 'smile' }
  ];
  var LOOP_MS = 0, i;
  for (i = 0; i < STEPS.length; i++) {
    LOOP_MS += STEPS[i].dur;
    STEPS[i].pose = {
      outfit: 'ready', armL: STEPS[i].armL, armR: STEPS[i].armR,
      eyes: 'happy', mouth: STEPS[i].mouth,
      offsets: STEPS[i].crouch ? { torso: [0, 1] } : null
    };
  }

  var CONFETTI_COLORS = [T.yellow, C.stopFace, C.startLight, C.btnFace, C.stopLight, T.white];

  function stepAt(t) {
    var k = t % LOOP_MS, j;
    for (j = 0; j < STEPS.length; j++) {
      if (k < STEPS[j].dur) { return { step: STEPS[j], f: k / STEPS[j].dur }; }
      k -= STEPS[j].dur;
    }
    return { step: STEPS[0], f: 0 };
  }

  function drawConfetti(ctx, w, h, t) {
    var j, x, y, v, flip;
    for (j = 0; j < 20; j++) {
      v = 0.03 + (j % 5) * 0.008;
      y = ((t * v + j * 37) % (h + 20)) - 10;
      x = (j * 53 + 11) % w + Math.round(Math.sin(t * 0.004 + j) * 4);
      flip = Math.floor(t / 120 + j) % 2;              // flutter
      ctx.fillStyle = CONFETTI_COLORS[j % CONFETTI_COLORS.length];
      ctx.fillRect(Math.round(x), Math.round(y), flip ? 3 : 2, flip ? 2 : 3);
    }
  }

  function render(ctx, w, h) {
    var cx = Math.round(w / 2), t = MR.now() - t0, a = stepAt(t), st = a.step,
      lift = 0, b, handY, next = cfg.SCENES[params.index + 1], shadowW;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    if (!L) { return; }
    drawConfetti(ctx, w, h, t);

    font.drawCentered(ctx, 'GREAT JOB!', cx, L.titleY, 'yellow', 3);

    if (st.jump) { lift = Math.round(JUMP_H * 4 * a.f * (1 - a.f)); }
    // floor and a shadow that shrinks while he is in the air
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, L.groundY, w, 3);
    shadowW = 36 - lift;
    ctx.fillStyle = C.floorDark;
    ctx.fillRect(cx - Math.round(shadowW / 2), L.groundY, shadowW, 2);

    MR.character.draw(ctx, st.pose, cx, L.groundY - lift, SCALE);

    if (st.clap) {                                     // sparkles at the hands
      b = MR.character.bake(st.pose);
      handY = L.groundY - (b.ay - b.points['torso.neck'][1] - 4) * SCALE;
      font.drawCentered(ctx, '+', cx - 22, handY - 6, 'yellow', 1);
      font.drawCentered(ctx, '+', cx + 22, handY - 10, 'white', 1);
      font.drawCentered(ctx, '+', cx + 26, handY + 2, 'yellow', 1);
    }

    font.drawCentered(ctx, next ? 'NEXT: ' + next.label : 'ALL DONE!', cx, L.groundY + 16, 'white', 1);
    font.drawCentered(ctx, 'COMING SOON', cx, L.groundY + 30, 'dim', 1);
    font.drawCentered(ctx, 'TAP TO GO BACK', cx, h - 20, 'white', 1);
  }

  MR.states.add('sceneDone', {
    enter: function (p, now) {
      var j;
      params = p;
      t0 = now;
      for (j = 0; j < STEPS.length; j++) { MR.character.bake(STEPS[j].pose); }   // pre-bake
    },
    layout: function (w, h) {
      L = { titleY: 28 };
      L.groundY = Math.min(h - 80, Math.max(150, Math.round(h / 2) + 40));
    },
    update: function () { MR.states.invalidate(); },
    render: render,
    pointerUp: function () { MR.states.go('options'); }
  });
}());

// ------------------------------------------------------------------ GAME OVER
// Time ran out before STOP. The same kid (bigger) cries: sad brows, eyes shut
// tight, wailing, sobbing dips, and tears that well up in the corners of his
// eyes, roll down his cheeks and drip off his chin. CONTINUE (after CONTINUE_AT) goes to
// the next scene's title card so the routine is never blocked.
(function () {
  var cfg = MR.config, G = cfg.GAMEOVER, C = MR.palette.UI, ui = MR.ui, font = MR.font,
    title = MR.font.title, FX = MR.palette.FX;
  var params = {}, t0 = 0, L = null, bg = null, active = null, scale = 3;
  var BAR_H = 16, SOB_MS = 225, WELL_MS = 400, TEAR_LIFE = 2200;
  var continueBtn = ui.button({ label: 'CONTINUE', onPress: next });

  // tears (kid pixels, drawn at the kid's scale)
  var TEAR = {
    bead: MR.sprites.buildSprite(['q'], FX),
    small: MR.sprites.buildSprite(['.q.', 'qwq', '.q.'], FX),
    drop: MR.sprites.buildSprite(['.q.', 'qwq', 'qQq', '.j.'], FX)
  };

  // 4 sob steps per loop: wail/tremble x eyes shut/sob, body dips on 2 of them
  var STEPS = [
    { eyes: 'cryA', mouth: 'wailA', dip: false },
    { eyes: 'cryA', mouth: 'wailB', dip: true },
    { eyes: 'cryB', mouth: 'wailA', dip: false },
    { eyes: 'cryB', mouth: 'wailB', dip: true }
  ];
  var i;
  for (i = 0; i < STEPS.length; i++) {
    STEPS[i].pose = {
      outfit: 'ready', eyes: STEPS[i].eyes, mouth: STEPS[i].mouth,
      offsets: STEPS[i].dip ? { torso: [0, 1] } : null
    };
  }

  function next() {
    var n = params.index + 1;
    if (n < cfg.SCENES.length) { MR.states.go('transition', { index: n, durations: params.durations }); }
    else { MR.states.go('options'); }
  }

  function easeOutBounce(k) {
    var n1 = 7.5625, d1 = 2.75;
    if (k < 1 / d1) { return n1 * k * k; }
    if (k < 2 / d1) { k -= 1.5 / d1; return n1 * k * k + 0.75; }
    if (k < 2.5 / d1) { k -= 2.25 / d1; return n1 * k * k + 0.9375; }
    k -= 2.625 / d1;
    return n1 * k * k + 0.984375;
  }

  // Background: navy with a soft dithered spotlight behind the kid.
  function buildBg(w, h, cx, cy, r) {
    var c = MR.sprites.createCanvas(w, h), ctx = c.getContext('2d'), x, y, d;
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.bg;
    for (y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++) {
      for (x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++) {
        d = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r);
        if (d < 0.55 || (d < 0.8 && (x + y) % 2 === 0) || (d < 1 && x % 2 === 0 && y % 2 === 0)) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.fillStyle = C.panel;                            // brighter core
    for (y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++) {
      for (x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++) {
        d = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r);
        if (d < 0.25 || (d < 0.4 && (x + y) % 2 === 0)) { ctx.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }

  function layout(w, h, metrics) {
    var b = MR.character.bake(STEPS[0].pose), btnH = Math.max(metrics.minTouch + 8, 36),
      top, bottom, kh;
    L = { w: w, h: h };
    L.titleCap = BAR_H + 14;
    L.btnY = h - BAR_H - 8 - btnH;
    ui.setRect(continueBtn, 8, L.btnY, w - 16, btnH);
    continueBtn.labelScale = btnH >= 40 ? 3 : 2;
    top = L.titleCap + title.capH('L') + 30;
    bottom = L.btnY - 22;                                // "TIME'S UP..." line
    // largest scale up to KID_SCALE that fits between the title and the button
    for (scale = G.KID_SCALE; scale > 2 && b.canvas.height * scale > bottom - top; scale--) { /* shrink */ }
    kh = b.canvas.height * scale;
    L.groundY = Math.round(top + (bottom - top + kh) / 2);
    L.textY = L.groundY + 8;
    L.cx = Math.round(w / 2);
    bg = buildBg(w, h, L.cx, L.groundY - Math.round(kh * 0.62), Math.round(kh * 0.62));
  }

  // Screen position of a kid-pixel point in the drawn pose.
  function kidPoint(b, p) {
    return [L.cx - b.ax * scale + p[0] * scale, L.groundY - b.ay * scale + p[1] * scale];
  }

  // One tear's life: wells up gently at the eye corner, then rolls down the
  // cheek (slowly speeding up) and drips off below the chin.
  function drawTear(ctx, corner, chinY, age) {
    var img, y, tt, ts = Math.max(1, Math.round(scale / 2));   // tears at half the kid's scale
    if (age < WELL_MS) {
      img = age < 130 ? TEAR.bead : (age < 260 ? TEAR.small : TEAR.drop);
      ctx.drawImage(img, Math.round(corner[0] - img.width * ts / 2), Math.round(corner[1] - img.height * ts / 3),
        img.width * ts, img.height * ts);
      return;
    }
    tt = age - WELL_MS;
    y = corner[1] + 0.02 * tt + 0.5 * 0.00008 * tt * tt;
    if (y > chinY + 8 * scale) { return; }             // dripped onto the shirt
    img = TEAR.drop;
    ctx.drawImage(img, Math.round(corner[0] - img.width * ts / 2), Math.round(y), img.width * ts, img.height * ts);
  }

  function drawTears(ctx, t, corner, chinY, offset) {
    var P = G.TEAR_PERIOD, k = Math.floor((t - offset) / P), j, age;
    for (j = k; j >= k - 3; j--) {
      age = t - (j * P + offset);
      if (j >= 0 && age >= 0 && age < TEAR_LIFE) { drawTear(ctx, corner, chinY, age); }
    }
  }

  // wet trails running down the cheeks, with moving dashes
  function drawTrail(ctx, corner, t) {
    var len = 4 * scale, y, phase = Math.floor(t / 90);
    ctx.fillStyle = FX.q;
    for (y = 0; y < len; y += scale) {
      if ((y / scale + phase) % 3 !== 0) {
        ctx.fillRect(Math.round(corner[0] - scale / 2), Math.round(corner[1] + scale + y), scale, scale);
      }
    }
  }

  function render(ctx, w, h) {
    var t = MR.now() - t0, st = STEPS[Math.floor(t / SOB_MS) % STEPS.length], b, eyes, tl, tr, k, dy, chinY;
    if (!L) { return; }
    ctx.drawImage(bg, 0, 0);

    // GAME OVER: red title letters thud in one by one
    title.draw(ctx, 'GAME OVER', Math.round((w - title.measure('GAME OVER', 'L')) / 2), L.titleCap, 'L',
      function (j) {
        var start = 300 + j * 110, kk;
        if (t < start) { return { hidden: true }; }
        kk = Math.min(1, (t - start) / 450);
        return { dy: -(1 - easeOutBounce(kk)) * 50 };
      }, 'red');

    // the kid, crying
    MR.character.draw(ctx, st.pose, L.cx, L.groundY, scale);
    b = MR.character.bake(st.pose);
    eyes = b.points['head.eyes'];
    tl = kidPoint(b, [eyes[0] - 2, eyes[1] + 2]);      // outer eye corners
    tr = kidPoint(b, [eyes[0] + 7, eyes[1] + 2]);
    drawTrail(ctx, tl, t);
    drawTrail(ctx, tr, t + 45);
    chinY = kidPoint(b, b.points['head.mouth'])[1] + 3 * scale;
    drawTears(ctx, t, tl, chinY, 0);
    drawTears(ctx, t, tr, chinY, G.TEAR_PERIOD / 2);

    font.drawCentered(ctx, 'TIME\'S UP...', L.cx, L.textY, 'dim', 1);

    // CONTINUE slides up once it becomes available
    if (t >= G.CONTINUE_AT) {
      k = Math.min(1, (t - G.CONTINUE_AT) / 300);
      dy = Math.round((1 - k) * 20);
      continueBtn.y = L.btnY + dy;
      ui.drawButton(ctx, continueBtn);
      continueBtn.y = L.btnY;
    }

    // letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, BAR_H);
    ctx.fillRect(0, h - BAR_H, w, BAR_H);
  }

  function ready() { return MR.now() - t0 >= G.CONTINUE_AT; }

  MR.states.add('gameover', {
    enter: function (p, now) {
      var j;
      params = p;
      t0 = now;
      active = null;
      continueBtn.pressed = false;
      for (j = 0; j < STEPS.length; j++) { MR.character.bake(STEPS[j].pose); }   // pre-bake
    },
    layout: layout,
    update: function () { MR.states.invalidate(); },
    render: render,
    pointerDown: function (x, y) {
      if (ready() && ui.contains(continueBtn, x, y)) { active = continueBtn; continueBtn.pressed = true; }
    },
    pointerMove: function (x, y) {
      if (active) { active.pressed = ui.contains(active, x, y); }
    },
    pointerUp: function (x, y) {
      var b = active;
      active = null;
      if (b) {
        b.pressed = false;
        if (ui.contains(b, x, y)) { b.onPress(); }
      }
    },
    pointerCancel: function () {
      if (active) { active.pressed = false; active = null; }
    }
  });
}());
