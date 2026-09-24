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
        MR.states.go('scene', { index: 0, durations: durations.slice() });
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

// ------------------------------------------------------------------ SCENE
// Generic scene player: timestamp timer, shrinking time bar, STOP button and
// the animation clock. The scene art lives in src/scenes/<id>.js as
// MR.scenes[id] = { init(), render(ctx, clock) } drawing a 256x224 frame.
(function () {
  var cfg = MR.config, C = MR.palette.UI, ui = MR.ui, font = MR.font;

  var index = 0, durations = [], mod = null;
  var startTime = 0, duration = 1, last = 0, clock = 0, progress = 0, finished = false;
  var active = null, L = null;
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

  function renderPlaceholder(ctx) {
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, 0, cfg.NATIVE_W, cfg.SCENE_H);
    font.drawCentered(ctx, cfg.SCENES[index].label, cfg.NATIVE_W / 2, 90, 'yellow', 2);
    font.drawCentered(ctx, 'SCENE COMING SOON', cfg.NATIVE_W / 2, 120, 'dim', 1);
  }

  function render(ctx, w, h) {
    var remaining;
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(0, 0, w, h);
    if (!L) { return; }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.viewY, cfg.NATIVE_W, cfg.SCENE_H);
    ctx.clip();
    ctx.translate(0, L.viewY);
    if (mod) { mod.render(ctx, clock); } else { renderPlaceholder(ctx); }
    ctx.restore();

    remaining = Math.ceil(duration * (1 - progress) / 1000);
    font.drawCaps(ctx, (index + 1) + '/' + cfg.SCENES.length + ' ' + cfg.SCENES[index].label,
      4, L.readoutY + 1, 'dim', 1);
    font.drawCaps(ctx, ui.formatTime(remaining), w - 4 - (font.measure('00:00', 1) - 1),
      L.readoutY + 1, 'white', 1);
    ui.drawTimeBar(ctx, 4, L.barY, w - 8, cfg.SCENE_BAR_H, progress);
    ui.drawButton(ctx, stopBtn);
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
    debug: function () { return { progress: progress, clock: clock, index: index }; }
  });
}());

// ------------------------------------------------------------------ stubs
// Placeholders until TRANSITION / GAMEOVER / END exist. Tap -> OPTIONS.
(function () {
  var cfg = MR.config, C = MR.palette.UI, font = MR.font;

  function stub(title, titleColor, line1, line2, pose) {
    var params = {};
    return {
      enter: function (p) { params = p; },
      render: function (ctx, w, h) {
        var cx = Math.round(w / 2), next = cfg.SCENES[params.index + 1];
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, w, h);
        font.drawCentered(ctx, title, cx, 30, titleColor, 3);
        MR.character.draw(ctx, pose, cx, 150, 2);
        font.drawCentered(ctx, line1(next), cx, 172, 'white', 1);
        font.drawCentered(ctx, line2, cx, 186, 'dim', 1);
        font.drawCentered(ctx, 'TAP TO GO BACK', cx, h - 20, 'white', 1);
      },
      pointerUp: function () { MR.states.go('options'); }
    };
  }

  MR.states.add('sceneDone', stub('GREAT JOB!', 'yellow',
    function (next) { return next ? 'NEXT: ' + next.label : 'ALL DONE!'; },
    'COMING SOON',
    { outfit: 'ready', eyes: 'happy', mouth: 'open', armR: 'waveUp' }));

  MR.states.add('gameover', stub('TIME\'S UP!', 'white',
    function () { return 'GAME OVER SCREEN'; },
    'COMING SOON',
    { outfit: 'ready', eyes: 'closed', mouth: 'open' }));
}());
