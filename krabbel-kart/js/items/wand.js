// Wobble Wand: rivals ahead turn into wobbly jelly shapes and slow down briefly.
import * as THREE from '../../vendor/three.module.min.js';
import { registerItem } from '../items.js';
import { addStrings } from '../i18n.js';
import { Wave, puff, canHit, isArena, detach } from './common.js';

addStrings({ en: { items: { wand: 'Wobble Wand' } }, nl: { items: { wand: 'Wiebelstaf' } } });

const JELLY = [0xff5c8a, 0x7be04a, 0xb46bff, 0xffa53c, 0x4fe9ff];
const DUR = 2.4;

// A glossy jelly shell round the kart; the kart itself wobbles too (scaled after the kart code has set it).
class Jelly {
  constructor(sys, kart, delay, color) {
    this.kart = kart; this.t = -delay; this.on = false;
    const geo = sys.res('jelly-geo', () => new THREE.SphereGeometry(1, 16, 12));
    this.mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(0, 0.9, 0); this.mesh.renderOrder = 4; this.mesh.visible = false;
    this.len = kart.model.len;
    kart.model.anim.add(this.mesh);
  }

  update(dt, sys) {
    const k = this.kart;
    this.t += dt;
    if (this.t < 0) return true;
    if (!this.on) {
      this.on = true; this.mesh.visible = true;
      k.addFx('slip', DUR); k.addFx('slow', 1.6); k.slowMul = 0.75;
      puff(sys, [this.mat.color.getHex(), 0xffffff], 16, k.x, k.y + 1, k.z, 7, { sphere: true });
      sys.race.sfx('item-wobble', k);
    }
    const t = this.t, u = Math.min(1, t * 8), fade = t > DUR - 0.4 ? Math.max(0, (DUR - t) / 0.4) : 1;
    if (t >= DUR || k.out) { puff(sys, [this.mat.color.getHex(), 0xffffff], 12, k.x, k.y + 1, k.z, 6); return false; }
    const w = Math.sin(t * 16) * 0.13 * fade;
    this.mesh.scale.set((1.55 + w) * u, (1.15 - w) * u, (this.len * 0.5 + 0.7 + w * 0.5) * u);
    this.mat.opacity = 0.55 * fade;
    const b = k.model.body;
    b.scale.x *= 1 + w * 1.5; b.scale.y *= 1 - w * 1.5; b.scale.z *= 1 + w * 0.5;
    b.rotation.z += Math.sin(t * 11) * 0.12 * fade;
    return true;
  }

  dispose() { detach(this.mesh); this.mat.dispose(); }
}

registerItem({
  id: 'wand',
  ages: ['big'],
  icon: '<svg viewBox="0 0 64 64"><path d="M10 56L38 28" stroke="#2a2433" stroke-width="10" stroke-linecap="round"/><path d="M10 56L38 28" stroke="#b46bff" stroke-width="5" stroke-linecap="round"/><path d="M16 50l6 6M26 40l6 6" stroke="#ffe14a" stroke-width="5" stroke-linecap="round"/><path d="M44 4l5 11 12 2-9 9 2 12-10-6-11 6 2-12-9-9 12-2z" fill="#ffd21f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round" transform="translate(-4 4) scale(.9)"/><path d="M6 20c4-4 8 4 12 0M4 32c4-4 8 4 12 0" fill="none" stroke="#ff5c8a" stroke-width="4" stroke-linecap="round"/></svg>',
  weight: (k, f) => (k.place === 1 ? 0 : 0.3 + 1.4 * f),
  use(sys, kart) {
    const race = sys.race, arena = isArena(sys), vs = [];
    for (const k of race.karts) {
      if (k === kart || !canHit(k, kart)) continue;
      const d = Math.hypot(k.x - kart.x, k.z - kart.z);
      if (arena ? d < 45 : k.place < kart.place) vs.push(k);
    }
    sys.add(new Wave(sys, kart.x, kart.y, kart.z, [0xb46bff, 0xff7ac0], 70, 0.8, 0.14));
    race.particles.burst(true, [0xb46bff, 0xff7ac0, 0xffe14a, 0xffffff], 26, kart.x, kart.y + 2, kart.z, 9, { size: 0.6, life: 0.8, gravity: 2, sphere: true });
    race.sfx('item-wobble', kart);
    vs.forEach((k, i) => sys.add(new Jelly(sys, k, Math.min(0.8, Math.hypot(k.x - kart.x, k.z - kart.z) / 90), JELLY[i % 5])));
  },
  aiWants: (k) => k.place > 1,
});
