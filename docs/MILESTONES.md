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

## Milestone D and beyond
- [ ] Playable district collision and expanded world geometry
- [ ] NPCs and civilian traffic
- [ ] Missions, navigation, shops, progression, and saving
- [ ] Audio, day/night cycle, settings, optimization, and release validation

Checkboxes are updated only when the corresponding work is present in the repository; browser/hardware checks remain pending until run in a suitable environment.
