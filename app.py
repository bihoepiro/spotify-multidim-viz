import json
import os
from functools import lru_cache

import pandas as pd
from flask import Flask, jsonify, render_template

CSV_PATH = "data/processed/spotify_processed.csv"
META_PATH = "data/processed/metadata.json"

app = Flask(__name__)


@lru_cache(maxsize=1)
def load_data():
    if not os.path.exists(CSV_PATH):
        return None
    return pd.read_csv(CSV_PATH).to_dict(orient="records")


@lru_cache(maxsize=1)
def load_meta():
    if not os.path.exists(META_PATH):
        return None
    with open(META_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def index():
    return render_template("index.html", has_data=load_data() is not None)


@app.route("/api/data")
def api_data():
    rows = load_data()
    if rows is None:
        return jsonify({"error": "ejecuta python preprocess.py"}), 500
    return jsonify(rows)


@app.route("/api/metadata")
def api_metadata():
    meta = load_meta()
    if meta is None:
        return jsonify({"error": "ejecuta python preprocess.py"}), 500
    return jsonify(meta)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
