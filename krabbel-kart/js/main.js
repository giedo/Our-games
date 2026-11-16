// Krabbel Kart: boots the game, owns the render loop and glues everything together.
import * as THREE from '../vendor/three.module.min.js';
import { trackById, arenaDef } from './tracks.js';
import { World } from './world.js';
import { Race } from './race.js';
import { modeById } from './modes/index.js';
import { cupById } from './cups.js';
import { Animator } from './anim.js';
import './items/index.js'; // registers the extra items
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { StickerBook, loadSettings, saveSettings } from './store.js';
import { buildRacerModel, disposeRacerModel } from './racerModel.js';
import { UI } from './ui.js';
import { Ceremony } from './ceremony.js';
import { h, ICON } from './dom.js';
import { setLang, detectLang, t } from './i18n.js';
import { damp } from './util.js';

const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.hudRoot = document.getElementById('hud-root');
    this.uiRoot = document.getElementById('ui-root');
    this.overlayRoot = document.getElementById('overlay-root');
    this.loadingEl = document.getElementById('loading');
    this.settings = loadSettings();
    if (!this.settings.lang) this.settings.lang = detectLang();
    setLang(this.settings.lang);
    const q = new URLSearchParams(location.search);
    this.fixedQuality = q.has('q');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.lowGraphics = false; // set automatically when the device struggles
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.pixelRatio = this.fixedQuality ? Number(q.get('q')) || 1 : this.maxPixelRatio;
    this.input = new Input();
    this.audio = new GameAudio(this.settings);
    this.book = new StickerBook();
    this.ui = new UI(this);
    this.menuCam = new THREE.PerspectiveCamera(56, 1, 0.3, 4000);
    this.world = null; this.race = null; this.paused = false;
    this.cup = null; this.ceremony = null;
    this.preview = null; this.previewPick = null;
    this.menuView = 'fly'; this.flyS = 0; this.orbit = 0.6;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camReady = false;
    this.last = 0; this.frames = 0; this.frameAcc = 0; this.timeScale = 1;
    this._v = new THREE.Vector3(); this._l = new THREE.Vector3();

    const unlock = () => { this.audio.unlock(); this.audio.applySettings(); };
    // Browsers only allow sound after a tap or key press; iOS wants the end of the tap.
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) addEventListener(ev, unlock, { passive: true });
    addEventListener('keydown', unlock);
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.race && this.race.state === 'racing') this.setPaused(true); });
    this.input.onAnyKey((code) => {
      if (code === 'Escape' || code === 'KeyP') {
        if (this.race && (this.race.state === 'racing' || this.race.state === 'countdown')) this.setPaused(!this.paused);
      }
    });
    this.canvas.addEventListener('pointerdown', () => { if (this.race) this.race.skipIntro(); });
    this.hudRoot.addEventListener('pointerdown', () => { if (this.race) this.race.skipIntro(); });
    document.getElementById('rotate-ok').addEventListener('click', () => document.body.classList.add('portrait-ok'));
    this.localize();
    this.resize();
  }

  // Texts that live in the page itself rather than in a menu screen.
  localize() {
    document.getElementById('rotate-text').textContent = t('rotateDevice');
    document.getElementById('rotate-ok').textContent = t('playAnyway');
  }

  async start() {
    // Wait briefly for the game font so signs painted onto 3D objects use it too.
    try { await Promise.race([document.fonts.load('700 40px Fredoka'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* fine */ }
    await this.book.load();
    this.buildWorld(this.settings.track);
    this.audio.startMusic('menu');
    this.ui.show('title');
    this.loadingEl.classList.add('hide');
    requestAnimationFrame((n) => this.frame(n));
  }

  resize() {
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.vw, this.vh, false);
    document.body.classList.toggle('portrait', this.vh > this.vw * 1.05);
  }

  // ----- worlds -----
  // A world id (menus, tournament) or a full track def (arena variants).
  buildWorld(idOrDef) {
    const def = typeof idOrDef === 'string' ? trackById(idOrDef) : idOrDef;
    if (this.world && this.world.def.id === def.id) return;
    if (this.preview && this.world) this.world.scene.remove(this.preview.root, this.preview.shadow);
    if (this.world) this.world.dispose();
    this.world = new World(def);
    this.applyGraphics();
    this.flyS = this.world.track.n * 0.03;
    this.camReady = false;
    if (this.preview) this.placePreview();
  }

  applyGraphics() {
    if (this.world) this.world.setShadows(this.settings.fancy !== false && !this.lowGraphics);
  }

  // Shows a "Loading" card for one frame, then swaps the landscape.
  loadWorld(id, then) {
    this.loadingEl.classList.remove('hide');
    setTimeout(() => {
      this.buildWorld(id);
      if (then) then();
      this.loadingEl.classList.add('hide');
    }, 40);
  }

  // ----- menu scene -----
  setMenuView(v) {
    this.menuView = v;
    if (v !== 'kart') this.clearPreview();
  }

  clearPreview() {
    if (!this.preview) return;
    if (this.world) this.world.scene.remove(this.preview.root, this.preview.shadow);
    this.preview.animator.dispose();
    disposeRacerModel(this.preview);
    this.preview = null; this.previewPick = null;
  }

  setPreview(driver, vehicle) {
    const key = `${driver.id}|${vehicle.id}`;
    if (this.previewPick === key) return;
    this.clearPreview();
    this.preview = buildRacerModel(driver, vehicle);
    this.preview.animator = new Animator(this.preview, { preview: true, id: driver.id });
    this.previewPick = key;
    this.preview.animator.play('select');
    this.placePreview();
  }

  placePreview() {
    const tr = this.world.track, m = this.preview;
    tr.posAt(5, 0, m.root.position);
    m.root.rotation.y = tr.heading[2];
    m.shadow.position.copy(m.root.position); m.shadow.position.y += 0.06;
    m.shadow.rotation.y = m.root.rotation.y;
    this.world.scene.add(m.root, m.shadow);
  }

  updateMenu(dt) {
    const w = this.world, tr = w.track, cam = this.menuCam, p = this._v, l = this._l;
    if (this.menuView === 'kart' && this.preview) {
      const m = this.preview, c = m.root.position;
      this.orbit += dt * 0.42;
      p.set(c.x + Math.sin(this.orbit) * 7.6, c.y + 2.5, c.z + Math.cos(this.orbit) * 7.6);
      l.set(c.x, c.y + 1.15, c.z);
      m.animator.update(dt, w.time, null);
    } else {
      this.flyS += (dt * 13) / tr.seg;
      const sway = Math.sin(w.time * 0.21) * 5;
      tr.posAt(this.flyS, sway, p);
      p.y += 8.5 + Math.sin(w.time * 0.33) * 2.5;
      tr.posAt(this.flyS + 46 / tr.seg, -sway * 0.4, l);
      l.y += 2.5;
    }
    if (!this.camReady) { this.camPos.copy(p); this.camLook.copy(l); this.camReady = true; }
    const k = this.menuView === 'kart' ? 6 : 2.2;
    this.camPos.x = damp(this.camPos.x, p.x, k, dt); this.camPos.y = damp(this.camPos.y, p.y, k, dt); this.camPos.z = damp(this.camPos.z, p.z, k, dt);
    this.camLook.x = damp(this.camLook.x, l.x, k, dt); this.camLook.y = damp(this.camLook.y, l.y, k, dt); this.camLook.z = damp(this.camLook.z, l.z, k, dt);
    const g = w.heightAt(this.camPos.x, this.camPos.z);
    cam.position.copy(this.camPos);
    if (cam.position.y < g + 1.5) cam.position.y = g + 1.5;
    cam.lookAt(this.camLook);
  }

  // ----- racing -----
  // total = how many karts race altogether (the mode says), players included.
  pickOpponents(players, total) {
    const used = new Set();
    for (const p of players) { used.add(p.driver.id); used.add(p.vehicle.id); }
    const need = Math.max(0, total - players.length);
    const choose = (kind) => {
      const mine = shuffle(this.book.custom.filter((s) => s.kind === kind && !used.has(s.id))).slice(0, 3);
      const rest = shuffle(this.book.builtin.filter((s) => s.kind === kind && !used.has(s.id)));
      const all = shuffle(mine.concat(rest.slice(0, Math.max(0, need - mine.length))));
      const pool = this.book.builtin.filter((s) => s.kind === kind);
      while (all.length < need) all.push(pool[all.length % pool.length]);
      return all;
    };
    const d = choose('driver'), v = choose('vehicle');
    return d.map((driver, i) => ({ driver, vehicle: v[i] }));
  }

  // cfg: { trackId, players: [{driver, vehicle}], difficulty, mode: mode id (default 'race'), opts: mode options,
  //        label, opponents (optional), age (optional) }. Arena modes get the arena variant of the world.
  startRace(cfg) {
    this.lastCfg = cfg;
    this.ui.hide();
    this.loadingEl.classList.remove('hide');
    setTimeout(() => {
      this.clearPreview();
      const M = modeById(cfg.mode);
      this.buildWorld(M.arena ? arenaDef(cfg.trackId) : cfg.trackId);
      if (this.race) this.endRace(true);
      this.hudRoot.replaceChildren();
      this.hudRoot.classList.toggle('two', cfg.players.length > 1);
      if (this.ceremony) this.endCeremony(true);
      this.race = new Race(this, this.world, {
        players: cfg.players, opponents: cfg.opponents || this.pickOpponents(cfg.players, M.karts), difficulty: cfg.difficulty, label: cfg.label,
        mode: M.id, opts: cfg.opts || {}, age: cfg.age,
      });
      this.pauseBtn = h('button', { class: 'pause-btn', 'aria-label': t('paused'), html: ICON.pause, onclick: (e) => { e.stopPropagation(); this.setPaused(true); } });
      this.hudRoot.append(this.pauseBtn);
      if (cfg.players.length > 1) this.hudRoot.append(h('div', { class: 'split-line' }));
      this.paused = false;
      this.frames = 0; this.frameAcc = 0;
      this.loadingEl.classList.add('hide');
    }, 40);
  }

  restartRace() {
    if (this.lastCfg) this.startRace(this.lastCfg);
  }

  endRace(keepMusic) {
    if (!this.race) return;
    this.race.dispose();
    this.race = null;
    this.hudRoot.replaceChildren();
    this.input.clearTouch();
    this.camReady = false;
    if (!keepMusic) this.audio.startMusic('menu');
  }

  // results: { headline, rows } from the mode (see Mode.results).
  onRaceDone(results) {
    const cup = this.cup;
    if (cup && !cup.scored[cup.index]) {
      // Grand Prix: hand out points for this race.
      cup.scored[cup.index] = true;
      for (const r of results.rows) {
        const e = cup.entries[r.index];
        r.points = CUP_POINTS[r.place - 1] || 0;
        e.points += r.points; e.places.push(r.place);
      }
    }
    if (cup) for (const r of results.rows) r.extra = (r.extra || []).concat({ text: `+${r.points || 0}`, cls: 'pt' });
    this.ui.show('results', { results, cup });
  }

  // ----- Grand Prix -----
  // cfg: { players, difficulty, cup: cup id (default: the first cup in js/cups.js) }
  startCup(cfg) {
    const cupDef = cupById(cfg.cup);
    const opponents = this.pickOpponents(cfg.players, modeById('race').karts);
    const entry = (p, human, i) => ({ driver: p.driver, vehicle: p.vehicle, name: p.driver.name, human, playerIndex: human ? i : -1, points: 0, places: [] });
    this.cup = {
      id: cupDef.id, tracks: cupDef.tracks.slice(), index: 0, scored: [], players: cfg.players, opponents, difficulty: cfg.difficulty,
      entries: cfg.players.map((p, i) => entry(p, true, i)).concat(opponents.map((o, i) => entry(o, false, i))),
    };
    this.startCupRace();
  }

  startCupRace() {
    const c = this.cup;
    this.startRace({
      mode: 'race', trackId: c.tracks[c.index], players: c.players, opponents: c.opponents, difficulty: c.difficulty,
      label: `${t('race')} ${c.index + 1}/${c.tracks.length}`,
    });
  }

  // Entries sorted best first: points, then best single result, then the sum of places.
  cupStandings() {
    const best = (e) => (e.places.length ? Math.min(...e.places) : 99);
    const sum = (e) => e.places.reduce((a, b) => a + b, 0);
    return this.cup.entries.slice().sort((a, b) => b.points - a.points || best(a) - best(b) || sum(a) - sum(b));
  }

  nextCupRace() {
    const c = this.cup;
    if (c.index + 1 < c.tracks.length) { c.index++; this.startCupRace(); }
    else this.startCeremony();
  }

  startCeremony() {
    const ranking = this.cupStandings();
    // Remember the best result of a human player in this cup (1 = gold, 2 = silver, 3 = bronze).
    const best = ranking.findIndex((e) => e.human) + 1;
    if (this.cup && best >= 1 && best <= 3) {
      const cb = this.settings.cupBest = this.settings.cupBest || {};
      if (!cb[this.cup.id] || best < cb[this.cup.id]) { cb[this.cup.id] = best; saveSettings(this.settings); }
    }
    this.endRace(true);
    this.ceremony = new Ceremony(this, this.world, ranking);
    this.audio.startMusic('podium');
    this.audio.play('win', 1);
    this.ui.show('ceremony', ranking);
  }

  endCeremony(keepMusic) {
    if (!this.ceremony) return;
    this.ceremony.dispose();
    this.ceremony = null;
    this.camReady = false;
    if (!keepMusic) this.audio.startMusic('menu');
  }

  // The pause menu's "End": show the results of the race as it stands.
  endRaceNow() {
    if (!this.race) return;
    this.setPaused(false);
    this.race.mode.endNow();
  }

  quitToMenu() {
    this.endRace(true);
    this.endCeremony(true);
    this.cup = null;
    this.audio.startMusic('menu');
  }

  setPaused(on) {
    if (!this.race) return;
    this.paused = on;
    if (on) { this.audio.engine([], null); this.ui.show('pause'); }
    else if (this.ui.current === 'pause') this.ui.hide();
  }

  // ----- loop -----
  frame(now) {
    requestAnimationFrame((n) => this.frame(n));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;
    const w = this.world;
    if (!w) return;
    document.body.classList.toggle('touch', this.input.touchMode);
    if (this.race) {
      if (!this.paused) {
        const steps = Math.max(1, Math.round(this.timeScale)) * (dt > 1 / 40 ? 2 : 1);
        const sdt = (dt * this.timeScale) / steps;
        for (let i = 0; i < steps && this.race; i++) { w.update(sdt); this.race.update(sdt); }
      }
    } else if (this.ceremony) {
      w.update(dt);
      this.ceremony.update(dt);
    } else {
      w.update(dt);
      this.updateMenu(dt);
    }
    this.input.endFrame();
    if (!this.noRender) this.render();
    // Drop the render resolution a notch if this device struggles.
    if (!this.fixedQuality) {
      this.frames++; this.frameAcc += dt;
      if (this.frames >= 90) {
        const avg = this.frameAcc / this.frames;
        this.frames = 0; this.frameAcc = 0;
        if (avg > 1 / 38) {
          // Too slow: first lower the resolution a little, then drop the shadows, then lower it further.
          if (this.pixelRatio > 1.25) { this.pixelRatio = Math.max(1.25, this.pixelRatio - 0.25); this.resize(); }
          else if (!this.lowGraphics && this.settings.fancy !== false) { this.lowGraphics = true; this.applyGraphics(); }
          else if (this.pixelRatio > 0.75) { this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25); this.resize(); }
        }
      }
    }
  }

  render() {
    const r = this.renderer, w = this.world, W = this.vw, H = this.vh;
    const cams = this.race ? this.race.cams.map((c) => c.cam) : this.ceremony ? [this.ceremony.cam] : [this.menuCam];
    const n = cams.length;
    r.setScissorTest(n > 1);
    for (let i = 0; i < n; i++) {
      const cam = cams[i];
      const vw = W / n, x = i * vw;
      const aspect = vw / H;
      const shift = this.race ? 0 : this.ceremony ? this.ceremony.shift : this.menuView === 'kart' ? 0.17 : 0;
      if (Math.abs(cam.aspect - aspect) > 1e-4 || cam.userData.shift !== shift) {
        cam.aspect = aspect; cam.userData.shift = shift;
        if (shift) cam.setViewOffset(vw, H, 0, H * shift, vw, H); else cam.clearViewOffset();
        cam.updateProjectionMatrix();
      }
      r.setViewport(x, 0, vw, H);
      if (n > 1) r.setScissor(x, 0, vw, H);
      // Shadows are drawn in a box around what this view is looking at.
      const f = this.race ? this.race.cams[i].kart : null;
      if (f) w.focusShadow(f.x + Math.sin(f.dir) * 26, f.y, f.z + Math.cos(f.dir) * 26);
      else if (this.ceremony) w.focusShadow(this.ceremony.focus.x, this.ceremony.focus.y, this.ceremony.focus.z);
      else w.focusShadow(this.camLook.x, this.camLook.y, this.camLook.z);
      const scale = (H * this.pixelRatio) / (2 * Math.tan((cam.fov * Math.PI) / 360));
      for (const u of w.pointScaleUniforms) u.value = scale;
      if (this.race) this.race.particles.setScale(scale);
      if (this.ceremony) this.ceremony.particles.setScale(scale);
      r.render(w.scene, cam);
    }
  }
}

const game = new Game();
window.__kk = game; // handy for tinkering in the browser console
game.start().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Oops: ' + (e && e.message ? e.message : e);
});
