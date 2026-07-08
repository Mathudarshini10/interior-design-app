// Centralized Application State Manager

const State = {
  // Model Data
  placedItems: [],
  blueprintData: null,
  blueprintImg: null,
  
  // Selection
  selectedItem: null,
  selectedRoomIndex: null,
  selectedWall: null,
  selectedDoor: null,
  selectedWindow: null,
  
  // Theme and UI Configuration
  viewMode: '2d', // '2d' or '3d'
  currentStep: 1, // 1: Upload, 2: 2D Editor, 3: 3D Preview (Generate 3D), 4: 3D Interior
  toolMode: 'select', // 'select', 'draw_wall', 'add_door', 'add_window'
  currentStyle: 'modern',
  currentRoom: 'Living Room',
  gridVisible: true,
  gridSnap: false,
  gridSnapSize: 0.1, // in meters (10cm)
  activeTheme: 'light', // 'light' or 'dark'
  wallHeightDefaultCm: 280,
  wallThicknessDefaultCm: 15,
  
  // Transformations (2D Canvas View)
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isPanning: false,
  
  // PBR Materials Map (by room index/id or wall id)
  materialsMap: {
    rooms: {},   // { roomIndex: { floor: 'oak', wall: 'plaster', ceiling: 'plaster' } }
    walls: {},   // { wallId: { paintColor: '#f5f5f5', material: 'plaster', height: 280, thickness: 15 } }
    doors: {},   // { doorId: { color: '#5d4037', material: 'wood' } }
    windows: {}  // { windowId: { frameColor: '#2b2b2b', glassColor: '#e0f7fa' } }
  },
  
  // Clipboard
  copyBuffer: null,
  
  // Undo/Redo history stacks
  undoStack: [],
  redoStack: [],
  
  // Calibration Ruler
  calibration: {
    active: false,
    points: []
  },

  // Save the current state to the undo history stack
  saveHistory() {
    this.undoStack.push(JSON.stringify({
      placedItems: this.placedItems,
      materialsMap: this.materialsMap,
      blueprintData: this.blueprintData
    }));
    this.redoStack = []; // Clear redo stack on action
    this.triggerAutoSave();
  },

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.stringify({
      placedItems: this.placedItems,
      materialsMap: this.materialsMap,
      blueprintData: this.blueprintData
    }));
    const state = JSON.parse(this.undoStack.pop());
    this.placedItems = state.placedItems || [];
    this.materialsMap = state.materialsMap || { rooms: {}, walls: {} };
    this.blueprintData = state.blueprintData || null;
    this.selectedItem = null;
    this.triggerAutoSave();
    return true;
  },

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.stringify({
      placedItems: this.placedItems,
      materialsMap: this.materialsMap,
      blueprintData: this.blueprintData
    }));
    const state = JSON.parse(this.redoStack.pop());
    this.placedItems = state.placedItems || [];
    this.materialsMap = state.materialsMap || { rooms: {}, walls: {} };
    this.blueprintData = state.blueprintData || null;
    this.selectedItem = null;
    this.triggerAutoSave();
    return true;
  },

  // Clipboard operations
  copyItem() {
    if (this.selectedItem === null) return false;
    this.copyBuffer = JSON.stringify(this.placedItems[this.selectedItem]);
    return true;
  },

  pasteItem() {
    if (!this.copyBuffer) return false;
    this.saveHistory();
    const item = JSON.parse(this.copyBuffer);
    
    // Offset position slightly to avoid exact overlap
    item.x += 15;
    item.y += 15;
    
    this.placedItems.push(item);
    this.selectedItem = this.placedItems.length - 1;
    return true;
  },

  duplicateItem() {
    if (this.selectedItem === null) return false;
    this.saveHistory();
    const item = JSON.parse(JSON.stringify(this.placedItems[this.selectedItem]));
    item.x += 20;
    item.y += 20;
    this.placedItems.push(item);
    this.selectedItem = this.placedItems.length - 1;
    return true;
  },

  deleteSelection() {
    if (this.selectedItem !== null) {
      this.saveHistory();
      this.placedItems.splice(this.selectedItem, 1);
      this.selectedItem = null;
      return "item";
    }
    if (window.selectedWall !== undefined && window.selectedWall !== null) {
      this.saveHistory();
      this.blueprintData.walls = this.blueprintData.walls.filter(w => w !== window.selectedWall);
      window.selectedWall = null;
      if (window.recalculateRoomDimensions) window.recalculateRoomDimensions();
      return "wall";
    }
    if (window.selectedDoor !== undefined && window.selectedDoor !== null) {
      this.saveHistory();
      this.blueprintData.doors = this.blueprintData.doors.filter(d => d !== window.selectedDoor);
      window.selectedDoor = null;
      return "door";
    }
    if (window.selectedWindow !== undefined && window.selectedWindow !== null) {
      this.saveHistory();
      this.blueprintData.windows = this.blueprintData.windows.filter(w => w !== window.selectedWindow);
      window.selectedWindow = null;
      return "window";
    }
    return false;
  },

  splitWall(wall) {
    if (!this.blueprintData || !wall) return null;
    this.saveHistory();

    const mx = Math.round((wall.x1 + wall.x2) / 2);
    const my = Math.round((wall.y1 + wall.y2) / 2);

    // Create unique ID for new wall
    const maxId = this.blueprintData.walls.reduce((max, w) => Math.max(max, w.id || 0), 0);
    const newWall = {
      id: maxId + 1,
      x1: mx,
      y1: my,
      x2: wall.x2,
      y2: wall.y2,
      thickness: wall.thickness || 15,
      height: wall.height || 280,
      type: wall.type || 'interior'
    };

    // Update current wall endpoint
    wall.x2 = mx;
    wall.y2 = my;

    this.blueprintData.walls.push(newWall);
    if (window.recalculateRoomDimensions) window.recalculateRoomDimensions();
    this.triggerAutoSave();
    return newWall;
  },

  mergeWalls(wallA, wallB) {
    if (!this.blueprintData || !wallA || !wallB) return false;
    this.saveHistory();

    let merged = false;
    // Check joint endpoints and combine
    if (Math.hypot(wallA.x2 - wallB.x1, wallA.y2 - wallB.y1) < 5) {
      wallA.x2 = wallB.x2;
      wallA.y2 = wallB.y2;
      merged = true;
    } else if (Math.hypot(wallA.x1 - wallB.x2, wallA.y1 - wallB.y2) < 5) {
      wallA.x1 = wallB.x1;
      wallA.y1 = wallB.y1;
      merged = true;
    } else if (Math.hypot(wallA.x1 - wallB.x1, wallA.y1 - wallB.y1) < 5) {
      wallA.x1 = wallA.x2;
      wallA.y1 = wallA.y2;
      wallA.x2 = wallB.x2;
      wallA.y2 = wallB.y2;
      merged = true;
    } else if (Math.hypot(wallA.x2 - wallB.x2, wallA.y2 - wallB.y2) < 5) {
      wallA.x2 = wallB.x1;
      wallA.y2 = wallB.y1;
      merged = true;
    }

    if (merged) {
      this.blueprintData.walls = this.blueprintData.walls.filter(w => w !== wallB);
      if (window.recalculateRoomDimensions) window.recalculateRoomDimensions();
      this.triggerAutoSave();
      return true;
    }
    return false;
  },

  // Save/Load to Browser LocalStorage
  saveProjectLocally() {
    const project = {
      placedItems: this.placedItems,
      blueprintData: this.blueprintData,
      materialsMap: this.materialsMap,
      currentRoom: this.currentRoom,
      currentStyle: this.currentStyle,
      currentStep: this.currentStep
    };
    localStorage.setItem('homeforge_project_state', JSON.stringify(project));
    this.updateSaveIndicator();
  },

  loadProjectLocally() {
    const raw = localStorage.getItem('homeforge_project_state');
    if (!raw) return false;
    try {
      const project = JSON.parse(raw);
      this.placedItems = project.placedItems || [];
      this.blueprintData = project.blueprintData || null;
      this.materialsMap = project.materialsMap || { rooms: {}, walls: {} };
      this.currentRoom = project.currentRoom || 'Living Room';
      this.currentStyle = project.currentStyle || 'modern';
      this.currentStep = project.currentStep || 1;
      return true;
    } catch(e) {
      console.error("Error loading project state:", e);
      return false;
    }
  },

  // Autosave triggers
  autoSaveTimer: null,
  triggerAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveProjectLocally();
    }, 1500); // Auto-save after 1.5 seconds of inactivity
  },

  updateSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (el) {
      el.innerHTML = '⚡ Cloud Saved';
      el.style.opacity = '0.9';
      setTimeout(() => {
        el.style.opacity = '0.4';
      }, 2000);
    }
  }
};
