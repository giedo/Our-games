// Marshmallow Dunes: soft matte clay. Only powder blue, blush pink, cream and peach.
import * as THREE from '../../vendor/three.module.min.js';

const CREAM = 0xfff0dc, CREAM2 = 0xf8e2cc, PEACH = 0xf4cdb0, BLUSH = 0xf3c3cf, BLUSH2 = 0xe9a8bc, BLUE = 0xa5c0ee, BLUE2 = 0x86a6e2, BLUE3 = 0x6f92d8;

const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
const sph = (r, ws = 10, hs = 7) => new THREE.SphereGeometry(r, ws, hs);

// A soft-edged box: subdivided cube pulled onto a rounded shape (use with smooth: true).
function rbox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4), P = g.attributes.position;
  const half = [w / 2, h / 2, d / 2], v = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    v[0] = P.getX(i); v[1] = P.getY(i); v[2] = P.getZ(i);
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) {
      const a = Math.abs(v[k]) / half[k], m = a < 0.01 ? 0 : a < 0.75 ? half[k] - r : half[k];
      v[k] = Math.sign(v[k]) * m;
    }
    const q = v.map((c, k) => Math.max(-(half[k] - r), Math.min(half[k] - r, c)));
    nx = v[0] - q[0]; ny = v[1] - q[1]; nz = v[2] - q[2];
    const l = Math.hypot(nx, ny, nz);
    if (l > 0) P.setXYZ(i, q[0] + (nx / l) * r, q[1] + (ny / l) * r, q[2] + (nz / l) * r); else P.setXYZ(i, v[0], v[1], v[2]);
  }
  return g;
}

// A round-edged disc standing on y = 0.
function disc(R, H, r, seg = 22) {
  const pts = [[0, 0]];
  for (let a = -90; a <= 0; a += 30) pts.push([R - r + r * Math.cos((a * Math.PI) / 180), r + r * Math.sin((a * Math.PI) / 180)]);
  for (let a = 30; a <= 90; a += 30) pts.push([R - r + r * Math.cos((a * Math.PI) / 180), H - r + r * Math.sin((a * Math.PI) / 180)]);
  pts.push([0, H]);
  return new THREE.LatheGeometry(V2(pts), seg);
}

// An arch band (door shape with a round top), extruded and bevelled so the edges are soft.
function archRing(R, t, H, depth, bev) {
  const s = new THREE.Shape();
  s.moveTo(-R - t, 0); s.lineTo(-R - t, H); s.absarc(0, H, R + t, Math.PI, 0, true); s.lineTo(R + t, 0); s.lineTo(R, 0); s.lineTo(R, H);
  s.absarc(0, H, R, 0, Math.PI, false); s.lineTo(-R, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function archDoor(w, h, depth) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(-w, h); s.absarc(0, h, w, Math.PI, 0, true); s.lineTo(w, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
}

function geoArchStack(KIT, R) {
  const { mergeSmooth } = KIT;
  const bands = [[R, 2.4, 6, BLUSH], [R + 2.4, 2.4, 7.5, CREAM], [R + 4.8, 2.6, 9, BLUE]];
  return mergeSmooth(bands.map(([r, t, dp, c]) => ({ geo: archRing(r, t, 5, dp, 0.6), color: c, matrix: new THREE.Matrix4().makeTranslation(0, -3, 0), smooth: true })));
}

function geoPom(KIT, rnd, cols, tall) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [{ geo: new THREE.CylinderGeometry(0.28, 0.45, 3.2, 8), color: PEACH, matrix: mat4(0, 1.6, 0) }];
  const blobs = tall ? [[0, 3.4, 0, 2.2], [0, 5.4, 0, 1.8], [0, 7.2, 0, 1.4], [0, 8.6, 0, 0.9]]
    : [[0, 5.0, 0, 2.5], [1.6, 4.0, 0.5, 1.6], [-1.5, 4.2, -0.6, 1.7], [0.3, 6.9, -0.2, 1.6], [0.9, 5.6, 1.5, 1.2]];
  blobs.forEach((b, i) => parts.push({ geo: sph(b[3], 8, 6), color: cols[i % cols.length], bottom: BLUE3, matrix: mat4(b[0], b[1], b[2]) }));
  return mergeSmooth(parts);
}

function geoPuff(KIT) {
  const { mergeSmooth, mat4 } = KIT;
  const b = [[0, 1, 0, 1.6], [1.7, 0.8, 0.4, 1.2], [-1.6, 0.8, -0.2, 1.3], [0.4, 0.8, 1.5, 1.1], [-0.5, 0.7, -1.5, 1.1], [0.2, 2.0, 0.1, 1.0]];
  return mergeSmooth(b.map((p, i) => ({ geo: sph(p[3], 8, 5), color: i % 2 ? 0xf8d3dc : 0xfadde4, bottom: BLUSH2, matrix: mat4(p[0], p[1], p[2]) })));
}

function geoMushroom(KIT, cap) {
  const { mergeSmooth, mat4 } = KIT;
  const stem = new THREE.LatheGeometry(V2([[0, 0], [0.5, 0], [0.34, 0.9], [0.4, 1.6], [0, 1.6]]), 8);
  const top = sph(1.5, 10, 6); top.scale(1, 0.5, 1);
  return mergeSmooth([{ geo: stem, color: CREAM, bottom: PEACH }, { geo: top, color: cap, bottom: BLUSH2, matrix: mat4(0, 1.7, 0) }]);
}

function geoStack(KIT, rnd) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [{ geo: disc(6.2, 2.4, 0.6), color: BLUE, bottom: BLUE2, matrix: mat4(0, -1.4, 0) }];
  const cols = [BLUE2, CREAM, BLUSH, PEACH];
  let y = 1, R = 5.4;
  for (let k = 0; k < 3; k++) { parts.push({ geo: disc(R, 0.9, 0.35), color: cols[(k + 1) % 4], matrix: mat4(0, y, 0) }); y += 0.9; R -= 0.9; }
  const vase = new THREE.LatheGeometry(V2([[0, 0], [0.7, 0], [1.1, 0.9], [0.5, 1.8], [0.45, 2.2], [0.7, 2.5], [0.55, 2.5], [0.3, 2.2], [0, 2.2]]), 10);
  parts.push({ geo: vase, color: PEACH, bottom: BLUSH2, matrix: mat4(-1, y, 0.4) });
  parts.push({ geo: sph(1.3, 10, 7), color: BLUE, bottom: BLUE3, matrix: mat4(-1, y + 3.4, 0.4) });
  parts.push({ geo: sph(0.9, 9, 6), color: BLUE2, bottom: BLUE3, matrix: mat4(0.9, y + 0.8, -0.6) });
  parts.push({ geo: sph(0.6, 8, 6), color: BLUSH, matrix: mat4(1.8, y + 0.5, 1.0) });
  return mergeSmooth(parts);
}

// Oversized mug on blue saucer, a donut leaning on it, a curl of steam.
function geoCup(KIT) {
  const { mergeSmooth, mat4 } = KIT;
  const cup = new THREE.LatheGeometry(V2([[0, 0.1], [1.6, 0.1], [2.0, 0.5], [2.4, 4.2], [2.45, 4.6], [2.2, 4.6], [2.1, 4.2], [1.7, 1.2], [0, 1.2]]), 14);
  const handle = new THREE.TorusGeometry(1.1, 0.34, 8, 14, Math.PI * 1.2); handle.rotateZ(-Math.PI * 0.6);
  const fill = new THREE.CylinderGeometry(2.1, 2.1, 0.1, 20);
  const donut = new THREE.TorusGeometry(1.15, 0.5, 8, 16), ice = new THREE.TorusGeometry(1.15, 0.52, 8, 16); ice.scale(1, 1, 0.7);
  const curve = new THREE.CatmullRomCurve3([0, 1, 2, 3, 4, 5, 6].map((i) => new THREE.Vector3(Math.sin(i * 1.3) * (0.3 + i * 0.1), 5 + i * 0.9, Math.cos(i * 1.3) * (0.3 + i * 0.1))));
  const steam = new THREE.TubeGeometry(curve, 24, 0.16, 6);
  return mergeSmooth([
    { geo: disc(4.6, 0.7, 0.3, 24), color: BLUE, bottom: BLUE2, matrix: mat4(0, -0.1, 0) },
    { geo: disc(3.6, 0.5, 0.2, 24), color: BLUE2, matrix: mat4(0, 0.5, 0) },
    { geo: cup, color: CREAM, bottom: PEACH, matrix: mat4(0, 1.0, 0) },
    { geo: fill, color: BLUSH, matrix: mat4(0, 5.35, 0) },
    { geo: handle, color: CREAM, matrix: mat4(2.35, 3.2, 0) },
    { geo: donut, color: PEACH, matrix: mat4(3.2, 1.9, 2.8, -1.1, 0.3, 0) },
    { geo: ice, color: BLUSH, matrix: mat4(3.2, 2.05, 2.8, -1.1, 0.3, 0) },
    { geo: steam, color: 0xffffff, matrix: mat4(0, 0.4, 0) },
  ]);
}

function geoHouse(KIT, body, roof, tower) {
  const { mergeSmooth, mat4 } = KIT;
  const parts = [];
  if (!tower) {
    const rf = new THREE.CylinderGeometry(3.3, 3.3, 5.8, 14); rf.rotateX(Math.PI / 2); rf.scale(1, 0.75, 1);
    parts.push({ geo: rbox(6.2, 7.4, 5.2, 0.5), color: body, bottom: PEACH, matrix: mat4(0, 1.0, 0), smooth: true });
    parts.push({ geo: rf, color: roof, bottom: BLUSH2, matrix: mat4(0, 4.5, 0) });
    parts.push({ geo: sph(0.75, 8, 6), color: BLUE, matrix: mat4(1.6, 7.4, -1.0) });
  } else {
    parts.push({ geo: new THREE.CylinderGeometry(2.7, 2.9, 8.4, 14), color: body, bottom: PEACH, matrix: mat4(0, 1.2, 0) });
    const dome = sph(3.0, 14, 8, 0); dome.scale(1, 0.9, 1);
    parts.push({ geo: dome, color: roof, bottom: BLUSH2, matrix: mat4(0, 5.4, 0) });
    parts.push({ geo: sph(0.55, 8, 6), color: CREAM, matrix: mat4(0, 8.3, 0) });
    parts.push({ geo: new THREE.TorusGeometry(2.8, 0.28, 6, 18).rotateX(Math.PI / 2), color: BLUE, matrix: mat4(0, 4.1, 0) });
  }
  const zf = tower ? 2.78 : 2.6;
  parts.push({ geo: archDoor(0.75, 1.5, 0.3), color: BLUE2, matrix: mat4(0, 0, zf) });
  const win = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 10); win.rotateX(Math.PI / 2);
  const xs = tower ? [-1.2, 1.2] : [-1.9, 1.9];
  for (const x of xs) parts.push({ geo: win.clone(), color: BLUE, matrix: mat4(x, 3.0, zf - 0.05) });
  const win2 = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10); win2.rotateX(Math.PI / 2);
  parts.push({ geo: win2, color: BLUE, matrix: mat4(0, 4.8, zf - 0.05) });
  return mergeSmooth(parts);
}

function geoSea(KIT, sail) {
  const { mergeSmooth, mat4 } = KIT;
  const hull = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const s = new THREE.BufferGeometry();
  s.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, 2.2, 0, 7.4, 0.1, 0, 0.9, -0.1, 0, 1.2, -0.4, 0, 5.2, -0.5, 0, 1.2, -2.6], 3));
  s.computeVertexNormals();
  return mergeSmooth([
    { geo: hull, color: BLUE2, matrix: mat4(0, 0.9, 0, 0, 0, 0, 1.3, 1.1, 3.6) },
    { geo: new THREE.CylinderGeometry(1.35, 1.35, 0.2, 12).scale(1, 1, 2.6), color: CREAM, matrix: mat4(0, 0.9, 0) },
    { geo: new THREE.CylinderGeometry(0.08, 0.08, 7.4, 5), color: CREAM, matrix: mat4(0, 4.5, 0) },
    { geo: s, color: sail },
  ]);
}

export default {
  id: 'candy',

  track: {
    seed: 61,
    scale: 0.82,
    width: 22,
    points: [
      [0, 180, 0], [105, 168, 0], [210, 178, 1], [292, 112, 4], [300, 10, 8],
      [250, -55, 13], [170, -82, 16], [115, -30, 11], [60, 20, 7], [-10, 10, 4],
      [-70, -40, 3], [-60, -120, 2], [-130, -170, 1], [-230, -140, 1], [-270, -60, 1],
      [-250, 40, 1], [-190, 120, 0], [-100, 170, 0],
    ],
    itemRows: [0.11, 0.37, 0.62, 0.86],
    boostPads: [[0.25, 0], [0.5, 0], [0.74, 0]],
    obstacles: [
      { kind: 'cones', at: 0.17, lat: -3, count: 6, skin: 'marshmallow' },
      { kind: 'roller', at: 0.31, count: 2, size: 1.5, period: 4, skin: 'gumball' },
      { kind: 'bouncer', at: 0.44, lat: 4, size: 2.2, skin: 'jelly' },
      { kind: 'ramp', at: 0.57, lat: -2, size: 6 },
      { kind: 'cones', at: 0.68, lat: 3, count: 5, skin: 'marshmallow' },
      { kind: 'roller', at: 0.93, count: 1, size: 1.8, period: 3.5, skin: 'gumball' },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise, mix3, smoothstep, lerp } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 101), N3 = makeNoise(seed + 9);
    const cx = bounds.cx, cz = bounds.cz;
    const cream = new T.Color(0xfff1e2), peach = new T.Color(0xfadcc6), blush = new T.Color(0xf8d2dc), blue = new T.Color(0xc2d4f4), white = new T.Color(0xfff6ea);
    const sea = (x, z) => smoothstep(0.1, 0.4, N3.fbm(x * 0.0045 + 9, z * 0.0045, 2)) * smoothstep(340, 420, Math.hypot(x - cx, z - cz));
    return {
      sky: { top: 0xa6c1f2, mid: 0xc9d9f6, bottom: 0xffdcd2, sunColor: 0xffecd6, sunDir: [0.35, 0.5, 0.5], stars: 0, aurora: 0 },
      fog: { color: 0xf8d9db, near: 130, far: 820 },
      light: { sun: 0xfff0e2, sunI: 1.6, sky: 0xeaeaff, ground: 0xfbe6dc, hemiI: 2.3 },
      water: { level: -3, shallow: 0xcfe0f8, deep: 0x9ab8ea, foam: 0xffffff, ice: 0 },
      road: { tint: 0xb0c8f2, line: '#fff6ea', curbA: '#f3b6c6', curbB: '#fff3e4', shoulder: 0xf8e2cc },
      clouds: { color: 0xffffff, count: 0, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xfff2f4, cfg: { n: 150, box: 70, size: 0.3, vel: [0.3, 0.2, 0.2], op: 0.5 } },
      detail: {
        strokes: 0, kind: 'custom',
        draw(g, S, rnd) {
          g.lineWidth = 1.8;
          for (let i = 0; i < 46; i++) {
            const y = rnd() * S, x0 = rnd() * (S - 60);
            g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(176,150,150,0.13)';
            g.beginPath(); g.moveTo(x0, y);
            for (let k = 1; k <= 6; k++) g.lineTo(x0 + k * 9, y + Math.sin(k * 1.1 + i) * 2.2);
            g.stroke();
          }
        },
      },
      blendNear: 8, blendFar: 80,
      onBuilt(world) { world.terrainMesh.material.flatShading = false; world.terrainMesh.material.needsUpdate = true; },
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz);
        let h = 8 + N.fbm(x * 0.0065, z * 0.0065, 3) * 22 + N2.fbm(x * 0.02, z * 0.02, 2) * 3;
        if (h < 1.5) h = 1.5 + (h - 1.5) * 0.15;
        const m = smoothstep(330, 640, r);
        h += m * m * 110 + m * N2.fbm(x * 0.01, z * 0.01, 2) * 30;
        return lerp(h, -7, sea(x, z));
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.006, z * 0.006) * 0.5 + 0.5;
        mix3(out, cream, peach, smoothstep(0.3, 0.9, n) * 0.3);
        const b = N.noise(x * 0.007 + 40, z * 0.007) * 0.5 + 0.5;
        mix3(out, out, blush, smoothstep(0.35, 0.8, b) * 0.7);
        if (slope > 0.3) mix3(out, out, peach, smoothstep(0.3, 0.8, slope) * 0.25);
        if (h > 40) mix3(out, out, white, smoothstep(40, 100, h) * 0.7);
        if (h < 0.5) mix3(out, out, blue, smoothstep(0.5, -3, h));
        if (d < 14) mix3(out, out, white, 0.45);
        mix3(out, out, white, 0.18);
        return out;
      },
    };
  },

  scenery(w, kit) {
    const { THREE: T, instanced, scatter, alongTrack, mat4, mergeSmooth, TAU, lerp } = kit;
    const rnd = w.rnd, M = w.mats.scenery, tr = w.track, b = tr.bounds;
    const noShadow = (m) => { if (m) m.castShadow = false; return m; };
    const faceRoad = (list) => {
      const info = {};
      for (const it of list) { tr.distInfo(it.x, it.z, info); it.ry = Math.atan2(tr.px[info.i] - it.x, tr.pz[info.i] - it.z); }
      return list;
    };

    // Big arches straddling the road, three soft bands each.
    const arches = [0.2, 0.38, 0.55, 0.88].map((f) => {
      const i = Math.floor(f * tr.n);
      return { x: tr.px[i], y: tr.py[i], z: tr.pz[i], ry: tr.heading[i], s: 1 };
    });
    instanced(w, geoArchStack(kit, 19), M, arches, 0).castShadow = true;
    // Little arches standing on the dunes.
    instanced(w, geoArchStack(kit, 5), M, scatter(w, { count: 10, minD: tr.limit + 10, maxD: 90, maxSlope: 0.3, minH: 0, s0: 0.8, s1: 1.2, sink: 0.2 }), 0).castShadow = true;

    // Pom-pom trees and tall blue cypress shapes.
    const blues = [[BLUE, 0xb6cdf4], [0x93b0ea, BLUE], [0xb6cdf4, 0x98b4ec]];
    blues.forEach((cols, v) => noShadow(instanced(w, geoPom(kit, rnd, cols, v === 2), M, scatter(w, { count: 62, minH: 0, maxSlope: 0.45, s0: 0.9, s1: 1.7, radius: 450, minD: tr.limit + 3 }), 3)));
    noShadow(instanced(w, geoPom(kit, rnd, [BLUE], false), M, alongTrack(w, { count: 40, d0: 6, d1: 22, s0: 0.8, s1: 1.3, minH: 0 }), 3));
    noShadow(instanced(w, geoPuff(kit), M, scatter(w, { count: 130, minH: 0, maxD: 80, maxSlope: 0.45, s0: 0.9, s1: 2.0, minD: tr.limit + 2 })));

    // Houses with round tops and arched doors, domed towers.
    const body = [CREAM, 0xf8d9c4, 0xf6d4dc], roof = [BLUE, BLUSH, 0x8fb0e6];
    [0, 1, 2].forEach((v) => instanced(w, geoHouse(kit, body[v], roof[v], false), M, faceRoad(alongTrack(w, { count: 7, d0: 17, d1: 44, minH: 0, s0: 1.3, s1: 1.8, sink: 0.4 })), 4.2).castShadow = true);
    [0, 1].forEach((v) => instanced(w, geoHouse(kit, body[v + 1], roof[v + 1], true), M, faceRoad(alongTrack(w, { count: 4, d0: 19, d1: 46, minH: 0, s0: 1.3, s1: 1.8, sink: 0.4 })), 3.4).castShadow = true);

    // Stacked discs with vases, oversized cups with donuts, mushroom stools.
    instanced(w, geoStack(kit, rnd), M, alongTrack(w, { count: 9, d0: 16, d1: 40, minH: 0, s0: 0.9, s1: 1.4, sink: 0.2 }), 5).castShadow = true;
    instanced(w, geoCup(kit), M, faceRoad(alongTrack(w, { count: 9, even: true, phase: 0.3, d0: 16, d1: 30, minH: 0, s0: 1.8, s1: 2.4, sink: 0.3 })), 6).castShadow = true;
    // Big clay landmarks close to the road: cups with donuts, stacked discs, pom-pom clusters.
    instanced(w, geoCup(kit), M, faceRoad(alongTrack(w, { count: 5, even: true, phase: 0.1, d0: 13, d1: 19, minH: 0, s0: 2.1, s1: 2.6, sink: 0.3 })), 6).castShadow = true;
    instanced(w, geoStack(kit, rnd), M, alongTrack(w, { count: 4, even: true, phase: 0.45, d0: 13, d1: 18, minH: 0, s0: 1.4, s1: 1.8, sink: 0.2 }), 5).castShadow = true;
    [[BLUE, 0xb6cdf4], [BLUSH, BLUE]].forEach((cols, i) => noShadow(instanced(w, geoPom(kit, rnd, cols, false), M, alongTrack(w, { count: 5, even: true, phase: 0.2 + i * 0.5, d0: 9, d1: 15, minH: 0, s0: 2.3, s1: 3.0 }), 4)));
    noShadow(instanced(w, geoMushroom(kit, CREAM), M, scatter(w, { count: 30, minH: 0, maxD: 70, maxSlope: 0.4, s0: 0.9, s1: 1.8, minD: tr.limit + 3 }), 1.6));
    noShadow(instanced(w, geoMushroom(kit, BLUSH), M, scatter(w, { count: 22, minH: 0, maxD: 70, maxSlope: 0.4, s0: 0.9, s1: 1.8, minD: tr.limit + 3 }), 1.6));

    // Blue pebbles along the verge.
    const pebs = alongTrack(w, { count: 300, d0: 2.6, d1: 16, minH: 0, s0: 0.5, s1: 1.2 });
    const pc = [BLUE, BLUE2, BLUSH, CREAM];
    pebs.forEach((p) => { p.color = new T.Color(pc[Math.floor(rnd() * pc.length)]); p.y += 0.15; });
    instanced(w, mergeSmooth([{ geo: sph(0.4, 6, 4), color: 0xffffff }]), M, pebs);

    // Puffy pink clouds, drifting slowly.
    const cg = [];
    for (let k = 0; k < 6; k++) cg.push({ geo: sph(1, 10, 7), color: k % 2 ? 0xfbdde3 : 0xffe6ea, bottom: 0xf0b3c5, matrix: mat4((k - 2.5) * 1.15, Math.sin(k * 1.9) * 0.25, Math.cos(k * 2.3) * 0.3, 0, 0, 0, 1.1 - Math.abs(k - 2.5) * 0.12, 0.8, 0.9) });
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU, r = 380 + rnd() * 600, low = i < 10;
      clouds.push({ x: Math.cos(a) * r, y: low ? 70 + rnd() * 40 : 130 + rnd() * 90, z: Math.sin(a) * r, ry: rnd() * TAU, s: low ? 8 + rnd() * 8 : 9 + rnd() * 12 });
    }
    const cm = instanced(w, mergeSmooth(cg), w.mats.sceneryNoFog, clouds);
    cm.position.set(b.cx, 0, b.cz);
    w.updaters.push((dt) => { cm.rotation.y += dt * 0.004; });

    // Balloons floating up, bobbing.
    const bcols = [BLUE, BLUSH, CREAM, BLUE2, BLUSH2];
    for (let i = 0; i < 4; i++) {
      const parts = [];
      for (let k = 0; k < 3; k++) {
        parts.push({ geo: sph(1.7, 10, 7), color: bcols[(i + k) % 5], bottom: BLUE3, matrix: mat4(k * 2.2 - 2.2, 4 + (k % 2) * 1.2, 0) });
        parts.push({ geo: new T.CylinderGeometry(0.05, 0.05, 6, 4), color: CREAM, matrix: mat4(k * 1.1 - 1.1, 0.5, 0, 0, 0, (1 - k) * 0.2) });
      }
      const m = new T.Mesh(mergeSmooth(parts), M);
      const a = rnd() * TAU, r = 130 + rnd() * 250, y0 = 40 + rnd() * 40, ph = rnd() * 10;
      m.position.set(b.cx + Math.cos(a) * r, y0, b.cz + Math.sin(a) * r); m.scale.setScalar(2 + rnd());
      w.scene.add(m);
      w.updaters.push((dt, t) => { m.position.y = y0 + Math.sin(t * 0.4 + ph) * 3; m.rotation.y += dt * 0.06; });
    }

    // Sailboats on the calm sea.
    const sails = [BLUE, BLUSH, BLUE, CREAM];
    for (let i = 0; i < 6; i++) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 60 && !ok; t++) {
        const a = rnd() * TAU, r = 330 + rnd() * 230;
        x = b.cx + Math.cos(a) * r; z = b.cz + Math.sin(a) * r;
        ok = w.heightAt(x, z) < -5;
      }
      if (!ok) continue;
      const m = new T.Mesh(geoSea(kit, sails[i % 4]), w.mats.sceneryDouble);
      m.position.set(x, -3, z); m.rotation.y = rnd() * TAU; m.scale.setScalar(2.4 + rnd() * 1.4);
      const ph = rnd() * 10;
      w.scene.add(m);
      w.updaters.push((dt, t) => { m.position.y = -3 + Math.sin(t * 0.9 + ph) * 0.2; m.rotation.z = Math.sin(t * 0.7 + ph) * 0.05; });
    }
  },

  song: {
    bpm: 108, style: 'candy', lead: 'whistle',
    chords: 'F Am Bb C F Dm Gm C F Am Bb C Dm Bb C F',
    melody: [
      'a5/4 c6/2 a5/2 f5/4 a5/4', 'e5/4 a5/4 c6/6 -/2', 'd6/4 c6/2 bb5/2 a5/4 f5/4', 'g5/6 e5/2 g5/4 c6/4',
      'a5/4 c6/2 a5/2 f6/4 c6/4', 'd6/4 a5/4 f5/4 a5/4', 'bb5/4 d6/2 bb5/2 g5/4 d5/4', 'e5/2 g5/2 c6/4 g5/8',
      'c6/4 f6/4 e6/2 d6/2 c6/4', 'e6/4 c6/4 a5/4 c6/4', 'd6/6 f6/2 d6/4 bb5/4', 'c6/4 e6/4 g6/4 e6/4',
      'f6/4 d6/2 f6/2 a6/4 f6/4', 'd6/4 bb5/4 f5/4 bb5/4', 'g5/4 c6/4 e6/4 d6/2 c6/2', 'f5/12 -/4',
    ],
  },
  style: { kick: [0, 10], snare: [], rim: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.22, bass: [[0, 0], [6, 7], [8, 0], [10, 12], [14, 7]], bassLen: 3, comp: 'pad', level: 0.9 },

  chip: 'linear-gradient(175deg,#a5c0ee 0 36%,#f8d9db 36% 60%,#fff0dc 60% 100%)',

  strings: {
    en: { name: 'Marshmallow Dunes', sub: 'Soft dunes and sleepy arches' },
    nl: { name: 'Spekkiesduinen', sub: 'Zachte duinen en slaperige bogen' },
  },

  skins: {
    gumball(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const g = mergeSmooth([
        { geo: new T.SphereGeometry(1, 14, 10), color: 0xf3c3cf, bottom: 0xe3a0b6 },
        { geo: new T.TorusGeometry(1, 0.13, 6, 20).rotateX(Math.PI / 2), color: 0xfff0dc },
        { geo: new T.SphereGeometry(0.2, 6, 5), color: 0xffffff, matrix: mat4(-0.5, 0.6, 0.6) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    jelly(kit) {
      const { mergeSmooth, THREE: T } = kit;
      const dome = new T.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1);
      const g = mergeSmooth([
        { geo: new T.CylinderGeometry(1, 1, 0.12, 20), color: 0xfff0dc },
        { geo: dome, color: 0xa5c0ee, bottom: 0x86a6e2 },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    marshmallow(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const cone = new T.LatheGeometry([[0, 0], [0.34, 0], [0.38, 0.12], [0.3, 0.55], [0.2, 0.74], [0, 0.78]].map(([x, y]) => new T.Vector2(x, y)), 10);
      const g = mergeSmooth([
        { geo: cone, color: 0xfff0dc, bottom: 0xf4cdb0 },
        { geo: new T.SphereGeometry(0.17, 8, 6), color: 0xf3c3cf, matrix: mat4(0, 0.74, 0) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
  },
};
