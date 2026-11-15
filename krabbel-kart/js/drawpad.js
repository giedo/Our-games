// A small painting pad so racers can be drawn right on the iPad or with a mouse.
import { h, ICON } from './dom.js';
import { makeCanvas } from './util.js';
import { t } from './i18n.js';

const COLORS = ['#2a2433', '#ffffff', '#ff4b4b', '#ff8a1f', '#ffd21f', '#5fd048', '#1fa85a', '#3fb8ff', '#2f5fe0', '#9a5cff', '#ff7ac0', '#a86a3a', '#9aa3b5', '#ffd9b3'];
const SIZES = [7, 16, 34];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Paint-bucket fill. The filled area is grown slightly and painted *behind*
// the existing strokes, so no pale halo is left next to outlines.
function bucket(canvas, sx, sy, hex) {
  const W = canvas.width, H = canvas.height, g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const s = (sy * W + sx) * 4;
  const tr = d[s], tg = d[s + 1], tb = d[s + 2], ta = d[s + 3];
  const [fr, fg, fb] = hexToRgb(hex);
  if (ta > 200 && Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 12) return false;
  const match = (i) => {
    const a = d[i * 4 + 3];
    if (ta < 40) return a < 110;
    return a > 110 && Math.abs(d[i * 4] - tr) + Math.abs(d[i * 4 + 1] - tg) + Math.abs(d[i * 4 + 2] - tb) < 90;
  };
  const mask = new Uint8Array(W * H), stack = new Int32Array(W * H);
  let sp = 0;
  stack[sp++] = sy * W + sx; mask[sy * W + sx] = 1;
  while (sp > 0) {
    const i = stack[--sp], x = i % W, y = (i / W) | 0;
    if (x > 0 && !mask[i - 1] && match(i - 1)) { mask[i - 1] = 1; stack[sp++] = i - 1; }
    if (x < W - 1 && !mask[i + 1] && match(i + 1)) { mask[i + 1] = 1; stack[sp++] = i + 1; }
    if (y > 0 && !mask[i - W] && match(i - W)) { mask[i - W] = 1; stack[sp++] = i - W; }
    if (y < H - 1 && !mask[i + W] && match(i + W)) { mask[i + W] = 1; stack[sp++] = i + W; }
  }
  // Clear what was there, then lay the grown fill underneath.
  for (let i = 0; i < W * H; i++) if (mask[i]) d[i * 4 + 3] = 0;
  g.putImageData(img, 0, 0);
  const under = makeCanvas(W, H), ug = under.getContext('2d');
  const uimg = ug.createImageData(W, H), u = uimg.data;
  const R = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let on = mask[y * W + x];
    for (let dy = -R; dy <= R && !on; dy++) for (let dx = -R; dx <= R && !on; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) on = 1;
    }
    if (on) { const k = (y * W + x) * 4; u[k] = fr; u[k + 1] = fg; u[k + 2] = fb; u[k + 3] = 255; }
  }
  ug.putImageData(uimg, 0, 0);
  g.save(); g.globalCompositeOperation = 'destination-over'; g.drawImage(under, 0, 0); g.restore();
  return true;
}

/** Opens the pad. Resolves with a transparent-background canvas, or null when cancelled. */
export function openDrawPad(root, kind) {
  return new Promise((resolve) => {
    const W = kind === 'vehicle' ? 840 : 660, H = kind === 'vehicle' ? 560 : 660;
    const canvas = makeCanvas(W, H);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.lineCap = 'round'; g.lineJoin = 'round';
    let color = COLORS[0], size = SIZES[1], tool = 'brush', dirty = false;
    const undo = [];
    const snap = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 12) undo.shift(); };

    const swatches = COLORS.map((c) => h('button', { class: 'sw', style: { background: c }, 'aria-label': c, onclick: () => { color = c; if (tool === 'eraser') tool = 'brush'; refresh(); } }));
    const sizeBtns = SIZES.map((s, i) => h('button', { class: 'tool sz', onclick: () => { size = s; refresh(); } }, h('i', { style: { width: `${8 + i * 9}px`, height: `${8 + i * 9}px` } })));
    const toolBtn = (name, icon, label) => h('button', { class: 'tool', 'data-tool': name, onclick: () => { tool = name; refresh(); } }, h('span', { html: icon }), h('small', null, label));
    const tools = [toolBtn('brush', ICON.brush, t('brush')), toolBtn('fill', ICON.fill, t('fill')), toolBtn('eraser', ICON.eraser, t('eraser'))];
    const undoBtn = h('button', { class: 'tool', onclick: () => { const u = undo.pop(); if (u) g.putImageData(u, 0, 0); } }, h('span', { html: ICON.undo }), h('small', null, t('undo')));
    const clearBtn = h('button', { class: 'tool', onclick: () => { snap(); g.clearRect(0, 0, W, H); } }, h('span', { html: ICON.trash }), h('small', null, t('clear')));
    function refresh() {
      swatches.forEach((b, i) => b.classList.toggle('on', COLORS[i] === color && tool !== 'eraser'));
      sizeBtns.forEach((b, i) => b.classList.toggle('on', SIZES[i] === size));
      tools.forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    }

    const paper = h('div', { class: `pad-paper ${kind}` }, canvas,
      kind === 'vehicle' ? h('div', { class: 'pad-front' }, `${t('frontHint')} →`) : null);
    const done = (ok) => { el.remove(); resolve(ok && dirty ? canvas : null); };
    const el = h('div', { class: 'sheet pad' },
      h('div', { class: 'pad-top' },
        h('button', { class: 'btn ghost', onclick: () => done(false) }, h('span', { html: ICON.close }), t('cancel')),
        h('div', { class: 'pad-tip' }, t(kind === 'vehicle' ? 'tipVehicle' : 'tipDriver')),
        h('button', { class: 'btn go', onclick: () => done(true) }, h('span', { html: ICON.check }), t('done'))),
      h('div', { class: 'pad-main' },
        h('div', { class: 'pad-colors' }, swatches),
        paper,
        h('div', { class: 'pad-tools' }, tools, h('div', { class: 'pad-sizes' }, sizeBtns), undoBtn, clearBtn)));
    root.appendChild(el);
    refresh();

    let active = null, last = null;
    const pt = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5 };
    };
    const seg = (a, b) => {
      g.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      g.strokeStyle = color;
      g.lineWidth = size * (tool === 'eraser' ? 1.6 : 0.55 + b.p * 0.9);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.globalCompositeOperation = 'source-over';
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = pt(e);
      snap(); dirty = true;
      if (tool === 'fill') { bucket(canvas, Math.max(0, Math.min(W - 1, Math.round(p.x))), Math.max(0, Math.min(H - 1, Math.round(p.y))), color); return; }
      canvas.setPointerCapture(e.pointerId);
      active = e.pointerId; last = p;
      seg(p, { x: p.x + 0.01, y: p.y + 0.01, p: p.p });
    });
    canvas.addEventListener('pointermove', (e) => {
      if (active !== e.pointerId) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) { const p = pt(ev); seg(last, p); last = p; }
    });
    const up = (e) => { if (active === e.pointerId) active = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  });
}
