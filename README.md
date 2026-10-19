# NEON COAST

A browser-based 3D open-world game foundation inspired by classic coastal-city action games. This repository is currently focused on Milestone A: a reliable Vite + TypeScript + Three.js rendering foundation, responsive input, a small explorable prototype scene, loading/error states, and a reproducible production build.

## Requirements
- Node.js 20 or newer
- npm
- A desktop browser with WebGL 2 support (Chrome recommended)

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

## Controls (Milestone A)
- W/A/S/D: move around the prototype scene
- Mouse: orbit the camera while pointer lock is active
- Mouse wheel: zoom
- Escape: release pointer lock
- Click **Enter the city** to start and capture the mouse

## Milestone A scope
- Vite, TypeScript, and Three.js setup
- WebGL capability checks and a visible loading/error state
- A responsive, stylized coastal-city test scene
- Centralized keyboard and pointer input with focus-loss cleanup
- Frame-time clamping and device-pixel-ratio limits
- Production build workflow and CI smoke build

This milestone intentionally does not claim to include the final rigged player, character animation, vehicle physics, NPC AI, or a full city. Those belong to later milestones. See `docs/MILESTONES.md` and `docs/KNOWN_LIMITATIONS.md`.
