// STUB — replaced by the furniture library.
// Contract: FURNITURE: Def[];  createFurniture(id, opts) → THREE.Object3D
//   Def = { id, name, category: 'furniture' | 'structure', matureHeight, matureWidth, footprint: {w, d} | {r}, note? }
import * as THREE from '../lib/three.js';

export const FURNITURE = [
  { id: 'swing_canopy', name: 'Гойдалка з навісом', category: 'furniture', matureHeight: 1.7, matureWidth: 2.1, footprint: { w: 2.1, d: 1.2 } },
  { id: 'picnic_table', name: 'Стіл з лавами', category: 'furniture', matureHeight: 0.75, matureWidth: 1.8, footprint: { w: 1.8, d: 1.5 } },
  { id: 'tripod_grill', name: 'Тринога з вогнищем', category: 'furniture', matureHeight: 1.6, matureWidth: 0.9, footprint: { r: 0.45 } },
  { id: 'concrete_bin', name: 'Бетонна урна', category: 'furniture', matureHeight: 0.55, matureWidth: 0.45, footprint: { r: 0.23 } },
  { id: 'trampoline', name: 'Батут', category: 'furniture', matureHeight: 0.75, matureWidth: 3.0, footprint: { r: 1.5 } },
  { id: 'planter_box', name: 'Дерев\'яний ящик для рослин', category: 'furniture', matureHeight: 0.28, matureWidth: 0.6, footprint: { w: 0.6, d: 0.6 } },
];

export function createFurniture(id) {
  const def = FURNITURE.find((f) => f.id === id);
  if (!def) return null;
  const w = def.footprint.w ?? def.footprint.r * 2;
  const d = def.footprint.d ?? def.footprint.r * 2;
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, def.matureHeight, d), new THREE.MeshStandardMaterial({ color: 0x8a6a4a }));
  m.position.y = def.matureHeight / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}
