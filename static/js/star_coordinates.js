import { colorScale } from "./color_scale.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

export function init(selector, store, bus) {
  const root = document.querySelector(selector);

  // Panel de pesos colapsable
  const panel = document.createElement("details");
  panel.className = "star-weights";
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>Pesos por feature</span> <span class="hint">(controla cuánto pesa cada eje)</span>`;
  panel.appendChild(summary);
  const sliders = document.createElement("div");
  sliders.className = "weights-grid";
  panel.appendChild(sliders);
  root.appendChild(panel);

  const W = Math.max(380, root.clientWidth);
  const size = Math.min(W, 460);
  const cx = size / 2, cy = size / 2;
  const baseR = size / 2 - 60;

  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${size} ${size}`);
  svg.append("circle").attr("class", "boundary").attr("cx", cx).attr("cy", cy).attr("r", baseR);
  const gAxes = svg.append("g");
  const gPts = svg.append("g");

  let features = [];
  const dirs = {};

  function ensureFeatures() {
    const incoming = store.getState().metadata?.norm_features || [];
    if (!incoming.length || incoming.length === features.length) return;
    features = incoming;
    features.forEach((f, i) => {
      const a = (2 * Math.PI * i) / features.length - Math.PI / 2;
      dirs[f] = { ux: Math.cos(a), uy: Math.sin(a) };
    });
    const w = { ...store.getState().starWeights };
    let touched = false;
    for (const f of features) if (w[f] == null) { w[f] = 1; touched = true; }
    if (touched) store.setState({ starWeights: w });
    buildSliders();
  }

  function buildSliders() {
    sliders.innerHTML = "";
    const w = store.getState().starWeights || {};
    for (const f of features) {
      const row = document.createElement("label");
      row.className = "weight-row";
      const name = f.replace(/_norm$/, "");
      row.innerHTML = `
        <span class="w-name">${name}</span>
        <input type="range" min="0" max="2" step="0.05" value="${w[f] ?? 1}">
        <span class="w-val">${(w[f] ?? 1).toFixed(2)}</span>
      `;
      const input = row.querySelector("input");
      const out = row.querySelector(".w-val");
      input.oninput = () => {
        out.textContent = (+input.value).toFixed(2);
        const sw = { ...store.getState().starWeights, [f]: +input.value };
        store.setState({ starWeights: sw });
      };
      sliders.append(row);
    }
  }

  function rawPos(d) {
    const w = store.getState().starWeights || {};
    let x = 0, y = 0;
    for (const f of features) {
      const v = +d[f] || 0;
      const wf = +(w[f] ?? 1);
      x += wf * v * dirs[f].ux;
      y += wf * v * dirs[f].uy;
    }
    return [x, y];
  }

  function render() {
    ensureFeatures();
    const { songs, metadata, activeCategory, hiddenCategories } = store.getState();
    if (!songs?.length || !features.length) return;
    const color = colorScale(activeCategory, metadata);

    // Pre-calcula posiciones crudas y escala para que toda la nube quepa
    const positions = songs.map(rawPos);
    const maxAbs = Math.max(
      ...positions.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))
    ) || 1;
    const scale = (baseR * 0.95) / maxAbs;

    // ─── ejes ───
    const sel = gAxes.selectAll("g.s-axis").data(features, (f) => f);
    sel.exit().remove();
    const enter = sel.enter().append("g").attr("class", "s-axis");
    enter.append("line").attr("class", "star-axis-line");
    enter.append("circle").attr("class", "star-handle").attr("r", 6);
    enter.append("text").attr("class", "feature-label");

    const merged = enter.merge(sel);
    merged.each(function (f) {
      const u = dirs[f];
      const ex = cx + baseR * u.ux;
      const ey = cy + baseR * u.uy;
      const g = d3.select(this);
      g.select("line").attr("x1", cx).attr("y1", cy).attr("x2", ex).attr("y2", ey);
      g.select("circle").attr("cx", ex).attr("cy", ey);
      g.select("text")
        .attr("x", cx + (baseR + 12) * u.ux)
        .attr("y", cy + (baseR + 12) * u.uy)
        .attr("text-anchor", u.ux > 0.3 ? "start" : u.ux < -0.3 ? "end" : "middle")
        .attr("dy", u.uy > 0.3 ? "0.9em" : u.uy < -0.3 ? "-0.2em" : "0.35em")
        .text(f.replace(/_norm$/, ""));
    });

    merged.select("circle.star-handle").call(
      d3.drag().on("drag", function (event, f) {
        const dx = event.x - cx;
        const dy = event.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        dirs[f] = { ux: dx / len, uy: dy / len };
        const newW = Math.max(0, Math.min(2, (len / baseR) * 2));
        const sw = { ...store.getState().starWeights, [f]: newW };
        const idx = features.indexOf(f);
        const sliderRow = sliders.children[idx];
        if (sliderRow) {
          sliderRow.querySelector("input").value = String(newW);
          sliderRow.querySelector(".w-val").textContent = newW.toFixed(2);
        }
        store.setState({ starWeights: sw });
      })
    );

    // ─── puntos (con escalado dinámico) ───
    const pts = gPts.selectAll("circle.song-point").data(songs, (d) => d.id);
    pts.exit().remove();
    pts.enter().append("circle")
      .attr("class", "song-point")
      .attr("r", 3.2)
      .attr("data-id", (d) => d.id)
      .on("mouseover", function (e, d) {
        showTip(e, d, metadata, activeCategory);
        bus.emit("hover", d.id);
      })
      .on("mousemove", moveTip)
      .on("mouseout", () => { hideTip(); bus.emit("hover", null); })
      .on("click", (e, d) => bus.emit("select", d.id))
      .merge(pts)
      .attr("cx", (d, i) => cx + positions[i][0] * scale)
      .attr("cy", (d, i) => cy + positions[i][1] * scale)
      .attr("fill", (d) => color(d[activeCategory]))
      .style("display", (d) => hiddenCategories?.has?.(d[activeCategory]) ? "none" : null);
  }

  function highlightOne(id) {
    gPts.selectAll("circle.song-point")
      .classed("highlighted", function () { return this.dataset.id === id; });
  }

  store.subscribe(render);
  render();

  bus.on("hover", (id) => highlightOne(id));
  bus.on("select", (id) => {
    if (!id) return;
    highlightOne(id);
    setTimeout(() => highlightOne(null), 2000);
  });
  bus.on("brush", (filters) => {
    const active = Object.entries(filters || {}).filter(([, v]) => v != null);
    gPts.selectAll("circle.song-point").classed("dimmed", function (d) {
      if (!active.length) return false;
      for (const [f, [lo, hi]] of active) {
        const v = d[f];
        if (v == null || v < lo || v > hi) return true;
      }
      return false;
    });
  });
}
