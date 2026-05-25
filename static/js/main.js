import { createStore } from "./data_store.js";
import { createEventBus } from "./event_bus.js";
import { mountLegend } from "./legend.js";
import { init as initParallel } from "./parallel_coordinates.js";
import { init as initRadviz } from "./radviz.js";
import { init as initProjection } from "./projection.js";
import { init as initStar } from "./star_coordinates.js";
import { initHistogram, initCorrelation, initScatter } from "./support_charts.js";
import { findingsT1, findingsT2, findingsT3 } from "./findings.js";

const TASKS = {
  t1: { num: "01", title: "Evolución temporal", category: "decade", views: ["pc", "projection"] },
  t2: { num: "02", title: "Predictores de éxito", category: "popularity_tier", views: ["radviz", "pc"] },
  t3: { num: "03", title: "Arquetipos sonoros", category: "archetype_cluster", views: ["projection", "star"] },
};

let store, bus, viewsInit = false;
const findings = {};

async function main() {
  const [dataRes, metaRes] = await Promise.all([
    fetch("/api/data"), fetch("/api/metadata"),
  ]);
  if (!dataRes.ok || !metaRes.ok) {
    fail("Ejecuta `python preprocess.py` y recarga.");
    return;
  }
  const songs = await dataRes.json();
  const metadata = await metaRes.json();

  store = createStore({
    songs, metadata,
    activeCategory: "decade",
    projectionTechnique: "pca",
    brushFilters: {},
    hiddenCategories: new Set(),
    starWeights: {},
  });
  bus = createEventBus();

  findings.t1 = findingsT1(songs);
  findings.t2 = findingsT2(songs);
  findings.t3 = findingsT3(songs);

  document.getElementById("answer-t1").innerHTML = findings.t1.oneLiner;
  document.getElementById("answer-t2").innerHTML = findings.t2.oneLiner;
  document.getElementById("answer-t3").innerHTML = findings.t3.oneLiner;

  document.querySelectorAll("[data-task]").forEach((btn) => {
    btn.onclick = () => goToTask(btn.dataset.task);
  });
  document.getElementById("back-btn").onclick = goHome;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.dataset.mode === "task") goHome();
  });
}

function goToTask(key) {
  const task = TASKS[key];
  if (!task) return;

  store.setState({
    activeCategory: task.category,
    brushFilters: {},
    hiddenCategories: new Set(),
  });

  document.getElementById("bar-num").textContent = task.num;
  document.getElementById("bar-title").textContent = task.title;
  document.getElementById("bar-finding").innerHTML = findings[key].oneLiner;

  document.querySelectorAll("[data-view]").forEach((sec) => {
    sec.style.display = task.views.includes(sec.dataset.view) ? "" : "none";
  });

  document.body.dataset.mode = "task";
  window.scrollTo({ top: 0, behavior: "instant" });

  if (!viewsInit) {
    requestAnimationFrame(() => {
      initParallel("#pc", store, bus);
      initRadviz("#radviz", store, bus);
      initProjection("#projection", store, bus);
      initStar("#star", store, bus);
      initHistogram("#histogram", store);
      initCorrelation("#correlation", store);
      initScatter("#scatter2d", store);
      mountLegend("#legend", store);
      viewsInit = true;
    });
  } else {
    store.setState({});
  }
}

function goHome() {
  document.body.dataset.mode = "home";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function fail(msg) {
  const div = document.createElement("div");
  div.className = "banner";
  div.textContent = msg;
  document.body.insertBefore(div, document.body.firstChild);
}

main();
