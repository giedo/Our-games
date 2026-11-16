// Menus: title, player count, racer picker, track picker, results, pause, settings, sticker book.
import { h, clear, ICON } from './dom.js';
import { TRACKS, trackById } from './tracks.js';
import { openMaker } from './editor.js';
import { t, setLang, getLang } from './i18n.js';
import { formatTime } from './util.js';
import { saveSettings } from './store.js';
import { MODES, modeById } from './modes/index.js';
import { cupById, CUPS } from './cups.js';
import { packById } from './worlds/index.js';
import { ageOf } from './age.js';

const LOGO_COLORS = ['#ff4b4b', '#ff9a1f', '#ffd21f', '#5fd048', '#3fb8ff', '#9a5cff', '#ff7ac0'];
// Card pictures of the built-in worlds; a world pack brings its own `chip`.
const TRACK_CHIPS = {
  meadow: 'linear-gradient(160deg,#8fd0ff 0 45%,#74c64a 45% 100%)',
  canyon: 'linear-gradient(160deg,#5a2f8a 0 30%,#ff8a4c 30% 55%,#b5472f 55% 100%)',
  island: 'linear-gradient(160deg,#7fd8ff 0 40%,#49e8d6 40% 62%,#f7e6ad 62% 100%)',
  snow: 'linear-gradient(160deg,#0a1440 0 35%,#3fe0a0 35% 48%,#15357a 48% 60%,#eaf4ff 60% 100%)',
};

function chipOf(id) {
  const pack = packById(id);
  return TRACK_CHIPS[id] || (pack && pack.chip) || '#cfd8e8';
}

// A trophy in a colour (cups and the medals on the cup cards).
export function trophySvg(color, ink = '#2a2433') {
  return `<svg viewBox="0 0 64 64" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8h24v18a12 12 0 01-24 0z" fill="${color}"/><path d="M20 14h-9v5a9 9 0 009 9M44 14h9v5a9 9 0 01-9 9"/><path d="M32 38v10"/><path d="M22 56h20l-3-8H25z" fill="${color}"/><path d="M28 16l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#fff" stroke-width="2.5"/></svg>`;
}
const MEDAL = ['#ffcf33', '#dfe7f0', '#e8a56a'];

function thumbUrl(st) {
  if (!st._thumb) st._thumb = st.canvas.toDataURL('image/png');
  return st._thumb;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.root = game.uiRoot;
    this.players = 1;
    this.current = null;
  }

  click() { this.g.audio.unlock(); this.g.audio.play('click'); }
  back() { this.g.audio.play('back'); }

  btn(cls, icon, label, fn) {
    return h('button', { class: `btn ${cls}`, onclick: () => { this.click(); fn(); } }, icon ? h('span', { html: icon }) : null, label);
  }

  show(name, data) {
    this.current = name;
    clear(this.root);
    this.root.className = `ui ${name}`;
    this[`_${name}`](data);
  }

  hide() { this.current = null; clear(this.root); this.root.className = 'ui'; }

  // ---------- title ----------
  _title() {
    const g = this.g;
    g.setMenuView('fly');
    const letters = (word, off) => word.split('').map((ch, i) => h('span', { style: { color: LOGO_COLORS[(i + off) % LOGO_COLORS.length], transform: `rotate(${((i * 37 + off * 11) % 13) - 6}deg) translateY(${((i * 53) % 9) - 4}px)` } }, ch));
    this.root.append(
      h('div', { class: 'screen title' },
        h('h1', { class: 'logo', 'aria-label': 'Krabbel Kart' }, h('div', null, letters('Krabbel', 0)), h('div', null, letters('Kart', 3))),
        h('p', { class: 'tagline' }, t('tagline')),
        h('div', { class: 'title-btns' },
          this.btn('go xl', ICON.play, t('play'), () => this.show('players')),
          this.btn('', ICON.pencil, t('myDrawings'), () => this.show('book')),
          this.btn('', ICON.gear, t('settings'), () => this.show('settings'))),
        h('p', { class: 'keys-hint' }, t('driftTip'))));
  }

  // ---------- how many players, and how old ----------
  _players() {
    const g = this.g, s = g.settings;
    g.setMenuView('fly');
    const pick = (n) => { this.players = n; this.show('mode'); };
    const ages = h('div', { class: 'age-row' });
    const paintAges = () => {
      clear(ages);
      for (const [id, icon, label] of [['little', ICON.little, t('ageLittle')], ['big', ICON.big, t('ageBig')]]) {
        ages.append(h('button', { class: `card age${ageOf(s) === id ? ' on' : ''}`, 'aria-pressed': ageOf(s) === id ? 'true' : 'false', onclick: () => {
          this.click(); s.age = id; saveSettings(s); paintAges();
        } }, h('span', { class: 'ic', html: icon }), h('b', null, label)));
      }
    };
    paintAges();
    this.root.append(
      h('div', { class: 'screen center' },
        h('h2', { class: 'head' }, t('howMany')),
        h('div', { class: 'choice-row' },
          h('button', { class: 'card big', onclick: () => { this.click(); pick(1); } }, h('span', { class: 'ic', html: ICON.one }), h('b', null, t('players1'))),
          h('button', { class: 'card big', onclick: () => { this.click(); pick(2); } }, h('span', { class: 'ic', html: ICON.two }), h('b', null, t('players2')))),
        h('h3', { class: 'head small' }, t('howOld')),
        ages,
        this.btn('ghost', ICON.back, t('back'), () => this.show('title'))));
  }

  // The mode in the settings, or the plain race when the age setting does not allow it.
  currentMode() {
    const M = modeById(this.g.settings.mode);
    return M.ages.indexOf(ageOf(this.g.settings)) >= 0 && (M.maxPlayers || 2) >= this.players ? M : modeById('race');
  }

  // The chosen options of a mode, with defaults filled in: { key: value }.
  modeOpts(M) {
    const saved = this.g.settings.modeOpts[M.id] || {}, out = {};
    for (const o of M.options(this.g.settings)) out[o.key] = saved[o.key] !== undefined ? saved[o.key] : o.default;
    return out;
  }

  // ---------- pick a game mode ----------
  _mode() {
    const g = this.g, s = g.settings, age = ageOf(s);
    g.setMenuView('fly');
    const last = this.currentMode();
    const card = (M) => h('button', { class: `card mode${M === last ? ' on' : ''}`, onclick: () => {
      this.click(); s.mode = M.id; saveSettings(s); this.show('racer', 0);
    } }, h('span', { class: 'ic', html: M.icon }), h('b', null, t(`modes.${M.id}`)), h('small', null, t(`modeSub.${M.id}`)),
    M === last ? h('em', { class: 'last' }, t('lastPlayed')) : null);
    // Two sections, Race and Battle, each a row of cards.
    const avail = MODES.filter((M) => M.ages.indexOf(age) >= 0 && (M.maxPlayers || 2) >= this.players);
    const groups = ['race', 'battle'].map((id) => ({ id, list: avail.filter((M) => (M.group || 'race') === id) })).filter((gr) => gr.list.length);
    const body = h('div', { class: `mode-groups ${age}` }, groups.map((gr) => h('section', { class: `mode-group ${gr.id}` },
      h('h3', { class: 'mode-label' }, t(`modeGroup.${gr.id}`)), h('div', { class: 'mode-cards' }, gr.list.map(card)))));
    this.root.append(
      h('div', { class: 'screen center' },
        h('h2', { class: 'head' }, t('pickMode')),
        body,
        this.btn('ghost', ICON.back, t('back'), () => this.show('players'))));
  }

  // ---------- pick driver + vehicle ----------
  _racer(i) {
    const g = this.g, book = g.book, picks = g.settings.picks;
    if (!picks[i]) picks[i] = {};
    const pick = picks[i];
    const first = (kind, skip) => {
      const list = book.list(kind);
      return (list.find((s) => s.builtin && s.id !== skip) || list[0]).id;
    };
    const other = i === 1 ? picks[0] : null;
    if (!book.get(pick.driver)) pick.driver = first('driver', other && other.driver);
    if (!book.get(pick.vehicle)) pick.vehicle = first('vehicle', other && other.vehicle);
    const apply = () => {
      saveSettings(g.settings);
      g.setPreview(book.get(pick.driver), book.get(pick.vehicle));
    };
    const strip = (kind) => {
      const row = h('div', { class: 'strip' });
      const fill = () => {
        clear(row);
        row.append(h('button', { class: 'thumb new', onclick: async () => {
          this.click();
          const st = await openMaker(g, kind);
          if (st) { pick[kind] = st.id; apply(); fill(); }
        } }, h('span', { class: 'ic', html: ICON.plus }), h('small', null, t('newDrawing'))));
        for (const st of book.list(kind)) {
          const b = h('button', { class: `thumb${pick[kind] === st.id ? ' on' : ''}${st.builtin ? '' : ' mine'}`, onclick: () => {
            this.click(); pick[kind] = st.id; apply();
            for (const c of row.children) c.classList.remove('on');
            b.classList.add('on');
          } }, h('img', { src: thumbUrl(st), alt: st.name, draggable: false }), h('small', null, st.name));
          row.append(b);
        }
      };
      fill();
      return row;
    };
    g.setMenuView('kart');
    apply();
    const title = this.players > 1 ? `${t('player')} ${i + 1}` : t('pickDriver');
    this.root.append(
      h('div', { class: 'screen racer' },
        h('div', { class: 'bar' },
          this.btn('ghost', ICON.back, t('back'), () => (i > 0 ? this.show('racer', i - 1) : this.show('mode'))),
          h('h2', { class: `head p${i}` }, title),
          this.btn('go', ICON.next, t('next'), () => (i + 1 < this.players ? this.show('racer', i + 1) : this.show('track')))),
        h('div', { class: 'racer-panel' },
          h('div', { class: 'row' }, h('h3', null, t('drivers')), strip('driver')),
          h('div', { class: 'row' }, h('h3', null, t('vehicles')), strip('vehicle')))));
  }

  // ---------- pick track (and the options of the mode) ----------
  _track() {
    const g = this.g, s = g.settings, M = this.currentMode();
    g.setMenuView('fly');
    const series = M.series;
    // A Grand Prix shows its tracks in racing order; other modes let you pick any world.
    const list = TRACKS;
    const cards = h('div', { class: 'track-cards' });
    const fill = () => {
      clear(cards);
      list.forEach((def, i) => {
        cards.append(h('button', { class: `card track${s.track === def.id ? ' on' : ''}`, onclick: () => {
          this.click();
          if (s.track === def.id) return;
          s.track = def.id; saveSettings(s); fill();
          g.loadWorld(def.id);
        } }, h('i', { class: 'chip', style: { background: chipOf(def.id) } }, M.cardNote && M.cardNote(def.id, s) ? h('em', { class: 'note' }, M.cardNote(def.id, s)) : null),
        h('b', null, t(`tracks.${def.id}`)), h('small', null, t(`trackSub.${def.id}`))));
      });
    };
    const seg = (options, get, set) => {
      const box = h('div', { class: 'seg' });
      const paint = () => {
        clear(box);
        for (const [value, label] of options) {
          box.append(h('button', { class: get() === value ? 'on' : '', onclick: () => { this.click(); set(value); saveSettings(s); paint(); } }, label));
        }
      };
      paint();
      return box;
    };
    const diff = seg([['easy', t('easy')], ['normal', t('normal')], ['fast', t('fast')]], () => s.difficulty, (v) => { s.difficulty = v; });
    const modeOpts = M.options(s).map((o) => h('div', { class: 'diff' }, h('span', null, o.label), seg(o.values,
      () => this.modeOpts(M)[o.key], (v) => { if (!s.modeOpts[M.id]) s.modeOpts[M.id] = {}; s.modeOpts[M.id][o.key] = v; })));
    fill();
    // Grand Prix: pick one of the cups instead of a world.
    const hint = h('p', { class: 'cup-hint' });
    const cupBox = h('div', { class: 'cup-cards' });
    const fillCups = () => {
      clear(cupBox);
      const cur = cupById(s.cup), best = s.cupBest || {};
      hint.textContent = `${cur.tracks.length} ${t('cupRaces')}. ${t('cupHint')}`;
      for (const c of CUPS) {
        cupBox.append(h('button', { class: `card cup${c.id === cur.id ? ' on' : ''}`, onclick: () => { this.click(); s.cup = c.id; saveSettings(s); fillCups(); } },
          h('span', { class: 'tr', html: trophySvg(c.color) }), h('b', null, t(`cups.${c.id}`)),
          h('span', { class: 'chips' }, c.tracks.map((id) => h('i', { class: 'chip', style: { background: chipOf(id) } }))),
          best[c.id] ? h('em', { class: 'best', html: trophySvg(MEDAL[best[c.id] - 1]), title: t('cupBest') }) : null));
      }
    };
    if (series) fillCups();
    const showCards = M.needsTrack !== false && !series;
    this.root.append(
      h('div', { class: 'screen trackpick' },
        h('div', { class: 'bar' },
          this.btn('ghost', ICON.back, t('back'), () => this.show('racer', this.players - 1)),
          h('h2', { class: 'head' }, series ? t(`modes.${M.id}`) : showCards ? t('pickTrack') : t(`modes.${M.id}`)),
          this.btn('go', ICON.play, t('start'), () => this.startRace())),
        h('div', { class: 'track-bottom' }, series ? hint : null, series ? cupBox : null, showCards ? cards : null,
          h('div', { class: 'opts' }, modeOpts, h('div', { class: 'diff' }, h('span', null, t('speed')), diff)))));
    // Bring the chosen world into view when there are more cards than fit.
    const on = cards.querySelector('.on');
    if (on) requestAnimationFrame(() => { cards.scrollLeft = on.offsetLeft - (cards.clientWidth - on.offsetWidth) / 2; });
    cards.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && cards.scrollWidth > cards.clientWidth) { cards.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
  }

  startRace() {
    const g = this.g, s = g.settings, M = this.currentMode();
    const picks = [];
    for (let i = 0; i < this.players; i++) picks.push({ driver: g.book.get(s.picks[i].driver), vehicle: g.book.get(s.picks[i].vehicle) });
    this.hide();
    if (M.series) g.startCup({ players: picks, difficulty: s.difficulty, cup: s.cup });
    else { g.cup = null; g.startRace({ mode: M.id, opts: this.modeOpts(M), trackId: s.track, players: picks, difficulty: s.difficulty }); }
  }

  // ---------- results ----------
  _results({ results, cup }) {
    const g = this.g;
    const list = h('ol', { class: 'res-list' });
    for (const r of results.rows) {
      const team = r.team === 0 || r.team === 1 ? ` team${r.team}` : '';
      list.append(h('li', { class: `${r.human ? `me p${r.playerIndex}` : ''}${team}` },
        h('span', { class: 'pl' }, String(r.place)),
        h('img', { src: thumbUrl(r.driver), alt: '' }),
        h('span', { class: 'nm' }, r.name),
        r.time !== undefined ? h('span', { class: 'tm' }, r.time === null ? '' : formatTime(r.time)) : null,
        (r.extra || []).map((x) => h('span', { class: x.cls || 'xc' }, String(x.text)))));
    }
    const head = results.headline || (cup ? `${t(`cups.${cup.id}`)} ${cup.index + 1}/${cup.tracks.length}` : t('results'));
    const buttons = cup
      ? [this.btn('go', ICON.next, t('standings'), () => this.show('standings'))]
      : [this.btn('go', ICON.rotate, t('again'), () => { this.hide(); g.restartRace(); }),
        this.btn('', ICON.wheel, t('otherTrack'), () => { g.endRace(); this.show('track'); }),
        this.btn('ghost', ICON.close, t('menu'), () => { g.quitToMenu(); this.show('title'); })];
    this.root.append(
      h('div', { class: 'screen center' },
        h('div', { class: `panel results${results.wide ? ' wide' : ''}` }, h('h2', null, head), list, h('div', { class: 'btn-row' }, buttons))));
  }

  standingsList(ranking) {
    const list = h('ol', { class: 'res-list' });
    ranking.forEach((e, i) => {
      list.append(h('li', { class: e.human ? `me p${e.playerIndex}` : '' },
        h('span', { class: 'pl' }, String(i + 1)),
        h('img', { src: thumbUrl(e.driver), alt: '' }),
        h('span', { class: 'nm' }, e.name),
        h('span', { class: 'pt big' }, `${e.points} ${t('pts')}`)));
    });
    return list;
  }

  // ---------- tournament standings ----------
  _standings() {
    const g = this.g, cup = g.cup;
    const last = cup.index + 1 >= cup.tracks.length;
    const nextName = last ? '' : t(`tracks.${cup.tracks[cup.index + 1]}`);
    this.root.append(
      h('div', { class: 'screen center' },
        h('div', { class: 'panel results' },
          h('h2', null, `${t('standings')} ${cup.index + 1}/${cup.tracks.length}`),
          this.standingsList(g.cupStandings()),
          last ? null : h('p', { class: 'tip' }, `${t('nextRace')}: ${nextName}`),
          h('div', { class: 'btn-row' },
            this.btn('go', last ? ICON.check : ICON.play, last ? t('toPodium') : t('nextRace'), () => { this.hide(); g.nextCupRace(); }),
            this.btn('ghost', ICON.close, t('menu'), () => { g.quitToMenu(); this.show('title'); })))));
  }

  // ---------- podium ceremony ----------
  _ceremony(ranking) {
    const g = this.g;
    const medals = ['gold', 'silver', 'bronze'];
    const top3 = h('div', { class: 'cer-top3' }, ranking.slice(0, 3).map((e, i) => h('div', { class: `medal ${medals[i]}${e.human ? ' me' : ''}` },
      h('span', { class: 'pl' }, String(i + 1)), h('img', { src: thumbUrl(e.driver), alt: '' }),
      h('span', { class: 'nm' }, e.name), h('span', { class: 'pt' }, `${e.points} ${t('pts')}`))));
    const showTable = () => {
      const pop = h('div', { class: 'screen center dim pop' },
        h('div', { class: 'panel results' }, h('h2', null, t('standings')), this.standingsList(ranking),
          h('div', { class: 'btn-row' }, this.btn('go', ICON.check, t('done'), () => pop.remove()))));
      this.root.append(pop);
    };
    this.root.append(
      h('div', { class: 'screen ceremony' },
        h('div', { class: 'cer-head' }, h('h2', { class: 'head champion' }, t('champion')), h('div', { class: 'cer-name' }, ranking[0].name)),
        h('div', { class: 'cer-bottom' }, top3,
          h('div', { class: 'btn-row' },
            this.btn('', ICON.wheel, t('standings'), showTable),
            this.btn('go', ICON.rotate, t('newTournament'), () => {
              const players = g.cup.players, difficulty = g.cup.difficulty, cup = g.cup.id;
              this.hide(); g.startCup({ players, difficulty, cup });
            }),
            this.btn('ghost', ICON.close, t('menu'), () => { g.quitToMenu(); this.show('title'); })))));
  }

  // ---------- pause ----------
  _pause() {
    const g = this.g;
    this.root.append(
      h('div', { class: 'screen center dim' },
        h('div', { class: 'panel' },
          h('h2', null, t('paused')),
          h('div', { class: 'btn-col' },
            this.btn('go', ICON.play, t('resume'), () => g.setPaused(false)),
            g.race && g.race.mode.canEnd() ? this.btn('', ICON.check, t('endHere'), () => g.endRaceNow()) : null,
            this.btn('', ICON.rotate, t('restart'), () => { g.setPaused(false); this.hide(); g.restartRace(); }),
            this.btn('ghost', ICON.close, t('quit'), () => { g.setPaused(false); g.quitToMenu(); this.show('title'); })),
          this.toggles(false))));
  }

  toggles(full) {
    const g = this.g, s = g.settings;
    const box = h('div', { class: 'toggles' });
    const fill = () => {
      clear(box);
      const tog = (icon, label, key, hint) => h('button', { class: `toggle${s[key] ? ' on' : ''}`, onclick: () => {
        s[key] = !s[key]; saveSettings(s); g.audio.unlock(); g.audio.applySettings(); g.audio.play('click'); g.lowGraphics = false; g.applyGraphics(); fill();
      } }, h('span', { class: 'ic', html: icon }), h('span', { class: 'lb' }, label, hint ? h('small', null, hint) : null), h('i', null, s[key] ? t('on') : t('off')));
      box.append(tog(ICON.sound, t('sound'), 'sound'), tog(ICON.music, t('music'), 'music'));
      if (full) {
        box.append(tog(ICON.wheel, t('steerHelp'), 'assist', t('steerHelpHint')));
        box.append(tog(ICON.brush, t('fancy'), 'fancy', t('fancyHint')));
        box.append(h('button', { class: 'toggle', onclick: () => {
          s.lang = getLang() === 'nl' ? 'en' : 'nl'; setLang(s.lang); saveSettings(s); g.localize(); g.audio.play('click'); this.show('settings');
        } }, h('span', { class: 'ic', html: ICON.globe }), h('span', { class: 'lb' }, t('language')), h('i', null, getLang() === 'nl' ? 'Nederlands' : 'English')));
      }
    };
    fill();
    return box;
  }

  // ---------- settings ----------
  _settings() {
    this.g.setMenuView('fly');
    this.root.append(
      h('div', { class: 'screen center' },
        h('div', { class: 'panel' },
          h('h2', null, t('settings')),
          this.toggles(true),
          h('div', { class: 'help' }, h('b', null, t('keysTitle')), h('p', null, t('keys1')), h('p', null, t('keys2')), h('p', null, t('keysPad'))),
          h('div', { class: 'btn-row' }, this.btn('go', ICON.check, t('done'), () => this.show('title'))))));
  }

  // ---------- sticker book ----------
  _book() {
    const g = this.g, book = g.book;
    g.setMenuView('fly');
    const section = (kind) => {
      const grid = h('div', { class: 'grid' });
      grid.append(h('button', { class: 'thumb new', onclick: async () => {
        this.click();
        const st = await openMaker(g, kind);
        if (st) this.show('book');
      } }, h('span', { class: 'ic', html: ICON.plus }), h('small', null, t(kind === 'driver' ? 'newDriver' : 'newVehicle'))));
      for (const st of book.custom.filter((s) => s.kind === kind)) {
        grid.append(h('button', { class: 'thumb mine', onclick: () => { this.click(); this.detail(st); } }, h('img', { src: thumbUrl(st), alt: st.name, draggable: false }), h('small', null, st.name)));
      }
      return h('div', { class: 'book-sec' }, h('h3', null, t(kind === 'driver' ? 'drivers' : 'vehicles')), grid);
    };
    this.root.append(
      h('div', { class: 'screen center' },
        h('div', { class: 'panel wide' },
          h('h2', null, t('myDrawings')),
          book.custom.length ? null : h('p', { class: 'tip' }, t('emptyBook')),
          section('driver'), section('vehicle'),
          h('div', { class: 'btn-row' }, this.btn('go', ICON.check, t('done'), () => this.show('title'))))));
  }

  detail(st) {
    const g = this.g;
    // Downloads are blocked inside some embedded viewers; the single-page share build hides the button.
    const canDownload = typeof KK_NO_DOWNLOAD === 'undefined';
    let armed = false;
    const del = h('button', { class: 'btn danger', onclick: async () => {
      this.click();
      if (!armed) { armed = true; del.lastChild.textContent = t('deleteAsk'); return; }
      await g.book.remove(st.id);
      pop.remove(); this.show('book');
    } }, h('span', { html: ICON.trash }), t('delete'));
    const pop = h('div', { class: 'screen center dim pop' },
      h('div', { class: 'panel' },
        h('h2', null, st.name),
        h('img', { class: 'big-sticker', src: thumbUrl(st), alt: st.name }),
        h('div', { class: 'btn-row' },
          canDownload ? h('a', { class: 'btn', href: thumbUrl(st), download: `${st.name}.png`, onclick: () => this.click() }, h('span', { html: ICON.download }), t('exportPng')) : null,
          del,
          this.btn('ghost', ICON.close, t('back'), () => pop.remove()))));
    this.root.append(pop);
  }
}
