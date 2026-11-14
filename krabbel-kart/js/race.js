// A single race: grid, countdown, laps, positions, cameras and the finish.
import * as THREE from '../vendor/three.module.min.js';
import { Kart, DIFFICULTY, BASE_MAX } from './kart.js';
import { ItemSystem } from './items.js';
import { Particles } from './particles.js';
import { Hud } from './hud.js';
import { clamp, lerp, damp, angleDiff } from './util.js';
import { t } from './i18n.js';

const INTRO = 4.6;
const CONFETTI = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff, 0xff7ac0];

class ChaseCam {
  constructor(kart, world) {
    this.kart = kart; this.world = world;
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.3, 4000);
    this.dir = kart.dir; this.y = kart.y + 3.3; this.fov = 62; this.orbit = 0; this.shake = 0;
    this.look = new THREE.Vector3();
  }

  update(dt, race) {
    const k = this.kart, cam = this.cam, p = cam.position;
    if (race.state === 'intro') {
      const u = clamp(race.stateT / INTRO, 0, 1), e = 1 - Math.pow(1 - u, 3);
      const ang = k.dir + Math.PI + (1 - e) * 2.7;
      const dist = lerp(52, 7.4, e), h = lerp(30, 3.3, e);
      p.set(k.x + Math.sin(ang) * dist, k.y + h, k.z + Math.cos(ang) * dist);
      this.look.set(k.x + Math.sin(k.dir) * 6 * e, k.y + 1.5, k.z + Math.cos(k.dir) * 6 * e);
      this.dir = k.dir; this.y = k.y + 3.3;
    } else if (k.finished) {
      this.orbit += dt * 0.55;
      const ang = k.dir + Math.PI + Math.min(this.orbit, 2.4) + Math.max(0, this.orbit - 2.4) * 0.25;
      const tx = k.x + Math.sin(ang) * 7.2, tz = k.z + Math.cos(ang) * 7.2;
      p.x = damp(p.x, tx, 5, dt); p.z = damp(p.z, tz, 5, dt); p.y = damp(p.y, k.y + 2.7, 5, dt);
      this.look.set(k.x, k.y + 1.5, k.z);
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
   * cfg: { players: [{driver, vehicle}], opponents: [{driver, vehicle}], difficulty, laps }
   */
  constructor(game, world, cfg) {
    this.game = game; this.world = world; this.cfg = cfg;
    this.params = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    this.laps = cfg.laps || 3;
    this.assist = !!game.settings.assist;
    this.state = 'intro'; this.stateT = 0; this.time = 0; this.clock = 0; this.endT = 0;
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
    // Grid: computer racers in front, players at the back (more overtaking fun).
    const order = this.karts.filter((k) => !k.human).concat(this.humans);
    const tr = world.track;
    order.forEach((k, slot) => {
      const row = Math.floor(slot / 2), colm = slot % 2;
      k.placeAt(-(7 + row * 6 + colm * 3) / tr.seg, colm ? 3.8 : -3.8);
    });
    this.items = new ItemSystem(this);
    this.cams = this.humans.map((k) => new ChaseCam(k, world));
    this.huds = this.humans.map((k, i) => new Hud(game, this, k, i, this.humans.length));
    this.gasAt = this.humans.map(() => -1);
    this.bumpCool = 0;
    for (let i = 0; i < this.humans.length; i++) game.input.device[i] = game.input.touchMode ? 'touch' : 'keys';
    this.rank();
    game.audio.startMusic(world.def.id);
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
    for (const k of this.karts) if (!k.finished && k.place === kart.place - 1) best = k;
    return best;
  }

  someoneBehind(kart, metres) {
    const d = metres / this.world.track.seg;
    for (const k of this.karts) {
      if (k === kart) continue;
      const gap = kart.progress - k.progress;
      if (gap > 0 && gap < d) return true;
    }
    return false;
  }

  rank() {
    const sorted = this.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => { k.place = i + 1; });
    this.sorted = sorted;
  }

  onLap(kart) {
    if (!kart.human) return;
    const hud = this.huds[kart.playerIndex];
    if (kart.lap === this.laps - 1) { hud.message(t('finalLap'), 1.8, 'final'); this.game.audio.play('finalLap', 1); }
    else { hud.message(`${t('lap')} ${kart.lap + 1}`, 1.3); this.game.audio.play('lap', 1); }
  }

  onFinish(kart) {
    this.finishOrder.push(kart);
    this.rank();
    if (!kart.human) return;
    const hud = this.huds[kart.playerIndex];
    hud.message(t('finish'), 2.2, 'final');
    this.game.audio.play(kart.place <= 3 ? 'win' : 'finish', 1);
    for (let i = 0; i < 4; i++) {
      this.particles.burst(false, CONFETTI, 40, kart.x + (Math.random() - 0.5) * 8, kart.y + 4 + Math.random() * 3, kart.z + (Math.random() - 0.5) * 8, 9, { size: 0.42, size1: 0.42, life: 2.6, gravity: 5, drag: 1.2 });
    }
  }

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
      if (c !== this.count && c > 0) {
        this.count = c;
        for (const h of this.huds) h.message(String(c), 0.9, 'count');
        game.audio.play('beep', 1);
      }
      if (this.stateT >= 3) {
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

    // Rubber band: computer racers ease off when far ahead and push when far behind.
    let hp = 0;
    for (const h of this.humans) hp += h.progress;
    hp /= this.humans.length;
    for (const k of this.karts) {
      if (k.human) continue;
      const gap = (k.progress - hp) / tr.n;
      k.speedFactor = k.skill * (1 + clamp(-gap * 1.5, -0.07, 0.085));
    }

    for (const k of this.karts) {
      let ctl;
      if (k.human && !k.finished && !this.autopilot) {
        ctl = input.read(k.playerIndex, this.humans.length, dt);
        if (this.state === 'countdown') {
          if (ctl.gas > 0.5 && input.device[k.playerIndex] !== 'touch') { if (this.gasAt[k.playerIndex] < 0) this.gasAt[k.playerIndex] = this.stateT; }
          else this.gasAt[k.playerIndex] = -1;
        }
        if (this.state === 'intro' && ctl.any) this.skipIntro();
      } else {
        ctl = k.aiControl(dt);
        if (k.human && k.finished) { k.speedFactor = 0.78; ctl.item = false; }
        else if (this.state === 'racing' && this.stateT < (k.startDelay || 0) && this.time < 1) ctl.gas = 0;
      }
      if (ctl.item && this.state === 'racing') this.items.use(k);
      k.update(dt, ctl);
    }

    // Karts bump into each other.
    this.bumpCool -= dt;
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 5.3 || d2 < 1e-6 || Math.abs(a.y - b.y) > 2) continue;
        const d = Math.sqrt(d2), over = (2.3 - d) / 2, nx = dx / d, nz = dz / d;
        a.x -= nx * over; a.z -= nz * over; b.x += nx * over; b.z += nz * over;
        a.pushX -= nx * 2.5; a.pushZ -= nz * 2.5; b.pushX += nx * 2.5; b.pushZ += nz * 2.5;
        if ((a.human || b.human) && this.bumpCool <= 0) { game.audio.play('bump', 0.7); this.bumpCool = 0.35; }
      }
    }

    this.rank();
    this.items.update(dt, this.clock);
    this.particles.update(dt);
    for (const c of this.cams) c.update(dt, this);
    for (const h of this.huds) h.update(dt);
    game.audio.engine(this.humans, this.state === 'racing' || this.state === 'ending');

    // All players home? Let the scene breathe, then show the results.
    if (this.state === 'racing') {
      const allDone = this.humans.every((k) => k.finished);
      const firstDone = this.humans.some((k) => k.finished);
      if (firstDone) this.endT += dt;
      if (allDone || this.endT > 60) { this.state = 'ending'; this.stateT = 0; }
    } else if (this.state === 'ending' && this.stateT > 4.2) {
      this.state = 'done';
      game.onRaceDone(this.results());
    }
  }

  results() {
    this.rank();
    return this.sorted.map((k) => ({
      place: k.place, name: k.name, human: k.human, playerIndex: k.playerIndex,
      time: k.finished ? k.finishTime : null, driver: k.driver,
    }));
  }

  dispose() {
    for (const h of this.huds) h.dispose();
    this.items.dispose();
    this.particles.dispose();
    for (const k of this.karts) k.dispose();
    this.game.audio.engine([], false);
  }
}
