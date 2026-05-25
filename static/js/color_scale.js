const TIER_COLORS = ["#d62728", "#888", "#1db954"];
const CLUSTER_COLORS = ["#1f77b4", "#ff7f0e", "#9467bd", "#e377c2"];

export function categoryDomain(category, meta) {
  const cats = meta?.categories || {};
  if (category === "decade") return [...(cats.decade || [])].sort((a, b) => parseInt(a) - parseInt(b));
  if (category === "popularity_tier") return ["Low", "Mid", "High"];
  if (category === "archetype_cluster") return [0, 1, 2, 3];
  return [];
}

export function colorScale(category, meta) {
  const dom = categoryDomain(category, meta);
  if (category === "decade") {
    return d3.scaleOrdinal()
      .domain(dom)
      .range(dom.map((_, i) => d3.interpolateViridis(0.05 + 0.85 * i / Math.max(1, dom.length - 1))));
  }
  if (category === "popularity_tier") return d3.scaleOrdinal().domain(dom).range(TIER_COLORS);
  if (category === "archetype_cluster") return d3.scaleOrdinal().domain(dom).range(CLUSTER_COLORS);
  return () => "#888";
}
