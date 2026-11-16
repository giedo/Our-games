// Character animation. One Animator per racer model (a kart, the menu preview, a podium racer). It runs
// short procedural clips (select idle throw win lose hit overtake boost trick) on the two identity groups
// model.anim (whole racer) and model.driverAnim (the driver's drawing), after the owner set its own
// transforms, and pops little emote sprites (stars, hearts, drops, sparkles, notes) above the driver.
// Clips are additive and layered; body gestures replace each other by fading out the old one.
// Gestures: see GESTURES below. play(name, { strength, dur, loop, delay }).
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvas, canvasTexture, clamp, mulberry32, TAU } from './util.js';

const ease = (x) => x * x * (3 - 2 * x);
const sat = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const hump = (u, a, b) => Math.sin(Math.PI * sat(u, a, b));
const env = (u, a, b, c, d) => ease(sat(u, a, b)) * (1 - ease(sat(u, c, d)));
const spring = (s, f, k) => Math.exp(-k * s) * Math.cos(TAU * f * s);

// Pose: sums of what the playing clips ask for (reset every frame).
const NEW = () => ({ aox: 0, aoy: 0, aoz: 0, arx: 0, ary: 0, arz: 0, asx: 1, asy: 1, asz: 1, dox: 0, doy: 0, doz: 0, drx: 0, dry: 0, drz: 0, dsx: 1, dsy: 1, dsz: 1 });
const squash = (P, w, sy) => { const sx = 1 + (1 - sy) * 0.55; P.asy *= 1 + w * (sy - 1); P.asx *= 1 + w * (sx - 1); P.asz *= 1 + w * (sx - 1); };

// A jump with anticipation: u in 0..1 over one jump; returns height 0..1 and sets squash.
function jump(P, w, u, h, p) {
  const crouch = u < 0.2 ? ease(u / 0.2) : 0, v = sat(u, 0.2, 0.75), air = v > 0 && v < 1 ? 4 * v * (1 - v) : 0, land = hump(u, 0.75, 0.9);
  P.aoy += w * air * h * p.b;
  squash(P, w, 1 - 0.18 * crouch + 0.13 * air - 0.17 * land);
  P.dsy *= 1 + w * 0.05 * air;
  return v;
}

// name: { dur (s), excl (a body gesture), rush (never fades: finishes fast when interrupted), rep (u to jump back to
// when called again), ev: [[u, emote, opts]], fn(P, u, t, w, p, str) }
const GESTURES = {
  select: { dur: 1.7, excl: true, rush: true, ev: [[0.24, 'sparkle', { n: 2 }], [0.45, 'heart']],
    fn(P, u, t, w, p) {
      const v = jump(P, w, u / 0.78, 1, p);
      if (u < 0.62) P.ary += w * p.sd * TAU * ease(sat(u, 0.24, 0.6));
      const s = sat(u, 0.62, 1);
      P.drz += w * 0.3 * p.w * Math.sin(TAU * 3.2 * p.tp * (t - 0.9)) * env(u, 0.6, 0.7, 0.8, 1) + w * 0.12 * p.w * Math.sin(TAU * 2.4 * t) * hump(u, 0.05, 0.3);
      P.dsy *= 1 + w * 0.06 * spring(s, 2, 4) * (u > 0.62 ? 1 : 0);
      P.dry += w * 0.25 * p.w * Math.sin(TAU * 2 * (t - 1)) * env(u, 0.7, 0.8, 0.9, 1);
    } },
  throw: { dur: 0.6, ev: [],
    fn(P, u, t, w) {
      const back = ease(sat(u, 0, 0.25)), snap = ease(sat(u, 0.25, 0.42)), rest = u > 0.42 ? sat(u, 0.42, 1) : 0;
      const lean = -0.35 * back * (1 - snap) + 0.5 * snap * (1 - ease(rest)) + (rest > 0 ? 0.12 * Math.sin(TAU * 2.2 * rest) * (1 - rest) : 0);
      P.drx += w * lean; P.dsy *= 1 + w * 0.05 * back * (1 - snap);
      const dip = hump(u, 0.25, 0.7);
      P.aoy -= w * 0.05 * dip; P.arx += w * 0.07 * dip; squash(P, w, 1 - 0.05 * dip);
    } },
  win: { dur: 2.6, excl: true, rush: true, loop: false, ev: [[0.3, 'star'], [0.58, 'heart'], [0.86, 'star']],
    fn(P, u, t, w, p, str) {
      const j = Math.min(2, Math.floor(u / 0.3)), ju = (u - j * 0.3) / 0.3;
      if (u < 0.9) {
        const v = jump(P, w, ju, 1.05 * str, p);
        if (j === 1 && v > 0 && v < 1) P.ary += w * p.sd * TAU * ease(v);
        P.drz += w * 0.28 * p.w * str * Math.sin(TAU * 3.4 * p.tp * t) * (v > 0 && v < 1 ? 0.5 : 1);
        P.dsy *= 1 + w * 0.08 * str * hump(ju, 0.2, 0.75);
      } else P.drz += w * 0.2 * p.w * str * Math.sin(TAU * 3 * t) * (1 - sat(u, 0.9, 1));
    } },
  lose: { dur: 2.8, excl: true, ev: [[0.25, 'drop'], [0.8, 'sparkle', { n: 1 }]],
    fn(P, u, t, w, p) {
      const droop = env(u, 0, 0.2, 0.62, 0.78);
      P.dsy *= 1 - w * 0.1 * droop; P.drx += w * 0.3 * droop; P.aoy -= w * 0.03 * droop; squash(P, w, 1 - 0.04 * droop);
      P.dry += w * 0.42 * Math.sin(TAU * 1.4 * (t - 0.5)) * env(u, 0.2, 0.28, 0.58, 0.68);
      const b = sat(u, 0.78, 1);
      if (b > 0 && b < 1) { P.aoy += w * 0.3 * p.b * 4 * b * (1 - b); squash(P, w, 1 + 0.1 * 4 * b * (1 - b) - 0.1 * hump(b, 0, 0.2)); P.drx -= w * 0.15 * hump(b, 0, 1); }
    } },
  hit: { dur: 1.5, excl: true, ev: [[0, 'orbit']],
    fn(P, u, t, w, p) {
      const e = Math.exp(-2.4 * t), ph = TAU * 3.3 * t;
      P.drz += w * 0.4 * Math.sin(ph) * e; P.drx += w * 0.25 * Math.sin(ph + 1.57) * e; P.dry += w * 0.7 * Math.sin(TAU * 1.3 * t) * e;
      squash(P, w, 1 - 0.22 * Math.exp(-10 * t) + 0.06 * Math.sin(TAU * 4 * t) * e);
    } },
  overtake: { dur: 0.7, rep: 0.3, ev: [[0.1, 'star', { small: 1 }]],
    fn(P, u, t, w, p) {
      const h = hump(u, 0, 0.75), puff = env(u, 0, 0.25, 0.55, 1);
      P.aoy += w * 0.32 * p.b * h; squash(P, w, 1 + 0.08 * h);
      P.dsx *= 1 + w * 0.1 * puff; P.dsy *= 1 + w * 0.1 * puff; P.drx -= w * 0.2 * puff;
    } },
  boost: { dur: 0.85, rep: 0.3,
    fn(P, u, t, w) {
      const e = env(u, 0, 0.12, 0.45, 1);
      P.drx -= w * 0.5 * e; P.asz *= 1 + w * 0.07 * e; P.asy *= 1 - w * 0.03 * e; P.arx -= w * 0.05 * e; P.dsy *= 1 + w * 0.06 * e;
    } },
  trick: { dur: 0.85, excl: true, rush: true, ev: [[0.5, 'sparkle', { n: 2 }]],
    fn(P, u, t, w, p) {
      P.arz += w * p.sd * TAU * ease(u) * (u < 1 ? 1 : 0);
      P.drz += w * 0.3 * Math.sin(TAU * 3 * t) * hump(u, 0, 1); squash(P, w, 1 + 0.07 * hump(u, 0, 1));
    } },
  // Internal idle events.
  look: { dur: 1.6, fn(P, u, t, w, p) { P.dry += w * 0.55 * p.sd * Math.sin(TAU * 0.75 * u) * hump(u, 0, 1); P.drz += w * 0.06 * hump(u, 0.2, 0.8); } },
  bounce: { dur: 0.55, fn(P, u, t, w, p) { jump(P, w, u, 0.22, p); } },
};

// ---- emote sprites (shared textures, pooled sprites per animator) ----
let TEX = null;
function emoteTextures() {
  if (TEX) return TEX;
  const mk = (draw) => {
    const c = makeCanvas(64, 64), g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = '#2a2433';
    draw(g);
    const t = canvasTexture(c, { mip: false }); t.userData.shared = true;
    return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
  };
  const star = (g, cx, cy, ro, ri, n) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? ri : ro; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); };
  TEX = {
    star: mk((g) => { star(g, 32, 34, 27, 12, 5); g.fillStyle = '#ffd21f'; g.fill(); g.stroke(); }),
    sparkle: mk((g) => { g.lineWidth = 3; g.strokeStyle = '#ffb300'; star(g, 32, 32, 28, 6, 4); g.fillStyle = '#ffffff'; g.fill(); g.stroke(); }),
    heart: mk((g) => { g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(2, 36, 6, 8, 24, 10); g.bezierCurveTo(30, 11, 32, 17, 32, 20); g.bezierCurveTo(32, 17, 34, 11, 40, 10); g.bezierCurveTo(58, 8, 62, 36, 32, 56); g.closePath(); g.fillStyle = '#ff5c8a'; g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(19, 21, 5, 3, -0.6, 0, TAU); g.fill(); }),
    drop: mk((g) => { g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(52, 30, 54, 40, 46, 50); g.bezierCurveTo(38, 60, 26, 60, 18, 50); g.bezierCurveTo(10, 40, 12, 30, 32, 6); g.closePath(); g.fillStyle = '#6fd3ff'; g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(25, 42, 4, 6, 0.3, 0, TAU); g.fill(); }),
    note: mk((g) => { g.beginPath(); g.ellipse(22, 48, 11, 8, -0.4, 0, TAU); g.fillStyle = '#7a5cff'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(31, 46); g.lineTo(31, 8); g.quadraticCurveTo(48, 14, 46, 30); g.stroke(); }),
  };
  return TEX;
}

const POOL = 5;
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3();

export class Animator {
  // model: what buildRacerModel returned. opts: { kart } for race karts, { preview: true } for the menu preview,
  // { podium: true, rank } for podium racers; opts.id (the sticker id) seeds the racer's personality.
  constructor(model, opts) {
    this.model = model; this.opts = opts || {};
    const id = String(this.opts.id || (this.opts.kart && this.opts.kart.driver && this.opts.kart.driver.id) || (model.driverMesh && model.driverMesh.geometry.uuid) || 'x');
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    const r = mulberry32(h >>> 0);
    this.p = { tp: 0.88 + r() * 0.3, b: 0.8 + r() * 0.45, w: 0.7 + r() * 0.6, sd: r() < 0.5 ? -1 : 1, gap: 4 + r() * 4 };
    this.pose = NEW();
    this.slots = [];
    for (let i = 0; i < 6; i++) this.slots.push({ on: false, def: null, name: '', t: 0, dur: 1, out: 0, outing: false, speed: 1, str: 1, loop: false, ev: 0, delay: 0, extra: null });
    this.idleT = 2 + r() * 3; this.clock = 0;
    this.sprites = []; this.em = [];
    this.centre = 0.9;
  }

  // Start a gesture by name. opts: { strength, dur, loop, delay }
  play(name, opts) {
    const def = GESTURES[name];
    if (!def) return;
    const o = opts || {};
    if (def.rep !== undefined) for (const s of this.slots) if (s.on && s.name === name && !s.outing) { s.t = Math.min(s.t, def.rep * s.dur); return; }
    if (def.excl) for (const s of this.slots) if (s.on && s.def.excl && !s.outing) this._out(s);
    else if (s.on && s.name === name && !s.outing) this._out(s);
    let s = this.slots.find((x) => !x.on) || this.slots.find((x) => x.outing) || this.slots[0];
    s.on = true; s.def = def; s.name = name; s.out = 0; s.outing = false; s.speed = 1; s.ev = 0;
    s.dur = (o.dur || def.dur / this.p.tp); s.t = 0; s.str = o.strength === undefined ? 1 : o.strength;
    s.loop = !!(o.loop || (name === 'win' && this.opts.kart)); s.delay = o.delay || 0;
    if (name === 'hit' && this.opts.kart) s.dur = def.dur;
  }

  _out(s) {
    if (s.def.rush) { s.outing = true; s.loop = false; s.speed = 3; } else { s.outing = true; s.out = 0; }
  }

  emote(type, o) {
    const o2 = o || {}, kart = this.opts.kart;
    if (kart && kart.race) {
      let near = false;
      for (const h of kart.race.humans) if (Math.abs(h.x - kart.x) + Math.abs(h.z - kart.z) < 90) { near = true; break; }
      if (!near) return;
    }
    const mats = emoteTextures(), m = this.model;
    let e = this.em.find((x) => !x.on);
    if (!e) {
      if (this.em.length < POOL) {
        const sp = new THREE.Sprite(mats[type]); sp.renderOrder = 8; sp.visible = false; m.root.add(sp);
        e = { sp, on: false, t: 0, life: 1, size: 0.6, ang: 0, w: 0, mode: 0, vx: 0, vy: 0, x: 0, y: 0, z: 0 }; this.em.push(e);
      } else e = this.em[0];
    }
    e.on = true; e.t = 0; e.sp.material = mats[type]; e.sp.visible = true;
    const pv = m.pivot.position, top = m.topY + 0.3;
    e.size = (o2.small ? 0.45 : 0.62) * (o2.size || 1);
    if (o2.orbit) { e.mode = 1; e.life = o2.life || 1.3; e.ang = o2.ang || 0; e.w = 7; e.x = pv.x; e.z = pv.z; e.y = top; }
    else if (type === 'drop') { e.mode = 2; e.life = 1.1; e.x = pv.x + 0.55; e.z = pv.z; e.y = top - 0.35; e.vx = 0.3; e.vy = 0.2; }
    else { e.mode = 0; e.life = o2.life || 0.95; e.x = pv.x + (Math.random() - 0.5) * 1.1; e.z = pv.z + (Math.random() - 0.5) * 0.4; e.y = top + Math.random() * 0.3; e.vx = (Math.random() - 0.5) * 0.6; e.vy = 1.1 + Math.random() * 0.6; }
    e.sp.position.set(e.x, e.y, e.z);
    this.centre = Math.max(0.5, m.topY * 0.4);
  }

  _ev(s, ev) {
    const type = ev[1], o = ev[2];
    if (type === 'orbit') { for (let i = 0; i < 3; i++) this.emote('star', { orbit: true, ang: (i / 3) * TAU, small: true }); return; }
    for (let i = 0; i < ((o && o.n) || 1); i++) this.emote(type, o);
    if (s.name === 'select' && type === 'sparkle' && this.p.b > 1.05) this.emote('note');
  }

  // state is the owner: the Kart in a race (speed, finished...), null elsewhere.
  update(dt, time, state) {
    const m = this.model, P = this.pose, p = this.p;
    if (!m.anim) return;
    if (dt > 0.1) dt = 0.1;
    this.clock += dt;
    Object.assign(P, NEW());
    // Idle: breathing always, a look-around or a bounce now and then (menu and podium).
    const calm = state ? clamp(1 - Math.abs(state.speed) / 8, 0, 1) * 0.5 : 1;
    if (calm > 0) {
      const b = Math.sin(TAU * 0.42 * p.tp * this.clock);
      P.dsy *= 1 + 0.02 * b * calm; P.dsx *= 1 - 0.01 * b * calm; P.aoy += 0.012 * (1 + b) * calm; P.drz += 0.015 * Math.sin(TAU * 0.2 * this.clock + p.w) * calm;
      if (!state && dt > 0) {
        this.idleT -= dt;
        if (this.idleT <= 0) { this.idleT = p.gap + Math.random() * 4; if (!this.slots.some((s) => s.on && s.def.excl)) this.play(Math.random() < 0.6 ? 'look' : 'bounce'); }
      }
    }
    for (const s of this.slots) {
      if (!s.on) continue;
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.t += dt * s.speed;
      let w = s.def.rush ? 1 : Math.min(1, s.t / 0.07);
      if (s.outing && !s.def.rush) { s.out += dt; w *= 1 - s.out / 0.18; if (w <= 0) { s.on = false; continue; } }
      if (s.t >= s.dur) { if (s.loop) { s.t -= s.dur; s.ev = 0; } else { s.on = false; continue; } }
      const u = s.t / s.dur, ev = s.def.ev;
      if (ev) while (s.ev < ev.length && ev[s.ev][0] <= u) { this._ev(s, ev[s.ev]); s.ev++; }
      s.def.fn(P, u, s.t, w, p, s.str);
    }
    // Apply: rotate about the racer's middle so rolls and twirls stay in place.
    const a = m.anim, d = m.driverAnim, c = this.centre;
    _q.setFromEuler(_e.set(P.arx, P.ary, P.arz));
    _v.set(0, c * P.asy, 0).applyQuaternion(_q);
    a.quaternion.copy(_q);
    a.position.set(P.aox - _v.x, P.aoy + c * P.asy - _v.y, P.aoz - _v.z);
    a.scale.set(P.asx, P.asy, P.asz);
    if (d) { d.position.set(P.dox, P.doy, P.doz); d.rotation.set(P.drx, P.dry, P.drz); d.scale.set(P.dsx, P.dsy, P.dsz); }
    this._emotes(dt, P);
  }

  _emotes(dt, P) {
    for (const e of this.em) {
      if (!e.on) continue;
      e.t += dt;
      const u = e.t / e.life;
      if (u >= 1) { e.on = false; e.sp.visible = false; continue; }
      if (e.mode === 1) { e.ang += e.w * dt; e.sp.position.set(e.x + Math.cos(e.ang) * 0.62, e.y + P.aoy + Math.sin(e.ang * 2) * 0.05, e.z + Math.sin(e.ang) * 0.5); }
      else if (e.mode === 2) { e.vy -= 3 * dt; e.sp.position.set(e.x + e.vx * e.t, e.y + e.vy * e.t - 0.6 * e.t * e.t, e.z); }
      else e.sp.position.set(e.x + e.vx * e.t, e.y + e.vy * e.t * (1 - 0.4 * u) + P.aoy, e.z);
      const grow = ease(sat(u, 0, 0.18)) * (1 + 0.25 * Math.sin(Math.PI * sat(u, 0, 0.25))), shrink = 1 - ease(sat(u, 0.7, 1));
      e.sp.scale.setScalar(e.size * grow * shrink + 0.0001);
    }
  }

  dispose() {
    for (const e of this.em) { if (e.sp.parent) e.sp.parent.remove(e.sp); }
    this.em.length = 0;
    const m = this.model;
    if (m.anim) { m.anim.position.set(0, 0, 0); m.anim.quaternion.identity(); m.anim.scale.set(1, 1, 1); }
    if (m.driverAnim) { m.driverAnim.position.set(0, 0, 0); m.driverAnim.rotation.set(0, 0, 0); m.driverAnim.scale.set(1, 1, 1); }
  }
}
