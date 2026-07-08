// Project Saving, Loading, and 3D Model Exporters

const Exporter = {
  // Save current project state as JSON file
  saveProjectFile() {
    const project = {
      version: "HomeForge-2.0",
      placedItems: State.placedItems,
      blueprintData: State.blueprintData,
      materialsMap: State.materialsMap,
      currentRoom: State.currentRoom,
      currentStyle: State.currentStyle
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `homeforge_design_${Date.now()}.json`);
    dlAnchorElem.click();
    this.showNotification("📋 Project JSON saved successfully!");
  },

  // Load project state from selected JSON file
  loadProjectFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const project = JSON.parse(e.target.result);
        
        State.saveHistory(); // save history for undo
        
        State.placedItems = project.placedItems || [];
        State.blueprintData = project.blueprintData || null;
        State.materialsMap = project.materialsMap || { rooms: {}, walls: {} };
        State.currentRoom = project.currentRoom || 'Living Room';
        State.currentStyle = project.currentStyle || 'modern';
        
        // Re-align UI and canvas
        document.getElementById('current-room-label').textContent = State.currentRoom;
        
        if (State.blueprintData) {
          // If blueprintData contains url, load image
          if (State.blueprintData.url) {
            State.blueprintImg = new Image();
            State.blueprintImg.onload = function() {
              fitToScreen();
              redraw();
            };
            State.blueprintImg.src = State.blueprintData.url;
          }
        }
        
        // Build 3D and redraw 2D
        if (State.viewMode === '3d') {
          build3DHouse();
        } else {
          redraw();
        }
        
        updateTotal();
        getSuggestions();
        Exporter.showNotification("🎉 Project loaded successfully!");
        
      } catch (err) {
        alert("Error parsing project file: " + err.message);
      }
    };
    reader.readAsText(file);
  },

  // Export 2D or 3D Canvas view as PNG image
  exportPNG() {
    let dataUrl;
    let filename = `homeforge_snapshot_${Date.now()}.png`;

    if (State.viewMode === '3d') {
      if (!isThreeInitialized) return;
      // Force a render pass right before capture to write data to buffer
      threeRenderer.render(threeScene, threeCamera);
      dataUrl = threeRenderer.domElement.toDataURL('image/png');
    } else {
      dataUrl = canvas.toDataURL('image/png');
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    this.showNotification("📷 High-res snapshot saved!");
  },

  // Export scene in Binary GLTF (GLB) format
  exportGLB() {
    if (State.viewMode !== '3d' || !isThreeInitialized) {
      alert("Please switch to 3D View mode to export 3D models.");
      return;
    }

    this.showNotification("⚙️ Packing scene geometry...");

    // Instantiate GLTFExporter
    if (typeof THREE.GLTFExporter === 'undefined') {
      // Lazy load GLTFExporter script if not loaded
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js";
      script.onload = () => { this.runGLBExport(); };
      document.head.appendChild(script);
    } else {
      this.runGLBExport();
    }
  },

  runGLBExport() {
    const exporter = new THREE.GLTFExporter();
    
    // We want to export only the user meshes, walls, floors, doors, windows, and furniture
    // Let's create an export group to exclude background grids, skybox, lights, etc.
    const exportGroup = new THREE.Group();
    threeScene.traverse(child => {
      // Export walls, rooms, doors, windows, and furniture meshes
      if (child.isMesh && child.name !== 'ground_grid' && child.material !== materials.shadowPlane) {
        exportGroup.add(child.clone());
      }
    });

    exporter.parse(exportGroup, (gltf) => {
      const blob = new Blob([gltf], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `homeforge_3d_design_${Date.now()}.glb`;
      link.click();
      this.showNotification("📦 3D GLB model downloaded!");
    }, (error) => {
      console.error(error);
      alert("Failed to export GLB model.");
    }, { binary: true });
  },

  // Export scene as OBJ format
  exportOBJ() {
    if (State.viewMode !== '3d' || !isThreeInitialized) {
      alert("Please switch to 3D View mode to export 3D models.");
      return;
    }

    this.showNotification("⚙️ Generating OBJ file format...");

    if (typeof THREE.OBJExporter === 'undefined') {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/OBJExporter.js";
      script.onload = () => { this.runOBJExport(); };
      document.head.appendChild(script);
    } else {
      this.runOBJExport();
    }
  },

  runOBJExport() {
    const exporter = new THREE.OBJExporter();
    const exportGroup = new THREE.Group();
    threeScene.traverse(child => {
      if (child.isMesh && child.name !== 'ground_grid' && child.material !== materials.shadowPlane) {
        exportGroup.add(child.clone());
      }
    });

    const result = exporter.parse(exportGroup);
    const blob = new Blob([result], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `homeforge_3d_design_${Date.now()}.obj`;
    link.click();
    this.showNotification("📦 3D OBJ model downloaded!");
  },

  showNotification(msg) {
    const notif = document.createElement('div');
    notif.className = 'toast-notification';
    notif.innerHTML = msg;
    document.body.appendChild(notif);
    
    // Smooth slide in/out
    setTimeout(() => {
      notif.classList.add('visible');
    }, 50);

    setTimeout(() => {
      notif.classList.remove('visible');
      setTimeout(() => {
        document.body.removeChild(notif);
      }, 300);
    }, 2800);
  }
};
