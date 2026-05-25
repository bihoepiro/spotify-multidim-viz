const FEATURES = [
  "valence", "acousticness", "danceability", "energy",
  "instrumentalness", "liveness", "speechiness", "tempo", "loudness",
];

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

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// T1: top 2 features que cambian con la década
export function findingsT1(songs) {
  const decadeNum = songs.map((s) => parseInt(s.decade));
  const correlations = FEATURES.map((f) => ({
    f,
    r: pearson(decadeNum, songs.map((s) => +s[`${f}_norm`])),
  }));
  const sorted = [...correlations].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const top = sorted[0], second = sorted[1];
  const oneLiner = `<b>${top.f}</b> ${top.r > 0 ? "↑" : "↓"} y <b>${second.f}</b> ${second.r > 0 ? "↑" : "↓"} con el tiempo`;
  return { oneLiner, correlations };
}

// T2: top 2 features que distinguen High de Low
export function findingsT2(songs) {
  const low = songs.filter((s) => s.popularity_tier === "Low");
  const high = songs.filter((s) => s.popularity_tier === "High");
  if (!low.length || !high.length) return { oneLiner: "Datos insuficientes", diffs: [], nLow: 0, nHigh: 0 };
  const diffs = FEATURES.map((f) => ({
    f,
    diff: mean(high.map((s) => +s[`${f}_norm`])) - mean(low.map((s) => +s[`${f}_norm`])),
  }));
  const sorted = [...diffs].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const top = sorted[0], second = sorted[1];
  const oneLiner = `populares: ${top.diff > 0 ? "más" : "menos"} <b>${top.f}</b>, ${second.diff > 0 ? "más" : "menos"} <b>${second.f}</b>`;
  return { oneLiner, diffs, nLow: low.length, nHigh: high.length };
}

// T3: cuatro arquetipos
export function findingsT3(songs) {
  const profiles = [0, 1, 2, 3].map((c) => {
    const sub = songs.filter((s) => +s.archetype_cluster === c);
    const means = FEATURES.map((f) => ({ f, m: mean(sub.map((s) => +s[`${f}_norm`])) }));
    means.sort((a, b) => b.m - a.m);
    return { c, n: sub.length, dominant: means[0], second: means[1], bottom: means[means.length - 1], all: means };
  });
  const labels = profiles.map(labelFor);
  const oneLiner = `4 estilos: ${labels.map((l) => `<b>${l}</b>`).join(" · ")}`;
  return { oneLiner, profiles, labels };
}

function labelFor(p) {
  const f = p.dominant.f;
  return ({
    acousticness: "acústicas",
    energy: "enérgicas",
    danceability: "bailables",
    instrumentalness: "instrumentales",
    speechiness: "habladas",
    liveness: "en vivo",
    valence: "alegres",
    loudness: "ruidosas",
    tempo: "rápidas",
  })[f] || f;
}
