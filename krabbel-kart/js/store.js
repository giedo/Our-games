// Saving: the kids' drawings live in IndexedDB (on this device), settings in localStorage.
import { makeBuiltinStickers } from './builtin.js';
import { forgetPuffy } from './racerModel.js';
import { makeCanvas } from './util.js';

const DB = 'krabbel-kart', STORE = 'stickers', LS_KEY = 'krabbel-kart-settings';

function openDb() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function dataUrlToCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export class StickerBook {
  constructor() {
    this.builtin = [];
    this.custom = [];
    this.db = null;
    this.persistent = false;
  }

  async load() {
    this.builtin = makeBuiltinStickers();
    try {
      this.db = await openDb();
      const recs = await tx(this.db, 'readonly', (s) => s.getAll());
      this.persistent = true;
      recs.sort((a, b) => (b.created || 0) - (a.created || 0));
      for (const r of recs) {
        try {
          this.custom.push({ id: r.id, kind: r.kind, name: r.name, created: r.created, canvas: await dataUrlToCanvas(r.png), builtin: false });
        } catch (e) { /* skip broken record */ }
      }
    } catch (e) {
      this.db = null; // private mode or blocked storage: drawings last until the page closes
    }
  }

  list(kind) {
    return this.custom.filter((s) => s.kind === kind).concat(this.builtin.filter((s) => s.kind === kind));
  }

  get(id) {
    return this.custom.find((s) => s.id === id) || this.builtin.find((s) => s.id === id) || null;
  }

  async add(kind, name, canvas) {
    const st = { id: `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, kind, name, created: Date.now(), canvas, builtin: false };
    this.custom.unshift(st);
    if (this.db) {
      try { await tx(this.db, 'readwrite', (s) => s.put({ id: st.id, kind, name, created: st.created, png: canvas.toDataURL('image/png') })); }
      catch (e) { /* keep it in memory */ }
    }
    return st;
  }

  async remove(id) {
    const i = this.custom.findIndex((s) => s.id === id);
    if (i < 0) return;
    forgetPuffy(this.custom[i]);
    this.custom.splice(i, 1);
    if (this.db) { try { await tx(this.db, 'readwrite', (s) => s.delete(id)); } catch (e) { /* ignore */ } }
  }
}

// mode = id of the game mode played last, modeOpts[modeId][key] = chosen option, age = 'little' | 'big'.
const DEFAULTS = { sound: true, music: true, assist: false, fancy: true, lang: null, difficulty: 'normal', track: 'meadow', mode: 'race', age: 'little', modeOpts: {}, picks: [{}, {}] };

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { s = {}; }
  const out = Object.assign({}, DEFAULTS, s);
  if (out.mode === 'single') out.mode = 'race'; // older saves
  if (out.age !== 'big') out.age = 'little';
  if (!out.modeOpts || typeof out.modeOpts !== 'object') out.modeOpts = {};
  return out;
}

export function saveSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}
