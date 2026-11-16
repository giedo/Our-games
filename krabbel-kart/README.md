# Krabbel Kart

*Draw it. Race it!* A kart racer for iPad and PC where your own drawings become the racers.
("Krabbel" is Dutch for scribble.)

## What is in it

- **Your drawings become 3D racers.** Take a photo of a drawing on paper (or draw on the screen). The game removes the paper, and turns the drawing into a puffy 3D driver or a chunky 3D vehicle that you can pick like any other racer.
- **Nine worlds**: Tulip Valley (windmills and flower fields), Sunset Canyon, Coconut Bay (beaches around a volcano), Aurora Peaks (snow under the northern lights), and five more: a candy land, a storybook, a plum orchard, a wonky town and a neon night city.
- **8 racers per race**, 3 laps. Computer racers also use your other drawings, so the kids' characters race each other.
- **Game modes**: Race, Time Trial (with a ghost of your best lap), Explore (find 10 golden stickers, no racing), Knockout (the last karts drop out at each gate) and Grand Prix (three cups of three races each, points, standings and a podium ceremony). Battle modes on a round arena: Balloon Battle, Star Scramble and Capture the Flag (red against blue). Pick them on the mode screen; more can be plugged in (see `docs/DESIGN.md`).
- **Age setting**: "4 to 6" (gentle: five simple modes, soft obstacles and items, no reading needed, a steering help button on the track screen) or "7 to 10" (all modes and items), chosen on the players screen.
- **1 or 2 players** on one screen (split screen); the battle modes also have teams.
- **Items**: 22 power-ups in all, from the turbo crayon, paint puddle, paper plane and bubble shield to comet chalk, ink blot, boomerang ruler, sparkler, star magnet and more, plus gold stars on the road to collect. Boost pads on the road.
- **Obstacles**: rolling balls, waddling critters, cones, toy traffic, bouncers, ramps and (7 to 10 only) slippery patches, sweepers and poppers. Computer racers steer around them.
- **Trick jumps**: drive off a ramp and tap Drift in the air (7 to 10) for a trick and a landing boost.
- **Characters move**: drivers cheer, throw, lean over, duck for a boost and celebrate, based on their own personality.
- **Drifting**: hold drift in a corner, the sparks change colour, let go for a boost.
- **Works with** touch (iPad), keyboard and gamepads.
- English and Dutch (Settings > Language).
- Real-time shadows and trackside details (grandstand, flags, corner signs, tyre walls). If the game stutters on an older device it lowers the detail by itself; you can also switch it off under Settings > Shadows and details.
- No accounts, no ads, no tracking, no network requests after loading. Drawings stay on the device.

## Controls

| | Steer | Gas | Brake | Drift | Use item |
| --- | --- | --- | --- | --- | --- |
| Touch | left/right pad | automatic | Brake button | Drift button | tap the item |
| Keyboard, 1 player | arrows or A/D | up or W | down or S | Space | Shift, E or Enter |
| Keyboard, player 1 of 2 | A/D | W | S | left Shift | E |
| Keyboard, player 2 of 2 | arrows | up | down | / or right Shift | Enter |
| Gamepad | stick or d-pad | A or right trigger | B or left trigger | shoulder buttons | X or Y |

Esc or P pauses. **Settings > Steering help** keeps very young racers on the road.
Secret: press the gas between "2" and "GO" for a rocket start (keyboard and gamepad).

## Tips for drawings

- **Driver**: draw the character from the front.
- **Vehicle**: draw it from the side, driving to the right, wheels included. (There is a Flip button if it faces left.)
- White, unlined paper and thick dark outlines work best. Closed outlines keep their white inside (a white belly stays white instead of becoming see-through).
- Photograph the paper straight from above. A table around the paper and soft shadows are fine. If something unwanted stays in the picture, use **Crop** or the **Eraser**, or move the **Remove paper** slider.
- Squared or lined paper is hard: the lines look like ink. Raise the slider, or draw on blank paper.

Drawings are saved in the browser's storage on that device. They do not sync between devices, and clearing the browser's site data removes them. Use **My drawings > (tap one) > Download** to keep a PNG copy.

## How the drawing trick works

1. `js/cutout.js` estimates the paper colour across the photo (in tiles, so shadows and warm lamp light are divided away), marks everything darker or more colourful as ink, then flood-fills the paper from the edges of the photo. Paper that is fully enclosed by ink is kept.
2. `js/puffy.js` traces the outline with marching squares and builds a watertight mesh. Drivers are inflated like a balloon (thicker in the middle). Vehicles are extruded into a slab with rounded edges, and the side wall is painted with the colours found just inside the outline. The drawing is printed on both sides.

## Project layout

```
index.html          the page
css/style.css       all styling
js/main.js          boot + render loop        js/race.js      one race (grid, laps, cameras)
js/world.js         terrain, road, sky, water  js/kart.js      driving physics + computer drivers
js/scenery.js       trees, windmills, ...      js/items.js     item boxes + power-ups
js/themes.js        look of each world         js/hud.js       on-screen display + touch controls
js/tracks.js        track layouts              js/audio.js     synthesised sound + music
js/cutout.js        paper removal              js/editor.js    drawing studio
js/puffy.js         drawing -> 3D mesh         js/drawpad.js   draw-on-screen pad
js/builtin.js       the built-in doodles       js/ui.js        menus
js/props.js         grandstand, signs, tyres   js/ceremony.js  podium ceremony
js/modes/           game modes (base, race, cup, index = the list)
js/worlds/          world packs (index = the list, _example.js = a minimal one)
js/items/           extra items (index = the list)    js/items.js     item boxes, registry, machinery
js/cups.js          Grand Prix cups            js/age.js       the age setting
js/obstacles.js     road obstacles (system)    js/obstacles/   obstacle kinds, looks, sounds
js/anim.js          character animation        js/stars.js     gold stars on the road
tools/smoke.mjs     headless test of every world and mode     tools/shot.mjs   one screenshot
tools/items-test.mjs  headless test of every item           tools/build-single.mjs  the one-file build
docs/DESIGN.md      the design contract and "Architecture (as built)"
vendor/             three.js (3D library)      fonts/          Fredoka font
```

Testing (needs Playwright with Chromium, installed globally):

```bash
node tools/smoke.mjs --mode race --world meadow,canyon --age little     # worlds x modes, played to the end, fails on any error
node tools/smoke.mjs --mode balloon,flag --world island --age big --players 2 --time 1
node tools/smoke.mjs --arena                                             # the arena variant of every world
node tools/items-test.mjs                                                # every item, both languages, the little-age pool
node tools/shot.mjs --world meadow --view race --out a.png               # one screenshot (--view picker, results, ...)
```

No build step: the browser loads the files as they are. Change a file, reload the page.

## One-file version

```bash
cd krabbel-kart
npm install
npm run build:single      # writes dist/krabbel-kart.html
```

`dist/krabbel-kart.html` contains the whole game and works by double-clicking it or by sending it to someone.

## Credits

- 3D rendering: [three.js](https://threejs.org) r160, MIT licence (`vendor/THREE-LICENSE`).
- Font: Fredoka, SIL Open Font Licence 1.1 (`fonts/FREDOKA-LICENSE.txt`).
- Everything else (code, worlds, doodles, sounds, music) was made for this game. All sound is synthesised in the browser (engine with a small gearbox model, effects, and one hand-written tune per world), there are no audio or image files besides the app icons.
