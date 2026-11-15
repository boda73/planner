// House (garden cottage + annex) and the shed, built procedurally from SITE.house / SITE.shed + docs/SURVEY.md.
// Contract: createStructures(site) → { group: THREE.Group, colliders: Collider[] }
//   Collider = { type: 'box', minX, minY, maxX, maxY, h }   (plot metres)
// Each building sits behind its own factory (createCottage / createShed) so it can later be swapped for a
// Blender glTF without touching callers. Both factories return groups positioned in WORLD coordinates
// (x = X, y = up, z = −Y), i.e. ready to drop into the scene.
//
// Geometry rule that keeps walls and roofs closed: every roof is a slab (top surface + soffit 0.07–0.1 m below +
// edge boards); walls are single outward-facing polygons whose top edge ends INSIDE that slab, so there are no gaps
// and no coplanar faces (no z-fighting).
import * as THREE from '../lib/three.js';
import { BufferGeometryUtils } from '../lib/addons.js';
import {
  rng, plasterTex, plasterBump, osbTex, oldBoardsTex, roofSheetTex, roofSheetBump, feltTex, soffitTex,
  shingleTex, brownBoardTex, tex,
} from './structures-textures.js';

// ------------------------------------------------------------------ materials (shared, created lazily)
let M = null;
function mats() {
  if (M) return M;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  M = {
    plaster: std({ map: plasterTex(), bumpMap: plasterBump(), bumpScale: 0.6, roughness: 0.95 }),
    osb: std({ map: osbTex('#a9763f'), roughness: 0.85 }),
    annexWood: std({ map: brownBoardTex('#6a4630', 'annexBoards'), roughness: 0.85 }),
    southOsb: std({ map: osbTex('#8c5e36', 'osbBrown'), roughness: 0.85 }),
    oldBoards: std({ map: oldBoardsTex(), roughness: 0.95 }),
    roof: std({ map: roofSheetTex(), bumpMap: roofSheetBump(), bumpScale: 0.4, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
    fascia: std({ color: '#a8322d', roughness: 0.7 }),
    soffit: std({ map: soffitTex(), roughness: 0.9 }),
    eaveEdge: std({ color: '#4a2228', roughness: 0.6, metalness: 0.3 }),
    felt: std({ map: feltTex(), roughness: 0.95 }),
    feltEdge: std({ color: '#2e2f31', roughness: 0.95 }),
    greyWood: std({ color: '#6f675c', roughness: 0.9 }),
    pipe: std({ color: '#8b8e90', roughness: 0.45, metalness: 0.2 }),
    door: std({ map: brownBoardTex('#6b4630', 'doorBoards'), roughness: 0.8 }),
    interior: std({ color: '#1f1a16', roughness: 1, side: THREE.BackSide }),
    // shed
    slat: std({ map: slatTex(), roughness: 0.6 }),
    gap: std({ color: '#121212', roughness: 0.9 }),
    shedDoor: std({ color: '#5d6063', roughness: 0.55, metalness: 0.25 }),
    paleWood: std({ color: '#d2b48a', roughness: 0.75 }),
    handle: std({ color: '#c8c8c8', roughness: 0.3, metalness: 0.8 }),
    shingle: std({ map: shingleTex(), roughness: 0.95 }),
    shingleEdge: std({ color: '#1e1e20', roughness: 0.95 }),
  };
  return M;
}

/** Shed slat print: one canvas = one slat (U) × full wall height 2.2 m (V); slat UVs are box UVs 0…1. */
const slatTex = () => tex('shedSlat', 32, 512, (c, w, h, r) => {
  c.fillStyle = '#a4662f'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    c.globalAlpha = 0.2 + r() * 0.35;
    c.strokeStyle = r() < 0.6 ? '#76421d' : '#c88b4f';
    c.lineWidth = 0.5 + r() * 1.4;
    c.beginPath();
    let x = r() * w;
    c.moveTo(x, 0);
    for (let y = 0; y <= h; y += 24) { x += (r() - 0.5) * 2; c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 1;
}, { tile: [1, 1] });

// ------------------------------------------------------------------ geometry helpers (plot coords → world)
const W = (X, Y, h) => new THREE.Vector3(X, h, -Y);

function mesh(geo, mat, group) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  group?.add(m);
  return m;
}

/** Quad from four world points a,b,c,d (CCW seen from the front). UVs in metres: u along a→b, v along a→d. */
function quadGeo(a, b, c, d) {
  const u = a.distanceTo(b), v = a.distanceTo(d);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, d].flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, v], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// Wall faces: u axis chosen so that uDir × up = outward normal; UV = (u, h) in metres.
const FACE = {
  S: { n: [0, 0, 1], u: [1, 0, 0], toU: (s) => s },      // s = plot X
  N: { n: [0, 0, -1], u: [-1, 0, 0], toU: (s) => -s },   // s = plot X
  E: { n: [1, 0, 0], u: [0, 0, -1], toU: (s) => s },     // s = plot Y
  W: { n: [-1, 0, 0], u: [0, 0, 1], toU: (s) => -s },    // s = plot Y
};
/**
 * Flat wall polygon.  face: 'N'|'S'|'E'|'W'; at = the plane's fixed plot coordinate (Y for N/S, X for E/W);
 * pts = [[s, h], ...] outline with s = plot X (N/S) or plot Y (E/W); holes = array of outlines.
 */
function wall(face, at, pts, mat, group, holes = [], out = 0) {
  const f = FACE[face];
  const shape = new THREE.Shape(pts.map(([s, h]) => new THREE.Vector2(f.toU(s), h)));
  for (const hp of holes) shape.holes.push(new THREE.Path(hp.map(([s, h]) => new THREE.Vector2(f.toU(s), h))));
  const geo = new THREE.ShapeGeometry(shape);
  const m = mesh(geo, mat, group);
  const n = new THREE.Vector3(...f.n);
  m.matrixAutoUpdate = false;
  m.matrix.makeBasis(new THREE.Vector3(...f.u), new THREE.Vector3(0, 1, 0), n);
  const p = face === 'N' || face === 'S' ? W(0, at, 0) : W(at, 0, 0);
  p.addScaledVector(n, out);
  m.matrix.setPosition(p);
  return m;
}

/** Axis-aligned box in plot coords. */
function box(X0, Y0, h0, X1, Y1, h1, mat, group) {
  const m = mesh(new THREE.BoxGeometry(X1 - X0, h1 - h0, Y1 - Y0), mat, group);
  m.position.set((X0 + X1) / 2, (h0 + h1) / 2, -(Y0 + Y1) / 2);
  return m;
}

/** Board lying along a slope in the X–h plane at plot Y (centre of its thickness). */
function slopeBoard(xa, ha, xb, hb, Y, height, thick, drop, mat, group) {
  const L = Math.hypot(xb - xa, hb - ha);
  const m = mesh(new THREE.BoxGeometry(L, height, thick), mat, group);
  m.rotation.z = Math.atan2(hb - ha, xb - xa);
  m.position.set((xa + xb) / 2, (ha + hb) / 2 + drop, -Y);
  return m;
}

/**
 * Trapezoidal corrugated metal sheet on a slope from (xa, ha) [ridge] to (xb, hb) [eave], ribs running down the
 * slope, repeating along Y. Returns a non-indexed BufferGeometry (flat-shaded facets) with UV u = Y, v = slope m.
 */
function corrugatedSlope(xa, ha, xb, hb, Y0, Y1, pitch = 0.2, ribH = 0.032) {
  const dx = xb - xa, dh = hb - ha, L = Math.hypot(dx, dh);
  let nx = -dh / L, nh = dx / L;                       // a normal of the slope in the X–h plane
  if (nh < 0) { nx = -nx; nh = -nh; }                  // pointing up
  const prof = [[0, 0], [0.12, 0], [0.18, 1], [0.32, 1], [0.38, 0], [0.62, 0], [0.66, 0.18], [0.7, 0], [1, 0]];
  const n = Math.max(1, Math.round((Y1 - Y0) / pitch));
  const p = (Y1 - Y0) / n;
  const pts = [];
  for (let k = 0; k < n; k++) for (let i = 0; i < prof.length - (k < n - 1 ? 1 : 0); i++) pts.push([Y0 + (k + prof[i][0]) * p, prof[i][1] * ribH]);
  const pos = [], uv = [];
  const P = (s, Y, z) => [xa + dx * s + nx * z, ha + dh * s + nh * z, -Y];
  // decide winding once so that the flat valley faces up
  const a = new THREE.Vector3(...P(0, 0, 0)), b = new THREE.Vector3(...P(0, 1, 0)), c = new THREE.Vector3(...P(1, 0, 0));
  const flip = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).y < 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [y0, z0] = pts[i], [y1, z1] = pts[i + 1];
    const r0 = P(0, y0, z0), r1 = P(0, y1, z1), e0 = P(1, y0, z0), e1 = P(1, y1, z1);
    const tri = flip ? [r0, e0, r1, r1, e0, e1] : [r0, r1, e0, r1, e1, e0];
    const tuv = flip ? [[y0, 0], [y0, L], [y1, 0], [y1, 0], [y0, L], [y1, L]] : [[y0, 0], [y1, 0], [y0, L], [y1, 0], [y1, L], [y0, L]];
    tri.forEach((q) => pos.push(...q));
    tuv.forEach((q) => uv.push(...q));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ cottage
export function createCottage(site) {
  const m = mats();
  const H = site.house;
  const g = new THREE.Group();
  g.name = 'cottage';
  const [mX0, mY0, mX1, mY1] = H.main.rect;
  const [aX0, aY0, aX1, aY1] = H.annex.rect;
  const [rY0, rY1] = H.roofY;
  const ridge = { X: H.ridge.X, h: H.ridge.h };
  const eE = { X: H.roofEast.X1, h: H.roofEast.h };
  const eW = { X: H.roofWest.X0, h: H.roofWest.h };
  const T = 0.1;                                       // roof slab: soffit T below the sheet
  const hE = (X) => ridge.h + (eE.h - ridge.h) * (X - ridge.X) / (eE.X - ridge.X);
  const hW = (X) => ridge.h + (eW.h - ridge.h) * (X - ridge.X) / (eW.X - ridge.X);
  const roofAt = (X) => (X >= ridge.X ? hE(X) : hW(X));
  const top = (X) => roofAt(X) - T / 2;                // wall tops end inside the slab

  // --- main block walls
  const wallN = (X0, X1, mat) => wall('N', mY1, [[X0, 0], [X1, 0], [X1, top(X1)], [X0, top(X0)]], mat, g);
  wallN(mX0, mX1, m.plaster);
  const sMid = (mX0 + mX1) / 2;
  wall('S', mY0, [[mX0, 0], [sMid, 0], [sMid, top(sMid)], [mX0, top(mX0)]], m.plaster, g);
  wall('S', mY0, [[sMid, 0], [mX1, 0], [mX1, top(mX1)], [sMid, top(sMid)]], m.southOsb, g);
  wall('E', mX1, [[mY0, 0], [mY1, 0], [mY1, top(mX1)], [mY0, top(mX1)]], m.plaster, g);
  // west face under the canopy: old boards, OSB panel on the northern third
  const wSplit = mY1 - (mY1 - mY0) / 3;
  wall('W', mX0, [[mY0, 0], [wSplit, 0], [wSplit, top(mX0)], [mY0, top(mX0)]], m.oldBoards, g);
  wall('W', mX0, [[wSplit, 0], [mY1, 0], [mY1, top(mX0)], [wSplit, top(mX0)]], m.osb, g);
  // a few horizontal battens across the old boards
  for (const h of [0.35, 1.95]) box(mX0 - 0.03, mY0 + 0.05, h, mX0, wSplit - 0.05, h + 0.08, m.greyWood, g);

  // --- annex (lower, brown wood) with its own felt roof
  const AR = H.annexRoof;
  const hA = (X) => AR.hWest + (AR.hEast - AR.hWest) * (X - AR.X0) / (AR.X1 - AR.X0);
  const aTop = (X) => hA(X) - 0.045;
  const door = { X0: aX0 + 0.42, X1: aX0 + 1.32, h: 1.88 };
  wall('N', aY1, [[aX0, 0], [aX1, 0], [aX1, aTop(aX1)], [aX0, aTop(aX0)]], m.annexWood, g,
    [[[door.X0, 0.02], [door.X1, 0.02], [door.X1, door.h], [door.X0, door.h]]]);
  wall('S', aY0, [[aX0, 0], [aX1, 0], [aX1, aTop(aX1)], [aX0, aTop(aX0)]], m.annexWood, g);
  wall('E', aX1, [[aY0, 0], [aY1, 0], [aY1, aTop(aX1)], [aY0, aTop(aX1)]], m.annexWood, g);
  box(aX0 + 0.02, aY0 + 0.02, 0, aX1 - 0.02, aY1 - 0.02, 1.9, m.interior, g);   // dark inside behind the door
  // door frame + plain brown door hinged on its east side, standing slightly ajar (opens outward, north)
  box(door.X0 - 0.05, aY1, 0, door.X0, aY1 + 0.03, door.h + 0.05, m.door, g);
  box(door.X1, aY1, 0, door.X1 + 0.05, aY1 + 0.03, door.h + 0.05, m.door, g);
  box(door.X0 - 0.05, aY1, door.h, door.X1 + 0.05, aY1 + 0.03, door.h + 0.05, m.door, g);
  const hinge = new THREE.Group();
  hinge.position.copy(W(door.X1 - 0.01, aY1 + 0.02, 0));
  hinge.rotation.y = THREE.MathUtils.degToRad(-28);
  const dw = door.X1 - door.X0 - 0.02;
  const leaf = mesh(new THREE.BoxGeometry(dw, door.h - 0.04, 0.035), m.door, hinge);
  leaf.position.set(-dw / 2, 0.02 + (door.h - 0.04) / 2, -0.018);
  const knob = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), m.pipe, hinge);
  knob.position.set(-dw + 0.08, 1.0, -0.05);
  g.add(hinge);
  // annex roof: felt on a thin slab, overhangs the annex N, S and E
  {
    const ay0 = aY0 - 0.07, ay1 = aY1 + 0.07;
    slopeBoard(AR.X0, hA(AR.X0), AR.X1, AR.hEast, (ay0 + ay1) / 2, 0.07, ay1 - ay0, -0.045, m.feltEdge, g);
    mesh(quadGeo(W(AR.X0, ay0, hA(AR.X0)), W(AR.X1, ay0, AR.hEast), W(AR.X1, ay1, AR.hEast), W(AR.X0, ay1, hA(AR.X0))), m.felt, g);
  }

  // --- main roof: corrugated sheet on two slopes, soffit, edges
  const sheetE = corrugatedSlope(ridge.X, ridge.h, eE.X, eE.h, rY0, rY1);
  const sheetW = corrugatedSlope(ridge.X, ridge.h, eW.X, eW.h, rY0, rY1);
  mesh(BufferGeometryUtils.mergeGeometries([sheetE, sheetW]), m.roof, g);
  // soffit (grey boards under the slab, facing down)
  mesh(quadGeo(W(ridge.X, rY1, ridge.h - T), W(eE.X, rY1, eE.h - T), W(eE.X, rY0, eE.h - T), W(ridge.X, rY0, ridge.h - T)), m.soffit, g);
  mesh(quadGeo(W(eW.X, rY1, eW.h - T), W(ridge.X, rY1, ridge.h - T), W(ridge.X, rY0, ridge.h - T), W(eW.X, rY0, eW.h - T)), m.soffit, g);
  // eave edges (sheet → soffit), east and west
  mesh(quadGeo(W(eE.X, rY0, eE.h - T), W(eE.X, rY1, eE.h - T), W(eE.X, rY1, eE.h + 0.01), W(eE.X, rY0, eE.h + 0.01)), m.eaveEdge, g);
  mesh(quadGeo(W(eW.X, rY1, eW.h - T), W(eW.X, rY0, eW.h - T), W(eW.X, rY0, eW.h + 0.01), W(eW.X, rY1, eW.h + 0.01)), m.eaveEdge, g);
  // ridge flashing: a bent strip over the ridge
  const fl = 0.16;
  const fE = { X: ridge.X + fl * (eE.X - ridge.X) / Math.hypot(eE.X - ridge.X, eE.h - ridge.h) };
  const fW = { X: ridge.X + fl * (eW.X - ridge.X) / Math.hypot(eW.X - ridge.X, eW.h - ridge.h) };
  const lift = 0.04;
  mesh(quadGeo(W(ridge.X, rY0 - 0.01, ridge.h + lift), W(fE.X, rY0 - 0.01, hE(fE.X) + lift), W(fE.X, rY1 + 0.01, hE(fE.X) + lift), W(ridge.X, rY1 + 0.01, ridge.h + lift)), m.roof, g);
  mesh(quadGeo(W(fW.X, rY0 - 0.01, hW(fW.X) + lift), W(ridge.X, rY0 - 0.01, ridge.h + lift), W(ridge.X, rY1 + 0.01, ridge.h + lift), W(fW.X, rY1 + 0.01, hW(fW.X) + lift)), m.roof, g);
  // red fascia boards along the north and south verges (cover the slab ends)
  const FH = 0.17, FT = 0.03;
  for (const Y of [rY0 - FT / 2, rY1 + FT / 2]) {
    slopeBoard(ridge.X, ridge.h, eE.X, eE.h, Y, FH, FT, 0.05 - FH / 2, m.fascia, g);
    slopeBoard(eW.X, eW.h, ridge.X, ridge.h, Y, FH, FT, 0.05 - FH / 2, m.fascia, g);
  }

  // --- porch canopy supports: two slim posts + a beam under the west eave
  const pX = eW.X + 0.1, beamTop = hW(pX) - T - 0.005;
  for (const Y of [rY0 + 0.08, rY1 - 0.08]) box(pX - 0.035, Y - 0.035, 0, pX + 0.035, Y + 0.035, beamTop - 0.1, m.greyWood, g);
  box(pX - 0.04, rY0 + 0.02, beamTop - 0.1, pX + 0.04, rY1 - 0.02, beamTop, m.greyWood, g);
  // diagonal braces post → wall
  for (const Y of [mY0 + 0.06, mY1 - 0.06]) slopeBoard(pX, beamTop - 0.12, mX0, top(mX0) - 0.45, Y, 0.06, 0.05, 0, m.greyWood, g);

  // --- grey downpipe at the SW corner of the main block (with a foot elbow)
  const pipeR = 0.04, px = mX0 + 0.07, py = mY0 - 0.06;
  const pipe = mesh(new THREE.CylinderGeometry(pipeR, pipeR, top(px) - 0.25, 10), m.pipe, g);
  pipe.position.set(px, 0.25 + (top(px) - 0.25) / 2, -py);
  const foot = mesh(new THREE.CylinderGeometry(pipeR, pipeR, 0.25, 10), m.pipe, g);
  foot.rotation.x = Math.PI / 2 - 0.5;
  foot.position.set(px, 0.17, -(py - 0.09));

  // thin concrete plinth around the walls
  const plinth = new THREE.MeshStandardMaterial({ color: '#8f8c84', roughness: 1 });
  box(mX0 - 0.02, mY0 - 0.02, 0, aX1 + 0.02, mY0 + 0.01, 0.08, plinth, g);
  box(mX0 - 0.02, mY1 - 0.01, 0, door.X0 - 0.05, mY1 + 0.02, 0.08, plinth, g);
  return g;
}

// ------------------------------------------------------------------ shed
export function createShed(site) {
  const m = mats();
  const S = site.shed;
  const [X0, Y0, X1, Y1] = S.rect;
  const g = new THREE.Group();
  g.name = 'shed';
  const H = S.wallH, D = 0.022;                        // slat depth in front of the black backing
  box(X0 + D, Y0 + D, 0, X1 - D, Y1 - D, H, m.gap, g); // black core = the dark gaps

  // door on the south face, right of centre (seen from the south → east of centre)
  const door = { c: (X0 + X1) / 2 + 0.28, w: 0.75, h: 1.95, fr: 0.06 };
  const dX0 = door.c - door.w / 2, dX1 = door.c + door.w / 2;

  const slatW = 0.092, mod = 0.117, slatH = H - 0.01;
  const r = rng(77);
  const geos = [];
  const addSlat = (cx, cy, alongX, h0, h1) => {
    const bg = new THREE.BoxGeometry(alongX ? slatW : D, h1 - h0, alongX ? D : slatW);
    const uv = bg.attributes.uv, dv = r();
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (h1 - h0) / H + dv);
    bg.translate(cx, (h0 + h1) / 2, -cy);
    geos.push(bg);
  };
  const faceSlats = (len) => {
    const n = Math.floor((len - 0.02) / mod);
    const start = (len - (n - 1) * mod) / 2;
    return Array.from({ length: n }, (_, i) => start + i * mod);
  };
  for (const s of faceSlats(X1 - X0)) {
    const x = X0 + s;
    addSlat(x, Y1 - D / 2, true, 0.01, slatH);                        // north
    if (x + slatW / 2 > dX0 - door.fr && x - slatW / 2 < dX1 + door.fr) {
      addSlat(x, Y0 + D / 2, true, door.h + door.fr + 0.01, slatH);  // short slat above the door
    } else addSlat(x, Y0 + D / 2, true, 0.01, slatH);                 // south
  }
  for (const s of faceSlats(Y1 - Y0)) {
    addSlat(X0 + D / 2, Y0 + s, false, 0.01, slatH);                  // west
    addSlat(X1 - D / 2, Y0 + s, false, 0.01, slatH);                  // east
  }
  // corner trims
  for (const [cx, cy] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) {
    const bg = new THREE.BoxGeometry(0.035, slatH, 0.035);
    bg.translate(cx + (cx === X0 ? 0.0175 : -0.0175), slatH / 2 + 0.01, -(cy + (cy === Y0 ? 0.0175 : -0.0175)));
    geos.push(bg);
  }
  mesh(BufferGeometryUtils.mergeGeometries(geos), m.slat, g);

  // door: pale wood frame + anthracite leaf + handle
  const fy0 = Y0 - 0.012, fy1 = Y0 + D + 0.01;
  box(dX0 - door.fr, fy0, 0, dX0, fy1, door.h + door.fr, m.paleWood, g);
  box(dX1, fy0, 0, dX1 + door.fr, fy1, door.h + door.fr, m.paleWood, g);
  box(dX0 - door.fr, fy0, door.h, dX1 + door.fr, fy1, door.h + door.fr, m.paleWood, g);
  box(dX0, Y0 - 0.005, 0.02, dX1, Y0 + D, door.h, m.shedDoor, g);
  box(dX0 + 0.06, Y0 - 0.03, 0.98, dX0 + 0.08, Y0 - 0.005, 1.1, m.handle, g);
  box(dX0 + 0.06, Y0 - 0.045, 1.02, dX0 + 0.17, Y0 - 0.03, 1.04, m.handle, g);

  // roof: black edge band + low pyramid of bitumen shingles
  const o = S.overhang, rx0 = X0 - o, rx1 = X1 + o, ry0 = Y0 - o, ry1 = Y1 + o;
  const eb = 0.06;
  box(rx0, ry0, H - 0.02, rx1, ry1, H - 0.02 + eb, m.shingleEdge, g);
  const hb = H - 0.02 + eb, apex = W((X0 + X1) / 2, (Y0 + Y1) / 2, H + S.roofH);
  const c = [W(rx0, ry0, hb), W(rx1, ry0, hb), W(rx1, ry1, hb), W(rx0, ry1, hb)];   // SW, SE, NE, NW
  const pos = [], uv = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    const L = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const slant = mid.distanceTo(apex);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, apex.x, apex.y, apex.z);
    uv.push(0, 0, L, 0, L / 2, slant);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.computeVertexNormals();
  mesh(rg, m.shingle, g);
  return g;
}

// ------------------------------------------------------------------ entry point
export function createStructures(site) {
  const group = new THREE.Group();
  group.name = 'structures';
  const colliders = [];
  const H = site.house, S = site.shed;
  if (H) {
    group.add(createCottage(site));
    const [a, b, c, d] = H.main.rect;
    colliders.push({ type: 'box', minX: a, minY: b, maxX: c, maxY: d, h: H.ridge.h });
    const [e, f, k, l] = H.annex.rect;
    colliders.push({ type: 'box', minX: e, minY: f, maxX: k, maxY: l, h: H.annexRoof.hWest });
  }
  if (S) {
    group.add(createShed(site));
    const [a, b, c, d] = S.rect;
    colliders.push({ type: 'box', minX: a, minY: b, maxX: c, maxY: d, h: S.wallH + S.roofH });
  }
  return { group, colliders };
}
