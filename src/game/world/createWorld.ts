import * as THREE from 'three';

export interface WorldBundle {
  root: THREE.Group;
  player: THREE.Group;
  collisionBoxes: THREE.Box3[];
  update: (dt: number, elapsed: number) => void;
}

const mat = (color: THREE.ColorRepresentation, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createWorld(): WorldBundle {
  const root = new THREE.Group();
  const animated: Array<{ object: THREE.Object3D; baseY: number; phase: number; amplitude: number }> = [];
  const groundMaterial = mat('#d7b88d');
  const roadMaterial = mat('#33394b', 0.95);
  const sidewalkMaterial = mat('#d8c8b4');
  const whiteLineMaterial = new THREE.MeshBasicMaterial({ color: '#f4dfae' });
  const buildingColors = ['#e7a68c', '#f1d6a3', '#a9c6c8', '#d6a7bd', '#e4c7a1', '#92aeb4', '#f3e0c2'];

  const addBox = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, obstacle = false): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y + sy / 2, z);
    mesh.castShadow = sy > 1;
    mesh.receiveShadow = true;
    mesh.userData.cameraObstacle = obstacle;
    mesh.userData.playerCollision = obstacle;
    root.add(mesh);
    return mesh;
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  root.add(ground);

  // A broad boulevard and cross streets establish the first connected, navigable test district.
  addBox('Oceanfront boulevard', 0, 0, 0, 15, 0.12, 230, roadMaterial);
  addBox('Cross street west', -50, 0, -20, 95, 0.12, 9, roadMaterial);
  addBox('Cross street east', 50, 0, 30, 95, 0.12, 9, roadMaterial);
  addBox('Sidewalk west', -10.2, 0, 0, 4.6, 0.22, 230, sidewalkMaterial);
  addBox('Sidewalk east', 10.2, 0, 0, 4.6, 0.22, 230, sidewalkMaterial);
  addBox('Beach promenade', 22, 0, 0, 7, 0.18, 230, sidewalkMaterial);
  for (let z = -108; z <= 108; z += 8) {
    addBox(`Center lane marking ${z}`, 0, 0.07, z, 0.16, 0.02, 3.8, whiteLineMaterial);
  }

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), new THREE.MeshStandardMaterial({ color: '#238b9e', roughness: 0.34, metalness: 0.12 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(69, -0.12, 0);
  root.add(ocean);
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), mat('#e5ad91'));
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.set(116, -0.16, 0);
  root.add(horizon);

  // Colorful art-deco-inspired blocks flank the road, with simple collision silhouettes for the prototype.
  for (let row = 0; row < 8; row += 1) {
    for (const side of [-1, 1]) {
      const z = -91 + row * 26;
      const x = side * (18 + (row % 2) * 4);
      const width = 10 + (row % 3) * 2;
      const depth = 15 + ((row + 1) % 3) * 3;
      const height = 7 + ((row * 7) % 5) * 3;
      const building = addBox(`Art deco block ${row}-${side}`, x, 0, z, width, height, depth, mat(buildingColors[(row + (side > 0 ? 2 : 0)) % buildingColors.length]), true);
      const trim = mat('#f4d9b4', 0.6);
      addBox(`Roof trim ${row}-${side}`, x, height, z, width + 0.35, 0.3, depth + 0.35, trim, true);
      const windowMaterial = new THREE.MeshStandardMaterial({ color: row % 2 ? '#31546b' : '#3b5264', emissive: '#102b3b', roughness: 0.3, metalness: 0.18 });
      for (let floor = 1; floor < Math.max(2, Math.floor(height / 3)); floor += 1) {
        for (let window = -1; window <= 1; window += 1) {
          const pane = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.09), windowMaterial);
          pane.position.set(x + window * width * 0.27, floor * 2.5 + 1.1, z - depth / 2 - 0.06);
          root.add(pane);
        }
      }
      building.userData.cameraObstacle = true;
    }
  }

  const trunkMaterial = mat('#76503c');
  const leafMaterial = mat('#247f70', 0.9);
  for (let z = -102; z <= 102; z += 17) {
    for (const x of [-12.5, 13.1, 26.2]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.5, 7), trunkMaterial);
      trunk.position.set(x, 2.25, z);
      trunk.rotation.z = x > 20 ? -0.12 : 0.08;
      root.add(trunk);
      for (let i = 0; i < 6; i += 1) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.5, 5), leafMaterial);
        leaf.position.set(x + Math.cos(i * Math.PI / 3) * 1.25, 4.5 + Math.sin(i * Math.PI / 3) * 0.35, z + Math.sin(i * Math.PI / 3) * 1.25);
        leaf.rotation.z = Math.cos(i * Math.PI / 3) * 0.85;
        leaf.rotation.x = Math.sin(i * Math.PI / 3) * 0.85;
        root.add(leaf);
      }
    }
  }

  // Street furniture and a small neon landmark add foreground detail without external assets.
  for (let z = -88; z <= 88; z += 22) {
    const pole = addBox(`Street lamp pole ${z}`, -12.8, 0, z, 0.12, 4.5, 0.12, mat('#344050'));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd5a1' }));
    lamp.position.set(-12.8, 4.55, z);
    root.add(lamp);
    animated.push({ object: lamp, baseY: lamp.position.y, phase: z * 0.1, amplitude: 0.04 });
    pole.userData.cameraObstacle = true;
  }
  const sign = new THREE.Group();
  const signPanel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 8), mat('#17263b', 0.45, 0.2));
  const signGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 6.2), new THREE.MeshBasicMaterial({ color: '#ff5db8' }));
  sign.add(signPanel, signGlow);
  sign.position.set(-28, 4.5, -16);
  root.add(sign);

  // The real rigged character is attached by PlayerController in Milestone B.
  const player = new THREE.Group();
  player.name = 'Player character root';
  player.position.set(-5, 0.12, 4);
  root.add(player);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), new THREE.MeshBasicMaterial({ color: '#efad98', side: THREE.BackSide }));
  root.add(sky);
  const sun = new THREE.DirectionalLight('#ffe0b6', 3.0);
  sun.position.set(-28, 48, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -65;
  sun.shadow.camera.right = 65;
  sun.shadow.camera.top = 85;
  sun.shadow.camera.bottom = -85;
  sun.shadow.bias = -0.0005;
  root.add(sun);
  root.add(new THREE.HemisphereLight('#b7d7f5', '#bf8d70', 1.5));
  const fill = new THREE.PointLight('#e74f9b', 15, 42, 2);
  fill.position.set(-26, 7, -15);
  root.add(fill);

  root.updateMatrixWorld(true);
  const collisionBoxes: THREE.Box3[] = [];
  root.traverse((object) => {
    if (object.userData.playerCollision === true) collisionBoxes.push(new THREE.Box3().setFromObject(object));
  });

  return {
    root,
    player,
    collisionBoxes,
    update: (_dt, elapsed) => {
      for (const item of animated) item.object.position.y = item.baseY + Math.sin(elapsed * 1.6 + item.phase) * item.amplitude;
    },
  };
}
