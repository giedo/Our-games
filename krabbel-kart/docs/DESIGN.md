# Krabbel Kart: expansion design

This is the contract every contributor (human or agent) builds against. Read it before touching code.

## Vision

Krabbel Kart is a kart racer where children's own drawings become the racers. Everything in the game looks hand-made: crayons, paint, paper, stickers, stamps, glitter. The expansion adds five new magical worlds, a full set of game modes including battle modes, many more items, fun road obstacles, character animation, and an age setting.

**Originality rule.** Genre mechanics (items that boost, homing shots, knockout races, balloon battles) are fair game. Names, characters, art, music, track layouts and the look of any existing commercial game are not. Every item, mode and world here has its own craft-box identity. Never use a name from another game in code, strings or docs.

**Platform rule.** Plain ES modules, no build step, three.js r160 in `vendor/`. No image or audio files: everything is generated in code. Must stay smooth on an older iPad: nothing may be heavier than the original Tulip Valley world, which measures about 105 draw calls and 700k triangles in a one-player race view (lower is better), use `InstancedMesh` and merged vertex-coloured geometry (see `js/scenery.js`), avoid per-frame allocations. English and Dutch for every string.

## Age setting

`settings.age` is `'little'` (4 to 6) or `'big'` (7 to 10). Default `'little'`, which plays like the original game.

| | little (4 to 6) | big (7 to 10) |
| --- | --- | --- |
| Items | gentle subset (marked L below) | all items |
| Obstacles | only soft ones: they bump or bounce, never spin you out | all, full effect |
| Modes | Race, Grand Prix, Balloon Battle, Star Scramble, Explore | all modes |
| Extras | stars are never lost when hit | trick jumps, losing stars when hit |

## Worlds

Existing: `meadow`, `canyon`, `island`, `snow`. New worlds are "world packs" in `js/worlds/<id>.js`. Reference pictures for the look of each are numbered 1 to 5.

| id | Name (EN / NL) | Ref | Look |
| --- | --- | --- | --- |
| `candy` | Marshmallow Dunes / Spekkiesduinen | 1 | Soft clay 3D. Only powder blue, blush pink, cream and peach. Rounded dunes, arches, puffy pink clouds, blue pom-pom trees, round-topped houses, matte and smooth. |
| `story` | Storybook Harbour / Prentenboekhaven | 2 | Painted picture book. Strong sky blue and warm yellow with red roofs. Tall narrow town houses, string lights, sailboats, gulls, visible brush texture. |
| `wonky` | Wonky Town / Scheve Stad | 3 | Crooked cartoon town at dusk. Magenta, teal, orange, purple. Leaning houses with bent chimneys, curly trees, scribbled chalk marks, glowing windows. |
| `plum` | Plum Tea Garden / Pruimentuin | 4 | Whimsical purple and teal with cream. Giant teacups, roses, polka dots, cactus pots, striped sails, floating sparkles (bokeh). |
| `neon` | Neon Night / Neonnacht | 5 | Black world drawn in glowing lines: orange, magenta, cyan, violet. Wireframe hills, glowing trees, light trails on the road, reflections. |

Grand Prix cups (three tracks each): Crayon Cup (`meadow`, `island`, `candy`), Paint Cup (`canyon`, `story`, `plum`), Glitter Cup (`snow`, `wonky`, `neon`).

## Game modes

| id | Name (EN / NL) | Ages | What happens |
| --- | --- | --- | --- |
| `race` | Race / Race | L B | Single race, 8 karts. Options: laps (2, 3, 5), speed. |
| `cup` | Grand Prix / Grote Prijs | L B | Pick a cup, three races, points, podium ceremony. |
| `knockout` | Knockout / Afvalrace | B | One long race with gates. At each gate the karts at the back drop out (8, 6, 4, 3, 2, winner). |
| `time` | Time Trial / Tijdrit | B | Alone on the track with three turbo crayons. Best time is saved per track and replayed as a see-through ghost. |
| `balloon` | Balloon Battle / Ballonnengevecht | L B | Arena. Everyone carries three balloons. Each hit pops one and scores for the attacker. Most points when time is up. |
| `stars` | Star Scramble / Sterrenjacht | L B | Arena. Collect gold stars. Getting hit drops some. Most stars when time is up. |
| `flag` | Capture the Flag / Vlaggenroof | B | Arena, red team against blue team. Grab the other team's flag and bring it home. Hit the carrier and the flag drops. |
| `roam` | Explore / Ontdekken | L B | No race. Drive around a world freely and find hidden golden stickers. |

Arenas are ring-shaped (a closed loop road, wide, short) so the existing track maths works. Every world gets an arena variant that reuses its theme.

## Items

L marks items available to the little age group. All items are available to the big group. Priority 1 items ship first.

| id | Name (EN / NL) | L | Pri | Effect |
| --- | --- | --- | --- | --- |
| `turbo` | Turbo Crayon / Turbokrijtje | L | done | Short boost. |
| `puddle` | Paint Puddle / Verfplas | L | done | Dropped behind, spins whoever drives in. |
| `plane` | Paper Plane / Papieren vliegtuig | L | done | Homes in on the kart ahead. |
| `shield` | Bubble Shield / Bellenschild | L | done | Blocks one hit. |
| `turbo3` | Crayon Pack / Krijtjesdoos | L | 1 | Three turbo boosts. |
| `star` | Rainbow Marker / Regenboogstift | L | 1 | 8 s rainbow glow: faster, cannot be hit, bumps others into a spin. |
| `rocket` | Rocket Pencil / Raketpotlood | L | 1 | Ride a pencil rocket: very fast autopilot for a few seconds, longer for karts further back. |
| `spring` | Pogo Spring / Springveer | L | 1 | Big jump. Hops over obstacles and puddles. |
| `ball` | Bouncy Ball / Stuiterbal | | 1 | Shot straight ahead, bounces off the road edges. |
| `comet` | Comet Chalk / Komeetkrijt | | 1 | Flies along the road to whoever is in first place and bursts there. |
| `bomb` | Glitter Bomb / Glitterbom | | 1 | Lobbed ahead, bursts in a wide cloud of glitter. |
| `shrink` | Shrink Stamp / Krimpstempel | | 1 | Every rival becomes tiny and slower for 5 s. |
| `giant` | Giant Juice / Reuzensap | L | 1 | Grow huge for 8 s, flatten karts you touch. |
| `gold` | Golden Crayon / Gouden krijtje | | 2 | Boost as often as you like for 7 s. |
| `ink` | Ink Blot / Inktvlek | | 2 | Ink splashes over the screens of everyone ahead. Computer racers wobble. |
| `ghost` | Ghost Doodle / Spookkrabbel | | 2 | See-through and untouchable for 6 s, and steals a rival's item. |
| `sparks` | Sparkler / Sterretje | | 2 | Five quick sparkle shots. |
| `freeze` | Freeze Pop / IJslolly | | 2 | Thrown ahead, freezes a rival in an ice cube for a moment. |
| `boomerang` | Boomerang Ruler / Boemerangliniaal | | 2 | Flies out and comes back. Two throws. |
| `horn` | Party Horn / Feesttoeter | | 2 | Shock wave: spins nearby karts and pops flying items. |
| `magnet` | Star Magnet / Sterrenmagneet | L | 2 | Pulls in stars around you for 8 s. |
| `wand` | Wobble Wand / Wiebelstaf | | 2 | Rivals ahead turn into wobbly jelly shapes and slow down briefly. |

**Gold stars** lie on the road in every race. Each one adds a little top speed, up to ten. Big age group loses three when hit.

## Obstacles

Placed per world through `obstacles: [{ kind, at, lat, skin, ... }]` where `at` is the fraction of a lap (0 to 1) and `lat` the sideways offset in metres. A world pack may supply its own look for an obstacle through `skins: { name: (kit) => Object3D }`; otherwise the obstacle system uses its default look.

| kind | What it does | Soft enough for little |
| --- | --- | --- |
| `roller` | Balls roll back and forth across the road. | yes (bounce only) |
| `crosser` | A row of critters waddles across the road. | yes (bump only) |
| `bouncer` | A springy pad that throws the kart into the air. | yes |
| `ramp` | A jump ramp. Landing gives a small boost. | yes |
| `cones` | A cluster of light things that fly away when hit. | yes |
| `slick` | Slippery patch, the kart slides for a moment. | no |
| `spinner` | A turning arm that sweeps over part of the road. | no |
| `popper` | Pops out of the road on a rhythm and tosses the kart. | no |
| `traffic` | Slow toy vehicles that drive along the road. | yes (bump only) |

## Character animation

Racers are puffy drawings, so animation is transform-based: squash, stretch, hop, twirl, wiggle, lean, plus little emote particles (stars, hearts, sweat drops, sparkles). Gestures: `select` (picked in the menu), `idle`, `throw`, `win`, `lose`, `hit`, `overtake`, `boost`.

## The gauntlet

Nothing counts as done until it passes all of these. Run them yourself before you report.

1. `node tools/smoke.mjs` passes: boots with zero console errors, every world loads, every mode runs to its end under autopilot.
2. Performance: a race view stays within the platform budget above (the smoke tool prints draw calls and triangles).
3. Nothing that already worked is broken: the four original worlds, tournament, podium, drawings, split screen, touch controls.
4. The little age group flow is no harder than the original game.
5. Looks: take screenshots, look at them, compare with the reference picture, write down the three weakest things, fix them, repeat at least twice.
6. Every new string exists in English and Dutch.
7. Originality rule holds.
8. `npm run build:single` still produces a working file (only if `node_modules` is present).

## Architecture (as built)

This is what exists after the foundation work. Everything below is real code; the file paths are the source of truth. Six engineers build on it in parallel (worlds, items, modes, battle modes, obstacles, character animation), so each seam is a place where you **add a file** and flip one line in a list file.

### How to avoid merge conflicts

- Each list file (`js/worlds/index.js`, `js/modes/index.js`, `js/items/index.js`) has commented slots with an empty `//` line between them. Uncomment **your own** slot (import line and array entry). Do not reorder, do not add lines next to someone else's slot.
- Strings go into your own file with `addStrings` (below). Do not edit the dictionaries in `js/i18n.js`.
- Do not edit `race.js`, `kart.js`, `items.js`, `hud.js` for feature work unless the seam is missing something. If it is, make the smallest change, and say so in your commit message.
- Per-frame code must not allocate (no `new`, no array literals in hot paths). Reuse objects.

### Tools: smoke test and screenshots

Playwright and Chromium are installed globally. Nothing to install. Software rendering is slow, so both tools use a small window and a fast clock.

```
node tools/smoke.mjs                         # every world x every registered mode, to the end, under autopilot
node tools/smoke.mjs --world candy --mode balloon --age big --players 2
node tools/smoke.mjs --quick                 # one world, race only
node tools/smoke.mjs --shots /tmp/shots      # also saves PNGs (1024x640): world fly-by and mid-race chase view
npm run smoke                                # same as node tools/smoke.mjs
```

Smoke prints one line per run: world, mode, ok/FAIL, simulated seconds, wall seconds, draw calls and triangles of one frame sampled mid race (all viewports together). It fails on any console error, page error, NaN kart position, timeout (`--timeout <s>`, default 150) or wrong number of result rows, and finishes with exit code 1. It also builds and draws the arena variant of every world once. It starts modes through `game.ui.startRace()`, the same code a player's taps end in, so a mode that is not in the menus is not tested.

```
node tools/shot.mjs --world candy --view race --at 0.5 --out /tmp/a.png          # chase view half way round lap 1
node tools/shot.mjs --world candy --view menu --out /tmp/b.png                   # fly-by without menus
node tools/shot.mjs --world candy --view picker --out /tmp/c.png                 # track picker (also: title players mode racer)
node tools/shot.mjs --world neon --mode cup --view results --lang nl --out x.png # results (also: standings ceremony)
node tools/shot.mjs --world plum --view race --at 1.2 --age big --eval "g.race.humans[0].addFx('star', 99)" --out s.png
```

`--at` is the lap fraction of the first player (0 to 3). `--eval` is an async function body with `g` = `window.__kk` (the game), run just before the picture. The race is frozen (`g.paused`) for the shot; to see effects play out, unpause inside `--eval` and wait. Useful handles on `window.__kk`: `g.race`, `g.world`, `g.timeScale` (simulation speed multiplier, used by the tools), `g.noRender` (skip drawing), `g.render()`, `g.ui.show('track')`, `g.settings`. `race.autopilot = true` lets the computer drive the human karts.

Both tools take `--game <dir>` to run another checkout of the game (handy for before/after comparisons) and `?q=1` (fixed pixel ratio) is added for you.

Tips: a full smoke run takes minutes. Run it in the foreground in chunks (`--mode race --world a,b`, `--mode cup`, `--arena`); background runs of the browser were seen to stall in some sandboxes. The tool fails a run when the page stops answering for 60 s.

Gauntlet reminder: run smoke for `--age little` and `--age big`, with `--players 1` and `2`, before you report.

### Strings

```js
import { addStrings } from '../i18n.js';
addStrings({
  en: { modes: { balloon: 'Balloon Battle' }, modeSub: { balloon: 'Pop the other balloons' } },
  nl: { modes: { balloon: 'Ballonnengevecht' }, modeSub: { balloon: 'Knal de ballonnen van de rest' } },
});
```

Deep merge into both dictionaries, call it at the top level of your own file. `t('modes.balloon')` reads nested keys. Keys used by the menus: `modes.<modeId>`, `modeSub.<modeId>` (mode picker cards), `tracks.<worldId>`, `trackSub.<worldId>` (filled in from a world pack's `strings`). Missing Dutch falls back to English, but every string must exist in both.

### Settings

`js/store.js` DEFAULTS: `age` (`'little' | 'big'`, read it with `ageOf(settings)` / `isLittle(settings)` from `js/age.js`), `mode` (id of the mode played last), `modeOpts` (`modeOpts[modeId][key]` = chosen option), `track`, `difficulty`, `picks`. `race.age` is the age the race runs with.

### Menu flow

title, players (1 or 2, plus the age choice), mode picker (cards from the mode registry, filtered by age; tapping a card goes on), racer picker, track picker (world cards in a row that scrolls sideways when there are many, the mode's options, speed), start. `UI.currentMode()` is the mode class chosen, `UI.modeOpts(M)` the resolved options.

### World packs: `js/worlds/`

A pack is a file with a default-exported object. `js/worlds/_example.js` is a complete minimal one (not registered); copy it. Register in `js/worlds/index.js`: uncomment `import candy from './candy.js';` and `candy,` in `WORLD_PACKS`.

```js
export default {
  id: 'candy',
  track: { seed, scale, width, points, itemRows, boostPads, obstacles },   // like TRACKS in js/tracks.js
  theme(seed, bounds, kit) { return { sky, fog, light, water, road, clouds, ambient, blendNear, blendFar, height, color, ...optional }; },
  scenery(w, kit) { /* build the dressing into w.scene */ },
  song: { bpm, style, lead, chords, melody },     // see js/audio.js SONGS
  style: { kick, snare, hat, hatVol, bass, bassLen, comp, level },   // optional rhythm style, see STYLES in js/audio.js
  chip: 'linear-gradient(...)',                    // CSS background of the track card
  strings: { en: { name, sub }, nl: { name, sub } },
  skins: { roller: (kit) => THREE.Object3D },      // optional obstacle looks
};
```

Rules:

- Import only vendor three.js and `../util.js` at the top level of a pack file. Everything else arrives through `kit` (no import cycles).
- `kit` (`KIT` in `js/scenery.js`) holds `THREE`, everything exported by `js/util.js` (`makeNoise`, `mix3`, `smoothstep`, `clamp`, `lerp`, `mergeColored`, `mat4`, `makeCanvas`, `canvasTexture`, `mulberry32`, ...), the placement helpers `scatter(w, opts)`, `alongTrack(w, opts)`, `instanced(w, geo, material, list, shadowRadius)`, `tulipFields`, `sprinkle`, `balloons`, `jitter`, and the model builders `geoRoundTree geoPine geoPalm geoCactus geoRock geoBush geoHouse geoHoodoo geoSnowman geoIgloo geoCabin geoBalloon geoSailboat geoLighthouse geoArch`. Need another helper? Export it from `js/scenery.js` and add it to `KIT`.
- `scenery(w, kit)` runs after the gantry and the corner signs and tyre walls (`js/props.js`) were built and before the shadow blobs. `w.mats.scenery`, `w.mats.sceneryDouble`, `w.mats.sceneryNoFog` are ready-made vertex-colour materials; `w.rnd` is the world's seeded random, `w._shadows` collects blob shadows (`instanced` fills it when you pass a shadow radius).
- Everything must be deterministic (use `w.rnd`, `makeNoise(seed)`, not `Math.random`).
- Theme optional fields (defaults keep the four built-in worlds as they were): `terrainShadow`, `night` (bluish scenery shadows), `detail: { strokes, kind: 'blades' | 'ripples' | 'sparkle' | 'custom', draw(g, size, rnd) }` (marks on the ground texture), `water.ocean` (endless ocean), `water: null` (no water), `ambient.cfg` (`{ n, box, size, vel, op }` for the floating particles), `clouds` with `count: 0` for none, and `onBuilt(world, kit)`, called at the very end of `new World()`, to restyle materials, e.g. a glowing road: `world.scene.traverse(...)`.
- Music: `song.lead` is one of `whistle square trumpet pan bell brass`; `song.style` is a built-in style name (`soft bounce gallop calypso sleigh march`) or, when the pack has `style`, the pack id. The tune plays for that world id (and for its arena variant).
- `TRACKS` (in `js/tracks.js`) is the four built-ins plus the pack tracks (`{ ...pack.track, id: pack.id }`). The Grand Prix does not use `TRACKS`, it uses `js/cups.js`.

`World` extras: `world.def` (the track def), `world.themeId` (look to use: `def.theme || def.id`), `world.theme`, `world.packSkins` (the pack's obstacle skins, or `{}`).

Arena variants: `arenaDef(worldId)` in `js/tracks.js` returns `{ id: worldId + '-arena', theme: worldId, arena: true, seed, width: 30, points: <ring of radius 55>, itemRows, boostPads: [], obstacles: [] }`. It is a normal closed track (so lap maths, `track.locate`, minimap, items all work) with the same look and landscape. The battle engineer refines it (radius, walls, spawn spots). `game.buildWorld(def)` takes an id or a def; `startRace` builds the arena variant for modes with `arena = true`.

### Game modes: `js/modes/`

`Mode` in `js/modes/base.js` is a plain lap race. `race.js` is the classic race (subclass with options), `cup.js` the Grand Prix card. Register in `js/modes/index.js` (`MODES` array, `modeById(id)` returns the class, falls back to `race`).

Class level (read by the menus, set with `Object.assign(MyMode, {...})` after the class):

| field | meaning | default |
| --- | --- | --- |
| `id` | unique id, also settings key and string key | |
| `icon` | inline svg string for the mode card | |
| `ages` | age groups that see it | `['little','big']` |
| `arena` | race on the arena variant of the chosen world | false |
| `teams` | uses `kart.team` | false |
| `needsTrack` | false hides the world cards (runs on `settings.track`) | true |
| `series` | multi-race flow run by main.js (Grand Prix); not raced itself | false |
| `karts` | karts in total, players included | 8 |
| `static options(settings)` | `[{ key, label, values: [[value, label], ...], default }]`, drawn as segmented controls on the track screen, stored in `settings.modeOpts[id][key]`, handed to the mode as `this.opts` | `[]` |

Instance level (override what you need; every hook has a working default):

| hook | what | default |
| --- | --- | --- |
| `constructor(race, opts)` | `this.race`, `this.opts` | |
| `lapCount()` | laps that count as finished; `Infinity` = never finish by laps | `opts.laps \|\| 3` |
| `allowRubberBand` (getter) | catch-up speed for computer racers | true |
| `setup()` | once, after karts exist (they are in `race.karts`, humans in `race.humans`): grid, teams, balloons | computer racers in front, players behind |
| `update(dt)` | every step, all states (check `race.state`) | counts `endT` |
| `onLap(kart)` | a lap was completed (not the last) | HUD "Lap n" message |
| `onFinish(kart)` | `kart.finished` just became true | finish message, confetti, `win`/`lose` gesture |
| `onHit(victim, attacker, cause)` | a kart really got hit (see `kart.hit`); attacker may be null | nothing |
| `rank()` | set `kart.place` (1 = best) and `race.sorted` | by finish time, then progress; `out` last |
| `isOver()` | stop the race | all humans home, or 60 s after the first |
| `results()` | `{ headline, rows }`, best first. Row: `{ place, name, human, playerIndex, driver, index, time?, team?, extra? }`. `time` is seconds or null (omit to hide the column), `team` 0 or 1 colours the row, `extra` is `[{ text, cls? }]` more columns | rows by place |
| `hudInfo(kart)` | `{ place: text \| null, lap: text \| null, extra: [{ icon, text }] }`; the first number in a text is drawn bold; null hides it | ordinal place, `Lap n/N` |
| `itemPool(kart)` | allowed item ids or null | null |
| `aiGoal(kart)` | `{ x, z }` or null. Computer racers (and human karts under autopilot) steer there instead of following the racing line | null |
| `dispose()` | clean up | |

Race calls the hooks: `Race.update` runs `mode.update`, then `aiGoal`, the kart controls, bumping, `rank()`, items, obstacles, particles, cameras, HUDs, and asks `isOver()` while `race.state === 'racing'`. The state machine (`intro`, `countdown`, `racing`, `ending`, `done`) stays in Race; after `ending` (4.2 s) it calls `game.onRaceDone(mode.results())`.

```js
// js/modes/time.js
import { Mode } from './base.js';
import { addStrings } from '../i18n.js';
addStrings({ en: { modes: { time: 'Time Trial' }, modeSub: { time: 'Beat your best time' } }, nl: { modes: { time: 'Tijdrit' }, modeSub: { time: 'Verbeter je tijd' } } });
class TimeTrial extends Mode {
  isOver() { return this.race.humans[0].finished; }
}
Object.assign(TimeTrial, { id: 'time', ages: ['big'], karts: 1, icon: '<svg ...></svg>' });
export default TimeTrial;
```

Start a race from code: `game.startRace({ mode: 'time', opts: {}, trackId: 'meadow', players: [{ driver, vehicle }], difficulty: 'normal' })`. Opponents are picked for you (`mode.karts` minus the players).

Grand Prix: `js/cups.js` has `CUPS = [{ id, tracks: [worldIds] }]`. `game.startCup({ players, difficulty, cup: id })` runs the series in main.js (`startCupRace`, `onRaceDone` hands out points `CUP_POINTS`, standings, podium ceremony). Every race of it is a `race` mode race. The modes engineer adds the named cups and the cup picker.

### Items: `js/items.js`, `js/items/`

An item is a definition passed to `registerItem` (the four built-ins are at the bottom of `js/items.js`; read them first). New items live in `js/items/<name>.js`; switch them on in `js/items/index.js` (main.js loads that file, so registration happens before the first race).

```js
// js/items/turbo3.js
import { registerItem } from '../items.js';
registerItem({
  id: 'turbo3',
  icon: '<svg viewBox="0 0 64 64">...</svg>',          // shown in the HUD
  ages: ['little', 'big'],                              // default both
  weight(kart, f, race) { return 1 + 3 * f; },          // chance in the box: f = 0 for the leader .. 1 for the last kart
  uses: 3,                                              // presses before it is gone (default 1); HUD shows a count badge
  use(sys, kart) { kart.boost(1.2, 1.4); sys.race.sfx('boost', kart); },   // return false to keep the item (no target)
  aiWants(kart, ctx) { return ctx.kmax < 0.012 || ctx.hold > 5; },         // ctx = { kmax: bend ahead, hold: seconds held, race }
});
```

Also: `held: seconds` instead of `uses` makes an item usable as often as you like for that long after the first press (HUD shows the seconds left). `kart.item` is the id, `kart.itemUses`, `kart.itemT` the counters.

`ItemSystem` (`race.items`, called `sys` in `use`):

- `pool(kart)` definitions this kart may get (age + `mode.itemPool`), `pick(kart)` weighted random id, `give(kart, id)` fills the slot at once, `use(kart)`.
- `sys.boxesEnabled = false` hides the item boxes (modes).
- Things: `sys.add(thing)` where `thing = { update(dt, sys) -> false when finished, dispose(), kind?, hazard?, s?, lat? }`. Projectiles, hazards and timed effects go here; the loop is not yours to edit. `sys.remove(thing)`, `sys.ofKind(kind)`. A thing with `hazard = true` and track coordinates `s` (sample index) and `lat` (sideways metres) is avoided by computer racers; `sys.hazardsAhead(kart, metres)` lists them (that is how the paint puddle works, see `Puddle`).
- `sys.hitKartsNear(x, y, z, radius, owner, opts)` hits every kart within a flat radius (skipping the owner, karts that are out, finished or immune) with `kart.hit({ by: owner, cause: opts.cause, soft, flat })` and returns the karts touched. Options: `cause, soft, flat, first, skipCool, finished, ky, dy`. See the comment in the code.
- `sys.spawnMesh(geo, mat, x, y, z)` / `sys.removeMesh(mesh)`, `sys.res(key, factory)` shared geometry/material made once per race and disposed with it, `sys.clock` the race clock, `sys.world`, `sys.race`.
- Roulette: the HUD spins over `sys.pool(kart)`.

`Plane` and `Puddle` in `js/items.js` are working examples of things.

### Kart capabilities: `js/kart.js`

Call these instead of editing physics.

- **Effects**: `kart.fx` is `{ name: secondsLeft }`; `kart.addFx(name, seconds)` (never shortens a running one), `kart.hasFx(name)`, `kart.clearFx(name)`. They count down in `kart.update` and are deleted at 0. Reserved names with built-in behaviour:

| name | effect |
| --- | --- |
| `star` | cannot be hit, +18% top speed, rainbow glow and sparkles, bumping a kart spins it |
| `tiny` | model scale 0.5, top speed x0.72 |
| `giant` | model scale 1.7, +8% speed, cannot be hit, touching a kart flattens it (`flat`) |
| `flat` | model squashed flat, top speed x0.5 (set by being hit with `flat: true`, about 1.5 s) |
| `ghost` | see-through, cannot be hit, no kart-kart bumping, dimmed on the minimap |
| `frozen` | no steering or gas, slides to a stop (add the ice look yourself) |
| `auto` | driven by `aiControl` at `kart.autoSpeed` times top speed (set `autoSpeed` first, default 1), cannot be hit, ignores the grass slow-down; a human still decides about the item button |
| `slip` | steering strongly reduced |
| `slow` | top speed x `kart.slowMul` (default 0.7) |

  The model scale (`kart.scaleVis`) and squash (`kart.flatVis`) are damped, never jump. Ghost and star copy the drawing's materials per kart while active (the originals are shared between karts), and give them back after.
- `kart.stars` (default 0): each adds 1.2% top speed, up to 10. Nothing hands them out yet.
- `kart.hit(opts)` with `{ by: Kart | null, cause: string, soft: bool, flat: bool }`; plain `kart.hit()` still works. Returns true when the kart really was hit (spun or flattened); then `race.mode.onHit(victim, attacker, cause)` runs and the `hit` gesture plays. Not hit (returns false): out, in the hit cool-down, finished, immune (star, giant, ghost, auto), or a shield pops (the shield is used up). `soft: true` only costs a little speed and never spins, never calls `onHit` (for the little age group's obstacles).
- `kart.launch(vy)` throws the kart upward; `kart.bump(nx, nz, strength)` pushes it sideways (m/s, fades out in a moment).
- `kart.out` / `kart.setOut(true)`: removed from play. No physics, model hidden, no item boxes, not bumped, left off the minimap, and its camera orbits it like a finished kart, ranked after all active karts by the default `rank()`. `kart.team` (null, 0 or 1) is just storage for modes and the results screen.
- `kart.aiGoal` is set by Race every frame from `mode.aiGoal(kart)`; `aiControl` then drives towards it, keeping the target on the road band and following the road the shorter way round when it is far along the loop, in either direction.
- `kart.gesture(name)` forwards to the animator. Fired by the code at: `throw` (item used), `hit` (spun), `win`/`lose` (finished, place <= 3 is win), `boost` (every `kart.boost`), `overtake` (a human gains a place, at most every 1.5 s).
- Useful state: `x y z dir speed`, `s idx lat progress lap` (track position, `progress` counts samples since the grid), `place`, `finished finishTime`, `grounded`, `offroad`, `boostT shieldT spinT hitCool`, `model`.

Pitfalls: `hit()` is ignored for 2.4 s after a spin (`hitCool`); hitting a ghost does nothing; `kart.update` returns early when `out`. Race only calls `mode.aiGoal` for karts that are not out.

### Obstacles: `js/obstacles.js`

`ObstacleSystem` is built by Race after the ItemSystem (`race.obstacles`), `update(dt, time)` runs every step, `dispose()` with the race. It does nothing yet. Read `race.world.def.obstacles` (`[{ kind, at, lat, skin, ... }]`, `at` = lap fraction), `race.world.packSkins[name](kit)` for a pack's looks (kit: import `KIT` from `js/scenery.js`), `race.age` (little: use `kart.hit({ soft: true })`, `kart.bump`, `kart.launch` only), and `race.items.add(thing)` if you want the item system's loop and AI avoidance (`hazard`) for an obstacle.

### Character animation: `js/anim.js`

`Animator(model, opts)` is created for every racer model: in `Kart` (`kart.anim`), the menu preview (`game.preview.animator`, `play('select')` when the picked racer changes) and the podium racers (`actor.animator`, `play('win')` for the top three). `update(dt, time, state)` runs every frame after the owner set its own transforms (state is the Kart in a race, null elsewhere); `play(name, opts)` starts a gesture; `dispose()`.

The model (from `buildRacerModel`, `js/racerModel.js`) is `root > tilt > body > anim > (vehicleMesh, pivot > driverAnim > driverMesh)` with the shield on `body`. `model.anim` (the whole racer) and `model.driverAnim` (just the drawing of the driver) are identity groups reserved for the animator: write their position, rotation and scale absolutely every frame and nothing else fights you. `body` and `pivot` are set by the kart/menu/podium code every frame (absolute assignment), so add to them (read, then write) or avoid them. Gestures: `select idle throw win lose hit overtake boost`. Emote particles: `race.particles.emit/burst` (see `js/particles.js`); there is no particle system for menu or podium racers yet.

### Added by the feature packages

Hooks and fields that appeared after the foundation. All have working defaults; read the code for details.

- **Mode hooks** (`js/modes/base.js`): `hudBanner(kart)` ({ text, sub, cls }: the line under the HUD, cls `danger`, `out` or `go`), `hudAction(kart)` ({ label, fn }: a button), `spectate(kart)` (camera target of a kart that is out), `skipCountdown`, `showWrongWay`, `canEnd()` and `endNow()` (the pause menu "End" button shows results), `mapMarks()` (reused list of `{ x, z, color, shape }` for the minimap; shapes `flag`, `ring`, `star`, `sticker`, `dot`), `mapColor(kart)` (minimap dot colour). Explore uses `mapMarks` to show hidden stickers (all for the little group, the nearest for the big group).
- **Mode class fields**: `group` (`race` or `battle`, the sections of the mode picker), `maxPlayers`, `humanRows` (results list only the players), `roadStars` (false: no gold road stars), `static cardNote(worldId)` (text on a track card).
- **HUD** (`js/hud.js`): `hud.message(text, dur, cls)` (messages longer than 14 characters get the `long` style: smaller, two lines at most, upper third of the view), `hud.warn(text, dur)` (blinking red pill, used by the comet), `_mark` shapes as above.
- **Items** (`js/items.js`): `SYSTEM_HOOKS` (functions run at the end of the `ItemSystem` constructor; `js/stars.js` uses it for the gold road stars, `sys.roadStars`), `sys.ofKind('star')`, `sys.hitKartsNear(...)`, `sys.give(kart, id)`. Shared helpers for projectiles (`Shot`, `Wave`, `puff`, `canHit`, `hudOf`) are in `js/items/common.js`.
- **Obstacles** (`js/obstacles.js`): `race.obstacles.advise(kart)` (where a computer racer should steer to avoid obstacles), `race.obstacles.list`, kinds in `js/obstacles/kinds.js` (`KINDS`, `HARD` = kinds not built for the little group), skins in `js/obstacles/looks.js`.
- **Kart** (`js/kart.js`): `lift` (ramp surface height under the kart) and `liftPitch` (set by obstacles), `driftHeld` (the drift button is down; a tap in the air after a ramp starts a trick, big group only), `gesture(name)` (character animation: select, idle, throw, win, lose, hit, overtake, boost, trick).
- **Track definitions** (`js/tracks.js`): arena fields `limitPad` (how far past the road edge karts may go; arenas run up to the fence) and `itemLats` (lateral positions of item rows).
- **Strings**: never use a plain string key that a feature also uses as a group. `t('items')` is the group of item names, so the race option label is `itemsOpt`.

### Pitfalls

- Pack files and mode/item files must not import from `main.js`, `ui.js` or `race.js`. Modes and items get the game through `this.race` / `sys`.
- `Race` is rebuilt for every race: keep state in the mode instance or on the race, never in module variables.
- Materials of the racers' drawings are shared between karts (and with the menu preview). Never change them in place; clone them (see `Kart._takeMats`).
- `world.update(dt)` runs once per step before `race.update`; things in `world.updaters` accumulate, so do not expect them to be deterministic across frame rates.
- Budget: no heavier than the meadow world (about 105 draw calls and 700k triangles in a one-player race view). Smoke prints both; with two players they are for both views together.
- The one-file build (`npm run build:single`, esbuild) bundles `main.js` and its imports: new files are picked up automatically, but do not use dynamic `import()` or top-level `await` in game code.
- No names, characters or art from commercial games anywhere (code, strings, docs).

### Contracts between the parallel work packages

**Sounds.** Do not add cases to `GameAudio.play`. Register your own in your own file: `import { registerSfx } from '../audio.js'; registerSfx('boing', (audio, t, vol, dest) => { audio._tone(dest, 'sine', 200, 600, t, 0.2, 0.4 * vol); });` then `race.sfx('boing', kart)` or `game.audio.play('boing')`. Prefix names with your area if they could clash (`item-`, `battle-`, `obs-`, `anim-`).

**Obstacle placements** (`track.obstacles`, in world packs and in `js/tracks.js`): `{ kind, at, lat = 0, skin?, count?, size?, period?, speed? }`.

| kind | fields |
| --- | --- |
| `roller` | `count` balls (1 to 3), `size` radius in metres (default 1.6), `period` seconds per crossing (default 4) |
| `crosser` | `count` critters (3 to 6), `speed` m/s (default 2.5) |
| `bouncer` | `lat`, `size` radius (default 2.2) |
| `ramp` | `lat`, `size` width (default 6) |
| `cones` | `lat`, `count` (default 6) |
| `slick` | `lat`, `size` radius (default 4) |
| `spinner` | `lat` of the pivot, `size` arm length (default 6), `period` seconds per turn (default 5) |
| `popper` | `lat`, `period` seconds (default 3) |
| `traffic` | `count` vehicles (default 2), `speed` m/s (default 9), `lat` lane |

A skin is `skins[name](kit)` returning a `THREE.Object3D` at unit size, which the obstacle system scales: a ball of radius 1 centred on the origin (`roller`); a critter about 1 m tall standing on y = 0 and facing +Z (`crosser`); a vehicle about 2 m long on y = 0 facing +Z (`traffic`); a flat pad of radius 1 on y = 0 (`bouncer`, `slick`); one light object about 0.8 m tall on y = 0 (`cones`); an arm 1 m long along +X from the origin (`spinner`); a thing about 1.5 m tall on y = 0 (`popper`); a wedge 1 m wide, 1 m long, rising towards +Z (`ramp`). Unknown skin names fall back to the default look of the kind. Keep obstacles out of the first 8% of the lap and off boost pads and item rows.

**Stars.** A gold star pickup is an ItemSystem thing with `kind: 'star'`, world position fields `x y z`, and `collect(kart)` (adds to `kart.stars`, plays the effect, finishes the thing). Anything that attracts or counts stars goes through `sys.ofKind('star')`. Road stars for races are built by the items package (`js/stars.js`); Star Scramble may carry its own pickups as long as they follow this contract.

**Battle item pool.** Arena modes return an explicit id list from `itemPool`; ids that are not registered are ignored, so listing items from the table above is safe before they exist.

**Cups.** `js/cups.js` may name worlds that are not registered yet; the cup code must skip unknown world ids.
