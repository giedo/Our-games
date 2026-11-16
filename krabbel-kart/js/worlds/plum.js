// Plum Tea Garden: whimsical storybook purple and teal with cream and soft gold.
import * as THREE from '../../vendor/three.module.min.js';

const PURPLE = 0x9a58a8, PURPLE2 = 0x6a3a7a, LILAC = 0xc79ad0, TEAL = 0x2f9aa0, TEAL2 = 0x5fc0b8, CREAM = 0xf6ecd0, GOLD = 0xf0cf70, PINK = 0xe88ab0, MOSS = 0x58b8a0;
const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));

// Dots stuck on the outside of a round thing: `ring(profile r at height)`.
function dots(KIT, n, rows, rAt, ySpan, color, size) {
  const { mat4 } = KIT, out = [];
  for (let k = 0; k < rows; k++) for (let i = 0; i < n; i++) {
    const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2, y = ySpan[0] + ((k + 0.5) / rows) * (ySpan[1] - ySpan[0]), r = rAt(y) + 0.02;
    const g = new THREE.SphereGeometry(size, 10, 7);
    out.push({ geo: g, color, matrix: mat4(Math.cos(a) * r, y, Math.sin(a) * r, 0, Math.PI / 2 - a, 0, 1, 1, 0.3) });
  }
  return out;
}

function geoCup(KIT, body, dot) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const prof = [[0, 0.1], [1.5, 0.1], [1.9, 0.5], [2.5, 3.8], [2.6, 4.3], [2.35, 4.3], [2.25, 3.9], [1.7, 1.2], [0, 1.2]];
  const cup = new T.LatheGeometry(V2(prof), 22);
  const rAt = (y) => 1.9 + ((y - 0.5) / 3.3) * 0.6;
  const parts = [
    { geo: new T.LatheGeometry(V2([[0, 0], [4.6, 0], [4.9, 0.25], [4.2, 0.55], [1.8, 0.8], [0, 0.8]]), 24), color: CREAM, bottom: 0xd8c8a0 },
    { geo: cup, color: body, bottom: new T.Color(body).multiplyScalar(0.8), matrix: mat4(0, 0.7, 0) },
    { geo: new T.CylinderGeometry(2.3, 2.3, 0.1, 22), color: 0xe6b860, matrix: mat4(0, 4.7, 0) },
    { geo: new T.TorusGeometry(1.15, 0.36, 8, 14, Math.PI * 1.25).rotateZ(-Math.PI * 0.62), color: TEAL, matrix: mat4(2.55, 3.1, 0) },
    { geo: new T.TorusGeometry(2.55, 0.14, 6, 24).rotateX(Math.PI / 2), color: GOLD, matrix: mat4(0, 4.95, 0) },
  ];
  for (const d of dots(KIT, 11, 3, (y) => rAt(y - 0.7), [1.5, 4.1], dot, 0.55)) { d.matrix.premultiply(new T.Matrix4().makeTranslation(0, 0.7, 0)); parts.push(d); }
  return mergeSmooth(parts);
}

function geoSteam(KIT) {
  const pts = [];
  for (let i = 0; i < 9; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.95) * (0.5 + i * 0.12), i * 0.9, Math.cos(i * 0.95) * (0.5 + i * 0.12)));
  return KIT.mergeSmooth([{ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.2, 6), color: 0xffffff }]);
}

function geoRoseBottle(KIT, glass, rose) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const parts = [
    { geo: new T.LatheGeometry(V2([[0, 0], [1.3, 0], [1.7, 0.6], [1.7, 1.8], [1.1, 2.8], [0.6, 3.3], [0.55, 4.0], [0.7, 4.2], [0, 4.2]]), 14), color: glass, bottom: new T.Color(glass).multiplyScalar(0.7) },
    { geo: new T.CylinderGeometry(0.5, 0.42, 0.7, 8), color: 0xd8a868, matrix: mat4(0, 4.3, 0) },
    { geo: new T.TorusGeometry(0.62, 0.08, 5, 10).rotateX(Math.PI / 2), color: GOLD, matrix: mat4(0, 3.6, 0) },
    { geo: new T.CylinderGeometry(0.08, 0.08, 2.4, 5), color: 0x4f9a5a, matrix: mat4(0, 5.4, 0) },
    { geo: new T.SphereGeometry(0.75, 9, 7), color: rose, bottom: 0xb85a88, matrix: mat4(0, 6.8, 0) },
  ];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; parts.push({ geo: new T.SphereGeometry(0.7, 8, 6), color: i % 2 ? rose : 0xf2a8c8, matrix: mat4(Math.cos(a) * 0.75, 6.6, Math.sin(a) * 0.75, 0, -a, 0, 1, 0.8, 0.45) }); }
  for (const s of [-1, 1]) parts.push({ geo: new T.SphereGeometry(0.6, 7, 5), color: 0x4f9a5a, matrix: mat4(s * 1.0, 5.6, 0, 0, 0, s * 0.5, 1, 0.3, 0.7) });
  return mergeSmooth(parts);
}

function geoHouse(KIT, rnd, low, roof) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const r1 = new T.ConeGeometry(4.6, 3.4, 4); r1.rotateY(Math.PI / 4);
  const r2 = new T.ConeGeometry(3.7, 2.2, 4); r2.rotateY(Math.PI / 4);
  const parts = [
    { geo: new T.BoxGeometry(6.4, 3.8, 5.4), color: low, bottom: new T.Color(low).multiplyScalar(0.7), matrix: mat4(0, 0.9, 0) },
    { geo: new T.BoxGeometry(6.8, 0.4, 5.8), color: GOLD, matrix: mat4(0.1, 2.9, 0, 0, 0, 0.03) },
    { geo: new T.BoxGeometry(5.6, 3.4, 4.6), color: CREAM, matrix: mat4(0.35, 4.7, 0, 0, 0, -0.06) },
    { geo: r1, color: roof, bottom: new T.Color(roof).multiplyScalar(0.7), matrix: mat4(0.9, 8.1, 0, 0, 0, -0.1, 1, 1, 0.9) },
    { geo: r2, color: new T.Color(roof).multiplyScalar(1.2), matrix: mat4(0.9, 9.8, 0, 0, 0, -0.1, 1, 1, 0.9) },
    { geo: new T.CylinderGeometry(0.45, 0.45, 2.2, 8), color: TEAL, matrix: mat4(2.2, 9.0, -1.0) },
    { geo: new T.SphereGeometry(0.7, 8, 6), color: MOSS, matrix: mat4(2.2, 10.5, -1.0) },
  ];
  parts.push({ geo: new T.BoxGeometry(1.5, 1.4, 0.25), color: PINK, matrix: mat4(0, 0.4, 2.72) });
  parts.push({ geo: new T.CylinderGeometry(0.75, 0.75, 0.25, 10).rotateX(Math.PI / 2), color: PINK, matrix: mat4(0, 1.1, 2.72) });
  for (const x of [-2.0, 2.0]) parts.push({ geo: new T.CylinderGeometry(0.55, 0.55, 0.2, 10).rotateX(Math.PI / 2), color: GOLD, matrix: mat4(x, 1.5, 2.72) });
  for (const x of [-1.3, 1.5]) parts.push({ geo: new T.CylinderGeometry(0.5, 0.5, 0.2, 10).rotateX(Math.PI / 2), color: 0xf6d878, matrix: mat4(x, 5.0, 2.4) });
  for (const x of [-2.4, 2.4]) { parts.push({ geo: new T.CylinderGeometry(0.4, 0.3, 0.7, 7), color: 0xb86a8a, matrix: mat4(x, 0.0, 3.1) }); parts.push({ geo: new T.CapsuleGeometry(0.25, 1.0, 3, 7), color: TEAL2, matrix: mat4(x, 1.0, 3.1) }); }
  return mergeSmooth(parts);
}

function geoCactusPot(KIT, pot) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const parts = [{ geo: new T.CylinderGeometry(0.8, 0.55, 1.0, 9), color: pot, bottom: new T.Color(pot).multiplyScalar(0.7), matrix: mat4(0, 0.5, 0) }, { geo: new T.CylinderGeometry(0.88, 0.88, 0.2, 9), color: GOLD, matrix: mat4(0, 1.0, 0) }];
  parts.push({ geo: new T.CapsuleGeometry(0.5, 1.5, 4, 8), color: 0x4f9a78, bottom: 0x3f8a68, matrix: mat4(0, 2.0, 0) });
  parts.push({ geo: new T.CapsuleGeometry(0.28, 0.7, 3, 7), color: 0x5fb088, matrix: mat4(0.75, 2.0, 0, 0, 0, -0.5) });
  parts.push({ geo: new T.SphereGeometry(0.32, 7, 5), color: PINK, matrix: mat4(0, 3.35, 0) });
  return mergeSmooth(parts);
}

function geoTotem(KIT) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const ell = (r, sx, sy, sz) => { const g = new T.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); return g; };
  const trunk = new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 3.4, 3.0), new T.Vector3(0, 2.4, 3.8), new T.Vector3(0, 1.4, 3.4), new T.Vector3(0, 1.0, 2.6)]), 10, 0.35, 6);
  const parts = [
    { geo: ell(2.6, 1.2, 0.95, 1.2), color: PURPLE, bottom: PURPLE2, matrix: mat4(0, 3.0, 0) },
    { geo: ell(1.4, 1, 1, 1), color: PURPLE, matrix: mat4(0, 3.8, 2.4) },
    { geo: ell(1.2, 1, 1, 0.25), color: LILAC, matrix: mat4(2.0, 3.9, 2.0, 0, -0.6, 0) },
    { geo: ell(1.2, 1, 1, 0.25), color: LILAC, matrix: mat4(-2.0, 3.9, 2.0, 0, 0.6, 0) },
    { geo: trunk, color: LILAC },
    { geo: new T.SphereGeometry(0.16, 6, 5), color: 0x222222, matrix: mat4(0.55, 4.3, 3.6) },
    { geo: new T.SphereGeometry(0.16, 6, 5), color: 0x222222, matrix: mat4(-0.55, 4.3, 3.6) },
    { geo: ell(1.9, 1, 0.9, 1), color: TEAL, bottom: 0x1f7a80, matrix: mat4(0, 7.1, 0) },
    { geo: new T.SphereGeometry(1.2, 10, 8), color: TEAL2, matrix: mat4(0, 8.6, 1.0) },
    { geo: new T.ConeGeometry(0.4, 0.8, 6), color: TEAL, matrix: mat4(0.7, 9.7, 0.8) },
    { geo: new T.ConeGeometry(0.4, 0.8, 6), color: TEAL, matrix: mat4(-0.7, 9.7, 0.8) },
    { geo: ell(1.3, 1, 0.9, 1), color: PINK, bottom: 0xc86a98, matrix: mat4(0, 11.0, 0) },
    { geo: new T.SphereGeometry(0.9, 9, 7), color: 0xf2a8c8, matrix: mat4(0, 12.0, 0.4) },
    { geo: new T.ConeGeometry(0.3, 0.7, 4), color: PINK, matrix: mat4(0.5, 12.8, 0.4) },
    { geo: new T.ConeGeometry(0.3, 0.7, 4), color: PINK, matrix: mat4(-0.5, 12.8, 0.4) },
    { geo: new T.OctahedronGeometry(0.7, 0), color: GOLD, matrix: mat4(0, 14.0, 0.4) },
  ];
  for (const x of [-1.6, 1.6]) for (const z of [-0.9, 0.9]) parts.push({ geo: new T.CylinderGeometry(0.5, 0.6, 1.6, 7), color: PURPLE2, matrix: mat4(x, 0.8, z) });
  return mergeSmooth(parts);
}

function geoGnarl(KIT, rnd, big) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const parts = [{ geo: new T.CylinderGeometry(0.9, 1.6, 6.5, 8), color: 0x5f8a98, bottom: 0x3f6a78, matrix: mat4(0, 3.0, 0) }];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; parts.push({ geo: new T.SphereGeometry(0.9, 6, 5), color: 0x5f8a98, matrix: mat4(Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4, 0, 0, 0, 1.4, 0.7, 1) }); parts.push({ geo: new T.SphereGeometry(0.55, 6, 4), color: MOSS, matrix: mat4(Math.cos(a) * 1.6, 0.8, Math.sin(a) * 1.6) }); }
  parts.push({ geo: new T.CylinderGeometry(0.4, 0.7, 4, 6), color: 0x5f8a98, matrix: mat4(1.4, 7.4, 0, 0, 0, -0.7) });
  parts.push({ geo: new T.CylinderGeometry(0.4, 0.7, 4, 6), color: 0x5f8a98, matrix: mat4(-1.3, 7.2, 0.4, 0.2, 0, 0.7) });
  const cols = [0x6fd0b8, 0xe6cf78, 0xc79ad0, 0x8ee0cc];
  const n = big ? 16 : 7;
  for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 4.2, c = cols[i % 4]; parts.push({ geo: new T.IcosahedronGeometry(1.5 + rnd() * 1.3, 1), color: c, bottom: new T.Color(c).multiplyScalar(0.6), matrix: mat4(Math.cos(a) * r, 8.2 + rnd() * 3.2, Math.sin(a) * r) }); }
  return mergeSmooth(parts);
}

function geoFireweed(KIT) {
  const { mergeSmooth, mat4 } = KIT, T = THREE, parts = [];
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 0.55, h = 2.2 + k * 0.3;
    parts.push({ geo: new T.CylinderGeometry(0.04, 0.06, h, 4), color: 0x58b8a0, matrix: mat4(x, h / 2, 0) });
    for (let i = 0; i < 6; i++) parts.push({ geo: new T.SphereGeometry(0.2 - i * 0.015, 5, 4), color: i % 2 ? 0xd878b8 : 0xb070c8, matrix: mat4(x + (i % 2 ? 0.1 : -0.1), h - 0.2 - i * 0.2, 0) });
  }
  return mergeSmooth(parts);
}

function geoToad(KIT) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const cap = new T.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const parts = [{ geo: new T.CylinderGeometry(0.5, 0.65, 1.8, 8), color: CREAM, matrix: mat4(0, 0.9, 0) }, { geo: cap, color: PURPLE, bottom: PURPLE2, matrix: mat4(0, 1.6, 0) }];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + 0.3, e = 0.35 + (i % 2) * 0.5; parts.push({ geo: new T.SphereGeometry(0.22, 5, 4), color: CREAM, matrix: mat4(Math.cos(a) * 1.5 * Math.cos(e), 1.6 + Math.sin(e) * 1.5 * (e < 1 ? 1 : 0.9), Math.sin(a) * 1.5 * Math.cos(e), 0, 0, 0, 1, 0.5, 1) }); }
  return mergeSmooth(parts);
}

function geoBoat(KIT, hull) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const tri = (pts, c) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return { geo: g, color: c }; };
  const parts = [
    { geo: new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), color: hull, bottom: PURPLE2, matrix: mat4(0, 1.0, 0, 0, 0, 0, 1.5, 1.2, 3.8) },
    { geo: new T.BoxGeometry(3.1, 0.3, 7.6), color: CREAM, matrix: mat4(0, 1.02, 0) },
    { geo: new T.CylinderGeometry(0.1, 0.1, 9.6, 5), color: 0x7a5232, matrix: mat4(0, 5.8, 0.3) },
    tri([0, 1.6, 3.8, 0, 10.0, 0.4, 0, 1.6, 0.4], TEAL),
    tri([0, 1.6, 0.0, 0, 8.4, 0.2, 0, 1.6, -3.0], CREAM),
    tri([0.05, 10.0, 0.4, 0.05, 10.8, 1.6, 0.05, 10.0, 2.3], PINK),
  ];
  for (let i = 0; i < 4; i++) parts.push(tri([0.02, 1.6 + i * 1.9, 0.0 - i * 0.7, 0.02, 3.3 + i * 1.9, -0.1 - i * 0.7, 0.02, 1.6 + i * 1.9, -3.0 + i * 0.7], i % 2 ? PURPLE : LILAC));
  return mergeSmooth(parts);
}

export default {
  id: 'plum',

  track: {
    seed: 83,
    scale: 0.82,
    width: 18,
    points: [
      [0, 150, 0], [100, 150, 0], [185, 125, 1], [230, 65, 2], [198, 5, 3], [230, -55, 4],
      [180, -115, 5], [110, -150, 4], [52, -112, 3], [-5, -135, 2], [-75, -165, 3], [-155, -135, 4],
      [-140, -70, 3], [-190, -20, 2], [-230, 40, 1], [-200, 105, 1], [-120, 145, 0],
    ],
    itemRows: [0.12, 0.35, 0.58, 0.82],
    boostPads: [[0.22, 0], [0.47, 0], [0.7, 0]],
    obstacles: [
      { kind: 'cones', at: 0.16, lat: 3, count: 6, skin: 'sugar' },
      { kind: 'crosser', at: 0.27, count: 4, speed: 1.8, skin: 'snail' },
      { kind: 'popper', at: 0.4, lat: -3, period: 3, skin: 'teapot' },
      { kind: 'cones', at: 0.52, lat: -2, count: 6, skin: 'sugar' },
      { kind: 'crosser', at: 0.64, count: 5, speed: 2, skin: 'snail' },
      { kind: 'ramp', at: 0.76, lat: 2, size: 6 },
      { kind: 'popper', at: 0.9, lat: 3, period: 3.4, skin: 'teapot' },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise, mix3, smoothstep, lerp } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 101), N3 = makeNoise(seed + 5);
    const cx = bounds.cx, cz = bounds.cz;
    const moss = new T.Color(0x78d0b4), olive = new T.Color(0x9ce0c4), tealg = new T.Color(0x3aa896), flower = new T.Color(0xb48ccc), pink = new T.Color(0xc9a0d8), sandc = new T.Color(0xf2e8cc), shore = new T.Color(0x5fb8a8), plum = new T.Color(0x8a5ea0), cream = new T.Color(0xf4ead0);
    const lake = (x, z) => smoothstep(1.0, 0.55, Math.hypot((x - cx) / 95, (z - (cz + 12)) / 45));
    const outer = (x, z) => smoothstep(0.15, 0.4, N3.fbm(x * 0.005 + 9, z * 0.005, 2)) * smoothstep(300, 380, Math.hypot(x - cx, z - cz));
    return {
      sky: { top: 0x58aab8, mid: 0x9cd8cc, bottom: 0xf4e8c8, sunColor: 0xfff0b0, sunDir: [0.3, 0.55, 0.55], stars: 0, aurora: 0 },
      fog: { color: 0xcce4dc, near: 140, far: 900 },
      light: { sun: 0xfff0b8, sunI: 2.2, sky: 0xd4ece4, ground: 0xb898c8, hemiI: 1.75 },
      water: { level: -2.5, shallow: 0x6fd0c0, deep: 0x2a8a98, foam: 0xf6ecd0, ice: 0 },
      road: { tint: 0xeadcf2, line: '#f6ecd0', curbA: '#2f9aa0', curbB: '#f6ecd0', shoulder: 0xe8dcc0 },
      clouds: { color: 0xffffff, count: 0, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xfff4b8, cfg: { n: 420, box: 80, size: 0.8, vel: [0.3, 0.35, 0.1], op: 0.8 } },
      detail: {
        strokes: 0, kind: 'custom',
        draw(g, S, rnd) {
          for (let i = 0; i < 40; i++) {
            const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 5;
            g.fillStyle = i % 3 ? 'rgba(255,250,225,0.3)' : 'rgba(150,100,180,0.16)';
            g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
          }
        },
      },
      blendNear: 8, blendFar: 44,
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz);
        let h = 4 + N.fbm(x * 0.007, z * 0.007, 3) * 12 + N2.fbm(x * 0.025, z * 0.025, 2) * 2;
        const m = smoothstep(300, 640, r);
        h += m * m * 130 + m * N2.fbm(x * 0.012, z * 0.012, 3) * 40;
        return lerp(lerp(h, -9, outer(x, z)), -9, lake(x, z));
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.006, z * 0.006) * 0.5 + 0.5;
        mix3(out, moss, olive, smoothstep(0.35, 0.65, n));
        mix3(out, out, tealg, smoothstep(0.45, 0.7, N.noise(x * 0.005 + 20, z * 0.005) * 0.5 + 0.5) * 0.8);
        const f = N3.noise(x * 0.007 + 7, z * 0.007) * 0.5 + 0.5;
        mix3(out, out, flower, smoothstep(0.55, 0.75, f) * 0.7);
        mix3(out, out, plum, smoothstep(0.2, 0.55, slope) * 0.55);
        if (h > 25) mix3(out, out, plum, smoothstep(25, 90, h) * 0.6);
        if (h > 90) mix3(out, out, pink, smoothstep(90, 150, h) * 0.5);
        mix3(out, out, cream, smoothstep(24, 10, d) * 0.4);
        if (h < 0.3) mix3(out, out, sandc, smoothstep(0.3, -1.4, h) * 0.8);
        if (h < -2) mix3(out, out, shore, smoothstep(-2, -5, h));
        return out;
      },
    };
  },

  scenery(w, kit) {
    const { THREE: T, alongTrack, scatter, mat4, mergeSmooth, TAU, lerp } = kit;
    const instanced = (...a) => kit.instanced(...a) || { position: { set() {} } }; // empty lists give null (arena)
    const rnd = w.rnd, M = w.mats.scenery, tr = w.track, b = tr.bounds, hw = tr.halfWidth, p = new T.Vector3(), q = new T.Vector3(), info = {};
    const faceRoad = (list) => {
      for (const it of list) { tr.distInfo(it.x, it.z, info); it.ry = Math.atan2(tr.px[info.i] - it.x, tr.pz[info.i] - it.z); }
      return list;
    };
    const noShadow = (m) => { if (m) m.castShadow = false; return m; };

    // Giant polka-dot teacups on the inside of the sharpest bends, with steam curls.
    const cupSpots = [], cupF = [0.04, 0.1, 0.17, 0.24, 0.32, 0.4, 0.47, 0.53, 0.6, 0.68, 0.76, 0.82, 0.88, 0.94];
    cupF.forEach((f, k) => {
      const i = Math.floor(f * tr.n), cs = 2.1 + rnd() * 0.3, side = k % 2 ? 1 : -1;
      tr.posAt(i, side * (hw + tr.curb + 4.9 * cs + 3), p);
      tr.distInfo(p.x, p.z, info);
      if (w.heightAt(p.x, p.z) < -1 || info.d < hw + 4.9 * cs + 2 || w.inIsland(p.x, p.z)) return;
      cupSpots.push({ x: p.x, y: w.heightAt(p.x, p.z) - 0.3, z: p.z, ry: rnd() * TAU, rz: (rnd() - 0.5) * 0.1, s: cs });
    });
    const cupCols = [[PURPLE, TEAL2], [PINK, TEAL], [TEAL, PINK], [LILAC, PURPLE2]];
    [0, 1].forEach((v) => instanced(w, geoCup(kit, cupCols[v][0], cupCols[v][1]), M, cupSpots.filter((_, k) => k % 2 === v), 8).castShadow = true);
    const steam = instanced(w, geoSteam(kit), w.mats.scenery, cupSpots.map((c) => ({ ...c, y: c.y + 5.4 * c.s })));
    steam.castShadow = false;
    const D = new T.Object3D(), spotsS = cupSpots;
    if (spotsS.length) w.updaters.push((dt, t) => {
      for (let i = 0; i < spotsS.length; i++) {
        const c = spotsS[i];
        D.position.set(c.x, c.y + 5.4 * c.s + Math.sin(t * 0.8 + i) * 0.4, c.z); D.rotation.set(0, t * 0.5 + i, 0); D.scale.setScalar(c.s * (1 + 0.08 * Math.sin(t * 1.3 + i)));
        D.updateMatrix(); steam.setMatrixAt(i, D.matrix);
      }
      steam.instanceMatrix.needsUpdate = true;
    });

    // Roses in bottles, crooked houses, cactus pots, animal totems, gnarled trees.
    [[0x58b8a8, PINK], [0x9a70b8, 0xf2a8c8], [0x58b8a8, 0xf6ecd0]].forEach(([g, r]) => instanced(w, geoRoseBottle(kit, g, r), M, alongTrack(w, { count: 4, d0: 4, d1: 9, minH: 0, s0: 2.3, s1: 3.2, sink: 0.1 }), 3).castShadow = true);
    const houses = [[TEAL, PURPLE], [PURPLE, TEAL], [0xe8a0c0, PURPLE2], [TEAL2, PURPLE]];
    houses.forEach(([lo, ro]) => instanced(w, geoHouse(kit, rnd, lo, ro), M, faceRoad(alongTrack(w, { count: 5, d0: 16, d1: 40, minH: 0.5, s0: 1.3, s1: 1.7, sink: 0.4 })), 4.5).castShadow = true);
    [0xb86a8a, 0xd8a868, PURPLE].forEach((c) => noShadow(instanced(w, geoCactusPot(kit, c), M, alongTrack(w, { count: 9, d0: 3, d1: 14, minH: 0, s0: 0.9, s1: 1.6 }), 1)));
    instanced(w, geoTotem(kit), M, faceRoad(alongTrack(w, { count: 5, even: true, phase: 0.2, d0: 14, d1: 30, minH: 0, s0: 1.6, s1: 2.1, sink: 0.2 })), 4).castShadow = true;
    instanced(w, geoGnarl(kit, rnd, true), M, alongTrack(w, { count: 8, even: true, phase: 0.6, d0: 14, d1: 34, minH: 0, s0: 1.3, s1: 1.9 }), 5).castShadow = true;
    noShadow(instanced(w, geoGnarl(kit, rnd, false), M, scatter(w, { count: 28, minH: 0, maxSlope: 0.45, s0: 0.9, s1: 1.6, radius: 440 }), 3));
    noShadow(instanced(w, geoFireweed(kit), M, scatter(w, { count: 60, minH: 0, maxD: 70, maxSlope: 0.5, s0: 0.9, s1: 1.7 }), 0));
    noShadow(instanced(w, geoToad(kit), M, scatter(w, { count: 24, minH: 0, maxD: 70, maxSlope: 0.4, s0: 0.8, s1: 1.7 }), 1.5));

    // Pinwheels spinning beside the road.
    const pinSpots = alongTrack(w, { count: 10, d0: 3, d1: 8, minH: 0, s0: 1, s1: 1 });
    instanced(w, mergeSmooth([{ geo: new T.CylinderGeometry(0.07, 0.07, 3.4, 5), color: CREAM, matrix: mat4(0, 1.7, 0) }]), M, pinSpots);
    const wheelGeo = []; for (let i = 0; i < 4; i++) { const g = new T.BufferGeometry(); const a = (i / 4) * TAU; g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0, Math.cos(a + 0.9) * 0.9, Math.sin(a + 0.9) * 0.9, 0.0], 3)); g.computeVertexNormals(); wheelGeo.push({ geo: g, color: [PINK, GOLD, TEAL2, LILAC][i] }); }
    const wheels = instanced(w, mergeSmooth(wheelGeo), w.mats.sceneryDouble, pinSpots.map((s) => ({ ...s, y: s.y + 3.5, s: 1 })));
    wheels.castShadow = false;
    const pd = new T.Object3D();
    if (pinSpots.length) w.updaters.push((dt, t) => {
      for (let i = 0; i < pinSpots.length; i++) { const s = pinSpots[i]; pd.position.set(s.x, s.y + 3.5, s.z); pd.rotation.set(0, s.ry, t * 2.2 + i); pd.updateMatrix(); wheels.setMatrixAt(i, pd.matrix); }
      wheels.instanceMatrix.needsUpdate = true;
    });

    // Bunting across the road.
    const pos = [], col = [], cols = [PURPLE, TEAL2, GOLD, PINK, LILAC].map((c) => new T.Color(c));
    const poleSpots = [];
    for (const f of [0.1, 0.3, 0.5, 0.67, 0.85]) {
      const i = Math.floor(f * tr.n);
      tr.posAt(i, -(hw + 4), p); tr.posAt(i, hw + 4, q);
      poleSpots.push({ x: p.x, y: tr.py[i] - 0.3, z: p.z, ry: 0, s: 1 }, { x: q.x, y: tr.py[i] - 0.3, z: q.z, ry: 0, s: 1 });
      const n = 14;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 0.8) / n, y0 = tr.py[i] + 9.6 - 1.6 * 4 * t0 * (1 - t0), y1 = tr.py[i] + 9.6 - 1.6 * 4 * t1 * (1 - t1), tm = (t0 + t1) / 2;
        const ax = lerp(p.x, q.x, t0), az = lerp(p.z, q.z, t0), bx = lerp(p.x, q.x, t1), bz = lerp(p.z, q.z, t1), mx = lerp(p.x, q.x, tm), mz = lerp(p.z, q.z, tm);
        pos.push(ax, y0, az, bx, y1, bz, mx, y0 - 1.5, mz);
        const c = cols[k % 5]; for (let z = 0; z < 3; z++) col.push(c.r, c.g, c.b);
      }
    }
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); bg.computeVertexNormals();
    w.scene.add(new T.Mesh(bg, w.mats.sceneryDouble));
    instanced(w, mergeSmooth([{ geo: new T.CylinderGeometry(0.15, 0.25, 10.2, 6), color: PURPLE2, matrix: mat4(0, 5.1, 0) }, { geo: new T.SphereGeometry(0.4, 7, 5), color: GOLD, matrix: mat4(0, 10.3, 0) }]), M, poleSpots.map((s) => ({ ...s, s: 1 })));

    // Boats with striped sails and lily pads on the lake.
    const hulls = [PURPLE, TEAL, PINK, LILAC];
    for (let i = 0; i < 5; i++) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 50 && !ok; t++) { x = b.cx + (rnd() - 0.5) * 120; z = b.cz + 12 + (rnd() - 0.5) * 50; ok = w.heightAt(x, z) < -6; }
      if (!ok) continue;
      const m = new T.Mesh(geoBoat(kit, hulls[i % 4]), w.mats.sceneryDouble);
      m.position.set(x, -2.5, z); m.rotation.y = rnd() * TAU; m.scale.setScalar(1.3 + rnd() * 0.7); m.castShadow = true;
      const ph = rnd() * 10;
      w.scene.add(m);
      w.updaters.push((dt, t) => { m.position.y = -2.6 + Math.sin(t * 1.0 + ph) * 0.2; m.rotation.z = Math.sin(t * 0.7 + ph) * 0.05; });
    }
    const pads = scatter(w, { count: 70, maxH: -3.5, radius: 420, minD: 12 });
    pads.forEach((s) => { s.y = -2.42; s.s = 1 + rnd() * 1.4; });
    instanced(w, mergeSmooth([{ geo: new T.CylinderGeometry(1.2, 1.2, 0.08, 10), color: 0x5fb060 }, { geo: new T.SphereGeometry(0.35, 6, 4), color: 0xf2a8c8, matrix: mat4(0.3, 0.2, 0.2) }]), M, pads);

    // Soft lilac clouds.
    const cg = [];
    for (let k = 0; k < 6; k++) cg.push({ geo: new T.SphereGeometry(1, 10, 7), color: 0xfff6fa, bottom: 0xeadcf2, matrix: mat4((k - 2.5) * 1.1, Math.sin(k * 1.9) * 0.3, Math.cos(k * 2.3) * 0.3, 0, 0, 0, 1.15 - Math.abs(k - 2.5) * 0.14, 0.75, 0.9) });
    const clouds = [];
    for (let i = 0; i < 20; i++) { const a = rnd() * TAU, r = 320 + rnd() * 650; clouds.push({ x: Math.cos(a) * r, y: 110 + rnd() * 110, z: Math.sin(a) * r, ry: rnd() * TAU, s: 9 + rnd() * 11 }); }
    const cm = instanced(w, mergeSmooth(cg), w.mats.sceneryNoFog, clouds);
    cm.position.set(b.cx, 0, b.cz);
    w.updaters.push((dt) => { cm.rotation.y += dt * 0.004; });
  },

  song: {
    bpm: 112, style: 'plum', lead: 'bell',
    chords: 'Dm Bb F C Dm Gm A Dm F C Bb F Gm Bb A Dm',
    melody: [
      'd6/6 f6/6 a6/4', 'g6/6 f6/6 d6/4', 'a5/6 c6/6 f6/4', 'e6/6 g6/6 e6/4',
      'd6/6 a5/6 f5/4', 'bb5/6 d6/6 g6/4', 'a5/6 c#6/6 e6/4', 'd6/10 -/6',
      'f6/6 a6/6 f6/4', 'e6/6 g6/6 c6/4', 'd6/6 f6/6 bb6/4', 'a6/6 f6/6 c6/4',
      'g6/6 bb6/6 d6/4', 'f6/6 d6/6 bb5/4', 'e6/6 c#6/6 a5/4', 'd6/12 -/4',
    ],
  },
  style: { kick: [0, 6, 12], snare: [], hat: [6, 12], hatVol: 0.18, bass: [[0, 0], [6, 7], [12, 0]], bassLen: 4, comp: 'arp', level: 0.85 },

  chip: 'linear-gradient(160deg,#58aab8 0 34%,#9a58a8 34% 66%,#f0cf70 66% 100%)',

  strings: {
    en: { name: 'Plum Tea Garden', sub: 'Giant teacups and floating sparkles' },
    nl: { name: 'Pruimentuin', sub: 'Reuzenkopjes en zwevende glitters' },
  },

  skins: {
    sugar(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const g = mergeSmooth([
        { geo: new T.BoxGeometry(0.7, 0.7, 0.7), color: 0xfff6e6, bottom: 0xe8d8bc, matrix: mat4(0, 0.35, 0, 0, 0.3, 0) },
        { geo: new T.SphereGeometry(0.1, 6, 4), color: 0xe88ab0, matrix: mat4(0.1, 0.72, 0.1) },
        { geo: new T.SphereGeometry(0.08, 6, 4), color: 0x5fc0b8, matrix: mat4(-0.15, 0.7, -0.1) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    snail(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const body = new T.SphereGeometry(0.4, 10, 7); body.scale(1, 0.55, 1.5);
      const g = mergeSmooth([
        { geo: body, color: 0xf2c8d8, matrix: mat4(0, 0.25, 0) },
        { geo: new T.SphereGeometry(0.2, 8, 6), color: 0xf2c8d8, matrix: mat4(0, 0.5, 0.5) },
        { geo: new T.SphereGeometry(0.42, 10, 8), color: 0x9a58a8, bottom: 0x6a3a7a, matrix: mat4(0, 0.7, -0.15) },
        { geo: new T.TorusGeometry(0.25, 0.06, 5, 12), color: 0xf0cf70, matrix: mat4(0.4, 0.7, -0.15, 0, Math.PI / 2, 0) },
        { geo: new T.CylinderGeometry(0.025, 0.025, 0.35, 4), color: 0xf2c8d8, matrix: mat4(0.08, 0.85, 0.55, 0.3, 0, 0) },
        { geo: new T.CylinderGeometry(0.025, 0.025, 0.35, 4), color: 0xf2c8d8, matrix: mat4(-0.08, 0.85, 0.55, 0.3, 0, 0) },
        { geo: new T.SphereGeometry(0.05, 5, 4), color: 0x222222, matrix: mat4(0.1, 1.0, 0.6) },
        { geo: new T.SphereGeometry(0.05, 5, 4), color: 0x222222, matrix: mat4(-0.1, 1.0, 0.6) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    teapot(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const g = mergeSmooth([
        { geo: new T.SphereGeometry(0.55, 12, 9), color: 0x9a58a8, bottom: 0x6a3a7a, matrix: mat4(0, 0.6, 0, 0, 0, 0, 1, 0.85, 1) },
        { geo: new T.SphereGeometry(0.2, 8, 6), color: 0xf6ecd0, matrix: mat4(0.3, 0.8, 0.4, 0, 0, 0, 1, 1, 0.3) },
        { geo: new T.SphereGeometry(0.2, 8, 6), color: 0x5fc0b8, matrix: mat4(-0.3, 0.55, 0.45, 0, 0, 0, 1, 1, 0.3) },
        { geo: new T.CylinderGeometry(0.3, 0.3, 0.1, 10), color: 0xf6ecd0, matrix: mat4(0, 1.07, 0) },
        { geo: new T.SphereGeometry(0.1, 6, 5), color: 0xf0cf70, matrix: mat4(0, 1.2, 0) },
        { geo: new T.ConeGeometry(0.12, 0.6, 7), color: 0x2f9aa0, matrix: mat4(0.7, 0.8, 0, 0, 0, -1.0) },
        { geo: new T.TorusGeometry(0.25, 0.06, 5, 10, Math.PI * 1.3), color: 0x2f9aa0, matrix: mat4(-0.6, 0.65, 0, 0, 0, 1.9) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
  },
};
