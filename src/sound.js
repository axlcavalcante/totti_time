// Notification sounds. ES5 only. Plays the audio FILES listed in
// config.SOUND.FILES (the sounds/ folder; replace them freely, see
// sounds/README.md). Nothing is synthesized here.
//
// Backends, feature-detected: Web Audio (AudioContext / webkitAudioContext,
// files fetched with XMLHttpRequest and decoded with the callback form of
// decodeAudioData), else one <audio> element per sound, else silence. A page
// opened from disk (file://) uses <audio> directly (Chrome blocks XHR there),
// and any sound Web Audio fails to load or decode falls back to <audio>.
// Audio only starts after a user tap (autoplay rules): main.js calls
// MR.sound.unlock() from every touch/mouse down/up. A sound problem must
// never break the timer, so everything is wrapped in try/catch.
var MR = window.MR = window.MR || {};

(function () {
  var cfg = MR.config.SOUND, STORE = 'MR.sound.v1';
  var ctx = null, buffers = {}, elements = {}, mode = 'none';
  var enabled = cfg.ENABLED, unlocked = false, loaded = false;

  function warn(msg) {
    try { if (window.console && console.warn) { console.warn('[sound] ' + msg); } } catch (e) { /* ignore */ }
  }

  function url(path) { return path + (path.indexOf('?') < 0 ? '?' : '&') + 'v=' + new Date().getTime(); }

  function readEnabled() {
    try {
      var v = window.localStorage.getItem(STORE);
      if (v === 'on') { enabled = true; } else if (v === 'off') { enabled = false; }
    } catch (e) { /* private mode: keep the default */ }
  }

  function setEnabled(on) {
    enabled = !!on;
    try { window.localStorage.setItem(STORE, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
  }

  function quiet(promiseLike) {
    // Newer Chrome returns a Promise from play()/resume(); swallow rejections.
    if (promiseLike && typeof promiseLike['catch'] === 'function') { promiseLike['catch'](function () {}); }
  }

  // ----- <audio> elements: the fallback for any sound Web Audio can't load
  // (page opened from disk as file://, where Chrome blocks XMLHttpRequest;
  // old WebViews without Web Audio; a file the decoder rejects)

  function makeElement(name, path) {
    var el;
    if (elements[name] || !window.Audio) { return; }
    el = new window.Audio();
    el.preload = 'auto';
    el.src = url(path);
    elements[name] = el;
  }

  function playElement(name) {
    var el = elements[name];
    el.primed = true;
    try { el.currentTime = 0; } catch (e) { /* not seekable yet */ }
    el.volume = cfg.VOLUME;
    quiet(el.play());
  }

  // Old Android wants one gesture per element: play/pause each at volume 0.
  function primeElements() {
    var name, el;
    for (name in elements) {
      if (elements.hasOwnProperty(name) && !elements[name].primed) {
        el = elements[name];
        el.primed = true;
        el.volume = 0;
        quiet(el.play());
        el.pause();
      }
    }
  }

  // ----- Web Audio

  function loadBuffer(name, path) {
    var xhr = new XMLHttpRequest();
    function fallback(why) {
      warn(path + ': ' + why + ', using <audio> instead');
      makeElement(name, path);
    }
    try {
      xhr.open('GET', url(path), true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function () {
        if ((xhr.status && xhr.status !== 200) || !xhr.response) { fallback('HTTP ' + xhr.status); return; }
        try {
          ctx.decodeAudioData(xhr.response,
            function (b) { buffers[name] = b; },
            function () { fallback('cannot decode (try WAV or MP3)'); });
        } catch (e) { fallback(e.message); }
      };
      xhr.onerror = function () { fallback('cannot load'); };
      xhr.send();
    } catch (e) { fallback(e.message); }
  }

  function playBuffer(name) {
    var src = ctx.createBufferSource(), gain;
    src.buffer = buffers[name];
    gain = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    gain.gain.value = cfg.VOLUME;
    src.connect(gain);
    gain.connect(ctx.destination);
    if (src.start) { src.start(0); } else { src.noteOn(0); }
  }

  // ----- public

  function load() {
    var AC = window.AudioContext || window.webkitAudioContext, name,
      fromDisk = window.location.protocol === 'file:';
    if (loaded) { return; }
    loaded = true;
    readEnabled();
    try {
      if (AC && !fromDisk) {
        ctx = new AC();
        mode = 'webaudio';
      } else if (window.Audio) {
        mode = 'element';
      }
      for (name in cfg.FILES) {
        if (cfg.FILES.hasOwnProperty(name)) {
          if (mode === 'webaudio') { loadBuffer(name, cfg.FILES[name]); }
          else if (mode === 'element') { makeElement(name, cfg.FILES[name]); }
        }
      }
    } catch (e) {
      warn('disabled: ' + e.message);
      mode = 'none';
    }
  }

  // Call from inside a user gesture. Cheap after the first success.
  function unlock() {
    var src;
    try {
      if (ctx) {
        if (ctx.state === 'suspended' && ctx.resume) { quiet(ctx.resume()); }
        if (!unlocked) {
          src = ctx.createBufferSource();           // 1-sample silent kick
          src.buffer = ctx.createBuffer(1, 1, 22050);
          src.connect(ctx.destination);
          if (src.start) { src.start(0); } else { src.noteOn(0); }
        }
      }
      unlocked = true;
      primeElements();                              // also fallbacks added later
    } catch (e) { warn('unlock: ' + e.message); }
  }

  // force: play even when sound is switched off (tools/sound-preview.html)
  function play(name, force) {
    if (!enabled && !force) { return; }
    try {
      if (buffers[name] && ctx) { playBuffer(name); } else if (elements[name]) { playElement(name); }
    } catch (e) { warn('play ' + name + ': ' + e.message); }
  }

  // Time cues for one scene timer: call every frame with its progress.
  // Plays only the latest cue crossed, once each (a stall past both = hurry).
  function cues() {
    var half = false, hurry = false;
    return {
      reset: function () { half = false; hurry = false; },
      update: function (p) {
        if (p >= 1) { return; }
        if (!hurry && p >= cfg.HURRY_AT) { hurry = true; half = true; MR.sound.play('hurry'); }
        else if (!half && p >= cfg.HALF_AT) { half = true; MR.sound.play('bells'); }
      }
    };
  }

  MR.sound = {
    load: load,
    unlock: unlock,
    play: play,
    cues: cues,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    // 'webaudio', 'element' or 'none' (+ which sounds fell back to <audio>)
    mode: function () {
      var n, fb = [];
      for (n in elements) { if (elements.hasOwnProperty(n) && mode === 'webaudio') { fb.push(n); } }
      return mode + (fb.length ? ' (<audio> for ' + fb.join(', ') + ')' : '');
    }
  };
}());
