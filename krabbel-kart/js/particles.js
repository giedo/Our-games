// A small pooled particle system (dust, sparks, flames, confetti, splashes).
import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, uSoft, d) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(n, additive) {
    this.n = n;
    this.next = 0;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uScale: { value: 600 }, uSoft: { value: additive ? 0.0 : 0.25 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    this.geo = geo;
  }

  emit(p) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx || 0; this.vel[i * 3 + 1] = p.vy || 0; this.vel[i * 3 + 2] = p.vz || 0;
    this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.a === undefined ? 1 : p.a;
    this.alpha[i] = p.a === undefined ? 1 : p.a;
    this.life[i] = this.max[i] = p.life || 1;
    this.s0[i] = p.size || 0.5; this.s1[i] = p.size1 === undefined ? this.s0[i] : p.size1;
    this.grav[i] = p.gravity || 0; this.drag[i] = p.drag || 0;
    this.size[i] = this.s0[i];
  }

  update(dt) {
    const { n, pos, vel, col, size, life, max, s0, s1, alpha, grav, drag } = this;
    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
      const k = 1 - drag[i] * dt;
      vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = 1 - life[i] / max[i];
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      col[i * 4 + 3] = alpha[i] * (t < 0.7 ? 1 : (1 - t) / 0.3);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

const c = new THREE.Color();

export class Particles {
  constructor(scene) {
    this.normal = new Pool(1400, false);
    this.add = new Pool(1000, true);
    scene.add(this.normal.points, this.add.points);
    this.scene = scene;
  }

  setScale(s) { this.normal.mat.uniforms.uScale.value = s; this.add.mat.uniforms.uScale.value = s; }

  update(dt) { this.normal.update(dt); this.add.update(dt); }

  // hex colour helper: converts to the renderer's working colour space.
  emit(additive, hex, p) {
    c.setHex(hex);
    p.r = c.r; p.g = c.g; p.b = c.b;
    (additive ? this.add : this.normal).emit(p);
  }

  burst(additive, hexes, n, x, y, z, speed, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      const q = Math.sqrt(1 - u * u);
      this.emit(additive, hexes[i % hexes.length], {
        x, y, z, vx: Math.cos(a) * q * s, vy: Math.abs(u) * s * (o.up || 1) + (o.lift || 0), vz: Math.sin(a) * q * s,
        life: (o.life || 0.8) * (0.6 + Math.random() * 0.6), size: o.size || 0.4, size1: o.size1 === undefined ? 0 : o.size1,
        gravity: o.gravity === undefined ? 12 : o.gravity, drag: o.drag || 0.5, a: o.a,
      });
    }
  }

  dispose() {
    for (const p of [this.normal, this.add]) {
      this.scene.remove(p.points); p.geo.dispose(); p.mat.dispose();
    }
  }
}
