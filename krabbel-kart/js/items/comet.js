// Comet Chalk: flies along the road to whoever is in first place and bursts there.
import { registerItem } from '../items.js';
import { addStrings, t } from '../i18n.js';
import { Shot, litMat, geoOnce, starGeo, paint, puff, canHit, hudOf } from './common.js';

addStrings({ en: { items: { comet: 'Comet Chalk' }, cometWarn: 'Comet coming for you!' }, nl: { items: { comet: 'Komeetkrijt' }, cometWarn: 'Een komeet komt eraan!' } });

const CHALK = [0xffffff, 0x9fe9ff, 0xffe14a, 0xff7ac0];

class Comet extends Shot {
  constructor(sys, kart, target) {
    super(sys, kart, { speed: 64, h: 1.6, life: 22, lead: 4 });
    this.target = target; this.age = 0;
    this.mesh = sys.spawnMesh(geoOnce(sys, 'comet', () => [
      { geo: paint(starGeo(1.1, 0.5, 0.5), () => 0xffe14a), color: 0xffe14a },
      { geo: paint(starGeo(1.35, 0.62, 0.3), () => 0xff4aa8), color: 0xff4aa8 },
    ]), litMat(sys));
    this.mesh.scale.setScalar(2);
    sys.race.sfx('item-comet', kart);
  }

  update(dt, sys) {
    this.age += dt; this.life -= dt;
    const P = sys.race.particles;
    if (this.dead || this.life <= 0) return false;
    let t = this.target;
    if (!t || t.out || t.finished) { t = this.target = sys.race.karts.find((k) => k.place === 1 && canHit(k, this.owner)) || null; if (!t) { this.pop(); return false; } }
    // Fast along the road, easing into the leader's lane.
    this.steer(t, dt, 4);
    this.advance(dt);
    this.h = 1.6 + Math.sin(this.age * 12) * 0.3;
    this.face();
    this.mesh.rotation.set(0, Math.atan2(this.pos.x - this.prev.x, this.pos.z - this.prev.z), this.age * 9);
    for (let i = 0; i < 5; i++) {
      const u = Math.random();
      P.emit(true, CHALK[i % 4], { x: this.prev.x + (this.pos.x - this.prev.x) * u, y: this.pos.y + (Math.random() - 0.5) * 1.6, z: this.prev.z + (this.pos.z - this.prev.z) * u, life: 0.7, size: 1.4, size1: 0.2, a: 0.95 });
    }
    if (Math.random() < 0.5) P.emit(false, 0xffffff, { x: this.pos.x, y: this.pos.y, z: this.pos.z, vy: 2, life: 0.9, size: 0.8, size1: 2, a: 0.25 });
    for (const k of sys.race.karts) {
      if (!canHit(k, this.owner) || k.hitCool > 0) continue;
      const dx = k.x - this.pos.x, dz = k.z - this.pos.z;
      if (dx * dx + dz * dz > (k === t ? 14 : 9) || Math.abs(k.y + 1 - this.pos.y) > 3.5) continue;
      if (k !== t) { k.hit({ by: this.owner, cause: 'comet', soft: true }); continue; }
      k.hit({ by: this.owner, cause: 'comet' });
      sys.race.sfx('item-cometHit', k);
      puff(sys, CHALK, 40, this.pos.x, this.pos.y, this.pos.z, 12, { size: 0.8, life: 0.9, sphere: true });
      sys.add({ update(d) { return (this.t = (this.t || 0) + d) < 0.2 ? true : (P.burst(true, CHALK, 20, k.x, k.y + 1, k.z, 7, { size: 0.5, life: 0.8 }), false); } });
      return false;
    }
    return true;
  }
}

registerItem({
  id: 'comet',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M4 58L34 34" stroke="#9fe9ff" stroke-width="9" stroke-linecap="round"/><path d="M12 44L38 34M20 58l14-20" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/><path d="M44 6l6 13 14 2-10 10 3 14-13-7-13 7 3-14L21 21l14-2z" fill="#ffe14a" stroke="#2a2433" stroke-width="3" stroke-linejoin="round" transform="translate(-2 4) scale(.95)"/><circle cx="43" cy="28" r="3" fill="#fff"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0 : 0.3 + 0.9 * f),
  use(sys, kart) {
    const lead = sys.race.karts.find((k) => k.place === 1 && canHit(k, kart));
    if (!lead) return false;
    sys.add(new Comet(sys, kart, lead));
    const h = hudOf(sys, lead);
    if (h) h.warn(t('cometWarn'), 3);
  },
  aiWants: (k) => k.place > 1,
});
