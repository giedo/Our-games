// Shared helpers for the item files: materials, geometry builders, road-bound shots, wave rings.
// Everything here is cheap to call per frame (no allocations in the update paths).
import * as THREE from '../../vendor/three.module.min.js';
import { mergeColored, mat4, TAU, clamp } from '../util.js';

export const RAINBOW = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff];
export const GLITTER = [0xff5cf0, 0xffe14a, 0x4fe9ff, 0xffffff, 0xb46bff];
export { mat4 };

export const isArena = (sys) => !!(sys.race.world.def && sys.race.world.def.arena);

// Lit and unlit vertex-colour materials, one of each per race.
export const litMat = (sys) => sys.res('item-lit', () => new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x444444, side: THREE.DoubleSide }));
export const flatMat = (sys) => sys.res('item-flat', () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));

// Geometry made once per race. parts: [{ geo, color, matrix? }] as for mergeColored.
export const geoOnce = (sys, key, parts) => sys.res('g-' + key, () => mergeColored(parts()));

// A five-pointed star lying in the XY plane, thickness along Z, centred.
export function starGeo(r0, r1, depth, points = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU + Math.PI / 2, r = i % 2 ? r1 : r0;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Colour a geometry's vertices with fn(x, y, z) -> hex (for striped balls and the like).
export function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { col.setHex(fn(p.getX(i), p.getY(i), p.getZ(i))); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// Wrapped difference of two track sample positions.
export function dS(tr, a, b) {
  let d = b - a;
  if (d < -tr.n / 2) d += tr.n; else if (d > tr.n / 2) d -= tr.n;
  return d;
}

// +1 when the kart drives with the road, -1 against it (ring arenas are driven both ways).
export function roadDir(sys, kart) {
  return Math.cos(kart.dir - sys.world.track.headingAt(kart.s)) >= 0 ? 1 : -1;
}

export const canHit = (k, owner) => k !== owner && !k.out && !k.finished && !k.isImmune();

// The kart a homing item should chase: the kart ahead in a lap race, the nearest kart in an arena.
// maxD limits the flat distance (metres).
export function chooseTarget(sys, kart, maxD = 1e9) {
  const race = sys.race;
  if (!isArena(sys)) {
    const a = race.kartAhead(kart);
    if (a && canHit(a, kart) && Math.hypot(a.x - kart.x, a.z - kart.z) < maxD) return a;
    return null;
  }
  return nearest(sys, kart, maxD, canHit);
}

export function nearest(sys, from, maxD = 1e9, ok = canHit) {
  let best = null, bd = maxD * maxD;
  for (const k of sys.race.karts) {
    if (!ok(k, from)) continue;
    const dx = k.x - from.x, dz = k.z - from.z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// Is any kart that could be hit within `metres` in front of this kart (roughly, along its heading)?
export function rivalNear(sys, kart, metres, wide = 0.6) {
  const fx = Math.sin(kart.dir), fz = Math.cos(kart.dir);
  for (const k of sys.race.karts) {
    if (!canHit(k, kart)) continue;
    const dx = k.x - kart.x, dz = k.z - kart.z, d = Math.hypot(dx, dz);
    if (d < metres && (dx * fx + dz * fz) / (d || 1) > wide) return true;
  }
  return false;
}

export function hudOf(sys, kart) {
  return kart.human ? sys.race.huds[kart.playerIndex] : null;
}

export function detach(mesh) { if (mesh && mesh.parent) mesh.parent.remove(mesh); }

// A projectile that moves in road coordinates (s along, lat across), so it follows bends and hills and
// works on ring arenas too (dir is -1 when the owner drives against the road).
export class Shot {
  constructor(sys, owner, o = {}) {
    const tr = sys.world.track;
    this.sys = sys; this.owner = owner; this.projectile = true; this.dead = false;
    this.dir = roadDir(sys, owner);
    this.s = owner.s + (this.dir * (o.lead || 3)) / tr.seg;
    this.lat = owner.lat;
    this.speed = o.speed || 55; this.h = o.h === undefined ? 1.3 : o.h; this.life = o.life || 6;
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3();
    this.mesh = null;
    this.place();
    this.prev.copy(this.pos);
  }

  place() {
    this.sys.world.track.posAt(this.s, this.lat, this.pos);
    this.pos.y += this.h;
  }

  advance(dt) {
    this.prev.copy(this.pos);
    this.s += (this.dir * this.speed * dt) / this.sys.world.track.seg;
    this.place();
  }

  // Ease sideways towards a kart's lane; in arenas also turn to drive towards it along the ring.
  steer(target, dt, rate) {
    const tr = this.sys.world.track;
    this.lat += (clamp(target.lat, -tr.halfWidth + 1, tr.halfWidth - 1) - this.lat) * Math.min(1, dt * rate);
    if (isArena(this.sys)) { const d = dS(tr, this.s, target.s); if (Math.abs(d) > 6 / tr.seg) this.dir = d > 0 ? 1 : -1; }
  }

  // Popped by a horn or the like: finishes on the next update.
  pop() {
    if (this.dead) return;
    this.dead = true;
    this.sys.race.particles.burst(true, GLITTER, 14, this.pos.x, this.pos.y, this.pos.z, 6, { size: 0.5, life: 0.5, gravity: 4 });
  }

  face() {
    if (this.mesh) this.mesh.position.copy(this.pos);
  }

  dispose() { detach(this.mesh); }
}

// A ring that spreads over the ground from a point, then is gone. cols: one hex or a list (one ring each).
export class Wave {
  constructor(sys, x, y, z, cols, maxR, dur = 0.6, w = 0.18) {
    this.kind = 'wave';
    const list = Array.isArray(cols) ? cols : [cols];
    this.sys = sys; this.t = 0; this.dur = dur; this.maxR = maxR;
    const geo = sys.res('wave-geo-' + w, () => { const g = new THREE.RingGeometry(1 - w, 1, 40); g.rotateX(-Math.PI / 2); return g; });
    this.meshes = list.map((c, i) => {
      const m = sys.spawnMesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 }), x, y + 0.3 + i * 0.03, z);
      m.scale.setScalar(0.01); m.renderOrder = 3;
      return m;
    });
  }

  update(dt) {
    this.t += dt;
    const u = Math.min(1, this.t / this.dur), e = 1 - (1 - u) * (1 - u);
    this.meshes.forEach((m, i) => {
      const k = clamp((u * (1 + this.meshes.length * 0.15) - i * 0.15), 0.001, 1);
      m.scale.setScalar(Math.max(0.01, this.maxR * (1 - (1 - k) * (1 - k))));
      m.material.opacity = 0.9 * (1 - u * u);
    });
    return u < 1;
  }

  dispose() {
    for (const m of this.meshes) { this.sys.removeMesh(m); m.material.dispose(); }
  }
}

// The pop of colour every item ends with.
export function puff(sys, hexes, n, x, y, z, speed = 8, o = {}) {
  sys.race.particles.burst(true, hexes, n, x, y, z, speed, Object.assign({ size: 0.5, life: 0.7, gravity: 6 }, o));
}
