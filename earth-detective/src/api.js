// Couche données d'Earth Detective, branchée sur le contrat de l'équipe (docs/CONTRAT.md).
//
// Toutes les données viennent du serveur Python (app/api.py), qui appelle trend.data et trend.stats.
// Ce fichier ne fait AUCUN calcul statistique : il met seulement en forme le ResultatTendance pour les
// graphiques (moyennes annuelles d'affichage, droite de tendance exprimée par année).
// L'interface ne connaît que les fonctions exportées ici.

import { VAR_BY_ID } from './content.js';

export const CONFIG = Object.assign(
  {
    apiBase: '', // vide = même adresse que la page (le serveur Python sert aussi le front)
    firstYear: 1980,
    lastYear: 2024,
    mock: false,
    advisor: false,
    bot: { provider: 'backend' }
  },
  (typeof window !== 'undefined' && window.EARTH_DETECTIVE_CONFIG) || {}
);

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
if (params.get('api')) CONFIG.apiBase = params.get('api');

export const mode = () => (CONFIG.mock ? 'mock' : 'contrat');

// Les régions sont des zones du catalogue, pas des mailles : on garde les coordonnées telles quelles.
export const snapToCell = (lat, lon) => ({ lat: +lat.toFixed(3), lon: +lon.toFixed(3) });

function apiError(kind, message, extra) {
  const e = new Error(message);
  e.kind = kind;
  Object.assign(e, extra);
  return e;
}

async function getJson(chemin, opts = {}) {
  const url = `${CONFIG.apiBase.replace(/\/$/, '')}${chemin}`;
  let res;
  try {
    res = await fetch(url, opts);
  } catch (_) {
    throw apiError('network', 'Le serveur Earth Detective ne répond pas.');
  }
  if (res.ok) return res.json();
  let detail = null;
  try {
    detail = (await res.json()).detail;
  } catch (_) {
    /* réponse sans corps JSON */
  }
  // Codes du serveur : inconnu, pas_en_cache, periode_trop_courte, advisor_absent
  throw apiError((detail && detail.code) || 'http', (detail && detail.message) || `Erreur ${res.status}`, { status: res.status });
}

const debutDe = (annee, variable) => `${Math.max(annee, VAR_BY_ID[variable].minYear)}-01`;
const finDe = (annee) => `${annee}-12`;

// ---------- Catalogue ----------

export async function chargerCatalogue() {
  const cat = await getJson('/api/catalogue');
  CONFIG.mock = !!cat.mock;
  CONFIG.advisor = !!cat.advisor;
  const periodes = Object.values(cat.periodes || {});
  if (periodes.length) {
    CONFIG.lastYear = Math.max(...periodes.map((p) => +p[1].slice(0, 4)));
    CONFIG.firstYear = Math.min(...periodes.map((p) => +p[0].slice(0, 4)));
  }
  return cat;
}

// ---------- Mise en forme d'un ResultatTendance pour les graphiques ----------

const paires = (s) => s.dates.map((d, i) => [d, s.valeurs[i]]);
const anneeDe = (d) => +d.slice(0, 4);
const moisDe = (d) => +d.slice(5, 7);
const tempsDe = (d) => anneeDe(d) + (moisDe(d) - 0.5) / 12; // milieu du mois, en années

/** Moyenne de chaque année complète (12 mois renseignés) : sert uniquement à l'affichage. */
function moyennesAnnuelles(points) {
  const parAnnee = new Map();
  for (const [d, v] of points) {
    if (v == null || !Number.isFinite(v)) continue;
    const a = anneeDe(d);
    if (!parAnnee.has(a)) parAnnee.set(a, []);
    parAnnee.get(a).push(v);
  }
  return [...parAnnee.entries()]
    .filter(([, vs]) => vs.length === 12)
    .map(([year, vs]) => ({ year, value: vs.reduce((s, v) => s + v, 0) / 12 }))
    .sort((a, b) => a.year - b.year);
}

/** Valeur Z de Mann-Kendall si le tableau `tests` du contrat la fournit (sinon la jauge est masquée). */
function zDepuisTests(tests) {
  const ligne = (tests || []).find((t) => /mann.?kendall/i.test(String(t.Test)) && Number.isFinite(t.Valeur));
  return ligne ? ligne.Valeur : null;
}

function depuisContrat(raw, req) {
  const v = VAR_BY_ID[req.variable];
  const serie = paires(raw.serie);
  const anomalies = new Map(paires(raw.anomalies));
  const droite = paires(raw.droite).filter(([, val]) => Number.isFinite(val));

  // Mois de la période analysée : valeur brute et écart à la normale (calculé par le moteur).
  const monthly = serie
    .filter(([d]) => anomalies.has(d))
    .map(([d, val]) => ({ year: anneeDe(d), month: moisDe(d), value: val ?? NaN, anomaly: anomalies.get(d) ?? NaN }));
  const annual = moyennesAnnuelles(monthly.map((m) => [`${m.year}-${String(m.month).padStart(2, '0')}`, m.value]));
  const fullAnnual = moyennesAnnuelles(serie);

  // La droite du contrat est tracée dans l'espace des écarts ; on la remonte au niveau moyen
  // (valeur − écart) pour la superposer aux moyennes annuelles. Une moyenne annuelle correspond
  // au milieu de l'année : droite(année + 0,5).
  const ecarts = monthly.filter((m) => Number.isFinite(m.value) && Number.isFinite(m.anomaly));
  const niveau = ecarts.length ? ecarts.reduce((s, m) => s + (m.value - m.anomaly), 0) / ecarts.length : 0;
  let pente = raw.pente_decennie / 10;
  let origine = 0;
  if (droite.length >= 2) {
    const [d0, v0] = droite[0];
    const [d1, v1] = droite[droite.length - 1];
    pente = (v1 - v0) / (tempsDe(d1) - tempsDe(d0));
    origine = v0 - pente * tempsDe(d0);
  }
  const intercept = origine + pente * 0.5 + niveau;
  const y0 = anneeDe(raw.debut);
  const y1 = anneeDe(raw.fin);
  const valeursAnnuelles = annual.map((d) => d.value);
  const moyenne = valeursAnnuelles.length ? valeursAnnuelles.reduce((s, x) => s + x, 0) / valeursAnnuelles.length : NaN;

  return {
    n: annual.length,
    alpha: 0.05,
    ok: true, // le moteur a déjà vérifié la durée minimale (ValueError sinon)
    annual,
    monthly,
    climatology: [],
    seasonal: [],
    trend: {
      direction: raw.significatif ? (raw.sens === 'hausse' ? 'up' : 'down') : 'inconclusive',
      significant: !!raw.significatif,
      alpha: 0.05,
      method: 'mann-kendall',
      p: raw.p_value,
      slopePerYear: pente, // pente de la droite du contrat (tracé)
      slopePerDecade: raw.pente_decennie, // pente de Sen (chiffres affichés)
      ci: raw.ic95,
      intercept,
      totalChange: raw.changement_total,
      firstYear: y0,
      lastYear: y1,
      mean: moyenne,
      sd: NaN,
      mk: {},
      hr: {},
      ols: null,
      autocorr1: null,
      autocorrelated: false,
      seasonalMK: {},
      zUsed: null // jauge « bruit / signal » retirée de l'interface
    },
    meta: {
      variable: req.variable,
      unit: v.unit,
      source: raw.variable.source,
      cell: { lat: raw.region.centre[0], lon: raw.region.centre[1] },
      period: [y0, y1],
      fullPeriod: [anneeDe(raw.serie.dates[0]), anneeDe(raw.serie.dates[raw.serie.dates.length - 1])],
      fullAnnual
    },
    // Série mensuelle pour le graphique : valeur brute, écart à la normale, droite de tendance du moteur.
    points: monthly.map((m) => ({ d: new Date(Date.UTC(m.year, m.month - 1, 15)), v: m.value, a: m.anomaly })),
    droite: droite.map(([d, val]) => ({ d: new Date(Date.UTC(anneeDe(d), moisDe(d) - 1, 15)), v: val })),
    niveau,
    contrat: raw // ResultatTendance complet : tests, résumé, période courte, origine...
  };
}

// ---------- Analyse ----------

/**
 * @param {{variable:string, start:number, end:number, placeId:string}} req
 * @returns {Promise<object>} résultat mis en forme pour les graphiques (+ `contrat` : la réponse brute)
 */
export async function analyze(req) {
  if (!req.placeId) throw apiError('noregion', 'Choisis une région du catalogue.');
  const q = new URLSearchParams({ variable_id: req.variable, region_id: req.placeId, debut: debutDe(req.start, req.variable), fin: finDe(req.end) });
  return depuisContrat(await getJson(`/api/analyse?${q}`), req);
}

// ---------- Atlas des tendances (une région = un repère sur le globe) ----------

let atlasGen = 0;
export function cancelAtlas() {
  atlasGen++;
}

export async function loadAtlas({ variable, start, end }, onItem) {
  const gen = ++atlasGen;
  let raw;
  try {
    const q = new URLSearchParams({ variable_id: variable, debut: debutDe(start, variable), fin: finDe(end) });
    raw = await getJson(`/api/atlas?${q}`);
  } catch (_) {
    return; // l'atlas est un plus : son absence ne bloque pas l'enquête
  }
  if (gen !== atlasGen) return;
  for (const p of raw.points) {
    onItem({
      id: p.region_id,
      lat: p.lat,
      lon: p.lon,
      slopePerDecade: p.pente_decennie,
      p: p.p_value,
      direction: p.significatif ? (p.sens === 'hausse' ? 'up' : 'down') : 'inconclusive'
    });
  }
}

// ---------- Stabilité : le verdict selon l'année de départ (calculé par le moteur) ----------

export async function stabilite({ variable, placeId, end }) {
  const q = new URLSearchParams({ variable_id: variable, region_id: placeId, fin: finDe(end) });
  const raw = await getJson(`/api/stabilite?${q}`);
  return raw.points.map((p) => ({
    start: p.debut,
    slope: p.pente_decennie,
    lower: p.ic95[0],
    upper: p.ic95[1],
    p: p.p_value,
    significant: !!p.significatif
  }));
}

// ---------- Assistant (trend.advisor) ----------

export async function expliquer({ variable, placeId, start, end }) {
  const corps = { variable_id: variable, region_id: placeId, debut: debutDe(start, variable), fin: finDe(end) };
  const raw = await getJson('/api/expliquer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  return raw.texte;
}

export async function suggerer(question) {
  return getJson('/api/suggerer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
}
