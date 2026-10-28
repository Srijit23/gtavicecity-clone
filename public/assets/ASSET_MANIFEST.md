# Asset manifest

| Asset | Source | License / redistribution status | Intended use | Status |
|---|---|---|---|---|
| Procedural buildings, roads, water, palms, and street details | `src/game/world/createWorld.ts` | Project source code; no third-party asset | Foundation environment | Included |
| Rigged humanoid Soldier model and animation clips | [Three.js GLTF example asset](https://threejs.org/examples/models/gltf/Soldier.glb) | Hosted by the Three.js examples site; confirm upstream model/Mixamo terms before bundling or redistributing the file | Player character, idle/walk/run; jump pose synthesized if no jump clip exists | Runtime-loaded |
| Procedural fallback player | `src/game/player/PlayerController.ts` | Project source code; no third-party asset | Fallback if remote model fails to load | Included |
| Vehicle models and audio | Not acquired | To be verified before use | Milestone C+ | Not included |

The rigged model is fetched from the Three.js example host at runtime rather than copied into this repository. For a production release, verify the source asset's redistribution terms and preferably bundle a permitted copy locally to avoid a runtime dependency on a third-party host.
