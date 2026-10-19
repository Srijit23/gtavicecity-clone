import * as THREE from 'three';

const GROUND_Y = 0.13;
const PED_COUNT = 18;
const TRAFFIC_COUNT = 8;
const ACTIVE_RADIUS = 88;
const VISIBLE_RADIUS = 145;
const PED_SPEED_MIN = 1.0;
const PED_SPEED_MAX = 1.55;
const TRAFFIC_SPEED = 7.2;
const VEHICLE_LENGTH = 3.5;
const ROAD_WRAP_MIN = -108;
const ROAD_WRAP_MAX = 108;

type PedNode = { position: THREE.Vector3; edges: number[] };
type Pedestrian = {
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  route: number[];
  routeIndex: number;
  speed: number;
  phase: number;
  active: boolean;
};
type TrafficCar = {
  root: THREE.Group;
  laneX: number;
  direction: 1 | -1;
  speed: number;
  active: boolean;
};

const makeMaterial = (color: THREE.ColorRepresentation, roughness = 0.82): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });

/**
 * Small deterministic population simulation. Entities are allocated once and recycled
 * in-place; graph routes, local separation, yielding, and distance tiers keep the
 * simulation bounded even when the player travels across the district.
 */
export class PopulationController {
  private readonly root: THREE.Group;
  private readonly player: THREE.Group;
  private readonly playerVehicle: THREE.Group;
  private readonly collisionBoxes: THREE.Box3[];
  private readonly pedestrians: Pedestrian[] = [];
  private readonly traffic: TrafficCar[] = [];
  private readonly graph: PedNode[];
  private readonly pedestrianBodyGeometry = new THREE.CapsuleGeometry(0.22, 0.55, 3, 7);
  private readonly pedestrianHeadGeometry = new THREE.SphereGeometry(0.17, 8, 7);
  private readonly armGeometry = new THREE.CapsuleGeometry(0.075, 0.36, 2, 5);
  private readonly legGeometry = new THREE.CapsuleGeometry(0.09, 0.38, 2, 5);
  private readonly trafficBodyGeometry = new THREE.BoxGeometry(1.72, 0.48, VEHICLE_LENGTH);
  private readonly trafficCabinGeometry = new THREE.BoxGeometry(1.32, 0.48, 1.58);
  private readonly trafficWheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.16, 10);
  private readonly trafficPaints = [
    makeMaterial('#e7c16d', 0.36), makeMaterial('#58a7a4', 0.36),
    makeMaterial('#e9e1d2', 0.42), makeMaterial('#647ba5', 0.36),
    makeMaterial('#c76d70', 0.36), makeMaterial('#3e414d', 0.38),
  ];
  private readonly trafficGlass = new THREE.MeshStandardMaterial({ color: '#30485a', roughness: 0.2, metalness: 0.18 });
  private readonly rubber = makeMaterial('#171b24', 0.95);
  private elapsed = 0;
  private tickAccumulator = 0;
  private readonly tickRate = 1 / 20;
  private readonly scratch = new THREE.Vector3();

  constructor(root: THREE.Group, player: THREE.Group, playerVehicle: THREE.Group, collisionBoxes: THREE.Box3[]) {
    this.root = root;
    this.player = player;
    this.playerVehicle = playerVehicle;
    this.collisionBoxes = collisionBoxes;
    this.graph = this.createPedestrianGraph();
    this.createPedestrians();
    this.createTraffic();
  }

  update(dt: number, playerIsDriving: boolean): void {
    this.elapsed += dt;
    this.tickAccumulator += Math.min(dt, 0.05);
    if (this.tickAccumulator < this.tickRate) return;
    const step = Math.min(this.tickAccumulator, 0.12);
    this.tickAccumulator = 0;
    const focus = playerIsDriving ? this.playerVehicle.position : this.player.position;
    this.updatePedestrians(step, focus, playerIsDriving);
    this.updateTraffic(step, focus);
  }

  get pedestrianCount(): number { return this.pedestrians.length; }
  get trafficCount(): number { return this.traffic.length; }

  private createPedestrianGraph(): PedNode[] {
    const positions: [number, number][] = [
      [-9.45, -104], [-9.45, -34], [-9.45, 73], [-9.45, 104],
      [9.45, 104], [9.45, 73], [9.45, -34], [9.45, -104],
      [21.8, -104], [21.8, 104],
    ];
    const nodes: PedNode[] = positions.map(([x, z]) => ({ position: new THREE.Vector3(x, GROUND_Y, z), edges: [] }));
    const connect = (a: number, b: number): void => { nodes[a].edges.push(b); nodes[b].edges.push(a); };
    // Sidewalk corridors and crosswalk links; every node remains reachable by BFS.
    connect(0, 1); connect(1, 2); connect(2, 3);
    connect(3, 4); connect(4, 5); connect(5, 6); connect(6, 7);
    connect(7, 0);
    connect(7, 8); connect(8, 9); connect(9, 4);
    connect(1, 6);
    return nodes;
  }

  private findPath(start: number, goal: number): number[] {
    if (start === goal) return [start];
    const queue = [start];
    const previous = new Map<number, number>();
    previous.set(start, -1);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor];
      if (node === goal) break;
      for (const next of this.graph[node].edges) {
        if (previous.has(next)) continue;
        previous.set(next, node);
        queue.push(next);
      }
    }
    if (!previous.has(goal)) return [start, goal];
    const path: number[] = [];
    for (let node = goal; node !== -1; node = previous.get(node) ?? -1) path.push(node);
    return path.reverse();
  }

  private createPedestrians(): void {
    const skinMaterials = ['#bd886d', '#d8a17f', '#875d4b', '#e1b18c'].map((c) => makeMaterial(c));
    const clothes = ['#e56f85', '#4e9e9a', '#e1b45d', '#657cb0', '#eee0c9', '#8f648d'].map((c) => makeMaterial(c));
    const addPart = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      parent.add(mesh);
      return mesh;
    };
    for (let i = 0; i < PED_COUNT; i += 1) {
      const root = new THREE.Group();
      root.name = 'Pooled pedestrian ' + i;
      const torso = addPart(root, this.pedestrianBodyGeometry, clothes[i % clothes.length], 0, 0.96, 0);
      torso.scale.set(0.9, 1.1, 0.72);
      const head = addPart(root, this.pedestrianHeadGeometry, skinMaterials[i % skinMaterials.length], 0, 1.55, 0);
      const leftArm = addPart(root, this.armGeometry, clothes[i % clothes.length], -0.27, 1.02, 0);
      const rightArm = addPart(root, this.armGeometry, clothes[(i + 2) % clothes.length], 0.27, 1.02, 0);
      const leftLeg = addPart(root, this.legGeometry, makeMaterial('#343748'), -0.12, 0.42, 0);
      const rightLeg = addPart(root, this.legGeometry, makeMaterial('#343748'), 0.12, 0.42, 0);
      const startNode = i % this.graph.length;
      const goalNode = (startNode + 2 + (i % 5)) % this.graph.length;
      const route = this.findPath(startNode, goalNode);
      const ped: Pedestrian = {
        root, torso, head, leftArm, rightArm, leftLeg, rightLeg,
        route, routeIndex: route.length > 1 ? 1 : 0,
        speed: PED_SPEED_MIN + (i % 4) * 0.17, phase: i * 1.7, active: false,
      };
      root.position.copy(this.graph[startNode].position);
      root.position.x += (i % 3 - 1) * 0.26;
      root.position.z += ((i * 13) % 17) - 8;
      root.visible = false;
      this.root.add(root);
      this.pedestrians.push(ped);
    }
  }

  private createTraffic(): void {
    const tireMaterial = this.rubber;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const root = new THREE.Group();
      root.name = 'Pooled civilian traffic ' + i;
      const paint = this.trafficPaints[i % this.trafficPaints.length];
      const body = new THREE.Mesh(this.trafficBodyGeometry, paint);
      body.position.y = 0.55;
      body.castShadow = false;
      root.add(body);
      const cabin = new THREE.Mesh(this.trafficCabinGeometry, this.trafficGlass);
      cabin.position.set(0, 0.98, -0.12);
      cabin.castShadow = false;
      root.add(cabin);
      for (const x of [-0.82, 0.82]) {
        for (const z of [-1.12, 1.12]) {
          const wheel = new THREE.Mesh(this.trafficWheelGeometry, tireMaterial);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.31, z);
          wheel.castShadow = false;
          root.add(wheel);
        }
      }
      const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const laneX = direction === 1 ? -3.6 : 3.6;
      root.position.set(laneX, GROUND_Y, ROAD_WRAP_MIN + 18 + i * 27);
      root.rotation.y = direction === 1 ? 0 : Math.PI;
      root.visible = false;
      this.root.add(root);
      this.traffic.push({ root, laneX, direction, speed: TRAFFIC_SPEED - (i % 3) * 0.7, active: false });
    }
  }

  private updatePedestrians(dt: number, focus: THREE.Vector3, playerIsDriving: boolean): void {
    for (let i = 0; i < this.pedestrians.length; i += 1) {
      const ped = this.pedestrians[i];
      const distance = ped.root.position.distanceTo(focus);
      ped.root.visible = distance < VISIBLE_RADIUS;
      if (distance > ACTIVE_RADIUS) {
        ped.active = false;
        continue;
      }
      ped.active = true;
      const waypoint = this.graph[ped.route[ped.routeIndex]];
      const dx = waypoint.position.x - ped.root.position.x;
      const dz = waypoint.position.z - ped.root.position.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.75) {
        const current = ped.route[ped.routeIndex];
        const nextGoal = (current + 1 + Math.floor((i + this.elapsed) % (this.graph.length - 1))) % this.graph.length;
        ped.route = this.findPath(current, nextGoal);
        ped.routeIndex = ped.route.length > 1 ? 1 : 0;
      } else {
        let vx = dx / Math.max(length, 0.001);
        let vz = dz / Math.max(length, 0.001);
        // Reciprocal local separation prevents the sidewalk crowd from collapsing into one point.
        for (let j = 0; j < this.pedestrians.length; j += 1) {
          if (j === i) continue;
          const other = this.pedestrians[j];
          if (!other.active) continue;
          const ox = ped.root.position.x - other.root.position.x;
          const oz = ped.root.position.z - other.root.position.z;
          const d2 = ox * ox + oz * oz;
          if (d2 > 0.01 && d2 < 1.7 * 1.7) {
            const push = (1.7 - Math.sqrt(d2)) / 1.7;
            vx += ox / Math.sqrt(d2) * push * 0.95;
            vz += oz / Math.sqrt(d2) * push * 0.95;
          }
        }
        // Cars yield at crosswalks; pedestrians pause rather than stepping into a moving car.
        if (playerIsDriving && ped.root.position.distanceTo(this.playerVehicle.position) < 5.2) {
          vx = 0; vz = 0;
        }
        const speed = Math.hypot(vx, vz);
        if (speed > 0.001) {
          vx /= speed; vz /= speed;
          const candidateX = ped.root.position.x + vx * ped.speed * dt;
          const candidateZ = ped.root.position.z + vz * ped.speed * dt;
          if (!this.isPedestrianBlocked(candidateX, candidateZ)) {
            ped.root.position.x = candidateX;
            ped.root.position.z = candidateZ;
            ped.root.rotation.y = Math.atan2(vx, vz);
          } else {
            // A blocked waypoint is re-routed through the nearest reachable sidewalk node.
            const nearest = this.nearestNode(ped.root.position);
            const goal = ped.route[ped.route.length - 1] ?? nearest;
            ped.route = this.findPath(nearest, goal);
            ped.routeIndex = Math.min(1, ped.route.length - 1);
          }
        }
      }
      ped.phase += dt * (2.8 + ped.speed);
      const gait = Math.sin(ped.phase) * 0.38;
      ped.leftArm.rotation.x = gait;
      ped.rightArm.rotation.x = -gait;
      ped.leftLeg.rotation.x = -gait;
      ped.rightLeg.rotation.x = gait;
      ped.root.position.y = GROUND_Y + Math.abs(Math.sin(ped.phase * 2)) * 0.025;
    }
  }

  private updateTraffic(dt: number, focus: THREE.Vector3): void {
    for (let i = 0; i < this.traffic.length; i += 1) {
      const car = this.traffic[i];
      const distance = car.root.position.distanceTo(focus);
      car.root.visible = distance < VISIBLE_RADIUS;
      if (distance > ACTIVE_RADIUS) {
        car.active = false;
        continue;
      }
      car.active = true;
      let targetSpeed = car.speed;
      // Follow distance and player yielding: cars brake before queues become collisions.
      for (let j = 0; j < this.traffic.length; j += 1) {
        if (i === j) continue;
        const other = this.traffic[j];
        if (other.laneX !== car.laneX || other.direction !== car.direction) continue;
        const gap = (other.root.position.z - car.root.position.z) * car.direction;
        if (gap > 0 && gap < 10) targetSpeed = Math.min(targetSpeed, Math.max(0, (gap - 3.8) * 1.1));
      }
      const playerZ = focus.z;
      const sameLane = Math.abs(focus.x - car.laneX) < 2.2;
      const forwardGap = (playerZ - car.root.position.z) * car.direction;
      if (sameLane && forwardGap > -3 && forwardGap < 12) targetSpeed = 0;
      // Stop before a pedestrian occupies a boulevard crosswalk.
      for (const ped of this.pedestrians) {
        if (!ped.active) continue;
        const crossing = Math.abs(ped.root.position.x) < 8.9
          && [-34, 19, 73, -87].some((z) => Math.abs(ped.root.position.z - z) < 3.5);
        if (crossing && Math.abs(car.root.position.z - ped.root.position.z) < 9) targetSpeed = 0;
      }
      const stepSpeed = THREE.MathUtils.damp(car.speed, targetSpeed, targetSpeed < car.speed ? 4.2 : 0.75, dt);
      car.speed = THREE.MathUtils.clamp(stepSpeed, 0, TRAFFIC_SPEED);
      car.root.position.z += car.direction * car.speed * dt;
      if (car.root.position.z > ROAD_WRAP_MAX) car.root.position.z = ROAD_WRAP_MIN;
      if (car.root.position.z < ROAD_WRAP_MIN) car.root.position.z = ROAD_WRAP_MAX;
    }
  }

  private isPedestrianBlocked(x: number, z: number): boolean {
    const radius = 0.28;
    for (const box of this.collisionBoxes) {
      if (GROUND_Y + 1.8 <= box.min.y || GROUND_Y >= box.max.y) continue;
      const closestX = THREE.MathUtils.clamp(x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(z, box.min.z, box.max.z);
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius * radius) return true;
    }
    return x < -105 || x > 105 || z < -112 || z > 112;
  }

  private nearestNode(position: THREE.Vector3): number {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.graph.length; i += 1) {
      const distance = position.distanceToSquared(this.graph[i].position);
      if (distance < bestDistance) { best = i; bestDistance = distance; }
    }
    return best;
  }
}
