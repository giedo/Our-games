// Small math + helper toolbox shared by every module.
import * as THREE from '../vendor/three.module.min.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Frame-rate independent exponential smoothing.
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
// Shortest signed difference b - a, wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Deterministic random numbers so every track looks the same on every device.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D gradient noise in roughly [-1, 1].
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rnd() * TAU;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g00 = perm[X + perm[Y]], g10 = perm[X + 1 + perm[Y]];
    const g01 = perm[X + perm[Y + 1]], g11 = perm[X + 1 + perm[Y + 1]];
    const n00 = gx[g00] * xf + gy[g00] * yf;
    const n10 = gx[g10] * (xf - 1) + gy[g10] * yf;
    const n01 = gx[g01] * xf + gy[g01] * (yf - 1);
    const n11 = gx[g11] * (xf - 1) + gy[g11] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.5;
  }
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * f, y * f);
      norm += amp; amp *= gain; f *= lac;
    }
    return sum / norm;
  }
  return { noise, fbm };
}

export const col = (hex) => new THREE.Color(hex);

// Merge several geometries into one flat-shaded, vertex-coloured geometry.
// parts: [{ geo, color, matrix? }]. Each part is consumed (disposed).
export function mergeColored(parts) {
  let count = 0;
  const prepared = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (p.matrix) g.applyMatrix4(p.matrix);
    count += g.attributes.position.count;
    return { g, color: p.color instanceof THREE.Color ? p.color : new THREE.Color(p.color), src: p.geo };
  });
  const pos = new Float32Array(count * 3);
  const colr = new Float32Array(count * 3);
  let o = 0;
  for (const { g, color, src } of prepared) {
    const a = g.attributes.position.array;
    pos.set(a, o * 3);
    const n = g.attributes.position.count;
    const ca = g.attributes.color ? g.attributes.color.array : null;
    for (let i = 0; i < n; i++) {
      colr[(o + i) * 3] = ca ? ca[i * 3] : color.r;
      colr[(o + i) * 3 + 1] = ca ? ca[i * 3 + 1] : color.g;
      colr[(o + i) * 3 + 2] = ca ? ca[i * 3 + 2] : color.b;
    }
    o += n;
    g.dispose();
    if (src !== g) src.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  out.computeVertexNormals();
  return out;
}

export function mat4(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  return m;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = false, mip = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.generateMipmaps = mip;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

export function formatTime(sec) {
  if (!isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture && !v.userData.shared) v.dispose();
        }
        if (m.uniforms) {
          for (const k in m.uniforms) {
            const v = m.uniforms[k].value;
            if (v && v.isTexture && !v.userData.shared) v.dispose();
          }
        }
        m.dispose();
      }
    }
  });
}
