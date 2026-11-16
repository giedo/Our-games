// Balloon Battle: everyone carries three balloons, a real hit pops one and scores for the attacker.
// Out of balloons: three seconds as a ghost, then fresh balloons and half the points (nobody sits out).
import * as THREE from '../../vendor/three.module.min.js';
import { BattleMode, KART_COLORS, hex, timeOption } from './battle.js';
import { addStrings, t } from '../i18n.js';
import { mergeColored, mat4 } from '../util.js';

addStrings({
  en: { modes: { balloon: 'Balloon Battle' }, modeSub: { balloon: 'Pop the other balloons' } },
  nl: { modes: { balloon: 'Ballonnengevecht' }, modeSub: { balloon: 'Knal de ballonnen van de rest' } },
});

const PER = 3;
const OFF = [[0, 2.5, -0.2], [-0.95, 2.15, -0.85], [0.95, 2.15, -0.85]]; // right, up, forward from the anchor
const UP = new THREE.Vector3(0, 1, 0);

const svgBalloon = (c, on) => `<svg viewBox="0 0 32 40"><path d="M16 2c7 0 12 5 12 12 0 8-6 14-12 17-6-3-12-9-12-17C4 7 9 2 16 2z" fill="${on ? hex(c) : 'none'}" stroke="${on ? '#2a2433' : '#8a8494'}" stroke-width="3" ${on ? '' : 'stroke-dasharray="4 4"'}/><path d="M16 31l-3 5h6z" fill="${on ? hex(c) : '#8a8494'}"/>${on ? '<ellipse cx="11" cy="10" rx="3" ry="5" fill="#fff" opacity=".55"/>' : ''}</svg>`;

// All balloons and strings of all karts: two instanced meshes.
class BalloonSet {
  constructor(race) {
    this.race = race;
    const scene = race.world.scene, n = race.karts.length * PER;
    const g = mergeColored([
      { geo: new THREE.SphereGeometry(0.62, 14, 10), color: 0xffffff, matrix: mat4(0, 0, 0, 0, 0, 0, 1, 1.18, 1) },
      { geo: new THREE.ConeGeometry(0.16, 0.26, 6), color: 0xdddddd, matrix: mat4(0, -0.78, 0, Math.PI, 0, 0) },
    ]);
    this.mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x666666 });
    this.mesh = new THREE.InstancedMesh(g, this.mat, n);
    const sg = new THREE.CylinderGeometry(0.03, 0.03, 1, 4); sg.translate(0, 0.5, 0);
    this.smat = new THREE.MeshBasicMaterial({ color: 0xf4f0e8 });
    this.strings = new THREE.InstancedMesh(sg, this.smat, n);
    for (const m of [this.mesh, this.strings]) { m.frustumCulled = false; m.castShadow = false; scene.add(m); }
    this.alive = new Uint8Array(n).fill(1); this.sc = new Float32Array(n).fill(1);
    this.left = new Uint8Array(race.karts.length).fill(PER);
    const c = new THREE.Color();
    race.karts.forEach((k, ki) => { for (let j = 0; j < PER; j++) this.mesh.setColorAt(ki * PER + j, c.setHex(KART_COLORS[ki % 8])); });
    this.mesh.instanceColor.needsUpdate = true;
    this.d = new THREE.Object3D(); this.q = new THREE.Quaternion();
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.dir = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
    this.m = new THREE.Matrix4(); this.p = new THREE.Vector3();
  }

  pos(k, j, out) {
    const sv = k.scaleVis, fx = Math.sin(k.dir), fz = Math.cos(k.dir), o = OFF[j], t = this.race.clock + k.bi * 1.7 + j * 2.1;
    const side = o[0] + Math.sin(t * 1.6) * 0.12, up = o[1] + Math.sin(t * 2.3) * 0.16, fwd = o[2] - Math.min(k.speed, 40) * 0.028;
    out.set(k.x - fz * side * sv + fx * fwd * sv, k.y + (k.model.topY * 0.75 + up) * sv, k.z + fx * side * sv + fz * fwd * sv);
    return out;
  }

  // Pop the last balloon of a kart: bits fly, a bang is heard.
  pop(k, mode) {
    const ki = k.bi, j = this.left[ki] - 1;
    if (j < 0) return false;
    this.left[ki]--; this.alive[ki * PER + j] = 0;
    this.pos(k, j, this.p);
    const P = this.race.particles, c = KART_COLORS[ki % 8];
    P.burst(false, [c, c, 0xffffff], 26, this.p.x, this.p.y, this.p.z, 8, { size: 0.55, life: 0.8, gravity: 9, sphere: true });
    P.burst(true, [0xffffff, 0xffe14a], 10, this.p.x, this.p.y, this.p.z, 6, { size: 0.35, life: 0.4, gravity: 2, sphere: true });
    mode.sfxAt('battle-pop', this.p.x, this.p.z, 1);
    return true;
  }

  refill(k) {
    const ki = k.bi;
    this.left[ki] = PER;
    for (let j = 0; j < PER; j++) { this.alive[ki * PER + j] = 1; this.sc[ki * PER + j] = 0.01; }
  }

  update() {
    const d = this.d, q = this.q, a = this.a, b = this.b, dir = this.dir, dt = 1 / 60;
    for (const k of this.race.karts) {
      const sv = k.scaleVis;
      for (let j = 0; j < PER; j++) {
        const i = k.bi * PER + j;
        if (!this.alive[i]) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); this.strings.setMatrixAt(i, this.m); continue; }
        this.sc[i] += (1 - this.sc[i]) * (1 - Math.exp(-9 * dt));
        const s = this.sc[i] * sv;
        this.pos(k, j, b);
        d.position.copy(b); d.rotation.set(0, 0, 0); d.scale.setScalar(Math.max(s, 0.001)); d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        // string: from the top of the driver up to the knot of the balloon
        a.set(k.x, k.y + k.model.topY * 0.6 * sv, k.z);
        dir.set(b.x - a.x, b.y - 0.85 * s - a.y, b.z - a.z);
        const len = Math.max(dir.length(), 0.01);
        q.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
        d.position.copy(a); d.quaternion.copy(q); d.scale.set(1, len, 1); d.updateMatrix();
        this.strings.setMatrixAt(i, d.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.strings.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    const scene = this.race.world.scene;
    scene.remove(this.mesh, this.strings);
    this.mesh.geometry.dispose(); this.strings.geometry.dispose(); this.mat.dispose(); this.smat.dispose();
  }
}

export class BalloonMode extends BattleMode {
  static options(settings) { return [timeOption(settings)]; }

  build() {
    this.set = new BalloonSet(this.race);
    this.disposers.push(() => this.set.dispose());
    for (const k of this.race.karts) k.downT = 0;
  }

  sync() { if (this.set) this.set.update(); }

  tick(dt) {
    if (this.race.state !== 'racing') return;
    for (const k of this.race.karts) {
      if (k.downT > 0) {
        k.downT -= dt;
        if (k.downT <= 0) {
          this.set.refill(k);
          this.say(k, t('battle.back'), 1.4, 'final');
          this.sfxAt('battle-respawn', k.x, k.z, 1);
          this.race.particles.burst(true, [KART_COLORS[k.bi % 8], 0xffffff], 18, k.x, k.y + 2.5, k.z, 6, { size: 0.5, life: 0.6, gravity: 2, sphere: true });
        }
      }
    }
  }

  onHit(victim, attacker) {
    if (!this.live || victim.downT > 0 || this.set.left[victim.bi] <= 0) return;
    this.set.pop(victim, this);
    victim.pops++;
    if (attacker && attacker !== victim) {
      this.add(attacker, 1);
      this.say(attacker, `${t('battle.pop')} +1`, 1.1);
      if (attacker.human) this.race.game.audio.play('battle-point', 0.8);
    }
    if (this.set.left[victim.bi] <= 0) {
      victim.score = Math.floor(victim.score / 2);
      victim.downT = 3; victim.addFx('ghost', 3.1);
      this.say(victim, t('battle.lostAll'), 2.6);
    }
  }

  extras(k) {
    const n = this.set ? this.set.left[k.bi] : PER, c = KART_COLORS[k.bi % 8], out = [];
    for (let j = 0; j < PER; j++) out.push({ icon: svgBalloon(c, j < n), text: '' });
    return out;
  }

  // ---- computer racers ----
  think(k, bt) {
    const left = this.set.left[k.bi];
    if (k.downT > 0) { const b = this.nearestBox(k, 90); if (b) this.aimAt(bt, b.x, b.z); bt.target = null; return; }
    if (left <= 1 && k.shieldT <= 0 && bt.aggr < 0.6) {
      let thr = null, td = 38;
      for (const o of this.race.karts) { if (o === k || o.out) continue; const d = Math.hypot(o.x - k.x, o.z - k.z); if (d < td) { td = d; thr = o; } }
      if (thr) { this.flee(k, bt, thr); return; }
    }
    if (this.wantsBox(k)) {
      const b = this.nearestBox(k, 110);
      if (b) { bt.target = null; this.aimAt(bt, b.x, b.z); return; }
    }
    this.pickTarget(k, bt, (o) => o.downT <= 0 && !(o.human && this.set.left[o.bi] <= 1 && Math.random() < 0.5));
    if (!bt.target) { const b = this.nearestBox(k, 200); if (b) this.aimAt(bt, b.x, b.z); }
  }
}

Object.assign(BalloonMode, {
  id: 'balloon',
  icon: '<svg viewBox="0 0 64 64" fill="none" stroke="#2a2433" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 54V30M20 50l-2-18M44 50l2-18" stroke-width="2.5"/><path d="M32 4c8 0 12 6 12 12 0 7-5 12-12 15-7-3-12-8-12-15 0-6 4-12 12-12z" fill="#ff4b4b"/><path d="M15 16c6 0 9 5 9 10 0 6-4 10-9 12-5-2-9-6-9-12 0-5 3-10 9-10z" fill="#4fb8ff"/><path d="M49 16c6 0 9 5 9 10 0 6-4 10-9 12-5-2-9-6-9-12 0-5 3-10 9-10z" fill="#ffd21f"/><ellipse cx="27" cy="12" rx="2.5" ry="4" fill="#fff" stroke="none" opacity=".7"/></svg>',
});

export default BalloonMode;
