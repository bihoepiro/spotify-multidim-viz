# Spotify · Análisis Multidimensional

App web para explorar 100 años de música popular usando técnicas de visualización
multidimensional sobre el dataset público de Spotify (Kaggle, 170 653 canciones,
1921-2020).


---

## Tareas analíticas

| | Tarea | Operación | Variables | Vistas |
|---|---|---|---|---|
| **T1** | Identificar tendencias temporales en los atributos de audio | Correlación de Pearson entre `decade` y cada feature | 9 features cuantitativas vs `decade` ordinal | Parallel Coordinates + PCA |
| **T2** | Comparar el perfil sonoro de canciones populares vs no populares | Comparación de medias por grupo (Low &lt; 30 vs High ≥ 70) | 9 features cuantitativas + `popularity_tier` categórica | RadViz + Parallel Coordinates |
| **T3** | Detectar y caracterizar arquetipos sonoros | Clustering KMeans (k=4) + perfilado de centroides | 9 features normalizadas + `archetype_cluster` derivada | PCA + Star Coordinates |

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Flask 3 (Python 3.10+) |
| Procesamiento | pandas, numpy, scikit-learn |
| Frontend | HTML + CSS + JavaScript ES2020 (modular) |
| Visualizaciones | D3.js v7 (sin bundler, cargado por CDN) |

Sin React, sin Vue, sin frameworks JS. Cada vista es un módulo ESM que se carga
directamente en el navegador.

---

## Cómo correr

```bash
pip install -r requirements.txt
python preprocess.py     # genera data/processed/*
python app.py            # servidor en http://localhost:5000
```

`preprocess.py` se ejecuta una sola vez. Su salida (`spotify_processed.csv` y
`metadata.json`) es lo que sirve el backend; las visualizaciones nunca tocan el
CSV crudo.

---

## Pipeline de datos

`preprocess.py` aplica esta secuencia determinista (semilla `42`, reproducible):

1. **Carga** del CSV crudo (170k filas).
2. **Detección de features**: las 9 columnas de audio (`valence`, `acousticness`,
   `danceability`, `energy`, `instrumentalness`, `liveness`, `speechiness`,
   `tempo`, `loudness`). Aborta si faltan ≥ 3.
3. **Limpieza**: descarta filas con NaN en cualquier feature.
4. **Filtro temporal**: `year ∈ [1900, 2100]`. Deriva `decade` como
   `f"{(year // 10) * 10}s"`.
5. **Muestreo estratificado por década** con `n_max = 1500`. Cada década aporta
   proporcionalmente. Esto mantiene la app interactiva (renderizar 170k líneas
   en SVG bloquea el navegador).
6. **Tier de popularidad**: `Low` &lt; 30, `Mid` ∈ [30, 70), `High` ≥ 70.
7. **Normalización MinMax** de las 9 features → columnas `<feature>_norm` ∈ [0, 1].
8. **KMeans** con `k=4` sobre las features normalizadas → `archetype_cluster`.
9. **PCA 2D** con `StandardScaler` previo → `pca_x`, `pca_y` y varianza
   acumulada (~50%).
10. **Salida**:
    - `data/processed/spotify_processed.csv` (1500 × 32 columnas)
    - `data/processed/metadata.json` (features, dominios de categorías,
      varianza PCA, centroides KMeans)

---

## Visualizaciones

Las cuatro principales son obligatorias por la consigna; los gráficos de
soporte añaden contexto univariado y bivariado.

### Principales

| Vista | Algoritmo | Posición | Interacción |
|---|---|---|---|
| **Parallel Coordinates** | 9 ejes verticales escalados a [0, 1] | `(x_axis(i), y_i(s))` por canción | Brush vertical por eje (intersección AND) · hover en línea |
| **RadViz** | 9 anclas equiespaciadas sobre círculo unitario | `pos = Σ(vᵢ·aᵢ) / Σvᵢ` | Hover en ancla resalta canciones con `vᵢ > 0.7` · click en punto |
| **PCA** | StandardScaler + PCA(2) precomputado en Python | `(pca_x, pca_y)` directos | Click en punto → highlight cruzado 2 s en otras vistas |
| **Star Coordinates** | Suma vectorial ponderada | `pos = Σ wᵢ·vᵢ·uᵢ` (escalada al viewport) | Drag de nodos verdes para mover ejes · sliders por feature `wᵢ ∈ [0, 2]` |

### Apoyo

| Vista | Para qué |
|---|---|
| **Histograma** (D3 `d3.bin`) | Distribución univariada de la feature seleccionada |
| **Matriz de correlación** (Pearson, paleta divergente RdBu) | Relaciones lineales entre todas las features |
| **Scatter 2D** | Cualquier par de features con color por la categoría activa |

### Coordinación cruzada

Todas las vistas leen del mismo `data_store` y publican eventos en un
`event_bus`. Los eventos disparan respuestas locales sin re-data-join:

- `hover(songId)` → resalta la misma canción en las cuatro vistas.
- `select(songId)` → highlight con timer de 2 s.
- `brush(filters)` → atenúa puntos/líneas que no satisfacen los rangos
  brusheados en las otras vistas.
- `legend toggle` → oculta/muestra una categoría en todas las vistas.

---

## Variables del dataset

### Features de audio (las 9 dimensiones)

| Feature | Significado |
|---|---|
| `valence` | Positividad emocional percibida [0, 1] |
| `energy` | Intensidad y actividad [0, 1] |
| `danceability` | Aptitud para bailar [0, 1] |
| `acousticness` | Probabilidad de ser acústica [0, 1] |
| `instrumentalness` | Probabilidad de no contener voces [0, 1] |
| `liveness` | Probabilidad de grabación en vivo [0, 1] |
| `speechiness` | Presencia de palabra hablada [0, 1] |
| `tempo` | BPM (normalizado a [0, 1]) |
| `loudness` | dB (normalizado a [0, 1]) |

### Categorías derivadas

| Variable | Origen | Valores |
|---|---|---|
| `decade` | `(year // 10) * 10 + "s"` | `1920s`, `1930s`, …, `2020s` |
| `popularity_tier` | corte por `popularity` | `Low` (&lt; 30), `Mid` ([30, 70)), `High` (≥ 70) |
| `archetype_cluster` | KMeans(k=4, seed=42) sobre features normalizadas | `0`, `1`, `2`, `3` |
