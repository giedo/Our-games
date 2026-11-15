// Shared by smoke.mjs and shot.mjs: a tiny static server, a headless Chromium with software
// rendering, and helpers to drive the game through the same code the menus use.
// Playwright and Chromium are installed globally on the dev machines: nothing to install.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const GAME_DIR = path.resolve(here, '..', '..'); // .../krabbel-kart

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (e) { /* not on the module path: look in the global folder */ }
  const root = execSync('npm root -g').toString().trim();
  return createRequire(path.join(root, 'x.js'))('playwright');
}
const { chromium } = loadPlaywright();

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

// Serves the folder that holds the game folder (so the page lives at /krabbel-kart/index.html).
export function startServer(gameDir = GAME_DIR) {
  const root = path.dirname(gameDir), name = path.basename(gameDir);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}/${name}/index.html?q=1`, close: () => server.close() });
  }));
}

// Opens the game and waits until the world is built and the loading card is gone.
// errors collects console errors and page errors; clear it between runs with errors.length = 0.
export async function openGame({ width = 640, height = 400, gameDir = GAME_DIR } = {}) {
  const srv = await startServer(gameDir);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  const boot = async () => {
    await page.goto(srv.url);
    await page.waitForFunction(() => window.__kk && window.__kk.world && document.getElementById('loading').classList.contains('hide'), null, { timeout: 120000 });
  };
  await boot();
  return { page, errors, boot, close: async () => { await browser.close(); srv.close(); } };
}

// Registered worlds and modes, read from the running page (so packs and modes show up by themselves).
export async function listRegistry(page) {
  return page.evaluate(async () => {
    const base = location.pathname.replace(/index\.html$/, '');
    const { TRACKS } = await import(`${base}js/tracks.js`);
    const { MODES } = await import(`${base}js/modes/index.js`);
    return {
      worlds: TRACKS.map((t) => t.id),
      modes: MODES.map((M) => ({ id: M.id, ages: M.ages, series: !!M.series, arena: !!M.arena, needsTrack: M.needsTrack !== false, karts: M.karts })),
    };
  });
}

// Starts a mode through the menu code path: the same settings and ui.startRace() a player's taps end in.
export async function startMode(page, { world, mode, age = 'little', players = 1, scale = 8 }) {
  await page.evaluate(({ world, mode, age, players, scale }) => {
    const g = window.__kk, s = g.settings;
    s.age = age; s.mode = mode; s.track = world;
    const pick = (kind) => g.book.builtin.filter((x) => x.kind === kind);
    const d = pick('driver'), v = pick('vehicle');
    s.picks = [{ driver: d[0].id, vehicle: v[0].id }, { driver: d[1].id, vehicle: v[1].id }];
    g.timeScale = scale; g.noRender = true; g.paused = false;
    g.ui.players = players;
    g.ui.startRace();
  }, { world, mode, age, players, scale });
  await page.waitForFunction(() => window.__kk.race && document.getElementById('loading').classList.contains('hide'), null, { timeout: 60000 });
}

// One look at the game; also puts every human kart under autopilot and skips intros so a run goes by itself.
export async function status(page) {
  return page.evaluate(() => {
    const g = window.__kk, r = g.race;
    if (r) {
      if (!r.autopilot) r.autopilot = true;
      if (r.state === 'intro') r.skipIntro();
      if (!r.__id) r.__id = (window.__raceCount = (window.__raceCount || 0) + 1);
    }
    const tr = r && r.world.track, h = r && r.humans[0];
    return {
      ui: g.ui.current, ceremony: !!g.ceremony, raceId: r ? r.__id : 0, state: r ? r.state : null, time: r ? r.time : 0,
      lap: r ? h.progress / tr.n : 0, finite: r ? r.karts.every((k) => Number.isFinite(k.x + k.y + k.z + k.speed)) : true,
      rows: document.querySelectorAll('#ui-root .res-list li').length,
    };
  });
}

// Wait for N animation frames (with rendering on they are real rendered frames).
export async function frames(page, n = 3) {
  await page.evaluate((n) => new Promise((resolve) => { let i = 0; const f = () => (++i >= n ? resolve() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
}

// Draw one frame of the current view by hand and report what it cost: { calls, tris }.
export async function measureFrame(page) {
  return page.evaluate(() => {
    const g = window.__kk, info = g.renderer.info;
    info.autoReset = false; info.reset();
    g.render();
    const out = { calls: info.render.calls, tris: info.render.triangles };
    info.autoReset = true;
    return out;
  });
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Minimal "--flag value" / "--flag" parser.
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true; else { out[k] = next; i++; }
  }
  return out;
}
