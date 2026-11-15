// Procedural plant generator.
// Contract (CLAUDE.md):
//   plantSizeAt(id, age) → { height, width }           metres at `age` years of growth (growth.js)
//   ageForHeight(id, height) → years                   exact inverse of plantSizeAt().height
//   createPlant(id, { age, season, month, seed }) → THREE.Group   origin on the ground, +Y up, front = −Z
//   clearPlantCache()
// Geometry is cached per (species, age rounded to 0.5 y, look signature, seed % 4); returned groups share
// geometries and the module-level materials — callers must not dispose them.
import * as THREE from '../lib/three.js';
import { rng } from '../core/procedural.js';
import { PLANTS } from './catalog.js';
import { plantSizeAt, ageForHeight, trunkRadiusAt } from './growth.js';
import { plantMaterials } from './materials.js';
import { BUILDERS, Buf } from './forms.js';

export { plantSizeAt, ageForHeight };

const byId = new Map(PLANTS.map((p) => [p.id, p]));
const SEASON_MONTHS = { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] };
const REP_MONTH = { spring: 4, summer: 7, autumn: 10, winter: 1 };
const seasonOf = (m) => (m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 9 ? 'summer' : 'autumn');
const inRange = (m, a, b) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
const overlap = (range, months) => (range ? months.filter((m) => inRange(m, range.from, range.to)).length : 0);

// deciduous foliage amount / autumn colour by month
const LEAF = { 1: 0, 2: 0, 3: 0.1, 4: 0.55, 5: 0.9, 6: 1, 7: 1, 8: 1, 9: 0.95, 10: 0.45, 11: 0.12, 12: 0 };
const AUT = { 9: 0.2, 10: 0.85, 11: 1 };
const FRESH = { 3: 1, 4: 1, 5: 0.8, 6: 0.25 };

/** What the plant looks like at this time: drives both the build and the cache key. */
function lookFor(def, age, season, month) {
  if (!SEASON_MONTHS[season]) season = month ? seasonOf(month) : 'summer';
  const m = month || REP_MONTH[season];
  const months = month ? [month] : SEASON_MONTHS[season];
  const g = def.g;
  let leaf = def.evergreen ? 1 : LEAF[m];
  if (!def.evergreen && def.annual) leaf = m >= 5 && m <= 10 ? Math.min(1, LEAF[m] + 0.2) : 0;
  const autumn = def.evergreen ? 0 : AUT[m] || 0;
  const fresh = FRESH[m] || 0;
  const bloomAge = g.bloomAge ?? g.flowerAge ?? (g.fruitAge != null ? g.fruitAge - 1 : 0);
  let flowering = !!def.bloom && age >= bloomAge && overlap(def.bloom, months) > 0;
  let fruiting = !!def.harvest && age >= (g.fruitAge ?? 0) && overlap(def.harvest, months) > 0 && leaf > 0.2;
  if (flowering && fruiting) {           // season-only call with both: keep the one that dominates the season
    if (overlap(def.bloom, months) > overlap(def.harvest, months)) fruiting = false; else flowering = false;
  }
  // late-season tint for long bloomers (panicle hydrangea turns pink in September)
  const late = flowering && def.bloom && inRange(9, def.bloom.from, def.bloom.to) && (m >= 9) ? 0.7 : 0;
  if (def.id === 'miscanthus' && season === 'winter') flowering = true;   // dry plumes stay over winter
  return {
    season, leaf, autumn, fresh, flowering, fruiting, late,
    bloomColor: def.bloom?.color || '#ffffff',
    key: `${season}|${leaf}|${autumn}|${fresh}|${+flowering}|${+fruiting}|${late}`,
  };
}

const cache = new Map();
let stats = { builds: 0, hits: 0, buildMs: 0 };

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function build(def, age, look, variant) {
  const t0 = performance.now();
  const { height: H, width: W } = plantSizeAt(def.id, age);
  const X = {
    def, g: def.g, H, W, age, look, variant,
    trunkR: trunkRadiusAt(def.id, age),
    small: def.matureHeight < 1.2,
    r: rng((hashStr(def.id) ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0),
    wood: new Buf(), fol: new Buf(), cards: new Buf(), acc: new Buf(),
  };
  (BUILDERS[def.g.form] || BUILDERS.shrub)(X);
  const parts = [['wood', X.wood], ['foliage', X.fol], ['cards', X.cards], ['accent', X.acc]]
    .map(([m, b]) => [m, b.geometry()]).filter(([, g]) => g);
  const tris = parts.reduce((s, [, g]) => s + g.index.count / 3, 0);
  const ms = performance.now() - t0;
  stats.builds++; stats.buildMs += ms;
  return { parts, H, W, trunkR: X.trunkR, tris, ms };
}

/**
 * @param {string} id
 * @param {{age?:number, season?:string, month?:number, seed?:number}} opts
 * @returns {THREE.Group|null}
 */
export function createPlant(id, { age = 3, season = 'summer', month, seed = 1 } = {}) {
  const def = byId.get(id);
  if (!def) return null;
  age = Math.max(0, +age || 0);
  const ageQ = Math.round(age * 2) / 2;
  const variant = (((seed | 0) % 4) + 4) % 4;
  const look = lookFor(def, ageQ, season, month);
  const key = `${id}|${ageQ}|${look.key}|${variant}`;
  let entry = cache.get(key);
  if (entry) stats.hits++;
  else { entry = build(def, ageQ, look, variant); cache.set(key, entry); }

  const { height, width } = plantSizeAt(id, age);
  const sy = height / entry.H, sxz = width / entry.W;
  const mats = plantMaterials();
  const group = new THREE.Group();
  group.name = `plant:${id}`;
  for (const [m, geo] of entry.parts) {
    const mesh = new THREE.Mesh(geo, mats[m]);
    mesh.scale.set(sxz, sy, sxz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
  group.userData.size = { height, width };
  group.userData.plantId = id;
  group.userData.triangles = entry.tris;
  if (def.g.trunkD) group.userData.trunkRadius = trunkRadiusAt(id, age);
  return group;
}

/** Drop every cached geometry (materials stay shared). */
export function clearPlantCache() {
  for (const e of cache.values()) for (const [, g] of e.parts) g.dispose();
  cache.clear();
}

/** Dev helper: cache statistics. */
export function plantCacheStats() {
  return { entries: cache.size, ...stats, avgBuildMs: stats.builds ? stats.buildMs / stats.builds : 0 };
}
