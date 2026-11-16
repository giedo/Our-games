// Glitter Bomb: lobbed about 25 m ahead in an arc, bursts in a 7 m cloud of glitter.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { litMat, geoOnce, mat4, puff, Wave, GLITTER, roadDir, detach, rivalNear } from './common.js';

addStrings({ en: { items: { bomb: 'Glitter Bomb' } }, nl: { items: { bomb: 'Glitterbom' } } });

const RADIUS = 7, T = 0.95;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

class Bomb {
  constructor(sys, kart) {
    const tr = sys.world.track, dir = roadDir(sys, kart);
    this.sys = sys; this.owner = kart; this.projectile = true; this.dead = false; this.t = 0;
    this.a = new THREE.Vector3(kart.x, kart.y + 1.6, kart.z);
    let lat = kart.lat;
    const tgt = sys.race.kartAhead(kart);
    if (tgt && !sys.race.world.def.arena && Math.hypot(tgt.x - kart.x, tgt.z - kart.z) < 45) lat = tgt.lat * 0.7 + lat * 0.3; // aim at the one ahead
    this.b = tr.posAt(kart.s + (dir * (25 + Math.max(0, kart.speed) * T)) / tr.seg, lat, new THREE.Vector3());
    this.pos = this.a.clone();
    this.mesh = sys.spawnMesh(geoOnce(sys, 'bomb', () => [
      { geo: new THREE.SphereGeometry(0.75, 12, 9), color: 0xff5cf0 },
      { geo: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), color: 0xc9ced8, matrix: mat4(0, 0.78, 0, 0, 0, 0) },
      { geo: new THREE.SphereGeometry(0.1, 5, 4), color: 0xffe14a, matrix: mat4(0.1, 1.4, 0, 0, 0, 0) },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4), color: 0x2a2433, matrix: mat4(0.05, 1.1, 0, 0, 0, 0.3) },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ geo: new THREE.OctahedronGeometry(0.16, 0), color: i % 2 ? 0xffffff : 0x4fe9ff, matrix: mat4(Math.cos(i * 1.9) * 0.7, Math.sin(i * 2.7) * 0.5, Math.sin(i * 1.9) * 0.7, 0, 0, 0) })),
    ]), litMat(sys), this.a.x, this.a.y, this.a.z);
    // A pulsing target ring on the ground shows where it will land.
    const rg = sys.res('bomb-ring', () => { const g = new THREE.RingGeometry(RADIUS - 0.7, RADIUS, 36); g.rotateX(-Math.PI / 2); return g; });
    this.ring = sys.spawnMesh(rg, new THREE.MeshBasicMaterial({ color: 0xff5cf0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), this.b.x, this.b.y + 0.35, this.b.z);
    this.ring.renderOrder = 3;
    sys.race.sfx('throw', kart);
  }

  pop() { this.dead = true; }

  update(dt, sys) {
    this.t += dt;
    const u = Math.min(1, this.t / T);
    this.pos.lerpVectors(this.a, this.b, u);
    this.pos.y += 7 * 4 * u * (1 - u) + 0.8 * u;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += dt * 9; this.mesh.rotation.z += dt * 5;
    this.ring.scale.setScalar(0.6 + 0.4 * u + Math.sin(this.t * 24) * 0.05);
    this.ring.material.opacity = 0.35 + 0.5 * Math.abs(Math.sin(this.t * 10));
    sys.race.particles.emit(true, GLITTER[Math.floor(Math.random() * 5)], { x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, vy: 1, life: 0.4, size: 0.35, size1: 0.05 });
    if (this.dead) return false;
    if (u < 1) return true;
    // Bang.
    const b = this.b, P = sys.race.particles;
    sys.hitKartsNear(b.x, b.y, b.z, RADIUS, this.owner, { cause: 'bomb', ky: 1, dy: 4 });
    for (let i = 0; i < 3; i++) P.burst(true, GLITTER, 30, b.x, b.y + 1 + i, b.z, 10 + i * 3, { size: 0.6, life: 1.6, gravity: 2.5, drag: 1.2, sphere: true });
    P.burst(false, [0xff9ad5, 0xffffff, 0xb9ecff], 26, b.x, b.y + 1, b.z, 9, { size: 1.8, size1: 3, life: 0.9, gravity: 0.5, drag: 1.5, a: 0.45 });
    sys.add(new Wave(sys, b.x, b.y, b.z, GLITTER.slice(0, 3), RADIUS + 1, 0.55));
    sys.race.sfx('item-glitter', this.owner);
    for (const k of sys.race.karts) if (k.human && Math.hypot(k.x - b.x, k.z - b.z) < 25 && k !== this.owner) sys.race.sfx('item-glitter', k);
    return false;
  }

  dispose() {
    detach(this.mesh);
    detach(this.ring); this.ring.material.dispose();
  }
}

registerItem({
  id: 'bomb',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><circle cx="30" cy="38" r="22" fill="#ff5cf0" stroke="#2a2433" stroke-width="3"/><rect x="22" y="12" width="16" height="9" rx="2" fill="#c9ced8" stroke="#2a2433" stroke-width="3"/><path d="M38 14c8-6 12-2 14-10" fill="none" stroke="#2a2433" stroke-width="3" stroke-linecap="round"/><path d="M52 0l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe14a" stroke="#2a2433" stroke-width="2" stroke-linejoin="round" transform="translate(-1 0)"/><path d="M20 34l3 5 5 1-4 4 1 5-5-3-5 3 1-5-4-4 5-1z" fill="#fff" opacity=".9"/><path d="M38 46l2 3 3 .5-2.5 2.5.5 3-3-2-3 2 .5-3-2.5-2.5 3-.5z" fill="#4fe9ff"/><ellipse cx="22" cy="28" rx="5" ry="3" fill="#fff" opacity=".5" transform="rotate(-35 22 28)"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0.5 : 1 + 1.2 * f),
  use(sys, kart) { sys.add(new Bomb(sys, kart)); },
  aiWants: (k, ctx) => rivalNear(ctx.race.items, k, 38, 0.5) || ctx.hold > 7,
});
