// Moteur statistique d'Earth Detective.
// Fonctions pures, sans dépendance, testables dans Node comme dans le navigateur.
// Le backend de l'équipe peut remplacer ce module : voir API_CONTRACT.md.

// ---------- Lois de probabilité ----------

function erfc(x) {
  // Numerical Recipes, précision relative ~1e-7
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

export function normalQuantile(p) {
  // Acklam, précision ~1e-9
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function lgamma(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a, b, x) {
  const MAXIT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function studentCdf(t, df) {
  const x = df / (df + t * t);
  const p = 0.5 * betai(df / 2, 0.5, x);
  return t > 0 ? 1 - p : p;
}

export function studentQuantile(p, df) {
  // Bissection sur la fonction de répartition
  let lo = -200;
  let hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- Utilitaires ----------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

export function median(arr) {
  const a = Array.from(arr).sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

function sign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function tieCorrection(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let s = 0;
  for (const t of counts.values()) if (t > 1) s += t * (t - 1) * (2 * t + 5);
  return s;
}

function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function autocorr(x, lag) {
  const n = x.length;
  const m = mean(x);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) den += (x[i] - m) ** 2;
  for (let i = 0; i < n - lag; i++) num += (x[i] - m) * (x[i + lag] - m);
  return den === 0 ? 0 : num / den;
}

// ---------- Mann-Kendall ----------

export function mannKendall(y) {
  const n = y.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += sign(y[j] - y[i]);
  const varS = (n * (n - 1) * (2 * n + 5) - tieCorrection(y)) / 18;
  let Z = 0;
  if (S > 0) Z = (S - 1) / Math.sqrt(varS);
  else if (S < 0) Z = (S + 1) / Math.sqrt(varS);
  const p = 2 * (1 - normalCdf(Math.abs(Z)));
  const tau = S / (0.5 * n * (n - 1));
  return { S, varS, Z, p, tau, n };
}

// Variante de Hamed et Rao (1998) : corrige la variance quand les résidus sont autocorrélés.
export function hamedRao(y, x) {
  const n = y.length;
  const base = mannKendall(y);
  const sl = senSlope(x, y).slope;
  // indices relatifs et arrondi : évite que l'erreur d'arrondi casse les ex-aequo créés par la pente de Sen
  const detr = y.map((v, i) => Math.round((v - sl * (x[i] - x[0] + 1)) * 1e9) / 1e9);
  const rk = ranks(detr);
  const bound = normalQuantile(0.975) / Math.sqrt(n);
  let sum = 0;
  for (let k = 1; k < n; k++) {
    const r = autocorr(rk, k);
    if (Math.abs(r) > bound) sum += (n - k) * (n - k - 1) * (n - k - 2) * r;
  }
  const factor = 1 + (2 / (n * (n - 1) * (n - 2))) * sum;
  const varS = base.varS * factor;
  let Z = 0;
  if (base.S > 0) Z = (base.S - 1) / Math.sqrt(varS);
  else if (base.S < 0) Z = (base.S + 1) / Math.sqrt(varS);
  const p = 2 * (1 - normalCdf(Math.abs(Z)));
  return { Z, p, factor, varS };
}

// Test saisonnier de Hirsch : un Mann-Kendall par mois, puis somme.
export function seasonalMK(byMonth) {
  let S = 0;
  let varS = 0;
  for (const series of byMonth) {
    if (!series || series.length < 3) continue;
    const r = mannKendall(series);
    S += r.S;
    varS += r.varS;
  }
  let Z = 0;
  if (varS > 0) {
    if (S > 0) Z = (S - 1) / Math.sqrt(varS);
    else if (S < 0) Z = (S + 1) / Math.sqrt(varS);
  }
  return { S, varS, Z, p: 2 * (1 - normalCdf(Math.abs(Z))) };
}

// ---------- Pente de Theil-Sen et son intervalle de confiance ----------

export function senSlope(x, y, alpha = 0.05) {
  const n = y.length;
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
    }
  }
  slopes.sort((a, b) => a - b);
  const N = slopes.length;
  const slope = median(slopes);
  const intercept = median(y.map((v, i) => v - slope * x[i]));
  const mk = mannKendall(y);
  const z = normalQuantile(1 - alpha / 2);
  const C = z * Math.sqrt(mk.varS);
  const m1 = (N - C) / 2;
  const m2 = (N + C) / 2;
  const pick = (pos) => {
    // positions 1-indexées avec interpolation linéaire
    const p = Math.min(Math.max(pos, 1), N);
    const lo = Math.floor(p);
    const hi = Math.ceil(p);
    const a = slopes[lo - 1];
    const b = slopes[hi - 1];
    return a + (b - a) * (p - lo);
  };
  const lower = N ? pick(m1) : NaN;
  const upper = N ? pick(m2 + 1) : NaN;
  return { slope, intercept, lower, upper };
}

// ---------- Régression linéaire (moindres carrés) ----------

export function ols(x, y, alpha = 0.05) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
    syy += (y[i] - my) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const df = n - 2;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (intercept + slope * x[i])) ** 2;
  const s2 = sse / df;
  const se = Math.sqrt(s2 / sxx);
  const t = slope / se;
  const p = 2 * (1 - studentCdf(Math.abs(t), df));
  const tc = studentQuantile(1 - alpha / 2, df);
  return { slope, intercept, se, t, p, df, r2: syy === 0 ? 0 : 1 - sse / syy, lower: slope - tc * se, upper: slope + tc * se, residuals: y.map((v, i) => v - (intercept + slope * x[i])) };
}

// ---------- Séries ----------

export const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// monthly: [{year, month (1-12), value}] avec value finie ou NaN/null
export function annualAggregate(monthly, agg) {
  const byYear = new Map();
  for (const r of monthly) {
    if (!byYear.has(r.year)) byYear.set(r.year, new Array(12).fill(NaN));
    byYear.get(r.year)[r.month - 1] = r.value;
  }
  const out = [];
  for (const [year, arr] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (arr.some((v) => !isNum(v))) continue; // année incomplète : on l'écarte
    let value;
    if (agg === 'sum_rate') {
      // moyenne mensuelle en mm/jour -> cumul annuel en mm
      let s = 0;
      for (let m = 0; m < 12; m++) {
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const days = m === 1 ? (leap ? 29 : 28) : DAYS[m];
        s += arr[m] * days;
      }
      value = s;
    } else {
      value = mean(arr);
    }
    out.push({ year, value });
  }
  return out;
}

export function climatology(monthly) {
  const sums = new Array(12).fill(0);
  const cnt = new Array(12).fill(0);
  for (const r of monthly) {
    if (isNum(r.value)) {
      sums[r.month - 1] += r.value;
      cnt[r.month - 1]++;
    }
  }
  return sums.map((s, i) => (cnt[i] ? s / cnt[i] : NaN));
}

export function rolling(values, w) {
  const out = new Array(values.length).fill(NaN);
  for (let i = w - 1; i < values.length; i++) {
    let s = 0;
    let ok = true;
    for (let k = 0; k < w; k++) {
      const v = values[i - k];
      if (!isNum(v)) {
        ok = false;
        break;
      }
      s += v;
    }
    if (ok) out[i] = s / w;
  }
  return out;
}

// ---------- Analyse complète ----------

/**
 * @param {Array<{year:number,month:number,value:number}>} monthly série mensuelle brute
 * @param {{agg:'mean'|'sum_rate', alpha?:number, startYear?:number, endYear?:number}} opts
 */
export function analyze(monthly, opts) {
  const alpha = opts.alpha ?? 0.05;
  const y0 = opts.startYear ?? -Infinity;
  const y1 = opts.endYear ?? Infinity;
  const slice = monthly.filter((r) => r.year >= y0 && r.year <= y1);
  const annual = annualAggregate(slice, opts.agg);
  const n = annual.length;
  const res = { n, alpha, annual, ok: n >= 8 };
  const clim = climatology(slice);
  const monthlyOut = slice.map((r) => ({ ...r, anomaly: isNum(r.value) ? r.value - clim[r.month - 1] : NaN }));
  res.monthly = monthlyOut;
  res.climatology = clim;
  if (!res.ok) return res;

  const x = annual.map((d) => d.year);
  const y = annual.map((d) => d.value);
  const sen = senSlope(x, y, alpha);
  const mk = mannKendall(y);
  const hr = hamedRao(y, x);
  const lr = ols(x, y, alpha);
  const ac1 = autocorr(lr.residuals, 1);
  const autocorrelated = Math.abs(ac1) > 1.96 / Math.sqrt(n);
  const pUsed = autocorrelated ? hr.p : mk.p;
  const significant = pUsed < alpha;
  const direction = significant ? (sen.slope > 0 ? 'up' : 'down') : 'inconclusive';

  // Test saisonnier (séries mensuelles par mois de calendrier, années complètes uniquement)
  const years = [...new Set(slice.map((r) => r.year))].sort((a, b) => a - b);
  const byMonth = [];
  const seasonal = [];
  for (let m = 1; m <= 12; m++) {
    const pts = slice.filter((r) => r.month === m && isNum(r.value)).sort((a, b) => a.year - b.year);
    byMonth.push(pts.map((r) => r.value));
    if (pts.length >= 8) {
      const xs = pts.map((r) => r.year);
      const ys = pts.map((r) => r.value);
      const s = senSlope(xs, ys, alpha);
      const t = mannKendall(ys);
      seasonal.push({ month: m, slope: s.slope, lower: s.lower, upper: s.upper, p: t.p, significant: t.p < alpha, n: pts.length });
    } else seasonal.push({ month: m, slope: NaN, lower: NaN, upper: NaN, p: NaN, significant: false, n: pts.length });
  }
  const smk = seasonalMK(byMonth);

  res.trend = {
    direction,
    significant,
    alpha,
    method: autocorrelated ? 'hamed-rao' : 'mann-kendall',
    p: pUsed,
    slopePerYear: sen.slope,
    slopePerDecade: sen.slope * 10,
    ci: [sen.lower * 10, sen.upper * 10],
    intercept: sen.intercept,
    totalChange: sen.slope * (x[n - 1] - x[0]),
    firstYear: x[0],
    lastYear: x[n - 1],
    mean: mean(y),
    sd: Math.sqrt(y.reduce((s, v) => s + (v - mean(y)) ** 2, 0) / (n - 1)),
    mk: { S: mk.S, Z: mk.Z, p: mk.p, tau: mk.tau },
    hr: { Z: hr.Z, p: hr.p, factor: hr.factor },
    ols: { slopePerDecade: lr.slope * 10, ci: [lr.lower * 10, lr.upper * 10], p: lr.p, r2: lr.r2, intercept: lr.intercept },
    autocorr1: ac1,
    autocorrelated,
    seasonalMK: smk,
    yearsCount: years.length,
    zUsed: autocorrelated ? hr.Z : mk.Z
  };
  res.seasonal = seasonal;
  return res;
}

/** Sensibilité à la période : pente de Sen pour chaque année de départ possible. */
export function robustness(annual, minLen = 10, alpha = 0.05) {
  const out = [];
  const x = annual.map((d) => d.year);
  const y = annual.map((d) => d.value);
  for (let i = 0; i + minLen <= annual.length; i++) {
    const xs = x.slice(i);
    const ys = y.slice(i);
    const s = senSlope(xs, ys, alpha);
    // même protocole que le verdict principal : version corrigée si les résidus sont autocorrélés
    const t = mannKendall(ys);
    let pUsed = t.p;
    if (ys.length >= 8) {
      const lr = ols(xs, ys, alpha);
      const ac1 = autocorr(lr.residuals, 1);
      if (Math.abs(ac1) > 1.96 / Math.sqrt(ys.length)) pUsed = hamedRao(ys, xs).p;
    }
    out.push({ start: xs[0], slope: s.slope * 10, lower: s.lower * 10, upper: s.upper * 10, p: pUsed, significant: pUsed < alpha });
  }
  return out;
}
