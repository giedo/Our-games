// Boomerang Ruler: flies out and comes back to you. Two throws.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Shot, litMat, geoOnce, mat4, puff, rivalNear } from './common.js';

addStrings({ en: { items: { boomerang: 'Boomerang Ruler' } }, nl: { items: { boomerang: 'Boemerangliniaal' } } });

const WOOD = [0xffe14a, 0xffffff, 0xff9a3c];
const _to = new THREE.Vector3();

function rulerGeo(sys) {
  return geoOnce(sys, 'ruler', () => {
    const parts = [];
    for (const sd of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(2.0, 0.14, 0.55), color: 0xffd21f, matrix: mat4(sd * 0.95, 0, 0.3, 0, -sd * 0.4, 0) });
      for (let i = 0; i < 5; i++) parts.push({ geo: new THREE.BoxGeometry(0.06, 0.16, i % 2 ? 0.18 : 0.3), color: 0x2a2433, matrix: mat4(sd * (0.35 + i * 0.35), 0, 0.3 - sd * 0.4 * (0.35 + i * 0.35) * 0.4 + 0.12, 0, -sd * 0.4, 0) });
    }
    return parts;
  });
}

class Ruler extends Shot {
  constructor(sys, kart) {
    super(sys, kart, { speed: 62, h: 1.3, life: 6, lead: 3 });
    this.mesh = sys.spawnMesh(rulerGeo(sys), litMat(sys));
    this.mesh.scale.setScalar(1.3);
    this.age = 0; this.back = false; this.base = kart.lat; this.side = Math.random() < 0.5 ? -1 : 1; this.vr = 20;
    sys.race.sfx('item-whirr', kart);
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    const o = this.owner, P = sys.race.particles;
    if (this.dead || this.life <= 0) return false;
    if (!this.back) {
      // Out: slows down along the road in a gentle curve.
      const u = this.age / 0.75;
      if (u >= 1) this.back = true;
      this.speed = 62 * (1 - u * u); this.lat = this.base + this.side * 6 * Math.sin(Math.min(1, u) * Math.PI * 0.9);
      this.advance(dt);
    } else {
      // Back: straight to the kart, faster and faster.
      this.vr += dt * 110;
      _to.set(o.x - this.pos.x, o.y + 1.3 - this.pos.y, o.z - this.pos.z);
      const d = _to.length();
      if (d < 2.6) { sys.race.sfx('item-catch', o); puff(sys, WOOD, 12, o.x, o.y + 1.5, o.z, 5); return false; }
      this.prev.copy(this.pos);
      this.pos.addScaledVector(_to, Math.min(d, this.vr * dt) / d);
    }
    this.face();
    this.mesh.rotation.y += dt * 22;
    P.emit(true, WOOD[Math.floor(Math.random() * 3)], { x: this.pos.x, y: this.pos.y, z: this.pos.z, life: 0.3, size: 0.5, size1: 0.05, a: 0.7 });
    // Hits whoever it flies through, once each (the hit cool-down keeps them safe afterwards).
    if (sys.hitKartsNear(this.pos.x, this.pos.y, this.pos.z, 2.2, this.age < 0.3 || this.back ? o : null, { cause: 'ruler', skipCool: true }).length) puff(sys, WOOD, 18, this.pos.x, this.pos.y, this.pos.z, 8);
    return true;
  }
}

registerItem({
  id: 'boomerang',
  ages: ['big'],
  uses: 2,
  icon: '<svg viewBox="0 0 64 64"><g transform="rotate(-12 32 32)"><path d="M8 6h16l2 28h30v16H8z" fill="#ffd21f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M8 14h6M8 22h9M8 30h6M8 38h9M16 50v-6M26 50v-9M36 50v-6M46 50v-9" stroke="#2a2433" stroke-width="3" stroke-linecap="round"/></g><path d="M40 12c10 2 16 10 14 20" fill="none" stroke="#4fb8ff" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 7"/><path d="M50 30l4 6 4-7z" fill="#4fb8ff" stroke="#2a2433" stroke-width="2" stroke-linejoin="round"/></svg>',
  weight: (k, f) => 0.8 + 0.8 * f,
  use(sys, kart) { sys.add(new Ruler(sys, kart)); },
  aiWants: (k, ctx) => rivalNear(ctx.race.items, k, 35, 0.7) || ctx.hold > 8,
});
