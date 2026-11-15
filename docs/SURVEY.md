# Site survey — what the real place looks like

Allotment-type garden plot near Tarnów (PL), 50.011°N 21.007°E, nominally **20 m (E–W) × 25 m (N–S)**, flat.
The fenced area is a little larger: `SITE.plot.bounds = [-1.7, 0, 20, 25.4]` — see "Fences".
The plot's long axis points 10.5° east of true north. A quiet street runs along the north side.
Coordinates below are plot metres (X east, Y north, origin SW corner) — the same numbers as `js/config/site.js`.

## How it was measured

- `images/planner/planCosmos.png` (satellite, north up) is the truth for proportions; `planSizes.jpg` gives sizes.
- Scale 27.0 px/m. Plot point → satellite pixel: `px = 204.8 + 26.41·X + 4.22·Y`, `py = 777.1 + 5.61·X − 26.67·Y`
  (E–W lines are turned 12°, N–S lines 9°; the small skew is removed by this affine).
- Checks: path 10.45 m (sketch 10.5), terrace 6.5 × 7.75 m (6.5 × 7.5), pad 4.5 × 3.95 m (5 × 4),
  trampoline Ø 3.0 m, west thuja row → east fence 19.5 m. Things known only to ±0.5 m: north fence line,
  shed position, house wall lines (roof overhangs hide them), every plant and furniture position.
- The satellite image is older than the photos: it shows the trampoline and no shed. Photos: 3 Jul 2026 (summer,
  `IMG_28xx`), 16 Oct 2026 (`IMG_3846`), 31 Oct 2026 13:18 (`IMG_40xx`, low sun from SSW, autumn colours).

## Layout (north at the top)

```
Y=25 ─ street ────────────────────────────────────────────────── north fence (dark-green net)
       soil strip 1.4 m
Y=23.6 thuja hedge ××××××××××××××××××××××××××× [shed]
Y=22.6                                         ┌──── pad ─────┐
       w                                        │ old cobbles  │   e
       e   open lawn (≈15 × 14 m)               └────────┬─────┤   a
       s                                                 │path │   s
       t   (trampoline Ø3 at 15.2, 11.8)        (○)      │1.5 m│   t
                                                         │slab │
       f   planter boxes row  ▫ ▫ ▫ ▫ ▫   Y=9.7          │     │   f
       e   flower bed ~(9.5, 8.2)                        │     │   e
       n   small conifers line Y=7.4      ┌──────────────┴─────┤   n
       c                                  │ terrace (cobbles)  │   c
       e   orchard: 5 cherries + peach    │      ┌───────┬───┐ │   e
           picnic table (10.5, 3.0)       │swing │ house │anx│ │
Y=0  ─ south fence: grey welded panels ───┴──────┴─ brown wooden boards ──
      X=0                                12.95  14.8   17.1 18.7  20
```

## Ground

- **Lawn**: mown, slightly uneven yellowish green; worn/bare soil strip 0.5–1 m wide in front of the hedge and
  around the shed; grass is longer and weedy along the west and south fences.
- **Old cobbles** (pad, terrace): tumbled concrete setts in mixed sizes (≈9×9, 9×12, 12×12, 12×18 cm), laid in rows
  running east–west, colours from warm grey `#b3ad9d` through `#9a9484` to brownish `#7d7868`, dark joints
  `#4b473f`; edged by a thin black steel strip (`#26282b`). Slightly glossy/dark where wet.
- **New pavers** (path, the SW piece of the terrace): light-grey `#c9c9c7` rectangular blocks ≈20×10 cm, running
  bond along the path, joints `#9a9a98`; dark-grey concrete kerb `#55575a`, 8 cm wide, on both long sides.
  A 0.55 m strip of sand/soil separates the path from the east fence.

## Buildings

- **Cottage** (`SITE.house`): tiny garden house ≈3.9 × 3.4 m.
  - Main block: white plaster `#efede6`, plain north wall (no windows visible).
  - Annex on the east: brown wood/OSB `#6a4630`, a plain brown door in its north face (often standing open),
    slightly lower roof in dark grey felt.
  - Roof: asymmetric gable, ridge N–S above the west wall. Long shallow slope to the east; short steep slope to
    the west forming a porch canopy over the swing. Covering: burgundy-brown trapezoidal metal sheet `#6f2f38`,
    ribs running down the slope; red fascia `#a8322d` along the north and south verges; grey soffit.
  - West face (under the canopy): old vertical boards, grey-brown with faded patches of coloured paint; an OSB
    panel `#a9763f` on its northern third. South face: white on the west half, brown OSB on the east half.
  - Behind (south of) the house: a 1.4 m strip of bare ground/concrete, then the wooden fence.
- **Shed** (`SITE.shed`), new: 1.8 × 1.8 m, walls 2.2 m. Cladding = vertical wood-look slats, warm orange-brown
  `#a4662f`, 9 cm wide with 2.5 cm black gaps (module ≈11.7 cm). Door on the south face, right of centre:
  anthracite `#5d6063`, 0.75 × 1.95 m, pale wood frame. Roof: black bitumen shingles `#2b2b2d`, low hip/pyramid,
  14 cm overhang. Stands just north of the pad, its west side touching the east end of the hedge.

## Fences (boundary)

X = 0 lies 0.5 m west of the young thuja row. The west fence stands ≈1.7 m further west (X = −1.7): IMG_2873
shows a bare strip between the row and the fence, IMG_4017 was shot from that strip, and the satellite shows it
as a brown band. The north fence follows the street edge (Y ≈ 25.4), ≈1.8 m behind the hedge (IMG_4008).

- North: wire fence carrying a dark-green shade net `#2f3d33` (opaque-ish), ≈1.6 m, black steel posts every 2.5 m.
- East: old chain-link, rusty brown `#6b5a48`, ≈1.5 m, see-through; behind it the neighbour's overgrown shrubs
  2.5–3 m high form a green wall.
- South, X 0…13: modern welded-wire panels, anthracite `#4a4d50`, 1.5 m, posts every 2.5 m (see-through).
- South, X 13…20 (behind the house): solid brown vertical boards `#6b4a35`, 1.5 m.
- West: light galvanised wire mesh with dark-green posts every 2.5 m, ≈1.4 m (very see-through); the neighbour's
  vegetable garden with white stakes lies beyond.

## Plants on the plot today

- **North hedge**: 26 columnar thujas ('Smaragd') from the west fence to the shed, 2.5 m tall, 0.85 m wide, touching; yellowish green on the sunny
  side (`#7a9440`), dark green in shade (`#2f4a22`), dense from the ground up, softly pointed tips.
- **West row**: ~32 young thujas 0.6–0.9 m, 0.65 m apart. **South row**: 9 young thujas ≈0.6 m, 1.25 m apart.
- **Orchard** (SW quarter): five sour cherries and a peach, 4–4.6 m tall, trunks 15–20 cm (one leans), crowns
  2.5–3.5 m wide and touching; red cherries in early July; bare with a few orange leaves by late October.
- **Middle**: a 2.6 × 1.2 m bed with rose bushes (red, pink) and a yucca clump; a line of five small conifers;
  five wooden planter boxes with highbush blueberries ≈0.95 m tall (light green, blue-white berries in July).

## Furniture

- **Garden swing** west of the house: anthracite tube frame (Ø 4–5 cm) with curved skid bases, 2.1 m wide, 1.2 m deep,
  1.7 m tall; hanging bench of steel mesh 1.6 m wide (no cushions); slightly tilted mauve canopy `#8e6b86` with a
  fine white chevron pattern.
- **Picnic set**: table top 1.8 × 0.75 m of five dark red-brown planks `#5a2f25` at 0.75 m; two benches
  1.8 × 0.3 m at 0.45 m; legs = pale precast concrete trestles `#c9c7c0`.
- **Tripod grill**: black steel tripod 1.6 m tall, round grate Ø 0.5 m on chains, black fire bowl Ø 0.6 m below.
- **Concrete bin**: exposed-aggregate cylinder Ø 0.45 × 0.6 m `#a8a59c`, galvanised rim.
- **Trampoline**: Ø 3.0 m, black mat at 0.75 m, blue padded rim 0.3 m wide, galvanised W-legs, no net.
  Seasonal: out from May to September, gone in the late-October photos (`months: [5, 9]`).
- **Planter box**: 0.6 × 0.6 × 0.28 m, four horizontal red-brown slats per side `#7a3b2a`, corner posts, mulch on top.

## Surroundings

- North: pavement and a pale concrete/asphalt street ≈6 m wide; beyond it large trees 10–13 m and, on the far
  skyline to the NNW, a few white apartment blocks.
- East: shrub wall behind the fence; a house with a dark gable roof ≈8 m beyond the NE part.
- South-east: a white house with a red gable roof close to the SE corner; a wooden utility pole next to it.
- South: neighbour's dark-brown shed and a light-roofed gazebo 2–4 m behind the fence, big old trees further back.
- West: open vegetable gardens, a clipped hedge along the street, a small green-roofed hut ≈20 m away.
- Horizon all round: allotment trees, mixed green (summer) / yellow-orange (late October).

## Reference photos (`assets/photos/`, poses in `SITE.photos`)

| id | from → looking | shows |
|---|---|---|
| IMG_4010 | terrace by the house → NNW | cobbles, lawn, path, whole thuja hedge, shed, bin, skyline |
| IMG_4017 | NW corner → SE | hedge (close), lawn, cottage from the NW, west thuja row, planters |
| IMG_4013 | south edge → NNW | picnic table, tripod grill, lawn, hedge, shed |
| IMG_4015 | terrace → W | cobbles, bin, picnic table, orchard, planters, west neighbour |
| IMG_4011 | SW of the house → ENE | cottage west/south faces, roof, swing close-up, both paving kinds, south fences |
| IMG_4009 | path → S (portrait) | path pavers + kerbs, cottage north face, annex door, chain-link fence |
| IMG_4008 | NE corner → SW | shed close-up, pad cobbles + steel edging, hedge end, north fence net |
| IMG_4012 | south edge → NW (portrait) | panel fence, picnic set, orchard trees |
| IMG_3846 | lawn → NNE (tele) | shed door side, thujas, net fence |
| IMG_2863 / 2875 / 2876 / 2873 | summer views | picnic set + cherries in leaf; hammock; planter boxes + trampoline; blueberries |
