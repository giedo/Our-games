// The age setting: 'little' (4 to 6) plays like the original game, 'big' (7 to 10) gets everything.
export function ageOf(settings) {
  return settings && settings.age === 'big' ? 'big' : 'little';
}

export function isLittle(settings) {
  return ageOf(settings) === 'little';
}
