// Builds one complete race world: terrain, road, sky, water, clouds and scenery.
import * as THREE from '../vendor/three.module.min.js';
import { Track } from './tracks.js';
import { makeTheme } from './themes.js';
import { buildScenery, KIT } from './scenery.js';
import { packById } from './worlds/index.js';
import { mulberry32, makeNoise, smoothstep, lerp, makeCanvas, canvasTexture, disposeTree, TAU } from './util.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop, uMid, uBottom, uSunDir, uSunColor;
uniform float uTime, uStars, uAurora;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
  c = mix(c, uBottom, smoothstep(0.16, -0.05, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSunColor * (smoothstep(0.9993, 0.9997, sd) * 2.5 + pow(sd, 90.0) * 0.55 + pow(sd, 7.0) * 0.22);
  if (uStars > 0.0) {
    vec3 sp = d * 170.0;
    vec3 cell = floor(sp);
    float hs = hash(cell);
    float star = step(0.9962, hs) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
    star *= 0.55 + 0.45 * sin(uTime * 2.5 + hs * 90.0);
    c += vec3(star) * uStars * smoothstep(0.02, 0.25, h) * 1.4;
  }
  if (uAurora > 0.0) {
    float a = atan(d.x, d.z);
    float glow = 0.0;
    vec3 ac = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y0 = 0.17 + fi * 0.085 + 0.06 * sin(a * 3.0 + uTime * 0.21 + fi * 2.1) + 0.035 * sin(a * 7.0 - uTime * 0.33 + fi);
      float curtain = smoothstep(y0 - 0.012, y0 + 0.012, h) * smoothstep(y0 + 0.36, y0, h);
      float rays = 0.55 + 0.45 * sin(a * 58.0 + uTime * 0.8 + sin(a * 11.0 + fi * 4.0) * 3.0);
      float band = curtain * rays * (0.6 + 0.4 * sin(a * 2.0 + fi * 1.7 + uTime * 0.1));
      vec3 lowc = mix(vec3(0.15, 1.0, 0.55), vec3(0.1, 0.85, 1.0), fi * 0.5);
      vec3 highc = vec3(0.75, 0.25, 1.0);
      ac += mix(lowc, highc, smoothstep(y0, y0 + 0.3, h)) * band;
      glow += band;
    }
    c += ac * uAurora * 0.75;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VERT = /* glsl */ `
attribute float depth;
uniform float uTime, uIce;
varying float vDepth;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vDepth = depth;
  vec3 p = position;
  p.y += (sin(p.x * 0.12 + uTime * 1.3) + cos(p.z * 0.1 + uTime * 1.1)) * 0.11 * (1.0 - uIce);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uShallow, uDeep, uFoam, uSky, uSunDir, uSunColor;
uniform float uTime, uIce;
varying float vDepth;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 p = vWorld.xz;
  float t = uTime * (1.0 - uIce);
  vec2 g = vec2(
    cos(p.x * 0.35 + t * 1.6) * 0.5 + cos(p.x * 0.9 + p.y * 0.7 - t * 2.1) * 0.35 + cos(p.x * 2.3 - p.y * 1.7 + t * 3.0) * 0.15,
    cos(p.y * 0.31 - t * 1.3) * 0.5 + cos(p.y * 1.1 - p.x * 0.6 + t * 1.9) * 0.35 + cos(p.y * 2.1 + p.x * 1.9 - t * 2.7) * 0.15);
  vec3 N = normalize(vec3(-g.x * 0.2, 1.0, -g.y * 0.2));
  float dd = max(vDepth, 0.0);
  vec3 c = mix(uShallow, uDeep, pow(clamp(dd / 8.0, 0.0, 1.0), 0.65));
  float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
  c = mix(c, uSky, fres * 0.6);
  vec3 H = normalize(normalize(uSunDir) + V);
  c += uSunColor * pow(max(dot(N, H), 0.0), 140.0) * 1.6;
  float wave = sin(dd * 4.5 - uTime * 1.8 + sin(p.x * 0.3) + cos(p.y * 0.27)) * 0.5 + 0.5;
  float foam = smoothstep(1.5, 0.0, dd) * (0.4 + 0.6 * wave);
  foam = smoothstep(0.38, 0.72, foam) * (1.0 - uIce);
  c = mix(c, uFoam, foam);
  float alpha = mix(0.5, 0.94, smoothstep(0.0, 3.0, dd));
  alpha = max(alpha, foam);
  if (uIce > 0.5) {
    float sp = hash2(floor(p * 1.5));
    float glint = step(0.985, sp) * (0.5 + 0.5 * sin(uTime * 3.0 + sp * 60.0));
    c = mix(uShallow, uDeep, clamp(dd / 5.0, 0.0, 1.0) * 0.6);
    c = mix(c, uSky, fres * 0.5) + vec3(glint) * 0.6;
    alpha = 0.96;
  }
  gl_FragColor = vec4(c, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const DUST_VERT = /* glsl */ `
attribute float aRnd;
uniform vec3 uCam, uVel;
uniform float uTime, uBox, uSize, uScale;
varying float vAlpha;
void main() {
  vec3 p = position + uVel * uTime;
  p.x += sin(uTime * 0.7 + aRnd * 40.0) * 1.6;
  p.z += cos(uTime * 0.6 + aRnd * 31.0) * 1.6;
  p = mod(p - uCam, uBox) - uBox * 0.5 + uCam;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aRnd) * uScale / max(-mv.z, 0.1);
  vAlpha = smoothstep(uBox * 0.5, uBox * 0.3, length(p - uCam)) * smoothstep(1.0, 4.0, -mv.z);
}`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const SMOKE_VERT = /* glsl */ `
attribute float aRnd;
uniform float uTime, uScale;
varying float vAlpha;
void main() {
  float age = fract(uTime * 0.035 + aRnd);
  vec3 p = position;
  p.y += age * 150.0;
  p.x += age * age * 90.0 + sin(aRnd * 50.0 + age * 5.0) * 10.0 * age;
  p.z += cos(aRnd * 33.0 + age * 4.0) * 10.0 * age;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (22.0 + age * 70.0) * uScale / max(-mv.z, 0.1);
  vAlpha = smoothstep(0.0, 0.08, age) * (1.0 - age) * 0.5;
}`;

const SMOKE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export class World {
  constructor(def) {
    this.def = def;
    this.track = new Track(def);
    // The look comes from def.theme when it differs from the track id (arena variants of a world).
    this.themeId = def.theme || def.id;
    this.theme = makeTheme(this.themeId, def.seed, this.track.bounds);
    const pack = packById(this.themeId);
    this.packSkins = (pack && pack.skins) || {}; // obstacle looks supplied by the world pack
    // Physics a pack may change (also for its arena variant): gravity in m/s2, hover height in metres
    // (karts float above the road on a glow, see Kart).
    this.gravity = (pack && pack.gravity) || 30;
    this.hover = (pack && pack.hover) || 0;
    this.scene = new THREE.Scene();
    this.rnd = mulberry32(def.seed * 977 + 5);
    this.noise = makeNoise(def.seed + 7).noise;
    this.time = 0;
    this.updaters = [];
    this.timeUniforms = [];
    this.pointScaleUniforms = [];
    this._info = {};
    const th = this.theme;
    this.scene.fog = new THREE.Fog(th.fog.color, th.fog.near, th.fog.far);
    this.sunDir = new THREE.Vector3(...th.sky.sunDir).normalize();
    this.dustColor = th.road.shoulder;
    this._buildLights();
    this._buildSky();
    this._buildTerrain();
    this._buildRoad();
    this._buildWater();
    this._buildClouds();
    buildScenery(this);
    this._buildAmbient();
    if (th.onBuilt) th.onBuilt(this, KIT); // last chance for a theme to restyle materials
  }

  _buildLights() {
    const L = this.theme.light;
    const hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemiI);
    const sun = new THREE.DirectionalLight(L.sun, L.sunI);
    sun.position.copy(this.sunDir).multiplyScalar(100);
    // Real shadows in a box that follows the player (see focusShadow).
    const R = 58;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 300;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.35;
    this.shadowTexel = (2 * R) / 2048;
    this.shadowR = new THREE.Vector3(0, 1, 0).cross(this.sunDir).normalize();
    this.shadowU = this.sunDir.clone().cross(this.shadowR).normalize();
    this.sun = sun;
    this.scene.add(hemi, sun, sun.target);
    this.setShadows(true);
  }

  setShadows(on) {
    this.shadowsOn = on;
    this.sun.castShadow = on;
  }

  // Centre the shadow box on a point. The point is snapped to whole shadow-map
  // pixels so shadows do not shimmer while the camera moves.
  focusShadow(x, y, z) {
    if (!this.shadowsOn) return;
    const t = this.shadowTexel, r = this.shadowR, u = this.shadowU, d = this.sunDir;
    const a = Math.round((x * r.x + y * r.y + z * r.z) / t) * t;
    const b = Math.round((x * u.x + y * u.y + z * u.z) / t) * t;
    const c = x * d.x + y * d.y + z * d.z;
    const fx = r.x * a + u.x * b + d.x * c, fy = r.y * a + u.y * b + d.y * c, fz = r.z * a + u.z * b + d.z * c;
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx + d.x * 150, fy + d.y * 150, fz + d.z * 150);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  _buildSky() {
    const s = this.theme.sky;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(s.top) }, uMid: { value: new THREE.Color(s.mid) },
        uBottom: { value: new THREE.Color(s.bottom) }, uSunDir: { value: this.sunDir.clone() },
        uSunColor: { value: new THREE.Color(s.sunColor) }, uTime: { value: 0 },
        uStars: { value: s.stars }, uAurora: { value: s.aurora },
      },
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.timeUniforms.push(mat.uniforms.uTime);
  }

  _buildTerrain() {
    const tr = this.track, th = this.theme, b = tr.bounds;
    const ext = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const S = ext + 660, G = 208;
    const cell = S / G;
    this.tS = S; this.tG = G; this.tCell = cell;
    this.tX0 = b.cx - S / 2; this.tZ0 = b.cz - S / 2;
    const n1 = G + 1;
    const hs = new Float32Array(n1 * n1);
    const ds = new Float32Array(n1 * n1);
    const info = {};
    const arena = !!this.def.arena; // arenas: flat island inside the ring, the landscape rises further out
    const D1 = tr.halfWidth + (arena ? 4 : th.blendNear), D2 = tr.halfWidth + (arena ? 55 : th.blendFar);
    for (let iz = 0; iz < n1; iz++) {
      for (let ix = 0; ix < n1; ix++) {
        const x = this.tX0 + ix * cell, z = this.tZ0 + iz * cell;
        let h = th.height(x, z);
        tr.distInfo(x, z, info);
        if (arena && this.inIsland(x, z)) h = info.y - 0.35;
        else if (info.d < D2) {
          const a = smoothstep(D1, D2, info.d);
          h = lerp(info.y - 0.35, h, a);
        }
        hs[iz * n1 + ix] = h;
        ds[iz * n1 + ix] = info.d;
      }
    }
    this.heights = hs;
    this.dists = ds;
    const pos = new Float32Array(n1 * n1 * 3);
    const colr = new Float32Array(n1 * n1 * 3);
    const c = new THREE.Color();
    for (let iz = 0; iz < n1; iz++) {
      for (let ix = 0; ix < n1; ix++) {
        const k = iz * n1 + ix;
        const x = this.tX0 + ix * cell, z = this.tZ0 + iz * cell;
        const h = hs[k];
        const hx = hs[iz * n1 + Math.min(G, ix + 1)] - hs[iz * n1 + Math.max(0, ix - 1)];
        const hz = hs[Math.min(G, iz + 1) * n1 + ix] - hs[Math.max(0, iz - 1) * n1 + ix];
        const slope = Math.hypot(hx, hz) / (2 * cell);
        th.color(x, z, h, slope, ds[k], c);
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
      }
    }
    const idx = new Uint32Array(G * G * 6);
    let o = 0;
    for (let iz = 0; iz < G; iz++) {
      for (let ix = 0; ix < G; ix++) {
        const v00 = iz * n1 + ix, v10 = v00 + 1, v01 = v00 + n1, v11 = v01 + 1;
        idx[o++] = v00; idx[o++] = v01; idx[o++] = v10;
        idx[o++] = v01; idx[o++] = v11; idx[o++] = v10;
      }
    }
    const uv = new Float32Array(n1 * n1 * 2);
    for (let k = 0; k < n1 * n1; k++) { uv[k * 2] = pos[k * 3] / 13; uv[k * 2 + 1] = pos[k * 3 + 2] / 13; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals(); // only used to push shadows off the surface; shading stays faceted
    geo.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: this._detailTexture() });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = !!th.terrainShadow;
    this.scene.add(mesh);
    this.terrainMesh = mesh;
  }

  // A soft tiling texture multiplied over the terrain colours: mottling plus
  // little strokes (grass blades, sand ripples, snow sparkle) so the ground is not flat paint.
  _detailTexture() {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const rnd = mulberry32(this.def.seed + 31);
    const detail = this.theme.detail, kind = detail.kind;
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
    // Big soft blotches, drawn wrapped so the tile repeats without seams.
    for (let i = 0; i < 46; i++) {
      const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 46, dark = rnd() < 0.55;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, dark ? 'rgba(150,150,150,0.20)' : 'rgba(255,255,255,0.30)');
        gr.addColorStop(1, dark ? 'rgba(150,150,150,0)' : 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    g.lineCap = 'round';
    if (kind === 'custom' && detail.draw) detail.draw(g, S, rnd);
    else {
      for (let i = 0; i < detail.strokes; i++) {
        const x = rnd() * S, y = rnd() * S, dark = rnd() < 0.6;
        g.strokeStyle = dark ? 'rgba(120,120,120,0.32)' : 'rgba(255,255,255,0.5)';
        g.lineWidth = 1 + rnd() * 1.4;
        g.beginPath();
        if (kind === 'ripples') { g.moveTo(x, y); g.lineTo(x + 6 + rnd() * 16, y + (rnd() - 0.5) * 2); }
        else if (kind === 'sparkle') { g.moveTo(x, y); g.lineTo(x + 0.5, y + 0.5); }
        else { g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5); }
        g.stroke();
      }
    }
    return canvasTexture(c, { repeat: true });
  }

  // Arenas: is this point inside the ring (the island)? Scenery keeps clear of it.
  inIsland(x, z) {
    if (!this.def.arena) return false;
    const tr = this.track, i = tr.nearestIndex(x, z);
    if (i < 0) return false;
    const b = tr.bounds, ax = tr.px[i] - b.cx, az = tr.pz[i] - b.cz;
    return (x - b.cx) * ax + (z - b.cz) * az < ax * ax + az * az;
  }

  // Terrain height (matches the triangles of the terrain mesh exactly).
  heightAt(x, z) {
    const G = this.tG, n1 = G + 1;
    let fx = (x - this.tX0) / this.tCell, fz = (z - this.tZ0) / this.tCell;
    if (fx < 0) fx = 0; else if (fx > G - 0.001) fx = G - 0.001;
    if (fz < 0) fz = 0; else if (fz > G - 0.001) fz = G - 0.001;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    fx -= ix; fz -= iz;
    const hs = this.heights;
    const h00 = hs[iz * n1 + ix], h10 = hs[iz * n1 + ix + 1];
    const h01 = hs[(iz + 1) * n1 + ix], h11 = hs[(iz + 1) * n1 + ix + 1];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  slopeAt(x, z) {
    const e = this.tCell * 0.6;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  }

  // Ground height for a kart. loc = result of track.locate for the same point.
  groundAt(x, z, loc) {
    const e = Math.abs(loc.lat) - (this.track.halfWidth + this.track.curb);
    if (e <= 0) return loc.y;
    const th = this.heightAt(x, z);
    if (e >= 1.6) return th;
    return lerp(loc.y, th, e / 1.6);
  }

  _roadTexture() {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    g.fillStyle = '#d2d2d2'; g.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(7);
    for (let i = 0; i < 2600; i++) {
      const v = 170 + Math.floor(rnd() * 80);
      g.fillStyle = `rgba(${v},${v},${v},0.55)`;
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2.2, 1 + rnd() * 2.2);
    }
    // Faint darker driving lanes.
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.3, 'rgba(0,0,0,0.10)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.02)'); grad.addColorStop(0.7, 'rgba(0,0,0,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = this.theme.road.line;
    g.fillRect(9, 0, 6, 256); g.fillRect(241, 0, 6, 256);
    g.fillRect(125, 20, 6, 96);
    g.fillRect(125, 148, 6, 96);
    return canvasTexture(c, { repeat: true });
  }

  _curbTexture() {
    const c = makeCanvas(32, 64), g = c.getContext('2d');
    g.fillStyle = this.theme.road.curbA; g.fillRect(0, 0, 32, 32);
    g.fillStyle = this.theme.road.curbB; g.fillRect(0, 32, 32, 32);
    return canvasTexture(c, { repeat: true });
  }

  _buildRoad() {
    const tr = this.track, n = tr.n, hw = tr.halfWidth, cw = tr.curb;
    const rows = n + 1;
    // Road surface.
    {
      const pos = new Float32Array(rows * 2 * 3), uv = new Float32Array(rows * 2 * 2);
      for (let r = 0; r < rows; r++) {
        const i = r % n;
        const x = tr.px[i], y = tr.py[i], z = tr.pz[i], rx = tr.rx[i], rz = tr.rz[i];
        pos.set([x - rx * hw, y, z - rz * hw, x + rx * hw, y, z + rz * hw], r * 6);
        const v = (r * tr.seg) / 16;
        uv.set([0, v, 1, v], r * 4);
      }
      const idx = [];
      for (let r = 0; r < n; r++) {
        const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ map: this._roadTexture(), color: this.theme.road.tint });
      mat.color.multiplyScalar(1.5);
      const road = new THREE.Mesh(geo, mat);
      road.receiveShadow = true;
      this.scene.add(road);
    }
    // Curbs (both sides) with striped texture.
    {
      const pos = [], uv = [], idx = [];
      for (const side of [-1, 1]) {
        const base = pos.length / 3;
        for (let r = 0; r < rows; r++) {
          const i = r % n;
          const x = tr.px[i], y = tr.py[i], z = tr.pz[i], rx = tr.rx[i] * side, rz = tr.rz[i] * side;
          pos.push(x + rx * hw, y + 0.03, z + rz * hw, x + rx * (hw + cw), y + 0.14, z + rz * (hw + cw));
          const v = (r * tr.seg) / 6;
          uv.push(0, v, 1, v);
        }
        for (let r = 0; r < n; r++) {
          const a = base + r * 2, b = a + 1, c = a + 2, d = a + 3;
          if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const curbs = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this._curbTexture() }));
      curbs.receiveShadow = true;
      this.scene.add(curbs);
    }
    // Shoulders: a soft skirt that hides the seam between road and terrain.
    {
      const pos = [], idx = [];
      for (const side of [-1, 1]) {
        const base = pos.length / 3;
        for (let r = 0; r < rows; r++) {
          const i = r % n;
          const x = tr.px[i], y = tr.py[i], z = tr.pz[i], rx = tr.rx[i] * side, rz = tr.rz[i] * side;
          pos.push(x + rx * (hw + cw), y + 0.14, z + rz * (hw + cw), x + rx * (hw + cw + 2.6), y - 0.5, z + rz * (hw + cw + 2.6));
        }
        for (let r = 0; r < n; r++) {
          const a = base + r * 2, b = a + 1, c = a + 2, d = a + 3;
          if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const skirt = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: this.theme.road.shoulder }));
      skirt.receiveShadow = true;
      this.scene.add(skirt);
    }
    // Start / finish line.
    if (!this.def.arena) {
      const c = makeCanvas(128, 64), g = c.getContext('2d');
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
      const tex = canvasTexture(c, { repeat: true });
      tex.repeat.set(3, 1);
      const mesh = this.roadDecal(0, 0, hw * 2, 3.2, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    // Boost pads.
    this.boostPads = [];
    {
      const c = makeCanvas(64, 64), g = c.getContext('2d');
      g.fillStyle = '#ff7a00'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffe600';
      for (let k = -1; k < 3; k++) {
        const y = k * 32;
        g.beginPath();
        g.moveTo(0, y + 32); g.lineTo(32, y + 8); g.lineTo(64, y + 32); g.lineTo(64, y + 46); g.lineTo(32, y + 22); g.lineTo(0, y + 46);
        g.closePath(); g.fill();
      }
      const tex = canvasTexture(c, { repeat: true });
      tex.repeat.set(1, 2);
      const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.padTexture = tex;
      for (const [frac, lat] of this.def.boostPads) {
        const s = frac * n;
        this.scene.add(this.roadDecal(s, lat, 5.5, 8, mat));
        this.boostPads.push({ s, lat, halfW: 3.2, halfL: 4.6 / tr.seg });
      }
      this.updaters.push((dt) => { tex.offset.y -= dt * 2.2; });
    }
    // Item box spots.
    this.itemSpots = [];
    for (const frac of this.def.itemRows) {
      for (const lat of this.def.itemLats || [-5.4, -1.8, 1.8, 5.4]) {
        const p = tr.posAt(frac * n, lat, new THREE.Vector3());
        this.itemSpots.push({ s: frac * n, lat, pos: p });
      }
    }
  }

  // A flat quad lying on the road, centred at (s, lat).
  roadDecal(s, lat, width, length, material) {
    const tr = this.track;
    const steps = Math.max(2, Math.ceil(length / tr.seg));
    const pos = [], uv = [], idx = [];
    const p = new THREE.Vector3();
    for (let k = 0; k <= steps; k++) {
      const ss = s + ((k / steps) - 0.5) * (length / tr.seg);
      tr.posAt(ss, lat - width / 2, p); pos.push(p.x, p.y + 0.02, p.z);
      tr.posAt(ss, lat + width / 2, p); pos.push(p.x, p.y + 0.02, p.z);
      uv.push(0, k / steps, 1, k / steps);
    }
    for (let k = 0; k < steps; k++) {
      const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  _buildWater() {
    const w = this.theme.water;
    if (!w) return;
    const G = 120, n1 = G + 1, S = this.tS, cell = S / G;
    const pos = new Float32Array(n1 * n1 * 3), dep = new Float32Array(n1 * n1);
    let any = false;
    for (let iz = 0; iz < n1; iz++) for (let ix = 0; ix < n1; ix++) {
      const k = iz * n1 + ix;
      const x = this.tX0 + ix * cell, z = this.tZ0 + iz * cell;
      pos[k * 3] = x; pos[k * 3 + 1] = w.level; pos[k * 3 + 2] = z;
      dep[k] = w.level - this.heightAt(x, z);
      if (dep[k] > 0) any = true;
    }
    this.waterLevel = w.level;
    if (!any) return;
    // Only keep cells that actually touch water: saves a lot of overdraw.
    const idx = [];
    for (let iz = 0; iz < G; iz++) for (let ix = 0; ix < G; ix++) {
      const a = iz * n1 + ix, b = a + 1, c = a + n1, d = c + 1;
      if (dep[a] > -0.6 || dep[b] > -0.6 || dep[c] > -0.6 || dep[d] > -0.6) idx.push(a, c, b, c, d, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.BufferAttribute(dep, 1));
    geo.setIndex(idx);
    const sky = new THREE.Color(this.theme.sky.mid);
    const mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uShallow: { value: new THREE.Color(w.shallow) }, uDeep: { value: new THREE.Color(w.deep) },
        uFoam: { value: new THREE.Color(w.foam) }, uSky: { value: sky },
        uSunDir: { value: this.sunDir.clone() }, uSunColor: { value: new THREE.Color(this.theme.sky.sunColor) },
        uTime: { value: 0 }, uIce: { value: w.ice },
      }]),
      transparent: true, depthWrite: false, fog: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    this.timeUniforms.push(mat.uniforms.uTime);
    if (w.ocean) {
      // Endless ocean beyond the landscape (island).
      const R0 = S / 2 - 2, R1 = 7000;
      const ring = new THREE.RingGeometry(R0, R1, 4, 1, Math.PI / 4);
      ring.rotateX(-Math.PI / 2);
      // Square the inner hole so it meets the grid edge.
      const p = ring.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const r = Math.hypot(x, z);
        if (r < R0 + 1) {
          const m = Math.max(Math.abs(x), Math.abs(z)) || 1;
          p.setXYZ(i, (x / m) * (S / 2), 0, (z / m) * (S / 2));
        }
      }
      ring.translate(this.track.bounds.cx, w.level, this.track.bounds.cz);
      ring.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(p.count).fill(30), 1));
      const outer = new THREE.Mesh(ring, mat);
      outer.renderOrder = 1;
      this.scene.add(outer);
    }
  }

  _buildClouds() {
    const cl = this.theme.clouds, rnd = this.rnd, b = this.track.bounds;
    if (!cl || !cl.count) return;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: cl.color, flatShading: true, fog: false, emissive: cl.color, emissiveIntensity: 0.5 });
    const puffs = [];
    for (let i = 0; i < cl.count; i++) {
      const a = rnd() * TAU, r = 250 + rnd() * 950;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = lerp(cl.minY, cl.maxY, rnd());
      const sc = 14 + rnd() * 22;
      const np = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < np; k++) {
        puffs.push({ x: x + (k - np / 2) * sc * 0.8 + rnd() * 6, y: y + rnd() * sc * 0.3, z: z + (rnd() - 0.5) * sc, sx: sc * (0.7 + rnd() * 0.6), sy: sc * (0.4 + rnd() * 0.25) });
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
    const d = new THREE.Object3D();
    puffs.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z); d.scale.set(p.sx, p.sy, p.sx * 0.8); d.rotation.set(0, rnd() * 3, 0);
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    });
    mesh.frustumCulled = false;
    const grp = new THREE.Group();
    grp.position.set(b.cx, 0, b.cz);
    grp.add(mesh);
    this.scene.add(grp);
    this.updaters.push((dt) => { grp.rotation.y += dt * 0.004; });
  }

  _buildAmbient() {
    const am = this.theme.ambient, rnd = this.rnd;
    if (!am) return;
    const cfg = Object.assign({}, {
      pollen: { n: 260, box: 70, size: 0.22, vel: [0.6, 0.25, 0.3], op: 0.75 },
      dust: { n: 300, box: 70, size: 0.2, vel: [2.4, 0.1, 1.0], op: 0.55 },
      snow: { n: 900, box: 60, size: 0.26, vel: [0.8, -3.2, 0.4], op: 0.95 },
    }[am.kind] || { n: 260, box: 70, size: 0.22, vel: [0.6, 0.25, 0.3], op: 0.75 }, am.cfg);
    const pos = new Float32Array(cfg.n * 3), rn = new Float32Array(cfg.n);
    for (let i = 0; i < cfg.n; i++) {
      pos[i * 3] = rnd() * cfg.box; pos[i * 3 + 1] = rnd() * cfg.box; pos[i * 3 + 2] = rnd() * cfg.box;
      rn[i] = rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
      uniforms: {
        uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3(...cfg.vel) },
        uTime: { value: 0 }, uBox: { value: cfg.box }, uSize: { value: cfg.size }, uScale: { value: 600 },
        uColor: { value: new THREE.Color(am.color) }, uOpacity: { value: cfg.op },
      },
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    pts.onBeforeRender = (renderer, scene, camera) => {
      mat.uniforms.uCam.value.copy(camera.position);
      mat.uniformsNeedUpdate = true;
    };
    this.scene.add(pts);
    this.timeUniforms.push(mat.uniforms.uTime);
    this.pointScaleUniforms.push(mat.uniforms.uScale);
  }

  addSmoke(x, y, z, color) {
    const n = 46, pos = new Float32Array(n * 3), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x + (this.rnd() - 0.5) * 14; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + (this.rnd() - 0.5) * 14;
      rn[i] = this.rnd();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uColor: { value: new THREE.Color(color) } },
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    this.scene.add(pts);
    this.timeUniforms.push(mat.uniforms.uTime);
    this.pointScaleUniforms.push(mat.uniforms.uScale);
  }

  // viewHeightPx: height of the viewport being drawn; fovDeg: camera field of view.
  setPointScale(viewHeightPx, fovDeg) {
    const s = viewHeightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    for (const u of this.pointScaleUniforms) u.value = s;
  }

  update(dt) {
    this.time += dt;
    for (const u of this.timeUniforms) u.value = this.time;
    for (const f of this.updaters) f(dt, this.time);
  }

  dispose() {
    disposeTree(this.scene);
  }
}
