// Grand Prix: a series of races with points and a podium. The series itself (standings,
// next race, podium) is run by main.js with the cups in js/cups.js; every race of it is a
// normal 'race' mode race. This class only describes the card on the mode picker.
import { Mode } from './base.js';
import { addStrings } from '../i18n.js';

addStrings({
  en: { modes: { cup: 'Grand Prix' }, modeSub: { cup: 'Pick a cup: 3 races, points, a podium' } },
  nl: { modes: { cup: 'Grote Prijs' }, modeSub: { cup: 'Kies een beker: 3 races, punten, een podium' } },
});

export class CupMode extends Mode {
  static options(settings) { return []; }
}

Object.assign(CupMode, {
  id: 'cup',
  series: true,
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8h24v18a12 12 0 01-24 0z" fill="#ffd21f"/><path d="M20 14h-9v5a9 9 0 009 9M44 14h9v5a9 9 0 01-9 9" fill="none"/><path d="M32 38v10" /><path d="M22 56h20l-3-8H25z" fill="#ff7ac0"/><path d="M28 16l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#fff" stroke-width="2.5"/></svg>',
});

export default CupMode;
