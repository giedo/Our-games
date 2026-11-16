// Storybook Harbour: a painted picture book. Strong sky blue, warm yellow, red and orange roofs.
import * as THREE from '../../vendor/three.module.min.js';

const LH = [-32, -138]; // lighthouse spot (scaled world units)
const WALLS = [0x2f62b0, 0xf0c050, 0xd9703c, 0xf2e2b8, 0x3f9bc0, 0xe8b4a0, 0x2b4f94, 0xf4cf6a];
const ROOFS = [0xd9472f, 0xe8742e, 0x1f3f7a, 0xc13d2c, 0xe8742e];
const GREENS = [0x7fb23a, 0xc8cf4a, 0x3f9a78, 0x5aa04a, 0x2f7fa8, 0xdcc84a];
const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));

// A row of narrow town houses side by side; `glow` holds the lit windows (drawn unlit).
function geoRow(KIT, rnd) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const body = [], glow = [], n = 4 + Math.floor(rnd() * 3), ws = [];
  let total = 0;
  for (let i = 0; i < n; i++) { ws.push(4.4 + rnd() * 1.6); total += ws[i]; }
  let x = -total / 2;
  const d = 5.6;
  for (let i = 0; i < n; i++) {
    const w = ws[i], h = 9 + Math.floor(rnd() * 4) * 2.4, cx = x + w / 2, wall = WALLS[Math.floor(rnd() * WALLS.length)];
    x += w;
    body.push({ geo: new T.BoxGeometry(w, h, d), color: wall, bottom: new T.Color(wall).multiplyScalar(0.7), matrix: mat4(cx, h / 2 - 1, 0) });
    body.push({ geo: new T.BoxGeometry(w + 0.3, 0.4, d + 0.3), color: 0xfff0c8, matrix: mat4(cx, 2.3, 0) });
    const roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
    if (rnd() < 0.65) {
      const r = new T.ConeGeometry(w * 0.78, 3.8, 4); r.rotateY(Math.PI / 4);
      body.push({ geo: r, color: roof, bottom: new T.Color(roof).multiplyScalar(0.75), matrix: mat4(cx, h - 1 + 1.9, 0, 0, 0, 0, 1, 1, (d / 2 + 0.4) / (w * 0.78 * 0.7071)) });
    } else {
      body.push({ geo: new T.BoxGeometry(w + 0.4, 0.8, d + 0.4), color: roof, matrix: mat4(cx, h - 0.6, 0) });
    }
    body.push({ geo: new T.BoxGeometry(0.9, 1.8, 0.9), color: 0xb5603c, matrix: mat4(cx + w * 0.25, h + 1.2, -d * 0.2) });
    body.push({ geo: new T.BoxGeometry(1.3, 2.3, 0.2), color: rnd() < 0.5 ? 0x7a2f1e : 0x234a8a, matrix: mat4(cx - w * 0.2, 0.15, d / 2 + 0.05) });
    if (rnd() < 0.55) for (let s = 0; s < 4; s++) body.push({ geo: new T.BoxGeometry(w / 4.4, 0.1, 1.4), color: s % 2 ? 0xfff0d8 : 0xe0452f, matrix: mat4(cx - w * 0.375 + (s * w) / 4, 3.1, d / 2 + 0.7, 0.4, 0, 0) });
    for (let y = 4.2; y < h - 2.6; y += 3.0) {
      for (const sx of [-1, 1]) {
        const px = cx + sx * w * 0.22;
        glow.push({ geo: new T.PlaneGeometry(1.4, 1.9), color: 0x203a6a, matrix: mat4(px, y, d / 2 + 0.03) });
        glow.push({ geo: new T.PlaneGeometry(1.0, 1.5), color: rnd() < 0.72 ? 0xffd45a : 0x5a8ac8, matrix: mat4(px, y, d / 2 + 0.06) });
      }
    }
  }
  return { body: mergeSmooth(body), glow: mergeSmooth(glow) };
}

// Big round friendly tree: a leaning trunk and a crown of painted blobs.
function geoBigTree(KIT, rnd, blobs, R) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const parts = [
    { geo: new T.CylinderGeometry(0.5, 0.95, 4.2, 7), color: 0x8a5a38, matrix: mat4(0, 2.0, 0) },
    { geo: new T.CylinderGeometry(0.3, 0.5, 3.6, 6), color: 0x9a6a40, matrix: mat4(1.1, 5.0, 0, 0, 0, -0.55) },
    { geo: new T.CylinderGeometry(0.28, 0.45, 3.2, 6), color: 0x9a6a40, matrix: mat4(-1.0, 4.9, 0.3, 0.2, 0, 0.6) },
  ];
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * R, y = 6.4 + rnd() * R * 0.75;
    const g = GREENS[Math.floor(rnd() * GREENS.length)];
    parts.push({ geo: new T.IcosahedronGeometry(1.6 + rnd() * 1.4, 1), color: g, bottom: new T.Color(g).multiplyScalar(0.62), matrix: mat4(Math.cos(a) * rr, y, Math.sin(a) * rr) });
  }
  return mergeSmooth(parts);
}

function geoPlant(KIT, rnd) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const parts = [{ geo: new T.CylinderGeometry(0.55, 0.38, 0.8, 8), color: 0xc65a32, matrix: mat4(0, 0.4, 0) }, { geo: new T.CylinderGeometry(0.6, 0.6, 0.15, 8), color: 0xa84a28, matrix: mat4(0, 0.8, 0) }];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28, cone = new T.ConeGeometry(0.2, 1.8, 4); cone.translate(0, 0.9, 0);
    parts.push({ geo: cone, color: i % 3 ? 0x3f9a4a : 0x2f8a78, matrix: mat4(0, 0.8, 0, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5) });
  }
  for (let i = 0; i < 3; i++) parts.push({ geo: new T.IcosahedronGeometry(0.28, 0), color: [0xffd21f, 0xe8453c, 0xffffff][i], matrix: mat4(Math.cos(i * 2.1) * 0.4, 2.2 + i * 0.1, Math.sin(i * 2.1) * 0.4) });
  return mergeSmooth(parts);
}

function geoBoat(KIT, hull, stripe) {
  const { mergeSmooth, mat4 } = KIT, T = THREE;
  const h = new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const sail = (pts) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g; };
  return mergeSmooth([
    { geo: h, color: hull, matrix: mat4(0, 1.0, 0, 0, 0, 0, 1.5, 1.2, 4.2) },
    { geo: new T.BoxGeometry(3.1, 0.3, 8.3), color: 0xf6ecd0, matrix: mat4(0, 1.02, 0) },
    { geo: new T.BoxGeometry(3.08, 0.5, 8.2), color: stripe, matrix: mat4(0, 0.7, 0) },
    { geo: new T.BoxGeometry(1.6, 1.1, 1.9), color: 0xfff6e0, matrix: mat4(0, 1.7, -1.8) },
    { geo: new T.CylinderGeometry(0.11, 0.11, 10.5, 5), color: 0x7a5232, matrix: mat4(0, 6.2, 0.6) },
    { geo: sail([0, 1.8, 3.4, 0, 10.8, 0.7, 0, 1.8, 0.6]), color: 0xf5c542 },
    { geo: sail([0, 1.8, 0.4, 0, 9.6, 0.5, 0, 1.8, -3.0]), color: 0xf7d868 },
    { geo: sail([0.05, 10.8, 0.6, 0.05, 11.6, 0.2, 0.05, 10.8, -0.3]), color: 0xe0452f },
  ]);
}

function geoGull(KIT) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1.5, 0.25, 0, 0, 0, 0.5, 0, 0, -0.4, 1.5, 0.25, 0, 0, 0, -0.4, 0, 0, 0.5, 0, 0.05, 0.7, 0.12, 0, 0.3, -0.12, 0, 0.3], 3));
  g.computeVertexNormals();
  return g;
}

export default {
  id: 'story',

  track: {
    seed: 97,
    scale: 0.85,
    width: 19,
    points: [
      [0, 165, 0], [110, 165, 0], [200, 165, 0], [268, 148, 0], [296, 95, 0],
      [272, 45, 1], [296, -5, 1], [272, -55, 2], [215, -82, 3],
      [170, -112, 6], [152, -170, 10], [92, -202, 15], [22, -182, 20], [-20, -125, 22],
      [-82, -105, 20], [-140, -135, 15], [-195, -102, 9], [-228, -40, 5], [-255, 30, 2],
      [-220, 110, 0], [-140, 150, 0],
    ],
    itemRows: [0.1, 0.33, 0.56, 0.82],
    boostPads: [[0.2, 0], [0.45, 0], [0.7, 0]],
    obstacles: [
      { kind: 'crosser', at: 0.16, count: 4, speed: 2.5, skin: 'duck' },
      { kind: 'roller', at: 0.3, count: 2, size: 1.2, period: 4, skin: 'barrel' },
      { kind: 'cones', at: 0.4, lat: -2, count: 6, skin: 'crate' },
      { kind: 'traffic', at: 0.52, count: 2, speed: 7, lat: 4, skin: 'tram' },
      { kind: 'ramp', at: 0.66, lat: 0, size: 6 },
      { kind: 'roller', at: 0.78, count: 2, size: 1.2, period: 3.6, skin: 'barrel' },
      { kind: 'cones', at: 0.94, lat: 3, count: 5, skin: 'crate' },
    ],
  },

  theme(seed, bounds, kit) {
    const { THREE: T, makeNoise, mix3, smoothstep, lerp } = kit;
    const N = makeNoise(seed), N2 = makeNoise(seed + 101);
    const cx = bounds.cx, cz = bounds.cz, seaZ = bounds.maxZ + 1;
    const g1 = new T.Color(0x8fcf48), g2 = new T.Color(0xd4dc5c), g3 = new T.Color(0x5faa44), gold = new T.Color(0xf0cc58), sand = new T.Color(0xeed08a), blue = new T.Color(0x78a8dc), rock = new T.Color(0xd8b878);
    const hill = (x, z) => { const d = Math.hypot(x - LH[0], z - LH[1]); return 26 * Math.exp(-((d / 58) ** 2)); };
    return {
      sky: { top: 0x1f7fe0, mid: 0x5fb8f2, bottom: 0xd2edff, sunColor: 0xfff0b0, sunDir: [-0.4, 0.6, 0.5], stars: 0, aurora: 0 },
      fog: { color: 0xc4e4f6, near: 170, far: 1050 },
      light: { sun: 0xfff0c8, sunI: 2.7, sky: 0xbfe2ff, ground: 0xe6c070, hemiI: 1.5 },
      water: { level: -2, shallow: 0x38b4ea, deep: 0x1a6cc2, foam: 0xffffff, ice: 0 },
      road: { tint: 0x66728c, line: '#fff3c0', curbA: '#e0452f', curbB: '#fff1c8', shoulder: 0xb5c75a },
      clouds: { color: 0xffffff, count: 0, minY: 150, maxY: 230 },
      ambient: { kind: 'pollen', color: 0xfff2b0, cfg: { n: 160, box: 70, size: 0.26, vel: [0.5, 0.25, 0.3], op: 0.6 } },
      detail: {
        strokes: 0, kind: 'custom',
        draw(g, S, rnd) {
          g.lineCap = 'round';
          for (let i = 0; i < 520; i++) {
            const x = rnd() * S, y = rnd() * S, l = 7 + rnd() * 14, a = -0.9 + (rnd() - 0.5) * 0.5;
            g.lineWidth = 2.5 + rnd() * 3.5;
            g.strokeStyle = rnd() < 0.55 ? 'rgba(255,255,235,0.38)' : 'rgba(105,120,70,0.22)';
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
          }
        },
      },
      blendNear: 6, blendFar: 24,
      height(x, z) {
        const r = Math.hypot(x - cx, z - cz);
        let h = 3 + N.fbm(x * 0.006, z * 0.006, 3) * 14 + N2.fbm(x * 0.022, z * 0.022, 2) * 2 + hill(x, z);
        const m = smoothstep(300, 640, r);
        h += m * m * 130 + m * N2.fbm(x * 0.012, z * 0.012, 3) * 40;
        return lerp(h, -9, smoothstep(seaZ, seaZ + 18, z));
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.02, z * 0.02) * 0.5 + 0.5;
        mix3(out, g1, g2, smoothstep(0.42, 0.58, n));
        const p = N.noise(x * 0.012 + 20, z * 0.012) * 0.5 + 0.5;
        mix3(out, out, g3, smoothstep(0.55, 0.7, p) * 0.8);
        if (h > 14) mix3(out, out, gold, smoothstep(18, 40, h) * 0.5);
        if (slope > 0.55) mix3(out, out, rock, smoothstep(0.6, 1.0, slope) * 0.45);
        if (h > 70) mix3(out, out, blue, smoothstep(50, 120, h) * 0.85);
        if (h < 0.9) mix3(out, out, sand, smoothstep(0.9, -0.5, h));
        return out;
      },
    };
  },

  scenery(w, kit) {
    const { THREE: T, instanced, alongTrack, scatter, sprinkle, mat4, mergeSmooth, TAU, lerp, geoLighthouse, geoHouse } = kit;
    const rnd = w.rnd, M = w.mats.scenery, tr = w.track, b = tr.bounds, hw = tr.halfWidth, p = new T.Vector3(), q = new T.Vector3(), info = {};
    const faceRoad = (list) => {
      for (const it of list) { tr.distInfo(it.x, it.z, info); it.ry = Math.atan2(tr.px[info.i] - it.x, tr.pz[info.i] - it.z); }
      return list;
    };
    const noShadow = (m) => { if (m) m.castShadow = false; return m; };

    // Rows of tall narrow town houses with lit windows.
    const glowMat = new T.MeshBasicMaterial({ vertexColors: true });
    for (let v = 0; v < 3; v++) {
      const row = geoRow(kit, rnd);
      const spots = faceRoad(alongTrack(w, { count: 20, d0: 12, d1: 17, minH: 0.8, s0: 1, s1: 1.15 }));
      instanced(w, row.body, M, spots, 9);
      instanced(w, row.glow, glowMat, spots);
    }

    // Big round trees, little round trees, potted plants and wild flowers.
    instanced(w, geoBigTree(kit, rnd, 26, 4.6), M, alongTrack(w, { count: 6, even: true, phase: 0.4, d0: 20, d1: 34, s0: 1.5, s1: 2.1, minH: 0.8 }), 8).castShadow = true;
    for (let v = 0; v < 2; v++) noShadow(instanced(w, geoBigTree(kit, rnd, 9, 2.2), M, scatter(w, { count: 40, minH: 0.8, maxH: 40, maxSlope: 0.45, s0: 0.9, s1: 1.5, radius: 450 }), 3.4));
    noShadow(instanced(w, geoPlant(kit, rnd), M, alongTrack(w, { count: 70, d0: 3, d1: 9, minH: 0.2, s0: 1, s1: 1.7 }), 0.8));
    sprinkle(w, [0xffffff, 0xffd21f, 0xe8453c, 0x5fa8e8, 0xff9a40], 1200, 0.7);

    // Quay wall along the water, bollards and lamp posts with string lights.
    const flagged = [];
    for (let i = 0; i < tr.n; i++) { tr.posAt(i, hw + 9, p); flagged.push(w.heightAt(tr.px[i] + tr.rx[i] * (hw + 20), tr.pz[i] + tr.rz[i] * (hw + 20)) < -2); }
    const pos = [], col = [], cA = new T.Color(0xe0b878), cB = new T.Color(0xcf9f62), cC = new T.Color(0xf6e6b4);
    const quad = (a, bq, c, d, cc) => { pos.push(a.x, a.y, a.z, bq.x, bq.y, bq.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b); };
    const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), D = new T.Vector3(), E = new T.Vector3(), F = new T.Vector3(), G2 = new T.Vector3(), H = new T.Vector3();
    const L0 = hw + 5.8, L1 = hw + 6.8;
    for (let i = 0; i < tr.n; i++) {
      const j = (i + 1) % tr.n;
      if (!flagged[i] || !flagged[j]) continue;
      const y = tr.py[i] + 0.1, y2 = tr.py[j] + 0.1, cc = Math.floor(i / 5) % 2 ? cA : cB;
      tr.posAt(i, L0, A); tr.posAt(i, L1, B); tr.posAt(j, L1, C); tr.posAt(j, L0, D);
      E.set(A.x, y, A.z); F.set(B.x, y, B.z); G2.set(C.x, y2, C.z); H.set(D.x, y2, D.z);
      quad(E, F, G2, H, cC);                                           // coping on top
      quad(F, new T.Vector3(B.x, -5, B.z), new T.Vector3(C.x, -5, C.z), G2, cc);   // sea side
      quad(E, new T.Vector3(A.x, y - 0.7, A.z), new T.Vector3(D.x, y2 - 0.7, D.z), H, cc); // road side
    }
    if (pos.length) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      w.scene.add(new T.Mesh(g, w.mats.sceneryDouble));
    }
    // Bollards on the shelf and lamp posts; string lights hang between the posts.
    const bol = [], posts = [], bulbs = [], lines = [];
    const bulbCols = [0xfff0a0, 0xffd45a, 0xffffff, 0xffb040].map((c) => new T.Color(c));
    const lights = (a, c, sag, n) => {
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = lerp(a.x, c.x, t), y = lerp(a.y, c.y, t) - sag * 4 * t * (1 - t), z = lerp(a.z, c.z, t);
        if (k > 0 && k < n) bulbs.push({ x, y: y - 0.2, z, s: 1, color: bulbCols[k % 4] });
        if (prev) lines.push(prev.x, prev.y, prev.z, x, y, z);
        prev = { x, y, z };
      }
    };
    let lastPost = null;
    for (let i = 0; i < tr.n; i += 9) {
      if (!flagged[i]) { lastPost = null; continue; }
      tr.posAt(i, hw + 4.6, p);
      bol.push({ x: p.x, y: tr.py[i] - 0.2, z: p.z, ry: 0, s: 1 });
      if (i % 27 === 0) {
        const top = new T.Vector3(p.x, tr.py[i] + 6.4, p.z);
        posts.push({ x: p.x, y: tr.py[i] - 0.3, z: p.z, ry: 0, s: 1 });
        if (lastPost) lights(lastPost, top, 1.3, 8);
        lastPost = top;
      }
    }
    // Across-the-road strings in the town corners.
    const sidePoles = [];
    for (const f of [0.215, 0.255, 0.305, 0.36, 0.415]) {
      const i = Math.floor(f * tr.n);
      tr.posAt(i, -(hw + 4.2), p); tr.posAt(i, hw + 4.2, q);
      const a = new T.Vector3(p.x, tr.py[i] + 9.6, p.z), c = new T.Vector3(q.x, tr.py[i] + 9.6, q.z);
      lights(a, c, 1.6, 12);
      sidePoles.push({ x: p.x, y: tr.py[i] - 0.3, z: p.z, ry: 0, s: 1.5 }, { x: q.x, y: tr.py[i] - 0.3, z: q.z, ry: 0, s: 1.5 });
    }
    instanced(w, mergeSmooth([
      { geo: new T.CylinderGeometry(0.28, 0.4, 1.1, 8), color: 0x1f3a6a, matrix: mat4(0, 0.55, 0) },
      { geo: new T.CylinderGeometry(0.34, 0.34, 0.2, 8), color: 0xf5c542, matrix: mat4(0, 1.15, 0) },
    ]), M, bol);
    const postGeo = () => mergeSmooth([{ geo: new T.CylinderGeometry(0.12, 0.2, 6.6, 6), color: 0x1f2f55, matrix: mat4(0, 3.3, 0) }, { geo: new T.SphereGeometry(0.3, 6, 4), color: 0xf5c542, matrix: mat4(0, 6.7, 0) }]);
    instanced(w, postGeo(), M, posts.concat(sidePoles.map((s) => ({ ...s, s: 1.4 }))));
    if (bulbs.length) instanced(w, new T.IcosahedronGeometry(0.26, 0), new T.MeshBasicMaterial({ color: 0xffffff }), bulbs);
    if (lines.length) {
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lines, 3));
      w.scene.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x2a2018 })));
    }

    // Boats with yellow sails on the harbour, some close to the quay.
    const hulls = [[0x2a4f9a, 0xe0452f], [0xd9472f, 0xfff0d0], [0x1f7fa8, 0xf5c542], [0x2a4f9a, 0xf5c542]];
    for (let i = 0; i < 9; i++) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = lerp(b.minX - 40, b.maxX + 40, rnd()); z = b.maxZ + (i < 4 ? 34 + rnd() * 30 : 60 + rnd() * 220);
        ok = w.heightAt(x, z) < -4;
      }
      if (!ok) continue;
      const h = hulls[i % 4], m = new T.Mesh(geoBoat(kit, h[0], h[1]), w.mats.sceneryDouble);
      m.position.set(x, -2, z); m.rotation.y = (i < 4 ? Math.PI / 2 : 0) + (rnd() - 0.5) * 1.2; m.scale.setScalar(1.3 + rnd() * 0.8);
      const ph = rnd() * 10;
      w.scene.add(m); m.castShadow = true;
      w.updaters.push((dt, t) => { m.position.y = -2.1 + Math.sin(t * 1.1 + ph) * 0.22; m.rotation.z = Math.sin(t * 0.8 + ph) * 0.06; });
    }

    // Lighthouse on the hill, with a keeper's cottage.
    const lx = LH[0], lz = LH[1], ly = w.heightAt(lx, lz);
    const lh = new T.Mesh(geoLighthouse(), M);
    lh.position.set(lx, ly - 0.8, lz); lh.scale.setScalar(2.1); lh.castShadow = true;
    w.scene.add(lh);
    const lamp = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 2.2, 10), new T.MeshBasicMaterial({ color: 0xfff2a8 }));
    lamp.position.set(lx, ly - 0.8 + 19.6 * 2.1, lz); lamp.scale.setScalar(2.1);
    w.scene.add(lamp);
    w.updaters.push((dt, t) => { lamp.material.color.setRGB(1, 0.92 + Math.sin(t * 3) * 0.06, 0.62 + Math.sin(t * 3) * 0.12); });
    const hx = lx + 14, hz = lz + 10, house = new T.Mesh(geoHouse(0xd9472f), M);
    house.position.set(hx, w.heightAt(hx, hz) - 0.4, hz); house.rotation.y = 2.2; house.scale.setScalar(1.4); house.castShadow = true;
    w.scene.add(house);

    // Gulls circling over the harbour and the hill.
    const gulls = new T.InstancedMesh(geoGull(kit), w.mats.sceneryDouble, 14), D2 = new T.Object3D(), gdat = [];
    for (let i = 0; i < 14; i++) {
      const harbour = i < 9;
      gdat.push({ cx: harbour ? lerp(b.minX, b.maxX, rnd()) : lx, cz: harbour ? b.maxZ + 40 + rnd() * 60 : lz, r: 18 + rnd() * 40, y: harbour ? 22 + rnd() * 22 : ly + 30 + rnd() * 20, sp: (0.25 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 6.28, s: 1.4 + rnd() * 0.8 });
    }
    gulls.frustumCulled = false;
    w.scene.add(gulls);
    gulls.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(gulls.geometry.attributes.position.count * 3).fill(1), 3));
    w.updaters.push((dt, t) => {
      for (let i = 0; i < 14; i++) {
        const g = gdat[i], a = g.ph + t * g.sp;
        D2.position.set(g.cx + Math.cos(a) * g.r, g.y + Math.sin(t * 0.9 + g.ph) * 1.5, g.cz + Math.sin(a) * g.r);
        D2.rotation.set(0, -a - (g.sp > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI, Math.sin(t * 5 + g.ph) * 0.35 + (g.sp > 0 ? -0.2 : 0.2));
        D2.scale.setScalar(g.s); D2.updateMatrix(); gulls.setMatrixAt(i, D2.matrix);
      }
      gulls.instanceMatrix.needsUpdate = true;
    });

    // Fluffy painted clouds.
    const cg = [];
    for (let k = 0; k < 6; k++) cg.push({ geo: new T.SphereGeometry(1, 10, 7), color: 0xffffff, bottom: 0xe2eefa, matrix: mat4((k - 2.5) * 1.1, Math.sin(k * 1.9) * 0.3, Math.cos(k * 2.3) * 0.3, 0, 0, 0, 1.15 - Math.abs(k - 2.5) * 0.14, 0.78, 0.9) });
    const clouds = [];
    for (let i = 0; i < 24; i++) {
      const a = rnd() * TAU, r = 300 + rnd() * 650, low = i < 8;
      clouds.push({ x: Math.cos(a) * r, y: low ? 70 + rnd() * 40 : 120 + rnd() * 100, z: Math.sin(a) * r, ry: rnd() * TAU, s: low ? 9 + rnd() * 8 : 9 + rnd() * 12 });
    }
    const cm = instanced(w, mergeSmooth(cg), w.mats.sceneryNoFog, clouds);
    cm.position.set(b.cx, 0, b.cz);
    w.updaters.push((dt) => { cm.rotation.y += dt * 0.004; });
  },

  song: {
    bpm: 124, style: 'story', lead: 'brass',
    chords: 'G Em C D G Em Am D C G Am,D G Em C D G',
    melody: [
      'g5/4 b5/2 d6/2 g6/4 d6/4', 'e6/3 d6/1 b5/4 g5/4 b5/4', 'c6/4 e6/2 g6/2 e6/4 c6/4', 'd6/3 c6/1 a5/4 f#5/4 a5/4',
      'g5/4 b5/2 d6/2 g6/4 b6/4', 'a6/3 g6/1 e6/4 b5/4 e6/4', 'c6/4 a5/2 c6/2 e6/4 a5/4', 'f#5/4 a5/4 d6/4 -/4',
      'e6/4 c6/2 e6/2 g6/4 e6/4', 'd6/4 b5/2 d6/2 g6/4 d6/4', 'c6/4 e6/4 d6/4 f#6/4', 'g6/6 d6/2 b5/4 g5/4',
      'e6/4 g6/2 b6/2 g6/4 e6/4', 'c6/4 g5/4 e6/4 c6/4', 'a5/4 d6/4 f#6/4 a6/4', 'g6/12 -/4',
    ],
  },
  style: { kick: [0, 8, 10], snare: [4, 12], rim: [2, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.28, bass: [[0, 0], [4, 7], [8, 0], [12, 7], [14, 12]], bassLen: 2.5, comp: 'offbeat', level: 1 },

  chip: 'linear-gradient(160deg,#2f8fe0 0 40%,#f6c744 40% 68%,#d9472f 68% 100%)',

  strings: {
    en: { name: 'Storybook Harbour', sub: 'Yellow sails and a lighthouse' },
    nl: { name: 'Prentenboekhaven', sub: 'Gele zeilen en een vuurtoren' },
  },

  skins: {
    duck(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const g = mergeSmooth([
        { geo: new T.SphereGeometry(0.42, 10, 8), color: 0xffd21f, bottom: 0xe8b010, matrix: mat4(0, 0.4, 0, 0, 0, 0, 1, 0.9, 1.25) },
        { geo: new T.SphereGeometry(0.26, 8, 6), color: 0xffd21f, matrix: mat4(0, 0.85, 0.3) },
        { geo: new T.ConeGeometry(0.1, 0.25, 5).rotateX(Math.PI / 2), color: 0xff8a1f, matrix: mat4(0, 0.82, 0.6) },
        { geo: new T.SphereGeometry(0.05, 5, 4), color: 0x222222, matrix: mat4(0.12, 0.92, 0.5) },
        { geo: new T.SphereGeometry(0.05, 5, 4), color: 0x222222, matrix: mat4(-0.12, 0.92, 0.5) },
        { geo: new T.ConeGeometry(0.14, 0.3, 4).rotateX(-Math.PI / 2), color: 0xf0b010, matrix: mat4(0, 0.5, -0.55) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    barrel(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const body = new T.SphereGeometry(1, 12, 8); body.scale(0.8, 1, 1);
      const g = mergeSmooth([
        { geo: body, color: 0xb5773f, bottom: 0x8a5a30, matrix: mat4(0, 0, 0, 0, 0, 0) },
        { geo: new T.TorusGeometry(0.93, 0.08, 6, 20).rotateY(Math.PI / 2), color: 0x2a3a5a, matrix: mat4(0.35, 0, 0) },
        { geo: new T.TorusGeometry(0.93, 0.08, 6, 20).rotateY(Math.PI / 2), color: 0x2a3a5a, matrix: mat4(-0.35, 0, 0) },
        { geo: new T.TorusGeometry(0.5, 0.08, 6, 14).rotateY(Math.PI / 2), color: 0xe0452f, matrix: mat4(0.78, 0, 0) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    crate(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const g = mergeSmooth([
        { geo: new T.BoxGeometry(0.7, 0.7, 0.7), color: 0xd8a458, bottom: 0xb88438, matrix: mat4(0, 0.35, 0) },
        { geo: new T.BoxGeometry(0.74, 0.12, 0.74), color: 0xe0452f, matrix: mat4(0, 0.35, 0) },
        { geo: new T.BoxGeometry(0.12, 0.74, 0.74), color: 0xe0452f, matrix: mat4(0, 0.35, 0) },
      ]);
      return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    },
    tram(kit) {
      const { mergeSmooth, mat4, THREE: T } = kit;
      const parts = [
        { geo: new T.BoxGeometry(1.1, 0.9, 2.0), color: 0xf5c542, bottom: 0xd9a020, matrix: mat4(0, 0.75, 0) },
        { geo: new T.BoxGeometry(1.2, 0.18, 2.1), color: 0x2f62b0, matrix: mat4(0, 1.3, 0) },
        { geo: new T.BoxGeometry(1.14, 0.2, 2.04), color: 0xe0452f, matrix: mat4(0, 0.38, 0) },
        { geo: new T.BoxGeometry(0.05, 0.5, 0.06), color: 0x333333, matrix: mat4(0, 1.6, -0.5) },
      ];
      for (const z of [-0.6, 0, 0.6]) for (const sx of [-1, 1]) parts.push({ geo: new T.BoxGeometry(0.04, 0.34, 0.34), color: 0x9fd8ff, matrix: mat4(sx * 0.56, 0.95, z) });
      for (const z of [-0.65, 0.65]) for (const sx of [-1, 1]) parts.push({ geo: new T.CylinderGeometry(0.2, 0.2, 0.12, 8).rotateZ(Math.PI / 2), color: 0x222a3a, matrix: mat4(sx * 0.52, 0.2, z) });
      return new T.Mesh(mergeSmooth(parts), new T.MeshLambertMaterial({ vertexColors: true }));
    },
  },
};
