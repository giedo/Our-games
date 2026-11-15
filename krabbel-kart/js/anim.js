// Character animation seam. One Animator per racer model (a kart, the menu preview, a podium
// racer). It is updated every frame AFTER the owner has set its own transforms, so it can
// layer extra motion on the model without fighting them. Today it does nothing.
//
// Where to put transforms (all of these are identity groups, safe to set absolutely each frame):
//   model.anim        the whole racer above the physics lean (vehicle and driver together)
//   model.driverAnim  just the driver's drawing (squash, wiggle, twirl)
//   model.pivot       the seat: the kart code sets its rotation every frame, so add to it
//                     (read the value, then write) instead of replacing it
// Gestures: select, idle, throw, win, lose, hit, overtake, boost (see docs/DESIGN.md).
export class Animator {
  // model: what buildRacerModel returned. opts: { kart } for race karts, { preview: true } for the
  // menu preview, { podium: true, rank } for podium racers.
  constructor(model, opts) {
    this.model = model;
    this.opts = opts || {};
  }

  // Start a gesture by name. opts is free for the gesture ({ strength }, ...).
  play(name, opts) {}

  // state is the owner: the Kart in a race (speed, steerNow, driftDir, boostT, ...), null elsewhere.
  update(dt, time, state) {}

  dispose() {}
}
