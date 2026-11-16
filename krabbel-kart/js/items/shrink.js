// Shrink Stamp: a giant rubber stamp slams down and every rival turns tiny and slower for 5 s.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { litMat, geoOnce, mat4, puff, Wave, canHit, detach } from './common.js';

addStrings({ en: { items: { shrink: 'Shrink Stamp' } }, nl: { items: { shrink: 'Krimpstempel' } } });

const PURPLE = [0xb46bff, 0xffffff, 0xff7ac0];

class Stamp {
  constructor(sys, kart) {
    this.sys = sys; this.owner = kart; this.t = 0; this.done = false;
    this.mesh = sys.spawnMesh(geoOnce(sys, 'stamp', () => [
      { geo: new THREE.BoxGeometry(2.4, 0.5, 2.4), color: 0xb46bff, matrix: mat4(0, 0, 0, 0, 0, 0) },
      { geo: new THREE.BoxGeometry(1.8, 0.25, 1.8), color: 0x7a3fd0, matrix: mat4(0, -0.35, 0, 0, 0, 0) },
      { geo: new THREE.CylinderGeometry(0.35, 0.5, 1.6, 8), color: 0xc98b4a, matrix: mat4(0, 1.0, 0, 0, 0, 0) },
      { geo: new THREE.SphereGeometry(0.75, 10, 8), color: 0xff4b4b, matrix: mat4(0, 2.0, 0, 0, 0, 0) },
    ]), litMat(sys), kart.x, kart.y + 9, kart.z);
    this.mesh.rotation.y = kart.dir;
    this.mesh.scale.setScalar(1.1);
    this.pending = [];
    for (const k of sys.race.karts) if (canHit(k, kart)) this.pending.push({ k, at: 0.25 + Math.min(0.8, Math.hypot(k.x - kart.x, k.z - kart.z) / 110) });
  }

  update(dt, sys) {
    this.t += dt;
    const t = this.t, o = this.owner, P = sys.race.particles;
    const slam = Math.min(1, t / 0.22);
    this.mesh.position.set(o.x, o.y + 1.9 + (1 - slam * slam) * 7 + Math.max(0, t - 0.5) * 12, o.z);
    this.mesh.scale.setScalar(t > 0.5 ? Math.max(0.01, 1.1 - (t - 0.5) * 2.2) : 1.1);
    if (!this.done && t >= 0.22) {
      this.done = true;
      sys.race.sfx('item-stamp', o);
      sys.add(new Wave(sys, o.x, o.y, o.z, [0xb46bff, 0xff7ac0], 85, 0.9, 0.12));
      puff(sys, PURPLE, 20, o.x, o.y + 0.5, o.z, 9);
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      if (t < p.at) continue;
      this.pending.splice(i, 1);
      const k = p.k;
      if (!canHit(k, o)) continue;
      k.addFx('tiny', 5);
      puff(sys, PURPLE, 18, k.x, k.y + 1, k.z, 7, { sphere: true });
      sys.race.sfx('item-whoosh', k);
    }
    return t < 1.1;
  }

  dispose() { detach(this.mesh); }
}

registerItem({
  id: 'shrink',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><g stroke="#2a2433" stroke-width="3" stroke-linejoin="round"><circle cx="32" cy="10" r="7" fill="#ff4b4b"/><path d="M28 16h8l2 14H26z" fill="#c98b4a"/><rect x="12" y="30" width="40" height="10" rx="3" fill="#b46bff"/><rect x="16" y="40" width="32" height="6" rx="2" fill="#7a3fd0"/><path d="M6 56h52" stroke-linecap="round" stroke-width="6" stroke="#4fb8ff"/></g><path d="M4 22l8 4M4 30l8-2M60 22l-8 4M60 30l-8-2" stroke="#2a2433" stroke-width="3" stroke-linecap="round"/><path d="M20 53h24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0.1 : 0.3 + 2 * f),
  use(sys, kart) { sys.add(new Stamp(sys, kart)); },
  aiWants: (k) => k.place > 1,
});
