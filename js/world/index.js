// World module: ground, paving, fences, surroundings, sky, sun light.  Contract: see CLAUDE.md → "Module contracts".
import * as THREE from '../lib/three.js';
import { createGround } from './ground.js';
import { createPaving } from './paving.js';
import { createFences } from './fences.js';
import { createSurroundings } from './surroundings.js';
import { createSky } from './sky.js';

function loadTexture(url, maxAniso) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      resolve(t);
    }, undefined, () => { console.error('[world] cannot load ' + url); resolve(null); });
  });
}

export async function createWorld({ scene, renderer, camera, site, assetsBase = 'assets/', quality = 'high' }) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);
  const maxAniso = quality === 'low' ? 4 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const [contextTex, lawnTex] = await Promise.all([
    loadTexture(assetsBase + 'ground/context.jpg', maxAniso),
    loadTexture(assetsBase + 'ground/lawn.jpg', maxAniso),
  ]);

  const sky = createSky({ renderer, quality, scene });
  group.add(sky.group);

  const ground = createGround({ site, lawnTex, contextTex, quality, maxAniso });
  group.add(ground.group);

  const paving = createPaving({ site, maxAniso });
  group.add(paving.group);

  const fences = createFences({ site });
  group.add(fences.group);

  const surroundings = createSurroundings({ site });
  group.add(surroundings.group);

  const colliders = [...fences.colliders];
  try {
    const s = await import('./structures.js');
    const built = s.createStructures(site);
    group.add(built.group);
    colliders.push(...built.colliders);
  } catch (err) {
    console.error('[world] structures failed:', err);
  }

  // the satellite plane is included so items can stand on the fenced strip west of the lawn rectangle
  const groundMeshes = [ground.lawn, ...paving.meshes, ...(ground.context ? [ground.context] : [])];
  let lastSun = { azimuth: 180, elevation: 40 };
  sky.setSun(lastSun);

  return {
    group,
    groundMeshes,
    colliders,
    setSun(pos) {
      lastSun = pos;
      sky.setSun(pos);
    },
    setSeason(season) {
      ground.setSeason(season);
      surroundings.setSeason(season);
      renderer.shadowMap.needsUpdate = true;
    },
    setSatelliteOverlay(opacity) { ground.setOverlay(opacity); },
    update(dt, cam = camera) { sky.update(cam); },
    heightAt() { return 0; },
  };
}
