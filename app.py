# -*- coding: utf-8 -*-
import os

import requests
from flask import Flask, Response, abort, jsonify, render_template, request, send_from_directory


app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATA_FOLDER = os.path.join(BASE_DIR, "data")
CACHE_DIR = os.path.join(BASE_DIR, "mediapipe")
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

for folder in [UPLOAD_FOLDER, DATA_FOLDER, CACHE_DIR, TEMPLATE_DIR]:
    os.makedirs(folder, exist_ok=True)

MEDIA_EXTENSIONS = (
    ".mp4", ".avi", ".mov", ".mkv", ".webm",
    ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma", ".opus",
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/calibration")
def calibration():
    return render_template("calibration.html")


@app.route("/segmentation")
def segmentation():
    return render_template("segmentation.html")


@app.route("/rating")
def rating():
    return render_template("rating.html")


@app.route("/visualization")
@app.route("/post-rating-analysis")
def post_rating_analysis():
    return render_template("visualization.html")


@app.route("/webgazer.js")
def serve_lib():
    return send_from_directory(BASE_DIR, "webgazer.js")


@app.route("/mediapipe/<path:filename>")
def proxy_mediapipe(filename):
    local_path = os.path.join(CACHE_DIR, filename)

    if os.path.exists(local_path):
        return send_from_directory(CACHE_DIR, filename)

    remote_sources = [
        f"https://webgazer.cs.brown.edu/mediapipe/{filename}",
        f"https://cdn.jsdelivr.net/gh/brownhci/WebGazer@master/www/mediapipe/{filename}",
    ]

    for url in remote_sources:
        try:
            resp = requests.get(url, timeout=10, stream=True)
            if resp.status_code == 200:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=16384):
                        f.write(chunk)
                print(f"[SYNC SUCCESS] cached locally: {filename}")
                return Response(resp.content, mimetype=resp.headers.get("content-type"))
        except Exception as e:
            print(f"[SYNC WARN] source failed: {url} | error: {e}")

    return abort(404)


def _list_upload_media():
    files = os.listdir(UPLOAD_FOLDER)
    return sorted(
        f for f in files
        if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))
        and f.lower().endswith(MEDIA_EXTENSIONS)
    )


@app.route("/api/videos", methods=["GET"])
@app.route("/api/media", methods=["GET"])
def list_media():
    try:
        return jsonify(_list_upload_media())
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files.get("media") or request.files.get("video")
    if file is None:
        return jsonify({"status": "error", "message": "No file part"}), 400
    if file.filename == "":
        return jsonify({"status": "error", "message": "No selected file"}), 400
    if not file.filename.lower().endswith(MEDIA_EXTENSIONS):
        return jsonify({
            "status": "error",
            "message": "Unsupported format. Use common video or audio files.",
        }), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)
    return jsonify({"status": "success", "filename": file.filename})


@app.route("/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, "static"), filename)


@app.route("/api/save", methods=["POST"])
def save_config():
    return jsonify({"status": "success", "message": "Configuration saved"})


@app.route("/api/save_csv", methods=["POST"])
def save_csv():
    data = request.json
    filename = data.get("filename")
    content = data.get("content")
    save_folder = (data.get("saveFolder") or "").strip()

    if not filename or content is None:
        return jsonify({"status": "error", "message": "Invalid data"}), 400

    target_dir = DATA_FOLDER
    if save_folder:
        safe_folder = os.path.basename(save_folder).replace("..", "").strip()
        if safe_folder:
            target_dir = os.path.join(DATA_FOLDER, safe_folder)

    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, filename)

    with open(file_path, "w", encoding="utf-8-sig") as f:
        f.write(content)

    print(f"[DATA SAVED] {file_path}")
    return jsonify({"status": "success", "message": f"Saved {filename} to {target_dir}."})


@app.route("/api/data_folders", methods=["GET"])
def list_data_folders():
    folders = ["."]
    try:
        for item in sorted(os.listdir(DATA_FOLDER)):
            full_path = os.path.join(DATA_FOLDER, item)
            if os.path.isdir(full_path):
                folders.append(item)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    return jsonify({"status": "success", "folders": folders})


@app.route("/api/data_manifest", methods=["GET"])
def data_manifest():
    folder = (request.args.get("folder") or ".").strip()
    if folder == ".":
        target_dir = DATA_FOLDER
    else:
        safe_folder = os.path.basename(folder).replace("..", "").strip()
        target_dir = os.path.join(DATA_FOLDER, safe_folder)

    if not os.path.exists(target_dir) or not os.path.isdir(target_dir):
        return jsonify({"status": "error", "message": "Folder not found"}), 404

    files = [f for f in os.listdir(target_dir) if f.lower().endswith(".csv")]

    def classify(file_name):
        low = file_name.lower()
        if low.endswith("_seg_gaze.csv"):
            return "seg_gaze"
        if low.endswith("_rating_gaze.csv"):
            return "rating_gaze"
        if low.endswith("_seg.csv"):
            return "seg"
        if low.endswith("_rating.csv"):
            return "rating"
        return "other"

    grouped = {"seg": [], "rating": [], "seg_gaze": [], "rating_gaze": [], "other": []}
    for f in sorted(files):
        grouped[classify(f)].append(f)

    return jsonify({"status": "success", "folder": folder, "files": grouped})


@app.route("/api/data_file", methods=["GET"])
def read_data_file():
    folder = (request.args.get("folder") or ".").strip()
    filename = (request.args.get("filename") or "").strip()
    if not filename:
        return jsonify({"status": "error", "message": "filename is required"}), 400

    safe_filename = os.path.basename(filename).replace("..", "").strip()
    if safe_filename != filename:
        return jsonify({"status": "error", "message": "Invalid filename"}), 400

    if folder == ".":
        target_dir = DATA_FOLDER
    else:
        safe_folder = os.path.basename(folder).replace("..", "").strip()
        target_dir = os.path.join(DATA_FOLDER, safe_folder)

    file_path = os.path.join(target_dir, safe_filename)
    if not os.path.exists(file_path):
        return jsonify({"status": "error", "message": "File not found"}), 404

    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    return jsonify({"status": "success", "filename": safe_filename, "content": content})


if __name__ == "__main__":
    port = 9005
    print("=" * 50)
    print(f"ANDrate running at http://127.0.0.1:{port}")
    print("=" * 50)
    app.run(host="127.0.0.1", port=port, debug=True)
