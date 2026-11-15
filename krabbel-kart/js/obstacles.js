// Road obstacle seam. One ObstacleSystem per race, built after the ItemSystem, updated every
// race step and disposed with the race. Today it does nothing.
//
// It reads the obstacle list of the world: race.world.def.obstacles is
// [{ kind, at, lat, skin, ... }] where `at` is the fraction of a lap (0 to 1) and `lat` the
// sideways offset in metres. race.world.packSkins holds the looks the world pack brings:
// { name: (kit) => THREE.Object3D }. race.age says whether obstacles must stay soft ('little').
// Karts are hit with kart.hit({ by: null, cause, soft }), bounced with kart.launch / kart.bump.
export class ObstacleSystem {
  constructor(race) {
    this.race = race;
  }

  // time is the race clock in seconds.
  update(dt, time) {}

  dispose() {}
}
