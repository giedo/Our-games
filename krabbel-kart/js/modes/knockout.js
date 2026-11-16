// Knockout: one long race with gates. When the first karts have passed a gate, everybody who has not
// is out (8 karts, then 6, 4, 3, 2, then the winner at the finish). Big age group only.
import * as THREE from '../../vendor/three.module.min.js';
import { Mode } from './base.js';
import { addStrings, t } from '../i18n.js';
import { mergeColored, mat4, formatTime } from '../util.js';
import './sfx.js';

addStrings({
  en: {
    modes: { knockout: 'Knockout' }, modeSub: { knockout: 'The last karts drop out' },
    ko: { gate: 'Gate', last1: 'last one is out!', lastN: 'last {n} are out!', safe: 'You are through!', came: 'You came', watch: 'Watching the leader', metres: 'm to go', left: 'left',
      final: 'Final stretch!', finalSub: 'First one home wins', wins: 'wins!', winner: 'Winner', hurry: 'Hurry up!', out: 'Out at gate' },
  },
  nl: {
    modes: { knockout: 'Afvalrace' }, modeSub: { knockout: 'De laatste karts vallen af' },
    ko: { gate: 'Poort', last1: 'de laatste valt af!', lastN: 'de laatste {n} vallen af!', safe: 'Je bent erdoor!', came: 'Je werd', watch: 'Je kijkt mee met de koploper', metres: 'm te gaan', left: 'over',
      final: 'Laatste stuk!', finalSub: 'Wie het eerst thuis is wint', wins: 'wint!', winner: 'Winnaar', hurry: 'Schiet op!', out: 'Af bij poort' },
  },
});

const KEEP = [6, 4, 3, 2]; // karts that stay in after gate 1 to 4
const GATE_COLORS = [0xff7a3c, 0xffd21f, 0x5fe06a, 0xb46bff];
const CONFETTI = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff, 0xff7ac0];
const _v = new THREE.Vector3();

class Knockout extends Mode {
  static options(settings) { return [{ key: 'laps', label: t('laps'), values: [[3, '3'], [4, '4'], [5, '5']], default: 4 }]; }

  constructor(race, opts) {
    super(race, opts);
    this.gateIdx = 0; this.outCount = 0; this.allOutT = 0; this.tickT = 0; this.tickN = 0; this.alive = 0;
    this.mesh = null;
  }

  lapCount() { return Number(this.opts.laps) || 4; }

  setup() {
    super.setup();
    const race = this.race, tr = race.world.track, n = race.karts.length;
    this.alive = n;
    this.passed = new Int8Array(n); this.crossed = new Int8Array(KEEP.length);
    this.outGate = new Int8Array(n); this.outProg = new Float32Array(n); this.outOrd = new Int16Array(n);
    this.gateProg = KEEP.map((_, i) => ((i + 1) / (KEEP.length + 1)) * this.lapCount() * tr.n);
    // The gates: two posts and a beam each, one merged mesh.
    const parts = [], hw = tr.halfWidth + 1.6;
    this.gateProg.forEach((p, i) => {
      const s = p % tr.n, h = tr.headingAt(s);
      tr.posAt(s, 0, _v);
      const c = GATE_COLORS[i];
      const at = (lat, y) => mat4(_v.x + Math.cos(h) * lat, _v.y + y, _v.z - Math.sin(h) * lat, 0, h, 0);
      parts.push({ geo: new THREE.BoxGeometry(0.7, 6.4, 0.7), matrix: at(-hw, 3.2), color: c });
      parts.push({ geo: new THREE.BoxGeometry(0.7, 6.4, 0.7), matrix: at(hw, 3.2), color: c });
      parts.push({ geo: new THREE.BoxGeometry(hw * 2 + 0.7, 1.5, 0.8), matrix: at(0, 6.6), color: c });
      for (let k = -2; k <= 2; k++) parts.push({ geo: new THREE.BoxGeometry(1.1, 1.52, 0.85), matrix: at(k * (hw * 0.4), 6.6), color: 0xffffff });
    });
    const geo = mergeColored(parts);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x333333 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    race.world.scene.add(this.mesh);
  }

  dispose() {
    if (!this.mesh) return;
    this.race.world.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mat.dispose();
    this.mesh = null;
  }

  // Karts that are out: later gate first, then who was further along.
  rank() {
    const race = this.race;
    const sorted = race.karts.slice().sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      if (a.out) {
        const i = race.karts.indexOf(a), j = race.karts.indexOf(b);
        return this.outGate[i] !== this.outGate[j] ? this.outGate[j] - this.outGate[i] : this.outProg[j] - this.outProg[i];
      }
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => { k.place = i + 1; });
    race.sorted = sorted;
  }

  update(dt) {
    super.update(dt);
    const race = this.race;
    if (race.state !== 'racing') return;
    const ks = race.karts, tr = race.world.track;
    // Who has passed which gate.
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      if (k.out) continue;
      while (this.passed[i] < KEEP.length && k.progress >= this.gateProg[this.passed[i]]) {
        const g = this.passed[i]++;
        this.crossed[g]++;
        if (k.human && g >= this.gateIdx) { race.huds[k.playerIndex].message(`${t('ko.gate')} ${g + 1}`, 1.2); race.game.audio.play('mode-gate', 0.8); }
        if (g === this.gateIdx && this.crossed[g] >= KEEP[g]) this.eliminate(g);
      }
    }
    // Tension: a human in the danger zone hears ticks that speed up near the gate.
    this.tickT -= dt;
    if (this.tickT <= 0 && this.gateIdx < KEEP.length) {
      let near = 1e9;
      for (const h of race.humans) {
        if (h.out || this.passed[ks.indexOf(h)] > this.gateIdx || h.place <= KEEP[this.gateIdx]) continue;
        near = Math.min(near, (this.gateProg[this.gateIdx] - h.progress) * tr.seg);
      }
      if (near < 450) {
        this.tickT = 0.22 + 0.9 * Math.min(1, near / 450);
        race.game.audio.play(++this.tickN % 2 ? 'mode-tick' : 'mode-tick2', 0.9);
      } else this.tickT = 0.3;
    }
    // All the players are out: leave the race running a while, then show the results.
    if (race.humans.every((k) => k.out)) this.allOutT += dt; else this.allOutT = 0;
  }

  eliminate(g) {
    const race = this.race, ks = race.karts;
    const cand = [];
    for (let i = 0; i < ks.length; i++) if (!ks[i].out && !ks[i].finished && this.passed[i] <= g) cand.push(i);
    cand.sort((a, b) => ks[b].progress - ks[a].progress);
    for (const i of cand) {
      const k = ks[i];
      this.outGate[i] = g + 1; this.outProg[i] = k.progress; this.outOrd[i] = ++this.outCount;
      k.setOut(true);
      this.alive--;
      race.particles.burst(false, CONFETTI, 34, k.x, k.y + 1.3, k.z, 5, { size: 0.45, size1: 0.3, life: 1.5, gravity: 2.6, drag: 1.1, up: 1.4 });
      race.particles.burst(true, [0xffffff, 0xffe14a], 14, k.x, k.y + 1.5, k.z, 4, { size: 0.5, life: 0.8, gravity: 0 });
      let near = false;
      for (const h of race.humans) if (Math.hypot(h.x - k.x, h.z - k.z) < 40) near = true;
      if (near) race.game.audio.play('mode-puff', 0.5);
    }
    this.gateIdx = g + 1;
    race.rank();
    for (const i of cand) {
      const k = ks[i];
      if (!k.human) continue;
      race.huds[k.playerIndex].message(`${t('ko.came')} ${t('place')[k.place - 1] || k.place}`, 3, 'final');
      race.game.audio.play('mode-out', 1);
    }
  }

  isOver() {
    return this.race.karts.some((k) => k.finished) || this.allOutT > 14;
  }

  canEnd() { return this.race.humans.some((k) => k.out); }

  hudAction(kart) {
    return kart.out && this.race.state === 'racing' ? { label: t('endHere'), fn: () => this.endNow() } : null;
  }

  spectate(kart) {
    const lead = this.race.sorted && this.race.sorted[0];
    return lead && !lead.out ? lead : null;
  }

  hudBanner(kart) {
    const race = this.race;
    if (race.state !== 'racing' && race.state !== 'ending') return null;
    const placeText = t('place')[kart.place - 1] || String(kart.place);
    if (kart.out) return { text: `${t('ko.came')} ${placeText}`, sub: t('ko.watch'), cls: 'out' };
    const g = this.gateIdx;
    if (g >= KEEP.length) return { text: t('ko.final'), sub: t('ko.finalSub'), cls: 'go' };
    const nOut = this.alive - KEEP[g];
    const what = nOut === 1 ? t('ko.last1') : t('ko.lastN').replace('{n}', nOut);
    const dist = Math.max(0, Math.round(((this.gateProg[g] - kart.progress) * race.world.track.seg) / 10) * 10);
    const idx = race.karts.indexOf(kart);
    if (this.passed[idx] > g) return { text: `${t('ko.gate')} ${g + 1}: ${t('ko.safe')}`, cls: 'go' };
    const danger = kart.place > KEEP[g];
    return { text: `${t('ko.gate')} ${g + 1}: ${what}`, sub: danger && dist < 300 ? t('ko.hurry') : `${dist} ${t('ko.metres')}`, cls: danger ? 'danger' : '' };
  }

  hudInfo(kart) {
    const info = super.hudInfo(kart);
    info.extra = [{ icon: '', text: `${this.alive} ${t('ko.left')}` }];
    return info;
  }

  results() {
    const race = this.race;
    race.rank();
    const win = race.sorted[0];
    return {
      headline: win && win.finished ? `${win.name} ${t('ko.wins')}` : t('modes.knockout'),
      rows: race.sorted.map((k) => {
        const i = race.karts.indexOf(k);
        const txt = k.finished ? formatTime(k.finishTime) : k.out ? `${t('ko.gate')} ${this.outGate[i]}` : '';
        return { place: k.place, name: k.name, human: k.human, playerIndex: k.playerIndex, driver: k.driver, index: i, extra: [{ text: txt }] };
      }),
    };
  }
}

Object.assign(Knockout, {
  id: 'knockout', ages: ['big'], karts: 8,
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 60V12M54 60V12"/><path d="M5 6h54v13H5z" fill="#ff7a3c"/><path d="M17 6v13M29 6v13M41 6v13" stroke="#fff" stroke-width="3"/><circle cx="21" cy="38" r="7" fill="#5fe06a"/><circle cx="43" cy="38" r="7" fill="#4fb8ff"/><circle cx="32" cy="53" r="5.5" fill="#e6e6ee" stroke-dasharray="3 4"/><path d="M28 49l8 8M36 49l-8 8" stroke="#ff4b4b" stroke-width="3.5"/></svg>',
});

export default Knockout;
