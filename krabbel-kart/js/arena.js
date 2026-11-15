// Arena dressing for the battle modes: a low striped fence on both edges of the ring (one mesh,
// coloured with the world's curb colours) and a spinning crayon carousel on the island in the middle.
import * as THREE from '../vendor/three.module.min.js';
import { mergeColored, mat4, TAU } from './util.js';

const FENCE_COLORS = [0xff4b4b, 0xffd21f, 0x4fb8ff, 0x5fd048, 0xff7ac0, 0xb46bff];

function fence(w) {
  const tr = w.track, n = tr.n, hw = tr.halfWidth;
  const ca = new THREE.Color(w.theme.road.curbA), cb = new THREE.Color(w.theme.road.curbB), top = new THREE.Color(0xffffff);
  const pos = [], col = [];
  const lat0 = hw + 2.15, lat1 = hw + 2.75, y0 = -0.3, y1 = 0.95;
  const quad = (a, b, c, d, color) => {
    for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); col.push(color.r, color.g, color.b); }
  };
  const P = (i, lat, dy) => [tr.px[i % n] + tr.rx[i % n] * lat, tr.py[i % n] + dy, tr.pz[i % n] + tr.rz[i % n] * lat];
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const j = i + 1, c = Math.floor(i / 3) % 2 ? ca : cb, l0 = side * lat0, l1 = side * lat1;
      // inner face, top, outer face (wound for either side so both show from the road and from outside)
      quad(P(i, l0, y0), P(j, l0, y0), P(j, l0, y1), P(i, l0, y1), c);
      quad(P(i, l0, y1), P(j, l0, y1), P(j, l1, y1), P(i, l1, y1), top);
      quad(P(i, l1, y1), P(j, l1, y1), P(j, l1, y0), P(i, l1, y0), c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.castShadow = true;
  w.scene.add(m);
}

// A tall striped pole with a crown of arms that carry pennants and balls, and a gold star on top.
function carousel(w) {
  const b = w.track.bounds, y = w.track.py[0] - 0.3;
  const ca = w.theme.road.curbA, cb = w.theme.road.curbB;
  const base = mergeColored([
    { geo: new THREE.CylinderGeometry(9, 9.6, 0.7, 24), color: cb, matrix: mat4(0, 0.35, 0) },
    { geo: new THREE.CylinderGeometry(6.4, 7, 0.7, 24), color: ca, matrix: mat4(0, 1.05, 0) },
    { geo: new THREE.CylinderGeometry(3.6, 4.2, 0.8, 18), color: 0xffffff, matrix: mat4(0, 1.75, 0) },
    { geo: new THREE.CylinderGeometry(0.7, 0.9, 12, 10), color: 0xf4f4f4, matrix: mat4(0, 8, 0) },
    { geo: new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10), color: ca, matrix: mat4(0, 4.2, 0) },
    { geo: new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10), color: cb, matrix: mat4(0, 7.2, 0) },
    { geo: new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10), color: ca, matrix: mat4(0, 10.2, 0) },
  ]);
  const baseMesh = new THREE.Mesh(base, w.mats.scenery);
  baseMesh.castShadow = true;
  const crown = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, col = FENCE_COLORS[i % FENCE_COLORS.length];
    const arm = new THREE.BoxGeometry(6.6, 0.22, 0.22); arm.translate(3.3, 0, 0);
    crown.push({ geo: arm, color: 0xf4f4f4, matrix: mat4(0, 0, 0, 0, a, 0) });
    const ball = new THREE.SphereGeometry(0.85, 10, 8);
    crown.push({ geo: ball, color: col, matrix: mat4(Math.cos(a) * 6.8, -0.1, -Math.sin(a) * 6.8) });
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.1, 0, 0, -1.9, 0, 0, -1.0, 1.7], 3));
    crown.push({ geo: flag, color: col, matrix: mat4(Math.cos(a) * 3.2, -0.2, -Math.sin(a) * 3.2, 0, a, 0) });
  }
  const crownMesh = new THREE.Mesh(mergeColored(crown), w.mats.sceneryDouble);
  crownMesh.position.y = 11.4;
  crownMesh.castShadow = true;
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? 0.9 : 2.1; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const sg = new THREE.ExtrudeGeometry(star, { depth: 0.5, bevelEnabled: false });
  sg.translate(0, 0, -0.25);
  const starMesh = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x7a5a00 }));
  starMesh.position.y = 14.6;
  starMesh.castShadow = true;
  const grp = new THREE.Group();
  grp.add(baseMesh, crownMesh, starMesh);
  grp.position.set(b.cx, y, b.cz);
  w.scene.add(grp);
  w.updaters.push((dt, t) => { crownMesh.rotation.y = t * 0.45; starMesh.rotation.y = -t * 0.9; starMesh.position.y = 14.6 + Math.sin(t * 2) * 0.25; });
}

export function buildArenaProps(w) {
  fence(w);
  carousel(w);
}
