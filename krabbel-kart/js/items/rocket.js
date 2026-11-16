// Rocket Pencil: ride a giant pencil. Autopilot at 1.55x speed, longer for karts further back.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { litMat, geoOnce, mat4, puff, detach, canHit, RAINBOW } from './common.js';

addStrings({ en: { items: { rocket: 'Rocket Pencil' } }, nl: { items: { rocket: 'Raketpotlood' } } });

const R = 0.55, H = Math.PI / 2;

// A hexagonal pencil along +Z, 3 m of body, a sharpened wooden tip in front and an eraser at the back.
function pencilGeo(sys) {
  return geoOnce(sys, 'pencil', () => [
    { geo: new THREE.CylinderGeometry(R, R, 3.2, 6), color: 0xffd21f, matrix: mat4(0, 0, 0, H, 0, 0) },
    { geo: new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.5, 6), color: 0xc9ced8, matrix: mat4(0, 0, -1.75, H, 0, 0) },
    { geo: new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.5, 6), color: 0xff7ac0, matrix: mat4(0, 0, -2.25, H, 0, 0) },
    { geo: new THREE.CylinderGeometry(R * 0.3, R, 1.0, 6), color: 0xf2c79a, matrix: mat4(0, 0, 2.1, H, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.02, R * 0.3, 0.4, 6), color: 0x2a2433, matrix: mat4(0, 0, 2.8, H, 0, 0) },
    { geo: new THREE.BoxGeometry(0.1, 0.9, 1.8), color: 0xff4b4b, matrix: mat4(0, 0.6, -1.3, 0, 0, 0) },
    { geo: new THREE.BoxGeometry(3.8, 0.1, 1.5), color: 0xff4b4b, matrix: mat4(0, 0.1, -1.3, 0, 0, 0) },
  ]);
}

class Ride {
  constructor(sys, kart, dur) {
    this.sys = sys; this.kart = kart; this.t = 0; this.dur = dur;
    this.mesh = new THREE.Mesh(pencilGeo(sys), litMat(sys));
    this.mesh.position.set(0, 0.32, 0.5);
    this.mesh.scale.setScalar(0.01);
    kart.model.anim.add(this.mesh);
    this.ending = 0;
  }

  update(dt, sys) {
    const k = this.kart, P = sys.race.particles;
    this.t += dt;
    if (!k.fx.auto || k.out) {
      this.ending += dt * 4;
      this.mesh.scale.setScalar(Math.max(0.01, 1 - this.ending));
      if (this.ending >= 1) { k.autoSpeed = 1; return false; }
    } else this.mesh.scale.setScalar(Math.min(1, this.t * 5));
    const fx = Math.sin(k.dir), fz = Math.cos(k.dir);
    // Flame and graphite sparks out of the eraser end.
    if (k.fx.auto) {
      const bx = k.x - fx * 3, bz = k.z - fz * 3;
      for (let i = 0; i < 2; i++) {
        P.emit(true, i ? 0xffd24a : 0xff5a1f, { x: bx + (Math.random() - 0.5) * 0.5, y: k.y + 0.5 + Math.random() * 0.3, z: bz + (Math.random() - 0.5) * 0.5, vx: -fx * 8, vy: 1, vz: -fz * 8, life: 0.35, size: 1.1, size1: 0.1, a: 0.9 });
      }
      if (Math.random() < 0.4) P.emit(false, 0x2a2433, { x: bx, y: k.y + 0.6, z: bz, vx: -fx * 4 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: -fz * 4 + (Math.random() - 0.5) * 3, life: 0.8, size: 0.5, size1: 1.3, a: 0.4 });
      // Bump aside whoever is in the way.
      for (const o of sys.race.karts) {
        if (!canHit(o, k) || o.hitCool > 0) continue;
        const dx = o.x - k.x, dz = o.z - k.z, along = dx * fx + dz * fz, side = dx * fz - dz * fx;
        if (along > -1 && along < 4.5 && Math.abs(side) < 2.7) {
          o.hit({ by: k, cause: 'rocket', soft: true });
          o.bump(fz * Math.sign(side || 1), -fx * Math.sign(side || 1), 14);
          puff(sys, [0xffd24a, 0xffffff], 8, o.x, o.y + 1, o.z, 5);
        }
      }
    }
    return true;
  }

  dispose() { detach(this.mesh); this.kart.autoSpeed = 1; }
}

registerItem({
  id: 'rocket',
  icon: '<svg viewBox="0 0 64 64"><path d="M6 50c-2-8 2-12 8-10l-2 8z" fill="#ff7a1f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M10 47c0-3 2-4 4-3l-1 3z" fill="#ffe14a"/><g transform="rotate(-40 32 32)" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"><rect x="6" y="24" width="10" height="16" rx="2" fill="#ff7ac0"/><rect x="16" y="24" width="5" height="16" fill="#c9ced8"/><rect x="21" y="24" width="26" height="16" fill="#ffd21f"/><path d="M21 32h26" stroke-width="2"/><path d="M47 24l14 8-14 8z" fill="#f2c79a"/><path d="M56 29l5 3-5 3z" fill="#2a2433"/><path d="M26 24l-4-9 10 9zM26 40l-4 9 10-9z" fill="#ff4b4b"/></g></svg>',
  weight: (k, f) => (f < 0.35 ? 0.1 : 0.3 + 5 * (f - 0.35)),
  use(sys, kart) {
    const n = sys.race.karts.length, f = n > 1 ? (kart.place - 1) / (n - 1) : 0;
    kart.autoSpeed = 1.55;
    kart.addFx('auto', 3 + 3 * f);
    sys.race.sfx('item-rocket', kart);
    puff(sys, [0xffd24a, 0xff7a1f, 0xffffff], 24, kart.x, kart.y + 0.6, kart.z, 8);
    sys.add(new Ride(sys, kart, 3 + 3 * f));
  },
  aiWants: () => true,
});
