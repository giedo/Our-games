// Turns a flat cut-out drawing into a real 3D object.
//  - 'pillow' mode inflates the drawing like a balloon (used for drivers).
//  - 'slab' mode extrudes it into a chunky toy with rounded edges (used for vehicles).
// The outline is traced with marching squares, so the mesh is watertight and
// the drawing is printed on both sides.
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvas, canvasTexture } from './util.js';

function distanceTransform(mask, w, h) {
  // Two-pass chamfer (3-4) distance to the nearest outside pixel, in pixels.
  const INF = 1e7;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
      d[i] = v;
    }
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

// Bleed the drawing's edge colours into the transparent area so texture
// filtering never drags in dark fringes at the silhouette.
function bleedTexture(src) {
  const w = src.width, h = src.height;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, h), px = img.data;
  const filled = new Uint8Array(w * h);
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] > 200) { filled[i] = 1; sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2]; sn++; }
  }
  for (let pass = 0; pass < 10; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (filled[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (filled[j]) { r += px[j * 4]; gg += px[j * 4 + 1]; b += px[j * 4 + 2]; n++; }
      }
      if (n) add.push(i, r / n, gg / n, b / n);
    }
    for (let k = 0; k < add.length; k += 4) {
      const i = add[k];
      px[i * 4] = add[k + 1]; px[i * 4 + 1] = add[k + 2]; px[i * 4 + 2] = add[k + 3];
      filled[i] = 1;
    }
  }
  const ar = sn ? sr / sn : 200, ag = sn ? sg / sn : 200, ab = sn ? sb / sn : 200;
  for (let i = 0; i < w * h; i++) {
    if (!filled[i]) { px[i * 4] = ar; px[i * 4 + 1] = ag; px[i * 4 + 2] = ab; }
    px[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, avg: [ar, ag, ab] };
}

/**
 * @param {HTMLCanvasElement} cut  RGBA cut-out (transparent background)
 * @param {object} o  { mode:'pillow'|'slab', grid, puff, maxT, halfW, bevel, rimFrac }
 *        Sizes are in "normalised" units where the longest image side = 1.
 * @returns {null | {geometry, texture, wn, hn, top(xFrac)}}
 */
export function buildPuffy(cut, o) {
  const w = cut.width, h = cut.height;
  if (w < 4 || h < 4) return null;
  const ctx = cut.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let i = 0; i < w * h; i++) { if (src[i * 4 + 3] > 127) { mask[i] = 1; count++; } }
  if (count < 30) return null;
  const dist = distanceTransform(mask, w, h);

  // Summed-area table of alpha for fast box averages.
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[(y * w + x) * 4 + 3] / 255;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const box = (x0, y0, x1, y1) => {
    const a = Math.max(0, Math.min(w, Math.round(x0))), b = Math.max(0, Math.min(w, Math.round(x1)));
    const c = Math.max(0, Math.min(h, Math.round(y0))), d = Math.max(0, Math.min(h, Math.round(y1)));
    return sat[d * (w + 1) + b] - sat[c * (w + 1) + b] - sat[d * (w + 1) + a] + sat[c * (w + 1) + a];
  };
  const sampleDist = (x, y) => {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    return (dist[y0 * w + x0] * (1 - fx) + dist[y0 * w + x1] * fx) * (1 - fy) + (dist[y1 * w + x0] * (1 - fx) + dist[y1 * w + x1] * fx) * fy;
  };

  const G = o.grid || 64;
  const longest = Math.max(w, h);
  const u = 1 / longest;
  const cs = longest / G;
  const gw = Math.ceil(w / cs) + 2, gh = Math.ceil(h / cs) + 2;
  const nx = gw + 1, ny = gh + 1;
  const F = new Float32Array(nx * ny), D = new Float32Array(nx * ny);
  const iso = 0.42;
  let dmax = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = (i - 1) * cs, py = (j - 1) * cs;
    F[j * nx + i] = box(px - cs / 2, py - cs / 2, px + cs / 2, py + cs / 2) / (cs * cs);
    const dd = sampleDist(px, py) * u;
    D[j * nx + i] = dd;
    if (dd > dmax) dmax = dd;
  }

  const slab = o.mode === 'slab';
  const R = slab ? (o.bevel || 0.035) : Math.max(dmax * 0.95, 0.01);
  const T = slab ? o.halfW : Math.min((o.puff || 0.8) * R, o.maxT || 0.2);
  const rimFrac = slab ? (o.rimFrac || 0.8) : 0;
  const thick = (dn) => {
    const t = Math.min(dn / R, 1);
    const dome = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    return T * (rimFrac + (1 - rimFrac) * dome);
  };

  const pos = [], uv = [], colr = [];
  const faceIdx = [], rimIdx = [];
  const addVert = (px, py, z) => {
    pos.push((px - w / 2) * u, (h - py) * u, z);
    uv.push(px / w, 1 - py / h);
    colr.push(1, 1, 1);
    return pos.length / 3 - 1;
  };
  // Corner vertices: front id, back id = front + 1.
  const cornerId = new Int32Array(nx * ny).fill(-1);
  const corner = (i, j) => {
    const k = j * nx + i;
    if (cornerId[k] < 0) {
      const px = (i - 1) * cs, py = (j - 1) * cs, z = thick(D[k]);
      cornerId[k] = addVert(px, py, z);
      addVert(px, py, -z);
    }
    return cornerId[k];
  };
  // Edge crossings: one vertex for pillows (z = 0), a front/back pair for slabs.
  const edgeId = new Map();
  const rimPts = []; // [vertexId, px, py] for colouring
  const cross = (i0, j0, i1, j1) => {
    const a = j0 * nx + i0, b = j1 * nx + i1;
    const key = a < b ? a * 131072 + b : b * 131072 + a;
    let id = edgeId.get(key);
    if (id === undefined) {
      const fa = F[a], fb = F[b];
      const t = Math.max(0.02, Math.min(0.98, (iso - fa) / (fb - fa || 1e-6)));
      const px = ((i0 - 1) + (i1 - i0) * t) * cs, py = ((j0 - 1) + (j1 - j0) * t) * cs;
      const z = T * rimFrac;
      id = addVert(px, py, z);
      if (slab) addVert(px, py, -z);
      rimPts.push(id, px, py);
      edgeId.set(key, id);
    }
    return id;
  };

  const poly = [], isCross = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const cx = [i, i + 1, i + 1, i], cy = [j, j, j + 1, j + 1];
    const ins = [0, 0, 0, 0];
    let any = 0;
    for (let k = 0; k < 4; k++) { ins[k] = F[cy[k] * nx + cx[k]] >= iso ? 1 : 0; any += ins[k]; }
    if (!any) continue;
    poly.length = 0; isCross.length = 0;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) & 3;
      if (ins[k]) { poly.push(corner(cx[k], cy[k])); isCross.push(0); }
      if (ins[k] !== ins[k2]) { poly.push(cross(cx[k], cy[k], cx[k2], cy[k2])); isCross.push(1); }
    }
    const back = (id, c) => (c ? (slab ? id + 1 : id) : id + 1);
    for (let k = 1; k < poly.length - 1; k++) {
      // Pixel space has y pointing down, so the walk order is clockwise seen from the front.
      faceIdx.push(poly[0], poly[k + 1], poly[k]);
      faceIdx.push(back(poly[0], isCross[0]), back(poly[k], isCross[k]), back(poly[k + 1], isCross[k + 1]));
    }
    if (slab) {
      // Close the side wall along the outline segment(s) of this cell.
      let mx = 0, my = 0;
      for (const id of poly) { mx += pos[id * 3]; my += pos[id * 3 + 1]; }
      mx /= poly.length; my /= poly.length;
      for (let k = 0; k < poly.length; k++) {
        const k2 = (k + 1) % poly.length;
        if (!(isCross[k] && isCross[k2])) continue;
        const f1 = poly[k], f2 = poly[k2], b1 = f1 + 1, b2 = f2 + 1;
        const ex = pos[f2 * 3] - pos[f1 * 3], ey = pos[f2 * 3 + 1] - pos[f1 * 3 + 1];
        // Normal of (f1, f2, b1) is (e) x (0,0,-1) = (-ey, ex, 0).
        const ox = (pos[f1 * 3] + pos[f2 * 3]) / 2 - mx, oy = (pos[f1 * 3 + 1] + pos[f2 * 3 + 1]) / 2 - my;
        if (-ey * ox + ex * oy >= 0) rimIdx.push(f1, f2, b1, f2, b2, b1);
        else rimIdx.push(f1, b1, f2, f2, b1, b2);
      }
    }
  }
  if (!faceIdx.length) return null;

  const bled = bleedTexture(cut);
  if (slab) {
    // Colour the side wall with the paint found just inside the outline.
    const inset = Math.max(3, longest * 0.05);
    for (let k = 0; k < rimPts.length; k += 3) {
      const id = rimPts[k], px = rimPts[k + 1], py = rimPts[k + 2];
      // Walk towards the inside along the distance field gradient.
      let gx = sampleDist(px + 2, py) - sampleDist(px - 2, py), gy = sampleDist(px, py + 2) - sampleDist(px, py - 2);
      const gl = Math.hypot(gx, gy) || 1;
      gx /= gl; gy /= gl;
      const sx = Math.round(px + gx * inset), sy = Math.round(py + gy * inset);
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = sx + dx, yy = sy + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 4;
        if (src[q + 3] > 200) { r += src[q]; g += src[q + 1]; b += src[q + 2]; n++; }
      }
      const c = new THREE.Color();
      if (n) c.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
      else c.setRGB(bled.avg[0] / 255, bled.avg[1] / 255, bled.avg[2] / 255, THREE.SRGBColorSpace);
      for (const v of [id, id + 1]) { colr[v * 3] = c.r; colr[v * 3 + 1] = c.g; colr[v * 3 + 2] = c.b; }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  geometry.setIndex(faceIdx.concat(rimIdx));
  geometry.addGroup(0, faceIdx.length, 0);
  if (rimIdx.length) geometry.addGroup(faceIdx.length, rimIdx.length, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  // Top outline (highest opaque pixel per column) so a driver can sit on a vehicle.
  const topPx = new Float32Array(w).fill(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) { if (mask[y * w + x]) { topPx[x] = y; break; } }
  }
  const top = (xFrac) => {
    const c = Math.round(xFrac * (w - 1));
    let best = h;
    const span = Math.max(2, Math.round(w * 0.06));
    for (let x = Math.max(0, c - span); x <= Math.min(w - 1, c + span); x++) best = Math.min(best, topPx[x]);
    return (h - best) * u;
  };

  const texture = canvasTexture(bled.canvas);
  return { geometry, texture, wn: w * u, hn: h * u, top, thickness: T };
}
