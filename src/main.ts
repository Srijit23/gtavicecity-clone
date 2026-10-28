import * as THREE from 'three';
import { InputManager } from './game/input/InputManager';
import { createWorld } from './game/world/createWorld';
import { FollowCamera } from './game/camera/FollowCamera';
import { PlayerController } from './game/player/PlayerController';
import { AmbienceAudio, EnvironmentController } from './game/environment/EnvironmentController';
import './style.css';

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required UI element #${id} was not found.`);
  return element as T;
};

const diagnosticsPanel = (() => {
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return undefined;
  const panel = document.createElement('pre');
  panel.id = 'performance-diagnostics';
  panel.style.cssText = 'position:fixed;left:14px;bottom:64px;z-index:20;max-width:min(420px,calc(100vw - 28px));margin:0;padding:12px 14px;background:rgba(8,12,22,.88);border:1px solid rgba(255,255,255,.22);border-radius:8px;color:#d9f6eb;font:11px/1.6 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none';
  panel.textContent = 'Performance diagnostics initializing…';
  document.body.append(panel);
  return panel;
})();

const loading = byId<HTMLDivElement>('loading');
const loadingMessage = byId<HTMLParagraphElement>('loading-message');
const startScreen = byId<HTMLElement>('start-screen');
const startButton = byId<HTMLButtonElement>('start-button');
const hud = byId<HTMLDivElement>('hud');
const errorScreen = byId<HTMLDivElement>('error-screen');
const errorMessage = byId<HTMLParagraphElement>('error-message');
const positionReadout = byId<HTMLSpanElement>('position-readout');
const unlockButton = byId<HTMLButtonElement>('unlock-button');
const gameRoot = byId<HTMLDivElement>('game-root');
const pauseScreen = byId<HTMLElement>('pause-screen');
const pauseButton = byId<HTMLButtonElement>('pause-button');
const resumeButton = byId<HTMLButtonElement>('resume-button');
const timeButton = byId<HTMLButtonElement>('time-button');
const audioButton = byId<HTMLButtonElement>('audio-button');
const helpButton = byId<HTMLButtonElement>('help-button');
const helpPanel = byId<HTMLElement>('help-panel');
const closeHelpButton = byId<HTMLButtonElement>('close-help-button');

let renderer: THREE.WebGLRenderer | undefined;
let input: InputManager | undefined;
let cameraRig: FollowCamera | undefined;
let playerController: PlayerController | undefined;
let environmentController: EnvironmentController | undefined;
const ambienceAudio = new AmbienceAudio();
let animationFrame = 0;
let started = false;
let paused = false;
let disposed = false;
let worldScene: THREE.Scene | undefined;
let lastHudUpdate = 0;
let lastDiagnosticsUpdate = 0;
let currentCityPrompt = '';
let maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
let activePixelRatio = maxPixelRatio;
let frameTimeEmaMs = 1000 / 60;
let slowFrameSeconds = 0;
let stableFrameSeconds = 0;
let pixelRatioCooldown = 0;

function applyPixelRatio(): void {
  if (!renderer) return;
  renderer.setPixelRatio(activePixelRatio);
  // Resize the drawing buffer without rewriting the canvas's CSS dimensions.
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function adaptPixelRatio(frameSeconds: number, frameMilliseconds: number): void {
  if (!renderer || document.hidden || frameSeconds > 0.25) return;
  frameTimeEmaMs += (frameMilliseconds - frameTimeEmaMs) * 0.08;
  pixelRatioCooldown = Math.max(0, pixelRatioCooldown - frameSeconds);
  if (frameTimeEmaMs > 22 && frameMilliseconds > 20) {
    slowFrameSeconds += frameSeconds;
    stableFrameSeconds = 0;
  } else if (frameTimeEmaMs < 15.5 && frameMilliseconds < 19) {
    stableFrameSeconds += frameSeconds;
    slowFrameSeconds = 0;
  } else {
    slowFrameSeconds = Math.max(0, slowFrameSeconds - frameSeconds * 0.5);
    stableFrameSeconds = 0;
  }

  if (pixelRatioCooldown > 0) return;
  if (slowFrameSeconds >= 2.2 && activePixelRatio > 0.86) {
    activePixelRatio = Math.max(0.85, Math.round((activePixelRatio - 0.1) * 100) / 100);
    applyPixelRatio();
    pixelRatioCooldown = 5;
    slowFrameSeconds = 0;
  } else if (stableFrameSeconds >= 10 && activePixelRatio < maxPixelRatio - 0.01) {
    activePixelRatio = Math.min(maxPixelRatio, Math.round((activePixelRatio + 0.05) * 100) / 100);
    applyPixelRatio();
    pixelRatioCooldown = 10;
    stableFrameSeconds = 0;
  }
}

function showError(error: unknown): void {
  console.error('[NEON COAST] Startup failed:', error);
  loading.classList.add('hidden');
  startScreen.classList.add('hidden');
  hud.classList.add('hidden');
  errorMessage.textContent = error instanceof Error ? error.message : 'The graphics renderer could not be initialized.';
  errorScreen.classList.remove('hidden');
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function initialize(): Promise<void> {
  disposed = false;
  loading.classList.remove('hidden');
  errorScreen.classList.add('hidden');
  loadingMessage.textContent = 'Checking graphics support…';
  if (!hasWebGL2()) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or try a supported desktop browser.');

  loadingMessage.textContent = 'Building the waterfront district…';
  worldScene = new THREE.Scene();
  const world = createWorld();
  worldScene.background = new THREE.Color('#e7aa96');
  worldScene.fog = world.root.userData.fog instanceof THREE.Fog ? world.root.userData.fog : null;
  worldScene.add(world.root);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  activePixelRatio = maxPixelRatio;
  renderer.setPixelRatio(activePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The sun direction and static city geometry do not change; moving actors use contact shadows.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.id = 'game-canvas';
  gameRoot.replaceChildren(renderer.domElement);

  playerController = new PlayerController(world.player, world.collisionBoxes);
  loadingMessage.textContent = 'Loading the rigged protagonist and animation clips…';
  await playerController.loadCharacter();

  environmentController = new EnvironmentController(worldScene, world.root, renderer);
  cameraRig = new FollowCamera(worldScene, world.player);
  input = new InputManager(renderer.domElement);
  const clock = new THREE.Clock();

  const onResize = (): void => {
    if (!renderer || !cameraRig) return;
    maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    activePixelRatio = Math.min(activePixelRatio, maxPixelRatio);
    applyPixelRatio();
    cameraRig.resize(window.innerWidth, window.innerHeight);
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    input?.releasePointerLock();
    showError(new Error('The WebGL context was lost. Reload the page to restore the game.'));
  };
  const onVisibility = (): void => { if (document.hidden) input?.clear(); };
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    input?.dispose();
    ambienceAudio.dispose();
    renderer?.dispose();
  }, { once: true });

  startButton.addEventListener('click', () => {
    started = true;
    paused = false;
    ambienceAudio.start();
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    input?.requestPointerLock();
  });
  unlockButton.addEventListener('click', () => input?.releasePointerLock());
  const updateTimeButton = (): void => { timeButton.textContent = 'TIME: ' + (environmentController?.currentMode ?? 'auto').toUpperCase(); };
  timeButton.addEventListener('click', () => { environmentController?.cycleMode(); updateTimeButton(); });
  audioButton.addEventListener('click', () => {
    ambienceAudio.setMuted(!ambienceAudio.isMuted);
    audioButton.textContent = ambienceAudio.isMuted ? 'SOUND: OFF' : 'SOUND: ON';
    if (!ambienceAudio.isMuted && started) ambienceAudio.start();
  });
  const openPauseMenu = (): void => {
    if (!started) return;
    paused = true;
    pauseScreen.classList.remove('hidden');
    helpPanel.classList.add('hidden');
    input?.releasePointerLock();
  };
  const closePauseMenu = (): void => { paused = false; pauseScreen.classList.add('hidden'); input?.requestPointerLock(); };
  pauseButton.addEventListener('click', openPauseMenu);
  resumeButton.addEventListener('click', closePauseMenu);
  helpButton.addEventListener('click', () => {
    paused = true;
    pauseScreen.classList.add('hidden');
    helpPanel.classList.remove('hidden');
    input?.releasePointerLock();
  });
  closeHelpButton.addEventListener('click', () => {
    helpPanel.classList.add('hidden');
    paused = false;
    input?.requestPointerLock();
  });
  byId<HTMLButtonElement>('menu-time-button').addEventListener('click', () => {
    environmentController?.cycleMode();
    updateTimeButton();
  });
  byId<HTMLButtonElement>('menu-audio-button').addEventListener('click', () => {
    ambienceAudio.setMuted(!ambienceAudio.isMuted);
    audioButton.textContent = ambienceAudio.isMuted ? 'SOUND: OFF' : 'SOUND: ON';
    if (!ambienceAudio.isMuted && started) ambienceAudio.start();
  });
  byId<HTMLButtonElement>('restart-button').addEventListener('click', () => window.location.reload());
  updateTimeButton();
  renderer.domElement.addEventListener('click', () => {
    if (started && document.pointerLockElement !== renderer?.domElement) input?.requestPointerLock();
  });
  byId<HTMLButtonElement>('retry-button').addEventListener('click', () => window.location.reload());

  const animate = (): void => {
    if (disposed || !renderer || !worldScene || !playerController || !cameraRig || !input) return;
    animationFrame = window.requestAnimationFrame(animate);
    const rawDelta = clock.getDelta();
    const frameMilliseconds = rawDelta * 1000;
    adaptPixelRatio(rawDelta, frameMilliseconds);
    const dt = Math.min(rawDelta, 0.05);
    const elapsed = clock.elapsedTime;
    const environmentFocus = world.player.position;
    world.update(dt, elapsed, environmentFocus);
    environmentController?.update(dt, environmentFocus);
    ambienceAudio.updateNight(environmentController?.nightAmount ?? 0.15);

    if (started && !paused && !document.hidden) {
      cameraRig.setTarget(world.player, false);
      cameraRig.update(dt, input.lookDeltaX, input.lookDeltaY, input.zoomDelta);
      input.consumeMouseDeltas();
      playerController.update(dt, input.keys, cameraRig.yaw);
      currentCityPrompt = world.interact(world.player.position, input.keys);
    } else {
      cameraRig.update(dt, 0, 0, 0);
    }

    cameraRig.follow(dt);
    renderer.render(worldScene, cameraRig.camera);
    if (diagnosticsPanel && elapsed - lastDiagnosticsUpdate > 0.25) {
      const position = world.player.position;
      const fps = frameTimeEmaMs > 0 ? 1000 / frameTimeEmaMs : 0;
      diagnosticsPanel.textContent = [
        'NEON COAST · DEBUG',
        `FPS (EMA): ${fps.toFixed(1)}`,
        `Frame time: ${frameTimeEmaMs.toFixed(1)} ms`,
        `Pixel ratio: ${activePixelRatio.toFixed(2)} / ${maxPixelRatio.toFixed(2)}`,
        `Draw calls: ${renderer.info.render.calls}`,
        `Triangles: ${renderer.info.render.triangles.toLocaleString()}`,
        `Geometries / textures: ${renderer.info.memory.geometries} / ${renderer.info.memory.textures}`,
        `World position: ${position.x.toFixed(0)}, ${position.z.toFixed(0)}`,
        `NPC systems: disabled`,
      ].join('\n');
      lastDiagnosticsUpdate = elapsed;
    }
    if (elapsed - lastHudUpdate > 0.15 && started && !paused) {
      const position = world.player.position;
      positionReadout.textContent = `X ${position.x.toFixed(1)} · Z ${position.z.toFixed(1)} · ${playerController.isUsingRiggedCharacter ? 'RIGGED' : 'FALLBACK'}`;
      const cityPrompt = document.getElementById('city-prompt');
      if (cityPrompt) {
        cityPrompt.textContent = currentCityPrompt;
        cityPrompt.classList.toggle('visible', Boolean(currentCityPrompt));
      }
      lastHudUpdate = elapsed;
    }
  };

  loading.classList.add('hidden');
  startScreen.classList.remove('hidden');
  clock.start();
  animate();
}

void initialize().catch(showError);

window.addEventListener('pagehide', () => {
  disposed = true;
  window.cancelAnimationFrame(animationFrame);
  input?.dispose();
  ambienceAudio.dispose();
  renderer?.dispose();
});
