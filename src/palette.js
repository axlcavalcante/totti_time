// Mega Drive 9-bit palette helpers and all game colors. ES5 only.
var MR = window.MR = window.MR || {};

(function () {
  var LEVELS = [0, 36, 73, 109, 146, 182, 219, 255];

  function snapChannel(v) {
    var best = LEVELS[0], bestD = 999, i, d;
    for (i = 0; i < LEVELS.length; i++) {
      d = Math.abs(LEVELS[i] - v);
      if (d < bestD) { bestD = d; best = LEVELS[i]; }
    }
    return best;
  }

  // Returns a CSS color string snapped to the Mega Drive color space.
  function snap(r, g, b) {
    return 'rgb(' + snapChannel(r) + ',' + snapChannel(g) + ',' + snapChannel(b) + ')';
  }

  // Builds a { key: cssColor } map from { key: [r, g, b] }.
  function makeMap(src) {
    var out = {}, k;
    for (k in src) {
      if (src.hasOwnProperty(k)) { out[k] = snap(src[k][0], src[k][1], src[k][2]); }
    }
    return out;
  }

  // Merges several color maps into a new one (later maps win).
  function merge() {
    var out = {}, i, k, m;
    for (i = 0; i < arguments.length; i++) {
      m = arguments[i];
      for (k in m) { if (m.hasOwnProperty(k)) { out[k] = m[k]; } }
    }
    return out;
  }

  MR.palette = {
    LEVELS: LEVELS,
    snap: snap,
    makeMap: makeMap,
    merge: merge,

    UI: makeMap({
      bg:          [0, 36, 73],
      panel:       [36, 73, 109],
      panelLine:   [73, 109, 146],
      bevelLight:  [146, 182, 219],
      bevelDark:   [0, 0, 36],
      btnFace:     [73, 109, 182],
      btnPressed:  [36, 73, 146],
      btnDisabled: [73, 73, 109],
      startFace:   [36, 146, 36],
      startLight:  [146, 255, 146],
      startDark:   [0, 73, 0],
      startPress:  [0, 109, 0],
      stopFace:    [219, 36, 36],
      stopLight:   [255, 146, 146],
      stopDark:    [109, 0, 0],
      stopPress:   [146, 0, 0],
      barTrough:   [0, 0, 36],
      barGreen:    [36, 219, 36],
      barYellow:   [255, 219, 0],
      barOrange:   [255, 146, 0],
      barRed:      [255, 36, 36],
      floor:       [73, 73, 109],
      floorDark:   [36, 36, 73]
    }),

    // Font colors (keys usable in MR.font.draw)
    TEXT: makeMap({
      white:  [255, 255, 255],
      yellow: [255, 219, 0],
      dim:    [146, 146, 182],
      grey:   [109, 109, 146],
      black:  [0, 0, 36]
    }),

    // THE kid's body palette. Shared by every scene; never edit per scene.
    // Budget: 10 body keys + 5 clothing keys = 15 (one MD palette line).
    CHARACTER_BODY: makeMap({
      k: [36, 36, 73],     // outline, eyes
      s: [255, 219, 182],  // skin light
      S: [219, 182, 146],  // skin mid
      d: [182, 109, 109],  // skin shadow / mouth
      c: [255, 146, 146],  // rosy cheeks
      h: [255, 219, 109],  // hair blond highlight
      H: [219, 182, 73],   // hair golden
      b: [146, 109, 36],   // hair light brown (shadows)
      w: [255, 255, 255],  // undershirt / underwear / socks white
      W: [182, 182, 219]   // white shade
    }),

    // Clothing color sets. Clothing art uses only these keys:
    // a/A = top (t-shirt) main/shade, p/P = pants main/shade, n = shoes,
    // t/T = bath towel.
    // Socks are white (w/W) with an 'a' stripe so they match the top.
    OUTFIT_COLORS: {
      'default': makeMap({
        a: [219, 36, 36],
        A: [146, 0, 36],
        p: [36, 73, 182],
        P: [36, 36, 109],
        n: [219, 109, 0],
        t: [219, 73, 73],    // bath towel (same red as the shower towel)
        T: [146, 36, 36]
      }),
      blue: makeMap({
        a: [36, 146, 219],
        A: [36, 73, 146],
        p: [73, 73, 73],
        P: [36, 36, 36],
        n: [219, 109, 0],
        t: [219, 73, 73],
        T: [146, 36, 36]
      })
    },

    // Title-card lettering (MR.font.title): top -> bottom ramp, shine ramp.
    TITLE: {
      ramp: [snap(255, 255, 182), snap(255, 219, 36), snap(255, 146, 0), snap(219, 73, 0)],
      shine: [snap(255, 255, 255), snap(255, 255, 219), snap(255, 255, 146), snap(255, 219, 73)],
      highlight: snap(255, 255, 255),
      outline: snap(0, 0, 36),
      shadow: snap(73, 36, 109)
    },

    // "GAME OVER" lettering: same shape as TITLE, red ramp.
    TITLE_RED: {
      ramp: [snap(255, 182, 182), snap(255, 73, 73), snap(219, 0, 0), snap(146, 0, 36)],
      shine: [snap(255, 255, 255), snap(255, 219, 219), snap(255, 146, 146), snap(255, 73, 73)],
      highlight: snap(255, 255, 255),
      outline: snap(0, 0, 36),
      shadow: snap(36, 0, 36)
    },

    // Shared effect colors (tears, water drops): q light, Q mid, j deep.
    FX: makeMap({
      q: [182, 219, 255],
      Q: [109, 182, 255],
      j: [73, 146, 219],
      w: [255, 255, 255]
    }),

    // SHOWER scene. Each map is one Mega Drive palette line (<= 15 colors).
    SHOWER: {
      // walls, floor, tub, chrome
      room: makeMap({
        k: [36, 36, 73],     // outline
        w: [255, 255, 255],  // tile / enamel white
        v: [219, 219, 219],  // tile shade
        g: [146, 182, 182],  // grout
        G: [109, 146, 146],  // dark grout / floor lines
        E: [182, 219, 219],  // enamel shade
        D: [109, 146, 182],  // enamel dark
        c: [219, 219, 255],  // chrome light
        C: [146, 146, 182],  // chrome mid
        x: [73, 73, 109],    // chrome dark / nozzle holes
        t: [73, 146, 219],   // accent tile
        T: [36, 109, 182],   // accent tile shade
        f: [146, 146, 182],  // floor tile
        F: [109, 109, 146]   // floor tile dark
      }),
      // bottles, sponge, duck, towel
      props: makeMap({
        k: [36, 36, 73],
        w: [255, 255, 255],
        a: [219, 73, 146],   // shampoo pink
        A: [146, 36, 109],
        b: [73, 182, 109],   // bottle green
        B: [36, 109, 73],
        y: [255, 219, 73],   // sponge / duck yellow
        Y: [219, 146, 36],
        o: [255, 109, 0],    // duck beak
        r: [219, 73, 73],    // towel
        R: [146, 36, 36],
        c: [219, 219, 255],
        C: [146, 146, 182]
      }),
      // water, foam, bubbles, steam
      fx: makeMap({
        q: [182, 219, 255],  // water light
        Q: [109, 182, 255],  // water mid
        j: [73, 146, 219],   // water deep
        w: [255, 255, 255],
        W: [182, 182, 219],  // foam shade
        u: [146, 182, 219],  // bubble / foam outline
        s: [219, 219, 255]   // steam
      })
    },

    // DRESSING scene (bedroom). Each map is one palette line (<= 15 colors).
    DRESSING: {
      room: makeMap({
        k: [36, 36, 73],     // outline
        L: [182, 219, 255],  // wallpaper
        M: [146, 182, 219],  // wallpaper shade
        s: [255, 255, 219],  // wallpaper stars
        o: [182, 109, 36],   // wood
        O: [109, 73, 36],    // wood dark
        l: [219, 146, 73],   // wood light
        f: [182, 146, 109],  // floor planks
        F: [146, 109, 73],   // floor seams
        c: [109, 182, 255],  // sky in the window
        w: [255, 255, 255],
        u: [255, 182, 73],   // curtains
        U: [219, 146, 36],
        r: [219, 73, 109],   // rug
        R: [255, 146, 182]
      }),
      toys: makeMap({
        k: [36, 36, 73],
        w: [255, 255, 255],
        W: [182, 182, 219],  // pillow shade
        b: [73, 109, 219],   // blanket
        B: [109, 146, 255],
        r: [219, 73, 73],    // toy car, towel
        R: [146, 36, 36],
        x: [73, 73, 109],    // wheels, robot joints
        g: [146, 146, 182],  // robot
        G: [219, 219, 255],
        y: [255, 219, 73],   // ball, block
        Y: [219, 146, 36],
        t: [182, 109, 36],   // teddy bear
        T: [146, 73, 36],
        e: [73, 182, 73]     // block
      })
    },

    // BREAKFAST scene (kitchen). Each map is one palette line (<= 15 colors).
    BREAKFAST: {
      kitchen: makeMap({
        k: [36, 36, 73],
        y: [255, 219, 146],  // warm wall
        Y: [219, 182, 109],  // wall shade
        w: [255, 255, 255],  // tiles, window frame
        v: [219, 219, 219],  // tile shade
        g: [182, 182, 182],  // grout
        o: [182, 109, 36],   // wood (cabinets, chair)
        O: [109, 73, 36],
        l: [219, 146, 73],
        f: [182, 146, 109],  // floor
        F: [146, 109, 73],
        c: [255, 255, 219],  // clock face
        m: [146, 146, 182],  // metal knobs
        t: [73, 146, 73]     // plant leaves
      }),
      table: makeMap({
        k: [36, 36, 73],
        w: [255, 255, 255],  // cloth white, milk
        r: [255, 109, 109],  // cloth red (light)
        R: [219, 73, 73],
        b: [73, 109, 219],   // bowl
        B: [36, 73, 182],
        y: [255, 182, 36],   // cereal
        Y: [219, 109, 0],
        G: [219, 255, 255],  // glass
        g: [182, 182, 219],  // spoon
        x: [109, 109, 146],
        o: [182, 109, 36],   // table legs
        O: [109, 73, 36]
      })
    },

    // Window sky (MR.weather): gradient bands top -> bottom per time of day,
    // grey versions for bad weather, plus sun/moon/clouds/rain/snow colors.
    SKY: {
      bands: {
        night: [[0, 0, 36], [0, 0, 73], [0, 36, 73]],
        dawn: [[36, 36, 109], [109, 73, 146], [219, 109, 146], [255, 146, 73], [255, 219, 109]],
        day: [[73, 146, 255], [109, 182, 255], [146, 219, 255]],
        dusk: [[36, 36, 109], [146, 73, 146], [219, 73, 109], [255, 109, 36], [255, 182, 73]]
      },
      grey: {
        night: [[0, 0, 36], [36, 36, 73], [73, 73, 109]],
        dawn: [[73, 73, 109], [146, 109, 146], [182, 146, 146]],
        day: [[109, 109, 146], [146, 146, 182], [182, 182, 219]],
        dusk: [[73, 73, 109], [146, 109, 146], [182, 146, 146]]
      },
      c: makeMap({
        sun: [255, 255, 109], sunEdge: [255, 182, 36], moon: [255, 255, 182], star: [255, 255, 219],
        cloud: [255, 255, 255], cloudShade: [182, 182, 219], dark: [109, 109, 146], darkShade: [73, 73, 109],
        rain: [182, 219, 255], snow: [255, 255, 255], fog: [219, 219, 219], flash: [255, 255, 255]
      })
    },

    // Red alert: luminance -> red ramp (dark to light), used by
    // MR.sprites.makeRed (pre-rendered at init) and toRed (single colors).
    RED_RAMP: [[0, 0, 0], [73, 0, 0], [146, 0, 36], [219, 36, 36], [255, 109, 109], [255, 219, 219]]
  };

  function redFor(r, g, b) {
    var ramp = MR.palette.RED_RAMP, l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return ramp[Math.min(ramp.length - 1, Math.floor(l * ramp.length))];
  }

  // Maps one 'rgb(r,g,b)' color to its red-alert equivalent.
  function toRed(css) {
    var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(css), c;
    if (!m) { return css; }
    c = redFor(+m[1], +m[2], +m[3]);
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  MR.palette.redFor = redFor;
  MR.palette.toRed = toRed;
  MR.palette.UI_RED = (function () {
    var out = {}, k;
    for (k in MR.palette.UI) {
      if (MR.palette.UI.hasOwnProperty(k)) {
        // STOP and the bar fill are already red: keep them bright
        out[k] = (/^stop|^bar(?!Trough)/.test(k)) ? MR.palette.UI[k] : toRed(MR.palette.UI[k]);
      }
    }
    return out;
  }());
}());
