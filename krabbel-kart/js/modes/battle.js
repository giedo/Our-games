// Shared base of the arena battle modes (balloon, stars, flag): timer, spawn spots, scores, ranking,
// results, and the computer racers' target choosing (goals for kart.aiGoal). Subclasses fill in think().
import * as THREE from '../../vendor/three.module.min.js';
import { Mode } from './base.js';
import { isLittle } from '../age.js';
import { addStrings, t } from '../i18n.js';
import { clamp } from '../util.js';
import './battle-sfx.js';

addStrings({
  en: { battle: {
    time: 'Time', min: 'min', pts: 'pts', best: 'Best', pop: 'Pop!', wins: 'wins!', tie: 'It is a tie!', timeUp: 'Time is up!',
    lostAll: 'Out of balloons! New ones in 3', back: 'Back in the game!', stars: 'stars', star: 'Star!', hits: 'hits',
    red: 'Red', blue: 'Blue', redWins: 'Red team wins!', blueWins: 'Blue team wins!', duo: 'Two players', same: 'Same team', split: 'Opposite teams',
    caps: 'flags', grab: 'grabbed the flag!', lost: 'Flag dropped!', home: 'Flag is back home', score: 'Flag home! +1', stolen: 'They have our flag!', carry: 'You have the flag! Bring it home',
  } },
  nl: { battle: {
    time: 'Tijd', min: 'min', pts: 'pnt', best: 'Beste', pop: 'Knal!', wins: 'wint!', tie: 'Gelijkspel!', timeUp: 'De tijd is om!',
    lostAll: 'Geen ballonnen meer! Nieuwe over 3', back: 'Weer in het spel!', stars: 'sterren', star: 'Ster!', hits: 'raak',
    red: 'Rood', blue: 'Blauw', redWins: 'Rood team wint!', blueWins: 'Blauw team wint!', duo: 'Twee spelers', same: 'Zelfde team', split: 'Tegen elkaar',
    caps: 'vlaggen', grab: 'pakte de vlag!', lost: 'Vlag gevallen!', home: 'Vlag is weer thuis', score: 'Vlag thuis! +1', stolen: 'Zij hebben onze vlag!', carry: 'Jij hebt de vlag! Breng hem thuis',
  } },
});

export const KART_COLORS = [0xff4b4b, 0x4fb8ff, 0xffa53c, 0x5fe06a, 0xb46bff, 0xff7ac0, 0x2fd0d0, 0xc9ced8];
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');
export const clock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const _v = new THREE.Vector3();
const POOL_LITTLE = ['turbo', 'puddle', 'plane', 'shield', 'star', 'spring'];
const POOL_BIG = POOL_LITTLE.concat(['ball', 'bomb', 'giant', 'sparks', 'freeze', 'boomerang', 'horn', 'ghost']);

// Time limit option (minutes), default 2 for the little ones, 3 otherwise.
export function timeOption(settings) {
  return { key: 'time', label: t('battle.time'), values: [[2, `2 ${t('battle.min')}`], [3, `3 ${t('battle.min')}`], [5, `5 ${t('battle.min')}`]], default: isLittle(settings) ? 2 : 3 };
}

export class BattleMode extends Mode {
  constructor(race, opts) {
    super(race, opts);
    const mins = Number(this.opts.time) || (race.age === 'little' ? 2 : 3);
    this.limit = mins * 60; this.timeLeft = this.limit;
    this.dt = 0.016; this.over = false; this.disposers = [];
  }

  lapCount() { return Infinity; }
  get allowRubberBand() { return false; }
  onLap() {}
  onFinish() {}
  get live() { return this.race.state === 'racing' && !this.over; }

  // Where a kart starts: slot 0..n-1 evenly round the ring, alternate sides, alternate directions.
  spawn(k, slot, n) {
    const tr = this.race.world.track;
    this.spawnAt(k, ((slot + 0.3) / n) * tr.n, slot % 2 ? 5.5 : -5.5, slot % 2 === 1);
  }

  spawnAt(k, s, lat, reverse) {
    k.placeAt(s, lat);
    if (reverse) { k.dir += Math.PI; k.updateVisual(0.016, 0); }
  }

  setup() {
    const race = this.race, ks = race.karts;
    ks.forEach((k, i) => {
      k.bi = i; k.score = 0; k.scoreT = 0; k.stars = 0; k.pops = 0;
      k.bt = { goal: { x: k.x, z: k.z }, thinkT: Math.random() * 0.5, target: null, kind: '', lock: 0, ban: null, banT: 0, chaseT: 0, aggr: 0.3 + Math.random() * 0.7, role: 0 };
    });
    this.layout();
    for (const k of ks) { k.bt.goal.x = k.x + Math.sin(k.dir) * 10; k.bt.goal.z = k.z + Math.cos(k.dir) * 10; }
    this.build();
  }

  // Default layout: humans on opposite sides, computer racers in the gaps.
  layout() {
    const ks = this.race.karts, hs = this.race.humans, n = ks.length;
    const order = []; const slots = [];
    for (let i = 0; i < n; i++) slots.push(i);
    const pickSlots = hs.length > 1 ? [0, n / 2] : [0];
    hs.forEach((h, i) => { order[pickSlots[i]] = h; });
    const ai = ks.filter((k) => !k.human);
    let a = 0;
    for (let i = 0; i < n; i++) if (!order[i]) order[i] = ai[a++];
    order.forEach((k, i) => this.spawn(k, i, n));
  }

  build() {}
  sync() {}
  think() {}

  update(dt) {
    this.dt = dt;
    if (this.race.state === 'racing' && !this.over) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.over = true; this.timeIsUp(); }
    }
    this.tick(dt);
  }

  tick() {}

  timeIsUp() {
    for (const h of this.race.huds) h.message(t('battle.timeUp'), 2.6, 'final');
    this.race.game.audio.play('battle-end', 1);
  }

  isOver() { return this.over; }

  // By score, then who got there first. Also keeps the 3D bits in step with the karts (this runs after they moved).
  rank() {
    const race = this.race;
    const sorted = race.karts.slice().sort((a, b) => (b.score - a.score) || (a.scoreT - b.scoreT) || (a.bi - b.bi));
    sorted.forEach((k, i) => { k.place = i + 1; });
    race.sorted = sorted;
    this.sync();
  }

  add(k, n) { k.score += n; k.scoreT = this.race.clock; }

  // ---- messages and sound ----
  say(k, text, dur, cls) { if (k && k.human) this.race.huds[k.playerIndex].message(text, dur || 1.2, cls || ''); }
  sfxAt(name, x, z, vol = 1) {
    let d = 1e9;
    for (const h of this.race.humans) d = Math.min(d, Math.hypot(h.x - x, h.z - z));
    const v = vol * clamp(1.15 - d / 80, 0, 1);
    if (v > 0.05) this.race.game.audio.play(name, v);
  }

  // ---- HUD ----
  hudInfo(k) {
    const lead = this.race.sorted ? this.race.sorted[0].score : 0;
    return { place: `${k.score} ${t('battle.pts')}`, lap: `${t('battle.best')} ${lead}`, extra: this.extras(k), time: clock(this.timeLeft) };
  }
  extras() { return []; }
  mapColor(k) { return hex(KART_COLORS[k.bi % 8]); }

  itemPool(k) { return this.race.age === 'little' ? POOL_LITTLE : POOL_BIG; }

  // ---- results ----
  headlineFor(winner) { return winner ? `${winner.name} ${t('battle.wins')}` : t('battle.tie'); }

  results() {
    const race = this.race;
    this.rank();
    const s = race.sorted, tie = s.length > 1 && s[0].score === s[1].score;
    return { headline: this.headline(tie ? null : s[0]), rows: s.map((k, i) => this.row(k, i)) };
  }
  headline(w) { return this.headlineFor(w); }
  row(k) {
    return { place: k.place, name: k.name, human: k.human, playerIndex: k.playerIndex, driver: k.driver, index: this.race.karts.indexOf(k), extra: this.cols(k) };
  }
  cols(k) { return [{ text: k.score, cls: 'pt big' }]; }

  dispose() { for (const f of this.disposers) f(); this.disposers.length = 0; }

  // ---- computer racers ----
  aiGoal(k) {
    const bt = k.bt;
    if (!bt) return null;
    if (this.race.state === 'racing' && !this.over) {
      bt.thinkT -= this.dt;
      if (bt.banT > 0) { bt.banT -= this.dt; if (bt.banT <= 0) bt.ban = null; }
      if (bt.target) { bt.chaseT += this.dt; if (bt.chaseT > 7) { bt.ban = bt.target; bt.banT = 4; bt.target = null; bt.thinkT = 0; } }
      if (bt.thinkT <= 0) { bt.thinkT = 0.35 + Math.random() * 0.4; this.think(k, bt); }
      const o = bt.target;
      if (o && !o.out) this.aimAt(bt, o.x + Math.sin(o.dir) * o.speed * 0.3, o.z + Math.cos(o.dir) * o.speed * 0.3);
    }
    return bt.goal;
  }

  aimAt(bt, x, z) { bt.goal.x = x; bt.goal.z = z; }

  // How many computer racers already chase this kart.
  chasers(o, but) {
    let n = 0;
    for (const k of this.race.karts) if (k !== but && !k.human && k.bt && k.bt.target === o) n++;
    return n;
  }

  // The best kart to chase: near, not already chased by others (humans by at most one), filtered by ok(o).
  pickTarget(k, bt, ok) {
    let best = null, bc = 1e9;
    for (const o of this.race.karts) {
      if (o === k || o.out || o === bt.ban || (ok && !ok(o))) continue;
      const load = this.chasers(o, k);
      if (o.human && load >= 1) continue;
      if (load >= 2) continue;
      const c = Math.hypot(o.x - k.x, o.z - k.z) + load * 22 + (o.human ? 10 : 0);
      if (c < bc) { bc = c; best = o; }
    }
    if (best !== bt.target) bt.chaseT = 0;
    bt.target = best;
    return best;
  }

  nearestBox(k, maxD) {
    let best = null, bd = maxD * maxD;
    for (const b of this.race.items.boxes) {
      if (b.t > 0) continue;
      const d = (b.x - k.x) * (b.x - k.x) + (b.z - k.z) * (b.z - k.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  wantsBox(k) { return !k.item && k.rollT <= 0; }

  // Run away from a kart along the ring.
  flee(k, bt, from) {
    const tr = this.race.world.track;
    let ds = k.s - from.s;
    if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
    tr.posAt(k.s + (ds < 0 ? -1 : 1) * 45 / tr.seg, 0, _v);
    bt.target = null; this.aimAt(bt, _v.x, _v.z);
  }

  // A point on the ring: sample s, sideways offset lat.
  ringPoint(s, lat, out) { this.race.world.track.posAt(s, lat, _v); out.x = _v.x; out.z = _v.z; return out; }
}

Object.assign(BattleMode, { group: 'battle', arena: true, roadStars: false, karts: 8 });
