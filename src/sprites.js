// Sprite data -> cached canvases. Runs at startup only, never in the frame loop.
// ES5 only.
var MR = window.MR = window.MR || {};

(function () {
  function createCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
  }

  function setSmoothing(ctx, on) {
    ctx.imageSmoothingEnabled = on;
    ctx.webkitImageSmoothingEnabled = on;
    ctx.mozImageSmoothingEnabled = on;
  }

  // data: array of equal-length strings, one char per pixel ('.' = transparent).
  // colorMap: { key: cssColor }.
  function buildSprite(data, colorMap) {
    var h = data.length, w = 0, x, y, row, ch, color, c, ctx, runStart;
    for (y = 0; y < h; y++) { if (data[y].length > w) { w = data[y].length; } }
    c = createCanvas(w, h);
    ctx = c.getContext('2d');
    for (y = 0; y < h; y++) {
      row = data[y];
      x = 0;
      // Merge horizontal runs of the same color into one fillRect.
      while (x < row.length) {
        ch = row.charAt(x);
        if (ch === '.' || ch === ' ') { x++; continue; }
        runStart = x;
        while (x < row.length && row.charAt(x) === ch) { x++; }
        color = colorMap[ch];
        if (!color) {
          if (window.console) { console.warn('MR.sprites: no color for key "' + ch + '"'); }
          color = '#f0f';
        }
        ctx.fillStyle = color;
        ctx.fillRect(runStart, y, x - runStart, 1);
      }
    }
    return c;
  }

  // layers: [{ canvas, x, y }] drawn in order into a new w x h canvas.
  function compose(w, h, layers) {
    var c = createCanvas(w, h), ctx = c.getContext('2d'), i, l;
    for (i = 0; i < layers.length; i++) {
      l = layers[i];
      ctx.drawImage(l.canvas, l.x, l.y);
    }
    return c;
  }

  // Dev helper: counts distinct opaque colors in a canvas (startup/preview only).
  function countColors(canvas) {
    var ctx = canvas.getContext('2d'), d, seen = {}, n = 0, i, key;
    d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) { continue; }
      key = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
      if (!seen[key]) { seen[key] = true; n++; }
    }
    return n;
  }

  // Index of the current frame in a looping list of frame durations (ms).
  function frameAt(durations, clock) {
    var total = 0, i, t;
    for (i = 0; i < durations.length; i++) { total += durations[i]; }
    t = clock % total;
    for (i = 0; i < durations.length; i++) {
      if (t < durations[i]) { return i; }
      t -= durations[i];
    }
    return durations.length - 1;
  }

  MR.sprites = {
    frameAt: frameAt,
    createCanvas: createCanvas,
    setSmoothing: setSmoothing,
    buildSprite: buildSprite,
    compose: compose,
    countColors: countColors
  };
}());
