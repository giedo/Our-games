// Ink Blot: ink splashes over the screens of everyone ahead for 4 s. Computer racers wobble.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Wave, isArena, canHit, hudOf } from './common.js';

addStrings({ en: { items: { ink: 'Ink Blot' } }, nl: { items: { ink: 'Inktvlek' } } });

const BLOT = 'M50 6c10 2 14 12 24 14 14 3 22 14 18 28-3 10 3 16-4 26-6 8-16 6-24 12-10 6-18 8-28 2-8-5-10-12-18-16C6 66 2 56 8 44c4-8 2-16 10-24 8-8 20-4 26-12 2-2 4-2 6-2z';
const SPOTS = [[4, 14, 20, 0], [74, 12, 22, 1], [22, 46, 18, 2], [66, 50, 20, 3], [2, 64, 18, 4], [78, 68, 16, 5]]; // left %, top %, size %, order

// The blots on one player's screen (a div inside the HUD), fading out at the end.
class Blots {
  constructor(hud, dur) {
    this.hud = hud; this.t = dur; this.dur = dur;
    const root = this.root = document.createElement('div');
    root.className = 'ink-blots';
    root.innerHTML = SPOTS.map(([l, tp, s, i]) => `<svg viewBox="0 0 100 100" style="left:${l}%;top:${tp}%;width:${s}%;animation-delay:${i * 0.07}s;transform:rotate(${i * 61}deg)"><path d="${BLOT}" fill="#1d1a3a" stroke="#2a2433" stroke-width="3"/><ellipse cx="34" cy="30" rx="10" ry="5" fill="#6c6ad6" opacity=".55" transform="rotate(-30 34 30)"/><path d="M40 88v10M60 86v8" stroke="#1d1a3a" stroke-width="7" stroke-linecap="round"/></svg>`).join('');
    hud.el.appendChild(root);
  }

  update(dt) {
    this.t -= dt;
    if (this.t < 1) this.root.style.opacity = String(Math.max(0, this.t));
    return this.t > 0;
  }

  dispose() { this.root.remove(); }
}

registerItem({
  id: 'ink',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M30 4c6 1 8 7 14 8 8 2 13 9 11 17-2 6 2 10-2 16-4 5-10 4-14 8-6 4-11 5-17 1-5-3-6-8-11-10C3 41 1 35 5 28c3-5 1-10 6-15 5-5 12-2 16-7 1-2 2-2 3-2z" transform="translate(2 4)" fill="#3a3680" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><ellipse cx="22" cy="22" rx="7" ry="4" fill="#9a98ff" transform="rotate(-30 22 22)"/><path d="M26 52v8M40 50v6" stroke="#2a2433" stroke-width="9" stroke-linecap="round"/><path d="M26 52v8M40 50v6" stroke="#3a3680" stroke-width="4" stroke-linecap="round"/><circle cx="54" cy="12" r="4" fill="#3a3680" stroke="#2a2433" stroke-width="2.5"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0 : 0.3 + 1.8 * f),
  use(sys, kart) {
    const race = sys.race, arena = isArena(sys);
    sys.add(new Wave(sys, kart.x, kart.y, kart.z, [0x3a3680, 0x6c6ad6], 60, 0.7));
    sys.race.particles.burst(false, [0x1d1a3a, 0x3a3680], 24, kart.x, kart.y + 1.2, kart.z, 8, { size: 0.9, life: 0.8, gravity: 10 });
    race.sfx('item-ink', kart);
    for (const k of race.karts) {
      if (k === kart || k.out || k.finished) continue;
      if (!arena && k.place >= kart.place) continue; // only those ahead
      const h = hudOf(sys, k);
      if (h) { sys.add(new Blots(h, 4)); race.sfx('item-ink', k); }
      else k.addFx('slip', 1.3);
      sys.race.particles.burst(false, [0x1d1a3a, 0x3a3680], 14, k.x, k.y + 1.2, k.z, 6, { size: 0.8, life: 0.6, gravity: 10 });
    }
  },
  aiWants: (k) => k.place > 1,
});
