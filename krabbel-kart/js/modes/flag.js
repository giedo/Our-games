// Capture the Flag: red against blue, four karts each. Drive through the enemy base to take their flag
// and bring it to your own base. A hit on the carrier drops the flag, a team mate sends it home.
import * as THREE from '../../vendor/three.module.min.js';
import { BattleMode, timeOption, clock, hex } from './battle.js';
import { addStrings, t } from '../i18n.js';
import { makeCanvas, canvasTexture, mergeColored, mat4, TAU } from '../util.js';

addStrings({
  en: { modes: { flag: 'Capture the Flag' }, modeSub: { flag: 'Red against blue: steal their flag' } },
  nl: { modes: { flag: 'Vlaggenroof' }, modeSub: { flag: 'Rood tegen blauw: pak hun vlag' } },
});

const TEAM = [0xe8312f, 0x2f7bf0];
const WIN = 3, R_PICK = 7.5, R_BASE = 8.5, RETURN_T = 12;
const _v = new THREE.Vector3();
const svgFlag = (c, dim) => `<svg viewBox="0 0 32 40"><path d="M6 38V4" stroke="#2a2433" stroke-width="3.5" stroke-linecap="round"/><path d="M7 5h20l-6 8 6 8H7z" fill="${dim ? '#9a94a6' : hex(c)}" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/></svg>`;

function emblemTexture(team, disc) {
  const S = disc ? 256 : 128, c = makeCanvas(S, disc ? S : 80), g = c.getContext('2d'), col = hex(TEAM[team]);
  const emblem = (x, y, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    if (team === 0) for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    else { g.arc(x, y, r * 0.8, 0, TAU); g.arc(x, y, r * 0.42, 0, TAU, true); }
    g.closePath(); g.fill('evenodd');
  };
  if (disc) {
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, TAU); g.fillStyle = col; g.fill();
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.3, 0, TAU); g.fillStyle = col; g.fill();
    emblem(S / 2, S / 2, S * 0.24);
  } else {
    g.fillStyle = col; g.fillRect(0, 0, S, 80);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(4, 4, S - 8, 72);
    emblem(S / 2, 40, 26);
  }
  return canvasTexture(c);
}

// The 3D bits: two flags, two base discs and light beams, a ring under every kart, a pennant on every kart.
class FlagVisuals {
  constructor(mode) {
    const race = mode.race, scene = race.world.scene, tr = race.world.track, n = race.karts.length, free = [];
    this.mode = mode; this.scene = scene; this.free = free;
    this.flags = [0, 1].map((team) => {
      const grp = new THREE.Group();
      const tex = emblemTexture(team, false);
      const pole = new THREE.Mesh(mergeColored([
        { geo: new THREE.CylinderGeometry(0.1, 0.13, 5.6, 6), color: 0xf2f2f2, matrix: mat4(0, 2.8, 0) },
        { geo: new THREE.SphereGeometry(0.28, 8, 6), color: 0xffd21f, matrix: mat4(0, 5.7, 0) },
      ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
      const bg = new THREE.PlaneGeometry(2.8, 1.75); bg.translate(1.4, 0, 0);
      const banner = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x555555, emissiveMap: tex }));
      banner.position.y = 4.7;
      grp.add(pole, banner);
      scene.add(grp);
      free.push(() => { scene.remove(grp); pole.geometry.dispose(); pole.material.dispose(); bg.dispose(); banner.material.dispose(); tex.dispose(); });
      return { grp, banner };
    });
    this.discs = [0, 1].map((team) => {
      const tex = emblemTexture(team, true), geo = new THREE.PlaneGeometry(R_BASE * 2, R_BASE * 2); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
      const bg = new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true); bg.translate(0, 30, 0);
      const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: TEAM[team], transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.renderOrder = 1;
      scene.add(m, beam);
      free.push(() => { scene.remove(m, beam); geo.dispose(); m.material.dispose(); tex.dispose(); bg.dispose(); beam.material.dispose(); });
      return { m, beam };
    });
    const rg = new THREE.RingGeometry(1.45, 2.05, 22); rg.rotateX(-Math.PI / 2);
    const rmat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    this.rings = new THREE.InstancedMesh(rg, rmat, n);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.7, 0, 0, 0.7, 0, 0, 1.2, -1.5], 3));
    const pen = mergeColored([
      { geo: new THREE.CylinderGeometry(0.045, 0.045, 1.8, 4), color: 0xdddddd, matrix: mat4(0, 0.9, 0) },
      { geo: pg, color: 0xffffff },
    ]);
    const pmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x333333 });
    this.pens = new THREE.InstancedMesh(pen, pmat, n);
    const c = new THREE.Color();
    race.karts.forEach((k, i) => { this.rings.setColorAt(i, c.setHex(TEAM[k.team])); this.pens.setColorAt(i, c.setHex(TEAM[k.team])); });
    for (const m of [this.rings, this.pens]) { m.frustumCulled = false; scene.add(m); }
    this.rings.renderOrder = 2;
    free.push(() => { scene.remove(this.rings, this.pens); rg.dispose(); rmat.dispose(); pen.dispose(); pmat.dispose(); });
    this.d = new THREE.Object3D(); this.tr = tr;
  }

  update(time) {
    const mode = this.mode, d = this.d;
    for (let i = 0; i < 2; i++) {
      const f = mode.flags[i], v = this.flags[i], carried = f.state === 'carried';
      const sc = carried ? 0.5 : 1, c = f.carrier;
      v.grp.position.set(f.x - (carried ? Math.sin(c.dir) * 1.3 : 0), f.y + (carried ? c.model.topY * c.scaleVis * 0.5 : 0), f.z - (carried ? Math.cos(c.dir) * 1.3 : 0));
      v.grp.scale.setScalar(sc);
      v.grp.rotation.set(0, carried ? f.carrier.dir : 0, f.state === 'dropped' ? 0.45 : 0);
      v.grp.visible = f.state !== 'dropped' || f.returnT > 3 || Math.floor(time * 6) % 2 === 0;
      v.banner.rotation.y = Math.sin(time * 4 + i * 2) * 0.22;
      v.banner.scale.x = 1 + Math.sin(time * 5 + i) * 0.05;
    }
    for (let i = 0; i < 2; i++) { const b = mode.base[i]; this.discs[i].m.position.set(b.x, b.y + 0.05, b.z); this.discs[i].beam.position.set(b.x, b.y, b.z); }
    mode.race.karts.forEach((k, i) => {
      const sv = k.scaleVis, fx = Math.sin(k.dir), fz = Math.cos(k.dir);
      d.position.set(k.x, k.prevG + 0.1, k.z); d.rotation.set(0, time * 1.5, 0); d.scale.setScalar(sv); d.updateMatrix();
      this.rings.setMatrixAt(i, d.matrix);
      d.position.set(k.x - fx * 0.9 * sv, k.y + k.model.topY * 0.55 * sv, k.z - fz * 0.9 * sv); d.rotation.set(0, k.dir + Math.sin(time * 6 + i) * 0.25, 0); d.scale.setScalar(sv * 1.15); d.updateMatrix();
      this.pens.setMatrixAt(i, d.matrix);
    });
    this.rings.instanceMatrix.needsUpdate = true; this.pens.instanceMatrix.needsUpdate = true;
  }

  dispose() { for (const f of this.free) f(); }
}

export class FlagMode extends BattleMode {
  static options(settings) {
    return [timeOption(settings), { key: 'duo', label: t('battle.duo'), values: [['same', t('battle.same')], ['split', t('battle.split')]], default: 'same' }];
  }

  // Two teams of four, bases on opposite sides of the ring.
  layout() {
    const race = this.race, tr = race.world.track, ks = race.karts, b = tr.bounds;
    const hs = race.humans, split = this.opts.duo === 'split';
    const cnt = [0, 0];
    hs.forEach((h, i) => { h.team = i === 1 && split ? 1 : 0; cnt[h.team]++; });
    for (const k of ks) { if (k.human) continue; const tm = cnt[0] <= cnt[1] ? 0 : 1; k.team = tm; cnt[tm]++; }
    this.base = [0, 1].map((i) => {
      const s = tr.nearestIndex(i ? b.maxX : b.minX, b.cz);
      return { s, x: tr.px[s], y: tr.py[s], z: tr.pz[s] };
    });
    const slot = [0, 0];
    for (const k of ks) {
      const j = slot[k.team]++, base = this.base[k.team];
      k.bt.role = j;
      this.spawnAt(k, base.s + (j - 1.5) * 4.2 / tr.seg + (k.team ? 0 : 0), j % 2 ? 6 : -6, j % 2 === 1);
    }
    this.caps = [0, 0];
    this.flags = [0, 1].map((i) => ({ team: i, state: 'home', x: this.base[i].x, y: this.base[i].y, z: this.base[i].z, carrier: null, returnT: 0, lock: 0, last: null }));
    for (const k of ks) { k.carry = null; k.pc = 0; k.caps = 0; k.hitsMade = 0; }
    this.marks = [0, 1, 2, 3].map(() => ({ x: 0, z: 0, color: '#fff', shape: 'ring' }));
    this.marks[2].shape = this.marks[3].shape = 'flag';
    this.marksOut = this.marks;
  }

  build() {
    this.vis = new FlagVisuals(this);
    this.disposers.push(() => this.vis.dispose());
  }

  sync() { if (this.vis) this.vis.update(this.race.clock); }

  mapColor(k) { return hex(TEAM[k.team]); }

  mapMarks() {
    const m = this.marks;
    for (let i = 0; i < 2; i++) {
      m[i].x = this.base[i].x; m[i].z = this.base[i].z; m[i].color = hex(TEAM[i]);
      const f = this.flags[i]; m[2 + i].x = f.x; m[2 + i].z = f.z; m[2 + i].color = hex(TEAM[i]);
    }
    return m;
  }

  say2(team, text, dur, cls) { for (const k of this.race.humans) if (k.team === team) this.say(k, text, dur, cls); }
  sayAll(text, dur, cls) { for (const k of this.race.humans) this.say(k, text, dur, cls); }

  grab(k, f) {
    f.state = 'carried'; f.carrier = k; k.carry = f; f.last = k; f.lock = 0;
    this.sfxAt('battle-grab', k.x, k.z, 1);
    this.say(k, t('battle.carry'), 1.6);
    this.say2(f.team, t('battle.stolen'), 1.8);
  }

  drop(f, k) {
    f.state = 'dropped'; f.carrier = null; f.returnT = RETURN_T; f.lock = 1.6; f.last = k;
    f.x = k.x; f.z = k.z; f.y = k.y;
    k.carry = null;
    this.sfxAt('battle-flagdrop', f.x, f.z, 1);
    this.sayAll(t('battle.lost'), 1.2);
  }

  sendHome(f, by) {
    f.state = 'home'; f.carrier = null; f.x = this.base[f.team].x; f.y = this.base[f.team].y; f.z = this.base[f.team].z;
    this.sfxAt('battle-return', f.x, f.z, 1);
    if (by) this.say(by, t('battle.home'), 1.2);
  }

  capture(k, f) {
    const team = k.team;
    this.caps[team]++; k.caps++; k.pc += 5; k.carry = null;
    this.sendHome(f, null);
    this.race.game.audio.play('battle-score', 0.9);
    this.race.particles.burst(true, [TEAM[team], 0xffffff, 0xffe14a], 40, this.base[team].x, this.base[team].y + 3, this.base[team].z, 12, { size: 0.6, life: 1.2, gravity: 6, sphere: true });
    this.say2(team, t('battle.score'), 1.8, 'final');
    this.say2(1 - team, `${t(team ? 'battle.blue' : 'battle.red')} +1`, 1.4);
    k.scoreT = this.race.clock;
    if (this.caps[team] >= WIN) {
      this.over = true;
      this.sayAll(t(team ? 'battle.blueWins' : 'battle.redWins'), 3, 'final');
      this.race.game.audio.play('battle-end', 1);
    }
  }

  tick(dt) {
    if (!this.live) return;
    const ks = this.race.karts;
    for (const f of this.flags) {
      if (f.lock > 0) f.lock -= dt;
      if (f.state === 'carried') {
        const c = f.carrier;
        if (c.out) { this.drop(f, c); continue; }
        f.x = c.x; f.y = c.y; f.z = c.z;
        const home = this.base[c.team];
        if (Math.hypot(c.x - home.x, c.z - home.z) < R_BASE) this.capture(c, f);
        continue;
      }
      if (f.state === 'dropped') { f.returnT -= dt; if (f.returnT <= 0) { this.sendHome(f, null); continue; } }
      const r = f.state === 'dropped' ? 4.8 : R_PICK;
      for (const k of ks) {
        if (k.out || k.carry) continue;
        if (Math.hypot(k.x - f.x, k.z - f.z) > r || Math.abs(k.y - f.y) > 4) continue;
        if (k.team === f.team) { if (f.state === 'dropped') { this.sendHome(f, k); break; } continue; }
        if (f.lock > 0 && f.last === k) continue;
        this.grab(k, f); break;
      }
    }
  }

  onHit(victim, attacker) {
    if (!this.live) return;
    if (attacker && attacker !== victim) attacker.hitsMade++;
    if (victim.carry) this.drop(victim.carry, victim);
  }

  rank() {
    const race = this.race, caps = this.caps;
    const sorted = race.karts.slice().sort((a, b) => (caps[b.team] - caps[a.team]) || (b.pc - a.pc) || (b.hitsMade - a.hitsMade) || (a.bi - b.bi));
    sorted.forEach((k, i) => { k.place = i + 1; });
    race.sorted = sorted;
    this.sync();
  }

  // ---- HUD ----
  hudInfo(k) {
    const c = this.caps, mine = c[k.team], theirs = c[1 - k.team];
    const extra = [{ icon: svgFlag(TEAM[0], false), text: c[0] }, { icon: svgFlag(TEAM[1], false), text: c[1] }];
    if (k.carry) extra.push({ icon: svgFlag(TEAM[1 - k.team], false), text: '!' });
    else if (this.flags[k.team].state === 'carried') extra.push({ icon: svgFlag(TEAM[k.team], true), text: '!' });
    return { place: `${mine}–${theirs}`, lap: t(k.team ? 'battle.blue' : 'battle.red'), extra, time: clock(this.timeLeft) };
  }

  // ---- results ----
  results() {
    this.rank();
    const c = this.caps, win = c[0] === c[1] ? -1 : c[0] > c[1] ? 0 : 1;
    return {
      headline: win < 0 ? t('battle.tie') : t(win ? 'battle.blueWins' : 'battle.redWins'),
      rows: this.race.sorted.map((k) => ({
        place: k.place, name: k.name, human: k.human, playerIndex: k.playerIndex, driver: k.driver, index: this.race.karts.indexOf(k), team: k.team,
        extra: [{ text: `${t("battle.caps")}: ${k.caps}`, cls: "xc" }, { text: `${t("battle.hits")}: ${k.hitsMade}`, cls: "xc" }],
      })),
    };
  }

  // ---- computer racers ----
  think(k, bt) {
    const tr = this.race.world.track, my = this.flags[k.team], en = this.flags[1 - k.team];
    const home = this.base[k.team], ks = this.race.karts;
    if (k.carry) { bt.target = null; this.aimAt(bt, home.x, home.z); return; }
    // How many team mates (computer racers) are closer to a spot than I am.
    const closer = (x, z) => {
      let n = 0; const d0 = Math.hypot(x - k.x, z - k.z);
      for (const o of ks) if (o !== k && o.team === k.team && !o.human && !o.carry && Math.hypot(x - o.x, z - o.z) < d0) n++;
      return n;
    };
    if (my.state === 'carried' && closer(my.carrier.x, my.carrier.z) < 2) { bt.target = my.carrier; return; }
    if (my.state === 'dropped' && closer(my.x, my.z) < 1) { bt.target = null; this.aimAt(bt, my.x, my.z); return; }
    if (en.state === 'dropped' && closer(en.x, en.z) < 1) { bt.target = null; this.aimAt(bt, en.x, en.z); return; }
    if (this.wantsBox(k)) { const b = this.nearestBox(k, 18); if (b) { bt.target = null; this.aimAt(bt, b.x, b.z); return; } }
    const role = bt.role;
    if (en.state === 'carried' && en.carrier.team === k.team && role >= 2) {
      // escort: stay with the carrier, chase an enemy that comes close
      const e = this.pickTarget(k, bt, (o) => o.team !== k.team && Math.hypot(o.x - en.carrier.x, o.z - en.carrier.z) < 30);
      if (!e) { bt.target = en.carrier; bt.chaseT = 0; }
      return;
    }
    if (role === 2) {
      // defender: chase intruders near home, else patrol round the base
      const e = this.pickTarget(k, bt, (o) => o.team !== k.team && Math.hypot(o.x - home.x, o.z - home.z) < 50);
      if (e) return;
      bt.target = null;
      bt.patrol = (bt.patrol || 0) + 1;
      const s = home.s + (bt.patrol % 2 ? 1 : -1) * 14 / tr.seg;
      tr.posAt(s, 0, _v); this.aimAt(bt, _v.x, _v.z);
      return;
    }
    if (role === 3) {
      const e = this.pickTarget(k, bt, (o) => o.team !== k.team && (o.carry || Math.hypot(o.x - k.x, o.z - k.z) < 40));
      if (e) return;
    }
    // attackers (and hunters with nobody to hunt): go for the enemy flag
    bt.target = null; this.aimAt(bt, en.x, en.z);
  }
}

Object.assign(FlagMode, {
  id: 'flag', ages: ['big'], teams: true,
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 58V8"/><path d="M13 10h24l-7 9 7 9H13z" fill="#e8312f"/><path d="M52 58V22"/><path d="M51 24H31l6 8-6 8h20z" fill="#2f7bf0"/><path d="M8 58h50" stroke-width="3"/></svg>',
});

export default FlagMode;
