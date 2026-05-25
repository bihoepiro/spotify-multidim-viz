import { colorScale } from "./color_scale.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

export function init(selector, store, bus) {
  const root = document.querySelector(selector);
  const W = Math.max(380, root.clientWidth);
  const H = 380;
  const m = { top: 50, right: 28, bottom: 22, left: 36 };

  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const gLines = svg.append("g");
  const gAxes = svg.append("g");

  let features = [];
  let x;
  const y = {};
  const line = d3.line();

  function build() {
    features = (store.getState().metadata?.norm_features) || [];
    if (!features.length) return;

    x = d3.scalePoint()
      .domain(features)
      .range([m.left, W - m.right])
      .padding(0.04);

    for (const f of features) {
      y[f] = d3.scaleLinear().domain([0, 1]).range([H - m.bottom, m.top]);
    }
  }

  function path(d) {
    return line(features.map((f) => [x(f), y[f](d[f] ?? 0)]));
  }

  function applyBrushDim() {
    const filters = activeFilters();
    gLines.selectAll("path.song-line").classed("dimmed", function (d) {
      return !insideAll(d, filters);
    });
  }

  function activeFilters() {
    const f = store.getState().brushFilters || {};
    return Object.entries(f).filter(([, r]) => r != null);
  }

  function insideAll(d, filters) {
    for (const [feat, [lo, hi]] of filters) {
      const v = d[feat];
      if (v == null || v < lo || v > hi) return false;
    }
    return true;
  }

  function render() {
    build();
    const { songs, activeCategory, metadata, hiddenCategories } = store.getState();
    if (!songs?.length || !features.length) return;

    const color = colorScale(activeCategory, metadata);

    gAxes.selectAll("*").remove();
    for (const f of features) {
      const g = gAxes.append("g").attr("transform", `translate(${x(f)},0)`);

      g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y[f]).ticks(4).tickFormat(d3.format(".1f")));

      g.append("text")
        .attr("class", "feature-label")
        .attr("text-anchor", "middle")
        .attr("y", m.top - 12)
        .attr("transform", `rotate(-22 0 ${m.top - 12})`)
        .text(f.replace(/_norm$/, ""));

      const brush = d3.brushY()
        .extent([[-12, m.top], [12, H - m.bottom]])
        .on("brush end", (event) => {
          if (!event.sourceEvent) return;
          const filters = { ...store.getState().brushFilters };
          if (!event.selection) {
            filters[f] = null;
          } else {
            const [a, b] = event.selection.map(y[f].invert).sort((p, q) => p - q);
            filters[f] = [a, b];
          }
          store.setState({ brushFilters: filters });
          applyBrushDim();
          bus.emit("brush", filters);
        });

      g.append("g").attr("class", "brush").call(brush);
    }

    const sel = gLines.selectAll("path.song-line").data(songs, (d) => d.id);
    sel.exit().remove();
    sel.enter().append("path")
      .attr("class", "song-line")
      .attr("data-id", (d) => d.id)
      .on("mouseover", function (e, d) {
        d3.select(this).classed("highlighted", true).raise();
        showTip(e, d, metadata, activeCategory);
        bus.emit("hover", d.id);
      })
      .on("mousemove", moveTip)
      .on("mouseout", function () {
        d3.select(this).classed("highlighted", false);
        hideTip();
        bus.emit("hover", null);
      })
      .merge(sel)
      .attr("d", path)
      .attr("stroke", (d) => color(d[activeCategory]))
      .style("display", (d) => hiddenCategories?.has?.(d[activeCategory]) ? "none" : null);

    applyBrushDim();
  }

  function highlight(id) {
    gLines.selectAll("path.song-line")
      .classed("highlighted", function () { return this.dataset.id === id; });
  }

  store.subscribe(render);
  render();

  bus.on("hover", (id) => id ? highlight(id) : highlight(null));
  bus.on("select", (id) => {
    if (!id) return;
    highlight(id);
    setTimeout(() => highlight(null), 2000);
  });
}
