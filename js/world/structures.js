// STUB — replaced by the structures module (house + shed as detailed models).
// Contract: createStructures(site) → { group: THREE.Group, colliders: Collider[] }
//   Collider = { type: 'box', minX, minY, maxX, maxY, h }   (plot metres)
import * as THREE from '../lib/three.js';

export function createStructures(site) {
  const group = new THREE.Group();
  group.name = 'structures';
  const colliders = [];
  const box = ([X0, Y0, X1, Y1], h, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, h, Y1 - Y0), new THREE.MeshStandardMaterial({ color }));
    m.position.set((X0 + X1) / 2, h / 2, -(Y0 + Y1) / 2);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    colliders.push({ type: 'box', minX: X0, minY: Y0, maxX: X1, maxY: Y1, h });
  };
  box(site.house.main.rect, 2.5, 0xf1efe9);
  box(site.house.annex.rect, 2.1, 0x6b4a33);
  box(site.shed.rect, site.shed.wallH, 0x9a6a3c);
  return { group, colliders };
}
