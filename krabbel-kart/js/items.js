// Item boxes, the item registry and the generic machinery that items run on.
//
// An item is a definition object passed to registerItem(). The four built-in items are
// registered at the bottom of this file; new ones live in js/items/<name>.js and are
// switched on in js/items/index.js (see docs/DESIGN.md "Architecture (as built)").
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvas, canvasTexture, TAU, mulberry32 } from './util.js';

const PUDDLE_COLORS = [0xff3fa4, 0x3fd0ff, 0xffd21f, 0x7be04a, 0xb46bff];

// ---------- registry ----------

export const ITEM_DEFS = [];

// def: {
//   id, icon (inline svg string), ages: ['little', 'big'] (default both),
//   weight(kart, f, race) -> number   chance in the item box: f is 0 for the leader up to 1 for the last kart,
//   use(sys, kart) -> void | false    start the effect (return false to keep the item, e.g. nothing to aim at),
//   aiWants(kart, ctx) -> bool        should a computer racer use it now? ctx = { kmax, hold, race } (default true),
//   uses: 1                           how many presses before the item is gone (multi-use items),
//   held: 0                           seconds the item stays usable after the first press (unlimited presses),
// }
export function registerItem(def) {
  if (!def || !def.id || typeof def.use !== 'function') throw new Error('registerItem needs { id, use }');
  const d = Object.assign({ icon: '', ages: ['little', 'big'], weight: () => 1, aiWants: () => true, uses: 1, held: 0 }, def);
  const i = ITEM_DEFS.findIndex((x) => x.id === d.id);
  if (i >= 0) ITEM_DEFS[i] = d; else ITEM_DEFS.push(d);
  return d;
}

export function itemById(id) {
  for (const d of ITEM_DEFS) if (d.id === id) return d;
  return null;
}

function boxTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const cols = ['#ff4b4b', '#ffa53c', '#ffe14a', '#5fe06a', '#4fb8ff', '#b46bff'];
  cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (i * 128) / 6, 128, 128 / 6 + 1); });
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  // A chunky star in the middle.
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 20 : 46;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = '#ffffff'; g.fill();
  g.strokeStyle = '#2a2433'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
  return canvasTexture(c);
}

export class ItemSystem {
  constructor(race) {
    this.race = race;
    this.world = race.world;
    const w = this.world, scene = w.scene;
    this.clock = 0; // race clock, updated every step
    this.boxesEnabled = true; // modes can switch the item boxes off
    this.things = []; // live projectiles and hazards, see add()
    this._res = new Map();
    this._hazards = [];
    this.tex = boxTexture();
    this.boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    this.boxMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.94 });
    this.boxes = w.itemSpots.map((sp, i) => ({ s: sp.s, lat: sp.lat, x: sp.pos.x, y: sp.pos.y + 1.25, z: sp.pos.z, t: 0, ph: i * 0.7 }));
    this.boxMesh = new THREE.InstancedMesh(this.boxGeo, this.boxMat, Math.max(1, this.boxes.length));
    this.boxMesh.frustumCulled = false;
    this.boxMesh.renderOrder = 2;
    scene.add(this.boxMesh);
    this.dummy = new THREE.Object3D();
  }

  // ----- choosing items -----

  // Item definitions this kart may get: allowed by the age setting and by the mode's item pool.
  pool(kart) {
    const race = this.race, allowed = race.mode.itemPool(kart);
    return ITEM_DEFS.filter((d) => d.ages.indexOf(race.age) >= 0 && (!allowed || allowed.indexOf(d.id) >= 0));
  }

  // Weighted random item id: leaders get defensive items, stragglers get catch-up items. null when nothing is allowed.
  pick(kart) {
    const race = this.race, defs = this.pool(kart);
    if (!defs.length) return null;
    const n = race.karts.length;
    const f = n > 1 ? (kart.place - 1) / (n - 1) : 0;
    const wts = defs.map((d) => Math.max(0, d.weight(kart, f, race)));
    let tot = 0;
    for (const x of wts) tot += x;
    if (tot <= 0) return defs[0].id;
    let r = Math.random() * tot;
    for (let i = 0; i < defs.length; i++) { r -= wts[i]; if (r <= 0) return defs[i].id; }
    return defs[0].id;
  }

  // Put an item in a kart's slot right away (no roulette). Modes and items use this.
  give(kart, id) {
    const d = itemById(id);
    if (!d) return;
    kart.item = id; kart.itemUses = d.uses; kart.itemT = 0;
    kart.rollT = 0; kart.rollPick = null;
    kart.aiItemT = 0.6 + Math.random() * 2.5; kart.aiHold = 0;
    this.race.sfx('itemReady', kart);
  }

  // The player (or computer racer) pressed the item button.
  use(kart) {
    if (!kart.item || kart.rollT > 0 || kart.out) return;
    const d = itemById(kart.item);
    if (!d) { kart.item = null; return; }
    const was = { item: kart.item, uses: kart.itemUses, t: kart.itemT };
    // Use up first, so use() may hand the kart a new item; undo when it declines.
    if (d.held) { if (!(kart.itemT > 0)) kart.itemT = d.held; }
    else if (--kart.itemUses <= 0) kart.item = null;
    if (d.use(this, kart) === false) { kart.item = was.item; kart.itemUses = was.uses; kart.itemT = was.t; return; }
    if (kart.item) kart.aiItemT = 0.5 + Math.random() * 1.5; // still holding something: computer racers wait a moment
    kart.gesture('throw');
  }

  // ----- machinery for items -----

  // A "thing" is a projectile or hazard in the world: an object with
  //   update(dt, sys) -> false when it is finished      (called every step)
  //   dispose()                                         (called once when it is removed)
  // and optionally kind (a string, see ofKind), and for stationary hazards computer racers should
  // steer around: hazard = true plus s and lat (track position, see hazardsAhead).
  add(thing) {
    this.things.push(thing);
    return thing;
  }

  remove(thing) {
    const i = this.things.indexOf(thing);
    if (i < 0) return;
    this.things.splice(i, 1);
    if (thing.dispose) thing.dispose();
  }

  ofKind(kind) {
    return this.things.filter((th) => th.kind === kind);
  }

  // Hazards (things with hazard = true) in the next `metres` of road in front of a kart.
  // The returned array is reused: do not keep it.
  hazardsAhead(kart, metres = 28) {
    const tr = this.world.track, out = this._hazards;
    out.length = 0;
    for (const th of this.things) {
      if (!th.hazard) continue;
      let ds = th.s - kart.s;
      if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
      if (ds > 0 && ds < metres / tr.seg) out.push(th);
    }
    return out;
  }

  // Hit every kart within `radius` (flat distance) of a point. `owner` is skipped.
  // Karts that are out or immune (ghost, star, giant, auto) are ignored. Returns the karts it touched.
  // opts: cause (string for mode.onHit), soft (bump only), flat (flatten instead of spin), first (stop at
  // the first kart), skipCool (ignore karts that were hit a moment ago), finished (also touch karts that
  // already finished), ky and dy (a kart counts when |kart.y + ky - y| < dy; defaults 1 and 3).
  hitKartsNear(x, y, z, radius, owner, opts) {
    const o = opts || {}, r2 = radius * radius, ky = o.ky === undefined ? 1 : o.ky, dy = o.dy === undefined ? 3 : o.dy;
    const hit = [];
    for (const k of this.race.karts) {
      if (k === owner || k.out || (k.finished && !o.finished) || k.isImmune()) continue;
      if (o.skipCool && k.hitCool > 0) continue;
      const dx = k.x - x, dz = k.z - z;
      if (dx * dx + dz * dz >= r2 || Math.abs(k.y + ky - y) >= dy) continue;
      k.hit({ by: owner, cause: o.cause, soft: o.soft, flat: o.flat });
      hit.push(k);
      if (o.first) break;
    }
    return hit;
  }

  // A mesh in the scene. Remove it with removeMesh (or scene.remove) when done.
  spawnMesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.world.scene.add(m);
    return m;
  }

  removeMesh(m) {
    this.world.scene.remove(m);
  }

  // Shared resource (geometry, material, texture...) made on first use and disposed with the race.
  res(key, make) {
    if (!this._res.has(key)) this._res.set(key, make());
    return this._res.get(key);
  }

  // ----- the loop -----

  update(dt, time) {
    const race = this.race, karts = race.karts, P = race.particles;
    const d = this.dummy;
    this.clock = time;
    // Boxes.
    this.boxMesh.visible = this.boxesEnabled;
    this.boxes.forEach((b, i) => {
      if (b.t > 0) {
        b.t -= dt;
        d.scale.setScalar(b.t <= 0.3 ? Math.max(0.001, 1 - b.t / 0.3) : 0.001);
      } else d.scale.setScalar(1);
      d.position.set(b.x, b.y + Math.sin(time * 2 + b.ph) * 0.25, b.z);
      d.rotation.set(time * 0.9 + b.ph, time * 1.3 + b.ph, 0);
      d.updateMatrix();
      this.boxMesh.setMatrixAt(i, d.matrix);
    });
    this.boxMesh.instanceMatrix.needsUpdate = true;
    for (const k of karts) {
      // Roulette.
      if (k.rollT > 0) {
        k.rollT -= dt;
        if (k.rollT <= 0) {
          if (k.rollPick) this.give(k, k.rollPick);
          k.rollPick = null;
        }
      }
      // Held items run out after a while.
      if (k.itemT > 0) {
        k.itemT -= dt;
        if (k.itemT <= 0) { k.itemT = 0; k.item = null; }
      }
      if (k.item || k.rollT > 0 || k.finished || k.out || !this.boxesEnabled) continue;
      for (const b of this.boxes) {
        if (b.t > 0) continue;
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz < 4.4 && Math.abs(k.y + 1 - b.y) < 2.6) {
          const pick = this.pick(k);
          if (!pick) break;
          b.t = 3.2;
          k.rollT = 1.5; k.rollPick = pick;
          P.burst(true, [0xffe14a, 0xff5cf0, 0x4fe9ff, 0xffffff], 18, b.x, b.y, b.z, 7, { size: 0.5, life: 0.5, gravity: 6 });
          race.sfx('pickup', k);
          break;
        }
      }
    }
    // Things in the world.
    for (let i = this.things.length - 1; i >= 0; i--) {
      const th = this.things[i];
      if (th.update(dt, this) === false) {
        this.things.splice(i, 1);
        if (th.dispose) th.dispose();
      }
    }
  }

  dispose() {
    const scene = this.world.scene;
    scene.remove(this.boxMesh);
    this.boxGeo.dispose(); this.boxMat.dispose(); this.tex.dispose();
    for (const th of this.things) if (th.dispose) th.dispose();
    this.things.length = 0;
    for (const v of this._res.values()) {
      for (const r of Array.isArray(v) ? v : [v]) if (r && r.dispose) r.dispose();
    }
    this._res.clear();
  }
}

// ---------- the four built-in items ----------

// Turbo crayon: a short boost.
registerItem({
  id: 'turbo',
  icon: '<svg viewBox="0 0 64 64"><path d="M6 36c6-8 12-4 16-2l-4 10c-4 0-9 0-12-8z" fill="#ff7a1f"/><path d="M12 37c3-3 6-2 8-1l-2 5c-2 0-4 0-6-4z" fill="#ffe14a"/><path d="M20 26l24-10 10 4-6 9-24 12z" fill="#ffd21f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M44 16l10 4 6-8-11-3z" fill="#f2c79a" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M55 9l5 3" stroke="#2a2433" stroke-width="5" stroke-linecap="round"/><path d="M20 26l4 15" stroke="#2a2433" stroke-width="3"/><path d="M16 28l6-3 4 16-6 3z" fill="#ff8fb0" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/></svg>',
  weight: (k, f) => 2 + 3 * f,
  use(sys, kart) {
    kart.boost(1.9, 1.42);
    sys.race.sfx('boost', kart);
  },
  aiWants: (k, ctx) => ctx.kmax < 0.012 || ctx.hold > 6,
});

// Paint puddle: dropped behind the kart, spins whoever drives in. Computer racers steer around it.
registerItem({
  id: 'puddle',
  icon: '<svg viewBox="0 0 64 64"><path d="M10 40c-6-8 2-16 10-14 2-10 16-12 20-3 8-4 18 2 14 11 8 4 4 15-6 14-4 8-16 8-20 2-8 4-18-2-18-10z" fill="#ff3fa4" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><ellipse cx="26" cy="32" rx="6" ry="3" fill="#ffffff" opacity=".6"/><circle cx="54" cy="16" r="4" fill="#ff3fa4" stroke="#2a2433" stroke-width="2.5"/><circle cx="8" cy="20" r="3" fill="#ff3fa4" stroke="#2a2433" stroke-width="2.5"/></svg>',
  weight: (k, f) => Math.max(0.8, 3 - 2.4 * f),
  use(sys, kart) {
    const tr = sys.world.track;
    const fx = Math.sin(kart.dir), fz = Math.cos(kart.dir);
    const x = kart.x - fx * 3.4, z = kart.z - fz * 3.4;
    const loc = tr.locate(x, z, kart.idx, {});
    const color = PUDDLE_COLORS[Math.floor(Math.random() * PUDDLE_COLORS.length)];
    const mesh = sys.spawnMesh(sys.res('puddleGeo', puddleGeometry), new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), x, sys.world.groundAt(x, z, loc) + 0.04, z);
    mesh.rotation.y = Math.random() * TAU;
    mesh.scale.setScalar(0.1);
    sys.add(new Puddle(mesh, color, kart, loc));
    const all = sys.ofKind('puddle');
    if (all.length > 14) sys.remove(all[0]);
    sys.race.sfx('splat', kart);
  },
  aiWants: (k, ctx) => ctx.race.someoneBehind(k, 16) || ctx.hold > 7,
});

// Paper plane: flies along the road and homes in on the kart ahead.
registerItem({
  id: 'plane',
  icon: '<svg viewBox="0 0 64 64"><path d="M4 30l56-20-18 44-12-16z" fill="#ffffff" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M60 10L30 38l-2 14 8-8" fill="#d6e6f5" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M4 30l26 8" stroke="#2a2433" stroke-width="3"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0.25 : 1 + 3 * f),
  use(sys, kart) {
    sys.add(new Plane(sys, kart));
    sys.race.sfx('throw', kart);
  },
  aiWants: (k, ctx) => k.place > 1 || ctx.hold > 8,
});

// Bubble shield: blocks one hit.
registerItem({
  id: 'shield',
  icon: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#9fe9ff" stroke="#2a2433" stroke-width="3"/><circle cx="32" cy="32" r="24" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="20 131" stroke-linecap="round" transform="rotate(-150 32 32) scale(.78) translate(9 9)"/><circle cx="23" cy="22" r="4" fill="#ffffff"/></svg>',
  weight: () => 1.8,
  use(sys, kart) {
    kart.shieldT = 12;
    sys.race.sfx('shield', kart);
  },
});

function puddleGeometry() {
  const rnd = mulberry32(99);
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, r = 1.9 + (rnd() - 0.5) * 1.1;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(new THREE.SplineCurve(pts.concat(pts[0])).getPoints(40)));
  g.rotateX(-Math.PI / 2);
  return g;
}

class Puddle {
  constructor(mesh, color, owner, loc) {
    this.kind = 'puddle'; this.hazard = true;
    this.mesh = mesh; this.color = color; this.owner = owner;
    this.x = mesh.position.x; this.y = mesh.position.y; this.z = mesh.position.z;
    this.s = loc.s; this.lat = loc.lat;
    this.life = 45; this.age = 0;
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    this.mesh.scale.setScalar(Math.min(1, this.age * 4) * (this.life < 1 ? Math.max(0.01, this.life) : 1));
    if (this.life <= 0) return false;
    // The kart that dropped it is safe for a moment.
    const hit = sys.hitKartsNear(this.x, this.y, this.z, Math.sqrt(5.3), this.age < 1.2 ? this.owner : null, { cause: 'puddle', ky: 0, dy: 1, skipCool: true, first: true, finished: true });
    if (!hit.length) return true;
    sys.race.particles.burst(false, [this.color], 26, this.x, this.y + 0.3, this.z, 8, { size: 0.6, life: 0.7, gravity: 16 });
    sys.race.sfx('splat', hit[0]);
    return false;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.material.dispose();
  }
}

function planeGeometry() {
  // A folded paper plane pointing along +Z.
  const v = [
    0, 0, 1.3, -0.9, 0.12, -0.8, 0, 0.05, -0.8,
    0, 0, 1.3, 0, 0.05, -0.8, 0.9, 0.12, -0.8,
    0, 0, 1.3, 0, 0.05, -0.8, 0, -0.42, -0.7,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

class Plane {
  constructor(sys, kart) {
    const tr = sys.world.track;
    this.kind = 'plane';
    this.mesh = sys.spawnMesh(sys.res('planeGeo', planeGeometry), sys.res('planeMat', () => new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x777777 })));
    this.mesh.scale.setScalar(1.3);
    this.s = kart.s + 3 / tr.seg; this.lat = kart.lat;
    this.owner = kart; this.target = sys.race.kartAhead(kart);
    this.life = 7;
    this.pos = new THREE.Vector3(kart.x, kart.y + 1.4, kart.z);
    this.prev = new THREE.Vector3();
    this.wob = Math.random() * 6;
  }

  update(dt, sys) {
    const tr = sys.world.track, time = sys.clock, pos = this.pos, prev = this.prev, P = sys.race.particles;
    this.life -= dt;
    const t = this.target;
    if (t && !t.finished && !t.out) {
      let ds = t.s - this.s;
      if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
      this.lat += (t.lat - this.lat) * Math.min(1, dt * (ds < 20 / tr.seg ? 9 : 2.5));
    }
    this.s += (58 * dt) / tr.seg;
    prev.copy(pos);
    tr.posAt(this.s, this.lat, pos);
    pos.y += 1.4 + Math.sin(time * 9 + this.wob) * 0.25;
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(0, Math.atan2(pos.x - prev.x, pos.z - prev.z), Math.sin(time * 7 + this.wob) * 0.35, 'YXZ');
    P.emit(false, 0xffffff, { x: prev.x, y: prev.y, z: prev.z, life: 0.35, size: 0.35, size1: 0.05, a: 0.7 });
    if (sys.hitKartsNear(pos.x, pos.y, pos.z, Math.sqrt(6.5), this.owner, { cause: 'plane', first: true }).length) {
      P.burst(false, [0xffffff, 0xd6e6f5], 16, pos.x, pos.y, pos.z, 6, { size: 0.5, life: 0.6, gravity: 6 });
      return false;
    }
    return this.life > 0;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
