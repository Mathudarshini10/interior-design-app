const canvas = document.getElementById('room-canvas');
const ctx = canvas.getContext('2d');

// Centralized State Proxies
Object.defineProperty(window, 'placedItems', { get() { return State.placedItems; }, set(val) { State.placedItems = val; } });
Object.defineProperty(window, 'selectedItem', { get() { return State.selectedItem; }, set(val) { State.selectedItem = val; } });
Object.defineProperty(window, 'currentStyle', { get() { return State.currentStyle; }, set(val) { State.currentStyle = val; } });
Object.defineProperty(window, 'currentRoom', { get() { return State.currentRoom; }, set(val) { State.currentRoom = val; } });
Object.defineProperty(window, 'selectedRoomIndex', { get() { return State.selectedRoomIndex; }, set(val) { State.selectedRoomIndex = val; } });
Object.defineProperty(window, 'zoom', { get() { return State.zoom; }, set(val) { State.zoom = val; } });
Object.defineProperty(window, 'panX', { get() { return State.panX; }, set(val) { State.panX = val; } });
Object.defineProperty(window, 'panY', { get() { return State.panY; }, set(val) { State.panY = val; } });
Object.defineProperty(window, 'isPanning', { get() { return State.isPanning; }, set(val) { State.isPanning = val; } });
Object.defineProperty(window, 'gridVisible', { get() { return State.gridVisible; }, set(val) { State.gridVisible = val; } });
Object.defineProperty(window, 'blueprintData', { get() { return State.blueprintData; }, set(val) { State.blueprintData = val; } });
Object.defineProperty(window, 'blueprintImg', { get() { return State.blueprintImg; }, set(val) { State.blueprintImg = val; } });
Object.defineProperty(window, 'calibrationState', { get() { return State.calibration; }, set(val) { State.calibration = val; } });
Object.defineProperty(window, 'undoStack', { get() { return State.undoStack; }, set(val) { State.undoStack = val; } });
Object.defineProperty(window, 'redoStack', { get() { return State.redoStack; }, set(val) { State.redoStack = val; } });
Object.defineProperty(window, 'viewMode', { get() { return State.viewMode; }, set(val) { State.viewMode = val; } });
Object.defineProperty(window, 'toolMode', { get() { return State.toolMode; }, set(val) { State.toolMode = val; } });
Object.defineProperty(window, 'selectedWall', { get() { return State.selectedWall; }, set(val) { State.selectedWall = val; } });
Object.defineProperty(window, 'selectedDoor', { get() { return State.selectedDoor; }, set(val) { State.selectedDoor = val; } });
Object.defineProperty(window, 'selectedWindow', { get() { return State.selectedWindow; }, set(val) { State.selectedWindow = val; } });

let dragging = null;
let dragType = null; // 'item' or 'wall_endpoint'
let selectedWallEndpoint = null; // { wall, pt: 'start'|'end' }
let startPanX = 0, startPanY = 0;

// Canvas Drawing Tools State
window.isDrawingWall = false;
window.drawWallStart = { x: 0, y: 0 };
window.drawWallEnd = { x: 0, y: 0 };
window.snapPreviewOpening = null;

const ROOM_COLORS = {
  'Living Room': 'rgba(255, 249, 240, 0.65)',
  'Bedroom': 'rgba(240, 244, 255, 0.65)',
  'Kitchen': 'rgba(240, 255, 244, 0.65)',
  'Dining Room': 'rgba(255, 240, 240, 0.65)',
  'Bathroom': 'rgba(240, 255, 255, 0.65)',
  'Office': 'rgba(245, 240, 255, 0.65)',
  'Default': 'rgba(250, 250, 250, 0.5)'
};

const FURNITURE_IMAGES = {
  'Modern Sofa': '🛋️',
  'Oak Coffee Table': '🪑',
  'Bookshelf': '📚',
  'Dining Table': '🍽️',
  'Armchair': '💺',
  'Floor Lamp': '💡',
  'Wardrobe': '🚪',
  'King Bed': '🛏️'
};

function saveState() {
  State.saveHistory();
}

function undo() {
  UI.triggerUndo();
}

function redo() {
  UI.triggerRedo();
}

function setStyle(style) {
  currentStyle = style;
  document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadFurniture();
  getSuggestions();
}

function selectRoom(roomName) {
  if (window.UI && UI.selectRoom) {
    UI.selectRoom(roomName);
  } else {
    currentRoom = roomName;
    document.getElementById('current-room-label').textContent = roomName;
    getSuggestions();
    redraw();
  }
}

async function loadFurniture() {
  if (window.UI && UI.renderCatalog) {
    UI.renderCatalog();
  }
}

function startDrag(e, itemJson) {
  e.dataTransfer.setData('item', itemJson);
}

// Coordinate Transforms
function getModelCoordinates(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: (canvasX - panX) / zoom,
    y: (canvasY - panY) / zoom
  };
}

canvas.addEventListener('dragover', e => e.preventDefault());

canvas.addEventListener('drop', e => {
  e.preventDefault();
  const rawItem = e.dataTransfer.getData('item');
  if (!rawItem) return;
  saveState();
  const item = JSON.parse(decodeURIComponent(rawItem));
  const modelPt = getModelCoordinates(e.clientX, e.clientY);
  
  item.width = item.width || item.canvas_w || 60;
  item.height = item.height || item.canvas_h || 40;
  item.rotation = item.rotation || 0;
  
  item.x = modelPt.x - item.width / 2;
  item.y = modelPt.y - item.height / 2;
  
  placedItems.push(item);
  selectedItem = placedItems.length - 1;
  
  if (viewMode === '3d') build3DHouse();
  else redraw();
  updateTotal();
});

// Mouse Event Handlers for Drag/Pan/Edit
let lastMousePt = { x: 0, y: 0 };

canvas.addEventListener('mousedown', e => {
  const modelPt = getModelCoordinates(e.clientX, e.clientY);
  lastMousePt = { x: e.clientX, y: e.clientY };

  // 1. Check calibration mode
  if (calibrationState.active) {
    calibrationState.points.push(modelPt);
    redraw();
    if (calibrationState.points.length === 2) {
      setTimeout(finishCalibration, 100);
    }
    return;
  }

  // 2. If toolMode is 'draw_wall', start drawing a wall
  if (toolMode === 'draw_wall') {
    const snapPt = getSnappedPoint(modelPt);
    window.isDrawingWall = true;
    window.drawWallStart = snapPt;
    window.drawWallEnd = snapPt;
    redraw();
    return;
  }

  // 3. If toolMode is 'add_door' or 'add_window', place on click
  if ((toolMode === 'add_door' || toolMode === 'add_window') && window.snapPreviewOpening) {
    saveState();
    const type = toolMode === 'add_door' ? 'door' : 'window';
    const arr = type === 'door' ? blueprintData.doors : blueprintData.windows;
    
    // Create new opening
    const maxId = arr.reduce((max, item) => Math.max(max, item.id || 0), 0);
    const newOpening = {
      id: maxId + 1,
      x: window.snapPreviewOpening.x,
      y: window.snapPreviewOpening.y,
      width: window.snapPreviewOpening.width,
      thickness: window.snapPreviewOpening.thickness,
      angle: window.snapPreviewOpening.angle,
      type: type === 'door' ? 'single' : 'default'
    };
    
    arr.push(newOpening);
    
    // Clear preview and reset tool
    window.snapPreviewOpening = null;
    State.toolMode = 'select';
    if (window.UI && UI.updateBlueprintToolsUI) UI.updateBlueprintToolsUI();
    
    recalculateRoomDimensions();
    redraw();
    if (window.Exporter && Exporter.showNotification) {
      Exporter.showNotification(`Placed ${type === 'door' ? 'Door' : 'Window'} successfully!`);
    }
    return;
  }

  // 4. Default Select Mode interaction
  if (toolMode === 'select') {
    // A. Check wall endpoint selection (edit walls)
    if (blueprintData) {
      const snapLimit = 12 / zoom;
      for (let wall of blueprintData.walls) {
        if (Math.hypot(modelPt.x - wall.x1, modelPt.y - wall.y1) < snapLimit) {
          selectedWallEndpoint = { wall, pt: 'start' };
          dragType = 'wall_endpoint';
          return;
        }
        if (Math.hypot(modelPt.x - wall.x2, modelPt.y - wall.y2) < snapLimit) {
          selectedWallEndpoint = { wall, pt: 'end' };
          dragType = 'wall_endpoint';
          return;
        }
      }
    }

    // B. Check furniture item selection
    selectedItem = null;
    for (let i = placedItems.length - 1; i >= 0; i--) {
      const item = placedItems[i];
      if (modelPt.x >= item.x && modelPt.x <= item.x + item.width &&
          modelPt.y >= item.y && modelPt.y <= item.y + item.height) {
        saveState();
        dragging = i;
        selectedItem = i;
        dragType = 'item';
        lastMousePt = modelPt; // save model mouse offset
        selectedWall = null; // deselect wall
        selectedDoor = null;
        selectedWindow = null;
        if (window.UI && UI.showPropertiesPanel) UI.showPropertiesPanel('item', item);
        return;
      }
    }

    // C. Check wall body selection
    selectedWall = null;
    if (blueprintData) {
      const clickLimit = 10 / zoom;
      for (let wall of blueprintData.walls) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const lenSq = dx*dx + dy*dy;
        if (lenSq === 0) continue;
        
        let t = ((modelPt.x - wall.x1) * dx + (modelPt.y - wall.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = wall.x1 + t * dx;
        const projY = wall.y1 + t * dy;
        const dist = Math.hypot(modelPt.x - projX, modelPt.y - projY);
        
        if (dist < (wall.thickness / 2) + clickLimit) {
          selectedWall = wall;
          selectedItem = null;
          selectedDoor = null;
          selectedWindow = null;
          redraw();
          if (window.UI && UI.showPropertiesPanel) UI.showPropertiesPanel('wall', wall);
          return;
        }
      }
    }

    // D. Check door selection
    selectedDoor = null;
    if (blueprintData && blueprintData.doors) {
      const clickLimit = 15 / zoom;
      for (let door of blueprintData.doors) {
        const dist = Math.hypot(modelPt.x - door.x, modelPt.y - door.y);
        if (dist < door.width / 2 + clickLimit) {
          selectedDoor = door;
          selectedWall = null;
          selectedWindow = null;
          selectedItem = null;
          redraw();
          if (window.UI && UI.showPropertiesPanel) UI.showPropertiesPanel('door', door);
          return;
        }
      }
    }

    // E. Check window selection
    selectedWindow = null;
    if (blueprintData && blueprintData.windows) {
      const clickLimit = 15 / zoom;
      for (let win of blueprintData.windows) {
        const dist = Math.hypot(modelPt.x - win.x, modelPt.y - win.y);
        if (dist < win.width / 2 + clickLimit) {
          selectedWindow = win;
          selectedWall = null;
          selectedDoor = null;
          selectedItem = null;
          redraw();
          if (window.UI && UI.showPropertiesPanel) UI.showPropertiesPanel('window', win);
          return;
        }
      }
    }

    // F. Check room selection in blueprint
    if (blueprintData) {
      for (let i = 0; i < blueprintData.rooms.length; i++) {
        const room = blueprintData.rooms[i];
        if (pointInPolygon(modelPt.x, modelPt.y, room.polygon)) {
          selectedRoomIndex = i;
          selectRoom(room.name);
          selectedWall = null;
          selectedDoor = null;
          selectedWindow = null;
          if (window.UI && UI.showPropertiesPanel) UI.showPropertiesPanel('room', room);
          return;
        }
      }
    }
  }

  // 5. Fallback: Pan the canvas
  if (e.button === 1 || e.button === 0) {
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('mousemove', e => {
  const modelPt = getModelCoordinates(e.clientX, e.clientY);

  // 1. Draw wall preview
  if (toolMode === 'draw_wall' && window.isDrawingWall) {
    window.drawWallEnd = getSnappedPoint(modelPt);
    redraw();
    return;
  }

  // 2. Door / Window hover snap preview
  if (toolMode === 'add_door' || toolMode === 'add_window') {
    const snap = getWallSnapPoint(modelPt.x, modelPt.y);
    if (snap) {
      window.snapPreviewOpening = {
        type: toolMode === 'add_door' ? 'door' : 'window',
        x: snap.x,
        y: snap.y,
        angle: snap.angle,
        width: toolMode === 'add_door' ? 85 : 100, // standard sizes
        thickness: snap.wall.thickness + 2,
        wall: snap.wall
      };
    } else {
      window.snapPreviewOpening = null;
    }
    redraw();
    return;
  }

  // 3. Wall Endpoint Dragging
  if (dragType === 'wall_endpoint' && selectedWallEndpoint) {
    const { wall, pt } = selectedWallEndpoint;
    const oldX = pt === 'start' ? wall.x1 : wall.x2;
    const oldY = pt === 'start' ? wall.y1 : wall.y2;
    const snapped = getSnappedPoint(modelPt, wall);
    
    if (pt === 'start') {
      wall.x1 = snapped.x;
      wall.y1 = snapped.y;
    } else {
      wall.x2 = snapped.x;
      wall.y2 = snapped.y;
    }

    // Snapping room vertices
    if (blueprintData) {
      const snapLimit = 15;
      blueprintData.rooms.forEach(room => {
        room.polygon.forEach(vertex => {
          if (Math.hypot(vertex[0] - oldX, vertex[1] - oldY) < snapLimit) {
            vertex[0] = snapped.x;
            vertex[1] = snapped.y;
          }
        });
      });
    }

    recalculateRoomDimensions();
    redraw();
    return;
  }

  // 4. Furniture dragging
  if (dragType === 'item' && dragging !== null) {
    const item = placedItems[dragging];
    let newX = modelPt.x - item.width / 2;
    let newY = modelPt.y - item.height / 2;
    
    // Snapping furniture to walls if close (within 25px)
    const snap = getWallSnapPoint(modelPt.x, modelPt.y);
    if (snap && Math.hypot(snap.x - modelPt.x, snap.y - modelPt.y) < 25) {
      newX = snap.x - item.width / 2;
      newY = snap.y - item.height / 2;
      item.rotation = snap.angle; // align item to wall angle
    } else if (State.gridSnap) {
      const scale = blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
      const snapPx = State.gridSnapSize * scale;
      newX = Math.round(newX / snapPx) * snapPx;
      newY = Math.round(newY / snapPx) * snapPx;
    }
    
    item.x = Math.max(10, Math.min(canvas.width - item.width - 10, newX));
    item.y = Math.max(10, Math.min(canvas.height - item.height - 10, newY));
    redraw();
    return;
  }

  // 5. Canvas panning
  if (isPanning) {
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    redraw();
  }
});

canvas.addEventListener('mouseup', () => {
  if (window.isDrawingWall) {
    window.isDrawingWall = false;
    const dx = window.drawWallEnd.x - window.drawWallStart.x;
    const dy = window.drawWallEnd.y - window.drawWallStart.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 15 && blueprintData) {
      saveState();
      const maxId = blueprintData.walls.reduce((max, w) => Math.max(max, w.id || 0), 0);
      const newWall = {
        id: maxId + 1,
        x1: window.drawWallStart.x,
        y1: window.drawWallStart.y,
        x2: window.drawWallEnd.x,
        y2: window.drawWallEnd.y,
        thickness: State.wallThicknessDefaultCm || 15,
        height: State.wallHeightDefaultCm || 280,
        type: 'interior'
      };
      blueprintData.walls.push(newWall);
      if (window.recalculateRoomDimensions) window.recalculateRoomDimensions();
    }
    redraw();
  }

  dragging = null;
  selectedWallEndpoint = null;
  dragType = null;
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = 'default';
  }
});

// Double click to remove item or edit room name
canvas.addEventListener('dblclick', e => {
  const modelPt = getModelCoordinates(e.clientX, e.clientY);
  
  // Double-click furniture to remove
  let hitItem = false;
  placedItems = placedItems.filter((item, idx) => {
    const hit = (modelPt.x >= item.x && modelPt.x <= item.x + item.width &&
                 modelPt.y >= item.y && modelPt.y <= item.y + item.height);
    if (hit) {
      hitItem = true;
      if (selectedItem === idx) selectedItem = null;
    }
    return !hit;
  });

  if (hitItem) {
    saveState();
    redraw();
    updateTotal();
    return;
  }

  // Double-click room label to rename it
  if (blueprintData) {
    for (let room of blueprintData.rooms) {
      const dist = Math.hypot(modelPt.x - room.centroid[0], modelPt.y - room.centroid[1]);
      if (dist < 30) {
        const newName = prompt(`Rename room "${room.name}" to:`, room.name);
        if (newName) {
          room.name = newName;
          if (currentRoom === room.name) {
            document.getElementById('current-room-label').textContent = newName;
          }
          redraw();
        }
        return;
      }
    }
  }
});

// Mouse Wheel Zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  const modelX = (canvasX - panX) / zoom;
  const modelY = (canvasY - panY) / zoom;
  
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
  zoom = Math.max(0.1, Math.min(8.0, zoom * zoomFactor));
  
  panX = canvasX - modelX * zoom;
  panY = canvasY - modelY * zoom;
  
  redraw();
});

// Keyboard support (Space to Pan, Delete to Remove)
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  if (e.key === ' ' || e.code === 'Space') {
    canvas.style.cursor = 'grab';
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const deletedType = State.deleteSelection();
    if (deletedType) {
      if (viewMode === '3d') build3DHouse();
      else redraw();
      updateTotal();
      if (window.Exporter && Exporter.showNotification) {
        const typeNames = { item: 'Item', wall: 'Wall segment', door: 'Door', window: 'Window' };
        Exporter.showNotification(`🗑️ ${typeNames[deletedType]} deleted`);
      }
    }
  }
});

// Point-in-polygon raycasting check
function pointInPolygon(x, y, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Redraw Canvas
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // 1. Draw Blueprint Background Image (if loaded)
  if (blueprintImg) {
    ctx.drawImage(blueprintImg, 0, 0);
  } else {
    // Standard background room color
    ctx.fillStyle = ROOM_COLORS[currentRoom] || ROOM_COLORS['Default'];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 2. Draw Interactive Grid
  if (gridVisible) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1 / zoom;
    const gridSize = 40;
    
    // Draw grid covering visible area
    const startX = Math.floor(-panX / (gridSize * zoom)) * gridSize;
    const endX = startX + Math.ceil(canvas.width / (gridSize * zoom)) * gridSize + gridSize;
    const startY = Math.floor(-panY / (gridSize * zoom)) * gridSize;
    const endY = startY + Math.ceil(canvas.height / (gridSize * zoom)) * gridSize + gridSize;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }
  }

  // 3. Draw Blueprint Features
  if (blueprintData) {
    // A. Draw Room Boundaries
    blueprintData.rooms.forEach((room, index) => {
      if (!room.polygon || room.polygon.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(room.polygon[0][0], room.polygon[0][1]);
      for (let i = 1; i < room.polygon.length; i++) {
        ctx.lineTo(room.polygon[i][0], room.polygon[i][1]);
      }
      ctx.closePath();
      
      const isSelected = index === selectedRoomIndex;
      ctx.fillStyle = isSelected ? 'rgba(233, 69, 96, 0.2)' : ROOM_COLORS[room.name] || ROOM_COLORS['Default'];
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#e94560' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
      
      // Draw Room Label and Centred details
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `bold ${Math.max(10, 14 / zoom)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(room.name, room.centroid[0], room.centroid[1]);
      
      ctx.fillStyle = '#666';
      ctx.font = `${Math.max(8, 10 / zoom)}px Segoe UI, sans-serif`;
      ctx.fillText(`${room.area_sq_m} m² (${room.width_m}x${room.depth_m}m)`, room.centroid[0], room.centroid[1] + 15 / zoom);
    });

    // B. Draw Walls (as solid dark structures)
    blueprintData.walls.forEach(wall => {
      const isWallSelected = wall === selectedWall;
      if (isWallSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)';
        ctx.lineWidth = wall.thickness + 8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.strokeStyle = wall.type === 'exterior' ? '#222' : '#555';
      ctx.lineWidth = wall.thickness;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw measurements label
      const scale = blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const lenM = Math.hypot(dx, dy) / scale;
      if (lenM > 0.1) {
        ctx.save();
        ctx.translate((wall.x1 + wall.x2)/2, (wall.y1 + wall.y2)/2);
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI/2 || angle < -Math.PI/2) {
          angle += Math.PI;
        }
        ctx.rotate(angle);
        ctx.fillStyle = isWallSelected ? '#00b4ff' : '#455a64';
        ctx.font = `bold ${Math.max(9, 10 / zoom)}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(lenM.toFixed(2) + " m", 0, -(wall.thickness / 2 + 5));
        ctx.restore();
      }

      // Draw endpoints handles if zoom is close enough
      if (zoom > 0.5) {
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(wall.x1, wall.y1, 4 / zoom, 0, 2 * Math.PI);
        ctx.arc(wall.x2, wall.y2, 4 / zoom, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // C. Draw Doors
    blueprintData.doors.forEach(door => {
      const isDoorSelected = door === selectedDoor;
      ctx.save();
      ctx.translate(door.x, door.y);
      ctx.rotate(door.angle * Math.PI / 180);
      
      if (isDoorSelected) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)';
        ctx.lineWidth = door.thickness + 12;
        ctx.beginPath(); ctx.moveTo(-door.width / 2, 0); ctx.lineTo(door.width / 2, 0); ctx.stroke();
        ctx.restore();
      }

      // Draw door opening gap as empty
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = door.thickness + 2;
      ctx.beginPath(); ctx.moveTo(-door.width / 2, 0); ctx.lineTo(door.width / 2, 0); ctx.stroke();
      
      // Draw door swing arc
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(-door.width / 2, 0, door.width, 0, -Math.PI / 2, true);
      ctx.stroke();
      
      // Draw door leaf
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 4 / zoom;
      ctx.beginPath();
      ctx.moveTo(-door.width / 2, 0);
      ctx.lineTo(-door.width / 2, -door.width);
      ctx.stroke();

      ctx.restore();
    });

    // D. Draw Windows
    blueprintData.windows.forEach(win => {
      const isWinSelected = win === selectedWindow;
      ctx.save();
      ctx.translate(win.x, win.y);
      ctx.rotate(win.angle * Math.PI / 180);
      
      if (isWinSelected) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 180, 255, 0.35)';
        ctx.fillRect(-win.width / 2 - 4, -win.thickness / 2 - 4, win.width + 8, win.thickness + 8);
        ctx.restore();
      }

      // Draw window structure: double parallel lines
      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(-win.width / 2, -win.thickness / 2, win.width, win.thickness);
      
      ctx.strokeStyle = '#1565c0';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(-win.width / 2, -win.thickness / 2);
      ctx.lineTo(win.width / 2, -win.thickness / 2);
      ctx.moveTo(-win.width / 2, win.thickness / 2);
      ctx.lineTo(win.width / 2, win.thickness / 2);
      ctx.stroke();
      
      // Glass pane
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(-win.width / 2, 0);
      ctx.lineTo(win.width / 2, 0);
      ctx.stroke();

      ctx.restore();
    });

    // E. Draw Wall Drawing Preview
    if (window.isDrawingWall) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(window.drawWallStart.x, window.drawWallStart.y);
      ctx.lineTo(window.drawWallEnd.x, window.drawWallEnd.y);
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.6)';
      ctx.lineWidth = State.wallThicknessDefaultCm || 15;
      ctx.lineCap = 'round';
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.restore();

      const scale = blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
      const dx = window.drawWallEnd.x - window.drawWallStart.x;
      const dy = window.drawWallEnd.y - window.drawWallStart.y;
      const lenM = Math.hypot(dx, dy) / scale;
      if (lenM > 0.1) {
        ctx.save();
        ctx.translate((window.drawWallStart.x + window.drawWallEnd.x)/2, (window.drawWallStart.y + window.drawWallEnd.y)/2);
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI/2 || angle < -Math.PI/2) {
          angle += Math.PI;
        }
        ctx.rotate(angle);
        ctx.fillStyle = '#00b4ff';
        ctx.font = `bold ${Math.max(10, 12 / zoom)}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(lenM.toFixed(2) + " m", 0, -12);
        ctx.restore();
      }
    }

    // F. Draw Snapped Door/Window Preview
    if (window.snapPreviewOpening) {
      ctx.save();
      ctx.translate(window.snapPreviewOpening.x, window.snapPreviewOpening.y);
      ctx.rotate(window.snapPreviewOpening.angle * Math.PI / 180);

      ctx.fillStyle = 'rgba(0, 180, 255, 0.2)';
      ctx.fillRect(-window.snapPreviewOpening.width / 2, -window.snapPreviewOpening.thickness / 2, window.snapPreviewOpening.width, window.snapPreviewOpening.thickness);
      ctx.strokeStyle = '#00b4ff';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(-window.snapPreviewOpening.width / 2, -window.snapPreviewOpening.thickness / 2, window.snapPreviewOpening.width, window.snapPreviewOpening.thickness);

      ctx.fillStyle = '#00b4ff';
      ctx.font = `bold ${Math.max(10, 12 / zoom)}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(window.snapPreviewOpening.type === 'door' ? '🚪' : '🪟', 0, 4);

      ctx.restore();
    }
  } else {
    // Fallback: draw 2D walls around the simple canvas
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    // Door indicator
    ctx.fillStyle = '#888';
    ctx.fillRect(canvas.width / 2 - 30, 0, 60, 6);
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.fillText('DOOR', canvas.width / 2 - 14, 18);

    // Room Label
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(currentRoom, 16, 30);
  }

  // 4. Draw Placed Furniture Items
  placedItems.forEach((item, idx) => {
    const isSelected = idx === selectedItem;

    ctx.save();
    ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
    // Support rotation (not fully exposed in standard HTML buttons yet, but state-ready)
    if (item.rotation) ctx.rotate(item.rotation);

    // Item Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-item.width / 2 + 4, -item.height / 2 + 4, item.width, item.height);

    // Item Body
    ctx.fillStyle = item.color || '#a0c4ff';
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, 6);
    ctx.fill();

    // Border Selection Highlight
    ctx.strokeStyle = isSelected ? '#e94560' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = isSelected ? 2.5 / zoom : 1 / zoom;
    ctx.beginPath();
    ctx.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, 6);
    ctx.stroke();

    // Emoji drawing
    ctx.font = `${Math.min(item.width, item.height) * 0.45}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(FURNITURE_IMAGES[item.name] || '🪑', 0, -2);

    // Name Tag
    ctx.fillStyle = '#222';
    ctx.font = `bold ${Math.max(8, 10 / zoom)}px Segoe UI, sans-serif`;
    ctx.fillText(item.name, 0, item.height / 2 - 8);

    ctx.restore();
  });

  // 5. Draw Scale Measurement Ruler (bottom right)
  const scalePxPerMeter = blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
  const rulerWidthPx = scalePxPerMeter; // 1 meter length ruler
  
  ctx.restore(); // Restore temporary transform to draw UI static on top

  // Draw Ruler in bottom-right corner of screen
  ctx.save();
  ctx.translate(canvas.width - 120, canvas.height - 30);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#333';
  ctx.font = '10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(0, 0);
  ctx.lineTo(rulerWidthPx * zoom, 0);
  ctx.lineTo(rulerWidthPx * zoom, 5);
  ctx.stroke();
  
  ctx.fillText('1.0 m', (rulerWidthPx * zoom) / 2, -5);
  ctx.restore();

  // 6. Draw Calibration temporary points and line
  if (calibrationState.active && calibrationState.points.length > 0) {
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    
    ctx.fillStyle = '#e94560';
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2 / zoom;
    
    // First point
    ctx.beginPath();
    ctx.arc(calibrationState.points[0].x, calibrationState.points[0].y, 5 / zoom, 0, 2 * Math.PI);
    ctx.fill();
    
    if (calibrationState.points.length === 2) {
      // Second point
      ctx.beginPath();
      ctx.arc(calibrationState.points[1].x, calibrationState.points[1].y, 5 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      
      // Connecting line
      ctx.beginPath();
      ctx.moveTo(calibrationState.points[0].x, calibrationState.points[0].y);
      ctx.lineTo(calibrationState.points[1].x, calibrationState.points[1].y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Canvas Viewer Control Actions
function zoomCanvas(factor, e = null) {
  if (e) {
    // Zoom centered on event mouse coords
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const mx = (cx - panX) / zoom;
    const my = (cy - panY) / zoom;
    
    zoom = Math.max(0.1, Math.min(8.0, zoom * factor));
    panX = cx - mx * zoom;
    panY = cy - my * zoom;
  } else {
    // Zoom centered on canvas middle
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const mx = (cx - panX) / zoom;
    const my = (cy - panY) / zoom;
    
    zoom = Math.max(0.1, Math.min(8.0, zoom * factor));
    panX = cx - mx * zoom;
    panY = cy - my * zoom;
  }
  redraw();
}

function fitToScreen() {
  if (!blueprintImg) {
    resetView();
    return;
  }
  
  // Calculate scaling to fit blueprint inside canvas
  const padding = 20;
  const availW = canvas.width - padding * 2;
  const availH = canvas.height - padding * 2;
  
  const scaleX = availW / blueprintImg.width;
  const scaleY = availH / blueprintImg.height;
  
  zoom = Math.min(scaleX, scaleY);
  
  // Center it
  panX = (canvas.width - blueprintImg.width * zoom) / 2;
  panY = (canvas.height - blueprintImg.height * zoom) / 2;
  
  redraw();
}

function resetView() {
  zoom = 1.0;
  panX = 0;
  panY = 0;
  redraw();
}

function toggleGrid() {
  gridVisible = !gridVisible;
  const btn = document.getElementById('grid-toggle-btn');
  btn.style.opacity = gridVisible ? '1.0' : '0.4';
  redraw();
}

// Calibration logic
function startCalibration() {
  calibrationState = { active: true, points: [] };
  document.getElementById('calibration-banner').style.display = 'flex';
  canvas.style.cursor = 'crosshair';
}

function cancelCalibration() {
  calibrationState = { active: false, points: [] };
  document.getElementById('calibration-banner').style.display = 'none';
  canvas.style.cursor = 'default';
  redraw();
}

function finishCalibration() {
  const points = calibrationState.points;
  const distPixels = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  
  const distMeters = prompt("📐 Enter the real-world distance between the selected points in METERS (e.g. 3.0 or 0.9):");
  const parsedVal = parseFloat(distMeters);
  
  if (!isNaN(parsedVal) && parsedVal > 0) {
    const pxPerMeter = distPixels / parsedVal;
    
    if (blueprintData) {
      blueprintData.metadata.scale_pixels_per_meter = parseFloat(pxPerMeter.toFixed(2));
      recalculateRoomDimensions();
    }
    alert(`✅ Scale Calibrated!\n${pxPerMeter.toFixed(2)} pixels per meter.`);
  } else {
    alert("❌ Calibration cancelled: invalid value.");
  }
  
  cancelCalibration();
}

function recalculateRoomDimensions() {
  if (!blueprintData) return;
  const scale = blueprintData.metadata.scale_pixels_per_meter;
  blueprintData.rooms.forEach(room => {
    // Recompute area, width, depth from polygon
    const areaPx = polygonArea(room.polygon);
    room.area_sq_m = parseFloat((areaPx / (scale * scale)).toFixed(2));
    
    // Perimeter in meters
    let perimeterPx = 0;
    for (let i = 0; i < room.polygon.length; i++) {
      const p1 = room.polygon[i];
      const p2 = room.polygon[(i + 1) % room.polygon.length];
      perimeterPx += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    }
    room.perimeter_m = parseFloat((perimeterPx / scale).toFixed(2));
  });
}

// Compute polygon area in pixels
function polygonArea(poly) {
  let area = 0;
  let j = poly.length - 1;
  for (let i = 0; i < poly.length; i++) {
    area += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    j = i;
  }
  return Math.abs(area / 2);
}

function updateTotal() {
  const total = placedItems.reduce((sum, i) => sum + i.price, 0);
  document.getElementById('total-price').textContent = '₹' + total.toLocaleString();
  document.getElementById('item-count').textContent = placedItems.length + ' items';
}

function clearCanvas() {
  if (placedItems.length === 0) return;
  if (confirm('Clear all furniture from canvas?')) {
    saveState();
    placedItems = [];
    selectedItem = null;
    redraw();
    updateTotal();
  }
}

async function getSuggestions() {
  const res = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style: currentStyle, room: currentRoom })
  });
  const data = await res.json();
  const box = document.getElementById('suggestions');
  if (box) {
    box.innerHTML = data.suggestions.map(s => `
      <div class="suggestion-card" draggable="true"
        ondragstart="startDrag(event, '${encodeURIComponent(JSON.stringify(s))}')"
      >
        <span style="font-size:20px">${FURNITURE_IMAGES[s.name] || '🪑'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600">${s.name}</div>
          <div style="font-size:11px;color:#888">₹${s.price.toLocaleString()}</div>
        </div>
        <span style="font-size:18px;color:#aaa">＋</span>
      </div>
    `).join('');
  }
}

async function generateQuote() {
  if (placedItems.length === 0) { alert('Add some furniture first!'); return; }
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: placedItems, room: currentRoom })
  });
  const data = await res.json();
  let msg = `📋 QUOTE — ${currentRoom}\n${'─'.repeat(30)}\n\n`;
  data.items.forEach(i => { msg += `${FURNITURE_IMAGES[i.name] || '•'} ${i.name}: ₹${i.price.toLocaleString()}\n`; });
  msg += `\n${'─'.repeat(30)}\n💰 TOTAL: ₹${data.total.toLocaleString()}`;
  alert(msg);
}

// Blueprint Upload is now handled inside UI.handleBlueprintUpload in ui.js

// Initialization
loadFurniture();
getSuggestions();
redraw();

// View Mode Toggle Handler
function setViewMode(mode) {
  viewMode = mode;
  
  const btn2d = document.getElementById('btn-2d') || document.getElementById('btn-toggle-2d');
  const btn3d = document.getElementById('btn-3d') || document.getElementById('btn-toggle-3d');
  const roomCanvas = document.getElementById('room-canvas');
  const threeCont = document.getElementById('three-container');
  const controls2d = document.querySelector('.viewer-controls');
  const hint = document.querySelector('.canvas-hint');
  
  if (mode === '3d') {
    if (btn2d) {
      btn2d.classList.remove('active');
      btn2d.style.background = '#f0f0f0';
      btn2d.style.color = '#333';
    }
    if (btn3d) {
      btn3d.classList.add('active');
      btn3d.style.background = '#1a1a2e';
      btn3d.style.color = 'white';
    }
    
    if (roomCanvas) roomCanvas.style.display = 'none';
    if (controls2d) controls2d.style.display = 'none';
    if (threeCont) threeCont.style.display = 'block';
    
    if (hint) hint.textContent = "👁️ 3D View: Drag to Orbit, Right-Click to Pan. Click furniture/wall to select. [T] Move, [R] Rotate.";
    
    if (!isThreeInitialized) {
      initThree();
    }
    
    build3DHouse();
  } else {
    if (btn3d) {
      btn3d.classList.remove('active');
      btn3d.style.background = '#f0f0f0';
      btn3d.style.color = '#333';
    }
    if (btn2d) {
      btn2d.classList.add('active');
      btn2d.style.background = '#1a1a2e';
      btn2d.style.color = 'white';
    }
    
    if (threeCont) threeCont.style.display = 'none';
    if (roomCanvas) roomCanvas.style.display = 'block';
    if (controls2d) controls2d.style.display = 'flex';
    
    if (hint) hint.textContent = "Drag furniture from left or hold Space/Middle-Click to Pan";
    redraw();
  }
}

// Snapping and grid helpers for Floor Plan Editor
function getWallSnapPoint(x, y) {
  if (!blueprintData) return null;
  const clickLimit = 25 / zoom;
  let bestSnap = null;
  let minDistance = clickLimit;

  for (let wall of blueprintData.walls) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) continue;
    
    let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / lenSq;
    t = Math.max(0.05, Math.min(0.95, t)); // Keep away from joint corners
    const projX = wall.x1 + t * dx;
    const projY = wall.y1 + t * dy;
    const dist = Math.hypot(x - projX, y - projY);

    if (dist < minDistance) {
      minDistance = dist;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      bestSnap = { x: projX, y: projY, angle, wall };
    }
  }
  return bestSnap;
}

function getSnappedPoint(modelPt, ignoreWall = null) {
  let x = modelPt.x;
  let y = modelPt.y;

  // 1. Grid snap (if enabled)
  if (State.gridSnap) {
    const scale = blueprintData?.metadata?.scale_pixels_per_meter || 60.0;
    const snapPx = State.gridSnapSize * scale;
    x = Math.round(x / snapPx) * snapPx;
    y = Math.round(y / snapPx) * snapPx;
  }

  // 2. Corner snap to existing wall endpoints
  if (blueprintData) {
    const snapLimit = 15 / zoom;
    for (let wall of blueprintData.walls) {
      if (wall === ignoreWall) continue;
      if (Math.hypot(x - wall.x1, y - wall.y1) < snapLimit) {
        return { x: wall.x1, y: wall.y1 };
      }
      if (Math.hypot(x - wall.x2, y - wall.y2) < snapLimit) {
        return { x: wall.x2, y: wall.y2 };
      }
    }
  }

  return { x, y };
}

function recalculateRoomDimensions() {
  if (!blueprintData) return;
  const scale = blueprintData.metadata.scale_pixels_per_meter || 60.0;

  blueprintData.rooms.forEach(room => {
    // 1. Calculate centroid
    let sumX = 0, sumY = 0;
    room.polygon.forEach(pt => {
      sumX += pt[0];
      sumY += pt[1];
    });
    room.centroid = [sumX / room.polygon.length, sumY / room.polygon.length];

    // 2. Calculate area using Shoelace formula
    let area = 0;
    const n = room.polygon.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += room.polygon[i][0] * room.polygon[j][1];
      area -= room.polygon[j][0] * room.polygon[i][1];
    }
    area = Math.abs(area) / 2;
    
    // Convert pixels^2 to meters^2
    const areaSqM = area / (scale * scale);
    room.area_sq_m = areaSqM.toFixed(1);

    // 3. Estimate width and depth from bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    room.polygon.forEach(pt => {
      minX = Math.min(minX, pt[0]);
      maxX = Math.max(maxX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxY = Math.max(maxY, pt[1]);
    });
    room.width_m = ((maxX - minX) / scale).toFixed(1);
    room.depth_m = ((maxY - minY) / scale).toFixed(1);
  });
}
