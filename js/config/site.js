// SITE — the measured description of the real plot. Single source of truth for geometry.
//
// All positions are PLOT METERS: X → east (0..20), Y → north (0..25), origin = SW corner (see core/coords.js).
// Rects are [X0, Y0, X1, Y1]. Bearings are PLOT bearings (0 = +Y, clockwise) unless named "true".
//
// Where the numbers come from (do not "fix" them by eye — re-measure instead, see docs/SURVEY.md):
//   images/planner/planCosmos.png (satellite, north up) is the truth for proportions;
//   images/planner/planSizes.jpg gives landmark sizes; scale = 27.0 px/m.
//   Satellite pixel of a plot point:  px = 204.8 + 26.41·X + 4.22·Y ,  py = 777.1 + 5.61·X − 26.67·Y

const row = (id, n, X0, Y0, X1, Y1, h, extra = {}) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    // deterministic ±12 % height variation so rows do not look cloned
    const k = 1 + 0.12 * Math.sin(i * 12.9898 + X0 * 3.1 + Y0 * 1.7);
    return { id, X: +(X0 + (X1 - X0) * t).toFixed(2), Y: +(Y0 + (Y1 - Y0) * t).toFixed(2), h: +(h * k).toFixed(2), ...extra };
  });

export const SITE = {
  plot: { width: 20, depth: 25 },
  northBearingOfY: 10.5,                     // true compass bearing of the plot's +Y axis, degrees
  geo: { lat: 50.011, lon: 21.007 },
  defaultTime: { month: 7, day: 3, hour: 12.5 },

  // ---------------------------------------------------------------- paving
  // 'cobble' = old tumbled concrete cobbles, warm grey-beige, small irregular stones (~10×12 cm), black steel edging.
  // 'slab'   = new light-grey rectangular pavers (~20×10 cm) with dark-grey concrete kerbs on both sides.
  paving: [
    { id: 'pad', kind: 'cobble', rect: [14.95, 18.65, 19.45, 22.6] },      // parking-size pad in the NE
    { id: 'path', kind: 'slab', rect: [17.95, 8.15, 19.45, 18.65] },       // 1.5 m path along the east fence
    { id: 'terrace', kind: 'cobble', rect: [12.95, 0.4, 19.45, 8.15] },    // paved yard around the house
    { id: 'terraceNew', kind: 'slab', rect: [12.95, 0.4, 14.8, 1.45] },    // newer pavers SW of the house (on top of 'terrace')
  ],

  // ---------------------------------------------------------------- buildings on the plot
  house: {
    // Small garden cottage. White plastered main block + lower brown wooden annex (tool store) on its east side.
    main: { rect: [14.8, 1.45, 17.1, 4.85] },
    annex: { rect: [17.1, 1.45, 18.7, 4.85] },
    // Asymmetric gable, ridge runs N–S right above the WEST wall of the main block.
    ridge: { X: 14.8, h: 2.8 },
    roofEast: { X1: 17.65, h: 2.35 },        // long shallow slope (≈9°) down to the east, overhangs the annex by 0.55 m
    roofWest: { X0: 13.95, h: 2.1 },         // short steep slope (≈39°) = porch canopy overhanging west by 0.85 m
    roofY: [1.3, 4.96],                      // roof extent along Y (0.15 m overhang N and S)
    annexRoof: { X0: 17.1, hWest: 2.25, X1: 18.85, hEast: 1.98 },
  },
  shed: {
    // New garden shed/WC: wood-look vertical slats (warm brown), dark bitumen-shingle low hip roof, grey door on the SOUTH face.
    rect: [16.9, 22.65, 18.7, 24.45], wallH: 2.2, roofH: 0.22, overhang: 0.14, doorFace: 'south',
  },

  // ---------------------------------------------------------------- fences (on the plot boundary)
  fences: [
    { id: 'north', from: [0, 25], to: [20, 25], h: 1.6, type: 'net' },        // wire fence + dark-green privacy net, black steel posts
    { id: 'east', from: [20, 0], to: [20, 25], h: 1.5, type: 'chainlink' },   // old rusty-brown chain-link, concrete posts
    { id: 'southPanel', from: [0, 0], to: [13, 0], h: 1.5, type: 'panel' },   // modern anthracite welded-wire panels
    { id: 'southWood', from: [13, 0], to: [20, 0], h: 1.5, type: 'wood' },    // brown vertical-board fence behind the house
    { id: 'west', from: [0, 0], to: [0, 25], h: 1.4, type: 'mesh' },          // light wire mesh, dark-green posts every 2.5 m
  ],

  // ---------------------------------------------------------------- surroundings (outside the fences, approximate)
  context: {
    road: { Y0: 25.5, Y1: 32.5 },            // street along the north side (parallel to X), pavement + asphalt
    buildings: [
      { id: 'eastHouse', center: [27.5, 21], size: [7, 9], wallH: 3.2, roof: 'gable', ridgeAlong: 'Y', roofH: 2.6, wall: '#d9d4c7', roofColor: '#3d3f45' },
      { id: 'seHouse', center: [24.2, -4.2], size: [7, 7], wallH: 3.0, roof: 'gable', ridgeAlong: 'X', roofH: 2.4, wall: '#efece4', roofColor: '#9a3b2e' },
      { id: 'southShed', center: [5.5, -2.9], size: [3.2, 2.4], wallH: 2.1, roof: 'mono', roofH: 0.3, wall: '#3b2a22', roofColor: '#2b2b2e' },
      { id: 'southGazebo', center: [9.8, -3.7], size: [3, 3], wallH: 2.2, roof: 'gable', ridgeAlong: 'X', roofH: 0.8, wall: '#8b7a66', roofColor: '#d7dbd8', open: true },
      { id: 'swBarn', center: [2.9, -5.6], size: [5.2, 5.5], wallH: 2.6, roof: 'gable', ridgeAlong: 'Y', roofH: 1.0, wall: '#8d8f8c', roofColor: '#b9bec4' },
      { id: 'westHut', center: [-21, 14], size: [3, 3], wallH: 2.2, roof: 'gable', ridgeAlong: 'X', roofH: 1.0, wall: '#6e5a45', roofColor: '#3f7f5a' },
    ],
    // vegetation masses beyond the fences: { X, Y, r (crown radius), h (height), kind }
    trees: [
      { X: -3.5, Y: 3.5, r: 3.6, h: 9, kind: 'broadleaf' }, { X: -5.5, Y: -1.5, r: 3.2, h: 8, kind: 'broadleaf' },
      { X: 0.5, Y: -8.5, r: 3.5, h: 9, kind: 'broadleaf' }, { X: 13.2, Y: -5.5, r: 3.0, h: 7.5, kind: 'broadleaf' },
      { X: 17.5, Y: -6.5, r: 2.6, h: 6.5, kind: 'fruit-old' }, { X: 22.5, Y: 2.5, r: 2.4, h: 6, kind: 'fruit-old' },
      { X: 23.5, Y: 9.5, r: 3.0, h: 7, kind: 'broadleaf' }, { X: 24.5, Y: 15, r: 3.2, h: 8, kind: 'broadleaf' },
      { X: 3, Y: 38, r: 4.5, h: 12, kind: 'broadleaf' }, { X: 12, Y: 37, r: 4.0, h: 13, kind: 'poplar' },
      { X: 19, Y: 36.5, r: 4.5, h: 11, kind: 'broadleaf' }, { X: 27, Y: 34.5, r: 4.0, h: 10, kind: 'broadleaf' },
      { X: -9, Y: 36, r: 4.0, h: 11, kind: 'broadleaf' }, { X: -14, Y: 8, r: 3.0, h: 7, kind: 'broadleaf' },
      { X: 31, Y: 8, r: 3.5, h: 9, kind: 'broadleaf' }, { X: 8, Y: -12, r: 4.0, h: 10, kind: 'broadleaf' },
    ],
    hedges: [
      { from: [20.9, 5.5], to: [21.3, 20.5], w: 1.6, h: 2.8, kind: 'wild' },       // overgrown shrubs behind the east chain-link
      { from: [-11, 25.6], to: [-0.6, 25.6], w: 0.9, h: 2.0, kind: 'clipped' },    // west neighbour's clipped hedge along the street
    ],
    poles: [{ X: 19.4, Y: -1.6, h: 8 }],
    // far skyline to the N–NNW: pale apartment blocks ~300 m away, plus a tree line all around.
    skyline: { blocksBearing: [330, 350, 8], distance: 320 },
  },

  // ---------------------------------------------------------------- what stands on the plot today
  // Catalogue items (plants + furniture). `h` = present height in metres (plants: converted to an age).
  // `rot` = plot bearing of the item's front. These are ordinary planner items the user can move or delete.
  existingItems: [
    // thuja hedge along the north side, 1.4 m inside the fence, ~2.5 m tall, crowns touching
    ...row('thuja_smaragd', 24, 0.7, 23.6, 16.35, 23.6, 2.5, { tag: 'hedgeNorth' }),
    // young thujas along the west fence
    ...row('thuja_smaragd', 32, 0.5, 2.2, 0.5, 22.4, 0.75, { tag: 'rowWest' }),
    // young thujas along the south fence (west part)
    ...row('thuja_smaragd', 9, 1.2, 0.9, 11.2, 0.9, 0.6, { tag: 'rowSouth' }),
    // short line of small conifers west of the terrace
    ...row('thuja_smaragd', 5, 7.6, 7.4, 11.6, 7.4, 0.75, { tag: 'lineMid' }),

    // orchard corner (SW): sour cherries + a peach, 15–20 cm trunks, crowns touching
    { id: 'cherry_sour', X: 8.6, Y: 2.0, h: 4.4, tag: 'orchard' },
    { id: 'cherry_sour', X: 6.3, Y: 2.4, h: 4.6, tag: 'orchard' },
    { id: 'cherry_sour', X: 3.9, Y: 2.3, h: 4.2, tag: 'orchard' },
    { id: 'cherry_sour', X: 7.3, Y: 5.2, h: 4.5, tag: 'orchard' },
    { id: 'cherry_sour', X: 4.9, Y: 5.5, h: 4.0, tag: 'orchard' },
    { id: 'peach', X: 2.4, Y: 4.6, h: 3.4, tag: 'orchard' },
    { id: 'apple', X: 11.6, Y: 5.6, h: 1.8, tag: 'sapling' },

    // flower bed in the middle (≈2.6 × 1.2 m, long side east–west)
    { id: 'rose_bush', X: 8.7, Y: 8.3, h: 0.9, tag: 'bed' },
    { id: 'rose_bush', X: 9.5, Y: 8.0, h: 1.0, tag: 'bed' },
    { id: 'rose_bush', X: 10.3, Y: 8.4, h: 0.8, tag: 'bed' },
    { id: 'yucca', X: 9.4, Y: 8.8, h: 0.8, tag: 'bed' },

    // wooden planter boxes with highbush blueberries, a row east–west
    ...[3.5, 5.5, 7.5, 9.5, 11.5].flatMap((X) => [
      { id: 'planter_box', X, Y: 9.7, rot: 0, tag: 'planters' },
      { id: 'blueberry', X, Y: 9.7, h: 0.95, tag: 'planters' },
    ]),

    // furniture
    { id: 'swing_canopy', X: 13.75, Y: 3.2, rot: 270 },     // garden swing sofa, purple canopy, faces west
    { id: 'picnic_table', X: 10.5, Y: 3.0, rot: 90 },       // long axis north–south
    { id: 'tripod_grill', X: 8.8, Y: 3.8, rot: 0 },
    { id: 'concrete_bin', X: 13.25, Y: 7.85, rot: 0 },      // on the NW corner of the terrace
    { id: 'trampoline', X: 15.2, Y: 11.8, rot: 0 },         // Ø 3 m; seen on the satellite and in the July photos
  ],

  // ---------------------------------------------------------------- reference photos (assets/photos/<id>.jpg)
  // Camera poses are estimates (GPS ±4 m, compass ±15°) refined by eye. hfov/vfov are for the photo as displayed.
  photos: [
    { id: 'IMG_4010', X: 16.0, Y: 5.3, eye: 1.55, heading: 336, pitch: -14, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'Від будиночка на північ: газон, туї, сарайчик' },
    { id: 'IMG_4017', X: 0.3, Y: 22.8, eye: 1.55, heading: 124, pitch: -7, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'З північно-західного кута на будиночок' },
    { id: 'IMG_4013', X: 12.3, Y: 1.1, eye: 1.55, heading: 334, pitch: -10, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'Стіл для пікніка і газон' },
    { id: 'IMG_4015', X: 15.0, Y: 6.6, eye: 1.55, heading: 258, pitch: -12, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'З бруківки на захід: сад і грядки' },
    { id: 'IMG_4011', X: 11.3, Y: 1.5, eye: 1.55, heading: 68, pitch: -8, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'Будиночок і гойдалка із заходу' },
    { id: 'IMG_4009', X: 18.6, Y: 13.2, eye: 1.55, heading: 187, pitch: -9, hfov: 53.13, vfov: 73.74, when: { month: 10, day: 31, hour: 13.3 }, title: 'Доріжка до будиночка' },
    { id: 'IMG_4008', X: 19.3, Y: 24.2, eye: 1.55, heading: 228, pitch: -18, hfov: 104.25, vfov: 81.2, when: { month: 10, day: 31, hour: 13.3 }, title: 'Сарайчик з північно-східного кута' },
    { id: 'IMG_4012', X: 12.6, Y: 1.4, eye: 1.55, heading: 298, pitch: -16, hfov: 81.2, vfov: 104.25, when: { month: 10, day: 31, hour: 13.3 }, title: 'Сад уздовж південного паркану' },
    { id: 'IMG_3846', X: 12.9, Y: 6.2, eye: 1.5, heading: 15, pitch: 0, hfov: 26.3, vfov: 17.7, when: { month: 10, day: 16, hour: 15.95 }, title: 'Сарайчик і туї (телеоб\'єктив)' },
    { id: 'IMG_2863', X: 12.9, Y: 3.0, eye: 1.55, heading: 259, pitch: -18, hfov: 81.2, vfov: 104.25, when: { month: 7, day: 3, hour: 12.25 }, title: 'Літо: стіл і вишні' },
    { id: 'IMG_2875', X: 4.5, Y: 7.8, eye: 1.55, heading: 141, pitch: -8, hfov: 104.25, vfov: 81.2, when: { month: 7, day: 3, hour: 12.35 }, title: 'Літо: вишні та гамак' },
    { id: 'IMG_2876', X: 2.8, Y: 9.8, eye: 1.55, heading: 75, pitch: -14, hfov: 53.13, vfov: 73.74, when: { month: 7, day: 3, hour: 12.35 }, title: 'Літо: ящики з лохиною, батут' },
    { id: 'IMG_2873', X: 8.3, Y: 9.0, eye: 1.55, heading: 295, pitch: -15, hfov: 53.13, vfov: 73.74, when: { month: 7, day: 3, hour: 12.35 }, title: 'Літо: лохина і західна межа' },
  ],
};
