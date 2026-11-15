// Orbit view: OrbitControls around the plot centre, never below the ground.
import * as THREE from '../../lib/three.js';
import { OrbitControls } from '../../lib/addons.js';
import { SITE } from '../../config/site.js';

export function createOrbit({ camera, canvas }) {
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.minDistance = 5; controls.maxDistance = 90;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
  controls.screenSpacePanning = false;
  const c = new THREE.Vector3(SITE.plot.width / 2, 0, -SITE.plot.depth / 2);
  const E = THREE.MathUtils.degToRad(35), D = 38;
  let saved = {
    pos: new THREE.Vector3(c.x - 0.707 * Math.cos(E) * D, Math.sin(E) * D, c.z + 0.707 * Math.cos(E) * D),
    target: c.clone(),
  };
  const v = new THREE.Vector3();
  function clampIt() {
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -15, 35);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -40, 15);
    controls.target.y = 0;
    if (camera.position.y < 0.4) camera.position.y = 0.4;
  }
  const api = {
    name: 'orbit', camera, controls,
    activate() {
      camera.fov = 45; camera.near = 0.3; camera.far = 2500; camera.updateProjectionMatrix();
      camera.position.copy(saved.pos); controls.target.copy(saved.target);
      controls.enabled = true; controls.update();
    },
    deactivate() { saved = { pos: camera.position.clone(), target: controls.target.clone() }; controls.enabled = false; },
    setInputEnabled(e) { controls.enabled = e; },
    resize(w, hgt) { camera.aspect = w / hgt; camera.updateProjectionMatrix(); },
    heading() { camera.getWorldDirection(v); return (Math.atan2(v.x, -v.z) * 180 / Math.PI + 360) % 360; },
    save: () => ({ pos: camera.position.clone(), target: controls.target.clone() }),
    restore(s) { saved = { pos: s.pos.clone(), target: s.target.clone() }; },
    /** Free camera from URL: look target = point 15 m ahead on the ground. */
    setFromPose(p) {
      const fw = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
      saved = { pos: camera.position.clone(), target: camera.position.clone().addScaledVector(fw, 15) };
      saved.target.y = 0;
    },
    update() { clampIt(); controls.update(); clampIt(); },
  };
  return api;
}
