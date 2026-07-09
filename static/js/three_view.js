// Upgraded Three.js 3D Graphics View Engine with PBR Materials & Custom Geometry

let threeScene, threeCamera, threeRenderer, threeControls, threeTransformControls;
let threeContainer;
let isThreeInitialized = false;

// PBR Material Library
let PBRMaterials = {};

function initThree() {
  threeContainer = document.getElementById('three-container');
  if (!threeContainer) return;

  // 1. Scene setup
  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color('#f5f5f7');

  // 2. Camera setup
  threeCamera = new THREE.PerspectiveCamera(45, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 1000);
  threeCamera.position.set(0, 12, 12);

  // 3. Renderer setup (with preserveDrawingBuffer: true for exporter snapshots)
  threeRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  threeRenderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeRenderer.toneMappingExposure = 1.0;
  threeContainer.appendChild(threeRenderer.domElement);

  // 4. Controls setup
  threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
  threeControls.enableDamping = true;
  threeControls.dampingFactor = 0.05;
  threeControls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going below floor
  threeControls.minDistance = 1;
  threeControls.maxDistance = 60;

  // 5. Initialize PBR Materials
  initPBRMaterials();

  // 6. Lighting setup
  setupLighting();

  // 6.5. Transform Controls Setup
  if (typeof THREE.TransformControls !== 'undefined') {
    threeTransformControls = new THREE.TransformControls(threeCamera, threeRenderer.domElement);
    threeTransformControls.size = 0.75;
    threeScene.add(threeTransformControls);

    threeTransformControls.addEventListener('dragging-changed', (event) => {
      threeControls.enabled = !event.value;
    });

    threeTransformControls.addEventListener('change', () => {
      const targetObj = threeTransformControls.object;
      if (targetObj && targetObj.userData && targetObj.userData.itemIndex !== undefined) {
        const idx = targetObj.userData.itemIndex;
        const item = State.placedItems[idx];
        if (item) {
          const scale = (State.blueprintData && State.blueprintData.metadata) ? State.blueprintData.metadata.scale_pixels_per_meter : 60.0;
          const canvasCoords = toCanvasCoords(targetObj.position.x, targetObj.position.z, scale);
          item.x = Math.round(canvasCoords.x - item.width / 2);
          item.y = Math.round(canvasCoords.y - item.height / 2);
          item.rotation = targetObj.rotation.y;
          
          redraw();
          State.saveState();
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!threeTransformControls) return;
      if (e.key === 't' || e.key === 'T' || e.key === 'w' || e.key === 'W') {
        threeTransformControls.setMode('translate');
        Exporter.showNotification("✋ Move Mode active");
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'e' || e.key === 'E') {
        threeTransformControls.setMode('rotate');
        Exporter.showNotification("🔄 Rotate Mode active");
      }
    });
  } else {
    console.warn("THREE.TransformControls is not defined. Desktop drag/rotate is disabled.");
  }

  // 7. Raycaster click-to-select furniture in 3D
  setup3DSelection();

  isThreeInitialized = true;
  animateThree();
}

function setupLighting() {
  // Ambient illumination
  const ambient = new THREE.AmbientLight('#ffffff', 0.45);
  threeScene.add(ambient);

  // Sun Light
  const sun = new THREE.DirectionalLight('#fffdf0', 0.85);
  sun.position.set(15, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  
  const d = 18;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0006;
  threeScene.add(sun);

  // Sky hemispheric reflection light
  const hemi = new THREE.HemisphereLight('#e1f5fe', '#fff8e1', 0.3);
  threeScene.add(hemi);
}

// Generate PBR texture maps procedurally for offline capability & zero load latency
function createProceduralPBR(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = 512;
  normalCanvas.height = 512;
  const nCtx = normalCanvas.getContext('2d');
  nCtx.fillStyle = '#8080ff'; // base normal vector pointing straight up [0.5, 0.5, 1.0]
  nCtx.fillRect(0, 0, 512, 512);

  let colorTex, normalTex, roughnessVal = 0.5, metalnessVal = 0.1;

  if (type === 'wood') {
    // Oak Wood Planks
    ctx.fillStyle = '#b58a58';
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw wood grain lines
    ctx.fillStyle = '#9e7343';
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * 512;
      ctx.fillRect(0, y, 512, 1 + Math.random() * 2);
    }
    
    // Draw plank joint seams
    ctx.strokeStyle = '#6e4c27';
    ctx.lineWidth = 2;
    nCtx.strokeStyle = '#6060ff'; // recessed normal joints
    nCtx.lineWidth = 2;
    for (let x = 0; x < 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      nCtx.beginPath(); nCtx.moveTo(x, 0); nCtx.lineTo(x, 512); nCtx.stroke();
    }
    roughnessVal = 0.35;
    
  } else if (type === 'marble') {
    // Polished Carrara Marble
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw organic veins
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let cx = Math.random() * 512, cy = 0;
      ctx.moveTo(cx, cy);
      while (cy < 512) {
        cx += (Math.random() - 0.5) * 30;
        cy += Math.random() * 40;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    roughnessVal = 0.05; // extremely glossy mirror reflection
    metalnessVal = 0.15;
    
  } else if (type === 'concrete') {
    // Brutalist Concrete
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw noise spots
    ctx.fillStyle = 'rgba(80, 80, 80, 0.15)';
    for (let i = 0; i < 2000; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 2);
      
      nCtx.fillStyle = Math.random() > 0.5 ? '#8888ff' : '#7878ff';
      nCtx.fillRect(rx, ry, 2, 2);
    }
    roughnessVal = 0.85; // rough finish
    
  } else if (type === 'brick') {
    // Exposed brick walls
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(0, 0, 512, 512);
    
    // Brick rows
    ctx.strokeStyle = '#cfd8dc'; // mortar joints
    ctx.lineWidth = 4;
    nCtx.strokeStyle = '#6060ff'; // recessed normals
    nCtx.lineWidth = 4;
    
    const rowH = 32;
    for (let y = 0; y < 512; y += rowH) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      nCtx.beginPath(); nCtx.moveTo(0, y); nCtx.lineTo(512, y); nCtx.stroke();
      
      // Shift brick offsets in alternate rows
      const offset = (y / rowH) % 2 === 0 ? 0 : 64;
      for (let x = offset; x < 512 + 64; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rowH); ctx.stroke();
        nCtx.beginPath(); nCtx.moveTo(x, y); nCtx.lineTo(x, y + rowH); nCtx.stroke();
      }
    }
    roughnessVal = 0.75;
    
  } else if (type === 'tiles') {
    // Ceramic Bathroom Grid Tiles
    ctx.fillStyle = '#e0f7fa'; // cyan glaze
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    nCtx.strokeStyle = '#6060ff';
    nCtx.lineWidth = 3;
    
    for (let c = 0; c < 512; c += 64) {
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(512, c); ctx.stroke();
      
      nCtx.beginPath(); nCtx.moveTo(c, 0); nCtx.lineTo(c, 512); nCtx.stroke();
      nCtx.beginPath(); nCtx.moveTo(0, c); nCtx.lineTo(512, c); nCtx.stroke();
    }
    roughnessVal = 0.12;
  }

  colorTex = new THREE.CanvasTexture(canvas);
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(2, 2);

  normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(2, 2);

  return new THREE.MeshStandardMaterial({
    map: colorTex,
    normalMap: normalTex,
    roughness: roughnessVal,
    metalness: metalnessVal
  });
}

function initPBRMaterials() {
  PBRMaterials.wood = createProceduralPBR('wood');
  PBRMaterials.marble = createProceduralPBR('marble');
  PBRMaterials.concrete = createProceduralPBR('concrete');
  PBRMaterials.brick = createProceduralPBR('brick');
  PBRMaterials.tiles = createProceduralPBR('tiles');

  // Generic secondary materials
  PBRMaterials.plaster = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.8 });
  PBRMaterials.ceiling = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  PBRMaterials.glass = new THREE.MeshPhysicalMaterial({ color: '#e0f7fa', transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.9, thickness: 0.5 });
  PBRMaterials.frame = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.45 });
  PBRMaterials.doorLeaf = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 });
  PBRMaterials.skirting = new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.75 });
  PBRMaterials.roof = new THREE.MeshStandardMaterial({ color: '#78909c', roughness: 0.6 });
}

function animateThree() {
  if (!isThreeInitialized) return;
  requestAnimationFrame(animateThree);
  
  if (State.viewMode === '3d') {
    if (threeControls && threeControls.enabled) {
      threeControls.update();
    }

    // Smooth door swings in walkthrough walk mode
    if (typeof WebXRManager !== 'undefined' && WebXRManager.isWalkModeActive) {
      WebXRManager.checkInteractiveObjects(threeCamera.position);
    }
    
    threeRenderer.render(threeScene, threeCamera);
  }
}

let houseCenterX = 0;
let houseCenterY = 0;

// Coordinate projection helper
function to3DCoords(x, y, scale) {
  return {
    x: (x - houseCenterX) / scale,
    z: (y - houseCenterY) / scale
  };
}

function toCanvasCoords(x, z, scale) {
  return {
    x: x * scale + houseCenterX,
    y: z * scale + houseCenterY
  };
}

// Build 3D house structure
function build3DHouse() {
  if (!isThreeInitialized) return;

  // Clear previous meshes
  const toRemove = [];
  threeScene.traverse(child => {
    if (child.isMesh && child.name !== 'ground_grid') {
      toRemove.push(child);
    }
  });
  toRemove.forEach(mesh => threeScene.remove(mesh));

  // Base shadow receiver
  const groundGeo = new THREE.PlaneGeometry(120, 120);
  const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.25 });
  const ground = new THREE.Mesh(groundGeo, shadowMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  threeScene.add(ground);

  if (!State.blueprintData) return;

  const scale = (State.blueprintData && State.blueprintData.metadata) ? State.blueprintData.metadata.scale_pixels_per_meter : 60.0;
  
  // Calculate bounding box center of all wall points to center the house in 3D
  if (State.blueprintData.walls.length > 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    State.blueprintData.walls.forEach(w => {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxY = Math.max(maxY, w.y1, w.y2);
    });
    houseCenterX = (minX + maxX) / 2;
    houseCenterY = (minY + maxY) / 2;
  } else {
    houseCenterX = canvas.width / 2;
    houseCenterY = canvas.height / 2;
  }

  const wallHeightM = (State.blueprintData && State.blueprintData.metadata && State.blueprintData.metadata.wall_height_cm || 280) / 100;

  // 1. Render Floors, Concrete Slabs, and Ceilings
  State.blueprintData.rooms.forEach((room, roomIdx) => {
    if (!room.polygon || room.polygon.length === 0) return;
    
    const shape = new THREE.Shape();
    const pt0 = to3DCoords(room.polygon[0][0], room.polygon[0][1], scale);
    shape.moveTo(pt0.x, -pt0.z);

    for (let i = 1; i < room.polygon.length; i++) {
      const pt = to3DCoords(room.polygon[i][0], room.polygon[i][1], scale);
      shape.lineTo(pt.x, -pt.z);
    }
    shape.lineTo(pt0.x, -pt0.z);

    // Get material assignments from state
    const customMat = State.materialsMap.rooms[roomIdx] || {};
    const floorMat = customMat.floor ? PBRMaterials[customMat.floor] : PBRMaterials.wood;
    const ceilMat = customMat.ceiling ? PBRMaterials[customMat.ceiling] : PBRMaterials.ceiling;

    // A. Room Floor Mesh
    const floorGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.001;
    floorMesh.receiveShadow = true;
    floorMesh.userData = { type: 'floor', roomIndex: roomIdx };
    floorMesh.name = 'floor_' + roomIdx;
    threeScene.add(floorMesh);

    // B. Concrete Slab Foundation (30cm thick slab base underneath floor)
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.30, bevelEnabled: false });
    const slabMesh = new THREE.Mesh(slabGeo, PBRMaterials.concrete);
    slabMesh.rotation.x = -Math.PI / 2;
    slabMesh.position.y = -0.02;
    slabMesh.receiveShadow = true;
    threeScene.add(slabMesh);

    // C. Ceiling Mesh (conditional on showCeiling)
    if (State.showCeiling !== false) {
      const ceilingGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
      const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilMat);
      ceilingMesh.rotation.x = -Math.PI / 2;
      ceilingMesh.position.y = wallHeightM;
      ceilingMesh.receiveShadow = true;
      threeScene.add(ceilingMesh);

      // Procedural False Ceiling / Pendant Spotlights
      if (customMat.ceilingStyle === 'wood' || customMat.ceilingStyle === 'gypsum' || customMat.ceilingStyle === 'false') {
        const falseCeilGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        const falseCeilMat = customMat.ceilingStyle === 'wood' ? PBRMaterials.wood : PBRMaterials.plaster;
        const falseCeilMesh = new THREE.Mesh(falseCeilGeo, falseCeilMat);
        falseCeilMesh.rotation.x = -Math.PI / 2;
        falseCeilMesh.position.y = wallHeightM - 0.10;
        falseCeilMesh.receiveShadow = true;
        threeScene.add(falseCeilMesh);
      }

      // Add ceiling LED lighting strip / spotlights
      if (customMat.ledStrip || customMat.spotLights) {
        const ledColor = customMat.ledColor || '#ffd700';
        const spotLight = new THREE.PointLight(ledColor, 0.5, 10);
        const cent = to3DCoords(room.centroid[0], room.centroid[1], scale);
        spotLight.position.set(cent.x, wallHeightM - 0.15, -cent.z);
        spotLight.castShadow = true;
        threeScene.add(spotLight);

        // Spot light bulb representation
        const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 1.5 }));
        bulb.position.set(cent.x, wallHeightM - 0.05, -cent.z);
        threeScene.add(bulb);
      }
    }
  });

  // 2. Render Segmented Walls
  State.blueprintData.walls.forEach(wall => {
    const p1 = to3DCoords(wall.x1, wall.y1, scale);
    const p2 = to3DCoords(wall.x2, wall.y2, scale);
    const wallThickM = (wall.thickness || 15) / 100;
    const wallHeightM = (wall.height || (State.blueprintData && State.blueprintData.metadata && State.blueprintData.metadata.wall_height_cm) || 280) / 100;

    const openings = findOpeningsOnWall(wall, scale);
    
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const wallLen = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);

    if (openings.length === 0) {
      createWallSegment(p1.x, p1.z, p2.x, p2.z, wallThickM, wallHeightM, 0, wallHeightM, wall.id);
    } else {
      openings.sort((a, b) => a.t - b.t);
      let currentT = 0;

      openings.forEach(op => {
        const tStart = op.t - (op.widthM / 2) / wallLen;
        const tEnd = op.t + (op.widthM / 2) / wallLen;

        // Solid wall segment
        if (tStart > currentT) {
          const sx = p1.x + currentT * dx;
          const sz = p1.z + currentT * dz;
          const ex = p1.x + tStart * dx;
          const ez = p1.z + tStart * dz;
          createWallSegment(sx, sz, ex, ez, wallThickM, wallHeightM, 0, wallHeightM, wall.id);
        }

        // Gap segments
        const ox = p1.x + op.t * dx;
        const oz = p1.z + op.t * dz;
        const gapStartX = p1.x + tStart * dx;
        const gapStartZ = p1.z + tStart * dz;
        const gapEndX = p1.x + tEnd * dx;
        const gapEndZ = p1.z + tEnd * dz;

        if (op.type === 'door') {
          createWallSegment(gapStartX, gapStartZ, gapEndX, gapEndZ, wallThickM, wallHeightM, 2.1, wallHeightM, wall.id);
          create3DDoor(ox, oz, op.widthM, wallThickM, 2.1, angle);
        } else if (op.type === 'window') {
          createWallSegment(gapStartX, gapStartZ, gapEndX, gapEndZ, wallThickM, wallHeightM, 0, 0.9, wall.id);
          createWallSegment(gapStartX, gapStartZ, gapEndX, gapEndZ, wallThickM, wallHeightM, 2.1, wallHeightM, wall.id);
          create3DWindow(ox, oz, op.widthM, wallThickM, 0.9, 2.1, angle);
        }

        currentT = tEnd;
      });

      if (currentT < 1.0) {
        const sx = p1.x + currentT * dx;
        const sz = p1.z + currentT * dz;
        createWallSegment(sx, sz, p2.x, p2.z, wallThickM, wallHeightM, 0, wallHeightM, wall.id);
      }
    }
  });

  // Calculate overall 3D house bounds for roof placement
  let min3DX = Infinity, max3DX = -Infinity;
  let min3DZ = Infinity, max3DZ = -Infinity;
  let hasRooms = false;

  State.blueprintData.rooms.forEach(room => {
    if (!room.polygon) return;
    room.polygon.forEach(pt => {
      const pt3D = to3DCoords(pt[0], pt[1], scale);
      min3DX = Math.min(min3DX, pt3D.x);
      max3DX = Math.max(max3DX, pt3D.x);
      min3DZ = Math.min(min3DZ, pt3D.z);
      max3DZ = Math.max(max3DZ, pt3D.z);
      hasRooms = true;
    });
  });

  // Render Roof if selected
  if (hasRooms && State.showRoof && State.showRoof !== 'none') {
    const width = max3DX - min3DX + 0.6;
    const depth = max3DZ - min3DZ + 0.6;
    const centerX = (min3DX + max3DX) / 2;
    const centerZ = (min3DZ + max3DZ) / 2;

    if (State.showRoof === 'flat') {
      const roofGeo = new THREE.BoxGeometry(width, 0.15, depth);
      const roofMesh = new THREE.Mesh(roofGeo, PBRMaterials.roof);
      roofMesh.position.set(centerX, wallHeightM + 0.075, centerZ);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      threeScene.add(roofMesh);
    }
    else if (State.showRoof === 'gable') {
      const roofShape = new THREE.Shape();
      roofShape.moveTo(-width / 2, 0);
      roofShape.lineTo(0, width * 0.28);
      roofShape.lineTo(width / 2, 0);
      roofShape.lineTo(-width / 2, 0);

      const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: depth, bevelEnabled: false });
      const roofMesh = new THREE.Mesh(roofGeo, PBRMaterials.roof);
      roofMesh.position.set(centerX, wallHeightM, min3DZ - 0.3);
      roofMesh.castShadow = true;
      threeScene.add(roofMesh);
    }
  }

  // 3. Render placed furniture catalog
  State.placedItems.forEach((item, idx) => {
    const pt = to3DCoords(item.x + item.width / 2, item.y + item.height / 2, scale);
    const itemWM = item.width / scale;
    const itemHM = item.height / scale;
    const itemRot = item.rotation || 0;
    const yOffsetM = (item.y_offset_cm || 0) / 100;

    const g = create3DFurniture(item.name, pt.x, pt.z, itemWM, itemHM, itemRot, yOffsetM, item.color, item.material);
    if (g) {
      g.userData.itemIndex = idx;
    }
  });

  // Re-highlight the selected item in 3D if active
  if (State.selectedItem !== null && State.placedItems[State.selectedItem]) {
    const selectedItemName = State.placedItems[State.selectedItem].name;
    let selectedGroup = null;
    threeScene.traverse(child => {
      if (child.isGroup && child.name === selectedItemName) {
        const pt = to3DCoords(State.placedItems[State.selectedItem].x + State.placedItems[State.selectedItem].width / 2, State.placedItems[State.selectedItem].y + State.placedItems[State.selectedItem].height / 2, scale);
        const dist = Math.hypot(child.position.x - pt.x, child.position.z - pt.z);
        if (dist < 0.2) {
          selectedGroup = child;
        }
      }
    });
    if (selectedGroup) {
      highlight3DItem(selectedGroup);
    }
  }

  // 4. Automatically center and fit 3D camera
  if (!window.initialCameraFit) {
    fit3DCamera();
    window.initialCameraFit = true;
  }
}

function findOpeningsOnWall(wall, scale) {
  const wallOpenings = [];
  const threshold = 18;

  const x1 = wall.x1, y1 = wall.y1, x2 = wall.x2, y2 = wall.y2;
  const dx = x2 - x1, dy = y2 - y1;
  const wallLenSq = dx*dx + dy*dy;
  if (wallLenSq === 0) return [];

  // Check doors
  State.blueprintData.doors.forEach(door => {
    const t = ((door.x - x1) * dx + (door.y - y1) * dy) / wallLenSq;
    if (t >= 0.05 && t <= 0.95) {
      const projX = x1 + t * dx, projY = y1 + t * dy;
      const d = Math.hypot(door.x - projX, door.y - projY);
      if (d < threshold) {
        wallOpenings.push({ type: 'door', t, widthM: door.width / scale });
      }
    }
  });

  // Check windows
  State.blueprintData.windows.forEach(win => {
    const t = ((win.x - x1) * dx + (win.y - y1) * dy) / wallLenSq;
    if (t >= 0.05 && t <= 0.95) {
      const projX = x1 + t * dx, projY = y1 + t * dy;
      const d = Math.hypot(win.x - projX, win.y - projY);
      if (d < threshold) {
        wallOpenings.push({ type: 'window', t, widthM: win.width / scale });
      }
    }
  });

  return wallOpenings;
}

function createWallSegment(x1, z1, x2, z2, thickness, wallHeight, hMin, hMax, wallId) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;

  const segmentHeight = hMax - hMin;
  const geo = new THREE.BoxGeometry(thickness, segmentHeight, len);
  
  // Resolve wall material dynamically
  let wallMat = PBRMaterials.plaster;
  if (wallId && State.materialsMap.walls[wallId]) {
    const wallSpec = State.materialsMap.walls[wallId];
    if (wallSpec.material) {
      wallMat = PBRMaterials[wallSpec.material] || PBRMaterials.plaster;
    } else if (wallSpec.paintColor) {
      wallMat = new THREE.MeshStandardMaterial({
        color: wallSpec.paintColor,
        roughness: wallSpec.roughness !== undefined ? wallSpec.roughness : 0.8,
        metalness: wallSpec.metalness !== undefined ? wallSpec.metalness : 0.1
      });
    }
  }

  const mesh = new THREE.Mesh(geo, wallMat);
  
  const mx = (x1 + x2) / 2;
  const mz = (z1 + z2) / 2;
  const my = hMin + segmentHeight / 2;
  
  mesh.position.set(mx, my, mz);
  mesh.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  threeScene.add(mesh);

  // A. Create skirting board trim along the base (if base is ground 0)
  if (hMin === 0 && hMax > 0.2) {
    const skirtH = 0.09; // 9 cm height skirting
    const skirtT = thickness + 0.01;
    const skirtGeo = new THREE.BoxGeometry(skirtT, skirtH, len);
    const skirtMesh = new THREE.Mesh(skirtGeo, PBRMaterials.skirting);
    skirtMesh.position.set(mx, skirtH / 2, mz);
    skirtMesh.rotation.y = mesh.rotation.y;
    threeScene.add(skirtMesh);
  }

  // B. Create crown molding cornices along the ceiling top (if hMax is high enough)
  if (State.showMolding && hMax > 2.0) {
    const moldH = 0.08; // 8 cm height crown molding
    const moldT = thickness + 0.02; // slightly wider than wall
    const moldGeo = new THREE.BoxGeometry(moldT, moldH, len);
    const moldMesh = new THREE.Mesh(moldGeo, PBRMaterials.skirting);
    moldMesh.position.set(mx, hMax - moldH / 2, mz);
    moldMesh.rotation.y = mesh.rotation.y;
    moldMesh.castShadow = true;
    threeScene.add(moldMesh);
  }
}

function create3DWindow(x, z, width, thickness, bottomH, topH, wallAngle) {
  const height = topH - bottomH;
  const group = new THREE.Group();

  const frameGeo = new THREE.BoxGeometry(thickness + 0.02, height, width);
  const frameMesh = new THREE.Mesh(frameGeo, PBRMaterials.frame);
  frameMesh.castShadow = true;
  group.add(frameMesh);

  const glassGeo = new THREE.BoxGeometry(0.02, height - 0.08, width - 0.08);
  const glassMesh = new THREE.Mesh(glassGeo, PBRMaterials.glass);
  group.add(glassMesh);

  group.position.set(x, bottomH + height / 2, z);
  group.rotation.y = -wallAngle + Math.PI / 2;
  threeScene.add(group);
}

function create3DDoor(x, z, width, thickness, doorHeight, wallAngle) {
  const group = new THREE.Group();

  const frameGeo = new THREE.BoxGeometry(thickness + 0.02, doorHeight, 0.04);
  const leftMesh = new THREE.Mesh(frameGeo, PBRMaterials.frame);
  leftMesh.position.set(0, 0, -width / 2);
  group.add(leftMesh);

  const rightMesh = new THREE.Mesh(frameGeo, PBRMaterials.frame);
  rightMesh.position.set(0, 0, width / 2);
  group.add(rightMesh);

  const topGeo = new THREE.BoxGeometry(thickness + 0.02, 0.04, width);
  const topMesh = new THREE.Mesh(topGeo, PBRMaterials.frame);
  topMesh.position.set(0, doorHeight / 2 - 0.02, 0);
  group.add(topMesh);

  const panelGeo = new THREE.BoxGeometry(0.03, doorHeight - 0.04, width - 0.05);
  const panelMesh = new THREE.Mesh(panelGeo, PBRMaterials.doorLeaf);
  panelMesh.castShadow = true;

  const panelPivotGroup = new THREE.Group();
  panelPivotGroup.position.set(0, 0, -width / 2 + 0.02);
  panelMesh.position.set(0, 0, (width - 0.05) / 2);
  panelPivotGroup.add(panelMesh);
  panelPivotGroup.rotation.y = Math.PI / 4.5; // open 40 degrees swing
  group.add(panelPivotGroup);

  group.position.set(x, doorHeight / 2, z);
  group.rotation.y = -wallAngle + Math.PI / 2;
  threeScene.add(group);
}

// Procedural Composite 3D mesh generator for catalog items
function create3DFurniture(name, x, z, w, d, rotation, yOffsetM = 0, customColor = null, customMatName = null) {
  const group = new THREE.Group();
  group.name = name;

  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: '#8d6e63', roughness: 0.6 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#4e342e', roughness: 0.7 }),
    whiteMesh: new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.8 }),
    cushion: new THREE.MeshStandardMaterial({ color: '#3f51b5', roughness: 0.8 }),
    fabricLight: new THREE.MeshStandardMaterial({ color: '#eceff1', roughness: 0.9 }),
    pillow: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9e9e9e', metalness: 0.8, roughness: 0.2 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.9, roughness: 0.1 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#fff9c4', emissive: '#fff9c4', emissiveIntensity: 0.2 })
  };

  if (name.includes("Sofa")) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(d - 0.1, 0.28, w - 0.2), mats.cushion);
    seat.position.set(0, 0.14, 0);
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, w - 0.2), mats.cushion);
    back.position.set(-d/2 + 0.09, 0.35, 0);
    back.castShadow = true;
    group.add(back);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(d, 0.45, 0.1), mats.cushion);
    armL.position.set(0, 0.225, -w/2 + 0.05);
    group.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(d, 0.45, 0.1), mats.cushion);
    armR.position.set(0, 0.225, w/2 - 0.05);
    group.add(armR);

  } else if (name.includes("Coffee Table") || name.includes("Study Desk") || name.includes("Office Desk")) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(d, 0.04, w), mats.wood);
    top.position.set(0, 0.72, 0);
    top.castShadow = true;
    group.add(top);

    const legPositions = [
      [-d/2 + 0.05, -w/2 + 0.05],
      [-d/2 + 0.05, w/2 - 0.05],
      [d/2 - 0.05, -w/2 + 0.05],
      [d/2 - 0.05, w/2 - 0.05]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), mats.metal);
      leg.position.set(pos[0], 0.35, pos[1]);
      leg.castShadow = true;
      group.add(leg);
    });

  } else if (name.includes("Bed")) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(d, 0.15, w), mats.darkWood);
    frame.position.set(0, 0.075, 0);
    frame.castShadow = true;
    group.add(frame);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, w), mats.darkWood);
    head.position.set(-d/2 + 0.05, 0.425, 0);
    group.add(head);

    const mat = new THREE.Mesh(new THREE.BoxGeometry(d - 0.1, 0.25, w - 0.08), mats.fabricLight);
    mat.position.set(0.05, 0.275, 0);
    mat.castShadow = true;
    group.add(mat);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.45), mats.pillow);
    pillow.position.set(-d/2 + 0.25, 0.41, 0);
    group.add(pillow);

  } else if (name.includes("TV Unit") || name.includes("Wardrobe") || name.includes("Bookshelf") || name.includes("Cabinet")) {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(d, 1.8, w), mats.darkWood);
    shell.position.set(0, 0.9, 0);
    shell.castShadow = true;
    group.add(shell);

  } else if (name.includes("Lamp")) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6), mats.gold);
    pole.position.set(0, 0.8, 0);
    group.add(pole);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02), mats.gold);
    base.position.set(0, 0.01, 0);
    group.add(base);

    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22), mats.lampShade);
    shade.position.set(0, 1.6, 0);
    group.add(shade);

    const light = new THREE.PointLight('#fffbeb', 0.6, 8);
    light.position.set(0, 1.6, 0);
    light.castShadow = true;
    group.add(light);

  } else if (name.includes("Toilet")) {
    const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.4, 0.38), mats.whiteMesh);
    bowl.position.set(0, 0.2, 0);
    group.add(bowl);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.38), mats.whiteMesh);
    tank.position.set(-0.22, 0.6, 0);
    group.add(tank);

  } else if (name.includes("Bathtub")) {
    const outer = new THREE.Mesh(new THREE.BoxGeometry(d, 0.55, w), mats.whiteMesh);
    outer.position.set(0, 0.275, 0);
    outer.castShadow = true;
    group.add(outer);

  } else if (name.includes("Stairs") || name.includes("Staircase")) {
    const steps = 12;
    const stepW = w;
    const stepD = d / steps;
    const stepH = 1.6 / steps; // rise up to 1.6 meters

    for (let i = 0; i < steps; i++) {
      const stepGeo = new THREE.BoxGeometry(stepD, stepH, stepW);
      const stepMesh = new THREE.Mesh(stepGeo, mats.wood);
      // Position rising steps offset sequentially
      stepMesh.position.set(-d/2 + (i + 0.5) * stepD, (i + 0.5) * stepH, 0);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }

  } else if (name.includes("Railing") || name.includes("Balcony")) {
    const posts = 6;
    const postH = 0.9;
    const postR = 0.015;
    const spacing = w / (posts - 1);

    for (let i = 0; i < posts; i++) {
      const postGeo = new THREE.CylinderGeometry(postR, postR, postH);
      const post = new THREE.Mesh(postGeo, mats.metal);
      post.position.set(0, postH / 2, -w/2 + i * spacing);
      post.castShadow = true;
      group.add(post);
    }
    const railGeo = new THREE.BoxGeometry(d, 0.04, w);
    const rail = new THREE.Mesh(railGeo, mats.darkWood);
    rail.position.set(0, postH + 0.02, 0);
    rail.castShadow = true;
    group.add(rail);

  } else if (name.includes("Pool") || name.includes("Swimming")) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(d, 0.1, w), mats.whiteMesh);
    frame.position.y = 0.05;
    group.add(frame);
    
    const water = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.2, w - 0.2), new THREE.MeshStandardMaterial({ color: '#29b6f6', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.08;
    group.add(water);

  } else if (name.includes("Car") || name.includes("Sedan")) {
    const bodyColor = customColor || '#3b82f6';
    const body = new THREE.Mesh(new THREE.BoxGeometry(d, 0.5, w), new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.7, roughness: 0.2 }));
    body.position.y = 0.35;
    group.add(body);
    
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(d * 0.6, 0.4, w * 0.8), new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.1 }));
    cabin.position.set(0, 0.7, 0);
    group.add(cabin);
    
    const whR = 0.18;
    const whW = 0.1;
    const wheelsPos = [
      [-d/3, -w/2], [-d/3, w/2], [d/3, -w/2], [d/3, w/2]
    ];
    wheelsPos.forEach(pos => {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(whR, whR, whW), mats.frame);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(pos[0], whR, pos[1]);
      group.add(wh);
    });

  } else if (name.includes("Bike") || name.includes("Motorbike")) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(d, 0.4, 0.15), mats.metal);
    frame.position.y = 0.35;
    group.add(frame);
    
    const wh1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08), mats.frame);
    wh1.rotation.x = Math.PI / 2;
    wh1.position.set(-d/2 + 0.15, 0.2, 0);
    group.add(wh1);
    
    const wh2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08), mats.frame);
    wh2.rotation.x = Math.PI / 2;
    wh2.position.set(d/2 - 0.15, 0.2, 0);
    group.add(wh2);

  } else if (name.includes("Rug") || name.includes("Carpet") || name.includes("Persian")) {
    const rugColor = customColor || '#991b1b';
    const rug = new THREE.Mesh(new THREE.BoxGeometry(d, 0.01, w), new THREE.MeshStandardMaterial({ color: rugColor, roughness: 0.95 }));
    rug.position.y = 0.005;
    group.add(rug);

  } else if (name.includes("Curtain") || name.includes("Curtains")) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, w), mats.metal);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0, 2.4, 0);
    group.add(rod);
    
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, w - 0.1), mats.fabricLight);
    drape.position.set(0, 1.2, 0);
    group.add(drape);

  } else if (name.includes("Plant") || name.includes("Tree")) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.25), mats.whiteMesh);
    pot.position.set(0, 0.125, 0);
    group.add(pot);

    const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: '#2e7d32', roughness: 0.9 }));
    foliage.position.set(0, 0.5, 0);
    group.add(foliage);

  } else {
    // Override default placeholder primitive box with custom styling if set
    let blockMat = mats.wood;
    if (customMatName && mats[customMatName]) {
      blockMat = mats[customMatName];
    } else if (customColor) {
      blockMat = new THREE.MeshStandardMaterial({ color: customColor, roughness: 0.6 });
    }
    const block = new THREE.Mesh(new THREE.BoxGeometry(d, 0.45, w), blockMat);
    block.position.set(0, 0.225, 0);
    block.castShadow = true;
    group.add(block);
  }

  // Set position including yOffsetM height adjustment
  group.position.set(x, yOffsetM, z);
  group.rotation.y = rotation;
  threeScene.add(group);
  return group;
}

function fit3DCamera() {
  if (!threeControls || !threeCamera) return;

  const box = new THREE.Box3();
  let hasObjects = false;
  threeScene.traverse(child => {
    if (child.isMesh && child.name !== 'ground_grid' && child.name !== 'Sky') {
      box.expandByObject(child);
      hasObjects = true;
    }
  });

  if (!hasObjects) {
    threeCamera.position.set(0, 12, 12);
    threeControls.target.set(0, 0, 0);
    threeControls.update();
    return;
  }

  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = threeCamera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

  // Add zoom padding
  cameraZ *= 1.35;
  
  // Center camera and target
  threeCamera.position.set(center.x, cameraZ * 0.8, center.z + cameraZ * 0.8);
  threeControls.target.copy(center);

  // Set limits
  threeControls.minDistance = 2;
  threeControls.maxDistance = maxDim * 5;
  threeControls.update();
}

let selectionBoxHelper = null;

function highlight3DItem(group) {
  if (!threeScene) return;
  if (selectionBoxHelper) {
    threeScene.remove(selectionBoxHelper);
  }
  selectionBoxHelper = new THREE.BoxHelper(group, '#00e5ff');
  threeScene.add(selectionBoxHelper);
}

function setup3DSelection() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('click', e => {
    // Only select in Step 4 (Interior Design phase)
    if (State.currentStep !== 4) return;
    if (!threeRenderer || !threeCamera) return;

    // Ignore clicks if clicking on left panel, right panel, or toolbar
    if (e.target.closest('#left-panel') || e.target.closest('#right-panel') || e.target.closest('.top-nav') || e.target.closest('.step-indicator-bar')) {
      return;
    }

    // Calculate mouse position in normalized device coordinates
    const rect = threeRenderer.domElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }
    
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, threeCamera);
    
    // Find intersected objects
    const intersects = raycaster.intersectObjects(threeScene.children, true);
    
    let selectedGroup = null;
    let clickedFloorObj = null;

    for (let i = 0; i < intersects.length; i++) {
      let obj = intersects[i].object;

      // Check if it's a floor mesh
      if (obj.userData && obj.userData.type === 'floor') {
        if (!clickedFloorObj) clickedFloorObj = obj;
      }

      // Traverse up to find the group name of placed furniture
      while (obj && obj !== threeScene) {
        if (obj.isGroup && obj.name) {
          selectedGroup = obj;
          break;
        }
        obj = obj.parent;
      }
      if (selectedGroup) break;
    }

    if (selectedGroup) {
      const scale = (State.blueprintData && State.blueprintData.metadata) ? State.blueprintData.metadata.scale_pixels_per_meter : 60.0;
      let bestItemIdx = null;
      let bestDist = Infinity;

      State.placedItems.forEach((item, idx) => {
        const pt = to3DCoords(item.x + item.width / 2, item.y + item.height / 2, scale);
        const d = Math.hypot(selectedGroup.position.x - pt.x, selectedGroup.position.z - pt.z);
        if (d < bestDist) {
          bestDist = d;
          bestItemIdx = idx;
        }
      });

      if (bestItemIdx !== null && bestDist < 1.5) {
        State.selectedItem = bestItemIdx;
        const item = State.placedItems[bestItemIdx];
        
        // Show selection properties panel
        UI.showPropertiesPanel('item', item);
        
        // Highlight in 3D
        highlight3DItem(selectedGroup);
                // Attach Transform Controls Gizmo!
        selectedGroup.userData.itemIndex = bestItemIdx;
        if (threeTransformControls) {
          threeTransformControls.attach(selectedGroup);
        }
        
        Exporter.showNotification(`🎯 Selected: ${item.name}`);
      }
    } else if (clickedFloorObj) {
      // Room floor selected directly in 3D!
      State.selectedItem = null;
      if (threeTransformControls) {
        threeTransformControls.detach();
      }

      const roomIdx = clickedFloorObj.userData.roomIndex;
      State.selectedRoomIndex = roomIdx;
      
      const roomData = State.blueprintData.rooms[roomIdx];
      UI.showPropertiesPanel('room', roomData);
      highlight3DItem(clickedFloorObj);

      Exporter.showNotification(`🎯 Selected Room: ${roomData.name}`);
    } else {
      // Clicked on empty space: clear selection
      State.selectedItem = null;
      State.selectedRoomIndex = null;
      if (selectionBoxHelper && threeScene) {
        threeScene.remove(selectionBoxHelper);
        selectionBoxHelper = null;
      }
      if (threeTransformControls) {
        threeTransformControls.detach();
      }
      // Reset properties panel
      const propContent = document.getElementById('properties-panel-content');
      if (propContent) {
        propContent.innerHTML = `<p style="font-size:11px; color:var(--text-secondary);">Select a wall, room, door, window, or furniture piece on the canvas to configure properties.</p>`;
      }
    }
  });
}
