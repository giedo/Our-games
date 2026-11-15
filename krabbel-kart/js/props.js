// Trackside dressing that every circuit gets: arrow signs and tyre walls in the
// corners, and a grandstand with a cheering doodle crowd plus flags at the start.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored, mat4, makeCanvas, canvasTexture, mulberry32 } from './util.js';

const V3 = THREE.Vector3;
const dummy = new THREE.Object3D();

function place(w, geo, material, list, cast = true) {
  if (!list.length) { geo.dispose(); return null; }
  const m = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(0, it.ry || 0, 0);
    dummy.scale.setScalar(it.s || 1);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (it.color) m.setColorAt(i, it.color);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  m.castShadow = cast;
  w.scene.add(m);
  return m;
}

function chevronTexture(flip) {
  const c = makeCanvas(256, 112), g = c.getContext('2d');
  if (flip) { g.translate(256, 0); g.scale(-1, 1); }
  g.fillStyle = '#ffd21f'; g.fillRect(0, 0, 256, 112);
  g.strokeStyle = '#1c1c28'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 102);
  g.fillStyle = '#1c1c28';
  for (let k = 0; k < 3; k++) {
    const x = 34 + k * 68;
    g.beginPath();
    g.moveTo(x + 42, 20); g.lineTo(x + 8, 56); g.lineTo(x + 42, 92); g.lineTo(x + 66, 92); g.lineTo(x + 32, 56); g.lineTo(x + 66, 20);
    g.closePath(); g.fill();
  }
  return canvasTexture(c);
}

// Yellow arrow boards on the outside of every real corner.
function cornerSigns(w) {
  const tr = w.track, p = new V3(), info = {};
  const left = [], right = [], posts = [];
  let last = -99;
  for (let i = 0; i < tr.n; i++) {
    const k = tr.curv[i];
    if (Math.abs(k) < 0.0165 || i - last < 8) continue;
    const side = k > 0 ? 1 : -1; // a left-hand bend has its outside on the right
    const lat = side * (tr.limit + 2.4);
    tr.posAt(i, lat, p);
    tr.distInfo(p.x, p.z, info);
    if (info.d < Math.abs(lat) - 3) continue;
    const y = w.heightAt(p.x, p.z);
    if (w.waterLevel !== undefined && y < w.waterLevel + 0.3) continue;
    last = i;
    const ry = tr.heading[i] + Math.PI;
    (k > 0 ? left : right).push({ x: p.x, y: y + 2.1, z: p.z, ry });
    posts.push({ x: p.x, y, z: p.z, ry });
  }
  const board = () => new THREE.PlaneGeometry(3.6, 1.6);
  const mat = (flip) => new THREE.MeshLambertMaterial({ map: chevronTexture(flip), side: THREE.DoubleSide, emissive: 0x332a00 });
  place(w, board(), mat(false), left);
  place(w, board(), mat(true), right);
  place(w, mergeColored([
    { geo: new THREE.BoxGeometry(0.16, 2.3, 0.16), color: 0x4a4f5e, matrix: mat4(-1.3, 1.15, -0.06) },
    { geo: new THREE.BoxGeometry(0.16, 2.3, 0.16), color: 0x4a4f5e, matrix: mat4(1.3, 1.15, -0.06) },
  ]), w.mats.scenery, posts);
}

// Stacks of painted tyres where the track limit is, on the outside of tight bends.
function tyreWalls(w) {
  const tr = w.track, p = new V3(), info = {}, rnd = mulberry32(w.def.seed + 77);
  const a = new THREE.Color(w.theme.road.curbA), b = new THREE.Color(0xffffff);
  const list = [];
  for (let i = 0; i < tr.n; i++) {
    const k = tr.curv[i];
    if (Math.abs(k) < 0.021) continue;
    const side = k > 0 ? 1 : -1;
    const lat = side * (tr.limit + 0.9);
    tr.posAt(i, lat, p);
    tr.distInfo(p.x, p.z, info);
    if (info.d < Math.abs(lat) - 3) continue;
    const y = w.heightAt(p.x, p.z);
    if (w.waterLevel !== undefined && y < w.waterLevel + 0.2) continue;
    list.push({ x: p.x, y: y - 0.05, z: p.z, ry: rnd() * 6, s: 0.92 + rnd() * 0.16, color: i % 2 ? a : b });
  }
  const tyre = (y, open) => { const g = new THREE.CylinderGeometry(0.66, 0.66, 0.44, 9, 1, open); g.translate(0, y, 0); return g; };
  place(w, mergeColored([
    { geo: tyre(0.22, true), color: 0xffffff },
    { geo: tyre(0.68, true), color: 0xe6e6e6 },
    { geo: tyre(1.14, false), color: 0xffffff },
  ]), w.mats.scenery, list);
}

function crowdTexture(seed) {
  const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = '#39456b'; g.fillRect(0, 0, W, H);
  const cols = ['#ff9a3c', '#ff7ac0', '#7bd447', '#4fb8ff', '#b46bff', '#ffd21f', '#ff5a5a', '#5fe0c0', '#f4f4f4', '#c9905a'];
  const rows = 6, rh = H / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = H - (r + 1) * rh; // row 0 at the bottom of the image = front row
    g.fillStyle = r % 2 ? '#303b5e' : '#44517b';
    g.fillRect(0, y0, W, rh);
    for (let i = 0; i < 34; i++) {
      const x = (i + 0.5 + (r % 2) * 0.5) * (W / 34) + (rnd() - 0.5) * 6;
      const head = cols[Math.floor(rnd() * cols.length)], shirt = cols[Math.floor(rnd() * cols.length)];
      const cy = y0 + rh * 0.42 + (rnd() - 0.5) * 4;
      g.fillStyle = shirt;
      g.beginPath(); g.ellipse(x, y0 + rh * 0.95, 12, 13, 0, Math.PI, 0); g.fill();
      if (rnd() < 0.35) { // arms up!
        g.strokeStyle = shirt; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 9, y0 + rh * 0.75); g.lineTo(x - 15, cy - 9); g.moveTo(x + 9, y0 + rh * 0.75); g.lineTo(x + 15, cy - 9); g.stroke();
      }
      g.fillStyle = head; g.beginPath(); g.arc(x, cy, 10.5, 0, 6.3); g.fill();
      g.strokeStyle = '#2a2433'; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = '#2a2433';
      g.beginPath(); g.arc(x - 3.6, cy - 1.5, 1.6, 0, 6.3); g.arc(x + 3.6, cy - 1.5, 1.6, 0, 6.3); g.fill();
      g.lineWidth = 1.8; g.beginPath(); g.arc(x, cy + 2, 4, 0.25, Math.PI - 0.25); g.stroke();
    }
  }
  return canvasTexture(c);
}

function startArea(w) {
  const tr = w.track, p = new V3(), info = {};
  // Put the grandstand on whichever side has the flatter, drier ground.
  const score = (side) => {
    let worst = 0;
    for (const ds of [-12, -4, 4]) {
      tr.posAt(ds, side * (tr.limit + 13), p);
      const h = w.heightAt(p.x, p.z);
      worst = Math.max(worst, Math.abs(h - tr.py[0]) + (w.waterLevel !== undefined && h < w.waterLevel + 0.6 ? 50 : 0));
      tr.distInfo(p.x, p.z, info);
      if (info.d < tr.limit + 8) worst += 100;
    }
    return worst;
  };
  const side = score(-1) <= score(1) ? -1 : 1;
  const cs = -4; // centred beside the starting grid
  tr.posAt(cs, side * (tr.limit + 9.5), p);
  let ground = Infinity;
  for (const dx of [-16, 0, 16]) for (const dz of [0, 8]) {
    const q = tr.posAt(cs + dx / tr.seg, side * (tr.limit + 9.5 + dz), new V3());
    ground = Math.min(ground, w.heightAt(q.x, q.z));
  }
  const baseY = Math.max(ground, tr.py[0] - 1.2);
  const L = 34, D = 8;
  const seats = new THREE.BufferGeometry();
  const A = [-L / 2 + 1, 1.3, 0.7], B = [L / 2 - 1, 1.3, 0.7], C = [L / 2 - 1, 5.6, D - 0.6], Dd = [-L / 2 + 1, 5.6, D - 0.6];
  seats.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...C, ...B, ...A, ...Dd, ...C], 3));
  seats.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
  seats.computeVertexNormals();
  const accent = w.theme.road.curbA;
  const frame = mergeColored([
    { geo: new THREE.BoxGeometry(L, 6, D), color: 0x8b93a8, matrix: mat4(0, -1.7, D / 2) },
    { geo: new THREE.BoxGeometry(L, 8.4, 0.5), color: accent, matrix: mat4(0, 4.2, D - 0.25) },
    { geo: new THREE.BoxGeometry(0.5, 6.2, D), color: accent, matrix: mat4(-L / 2 + 0.25, 3.1, D / 2) },
    { geo: new THREE.BoxGeometry(0.5, 6.2, D), color: accent, matrix: mat4(L / 2 - 0.25, 3.1, D / 2) },
    { geo: new THREE.BoxGeometry(L + 2, 0.35, D + 1.5), color: 0xffffff, matrix: mat4(0, 8.6, D / 2 - 0.2, 0.1, 0, 0) },
    { geo: new THREE.BoxGeometry(0.3, 7.6, 0.3), color: 0xffffff, matrix: mat4(-L / 2 + 0.4, 4.6, 0.5) },
    { geo: new THREE.BoxGeometry(0.3, 7.6, 0.3), color: 0xffffff, matrix: mat4(L / 2 - 0.4, 4.6, 0.5) },
    { geo: new THREE.BoxGeometry(0.3, 7.6, 0.3), color: 0xffffff, matrix: mat4(0, 4.6, 0.5) },
    { geo: new THREE.BoxGeometry(L, 1.0, 0.25), color: 0xffffff, matrix: mat4(0, 1.5, 0.4) },
  ]);
  const grp = new THREE.Group();
  const crowd = new THREE.Mesh(seats, new THREE.MeshLambertMaterial({ map: crowdTexture(w.def.seed + 5), emissive: 0xffffff, emissiveIntensity: 0.12 }));
  crowd.material.emissiveMap = crowd.material.map;
  const body = new THREE.Mesh(frame, w.mats.scenery);
  body.castShadow = true;
  grp.add(body, crowd);
  grp.position.set(p.x, baseY, p.z);
  grp.rotation.y = tr.headingAt(cs) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  w.scene.add(grp);

  // Flag poles with pennants down both sides of the start straight.
  const flagCols = [0xff4b4b, 0xffd21f, 0x4fb8ff, 0x5fd048, 0xff7ac0, 0xb46bff].map((c) => new THREE.Color(c));
  const poles = [];
  let n = 0;
  for (let ds = -15; ds <= 22; ds += 6.2) {
    for (const sd of [-1, 1]) {
      const lat = sd * (tr.limit + 1.4);
      tr.posAt(ds, lat, p);
      tr.distInfo(p.x, p.z, info);
      if (info.d < Math.abs(lat) - 3) continue;
      const y = w.heightAt(p.x, p.z);
      if (w.waterLevel !== undefined && y < w.waterLevel + 0.2) continue;
      poles.push({ x: p.x, y: y - 0.1, z: p.z, ry: tr.headingAt(ds) + (sd > 0 ? 0 : Math.PI), color: flagCols[n++ % flagCols.length] });
    }
  }
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute('position', new THREE.Float32BufferAttribute([0, 6.3, 0, 0, 5.0, 0, 0, 5.65, 2.0], 3));
  place(w, mergeColored([
    { geo: new THREE.CylinderGeometry(0.07, 0.09, 6.5, 5), color: 0xf2f2f2, matrix: mat4(0, 3.25, 0) },
    { geo: pennant, color: 0xffffff },
  ]), w.mats.sceneryDouble, poles);
}

export function buildTrackProps(w) {
  cornerSigns(w);
  tyreWalls(w);
  startArea(w);
}
