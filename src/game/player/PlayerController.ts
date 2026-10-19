import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CHARACTER_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';
const PLAYER_RADIUS = 0.38;
const PLAYER_HEIGHT = 1.82;
const PLAYER_COLLISION_CELL_SIZE = 32;
const CHARACTER_TARGET_HEIGHT = 1.78;
const MODEL_FORWARD_CORRECTION = Math.PI;
const WALK_SPEED = 4.2;
const RUN_SPEED = 8.8;
const GROUND_Y = 0.12;

type PlayerState = 'idle' | 'walk' | 'run' | 'jump';

export class PlayerController {
  readonly object: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  private readonly collisionBoxes: THREE.Box3[];
  private readonly indexedCollisionCount: number;
  private readonly collisionGrid = new Map<string, THREE.Box3[]>();
  private readonly fallback: THREE.Group;
  private readonly modelRoot = new THREE.Group();
  private readonly contactShadow: THREE.Mesh;
  private readonly shadowMaterial: THREE.MeshBasicMaterial;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly velocity = new THREE.Vector3();
  private readonly desiredVelocity = new THREE.Vector3();
  private readonly candidate = new THREE.Vector3();
  private currentAction: THREE.AnimationAction | undefined;
  private currentState: PlayerState = 'idle';
  private verticalVelocity = 0;
  private grounded = true;
  private jumpPressedLastFrame = false;
  private loaded = false;

  constructor(object: THREE.Group, collisionBoxes: THREE.Box3[]) {
    this.object = object;
    this.collisionBoxes = collisionBoxes;
    this.indexedCollisionCount = collisionBoxes.length;
    this.buildCollisionGrid();
    this.object.name = 'Player character';
    this.object.position.set(-5, GROUND_Y, 4);
    this.fallback = this.createFallback();
    this.object.add(this.fallback);
    this.object.add(this.modelRoot);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#17202b',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      map: this.createShadowTexture(),
    });
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.92), this.shadowMaterial);
    this.contactShadow.name = 'Player contact shadow';
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.006;
    this.contactShadow.renderOrder = 2;
    this.object.add(this.contactShadow);
    this.mixer = new THREE.AnimationMixer(this.modelRoot);
  }

  async loadCharacter(): Promise<boolean> {
    const loader = new GLTFLoader();
    try {
      const gltf = await Promise.race([
        new Promise<Awaited<ReturnType<typeof loader.loadAsync>>>((resolve, reject) => {
          loader.load(CHARACTER_URL, resolve, undefined, reject);
        }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Character download timed out')), 15000)),
      ]);
      gltf.scene.name = 'Rigged Mixamo Soldier';
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      // Normalize the imported model to a human-sized height and align its actual
      // lowest mesh point with the character root's ground-contact plane.
      gltf.scene.updateMatrixWorld(true);
      const modelBounds = new THREE.Box3().setFromObject(gltf.scene);
      const modelSize = new THREE.Vector3();
      modelBounds.getSize(modelSize);
      const sourceHeight = Math.max(modelSize.y, 0.001);
      const normalizedScale = CHARACTER_TARGET_HEIGHT / sourceHeight;
      this.modelRoot.scale.setScalar(normalizedScale);
      this.modelRoot.position.set(0, 0, 0);
      gltf.scene.position.y = -modelBounds.min.y;
      // Soldier.glb's authored forward axis is opposite the controller's +Z facing
      // convention. Correct only the visual rig so velocity and facing stay coherent.
      this.modelRoot.rotation.y = MODEL_FORWARD_CORRECTION;
      this.modelRoot.add(gltf.scene);

      for (const clip of gltf.animations) {
        const name = clip.name.toLowerCase();
        const key = name.includes('jump') || name.includes('fall') ? 'jump'
          : name.includes('run') ? 'run'
          : name.includes('walk') ? 'walk'
          : name.includes('idle') ? 'idle'
          : '';
        if (key && !this.actions.has(key)) this.actions.set(key, this.mixer.clipAction(clip));
      }
      if (!this.actions.has('jump')) {
        const jumpTracks: THREE.QuaternionKeyframeTrack[] = [];
        const times = [0, 0.12, 0.36, 0.68];
        gltf.scene.traverse((node) => {
          if (!(node instanceof THREE.Bone)) return;
          const name = node.name.toLowerCase();
          const isArm = name.includes('leftarm') || name.includes('rightarm');
          const isLeg = name.includes('leftupleg') || name.includes('rightupleg');
          if (!isArm && !isLeg) return;
          const rest = node.quaternion.clone();
          const pose = rest.clone().multiply(new THREE.Quaternion().setFromEuler(
            new THREE.Euler(isArm ? -0.85 : -0.42, 0, isArm && name.includes('left') ? -0.12 : isArm ? 0.12 : 0),
          ));
          const values = [
            rest.x, rest.y, rest.z, rest.w,
            pose.x, pose.y, pose.z, pose.w,
            pose.x, pose.y, pose.z, pose.w,
            rest.x, rest.y, rest.z, rest.w,
          ];
          jumpTracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values));
        });
        if (jumpTracks.length > 0) {
          const jumpClip = new THREE.AnimationClip('ProceduralJump', 0.68, jumpTracks);
          const jumpAction = this.mixer.clipAction(jumpClip);
          jumpAction.setLoop(THREE.LoopOnce, 1);
          jumpAction.clampWhenFinished = true;
          this.actions.set('jump', jumpAction);
        }
      }
      this.fallback.visible = false;
      this.loaded = true;
      this.playState('idle');
      return true;
    } catch (error) {
      console.warn('[NEON COAST] Rigged character could not be loaded; using the local fallback character.', error);
      return false;
    }
  }

  setVehicleMode(inVehicle: boolean): void {
    this.object.visible = !inVehicle;
    this.velocity.set(0, 0, 0);
    this.desiredVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.jumpPressedLastFrame = false;
    if (!inVehicle) this.playState('idle');
  }

  teleport(position: THREE.Vector3): void {
    this.object.position.copy(position);
    this.setVehicleMode(false);
  }

  update(dt: number, keys: ReadonlySet<string>, cameraYaw: number): void {
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    this.desiredVelocity.set(0, 0, 0);

    if (keys.has('KeyW')) { this.desiredVelocity.x += forwardX; this.desiredVelocity.z += forwardZ; }
    if (keys.has('KeyS')) { this.desiredVelocity.x -= forwardX; this.desiredVelocity.z -= forwardZ; }
    if (keys.has('KeyD')) { this.desiredVelocity.x += rightX; this.desiredVelocity.z += rightZ; }
    if (keys.has('KeyA')) { this.desiredVelocity.x -= rightX; this.desiredVelocity.z -= rightZ; }

    const moving = this.desiredVelocity.lengthSq() > 0;
    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const maxSpeed = sprinting ? RUN_SPEED : WALK_SPEED;
    if (moving) this.desiredVelocity.normalize().multiplyScalar(maxSpeed);
    const acceleration = moving ? 28 : 20;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, this.desiredVelocity.x, acceleration, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, this.desiredVelocity.z, acceleration, dt);

    const jumpPressed = keys.has('Space');
    if (jumpPressed && !this.jumpPressedLastFrame && this.grounded) {
      this.verticalVelocity = 7.4;
      this.grounded = false;
    }
    this.jumpPressedLastFrame = jumpPressed;

    this.verticalVelocity -= 20 * dt;
    this.object.position.y += this.verticalVelocity * dt;
    if (this.object.position.y <= GROUND_Y) {
      this.object.position.y = GROUND_Y;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    this.candidate.copy(this.object.position);
    this.candidate.x += this.velocity.x * dt;
    if (!this.collidesAt(this.candidate)) this.object.position.x = this.candidate.x;
    else this.velocity.x = 0;

    this.candidate.copy(this.object.position);
    this.candidate.z += this.velocity.z * dt;
    if (!this.collidesAt(this.candidate)) this.object.position.z = this.candidate.z;
    else this.velocity.z = 0;

    this.object.position.x = THREE.MathUtils.clamp(this.object.position.x, -820, 24);
    this.object.position.z = THREE.MathUtils.clamp(this.object.position.z, -415, 415);

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.2) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      const angleDifference = Math.atan2(Math.sin(targetYaw - this.object.rotation.y), Math.cos(targetYaw - this.object.rotation.y));
      this.object.rotation.y += angleDifference * (1 - Math.exp(-12 * dt));
    }

    const state: PlayerState = !this.grounded ? 'jump' : horizontalSpeed < 0.25 ? 'idle' : sprinting ? 'run' : 'walk';
    this.playState(state);
    this.mixer.update(dt);

    // The source Soldier rig has idle/walk/run clips; a small lean makes airtime readable
    // even when the source asset does not include a dedicated jump clip.
    const leanTarget = !this.grounded ? (this.verticalVelocity > 0 ? -0.12 : 0.08) : 0;
    this.modelRoot.rotation.x = THREE.MathUtils.damp(this.modelRoot.rotation.x, leanTarget, 9, dt);
  }

  private playState(state: PlayerState): void {
    if (state === this.currentState && this.currentAction) return;
    this.currentState = state;
    let next = this.actions.get(state);
    if (state === 'jump' && !next) next = this.actions.get('run') ?? this.actions.get('idle');
    if (state === 'run' && !next) next = this.actions.get('walk') ?? this.actions.get('idle');
    if (state === 'walk' && !next) next = this.actions.get('idle');
    if (!next) return;
    next.reset();
    next.enabled = true;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const nominalSpeed = state === 'run' ? 5.4 : state === 'walk' ? 2.4 : 1;
    const gaitRate = state === 'walk' || state === 'run'
      ? THREE.MathUtils.clamp(horizontalSpeed / nominalSpeed, 0.72, 1.65)
      : 1;
    next.setEffectiveTimeScale(gaitRate);
    next.setEffectiveWeight(1);
    next.play();
    if (this.currentAction && this.currentAction !== next) next.crossFadeFrom(this.currentAction, 0.18, true);
    this.currentAction = next;
  }

  private collidesAt(position: THREE.Vector3): boolean {
    if (position.x < -820 || position.x > 24 || position.z < -415 || position.z > 415) return true;
    const feet = position.y;
    const head = feet + PLAYER_HEIGHT;
    const minCellX = Math.floor((position.x - PLAYER_RADIUS) / PLAYER_COLLISION_CELL_SIZE);
    const maxCellX = Math.floor((position.x + PLAYER_RADIUS) / PLAYER_COLLISION_CELL_SIZE);
    const minCellZ = Math.floor((position.z - PLAYER_RADIUS) / PLAYER_COLLISION_CELL_SIZE);
    const maxCellZ = Math.floor((position.z + PLAYER_RADIUS) / PLAYER_COLLISION_CELL_SIZE);
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        const candidates = this.collisionGrid.get(this.collisionCellKey(cellX, cellZ));
        if (!candidates) continue;
        for (const box of candidates) {
          if (head <= box.min.y || feet >= box.max.y) continue;
          const closestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
          const closestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
          const dx = position.x - closestX;
          const dz = position.z - closestZ;
          if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
        }
      }
    }
    // The vehicle's moving AABB is appended after this static grid is built.
    // Check newly appended dynamic bounds directly so entering/exiting remains safe.
    for (let i = this.indexedCollisionCount; i < this.collisionBoxes.length; i += 1) {
      const box = this.collisionBoxes[i];
      if (head <= box.min.y || feet >= box.max.y) continue;
      const closestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
  }

  private collisionCellKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  private buildCollisionGrid(): void {
    for (let i = 0; i < this.indexedCollisionCount; i += 1) {
      const box = this.collisionBoxes[i];
      const minCellX = Math.floor(box.min.x / PLAYER_COLLISION_CELL_SIZE);
      const maxCellX = Math.floor(box.max.x / PLAYER_COLLISION_CELL_SIZE);
      const minCellZ = Math.floor(box.min.z / PLAYER_COLLISION_CELL_SIZE);
      const maxCellZ = Math.floor(box.max.z / PLAYER_COLLISION_CELL_SIZE);
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
          const key = this.collisionCellKey(cellX, cellZ);
          let bucket = this.collisionGrid.get(key);
          if (!bucket) {
            bucket = [];
            this.collisionGrid.set(key, bucket);
          }
          bucket.push(box);
        }
      }
    }
  }

  private createShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
      gradient.addColorStop(0, 'rgba(12, 20, 30, 0.58)');
      gradient.addColorStop(0.42, 'rgba(12, 20, 30, 0.28)');
      gradient.addColorStop(1, 'rgba(12, 20, 30, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createFallback(): THREE.Group {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#d6a17d', roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#e66a76', roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 8), shirt);
    body.position.y = 0.95;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(body, head);
    return group;
  }

  get isUsingRiggedCharacter(): boolean {
    return this.loaded;
  }
}
