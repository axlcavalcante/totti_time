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
    // a/A = top (t-shirt) main/shade, p/P = pants main/shade, n = shoes.
    // Socks are white (w/W) with an 'a' stripe so they match the top.
    OUTFIT_COLORS: {
      'default': makeMap({
        a: [219, 36, 36],
        A: [146, 0, 36],
        p: [36, 73, 182],
        P: [36, 36, 109],
        n: [219, 109, 0]
      }),
      blue: makeMap({
        a: [36, 146, 219],
        A: [36, 73, 146],
        p: [73, 73, 73],
        P: [36, 36, 36],
        n: [219, 109, 0]
      })
    }

    // TODO(red alert): add a luminance -> red ramp mapping used by
    // MR.sprites to pre-render red variants at startup.
  };
}());
