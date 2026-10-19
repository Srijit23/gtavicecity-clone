# Known limitations after Milestone B

- The rigged Soldier model and its animation clips load at runtime from the Three.js example asset host; gameplay requires network access to that asset URL. A procedural fallback character remains available if the download fails or times out.
- The model source provides idle, walk, and run clips. The controller corrects the model's forward-axis mismatch, normalizes imported height, aligns the lowest mesh point to the ground plane, adjusts gait playback rate, and adds a soft procedural contact shadow. If no dedicated jump clip is present, it synthesizes a simple jump pose from rig bones; this is less polished than a purpose-authored jump/fall/land set.
- Player physics use a lightweight custom controller with gravity, jump impulse, horizontal acceleration, axis-separated AABB/circle collision, and fixed ground height. It is not a full rigid-body engine; slopes, stairs, moving platforms, and variable terrain are not supported.
- Building and roof-trim boxes provide static collision. Fine-detail geometry, palm trees, street furniture, and the ocean are not all solid obstacles yet.
- Camera obstruction uses raycasts against marked scene objects without a spatial index; this is suitable for the small test district but should be optimized as the world grows.
- The city remains a small procedural test district. Buildings are not enterable and there are no drivable vehicles, NPCs, civilian traffic, missions, map routing, save system, or police/wanted system.
- Manual Chrome gameplay verification and target-hardware performance testing remain pending.
