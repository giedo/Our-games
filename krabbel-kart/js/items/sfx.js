// Sounds of the new items (all prefixed item-). Registered once, played with race.sfx(name, kart).
import { registerSfx } from '../audio.js';

const S = (name, fn) => registerSfx('item-' + name, fn);
const T = (a, d, ...r) => a._tone(d, ...r);
const N = (a, d, ...r) => a._noise(d, ...r);

// Gold star pick-up: a bell that climbs with the number of stars.
for (let i = 0; i < 10; i++) {
  S('starPick' + i, (a, t, v, d) => { const f = 880 * Math.pow(2, (i / 12) * 1.5); a._bell(d, f, t, 0.22 * v, 0.35); a._bell(d, f * 1.5, t + 0.05, 0.14 * v, 0.3); });
}
S('rainbow', (a, t, v, d) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => a._bell(d, f, t + i * 0.06, 0.2 * v, 0.5)); N(a, d, 'highpass', 4000, 7000, t, 0.5, 0.12 * v); });
S('rocket', (a, t, v, d) => { N(a, d, 'bandpass', 400, 3200, t, 1.1, 0.5 * v, 1.2, 0.1); T(a, d, 'sawtooth', 90, 260, t, 0.7, 0.18 * v); T(a, d, 'sine', 60, 40, t, 0.3, 0.5 * v); });
S('spring', (a, t, v, d) => { T(a, d, 'sine', 160, 700, t, 0.22, 0.4 * v); T(a, d, 'triangle', 700, 300, t + 0.2, 0.3, 0.25 * v); T(a, d, 'sine', 330, 930, t + 0.03, 0.15, 0.2 * v); });
S('bounce', (a, t, v, d) => { T(a, d, 'sine', 300, 520, t, 0.09, 0.35 * v); T(a, d, 'triangle', 600, 900, t, 0.05, 0.1 * v); });
S('comet', (a, t, v, d) => { T(a, d, 'sine', 2200, 700, t, 0.7, 0.2 * v); N(a, d, 'highpass', 3000, 6000, t, 0.4, 0.18 * v); });
S('cometHit', (a, t, v, d) => { T(a, d, 'sine', 140, 40, t, 0.5, 0.8 * v); N(a, d, 'lowpass', 3000, 200, t, 0.5, 0.6 * v); [1568, 1976, 2349].forEach((f, i) => a._bell(d, f, t + i * 0.04, 0.12 * v, 0.5)); });
S('glitter', (a, t, v, d) => { T(a, d, 'sine', 110, 40, t, 0.4, 0.7 * v); N(a, d, 'lowpass', 2200, 300, t, 0.3, 0.5 * v); for (let i = 0; i < 9; i++) a._bell(d, 1500 + Math.random() * 2500, t + 0.05 + i * 0.05, 0.1 * v, 0.4); });
S('stamp', (a, t, v, d) => { T(a, d, 'sine', 200, 50, t, 0.2, 0.7 * v); N(a, d, 'lowpass', 1500, 200, t, 0.1, 0.4 * v); T(a, d, 'sine', 1200, 500, t + 0.12, 0.35, 0.2 * v); T(a, d, 'sine', 1500, 650, t + 0.15, 0.35, 0.15 * v); });
S('giant', (a, t, v, d) => { T(a, d, 'sine', 300, 150, t, 0.12, 0.35 * v); T(a, d, 'sine', 240, 120, t + 0.14, 0.12, 0.35 * v); T(a, d, 'sawtooth', 70, 45, t + 0.3, 0.7, 0.25 * v); T(a, d, 'sine', 50, 35, t + 0.3, 0.7, 0.5 * v); });
S('gold', (a, t, v, d) => { [784, 988, 1175, 1568].forEach((f, i) => a._bell(d, f, t + i * 0.05, 0.22 * v, 0.7)); N(a, d, 'highpass', 5000, 5000, t, 0.4, 0.1 * v); });
S('ink', (a, t, v, d) => { N(a, d, 'lowpass', 1800, 150, t, 0.35, 0.7 * v); T(a, d, 'sine', 200, 70, t, 0.3, 0.5 * v); T(a, d, 'sine', 500, 160, t + 0.1, 0.2, 0.2 * v); });
S('ghost', (a, t, v, d) => { T(a, d, 'sine', 620, 300, t, 0.6, 0.28 * v); T(a, d, 'sine', 640, 310, t, 0.6, 0.28 * v); T(a, d, 'triangle', 1200, 500, t + 0.15, 0.4, 0.08 * v); });
S('zap', (a, t, v, d) => { T(a, d, 'square', 1500, 2400, t, 0.06, 0.12 * v); N(a, d, 'highpass', 5000, 8000, t, 0.08, 0.2 * v); });
S('ice', (a, t, v, d) => { N(a, d, 'highpass', 3500, 9000, t, 0.15, 0.4 * v); T(a, d, 'sine', 2400, 1800, t, 0.25, 0.2 * v); T(a, d, 'sine', 3100, 2300, t + 0.04, 0.3, 0.12 * v); });
S('shatter', (a, t, v, d) => { N(a, d, 'highpass', 2500, 6000, t, 0.3, 0.5 * v); for (let i = 0; i < 6; i++) a._bell(d, 2000 + Math.random() * 3000, t + i * 0.03, 0.1 * v, 0.3); });
S('whirr', (a, t, v, d) => { T(a, d, 'sawtooth', 300, 500, t, 0.5, 0.08 * v); N(a, d, 'bandpass', 800, 1800, t, 0.5, 0.25 * v, 3, 0.05); });
S('catch', (a, t, v, d) => { T(a, d, 'sine', 700, 1100, t, 0.1, 0.3 * v); a._bell(d, 1568, t + 0.05, 0.15 * v, 0.3); });
S('horn', (a, t, v, d) => { a._brass(d, 330, t, 0.35, 0.22 * v); a._brass(d, 415, t, 0.35, 0.18 * v); a._brass(d, 494, t + 0.02, 0.35, 0.14 * v); N(a, d, 'highpass', 4500, 4500, t + 0.3, 0.5, 0.15 * v); });
S('magnet', (a, t, v, d) => { T(a, d, 'sine', 300, 900, t, 0.35, 0.3 * v); T(a, d, 'sine', 150, 450, t, 0.35, 0.2 * v); a._bell(d, 1319, t + 0.3, 0.18 * v, 0.4); });
S('wobble', (a, t, v, d) => { for (let i = 0; i < 6; i++) T(a, d, 'sine', 500 + (i % 2) * 280, 450 + (i % 2) * 300, t + i * 0.07, 0.09, 0.22 * v); a._bell(d, 1568, t + 0.45, 0.14 * v, 0.5); });
S('whoosh', (a, t, v, d) => { N(a, d, 'bandpass', 500, 2500, t, 0.3, 0.3 * v, 1.2, 0.05); });
