// Time Trial: alone on the track with three turbo crayons. The best time per world and speed is saved
// (own localStorage key) together with a compact ghost, replayed as a see-through copy of the racer.
import * as THREE from '../../vendor/three.module.min.js';
import { Mode } from './base.js';
import { addStrings, t } from '../i18n.js';
import { itemById } from '../items.js';
import { buildRacerModel, disposeRacerModel } from '../racerModel.js';
import { formatTime, angleDiff } from '../util.js';
import './sfx.js';

addStrings({
  en: { modes: { time: 'Time Trial' }, modeSub: { time: 'Beat your best time' }, tt: { lap: 'Lap', record: 'New record!', best: 'Best', turbos: 'Turbos' } },
  nl: { modes: { time: 'Tijdrit' }, modeSub: { time: 'Verbeter je tijd' }, tt: { lap: 'Ronde', record: 'Nieuw record!', best: 'Beste', turbos: 'Turbo\'s' } },
});

const KEY = 'krabbel-kart-times';
const HZ = 10, CAP = 3000; // ghost samples per second, and at most 5 minutes of them
const LAPS = 3;

// ---- saved times: { v: 1, best: { 'world|speed': { t, laps: [..], g: 'ghost' } } }, robust against old or corrupt data ----
function loadAll() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && o.v === 1 && o.best && typeof o.best === 'object' ? o.best : {};
  } catch (e) { return {}; }
}

function saveAll(best) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, best })); } catch (e) { /* storage unavailable */ }
}

const keyOf = (world, diff) => `${world}|${diff || 'normal'}`;

function validEntry(e) {
  return e && typeof e === 'object' && Number.isFinite(e.t) && e.t > 0 && e.t < 3600;
}

export function bestTime(world, diff) {
  const e = loadAll()[keyOf(world, diff)];
  return validEntry(e) ? e.t : null;
}

// Positions in decimetres and heading in 1/50 radian, stored as base 36 deltas: small and robust.
function encodeGhost(a, n) {
  const out = [];
  let px = 0, pz = 0, pd = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i * 3], z = a[i * 3 + 1], d = a[i * 3 + 2];
    out.push((x - px).toString(36), (z - pz).toString(36), (d - pd).toString(36));
    px = x; pz = z; pd = d;
  }
  return out.join(',');
}

function decodeGhost(str) {
  if (typeof str !== 'string' || str.length > 400000) return null;
  const parts = str.split(',');
  if (parts.length < 6 || parts.length % 3 || parts.length > CAP * 3) return null;
  const n = parts.length / 3, g = { n, x: new Float32Array(n), z: new Float32Array(n), d: new Float32Array(n) };
  let x = 0, z = 0, d = 0;
  for (let i = 0; i < n; i++) {
    x += parseInt(parts[i * 3], 36); z += parseInt(parts[i * 3 + 1], 36); d += parseInt(parts[i * 3 + 2], 36);
    if (!Number.isFinite(x + z + d) || Math.abs(x) > 1e5 || Math.abs(z) > 1e5) return null;
    g.x[i] = x / 10; g.z[i] = z / 10; g.d[i] = d / 50;
  }
  return g;
}

const _loc = {};

// The see-through copy of the best run.
class Ghost {
  constructor(race, data, kart) {
    this.race = race; this.data = data; this.hint = -1; this.x = data.x[0]; this.z = data.z[0]; this.dir = data.d[0];
    const m = this.model = buildRacerModel(kart.driver, kart.vehicle);
    this.mats = [];
    const ghostify = (x) => { const c = x.clone(); c.transparent = true; c.opacity = 0.4; c.depthWrite = false; this.mats.push(c); return c; };
    if (m.vehicleMesh) { m.vehicleMesh.material = m.vehicleMesh.material.map(ghostify); m.vehicleMesh.castShadow = false; }
    if (m.driverMesh) {
      m.driverMesh.material = ghostify(m.driverMesh.material); m.driverMesh.castShadow = false;
      const self = this;
      m.driverMesh.onBeforeRender = (r, s, cam) => {
        const c = Math.atan2(cam.position.x - self.x, cam.position.z - self.z);
        m.pivot.rotation.y = -0.45 * Math.sin(2 * angleDiff(c, self.dir));
        m.pivot.updateMatrixWorld(true);
      };
    }
    m.root.visible = false;
    race.world.scene.add(m.root);
  }

  update(time, show) {
    const d = this.data, m = this.model, w = this.race.world;
    const f = Math.min(time * HZ, d.n - 1), i = Math.floor(f), u = f - i, j = Math.min(i + 1, d.n - 1);
    this.x = d.x[i] + (d.x[j] - d.x[i]) * u; this.z = d.z[i] + (d.z[j] - d.z[i]) * u;
    this.dir = d.d[i] + (d.d[j] - d.d[i]) * u;
    m.root.visible = show && time < (d.n - 1) / HZ + 3;
    if (!m.root.visible) return;
    w.track.locate(this.x, this.z, this.hint, _loc);
    this.hint = _loc.i;
    m.root.position.set(this.x, w.groundAt(this.x, this.z, _loc), this.z);
    m.root.rotation.y = this.dir;
  }

  dispose() {
    this.race.world.scene.remove(this.model.root);
    for (const c of this.mats) c.dispose();
    disposeRacerModel(this.model);
  }
}

class TimeTrial extends Mode {
  static options(settings) { return []; }

  static cardNote(worldId, settings) {
    const b = bestTime(worldId, settings.difficulty);
    return b === null ? null : formatTime(b);
  }

  constructor(race, opts) {
    super(race, opts);
    this.key = keyOf(race.world.def.id, race.cfg.difficulty);
    const e = loadAll()[this.key];
    this.best = validEntry(e) ? e : null;
    this.ghost = null; this.started = false; this.turbos = 3; this.useTurbo3 = !!itemById('turbo3');
    this.samples = new Int32Array(CAP * 3); this.nSamples = 0; this.overflow = false;
    this.splits = []; this.lapStart = 0; this.record = false;
  }

  lapCount() { return LAPS; }

  setup() {
    super.setup();
    const k = this.race.humans[0];
    let g = null;
    try { g = this.best && this.best.g ? decodeGhost(this.best.g) : null; } catch (e) { g = null; }
    if (g) this.ghost = new Ghost(this.race, g, k);
  }

  itemPool(kart) { return ['turbo', 'turbo3']; }

  update(dt) {
    super.update(dt);
    const race = this.race, k = race.humans[0];
    if (!this.started) { this.started = true; race.items.boxesEnabled = false; }
    if (race.state !== 'racing') { if (this.ghost) this.ghost.update(0, false); return; }
    // Three turbo crayons: one pack, or three single ones handed out one after the other.
    if (!this.given) { this.given = true; if (this.useTurbo3) race.items.give(k, 'turbo3'); }
    if (!this.useTurbo3 && !k.item && k.rollT <= 0 && this.turbos > 0) { this.turbos--; race.items.give(k, 'turbo'); }
    if (!k.finished) {
      if (race.time > CAP / HZ - 1) this.overflow = true;
      while (!this.overflow && this.nSamples < CAP && race.time >= this.nSamples / HZ) {
        const i = this.nSamples++ * 3;
        this.samples[i] = Math.round(k.x * 10); this.samples[i + 1] = Math.round(k.z * 10); this.samples[i + 2] = Math.round(k.dir * 50);
      }
    }
    if (this.ghost) this.ghost.update(race.time, true);
  }

  onLap(kart) {
    const race = this.race, split = race.time - this.lapStart;
    this.lapStart = race.time; this.splits.push(split);
    let text = `${t('tt.lap')} ${kart.lap}  ${formatTime(split)}`, cls = 'split';
    const b = this.best && this.best.laps && this.best.laps[kart.lap - 1];
    if (Number.isFinite(b)) {
      const d = split - b;
      text += `  ${d <= 0 ? '' : '+'}${d.toFixed(2)}`;
      cls += d <= 0 ? ' good' : ' bad';
    }
    race.huds[0].message(text, 2.4, cls);
    race.game.audio.play('mode-split', 1);
  }

  onFinish(kart) {
    super.onFinish(kart);
    const race = this.race;
    this.splits.push(kart.finishTime - this.lapStart);
    if (this.best && this.best.t <= kart.finishTime) return;
    // A new best: save the time, the splits and the ghost.
    this.record = true;
    const all = loadAll();
    all[this.key] = { t: Math.round(kart.finishTime * 100) / 100, laps: this.splits.map((s) => Math.round(s * 100) / 100) };
    if (!this.overflow && this.nSamples > 2) all[this.key].g = encodeGhost(this.samples, this.nSamples);
    saveAll(all);
    race.huds[0].message(t('tt.record'), 3, 'final');
    race.game.audio.play('mode-record', 1);
    for (let i = 0; i < 40; i++) {
      race.particles.emit(true, [0xffe14a, 0xff7ac0, 0x4fe9ff, 0xffffff][i % 4], { x: kart.x + (Math.random() - 0.5) * 6, y: kart.y + 2 + Math.random() * 3, z: kart.z + (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 4, life: 1.6, size: 0.6, size1: 0.1, gravity: 4 });
    }
  }

  hudInfo(kart) {
    const race = this.race;
    const left = this.useTurbo3 ? (kart.item === 'turbo3' ? kart.itemUses : 0) : this.turbos + (kart.item ? 1 : 0);
    const d = itemById('turbo');
    const extra = [{ icon: d ? d.icon : '', text: `x${left}` }];
    if (this.best) extra.push({ icon: '', text: `${t('tt.best')} ${formatTime(this.best.t)}` });
    return { place: null, lap: `${t('tt.lap')} ${Math.min(kart.lap + 1, LAPS)}/${LAPS}`, extra };
  }

  dispose() { if (this.ghost) this.ghost.dispose(); this.ghost = null; }

  results() {
    const race = this.race, k = race.humans[0];
    race.rank();
    const best = this.record ? k.finishTime : this.best ? this.best.t : null;
    return {
      wide: true,
      headline: this.record ? t('tt.record') : best !== null ? `${t('tt.best')} ${formatTime(best)}` : t('modes.time'),
      rows: [{
        place: 1, name: k.name, human: true, playerIndex: 0, driver: k.driver, index: 0,
        time: k.finished ? k.finishTime : null,
        extra: this.splits.map((s, i) => ({ text: `${i + 1}: ${formatTime(s)}` })),
      }],
    };
  }
}

Object.assign(TimeTrial, {
  id: 'time', ages: ['big'], karts: 1, maxPlayers: 1,
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M26 6h12M32 6v6"/><circle cx="32" cy="36" r="22" fill="#fff"/><circle cx="32" cy="36" r="17" fill="#c9f0ff" stroke-width="2.5"/><path d="M32 36V23" stroke-width="4.5"/><path d="M32 36l9 6" stroke="#ff4b4b" stroke-width="4"/><path d="M50 12l5 5" stroke-width="5"/><path d="M32 22v-2M32 52v-2M17 36h2M45 36h2" stroke-width="3"/></svg>',
});

export default TimeTrial;
