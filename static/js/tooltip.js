const FEATURES = [
  "valence", "acousticness", "danceability", "energy",
  "instrumentalness", "liveness", "speechiness", "tempo", "loudness",
];

let tipNode = null;

function get() {
  if (!tipNode) tipNode = document.getElementById("tooltip");
  return tipNode;
}

export function showTip(event, song, meta, category) {
  const node = get();
  const feats = (meta?.audio_features?.length ? meta.audio_features : FEATURES);
  const artists = cleanArtists(song.artists);

  let bars = "";
  for (const f of feats) {
    const v = +song[`${f}_norm`];
    if (isNaN(v)) continue;
    bars += `
      <div class="lbl">${f}</div>
      <div class="tt-track"><div class="tt-fill" style="width:${(v*100).toFixed(0)}%"></div></div>
      <div class="num">${v.toFixed(2)}</div>`;
  }

  const tags = [];
  if (song.year != null) tags.push(`<span class="tt-tag"><b>${song.year}</b></span>`);
  if (song.popularity != null) tags.push(`<span class="tt-tag">pop <b>${song.popularity}</b></span>`);
  if (category && song[category] != null) {
    tags.push(`<span class="tt-tag">${prettyCat(category)} <b>${song[category]}</b></span>`);
  }

  node.innerHTML = `
    <div class="tt-name">${escape(song.name || "—")}</div>
    <div class="tt-artists">${escape(artists)}</div>
    <div class="tt-tags">${tags.join("")}</div>
    <div class="tt-bars">${bars}</div>
  `;
  node.style.display = "block";
  moveTip(event);
}

export function moveTip(event) {
  const node = get();
  const pad = 14;
  const w = node.offsetWidth || 320;
  const h = node.offsetHeight || 120;
  let x = event.pageX + pad;
  let y = event.pageY + pad;
  if (x + w > window.scrollX + window.innerWidth) x = event.pageX - w - pad;
  if (y + h > window.scrollY + window.innerHeight) y = event.pageY - h - pad;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

export function hideTip() {
  get().style.display = "none";
}

function cleanArtists(raw) {
  if (!raw || typeof raw !== "string") return raw ?? "—";
  return raw.replace(/^\[|\]$/g, "").replace(/'/g, "").trim() || "—";
}

function prettyCat(c) {
  return ({ decade: "década", popularity_tier: "tier", archetype_cluster: "cluster" })[c] || c;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  })[c]);
}
