// THE kid. All body parts, expressions and outfits live here and nowhere else.
// Scenes compose poses from these parts; they never draw the kid themselves.
// ES5 only.
//
// Model
// -----
// * Body base parts (legs, feet, torso, arms, head, eyes, mouth, hair) are the
//   kid himself. The base torso/legs already wear the undershirt and underwear
//   shorts, so a missing clothing overlay can never leave him unclothed.
// * Clothing overlays (CLOTHES.<item>.<slot>.<variant>) are drawn right on top
//   of the matching base part, with the same size and pivot. New clothes =
//   new overlay data; recolored clothes = a new OUTFIT_COLORS set in palette.js.
// * Parts hang off a small rig: each part has a pivot (its own attach pixel)
//   and named points where children attach. The root is `legs`; its `ground`
//   point is the spot between the feet, which is the pose's anchor.
// * bake(pose) composes a pose into ONE cached canvas at startup, so drawing a
//   character frame at runtime is a single drawImage.
//
// Palette keys (see MR.palette.CHARACTER_BODY / OUTFIT_COLORS):
//   k outline/eyes, s/S/d skin light/mid/shadow, c cheeks,
//   h/H/b hair blond/golden/light brown, w/W white/white shade,
//   a/A top main/shade, p/P pants main/shade, n shoes.
var MR = window.MR = window.MR || {};

(function () {
  // Returns an array of n copies of str (keeps big data blocks readable).
  function rep(n, str) {
    var out = [], i;
    for (i = 0; i < n; i++) { out.push(str); }
    return out;
  }
  function rows() {
    var out = [], i;
    for (i = 0; i < arguments.length; i++) { out = out.concat(arguments[i]); }
    return out;
  }
  // Horizontal flip, for left/right arm pairs.
  function mirror(data) {
    var out = [], i;
    for (i = 0; i < data.length; i++) { out.push(data[i].split('').reverse().join('')); }
    return out;
  }

  // Scrubbing arm (screen-left): elbow out, hand on top of the head.
  // Pivot is the shoulder at the bottom. A/B differ only in the hand so the
  // two frames read as rubbing.
  var SCRUB_FOREARM = [
    '.....kssk....',
    '....kssk.....',
    '...kssk......',
    '..kssk.......',
    '.kssk........',
    'kssk.........',
    'kssk.........',
    '.kssk........',
    '.kssk........',
    '..kssk.......',
    '..kssk.......',
    '...kssk......',
    '...kssk......',
    '....ksssk....',
    '.....kkkk....'];
  var SCRUB_A = rows(['........kkkk.', '.......kssssk', '.......ksssSk', '......kssSkk.'], SCRUB_FOREARM);
  var SCRUB_B = rows(['......kkkk...', '.....kssssk..', '.....ksssSk..', '......kssk...'], SCRUB_FOREARM);

  // Clapping (screen-left arm): upper arm down the side, forearm up to the
  // chest. Pivot = shoulder at the top. Closed: hands meet at the center.
  var CLAP_OPEN = [
    '.kk......',
    'kssk.kk..',
    'ksskkssk.',
    'ksskkssk.',
    'ksskkssk.',
    'kssksssk.',
    'ksssssk..',
    'kssssk...',
    '.kkkk....'];
  var CLAP_CLOSED = [
    '.kk......',
    'kssk.....',
    'kssk..kkk',
    'kssk.kssk',
    'kssk.kssk',
    'ksskkssk.',
    'ksssssk..',
    'kssssk...',
    '.kkkk....'];
  // Raised arm (screen-right), shared with the wave; mirrored for the left.
  var WAVE_UP = rows(
    ['..kkkk.',
     '.kssssk',
     '.ksssSk',
     '..kssk.',
     '..kssk.',
     '.kssk..',
     '.kssk..'],
    rep(6, 'kssk...'),
    ['kkk....']);
  var WAVE_MID = [
    '....kkk.',
    '...kssSk',
    '...kssSk',
    '...kssk.',
    '..kssk..',
    '..kssk..',
    '.kssk...',
    '.kssk...',
    'kssk....',
    'kssk....',
    'kkk.....'];
  var SLEEVE_CLAP = rows(['.kk......', 'kaak.....', 'kaAk.....', 'kkkk.....'], rep(5, '.........'));
  var SLEEVE_WAVE_UP = rows(rep(10, '.......'), ['kkkk...', 'kaAk...', 'kaAk...', 'kkk....']);
  var SLEEVE_WAVE_MID = rows(rep(7, '........'), ['.kkkk...', 'kaAk....', 'kaAk....', 'kkk.....']);

  // Hands at the waist, in front of the body (holding pants, a waistband...).
  var HOLD_LOW = [
    '..kk...',
    '.ksk...',
    'kssk...',
    'kssk...',
    'kssk...',
    'kssk...',
    'ksssk..',
    '.kssk..',
    '..ksskk',
    '...kssk',
    '....kk.'];
  // Seated, reaching down to a lifted foot (putting on socks).
  var REACH_DOWN = rows(['..kk.', '.ksk.'], rep(6, 'kssk.'), rep(6, '.kssk'), ['.ksSk', '.kssk', '..kk.']);
  var SLEEVE_HOLD_LOW = rows(['..kk...', '.kak...', 'kaak...', 'kAak...', 'kkkk...'], rep(6, '.......'));
  var SLEEVE_REACH = rows(['..kk.', '.kak.', 'kaak.', 'kAak.', 'kkkk.'], rep(12, '.....'));

  var FEET_LIFT_R = [
    '.........ksssSk.',
    '.........kssssSk',
    '..........kkkkk.',
    '.ksssSk.........',
    'kssssSk.........',
    '.kkkkk..........'];

  // Socks overlay built from a feet sprite: skin -> white sock with a stripe
  // in the t-shirt color. side 'left' keeps only the left foot (cols 0-7).
  function socksFor(data, side) {
    return data.map(function (row) {
      var r = row.replace(/kssssSk/g, 'kwwwwWk').replace(/ksssSk/g, 'kaaaAk'), out = '', c;
      for (c = 0; c < r.length; c++) {
        out += (side === 'left' && c >= 8) ? '.' : (/[kaAwW]/.test(r.charAt(c)) ? r.charAt(c) : '.');
      }
      return out;
    });
  }

  // Screen-left arm bringing something to his mouth (glass / spoon): elbow
  // out, forearm up across the chest. Pivot = shoulder. Mirrored for armR.
  var TO_MOUTH = [
    '........kkk.',
    '.......ksssk',
    '.......kssSk',
    '......kssk..',
    '.....kssk...',
    '....kssk....',
    '...kssskkk..',
    '..kssssssk..',
    '.kssSSSSk...',
    '.kssk.......',
    '..kk........'];
  var SLEEVE_TO_MOUTH = rows(rep(6, '............'),
    ['......kkkk..',
     '.....kaaak..',
     '....kaAAk...'],
    rep(2, '............'));
  // Hand at the top of the chest (spoon on its way up).
  var SPOON_MID = [
    '........kkk.',
    '.......ksssk',
    '......kkssSk',
    '...kkksssk..',
    '..ksssssk...',
    '.kssSSkk....',
    '.kssk.......',
    '..kk........'];
  var SLEEVE_SPOON_MID = rows(rep(2, '............'),
    ['......kk....',
     '.....kaak...',
     '....kaAk....'],
    rep(3, '............'));

  // ---------------------------------------------------------------- body parts
  var PARTS = {
    legs: {
      // 14x13, underwear shorts + bare legs
      stand: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 13], ground: [7, 16] },
        data: rows(
          ['kWWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWkkWWWWWk',
           'kwWWWk..kWWWWk',
           'kkkkkk..kkkkkk'],
          rep(7, 'ksssSk..ksssSk'))
      },
      // Hopping on the left foot, right knee raised (feet 'hop').
      hop: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 10], ground: [7, 16] },
        data: rows(
          ['kWWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWkkWWWWWk',
           'kwWWWk..kWWWWk',
           'kkkkkk..kkkkkk'],
          rep(4, 'ksssSk..ksssSk'),
          rep(3, 'ksssSk........'))
      },
      // Seated, front view: thighs foreshortened, shins down (feet 'bare').
      sit: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 10], ground: [7, 13] },
        data: rows(
          ['kWWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWkkWWWWWk',
           'kkkkkk..kkkkkk'],
          rep(6, 'ksssSk..ksssSk'))
      },
      // Seated with the left / right foot lifted (feet 'liftL' / 'liftR').
      sitLiftL: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 7], ground: [7, 13] },
        data: rows(
          ['kWWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWkkWWWWWk',
           'kkkkkk..kkkkkk'],
          rep(3, 'ksssSk..ksssSk'),
          rep(3, '........ksssSk'))
      },
      sitLiftR: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 7], ground: [7, 13] },
        data: rows(
          ['kWWWWWWWWWWWWk',
           'kwWWWWWWWWWWWk',
           'kwWWWWkkWWWWWk',
           'kkkkkk..kkkkkk'],
          rep(3, 'ksssSk..ksssSk'),
          rep(3, 'ksssSk........'))
      },
      // Front-view squat (putting on shoes): knees out, short, feet 'bare'.
      crouch: {
        pivot: [9, 0],
        points: { hips: [9, 0], feet: [2, 7], ground: [9, 10] },
        data: ['..kWWWWWWWWWWWWk..',
               '.kwWWWWkkkkWWWWWk.',
               'kkkkkk......kkkkkk',
               'ksssSk......ksssSk',
               '.ksssSk....ksssSk.',
               '..ksssSk..ksssSk..',
               '..ksssSk..ksssSk..']
      },
      // Transparent, same rig points: for shots where the legs are out of
      // frame (bath, close-ups). Keeps the rig root and ground anchor.
      hidden: {
        pivot: [7, 0],
        points: { hips: [7, 0], feet: [0, 13], ground: [7, 16] },
        data: rep(13, '..............')
      }
    },

    feet: {
      // 16x3, both feet in one sprite
      bare: {
        pivot: [1, 0],
        data: ['.ksssSk..ksssSk.',
               'kssssSk..kssssSk',
               '.kkkkk....kkkkk.']
      },
      // 16x6: one foot 3 rows higher (right: hop / liftR, left: liftL)
      hop: {
        pivot: [1, 0],
        data: FEET_LIFT_R
      },
      liftR: {
        pivot: [1, 0],
        data: FEET_LIFT_R
      },
      liftL: {
        pivot: [1, 0],
        data: ['.ksssSk.........',
               'kssssSk.........',
               '.kkkkk..........',
               '.........ksssSk.',
               '.........kssssSk',
               '..........kkkkk.']
      }
    },

    torso: {
      // 14x13, white undershirt
      vest: {
        pivot: [7, 12],
        points: { neck: [7, 0], shoulderL: [0, 2], shoulderR: [13, 2] },
        data: rows(
          ['.....kssk.....',
           '..kkkwssWkkk..',
           '.kwwwwwwwwwWk.'],
          rep(7, 'kwwwwwwwwwwWWk'),
          ['kwwwwwwwwwWWWk',
           'kWWWWWWWWWWWWk',
           'kkkkkkkkkkkkkk'])
      },
      // Bare chest (bath / getting dressed, before the t-shirt). Same shape
      // and points as 'vest'. Below the waist the base shorts always stay on.
      bare: {
        pivot: [7, 12],
        points: { neck: [7, 0], shoulderL: [0, 2], shoulderR: [13, 2] },
        data: rows(
          ['.....kssk.....',
           '..kkssssSSkk..',
           '.kssssssssSSk.'],
          rep(9, 'ksssssssssSSSk'),
          ['kkkkkkkkkkkkkk'])
      },
      // Bath/shower: ONLY neck and shoulders exist; every row below is
      // transparent, so nothing more can ever show (modesty rule). The scene
      // must still hide row 5 and below behind the tub.
      bath: {
        pivot: [7, 12],
        points: { neck: [7, 0], shoulderL: [0, 2], shoulderR: [13, 2] },
        data: rows(
          ['.....kssk.....',
           '..kkssssSSkk..',
           '.kssssssssSSk.',
           'ksssssssssSSSk',
           'ksssssssssSSSk',
           'ksssssssssSSSk',
           'ksssssssssSSSk'],
          rep(6, '..............'))
      }
    },

    // Screen-left arm (the kid's right arm), front view.
    armL: {
      down: {
        pivot: [3, 0],
        data: rows(['..kk', '.ksk'], rep(8, 'kssk'), ['ksSk', 'kssk', '.kk.'])
      },
      // Draw these with ORDER_ARMS_FRONT so the hands sit on the hair.
      scrubA: { pivot: [6, 18], data: SCRUB_A },
      scrubB: { pivot: [6, 18], data: SCRUB_B },
      waveUp: { pivot: [6, 13], data: mirror(WAVE_UP) },
      waveMid: { pivot: [7, 10], data: mirror(WAVE_MID) },
      clapOpen: { pivot: [2, 0], data: CLAP_OPEN },
      clapClosed: { pivot: [2, 0], data: CLAP_CLOSED },
      holdLow: { pivot: [3, 0], data: HOLD_LOW },
      reachDown: { pivot: [3, 0], data: REACH_DOWN },
      toMouth: { pivot: [8, 7], data: TO_MOUTH },
      spoonMid: { pivot: [8, 3], data: SPOON_MID }
    },

    // Screen-right arm, front view.
    armR: {
      down: {
        pivot: [0, 0],
        data: rows(['kk..', 'ksk.'], rep(8, 'ksSk'), ['ksSk', 'kssk', '.kk.'])
      },
      waveUp: { pivot: [0, 13], data: WAVE_UP },
      waveMid: { pivot: [0, 10], data: WAVE_MID },
      clapOpen: { pivot: [6, 0], data: mirror(CLAP_OPEN) },
      clapClosed: { pivot: [6, 0], data: mirror(CLAP_CLOSED) },
      scrubA: { pivot: [6, 18], data: mirror(SCRUB_A) },
      scrubB: { pivot: [6, 18], data: mirror(SCRUB_B) },
      holdLow: { pivot: [3, 0], data: mirror(HOLD_LOW) },
      reachDown: { pivot: [1, 0], data: mirror(REACH_DOWN) },
      toMouth: { pivot: [3, 7], data: mirror(TO_MOUTH) },
      spoonMid: { pivot: [3, 3], data: mirror(SPOON_MID) }
    },

    head: {
      // 16x15, face with ears and rosy cheeks. Eyes/mouth/hair are separate.
      base: {
        pivot: [8, 15],
        // crown = hair attach (top-left); top = top-center, for scene props
        points: { eyes: [5, 7], mouth: [6, 11], crown: [0, 0], top: [8, 0] },
        data: rows(
          ['....kkkkkkkk....',
           '...kssssssssk...'],
          rep(4, '..kssssssssSSk..'),
          ['.kkssssssssSSkk.',
           'kskssssssssSSkSk',
           'kSkssssssssSSkSk',
           '.kkssssssssSSkk.',
           '..ksccssssccSk..',
           '..kssssssssSSk..',
           '...kssssssSSk...',
           '....kksssSkk....',
           '......kkkk......'])
      },
      // Chewing: cheeks bulge 1 px out (rows 10-13) and get rosier. Same
      // size and points as 'base', so eyes, mouth and hair attach unchanged.
      puff: {
        pivot: [8, 15],
        points: { eyes: [5, 7], mouth: [6, 11], crown: [0, 0], top: [8, 0] },
        data: rows(
          ['....kkkkkkkk....',
           '...kssssssssk...'],
          rep(4, '..kssssssssSSk..'),
          ['.kkssssssssSSkk.',
           'kskssssssssSSkSk',
           'kSkssssssssSSkSk',
           '.kkssssssssSSkk.',
           '.kscccsssscccSk.',
           '.ksccssssssccSk.',
           '..kssssssssSSk..',
           '...kkssssSSkk...',
           '.....kkkkkk.....'])
      }
    },

    eyes: {
      open:   { pivot: [0, 0], data: ['wk..wk', 'kk..kk', 'kk..kk'] },
      closed: { pivot: [0, 0], data: ['......', 'kk..kk', '......'] },
      // ^ ^ (8 wide, so pivot shifts one px left to stay centered)
      happy:  { pivot: [1, 0], data: ['.k....k.', 'k.k..k.k', '........'] },
      // wide-open, small pupils: red alert / time almost up
      worried: { pivot: [1, 0], data: ['kkk..kkk', 'wkw..wkw', '.w....w.'] },
      // crying: sad brows (inner ends raised, "/ \") above ">  <" eyes shut
      // tight; B is the flatter sob frame. Pivot [1, 1]: brows sit one row up.
      cryA: { pivot: [1, 1], data: ['..k..k..', 'kk....kk', '..k..k..', 'kk....kk'] },
      cryB: { pivot: [1, 1], data: ['..k..k..', '........', 'kkk..kkk', '........'] }
    },

    mouth: {
      smile: { pivot: [0, 0], data: ['k..k', '.kk.'] },
      open:  { pivot: [0, 0], data: ['kkkk', 'kddk', '.kk.'] },
      worried: { pivot: [0, 0], data: ['.kk.', 'kddk', '.kk.'] },
      // crying wail (wide open, tongue) and a smaller trembling frame
      wailA: { pivot: [1, 0], data: ['.kkkk.', 'kddddk', '.kcck.'] },
      wailB: { pivot: [1, 0], data: ['......', '.kkkk.', '.kddk.'] },
      // chewing (lips pressed / small open) and a milk mustache after a sip
      chewA: { pivot: [0, 0], data: ['kkkk', '....'] },
      chewB: { pivot: [0, 0], data: ['.kk.', '.kk.'] },
      milky: { pivot: [1, 0], data: ['wwwwww', '.k..k.', '..kk..'] },
      // brushing (open, white teeth) and a small pursed mouth to spit
      brush: { pivot: [1, 0], data: ['kkkkkk', 'kwwwwk', '.kddk.'] },
      spit:  { pivot: [0, 0], data: ['....', '.kk.', '.kk.'] }
    },

    hair: {
      // 16x9, blond -> golden -> light brown ramp. Row 3 sits on head row 0.
      dry: {
        pivot: [0, 3],
        data: ['.....kkkkkk.....',
               '...kkhhhhhhkk...',
               '..khhhhhhhhhHk..',
               '.khhhhhhhhhhHHk.',
               '.khhhhhhhhhHHHk.',
               'khhHhhhhhhHHHbbk',
               'khHHhhHhhHHHbbbk',
               'kHb.HHb.HHb.Hbbk',
               'kbk.bk..kb..kbbk']
      },
      // Wet: darker (golden/brown), flattened, strands and drips.
      wet: {
        pivot: [0, 3],
        data: ['................',
               '....kkkkkkkk....',
               '..kkHHHHhhHHkk..',
               '.kHHHHHhhHHHHbk.',
               '.kHHHHHHHHHHbbk.',
               'kbHHHHHHHHHHbbbk',
               'kbHbHHbHHbHHbbbk',
               'kbk.bHk.kbHk.bbk',
               '..k..k...k...k..']
      }
    }
  };

  // `hand` point of every arm variant (kid pixels inside the arm sprite), so
  // scenes can put props in his hands (pants, shirt, sock, spoon...).
  (function () {
    var HANDS = {
      armL: { down: [2, 11], waveUp: [3, 1], waveMid: [2, 1], clapOpen: [6, 3], clapClosed: [7, 3],
        scrubA: [9, 1], scrubB: [7, 1], holdLow: [5, 9], reachDown: [2, 15], toMouth: [9, 1], spoonMid: [9, 1] },
      armR: { down: [1, 11], waveUp: [3, 1], waveMid: [5, 1], clapOpen: [2, 3], clapClosed: [1, 3],
        scrubA: [3, 1], scrubB: [5, 1], holdLow: [1, 9], reachDown: [2, 15], toMouth: [2, 1], spoonMid: [2, 1] }
    }, side, v;
    for (side in HANDS) {
      for (v in HANDS[side]) { PARTS[side][v].points = { hand: HANDS[side][v] }; }
    }
  }());

  // ------------------------------------------------------- clothing overlays
  // Same size and pivot as the base part variant they cover. '.' lets the
  // base part show through.
  var CLOTHES = {
    tshirt: {
      torso: {
        vest: rows(
          ['..............',
           '.kaaaksskaaak.',
           'kaaaaakkaaaaAk',
           'kaaaaaaaaaaAAk',
           'kaaaaahhaaaAAk',   // little star on the chest
           'kaaaahhhhaaAAk',
           'kaaaaahhaaaAAk'],
          rep(3, 'kaaaaaaaaaaAAk'),
          ['kaaaaaaaaaAAAk',
           'kAAAAAAAAAAAAk',
           'kkkkkkkkkkkkkk'])
      },
      armL: {
        down: rows(['..kk', '.kak', 'kaak', 'kAak', 'kkkk'], rep(8, '....')),
        waveUp: mirror(SLEEVE_WAVE_UP),
        waveMid: mirror(SLEEVE_WAVE_MID),
        clapOpen: SLEEVE_CLAP,
        clapClosed: SLEEVE_CLAP,
        holdLow: SLEEVE_HOLD_LOW,
        reachDown: SLEEVE_REACH,
        toMouth: SLEEVE_TO_MOUTH,
        spoonMid: SLEEVE_SPOON_MID
      },
      armR: {
        down: rows(['kk..', 'kak.', 'kaAk', 'kaAk', 'kkkk'], rep(8, '....')),
        waveUp: SLEEVE_WAVE_UP,
        waveMid: SLEEVE_WAVE_MID,
        clapOpen: mirror(SLEEVE_CLAP),
        clapClosed: mirror(SLEEVE_CLAP),
        holdLow: mirror(SLEEVE_HOLD_LOW),
        reachDown: mirror(SLEEVE_REACH),
        toMouth: mirror(SLEEVE_TO_MOUTH),
        spoonMid: mirror(SLEEVE_SPOON_MID)
      }
    },

    // T-shirt half on: head through, bunched at the chest, sleeves on the
    // raised arms (the undershirt still shows below).
    tshirtRolled: {
      torso: {
        vest: rows(
          ['..............',
           '.kaaaksskaaak.',
           'kaaaaakkaaaaAk',
           'kaaaaaaaaaaAAk',
           'kAAAAAAAAAAAAk',
           'kkkkkkkkkkkkkk'],
          rep(7, '..............'))
      },
      armL: { waveUp: mirror(SLEEVE_WAVE_UP) },
      armR: { waveUp: SLEEVE_WAVE_UP }
    },

    // Bath towel around the waist, down to the knees (opaque, over the base
    // underwear shorts): used while he pulls his underwear on under it. The
    // top row is a tucked fold; the torso stays uncovered.
    towelWrap: {
      legs: {
        stand: rows(
          ['kTTTTTTTTTTTTk',
           'kTTTTTTtttttTk',
           'kwwwwwwwwwwwwk',
           'ktttttttttttTk',
           'kttttTttttttTk',
           'ktttttttttttTk',
           'kttttTttttttTk',
           'ktttttttttttTk',
           'kTTTTTTTTTTTTk',
           'kkkkkkkkkkkkkk'],
          rep(3, '..............'))
      }
    },

    // Pants not pulled up yet: around the ankles (stand) or bunched at the
    // knees with one leg in (hop).
    pantsHalf: {
      legs: {
        stand: rows(rep(10, '..............'),
          ['kPPPPPPPPPPPPk',
           'kpppPk..kpppPk',
           'kPPPPk..kPPPPk']),
        hop: rows(rep(8, '..............'),
          ['kPPPPPPPPPPPPk',
           'kpppPk..kpppPk',
           'kpppPk..kpppPk',
           'kpppPk..kpppPk',
           'kPPPPk..kPPPPk'])
      }
    },

    // One sock on (left foot only).
    sockLeft: {
      feet: {
        bare: socksFor(['.ksssSk..ksssSk.', 'kssssSk..kssssSk', '.kkkkk....kkkkk.'], 'left'),
        liftR: socksFor(FEET_LIFT_R, 'left')
      }
    },

    pants: {
      legs: {
        stand: rows(
          ['kPPPPPPPPPPPPk',
           'kPPPPPPPPPPPPk',
           'kppppppppppPPk',
           'kpppppkkppppPk'],
          rep(8, 'kpppPk..kpppPk'),
          ['kPPPPk..kPPPPk']),
        hidden: rep(13, '..............'),   // legs out of frame (under the table)
        crouch: ['..kPPPPPPPPPPPPk..',
                 '.kpppppkkkkpppppk.',
                 'kppppk......kppppk',
                 'kpppPk......kpppPk',
                 '.kpppPk....kpppPk.',
                 '..kpppPk..kpppPk..',
                 '..kPPPPk..kPPPPk..'],
        hop: rows(
          ['kPPPPPPPPPPPPk',
           'kPPPPPPPPPPPPk',
           'kppppppppppPPk',
           'kpppppkkppppPk'],
          rep(5, 'kpppPk..kpppPk'),
          ['kpppPk..kPPPPk'],
          rep(2, 'kpppPk........'),
          ['kPPPPk........']),
        sit: rows(
          ['kPPPPPPPPPPPPk',
           'kPPPPPPPPPPPPk',
           'kpppppkkppppPk'],
          rep(6, 'kpppPk..kpppPk'),
          ['kPPPPk..kPPPPk']),
        sitLiftL: rows(
          ['kPPPPPPPPPPPPk',
           'kPPPPPPPPPPPPk',
           'kpppppkkppppPk'],
          rep(3, 'kpppPk..kpppPk'),
          ['kPPPPk..kpppPk'],
          rep(2, '........kpppPk'),
          ['........kPPPPk']),
        sitLiftR: rows(
          ['kPPPPPPPPPPPPk',
           'kPPPPPPPPPPPPk',
           'kpppppkkppppPk'],
          rep(3, 'kpppPk..kpppPk'),
          ['kpppPk..kPPPPk'],
          rep(2, 'kpppPk........'),
          ['kPPPPk........'])
      }
    },

    socks: {
      feet: {
        bare: ['.kaaaAk..kaaaAk.',
               'kwwwwWk..kwwwwWk',
               '.kkkkk....kkkkk.']
      }
    },

    shoes: {
      feet: {
        bare: ['................',
               'knnwnnk..knnwnnk',
               '.kkkkk....kkkkk.']
      }
    },

    // One shoe on (left foot only), while he puts on the second one.
    shoeLeft: {
      feet: {
        bare: ['................',
               'knnwnnk.........',
               '.kkkkk..........']
      }
    }
  };

  // The t-shirt covers the bare torso exactly like the undershirt one.
  CLOTHES.tshirt.torso.bare = CLOTHES.tshirt.torso.vest;
  CLOTHES.tshirtRolled.torso.bare = CLOTHES.tshirtRolled.torso.vest;

  // ---------------------------------------------------------------- rig
  // Parents before children.
  var RIG = [
    { slot: 'legs',  parent: null },
    { slot: 'feet',  parent: 'legs',  point: 'feet' },
    { slot: 'torso', parent: 'legs',  point: 'hips' },
    { slot: 'armL',  parent: 'torso', point: 'shoulderL' },
    { slot: 'armR',  parent: 'torso', point: 'shoulderR' },
    { slot: 'head',  parent: 'torso', point: 'neck' },
    { slot: 'eyes',  parent: 'head',  point: 'eyes' },
    { slot: 'mouth', parent: 'head',  point: 'mouth' },
    { slot: 'hair',  parent: 'head',  point: 'crown' }
  ];

  // Front view. A pose may pass its own `order` (e.g. side views).
  var DRAW_ORDER = ['legs', 'feet', 'torso', 'armL', 'armR', 'head', 'eyes', 'mouth', 'hair'];
  // Hands in front of the head (scrubbing hair, hands on face...).
  var ORDER_ARMS_FRONT = ['legs', 'feet', 'torso', 'head', 'eyes', 'mouth', 'hair', 'armL', 'armR'];

  var OUTFITS = {
    // Shower/bath: no clothes; use with torso 'bath', legs 'hidden', feet null.
    bath:      { clothes: [],                                  colors: 'default' },
    underwear: { clothes: [],                                  colors: 'default' },
    dressed:   { clothes: ['tshirt', 'pants', 'socks'],        colors: 'default' },
    ready:     { clothes: ['tshirt', 'pants', 'socks', 'shoes'], colors: 'default' }
  };

  var DEFAULT_POSE = {
    outfit: 'ready',
    colors: null,        // null = outfit's color set
    legs: 'stand',
    feet: 'bare',
    torso: 'vest',
    armL: 'down',
    armR: 'down',
    head: 'base',
    eyes: 'open',
    mouth: 'smile',
    hair: 'dry',
    offsets: null,       // { slot: [dx, dy] }, inherited by child parts
    order: null,
    clothes: null        // overrides the outfit's clothes list (dressing stages)
  };

  var spriteCache = {};  // "base|slot|variant|colors" / "item|slot|variant|colors"
  var bakeCache = {};    // pose key -> { canvas, ax, ay }

  function warn(msg) {
    if (MR.config.DEV && window.console) { console.warn('MR.character: ' + msg); }
  }

  function colorMap(colorsKey) {
    var outfitColors = MR.palette.OUTFIT_COLORS[colorsKey];
    if (!outfitColors) {
      warn('unknown color set "' + colorsKey + '"');
      outfitColors = MR.palette.OUTFIT_COLORS['default'];
    }
    return MR.palette.merge(MR.palette.CHARACTER_BODY, outfitColors);
  }

  function sprite(cacheKey, data, colorsKey) {
    var key = cacheKey + '|' + colorsKey;
    if (!spriteCache[key]) { spriteCache[key] = MR.sprites.buildSprite(data, colorMap(colorsKey)); }
    return spriteCache[key];
  }

  function normalize(pose) {
    var out = {}, k;
    for (k in DEFAULT_POSE) { if (DEFAULT_POSE.hasOwnProperty(k)) { out[k] = DEFAULT_POSE[k]; } }
    if (pose) {
      for (k in pose) { if (pose.hasOwnProperty(k)) { out[k] = pose[k]; } }
    }
    if (!OUTFITS[out.outfit]) { warn('unknown outfit "' + out.outfit + '"'); out.outfit = 'underwear'; }
    if (!out.colors) { out.colors = OUTFITS[out.outfit].colors; }
    return out;
  }

  // Composes a pose into one canvas. Returns { canvas, ax, ay, points } where
  // (ax, ay) is the ground point (between the feet) inside the canvas and
  // points['slot.name'] = [x, y] is every attach point, for anchoring props.
  // A slot set to null in the pose is skipped along with its children.
  function bake(pose) {
    var p = normalize(pose), key = JSON.stringify(p), cached = bakeCache[key];
    var placed = {}, layers = [], order, i, j, r, part, parent, attach, off, x, y,
      clothes, item, overlay, minX = 9999, minY = 9999, maxX = -9999, maxY = -9999,
      canvas, ground, l, pts, name;
    if (cached) { return cached; }

    // 1. Place every part: its top-left = parent point - own pivot + offset.
    for (i = 0; i < RIG.length; i++) {
      r = RIG[i];
      if (p[r.slot] === null) { continue; }
      part = PARTS[r.slot][p[r.slot]];
      if (!part) { warn('no part ' + r.slot + '.' + p[r.slot]); continue; }
      if (r.parent) {
        parent = placed[r.parent];
        if (!parent) { continue; }
        attach = parent.part.points && parent.part.points[r.point];
        if (!attach) { warn(r.parent + ' has no point "' + r.point + '"'); continue; }
        x = parent.x + attach[0] - part.pivot[0];
        y = parent.y + attach[1] - part.pivot[1];
      } else {
        x = -part.pivot[0];
        y = -part.pivot[1];
      }
      off = p.offsets && p.offsets[r.slot];
      if (off) { x += off[0]; y += off[1]; }
      placed[r.slot] = { part: part, x: x, y: y };
    }

    // 2. Layer list: each base part, then its clothing overlays.
    order = p.order || DRAW_ORDER;
    clothes = p.clothes || OUTFITS[p.outfit].clothes;
    for (i = 0; i < order.length; i++) {
      r = placed[order[i]];
      if (!r) { continue; }
      layers.push({
        canvas: sprite('base|' + order[i] + '|' + p[order[i]], r.part.data, p.colors),
        x: r.x, y: r.y
      });
      for (j = 0; j < clothes.length; j++) {
        item = CLOTHES[clothes[j]];
        if (!item || !item[order[i]]) { continue; }
        overlay = item[order[i]][p[order[i]]];
        if (!overlay) {
          warn(clothes[j] + ' has no overlay for ' + order[i] + '.' + p[order[i]]);
          continue;
        }
        if (overlay.length !== r.part.data.length || overlay[0].length !== r.part.data[0].length) {
          warn(clothes[j] + '.' + order[i] + '.' + p[order[i]] + ' size differs from base part');
        }
        layers.push({
          canvas: sprite(clothes[j] + '|' + order[i] + '|' + p[order[i]], overlay, p.colors),
          x: r.x, y: r.y
        });
      }
    }

    // 3. Bounding box, then compose into one canvas.
    for (i = 0; i < layers.length; i++) {
      l = layers[i];
      if (l.x < minX) { minX = l.x; }
      if (l.y < minY) { minY = l.y; }
      if (l.x + l.canvas.width > maxX) { maxX = l.x + l.canvas.width; }
      if (l.y + l.canvas.height > maxY) { maxY = l.y + l.canvas.height; }
    }
    for (i = 0; i < layers.length; i++) { layers[i].x -= minX; layers[i].y -= minY; }
    canvas = MR.sprites.compose(maxX - minX, maxY - minY, layers);

    pts = {};
    for (i = 0; i < RIG.length; i++) {
      r = placed[RIG[i].slot];
      if (!r || !r.part.points) { continue; }
      for (name in r.part.points) {
        if (r.part.points.hasOwnProperty(name)) {
          pts[RIG[i].slot + '.' + name] = [r.x + r.part.points[name][0] - minX,
            r.y + r.part.points[name][1] - minY];
        }
      }
    }
    ground = pts['legs.ground'];
    cached = { canvas: canvas, ax: ground[0], ay: ground[1], points: pts };

    if (MR.config.DEV && MR.sprites.countColors(canvas) > 15) {
      warn('pose uses more than 15 colors: ' + key);
    }
    bakeCache[key] = cached;
    return cached;
  }

  // Draws a pose with its ground point at (x, y), scaled by an integer factor.
  function draw(ctx, pose, x, y, scale) {
    var b = bake(pose), s = scale || 1;
    ctx.drawImage(b.canvas, Math.round(x - b.ax * s), Math.round(y - b.ay * s),
      b.canvas.width * s, b.canvas.height * s);
  }

  MR.character = {
    PARTS: PARTS,
    CLOTHES: CLOTHES,
    OUTFITS: OUTFITS,
    RIG: RIG,
    DRAW_ORDER: DRAW_ORDER,
    ORDER_ARMS_FRONT: ORDER_ARMS_FRONT,
    DEFAULT_POSE: DEFAULT_POSE,
    bake: bake,
    draw: draw
  };
}());
