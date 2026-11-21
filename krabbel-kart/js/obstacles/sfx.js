// Sounds of the road obstacles (registered once, played with race.sfx or sys.ambient).
import { registerSfx } from '../audio.js';

registerSfx('obs-boing', (a, t, v, d) => {
  a._tone(d, 'sine', 170, 560, t, 0.3, 0.42 * v);
  a._tone(d, 'triangle', 340, 1000, t, 0.22, 0.14 * v);
  a._tone(d, 'sine', 520, 300, t + 0.2, 0.3, 0.18 * v);
});
registerSfx('obs-squeak', (a, t, v, d) => {
  a._tone(d, 'sawtooth', 760, 480, t, 0.09, 0.16 * v);
  a._tone(d, 'sawtooth', 700, 440, t + 0.11, 0.13, 0.15 * v);
});
registerSfx('obs-thud', (a, t, v, d) => {
  a._tone(d, 'sine', 130, 45, t, 0.2, 0.6 * v);
  a._noise(d, 'lowpass', 900, 200, t, 0.12, 0.3 * v);
});
registerSfx('obs-pop', (a, t, v, d) => {
  a._tone(d, 'sine', 300, 1100, t, 0.1, 0.4 * v);
  a._noise(d, 'highpass', 3000, 5000, t, 0.06, 0.18 * v);
});
registerSfx('obs-whoosh', (a, t, v, d) => {
  a._noise(d, 'bandpass', 400, 1800, t, 0.4, 0.4 * v, 0.8, 0.08);
});
registerSfx('obs-honk', (a, t, v, d) => {
  a._tone(d, 'square', 330, 320, t, 0.18, 0.12 * v);
  a._tone(d, 'square', 415, 405, t, 0.18, 0.1 * v);
});
// Crash into an obstacle: a bang, a rattle of bits, then a dizzy "tweet-tweet" while the kart turns round.
registerSfx('crash', (a, t, v, d) => {
  a._noise(d, 'lowpass', 2400, 180, t, 0.28, 0.55 * v);
  a._tone(d, 'sine', 160, 40, t, 0.3, 0.7 * v);
  a._tone(d, 'square', 520, 180, t + 0.02, 0.12, 0.08 * v);
  a._noise(d, 'highpass', 4000, 6000, t + 0.08, 0.18, 0.16 * v);
  for (let i = 0; i < 3; i++) {
    a._tone(d, 'sine', 1900, 2500, t + 0.35 + i * 0.22, 0.08, 0.12 * v);
    a._tone(d, 'sine', 2500, 1700, t + 0.45 + i * 0.22, 0.09, 0.1 * v);
  }
});
