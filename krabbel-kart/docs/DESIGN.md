# Krabbel Kart: expansion design

This is the contract every contributor (human or agent) builds against. Read it before touching code.

## Vision

Krabbel Kart is a kart racer where children's own drawings become the racers. Everything in the game looks hand-made: crayons, paint, paper, stickers, stamps, glitter. The expansion adds five new magical worlds, a full set of game modes including battle modes, many more items, fun road obstacles, character animation, and an age setting.

**Originality rule.** Genre mechanics (items that boost, homing shots, knockout races, balloon battles) are fair game. Names, characters, art, music, track layouts and the look of any existing commercial game are not. Every item, mode and world here has its own craft-box identity. Never use a name from another game in code, strings or docs.

**Platform rule.** Plain ES modules, no build step, three.js r160 in `vendor/`. No image or audio files: everything is generated in code. Must stay smooth on an older iPad: aim for at most ~60 draw calls and ~500k triangles in a race view, use `InstancedMesh` and merged vertex-coloured geometry (see `js/scenery.js`), avoid per-frame allocations. English and Dutch for every string.

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

The foundation work fills in this section with the exact APIs: world packs, mode interface, item registry, kart effects, obstacle and animation hooks, string registration, and the smoke tool.
