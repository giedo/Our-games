// A game mode decides the rules of one race: how karts are placed, who is ahead, when
// it is over, what the results screen shows. Race keeps the machinery (karts, cameras,
// HUDs, input, bumping, particles, the intro/countdown/racing/ending/done states) and asks
// the mode through the hooks below. This base class is a plain lap race: subclass it and
// override only what differs (see race.js, and docs/DESIGN.md "Architecture (as built)").
import { clamp } from '../util.js';
import { t, addStrings } from '../i18n.js';

addStrings({
  en: { modeGroup: { race: 'Race', battle: 'Battle' }, endHere: 'Show results', items: 'Items', itemsAll: 'All', itemsTurbo: 'Only turbo', itemsNone: 'None' },
  nl: { modeGroup: { race: 'Racen', battle: 'Gevecht' }, endHere: 'Naar de uitslag', items: 'Spullen', itemsAll: 'Alles', itemsTurbo: 'Alleen turbo', itemsNone: 'Geen' },
});

const CONFETTI = [0xff4b4b, 0xffa53c, 0xffe14a, 0x5fe06a, 0x4fb8ff, 0xb46bff, 0xff7ac0];

export class Mode {
  // ---- static description (read by the menus; assigned below so old iPads are happy) ----
  // id, icon (inline svg), ages, arena, teams, needsTrack, series, karts, options(settings): see the Object.assign below.
  static options(settings) { return []; }

  constructor(race, opts) {
    this.race = race;
    this.opts = opts || {};
    this.endT = 0; // seconds since the first human finished
  }

  // How many laps count as finished. Infinity means karts never finish by laps (battle modes).
  lapCount() { return Number(this.opts.laps) || 3; }

  // Set to false to switch off the catch-up speed boost for computer racers.
  get allowRubberBand() { return true; }

  // Called once, after all karts exist and before the first frame: place them on the grid, hand out teams.
  // Default: computer racers in front, players at the back (more overtaking fun).
  setup() {
    const race = this.race, tr = race.world.track;
    const order = race.karts.filter((k) => !k.human).concat(race.humans);
    order.forEach((k, slot) => {
      const row = Math.floor(slot / 2), colm = slot % 2;
      k.placeAt(-(7 + row * 6 + colm * 3) / tr.seg, colm ? 3.8 : -3.8);
    });
  }

  // Every simulation step, in every race state (check race.state if you only care about 'racing').
  update(dt) {
    if (this.race.state === 'racing' && this.race.humans.some((k) => k.finished)) this.endT += dt;
  }

  // A kart crossed the line and started a new lap (never called for the finishing lap).
  onLap(kart) {
    if (!kart.human) return;
    const race = this.race, hud = race.huds[kart.playerIndex];
    if (kart.lap === race.laps - 1) { hud.message(t('finalLap'), 1.8, 'final'); race.game.audio.play('finalLap', 1); }
    else { hud.message(`${t('lap')} ${kart.lap + 1}`, 1.3); race.game.audio.play('lap', 1); }
  }

  // A kart finished all laps (kart.finished and kart.finishTime are already set).
  onFinish(kart) {
    const race = this.race;
    race.finishOrder.push(kart);
    race.rank();
    kart.gesture(kart.place <= 3 ? 'win' : 'lose');
    if (!kart.human) return;
    race.huds[kart.playerIndex].message(t('finish'), 2.2, 'final');
    race.game.audio.play(kart.place <= 3 ? 'win' : 'finish', 1);
    for (let i = 0; i < 4; i++) {
      race.particles.burst(false, CONFETTI, 40, kart.x + (Math.random() - 0.5) * 8, kart.y + 4 + Math.random() * 3, kart.z + (Math.random() - 0.5) * 8, 9, { size: 0.42, size1: 0.42, life: 2.6, gravity: 5, drag: 1.2 });
    }
  }

  // A kart really was hit (spun, flattened or popped; not shielded, not a soft bump).
  // attacker is a Kart or null (road obstacles), cause is a short string like 'puddle' or 'plane'.
  onHit(victim, attacker, cause) {}

  // Fill kart.place (1 = best) for every kart and set race.sorted (best first).
  // Default: finished karts by finish time, then by progress. Karts that are out come last.
  rank() {
    const race = this.race;
    const sorted = race.karts.slice().sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => { k.place = i + 1; });
    race.sorted = sorted;
  }

  // True when the race should stop (Race then shows the finish for a moment, then the results).
  // Default: every human is home, or 60 seconds after the first one.
  isOver() {
    const hs = this.race.humans;
    return hs.every((k) => k.finished) || this.endT > 60;
  }

  // What the results screen shows: { headline: string | null, rows: [...] }, best first.
  // A row: { place, name, human, playerIndex, driver, index, time?, team?, extra? } where
  // time is seconds (null when not finished; leave it out to hide the column), team is 0 | 1 | null
  // and extra is [{ text, cls? }] for more columns (points, stars...).
  results() {
    const race = this.race;
    race.rank();
    return {
      headline: null,
      rows: race.sorted.map((k) => ({
        place: k.place, name: k.name, human: k.human, playerIndex: k.playerIndex, driver: k.driver, index: race.karts.indexOf(k),
        time: k.finished ? k.finishTime : null,
      })),
    };
  }

  // What the HUD of one player shows. place and lap are plain text (or null to hide); the first
  // number in the text is drawn bold. extra is a row of small badges: [{ icon (svg string), text }].
  hudInfo(kart) {
    const race = this.race;
    return {
      place: t('place')[kart.place - 1] || String(kart.place),
      lap: `${t('lap')} ${clamp(kart.lap + 1, 1, race.laps)}/${race.laps}`,
      extra: [],
    };
  }

  // Item ids this kart may get from an item box, or null for "everything allowed by the age setting".
  itemPool(kart) { return null; }

  // For free-driving modes: return { x, z } and the computer driver steers there instead of
  // following the racing line (humans under autopilot too). Return null for normal racing.
  aiGoal(kart) { return null; }

  // ---- optional hooks added by the race modes (all have working defaults) ----
  // One line under the HUD: { text, sub?, cls? } or null. cls 'danger' pulses red, 'out' and 'go' colour it.
  hudBanner(kart) { return null; }

  // A button under the banner: { label, fn } or null.
  hudAction(kart) { return null; }

  // For a kart that is out: the kart its camera should follow (or null to orbit itself).
  spectate(kart) { return null; }

  // True to skip the 3-2-1 and start at once (free driving).
  get skipCountdown() { return false; }

  // False hides the wrong-way warning.
  get showWrongWay() { return true; }

  // The pause menu shows an "End" button when this is true; it shows the results instead of throwing them away.
  canEnd() { return false; }

  endNow() {
    const r = this.race;
    if (r.state === 'racing') { r.state = 'ending'; r.stateT = 3.4; }
  }

  dispose() {}
}

// Class level description of a mode. Subclasses override with Object.assign(MyMode, { ... }).
//   id          unique id (also the key of strings modes.<id> and modeSub.<id>, and of settings.modeOpts)
//   icon        inline svg shown on the mode card
//   ages        which age groups see the mode: ['little', 'big']
//   arena       true: the race runs on the arena variant of the chosen world (see arenaDef in tracks.js)
//   teams       true: the mode uses kart.team (informational for menus)
//   needsTrack  false: the track picker shows no world cards (the mode runs on settings.track as it is)
//   series      true: a multi-race flow owned by main.js (the Grand Prix), the mode itself is not raced
//   karts       how many karts race in total (players + computer racers)
Object.assign(Mode, { id: 'mode', icon: '', ages: ['little', 'big'], arena: false, teams: false, needsTrack: true, series: false, karts: 8, group: 'race', maxPlayers: 2, humanRows: false });
// group: 'race' | 'battle' (mode picker sections). maxPlayers: modes for one player only hide on the 2 player menu.
// humanRows: the results list only the players. static cardNote(worldId, settings) -> text on the track card (optional).
