// Keyboard, gamepad and touch input, merged into one simple control state per player.
import { clamp } from './util.js';

const KEYS_SOLO = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], gas: ['ArrowUp', 'KeyW'], brake: ['ArrowDown', 'KeyS'],
  drift: ['Space'], item: ['ShiftLeft', 'ShiftRight', 'KeyE', 'KeyX', 'Enter'],
};
const KEYS_P1 = {
  left: ['KeyA'], right: ['KeyD'], gas: ['KeyW'], brake: ['KeyS'], drift: ['ShiftLeft', 'Space'], item: ['KeyE', 'KeyQ'],
};
const KEYS_P2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], gas: ['ArrowUp'], brake: ['ArrowDown'], drift: ['Slash', 'ShiftRight', 'Numpad0'], item: ['Enter', 'Period', 'NumpadEnter'],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.touch = [{}, {}];
    this.device = ['keys', 'keys']; // last device used per player
    this.steer = [0, 0];
    this.prevItem = [false, false];
    this.anyKeyListeners = [];
    this.hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touchMode = this.hasTouch && !matchMedia('(pointer: fine)').matches;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.down.has(e.code)) {
        this.down.add(e.code);
        for (const f of this.anyKeyListeners) f(e.code);
      }
      this.touchMode = false;
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('touchstart', () => { this.touchMode = true; }, { passive: true });
  }

  onAnyKey(f) { this.anyKeyListeners.push(f); }

  setTouch(player, name, on) {
    this.touch[player][name] = on;
    this.device[player] = 'touch';
  }

  clearTouch() { this.touch = [{}, {}]; }

  _key(map, name) {
    for (const k of map[name]) if (this.down.has(k)) return true;
    return false;
  }

  _pad(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (n === index) return p;
      n++;
    }
    return null;
  }

  // Returns { steer, gas, brake, drift, item (true only on the press), any }
  read(player, numPlayers, dt) {
    const map = numPlayers === 1 ? KEYS_SOLO : player === 0 ? KEYS_P1 : KEYS_P2;
    let left = this._key(map, 'left'), right = this._key(map, 'right');
    let gas = this._key(map, 'gas') ? 1 : 0, brake = this._key(map, 'brake') ? 1 : 0;
    let drift = this._key(map, 'drift'), item = this._key(map, 'item');
    if (left || right || gas || brake || drift || item) this.device[player] = 'keys';
    let analog = 0;
    const pad = this._pad(player);
    if (pad) {
      const b = (i) => pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4);
      const ax = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0;
      if (ax) analog = ax;
      if (b(14)) left = true;
      if (b(15)) right = true;
      const g = Math.max(b(0) ? 1 : 0, pad.buttons[7] ? pad.buttons[7].value : 0);
      const br = Math.max(b(1) ? 1 : 0, pad.buttons[6] ? pad.buttons[6].value : 0);
      if (g > 0.1 || br > 0.1 || ax || b(14) || b(15) || b(2) || b(3) || b(4) || b(5)) this.device[player] = 'pad';
      gas = Math.max(gas, g); brake = Math.max(brake, br);
      if (b(4) || b(5)) drift = true;
      if (b(2) || b(3)) item = true;
    }
    const t = this.touch[player];
    if (t.steer !== undefined && t.steer !== 0) analog = t.steer;
    if (t.brake) brake = 1;
    if (t.drift) drift = true;
    if (t.item) item = true;
    if (this.device[player] === 'touch') gas = brake ? 0 : 1; // touch players accelerate automatically
    // Smooth digital steering so taps give small corrections and holds give full lock.
    const target = analog || (right ? 1 : 0) - (left ? 1 : 0);
    const rate = analog ? 14 : target === 0 ? 9 : 6;
    const s = this.steer[player];
    this.steer[player] = Math.abs(target - s) < rate * dt ? target : s + Math.sign(target - s) * rate * dt;
    const pressed = item && !this.prevItem[player];
    this.prevItem[player] = item;
    return { steer: clamp(this.steer[player], -1, 1), gas, brake, drift, item: pressed, any: left || right || gas || brake || drift || item };
  }

  // True once when a "confirm" style button is pressed (used to skip intros).
  padConfirm() {
    const pad = this._pad(0);
    return !!(pad && pad.buttons[0] && pad.buttons[0].pressed);
  }
}
