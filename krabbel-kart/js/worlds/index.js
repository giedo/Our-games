// World packs: extra worlds that plug into the game without touching the core files.
//
// A pack is one file in this folder with a default export (see _example.js for a
// minimal working one, and docs/DESIGN.md "Architecture (as built)" for every field).
// To switch a pack on, uncomment its two lines below: the import and the array entry.
// The empty "//" lines are spacers on purpose: two people uncommenting neighbouring
// lines would otherwise get a merge conflict.
//
// Rules for pack files: import only the vendor three.js and ../util.js at the top
// level. Everything else (scenery helpers, noise, geometry builders) arrives through
// the `kit` argument that the theme() and scenery() functions receive.

// import candy from './candy.js';
//
// import story from './story.js';
//
// import wonky from './wonky.js';
//
// import plum from './plum.js';
//
// import neon from './neon.js';

export const WORLD_PACKS = [
  // candy,
  //
  // story,
  //
  // wonky,
  //
  // plum,
  //
  // neon,
];

export function packById(id) {
  for (const p of WORLD_PACKS) if (p.id === id) return p;
  return null;
}
