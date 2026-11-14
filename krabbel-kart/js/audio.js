// All sound is synthesised in the browser: no audio files needed.
// Sound effects, a soft engine hum per player and a little procedural tune per track.
import { mulberry32, clamp } from './util.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTA_MAJ = [0, 2, 4, 7, 9], PENTA_MIN = [0, 3, 5, 7, 10];

const SONGS = {
  menu: { bpm: 104, root: 48, minor: false, prog: [0, 5, 3, 4, 0, 5, 3, 4], seed: 3, drums: 'soft', lead: 'triangle', arp: 'sine' },
  meadow: { bpm: 132, root: 55, minor: false, prog: [0, 4, 5, 3, 0, 4, 3, 4], seed: 11, drums: 'bounce', lead: 'square', arp: 'triangle' },
  canyon: { bpm: 126, root: 45, minor: true, prog: [0, 6, 5, 6, 0, 6, 3, 4], seed: 29, drums: 'gallop', lead: 'sawtooth', arp: 'square' },
  island: { bpm: 116, root: 53, minor: false, prog: [0, 3, 4, 3, 0, 3, 4, 0], seed: 41, drums: 'calypso', lead: 'triangle', arp: 'sine' },
  snow: { bpm: 138, root: 50, minor: true, prog: [0, 5, 2, 6, 0, 5, 3, 4], seed: 57, drums: 'bounce', lead: 'sine', arp: 'triangle' },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeMelody(song) {
  const rnd = mulberry32(song.seed * 7919);
  const penta = song.minor ? PENTA_MIN : PENTA_MAJ;
  const scale7 = song.minor ? MINOR : MAJOR;
  const rhythms = [
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0],
    [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0],
  ];
  const noteAt = (i) => song.root + 24 + 12 * Math.floor(i / 5) + penta[((i % 5) + 5) % 5];
  const chordPcs = (deg) => [0, 2, 4].map((k) => (scale7[(deg + k) % 7]) % 12);
  const phrase = (bars, startIdx) => {
    // bars: array of chord degrees (2). Returns 32 steps of 8th notes -> we store per 8th.
    const out = [];
    let idx = startIdx;
    const rh = rhythms[Math.floor(rnd() * rhythms.length)];
    for (let b = 0; b < 2; b++) {
      const pcs = chordPcs(bars[b]);
      for (let e = 0; e < 8; e++) {
        const on = rh[b * 8 + e];
        if (!on) { out.push(null); continue; }
        idx += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)];
        idx = clamp(idx, 0, 9);
        if (e === 0 || e === 4) {
          // Land on a chord tone on strong beats.
          let best = idx, bd = 99;
          for (let c = idx - 2; c <= idx + 2; c++) {
            if (c < 0 || c > 9) continue;
            const pc = ((noteAt(c) - song.root) % 12 + 12) % 12;
            if (pcs.includes(pc) && Math.abs(c - idx) < bd) { bd = Math.abs(c - idx); best = c; }
          }
          idx = best;
        }
        out.push(noteAt(idx));
      }
    }
    return { notes: out, end: idx };
  };
  const p = song.prog;
  const A = phrase([p[0], p[1]], 4);
  const A2 = { notes: A.notes.slice(), end: A.end };
  const tail = phrase([p[2], p[3]], A.end);
  for (let i = 10; i < 16; i++) A2.notes[i] = tail.notes[i];
  const B = phrase([p[4], p[5]], 6);
  const C = phrase([p[6], p[7]], B.end);
  // Finish the loop on the home note.
  for (let i = 15; i >= 0; i--) { if (C.notes[i] !== null) { C.notes[i] = song.root + 24 + (rnd() < 0.5 ? 0 : 12); break; } }
  return [].concat(A.notes, A2.notes, B.notes, C.notes); // 64 eighth notes = 8 bars
}

export class GameAudio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.engines = [];
    this.song = null; this.songId = null; this.timer = null;
  }

  // Must be called from a user gesture (tap / key) at least once.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createDynamicsCompressor();
      this.master.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.55; this.sfxGain.connect(this.master);
      this.musicGain = c.createGain(); this.musicGain.gain.value = 0.28; this.musicGain.connect(this.master);
      this.engGain = c.createGain(); this.engGain.gain.value = 1; this.engGain.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.pendingSong) { const id = this.pendingSong; this.pendingSong = null; this.startMusic(id); }
    }
    if (this.ctx.state === 'suspended') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  }

  applySettings() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.settings.music ? 0.28 : 0;
    this.sfxGain.gain.value = this.settings.sound ? 0.55 : 0;
    this.engGain.gain.value = this.settings.sound ? 1 : 0;
  }

  _tone(dest, type, f0, f1, t0, dur, vol, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(dest, ftype, f0, f1, t0, dur, vol, q = 1) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  play(name, vol = 1) {
    if (!this.ctx || !this.settings.sound || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005, d = this.sfxGain, T = (...a) => this._tone(d, ...a), N = (...a) => this._noise(d, ...a);
    const v = vol;
    switch (name) {
      case 'beep': T('sine', 440, 440, t, 0.22, 0.5 * v); break;
      case 'go': T('sine', 880, 880, t, 0.6, 0.5 * v); T('triangle', 1320, 1320, t, 0.5, 0.2 * v); break;
      case 'click': T('triangle', 620, 760, t, 0.06, 0.35 * v); break;
      case 'back': T('triangle', 520, 400, t, 0.07, 0.3 * v); break;
      case 'pickup': [660, 880, 1320].forEach((f, i) => T('square', f, f, t + i * 0.06, 0.09, 0.16 * v)); break;
      case 'itemReady': T('triangle', 988, 988, t, 0.1, 0.4 * v); T('triangle', 1319, 1319, t + 0.09, 0.2, 0.4 * v); break;
      case 'boost': N('bandpass', 400, 3200, t, 0.6, 0.5 * v, 1.2); T('sawtooth', 120, 420, t, 0.5, 0.16 * v, 0.03); break;
      case 'spin': { T('sine', 760, 140, t, 0.7, 0.4 * v); T('square', 380, 70, t, 0.7, 0.08 * v); break; }
      case 'splat': N('lowpass', 1800, 300, t, 0.22, 0.7 * v); T('sine', 300, 70, t, 0.2, 0.4 * v); break;
      case 'bump': T('sine', 150, 60, t, 0.12, 0.6 * v); N('lowpass', 900, 300, t, 0.06, 0.3 * v); break;
      case 'hop': T('sine', 300, 560, t, 0.09, 0.3 * v); break;
      case 'charge': T('triangle', 900, 1500, t, 0.09, 0.3 * v); break;
      case 'land': T('sine', 110, 50, t, 0.14, 0.5 * v); break;
      case 'pop': T('sine', 1300, 300, t, 0.14, 0.4 * v); N('highpass', 2000, 2000, t, 0.08, 0.3 * v); break;
      case 'shield': [523, 659, 784, 1047].forEach((f, i) => T('triangle', f, f, t + i * 0.05, 0.3, 0.2 * v)); break;
      case 'throw': N('highpass', 800, 4000, t, 0.28, 0.4 * v); break;
      case 'lap': T('triangle', 784, 784, t, 0.12, 0.4 * v); T('triangle', 1047, 1047, t + 0.11, 0.25, 0.4 * v); break;
      case 'finalLap': [784, 988, 1319, 784, 988, 1319].forEach((f, i) => T('square', f, f, t + i * 0.085, 0.1, 0.16 * v)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => T('square', f, f, t + i * 0.12, 0.16, 0.2 * v));
        [523, 659, 784, 1047].forEach((f) => T('triangle', f, f, t + 0.5, 0.9, 0.2 * v, 0.02)); break;
      case 'finish': [392, 523, 659].forEach((f, i) => T('triangle', f, f, t + i * 0.13, 0.3, 0.3 * v)); break;
      case 'snap': N('highpass', 3000, 6000, t, 0.05, 0.5 * v); T('sine', 1200, 1800, t + 0.03, 0.12, 0.3 * v); break;
      default: break;
    }
  }

  // Soft engine hum that follows each player's speed.
  engine(humans, on) {
    if (!this.ctx) return;
    const c = this.ctx;
    while (this.engines.length < humans.length) {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.engGain);
      o1.start(); o2.start();
      this.engines.push({ o1, o2, f, g });
    }
    const now = c.currentTime;
    this.engines.forEach((e, i) => {
      const k = humans[i];
      if (!k || !on) { e.g.gain.setTargetAtTime(0, now, 0.1); return; }
      const sp = Math.abs(k.speed);
      const f = 52 + sp * 3.1 + (k.boostT > 0 ? 26 : 0) + (k.driftDir ? 8 * Math.sin(now * 30) : 0);
      e.o1.frequency.setTargetAtTime(f, now, 0.05);
      e.o2.frequency.setTargetAtTime(f * 0.5, now, 0.05);
      e.f.frequency.setTargetAtTime(260 + sp * 26, now, 0.08);
      e.g.gain.setTargetAtTime(k.finished ? 0.012 : 0.03 + Math.min(sp, 30) * 0.0006, now, 0.1);
    });
  }

  startMusic(id) {
    if (!SONGS[id]) id = 'menu';
    if (!this.ctx) { this.pendingSong = id; return; }
    if (this.songId === id && this.timer) return;
    this.stopMusic();
    const song = SONGS[id];
    this.songId = id;
    this.song = { def: song, melody: makeMelody(song), step: 0, next: this.ctx.currentTime + 0.1 };
    this.timer = setInterval(() => this._tick(), 30);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.songId = null;
  }

  _tick() {
    const c = this.ctx, s = this.song;
    if (!c || !s || c.state !== 'running') return;
    if (s.next < c.currentTime - 0.3) s.next = c.currentTime + 0.05; // tab was asleep
    const stepDur = 60 / s.def.bpm / 4;
    while (s.next < c.currentTime + 0.14) {
      if (this.settings.music) this._step(s, s.step, s.next, stepDur);
      s.next += stepDur; s.step++;
    }
  }

  _step(s, step, t, sd) {
    const def = s.def, d = this.musicGain;
    const bar = Math.floor(step / 16) % 8, pos = step % 16;
    const scale7 = def.minor ? MINOR : MAJOR;
    const deg = def.prog[bar];
    const chord = [0, 2, 4].map((k) => def.root + scale7[(deg + k) % 7] + (deg + k >= 7 ? 12 : 0));
    const dr = def.drums;
    // Drums.
    const kick = dr === 'soft' ? pos === 0 || pos === 8 : dr === 'gallop' ? pos % 4 === 0 : dr === 'calypso' ? pos === 0 || pos === 6 || pos === 10 : pos === 0 || pos === 8 || pos === 10;
    if (kick) this._tone(d, 'sine', 140, 45, t, 0.16, dr === 'soft' ? 0.5 : 0.8);
    if (dr !== 'soft' && (pos === 4 || pos === 12)) this._noise(d, 'bandpass', 1800, 1200, t, 0.12, 0.45, 0.8);
    if (dr === 'gallop' && (pos % 4 === 2 || pos % 4 === 3)) this._noise(d, 'highpass', 5000, 5000, t, 0.03, 0.16);
    else if (pos % 2 === 0) this._noise(d, 'highpass', 6500, 6500, t, 0.03, dr === 'soft' ? 0.06 : pos % 4 === 2 ? 0.2 : 0.11);
    // Bass.
    const bassPat = dr === 'gallop' ? [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15] : dr === 'calypso' ? [0, 3, 6, 8, 11, 14] : [0, 6, 8, 14];
    if (bassPat.includes(pos)) {
      const n = chord[0] - 12 + ((pos === 6 || pos === 14) && dr !== 'gallop' ? 7 : 0);
      this._tone(d, 'triangle', mtof(n), mtof(n), t, sd * 2.2, 0.55, 0.01);
    }
    // Arpeggio.
    if (pos % 2 === 0) {
      const order = dr === 'calypso' ? [0, 2, 1, 2, 0, 1, 2, 1] : [0, 1, 2, 1, 0, 1, 2, 1];
      const n = chord[order[pos / 2]] + 12;
      this._tone(d, def.arp, mtof(n), mtof(n), t, sd * 1.7, def.arp === 'square' ? 0.07 : 0.2, 0.004);
    }
    // Lead melody (stored in eighth notes).
    if (pos % 2 === 0) {
      const n = s.melody[(bar * 8 + pos / 2) % 64];
      if (n !== null) {
        const v = def.lead === 'triangle' || def.lead === 'sine' ? 0.34 : 0.11;
        this._tone(d, def.lead, mtof(n), mtof(n), t, sd * 2.6, v, 0.008);
        if (def.lead === 'sine') this._tone(d, 'sine', mtof(n + 12), mtof(n + 12), t, sd * 1.4, 0.12, 0.004);
      }
    }
  }
}
