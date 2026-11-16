// Built-in looks of the road obstacles: SKINS[kind][name](kit) returns an Object3D at unit size
// (the same contract world packs follow, see docs/DESIGN.md "Contracts"). DEFAULT names the plain look.
// All of them are merged, vertex-coloured, flat-shaded toys.
import { KIT } from '../scenery.js';

const { THREE: T, mergeColored, mat4, mulberry32 } = KIT;
const TAU = Math.PI * 2;

const part = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => ({ geo, color, matrix: mat4(x, y, z, rx, ry, rz, sx, sy, sz) });
// Ellipsoid, cylinder/cone (centre based), box.
const E = (c, x, y, z, rx, ry = rx, rz = rx, ax = 0, ay = 0, az = 0, d = 1) => part(new T.IcosahedronGeometry(1, d), c, x, y, z, rx, ry, rz, ax, ay, az);
const Cy = (c, x, y, z, rt, rb, h, seg = 8, ax = 0, ay = 0, az = 0) => part(new T.CylinderGeometry(rt, rb, h, seg), c, x, y, z, 1, 1, 1, ax, ay, az);
const Bx = (c, x, y, z, w, h, d, ax = 0, ay = 0, az = 0) => part(new T.BoxGeometry(w, h, d), c, x, y, z, 1, 1, 1, ax, ay, az);
const eyes = (ps, y, z, sp, r, c = 0x1e1a28) => {
  for (const s of [-1, 1]) { ps.push(E(0xffffff, s * sp, y, z, r)); ps.push(E(c, s * sp, y + r * 0.1, z + r * 0.62, r * 0.55)); }
};
const skin = (ps, extra) => new T.Mesh(mergeColored(ps), new T.MeshLambertMaterial(Object.assign({ vertexColors: true, emissive: 0x1c1c1c }, extra)));

// Colour a sphere (or any geometry) per triangle from its centre.
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    c.set(fn(x, y, z));
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  return g;
}
// Pie sectors around the Z axis (rolling about Z shows the colours turning).
const pie = (cols, cap) => (x, y, z) => (Math.abs(z) > 0.86 ? cap : cols[Math.floor(((Math.atan2(y, x) + Math.PI) / TAU) * cols.length) % cols.length]);
const ball = (cols, cap, r = 1) => skin([part(paint(new T.IcosahedronGeometry(r, 2), pie(cols, cap)), 0xffffff)]);

const tri = (a, b, c) => new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b), new T.Vector3(...c)]);
const quad = (a, b, c, d) => new T.BufferGeometry().setFromPoints([a, b, c, a, c, d].map((p) => new T.Vector3(...p)));
// A wedge 1 wide, 1 long, rising towards +Z, with banded top.
function wedge(top, side, back, bands = 8) {
  const ps = [];
  for (let i = 0; i < bands; i++) {
    const z0 = i / bands, z1 = (i + 1) / bands;
    ps.push({ geo: quad([-0.5, z0, z0], [-0.5, z1, z1], [0.5, z1, z1], [0.5, z0, z0]), color: top[i % top.length] });
  }
  for (const s of [-0.5, 0.5]) ps.push({ geo: s < 0 ? tri([s, 0, 0], [s, 1, 1], [s, 0, 1]) : tri([s, 0, 0], [s, 0, 1], [s, 1, 1]), color: side });
  ps.push({ geo: quad([-0.5, 0, 1], [-0.5, 1, 1], [0.5, 1, 1], [0.5, 0, 1]).clone(), color: back });
  return ps;
}
// A flat blob (puddle) in rings of colour.
function blob(cols, seed, rough = 0.12) {
  const rnd = mulberry32(seed), N = 22, rr = [];
  for (let i = 0; i < N; i++) rr.push(1 - rough * rnd());
  const ps = [];
  [[0.62, 1, 0], [0.3, 0.62, 1], [0, 0.3, 2]].forEach(([r0, r1, ci]) => {
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU, k0 = rr[i], k1 = rr[(i + 1) % N];
      const P = (a, r, k) => [Math.cos(a) * r * k, 0.02 + ci * 0.012, Math.sin(a) * r * k];
      ps.push({ geo: quad(P(a0, r0, k0), P(a1, r0, k1), P(a1, r1, k1), P(a0, r1, k0)).clone(), color: cols[(ci + (i % 3 === 0 ? 1 : 0)) % cols.length] });
    }
  });
  return ps;
}
const spikes = (ps, n, r0, len, w, c, seed) => {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * TAU, q = Math.sqrt(1 - u * u), d = new T.Vector3(Math.cos(a) * q, u, Math.sin(a) * q);
    const m = new T.Matrix4().compose(d.clone().multiplyScalar(r0 + len / 2), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d), new T.Vector3(1, 1, 1));
    ps.push({ geo: new T.ConeGeometry(w, len, 4), color: c, matrix: m });
  }
};

export const DEFAULT = { roller: 'ball', crosser: 'duck', bouncer: 'pad', ramp: 'wedge', cones: 'cone', slick: 'puddle', spinner: 'sweeper', popper: 'jack', traffic: 'car' };

export const SKINS = {
  roller: {
    ball: () => ball([0xff6fae, 0xffffff, 0x4fd8ff, 0xffffff, 0xffd84a, 0xffffff], 0xffd84a),
    beach: () => ball([0xff4b4b, 0xffffff, 0x2f8fff, 0xffffff, 0xffc21a, 0xffffff], 0xffffff),
    hay() {
      const g = new T.CylinderGeometry(1, 1, 1.6, 12); g.rotateX(Math.PI / 2);
      return skin([part(paint(g, (x, y, z) => (Math.abs(z) > 0.79 ? 0xf3d98a : Math.floor(((Math.atan2(y, x) + Math.PI) / TAU) * 12) % 2 ? 0xe4b94c : 0xd6a53c)), 0xffffff),
        Cy(0xa9702a, 0, 0, 0.35, 1.02, 1.02, 0.12, 12, Math.PI / 2), Cy(0xa9702a, 0, 0, -0.35, 1.02, 1.02, 0.12, 12, Math.PI / 2)]);
    },
    tumbleweed() {
      const ps = [E(0xc79a5c, 0, 0, 0, 0.72, 0.72, 0.72, 0, 0, 0, 2)];
      spikes(ps, 26, 0.55, 0.55, 0.11, 0x8d6a38, 5); spikes(ps, 12, 0.5, 0.5, 0.1, 0xe0b574, 9);
      return skin(ps);
    },
    snowball() {
      const rnd = mulberry32(3), g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, seen = new Map();
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)}${p.getY(i).toFixed(3)}${p.getZ(i).toFixed(3)}`;
        if (!seen.has(k)) seen.set(k, 0.9 + rnd() * 0.12);
        const s = seen.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
      }
      return skin([part(paint(g, (x, y, z) => [0xffffff, 0xeaf4ff, 0xd6e9ff][Math.floor(Math.abs(Math.sin(x * 9 + y * 5 + z * 7) * 3)) % 3]), 0xffffff)]);
    },
  },
  crosser: {
    duck() {
      const ps = [E(0xffd23a, 0, 0.42, -0.02, 0.4, 0.34, 0.5), E(0xffd23a, 0, 0.82, 0.26, 0.27), E(0xe8a81c, -0.4, 0.46, -0.05, 0.1, 0.22, 0.34, 0, 0, 0.5), E(0xe8a81c, 0.4, 0.46, -0.05, 0.1, 0.22, 0.34, 0, 0, -0.5),
        E(0xff8a1f, 0, 0.78, 0.55, 0.15, 0.07, 0.17), E(0xffd23a, 0, 0.55, -0.5, 0.1, 0.1, 0.18), E(0xff8a1f, -0.16, 0.05, 0.05, 0.12, 0.05, 0.2), E(0xff8a1f, 0.16, 0.05, 0.05, 0.12, 0.05, 0.2)];
      eyes(ps, 0.9, 0.38, 0.13, 0.07);
      return skin(ps);
    },
    sheep() {
      const ps = [E(0xffffff, 0, 0.55, 0, 0.42, 0.36, 0.5), E(0xf2f2f2, 0.2, 0.7, 0.2, 0.28), E(0xf2f2f2, -0.2, 0.7, 0.1, 0.3), E(0xffffff, 0, 0.78, -0.2, 0.3), E(0x3a3340, 0, 0.62, 0.52, 0.2, 0.22, 0.25),
        E(0x3a3340, -0.2, 0.74, 0.5, 0.14, 0.06, 0.07, 0, 0, 0.3), E(0x3a3340, 0.2, 0.74, 0.5, 0.14, 0.06, 0.07, 0, 0, -0.3)];
      for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.25], [0.2, -0.25]]) ps.push(Cy(0x3a3340, x, 0.16, z, 0.06, 0.07, 0.32, 5));
      eyes(ps, 0.68, 0.7, 0.09, 0.05, 0x000000);
      return skin(ps);
    },
    crab() {
      const ps = [E(0xff6a3d, 0, 0.3, 0, 0.5, 0.24, 0.38), E(0xff8a5c, 0, 0.42, 0.05, 0.3, 0.1, 0.22)];
      for (const s of [-1, 1]) {
        ps.push(E(0xff6a3d, s * 0.62, 0.45, 0.36, 0.2, 0.15, 0.24), E(0xff6a3d, s * 0.55, 0.62, 0.52, 0.08, 0.12, 0.08), E(0xffffff, s * 0.16, 0.7, 0.3, 0.09), E(0x1e1a28, s * 0.16, 0.72, 0.38, 0.05), Cy(0xff6a3d, s * 0.16, 0.5, 0.3, 0.025, 0.025, 0.3, 4));
        for (let i = 0; i < 3; i++) ps.push(Cy(0xe05028, s * 0.62, 0.18, -0.15 + i * 0.16, 0.025, 0.025, 0.4, 4, 0, 0, s * 1.0));
      }
      return skin(ps);
    },
    penguin() {
      const ps = [E(0x2f3a5c, 0, 0.5, 0, 0.34, 0.5, 0.3), E(0xffffff, 0, 0.46, 0.1, 0.25, 0.4, 0.24), E(0x2f3a5c, 0, 0.92, 0.05, 0.25), E(0xff9a1f, 0, 0.88, 0.3, 0.1, 0.05, 0.14),
        E(0x2f3a5c, -0.36, 0.5, 0, 0.07, 0.22, 0.13, 0, 0, 0.35), E(0x2f3a5c, 0.36, 0.5, 0, 0.07, 0.22, 0.13, 0, 0, -0.35), E(0xff9a1f, -0.14, 0.04, 0.1, 0.12, 0.05, 0.2), E(0xff9a1f, 0.14, 0.04, 0.1, 0.12, 0.05, 0.2)];
      eyes(ps, 0.97, 0.22, 0.11, 0.06);
      return skin(ps);
    },
  },
  bouncer: {
    pad() {
      const ps = [Cy(0x2c3fb8, 0, 0.1, 0, 0.98, 1, 0.2, 18), Cy(0xfff0a0, 0, 0.22, 0, 0.82, 0.82, 0.08, 18), Cy(0xff6fae, 0, 0.27, 0, 0.5, 0.5, 0.04, 18), Cy(0xfff0a0, 0, 0.3, 0, 0.26, 0.26, 0.04, 18)];
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; ps.push(E(i % 2 ? 0xff5a5a : 0xffffff, Math.cos(a) * 0.9, 0.26, Math.sin(a) * 0.9, 0.13, 0.13, 0.13)); }
      return skin(ps);
    },
    mushroom() {
      const cap = new T.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI / 2);
      const ps = [Cy(0xfff2d0, 0, 0.18, 0, 0.5, 0.62, 0.36, 10), part(paint(cap, (x, y, z) => (y > 0.82 ? 0xff8a8a : 0xff4b4b)), 0xffffff, 0, 0.3, 0, 1, 0.45, 1)];
      const rnd = mulberry32(7);
      for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = 0.25 + rnd() * 0.55, y = 0.3 + 0.45 * Math.sqrt(Math.max(0, 1 - r * r)) - 0.02; ps.push(E(0xffffff, Math.cos(a) * r, y, Math.sin(a) * r, 0.14, 0.04, 0.14)); }
      return skin(ps);
    },
  },
  ramp: {
    wedge: () => skin(wedge([0xff7ab8, 0xffffff, 0x58d8ff, 0xffffff], 0x3a52d0, 0x2c3fb8)),
    rock() {
      const ps = wedge([0xe0a368, 0xc98450, 0xd9955c, 0xb8743f], 0xa8683a, 0x8a5430, 10);
      const rnd = mulberry32(11);
      for (let i = 0; i < 9; i++) { const s = i % 2 ? 0.5 : -0.5, z = rnd(); ps.push(E(0xb06f3c, s + (s > 0 ? 0.05 : -0.05), z * 0.9 + 0.08, z, 0.1 + rnd() * 0.07, 0.1 + z * 0.4, 0.14 + rnd() * 0.06, 0, rnd() * 3, 0, 0)); }
      return skin(ps);
    },
    snowramp() {
      const ps = wedge([0xffffff, 0xdff2ff, 0xf4fbff, 0xcfe8ff], 0x9fd0f0, 0x7fb8e0, 8);
      const rnd = mulberry32(5);
      for (let i = 0; i < 8; i++) { const s = i % 2 ? 0.5 : -0.5, z = rnd(); ps.push(E(0xffffff, s, z * 0.8 + 0.1, z, 0.12, 0.1 + z * 0.3, 0.16, 0, 0, 0)); }
      return skin(ps);
    },
  },
  cones: {
    cone() {
      const ps = [Cy(0x3a3350, 0, 0.03, 0, 0.36, 0.38, 0.06, 10)];
      const cols = [0xff5a7a, 0xffffff, 0xff5a7a, 0xffd84a];
      cols.forEach((c, i) => { const y0 = 0.06 + i * 0.18, r0 = 0.3 - i * 0.07, r1 = 0.3 - (i + 1) * 0.07; ps.push(Cy(c, 0, y0 + 0.09, 0, Math.max(0.02, r1), r0, 0.18, 10)); });
      ps.push(E(0xffd84a, 0, 0.8, 0, 0.07));
      return skin(ps);
    },
    coconut() {
      const ps = [E(0x8a5a2b, 0, 0.38, 0, 0.38, 0.4, 0.38, 0, 0, 0, 2), E(0xb07a3e, 0, 0.5, 0, 0.3, 0.3, 0.3)];
      for (const [x, z] of [[-0.12, 0.33], [0.12, 0.33], [0, 0.22]]) ps.push(E(0x2a1c10, x, 0.55 + (z < 0.3 ? 0.1 : 0), z, 0.06));
      return skin(ps);
    },
  },
  slick: {
    puddle: () => skin(blob([0x3a1f7c, 0x8a5fe8, 0x4fe0f0], 3), { emissive: 0x4a3a98 }),
    ice: () => skin(blob([0xffffff, 0x8fd4ff, 0xe8f8ff], 8, 0.08), { emissive: 0x7098c0 }),
  },
  spinner: {
    sweeper() {
      const ps = [];
      for (let i = 0; i < 6; i++) ps.push(Bx(i % 2 ? 0xffffff : 0xff5a8a, 0.075 + i * 0.14, 0.17, 0, 0.14, 0.07, 0.07));
      ps.push(E(0xffd84a, 0.93, 0.17, 0, 0.1, 0.1, 0.1), E(0xffd84a, 0.97, 0.17, 0, 0.09));
      return skin(ps);
    },
  },
  popper: {
    jack() {
      const ps = [];
      for (let i = 0; i < 4; i++) ps.push(Cy(i % 2 ? 0xc8ccd8 : 0x8a90a8, 0, 0.12 + i * 0.16, 0, 0.18, 0.18, 0.14, 8));
      ps.push(E(0xffd84a, 0, 1.0, 0, 0.42), Cy(0xff5aa0, 0, 1.52, 0, 0.02, 0.24, 0.42, 7), E(0xffffff, 0, 1.74, 0, 0.06));
      eyes(ps, 1.06, 0.36, 0.15, 0.09);
      ps.push(E(0xd2304a, 0, 0.86, 0.38, 0.17, 0.06, 0.07));
      return skin(ps);
    },
    mole() {
      const ps = [E(0x7a5a46, 0, 0.62, 0, 0.5, 0.68, 0.5), E(0x8f6c55, 0, 0.66, 0.1, 0.38, 0.5, 0.4), E(0xff9ab0, 0, 0.9, 0.5, 0.13, 0.1, 0.1), E(0xffb6c6, -0.56, 0.4, 0.2, 0.14, 0.1, 0.2), E(0xffb6c6, 0.56, 0.4, 0.2, 0.14, 0.1, 0.2)];
      eyes(ps, 1.08, 0.38, 0.16, 0.08);
      return skin(ps);
    },
    geyser() {
      const ps = [Cy(0x8fe2ff, 0, 0.5, 0, 0.3, 0.46, 1.0, 9), Cy(0xdff8ff, 0, 1.05, 0, 0.2, 0.3, 0.3, 9), E(0xffffff, 0, 1.3, 0, 0.42, 0.34, 0.42)];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ps.push(E(0xbff0ff, Math.cos(a) * 0.55, 1.0 + (i % 2) * 0.25, Math.sin(a) * 0.55, 0.1)); }
      return skin(ps);
    },
  },
  traffic: {
    car() {
      const ps = [Bx(0xff5a4f, 0, 0.38, 0, 0.9, 0.34, 1.9), Bx(0xff7a6f, 0, 0.62, 0, 0.84, 0.1, 1.5), Bx(0xffe9a8, 0, 0.78, -0.12, 0.76, 0.3, 0.8), Bx(0x9fe4ff, 0, 0.8, 0.28, 0.7, 0.2, 0.04), E(0xffd84a, -0.3, 0.42, 0.97, 0.1), E(0xffd84a, 0.3, 0.42, 0.97, 0.1)];
      for (const [x, z] of [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]]) ps.push(Cy(0x2a2535, x, 0.22, z, 0.22, 0.22, 0.16, 10, 0, 0, Math.PI / 2), Cy(0xffd84a, x * 1.07, 0.22, z, 0.1, 0.1, 0.17, 6, 0, 0, Math.PI / 2));
      return skin(ps);
    },
    cart() {
      const ps = [Bx(0x6e6a78, 0, 0.55, 0, 0.85, 0.5, 1.5), Bx(0xff9a3a, 0, 0.82, 0, 0.95, 0.1, 1.6), Bx(0x555060, 0, 0.3, 0, 0.8, 0.12, 1.4), E(0xffd23a, 0, 1.0, 0.1, 0.3, 0.2, 0.3), E(0xc9c2b0, 0.15, 1.0, -0.3, 0.22, 0.18, 0.22), E(0xffb43a, -0.2, 1.05, -0.2, 0.18)];
      for (const [x, z] of [[-0.45, 0.5], [0.45, 0.5], [-0.45, -0.5], [0.45, -0.5]]) ps.push(Cy(0x2a2535, x, 0.2, z, 0.2, 0.2, 0.12, 10, 0, 0, Math.PI / 2));
      return skin(ps);
    },
  },
};

// Colours of the hole a popper comes out of, and the spinner's hub.
export const HOLE = { jack: [0x5a3a2a, 0xffd84a], mole: [0x4a3328, 0x7a5a46], geyser: [0x6a7080, 0x8fe2ff], _: [0x4a3a30, 0x7a6050] };
export function hubParts(c1 = 0xffffff, c2 = 0xff5a8a) {
  return [Cy(c2, 0, 0.06, 0, 0.1, 0.12, 0.12, 12), Cy(c1, 0, 0.12, 0, 0.07, 0.09, 0.2, 10), E(c2, 0, 0.26, 0, 0.1)].map((p) => p);
}
export const hubSkin = () => skin(hubParts());
export const holeSkin = (name) => {
  const [a, b] = HOLE[name] || HOLE._, ps = [];
  ps.push(Cy(a, 0, 0.03, 0, 1, 1, 0.06, 16), Cy(b, 0, 0.05, 0, 1.2, 1.2, 0.04, 16, 0, 0, 0));
  ps[1] = { geo: new T.RingGeometry(0.82, 1.15, 16).rotateX(-Math.PI / 2), color: b, matrix: mat4(0, 0.07, 0) };
  return skin(ps);
};
