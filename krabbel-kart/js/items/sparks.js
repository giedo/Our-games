// Sparkler: five quick sparkle shots.
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Shot, litMat, geoOnce, starGeo, paint, puff, canHit, dS, isArena, rivalNear } from './common.js';

addStrings({ en: { items: { sparks: 'Sparkler' } }, nl: { items: { sparks: 'Sterretje' } } });

const FIRE = [0xffe14a, 0xffffff, 0xff9a3c, 0xff5cf0];

class Spark extends Shot {
  constructor(sys, kart) {
    super(sys, kart, { speed: 78, h: 1.2, life: 1.4, lead: 3 });
    this.mesh = sys.spawnMesh(geoOnce(sys, 'spark', () => [{ geo: paint(starGeo(0.6, 0.25, 0.25, 4), () => 0xffe14a), color: 0xffe14a }]), litMat(sys));
    this.age = 0; this.mesh.scale.setScalar(2.7);
    sys.race.sfx('item-zap', kart);
  }

  // The nearest kart in front, in the lane roughly where the shot is heading.
  aim(sys) {
    const tr = sys.world.track, arena = isArena(sys);
    let best = null, bd = 1e9;
    for (const k of sys.race.karts) {
      if (!canHit(k, this.owner)) continue;
      const ds = dS(tr, this.s, k.s) * tr.seg * this.dir;
      if (!arena && (ds < 0 || ds > 45)) continue;
      const d = arena ? Math.hypot(k.x - this.pos.x, k.z - this.pos.z) : ds;
      if (d < bd && d < 45) { bd = d; best = k; }
    }
    return best;
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    if (this.dead || this.life <= 0) return false;
    const t = this.aim(sys);
    if (t) this.steer(t, dt, 3);
    this.advance(dt);
    this.face();
    this.mesh.rotation.set(0, this.age * 18, this.age * 9);
    const P = sys.race.particles;
    for (let i = 0; i < 3; i++) P.emit(true, FIRE[Math.floor(Math.random() * 4)], { x: this.prev.x + (this.pos.x - this.prev.x) * i * 0.33, y: this.pos.y + (Math.random() - 0.5) * 0.6, z: this.prev.z + (this.pos.z - this.prev.z) * i * 0.33, vy: 1 + Math.random() * 2, life: 0.5, size: 0.9, size1: 0.05, gravity: 6, a: 0.9 });
    if (sys.hitKartsNear(this.pos.x, this.pos.y, this.pos.z, 2.3, this.age < 0.25 ? this.owner : null, { cause: 'sparks', first: true }).length) {
      puff(sys, FIRE, 24, this.pos.x, this.pos.y, this.pos.z, 9, { size: 0.5, life: 0.6 });
      return false;
    }
    return true;
  }
}

registerItem({
  id: 'sparks',
  ages: ['big'],
  uses: 5,
  icon: '<svg viewBox="0 0 64 64"><path d="M14 58L38 26" stroke="#2a2433" stroke-width="9" stroke-linecap="round"/><path d="M14 58L38 26" stroke="#c9ced8" stroke-width="4" stroke-linecap="round"/><path d="M40 22l4-14M40 22l-12-6M40 22l14 2M40 22l10 12M40 22l-8 12" stroke="#2a2433" stroke-width="8" stroke-linecap="round"/><path d="M40 22l4-14M40 22l-12-6M40 22l14 2M40 22l10 12M40 22l-8 12" stroke="#ffe14a" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="22" r="6" fill="#fff" stroke="#2a2433" stroke-width="3"/><circle cx="52" cy="8" r="3" fill="#ff5cf0"/><circle cx="22" cy="10" r="3" fill="#4fe9ff"/></svg>',
  weight: (k, f) => 0.5 + 1.1 * f,
  use(sys, kart) { sys.add(new Spark(sys, kart)); },
  aiWants: (k, ctx) => rivalNear(ctx.race.items, k, 40, 0.7) || ctx.hold > 8,
});
