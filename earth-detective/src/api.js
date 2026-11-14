// Couche données d'Earth Detective.
//
// Deux modes, choisis par la configuration (voir config.js) :
//   1. backend  : le serveur de l'équipe fait les calculs (POST /analyze) et renvoie le résultat.
//   2. autonome : l'interface lit NASA POWER (réanalyse MERRA-2) et calcule elle-même avec stats.js.
//
// L'interface ne connaît que les fonctions exportées ici. Le reste est interchangeable.

import { analyze as analyzeLocal, annualAggregate, median } from './stats.js';
import { VARIABLES, VAR_BY_ID, PLACES } from './content.js';

export const CONFIG = Object.assign(
  {
    backendUrl: '', // ex. 'https://api.neural-newtons.example'. Vide = mode autonome.
    powerBase: 'https://power.larc.nasa.gov/api/temporal/monthly/point',
    snapshotUrl: './data/snapshot.json',
    firstYear: 1981,
    lastYear: new Date().getFullYear() - 1,
    mock: false,
    bot: { provider: 'local' }
  },
  (typeof window !== 'undefined' && window.EARTH_DETECTIVE_CONFIG) || {}
);

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
if (params.get('mock') === '1') CONFIG.mock = true;
if (params.get('backend')) CONFIG.backendUrl = params.get('backend');

export const mode = () => (CONFIG.mock ? 'mock' : CONFIG.backendUrl ? 'backend' : 'power');

// ---------- Grille ----------

export function snapToCell(lat, lon) {
  // Maille MERRA-2 : 0,5° en latitude, 0,625° en longitude.
  const la = Math.max(-90, Math.min(90, Math.round(lat / 0.5) * 0.5));
  let lo = Math.round(lon / 0.625) * 0.625;
  if (lo > 179.375) lo -= 360;
  if (lo < -180) lo += 360;
  return { lat: la, lon: Number(lo.toFixed(3)) };
}

const key = (c) => `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;

// ---------- Séries compactes ----------
// { cell:{lat,lon}, y0, y1, source, data:{ VAR: (number|null)[] } }  index = (année - y0) * 12 + (mois - 1)

export function toMonthly(series, varId) {
  const arr = series.data[varId];
  if (!arr) return null;
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    out.push({ year: series.y0 + Math.floor(i / 12), month: (i % 12) + 1, value: arr[i] == null ? NaN : arr[i] });
  }
  return out;
}

// Accepte les libellés pymannkendall (increasing / decreasing / no trend) comme les nôtres (up / down / inconclusive)
export function normDir(d) {
  if (!d) return null;
  const m = { increasing: 'up', decreasing: 'down', 'no trend': 'inconclusive', up: 'up', down: 'down', inconclusive: 'inconclusive' };
  return m[String(d).toLowerCase()] || null;
}

export function parsePower(json, y0, y1) {
  const par = json && json.properties && json.properties.parameter;
  if (!par) throw apiError('format', 'Réponse inattendue de la source de données.');
  const data = {};
  for (const [name, values] of Object.entries(par)) {
    const arr = new Array((y1 - y0 + 1) * 12).fill(null);
    let any = false;
    for (const [k, v] of Object.entries(values)) {
      if (!/^\d{6}$/.test(k)) continue;
      const yr = Number(k.slice(0, 4));
      const mo = Number(k.slice(4));
      if (mo < 1 || mo > 12 || yr < y0 || yr > y1) continue; // le mois 13 est la moyenne annuelle fournie par POWER
      if (typeof v === 'number' && v > -900) {
        arr[(yr - y0) * 12 + mo - 1] = v;
        any = true;
      }
    }
    if (any) data[name] = arr;
  }
  return data;
}

function apiError(kind, message, extra) {
  const e = new Error(message);
  e.kind = kind;
  Object.assign(e, extra);
  return e;
}

// ---------- Réseau avec file d'attente ----------

const queue = [];
let active = 0;
const MAX_ACTIVE = 4;
function schedule(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    pump();
  });
}
function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.shift();
    active++;
    job
      .fn()
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        pump();
      });
  }
}

async function fetchJson(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return await res.json();
      if (res.status === 429 || res.status >= 500) {
        lastErr = apiError('http', `Service indisponible (${res.status}).`, { status: res.status });
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        continue;
      }
      throw apiError('http', `Requête refusée (${res.status}).`, { status: res.status });
    } catch (e) {
      clearTimeout(timer);
      if (e.kind === 'http' && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e.kind ? e : apiError('network', 'Connexion impossible à la source de données.');
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr || apiError('network', 'Connexion impossible.');
}

// ---------- Cache : mémoire, stockage local, copie hors ligne ----------

const memory = new Map();
const inflight = new Map();
let snapshot = null;
let snapshotTried = false;

async function loadSnapshot() {
  if (snapshotTried) return snapshot;
  snapshotTried = true;
  try {
    const res = await fetch(CONFIG.snapshotUrl, { cache: 'no-cache' });
    if (res.ok) snapshot = await res.json();
  } catch (_) {
    snapshot = null;
  }
  return snapshot;
}

function readLocal(k) {
  try {
    const raw = localStorage.getItem('ed.v3.' + k);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
function writeLocal(k, v) {
  try {
    localStorage.setItem('ed.v3.' + k, JSON.stringify(v));
  } catch (_) {
    /* quota atteint : on ignore */
  }
}

const PARAMS = [...new Set(VARIABLES.filter((v) => !v.backendOnly).map((v) => (v.power ? v.power.param : v.id)))];

// Variables calculées à partir d'un paramètre NASA POWER (ex. pression partielle d'O₂ = 20,95 % × pression)
function applyDerived(data) {
  for (const v of VARIABLES) {
    if (v.power && data[v.power.param] && !data[v.id]) {
      data[v.id] = data[v.power.param].map((x) => (x == null ? null : Math.round(x * v.power.scale * 1e4) / 1e4));
    }
  }
  return data;
}

async function fetchPower(cell) {
  const y0 = CONFIG.firstYear;
  const y1 = CONFIG.lastYear;
  const base = `${CONFIG.powerBase}?community=AG&longitude=${cell.lon}&latitude=${cell.lat}&start=${y0}&end=${y1}&format=JSON`;
  let data = {};
  try {
    const json = await fetchJson(`${base}&parameters=${PARAMS.join(',')}`);
    data = parsePower(json, y0, y1);
  } catch (e) {
    if (e.kind === 'network') throw e;
    // Un paramètre refusé fait échouer toute la requête : on réessaie variable par variable.
    const parts = await Promise.all(
      PARAMS.map((p) =>
        fetchJson(`${base}&parameters=${p}`, {}, 2)
          .then((j) => parsePower(j, y0, y1))
          .catch(() => ({}))
      )
    );
    parts.forEach((d) => Object.assign(data, d));
    if (!Object.keys(data).length) throw e;
  }
  applyDerived(data);
  return { cell, y0, y1, source: 'power', data };
}

export async function getSeries(lat, lon, placeId) {
  const cell = snapToCell(lat, lon);
  const k = key(cell);
  if (memory.has(k)) return memory.get(k);
  if (inflight.has(k)) return inflight.get(k);

  const p = (async () => {
    if (CONFIG.mock) {
      const s = mockSeries(cell);
      memory.set(k, s);
      return s;
    }
    const cached = readLocal(k);
    if (cached && cached.y1 >= CONFIG.lastYear) {
      memory.set(k, cached);
      return cached;
    }
    if (placeId) {
      const snap = await loadSnapshot();
      const entry = snap && snap.places && snap.places[placeId];
      if (entry) {
        const s = { cell: entry.cell, y0: entry.y0, y1: entry.y1, source: 'snapshot', data: entry.data };
        memory.set(key(entry.cell), s);
        memory.set(k, s);
        return s;
      }
    }
    const s = await schedule(() => fetchPower(cell));
    memory.set(k, s);
    writeLocal(k, s);
    return s;
  })();
  inflight.set(k, p);
  try {
    return await p;
  } finally {
    inflight.delete(k);
  }
}

// ---------- Analyse ----------

/**
 * @param {{lat:number, lon:number, variable:string, start:number, end:number, alpha:number, placeId?:string}} req
 * @returns {Promise<object>} résultat normalisé (voir API_CONTRACT.md)
 */
export async function analyze(req) {
  const v = VAR_BY_ID[req.variable];
  const start = Math.max(req.start, v.minYear);
  if (v.backendOnly && !(CONFIG.backendUrl || CONFIG.mock)) throw apiError('needbackend', 'Variable disponible avec le backend.');
  if (CONFIG.backendUrl && !CONFIG.mock) {
    const body = { lat: req.lat, lon: req.lon, variable: req.variable, start, end: req.end, alpha: req.alpha };
    const raw = await fetchJson(`${CONFIG.backendUrl.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return fromBackend(raw, req, v);
  }
  const series = await getSeries(req.lat, req.lon, req.placeId);
  const monthly = toMonthly(series, req.variable);
  if (!monthly) throw apiError('missing', 'Variable indisponible à cet endroit.');
  const res = analyzeLocal(monthly, { agg: v.agg, alpha: req.alpha, startYear: start, endYear: req.end });
  res.meta = {
    variable: req.variable,
    unit: v.unit,
    source: series.source,
    cell: series.cell,
    period: [start, req.end],
    fullPeriod: [series.y0, series.y1],
    fullAnnual: annualAggregate(monthly, v.agg)
  };
  return res;
}

function fromBackend(raw, req, v) {
  const t = raw.trend || {};
  const annual = (raw.annual || []).map((d) => ({ year: d.year, value: d.value }));
  const x = annual.map((d) => d.year);
  const y = annual.map((d) => d.value);
  const slope = (t.slope_per_decade ?? 0) / 10;
  const intercept = t.intercept_per_year ?? (annual.length ? median(y.map((val, i) => val - slope * x[i])) : 0);
  const mean = t.mean ?? (y.length ? y.reduce((a, b) => a + b, 0) / y.length : NaN);
  const out = {
    n: annual.length,
    alpha: req.alpha,
    ok: annual.length >= 8 && !!raw.trend,
    annual,
    monthly: (raw.monthly || []).map((m) => ({ year: m.year, month: m.month, value: m.value, anomaly: m.anomaly })),
    climatology: raw.climatology || [],
    seasonal: (raw.seasonal || []).map((s) => ({
      month: s.month,
      slope: (s.slope_per_decade ?? NaN) / 10,
      lower: (s.ci95 ? s.ci95[0] : NaN) / 10,
      upper: (s.ci95 ? s.ci95[1] : NaN) / 10,
      p: s.p_value,
      significant: s.p_value < req.alpha
    })),
    trend: {
      direction: normDir(t.direction) || (t.significant ? (t.slope_per_decade > 0 ? 'up' : 'down') : 'inconclusive'),
      significant: !!t.significant,
      alpha: req.alpha,
      method: t.method || 'mann-kendall',
      p: t.p_value,
      slopePerYear: slope,
      slopePerDecade: t.slope_per_decade,
      ci: t.ci95,
      intercept,
      totalChange: t.total_change ?? slope * (x[x.length - 1] - x[0]),
      firstYear: x[0],
      lastYear: x[x.length - 1],
      mean,
      sd: t.sd ?? NaN,
      mk: t.mk || {},
      hr: t.hamed_rao || {},
      ols: t.ols ? { slopePerDecade: t.ols.slope_per_decade, ci: t.ols.ci95, p: t.ols.p_value, r2: t.ols.r2 } : null,
      autocorr1: t.autocorr1,
      autocorrelated: !!t.autocorrelated,
      seasonalMK: t.seasonal_mk || {},
      zUsed: t.z ?? (t.mk && t.mk.Z)
    },
    meta: {
      variable: req.variable,
      unit: v.unit,
      source: (raw.meta && raw.meta.source) || 'backend',
      cell: (raw.meta && raw.meta.cell) || { lat: req.lat, lon: req.lon },
      period: [req.start, req.end],
      fullPeriod: (raw.meta && raw.meta.full_period) || [req.start, req.end],
      fullAnnual: raw.full_annual || annual
    }
  };
  return out;
}

// ---------- Atlas des tendances ----------

let atlasGen = 0;
export function cancelAtlas() {
  atlasGen++;
}

export async function loadAtlas({ variable, start, end, alpha }, onItem) {
  const gen = ++atlasGen;
  const v = VAR_BY_ID[variable];
  const s0 = Math.max(start, v.minYear);
  if (CONFIG.backendUrl && !CONFIG.mock) {
    try {
      const url = `${CONFIG.backendUrl.replace(/\/$/, '')}/atlas?variable=${variable}&start=${s0}&end=${end}&alpha=${alpha}`;
      const raw = await fetchJson(url);
      if (gen !== atlasGen) return;
      (raw.points || []).forEach((p) =>
        onItem({
          id: p.id || `${p.lat},${p.lon}`,
          lat: p.lat,
          lon: p.lon,
          slopePerDecade: p.slope_per_decade,
          p: p.p_value,
          direction: normDir(p.direction) || (p.p_value < alpha ? (p.slope_per_decade > 0 ? 'up' : 'down') : 'inconclusive')
        })
      );
      return;
    } catch (_) {
      /* repli sur le calcul local */
    }
  }
  await Promise.all(
    PLACES.map(async (pl) => {
      try {
        const series = await getSeries(pl.lat, pl.lon, pl.id);
        if (gen !== atlasGen) return;
        const monthly = toMonthly(series, variable);
        if (!monthly) return;
        const r = analyzeLocal(monthly, { agg: v.agg, alpha, startYear: s0, endYear: end });
        if (!r.ok || gen !== atlasGen) return;
        onItem({ id: pl.id, lat: pl.lat, lon: pl.lon, slopePerDecade: r.trend.slopePerDecade, p: r.trend.p, direction: r.trend.direction });
      } catch (_) {
        /* un lieu indisponible n'empêche pas les autres */
      }
    })
  );
}

// ---------- Données de démonstration (développement uniquement) ----------
// Activées avec ?mock=1. Un bandeau le rappelle en permanence : ces valeurs ne viennent PAS de la NASA.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

function mockSeries({ lat, lon }) {
  const y0 = CONFIG.firstYear;
  const y1 = CONFIG.lastYear;
  const r = rng(Math.floor((lat + 90) * 977 + (lon + 180) * 131));
  const n = (y1 - y0 + 1) * 12;
  const polar = Math.abs(lat) / 90;
  const south = lat < 0 ? 1 : 0;
  const trendDir = r() < 0.75 ? 1 : -1;
  const data = {};
  const mk = (fn) => {
    const arr = [];
    let e = 0;
    for (let i = 0; i < n; i++) {
      e = 0.45 * e + gauss(r);
      const yr = Math.floor(i / 12);
      const m = i % 12;
      arr.push(Math.round(fn(yr, m, e) * 1000) / 1000);
    }
    return arr;
  };
  const season = (m) => Math.cos(((m - 6.5 + south * 6) / 12) * 2 * Math.PI);
  data.T2M = mk((yr, m, e) => 27 - 0.62 * Math.abs(lat) + season(m) * (3 + polar * 14) + 0.025 * yr * (1 + polar * 1.8) + e * (0.5 + polar));
  const wet = r() * 4 + 0.8;
  data.PRECTOTCORR = mk((yr, m, e) => Math.max(0.01, wet * (1 + 0.6 * season(m + 3)) + trendDir * 0.01 * yr * wet * 0.5 + e * wet * 0.4));
  data.RH2M = mk((yr, m, e) => Math.min(100, Math.max(5, 40 + 35 * (1 - Math.abs(lat) / 120) - trendDir * 0.05 * yr + e * 2.5)));
  data.SOIL = mk((yr, m, e) => Math.min(100, Math.max(3, 45 + 20 * (wet - 2.8) / 2 + 8 * season(m + 2) - trendDir * 0.06 * yr + e * 3)));
  const urban = Math.abs(lat) < 60 ? 1 : 0.2;
  const no2base = 1.2 + 3.5 * r() * urban;
  data.NO2 = mk((yr, m, e) => Math.max(0.1, no2base * (1 + 0.25 * season(m + 6)) - trendDir * 0.02 * yr * no2base * 0.5 + e * 0.25));
  for (const k of Object.keys(data)) {
    const v = VAR_BY_ID[k];
    if (v && v.minYear > y0) for (let i = 0; i < (v.minYear - y0) * 12; i++) data[k][i] = null;
  }
  return { cell: { lat, lon }, y0, y1, source: 'mock', data };
}
