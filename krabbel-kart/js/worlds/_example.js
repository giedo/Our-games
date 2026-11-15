// A minimal, complete world pack. It is NOT registered (see index.js): copy it to
// js/worlds/<yourworld>.js, rename the id and make it your own. To try it
// without copying, uncomment `import example from './_example.js'` and `example`
// in index.js (and put the lines back before you commit).
//
// Only import vendor three.js and ../util.js here. The game hands you everything
// else through `kit` (noise, colour helpers, scenery builders: see js/scenery.js KIT).

export default {
  id: 'example',

  // Track layout: control points are [x, z, height]. The first point sits in the
  // middle of the start straight and the road runs towards the second point.
  // `obstacles` is read by the obstacle system (see docs/DESIGN.md).
  track: {
    seed: 77,
    scale: 0.8,
    width: 19,
    points: Array.from({ length: 12 }, (_, i) => [Math.round(220 * Math.sin(i * Math.PI / 6)), Math.round(150 * Math.cos(i * Math.PI / 6)), 0]),
    itemRows: [0.15, 0.4, 0.65, 0.9],
    boostPads: [[0.3, 0], [0.7, 0]],
    obstacles: [],
  },

  // Sky, light, fog, water, road colours, terrain shape + colours. Same shape as the
  // built-in themes in js/themes.js. `bounds` is the track's bounding box.
  theme(seed, bounds, kit) {
    const { THREE, makeNoise, mix3, smoothstep } = kit;
    const N = makeNoise(seed), cx = bounds.cx, cz = bounds.cz;
    const a = new THREE.Color(0x8ad66a), b = new THREE.Color(0x5fb050), rock = new THREE.Color(0xa0a8a0);
    return {
      sky: { top: 0x2f7be0, mid: 0x9fd8ff, bottom: 0xe8f6ff, sunColor: 0xfff3c4, sunDir: [0.4, 0.6, 0.4], stars: 0, aurora: 0 },
      fog: { color: 0xd4ecff, near: 140, far: 950 },
      light: { sun: 0xfff1d0, sunI: 2.6, sky: 0xbfe2ff, ground: 0x7fae5a, hemiI: 1.5 },
      water: null, // no water in this world
      road: { tint: 0x707480, line: '#ffffff', curbA: '#ff4b4b', curbB: '#ffffff', shoulder: 0x9bcf63 },
      clouds: { color: 0xffffff, count: 14, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xffffee },
      blendNear: 8, blendFar: 70,
      height(x, z) {
        const m = smoothstep(280, 600, Math.hypot(x - cx, z - cz));
        return N.fbm(x * 0.005, z * 0.005, 3) * 14 + 3 + m * m * 120;
      },
      color(x, z, h, slope, d, out) {
        mix3(out, a, b, N.noise(x * 0.03, z * 0.03) * 0.5 + 0.5);
        if (slope > 0.5) mix3(out, out, rock, smoothstep(0.5, 0.85, slope));
        return out;
      },
    };
  },

  // Trees, houses and so on. `w` is the World being built, `kit` the shared helpers.
  scenery(w, kit) {
    const { instanced, scatter, geoRoundTree } = kit;
    instanced(w, geoRoundTree(w.rnd, [0x4fae3c, 0x66c14a]), w.mats.scenery,
      scatter(w, { count: 80, maxSlope: 0.5, s0: 0.9, s1: 1.6, radius: 420 }), 3.4);
  },

  // One tune per world. See js/audio.js for the note format and the available
  // lead instruments (whistle, square, trumpet, pan, bell, brass) and styles.
  song: {
    bpm: 120, style: 'bounce', lead: 'bell',
    chords: 'C F G C',
    melody: ['e5/4 g5/4 c6/8', 'f5/4 a5/4 c6/8', 'g5/4 b5/4 d6/8', 'c6/12 -/4'],
  },

  // Optional: your own rhythm section instead of a built-in style (same shape as
  // the STYLES entries in js/audio.js). Then set song.style to this pack's id.
  // style: { kick: [0, 8], snare: [4, 12], hat: [0, 4, 8, 12], hatVol: 0.3, bass: [[0, 0], [8, 7]], bassLen: 4, comp: 'pad', level: 1 },

  // CSS background for the card on the track picker.
  chip: 'linear-gradient(160deg,#9fd8ff 0 45%,#8ad66a 45% 100%)',

  strings: {
    en: { name: 'Example Meadow', sub: 'A tiny sample world' },
    nl: { name: 'Voorbeeldweide', sub: 'Een klein voorbeeldwereldje' },
  },

  // Optional obstacle looks: name -> (kit) => THREE.Object3D (see js/obstacles.js).
  // skins: { roller: (kit) => new kit.THREE.Group() },
};
