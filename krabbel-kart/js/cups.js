// Grand Prix cups: each one is a list of world ids raced in order.
// The planned worlds that are not registered are skipped; a cup with fewer than two known
// tracks borrows from the built-in four (`fallback`) so it is always playable.
import { TRACKS } from './tracks.js';
import { addStrings } from './i18n.js';

addStrings({
  en: { cups: { crayon: 'Crayon Cup', paint: 'Paint Cup', glitter: 'Glitter Cup' }, cupRaces: 'races', cupHint: 'Points in every race, podium at the end.', cupBest: 'Best' },
  nl: { cups: { crayon: 'Krijtjesbeker', paint: 'Verfbeker', glitter: 'Glitterbeker' }, cupRaces: 'races', cupHint: 'Punten per race, podium aan het eind.', cupBest: 'Beste' },
});

const PLAN = [
  { id: 'crayon', color: '#ff6b4a', planned: ['meadow', 'island', 'candy'], fallback: ['meadow', 'island', 'canyon', 'snow'] },
  { id: 'paint', color: '#3fb8ff', planned: ['canyon', 'story', 'plum'], fallback: ['canyon', 'meadow', 'island', 'snow'] },
  { id: 'glitter', color: '#c06bff', planned: ['snow', 'wonky', 'neon'], fallback: ['snow', 'canyon', 'meadow', 'island'] },
];

const known = (id) => TRACKS.some((x) => x.id === id);

function resolve(c) {
  const tracks = c.planned.filter(known);
  for (const id of c.fallback) if (tracks.length < 2 && known(id) && tracks.indexOf(id) < 0) tracks.push(id);
  return Object.assign({}, c, { tracks });
}

export const CUPS = PLAN.map(resolve);

export function cupById(id) {
  return CUPS.find((c) => c.id === id) || CUPS[0];
}
