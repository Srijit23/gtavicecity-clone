import * as THREE from 'three';
import { InputManager } from './game/input/InputManager';
import { createWorld } from './game/world/createWorld';
import { FollowCamera } from './game/camera/FollowCamera';
import { PlayerController } from './game/player/PlayerController';
import { VehicleController } from './game/vehicle/VehicleController';
import './style.css';

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required UI element #${id} was not found.`);
  return element as T;
};

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

let renderer: THREE.WebGLRenderer | undefined;
let input: InputManager | undefined;
let cameraRig: FollowCamera | undefined;
let playerController: PlayerController | undefined;
let vehicleController: VehicleController | undefined;
let animationFrame = 0;
let started = false;
let disposed = false;
let worldScene: THREE.Scene | undefined;
let lastHudUpdate = 0;
let currentCityPrompt = '';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'game-canvas';
  gameRoot.replaceChildren(renderer.domElement);

  playerController = new PlayerController(world.player, world.collisionBoxes);
  loadingMessage.textContent = 'Loading the rigged protagonist and animation clips…';
  await playerController.loadCharacter();

  vehicleController = new VehicleController(world.root, playerController, world.collisionBoxes);
  cameraRig = new FollowCamera(worldScene, world.player);
  input = new InputManager(renderer.domElement);
  const clock = new THREE.Clock();

  const onResize = (): void => {
    if (!renderer || !cameraRig) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    renderer?.dispose();
  }, { once: true });

  startButton.addEventListener('click', () => {
    started = true;
    startScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    input?.requestPointerLock();
  });
  unlockButton.addEventListener('click', () => input?.releasePointerLock());
  renderer.domElement.addEventListener('click', () => {
    if (started && document.pointerLockElement !== renderer?.domElement) input?.requestPointerLock();
  });
  byId<HTMLButtonElement>('retry-button').addEventListener('click', () => window.location.reload());

  const animate = (): void => {
    if (disposed || !renderer || !worldScene || !playerController || !cameraRig || !input) return;
    animationFrame = window.requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    world.update(dt, elapsed);

    if (started && !document.hidden) {
      vehicleController?.update(dt, input.keys);
      cameraRig.setTarget(vehicleController?.isDriving ? vehicleController.object : world.player, Boolean(vehicleController?.isDriving));
      cameraRig.update(dt, input.lookDeltaX, input.lookDeltaY, input.zoomDelta);
      input.consumeMouseDeltas();
      if (!vehicleController?.isDriving) playerController.update(dt, input.keys, cameraRig.yaw);
      currentCityPrompt = vehicleController?.isDriving ? '' : world.interact(world.player.position, input.keys);
    } else {
      cameraRig.update(dt, 0, 0, 0);
    }

    cameraRig.follow(dt);
    renderer.render(worldScene, cameraRig.camera);
    if (elapsed - lastHudUpdate > 0.15 && started) {
      const position = world.player.position;
      positionReadout.textContent = vehicleController?.isDriving
        ? `DRIVING · ${vehicleController.speedKmh} KM/H`
        : `X ${position.x.toFixed(1)} · Z ${position.z.toFixed(1)} · ${playerController.isUsingRiggedCharacter ? 'RIGGED' : 'FALLBACK'}`;
      const vehiclePrompt = document.getElementById('vehicle-prompt');
      const cityPrompt = document.getElementById('city-prompt');
      if (cityPrompt) {
        cityPrompt.textContent = currentCityPrompt;
        cityPrompt.classList.toggle('visible', Boolean(currentCityPrompt));
      }
      if (vehiclePrompt) {
        vehiclePrompt.textContent = vehicleController?.isDriving
          ? 'W ACCELERATE · S BRAKE / REVERSE · A / D STEER · SPACE HANDBRAKE · E EXIT'
          : vehicleController?.nearVehicle ? 'PRESS E TO ENTER THE COUPE' : '';
        vehiclePrompt.classList.toggle('visible', Boolean(vehicleController?.isDriving || vehicleController?.nearVehicle));
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
  renderer?.dispose();
});
