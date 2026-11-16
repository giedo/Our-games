// Star Magnet: pulls in star pickups within 18 m for 8 s.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { litMat, geoOnce, mat4, puff, detach } from './common.js';

addStrings({ en: { items: { magnet: 'Star Magnet' } }, nl: { items: { magnet: 'Sterrenmagneet' } } });

const R = 18, GOLD = [0xffe14a, 0xfff3a0, 0xffffff];

function magnetGeo(sys) {
  return geoOnce(sys, 'magnet', () => [
    { geo: new THREE.TorusGeometry(0.65, 0.24, 8, 16, Math.PI), color: 0xff4b4b },
    { geo: new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), color: 0xff4b4b, matrix: mat4(-0.65, -0.25, 0, 0, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), color: 0xff4b4b, matrix: mat4(0.65, -0.25, 0, 0, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), color: 0xe8eef5, matrix: mat4(-0.65, -0.62, 0, 0, 0, 0) },
    { geo: new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), color: 0xe8eef5, matrix: mat4(0.65, -0.62, 0, 0, 0, 0) },
  ]);
}

class Pull {
  constructor(sys, kart) {
    this.kart = kart; this.t = 8; this.list = []; this.refresh = 0;
    this.mesh = new THREE.Mesh(magnetGeo(sys), litMat(sys));
    this.mesh.position.set(0, kart.model.topY + 1.1, 0);
    this.mesh.scale.setScalar(1.3);
    kart.model.anim.add(this.mesh);
    kart.__magnet = this;
  }

  update(dt, sys) {
    const k = this.kart;
    this.t -= dt;
    if (this.t <= 0 || k.out) { k.__magnet = null; return false; }
    this.mesh.rotation.y += dt * 4;
    this.mesh.rotation.z = Math.sin(this.t * 6) * 0.25;
    this.mesh.visible = this.t > 1 || Math.sin(this.t * 30) > 0;
    this.refresh -= dt;
    if (this.refresh <= 0) { this.list = sys.ofKind('star'); this.refresh = 0.5; }
    for (const s of this.list) {
      if (s.on === false) continue;
      const dx = k.x - s.x, dz = k.z - s.z, d = Math.hypot(dx, dz);
      if (d > R || Math.abs(k.y + 1 - s.y) > 6) continue;
      if (s.pullTo) s.pullTo(k, dt, 12 + 30 * (1 - d / R)); else { s.x += (dx / d) * 28 * dt; s.z += (dz / d) * 28 * dt; }
      if (d < 2.4 && s.collect) s.collect(k);
    }
    return true;
  }

  dispose() { detach(this.mesh); if (this.kart.__magnet === this) this.kart.__magnet = null; }
}

registerItem({
  id: 'magnet',
  icon: '<svg viewBox="0 0 64 64"><path d="M10 54V30C10 14 20 6 32 6s22 8 22 24v24H40V30c0-6-3-10-8-10s-8 4-8 10v24z" fill="#ff4b4b" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M10 42h14v12H10zM40 42h14v12H40z" fill="#e8eef5" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M16 26c1-8 6-14 13-16" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/><path d="M32 52l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#ffd21f" stroke="#2a2433" stroke-width="2" stroke-linejoin="round" transform="translate(0 -6) scale(.55) translate(26 6)"/></svg>',
  weight: (k, f) => 0.8,
  use(sys, kart) {
    if (kart.__magnet) { kart.__magnet.t = 8; return; }
    sys.add(new Pull(sys, kart));
    sys.race.sfx('item-magnet', kart);
    puff(sys, GOLD, 16, kart.x, kart.y + 2.5, kart.z, 6, { sphere: true });
  },
  aiWants: () => true,
});
