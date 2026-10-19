import * as THREE from 'three';
import { InputManager } from './game/input/InputManager';
import { createWorld } from './game/world/createWorld';
import { FollowCamera } from './game/camera/FollowCamera';
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
const vehicleReadout = byId<HTMLSpanElement>('vehicle-readout');
const unlockButton = byId<HTMLButtonElement>('unlock-button');
const gameRoot = byId<HTMLDivElement>('game-root');

let renderer: THREE.WebGLRenderer | undefined;
let input: InputManager | undefined;
let cameraRig: FollowCamera | undefined;
let animationFrame = 0;
let started = false;
let disposed = false;
let player: THREE.Group | undefined;
let worldScene: THREE.Scene | undefined;
let vehicle: VehicleController | undefined;
let driving = false;
let lastHudUpdate = 0;
let enterKeyWasDown = false;

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

function initialize(): void {
  disposed = false;
  loading.classList.remove('hidden');
  errorScreen.classList.add('hidden');
  loadingMessage.textContent = 'Checking graphics support…';
  if (!hasWebGL2()) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or try a supported desktop browser.');

  loadingMessage.textContent = 'Building the waterfront district…';
  worldScene = new THREE.Scene();
  const world = createWorld();
  worldScene.add(world.root);
  player = world.player;
  vehicle = new VehicleController(world.root, new THREE.Vector3(-5, 0, 1));

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'game-canvas';
  gameRoot.replaceChildren(renderer.domElement);

  cameraRig = new FollowCamera(worldScene, player);
  input = new InputManager(renderer.domElement);
  const clock = new THREE.Clock();
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();

  const onResize = (): void => {
    if (!renderer || !cameraRig) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    if (disposed || !renderer || !worldScene || !player || !cameraRig || !input || !vehicle) return;
    animationFrame = window.requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    world.update(dt, elapsed);

    if (started && !document.hidden) {
      cameraRig.update(dt, input.lookDeltaX, input.lookDeltaY, input.zoomDelta);
      input.consumeMouseDeltas();
      const keys = input.keys;
      const enterKeyDown = keys.has('KeyE');
      if (enterKeyDown && !enterKeyWasDown) {
        if (!driving && player.position.distanceTo(vehicle.root.position) < 4.5) {
          driving = true;
          player.visible = false;
          cameraRig.setTarget(vehicle.root, true);
        } else if (driving) {
          driving = false;
          const side = new THREE.Vector3(1.7, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.root.rotation.y);
          player.position.copy(vehicle.root.position).add(side);
          player.position.y = 0.1;
          player.rotation.y = vehicle.root.rotation.y;
          player.visible = true;
          vehicle.resetSpeed();
          cameraRig.setTarget(player, false);
        }
      }
      enterKeyWasDown = enterKeyDown;

      if (driving) {
        vehicle.update(dt, {
          forward: keys.has('KeyW'),
          reverse: keys.has('KeyS'),
          left: keys.has('KeyA'),
          right: keys.has('KeyD'),
          brake: keys.has('Space'),
        });
      } else {
        forward.set(-Math.sin(cameraRig.yaw), 0, -Math.cos(cameraRig.yaw));
        right.set(Math.cos(cameraRig.yaw), 0, -Math.sin(cameraRig.yaw));
        move.set(0, 0, 0);
        if (keys.has('KeyW')) move.add(forward);
        if (keys.has('KeyS')) move.sub(forward);
        if (keys.has('KeyD')) move.add(right);
        if (keys.has('KeyA')) move.sub(right);
        if (move.lengthSq() > 0) {
          move.normalize();
          const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 10 : 5.5;
          targetPosition.copy(player.position).addScaledVector(move, speed * dt);
          targetPosition.x = THREE.MathUtils.clamp(targetPosition.x, -105, 105);
          targetPosition.z = THREE.MathUtils.clamp(targetPosition.z, -105, 105);
          player.position.copy(targetPosition);
          player.rotation.y = Math.atan2(move.x, move.z);
        }
      }
    } else {
      cameraRig.update(dt, 0, 0, 0);
    }

    cameraRig.follow(dt);
    renderer.render(worldScene, cameraRig.camera);
    if (elapsed - lastHudUpdate > 0.12 && started) {
      positionReadout.textContent = driving
        ? `SPEED ${Math.round(Math.abs(vehicle.speed) * 3.6)} KM/H`
        : `X ${player.position.x.toFixed(1)} · Z ${player.position.z.toFixed(1)}`;
      vehicleReadout.textContent = driving ? 'DRIVING · E EXIT' : 'E ENTER CAR';
      vehicleReadout.classList.toggle('active', driving);
      lastHudUpdate = elapsed;
    }
  };

  loadingMessage.textContent = 'Renderer ready. Finalizing controls…';
  clock.start();
  loading.classList.add('hidden');
  startScreen.classList.remove('hidden');
  animate();
}

try {
  initialize();
} catch (error) {
  showError(error);
}

window.addEventListener('pagehide', () => {
  disposed = true;
  window.cancelAnimationFrame(animationFrame);
  input?.dispose();
  renderer?.dispose();
});
