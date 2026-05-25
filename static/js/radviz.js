import { colorScale } from "./color_scale.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

export function init(selector, store, bus) {
  const root = document.querySelector(selector);
  const W = Math.max(380, root.clientWidth);
  const size = Math.min(W, 460);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 56;

  const svg = d3.select(root).append("svg").attr("viewBox", `0 0 ${size} ${size}`);
  svg.append("circle").attr("class", "boundary").attr("cx", cx).attr("cy", cy).attr("r", r);
  const gAnchors = svg.append("g");
  const gPts = svg.append("g");

  let features = [];
  let anchors = [];

  function place(d) {
    let s = 0, x = 0, y = 0;
    for (const a of anchors) {
      const v = +d[a.f] || 0;
      s += v;
      x += v * (a.x - cx);
      y += v * (a.y - cy);
    }
    if (s < 1e-9) return [cx, cy];
    return [cx + x / s, cy + y / s];
  }

  function render() {
    const { songs, metadata, activeCategory, hiddenCategories } = store.getState();
    features = metadata?.norm_features || [];
    if (!songs?.length || !features.length) return;
    const color = colorScale(activeCategory, metadata);

    anchors = features.map((f, i) => {
      const a = (2 * Math.PI * i) / features.length - Math.PI / 2;
      return { f, a, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });

    const sel = gAnchors.selectAll("g.anchor").data(anchors, (d) => d.f);
    sel.exit().remove();
    const enter = sel.enter().append("g").attr("class", "anchor");
    enter.append("circle").attr("r", 7);
    enter.append("text").attr("class", "feature-label");

    const merged = enter.merge(sel);
    merged.attr("transform", (d) => `translate(${d.x},${d.y})`);
    merged.select("circle")
      .on("mouseenter", (e, d) => {
        gPts.selectAll("circle.song-point")
          .classed("highlighted", (s) => +s[d.f] > 0.7);
      })
      .on("mouseleave", () => {
        gPts.selectAll("circle.song-point").classed("highlighted", false);
      });

    merged.select("text")
      .attr("text-anchor", (d) => Math.cos(d.a) > 0.3 ? "start" : Math.cos(d.a) < -0.3 ? "end" : "middle")
      .attr("dx", (d) => Math.cos(d.a) * 14)
      .attr("dy", (d) => Math.sin(d.a) * 14 + 4)
      .text((d) => d.f.replace(/_norm$/, ""));

    const pts = gPts.selectAll("circle.song-point").data(songs, (d) => d.id);
    pts.exit().remove();
    pts.enter().append("circle")
      .attr("class", "song-point")
      .attr("r", 3.5)
      .attr("data-id", (d) => d.id)
      .on("mouseover", function (e, d) {
        showTip(e, d, metadata, activeCategory);
        bus.emit("hover", d.id);
      })
      .on("mousemove", moveTip)
      .on("mouseout", () => { hideTip(); bus.emit("hover", null); })
      .on("click", (e, d) => bus.emit("select", d.id))
      .merge(pts)
      .attr("cx", (d) => place(d)[0])
      .attr("cy", (d) => place(d)[1])
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
