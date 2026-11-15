// Sky dome, sun / moon light, hemisphere light and fog — everything that depends on the sun's elevation.
import * as THREE from '../lib/three.js';
import { sunDirectionWorld } from '../core/sun.js';

const sm = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

// Palette (sRGB 0..1). Sky = vertical gradient zenith → horizon.
const P = {
  dayZenith: srgb(0.27, 0.46, 0.78), dayHorizon: srgb(0.74, 0.83, 0.91),
  duskZenith: srgb(0.16, 0.22, 0.45), duskHorizon: srgb(0.95, 0.62, 0.42),
  nightZenith: srgb(0.015, 0.025, 0.07), nightHorizon: srgb(0.05, 0.07, 0.14),
  sunWarm: srgb(1.0, 0.6, 0.3), sunWhite: srgb(1.0, 0.95, 0.88), moon: srgb(0.45, 0.55, 0.85),
  hemiDaySky: srgb(0.8, 0.88, 1.0), hemiDayGround: srgb(0.42, 0.48, 0.28),
  hemiDuskSky: srgb(0.55, 0.55, 0.75), hemiDuskGround: srgb(0.3, 0.25, 0.22),
  hemiNightSky: srgb(0.12, 0.17, 0.32), hemiNightGround: srgb(0.05, 0.06, 0.06),
};

const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const DOME_FRAG = /* glsl */`
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunAmount;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    float t = pow(max(h, 0.0), 0.55);
    vec3 col = mix(uHorizon, uZenith, t);
    col = mix(col, uHorizon * 0.9, smoothstep(0.0, -0.2, d.y));          // below the horizon: stay at haze colour
    float c = max(dot(d, uSunDir), 0.0);
    col += uSunColor * uSunAmount * (0.35 * pow(c, 6.0) + 0.5 * pow(c, 60.0) + 8.0 * smoothstep(0.99985, 0.99995, c));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createSky({ renderer, quality, scene }) {
  const group = new THREE.Group();
  group.name = 'sky';

  // ---- dome (follows the camera)
  const domeMat = new THREE.ShaderMaterial({
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunAmount: { value: 1 },
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(850, 32, 16), domeMat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  group.add(dome);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const target = new THREE.Object3D();
  target.position.set(10, 0, -12.5);
  sun.target = target;
  sun.castShadow = true;
  const size = quality === 'low' ? 2048 : 4096;
  sun.shadow.mapSize.set(size, size);
  const sc = sun.shadow.camera;
  // fixed volume ≈ plot X −6…26, Y −6…31 (centre 10, −12.5; half-diagonal ≈ 24.5 m, padded)
  sc.left = -27; sc.right = 27; sc.top = 27; sc.bottom = -27; sc.near = 1; sc.far = 230;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 1.5;
  group.add(hemi, sun, target);

  const fog = new THREE.Fog(0xbfd2e6, 150, 800);
  scene.fog = fog;
  scene.background = fog.color;

  const tmpDir = new THREE.Vector3();
  const zen = new THREE.Color(), hor = new THREE.Color(), tmp = new THREE.Color();
  const state = { elevation: 30 };

  function setSun({ azimuth, elevation }) {
    state.elevation = elevation;
    const e = elevation;
    const day = sm(e, -6, 8);                       // 0 night … 1 day
    const dusk = Math.exp(-Math.pow((e - 1) / 7, 2)); // peaks at the horizon

    // sky gradient
    zen.copy(P.nightZenith).lerp(P.dayZenith, day).lerp(P.duskZenith, dusk * 0.7);
    hor.copy(P.nightHorizon).lerp(P.dayHorizon, day).lerp(P.duskHorizon, dusk * 0.75);
    domeMat.uniforms.uZenith.value.copy(zen);
    domeMat.uniforms.uHorizon.value.copy(hor);

    // directional light: sun above −1.5°, otherwise a dim fixed moon
    sunDirectionWorld({ azimuth, elevation }, tmpDir);
    domeMat.uniforms.uSunDir.value.copy(tmpDir);
    const warm = 1 - sm(e, 2, 28);
    tmp.copy(P.sunWhite).lerp(P.sunWarm, warm);
    domeMat.uniforms.uSunColor.value.copy(tmp);
    domeMat.uniforms.uSunAmount.value = e > -3 ? sm(e, -3, 1) : 0;

    let I, dir = tmpDir;
    if (e > -1.5) {
      I = 3.3 * sm(e, -1.5, 9) * (0.6 + 0.4 * sm(e, 3, 26));
      sun.color.copy(tmp);
    } else {
      I = 0.22 * (1 - sm(e, -10, -1.5));
      sun.color.copy(P.moon);
      dir = sunDirectionWorld({ azimuth: 200, elevation: 42 }, new THREE.Vector3());
    }
    sun.intensity = I;
    sun.visible = I > 0.003;
    sun.position.copy(dir).multiplyScalar(110).add(target.position);
    sun.target.updateMatrixWorld();

    // hemisphere
    tmp.copy(P.hemiNightSky).lerp(P.hemiDaySky, day).lerp(P.hemiDuskSky, dusk * 0.6);
    hemi.color.copy(tmp);
    tmp.copy(P.hemiNightGround).lerp(P.hemiDayGround, day).lerp(P.hemiDuskGround, dusk * 0.5);
    hemi.groundColor.copy(tmp);
    hemi.intensity = 0.14 + 0.62 * day;

    // fog / background = horizon haze
    fog.color.copy(hor);
    renderer.shadowMap.needsUpdate = true;
  }

  function update(camera) {
    dome.position.copy(camera.position);
  }

  return { group, setSun, update, sun, hemi, fog, state };
}
