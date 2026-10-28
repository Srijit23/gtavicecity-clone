# NEON COAST

A browser-based, GTA Vice City-inspired coastal-city prototype built with Vite, TypeScript, and Three.js. This branch contains an active world-expansion and performance pass for the existing game; it does not replace the game with a separate demo.

## Requirements

- Node.js 20 or newer
- npm
- A desktop browser with WebGL 2 support (Chrome recommended)
- Internet access for the rigged character model, which currently loads from the Three.js example asset host. Vehicle driving and car assets have been removed from this build.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Controls

- WASD: walk and explore
- Shift: sprint on foot
- Space: jump
- F: interact with the Coastline Diner
- Mouse: look around; wheel: zoom; Esc: release pointer lock
- HUD: change time of day, mute ambience, open help, pause/resume, unlock mouse, and restart

## Current implementation

- **Expanded map:** an 850 × 850 ground footprint, approximately 9.9× the previous 270 × 270 ground plane, with a longer coastal boulevard and a connected outer collector-road grid.
- **Residential architecture:** deterministic low-poly homes with gabled roofs, porches, windows, foundations, driveways and garden shrubs, plus distance-grouped residential areas.
- **Additional districts:** apartment blocks with balcony details, commercial storefronts, a school and sports court, a park with trees/playground/swimming pool, and a warehouse.
- **Rendering efficiency:** shared box geometry, cached standard materials, instanced repeating road marks, railing posts, windows, foliage, clouds, and house components; coarse distance-based district/detail visibility; local spatial grids for player collision checks; and cached world-space camera-obstacle spheres to reduce raycast candidates.
- **Shadow cost control:** cache the static city's directional shadow map instead of updating it every frame. The moving player uses a contact-shadow plane rather than dynamic shadow-map casting.
- **Adaptive rendering:** a device-capped pixel ratio up to 1.5 that reduces in steps after sustained slow frames and recovers more cautiously after sustained stable frames.
- **Debug metrics:** append `?debug=1` to the game URL to display FPS/frame-time estimates, renderer draw calls and triangles, geometry/texture counts, pixel ratio and world position.
- **Sky and lighting:** a shader-based sky gradient, one instanced low-poly cloud layer with slow movement, sun/moon discs that follow the active player/camera area, day/night lighting, fog and the existing ambience system.
- **NPC-free phase:** the population controller is not imported, instantiated or updated by the game runtime. Pedestrians, NPC AI and civilian traffic are temporarily disabled; the module source remains available for later reintroduction.

## Known scope limits

The expansion is generated during startup and uses grouped distance visibility; it is **not** yet a full asynchronous chunk-streaming system with a four-tier building LOD pipeline. Occlusion culling is not implemented as a separate visibility system, and the camera obstruction raycast has no spatial index. New building collision uses simplified bounds, the school/park/apartments are simplified low-poly constructions rather than a library of unique authored GLB buildings, and no low-end hardware FPS target should be considered measured until profiled on that hardware.

The car uses an arcade controller, not a complete rigid-body/tire simulation. Browser gameplay and visual validation of the expanded roads, collisions, camera, day/night cycle and performance remain necessary before merging. See `docs/MILESTONES.md`, `docs/KNOWN_LIMITATIONS.md` and `docs/ASSET_CREDITS.md`.
