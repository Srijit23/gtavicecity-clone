# Known limitations after the World Expansion and Performance Pass

## Assets and visuals

- The rigged Soldier character and its idle/walk/run animation clips load at runtime from the Three.js example asset host. Gameplay still requires network access to that character URL; a procedural fallback is available if loading fails. The Kenney sedan GLB is bundled locally under `public/models` and does not depend on an external car-model CDN.
- The new housing zones use a reusable low-poly gable roof and instanced shells, window frames/panes, doors, porches, foundations, lawns, driveways and shrubs. Apartment blocks, stores, school, sports court, playground, park/pool and warehouse are stylized procedural constructions. They are not a full library of individually authored architectural GLB models, and some major building forms still use simple box volumes.
- The ground uses one deterministic small repeating canvas texture; it adds subtle surface variation but is not a high-resolution physically based terrain material. Terrain height remains essentially flat, with no hills, sloped landscape or detailed terrain mesh.
- The sky is a shader gradient with one instanced cluster layer of low-poly clouds. Clouds are not volumetric, have no true cloud-shadow system and do not use an expensive atmospheric scattering model. The sun/moon are simple stylized discs.
- The car is driven by a custom arcade controller rather than a complete rigid-body simulation. There is no detailed tire friction model, drivetrain simulation, deformable body, vehicle damage or dynamic terrain. Suspension is a visual spring approximation intended for flat roads.

## World and collision architecture

- The dry-land footprint is 850 × 850 world units, approximately 9.9× the previous 270 × 270 ground plane. The map now includes connected outer roads, residential neighborhoods, apartment blocks, storefronts, a school/sports court, a recreation park/playground/pool and an industrial warehouse area.
- Expansion geometry is generated during startup. District and near-detail groups use coarse distance-based visibility, but the project does **not** yet have true incremental asynchronous chunk loading/unloading, a four-tier LOD 0–3 asset pipeline, cross-fading, asset-stream prioritization or a separate occlusion-culling system. Do not describe the current setup as full world streaming.
- Collision is intentionally simplified. Main static structures and many props use AABB-style bounds; the expanded houses use coarse bounding boxes rather than exact per-triangle collision. Newly introduced districts require in-browser checks for blocked road junctions, building bounds, parking/driveway accessibility and hidden collisions after distance culling.
- Follow-camera obstruction still has no dedicated spatial tree: it caches obstacle world spheres and filters likely ray-segment candidates before raycasting, but scans the obstacle list to do that filter. On-foot and vehicle static collisions now use 32-unit XZ grid broad phases; newly appended moving-vehicle bounds are checked directly.
- Distance-based visual culling does not remove collision data. This keeps the collision layout stable, but the collider list may contain far-away bounds that still contribute CPU work.

## Performance and population

- The renderer starts with a device-capped pixel ratio of at most 1.5 and can reduce it in small steps after sustained slow frames, with a longer cooldown for quality recovery. The `?debug=1` overlay reports an FPS/frame-time estimate, renderer draw calls/triangles, geometry/texture counts, pixel ratio and world position. This is a heuristic, not a hardware certification or a guarantee of stable FPS.
- Geometry/material sharing and instancing reduce repeated object and draw-call overhead, but actual CPU/GPU frame times, memory growth and garbage-collection behaviour have not been profiled on a range of low-end PCs.
- NPCs, pedestrians, civilian traffic and their AI are temporarily disabled in the runtime for this development phase: `src/main.ts` no longer imports, creates or updates `PopulationController`, and NPC count counters were removed from the HUD. `src/game/population/PopulationController.ts` remains as dormant source for possible future reintroduction, but is not active and cannot spawn entities through the current runtime.
- The current main character is still loaded externally. Audio ambience is synthesized locally using Web Audio; it is not recorded environmental audio, and there are no dedicated engine, tire, footstep, NPC voice or collision sound effects.

## Verification still required

- GitHub Actions builds the pull-request branch, but a passing TypeScript/Vite build does not prove that the expanded world looks correct or drives well in Chrome.
- Manual visual and gameplay checks remain pending for vehicle stance/wheel motion, player and car traversal over the expanded map, every road junction and collision boundary, camera obstruction, all district layouts, sun/moon/cloud appearance, UI and day/night interactions.
- Low-end performance targets must be measured rather than assumed. Test standing still, rapid camera rotation, driving at top speed, moving across district boundaries, the densest views and extended exploration. No FPS target or “zero lag” claim should be treated as verified until frame-time data has been collected on the intended hardware.
