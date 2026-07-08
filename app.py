from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, json
from blueprint_analyzer import BlueprintAnalyzer

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

UPLOAD_FOLDER = 'uploads'
FURNITURE_IMG_FOLDER = 'static/images'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FURNITURE_IMG_FOLDER, exist_ok=True)

with open('data/furniture.json', 'r') as f:
    FURNITURE = json.load(f)

@app.route('/')
def home():
    return send_from_directory('templates', 'index.html')

@app.route('/dashboard')
def dashboard():
    return send_from_directory('templates', 'dashboard.html')

@app.route('/design')
def design():
    return send_from_directory('templates', 'design.html')

@app.route('/catalog')
def catalog():
    return send_from_directory('templates', 'catalog.html')

@app.route('/api/furniture', methods=['GET'])
def get_furniture():
    category = request.args.get('category', '')
    style = request.args.get('style', '')
    result = FURNITURE
    if category:
        result = [f for f in result if f.get('category') == category]
    if style:
        result = [f for f in result if f.get('style') == style]
    return jsonify(result)

@app.route('/api/suggest', methods=['POST'])
def suggest():
    data = request.json
    style = data.get('style', 'modern')
    room = data.get('room', '')
    room_map = {
        'Living Room': ['seating', 'table', 'lighting'],
        'Bedroom': ['bedroom', 'storage', 'lighting'],
        'Kitchen': ['table', 'storage'],
        'Dining Room': ['table', 'seating'],
        'Office': ['table', 'seating', 'storage']
    }
    cats = room_map.get(room, ['seating', 'table'])
    suggestions = [f for f in FURNITURE
                   if f.get('style') == style and f.get('category') in cats]
    return jsonify({"suggestions": suggestions[:4]})

@app.route('/api/quote', methods=['POST'])
def generate_quote():
    data = request.json
    items = data.get('items', [])
    total = sum(item.get('price', 0) for item in items)
    return jsonify({"items": items, "total": total, "currency": "INR"})

@app.route('/api/upload', methods=['POST'])
@app.route('/api/upload-blueprint', methods=['POST'])
def upload_blueprint():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No filename"}), 400
        
    filepath = os.path.join(UPLOAD_FOLDER, 'blueprint_' + file.filename)
    file.save(filepath)
    
    try:
        analyzer = BlueprintAnalyzer()
        recognition_data = analyzer.analyze(filepath)
        recognition_data["filename"] = file.filename
        recognition_data["url"] = f"/uploads/blueprint_{file.filename}"
        return jsonify(recognition_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to analyze blueprint",
            "message": str(e),
            "url": f"/uploads/blueprint_{file.filename}"
        }), 500

@app.route('/api/upload-furniture-image', methods=['POST'])
def upload_furniture_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    name = request.form.get('name', 'item')
    filename = name.lower().replace(' ', '_') + '_' + file.filename
    filepath = os.path.join(FURNITURE_IMG_FOLDER, filename)
    file.save(filepath)
    return jsonify({
        "message": "Image uploaded!",
        "url": f"/static/images/{filename}"
    })

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

