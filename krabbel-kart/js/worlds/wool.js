// Yarn Valley: a world made of tufted wool. Bright pinks, oranges, sky blue, navy and grass greens,
// rainbow-striped hills, pom-pom trees, a doll's house street, cotton-ball clouds and sailboats with
// patchwork sails. Every surface gets a fuzzy "yarn" speckle from a small shader patch (yarnify).
import * as THREE from '../../vendor/three.module.min.js';

const NAVY = 0x22348c, SKY = 0x6fb6e8, PINK = 0xf4a3b8, ROSE = 0xe9799a, CORAL = 0xe8553e, ORANGE = 0xf08a2a,
  YELLOW = 0xf6c945, GREEN = 0x5fa64a, OLIVE = 0x9cc24e, CREAM = 0xf7ecdc, TEAL = 0x3fb3b0, LILAC = 0xc6a8e6, WHITE = 0xfffaf2;
const STRIPES = [PINK, SKY, ORANGE, CREAM, OLIVE, ROSE, YELLOW, NAVY, TEAL, CORAL];

// Adds a fuzzy tufted-yarn speckle to any lit material, in world space (works for instanced meshes too).
function yarnify(mat, scale = 7) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vYarn;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vYarn = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vYarn = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vYarn;\nfloat yarnHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 q = vYarn * ${scale.toFixed(1)};
          float a = yarnHash(floor(q));
          float b = yarnHash(floor(q * 2.37) + 7.0);
          float loops = sin(q.x * 3.1 + q.y * 2.7) * sin(q.z * 3.1 - q.y * 2.3);
          diffuseColor.rgb *= 0.8 + 0.15 * a + 0.1 * b + 0.06 * loops;
        }`);
  };
  mat.customProgramCacheKey = () => 'yarn' + scale;
  mat.needsUpdate = true;
  return mat;
}

const sph = (r, ws = 12, hs = 9) => new THREE.SphereGeometry(r, ws, hs);

// A bumpy pom-pom ball (smooth shading, consistent jitter).
function pom(KIT, rnd, r, bump = 0.12, detail = 2) {
  return KIT.jitter(new THREE.IcosahedronGeometry(r, detail), r * bump, rnd);
}

// Lollipop pom-pom tree on a striped stick.
function geoPomTree(KIT, rnd, top, stick) {
  const { mergeSmooth, mat4 } = KIT;
  const trunk = new THREE.CylinderGeometry(0.32, 0.42, 4, 8, 6);
  return mergeSmooth([
    { geo: trunk, color: stick, bottom: 0x8a5030, matrix: mat4(0, 2, 0), smooth: true },
    { geo: pom(KIT, rnd, 2.6), color: top, bottom: 0x1d2a5a, matrix: mat4(0, 5.6, 0), smooth: true },
  ]);
}

// Tall rounded cypress made of stacked pom-poms.
function geoCypress(KIT, rnd, col) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [{ geo: new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), color: 0x7a4a2a, matrix: mat4(0, 0.7, 0) }];
  [[2.0, 1.4], [3.6, 1.6], [5.3, 1.35], [6.8, 1.0], [7.9, 0.6]].forEach(([y, r]) => parts.push({ geo: pom(KIT, rnd, r, 0.1), color: col, bottom: 0x1d3a2a, matrix: mat4(0, y, 0, 0, 0, 0, 1, 1.15, 1), smooth: true }));
  return mergeSmooth(parts);
}

// The big tree with a rainbow-striped trunk and puffy green and blue crowns.
function geoRainbowTree(KIT, rnd) {
  const { mergeSmooth, mat4 } = KIT;
  const trunk = new THREE.CylinderGeometry(0.9, 1.5, 9, 16, 8);
  const cols = [ORANGE, CREAM, PINK, YELLOW, CREAM, CORAL];
  const P = trunk.attributes.position, c = new Float32Array(P.count * 3), col = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const a = Math.atan2(P.getZ(i), P.getX(i)) + P.getY(i) * 0.05;
    col.setHex(cols[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % cols.length]);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  trunk.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const parts = [{ geo: trunk, color: WHITE, matrix: mat4(0, 4.5, 0), smooth: true }];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.35, 0.55, 4.5, 8), color: ORANGE, matrix: mat4(s * 1.8, 9, 0, 0, 0, -s * 0.75), smooth: true });
    parts.push({ geo: pom(KIT, rnd, 2.4), color: s > 0 ? OLIVE : GREEN, bottom: 0x2a4a2a, matrix: mat4(s * 3.6, 11, 0, 0, 0, 0, 1.3, 0.85, 1.1), smooth: true });
  }
  parts.push({ geo: pom(KIT, rnd, 3.4), color: TEAL, bottom: NAVY, matrix: mat4(0, 12.6, 0, 0, 0, 0, 1.3, 0.8, 1.2), smooth: true });
  parts.push({ geo: pom(KIT, rnd, 2.0), color: SKY, bottom: NAVY, matrix: mat4(1.2, 14.6, 0.6), smooth: true });
  return mergeSmooth(parts);
}

// Doll's house: navy walls, pink ground floor, a roof covered in multicoloured scallops, a bay window.
function geoDollHouse(KIT, rnd, wall, base, roofCols) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [
    { geo: new THREE.BoxGeometry(7, 3.4, 6), color: base, matrix: mat4(0, 1.7, 0) },
    { geo: new THREE.BoxGeometry(6.4, 4.2, 5.6), color: wall, matrix: mat4(0, 5.5, 0) },
    { geo: new THREE.BoxGeometry(7.4, 0.35, 6.4), color: WHITE, matrix: mat4(0, 3.5, 0) },
  ];
  // Roof: two sloping planes along the ridge (x), triangle gables at both ends, scallops on the planes.
  const gable = new THREE.Shape([new THREE.Vector2(-2.8, 0), new THREE.Vector2(2.8, 0), new THREE.Vector2(0, 2.7)]);
  const gg = new THREE.ExtrudeGeometry(gable, { depth: 6.4, bevelEnabled: false });
  gg.translate(0, 0, -3.2); gg.rotateY(Math.PI / 2);
  parts.push({ geo: gg, color: wall, matrix: mat4(0, 7.6, 0) });
  for (const side of [-1, 1]) {
    const plane = mat4(0, 9.1, side * 1.63, side * 0.68, 0, 0);
    parts.push({ geo: new THREE.BoxGeometry(7.2, 0.3, 4.3), color: WHITE, matrix: plane });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      const d = new THREE.SphereGeometry(1, 8, 4);
      d.scale(0.68, 0.22, 0.58);
      d.translate((k - 2.5) * 1.15 + (r % 2 ? 0.55 : 0), 0.2, side * (1.75 - r * 1.05));
      parts.push({ geo: d, color: roofCols[(r * 6 + k + (side > 0 ? 0 : 3)) % roofCols.length], matrix: plane.clone() });
    }
  }
  // Windows, door, balcony.
  for (const x of [-1.8, 1.8]) parts.push({ geo: new THREE.BoxGeometry(1.3, 1.6, 0.2), color: 0xffe8b0, matrix: mat4(x, 5.6, 2.85) });
  parts.push({ geo: new THREE.BoxGeometry(3.6, 0.25, 1.2), color: WHITE, matrix: mat4(0, 4.0, 3.3) });
  for (let i = 0; i < 7; i++) parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.9, 4), color: WHITE, matrix: mat4(-1.7 + i * 0.57, 4.5, 3.85) });
  parts.push({ geo: new THREE.BoxGeometry(1.3, 2.2, 0.2), color: CORAL, matrix: mat4(1.5, 1.1, 3.05) });
  parts.push({ geo: new THREE.SphereGeometry(0.12, 6, 4), color: YELLOW, matrix: mat4(1.9, 1.1, 3.2) });
  parts.push({ geo: new THREE.BoxGeometry(2.2, 1.9, 1.0), color: base, matrix: mat4(-1.6, 1.6, 3.4) });
  parts.push({ geo: new THREE.BoxGeometry(1.8, 1.3, 0.2), color: 0xffe8b0, matrix: mat4(-1.6, 1.7, 3.95) });
  const bayRoof = new THREE.SphereGeometry(1.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); bayRoof.scale(1, 0.5, 0.6);
  parts.push({ geo: bayRoof, color: roofCols[1], matrix: mat4(-1.6, 2.55, 3.4) });
  void rnd;
  return mergeSmooth(parts);
}

// A sailboat with a patchwork sail.
function geoPatchBoat(KIT, cols) {
  const { mergeSmooth, mat4 } = KIT;
  const hull = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const parts = [
    { geo: hull, color: WHITE, bottom: SKY, matrix: mat4(0, 0.9, 0, 0, 0, 0, 1.4, 1.1, 3.8) },
    { geo: new THREE.CylinderGeometry(1.42, 1.42, 0.25, 14).scale(1, 1, 2.6), color: CORAL, matrix: mat4(0, 0.95, 0) },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 9, 6), color: 0xb07a4a, matrix: mat4(0, 5.2, 0) },
  ];
  // The sail: a triangle split into patches.
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y0 = 1.6 + r * 1.45, y1 = y0 + 1.45, w0 = 3.2 * (1 - r / rows), w1 = 3.2 * (1 - (r + 1) / rows);
    for (let k = 0; k < 2; k++) {
      const a0 = k / 2, a1 = (k + 1) / 2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        0, y0, 0.15 + w0 * a0, 0, y0, 0.15 + w0 * a1, 0, y1, 0.15 + w1 * a0,
        0, y0, 0.15 + w0 * a1, 0, y1, 0.15 + w1 * a1, 0, y1, 0.15 + w1 * a0,
      ], 3));
      g.computeVertexNormals();
      parts.push({ geo: g, color: cols[(r * 2 + k) % cols.length] });
    }
  }
  return mergeSmooth(parts);
}

// Cotton-ball cloud.
function geoCloud(KIT, rnd) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [];
  for (let k = 0; k < 6; k++) parts.push({ geo: pom(KIT, rnd, 1, 0.08, 1), color: WHITE, bottom: 0xdfe6f4, matrix: mat4((k - 2.5) * 1.1, Math.sin(k * 2.1) * 0.3, Math.cos(k * 1.7) * 0.35, 0, 0, 0, 1.15 - Math.abs(k - 2.5) * 0.14), smooth: true });
  return mergeSmooth(parts);
}

// A giant ball of yarn with two knitting needles stuck in it (a landmark next to the road).
function geoYarnBall(KIT, col) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [{ geo: sph(3, 18, 12), color: col, matrix: mat4(0, 2.7, 0), smooth: true }];
  for (let i = 0; i < 7; i++) parts.push({ geo: new THREE.TorusGeometry(3.02, 0.13, 6, 40), color: col, bottom: 0x000000, matrix: mat4(0, 2.7, 0, i * 0.45, i * 0.8, 0.3) });
  parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.16, 9, 6), color: 0xd9d2c4, matrix: mat4(0.8, 5.5, 0, 0.5, 0, 0.3) });
  parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.16, 9, 6), color: 0xd9d2c4, matrix: mat4(-0.6, 5.5, 0.3, -0.3, 0, -0.45) });
  parts.push({ geo: sph(0.4, 8, 6), color: CORAL, matrix: mat4(2.1, 9.3, 2.0) });
  parts.push({ geo: sph(0.4, 8, 6), color: TEAL, matrix: mat4(-2.6, 9.2, 1.2) });
  return mergeSmooth(parts);
}

// Little flower cushions.
function geoFlower(KIT, petal) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [{ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.9, 4), color: GREEN, matrix: mat4(0, 0.45, 0) }];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push({ geo: sph(0.28, 6, 4), color: petal, matrix: mat4(Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3, 0, 0, 0, 1, 0.5, 1) }); }
  parts.push({ geo: sph(0.2, 8, 6), color: YELLOW, matrix: mat4(0, 1.05, 0) });
  return mergeSmooth(parts);
}

export default {
  id: 'wool',

  track: {
    seed: 318,
    scale: 0.84,
    width: 21,
    points: [
      [0, 190, 2], [100, 196, 3], [200, 160, 6], [262, 80, 10], [240, -10, 12],
      [170, -60, 8], [90, -40, 5], [40, -110, 3], [-40, -170, 2], [-140, -170, 4],
      [-230, -110, 7], [-270, -10, 9], [-230, 80, 6], [-150, 120, 3], [-80, 170, 2],
    ],
    itemRows: [0.13, 0.38, 0.63, 0.87],
    boostPads: [[0.27, 0], [0.52, 0], [0.78, 0]],
    obstacles: [
      { kind: 'cones', at: 0.18, lat: 3, count: 6, skin: 'spool' },
      { kind: 'roller', at: 0.32, count: 2, size: 1.6, period: 4, skin: 'yarnball' },
      { kind: 'crosser', at: 0.45, count: 4, speed: 2.2, skin: 'sheep' },
      { kind: 'bouncer', at: 0.57, lat: -4, size: 2.2, skin: 'button' },
      { kind: 'ramp', at: 0.7, lat: 2, size: 6 },
      { kind: 'cones', at: 0.82, lat: -3, count: 5, skin: 'spool' },
      { kind: 'roller', at: 0.94, count: 1, size: 1.8, period: 3.6, skin: 'yarnball' },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise, mix3, smoothstep, lerp } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 33);
    const cx = bounds.cx, cz = bounds.cz;
    const stripe = STRIPES.map((c) => new T.Color(c)), verge = new T.Color(CREAM), lake = new T.Color(0x9fd6f4);
    const pond = (x, z) => smoothstep(0.15, 0.45, N2.fbm(x * 0.004 + 3, z * 0.004 - 5, 2)) * smoothstep(320, 400, Math.hypot(x - cx, z - cz));
    return {
      sky: { top: 0x3f8fdc, mid: 0x8fcaf0, bottom: 0xeaf5ff, sunColor: 0xfff1d0, sunDir: [0.4, 0.6, 0.35], stars: 0, aurora: 0 },
      fog: { color: 0xd8ecfb, near: 160, far: 950 },
      light: { sun: 0xfff4e0, sunI: 2.0, sky: 0xdfefff, ground: 0xf6dcc8, hemiI: 2.0 },
      water: { level: -2.5, shallow: 0x8fd0f4, deep: 0x3a7ad0, foam: 0xffffff, ice: 0 },
      road: { tint: 0xd8c6ae, line: '#f4a3b8', curbA: '#f08a2a', curbB: '#fffaf2', shoulder: 0xf3c9b4 },
      clouds: { color: 0xffffff, count: 0, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xffffff, cfg: { n: 160, box: 70, size: 0.26, vel: [0.4, 0.25, 0.3], op: 0.6 } },
      detail: {
        strokes: 0, kind: 'custom',
        // Rows of little yarn loops, like the back of a tufted rug.
        draw(g, S, rnd) {
          g.lineWidth = 1.6;
          for (let y = 3; y < S; y += 6) {
            for (let x = (y / 6) % 2 ? 3 : 0; x < S; x += 6) {
              g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(60,40,60,0.16)';
              g.beginPath(); g.arc(x, y, 2.3 + rnd() * 0.6, 0, Math.PI * 2); g.stroke();
            }
          }
        },
      },
      blendNear: 8, blendFar: 70,
      onBuilt(world) {
        const m = world.terrainMesh.material;
        m.flatShading = false;
        yarnify(m, 5);
        // Road, curbs and verges get the woolly speckle too (everything lit that is not patched yet).
        world.scene.traverse((o) => {
          const mt = o.material;
          if (o.isMesh && mt && !Array.isArray(mt) && mt.isMeshLambertMaterial && !mt.onBeforeCompile.toString().includes('yarn') && mt !== m) yarnify(mt, 8);
        });
      },
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz);
        let h = 5 + N.fbm(x * 0.006, z * 0.006, 3) * 18 + N2.fbm(x * 0.018, z * 0.018, 2) * 2.5;
        const m = smoothstep(320, 640, r);
        h += m * m * 120 + m * N2.fbm(x * 0.01, z * 0.01, 2) * 26;
        return lerp(h, -6, pond(x, z));
      },
      // Wavy rainbow bands over the hills, a cream verge along the road, pale blue near the lake.
      color(x, z, h, slope, d, out) {
        const warp = N.fbm(x * 0.006 + 11, z * 0.006, 2) * 2.4;
        const t = (x * 0.004 + z * 0.011 + warp + h * 0.03) * 2.2;
        const i = Math.floor(t), f = t - i;
        const a = stripe[((i % stripe.length) + stripe.length) % stripe.length];
        const b = stripe[(((i + 1) % stripe.length) + stripe.length) % stripe.length];
        mix3(out, a, b, smoothstep(0.82, 1, f));
        if (d < 16) mix3(out, out, verge, smoothstep(16, 6, d) * 0.85);
        if (h < 0.5) mix3(out, out, lake, smoothstep(0.5, -2.5, h));
        return out;
      },
    };
  },

  scenery(w, kit) {
    const { THREE: T, instanced, scatter, alongTrack, mat4, TAU } = kit;
    const rnd = w.rnd, tr = w.track, b = tr.bounds;
    const M = yarnify(new T.MeshLambertMaterial({ vertexColors: true }), 9);
    const MD = yarnify(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }), 9);
    const MN = yarnify(new T.MeshLambertMaterial({ vertexColors: true, fog: false, emissive: 0x333333 }), 3);
    const noShadow = (m) => { if (m) m.castShadow = false; return m; };
    const faceRoad = (list) => {
      const info = {};
      for (const it of list) { tr.distInfo(it.x, it.z, info); it.ry = Math.atan2(tr.px[info.i] - it.x, tr.pz[info.i] - it.z); }
      return list;
    };

    // Pom-pom trees in many colours.
    const tops = [[GREEN, ORANGE], [NAVY, PINK], [ORANGE, CREAM], [ROSE, SKY]];
    tops.forEach(([top, stick]) => noShadow(instanced(w, geoPomTree(kit, rnd, top, stick), M, scatter(w, { count: 42, minH: 0, maxSlope: 0.5, s0: 0.8, s1: 1.5, radius: 460 }), 3)));
    [GREEN, NAVY, ORANGE].forEach((top, i) => instanced(w, geoPomTree(kit, rnd, top, [PINK, CREAM, SKY][i]), M, alongTrack(w, { count: 14, d0: 5, d1: 18, s0: 0.9, s1: 1.3, minH: 0 }), 3));
    [0x2f6a3a, GREEN].forEach((c) => noShadow(instanced(w, geoCypress(kit, rnd, c), M, scatter(w, { count: 40, minH: 0, maxSlope: 0.5, s0: 0.8, s1: 1.4, radius: 420 }), 1.5)));
    instanced(w, geoRainbowTree(kit, rnd), M, alongTrack(w, { count: 6, even: true, phase: 0.15, d0: 12, d1: 22, minH: 0, s0: 1.1, s1: 1.4 }), 5);

    // A doll's house street on the side of the road.
    const roofA = [CORAL, PINK, YELLOW, SKY, CREAM, ORANGE, TEAL], roofB = [ROSE, SKY, OLIVE, YELLOW, LILAC, CORAL];
    [[NAVY, PINK, roofA], [TEAL, CREAM, roofB], [ROSE, YELLOW, roofA], [SKY, CORAL, roofB]].forEach(([wall, base, roof], v) =>
      instanced(w, geoDollHouse(kit, rnd, wall, base, roof), M, faceRoad(alongTrack(w, { count: 5, even: true, phase: 0.05 + v * 0.22, d0: 15, d1: 30, minH: 0, s0: 1.1, s1: 1.4, sink: 0.3 })), 4.5));

    // Giant yarn balls with needles.
    [CORAL, SKY, OLIVE].forEach((c, i) => instanced(w, geoYarnBall(kit, c), M, alongTrack(w, { count: 2, even: true, phase: 0.3 + i * 0.13, d0: 12, d1: 20, minH: 0, s0: 1.3, s1: 1.6, sink: 0.4 }), 3.2));

    // Flowers everywhere.
    [PINK, YELLOW, WHITE].forEach((c) => noShadow(instanced(w, geoFlower(kit, c), M, scatter(w, { count: 55, minH: 0, maxD: 90, maxSlope: 0.5, s0: 0.9, s1: 1.8, minD: tr.limit + 1 }))));

    // Cotton-ball clouds, some low over the hills, drifting slowly.
    const clouds = [];
    for (let i = 0; i < 30; i++) {
      const a = rnd() * TAU, r = 260 + rnd() * 700, low = i < 12;
      clouds.push({ x: Math.cos(a) * r, y: low ? 45 + rnd() * 30 : 110 + rnd() * 90, z: Math.sin(a) * r, ry: rnd() * TAU, s: low ? 7 + rnd() * 6 : 10 + rnd() * 12 });
    }
    const cm = noShadow(instanced(w, geoCloud(kit, rnd), MN, clouds));
    cm.position.set(b.cx, 0, b.cz);
    w.updaters.push((dt) => { cm.rotation.y += dt * 0.004; });

    // A woolly orange sun.
    const sun = new T.Mesh(pom(kit, rnd, 1, 0.04), yarnify(new T.MeshBasicMaterial({ color: ORANGE, fog: false }), 0.08));
    sun.position.set(b.cx + 700, 260, b.cz - 600); sun.scale.setScalar(60);
    w.scene.add(sun);

    // Sailboats with patchwork sails on the lakes.
    const sails = [[CORAL, SKY, YELLOW, PINK, NAVY, CREAM], [PINK, ORANGE, CREAM, TEAL, ROSE, YELLOW], [SKY, CREAM, CORAL, OLIVE, PINK, NAVY]];
    let made = 0;
    for (let t = 0; t < 400 && made < 7; t++) {
      const a = rnd() * TAU, r = 300 + rnd() * 300;
      const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
      if (w.heightAt(x, z) > -4) continue;
      const m = new T.Mesh(geoPatchBoat(kit, sails[made % 3]), MD);
      m.position.set(x, -2.5, z); m.rotation.y = rnd() * TAU; m.scale.setScalar(2 + rnd() * 1.2);
      const ph = rnd() * 10;
      w.scene.add(m);
      w.updaters.push((dt, tt) => { m.position.y = -2.5 + Math.sin(tt * 0.9 + ph) * 0.2; m.rotation.z = Math.sin(tt * 0.7 + ph) * 0.06; });
      made++;
    }

    // Pom-pom bunting over the road at a few spots.
    const posts = [0.1, 0.42, 0.74].map((f) => { const k = Math.floor(f * tr.n); return { k }; });
    const bunting = [];
    const cols = [CORAL, YELLOW, SKY, PINK, OLIVE, ORANGE, TEAL];
    for (const { k } of posts) {
      const hw = tr.halfWidth + 3, x = tr.px[k], y = tr.py[k], z = tr.pz[k], rx = tr.rx[k], rz = tr.rz[k];
      for (const s of [-1, 1]) bunting.push({ geo: new T.CylinderGeometry(0.25, 0.3, 9, 8), color: CREAM, matrix: mat4(x + rx * hw * s, y + 4.5, z + rz * hw * s) });
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, l = (u * 2 - 1) * hw, sag = 8.6 - Math.sin(u * Math.PI) * 1.6;
        bunting.push({ geo: new T.IcosahedronGeometry(0.55, 1), color: cols[i % cols.length], matrix: mat4(x + rx * l, y + sag, z + rz * l) });
      }
    }
    const bm = new T.Mesh(kit.mergeColored(bunting), M);
    w.scene.add(bm);
  },

  song: {
    bpm: 112, style: 'wool', lead: 'pan',
    chords: 'C G Am F C F G C',
    melody: [
      'e5/4 g5/2 e5/2 c5/4 g5/4', 'd5/4 g5/4 b5/8', 'c6/4 b5/2 a5/2 e5/8', 'f5/4 a5/4 c6/4 a5/4',
      'g5/4 e5/2 g5/2 c6/4 e6/4', 'd6/4 c6/4 a5/8', 'b5/4 d6/4 g5/4 b5/4', 'c6/12 -/4',
    ],
  },
  style: { kick: [0, 8, 11], snare: [], rim: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.3, shaker: true, bass: [[0, 0], [4, 7], [8, 12], [12, 7]], bassLen: 3, comp: 'offbeat', level: 0.95 },

  chip: 'repeating-linear-gradient(170deg,#f4a3b8 0 12px,#f7ecdc 12px 22px,#6fb6e8 22px 34px,#f08a2a 34px 46px,#9cc24e 46px 58px)',

  strings: {
    en: { name: 'Yarn Valley', sub: 'Woolly hills, pom-pom trees and doll houses' },
    nl: { name: 'Wolletjesdal', sub: 'Wollen heuvels, pompombomen en poppenhuizen' },
  },

  skins: {
    yarnball(kit) {
      const { THREE: T, mergeSmooth, mat4 } = kit;
      const parts = [{ geo: new T.SphereGeometry(1, 16, 12), color: ROSE, smooth: true }];
      for (let i = 0; i < 6; i++) parts.push({ geo: new T.TorusGeometry(1.0, 0.06, 5, 30), color: PINK, matrix: mat4(0, 0, 0, i * 0.5, i * 0.9, 0.2) });
      return new T.Mesh(mergeSmooth(parts), yarnify(new T.MeshLambertMaterial({ vertexColors: true }), 12));
    },
    spool(kit) {
      const { THREE: T, mergeSmooth, mat4 } = kit;
      const c = [CORAL, SKY, YELLOW, OLIVE][Math.floor(Math.random() * 4)];
      return new T.Mesh(mergeSmooth([
        { geo: new T.CylinderGeometry(0.32, 0.32, 0.08, 14), color: 0xd9a86a, matrix: mat4(0, 0.04, 0) },
        { geo: new T.CylinderGeometry(0.24, 0.24, 0.6, 14), color: c, matrix: mat4(0, 0.38, 0) },
        { geo: new T.CylinderGeometry(0.32, 0.32, 0.08, 14), color: 0xd9a86a, matrix: mat4(0, 0.72, 0) },
      ]), yarnify(new T.MeshLambertMaterial({ vertexColors: true }), 14));
    },
    sheep(kit) {
      const { THREE: T, mergeSmooth, mat4, jitter, mulberry32 } = kit;
      const body = jitter(new T.IcosahedronGeometry(0.42, 2), 0.06, mulberry32(3));
      const parts = [
        { geo: body, color: WHITE, bottom: 0xd8d0c4, matrix: mat4(0, 0.6, 0, 0, 0, 0, 1, 0.85, 1.25), smooth: true },
        { geo: new T.SphereGeometry(0.2, 10, 8), color: 0x3a3040, matrix: mat4(0, 0.78, 0.5, 0, 0, 0, 1, 1.1, 1.2) },
        { geo: new T.SphereGeometry(0.05, 6, 5), color: WHITE, matrix: mat4(0.08, 0.84, 0.7) },
        { geo: new T.SphereGeometry(0.05, 6, 5), color: WHITE, matrix: mat4(-0.08, 0.84, 0.7) },
      ];
      for (const [x, z] of [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0.25], [0.2, 0.25]]) parts.push({ geo: new T.CylinderGeometry(0.06, 0.06, 0.35, 5), color: 0x3a3040, matrix: mat4(x, 0.18, z) });
      return new T.Mesh(mergeSmooth(parts), yarnify(new T.MeshLambertMaterial({ vertexColors: true }), 16));
    },
    button(kit) {
      const { THREE: T, mergeSmooth, mat4 } = kit;
      const parts = [
        { geo: new T.CylinderGeometry(1, 1, 0.18, 28), color: CORAL, matrix: mat4(0, 0.09, 0) },
        { geo: new T.TorusGeometry(0.82, 0.07, 6, 28), color: 0xffb4a0, matrix: mat4(0, 0.19, 0, Math.PI / 2, 0, 0) },
      ];
      for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) parts.push({ geo: new T.CylinderGeometry(0.1, 0.1, 0.06, 10), color: 0x7a2a20, matrix: mat4(x, 0.2, z) });
      return new T.Mesh(mergeSmooth(parts), new T.MeshLambertMaterial({ vertexColors: true }));
    },
  },
};
