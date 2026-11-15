// Coordinate conventions — the single source of truth for every module.
//
// PLOT coords (meters):  X → east along the south fence (0..20),  Y → north (0..25),  h → up.
//                        Origin = SW corner of the plot (inner face of the fences).
// WORLD coords (three.js, Y-up, meters):  world.x = X,  world.y = h,  world.z = -Y.
//                        So "plot north" (+Y) is -Z, which is where a default camera looks.
//
// BEARINGS are in degrees, clockwise seen from above.
//   plot bearing: 0 = +Y (plot north), 90 = +X (plot east).
//   true bearing: 0 = geographic north.  true = plot + SITE.northBearingOfY  (the plot is turned ~10.5° clockwise).
//
// OBJECT ORIENTATION: every placeable model has its FRONT facing local -Z and its origin on the ground,
//   so  object.rotation.y = bearingToYaw(b)  makes its front face plot bearing b.
import * as THREE from '../lib/three.js';
import { SITE } from '../config/site.js';

/** Fenced area in plot metres. The measuring rectangle is 0…width × 0…depth; fences may lie outside it. */
export function plotBounds() {
  const [minX, minY, maxX, maxY] = SITE.plot.bounds || [0, 0, SITE.plot.width, SITE.plot.depth];
  return { minX, minY, maxX, maxY };
}

/** Is a seasonal item (`months: [from, to]`) out in the given month? Items without `months` always are. */
export function inSeason(item, month) {
  const m = item.months;
  if (!m) return true;
  return m[0] <= m[1] ? month >= m[0] && month <= m[1] : month >= m[0] || month <= m[1];
}

export function toWorld(X, Y, h = 0, out = new THREE.Vector3()) {
  return out.set(X, h, -Y);
}

export function toPlot(v) {
  return { X: v.x, Y: -v.z, h: v.y };
}

export function bearingToYaw(deg) {
  return -THREE.MathUtils.degToRad(deg);
}

export function yawToBearing(yaw) {
  return ((-THREE.MathUtils.radToDeg(yaw)) % 360 + 360) % 360;
}

export function trueToPlotBearing(deg) {
  return deg - SITE.northBearingOfY;
}

export function plotToTrueBearing(deg) {
  return deg + SITE.northBearingOfY;
}

/** Put a camera at a plot position looking along a plot bearing. pitch: degrees, + is up. */
export function poseCamera(camera, { X, Y, h = 1.6, heading = 0, pitch = 0 }) {
  camera.position.set(X, h, -Y);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(THREE.MathUtils.degToRad(pitch), bearingToYaw(heading), 0);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * Vertical FOV (degrees) that makes a photo with the given horizontal/vertical FOV fit entirely
 * ("contain") inside a viewport of the given aspect (width / height).
 */
export function fovToContainPhoto(hfov, vfov, viewportAspect) {
  const th = Math.tan(THREE.MathUtils.degToRad(hfov) / 2);
  const tv = Math.tan(THREE.MathUtils.degToRad(vfov) / 2);
  const photoAspect = th / tv;
  const t = viewportAspect >= photoAspect ? tv : th / viewportAspect;
  return THREE.MathUtils.radToDeg(2 * Math.atan(t));
}
