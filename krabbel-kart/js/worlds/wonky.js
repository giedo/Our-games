// Wonky Town: a crooked cartoon town at dusk. Magenta, teal, orange and purple, with dark
// outlines made of colour: leaning bent houses, glowing windows, curly swirl trees, wonky lamps,
// a hump-back bridge over a canal with a crooked boat, and chalk doodles on the ground.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeColored, mat4, TAU, lerp, clamp, smoothstep, makeCanvas, canvasTexture, mix3 } from '../util.js';

const MAG = 0xd8328f, MAG2 = 0xa8266f, PINK = 0xff6fb0, TEAL = 0x1fa8a0, TEAL2 = 0x137f8c, MINT = 0x5fd8c8;
const ORG = 0xff8a2a, ORG2 = 0xf0601c, PUR = 0x6a3aa0, PUR2 = 0x8f5cc8, INK = 0x2a1740, CREAM = 0xf4d9b0, BRICK = 0xa8452f;
const WIN = [0xffd27a, 0xffa84a, 0xffc060, 0xff7ac0, 0x7ff0e0];

// ---------- crooked geometry helpers ----------

// Bends a point: leans (quadratic in height), tapers, twists, wobbles. o = { h, lx, lz, taper, twist, wob, ph }
function bendPt(o, x, y, z, out) {
  const t = clamp(y / o.h, 0, 1.4), k = 1 - o.taper * Math.min(t, 1), c = Math.cos(o.twist * t), s = Math.sin(o.twist * t);
  out.set((x * c - z * s) * k + o.lx * t * t * o.h + Math.sin(t * 4 + o.ph) * o.wob, y, (x * s + z * c) * k + o.lz * t * t * o.h);
  return out;
}
const _v = new THREE.Vector3();
function bendGeo(g, o) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { bendPt(o, p.getX(i), p.getY(i), p.getZ(i), _v); p.setXYZ(i, _v.x, _v.y, _v.z); }
  return g;
}
function tube(pts, r0, r1, seg = 10, rad = 5) {
  const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const g = new THREE.TubeGeometry(cv, seg, 1, rad, false);
  const p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    cv.getPointAt(i / seg, c);
    const r = lerp(r0, r1, i / seg);
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  return g;
}

// One crooked house. Returns { geo, wins } with the windows as separate bent boxes (they glow).
const VARIANTS = [
  { w: 5.2, d: 4.6, floors: 3, fh: 3, wall: [MAG, PINK], roof: TEAL, rh: 3.8, skew: 1.0, lx: 0.1, lz: 0.03, taper: 0.2, twist: 0.06, aerial: true, door: ORG },
  { w: 8, d: 5.2, floors: 2, fh: 3.2, wall: [TEAL, TEAL2], roof: PUR, rh: 2.6, skew: -0.8, lx: -0.08, lz: 0.02, taper: 0.1, twist: -0.04, shop: true, door: MAG },
  { w: 6, d: 5, floors: 2, fh: 3, wall: [ORG, ORG2], roof: MAG, rh: 3.2, skew: -1.2, lx: 0.12, lz: -0.03, taper: 0.15, twist: 0.05, door: TEAL2, chim: 1 },
  { w: 4.6, d: 4.6, floors: 4, fh: 3, wall: [PUR, PUR2], roof: ORG, rh: 5.5, skew: 0.6, lx: -0.14, lz: 0.05, taper: 0.34, twist: 0.1, aerial: true, door: PINK },
  { w: 6.6, d: 5.4, floors: 3, fh: 3, wall: [CREAM, PINK, MINT], roof: TEAL2, rh: 3, skew: 1.4, zig: 1.6, lx: 0.06, lz: 0, taper: 0.12, twist: -0.06, door: PUR, chim: 2 },
  { w: 9, d: 5.6, floors: 2, fh: 3.4, wall: [MAG2, ORG], roof: ORG2, rh: 3.4, skew: 1.5, lx: 0.09, lz: 0.02, taper: 0.08, twist: 0.05, shop: true, door: TEAL, chim: 2 },
  { w: 3.8, d: 4, floors: 5, fh: 2.9, wall: [TEAL, PUR2], roof: MAG, rh: 4.5, skew: -1.0, lx: -0.18, lz: 0.04, taper: 0.3, twist: 0.12, aerial: true, door: ORG },
  { w: 7, d: 5.8, floors: 2, fh: 3.4, wall: [ORG, PUR], roof: TEAL2, rh: 3.4, skew: 0.9, lx: 0.1, lz: -0.04, taper: 0.18, twist: -0.08, door: PINK, chim: 2 },
  { w: 5.6, d: 5, floors: 3, fh: 3.1, wall: [MAG, TEAL, MAG], roof: PUR, rh: 4.2, skew: -1.5, lx: -0.1, lz: 0.03, taper: 0.22, twist: 0.09, aerial: true, door: CREAM },
];

function geoHouse(rnd, v) {
  const parts = [], wins = [], H = v.floors * v.fh, top = 0.6 + H, zig = v.zig || 0.5;
  parts.push({ geo: new THREE.BoxGeometry(v.w + 0.6, 0.6, v.d + 0.6), color: INK, matrix: mat4(0, 0.3, 0) });
  let ox = 0;
  for (let f = 0; f < v.floors; f++) {
    ox = (f % 2 ? 0.5 : -0.4) * zig * (f ? 1 : 0);
    const ww = v.w * (1 + 0.07 * f), y0 = 0.6 + v.fh * f;
    parts.push({ geo: new THREE.BoxGeometry(ww, v.fh, v.d, 1, 2, 1), color: v.wall[f % v.wall.length], matrix: mat4(ox, y0 + v.fh / 2, 0) });
    parts.push({ geo: new THREE.BoxGeometry(ww + 0.35, 0.3, v.d + 0.35), color: INK, matrix: mat4(ox, y0 + v.fh - 0.1, 0) });
    const cols = Math.max(2, Math.round(ww / 2.5));
    for (let c = 0; c < cols; c++) {
      const x = ox + (c - (cols - 1) / 2) * (ww / cols);
      if (f === 0 && c === 0) { // door
        parts.push({ geo: new THREE.BoxGeometry(1.5, 2.5, 0.2), color: INK, matrix: mat4(x, y0 + 1.25, v.d / 2 + 0.04) });
        parts.push({ geo: new THREE.BoxGeometry(1.1, 2.2, 0.2), color: v.door, matrix: mat4(x, y0 + 1.1, v.d / 2 + 0.1) });
        parts.push({ geo: new THREE.IcosahedronGeometry(0.1, 0), color: CREAM, matrix: mat4(x + 0.3, y0 + 1.1, v.d / 2 + 0.25) });
        continue;
      }
      const big = v.shop && f === 0;
      const wd = big ? 2.1 : 1.15, ht = big ? 1.6 : 1.5, yy = y0 + (big ? 1.4 : v.fh * 0.55);
      parts.push({ geo: new THREE.BoxGeometry(wd + 0.4, ht + 0.4, 0.2), color: INK, matrix: mat4(x, yy, v.d / 2 + 0.04) });
      wins.push({ x, y: yy, z: v.d / 2 + 0.16, w: wd, h: ht });
    }
  }
  if (v.shop) for (let k = 0; k < 6; k++) parts.push({ geo: new THREE.BoxGeometry(v.w / 6, 0.14, 1.5), color: k % 2 ? CREAM : ORG, matrix: mat4(-v.w / 2 + v.w / 12 + k * (v.w / 6), 3.2, v.d / 2 + 0.7, -0.3, 0, 0) });
  // roof: a skewed pyramid with a dark rim
  const side = v.w * (1 + 0.07 * (v.floors - 1)) + 1.4, r = side / Math.SQRT2;
  const roof = new THREE.ConeGeometry(r, v.rh, 4, 3); roof.rotateY(Math.PI / 4); roof.translate(0, v.rh / 2, 0);
  const rp = roof.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setX(i, rp.getX(i) + v.skew * Math.pow(Math.max(0, rp.getY(i) / v.rh), 1.6));
  parts.push({ geo: roof, color: v.roof, matrix: mat4(ox, top, 0, 0, 0, 0, 1, 1, (v.d + 1.4) / side) });
  parts.push({ geo: new THREE.BoxGeometry(side, 0.35, v.d + 1.4), color: INK, matrix: mat4(ox, top, 0) });
  for (let c = 0; c < (v.chim || 1); c++) {
    const cx = ox + (c ? -1 : 1) * v.w * 0.22, cy = top + v.rh * 0.35;
    for (let k = 0; k < 3; k++) parts.push({ geo: new THREE.BoxGeometry(0.95 - k * 0.1, 1.1, 0.95 - k * 0.1), color: k === 2 ? INK : BRICK, matrix: mat4(cx + k * 0.22 + (c ? 0.2 : 0), cy + k * 1.05, 0.3, 0, 0, -0.1 * k) });
  }
  if (v.aerial) {
    const ax = ox + v.skew * 0.9, ay = top + v.rh * 0.95;
    parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 2.8, 4), color: INK, matrix: mat4(ax, ay + 1.2, 0, 0, 0, -0.25) });
    for (const [k, l] of [[0.6, 1.4], [1.2, 1.0], [1.8, 0.7]]) parts.push({ geo: new THREE.BoxGeometry(l, 0.05, 0.05), color: INK, matrix: mat4(ax - k * 0.25, ay + k, 0, 0, 0, -0.25) });
  }
  const o = { h: top + v.rh, lx: v.lx, lz: v.lz, taper: v.taper, twist: v.twist, wob: 0.12, ph: rnd() * 6 };
  const geo = mergeColored(parts);
  bendGeo(geo, o); geo.computeVertexNormals();
  const wg = wins.map((q) => bendGeo(new THREE.BoxGeometry(q.w, q.h, 0.06).translate(q.x, q.y, q.z), o));
  return { geo, wins: wg };
}

function geoSwirlTree(rnd, pal) {
  const parts = [], lean = (rnd() - 0.5) * 1.4;
  parts.push({ geo: tube([[0, -0.3, 0], [lean * 0.5, 1.6, 0.3], [-lean * 0.4, 3.2, -0.2], [lean * 0.3, 4.8, 0.2]], 0.55, 0.2, 10, 6), color: pal.trunk });
  for (let b = 0; b < 3; b++) { // curly branches that end in a hook
    const a = b * 2.1 + rnd(), len = 1.5 + rnd(), yb = 2.4 + b * 0.9, pts = [];
    for (let t = 0; t <= 7; t++) { const an = t * 0.62, rad = len - t * 0.14, u = Math.sin(an) * rad + t * 0.15, v = (1 - Math.cos(an)) * rad * 0.9 + t * 0.12; pts.push([Math.cos(a) * u, yb + v, Math.sin(a) * u]); }
    parts.push({ geo: tube(pts, 0.17, 0.05, 8, 3), color: pal.trunk });
  }
  const blobs = [[0, 6.2, 0, 2.3], [1.9, 5.3, 0.5, 1.6], [-1.9, 5.5, -0.4, 1.7], [0.4, 8, 0, 1.5], [-0.8, 7.4, 1.6, 1.3]];
  blobs.forEach(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1.1, 0.85, 1.05);
    parts.push({ geo: g, color: pal.leaf[i % pal.leaf.length], matrix: mat4(x, y, z, 0, rnd() * 3, 0) });
    parts.push({ geo: new THREE.TorusGeometry(r * 0.55, 0.07, 3, 8, 4.4), color: INK, matrix: mat4(x, y, z + r * 0.8, 0, 0, rnd() * 6) });
  });
  return mergeColored(parts);
}

function geoLamp() {
  return mergeColored([
    { geo: tube([[0, 0, 0], [0.15, 1.8, 0], [-0.1, 3.6, 0], [0.1, 5.2, 0], [0.9, 5.9, 0], [1.5, 5.6, 0]], 0.2, 0.11, 12, 5), color: TEAL2 },
    { geo: new THREE.CylinderGeometry(0.4, 0.5, 0.4, 6), color: INK, matrix: mat4(0, 0.2, 0) },
    { geo: new THREE.ConeGeometry(0.7, 0.55, 6), color: MAG, matrix: mat4(1.5, 5.55, 0, 0, 0, 0.18) },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.4, 5), color: INK, matrix: mat4(1.5, 4.75, 0) },
  ]);
}

function geoFence() {
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const h = 0.9 + ((k * 37) % 5) * 0.06, lean = (((k * 53) % 7) - 3) * 0.05;
    parts.push({ geo: new THREE.BoxGeometry(0.34, h, 0.12), color: k % 2 ? CREAM : PINK, matrix: mat4(-1.4 + k * 0.56, h / 2, 0, 0, 0, lean) });
    parts.push({ geo: new THREE.ConeGeometry(0.24, 0.3, 4), color: k % 2 ? CREAM : PINK, matrix: mat4(-1.4 + k * 0.56 - lean * h, h + 0.12, 0, 0, Math.PI / 4, lean) });
  }
  parts.push({ geo: new THREE.BoxGeometry(3.4, 0.1, 0.1), color: INK, matrix: mat4(0, 0.35, -0.1, 0, 0, 0.03) });
  parts.push({ geo: new THREE.BoxGeometry(3.4, 0.1, 0.1), color: INK, matrix: mat4(0, 0.7, -0.1, 0, 0, -0.04) });
  return mergeColored(parts);
}

function geoBoat() {
  const hull = new THREE.SphereGeometry(1, 10, 5, 0, TAU, Math.PI / 2, Math.PI / 2);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 2.6, 0, 8.4, 0.3, 0, 1.2, -0.3, 0, 1.2, -0.6, 0, 7.2, -0.6, 0, 1.2, -3.0], 3));
  return {
    body: mergeColored([
      { geo: hull, color: MAG, matrix: mat4(0, 1.1, 0, 0, 0, 0, 1.7, 1.2, 4.2) },
      { geo: new THREE.BoxGeometry(3.4, 0.25, 8), color: ORG, matrix: mat4(0, 1.1, 0) },
      { geo: new THREE.BoxGeometry(2, 1.4, 2.2), color: TEAL, matrix: mat4(0, 1.85, -1.8, 0, 0, 0.08) },
      { geo: new THREE.ConeGeometry(1.7, 1, 4), color: PUR, matrix: mat4(0.1, 3.0, -1.8, 0, Math.PI / 4, 0.1) },
      { geo: new THREE.CylinderGeometry(0.1, 0.12, 8.6, 5), color: INK, matrix: mat4(0.4, 5.2, 0.3, 0, 0, -0.14) },
    ]),
    sail: mergeColored([{ geo: tri, color: ORG2 }]),
  };
}

function geoClock(rnd) {
  const o = { h: 30, lx: 0.1, lz: 0.02, taper: 0.22, twist: 0.1, wob: 0.15, ph: 1 };
  const parts = [
    { geo: new THREE.BoxGeometry(7, 8, 7, 1, 3, 1), color: PUR, matrix: mat4(0, 4, 0) },
    { geo: new THREE.BoxGeometry(5.2, 9, 5.2, 1, 3, 1), color: MAG, matrix: mat4(0, 12.5, 0) },
    { geo: new THREE.BoxGeometry(6.4, 6, 6.4, 1, 2, 1), color: TEAL, matrix: mat4(0, 20, 0) },
    { geo: new THREE.BoxGeometry(7.2, 0.5, 7.2), color: INK, matrix: mat4(0, 23.2, 0) },
    { geo: new THREE.ConeGeometry(4.6, 7.5, 4, 3), color: ORG, matrix: mat4(0.6, 27, 0, 0, Math.PI / 4, 0) },
    { geo: new THREE.CylinderGeometry(0.08, 0.08, 3.2, 4), color: INK, matrix: mat4(1.4, 32, 0, 0, 0, -0.2) },
  ];
  for (const y of [5, 12, 16]) for (const x of [-1.4, 1.4]) parts.push({ geo: new THREE.BoxGeometry(0.9, 1.5, 0.3), color: INK, matrix: mat4(x, y, 3.6) });
  void rnd;
  const geo = mergeColored(parts); bendGeo(geo, o); geo.computeVertexNormals();
  const wins = [];
  for (const y of [5, 12, 16]) for (const x of [-1.4, 1.4]) wins.push(bendGeo(new THREE.BoxGeometry(0.6, 1.1, 0.06).translate(x, y, 3.78), o));
  return { geo, wins, o };
}

function clockTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#f7e2b8'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
  g.strokeStyle = '#2a1740'; g.lineWidth = 7; g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48); g.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); g.stroke(); }
  return canvasTexture(c);
}

function chalkAtlas() {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const cell = (cx, cy, col, fn) => { g.save(); g.translate(cx * 256, cy * 256); g.strokeStyle = col; g.lineWidth = 13; fn(); g.restore(); };
  cell(0, 0, '#fff2c8', () => { for (let r = 0; r < 4; r++) { g.strokeRect(96, 24 + r * 52, 64, 52); } g.strokeRect(36, 128, 62, 52); g.strokeRect(158, 128, 62, 52); g.beginPath(); g.arc(128, 232, 14, 0, TAU); g.stroke(); });
  cell(1, 0, '#ff9ad0', () => { g.beginPath(); for (let i = 0; i < 11; i++) { const a = i * 0.58 + 3, r = 10 + i * 10.5; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); g.beginPath(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU * 2 - 1.6, r = i % 2 ? 24 : 58; g.lineTo(128 + Math.cos(a) * r * 0.5, 40 + Math.sin(a) * r * 0.5); } g.stroke(); });
  cell(0, 1, '#8ff3ff', () => { g.beginPath(); g.arc(128, 128, 76, 0, TAU); g.stroke(); g.beginPath(); g.arc(98, 108, 7, 0, TAU); g.arc(158, 108, 7, 0, TAU); g.stroke(); g.beginPath(); g.arc(128, 136, 42, 0.25, Math.PI - 0.25); g.stroke(); });
  cell(1, 1, '#ffd36e', () => { g.beginPath(); g.moveTo(30, 150); g.lineTo(190, 150); g.moveTo(130, 90); g.lineTo(200, 150); g.lineTo(130, 210); g.stroke(); g.beginPath(); g.arc(70, 60, 24, 0, TAU); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * 0.785; g.beginPath(); g.moveTo(70 + Math.cos(a) * 32, 60 + Math.sin(a) * 32); g.lineTo(70 + Math.cos(a) * 46, 60 + Math.sin(a) * 46); g.stroke(); } });
  return canvasTexture(c);
}

function poolTexture() {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return canvasTexture(c);
}

function waterTexture(rnd) {
  const c = makeCanvas(128, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, '#0e5a6e'); gr.addColorStop(0.5, '#1d3f78'); gr.addColorStop(1, '#0e5a6e');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  const cols = ['255,90,170', '255,160,60', '90,230,220', '170,110,230'];
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${cols[i % 4]},0.45)`; const x = rnd() * 120, y = rnd() * 256; g.fillRect(x, y, 4 + rnd() * 18, 2); g.fillRect(x, y - 256, 4 + rnd() * 18, 2); }
  return canvasTexture(c, { repeat: true });
}

// ---------- the canal and the hump-back bridge ----------

function buildCanal(w, M, MD) {
  const tr = w.track, scene = w.scene, rnd = w.rnd;
  let bi = 0;
  for (let i = 1; i < tr.n; i++) if (tr.py[i] > tr.py[bi]) bi = i;
  if (tr.py[bi] < 3) return null;
  const hd = tr.heading[bi], dx = Math.sin(hd), dz = Math.cos(hd), ax = Math.cos(hd), az = -Math.sin(hd);
  const cx = tr.px[bi], cz = tr.pz[bi], CW = 7, CL = 100, hw = tr.halfWidth + tr.curb;
  const at = (u, v, out) => out.set(cx + dx * u + ax * v, 0, cz + dz * u + az * v);
  const dist = (x, z) => Math.hypot((x - cx) * dx + (z - cz) * dz, Math.max(Math.abs((x - cx) * ax + (z - cz) * az) - CL, 0));
  const p = new THREE.Vector3();
  // water and bed level: below every bit of ground the canal crosses
  let low = 1e9;
  for (let v = -CL; v <= CL; v += 10) for (const u of [-14, 14]) { at(u, v, p); low = Math.min(low, w.heightAt(p.x, p.z)); }
  const waterY = low - 1, bed = waterY - 3;
  const origTop = (u, v) => { at(u, v, p); return w.heightAt(p.x, p.z); };
  // quay: stone walls and a pavement deck along both banks (heights taken before carving)
  const walls = [], deck = [];
  const vtx = (g, x, y, z, c) => g.push(x, y, z, c.r, c.g, c.b);
  const c1 = new THREE.Color(0x7a5a98), c2 = new THREE.Color(0x6a4a88), cd = new THREE.Color(0xa592c4);
  const N = Math.round((CL * 2) / 4);
  for (const sg of [-1, 1]) {
    for (let k = 0; k < N; k++) {
      const v0 = -CL + k * 4, v1 = v0 + 4, u0 = sg * (CW + 0.8), u1 = sg * (CW + 9);
      const t0 = Math.max(origTop(u0, v0), waterY + 1.2), t1 = Math.max(origTop(u0, v1), waterY + 1.2);
      const o0 = origTop(u1, v0) + 0.05, o1 = origTop(u1, v1) + 0.05;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
      const q = (g, A, B, C, D, col) => { vtx(g, A.x, A.y, A.z, col); vtx(g, B.x, B.y, B.z, col); vtx(g, C.x, C.y, C.z, col); vtx(g, A.x, A.y, A.z, col); vtx(g, C.x, C.y, C.z, col); vtx(g, D.x, D.y, D.z, col); };
      at(u0, v0, a); a.y = bed; at(u0, v1, b); b.y = bed; at(u0, v1, c); c.y = t1; at(u0, v0, d); d.y = t0;
      q(walls, a, b, c, d, k % 2 ? c1 : c2);
      at(u0, v0, a); a.y = t0; at(u0, v1, b); b.y = t1; at(u1, v1, c); c.y = o1; at(u1, v0, d); d.y = o0;
      q(deck, a, b, c, d, cd);
    }
  }
  // carve the channel into the terrain (positions, heights and colours)
  const geo = w.terrainMesh.geometry, pa = geo.attributes.position, ca = geo.attributes.color, n1 = w.tG + 1, dark = new THREE.Color(0x14304a);
  for (let k = 0; k < n1 * n1; k++) {
    if (dist(pa.getX(k), pa.getZ(k)) < CW + 2.2) { w.heights[k] = bed; pa.setY(k, bed); ca.setXYZ(k, dark.r, dark.g, dark.b); }
  }
  pa.needsUpdate = true; ca.needsUpdate = true; geo.computeVertexNormals();
  const mk = (arr, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr.filter((_, i) => i % 6 < 3), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(arr.filter((_, i) => i % 6 >= 3), 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); };
  
  // water
  const tex = waterTexture(rnd); tex.repeat.set(1, CL / 14);
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(CW * 2 + 1.6, CL * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex }));
  wm.position.set(cx, waterY, cz); wm.rotation.y = Math.atan2(ax, az);
  scene.add(wm);
  w.updaters.push((dt) => { tex.offset.y += dt * 0.02; });
  // bridge: stone faces with an arch along both road edges, a barrel soffit and parapets
  const face = [], soff = [], k0 = Math.ceil((CW + 1.5) / tr.seg), archH = Math.min(tr.py[bi] - waterY - 1.8, 7);
  const cs = new THREE.Color(0x8a6aa8), cb = new THREE.Color(0x4a2f6a), pt = new THREE.Vector3();
  for (const sg of [-1, 1]) for (let j = bi - k0; j < bi + k0; j++) {
    const row = [];
    for (const jj of [j, j + 1]) {
      const u = (jj - bi) * tr.seg; tr.posAt(jj, sg * hw, pt);
      const ay = Math.abs(u) < CW ? waterY + 0.1 + Math.sqrt(1 - (u / CW) ** 2) * archH : bed;
      row.push([pt.x, pt.y - 0.05, pt.z, ay]);
    }
    const [A, B] = row, f = (x, y, z) => vtx(face, x, y, z, cs);
    f(A[0], A[3], A[2]); f(A[0], A[1], A[2]); f(B[0], B[1], B[2]); f(A[0], A[3], A[2]); f(B[0], B[1], B[2]); f(B[0], B[3], B[2]);
    if (sg > 0 && Math.abs((j - bi) * tr.seg) < CW) {
      const L = [], R = [];
      for (const jj of [j, j + 1]) { const u = (jj - bi) * tr.seg, ay = waterY + 0.1 + Math.sqrt(Math.max(0, 1 - (u / CW) ** 2)) * archH; tr.posAt(jj, -hw, pt); L.push([pt.x, ay, pt.z]); tr.posAt(jj, hw, pt); R.push([pt.x, ay, pt.z]); }
      const s = (q) => vtx(soff, q[0], q[1], q[2], cb);
      s(L[0]); s(R[0]); s(R[1]); s(L[0]); s(R[1]); s(L[1]);
    }
  }
  mk(walls.concat(deck, face, soff), MD);
  const par = [];
  for (const sg of [-1, 1]) for (let j = bi - 16; j < bi + 16; j += 2) {
    tr.posAt(j, sg * (hw + 0.2), pt);
    par.push({ geo: new THREE.BoxGeometry(0.7, 0.9 + ((j * 7) % 5) * 0.05, tr.seg * 2 + 0.1), color: (j / 2) % 2 ? 0x8a6aa8 : 0x7a5a98, matrix: mat4(pt.x, pt.y + 0.4, pt.z, 0, tr.heading[j], (j % 3) * 0.02) });
    par.push({ geo: new THREE.BoxGeometry(0.9, 0.2, tr.seg * 2 + 0.2), color: CREAM, matrix: mat4(pt.x, pt.y + 0.95, pt.z, 0, tr.heading[j], 0) });
  }
  const pm = new THREE.Mesh(mergeColored(par), M); pm.castShadow = true; scene.add(pm);
  // the crooked boat
  const { body, sail } = geoBoat();
  for (const [v, sz, tilt] of [[34, 1, 0.1]]) {
    at(0, v, p);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(body, M), new THREE.Mesh(sail, MD));
    grp.position.set(p.x, waterY, p.z); grp.rotation.y = Math.atan2(ax, az) + (v < 0 ? Math.PI : 0); grp.scale.setScalar(sz);
    scene.add(grp);
    const ph = rnd() * 9;
    w.updaters.push((dt, t) => { grp.position.y = waterY + Math.sin(t * 1.2 + ph) * 0.12; grp.rotation.z = tilt + Math.sin(t * 0.9 + ph) * 0.03; });
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: 0xffc060 }));
    lamp.position.set(0.3, 3.4, -3.4); grp.add(lamp);
  }
  return { dist, at, dx, dz, ax, az, CW, CL, waterY, bi };
}

// ---------- the world ----------

export default {
  id: 'wonky',

  track: {
    seed: 63,
    scale: 0.8,
    width: 18,
    points: [
      [0, 170, 0], [95, 172, 0], [150, 150, 0], [200, 178, 0], [255, 152, 0], [287, 85, 0], [270, 15, 2], [220, -30, 6], [150, -52, 8],
      [90, -55, 4], [50, -95, 0], [62, -155, 0], [25, -197, 0], [-50, -202, 0], [-115, -198, 0], [-162, -165, 0], [-170, -100, 0],
      [-150, -42, 2], [-100, -22, 2], [-105, 45, 0], [-165, 80, 0], [-190, 140, 0], [-125, 178, 0],
    ],
    itemRows: [0.12, 0.31, 0.62, 0.86],
    boostPads: [[0.25, 0], [0.5, 0], [0.78, 0]],
    obstacles: [
      { kind: 'cones', at: 0.19, lat: 3, count: 6, skin: 'bin' },
      { kind: 'crosser', at: 0.4, count: 4, speed: 2.5, skin: 'cat' },
      { kind: 'traffic', at: 0.56, count: 2, speed: 8, lat: -3, skin: 'taxi' },
      { kind: 'bouncer', at: 0.67, lat: -3, size: 2.2, skin: 'mattress' },
      { kind: 'ramp', at: 0.93, lat: 0, size: 6 },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 101), cx = bounds.cx, cz = bounds.cz;
    const g1 = new T.Color(0x2d9a8c), g2 = new T.Color(0x1e6f86), patch = new T.Color(0x8a2f86), pave = new T.Color(0x9b86b8), hill = new T.Color(0x4a2a7a), rock = new T.Color(0x5b3f7a);
    return {
      night: true,
      sky: { top: 0x0c3a68, mid: 0x4a4a9c, bottom: 0x8a4a98, sunColor: 0xffa860, sunDir: [-0.6, 0.12, -0.5], stars: 0.6, aurora: 0 },
      fog: { color: 0x70469a, near: 220, far: 1150 },
      light: { sun: 0xffb48a, sunI: 2.2, sky: 0x9fc0e0, ground: 0x8a4a8a, hemiI: 1.55 },
      water: null,
      road: { tint: 0x8a78b8, line: '#ffe08a', curbA: '#ff3da0', curbB: '#2fd6c8', shoulder: 0x8a78a8 },
      clouds: { color: 0xe070b0, count: 12, minY: 130, maxY: 220 },
      ambient: { kind: 'pollen', color: 0xffc27a, cfg: { n: 150, box: 70, size: 0.22, vel: [0.4, 0.3, 0.2], op: 0.8 } },
      detail: {
        strokes: 0, kind: 'custom',
        draw(g, S, rnd) { // dark ink doodles on the ground: spirals, crosses, hatching, stars
          g.strokeStyle = 'rgba(50,20,90,0.42)'; g.lineWidth = 2;
          for (let i = 0; i < 16; i++) {
            const x = rnd() * S, y = rnd() * S, t = i % 4;
            g.beginPath();
            if (t === 0) for (let k = 0; k < 24; k++) { const a = k * 0.5, r = 1 + k * 0.8; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
            else if (t === 1) { g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); }
            else if (t === 2) for (let k = 0; k < 6; k++) { g.moveTo(x + k * 4, y); g.lineTo(x + k * 4 + 6, y - 14); }
            else for (let k = 0; k <= 10; k++) { const a = (k / 10) * TAU * 2, r = k % 2 ? 4 : 11; g.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r); }
            g.stroke();
          }
        },
      },
      blendNear: 8, blendFar: 60,
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz), m = smoothstep(260, 560, r);
        return N.fbm(x * 0.006, z * 0.006, 3) * 3.5 + 2 + m * m * 130 + m * (1 - Math.abs(N2.noise(x * 0.008, z * 0.008))) * 50;
      },
      color(x, z, h, slope, d, out) {
        mix3(out, g1, g2, N.noise(x * 0.02, z * 0.02) * 0.5 + 0.5);
        const n2 = N2.noise(x * 0.05 + 9, z * 0.05);
        if (n2 > 0.25) mix3(out, out, patch, smoothstep(0.25, 0.6, n2) * 0.6);
        if (h > 30) mix3(out, out, hill, smoothstep(30, 90, h));
        if (slope > 0.6) mix3(out, out, rock, smoothstep(0.6, 0.95, slope));
        if (d < 19) mix3(out, out, pave, smoothstep(19, 14, d));
        return out;
      },
    };
  },

  scenery(w, kit) {
    const { instanced, scatter, geoBush, geoRock } = kit;
    const tr = w.track, rnd = w.rnd, M = w.mats.scenery, MD = w.mats.sceneryDouble, b = tr.bounds, arena = !!w.def.arena;
    const cn = arena ? null : buildCanal(w, M, MD);
    const nearCanal = (x, z, m) => cn && cn.dist(x, z) < cn.CW + m;
    const away = (x, z) => !arena || Math.hypot(x - b.cx, z - b.cz) > 78;
    const info = {}, p = new THREE.Vector3();

    // Houses along both sides of the street, a back row, a far skyline and canal-side rows.
    const lists = VARIANTS.map(() => []), taken = [];
    const put = (x, z, ry, s, v) => {
      if (v === undefined) v = Math.floor(rnd() * VARIANTS.length);
      const g = 0.86 + rnd() * 0.28;
      lists[v].push({ x, y: w.heightAt(x, z) - 0.15, z, ry: ry + (rnd() - 0.5) * 0.25, s, sy: s * (0.9 + rnd() * 0.4), color: new THREE.Color(g, 0.9 + rnd() * 0.2, g) });
      taken.push([x, z]);
    };
    let clk = null; // the town square clock tower (inside the tightest corner): keep houses off it
    if (!arena) {
      let ci = 0;
      for (let i = 0; i < tr.n; i++) if (Math.abs(tr.curv[i]) > Math.abs(tr.curv[ci])) ci = i;
      tr.posAt(ci, (tr.curv[ci] > 0 ? -1 : 1) * 34, p); clk = [p.x, p.z];
    }
    const nearClock = (x, z) => clk && Math.hypot(x - clk[0], z - clk[1]) < 24;
    for (const side of [-1, 1]) {
      let s = rnd() * 6;
      while (s < tr.n - 6) {
        const v = Math.floor(rnd() * VARIANTS.length), V = VARIANTS[v], sc = 1.8 + rnd() * 0.5;
        const wd = (V.w * sc + 1.5) / tr.seg, half = (V.d * sc) / 2;
        s += wd * 0.5 + (1 + rnd() * 4) / tr.seg;
        const lat = side * (tr.halfWidth + tr.curb + 8 + rnd() * 5 + half);
        tr.posAt(s, lat, p); tr.distInfo(p.x, p.z, info);
        const ok = !(info.d < Math.abs(lat) - 3 || info.d < tr.limit + 6 || nearCanal(p.x, p.z, 16) || !away(p.x, p.z) || nearClock(p.x, p.z) || s < 12 || s > tr.n - 12);
        if (ok) {
          put(p.x, p.z, tr.headingAt(s) + (side > 0 ? Math.PI / 2 : -Math.PI / 2), sc, v);
          if (rnd() < 0.55) { // back row
            tr.posAt(s + rnd() * 3, lat + side * (half + 10 + rnd() * 6), p);
            tr.distInfo(p.x, p.z, info);
            if (info.d > tr.limit + 6 && !nearCanal(p.x, p.z, 16) && away(p.x, p.z) && !nearClock(p.x, p.z)) put(p.x, p.z, tr.headingAt(s) + (side > 0 ? Math.PI / 2 : -Math.PI / 2), 2 + rnd() * 0.6);
          }
        }
        s += wd * 0.5;
      }
    }
    if (cn) for (const sg of [-1, 1]) for (let v = 24; v < cn.CL - 6; v += 20 + rnd() * 6) for (const vs of [-1, 1]) {
      cn.at(sg * (cn.CW + 16 + rnd() * 2), vs * v, p);
      tr.distInfo(p.x, p.z, info);
      if (info.d < tr.limit + 6) continue;
      put(p.x, p.z, Math.atan2(-sg * cn.dx, -sg * cn.dz), 1.8 + rnd() * 0.4);
    }
    if (arena) for (let k = 0; k < 26; k++) { // a ring of houses round the battle square
      const a = (k / 26) * TAU + rnd() * 0.1, r = 92 + rnd() * 12;
      put(b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)), 1.9 + rnd() * 0.5);
    }
    for (const [x, z] of scatter(w, { count: arena ? 10 : 24, minD: 120, radius: 520, maxSlope: 0.8, s0: 2.4, s1: 3.6 }).map((o) => [o.x, o.z, o])) put(x, z, rnd() * TAU, 2.4 + rnd() * 1.2);
    // glowing windows: merged once in world space, three groups (steady and two flickering)
    const grp = [[], [], []], dum = new THREE.Object3D();
    VARIANTS.forEach((v, vi) => {
      const { geo, wins } = geoHouse(rnd, v);
      const hm0 = instanced(w, geo, M, lists[vi], 4.5); if (hm0) hm0.castShadow = false;
      for (const it of lists[vi]) {
        dum.position.set(it.x, it.y, it.z); dum.rotation.set(0, it.ry, 0); dum.scale.set(it.s, it.sy, it.s); dum.updateMatrix();
        for (const wg of wins) {
          const r = rnd(), gi = r < 0.8 ? 0 : 1;
          grp[gi].push({ geo: wg.clone(), color: WIN[Math.floor(rnd() * (gi ? 2 : WIN.length))], matrix: dum.matrix.clone() });
        }
      }
    });
    const winMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ vertexColors: true }));
    grp.forEach((parts, i) => { if (parts.length) w.scene.add(new THREE.Mesh(mergeColored(parts), winMats[i])); });
    const c0 = new THREE.Color(0xffa040), c1 = new THREE.Color(0x7a4a28);
    w.updaters.push((dt, t) => {
      winMats[1].color.copy(c0).lerp(c1, 0.5 + 0.5 * Math.sin(t * 3.1)); winMats[2].color.copy(c0).lerp(c1, 0.5 + 0.5 * Math.sin(t * 1.7 + 2));
    });

    // Curly swirl trees, kept away from the houses.
    const clear = (o) => !taken.some((q) => Math.hypot(q[0] - o.x, q[1] - o.z) < 7) && !nearCanal(o.x, o.z, 10) && away(o.x, o.z);
    const pals = [
      { trunk: 0x7a2f7a, leaf: [ORG, PINK, MAG] }, { trunk: 0x3a2a6a, leaf: [TEAL, MINT, 0x9fe05a] }, { trunk: 0x8a3a5a, leaf: [PINK, PUR2, ORG] },
    ];
    pals.slice(0, 2).forEach((pal) => { const tm0 = instanced(w, geoSwirlTree(rnd, pal), M, scatter(w, { count: arena ? 10 : 36, maxD: 80, maxSlope: 0.5, s0: 0.9, s1: 1.5, radius: arena ? 220 : 460, minD: tr.limit + 5 }).filter(clear), 3.2); if (tm0) tm0.castShadow = false; });
    [[TEAL2, MAG]].forEach((cl) => instanced(w, geoBush(rnd, cl), M, scatter(w, { count: 40, maxD: 40, maxSlope: 0.5, s0: 0.7, s1: 1.3, minD: tr.limit + 4 }).filter(clear), 1.2));

    // Wonky street lamps with warm pools of light.
    {
      const lamps = [], bulbs = [], pools = [], cnt = Math.floor(tr.length / 30);
      for (let k = 0; k < cnt; k++) {
        const s = (k / cnt) * tr.n, side = k % 2 ? 1 : -1;
        tr.posAt(s, side * (tr.halfWidth + tr.curb + 1.7), p);
        if (nearCanal(p.x, p.z, 4) || (arena && false)) continue;
        const y = w.heightAt(p.x, p.z), ry = tr.headingAt(s) + (side > 0 ? 0 : Math.PI), sc = 0.9 + rnd() * 0.3;
        lamps.push({ x: p.x, y, z: p.z, ry, s: sc });
        bulbs.push({ x: p.x + Math.cos(ry) * 1.5 * sc, y: y + 5.2 * sc, z: p.z - Math.sin(ry) * 1.5 * sc, s: 1 });
        tr.posAt(s, side * (tr.halfWidth - 1.5), p);
        pools.push({ x: p.x, y: p.y + 0.06, z: p.z, s: 6.5 });
      }
      instanced(w, geoLamp(), M, lamps, 0);
      const bm = new THREE.MeshBasicMaterial({ color: 0xffd488 });
      instanced(w, new THREE.IcosahedronGeometry(0.42, 1), bm, bulbs);
      const pg = new THREE.PlaneGeometry(2, 2); pg.rotateX(-Math.PI / 2);
      const pm = instanced(w, pg, new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), pools);
      if (pm) pm.renderOrder = 0.6;
      const cb = new THREE.Color(0xffd488), cd = new THREE.Color(0xffa860);
      w.updaters.push((dt, t) => { bm.color.copy(cb).lerp(cd, 0.5 + 0.5 * Math.sin(t * 2.3)); });
    }

    // Crooked picket fences on the verge.
    {
      const list = [];
      for (const side of [-1, 1]) for (let s = 6; s < tr.n - 6; s += 7.4 / tr.seg * (1 + (rnd() < 0.4 ? 3 : 0))) {
        if (w.noise(s * 0.05 + side * 9, 3) < 0.05) continue;
        tr.posAt(s, side * (tr.halfWidth + tr.curb + 5.6), p);
        if (nearCanal(p.x, p.z, 8) || !away(p.x, p.z)) continue;
        list.push({ x: p.x, y: w.heightAt(p.x, p.z), z: p.z, ry: tr.headingAt(s) + Math.PI / 2 + (rnd() - 0.5) * 0.15, rz: (rnd() - 0.5) * 0.12, s: 1 });
      }
      instanced(w, geoFence(), M, list, 0);
    }

    // The crooked clock tower on the town square (inside the tightest corner), or in the arena's middle.
    {
      let ci = 0;
      for (let i = 0; i < tr.n; i++) if (Math.abs(tr.curv[i]) > Math.abs(tr.curv[ci])) ci = i;
      let x = b.cx, z = b.cz, ry = 0;
      if (!arena) { const inside = tr.curv[ci] > 0 ? -1 : 1; tr.posAt(ci, inside * 34, p); x = p.x; z = p.z; ry = tr.heading[ci] + (inside > 0 ? Math.PI / 2 : -Math.PI / 2); }
      const { geo, wins, o } = geoClock(rnd), y = w.heightAt(x, z) - 0.2;
      const grpT = new THREE.Group();
      grpT.add(Object.assign(new THREE.Mesh(geo, M), { castShadow: true }));
      grpT.add(new THREE.Mesh(mergeColored(wins.map((g) => ({ geo: g, color: 0xffc060 }))), new THREE.MeshBasicMaterial({ vertexColors: true })));
      const tex = clockTexture(), fm = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
      for (const sg of [1, -1]) {
        const c = bendPt(o, 0, 20, sg * 3.3, new THREE.Vector3());
        const face = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), fm); face.position.copy(c); face.position.z += sg * 0.05; if (sg < 0) face.rotation.y = Math.PI;
        const hands = new THREE.Group(); hands.position.copy(c); hands.position.z += sg * 0.12; if (sg < 0) hands.rotation.y = Math.PI;
        const hm = new THREE.Mesh(mergeColored([{ geo: new THREE.BoxGeometry(0.22, 1.8, 0.08), color: INK, matrix: mat4(0, 0.9, 0) }]), new THREE.MeshBasicMaterial({ vertexColors: true }));
        const hh = new THREE.Mesh(mergeColored([{ geo: new THREE.BoxGeometry(0.3, 1.2, 0.08), color: INK, matrix: mat4(0, 0.6, 0) }]), new THREE.MeshBasicMaterial({ vertexColors: true }));
        hands.add(hm); grpT.add(face, hands);
        w.updaters.push((dt, t) => { hm.rotation.z = (sg > 0 ? -1 : 1) * t * 0.5; });
      }
      grpT.position.set(x, y, z); grpT.rotation.y = ry; grpT.scale.setScalar(1.15);
      w.scene.add(grpT);
      w._shadows.push({ x, z, r: 6 });
    }

    // Chalk doodles on the pavement.
    {
      const atlas = chalkAtlas(), mats = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, opacity: 1, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      const lists4 = [[], [], [], []];
      const cnt = arena ? 20 : 120;
      for (let k = 0; k < cnt; k++) {
        const s = rnd() * tr.n, side = rnd() < 0.5 ? -1 : 1;
        tr.posAt(s, side * (tr.halfWidth + tr.curb + 2.5 + rnd() * 3), p);
        if (nearCanal(p.x, p.z, 6)) continue;
        lists4[k % 2].push({ x: p.x, y: w.heightAt(p.x, p.z) + 0.06, z: p.z, ry: rnd() * TAU, s: 1.7 + rnd() * 1.2 });
      }
      if (arena) lists4[0].push({ x: b.cx, y: w.heightAt(b.cx, b.cz) + 0.06, z: b.cz, ry: 0, s: 6 });
      lists4.forEach((list, i) => {
        const g = new THREE.PlaneGeometry(3, 3); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv, u0 = (i % 2) * 0.5, v0 = (i >> 1) * 0.5;
        for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) * 0.5, v0 + uv.getY(j) * 0.5);
        const m = instanced(w, g, mats, list, 0);
        if (m) m.renderOrder = 0.7;
      });
    }
    kit.sprinkle(w, [0xff9ad0, 0xffd36e, 0x8ff3ff, 0xffffff], 700, 0.6);
  },

  // A quirky minor-key swing tune.
  song: {
    bpm: 118, style: 'wonky', lead: 'whistle',
    chords: 'Dm Dm Gm Dm Bb A Dm,A Dm Gm Gm Dm Dm Bb C A A',
    melody: [
      'd5/3 f5/1 a5/3 f5/1 d5/4 -/4', 'e5/3 g5/1 bb5/3 g5/1 e5/4 c5/4', 'g5/3 bb5/1 d6/3 bb5/1 g5/4 -/4', 'a5/3 f5/1 d5/3 f5/1 a5/8',
      'bb5/3 d6/1 f6/3 d6/1 bb5/4 -/4', 'a5/3 c#6/1 e6/3 c#6/1 a5/4 e5/4', 'd6/4 a5/2 f5/2 e5/4 c#5/4', 'd5/8 -/2 c#5/2 d5/4',
      'g5/3 g5/1 bb5/3 a5/1 g5/4 d5/4', 'bb5/3 d6/1 g6/3 f6/1 d6/8', 'f6/3 e6/1 d6/3 c6/1 a5/4 f5/4', 'a5/3 d6/1 a5/3 f5/1 d5/8',
      'd6/3 bb5/1 f5/3 bb5/1 d6/4 f6/4', 'e6/3 c6/1 g5/3 c6/1 e6/4 g6/4', 'a5/2 c#6/2 e6/4 a6/4 g6/2 e6/2', 'e6/3 c#6/1 a5/3 e5/1 a5/8',
    ],
  },

  style: {
    kick: [0, 7, 10], snare: [4, 12], rim: [14], hat: [0, 3, 4, 7, 8, 11, 12, 15], hatVol: 0.4,
    bass: [[0, 0], [3, 0], [4, 7], [6, 5], [8, 0], [11, 0], [12, 7], [14, 10]], bassLen: 2, comp: 'offbeat', level: 1,
  },

  chip: 'linear-gradient(170deg,#1f9aa6 0 34%,#c2338f 34% 60%,#ff8a2a 60% 68%,#43205f 68% 100%)',

  strings: {
    en: { name: 'Wonky Town', sub: 'Crooked streets at dusk' },
    nl: { name: 'Scheve Stad', sub: 'Kromme straten bij schemer' },
  },

  skins: {
    // Dented bin.
    cones(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(kit.mergeColored([
        { geo: new T.CylinderGeometry(0.34, 0.26, 0.7, 8), color: TEAL, matrix: kit.mat4(0, 0.35, 0, 0, 0, 0.08) },
        { geo: new T.TorusGeometry(0.3, 0.04, 4, 8), color: INK, matrix: kit.mat4(0, 0.4, 0, Math.PI / 2, 0, 0) },
        { geo: new T.CylinderGeometry(0.38, 0.36, 0.1, 8), color: MAG, matrix: kit.mat4(0.04, 0.74, 0, 0, 0, 0.25) },
        { geo: new T.IcosahedronGeometry(0.1, 0), color: ORG, matrix: kit.mat4(0.04, 0.84, 0) },
      ]), new T.MeshLambertMaterial({ vertexColors: true })));
      return g;
    },
    // Black cat on its way across.
    crosser(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(kit.mergeColored([
        { geo: new T.IcosahedronGeometry(0.4, 1), color: 0x20142e, matrix: kit.mat4(0, 0.45, -0.1, 0, 0, 0, 0.9, 0.8, 1.5) },
        { geo: new T.IcosahedronGeometry(0.28, 1), color: 0x20142e, matrix: kit.mat4(0, 0.78, 0.55) },
        { geo: new T.ConeGeometry(0.1, 0.25, 4), color: 0x20142e, matrix: kit.mat4(-0.15, 1.05, 0.55) },
        { geo: new T.ConeGeometry(0.1, 0.25, 4), color: 0x20142e, matrix: kit.mat4(0.15, 1.05, 0.55) },
        { geo: new T.TorusGeometry(0.2, 0.05, 4, 10, 4), color: 0x20142e, matrix: kit.mat4(0, 0.75, -0.7, 0, 1.57, 1) },
        ...[[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.5], [0.18, -0.5]].map(([x, z]) => ({ geo: new T.CylinderGeometry(0.06, 0.06, 0.3, 4), color: 0x20142e, matrix: kit.mat4(x, 0.15, z) })),
      ]), new T.MeshLambertMaterial({ vertexColors: true })));
      const eye = new T.MeshBasicMaterial({ color: 0xffe060 });
      for (const x of [-0.1, 0.1]) { const e = new T.Mesh(new T.IcosahedronGeometry(0.05, 0), eye); e.position.set(x, 0.82, 0.8); g.add(e); }
      return g;
    },
    // Crooked taxi.
    traffic(kit) {
      const T = kit.THREE, g = new T.Group();
      g.add(new T.Mesh(kit.mergeColored([
        { geo: new T.BoxGeometry(1.1, 0.5, 2), color: 0xffb020, matrix: kit.mat4(0, 0.55, 0, 0, 0, 0.1) },
        { geo: new T.BoxGeometry(0.9, 0.45, 1.0), color: 0xffd060, matrix: kit.mat4(0.05, 1.0, -0.15, 0, 0, 0.14) },
        { geo: new T.BoxGeometry(0.5, 0.15, 0.25), color: INK, matrix: kit.mat4(0.1, 1.33, -0.15, 0, 0, 0.14) },
        { geo: new T.BoxGeometry(1.12, 0.1, 0.4), color: INK, matrix: kit.mat4(0, 0.55, 0.3, 0, 0, 0.1) },
        ...[[-0.6, -0.65], [0.6, -0.65], [-0.6, 0.65], [0.6, 0.65]].map(([x, z]) => ({ geo: new T.CylinderGeometry(0.24, 0.24, 0.18, 8), color: INK, matrix: kit.mat4(x, 0.24, z, 0, 0, Math.PI / 2) })),
      ]), new T.MeshLambertMaterial({ vertexColors: true })));
      return g;
    },
    // Bouncy striped mattress.
    bouncer(kit) {
      const T = kit.THREE, g = new T.Group(), parts = [];
      for (let k = 0; k < 6; k++) parts.push({ geo: new T.CylinderGeometry(1, 1, 0.26, 12, 1, false, (k / 6) * Math.PI * 2, Math.PI / 3), color: k % 2 ? CREAM : MAG, matrix: kit.mat4(0, 0.13, 0) });
      for (const [x, z] of [[0, 0], [0.5, 0.3], [-0.5, 0.3], [0, -0.55]]) parts.push({ geo: new T.IcosahedronGeometry(0.09, 0), color: INK, matrix: kit.mat4(x, 0.27, z) });
      g.add(new T.Mesh(kit.mergeColored(parts), new T.MeshLambertMaterial({ vertexColors: true })));
      return g;
    },
  },
};
