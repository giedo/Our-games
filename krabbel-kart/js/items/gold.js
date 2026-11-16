// Golden Crayon: boost as often as you like for 7 s.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { puff } from './common.js';

addStrings({ en: { items: { gold: 'Golden Crayon' } }, nl: { items: { gold: 'Gouden krijtje' } } });

const GOLD = [0xffe14a, 0xffc21f, 0xfff3a0, 0xffffff];

// Golden glitter streams from the kart while the crayon is held.
class Shine {
  constructor(kart) { this.kart = kart; this.acc = 0; kart.__gold = this; }

  update(dt, sys) {
    const k = this.kart;
    if (k.item !== 'gold' || !(k.itemT > 0) || k.out) { k.__gold = null; return false; }
    this.acc += dt;
    if (this.acc < 0.035) return true;
    this.acc = 0;
    const fx = Math.sin(k.dir), fz = Math.cos(k.dir), P = sys.race.particles, n = k.boostT > 0 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      P.emit(true, GOLD[Math.floor(Math.random() * 4)], { x: k.x - fx * 1.5 + (Math.random() - 0.5) * 1.6, y: k.y + 0.4 + Math.random() * 1.4, z: k.z - fz * 1.5 + (Math.random() - 0.5) * 1.6, vx: -fx * 3, vz: -fz * 3, vy: 1, life: 0.6, size: 0.5, size1: 0.05, a: 0.95 });
    }
    return true;
  }
}

registerItem({
  id: 'gold',
  ages: ['big'],
  held: 7,
  icon: '<svg viewBox="0 0 64 64"><path d="M32 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" fill="#fff" stroke="#2a2433" stroke-width="2" stroke-linejoin="round" transform="translate(16 -2) scale(.7)"/><g transform="rotate(35 32 36)" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"><path d="M21 22h22v32a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3z" fill="#ffc21f"/><path d="M21 22l11-18 11 18z" fill="#fff3a0"/><path d="M21 31h22v10H21z" fill="#fffaf0"/><path d="M26 22v32" stroke="#fff" stroke-width="3" opacity=".6"/></g><path d="M8 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM52 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#ffe14a" stroke="#2a2433" stroke-width="2" stroke-linejoin="round"/></svg>',
  weight: (k, f) => 0.15 + 1.6 * f,
  use(sys, kart) {
    kart.boost(1.1, 1.45);
    sys.race.sfx('item-gold', kart);
    puff(sys, GOLD, 16, kart.x - Math.sin(kart.dir) * 1.5, kart.y + 0.8, kart.z - Math.cos(kart.dir) * 1.5, 8);
    if (!kart.__gold) sys.add(new Shine(kart));
  },
  aiWants: (k) => k.boostT < 0.3,
});
