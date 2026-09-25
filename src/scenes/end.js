// END art: in front of the house (reference: photo_sample.jpeg), close on the
// entrance. An anthracite arched door with a glass strip under a porch
// canopy, a beige stone wall on the left, a cream wall with a small window on
// the right, a HOME doormat, potted plants, light-brown tiles, and a hydrangea
// as tall as the kid. The same kid, fully dressed with his shoes on, waves
// goodbye while holding his wheeled school bag (black with green trim).
// Drawn by the 'end' state (states.js). ES5 only.
//
//   init()               pre-renders everything, once
//   render(ctx, clock)   draws the 256x224 frame (the state adds the title)
var MR = window.MR = window.MR || {};
MR.scenes = MR.scenes || {};

(function () {
  var W = 256, H = 224, CX = 146, BS = 3;           // BS: the bag is drawn at 3x (waist-high)
  var P = MR.palette.END;
  var S, FLOOR_Y = 190, GROUND = 198;
  var DOOR = { x: 74, w: 44, top: 40 };

  var bgBack = null, bgFront = null, flowers = null, bag = null, steps = [], stepDur = [];

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // his wheeled school bag, in kid pixels: black, green trim, grey wheels
  var BAG = [
    '.kkkkkkkk.',
    'kggggggggk',
    'kgxxxxxxgk',
    'kgxxxxxxgk',
    'kgxkkkkxgk',
    'kgxkGGkxgk',
    'kgxkxxkxgk',
    'kgxkkkkxgk',
    'kgxxxxxxgk',
    'kgXxxxxXgk',
    'kggggggggk',
    '.kmk..kmk.',
    '.kMk..kMk.',
    '..k....k..'];

  // ------------------------------------------------------------ background

  function paintHouse(ctx) {
    var Hs = P.house, G = P.garden, x, y, row, bw, i, r = DOOR.w / 2, cx = DOOR.x + r, dx;
    // cream rendered wall (right), with a slightly shaded strip near the door
    rect(ctx, Hs.c, 0, 0, W, FLOOR_Y);
    rect(ctx, Hs.C, DOOR.x + DOOR.w, 40, 4, FLOOR_Y - 40);
    // beige stone wall (left): irregular blocks with mortar joints
    rect(ctx, Hs.o, 0, 40, 62, FLOOR_Y - 40);
    row = 0;
    for (y = 41; y < FLOOR_Y; y += 11) {
      x = (row % 2) ? -8 : 0;
      i = row * 3;
      while (x < 62) {
        bw = 14 + ((i * 7) % 3) * 4;
        rect(ctx, (i % 3 === 0) ? Hs.S : Hs.s, x + 1, y, Math.min(bw - 1, 61 - x), 9);
        rect(ctx, Hs.d, x + 1, y + 8, Math.min(bw - 1, 61 - x), 1);
        rect(ctx, (i % 3 === 0) ? Hs.s : Hs.o, x + 2, y + 1, 2, 1);
        x += bw;
        i++;
      }
      row++;
    }
    rect(ctx, Hs.k, 62, 40, 1, FLOOR_Y - 40);
    // door recess (jamb) in the cream wall
    rect(ctx, Hs.C, 63, 40, DOOR.x - 63, FLOOR_Y - 40);
    // anthracite arched door with a tall glass strip and a lever handle
    for (y = DOOR.top; y < FLOOR_Y; y++) {
      dx = y < DOOR.top + r ? Math.round(Math.sqrt(Math.max(0, r * r - (DOOR.top + r - y) * (DOOR.top + r - y)))) : r;
      rect(ctx, Hs.k, cx - dx - 2, y, dx * 2 + 4, 1);
      rect(ctx, Hs.a, cx - dx, y, dx * 2, 1);
    }
    rect(ctx, Hs.h, DOOR.x + 3, DOOR.top + r, 2, FLOOR_Y - DOOR.top - r - 2);   // edge light
    rect(ctx, Hs.A, DOOR.x + DOOR.w - 5, DOOR.top + r, 3, FLOOR_Y - DOOR.top - r);
    rect(ctx, Hs.k, cx - 4, DOOR.top + 18, 8, 120);                                // glass strip
    rect(ctx, Hs.g, cx - 3, DOOR.top + 19, 6, 118);
    rect(ctx, Hs.G, cx - 2, DOOR.top + 21, 1, 114);
    rect(ctx, Hs.k, DOOR.x + 6, 122, 11, 4);                                       // handle
    rect(ctx, Hs.m, DOOR.x + 7, 123, 9, 2);
    rect(ctx, Hs.m, DOOR.x + 7, 123, 2, 6);
    // wall lamp beside the door
    rect(ctx, Hs.k, 124, 62, 8, 18);
    rect(ctx, Hs.a, 125, 63, 6, 16);
    rect(ctx, Hs.l, 127, 66, 2, 9);
    // small window with a white frame and sill
    rect(ctx, Hs.k, 158, 64, 28, 36);
    rect(ctx, Hs.w, 159, 65, 26, 34);
    rect(ctx, Hs.k, 163, 69, 18, 26);
    rect(ctx, Hs.g, 164, 70, 16, 24);
    rect(ctx, Hs.G, 165, 71, 3, 10);
    rect(ctx, Hs.k, 155, 100, 34, 5);
    rect(ctx, Hs.w, 156, 101, 32, 3);
    // porch canopy (anthracite) across the top: the title sits on it
    rect(ctx, Hs.A, 0, 0, W, 38);
    for (x = 0; x < W; x += 8) { rect(ctx, Hs.a, x, 4, 7, 26); }
    rect(ctx, Hs.h, 0, 32, W, 3);
    rect(ctx, Hs.k, 0, 35, W, 5);
    // light-brown tiled floor: big pavers with grout, widening toward us
    rect(ctx, G.j, 0, FLOOR_Y, W, H - FLOOR_Y);
    row = 0;
    for (y = FLOOR_Y + 1; y < H; y += 10 + row * 2) {
      bw = 36 + row * 8;
      for (x = (row % 2) ? -bw / 2 : 0; x < W; x += bw) {
        rect(ctx, ((x / bw + row) % 2) ? G.T : G.t, Math.round(x) + 1, y, bw - 1, 9 + row * 2);
      }
      row++;
    }
    // HOME doormat in front of the door
    rect(ctx, G.k, DOOR.x - 4, FLOOR_Y + 2, DOOR.w + 8, 11);
    rect(ctx, G.n, DOOR.x - 3, FLOOR_Y + 3, DOOR.w + 6, 9);
    MR.font.drawCaps(ctx, 'HOME', DOOR.x + 10, FLOOR_Y + 4, 'black', 1);
    // terracotta pots: one at the foot of the stones, one beside the door
    pot(ctx, 30, FLOOR_Y + 2);
    pot(ctx, 128, FLOOR_Y + 4);
  }

  function pot(ctx, x, bottom) {
    var G = P.garden;
    rect(ctx, G.k, x, bottom - 14, 14, 14);
    rect(ctx, G.r, x + 1, bottom - 13, 12, 12);
    rect(ctx, G.R, x + 9, bottom - 13, 4, 12);
    rect(ctx, G.R, x - 1, bottom - 14, 16, 3);
    rect(ctx, G.E, x + 1, bottom - 24, 12, 10);                                   // plant
    rect(ctx, G.e, x + 3, bottom - 28, 8, 12);
    rect(ctx, G.f, x + 5, bottom - 26, 2, 6);
  }

  // Hydrangea on the right, as tall as the kid: dithered leaves (bgFront)
  // and flower clusters on their own layer so they can sway.
  // A classic bush made of overlapping leafy lobes: wide base on the ground,
  // bumpy irregular crown, top at the kid's height. Dark rim, darker toward
  // the ground, light leaves on each lobe's upper-left, clustered texture.
  var LOBES = [
    [222, 180, 21], [246, 176, 25], [266, 172, 22],          // wide base
    [214, 154, 14], [234, 142, 21], [258, 140, 20],          // middle
    [226, 122, 14], [246, 115, 13], [264, 122, 14]           // bumpy top (~kid height)
  ];
  function inBush(x, y) {
    var i, L, dx, dy;
    if (y > GROUND + 2) { return -1; }
    for (i = 0; i < LOBES.length; i++) {
      L = LOBES[i]; dx = x - L[0]; dy = y - L[1];
      if (dx * dx + dy * dy <= L[2] * L[2]) { return i; }
    }
    return -1;
  }
  function paintBushLeaves(ctx) {
    var G = P.garden, x, y, i, L, dx, dy, edge, c;
    for (y = 96; y <= GROUND + 2; y++) {
      for (x = 180; x < W; x++) {
        i = inBush(x, y);
        if (i < 0) { continue; }
        L = LOBES[i]; dx = x - L[0]; dy = y - L[1];
        edge = inBush(x - 1, y) < 0 || inBush(x + 1, y) < 0 || inBush(x, y - 1) < 0 || inBush(x, y + 1) < 0;
        if (edge) { c = G.k; }
        else if (dx < -L[2] * 0.3 && dy < -L[2] * 0.3 && ((x >> 1) + (y >> 1)) % 2 === 0) { c = G.f; }   // light
        else if (y > 180 || (((x >> 2) + (y >> 2)) % 3 === 0 && (x + y) % 2 === 0)) { c = G.E; }        // shade / leaf gaps
        else { c = ((x >> 1) + y) % 5 === 0 ? G.f : G.e; }
        rect(ctx, c, x, y, 1, 1);
      }
    }
  }

  // soft, bumpy flower clusters (no outline): little petals in the cluster's
  // color, light highlights on the top-left, a few gaps showing the leaves
  function paintFlowers(ctx) {
    var G = P.garden, spots = [[226, 126, 'b'], [246, 116, 'v'], [258, 130, 'b'], [232, 150, 'p'],
      [252, 148, 'v'], [216, 164, 'b'], [240, 172, 'b'], [260, 164, 'p']], i, x, y, s, c, d;
    for (i = 0; i < spots.length; i++) {
      s = spots[i];
      c = G[s[2]];
      for (y = -8; y <= 8; y++) {
        for (x = -8; x <= 8; x++) {
          d = x * x + y * y + ((x * 7 + y * 13 + i) % 5) * 4;        // bumpy edge
          if (d <= 60 && (d < 44 || (x + y) % 2 === 0)) {
            rect(ctx, (x < -1 && y < -1 && (x + y) % 2 === 0) ? G.q : (((x * 3 + y) % 4 === 0) ? G.v : c), s[0] + x, s[1] + y, 1, 1);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ timeline

  var BASE = { outfit: 'ready', armL: 'down', armR: 'down', eyes: 'happy', mouth: 'smile' };
  var TIMELINE = [
    { armL: 'waveMid', dur: 220 }, { armL: 'waveUp', mouth: 'open', dur: 220 },
    { armL: 'waveMid', dur: 220 }, { armL: 'waveUp', mouth: 'open', dur: 220 },
    { armL: 'waveMid', dur: 220 }, { armL: 'waveUp', mouth: 'open', dur: 220 },
    { armL: 'waveUp', mouth: 'open', hop: 3, rock: 1, dur: 180 },
    { armL: 'waveUp', dur: 180 },
    { armL: 'waveUp', mouth: 'open', hop: 3, rock: 1, dur: 180 },
    { dur: 400 }
  ];

  function place(st) {
    var p = {}, k, b, x, y, h;
    for (k in BASE) { if (BASE.hasOwnProperty(k)) { p[k] = BASE[k]; } }
    for (k in st) { if (st.hasOwnProperty(k) && p.hasOwnProperty(k)) { p[k] = st[k]; } }
    b = MR.character.bake(p);
    x = Math.round(CX - b.ax * S);
    y = Math.round(GROUND - b.ay * S - (st.hop || 0) * S);
    h = b.points['armR.hand'];
    return { img: b.canvas, x: x, y: y, hand: [x + h[0] * S, y + h[1] * S], rock: st.rock || 0 };
  }

  function init() {
    var back, front, fl, i;
    S = MR.config.END.KID_SCALE;
    back = MR.sprites.createCanvas(W, H);
    paintHouse(back.getContext('2d'));
    bgBack = back;
    front = MR.sprites.createCanvas(W, H);
    paintBushLeaves(front.getContext('2d'));
    bgFront = front;
    fl = MR.sprites.createCanvas(W, H);
    paintFlowers(fl.getContext('2d'));
    flowers = fl;
    bag = MR.sprites.buildSprite(BAG, P.bag);
    for (i = 0; i < TIMELINE.length; i++) {
      steps.push(place(TIMELINE[i]));
      stepDur.push(TIMELINE[i].dur * MR.config.END.TEMPO);
    }
  }

  // telescopic handle: two thin grey rods from the bag top to his hand
  function drawHandle(ctx, x0, y0, x1, y1) {
    var n = Math.max(1, Math.round(Math.abs(y1 - y0))), i, x, y, B = P.bag;
    for (i = 0; i <= n; i++) {
      x = Math.round(x0 + (x1 - x0) * i / n);
      y = Math.round(y0 + (y1 - y0) * i / n);
      rect(ctx, B.k, x - 1, y, 7, 1);
      rect(ctx, B.r, x, y, 2, 1);
      rect(ctx, B.r, x + 3, y, 2, 1);
    }
  }

  function render(ctx, clock) {
    var st = steps[MR.sprites.frameAt(stepDur, clock)], bx, by, sway = Math.floor(clock / 700) % 2;
    ctx.drawImage(bgBack, 0, 0);

    // bag on the floor to his right, handle up to his hand (rocks on the hops)
    bx = st.hand[0] + 8 - st.rock * BS;
    by = GROUND - bag.height * BS;
    drawHandle(ctx, bx + 4 * BS, by + st.rock * BS, st.hand[0] - 1, st.hand[1] + S);
    ctx.drawImage(bag, bx, by + st.rock * BS, bag.width * BS, bag.height * BS);

    ctx.drawImage(st.img, st.x, st.y, st.img.width * S, st.img.height * S);

    ctx.drawImage(bgFront, 0, 0);
    ctx.drawImage(flowers, sway, 0);                        // the flowers sway gently
  }

  MR.scenes.end = { init: init, render: render };
}());
