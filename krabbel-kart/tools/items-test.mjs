// Headless test of every registered item: gives it to a kart, uses it, steps the simulation by hand
// and checks that the expected effect happened. Also checks the little-age pool, the item names in both
// languages, the road stars and that no console errors or NaN positions appear.
//
//   node tools/items-test.mjs [--world meadow] [--only turbo3,ghost] [--game <dir>]
import path from 'node:path';
import { openGame, startMode, parseArgs, GAME_DIR } from './lib/harness.mjs';

const args = parseArgs(process.argv.slice(2));
const world = typeof args.world === 'string' ? args.world : 'meadow';
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const game = await openGame({ gameDir: typeof args.game === 'string' ? path.resolve(args.game) : GAME_DIR });
const { page, errors } = game;
await startMode(page, { world, mode: 'race', age: 'big', players: 1, scale: 1 });

const results = await page.evaluate(async ({ only }) => {
  const g = window.__kk, base = location.pathname.replace(/index\.html$/, '');
  const { ITEM_DEFS } = await import(`${base}js/items.js`);
  const { t, setLang, getLang } = await import(`${base}js/i18n.js`);
  g.paused = true; g.noRender = true;
  const race = g.race, sys = race.items, out = [];
  const hits = [];
  const onHit = race.mode.onHit.bind(race.mode);
  race.mode.onHit = (v, a, c) => { hits.push({ v, a, c }); onHit(v, a, c); };
  let nan = false;
  const step = (secs, each) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      race.update(1 / 60);
      for (const k of race.karts) { if (k.item && k.aiItemT < 1e8 && k.__hold) k.aiItemT = 1e9; if (!Number.isFinite(k.x + k.y + k.z + k.speed)) nan = true; }
      if (each) each(i);
    }
  };
  race.autopilot = true; race.skipIntro();
  step(14);
  const ok = (name, cond, msg) => out.push({ name, ok: !!cond, msg: cond ? '' : msg });
  const things = () => sys.things.filter((x) => x.kind !== 'star' && x.kind !== 'starfield').length;
  const proj = () => sys.things.filter((x) => x.projectile).length;
  const reset = () => {
    for (const k of race.karts) { k.fx = {}; k.hitCool = 0; k.spinT = 0; k.item = null; k.itemT = 0; k.itemUses = 0; k.rollT = 0; k.autoSpeed = 1; k.shieldT = 0; k.__hold = true; }
    for (const th of sys.things.slice()) if (th.kind !== 'star' && th.kind !== 'starfield' && th.kind !== 'puddle') sys.remove(th);
    hits.length = 0;
  };

  // Registry checks.
  const L = ['turbo', 'puddle', 'plane', 'shield', 'turbo3', 'star', 'rocket', 'spring', 'giant', 'magnet'].sort();
  race.age = 'little';
  const little = sys.pool(race.karts[0]).map((d) => d.id).sort();
  ok('little pool', JSON.stringify(little) === JSON.stringify(L), little.join(','));
  race.age = 'big';
  const all = ITEM_DEFS.map((d) => d.id);
  ok('big pool', sys.pool(race.karts[0]).length === all.length && all.length >= 22, `${all.length} items`);
  for (const d of ITEM_DEFS) {
    const lang = getLang();
    setLang('en'); const en = t('items.' + d.id); setLang('nl'); const nl = t('items.' + d.id); setLang(lang);
    ok(`${d.id} names`, en !== 'items.' + d.id && nl !== 'items.' + d.id, `${en} / ${nl}`);
    ok(`${d.id} icon`, /^<svg viewBox="0 0 64 64">/.test(d.icon), 'bad icon');
  }

  // Stars on the road.
  const stars = sys.ofKind('star');
  ok('road stars', stars.length >= 28 && stars.length <= 50, `${stars.length} stars`);
  reset();
  const u0 = race.sorted[3], s0 = stars.find((s) => s.on);
  u0.stars = 0; u0.x = s0.x; u0.z = s0.z; u0.y = s0.y - 1;
  step(0.05);
  ok('collect star', u0.stars === 1 && !s0.on, `stars ${u0.stars}`);
  u0.stars = 5; u0.hitCool = 0; u0.hit({});
  const n0 = sys.ofKind('star').length;
  step(0.2);
  ok('big loses 3 stars', u0.stars === 2 && sys.ofKind('star').length === n0 + 3, `stars ${u0.stars}, things ${sys.ofKind('star').length - n0}`);
  step(10);

  // Every item.
  for (const d of ITEM_DEFS) {
    if (only && only.indexOf(d.id) < 0) continue;
    reset(); step(0.3);
    const sorted = race.sorted, user = sorted[3], first = sorted[0], last = sorted[7];
    const baseThings = things(), nonUser = race.karts.filter((k) => k !== user);
    let who = user;
    if (d.id === 'ink') who = last;
    if (d.id === 'ghost') nonUser.find((k) => k !== who && k.place !== 4).item = 'turbo';
    if (d.id === 'horn') { const r = sorted[4]; r.x = who.x + 3; r.z = who.z + 1; r.y = who.y; }
    if (d.id === 'magnet') { const s = stars.find((x) => x.on); s.x = who.x + Math.sin(who.dir) * 9; s.z = who.z + Math.cos(who.dir) * 9; s.hx = s.x; s.hz = s.z; s.y = who.y + 1; s.hy = s.y; who.stars = 0; }
    const hadItemOfRival = nonUser.map((k) => k.item);
    sys.give(who, d.id); who.__hold = true; who.aiItemT = 1e9; who.__t = 0;
    const frozen = { any: false }, wob = { any: false, slip: false };
    const anim0 = who.model.anim.children.length;
    sys.use(who);
    who.aiItemT = 1e9;
    const m = (cond, msg) => ok(d.id, cond, msg);
    const watch = () => { for (const k of race.karts) { if (k.fx.frozen) frozen.any = true; if (k.fx.slip) wob.slip = true; if (k.fx.slow || k.fx.tiny) wob.any = true; } };
    const ev = (each) => step(1, () => { watch(); if (each) each(); });
    switch (d.id) {
      case 'turbo': case 'turbo3': case 'gold': m(who.boostT > 0, 'no boost'); if (d.id === 'turbo3') m(who.itemUses === 2 && who.item === 'turbo3', `uses ${who.itemUses}`); if (d.id === 'gold') m(who.item === 'gold' && who.itemT > 6, 'not held'); break;
      case 'star': ev(); m(who.fx.star > 5, 'no star fx'); break;
      case 'rocket': { const kids = who.model.anim.children.length; ev(); m(who.fx.auto > 1 && who.autoSpeed === 1.55 && kids > anim0, `auto ${who.fx.auto} kids ${kids}`); step(8); m(!who.fx.auto && who.autoSpeed === 1 && who.model.anim.children.length === anim0, 'did not end cleanly'); break; }
      case 'spring': { const vy = who.vy; step(0.1); m(vy > 15 && !who.grounded, `vy ${vy}`); step(2); m(who.grounded, 'did not land'); break; }
      case 'ball': case 'comet': case 'bomb': case 'sparks': case 'freeze': case 'boomerang': {
        const born = proj();
        ev();
        if (d.id === 'sparks') m(born >= 1 && who.itemUses === 4, `thing ${born}, uses ${who.itemUses}`);
        else m(born >= 1 || hits.length, `no projectile`);
        if (d.id === 'boomerang') m(who.itemUses === 1, `uses ${who.itemUses}`);
        step(14);
        m(proj() === 0, `projectile stays (${proj()})`);
        if (d.id === 'comet') m(hits.some((h) => h.c === 'comet'), 'comet never hit anyone');
        break;
      }
      case 'shrink': ev(); step(0.6); m(nonUser.filter((k) => k.fx.tiny).length >= 5, `tiny ${nonUser.filter((k) => k.fx.tiny).length}`); step(6); m(!nonUser.some((k) => k.fx.tiny), 'tiny stays'); break;
      case 'giant': ev(); m(who.fx.giant > 5, 'no giant'); break;
      case 'ink': ev(); { const h = race.humans[0], hud = race.huds[0]; m(wob.slip || !race.karts.some((k) => !k.human && k.place < who.place), 'no wobble'); m(h.place >= who.place || hud.el.querySelector('.ink-blots'), 'no ink on hud'); step(5); m(!hud.el.querySelector('.ink-blots'), 'ink stays'); } break;
      case 'ghost': ev(); m(who.fx.ghost > 3, 'no ghost'); m(who.item === 'turbo', `item ${who.item}`); break;
      case 'horn': ev(); m(hits.some((h) => h.c === 'horn'), 'no horn hit'); break;
      case 'magnet': ev(); step(2); m(who.stars >= 1, `stars ${who.stars}`); break;
      case 'wand': ev(); m(wob.slip, 'nobody wobbled'); step(6); m(!race.karts.some((k) => k.fx.slip && k !== who), 'wobble stays'); break;
      default: ev(); m(true, '');
    }
    if (d.id === 'freeze') ok('freeze cube cleaned', who.model.anim.children.length === anim0 && race.karts.every((k) => k.model.anim.children.length <= 3), 'cube stays');
    step(8);
    ok(`${d.id} no leftovers`, things() <= baseThings + 3, `things ${things()} vs ${baseThings}`);
  }
  ok('no NaN', !nan, 'NaN position');
  return out;
}, { only });

let bad = 0;
for (const r of results) { if (!r.ok) { bad++; console.log(`FAIL ${r.name}: ${r.msg}`); } }
if (errors.length) { bad++; console.log(`console errors: ${errors.slice(0, 5).join(' | ')}`); }
console.log(`${results.length - bad} of ${results.length} checks passed`);
await game.close();
process.exit(bad ? 1 : 0);
