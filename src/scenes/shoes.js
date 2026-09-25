// SCENE 5: SHOES ("LES CHAUSSURES"). The house entrance, same camera as the
// bedroom: the same kid (full body, dressed, in socks) crouches down, puts on
// his left shoe, then his right, stands up and stomps happily. A little cat
// (light brown on top, white underneath) sits by the console table watching
// him. The front door's window shows the live Locmariaquer sky. ES5 only.
//
// Same interface as every scene (see shower.js):
//   init()                     pre-renders everything (and red variants), once
//   render(ctx, clock, alert)  draws the 256x224 frame; alert.red = red alert
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224, CX = 124;
  var P = MR.palette.SHOES;
  var S, FLOOR_Y;
  var PANE = { x: 32, y: 48, w: 36, h: 28 };          // front door window (live sky)
  var CAT = { x: 204, y: 0 };                         // y set in init (sits on the floor)

  var bgBack = null, props = {}, cat = {}, steps = [], worried = [], stepDur = [], sweat = null;

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function pad(w, list) {
    var out = [], i, r;
    for (i = 0; i < list.length; i++) { r = list[i]; while (r.length < w) { r += '.'; } out.push(r); }
    return out;
  }

  // ------------------------------------------------------------ sprite data

  // one of his orange shoes, in kid pixels (same colors as his outfit)
  var SHOE = [
    '.kkk....',
    'knnnkkk.',
    'knnwnnnk',
    '.kkkkkkk'];

  // the cat, sitting, head turned toward us, 16x16 kid pixels: light brown
  // back, head, ears and tail (darker stripes), white muzzle, chest and paws,
  // pink nose and inner ears, eyes with a white glint
  var CAT_BODY = pad(16, [
    '.k.....k',
    'kpk...kpk',
    'kbbkkkbbk',
    'kbbbbbbbk',
    'kbBbbbBbk',
    'kbkwbwkbk',
    'kbwwwwwbkkkk',
    'kwwwpwwwkbbbk',
    '.kwkwkwkbbBbbk',
    '..kwwwkbbbbBbk',
    '..kwwwwbbbbbbbk',
    '..kwwwwwbbBbbbk',
    '..kwwwwwbbbbbbk',
    '..kwvwwwwbbbbbk',
    '..kwkwwkwwwbbbk',
    '...kkkkkkkkkkk']);
  var CAT_BLINK = CAT_BODY.slice(0);
  CAT_BLINK[5] = pad(16, ['kbkkbkkbk'])[0];            // eyes closed
  var CAT_EARS = CAT_BODY.slice(0);                     // right ear flicks down at the stomp
  CAT_EARS[0] = pad(16, ['.k'])[0];
  CAT_EARS[1] = pad(16, ['kpk...kkk'])[0];
  var CAT_TAIL = [
    pad(6, ['...kk', '..kbk', '..kbk', '.kbk', '.kBk', 'kbk', 'kbk', 'kbk', 'kk']),
    pad(6, ['', '....kk', '...kbk', '..kbBk', '.kbbk', 'kbbk', 'kbk', 'kbk', 'kk']),
    pad(6, ['', '', '', '', '.....k', '..kkbk', '.kbBbk', 'kbbkk', 'kk'])
  ];

  var SWEAT = [
    '..q..',
    '.qq..',
    '.qQq.',
    'qQQjq',
    'qQjjq',
    '.qqq.'];

  // ------------------------------------------------------------ background

  function paintRoom(ctx) {
    var E = P.entry, T = P.things, x, y, row = 0, dx, dy, d;
    // warm wall + baseboard
    rect(ctx, E.y, 0, 0, W, FLOOR_Y);
    for (x = 0; x < W; x += 24) { rect(ctx, E.Y, x, 0, 1, FLOOR_Y - 8); }
    rect(ctx, E.w, 0, FLOOR_Y - 8, W, 8);
    rect(ctx, E.Y, 0, FLOOR_Y - 1, W, 1);
    // wooden floor
    rect(ctx, E.f, 0, FLOOR_Y, W, H - FLOOR_Y);
    for (y = FLOOR_Y; y < H; y += 6) {
      rect(ctx, E.F, 0, y, W, 1);
      for (x = (row % 2) * 24; x < W; x += 48) { rect(ctx, E.F, x, y, 1, 6); }
      row++;
    }
    // front door (about 1.8x his height), with a small window for the sky
    rect(ctx, E.w, 12, 26, 76, FLOOR_Y - 26);                 // frame
    rect(ctx, E.k, 15, 29, 70, FLOOR_Y - 29);
    rect(ctx, E.t, 16, 30, 68, FLOOR_Y - 30);
    rect(ctx, E.T, 22, 86, 24, 44);                           // panels
    rect(ctx, E.T, 54, 86, 24, 44);
    rect(ctx, E.T, 22, 136, 24, FLOOR_Y - 144);
    rect(ctx, E.T, 54, 136, 24, FLOOR_Y - 144);
    rect(ctx, E.t, 23, 87, 22, 42);
    rect(ctx, E.t, 55, 87, 22, 42);
    rect(ctx, E.t, 23, 137, 22, FLOOR_Y - 146);
    rect(ctx, E.t, 55, 137, 22, FLOOR_Y - 146);
    rect(ctx, E.x, PANE.x - 3, PANE.y - 3, PANE.w + 6, PANE.h + 6);   // window frame
    ctx.clearRect(PANE.x, PANE.y, PANE.w, PANE.h);                   // live sky behind
    rect(ctx, E.x, PANE.x + PANE.w / 2 - 1, PANE.y, 2, PANE.h);
    rect(ctx, E.x, 74, 128, 6, 10);                           // handle
    rect(ctx, E.w, 75, 129, 3, 3);
    // doormat in front of the door
    rect(ctx, E.k, 16, FLOOR_Y + 1, 70, 9);
    rect(ctx, E.m, 17, FLOOR_Y + 2, 68, 7);
    for (x = 18; x < 84; x += 4) { rect(ctx, E.M, x, FLOOR_Y + 3 + (x / 4 % 2) * 2, 2, 3); }
    // rug under the kid
    for (y = FLOOR_Y + 3; y < FLOOR_Y + 20; y++) {
      for (x = 92; x < 170; x++) {
        dx = (x - 131) / 39; dy = (y - FLOOR_Y - 11) / 8; d = dx * dx + dy * dy;
        if (d < 0.7 || (d < 1 && (x + y) % 2 === 0)) { rect(ctx, (d > 0.45 && d < 0.6) ? E.R : E.r, x, y, 1, 1); }
      }
    }
    // framed picture (the sea at Locmariaquer) above him
    rect(ctx, T.O, 102, 40, 44, 32);
    rect(ctx, T.o, 104, 42, 40, 28);
    rect(ctx, T.p, 107, 45, 34, 22);
    rect(ctx, T.P, 107, 58, 34, 9);                            // sea
    rect(ctx, T.w, 112, 56, 12, 2);                            // a little boat
    rect(ctx, T.u, 117, 50, 1, 6);
    // wall hooks with a coat and a scarf, umbrella below
    rect(ctx, T.O, 170, 48, 70, 5);
    rect(ctx, T.k, 180, 53, 3, 5);
    rect(ctx, T.k, 206, 53, 3, 5);
    rect(ctx, T.k, 176, 56, 22, 60);                           // coat
    rect(ctx, T.c, 177, 57, 20, 58);
    rect(ctx, T.C, 191, 57, 6, 58);
    rect(ctx, T.C, 186, 60, 1, 50);
    rect(ctx, T.k, 203, 56, 10, 44);                           // scarf
    rect(ctx, T.s, 204, 57, 8, 42);
    for (y = 60; y < 98; y += 6) { rect(ctx, T.S, 204, y, 8, 2); }
    // console table with a bowl of keys and a small plant
    rect(ctx, T.k, 196, 144, 56, 5);
    rect(ctx, T.o, 197, 145, 54, 3);
    rect(ctx, T.O, 200, 149, 4, FLOOR_Y - 149);
    rect(ctx, T.O, 244, 149, 4, FLOOR_Y - 149);
    rect(ctx, T.k, 204, 138, 16, 6);                           // key bowl
    rect(ctx, T.w, 205, 139, 14, 4);
    rect(ctx, T.s, 208, 137, 3, 3);
    rect(ctx, T.s, 212, 136, 2, 4);
    rect(ctx, T.O, 232, 132, 10, 12);                          // plant pot
    rect(ctx, T.g, 230, 120, 4, 12);
    rect(ctx, T.G, 235, 116, 4, 16);
    rect(ctx, T.g, 240, 122, 4, 10);
    // umbrella leaning on the wall, under the hooks
    rect(ctx, T.k, 168, 150, 10, FLOOR_Y - 150);
    rect(ctx, T.u, 169, 151, 8, FLOOR_Y - 158);
    rect(ctx, T.U, 174, 151, 3, FLOOR_Y - 158);
    rect(ctx, T.k, 172, 142, 2, 9);                            // handle
  }

  // ------------------------------------------------------------ timeline

  var SOCKS = ['tshirt', 'pants', 'socks'];
  var ONE = SOCKS.concat(['shoeLeft']), BOTH = SOCKS.concat(['shoes']);
  var BASE = { outfit: 'dressed', legs: 'stand', feet: 'bare', armL: 'down', armR: 'down',
    eyes: 'open', mouth: 'smile' };

  // floor: which shoes still lie on the floor; prop: shoe in a hand
  var TIMELINE = [
    { c: SOCKS, floor: 'LR', dur: 500 },
    { c: SOCKS, legs: 'crouch', lift: 3, floor: 'LR', dur: 180 },
    { c: SOCKS, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', floor: 'LR', dur: 300 },
    { c: SOCKS, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', floor: 'R', prop: 'L', dur: 300 },
    { c: ONE, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', wiggle: 1, floor: 'R', dur: 250 },
    { c: ONE, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', wiggle: -1, floor: 'R', dur: 250 },
    { c: ONE, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', prop: 'R', dur: 300 },
    { c: BOTH, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', wiggle: 1, dur: 250 },
    { c: BOTH, legs: 'crouch', armL: 'reachDown', armR: 'reachDown', wiggle: -1, dur: 250 },
    { c: BOTH, eyes: 'happy', dur: 250 },
    { c: BOTH, eyes: 'happy', mouth: 'open', hop: 3, stomp: true, dur: 180 },
    { c: BOTH, eyes: 'happy', mouth: 'open', stomp: true, dur: 180 },
    { c: BOTH, eyes: 'happy', mouth: 'open', hop: 3, stomp: true, dur: 180 },
    { c: BOTH, eyes: 'happy', stomp: true, dur: 300 }
  ];

  function poseFor(st, face) {
    var p = {}, k;
    for (k in BASE) { if (BASE.hasOwnProperty(k)) { p[k] = BASE[k]; } }
    for (k in st) { if (st.hasOwnProperty(k) && p.hasOwnProperty(k)) { p[k] = st[k]; } }
    p.clothes = st.c;
    p.offsets = st.lift ? { torso: [0, -st.lift] } : (st.wiggle ? { armL: [st.wiggle, 0], armR: [-st.wiggle, 0] } : null);
    if (face) { p.eyes = face; p.mouth = face; }
    return p;
  }

  function place(st, face) {
    var b = MR.character.bake(poseFor(st, face)),
      x = Math.round(CX - b.ax * S), y = Math.round(FLOOR_Y - b.ay * S - (st.hop || 0) * S);
    function pt(name) {
      var h = b.points[name];
      return h ? [x + h[0] * S, y + h[1] * S] : null;
    }
    return { img: MR.sprites.withRed(b.canvas), x: x, y: y, handL: pt('armL.hand'), handR: pt('armR.hand'), top: pt('head.top') };
  }

  // ------------------------------------------------------------ init/render

  function init() {
    var kid = MR.palette.merge(MR.palette.CHARACTER_BODY, MR.palette.OUTFIT_COLORS['default']), back, i;
    S = MR.config.SHOES.KID_SCALE;
    FLOOR_Y = MR.config.SHOES.FLOOR_Y;
    CAT.y = FLOOR_Y - CAT_BODY.length * S;

    back = MR.sprites.createCanvas(W, H);
    paintRoom(back.getContext('2d'));
    bgBack = MR.sprites.withRed(back);

    props.shoe = MR.sprites.withRed(MR.sprites.buildSprite(SHOE, kid));
    cat.body = MR.sprites.withRed(MR.sprites.buildSprite(CAT_BODY, P.cat));
    cat.blink = MR.sprites.withRed(MR.sprites.buildSprite(CAT_BLINK, P.cat));
    cat.ears = MR.sprites.withRed(MR.sprites.buildSprite(CAT_EARS, P.cat));
    cat.tail = [];
    for (i = 0; i < CAT_TAIL.length; i++) { cat.tail.push(MR.sprites.withRed(MR.sprites.buildSprite(CAT_TAIL[i], P.cat))); }
    sweat = MR.sprites.withRed(MR.sprites.buildSprite(SWEAT, MR.palette.FX));

    for (i = 0; i < TIMELINE.length; i++) {
      steps.push(place(TIMELINE[i]));
      worried.push(place(TIMELINE[i], 'worried'));
      stepDur.push(TIMELINE[i].dur * MR.config.SHOES.TEMPO);
    }
  }

  var red = false;
  function im(c) { return red ? c.red : c; }

  function drawS(ctx, img, x, y) {
    ctx.drawImage(im(img), Math.round(x), Math.round(y), img.width * S, img.height * S);
  }

  function drawCat(ctx, clock, stomp) {
    var tail = cat.tail[Math.floor(clock / 260) % 3], body = cat.body, c = clock % 4200;
    if (c < 160) { body = cat.blink; }                       // blink now and then
    if (stomp) { body = cat.ears; }                          // ears twitch at the stomp
    drawS(ctx, tail, CAT.x + 14 * S, CAT.y + 7 * S);
    drawS(ctx, body, CAT.x, CAT.y);
  }

  function render(ctx, clock, alert) {
    var idx = MR.sprites.frameAt(stepDur, clock), def = TIMELINE[idx], st, h;
    red = !!(alert && alert.red);
    st = red ? worried[idx] : steps[idx];

    MR.sky.draw(ctx, PANE, clock, red);                      // live sky in the door window
    ctx.drawImage(im(bgBack), 0, 0);

    // shoes still waiting on the floor, beside his feet
    if (def.floor && def.floor.indexOf('L') >= 0) { drawS(ctx, props.shoe, CX - 30 - SHOE[0].length * S, FLOOR_Y - SHOE.length * S); }
    if (def.floor && def.floor.indexOf('R') >= 0) { drawS(ctx, props.shoe, CX + 30, FLOOR_Y - SHOE.length * S); }

    drawCat(ctx, clock, def.stomp);

    ctx.drawImage(im(st.img), st.x, st.y, st.img.width * S, st.img.height * S);

    // the shoe he is holding
    h = def.prop === 'L' ? st.handL : (def.prop === 'R' ? st.handR : null);
    if (h) { drawS(ctx, props.shoe, h[0] - SHOE[0].length * S / 2, h[1] - S); }

    // red alert: a sweat drop beside his head
    if (red && st.top) {
      ctx.drawImage(sweat.red, st.top[0] + 9 * S, st.top[1] + 4 * S + Math.round(Math.sin(clock * 0.008) * S),
        sweat.width * S, sweat.height * S);
    }
  }

  MR.scenes.shoes = { init: init, render: render };
}());
