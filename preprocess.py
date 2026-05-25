from __future__ import annotations

import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import MinMaxScaler, StandardScaler

AUDIO_FEATURES = [
    "valence", "acousticness", "danceability", "energy",
    "instrumentalness", "liveness", "speechiness", "tempo", "loudness",
]
META_COLS = ["id", "name", "artists", "year", "release_date", "popularity"]
DISCRETE = ["key", "mode", "explicit"]

SEED = 42
N_SAMPLE = 1500
K = 4

RAW = "data/raw/spotify.csv"
OUT_CSV = "data/processed/spotify_processed.csv"
OUT_META = "data/processed/metadata.json"


def main():
    print(f"leyendo {RAW}")
    df = pd.read_csv(RAW)
    print(f"  {len(df):,} filas crudas")

    feats = [f for f in AUDIO_FEATURES if f in df.columns]
    missing = [f for f in AUDIO_FEATURES if f not in df.columns]
    if len(missing) >= 3:
        raise SystemExit(f"faltan columnas: {missing}")
    if missing:
        warnings.warn(f"continuando sin {missing}")
    print(f"  features detectadas: {feats}")

    cols = [c for c in META_COLS + DISCRETE if c in df.columns]
    df = df[cols + feats].dropna(subset=feats).reset_index(drop=True)
    print(f"  tras dropna: {len(df):,}")

    df = df[(df["year"] >= 1900) & (df["year"] <= 2100)].copy()
    df["decade"] = (df["year"].astype(int) // 10 * 10).astype(str) + "s"

    # muestreo estratificado por década
    if len(df) > N_SAMPLE:
        parts = []
        for dec, grp in df.groupby("decade"):
            n = max(1, round(len(grp) / len(df) * N_SAMPLE))
            parts.append(grp.sample(min(n, len(grp)), random_state=SEED))
        df = pd.concat(parts, ignore_index=True)
        if len(df) > N_SAMPLE:
            df = df.sample(N_SAMPLE, random_state=SEED).reset_index(drop=True)
    print(f"  muestra: {len(df):,}")

    # tier de popularidad
    df["popularity"] = df["popularity"].clip(0, 100)
    df["popularity_tier"] = pd.cut(
        df["popularity"],
        bins=[-0.1, 29.9, 69.9, 100.1],
        labels=["Low", "Mid", "High"],
    ).astype(str)

    # normalización
    scaler = MinMaxScaler()
    norm = scaler.fit_transform(df[feats])
    norm_cols = [f"{f}_norm" for f in feats]
    df[norm_cols] = norm

    # clusters
    km = KMeans(n_clusters=K, random_state=SEED, n_init=10)
    df["archetype_cluster"] = km.fit_predict(df[norm_cols]).astype(int)

    # PCA
    X = StandardScaler().fit_transform(df[norm_cols])
    pca = PCA(n_components=2)
    coords = pca.fit_transform(X)
    df["pca_x"] = coords[:, 0]
    df["pca_y"] = coords[:, 1]

    print(f"  PCA acumulada: {pca.explained_variance_ratio_.sum():.1%}")
    print(f"  cluster sizes: {dict(df['archetype_cluster'].value_counts().sort_index())}")

    # escribir
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    df.to_csv(OUT_CSV, index=False)
    print(f"escrito {OUT_CSV} ({len(df):,}×{df.shape[1]})")

    decades = sorted(df["decade"].unique(), key=lambda s: int(s[:-1]))
    metadata = {
        "audio_features": feats,
        "norm_features": norm_cols,
        "categories": {
            "decade": decades,
            "popularity_tier": ["Low", "Mid", "High"],
            "archetype_cluster": [0, 1, 2, 3],
        },
        "pca": {
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "explained_variance_cumulative": float(pca.explained_variance_ratio_.sum()),
            "components": pca.components_.tolist(),
        },
        "kmeans": {
            "n_clusters": K,
            "random_state": SEED,
            "inertia": float(km.inertia_),
            "centroids": km.cluster_centers_.tolist(),
        },
        "projections_available": ["pca"],
        "n_rows": len(df),
        "random_state": SEED,
    }
    with open(OUT_META, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"escrito {OUT_META}")


if __name__ == "__main__":
    main()
