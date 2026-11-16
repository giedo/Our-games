// Road obstacles. One ObstacleSystem per race, built after the ItemSystem, updated every race step and
// disposed with the race. It reads race.world.def.obstacles ([{ kind, at, lat, skin, ... }], see
// docs/DESIGN.md "Contracts") and race.world.packSkins, and builds the nine kinds of js/obstacles/kinds.js.
// Little age: soft effects only (kart.hit({ soft: true }), bump, launch); slick, spinner and popper are not built.
// It also runs the kart flights after a ramp or bouncer (landing boost, trick jumps for the big age) and gives
// computer racers advice where to drive (advise), which kart.aiControl follows.
import * as THREE from '../vendor/three.module.min.js';
import { KIT } from './scenery.js';
import { makeCanvas, canvasTexture, clamp } from './util.js';
import { bake, fit, Swarm } from './obstacles/swarm.js';
import { SKINS, DEFAULT } from './obstacles/looks.js';
import { KINDS, HARD, hubSkin, holeSkin } from './obstacles/kinds.js';
import './obstacles/sfx.js';

const VIEW = 260; // metres: obstacles further from every player are not drawn
const MAX_SHADOWS = 48;
const D = new THREE.Object3D();
D.rotation.order = 'YXZ';

export class ObstacleSystem {
  constructor(race) {
    this.race = race;
    this.world = race.world; this.scene = race.world.scene; this.tr = race.world.track;
    this.karts = race.karts; this.big = race.age === 'big';
    this.time = 0; this.list = []; this.P = { x: 0, y: 0, z: 0, fx: 0, fz: 1, rx: 1, rz: 0, yaw: 0, slope: 0 };
    this.fl = new Map(); this.fa = [];
    for (const k of this.karts) { const f = { k, air: false, t: 0, trick: false, kind: '', prev: false, aiAt: 0.3, will: false, ramp: null }; this.fl.set(k, f); this.fa.push(f); }
    this.rel = []; this.ah = []; this.amb = new Map();
    const defs = (race.world.def && race.world.def.obstacles) || [];
    for (const def of defs) {
      const K = KINDS[def.kind];
      if (!K || (!this.big && HARD[def.kind])) continue;
      try { this.list.push(new K(this, def)); } catch (e) { console.error('obstacle', def.kind, e); }
    }
    this.shN = 0;
    if (this.list.length) {
      const c = makeCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.shTex = canvasTexture(c);
      const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
      this.shMat = new THREE.MeshBasicMaterial({ map: this.shTex, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      this.sh = new THREE.InstancedMesh(geo, this.shMat, MAX_SHADOWS);
      this.sh.frustumCulled = false; this.sh.renderOrder = 0.8; this.sh.count = 0;
      this.scene.add(this.sh);
    }
  }

  // ---- helpers for the kinds ----

  // Road frame at sample index s (fractional) with a sideways offset and a height: this.P (reused).
  at(s, lat, h) {
    const tr = this.tr, n = tr.n, fl = Math.floor(s), f = s - fl, i0 = ((fl % n) + n) % n, i1 = (i0 + 1) % n, P = this.P;
    let tx = tr.tx[i0] + (tr.tx[i1] - tr.tx[i0]) * f, tz = tr.tz[i0] + (tr.tz[i1] - tr.tz[i0]) * f;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    P.fx = tx; P.fz = tz; P.rx = -tz; P.rz = tx; P.yaw = Math.atan2(tx, tz);
    P.x = tr.px[i0] + (tr.px[i1] - tr.px[i0]) * f + P.rx * lat;
    P.z = tr.pz[i0] + (tr.pz[i1] - tr.pz[i0]) * f + P.rz * lat;
    P.y = tr.py[i0] + (tr.py[i1] - tr.py[i0]) * f + h;
    P.slope = Math.atan2(tr.py[i1] - tr.py[i0], tr.seg);
    return P;
  }

  // Pack skin by the placement's skin name, then a built-in skin, then the pack's skin for the kind, then the plain look.
  look(kind, skin) {
    if (kind === 'hub') return hubSkin();
    if (kind === 'hole') return holeSkin(skin);
    const packs = this.world.packSkins || {}, own = SKINS[kind] || {};
    const fns = [skin && packs[skin], skin && own[skin], packs[kind], own[DEFAULT[kind]]].filter(Boolean);
    for (const fn of fns) {
      try { const o = fn(KIT); if (o) return o; } catch (e) { console.error('obstacle skin', kind, e); }
    }
    return own[DEFAULT[kind]](KIT);
  }

  swarm(kind, skin, n, order) {
    return new Swarm(this.scene, fit(bake(this.look(kind, skin)), kind === 'hub' || kind === 'hole' ? 'x' : kind), n, order);
  }

  shadow(x, y, z, r, yaw, slope) {
    if (this.shN >= MAX_SHADOWS) return;
    D.position.set(x, y + 0.06, z); D.rotation.set(-slope, yaw, 0); D.scale.set(r * 1.15, 1, r * 1.15); D.updateMatrix();
    this.sh.setMatrixAt(this.shN++, D.matrix);
  }

  air(k) { const a = k.y - k.prevG; return a > 0 ? a : 0; }

  // Push a kart sideways (sg = +1 to the right of the road).
  push(k, sg, strength) { const i = k.idx, tr = this.tr; k.bump(tr.rx[i] * sg, tr.rz[i] * sg, strength); }

  puff(vis, x, y, z, cols, n, speed) {
    if (vis) this.race.particles.burst(false, cols, n, x, y, z, speed, { size: 0.5, life: 0.6, gravity: 9 });
  }

  // A sound of something that happens to a kart: only players hear it.
  sfx(name, kart) { if (kart.human) this.race.sfx(name, kart); }

  // A sound at a place: heard by players who are close.
  ambient(name, x, z, vol) {
    const race = this.race, last = this.amb.get(name) || -9;
    if (race.clock - last < 0.15) return;
    for (const h of race.humans) {
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < 40) { this.amb.set(name, race.clock); race.game.audio.play(name, vol * (1 - d / 45)); return; }
    }
  }

  // The kart was launched by a ramp or bouncer: track the flight for the landing boost and the trick.
  fly(k, kind) {
    const f = this.fl.get(k);
    f.air = true; f.t = 0; f.trick = false; f.kind = kind; f.prev = k.driftHeld; f.aiAt = 0.25 + Math.random() * 0.35; f.will = Math.random() < 0.7;
  }

  // ---- computer racers ----

  // Where should a computer racer drive (lat in metres)? NaN: nothing to steer around or aim for.
  advise(k) {
    if (!this.list.length) return NaN;
    const rel = this.rel, ah = this.ah, hw = this.tr.halfWidth - 2.2, spd = Math.max(14, k.speed);
    rel.length = 0;
    for (const o of this.list) {
      const a = -o.along(k);
      if (a + o.half > 2 && a - o.half < 55) { ah[rel.length] = a; rel.push(o); }
    }
    if (!rel.length) return NaN;
    let best = NaN, bc = 1e9, tot = 0;
    for (let j = 0; j < 9; j++) {
      const lat = -hw + (j * 2 * hw) / 8;
      let c = 0;
      for (let i = 0; i < rel.length; i++) c += rel[i].risk(lat, ah[i], spd, this.time);
      tot += Math.abs(c);
      c += 0.02 * Math.abs(lat - k.lat) + 0.015 * Math.abs(lat - k.aiLaneTarget);
      if (c < bc) { bc = c; best = lat; }
    }
    return tot < 0.05 ? NaN : best;
  }

  // ---- the loop ----

  // time is the race clock in seconds.
  update(dt, time) {
    if (!this.list.length) return;
    this.time = time;
    const tr = this.tr, hs = this.race.humans;
    this.shN = 0;
    for (const o of this.list) {
      let vis = false;
      for (let i = 0; i < hs.length && !vis; i++) {
        let d = hs[i].s - o.s0;
        if (d < -tr.n / 2) d += tr.n; else if (d > tr.n / 2) d -= tr.n;
        vis = Math.abs(d) * tr.seg < VIEW + o.half;
      }
      o.vis = vis;
      o.step(dt, time);
      if (!vis) for (const s of o.swarms) s.show(false);
    }
    this.flights(dt);
    this.sh.count = this.shN; this.sh.instanceMatrix.needsUpdate = true; this.sh.visible = this.shN > 0;
  }

  flights(dt) {
    const race = this.race, auto = race.autopilot;
    for (const f of this.fa) {
      const k = f.k;
      if (!f.air) { f.prev = k.driftHeld; continue; }
      f.t += dt;
      if (k.spinT > 0 || k.out || f.t > 4) { f.air = false; continue; }
      if (this.big && !f.trick && f.t > 0.12) {
        const tap = k.driftHeld && !f.prev, ai = (!k.human || auto) && f.will && f.t > f.aiAt;
        if ((k.human && !auto && tap) || ai) {
          f.trick = true;
          const rem = (k.vy + Math.sqrt(Math.max(0, k.vy * k.vy + 60 * Math.max(0, k.y - k.prevG)))) / 30;
          k.anim.play('trick', { dur: clamp(rem * 0.9, 0.5, 1) });
          this.puff(true, k.x, k.y + 1, k.z, [0xffffff, 0xffd84a, 0xff5cf0, 0x4fe9ff], 12, 5);
          this.sfx('obs-whoosh', k);
        }
      }
      f.prev = k.driftHeld;
      if (k.grounded && f.t > 0.2) {
        f.air = false;
        if (f.trick) {
          k.boost(1.6, 1.4);
          this.puff(true, k.x, k.y + 0.5, k.z, [0xffd84a, 0xff5cf0, 0x4fe9ff, 0xffffff], 22, 7);
          this.sfx('obs-pop', k);
        } else k.boost(f.kind === 'ramp' ? 0.9 : 0.8, f.kind === 'ramp' ? 1.3 : 1.28);
        this.sfx('boost', k);
      }
    }
  }

  dispose() {
    for (const f of this.fa) { f.k.lift = 0; f.k.liftPitch = 0; }
    for (const o of this.list) o.dispose();
    this.list.length = 0;
    if (this.sh) { this.scene.remove(this.sh); this.sh.geometry.dispose(); this.sh.dispose(); this.shMat.dispose(); this.shTex.dispose(); }
  }
}
