// Explore: no race. Drive around a world and find 10 hidden golden stickers (some on the road, some just off
// it, some above boost pads). Found stickers are remembered per world (own localStorage key).
import * as THREE from '../../vendor/three.module.min.js';
import { Mode } from './base.js';
import { addStrings, t } from '../i18n.js';
import { mulberry32, makeCanvas, canvasTexture } from '../util.js';
import './sfx.js';

addStrings({
  en: { modes: { roam: 'Explore' }, modeSub: { roam: 'Find the golden stickers' }, roam: { near: 'Golden sticker this way', all: 'All 10 stickers found!', found: 'Found', of: 'of', sticker: 'Sticker', allShort: 'All found!', metres: 'm' } },
  nl: { modes: { roam: 'Ontdekken' }, modeSub: { roam: 'Zoek de gouden stickers' }, roam: { near: 'Gouden sticker deze kant op', all: 'Alle 10 stickers gevonden!', found: 'Gevonden', of: 'van', sticker: 'Sticker', allShort: 'Alles gevonden!', metres: 'm' } },
});

const KEY = 'krabbel-kart-stickers';
const COUNT = 10;
const CONFETTI = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff, 0xff7ac0];
const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8 20 22 2-17 14 5 22-18-12-18 12 5-22L2 26l22-2z" fill="#ffd21f" stroke="#2a2433" stroke-width="5" stroke-linejoin="round"/></svg>';
const _loc = {}, _v = new THREE.Vector3(), _d = new THREE.Object3D();

// ---- saved: { v: 1, w: { worldId: { f: [found indices], d: times all were found } } } ----
function loadAll() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && o.v === 1 && o.w && typeof o.w === 'object' ? o.w : {};
  } catch (e) { return {}; }
}

function saveAll(w) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, w })); } catch (e) { /* storage unavailable */ }
}

function entryOf(all, world) {
  const e = all[world];
  const f = e && Array.isArray(e.f) ? e.f.filter((i) => Number.isInteger(i) && i >= 0 && i < COUNT) : [];
  return { f: f.filter((v, i) => f.indexOf(v) === i), d: e && Number.isInteger(e.d) && e.d > 0 ? e.d : 0 };
}

export function stickersFound(world) {
  const e = entryOf(loadAll(), world);
  return e.f.length === 0 && e.d > 0 ? COUNT : e.f.length;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Deterministic spots: 4 on the road, 3 just off it (inside the drivable band), 3 above boost pads.
function placeStickers(world) {
  const tr = world.track, hw = tr.halfWidth, rnd = mulberry32(hashStr(world.def.id) + 7), pads = world.boostPads || [], out = [];
  for (let i = 0; i < COUNT; i++) {
    const f = Math.min(0.96, Math.max(0.05, (i + 0.5) / COUNT + (rnd() - 0.5) * 0.05));
    let s = f * tr.n, lat, up = 1.7;
    const kind = i % 3 === 2 && pads.length ? 'pad' : i % 3 === 1 ? 'off' : 'road';
    if (kind === 'pad') { const p = pads[((i / 3) | 0) % pads.length]; s = p.s + 4; lat = p.lat; up = 2.3; }
    else if (kind === 'off') lat = (rnd() < 0.5 ? -1 : 1) * (hw + 3.4 + rnd());
    else lat = (rnd() - 0.5) * 2 * (hw - 3);
    tr.posAt(s, lat, _v);
    const g = world.groundAt(_v.x, _v.z, tr.locate(_v.x, _v.z, -1, _loc));
    out.push({ x: _v.x, y: g + up, z: _v.z, g, kind });
  }
  return out;
}

function starShape(r1, r2) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? r2 : r1;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  return sh;
}

class Roam extends Mode {
  static options(settings) { return []; }
  static cardNote(worldId) { return `${stickersFound(worldId)}/${COUNT}`; }

  constructor(race, opts) {
    super(race, opts);
    this.spots = placeStickers(race.world);
    this.found = new Uint8Array(COUNT); this.count = 0; this.allFound = false; this.sparkT = 0; this.goal = { x: 0, z: 0 };
    const all = loadAll(), e = entryOf(all, race.world.def.id);
    this.saved = e;
    // A world that was completed starts afresh for the next round.
    if (e.f.length < COUNT) for (const i of e.f) { this.found[i] = 1; this.count++; }
    this.build();
  }

  get allowRubberBand() { return false; }
  get skipCountdown() { return true; }
  get showWrongWay() { return false; }
  lapCount() { return Infinity; }
  canEnd() { return this.race.state === 'racing'; }
  isOver() { return this.allFound; }

  build() {
    const scene = this.race.world.scene;
    const geoIn = new THREE.ExtrudeGeometry(starShape(1.0, 0.46), { depth: 0.3, bevelEnabled: false });
    geoIn.translate(0, 0, -0.15);
    const geoOut = new THREE.ExtrudeGeometry(starShape(1.0, 0.46), { depth: 0.5, bevelEnabled: false });
    geoOut.translate(0, 0, -0.25);
    this.fill = new THREE.InstancedMesh(geoIn, new THREE.MeshBasicMaterial({ color: 0xffd21f, fog: false }), COUNT);
    this.rim = new THREE.InstancedMesh(geoOut, new THREE.MeshBasicMaterial({ color: 0x2a2433 }), COUNT);
    // Light beams so stickers are seen from afar: additive, fading upwards, not dimmed by the fog.
    const c = makeCanvas(4, 64), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.8)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    this.tex = canvasTexture(c, { mip: false });
    const geoB = new THREE.CylinderGeometry(0.7, 1.4, 46, 10, 1, true);
    this.beam = new THREE.InstancedMesh(geoB, new THREE.MeshBasicMaterial({ map: this.tex, color: 0xffd860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }), COUNT);
    for (const m of [this.fill, this.rim, this.beam]) { m.frustumCulled = false; scene.add(m); }
    this.fill.renderOrder = 3; this.rim.renderOrder = 2; this.beam.renderOrder = 6;
    this.spin();
  }

  spin() {
    const time = this.race.clock || 0;
    for (let i = 0; i < COUNT; i++) {
      const s = this.spots[i], on = !this.found[i];
      _d.position.set(s.x, s.y + Math.sin(time * 2.4 + i) * 0.25, s.z);
      _d.rotation.set(0, time * 1.8 + i, 0);
      _d.scale.setScalar(on ? 1.5 : 0.0001);
      _d.updateMatrix(); this.fill.setMatrixAt(i, _d.matrix);
      _d.scale.setScalar(on ? 1.5 * 1.28 : 0.0001);
      _d.updateMatrix(); this.rim.setMatrixAt(i, _d.matrix);
      _d.position.set(s.x, s.g + 23, s.z); _d.rotation.set(0, 0, 0); _d.scale.set(on ? 1 : 0.0001, 1, on ? 1 : 0.0001);
      _d.updateMatrix(); this.beam.setMatrixAt(i, _d.matrix);
    }
    this.fill.instanceMatrix.needsUpdate = this.rim.instanceMatrix.needsUpdate = this.beam.instanceMatrix.needsUpdate = true;
  }

  setup() {
    super.setup();
    // The company pootles along slowly.
    this.race.karts.forEach((k) => { if (!k.human) k.skill = 0.36 + Math.random() * 0.12; });
  }

  update(dt) {
    super.update(dt);
    const race = this.race, P = race.particles;
    this.spin();
    for (const k of race.karts) if (!k.human && (k.item || k.rollT > 0)) { k.item = null; k.rollT = 0; k.rollPick = null; } // company only plays, never shoots
    if (race.state === 'racing' && !this.allFound) {
      for (let i = 0; i < COUNT; i++) {
        if (this.found[i]) continue;
        const s = this.spots[i];
        for (const k of race.humans) {
          const dx = k.x - s.x, dz = k.z - s.z;
          if (dx * dx + dz * dz < 9 && Math.abs(k.y + 1 - s.y) < 3.6) { this.collect(i, k); break; }
        }
      }
    }
    // Sparkles around stickers that are near.
    this.sparkT -= dt;
    if (this.sparkT <= 0 && !this.allFound) {
      this.sparkT = 0.1;
      for (let i = 0; i < COUNT; i++) {
        if (this.found[i]) continue;
        const s = this.spots[i], h = race.humans[0];
        if (Math.hypot(h.x - s.x, h.z - s.z) > 90) continue;
        P.emit(true, 0xfff2a0, { x: s.x + (Math.random() - 0.5) * 2.4, y: s.y + (Math.random() - 0.5) * 2, z: s.z + (Math.random() - 0.5) * 2.4, vy: 1.2, life: 0.8, size: 0.5, size1: 0, a: 0.9 });
      }
    }
    // The celebration: confetti keeps falling over the players.
    if (this.allFound) {
      for (const k of race.humans) {
        if (Math.random() < 0.7) P.emit(false, CONFETTI[Math.floor(Math.random() * CONFETTI.length)], { x: k.x + (Math.random() - 0.5) * 14, y: k.y + 9, z: k.z + (Math.random() - 0.5) * 14, vy: -2, life: 2.4, size: 0.4, size1: 0.4, gravity: 2, drag: 0.8 });
      }
    }
  }

  collect(i, k) {
    const race = this.race, s = this.spots[i], P = race.particles;
    this.found[i] = 1; this.count++;
    k.gesture('win');
    P.burst(true, [0xffe14a, 0xffffff, 0xff7ac0], 30, s.x, s.y, s.z, 8, { size: 0.7, life: 1, gravity: 3 });
    P.burst(false, CONFETTI, 18, s.x, s.y, s.z, 6, { size: 0.4, life: 1.4, gravity: 4 });
    for (const h of race.huds) h.message(`${t('roam.sticker')} ${this.count}/${COUNT}`, 1.5, 'split');
    race.game.audio.play('mode-sticker', 1);
    const all = loadAll(), id = race.world.def.id, e = entryOf(all, id);
    e.f = []; for (let j = 0; j < COUNT; j++) if (this.found[j]) e.f.push(j);
    if (this.count >= COUNT) {
      this.allFound = true; e.d++;
      for (const h of race.huds) h.message(t('roam.allShort'), 3, 'final');
      race.game.audio.play('mode-allfound', 1);
      for (const kk of race.humans) for (let n = 0; n < 4; n++) P.burst(false, CONFETTI, 40, kk.x + (Math.random() - 0.5) * 8, kk.y + 4 + Math.random() * 3, kk.z + (Math.random() - 0.5) * 8, 9, { size: 0.42, size1: 0.42, life: 2.6, gravity: 5, drag: 1.2 });
    }
    all[id] = e;
    saveAll(all);
  }

  nearest(k) {
    let best = -1, bd = 1e18;
    for (let i = 0; i < COUNT; i++) {
      if (this.found[i]) continue;
      const dx = this.spots[i].x - k.x, dz = this.spots[i].z - k.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Only a player under autopilot (or the rocket) is steered: it drives to the nearest sticker.
  aiGoal(kart) {
    if (!kart.human || this.allFound) return null;
    const i = this.nearest(kart);
    if (i < 0) return null;
    this.goal.x = this.spots[i].x; this.goal.z = this.spots[i].z;
    return this.goal;
  }

  onLap(kart) {}

  // Minimap: little ones see every hidden sticker, big ones only the nearest.
  mapMarks() {
    const pool = this.pool || (this.pool = Array.from({ length: COUNT }, () => ({ x: 0, z: 0, color: '#ffd21f', shape: 'sticker' })));
    const out = this.mm || (this.mm = []);
    const near = this.race.age === 'little' ? -1 : this.nearest(this.race.humans[0]);
    let c = 0;
    for (let i = 0; i < COUNT; i++) {
      if (this.found[i] || (near >= 0 && i !== near)) continue;
      const m = pool[c]; m.x = this.spots[i].x; m.z = this.spots[i].z; m.shape = 'sticker'; out[c++] = m;
    }
    out.length = c;
    return out;
  }

  hudInfo(kart) {
    return { place: null, lap: null, extra: [{ icon: STAR_SVG, text: `${this.count}/${COUNT}` }] };
  }

  hudBanner(kart) {
    if (this.allFound) return { text: t('roam.allShort'), cls: 'go' };
    const i = this.nearest(kart);
    if (i < 0 || this.race.state === 'intro') return null;
    const s = this.spots[i], dx = s.x - kart.x, dz = s.z - kart.z;
    let a = Math.atan2(dx, dz) - kart.dir;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const arrow = Math.abs(a) < 0.45 ? '▲' : Math.abs(a) > 2.2 ? '▼' : a > 0 ? '▶' : '◀';
    const dist = Math.round(Math.hypot(dx, dz) / 10) * 10;
    return { text: `${arrow} ${t('roam.near')}`, sub: `${dist} ${t('roam.metres')}` };
  }

  results() {
    const race = this.race;
    return {
      headline: this.allFound ? t('roam.all') : `${t('roam.found')} ${this.count} ${t('roam.of')} ${COUNT}`,
      rows: race.humans.map((k, i) => ({
        place: i + 1, name: k.name, human: true, playerIndex: k.playerIndex, driver: k.driver, index: race.karts.indexOf(k),
        extra: [{ text: `${this.count}/${COUNT}` }],
      })),
    };
  }

  dispose() {
    const scene = this.race.world.scene;
    for (const m of [this.fill, this.rim, this.beam]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.tex.dispose();
  }
}

Object.assign(Roam, {
  id: 'roam', karts: 4, humanRows: true,
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="27" cy="27" r="19" fill="#c9f0ff"/><path d="M41 41l16 16" stroke-width="8"/><path d="M27 12l5 10 11 1-8 8 2 11-10-6-10 6 2-11-8-8 11-1z" fill="#ffd21f" stroke-width="3"/></svg>',
});

export default Roam;
