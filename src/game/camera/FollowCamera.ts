import * as THREE from 'three';

type CameraObstacle = { object: THREE.Object3D; sphere: THREE.Sphere };

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  private pitch = 0.24;
  private distance = 8.5;
  private readonly scene: THREE.Scene;
  private target: THREE.Object3D;
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly obstacles: CameraObstacle[] = [];
  private readonly cameraCandidates: THREE.Object3D[] = [];
  private readonly obstacleOffset = new THREE.Vector3();
  private readonly closestRayPoint = new THREE.Vector3();

  constructor(scene: THREE.Scene, target: THREE.Object3D) {
    this.scene = scene;
    this.target = target;
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((object) => {
      if (object.userData.cameraObstacle !== true || !(object instanceof THREE.Mesh)) return;
      object.geometry.computeBoundingSphere();
      let localSphere = object.geometry.boundingSphere;
      if (object instanceof THREE.InstancedMesh) {
        object.computeBoundingSphere();
        localSphere = object.boundingSphere;
      }
      if (!localSphere) return;
      this.obstacles.push({
        object,
        sphere: localSphere.clone().applyMatrix4(object.matrixWorld),
      });
    });
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 1100);
    this.camera.position.set(0, 5, 9);
  }

  setTarget(target: THREE.Object3D): void {
    this.target = target;
  }

  update(_dt: number, dx: number, dy: number, zoom: number): void {
    this.yaw -= dx * 0.0025;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0018, -0.12, 0.85);
    this.distance = THREE.MathUtils.clamp(this.distance + zoom * 0.8, 3.5, 15);
  }

  follow(dt: number): void {
    this.lookTarget.copy(this.target.position);
    this.lookTarget.y += 1.35;
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.desiredPosition.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontal,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance + 0.7,
      this.lookTarget.z + Math.cos(this.yaw) * horizontal,
    );
    this.direction.copy(this.desiredPosition).sub(this.lookTarget).normalize();
    this.raycaster.set(this.lookTarget, this.direction);
    this.raycaster.far = this.distance;
    this.cameraCandidates.length = 0;
    for (const obstacle of this.obstacles) {
      this.obstacleOffset.copy(obstacle.sphere.center).sub(this.lookTarget);
      const alongRay = this.obstacleOffset.dot(this.direction);
      const radius = obstacle.sphere.radius + 0.45;
      if (alongRay < -radius || alongRay > this.distance + radius) continue;
      this.closestRayPoint.copy(this.lookTarget).addScaledVector(this.direction, THREE.MathUtils.clamp(alongRay, 0, this.distance));
      if (this.closestRayPoint.distanceToSquared(obstacle.sphere.center) <= radius * radius) {
        this.cameraCandidates.push(obstacle.object);
      }
    }
    const hits = this.raycaster.intersectObjects(this.cameraCandidates, true);
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
