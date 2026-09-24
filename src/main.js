// Boot, resize/scaling, input and the main loop. ES5 only.
var MR = window.MR = window.MR || {};

MR.now = (window.performance && window.performance.now) ?
  function () { return window.performance.now(); } :
  function () { return Date.now(); };

(function () {
  var cfg = MR.config;
  var canvas, ctx, buffer, bctx;
  var scale = 1, offX = 0, offY = 0, bufH = 224;
  var dirty = true, fullClear = true;
  var activeTouch = null, mouseDown = false;

  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
    function (fn) { return window.setTimeout(fn, 33); };

  function invalidate() { dirty = true; }

  // ----- scaling

  function fits(s, dpr, devH) {
    var metrics = { minTouch: Math.ceil(cfg.MIN_TOUCH_CSS * dpr / s) };
    return MR.states.minHeight(metrics) <= Math.floor(devH / s);
  }

  // Largest scale in [lo, hi) that fits; lo is known to fit.
  function largestFit(lo, hi, dpr, devH) {
    var i, mid;
    for (i = 0; i < 12; i++) {
      mid = (lo + hi) / 2;
      if (fits(mid, dpr, devH)) { lo = mid; } else { hi = mid; }
    }
    return Math.floor(lo * 100) / 100;
  }

  // Picks the largest integer scale whose layout still fits with touch
  // targets of at least MIN_TOUCH_CSS css px (fractional as a fallback).
  function resize() {
    var dpr = window.devicePixelRatio || 1,
      cssW = window.innerWidth, cssH = window.innerHeight,
      devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr),
      s, h, metrics, found = false;

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = devW;
    canvas.height = devH;

    for (s = Math.floor(devW / cfg.NATIVE_W); s >= 1; s--) {
      if (fits(s, dpr, devH)) { found = true; break; }
    }
    if (found && s < Math.floor(devW / cfg.NATIVE_W)) {
      // Dropping a whole integer step would shrink the UI a lot (e.g. 2x -> 1x).
      // Use the largest fractional scale that still fits instead.
      s = largestFit(s, Math.floor(devW / cfg.NATIVE_W), dpr, devH);
    }
    if (found) {
      h = Math.floor(devH / s);
      metrics = { minTouch: Math.ceil(cfg.MIN_TOUCH_CSS * dpr / s) };
    }
    if (!found) {
      // Tiny or landscape screen: fit the width and accept a non-integer
      // (or sub-1) scale rather than cropping the UI.
      s = Math.min(1, devW / cfg.NATIVE_W);
      metrics = { minTouch: Math.ceil(cfg.MIN_TOUCH_CSS * dpr / s) };
      h = MR.states.minHeight(metrics);
      if (h * s > devH) {
        s = devH / h;
        // Keep touch targets at s = 1 size so shrinking doesn't loop.
        metrics = { minTouch: Math.ceil(cfg.MIN_TOUCH_CSS * dpr) };
        h = Math.max(h, MR.states.minHeight(metrics));
        s = devH / h;
      }
      h = Math.floor(devH / s);
    }

    scale = s;
    bufH = h;
    buffer.width = cfg.NATIVE_W;
    buffer.height = bufH;
    offX = Math.floor((devW - cfg.NATIVE_W * scale) / 2);
    offY = Math.floor((devH - bufH * scale) / 2);

    // Resizing a canvas resets its context state.
    MR.sprites.setSmoothing(ctx, false);
    MR.sprites.setSmoothing(bctx, false);

    MR.states.layout(cfg.NATIVE_W, bufH, metrics);
    fullClear = true;
    dirty = true;
  }

  function onResize() {
    resize();
    // Old Android reports the new size late after rotating.
    window.setTimeout(resize, 300);
  }

  // ----- loop

  function frame() {
    var now = MR.now();
    MR.states.update(now);
    if (dirty) {
      dirty = false;
      MR.states.render(bctx, cfg.NATIVE_W, bufH);
      if (fullClear) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        fullClear = false;
      }
      ctx.drawImage(buffer, 0, 0, cfg.NATIVE_W, bufH,
        offX, offY, Math.round(cfg.NATIVE_W * scale), Math.round(bufH * scale));
    }
    raf(frame);
  }

  // ----- input

  function toNative(clientX, clientY) {
    var r = canvas.getBoundingClientRect(),
      px = (clientX - r.left) * (canvas.width / r.width),
      py = (clientY - r.top) * (canvas.height / r.height);
    return { x: (px - offX) / scale, y: (py - offY) / scale };
  }

  function findTouch(list, id) {
    var i;
    for (i = 0; i < list.length; i++) { if (list[i].identifier === id) { return list[i]; } }
    return null;
  }

  function onTouchStart(e) {
    var t, p;
    e.preventDefault();
    if (activeTouch !== null) { return; }   // one press at a time
    t = e.changedTouches[0];
    activeTouch = t.identifier;
    p = toNative(t.clientX, t.clientY);
    MR.states.pointerDown(p.x, p.y, MR.now());
  }

  function onTouchMove(e) {
    var t, p;
    e.preventDefault();
    if (activeTouch === null) { return; }
    t = findTouch(e.changedTouches, activeTouch);
    if (!t) { return; }
    p = toNative(t.clientX, t.clientY);
    MR.states.pointerMove(p.x, p.y, MR.now());
  }

  function onTouchEnd(e) {
    var t, p;
    e.preventDefault();
    if (activeTouch === null) { return; }
    t = findTouch(e.changedTouches, activeTouch);
    if (!t) { return; }
    activeTouch = null;
    p = toNative(t.clientX, t.clientY);
    MR.states.pointerUp(p.x, p.y, MR.now());
  }

  function onTouchCancel(e) {
    e.preventDefault();
    if (activeTouch === null) { return; }
    if (!findTouch(e.changedTouches, activeTouch)) { return; }
    activeTouch = null;
    MR.states.pointerCancel(MR.now());
  }

  // Mouse, for desktop testing.
  function onMouseDown(e) {
    var p = toNative(e.clientX, e.clientY);
    mouseDown = true;
    MR.states.pointerDown(p.x, p.y, MR.now());
  }
  function onMouseMove(e) {
    var p;
    if (!mouseDown) { return; }
    p = toNative(e.clientX, e.clientY);
    MR.states.pointerMove(p.x, p.y, MR.now());
  }
  function onMouseUp(e) {
    var p;
    if (!mouseDown) { return; }
    mouseDown = false;
    p = toNative(e.clientX, e.clientY);
    MR.states.pointerUp(p.x, p.y, MR.now());
  }

  function onVisibility() {
    if (!(document.hidden || document.webkitHidden)) { fullClear = true; dirty = true; }
  }

  // ----- boot

  function boot() {
    canvas = document.getElementById('screen');
    ctx = canvas.getContext('2d');
    buffer = MR.sprites.createCanvas(cfg.NATIVE_W, bufH);
    bctx = buffer.getContext('2d');

    MR.font.init();

    canvas.addEventListener('touchstart', onTouchStart, false);
    canvas.addEventListener('touchmove', onTouchMove, false);
    canvas.addEventListener('touchend', onTouchEnd, false);
    canvas.addEventListener('touchcancel', onTouchCancel, false);
    canvas.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mouseup', onMouseUp, false);
    window.addEventListener('resize', onResize, false);
    window.addEventListener('orientationchange', onResize, false);
    document.addEventListener('visibilitychange', onVisibility, false);
    document.addEventListener('webkitvisibilitychange', onVisibility, false);

    resize();
    MR.states.go('options');
    raf(frame);
  }

  MR.main = { invalidate: invalidate, boot: boot };

  window.addEventListener('load', boot, false);
}());
