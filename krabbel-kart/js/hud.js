// Heads-up display for one player: place, lap, timer, item slot, minimap,
// messages and the on-screen touch controls.
import { itemById } from './items.js';
import { formatTime, clamp } from './util.js';
import { t } from './i18n.js';

const DOT_COLORS = ['#ff4b4b', '#4fb8ff', '#ffa53c', '#5fe06a', '#b46bff', '#ff7ac0', '#2fd0d0', '#c9ced8'];

const STAR_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4l8 18 20 2-15 13 5 20-18-10-18 10 5-20L4 24l20-2z" fill="#ffd21f" stroke="#2a2433" stroke-width="5" stroke-linejoin="round"/></svg>';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  constructor(game, race, kart, index, total) {
    this.game = game; this.race = race; this.kart = kart; this.index = index;
    const root = this.el = el('div', `hud p${index}${total > 1 ? ' split' : ''} m-${race.mode.constructor.id}`);
    this.pos = el('div', 'hud-pos');
    this.lap = el('div', 'hud-lap');
    this.time = el('div', 'hud-time', '0:00.00');
    this.extra = el('div', 'hud-extra');
    this.badge = el('b', 'item-badge');
    this._pool = null;
    this.item = el('button', 'hud-item');
    this.item.setAttribute('aria-label', t('item'));
    this.map = el('canvas', 'hud-map');
    this.map.width = 280; this.map.height = 280;
    this.msg = el('div', 'hud-msg');
    this.wrong = el('div', 'hud-wrong', t('wrongWay'));
    this.vig = el('div', 'hud-vig');
    this.banner = el('div', 'hud-banner');
    this.act = el('button', 'hud-act');
    this.act.addEventListener('pointerdown', (e) => { e.stopPropagation(); const a = race.mode.hudAction(kart); if (a) { game.audio.play('click'); a.fn(); } });
    this.skip = el('div', 'hud-skip', t('tapToSkip'));
    const col = el('div', 'hud-col');
    this.stars = el('div', 'hud-stars');
    this.itemName = el('div', 'hud-itemname');
    col.append(this.lap, this.time, this.stars, this.extra);
    const tl = el('div', 'hud-tl');
    tl.append(this.pos, col);
    root.append(this.vig, tl, this.banner, this.act, this.map, this.msg, this.wrong, this.item, this.itemName, this.skip);
    this._buildTouch(root);
    game.hudRoot.appendChild(root);
    this._cache = {};
    this.msgT = 0;
    this._buildMap();
    this.update(0);
  }

  _buildTouch(root) {
    const input = this.game.input, i = this.index;
    const pad = this.pad = el('div', 'touch-steer', '<span>◀</span><span>▶</span>');
    const drift = el('button', 'touch-btn touch-drift', t('drift'));
    const brake = el('button', 'touch-btn touch-brake', t('brake'));
    root.append(pad, drift, brake);
    const steerFrom = (e) => {
      const r = pad.getBoundingClientRect();
      const v = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const a = Math.abs(v);
      input.setTouch(i, 'steer', a < 0.1 ? 0 : Math.sign(v) * clamp((a - 0.1) / 0.45, 0, 1));
      pad.classList.toggle('l', v < -0.1); pad.classList.toggle('r', v > 0.1);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } pad._id = e.pointerId; steerFrom(e); });
    pad.addEventListener('pointermove', (e) => { if (pad._id === e.pointerId) steerFrom(e); });
    const endSteer = (e) => { if (pad._id === e.pointerId) { pad._id = null; input.setTouch(i, 'steer', undefined); pad.classList.remove('l', 'r'); } };
    pad.addEventListener('pointerup', endSteer); pad.addEventListener('pointercancel', endSteer);
    const hold = (btn, name) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } input.setTouch(i, name, true); btn.classList.add('down'); });
      const off = () => { input.setTouch(i, name, false); btn.classList.remove('down'); };
      btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off);
    };
    hold(drift, 'drift'); hold(brake, 'brake');
    this.item.addEventListener('pointerdown', (e) => { e.preventDefault(); input.touch[i].item = true; input.touch[i].itemTap = true; });
    const itemOff = () => { input.touch[i].item = false; };
    this.item.addEventListener('pointerup', itemOff); this.item.addEventListener('pointercancel', itemOff); this.item.addEventListener('pointerleave', itemOff);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _buildMap() {
    const tr = this.race.world.track, b = tr.bounds, S = 280, pad = 22;
    const sc = Math.min((S - pad * 2) / (b.maxX - b.minX), (S - pad * 2) / (b.maxZ - b.minZ));
    this.mx = (x) => S / 2 + (x - b.cx) * sc;
    this.my = (z) => S / 2 + (z - b.cz) * sc;
    const off = this.mapBase = document.createElement('canvas');
    off.width = off.height = S;
    const g = off.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= tr.n; i += 2) {
        const k = i % tr.n;
        if (i === 0) g.moveTo(this.mx(tr.px[k]), this.my(tr.pz[k])); else g.lineTo(this.mx(tr.px[k]), this.my(tr.pz[k]));
      }
      g.closePath();
    };
    path(); g.strokeStyle = 'rgba(20,20,40,0.55)'; g.lineWidth = 17; g.stroke();
    path(); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 10; g.stroke();
    // Start line tick.
    if (!tr.def.arena) { g.strokeStyle = '#2a2433'; g.lineWidth = 5;
    g.beginPath();
    g.moveTo(this.mx(tr.px[0] - tr.rx[0] * 14), this.my(tr.pz[0] - tr.rz[0] * 14));
    g.lineTo(this.mx(tr.px[0] + tr.rx[0] * 14), this.my(tr.pz[0] + tr.rz[0] * 14));
    g.stroke(); }
  }

  message(text, dur, cls = '') {
    this.msg.className = 'hud-msg';
    void this.msg.offsetWidth; // restart the pop animation
    this.msg.textContent = text;
    this.msg.className = `hud-msg show ${cls}`;
    this.msgT = dur;
  }

  _itemName(id) {
    const name = t('items.' + id);
    if (name === 'items.' + id) return;
    this.itemName.textContent = name;
    this.itemName.classList.remove('show'); void this.itemName.offsetWidth;
    this.itemName.classList.add('show');
    this.nameT = 2.2;
  }

  _set(key, value, fn) {
    if (this._cache[key] !== value) { this._cache[key] = value; fn(value); }
  }

  update(dt) {
    const k = this.kart, race = this.race;
    if (this.nameT > 0) { this.nameT -= dt; if (this.nameT <= 0) this.itemName.classList.remove('show'); }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.className = 'hud-msg'; }
    // The mode decides what the place, lap and extra badges say.
    const info = race.mode.hudInfo(k);
    this._set('place', info.place, (v) => {
      this.pos.textContent = '';
      this.pos.classList.toggle('none', v === null);
      const m = v === null ? null : /^(\d+)(.*)$/.exec(v);
      if (m) { this.pos.append(el('b', '', m[1]), el('i', '', m[2])); this.pos.dataset.p = k.place; }
      else if (v !== null) { this.pos.textContent = v; delete this.pos.dataset.p; }
    });
    this._set('lap', info.lap, (v) => {
      this.lap.textContent = '';
      this.lap.classList.toggle('none', v === null);
      const m = v === null ? null : /^(\D*)(\d+)(.*)$/.exec(v);
      if (m) this.lap.append(m[1], el('b', '', m[2]), m[3]); else if (v !== null) this.lap.textContent = v;
    });
    const extras = info.extra || [];
    this._set('extra', extras.map((e) => `${e.icon || ''}|${e.text}`).join('\n'), () => {
      this.extra.textContent = '';
      for (const e of extras) {
        const b = el('span', 'x-badge', e.icon ? `<i>${e.icon}</i>` : '');
        b.append(el('em'));
        b.lastChild.textContent = String(e.text);
        this.extra.append(b);
      }
    });
    // A mode may show its own clock (time left): info.time is a string.
    this._set('time', typeof info.time === 'string' ? info.time : Math.floor((k.finished ? k.finishTime : race.time) * 100), (v) => { this.time.textContent = typeof v === 'string' ? v : formatTime(v / 100); });
    // Item slot: the roulette spins over the items this kart can get; a badge counts uses or seconds left.
    let icon = '';
    if (k.rollT > 0) {
      if (!this._pool) this._pool = race.items.pool(k);
      const n = this._pool.length;
      if (n) icon = 'roll:' + this._pool[Math.floor(race.clock / 0.09) % n].id;
    } else {
      this._pool = null;
      if (k.item) icon = k.item;
    }
    this._set('item', icon, (v) => {
      const rolling = v.startsWith('roll:'), d = itemById(rolling ? v.slice(5) : v);
      this.item.innerHTML = d ? d.icon : '';
      this.item.classList.toggle('ready', !!v && !rolling);
      this.item.classList.toggle('rolling', rolling);
      delete this._cache.badge; // the slot was rebuilt
      if (rolling) this.game.audio.play('tick', 0.6);
      else if (v && d) this._itemName(v); // the roulette landed: show the name for a moment
    });
    const left = k.itemT > 0 ? Math.ceil(k.itemT) : k.itemUses > 1 ? k.itemUses : 0;
    this._set('badge', k.item && k.rollT <= 0 ? left : 0, (v) => {
      if (v) { this.badge.textContent = String(v); this.item.append(this.badge); } else this.badge.remove();
    });
    // Gold stars collected on the road (only races that have road stars).
    this._set('stars', race.items.roadStars ? k.stars : 0, (v) => {
      this.stars.classList.toggle('show', v > 0);
      this.stars.innerHTML = v > 0 ? `<i>${STAR_SVG}</i><b>${v}</b>` : '';
      if (v > 0) { this.stars.classList.remove('pop'); void this.stars.offsetWidth; this.stars.classList.add('pop'); }
    });
    // Mode banner line and action button.
    const ban = race.mode.hudBanner(k);
    this._set('banner', ban ? `${ban.cls || ''}|${ban.text}|${ban.sub || ''}` : '', () => {
      this.banner.textContent = '';
      this.banner.className = ban ? `hud-banner show ${ban.cls || ''}` : 'hud-banner';
      this.el.dataset.ban = ban && ban.cls ? ban.cls : '';
      if (ban) { this.banner.append(el('b', '', '')); this.banner.firstChild.textContent = ban.text; if (ban.sub) { const sm = el('small', ''); sm.textContent = ban.sub; this.banner.append(sm); } }
    });
    const act = race.mode.hudAction(k);
    this._set('act', act ? act.label : '', (v) => { this.act.textContent = v; this.act.classList.toggle('show', !!v); });
    this._set('wrong', k.wrongWayT > 1.2 && !k.finished && race.mode.showWrongWay, (v) => this.wrong.classList.toggle('show', v));
    this._set('boost', k.boostT > 0, (v) => this.vig.classList.toggle('show', v));
    this._set('intro', race.state === 'intro', (v) => this.skip.classList.toggle('show', v));
    this._set('fin', k.finished || k.out, (v) => this.el.classList.toggle('finished', v));
    // Minimap.
    const g = this.map.getContext('2d');
    g.clearRect(0, 0, 280, 280);
    g.drawImage(this.mapBase, 0, 0);
    // Modes may draw markers (flags, bases, stars) and colour the kart dots: mode.mapMarks() -> reused [{ x, z, color, shape }].
    const mm = race.mode.mapMarks ? race.mode.mapMarks() : null;
    if (mm) for (let i = 0; i < mm.length; i++) this._mark(g, mm[i]);
    const karts = race.karts;
    for (let i = karts.length - 1; i >= 0; i--) {
      const o = karts[i];
      if (o.out) continue;
      const x = this.mx(o.x), y = this.my(o.z);
      g.globalAlpha = o.fx.ghost > 0 ? 0.4 : 1;
      g.beginPath();
      if (o === k) {
        g.arc(x, y, 12, 0, 6.3); g.fillStyle = '#ffe14a'; g.fill();
        g.lineWidth = 4; g.strokeStyle = '#2a2433'; g.stroke();
      } else {
        g.arc(x, y, o.human ? 10 : 7.5, 0, 6.3); g.fillStyle = (race.mode.mapColor && race.mode.mapColor(o)) || (o.human ? '#ffffff' : DOT_COLORS[i % DOT_COLORS.length]); g.fill();
        g.lineWidth = 3; g.strokeStyle = '#2a2433'; g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  // One map marker: shape 'flag', 'ring', 'star' or 'dot'.
  _mark(g, m) {
    const x = this.mx(m.x), y = this.my(m.z);
    g.fillStyle = m.color; g.strokeStyle = '#2a2433'; g.lineWidth = 3;
    g.beginPath();
    if (m.shape === 'ring') { g.arc(x, y, 15, 0, 6.3); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = m.color; g.stroke(); return; }
    if (m.shape === 'flag') { g.moveTo(x, y + 12); g.lineTo(x, y - 14); g.lineTo(x + 16, y - 8); g.lineTo(x, y - 2); g.closePath(); g.fill(); g.stroke(); return; }
    if (m.shape === 'star') { for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - 1.57, r = i % 2 ? 3 : 7; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); return; }
    g.arc(x, y, 5, 0, 6.3); g.fill();
  }

  dispose() { this.el.remove(); }
}
