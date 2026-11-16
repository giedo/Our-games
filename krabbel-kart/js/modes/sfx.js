// Sounds of the race modes (knockout, time trial, explore). Names start with "mode-".
import { registerSfx } from '../audio.js';

// Rising tension: a woodblock tick, two pitches.
registerSfx('mode-tick', (a, t, v, d) => { a._tone(d, 'square', 520, 480, t, 0.07, 0.16 * v); });
registerSfx('mode-tick2', (a, t, v, d) => { a._tone(d, 'square', 780, 700, t, 0.07, 0.2 * v); });
// A gate is passed: soft whoosh and two bells.
registerSfx('mode-gate', (a, t, v, d) => { a._noise(d, 'bandpass', 600, 2400, t, 0.35, 0.3 * v, 1.2, 0.05); a._bell(d, 880, t + 0.05, 0.22 * v, 0.4); a._bell(d, 1320, t + 0.14, 0.22 * v, 0.5); });
// Out: a sad little slide.
registerSfx('mode-out', (a, t, v, d) => { a._tone(d, 'triangle', 520, 150, t, 0.7, 0.3 * v); a._tone(d, 'triangle', 392, 110, t + 0.12, 0.7, 0.22 * v); });
registerSfx('mode-puff', (a, t, v, d) => { a._noise(d, 'highpass', 3000, 6000, t, 0.12, 0.3 * v); a._tone(d, 'sine', 900, 1500, t + 0.02, 0.1, 0.15 * v); });
// A sticker found: a cheerful run up.
registerSfx('mode-sticker', (a, t, v, d) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => a._bell(d, f, t + i * 0.06, 0.24 * v, 0.5)); a._tone(d, 'sine', 300, 600, t, 0.2, 0.2 * v); });
registerSfx('mode-allfound', (a, t, v, d) => {
  [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => a._bell(d, f, t + i * 0.09, 0.26 * v, 0.9));
  [523, 659, 784].forEach((f) => a._brass(d, f, t + 0.7, 0.9, 0.12 * v));
  a._noise(d, 'highpass', 4500, 4500, t + 0.7, 1, 0.14 * v);
});
registerSfx('mode-record', (a, t, v, d) => {
  [659, 784, 1047, 1319].forEach((f, i) => a._brass(d, f, t + i * 0.1, i === 3 ? 0.8 : 0.1, 0.14 * v));
  [1568, 1976, 2349].forEach((f, i) => a._bell(d, f, t + 0.45 + i * 0.08, 0.2 * v, 0.7));
});
registerSfx('mode-split', (a, t, v, d) => { a._bell(d, 988, t, 0.26 * v, 0.35); a._bell(d, 1319, t + 0.09, 0.26 * v, 0.55); });
