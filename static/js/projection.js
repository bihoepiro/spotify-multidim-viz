import { colorScale } from "./color_scale.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

export function init(selector, store, bus) {
  const root = document.querySelector(selector);
  const W = Math.max(380, root.clientWidth);
  const H = 360;
  const m = { top: 30, right: 20, bottom: 32, left: 40 };

  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const gAxes = svg.append("g");
  const gPts = svg.append("g");
  const info = svg.append("text")
    .attr("class", "pca-info")
    .attr("x", W - m.right)
    .attr("y", 16)
    .attr("text-anchor", "end");

  function render() {
    const { songs, metadata, activeCategory, projectionTechnique, hiddenCategories } = store.getState();
    if (!songs?.length) return;
    const tech = projectionTechnique || "pca";
    const color = colorScale(activeCategory, metadata);

    const xs = songs.map((s) => +s[`${tech}_x`] || 0);
    const ys = songs.map((s) => +s[`${tech}_y`] || 0);

    const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([m.left, W - m.right]);
    const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([H - m.bottom, m.top]);

    gAxes.selectAll("*").remove();
    gAxes.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).ticks(5));
    gAxes.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    if (tech === "pca" && metadata?.pca) {
      const pct = (metadata.pca.explained_variance_cumulative * 100).toFixed(1);
      info.text(`${pct}% varianza acumulada`);
    } else {
      info.text("");
    }

    const pts = gPts.selectAll("circle.song-point").data(songs, (d) => d.id);
    pts.exit().remove();
    pts.enter().append("circle")
      .attr("class", "song-point")
      .attr("r", 3.6)
      .attr("data-id", (d) => d.id)
      .on("mouseover", function (e, d) {
        showTip(e, d, metadata, activeCategory);
        bus.emit("hover", d.id);
      })
      .on("mousemove", moveTip)
      .on("mouseout", () => { hideTip(); bus.emit("hover", null); })
      .on("click", (e, d) => bus.emit("select", d.id))
      .merge(pts)
      .transition().duration(450)
      .attr("cx", (d) => x(+d[`${tech}_x`] || 0))
      .attr("cy", (d) => y(+d[`${tech}_y`] || 0))
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
