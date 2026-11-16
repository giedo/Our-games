// Game modes. MODES is the list shown on the mode picker (filtered by the age setting).
//
// A mode is a class in this folder (see base.js for the full interface). To switch one on,
// uncomment its import and its array entry. The empty "//" lines are spacers on purpose,
// so neighbouring uncomments by different people do not conflict.
import race from './race.js';
import cup from './cup.js';

// import knockout from './knockout.js';
//
// import time from './time.js';
//
import balloon from './balloon.js';
//
import stars from './stars.js';
//
import flag from './flag.js';
//
// import roam from './roam.js';

export const MODES = [
  race,
  cup,
  // knockout,
  //
  // time,
  //
  balloon,
  //
  stars,
  //
  flag,
  //
  // roam,
];

export function modeById(id) {
  for (const m of MODES) if (m.id === id) return m;
  return race;
}
