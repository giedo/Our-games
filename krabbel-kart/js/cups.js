// Grand Prix cups: each one is a list of world ids raced in order. The modes work adds the
// named three-track cups from docs/DESIGN.md here; for now there is one cup with the four
// built-in worlds, exactly the old tournament.
export const CUPS = [
  { id: 'classic', tracks: ['meadow', 'canyon', 'island', 'snow'] },
];

export function cupById(id) {
  return CUPS.find((c) => c.id === id) || CUPS[0];
}
