// A single race: grid, countdown, laps, positions, cameras and the finish.
import * as THREE from '../vendor/three.module.min.js';
import { Kart, DIFFICULTY, BASE_MAX } from './kart.js';
import { ItemSystem } from './items.js';
import { ObstacleSystem } from './obstacles.js';
import { Particles } from './particles.js';
import { Hud } from './hud.js';
import { modeById } from './modes/index.js';
import { ageOf } from './age.js';
import { t } from './i18n.js';
import { clamp, lerp, damp, angleDiff } from './util.js';

const INTRO = 4.6;

class ChaseCam {
  constructor(kart, world) {
    this.kart = kart; this.world = world;
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.3, 4000);
    this.dir = kart.dir; this.y = kart.y + 3.3; this.fov = 62; this.orbit = 0; this.shake = 0;
    this.look = new THREE.Vector3();
  }

  update(dt, race) {
    const k = this.kart, cam = this.cam, p = cam.position;
    const T = k.out ? race.mode.spectate(k) || k : k; // an out kart watches the kart its mode names
    if (race.state === 'intro') {
      const u = clamp(race.stateT / INTRO, 0, 1), e = 1 - Math.pow(1 - u, 3);
      const ang = k.dir + Math.PI + (1 - e) * 2.7;
      const dist = lerp(52, 7.4, e), h = lerp(30, 3.3, e);
      p.set(k.x + Math.sin(ang) * dist, k.y + h, k.z + Math.cos(ang) * dist);
      this.look.set(k.x + Math.sin(k.dir) * 6 * e, k.y + 1.5, k.z + Math.cos(k.dir) * 6 * e);
      this.dir = k.dir; this.y = k.y + 3.3;
    } else if (k.finished || k.out) {
      this.orbit += dt * 0.55;
      const ang = T.dir + Math.PI + Math.min(this.orbit, 2.4) + Math.max(0, this.orbit - 2.4) * 0.25;
      const tx = T.x + Math.sin(ang) * 7.2, tz = T.z + Math.cos(ang) * 7.2;
      p.x = damp(p.x, tx, 5, dt); p.z = damp(p.z, tz, 5, dt); p.y = damp(p.y, T.y + 2.7, 5, dt);
      this.look.set(T.x, T.y + 1.5, T.z);
      this.fov = damp(this.fov, 55, 3, dt);
    } else {
      this.dir += angleDiff(this.dir, k.dir - k.driftDir * 0.22) * (1 - Math.exp(-6.5 * dt));
      const boosting = k.boostT > 0;
      const dist = 7.4, fx = Math.sin(this.dir), fz = Math.cos(this.dir);
      this.y = damp(this.y, k.y + 3.3, 8, dt);
      p.set(k.x - fx * dist, this.y, k.z - fz * dist);
      this.look.set(k.x + fx * 6, this.y - 1.7, k.z + fz * 6);
      const sf = clamp(k.speed / BASE_MAX, 0, 1.3);
      this.fov = damp(this.fov, 60 + sf * 7 + (boosting ? 11 : 0), 5, dt);
      if (boosting || (k.offroad && k.speed > 8)) {
        p.x += (Math.random() - 0.5) * 0.06; p.y += (Math.random() - 0.5) * 0.06;
      }
    }
    const g = this.world.heightAt(p.x, p.z);
    if (p.y < g + 1.1) p.y = g + 1.1;
    if (this.world.waterLevel !== undefined && p.y < this.world.waterLevel + 1) p.y = this.world.waterLevel + 1;
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(this.look);
  }
}

export class Race {
  /**
   * cfg: { players: [{driver, vehicle}], opponents: [{driver, vehicle}], difficulty, label,
   *        mode: mode id (default 'race'), opts: the mode's options, age: 'little' | 'big' (default: the setting) }
   * The mode (js/modes) decides the rules; Race is the machinery.
   */
  constructor(game, world, cfg) {
    this.game = game; this.world = world; this.cfg = cfg;
    this.params = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    this.age = cfg.age || ageOf(game.settings);
    this.mode = new (modeById(cfg.mode))(this, cfg.opts);
    this.laps = cfg.laps || this.mode.lapCount();
    this.assist = !!game.settings.assist;
    this.state = 'intro'; this.stateT = 0; this.time = 0; this.clock = 0;
    this.count = 4;
    this.particles = new Particles(world.scene);
    this.finishOrder = [];
    this.karts = [];
    const nAI = cfg.opponents.length;
    cfg.players.forEach((p, i) => {
      this.karts.push(new Kart(this, { driver: p.driver, vehicle: p.vehicle, name: p.driver.name, human: true, playerIndex: i }));
    });
    cfg.opponents.forEach((o, i) => {
      const skill = (nAI > 1 ? lerp(1.0, 0.9, i / (nAI - 1)) : 0.96) * this.params.ai;
      const k = new Kart(this, { driver: o.driver, vehicle: o.vehicle, name: o.driver.name, skill, playerIndex: 10 + i });
      k.startDelay = 0.05 + Math.random() * 0.45;
      this.karts.push(k);
    });
    this.humans = this.karts.filter((k) => k.human);
    this.mode.setup();
    this.items = new ItemSystem(this);
    this.obstacles = new ObstacleSystem(this);
    this.cams = this.humans.map((k) => new ChaseCam(k, world));
    this.huds = this.humans.map((k, i) => new Hud(game, this, k, i, this.humans.length));
    this.gasAt = this.humans.map(() => -1);
    this.bumpCool = 0;
    for (let i = 0; i < this.humans.length; i++) game.input.device[i] = game.input.touchMode ? 'touch' : 'keys';
    this.rank();
    if (cfg.label) for (const h of this.huds) h.message(cfg.label, 2.4);
    game.audio.startMusic(world.themeId);
  }

  sfx(name, kart) {
    // Only sounds that involve a player are played (keeps the mix calm).
    if (kart && !kart.human) {
      if (name !== 'spin' && name !== 'splat') return;
      const h = this.humans[0];
      const d = Math.hypot(kart.x - h.x, kart.z - h.z);
      if (d > 40) return;
      this.game.audio.play(name, 0.4);
      return;
    }
    this.game.audio.play(name, 1);
  }

  kartAhead(kart) {
    let best = null;
    for (const k of this.karts) if (!k.finished && !k.out && k.place === kart.place - 1) best = k;
    return best;
  }

  someoneBehind(kart, metres) {
    const d = metres / this.world.track.seg;
    for (const k of this.karts) {
      if (k === kart || k.out) continue;
      const gap = kart.progress - k.progress;
      if (gap > 0 && gap < d) return true;
    }
    return false;
  }

  // Rank every kart (the mode decides how). Also cheers when a human kart gains a place.
  rank() {
    const hs = this.humans;
    for (const k of hs) k.prevPlace = k.place;
    this.mode.rank();
    if (this.state !== 'racing') return;
    for (const k of hs) {
      if (k.place < k.prevPlace && !k.finished && this.clock - k.overtakeAt > 1.5) { k.overtakeAt = this.clock; k.gesture('overtake'); }
    }
  }

  onLap(kart) { this.mode.onLap(kart); }

  onFinish(kart) { this.mode.onFinish(kart); }

  skipIntro() {
    if (this.state === 'intro' && this.stateT > 0.4) this.stateT = INTRO;
  }

  update(dt) {
    const game = this.game, input = game.input, tr = this.world.track;
    this.stateT += dt; this.clock += dt;
    if (this.state === 'intro') {
      if (this.stateT >= INTRO) { this.state = 'countdown'; this.stateT = 0; this.count = 4; }
    } else if (this.state === 'countdown') {
      const c = 3 - Math.floor(this.stateT);
      if (c !== this.count && c > 0 && !this.mode.skipCountdown) {
        this.count = c;
        for (const h of this.huds) h.message(String(c), 0.9, 'count');
        game.audio.play('beep', 1);
      }
      if (this.stateT >= (this.mode.skipCountdown ? 0.3 : 3)) {
        this.state = 'racing'; this.stateT = 0;
        for (const h of this.huds) h.message(t('go'), 1.0, 'go');
        game.audio.play('go', 1);
        // Rocket start: press the gas between "2" and "GO".
        this.humans.forEach((k, i) => {
          if (this.gasAt[i] > 1.0 && this.gasAt[i] < 2.9) { k.boost(1.1, 1.36); game.audio.play('boost', 1); }
        });
      }
    } else {
      this.time += dt;
    }

    this.mode.update(dt);

    // Rubber band: computer racers ease off when far ahead and push when far behind.
    let hp = 0;
    for (const h of this.humans) hp += h.progress;
    hp /= this.humans.length;
    const band = this.mode.allowRubberBand;
    for (const k of this.karts) {
      if (k.human) continue;
      const gap = (k.progress - hp) / tr.n;
      k.speedFactor = band ? k.skill * (1 + clamp(-gap * 1.5, -0.07, 0.085)) : k.skill;
    }

    for (const k of this.karts) {
      if (k.out) continue;
      let ctl;
      k.aiGoal = this.mode.aiGoal(k);
      if (k.human && !k.finished && !this.autopilot) {
        ctl = input.read(k.playerIndex, this.humans.length, dt);
        if (this.state === 'countdown') {
          if (ctl.gas > 0.5 && input.device[k.playerIndex] !== 'touch') { if (this.gasAt[k.playerIndex] < 0) this.gasAt[k.playerIndex] = this.stateT; }
          else this.gasAt[k.playerIndex] = -1;
        }
        if (this.state === 'intro' && ctl.any) this.skipIntro();
        // A kart driving itself (fx 'auto') steers on its own but the player still decides about the item.
        if (k.fx.auto > 0) { const item = ctl.item; ctl = k.aiControl(dt); ctl.item = item; }
      } else {
        ctl = k.aiControl(dt);
        if (k.human && k.finished) { k.speedFactor = 0.78; ctl.item = false; }
        else if (this.state === 'racing' && this.stateT < (k.startDelay || 0) && this.time < 1) ctl.gas = 0;
      }
      if (ctl.item && this.state === 'racing') this.items.use(k);
      k.gasNow = ctl.gas; // the engine sound listens to the pedal
      k.update(dt, ctl);
    }

    // Karts bump into each other (karts that are out or ghosts are not there).
    this.bumpCool -= dt;
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (a.out || b.out || a.fx.ghost > 0 || b.fx.ghost > 0) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 5.3 || d2 < 1e-6 || Math.abs(a.y - b.y) > 2) continue;
        const d = Math.sqrt(d2), over = (2.3 - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * over; a.z -= nz * over; b.x += nx * over; b.z += nz * over;
        a.pushX -= nx * 2.5; a.pushZ -= nz * 2.5; b.pushX += nx * 2.5; b.pushZ += nz * 2.5;
        if ((a.human || b.human) && this.bumpCool <= 0) { game.audio.play('bump', 0.7); this.bumpCool = 0.35; }
        // Giants flatten what they touch, a rainbow star spins it.
        if (a.fx.giant > 0) b.hit({ by: a, cause: 'giant', flat: true });
        if (b.fx.giant > 0) a.hit({ by: b, cause: 'giant', flat: true });
        if (a.fx.star > 0) b.hit({ by: a, cause: 'star' });
        if (b.fx.star > 0) a.hit({ by: b, cause: 'star' });
      }
    }

    this.rank();
    this.items.update(dt, this.clock);
    this.obstacles.update(dt, this.clock);
    this.particles.update(dt);
    for (const c of this.cams) c.update(dt, this);
    for (const h of this.huds) h.update(dt);
    game.audio.engine(this.humans, this.state);

    // Is it over? Let the scene breathe, then show the results.
    if (this.state === 'racing') {
      if (this.mode.isOver()) { this.state = 'ending'; this.stateT = 0; }
    } else if (this.state === 'ending' && this.stateT > 4.2) {
      this.state = 'done';
      game.onRaceDone(this.results());
    }
  }

  // { headline, rows } from the mode, see Mode.results.
  results() {
    return this.mode.results();
  }

  dispose() {
    for (const h of this.huds) h.dispose();
    this.items.dispose();
    this.obstacles.dispose();
    this.mode.dispose();
    this.particles.dispose();
    for (const k of this.karts) k.dispose();
    this.game.audio.engine([], null);
  }
}
