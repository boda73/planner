// Sun position for the plot (NOAA approximation, accurate to ~1°) — enough for shade planning.
import * as THREE from '../lib/three.js';
import { SITE } from '../config/site.js';

const rad = Math.PI / 180;
const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Poland: CEST (UTC+2) from the last Sunday of March to the last Sunday of October, else CET (UTC+1). */
function tzOffsetHours(month, day) {
  if (month > 3 && month < 10) return 2;
  if (month === 3) return day >= 29 ? 2 : 1;
  if (month === 10) return day < 25 ? 2 : 1;
  return 1;
}

/**
 * @param {{month:number, day?:number, hour:number}} t  local clock time (hour may be fractional, e.g. 13.5)
 * @returns {{azimuth:number, elevation:number}} degrees; azimuth is a TRUE compass bearing (0 = N, 90 = E)
 */
export function sunPosition({ month = 7, day = 1, hour = 13 } = {}) {
  const { lat, lon } = SITE.geo;
  const tz = tzOffsetHours(month, day);
  const n = DAYS_BEFORE[month - 1] + day;
  const g = (2 * Math.PI / 365) * (n - 1 + (hour - tz - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqtime + 4 * lon - 60 * tz;      // true solar time, minutes
  const ha = (tst / 4 - 180) * rad;                         // hour angle
  const la = lat * rad;
  const cosZen = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(THREE.MathUtils.clamp(cosZen, -1, 1));
  let az = Math.acos(THREE.MathUtils.clamp(
    (Math.sin(decl) - Math.sin(la) * Math.cos(zen)) / (Math.cos(la) * Math.sin(zen) || 1e-9), -1, 1)) / rad;
  if (ha > 0) az = 360 - az;
  return { azimuth: az, elevation: 90 - zen / rad };
}

/** Unit vector in WORLD space pointing from the ground towards the sun. */
export function sunDirectionWorld({ azimuth, elevation }, out = new THREE.Vector3()) {
  const b = (azimuth - SITE.northBearingOfY) * rad;   // plot bearing
  const e = elevation * rad;
  return out.set(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e));
}

/** Rough season for a month, used to pick foliage looks. */
export function seasonOfMonth(month) {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 9) return 'summer';
  return 'autumn';
}
