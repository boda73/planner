// STUB — replaced by the procedural plant generator.
// Contract:
//   plantSizeAt(id, age) → { height, width }          metres at `age` years
//   ageForHeight(id, height) → age in years            inverse of plantSizeAt().height
//   createPlant(id, { age, season, seed }) → THREE.Object3D   origin on the ground, +Y up
import * as THREE from '../lib/three.js';
import { PLANTS } from './catalog.js';

const byId = new Map(PLANTS.map((p) => [p.id, p]));
const curve = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 2);

export function plantSizeAt(id, age) {
  const p = byId.get(id);
  if (!p) return { height: 1, width: 1 };
  const k = 0.12 + 0.88 * curve(age / p.yearsToMature);
  return { height: p.matureHeight * k, width: p.matureWidth * k };
}

export function ageForHeight(id, height) {
  const p = byId.get(id);
  if (!p) return 0;
  let lo = 0, hi = p.yearsToMature;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (plantSizeAt(id, mid).height < height) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function createPlant(id, { age = 3 } = {}) {
  const p = byId.get(id);
  if (!p) return null;
  const { height, width } = plantSizeAt(id, age);
  const g = new THREE.Group();
  const conifer = p.category === 'conifer';
  const geo = conifer ? new THREE.ConeGeometry(width / 2, height, 10) : new THREE.SphereGeometry(width / 2, 10, 8);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: conifer ? 0x2f5d2a : 0x4c8a35, roughness: 1 }));
  m.position.y = conifer ? height / 2 : height - width / 2;
  m.castShadow = true;
  g.add(m);
  if (!conifer) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, height - width / 2, 6), new THREE.MeshStandardMaterial({ color: 0x5a4636 }));
    t.position.y = (height - width / 2) / 2;
    t.castShadow = true;
    g.add(t);
  }
  g.userData.size = { height, width };
  return g;
}
