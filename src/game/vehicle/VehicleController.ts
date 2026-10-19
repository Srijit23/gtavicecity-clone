import * as THREE from 'three';

export interface VehicleInput {
  forward: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

const material = (color: THREE.ColorRepresentation, roughness = 0.65, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

/**
 * Lightweight arcade vehicle for the foundation build. The visual model and
 * driving state share one root, so wheels, steering, camera target and body
 * always move together. No remote model download is required.
 */
export class VehicleController {
  readonly root = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly frontWheels: THREE.Group[] = [];
  speed = 0;
  steering = 0;
  private readonly forward = new THREE.Vector3();
  private readonly maxForwardSpeed = 27;
  private readonly maxReverseSpeed = 9;
  private readonly wheelRadius = 0.36;

  constructor(parent: THREE.Object3D, position = new THREE.Vector3(-5, 0, 0)) {
    this.root.name = 'Low-poly coastal coupe';
    this.root.position.copy(position);
    parent.add(this.root);
    this.buildModel();
  }

  update(dt: number, input: VehicleInput): void {
    const throttle = input.forward ? 1 : input.reverse ? -1 : 0;
    const acceleratingForward = throttle > 0 && this.speed < 0;
    const acceleratingReverse = throttle < 0 && this.speed > 0;
    if (throttle !== 0) {
      const acceleration = (acceleratingForward || acceleratingReverse) ? 23 : 12;
      this.speed += throttle * acceleration * dt;
    } else {
      this.speed *= Math.exp(-1.35 * dt);
      if (Math.abs(this.speed) < 0.035) this.speed = 0;
    }

    if (input.brake) {
      this.speed *= Math.exp(-7.5 * dt);
      if (Math.abs(this.speed) < 0.12) this.speed = 0;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -this.maxReverseSpeed, this.maxForwardSpeed);

    const steeringInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steeringTarget = steeringInput * 0.48;
    this.steering = THREE.MathUtils.damp(this.steering, steeringTarget, 9, dt);
    const speedFactor = Math.min(Math.abs(this.speed) / 5, 1);
    const reverseSign = this.speed >= 0 ? 1 : -1;
    this.root.rotation.y += this.steering * speedFactor * reverseSign * 1.55 * dt;

    this.forward.set(-Math.sin(this.root.rotation.y), 0, -Math.cos(this.root.rotation.y));
    this.root.position.addScaledVector(this.forward, this.speed * dt);
    // Keep the prototype vehicle within the existing playable district.
    this.root.position.x = THREE.MathUtils.clamp(this.root.position.x, -108, 108);
    this.root.position.z = THREE.MathUtils.clamp(this.root.position.z, -112, 112);

    for (const wheel of this.frontWheels) wheel.rotation.y = this.steering;
    const roll = this.speed * dt / this.wheelRadius;
    for (const wheel of this.wheels) {
      const tire = wheel.userData.tire as THREE.Mesh | undefined;
      if (tire) tire.rotation.x += roll;
    }
  }

  resetSpeed(): void {
    this.speed = 0;
  }

  private buildModel(): void {
    const paint = material('#d94f68', 0.32, 0.18);
    const darkPaint = material('#8f2e48', 0.38, 0.12);
    const glass = new THREE.MeshStandardMaterial({ color: '#263e52', roughness: 0.2, metalness: 0.25, transparent: true, opacity: 0.88 });
    const rubber = material('#171a20', 0.92);
    const alloy = material('#b9c5c8', 0.28, 0.72);
    const trim = material('#222b35', 0.4, 0.25);
    const lamp = new THREE.MeshStandardMaterial({ color: '#fff0c6', emissive: '#ffcf83', emissiveIntensity: 0.55 });
    const tailLamp = new THREE.MeshStandardMaterial({ color: '#c92742', emissive: '#8f102b', emissiveIntensity: 0.35);

    const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };

    // Low, elongated body with separate hood, trunk and tapered cabin. The
    // entire car is approximately 4.1 x 1.35 x 2.0 world units.
    add(new THREE.BoxGeometry(2.02, 0.48, 4.05), paint, 0, 0.63, 0);
    add(new THREE.BoxGeometry(1.9, 0.22, 1.05), darkPaint, 0, 0.83, -1.38);
    add(new THREE.BoxGeometry(1.86, 0.2, 0.72), paint, 0, 0.82, 1.55);
    add(new THREE.BoxGeometry(1.66, 0.08, 1.8), trim, 0, 1.02, -0.12);

    const cabin = add(new THREE.BoxGeometry(1.48, 0.67, 1.62), paint, 0, 1.28, -0.15);
    cabin.scale.set(1, 1, 1);
    const roof = add(new THREE.BoxGeometry(1.36, 0.12, 0.94), darkPaint, 0, 1.68, -0.2);
    roof.castShadow = true;
    add(new THREE.BoxGeometry(1.39, 0.43, 0.07), glass, 0, 1.31, -0.96);
    add(new THREE.BoxGeometry(1.39, 0.4, 0.07), glass, 0, 1.29, 0.65);
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.055, 0.37, 0.76), glass, side * 0.755, 1.34, -0.16);
      add(new THREE.BoxGeometry(0.07, 0.1, 1.8), trim, side * 0.99, 0.88, 0);
      add(new THREE.BoxGeometry(0.12, 0.1, 0.42), alloy, side * 0.91, 0.9, -0.2);
    }
    // Front is local -Z, matching the player/camera forward convention.
    add(new THREE.BoxGeometry(1.76, 0.16, 0.12), trim, 0, 0.52, -2.04);
    add(new THREE.BoxGeometry(1.76, 0.15, 0.12), trim, 0, 0.52, 2.04);
    for (const x of [-0.67, 0.67]) {
      add(new THREE.BoxGeometry(0.42, 0.16, 0.07), lamp, x, 0.72, -2.105);
      add(new THREE.BoxGeometry(0.38, 0.15, 0.07), tailLamp, x, 0.72, 2.105);
    }
    add(new THREE.BoxGeometry(0.5, 0.09, 0.05), trim, 0, 0.49, -2.11);

    for (const x of [-0.99, 0.99]) {
      for (const z of [-1.32, 1.32]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.38, z);
        this.root.add(pivot);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.22, 12), rubber);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        pivot.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.235, 10), alloy);
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);
        const center = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 8), trim);
        center.rotation.z = Math.PI / 2;
        pivot.add(center);
        pivot.userData.tire = tire;
        this.wheels.push(pivot);
        if (z < 0) this.frontWheels.push(pivot);
      }
    }
  }
}
