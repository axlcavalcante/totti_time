// TEST MODE: jump straight to any screen and watch its animation, without
// playing through the timers. Opened by the small TEST button on OPTIONS.
// Deliberately plain: UI buttons and text only, no pixel art. ES5 only.
//
//   testMenu  one button per implemented screen (built from what exists)
//   testView  the animation only + a speed slider + BACK
//             (+ END OF TIMER on scenes: plays the real end-of-timer effect)
var MR = window.MR = window.MR || {};

(function () {
  var cfg = MR.config, C = MR.palette.UI, ui = MR.ui, font = MR.font, FX = MR.timerFx;
  var speedValue = 1;                         // kept while switching links
  var SPEED_MIN = 0.25, SPEED_MAX = 4, SPEED_STEP = 0.25;

  // Simple press/release handling shared by both states.
  function pressable(getButtons) {
    var active = null;
    return {
      down: function (x, y) {
        var b = ui.hitTest(getButtons(), x, y);
        if (b) { active = b; b.pressed = true; }
        return !!b;
      },
      move: function (x, y) { if (active) { active.pressed = ui.contains(active, x, y); } },
      up: function (x, y) {
        var b = active;
        active = null;
        if (b) { b.pressed = false; if (ui.contains(b, x, y)) { b.onPress(); } }
      },
      cancel: function () { if (active) { active.pressed = false; active = null; } }
    };
  }

  // ------------------------------------------------------------ menu

  function entries() {
    var list = [], i, sc;
    for (i = 0; i < cfg.SCENES.length; i++) {           // every implemented scene
      sc = cfg.SCENES[i];
      if (MR.scenes && MR.scenes[sc.id]) { list.push({ label: sc.label, kind: 'scene', index: i }); }
    }
    for (i = 0; i < cfg.SCENES.length; i++) {           // their title cards
      if (MR.scenes && MR.scenes[cfg.SCENES[i].id]) {
        list.push({ label: 'TITLE ' + (i + 1), kind: 'state', state: 'transition',
          params: { index: i }, loop: cfg.TRANSITION_MS });
      }
    }
    list.push({ label: 'GREAT JOB', kind: 'state', state: 'sceneDone', params: { index: 0 }, loop: cfg.GREAT_JOB_MS });
    list.push({ label: 'GAME OVER', kind: 'state', state: 'gameover', params: { index: 0 }, loop: 5000 });
    list.push({ label: 'ALL DONE (END)', kind: 'state', state: 'end', params: {}, loop: 8000 });
    return list;
  }

  (function () {
    var buttons = [], back, input;
    input = pressable(function () { return buttons; });

    function build() {
      var list = entries(), i;
      buttons = [];
      for (i = 0; i < list.length; i++) {
        (function (e) {
          buttons.push(ui.button({ label: e.label, labelScale: 1, onPress: function () {
            MR.states.go('testView', { entry: e });
          } }));
        }(list[i]));
      }
      back = ui.button({ label: 'BACK', labelScale: 2, onPress: function () { MR.states.go('options'); } });
      buttons.push(back);
    }

    MR.states.add('testMenu', {
      enter: function () { build(); input.cancel(); },
      layout: function (w, h, metrics) {
        var bh = Math.max(metrics.minTouch, 24), colW = Math.floor((w - 12) / 2), i, n = buttons.length - 1;
        for (i = 0; i < n; i++) {
          ui.setRect(buttons[i], 4 + (i % 2) * (colW + 4), 44 + Math.floor(i / 2) * (bh + 6), colW, bh);
        }
        ui.setRect(back, 4, h - bh - 8, w - 8, bh);
      },
      update: function () {},
      render: function (ctx, w, h) {
        var i;
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, w, h);
        font.drawCentered(ctx, 'TEST MODE', Math.round(w / 2), 10, 'yellow', 2);
        font.drawCentered(ctx, 'PICK A SCREEN', Math.round(w / 2), 30, 'dim', 1);
        for (i = 0; i < buttons.length; i++) { ui.drawButton(ctx, buttons[i]); }
      },
      pointerDown: function (x, y) { input.down(x, y); MR.states.invalidate(); },
      pointerMove: function (x, y) { input.move(x, y); MR.states.invalidate(); },
      pointerUp: function (x, y) { input.up(x, y); MR.states.invalidate(); },
      pointerCancel: function () { input.cancel(); }
    });
  }());

  // ------------------------------------------------------------ viewer

  (function () {
    var entry = null, mod = null, target = null, L = null, last = 0, input, dragging = false;
    var clock = 0, vt = 0, VBASE = 1e9, metrics = null;
    // END OF TIMER simulation: a 20 s timer starting at 50% (10 s left)
    var SIM_D = 20000, SIM_START = 0.5, sim = null;    // sim = { t, phase, alertWindow }
    var backBtn = ui.button({ label: 'BACK', labelScale: 2, onPress: function () { MR.states.go('testMenu'); } });
    var endBtn = ui.button({ label: 'END OF TIMER', labelScale: 1, onPress: function () {
      sim = { t: 0, phase: 0, alertWindow: FX.alertWindow(SIM_D) };
    } });
    input = pressable(function () { return mod ? [backBtn, endBtn] : [backBtn]; });

    function simState() {
      var elapsed, remaining;
      if (!sim) { return { progress: 0, alertOn: false, fade: 0, remaining: 0 }; }
      elapsed = SIM_START * SIM_D + sim.t;
      remaining = SIM_D - elapsed;
      return {
        progress: Math.min(1, elapsed / SIM_D),
        remaining: remaining,
        alertOn: remaining <= sim.alertWindow,
        fade: Math.max(0, Math.min(1, (sim.alertWindow - remaining) / cfg.RED_FADE_MS))
      };
    }

    // Runs a full-screen state's enter/render at virtual time VBASE + vt,
    // with MR.now swapped only for that call (never its update: no advancing).
    function withVirtualTime(fn) {
      var real = MR.now;
      MR.now = function () { return VBASE + vt; };
      try { fn(); } finally { MR.now = real; }
    }

    function enterTarget() {
      vt = 0;
      withVirtualTime(function () {
        var p = {}, k;
        for (k in entry.params) { if (entry.params.hasOwnProperty(k)) { p[k] = entry.params[k]; } }
        p.durations = MR.settings.load();
        target.enter(p, VBASE);
        if (L && target.layout) { target.layout(L.w, L.stripY, metrics); }
      });
    }

    function sliderValueAt(x) {
      var k = (x - L.trackX) / L.trackW;
      k = Math.max(0, Math.min(1, k));
      return Math.round((SPEED_MIN + k * (SPEED_MAX - SPEED_MIN)) / SPEED_STEP) * SPEED_STEP;
    }

    function inSlider(x, y) { return y >= L.row1Y && y < L.row1Y + L.rowH && x >= L.trackX - 6; }

    function layout(w, h, m) {
      var rowH = Math.max(m.minTouch, 20), stripH = 6 + 8 + rowH + 6 + rowH + 8, half;
      metrics = m;
      L = { w: w, h: h, rowH: rowH };
      L.stripY = h - stripH;
      L.barY = L.stripY + 6;
      L.row1Y = L.barY + 8;
      L.row2Y = L.row1Y + rowH + 6;
      L.trackX = 92;
      L.trackW = w - 8 - L.trackX;
      half = Math.floor((w - 12) / 2);
      if (mod) {
        ui.setRect(endBtn, 4, L.row2Y, half, rowH);
        ui.setRect(backBtn, 8 + half, L.row2Y, half, rowH);
      } else {
        ui.setRect(backBtn, 4, L.row2Y, w - 8, rowH);
      }
      L.sceneY = Math.max(0, Math.floor((L.stripY - cfg.SCENE_H) / 2));
      if (target && target.layout) {
        withVirtualTime(function () { target.layout(w, L.stripY, m); });
      }
    }

    function render(ctx, w, h) {
      var st = simState(), kx, label;
      ctx.fillStyle = C.bevelDark;
      ctx.fillRect(0, 0, w, h);
      if (!L) { return; }

      if (mod) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, L.sceneY, cfg.NATIVE_W, cfg.SCENE_H);
        ctx.clip();
        ctx.translate(0, L.sceneY);
        FX.drawScene(ctx, function (c, alert) { mod.render(c, clock, alert); }, st.alertOn, st.fade);
        ctx.restore();
        if (st.alertOn) { FX.drawPulse(ctx, 0, 0, w, L.stripY, sim.phase, st.fade); }
      } else if (target) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, L.stripY);
        ctx.clip();
        withVirtualTime(function () { target.render(ctx, w, L.stripY); });
        ctx.restore();
      }

      // controls strip
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, L.stripY, w, h - L.stripY);
      ctx.fillStyle = C.panelLine;
      ctx.fillRect(0, L.stripY, w, 1);
      if (mod && sim) { ui.drawTimeBar(ctx, 4, L.barY, w - 8, 5, st.progress); }   // END OF TIMER only
      label = 'SPEED X' + speedValue.toFixed(2);
      font.drawCaps(ctx, label, 4, L.row1Y + Math.round((L.rowH - font.CAP_H) / 2), 'white', 1);
      // slider track + knob
      ctx.fillStyle = C.bevelDark;
      ctx.fillRect(L.trackX, L.row1Y + Math.round(L.rowH / 2) - 2, L.trackW, 4);
      ctx.fillStyle = C.panelLine;
      ctx.fillRect(L.trackX, L.row1Y + Math.round(L.rowH / 2) - 2, L.trackW, 1);
      kx = L.trackX + Math.round((speedValue - SPEED_MIN) / (SPEED_MAX - SPEED_MIN) * L.trackW);
      ui.drawButton(ctx, { x: kx - 5, y: L.row1Y, w: 10, h: L.rowH, label: '', style: 'start',
        enabled: true, pressed: dragging });
      if (mod) { ui.drawButton(ctx, endBtn); }
      ui.drawButton(ctx, backBtn);
    }

    MR.states.add('testView', {
      enter: function (p, now) {
        entry = p.entry;
        mod = null;
        target = null;
        sim = null;
        clock = 0;
        last = now;
        dragging = false;
        input.cancel();
        if (entry.kind === 'scene') {
          mod = MR.scenes[cfg.SCENES[entry.index].id];
          if (!mod.ready) { mod.init(); mod.ready = true; }
        } else {
          target = MR.states.get(entry.state);
          enterTarget();
        }
      },
      exit: function () { ui.setPalette(false); },
      layout: layout,

      update: function (now) {
        var dt = Math.min(Math.max(now - last, 0), cfg.MAX_DT) * speedValue, st;
        last = now;
        if (mod) {
          if (sim) {
            sim.t += dt;
            st = simState();
            if (st.progress >= 1) { sim = null; }
            else {
              clock += dt * FX.speed(st.progress);
              if (st.alertOn) { sim.phase += dt / 1000 * FX.pulseHz(st.remaining, sim.alertWindow); }
            }
          } else {
            clock += dt;
          }
        } else if (target) {
          vt += dt;
          if (vt >= entry.loop) { enterTarget(); }     // loop, never advance
        }
        MR.states.invalidate();
      },

      render: render,

      pointerDown: function (x, y) {
        if (L && inSlider(x, y)) { dragging = true; speedValue = sliderValueAt(x); return; }
        input.down(x, y);
      },
      pointerMove: function (x, y) {
        if (dragging) { speedValue = sliderValueAt(x); return; }
        input.move(x, y);
      },
      pointerUp: function (x, y) {
        if (dragging) { dragging = false; return; }
        input.up(x, y);
      },
      pointerCancel: function () { dragging = false; input.cancel(); },

      // For tests / debugging.
      debug: function () {
        var st = simState();
        return { clock: clock, vt: vt, speed: speedValue, sim: !!sim, progress: st.progress, alert: st.alertOn,
          fade: st.fade, target: entry && (entry.state || 'scene ' + entry.index) };
      },
      setSpeed: function (v) { speedValue = v; }
    });
  }());
}());
