// Track layouts + the Track class (a closed spline sampled every ~2 metres).
import * as THREE from 'three';
import { angleDiff, clamp } from './util.js';

// Control points are [x, z, height]. The first point sits in the middle of the
// start straight, and the track runs in the direction of the second point.
export const TRACKS = [
  {
    id: 'meadow',
    seed: 11,
    scale: 0.86,
    width: 19,
    points: [
      [0, 170, 0], [110, 170, 0], [205, 140, 1], [250, 60, 4], [225, -30, 8],
      [150, -75, 10], [80, -125, 8], [-10, -165, 4], [-110, -150, 2], [-170, -90, 3],
      [-150, -15, 6], [-200, 45, 6], [-235, 110, 3], [-190, 165, 1], [-100, 172, 0],
    ],
    itemRows: [0.13, 0.4, 0.63, 0.86],
    boostPads: [[0.27, 0], [0.52, -3], [0.76, 3]],
  },
  {
    id: 'canyon',
    seed: 23,
    scale: 0.76,
    width: 18,
    points: [
      [0, 150, 0], [100, 150, 0], [190, 125, 3], [235, 50, 8], [200, -20, 12],
      [120, -30, 14], [70, 30, 12], [10, 50, 9], [-40, 0, 8], [-20, -80, 12],
      [50, -130, 16], [30, -200, 18], [-60, -220, 14], [-150, -180, 9], [-190, -100, 5],
      [-160, -20, 3], [-210, 50, 2], [-190, 125, 0], [-100, 150, 0],
    ],
    itemRows: [0.1, 0.33, 0.57, 0.8],
    boostPads: [[0.2, 0], [0.47, 2], [0.7, -2], [0.93, 0]],
  },
  {
    id: 'island',
    seed: 37,
    scale: 0.8,
    width: 19,
    points: [
      [-40, 215, 2], [60, 220, 2], [150, 190, 2], [215, 120, 3], [235, 30, 6],
      [200, -50, 12], [130, -95, 18], [110, -165, 14], [40, -210, 8], [-50, -200, 4],
      [-110, -150, 2], [-140, -80, 1.6], [-215, -40, 1.6], [-250, 40, 1.6], [-215, 120, 2],
      [-140, 180, 2],
    ],
    itemRows: [0.12, 0.36, 0.6, 0.84],
    boostPads: [[0.24, 0], [0.5, 0], [0.74, -3]],
  },
  {
    id: 'snow',
    seed: 51,
    scale: 0.7,
    width: 18,
    points: [
      [0, 160, 0], [110, 160, 0], [200, 120, 4], [220, 30, 12], [160, -30, 18],
      [190, -110, 26], [130, -180, 32], [40, -170, 30], [-10, -100, 24], [40, -30, 18],
      [0, 40, 12], [-80, 20, 10], [-110, -60, 14], [-90, -150, 18], [-170, -190, 16],
      [-240, -120, 10], [-220, -20, 6], [-250, 70, 3], [-190, 140, 1], [-100, 160, 0],
    ],
    itemRows: [0.09, 0.3, 0.52, 0.72, 0.9],
    boostPads: [[0.18, 0], [0.42, 2], [0.63, -2], [0.83, 0]],
  },
];

export function trackById(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

const HASH = 40; // spatial hash cell size (metres)

export class Track {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.halfWidth = def.width / 2;
    this.curb = 1.1;
    this.limit = this.halfWidth + 7; // how far karts may stray from the centre line
    const sc = def.scale || 1;
    const pts = def.points.map((p) => new THREE.Vector3(p[0] * sc, p[2] || 0, p[1] * sc));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    curve.arcLengthDivisions = 3000;
    const len = curve.getLength();
    const n = Math.round(len / 2);
    const sp = curve.getSpacedPoints(n);
    this.n = n;
    this.length = len;
    this.seg = len / n;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.tx = new Float32Array(n); this.tz = new Float32Array(n);
    this.rx = new Float32Array(n); this.rz = new Float32Array(n);
    this.heading = new Float32Array(n);
    this.curv = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.px[i] = sp[i].x; this.py[i] = sp[i].y; this.pz[i] = sp[i].z; }
    // Light smoothing of heights so crests stay gentle.
    for (let pass = 0; pass < 6; pass++) {
      const c = Float32Array.from(this.py);
      for (let i = 0; i < n; i++) {
        this.py[i] = (c[(i - 1 + n) % n] + c[i] * 2 + c[(i + 1) % n]) / 4;
      }
    }
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      this.rx[i] = -dz; this.rz[i] = dx; // right-hand side of the road
      this.heading[i] = Math.atan2(dx, dz);
    }
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      raw[i] = angleDiff(this.heading[a], this.heading[b]) / (2 * this.seg);
    }
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += raw[(i + k + n) % n];
      this.curv[i] = s / 7;
    }
    // Bounds + spatial hash for "where is the nearest bit of road" queries.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    this.hash = new Map();
    for (let i = 0; i < n; i++) {
      const k = this._key(Math.floor(this.px[i] / HASH), Math.floor(this.pz[i] / HASH));
      let arr = this.hash.get(k);
      if (!arr) { arr = []; this.hash.set(k, arr); }
      arr.push(i);
    }
  }

  _key(cx, cz) { return (cx + 512) * 4096 + (cz + 512); }

  wrap(i) { const n = this.n; return ((i % n) + n) % n; }

  // Nearest sample anywhere on the track (within ~80 m). Returns index or -1.
  nearestIndex(x, z) {
    const cx = Math.floor(x / HASH), cz = Math.floor(z / HASH);
    let best = -1, bd = Infinity;
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const arr = this.hash.get(this._key(ix, iz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const i = arr[k];
          const dx = x - this.px[i], dz = z - this.pz[i];
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    return best;
  }

  // Distance to the centre line and the road height there. out = {d, y, i}
  distInfo(x, z, out) {
    const i = this.nearestIndex(x, z);
    if (i < 0) { out.d = 1e9; out.y = 0; out.i = -1; return out; }
    this.locate(x, z, i, out);
    out.d = Math.abs(out.lat);
    // Past the ends of the local segment the perpendicular distance lies; use the true distance.
    const dx = x - this.px[i], dz = z - this.pz[i];
    const dd = Math.hypot(dx, dz);
    if (dd > out.d + 3) out.d = dd;
    return out;
  }

  // Track coordinates of a point, searching near a previous index.
  // out = { i, f, s, lat, y }  (s = fractional sample index)
  locate(x, z, hint, out) {
    const n = this.n;
    let best = hint, bd = Infinity;
    if (hint < 0 || hint === undefined) {
      best = this.nearestIndex(x, z);
      if (best < 0) {
        for (let i = 0; i < n; i++) {
          const dx = x - this.px[i], dz = z - this.pz[i];
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = i; }
        }
      }
    } else {
      for (let k = -10; k <= 10; k++) {
        const i = this.wrap(hint + k);
        const dx = x - this.px[i], dz = z - this.pz[i];
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    const i = best;
    const dx = x - this.px[i], dz = z - this.pz[i];
    let f = (dx * this.tx[i] + dz * this.tz[i]) / this.seg;
    f = clamp(f, -1, 1);
    const j = this.wrap(i + (f >= 0 ? 1 : -1));
    const af = Math.abs(f);
    out.i = i;
    out.f = f;
    out.s = i + f;
    out.lat = dx * this.rx[i] + dz * this.rz[i];
    out.y = this.py[i] + (this.py[j] - this.py[i]) * af;
    return out;
  }

  // World position for a fractional sample index and a sideways offset.
  posAt(s, lat, out) {
    const n = this.n;
    const i0 = this.wrap(Math.floor(s));
    const i1 = (i0 + 1) % n;
    const f = s - Math.floor(s);
    const x = this.px[i0] + (this.px[i1] - this.px[i0]) * f;
    const z = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * f;
    const y = this.py[i0] + (this.py[i1] - this.py[i0]) * f;
    const rx = this.rx[i0] + (this.rx[i1] - this.rx[i0]) * f;
    const rz = this.rz[i0] + (this.rz[i1] - this.rz[i0]) * f;
    out.set(x + rx * lat, y, z + rz * lat);
    return out;
  }

  headingAt(s) {
    const i0 = this.wrap(Math.floor(s));
    const i1 = (i0 + 1) % this.n;
    const f = s - Math.floor(s);
    return this.heading[i0] + angleDiff(this.heading[i0], this.heading[i1]) * f;
  }

  // Largest absolute curvature in the next `metres` of road.
  maxCurvAhead(i, metres) {
    const steps = Math.ceil(metres / this.seg);
    let m = 0;
    for (let k = 0; k <= steps; k += 2) {
      const c = Math.abs(this.curv[this.wrap(i + k)]);
      if (c > m) m = c;
    }
    return m;
  }
}
