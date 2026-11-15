// STUB — replaced by the world module (ground, paving, fences, surroundings, sky, sun).
// Contract (see CLAUDE.md → "Module contracts"):
//   createWorld({ scene, renderer, camera, site, assetsBase }) → Promise<World>
//   World = { group, groundMeshes, colliders, setSun({azimuth, elevation}), setSeason(season),
//             setSatelliteOverlay(opacity), update(dt, camera), heightAt(X, Y) }
import * as THREE from '../lib/three.js';
import { sunDirectionWorld } from '../core/sun.js';

export async function createWorld({ scene, site }) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);
  scene.background = new THREE.Color(0x9fc4e8);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(site.plot.width, site.plot.depth),
    new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(site.plot.width / 2, 0, -site.plot.depth / 2);
  ground.receiveShadow = true;
  group.add(ground);

  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x6b7a4a, 0.9);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.5);
  sun.castShadow = true;
  group.add(hemi, sun, sun.target);
  sun.target.position.set(10, 0, -12.5);

  const colliders = [];
  try {
    const s = await import('./structures.js');
    const built = s.createStructures(site);
    group.add(built.group);
    colliders.push(...built.colliders);
  } catch (err) {
    console.error('[world] structures failed:', err);
  }

  return {
    group,
    groundMeshes: [ground],
    colliders,
    setSun(pos) {
      sun.position.copy(sunDirectionWorld(pos)).multiplyScalar(60).add(sun.target.position);
    },
    setSeason() {},
    setSatelliteOverlay() {},
    update() {},
    heightAt() { return 0; },
  };
}
