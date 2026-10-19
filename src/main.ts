import * as THREE from 'three';
import { InputManager } from './game/input/InputManager';
import { createWorld } from './game/world/createWorld';
import { FollowCamera } from './game/camera/FollowCamera';
import { PlayerController } from './game/player/PlayerController';
import { VehicleController } from './game/vehicle/VehicleController';
import { PopulationController } from './game/population/PopulationController';
import { AmbienceAudio, EnvironmentController } from './game/environment/EnvironmentController';
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
let vehicleController: VehicleController | undefined;
let populationController: PopulationController | undefined;
let environmentController: EnvironmentController | undefined;
const ambienceAudio = new AmbienceAudio();
let animationFrame = 0;
let started = false;
let paused = false;
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
  populationController = new PopulationController(world.root, world.player, vehicleController.object, world.collisionBoxes);
  environmentController = new EnvironmentController(worldScene, world.root, renderer);
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
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    world.update(dt, elapsed);
    environmentController?.update(dt);
    ambienceAudio.updateNight(environmentController?.nightAmount ?? 0.15);

    if (started && !paused && !document.hidden) {
      vehicleController?.update(dt, input.keys);
      populationController?.update(dt, Boolean(vehicleController?.isDriving));
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
    if (elapsed - lastHudUpdate > 0.15 && started && !paused) {
      const position = world.player.position;
      positionReadout.textContent = vehicleController?.isDriving
        ? `DRIVING · ${vehicleController.speedKmh} KM/H · ${populationController?.pedestrianCount ?? 0} PEDS · ${populationController?.trafficCount ?? 0} CARS`
        : `X ${position.x.toFixed(1)} · Z ${position.z.toFixed(1)} · ${playerController.isUsingRiggedCharacter ? 'RIGGED' : 'FALLBACK'} · ${populationController?.pedestrianCount ?? 0} PEDS · ${populationController?.trafficCount ?? 0} CARS`;
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
  ambienceAudio.dispose();
  renderer?.dispose();
});
