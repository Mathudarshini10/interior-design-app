// AI Interior Designer Engine - Layout Planner and Style Recommendations

const AIDesigner = {
  // Styles presets
  styles: {
    modern: {
      wallColor: '#f5f5f5', // off-white
      floorMaterial: 'wood',
      ceilingMaterial: 'plaster',
      suggestedLighting: 'ambient',
      palette: ['#212121', '#424242', '#0d47a1', '#eeeeee']
    },
    minimalist: {
      wallColor: '#ffffff',
      floorMaterial: 'concrete',
      ceilingMaterial: 'plaster',
      suggestedLighting: 'spot',
      palette: ['#ffffff', '#f5f5f5', '#9e9e9e', '#1a1a2e']
    },
    luxury: {
      wallColor: '#1e1e2f', // dark charcoal
      floorMaterial: 'marble',
      ceilingMaterial: 'plaster',
      suggestedLighting: 'ambient',
      palette: ['#ffd700', '#2b2b36', '#ffffff', '#4e342e']
    },
    scandinavian: {
      wallColor: '#faf8f5', // warm beige
      floorMaterial: 'wood',
      ceilingMaterial: 'plaster',
      suggestedLighting: 'ambient',
      palette: ['#b0bec5', '#e5c185', '#8d6e63', '#ffffff']
    },
    industrial: {
      wallColor: '#e0e0e0', // brick / concrete look
      floorMaterial: 'concrete',
      ceilingMaterial: 'concrete',
      suggestedLighting: 'spot',
      palette: ['#3e3d3a', '#757575', '#d84315', '#cfd8dc']
    }
  },

  // Automatically design a selected room based on chosen style
  generateDesign(roomIndex, styleName) {
    if (!State.blueprintData) {
      alert("Please upload a floor plan blueprint first!");
      return;
    }

    // Auto detect rooms from walls if rooms list is empty
    if (!State.blueprintData.rooms || State.blueprintData.rooms.length === 0) {
      if (window.autoDetectRoomsFromWalls) {
        window.autoDetectRoomsFromWalls();
      }
    }

    // Fallback: default to first room
    if (roomIndex === null || roomIndex === undefined || roomIndex >= State.blueprintData.rooms.length) {
      if (State.blueprintData.rooms && State.blueprintData.rooms.length > 0) {
        roomIndex = 0;
      } else {
        alert("No rooms detected in the floor plan to design!");
        return;
      }
    }

    const room = State.blueprintData.rooms[roomIndex];
    const style = this.styles[styleName] || this.styles.modern;
    const scale = State.blueprintData.metadata.scale_pixels_per_meter || 60.0;
    
    State.saveHistory(); // save history for undo

    // 1. Assign PBR materials to the room in the state
    State.materialsMap.rooms[roomIndex] = {
      floor: style.floorMaterial,
      wall: 'plaster', // default plaster base
      wallColor: style.wallColor,
      ceiling: style.ceilingMaterial
    };

    // 2. Clear old furniture placed inside this specific room polygon bounds
    State.placedItems = State.placedItems.filter(item => {
      const itemCenterX = item.x + item.width / 2;
      const itemCenterY = item.y + item.height / 2;
      return !pointInPolygon(itemCenterX, itemCenterY, room.polygon);
    });

    // 3. Select furniture matching style and room function
    const suggestions = this._selectFurnitureForRoom(room.name, styleName);
    
    // 4. Arrange furniture inside the room polygon geometrically
    this._arrangeFurniture(room, suggestions, scale);

    // 5. Update viewer
    if (State.viewMode === '3d') {
      build3DHouse();
    } else {
      redraw();
    }
    updateTotal();
    
    Exporter.showNotification(`🤖 AI: Design generated in ${styleName} style!`);
  },

  // Gather furniture templates from database matching category and style
  _selectFurnitureForRoom(roomName, styleName) {
    // Standardize room category
    let category = "Living Room";
    if (roomName.includes("Bedroom")) category = "Bedroom";
    else if (roomName.includes("Kitchen")) category = "Kitchen";
    else if (roomName.includes("Bathroom")) category = "Bathroom";
    else if (roomName.includes("Office")) category = "Office";

    const pool = FurnitureCatalog.filter(f => f.category === category);
    
    // Sort pool: prefer selected style, fallback to matching category items
    const selected = [];
    
    // We want a standard set of core pieces for each room
    if (category === "Living Room") {
      selected.push(this._findItem(pool, "Sofa", styleName));
      selected.push(this._findItem(pool, "Coffee Table", styleName));
      selected.push(this._findItem(pool, "TV Unit", styleName));
      selected.push(this._findItem(pool, "Lamp", styleName));
      selected.push(this._findItem(pool, "Plant", styleName));
    } else if (category === "Bedroom") {
      selected.push(this._findItem(pool, "Bed", styleName));
      selected.push(this._findItem(pool, "Wardrobe", styleName));
      selected.push(this._findItem(pool, "Nightstand", styleName));
      selected.push(this._findItem(pool, "Desk", styleName));
    } else if (category === "Kitchen") {
      selected.push(this._findItem(pool, "Dining Table", styleName));
      selected.push(this._findItem(pool, "Chair", styleName));
      selected.push(this._findItem(pool, "Refrigerator", styleName));
      selected.push(this._findItem(pool, "Island", styleName));
    } else if (category === "Bathroom") {
      selected.push(this._findItem(pool, "Vanity", styleName));
      selected.push(this._findItem(pool, "Toilet", styleName));
      selected.push(this._findItem(pool, "Bathtub", styleName));
    } else {
      // General Office
      selected.push(this._findItem(pool, "Desk", styleName));
      selected.push(this._findItem(pool, "Chair", styleName));
      selected.push(this._findItem(pool, "Bookshelf", styleName));
    }

    return selected.filter(x => x !== null);
  },

  _findItem(pool, keyword, styleName) {
    // 1. Try exact keyword + styleName match
    let match = pool.find(f => f.name.includes(keyword) && f.style === styleName);
    if (match) return match;
    // 2. Try keyword match
    match = pool.find(f => f.name.includes(keyword));
    return match || null;
  },

  // Arrange pieces geometrically inside room bounds
  _arrangeFurniture(room, templates, scale) {
    const polygon = room.polygon;
    const cx = room.centroid[0];
    const cy = room.centroid[1];

    // Find room orientation by fitting a bounding box
    // Let's identify the room bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    polygon.forEach(pt => {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    });

    const roomW = maxX - minX;
    const roomH = maxY - minY;

    // Room boundaries details
    const roomCategory = room.name;

    templates.forEach(tpl => {
      // Clone template parameters into placedItem state object
      const item = JSON.parse(JSON.stringify(tpl));
      item.rotation = 0;

      // Layout heuristics based on room categories and item types
      if (roomCategory.includes("Bedroom")) {
        if (item.name.includes("Bed")) {
          // Place Bed centered flat against the top wall segment
          item.x = cx - item.canvas_w / 2;
          item.y = minY + 15; // slightly offset from top boundary wall
          item.rotation = 0; // facing down
        } else if (item.name.includes("Nightstand")) {
          // Bed side table: place left of bed
          item.x = cx - item.canvas_w / 2 - 70;
          item.y = minY + 15;
        } else if (item.name.includes("Wardrobe")) {
          // Place along right wall
          item.x = maxX - item.canvas_w - 15;
          item.y = cy - item.canvas_h / 2;
          item.rotation = -Math.PI / 2; // face left
        } else if (item.name.includes("Desk")) {
          // Place along bottom wall
          item.x = cx - item.canvas_w / 2;
          item.y = maxY - item.canvas_h - 15;
        }
      } else if (roomCategory.includes("Living Room")) {
        if (item.name.includes("Sofa")) {
          // Main sofa centered facing TV wall
          item.x = cx - item.canvas_w / 2;
          item.y = cy - 20;
          item.rotation = 0;
        } else if (item.name.includes("Table")) {
          // Coffee table centered in front of Sofa
          item.x = cx - item.canvas_w / 2;
          item.y = cy + 45;
        } else if (item.name.includes("TV Unit")) {
          // TV Unit against bottom wall
          item.x = cx - item.canvas_w / 2;
          item.y = maxY - item.canvas_h - 15;
          item.rotation = Math.PI; // face up
        } else if (item.name.includes("Lamp")) {
          // Corner lamp
          item.x = minX + 15;
          item.y = minY + 15;
        } else if (item.name.includes("Plant")) {
          // Other corner
          item.x = maxX - item.canvas_w - 15;
          item.y = minY + 15;
        }
      } else if (roomCategory.includes("Kitchen")) {
        if (item.name.includes("Table")) {
          // Dining Table in center
          item.x = cx - item.canvas_w / 2;
          item.y = cy - item.canvas_h / 2;
        } else if (item.name.includes("Refrigerator")) {
          // Refrigerator against wall corner
          item.x = minX + 15;
          item.y = minY + 15;
        } else if (item.name.includes("Island")) {
          // Kitchen island off-center
          item.x = cx + 50;
          item.y = cy - 40;
        }
      } else if (roomCategory.includes("Bathroom")) {
        if (item.name.includes("Vanity")) {
          // Sink vanity along left wall
          item.x = minX + 15;
          item.y = cy - item.canvas_h / 2;
          item.rotation = Math.PI / 2; // face right
        } else if (item.name.includes("Toilet")) {
          // Toilet next to vanity
          item.x = minX + 15;
          item.y = maxY - item.canvas_h - 30;
          item.rotation = Math.PI / 2;
        } else if (item.name.includes("Bathtub")) {
          // Bath along right wall
          item.x = maxX - item.canvas_w - 15;
          item.y = cy - item.canvas_h / 2;
          item.rotation = -Math.PI / 2; // face left
        }
      } else {
        // Office/Generic layouts
        if (item.name.includes("Desk")) {
          item.x = cx - item.canvas_w / 2;
          item.y = cy - item.canvas_h / 2 - 20;
        } else if (item.name.includes("Chair")) {
          item.x = cx - item.canvas_w / 2;
          item.y = cy + 25;
        } else if (item.name.includes("Bookshelf")) {
          item.x = minX + 15;
          item.y = cy - item.canvas_h / 2;
          item.rotation = Math.PI / 2;
        }
      }

      // Check if the calculated position lies inside the room polygon contour bounds.
      // If it leaks or hits walls, nudge it towards the centroid to fit perfectly!
      let itemCenterX = item.x + item.canvas_w / 2;
      let itemCenterY = item.y + item.canvas_h / 2;
      
      let safetyCounter = 0;
      while (!pointInPolygon(itemCenterX, itemCenterY, polygon) && safetyCounter < 10) {
        // Vector pointing from item center to room centroid
        const dx = cx - itemCenterX;
        const dy = cy - itemCenterY;
        
        // Nudge item 10% closer to centroid
        item.x += dx * 0.25;
        item.y += dy * 0.25;
        
        itemCenterX = item.x + item.canvas_w / 2;
        itemCenterY = item.y + item.canvas_h / 2;
        safetyCounter++;
      }

      // Final bounding collision clamp to keep item within room limits
      item.x = Math.max(minX + 8, Math.min(maxX - item.canvas_w - 8, item.x));
      item.y = Math.max(minY + 8, Math.min(maxY - item.canvas_h - 8, item.y));

      // Push it to final placed items
      // Map canvas sizes
      item.width = item.canvas_w;
      item.height = item.canvas_h;

      State.placedItems.push(item);
    });
  }
};
