import { categoryDomain, colorScale } from "./color_scale.js";

const LABELS = {
  decade: "Década",
  popularity_tier: "Tier",
  archetype_cluster: "Cluster",
};

export function mountLegend(container, store) {
  const node = typeof container === "string" ? document.querySelector(container) : container;

  function paint() {
    const { activeCategory, metadata, hiddenCategories } = store.getState();
    const dom = categoryDomain(activeCategory, metadata);
    const scale = colorScale(activeCategory, metadata);

    node.innerHTML = "";
    const lbl = document.createElement("span");
    lbl.className = "chip-label-mute";
    lbl.textContent = LABELS[activeCategory] || activeCategory;
    node.appendChild(lbl);

    for (const v of dom) {
      const chip = document.createElement("span");
      chip.className = "chip" + (hiddenCategories?.has?.(v) ? " off" : "");
      chip.innerHTML = `<span class="chip-dot" style="background:${scale(v)}"></span>${v}`;
      chip.onclick = () => {
        const next = new Set(store.getState().hiddenCategories || []);
        if (next.has(v)) next.delete(v); else next.add(v);
        store.setState({ hiddenCategories: next });
      };
      node.appendChild(chip);
    }
  }

  store.subscribe(paint);
  paint();
}
