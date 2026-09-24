// Bitmap pixel font, drawn from data (no web fonts). ES5 only.
// Glyph cell: 6 x 12 px = 5x7 caps + 3 accent rows above + 1 descender row
// below + 1px drop shadow on the right/bottom. Advance is 6 px.
var MR = window.MR = window.MR || {};

(function () {
  var GW = 5, GH = 7;              // glyph body size
  var TOP = 3;                     // rows reserved for accents
  var CELL_W = GW + 1, CELL_H = TOP + GH + 1 + 1;
  var ADVANCE = 6;

  var G = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
    ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
    '\'': ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....']
  };

  // Accent marks drawn in the TOP rows (last row stays empty as a gap).
  var ACCENTS = {
    acute: ['...#.', '..#..', '.....'],
    grave: ['.#...', '..#..', '.....'],
    circ:  ['..#..', '.#.#.', '.....']
  };
  var ACCENTED = {
    'É': ['E', 'acute'],  // É
    'È': ['E', 'grave'],  // È
    'Ê': ['E', 'circ'],   // Ê
    'À': ['A', 'grave'],  // À
    'Ô': ['O', 'circ'],   // Ô
    'Î': ['I', 'circ'],   // Î
    'Ù': ['U', 'grave'],  // Ù
    'Ç': ['C', 'cedilla'] // Ç
  };

  var order = [];     // glyph chars in atlas order
  var index = {};     // char -> atlas column
  var atlases = {};   // colorKey -> canvas

  // Returns the full CELL_W x CELL_H pattern ('#' body, 'x' shadow).
  function cellFor(ch) {
    var rows = [], y, x, body, top, acc, grid = [], out = [], line;
    if (ACCENTED[ch]) {
      body = G[ACCENTED[ch][0]];
      acc = ACCENTED[ch][1];
      top = acc === 'cedilla' ? ['.....', '.....', '.....'] : ACCENTS[acc];
    } else {
      body = G[ch];
      top = ['.....', '.....', '.....'];
    }
    for (y = 0; y < TOP; y++) { rows.push(top[y]); }
    for (y = 0; y < GH; y++) { rows.push(body[y]); }
    rows.push(acc === 'cedilla' ? '.##..' : '.....');
    rows.push('.....');
    for (y = 0; y < CELL_H; y++) {
      grid.push([]);
      for (x = 0; x < CELL_W; x++) {
        grid[y].push(x < GW && rows[y] && rows[y].charAt(x) === '#' ? '#' : '.');
      }
    }
    // Drop shadow 1px down-right, Mega Drive menu style.
    for (y = CELL_H - 2; y >= 0; y--) {
      for (x = CELL_W - 2; x >= 0; x--) {
        if (grid[y][x] === '#' && grid[y + 1][x + 1] === '.') { grid[y + 1][x + 1] = 'x'; }
      }
    }
    for (y = 0; y < CELL_H; y++) {
      line = '';
      for (x = 0; x < CELL_W; x++) { line += grid[y][x]; }
      out.push(line);
    }
    return out;
  }

  function init() {
    var ch, i, y, cells = [], rows = [], colors = MR.palette.TEXT, key;
    for (ch in G) { if (G.hasOwnProperty(ch)) { order.push(ch); } }
    for (ch in ACCENTED) { if (ACCENTED.hasOwnProperty(ch)) { order.push(ch); } }
    for (i = 0; i < order.length; i++) {
      index[order[i]] = i;
      cells.push(cellFor(order[i]));
    }
    for (y = 0; y < CELL_H; y++) {
      rows[y] = '';
      for (i = 0; i < cells.length; i++) { rows[y] += cells[i][y]; }
    }
    for (key in colors) {
      if (colors.hasOwnProperty(key)) {
        atlases[key] = MR.sprites.buildSprite(rows, { '#': colors[key], x: colors.black });
      }
    }
  }

  function measure(text, scale) {
    return String(text).length * ADVANCE * (scale || 1);
  }

  // Draws text with its cell's top-left at (x, y). Visible caps start at
  // y + TOP * scale; use capTop() to align by the caps instead.
  function draw(ctx, text, x, y, colorKey, scale) {
    var s = scale || 1, atlas = atlases[colorKey] || atlases.white, i, ch, col;
    text = String(text).toUpperCase();
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      col = index[ch];
      if (col === undefined) { col = index['?']; }
      if (ch !== ' ') {
        ctx.drawImage(atlas, col * CELL_W, 0, CELL_W, CELL_H,
          x + i * ADVANCE * s, y, CELL_W * s, CELL_H * s);
      }
    }
  }

  // Draws text so that the top of its capital letters sits at capY.
  function drawCaps(ctx, text, x, capY, colorKey, scale) {
    var s = scale || 1;
    draw(ctx, text, x, capY - TOP * s, colorKey, s);
  }

  function drawCentered(ctx, text, cx, capY, colorKey, scale) {
    drawCaps(ctx, text, Math.round(cx - measure(text, scale) / 2), capY, colorKey, scale);
  }

  // ------------------------------------------------------------ title font
  // Decorative Mega Drive "logo" lettering, derived from the same 5x7 glyphs
  // so every letter and accent matches: Scale2x (EPX, additive) upscale, bolder
  // strokes, vertical color ramp, top highlight, dark outline, drop shadow.
  // Glyphs are built lazily into cached canvases; drawing is drawImage only.
  //   size 'M': 1 Scale2x pass (caps 14 px)   size 'L': 2 passes (caps 28 px)
  var TITLE_SIZES = {
    M: { passes: 1, bold: 1, outline: 1, shadow: 1 },
    L: { passes: 2, bold: 2, outline: 2, shadow: 2 }
  };
  var titleCache = {};

  // Binary grid (1 = ink) of a glyph without its drop shadow: accents,
  // caps and descender rows, GW wide.
  function inkGrid(ch) {
    var cell = cellFor(index[ch] === undefined ? '?' : ch), out = [], x, y;
    for (y = 0; y < CELL_H - 1; y++) {
      out.push([]);
      for (x = 0; x < GW; x++) { out[y].push(cell[y].charAt(x) === '#' ? 1 : 0); }
    }
    return out;
  }

  function scale2x(g) {
    var h = g.length, w = g[0].length, out = [], x, y, P, A, B, C, D;
    function at(xx, yy) { return (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : g[yy][xx]; }
    for (y = 0; y < h * 2; y++) { out.push([]); for (x = 0; x < w * 2; x++) { out[y].push(0); } }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        P = g[y][x]; A = at(x, y - 1); B = at(x + 1, y); C = at(x - 1, y); D = at(x, y + 1);
        // Additive variant: only fills diagonal steps, never removes ink, so
        // square corners stay square (D must not turn into O).
        out[y * 2][x * 2] = P || ((C === A && C !== D && A !== B) ? A : 0);
        out[y * 2][x * 2 + 1] = P || ((A === B && A !== C && B !== D) ? B : 0);
        out[y * 2 + 1][x * 2] = P || ((D === C && D !== B && C !== A) ? C : 0);
        out[y * 2 + 1][x * 2 + 1] = P || ((B === D && B !== A && D !== C) ? D : 0);
      }
    }
    return out;
  }

  // Pads a grid by p on every side, widened by `bold` on the right.
  function pad(g, p, extraW) {
    var h = g.length, w = g[0].length, out = [], x, y;
    for (y = 0; y < h + p * 2; y++) {
      out.push([]);
      for (x = 0; x < w + p * 2 + extraW; x++) {
        out[y].push((y >= p && y < h + p && x >= p && x < w + p) ? g[y - p][x - p] : 0);
      }
    }
    return out;
  }

  function buildTitleGlyph(ch, sizeKey) {
    var sz = TITLE_SIZES[sizeKey], f = 1 << sz.passes, g = inkGrid(ch), i, x, y, dx,
      o = sz.outline, sh = sz.shadow, P = o, h, w, ink, rows = [], row, capTop, capH, band,
      data, normal, shine, v, T = MR.palette.TITLE;
    for (i = 0; i < sz.passes; i++) { g = scale2x(g); }
    // room for outline around, shadow bottom-right, bold on the right
    g = pad(g, P, sh + sz.bold);
    h = g.length; w = g[0].length;
    ink = [];
    for (y = 0; y < h; y++) {                          // bolden: smear right
      ink.push([]);
      for (x = 0; x < w; x++) {
        v = 0;
        for (dx = 0; dx <= sz.bold; dx++) { if (x - dx >= 0 && g[y][x - dx]) { v = 1; } }
        ink[y].push(v);
      }
    }
    function isInk(xx, yy) { return xx >= 0 && yy >= 0 && xx < w && yy < h && ink[yy][xx] === 1; }
    function near(xx, yy, r) {
      var ax, ay;
      for (ay = -r; ay <= r; ay++) { for (ax = -r; ax <= r; ax++) { if (isInk(xx + ax, yy + ay)) { return true; } } }
      return false;
    }
    capTop = P + TOP * f;
    capH = GH * f;
    for (y = 0; y < h; y++) {
      row = '';
      for (x = 0; x < w; x++) {
        if (isInk(x, y)) {
          if (!isInk(x, y - 1)) { row += 'h'; continue; }       // top highlight
          band = Math.floor((y - capTop) / capH * 4);
          row += String(Math.max(1, Math.min(4, band + 1)));
        } else if (near(x, y, o)) {
          row += 'o';
        } else if (near(x - sh, y - sh, o)) {
          row += 'x';
        } else {
          row += '.';
        }
      }
      rows.push(row);
    }
    data = rows;
    normal = MR.sprites.buildSprite(data, { h: T.highlight, 1: T.ramp[0], 2: T.ramp[1], 3: T.ramp[2], 4: T.ramp[3], o: T.outline, x: T.shadow });
    shine = MR.sprites.buildSprite(data, { h: T.highlight, 1: T.shine[0], 2: T.shine[1], 3: T.shine[2], 4: T.shine[3], o: T.outline, x: T.shadow });
    return {
      normal: normal, shine: shine,
      capOffset: capTop,                                // canvas y of the cap top
      advance: GW * f + sz.bold + o + 1
    };
  }
  function titleGlyph(ch, sizeKey) {
    var key = sizeKey + ch;
    if (!titleCache[key]) { titleCache[key] = buildTitleGlyph(ch, sizeKey); }
    return titleCache[key];
  }

  function titleAdvance(ch, sizeKey) {
    var a = titleGlyph('A', sizeKey).advance;
    return ch === ' ' ? Math.round(a * 0.6) : a;
  }

  // Visible width of a line (last glyph counts its full canvas width).
  function titleMeasure(text, sizeKey) {
    var w = 0, i;
    text = String(text).toUpperCase();
    for (i = 0; i < text.length - 1; i++) { w += titleAdvance(text.charAt(i), sizeKey); }
    return text.length ? w + titleGlyph(text.charAt(text.length - 1), sizeKey).normal.width : 0;
  }

  function titleCapH(sizeKey) { return GH * (1 << TITLE_SIZES[sizeKey].passes); }

  // Chooses big 'L' lettering on one line, or split into two balanced lines
  // (e.g. "L'HEURE / DU BAIN"), if it fits maxW; otherwise one line of 'M'.
  // Returns { size, lines }.
  function titleLayout(text, maxW) {
    var up = String(text).toUpperCase(), words = up.split(' '), best = null, bestW = 1e9,
      i, l1, l2, w;
    if (titleMeasure(up, 'L') <= maxW) { return { size: 'L', lines: [up] }; }
    for (i = 1; i < words.length; i++) {
      l1 = words.slice(0, i).join(' ');
      l2 = words.slice(i).join(' ');
      w = Math.max(titleMeasure(l1, 'L'), titleMeasure(l2, 'L'));
      if (w <= maxW && w < bestW) { bestW = w; best = [l1, l2]; }
    }
    if (best) { return { size: 'L', lines: best }; }
    return { size: 'M', lines: [up] };
  }

  // Draws one line with its cap top at capY. letter(i) may return
  // { hidden, dy, shine } per character index (spaces included).
  function titleDraw(ctx, text, x, capY, sizeKey, letter) {
    var i, ch, g, opt;
    text = String(text).toUpperCase();
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      opt = letter ? letter(i) : null;
      if (ch !== ' ' && !(opt && opt.hidden)) {
        g = titleGlyph(ch, sizeKey);
        ctx.drawImage(opt && opt.shine ? g.shine : g.normal, x, capY - g.capOffset + (opt && opt.dy ? Math.round(opt.dy) : 0));
      }
      x += titleAdvance(ch, sizeKey);
    }
  }

  MR.font = {
    CAP_H: GH,          // cap height at scale 1 (shadow adds 1px)
    ADVANCE: ADVANCE,
    init: init,
    measure: measure,
    draw: draw,
    drawCaps: drawCaps,
    drawCentered: drawCentered,
    title: {
      layout: titleLayout,
      measure: titleMeasure,
      advance: titleAdvance,
      capH: titleCapH,
      draw: titleDraw
    }
  };
}());
