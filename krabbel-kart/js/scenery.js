// Low-poly scenery: trees, windmills, tulip fields, rock arches, igloos and friends.
// The helpers are exported (and bundled in KIT at the bottom) so world packs can use them.
import * as THREE from '../vendor/three.module.min.js';
import * as UTIL from './util.js';
import { mergeColored, mat4, lerp, TAU, makeCanvas, canvasTexture, clamp } from './util.js';
import { buildTrackProps } from './props.js';
import { packById } from './worlds/index.js';

const V3 = THREE.Vector3;

export function jitter(geo, amount, rnd) {
  // Displace vertices consistently (same position => same offset) for a rocky look.
  const p = geo.attributes.position;
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let o = cache.get(key);
    if (!o) { o = [(rnd() - 0.5) * amount, (rnd() - 0.5) * amount, (rnd() - 0.5) * amount]; cache.set(key, o); }
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  return geo;
}

// ---------- model factories (each returns one merged, vertex-coloured geometry) ----------

export function geoRoundTree(rnd, greens) {
  const parts = [{ geo: new THREE.CylinderGeometry(0.32, 0.5, 2.6, 6), color: 0x8a5a3a, matrix: mat4(0, 1.3, 0) }];
  const blobs = [[0, 4.2, 0, 2.3], [1.3, 3.4, 0.4, 1.5], [-1.1, 3.5, -0.6, 1.6], [0.2, 5.6, -0.2, 1.4]];
  blobs.forEach((b, i) => {
    parts.push({ geo: jitter(new THREE.IcosahedronGeometry(b[3], i === 0 ? 1 : 0), 0.35, rnd), color: greens[i % greens.length], matrix: mat4(b[0], b[1], b[2]) });
  });
  return mergeColored(parts);
}

export function geoPine(rnd, green, snowy) {
  const parts = [{ geo: new THREE.CylinderGeometry(0.28, 0.42, 1.8, 6), color: 0x6b4630, matrix: mat4(0, 0.9, 0) }];
  const tiers = [[2.4, 3.0, 2.4], [1.9, 2.7, 4.1], [1.3, 2.5, 5.8]];
  for (const [r, h, y] of tiers) {
    parts.push({ geo: new THREE.ConeGeometry(r, h, 7), color: green, matrix: mat4(0, y, 0, 0, rnd() * 3, 0) });
    if (snowy) parts.push({ geo: new THREE.ConeGeometry(r * 0.72, h * 0.72, 7), color: 0xf4f9ff, matrix: mat4(0, y + h * 0.17, 0, 0, rnd() * 3, 0) });
  }
  return mergeColored(parts);
}

export function geoPalm(rnd) {
  const parts = [];
  let x = 0, y = 0;
  for (let k = 0; k < 6; k++) {
    const lean = 0.06 + k * 0.035;
    const r0 = 0.42 - k * 0.035;
    parts.push({ geo: new THREE.CylinderGeometry(r0 - 0.04, r0, 1.5, 6), color: k % 2 ? 0xa9824f : 0x93703f, matrix: mat4(x, y + 0.72, 0, 0, 0, -lean) });
    x += Math.sin(lean) * 1.45; y += Math.cos(lean) * 1.45;
  }
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.ConeGeometry(0.75, 5.2, 4);
    leaf.translate(0, 2.6, 0);
    const droop = 0.25 + rnd() * 0.45;
    parts.push({ geo: leaf, color: i % 2 ? 0x3faa4a : 0x2f9440, matrix: mat4(x, y, 0, 0, (i / 8) * TAU + rnd() * 0.3, -(Math.PI / 2 + droop), 1, 1, 0.22) });
  }
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.IcosahedronGeometry(0.33, 0), color: 0x6b4a2a, matrix: mat4(x + Math.cos(i * 2.1) * 0.45, y - 0.35, Math.sin(i * 2.1) * 0.45) });
  }
  return mergeColored(parts);
}

export function geoCactus() {
  const g = 0x4f9a55, g2 = 0x3f8548;
  return mergeColored([
    { geo: new THREE.CylinderGeometry(0.55, 0.6, 4.2, 7), color: g, matrix: mat4(0, 2.1, 0) },
    { geo: new THREE.IcosahedronGeometry(0.56, 1), color: g, matrix: mat4(0, 4.2, 0) },
    { geo: new THREE.CylinderGeometry(0.32, 0.32, 1.3, 6), color: g2, matrix: mat4(0.95, 2.1, 0, 0, 0, Math.PI / 2) },
    { geo: new THREE.CylinderGeometry(0.32, 0.32, 1.7, 6), color: g2, matrix: mat4(1.5, 2.9, 0) },
    { geo: new THREE.IcosahedronGeometry(0.33, 1), color: g2, matrix: mat4(1.5, 3.75, 0) },
    { geo: new THREE.CylinderGeometry(0.3, 0.3, 1.1, 6), color: g2, matrix: mat4(-0.9, 1.5, 0, 0, 0, Math.PI / 2) },
    { geo: new THREE.CylinderGeometry(0.3, 0.3, 1.2, 6), color: g2, matrix: mat4(-1.35, 2.05, 0) },
    { geo: new THREE.IcosahedronGeometry(0.31, 1), color: g2, matrix: mat4(-1.35, 2.65, 0) },
  ]);
}

export function geoRock(rnd, colors) {
  const g = jitter(new THREE.IcosahedronGeometry(1, 1), 0.45, rnd);
  g.scale(1, 0.75, 1);
  return mergeColored([{ geo: g, color: colors[0] }]);
}

export function geoBush(rnd, colors) {
  return mergeColored([
    { geo: jitter(new THREE.IcosahedronGeometry(1, 1), 0.3, rnd), color: colors[0], matrix: mat4(0, 0.6, 0, 0, 0, 0, 1, 0.8, 1) },
    { geo: jitter(new THREE.IcosahedronGeometry(0.7, 0), 0.2, rnd), color: colors[1], matrix: mat4(0.8, 0.45, 0.3) },
  ]);
}

export function geoHouse(roof) {
  const r = new THREE.ConeGeometry(4.9, 3, 4); r.rotateY(Math.PI / 4);
  return mergeColored([
    { geo: new THREE.BoxGeometry(6.2, 3.6, 5.2), color: 0xfff4e0, matrix: mat4(0, 1.8, 0) },
    { geo: r, color: roof, matrix: mat4(0, 5.1, 0, 0, 0, 0, 1, 1, 0.84) },
    { geo: new THREE.BoxGeometry(1.1, 2, 0.2), color: 0x7a4a2a, matrix: mat4(0, 1, 2.62) },
    { geo: new THREE.BoxGeometry(1, 1, 0.2), color: 0x7fc8ff, matrix: mat4(-1.9, 2.1, 2.62) },
    { geo: new THREE.BoxGeometry(1, 1, 0.2), color: 0x7fc8ff, matrix: mat4(1.9, 2.1, 2.62) },
    { geo: new THREE.BoxGeometry(0.8, 1.6, 0.8), color: 0xb85c3c, matrix: mat4(1.7, 5.6, -0.6) },
  ]);
}

export function geoHoodoo(rnd, colors) {
  const parts = [];
  let y = 0;
  const n = 4 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const h = 2.2 + rnd() * 2.4, r = (k === n - 1 ? 2.3 : 1.2 + rnd() * 0.9) * (1 - k * 0.04);
    parts.push({ geo: jitter(new THREE.CylinderGeometry(r * 0.85, r, h, 7), 0.35, rnd), color: colors[k % colors.length], matrix: mat4(0, y + h / 2, 0, 0, rnd() * 3, 0) });
    y += h * 0.93;
  }
  return mergeColored(parts);
}

export function geoSnowman() {
  return mergeColored([
    { geo: new THREE.IcosahedronGeometry(1.0, 1), color: 0xffffff, matrix: mat4(0, 0.85, 0) },
    { geo: new THREE.IcosahedronGeometry(0.72, 1), color: 0xf4f8ff, matrix: mat4(0, 2.15, 0) },
    { geo: new THREE.IcosahedronGeometry(0.5, 1), color: 0xffffff, matrix: mat4(0, 3.1, 0) },
    { geo: new THREE.ConeGeometry(0.11, 0.6, 5), color: 0xff8a1f, matrix: mat4(0, 3.1, 0.7, Math.PI / 2, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.5, 8), color: 0x222a3a, matrix: mat4(0, 3.75, 0) },
    { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.08, 8), color: 0x222a3a, matrix: mat4(0, 3.5, 0) },
    { geo: new THREE.IcosahedronGeometry(0.09, 0), color: 0x111111, matrix: mat4(-0.18, 3.25, 0.44) },
    { geo: new THREE.IcosahedronGeometry(0.09, 0), color: 0x111111, matrix: mat4(0.18, 3.25, 0.44) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), color: 0x6b4630, matrix: mat4(1.1, 2.3, 0, 0, 0, -1.0) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), color: 0x6b4630, matrix: mat4(-1.1, 2.3, 0, 0, 0, 1.0) },
  ]);
}

export function geoIgloo() {
  const dome = new THREE.SphereGeometry(3.2, 9, 5, 0, TAU, 0, Math.PI / 2);
  const door = new THREE.CylinderGeometry(1.25, 1.25, 2, 8, 1, false, 0, Math.PI); door.rotateZ(Math.PI / 2); door.rotateY(Math.PI / 2);
  return mergeColored([
    { geo: dome, color: 0xeaf4ff },
    { geo: door, color: 0xd4e6fb, matrix: mat4(0, 0, 3.2) },
    { geo: new THREE.BoxGeometry(1.5, 1.3, 0.2), color: 0x23324f, matrix: mat4(0, 0.6, 4.15) },
  ]);
}

export function geoCabin() {
  const r = new THREE.ConeGeometry(4.6, 2.6, 4); r.rotateY(Math.PI / 4);
  return mergeColored([
    { geo: new THREE.BoxGeometry(5.6, 3.2, 4.6), color: 0x8a5a3c, matrix: mat4(0, 1.6, 0) },
    { geo: r, color: 0xf4f9ff, matrix: mat4(0, 4.45, 0, 0, 0, 0, 1, 1, 0.84) },
    { geo: new THREE.BoxGeometry(0.8, 1.8, 0.8), color: 0x6a4a3a, matrix: mat4(1.6, 5, -0.5) },
    { geo: new THREE.BoxGeometry(1.0, 1.9, 0.2), color: 0x4a2f20, matrix: mat4(0, 0.95, 2.32) },
  ]);
}

export function geoBalloon(a, b) {
  const env = new THREE.SphereGeometry(5, 12, 9).toNonIndexed();
  env.scale(1, 1.18, 1);
  const p = env.attributes.position;
  const colr = new Float32Array(p.count * 3);
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / TAU) * 12);
    const c = seg % 2 ? ca : cb;
    for (let k = 0; k < 3; k++) { colr[(i + k) * 3] = c.r; colr[(i + k) * 3 + 1] = c.g; colr[(i + k) * 3 + 2] = c.b; }
  }
  env.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  return mergeColored([
    { geo: env, color: a },
    { geo: new THREE.CylinderGeometry(1.5, 0.9, 2.4, 8), color: a, matrix: mat4(0, -6.6, 0) },
    { geo: new THREE.BoxGeometry(1.7, 1.3, 1.7), color: 0x9a6a3a, matrix: mat4(0, -9.4, 0) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), color: 0x5a4030, matrix: mat4(0.7, -8.2, 0.7) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), color: 0x5a4030, matrix: mat4(-0.7, -8.2, 0.7) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), color: 0x5a4030, matrix: mat4(0.7, -8.2, -0.7) },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), color: 0x5a4030, matrix: mat4(-0.7, -8.2, -0.7) },
  ]);
}

export function geoSailboat(sail) {
  const hull = new THREE.SphereGeometry(1, 8, 4, 0, TAU, Math.PI / 2, Math.PI / 2);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 2.6, 0, 8.2, 0.2, 0, 0.6, -0.2, 0, 0.6, -0.5, 0, 7, -0.5, 0, 0.6, -3.2], 3));
  return mergeColored([
    { geo: hull, color: 0xfff6e8, matrix: mat4(0, 0.7, 0, 0, 0, 0, 1.5, 1.2, 4) },
    { geo: new THREE.BoxGeometry(2.6, 0.2, 7), color: 0xb5773f, matrix: mat4(0, 0.72, 0, 0, 0, 0, 1, 1, 1) },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 8.4, 5), color: 0x7a5232, matrix: mat4(0, 4.6, 0) },
    { geo: tri, color: sail },
  ]);
}

export function geoLighthouse() {
  const parts = [];
  const bands = 5;
  for (let k = 0; k < bands; k++) {
    const r0 = lerp(2.9, 1.8, k / bands), r1 = lerp(2.9, 1.8, (k + 1) / bands);
    parts.push({ geo: new THREE.CylinderGeometry(r1, r0, 3.6, 10), color: k % 2 ? 0xffffff : 0xe8413c, matrix: mat4(0, 1.8 + k * 3.6, 0) });
  }
  parts.push({ geo: new THREE.CylinderGeometry(2.4, 2.4, 0.4, 10), color: 0x2a3340, matrix: mat4(0, 18.2, 0) });
  parts.push({ geo: new THREE.ConeGeometry(2.0, 2.2, 10), color: 0xe8413c, matrix: mat4(0, 22.2, 0) });
  return mergeColored(parts);
}

export function geoArch(R, tube, rnd, colors) {
  const g = new THREE.TorusGeometry(R, tube, 7, 14, Math.PI);
  jitter(g, tube * 0.42, rnd);
  g.scale(1, 0.82, 1.5);
  const ni = g.toNonIndexed();
  g.dispose();
  const p = ni.attributes.position;
  const colr = new Float32Array(p.count * 3);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const c = cs[Math.abs(Math.floor(y / 2.4)) % cs.length];
    for (let k = 0; k < 3; k++) { colr[(i + k) * 3] = c.r; colr[(i + k) * 3 + 1] = c.g; colr[(i + k) * 3 + 2] = c.b; }
  }
  ni.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  ni.computeVertexNormals();
  return ni;
}

// ---------- placement helpers ----------

export function scatter(w, o) {
  const out = [], rnd = w.rnd, tr = w.track, b = tr.bounds, info = {};
  const R = o.radius || 430;
  const minD = o.minD !== undefined ? o.minD : Math.max(tr.limit, tr.halfWidth + 7) + 4;
  let tries = 0;
  while (out.length < o.count && tries < o.count * 40) {
    tries++;
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * R;
    const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
    tr.distInfo(x, z, info);
    if (info.d < minD || w.inIsland(x, z)) continue;
    if (o.maxD && info.d > o.maxD) continue;
    const h = w.heightAt(x, z);
    if (o.minH !== undefined && h < o.minH) continue;
    if (o.maxH !== undefined && h > o.maxH) continue;
    if (o.maxSlope !== undefined && w.slopeAt(x, z) > o.maxSlope) continue;
    if (o.mask && rnd() > o.mask(x, z, h)) continue;
    out.push({ x, y: h - (o.sink || 0), z, ry: rnd() * TAU, s: lerp(o.s0 || 1, o.s1 || o.s0 || 1, rnd()) });
  }
  return out;
}

// Random spots at a given sideways distance from the road.
export function alongTrack(w, o) {
  const out = [], rnd = w.rnd, tr = w.track, p = new V3(), info = {};
  for (let k = 0; k < o.count; k++) {
    const s = (o.even ? (k + (o.phase || 0)) / o.count : rnd()) * tr.n;
    const side = o.sides ? o.sides[k % o.sides.length] : (rnd() < 0.5 ? -1 : 1);
    const lat = side * (tr.halfWidth + lerp(o.d0, o.d1, rnd()));
    tr.posAt(s, lat, p);
    // Skip spots that are actually close to another part of the track.
    tr.distInfo(p.x, p.z, info);
    if (info.d < Math.abs(lat) - 3 || w.inIsland(p.x, p.z)) continue;
    const h = w.heightAt(p.x, p.z);
    if (o.minH !== undefined && h < o.minH) continue;
    out.push({ x: p.x, y: h - (o.sink || 0), z: p.z, ry: o.face ? tr.headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) : rnd() * TAU, s: lerp(o.s0 || 1, o.s1 || o.s0 || 1, rnd()), side, trackS: s });
  }
  return out;
}

const dummy = new THREE.Object3D();
export function instanced(w, geo, material, list, shadowR) {
  if (!list.length) { geo.dispose(); return null; }
  const m = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.s, it.sy || it.s, it.s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (it.color) m.setColorAt(i, it.color);
    if (shadowR) w._shadows.push({ x: it.x, z: it.z, r: shadowR * it.s });
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  m.castShadow = !!shadowR;
  w.scene.add(m);
  return m;
}

function buildShadows(w) {
  const list = w._shadows;
  if (!list.length) return;
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = canvasTexture(c);
  const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
  const night = !!w.theme.night;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: night ? 0x0a1a40 : 0x10240a, transparent: true, opacity: night ? 0.2 : 0.24, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const up = new V3(0, 1, 0), nrm = new V3(), q = new THREE.Quaternion(), sc = new V3(), pos = new V3(), mtx = new THREE.Matrix4();
  // Shadows fall away from the sun.
  const ox = -w.sunDir.x, oz = -w.sunDir.z;
  list.forEach((s, i) => {
    const x = s.x + ox * s.r * 0.5, z = s.z + oz * s.r * 0.5;
    const e = 1.5;
    const hx = w.heightAt(x + e, z) - w.heightAt(x - e, z), hz = w.heightAt(x, z + e) - w.heightAt(x, z - e);
    nrm.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
    q.setFromUnitVectors(up, nrm);
    pos.set(x, w.heightAt(x, z) + 0.12, z);
    sc.set(s.r * 1.25, 1, s.r * 1.25);
    mtx.compose(pos, q, sc);
    m.setMatrixAt(i, mtx);
  });
  m.frustumCulled = false;
  m.renderOrder = 0.5;
  w.scene.add(m);
}

function gantry(w) {
  const tr = w.track, hw = tr.halfWidth;
  // Checkered banner with a name plate that is sized to fit the lettering.
  const SQ = 26, COLS = 77, ROWS = 8;
  const c = makeCanvas(COLS * SQ, ROWS * SQ), g = c.getContext('2d');
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
    g.fillStyle = (x + y) % 2 ? '#1c1c28' : '#ffffff';
    g.fillRect(x * SQ, y * SQ, SQ, SQ);
  }
  const label = 'KRABBEL KART';
  const fontOf = (px) => `700 ${px}px Fredoka, "Chalkboard SE", "Comic Sans MS", system-ui, sans-serif`;
  let fs = 150;
  g.font = fontOf(fs);
  let tw = g.measureText(label).width;
  const maxW = c.width * 0.6;
  if (tw > maxW) { fs = Math.floor((fs * maxW) / tw); g.font = fontOf(fs); tw = g.measureText(label).width; }
  const pw = tw + 120, ph = c.height - 24, px = (c.width - pw) / 2, py = 12, rad = 30;
  g.beginPath();
  g.moveTo(px + rad, py); g.arcTo(px + pw, py, px + pw, py + ph, rad); g.arcTo(px + pw, py + ph, px, py + ph, rad);
  g.arcTo(px, py + ph, px, py, rad); g.arcTo(px, py, px + pw, py, rad); g.closePath();
  g.fillStyle = '#ffcf33'; g.fill();
  g.strokeStyle = '#1c1c28'; g.lineWidth = 12; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = '#1c1c28'; g.lineWidth = 18; g.strokeText(label, c.width / 2, c.height / 2 + fs * 0.04);
  g.fillStyle = '#ff4b3c'; g.fillText(label, c.width / 2, c.height / 2 + fs * 0.04);
  const tex = canvasTexture(c);
  const span = hw * 2 + 6;
  const grp = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x33384a });
  const face = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 2.6, 0.5), [dark, dark, dark, dark, face, face]);
  beam.position.y = 8.6;
  beam.castShadow = true;
  grp.add(beam);
  const postGeo = mergeColored([
    { geo: new THREE.BoxGeometry(0.9, 9.9, 0.9), color: 0xe8413c, matrix: mat4(-span / 2 + 0.45, 4.9, 0) },
    { geo: new THREE.BoxGeometry(0.9, 9.9, 0.9), color: 0xe8413c, matrix: mat4(span / 2 - 0.45, 4.9, 0) },
    { geo: new THREE.BoxGeometry(1.5, 0.8, 1.5), color: 0xffffff, matrix: mat4(-span / 2 + 0.45, 0.2, 0) },
    { geo: new THREE.BoxGeometry(1.5, 0.8, 1.5), color: 0xffffff, matrix: mat4(span / 2 - 0.45, 0.2, 0) },
  ]);
  const posts = new THREE.Mesh(postGeo, w.mats.scenery);
  posts.castShadow = true;
  grp.add(posts);
  // A string of little flags under the banner.
  const cols = [0xff4b4b, 0xffd21f, 0x4fb8ff, 0x5fd048, 0xff7ac0, 0xb46bff].map((h) => new THREE.Color(h));
  const pos = [], colr = [];
  const nFlags = Math.floor((span - 2) / 0.95);
  for (let i = 0; i < nFlags; i++) {
    const x0 = -span / 2 + 1 + i * 0.95, sag = Math.sin((i / (nFlags - 1)) * Math.PI) * 0.35;
    pos.push(x0, 7.3 - sag, 0, x0 + 0.85, 7.3 - sag, 0, x0 + 0.42, 6.35 - sag, 0);
    const cc = cols[i % cols.length];
    for (let k = 0; k < 3; k++) colr.push(cc.r, cc.g, cc.b);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  bg.computeVertexNormals();
  grp.add(new THREE.Mesh(bg, w.mats.sceneryDouble));
  grp.position.set(tr.px[0], tr.py[0] - 0.2, tr.pz[0]);
  grp.rotation.y = tr.heading[0];
  w.scene.add(grp);
}

// Bulb fields the Dutch way: long bands of one colour, with buds poking out.
export function tulipFields(w, fields) {
  const tr = w.track, rnd = w.rnd, p = new V3(), q = new V3(), info = {};
  const palette = [0xff3b4e, 0xffd21f, 0xff7ac0, 0xff8a1f, 0xb05cff, 0xffffff, 0xff4fa0, 0xffe45e].map((c) => new THREE.Color(c));
  const leaf = new THREE.Color(0x2f8a3a), tmp = new THREE.Color();
  const pos = [], colr = [], buds = [];
  const HALF = 0.72, TOP = 0.46;
  const quad = (a, b, c2, d, col) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c2.x, c2.y, c2.z, a.x, a.y, a.z, c2.x, c2.y, c2.z, d.x, d.y, d.z);
    for (let k = 0; k < 6; k++) colr.push(col.r, col.g, col.b);
  };
  for (const [frac, side] of fields) {
    const s0 = frac * tr.n;
    const c0 = Math.floor(rnd() * palette.length);
    for (let row = 0; row < 14; row++) {
      const lat = side * (Math.max(tr.limit, tr.halfWidth + 7) + 5.5 + row * 2.05);
      const color = palette[(c0 + Math.floor(row / 2)) % palette.length];
      let prev = null;
      for (let k = -26; k <= 26; k++) {
        const s = s0 + k;
        tr.posAt(s, lat - HALF, p); tr.posAt(s, lat + HALF, q);
        const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
        tr.distInfo(mx, mz, info);
        const h = w.heightAt(mx, mz);
        const ok = info.d >= Math.abs(lat) - 2.5 && !w.inIsland(mx, mz) && h > (w.waterLevel === undefined ? -1e9 : w.waterLevel + 0.6) && w.slopeAt(mx, mz) < 0.42;
        if (!ok) { prev = null; continue; }
        const cur = {
          bl: new V3(p.x, w.heightAt(p.x, p.z) - 0.1, p.z), tl: new V3(p.x, w.heightAt(p.x, p.z) + TOP, p.z),
          tr: new V3(q.x, w.heightAt(q.x, q.z) + TOP, q.z), br: new V3(q.x, w.heightAt(q.x, q.z) - 0.1, q.z),
        };
        if (prev) {
          tmp.copy(color).multiplyScalar(0.9 + rnd() * 0.16);
          quad(prev.tl, cur.tl, cur.tr, prev.tr, tmp);       // flowers on top
          quad(prev.bl, cur.bl, cur.tl, prev.tl, leaf);       // leafy sides
          quad(prev.tr, cur.tr, cur.br, prev.br, leaf);
          for (let b = 0; b < 2; b++) {
            const u = rnd(), v = 0.15 + rnd() * 0.7;
            const x = (prev.tl.x + (cur.tl.x - prev.tl.x) * u) * (1 - v) + (prev.tr.x + (cur.tr.x - prev.tr.x) * u) * v;
            const z = (prev.tl.z + (cur.tl.z - prev.tl.z) * u) * (1 - v) + (prev.tr.z + (cur.tr.z - prev.tr.z) * u) * v;
            buds.push({ x, y: w.heightAt(x, z) + TOP - 0.02, z, ry: rnd() * 3, s: 0.8 + rnd() * 0.5, color: new THREE.Color().copy(color).multiplyScalar(0.82 + rnd() * 0.3) });
          }
        }
        prev = cur;
      }
    }
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  geo.computeVertexNormals();
  const bands = new THREE.Mesh(geo, w.mats.sceneryDouble);
  bands.receiveShadow = true;
  w.scene.add(bands);
  const bud = new THREE.ConeGeometry(0.2, 0.36, 4, 1, true); bud.translate(0, 0.18, 0);
  instanced(w, mergeColored([{ geo: bud, color: 0xffffff }]), w.mats.scenery, buds);
}

// Tiny wild flowers / pebbles sprinkled along the verge.
export function sprinkle(w, colors, count, size = 1) {
  const tr = w.track, rnd = w.rnd, p = new V3(), info = {}, list = [];
  const cols = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < count * 3 && list.length < count; i++) {
    const s = rnd() * tr.n, sd = rnd() < 0.5 ? -1 : 1;
    const lat = sd * (tr.halfWidth + tr.curb + 2.8 + rnd() * rnd() * 26);
    tr.posAt(s, lat, p);
    tr.distInfo(p.x, p.z, info);
    if (info.d < Math.abs(lat) - 2 || w.inIsland(p.x, p.z)) continue;
    const h = w.heightAt(p.x, p.z);
    if (w.waterLevel !== undefined && h < w.waterLevel + 0.4) continue;
    list.push({ x: p.x, y: h - 0.02, z: p.z, ry: rnd() * 3, s: size * (0.7 + rnd() * 0.8), color: cols[Math.floor(rnd() * cols.length)] });
  }
  const g = new THREE.ConeGeometry(0.17, 0.3, 4, 1, true); g.translate(0, 0.15, 0);
  instanced(w, mergeColored([{ geo: g, color: 0xffffff }]), w.mats.scenery, list);
}

export function balloons(w, n, palette) {
  const b = w.track.bounds, rnd = w.rnd;
  for (let i = 0; i < n; i++) {
    const [ca, cb] = palette[i % palette.length];
    const m = new THREE.Mesh(geoBalloon(ca, cb), w.mats.sceneryNoFog);
    const a = rnd() * TAU, r = 120 + rnd() * 330;
    const baseY = 55 + rnd() * 70;
    m.position.set(b.cx + Math.cos(a) * r, baseY, b.cz + Math.sin(a) * r);
    const sc = 1.3 + rnd() * 1.2; m.scale.setScalar(sc);
    const ph = rnd() * 10;
    w.scene.add(m);
    w.updaters.push((dt, t) => { m.position.y = baseY + Math.sin(t * 0.3 + ph) * 4; m.rotation.y += dt * 0.05; });
  }
}

// ---------- per-theme scenery ----------

function meadow(w) {
  const tr = w.track, rnd = w.rnd, M = w.mats.scenery;
  const forest = (x, z) => clamp(w.noise(x * 0.008, z * 0.008) * 1.6 + 0.45, 0.04, 1);
  for (let v = 0; v < 3; v++) {
    const greens = [[0x4fae3c, 0x66c14a, 0x3f9a36], [0x7fcf4f, 0x5fb840, 0x8ed85c], [0x3c9b48, 0x57b352, 0x2f8a40]][v];
    instanced(w, geoRoundTree(rnd, greens), M, scatter(w, { count: 150, minH: -2.2, maxH: 60, maxSlope: 0.5, mask: forest, s0: 0.9, s1: 1.7, radius: 470 }), 3.4);
  }
  instanced(w, geoPine(rnd, 0x2f7d4a, false), M, scatter(w, { count: 260, minH: 14, maxH: 92, maxSlope: 0.7, s0: 1.0, s1: 2.0, radius: 560 }), 2.6);
  instanced(w, geoBush(rnd, [0x5fb840, 0x7fcf4f]), M, scatter(w, { count: 170, maxD: 60, minH: -2.4, maxSlope: 0.4, s0: 0.8, s1: 1.6 }), 1.3);
  instanced(w, geoRock(rnd, [0x9aa39a]), M, scatter(w, { count: 90, minH: -4, maxSlope: 0.9, s0: 0.6, s1: 2.4, radius: 520, sink: 0.2 }));

  tulipFields(w, [[0.045, 1], [0.2, -1], [0.33, 1], [0.47, -1], [0.6, 1], [0.74, -1], [0.9, -1], [0.965, 1]]);
  sprinkle(w, [0xffffff, 0xffe45e, 0xff9ad0, 0xc9a6ff], 1500, 0.62);

  // Windmills with turning sails.
  const mills = alongTrack(w, { count: 5, even: true, phase: 0.35, sides: [1, -1, -1, 1, -1], d0: 34, d1: 52, face: true, minH: -2 });
  const bodyGeo = () => mergeColored([
    { geo: new THREE.CylinderGeometry(3.4, 3.7, 2.4, 8), color: 0xb5633f, matrix: mat4(0, 1.2, 0) },
    { geo: new THREE.CylinderGeometry(2.0, 3.3, 9.6, 8), color: 0xfff6e6, matrix: mat4(0, 7.2, 0) },
    { geo: new THREE.CylinderGeometry(3.7, 3.7, 0.3, 8), color: 0x7a5232, matrix: mat4(0, 4.6, 0) },
    { geo: new THREE.ConeGeometry(2.6, 2.8, 8), color: 0x5b4636, matrix: mat4(0, 13.4, 0) },
    { geo: new THREE.BoxGeometry(1.2, 2.2, 0.3), color: 0x3f6fb5, matrix: mat4(0, 1.2, 3.6) },
    { geo: new THREE.CylinderGeometry(0.35, 0.35, 1.4, 6), color: 0x5b4636, matrix: mat4(0, 12.2, 2.3, Math.PI / 2, 0, 0) },
  ]);
  const bladeGeo = () => {
    const parts = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      const arm = new THREE.BoxGeometry(0.28, 8.4, 0.16); arm.translate(0, 4.4, 0);
      const sail = new THREE.BoxGeometry(1.7, 6.4, 0.08); sail.translate(1.0, 5.2, 0);
      parts.push({ geo: arm, color: 0x6a4a34, matrix: mat4(0, 0, 0, 0, 0, a) });
      parts.push({ geo: sail, color: k % 2 ? 0xfff0d0 : 0xff6b5a, matrix: mat4(0, 0, 0, 0, 0, a) });
    }
    return mergeColored(parts);
  };
  for (const s of mills) {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(bodyGeo(), M));
    const blades = new THREE.Mesh(bladeGeo(), M);
    blades.position.set(0, 12.2, 3.1);
    grp.add(blades);
    grp.position.set(s.x, s.y - 0.3, s.z); grp.rotation.y = s.ry; grp.scale.setScalar(1.25);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    w.scene.add(grp);
    w._shadows.push({ x: s.x, z: s.z, r: 5 });
    const sp = 0.5 + rnd() * 0.4;
    w.updaters.push((dt) => { blades.rotation.z += dt * sp; });
  }
  const roofs = [0xe8553c, 0xd9763a, 0xc74a4a];
  roofs.forEach((roof) => {
    instanced(w, geoHouse(roof), M, alongTrack(w, { count: 4, d0: 26, d1: 62, face: true, minH: -2 }), 4.2);
  });
  balloons(w, 6, [[0xff4b4b, 0xffffff], [0xffcf33, 0x2f8fff], [0xff7ac0, 0xfff1a0], [0x39c46a, 0xffffff], [0xb05cff, 0xffd21f], [0xff8a1f, 0x2fd0d0]]);
}

function canyon(w) {
  const tr = w.track, rnd = w.rnd, M = w.mats.scenery;
  instanced(w, geoCactus(), M, scatter(w, { count: 240, minH: -1.5, maxSlope: 0.28, s0: 0.8, s1: 1.9, radius: 480 }), 1.5);
  for (const c of [0xb5472f, 0xd96a3c, 0x8c3a30]) {
    instanced(w, geoRock(rnd, [c]), M, scatter(w, { count: 110, minH: -2, maxSlope: 1.2, s0: 0.7, s1: 3.4, radius: 500, sink: 0.25 }), 1.0);
  }
  instanced(w, geoBush(rnd, [0x9aa04a, 0xb8b060]), M, scatter(w, { count: 200, minH: -1.8, maxSlope: 0.35, s0: 0.5, s1: 1.1, maxD: 75 }), 1.0);
  for (let v = 0; v < 3; v++) {
    instanced(w, geoHoodoo(rnd, [0xc9573a, 0xe9824a, 0x9a3a30, 0xf09a55]), M, scatter(w, { count: 16, minH: -1, maxSlope: 0.3, s0: 1.0, s1: 2.0, radius: 430, sink: 0.5, minD: tr.limit + 9 }), 2.4);
  }
  instanced(w, geoPalm(rnd), M, scatter(w, { count: 60, minH: -1.9, maxH: 0.6, maxSlope: 0.4, s0: 0.9, s1: 1.4, radius: 480 }), 2.6);
  // Rock arches over the road.
  const arches = [0.3, 0.62, 0.88];
  for (const frac of arches) {
    const i = Math.floor(frac * tr.n);
    const m = new THREE.Mesh(geoArch(tr.limit + 4.5, 3.6, rnd, [0xb5472f, 0xd96a3c, 0xf09a55, 0xc9573a]), M);
    m.position.set(tr.px[i], tr.py[i] - 2.5, tr.pz[i]);
    m.rotation.y = tr.heading[i];
    m.castShadow = true;
    w.scene.add(m);
  }
  sprinkle(w, [0x9a4a36, 0xc9704a, 0x7d3a30], 900, 1.1);
  balloons(w, 4, [[0xfff1a0, 0xff5a3c], [0x7a5cff, 0xffd21f], [0xffffff, 0xff8a1f], [0x2fd0d0, 0xfff1a0]]);
}

function island(w) {
  const tr = w.track, rnd = w.rnd, M = w.mats.scenery, b = tr.bounds;
  const vol = w.theme.volcano;
  const notVolcano = (x, z) => (Math.hypot(x - vol.x, z - vol.z) > 95 ? 1 : 0);
  instanced(w, geoPalm(rnd), M, scatter(w, { count: 300, minH: 1.3, maxH: 13, maxSlope: 0.5, mask: notVolcano, s0: 0.9, s1: 1.6, radius: 330 }), 2.8);
  const jungle = (x, z) => notVolcano(x, z) * clamp(w.noise(x * 0.01, z * 0.01) * 1.5 + 0.6, 0.05, 1);
  instanced(w, geoRoundTree(rnd, [0x2f9a48, 0x3fb052, 0x258a40]), M, scatter(w, { count: 200, minH: 5, maxH: 44, maxSlope: 0.7, mask: jungle, s0: 1.0, s1: 1.9, radius: 300 }), 3.4);
  instanced(w, geoBush(rnd, [0x3fb052, 0x62c45c]), M, scatter(w, { count: 200, minH: 2.5, maxH: 30, maxSlope: 0.6, s0: 0.8, s1: 1.8, radius: 300 }), 1.2);
  instanced(w, geoRock(rnd, [0x8a8078]), M, scatter(w, { count: 120, minH: -5, maxH: 3, s0: 0.8, s1: 3.6, radius: 420, sink: 0.4 }));
  instanced(w, geoRock(rnd, [0x4a4044]), M, scatter(w, { count: 60, minH: 40, s0: 1.2, s1: 4.0, radius: 200, sink: 0.4, minD: 0 }));
  // Lighthouse on the far tip of the island.
  let best = null;
  for (let k = 0; k < 40; k++) {
    const a = 0.9 + k * 0.012;
    for (let r = 340; r > 150; r -= 4) {
      const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
      if (w.heightAt(x, z) > 2.2) { if (!best || r > best.r) best = { x, z, r }; break; }
    }
  }
  if (best) {
    const x = best.x - Math.cos(1.1) * 8, z = best.z - Math.sin(1.1) * 8;
    const lh = new THREE.Mesh(geoLighthouse(), M);
    lh.position.set(x, w.heightAt(x, z) - 0.5, z);
    lh.castShadow = true;
    w.scene.add(lh);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.2, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    lamp.position.set(x, lh.position.y + 19.6, z);
    w.scene.add(lamp);
    w._shadows.push({ x, z, r: 4.5 });
  }
  // Sailing boats bobbing on the sea.
  const sails = [0xffffff, 0xff5a5a, 0xffd21f, 0x49d0ff, 0xff8ad0, 0xffffff, 0x7fe08a];
  for (let i = 0; i < 9; i++) {
    let x = 0, z = 0, ok = false;
    for (let t = 0; t < 30 && !ok; t++) {
      const a = rnd() * TAU, r = 290 + rnd() * 330;
      x = b.cx + Math.cos(a) * r; z = b.cz + Math.sin(a) * r;
      ok = w.heightAt(x, z) < -3;
    }
    if (!ok) continue;
    const m = new THREE.Mesh(geoSailboat(sails[i % sails.length]), w.mats.sceneryDouble);
    m.position.set(x, 0, z); m.rotation.y = rnd() * TAU; m.scale.setScalar(1.6 + rnd());
    const ph = rnd() * 10;
    w.scene.add(m);
    w.updaters.push((dt, t) => { m.position.y = Math.sin(t * 1.1 + ph) * 0.25 - 0.1; m.rotation.z = Math.sin(t * 0.8 + ph) * 0.06; });
  }
  // Volcano: glowing crater + rising smoke (not in the middle of an arena island).
  if (!w.inIsland(vol.x, vol.z)) {
  const cy = w.heightAt(vol.x, vol.z);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(17, 14), new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(vol.x, cy + 6, vol.z);
  w.scene.add(glow);
  w.updaters.push((dt, t) => { glow.material.color.setRGB(1, 0.32 + Math.sin(t * 2.3) * 0.1, 0.05); });
  w.addSmoke(vol.x, cy + 14, vol.z, 0xd8d0c8);
  }
  sprinkle(w, [0xff6fae, 0xffffff, 0xffd21f, 0xff8a3c], 1100, 0.62);
  balloons(w, 3, [[0xff4b4b, 0xfff1a0], [0x2fd0d0, 0xffffff], [0xffcf33, 0xff7ac0]]);
}

function snow(w) {
  const tr = w.track, rnd = w.rnd, M = w.mats.scenery;
  const forest = (x, z) => clamp(w.noise(x * 0.009, z * 0.009) * 1.5 + 0.55, 0.06, 1);
  for (const g of [0x2d6b55, 0x3a7d62, 0x255c4c]) {
    instanced(w, geoPine(rnd, g, true), M, scatter(w, { count: 240, minH: -5, maxH: 95, maxSlope: 0.75, mask: forest, s0: 1.0, s1: 2.3, radius: 540 }), 2.6);
  }
  instanced(w, geoRock(rnd, [0x6b7890]), M, scatter(w, { count: 120, minH: -6, maxSlope: 1.5, s0: 0.8, s1: 3.6, radius: 520, sink: 0.3 }));
  instanced(w, geoSnowman(), M, alongTrack(w, { count: 14, d0: 9.5, d1: 15, face: true, s0: 1.1, s1: 1.6, minH: -5 }), 1.2);
  instanced(w, geoIgloo(), M, alongTrack(w, { count: 6, d0: 20, d1: 40, face: true, minH: -5 }));
  // Glowing ice crystals.
  const crystal = new THREE.OctahedronGeometry(1, 0); crystal.scale(0.55, 1.7, 0.55);
  const cmat = new THREE.MeshLambertMaterial({ color: 0x9fe8ff, emissive: 0x2f9fe0, emissiveIntensity: 0.9, flatShading: true });
  const cr = scatter(w, { count: 90, minH: -6.5, maxD: 70, maxSlope: 0.8, s0: 0.8, s1: 2.6 });
  cr.forEach((c) => { c.rx = (rnd() - 0.5) * 0.5; c.rz = (rnd() - 0.5) * 0.5; c.y += 0.6 * c.s; });
  instanced(w, crystal, cmat, cr);
  // Cabins with warm windows.
  const cabins = alongTrack(w, { count: 7, d0: 22, d1: 46, face: true, minH: -5 });
  instanced(w, geoCabin(), M, cabins, 4);
  const win = new THREE.BoxGeometry(1, 1, 0.1);
  const wl = [];
  for (const c of cabins) {
    for (const ox of [-1.7, 1.7]) {
      const cs = Math.cos(c.ry), sn = Math.sin(c.ry);
      wl.push({ x: c.x + cs * ox + sn * 2.34, y: c.y + 1.9, z: c.z - sn * ox + cs * 2.34, ry: c.ry, s: 1 });
    }
  }
  instanced(w, win, new THREE.MeshBasicMaterial({ color: 0xffd98a }), wl);
  // Lanterns lining the road, each with a pool of warm light on the snow.
  const posts = [], lamps = [], pools = [];
  const p = new V3();
  const cnt = Math.floor(tr.length / 26);
  for (let k = 0; k < cnt; k++) {
    const s = (k / cnt) * tr.n, side = k % 2 ? 1 : -1;
    tr.posAt(s, side * (tr.halfWidth + tr.curb + 1.6), p);
    const y = w.heightAt(p.x, p.z);
    posts.push({ x: p.x, y, z: p.z, s: 1 });
    lamps.push({ x: p.x, y: y + 3.4, z: p.z, s: 1 });
    tr.posAt(s, side * (tr.halfWidth - 1.5), p);
    pools.push({ x: p.x, y: p.y + 0.06, z: p.z, s: 7 });
  }
  instanced(w, mergeColored([{ geo: new THREE.CylinderGeometry(0.09, 0.13, 3.2, 5), color: 0x2a3348, matrix: mat4(0, 1.6, 0) }]), M, posts);
  instanced(w, new THREE.IcosahedronGeometry(0.36, 1), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), lamps);
  const pc = makeCanvas(64, 64), pg = pc.getContext('2d');
  const gr = pg.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,205,120,1)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  pg.fillStyle = gr; pg.fillRect(0, 0, 64, 64);
  const poolGeo = new THREE.PlaneGeometry(2, 2); poolGeo.rotateX(-Math.PI / 2);
  const pool = instanced(w, poolGeo, new THREE.MeshBasicMaterial({ map: canvasTexture(pc), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), pools);
  if (pool) pool.renderOrder = 0.6;
}

// Averages the normals of vertices that share a position (boxes, extrusions): soft edges.
export function smoothNormals(geo) {
  const P = geo.attributes.position;
  geo.computeVertexNormals();
  const N = geo.attributes.normal, sum = new Map(), key = (i) => `${Math.round(P.getX(i) * 400)},${Math.round(P.getY(i) * 400)},${Math.round(P.getZ(i) * 400)}`;
  for (let i = 0; i < P.count; i++) {
    const k = key(i); let s = sum.get(k);
    if (!s) { s = [0, 0, 0]; sum.set(k, s); }
    s[0] += N.getX(i); s[1] += N.getY(i); s[2] += N.getZ(i);
  }
  for (let i = 0; i < P.count; i++) {
    const s = sum.get(key(i)), l = Math.hypot(s[0], s[1], s[2]) || 1;
    N.setXYZ(i, s[0] / l, s[1] / l, s[2] / l);
  }
  return geo;
}

// Like mergeColored, but keeps the smooth (indexed) normals: soft clay and painted looks.
// parts: [{ geo, color, matrix?, bottom? }]; `bottom` is a second colour that fades into `color`
// over the height of the part (cheap baked shading). Parts are consumed.
export function mergeSmooth(parts) {
  const pos = [], nor = [], col = [], idx = [];
  const tc = new THREE.Color(), bc = new THREE.Color(), cc = new THREE.Color();
  for (const p of parts) {
    const g = p.geo;
    if (p.smooth) smoothNormals(g);
    if (p.matrix) g.applyMatrix4(p.matrix);
    const P = g.attributes.position, N = g.attributes.normal, n = P.count, base = pos.length / 3;
    tc.set(p.color);
    let y0 = Infinity, y1 = -Infinity;
    if (p.bottom !== undefined) {
      bc.set(p.bottom);
      for (let i = 0; i < n; i++) { const y = P.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    for (let i = 0; i < n; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      if (p.bottom !== undefined) UTIL.mix3(cc, bc, tc, (P.getY(i) - y0) / (y1 - y0 || 1)); else cc.copy(tc);
      col.push(cc.r, cc.g, cc.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < n; i++) idx.push(base + i);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  return out;
}

// Everything a world pack needs, handed to its theme() and scenery() functions so packs
// never import game modules themselves: THREE, all of util.js (noise, colours, mergeColored,
// mat4, canvas helpers...), the placement helpers and the model builders above.
export const KIT = Object.assign({}, UTIL, {
  THREE,
  jitter, scatter, alongTrack, instanced, tulipFields, sprinkle, balloons,
  geoRoundTree, geoPine, geoPalm, geoCactus, geoRock, geoBush, geoHouse, geoHoodoo, geoSnowman, geoIgloo,
  geoCabin, geoBalloon, geoSailboat, geoLighthouse, geoArch,
});
KIT.mergeSmooth = mergeSmooth; KIT.smoothNormals = smoothNormals;

const BUILTIN = { meadow, canyon, island, snow };

export function buildScenery(w) {
  w._shadows = [];
  w.mats = {
    scenery: new THREE.MeshLambertMaterial({ vertexColors: true }),
    sceneryNoFog: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }),
    sceneryDouble: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
  if (!w.def.arena) gantry(w);
  buildTrackProps(w);
  const pack = packById(w.theme.id);
  if (pack) pack.scenery(w, KIT);
  else (BUILTIN[w.theme.id] || meadow)(w);
  buildShadows(w);
}
