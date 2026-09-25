// SCENE 2: GETTING DRESSED ("ON S'HABILLE"). In his bedroom the kid, wrapped
// in his bath towel, pulls his underwear on under it, drops the towel on the
// bed, hops into his pants, sits on the bed, pulls his t-shirt over his head
// and puts on both socks. NO SHOES in this scene. Then the loop restarts.
// ES5 only.
//
// Same interface as every scene (see shower.js):
//   init()                     pre-renders everything (and red variants), once
//   render(ctx, clock, alert)  draws the 256x224 frame; alert.red = red alert
//
// Modesty: his chest is bare until the t-shirt, but the base underwear shorts
// are always on below the waist, and the towel (an opaque overlay from the
// waist to the knees) covers him while the underwear goes on.
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224;
  var P = MR.palette.DRESSING;
  var S, FLOOR_Y, SEAT_Y;
  var X = { stand: 184, mid: 152, sit: 118 };     // where the kid stands / sits
  var TOWEL_BED = { x: 94, y: 0 };                // where the dropped towel lands (y set in init)
  var PANE = { x: 75, y: 33, w: 54, h: 54 };       // window glass, shows the live sky

  var bgBack = null, props = {}, steps = [], worried = [], stepDur = [], sweat = null;

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // ------------------------------------------------------------ sprite data

  var CAR = [
    '....kkkkkkk.......',
    '...krrGGGrrk......',
    '..krrrGGGrrrkkk...',
    '.krrrrrrrrrrrrrk..',
    'krrrrrrrrrrrrrrrk.',
    'kRRRRRRRRRRRRRRRk.',
    '.kkxxkkkkkkkxxkk..',
    '..kxgxk....kxgxk..',
    '...kxk......kxk...'];

  var BALL = [
    '...kkk...',
    '.kkyyykk.',
    '.kyyyyyk.',
    'krrrrrrrk',
    'kyyyyyyYk',
    'kyyyyyYYk',
    '.kyyyYYk.',
    '.kkYYYkk.',
    '...kkk...'];

  var TEDDY = [
    '.kk......kk.',
    'ktTk....kTtk',
    'ktttkkkkkttk',
    '.kttttttttk.',
    '.ktkttttktk.',
    '.kttttttttk.',
    '.kttTkkTttk.',
    '..kttttttk..',
    '.kkttttttkk.',
    'kttkttttkttk',
    'ktttttttttTk',
    'ktttttttttTk',
    '.kttTkkTttk.',
    '..kkk..kkk..'];

  // Small panda teddy that sits on the bed next to the pillow.
  var PANDA = [
    '..kk......kk..',
    '.kkkk....kkkk.',
    '.kkwwwwwwwwkk.',
    '..kwwwwwwwwk..',
    '.kwkkwwwwkkwk.',
    '.kwkwkwwkwkwk.',
    '.kwwwwkkwwwwk.',
    '.kwwwwwwwwwwk.',
    '..kkwwwwwwkk..',
    '.kkkwwwwwwkkk.',
    'kkkkwwwwwwkkkk',
    'kkkwwwwwwwwkkk',
    '.kkwwwwwwwwkk.',
    '..kkk....kkk..'];

  var ROBOT = [
    '....kk....',
    '....kr....',
    '..kkkkkk..',
    '..kGGGGk..',
    '..kgrrgk..',
    '..kGGGGk..',
    '..kkkkkk..',
    '.kkggggkk.',
    'kxkGGGGkxk',
    'kxkgyygkxk',
    '.kkggggkk.',
    '..kggggk..',
    '..kgkkgk..',
    '..kgk.kgk.',
    '..kkk.kkk.'];

  var TOWEL = [
    '.kkkkkkkkkkkkkkkk.',
    'krrrrrrrrrrrrrrrRk',
    'kwwwwwwwwwwwwwwwwk',
    'krrrrrrrrrrrrrrRRk',
    'kRRRRRRRRRRRRRRRRk',
    '.kkkkkkkkkkkkkkkk.'];

  // Held props, in kid pixels (drawn at the kid's scale, kid palette).
  var UNDERWEAR = [
    'kkkkkkkk',
    'kwwwwwWk',
    'kwwkkwWk',
    'kwk..kWk',
    'kkk..kkk'];

  var SHIRT = [
    '..kkkkkkkk..',
    '.kaaaaaaaAk.',
    'kaaaahhaaaAk',
    'kaaaaaaaaAAk',
    '.kAAAAAAAAk.',
    '..kkkkkkkk..'];

  var SOCK = [
    'kkk..',
    'kaAk.',
    'kwwkk',
    'kwwwk',
    '.kkkk'];

  var SWEAT = [
    '..q..',
    '.qq..',
    '.qQq.',
    'qQQjq',
    'qQjjq',
    '.qqq.'];

  // ------------------------------------------------------------ background

  function paintWall(ctx) {
    var R = P.room, x, y, i = 0;
    rect(ctx, R.L, 0, 0, W, 188);
    for (y = 8; y < 180; y += 16) {                     // little stars
      for (x = (i % 2) * 8 + 4; x < W; x += 16) {
        rect(ctx, R.s, x, y, 1, 3);
        rect(ctx, R.s, x - 1, y + 1, 3, 1);
      }
      i++;
    }
    rect(ctx, R.M, 0, 0, W, 2);                          // ceiling shade
    rect(ctx, R.w, 0, 182, W, 6);                        // baseboard
    rect(ctx, R.M, 0, 187, W, 1);
  }

  function paintFloor(ctx) {
    var R = P.room, y, x, row = 0;
    rect(ctx, R.f, 0, 188, W, H - 188);
    for (y = 188; y < H; y += 6) {
      rect(ctx, R.F, 0, y, W, 1);
      for (x = (row % 2) * 24; x < W; x += 48) { rect(ctx, R.F, x, y, 1, 6); }
      row++;
    }
    // rug under the standing spot (dithered edge)
    for (y = 198; y < 214; y++) {
      for (x = 146; x < 236; x++) {
        var dx = (x - 191) / 45, dy = (y - 206) / 8, d = dx * dx + dy * dy;
        if (d < 0.7 || (d < 1 && (x + y) % 2 === 0)) {
          rect(ctx, (d > 0.45 && d < 0.6) ? R.R : R.r, x, y, 1, 1);
        }
      }
    }
  }

  function paintWindow(ctx) {
    var R = P.room;
    rect(ctx, R.O, 56, 22, 92, 3);                       // curtain rod
    rect(ctx, R.k, 71, 29, 62, 62);                      // frame
    rect(ctx, R.w, 72, 30, 60, 60);
    // the glass is left transparent: the live sky is drawn behind bgBack
    ctx.clearRect(PANE.x, PANE.y, PANE.w, PANE.h);
    rect(ctx, R.w, 72, 59, 60, 3);                       // cross bars
    rect(ctx, R.w, 100, 30, 3, 60);
    // curtains with folds
    rect(ctx, R.u, 60, 25, 14, 76);
    rect(ctx, R.u, 130, 25, 14, 76);
    rect(ctx, R.U, 64, 25, 2, 76);
    rect(ctx, R.U, 69, 25, 2, 76);
    rect(ctx, R.U, 134, 25, 2, 76);
    rect(ctx, R.U, 139, 25, 2, 76);
    rect(ctx, R.U, 60, 99, 14, 2);
    rect(ctx, R.U, 130, 99, 14, 2);
  }

  function shelf(ctx, x, y, w) {
    var R = P.room;
    rect(ctx, R.k, x, y, w, 4);
    rect(ctx, R.l, x + 1, y, w - 2, 1);
    rect(ctx, R.o, x + 1, y + 1, w - 2, 2);
    rect(ctx, R.O, x + 4, y + 4, 3, 5);                  // brackets
    rect(ctx, R.O, x + w - 7, y + 4, 3, 5);
  }

  function block(ctx, x, y, face, shade) {
    var T = P.toys;
    rect(ctx, T.k, x, y, 10, 10);
    rect(ctx, face, x + 1, y + 1, 8, 8);
    rect(ctx, shade, x + 6, y + 1, 3, 8);
    rect(ctx, T.w, x + 3, y + 3, 2, 2);
  }

  function paintShelves(ctx) {
    var T = P.toys, spr = MR.sprites.buildSprite;
    shelf(ctx, 184, 56, 68);
    shelf(ctx, 184, 94, 68);
    ctx.drawImage(spr(CAR, T), 188, 56 - CAR.length);           // the small red car
    ctx.drawImage(spr(BALL, T), 212, 56 - BALL.length);
    ctx.drawImage(spr(TEDDY, T), 232, 56 - TEDDY.length);
    ctx.drawImage(spr(ROBOT, T), 190, 94 - ROBOT.length);
    block(ctx, 208, 84, T.r, T.R);
    block(ctx, 218, 84, T.b, T.B);
    block(ctx, 213, 74, T.y, T.Y);
    block(ctx, 234, 84, T.e, T.k);
  }

  function paintBed(ctx) {
    var R = P.room, T = P.toys, x;
    // headboard
    rect(ctx, R.k, 9, 126, 14, 70);
    rect(ctx, R.o, 10, 127, 12, 68);
    rect(ctx, R.l, 11, 128, 3, 66);
    rect(ctx, R.O, 19, 127, 3, 68);
    rect(ctx, R.k, 10, 124, 12, 2);
    // frame and legs
    rect(ctx, R.k, 20, SEAT_Y + 12, 120, 10);
    rect(ctx, R.o, 21, SEAT_Y + 13, 118, 8);
    rect(ctx, R.O, 21, SEAT_Y + 19, 118, 2);
    rect(ctx, R.k, 132, SEAT_Y + 12, 8, FLOOR_Y - SEAT_Y - 12);
    rect(ctx, R.O, 133, SEAT_Y + 22, 6, FLOOR_Y - SEAT_Y - 22);
    // mattress + blanket (draped over the front of the frame)
    rect(ctx, T.k, 20, SEAT_Y - 3, 118, 17);
    rect(ctx, T.b, 21, SEAT_Y - 2, 116, 15);
    for (x = 26; x < 136; x += 12) { rect(ctx, T.B, x, SEAT_Y - 2, 5, 15); }   // stripes
    rect(ctx, T.B, 21, SEAT_Y - 2, 116, 2);
    rect(ctx, T.w, 21, SEAT_Y - 3, 34, 3);               // sheet under the pillow
    // pillow
    rect(ctx, T.k, 22, SEAT_Y - 14, 34, 12);
    rect(ctx, T.w, 23, SEAT_Y - 13, 32, 10);
    rect(ctx, T.W, 23, SEAT_Y - 5, 32, 2);
    rect(ctx, T.W, 50, SEAT_Y - 13, 5, 10);
    // the small panda teddy, sitting next to the pillow (2x, like the kid)
    ctx.drawImage(MR.sprites.buildSprite(PANDA, T), 57, SEAT_Y - 1 - PANDA.length * 2,
      PANDA[0].length * 2, PANDA.length * 2);
  }

  // ------------------------------------------------------------ timeline

  // All steps start from these; each step overrides what changes.
  // Bare chest until the t-shirt goes on (the base shorts are always on).
  var BASE = { outfit: 'underwear', torso: 'bare', legs: 'stand', feet: 'bare', armL: 'down', armR: 'down',
    eyes: 'open', mouth: 'smile' };

  var TOWEL_ON = ['towelWrap'], PANTS = ['pants'], SHIRT_ON = ['pants', 'tshirt'];

  // c = clothes, at = position, dy = hop lift (kid px), prop = held prop,
  // towel = 'none' | 'fall' | 'bed' (defaults to 'bed' after the drop).
  var TIMELINE = [
    { c: TOWEL_ON, prop: 'underwear', towel: 'none', dur: 450 },
    { c: TOWEL_ON, armL: 'holdLow', armR: 'holdLow', eyes: 'closed', off: -1, towel: 'none', dur: 200 },
    { c: TOWEL_ON, armL: 'holdLow', armR: 'holdLow', eyes: 'closed', off: 1, towel: 'none', dur: 200 },
    { c: TOWEL_ON, armL: 'holdLow', armR: 'holdLow', eyes: 'closed', off: -1, towel: 'none', dur: 200 },
    { c: [], eyes: 'happy', towel: 'fall', dur: 280 },
    { c: ['pantsHalf'], dur: 300 },
    { c: ['pantsHalf'], legs: 'hop', feet: 'hop', armL: 'holdLow', armR: 'holdLow', dy: -3, dur: 200 },
    { c: ['pantsHalf'], legs: 'hop', feet: 'hop', armL: 'holdLow', armR: 'holdLow', dy: 0, dur: 200 },
    { c: ['pantsHalf'], legs: 'hop', feet: 'hop', armL: 'holdLow', armR: 'holdLow', dy: -3, dur: 200 },
    { c: ['pantsHalf'], legs: 'hop', feet: 'hop', armL: 'holdLow', armR: 'holdLow', dy: 0, dur: 200 },
    { c: PANTS, armL: 'holdLow', armR: 'holdLow', eyes: 'happy', dur: 300 },
    { c: PANTS, legs: 'sit', at: 'mid', dy: -2, dur: 160 },
    { c: PANTS, legs: 'sit', at: 'sit', dur: 220 },
    { c: PANTS, legs: 'sit', at: 'sit', armL: 'waveUp', armR: 'waveUp', prop: 'shirt', dur: 350 },
    { c: ['pants', 'tshirtRolled'], legs: 'sit', at: 'sit', armL: 'waveUp', armR: 'waveUp', eyes: 'happy', dur: 300 },
    { c: SHIRT_ON, legs: 'sit', at: 'sit', armL: 'holdLow', armR: 'holdLow', eyes: 'happy', dur: 300 },
    { c: SHIRT_ON, legs: 'sitLiftL', feet: 'liftL', at: 'sit', armL: 'reachDown', armR: 'reachDown', prop: 'sockL', dur: 300 },
    { c: ['pants', 'tshirt', 'sockLeft'], legs: 'sit', at: 'sit', armL: 'holdLow', armR: 'holdLow', dur: 220 },
    { c: ['pants', 'tshirt', 'sockLeft'], legs: 'sitLiftR', feet: 'liftR', at: 'sit', armL: 'reachDown', armR: 'reachDown', prop: 'sockR', dur: 300 },
    { c: ['pants', 'tshirt', 'socks'], legs: 'sit', at: 'sit', armL: 'holdLow', armR: 'holdLow', dur: 220 },
    { c: ['pants', 'tshirt', 'socks'], legs: 'sit', at: 'sit', armL: 'waveUp', armR: 'waveUp', eyes: 'happy', mouth: 'open', dur: 500 }
  ];

  function poseFor(st, face) {
    var p = {}, k;
    for (k in BASE) { if (BASE.hasOwnProperty(k)) { p[k] = BASE[k]; } }
    for (k in st) {
      if (st.hasOwnProperty(k) && p.hasOwnProperty(k)) { p[k] = st[k]; }
    }
    p.clothes = st.c;
    p.offsets = st.off ? { torso: [st.off, 0] } : null;
    if (face) { p.eyes = face; p.mouth = face; }
    return p;
  }

  // Bakes one step: where to draw it and where its hands are.
  function place(st, face) {
    var b = MR.character.bake(poseFor(st, face)), x = X[st.at || 'stand'],
      dx = Math.round(x - b.ax * S), dy = Math.round(FLOOR_Y - b.ay * S + (st.dy || 0) * S);
    function hand(side) {
      var h = b.points[side + '.hand'];
      return h ? [dx + h[0] * S, dy + h[1] * S] : null;
    }
    return {
      img: MR.sprites.withRed(b.canvas), x: dx, y: dy,
      handL: hand('armL'), handR: hand('armR'),
      top: [dx + b.points['head.top'][0] * S, dy + b.points['head.top'][1] * S]
    };
  }

  // Step index and how far through it we are (0..1).
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
    var kidMap = MR.palette.merge(MR.palette.CHARACTER_BODY, MR.palette.OUTFIT_COLORS['default']),
      back, sit, i, k;
    S = MR.config.DRESSING.KID_SCALE;
    FLOOR_Y = MR.config.DRESSING.FLOOR_Y;
    // bed seat height from the rig: seated, his hips sit exactly on it
    sit = MR.character.bake(poseFor({ c: PANTS, legs: 'sit' }));
    SEAT_Y = FLOOR_Y - (sit.points['legs.ground'][1] - sit.points['legs.hips'][1]) * S;

    back = MR.sprites.createCanvas(W, H);
    paintWall(back.getContext('2d'));
    paintFloor(back.getContext('2d'));
    paintWindow(back.getContext('2d'));
    paintShelves(back.getContext('2d'));
    paintBed(back.getContext('2d'));
    bgBack = back;
    // the thrown towel rests ON the blanket: its bottom outline overlaps the
    // blanket's top outline (SEAT_Y - 3), no gap
    TOWEL_BED.y = SEAT_Y - 3 - TOWEL.length + 1;

    props.towel = MR.sprites.buildSprite(TOWEL, P.toys);
    props.underwear = MR.sprites.buildSprite(UNDERWEAR, kidMap);
    props.shirt = MR.sprites.buildSprite(SHIRT, kidMap);
    props.sock = MR.sprites.buildSprite(SOCK, kidMap);
    sweat = MR.sprites.buildSprite(SWEAT, MR.palette.FX);

    for (i = 0; i < TIMELINE.length; i++) {
      steps.push(place(TIMELINE[i]));
      worried.push(place(TIMELINE[i], 'worried'));
      stepDur.push(TIMELINE[i].dur * MR.config.DRESSING.TEMPO);
    }

    // red-alert variants (getImageData: init only)
    MR.sprites.withRed(bgBack);
    MR.sprites.withRed(sweat);
    for (k in props) { if (props.hasOwnProperty(k)) { MR.sprites.withRed(props[k]); } }
  }

  var red = false;
  function im(c) { return red ? c.red : c; }

  function drawProp(ctx, img, at, scale) {
    ctx.drawImage(im(img), Math.round(at[0] - img.width * scale / 2), Math.round(at[1] - img.height * scale / 2),
      img.width * scale, img.height * scale);
  }

  function render(ctx, clock, alert) {
    var a = stepAt(clock), def = TIMELINE[a.i], st, towel, f, tx, ty, mid;
    red = !!(alert && alert.red);
    st = red ? worried[a.i] : steps[a.i];

    MR.sky.draw(ctx, PANE, clock, red);             // live Locmariaquer sky (src/sky.js)
    ctx.drawImage(im(bgBack), 0, 0);

    // the towel: on him (overlay), falling to the bed, or lying on the bed
    towel = def.towel || (a.i > 4 ? 'bed' : 'none');
    if (towel === 'bed') {
      ctx.drawImage(im(props.towel), TOWEL_BED.x, TOWEL_BED.y);
    }

    ctx.drawImage(im(st.img), st.x, st.y, st.img.width * S, st.img.height * S);

    if (towel === 'fall') {                                // arcs from his waist to the bed
      f = a.f;
      tx = X.stand - 10 + (TOWEL_BED.x - (X.stand - 10)) * f;
      ty = 150 + (TOWEL_BED.y - 150) * f - Math.sin(f * Math.PI) * 30;
      ctx.drawImage(im(props.towel), Math.round(tx), Math.round(ty));
    }

    // props in his hands
    if (def.prop === 'underwear' && st.handL && st.handR) {
      mid = [(st.handL[0] + st.handR[0]) / 2, (st.handL[1] + st.handR[1]) / 2];
      drawProp(ctx, props.underwear, mid, S);
    } else if (def.prop === 'shirt' && st.handL && st.handR) {
      mid = [(st.handL[0] + st.handR[0]) / 2, Math.min(st.handL[1], st.handR[1]) - 2 * S];
      drawProp(ctx, props.shirt, mid, S);
    } else if (def.prop === 'sockL' && st.handL) {
      drawProp(ctx, props.sock, st.handL, S);
    } else if (def.prop === 'sockR' && st.handR) {
      drawProp(ctx, props.sock, st.handR, S);
    }

    // red alert: a sweat drop beside his head
    if (red) {
      ctx.drawImage(sweat.red, st.top[0] + 9 * S, st.top[1] + 4 * S + Math.round(Math.sin(clock * 0.008) * S),
        sweat.width * S, sweat.height * S);
    }
  }

  MR.scenes.dressing = { init: init, render: render };
}());
