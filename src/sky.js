// Live window sky shared by every scene with a window (bedroom, kitchen...).
// Reads MR.weather.sky(now) (Locmariaquer weather + time of day) and draws it
// into a window pane: pre-rendered gradient + sun/moon/stars (rebuilt only
// when the look changes), plus animated clouds, rain, snow and a gentle storm
// glow. ES5 only.
//
//   MR.sky.draw(ctx, pane, clock, red)   pane = { x, y, w, h } in scene px
var MR = window.MR = window.MR || {};

(function () {
  var SC = null, clouds = null, cache = {};      // cache[paneSize] = { key, img }

  var CLOUD = [
    '....aaaa........',
    '..aaaaaaaa.aaa..',
    '.aaaaaaaaaaaaaa.',
    'aaaaaaaaaaaaaaaa',
    'abbbbbbbbbbbbbba',
    '.bbbbbbbbbbbbbb.'];

  function setup() {
    if (clouds) { return; }
    SC = MR.palette.SKY.c;
    clouds = {
      white: MR.sprites.withRed(MR.sprites.buildSprite(CLOUD, { a: SC.cloud, b: SC.cloudShade })),
      dark: MR.sprites.withRed(MR.sprites.buildSprite(CLOUD, { a: SC.dark, b: SC.darkShade }))
    };
  }

  function css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function disc(ctx, cx, cy, r, color) {
    var x, y;
    ctx.fillStyle = color;
    for (y = -r; y <= r; y++) {
      for (x = -r; x <= r; x++) { if (x * x + y * y <= r * r + r) { ctx.fillRect(cx + x, cy + y, 1, 1); } }
    }
  }

  // Pre-renders one look (phase x weather) for a pane size. Only called when
  // the look changes (new data or a new phase), never every frame.
  function build(s, W, H) {
    var c = MR.sprites.createCanvas(W, H), ctx = c.getContext('2d'),
      bad = /overcast|rain|storm|snow|fog/.test(s.kind),
      bands = (bad ? MR.palette.SKY.grey : MR.palette.SKY.bands)[s.phase] || MR.palette.SKY.bands.day,
      bh = H / bands.length, fx = W / 54, fy = H / 54, x, y, b, sx, sy, i;
    for (y = 0; y < H; y++) {
      b = Math.min(bands.length - 1, Math.floor(y / bh));
      for (x = 0; x < W; x++) {
        // dithered band edges, Mega Drive style
        i = (b > 0 && y - b * bh < 2 && (x + y) % 2 === 0) ? b - 1 : b;
        ctx.fillStyle = css(bands[i]);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    if (!bad) {
      if (s.phase === 'night') {
        [[6, 6], [18, 14], [30, 4], [46, 20], [10, 28], [38, 34], [24, 24], [50, 8]].forEach(function (p) {
          ctx.fillStyle = SC.star;
          ctx.fillRect(Math.round(p[0] * fx), Math.round(p[1] * fy), 1, 1);
        });
        disc(ctx, Math.round(42 * fx), Math.round(11 * fy), 5, SC.moon);    // crescent moon
        disc(ctx, Math.round(42 * fx) + 2, Math.round(11 * fy) - 2, 4, css(bands[0]));
      } else if (s.phase === 'dawn') {
        disc(ctx, Math.round(14 * fx), H - 2, 7, SC.sunEdge);                // rising, bottom-left
        disc(ctx, Math.round(14 * fx), H - 2, 5, SC.sun);
      } else if (s.phase === 'dusk') {
        disc(ctx, Math.round(40 * fx), H - 2, 7, SC.sunEdge);                // setting, bottom-right
        disc(ctx, Math.round(40 * fx), H - 2, 5, SC.sun);
      } else {
        sx = Math.round(7 + s.sunPos * (W - 14));                           // arc across the pane
        sy = Math.round(H - 10 - Math.sin(s.sunPos * Math.PI) * (H - 20));
        disc(ctx, sx, sy, 6, SC.sunEdge);
        disc(ctx, sx, sy, 5, SC.sun);
      }
    }
    if (s.kind === 'fog') {                                                 // dithered haze
      ctx.fillStyle = SC.fog;
      for (y = 0; y < H; y++) {
        for (x = (y % 2); x < W; x += 2) { ctx.fillRect(x, y, 1, 1); }
      }
    }
    return MR.sprites.withRed(c);             // small canvas, only on a change
  }

  function draw(ctx, P, clock, red) {
    var s = MR.weather ? MR.weather.sky(new Date().getTime()) : { phase: 'day', kind: 'partly', sunPos: 0.5, key: 'd' },
      size = P.w + 'x' + P.h, entry, n, i, x, y, cl, k;
    setup();
    entry = cache[size];
    if (!entry || entry.key !== s.key) { entry = cache[size] = { key: s.key, img: build(s, P.w, P.h) }; }

    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y, P.w, P.h);
    ctx.clip();
    ctx.drawImage(red ? entry.img.red : entry.img, P.x, P.y);

    // clouds drifting slowly sideways
    n = { partly: 2, overcast: 4, rain: 4, storm: 4, snow: 3 }[s.kind] || 0;
    cl = (/rain|storm|overcast/.test(s.kind) || s.phase === 'night') ? clouds.dark : clouds.white;
    if (red) { cl = cl.red; }
    for (i = 0; i < n; i++) {
      x = P.x - 16 + ((clock * (0.004 + i * 0.002) + i * 23) % (P.w + 16));
      y = P.y + 4 + (i * 11) % Math.max(1, P.h - 24);
      ctx.drawImage(cl, Math.round(x), y);
    }
    // rain streaks / snowflakes
    if (s.kind === 'rain' || s.kind === 'storm') {
      ctx.fillStyle = red ? MR.palette.toRed(SC.rain) : SC.rain;
      for (i = 0; i < 16; i++) {
        x = P.x + ((i * 7 + clock * 0.03) % (P.w + 6)) - 3;
        y = P.y + ((i * 13 + clock * 0.12) % (P.h + 6)) - 3;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
        ctx.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 1);
      }
    } else if (s.kind === 'snow') {
      ctx.fillStyle = red ? MR.palette.toRed(SC.snow) : SC.snow;
      for (i = 0; i < 14; i++) {
        x = P.x + ((i * 9) % P.w) + Math.round(Math.sin(clock * 0.002 + i) * 2);
        y = P.y + ((i * 17 + clock * 0.02) % P.h);
        ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
    }
    // storm: a gentle, rare lightning glow (one smooth 400 ms pulse every
    // ~8 s of animation, far below the 3 flashes/s photosensitivity limit)
    if (s.kind === 'storm') {
      k = clock % 8000;
      if (k < 400) {
        ctx.globalAlpha = Math.sin(k / 400 * Math.PI) * 0.35;
        ctx.fillStyle = red ? MR.palette.toRed(SC.flash) : SC.flash;
        ctx.fillRect(P.x, P.y, P.w, P.h);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  MR.sky = { draw: draw };
}());
