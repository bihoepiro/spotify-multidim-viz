import { colorScale } from "./color_scale.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const m = { top: 16, right: 12, bottom: 30, left: 36 };

// ─── Histograma ──────────────────────────────────────────────
export function initHistogram(selector, store) {
  const root = document.querySelector(selector);
  const bar = document.createElement("div");
  bar.className = "inline";
  root.appendChild(bar);

  const sel = document.createElement("select");
  sel.className = "select";
  bar.appendChild(label("Feature", sel));

  const W = Math.max(280, root.clientWidth);
  const H = 220;
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g");

  let active = null;

  function populate() {
    const feats = store.getState().metadata?.norm_features || [];
    sel.innerHTML = "";
    for (const f of feats) {
      const o = document.createElement("option");
      o.value = f; o.textContent = f.replace(/_norm$/, "");
      sel.appendChild(o);
    }
    active = feats[0];
    sel.value = active;
  }

  sel.onchange = () => { active = sel.value; render(); };

  function render() {
    const { songs } = store.getState();
    if (!songs?.length || !active) return;
    const values = songs.map((s) => +s[active]).filter((v) => !isNaN(v));

    const x = d3.scaleLinear().domain([0, 1]).range([m.left, W - m.right]);
    const bins = d3.bin().domain([0, 1]).thresholds(28)(values);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)]).nice().range([H - m.bottom, m.top]);

    g.selectAll("*").remove();
    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).ticks(5));
    g.append("g").attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4));

    g.selectAll("rect.bar").data(bins).join("rect")
      .attr("class", "bar")
      .attr("fill", "#1db954")
      .attr("opacity", 0.85)
      .attr("x", (b) => x(b.x0) + 1)
      .attr("y", H - m.bottom)
      .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
      .attr("height", 0)
      .transition().duration(280)
      .attr("y", (b) => y(b.length))
      .attr("height", (b) => H - m.bottom - y(b.length));
  }

  store.subscribe(() => { if (!active) populate(); render(); });
  populate(); render();
}

// ─── Correlación ─────────────────────────────────────────────
export function initCorrelation(selector, store) {
  const root = document.querySelector(selector);
  const W = Math.max(280, root.clientWidth);
  const size = Math.min(W, 360);
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${size} ${size}`);
  const g = svg.append("g");

  function pearson(xs, ys) {
    const n = xs.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    const mx = sx / n, my = sy / n;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    return num / (Math.sqrt(dx2 * dy2) || 1);
  }

  function render() {
    const { songs, metadata } = store.getState();
    if (!songs?.length) return;
    const feats = metadata?.norm_features || [];
    if (!feats.length) return;

    const labels = feats.map((f) => f.replace(/_norm$/, "").slice(0, 7));
    const cols = feats.map((f) => songs.map((s) => +s[f]));

    const offsetTop = 56, offsetLeft = 64;
    const cell = (size - offsetLeft - 8) / feats.length;
    const color = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);

    g.selectAll("*").remove();
    for (let i = 0; i < feats.length; i++) {
      for (let j = 0; j < feats.length; j++) {
        const v = i === j ? 1 : pearson(cols[i], cols[j]);
        g.append("rect")
          .attr("x", offsetLeft + j * cell)
          .attr("y", offsetTop + i * cell)
          .attr("width", cell - 1)
          .attr("height", cell - 1)
          .attr("rx", 2)
          .attr("fill", color(v));
        g.append("text")
          .attr("class", "correlation-cell-text")
          .attr("x", offsetLeft + j * cell + cell / 2)
          .attr("y", offsetTop + i * cell + cell / 2)
          .attr("fill", Math.abs(v) > 0.5 ? "#fff" : "#222")
          .text(v.toFixed(2));
      }
      g.append("text")
        .attr("x", offsetLeft - 6)
        .attr("y", offsetTop + i * cell + cell / 2 + 3)
        .attr("text-anchor", "end")
        .attr("fill", "#888")
        .attr("font-size", 10)
        .text(labels[i]);
      g.append("text")
        .attr("transform", `translate(${offsetLeft + i * cell + cell / 2},${offsetTop - 6}) rotate(-40)`)
        .attr("fill", "#888")
        .attr("font-size", 10)
        .text(labels[i]);
    }
  }

  store.subscribe(render);
  render();
}

// ─── Scatter 2D ──────────────────────────────────────────────
export function initScatter(selector, store) {
  const root = document.querySelector(selector);
  const bar = document.createElement("div");
  bar.className = "inline";
  root.appendChild(bar);

  const selX = document.createElement("select");
  const selY = document.createElement("select");
  selX.className = selY.className = "select";
  bar.append(label("X", selX), label("Y", selY));

  const W = Math.max(280, root.clientWidth);
  const H = 220;
  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const gAxes = svg.append("g");
  const gPts = svg.append("g");

  let fx = null, fy = null;

  function populate() {
    const feats = store.getState().metadata?.norm_features || [];
    if (!feats.length) return;
    for (const s of [selX, selY]) {
      s.innerHTML = "";
      for (const f of feats) {
        const o = document.createElement("option");
        o.value = f; o.textContent = f.replace(/_norm$/, "");
        s.appendChild(o);
      }
    }
    fx = feats[0]; fy = feats[1] || feats[0];
    selX.value = fx; selY.value = fy;
  }

  selX.onchange = () => { fx = selX.value; render(); };
  selY.onchange = () => { fy = selY.value; render(); };

  function render() {
    const { songs, metadata, activeCategory, hiddenCategories } = store.getState();
    if (!songs?.length || !fx || !fy) return;
    const color = colorScale(activeCategory, metadata);

    const x = d3.scaleLinear().domain([0, 1]).range([m.left, W - m.right]);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.bottom, m.top]);

    gAxes.selectAll("*").remove();
    gAxes.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H - m.bottom})`).call(d3.axisBottom(x).ticks(4));
    gAxes.append("g").attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4));

    const pts = gPts.selectAll("circle.song-point").data(songs, (d) => d.id);
    pts.exit().remove();
    pts.enter().append("circle")
      .attr("class", "song-point")
      .attr("r", 2.6)
      .on("mouseover", function (e, d) { showTip(e, d, metadata, activeCategory); })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip)
      .merge(pts)
      .transition().duration(280)
      .attr("cx", (d) => x(+d[fx] || 0))
      .attr("cy", (d) => y(+d[fy] || 0))
      .attr("fill", (d) => color(d[activeCategory]))
      .style("display", (d) => hiddenCategories?.has?.(d[activeCategory]) ? "none" : null);
  }

  store.subscribe(() => { if (!fx) populate(); render(); });
  populate(); render();
}

function label(text, ctrl) {
  const l = document.createElement("label");
  const s = document.createElement("span");
  s.textContent = text;
  l.append(s, ctrl);
  return l;
}
