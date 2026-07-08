// Professional Furniture Catalog Database

const FurnitureCatalog = [
  // ==========================================
  // LIVING ROOM
  // ==========================================
  {
    id: 101, name: "Modern Sofa", category: "Living Room", subcategory: "seating",
    style: "modern", price: 35000, length_cm: 220, breadth_cm: 90, height_cm: 85, sqft: 21.3,
    color: "#4f51b5", description: "Minimalist 3-seater fabric sofa with steel legs",
    canvas_w: 132, canvas_h: 54
  },
  {
    id: 102, name: "Lux Chesterfield Sectional", category: "Living Room", subcategory: "seating",
    style: "luxury", price: 110000, length_cm: 280, breadth_cm: 180, height_cm: 80, sqft: 54.2,
    color: "#2b4c3f", description: "Premium tufted leather L-shape sectional sofa",
    canvas_w: 168, canvas_h: 108
  },
  {
    id: 103, name: "Oak Coffee Table", category: "Living Room", subcategory: "table",
    style: "scandinavian", price: 9500, length_cm: 120, breadth_cm: 60, height_cm: 45, sqft: 7.8,
    color: "#e5c185", description: "Solid oak wood coffee table with organic grain lines",
    canvas_w: 72, canvas_h: 36
  },
  {
    id: 104, name: "Industrial TV Unit", category: "Living Room", subcategory: "storage",
    style: "industrial", price: 24000, length_cm: 180, breadth_cm: 45, height_cm: 55, sqft: 8.7,
    color: "#3e3d3a", description: "Reclaimed wood and steel frame media console table",
    canvas_w: 108, canvas_h: 27
  },
  {
    id: 105, name: "Modernist Armchair", category: "Living Room", subcategory: "seating",
    style: "modern", price: 14500, length_cm: 85, breadth_cm: 80, height_cm: 90, sqft: 7.3,
    color: "#ff8a80", description: "Vibrant upholstered single armchair with oak frame",
    canvas_w: 51, canvas_h: 48
  },
  {
    id: 106, name: "Floor Lamp", category: "Living Room", subcategory: "lighting",
    style: "modern", price: 3800, length_cm: 40, breadth_cm: 40, height_cm: 170, sqft: 1.7,
    color: "#fff9c4", description: "Arc floor lamp with matte black steel post",
    canvas_w: 24, canvas_h: 24
  },
  {
    id: 107, name: "Monstera Plant", category: "Living Room", subcategory: "decor",
    style: "minimalist", price: 2100, length_cm: 60, breadth_cm: 60, height_cm: 120, sqft: 3.8,
    color: "#66bb6a", description: "Potted split-leaf philodendron plant",
    canvas_w: 36, canvas_h: 36
  },

  // ==========================================
  // BEDROOM
  // ==========================================
  {
    id: 201, name: "King Bed", category: "Bedroom", subcategory: "bedroom",
    style: "modern", price: 45000, length_cm: 200, breadth_cm: 180, height_cm: 110, sqft: 38.7,
    color: "#b0bec5", description: "King size platform bed with padded headboard",
    canvas_w: 120, canvas_h: 108
  },
  {
    id: 202, name: "Scandinavian Wardrobe", category: "Bedroom", subcategory: "storage",
    style: "scandinavian", price: 28000, length_cm: 150, breadth_cm: 60, height_cm: 210, sqft: 9.7,
    color: "#cfd8dc", description: "Three-door wardrobe with sliding mirror doors",
    canvas_w: 90, canvas_h: 36
  },
  {
    id: 203, name: "Minimalist Dresser", category: "Bedroom", subcategory: "storage",
    style: "minimalist", price: 18500, length_cm: 120, breadth_cm: 45, height_cm: 75, sqft: 5.8,
    color: "#eceff1", description: "6-drawer low profile bedroom chest",
    canvas_w: 72, canvas_h: 27
  },
  {
    id: 204, name: "Oak Nightstand", category: "Bedroom", subcategory: "storage",
    style: "scandinavian", price: 4200, length_cm: 50, breadth_cm: 40, height_cm: 55, sqft: 2.1,
    color: "#d7ccc8", description: "Single-drawer bedside table with open cubby shelf",
    canvas_w: 30, canvas_h: 24
  },
  {
    id: 205, name: "Study Desk", category: "Bedroom", subcategory: "table",
    style: "minimalist", price: 12000, length_cm: 120, breadth_cm: 60, height_cm: 75, sqft: 7.8,
    color: "#f5f5f5", description: "Clean design office desk with wood finish laminate top",
    canvas_w: 72, canvas_h: 36
  },

  // ==========================================
  // KITCHEN & DINING
  // ==========================================
  {
    id: 301, name: "Dining Table", category: "Kitchen", subcategory: "table",
    style: "classic", price: 22000, length_cm: 180, breadth_cm: 90, height_cm: 76, sqft: 17.4,
    color: "#8d6e63", description: "Teak wood 6-seater dining table",
    canvas_w: 108, canvas_h: 54
  },
  {
    id: 302, name: "Teak Dining Chair", category: "Kitchen", subcategory: "seating",
    style: "classic", price: 4800, length_cm: 45, breadth_cm: 45, height_cm: 95, sqft: 2.1,
    color: "#bcaaa4", description: "Teak wood high-back dining chair with cushion seat",
    canvas_w: 27, canvas_h: 27
  },
  {
    id: 303, name: "Granite Kitchen Island", category: "Kitchen", subcategory: "table",
    style: "luxury", price: 65000, length_cm: 200, breadth_cm: 100, height_cm: 90, sqft: 21.5,
    color: "#37474f", description: "Kitchen workstation island with solid marble top slab",
    canvas_w: 120, canvas_h: 60
  },
  {
    id: 304, name: "Double-Door Refrigerator", category: "Kitchen", subcategory: "appliances",
    style: "modern", price: 58000, length_cm: 90, breadth_cm: 75, height_cm: 185, sqft: 7.3,
    color: "#b0bec5", description: "Smart French-door refrigerator, stainless steel finish",
    canvas_w: 54, canvas_h: 45
  },

  // ==========================================
  // BATHROOM
  // ==========================================
  {
    id: 401, name: "Marble Vanity Unit", category: "Bathroom", subcategory: "storage",
    style: "luxury", price: 34000, length_cm: 100, breadth_cm: 55, height_cm: 85, sqft: 5.9,
    color: "#ffffff", description: "Marble top bathroom cabinet with ceramic under-mount sink",
    canvas_w: 60, canvas_h: 33
  },
  {
    id: 402, name: "Dual-Flush Toilet", category: "Bathroom", subcategory: "fixtures",
    style: "modern", price: 9500, length_cm: 70, breadth_cm: 40, height_cm: 80, sqft: 3.0,
    color: "#fafafa", description: "Floor-mounted ceramic toilet closet tank",
    canvas_w: 42, canvas_h: 24
  },
  {
    id: 403, name: "Acrylic Bathtub", category: "Bathroom", subcategory: "fixtures",
    style: "luxury", price: 48000, length_cm: 170, breadth_cm: 75, height_cm: 60, sqft: 13.7,
    color: "#ffffff", description: "Freestanding oval bathtub with chrome faucet mixer",
    canvas_w: 102, canvas_h: 45
  },

  // ==========================================
  // OFFICE
  // ==========================================
  {
    id: 501, name: "Ergonomic Office Chair", category: "Office", subcategory: "seating",
    style: "modern", price: 12500, length_cm: 65, breadth_cm: 65, height_cm: 110, sqft: 4.5,
    color: "#212121", description: "Mesh back high office chair with adjustable armrests",
    canvas_w: 39, canvas_h: 39
  },
  {
    id: 502, name: "Heavy Bookshelf", category: "Office", subcategory: "storage",
    style: "industrial", price: 15500, length_cm: 100, breadth_cm: 30, height_cm: 190, sqft: 3.2,
    color: "#5d4037", description: "5-shelf solid mahogany bookcase cabinet",
    canvas_w: 60, canvas_h: 18
  },
  
  // LIVING ROOM ADDITIONS
  {
    id: 108, name: "L-shape Lounge Sofa", category: "Living Room", subcategory: "seating",
    style: "modern", price: 68000, length_cm: 260, breadth_cm: 160, height_cm: 80, sqft: 40.2,
    color: "#1e293b", description: "Minimalist L-shape sectional fabric couch",
    canvas_w: 156, canvas_h: 96
  },
  {
    id: 109, name: "Console Table", category: "Living Room", subcategory: "table",
    style: "modern", price: 12000, length_cm: 140, breadth_cm: 40, height_cm: 75, sqft: 6.0,
    color: "#334155", description: "Sleek iron entry hall table console",
    canvas_w: 84, canvas_h: 24
  },
  {
    id: 110, name: "Side Table", category: "Living Room", subcategory: "table",
    style: "minimalist", price: 4500, length_cm: 50, breadth_cm: 50, height_cm: 50, sqft: 2.7,
    color: "#64748b", description: "Modern circular wooden end table",
    canvas_w: 30, canvas_h: 30
  },
  {
    id: 111, name: "Persian Rug", category: "Living Room", subcategory: "decor",
    style: "luxury", price: 18000, length_cm: 200, breadth_cm: 150, height_cm: 1, sqft: 30.0,
    color: "#991b1b", description: "Traditional woven velvet rug runner",
    canvas_w: 120, canvas_h: 90
  },
  {
    id: 112, name: "Linen Curtains", category: "Living Room", subcategory: "decor",
    style: "scandinavian", price: 5500, length_cm: 150, breadth_cm: 10, height_cm: 250, sqft: 1.6,
    color: "#cbd5e1", description: "Pair of hanging organic linen draperies",
    canvas_w: 90, canvas_h: 6
  },

  // BEDROOM ADDITIONS
  {
    id: 206, name: "Queen Bed", category: "Bedroom", subcategory: "bedroom",
    style: "scandinavian", price: 38000, length_cm: 200, breadth_cm: 160, height_cm: 100, sqft: 34.4,
    color: "#e2e8f0", description: "Queen platform bed with natural oak frames",
    canvas_w: 120, canvas_h: 96
  },
  {
    id: 207, name: "Single Bed", category: "Bedroom", subcategory: "bedroom",
    style: "minimalist", price: 21000, length_cm: 190, breadth_cm: 90, height_cm: 80, sqft: 18.4,
    color: "#f1f5f9", description: "Space saving single size wooden cot bed",
    canvas_w: 114, canvas_h: 54
  },
  {
    id: 208, name: "Tall Dresser Chest", category: "Bedroom", subcategory: "storage",
    style: "modern", price: 21500, length_cm: 80, breadth_cm: 45, height_cm: 130, sqft: 3.8,
    color: "#475569", description: "5-drawer tall bedroom dresser storage unit",
    canvas_w: 48, canvas_h: 27
  },
  {
    id: 209, name: "Bedroom Mirror", category: "Bedroom", subcategory: "decor",
    style: "luxury", price: 7500, length_cm: 60, breadth_cm: 4, height_cm: 180, sqft: 2.5,
    color: "#f8fafc", description: "Full-length floor vanity mirror with wooden frame",
    canvas_w: 36, canvas_h: 2
  },

  // KITCHEN ADDITIONS
  {
    id: 305, name: "Kitchen Base Cabinet", category: "Kitchen", subcategory: "storage",
    style: "modern", price: 32000, length_cm: 120, breadth_cm: 60, height_cm: 85, sqft: 7.7,
    color: "#0f172a", description: "Modular kitchen lower drawer cabinet counter",
    canvas_w: 72, canvas_h: 36
  },
  {
    id: 306, name: "Kitchen Sink Unit", category: "Kitchen", subcategory: "fixtures",
    style: "modern", price: 14500, length_cm: 80, breadth_cm: 60, height_cm: 85, sqft: 5.1,
    color: "#64748b", description: "Stainless steel double kitchen sink basin inset",
    canvas_w: 48, canvas_h: 36
  },
  {
    id: 307, name: "Built-in Oven", category: "Kitchen", subcategory: "appliances",
    style: "modern", price: 38000, length_cm: 60, breadth_cm: 60, height_cm: 60, sqft: 3.8,
    color: "#0f172a", description: "Integrated smart convection oven cabinet",
    canvas_w: 36, canvas_h: 36
  },
  {
    id: 308, name: "Dining Room Chair", category: "Kitchen", subcategory: "seating",
    style: "scandinavian", price: 5200, length_cm: 45, breadth_cm: 45, height_cm: 85, sqft: 2.1,
    color: "#f8fafc", description: "Clean scandi dining chair with wooden spindly legs",
    canvas_w: 27, canvas_h: 27
  },

  // BATHROOM ADDITIONS
  {
    id: 404, name: "Shower Booth Enclosure", category: "Bathroom", subcategory: "fixtures",
    style: "modern", price: 32000, length_cm: 90, breadth_cm: 90, height_cm: 200, sqft: 8.7,
    color: "#e2e8f0", description: "Glass door corner shower stall structure",
    canvas_w: 54, canvas_h: 54
  },
  {
    id: 405, name: "Modern Wash Basin", category: "Bathroom", subcategory: "fixtures",
    style: "minimalist", price: 8500, length_cm: 50, breadth_cm: 45, height_cm: 80, sqft: 2.4,
    color: "#ffffff", description: "Pedestal ceramic sink wash basin",
    canvas_w: 30, canvas_h: 27
  },
  {
    id: 406, name: "Led Vanity Mirror", category: "Bathroom", subcategory: "decor",
    style: "modern", price: 6000, length_cm: 80, breadth_cm: 4, height_cm: 80, sqft: 3.4,
    color: "#f8fafc", description: "Backlit wall mirror with smart touch sensor dimming",
    canvas_w: 48, canvas_h: 2
  },

  // OFFICE ADDITIONS
  {
    id: 503, name: "Executive Meeting Table", category: "Office", subcategory: "table",
    style: "luxury", price: 42000, length_cm: 240, breadth_cm: 120, height_cm: 75, sqft: 31.0,
    color: "#1e293b", description: "Large conference meeting table in oak wood finish",
    canvas_w: 144, canvas_h: 72
  },
  {
    id: 504, name: "Office Table", category: "Office", subcategory: "table",
    style: "modern", price: 14500, length_cm: 140, breadth_cm: 70, height_cm: 75, sqft: 10.5,
    color: "#f1f5f9", description: "Executive desk with metal legs and white tabletop",
    canvas_w: 84, canvas_h: 42
  },
  {
    id: 505, name: "Premium Gaming Chair", category: "Office", subcategory: "seating",
    style: "modern", price: 18500, length_cm: 70, breadth_cm: 70, height_cm: 130, sqft: 5.2,
    color: "#ef4444", description: "High-back ergonomic race seat gaming chair",
    canvas_w: 42, canvas_h: 42
  },

  // OUTDOOR & STRUCTURES
  {
    id: 601, name: "Rattan Patio Set", category: "Outdoor", subcategory: "seating",
    style: "traditional", price: 42000, length_cm: 160, breadth_cm: 80, height_cm: 75, sqft: 13.7,
    color: "#8d6e63", description: "Synthetic rattan sofa and matching wicker table",
    canvas_w: 96, canvas_h: 48
  },
  {
    id: 602, name: "Teak Pergola", category: "Outdoor", subcategory: "structures",
    style: "traditional", price: 85000, length_cm: 300, breadth_cm: 300, height_cm: 250, sqft: 96.8,
    color: "#5d4037", description: "Solid teak wood garden gazebo shade structure",
    canvas_w: 180, canvas_h: 180
  },
  {
    id: 603, name: "Swimming Pool", category: "Outdoor", subcategory: "structures",
    style: "luxury", price: 380000, length_cm: 600, breadth_cm: 300, height_cm: 150, sqft: 193.7,
    color: "#0ea5e9", description: "Large outdoor inground swimming pool basin structure",
    canvas_w: 360, canvas_h: 180
  },
  {
    id: 604, name: "Garden Bench", category: "Outdoor", subcategory: "seating",
    style: "traditional", price: 9500, length_cm: 150, breadth_cm: 60, height_cm: 80, sqft: 9.7,
    color: "#1e3a8a", description: "Classic cast iron and wood garden bench",
    canvas_w: 90, canvas_h: 36
  },
  {
    id: 605, name: "Outdoor Palm Plant", category: "Outdoor", subcategory: "decor",
    style: "modern", price: 3200, length_cm: 80, breadth_cm: 80, height_cm: 160, sqft: 6.8,
    color: "#16a34a", description: "Tall decorative potted palm plant for decks and patios",
    canvas_w: 48, canvas_h: 48
  },

  // GARAGE SPACE
  {
    id: 701, name: "Sedan Car", category: "Garage", subcategory: "decor",
    style: "modern", price: 1200000, length_cm: 450, breadth_cm: 180, height_cm: 145, sqft: 87.1,
    color: "#3b82f6", description: "Premium executive sedan car display model",
    canvas_w: 270, canvas_h: 108
  },
  {
    id: 702, name: "Sport Motorbike", category: "Garage", subcategory: "decor",
    style: "modern", price: 250000, length_cm: 200, breadth_cm: 75, height_cm: 110, sqft: 16.1,
    color: "#ef4444", description: "Super sport racing motorbike display vehicle",
    canvas_w: 120, canvas_h: 45
  },
  {
    id: 703, name: "Metal Storage Shelves", category: "Garage", subcategory: "storage",
    style: "industrial", price: 6500, length_cm: 120, breadth_cm: 45, height_cm: 180, sqft: 5.8,
    color: "#475569", description: "Heavy duty steel frame garage shelving unit",
    canvas_w: 72, canvas_h: 27
  }
];

// Helper to filter by category or search term
function getCatalogByCategory(category) {
  if (!category || category === 'All') return FurnitureCatalog;
  return FurnitureCatalog.filter(item => item.category === category);
}

function getCatalogBySearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) return FurnitureCatalog;
  return FurnitureCatalog.filter(item => 
    item.name.toLowerCase().includes(q) || 
    item.category.toLowerCase().includes(q) ||
    item.style.toLowerCase().includes(q)
  );
}
