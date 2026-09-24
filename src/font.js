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

  MR.font = {
    CAP_H: GH,          // cap height at scale 1 (shadow adds 1px)
    ADVANCE: ADVANCE,
    init: init,
    measure: measure,
    draw: draw,
    drawCaps: drawCaps,
    drawCentered: drawCentered
  };
}());
