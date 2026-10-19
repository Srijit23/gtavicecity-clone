import * as THREE from 'three';
import { PlayerController } from '../player/PlayerController';

const GROUND_Y = 0.12;
const VEHICLE_HALF_WIDTH = 1.02;
const VEHICLE_HALF_LENGTH = 2.15;
const ENTER_DISTANCE = 3.8;

type WheelAssembly = { pivot: THREE.Group; wheel: THREE.Group; front: boolean; side: number; restY: number };

export class VehicleController {
  readonly object: THREE.Group;
  private readonly world: THREE.Group;
  private readonly player: THREE.Group;
  private readonly playerController: PlayerController;
  private readonly collisionBoxes: THREE.Box3[];
  private readonly wheels: WheelAssembly[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly down = new THREE.Vector3(0, -1, 0);
  private readonly chassisBounds = new THREE.Box3();
  private speed = 0;
  private steering = 0;
  private suspensionPhase = 0;
  private eWasDown = false;
  private driving = false;
  private readonly paint = new THREE.MeshStandardMaterial({ color: '#e94e79', metalness: 0.62, roughness: 0.28 });
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
    this.object = new THREE.Group();
    this.object.name = 'Pink coastal coupe';
    this.object.position.set(-5, GROUND_Y, 0.2);
    this.buildVehicle();
    this.world.add(this.object);
  }

  update(dt: number, keys: ReadonlySet<string>): void {
    const enterDown = keys.has('KeyE');
    const enterPressed = enterDown && !this.eWasDown;
    this.eWasDown = enterDown;
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
    const substeps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const step = dt / substeps;
    for (let i = 0; i < substeps; i += 1) {
      if (throttle) this.speed += 10.5 * step;
      if (brakeOrReverse) {
        if (this.speed > 0.35) this.speed = Math.max(0, this.speed - 23 * step);
        else this.speed -= 6.8 * step;
      }
      if (!throttle && !brakeOrReverse) this.speed *= Math.exp(-0.72 * step);
      if (handbrake) this.speed *= Math.exp(-4.5 * step);
      this.speed = THREE.MathUtils.clamp(this.speed, -7.5, 22);
      const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 4.5, 0, 1);
      this.steering = THREE.MathUtils.damp(this.steering, steeringInput * 0.58 * speedFactor, 5.5, step);
      this.object.rotation.y += this.steering * (this.speed / 3.2) * step;
      const forward = new THREE.Vector3(-Math.sin(this.object.rotation.y), 0, -Math.cos(this.object.rotation.y));
      const previous = this.object.position.clone();
      this.object.position.addScaledVector(forward, this.speed * step);
      if (this.collidesAt(this.object.position)) {
        this.object.position.copy(previous);
        this.speed = -this.speed * 0.12;
        this.steering *= 0.35;
      }
    }
    this.suspensionPhase += dt * (2.2 + Math.abs(this.speed) * 0.8);
    const accelerationPulse = Math.min(1, Math.abs(this.speed - oldSpeed) * 0.055);
    this.object.position.y = GROUND_Y + Math.sin(this.suspensionPhase) * (0.008 + accelerationPulse * 0.035);
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
    return this.collisionBoxes.some((box) => {
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
    for (const box of this.collisionBoxes) {
      if (this.chassisBounds.max.y <= box.min.y || this.chassisBounds.min.y >= box.max.y) continue;
      if (this.chassisBounds.intersectsBox(box)) return true;
    }
    return position.x < -105 || position.x > 105 || position.z < -112 || position.z > 112;
  }

  private buildVehicle(): void {
    const addBox = (name: string, size: THREE.Vector3, position: THREE.Vector3, material: THREE.Material, parent = this.object): THREE.Mesh => {
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
        this.object.add(pivot);
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
    this.object.add(shadow);
  }

  private animateWheels(dt: number): void {
    for (const assembly of this.wheels) {
      if (assembly.front) assembly.pivot.rotation.y = this.steering * 0.78;
      assembly.wheel.rotation.x += this.speed * dt / 0.34;
      const roadProbe = new THREE.Vector3(this.object.position.x, this.object.position.y + 0.8, this.object.position.z);
      roadProbe.add(new THREE.Vector3(assembly.pivot.position.x, 0, assembly.pivot.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.object.rotation.y));
      this.raycaster.set(roadProbe, this.down);
      this.raycaster.far = 1.15;
      const hits = this.raycaster.intersectObjects(this.world.children, true).filter((hit) => hit.object.name.includes('boulevard') || hit.object.name.includes('street') || hit.object.name.includes('Sidewalk'));
      const compression = hits.length ? THREE.MathUtils.clamp(0.12 - (0.8 - hits[0].distance), -0.06, 0.08) : 0;
      assembly.pivot.position.y = assembly.restY - compression + Math.sin(this.suspensionPhase + assembly.side * 0.6 + (assembly.front ? 0 : 1.2)) * 0.012;
    }
  }

  get isDriving(): boolean { return this.driving; }
  get speedKmh(): number { return Math.round(Math.abs(this.speed) * 3.6); }
  get signedSpeed(): number { return this.speed; }
  get nearVehicle(): boolean { return this.player.position.distanceTo(this.object.position) <= ENTER_DISTANCE; }
}
