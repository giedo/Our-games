// Bouncy Ball: shot straight ahead, bounces off the road edges up to five times.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Shot, litMat, geoOnce, paint, puff, RAINBOW, rivalNear } from './common.js';

addStrings({ en: { items: { ball: 'Bouncy Ball' } }, nl: { items: { ball: 'Stuiterbal' } } });

class Ball extends Shot {
  constructor(sys, kart) {
    super(sys, kart, { speed: 44, h: 1, life: 10, lead: 3.5 });
    this.mesh = sys.spawnMesh(geoOnce(sys, 'ball', () => [{ geo: paint(new THREE.SphereGeometry(0.85, 14, 10), (x, y, z) => RAINBOW[Math.floor(((Math.atan2(z, y) + Math.PI) / (Math.PI * 2)) * 6) % 6]), color: 0xffffff }]), litMat(sys));
    this.vlat = (Math.random() < 0.5 ? -1 : 1) * 15; this.bounces = 0; this.age = 0; this.squash = 0;
    sys.race.sfx('throw', kart);
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    if (this.dead || this.life <= 0) return false;
    const tr = sys.world.track, lim = tr.halfWidth - 1;
    this.lat += this.vlat * dt;
    if (Math.abs(this.lat) > lim) {
      this.lat = Math.sign(this.lat) * lim; this.vlat = -this.vlat; this.bounces++;
      this.squash = 1; sys.race.sfx('item-bounce', this.owner);
      puff(sys, RAINBOW, 8, this.pos.x, this.pos.y, this.pos.z, 5, { size: 0.4, life: 0.4 });
      if (this.bounces >= 5) { this.pop(); return false; }
    }
    this.h = 0.85 + Math.abs(Math.sin(this.age * 7)) * 1.5;
    this.advance(dt);
    this.squash = Math.max(0, this.squash - dt * 6);
    this.face();
    this.mesh.rotation.x += dt * 14; this.mesh.rotation.z += dt * 3;
    this.mesh.scale.set(1 + this.squash * 0.3, 1 - this.squash * 0.3, 1 + this.squash * 0.3);
    sys.race.particles.emit(true, RAINBOW[Math.floor(Math.random() * 6)], { x: this.prev.x, y: this.prev.y, z: this.prev.z, life: 0.3, size: 0.45, size1: 0.05, a: 0.8 });
    if (sys.hitKartsNear(this.pos.x, this.pos.y, this.pos.z, 1.9, this.age < 0.7 ? this.owner : null, { cause: 'ball', first: true }).length) {
      puff(sys, RAINBOW, 22, this.pos.x, this.pos.y, this.pos.z, 8, { size: 0.55 });
      return false;
    }
    return true;
  }
}

registerItem({
  id: 'ball',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M6 54c6-26 14-26 20-6" fill="none" stroke="#2a2433" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/><circle cx="38" cy="30" r="22" fill="#ff4b4b" stroke="#2a2433" stroke-width="3"/><path d="M20 20c8 6 24 4 36 0v6c-12 6-28 6-36 0z" fill="#ffd21f"/><path d="M17 36c10 6 28 8 42 0l-1 6c-14 8-32 6-41 0z" fill="#4fb8ff"/><circle cx="38" cy="30" r="22" fill="none" stroke="#2a2433" stroke-width="3"/><ellipse cx="28" cy="18" rx="5" ry="3" fill="#fff" opacity=".7" transform="rotate(-30 28 18)"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0.5 : 1 + 1.2 * f),
  use(sys, kart) { sys.add(new Ball(sys, kart)); },
  aiWants: (k, ctx) => rivalNear(ctx.race.items, k, 45, 0.4) || ctx.hold > 7,
});
