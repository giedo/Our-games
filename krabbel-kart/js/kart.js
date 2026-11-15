// One racer: arcade driving physics, drifting, AI driving and the 3D model.
//
// Capabilities other code builds on (see docs/DESIGN.md "Architecture (as built)"):
//   kart.fx           named timers in seconds: addFx(name, s), hasFx(name), clearFx(name). Reserved names with
//                     built-in behaviour: star, tiny, giant, flat, ghost, frozen, auto, slip, slow.
//   kart.hit(opts)    spin, flatten or bump the kart; kart.launch(vy); kart.bump(nx, nz, strength)
//   kart.out          eliminated: no physics, hidden, ranked last (setOut)
//   kart.team, kart.stars, kart.aiGoal, kart.gesture(name)
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, damp, angleDiff } from './util.js';
import { buildRacerModel, disposeRacerModel } from './racerModel.js';
import { itemById } from './items.js';
import { Animator } from './anim.js';

export const DIFFICULTY = {
  easy: { speed: 0.8, ai: 0.9 },
  normal: { speed: 0.93, ai: 0.965 },
  fast: { speed: 1.06, ai: 1.01 },
};
export const BASE_MAX = 31; // metres per second at "normal" top speed
const GRAVITY = 30;
const DRIFT_LEVELS = [1.0, 2.2, 3.6];
const DRIFT_BOOST = [0.7, 1.3, 2.0];
const SPARKS = [0xffffff, 0x4fe9ff, 0xff5cf0, 0xffe14a];
const RAINBOW = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff];

const _loc = {}, _loc2 = {}, _loc3 = {};
const _v = new THREE.Vector3();
const _aiCtx = { kmax: 0, hold: 0, race: null };

export class Kart {
  constructor(race, o) {
    this.race = race;
    this.world = race.world;
    this.track = race.world.track;
    this.name = o.name;
    this.human = !!o.human;
    this.playerIndex = o.playerIndex === undefined ? -1 : o.playerIndex;
    this.skill = o.skill || 1;
    this.speedFactor = 1;
    this.driver = o.driver; this.vehicle = o.vehicle;
    this.model = buildRacerModel(o.driver, o.vehicle);
    this.world.scene.add(this.model.root, this.model.shadow);
    this.anim = new Animator(this.model, { kart: this });
    this.x = 0; this.y = 0; this.z = 0; this.dir = 0;
    this.speed = 0; this.vy = 0; this.grounded = true; this.prevG = 0;
    this.idx = 0; this.s = 0; this.lat = 0; this.progress = 0; this.lap = 0;
    this.boostT = 0; this.boostPower = 1.38; this.spinT = 0; this.spinAngle = 0; this.hitCool = 0;
    this.shieldT = 0; this.padCool = 0;
    this.driftDir = 0; this.driftCharge = 0; this.driftLevel = 0; this.hopT = 0;
    this.item = null; this.rollT = 0; this.rollPick = null; this.itemUses = 0; this.itemT = 0;
    this.fx = {}; this.autoSpeed = 1; this.slowMul = 0.7; this.scaleVis = 1; this.flatVis = 0;
    this.out = false; this.team = null; this.stars = 0; this.aiGoal = null; this.prevPlace = 0; this.overtakeAt = -9;
    this._own = null; // per-kart copies of the materials while a ghost or star look is shown
    this.finished = false; this.finishTime = 0; this.place = 1;
    this.pushX = 0; this.pushZ = 0;
    this.pitch = 0; this.roll = 0; this.yawVis = 0; this.leanVis = 0; this.squash = 0; this.stretch = 0;
    this.offroad = false; this.wrongWayT = 0; this.steerNow = 0;
    this.aiLane = 0; this.aiLaneTarget = 0; this.aiLaneT = 0; this.aiItemT = 0; this.aiHold = 0;
    this.ctl = { steer: 0, gas: 0, brake: 0, drift: false, item: false };
    this.emitAcc = 0;
    // The driver subtly turns towards whoever is looking, so the drawing stays readable.
    const model = this.model, self = this;
    const dm = model.driverMesh;
    if (dm) {
      dm.onBeforeRender = (renderer, scene, camera) => {
        const c = Math.atan2(camera.position.x - self.x, camera.position.z - self.z);
        const phi = angleDiff(c, self.dir + model.body.rotation.y);
        model.pivot.rotation.y = -0.45 * Math.sin(2 * phi);
        model.pivot.updateMatrixWorld(true);
      };
    }
  }

  placeAt(s, lat) {
    const tr = this.track;
    tr.posAt(s, lat, _v);
    this.x = _v.x; this.z = _v.z;
    this.dir = tr.headingAt(s);
    tr.locate(this.x, this.z, -1, _loc);
    this.idx = _loc.i; this.s = _loc.s; this.lat = _loc.lat;
    this.progress = s; // may be negative on the grid, behind the line
    this.y = this.prevG = this.world.groundAt(this.x, this.z, _loc);
    this.speed = 0; this.vy = 0;
    this.updateVisual(0.016, 0);
  }

  groundY(x, z) {
    this.track.locate(x, z, this.idx, _loc2);
    return this.world.groundAt(x, z, _loc2);
  }

  boost(dur, power = 1.38) {
    this.boostT = Math.max(this.boostT, dur);
    this.boostPower = power;
    this.stretch = 1;
    this.gesture('boost');
    const base = BASE_MAX * this.race.params.speed;
    if (this.speed < base * 0.75) this.speed = base * 0.75;
  }

  // ---- effects: named timers ----
  // addFx never shortens a running timer. Names with built-in behaviour:
  //   star (invincible, faster, rainbow, bumping others spins them), tiny (half size, slower),
  //   giant (big, faster, cannot be hit, flattens karts it touches), flat (squashed, half speed),
  //   ghost (see-through, cannot be hit, passes through karts), frozen (no control, slides to a stop),
  //   auto (drives itself at speed x kart.autoSpeed, cannot be hit, ignores the grass),
  //   slip (steering mostly ignored), slow (top speed x kart.slowMul).
  addFx(name, seconds) {
    if (seconds > (this.fx[name] || 0)) this.fx[name] = seconds;
  }

  hasFx(name) { return this.fx[name] > 0; }

  clearFx(name) { delete this.fx[name]; }

  // Cannot be hit at all (not even a shield is used up).
  isImmune() {
    const f = this.fx;
    return !!(f.star || f.giant || f.ghost || f.auto);
  }

  // Multiplier on the top speed from effects and collected stars.
  topMul() {
    const f = this.fx;
    let m = 1;
    if (f.star) m *= 1.18;
    if (f.tiny) m *= 0.72;
    if (f.giant) m *= 1.08;
    if (f.flat) m *= 0.5;
    if (f.slow) m *= this.slowMul;
    if (this.stars > 0) m *= 1 + 0.012 * Math.min(10, this.stars);
    if (f.auto) m *= this.autoSpeed;
    return m;
  }

  // Throw the kart into the air (springs, bouncers, ramps).
  launch(vy) {
    this.vy = vy; this.y += 0.05; this.grounded = false; this.stretch = 1;
  }

  // Push the kart sideways: (nx, nz) is the direction, strength in metres per second.
  bump(nx, nz, strength) {
    this.pushX += nx * strength; this.pushZ += nz * strength;
  }

  // Take the kart out of play (or back in): no physics, hidden, ranked after everyone still racing.
  setOut(on = true) {
    this.out = on;
    this.model.root.visible = !on; this.model.shadow.visible = !on;
    if (on) { this.speed = 0; this.endDrift(false); }
  }

  gesture(name) { this.anim.play(name); }

  // opts: { by: Kart | null, cause: string, soft: bool, flat: bool }. The old hit() call still works.
  // soft: only a bump (lose a little speed, no spin). flat: squash instead of spin.
  // Returns true when the kart really was hit (spun or flattened); then mode.onHit is called.
  hit(opts) {
    const o = opts || {};
    if (this.out || this.hitCool > 0 || this.finished || this.isImmune()) return false;
    const P = this.race.particles;
    if (o.soft) {
      this.hitCool = 0.5; this.speed *= 0.75; this.squash = 1;
      this.race.sfx('bump', this);
      return false;
    }
    if (this.shieldT > 0) {
      this.shieldT = 0; this.hitCool = 0.8;
      P.burst(true, [0x8fe9ff, 0xffffff], 26, this.x, this.y + 1.3, this.z, 9, { size: 0.5, life: 0.6, gravity: 4 });
      this.race.sfx('pop', this);
      return false;
    }
    if (o.flat) {
      this.addFx('flat', 1.5); this.hitCool = 1.5;
      this.speed *= 0.5; this.boostT = 0;
      this.endDrift(false);
      P.burst(false, [0xffe14a, 0xffffff], 14, this.x, this.y + 0.5, this.z, 6, { size: 0.5, life: 0.6, gravity: 8 });
      this.race.sfx('splat', this);
    } else {
      this.spinT = 1.25; this.spinAngle = 0; this.hitCool = 2.4;
      this.speed *= 0.3; this.boostT = 0;
      this.endDrift(false);
      P.burst(false, [0xffe14a, 0xffffff, 0xff8a3c], 22, this.x, this.y + 1.5, this.z, 8, { size: 0.55, life: 0.8, gravity: 14 });
      this.race.sfx('spin', this);
    }
    this.gesture('hit');
    this.race.mode.onHit(this, o.by || null, o.cause || 'hit');
    return true;
  }

  endDrift(withBoost) {
    if (withBoost && this.driftLevel > 0) {
      this.boost(DRIFT_BOOST[this.driftLevel - 1], 1.3);
      this.race.sfx('boost', this);
    }
    this.driftDir = 0; this.driftCharge = 0; this.driftLevel = 0;
  }

  // ---- computer driver ----
  aiControl(dt) {
    const tr = this.track, c = this.ctl;
    if (this.aiGoal) return this._aiGoalControl(dt);
    this.aiLaneT -= dt;
    if (this.aiLaneT <= 0) {
      this.aiLaneTarget = (Math.random() - 0.5) * 2 * (tr.halfWidth - 2.6) * 0.85;
      this.aiLaneT = 2 + Math.random() * 4;
    }
    // Steer around paint puddles.
    for (const p of this.race.items.hazardsAhead(this, 28)) {
      if (Math.abs(p.lat - this.aiLane) < 3) {
        this.aiLaneTarget = clamp(p.lat + (p.lat > 0 ? -5 : 5), -tr.halfWidth + 2, tr.halfWidth - 2);
        this.aiLaneT = 1.5;
      }
    }
    this.aiLane = damp(this.aiLane, this.aiLaneTarget, 1.4, dt);
    const ahead = tr.wrap(this.idx + Math.round(14 / tr.seg));
    const k = tr.curv[ahead];
    const inside = clamp(Math.abs(k) * 22, 0, 0.75);
    const lane = this.aiLane * (1 - inside) + -Math.sign(k) * (tr.halfWidth - 3) * inside;
    const look = 8 + this.speed * 0.55;
    tr.posAt(this.s + look / tr.seg, lane, _v);
    const want = Math.atan2(_v.x - this.x, _v.z - this.z);
    const err = angleDiff(this.dir, want);
    c.steer = clamp(-err * 3, -1, 1);
    const kmax = tr.maxCurvAhead(this.idx, 10 + this.speed * 0.9);
    const vCorner = 2.4 / (1.1 * kmax + 1.15 / BASE_MAX);
    c.gas = 1; c.brake = 0;
    if (this.speed > vCorner + 1) { c.gas = 0; if (this.speed > vCorner + 5) c.brake = 0.7; }
    c.drift = false;
    this._aiItem(c, dt, kmax);
    return c;
  }

  // Computer racers decide when to use their item: the item definition says when it suits it.
  _aiItem(c, dt, kmax) {
    c.item = false;
    if (this.item && this.rollT <= 0) {
      this.aiItemT -= dt; this.aiHold += dt;
      if (this.aiItemT <= 0) {
        const d = itemById(this.item);
        _aiCtx.kmax = kmax; _aiCtx.hold = this.aiHold; _aiCtx.race = this.race;
        if (!d || d.aiWants(this, _aiCtx)) { c.item = true; this.aiHold = 0; }
      }
    }
  }

  // Free driving towards kart.aiGoal = { x, z } (set by mode.aiGoal). The goal is kept on the road band,
  // and when it is far along the loop the kart follows the road the shorter way round, in either direction.
  _aiGoalControl(dt) {
    const tr = this.track, c = this.ctl, g = this.aiGoal, hw = tr.halfWidth;
    tr.locate(g.x, g.z, -1, _loc3);
    let ds = _loc3.s - this.s;
    if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
    const look = (8 + this.speed * 0.55) / tr.seg;
    let tx = g.x, tz = g.z;
    if (Math.abs(ds) > look) {
      tr.posAt(this.s + Math.sign(ds) * look, clamp(_loc3.lat, -(hw - 2.5), hw - 2.5), _v);
      tx = _v.x; tz = _v.z;
    } else if (Math.abs(_loc3.lat) > hw + 3) {
      tr.posAt(_loc3.s, Math.sign(_loc3.lat) * (hw + 3), _v);
      tx = _v.x; tz = _v.z;
    }
    const err = angleDiff(this.dir, Math.atan2(tx - this.x, tz - this.z));
    c.steer = clamp(-err * 3, -1, 1);
    // Slow down for bends, looking the way the kart is actually heading.
    const way = Math.abs(angleDiff(this.dir, tr.heading[this.idx])) < Math.PI / 2 ? 1 : -1;
    const kmax = tr.maxCurvAhead(this.idx, 10 + this.speed * 0.9, way);
    const vCorner = 2.4 / (1.1 * kmax + 1.15 / BASE_MAX);
    c.gas = Math.abs(err) > 1.2 ? 0.6 : 1; c.brake = 0;
    if (this.speed > vCorner + 1) { c.gas = 0; if (this.speed > vCorner + 5) c.brake = 0.7; }
    c.drift = false;
    this._aiItem(c, dt, kmax);
    return c;
  }

  // ---- physics ----
  update(dt, ctl) {
    const tr = this.track, w = this.world, race = this.race, P = race.params;
    for (const n in this.fx) { this.fx[n] -= dt; if (this.fx[n] <= 0) delete this.fx[n]; }
    if (this.out) return;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.padCool > 0) this.padCool -= dt;
    if (this.hitCool > 0) this.hitCool -= dt;
    let steer = ctl.steer, gas = ctl.gas, brake = ctl.brake, wantDrift = ctl.drift;
    const spinning = this.spinT > 0, frozen = this.fx.frozen > 0;
    if (spinning) this.spinT -= dt;
    if (spinning || frozen) { steer = 0; gas = 0; brake = 0; wantDrift = false; }
    if (race.state === 'intro' || race.state === 'countdown') { gas = 0; brake = 0; steer = 0; wantDrift = false; }

    // Optional steering help keeps small racers pointing down the road.
    if (this.human && !this.finished && race.assist && !spinning) {
      const hd = tr.headingAt(this.s + 6 / tr.seg);
      const e = angleDiff(this.dir, hd);
      const help = clamp(-e * 1.6 - (this.lat / tr.halfWidth) * 0.55, -0.8, 0.8);
      steer = clamp(steer + help * (Math.abs(ctl.steer) > 0.3 ? 0.45 : 1), -1, 1);
    }
    if (this.fx.slip) steer *= 0.3;
    this.steerNow = steer;

    const base = BASE_MAX * P.speed * this.speedFactor * this.topMul();
    const boosting = this.boostT > 0;
    const grass = this.offroad && !this.fx.auto; // the auto driver ignores the slow-down
    let vmax = base;
    if (boosting) vmax *= this.boostPower; else if (grass) vmax *= 0.5;
    if (spinning || frozen) {
      this.speed = damp(this.speed, 0, spinning ? 1.8 : 1.2, dt);
    } else {
      if (gas > 0 && this.speed < vmax) this.speed += (15 * (1 - this.speed / vmax) + 3) * gas * dt * (boosting ? 2.6 : 1);
      if (brake > 0) {
        if (this.speed > 0.5) this.speed -= 32 * brake * dt;
        else this.speed = Math.max(this.speed - 10 * dt, -8);
      }
      if (!gas && !brake) this.speed -= this.speed * 0.7 * dt;
      if (this.speed > vmax) this.speed = damp(this.speed, vmax, grass && !boosting ? 3.5 : 1.6, dt);
    }

    // Drifting: hold the button in a corner, sparks change colour, let go for a boost.
    const fast = this.speed > base * 0.45;
    if (wantDrift && !this.driftDir && fast && this.grounded && Math.abs(steer) > 0.35) {
      this.driftDir = Math.sign(steer); this.driftCharge = 0; this.driftLevel = 0; this.hopT = 0.26;
      race.sfx('hop', this);
    }
    if (this.driftDir) {
      if (!wantDrift) this.endDrift(true);
      else if (!fast) this.endDrift(false);
    }
    const sf = clamp(Math.abs(this.speed) / 5, 0, 1) * (this.speed < 0 ? -1 : 1);
    const tRate = lerp(2.4, 1.25, clamp(this.speed / BASE_MAX, 0, 1));
    let turn;
    if (this.driftDir) {
      const st = steer * this.driftDir;
      turn = this.driftDir * tRate * (1.05 + 0.75 * st);
      this.driftCharge += dt * (0.55 + 0.7 * Math.max(0, st + 0.3));
      const lvl = this.driftCharge >= DRIFT_LEVELS[2] ? 3 : this.driftCharge >= DRIFT_LEVELS[1] ? 2 : this.driftCharge >= DRIFT_LEVELS[0] ? 1 : 0;
      if (lvl > this.driftLevel) { this.driftLevel = lvl; race.sfx('charge', this); }
    } else {
      turn = steer * tRate * sf;
    }
    if (!this.grounded) turn *= 0.5;
    this.dir -= turn * dt;

    const fx = Math.sin(this.dir), fz = Math.cos(this.dir);
    this.x += (fx * this.speed + this.pushX) * dt;
    this.z += (fz * this.speed + this.pushZ) * dt;
    this.pushX = damp(this.pushX, 0, 5, dt); this.pushZ = damp(this.pushZ, 0, 5, dt);

    // Where are we on the track?
    tr.locate(this.x, this.z, this.idx, _loc);
    let ds = _loc.s - this.s;
    if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
    this.progress += ds;
    this.s = _loc.s; this.idx = _loc.i; this.lat = _loc.lat;
    const lim = this.human && race.assist && !this.finished ? tr.halfWidth - 0.4 : tr.limit;
    if (Math.abs(this.lat) > lim) {
      const over = Math.abs(this.lat) - lim, sg = Math.sign(this.lat);
      this.x -= tr.rx[this.idx] * over * sg; this.z -= tr.rz[this.idx] * over * sg;
      this.lat = lim * sg; _loc.lat = this.lat;
      const diff = angleDiff(this.dir, tr.heading[this.idx]);
      if (Math.abs(diff) < Math.PI / 2) this.dir += diff * Math.min(1, 4 * dt);
      this.speed *= 1 - 0.6 * dt;
    }
    this.offroad = Math.abs(this.lat) > tr.halfWidth + tr.curb + 0.3;

    // Boost pads.
    if (this.padCool <= 0 && this.grounded) {
      for (const pad of w.boostPads) {
        let d = this.s - pad.s;
        if (d < -tr.n / 2) d += tr.n; else if (d > tr.n / 2) d -= tr.n;
        if (Math.abs(d) < pad.halfL && Math.abs(this.lat - pad.lat) < pad.halfW) {
          this.boost(1.15, 1.36); this.padCool = 1;
          race.sfx('boost', this);
          break;
        }
      }
    }

    // Height: follow the ground, but fly over crests when going fast.
    const g = w.groundAt(this.x, this.z, _loc);
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= g) {
      if (!this.grounded && this.vy < -8) {
        this.squash = 1;
        race.particles.burst(false, [w.dustColor], 8, this.x, g + 0.2, this.z, 4, { size: 0.6, size1: 1.4, life: 0.5, gravity: 2, a: 0.5 });
        race.sfx('land', this);
      }
      this.y = g;
      this.vy = clamp((g - this.prevG) / dt, -20, 12);
      this.grounded = true;
    } else {
      this.grounded = this.y - g < 0.12;
    }
    this.prevG = g;

    // Lean with the slope of the ground.
    const rxv = -fz, rzv = fx;
    const hf = this.groundY(this.x + fx * 1.2, this.z + fz * 1.2), hb = this.groundY(this.x - fx * 1.2, this.z - fz * 1.2);
    const hl = this.groundY(this.x - rxv * 0.8, this.z - rzv * 0.8), hr = this.groundY(this.x + rxv * 0.8, this.z + rzv * 0.8);
    let pitchT = Math.atan2(hf - hb, 2.4);
    const rollT = Math.atan2(hl - hr, 1.6);
    if (!this.grounded) pitchT = clamp(this.vy * 0.02, -0.35, 0.3);
    this.pitch = damp(this.pitch, pitchT, 10, dt);
    this.roll = damp(this.roll, rollT, 10, dt);

    // Laps.
    const lapNow = Math.floor(this.progress / tr.n);
    if (lapNow > this.lap) {
      this.lap = lapNow;
      if (!this.finished && this.lap >= race.laps) {
        this.finished = true; this.finishTime = race.time;
        this.endDrift(false);
        race.onFinish(this);
      } else if (!this.finished) race.onLap(this);
    }
    if (this.human) {
      const off = Math.abs(angleDiff(this.dir, tr.heading[this.idx]));
      this.wrongWayT = off > 2.0 && this.speed > 3 ? this.wrongWayT + dt : 0;
    }

    this.emitParticles(dt, fx, fz);
    this.updateVisual(dt, race.time);
  }

  emitParticles(dt, fx, fz) {
    const P = this.race.particles, w = this.world;
    this.emitAcc += dt;
    if (this.emitAcc < 1 / 45) return;
    this.emitAcc = 0;
    const bx = this.x - fx * 1.3, bz = this.z - fz * 1.3, by = this.y + 0.25;
    const rx = -fz, rz = fx;
    if (this.fx.star > 0) {
      P.emit(true, RAINBOW[Math.floor(Math.random() * RAINBOW.length)], {
        x: this.x + (Math.random() - 0.5) * 1.6, y: this.y + 0.4 + Math.random() * 1.6, z: this.z + (Math.random() - 0.5) * 1.6,
        vy: 1 + Math.random() * 2, life: 0.45, size: 0.5, size1: 0.05, a: 0.9,
      });
    }
    if (this.boostT > 0) {
      for (let i = 0; i < 2; i++) {
        P.emit(true, i ? 0xffd24a : 0xff7a1f, {
          x: bx + (Math.random() - 0.5) * 0.6, y: by + 0.3 + Math.random() * 0.3, z: bz + (Math.random() - 0.5) * 0.6,
          vx: -fx * 6 + (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: -fz * 6 + (Math.random() - 0.5) * 2,
          life: 0.3, size: 0.8, size1: 0.1, a: 0.8,
        });
      }
    }
    if (this.driftDir && this.grounded) {
      const lvl = this.driftLevel;
      const side = -this.driftDir;
      for (let i = 0; i < (lvl ? 2 : 1); i++) {
        const hex = lvl === 3 ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : SPARKS[lvl];
        P.emit(lvl > 0, hex, {
          x: bx + rx * side * 0.7, y: by, z: bz + rz * side * 0.7,
          vx: -fx * 3 + rx * side * 3 + (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, vz: -fz * 3 + rz * side * 3 + (Math.random() - 0.5) * 3,
          life: lvl ? 0.4 : 0.35, size: lvl ? 0.42 : 0.5, size1: lvl ? 0.05 : 1.1, gravity: lvl ? 14 : 0, a: lvl ? 1 : 0.35,
        });
      }
    } else if (this.offroad && this.grounded && Math.abs(this.speed) > 6) {
      P.emit(false, w.dustColor, {
        x: bx + (Math.random() - 0.5), y: by, z: bz + (Math.random() - 0.5),
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2,
        life: 0.55, size: 0.6, size1: 1.7, a: 0.45, drag: 1,
      });
    }
  }

  updateVisual(dt, time) {
    const m = this.model;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.dir;
    m.tilt.rotation.x = -this.pitch;
    m.tilt.rotation.z = this.roll;
    const speedFrac = clamp(Math.abs(this.speed) / BASE_MAX, 0, 1.4);
    this.yawVis = damp(this.yawVis, -this.driftDir * 0.5, 9, dt);
    if (this.spinT > 0) this.spinAngle += dt * (6 + this.spinT * 12);
    else if (this.spinAngle) this.spinAngle = 0;
    m.body.rotation.y = this.yawVis + this.spinAngle;
    this.leanVis = damp(this.leanVis, this.steerNow * 0.1 * speedFrac + this.driftDir * 0.1, 8, dt);
    m.body.rotation.z = this.leanVis;
    let by = 0;
    if (this.hopT > 0) { this.hopT -= dt; by = Math.sin(clamp(this.hopT / 0.26, 0, 1) * Math.PI) * 0.4; }
    if (this.offroad && this.grounded) by += Math.sin(time * 43) * 0.035 * speedFrac;
    by += Math.sin(time * 31 + this.playerIndex) * 0.012 * speedFrac;
    m.body.position.y = by;
    this.squash = damp(this.squash, 0, 7, dt);
    this.stretch = damp(this.stretch, 0, 4, dt);
    const f = this.fx;
    this.scaleVis = damp(this.scaleVis, f.tiny ? 0.5 : f.giant ? 1.7 : 1, 9, dt);
    this.flatVis = damp(this.flatVis, f.flat ? 1 : 0, 12, dt);
    m.root.scale.setScalar(this.scaleVis);
    const sy = (1 - this.squash * 0.28 + this.stretch * 0.06) * (1 - this.flatVis * 0.78), wide = 1 + this.flatVis * 0.3;
    m.body.scale.set((1 + this.squash * 0.16 - this.stretch * 0.05) * wide, sy, (1 + this.squash * 0.1 + this.stretch * 0.12) * wide);
    m.pivot.rotation.z = this.leanVis * 1.6;
    m.pivot.rotation.x = -this.stretch * 0.22 + Math.sin(time * 9 + this.playerIndex * 2) * 0.02 * speedFrac;
    const sh = m.shield;
    sh.visible = this.shieldT > 0;
    if (sh.visible) {
      const pulse = 1 + Math.sin(time * 6) * 0.04;
      sh.scale.set(1.9 * pulse, 1.7 * pulse, 2.2 * pulse);
      sh.rotation.y = time * 0.8;
      sh.material.uniforms.uOpacity.value = this.shieldT < 2 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 12)) : 1;
    }
    const sd = m.shadow, air = clamp(this.y - this.prevG, 0, 6);
    sd.position.set(this.x, this.prevG + 0.06, this.z);
    sd.rotation.set(-this.pitch, this.dir, this.roll, 'YXZ');
    const k = 1 - air * 0.1, sv = this.scaleVis;
    sd.scale.set(2.6 * k * sv, 1, (m.len + 1.2) * k * sv);
    sd.material.opacity = 0.4 * k;
    this._look(time);
    this.anim.update(dt, time, this);
  }

  // See-through ghost and rainbow star: both need materials of their own, because the
  // drawings' materials are shared between karts. Copies are made on demand and given back after.
  _look(time) {
    const f = this.fx, want = f.ghost > 0 || f.star > 0;
    if (want && !this._own) this._takeMats();
    else if (!want && this._own) this._giveMats();
    const own = this._own;
    if (!own) return;
    const ghost = f.ghost > 0;
    if (own.ghost !== ghost) {
      own.ghost = ghost;
      for (const m of own.mats) { m.transparent = ghost; m.opacity = ghost ? 0.38 : 1; m.depthWrite = !ghost; m.needsUpdate = true; }
    }
    if (f.star > 0) {
      for (const m of own.mats) { m.emissive.setHSL((time * 1.6) % 1, 1, 0.5); m.emissiveIntensity = m.emissiveMap ? 0.75 : 0.45; }
    }
  }

  _takeMats() {
    const m = this.model, vm = m.vehicleMesh, dm = m.driverMesh, mats = [];
    const own = this._own = { vm, dm, vmOrig: vm && vm.material, dmOrig: dm && dm.material, mats, ghost: false };
    if (vm) { vm.material = own.vmOrig.map((x) => x.clone()); mats.push(...vm.material); }
    if (dm) { dm.material = own.dmOrig.clone(); mats.push(dm.material); }
  }

  _giveMats() {
    const own = this._own;
    if (own.vm) own.vm.material = own.vmOrig;
    if (own.dm) own.dm.material = own.dmOrig;
    for (const m of own.mats) m.dispose();
    this._own = null;
  }

  dispose() {
    if (this._own) this._giveMats();
    this.anim.dispose();
    this.world.scene.remove(this.model.root, this.model.shadow);
    disposeRacerModel(this.model);
  }
}
