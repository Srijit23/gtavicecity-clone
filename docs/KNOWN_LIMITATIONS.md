# Known limitations after Milestone A

- The player is an explicitly temporary procedural silhouette, not a rigged production character.
- Movement is a lightweight prototype controller. There is no Rapier physics, grounded jump system, slope handling, or building collision resolution yet.
- Camera obstruction raycasts currently inspect marked scene objects without a spatial index; this is acceptable for the small foundation scene but must be improved as the world grows.
- The city is a small procedural test district. Buildings are not enterable and do not yet have complete collision geometry.
- There are no drivable vehicles, NPCs, traffic, missions, map routing, save system, or police/wanted system.
- The visual assets are generated from Three.js primitives; there are no external character, vehicle, texture, or audio assets in this milestone.
- Google Fonts are an optional external visual enhancement; system fallbacks are provided.
- The build workflow has not yet been run in this environment, and Chrome/manual gameplay verification remains pending until a browser-capable test environment is available.
