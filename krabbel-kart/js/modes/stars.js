// Star Scramble: gold stars lie around the arena, drive over them to collect. A hit makes the victim
// drop some (big: 3, little: 1) which scatter as stars again. The counts live in kart.score (kart.stars
// stays 0 so the leader gets no speed bonus). The stars follow the Stars contract: ItemSystem things with
// kind 'star', x y z and collect(kart).
import * as THREE from '../../vendor/three.module.min.js';
import { BattleMode, timeOption } from './battle.js';
import { addStrings, t } from '../i18n.js';
import { mergeColored, mat4, TAU, mulberry32 } from '../util.js';

addStrings({
  en: { modes: { stars: 'Star Scramble' }, modeSub: { stars: 'Collect the most stars' } },
  nl: { modes: { stars: 'Sterrenjacht' }, modeSub: { stars: 'Verzamel de meeste sterren' } },
});

const KEEP = 12, CAP = 44, R_GET = 2.4;
const _d = new THREE.Object3D(), _v = new THREE.Vector3();

function starGeo() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? 0.5 : 1.15; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
  g.translate(0, 0, -0.175);
  return g;
}

function crownGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.9, 1.0, 0.5, 10, 1, true), color: 0xffd21f, matrix: mat4(0, 0, 0) }];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    parts.push({ geo: new THREE.ConeGeometry(0.28, 0.8, 6), color: 0xffd21f, matrix: mat4(Math.cos(a) * 0.78, 0.6, Math.sin(a) * 0.78) });
    parts.push({ geo: new THREE.SphereGeometry(0.17, 6, 5), color: i % 2 ? 0xff4b4b : 0x4fb8ff, matrix: mat4(Math.cos(a) * 0.78, 1.05, Math.sin(a) * 0.78) });
  }
  return mergeColored(parts);
}

// One mesh for all stars; the things only keep their numbers.
class StarField {
  constructor(race) {
    this.race = race;
    this.geo = starGeo();
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0xb07a00 });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, CAP);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.used = new Uint8Array(CAP);
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < CAP; i++) this.mesh.setMatrixAt(i, z);
    race.world.scene.add(this.mesh);
    this.y0 = race.world.track.py[0] + 1.0;
  }

  alloc() { for (let i = 0; i < CAP; i++) if (!this.used[i]) { this.used[i] = 1; return i; } return -1; }
  free(i) { this.used[i] = 0; _d.scale.setScalar(0); _d.position.set(0, -50, 0); _d.updateMatrix(); this.mesh.setMatrixAt(i, _d.matrix); }
  dispose() { this.race.world.scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

class StarThing {
  constructor(mode, x, z, fly, lockK) {
    this.kind = 'star'; this.mode = mode; this.field = mode.field;
    this.x = x; this.z = z; this.y = this.field.y0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.slot = this.field.alloc();
    this.age = 0; this.done = false; this.flying = !!fly; this.lockK = lockK || null; this.lockT = lockK ? 1.1 : 0;
    this.ph = Math.random() * 6;
    if (fly) { const a = Math.random() * TAU, s = 7 + Math.random() * 5; this.vx = Math.cos(a) * s; this.vz = Math.sin(a) * s; this.vy = 9 + Math.random() * 4; this.y += 1.5; }
  }

  collect(kart) {
    if (this.done) return;
    this.done = true;
    this.mode.got(kart, this);
  }

  update(dt, sys) {
    if (this.done) return false;
    this.age += dt;
    if (this.lockT > 0) this.lockT -= dt;
    const f = this.field, tr = sys.world.track;
    if (this.flying) {
      this.x += this.vx * dt; this.z += this.vz * dt; this.vy -= 30 * dt; this.y += this.vy * dt;
      tr.locate(this.x, this.z, -1, _loc);
      const lim = tr.halfWidth - 1.5;
      if (Math.abs(_loc.lat) > lim) { // keep it on the road: slide back in
        const sg = Math.sign(_loc.lat), over = Math.abs(_loc.lat) - lim, i = _loc.i;
        this.x -= tr.rx[i] * over * sg; this.z -= tr.rz[i] * over * sg;
      }
      if (this.y <= f.y0 && this.vy < 0) { this.y = f.y0; if (this.vy < -6) this.vy = -this.vy * 0.4; else { this.flying = false; this.vy = 0; } }
    }
    const show = Math.min(1, 0.2 + this.age * 3) * (this.age > 0.0 ? 1 : 0);
    const bob = this.flying ? 0 : Math.sin(sys.clock * 3 + this.ph) * 0.22;
    _d.position.set(this.x, this.y + bob, this.z); _d.rotation.set(0, sys.clock * 2.2 + this.ph, 0); _d.scale.setScalar(show * 1.25); _d.updateMatrix();
    f.mesh.setMatrixAt(this.slot, _d.matrix);
    if (this.age > 0.25 || !this.flying) {
      for (const k of sys.race.karts) {
        if (k.out || (k === this.lockK && this.lockT > 0)) continue;
        const dx = k.x - this.x, dz = k.z - this.z;
        if (dx * dx + dz * dz < R_GET * R_GET && Math.abs(k.y + 1 - this.y) < 3.2) { this.collect(k); return false; }
      }
    }
    return true;
  }

  dispose() { this.field.free(this.slot); this.done = true; }
}
const _loc = {};

export class StarsMode extends BattleMode {
  static options(settings) { return [timeOption(settings)]; }

  build() {
    this.field = new StarField(this.race);
    this.crown = new THREE.Mesh(crownGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x554400 }));
    this.crown.visible = false; this.crown.castShadow = true;
    this.race.world.scene.add(this.crown);
    this.things = []; this.cool = 0; this.rnd = mulberry32(Math.floor(Math.random() * 1e6));
    this.pool = []; for (let i = 0; i < CAP; i++) this.pool.push({ x: 0, z: 0, color: '#ffd21f', shape: 'star' });
    this.view = [];
    this.disposers.push(() => { this.race.world.scene.remove(this.crown); this.crown.geometry.dispose(); this.crown.material.dispose(); this.field.dispose(); });
  }

  // Free spot on the road: away from other stars.
  spot(out) {
    const tr = this.race.world.track, hw = tr.halfWidth - 3.5;
    for (let tries = 0; tries < 8; tries++) {
      tr.posAt(this.rnd() * tr.n, (this.rnd() * 2 - 1) * hw, _v);
      let ok = true;
      for (const th of this.things) if (!th.done && Math.hypot(th.x - _v.x, th.z - _v.z) < 9) { ok = false; break; }
      if (ok) break;
    }
    out.x = _v.x; out.z = _v.z; return out;
  }

  addThing(x, z, fly, lockK) {
    if (this.things.length >= CAP || !this.race.items) return null;
    const th = new StarThing(this, x, z, fly, lockK);
    if (th.slot < 0) return null;
    this.things.push(this.race.items.add(th));
    return th;
  }

  tick(dt) {
    if (!this.race.items) return;
    // drop finished stars from my list, keep about KEEP of them lying around
    let lying = 0;
    for (let i = this.things.length - 1; i >= 0; i--) { const th = this.things[i]; if (th.done) this.things.splice(i, 1); else lying++; }
    this.cool -= dt;
    if (lying < KEEP && this.cool <= 0 && !this.over) { const p = this.spot({}); this.addThing(p.x, p.z, false); this.cool = this.race.state === 'racing' ? 0.7 : 0.05; }
    for (const k of this.race.karts) if (k.bt.star && k.bt.star.done) k.bt.thinkT = 0;
  }

  got(k, th) {
    if (!this.live) return;
    this.add(k, 1);
    this.race.particles.burst(true, [0xffd21f, 0xffffff, 0xfff08a], 12, th.x, th.y + 0.5, th.z, 6, { size: 0.5, life: 0.5, gravity: 2, sphere: true });
    if (k.human) this.race.game.audio.play('battle-star', 0.8); else this.sfxAt('battle-star', th.x, th.z, 0.4);
  }

  onHit(victim) {
    if (!this.live) return;
    const n = Math.min(victim.score, this.race.age === 'little' ? 1 : 3);
    if (n <= 0) return;
    victim.score -= n;
    for (let i = 0; i < n; i++) this.addThing(victim.x, victim.z, true, victim);
    this.sfxAt('battle-drop', victim.x, victim.z, 0.9);
  }

  sync() {
    if (!this.field) return;
    this.field.mesh.instanceMatrix.needsUpdate = true;
    const lead = this.race.sorted && this.race.sorted[0], c = this.crown;
    if (!lead || lead.score <= 0 || lead.out) { c.visible = false; return; }
    c.visible = true;
    const sv = lead.scaleVis, tm = this.race.clock;
    c.position.set(lead.x, lead.y + (lead.model.topY + 1.1) * sv + Math.sin(tm * 3) * 0.12, lead.z);
    c.rotation.y = tm * 2; c.scale.setScalar(1.15 * sv);
  }

  mapMarks() {
    const v = this.view; v.length = 0;
    let n = 0;
    for (const th of this.things) if (!th.done && n < CAP) { const p = this.pool[n++]; p.x = th.x; p.z = th.z; v.push(p); }
    return v;
  }

  hudInfo(k) {
    const info = super.hudInfo(k);
    info.place = `${k.score} ${t('battle.stars')}`;
    return info;
  }

  cols(k) { return [{ text: k.score, cls: 'pt big' }]; }

  think(k, bt) {
    const tr = this.race.world.track;
    // got something to throw: go for a rich rival
    if (k.item && k.rollT <= 0 && this.pickTarget(k, bt, (o) => o.score >= 2 && Math.hypot(o.x - k.x, o.z - k.z) < 70)) { bt.star = null; return; }
    bt.target = null;
    let best = null, bd = 1e9;
    for (const th of this.things) {
      if (th.done || (th.flying && th.age < 0.8)) continue;
      let d = Math.hypot(th.x - k.x, th.z - k.z);
      for (const o of this.race.karts) if (o !== k && !o.human && o.bt.star === th && Math.hypot(th.x - o.x, th.z - o.z) < d) { d += 40; break; }
      if (d < bd) { bd = d; best = th; }
    }
    if (this.wantsBox(k)) { const b = this.nearestBox(k, 30); if (b && bd > 18) { bt.star = null; this.aimAt(bt, b.x, b.z); return; } }
    bt.star = best;
    if (best) this.aimAt(bt, best.x, best.z);
    else { this.pickTarget(k, bt, null); }
  }
}

Object.assign(StarsMode, {
  id: 'stars',
  icon: '<svg viewBox="0 0 64 64" stroke="#2a2433" stroke-width="3.5" stroke-linejoin="round"><path d="M32 4l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 23l19-2z" fill="#ffd21f"/><path d="M50 4l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="#ff7ac0" transform="translate(-6 -2) scale(.8)"/><path d="M14 40l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#4fb8ff" transform="translate(0 6)"/></svg>',
});

export default StarsMode;
