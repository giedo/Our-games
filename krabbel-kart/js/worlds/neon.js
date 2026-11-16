// Neon Night: a black world drawn in glowing lines (orange, magenta, cyan, violet).
// There is no bloom pass, so the glow is faked: unlit materials, thick lines made of thin boxes,
// additive glow points, a contour-line terrain shader and a road drawn with emissive stripes.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeColored, mat4, TAU, lerp, clamp, smoothstep, makeCanvas, canvasTexture, mix3 } from '../util.js';

const ORG = 0xff8a2a, MAG = 0xff2bd6, CYA = 0x19e6ff, VIO = 0x8a5cff, PCH = 0xffc27a, DARK = 0x120a2a;
const PAL = [ORG, MAG, CYA, VIO];

// A thin box between two points: the building block of every glowing line.
const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _d = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
function seg(a, b, th, color) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length() || 0.001;
  _d.divideScalar(len);
  _q.setFromUnitVectors(_z, _d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _one);
  return { geo: new THREE.BoxGeometry(th, th, len), color, matrix: m };
}
function boxEdges(out, cx, y0, cz, w, h, d, th, col) {
  const xs = [cx - w / 2, cx + w / 2], ys = [y0, y0 + h], zs = [cz - d / 2, cz + d / 2];
  for (const y of ys) for (const z of zs) out.push(seg([xs[0], y, z], [xs[1], y, z], th, col));
  for (const y of ys) for (const x of xs) out.push(seg([x, y, zs[0]], [x, y, zs[1]], th, col));
  for (const x of xs) for (const z of zs) out.push(seg([x, ys[0], z], [x, ys[1], z], th, col));
}
function ring(r, tube, arc, col, m, rad = 6, tub = 28) {
  return { geo: new THREE.TorusGeometry(r, tube, rad, tub, arc), color: col, matrix: m };
}

// ---------- model builders ----------

function geoGlowTree(rnd, pal) {
  const parts = [];
  const lean = (rnd() - 0.5) * 0.8;
  const tube = (pts, r0, r1, col) => {
    const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const g = new THREE.TubeGeometry(cv, 8, 1, 5, false);
    const p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= 8; i++) {
      cv.getPointAt(i / 8, c);
      const r = lerp(r0, r1, i / 8);
      for (let j = 0; j <= 5; j++) { const k = i * 6 + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
    }
    parts.push({ geo: g, color: col });
  };
  tube([[0, -0.3, 0], [lean * 0.5, 2, 0.2], [-lean * 0.3, 4, -0.1], [lean * 0.2, 5.6, 0]], 0.34, 0.13, ORG);
  tube([[lean * 0.3, 3.2, 0], [lean + 1.2, 4.4, 0.4], [lean + 2.0, 5.8, 0.2]], 0.14, 0.07, 0xff5a9a);
  tube([[-lean * 0.2, 3.8, 0], [-1.3, 5.0, -0.4], [-2.1, 6.4, -0.2]], 0.14, 0.07, 0xff5a9a);
  const cc = [[0, 7.2, 0, 2.3], [1.9, 6.2, 0.4, 1.6], [-1.9, 6.4, -0.3, 1.7], [0.5, 8.9, 0.2, 1.5], [lean + 2.2, 6.2, 0.3, 1.2], [-2.2, 7.8, -0.2, 1.2]];
  for (const [x, y, z, r] of cc) {
    for (let k = 0; k < 7; k++) {
      const a = rnd() * TAU, u = rnd() * 2 - 1, s = Math.sqrt(1 - u * u);
      const br = 0.62 + 0.38 * smoothstep(5.5, 10, y + u * r);
      const c = new THREE.Color(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(br);
      parts.push({ geo: new THREE.IcosahedronGeometry(0.55 + rnd() * 0.55, 0), color: c, matrix: mat4(x + Math.cos(a) * s * r * 0.85, y + u * r * 0.8, z + Math.sin(a) * s * r * 0.85) });
    }
  }
  return mergeColored(parts);
}

// Dark solid with glowing edges: returns { body, lines }.
function geoNeonHouse(kind, col) {
  const body = [], lines = [], th = 0.4;
  if (kind === 0) { // cottage with a pointy roof
    body.push({ geo: new THREE.BoxGeometry(6, 4.4, 5), color: DARK, matrix: mat4(0, 2.2, 0) });
    const r = new THREE.ConeGeometry(4.6, 3.2, 4); r.rotateY(Math.PI / 4);
    body.push({ geo: r, color: 0x1c0f3e, matrix: mat4(0, 6, 0, 0, 0, 0, 1, 1, 0.83) });
    boxEdges(lines, 0, 0, 0, 6, 4.4, 5, th, col);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lines.push(seg([sx * 3, 4.4, sz * 2.5], [0, 7.6, 0], 0.26, MAG));
    for (const x of [-1.8, 1.8]) boxEdges(lines, x, 2.2, 2.52, 1.1, 1.2, 0.05, 0.12, PCH);
    lines.push({ geo: new THREE.BoxGeometry(0.9, 1.9, 0.08), color: ORG, matrix: mat4(0, 0.95, 2.52) });
    for (const x of [-1.8, 1.8]) lines.push({ geo: new THREE.BoxGeometry(0.95, 1.05, 0.06), color: new THREE.Color(0xffa040), matrix: mat4(x, 2.2, 2.53) });
  } else if (kind === 1) { // tall block with balconies
    body.push({ geo: new THREE.BoxGeometry(5.4, 13, 5.4), color: DARK, matrix: mat4(0, 6.5, 0) });
    boxEdges(lines, 0, 0, 0, 5.4, 13, 5.4, th, col);
    for (let f = 0; f < 4; f++) {
      const y = 2.4 + f * 3;
      lines.push(seg([-2.9, y - 1.1, 2.9], [2.9, y - 1.1, 2.9], 0.26, CYA));
      lines.push(seg([-2.9, y - 0.2, 2.9], [2.9, y - 0.2, 2.9], 0.16, CYA));
      for (const x of [-1.4, 1.4]) lines.push({ geo: new THREE.BoxGeometry(1.0, 1.3, 0.06), color: new THREE.Color(f % 2 ? 0xffa040 : 0xff5ad0), matrix: mat4(x, y + 0.5, 2.72) });
    }
    lines.push(seg([-2.7, 13, -2.7], [-2.7, 15, -2.7], 0.12, MAG));
    lines.push(seg([2.7, 13, 2.7], [2.7, 14.6, 2.7], 0.12, MAG));
  } else { // round tower with a cap
    body.push({ geo: new THREE.CylinderGeometry(2.1, 2.6, 10, 10), color: DARK, matrix: mat4(0, 5, 0) });
    body.push({ geo: new THREE.ConeGeometry(2.9, 3.6, 10), color: 0x1c0f3e, matrix: mat4(0, 11.8, 0) });
    for (const y of [0.1, 3.4, 6.7, 10]) lines.push(ring(2.15 + (10 - y) * -0.04 + 0.3, 0.11, TAU, y > 5 ? col : MAG, mat4(0, y, 0, Math.PI / 2, 0, 0), 4, 14));
    lines.push(ring(2.95, 0.12, TAU, ORG, mat4(0, 10, 0, Math.PI / 2, 0, 0), 4, 14));
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; lines.push(seg([Math.cos(a) * 2.95, 10, Math.sin(a) * 2.95], [0, 13.6, 0], 0.1, VIO)); }
    for (let k = 0; k < 8; k++) { const a = k * 0.8; lines.push({ geo: new THREE.BoxGeometry(0.5, 0.9, 0.05), color: new THREE.Color(0xffa040), matrix: mat4(Math.cos(a) * 2.35, 2 + (k % 4) * 2.2, Math.sin(a) * 2.35, 0, -a + Math.PI / 2, 0) }); }
  }
  return { body: mergeColored(body), lines: mergeColored(lines) };
}

function geoPlinth() {
  const p = [];
  [[3.6, MAG, 0.25], [2.8, CYA, 0.8], [2.0, ORG, 1.35]].forEach(([r, c, y]) => p.push(ring(r, 0.14, TAU, c, mat4(0, y, 0, Math.PI / 2, 0, 0), 4, 22)));
  p.push({ geo: new THREE.IcosahedronGeometry(1.25, 1), color: ORG, matrix: mat4(0, 3.8, 0) });
  p.push(ring(1.9, 0.1, TAU, MAG, mat4(0, 3.8, 0, 1.2, 0.3, 0), 4, 22));
  p.push(ring(1.7, 0.1, TAU, CYA, mat4(0, 3.8, 0, 0.2, 0, 1.1), 4, 22));
  p.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), color: VIO, matrix: mat4(0, 1.4, 0) });
  return mergeColored(p);
}

function geoLamp() {
  const p = [seg([0, 0, 0], [0, 7.4, 0], 0.18, CYA), seg([0, 7.4, 0], [1.6, 7.9, 0], 0.14, CYA), seg([0, 3.0, 0], [0, 3.1, 0], 0.3, MAG)];
  p.push({ geo: new THREE.IcosahedronGeometry(0.42, 1), color: PCH, matrix: mat4(1.6, 7.7, 0) });
  p.push(ring(0.62, 0.07, TAU, MAG, mat4(1.6, 7.7, 0), 4, 12));
  return mergeColored(p);
}

function geoBoat(sail) {
  const p = [];
  const hull = (z0, z1, w0, w1, y0) => [[-w0, 0.9, z0], [w0, 0.9, z0], [w1, y0, z1], [-w1, y0, z1]];
  const a = [[-1.2, 1, -3.6], [1.2, 1, -3.6], [1.4, 1, 3.2], [-1.4, 1, 3.2], [0, 0.2, -3], [0, 0.2, 2.6], [0, 1, 5.2]];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [4, 5], [3, 5], [2, 5], [2, 6], [3, 6]];
  for (const [i, j] of e) p.push(seg(a[i], a[j], 0.16, ORG));
  void hull;
  p.push(seg([0, 1, 0], [0, 9.6, 0.3], 0.14, CYA));
  p.push(seg([0, 4, 0.3], [0, 1.3, -3.4], 0.1, MAG));
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.6, 2.4, 0, 9.2, 0.4, 0, 1.6, -0.2], 3));
  const cs = [new THREE.Color(MAG), new THREE.Color(PCH), new THREE.Color(ORG)];
  tri.setAttribute('color', new THREE.Float32BufferAttribute(cs.flatMap((c) => [c.r, c.g, c.b]), 3));
  const body = mergeColored(p);
  void sail;
  return { body, sail: tri };
}

// ---------- the world ----------

export default {
  id: 'neon',

  track: {
    seed: 71,
    scale: 0.9,
    width: 19,
    points: [
      [0, 190, 0], [140, 195, 0], [250, 165, 0], [310, 85, 0], [300, -10, 2], [250, -85, 6], [170, -125, 10], [100, -120, 14],
      [50, -75, 18], [85, -15, 21], [140, -30, 22], [195, 20, 20], [185, 85, 15], [130, 115, 10], [40, 105, 6], [-60, 95, 4],
      [-150, 108, 2], [-215, 160, 0], [-165, 222, 0], [-65, 205, 0],
    ],
    itemRows: [0.12, 0.34, 0.58, 0.82],
    boostPads: [[0.25, 0], [0.5, 0], [0.78, 0]],
    obstacles: [
      { kind: 'roller', at: 0.19, count: 2, size: 1.5, period: 4, skin: 'orb' },
      { kind: 'cones', at: 0.4, lat: 4, count: 7, skin: 'cube' },
      { kind: 'popper', at: 0.66, lat: -3, period: 3, skin: 'pulse' },
      { kind: 'traffic', at: 0.72, count: 2, speed: 9, lat: 3, skin: 'car' },
      { kind: 'bouncer', at: 0.9, lat: 3, size: 2.2, skin: 'pad' },
      { kind: 'ramp', at: 0.955, lat: 0, size: 6 },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 101), cx = bounds.cx, cz = bounds.cz;
    const a = new T.Color(0x0a0618), b = new T.Color(0x150a34), hi = new T.Color(0x20104e), shore = new T.Color(0x3a0c52);
    return {
      night: true,
      sky: { top: 0x020008, mid: 0x1a0a44, bottom: 0x2a1050, sunColor: 0xff4fd8, sunDir: [-0.5, 0.1, -0.8], stars: 1, aurora: 0.55 },
      fog: { color: 0x2a1050, near: 150, far: 850 },
      light: { sun: 0xb8a8ff, sunI: 0.9, sky: 0xc8b8ff, ground: 0x7a48d0, hemiI: 1.9 },
      water: { level: -3, shallow: 0x1a0b3a, deep: 0x05020f, foam: 0xff2bd6, ice: 1 },
      road: { tint: 0x2a1f48, line: '#19e6ff', curbA: '#ff2bd6', curbB: '#19e6ff', shoulder: 0x1a1030 },
      clouds: { color: 0x442a88, count: 0, minY: 200, maxY: 260 },
      ambient: { kind: 'pollen', color: 0xff7af0, cfg: { n: 220, box: 70, size: 0.2, vel: [0.3, 0.4, 0.2], op: 0.8 } },
      detail: { strokes: 0, kind: 'sparkle' },
      blendNear: 6, blendFar: 36,
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz);
        let h = N.fbm(x * 0.006, z * 0.006, 3) * 5 + 3;
        const lake = smoothstep(0.08, 0.45, -N2.fbm(x * 0.0045 + 5, z * 0.0045, 2));
        h -= lake * 15;
        const m = smoothstep(300, 620, r);
        const ridge = 1 - Math.abs(N2.noise(x * 0.007 + 3, z * 0.007));
        h += m * m * 60 + m * Math.pow(ridge, 2.6) * 170;
        return h;
      },
      color(x, z, h, slope, d, out) {
        mix3(out, a, b, N.noise(x * 0.02, z * 0.02) * 0.5 + 0.5);
        if (h > 30) mix3(out, out, hi, smoothstep(30, 110, h));
        if (h < 0) mix3(out, out, shore, smoothstep(0, -3, h));
        return out;
      },
      onBuilt(world, kit2) { restyle(world, kit2); },
    };
  },

  scenery(w, kit) {
    const { instanced, alongTrack, scatter } = kit;
    const tr = w.track, rnd = w.rnd, M = w.mats.scenery, b = tr.bounds, arena = !!w.def.arena;
    const U = new THREE.MeshBasicMaterial({ vertexColors: true });
    const UD = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const glow = []; // { x, y, z, c, s }
    const addGlow = (x, y, z, c, s) => glow.push({ x, y, z, c: new THREE.Color(c), s });
    const away = (x, z) => !arena || Math.hypot(x - b.cx, z - b.cz) > 76;
    const faceRoad = (o) => { const h = tr.headingAt(o.trackS); o.ry = h + (o.side > 0 ? Math.PI / 2 : -Math.PI / 2); return o; };

    // Glowing trees.
    const pals = [[ORG, 0xffa860, MAG, 0xffd0a0], [MAG, 0xff7ac0, VIO, ORG], [CYA, 0x7af0ff, VIO, 0xff8ad8]];
    for (let v = 0; v < 3; v++) {
      const list = scatter(w, { count: arena ? 10 : 22, minH: -1.5, maxSlope: 0.5, s0: 0.9, s1: 1.7, radius: arena ? 260 : 430, minD: tr.limit + 10 }).filter((o) => away(o.x, o.z));
      instanced(w, geoGlowTree(rnd, pals[v]), U, list, 0);
      for (const o of list) addGlow(o.x, o.y + 7.4 * o.s, o.z, pals[v][0], 12 * o.s);
    }

    // Houses drawn with glowing edges.
    for (let k = 0; k < 3; k++) {
      const { body, lines } = geoNeonHouse(k, [ORG, CYA, VIO][k]);
      const list = alongTrack(w, { count: arena ? 12 : 16, d0: 14, d1: 34, minH: -1, phase: k * 0.3 }).filter((o) => away(o.x, o.z)).map(faceRoad);
      instanced(w, body, M, list, 3.5);
      instanced(w, lines, U, list, 0);
    }

    // Light posts with overhead cables.
    {
      const lamps = [], cab = [], cnt = Math.floor(tr.length / 34), p = new THREE.Vector3(), prev = [null, null];
      for (let k = 0; k < cnt; k++) {
        const s = (k / cnt) * tr.n, side = k % 2 ? 1 : -1;
        tr.posAt(s, side * (tr.halfWidth + tr.curb + 2), p);
        const y = w.heightAt(p.x, p.z), ry = tr.headingAt(s) + (side > 0 ? 0 : Math.PI);
        lamps.push({ x: p.x, y, z: p.z, ry, s: 1 });
        const tx = p.x + Math.cos(ry) * 1.6, tz = p.z - Math.sin(ry) * 1.6, ty = y + 7.7;
        addGlow(tx, ty, tz, PCH, 5);
        const q = prev[k % 2];
        if (q && Math.hypot(tx - q[0], tz - q[2]) < 60) for (let i = 0; i < 6; i++) {
          const f0 = i / 6, f1 = (i + 1) / 6, sg = (f) => Math.sin(f * Math.PI) * 1.6;
          cab.push(seg([lerp(q[0], tx, f0), lerp(q[1], ty, f0) - sg(f0), lerp(q[2], tz, f0)], [lerp(q[0], tx, f1), lerp(q[1], ty, f1) - sg(f1), lerp(q[2], tz, f1)], 0.07, MAG));
        }
        prev[k % 2] = [tx, ty, tz];
      }
      instanced(w, geoLamp(), U, lamps, 0);
      if (cab.length) w.scene.add(new THREE.Mesh(mergeColored(cab), U));
    }

    // Arches over the road: two rings and a soft halo, pulsing together.
    {
      const fr = arena ? [0, 0.25, 0.5, 0.75] : [0.17, 0.3, 0.44, 0.57, 0.74, 0.93];
      const A = [], A2 = [], H = [];
      fr.forEach((f, k) => {
        const i = Math.floor(f * tr.n), c = new THREE.Color(PAL[k % 4]);
        const it = { x: tr.px[i], y: tr.py[i] - 0.3, z: tr.pz[i], ry: tr.heading[i], s: 1, color: c };
        A.push(it); A2.push({ ...it, color: new THREE.Color(PAL[(k + 2) % 4]) }); H.push({ ...it, color: c.clone().multiplyScalar(0.5) });
        addGlow(it.x, it.y + tr.limit + 4, it.z, PAL[k % 4], 16);
      });
      const R = tr.limit + 4;
      instanced(w, new THREE.TorusGeometry(R, 0.5, 5, 28, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }), A, 0);
      instanced(w, new THREE.TorusGeometry(R - 2.6, 0.24, 4, 28, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }), A2, 0);
      const hm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      instanced(w, new THREE.TorusGeometry(R, 1.9, 4, 20, Math.PI), hm, H, 0);
      w.updaters.push((dt, t) => { hm.opacity = 0.17 + 0.07 * Math.sin(t * 2.2); });
    }

    // Ring sculptures: glowing orb on stacked rings.
    instanced(w, geoPlinth(), U, alongTrack(w, { count: arena ? 4 : 7, d0: 20, d1: 40, minH: -1, s0: 1.2, s1: 1.8 }).filter((o) => away(o.x, o.z)).map((o) => { addGlow(o.x, o.y + 3.8 * o.s, o.z, ORG, 11 * o.s); return o; }), 0);

    // Big rings hanging in the sky.
    {
      const list = [], n = 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + 0.4, d = 420 + rnd() * 80, R = 55 + rnd() * 45;
        const x = b.cx + Math.cos(a) * d, z = b.cz + Math.sin(a) * d, y = 130 + rnd() * 70;
        list.push({ x, y, z, ry: -a + Math.PI / 2, s: R / 50, color: new THREE.Color(PAL[k % 4]) });
        addGlow(x, y + R * 0.5, z, PAL[k % 4], R * 2.4);
      }
      instanced(w, new THREE.TorusGeometry(50, 1.4, 5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), list, 0);
    }

    // Lakes: mirrored neon streaks and a glowing sailboat.
    {
      const spots = [], wl = w.theme.water.level;
      for (let k = 0; k < 900 && spots.length < 140; k++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * 520, x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
        if (w.heightAt(x, z) < wl - 1.2) spots.push({ x, z });
      }
      const streaks = spots.map((p, k) => {
        const dir = Math.atan2(b.cx - p.x, b.cz - p.z);
        return { x: p.x, y: wl + 0.08, z: p.z, ry: dir, s: 1, sy: 1, color: new THREE.Color(PAL[k % 4]).multiplyScalar(0.7) };
      });
      const sg = new THREE.PlaneGeometry(0.5, 1); sg.rotateX(-Math.PI / 2); sg.scale(1, 1, 1);
      const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
      const sx = [];
      streaks.forEach((s) => { sx.push({ ...s, s: 1.2 + rnd() * 1.6 }); });
      const mesh = instanced(w, sg, sm, sx.map((s) => ({ ...s })), 0);
      if (mesh) { mesh.renderOrder = 2; const d = new THREE.Object3D(); sx.forEach((s, i) => { d.position.set(s.x, s.y, s.z); d.rotation.set(0, s.ry, 0); d.scale.set(s.s, 1, s.s * (6 + (i % 5) * 3)); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }); }
      if (spots.length) {
        const { body, sail } = geoBoat();
        const boats = [], placed = [];
        for (const p of spots) {
          if (placed.length >= 3) break;
          if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 60)) continue;
          tr.distInfo(p.x, p.z, {}); const info = {}; tr.distInfo(p.x, p.z, info);
          if (info.d < 40) continue;
          placed.push(p);
          boats.push({ x: p.x, y: wl, z: p.z, ry: rnd() * TAU, s: 1.5 + rnd() * 0.8 });
          addGlow(p.x, wl + 8, p.z, MAG, 16);
        }
        if (boats.length) { instanced(w, body, U, boats, 0); instanced(w, sail, UD, boats, 0); }
      }
    }

    // Tiny glowing dots in the dark grass, and the glow points for everything above.
    for (const o of scatter(w, { count: arena ? 120 : 260, minH: -1, maxD: 90, s0: 1, radius: 460 })) addGlow(o.x, o.y + 0.3, o.z, PAL[Math.floor(rnd() * 4)], 0.9);
    glowPoints(w, glow);
  },

  song: {
    bpm: 140, style: 'neon', lead: 'square',
    chords: 'Am Am F G Am Am F E F G Am C F G E Am',
    melody: [
      'a5/2 e5/2 a5/2 c6/2 e6/4 c6/4', 'b5/2 e5/2 b5/2 d6/2 e6/4 d6/2 b5/2', 'a5/2 c6/2 f6/4 e6/2 c6/2 a5/4', 'g5/2 b5/2 d6/4 g6/4 d6/2 b5/2',
      'e6/4 e6/2 d6/2 c6/4 a5/4', 'c6/2 e6/2 a6/4 g6/2 e6/2 c6/4', 'f6/4 e6/2 c6/2 a5/4 c6/4', 'g#5/2 b5/2 e6/4 d6/2 b5/2 g#5/4',
      'a5/2 c6/2 f6/2 a6/2 f6/4 c6/4', 'b5/2 d6/2 g6/2 b6/2 g6/4 d6/4', 'a6/4 e6/4 c6/4 e6/4', 'e6/2 g6/2 e6/4 c6/2 e6/2 g6/4',
      'f6/4 c6/2 a5/2 f5/4 a5/4', 'g5/2 b5/2 d6/2 g6/2 d6/4 b5/4', 'e6/2 g#5/2 b5/2 e6/2 g#6/4 e6/4', 'a5/8 -/4 e5/2 a5/2',
    ],
  },

  // Steady four-on-the-floor kick and a busy sixteenth-note saw bass.
  style: {
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15], hatVol: 0.4,
    bass: [[0, 0], [2, 0], [3, 12], [4, 0], [6, 0], [7, 7], [8, 0], [10, 0], [11, 12], [12, 0], [14, 0], [15, 7]],
    bassLen: 1.2, comp: 'strum', level: 1,
  },

  chip: 'linear-gradient(165deg,#05030f 0 50%,#3a0f6a 50% 58%,#ff2bd6 58% 60%,#05030f 60% 72%,#19e6ff 72% 74%,#05030f 74% 84%,#ff8a2a 84% 85.5%,#05030f 85.5% 100%)',

  strings: {
    en: { name: 'Neon Night', sub: 'Glowing lines in the dark' },
    nl: { name: 'Neonnacht', sub: 'Gloeiende lijnen in het donker' },
  },

  skins: {
    // Glowing orb.
    roller(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({ color: 0xff8a2a })));
      const r1 = new T.Mesh(new T.TorusGeometry(1.03, 0.07, 4, 24), new T.MeshBasicMaterial({ color: 0xff2bd6 })); r1.rotation.x = Math.PI / 2;
      const r2 = new T.Mesh(new T.TorusGeometry(1.03, 0.07, 4, 24), new T.MeshBasicMaterial({ color: 0x19e6ff })); r2.rotation.y = 0.4;
      g.add(r1, r2);
      return g;
    },
    // Pulse ring on a post.
    popper(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 1, 6), new T.MeshBasicMaterial({ color: 0x8a5cff })).translateY(0.5));
      const r = new T.Mesh(new T.TorusGeometry(0.62, 0.1, 5, 20), new T.MeshBasicMaterial({ color: 0xff2bd6 })); r.position.y = 1.0; r.rotation.x = Math.PI / 2;
      const s = new T.Mesh(new T.IcosahedronGeometry(0.34, 1), new T.MeshBasicMaterial({ color: 0xffc27a })); s.position.y = 1.0;
      g.add(r, s);
      return g;
    },
    // Little toy car with glowing edges.
    traffic(kit) {
      const T = kit.THREE, g = new T.Group(), lines = [];
      boxEdges(lines, 0, 0.35, 0, 1.1, 0.5, 2, 0.06, CYA);
      boxEdges(lines, 0, 0.85, -0.1, 0.8, 0.4, 1, 0.05, MAG);
      g.add(new T.Mesh(kit.mergeColored([{ geo: new T.BoxGeometry(1.1, 0.5, 2), color: 0x180c38, matrix: kit.mat4(0, 0.6, 0) }, { geo: new T.BoxGeometry(0.8, 0.4, 1), color: 0x180c38, matrix: kit.mat4(0, 1.05, -0.1) }]), new T.MeshLambertMaterial({ vertexColors: true })));
      g.add(new T.Mesh(mergeColored(lines), new T.MeshBasicMaterial({ vertexColors: true })));
      for (const [x, z] of [[-0.6, -0.65], [0.6, -0.65], [-0.6, 0.65], [0.6, 0.65]]) {
        const w = new T.Mesh(new T.TorusGeometry(0.22, 0.07, 4, 12), new T.MeshBasicMaterial({ color: 0xff8a2a })); w.rotation.y = Math.PI / 2; w.position.set(x, 0.24, z); g.add(w);
      }
      return g;
    },
    // Glowing cube.
    cones(kit) {
      const T = kit.THREE, g = new T.Group(), lines = [];
      boxEdges(lines, 0, 0, 0, 0.8, 0.8, 0.8, 0.07, ORG);
      g.add(new T.Mesh(new T.BoxGeometry(0.74, 0.74, 0.74), new T.MeshBasicMaterial({ color: 0x2a1060 })).translateY(0.4));
      g.add(new T.Mesh(mergeColored(lines), new T.MeshBasicMaterial({ vertexColors: true })));
      return g;
    },
    // Bounce pad with rings.
    bouncer(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(new T.CylinderGeometry(1, 1, 0.12, 20), new T.MeshBasicMaterial({ color: 0x1a0c40 })).translateY(0.06));
      [[0.94, 0xff2bd6], [0.62, 0x19e6ff], [0.3, 0xff8a2a]].forEach(([r, c]) => { const t = new T.Mesh(new T.TorusGeometry(r, 0.05, 4, 24), new T.MeshBasicMaterial({ color: c })); t.rotation.x = Math.PI / 2; t.position.y = 0.14; g.add(t); });
      return g;
    },
    // Glowing bar.
    spinner(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(new T.BoxGeometry(1, 0.1, 0.1), new T.MeshBasicMaterial({ color: 0xff2bd6 })).translateX(0.5).translateY(0.5));
      g.add(new T.Mesh(new T.IcosahedronGeometry(0.1, 1), new T.MeshBasicMaterial({ color: 0x19e6ff })).translateX(1).translateY(0.5));
      return g;
    },
  },
};

// ---------- helpers that need the built world ----------

function glowPoints(w, list) {
  if (!list.length) return;
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
  list.forEach((g, i) => { pos.set([g.x, g.y, g.z], i * 3); col.set([g.c.r, g.c.g, g.c.b], i * 3); sz[i] = g.s; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 }, uPulse: { value: 1 } },
    vertexShader: `attribute float aSize; attribute vec3 aCol; uniform float uScale; varying vec3 vC; varying float vA;
void main(){ vC = aCol; vec4 mv = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = max(-mv.z, 0.1);
gl_PointSize = min(aSize * uScale / d, 150.0); vA = smoothstep(520.0, 140.0, d) * smoothstep(0.5, 3.0, d); }`,
    fragmentShader: `uniform float uPulse; varying vec3 vC; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(1.0 - d, 0.0), 2.2) * vA * uPulse * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(vC, a);
#include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  w.scene.add(pts);
  w.pointScaleUniforms.push(mat.uniforms.uScale);
  w.updaters.push((dt, t) => { mat.uniforms.uPulse.value = 0.85 + 0.15 * Math.sin(t * 2.6); });
}

function roadCanvas(body) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = body ? '#150b30' : '#000'; g.fillRect(0, 0, 256, 256);
  const edge = (x0, dir, col, rgb) => {
    const gr = g.createLinearGradient(x0, 0, x0 + dir * 44, 0);
    gr.addColorStop(0, `rgba(${rgb},0.7)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(dir > 0 ? x0 : x0 - 44, 0, 44, 256);
    g.fillStyle = col; g.fillRect(dir > 0 ? x0 - 8 : x0 - 4, 0, 12, 256);
  };
  edge(14, 1, '#19e6ff', '25,230,255');
  edge(242, -1, '#ff2bd6', '255,43,214');
  g.fillStyle = '#ff8a2a';
  g.fillRect(124, 24, 8, 88); g.fillRect(124, 152, 8, 88);
  g.fillStyle = body ? 'rgba(138,92,255,0.35)' : 'rgba(138,92,255,0.5)';
  g.fillRect(72, 0, 3, 256); g.fillRect(181, 0, 3, 256);
  return canvasTexture(c, { repeat: true });
}

function streakTexture(rnd) {
  const c = makeCanvas(128, 256), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
  const cols = ['255,138,42', '255,43,214', '25,230,255', '138,92,255'];
  for (let i = 0; i < 16; i++) {
    const x = rnd() * 124, y = rnd() * 256, l = 50 + rnd() * 110, rgb = cols[Math.floor(rnd() * 4)];
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    for (const oy of [0, -256]) g.fillRect(x, y + oy, 2 + rnd() * 3, l);
  }
  return canvasTexture(c, { repeat: true });
}

function ribbon(tr, lat0, lat1, up, vLen, colorAt) {
  const n = tr.n, pos = [], uv = [], col = [], idx = [], p = new THREE.Vector3();
  for (let r = 0; r <= n; r++) {
    const i = r % n;
    for (const [k, lat] of [[0, lat0], [1, lat1]]) {
      tr.posAt(i, lat, p);
      pos.push(p.x, p.y + up, p.z); uv.push(k, (r * tr.seg) / vLen);
      if (colorAt) { const c = colorAt(i, k); col.push(c.r, c.g, c.b); }
    }
  }
  for (let r = 0; r < n; r++) { const a = r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Restyles the road, curbs and terrain once the world is built (theme hook).
function restyle(world, kit) {
  const tr = world.track, rnd = world.rnd, n = tr.n;
  const mats = [];
  world.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.uv || !o.material.map || !o.material.isMeshLambertMaterial) return;
    const cnt = o.geometry.attributes.position.count;
    if (cnt === (n + 1) * 2) mats.push(['road', o]); else if (cnt === (n + 1) * 4) mats.push(['curb', o]);
  });
  for (const [what, o] of mats) {
    if (what === 'road') {
      o.material = new THREE.MeshLambertMaterial({ map: roadCanvas(true), emissiveMap: roadCanvas(false), emissive: 0xffffff, color: 0xc8b8f0 });
    } else o.material = new THREE.MeshBasicMaterial({ map: o.material.map });
  }
  // Soft coloured glow beside the road, cycling cyan, magenta, orange and violet along the lap.
  const tmp = new THREE.Color(), cyc = [new THREE.Color(CYA), new THREE.Color(MAG), new THREE.Color(ORG), new THREE.Color(VIO)];
  const colorAt = (i, k) => {
    const f = (i / n) * 4, a = Math.floor(f) % 4, b = (a + 1) % 4;
    tmp.copy(cyc[a]).lerp(cyc[b], smoothstep(0.55, 1, f - Math.floor(f)));
    return tmp.multiplyScalar(k ? 0 : 0.55);
  };
  const hw = tr.halfWidth + tr.curb;
  for (const side of [-1, 1]) {
    const g = ribbon(tr, side * hw, side * (hw + 5), 0.12, 6, colorAt);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.renderOrder = 2;
    world.scene.add(m);
  }
  // Light trails sliding along the road.
  const tex = streakTexture(rnd);
  const tm = new THREE.Mesh(ribbon(tr, -tr.halfWidth + 1, tr.halfWidth - 1, 0.06, 24, null), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  tm.renderOrder = 2;
  world.scene.add(tm);
  world.updaters.push((dt) => { tex.offset.y -= dt * 0.9; });
  // Terrain: dark body with glowing contour lines (unlit).
  const tm2 = world.terrainMesh, geo = tm2.geometry;
  geo.setAttribute('aD', new THREE.BufferAttribute(Float32Array.from(world.dists), 1));
  tm2.material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexColors: true, fog: true,
    vertexShader: `attribute float aD; varying vec3 vW; varying vec3 vCol; varying vec3 vN; varying float vD;
#include <fog_pars_vertex>
void main(){ vW = position; vCol = color; vN = normal; vD = aD; vec4 mvPosition = viewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `varying vec3 vW; varying vec3 vCol; varying vec3 vN; varying float vD;
#include <fog_pars_fragment>
void main(){
  float f = vW.y * 0.42 + 0.55 * sin(vW.x * 0.021 + vW.z * 0.013) + 0.5 * sin(vW.z * 0.026 - vW.x * 0.009);
  float fw = max(fwidth(f), 0.0005);
  float d = min(fract(f), 1.0 - fract(f));
  float line = 1.0 - smoothstep(fw * 0.5, fw * 1.7, d);
  float halo = 1.0 - smoothstep(0.0, min(fw * 5.0, 0.05), d);
  float t = sin(vW.x * 0.004 + vW.z * 0.0031 + vW.y * 0.03);
  vec3 cA = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.17, 0.84), smoothstep(-0.4, 0.3, t));
  vec3 cB = mix(cA, vec3(1.0, 0.54, 0.16), smoothstep(0.35, 0.9, t));
  float near = smoothstep(15.0, 32.0, vD) * smoothstep(0.0015, 0.008, fw) * (1.0 - smoothstep(0.2, 0.55, fw)) * (1.0 - 0.5 * smoothstep(250.0, 700.0, vFogDepth));
  float fd = vD / 5.5; float fwd = max(fwidth(fd), 0.0005);
  float dd = min(fract(fd), 1.0 - fract(fd));
  float rl = (1.0 - smoothstep(fwd * 0.7, fwd * 2.0, dd)) * smoothstep(11.0, 15.0, vD) * (1.0 - smoothstep(34.0, 70.0, vD)) * (1.0 - smoothstep(0.1, 0.4, fwd));
  float lit = 0.35 + 0.65 * max(normalize(vN).y, 0.0);
  vec3 c = vCol * lit * 1.6 + cB * (line * 1.1 + halo * 0.22) * near + cB * rl * 0.6;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  tm2.receiveShadow = false;
  void kit;
}
