# NEON COAST

A browser-based 3D open-world coastal-city prototype built with Vite, TypeScript, and Three.js. It includes a rigged player, arcade-style driving, a lightweight low-poly red saloon with vehicle animation, a compact procedural city, pedestrians and civilian traffic, a walk-in diner, day/night lighting, and synthesized coastal ambience.

## Requirements
- Node.js 20 or newer
- npm
- A desktop browser with WebGL 2 support (Chrome recommended)
- Internet access for the detailed external car model; the procedural car remains as a fallback if the model cannot load

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
- WASD: walk / accelerate / steer
- Shift: sprint on foot
- Space: jump on foot / handbrake while driving
- E: enter or exit the coupe
- F: interact with the Coastline Diner
- Mouse: look and orbit the driving camera; wheel: zoom; Esc: release pointer lock
- HUD: change time of day, mute ambience, open help, pause/resume, unlock mouse, and restart

## Current scope
- Rigged humanoid with idle/walk/run animation handling, grounded movement, jumping, and collision
- Custom arcade driving controller with acceleration, braking/reverse, speed-sensitive steering, vehicle camera, and km/h speedometer
- Low-poly red saloon GLB (CC0) normalized in native Y-up coordinates; driving physics and speedometer stay controller-owned, with model-authored rolling animation when available
- Compact art-deco waterfront district, promenade, beach, and enterable diner
- Pooled pedestrians and civilian boulevard traffic
- Automatic day/night lighting and manual day/sunset/night presets, plus synthesized coastal ambience

This remains a prototype, not a full GTA-scale game or a full rigid-body vehicle simulation. See `docs/MILESTONES.md`, `docs/KNOWN_LIMITATIONS.md`, and `docs/ASSET_CREDITS.md`.
