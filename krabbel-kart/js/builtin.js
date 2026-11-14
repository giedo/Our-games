// The built-in racers: doodles drawn by code, so the game has a full grid
// before the first real drawing is added.
import { makeCanvas, mulberry32, TAU } from './util.js';

const INK = '#2a2433';

function pen(g, seed) {
  const rnd = mulberry32(seed);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const wob = (v) => v + (rnd() - 0.5) * 2.4;
  const smooth = (pts, closed) => {
    const p = pts.map(([x, y]) => [wob(x), wob(y)]);
    const n = p.length;
    const path = new Path2D();
    if (closed) {
      path.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      path.closePath();
    } else {
      path.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const a = p[i], b = p[i + 1];
        path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      path.lineTo(p[n - 1][0], p[n - 1][1]);
    }
    return path;
  };
  const finish = (path, fill, lw) => {
    if (fill) {
      g.fillStyle = fill; g.fill(path);
      // A few crayon strokes inside the shape.
      g.save(); g.clip(path);
      g.globalAlpha = 0.16; g.strokeStyle = '#ffffff'; g.lineWidth = 5;
      for (let k = 0; k < 9; k++) {
        const x = rnd() * 256, y = rnd() * 256;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + rnd() * 30, y - 30 - rnd() * 20); g.stroke();
      }
      g.restore();
    }
    if (lw > 0) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(path); }
  };
  const P = {
    rnd,
    shape(pts, fill, lw = 6) { finish(smooth(pts, true), fill, lw); },
    poly(pts, fill, lw = 6) {
      const path = new Path2D();
      pts.forEach(([x, y], i) => (i ? path.lineTo(wob(x), wob(y)) : path.moveTo(wob(x), wob(y))));
      path.closePath(); finish(path, fill, lw);
    },
    blob(cx, cy, rx, ry, fill, rot = 0, lw = 6) {
      const pts = [];
      const cs = Math.cos(rot), sn = Math.sin(rot);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
      }
      finish(smooth(pts, true), fill, lw);
    },
    rect(x, y, w, h, fill, lw = 6) {
      const r = Math.min(w, h) * 0.22;
      const path = new Path2D();
      path.moveTo(wob(x + r), wob(y)); path.lineTo(wob(x + w - r), wob(y));
      path.quadraticCurveTo(x + w, y, wob(x + w), wob(y + r)); path.lineTo(wob(x + w), wob(y + h - r));
      path.quadraticCurveTo(x + w, y + h, wob(x + w - r), wob(y + h)); path.lineTo(wob(x + r), wob(y + h));
      path.quadraticCurveTo(x, y + h, wob(x), wob(y + h - r)); path.lineTo(wob(x), wob(y + r));
      path.quadraticCurveTo(x, y, x + r, y);
      path.closePath(); finish(path, fill, lw);
    },
    line(pts, lw = 5, color = INK) {
      g.strokeStyle = color; g.lineWidth = lw; g.stroke(smooth(pts, false));
    },
    dot(x, y, r, color = INK) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill();
    },
    eye(x, y, r, dx = 0, dy = 0) {
      P.blob(x, y, r, r, '#ffffff', 0, 4);
      P.dot(x + dx, y + dy, r * 0.5);
      P.dot(x + dx - r * 0.16, y + dy - r * 0.2, r * 0.17, '#ffffff');
    },
    wheel(x, y, r, hub = '#c9ced8') {
      P.blob(x, y, r, r, '#3a3542', 0, 5);
      P.blob(x, y, r * 0.45, r * 0.45, hub, 0, 3);
    },
  };
  return P;
}

const DRIVERS = [
  { id: 'b-cat', name: 'Miep', draw(p) {
    p.blob(128, 208, 50, 40, '#ff9a3c');
    p.blob(128, 216, 26, 24, '#ffd9a8', 0, 0);
    p.poly([[62, 80], [72, 22], [114, 58]], '#ff9a3c');
    p.poly([[194, 80], [184, 22], [142, 58]], '#ff9a3c');
    p.poly([[76, 66], [80, 40], [98, 58]], '#ffb3c7', 0);
    p.poly([[180, 66], [176, 40], [158, 58]], '#ffb3c7', 0);
    p.blob(128, 114, 76, 64, '#ff9a3c');
    p.line([[128, 56], [128, 74]], 4); p.line([[112, 60], [115, 75]], 4); p.line([[144, 60], [141, 75]], 4);
    p.eye(98, 108, 15, 2, 1); p.eye(158, 108, 15, 2, 1);
    p.poly([[120, 128], [136, 128], [128, 138]], '#ff7a9c', 3);
    p.line([[128, 138], [128, 146]], 4);
    p.line([[112, 146], [120, 153], [128, 146], [136, 153], [144, 146]], 4);
    p.line([[72, 128], [40, 121]], 3); p.line([[72, 138], [40, 143]], 3);
    p.line([[184, 128], [216, 121]], 3); p.line([[184, 138], [216, 143]], 3);
    p.blob(104, 238, 14, 10, '#ffffff', 0, 4); p.blob(152, 238, 14, 10, '#ffffff', 0, 4);
  } },
  { id: 'b-robot', name: 'Bliep', draw(p) {
    p.line([[128, 54], [128, 26]], 6);
    p.blob(128, 20, 10, 10, '#ff4b4b', 0, 4);
    p.rect(44, 166, 24, 54, '#6d94b8'); p.rect(188, 166, 24, 54, '#6d94b8');
    p.rect(72, 158, 112, 80, '#8fb8d8');
    p.rect(96, 176, 64, 36, '#ffe066', 4);
    p.dot(112, 194, 7, '#ff4b4b'); p.dot(130, 194, 7, '#39c46a'); p.dot(148, 194, 7, '#2f8fff');
    p.rect(114, 146, 28, 14, '#5f7f9f', 4);
    p.rect(46, 84, 18, 32, '#6d94b8'); p.rect(192, 84, 18, 32, '#6d94b8');
    p.rect(62, 50, 132, 98, '#a9cdea');
    p.rect(82, 72, 38, 32, '#1f2a44', 4); p.rect(136, 72, 38, 32, '#1f2a44', 4);
    p.dot(101, 88, 9, '#5ff2ff'); p.dot(155, 88, 9, '#5ff2ff');
    p.rect(92, 116, 72, 20, '#ffffff', 4);
    p.line([[110, 117], [110, 135]], 3); p.line([[128, 117], [128, 135]], 3); p.line([[146, 117], [146, 135]], 3);
  } },
  { id: 'b-dino', name: 'Rex', draw(p) {
    p.poly([[94, 44], [106, 12], [122, 40]], '#ff8a3c');
    p.poly([[120, 40], [136, 6], [150, 40]], '#ffb03c');
    p.poly([[148, 44], [166, 16], [174, 50]], '#ff8a3c');
    p.blob(76, 198, 13, 10, '#5cc45c'); p.blob(180, 198, 13, 10, '#5cc45c');
    p.blob(128, 208, 54, 40, '#5cc45c');
    p.blob(128, 216, 30, 26, '#d6f5ae', 0, 0);
    p.blob(128, 108, 80, 66, '#5cc45c');
    p.blob(128, 138, 54, 30, '#7cd872', 0, 0);
    p.eye(94, 92, 16, 2, 2); p.eye(162, 92, 16, 2, 2);
    p.dot(114, 126, 3.5); p.dot(142, 126, 3.5);
    p.line([[86, 144], [106, 157], [128, 160], [150, 157], [170, 144]], 5);
    p.poly([[100, 153], [110, 156], [104, 166]], '#ffffff', 3);
    p.poly([[146, 156], [156, 153], [152, 166]], '#ffffff', 3);
  } },
  { id: 'b-monster', name: 'Blub', draw(p) {
    p.poly([[76, 62], [58, 16], [100, 46]], '#ffe066');
    p.poly([[180, 62], [198, 16], [156, 46]], '#ffe066');
    p.blob(98, 234, 20, 12, '#8a4fe0'); p.blob(158, 234, 20, 12, '#8a4fe0');
    const fur = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU, k = i % 2 ? 1.07 : 0.94;
      fur.push([128 + Math.cos(a) * 84 * k, 140 + Math.sin(a) * 88 * k]);
    }
    p.poly(fur, '#a56bff');
    p.eye(128, 110, 34, 3, 4);
    p.shape([[84, 168], [128, 180], [172, 168], [128, 200]], '#3a1f4a', 5);
    p.poly([[108, 175], [122, 178], [114, 192]], '#ffffff', 3);
    p.poly([[136, 178], [150, 175], [144, 190]], '#ffffff', 3);
  } },
  { id: 'b-frog', name: 'Kwak', draw(p) {
    p.blob(84, 240, 24, 10, '#7bd447'); p.blob(172, 240, 24, 10, '#7bd447');
    p.blob(128, 202, 62, 42, '#7bd447');
    p.blob(128, 210, 38, 28, '#e8f7a8', 0, 0);
    p.blob(84, 72, 29, 29, '#7bd447'); p.blob(172, 72, 29, 29, '#7bd447');
    p.blob(128, 124, 86, 56, '#7bd447');
    p.eye(84, 70, 18, 2, 3); p.eye(172, 70, 18, -2, 3);
    p.dot(72, 140, 9, '#ff9aa8'); p.dot(184, 140, 9, '#ff9aa8');
    p.dot(118, 112, 3.5); p.dot(138, 112, 3.5);
    p.line([[66, 130], [90, 152], [128, 158], [166, 152], [190, 130]], 5);
  } },
  { id: 'b-bear', name: 'Bram', draw(p) {
    p.blob(70, 62, 26, 26, '#b9763f'); p.blob(186, 62, 26, 26, '#b9763f');
    p.blob(70, 64, 12, 12, '#f0c896', 0, 0); p.blob(186, 64, 12, 12, '#f0c896', 0, 0);
    p.blob(128, 210, 54, 40, '#b9763f');
    p.blob(128, 218, 30, 24, '#dba066', 0, 0);
    p.blob(128, 116, 78, 66, '#b9763f');
    p.shape([[80, 168], [128, 178], [176, 168], [172, 190], [128, 198], [84, 190]], '#ff4b4b');
    p.blob(128, 138, 34, 26, '#f0c896', 0, 4);
    p.blob(128, 127, 11, 8, INK, 0, 0);
    p.line([[128, 135], [128, 146]], 4);
    p.line([[114, 147], [128, 154], [142, 147]], 4);
    p.dot(98, 104, 8); p.dot(158, 104, 8);
    p.dot(95, 101, 2.6, '#ffffff'); p.dot(155, 101, 2.6, '#ffffff');
  } },
  { id: 'b-penguin', name: 'Pim', draw(p) {
    p.blob(100, 240, 22, 10, '#ff9a3c'); p.blob(156, 240, 22, 10, '#ff9a3c');
    p.blob(50, 156, 14, 40, '#35406b', 0.3); p.blob(206, 156, 14, 40, '#35406b', -0.3);
    p.blob(128, 144, 74, 96, '#35406b');
    p.blob(128, 166, 50, 68, '#ffffff', 0, 4);
    p.eye(104, 94, 13, 2, 1); p.eye(152, 94, 13, -2, 1);
    p.poly([[114, 112], [142, 112], [128, 132]], '#ff9a3c', 4);
    p.dot(88, 118, 8, '#ff9aa8'); p.dot(168, 118, 8, '#ff9aa8');
    p.shape([[84, 62], [100, 36], [128, 28], [156, 36], [172, 62], [128, 54]], '#ff4b4b');
    p.blob(128, 24, 10, 10, '#ffffff', 0, 4);
  } },
  { id: 'b-alien', name: 'Zorp', draw(p) {
    p.line([[104, 52], [86, 20]], 5); p.line([[152, 52], [170, 20]], 5);
    p.blob(86, 16, 9, 9, '#ff7ac0', 0, 4); p.blob(170, 16, 9, 9, '#ff7ac0', 0, 4);
    p.line([[98, 206], [70, 226]], 9); p.line([[158, 206], [186, 226]], 9);
    p.blob(128, 214, 40, 32, '#48c4a8');
    p.blob(128, 216, 11, 11, '#ffe066', 0, 3);
    p.shape([[128, 38], [190, 54], [214, 104], [186, 156], [128, 182], [70, 156], [42, 104], [66, 54]], '#5fe0c0');
    p.blob(94, 112, 21, 30, '#1f1a2e', 0.35, 0); p.blob(162, 112, 21, 30, '#1f1a2e', -0.35, 0);
    p.dot(88, 100, 6, '#ffffff'); p.dot(156, 100, 6, '#ffffff');
    p.line([[114, 154], [128, 160], [142, 154]], 4);
  } },
];

const VEHICLES = [
  { id: 'b-bolide', name: 'Bolide', draw(p, g) {
    p.poly([[18, 110], [66, 110], [66, 123], [18, 123]], '#2f3a5f');
    p.poly([[36, 123], [50, 123], [54, 150], [40, 150]], '#2f3a5f');
    p.poly([[6, 174], [22, 174], [22, 186], [6, 186]], '#9aa3b5', 4);
    p.shape([[22, 150], [44, 138], [110, 132], [152, 118], [198, 138], [240, 156], [246, 180], [230, 194], [28, 194], [16, 172]], '#f0453c');
    p.shape([[114, 134], [150, 122], [182, 140], [122, 148]], '#bfe9ff', 4);
    p.line([[40, 172], [232, 176]], 8, '#ffffff');
    p.blob(96, 164, 17, 17, '#ffffff', 0, 4);
    g.fillStyle = INK; g.font = '700 24px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('7', 96, 166);
    p.wheel(68, 198, 26); p.wheel(194, 198, 26);
  } },
  { id: 'b-rocket', name: 'Raket', draw(p) {
    p.shape([[4, 160], [42, 136], [36, 160], [42, 184]], '#ff9a3c', 5);
    p.shape([[20, 160], [42, 148], [38, 160], [42, 172]], '#ffe066', 0);
    p.poly([[46, 114], [88, 138], [88, 152], [42, 150]], '#ff4b4b');
    p.poly([[46, 206], [88, 182], [88, 168], [42, 170]], '#ff4b4b');
    p.blob(138, 160, 100, 34, '#4f8dff');
    p.shape([[204, 133], [250, 160], [204, 187]], '#ff4b4b');
    p.blob(150, 154, 18, 18, '#bfe9ff', 0, 5);
    p.line([[84, 132], [84, 188]], 5, '#ffffff');
    p.wheel(92, 204, 18); p.wheel(190, 204, 18);
  } },
  { id: 'b-tub', name: 'Badkuip', draw(p) {
    p.line([[34, 112], [34, 60], [62, 60]], 9, '#8a94a6');
    p.blob(66, 64, 9, 7, '#8a94a6', 0, 3);
    p.blob(70, 98, 16, 16, '#eaf8ff', 0, 4); p.blob(104, 90, 20, 20, '#ffffff', 0, 4);
    p.blob(140, 98, 16, 16, '#eaf8ff', 0, 4); p.blob(172, 92, 18, 18, '#ffffff', 0, 4);
    p.blob(212, 96, 15, 12, '#ffd21f', 0, 4); p.blob(224, 80, 10, 10, '#ffd21f', 0, 4);
    p.poly([[232, 80], [244, 83], [233, 87]], '#ff8a1f', 3);
    p.dot(226, 78, 2.2);
    p.shape([[24, 118], [232, 118], [228, 172], [202, 198], [54, 198], [28, 172]], '#f4fbff');
    p.rect(14, 108, 228, 18, '#d6ecfa');
    p.line([[52, 150], [60, 176]], 5, '#cfe6f5');
    p.wheel(72, 206, 18, '#ffd21f'); p.wheel(184, 206, 18, '#ffd21f');
  } },
  { id: 'b-banana', name: 'Banaan', draw(p) {
    p.shape([[14, 122], [38, 166], [84, 194], [128, 202], [172, 194], [218, 166], [242, 122], [230, 120], [204, 148], [170, 166], [128, 172], [86, 166], [52, 148], [26, 120]], '#ffd92e');
    p.poly([[10, 118], [28, 116], [26, 130], [14, 130]], '#7a5a2a', 4);
    p.poly([[228, 116], [246, 118], [242, 130], [230, 130]], '#7a5a2a', 4);
    p.line([[60, 172], [100, 188], [150, 189], [196, 172]], 5, '#fff3a6');
    p.wheel(80, 208, 20); p.wheel(176, 208, 20);
  } },
  { id: 'b-clog', name: 'Klomp', draw(p) {
    p.shape([[24, 122], [108, 112], [150, 130], [196, 122], [240, 102], [248, 140], [232, 178], [196, 198], [60, 198], [28, 182], [18, 150]], '#ffd35c');
    p.shape([[36, 126], [106, 118], [122, 136], [46, 142]], '#b98524', 4);
    p.line([[172, 186], [172, 164]], 4, '#3faa4a');
    p.shape([[160, 164], [164, 144], [172, 154], [180, 144], [184, 164], [172, 170]], '#ff4b4b', 3);
    p.line([[60, 168], [130, 172]], 4, '#f0b93a');
    p.wheel(70, 206, 20); p.wheel(190, 206, 20);
  } },
  { id: 'b-box', name: 'Doos', draw(p) {
    p.poly([[30, 112], [10, 86], [54, 98], [72, 112]], '#b98a4a');
    p.poly([[226, 112], [246, 88], [204, 98], [186, 112]], '#b98a4a');
    p.poly([[28, 112], [228, 112], [228, 198], [28, 198]], '#d2a465');
    p.poly([[118, 112], [140, 112], [140, 198], [118, 198]], '#f0e2bd', 3);
    p.blob(204, 150, 11, 11, '#ffe066', 0, 4);
    p.line([[60, 176], [60, 142]], 5); p.line([[48, 154], [60, 140], [72, 154]], 5);
    p.wheel(72, 206, 22, '#ffffff'); p.wheel(184, 206, 22, '#ffffff');
  } },
  { id: 'b-cheese', name: 'Kaas', draw(p) {
    p.poly([[14, 194], [14, 162], [198, 104], [242, 122], [242, 194]], '#ffc93c');
    p.line([[18, 188], [238, 188]], 6, '#f0a020');
    p.blob(78, 170, 13, 10, '#f0a020', 0, 3); p.blob(140, 150, 16, 13, '#f0a020', 0, 3);
    p.blob(198, 168, 10, 9, '#f0a020', 0, 3); p.blob(204, 134, 8, 7, '#f0a020', 0, 3);
    p.blob(108, 176, 6, 5, '#f0a020', 0, 3);
    p.wheel(66, 204, 20); p.wheel(190, 204, 20);
  } },
  { id: 'b-pencil', name: 'Potlood', draw(p) {
    p.rect(8, 134, 34, 52, '#ff8fb0');
    p.poly([[40, 132], [64, 132], [64, 188], [40, 188]], '#c9ced8');
    p.line([[48, 134], [48, 186]], 3); p.line([[56, 134], [56, 186]], 3);
    p.poly([[64, 134], [192, 134], [192, 186], [64, 186]], '#ffd21f');
    p.line([[66, 151], [190, 151]], 3); p.line([[66, 169], [190, 169]], 3);
    p.poly([[192, 134], [234, 155], [234, 165], [192, 186]], '#f2c79a');
    p.poly([[234, 155], [250, 160], [234, 165]], INK, 3);
    p.wheel(82, 198, 20); p.wheel(172, 198, 20);
  } },
];

// Trim a canvas to its non-transparent content.
export function cropToContent(src, pad = 2) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 20) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(src, -x0, -y0);
  return out;
}

export function makeBuiltinStickers() {
  const out = [];
  const make = (list, kind) => list.forEach((def, i) => {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    def.draw(pen(g, 100 + i * 17 + (kind === 'driver' ? 0 : 500)), g);
    out.push({ id: def.id, kind, name: def.name, builtin: true, canvas: cropToContent(c) });
  });
  make(DRIVERS, 'driver');
  make(VEHICLES, 'vehicle');
  return out;
}
