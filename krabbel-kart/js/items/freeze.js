// Freeze Pop: thrown ahead, freezes a rival in an ice cube for a moment (1.4 s).
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Shot, litMat, geoOnce, mat4, puff, chooseTarget, canHit, detach, rivalNear } from './common.js';

addStrings({ en: { items: { freeze: 'Freeze Pop' } }, nl: { items: { freeze: 'IJslolly' } } });

const ICE = [0xffffff, 0xbfefff, 0x7fd8ff];

// The cube round a frozen kart: wobbles in, glints, shatters when the kart thaws.
class Cube {
  constructor(sys, kart) {
    this.kart = kart; this.t = 0;
    const len = kart.model.len + 0.9;
    this.mesh = new THREE.Mesh(sys.res('ice-geo', () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1)), sys.res('ice-mat', () => new THREE.MeshLambertMaterial({ color: 0xaee8ff, emissive: 0x3aa0d0, transparent: true, opacity: 0.62, depthWrite: false })));
    this.len = len;
    this.mesh.position.set(0, 1.0, 0);
    this.mesh.renderOrder = 4;
    kart.model.anim.add(this.mesh);
  }

  update(dt, sys) {
    const k = this.kart;
    this.t += dt;
    if (!k.fx.frozen || k.out) {
      puff(sys, ICE, 34, k.x, k.y + 1, k.z, 10, { size: 0.55, life: 0.8, gravity: 14, sphere: true });
      sys.race.sfx('item-shatter', k);
      return false;
    }
    const pop = Math.min(1, this.t * 6), w = 1 + Math.sin(this.t * 30) * 0.03 * (1 - pop);
    this.mesh.scale.set(2.5 * pop * w, 2.3 * pop, this.len * pop);
    if (Math.random() < 0.25) sys.race.particles.emit(true, 0xffffff, { x: k.x + (Math.random() - 0.5) * 2.4, y: k.y + 0.4 + Math.random() * 2, z: k.z + (Math.random() - 0.5) * 2.4, life: 0.35, size: 0.5, size1: 0.05 });
    return true;
  }

  dispose() { detach(this.mesh); }
}

class Pop extends Shot {
  constructor(sys, kart) {
    super(sys, kart, { speed: 54, h: 1.3, life: 6, lead: 3 });
    this.target = chooseTarget(sys, kart); this.age = 0; this.wob = Math.random() * 6;
    this.mesh = sys.spawnMesh(geoOnce(sys, 'pop', () => [
      { geo: new THREE.BoxGeometry(0.7, 1.5, 0.3), color: 0x4fd0ff, matrix: mat4(0, 0, 0, 0, 0, 0) },
      { geo: new THREE.BoxGeometry(0.7, 0.7, 0.32), color: 0xff7ac0, matrix: mat4(0, 0.4, 0, 0, 0, 0) },
      { geo: new THREE.BoxGeometry(0.2, 0.7, 0.2), color: 0xf2c79a, matrix: mat4(0, -1.05, 0, 0, 0, 0) },
    ]), litMat(sys));
    this.mesh.scale.setScalar(1.3);
    sys.race.sfx('throw', kart);
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    if (this.dead || this.life <= 0) return false;
    const t = this.target;
    if (t && canHit(t, this.owner)) this.steer(t, dt, 3); else this.target = chooseTarget(sys, this.owner);
    this.advance(dt);
    this.h = 1.3 + Math.sin(this.age * 9 + this.wob) * 0.25;
    this.face();
    this.mesh.rotation.set(Math.PI / 2, Math.atan2(this.pos.x - this.prev.x, this.pos.z - this.prev.z), this.age * 8, 'YXZ');
    sys.race.particles.emit(true, ICE[Math.floor(Math.random() * 3)], { x: this.prev.x, y: this.prev.y, z: this.prev.z, life: 0.4, size: 0.5, size1: 0.05, a: 0.8 });
    for (const k of sys.race.karts) {
      if (!canHit(k, this.owner) || (this.age < 0.3 && k === this.owner)) continue;
      const dx = k.x - this.pos.x, dz = k.z - this.pos.z;
      if (dx * dx + dz * dz > 6 || Math.abs(k.y + 1 - this.pos.y) > 3) continue;
      if (k.hit({ by: this.owner, cause: 'freeze' })) {
        k.spinT = 0; k.spinAngle = 0; k.addFx('frozen', 1.4);
        sys.add(new Cube(sys, k));
        sys.race.sfx('item-ice', k);
      }
      puff(sys, ICE, 20, this.pos.x, this.pos.y, this.pos.z, 8);
      return false;
    }
    return true;
  }
}

registerItem({
  id: 'freeze',
  aim: true,
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><rect x="26" y="40" width="12" height="20" rx="3" fill="#f2c79a" stroke="#2a2433" stroke-width="3"/><path d="M16 38V16c0-8 6-12 16-12s16 4 16 12v22z" fill="#4fd0ff" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M16 26h32v12H16z" fill="#ff7ac0"/><path d="M16 38V16c0-8 6-12 16-12s16 4 16 12v22z" fill="none" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M22 12c2-4 6-5 10-5" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".8"/><path d="M52 8l-3 4 4 2zM12 48l4 2-2 4z" fill="#bfefff" stroke="#2a2433" stroke-width="2" stroke-linejoin="round"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0.3 : 0.7 + 1.3 * f),
  use(sys, kart) { sys.add(new Pop(sys, kart)); },
  aiWants: (k, ctx) => rivalNear(ctx.race.items, k, 45, 0.6) || ctx.hold > 7,
});
