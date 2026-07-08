// WebXR Augmented Reality and Virtual Reality Manager

const WebXRManager = {
  // Session configuration
  xrSession: null,
  simulatingXR: false,
  originalCameraPos: null,
  originalCameraTarget: null,
  
  // Teleportation ray and ring marker for VR
  vrMarker: null,
  isWalkModeActive: false,
  
  // Simulated First-person mouse look variables
  yaw: -Math.PI / 2,
  pitch: 0,
  isMouseDown: false,
  previousMousePosition: { x: 0, y: 0 },

  // Try to start Augmented Reality Mode
  async startAR() {
    if (navigator.xr) {
      try {
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (isSupported) {
          this.runXRSession('immersive-ar');
          return;
        }
      } catch (err) {
        console.warn("WebXR AR checks failed:", err);
      }
    }
    
    // Fallback: Desktop Simulated AR Viewer
    this.startSimulatedAR();
  },

  // Try to start Virtual Reality Mode
  async startVR() {
    if (navigator.xr) {
      try {
        const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
        if (isSupported) {
          this.runXRSession('immersive-vr');
          return;
        }
      } catch (err) {
        console.warn("WebXR VR checks failed:", err);
      }
    }

    // Fallback: Desktop Walkthrough VR Mode
    this.startSimulatedVR();
  },

  // Initialize native WebXR session (AR/VR Device support)
  async runXRSession(mode) {
    Exporter.showNotification(`Initializing ${mode === 'immersive-ar' ? 'AR' : 'VR'} Session...`);
    try {
      const session = await navigator.xr.requestSession(mode, {
        requiredFeatures: ['local-floor', 'hit-test']
      });
      this.xrSession = session;
      
      // Bind WebGL state to XR
      threeRenderer.xr.enabled = true;
      await threeRenderer.xr.setSession(session);

      session.addEventListener('end', () => {
        threeRenderer.xr.enabled = false;
        Exporter.showNotification("WebXR Session ended.");
      });
    } catch (e) {
      alert("WebXR session failed to launch: " + e.message);
      if (mode === 'immersive-ar') this.startSimulatedAR();
      else this.startSimulatedVR();
    }
  },

  // Simulated desktop AR mode: creates a mock mobile camera frame with a cozy home background
  startSimulatedAR() {
    if (this.simulatingXR) return;
    this.simulatingXR = true;
    Exporter.showNotification("📐 Starting Simulated AR Viewer...");

    // Create dark backdrop and simulated phone device frame
    const arOverlay = document.createElement('div');
    arOverlay.id = 'ar-overlay-frame';
    arOverlay.innerHTML = `
      <div class="ar-phone-shell">
        <div class="ar-phone-screen">
          <div class="ar-feed-grid"></div>
          <div class="ar-sim-indicator">📲 simulated ar view</div>
          <div class="ar-instructions">
            <span>Drag items onto the surface</span>
            <button onclick="WebXRManager.stopSimulatedXR()">Quit AR</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(arOverlay);

    // Save camera settings
    this.originalCameraPos = threeCamera.position.clone();
    this.originalCameraTarget = threeControls.target.clone();

    // Re-mount ThreeJS canvas inside the phone frame!
    const threeCont = document.getElementById('three-container');
    const screen = arOverlay.querySelector('.ar-phone-screen');
    
    // Temporarily append canvas to screen
    screen.appendChild(threeCont);
    threeCont.style.display = 'block';
    threeCont.style.width = '100%';
    threeCont.style.height = '100%';

    // Resize Three renderer
    threeCamera.aspect = threeCont.clientWidth / threeCont.clientHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(threeCont.clientWidth, threeCont.clientHeight);

    // Hide ceiling in AR view for clear visibility
    threeScene.traverse(child => {
      if (child.name === 'Ceiling' || child.material === materials.ceiling) {
        child.visible = false;
      }
    });

    // Animate camera to cozy low angle
    threeCamera.position.set(0, 3, 6);
    threeControls.target.set(0, 0.5, 0);
    threeControls.update();
  },

  // Simulated Walk walkthrough: bindings for WASD + pointer-lock
  startSimulatedVR() {
    if (State.viewMode !== '3d') {
      setViewMode('3d');
    }
    
    Exporter.showNotification("🚶 Entering Walk Mode (First-Person VR)...");
    
    this.isWalkModeActive = true;
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.isMouseDown = false;
    
    // Save original orbit settings
    this.originalCameraPos = threeCamera.position.clone();
    this.originalCameraTarget = threeControls.target.clone();

    // Disable Orbit controls temporarily
    threeControls.enabled = false;

    // Reset camera position to room center centroid or (0, 1.6, 0)
    threeCamera.position.set(0, 1.6, 0); // eye-level 1.6m
    threeCamera.lookAt(0, 1.6, -3);

    // Overlay hint panel
    const hint = document.createElement('div');
    hint.id = 'vr-hud-overlay';
    hint.innerHTML = `
      <div class="vr-hud-card">
        <h3>🚶 First Person Walk</h3>
        <p>Use <strong>W A S D</strong> or <strong>Arrows</strong> to Walk</p>
        <p>Left-Click & Drag mouse to Look Around</p>
        <button onclick="WebXRManager.stopSimulatedVR()">Exit Walk Mode</button>
      </div>
    `;
    document.body.appendChild(hint);

    // Initialize key and mouse listeners
    window.addEventListener('keydown', this.handleWalkKeys);

    const canvasEl = threeRenderer.domElement;
    canvasEl.addEventListener('mousedown', this.handleVRMouseDown);
    window.addEventListener('mousemove', this.handleVRMouseMove);
    window.addEventListener('mouseup', this.handleVRMouseUp);
  },

  stopSimulatedXR() {
    const arOverlay = document.getElementById('ar-overlay-frame');
    if (!arOverlay) return;

    // Re-mount canvas back to normal middle canvas area
    const threeCont = document.getElementById('three-container');
    const midArea = document.querySelector('.canvas-area');
    midArea.appendChild(threeCont);

    // Re-size three container
    threeCont.style.display = 'block';
    threeCont.style.width = '640px';
    threeCont.style.height = '500px';

    threeCamera.aspect = 640 / 500;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(640, 500);

    // Show ceilings again
    threeScene.traverse(child => {
      if (child.material === materials.ceiling) {
        child.visible = true;
      }
    });

    // Restore Camera
    if (this.originalCameraPos) {
      threeCamera.position.copy(this.originalCameraPos);
      threeControls.target.copy(this.originalCameraTarget);
      threeControls.update();
    }

    document.body.removeChild(arOverlay);
    this.simulatingXR = false;
    Exporter.showNotification("Exited AR Simulation.");
  },

  stopSimulatedVR() {
    const hud = document.getElementById('vr-hud-overlay');
    if (hud) document.body.removeChild(hud);

    window.removeEventListener('keydown', this.handleWalkKeys);
    
    const canvasEl = threeRenderer?.domElement;
    if (canvasEl) {
      canvasEl.removeEventListener('mousedown', this.handleVRMouseDown);
    }
    window.removeEventListener('mousemove', this.handleVRMouseMove);
    window.removeEventListener('mouseup', this.handleVRMouseUp);

    this.isWalkModeActive = false;

    // Re-enable controls
    threeControls.enabled = true;
    if (this.originalCameraPos) {
      threeCamera.position.copy(this.originalCameraPos);
      threeControls.target.copy(this.originalCameraTarget);
      threeControls.update();
    }

    Exporter.showNotification("Exited Walk Mode.");
  },

  handleVRMouseDown(e) {
    WebXRManager.isMouseDown = true;
    WebXRManager.previousMousePosition = { x: e.clientX, y: e.clientY };
  },

  handleVRMouseMove(e) {
    if (!WebXRManager.isWalkModeActive || !WebXRManager.isMouseDown) return;

    const deltaX = e.clientX - WebXRManager.previousMousePosition.x;
    const deltaY = e.clientY - WebXRManager.previousMousePosition.y;
    WebXRManager.previousMousePosition = { x: e.clientX, y: e.clientY };

    WebXRManager.yaw -= deltaX * 0.003;
    WebXRManager.pitch -= deltaY * 0.003;

    // Clamp pitch to look down/up (but not backward/loops)
    WebXRManager.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, WebXRManager.pitch));

    // Update camera direction
    const target = new THREE.Vector3(
      Math.cos(WebXRManager.pitch) * Math.cos(WebXRManager.yaw),
      Math.sin(WebXRManager.pitch),
      Math.cos(WebXRManager.pitch) * Math.sin(WebXRManager.yaw)
    );

    // Make look target relative to current camera position
    target.add(threeCamera.position);
    threeCamera.lookAt(target);
  },

  handleVRMouseUp() {
    WebXRManager.isMouseDown = false;
  },

  // Key controller for walk controls
  handleWalkKeys(e) {
    const key = e.key.toLowerCase();
    const speed = 0.2; // movement step size (meters)

    // Direction vectors
    const dir = new THREE.Vector3();
    threeCamera.getWorldDirection(dir);
    
    // Project direction onto horizontal floor plane (X-Z)
    dir.y = 0;
    dir.normalize();

    // Sideways vector (cross product of direction and Y up)
    const right = new THREE.Vector3();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

    const targetPos = threeCamera.position.clone();

    if (key === 'w' || e.key === 'ArrowUp') {
      targetPos.addScaledVector(dir, speed);
    } else if (key === 's' || e.key === 'ArrowDown') {
      targetPos.addScaledVector(dir, -speed);
    } else if (key === 'a' || e.key === 'ArrowLeft') {
      targetPos.addScaledVector(right, -speed);
    } else if (key === 'd' || e.key === 'ArrowRight') {
      targetPos.addScaledVector(right, speed);
    }

    // Wall Collision Check!
    // Prevent walking through walls by checking distance to wall segments
    if (WebXRManager.checkWallCollision(targetPos)) {
      // Collision detected, block movement!
      return;
    }

    // Apply movement
    threeCamera.position.copy(targetPos);

    // Dynamic Interaction: open doors if player gets close (< 1.5m)
    WebXRManager.checkInteractiveObjects(threeCamera.position);
  },

  checkWallCollision(pos) {
    if (!State.blueprintData) return false;
    
    const scale = State.blueprintData.metadata.scale_pixels_per_meter || 60.0;
    const playerRadius = 0.35; // meters (player bounding cylinder)

    // Convert player position pos(X, Z) in 3D to 2D Canvas pixels
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const pxX = pos.x * scale + cx;
    const pxY = pos.z * scale + cy;

    for (let wall of State.blueprintData.walls) {
      // Find shortest distance from player to wall segment in pixels
      const x1 = wall.x1, y1 = wall.y1, x2 = wall.x2, y2 = wall.y2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const wallLenSq = dx*dx + dy*dy;
      if (wallLenSq === 0) continue;

      let t = ((pxX - x1) * dx + (pxY - y1) * dy) / wallLenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const distPx = Math.hypot(pxX - projX, pxY - projY);
      
      const wallThickM = (wall.thickness || 15);
      const safetyLimitPx = (wallThickM / 2) + (playerRadius * scale);

      if (distPx < safetyLimitPx) {
        return true; // Collision!
      }
    }
    return false;
  },

  // Open doors automatically when player walks close to them
  checkInteractiveObjects(playerPos) {
    if (!threeScene) return;

    // Look for door meshes in scene
    threeScene.traverse(child => {
      if (child.name === 'Modern Sofa' || child.name === 'Floor Lamp') return;
      
      // If we find a door hinge pivot group
      if (child.isGroup && child.children.length === 2 && child.children[0].position.z !== 0) {
        // This is a door group pivot!
        const doorPos = new THREE.Vector3();
        child.getWorldPosition(doorPos);
        
        const dist = playerPos.distanceTo(doorPos);
        
        // Pivot group is the panelPivotGroup (nested child)
        const panelGroup = child.children[0].parent; // wait, let's look for Group type
        // Open door when close, close when far!
        if (dist < 1.8) {
          // Swing open 90 degrees (Math.PI/2)
          child.traverse(sub => {
            if (sub.isGroup && sub !== child) {
              sub.rotation.y = THREE.MathUtils.lerp(sub.rotation.y, Math.PI / 2, 0.1);
            }
          });
        } else {
          // Swing back to slightly open (Math.PI/4)
          child.traverse(sub => {
            if (sub.isGroup && sub !== child) {
              sub.rotation.y = THREE.MathUtils.lerp(sub.rotation.y, Math.PI / 4, 0.1);
            }
          });
        }
      }
    });
  }
};
