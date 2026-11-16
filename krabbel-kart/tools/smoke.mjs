// Headless smoke test: boots the game, then runs every world x every registered mode to its
// end under autopilot and fails on any console error, page error, timeout or missing result.
//
//   node tools/smoke.mjs [--world meadow,snow] [--mode race,cup] [--age little|big] [--players 1|2]
//                        [--time <minutes, battle modes>] [--shots <dir>] [--quick] [--arena] [--timeout <seconds>] [--scale <timeScale>] [--game <dir>]
//
// --quick: one world, mode race only. --arena: only the arena-variant build check of each world (it also runs at the end of a full run). --shots saves PNGs (menu fly-by of each world, mid-race chase
// view of each run) and renders at 1024x640. Exit code 1 when anything failed.
import fs from 'node:fs';
import path from 'node:path';
import { openGame, listRegistry, startMode, status, frames, measureFrame, sleep, parseArgs, GAME_DIR } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
const list = (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : null);
const age = args.age === 'big' ? 'big' : 'little';
const players = args.players === '2' ? 2 : 1;
const scale = Number(args.scale) || 8;
const timeoutMs = (Number(args.timeout) || 150) * 1000;
const shotsDir = typeof args.shots === 'string' ? path.resolve(args.shots) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const game = await openGame({ width: shotsDir ? 1024 : 640, height: shotsDir ? 640 : 400, gameDir: typeof args.game === 'string' ? path.resolve(args.game) : GAME_DIR });
const { page, errors } = game;
const reg = await listRegistry(page);

// Class fields the registry list does not carry: modes for one player only, and results that list only the players.
const extra = await page.evaluate(async () => {
  const { MODES } = await import(`${location.pathname.replace(/index\.html$/, '')}js/modes/index.js`);
  return Object.fromEntries(MODES.map((M) => [M.id, { maxPlayers: M.maxPlayers || 2, humanRows: !!M.humanRows }]));
});
for (const m of reg.modes) Object.assign(m, extra[m.id]);

let worlds = list(args.world) || reg.worlds;
let modes = reg.modes.filter((m) => m.ages.includes(age) && m.maxPlayers >= players);
if (list(args.mode)) modes = modes.filter((m) => list(args.mode).includes(m.id));
if (args.quick) { worlds = worlds.slice(0, 1); modes = reg.modes.filter((m) => m.id === 'race'); }
for (const w of worlds) if (!reg.worlds.includes(w)) { console.error(`unknown world ${w} (have ${reg.worlds.join(', ')})`); process.exit(2); }

// What to run: a series (Grand Prix) or a mode without a world choice runs once, the rest once per world.
const runs = [];
for (const m of modes) {
  if (m.series || !m.needsTrack) runs.push({ world: m.series ? 'all' : worlds[0], mode: m });
  else for (const w of worlds) runs.push({ world: w, mode: m });
}

// A hung page must fail the run, not hang the tool.
const guard = (promise, what) => Promise.race([promise, sleep(60000).then(() => { throw new Error(`page not responding (${what})`); })]);
const menuShot = new Set();
async function shoot(name) {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, name) });
}

async function runOne({ world, mode }) {
  const t0 = Date.now();
  const res = { world, mode: mode.id, ok: false, sim: 0, calls: null, tris: null, msg: '' };
  errors.length = 0;
  try {
    const first = mode.series ? reg.worlds[0] : world;
    if (shotsDir && !menuShot.has(first)) {
      menuShot.add(first);
      await page.evaluate((w) => { const g = window.__kk; g.ui.hide(); g.noRender = false; g.timeScale = 1; g.buildWorld(w); }, first);
      await frames(page, 4); await sleep(300); await frames(page, 2);
      await shoot(`${first}-menu.png`);
    }
    await startMode(page, { world: first, mode: mode.id, age, players, scale, time: Number(args.time) || 0 });
    const sims = new Map();
    let sampled = false, races = 0, results = 0;
    for (;;) {
      if (Date.now() - t0 > (mode.series ? timeoutMs * 4 : timeoutMs)) throw new Error('timeout');
      await sleep(250);
      const st = await guard(status(page), 'status');
      if (errors.length) throw new Error(errors[0]);
      if (!st.finite) throw new Error('a kart has a NaN position');
      if (st.raceId) { sims.set(st.raceId, Math.max(sims.get(st.raceId) || 0, st.time)); races = Math.max(races, st.raceId); }
      if (!sampled && st.state === 'racing' && st.lap > 0.3) {
        sampled = true;
        await page.evaluate(() => { window.__kk.noRender = false; });
        const m = await measureFrame(page);
        res.calls = m.calls; res.tris = m.tris;
        if (shotsDir) { await frames(page, 2); await sleep(200); await shoot(`${first}-${mode.id}-race.png`); }
        await page.evaluate(() => { window.__kk.noRender = true; });
      }
      if (st.ui === 'results') {
        results++;
        const want = mode.humanRows ? players : mode.karts;
        if (st.rows !== want) throw new Error(`results show ${st.rows} rows, expected ${want}`);
        if (shotsDir) { await page.evaluate(() => { window.__kk.noRender = false; }); await frames(page, 2); await shoot(`${first}-${mode.id}-results.png`); await page.evaluate(() => { window.__kk.noRender = true; }); }
        if (!mode.series) break;
        await page.evaluate(() => document.querySelector('#ui-root .btn.go').click());
      } else if (st.ui === 'standings') {
        await page.evaluate(() => document.querySelector('#ui-root .btn.go').click());
      } else if (st.ui === 'ceremony') {
        if (!st.ceremony) throw new Error('podium screen without a ceremony');
        break;
      }
    }
    if (mode.series && results < 2) throw new Error(`only ${results} results screens`);
    res.sim = [...sims.values()].reduce((a, b) => a + b, 0);
    if (errors.length) throw new Error(errors[0]);
    res.ok = true;
  } catch (e) {
    res.msg = String(e.message || e).split('\n')[0].slice(0, 200);
    if (errors.length && !res.msg.includes(errors[0])) res.msg += ` (+${errors.length} errors: ${errors[0].slice(0, 120)})`;
  }
  res.wall = (Date.now() - t0) / 1000;
  // Back to a clean menu for the next run (reload when the page is in a bad state).
  try {
    await page.evaluate(() => { const g = window.__kk; g.noRender = true; g.timeScale = 1; g.quitToMenu(); g.ui.show('title'); });
  } catch (e) { res.ok = false; }
  if (!res.ok) {
    try { await guard(game.boot(), 'reload'); } catch (e) { console.log(line(res)); console.log('the page is stuck, giving up'); process.exit(1); }
  }
  return res;
}

// A pack world also needs its arena variant to build and draw: check that once per world.
async function arenaCheck(world) {
  const res = { world, mode: '(arena)', ok: false, sim: 0, calls: null, tris: null, msg: '', wall: 0 };
  const t0 = Date.now();
  errors.length = 0;
  try {
    const m = await page.evaluate(async (w) => {
      const g = window.__kk, base = location.pathname.replace(/index\.html$/, '');
      const { arenaDef } = await import(`${base}js/tracks.js`);
      g.noRender = false; g.timeScale = 1;
      g.buildWorld(arenaDef(w));
      const info = g.renderer.info; info.autoReset = false; info.reset(); g.render();
      const out = { calls: info.render.calls, tris: info.render.triangles };
      info.autoReset = true; g.buildWorld(w); g.noRender = true;
      return out;
    }, world);
    res.calls = m.calls; res.tris = m.tris;
    if (errors.length) throw new Error(errors[0]);
    res.ok = true;
  } catch (e) { res.msg = String(e.message || e).split('\n')[0].slice(0, 200); }
  res.wall = (Date.now() - t0) / 1000;
  return res;
}

const results = [];
console.log(`smoke: ${runs.length} runs, age ${age}, ${players} player${players > 1 ? 's' : ''}, timeScale ${scale}${shotsDir ? `, shots in ${shotsDir}` : ''}`);
const pad = (v, n) => String(v).padEnd(n);
const line = (r) => `${r.ok ? 'ok  ' : 'FAIL'} ${pad(r.world, 10)} ${pad(r.mode, 9)} sim ${pad(Math.round(r.sim) + 's', 6)} wall ${pad(Math.round(r.wall) + 's', 5)} calls ${pad(r.calls === null ? '-' : r.calls, 4)} tris ${pad(r.tris === null ? '-' : r.tris, 8)}${r.msg ? ' ' + r.msg : ''}`;
for (const run of args.arena ? [] : runs) {
  const r = await runOne(run);
  results.push(r);
  console.log(line(r));
}
if (args.arena || (!args.quick && !list(args.mode))) {
  for (const w of worlds) { const r = await arenaCheck(w); results.push(r); console.log(line(r)); }
}
await game.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `${failed.length} of ${results.length} runs FAILED` : `all ${results.length} runs passed`);
process.exit(failed.length ? 1 : 0);
