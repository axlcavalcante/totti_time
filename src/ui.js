// Canvas-drawn UI widgets and touch hit-testing (native coordinates). ES5 only.
var MR = window.MR = window.MR || {};

(function () {
  var C = MR.palette.UI, STYLES;

  function stylesFor(P) {
    return {
      normal: { face: P.btnFace,   pressed: P.btnPressed, light: P.bevelLight, dark: P.bevelDark },
      start:  { face: P.startFace, pressed: P.startPress, light: P.startLight, dark: P.startDark },
      stop:   { face: P.stopFace,  pressed: P.stopPress,  light: P.stopLight,  dark: P.stopDark }
    };
  }
  var STYLE_SETS = { normal: stylesFor(MR.palette.UI), red: stylesFor(MR.palette.UI_RED) };
  STYLES = STYLE_SETS.normal;

  // Red alert: swap every UI color for its red-mapped copy (and back).
  function setPalette(red) {
    C = red ? MR.palette.UI_RED : MR.palette.UI;
    STYLES = red ? STYLE_SETS.red : STYLE_SETS.normal;
  }

  // opts: { x, y, w, h, label, style, labelScale, onPress, fireOnDown, repeat }
  function button(opts) {
    return {
      x: opts.x || 0, y: opts.y || 0, w: opts.w || 0, h: opts.h || 0,
      label: opts.label || '',
      style: opts.style || 'normal',
      labelScale: opts.labelScale || 0,   // 0 = auto
      enabled: true,
      pressed: false,
      onPress: opts.onPress || null,
      fireOnDown: !!opts.fireOnDown,
      repeat: !!opts.repeat
    };
  }

  function setRect(b, x, y, w, h) {
    b.x = Math.round(x); b.y = Math.round(y); b.w = Math.round(w); b.h = Math.round(h);
  }

  function contains(b, x, y) {
    return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  }

  // Topmost enabled button under (x, y), or null.
  function hitTest(buttons, x, y) {
    var i;
    for (i = buttons.length - 1; i >= 0; i--) {
      if (buttons[i].enabled && contains(buttons[i], x, y)) { return buttons[i]; }
    }
    return null;
  }

  // Mega Drive menu look: dark outline, flat face, 1px bevel. No gradients.
  function drawButton(ctx, b) {
    var st = STYLES[b.style] || STYLES.normal, face, light, dark, s, tw, th, tx, ty, down;
    down = b.pressed && b.enabled;
    if (!b.enabled) {
      face = C.btnDisabled; light = C.panelLine; dark = C.bevelDark;
    } else if (down) {
      face = st.pressed; light = st.dark; dark = st.light;
    } else {
      face = st.face; light = st.light; dark = st.dark;
    }
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = face;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = light;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1);
    ctx.fillRect(b.x + 1, b.y + 1, 1, b.h - 2);
    ctx.fillStyle = dark;
    ctx.fillRect(b.x + 1, b.y + b.h - 2, b.w - 2, 1);
    ctx.fillRect(b.x + b.w - 2, b.y + 1, 1, b.h - 2);

    if (b.label) {
      s = b.labelScale || Math.max(1, Math.min(3, Math.floor((b.h - 8) / MR.font.CAP_H)));
      tw = MR.font.measure(b.label, s) - s;
      th = MR.font.CAP_H * s;
      tx = Math.round(b.x + (b.w - tw) / 2) + (down ? 1 : 0);
      ty = Math.round(b.y + (b.h - th) / 2) + (down ? 1 : 0);
      MR.font.drawCaps(ctx, b.label, tx, ty, b.enabled ? 'white' : 'grey', s);
    }
  }

  // Checkbox: a button drawn as a bevelled square with a pixel check mark.
  // The square sits in the button's rect (b.box, else centered in b).
  function drawCheckbox(ctx, b, checked) {
    var bx = b.box || b, x = bx.x, y = bx.y, n = Math.min(bx.w, bx.h), i, t, cx, cy;
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(x, y, n, n);
    ctx.fillStyle = checked ? C.startFace : C.barTrough;
    ctx.fillRect(x + 1, y + 1, n - 2, n - 2);
    ctx.fillStyle = checked ? C.startLight : C.panelLine;
    ctx.fillRect(x + 1, y + 1, n - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, n - 2);
    if (b.pressed) {
      ctx.fillStyle = C.bevelLight;
      ctx.fillRect(x + 2, y + n - 3, n - 4, 1);
    }
    if (!checked) { return; }
    // check mark: square pen strokes from the corner, short up-left, long up-right
    t = Math.max(2, Math.round(n / 8));
    cx = x + Math.round(n * 0.4);
    cy = y + Math.round(n * 0.7);
    ctx.fillStyle = '#fff';
    for (i = 0; i <= Math.round(n * 0.2); i++) { ctx.fillRect(cx - i - (t >> 1), cy - i - (t >> 1), t, t); }
    for (i = 0; i <= Math.round(n * 0.4); i++) { ctx.fillRect(cx + i - (t >> 1), cy - i - (t >> 1), t, t); }
  }

  // Dropdown box: "[ text  v ]". Disabled boxes are greyed by drawButton.
  function drawDropdown(ctx, b, text) {
    var s = b.labelScale || 2, ah = 3, ax, ay, i, label = b.label;
    b.label = '';
    drawButton(ctx, b);
    b.label = label;
    ax = b.x + b.w - 11;
    ay = Math.round(b.y + b.h / 2 - 1);
    MR.font.drawCaps(ctx, text, b.x + Math.round((b.w - 12 - (MR.font.measure(text, s) - s)) / 2),
      Math.round(b.y + (b.h - MR.font.CAP_H * s) / 2), b.enabled ? 'white' : 'grey', s);
    ctx.fillStyle = b.enabled ? C.bevelLight : C.panelLine;
    for (i = 0; i < ah; i++) { ctx.fillRect(ax + i, ay + i, (ah - i) * 2 - 1, 1); }
  }

  // Small speaker icon button (sound ON/OFF).
  function drawSpeaker(ctx, b, on) {
    var label = b.label, cx, cy;
    b.label = '';
    drawButton(ctx, b);
    b.label = label;
    cx = b.x + Math.round(b.w / 2) - 5 + (b.pressed ? 1 : 0);
    cy = b.y + Math.round(b.h / 2) + (b.pressed ? 1 : 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx, cy - 2, 3, 4);           // body
    ctx.fillRect(cx + 3, cy - 3, 1, 6);       // cone
    ctx.fillRect(cx + 4, cy - 4, 1, 8);
    if (on) {
      ctx.fillRect(cx + 6, cy - 1, 1, 2);     // waves
      ctx.fillRect(cx + 8, cy - 3, 1, 6);
    } else {
      ctx.fillStyle = C.stopLight;            // red cross
      ctx.fillRect(cx + 6, cy - 2, 1, 1); ctx.fillRect(cx + 9, cy - 2, 1, 1);
      ctx.fillRect(cx + 7, cy - 1, 2, 2);
      ctx.fillRect(cx + 6, cy + 1, 1, 1); ctx.fillRect(cx + 9, cy + 1, 1, 1);
    }
  }

  // Framed panel used for option rows and cards.
  function drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.panel;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = C.panelLine;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }

  function barColor(progress) {
    var list = MR.config.BAR_COLORS, key = list[0][1], i;
    for (i = 0; i < list.length; i++) { if (progress >= list[i][0]) { key = list[i][1]; } }
    return C[key];
  }

  // Time bar: shrinks from right to left as progress goes 0 -> 1.
  function drawTimeBar(ctx, x, y, w, h, progress) {
    var fw = Math.round((1 - progress) * (w - 2));
    ctx.fillStyle = C.bevelDark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.barTrough;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (fw > 0) {
      ctx.fillStyle = barColor(progress);
      ctx.fillRect(x + 1, y + 1, fw, h - 2);
      ctx.fillStyle = C.bevelDark;           // bottom shade for depth
      ctx.fillRect(x + 1, y + h - 3, fw, 1);
    }
    ctx.fillStyle = C.panelLine;             // trough rim
    ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function formatTime(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60);
  }

  MR.ui = {
    setPalette: setPalette,
    button: button,
    setRect: setRect,
    contains: contains,
    hitTest: hitTest,
    drawButton: drawButton,
    drawPanel: drawPanel,
    drawCheckbox: drawCheckbox,
    drawDropdown: drawDropdown,
    drawSpeaker: drawSpeaker,
    drawTimeBar: drawTimeBar,
    barColor: barColor,
    formatTime: formatTime
  };
}());
