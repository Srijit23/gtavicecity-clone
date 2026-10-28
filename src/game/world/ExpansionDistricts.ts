import * as THREE from 'three';

export interface ExpansionDistrictBundle {
  update(dt: number, focus: THREE.Vector3): void;
}

type HousePlacement = {
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  roofHeight: number;
  rotation: number;
  seed: number;
};

type CullZone = {
  root: THREE.Group;
  details?: THREE.Group;
  center: THREE.Vector3;
  radius: number;
};

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const wallPalette = ['#e9c9a4', '#d8ad91', '#b8c9c0', '#d9d0b8', '#d4a3a0', '#c0b2d8', '#c5d6dc'];
const roofPalette = ['#785247', '#9b6553', '#4a5660', '#7b6c61', '#554a50'];
const lawnPalette = ['#64875a', '#78945d', '#829c65', '#6d8b64'];
const windowPalette = ['#375568', '#2c4657', '#4e6b79'];

const expansionMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const material = (color: THREE.ColorRepresentation, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial => {
  const key = `${new THREE.Color(color).getHexString()}|${roughness}|${metalness}`;
  const cached = expansionMaterialCache.get(key);
  if (cached) return cached;
  const created = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  expansionMaterialCache.set(key, created);
  return created;
};


function createSurfaceTexture(kind: 'stucco' | 'roof'): THREE.CanvasTexture | undefined {
  const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
  const ctx=canvas.getContext('2d'); if(!ctx) return undefined;
  let seed=9081;
  const random=():number=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(kind==='stucco'){
    ctx.fillStyle='#bcb5a9';ctx.fillRect(0,0,128,128);
    for(let i=1700;i>0;i--){const v=Math.floor(120+random()*100);ctx.fillStyle='rgba('+v+','+(v-4)+','+(v-10)+','+(0.025+random()*0.1)+')';ctx.fillRect(random()*128,random()*128,1+random()*2,1+random()*2);}
    ctx.strokeStyle='rgba(74,62,52,0.12)';ctx.lineWidth=1;for(let y=32;y<128;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}
  } else {
    ctx.fillStyle='#514b48';ctx.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=12){const offset=(Math.floor(y/12)%2)*10;for(let x=-10;x<138;x+=20){const v=55+Math.floor(random()*28);ctx.fillStyle='rgb('+v+','+(v-4)+','+(v-7)+')';ctx.fillRect(x+offset,y,18,10);ctx.strokeStyle='rgba(20,18,18,0.38)';ctx.strokeRect(x+offset,y,18,10);}}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(kind==='roof'?2:1.4,kind==='roof'?2:1.4);texture.anisotropy=2;return texture;
}


function createAsphaltTexture(): THREE.CanvasTexture | undefined {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return undefined;ctx.fillStyle='#35383b';ctx.fillRect(0,0,128,128);
  let seed=5519;const rand=():number=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<4200;i++){const v=Math.floor(42+rand()*34);ctx.fillStyle='rgba('+v+','+v+','+(v+2)+','+(0.12+rand()*0.28)+')';ctx.fillRect(rand()*128,rand()*128,1,1);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(8,8);texture.anisotropy=2;return texture;
}

function random01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967295;
}

function transform(position: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3): THREE.Matrix4 {
  return new THREE.Matrix4().compose(position, rotation, scale);
}

function roofGeometry(): THREE.BufferGeometry {
  // A normalized, five-sided gable roof prism. One shared geometry serves every house.
  const vertices = new Float32Array([
    // left roof plane
    -0.5, 0, -0.5,  -0.5, 0, 0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, 0.5,  0, 1, -0.5,
    // right roof plane
    0, 1, -0.5,  0, 1, 0.5,  0.5, 0, 0.5,
    0, 1, -0.5,  0.5, 0, 0.5,  0.5, 0, -0.5,
    // front and rear gable ends
    -0.5, 0, 0.5,  0.5, 0, 0.5,  0, 1, 0.5,
    -0.5, 0, -0.5,  0, 1, -0.5,  0.5, 0, -0.5,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addInstances(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  matrices: THREE.Matrix4[],
  colors?: THREE.Color[],
): THREE.InstancedMesh | undefined {
  if (!matrices.length) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
  mesh.name = name;
  matrices.forEach((matrix, index) => {
    mesh.setMatrixAt(index, matrix);
    if (colors?.[index]) mesh.setColorAt(index, colors[index]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function placeBox(
  parent: THREE.Object3D,
  name: string,
  position: THREE.Vector3,
  size: THREE.Vector3,
  mat: THREE.Material,
  obstacle = false,
  collisionBoxes?: THREE.Box3[],
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry, mat);
  mesh.name = name;
  mesh.position.copy(position).add(new THREE.Vector3(0, size.y / 2, 0));
  mesh.scale.copy(size);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.playerCollision = obstacle;
  mesh.userData.cameraObstacle = obstacle;
  parent.add(mesh);
  if (obstacle && collisionBoxes) {
    mesh.updateMatrixWorld(true);
    collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
  }
  return mesh;
}

function pushTransform(
  matrices: THREE.Matrix4[],
  colors: THREE.Color[],
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  color: THREE.ColorRepresentation,
): void {
  matrices.push(transform(position, rotation, scale));
  colors.push(new THREE.Color(color));
}

function makeHousingZone(
  parent: THREE.Object3D,
  collisionBoxes: THREE.Box3[],
  name: string,
  houses: HousePlacement[],
  center: THREE.Vector3,
  radius = 180,
): CullZone {
  const root = new THREE.Group();
  root.name = name;
  parent.add(root);
  const details = new THREE.Group();
  details.name = name + ' near-detail LOD';
  root.add(details);

  const shells: THREE.Matrix4[] = [], shellColors: THREE.Color[] = [];
  const foundations: THREE.Matrix4[] = [];
  const roofs: THREE.Matrix4[] = [], roofColors: THREE.Color[] = [];
  const lawns: THREE.Matrix4[] = [], lawnColors: THREE.Color[] = [];
  const driveways: THREE.Matrix4[] = [];
  const windowFrames: THREE.Matrix4[] = [], windowPanes: THREE.Matrix4[] = [];
  const doors: THREE.Matrix4[] = [], porchCanopies: THREE.Matrix4[] = [], porchPillars: THREE.Matrix4[] = [];
  const bushes: THREE.Matrix4[] = [], bushColors: THREE.Color[] = [];
  const roofGeo = roofGeometry();

  for (const house of houses) {
    const { x, z, width, depth, wallHeight, roofHeight, rotation, seed } = house;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    const at = (lx: number, y: number, lz: number): THREE.Vector3 =>
      new THREE.Vector3(lx, y, lz).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
    const size = (sx: number, sy: number, sz: number): THREE.Vector3 => new THREE.Vector3(sx, sy, sz);
    const houseColor = wallPalette[Math.floor(random01(seed) * wallPalette.length)];
    const roofColor = roofPalette[Math.floor(random01(seed + 4) * roofPalette.length)];
    const lawnColor = lawnPalette[Math.floor(random01(seed + 8) * lawnPalette.length)];

    pushTransform(shells, shellColors, at(0, wallHeight / 2, 0), q, size(width, wallHeight, depth), houseColor);
    foundations.push(transform(at(0, 0.16, 0), q, size(width + 0.55, 0.32, depth + 0.55)));
    pushTransform(roofs, roofColors, at(0, wallHeight, 0), q, size(width + 0.8, roofHeight, depth + 0.8), roofColor);
    pushTransform(lawns, lawnColors, at(0, 0.025, 0), q, size(width + 11, 0.045, depth + 13), lawnColor);

    const front = depth / 2 + 0.055;
    const frontDirection = rotation === 0 ? 1 : -1;
    pushTransform(driveways, [], at(0, 0.04, frontDirection * (depth / 2 + 4.3)), q, size(3.5, 0.06, 6.2), '#9e9c93');

    // Front windows, entrance, porch roof and columns are separate shared instances.
    for (const lx of [-width * 0.24, width * 0.24]) {
      windowFrames.push(transform(at(lx, wallHeight * 0.58, front), q, size(1.28, 1.38, 0.13)));
      windowPanes.push(transform(at(lx, wallHeight * 0.58, front + frontDirection * 0.075), q, size(1.02, 1.12, 0.06)));
    }
    doors.push(transform(at(0, Math.min(1.08, wallHeight * 0.29), front), q, size(0.9, Math.min(2.1, wallHeight * 0.48), 0.14)));
    porchCanopies.push(transform(at(0, wallHeight * 0.57, frontDirection * (depth / 2 + 0.72)), q, size(3.3, 0.2, 1.05)));
    for (const lx of [-1.4, 1.4]) {
      porchPillars.push(transform(at(lx, wallHeight * 0.27, frontDirection * (depth / 2 + 0.72)), q, size(0.14, wallHeight * 0.54, 0.14)));
    }
    for (const lx of [-width * 0.43, width * 0.43]) {
      bushes.push(transform(at(lx, 0.62, frontDirection * (depth / 2 + 3.4)), q, size(1.2, 1.0, 1.2)));
      bushColors.push(new THREE.Color(lawnPalette[Math.floor(random01(seed + lx * 13 + 17) * lawnPalette.length)]));
    }

    const halfX = Math.abs(Math.cos(rotation)) * width / 2 + Math.abs(Math.sin(rotation)) * depth / 2;
    const halfZ = Math.abs(Math.sin(rotation)) * width / 2 + Math.abs(Math.cos(rotation)) * depth / 2;
    collisionBoxes.push(new THREE.Box3(
      new THREE.Vector3(x - halfX, 0, z - halfZ),
      new THREE.Vector3(x + halfX, wallHeight + roofHeight, z + halfZ),
    ));
  }

  const shellMat = material('#ffffff', 0.92);
  const roofMat = material('#ffffff', 0.94);
  const stuccoTexture = createSurfaceTexture('stucco');
  const roofTexture = createSurfaceTexture('roof');
  if (stuccoTexture) shellMat.map = stuccoTexture;
  if (roofTexture) roofMat.map = roofTexture;
  shellMat.needsUpdate = true;
  roofMat.needsUpdate = true;
  const frameMat = material('#e9ddc6', 0.68);
  const paneMat = material(windowPalette[0], 0.3, 0.12);
  const doorMat = material('#78533e', 0.9);
  const canopyMat = material('#e6d7bc', 0.8);
  const pillarMat = material('#ece1cd', 0.75);
  const lawnMat = material('#ffffff', 1);
  const drivewayMat = material('#9c9b94', 0.96);
  const bushMat = material('#ffffff', 0.96);

  addInstances(root, name + ' foundations', boxGeometry, material('#b8aa98'), foundations);
  const shellInstances = addInstances(root, name + ' house shells', boxGeometry, shellMat, shells, shellColors);
  if (shellInstances) shellInstances.userData.cameraObstacle = true;
  const roofInstances = addInstances(root, name + ' pitched roofs', roofGeo, roofMat, roofs, roofColors);
  if (roofInstances) roofInstances.userData.cameraObstacle = true;
  addInstances(root, root.name + ' gardens', boxGeometry, lawnMat, lawns, lawnColors);
  addInstances(root, root.name + ' driveways', boxGeometry, drivewayMat, driveways);
  addInstances(details, root.name + ' window frames', boxGeometry, frameMat, windowFrames);
  addInstances(details, root.name + ' blue glass', boxGeometry, paneMat, windowPanes);
  addInstances(details, root.name + ' entrance doors', boxGeometry, doorMat, doors);
  addInstances(details, root.name + ' porch canopies', boxGeometry, canopyMat, porchCanopies);
  addInstances(details, root.name + ' porch columns', boxGeometry, pillarMat, porchPillars);
  addInstances(details, root.name + ' garden shrubs', new THREE.SphereGeometry(1, 7, 5), bushMat, bushes, bushColors);
  return { root, details, center, radius };
}

function addApartmentBlock(
  parent: THREE.Object3D,
  collisionBoxes: THREE.Box3[],
  x: number,
  z: number,
  floors: number,
  color: THREE.ColorRepresentation,
): void {
  const root = new THREE.Group();
  root.name = 'Low-poly apartment block';
  parent.add(root);
  const width = 18 + (floors % 2) * 2;
  const depth = 19;
  const height = floors * 3.15;
  placeBox(root, 'Apartment main volume', new THREE.Vector3(x, 0, z), new THREE.Vector3(width, height, depth), material(color, 0.82), true, collisionBoxes);
  placeBox(root, 'Apartment roof parapet', new THREE.Vector3(x, height, z), new THREE.Vector3(width + 0.8, 0.55, depth + 0.8), material('#e1d1b6', 0.72));
  placeBox(root, 'Apartment front balcony band', new THREE.Vector3(x, 1.2, z + depth / 2 + 0.25), new THREE.Vector3(width + 0.6, 0.2, 0.65), material('#d6c5ad', 0.78));
  for (let floor = 0; floor < floors; floor += 1) {
    const y = 2.0 + floor * 3.15;
    for (const side of [-1, 1]) {
      placeBox(root, 'Balcony slab', new THREE.Vector3(x + side * 4.3, y - 0.62, z + depth / 2 + 0.7), new THREE.Vector3(3.6, 0.15, 1.2), material('#d9d0bd', 0.76));
      placeBox(root, 'Apartment window', new THREE.Vector3(x + side * 4.3, y, z + depth / 2 + 0.34), new THREE.Vector3(1.8, 1.5, 0.12), material('#3c596c', 0.26, 0.1));
      placeBox(root, 'Balcony end post', new THREE.Vector3(x + side * 5.8, y - 0.1, z + depth / 2 + 1.1), new THREE.Vector3(0.12, 1.0, 0.12), material('#e8dec9', 0.68));
    }
  }
  // A recessed central entrance makes the front facade legible at medium distance.
  placeBox(root, 'Apartment entry', new THREE.Vector3(x, 0.1, z + depth / 2 + 0.11), new THREE.Vector3(2.1, 2.35, 0.12), material('#755540', 0.82));
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = true;
    }
  });
}

function addShop(
  parent: THREE.Object3D,
  collisionBoxes: THREE.Box3[],
  x: number,
  z: number,
  facade: THREE.ColorRepresentation,
  sign: THREE.ColorRepresentation,
): void {
  const root = new THREE.Group();
  root.name = 'Small commercial storefront';
  parent.add(root);
  placeBox(root, 'Shop body', new THREE.Vector3(x, 0, z), new THREE.Vector3(15, 5.6, 10), material(facade, 0.78), true, collisionBoxes);
  placeBox(root, 'Flat shop roof cap', new THREE.Vector3(x, 5.6, z), new THREE.Vector3(15.5, 0.32, 10.5), material('#e8d5b9', 0.72));
  placeBox(root, 'Storefront glazing frame', new THREE.Vector3(x, 1.65, z + 5.08), new THREE.Vector3(11.8, 2.7, 0.15), material('#ead9c4', 0.65));
  placeBox(root, 'Storefront glass', new THREE.Vector3(x, 1.7, z + 5.18), new THREE.Vector3(10.8, 2.2, 0.08), material('#355469', 0.25, 0.08));
  placeBox(root, 'Store signboard', new THREE.Vector3(x, 4.4, z + 5.2), new THREE.Vector3(8.6, 0.85, 0.22), new THREE.MeshStandardMaterial({ color: sign, roughness: 0.55, emissive: sign, emissiveIntensity: 0.12 }));
  placeBox(root, 'Shop awning', new THREE.Vector3(x, 3.25, z + 5.85), new THREE.Vector3(12.5, 0.28, 1.0), material(sign, 0.72));
  for (const side of [-1, 1]) {
    placeBox(root, 'Awning support', new THREE.Vector3(x + side * 5.6, 2.0, z + 5.85), new THREE.Vector3(0.12, 2.5, 0.12), material('#e8d7c3', 0.72));
  }
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = true;
    }
  });
}

function addCampusAndPark(parent: THREE.Object3D, collisionBoxes: THREE.Box3[]): void {
  const campus = new THREE.Group();
  campus.name = 'School campus and sports court';
  parent.add(campus);
  const concrete = material('#c7bca8', 0.94);
  const courtBlue = material('#477f96', 0.86);
  const courtLine = new THREE.MeshBasicMaterial({ color: '#f4e7c7' });
  const grass = material('#718e60', 1);
  const schoolWall = material('#e2d0ac', 0.88);
  const roof = material('#9b6553', 0.9);
  placeBox(campus, 'School forecourt', new THREE.Vector3(-361, 0, 0), new THREE.Vector3(34, 0.08, 28), concrete);
  placeBox(campus, 'School main wing', new THREE.Vector3(-361, 0, -1.5), new THREE.Vector3(26, 7.6, 13), schoolWall, true, collisionBoxes);
  placeBox(campus, 'School pitched roof mass', new THREE.Vector3(-361, 7.6, -1.5), new THREE.Vector3(27, 0.35, 14), roof);
  placeBox(campus, 'School entrance portico', new THREE.Vector3(-361, 2.7, 5.3), new THREE.Vector3(7.8, 0.3, 2.5), roof);
  for (const x of [-370, -365, -357, -352]) {
    placeBox(campus, 'School classroom window', new THREE.Vector3(x, 3.5, 5.12), new THREE.Vector3(1.7, 1.7, 0.12), material('#355569', 0.26, 0.08));
  }
  placeBox(campus, 'School playground turf', new THREE.Vector3(-361, 0, 24), new THREE.Vector3(31, 0.06, 15), grass);
  placeBox(campus, 'Sports court base', new THREE.Vector3(-361, 0.08, 24), new THREE.Vector3(18, 0.05, 10), courtBlue);
  placeBox(campus, 'Court center stripe', new THREE.Vector3(-361, 0.15, 24), new THREE.Vector3(0.12, 0.015, 9), courtLine);
  for (const x of [-369, -353]) {
    placeBox(campus, 'Court boundary line', new THREE.Vector3(x, 0.15, 24), new THREE.Vector3(0.08, 0.015, 9), courtLine);
  }
  for (const z of [19.5, 28.5]) {
    placeBox(campus, 'Court touchline', new THREE.Vector3(-361, 0.15, z), new THREE.Vector3(16, 0.015, 0.08), courtLine);
  }
  for (const x of [-374, -348]) {
    placeBox(campus, 'School boundary post', new THREE.Vector3(x, 0, 7), new THREE.Vector3(0.25, 1.2, 36), material('#d7c8b2', 0.8));
  }

  const apartments = new THREE.Group();
  apartments.name = 'Apartment and housing complex district';
  parent.add(apartments);
  addApartmentBlock(apartments, collisionBoxes, -201, -3, 4, '#d6c1a4');
  addApartmentBlock(apartments, collisionBoxes, -281, 77, 3, '#b8c8c4');
  addApartmentBlock(apartments, collisionBoxes, -201, 77, 5, '#d2adb0');

  const commercial = new THREE.Group();
  commercial.name = 'Westside commercial high street';
  parent.add(commercial);
  addShop(commercial, collisionBoxes, -122, -53, '#e6c6a5', '#e9a4a0');
  addShop(commercial, collisionBoxes, -205, -53, '#c2d0c8', '#f1d08d');
  addShop(commercial, collisionBoxes, -287, -53, '#d6b4bf', '#8acbc5');

  const park = new THREE.Group();
  park.name = 'Central recreation park and pool';
  parent.add(park);
  placeBox(park, 'Park lawn', new THREE.Vector3(-281, 0, 240), new THREE.Vector3(42, 0.06, 40), grass);
  placeBox(park, 'Park perimeter path north', new THREE.Vector3(-281, 0.08, 260), new THREE.Vector3(42, 0.12, 1.8), concrete);
  placeBox(park, 'Park perimeter path south', new THREE.Vector3(-281, 0.08, 220), new THREE.Vector3(42, 0.12, 1.8), concrete);
  placeBox(park, 'Park walkway west', new THREE.Vector3(-302, 0.08, 240), new THREE.Vector3(1.8, 0.12, 40), concrete);
  placeBox(park, 'Park walkway east', new THREE.Vector3(-260, 0.08, 240), new THREE.Vector3(1.8, 0.12, 40), concrete);
  placeBox(park, 'Pool deck', new THREE.Vector3(-281, 0.09, 240), new THREE.Vector3(18, 0.08, 12), concrete);
  placeBox(park, 'Pool water inset', new THREE.Vector3(-281, 0.18, 240), new THREE.Vector3(12, 0.035, 7), new THREE.MeshStandardMaterial({ color: '#37a9c4', roughness: 0.22, metalness: 0.18 }));
  for (const [x, z, angle] of [[-295, 232, 0], [-267, 232, Math.PI], [-295, 250, 0], [-267, 250, Math.PI]] as const) {
    const bench = placeBox(park, 'Park bench seat', new THREE.Vector3(x, 0.45, z), new THREE.Vector3(2.2, 0.14, 0.55), material('#8a5c42', 0.85));
    bench.rotation.y = angle;
    placeBox(park, 'Park bench legs', new THREE.Vector3(x, 0.1, z), new THREE.Vector3(0.12, 0.5, 0.12), material('#4d5960', 0.5, 0.35));
  }

  // Small playground equipment and park trees are instanced/shared rather than hundreds of individual parts.
  placeBox(park, 'Playground platform', new THREE.Vector3(-292, 0.9, 252), new THREE.Vector3(2.2, 1.8, 2.0), material('#d7bd94', 0.85));
  placeBox(park, 'Playground roof canopy', new THREE.Vector3(-292, 2.9, 252), new THREE.Vector3(3.2, 0.18, 3.0), material('#d36f63', 0.76));
  for (const x of [-293, -291]) {
    placeBox(park, 'Playground support', new THREE.Vector3(x, 0.0, 251), new THREE.Vector3(0.12, 2.8, 0.12), material('#b7b6a9', 0.7, 0.12));
  }
  const slide = placeBox(park, 'Playground slide ramp', new THREE.Vector3(-288.5, 0.48, 252), new THREE.Vector3(0.95, 0.14, 3.4), material('#66a9bf', 0.58, 0.12));
  slide.rotation.x = -0.35;
  for (const x of [-270, -265]) {
    placeBox(park, 'Swing set post', new THREE.Vector3(x, 0, 253), new THREE.Vector3(0.13, 2.8, 0.13), material('#596d7a', 0.55, 0.22));
  }
  placeBox(park, 'Swing set top bar', new THREE.Vector3(-267.5, 2.7, 253), new THREE.Vector3(5.5, 0.14, 0.14), material('#596d7a', 0.55, 0.22));
  for (const x of [-269, -266]) {
    placeBox(park, 'Swing chain', new THREE.Vector3(x, 1.5, 253), new THREE.Vector3(0.05, 2.1, 0.05), material('#606b75', 0.5, 0.25));
    placeBox(park, 'Swing seat', new THREE.Vector3(x, 0.42, 253), new THREE.Vector3(0.9, 0.12, 0.45), material('#d28b66', 0.75));
  }
  const parkTreeTrunks: THREE.Matrix4[] = [], parkCanopies: THREE.Matrix4[] = [], parkTreeColors: THREE.Color[] = [];
  for (const [x, z] of [[-299, 225], [-263, 225], [-299, 255], [-263, 255], [-281, 263], [-281, 217]] as const) {
    parkTreeTrunks.push(transform(new THREE.Vector3(x, 1.5, z), new THREE.Quaternion(), new THREE.Vector3(0.58, 3.0, 0.58)));
    parkCanopies.push(transform(new THREE.Vector3(x, 4.0, z), new THREE.Quaternion(), new THREE.Vector3(2.3, 4.0, 2.3)));
    parkTreeColors.push(new THREE.Color(lawnPalette[Math.floor(random01(Math.round(x * 17 + z)) * lawnPalette.length)]));
  }
  addInstances(park, 'Park instanced tree trunks', new THREE.CylinderGeometry(0.35, 0.5, 1, 6), material('#795d45', 0.95), parkTreeTrunks);
  addInstances(park, 'Park instanced tree crowns', new THREE.ConeGeometry(1, 1, 7), material('#ffffff', 0.98), parkCanopies, parkTreeColors);

  const warehouse = new THREE.Group();
  warehouse.name = 'Light industrial and storage yard';
  parent.add(warehouse);
  placeBox(warehouse, 'Warehouse main hall', new THREE.Vector3(-360, 0, -240), new THREE.Vector3(27, 7, 26), material('#b7b8b0', 0.91), true, collisionBoxes);
  placeBox(warehouse, 'Warehouse shallow roof', new THREE.Vector3(-360, 7, -240), new THREE.Vector3(28, 0.3, 27), material('#65717b', 0.66, 0.25));
  placeBox(warehouse, 'Warehouse roller door', new THREE.Vector3(-360, 1.5, -226.8), new THREE.Vector3(7, 3, 0.12), material('#455866', 0.65, 0.25));
  placeBox(warehouse, 'Warehouse loading canopy', new THREE.Vector3(-360, 4.5, -224), new THREE.Vector3(12, 0.24, 2.5), material('#697781', 0.68, 0.22));
  for (const side of [-1, 1]) {
    placeBox(warehouse, 'Warehouse loading pillar', new THREE.Vector3(-360 + side * 5.4, 2.1, -224), new THREE.Vector3(0.18, 4.2, 0.18), material('#e0d7c5'));
  }
}

export function createExpansionDistricts(parent: THREE.Group, collisionBoxes: THREE.Box3[]): ExpansionDistrictBundle {
  const cullZones: CullZone[] = [];
  const roads = new THREE.Group();
  roads.name = 'Expanded connected road network';
  parent.add(roads);
  const roadMat = material('#35383b', 0.98);
  const asphaltTexture = createAsphaltTexture();
  if (asphaltTexture) roadMat.map = asphaltTexture;
  roadMat.needsUpdate = true;
  const sidewalkMat = material('#cbbda8', 0.96);
  const laneMat = new THREE.MeshBasicMaterial({ color: '#f6f5f0' });
  const roadMatrices: THREE.Matrix4[] = [];
  const sidewalkMatrices: THREE.Matrix4[] = [];
  const markingMatrices: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const addRoad = (x: number, z: number, width: number, length: number, vertical: boolean): void => {
    // Box dimensions stay in world axes: north-south roads are narrow in X, cross streets narrow in Z.
    const roadScale = vertical ? new THREE.Vector3(width, 0.12, length) : new THREE.Vector3(length, 0.12, width);
    roadMatrices.push(transform(new THREE.Vector3(x, 0.06, z), q, roadScale));
    for (const side of [-1, 1]) {
      const offset = width / 2 + 1.55;
      const sx = vertical ? x + side * offset : x;
      const sz = vertical ? z : z + side * offset;
      const sidewalkScale = vertical ? new THREE.Vector3(1.5, 0.2, length) : new THREE.Vector3(length, 0.2, 1.5);
      sidewalkMatrices.push(transform(new THREE.Vector3(sx, 0.12, sz), q, sidewalkScale));
    }
    if (vertical) {
      for (let t = -length / 2 + 8; t <= length / 2 - 8; t += 13) {
        markingMatrices.push(transform(new THREE.Vector3(x, 0.132, z + t), q, new THREE.Vector3(0.13, 0.018, 4.4)));
      }
    } else {
      for (let t = -length / 2 + 8; t <= length / 2 - 8; t += 13) {
        markingMatrices.push(transform(new THREE.Vector3(x + t, 0.132, z), q, new THREE.Vector3(4.4, 0.018, 0.13)));
      }
    }
  };

  // Nine connected north-south collectors and regular east-west streets form a readable road hierarchy.
  for (const x of [-800, -720, -640, -560, -480, -400, -320, -240, -160, -80]) addRoad(x, 0, 8.5, 740, true);
  for (const z of [-360, -280, -200, -120, -87, -34, 19, 73, 120, 200, 280, 360]) {
    // Existing central cross streets already cover -98..0 at these four rows; stop exactly at their west edge to avoid coplanar overlap.
    // Join the exact west edge of each existing central cross street; other streets meet the main boulevard at x=0.
    const centralRoadWestEdge: Record<number, number> = { [-87]: -93, [-34]: -98, [19]: -6, [73]: -90.5 };
    const startX = -820;
    const endX = centralRoadWestEdge[z] ?? 0;
    addRoad((startX + endX) / 2, z, 9.0, endX - startX, false);
  }
  addInstances(roads, 'Collector road asphalt', boxGeometry, roadMat, roadMatrices);
  addInstances(roads, 'Collector sidewalks', boxGeometry, sidewalkMat, sidewalkMatrices);
  addInstances(roads, 'Road center dashes', boxGeometry, laneMat, markingMatrices);

  const northNear: HousePlacement[] = [], northMid: HousePlacement[] = [], northFar: HousePlacement[] = [];
  const southNear: HousePlacement[] = [], southMid: HousePlacement[] = [], southFar: HousePlacement[] = [];
  let seed = 100;
  for (const z of [-320, -240, -160, -100, 100, 160, 240, 320]) {
    for (const x of [-120, -200, -280, -360, -440, -520, -600, -680, -760]) {
      // The park, school, apartments and warehouse take the most prominent corner lots.
      if ((x === -280 && z === 240) || (x === -200 && z === 100) || (x === -280 && z === 100)
          || (x === -360 && z === -240)) continue;
      const rotation = z < 0 ? 0 : Math.PI;
      const width = 10.5 + random01(seed + 1) * 2.4;
      const depth = 9.2 + random01(seed + 2) * 2.1;
      const wallHeight = 3.9 + random01(seed + 3) * 1.2;
      const roofHeight = 2.0 + random01(seed + 4) * 1.4;
      const house = { x, z, width, depth, wallHeight, roofHeight, rotation, seed };
      const area = x >= -400 ? 'near' : x >= -600 ? 'mid' : 'far';
      if (z < 0) (area === 'near' ? southNear : area === 'mid' ? southMid : southFar).push(house);
      else (area === 'near' ? northNear : area === 'mid' ? northMid : northFar).push(house);
      seed += 13;
    }
  }

  // Six coarse residential chunks: shared instancing limits draw calls, while detail groups can be culled independently.
  cullZones.push(
    makeHousingZone(parent, collisionBoxes, 'North residential neighborhood · east', northNear, new THREE.Vector3(-240, 0, 230), 220),
    makeHousingZone(parent, collisionBoxes, 'North residential neighborhood · west', northMid, new THREE.Vector3(-480, 0, 230), 150),
    makeHousingZone(parent, collisionBoxes, 'North residential neighborhood · outer', northFar, new THREE.Vector3(-680, 0, 230), 180),
    makeHousingZone(parent, collisionBoxes, 'South residential neighborhood · east', southNear, new THREE.Vector3(-240, 0, -230), 220),
    makeHousingZone(parent, collisionBoxes, 'South residential neighborhood · west', southMid, new THREE.Vector3(-480, 0, -230), 150),
    makeHousingZone(parent, collisionBoxes, 'South residential neighborhood · outer', southFar, new THREE.Vector3(-680, 0, -230), 180),
  );

  const publicFacilities = new THREE.Group();
  publicFacilities.name = 'Public facilities and recreation';
  parent.add(publicFacilities);
  addCampusAndPark(publicFacilities, collisionBoxes);
  const specialZones: CullZone[] = [
    { root: publicFacilities, center: new THREE.Vector3(-310, 0, 100), radius: 200 },
  ];
  cullZones.push(...specialZones);

  let elapsed = 0;
  let cullClock = 0;
  let lastFocus = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  return {
    update(dt: number, focus: THREE.Vector3): void {
      elapsed += dt;
      cullClock += dt;
      if (cullClock < 0.25 && lastFocus.distanceToSquared(focus) < 36) return;
      cullClock = 0;
      lastFocus.copy(focus);
      for (const zone of cullZones) {
        const distance = Math.sqrt(zone.center.distanceToSquared(focus));
        zone.root.visible = distance < 650 + zone.radius;
        if (zone.details) zone.details.visible = distance < 500 + zone.radius * 0.25;
      }
      // Keep the roots stable and only change visibility at a quarter-second cadence.
      void elapsed;
    },
  };
}
