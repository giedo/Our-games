// All sound is made in the browser, no audio files.
//  - Engine: a rough harmonic waveform driven by a little gearbox model (revs
//    climb in each gear and drop on the shift), exhaust noise, wind and tyre squeal.
//  - Effects: layered tones and noise with a short room reverb.
//  - Music: hand-written tunes, one per world, played by simple synth
//    instruments (lead, bass, chords, drums) through reverb and echo.
import { mulberry32, clamp } from './util.js';
import { WORLD_PACKS } from './worlds/index.js';

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function noteToMidi(n) {
  const m = /^([a-g])([#b]?)(\d)$/.exec(n);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
}
function chordOf(sym) {
  const root = PC[sym[0].toLowerCase()] + (sym[1] === 'b' ? -1 : sym[1] === '#' ? 1 : 0);
  return { root: ((root % 12) + 12) % 12, minor: sym.endsWith('m') };
}

// Each tune: chords per bar ("Dm,G" = two chords in one bar) and the melody,
// one string per bar, written as note/length with the length in sixteenths.
const SONGS = {
  menu: {
    bpm: 104, style: 'soft', lead: 'whistle',
    chords: 'C Am F G C Am Dm,G C F G Em Am F G C C',
    melody: [
      'e5/4 g5/2 e5/2 c5/4 d5/4', 'e5/6 d5/2 c5/4 a4/4', 'f5/4 a5/2 f5/2 c5/4 d5/4', 'd5/6 e5/2 d5/4 b4/4',
      'e5/4 g5/2 e5/2 c6/4 b5/4', 'a5/6 g5/2 e5/4 c5/4', 'd5/2 f5/2 a5/4 g5/2 f5/2 d5/4', 'c5/8 -/8',
      'a5/4 c6/4 a5/4 f5/4', 'g5/4 b5/4 g5/4 d5/4', 'g5/6 e5/2 b4/4 e5/4', 'a4/2 c5/2 e5/4 a5/8',
      'a5/4 c6/4 a5/4 f5/4', 'b5/4 d6/4 b5/4 g5/4', 'c6/4 g5/4 e5/4 g5/4', 'c5/8 -/8',
    ],
  },
  meadow: {
    bpm: 132, style: 'bounce', lead: 'square',
    chords: 'G D Em C G D C,D G C G Am D C G Am,D G',
    melody: [
      'd5/2 g5/2 b5/2 g5/2 d6/4 b5/4', 'a5/2 f#5/2 d5/2 f#5/2 a5/4 -/4', 'g5/2 e5/2 b4/2 e5/2 g5/4 b5/4', 'c6/4 b5/2 a5/2 g5/4 e5/4',
      'd5/2 g5/2 b5/2 g5/2 d6/4 b5/4', 'a5/2 d6/2 f#6/4 e6/2 d6/2 a5/4', 'c6/2 e6/2 g6/4 f#6/2 e6/2 d6/4', 'g5/4 d5/4 g5/8',
      'e6/4 c6/2 e6/2 g6/4 e6/4', 'd6/4 b5/2 d6/2 g5/8', 'c6/4 a5/2 c6/2 e6/4 c6/4', 'd6/2 e6/2 f#6/4 a5/8',
      'e6/4 c6/2 e6/2 g6/4 e6/4', 'd6/4 g6/4 b5/4 d6/4', 'c6/2 b5/2 a5/4 f#5/2 a5/2 d6/4', 'g5/8 -/8',
    ],
  },
  canyon: {
    bpm: 126, style: 'gallop', lead: 'trumpet',
    chords: 'Am Am G G F F E E C G Am Am C G E Am',
    melody: [
      'a4/4 c5/2 e5/2 a5/6 g5/2', 'e5/8 -/2 e5/2 g5/2 a5/2', 'g5/4 b5/2 d6/2 b5/6 a5/2', 'g5/8 -/2 d5/2 g5/2 b5/2',
      'a5/4 c6/2 a5/2 f5/6 e5/2', 'f5/4 a5/4 c6/8', 'b5/4 g#5/4 e5/4 g#5/4', 'b5/2 c6/2 b5/2 g#5/2 e5/8',
      'e5/2 g5/2 c6/4 e6/4 c6/4', 'd6/4 b5/4 g5/8', 'e5/2 a5/2 c6/4 e6/4 c6/4', 'a5/12 -/4',
      'e5/2 g5/2 c6/4 e6/4 g6/4', 'g6/4 d6/4 b5/8', 'e6/4 d6/4 c6/4 b5/4', 'a5/8 -/8',
    ],
  },
  island: {
    bpm: 116, style: 'calypso', lead: 'pan',
    chords: 'F Bb C F F Bb C F Dm Bb F C Dm Bb C F',
    melody: [
      'c5/3 f5/3 a5/2 c6/3 a5/3 f5/2', 'd6/3 bb5/3 f5/2 bb5/4 d6/4', 'e6/3 c6/3 g5/2 c6/3 e6/3 g6/2', 'f6/6 -/2 c6/2 a5/2 f5/4',
      'c5/3 f5/3 a5/2 c6/3 a5/3 f5/2', 'd6/3 f6/3 d6/2 bb5/4 d6/4', 'e6/3 g6/3 e6/2 c6/3 bb5/3 g5/2', 'f5/8 -/8',
      'a5/4 d6/4 f6/4 d6/4', 'bb5/3 d6/3 f6/2 d6/8', 'a5/4 c6/4 f6/4 c6/4', 'g5/3 c6/3 e6/2 c6/8',
      'a5/4 d6/4 f6/4 a6/4', 'g6/3 f6/3 d6/2 bb5/8', 'c6/2 e6/2 g6/4 e6/2 c6/2 g5/4', 'f5/8 -/8',
    ],
  },
  snow: {
    bpm: 138, style: 'sleigh', lead: 'bell',
    chords: 'Dm Bb F C Dm Bb C Dm F C Dm Am Bb F C Dm',
    melody: [
      'd5/4 f5/4 a5/4 d6/4', 'f6/6 d6/2 bb5/8', 'c6/4 a5/4 f5/4 a5/4', 'g5/6 e5/2 c5/4 e5/4',
      'd5/4 f5/4 a5/4 d6/4', 'f6/4 g6/4 f6/4 d6/4', 'e6/4 c6/4 g5/4 e6/4', 'd6/8 -/8',
      'a5/2 c6/2 f6/4 a6/4 f6/4', 'g6/4 e6/4 c6/8', 'f6/2 e6/2 d6/4 a5/4 d6/4', 'e6/4 c6/4 a5/8',
      'd6/2 f6/2 bb6/4 f6/4 d6/4', 'c6/4 a5/4 f5/4 a5/4', 'g5/2 c6/2 e6/4 g6/4 e6/4', 'd6/8 -/8',
    ],
  },
  podium: {
    bpm: 120, style: 'march', lead: 'brass',
    chords: 'C F C G C F G C',
    melody: [
      'g5/2 g5/2 c6/4 e6/4 c6/4', 'f6/6 e6/2 d6/4 c6/4', 'e6/4 g6/4 e6/4 c6/4', 'd6/8 b5/4 d6/4',
      'g5/2 g5/2 c6/4 e6/4 g6/4', 'a6/6 g6/2 f6/4 a6/4', 'g6/4 f6/4 e6/4 d6/4', 'c6/12 -/4',
    ],
  },
};

// Rhythm section per style. Step numbers are sixteenths within a bar.
const STYLES = {
  soft: { kick: [0, 10], snare: [], rim: [4, 12], hat: [0, 4, 8, 12], hatVol: 0.25, bass: [[0, 0], [8, 7]], bassLen: 6, comp: 'pad', level: 0.9 },
  bounce: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.5, bass: [[0, 0], [6, 7], [8, 0], [12, 12], [14, 7]], bassLen: 2, comp: 'offbeat', level: 1 },
  gallop: { kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15], hatVol: 0.34, bass: [[0, 0], [2, 0], [3, 0], [4, 7], [6, 0], [7, 0], [8, 0], [10, 0], [11, 0], [12, 7], [14, 12], [15, 7]], bassLen: 1, comp: 'strum', level: 1 },
  calypso: { kick: [0, 6, 12], snare: [], rim: [4, 10, 14], hat: [], shaker: true, conga: [3, 7, 11, 13], bass: [[0, 0], [3, 0], [6, 7], [8, 0], [11, 7], [14, 12]], bassLen: 2, comp: 'offbeat', level: 1 },
  sleigh: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.3, sleigh: true, bass: [[0, 0], [2, 0], [4, 12], [6, 0], [8, 0], [10, 0], [12, 12], [14, 7]], bassLen: 1.6, comp: 'arp', level: 1 },
  march: { kick: [0, 8], snare: [4, 12, 14, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.3, bass: [[0, 0], [4, 7], [8, 0], [12, 7]], bassLen: 3, comp: 'stab', level: 1 },
};

// World packs bring their own tune (pack.song) and optionally their own rhythm style
// (pack.style, then song.style defaults to the pack id). The tune plays for that world id.
for (const p of WORLD_PACKS) {
  if (p.style) STYLES[p.id] = p.style;
  if (p.song) SONGS[p.id] = Object.assign({ style: p.style ? p.id : 'soft', lead: 'bell' }, p.song);
}

function compile(song) {
  const bars = song.chords.split(' ').map((b) => b.split(',').map(chordOf));
  const lead = new Map();
  song.melody.forEach((bar, bi) => {
    let pos = 0;
    for (const tok of bar.split(' ')) {
      const [n, l] = tok.split('/');
      const len = Number(l);
      if (n !== '-') lead.set(bi * 16 + pos, { midi: noteToMidi(n), len });
      pos += len;
    }
  });
  return { bars, lead, steps: bars.length * 16 };
}

// One player's engine.
class EngineVoice {
  constructor(a, pan) {
    const c = a.ctx;
    this.a = a; this.gear = 0; this.rpm = 0.14; this.last = c.currentTime;
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.setPeriodicWave(a.engineWave); o2.setPeriodicWave(a.engineWave);
    const g1 = c.createGain(), g2 = c.createGain();
    g1.gain.value = 0.62; g2.gain.value = 0.5;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(257);
    for (let i = 0; i < 257; i++) { const x = (i / 128 - 1) * 2.4; curve[i] = Math.tanh(x); }
    shaper.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.value = 500;
    const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 175; body.Q.value = 1.1; body.gain.value = 6;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 42;
    const tone = c.createGain(); tone.gain.value = 0;
    o1.connect(g1); o2.connect(g2); g1.connect(shaper); g2.connect(shaper);
    shaper.connect(lp); lp.connect(body); body.connect(hp); hp.connect(tone);
    // Exhaust rasp: noise chopped by the engine's own pulse.
    const nz = a._noiseSrc(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.value = 900;
    const rasp = c.createGain(); rasp.gain.value = 0;
    const chop = c.createGain(); chop.gain.value = 0;
    nz.connect(bp); bp.connect(rasp); o1.connect(chop); chop.connect(rasp.gain);
    // Wind and road rush.
    const wn = a._noiseSrc(); const wlp = c.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 500;
    const wind = c.createGain(); wind.gain.value = 0;
    wn.connect(wlp); wlp.connect(wind);
    // Tyre squeal while drifting.
    const sn = a._noiseSrc(); const sbp = c.createBiquadFilter(); sbp.type = 'bandpass'; sbp.Q.value = 11; sbp.frequency.value = 1700;
    const sbp2 = c.createBiquadFilter(); sbp2.type = 'bandpass'; sbp2.Q.value = 9; sbp2.frequency.value = 2500;
    const squeal = c.createGain(); squeal.gain.value = 0;
    sn.connect(sbp); sn.connect(sbp2); sbp.connect(squeal); sbp2.connect(squeal);
    // Turbo whistle.
    const to = c.createOscillator(); to.type = 'sine'; const turbo = c.createGain(); turbo.gain.value = 0;
    to.connect(turbo);
    const out = c.createGain(); out.gain.value = 1;
    tone.connect(out); rasp.connect(out); wind.connect(out); squeal.connect(out); turbo.connect(out);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(a.engBus); } else out.connect(a.engBus);
    o1.start(); o2.start(); to.start();
    Object.assign(this, { o1, o2, lp, tone, bp, rasp, chop, wlp, wind, sbp, sbp2, squeal, to, turbo, out, srcs: [o1, o2, to, nz, wn, sn] });
  }

  // state: { speed, gas (0..1), boost, drift (0..3, 0 = none), moving, quiet }
  set(st, now) {
    const TOPS = [8.5, 15, 22, 29.5, 60];
    const dt = Math.min(0.1, Math.max(0.001, now - this.last)); this.last = now;
    const v = Math.abs(st.speed);
    if (st.moving) {
      if (this.gear < 4 && v > TOPS[this.gear] + 0.5) this.gear++;
      else if (this.gear > 0 && v < TOPS[this.gear - 1] - 1.5) this.gear--;
    } else this.gear = 0;
    const lo = this.gear ? TOPS[this.gear - 1] : 0, hi = this.gear === 4 ? 44 : TOPS[this.gear];
    const frac = clamp((v - lo) / (hi - lo), 0, 1.15);
    let target = this.gear === 0 ? 0.14 + 0.84 * frac : 0.44 + 0.56 * frac;
    if (!st.moving) target = 0.14 + st.gas * 0.5; // revving on the start line
    if (st.boost) target = Math.min(1.2, target + 0.12);
    this.rpm += (target - this.rpm) * Math.min(1, dt * (target < this.rpm ? 15 : 8));
    const rpm = this.rpm, load = st.boost ? 1 : st.gas;
    const f = (48 + rpm * 168) * (1 + (Math.random() - 0.5) * 0.012); // tiny jitter = uneven firing
    const T = 0.03;
    this.o1.frequency.setTargetAtTime(f, now, T);
    this.o2.frequency.setTargetAtTime(f * 0.5 * 1.006, now, T);
    this.lp.frequency.setTargetAtTime(360 + load * 900 + rpm * (850 + load * 2000), now, 0.05);
    const k = st.quiet ? 0.35 : 1;
    this.tone.gain.setTargetAtTime((0.05 + 0.075 * load + 0.035 * rpm) * k, now, 0.06);
    const rasp = (0.012 + load * 0.035 + rpm * 0.02) * k;
    this.rasp.gain.setTargetAtTime(rasp, now, 0.06);
    this.chop.gain.setTargetAtTime(rasp * 0.9, now, 0.06);
    this.bp.frequency.setTargetAtTime(650 + rpm * 1800, now, 0.05);
    this.wind.gain.setTargetAtTime(Math.min(0.07, 0.05 * (v / 34) * (v / 34)) * k, now, 0.15);
    this.wlp.frequency.setTargetAtTime(380 + v * 26, now, 0.15);
    this.squeal.gain.setTargetAtTime(st.drift ? (0.035 + 0.012 * st.drift) * k : 0, now, st.drift ? 0.04 : 0.09);
    const wob = Math.sin(now * 11) * 90;
    this.sbp.frequency.setTargetAtTime(1650 + wob, now, 0.05);
    this.sbp2.frequency.setTargetAtTime(2450 + wob * 1.4, now, 0.05);
    this.turbo.gain.setTargetAtTime(st.boost ? 0.014 * k : 0, now, 0.1);
    this.to.frequency.setTargetAtTime(1000 + rpm * 1100, now, 0.08);
  }

  silence(now) { this.out.gain.setTargetAtTime(0, now, 0.08); }
  wake(now) { this.out.gain.setTargetAtTime(1, now, 0.08); }
}

export class GameAudio {
  /** ctx is optional: tests pass an OfflineAudioContext. */
  constructor(settings, ctx = null) {
    this.settings = settings;
    this.ctx = null;
    this.engines = [];
    this.song = null; this.songId = null; this.timer = null; this.pendingSong = null;
    if (ctx) this._init(ctx);
  }

  // Must be called from a user gesture (tap / key) at least once.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      let c;
      try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { try { c = new AC(); } catch (e2) { return; } }
      this._init(c);
      if (this.pendingSong) { const id = this.pendingSong; this.pendingSong = null; this.startMusic(id); }
    }
    if (this.ctx.state === 'suspended') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  }

  _init(c) {
    this.ctx = c;
    const sr = c.sampleRate;
    // Shared noise.
    this.noiseBuf = c.createBuffer(1, sr * 2, sr);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // A small bright room for reverb.
    const len = Math.floor(sr * 1.5);
    const ir = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * 0.45;
        d[i] = lp * Math.pow(1 - i / len, 2.6) * Math.min(1, i / (sr * 0.004));
      }
    }
    this.master = c.createDynamicsCompressor();
    this.master.threshold.value = -16; this.master.knee.value = 12; this.master.ratio.value = 3.5;
    this.master.attack.value = 0.004; this.master.release.value = 0.18;
    this.master.connect(c.destination);
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const revOut = c.createGain(); revOut.gain.value = 0.9;
    this.reverb.connect(revOut); revOut.connect(this.master);
    const bus = (send) => {
      const g = c.createGain(); g.connect(this.master);
      const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.reverb);
      return g;
    };
    this.sfxBus = bus(0.2); this.musicBus = bus(0.24); this.engBus = bus(0.05);
    // Music sub-mixes.
    this.leadBus = c.createGain(); this.leadBus.gain.value = 1;
    const leadLp = c.createBiquadFilter(); leadLp.type = 'lowpass'; leadLp.frequency.value = 5200;
    this.leadBus.connect(leadLp); leadLp.connect(this.musicBus);
    this.echo = c.createDelay(1.0); this.echoFb = c.createGain(); this.echoFb.gain.value = 0.26;
    const echoSend = c.createGain(); echoSend.gain.value = 0.22;
    const echoLp = c.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2600;
    leadLp.connect(echoSend); echoSend.connect(this.echo); this.echo.connect(echoLp); echoLp.connect(this.echoFb); this.echoFb.connect(this.echo); echoLp.connect(this.musicBus);
    this.compBus = c.createBiquadFilter(); this.compBus.type = 'lowpass'; this.compBus.frequency.value = 3000; this.compBus.connect(this.musicBus);
    this.bassBus = c.createBiquadFilter(); this.bassBus.type = 'lowpass'; this.bassBus.frequency.value = 900; this.bassBus.connect(this.musicBus);
    this.drumBus = c.createGain(); this.drumBus.gain.value = 1; this.drumBus.connect(this.musicBus);
    // Slow vibrato shared by all sustained lead notes.
    this.vib = c.createOscillator(); this.vib.frequency.value = 5.6; this.vibDepth = c.createGain(); this.vibDepth.gain.value = 9;
    this.vib.connect(this.vibDepth); this.vib.start();
    // Engine waveform: many harmonics with scrambled phases sounds rough, not buzzy.
    const rnd = mulberry32(4242), H = 28;
    const re = new Float32Array(H), im = new Float32Array(H);
    for (let n = 1; n < H; n++) {
      const amp = (1 / Math.pow(n, 0.85)) * (n === 2 || n === 4 ? 1.25 : 1) * (n > 12 ? 0.6 : 1);
      const ph = rnd() * 6.283;
      re[n] = amp * Math.cos(ph); im[n] = amp * Math.sin(ph);
    }
    this.engineWave = c.createPeriodicWave(re, im);
    this.applySettings();
  }

  applySettings() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.settings.music ? 0.36 : 0;
    this.sfxBus.gain.value = this.settings.sound ? 0.6 : 0;
    this.engBus.gain.value = this.settings.sound ? 0.6 : 0;
  }

  _noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  // ---- building blocks ----
  // A pitched blip/tone with a pitch slide. Returns nothing; cleans itself up.
  _tone(dest, type, f0, f1, t, dur, vol, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _noise(dest, ftype, f0, f1, t, dur, vol, q = 1, attack = 0.002) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.03);
  }

  // A held note: oscillators (with optional detune), ADSR-ish envelope, optional filter sweep and vibrato.
  _voice(dest, o) {
    const c = this.ctx, t = o.t, g = c.createGain();
    const a = o.attack || 0.008, rel = o.release || 0.08, sus = o.sustain === undefined ? 0.75 : o.sustain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + a);
    g.gain.setTargetAtTime(o.vol * sus, t + a, (o.decay || 0.12) / 3);
    g.gain.setTargetAtTime(0.0001, t + o.dur, rel / 3);
    const end = t + o.dur + rel * 2 + 0.02;
    let head = g;
    if (o.filter) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.filter.q || 1;
      f.frequency.setValueAtTime(o.filter.f0, t);
      f.frequency.exponentialRampToValueAtTime(o.filter.f1, t + (o.filter.time || 0.08));
      if (o.filter.f2) f.frequency.setTargetAtTime(o.filter.f2, t + (o.filter.time || 0.08), 0.12);
      f.connect(g); head = f;
    }
    for (const p of o.parts) {
      const osc = c.createOscillator();
      osc.type = p.type || 'sine';
      osc.frequency.value = o.freq * (p.ratio || 1);
      if (p.detune) osc.detune.value = p.detune;
      if (o.vibrato) this.vibDepth.connect(osc.detune);
      if (p.gain !== undefined && p.gain !== 1) { const pg = c.createGain(); pg.gain.value = p.gain; osc.connect(pg); pg.connect(head); } else osc.connect(head);
      osc.start(t); osc.stop(end);
    }
    g.connect(dest);
  }

  _brass(dest, freq, t, dur, vol) {
    this._voice(dest, { freq, t, dur, vol, attack: 0.03, decay: 0.2, sustain: 0.8, release: 0.12, vibrato: dur > 0.3,
      filter: { f0: 500, f1: 3200, time: 0.06, f2: 1700, q: 1.2 }, parts: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6, gain: 0.8 }] });
  }

  _bell(dest, freq, t, vol, dur = 0.9) {
    this._voice(dest, { freq, t, dur: 0.02, vol, attack: 0.003, decay: 0.05, sustain: 1, release: dur,
      parts: [{ type: 'sine' }, { type: 'sine', ratio: 2.76, gain: 0.32 }, { type: 'sine', ratio: 5.4, gain: 0.1 }] });
  }

  // ---- sound effects ----
  play(name, vol = 1, when = 0) {
    const c = this.ctx;
    if (!c || !this.settings.sound) return;
    if (c.state !== 'running' && !c.startRendering) return;
    const t = (when || c.currentTime) + 0.005, d = this.sfxBus, v = vol;
    const T = (...a) => this._tone(d, ...a), N = (...a) => this._noise(d, ...a);
    switch (name) {
      case 'click': T('sine', 920, 700, t, 0.05, 0.3 * v); N('highpass', 4000, 4000, t, 0.012, 0.12 * v); break;
      case 'back': T('sine', 620, 430, t, 0.07, 0.28 * v); break;
      case 'tick': T('sine', 1500, 1150, t, 0.03, 0.12 * v); break;
      case 'beep': this._bell(d, 660, t, 0.4 * v, 0.35); T('triangle', 330, 330, t, 0.16, 0.2 * v); break;
      case 'go':
        [523, 659, 784, 1047].forEach((f) => this._voice(d, { freq: f, t, dur: 0.35, vol: 0.14 * v, release: 0.3, parts: [{ type: 'triangle' }, { type: 'sine', ratio: 2, gain: 0.3 }] }));
        N('highpass', 5000, 5000, t, 0.5, 0.12 * v); break;
      case 'pickup': [784, 988, 1175, 1568, 1976].forEach((f, i) => this._bell(d, f, t + i * 0.045, 0.2 * v, 0.3)); break;
      case 'itemReady': this._bell(d, 1047, t, 0.3 * v, 0.3); this._bell(d, 1568, t + 0.09, 0.3 * v, 0.5); break;
      case 'boost':
        N('bandpass', 300, 2800, t, 0.8, 0.5 * v, 1.4, 0.05);
        this._voice(d, { freq: 90, t, dur: 0.5, vol: 0.16 * v, attack: 0.05, release: 0.2, filter: { f0: 300, f1: 2400, time: 0.5 }, parts: [{ type: 'sawtooth' }, { type: 'sawtooth', ratio: 1.5, gain: 0.5 }] });
        T('sine', 75, 40, t, 0.28, 0.5 * v); break;
      case 'spin': T('sine', 880, 170, t, 0.8, 0.3 * v); T('sine', 912, 182, t, 0.8, 0.3 * v); N('bandpass', 2100, 1300, t, 0.55, 0.25 * v, 7, 0.02); break;
      case 'splat': N('lowpass', 2600, 220, t, 0.26, 0.7 * v); T('sine', 240, 60, t, 0.22, 0.5 * v); T('sine', 720, 380, t + 0.12, 0.07, 0.2 * v); break;
      case 'bump': T('sine', 140, 50, t, 0.14, 0.7 * v); N('lowpass', 1300, 400, t, 0.05, 0.35 * v); break;
      case 'hop': T('sine', 240, 540, t, 0.1, 0.28 * v); break;
      case 'charge': T('triangle', 1000, 1650, t, 0.08, 0.26 * v); T('sine', 2100, 2100, t + 0.05, 0.06, 0.12 * v); break;
      case 'land': T('sine', 120, 45, t, 0.16, 0.55 * v); N('lowpass', 700, 250, t, 0.08, 0.2 * v); break;
      case 'pop': T('sine', 1250, 240, t, 0.12, 0.45 * v); N('highpass', 2500, 2500, t, 0.06, 0.3 * v); break;
      case 'shield': [523, 659, 784, 1047, 1319].forEach((f, i) => this._bell(d, f, t + i * 0.05, 0.16 * v, 0.6)); break;
      case 'throw': N('highpass', 900, 5200, t, 0.3, 0.32 * v, 1, 0.03); T('sine', 500, 950, t, 0.16, 0.1 * v); break;
      case 'lap': this._bell(d, 784, t, 0.32 * v, 0.3); this._bell(d, 1047, t + 0.11, 0.32 * v, 0.6); break;
      case 'finalLap': [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => this._bell(d, f, t + i * 0.085, 0.24 * v, 0.3)); break;
      case 'win': {
        const seq = [[523, 0, 0.1], [523, 0.13, 0.1], [523, 0.26, 0.1], [659, 0.39, 0.2], [784, 0.62, 0.2], [1047, 0.86, 0.9]];
        for (const [f, at, dur] of seq) this._brass(d, f, t + at, dur, 0.17 * v);
        this._brass(d, 659, t + 0.86, 0.9, 0.1 * v); this._brass(d, 784, t + 0.86, 0.9, 0.1 * v);
        N('highpass', 4500, 4500, t + 0.86, 1.1, 0.14 * v); break;
      }
      case 'finish': [392, 523, 659, 784].forEach((f, i) => this._brass(d, f, t + i * 0.14, i === 3 ? 0.6 : 0.12, 0.15 * v)); break;
      case 'snap': N('highpass', 3000, 6000, t, 0.05, 0.5 * v); T('sine', 1200, 1800, t + 0.03, 0.12, 0.25 * v); break;
      case 'firework':
        T('sine', 115, 42, t, 0.32, 0.6 * v); N('lowpass', 900, 200, t, 0.2, 0.4 * v);
        for (let i = 0; i < 10; i++) N('highpass', 3500, 3500, t + 0.08 + Math.random() * 0.55, 0.03, 0.12 * v);
        break;
      default: break;
    }
  }

  // ---- engines ----
  // karts: the human players' karts. raceState: 'intro' | 'countdown' | 'racing' | 'ending' | 'done' | null
  engine(karts, raceState) {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    while (this.engines.length < karts.length) {
      const n = this.engines.length;
      this.engines.push(new EngineVoice(this, karts.length > 1 ? (n === 0 ? -0.45 : 0.45) : 0));
    }
    this.engines.forEach((e, i) => {
      const k = karts[i];
      if (!k || !raceState || raceState === 'done') { e.silence(now); return; }
      e.wake(now);
      e.set({
        speed: k.speed, gas: clamp(k.gasNow || 0, 0, 1), boost: k.boostT > 0, drift: k.driftDir && k.grounded ? 1 + k.driftLevel : 0,
        moving: raceState === 'racing' || raceState === 'ending', quiet: k.finished,
      }, now);
    });
  }

  // ---- music ----
  startMusic(id) {
    if (!SONGS[id]) id = 'menu';
    if (!this.ctx) { this.pendingSong = id; return; }
    if (this.songId === id && this.timer) return;
    this.stopMusic();
    this.songId = id;
    this.song = this.makeSong(id, this.ctx.currentTime + 0.12);
    this.timer = setInterval(() => this._tick(), 30);
  }

  makeSong(id, startTime) {
    const def = SONGS[id];
    const s = { def, style: STYLES[def.style], ...compile(def), step: 0, next: startTime };
    this.echo.delayTime.value = (60 / def.bpm) * 0.75;
    return s;
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.songId = null;
  }

  _tick() {
    const c = this.ctx, s = this.song;
    if (!c || !s || c.state !== 'running') return;
    if (s.next < c.currentTime - 0.3) s.next = c.currentTime + 0.05; // the tab was asleep
    const sd = 60 / s.def.bpm / 4;
    while (s.next < c.currentTime + 0.15) {
      if (this.settings.music) this.playStep(s, s.step, s.next, sd);
      s.next += sd; s.step++;
    }
  }

  // Schedules everything that starts on one sixteenth-note step.
  playStep(s, step, t, sd) {
    const st = s.style, n = step % s.steps, bar = Math.floor(n / 16), pos = n % 16;
    const chords = s.bars[bar];
    const ch = chords[chords.length > 1 && pos >= 8 ? 1 : 0];
    const third = ch.minor ? 3 : 4, L = st.level;
    const lastBar = bar % 8 === 7;
    const D = this.drumBus;
    // Drums.
    if (st.kick.includes(pos)) { this._tone(D, 'sine', 150, 44, t, 0.2, 0.95 * L); this._noise(D, 'lowpass', 1800, 300, t, 0.02, 0.25 * L); }
    const fill = lastBar && pos >= 12 && st.snare.length;
    if (st.snare.includes(pos) || fill) {
      const sv = (fill ? 0.3 + (pos - 12) * 0.09 : 0.5) * L;
      this._noise(D, 'bandpass', 1900, 1500, t, 0.15, sv, 0.7); this._tone(D, 'triangle', 190, 150, t, 0.08, sv * 0.5);
    }
    if (st.rim && st.rim.includes(pos)) { this._tone(D, 'square', 820, 780, t, 0.025, 0.12 * L); this._noise(D, 'bandpass', 2600, 2600, t, 0.03, 0.14 * L, 3); }
    if (st.hat.includes(pos)) this._noise(D, 'highpass', 7600, 7600, t, pos % 4 === 2 ? 0.07 : 0.035, st.hatVol * (pos % 4 === 2 ? 0.34 : 0.22) * L);
    if (st.shaker) this._noise(D, 'bandpass', 5200, 5200, t, 0.05, (pos % 4 === 0 ? 0.13 : pos % 2 ? 0.05 : 0.09) * L, 1.2, 0.015);
    if (st.conga && st.conga.includes(pos)) this._tone(D, 'sine', pos % 4 === 3 ? 245 : 195, pos % 4 === 3 ? 205 : 165, t, 0.13, 0.4 * L);
    if (st.sleigh && pos % 2 === 0) this._noise(D, 'bandpass', 7800, 7800, t, 0.07, (pos % 4 === 0 ? 0.16 : 0.1) * L, 7);
    if (s.def.style === 'march' && pos === 0 && bar % 4 === 0) this._noise(D, 'highpass', 4200, 4200, t, 1.3, 0.2 * L, 1, 0.01);
    // Bass.
    for (const [bp, iv] of st.bass) {
      if (bp !== pos) continue;
      const m = 36 + (ch.root > 7 ? ch.root - 12 : ch.root) + iv;
      this._voice(this.bassBus, { freq: mtof(m), t, dur: sd * st.bassLen, vol: 0.5 * L, attack: 0.006, decay: 0.1, sustain: 0.7, release: 0.06,
        filter: { f0: 1400, f1: 380, time: 0.09, q: 2 }, parts: [{ type: 'sawtooth' }, { type: 'sine', ratio: 0.5, gain: 0.7 }] });
    }
    // Chords.
    const tri = [60 + ch.root, 60 + ch.root + third, 60 + ch.root + 7].map((m) => (m > 68 ? m - 12 : m));
    const C = this.compBus;
    if (st.comp === 'pad' && (pos === 0 || (chords.length > 1 && pos === 8))) {
      for (const m of tri) this._voice(C, { freq: mtof(m), t, dur: sd * (chords.length > 1 ? 7.5 : 15.5), vol: 0.075 * L, attack: 0.25, sustain: 1, release: 0.4, parts: [{ type: 'triangle', detune: -5 }, { type: 'sawtooth', detune: 6, gain: 0.25 }] });
    } else if (st.comp === 'offbeat' && pos % 4 === 2) {
      for (const m of tri) this._voice(C, { freq: mtof(m + 12), t, dur: sd * 0.9, vol: 0.085 * L, attack: 0.004, decay: 0.08, sustain: 0.3, release: 0.05, parts: [{ type: 'square' }, { type: 'triangle', ratio: 2, gain: 0.3 }] });
    } else if (st.comp === 'strum' && (pos === 0 || pos === 6 || pos === 8 || pos === 14)) {
      tri.forEach((m, i) => this._voice(C, { freq: mtof(m), t: t + i * 0.012, dur: sd * 1.5, vol: 0.1 * L, attack: 0.003, decay: 0.2, sustain: 0.15, release: 0.12,
        filter: { f0: 3500, f1: 900, time: 0.15 }, parts: [{ type: 'sawtooth' }] }));
    } else if (st.comp === 'arp' && pos % 2 === 0) {
      const order = [0, 1, 2, 1, 2, 1, 0, 1];
      this._bell(C, mtof(tri[order[pos / 2]] + 12), t, 0.085 * L, 0.5);
    } else if (st.comp === 'stab' && (pos === 0 || pos === 8)) {
      for (const m of tri) this._brass(C, mtof(m), t, sd * 3, 0.07 * L);
    }
    // Lead melody.
    const ev = s.lead.get(n);
    if (ev) {
      const f = mtof(ev.midi), dur = sd * ev.len * 0.92, long = ev.len >= 4, B = this.leadBus;
      switch (s.def.lead) {
        case 'whistle': this._voice(B, { freq: f, t, dur, vol: 0.2 * L, attack: 0.03, sustain: 0.85, release: 0.1, vibrato: long, parts: [{ type: 'triangle' }, { type: 'sine', ratio: 2, gain: 0.25 }] }); break;
        case 'square': this._voice(B, { freq: f, t, dur, vol: 0.085 * L, attack: 0.006, decay: 0.1, sustain: 0.7, release: 0.07, vibrato: long, parts: [{ type: 'square', detune: -5 }, { type: 'square', detune: 6, gain: 0.7 }, { type: 'triangle', ratio: 2, gain: 0.5 }] }); break;
        case 'trumpet': this._brass(B, f, t, dur, 0.15 * L); break;
        case 'pan': this._voice(B, { freq: f, t, dur: 0.03, vol: 0.3 * L, attack: 0.003, decay: 0.05, sustain: 1, release: Math.min(0.75, 0.3 + sd * ev.len * 0.4),
          parts: [{ type: 'sine' }, { type: 'sine', ratio: 2, gain: 0.5 }, { type: 'sine', ratio: 3.98, gain: 0.18 }] }); break;
        case 'bell': this._bell(B, f, t, 0.26 * L, Math.min(1.3, 0.5 + sd * ev.len * 0.5)); break;
        default: this._brass(B, f, t, dur, 0.16 * L); this._brass(B, f / 2, t, dur, 0.06 * L); break;
      }
    }
  }
}
