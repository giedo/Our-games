// Zero-G Galaxy: a glowing road floating through space. Low gravity and hovering karts:
// every crest, ramp and bouncer turns into a long, floaty jump.
// The landscape under the road is hidden: there is only the road, the stars and the planets.
import * as THREE from '../../vendor/three.module.min.js';

const NAVY = 0x0b0b2a, INK = 0x05051a, CYAN = 0x4ff3ff, MAG = 0xff4fd8, VIO = 0x9a6bff, GOLD = 0xffd24a, MINT = 0x6dffb0;

// A ribbon that follows the road: for every road sample, points at the given sideways offsets and heights.
function ribbon(tr, rows) {
  const pos = [], idx = [], n = tr.n, w = rows.length;
  for (let i = 0; i <= n; i++) {
    const k = i % n, x = tr.px[k], y = tr.py[k], z = tr.pz[k], rx = tr.rx[k], rz = tr.rz[k];
    for (const [lat, dy] of rows) pos.push(x + rx * lat, y + dy, z + rz * lat);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < w - 1; j++) {
      const a = i * w + j, b = a + 1, c = a + w, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function geoPlanet(KIT, rnd, cols, ring) {
  const { mergeColored, mat4 } = KIT;
  const sph = new THREE.IcosahedronGeometry(1, 4);
  const p = sph.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  const ph = rnd() * 6;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
    const band = Math.floor((y * 3.2 + Math.sin(x * 4 + ph) * 0.25 + Math.cos(z * 3 + ph) * 0.15 + 4) * 1.3);
    col.setHex(cols[((band % cols.length) + cols.length) % cols.length]);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  sph.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const parts = [{ geo: sph, color: null }];
  if (ring) {
    const r = new THREE.RingGeometry(1.35, 2.1, 48, 1); r.rotateX(-Math.PI / 2);
    parts.push({ geo: r, color: ring, matrix: mat4(0, 0, 0, 0.35, 0, 0.2) });
  }
  return mergeColored(parts);
}

function geoStation(KIT) {
  const { mergeColored, mat4 } = KIT;
  const parts = [
    { geo: new THREE.CylinderGeometry(3, 3, 16, 16), color: 0xdfe6ff, matrix: mat4(0, 0, 0) },
    { geo: new THREE.SphereGeometry(4.2, 16, 10), color: 0xffffff, matrix: mat4(0, 9, 0) },
    { geo: new THREE.TorusGeometry(18, 1.6, 8, 40), color: 0xc9d2f0, matrix: mat4(0, 0, 0, Math.PI / 2, 0, 0) },
    { geo: new THREE.TorusGeometry(18, 0.5, 6, 40), color: CYAN, matrix: mat4(0, 1.7, 0, Math.PI / 2, 0, 0) },
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push({ geo: new THREE.CylinderGeometry(0.5, 0.5, 15, 6), color: 0xaab4d8, matrix: mat4(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5, 0, -a, Math.PI / 2) });
  }
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(14, 0.3, 5), color: 0x3a4fd8, matrix: mat4(0, -6 * s - 1, 0, 0, s * 0.6, 0) });
    parts.push({ geo: new THREE.BoxGeometry(14.4, 0.2, 0.3), color: GOLD, matrix: mat4(0, -6 * s - 0.8, 0, 0, s * 0.6, 0) });
  }
  return mergeColored(parts);
}

function geoCrystal(KIT, col) {
  const { mergeColored, mat4 } = KIT;
  return mergeColored([
    { geo: new THREE.OctahedronGeometry(1, 0), color: col, matrix: mat4(0, 0, 0, 0, 0, 0, 0.8, 2.2, 0.8) },
    { geo: new THREE.OctahedronGeometry(0.5, 0), color: 0xffffff, matrix: mat4(0.9, -0.6, 0.2, 0.3, 0, 0.4, 0.6, 1.3, 0.6) },
    { geo: new THREE.OctahedronGeometry(0.45, 0), color: col, matrix: mat4(-0.8, -0.8, -0.3, -0.3, 0, -0.5, 0.6, 1.2, 0.6) },
  ]);
}

export default {
  id: 'space',

  // Anti-gravity: much less gravity than the other worlds (30), and karts hover over the road.
  gravity: 11,
  hover: 0.45,

  track: {
    seed: 404,
    scale: 0.85,
    width: 22,
    limitPad: 2.5, // the road floats in space: only a narrow edge beside it
    points: [
      [0, 200, 6], [110, 205, 10], [220, 170, 22], [290, 90, 30], [300, -10, 18],
      [250, -90, 8], [160, -120, 20], [70, -80, 34], [0, -20, 24], [-70, -70, 12],
      [-160, -150, 4], [-260, -120, 14], [-300, -20, 28], [-260, 80, 16], [-180, 150, 6], [-90, 190, 4],
    ],
    itemRows: [0.12, 0.36, 0.6, 0.84],
    boostPads: [[0.22, 0], [0.47, -4], [0.72, 4], [0.95, 0]],
    obstacles: [
      { kind: 'bouncer', at: 0.16, lat: -4, size: 2.4, skin: 'gravpad' },
      { kind: 'roller', at: 0.29, count: 2, size: 1.6, period: 4.5, skin: 'meteor' },
      { kind: 'ramp', at: 0.41, lat: 3, size: 7 },
      { kind: 'cones', at: 0.53, lat: -3, count: 6, skin: 'buoy' },
      { kind: 'bouncer', at: 0.65, lat: 4, size: 2.4, skin: 'gravpad' },
      { kind: 'crosser', at: 0.78, count: 4, speed: 2.2, skin: 'alien' },
      { kind: 'ramp', at: 0.89, lat: -2, size: 7 },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise } = kit;
    const N = makeNoise(seed);
    const deep = new T.Color(INK);
    return {
      sky: { top: 0x02020c, mid: 0x0d0b33, bottom: 0x2a1160, sunColor: 0xfff0d0, sunDir: [0.3, 0.55, -0.6], stars: 1.4, aurora: 0.35 },
      fog: { color: 0x120d36, near: 260, far: 1500 },
      light: { sun: 0xfff3e0, sunI: 2.4, sky: 0x9fa8ff, ground: 0x3a2a7a, hemiI: 1.6 },
      water: null,
      road: { tint: 0x3a3f7a, line: '#4ff3ff', curbA: '#ff4fd8', curbB: '#ffffff', shoulder: 0x26206a },
      clouds: { color: 0xffffff, count: 0, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xcfe8ff, cfg: { n: 220, box: 70, size: 0.22, vel: [0.15, 0.1, 0.15], op: 0.8 } },
      detail: { strokes: 0, kind: 'custom', draw() {} },
      blendNear: 9, blendFar: 40,
      // The landscape is a deep void far below; it is hidden after the world is built (onBuilt).
      height(x, z) { return -240 + N.fbm(x * 0.004, z * 0.004, 2) * 30; },
      color(x, z, h, slope, d, out) { return out.copy(deep); },
      onBuilt(world) { world.terrainMesh.visible = false; },
    };
  },

  scenery(w, kit) {
    const { THREE: T, instanced, alongTrack, mat4, mergeColored, geoRock, TAU, lerp } = kit;
    const rnd = w.rnd, tr = w.track, b = tr.bounds, hw = tr.halfWidth + tr.curb;

    // Under the road: a dark hull with glowing rails along both edges.
    const hull = new T.Mesh(ribbon(tr, [[-hw - 2.6, -0.5], [-hw - 1.2, -2.4], [hw + 1.2, -2.4], [hw + 2.6, -0.5]]), new T.MeshLambertMaterial({ color: 0x1c1850, side: T.DoubleSide }));
    w.scene.add(hull);
    const glow = (col) => new T.MeshBasicMaterial({ color: col, side: T.DoubleSide });
    for (const [side, col] of [[-1, CYAN], [1, MAG]]) {
      const lat = side * (hw + 2.6);
      w.scene.add(new T.Mesh(ribbon(tr, [[lat, -0.75], [lat, 0.05]]), glow(col)));
      w.scene.add(new T.Mesh(ribbon(tr, [[side * (hw + 1.25), -2.5], [side * (hw + 1.25), -1.9]]), glow(VIO)));
    }

    // A sky full of stars all around (also below the road).
    {
      const n = 1600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new T.Color();
      const pal = [0xffffff, 0xcfe8ff, 0xffe9c4, 0xffc4f0, 0xb8f6ff];
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - u * u), r = 1700;
        pos[i * 3] = b.cx + Math.cos(a) * s * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = b.cz + Math.sin(a) * s * r;
        c.setHex(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.5 + rnd() * 0.5);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const pts = new T.Points(g, new T.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
      pts.frustumCulled = false; pts.renderOrder = -5;
      w.scene.add(pts);
    }

    // Planets far away, one with a ring.
    const PL = [
      { cols: [0xff9a5a, 0xffc87a, 0xe86a4a, 0xffd9a0], ring: 0xf3d6ff, x: 0.9, y: 260, r: 150, d: 1250 },
      { cols: [0x5ad0ff, 0x3a8aff, 0x9ff0ff], ring: null, x: 3.1, y: 120, r: 80, d: 1150 },
      { cols: [0xd07aff, 0xff7ad8, 0x8a5aff], ring: 0x7ff3ff, x: 4.6, y: -90, r: 110, d: 1300 },
      { cols: [0xd9d9e6, 0xb8b8cc, 0xefeff8], ring: null, x: 2.2, y: 420, r: 45, d: 1000 },
    ];
    for (const p of PL) {
      const m = new T.Mesh(geoPlanet(kit, rnd, p.cols, p.ring), w.mats.sceneryNoFog);
      m.position.set(b.cx + Math.cos(p.x) * p.d, p.y, b.cz + Math.sin(p.x) * p.d);
      m.scale.setScalar(p.r);
      m.castShadow = false;
      w.scene.add(m);
      w.updaters.push((dt) => { m.rotation.y += dt * 0.02; });
    }

    // Asteroids drifting around and below the road.
    const rocks = [];
    for (let t = 0; t < 900 && rocks.length < 150; t++) {
      const a = rnd() * TAU, r = 60 + Math.sqrt(rnd()) * 520;
      const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r, y = lerp(-140, 110, rnd());
      const info = {}; tr.distInfo(x, z, info);
      if (info.d < 30 && Math.abs(y - info.y) < 40) continue;
      rocks.push({ x, y, z, ry: rnd() * TAU, rx: rnd() * TAU, s: 1.5 + rnd() * rnd() * 9 });
    }
    const rockMesh = instanced(w, geoRock(rnd, [0x6a6488, 0x857fa8, 0x4f4a70]), w.mats.scenery, rocks, 0);
    if (rockMesh) rockMesh.castShadow = false;

    // Glowing gates the road flies through.
    const gates = [0.08, 0.3, 0.52, 0.7, 0.9].map((f, i) => {
      const k = Math.floor(f * tr.n);
      return { x: tr.px[k], y: tr.py[k] + 4, z: tr.pz[k], ry: tr.heading[k], s: 1, color: new T.Color([CYAN, MAG, VIO, MINT, GOLD][i]) };
    });
    const gateGeo = mergeColored([
      { geo: new T.TorusGeometry(17, 0.9, 8, 48), color: 0xffffff },
      { geo: new T.TorusGeometry(17, 0.35, 6, 48), color: 0xffffff, matrix: mat4(0, 0, 1.2) },
      { geo: new T.TorusGeometry(17, 0.35, 6, 48), color: 0xffffff, matrix: mat4(0, 0, -1.2) },
    ]);
    const gm = instanced(w, gateGeo, new T.MeshBasicMaterial({ vertexColors: true }), gates, 0);
    if (gm) gm.castShadow = false;

    // Crystals floating beside the road, bobbing.
    [CYAN, MAG, VIO, MINT].forEach((col, ci) => {
      const list = alongTrack(w, { count: 14, d0: 7, d1: 34 }).map((p) => {
        const k = Math.floor(p.trackS) % tr.n;
        return { x: p.x, y: tr.py[k] + lerp(-14, 12, rnd()), z: p.z, ry: rnd() * TAU, rz: (rnd() - 0.5) * 0.6, s: 1.2 + rnd() * 1.8 };
      });
      const m = instanced(w, geoCrystal(kit, col), new T.MeshLambertMaterial({ vertexColors: true, emissive: col, emissiveIntensity: 0.55 }), list, 0);
      if (!m) return;
      m.castShadow = false;
      const y0 = m.position.y, ph = ci * 1.7;
      w.updaters.push((dt, t) => { m.position.y = y0 + Math.sin(t * 0.8 + ph) * 1.2; });
    });

    // A space station turning slowly over the middle of the course.
    const st = new T.Mesh(geoStation(kit), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x222244 }));
    st.position.set(b.cx + 10, 95, b.cz - 20); st.scale.setScalar(2.2); st.rotation.z = 0.25;
    st.castShadow = false;
    w.scene.add(st);
    w.updaters.push((dt) => { st.rotation.y += dt * 0.06; });

    // A little flying saucer that circles the course.
    const ufo = new T.Mesh(mergeColored([
      { geo: new T.SphereGeometry(4, 18, 6).scale(1, 0.28, 1), color: 0xc9d2f0 },
      { geo: new T.SphereGeometry(1.8, 14, 8, 0, TAU, 0, Math.PI / 2), color: 0x9ff0ff, matrix: mat4(0, 0.6, 0) },
      { geo: new T.TorusGeometry(3.9, 0.25, 6, 30), color: MAG, matrix: mat4(0, 0, 0, Math.PI / 2, 0, 0) },
    ]), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x333355 }));
    ufo.scale.setScalar(1.6);
    w.scene.add(ufo);
    w.updaters.push((dt, t) => {
      const a = t * 0.07;
      ufo.position.set(b.cx + Math.cos(a) * 340, 70 + Math.sin(t * 0.5) * 8, b.cz + Math.sin(a) * 260);
      ufo.rotation.y = t * 1.5; ufo.rotation.z = Math.sin(t * 0.9) * 0.15;
    });
  },

  song: {
    bpm: 118, style: 'space', lead: 'bell',
    chords: 'Am F C G Am F G E',
    melody: [
      'e5/4 a5/4 c6/4 b5/4', 'a5/6 f5/2 c6/8', 'g5/4 e5/4 g5/4 c6/4', 'b5/8 d6/4 b5/4',
      'c6/4 e6/4 d6/4 c6/4', 'a5/6 c6/2 f6/8', 'e6/4 d6/4 b5/4 g5/4', 'g#5/8 b5/4 e6/4',
    ],
  },
  style: { kick: [0, 8], snare: [12], rim: [4], hat: [2, 6, 10, 14], hatVol: 0.32, bass: [[0, 0], [3, 0], [6, 12], [8, 0], [11, 7], [14, 12]], bassLen: 2, comp: 'arp', level: 0.95 },

  chip: 'radial-gradient(circle at 72% 30%,#ffb46a 0 13%,transparent 14%),radial-gradient(circle at 25% 70%,#ff4fd8 0 6%,transparent 7%),linear-gradient(170deg,#02020c 0 40%,#2a1160 75%,#4ff3ff 100%)',

  strings: {
    en: { name: 'Zero-G Galaxy', sub: 'Float through space on a glowing road' },
    nl: { name: 'Gewichtloos Heelal', sub: 'Zweef door de ruimte over een lichtweg' },
  },

  skins: {
    meteor(kit) {
      const { THREE: T, jitter, mulberry32 } = kit;
      const g = new T.IcosahedronGeometry(1, 2);
      jitter(g, 0.14, mulberry32(7));
      const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new T.Color();
      for (let i = 0; i < p.count; i++) {
        const h = Math.sin(p.getX(i) * 7) * Math.cos(p.getZ(i) * 6) + p.getY(i) * 0.6;
        col.setHex(h > 0.6 ? 0xffb04a : h > 0 ? 0x8a6a5a : 0x5a4a4e);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      g.computeVertexNormals();
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x401a08 }));
    },
    gravpad(kit) {
      const { THREE: T, mergeColored, mat4 } = kit;
      return new T.Mesh(mergeColored([
        { geo: new T.CylinderGeometry(1, 1, 0.12, 28), color: 0x2a2a6a, matrix: mat4(0, 0.06, 0) },
        { geo: new T.TorusGeometry(0.85, 0.08, 6, 28), color: CYAN, matrix: mat4(0, 0.14, 0, Math.PI / 2, 0, 0) },
        { geo: new T.TorusGeometry(0.55, 0.07, 6, 24), color: MAG, matrix: mat4(0, 0.15, 0, Math.PI / 2, 0, 0) },
        { geo: new T.CylinderGeometry(0.25, 0.25, 0.1, 16), color: 0xffffff, matrix: mat4(0, 0.16, 0) },
      ]), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a3a80 }));
    },
    buoy(kit) {
      const { THREE: T, mergeColored, mat4 } = kit;
      return new T.Mesh(mergeColored([
        { geo: new T.ConeGeometry(0.3, 0.6, 8), color: 0xffffff, matrix: mat4(0, 0.3, 0) },
        { geo: new T.SphereGeometry(0.16, 10, 8), color: MAG, matrix: mat4(0, 0.7, 0) },
        { geo: new T.TorusGeometry(0.26, 0.05, 6, 16), color: CYAN, matrix: mat4(0, 0.25, 0, Math.PI / 2, 0, 0) },
      ]), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x333355 }));
    },
    alien(kit) {
      const { THREE: T, mergeColored, mat4 } = kit;
      const parts = [
        { geo: new T.SphereGeometry(0.42, 12, 10), color: MINT, matrix: mat4(0, 0.5, 0, 0, 0, 0, 1, 1.15, 1) },
        { geo: new T.SphereGeometry(0.15, 10, 8), color: 0xffffff, matrix: mat4(0, 0.62, 0.36) },
        { geo: new T.SphereGeometry(0.07, 8, 6), color: NAVY, matrix: mat4(0, 0.63, 0.49) },
      ];
      for (const s of [-1, 1]) {
        parts.push({ geo: new T.CylinderGeometry(0.03, 0.03, 0.35, 5), color: MINT, matrix: mat4(s * 0.16, 1.0, 0, 0, 0, s * 0.35) });
        parts.push({ geo: new T.SphereGeometry(0.08, 8, 6), color: MAG, matrix: mat4(s * 0.24, 1.17, 0) });
        parts.push({ geo: new T.SphereGeometry(0.12, 8, 6), color: 0x3fd090, matrix: mat4(s * 0.2, 0.08, 0.05) });
      }
      return new T.Mesh(mergeColored(parts), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a4a30 }));
    },
  },
};
