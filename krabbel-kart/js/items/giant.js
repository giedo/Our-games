// Giant Juice: grow huge for 8 s, flatten karts you touch (the kart code does the growing).
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { puff } from './common.js';

addStrings({ en: { items: { giant: 'Giant Juice' } }, nl: { items: { giant: 'Reuzensap' } } });

const JUICE = [0x7be04a, 0xc8ff7a, 0xffffff];

// Fizzing bubbles round the giant and dust under its feet.
class Fizz {
  constructor(kart) { this.kart = kart; this.acc = 0; }

  update(dt, sys) {
    const k = this.kart;
    if (!k.fx.giant || k.out) { if (!k.out) puff(sys, JUICE, 18, k.x, k.y + 1, k.z, 6); return false; }
    this.acc += dt;
    if (this.acc < 0.04) return true;
    this.acc = 0;
    const P = sys.race.particles, a = Math.random() * 6.283;
    P.emit(true, JUICE[Math.floor(Math.random() * 3)], { x: k.x + Math.cos(a) * 1.8, y: k.y + 0.4 + Math.random() * 2.2, z: k.z + Math.sin(a) * 1.8, vy: 2.5, life: 0.7, size: 0.65, size1: 0.2, a: 0.9 });
    if (k.grounded && Math.random() < 0.3) P.emit(false, sys.world.dustColor, { x: k.x - Math.sin(k.dir) * 2, y: k.y + 0.2, z: k.z - Math.cos(k.dir) * 2, vy: 1, life: 0.6, size: 1, size1: 2.4, a: 0.35 });
    return true;
  }
}

registerItem({
  id: 'giant',
  icon: '<svg viewBox="0 0 64 64"><path d="M25 4h14v7l-2 3v6c8 3 13 10 13 19v14a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V39c0-9 5-16 13-19v-6l-2-3z" fill="#fff" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M16 38c8-4 24 4 32 0v15a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z" fill="#7be04a"/><path d="M14 39c0-9 5-16 13-19h10c8 3 13 10 13 19" fill="none" stroke="#2a2433" stroke-width="3"/><rect x="24" y="2" width="16" height="7" rx="2" fill="#c98b4a" stroke="#2a2433" stroke-width="3"/><circle cx="26" cy="46" r="3" fill="#fff"/><circle cx="38" cy="50" r="2" fill="#fff"/><path d="M32 22V30M28 26l4-5 4 5" stroke="#2a2433" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -2)"/></svg>',
  weight: (k, f) => 0.5 + 2 * f,
  use(sys, kart) {
    kart.addFx('giant', 8);
    sys.race.sfx('item-giant', kart);
    puff(sys, JUICE, 36, kart.x, kart.y + 1, kart.z, 10, { size: 0.7, sphere: true });
    sys.add(new Fizz(kart));
  },
  aiWants: () => true,
});
