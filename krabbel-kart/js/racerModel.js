// Assembles a racer: a 3D vehicle made from a side-view drawing, with a
// puffy 3D driver made from a front-view drawing sitting on top.
import * as THREE from '../vendor/three.module.min.js';
import { buildPuffy } from './puffy.js';
import { makeCanvas, canvasTexture } from './util.js';

const VEH_LEN = 2.8, VEH_MAXH = 1.9, VEH_HALFW = 0.68;
const DRV_H = 1.6, DRV_MAXW = 1.75;

export function getPuffy(sticker, kind) {
  const key = '_puffy_' + kind;
  if (sticker[key] !== undefined) return sticker[key];
  const c = sticker.canvas;
  const longest = Math.max(c.width, c.height);
  const wn = c.width / longest, hn = c.height / longest;
  let p, scale;
  if (kind === 'vehicle') {
    scale = Math.min(VEH_LEN / wn, VEH_MAXH / hn);
    p = buildPuffy(c, { mode: 'slab', grid: 60, halfW: VEH_HALFW / scale, bevel: 0.11 / scale, rimFrac: 0.76 });
  } else {
    scale = Math.min(DRV_H / hn, DRV_MAXW / wn);
    p = buildPuffy(c, { mode: 'pillow', grid: 60, puff: 0.9, maxT: 0.42 / scale });
  }
  if (p) {
    p.scale = scale;
    p.faceMat = new THREE.MeshLambertMaterial({ map: p.texture, emissive: 0xffffff, emissiveMap: p.texture, emissiveIntensity: 0.22 });
    p.rimMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x222222 });
  }
  sticker[key] = p || null;
  return sticker[key];
}

export function forgetPuffy(sticker) {
  for (const kind of ['vehicle', 'driver']) {
    const p = sticker['_puffy_' + kind];
    if (p) { p.geometry.dispose(); p.texture.dispose(); p.faceMat.dispose(); p.rimMat.dispose(); }
    delete sticker['_puffy_' + kind];
  }
}

let shadowTex = null;
function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  shadowTex = canvasTexture(c);
  shadowTex.userData.shared = true;
  return shadowTex;
}

let shieldGeo = null;

export function buildRacerModel(driver, vehicle) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const body = new THREE.Group();
  root.add(tilt); tilt.add(body);
  const pv = getPuffy(vehicle, 'vehicle');
  const pd = getPuffy(driver, 'driver');
  let len = VEH_LEN, seatY = 0.8;
  if (pv) {
    const vm = new THREE.Mesh(pv.geometry, [pv.faceMat, pv.rimMat]);
    vm.scale.setScalar(pv.scale);
    vm.rotation.y = -Math.PI / 2; // drawing's right-hand side becomes "forward"
    vm.position.y = 0.05;
    vm.castShadow = true;
    body.add(vm);
    len = pv.wn * pv.scale;
    seatY = pv.top(0.44) * pv.scale + 0.05;
  }
  const pivot = new THREE.Group();
  let driverH = DRV_H;
  if (pd) {
    driverH = pd.hn * pd.scale;
    const dm = new THREE.Mesh(pd.geometry, pd.faceMat);
    dm.scale.setScalar(pd.scale);
    dm.castShadow = true;
    pivot.add(dm);
  }
  pivot.position.set(0, Math.max(0.12, seatY - driverH * 0.3), (0.44 - 0.5) * len);
  body.add(pivot);

  if (!shieldGeo) shieldGeo = new THREE.IcosahedronGeometry(1, 4);
  // Soap-bubble look: clear in the middle, bright towards the rim.
  const shield = new THREE.Mesh(shieldGeo, new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x7fe4ff) }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = (0.07 + pow(f, 2.4) * 0.85) * uOpacity;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), pow(f, 5.0)), a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  }));
  shield.scale.set(1.9, 1.7, 2.2);
  shield.position.y = 1.25;
  shield.visible = false;
  shield.renderOrder = 4;
  body.add(shield);

  const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
  shadow.scale.set(2.6, 1, len + 1.2);
  shadow.renderOrder = 0.7;

  const topY = pivot.position.y + driverH;
  return { root, tilt, body, pivot, shield, shadow, len, topY };
}

export function disposeRacerModel(m) {
  m.shield.material.dispose();
  m.shadow.geometry.dispose();
  m.shadow.material.dispose();
}
