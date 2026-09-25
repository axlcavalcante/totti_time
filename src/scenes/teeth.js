// SCENE 4: BRUSHING TEETH ("BROSSE A DENTS"), seen from the mirror's point of
// view: he stands behind the sink facing us, with the bathroom behind him
// (tub, towel, door). He brushes side to side while foam builds up at his
// mouth, then leans over and spits into the sink, and comes back up with
// clean teeth. ES5 only.
//
// Same interface as every scene (see shower.js):
//   init()                     pre-renders everything (and red variants), once
//   render(ctx, clock, alert)  draws the 256x224 frame; alert.red = red alert
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224, CX = 128;
  var P = MR.palette.TEETH;
  var S, PS, COUNTER_Y, NECK_Y;
  var BASIN = { x: 128, y: 0 };                      // where the spit lands (y set in init)

  var bgBack = null, bgFront = null, props = {}, foam = [], steps = [], worried = [], stepDur = [], sweat = null;

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // ------------------------------------------------------------ sprite data

  // his toothbrush, in kid pixels: bristles on the left (in his mouth),
  // handle to the right where his hand holds it
  var BRUSH = [
    '.wwww......',
    'kaaaaaaaaak',
    '.kkkkkkkkk.'];

  // foam at his mouth, growing (no outline: soft)
  var FOAM = [
    ['.ww.',
     'wWww',
     '.ww.'],
    ['..ww..',
     '.wwWww',
     'wwwwWw',
     '.wWww.'],
    ['..www...',
     '.wwwWww.',
     'wwWwwwww',
     'wwwwwWww',
     '.wwWww..']
  ];

  var DROP = [
    '.w.',
    'wWw',
    '.W.'];

  var SWEAT = [
    '..q..',
    '.qq..',
    '.qQq.',
    'qQQjq',
    'qQjjq',
    '.qqq.'];

  // ------------------------------------------------------------ background

  function paintWall(ctx) {
    var B = P.bathroom, x, y;
    rect(ctx, B.g, 0, 0, W, H);
    for (y = 0; y < H; y += 16) {
      for (x = 0; x < W; x += 16) {
        rect(ctx, B.w, x, y, 15, 15);
        rect(ctx, B.v, x + 1, y + 14, 14, 1);
        rect(ctx, B.v, x + 14, y + 1, 1, 13);
      }
    }
    for (x = 0; x < W; x += 8) {                          // blue strip, like the shower
      rect(ctx, B.t, x, 12, 7, 7);
      rect(ctx, B.T, x, 18, 7, 1);
    }
  }

  // The bathroom behind him, as the mirror sees it: a wooden door with the
  // red striped towel on its hook (left) and a wicker laundry basket (right),
  // both placed low and sized to sit a few steps behind a small child.
  // Their bottoms are hidden behind the counter.
  function paintRoom(ctx) {
    var B = P.bathroom, x, y, top = 84;
    // door (top a little above his hair)
    rect(ctx, B.k, 8, top, 50, COUNTER_Y - top);
    rect(ctx, B.o, 9, top + 1, 48, COUNTER_Y - top - 1);
    rect(ctx, B.O, 13, top + 5, 17, 46);                        // panels
    rect(ctx, B.O, 34, top + 5, 19, 46);
    rect(ctx, B.O, 13, top + 57, 17, COUNTER_Y - top - 57);
    rect(ctx, B.O, 34, top + 57, 19, COUNTER_Y - top - 57);
    rect(ctx, B.o, 14, top + 6, 15, 44);
    rect(ctx, B.o, 35, top + 6, 17, 44);
    rect(ctx, B.o, 14, top + 58, 15, COUNTER_Y - top - 58);
    rect(ctx, B.o, 35, top + 58, 17, COUNTER_Y - top - 58);
    rect(ctx, B.x, 49, top + 62, 6, 4);                         // handle
    rect(ctx, B.c, 50, top + 63, 4, 2);
    // red striped towel hanging on a hook on the door
    rect(ctx, B.x, 30, top + 14, 4, 5);
    rect(ctx, B.k, 19, top + 18, 26, 46);
    rect(ctx, B.r, 20, top + 19, 24, 44);
    rect(ctx, B.R, 39, top + 19, 5, 44);
    rect(ctx, B.R, 20, top + 19, 24, 3);
    rect(ctx, B.w, 20, top + 46, 24, 3);
    rect(ctx, B.w, 20, top + 52, 24, 1);
    for (x = 20; x < 44; x += 3) { rect(ctx, B.k, x, top + 63, 1, 3); }   // fringe
    // wicker laundry basket on the floor, its top at about his shoulders:
    // vertical wicker strands, two woven bands, a thick rim and side handles
    rect(ctx, B.k, 184, 150, 52, COUNTER_Y - 150);
    rect(ctx, B.o, 185, 151, 50, COUNTER_Y - 151);
    for (x = 187; x < 235; x += 4) { rect(ctx, B.O, x, 156, 1, COUNTER_Y - 156); }   // strands
    for (y = 166; y < COUNTER_Y; y += 20) {                                        // woven bands
      rect(ctx, B.k, 185, y, 50, 1);
      rect(ctx, B.O, 185, y + 1, 50, 3);
      for (x = 186; x < 235; x += 4) { rect(ctx, B.o, x, y + 2, 2, 1); }
      rect(ctx, B.k, 185, y + 4, 50, 1);
    }
    rect(ctx, B.k, 182, 148, 56, 7);                              // thick rim
    rect(ctx, B.O, 183, 149, 54, 5);
    rect(ctx, B.o, 183, 149, 54, 1);
    rect(ctx, B.k, 180, 158, 4, 8);                               // side handles
    rect(ctx, B.k, 236, 158, 4, 8);
    rect(ctx, B.k, 191, 138, 32, 11);                             // a towel peeking out
    rect(ctx, B.w, 192, 139, 30, 9);
    rect(ctx, B.v, 192, 146, 30, 2);
    rect(ctx, B.t, 208, 139, 3, 9);
  }

  // Foreground: only the counter's top slab (no cabinet under it), the basin
  // rim, and a big faucet in the middle, seen from behind as if we look
  // over it. The cup and the toothpaste stand on the counter.
  function paintCounter(ctx) {
    var B = P.bathroom, T = P.props, fx = CX, top = COUNTER_Y - 6;
    // counter top slab down to the bottom of the screen
    rect(ctx, B.k, 0, COUNTER_Y - 1, W, H - COUNTER_Y + 1);
    rect(ctx, B.w, 0, COUNTER_Y, W, H - COUNTER_Y);
    rect(ctx, B.e, 0, H - 6, W, 6);
    // basin rim just behind the faucet
    rect(ctx, B.k, fx - 40, COUNTER_Y + 2, 80, 12);
    rect(ctx, B.e, fx - 39, COUNTER_Y + 3, 78, 10);
    rect(ctx, B.E, fx - 34, COUNTER_Y + 4, 68, 6);
    // taps on both sides of the faucet
    rect(ctx, B.x, fx - 26, COUNTER_Y + 10, 12, 8);
    rect(ctx, B.c, fx - 25, COUNTER_Y + 11, 10, 3);
    rect(ctx, B.C, fx - 25, COUNTER_Y + 14, 10, 3);
    rect(ctx, B.x, fx + 14, COUNTER_Y + 10, 12, 8);
    rect(ctx, B.c, fx + 15, COUNTER_Y + 11, 10, 3);
    rect(ctx, B.C, fx + 15, COUNTER_Y + 14, 10, 3);
    // big faucet, seen from behind: rounded back of the neck, spout hidden
    // behind it pointing toward him; cut off by the bottom of the screen
    rect(ctx, B.x, fx - 11, top, 22, H - top);
    rect(ctx, B.x, fx - 9, top - 3, 18, 3);
    rect(ctx, B.c, fx - 8, top - 2, 7, 2);
    rect(ctx, B.C, fx - 1, top - 2, 9, 2);
    rect(ctx, B.c, fx - 10, top, 8, H - top);
    rect(ctx, B.w, fx - 7, top + 2, 2, H - top - 2);              // shine
    rect(ctx, B.C, fx - 2, top, 12, H - top);
    rect(ctx, B.x, fx + 6, top, 3, H - top);
    rect(ctx, B.x, fx - 12, COUNTER_Y + 16, 24, 3);               // base ring
    rect(ctx, B.c, fx - 11, COUNTER_Y + 16, 10, 1);
    // cup with two toothbrushes (left)
    rect(ctx, T.k, 40, COUNTER_Y - 18, 3, 20);
    rect(ctx, T.o, 40, COUNTER_Y - 16, 2, 18);
    rect(ctx, T.w, 40, COUNTER_Y - 19, 2, 3);
    rect(ctx, T.k, 48, COUNTER_Y - 20, 3, 20);
    rect(ctx, T.a, 48, COUNTER_Y - 18, 2, 18);
    rect(ctx, T.w, 48, COUNTER_Y - 21, 2, 3);
    rect(ctx, T.k, 36, COUNTER_Y - 4, 20, 18);
    rect(ctx, T.y, 37, COUNTER_Y - 3, 18, 16);
    rect(ctx, T.Y, 50, COUNTER_Y - 3, 5, 16);
    // toothpaste tube lying on the counter (right)
    rect(ctx, T.k, 188, COUNTER_Y + 6, 30, 8);
    rect(ctx, T.w, 189, COUNTER_Y + 7, 22, 7);
    rect(ctx, T.p, 189, COUNTER_Y + 7, 22, 2);
    rect(ctx, T.s, 195, COUNTER_Y + 10, 10, 2);
    rect(ctx, T.P, 211, COUNTER_Y + 8, 6, 5);                     // cap
  }

  // ------------------------------------------------------------ timeline

  var BASE = { outfit: 'dressed', legs: 'hidden', feet: null, armL: 'holdLow', armR: 'holdLow',
    eyes: 'open', mouth: 'smile' };

  // brushing frames: wiggle left/right (off), foam size (-1 = none)
  function brushStep(off, foamIdx, eyes) {
    return { armR: 'toMouth', mouth: 'brush', off: off, foam: foamIdx, eyes: eyes || 'open', brush: true, dur: 200 };
  }
  var TIMELINE = [
    brushStep(-1, -1), brushStep(1, -1), brushStep(-1, 0), brushStep(1, 0),
    brushStep(-1, 0), brushStep(1, 1, 'closed'), brushStep(-1, 1), brushStep(1, 1),
    brushStep(-1, 2), brushStep(1, 2), brushStep(-1, 2), brushStep(1, 2),
    { mouth: 'spit', lean: true, foam: 2, dur: 300 },
    { mouth: 'spit', lean: true, spit: true, dur: 450 },
    { eyes: 'happy', mouth: 'smile', dur: 400 },
    { dur: 300 }
  ];

  function poseFor(st, face) {
    var p = {}, k;
    for (k in BASE) { if (BASE.hasOwnProperty(k)) { p[k] = BASE[k]; } }
    for (k in st) { if (st.hasOwnProperty(k) && p.hasOwnProperty(k)) { p[k] = st[k]; } }
    p.offsets = st.lean ? { torso: [0, 3] } : (st.off ? { armR: [st.off, 0] } : null);
    if (face) { p.eyes = face; p.mouth = face; }
    return p;
  }

  function place(st, face) {
    var b = MR.character.bake(poseFor(st, face)), n = b.points['torso.neck'],
      x = Math.round(CX - n[0] * S), y = Math.round(NECK_Y - n[1] * S), m = b.points['head.mouth'],
      h = b.points['armR.hand'];
    return {
      img: MR.sprites.withRed(b.canvas), x: x, y: y,
      mouth: [x + (m[0] + 2) * S, y + (m[1] + 1) * S],
      hand: h ? [x + h[0] * S, y + h[1] * S] : null,
      top: [x + b.points['head.top'][0] * S, y + b.points['head.top'][1] * S]
    };
  }

  function stepAt(clock) {
    var total = 0, i, t;
    for (i = 0; i < stepDur.length; i++) { total += stepDur[i]; }
    t = clock % total;
    for (i = 0; i < stepDur.length; i++) {
      if (t < stepDur[i]) { return { i: i, f: t / stepDur[i] }; }
      t -= stepDur[i];
    }
    return { i: 0, f: 0 };
  }

  // ------------------------------------------------------------ init/render

  function init() {
    var back, front, i, k;
    S = MR.config.TEETH.KID_SCALE;
    PS = Math.max(1, S - 1);
    COUNTER_Y = MR.config.TEETH.COUNTER_Y;
    NECK_Y = COUNTER_Y - 9 * S;                  // torso rows 9+ are behind the counter
    BASIN.y = COUNTER_Y + 8;

    back = MR.sprites.createCanvas(W, H);
    paintWall(back.getContext('2d'));
    paintRoom(back.getContext('2d'));
    bgBack = MR.sprites.withRed(back);

    front = MR.sprites.createCanvas(W, H);
    paintCounter(front.getContext('2d'));
    bgFront = MR.sprites.withRed(front);

    props.brush = MR.sprites.withRed(MR.sprites.buildSprite(BRUSH, P.props));
    props.drop = MR.sprites.withRed(MR.sprites.buildSprite(DROP, P.props));
    for (i = 0; i < FOAM.length; i++) { foam.push(MR.sprites.withRed(MR.sprites.buildSprite(FOAM[i], P.props))); }
    sweat = MR.sprites.withRed(MR.sprites.buildSprite(SWEAT, MR.palette.FX));

    for (i = 0; i < TIMELINE.length; i++) {
      steps.push(place(TIMELINE[i]));
      worried.push(place(TIMELINE[i], 'worried'));
      stepDur.push(TIMELINE[i].dur * MR.config.TEETH.TEMPO);
    }
    for (k = 0; k < steps.length; k++) {
      if (TIMELINE[k].lean) { lean(steps[k]); lean(worried[k]); }
    }
  }

  // place() anchors each pose by its neck; for the lean we want the whole
  // upper body to move down 3 kid px, so shift it back by the offset.
  function lean(st) {
    st.y += 3 * S;
    st.mouth[1] += 3 * S;
    st.top[1] += 3 * S;
    if (st.hand) { st.hand[1] += 3 * S; }
  }

  var red = false;
  function im(c) { return red ? c.red : c; }

  function drawAt(ctx, img, cx, cy, scale) {
    ctx.drawImage(im(img), Math.round(cx - img.width * scale / 2), Math.round(cy - img.height * scale / 2),
      img.width * scale, img.height * scale);
  }

  function render(ctx, clock, alert) {
    var a = stepAt(clock), def = TIMELINE[a.i], st, tt, x, y;
    red = !!(alert && alert.red);
    st = red ? worried[a.i] : steps[a.i];

    ctx.drawImage(im(bgBack), 0, 0);

    // the kid, facing the mirror (= us)
    ctx.drawImage(im(st.img), st.x, st.y, st.img.width * S, st.img.height * S);
    if (def.brush && st.hand) {
      ctx.drawImage(im(props.brush), Math.round(st.hand[0] - 9 * PS), Math.round(st.hand[1] - PS),
        props.brush.width * PS, props.brush.height * PS);
    }
    // foam bubbles over the brush at his mouth
    if (def.foam >= 0) { drawAt(ctx, foam[def.foam], st.mouth[0], st.mouth[1] + PS, PS); }
    if (red) {
      ctx.drawImage(sweat.red, st.top[0] + 9 * S, st.top[1] + 4 * S + Math.round(Math.sin(clock * 0.008) * S),
        sweat.width * S, sweat.height * S);
    }

    // spit: a foam drop falls from his mouth into the basin (drawn before the
    // foreground, so it disappears behind the counter and the faucet)
    if (def.spit) {
      tt = a.f * stepDur[a.i];
      x = st.mouth[0] + (BASIN.x - st.mouth[0]) * a.f;
      y = st.mouth[1] + 0.02 * tt + 0.5 * 0.0002 * tt * tt;
      if (y < BASIN.y) { drawAt(ctx, props.drop, x, y, PS); }
    }

    ctx.drawImage(im(bgFront), 0, 0);
  }

  MR.scenes.teeth = { init: init, render: render };
}());
