// Crayon Pack: three turbo boosts.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { RAINBOW, puff } from './common.js';

addStrings({ en: { items: { turbo3: 'Crayon Pack' } }, nl: { items: { turbo3: 'Krijtjesdoos' } } });

const crayon = (rot, body, tip) => `<g transform="rotate(${rot} 32 58)"><path d="M26 22h12v32a2 2 0 0 1-2 2H28a2 2 0 0 1-2-2z" fill="${body}"/><path d="M26 22l6-15 6 15z" fill="${tip}"/><path d="M26 30h12v8H26z" fill="#fffaf0"/></g>`;

registerItem({
  id: 'turbo3',
  icon: `<svg viewBox="0 0 64 64"><g stroke="#2a2433" stroke-width="3" stroke-linejoin="round">${crayon(-36, '#ff4b4b', '#c93636')}${crayon(36, '#4fb8ff', '#2f8fd6')}${crayon(0, '#ffd21f', '#d6a600')}</g></svg>`,
  weight: (k, f) => 1 + 2.5 * f,
  uses: 3,
  use(sys, kart) {
    const n = kart.itemUses; // uses left after this press (the system counted it down already)
    kart.boost(1.3, 1.4);
    sys.race.sfx('boost', kart);
    const fx = Math.sin(kart.dir), fz = Math.cos(kart.dir);
    puff(sys, [RAINBOW[(n * 2) % 6], RAINBOW[(n * 2 + 1) % 6], 0xffffff], 14, kart.x - fx * 1.6, kart.y + 0.7, kart.z - fz * 1.6, 7, { size: 0.55 });
  },
  aiWants: (k, ctx) => k.boostT <= 0.2 && (ctx.kmax < 0.012 || ctx.hold > 4),
});
