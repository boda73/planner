# Planner — 3D-тур ділянкою і планувальник посадок

A browser 3D model of a real 20 × 25 m garden plot. You walk through it and plan what to plant where and
how it will look in N years. Static site: plain ES modules + vendored three.js r170. **No build step, no CDN.**
UI language: **Ukrainian**. Code, comments, commits: English.

## Run / look at it

```bash
python3 -m http.server 8100          # then open http://localhost:8100/  (app)  or  /dev/view.html  (harness)
node tools/shot.cjs "dev/view.html?photo=IMG_4010&overlay=0.5" /tmp/a.jpg "index.html?view=plan&ui=0" /tmp/b.jpg
python3 tools/bake_ground.py         # re-bake assets/ground/* from the satellite photo
```

`tools/shot.cjs` = headless Chromium with software WebGL; it serves the repo itself, waits for
`window.__READY === true`, prints console errors. `dev/view.html` renders world + existing items without the
app UI; its URL params are documented at the top of `dev/view.js` (`photo=`, `overlay=`, `cam=`, `view=top`, …).

## Map

| Path | What | Notes |
|---|---|---|
| `js/config/site.js` | **SITE**: measured geometry of the plot, existing items, photo camera poses | single source of truth; see `docs/SURVEY.md` |
| `js/core/coords.js` | coordinate conventions + helpers | read the header comment first |
| `js/core/sun.js`, `js/core/renderer.js` | sun position for 50.01°N; shared renderer setup | |
| `js/lib/three.js`, `js/lib/addons.js` | the only way to import three / addons | vendored in `vendor/three` |
| `js/world/` | ground, paving, fences, surroundings, sky, lights (`index.js`); house + shed (`structures.js`) | |
| `js/items/furniture.js` | furniture catalogue + models | |
| `js/plants/` | plant catalogue (`catalog.js`) + procedural generator (`generate.js`) | |
| `js/items/registry.js` | unified catalogue (plants + furniture) — the app uses only this | |
| `index.html`, `css/`, `js/main.js`, `js/app/` | the application: views, controls, planner, UI | |
| `dev/` | harness + per-module galleries | not shipped to users, but keep working |
| `assets/ground/` | baked textures: `context.jpg` (X −12…26, Y −11…34 @32 px/m), `lawn.jpg` (plot @64 px/m) | both north-up in plot coords |
| `assets/photos/` | the reference photos at 1280 px, EXIF stripped | originals: `images/planner/` |
| `docs/SURVEY.md` | what the real place looks like: dimensions, materials, colours | read before modelling |

## Coordinates (never deviate)

- **Plot metres**: `X` east 0…20, `Y` north 0…25, origin = SW corner. **World**: `x = X`, `y = up`, `z = −Y`.
- Plot bearing: 0 = +Y, clockwise. True north = plot bearing − 10.5° (the plot is turned 10.5° clockwise).
- Every placeable model: origin on the ground at its centre, +Y up, **front = local −Z**, metres.
  `object.rotation.y = bearingToYaw(bearing)`.

## Module contracts

```js
// js/world/index.js
createWorld({ scene, renderer, camera, site, assetsBase }) → Promise<World>
World = {
  group,                       // THREE.Group already added to the scene
  groundMeshes,                // Mesh[] to raycast for placing items / walking (lawn + paving)
  colliders,                   // [{type:'box', minX, minY, maxX, maxY, h}] in plot metres (fences, buildings)
  setSun({azimuth, elevation}),// true azimuth/elevation in degrees → light, sky, fog, ambient
  setSeason(season),           // 'spring' | 'summer' | 'autumn' | 'winter' → surroundings / lawn tint
  setSatelliteOverlay(opacity),// 0…1: show the raw satellite photo over the plot (plan view aid)
  update(dt, camera),          // per frame
  heightAt(X, Y),              // ground height, 0 for now
}
// js/world/structures.js
createStructures(site) → { group, colliders }
// js/items/furniture.js
FURNITURE: Def[];  createFurniture(id, opts) → Object3D
// js/plants/catalog.js, js/plants/generate.js
PLANTS: Def[];  createPlant(id, {age, season, seed}) → Object3D;  plantSizeAt(id, age) → {height, width};  ageForHeight(id, h) → years
// js/items/registry.js  (what the app imports)
CATEGORIES, loadCatalog(), listDefs(), getDef(id), createItemObject(id, {age, season, seed}), itemSizeAt(id, age), ageForHeight(id, h)
```

Item ids used by `SITE.existingItems` must keep existing: `thuja_smaragd`, `cherry_sour`, `peach`, `apple`,
`rose_bush`, `yucca`, `blueberry`, `swing_canopy`, `picnic_table`, `tripod_grill`, `concrete_bin`, `trampoline`, `planter_box`.

## Look & performance

- Semi-realistic: true dimensions and colours first, detail second. Procedural geometry + canvas textures only
  (no downloaded assets). `MeshStandardMaterial`, sRGB colours, ACES tone mapping (see `core/renderer.js`).
- Budget: the whole scene with ~150 plants must hold 30 fps on a laptop iGPU. Share materials and geometries,
  merge static geometry, use `InstancedMesh` for repeats. Mature tree ≤ 4k triangles, shrub ≤ 800, small plant ≤ 200.
- A later revision may swap procedural models for Blender-made glTF (`assets/models/<id>.glb`): keep each model
  behind one factory function so it can be replaced without touching callers.

## Working rules (token economy)

- Do not open `images/planner/*.jpeg` (12 MP originals). Use `assets/photos/<id>.jpg`, and only the ones you need —
  `docs/SURVEY.md` already describes what they show.
- Verify visually with `tools/shot.cjs` at the default 960×720 or smaller; several pages per call; look at a
  screenshot only when you changed something visible. Photo matching: `dev/view.html?photo=<id>&overlay=0.5`.
- Subagents: edit only the files you were assigned, never run git commands that change state, finish with a short
  report (what works, what is approximate, any contract deviation).
- Measurements live in `site.js`. If something looks misplaced, fix the number there (and say why), not in a model.
