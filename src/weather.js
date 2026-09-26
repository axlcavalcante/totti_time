// Live sky for the bedroom window: current weather + sunlight in Locmariaquer
// (MR.config.WEATHER) from Open-Meteo (free, no API key). ES5 only.
//
// OPTIONAL: the game never waits for it. The last answer is cached in
// localStorage; offline, sunrise/sunset are computed locally (NOAA sun
// equation) and the weather defaults to 'partly'. Only the fixed city
// coordinates are sent: no device location, nothing about the user.
// Uses XMLHttpRequest (no fetch/Promise on Chrome 30). All times are UTC.
var MR = window.MR = window.MR || {};

(function () {
  var cfg = MR.config.WEATHER, CACHE_KEY = 'MR.weather.v1', DAWN_MS = 45 * 60000;
  var data = null;          // { code, rise, set, at } (ms UTC)
  var override = {};        // dev: ?sky=rain&tod=dawn
  var sunCache = { day: -1, rise: 0, set: 0 };

  function now() { return new Date().getTime(); }

  // ---------------------------------------------------------------- sun
  // Sunrise / sunset (ms UTC) for the UTC day containing t, at the city.
  function sunTimes(t) {
    var rad = Math.PI / 180, lat = cfg.LAT * rad, J, n, Js, M, C, L, Jt, dec, cosW, w;
    J = t / 86400000 + 2440587.5;
    n = Math.round(J - 2451545.0 + 0.0008);
    Js = n - cfg.LON / 360;
    M = (357.5291 + 0.98560028 * Js) % 360;
    C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    L = (M + C + 180 + 102.9372) % 360;
    Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
    cosW = (Math.sin(-0.833 * rad) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
    w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
    return {
      rise: (Jt - w / 360 - 2440587.5) * 86400000,
      set: (Jt + w / 360 - 2440587.5) * 86400000
    };
  }

  function sunFor(t) {
    var day = Math.floor(t / 86400000), s;
    // today's API times are the most accurate; otherwise compute them
    if (data && Math.floor(data.rise / 86400000) === day) { return { rise: data.rise, set: data.set }; }
    if (sunCache.day !== day) {
      s = sunTimes(t);
      sunCache = { day: day, rise: s.rise, set: s.set };
    }
    return sunCache;
  }

  // ---------------------------------------------------------------- weather
  function kindFor(code) {
    if (code <= 1) { return 'clear'; }
    if (code === 2) { return 'partly'; }
    if (code === 3) { return 'overcast'; }
    if (code === 45 || code === 48) { return 'fog'; }
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) { return 'snow'; }
    if (code >= 95) { return 'storm'; }
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) { return 'rain'; }
    return 'partly';
  }

  // 'YYYY-MM-DDTHH:MM' in GMT -> ms UTC
  function parseUTC(iso) {
    var m = /(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(iso || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : 0;
  }

  function url(scheme) {
    return scheme + '://api.open-meteo.com/v1/forecast?latitude=' + cfg.LAT + '&longitude=' + cfg.LON +
      '&current=weather_code,is_day,cloud_cover&daily=sunrise,sunset&timezone=GMT&forecast_days=1';
  }

  function save() {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      var d = JSON.parse(window.localStorage.getItem(CACHE_KEY));
      if (d && typeof d.code === 'number' && typeof d.at === 'number') { data = d; }
    } catch (e) { /* no cache */ }
  }

  // Tries https first, then plain http (old KitKat devices may reject modern
  // HTTPS certificates; the game itself is served over plain HTTP).
  function request(schemes) {
    var xhr, done = false, timer;
    if (!schemes.length) { return; }
    function fail() {
      if (done) { return; }
      done = true;
      window.clearTimeout(timer);
      request(schemes.slice(1));
    }
    try {
      xhr = new XMLHttpRequest();
      xhr.open('GET', url(schemes[0]), true);
      xhr.onreadystatechange = function () {
        var r;
        if (xhr.readyState !== 4 || done) { return; }
        if (xhr.status !== 200) { fail(); return; }
        try {
          r = JSON.parse(xhr.responseText);
          data = {
            code: r.current.weather_code,
            rise: parseUTC(r.daily.sunrise[0]),
            set: parseUTC(r.daily.sunset[0]),
            at: now()
          };
          done = true;
          window.clearTimeout(timer);
          MR.weather.version++;
          save();
        } catch (e) { fail(); }
      };
      timer = window.setTimeout(function () { try { xhr.abort(); } catch (e) { /* ignore */ } fail(); }, cfg.TIMEOUT_MS);
      xhr.send(null);
    } catch (e) { fail(); }
  }

  function refresh() {
    if (!data || now() - data.at > cfg.REFRESH_MIN * 60000) { request(['https', 'http']); }
  }

  function start() {
    var s = window.location.search, m;
    m = /[?&]sky=(\w+)/.exec(s);
    if (m) { override.kind = m[1]; }
    m = /[?&]tod=(\w+)/.exec(s);
    if (m) { override.phase = m[1]; }
    load();
    refresh();
    window.setInterval(refresh, cfg.REFRESH_MIN * 60000);
  }

  // What the window should show at time t (ms UTC).
  function sky(t) {
    var sun = sunFor(t), phase, pos, kind;
    if (t < sun.rise - DAWN_MS) { phase = 'night'; }
    else if (t < sun.rise + DAWN_MS) { phase = 'dawn'; }
    else if (t < sun.set - DAWN_MS) { phase = 'day'; }
    else if (t < sun.set + DAWN_MS) { phase = 'dusk'; }
    else { phase = 'night'; }
    pos = Math.max(0, Math.min(1, (t - sun.rise) / (sun.set - sun.rise)));
    // weather older than 6 h is stale: fall back to a neutral sky
    kind = (data && t - data.at < 6 * 3600000) ? kindFor(data.code) : 'partly';
    if (override.phase) { phase = override.phase; pos = 0.5; }
    if (override.kind) { kind = override.kind; }
    return {
      phase: phase, kind: kind, sunPos: pos,
      key: phase + '|' + kind + '|' + (phase === 'day' ? Math.round(pos * 10) : 0)
    };
  }

  // Test mode: force a phase ('night'|'dawn'|'day'|'dusk') and/or a weather
  // kind; null = automatic (real data). Never saved.
  function setOverride(phase, kind) {
    override.phase = phase || null;
    override.kind = kind || null;
    MR.weather.version++;
  }

  MR.weather = {
    version: 0,
    start: start,
    setOverride: setOverride,
    getOverride: function () { return { phase: override.phase || null, kind: override.kind || null }; },
    sky: sky,
    sunTimes: sunTimes,
    kindFor: kindFor,
    data: function () { return data; }
  };
}());
