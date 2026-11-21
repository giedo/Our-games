// The nine road obstacle kinds. Each works in "road space": lat (sideways metres, + = right) and d
// (metres along the road from its centre). The system (js/obstacles.js) owns looks, shadows, sounds and
// the kart flights (landing boosts, tricks). Little age: soft effects only; slick, spinner, popper are not built.
import { KIT } from '../scenery.js';
import { hubSkin, holeSkin } from './looks.js';

const { clamp, TAU } = KIT;
const PI = Math.PI;
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (x) => x * x * (3 - 2 * x);
// 0 at a, 1 at b, clamped.
const sat = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

// A flung body: offsets l (sideways), dd (along), h (up) from its normal place.
function fling(b, vl, vd, vh, spin) {
  b.fly = true; b.t = 0; b.bn = 0; b.l = 0; b.dd = 0; b.h = 0; b.vl = vl; b.vd = vd; b.vh = vh; b.spin = spin;
}
// Returns true when it came to rest (or flew too long).
function flyStep(b, dt) {
  b.t += dt; b.vh -= 24 * dt;
  b.l += b.vl * dt; b.dd += b.vd * dt; b.h += b.vh * dt; b.ang += b.spin * dt;
  if (b.h < 0) {
    b.h = 0;
    if (b.vh < -3 && b.bn < 3) { b.bn++; b.vh *= -0.42; b.vl *= 0.6; b.vd *= 0.6; b.spin *= 0.6; } else { b.vh = 0; b.vl *= 0.5; b.vd *= 0.5; b.spin *= 0.5; return true; }
  }
  return b.t > 3;
}
const newBody = () => ({ pop: 1, x: 0, y: 0, z: 0, fly: false, t: 0, bn: 0, l: 0, dd: 0, h: 0, vl: 0, vd: 0, vh: 0, spin: 0, ang: 0, sq: 0, cool: 0 });
const strong = (k) => k.fx.star > 0 || k.fx.giant > 0;

class Obs {
  constructor(sys, def) {
    this.sys = sys; this.def = def; this.kind = def.kind;
    this.s0 = def.at * sys.tr.n; this.lat = def.lat || 0;
    this.half = 5; this.vis = false; this.swarms = [];
    this.n = def.count | 0;
  }

  // Metres along the road from the obstacle's centre to the kart (+ = the kart is past it).
  along(k) {
    const tr = this.sys.tr;
    let d = k.s - this.s0;
    if (d < -tr.n / 2) d += tr.n; else if (d > tr.n / 2) d -= tr.n;
    return d * tr.seg;
  }

  swarm(kind, skin, n, order) { const s = this.sys.swarm(kind, skin, n, order); this.swarms.push(s); return s; }

  step() {}

  risk() { return 0; }

  commit() { for (const s of this.swarms) { s.show(this.vis); if (this.vis) s.commit(); } }

  dispose() { for (const s of this.swarms) s.dispose(); }
}

// ---- roller: balls roll back and forth across the road ----
class Roller extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.r = (def.size || 1.6) * 1.4;
    this.n = clamp(def.count | 0 || 1, 1, 3);
    this.period = def.period || 4;
    this.amp = sys.tr.halfWidth - 0.8;
    this.gap = this.r * 2 + 5;
    this.half = (this.gap * (this.n - 1)) / 2 + this.r + 1;
    this.sw = this.swarm('roller', def.skin, this.n);
    this.b = Array.from({ length: this.n }, newBody);
    this.ph = def.at * 40;
  }

  latAt(i, time) { return this.lat + this.amp * Math.sin((PI * time) / this.period + (i * TAU) / this.n + this.ph); }

  dAt(i) { return (i - (this.n - 1) / 2) * this.gap; }

  step(dt, time) {
    const sys = this.sys, r = this.r, karts = sys.karts;
    for (let i = 0; i < this.n; i++) {
      const b = this.b[i];
      if (b.fly) { if (flyStep(b, dt)) { b.fly = false; b.gone = 5; sys.puff(this.vis, b.x, b.y, b.z, [0xffffff, 0xffd84a], 10, 5); } }
      else if (b.gone > 0) { b.gone -= dt; if (b.gone <= 0) { b.gone = 0; b.pop = 0; } }
      else if (b.pop < 1) b.pop = Math.min(1, b.pop + dt * 3);
      b.sq *= Math.exp(-7 * dt);
    }
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half + 3) continue;
      const air = sys.air(k);
      for (let i = 0; i < this.n; i++) {
        const b = this.b[i];
        if (b.fly || b.gone > 0 || b.pop < 1 || air > 2 * r - 0.3) continue;
        const bl = this.latAt(i, time), dl = k.lat - bl, dz = dk - this.dAt(i), rr = r + 0.95;
        if (dl * dl + dz * dz > rr * rr) continue;
        const sg = dl >= 0 ? 1 : -1;
        if (strong(k)) {
          b.bl = bl; b.bd = this.dAt(i); b.ang = bl / r;
          fling(b, sg * rnd(6, 11), k.speed * 0.5 + 4, rnd(10, 15), rnd(6, 12));
          sys.puff(this.vis, k.x, k.y + 1, k.z, [0xffffff, 0xffd84a, 0xff5cf0], 14, 7);
          sys.sfx('obs-pop', k);
        } else if (!k.isImmune() && k.hitCool <= 0) {
          b.sq = 1;
          if (k.crash({ cause: 'roller' })) { sys.push(k, sg, 3); sys.sfx('obs-thud', k); }
        }
      }
    }
    if (!this.vis) return;
    for (let i = 0; i < this.n; i++) {
      const b = this.b[i];
      if (b.gone > 0) { this.sw.hide(i); continue; }
      const fl = b.fly;
      const lat = fl ? b.bl + b.l : this.latAt(i, time), d = fl ? b.bd + b.dd : this.dAt(i);
      const P = sys.at(this.s0 + d / sys.tr.seg, lat, 0), hop = Math.abs(Math.sin(time * 5 + i * 1.7));
      const y = P.y + r * (1 + 0.1 * hop) * b.pop + (fl ? b.h : 0), sq = 1 - 0.16 * (1 - hop) * (fl ? 0 : 1) - 0.25 * b.sq;
      const sc = r * b.pop;
      b.x = P.x; b.y = y; b.z = P.z;
      this.sw.set(i, P.x, y - r * (1 - sq) * b.pop * 0.6, P.z, P.yaw, -P.slope * 0.5, fl ? b.ang : lat / r, sc / Math.sqrt(sq), sc * sq, sc / Math.sqrt(sq));
      sys.shadow(P.x, P.y, P.z, r * (1.05 - (fl ? b.h : 0) * 0.04), P.yaw, P.slope);
    }
    this.commit();
  }

  risk(lat, ahead, spd, time) {
    let v = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.b[i].gone > 0) continue;
      const tA = Math.max(0, ahead + this.dAt(i)) / spd;
      v += Math.max(0, 1 - Math.abs(lat - this.latAt(i, time + tA)) / (this.r + 2.6));
    }
    return v;
  }
}

// ---- crosser: a file of critters waddles across the road and hops away when touched ----
class Crosser extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.n = clamp(def.count | 0 || 4, 3, 6);
    this.sp = def.speed || 2.5;
    this.sc = 2.1 * (def.size || 1);
    this.edge = sys.tr.halfWidth + 1.3;
    this.half = (this.n * 2.8) / 2 + 2;
    this.sw = this.swarm('crosser', def.skin, this.n);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.c = Array.from({ length: this.n }, (_, i) => Object.assign(newBody(), { lat: clamp(this.lat - dir * (i * 1.1 - 2) , -this.edge, this.edge), dir, d: (i - (this.n - 1) / 2) * 2.8, sp: this.sp * rnd(0.9, 1.1), walk: i * 0.7, gone: 0 }));
  }

  fold(x) { const e = this.edge, p = 4 * e; let m = (((x + e) % p) + p) % p; if (m > 2 * e) m = p - m; return m - e; }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts;
    for (const c of this.c) {
      if (c.cool > 0) c.cool -= dt;
      c.sq *= Math.exp(-8 * dt);
      if (c.fly) {
        if (flyStep(c, dt)) { c.fly = false; c.lat = clamp(c.lat + c.l, -this.edge, this.edge); c.l = c.dd = 0; c.sq = 0.6; }
      } else {
        c.lat += c.dir * c.sp * dt; c.walk += dt * c.sp * 0.9;
        if (c.lat > this.edge) { c.lat = this.edge; c.dir = -1; } else if (c.lat < -this.edge) { c.lat = -this.edge; c.dir = 1; }
      }
    }
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.fx.ghost > 0) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half + 3 || sys.air(k) > 0.9) continue;
      for (const c of this.c) {
        if (c.fly || c.cool > 0) continue;
        const dl = k.lat - (c.lat), dz = dk - c.d, rr = 0.55 * this.sc + 0.95;
        if (dl * dl + dz * dz > rr * rr) continue;
        const sg = dl > 0.05 ? 1 : dl < -0.05 ? -1 : c.dir, big = strong(k);
        fling(c, -sg * rnd(4, 7) * (big ? 1.7 : 1), k.speed * (big ? 0.6 : 0.3), big ? rnd(10, 14) : rnd(5.5, 7.5), big ? rnd(8, 14) : rnd(2, 4));
        c.cool = 1; c.bl = c.lat;
        sys.sfx('obs-squeak', k);
        if (!k.isImmune() && k.hitCool <= 0 && k.crash({ cause: 'crosser' })) sys.push(k, sg, 2);
      }
    }
    if (!this.vis) return;
    for (let i = 0; i < this.n; i++) {
      const c = this.c[i], fl = c.fly;
      const P = sys.at(this.s0 + (c.d + (fl ? c.dd : 0)) / sys.tr.seg, c.lat + (fl ? c.l : 0), 0);
      const hop = Math.abs(Math.sin(c.walk * PI)), yaw = Math.atan2(c.dir * P.rx, c.dir * P.rz) + (fl ? c.ang : 0);
      const s = this.sc, sq = 1 - 0.22 * c.sq;
      this.sw.set(i, P.x, P.y + (fl ? c.h : hop * 0.1 * s), P.z, yaw, fl ? 0.3 * Math.sin(c.ang) : 0.06, fl ? 0 : Math.sin(c.walk * PI) * 0.2, s / sq, s * sq, s / sq);
      sys.shadow(P.x, P.y, P.z, 0.55 * s * (1 - (fl ? c.h : 0) * 0.05), P.yaw, P.slope);
    }
    this.commit();
  }

  risk(lat, ahead, spd) {
    let v = 0;
    for (const c of this.c) {
      if (c.fly) continue;
      const tA = Math.max(0, ahead + c.d) / spd;
      v += Math.max(0, 1 - Math.abs(lat - this.fold(c.lat + c.dir * c.sp * tA)) / 3);
    }
    return v;
  }
}

// ---- bouncer: a springy pad, a big happy launch ----
class Bouncer extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.r = def.size || 2.2; this.half = this.r + 2; this.t0 = -9; this.sw = this.swarm('bouncer', def.skin, 1);
    this.cool = new Float32Array(sys.karts.length);
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts;
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.fx.ghost > 0 || k.fx.auto > 0 || this.cool[ki] > time) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half) continue;
      const dl = k.lat - this.lat, rr = this.r * 0.92;
      if (dl * dl + dk * dk > rr * rr || sys.air(k) > 0.8) continue;
      this.cool[ki] = time + 0.9; this.t0 = time;
      k.launch(19.5); k.squash = 1;
      sys.fly(k, 'bouncer');
      sys.puff(this.vis, k.x, k.y + 0.2, k.z, [0xffd84a, 0xff6fae, 0x4fd8ff, 0xffffff], 18, 6);
      sys.sfx('obs-boing', k);
    }
    if (!this.vis) return;
    const tau = time - this.t0, sy = tau < 1.6 ? 1 - 0.55 * Math.exp(-4.5 * tau) * Math.cos(TAU * 2.2 * tau) : 1 + 0.025 * Math.sin(time * 3 + this.s0);
    const P = sys.at(this.s0, this.lat, 0), w = 1 - 0.3 * (sy - 1);
    this.sw.set(0, P.x, P.y, P.z, P.yaw, -P.slope, 0, this.r * w, this.r * sy * 1.3, this.r * w);
    sys.shadow(P.x, P.y, P.z, this.r * 1.1, P.yaw, P.slope);
    this.commit();
  }

  risk(lat) { return -1.3 * Math.max(0, 1 - Math.abs(lat - this.lat) / (this.r + 1.6)); }
}

// ---- ramp: drive up, fly, land with a boost ----
class Ramp extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.w = def.size || 6; this.h = this.w * 0.26; this.len = this.w * 1.15; this.half = this.len / 2 + 2;
    this.slope = Math.atan2(this.h, this.len);
    this.sw = this.swarm('ramp', def.skin, 1);
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts, L = this.len;
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki], f = sys.fl.get(k);
      if (k.out || k.fx.ghost > 0) { if (f.ramp === this) { f.ramp = null; k.lift = 0; k.liftPitch = 0; } continue; }
      const dk = this.along(k), inside = Math.abs(dk) < this.half && Math.abs(k.lat - this.lat) < this.w / 2 - 0.1 && dk > -L / 2 && k.speed > 3 && sys.air(k) < 1.2 && !f.air;
      if (inside) {
        const y = (this.h * (dk + L / 2)) / L;
        f.ramp = this; k.lift = Math.max(0, y); k.liftPitch = this.slope;
        if (dk + k.speed * dt * 1.2 >= L / 2) {
          f.ramp = null; k.lift = 0; k.liftPitch = 0;
          k.launch(clamp(7 + k.speed * 0.42, 9, 21));
          sys.fly(k, 'ramp');
          sys.puff(this.vis, k.x, k.y, k.z, [0xffffff, 0xffd84a, 0x4fd8ff], 12, 5);
          sys.sfx('obs-whoosh', k);
        }
      } else if (f.ramp === this) { f.ramp = null; k.lift = 0; k.liftPitch = 0; }
    }
    if (!this.vis) return;
    const P = sys.at(this.s0 - L / 2 / sys.tr.seg, this.lat, 0);
    this.sw.set(0, P.x, P.y, P.z, P.yaw, -P.slope, 0, this.w, this.h, L);
    this.commit();
  }

  risk(lat) { return -1.3 * Math.max(0, 1 - Math.abs(lat - this.lat) / (this.w / 2 + 1.2)); }
}

// ---- cones: light things that tumble away and come back ----
class Cones extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.n = clamp(def.count | 0 || 6, 1, 14);
    this.sw = this.swarm('cones', def.skin, this.n);
    this.sc = 2.1;
    this.c = [];
    for (let i = 0; i < this.n; i++) {
      const ring = i === 0 ? 0 : i < 7 ? 1 : 2, a = ring ? ((i - (ring === 1 ? 1 : 7)) / (ring === 1 ? 6 : 7)) * TAU + ring : 0, R = ring * 2.1;
      this.c.push(Object.assign(newBody(), { l0: Math.cos(a) * R, d0: Math.sin(a) * R, state: 0, back: 0, gone: 0, ry: rnd(0, 6) }));
    }
    this.half = 2.1 * (this.n > 7 ? 2 : this.n > 1 ? 1 : 0) + 3;
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts;
    for (const c of this.c) {
      c.sq *= Math.exp(-6 * dt);
      if (c.fly) { if (flyStep(c, dt)) { c.fly = false; c.gone = 5.5; } }
      else if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) { c.gone = 0; c.back = 0.0001; } }
      else if (c.back > 0 && c.back < 1) c.back = Math.min(1, c.back + dt * 2.5);
      else if (c.back >= 1) c.back = 0;
    }
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.fx.ghost > 0 || k.fx.auto > 0) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half + 2 || sys.air(k) > 0.7) continue;
      let hitAny = false;
      for (const c of this.c) {
        if (c.fly || c.gone > 0 || (c.back > 0 && c.back < 0.7)) continue;
        const dl = k.lat - (this.lat + c.l0), dz = dk - c.d0;
        if (dl * dl + dz * dz > 2.1 * 2.1) continue;
        const sg = dl >= 0 ? 1 : -1, big = strong(k);
        fling(c, -sg * rnd(3, 8) * (big ? 1.5 : 1), k.speed * rnd(0.3, 0.6), rnd(6, 10) * (big ? 1.4 : 1), rnd(8, 16));
        c.back = 0; hitAny = true;
      }
      if (hitAny) {
        if (!strong(k) && !k.isImmune() && k.hitCool <= 0) k.crash({ cause: 'cones' });
        sys.sfx('obs-pop', k);
        sys.puff(this.vis, k.x + Math.sin(k.dir) * 1.5, k.y + 0.6, k.z + Math.cos(k.dir) * 1.5, [0xff5a7a, 0xffffff, 0xffd84a], 8, 5);
      }
    }
    if (!this.vis) return;
    for (let i = 0; i < this.n; i++) {
      const c = this.c[i];
      if (c.gone > 0) { this.sw.hide(i); continue; }
      const fl = c.fly, d = c.d0 + (fl ? c.dd : 0), lat = this.lat + c.l0 + (fl ? c.l : 0);
      const P = sys.at(this.s0 + d / sys.tr.seg, lat, 0), pop = c.back > 0 ? ease(c.back) * (1 + 0.15 * Math.sin(c.back * PI)) : 1;
      const wob = c.back > 0 ? Math.sin(c.back * 14) * 0.2 * (1 - c.back) : 0, sc = this.sc * pop;
      this.sw.set(i, P.x, P.y + (fl ? c.h : 0) + (fl ? 0.4 : 0), P.z, P.yaw + c.ry + (fl ? 0 : 0), fl ? c.ang : wob, fl ? c.ang * 0.6 : 0, sc);
      if (!fl) sys.shadow(P.x, P.y, P.z, 0.5 * sc, P.yaw, P.slope);
    }
    this.commit();
  }

  risk(lat) {
    let v = 0;
    for (const c of this.c) if (!c.fly && !c.gone) v += 0.6 * Math.max(0, 1 - Math.abs(lat - this.lat - c.l0) / 2);
    return v;
  }
}

// ---- slick: a slippery patch (big age only) ----
class Slick extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.r = def.size || 4; this.half = this.r + 2;
    this.sw = this.swarm('slick', def.skin, 1, 0.5);
    for (const m of this.sw.meshes) for (const mt of [].concat(m.material)) { mt.polygonOffset = true; mt.polygonOffsetFactor = -5; mt.polygonOffsetUnits = -5; }
    this.cool = new Float32Array(sys.karts.length);
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts;
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.isImmune()) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half) continue;
      const dl = k.lat - this.lat, rr = this.r * 0.9;
      if (dl * dl + dk * dk > rr * rr || sys.air(k) > 0.5) continue;
      k.addFx('slip', 0.9);
      if (this.cool[ki] < time) {
        this.cool[ki] = time + 1.4;
        sys.push(k, k.steerNow > 0.1 ? 1 : k.steerNow < -0.1 ? -1 : (dl >= 0 ? 1 : -1), 3.5);
        sys.puff(this.vis, k.x, k.y + 0.3, k.z, [0x7a4fd0, 0x31c8d8, 0xffffff], 10, 4);
        sys.sfx('obs-whoosh', k);
      }
    }
    if (!this.vis) return;
    const P = sys.at(this.s0, this.lat, 0.03);
    const br = 1 + 0.02 * Math.sin(time * 2 + this.s0);
    this.sw.set(0, P.x, P.y, P.z, P.yaw + time * 0.15, -P.slope, 0, this.r * br * 1.25);
    this.commit();
  }

  risk(lat) { return 1.2 * Math.max(0, 1 - Math.abs(lat - this.lat) / (this.r + 1.6)); }
}

// ---- spinner: an arm sweeps around a hub (big age only) ----
class Spinner extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.L = def.size || 6; this.w = TAU / (def.period || 5); this.half = this.L + 2;
    this.th0 = def.at * 17;
    this.arm = this.swarm('spinner', def.skin, 1);
    this.hub = this.swarm('hub', null, 1);
    this.last = 0;
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts, th = this.th0 + this.w * time, c = Math.cos(th), s = Math.sin(th), L = this.L;
    // Arm from the hub (lat, 0) to the tip (lat - L cos, -L sin) in road space.
    const ex = -L * c, ez = -L * s;
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.isImmune() || k.hitCool > 0) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > L + 3 || sys.air(k) > 1.0) continue;
      const px = k.lat - this.lat, pz = dk;
      const t = clamp((px * ex + pz * ez) / (L * L), 0, 1), qx = px - ex * t, qz = pz - ez * t;
      if (qx * qx + qz * qz > (1.15 + (t > 0.9 ? 0.3 : 0)) ** 2) continue;
      // Push the way the arm swings.
      const tr = sys.tr, i = k.idx, lx = s, lz = -c;
      k.crash({ cause: 'spinner' });
      k.bump(tr.rx[i] * lx + tr.tx[i] * lz, tr.rz[i] * lx + tr.tz[i] * lz, 9);
      sys.sfx('obs-thud', k);
    }
    if (Math.floor(th / PI) !== this.last) { this.last = Math.floor(th / PI); const P = sys.at(this.s0, this.lat, 0); sys.ambient('obs-whoosh', P.x, P.z, 0.5); }
    if (!this.vis) return;
    const P = sys.at(this.s0, this.lat, 0);
    this.arm.set(0, P.x, P.y + 0.15, P.z, P.yaw + th, -P.slope, 0, L);
    this.hub.set(0, P.x, P.y, P.z, P.yaw, -P.slope, 0, 3);
    this.commit();
    sys.shadow(P.x, P.y, P.z, 0.8, P.yaw, P.slope);
  }

  risk(lat) { return Math.abs(lat - this.lat) < this.L + 1.3 ? 1 : 0; }
}

// ---- popper: pops out of the road on a rhythm (big age only) ----
class Popper extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.P = Math.max(2.2, def.period || 3); this.off = def.at * 23; this.half = 4;
    this.sc = 1.4;
    this.thing = this.swarm('popper', def.skin, 1);
    this.hole = this.swarm('hole', def.skin, 1, 0.4);
    this.cool = new Float32Array(sys.karts.length);
    this.state = 0; this.pops = 0;
  }

  // Height of the thing above the road (-1.6 = buried) and whether it is dangerous, for a cycle time.
  phase(time) {
    const P = this.P, tau = (time + this.off) % P, T0 = 0.7, T1 = 0.18, T2 = 0.55, T3 = 0.3, st = P - (T0 + T1 + T2 + T3) > 0 ? P - (T0 + T1 + T2 + T3) : 0;
    const u = tau - st;
    if (u < 0) return { y: -2.2, tel: 0, hot: false };
    if (u < T0) return { y: -2.2 + 0.5 * ease(u / T0) + 0.12 * Math.sin(u * 40), tel: u / T0, hot: false };
    if (u < T0 + T1) { const x = (u - T0) / T1; return { y: -1.7 + 3.6 * ease(x), tel: 1, hot: true }; }
    if (u < T0 + T1 + T2) return { y: 1.9 + 0.12 * Math.sin((u - T0 - T1) * 22), tel: 1, hot: true };
    if (u < T0 + T1 + T2 + T3) { const x = (u - T0 - T1 - T2) / T3; return { y: 1.9 - 4.1 * ease(x), tel: 0, hot: x < 0.4 }; }
    return { y: -2.2, tel: 0, hot: false };
  }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts, ph = this.phase(time);
    if (ph.hot && !this.hotPrev) { this.pops++; const P = sys.at(this.s0, this.lat, 0.2); sys.puff(this.vis, P.x, P.y, P.z, [0x8a6a4a, 0xffffff, 0xffd84a], 16, 6); sys.ambient('obs-pop', P.x, P.z, 0.7); }
    this.hotPrev = ph.hot;
    if (ph.hot) {
      for (let ki = 0; ki < karts.length; ki++) {
        const k = karts[ki];
        if (k.out || k.finished || k.isImmune() || this.cool[ki] > time) continue;
        const dk = this.along(k), dl = k.lat - this.lat;
        if (Math.abs(dk) > 3 || dl * dl + dk * dk > 2.2 * 2.2 || sys.air(k) > 1.0) continue;
        this.cool[ki] = time + 1.5;
        k.launch(15); k.crash({ cause: 'popper' });
        sys.sfx('obs-boing', k);
      }
    }
    if (!this.vis) return;
    const P = sys.at(this.s0, this.lat, 0), pulse = ph.tel > 0 && ph.tel < 1 ? 1 + 0.06 * Math.sin(time * 30) : 1;
    this.hole.set(0, P.x, P.y, P.z, P.yaw, -P.slope, 0, 2.1 * pulse);
    if (ph.y < -2.1) this.thing.hide(0);
    else {
      const stretch = ph.hot && ph.y > 0 ? 1 + 0.12 * Math.sin(ph.y * 2) : 1;
      this.thing.set(0, P.x, P.y + ph.y, P.z, P.yaw + (ph.tel > 0 ? Math.sin(time * 28) * 0.15 : 0), -P.slope, 0, this.sc / stretch, this.sc * stretch, this.sc / stretch);
    }
    this.commit();
  }

  risk(lat, ahead, spd, time) {
    const tA = Math.max(0, ahead) / spd, ph = this.phase(time + tA);
    return Math.abs(lat - this.lat) < 3 ? (ph.hot || ph.tel > 0.3 ? 1.1 : 0.25) : 0;
  }
}

// ---- traffic: slow toy vehicles drive along the road ----
class Traffic extends Obs {
  constructor(sys, def) {
    super(sys, def);
    this.n = clamp(def.count | 0 || 2, 1, 4);
    this.v = def.speed || 9; this.span = Math.max(120, this.n * 60);
    this.half = this.span / 2 + 3; this.sc = 2.1;
    const m = sys.tr.halfWidth - 1.6;
    this.lanes = this.lat === 0 ? [-3.8, 3.8] : [this.lat, this.lat > 0 ? this.lat - 8 : this.lat + 8];
    this.lanes = this.lanes.map((x) => clamp(x, -m, m));
    this.sw = this.swarm('traffic', def.skin, this.n);
    this.cars = Array.from({ length: this.n }, (_, i) => Object.assign(newBody(), { lane: this.lanes[i % 2], d: 0, honk: 0, fade: 1, dev: 0 }));
    this.cool = new Float32Array(sys.karts.length);
  }

  posOf(i, time) { return ((time * this.v + (i * this.span) / this.n) % this.span) - this.span / 2; }

  step(dt, time) {
    const sys = this.sys, karts = sys.karts;
    for (let i = 0; i < this.n; i++) {
      const c = this.cars[i];
      c.d = this.posOf(i, time); c.sq *= Math.exp(-6 * dt); c.honk -= dt;
      c.fade = Math.min(1, Math.min(c.d + this.span / 2, this.span / 2 - c.d) / 6);
      if (c.fly) { if (flyStep(c, dt)) { c.fly = false; c.dev = c.l; c.l = c.dd = 0; } }
      else c.dev *= Math.exp(-2 * dt);
    }
    for (let ki = 0; ki < karts.length; ki++) {
      const k = karts[ki];
      if (k.out || k.finished || k.fx.ghost > 0 || k.fx.auto > 0) continue;
      const dk = this.along(k);
      if (Math.abs(dk) > this.half + 4) continue;
      const air = sys.air(k);
      for (let i = 0; i < this.n; i++) {
        const c = this.cars[i];
        if (c.fly || c.fade < 0.5) continue;
        const dl = k.lat - (c.lane + c.dev), dz = dk - c.d;
        if (c.honk <= 0 && dz < -4 && dz > -16 && Math.abs(dl) < 3 && k.human) { c.honk = 5; sys.sfx('obs-honk', k); }
        if (air > 1.1 || Math.abs(dl) > 2.2 || Math.abs(dz) > 3.7) continue;
        c.sq = 1;
        const sg = dl >= 0 ? 1 : -1;
        if (strong(k)) {
          fling(c, sg * -rnd(8, 12), k.speed * 0.4, rnd(7, 10), rnd(6, 10)); c.ang = 0;
          sys.sfx('obs-pop', k); continue;
        }
        const penL = 2.2 - Math.abs(dl), penZ = 3.7 - Math.abs(dz), tr = sys.tr, ix = k.idx;
        if (penZ < penL * 1.6 && dz <= 0) { k.x -= tr.tx[ix] * penZ; k.z -= tr.tz[ix] * penZ; } else { k.x += tr.rx[ix] * sg * penL; k.z += tr.rz[ix] * sg * penL; }
        if (this.cool[ki] < time) {
          this.cool[ki] = time + 0.7;
          k.crash({ cause: 'traffic' });
          sys.push(k, sg, sys.big ? 6 : 4);
          sys.sfx('obs-honk', k);
        }
      }
    }
    if (!this.vis) return;
    for (let i = 0; i < this.n; i++) {
      const c = this.cars[i], fl = c.fly;
      const P = sys.at(this.s0 + (c.d + (fl ? c.dd : 0)) / sys.tr.seg, c.lane + c.dev + (fl ? c.l : 0), 0);
      const sc = this.sc * ease(c.fade), sq = 1 - 0.12 * c.sq, bob = Math.sin(time * 9 + i * 2) * 0.03;
      this.sw.set(i, P.x, P.y + bob + (fl ? c.h : 0), P.z, P.yaw + (fl ? c.ang : 0), -P.slope + (fl ? c.ang * 0.2 : 0), Math.sin(time * 5.5 + i) * 0.015, sc / sq, sc * sq, sc);
      sys.shadow(P.x, P.y, P.z, 1.5 * sc, P.yaw, P.slope);
    }
    this.commit();
  }

  risk(lat, ahead) {
    let v = 0;
    for (const c of this.cars) v += 0.9 * Math.max(0, 1 - Math.abs(lat - c.lane) / 3.2);
    return v;
  }
}

export const KINDS = { roller: Roller, crosser: Crosser, bouncer: Bouncer, ramp: Ramp, cones: Cones, slick: Slick, spinner: Spinner, popper: Popper, traffic: Traffic };
// Kinds that are too rough for the little age group.
export const HARD = { slick: 1, spinner: 1, popper: 1 };
export { hubSkin, holeSkin };
