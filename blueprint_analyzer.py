import cv2
import numpy as np
import math
import json

class BlueprintAnalyzer:
    def __init__(self):
        pass

    def analyze(self, image_path):
        # 1. Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image at {image_path}")

        # Keep original dimensions
        orig_h, orig_w = img.shape[:2]

        # 2. Resize to a manageable size for consistency while preserving aspect ratio
        max_dim = 1200
        scale_factor = 1.0
        if max(orig_h, orig_w) > max_dim:
            if orig_w > orig_h:
                scale_factor = max_dim / float(orig_w)
                new_w, new_h = max_dim, int(orig_h * scale_factor)
            else:
                scale_factor = max_dim / float(orig_h)
                new_w, new_h = int(orig_w * scale_factor), max_dim
            img_resized = cv2.resize(img, (new_w, new_h))
        else:
            img_resized = img.copy()
            new_w, new_h = orig_w, orig_h

        # 3. Preprocessing
        # Convert to Grayscale
        gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)

        # Enhance Contrast using CLAHE
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl_img = clahe.apply(gray)

        # Remove noise using Bilateral Filter (keeps edges sharp)
        denoised = cv2.bilateralFilter(cl_img, 9, 75, 75)

        # Thresholding (Adaptive Gaussian Thresholding for uneven lighting/shadows)
        # Walls are typically dark lines on light backgrounds.
        binary = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 15, 4
        )

        # Morphological operations to clean up small text, dimensions, and furniture
        # We perform morphological opening to remove small elements, then closing to heal gaps in walls
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_open)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel_close)

        # 4. Wall Detection
        # Use Distance Transform to find centerlines of thick wall regions
        dist_transform = cv2.distanceTransform(cleaned, cv2.DIST_L2, 5)
        
        # Skeletonization (thinning) to get 1-pixel wide walls
        skeleton = self._skeletonize(cleaned)

        # Detect wall line segments using Hough Lines P
        # minLineLength and maxLineGap are calibrated for floor plan walls
        min_line_len = int(25 * scale_factor)
        max_line_gap = int(12 * scale_factor)
        raw_lines = cv2.HoughLinesP(
            skeleton, 1, np.pi / 180, 
            threshold=15, 
            minLineLength=min_line_len, 
            maxLineGap=max_line_gap
        )

        walls = []
        if raw_lines is not None:
            # Format lines as list of lists
            formatted_lines = []
            for line in raw_lines:
                flat_line = line.flatten()
                if len(flat_line) == 4:
                    x1, y1, x2, y2 = flat_line
                    # Normalize line direction (left-to-right, or top-to-bottom)
                    if x1 > x2 or (x1 == x2 and y1 > y2):
                        x1, y1, x2, y2 = x2, y2, x1, y1
                    formatted_lines.append([int(x1), int(y1), int(x2), int(y2)])

            # Merge collinear and overlapping segments
            merged_lines = self._merge_lines(formatted_lines, dist_transform, scale_factor)
            
            # Snap intersections to create a clean wall graph
            snapped_lines = self._snap_intersections(merged_lines, scale_factor)

            # Build wall segment list with thicknesses
            for i, line in enumerate(snapped_lines):
                x1, y1, x2, y2 = line
                # Calculate thickness from distance transform
                thickness = self._get_wall_thickness(x1, y1, x2, y2, dist_transform, scale_factor)
                
                # Scale coordinates back to original size
                walls.append({
                    "id": i + 1,
                    "x1": int(round(x1 / scale_factor)),
                    "y1": int(round(y1 / scale_factor)),
                    "x2": int(round(x2 / scale_factor)),
                    "y2": int(round(y2 / scale_factor)),
                    "thickness": int(round(thickness / scale_factor)),
                    "height": 280, # default wall height in cm
                    "type": "interior" # Default, updated below
                })

        # 5. Door & Window Detection (Opening detection along walls)
        doors, windows = self._detect_openings(walls, cleaned, dist_transform, scale_factor)

        # 6. Room Detection (using doors and windows to plug leaks)
        rooms = self._detect_rooms(walls, doors, windows, orig_w, orig_h, scale_factor)

        # 7. Identify exterior walls
        self._classify_walls_exterior(walls, rooms)

        # 8. Refine opening classification based on wall type (exterior = window, interior = door)
        refined_doors = []
        refined_windows = []
        all_openings = doors + windows
        for op in all_openings:
            parent_wall = None
            op_x, op_y = op["x"], op["y"]
            min_d = float('inf')
            for w in walls:
                x1, y1, x2, y2 = w["x1"], w["y1"], w["x2"], w["y2"]
                dx = x2 - x1
                dy = y2 - y1
                l2 = dx*dx + dy*dy
                if l2 == 0:
                    d = math.hypot(op_x - x1, op_y - y1)
                else:
                    t = max(0, min(1, ((op_x - x1) * dx + (op_y - y1) * dy) / l2))
                    proj_x = x1 + t * dx
                    proj_y = y1 + t * dy
                    d = math.hypot(op_x - proj_x, op_y - proj_y)
                if d < min_d:
                    min_d = d
                    parent_wall = w
            
            if parent_wall and parent_wall["type"] == "exterior":
                if 80 <= op["width"] <= 105 and len(refined_doors) == 0:
                    op["id"] = len(refined_doors) + 1
                    refined_doors.append(op)
                else:
                    op["id"] = len(refined_windows) + 1
                    if "status" in op:
                        del op["status"]
                    refined_windows.append(op)
            else:
                op["id"] = len(refined_doors) + 1
                if "status" not in op:
                    op["status"] = "open"
                refined_doors.append(op)
                
        doors = refined_doors
        windows = refined_windows

        # 9. Scale Calibration Estimation
        px_per_meter = 60.0
        if doors:
            door_widths = [d["width"] for d in doors]
            avg_door_px = sum(door_widths) / len(door_widths)
            px_per_meter = avg_door_px / 0.9
        
        px_per_meter = round(px_per_meter, 2)

        # Compile final JSON structure
        result = {
            "metadata": {
                "original_width": orig_w,
                "original_height": orig_h,
                "scale_pixels_per_meter": px_per_meter,
                "wall_height_cm": 280,
                "wall_thickness_default_cm": 15
            },
            "walls": walls,
            "rooms": rooms,
            "doors": doors,
            "windows": windows
        }
        return result

    def _skeletonize(self, img):
        """Morphological skeletonization to find single-pixel lines."""
        size = np.size(img)
        skel = np.zeros(img.shape, np.uint8)
        ret, temp = cv2.threshold(img, 127, 255, 0)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        done = False
        
        while not done:
            eroded = cv2.erode(temp, element)
            temp_open = cv2.dilate(eroded, element)
            temp_open = cv2.subtract(temp, temp_open)
            skel = cv2.bitwise_or(skel, temp_open)
            temp = eroded.copy()
            zeros = size - cv2.countNonZero(temp)
            if zeros == size:
                done = True
        return skel

    def _merge_lines(self, lines, dist_transform, scale_factor):
        """Merge collinear and overlapping line segments."""
        if not lines:
            return []

        merged = []
        angle_thresh = 10 * np.pi / 180 # 10 degrees
        dist_thresh = 15 * scale_factor # pixels

        used = [False] * len(lines)

        for i in range(len(lines)):
            if used[i]:
                continue
            
            x1_i, y1_i, x2_i, y2_i = lines[i]
            len_i = math.hypot(x2_i - x1_i, y2_i - y1_i)
            if len_i < 5:
                continue

            angle_i = math.atan2(y2_i - y1_i, x2_i - x1_i) % np.pi

            current_x1, current_y1, current_x2, current_y2 = x1_i, y1_i, x2_i, y2_i
            used[i] = True

            # Keep looking for matches to merge
            matching = True
            while matching:
                matching = False
                for j in range(len(lines)):
                    if used[j]:
                        continue
                    
                    x1_j, y1_j, x2_j, y2_j = lines[j]
                    angle_j = math.atan2(y2_j - y1_j, x2_j - x1_j) % np.pi

                    # Check angle difference
                    ang_diff = abs(angle_i - angle_j)
                    ang_diff = min(ang_diff, np.pi - ang_diff)
                    if ang_diff > angle_thresh:
                        continue

                    # Check distance from line j to line i
                    # Vector of current line
                    dx = current_x2 - current_x1
                    dy = current_y2 - current_y1
                    line_len = math.hypot(dx, dy)
                    if line_len == 0:
                        continue
                    
                    # Distance of endpoints of j to current line
                    d1 = abs(dy * x1_j - dx * y1_j + current_x2 * current_y1 - current_y2 * current_x1) / line_len
                    d2 = abs(dy * x2_j - dx * y2_j + current_x2 * current_y1 - current_y2 * current_x1) / line_len
                    
                    if d1 > dist_thresh or d2 > dist_thresh:
                        continue

                    # Check overlap / proximity along the line
                    # Project endpoints onto current line
                    proj_i1 = 0
                    proj_i2 = line_len
                    
                    # Projection of j endpoints
                    proj_j1 = ((x1_j - current_x1) * dx + (y1_j - current_y1) * dy) / line_len
                    proj_j2 = ((x2_j - current_x1) * dx + (y2_j - current_y1) * dy) / line_len

                    # Sort projections
                    p_min_i, p_max_i = min(proj_i1, proj_i2), max(proj_i1, proj_i2)
                    p_min_j, p_max_j = min(proj_j1, proj_j2), max(proj_j1, proj_j2)

                    # Overlap or close distance
                    gap = max(0, p_min_j - p_max_i) if p_min_j > p_min_i else max(0, p_min_i - p_max_j)
                    if gap > 20 * scale_factor:
                        continue

                    # Merge them: find new endpoints that cover the union
                    all_projs = [proj_i1, proj_i2, proj_j1, proj_j2]
                    min_proj = min(all_projs)
                    max_proj = max(all_projs)

                    # Recompute coordinates based on minimum and maximum projections
                    new_x1 = current_x1 + (min_proj / line_len) * dx
                    new_y1 = current_y1 + (min_proj / line_len) * dy
                    new_x2 = current_x1 + (max_proj / line_len) * dx
                    new_y2 = current_y1 + (max_proj / line_len) * dy

                    current_x1, current_y1, current_x2, current_y2 = new_x1, new_y1, new_x2, new_y2
                    used[j] = True
                    matching = True
                    # Recalculate line parameters for updated line
                    dx = current_x2 - current_x1
                    dy = current_y2 - current_y1
                    line_len = math.hypot(dx, dy)
                    angle_i = math.atan2(dy, dx) % np.pi

            # Finalize merged line, aligning it strictly horizontal or vertical if close
            dx = current_x2 - current_x1
            dy = current_y2 - current_y1
            angle = math.atan2(dy, dx) % np.pi

            # Snap to horizontal/vertical if angle within 6 degrees of 0, 90 or 180
            deg = math.degrees(angle)
            if deg < 6 or deg > 174:
                avg_y = (current_y1 + current_y2) / 2
                current_y1 = current_y2 = avg_y
            elif abs(deg - 90) < 6:
                avg_x = (current_x1 + current_x2) / 2
                current_x1 = current_x2 = avg_x

            merged.append([current_x1, current_y1, current_x2, current_y2])

        return merged

    def _snap_intersections(self, lines, scale_factor):
        """Snap endpoints of lines to nearby endpoints or intersections of other lines to build a closed graph."""
        snap_dist = 20 * scale_factor

        # First, snap endpoints together
        for i in range(len(lines)):
            for pt_idx_i in [0, 2]: # start (x1, y1) is index 0, end (x2, y2) is index 2
                x_i = lines[i][pt_idx_i]
                y_i = lines[i][pt_idx_i + 1]

                best_dist = snap_dist
                best_pt = None

                for j in range(len(lines)):
                    if i == j:
                        continue
                    for pt_idx_j in [0, 2]:
                        x_j = lines[j][pt_idx_j]
                        y_j = lines[j][pt_idx_j + 1]
                        
                        dist = math.hypot(x_i - x_j, y_i - y_j)
                        if dist < best_dist:
                            best_dist = dist
                            best_pt = (j, pt_idx_j, x_j, y_j)

                if best_pt:
                    # Snap them together: make both points share the average coordinates
                    j, pt_idx_j, x_j, y_j = best_pt
                    avg_x = (x_i + x_j) / 2
                    avg_y = (y_i + y_j) / 2
                    lines[i][pt_idx_i] = avg_x
                    lines[i][pt_idx_i + 1] = avg_y
                    lines[j][pt_idx_j] = avg_x
                    lines[j][pt_idx_j + 1] = avg_y

        # Next, T-junction snapping: snap endpoints of one line to the body of another line
        for i in range(len(lines)):
            for pt_idx_i in [0, 2]:
                x_i = lines[i][pt_idx_i]
                y_i = lines[i][pt_idx_i + 1]

                best_dist = snap_dist
                best_proj = None

                for j in range(len(lines)):
                    if i == j:
                        continue
                    x1_j, y1_j, x2_j, y2_j = lines[j]
                    dx = x2_j - x1_j
                    dy = y2_j - y1_j
                    line_len = math.hypot(dx, dy)
                    if line_len == 0:
                        continue

                    # Calculate projection of point i onto line j
                    proj = ((x_i - x1_j) * dx + (y_i - y1_j) * dy) / (line_len * line_len)
                    
                    # Check if projection falls within line segment
                    if 0.05 <= proj <= 0.95:
                        proj_x = x1_j + proj * dx
                        proj_y = y1_j + proj * dy
                        dist = math.hypot(x_i - proj_x, y_i - proj_y)
                        if dist < best_dist:
                            best_dist = dist
                            best_proj = (proj_x, proj_y)

                if best_proj:
                    lines[i][pt_idx_i] = best_proj[0]
                    lines[i][pt_idx_i + 1] = best_proj[1]

        return lines

    def _get_wall_thickness(self, x1, y1, x2, y2, dist_transform, scale_factor):
        """Calculate average wall thickness along the line segment using distance transform."""
        dx = x2 - x1
        dy = y2 - y1
        line_len = math.hypot(dx, dy)
        if line_len == 0:
            return 15.0 * scale_factor # Default fallback

        # Sample points along the wall centerline
        samples = 10
        distances = []
        for i in range(samples):
            t = i / (samples - 1)
            sx = int(round(x1 + t * dx))
            sy = int(round(y1 + t * dy))
            # Ensure within bounds of distance transform
            if 0 <= sx < dist_transform.shape[1] and 0 <= sy < dist_transform.shape[0]:
                d = dist_transform[sy, sx]
                if d > 0:
                    distances.append(d)
        
        if len(distances) == 0:
            return 15.0 * scale_factor
        
        # Distance transform gives distance to nearest background.
        # Wall thickness is 2 * distance.
        avg_dist = sum(distances) / len(distances)
        thickness = 2 * avg_dist
        
        # Clamp between reasonable limits (e.g. 8px and 40px)
        return max(8.0 * scale_factor, min(40.0 * scale_factor, thickness))

    def _detect_rooms(self, walls, doors, windows, width, height, scale_factor):
        """Find closed room contours from the wall geometries, plugging door and window gaps."""
        # Create a blank black canvas of the original size scaled down
        canvas_w = int(round(width * scale_factor))
        canvas_h = int(round(height * scale_factor))
        wall_img = np.zeros((canvas_h, canvas_w), dtype=np.uint8)

        # Draw the detected walls as thick white lines
        for wall in walls:
            x1 = int(round(wall["x1"] * scale_factor))
            y1 = int(round(wall["y1"] * scale_factor))
            x2 = int(round(wall["x2"] * scale_factor))
            y2 = int(round(wall["y2"] * scale_factor))
            thickness = max(2, int(round(wall["thickness"] * scale_factor)))
            cv2.line(wall_img, (x1, y1), (x2, y2), 255, thickness)

        # Draw doors and windows as lines to plug gaps
        for op in doors + windows:
            cx = int(round(op["x"] * scale_factor))
            cy = int(round(op["y"] * scale_factor))
            w = int(round(op["width"] * scale_factor))
            ang_rad = math.radians(op["angle"])
            
            dx = (w / 2) * math.cos(ang_rad)
            dy = (w / 2) * math.sin(ang_rad)
            
            x1 = int(round(cx - dx))
            y1 = int(round(cy - dy))
            x2 = int(round(cx + dx))
            y2 = int(round(cy + dy))
            
            cv2.line(wall_img, (x1, y1), (x2, y2), 255, 8)

        # Dilate walls and use closing to seal gaps in the wall graph
        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        closed_walls = cv2.morphologyEx(wall_img, cv2.MORPH_CLOSE, kernel_close)
        
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dilated_walls = cv2.dilate(closed_walls, kernel_dilate)

        # Invert: floor regions are white, walls are black
        rooms_img = cv2.bitwise_not(dilated_walls)
        

        # Find contours of the floor regions (use RETR_CCOMP to find nested room contours inside wall loops)
        contours, hierarchy = cv2.findContours(
            rooms_img, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
        )


        detected_rooms = []
        room_counter = 1

        for i, contour in enumerate(contours):
            # Calculate pixel area
            area_px = cv2.contourArea(contour)
            
            # Simplify contour to polygon
            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.015 * perimeter, True)
            
            if area_px < (1200 * scale_factor * scale_factor):
                continue
            
            # Skip open contours or line artifacts
            if len(approx) < 3:
                continue

            # Get centroid of room
            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])

            # Check if this contour touches the image boundary.
            # If it covers more than 30% of the border, it's the exterior background, not a room.
            touches_border = False
            margin = 5
            border_points = 0
            for pt in approx:
                x, y = pt[0]
                if x <= margin or x >= canvas_w - margin or y <= margin or y >= canvas_h - margin:
                    border_points += 1
            if border_points >= 2 or (border_points / len(approx)) > 0.3:
                # This is likely the exterior background area, skip
                continue

            # Scale polygon coordinates back to original image coordinates
            scaled_poly = []
            for pt in approx:
                px, py = pt[0]
                scaled_poly.append([
                    int(round(px / scale_factor)),
                    int(round(py / scale_factor))
                ])

            # Classify Room Name based on size / area heuristics
            # Area in square meters (approximate, using 60px/meter as baseline)
            est_area_sqm = area_px / (3600.0 * scale_factor * scale_factor)
            
            if est_area_sqm > 25.0:
                room_name = "Living Room"
            elif est_area_sqm > 12.0:
                room_name = f"Bedroom {room_counter}"
                room_counter += 1
            elif est_area_sqm > 7.0:
                room_name = "Kitchen"
            else:
                room_name = "Bathroom"

            # Calculate room perimeter and bounding box dimensions
            rect = cv2.minAreaRect(contour)
            box_w_m = rect[1][0] / (60.0 * scale_factor)
            box_h_m = rect[1][1] / (60.0 * scale_factor)
            
            detected_rooms.append({
                "id": len(detected_rooms) + 1,
                "name": room_name,
                "polygon": scaled_poly,
                "centroid": [
                    int(round(cx / scale_factor)),
                    int(round(cy / scale_factor))
                ],
                "area_sq_m": round(est_area_sqm, 2),
                "perimeter_m": round(perimeter / (60.0 * scale_factor), 2),
                "width_m": round(max(box_w_m, box_h_m), 2),
                "depth_m": round(min(box_w_m, box_h_m), 2)
            })

        return detected_rooms

    def _classify_walls_exterior(self, walls, rooms):
        """Classify walls as exterior if they belong to the convex outer shell of all rooms."""
        if not rooms:
            return
        
        # Combine all room polygons
        all_pts = []
        for r in rooms:
            for pt in r["polygon"]:
                all_pts.append(pt)
        
        if not all_pts:
            return
            
        # Compute Convex Hull of all rooms to define the exterior bounds
        hull = cv2.convexHull(np.array(all_pts, dtype=np.int32))
        
        # For each wall, check if it lies close to the convex hull boundary
        hull_pts = hull.reshape(-1, 2).tolist()
        
        for wall in walls:
            mid_x = (wall["x1"] + wall["x2"]) / 2
            mid_y = (wall["y1"] + wall["y2"]) / 2
            
            # Check distance of midpoint to convex hull
            min_dist = float('inf')
            for i in range(len(hull_pts)):
                p1 = hull_pts[i]
                p2 = hull_pts[(i + 1) % len(hull_pts)]
                
                # Distance from point to line segment
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                l2 = dx*dx + dy*dy
                if l2 == 0:
                    dist = math.hypot(mid_x - p1[0], mid_y - p1[1])
                else:
                    t = max(0, min(1, ((mid_x - p1[0]) * dx + (mid_y - p1[1]) * dy) / l2))
                    proj_x = p1[0] + t * dx
                    proj_y = p1[1] + t * dy
                    dist = math.hypot(mid_x - proj_x, mid_y - proj_y)
                
                if dist < min_dist:
                    min_dist = dist
            
            # If wall is close to the outer shell, it's exterior
            if min_dist < 40:
                wall["type"] = "exterior"
                # Exterior walls are typically thicker (e.g. 23cm)
                wall["thickness"] = max(wall["thickness"], 23)

    def _detect_openings(self, walls, binary_img, dist_transform, scale_factor):
        """Detect door and window openings by analyzing structural gaps along walls."""
        doors = []
        windows = []
        opening_counter = 1

        # We search along wall segments for regions where the original wall thickness drops significantly
        # indicating an opening (door or window), or where the skeleton has a gap.
        # To make it simple and extremely robust, we inspect each wall segment:
        for wall in walls:
            x1 = int(round(wall["x1"] * scale_factor))
            y1 = int(round(wall["y1"] * scale_factor))
            x2 = int(round(wall["x2"] * scale_factor))
            y2 = int(round(wall["y2"] * scale_factor))
            
            dx = x2 - x1
            dy = y2 - y1
            wall_len = math.hypot(dx, dy)
            if wall_len < 40 * scale_factor:
                continue

            # Look for sub-segments along the wall where pixels are black in the binary image (meaning empty space)
            samples = 30
            empty_spots = []
            for i in range(samples):
                t = i / (samples - 1)
                sx = int(round(x1 + t * dx))
                sy = int(round(y1 + t * dy))
                
                # Check binary image value.
                # In binary_img, walls are 255, gaps are 0
                if 0 <= sx < binary_img.shape[1] and 0 <= sy < binary_img.shape[0]:
                    val = binary_img[sy, sx]
                    if val == 0:
                        empty_spots.append(i)

            # Find contiguous ranges of empty spots (gaps in the wall)
            if not empty_spots:
                continue
            
            gaps = []
            current_gap = [empty_spots[0]]
            for idx in empty_spots[1:]:
                if idx == current_gap[-1] + 1:
                    current_gap.append(idx)
                else:
                    if len(current_gap) >= 3: # Ignore tiny random gaps
                        gaps.append(current_gap)
                    current_gap = [idx]
            if len(current_gap) >= 3:
                gaps.append(current_gap)

            for gap in gaps:
                # Start and end fractions along the wall
                start_t = gap[0] / (samples - 1)
                end_t = gap[-1] / (samples - 1)
                
                # Physical coordinates of gap
                gx1 = x1 + start_t * dx
                gy1 = y1 + start_t * dy
                gx2 = x1 + end_t * dx
                gy2 = y1 + end_t * dy
                
                gap_px_len = math.hypot(gx2 - gx1, gy2 - gy1)
                
                # Ignore gaps that are too small or too large to be doors/windows
                # Standard doors/windows are 60cm to 200cm (approx 35px to 120px at 60px/m)
                if not (20 * scale_factor <= gap_px_len <= 150 * scale_factor):
                    continue

                # Position is the midpoint of the gap
                mx = (gx1 + gx2) / 2
                my = (gy1 + gy2) / 2
                
                # Orientation angle of the wall containing the opening
                angle = math.atan2(dy, dx)
                
                # Classify as door or window:
                # We check nearby pixels in binary_img.
                # Doors typically have a circular swing line or arc contour nearby.
                # Windows have parallel double lines inside the gap.
                # Let's inspect a small neighborhood (search box) around the gap centroid
                search_r = int(round(gap_px_len * 0.8))
                roi_x1 = max(0, int(round(mx - search_r)))
                roi_y1 = max(0, int(round(my - search_r)))
                roi_x2 = min(binary_img.shape[1], int(round(mx + search_r)))
                roi_y2 = min(binary_img.shape[0], int(round(my + search_r)))
                
                roi = binary_img[roi_y1:roi_y2, roi_x1:roi_x2]
                
                # Detect lines or circles in the ROI to determine if window or door
                is_window = False
                
                # If there are parallel lines inside the ROI (excluding the wall line itself), it's a window.
                # Let's do a simple heuristic: count white wall pixels in a slice perpendicular to wall direction.
                # If we have parallel thin window lines, they will show up as narrow peaks.
                # We also look for lines using HoughLinesP in the ROI
                roi_lines = cv2.HoughLinesP(
                    roi, 1, np.pi/180, threshold=10, 
                    minLineLength=int(10*scale_factor), maxLineGap=int(5*scale_factor)
                )
                
                if roi_lines is not None and len(roi_lines) >= 3:
                    # Windows often have multiple parallel lines close together
                    is_window = True

                # Scale coordinates back to original image
                orig_mx = int(round(mx / scale_factor))
                orig_my = int(round(my / scale_factor))
                orig_width = int(round(gap_px_len / scale_factor))

                if is_window:
                    windows.append({
                        "id": len(windows) + 1,
                        "x": orig_mx,
                        "y": orig_my,
                        "width": orig_width,
                        "angle": round(math.degrees(angle), 1),
                        "thickness": int(round(wall["thickness"]))
                    })
                else:
                    doors.append({
                        "id": len(doors) + 1,
                        "x": orig_mx,
                        "y": orig_my,
                        "width": orig_width,
                        "angle": round(math.degrees(angle), 1),
                        "thickness": int(round(wall["thickness"])),
                        "status": "open"
                    })

        return doors, windows
