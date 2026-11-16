// Party Horn: a shock wave spins nearby karts and pops flying items.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Wave, puff, RAINBOW, canHit } from './common.js';

addStrings({ en: { items: { horn: 'Party Horn' } }, nl: { items: { horn: 'Feesttoeter' } } });

const R = 12;

registerItem({
  id: 'horn',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M6 52L40 22l8 10z" fill="#ffd21f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M14 45l6 8M24 36l6 8M33 28l6 8" stroke="#ff4b4b" stroke-width="5" stroke-linecap="round"/><path d="M40 22l10 12" stroke="#2a2433" stroke-width="3"/><ellipse cx="45" cy="28" rx="6" ry="11" transform="rotate(-40 45 28)" fill="#ff7ac0" stroke="#2a2433" stroke-width="3"/><path d="M52 12l2 6M58 22l-6 1M60 34l-6-3" stroke="#4fb8ff" stroke-width="4" stroke-linecap="round"/><circle cx="56" cy="8" r="3" fill="#ffe14a"/><circle cx="62" cy="26" r="2.5" fill="#5fe06a"/><rect x="46" y="4" width="6" height="3" fill="#b46bff" transform="rotate(30 49 5)"/></svg>',
  weight: (k, f) => 0.8 + 0.5 * f,
  use(sys, kart) {
    const race = sys.race, P = race.particles;
    sys.add(new Wave(sys, kart.x, kart.y, kart.z, [0xff4b4b, 0xffe14a, 0x4fb8ff], R + 1, 0.55, 0.14));
    P.burst(false, RAINBOW, 50, kart.x, kart.y + 1.5, kart.z, 12, { size: 0.5, life: 1.5, gravity: 6, drag: 1, sphere: true });
    puff(sys, RAINBOW, 20, kart.x, kart.y + 1.5, kart.z, 9, { sphere: true });
    race.sfx('item-horn', kart);
    sys.hitKartsNear(kart.x, kart.y, kart.z, R, kart, { cause: 'horn', ky: 1, dy: 4 });
    // Pop flying things: our own projectiles (they know how) and the paper plane.
    for (const th of sys.things) {
      if (!th.projectile && th.kind !== 'plane') continue;
      if (th.owner === kart) continue;
      const p = th.pos || (th.mesh && th.mesh.position);
      if (!p || Math.hypot(p.x - kart.x, p.z - kart.z) > R + 3) continue;
      puff(sys, RAINBOW, 14, p.x, p.y, p.z, 6);
      if (th.pop) th.pop(sys); else th.life = 0;
    }
  },
  aiWants: (k, ctx) => ctx.race.karts.some((o) => canHit(o, k) && Math.hypot(o.x - k.x, o.z - k.z) < R - 2) || ctx.hold > 10,
});
