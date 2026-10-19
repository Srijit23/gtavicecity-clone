import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerController } from '../player/PlayerController';

const GROUND_Y = 0.12;
const VEHICLE_HALF_WIDTH = 1.02;
const VEHICLE_HALF_LENGTH = 2.15;
const ENTER_DISTANCE = 4.5;

type WheelAssembly = { pivot: THREE.Group; wheel: THREE.Group; front: boolean; side: number; restY: number };
type ModelWheel = {
  pivot: THREE.Object3D;
  front: boolean;
  baseRotationX: number;
  baseRotationY: number;
  baseRotationZ: number;
  spin: number;
};
const REAL_CAR_MODEL_URL = 'models/kenney-sedan.glb';
const CAR_WHEEL_RADIUS = 0.31;

export class VehicleController {
  readonly object: THREE.Group;
  private readonly world: THREE.Group;
  private readonly player: THREE.Group;
  private readonly playerController: PlayerController;
  private readonly collisionBoxes: THREE.Box3[];
  private readonly staticCollisionBoxes: THREE.Box3[];
  private readonly vehicleCollisionBox = new THREE.Box3();
  private readonly bodyVisual = new THREE.Group();
  private readonly fallbackVisual = new THREE.Group();
  private readonly wheels: WheelAssembly[] = [];
  private readonly modelWheels: ModelWheel[] = [];
  private realModelLoaded = false;
  private readonly chassisBounds = new THREE.Box3();
  private speed = 0;
  private steering = 0;
  private suspensionPhase = 0;
  private eWasDown = false;
  private driving = false;
  private readonly paint = new THREE.MeshStandardMaterial({ color: '#c3182b', metalness: 0.68, roughness: 0.27 });
  private readonly darkPaint = new THREE.MeshStandardMaterial({ color: '#272d3d', metalness: 0.48, roughness: 0.32 });
  private readonly glass = new THREE.MeshPhysicalMaterial({ color: '#243e50', metalness: 0.25, roughness: 0.16, transparent: true, opacity: 0.78, clearcoat: 0.9 });
  private readonly chrome = new THREE.MeshStandardMaterial({ color: '#b9c8cf', metalness: 0.88, roughness: 0.22 });
  private readonly headlight = new THREE.MeshStandardMaterial({ color: '#fff2c9', emissive: '#ffe5a1', emissiveIntensity: 2.2, roughness: 0.2 });
  private readonly taillight = new THREE.MeshStandardMaterial({ color: '#e52d4c', emissive: '#ed173d', emissiveIntensity: 1.5, roughness: 0.3 });

  constructor(world: THREE.Group, playerController: PlayerController, collisionBoxes: THREE.Box3[]) {
    this.world = world;
    this.playerController = playerController;
    this.player = playerController.object;
    this.collisionBoxes = collisionBoxes;
    this.staticCollisionBoxes = collisionBoxes.slice();
    this.object = new THREE.Group();
    this.object.name = 'Kenney low-poly red sedan';
    this.object.position.set(-5, GROUND_Y, 0.2);
    this.object.add(this.bodyVisual);
    this.bodyVisual.add(this.fallbackVisual);
    this.buildVehicle();
    this.loadRealCarModel();
    this.world.add(this.object);
    this.collisionBoxes.push(this.vehicleCollisionBox);
    this.updateVehicleCollisionBox();
  }

  update(dt: number, keys: ReadonlySet<string>): void {
    const enterDown = keys.has('KeyE');
    const enterPressed = enterDown && !this.eWasDown;
    this.eWasDown = enterDown;
    this.updateVehicleCollisionBox();
    if (!this.driving && enterPressed && this.player.position.distanceTo(this.object.position) <= ENTER_DISTANCE) {
      this.driving = true;
      this.speed = 0;
      this.playerController.setVehicleMode(true);
    } else if (this.driving && enterPressed) {
      this.exitVehicle();
    }
    if (!this.driving) return;

    const throttle = keys.has('KeyW');
    const brakeOrReverse = keys.has('KeyS');
    const handbrake = keys.has('Space');
    const steeringInput = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const oldSpeed = this.speed;
    // Bound integration work after slow frames while keeping collisions responsive.
    const substeps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))));
    const step = dt / substeps;
    for (let i = 0; i < substeps; i += 1) {
      if (throttle) {
        if (this.speed < -0.35) this.speed = Math.min(0, this.speed + 25 * step);
        else this.speed += (16.5 - Math.min(this.speed, 32) * 0.12) * step;
      }
      if (brakeOrReverse) {
        if (this.speed > 0.35) this.speed = Math.max(0, this.speed - 29 * step);
        else this.speed -= 8.5 * step;
      }
      if (!throttle && !brakeOrReverse) {
        const rollingDrag = Math.abs(this.speed) < 0.7 ? 2.4 : 0.85;
        this.speed = THREE.MathUtils.damp(this.speed, 0, rollingDrag, step);
      }
      if (handbrake) this.speed = THREE.MathUtils.damp(this.speed, 0, 2.8, step);
      this.speed = THREE.MathUtils.clamp(this.speed, -12, 44);

      // Steering is deliberately less sensitive at speed, like a road car with finite tire grip.
      const speed01 = THREE.MathUtils.clamp(Math.abs(this.speed) / 38, 0, 1);
      const steeringLimit = THREE.MathUtils.lerp(0.53, 0.14, speed01);
      const desiredSteering = steeringInput * steeringLimit;
      this.steering = THREE.MathUtils.damp(this.steering, desiredSteering, handbrake ? 8.5 : 5.8, step);
      const grip = handbrake ? 1.18 : THREE.MathUtils.lerp(1, 0.62, speed01);
      const yawRate = Math.tan(this.steering) * (this.speed / 2.75) * grip;
      this.object.rotation.y -= yawRate * step;

      const forward = new THREE.Vector3(-Math.sin(this.object.rotation.y), 0, -Math.cos(this.object.rotation.y));
      const previous = this.object.position.clone();
      this.object.position.addScaledVector(forward, this.speed * step);
      if (this.collidesAt(this.object.position)) {
        this.object.position.copy(previous);
        this.speed = Math.abs(this.speed) < 2 ? 0 : -this.speed * 0.08;
        this.steering *= 0.25;
      }
    }
    this.suspensionPhase += dt * (2.2 + Math.abs(this.speed) * 0.8);
    const accelerationPulse = Math.min(1, Math.abs(this.speed - oldSpeed) * 0.055);
    this.object.position.y = GROUND_Y + Math.sin(this.suspensionPhase) * (0.004 + accelerationPulse * 0.012);
    const pitchTarget = throttle ? -0.035 : brakeOrReverse && this.speed > 0 ? 0.045 : 0;
    const rollTarget = -this.steering * THREE.MathUtils.clamp(Math.abs(this.speed) / 12, 0, 1) * 0.12;
    this.bodyVisual.rotation.x = THREE.MathUtils.damp(this.bodyVisual.rotation.x, pitchTarget, 5, dt);
    this.bodyVisual.rotation.z = THREE.MathUtils.damp(this.bodyVisual.rotation.z, rollTarget, 4, dt);
    this.updateVehicleCollisionBox();
    this.animateWheels(dt);
  }

  private exitVehicle(): void {
    const yaw = this.object.rotation.y;
    const left = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const candidate = this.object.position.clone().addScaledVector(left, 1.8);
    candidate.y = GROUND_Y;
    if (this.playerBlocked(candidate)) {
      candidate.copy(this.object.position).addScaledVector(left.clone().negate(), 1.8);
      candidate.y = GROUND_Y;
    }
    if (this.playerBlocked(candidate)) {
      candidate.copy(this.object.position).add(new THREE.Vector3(0, 0, 2.6));
      candidate.y = GROUND_Y;
    }
    this.playerController.teleport(candidate);
    this.driving = false;
    this.speed = 0;
  }

  private playerBlocked(position: THREE.Vector3): boolean {
    const radius = 0.38;
    return this.staticCollisionBoxes.some((box) => {
      if (position.y + 1.82 <= box.min.y || position.y >= box.max.y) return false;
      const x = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
      const z = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
      return (position.x - x) ** 2 + (position.z - z) ** 2 < radius ** 2;
    });
  }

  private collidesAt(position: THREE.Vector3): boolean {
    this.chassisBounds.setFromCenterAndSize(
      new THREE.Vector3(position.x, position.y + 0.7, position.z),
      new THREE.Vector3(VEHICLE_HALF_WIDTH * 2, 1.35, VEHICLE_HALF_LENGTH * 2),
    );
    for (const box of this.staticCollisionBoxes) {
      if (this.chassisBounds.max.y <= box.min.y || this.chassisBounds.min.y >= box.max.y) continue;
      if (this.chassisBounds.intersectsBox(box)) return true;
    }
    return position.x < -105 || position.x > 105 || position.z < -112 || position.z > 112;
  }

  private buildVehicle(): void {
    const addBox = (name: string, size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, parent = this.fallbackVisual): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
      mesh.name = name;
      mesh.position.copy(position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    addBox('Chassis', new THREE.Vector3(1.82, 0.43, 3.9), new THREE.Vector3(0, 0.62, 0), this.darkPaint);
    addBox('Body shell', new THREE.Vector3(1.98, 0.38, 3.25), new THREE.Vector3(0, 0.78, -0.06), this.paint);
    addBox('Long hood', new THREE.Vector3(1.78, 0.16, 1.02), new THREE.Vector3(0, 0.92, -1.28), this.paint);
    addBox('Rear deck', new THREE.Vector3(1.72, 0.16, 0.68), new THREE.Vector3(0, 0.94, 1.35), this.paint);
    addBox('Front bumper chrome', new THREE.Vector3(1.9, 0.13, 0.15), new THREE.Vector3(0, 0.51, -2.03), this.chrome);
    addBox('Rear bumper chrome', new THREE.Vector3(1.9, 0.13, 0.15), new THREE.Vector3(0, 0.51, 2.02), this.chrome);
    addBox('Cabin roof', new THREE.Vector3(1.42, 0.14, 1.48), new THREE.Vector3(0, 1.42, 0.1), this.paint);
    addBox('Windshield', new THREE.Vector3(1.34, 0.56, 0.07), new THREE.Vector3(0, 1.18, -0.66), this.glass).rotation.x = -0.22;
    addBox('Rear glass', new THREE.Vector3(1.28, 0.46, 0.07), new THREE.Vector3(0, 1.17, 0.84), this.glass).rotation.x = 0.24;
    for (const side of [-1, 1]) {
      addBox('Side window ' + side, new THREE.Vector3(0.07, 0.45, 1.13), new THREE.Vector3(side * 0.72, 1.17, 0.08), this.glass);
      addBox('Door panel ' + side, new THREE.Vector3(0.1, 0.35, 1.18), new THREE.Vector3(side * 0.93, 0.77, 0.06), this.paint);
      addBox('Door handle ' + side, new THREE.Vector3(0.035, 0.035, 0.18), new THREE.Vector3(side * 0.99, 0.86, 0.18), this.chrome);
      addBox('Side mirror ' + side, new THREE.Vector3(0.18, 0.12, 0.15), new THREE.Vector3(side * 1.01, 1.02, -0.57), this.darkPaint);
      addBox('Rocker panel ' + side, new THREE.Vector3(0.12, 0.18, 2.5), new THREE.Vector3(side * 0.94, 0.49, 0.05), this.darkPaint);
    }
    for (const x of [-0.66, 0.66]) {
      addBox('Headlight ' + x, new THREE.Vector3(0.42, 0.16, 0.055), new THREE.Vector3(x, 0.86, -1.96), this.headlight);
      addBox('Tail light ' + x, new THREE.Vector3(0.34, 0.15, 0.055), new THREE.Vector3(x, 0.82, 1.96), this.taillight);
    }
    addBox('Dashboard', new THREE.Vector3(1.28, 0.12, 0.26), new THREE.Vector3(0, 1.02, -0.5), this.darkPaint);
    addBox('Driver seat', new THREE.Vector3(0.46, 0.48, 0.42), new THREE.Vector3(-0.42, 0.92, 0.38), this.darkPaint);
    addBox('Passenger seat', new THREE.Vector3(0.46, 0.48, 0.42), new THREE.Vector3(0.42, 0.92, 0.38), this.darkPaint);

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#101218', roughness: 0.93 });
    const rimMaterial = new THREE.MeshStandardMaterial({ color: '#9daeb6', metalness: 0.86, roughness: 0.25 });
    for (const x of [-0.91, 0.91]) {
      for (const z of [-1.28, 1.28]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.35, z);
        this.fallbackVisual.add(pivot);
        const wheel = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.23, 20), wheelMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheel.add(tire);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.245, 12), rimMaterial);
        rim.rotation.z = Math.PI / 2;
        wheel.add(rim);
        for (let spoke = 0; spoke < 5; spoke += 1) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.035), this.chrome);
          bar.position.y = Math.sin(spoke * Math.PI * 2 / 5) * 0.12;
          bar.position.z = Math.cos(spoke * Math.PI * 2 / 5) * 0.12;
          wheel.add(bar);
        }
        pivot.add(wheel);
        this.wheels.push({ pivot, wheel, front: z < 0, side: x < 0 ? -1 : 1, restY: 0.35 });
      }
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 4.8), new THREE.MeshBasicMaterial({ color: '#17202b', transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    shadow.renderOrder = 1;
    this.fallbackVisual.add(shadow);
  }

  /**
   * Load a production-quality, named-part GLB asynchronously. The procedural coupe
   * stays visible as a fallback until the full asset and textures are ready.
   */
  /**
   * Load the bundled Kenney CC0 sedan. It is stored in /public/models so gameplay
   * does not depend on an external asset CDN or third-party DNS.
   */
  private loadRealCarModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      REAL_CAR_MODEL_URL,
      (gltf) => {
        if (!gltf.scene || !gltf.scene.children.length) {
          console.error('[NEON COAST] Bundled sedan GLB is empty; showing the emergency fallback.');
          return;
        }

        const modelRoot = new THREE.Group();
        modelRoot.name = 'Kenney CC0 Sedan';
        // Verified source axes: Y is up; named front wheels sit at +Z.
        // Controller motion is along -Z, so rotate this visual asset by 180° around Y.
        modelRoot.rotation.y = Math.PI;
        modelRoot.scale.set(1.25, 1, 1.55);
        modelRoot.add(gltf.scene);

        // Stretch the wheelbase to fit the ~4 m chassis while keeping tire profiles round.
        // Wheel nodes are already authored at their hubs; keep their hierarchy intact.
        const wheelNodes: ModelWheel[] = [];
        modelRoot.traverse((node) => {
          if (!/^wheel-(front|back)-(left|right)$/i.test(node.name)) return;
          const front = /^wheel-front-/i.test(node.name);
          node.position.x *= 1.35;
          node.position.z *= 1.3;
          node.scale.z *= 1 / 1.55;
          wheelNodes.push({
            pivot: node,
            front,
            baseRotationX: node.rotation.x,
            baseRotationY: node.rotation.y,
            baseRotationZ: node.rotation.z,
            spin: 0,
          });
        });

        if (wheelNodes.length !== 4) {
          console.error(`[NEON COAST] Expected four named sedan wheels but found ${wheelNodes.length}; showing the emergency fallback.`);
          return;
        }

        modelRoot.updateMatrixWorld(true);
        const sourceBounds = new THREE.Box3().setFromObject(modelRoot);
        const sourceSize = sourceBounds.getSize(new THREE.Vector3());
        if (sourceBounds.isEmpty() || sourceSize.x <= 0 || sourceSize.y <= 0 || sourceSize.z <= 0) {
          console.error('[NEON COAST] Bundled sedan has invalid bounds; showing the emergency fallback.');
          return;
        }

        // Fit the model to the controller footprint and align the lowest wheel point to ground.
        const fitScale = Math.min(1.92 / sourceSize.x, 4.15 / sourceSize.z, 1.58 / sourceSize.y);
        modelRoot.scale.multiplyScalar(fitScale);
        modelRoot.updateMatrixWorld(true);
        const finalBounds = new THREE.Box3().setFromObject(modelRoot);
        const center = finalBounds.getCenter(new THREE.Vector3());
        modelRoot.position.set(-center.x, -finalBounds.min.y, -center.z);
        modelRoot.updateMatrixWorld(true);

        modelRoot.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = false;
            node.receiveShadow = false;
            node.frustumCulled = true;
          }
        });
        this.bodyVisual.add(modelRoot);

        const contactShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(2.35, 4.25),
          new THREE.MeshBasicMaterial({ color: '#111722', transparent: true, opacity: 0.2, depthWrite: false }),
        );
        contactShadow.name = 'Sedan contact shadow';
        contactShadow.rotation.x = -Math.PI / 2;
        contactShadow.position.y = 0.012;
        contactShadow.renderOrder = 1;
        contactShadow.castShadow = false;
        contactShadow.receiveShadow = false;
        this.bodyVisual.add(contactShadow);

        this.modelWheels.splice(0, this.modelWheels.length, ...wheelNodes);
        this.fallbackVisual.visible = false;
        this.realModelLoaded = true;
        console.info(`[NEON COAST] Bundled Kenney sedan loaded: ${wheelNodes.length} wheel pivots; source fit ${sourceSize.x.toFixed(2)} × ${sourceSize.y.toFixed(2)} × ${sourceSize.z.toFixed(2)} m.`);
      },
      undefined,
      (error) => {
        console.error('[NEON COAST] Bundled sedan failed to load at ' + REAL_CAR_MODEL_URL + '; verify public/models/kenney-sedan.glb is included in the build.', error);
      },
    );
  }

  private updateVehicleCollisionBox(): void {
    const yaw = this.object.rotation.y;
    const halfX = VEHICLE_HALF_WIDTH * Math.abs(Math.cos(yaw)) + VEHICLE_HALF_LENGTH * Math.abs(Math.sin(yaw));
    const halfZ = VEHICLE_HALF_LENGTH * Math.abs(Math.cos(yaw)) + VEHICLE_HALF_WIDTH * Math.abs(Math.sin(yaw));
    this.vehicleCollisionBox.setFromCenterAndSize(
      new THREE.Vector3(this.object.position.x, this.object.position.y + 0.72, this.object.position.z),
      new THREE.Vector3(halfX * 2, 1.42, halfZ * 2),
    );
  }

  private animateWheels(dt: number): void {
    if (this.realModelLoaded) {
      for (const wheel of this.modelWheels) {
        // The sedan's front is +Z in source space; its visual root faces -Z in-game.
        wheel.spin -= this.speed * dt / CAR_WHEEL_RADIUS;
        wheel.pivot.rotation.x = wheel.baseRotationX + wheel.spin;
        wheel.pivot.rotation.y = wheel.front ? wheel.baseRotationY - this.steering * 0.55 : wheel.baseRotationY;
        wheel.pivot.rotation.z = wheel.baseRotationZ;
      }
    }
    for (const assembly of this.wheels) {
      if (this.realModelLoaded) continue;
      if (assembly.front) assembly.pivot.rotation.y = this.steering * 0.78;
      assembly.wheel.rotation.x += this.speed * dt / 0.34;
      // Lightweight suspension animation; avoid recursive scene raycasts on every wheel.
      const compression = Math.sin(this.suspensionPhase + assembly.side * 0.6 + (assembly.front ? 0 : 1.2)) * 0.018;
      assembly.pivot.position.y = assembly.restY - compression;
    }
  }

  get isDriving(): boolean { return this.driving; }
  get speedKmh(): number { return Math.round(Math.abs(this.speed) * 3.6); }
  get signedSpeed(): number { return this.speed; }
  get nearVehicle(): boolean { return this.player.position.distanceTo(this.object.position) <= ENTER_DISTANCE; }
}
