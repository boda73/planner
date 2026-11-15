// Furniture library: the six real items of the plot + eight planning items.
// Contract: FURNITURE: Def[];  createFurniture(id, opts) → THREE.Object3D (origin on the ground at the centre,
// +Y up, front = local −Z, metres).  Geometry is built once per id, merged per material, and shared by every
// returned Group (callers must not dispose it).
import * as THREE from '../lib/three.js';
import { Kit, M } from './furniture-kit.js';

const PI = Math.PI;

// ------------------------------------------------------------------ catalogue
export const FURNITURE = [
  { id: 'swing_canopy', name: 'Гойдалка з навісом', category: 'furniture', matureHeight: 1.7, matureWidth: 2.1, footprint: { w: 2.1, d: 1.2 },
    note: 'Антрацитова трубчаста рама, сітчаста лава 1,6 м, ліловий навіс з білим візерунком.' },
  { id: 'picnic_table', name: 'Стіл з лавами', category: 'furniture', matureHeight: 0.75, matureWidth: 1.8, footprint: { w: 1.8, d: 1.5 },
    note: 'Стільниця 1,8 × 0,75 м із п\'яти дощок, дві лави, бетонні опори.' },
  { id: 'tripod_grill', name: 'Тринога з вогнищем', category: 'furniture', matureHeight: 1.6, matureWidth: 1.0, footprint: { r: 0.5 },
    note: 'Чорна сталева тринога 1,6 м, круглий решітчастий гриль на ланцюгах, чаша для вогню Ø 0,6 м.' },
  { id: 'concrete_bin', name: 'Бетонна урна', category: 'furniture', matureHeight: 0.6, matureWidth: 0.45, footprint: { r: 0.23 },
    note: 'Циліндр з відкритим заповнювачем Ø 0,45 × 0,6 м, оцинкований обід.' },
  { id: 'trampoline', name: 'Батут', category: 'furniture', matureHeight: 0.8, matureWidth: 3.0, footprint: { r: 1.5 },
    note: 'Ø 3 м, чорне полотно на 0,75 м, синя м\'яка облямівка, без сітки.' },
  { id: 'planter_box', name: 'Дерев\'яний ящик для рослин', category: 'furniture', matureHeight: 0.28, matureWidth: 0.6, footprint: { w: 0.6, d: 0.6 },
    note: '0,6 × 0,6 × 0,28 м, по чотири червонувато-коричневі дошки з боку, мульча зверху.' },
  { id: 'bench', name: 'Лавка', category: 'furniture', matureHeight: 0.85, matureWidth: 1.5, footprint: { w: 1.5, d: 0.55 },
    note: 'Садова лавка зі спинкою, 1,5 м, дерево на сталевих опорах.' },
  { id: 'raised_bed', name: 'Висока грядка 1,2 × 2,4', category: 'structure', matureHeight: 0.4, matureWidth: 1.2, footprint: { w: 1.2, d: 2.4 },
    note: 'Дерев\'яна рама заввишки 0,4 м, ґрунт усередині.' },
  { id: 'compost_bin', name: 'Компостер', category: 'furniture', matureHeight: 0.9, matureWidth: 1.0, footprint: { w: 1.0, d: 1.0 },
    note: 'Дерев\'яний ящик із щілинами 1 × 1 × 0,9 м.' },
  { id: 'rain_barrel', name: 'Бочка для дощівки', category: 'furniture', matureHeight: 1.1, matureWidth: 0.6, footprint: { r: 0.32 },
    note: 'Пластикова бочка ≈ 250 л на підставці, з краном.' },
  { id: 'pergola', name: 'Пергола 3 × 3', category: 'structure', matureHeight: 2.5, matureWidth: 3.0, footprint: { w: 3.0, d: 3.0 },
    note: 'Чотири стовпи, балки й крокви; для виткої лози чи тіні.' },
  { id: 'greenhouse', name: 'Теплиця 3 × 4', category: 'structure', matureHeight: 2.5, matureWidth: 3.0, footprint: { w: 3.0, d: 4.0 },
    note: 'Алюмінієвий каркас, полікарбонат, двосхилий дах, двері з торця (спереду).' },
  { id: 'brick_bbq', name: 'Мангал цегляний', category: 'structure', matureHeight: 2.1, matureWidth: 1.2, footprint: { w: 1.2, d: 0.6 },
    note: 'Цегляний мангал із вогневою камерою, решіткою, витяжкою й димарем.' },
  { id: 'sun_lounger', name: 'Шезлонг', category: 'furniture', matureHeight: 0.85, matureWidth: 0.65, footprint: { w: 0.65, d: 1.95 },
    note: 'Дерев\'яний лежак з регульованою спинкою й подушкою; узголів\'я ззаду.' },
];

// ------------------------------------------------------------------ builders (each returns a Kit)
function swing() {
  const k = new Kit();
  for (const s of [-1, 1]) {
    const x = s * 1.0;
    k.rod(M.anthracite, 0.022, [x, 0.03, -0.46], [x, 0.03, 0.46]);                 // skid
    k.rod(M.anthracite, 0.022, [x, 0.03, -0.46], [x, 0.14, -0.62]);                // curved ends
    k.rod(M.anthracite, 0.022, [x, 0.03, 0.46], [x, 0.14, 0.62]);
    k.rod(M.anthracite, 0.022, [x, 0.03, -0.5], [x, 1.7, 0]);                      // A-frame legs
    k.rod(M.anthracite, 0.022, [x, 0.03, 0.5], [x, 1.7, 0]);
    k.rod(M.anthracite, 0.018, [x, 0.55, -0.31], [x, 0.55, 0.31]);                 // brace
  }
  k.rod(M.anthracite, 0.025, [-1.05, 1.7, 0], [1.05, 1.7, 0]);                     // ridge
  k.rod(M.anthracite, 0.018, [-1, 0.03, 0], [1, 0.03, 0]);                         // ground tie
  // hanging bench
  for (const s of [-1, 1]) {
    k.rod(M.anthracite, 0.012, [s * 0.78, 1.7, 0], [s * 0.78, 0.5, -0.05]);
    k.rod(M.anthracite, 0.012, [s * 0.78, 1.7, 0], [s * 0.78, 0.9, 0.25]);
    k.rod(M.anthracite, 0.016, [s * 0.8, 0.45, -0.25], [s * 0.8, 0.45, 0.2]);      // seat sides
    k.rod(M.anthracite, 0.016, [s * 0.8, 0.45, 0.2], [s * 0.8, 0.88, 0.28]);       // back sides
    k.rod(M.anthracite, 0.016, [s * 0.8, 0.62, -0.1], [s * 0.8, 0.62, 0.22]);      // arm rest
  }
  k.rod(M.anthracite, 0.016, [-0.8, 0.45, -0.25], [0.8, 0.45, -0.25]);
  k.rod(M.anthracite, 0.016, [-0.8, 0.88, 0.28], [0.8, 0.88, 0.28]);
  k.box(M.mesh, 1.6, 0.012, 0.45, 0, 0.45, -0.02);                                  // seat mesh
  k.box(M.mesh, 1.6, 0.43, 0.012, 0, 0.665, 0.24, 0.17, 0, 0);                      // back mesh
  // canopy, tilted slightly toward the front
  k.at(M.canopy, new THREE.PlaneGeometry(2.3, 1.5), 0, 1.76, 0, -PI / 2 + 0.07, 0, 0);
  k.box(M.mauve, 2.3, 0.07, 0.01, 0, 1.72, -0.74);
  k.box(M.mauve, 2.3, 0.07, 0.01, 0, 1.75, 0.74);
  k.box(M.mauve, 0.01, 0.1, 1.5, -1.15, 1.72, 0);
  k.box(M.mauve, 0.01, 0.1, 1.5, 1.15, 1.72, 0);
  return k;
}

function picnic() {
  const k = new Kit();
  for (let i = 0; i < 5; i++) k.box(M.plankDark, 1.8, 0.04, 0.147, 0, 0.73, -0.3 + i * 0.15);   // table top at 0.75
  for (const z of [-0.6, 0.6]) {                                                    // benches (top 0.45)
    k.box(M.plankDark, 1.8, 0.04, 0.3, 0, 0.43, z);
  }
  for (const x of [-0.7, 0.7]) {                                                    // concrete trestles
    k.box(M.concrete, 0.1, 0.07, 1.5, x, 0.035, 0);                                 // ground sill
    k.bar(M.concrete, 0.1, 0.09, [x, 0.07, -0.66], [x, 0.7, -0.22]);
    k.bar(M.concrete, 0.1, 0.09, [x, 0.07, 0.66], [x, 0.7, 0.22]);
    k.box(M.concrete, 0.1, 0.07, 0.62, x, 0.7, 0);                                  // top rail under the table
    k.box(M.concrete, 0.1, 0.07, 1.4, x, 0.39, 0);                                  // bench rail
  }
  return k;
}

function tripod() {
  const k = new Kit();
  const R = 0.5, apex = [0, 1.6, 0];
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * PI) / 3;
    k.rod(M.blackSteel, 0.014, [R * Math.cos(a), 0, R * Math.sin(a)], apex, 6);
    const b = a + PI / 3, r = 0.25;
    k.rod(M.blackSteel, 0.004, [0, 1.52, 0], [r * Math.cos(b), 0.65, r * Math.sin(b)], 3);   // chains
  }
  k.torus(M.blackSteel, 0.03, 0.012, 0, 1.58, 0, PI / 2, 0, 0, 5, 8);
  k.rod(M.blackSteel, 0.006, [0, 1.58, 0], [0, 1.5, 0], 4);
  // grate Ø 0.5 at 0.65
  k.torus(M.blackSteel, 0.25, 0.007, 0, 0.65, 0, PI / 2, 0, 0, 4, 28);
  k.torus(M.blackSteel, 0.12, 0.005, 0, 0.65, 0, PI / 2, 0, 0, 4, 20);
  for (let i = -2; i <= 2; i++) {
    const h = Math.sqrt(0.0625 - Math.pow(i * 0.1, 2));
    k.rod(M.blackSteel, 0.004, [i * 0.1, 0.65, -h], [i * 0.1, 0.65, h], 3);
  }
  // fire bowl Ø 0.6
  const bowl = new THREE.SphereGeometry(1, 20, 6, 0, 2 * PI, PI / 2, PI / 2);
  bowl.scale(0.3, 0.17, 0.3);
  k.at(M.mat, bowl, 0, 0.32, 0);
  k.torus(M.blackSteel, 0.3, 0.012, 0, 0.32, 0, PI / 2, 0, 0, 4, 24);
  k.at(M.ash, new THREE.CircleGeometry(0.27, 16), 0, 0.29, 0, -PI / 2);
  for (let i = 0; i < 3; i++) {                                                    // legs braced to the bowl rim
    const a = (i * 2 * PI) / 3;
    k.rod(M.blackSteel, 0.008, [0.4 * Math.cos(a), 0.32, 0.4 * Math.sin(a)], [0.3 * Math.cos(a), 0.32, 0.3 * Math.sin(a)], 4);
  }
  return k;
}

function bin() {
  const k = new Kit();
  k.cyl(M.aggregate, 0.225, 0.225, 0.6, 0, 0.3, 0, 24);
  k.torus(M.galv, 0.225, 0.013, 0, 0.6, 0, PI / 2, 0, 0, 5, 24);
  k.at(M.dark, new THREE.CircleGeometry(0.205, 20), 0, 0.5, 0, -PI / 2);
  k.cyl(M.dark, 0.205, 0.205, 0.1, 0, 0.55, 0, 20, 0, 0, 0, true);
  return k;
}

function trampoline() {
  const k = new Kit();
  k.at(M.mat, new THREE.CircleGeometry(1.2, 40), 0, 0.75, 0, -PI / 2);
  const pts = [[1.18, 0.73], [1.5, 0.73], [1.52, 0.765], [1.5, 0.8], [1.18, 0.8], [1.18, 0.73]].map((p) => new THREE.Vector2(p[0], p[1]));
  k.at(M.padBlue, new THREE.LatheGeometry(pts, 40));
  k.torus(M.galv, 1.3, 0.02, 0, 0.7, 0, PI / 2, 0, 0, 5, 40);
  for (let i = 0; i < 6; i++) {
    const a = (i + 0.5) * PI / 3, c = Math.cos(a), s = Math.sin(a), R = 1.3;
    const p = (t, y) => [R * c - t * s, y, R * s + t * c];
    const w = [[-0.4, 0.7], [-0.2, 0.02], [0, 0.45], [0.2, 0.02], [0.4, 0.7]];
    for (let j = 0; j < 4; j++) k.rod(M.galv, 0.017, p(...w[j]), p(...w[j + 1]), 5);
    k.rod(M.galv, 0.017, p(-0.2, 0.02), p(0.2, 0.02), 5);
  }
  return k;
}

function planter() {
  const k = new Kit();
  for (let i = 0; i < 4; i++) {
    const y = 0.05 + i * 0.07;
    for (const z of [-0.29, 0.29]) k.box(M.slatRed, 0.6, 0.06, 0.02, 0, y, z);
    for (const x of [-0.29, 0.29]) k.box(M.slatRed, 0.02, 0.06, 0.56, x, y, 0);
  }
  for (const x of [-0.28, 0.28]) for (const z of [-0.28, 0.28]) k.box(M.slatRed, 0.04, 0.28, 0.04, x, 0.14, z);
  k.box(M.mulch, 0.54, 0.03, 0.54, 0, 0.245, 0);
  return k;
}

function bench() {
  const k = new Kit();
  for (const z of [-0.15, 0, 0.15]) k.box(M.pine, 1.5, 0.035, 0.13, 0, 0.45, z);
  for (const i of [0, 1]) {
    const y = 0.64 + i * 0.16, z = 0.2 + (y - 0.45) * 0.2;
    k.box(M.pine, 1.5, 0.12, 0.03, 0, y, z, -0.2);
  }
  for (const s of [-1, 1]) {
    const x = s * 0.68;
    k.bar(M.anthracite, 0.05, 0.05, [x, 0, -0.2], [x, 0.43, -0.2]);
    k.bar(M.anthracite, 0.05, 0.05, [x, 0, 0.2], [x, 0.43, 0.2]);
    k.bar(M.anthracite, 0.05, 0.05, [x, 0.43, 0.2], [x, 0.85, 0.28]);
    k.bar(M.anthracite, 0.05, 0.05, [x, 0.43, -0.2], [x, 0.43, 0.22]);
    k.bar(M.anthracite, 0.04, 0.04, [x, 0.62, -0.17], [x, 0.62, 0.24]);
    k.bar(M.anthracite, 0.04, 0.04, [x, 0.43, -0.17], [x, 0.62, -0.17]);
  }
  return k;
}

function raisedBed() {
  const k = new Kit();
  const W = 1.2, D = 2.4;
  for (let i = 0; i < 2; i++) {
    const y = 0.1 + i * 0.2;
    for (const z of [-D / 2 + 0.015, D / 2 - 0.015]) k.box(M.pine, W, 0.19, 0.03, 0, y, z);
    for (const x of [-W / 2 + 0.015, W / 2 - 0.015]) k.box(M.pine, 0.03, 0.19, D - 0.06, x, y, 0);
  }
  for (const x of [-W / 2 + 0.04, W / 2 - 0.04]) for (const z of [-D / 2 + 0.04, D / 2 - 0.04]) k.box(M.pineDark, 0.08, 0.4, 0.08, x, 0.2, z);
  k.box(M.soil, W - 0.08, 0.34, D - 0.08, 0, 0.18, 0);
  return k;
}

function compost() {
  const k = new Kit();
  for (let i = 0; i < 5; i++) {
    const y = 0.1 + i * 0.17;
    for (const z of [-0.485, 0.485]) k.box(M.pine, 0.94, 0.11, 0.025, 0, y, z);
    for (const x of [-0.485, 0.485]) k.box(M.pine, 0.025, 0.11, 0.94, x, y, 0);
  }
  for (const x of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) k.box(M.pineDark, 0.06, 0.9, 0.06, x, 0.45, z);
  k.box(M.compost, 0.9, 0.55, 0.9, 0, 0.3, 0);
  return k;
}

function barrel() {
  const k = new Kit();
  for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) k.box(M.concrete, 0.18, 0.2, 0.18, x, 0.1, z);
  k.box(M.concrete, 0.6, 0.04, 0.6, 0, 0.22, 0);
  k.cyl(M.barrel, 0.3, 0.27, 0.86, 0, 0.67, 0, 24);
  for (const y of [0.4, 0.67, 0.94]) k.torus(M.barrel, y === 0.67 ? 0.307 : 0.29, 0.012, 0, y, 0, PI / 2, 0, 0, 4, 24);
  k.cyl(M.barrelLid, 0.29, 0.29, 0.05, 0, 1.12, 0, 24);
  k.cyl(M.barrelLid, 0.08, 0.08, 0.04, 0.1, 1.16, 0.1, 10);
  k.rod(M.brass, 0.014, [0, 0.35, -0.27], [0, 0.35, -0.38], 6);                       // tap
  k.rod(M.brass, 0.012, [0, 0.35, -0.38], [0, 0.3, -0.38], 6);
  return k;
}

function pergola() {
  const k = new Kit();
  const H = 2.5;
  for (const x of [-1.44, 1.44]) for (const z of [-1.44, 1.44]) k.box(M.pineDark, 0.12, H, 0.12, x, H / 2, z);
  for (const z of [-1.44, 1.44]) k.box(M.pineDark, 3.2, 0.18, 0.08, 0, 2.4, z);           // main beams along X
  for (let i = 0; i < 9; i++) k.box(M.pine, 0.06, 0.1, 3.3, -1.4 + i * 0.35, 2.54, 0);      // rafters along Z
  for (const x of [-1.44, 1.44]) for (const z of [-1.44, 1.44]) {                         // knee braces
    const sx = -Math.sign(x), sz = -Math.sign(z);
    k.bar(M.pineDark, 0.06, 0.06, [x, 2.0, z], [x + sx * 0.4, 2.4, z]);
    k.bar(M.pineDark, 0.06, 0.06, [x, 2.0, z], [x, 2.4, z + sz * 0.4]);
  }
  return k;
}

function greenhouse() {
  const k = new Kit();
  const hx = 1.5, hz = 2, eave = 1.75, ridge = 2.5, b = 0.045;
  for (const x of [-hx, hx]) {
    for (let i = 0; i < 5; i++) k.box(M.alu, b, eave, b, x, eave / 2, -hz + i);
    k.box(M.alu, b, b, 4, x, eave, 0);
    k.box(M.alu, b, 0.18, 4, x, 0.09, 0);
    k.box(M.alu, b, b, 4, x, 0.9, 0);
  }
  k.box(M.alu, b, b, 4, 0, ridge, 0);
  for (let i = 0; i < 5; i++) {
    const z = -hz + i;
    k.bar(M.alu, b, b, [-hx, eave, z], [0, ridge, z]);
    k.bar(M.alu, b, b, [hx, eave, z], [0, ridge, z]);
    if (i > 0 && i < 4) k.box(M.alu, 3, b, b, 0, eave, z);
  }
  for (const z of [-hz, hz]) {                                                       // end walls
    k.box(M.alu, 3, 0.18, b, 0, 0.09, z);
    k.box(M.alu, 3, b, b, 0, eave, z);
    for (const x of [-0.45, 0.45]) k.box(M.alu, b, eave, b, x, eave / 2, z);
  }
  k.box(M.alu, 0.9, b, b, 0, 1.92, -hz);                                             // door header
  k.box(M.alu, 0.04, 0.04, 0.04, 0.38, 0.95, -hz - 0.03);                            // door handle
  k.box(M.alu, b, 1.75, b, 0, 0.88, -hz + 0.01);                                     // door split (double leaf)
  // glazing
  const ang = Math.atan2(ridge - eave, hx), len = Math.hypot(hx, ridge - eave);
  for (const s of [-1, 1]) {
    k.box(M.glass, 0.01, eave - 0.18, 4, s * hx, 0.18 + (eave - 0.18) / 2, 0);
    k.box(M.glass, len, 0.01, 4, s * hx / 2, (eave + ridge) / 2, 0, 0, 0, -s * ang);
  }
  for (const z of [-hz, hz]) {
    k.box(M.glass, 3, eave - 0.18, 0.01, 0, 0.18 + (eave - 0.18) / 2, z);
    const tri = new THREE.Shape([new THREE.Vector2(-hx, 0), new THREE.Vector2(hx, 0), new THREE.Vector2(0, ridge - eave)].map((p) => p));
    k.at(M.glass, new THREE.ShapeGeometry(tri), 0, eave, z);
  }
  // staging bench inside, to give the glass something to show
  k.box(M.pine, 0.5, 0.04, 3.2, -1.1, 0.8, 0);
  return k;
}

function bbq() {
  const k = new Kit();
  k.box(M.brick, 1.2, 0.45, 0.6, 0, 0.225, 0);                                       // plinth
  k.box(M.brick, 1.3, 0.08, 0.7, 0, 0.49, 0);                                        // overhanging top slab
  for (const x of [-0.5, 0.5]) k.box(M.brick, 0.2, 0.52, 0.5, x, 0.79, 0);          // firebox sides
  k.box(M.brick, 1.2, 0.52, 0.15, 0, 0.79, 0.225);                                   // back
  k.box(M.ash, 0.8, 0.03, 0.34, 0, 0.55, -0.05);                                     // coals bed
  for (let i = 0; i < 8; i++) k.rod(M.blackSteel, 0.007, [-0.4, 0.8, -0.3 + i * 0.05], [0.4, 0.8, -0.3 + i * 0.05], 4);
  k.rod(M.blackSteel, 0.01, [-0.4, 0.8, -0.3], [-0.4, 0.8, 0.07], 4);
  k.rod(M.blackSteel, 0.01, [0.4, 0.8, -0.3], [0.4, 0.8, 0.07], 4);
  k.box(M.brick, 1.2, 0.08, 0.5, 0, 1.09, 0);                                        // lintel/shelf
  k.at(M.brick, new THREE.CylinderGeometry(0.17, 0.62, 0.45, 4, 1, true).rotateY(PI / 4).scale(1, 1, 0.8), 0, 1.35, 0.03);
  k.box(M.brick, 0.34, 0.8, 0.34, 0, 1.7, 0.07);                                     // chimney
  k.box(M.brick, 0.44, 0.06, 0.44, 0, 2.1, 0.07);
  return k;
}

function lounger() {
  const k = new Kit();
  const y0 = 0.3;
  for (const x of [-0.29, 0.29]) {
    k.box(M.pine, 0.05, 0.06, 1.15, x, y0 - 0.03, -0.38);
    k.bar(M.pine, 0.05, 0.05, [x, y0 - 0.03, 0.19], [x, y0 - 0.03 + 0.5, 0.19 + 0.6]);       // backrest rail
    k.bar(M.pineDark, 0.05, 0.05, [x, 0, -0.9], [x, y0 - 0.03, -0.8]);                      // front legs
    k.bar(M.pineDark, 0.05, 0.05, [x, 0, 0.2], [x, y0 - 0.03, 0.15]);                       // rear legs
    k.bar(M.pineDark, 0.03, 0.03, [x, 0.03, 0.2], [x, 0.05, 0.9]);                          // support strut base
    k.bar(M.pineDark, 0.03, 0.03, [x, 0.05, 0.9], [x, 0.55, 0.75]);
    k.rod(M.anthracite, 0.04, [x, 0.04, -0.93], [x, 0.04, -0.97], 8);
  }
  for (let i = 0; i < 6; i++) k.box(M.pine, 0.58, 0.02, 0.07, 0, y0 + 0.005, -0.88 + i * 0.2);
  k.box(M.cushion, 0.58, 0.05, 1.15, 0, y0 + 0.04, -0.38);
  k.bar(M.cushion, 0.58, 0.05, [0, y0 + 0.04, 0.2], [0, y0 + 0.04 + 0.5, 0.2 + 0.6]);
  return k;
}

const BUILDERS = {
  swing_canopy: swing, picnic_table: picnic, tripod_grill: tripod, concrete_bin: bin, trampoline,
  planter_box: planter, bench, raised_bed: raisedBed, compost_bin: compost, rain_barrel: barrel,
  pergola, greenhouse, brick_bbq: bbq, sun_lounger: lounger,
};

// ------------------------------------------------------------------ factory + cache
const parts = new Map();   // id → [{mat, geo}]

/** @returns {THREE.Group|null} fresh Group per call; geometry and materials are shared and cached. */
export function createFurniture(id) {
  const def = FURNITURE.find((f) => f.id === id);
  const build = BUILDERS[id];
  if (!def || !build) return null;
  let list = parts.get(id);
  if (!list) parts.set(id, list = build().build());
  const g = new THREE.Group();
  g.name = id;
  for (const { mat, geo } of list) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !mat.userData.noShadow;
    m.receiveShadow = true;
    if (mat.transparent) m.renderOrder = 1;
    g.add(m);
  }
  g.userData.size = { height: def.matureHeight, width: def.matureWidth };
  return g;
}
