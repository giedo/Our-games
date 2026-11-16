// The prize-giving after a tournament: a podium past the finish line with the
// top three on it, everybody else cheering below, confetti and fireworks.
import * as THREE from '../vendor/three.module.min.js';
import { buildRacerModel, disposeRacerModel } from './racerModel.js';
import { Particles } from './particles.js';
import { Animator } from './anim.js';
import { makeCanvas, canvasTexture, clamp } from './util.js';

const CONFETTI = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff, 0xff7ac0];
const FIREWORK = [[0xffe14a, 0xffffff], [0xff5cf0, 0xffffff], [0x4fe9ff, 0xffffff], [0x7dff7a, 0xffe14a], [0xff7a3c, 0xffe14a]];
const STEPS = [
  { x: 0, h: 1.75, plate: '#ffcf33', label: '1' },
  { x: -3.35, h: 1.2, plate: '#dfe7f0', label: '2' },
  { x: 3.35, h: 0.8, plate: '#e8a56a', label: '3' },
];
const CROWD_SPOTS = [[-6.3, 0.4], [6.3, 0.4], [-8.7, 2.5], [8.7, 2.5], [-7.3, 5.4]];

function plateTexture(label, colour) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = colour; g.strokeStyle = '#2a2433'; g.lineWidth = 12;
  g.beginPath(); g.arc(128, 128, 92, 0, 6.3); g.fill(); g.stroke();
  g.font = '700 150px Fredoka, "Comic Sans MS", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 14; g.strokeText(label, 128, 138);
  g.fillStyle = '#ffffff'; g.fillText(label, 128, 138);
  return canvasTexture(c);
}

function trophyGeometry() {
  const pts = [[0, 0], [0.5, 0], [0.5, 0.12], [0.16, 0.2], [0.11, 0.55], [0.3, 0.72], [0.56, 1.05], [0.66, 1.55], [0.58, 1.55], [0.46, 1.1], [0.2, 0.85], [0, 0.82]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 14);
}

export class Ceremony {
  /** ranking: tournament entries sorted best first: { driver, vehicle, human } */
  constructor(game, world, ranking) {
    this.game = game; this.world = world; this.t = 0;
    const tr = world.track, s = 4;
    const grp = this.group = new THREE.Group();
    tr.posAt(s, 0, grp.position);
    grp.rotation.y = tr.headingAt(s); // local +z runs down the track, away from the banner
    world.scene.add(grp);
    this.cam = new THREE.PerspectiveCamera(48, 1, 0.3, 4000);
    this.shift = 0.09; // nudge the picture up, clear of the buttons
    this.particles = new Particles(world.scene);
    this.disposables = [];

    // Podium blocks.
    const side = new THREE.MeshLambertMaterial({ color: 0xfffaf0 });
    const top = new THREE.MeshLambertMaterial({ color: 0xff4b3c });
    this.disposables.push(side, top);
    for (const st of STEPS) {
      const tex = plateTexture(st.label, st.plate);
      const front = new THREE.MeshLambertMaterial({ map: tex });
      const geo = new THREE.BoxGeometry(3.25, st.h, 3.7);
      const m = new THREE.Mesh(geo, [side, side, top, side, front, side]);
      m.position.set(st.x, st.h / 2, 0);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      this.disposables.push(tex, front, geo);
    }

    // Racers: top three on the blocks, the rest on the road looking up at them.
    this.actors = [];
    ranking.forEach((e, i) => {
      const model = buildRacerModel(e.driver, e.vehicle);
      const a = { model, rank: i, phase: i * 1.7, baseY: 0, animator: new Animator(model, { podium: true, rank: i, id: e.driver.id }) };
      // Winners jump the most; the crowd cheers a little, with every cheer out of step.
      a.animator.play('win', { loop: true, strength: i < 3 ? [1, 0.85, 0.72][i] : 0.45, delay: i < 3 ? i * 0.3 : 0.3 + (i % 4) * 0.35 });
      if (i < 3) {
        const st = STEPS[i];
        model.root.position.set(st.x, st.h, 0);
        model.root.rotation.y = i === 1 ? 1.05 : i === 2 ? -1.05 : 0.95; // three-quarter view of the vehicle
        a.baseY = st.h;
        a.faceCam = true;
      } else {
        const sp = CROWD_SPOTS[(i - 3) % CROWD_SPOTS.length];
        model.root.position.set(sp[0], 0, sp[1]);
        model.root.rotation.y = Math.atan2(-sp[0], -sp[1] - 1);
      }
      model.root.scale.setScalar(i < 3 ? 1.05 : 0.85);
      grp.add(model.root);
      this.actors.push(a);
    });

    // A golden cup turning above the winner.
    if (this.actors.length) {
      const gold = new THREE.MeshLambertMaterial({ color: 0xffc928, emissive: 0x7a4a00 });
      const geo = trophyGeometry();
      this.trophy = new THREE.Mesh(geo, gold);
      this.trophy.scale.setScalar(0.75);
      this.trophyY = STEPS[0].h + this.actors[0].model.topY + 0.75;
      this.trophy.position.set(0, this.trophyY, 0);
      this.trophy.castShadow = true;
      grp.add(this.trophy);
      this.disposables.push(gold, geo);
    }
    this.nextFirework = 0.8;
    this._v = new THREE.Vector3(); this._l = new THREE.Vector3();
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const t = this.t, P = this.particles, grp = this.group;
    // Camera: glide in from a wide shot, then sway gently from side to side.
    const e = 1 - Math.pow(1 - clamp(t / 5, 0, 1), 3);
    const ang = Math.sin(Math.max(0, t - 4) * 0.22) * 0.55;
    const dist = 36 - 18.5 * e, h = 10 - 5.0 * e;
    this._v.set(Math.sin(ang) * dist, h, Math.cos(ang) * dist);
    this._l.set(0, 2.2, 0);
    grp.updateMatrixWorld();
    grp.localToWorld(this._v); grp.localToWorld(this._l);
    const g = this.world.heightAt(this._v.x, this._v.z);
    if (this._v.y < g + 1.2) this._v.y = g + 1.2;
    this.cam.position.copy(this._v);
    this.cam.lookAt(this._l);
    this.focus = this._l;

    for (const a of this.actors) {
      const m = a.model;
      m.root.position.y = a.baseY;
      if (a.faceCam) {
        // The driver looks at the camera while the vehicle shows its side.
        m.pivot.rotation.y = -m.root.rotation.y + ang + Math.sin(t * 1.3 + a.phase) * 0.15;
        m.pivot.rotation.z = Math.sin(t * 4 + a.phase) * 0.12;
      }
      a.animator.update(dt, t, null);
    }
    if (this.trophy) {
      this.trophy.rotation.y = t * 1.6;
      this.trophy.position.y = this.trophyY + Math.sin(t * 2.1) * 0.12 + Math.abs(Math.sin(t * 3.4)) * 0.55;
      if (Math.random() < 0.3) {
        this._v.set((Math.random() - 0.5) * 1.1, this.trophy.position.y + 0.3 + Math.random() * 0.9, (Math.random() - 0.5) * 1.1);
        grp.localToWorld(this._v);
        P.emit(true, 0xfff2a0, { x: this._v.x, y: this._v.y, z: this._v.z, vy: 0.6, life: 0.5, size: 0.3, size1: 0, a: 0.9 });
      }
    }
    // Confetti drifting down over the podium.
    for (let i = 0; i < 3; i++) {
      this._v.set((Math.random() - 0.5) * 24, 9 + Math.random() * 5, (Math.random() - 0.5) * 12 + 2);
      grp.localToWorld(this._v);
      P.emit(false, CONFETTI[Math.floor(Math.random() * CONFETTI.length)], {
        x: this._v.x, y: this._v.y, z: this._v.z, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 3.4, size: 0.34, size1: 0.34, gravity: 2.2, drag: 0.9,
      });
    }
    // Fireworks in the sky behind the banner.
    this.nextFirework -= dt;
    if (this.nextFirework <= 0) {
      this.nextFirework = 0.55 + Math.random() * 0.9;
      this._v.set((Math.random() - 0.5) * 46, 15 + Math.random() * 13, -14 - Math.random() * 30);
      grp.localToWorld(this._v);
      P.burst(true, FIREWORK[Math.floor(Math.random() * FIREWORK.length)], 46, this._v.x, this._v.y, this._v.z, 11, { size: 0.75, size1: 0.1, life: 1.3, gravity: 5, drag: 1.4, sphere: true });
      this.game.audio.play('firework', 0.5);
    }
    P.update(dt);
  }

  dispose() {
    this.world.scene.remove(this.group);
    for (const a of this.actors) { a.animator.dispose(); disposeRacerModel(a.model); }
    for (const d of this.disposables) d.dispose();
    this.particles.dispose();
  }
}
