// Unified catalogue of placeable items = plants (js/plants) + furniture (js/items/furniture.js).
// The app and the dev harness talk to plants/furniture ONLY through this file.
//
// Item definition (shared fields):
//   { id, kind: 'plant' | 'furniture', name (Ukrainian), category, matureHeight, matureWidth, ... }
// Model contract: origin on the ground at the item's centre, +Y up, front facing local -Z, units = metres.
import * as THREE from '../lib/three.js';

export const CATEGORIES = [
  { id: 'tree-fruit', name: 'Плодові дерева' },
  { id: 'tree-deco', name: 'Декоративні дерева' },
  { id: 'conifer', name: 'Хвойні' },
  { id: 'shrub', name: 'Кущі' },
  { id: 'berry', name: 'Ягідники' },
  { id: 'flower', name: 'Квіти та багаторічники' },
  { id: 'climber', name: 'Ліани' },
  { id: 'veg', name: 'Город' },
  { id: 'furniture', name: 'Меблі та відпочинок' },
  { id: 'structure', name: 'Споруди' },
];

let plantsApi = null;
let furnitureApi = null;
const defs = new Map();

/** Load both libraries. Safe to call once at start-up; a broken library only disables its own items. */
export async function loadCatalog() {
  defs.clear();
  try {
    const [catalog, gen] = await Promise.all([import('../plants/catalog.js'), import('../plants/generate.js')]);
    plantsApi = { ...catalog, ...gen };
    for (const p of catalog.PLANTS) defs.set(p.id, { ...p, kind: 'plant' });
  } catch (err) {
    console.error('[registry] plants library failed to load:', err);
  }
  try {
    furnitureApi = await import('./furniture.js');
    for (const f of furnitureApi.FURNITURE) defs.set(f.id, { ...f, kind: 'furniture' });
  } catch (err) {
    console.error('[registry] furniture library failed to load:', err);
  }
  return listDefs();
}

export function listDefs() {
  return [...defs.values()];
}

export function getDef(id) {
  return defs.get(id) || null;
}

/** Height/width in metres of an item at a given age in years (furniture: fixed size). */
export function itemSizeAt(id, age) {
  const def = defs.get(id);
  if (!def) return { height: 1, width: 1 };
  if (def.kind === 'plant' && plantsApi?.plantSizeAt) return plantsApi.plantSizeAt(id, age);
  return { height: def.matureHeight ?? 1, width: def.matureWidth ?? 1 };
}

/** Age in years at which a plant reaches `height` (used for SITE.existingItems). */
export function ageForHeight(id, height) {
  const def = defs.get(id);
  if (!def || def.kind !== 'plant') return 0;
  if (plantsApi?.ageForHeight) return plantsApi.ageForHeight(id, height);
  return 3;
}

function placeholder(id, age) {
  const { height, width } = itemSizeAt(id, age);
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, 0.2) / 2, Math.max(height, 0.2), 8),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 1 }));
  m.position.y = Math.max(height, 0.2) / 2;
  g.add(m);
  g.userData.placeholder = true;
  return g;
}

/**
 * Build the 3D object for an item.
 * @param {string} id
 * @param {{age?:number, season?:'spring'|'summer'|'autumn'|'winter', seed?:number}} opts
 * @returns {THREE.Object3D} never throws — falls back to a magenta placeholder.
 */
export function createItemObject(id, opts = {}) {
  const def = defs.get(id);
  const age = opts.age ?? 3;
  try {
    let obj = null;
    if (def?.kind === 'plant') obj = plantsApi.createPlant(id, { age, season: opts.season ?? 'summer', seed: opts.seed ?? 1 });
    else if (def?.kind === 'furniture') obj = furnitureApi.createFurniture(id, opts);
    if (obj) return obj;
  } catch (err) {
    console.error(`[registry] could not build "${id}":`, err);
  }
  return placeholder(id, age);
}
