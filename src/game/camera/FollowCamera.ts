import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  private pitch = 0.24;
  private distance = 8.5;
  private readonly scene: THREE.Scene;
  private target: THREE.Object3D;
  private driving = false;
  private drivingYawOffset = 0;
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly obstacles: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, target: THREE.Object3D) {
    this.scene = scene;
    this.target = target;
    this.scene.traverse((object) => { if (object.userData.cameraObstacle === true) this.obstacles.push(object); });
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 350);
    this.camera.position.set(0, 5, 9);
  }

  setTarget(target: THREE.Object3D, driving: boolean): void {
    this.target = target;
    if (this.driving !== driving) {
      this.driving = driving;
      this.distance = driving ? 10.5 : 8.5;
      this.pitch = driving ? 0.17 : 0.24;
      if (driving) {
        // Start directly behind the car, then let mouse movement orbit around its heading.
        this.yaw = target.rotation.y;
        this.drivingYawOffset = 0;
      }
    }
  }

  update(_dt: number, dx: number, dy: number, zoom: number): void {
    if (this.driving) this.drivingYawOffset -= dx * 0.0022;
    else this.yaw -= dx * 0.0025;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0018, this.driving ? -0.02 : -0.12, this.driving ? 0.58 : 0.85);
    this.distance = THREE.MathUtils.clamp(this.distance + zoom * 0.8, this.driving ? 6.5 : 3.5, this.driving ? 17 : 15);
  }

  follow(dt: number): void {
    this.lookTarget.copy(this.target.position).add(new THREE.Vector3(0, this.driving ? 1.15 : 1.35, 0));
    if (this.driving) {
      const desiredYaw = this.target.rotation.y + this.drivingYawOffset;
      const difference = THREE.MathUtils.euclideanModulo(desiredYaw - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
      this.yaw += difference * (1 - Math.exp(-Math.max(dt, 0) * 4.8));
    }
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontal,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance + 0.7,
      this.lookTarget.z + Math.cos(this.yaw) * horizontal,
    );
    this.direction.copy(this.desiredPosition).sub(this.lookTarget).normalize();
    this.raycaster.set(this.lookTarget, this.direction);
    this.raycaster.far = this.distance;
    const hits = this.raycaster.intersectObjects(this.obstacles, true);
    if (hits.length > 0) this.desiredPosition.copy(hits[0].point).addScaledVector(this.direction, -0.35);
    const blend = 1 - Math.exp(-Math.max(dt, 0) * 8);
    this.camera.position.lerp(this.desiredPosition, blend);
    this.camera.lookAt(this.lookTarget);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }
}
