// Mise en forme des nombres selon la langue.
let locale = 'fr-FR';
export function setLocale(lang) {
  locale = lang === 'en' ? 'en-GB' : 'fr-FR';
}
export function num(v, d = 2) {
  if (v == null || !Number.isFinite(v)) return '–';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace('-', '−');
}
export function signed(v, d = 2) {
  if (v == null || !Number.isFinite(v)) return '–';
  const s = num(Math.abs(v), d);
  const zero = Number(Math.abs(v).toFixed(d)) === 0;
  return (zero ? '' : v > 0 ? '+' : '−') + s;
}
export function pval(p) {
  if (p == null || !Number.isFinite(p)) return '–';
  if (p < 0.001) return locale === 'fr-FR' ? '< 0,001' : '< 0.001';
  return num(p, p < 0.01 ? 3 : 2);
}
export function coord(lat, lon, lang) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : lang === 'en' ? 'W' : 'O';
  return `${num(Math.abs(lat), 2)}° ${ns}, ${num(Math.abs(lon), 2)}° ${ew}`;
}
export function dec(v) {
  // décimales adaptées à l'ordre de grandeur
  const a = Math.abs(v);
  if (!Number.isFinite(a)) return 2;
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 0.1) return 2;
  if (a >= 0.01) return 3;
  return 4;
}
