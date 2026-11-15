// One screenshot of the game, so you can look at your work.
//
//   node tools/shot.mjs --world <id> [--mode <id>] [--at <lapFraction 0..3>] [--age little|big]
//                       [--view menu|race|picker|title|players|mode|racer|track|results|standings|ceremony]
//                       [--players 1|2] [--lang en|nl] [--eval "<js run in the page before the shot>"]
//                       [--size 1024x640] [--game <dir>] --out file.png
//
// Views: menu = the world fly-by without menus, race = chase view at lap fraction --at (default 0.3,
// after the countdown, autopilot at high speed), picker = the track picker screen, results = the results
// screen of a finished race (use --mode cup to get the standings with standings, ceremony for the podium).
// --eval runs as async function body, with `g` = the game (window.__kk).
import fs from 'node:fs';
import path from 'node:path';
import { openGame, startMode, status, frames, sleep, parseArgs, GAME_DIR } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.out || args.out === true) { console.error('usage: node tools/shot.mjs --world <id> [--view race] [--at 0.5] --out file.png'); process.exit(2); }
const world = typeof args.world === 'string' ? args.world : 'meadow';
const mode = typeof args.mode === 'string' ? args.mode : 'race';
const age = args.age === 'big' ? 'big' : 'little';
const players = args.players === '2' ? 2 : 1;
const view = args.view === true || !args.view ? 'race' : args.view;
const at = args.at !== undefined && args.at !== true ? Number(args.at) : 0.3;
const [width, height] = (typeof args.size === 'string' ? args.size : '1024x640').split('x').map(Number);
const out = path.resolve(args.out);
fs.mkdirSync(path.dirname(out), { recursive: true });

const game = await openGame({ width, height, gameDir: typeof args.game === 'string' ? path.resolve(args.game) : GAME_DIR });
const { page, errors } = game;
const fail = async (msg) => { console.error(msg); await game.close(); process.exit(1); };

await page.evaluate(async ({ world, age, lang }) => {
  const g = window.__kk, base = location.pathname.replace(/index\.html$/, '');
  g.settings.age = age; g.settings.track = world;
  if (lang) { const i = await import(`${base}js/i18n.js`); i.setLang(lang); g.localize(); }
  g.buildWorld(world);
}, { world, age, lang: typeof args.lang === 'string' ? args.lang : null });

const run = async (code) => page.evaluate(`(async () => { const g = window.__kk; ${code} })()`);
const render = async () => { await page.evaluate(() => { const g = window.__kk; g.noRender = false; g.timeScale = 1; }); await frames(page, 3); await sleep(300); await frames(page, 2); };

// Drive a race with autopilot until check(status) is true.
async function drive(check, limitMs = 240000) {
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > limitMs) await fail('timed out waiting for the race');
    await sleep(250);
    const st = await status(page);
    if (errors.length) await fail(errors[0]);
    if (await check(st)) return st;
  }
}

if (view === 'menu') {
  await page.evaluate(() => { const g = window.__kk; g.ui.hide(); });
} else if (['title', 'players', 'mode', 'racer', 'track', 'picker'].includes(view)) {
  await page.evaluate(({ view, players, mode }) => {
    const g = window.__kk; g.ui.players = players; g.settings.mode = mode;
    if (view === 'racer') g.ui.show('racer', 0); else g.ui.show(view === 'picker' ? 'track' : view);
  }, { view, players, mode });
} else if (view === 'race') {
  await startMode(page, { world, mode, age, players, scale: 8 });
  await drive((st) => (st.state === 'racing' && st.lap >= at) || st.state === 'ending' || st.state === 'done' || st.ui === 'results');
  await page.evaluate(() => { window.__kk.paused = true; }); // freeze the picture, no pause menu
} else if (['results', 'standings', 'ceremony'].includes(view)) {
  await startMode(page, { world, mode, age, players, scale: 8 });
  await drive((st) => st.ui === 'results');
  if (view !== 'results') {
    await page.evaluate(() => document.querySelector('#ui-root .btn.go').click());
    if (view === 'ceremony') {
      for (let i = 0; i < 8; i++) { await drive((st) => st.ui === 'results' || st.ui === 'ceremony'); const u = (await status(page)).ui; if (u === 'ceremony') break; await page.evaluate(() => document.querySelector('#ui-root .btn.go').click()); await sleep(300); await page.evaluate(() => document.querySelector('#ui-root .btn.go').click()); }
      await page.evaluate(() => { window.__kk.timeScale = 1; });
      await sleep(7000);
    }
  }
} else await fail(`unknown view ${view}`);

if (typeof args.eval === 'string') await run(args.eval);
await render();
await page.screenshot({ path: out });
console.log(`saved ${out}${errors.length ? ` (with ${errors.length} errors: ${errors[0]})` : ''}`);
await game.close();
process.exit(errors.length ? 1 : 0);
