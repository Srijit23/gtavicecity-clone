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
- [x] Build a detailed procedural coupe with body panels, glazing, interior, lighting, chrome, and four wheel/rim assemblies
- [x] Add fixed-step signed-speed vehicle dynamics, acceleration, braking, reverse, steering, drag, and collision response
- [x] Add per-wheel suspension probes, wheel rotation/steering, and body pitch/roll under acceleration and cornering
- [x] Integrate E-to-enter/exit state transitions, player motion reset, on-foot vehicle collision, and a driving follow-camera
- [x] Add speed readout and contextual vehicle-control hints
- [ ] Verify entry, driving, braking, reversing, exit, and walking transitions in a real browser

## Milestone D: Playable City
- [x] Expand the central district with connected boulevard, cross streets, lane markings, crosswalks, curbs, sidewalks, promenade, beach and ocean edge
- [x] Add coherent pastel art-deco blocks, stepped rooflines, facade trim, instanced windows, rooftop equipment, palm-lined streets, benches, bins, lamps, waterfront rails and a neon landmark
- [x] Build the Coastline Diner as a walk-in interior with an open doorway, separate collidable walls, floor tiles, counter, stools, booths, menu board, neon signage and warm interior lighting
- [x] Add an F interaction near the counter to order coffee and change the diner neon state
- [x] Add scene fog and instance repeated foliage/window geometry to control visual depth and draw calls
- [ ] Verify the district is explorable, all collision boundaries and diner entry/interactions work, and measure FPS on target hardware

## Milestone E: World Population
- [x] Add a fixed-size pool of 18 procedural pedestrians with simple walking limb animation
- [x] Route pedestrians through a connected sidewalk/crosswalk waypoint graph using breadth-first pathfinding
- [x] Add local pedestrian separation and obstacle checks with re-routing when a waypoint is blocked
- [x] Add 8 pooled civilian vehicles on the boulevard with lane-following, spacing, and player/crosswalk yielding
- [x] Throttle simulation to 20 updates per second and use active/visible distance bands around the player
- [x] Reuse shared geometry/materials and keep population counts fixed to avoid uncontrolled entity growth
- [ ] Verify NPC movement, traffic yielding, visual pop-in, and performance in a real browser

## Milestone F and beyond
- [ ] Missions, navigation, shops, progression, and saving
- [ ] Audio, day/night cycle, settings, optimization, and release validation

Checkboxes are updated only when the corresponding work is present in the repository; browser/hardware checks remain pending until run in a suitable environment.
