// UI Controller - Collapsible Panels, Theme Toggles, Keyboard Shortcuts, and Material Pickers

const UI = {
  activeAccordion: null,

  // Initialize UI events and listeners
  init() {
    this.renderCatalog();
    this.setupKeyboardShortcuts();
    this.populateAIRoomsDropdown();
    
    // Auto-load project if saved previously
    if (State.loadProjectLocally()) {
      Exporter.showNotification("⚡ Auto-loaded your last active session!");
      updateTotal();
      this.populateAIRoomsDropdown();
      
      // Auto-restore background image if present
      if (State.blueprintData && State.blueprintData.url) {
        const img = new Image();
        img.onload = () => {
          State.blueprintImg = img;
          setTimeout(() => {
            fitToScreen();
            redraw();
          }, 100);
        };
        img.src = encodeURI(State.blueprintData.url);
      }
      
      this.changeStep(State.currentStep || 1);
    } else {
      this.changeStep(1);
    }
  },

  // Toggle sidebar accordions
  toggleAccordion(header) {
    const item = header.parentElement;
    const isActive = item.classList.contains('active');
    
    // Collapse others
    document.querySelectorAll('.accordion-item').forEach(el => {
      el.classList.remove('active');
      el.querySelector('.chevron').textContent = '▶';
    });

    if (!isActive) {
      item.classList.add('active');
      item.querySelector('.chevron').textContent = '▼';
    }
  },

  // Theme selector
  toggleTheme() {
    const body = document.body;
    if (body.classList.contains('theme-light')) {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      State.activeTheme = 'dark';
      if (threeScene) threeScene.background = new THREE.Color('#121214');
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      State.activeTheme = 'light';
      if (threeScene) threeScene.background = new THREE.Color('#f5f5f7');
    }
    Exporter.showNotification(`🌓 Switched to ${State.activeTheme} mode.`);
  },

  // Category navigation tabs
  selectRoom(roomName) {
    State.currentRoom = roomName;
    document.getElementById('current-room-label').textContent = roomName;
    
    // Update button states in bar
    document.querySelectorAll('.room-bar .room-btn').forEach(btn => {
      if (btn.textContent.includes(roomName)) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    this.renderCatalog();
    getSuggestions();
  },

  // Redraw furniture item listings in left sidebar catalog
  renderCatalog(pool = null) {
    const container = document.getElementById('furniture-list');
    if (!container) return;

    // If no pool passed, filter by active room category name
    if (!pool) {
      pool = getCatalogByCategory(State.currentRoom);
    }

    if (pool.length === 0) {
      container.innerHTML = `<div class="empty-list">No matches found in ${State.currentRoom}</div>`;
      return;
    }

    container.innerHTML = pool.map(item => `
      <div class="furniture-card" draggable="true"
        ondragstart="startDrag(event, '${encodeURIComponent(JSON.stringify(item))}')"
        onclick="UI.quickPlaceItem('${encodeURIComponent(JSON.stringify(item))}')"
      >
        <span class="card-icon">${FURNITURE_IMAGES[item.name] || '🪑'}</span>
        <div class="card-info">
          <div class="card-name">${item.name}</div>
          <div class="card-meta">L: ${item.length_cm}cm · B: ${item.breadth_cm}cm</div>
          <div class="card-price">₹${item.price.toLocaleString()}</div>
        </div>
        <button class="add-card-btn" title="Add to Canvas">+</button>
      </div>
    `).join('');
  },

  // Click handler to instantly spawn item at canvas center coordinates
  quickPlaceItem(encodedData) {
    State.saveHistory();
    const item = JSON.parse(decodeURIComponent(encodedData));
    
    // Spawn at center of canvas view window
    const scale = State.blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
    
    // Project canvas center coordinates to model space
    const cx = (canvas.width / 2 - State.panX) / State.zoom;
    const cy = (canvas.height / 2 - State.panY) / State.zoom;

    item.x = cx - item.canvas_w / 2;
    item.y = cy - item.canvas_h / 2;
    item.width = item.canvas_w;
    item.height = item.canvas_h;
    item.rotation = 0;

    State.placedItems.push(item);
    State.selectedItem = State.placedItems.length - 1;
    
    if (State.viewMode === '3d') build3DHouse();
    else redraw();
    
    updateTotal();
    Exporter.showNotification(`Placed ${item.name}!`);
  },

  filterCatalog() {
    const query = document.getElementById('catalog-search').value;
    const styleFilter = document.getElementById('style-select-filter').value;
    
    let pool = getCatalogBySearch(query);

    // Apply style sub-filter
    if (styleFilter !== 'All') {
      pool = pool.filter(item => item.style === styleFilter);
    }

    this.renderCatalog(pool);
  },

  // Apply PBR Materials
  applyMaterial(matName) {
    const target = document.getElementById('material-target').value; // 'floor' or 'ceiling'
    
    if (State.selectedRoomIndex === null) {
      alert("Please select/click inside a room polygon on the 2D canvas first!");
      return;
    }

    State.saveHistory();

    // Map room material target in state
    if (!State.materialsMap.rooms[State.selectedRoomIndex]) {
      State.materialsMap.rooms[State.selectedRoomIndex] = { floor: 'wood', wall: 'plaster', ceiling: 'ceiling' };
    }
    
    State.materialsMap.rooms[State.selectedRoomIndex][target] = matName;

    // Trigger rebuilds
    if (State.viewMode === '3d') build3DHouse();
    Exporter.showNotification(`applied ${matName} material to room ${target}!`);
    State.triggerAutoSave();
  },

  // Apply wall colors
  applyWallColor(hex) {
    if (State.selectedRoomIndex === null) {
      alert("Please click inside a room polygon on the 2D canvas first to color its walls!");
      return;
    }

    State.saveHistory();

    if (!State.materialsMap.rooms[State.selectedRoomIndex]) {
      State.materialsMap.rooms[State.selectedRoomIndex] = { floor: 'wood', wall: 'plaster', ceiling: 'ceiling' };
    }
    
    State.materialsMap.rooms[State.selectedRoomIndex].wallColor = hex;
    
    // Update paint color in 3D wall materials if custom is defined
    if (materials && materials.wall) {
      // Find matching 3D material
      if (PBRMaterials && PBRMaterials.plaster) {
        PBRMaterials.plaster.color.set(hex);
      }
    }

    if (State.viewMode === '3d') build3DHouse();
    Exporter.showNotification(`applied paint color to room walls!`);
    State.triggerAutoSave();
  },

  // Fill rooms selector options inside AI Designer dropdown
  populateAIRoomsDropdown() {
    const select = document.getElementById('ai-room-select');
    if (!select) return;

    if (!State.blueprintData) {
      select.innerHTML = '<option value="none">-- Upload Blueprint First --</option>';
      return;
    }

    select.innerHTML = '<option value="none">-- Choose Room --</option>' + 
      State.blueprintData.rooms.map((room, idx) => `
        <option value="${idx}">Room #${idx+1} (${room.name} - ${room.area_sq_m}m²)</option>
      `).join('');
  },

  // Trigger AI Auto layout planner
  triggerAIDesigner() {
    const roomIdxVal = document.getElementById('ai-room-select').value;
    const styleName = document.getElementById('ai-style-select').value;

    if (roomIdxVal === 'none') {
      alert("Please select a target room outline from the dropdown list.");
      return;
    }

    const roomIndex = parseInt(roomIdxVal);
    AIDesigner.generateDesign(roomIndex, styleName);
  },

  toggleGridSnap() {
    State.gridSnap = document.getElementById('grid-snap-toggle').checked;
    Exporter.showNotification(`Grid Snapping: ${State.gridSnap ? 'ON' : 'OFF'}`);
  },

  triggerUndo() {
    if (State.undo()) {
      if (State.viewMode === '3d') build3DHouse();
      else redraw();
      updateTotal();
      Exporter.showNotification("↩️ Undo complete");
    } else {
      Exporter.showNotification("Nothing left to undo");
    }
  },

  // 1. Blueprint Upload handler
  async handleBlueprintUpload(file) {
    if (!file) return;
    
    // Show uploading notification
    Exporter.showNotification("🔄 Uploading blueprint for AI processing...");
    
    const form = new FormData();
    form.append('file', file);
    
    try {
      const localUrl = URL.createObjectURL(file);
      const res = await fetch('/api/upload-blueprint', { method: 'POST', body: form });
      if (!res.ok) throw new Error("Server upload request failed.");
      
      const data = await res.json();
      if (data.error) {
        alert("AI Processing error: " + data.message);
        return;
      }
      
      // Use local URL for rendering the canvas background to bypass serverless 404s
      data.url = localUrl;
      State.blueprintData = data;
      
      // Load background image
      const img = new Image();
      img.onload = () => {
        State.blueprintImg = img;
        
        // Show canvas first
        this.changeStep(2);
        
        // Fit canvas after layout updates
        setTimeout(() => {
          fitToScreen();
          if (window.recalculateRoomDimensions) window.recalculateRoomDimensions();
          redraw();
        }, 100);
        
        Exporter.showNotification("✅ Starting floor plan generated! Customize it using editor tools.");
      };
      img.onerror = (err) => {
        console.error("Blueprint image loading failed:", img.src, err);
        alert("❌ Failed to render the blueprint background image.");
        this.changeStep(2);
      };
      img.src = localUrl;
      
    } catch (err) {
      alert("❌ Blueprint recognition failed: " + err.message);
    }
  },

  // 2. Change step navigation workflow
  changeStep(step) {
    if (step === 2 || step === 3 || step === 4) {
      if (!State.blueprintData) {
        alert("Please upload a blueprint floor plan in Step 1 first!");
        return;
      }
    }

    State.currentStep = step;
    window.initialCameraFit = false;
    
    // Update step tab badges active states
    document.querySelectorAll('.step-indicator-bar .step-item').forEach((el, idx) => {
      if (idx + 1 === step) el.classList.add('active');
      else el.classList.remove('active');
    });

    // Elements references
    const uploadScreen = document.getElementById('step-1-upload-screen');
    const roomCanvas = document.getElementById('room-canvas');
    const threeCont = document.getElementById('three-container');
    const canvasToolbar = document.getElementById('canvas-toolbar');
    const blueprintTools = document.getElementById('blueprint-tools');
    const viewControls = document.getElementById('viewer-controls');
    const canvasHint = document.getElementById('canvas-hint');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    
    const propAcc = document.getElementById('properties-accordion');
    const catAcc = document.getElementById('catalog-accordion');
    const matAcc = document.getElementById('materials-accordion');
    
    const step2Actions = document.getElementById('step-2-actions-panel');
    const step2Header = document.getElementById('step-2-actions-header');
    
    const step4RoomBar = document.getElementById('step-4-room-bar');
    const step4AI = document.getElementById('step-4-ai-panel');
    const step4AIHeader = document.getElementById('step-4-ai-header');
    const step4Valuation = document.getElementById('step-4-valuation-panel');
    const step4ValHeader = document.getElementById('step-4-valuation-header');
    const step4Arch = document.getElementById('step-4-architecture-panel');
    const step4ArchHeader = document.getElementById('step-4-architecture-header');

    // Transitions
    if (step === 1) {
      // Step 1: Upload
      uploadScreen.style.display = 'flex';
      roomCanvas.style.display = 'none';
      threeCont.style.display = 'none';
      canvasToolbar.style.display = 'none';
      blueprintTools.style.display = 'none';
      viewControls.style.display = 'none';
      canvasHint.style.display = 'none';
      leftPanel.style.display = 'none';
      rightPanel.style.display = 'none';
      step4RoomBar.style.display = 'none';
      setViewMode('2d');
    }
    else if (step === 2) {
      // Step 2: 2D Floor Plan Editor
      uploadScreen.style.display = 'none';
      roomCanvas.style.display = 'block';
      threeCont.style.display = 'none';
      canvasToolbar.style.display = 'flex';
      blueprintTools.style.display = 'flex';
      viewControls.style.display = 'flex';
      canvasHint.style.display = 'block';
      canvasHint.textContent = "✏️ Click Draw Wall, Snapped Door, or Snapped Window. Click objects to edit properties.";
      leftPanel.style.display = 'block';
      rightPanel.style.display = 'block';
      
      propAcc.style.display = 'block';
      catAcc.style.display = 'none';
      matAcc.style.display = 'none';
      
      step2Actions.style.display = 'block';
      step2Header.style.display = 'block';
      
      step4RoomBar.style.display = 'none';
      step4AI.style.display = 'none';
      step4AIHeader.style.display = 'none';
      step4Valuation.style.display = 'none';
      step4ValHeader.style.display = 'none';
      step4Arch.style.display = 'none';
      step4ArchHeader.style.display = 'none';
      
      setViewMode('2d');
      redraw();
    }
    else if (step === 3) {
      // Step 3: Generate 3D House Preview
      uploadScreen.style.display = 'none';
      roomCanvas.style.display = 'none';
      threeCont.style.display = 'block';
      canvasToolbar.style.display = 'none';
      blueprintTools.style.display = 'none';
      viewControls.style.display = 'none';
      canvasHint.style.display = 'block';
      canvasHint.textContent = "🕶️ 3D House View: Click Step 4 to start decorating rooms and placing furniture!";
      leftPanel.style.display = 'none';
      rightPanel.style.display = 'block';
      step4RoomBar.style.display = 'none';
      
      step2Actions.style.display = 'none';
      step2Header.style.display = 'none';
      step4AI.style.display = 'none';
      step4AIHeader.style.display = 'none';
      step4Valuation.style.display = 'none';
      step4ValHeader.style.display = 'none';
      step4Arch.style.display = 'block';
      step4ArchHeader.style.display = 'block';
      
      setViewMode('3d');
      Exporter.showNotification("🎉 3D house structure compiled successfully!");
    }
    else if (step === 4) {
      // Step 4: 3D Interior Design
      uploadScreen.style.display = 'none';
      roomCanvas.style.display = 'none';
      threeCont.style.display = 'block';
      canvasToolbar.style.display = 'none';
      blueprintTools.style.display = 'none';
      viewControls.style.display = 'none';
      canvasHint.style.display = 'block';
      canvasHint.textContent = "🛋️ 3D Interior Designer: Select furniture catalog items, drag/drop, customize paint & materials.";
      leftPanel.style.display = 'block';
      rightPanel.style.display = 'block';
      
      propAcc.style.display = 'block';
      catAcc.style.display = 'block';
      matAcc.style.display = 'block';
      
      step2Actions.style.display = 'none';
      step2Header.style.display = 'none';
      
      step4RoomBar.style.display = 'flex';
      step4AI.style.display = 'block';
      step4AIHeader.style.display = 'block';
      step4Valuation.style.display = 'block';
      step4ValHeader.style.display = 'block';
      step4Arch.style.display = 'block';
      step4ArchHeader.style.display = 'block';
      
      setViewMode('3d');
      this.populateAIRoomsDropdown();
      this.renderCatalog();
    }

    State.saveProjectLocally();
  },

  updateRoofStyle(val) {
    State.showRoof = val;
    if (State.viewMode === '3d') build3DHouse();
  },

  updateMolding(checked) {
    State.showMolding = checked;
    if (State.viewMode === '3d') build3DHouse();
  },

  // 3. Blueprint Editor Tool selection mode
  setToolMode(mode) {
    State.toolMode = mode;
    this.updateBlueprintToolsUI();
    
    // Clear dynamic snaps previews
    window.snapPreviewOpening = null;
    window.isDrawingWall = false;
    
    // Clear selection properties accordion content
    const propContent = document.getElementById('properties-panel-content');
    if (propContent) {
      propContent.innerHTML = `<p style="font-size:11px; color:var(--text-secondary);">Active Tool: <strong>${mode.toUpperCase()}</strong>. Interact on the 2D canvas.</p>`;
    }
    
    redraw();
  },

  updateBlueprintToolsUI() {
    const modes = ['select', 'draw_wall', 'add_door', 'add_window'];
    modes.forEach(m => {
      const el = document.getElementById(`tool-${m === 'draw_wall' ? 'wall' : m === 'add_door' ? 'door' : m === 'add_window' ? 'window' : 'select'}`);
      if (el) {
        if (State.toolMode === m) el.classList.add('active');
        else el.classList.remove('active');
      }
    });
  },

  // 4. Custom Add Rectangular Box Room (spawns 4 walls)
  addRoomBox() {
    if (!State.blueprintData) return;
    State.saveHistory();
    
    const scale = State.blueprintData.metadata.scale_pixels_per_meter || 60.0;
    
    // Get canvas center coordinates
    const cx = (canvas.width / 2 - State.panX) / State.zoom;
    const cy = (canvas.height / 2 - State.panY) / State.zoom;
    
    const size = 180; // ~3 meters
    const x1 = cx - size/2, x2 = cx + size/2;
    const y1 = cy - size/2, y2 = cy + size/2;
    
    const walls = State.blueprintData.walls;
    const maxId = walls.reduce((max, w) => Math.max(max, w.id || 0), 0);
    
    const w1 = { id: maxId + 1, x1, y1, x2, y1, thickness: 15, height: 280, type: 'interior' };
    const w2 = { id: maxId + 2, x1: x2, y1, x2: x2, y2: y2, thickness: 15, height: 280, type: 'interior' };
    const w3 = { id: maxId + 3, x1: x2, y1: y2, x2: x1, y2, thickness: 15, height: 280, type: 'interior' };
    const w4 = { id: maxId + 4, x1, y1: y2, x2: x1, y2: y1, thickness: 15, height: 280, type: 'interior' };
    
    walls.push(w1, w2, w3, w4);
    
    // Try to auto-create room contour
    const rooms = State.blueprintData.rooms;
    rooms.push({
      name: 'New Room',
      polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
      centroid: [cx, cy],
      area_sq_m: ((size*size) / (scale*scale)).toFixed(1),
      width_m: (size/scale).toFixed(1),
      depth_m: (size/scale).toFixed(1)
    });
    
    recalculateRoomDimensions();
    redraw();
    Exporter.showNotification("🏠 Added new room structure!");
  },

  // 5. Dynamic properties sidebar panel renderer
  showPropertiesPanel(type, object) {
    const container = document.getElementById('properties-panel-content');
    if (!container) return;

    // Expand accordion item
    const propItem = document.getElementById('properties-accordion');
    if (propItem) propItem.classList.add('active');
    
    let html = '';

    if (type === 'wall') {
      const wallMat = State.materialsMap.walls[object.id] || {};
      html = `
        <label>Selected Wall segment</label>
        <div class="prop-row">ID: <span class="prop-value">#${object.id || 'N/A'}</span></div>
        <div class="prop-row">Type: 
          <select onchange="UI.updateWallProp('type', this.value)">
            <option value="interior" ${object.type === 'interior' ? 'selected' : ''}>Interior Wall</option>
            <option value="exterior" ${object.type === 'exterior' ? 'selected' : ''}>Exterior Wall</option>
          </select>
        </div>
        
        <label style="margin-top:8px;">Wall Texture / Material</label>
        <select onchange="UI.updateWallProp('material', this.value)">
          <option value="plaster" ${wallMat.material === 'plaster' || !wallMat.material ? 'selected' : ''}>Plaster Paint</option>
          <option value="wood" ${wallMat.material === 'wood' ? 'selected' : ''}>Oak Wood Board</option>
          <option value="concrete" ${wallMat.material === 'concrete' ? 'selected' : ''}>Raw Concrete</option>
          <option value="brick" ${wallMat.material === 'brick' ? 'selected' : ''}>Red Clay Brick</option>
          <option value="tiles" ${wallMat.material === 'tiles' ? 'selected' : ''}>Ceramic Tiles</option>
          <option value="glass" ${wallMat.material === 'glass' ? 'selected' : ''}>Glass Partition</option>
        </select>
        
        <label style="margin-top:8px;">Wall Paint Color</label>
        <div class="prop-row">
          <input type="color" value="${wallMat.paintColor || '#f5f5f5'}" onchange="UI.updateWallProp('paintColor', this.value)"/>
          <span class="prop-value">${wallMat.paintColor || '#f5f5f5'}</span>
        </div>

        <label style="margin-top:8px;">Wall Thickness (cm)</label>
        <div class="prop-row">
          <input type="range" min="10" max="45" value="${object.thickness || 15}" oninput="document.getElementById('wall-thick-val').textContent=this.value+' cm'; UI.updateWallProp('thickness', parseInt(this.value));"/>
          <span id="wall-thick-val" class="prop-value">${object.thickness || 15} cm</span>
        </div>
        <label style="margin-top:8px;">Wall Height (cm)</label>
        <div class="prop-row">
          <input type="range" min="200" max="400" value="${object.height || 280}" oninput="document.getElementById('wall-height-val').textContent=this.value+' cm'; UI.updateWallProp('height', parseInt(this.value));"/>
          <span id="wall-height-val" class="prop-value">${object.height || 280} cm</span>
        </div>
        <button class="nav-btn" onclick="UI.triggerSplitWall()" style="width:100%; margin-top:12px;">✂️ Split Wall Segment</button>
        <button class="prop-btn-danger" onclick="UI.triggerDeleteSelection()">🗑️ Delete Wall Segment</button>
      `;
    }
    else if (type === 'door') {
      html = `
        <label>Selected Door segment</label>
        <div class="prop-row">ID: <span class="prop-value">#${object.id}</span></div>
        <div class="prop-row">Door Style: 
          <select onchange="UI.updateDoorProp('type', this.value)">
            <option value="single" ${object.type === 'single' ? 'selected' : ''}>Single swing door</option>
            <option value="double" ${object.type === 'double' ? 'selected' : ''}>Double entry door</option>
            <option value="sliding" ${object.type === 'sliding' ? 'selected' : ''}>Sliding pocket door</option>
          </select>
        </div>
        <label style="margin-top:8px;">Door Width (cm)</label>
        <div class="prop-row">
          <input type="range" min="60" max="180" value="${object.width || 80}" oninput="document.getElementById('door-width-val').textContent=this.value+' cm'; UI.updateDoorProp('width', parseInt(this.value));"/>
          <span id="door-width-val" class="prop-value">${object.width || 80} cm</span>
        </div>
        <button class="prop-btn-danger" onclick="UI.triggerDeleteSelection()">🗑️ Remove Door</button>
      `;
    }
    else if (type === 'window') {
      html = `
        <label>Selected Window segment</label>
        <div class="prop-row">ID: <span class="prop-value">#${object.id}</span></div>
        <label style="margin-top:8px;">Window Width (cm)</label>
        <div class="prop-row">
          <input type="range" min="50" max="250" value="${object.width || 100}" oninput="document.getElementById('win-width-val').textContent=this.value+' cm'; UI.updateWindowProp('width', parseInt(this.value));"/>
          <span id="win-width-val" class="prop-value">${object.width || 100} cm</span>
        </div>
        <button class="prop-btn-danger" onclick="UI.triggerDeleteSelection()">🗑️ Remove Window</button>
      `;
    }
    else if (type === 'room') {
      const customMat = State.materialsMap.rooms[State.selectedRoomIndex] || {};
      html = `
        <label>Room Outline Properties</label>
        <div class="prop-row">Area: <span class="prop-value" style="color:#2e7d32;">${object.area_sq_m} m²</span></div>
        <div class="prop-row">Room Dimensions: <span>${object.width_m}m x ${object.depth_m}m</span></div>
        
        <label style="margin-top:8px;">Rename Room Label</label>
        <input type="text" value="${object.name}" onchange="UI.updateRoomProp('name', this.value)" style="width:100%; box-sizing:border-box; margin-bottom:8px;"/>
        
        <label style="margin-top:8px;">Select Floor Material</label>
        <select onchange="UI.updateRoomProp('floor', this.value)">
          <option value="wood" ${customMat.floor === 'wood' || !customMat.floor ? 'selected' : ''}>Polished Oak wood</option>
          <option value="marble" ${customMat.floor === 'marble' ? 'selected' : ''}>Carrara White Marble</option>
          <option value="concrete" ${customMat.floor === 'concrete' ? 'selected' : ''}>Raw Industrial Concrete</option>
          <option value="tiles" ${customMat.floor === 'tiles' ? 'selected' : ''}>Cyan Ceramic Tiles</option>
          <option value="brick" ${customMat.floor === 'brick' ? 'selected' : ''}>Granite Tile Slats</option>
        </select>
        
        <label style="margin-top:8px;">Select Ceiling Style</label>
        <select onchange="UI.updateRoomProp('ceilingStyle', this.value)">
          <option value="flat" ${customMat.ceilingStyle === 'flat' || !customMat.ceilingStyle ? 'selected' : ''}>Standard Flat Ceiling</option>
          <option value="gypsum" ${customMat.ceilingStyle === 'gypsum' ? 'selected' : ''}>Gypsum Ceiling</option>
          <option value="wood" ${customMat.ceilingStyle === 'wood' ? 'selected' : ''}>Wood paneled false ceiling</option>
          <option value="false" ${customMat.ceilingStyle === 'false' ? 'selected' : ''}>Drop False Ceiling</option>
        </select>

        <label style="margin-top:8px;">Ceiling Lights Options</label>
        <div class="prop-row" style="justify-content:space-between; margin-bottom:6px;">
          <span>LED Border Strip</span>
          <input type="checkbox" ${customMat.ledStrip ? 'checked' : ''} onchange="UI.updateRoomProp('ledStrip', this.checked)"/>
        </div>
        <div class="prop-row" style="justify-content:space-between; margin-bottom:6px;">
          <span>Spot Lights</span>
          <input type="checkbox" ${customMat.spotLights ? 'checked' : ''} onchange="UI.updateRoomProp('spotLights', this.checked)"/>
        </div>
        <div class="prop-row" style="justify-content:space-between;">
          <span>Lights Glow Color</span>
          <input type="color" value="${customMat.ledColor || '#ffd700'}" onchange="UI.updateRoomProp('ledColor', this.value)"/>
        </div>
      `;
    }
    else if (type === 'item') {
      html = `
        <label>Placed Furniture Item</label>
        <div class="prop-row" style="font-weight:700;">${object.name}</div>
        <div class="prop-row">Price: <span style="color:#2e7d32; font-weight:700;">₹${object.price.toLocaleString()}</span></div>
        
        <label style="margin-top:8px;">Rotation</label>
        <div class="prop-row">
          <input type="range" min="0" max="360" value="${Math.round((object.rotation || 0) * 180 / Math.PI)}" oninput="document.getElementById('item-rot-val').textContent=this.value+'°'; UI.updateItemProp('rotation', parseInt(this.value) * Math.PI / 180);"/>
          <span id="item-rot-val" class="prop-value">${Math.round((object.rotation || 0) * 180 / Math.PI)}°</span>
        </div>
        <div class="prop-row" style="gap:6px; margin-top:4px; margin-bottom:8px;">
          <button class="nav-btn" onclick="UI.rotateSelectedItem(-45)" style="flex:1; padding:6px 0; font-size:11px;">🔄 -45°</button>
          <button class="nav-btn" onclick="UI.rotateSelectedItem(45)" style="flex:1; padding:6px 0; font-size:11px;">🔄 +45°</button>
          <button class="nav-btn" onclick="UI.rotateSelectedItem(90)" style="flex:1; padding:6px 0; font-size:11px;">🔄 +90°</button>
        </div>
        
        <label style="margin-top:8px;">Height Adjustment Offset (cm)</label>
        <div class="prop-row">
          <input type="range" min="-100" max="300" value="${object.y_offset_cm || 0}" oninput="document.getElementById('item-offset-val').textContent=this.value+' cm'; UI.updateItemProp('y_offset_cm', parseInt(this.value));"/>
          <span id="item-offset-val" class="prop-value">${object.y_offset_cm || 0} cm</span>
        </div>

        <label style="margin-top:8px;">Custom Color Override</label>
        <div class="prop-row">
          <input type="color" value="${object.color || '#eeeeee'}" onchange="UI.updateItemProp('color', this.value)"/>
          <span class="prop-value">${object.color || 'Default'}</span>
        </div>

        <label style="margin-top:8px;">Material Surface Texture</label>
        <select onchange="UI.updateItemProp('material', this.value)">
          <option value="wood" ${object.material === 'wood' ? 'selected' : ''}>Wood Finish</option>
          <option value="darkWood" ${object.material === 'darkWood' ? 'selected' : ''}>Dark Walnut</option>
          <option value="metal" ${object.material === 'metal' ? 'selected' : ''}>Polished Chrome Steel</option>
          <option value="gold" ${object.material === 'gold' ? 'selected' : ''}>Gold Plated Accent</option>
          <option value="whiteMesh" ${object.material === 'whiteMesh' ? 'selected' : ''}>Plaster White</option>
          <option value="cushion" ${object.material === 'cushion' ? 'selected' : ''}>Fabric Cushion</option>
        </select>

        <label style="margin-top:8px;">Adjust Width (cm)</label>
        <div class="prop-row">
          <input type="range" min="40" max="400" value="${object.length_cm}" oninput="document.getElementById('item-len-val').textContent=this.value+' cm'; UI.updateItemProp('length_cm', parseInt(this.value));"/>
          <span id="item-len-val" class="prop-value">${object.length_cm} cm</span>
        </div>
        
        <label style="margin-top:8px;">Adjust Depth (cm)</label>
        <div class="prop-row">
          <input type="range" min="40" max="400" value="${object.breadth_cm}" oninput="document.getElementById('item-breadth-val').textContent=this.value+' cm'; UI.updateItemProp('breadth_cm', parseInt(this.value));"/>
          <span id="item-breadth-val" class="prop-value">${object.breadth_cm} cm</span>
        </div>

        <button class="nav-btn" onclick="State.duplicateItem(); if(State.viewMode==='3d') build3DHouse(); else redraw();" style="width:100%; margin-top:12px;">📋 Duplicate Element</button>
        <button class="prop-btn-danger" onclick="UI.triggerDeleteSelection()">🗑️ Delete Element</button>
      `;
    }

    container.innerHTML = html;
  },

  // Property updation triggers
  updateWallProp(prop, val) {
    if (!selectedWall) return;
    State.saveHistory();
    selectedWall[prop] = val;

    // Save to materialsMap
    if (!State.materialsMap.walls[selectedWall.id]) {
      State.materialsMap.walls[selectedWall.id] = {};
    }
    State.materialsMap.walls[selectedWall.id][prop] = val;

    if (State.viewMode === '3d') build3DHouse();
    else redraw();
  },

  updateDoorProp(prop, val) {
    if (!selectedDoor) return;
    State.saveHistory();
    selectedDoor[prop] = val;
    if (State.viewMode === '3d') build3DHouse();
    else redraw();
  },

  updateWindowProp(prop, val) {
    if (!selectedWindow) return;
    State.saveHistory();
    selectedWindow[prop] = val;
    if (State.viewMode === '3d') build3DHouse();
    else redraw();
  },

  updateRoomProp(prop, val) {
    if (State.selectedRoomIndex === null || !State.blueprintData) return;
    State.saveHistory();
    const room = State.blueprintData.rooms[State.selectedRoomIndex];
    room[prop] = val;
    
    // Save to room materials map too
    if (!State.materialsMap.rooms[State.selectedRoomIndex]) {
      State.materialsMap.rooms[State.selectedRoomIndex] = { floor: 'wood', wall: 'plaster', ceiling: 'ceiling' };
    }
    State.materialsMap.rooms[State.selectedRoomIndex][prop] = val;
    
    if (State.viewMode === '3d') build3DHouse();
    else redraw();
  },

  updateItemProp(prop, val) {
    if (selectedItem === null) return;
    State.saveHistory();
    const item = placedItems[selectedItem];
    item[prop] = val;
    
    // Map item breadth/length in scale pixels
    if (prop === 'length_cm') item.width = Math.round(val * (blueprintData?.metadata?.scale_pixels_per_meter || 60.0) / 100);
    if (prop === 'breadth_cm') item.height = Math.round(val * (blueprintData?.metadata?.scale_pixels_per_meter || 60.0) / 100);
    
  },

  rotateSelectedItem(deg) {
    if (selectedItem === null) return;
    State.saveHistory();
    const item = placedItems[selectedItem];
    item.rotation = (item.rotation || 0) + (deg * Math.PI / 180);
    if (item.rotation < 0) item.rotation += Math.PI * 2;
    if (item.rotation >= Math.PI * 2) item.rotation -= Math.PI * 2;

    if (State.viewMode === '3d') build3DHouse();
    else redraw();

    // Re-render properties panel
    UI.showPropertiesPanel('item', item);
  },

  triggerSplitWall() {
    if (!selectedWall) return;
    State.splitWall(selectedWall);
    redraw();
    Exporter.showNotification("✂️ Split wall segment in half.");
  },

  clearStructuralLayout() {
    if (!State.blueprintData) return;
    if (confirm("⚠️ Are you sure you want to clear all walls, rooms, doors, and windows from the floor plan? This cannot be undone.")) {
      State.saveHistory();
      State.blueprintData.walls = [];
      State.blueprintData.rooms = [];
      State.blueprintData.doors = [];
      State.blueprintData.windows = [];
      
      // Clear active selections
      window.selectedWall = null;
      window.selectedDoor = null;
      window.selectedWindow = null;
      State.selectedRoomIndex = null;
      
      redraw();
      Exporter.showNotification("🗑️ Cleared all walls and structures.");
    }
  },

  // Bind key combinations
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      // Don't trigger shortcuts inside text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.triggerUndo();
      }
      else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.triggerRedo();
      }
      else if (isCtrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (State.copyItem()) Exporter.showNotification("📋 Copied item to clipboard");
      }
      else if (isCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (State.pasteItem()) {
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
          updateTotal();
          Exporter.showNotification("📋 Pasted item");
        }
      }
      else if (isCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (State.duplicateItem()) {
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
          updateTotal();
          Exporter.showNotification("📋 Duplicated item");
        }
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const deletedType = State.deleteSelection();
        if (deletedType) {
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
          updateTotal();
          const typeNames = { item: 'Item', wall: 'Wall segment', door: 'Door', window: 'Window' };
          Exporter.showNotification(`🗑️ ${typeNames[deletedType]} deleted`);
        }
      }
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (State.selectedItem !== null) {
          e.preventDefault();
          const item = State.placedItems[State.selectedItem];
          const dist = e.shiftKey ? 10 : 2; // move 10px if shift, else 2px
          if (e.key === 'ArrowUp') item.y -= dist;
          if (e.key === 'ArrowDown') item.y += dist;
          if (e.key === 'ArrowLeft') item.x -= dist;
          if (e.key === 'ArrowRight') item.x += dist;
          
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
        }
      }
      else if (e.key.toLowerCase() === 'r') {
        if (State.selectedItem !== null) {
          e.preventDefault();
          const item = State.placedItems[State.selectedItem];
          item.rotation = (item.rotation || 0) + 0.2618;
          if (item.rotation >= Math.PI * 2) item.rotation -= Math.PI * 2;
          
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
          Exporter.showNotification("🔄 Rotated item by 15°");
        }
      }
      else if (e.key.toLowerCase() === 's') {
        if (State.selectedItem !== null) {
          e.preventDefault();
          const item = State.placedItems[State.selectedItem];
          item.width = Math.round(item.width * 1.05);
          item.height = Math.round(item.height * 1.05);
          
          if (State.viewMode === '3d') build3DHouse();
          else redraw();
          Exporter.showNotification("📐 Scaled item size by +5%");
        }
      }
    });
  }
};

// Initialize UI on DOM load
window.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
