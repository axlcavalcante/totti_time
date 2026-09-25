// SCENE 1: SHOWER. The kid stands in a bathtub under a running shower,
// scrubbing shampoo into his hair. ES5 only.
//
// Interface used by the SCENE state (states.js):
//   init()                     pre-renders everything (and red variants), once
//   render(ctx, clock, alert)  draws the 256x224 scene at (0, 0); clock = anim
//                              ms; alert.red = draw the red-alert version
//                              (red caches, worried kid, sweat drop)
//
// Modesty: the pose uses torso 'bath' (neck + shoulders only), legs 'hidden'
// and no feet, AND the tub front is drawn over everything below the shoulders.
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224, CX = 128;
  var P = MR.palette.SHOWER;

  var S, RIM_Y, NECK_Y;          // from config at init
  var bgBack, bgFront;           // pre-rendered layers
  var streams = [], foam = [], splash = [], bubbleImg = [], steamImg = [];
  var steps = [], worried = [], stepDur = [], sweat = null;
  var hairTopY = 0, headTopY = 0;

  // ------------------------------------------------------------ helpers

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function layer() {
    var c = MR.sprites.createCanvas(W, H);
    return { canvas: c, ctx: c.getContext('2d') };
  }

  // ------------------------------------------------------------ sprite data

  var SHAMPOO = [
    '...kkkk...',
    '...kAAk...',
    '...kAAk...',
    '..kkkkkk..',
    '.kaaaaaAk.',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kawwwwwaAk',
    'kawaawwaAk',
    'kawwwwwaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kaaaaaaaAk',
    'kAAAAAAAAk',
    '.kkkkkkkk.'];

  var BOTTLE = [
    '..kkkk..',
    '..kwwk..',
    '.kkkkkk.',
    'kbbbbbBk',
    'kbbbbbBk',
    'kbbbbbBk',
    'kbwwwbBk',
    'kbwwwbBk',
    'kbwwwbBk',
    'kbbbbbBk',
    'kbbbbbBk',
    'kbbbbbBk',
    'kbbbbbBk',
    'kbbbbbBk',
    'kBBBBBBk',
    '.kkkkkk.'];

  var SPONGE = [
    '.kkkkkkkkkkkk.',
    'kyyyyyyyyyyyYk',
    'kyYyyyyYyyyyYk',
    'kyyyyYyyyyYyYk',
    'kyYyyyyyYyyyYk',
    'kyyyyyYyyyyYYk',
    'kYYYYYYYYYYYYk',
    '.kkkkkkkkkkkk.'];

  var DUCK = [
    '.....kkkk...',
    '....kyyyyk..',
    '....kykyyYoo',
    '....kyyyYk..',
    'kk..kyyyyk..',
    'kyykkyyyyyyk',
    'kyyyyyyyyyYk',
    'kyyyyyyyyYYk',
    '.kYYYYYYYYk.',
    '..kkkkkkkk..'];

  var SOAP = [
    '.kkkkkkkk.',
    'kwwwwwwwWk',
    'kwWWWWWWWk',
    '.kkkkkkkk.'];

  // Foam on the hair, in kid pixels (drawn at KID_SCALE). 16 wide = hair width.
  var FOAM = [
    ['................',
     '......uuu.......',
     '.....uwwwu.uu...',
     '....uwwwwWuwwu..',
     '....uWwwWWwwWu..',
     '.....uuuuuuuu...'],
    ['......uuu.uu....',
     '....uuwwwuwwu...',
     '...uwwwwwwwwWu..',
     '..uwwwWwwwwwWWu.',
     '..uWwwwwWwwWWu..',
     '...uuuuuuuuuu...'],
    ['...uu.uuu..uu...',
     '..uwwuwwwuuwwu..',
     '.uwwwwwwwwwwwWu.',
     'uwwwwWwwwwwwwWWu',
     'uWwwwwwWwwwwWWu.',
     '.uuuuuuuuuuuuuu.']
  ];

  // Droplets bouncing off the head (scene pixels).
  var SPLASH = [
    ['........q.q.........',
     '...q..q.....q..q....',
     '.q....Q..Q.....Q..q.',
     '....Q...........Q...',
     'q..................q',
     '....................'],
    ['......q....q........',
     '..q.....Q.....q.....',
     '....Q.......Q....Q..',
     '.q..............q...',
     '...q..........q.....',
     'q..................q'],
    ['.......q..q...q.....',
     '.q..q.........q..q..',
     '......Q....Q........',
     '..Q..............Q..',
     'q...q.........q....q',
     '....................']
  ];

  // Sweat drop beside his head during the red alert (kid pixels).
  var SWEAT = [
    '..q..',
    '.qq..',
    '.qQq.',
    'qQQjq',
    'qQjjq',
    '.qqq.'];

  var BUBBLES = [
    ['.u.',
     'uwu',
     '.u.'],
    ['.uuu.',
     'uw..u',
     'u...u',
     'u...u',
     '.uuu.'],
    ['..uuu..',
     '.u...u.',
     'u.w...u',
     'u.....u',
     'u.....u',
     '.u...u.',
     '..uuu..']
  ];

  // Falling water: a dashed 2px column; frames shift the dashes down.
  function streamData(frame, len) {
    var out = [], y, m;
    for (y = 0; y < len; y++) {
      m = (y + 8 - frame * 2) % 8;
      if (m < 3) { out.push('qq'); } else if (m < 5) { out.push('Qq'); } else if (m < 6) { out.push('j.'); } else { out.push('..'); }
    }
    return out;
  }

  // Dithered steam puff (checkerboard inside an ellipse, sparser at the edge).
  function steamData(w, h) {
    var out = [], x, y, dx, dy, d, row;
    for (y = 0; y < h; y++) {
      row = '';
      for (x = 0; x < w; x++) {
        dx = (x - w / 2 + 0.5) / (w / 2);
        dy = (y - h / 2 + 0.5) / (h / 2);
        d = dx * dx + dy * dy;
        if (d < 0.45 && (x + y) % 2 === 0) { row += 's'; } else if (d < 1 && x % 2 === 0 && y % 2 === 0) { row += 's'; } else { row += '.'; }
      }
      out.push(row);
    }
    return out;
  }

  // ------------------------------------------------------------ backgrounds

  function paintWall(ctx) {
    var R = P.room, x, y, edge;
    rect(ctx, R.g, 0, 0, W, 186);
    for (y = 0; y < 176; y += 16) {
      for (x = 0; x < W; x += 16) {
        edge = x < 16 || x >= W - 16 || y < 16;          // corner shade
        rect(ctx, edge ? R.v : R.w, x, y, 15, 15);
        rect(ctx, R.v, x + 1, y + 14, 14, 1);             // tile bottom edge
        rect(ctx, R.v, x + 14, y + 1, 1, 13);
      }
    }
    // decorative blue strip and skirting band
    for (x = 0; x < W; x += 8) {
      rect(ctx, R.t, x, 64, 7, 7);
      rect(ctx, R.T, x, 70, 7, 1);
    }
    rect(ctx, R.T, 0, 176, W, 10);
    rect(ctx, R.t, 0, 177, W, 7);
    for (x = 0; x < W; x += 16) { rect(ctx, R.T, x + 15, 177, 1, 7); }
  }

  function paintFloor(ctx) {
    var R = P.room, x, y, i = 0;
    rect(ctx, R.G, 0, 186, W, H - 186);
    for (y = 187; y < H; y += 10) {
      for (x = (i % 2) * 8 - 8; x < W; x += 16) {
        rect(ctx, (x / 16 + i) % 2 ? R.f : R.F, x, y, 15, 9);
      }
      i++;
    }
    // tub shadow
    rect(ctx, R.G, 50, 194, 158, 8);
  }

  function paintShower(ctx) {
    var R = P.room, y, w, i;
    // pipe: down from the ceiling, across, down to the head
    rect(ctx, R.x, CX + 35, 0, 6, 52);
    rect(ctx, R.c, CX + 36, 0, 2, 50);
    rect(ctx, R.C, CX + 38, 0, 2, 50);
    rect(ctx, R.x, CX - 2, 46, 43, 6);
    rect(ctx, R.c, CX - 1, 47, 41, 2);
    rect(ctx, R.C, CX - 1, 49, 41, 2);
    rect(ctx, R.x, CX - 3, 52, 6, 6);
    rect(ctx, R.C, CX - 2, 52, 4, 6);
    // wall bracket
    rect(ctx, R.x, CX + 33, 20, 10, 5);
    rect(ctx, R.C, CX + 34, 21, 8, 3);
    // head: widening trapezoid
    for (i = 0; i < 10; i++) {
      y = 58 + i;
      w = 10 + i * 2;
      rect(ctx, R.x, CX - w / 2 - 1, y, w + 2, 1);
      rect(ctx, i < 4 ? R.c : R.C, CX - w / 2, y, w, 1);
    }
    rect(ctx, R.c, CX - 6, 59, 3, 5);                  // shine
    rect(ctx, R.x, CX - 15, 68, 30, 2);                 // nozzle plate
    for (i = -12; i <= 12; i += 4) { rect(ctx, R.c, CX + i, 68, 2, 1); }
    // mixer knob
    rect(ctx, R.x, CX + 52, 112, 12, 12);
    rect(ctx, R.c, CX + 53, 113, 10, 10);
    rect(ctx, R.C, CX + 57, 113, 6, 10);
    rect(ctx, R.x, CX + 56, 116, 4, 4);
  }

  function paintShelf(ctx) {
    var R = P.room, Pr = P.props;
    // recessed niche
    rect(ctx, R.G, 12, 90, 52, 44);
    rect(ctx, R.g, 13, 91, 50, 42);
    rect(ctx, R.v, 14, 92, 48, 39);
    // chrome shelf lip
    rect(ctx, R.x, 10, 128, 56, 5);
    rect(ctx, R.c, 11, 129, 54, 2);
    rect(ctx, R.C, 11, 131, 54, 1);
    ctx.drawImage(MR.sprites.buildSprite(SHAMPOO, Pr), 18, 106);
    ctx.drawImage(MR.sprites.buildSprite(BOTTLE, Pr), 32, 112);
    ctx.drawImage(MR.sprites.buildSprite(SOAP, MR.palette.merge(Pr, { W: P.room.E })), 46, 124);
  }

  function paintTowel(ctx) {
    var R = P.room, Pr = P.props, x;
    rect(ctx, R.x, 220, 54, 8, 6);                       // hook
    rect(ctx, R.c, 221, 55, 6, 3);
    rect(ctx, Pr.k, 207, 60, 34, 60);
    rect(ctx, Pr.r, 208, 61, 32, 58);
    rect(ctx, Pr.R, 234, 61, 6, 58);                     // shade
    rect(ctx, Pr.R, 208, 61, 32, 3);                     // fold at the top
    rect(ctx, Pr.w, 208, 98, 32, 3);                     // stripes
    rect(ctx, Pr.w, 208, 104, 32, 1);
    for (x = 208; x < 240; x += 3) { rect(ctx, Pr.k, x, 119, 1, 3); } // fringe
  }

  function paintTubBack(ctx) {
    var R = P.room;
    // far rim of the tub, seen behind the kid
    rect(ctx, R.k, 52, 141, 152, 9);
    rect(ctx, R.E, 53, 142, 150, 3);
    rect(ctx, R.D, 53, 145, 150, 5);                     // inside wall, in shadow
  }

  function paintTubFront(ctx) {
    var R = P.room, Pr = P.props, x;
    // claw feet
    for (x = 58; x < 200; x += 132) {
      rect(ctx, R.x, x, 193, 12, 7);
      rect(ctx, R.c, x + 1, 194, 10, 3);
      rect(ctx, R.C, x + 1, 197, 10, 2);
    }
    // front panel
    rect(ctx, R.k, 47, 155, 162, 40);
    rect(ctx, R.w, 48, 155, 160, 38);
    rect(ctx, R.E, 48, 155, 4, 38);                      // left curve
    rect(ctx, R.E, 170, 155, 34, 38);                    // right side turning away
    rect(ctx, R.D, 204, 155, 4, 38);
    rect(ctx, R.E, 48, 185, 160, 5);                     // bottom curve
    rect(ctx, R.D, 48, 190, 160, 3);
    rect(ctx, R.E, 62, 162, 104, 1);                     // panel molding
    rect(ctx, R.E, 62, 162, 1, 20);
    rect(ctx, R.w, 62, 182, 104, 1);
    rect(ctx, R.D, 170, 162, 1, 21);
    rect(ctx, R.D, 171, 162, 26, 1);
    rect(ctx, R.w, 56, 158, 2, 26);                      // glossy highlight
    // rim (drawn last so it overlaps the panel)
    rect(ctx, R.k, 44, RIM_Y, 168, 6);
    rect(ctx, R.k, 46, RIM_Y - 1, 164, 1);
    rect(ctx, R.w, 46, RIM_Y, 164, 2);
    rect(ctx, R.E, 45, RIM_Y + 2, 166, 2);
    rect(ctx, R.D, 46, RIM_Y + 4, 164, 1);
    // bath toys sitting on the rim
    ctx.drawImage(MR.sprites.buildSprite(DUCK, Pr), 62, RIM_Y - 10);
    ctx.drawImage(MR.sprites.buildSprite(SPONGE, Pr), 182, RIM_Y - 8);
  }

  // ------------------------------------------------------------ timeline

  function pose(armL, armR, eyes, mouth) {
    return {
      outfit: 'bath', torso: 'bath', legs: 'hidden', feet: null, hair: 'wet',
      armL: armL, armR: armR, eyes: eyes, mouth: mouth,
      order: MR.character.ORDER_ARMS_FRONT
    };
  }

  // foam: index into FOAM, -1 = none. Base durations give a ~4-6 fps feel.
  var TIMELINE = [
    { armL: 'scrubA', armR: 'scrubB', eyes: 'closed', mouth: 'smile', foam: 0,  dur: 220 },
    { armL: 'scrubB', armR: 'scrubA', eyes: 'closed', mouth: 'smile', foam: 0,  dur: 220 },
    { armL: 'scrubA', armR: 'scrubB', eyes: 'closed', mouth: 'smile', foam: 1,  dur: 220 },
    { armL: 'scrubB', armR: 'scrubA', eyes: 'closed', mouth: 'smile', foam: 1,  dur: 220 },
    { armL: 'scrubA', armR: 'scrubB', eyes: 'closed', mouth: 'smile', foam: 2,  dur: 220 },
    { armL: 'scrubB', armR: 'scrubA', eyes: 'closed', mouth: 'smile', foam: 2,  dur: 220 },
    { armL: 'down',   armR: 'down',   eyes: 'closed', mouth: 'smile', foam: 2,  dur: 260 },
    { armL: 'down',   armR: 'down',   eyes: 'closed', mouth: 'smile', foam: 1,  dur: 260 },
    { armL: 'down',   armR: 'down',   eyes: 'closed', mouth: 'open',  foam: -1, dur: 260 },
    { armL: 'down',   armR: 'down',   eyes: 'happy',  mouth: 'open',  foam: -1, dur: 320 },
    { armL: 'down',   armR: 'down',   eyes: 'happy',  mouth: 'smile', foam: -1, dur: 320 },
    { armL: 'down',   armR: 'down',   eyes: 'open',   mouth: 'smile', foam: -1, dur: 280 }
  ];

  // Bubbles: fixed deterministic paths rising from the tub.
  var BUBBLE_PATHS = [
    { x: 64,  v: 0.030, ph: 0,   size: 1, sway: 3 },
    { x: 84,  v: 0.024, ph: 40,  size: 0, sway: 2 },
    { x: 102, v: 0.036, ph: 75,  size: 2, sway: 4 },
    { x: 152, v: 0.028, ph: 20,  size: 1, sway: 3 },
    { x: 168, v: 0.022, ph: 90,  size: 0, sway: 2 },
    { x: 190, v: 0.032, ph: 55,  size: 2, sway: 4 },
    { x: 76,  v: 0.020, ph: 100, size: 0, sway: 2 },
    { x: 200, v: 0.026, ph: 10,  size: 1, sway: 3 }
  ];
  var BUBBLE_RANGE = 120;

  var STEAM_PATHS = [
    { x: 70,  v: 0.010, ph: 0,  img: 0 },
    { x: 160, v: 0.008, ph: 45, img: 1 },
    { x: 110, v: 0.012, ph: 80, img: 0 }
  ];
  var STEAM_RANGE = 110;

  // ------------------------------------------------------------ init/render

  function init() {
    var fx = P.fx, i, back, front, b, top;
    S = MR.config.SHOWER.KID_SCALE;
    RIM_Y = MR.config.SHOWER.RIM_Y;
    NECK_Y = RIM_Y - 5 * S;            // torso rows 5+ sit behind the rim

    back = layer();
    paintWall(back.ctx);
    paintFloor(back.ctx);
    paintShower(back.ctx);
    paintShelf(back.ctx);
    paintTowel(back.ctx);
    paintTubBack(back.ctx);
    bgBack = back.canvas;

    front = layer();
    paintTubFront(front.ctx);
    bgFront = front.canvas;

    for (i = 0; i < 4; i++) { streams.push(MR.sprites.buildSprite(streamData(i, 120), fx)); }
    for (i = 0; i < FOAM.length; i++) { foam.push(MR.sprites.buildSprite(FOAM[i], fx)); }
    for (i = 0; i < SPLASH.length; i++) { splash.push(MR.sprites.buildSprite(SPLASH[i], fx)); }
    for (i = 0; i < BUBBLES.length; i++) { bubbleImg.push(MR.sprites.buildSprite(BUBBLES[i], fx)); }
    steamImg.push(MR.sprites.buildSprite(steamData(32, 14), fx));
    steamImg.push(MR.sprites.buildSprite(steamData(24, 10), fx));

    sweat = MR.sprites.buildSprite(SWEAT, fx);

    // Pre-bake every kid pose of the loop (normal + worried) and where to draw it.
    function place(b, foamIdx) {
      var n = b.points['torso.neck'];
      return {
        img: MR.sprites.withRed(b.canvas),
        x: Math.round(CX - n[0] * S),
        y: Math.round(NECK_Y - n[1] * S),
        foam: foamIdx
      };
    }
    for (i = 0; i < TIMELINE.length; i++) {
      b = MR.character.bake(pose(TIMELINE[i].armL, TIMELINE[i].armR, TIMELINE[i].eyes, TIMELINE[i].mouth));
      steps.push(place(b, TIMELINE[i].foam));
      worried.push(place(MR.character.bake(pose(TIMELINE[i].armL, TIMELINE[i].armR, 'worried', 'worried')),
        TIMELINE[i].foam));
      stepDur.push(TIMELINE[i].dur);
      if (i === 0) {
        top = b.points['head.top'];
        headTopY = steps[0].y + top[1] * S;
        hairTopY = headTopY - 2 * S;   // wet hair starts 2 rows above the head
      }
    }

    // Red-alert variants of every cached layer (getImageData: init only).
    MR.sprites.withRed(bgBack);
    MR.sprites.withRed(bgFront);
    MR.sprites.withRed(sweat);
    [streams, foam, splash, bubbleImg, steamImg].forEach(function (list) {
      list.forEach(function (c) { MR.sprites.withRed(c); });
    });
  }

  var red = false;                     // set per render call
  function im(c) { return red ? c.red : c; }

  function drawStream(ctx, x, y0, y1, frame, width) {
    var len = Math.min(y1 - y0, 120);
    if (len > 0) { ctx.drawImage(im(streams[frame]), 0, 0, width, len, x, y0, width, len); }
  }

  function render(ctx, clock, alert) {
    var idx = MR.sprites.frameAt(stepDur, clock), st, wf = Math.floor(clock / 60) % 4,
      i, dx, stop, b, y, img, f;
    red = !!(alert && alert.red);
    st = red ? worried[idx] : steps[idx];

    ctx.drawImage(im(bgBack), 0, 0);

    // the kid
    ctx.drawImage(im(st.img), st.x, st.y, st.img.width * S, st.img.height * S);

    // sweat drop, bobbing beside his head (red alert only)
    if (red) {
      ctx.drawImage(sweat.red, CX + 9 * S, headTopY + 4 * S + Math.round(Math.sin(clock * 0.008) * S),
        sweat.width * S, sweat.height * S);
    }

    // water from the nozzles down to the (rounded) top of his hair
    for (dx = -11; dx <= 9; dx += 4) {
      // hair top row is 8 kid px wide; outer streams land one row lower
      stop = hairTopY + (Math.abs(dx + 1) > 4 * S ? S : 0);
      drawStream(ctx, CX + dx, 70, stop, (wf + dx + 12) % 4, 2);
    }
    // trickles running down beside his head into the tub
    drawStream(ctx, CX - 9 * S - 1, headTopY + 5 * S, RIM_Y, (wf + 1) % 4, 1);
    drawStream(ctx, CX + 9 * S, headTopY + 5 * S, RIM_Y, (wf + 3) % 4, 1);

    // shampoo foam on the hair (in kid pixels)
    if (st.foam >= 0) {
      img = im(foam[st.foam]);
      ctx.drawImage(img, CX - 8 * S, headTopY + 3 * S - img.height * S, img.width * S, img.height * S);
    }

    // splash where the water hits
    img = im(splash[Math.floor(clock / 110) % 3]);
    ctx.drawImage(img, CX - 10, hairTopY - 7);

    ctx.drawImage(im(bgFront), 0, 0);

    // bubbles rise from the tub
    for (i = 0; i < BUBBLE_PATHS.length; i++) {
      b = BUBBLE_PATHS[i];
      y = RIM_Y - 4 - ((clock * b.v + b.ph) % BUBBLE_RANGE);
      img = im(bubbleImg[b.size]);
      ctx.drawImage(img, Math.round(b.x + Math.sin(clock * 0.003 + b.ph) * b.sway), Math.round(y));
    }

    // steam drifts up and loops
    for (i = 0; i < STEAM_PATHS.length; i++) {
      f = STEAM_PATHS[i];
      y = RIM_Y - 10 - ((clock * f.v + f.ph) % STEAM_RANGE);
      img = im(steamImg[f.img]);
      ctx.drawImage(img, Math.round(f.x + Math.sin(clock * 0.001 + f.ph) * 6), Math.round(y));
    }
  }

  MR.scenes.shower = { init: init, render: render };
}());
