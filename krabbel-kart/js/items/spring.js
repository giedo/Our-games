// Pogo Spring: a big jump. Hops over obstacles and puddles.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { geoOnce, paint, mat4, litMat, puff, RAINBOW } from './common.js';

addStrings({ en: { items: { spring: 'Pogo Spring' } }, nl: { items: { spring: 'Springveer' } } });

class Coil extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2 * 4; return out.set(Math.cos(a) * 0.55, t * 1.5, Math.sin(a) * 0.55); }
}

function springGeo(sys) {
  return geoOnce(sys, 'spring', () => [
    { geo: paint(new THREE.TubeGeometry(new Coil(), 64, 0.11, 5), () => 0x4fb8ff), color: 0x4fb8ff },
    { geo: new THREE.CylinderGeometry(0.9, 0.9, 0.18, 12), color: 0xff4b4b, matrix: mat4(0, 0.05, 0, 0, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.8, 0.8, 0.14, 12), color: 0xffd21f, matrix: mat4(0, 1.55, 0, 0, 0, 0) },
  ]);
}

class Pogo {
  constructor(sys, kart) {
    this.kart = kart; this.t = 0;
    this.mesh = sys.spawnMesh(springGeo(sys), litMat(sys), kart.x, kart.y, kart.z);
    this.mesh.rotation.y = kart.dir;
  }

  // Squash flat, spring up long, then shrink away.
  update(dt) {
    this.t += dt;
    const t = this.t, y = t < 0.12 ? 0.3 + t * 2 : t < 0.35 ? 0.55 + (t - 0.12) * 4.5 : 1.6 - (t - 0.35) * 0.4;
    const fade = t > 0.6 ? Math.max(0.01, 1 - (t - 0.6) * 2.5) : 1;
    this.mesh.scale.set(fade * (t < 0.12 ? 1.25 : 0.9), y * fade, fade * (t < 0.12 ? 1.25 : 0.9));
    this.mesh.rotation.y += dt * 6;
    return t < 1;
  }

  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); }
}

registerItem({
  id: 'spring',
  icon: '<svg viewBox="0 0 64 64"><path d="M20 56h24" stroke="#2a2433" stroke-width="12" stroke-linecap="round"/><path d="M20 56h24" stroke="#ff4b4b" stroke-width="6" stroke-linecap="round"/><path d="M20 46l24-5M20 36l24-5M20 26l24-5" stroke="#2a2433" stroke-width="12" stroke-linecap="round"/><path d="M20 46l24-5M20 36l24-5M20 26l24-5" stroke="#4fb8ff" stroke-width="6" stroke-linecap="round"/><path d="M32 22v-6" stroke="#2a2433" stroke-width="6"/><circle cx="32" cy="12" r="9" fill="#ffd21f" stroke="#2a2433" stroke-width="3"/><path d="M8 20l-4-6M56 20l4-6M10 32H3M54 32h7" stroke="#2a2433" stroke-width="3" stroke-linecap="round"/></svg>',
  weight: (k, f) => 1 + 0.8 * f,
  use(sys, kart) {
    sys.add(new Pogo(sys, kart));
    kart.launch(19);
    kart.boost(0.5, 1.2);
    sys.race.sfx('item-spring', kart);
    puff(sys, RAINBOW, 14, kart.x, kart.y + 0.4, kart.z, 7, { size: 0.5 });
    sys.race.particles.burst(false, [sys.world.dustColor], 10, kart.x, kart.y + 0.2, kart.z, 5, { size: 0.7, size1: 1.6, life: 0.5, gravity: 1, a: 0.5 });
  },
  aiWants: (k, ctx) => ctx.hold > 3 || ctx.race.items.hazardsAhead(k, 24).length > 0,
});
