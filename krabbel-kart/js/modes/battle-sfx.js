// Sounds of the battle modes (prefix battle-), registered into the audio engine.
import { registerSfx } from '../audio.js';

registerSfx('battle-pop', (a, t, v, d) => {
  a._noise(d, 'highpass', 3000, 3000, t, 0.07, 0.55 * v);
  a._tone(d, 'sine', 1500, 180, t, 0.13, 0.5 * v);
  a._tone(d, 'triangle', 600, 120, t, 0.09, 0.3 * v);
});
registerSfx('battle-point', (a, t, v, d) => { [880, 1175, 1568].forEach((f, i) => a._bell(d, f, t + i * 0.06, 0.2 * v, 0.3)); });
registerSfx('battle-star', (a, t, v, d) => { a._bell(d, 1319, t, 0.24 * v, 0.3); a._bell(d, 1760, t + 0.06, 0.22 * v, 0.4); a._bell(d, 2349, t + 0.12, 0.14 * v, 0.5); });
registerSfx('battle-drop', (a, t, v, d) => { [1568, 1175, 988, 784].forEach((f, i) => a._bell(d, f, t + i * 0.05, 0.16 * v, 0.25)); });
registerSfx('battle-respawn', (a, t, v, d) => {
  a._noise(d, 'bandpass', 400, 2600, t, 0.35, 0.35 * v, 1.2, 0.05);
  a._tone(d, 'sine', 300, 900, t, 0.3, 0.3 * v);
  a._bell(d, 1047, t + 0.32, 0.25 * v, 0.4);
});
registerSfx('battle-grab', (a, t, v, d) => { [523, 659, 784, 1047].forEach((f, i) => a._brass(d, f, t + i * 0.07, 0.12, 0.13 * v)); });
registerSfx('battle-flagdrop', (a, t, v, d) => { a._tone(d, 'triangle', 700, 200, t, 0.35, 0.3 * v); a._noise(d, 'lowpass', 1500, 300, t, 0.12, 0.3 * v); });
registerSfx('battle-return', (a, t, v, d) => { a._noise(d, 'bandpass', 2400, 500, t, 0.3, 0.3 * v, 1.5, 0.03); a._bell(d, 784, t + 0.2, 0.22 * v, 0.4); });
registerSfx('battle-score', (a, t, v, d) => {
  [523, 659, 784, 1047, 1319].forEach((f, i) => a._brass(d, f, t + i * 0.09, i === 4 ? 0.5 : 0.1, 0.16 * v));
  a._noise(d, 'highpass', 4500, 4500, t + 0.4, 0.6, 0.12 * v);
});
registerSfx('battle-end', (a, t, v, d) => { a._brass(d, 392, t, 0.25, 0.18 * v); a._brass(d, 392, t + 0.3, 0.6, 0.18 * v); a._brass(d, 262, t + 0.3, 0.6, 0.12 * v); });
