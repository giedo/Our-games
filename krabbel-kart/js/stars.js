// Gold stars on the road. Each one gives a little top speed (up to ten, see Kart.topMul).
// A star is an ItemSystem thing { kind: 'star', x, y, z, collect(kart) } (docs/DESIGN.md, Stars).
// All stars of a race are drawn with ONE InstancedMesh. Lap races only: arenas and modes with
// noRoadStars skip them. Big age group: a real hit drops 3 stars as bouncing pickups.
import * as THREE from '../vendor/three.module.min.js';
import { SYSTEM_HOOKS } from './items.js';
import { mulberry32, clamp } from './util.js';
import { starGeo, paint, mat4 } from './items/common.js';
import { mergeColored } from './util.js';

const BACK = 12; // seconds until a collected star is back
const DROPS = 30; // slots for dropped stars
const SPACING = 6;
const _d = new THREE.Object3D(), _c = new THREE.Color(), _v = new THREE.Vector3();
const GOLD = [0xffe14a, 0xffc21f, 0xfff3a0];

function starGeometry() {
  const a = paint(starGeo(0.95, 0.44, 0.3), () => 0xffd21f);
  const b = paint(starGeo(1.12, 0.52, 0.2), () => 0xb56a00);
  return mergeColored([{ geo: a, color: 0xffd21f }, { geo: b, color: 0xb56a00 }]);
}

function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

// Lines, arcs and zigzags along the lap, away from item rows, boost pads and obstacles.
function layout(tr, def) {
  const rnd = mulberry32(hashStr(def.id || 'x') + tr.n), n = tr.n, out = [];
  const avoid = [];
  for (const f of def.itemRows || []) avoid.push(f);
  for (const p of def.boostPads || []) avoid.push(p[0]);
  for (const o of def.obstacles || []) avoid.push(o.at);
  const PAT = 7, kinds = ['line', 'arc', 'zig', 'arc', 'line', 'zig', 'arc'];
  const room = tr.halfWidth - 3;
  for (let i = 0; i < PAT; i++) {
    const k = 5 + Math.floor(rnd() * 3), len = (k - 1) * SPACING, kind = kinds[(i + Math.floor(rnd() * 3)) % kinds.length];
    const base = 0.08 + ((i + 0.5) / PAT) * 0.88 + (rnd() - 0.5) * 0.03;
    let at = -1;
    for (const off of [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09]) {
      const c = base + off;
      if (c < 0.07 || c > 0.97) continue;
      const m = (len / 2 + 9) / tr.length;
      if (avoid.every((a) => Math.abs(a - c) > m && Math.abs(a - c - 1) > m && Math.abs(a - c + 1) > m)) { at = c; break; }
    }
    if (at < 0) continue;
    const lat0 = (rnd() * 2 - 1) * room * 0.6, amp = (0.35 + rnd() * 0.4) * room * (rnd() < 0.5 ? -1 : 1);
    for (let j = 0; j < k; j++) {
      const u = j / (k - 1), s = at * n + ((j - (k - 1) / 2) * SPACING) / tr.seg;
      let lat = lat0;
      if (kind === 'arc') lat = lat0 + amp * Math.sin(u * Math.PI) - amp * 0.5;
      else if (kind === 'zig') lat = lat0 + (j % 2 ? 1 : -1) * room * 0.3;
      out.push({ s: (s + n) % n, lat: clamp(lat, -room, room) });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

class Star {
  constructor(field, slot, s, lat, home, drop) {
    this.kind = 'star'; this.field = field; this.slot = slot; this.s = s; this.lat = lat;
    this.x = this.hx = home.x; this.y = this.hy = home.y; this.z = this.hz = home.z;
    this.on = true; this.age = 0; this.t = 0; this.pulledT = 0; this.drop = !!drop; this.life = 9;
    this.vx = 0; this.vy = 0; this.vz = 0; this.ph = (s * 0.37) % 6.283; this.skip = null; this.skipT = 0;
  }

  // Magnet: fly towards a kart.
  pullTo(kart, dt, speed = 26) {
    const dx = kart.x - this.x, dy = kart.y + 1 - this.y, dz = kart.z - this.z, d = Math.hypot(dx, dy, dz) || 1, m = Math.min(d, speed * dt);
    this.x += (dx / d) * m; this.y += (dy / d) * m; this.z += (dz / d) * m;
    this.pulledT = 0.2;
  }

  collect(kart) {
    if (!this.on || kart.out) return;
    const f = this.field, race = f.sys.race;
    kart.stars = Math.min(10, kart.stars + 1);
    race.particles.burst(true, GOLD, 10, this.x, this.y, this.z, 5, { size: 0.45, life: 0.5, gravity: 5 });
    race.sfx('item-starPick' + Math.min(9, kart.stars - 1), kart);
    this.on = false; this.t = BACK;
    if (this.drop) this.life = 0;
  }

  update(dt, sys) {
    const f = this.field, karts = sys.race.karts;
    this.age += dt;
    if (this.skipT > 0) this.skipT -= dt;
    if (!this.on) {
      this.t -= dt;
      if (this.t <= 0) { this.on = true; this.age = 0; }
    }
    if (this.drop) {
      this.life -= dt;
      if (this.life <= 0) { f.hide(this.slot); f.free.push(this.slot); return false; }
      this.vy -= 26 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      if (this.y < this.hy) { this.y = this.hy; this.vy = Math.abs(this.vy) * 0.55; if (this.vy < 3) this.vy = 0; this.vx *= 0.8; this.vz *= 0.8; }
    } else if (this.pulledT > 0) this.pulledT -= dt;
    else if (this.x !== this.hx || this.z !== this.hz) {
      const k = Math.min(1, dt * 4);
      this.x += (this.hx - this.x) * k; this.y += (this.hy - this.y) * k; this.z += (this.hz - this.z) * k;
    }
    if (this.on) {
      for (const k of karts) {
        if (k.out || k.finished) continue;
        const dx = k.x - this.x, dz = k.z - this.z;
        if (dx * dx + dz * dz > 5.5 || Math.abs(k.y + 1 - this.y) > 3.2) continue;
        if (this.skip === k && this.skipT > 0) continue;
        this.collect(k);
        break;
      }
    }
    if (!this.on) { f.hide(this.slot); return true; }
    const pop = Math.min(1, this.age * 4), sc = (this.drop && this.life < 1.5 ? (Math.sin(this.age * 30) > 0 ? 1 : 0.2) : 1) * (0.2 + 0.8 * Math.sin(pop * 1.5708)) * (this.drop ? 0.9 : 1);
    _d.position.set(this.x, this.y + Math.sin(sys.clock * 2.4 + this.ph) * 0.18, this.z);
    _d.rotation.set(0, sys.clock * 2.2 + this.ph, 0);
    _d.scale.setScalar(sc);
    _d.updateMatrix();
    f.mesh.setMatrixAt(this.slot, _d.matrix);
    const g = 1 + 0.45 * Math.max(0, Math.sin(sys.clock * 3 - this.s * 0.25)) ** 6; // glint wave runs along the road
    const a = f.mesh.instanceColor.array;
    a[this.slot * 3] = a[this.slot * 3 + 1] = a[this.slot * 3 + 2] = g;
    return true;
  }
}

class StarField {
  constructor(sys) {
    this.kind = 'starfield'; this.sys = sys;
    const race = sys.race, tr = sys.world.track, spots = layout(tr, sys.world.def);
    this.geo = starGeometry();
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const cap = spots.length + DROPS;
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, _c.setRGB(1, 1, 1));
    for (let i = 0; i < cap; i++) { this.mesh.instanceColor.array[i * 3] = this.mesh.instanceColor.array[i * 3 + 1] = this.mesh.instanceColor.array[i * 3 + 2] = 1; this.hide(i); }
    sys.world.scene.add(this.mesh);
    this.road = [];
    spots.forEach((p, i) => {
      tr.posAt(p.s, p.lat, _v);
      const st = new Star(this, i, p.s, p.lat, { x: _v.x, y: _v.y + 1.15, z: _v.z }, false);
      this.road.push(st); sys.add(st);
    });
    this.free = [];
    for (let i = cap - 1; i >= spots.length; i--) this.free.push(i);
    this.cool = race.karts.map(() => 0);
    this.aiT = 0;
  }

  hide(i) {
    _d.position.set(0, -500, 0); _d.scale.setScalar(0.0001); _d.updateMatrix();
    this.mesh.setMatrixAt(i, _d.matrix);
  }

  // A kart was hit: it loses up to three stars, which bounce away to be picked up again.
  dropFrom(kart) {
    const n = Math.min(3, kart.stars), sys = this.sys;
    for (let i = 0; i < n && this.free.length; i++) {
      const a = (i / 3) * 6.283 + Math.random(), slot = this.free.pop();
      const st = new Star(this, slot, kart.s, kart.lat, { x: kart.x, y: kart.y + 0.6, z: kart.z }, true);
      st.y = kart.y + 1.8; st.vx = Math.cos(a) * 7; st.vz = Math.sin(a) * 7; st.vy = 11;
      st.skip = kart; st.skipT = 1.3; st.hy = kart.y + 0.8;
      sys.add(st);
    }
    kart.stars -= n;
  }

  update(dt, sys) {
    const race = sys.race, karts = race.karts;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    // Big kids lose stars to a real hit (a spin or a flattening sets hitCool well above one second).
    if (race.age === 'big') {
      for (let i = 0; i < karts.length; i++) {
        const k = karts[i];
        if (k.hitCool > this.cool[i] + 1.1 && k.stars > 0) this.dropFrom(k);
        this.cool[i] = k.hitCool;
      }
    }
    // Computer racers drift a little towards the next star in their way.
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT = 0.3;
      const tr = sys.world.track, road = this.road;
      for (const k of karts) {
        if (k.out || k.finished || (k.human && !race.autopilot) || k.aiGoal) continue;
        for (const st of road) {
          if (!st.on) continue;
          let ds = st.s - k.s;
          if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
          if (ds > 3 / tr.seg && ds < 16 / tr.seg) {
            if (Math.abs(st.lat - k.aiLane) < 4.5) { k.aiLaneTarget = st.lat; k.aiLaneT = Math.max(k.aiLaneT, 0.7); }
            break;
          }
        }
      }
    }
    return true;
  }

  dispose() {
    this.sys.world.scene.remove(this.mesh);
    this.mesh.dispose(); this.geo.dispose(); this.mat.dispose();
  }
}

SYSTEM_HOOKS.push((sys) => {
  const race = sys.race;
  if ((race.world.def && race.world.def.arena) || race.mode.noRoadStars) return;
  sys.roadStars = true;
  sys.add(new StarField(sys));
});
