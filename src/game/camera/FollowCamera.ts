import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  private pitch = 0.24;
  private distance = 8.5;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly target: THREE.Object3D;
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, target: THREE.Object3D) {
    this.renderer = renderer;
    this.scene = scene;
    this.target = target;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 350);
    this.camera.position.set(0, 5, 9);
  }

  update(_dt: number, dx: number, dy: number, zoom: number): void {
    this.yaw -= dx * 0.0025;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.002, -0.12, 0.85);
    this.distance = THREE.MathUtils.clamp(this.distance + zoom * 0.8, 3.5, 15);
  }

  follow(dt: number): void {
    this.lookTarget.copy(this.target.position).add(new THREE.Vector3(0, 1.35, 0));
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontal,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance + 0.7,
      this.lookTarget.z + Math.cos(this.yaw) * horizontal,
    );
    this.direction.copy(this.desiredPosition).sub(this.lookTarget).normalize();
    this.raycaster.set(this.lookTarget, this.direction);
    this.raycaster.far = this.distance;
    const obstacles = this.scene.children.filter((object) => object.userData.cameraObstacle === true);
    const hits = this.raycaster.intersectObjects(obstacles, true);
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
