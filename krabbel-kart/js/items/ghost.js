// Ghost Doodle: see-through and untouchable for 6 s, and steals the item of the nearest rival who holds one.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { litMat, geoOnce, mat4, puff, nearest, detach } from './common.js';

addStrings({ en: { items: { ghost: 'Ghost Doodle' } }, nl: { items: { ghost: 'Spookkrabbel' } } });

const WISP = [0xffffff, 0xd6e6f5, 0xb9a6ff];

// A little ghost that swoops from the victim to the thief with the stolen item.
class Wisp {
  constructor(sys, from, to) {
    this.from = from; this.to = to; this.t = 0;
    this.a = new THREE.Vector3(from.x, from.y + 1.5, from.z);
    this.mesh = sys.spawnMesh(geoOnce(sys, 'wisp', () => [
      { geo: new THREE.SphereGeometry(0.6, 10, 8), color: 0xffffff, matrix: mat4(0, 0.7, 0, 0, 0, 0) },
      { geo: new THREE.CylinderGeometry(0.6, 0.78, 0.8, 10), color: 0xffffff, matrix: mat4(0, 0.2, 0, 0, 0, 0) },
      { geo: new THREE.SphereGeometry(0.1, 5, 4), color: 0x2a2433, matrix: mat4(-0.22, 0.8, 0.5, 0, 0, 0) },
      { geo: new THREE.SphereGeometry(0.1, 5, 4), color: 0x2a2433, matrix: mat4(0.22, 0.8, 0.5, 0, 0, 0) },
      { geo: new THREE.SphereGeometry(0.12, 5, 4), color: 0x2a2433, matrix: mat4(0, 0.5, 0.55, 0, 0, 0) },
    ]), litMat(sys), this.a.x, this.a.y, this.a.z);
    this.mesh.scale.setScalar(1.3);
  }

  update(dt, sys) {
    this.t += dt;
    const u = Math.min(1, this.t / 0.9), to = this.to, a = this.a, m = this.mesh;
    m.position.set(a.x + (to.x - a.x) * u, a.y + (to.y + 1.8 - a.y) * u + Math.sin(u * Math.PI) * 3.5, a.z + (to.z - a.z) * u);
    m.rotation.y = Math.atan2(to.x - a.x, to.z - a.z); m.rotation.z = Math.sin(this.t * 14) * 0.3;
    sys.race.particles.emit(true, WISP[Math.floor(Math.random() * 3)], { x: m.position.x, y: m.position.y, z: m.position.z, life: 0.5, size: 0.7, size1: 0.1, a: 0.7 });
    if (u < 1) return true;
    puff(sys, WISP, 16, to.x, to.y + 1.5, to.z, 6);
    return false;
  }

  dispose() { detach(this.mesh); }
}

registerItem({
  id: 'ghost',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M32 4c-13 0-20 9-20 22v28l7-6 6 6 7-6 7 6 6-6 7 6V26C52 13 45 4 32 4z" fill="#fff" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><ellipse cx="24" cy="26" rx="4" ry="6" fill="#2a2433"/><ellipse cx="40" cy="26" rx="4" ry="6" fill="#2a2433"/><ellipse cx="32" cy="40" rx="5" ry="4" fill="#2a2433"/><circle cx="25" cy="23" r="1.5" fill="#fff"/><circle cx="41" cy="23" r="1.5" fill="#fff"/><path d="M14 22l-8-4M50 22l8-4" stroke="#b9a6ff" stroke-width="4" stroke-linecap="round"/></svg>',
  weight: (k, f) => 0.4 + 1.2 * f,
  use(sys, kart) {
    kart.addFx('ghost', 6);
    sys.race.sfx('item-ghost', kart);
    puff(sys, WISP, 22, kart.x, kart.y + 1.2, kart.z, 7, { sphere: true });
    // Steal from the nearest rival that holds an item (not one still spinning its roulette).
    const v = nearest(sys, kart, 1e9, (k, me) => k !== me && !k.out && k.item && k.rollT <= 0);
    if (v) {
      const id = v.item;
      v.item = null; v.itemUses = 0; v.itemT = 0;
      sys.give(kart, id);
      sys.add(new Wisp(sys, v, kart));
    }
  },
  aiWants: () => true,
});
