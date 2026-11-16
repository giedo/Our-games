// Looks and instancing for road obstacles. A skin (an Object3D at unit size, from a world pack or
// from looks.js) is baked into parts (geometry with its transforms applied, one material each) and
// drawn with one InstancedMesh per part, so a whole obstacle costs only a draw call or two.
import * as THREE from '../../vendor/three.module.min.js';

const KEYS = ['position', 'normal', 'uv', 'color'];

function merge(geos) {
  if (geos.length === 1) return geos[0];
  const gs = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const keys = KEYS.filter((k) => gs[0].attributes[k]);
  if (!keys.every((k) => gs.every((g) => g.attributes[k])) || gs.some((g) => KEYS.some((k) => !!g.attributes[k] !== !!gs[0].attributes[k]))) return null;
  const out = new THREE.BufferGeometry();
  for (const k of keys) {
    const size = gs[0].attributes[k].itemSize;
    let n = 0;
    for (const g of gs) n += g.attributes[k].count;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of gs) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  for (const g of gs) g.dispose();
  return out;
}

// Flatten a skin into [{ geo, mat }]; meshes with the same material become one geometry.
export function bake(obj) {
  obj.updateMatrixWorld(true);
  const by = new Map();
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push(g);
  });
  const parts = [];
  for (const [mat, list] of by) {
    const m = merge(list);
    if (m) parts.push({ geo: m, mat });
    else for (const g of list) parts.push({ geo: g, mat });
  }
  return parts;
}

const _b = new THREE.Box3(), M = new THREE.Matrix4(), S = new THREE.Matrix4();
function box(parts) {
  _b.makeEmpty();
  for (const p of parts) { p.geo.computeBoundingBox(); _b.union(p.geo.boundingBox); }
  return _b;
}
function xform(parts, m) { for (const p of parts) p.geo.applyMatrix4(m); }

// Bring a skin to the unit-size contract (see docs/DESIGN.md): centred, standing on y = 0, and rescaled
// when a pack got the size wildly wrong. Ramps are stretched to exactly 1 x 1 x 1 (x, y, z).
export function fit(parts, kind) {
  if (!parts.length) return parts;
  const b = box(parts);
  const sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), mn = b.min.clone(), mx = b.max.clone();
  const want = (have, target, tol = 0.35) => (have > 1e-4 && Math.abs(have / target - 1) > tol ? target / have : 1);
  let k = 1;
  if (kind === 'roller') { k = want(Math.max(sz.x, sz.y, sz.z), 2); xform(parts, M.makeTranslation(-c.x, -c.y, -c.z)); }
  else if (kind === 'ramp') {
    xform(parts, M.makeTranslation(-c.x, -mn.y, -mn.z));
    xform(parts, S.makeScale(1 / Math.max(sz.x, 1e-3), 1 / Math.max(sz.y, 1e-3), 1 / Math.max(sz.z, 1e-3)));
    return parts;
  } else if (kind === 'spinner') k = want(mx.x, 1);
  else {
    const t = { crosser: [sz.y, 1], cones: [sz.y, 0.8], popper: [sz.y, 1.5], traffic: [sz.z, 2], bouncer: [Math.max(sz.x, sz.z), 2], slick: [Math.max(sz.x, sz.z), 2] }[kind];
    if (t) k = want(t[0], t[1]);
    xform(parts, M.makeTranslation(-c.x, -mn.y, -c.z));
  }
  if (k !== 1) xform(parts, S.makeScale(k, k, k));
  return parts;
}

const D = new THREE.Object3D();
D.rotation.order = 'YXZ';

// N instances of one baked look.
export class Swarm {
  constructor(scene, parts, count, order = 0) {
    this.scene = scene; this.parts = parts; this.count = count; this.shown = true;
    this.meshes = parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geo, p.mat, count);
      m.frustumCulled = false; m.renderOrder = order;
      scene.add(m);
      return m;
    });
    for (let i = 0; i < count; i++) this.hide(i);
    this.commit();
  }

  // x y z: world position. yaw, pitch (x), roll (z) in radians, scale per axis.
  set(i, x, y, z, yaw, pitch, roll, sx, sy = sx, sz = sx) {
    D.position.set(x, y, z); D.rotation.set(pitch, yaw, roll); D.scale.set(sx, sy, sz); D.updateMatrix();
    for (const m of this.meshes) m.setMatrixAt(i, D.matrix);
  }

  hide(i) { this.set(i, 0, -999, 0, 0, 0, 0, 0.0001); }

  commit() { for (const m of this.meshes) m.instanceMatrix.needsUpdate = true; }

  show(on) { if (on === this.shown) return; this.shown = on; for (const m of this.meshes) m.visible = on; }

  dispose() {
    for (const m of this.meshes) { this.scene.remove(m); m.dispose(); }
    for (const p of this.parts) {
      p.geo.dispose();
      for (const m of Array.isArray(p.mat) ? p.mat : [p.mat]) m.dispose();
    }
  }
}
