// Cuts a drawing out of a photo of paper.
//
// How it works, in plain steps:
//  1. Estimate the paper colour everywhere (in tiles), so shadows and warm
//     lamp light are divided away and the paper becomes clean white.
//  2. Anything clearly darker or more colourful than paper counts as "ink".
//  3. Flood-fill the paper from the edges of the picture. Paper that is fully
//     enclosed by ink (the white belly of an outlined character) is kept.
//  4. Throw away tiny specks, soften the edge, crop.
// Drawings that already have a transparent background skip steps 1-2.
import { makeCanvas } from './util.js';

const WORK_MAX = 480;
export const OUT_MAX = 320;

/** Analyse the source once. Returns data reused by extract(). */
export function prepare(src, crop) {
  const cx = crop ? crop.x : 0, cy = crop ? crop.y : 0;
  const cw = crop ? crop.w : src.width, ch = crop ? crop.h : src.height;
  const sc = Math.min(1, WORK_MAX / Math.max(cw, ch));
  const W = Math.max(8, Math.round(cw * sc)), H = Math.max(8, Math.round(ch * sc));
  const work = makeCanvas(W, H);
  const g = work.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const N = W * H;
  let transparent = 0;
  for (let i = 0; i < N; i++) if (d[i * 4 + 3] < 200) transparent++;
  const hasAlpha = transparent > N * 0.02;
  const dark = new Float32Array(N);       // 0 = paper, 1 = very dark / colourful
  const out = new Uint8ClampedArray(N * 3); // cleaned-up colours
  if (hasAlpha) {
    for (let i = 0; i < N; i++) {
      const a = d[i * 4 + 3];
      dark[i] = a / 255;
      if (a > 60) { out[i * 3] = d[i * 4]; out[i * 3 + 1] = d[i * 4 + 1]; out[i * 3 + 2] = d[i * 4 + 2]; }
      else { out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = 255; }
    }
    return { W, H, N, dark, out, hasAlpha, scale: cw / W };
  }

  // --- paper colour, globally: average of the brightest pixels ---
  const lum = new Float32Array(N);
  const hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) {
    const l = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    lum[i] = l; hist[l | 0]++;
  }
  const pct = (h, total, p) => {
    let acc = 0;
    for (let v = 255; v >= 0; v--) { acc += h[v]; if (acc >= total * (1 - p)) return v; }
    return 0;
  };
  const Lg = pct(hist, N, 0.85);
  let gr = 0, gg = 0, gb = 0, gn = 0;
  for (let i = 0; i < N; i++) {
    if (lum[i] >= Lg - 4) { gr += d[i * 4]; gg += d[i * 4 + 1]; gb += d[i * 4 + 2]; gn++; }
  }
  gr /= gn; gg /= gn; gb /= gn;
  const gl = 0.299 * gr + 0.587 * gg + 0.114 * gb || 1;
  const gcr = gr / gl, gcg = gg / gl, gcb = gb / gl;

  // --- paper colour, per tile (handles shadows and uneven light) ---
  const TS = Math.max(8, Math.round(Math.max(W, H) / 16));
  const tw = Math.ceil(W / TS), th = Math.ceil(H / TS);
  const tr = new Float32Array(tw * th), tg = new Float32Array(tw * th), tb = new Float32Array(tw * th);
  const ok = new Uint8Array(tw * th);
  const h2 = new Uint32Array(256);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    h2.fill(0);
    const x0 = tx * TS, y0 = ty * TS, x1 = Math.min(W, x0 + TS), y1 = Math.min(H, y0 + TS);
    let cnt = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { h2[lum[y * W + x] | 0]++; cnt++; }
    const Lt = pct(h2, cnt, 0.75);
    let r = 0, gg2 = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      if (lum[i] >= Lt - 3) { r += d[i * 4]; gg2 += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; }
    }
    r /= n; gg2 /= n; b /= n;
    const l = 0.299 * r + 0.587 * gg2 + 0.114 * b || 1;
    const k = ty * tw + tx;
    const chroma = Math.max(Math.abs(r / l - gcr), Math.abs(gg2 / l - gcg), Math.abs(b / l - gcb));
    if (l >= gl * 0.5 && chroma < 0.09) { ok[k] = 1; tr[k] = r; tg[k] = gg2; tb[k] = b; }
  }
  // Fill tiles that had no visible paper from their neighbours.
  for (let pass = 0; pass < tw + th; pass++) {
    let changed = false;
    const add = [];
    for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
      const k = ty * tw + tx;
      if (ok[k]) continue;
      let r = 0, g2 = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = tx + dx, yy = ty + dy;
        if (xx < 0 || yy < 0 || xx >= tw || yy >= th) continue;
        const j = yy * tw + xx;
        if (ok[j]) { r += tr[j]; g2 += tg[j]; b += tb[j]; n++; }
      }
      if (n) add.push(k, r / n, g2 / n, b / n);
    }
    for (let q = 0; q < add.length; q += 4) { const k = add[q]; tr[k] = add[q + 1]; tg[k] = add[q + 2]; tb[k] = add[q + 3]; ok[k] = 1; changed = true; }
    if (!changed) break;
  }
  for (let k = 0; k < tw * th; k++) if (!ok[k]) { tr[k] = gr; tg[k] = gg; tb[k] = gb; }

  // --- normalise every pixel by the paper colour at that spot ---
  for (let y = 0; y < H; y++) {
    const fy = Math.max(0, Math.min(th - 1, (y + 0.5) / TS - 0.5));
    const ty0 = Math.floor(fy), ty1 = Math.min(th - 1, ty0 + 1), wy = fy - ty0;
    for (let x = 0; x < W; x++) {
      const fx = Math.max(0, Math.min(tw - 1, (x + 0.5) / TS - 0.5));
      const tx0 = Math.floor(fx), tx1 = Math.min(tw - 1, tx0 + 1), wx = fx - tx0;
      const a = ty0 * tw + tx0, b = ty0 * tw + tx1, c = ty1 * tw + tx0, e = ty1 * tw + tx1;
      const pr = (tr[a] * (1 - wx) + tr[b] * wx) * (1 - wy) + (tr[c] * (1 - wx) + tr[e] * wx) * wy;
      const pg = (tg[a] * (1 - wx) + tg[b] * wx) * (1 - wy) + (tg[c] * (1 - wx) + tg[e] * wx) * wy;
      const pb = (tb[a] * (1 - wx) + tb[b] * wx) * (1 - wy) + (tb[c] * (1 - wx) + tb[e] * wx) * wy;
      const i = y * W + x;
      let nr = Math.min(1, d[i * 4] / pr), ng = Math.min(1, d[i * 4 + 1] / pg), nb = Math.min(1, d[i * 4 + 2] / pb);
      dark[i] = 1 - Math.min(nr, ng, nb);
      // A little extra punch so crayon colours pop in the game.
      const l = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      nr = l + (nr - l) * 1.18; ng = l + (ng - l) * 1.18; nb = l + (nb - l) * 1.18;
      out[i * 3] = Math.pow(Math.max(0, nr), 1.12) * 255;
      out[i * 3 + 1] = Math.pow(Math.max(0, ng), 1.12) * 255;
      out[i * 3 + 2] = Math.pow(Math.max(0, nb), 1.12) * 255;
    }
  }
  return { W, H, N, dark, out, hasAlpha, scale: cw / W };
}

function dilate(mask, W, H, r) {
  // Separable box dilation.
  const tmp = new Uint8Array(W * H), res = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < W && mask[y * W + xx]) v = 1; }
    tmp[y * W + x] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1; }
    res[y * W + x] = v;
  }
  return res;
}

function erode(mask, W, H, r) {
  const inv = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, W, H, r);
  for (let i = 0; i < W * H; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

/**
 * @param prep       result of prepare()
 * @param threshold  0.05 (keep faint pencil) ... 0.45 (only bold marker)
 * @param erase      optional Uint8Array(W*H): 1 = rubbed out by hand
 * @returns { full: canvas (W x H, transparent bg), canvas: cropped cut-out or null, count, bbox }
 */
export function extract(prep, threshold = 0.15, erase = null) {
  const { W, H, N, dark, out, hasAlpha } = prep;
  const thr = hasAlpha ? 0.25 : threshold;
  let ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) ink[i] = dark[i] > thr ? 1 : 0;
  const r = Math.max(1, Math.round(Math.max(W, H) / 220));
  const rawInk = ink;
  if (!hasAlpha) ink = dilate(ink, W, H, r);

  // Is something that is not paper lying along the edges (a table, a desk)?
  // A long stretch of "ink" hugging an edge is treated as table, not as drawing.
  const tableSeed = new Uint8Array(N);
  let table = false;
  if (!hasAlpha) {
    const sides = [[], [], [], []];
    for (let x = 0; x < W; x++) { sides[0].push(x); sides[1].push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { sides[2].push(y * W); sides[3].push(y * W + W - 1); }
    let total = 0, totalInk = 0;
    for (const side of sides) {
      let n = 0, run = 0;
      const minRun = side.length * 0.25;
      for (let k = 0; k <= side.length; k++) {
        const on = k < side.length && ink[side[k]];
        if (on) { n++; run++; }
        else { if (run >= minRun) for (let q = k - run; q < k; q++) tableSeed[side[q]] = 1; run = 0; }
      }
      if (n / side.length >= 0.45) for (const i of side) if (ink[i]) tableSeed[i] = 1;
      total += side.length; totalInk += n;
    }
    if (totalInk / total > 0.35) {
      for (const side of sides) for (const i of side) if (ink[i]) tableSeed[i] = 1;
    }
    for (let i = 0; i < N && !table; i++) if (tableSeed[i]) table = true;
  }

  // Flood from the edges. label: 0 = keep, 1 = table, 2 = paper background.
  const label = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const seed = (i) => {
    if (label[i]) return;
    if (ink[i]) { if (tableSeed[i]) { label[i] = 1; stack[sp++] = i; } }
    else { label[i] = 2; stack[sp++] = i; }
  };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % W, y = (i / W) | 0, li = label[i];
    for (let k = 0; k < 4; k++) {
      const xx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), yy = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (label[j]) continue;
      if (li === 1) { label[j] = ink[j] ? 1 : 2; stack[sp++] = j; }
      else if (!ink[j]) { label[j] = 2; stack[sp++] = j; }
    }
  }
  let fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg[i] = label[i] === 0 ? 1 : 0;
  if (!hasAlpha) {
    // The gap-closing step fattened the outline; slim it back to a 1 px paper rim.
    const core = erode(fg, W, H, r);
    for (let i = 0; i < N; i++) core[i] = core[i] || (rawInk[i] && fg[i]) ? 1 : 0;
    const slim = dilate(core, W, H, 1);
    for (let i = 0; i < N; i++) fg[i] = slim[i] && fg[i] ? 1 : 0;
  }
  if (erase) for (let i = 0; i < N; i++) if (erase[i]) fg[i] = 0;

  // Keep the big pieces, drop specks.
  const comp = new Int32Array(N);
  const areas = [0];
  let nc = 0;
  for (let s = 0; s < N; s++) {
    if (!fg[s] || comp[s]) continue;
    nc++; comp[s] = nc; sp = 0; stack[sp++] = s;
    let area = 0;
    while (sp > 0) {
      const i = stack[--sp]; area++;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (fg[j] && !comp[j]) { comp[j] = nc; stack[sp++] = j; }
      }
    }
    areas.push(area);
  }
  let biggest = 0;
  for (let c = 1; c <= nc; c++) biggest = Math.max(biggest, areas[c]);
  const minArea = Math.max(30, biggest * 0.03);
  let count = 0;
  for (let i = 0; i < N; i++) { if (fg[i] && areas[comp[i]] < minArea) fg[i] = 0; else if (fg[i]) count++; }

  // Soft edge + write the picture.
  const full = makeCanvas(W, H);
  const fctx = full.getContext('2d');
  const img = fctx.createImageData(W, H), px = img.data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) { n++; continue; }
      s += fg[yy * W + xx]; n++;
    }
    const a = Math.max(0, Math.min(1, (s / n - 0.28) * 2.2));
    if (a <= 0) continue;
    px[i * 4] = out[i * 3]; px[i * 4 + 1] = out[i * 3 + 1]; px[i * 4 + 2] = out[i * 3 + 2]; px[i * 4 + 3] = a * 255;
    if (a > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  fctx.putImageData(img, 0, 0);
  if (x1 < 0 || count < 60) return { full, canvas: null, count: 0, bbox: null };
  const bbox = { x0, y0, x1, y1 };
  x0 = Math.max(0, x0 - 3); y0 = Math.max(0, y0 - 3); x1 = Math.min(W - 1, x1 + 3); y1 = Math.min(H - 1, y1 + 3);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const sc = Math.min(1, OUT_MAX / Math.max(bw, bh));
  const canvas = makeCanvas(Math.max(4, Math.round(bw * sc)), Math.max(4, Math.round(bh * sc)));
  const cg = canvas.getContext('2d');
  cg.imageSmoothingQuality = 'high';
  cg.drawImage(full, x0, y0, bw, bh, 0, 0, canvas.width, canvas.height);
  return { full, canvas, count, bbox };
}
