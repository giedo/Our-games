// Look + landscape recipe for every world: sky, light, terrain shape and colours.
// The four built-in worlds live here; world packs (js/worlds/) bring their own theme().
//
// A theme is a plain object: id, sky, fog, light, water (or null), road, clouds, ambient,
// blendNear, blendFar, height(x, z), color(x, z, h, slope, d, out), plus these optional fields:
//   terrainShadow  the terrain casts shadows (canyon walls)
//   night          scenery shadows are bluish and weaker (default false)
//   detail         { strokes, kind } of the little marks on the ground texture: kind is
//                  'blades' (default), 'ripples' or 'sparkle', or 'custom' with detail.draw(g, size, rnd)
//   water.ocean    true adds an endless ocean around the landscape (island)
//   ambient.cfg    overrides the floating particles: { n, box, size, vel: [x, y, z], op }
//   onBuilt(world, kit)  called at the very end of World construction, to restyle materials
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise, smoothstep, clamp, mix3 } from './util.js';
import { packById } from './worlds/index.js';
import { KIT } from './scenery.js';

const C = (hex) => new THREE.Color(hex);

export function makeTheme(id, seed, bounds) {
  const th = buildTheme(id, seed, bounds);
  if (!th.id) th.id = id;
  if (!th.detail) th.detail = { strokes: 900, kind: 'blades' };
  return th;
}

function buildTheme(id, seed, bounds) {
  const pack = packById(id);
  if (pack) return pack.theme(seed, bounds, KIT);
  const N = makeNoise(seed);
  const N2 = makeNoise(seed + 101);
  const cx = bounds.cx, cz = bounds.cz;
  const rad = (x, z) => Math.hypot(x - cx, z - cz);

  if (id === 'meadow') {
    const g1 = C(0x74c64a), g2 = C(0x4fa238), g3 = C(0xa6dc5e), dirt = C(0xb79a62),
      rock = C(0x8f968c), snow = C(0xffffff), sand = C(0xe9dca0), dark = C(0x3d8a3a);
    return {
      id,
      sky: { top: 0x1e6fe0, mid: 0x8fd0ff, bottom: 0xdff4ff, sunColor: 0xfff3c4, sunDir: [0.45, 0.62, 0.35], stars: 0, aurora: 0 },
      fog: { color: 0xcfeaff, near: 140, far: 950 },
      light: { sun: 0xfff1d0, sunI: 2.6, sky: 0xbfe2ff, ground: 0x7fae5a, hemiI: 1.5 },
      water: { level: -3.2, shallow: 0x58d6e8, deep: 0x1c6fc0, foam: 0xffffff, ice: 0 },
      road: { tint: 0x6f7480, line: '#ffffff', curbA: '#ff4b4b', curbB: '#ffffff', shoulder: 0x9bcf63 },
      clouds: { color: 0xffffff, count: 26, minY: 150, maxY: 240 },
      ambient: { kind: 'pollen', color: 0xffffee },
      detail: { strokes: 900, kind: 'blades' },
      blendNear: 8, blendFar: 74,
      height(x, z) {
        let h = N.fbm(x * 0.0055, z * 0.0055, 4) * 20 + N2.fbm(x * 0.021, z * 0.021, 2) * 2.2 + 3;
        const r = rad(x, z);
        const m = smoothstep(290, 640, r);
        h += m * m * 150 + m * N2.fbm(x * 0.012, z * 0.012, 3) * 45;
        return h;
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.025, z * 0.025) * 0.5 + 0.5;
        mix3(out, g1, g2, n);
        const n2 = N.noise(x * 0.06 + 30, z * 0.06);
        if (n2 > 0.15) mix3(out, out, g3, (n2 - 0.15) * 1.1);
        if (h > 28) mix3(out, out, dark, smoothstep(28, 55, h) * 0.8);
        if (slope > 0.5) mix3(out, out, rock, smoothstep(0.5, 0.85, slope));
        if (h > 62) mix3(out, out, rock, smoothstep(62, 85, h));
        if (h > 95) mix3(out, out, snow, smoothstep(95, 118, h + n * 14));
        if (h < -2.0) mix3(out, out, sand, smoothstep(-2.0, -3.0, h));
        if (d < 12) mix3(out, out, g3, 0.35);
        return out;
      },
    };
  }

  if (id === 'canyon') {
    const strata = [C(0x7d2f2a), C(0xb5472f), C(0xd96a3c), C(0xf09a55), C(0xc9573a), C(0xe9824a), C(0x9a3a30)];
    const top = C(0xf3b56c), green = C(0x8aa04e), floor = C(0xe8a25c), dark = C(0x5a2330);
    return {
      id,
      terrainShadow: true, // canyon walls throw long evening shadows over the road
      sky: { top: 0x2b1e6e, mid: 0xff7a45, bottom: 0xffd58a, sunColor: 0xffc070, sunDir: [-0.62, 0.2, -0.55], stars: 0.35, aurora: 0 },
      fog: { color: 0xffa868, near: 120, far: 900 },
      light: { sun: 0xffb070, sunI: 3.0, sky: 0xb48cff, ground: 0xd9703a, hemiI: 1.25 },
      water: { level: -2.0, shallow: 0x59e0c8, deep: 0x1d7f9a, foam: 0xfff2d8, ice: 0 },
      road: { tint: 0xa98676, line: '#fff0d0', curbA: '#ff8a1f', curbB: '#fff3d6', shoulder: 0xe0965a },
      clouds: { color: 0xffc7a0, count: 16, minY: 170, maxY: 260 },
      ambient: { kind: 'dust', color: 0xffd9a0 },
      detail: { strokes: 420, kind: 'ripples' },
      blendNear: 8, blendFar: 46,
      height(x, z) {
        const base = clamp(N.fbm(x * 0.0052, z * 0.0052, 4) * 1.05 + 0.5, 0, 1);
        const t = base * 5.2;
        const ft = Math.floor(t), fr = t - ft;
        const step = ft + smoothstep(0.38, 0.62, fr);
        let h = step * 13 - 4 + N2.fbm(x * 0.03, z * 0.03, 2) * 1.3;
        const r = rad(x, z);
        const m = smoothstep(300, 640, r);
        h += m * m * 110;
        return h;
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.02, z * 0.02);
        const band = Math.floor((h + 40) / 3.6 + n * 0.9);
        out.copy(strata[((band % strata.length) + strata.length) % strata.length]);
        if (slope < 0.22) mix3(out, out, top, smoothstep(0.22, 0.05, slope) * 0.85);
        if (h < 2 && slope < 0.3) mix3(out, out, floor, 0.5);
        if (h < -1.0) mix3(out, out, green, smoothstep(-1.0, -2.2, h) * 0.9);
        if (h > 90) mix3(out, out, dark, smoothstep(90, 150, h) * 0.6);
        return out;
      },
    };
  }

  if (id === 'island') {
    const wet = C(0xcdb97a), sand = C(0xf7e6ad), grass = C(0x62c45c), jungle = C(0x2a8f47),
      rock = C(0x6a5a52), lava = C(0xff5a1a), ash = C(0x3d3436), reef = C(0x9be7d2);
    const vx = cx + 15, vz = cz - 5;
    return {
      id,
      volcano: { x: vx, z: vz },
      sky: { top: 0x0f7fe6, mid: 0x7fd8ff, bottom: 0xe6fbff, sunColor: 0xfff6d8, sunDir: [-0.35, 0.72, 0.4], stars: 0, aurora: 0 },
      fog: { color: 0xbfeeff, near: 180, far: 1300 },
      light: { sun: 0xfff4dc, sunI: 2.8, sky: 0xbfeaff, ground: 0xe8d79a, hemiI: 1.55 },
      water: { level: 0, shallow: 0x49e8d6, deep: 0x0a5fb8, foam: 0xffffff, ice: 0, ocean: true },
      road: { tint: 0x9a8a78, line: '#fff8e0', curbA: '#18b8c8', curbB: '#ffffff', shoulder: 0xf0dc9c },
      clouds: { color: 0xffffff, count: 22, minY: 170, maxY: 260 },
      ambient: { kind: 'pollen', color: 0xffffff },
      detail: { strokes: 900, kind: 'blades' },
      blendNear: 8, blendFar: 60,
      height(x, z) {
        const r = rad(x, z);
        const R = 262 + N.fbm(x * 0.004, z * 0.004, 3) * 70;
        const land = smoothstep(R, R - 95, r);
        let h = -7 + land * 15 + N2.fbm(x * 0.009, z * 0.009, 4) * 7 * land;
        h -= smoothstep(R, R + 220, r) * 16;
        const dv = Math.hypot(x - vx, z - vz);
        const cone = Math.max(0, 1 - dv / 150);
        h += Math.pow(cone, 1.7) * 105;
        if (dv < 26) h -= (1 - dv / 26) * 26;
        return h;
      },
      color(x, z, h, slope, d, out) {
        const n = N2.noise(x * 0.03, z * 0.03) * 0.5 + 0.5;
        const dv = Math.hypot(x - vx, z - vz);
        if (h < 0.5) mix3(out, reef, wet, smoothstep(-4, 0.5, h));
        else if (h < 3.2) mix3(out, wet, sand, smoothstep(0.5, 1.6, h));
        else {
          mix3(out, sand, grass, smoothstep(3.2, 6.5, h + n * 2));
          mix3(out, out, jungle, smoothstep(7, 16, h) * (0.4 + n * 0.6));
        }
        if (slope > 0.6) mix3(out, out, rock, smoothstep(0.6, 0.95, slope));
        if (h > 38) mix3(out, out, rock, smoothstep(38, 60, h));
        if (h > 62) mix3(out, out, ash, smoothstep(62, 82, h));
        if (dv < 30) mix3(out, out, lava, smoothstep(30, 12, dv));
        return out;
      },
    };
  }

  if (id !== 'snow') return buildTheme('meadow', seed, bounds); // unknown id: fall back to the first world

  // snow
  const s1 = C(0xf6faff), s2 = C(0xcfe2fb), rockc = C(0x56637c), ice = C(0xa8e4ff), deep = C(0x8fb4e6);
  return {
    id: 'snow',
    night: true,
    sky: { top: 0x050a2c, mid: 0x15357a, bottom: 0x3f78b4, sunColor: 0xdfeaff, sunDir: [0.4, 0.5, -0.6], stars: 1, aurora: 1 },
    fog: { color: 0x2f5f9c, near: 130, far: 900 },
    light: { sun: 0xcfe0ff, sunI: 2.1, sky: 0x8fb8ff, ground: 0x5b7fc0, hemiI: 1.7 },
    water: { level: -7, shallow: 0xbfeeff, deep: 0x7fc4f0, foam: 0xffffff, ice: 1 },
    road: { tint: 0x56627e, line: '#d8f2ff', curbA: '#2d7dff', curbB: '#ffffff', shoulder: 0xdde9fb },
    clouds: { color: 0x6f8fc4, count: 10, minY: 200, maxY: 280 },
    ambient: { kind: 'snow', color: 0xffffff },
    detail: { strokes: 260, kind: 'sparkle' },
    blendNear: 8, blendFar: 64,
    height(x, z) {
      const ridge = 1 - Math.abs(N2.fbm(x * 0.006, z * 0.006, 3));
      let h = N.fbm(x * 0.0048, z * 0.0048, 4) * 34 + ridge * ridge * 22 - 6;
      const r = rad(x, z);
      const m = smoothstep(270, 640, r);
      h += m * m * 190 + m * ridge * 60;
      return h;
    },
    color(x, z, h, slope, d, out) {
      const n = N2.noise(x * 0.03, z * 0.03) * 0.5 + 0.5;
      mix3(out, s1, s2, n * 0.8);
      if (slope > 0.62) mix3(out, out, rockc, smoothstep(0.62, 0.95, slope));
      if (h < -5.5) mix3(out, out, ice, smoothstep(-5.5, -7, h));
      if (h > 120) mix3(out, out, deep, smoothstep(120, 220, h) * 0.4);
      return out;
    },
  };
}

