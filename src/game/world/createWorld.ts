import * as THREE from 'three';

export interface WorldBundle {
  root: THREE.Group;
  player: THREE.Group;
  collisionBoxes: THREE.Box3[];
  update: (dt: number, elapsed: number) => void;
  interact: (playerPosition: THREE.Vector3, keys: ReadonlySet<string>) => string;
}

const mat = (color: THREE.ColorRepresentation, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function createWorld(): WorldBundle {
  const root = new THREE.Group();
  root.name = 'Neon Coast playable district';
  const animated: Array<{ object: THREE.Object3D; baseY: number; phase: number; amplitude: number }> = [];
  const collisionBoxes: THREE.Box3[] = [];
  const groundMaterial = mat('#d6b58a');
  const roadMaterial = mat('#303746', 0.96);
  const sidewalkMaterial = mat('#cdbda8');
  const curbMaterial = mat('#e9d7b9', 0.92);
  const laneMaterial = new THREE.MeshBasicMaterial({ color: '#f2d8a7' });
  const buildingColors = ['#d88f7e', '#e7c58f', '#83afb5', '#c58ca8', '#d8b58d', '#8ba5ad', '#ead7b7', '#b9a4ca'];
  const windowMaterials = [
    new THREE.MeshStandardMaterial({ color: '#243e55', emissive: '#142b43', emissiveIntensity: 0.38, roughness: 0.28, metalness: 0.18 }),
    new THREE.MeshStandardMaterial({ color: '#38576a', emissive: '#172f46', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.12 }),
  ];
  const trimMaterial = mat('#f0d9b5', 0.58);
  const darkMetal = mat('#303747', 0.36, 0.72);
  const palmTrunkMaterial = mat('#76503c');
  const palmLeafMaterial = mat('#26796b', 0.9);
  const neonPink = new THREE.MeshBasicMaterial({ color: '#ff5ab8' });
  const neonCyan = new THREE.MeshBasicMaterial({ color: '#69f3f0' });
  const warmLamp = new THREE.MeshStandardMaterial({ color: '#ffe1aa', emissive: '#ffbf73', emissiveIntensity: 2.2 });

  const addBox = (
    name: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, material: THREE.Material,
    obstacle = false, parent: THREE.Object3D = root,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y + sy / 2, z);
    mesh.castShadow = sy > 1;
    mesh.receiveShadow = true;
    mesh.userData.cameraObstacle = obstacle;
    mesh.userData.playerCollision = obstacle;
    parent.add(mesh);
    if (obstacle) {
      mesh.updateMatrixWorld(true);
      collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  };

  const addInstances = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[]): THREE.InstancedMesh => {
    const instances = new THREE.InstancedMesh(geometry, material, matrices.length);
    instances.name = name;
    matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    instances.castShadow = false;
    instances.receiveShadow = true;
    root.add(instances);
    return instances;
  };

  // Warm sand-colored ground plane and continuous asphalt network.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(270, 270), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  root.add(ground);

  addBox('Oceanfront boulevard', 0, 0, 0, 15, 0.12, 230, roadMaterial);
  addBox('West cross street', -49, 0, -34, 98, 0.12, 10, roadMaterial);
  addBox('Midtown cross street', 43, 0, 19, 98, 0.12, 10, roadMaterial);
  addBox('Marina cross street', -38, 0, 73, 105, 0.12, 10, roadMaterial);
  addBox('North loop street', -39, 0, -87, 108, 0.12, 10, roadMaterial);
  addBox('West sidewalk', -10.45, 0.02, 0, 4.1, 0.18, 230, sidewalkMaterial);
  addBox('East sidewalk', 10.45, 0.02, 0, 4.1, 0.18, 230, sidewalkMaterial);
  addBox('Beach promenade', 22.4, 0.02, 0, 6.7, 0.16, 230, sidewalkMaterial);
  addBox('West curb', -12.62, 0.02, 0, 0.18, 0.2, 230, curbMaterial);
  addBox('East curb', 12.62, 0.02, 0, 0.18, 0.2, 230, curbMaterial);
  const centerDashes: THREE.Matrix4[] = [];
  const leftDashes: THREE.Matrix4[] = [];
  const rightDashes: THREE.Matrix4[] = [];
  for (let z = -108; z <= 108; z += 8) {
    centerDashes.push(new THREE.Matrix4().makeTranslation(0, 0.134, z));
    leftDashes.push(new THREE.Matrix4().makeTranslation(-6.8, 0.134, z));
    rightDashes.push(new THREE.Matrix4().makeTranslation(6.8, 0.134, z));
  }
  addInstances('Center lane markings', new THREE.BoxGeometry(0.14, 0.018, 3.7), laneMaterial, centerDashes);
  addInstances('Left lane markings', new THREE.BoxGeometry(0.08, 0.018, 2.1), laneMaterial, leftDashes);
  addInstances('Right lane markings', new THREE.BoxGeometry(0.08, 0.018, 2.1), laneMaterial, rightDashes);
  const crosswalkStripes: THREE.Matrix4[] = [];
  for (const z of [-34, 19, 73, -87]) {
    for (let x = -88; x <= 88; x += 9) crosswalkStripes.push(new THREE.Matrix4().makeTranslation(x, 0.135, z));
  }
  addInstances('Crosswalk markings', new THREE.BoxGeometry(3.2, 0.018, 0.38), laneMaterial, crosswalkStripes);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(92, 260), new THREE.MeshStandardMaterial({ color: '#208da1', roughness: 0.32, metalness: 0.12 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(72, -0.14, 0);
  ocean.receiveShadow = true;
  root.add(ocean);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), mat('#e8cda0'));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(29.8, -0.025, 0);
  root.add(beach);
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), mat('#e5ad91'));
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.set(119, -0.17, 0);
  root.add(horizon);

  // Main street blocks: readable silhouettes, stepped rooflines, facade trim, recessed windows and storefronts.
  const windowFrameMatrices: THREE.Matrix4[] = [];
  const windowPaneMatrices: [THREE.Matrix4[], THREE.Matrix4[]] = [[], []];
  const windowFrameGeometry = new THREE.BoxGeometry(1.2, 1.5, 0.12);
  const windowPaneGeometry = new THREE.BoxGeometry(1.05, 1.35, 0.085);
  for (let row = 0; row < 8; row += 1) {
    for (const side of [-1, 1]) {
      const z = -96 + row * 27;
      if (Math.abs(z + 34) < 10 || Math.abs(z - 19) < 10 || Math.abs(z - 73) < 10 || Math.abs(z + 87) < 10) continue;
      if (side < 0 && Math.abs(z - 5.2) < 25) continue; // Reserve this block for the enterable diner.
      const x = side * (19 + (row % 2) * 3.2);
      const width = 10.5 + (row % 3) * 1.7;
      const depth = 15 + ((row + 1) % 3) * 2.4;
      const height = 9 + ((row * 7) % 5) * 3.2;
      const color = buildingColors[(row + (side > 0 ? 2 : 0)) % buildingColors.length];
      addBox('Art deco building ' + row + '-' + side, x, 0, z, width, height, depth, mat(color, 0.72), true);
      addBox('Building crown ' + row + '-' + side, x, height, z, width + 0.42, 0.3, depth + 0.42, trimMaterial, true);
      addBox('Facade lower band ' + row + '-' + side, x, 1.05, z - depth / 2 - 0.035, width, 0.2, 0.08, trimMaterial);
      addBox('Facade upper band ' + row + '-' + side, x, height - 1.15, z - depth / 2 - 0.04, width, 0.12, 0.08, trimMaterial);
      for (let floor = 0; floor < Math.floor(height / 3.2); floor += 1) {
        for (let column = -1; column <= 1; column += 1) {
          const wx = x + column * width * 0.28;
          const wz = z - depth / 2 - 0.09;
          const frameMatrix = new THREE.Matrix4().makeTranslation(wx, 2.25 + floor * 3.1, wz);
          windowFrameMatrices.push(frameMatrix);
          const materialIndex = (row + floor + column + 4) % 2;
          windowPaneMatrices[materialIndex].push(new THREE.Matrix4().makeTranslation(wx, 2.25 + floor * 3.1, wz - 0.07));
        }
      }
      // Art-deco vertical pilasters and roof equipment.
      for (const edge of [-1, 1]) {
        addBox('Facade pilaster', x + edge * (width / 2 - 0.22), 0.4, z - depth / 2 - 0.08, 0.22, Math.max(2, height - 0.6), 0.18, trimMaterial);
      }
      addBox('Rooftop equipment', x + width * 0.18, height + 0.3, z, width * 0.22, 0.7, depth * 0.2, darkMetal);
    }
  }

  const windowFrames = new THREE.InstancedMesh(windowFrameGeometry, trimMaterial, windowFrameMatrices.length);
  windowFrameMatrices.forEach((matrix, index) => windowFrames.setMatrixAt(index, matrix));
  windowFrames.castShadow = false;
  windowFrames.receiveShadow = true;
  root.add(windowFrames);
  for (let materialIndex = 0; materialIndex < 2; materialIndex += 1) {
    const matrices = windowPaneMatrices[materialIndex];
    const panes = new THREE.InstancedMesh(windowPaneGeometry, windowMaterials[materialIndex], matrices.length);
    matrices.forEach((matrix, index) => panes.setMatrixAt(index, matrix));
    panes.castShadow = false;
    root.add(panes);
  }

  // The Coastline Diner is a genuinely enterable room. The east-facing doorway is left open;
  // its perimeter walls are separate collision meshes, so the player can cross the threshold.
  const diner = new THREE.Group();
  diner.name = 'Coastline Diner interactive interior';
  root.add(diner);
  const dx = -24.2;
  const dz = 5.2;
  const roomW = 11.2;
  const roomD = 14.4;
  const left = dx - roomW / 2;
  const right = dx + roomW / 2;
  const back = dz - roomD / 2;
  const front = dz + roomD / 2;
  const wall = mat('#e6cba8', 0.88);
  const innerWall = mat('#d8b895', 0.9);
  const dinerFloor = mat('#36394a', 0.84);
  const tile = mat('#e7d8c4', 0.75);
  addBox('Diner floor', dx, 0.01, dz, roomW, 0.12, roomD, dinerFloor);
  addBox('Diner back wall', left, 0.12, dz, 0.22, 3.5, roomD, wall, true);
  addBox('Diner north wall', dx, 0.12, back, roomW, 3.5, 0.22, wall, true);
  addBox('Diner south wall', dx, 0.12, front, roomW, 3.5, 0.22, wall, true);
  // East wall with a 2.4 m doorway opening between the two wall segments.
  addBox('Diner entrance wall north', right, 0.12, dz - 4.9, 0.22, 3.5, 4.6, wall, true);
  addBox('Diner entrance wall south', right, 0.12, dz + 4.9, 0.22, 3.5, 4.6, wall, true);
  addBox('Diner lintel over doorway', right, 2.95, dz, 0.22, 0.67, 2.4, wall, true);
  addBox('Diner interior ceiling beam', dx, 3.55, dz, roomW, 0.12, roomD, trimMaterial);
  // Checkerboard floor tiles are shallow, decorative and do not enter the collision list.
  for (let x = 0; x < 8; x += 1) {
    for (let z = 0; z < 10; z += 1) {
      if ((x + z) % 2 !== 0) continue;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.18), tile);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(left + 0.8 + x * 1.35, 0.078, back + 0.8 + z * 1.35);
      diner.add(mesh);
    }
  }
  // Counter, backbar, shelves, menu board and bar stools make the room visibly usable.
  addBox('Diner counter base', dx - 1.9, 0.15, dz - 2.5, 4.6, 1.05, 1.05, mat('#7c4b3b', 0.5), true);
  addBox('Diner counter top', dx - 1.9, 1.2, dz - 2.5, 4.9, 0.14, 1.2, trimMaterial, true);
  addBox('Diner backbar', left + 0.5, 0.3, dz - 2.5, 0.65, 2.2, 4.3, innerWall, true);
  addBox('Diner menu board', dx - 1.7, 2.25, back + 0.2, 3.8, 1.1, 0.12, darkMetal);
  const menuText = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.055, 0.035), neonPink);
  menuText.position.set(dx - 1.7, 2.45, back + 0.12);
  diner.add(menuText);
  for (const x of [-1, 0, 1]) {
    const stoolX = dx + 0.4 + x * 1.15;
    addBox('Diner stool base', stoolX, 0.1, dz - 0.95, 0.12, 0.62, 0.12, darkMetal, true);
    addBox('Diner stool seat', stoolX, 0.72, dz - 0.95, 0.62, 0.12, 0.62, mat('#bd6a83'), true);
  }
  // Booth seating and tables on the far side of the room.
  for (const z of [dz + 1.0, dz + 4.0]) {
    addBox('Diner booth seat', dx - 3.7, 0.35, z, 1.0, 0.62, 2.2, mat('#b85d79'), true);
    addBox('Diner booth backrest', dx - 4.15, 0.9, z, 0.18, 0.72, 2.2, mat('#9f4c69'), true);
    addBox('Diner booth table', dx - 1.9, 0.8, z, 1.25, 0.08, 1.25, trimMaterial, true);
  }
  const dinerSign = new THREE.Group();
  const signPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 5.2), darkMetal);
  const dinerSignLetters = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 4.4), neonPink);
  dinerSign.add(signPanel, dinerSignLetters);
  dinerSign.position.set(right + 0.25, 3.3, dz);
  root.add(dinerSign);
  const dinerGlow = new THREE.PointLight('#ff65bb', 8, 16, 2);
  dinerGlow.position.set(dx, 2.8, dz);
  root.add(dinerGlow);
  const dinerCeilingLight = new THREE.PointLight('#ffdda7', 12, 11, 2);
  dinerCeilingLight.position.set(dx - 1.2, 2.9, dz - 1.6);
  root.add(dinerCeilingLight);
  // Two street-side planters frame the entrance without blocking the doorway.
  for (const z of [dz - 2.0, dz + 2.0]) {
    addBox('Diner entrance planter', right + 1.1, 0.1, z, 0.7, 0.55, 0.7, mat('#9b7055'), true);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), palmLeafMaterial);
    shrub.position.set(right + 1.1, 0.75, z);
    root.add(shrub);
  }

  // Palm geometry is instanced to keep draw calls manageable across the whole district.
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 4.5, 7);
  const leafGeo = new THREE.ConeGeometry(0.34, 3.5, 5);
  const palmTrunks: THREE.Matrix4[] = [];
  const palmLeaves: THREE.Matrix4[] = [];
  for (let z = -105; z <= 105; z += 21) {
    for (const x of [-13.7, 14.0, 26.5]) {
      const trunkMatrix = new THREE.Matrix4().compose(new THREE.Vector3(x, 2.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, x > 20 ? -0.12 : 0.08)), new THREE.Vector3(1, 1, 1));
      palmTrunks.push(trunkMatrix);
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI / 3;
        const pos = new THREE.Vector3(x + Math.cos(angle) * 1.25, 4.5 + Math.sin(angle) * 0.35, z + Math.sin(angle) * 1.25);
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(angle) * 0.85, 0, Math.cos(angle) * 0.85));
        palmLeaves.push(new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(1, 1, 1)));
      }
    }
  }
  const trunkInstances = new THREE.InstancedMesh(trunkGeo, palmTrunkMaterial, palmTrunks.length);
  palmTrunks.forEach((matrix, i) => trunkInstances.setMatrixAt(i, matrix));
  trunkInstances.castShadow = true;
  trunkInstances.receiveShadow = true;
  root.add(trunkInstances);
  const leafInstances = new THREE.InstancedMesh(leafGeo, palmLeafMaterial, palmLeaves.length);
  palmLeaves.forEach((matrix, i) => leafInstances.setMatrixAt(i, matrix));
  leafInstances.castShadow = true;
  root.add(leafInstances);

  // Benches, waste bins, street lamps and warm bollards add scale to the sidewalks.
  for (let z = -90; z <= 90; z += 30) {
    for (const x of [-12.0, 13.0, 24.8]) {
      addBox('Street lamp post', x, 0, z, 0.12, 4.4, 0.12, darkMetal, true);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), warmLamp);
      lamp.position.set(x, 4.5, z);
      root.add(lamp);
      animated.push({ object: lamp, baseY: lamp.position.y, phase: z * 0.1 + x, amplitude: 0.025 });
      if (x !== 24.8) {
        addBox('Sidewalk bench seat', x + (x < 0 ? -0.9 : 0.9), 0.45, z + 2.5, 1.7, 0.14, 0.48, mat('#8c5a43'), true);
        addBox('Sidewalk bench legs', x + (x < 0 ? -0.9 : 0.9), 0.12, z + 2.5, 0.12, 0.5, 0.12, darkMetal, true);
        addBox('Street waste bin', x + (x < 0 ? -1.6 : 1.6), 0.1, z - 2.4, 0.55, 0.9, 0.55, darkMetal, true);
      }
    }
  }

  // Painted art-deco landmark and waterfront railings.
  addBox('Landmark plinth', -37, 0, -17, 2.5, 1.4, 9, darkMetal, true);
  addBox('Landmark neon panel', -38.2, 1.5, -17, 0.16, 4.1, 7.5, darkMetal);
  addBox('Landmark neon line', -38.32, 3.1, -17, 0.08, 0.14, 6.2, neonPink);
  for (let z = -110; z <= 110; z += 5) {
    addBox('Promenade rail post ' + z, 26.0, 0.15, z, 0.12, 1.05, 0.12, darkMetal, true);
  }
  addBox('Promenade top rail', 26.0, 1.05, 0, 0.16, 0.12, 225, darkMetal, true);

  // Rigged player is attached by PlayerController.
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
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0005;
  root.add(sun);
  root.add(new THREE.HemisphereLight('#b7d7f5', '#bf8d70', 1.5));
  const waterfrontFill = new THREE.PointLight('#e74f9b', 12, 38, 2);
  waterfrontFill.position.set(-38, 7, -17);
  root.add(waterfrontFill);

  const skyFog = new THREE.Fog('#e7aa96', 95, 235);
  // Scene background/fog is assigned by main through the world root's userData.
  root.userData.fog = skyFog;

  let fWasDown = false;
  let dinerActivated = false;
  let interactionMessage = '';
  const interact = (playerPosition: THREE.Vector3, keys: ReadonlySet<string>): string => {
    const justPressed = keys.has('KeyF') && !fWasDown;
    fWasDown = keys.has('KeyF');
    const insideDiner = playerPosition.x > left + 0.8 && playerPosition.x < right - 0.8
      && playerPosition.z > back + 0.8 && playerPosition.z < front - 0.8;
    const nearDoor = playerPosition.distanceTo(new THREE.Vector3(right + 0.6, playerPosition.y, dz)) < 3.1;
    const nearCounter = insideDiner && playerPosition.distanceTo(new THREE.Vector3(dx - 1.8, playerPosition.y, dz - 2.5)) < 3.4;
    if (justPressed && nearCounter) {
      dinerActivated = !dinerActivated;
      dinerGlow.intensity = dinerActivated ? 14 : 8;
      dinerSignLetters.material = dinerActivated ? neonCyan : neonPink;
      interactionMessage = dinerActivated ? 'ORDER READY  //  ICED COFFEE SERVED' : 'COASTLINE DINER  //  COME AGAIN';
    } else if (justPressed && nearDoor) {
      interactionMessage = 'COASTLINE DINER  //  WALK THROUGH THE OPEN DOOR';
    }
    if (nearCounter) return dinerActivated ? 'ORDER READY  ·  PRESS F TO ORDER AGAIN' : 'PRESS F  ·  ORDER COFFEE';
    if (nearDoor) return 'COASTLINE DINER  ·  WALK INSIDE';
    if (interactionMessage && insideDiner) return interactionMessage;
    return '';
  };

  root.updateMatrixWorld(true);
  return {
    root,
    player,
    collisionBoxes,
    update: (_dt, elapsed) => {
      for (const item of animated) item.object.position.y = item.baseY + Math.sin(elapsed * 1.6 + item.phase) * item.amplitude;
    },
    interact,
  };
}
