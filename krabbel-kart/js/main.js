// Krabbel Kart: boots the game, owns the render loop and glues everything together.
import * as THREE from 'three';
import { trackById } from './tracks.js';
import { World } from './world.js';
import { Race } from './race.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { StickerBook, loadSettings, saveSettings } from './store.js';
import { buildRacerModel, disposeRacerModel } from './racerModel.js';
import { UI } from './ui.js';
import { h, ICON } from './dom.js';
import { setLang, detectLang, t } from './i18n.js';
import { damp } from './util.js';

const TOTAL_KARTS = 8;

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
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.pixelRatio = this.fixedQuality ? Number(q.get('q')) || 1 : this.maxPixelRatio;
    this.input = new Input();
    this.audio = new GameAudio(this.settings);
    this.book = new StickerBook();
    this.ui = new UI(this);
    this.menuCam = new THREE.PerspectiveCamera(56, 1, 0.3, 4000);
    this.world = null; this.race = null; this.paused = false;
    this.preview = null; this.previewPick = null;
    this.menuView = 'fly'; this.flyS = 0; this.orbit = 0.6;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camReady = false;
    this.last = 0; this.frames = 0; this.frameAcc = 0; this.timeScale = 1;
    this._v = new THREE.Vector3(); this._l = new THREE.Vector3();

    const unlock = () => { this.audio.unlock(); this.audio.applySettings(); };
    addEventListener('pointerdown', unlock, { passive: true });
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
    this.resize();
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
  buildWorld(id) {
    if (this.world && this.world.def.id === id) return;
    if (this.preview && this.world) this.world.scene.remove(this.preview.root, this.preview.shadow);
    if (this.world) this.world.dispose();
    this.world = new World(trackById(id));
    this.flyS = this.world.track.n * 0.03;
    this.camReady = false;
    if (this.preview) this.placePreview();
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
    disposeRacerModel(this.preview);
    this.preview = null; this.previewPick = null;
  }

  setPreview(driver, vehicle) {
    const key = `${driver.id}|${vehicle.id}`;
    if (this.previewPick === key) return;
    this.clearPreview();
    this.preview = buildRacerModel(driver, vehicle);
    this.previewPick = key;
    this.preview.pop = 1;
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
      m.pop = damp(m.pop, 0, 6, dt);
      const s = 1 + Math.sin(m.pop * Math.PI) * 0.25;
      m.body.scale.set(s, 1 + m.pop * 0.3, s);
      m.body.position.y = Math.abs(Math.sin(w.time * 2.2)) * 0.06;
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
  pickOpponents(players) {
    const used = new Set();
    for (const p of players) { used.add(p.driver.id); used.add(p.vehicle.id); }
    const need = TOTAL_KARTS - players.length;
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

  startRace(cfg) {
    this.lastCfg = cfg;
    this.ui.hide();
    this.loadingEl.classList.remove('hide');
    setTimeout(() => {
      this.clearPreview();
      this.buildWorld(cfg.trackId);
      if (this.race) this.endRace(true);
      this.hudRoot.replaceChildren();
      this.hudRoot.classList.toggle('two', cfg.players.length > 1);
      this.race = new Race(this, this.world, {
        players: cfg.players, opponents: this.pickOpponents(cfg.players), difficulty: cfg.difficulty, laps: 3,
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

  onRaceDone(results) {
    this.ui.show('results', results);
  }

  setPaused(on) {
    if (!this.race) return;
    this.paused = on;
    if (on) { this.audio.engine([], false); this.ui.show('pause'); }
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
    } else {
      w.update(dt);
      this.updateMenu(dt);
    }
    if (!this.noRender) this.render();
    // Drop the render resolution a notch if this device struggles.
    if (!this.fixedQuality) {
      this.frames++; this.frameAcc += dt;
      if (this.frames >= 90) {
        const avg = this.frameAcc / this.frames;
        this.frames = 0; this.frameAcc = 0;
        if (avg > 1 / 38 && this.pixelRatio > 0.75) { this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25); this.resize(); }
      }
    }
  }

  render() {
    const r = this.renderer, w = this.world, W = this.vw, H = this.vh;
    const cams = this.race ? this.race.cams.map((c) => c.cam) : [this.menuCam];
    const n = cams.length;
    r.setScissorTest(n > 1);
    for (let i = 0; i < n; i++) {
      const cam = cams[i];
      const vw = W / n, x = i * vw;
      const aspect = vw / H;
      const shift = !this.race && this.menuView === 'kart' ? 0.17 : 0;
      if (Math.abs(cam.aspect - aspect) > 1e-4 || cam.userData.shift !== shift) {
        cam.aspect = aspect; cam.userData.shift = shift;
        if (shift) cam.setViewOffset(vw, H, 0, H * shift, vw, H); else cam.clearViewOffset();
        cam.updateProjectionMatrix();
      }
      r.setViewport(x, 0, vw, H);
      if (n > 1) r.setScissor(x, 0, vw, H);
      const scale = (H * this.pixelRatio) / (2 * Math.tan((cam.fov * Math.PI) / 360));
      for (const u of w.pointScaleUniforms) u.value = scale;
      if (this.race) this.race.particles.setScale(scale);
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
