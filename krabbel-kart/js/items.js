// Item boxes and the four power-ups: turbo crayon, paint puddle, paper plane, bubble shield.
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvas, canvasTexture, TAU, mulberry32 } from './util.js';

export const ITEMS = ['turbo', 'puddle', 'plane', 'shield'];
const PUDDLE_COLORS = [0xff3fa4, 0x3fd0ff, 0xffd21f, 0x7be04a, 0xb46bff];

// Inline SVG icons for the HUD.
export const ITEM_ICONS = {
  turbo: '<svg viewBox="0 0 64 64"><path d="M6 36c6-8 12-4 16-2l-4 10c-4 0-9 0-12-8z" fill="#ff7a1f"/><path d="M12 37c3-3 6-2 8-1l-2 5c-2 0-4 0-6-4z" fill="#ffe14a"/><path d="M20 26l24-10 10 4-6 9-24 12z" fill="#ffd21f" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M44 16l10 4 6-8-11-3z" fill="#f2c79a" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M55 9l5 3" stroke="#2a2433" stroke-width="5" stroke-linecap="round"/><path d="M20 26l4 15" stroke="#2a2433" stroke-width="3"/><path d="M16 28l6-3 4 16-6 3z" fill="#ff8fb0" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/></svg>',
  puddle: '<svg viewBox="0 0 64 64"><path d="M10 40c-6-8 2-16 10-14 2-10 16-12 20-3 8-4 18 2 14 11 8 4 4 15-6 14-4 8-16 8-20 2-8 4-18-2-18-10z" fill="#ff3fa4" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><ellipse cx="26" cy="32" rx="6" ry="3" fill="#ffffff" opacity=".6"/><circle cx="54" cy="16" r="4" fill="#ff3fa4" stroke="#2a2433" stroke-width="2.5"/><circle cx="8" cy="20" r="3" fill="#ff3fa4" stroke="#2a2433" stroke-width="2.5"/></svg>',
  plane: '<svg viewBox="0 0 64 64"><path d="M4 30l56-20-18 44-12-16z" fill="#ffffff" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M60 10L30 38l-2 14 8-8" fill="#d6e6f5" stroke="#2a2433" stroke-width="3" stroke-linejoin="round"/><path d="M4 30l26 8" stroke="#2a2433" stroke-width="3"/></svg>',
  shield: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#9fe9ff" stroke="#2a2433" stroke-width="3"/><circle cx="32" cy="32" r="24" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="20 131" stroke-linecap="round" transform="rotate(-150 32 32) scale(.78) translate(9 9)"/><circle cx="23" cy="22" r="4" fill="#ffffff"/></svg>',
};

function boxTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const cols = ['#ff4b4b', '#ffa53c', '#ffe14a', '#5fe06a', '#4fb8ff', '#b46bff'];
  cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (i * 128) / 6, 128, 128 / 6 + 1); });
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  // A chunky star in the middle.
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 20 : 46;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = '#ffffff'; g.fill();
  g.strokeStyle = '#2a2433'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
  return canvasTexture(c);
}

function planeGeometry() {
  // A folded paper plane pointing along +Z.
  const v = [
    0, 0, 1.3, -0.9, 0.12, -0.8, 0, 0.05, -0.8,
    0, 0, 1.3, 0, 0.05, -0.8, 0.9, 0.12, -0.8,
    0, 0, 1.3, 0, 0.05, -0.8, 0, -0.42, -0.7,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class ItemSystem {
  constructor(race) {
    this.race = race;
    this.world = race.world;
    const w = this.world, scene = w.scene;
    this.tex = boxTexture();
    this.boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    this.boxMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.94 });
    this.boxes = w.itemSpots.map((sp, i) => ({ s: sp.s, lat: sp.lat, x: sp.pos.x, y: sp.pos.y + 1.25, z: sp.pos.z, t: 0, ph: i * 0.7 }));
    this.boxMesh = new THREE.InstancedMesh(this.boxGeo, this.boxMat, Math.max(1, this.boxes.length));
    this.boxMesh.frustumCulled = false;
    this.boxMesh.renderOrder = 2;
    scene.add(this.boxMesh);
    this.dummy = new THREE.Object3D();
    this.puddles = [];
    this.planes = [];
    this.planeGeo = planeGeometry();
    this.planeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x777777 });
    const rnd = mulberry32(99);
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU, r = 1.9 + (rnd() - 0.5) * 1.1;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    this.puddleGeo = new THREE.ShapeGeometry(new THREE.Shape(new THREE.SplineCurve(pts.concat(pts[0])).getPoints(40)));
    this.puddleGeo.rotateX(-Math.PI / 2);
  }

  // Weighted random item: leaders get defensive items, stragglers get catch-up items.
  pick(kart) {
    const n = this.race.karts.length;
    const f = n > 1 ? (kart.place - 1) / (n - 1) : 0;
    const wts = { turbo: 2 + 3 * f, puddle: Math.max(0.8, 3 - 2.4 * f), plane: kart.place === 1 ? 0.25 : 1 + 3 * f, shield: 1.8 };
    let tot = 0;
    for (const k of ITEMS) tot += wts[k];
    let r = Math.random() * tot;
    for (const k of ITEMS) { r -= wts[k]; if (r <= 0) return k; }
    return 'turbo';
  }

  use(kart) {
    if (!kart.item || kart.rollT > 0) return;
    const it = kart.item, race = this.race, tr = this.world.track;
    kart.item = null;
    if (it === 'turbo') {
      kart.boost(1.9, 1.42);
      race.sfx('boost', kart);
    } else if (it === 'shield') {
      kart.shieldT = 12;
      race.sfx('shield', kart);
    } else if (it === 'puddle') {
      const fx = Math.sin(kart.dir), fz = Math.cos(kart.dir);
      const x = kart.x - fx * 3.4, z = kart.z - fz * 3.4;
      const loc = tr.locate(x, z, kart.idx, {});
      const color = PUDDLE_COLORS[Math.floor(Math.random() * PUDDLE_COLORS.length)];
      const mesh = new THREE.Mesh(this.puddleGeo, new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
      mesh.position.set(x, this.world.groundAt(x, z, loc) + 0.04, z);
      mesh.rotation.y = Math.random() * TAU;
      mesh.scale.setScalar(0.1);
      this.world.scene.add(mesh);
      this.puddles.push({ x, z, y: mesh.position.y, s: loc.s, lat: loc.lat, mesh, color, life: 45, owner: kart, age: 0 });
      if (this.puddles.length > 14) this.removePuddle(this.puddles[0]);
      race.sfx('splat', kart);
    } else if (it === 'plane') {
      const mesh = new THREE.Mesh(this.planeGeo, this.planeMat);
      mesh.scale.setScalar(1.3);
      this.world.scene.add(mesh);
      this.planes.push({ s: kart.s + 3 / tr.seg, lat: kart.lat, owner: kart, target: race.kartAhead(kart), life: 7, mesh, pos: new THREE.Vector3(kart.x, kart.y + 1.4, kart.z), wob: Math.random() * 6 });
      race.sfx('throw', kart);
    }
  }

  removePuddle(p) {
    const i = this.puddles.indexOf(p);
    if (i >= 0) this.puddles.splice(i, 1);
    this.world.scene.remove(p.mesh);
    p.mesh.material.dispose();
  }

  update(dt, time) {
    const race = this.race, karts = race.karts, tr = this.world.track, P = race.particles;
    const d = this.dummy;
    // Boxes.
    this.boxes.forEach((b, i) => {
      if (b.t > 0) {
        b.t -= dt;
        d.scale.setScalar(b.t <= 0.3 ? Math.max(0.001, 1 - b.t / 0.3) : 0.001);
      } else d.scale.setScalar(1);
      d.position.set(b.x, b.y + Math.sin(time * 2 + b.ph) * 0.25, b.z);
      d.rotation.set(time * 0.9 + b.ph, time * 1.3 + b.ph, 0);
      d.updateMatrix();
      this.boxMesh.setMatrixAt(i, d.matrix);
    });
    this.boxMesh.instanceMatrix.needsUpdate = true;
    for (const k of karts) {
      // Roulette.
      if (k.rollT > 0) {
        k.rollT -= dt;
        if (k.rollT <= 0) {
          k.item = k.rollPick; k.rollPick = null;
          k.aiItemT = 0.6 + Math.random() * 2.5; k.aiHold = 0;
          race.sfx('itemReady', k);
        }
      }
      if (k.item || k.rollT > 0 || k.finished) continue;
      for (const b of this.boxes) {
        if (b.t > 0) continue;
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz < 4.4 && Math.abs(k.y + 1 - b.y) < 2.6) {
          b.t = 3.2;
          k.rollT = 1.5; k.rollPick = this.pick(k);
          P.burst(true, [0xffe14a, 0xff5cf0, 0x4fe9ff, 0xffffff], 18, b.x, b.y, b.z, 7, { size: 0.5, life: 0.5, gravity: 6 });
          race.sfx('pickup', k);
          break;
        }
      }
    }
    // Paint puddles.
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.age += dt; p.life -= dt;
      p.mesh.scale.setScalar(Math.min(1, p.age * 4) * (p.life < 1 ? Math.max(0.01, p.life) : 1));
      if (p.life <= 0) { this.removePuddle(p); continue; }
      for (const k of karts) {
        if (k === p.owner && p.age < 1.2) continue;
        const dx = k.x - p.x, dz = k.z - p.z;
        if (dx * dx + dz * dz < 5.3 && k.y - p.y < 1) {
          if (k.hitCool > 0) continue;
          k.hit();
          P.burst(false, [p.color], 26, p.x, p.y + 0.3, p.z, 8, { size: 0.6, life: 0.7, gravity: 16 });
          race.sfx('splat', k);
          this.removePuddle(p);
          break;
        }
      }
    }
    // Paper planes.
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const pl = this.planes[i];
      pl.life -= dt;
      const t = pl.target;
      let done = pl.life <= 0;
      if (t && !t.finished) {
        let ds = t.s - pl.s;
        if (ds < -tr.n / 2) ds += tr.n; else if (ds > tr.n / 2) ds -= tr.n;
        pl.lat += (t.lat - pl.lat) * Math.min(1, dt * (ds < 20 / tr.seg ? 9 : 2.5));
      }
      pl.s += (58 * dt) / tr.seg;
      const prev = pl.pos.clone();
      tr.posAt(pl.s, pl.lat, pl.pos);
      pl.pos.y += 1.4 + Math.sin(time * 9 + pl.wob) * 0.25;
      pl.mesh.position.copy(pl.pos);
      pl.mesh.rotation.set(0, Math.atan2(pl.pos.x - prev.x, pl.pos.z - prev.z), Math.sin(time * 7 + pl.wob) * 0.35, 'YXZ');
      P.emit(false, 0xffffff, { x: prev.x, y: prev.y, z: prev.z, life: 0.35, size: 0.35, size1: 0.05, a: 0.7 });
      for (const k of karts) {
        if (k === pl.owner || k.finished) continue;
        const dx = k.x - pl.pos.x, dz = k.z - pl.pos.z;
        if (dx * dx + dz * dz < 6.5 && Math.abs(k.y + 1 - pl.pos.y) < 3) {
          k.hit();
          P.burst(false, [0xffffff, 0xd6e6f5], 16, pl.pos.x, pl.pos.y, pl.pos.z, 6, { size: 0.5, life: 0.6, gravity: 6 });
          done = true;
          break;
        }
      }
      if (done) {
        this.world.scene.remove(pl.mesh);
        this.planes.splice(i, 1);
      }
    }
  }

  dispose() {
    const scene = this.world.scene;
    scene.remove(this.boxMesh);
    this.boxGeo.dispose(); this.boxMat.dispose(); this.tex.dispose();
    for (const p of this.puddles.slice()) this.removePuddle(p);
    for (const pl of this.planes) scene.remove(pl.mesh);
    this.planes.length = 0;
    this.planeGeo.dispose(); this.planeMat.dispose(); this.puddleGeo.dispose();
  }
}
