// The classic race: eight karts, a few laps, first one home wins.
import { Mode } from './base.js';
import { addStrings, t } from '../i18n.js';

addStrings({
  en: { modes: { race: 'Race' }, modeSub: { race: 'Pick a track and go' } },
  nl: { modes: { race: 'Race' }, modeSub: { race: 'Kies een baan en ga' } },
});

export class RaceMode extends Mode {
  // Options shown on the track screen: { key, label, values: [[value, label]...], default }.
  static options(settings) {
    return [{ key: 'laps', label: t('laps'), values: [[2, '2'], [3, '3'], [5, '5']], default: 3 }];
  }
}

Object.assign(RaceMode, {
  id: 'race',
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 58V8"/><path d="M14 10h38l-8 12 8 12H14z" fill="#fff"/><path d="M26 10v24M38 10v24M14 22h37" stroke-width="3"/><path d="M14 10h12v12H14zM38 10h14l-4 6 4 6H38zM26 22h12v12H26z" fill="#2a2433" stroke="none"/></svg>',
});

export default RaceMode;
