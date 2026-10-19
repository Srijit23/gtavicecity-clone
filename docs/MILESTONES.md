# Development milestones

## Milestone A: Foundation
- [x] Vite + TypeScript + Three.js application shell
- [x] WebGL 2 capability check and startup error UI
- [x] Loading screen and start screen
- [x] Stylized coastal boulevard, water, buildings, palm silhouettes, lighting, and street details
- [x] Basic WASD movement, sprint modifier, pointer-lock mouse look, and camera zoom
- [x] Input cleanup on blur and hidden-tab changes
- [x] Production build script and CI build workflow
- [ ] Verify on a real Chrome browser and measure FPS on target hardware

## Milestone B: Player
- [x] Integrate a rigged humanoid GLB with idle, walk, and run clips (loaded from the Three.js example asset host)
- [x] Add grounded movement, acceleration/deceleration, gravity, jumping, and axis-separated building collision
- [x] Blend idle/walk/run states and use a generated rig-bone jump pose when the source model has no jump clip
- [x] Smooth third-person character turning and camera follow with obstacle raycasts
- [ ] Bundle a verified redistributable character asset locally and document its final license
- [ ] Upgrade collision broad-phase/spatial acceleration and verify gameplay in a real browser

## Milestone C: Vehicle
- [x] Build a detailed procedural coupe as an emergency fallback with body panels, glazing, interior, lighting, chrome, and four wheel/rim assemblies
- [x] Add fixed-step signed-speed vehicle dynamics, acceleration, braking, reverse, steering, drag, and collision response
- [x] Add lightweight wheel animation and body pitch/roll under acceleration and cornering
- [x] Integrate E-to-enter/exit state transitions, player motion reset, on-foot vehicle collision, and a driving follow-camera
- [x] Add a digital speedometer with gear direction, speed bar, and contextual vehicle-control hints
- [x] Tune acceleration, braking, reverse, speed-dependent steering sensitivity, handbrake behavior, and collision response
- [x] Bundle the 185 KB Kenney Car Kit sedan GLB locally under `public/models` (CC0) to remove runtime car-CDN/DNS failures
- [x] Fit the model to the existing vehicle footprint, align the visual forward axis with controller -Z, animate all four named wheel nodes, and steer the front pair with A/D
- [x] Keep the driving camera aligned behind the car heading with smoothed follow and mouse orbit
- [ ] Verify entry, driving, braking, reversing, exit, and walking transitions in a real browser

## Milestone D: Playable City
- [x] Expand the central district with connected boulevard, cross streets, lane markings, crosswalks, curbs, sidewalks, promenade, beach and ocean edge
- [x] Add coherent pastel art-deco blocks, stepped rooflines, facade trim, instanced windows, rooftop equipment, palm-lined streets, benches, bins, lamps, waterfront rails and a neon landmark
- [x] Build the Coastline Diner as a walk-in interior with an open doorway, separate collidable walls, floor tiles, counter, stools, booths, menu board, neon signage and warm interior lighting
- [x] Add an F interaction near the counter to order coffee and change the diner neon state
- [x] Add scene fog and instance repeated foliage/window geometry to control visual depth and draw calls
- [ ] Verify the district is explorable, all collision boundaries and diner entry/interactions work, and measure FPS on target hardware

## Milestone E: World Population (temporarily disabled at runtime)
- [x] Add a fixed-size pool of 18 procedural pedestrians with simple walking limb animation
- [x] Route pedestrians through a connected sidewalk/crosswalk waypoint graph using breadth-first pathfinding
- [x] Add local pedestrian separation and obstacle checks with re-routing when a waypoint is blocked
- [x] Add 8 pooled civilian vehicles on the boulevard with lane-following, spacing, and player/crosswalk yielding
- [x] Throttle simulation to 20 updates per second and use active/visible distance bands around the player
- [x] Reuse shared geometry/materials and keep population counts fixed to avoid uncontrolled entity growth
- [x] Disconnect population runtime import, construction and update loop; remove PEDS/CARS HUD counts while retaining the module for a future phase
- [ ] Re-enable and verify NPC movement/traffic only when explicitly requested in a future phase

## Milestone F: Presentation
- [x] Add an automatic day/night cycle plus manual day, sunset, and night presets
- [x] Blend sky dome, scene background, fog, sun color/intensity, hemisphere fill, and tone-mapping exposure
- [x] Add a small set of distance-limited promenade light pools that brighten after dark
- [x] Synthesize coastal surf/hum ambience and night ambience locally with Web Audio, with a working mute toggle
- [x] Add connected HUD controls for time-of-day, sound, help, pause, resume, mouse unlock, and restart
- [x] Add a pause menu and quick-controls panel; pause player/population simulation while menus are open
- [ ] Verify visual/audio balance, all UI interactions, and performance in a real browser

## World Expansion and Performance Pass

- [x] Expand the base land footprint to 850 × 850 units (about 9.9× the previous 270 × 270 ground plane) and extend the coastal boulevard, promenade, beach and sky visibility.
- [x] Connect an outer road grid and add deterministically placed residential zones with shared gabled-roof geometry, instanced house shells, windows, porches, foundations, gardens and driveways.
- [x] Add simplified apartment blocks, commercial storefronts, a school/sports court, park, playground, pool and warehouse yard.
- [x] Instance repeated lane marks, promenade rail posts, house components, foliage and cloud puffs; cache repeated standard materials and share box geometry.
- [x] Add coarse distance-based visibility groups for central and outer districts and separate near-detail groups; retain collision bounds when visuals are culled.
- [x] Replace the flat sky color with a shader gradient, one instanced drifting cloud layer and sun/moon discs synchronized with the day/night cycle.
- [x] Add adaptive device pixel ratio scaling with hysteresis and an opt-in diagnostics overlay at `?debug=1`.
- [x] Extend on-foot, vehicle and camera ranges to cover the larger map and reduce temporary vector allocations in the movement/collision hot loops.
- [ ] Implement truly incremental asynchronous chunk streaming and a multi-level (LOD 0–3) model pipeline; current expansion is created at startup and uses coarse distance visibility.
- [ ] Add a dedicated spatial broad phase/occlusion system; collision lists and follow-camera raycasts are still simple and should be profiled.
- [ ] Verify road continuity, all building collisions, camera obstruction, sky appearance, sustained frame times and memory behaviour in real Chrome sessions on low-end hardware.

## Milestone G and beyond
- [ ] Missions, navigation, shops, progression, and saving
- [ ] Settings persistence, audio mix options, accessibility, optimization, and release validation

Checkboxes are updated only when the corresponding work is present in the repository; browser/hardware checks remain pending until run in a suitable environment.
