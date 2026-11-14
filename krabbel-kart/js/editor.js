// The drawing studio: photo (or drawing pad) in, playable sticker out.
import { h, ICON } from './dom.js';
import { makeCanvas } from './util.js';
import { prepare, extract } from './cutout.js';
import { openDrawPad } from './drawpad.js';
import { t } from './i18n.js';

async function fileToCanvas(file) {
  let src = null;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = null; }
  if (!src) {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  const w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight;
  const sc = Math.min(1, 1600 / Math.max(w, hh));
  const c = makeCanvas(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(hh * sc)));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return c;
}

function transformed(src, how) {
  const rot = how === 'rotate';
  const c = makeCanvas(rot ? src.height : src.width, rot ? src.width : src.height);
  const g = c.getContext('2d');
  if (rot) { g.translate(c.width, 0); g.rotate(Math.PI / 2); }
  else { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0);
  return c;
}

/**
 * Opens the studio for a 'driver' or 'vehicle'.
 * Resolves with the saved sticker, or null if the player backed out.
 */
export function openMaker(game, kind) {
  const root = game.overlayRoot;
  return new Promise((resolve) => {
    const sheet = h('div', { class: 'sheet maker' });
    root.appendChild(sheet);
    const close = (result) => { sheet.remove(); resolve(result); };

    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      try { showCut(await fileToCanvas(f)); } catch (e) { /* not an image */ }
    });

    function showChoice() {
      sheet.replaceChildren(
        fileInput,
        h('div', { class: 'maker-choice' },
          h('h2', null, t(kind === 'vehicle' ? 'newVehicle' : 'newDriver')),
          h('p', { class: 'tip' }, t(kind === 'vehicle' ? 'tipVehicle' : 'tipDriver')),
          h('div', { class: 'choice-row' },
            h('button', { class: 'card big', onclick: () => { game.audio.play('click'); fileInput.click(); } }, h('span', { class: 'ic', html: ICON.camera }), h('b', null, t('fromPhoto'))),
            h('button', { class: 'card big', onclick: async () => {
              game.audio.play('click');
              const c = await openDrawPad(root, kind);
              if (c) showCut(c);
            } }, h('span', { class: 'ic', html: ICON.brush }), h('b', null, t('drawHere')))),
          h('button', { class: 'btn ghost', onclick: () => { game.audio.play('back'); close(null); } }, h('span', { html: ICON.back }), t('back'))));
    }

    function showCut(source) {
      let src = source;
      let crop = { x: 0, y: 0, w: src.width, h: src.height }; // chosen by the player
      let zoom = crop;                                          // auto-tightened around the drawing
      let prep = null, result = null, erase = null, threshold = 0.15;
      let mode = 'cut', erasing = false, pending = false;
      const strokes = []; // eraser strokes, stored in photo pixels: { r, pts: [x, y, x, y, ...] }
      const view = h('canvas', { class: 'cut-view' });
      const vg = view.getContext('2d');
      const hint = h('div', { class: 'cut-hint' });
      const slider = h('input', { type: 'range', min: 5, max: 45, value: 15, class: 'slider', 'aria-label': t('paper') });
      const sliderWrap = h('label', { class: 'slider-wrap' }, h('span', null, t('paper')), slider);
      const nameInput = h('input', { type: 'text', class: 'name-input', maxLength: 14, placeholder: t('name'), value: '' });
      const saveBtn = h('button', { class: 'btn go', onclick: save }, h('span', { html: ICON.check }), t('save'));
      const tool = (icon, label, fn) => h('button', { class: 'tool', onclick: fn }, h('span', { html: icon }), h('small', null, label));
      const eraseBtn = tool(ICON.eraser, t('eraser'), () => { erasing = !erasing; eraseBtn.classList.toggle('on', erasing); view.classList.toggle('erasing', erasing); });
      const undoBtn = tool(ICON.undo, t('undo'), () => { if (strokes.length) { strokes.pop(); rasterise(); recompute(); } });
      const flipBtn = tool(ICON.flip, t('flip'), () => {
        const w = src.width;
        src = transformed(src, 'flip');
        crop = { x: w - crop.x - crop.w, y: crop.y, w: crop.w, h: crop.h };
        for (const st of strokes) for (let i = 0; i < st.pts.length; i += 2) st.pts[i] = w - st.pts[i];
        analyse();
      });
      const rotBtn = tool(ICON.rotate, t('rotate'), () => {
        const oh = src.height;
        src = transformed(src, 'rotate');
        crop = { x: oh - crop.y - crop.h, y: crop.x, w: crop.h, h: crop.w };
        for (const st of strokes) for (let i = 0; i < st.pts.length; i += 2) { const x = st.pts[i], y = st.pts[i + 1]; st.pts[i] = oh - y; st.pts[i + 1] = x; }
        analyse();
      });
      const cropBtn = tool(ICON.crop, t('crop'), () => setMode(mode === 'crop' ? 'cut' : 'crop'));
      const toolbar = h('div', { class: 'cut-tools' }, eraseBtn, undoBtn, flipBtn, rotBtn, cropBtn);

      sheet.replaceChildren(
        h('div', { class: 'cut-top' },
          h('button', { class: 'btn ghost', onclick: () => { game.audio.play('back'); showChoice(); } }, h('span', { html: ICON.back }), t('back')),
          h('h2', null, t(kind === 'vehicle' ? 'newVehicle' : 'newDriver')),
          h('div', { class: 'cut-save' }, nameInput, saveBtn)),
        h('div', { class: 'cut-stage' }, view, hint,
          kind === 'vehicle' ? h('div', { class: 'cut-front' }, `${t('frontHint')} →`) : null),
        h('div', { class: 'cut-bottom' }, sliderWrap, toolbar));

      slider.addEventListener('input', () => { threshold = Number(slider.value) / 100; recompute(); });
      slider.addEventListener('change', () => { threshold = Number(slider.value) / 100; analyse(); });

      // Look at the whole (cropped) photo first, then zoom in on the drawing for a sharper cut.
      function analyse() {
        let p = prepare(src, crop);
        zoom = crop;
        const first = extract(p, threshold, null);
        if (first.bbox) {
          const k = p.scale, b = first.bbox;
          const bx = crop.x + b.x0 * k, by = crop.y + b.y0 * k, bw = (b.x1 - b.x0 + 1) * k, bh = (b.y1 - b.y0 + 1) * k;
          const pad = Math.max(bw, bh) * 0.12 + 8;
          const x0 = Math.max(crop.x, bx - pad), y0 = Math.max(crop.y, by - pad);
          const x1 = Math.min(crop.x + crop.w, bx + bw + pad), y1 = Math.min(crop.y + crop.h, by + bh + pad);
          if ((x1 - x0) * (y1 - y0) < crop.w * crop.h * 0.72) {
            zoom = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
            p = prepare(src, zoom);
          }
        }
        prep = p;
        sliderWrap.style.visibility = prep.hasAlpha ? 'hidden' : 'visible';
        rasterise();
        recompute();
      }
      function rasterise() {
        if (!strokes.length) { erase = null; return; }
        const { W, H, scale } = prep;
        erase = new Uint8Array(W * H);
        for (const st of strokes) {
          const rad = st.r / scale;
          for (let i = 0; i < st.pts.length; i += 2) dab((st.pts[i] - zoom.x) / scale, (st.pts[i + 1] - zoom.y) / scale, rad);
        }
      }
      function dab(x, y, rad) {
        const { W, H } = prep;
        const x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(W - 1, Math.ceil(x + rad));
        const y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(H - 1, Math.ceil(y + rad));
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          if ((xx - x) * (xx - x) + (yy - y) * (yy - y) <= rad * rad) erase[yy * W + xx] = 1;
        }
      }
      function recompute() {
        result = extract(prep, threshold, erase);
        saveBtn.disabled = !result.canvas;
        hint.textContent = mode === 'crop' ? t('cropHint') : result.canvas ? '' : t('nothingFound');
        draw();
      }
      function setMode(m) {
        mode = m;
        cropBtn.classList.toggle('on', m === 'crop');
        for (const b of [eraseBtn, undoBtn, flipBtn, rotBtn]) b.disabled = m === 'crop';
        sliderWrap.style.opacity = m === 'crop' ? 0.3 : 1;
        if (m === 'cut') analyse(); else { hint.textContent = t('cropHint'); draw(); }
      }
      function draw() {
        if (mode === 'crop') {
          const sc = Math.min(1, 900 / Math.max(src.width, src.height));
          view.width = Math.round(src.width * sc); view.height = Math.round(src.height * sc);
          vg.drawImage(src, 0, 0, view.width, view.height);
          vg.fillStyle = 'rgba(20,16,40,0.6)';
          const x = crop.x * sc, y = crop.y * sc, w = crop.w * sc, hh = crop.h * sc;
          vg.fillRect(0, 0, view.width, y); vg.fillRect(0, y + hh, view.width, view.height - y - hh);
          vg.fillRect(0, y, x, hh); vg.fillRect(x + w, y, view.width - x - w, hh);
          vg.strokeStyle = '#ffe14a'; vg.lineWidth = 5; vg.strokeRect(x, y, w, hh);
          vg.fillStyle = '#ffe14a';
          for (const [cx, cy] of [[x, y], [x + w, y], [x, y + hh], [x + w, y + hh]]) { vg.beginPath(); vg.arc(cx, cy, 15, 0, 6.3); vg.fill(); }
          return;
        }
        const W = prep.W, H = prep.H, S = 2;
        view.width = W * S; view.height = H * S;
        // Checker backdrop so white parts of the drawing stay visible.
        const cell = 24;
        for (let y = 0; y < view.height; y += cell) for (let x = 0; x < view.width; x += cell) {
          vg.fillStyle = ((x / cell + y / cell) & 1) ? '#9ad9ff' : '#86cdf8';
          vg.fillRect(x, y, cell, cell);
        }
        vg.imageSmoothingEnabled = true;
        vg.drawImage(result.full, 0, 0, view.width, view.height);
      }

      // Pointer handling: eraser strokes in cut mode, corner dragging in crop mode.
      let drag = null;
      const toView = (e) => {
        const r = view.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * view.width, y: ((e.clientY - r.top) / r.height) * view.height, k: view.width / r.width };
      };
      const rub = (p) => {
        const st = strokes[strokes.length - 1];
        const wx = p.x / 2, wy = p.y / 2; // view is drawn at 2x the work size
        st.pts.push(zoom.x + wx * prep.scale, zoom.y + wy * prep.scale);
        if (!erase) erase = new Uint8Array(prep.W * prep.H);
        dab(wx, wy, st.r / prep.scale);
        if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; recompute(); }); }
      };
      view.addEventListener('pointerdown', (e) => {
        const p = toView(e);
        if (mode === 'crop') {
          const sc = view.width / src.width;
          const cs = [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]];
          let best = -1, bd = 70 * p.k;
          cs.forEach(([cx, cy], i) => { const d = Math.hypot(cx * sc - p.x, cy * sc - p.y); if (d < bd) { bd = d; best = i; } });
          const inside = p.x / sc > crop.x && p.x / sc < crop.x + crop.w && p.y / sc > crop.y && p.y / sc < crop.y + crop.h;
          if (best < 0 && !inside) return;
          drag = { corner: best, sx: p.x / sc, sy: p.y / sc, start: { ...crop } };
        } else if (erasing && prep) {
          strokes.push({ r: Math.max(prep.W, prep.H) * 0.035 * prep.scale, pts: [] });
          if (strokes.length > 60) strokes.shift();
          drag = { rub: true };
          rub(p);
        } else return;
        e.preventDefault();
        view.setPointerCapture(e.pointerId);
      });
      view.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = toView(e);
        if (drag.rub) { rub(p); return; }
        const sc = view.width / src.width, mx = p.x / sc, my = p.y / sc, s = drag.start, MIN = 40;
        if (drag.corner < 0) {
          crop.x = Math.max(0, Math.min(src.width - s.w, s.x + mx - drag.sx));
          crop.y = Math.max(0, Math.min(src.height - s.h, s.y + my - drag.sy));
        } else {
          let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
          if (drag.corner % 2 === 0) x0 = Math.max(0, Math.min(x1 - MIN, mx)); else x1 = Math.min(src.width, Math.max(x0 + MIN, mx));
          if (drag.corner < 2) y0 = Math.max(0, Math.min(y1 - MIN, my)); else y1 = Math.min(src.height, Math.max(y0 + MIN, my));
          crop = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
        draw();
      });
      const end = () => { drag = null; };
      view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);

      async function save() {
        if (!result || !result.canvas) return;
        saveBtn.disabled = true;
        const n = game.book.custom.filter((s) => s.kind === kind).length + 1;
        const name = nameInput.value.trim() || `Krabbel ${n}`;
        const st = await game.book.add(kind, name, result.canvas);
        game.audio.play('snap');
        close(st);
      }

      analyse();
    }

    showChoice();
  });
}
