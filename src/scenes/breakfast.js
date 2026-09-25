// SCENE 3: BREAKFAST ("LE PETIT-DEJEUNER"). The kid sits facing us across the
// kitchen table: the spoon dips into his bowl of cereal, lifts to his mouth,
// he chews with his cheeks puffing, and now and then sips his milk (and gets
// a milk mustache). The window shows the live Locmariaquer sky and the wall
// clock shows the real time. ES5 only.
//
// Same interface as every scene (see shower.js):
//   init()                     pre-renders everything (and red variants), once
//   render(ctx, clock, alert)  draws the 256x224 frame; alert.red = red alert
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224, CX = 128;
  var P = MR.palette.BREAKFAST;
  var S, PS, TABLE_Y, NECK_Y;                          // PS = props scale (spoon, glass)
  var PANE = { x: 184, y: 26, w: 52, h: 44 };        // window glass (live sky)
  var CLOCK = { x: 140, y: 42, r: 10 };               // wall clock center
  var GLASS_SPOT = { x: 90, y: 0 };                   // glass on the table (y in init)

  var bgBack = null, bgFront = null, props = {}, steps = [], worried = [], stepDur = [], sweat = null;

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // ------------------------------------------------------------ sprite data

  var GLASS = [
    'kkkkkkkk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGwwwwGk',
    'kGGGGGGk',
    '.kkkkkk.'];

  // spoon, in kid pixels: carrying cereal / empty (bowl on the left, handle
  // to the right, held by his right-hand side) and dipping (bowl down)
  var SPOON_FULL = [
    '.kkk......',
    'kyyYkkkkkk',
    'kgggxxxxxk',
    '.kkkkkkkkk'];
  var SPOON_EMPTY = [
    '.kkk......',
    'kggxkkkkkk',
    'kgggxxxxxk',
    '.kkkkkkkkk'];
  var SPOON_DIP = [
    '.kk.',
    'kgxk',
    'kgxk',
    'kgxk',
    'kgxk',
    'kggk',
    'kggk',
    '.kk.'];

  var SWEAT = [
    '..q..',
    '.qq..',
    '.qQq.',
    'qQQjq',
    'qQjjq',
    '.qqq.'];

  // ------------------------------------------------------------ background

  function paintWall(ctx) {
    var K = P.kitchen, x, y;
    rect(ctx, K.y, 0, 0, W, 196);
    for (y = 6; y < 110; y += 12) {                      // subtle wallpaper dots
      for (x = (y / 12 % 2) * 6 + 3; x < W; x += 12) { rect(ctx, K.Y, x, y, 1, 1); }
    }
    // tiled backsplash behind the table
    rect(ctx, K.g, 0, 110, W, 60);
    for (y = 110; y < 170; y += 10) {
      for (x = ((y - 110) / 10 % 2) * 5; x < W; x += 10) {
        rect(ctx, K.w, x, y, 9, 9);
        rect(ctx, K.v, x + 1, y + 8, 8, 1);
      }
    }
    rect(ctx, K.Y, 0, 108, W, 2);
    // floor tiles
    rect(ctx, K.F, 0, 196, W, H - 196);
    for (y = 196; y < H; y += 8) {
      for (x = ((y - 196) / 8 % 2) * 16; x < W; x += 32) { rect(ctx, K.f, x, y, 16, 8); }
    }
  }

  function paintCabinets(ctx) {
    var K = P.kitchen, i, x;
    for (i = 0; i < 3; i++) {
      x = 6 + i * 34;
      rect(ctx, K.k, x, 8, 32, 52);
      rect(ctx, K.o, x + 1, 9, 30, 50);
      rect(ctx, K.l, x + 4, 12, 24, 1);
      rect(ctx, K.l, x + 4, 12, 1, 44);
      rect(ctx, K.O, x + 27, 12, 1, 44);
      rect(ctx, K.O, x + 4, 55, 24, 1);
      rect(ctx, K.m, i === 1 ? x + 5 : x + 24, 32, 3, 5);        // knob
    }
    rect(ctx, K.O, 4, 60, 104, 3);                                 // cabinet bottom
  }

  function paintWindow(ctx) {
    var K = P.kitchen;
    rect(ctx, K.k, PANE.x - 4, PANE.y - 4, PANE.w + 8, PANE.h + 8);
    rect(ctx, K.w, PANE.x - 3, PANE.y - 3, PANE.w + 6, PANE.h + 6);
    ctx.clearRect(PANE.x, PANE.y, PANE.w, PANE.h);                 // live sky behind
    rect(ctx, K.w, PANE.x + PANE.w / 2 - 1, PANE.y, 2, PANE.h);     // cross bars
    rect(ctx, K.w, PANE.x, PANE.y + PANE.h / 2 - 1, PANE.w, 2);
    rect(ctx, K.k, PANE.x - 6, PANE.y + PANE.h + 4, PANE.w + 12, 5); // sill
    rect(ctx, K.w, PANE.x - 5, PANE.y + PANE.h + 4, PANE.w + 10, 3);
    // a little plant on the window sill
    rect(ctx, K.k, PANE.x + 3, PANE.y + PANE.h - 6, 12, 10);
    rect(ctx, K.O, PANE.x + 4, PANE.y + PANE.h - 5, 10, 9);
    rect(ctx, K.t, PANE.x + 2, PANE.y + PANE.h - 14, 4, 9);
    rect(ctx, K.t, PANE.x + 7, PANE.y + PANE.h - 18, 4, 13);
    rect(ctx, K.t, PANE.x + 12, PANE.y + PANE.h - 12, 4, 7);
  }

  function paintClockFace(ctx) {
    var K = P.kitchen, x, y, d, a, i;
    for (y = -CLOCK.r - 1; y <= CLOCK.r + 1; y++) {
      for (x = -CLOCK.r - 1; x <= CLOCK.r + 1; x++) {
        d = x * x + y * y;
        if (d <= (CLOCK.r + 1) * (CLOCK.r + 1)) { rect(ctx, d > CLOCK.r * CLOCK.r ? K.k : K.c, CLOCK.x + x, CLOCK.y + y, 1, 1); }
      }
    }
    for (i = 0; i < 12; i++) {                                     // hour ticks
      a = i / 12 * Math.PI * 2;
      rect(ctx, K.O, Math.round(CLOCK.x + Math.sin(a) * (CLOCK.r - 2)), Math.round(CLOCK.y - Math.cos(a) * (CLOCK.r - 2)), 1, 1);
    }
  }

  function paintChair(ctx) {
    var K = P.kitchen, half = 7 * S + 9, top = NECK_Y + S;
    // chair back behind the kid: two posts and a top rail, sized to him
    rect(ctx, K.k, CX - half - 3, top, 6, TABLE_Y - top);
    rect(ctx, K.k, CX + half - 3, top, 6, TABLE_Y - top);
    rect(ctx, K.o, CX - half - 2, top + 1, 4, TABLE_Y - top - 1);
    rect(ctx, K.o, CX + half - 2, top + 1, 4, TABLE_Y - top - 1);
    rect(ctx, K.k, CX - half - 5, top - 4, half * 2 + 10, 7);
    rect(ctx, K.o, CX - half - 4, top - 3, half * 2 + 8, 5);
    rect(ctx, K.l, CX - half - 4, top - 3, half * 2 + 8, 1);
  }

  // Table top + checked tablecloth, drawn OVER the kid (hides him below the
  // chest), with the bowl of cereal on it.
  function paintTable(ctx) {
    var T = P.table, x, y, cell, bw, bx, bh;
    // legs under the cloth
    rect(ctx, T.k, 26, 200, 8, 14);
    rect(ctx, T.o, 27, 200, 6, 13);
    rect(ctx, T.k, 222, 200, 8, 14);
    rect(ctx, T.o, 223, 200, 6, 13);
    // table top (seen slightly from above) and front drape: red/white checks
    rect(ctx, T.k, 10, TABLE_Y - 1, 236, 42);
    // big checks (13x10 px), so the pattern stays calm behind the kid
    for (y = TABLE_Y; y < TABLE_Y + 40; y += 10) {
      for (x = 11; x < 245; x += 13) {
        cell = ((x - 11) / 13 + (y - TABLE_Y) / 10) % 2;
        rect(ctx, cell ? T.r : T.w, x, y, Math.min(13, 245 - x), 10);
      }
    }
    rect(ctx, T.R, 11, TABLE_Y + 8, 234, 1);                       // table edge fold
    for (x = 11; x < 245; x += 6) { rect(ctx, T.k, x + 2, TABLE_Y + 40, 2, 1); }   // hem
    // bowl of cereal in front of him (to his right-hand side, screen right),
    // sized to the kid's scale
    bw = 15 * S; bx = CX - S; bh = 4 * S;
    rect(ctx, T.k, bx - 1, TABLE_Y - bh, bw + 2, bh + 3);
    rect(ctx, T.b, bx, TABLE_Y - bh + 3 * S / 2, bw, bh - 3 * S / 2 + 1);
    rect(ctx, T.B, bx, TABLE_Y, bw, 2);
    rect(ctx, T.w, bx + 2, TABLE_Y - bh + 3 * S / 2 + 2, bw - 4, 1);  // stripe
    rect(ctx, T.w, bx, TABLE_Y - bh + 1, bw, 3 * S / 2);              // milk
    for (x = bx + 1; x < bx + bw - 2; x += 5) {                      // cereal rings
      rect(ctx, T.y, x, TABLE_Y - bh, 3, 3);
      rect(ctx, T.Y, x + 1, TABLE_Y - bh + 1, 1, 1);
    }
  }

  // ------------------------------------------------------------ timeline

  var BASE = { outfit: 'dressed', legs: 'hidden', feet: null, head: 'base',
    armL: 'holdLow', armR: 'holdLow', eyes: 'open', mouth: 'smile' };

  // spoon: null | 'dip' | 'full' | 'empty' ; glass: 'table' | 'held'
  var BITE = [
    { armR: 'clapOpen', spoon: 'dip', dur: 280 },
    { armR: 'spoonMid', spoon: 'full', dur: 220 },
    { armR: 'toMouth', spoon: 'empty', mouth: 'open', dur: 260 },
    { head: 'puff', mouth: 'chewA', dur: 220 },
    { mouth: 'chewB', dur: 220 },
    { head: 'puff', mouth: 'chewA', dur: 220 },
    { mouth: 'chewB', dur: 220 }
  ];
  var TIMELINE = BITE.concat(BITE, [
    { armL: 'toMouth', glass: 'held', eyes: 'closed', dur: 450 },
    { mouth: 'milky', eyes: 'happy', dur: 350 },
    { mouth: 'milky', dur: 300 }
  ]);

  function poseFor(st, face) {
    var p = {}, k;
    for (k in BASE) { if (BASE.hasOwnProperty(k)) { p[k] = BASE[k]; } }
    for (k in st) { if (st.hasOwnProperty(k) && p.hasOwnProperty(k)) { p[k] = st[k]; } }
    if (face) { p.eyes = face; p.mouth = face; p.head = 'base'; }
    return p;
  }

  function place(st, face) {
    var b = MR.character.bake(poseFor(st, face)), n = b.points['torso.neck'],
      x = Math.round(CX - n[0] * S), y = Math.round(NECK_Y - n[1] * S);
    function hand(side) {
      var h = b.points[side + '.hand'];
      return h ? [x + h[0] * S, y + h[1] * S] : null;
    }
    return {
      img: MR.sprites.withRed(b.canvas), x: x, y: y, handL: hand('armL'), handR: hand('armR'),
      top: [x + b.points['head.top'][0] * S, y + b.points['head.top'][1] * S]
    };
  }

  // ------------------------------------------------------------ init/render

  function init() {
    var back, front, i, k, g, gctx;
    S = MR.config.BREAKFAST.KID_SCALE;
    PS = Math.max(1, S - 1);
    TABLE_Y = MR.config.BREAKFAST.TABLE_Y;
    NECK_Y = TABLE_Y - 9 * S;                  // torso rows 9+ are behind the table
    GLASS_SPOT.x = CX - 9 * S - GLASS[0].length * PS;      // on the table, to his left
    GLASS_SPOT.y = TABLE_Y - GLASS.length * PS + 2;

    back = MR.sprites.createCanvas(W, H);
    paintWall(back.getContext('2d'));
    paintCabinets(back.getContext('2d'));
    paintWindow(back.getContext('2d'));
    paintClockFace(back.getContext('2d'));
    paintChair(back.getContext('2d'));
    bgBack = MR.sprites.withRed(back);

    front = MR.sprites.createCanvas(W, H);
    paintTable(front.getContext('2d'));
    bgFront = MR.sprites.withRed(front);

    props.glass = MR.sprites.buildSprite(GLASS, P.table);
    // tilted glass for sipping, rotated once here (nearest-neighbor)
    g = MR.sprites.createCanvas(14, 14);
    gctx = g.getContext('2d');
    MR.sprites.setSmoothing(gctx, false);
    gctx.translate(7, 7);
    gctx.rotate(-0.7);
    gctx.drawImage(props.glass, -4, -5);
    props.glassTilt = g;
    props.full = MR.sprites.buildSprite(SPOON_FULL, P.table);
    props.empty = MR.sprites.buildSprite(SPOON_EMPTY, P.table);
    props.dip = MR.sprites.buildSprite(SPOON_DIP, P.table);
    sweat = MR.sprites.buildSprite(SWEAT, MR.palette.FX);

    for (i = 0; i < TIMELINE.length; i++) {
      steps.push(place(TIMELINE[i]));
      worried.push(place(TIMELINE[i], 'worried'));
      stepDur.push(TIMELINE[i].dur * MR.config.BREAKFAST.TEMPO);
    }

    // red-alert variants (getImageData: init only)
    MR.sprites.withRed(sweat);
    for (k in props) { if (props.hasOwnProperty(k)) { MR.sprites.withRed(props[k]); } }
  }

  var red = false;
  function im(c) { return red ? c.red : c; }

  function drawClockHands(ctx) {
    var d = new Date(), hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2,
      mA = d.getMinutes() / 60 * Math.PI * 2, i, color = red ? MR.palette.toRed(P.kitchen.k) : P.kitchen.k;
    ctx.fillStyle = color;
    for (i = 0; i <= 5; i++) { ctx.fillRect(Math.round(CLOCK.x + Math.sin(hA) * i), Math.round(CLOCK.y - Math.cos(hA) * i), 1, 1); }
    for (i = 0; i <= 8; i++) { ctx.fillRect(Math.round(CLOCK.x + Math.sin(mA) * i), Math.round(CLOCK.y - Math.cos(mA) * i), 1, 1); }
  }

  function drawScaled(ctx, img, x, y) {
    ctx.drawImage(im(img), Math.round(x), Math.round(y), img.width * PS, img.height * PS);
  }

  function render(ctx, clock, alert) {
    var idx = MR.sprites.frameAt(stepDur, clock), def = TIMELINE[idx], st, h;
    red = !!(alert && alert.red);
    st = red ? worried[idx] : steps[idx];

    MR.sky.draw(ctx, PANE, clock, red);               // live Locmariaquer sky
    ctx.drawImage(im(bgBack), 0, 0);
    drawClockHands(ctx);

    ctx.drawImage(im(st.img), st.x, st.y, st.img.width * S, st.img.height * S);

    // the spoon in his (screen-right) hand
    h = st.handR;
    if (def.spoon === 'full' || def.spoon === 'empty') {
      drawScaled(ctx, def.spoon === 'full' ? props.full : props.empty, h[0] - 8 * PS, h[1] - 2 * PS);
    }

    ctx.drawImage(im(bgFront), 0, 0);

    // dipping: the spoon handle sticks up out of the bowl (drawn over it)
    if (def.spoon === 'dip') { drawScaled(ctx, props.dip, h[0] - 2 * PS, h[1] - PS); }

    // the glass of milk: on the table, or at his mouth while he sips
    if (def.glass === 'held' && st.handL) {
      drawScaled(ctx, props.glassTilt, st.handL[0] - 6 * PS, st.handL[1] - 7 * PS);
    } else {
      drawScaled(ctx, props.glass, GLASS_SPOT.x, GLASS_SPOT.y);
    }

    // red alert: a sweat drop beside his head
    if (red) {
      ctx.drawImage(sweat.red, st.top[0] + 9 * S, st.top[1] + 4 * S + Math.round(Math.sin(clock * 0.008) * S),
        sweat.width * S, sweat.height * S);
    }
  }

  MR.scenes.breakfast = { init: init, render: render };
}());
