// Rainbow Marker: 8 s rainbow glow (the kart does the rest) and a marker line drawn on the road behind you.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { RAINBOW, puff } from './common.js';

addStrings({ en: { items: { star: 'Rainbow Marker' } }, nl: { items: { star: 'Regenboogstift' } } });

class Scribble {
  constructor(kart) { this.kart = kart; this.i = 0; this.acc = 0; }

  update(dt, sys) {
    const k = this.kart;
    if (!k.fx.star || k.out) return false;
    this.acc += dt;
    if (this.acc < 0.03) return true;
    this.acc = 0;
    const fx = Math.sin(k.dir), fz = Math.cos(k.dir), P = sys.race.particles;
    this.i++;
    // Three marker lines side by side, each its own colour, left on the ground.
    for (let j = -1; j <= 1; j++) {
      P.emit(false, RAINBOW[(this.i + j * 2 + 12) % 6], { x: k.x - fx * 1.6 - fz * j * 0.7, y: k.y + 0.18, z: k.z - fz * 1.6 + fx * j * 0.7, life: 1.3, size: 0.75, size1: 0.6, a: 0.95 });
    }
    return true;
  }
}

registerItem({
  id: 'star',
  icon: '<svg viewBox="0 0 64 64"><path d="M4 44c8-18 20-18 28-4s20 10 28-8" fill="none" stroke="#2a2433" stroke-width="11" stroke-linecap="round"/><path d="M4 44c8-18 20-18 28-4s20 10 28-8" fill="none" stroke="#ff4b4b" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 100"/><path d="M4 44c8-18 20-18 28-4s20 10 28-8" fill="none" stroke="#ffd21f" stroke-width="5" stroke-linecap="round" stroke-dasharray="18 100" stroke-dashoffset="-14"/><path d="M4 44c8-18 20-18 28-4s20 10 28-8" fill="none" stroke="#5fe06a" stroke-width="5" stroke-linecap="round" stroke-dasharray="18 100" stroke-dashoffset="-32"/><path d="M4 44c8-18 20-18 28-4s20 10 28-8" fill="none" stroke="#4fb8ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="30 100" stroke-dashoffset="-50"/><g stroke="#2a2433" stroke-width="3" stroke-linejoin="round" transform="rotate(35 44 20)"><rect x="38" y="4" width="12" height="26" rx="3" fill="#b46bff"/><rect x="38" y="4" width="12" height="9" rx="3" fill="#ff7ac0"/><path d="M38 30h12l-3 9h-6z" fill="#f2c79a"/></g></svg>',
  weight: (k, f) => 0.3 + 2.4 * f,
  use(sys, kart) {
    kart.addFx('star', 8);
    sys.race.sfx('item-rainbow', kart);
    puff(sys, RAINBOW, 30, kart.x, kart.y + 1.2, kart.z, 9, { size: 0.6, sphere: true });
    sys.add(new Scribble(kart));
  },
  aiWants: () => true,
});
