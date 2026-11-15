import * as d3 from 'd3';
import { VARIABLES, VAR_BY_ID, PLACES, PLACE_BY_ID, STORIES, KINDS, MONTHS } from './content.js';
import { t, tl, setLang, getLang } from './i18n.js';
import { num, signed, pval, coord, dec, setLocale } from './format.js';
import { CONFIG, analyze, loadAtlas, cancelAtlas, mode as dataMode, snapToCell, stabilite } from './api.js';
import { normalQuantile } from './stats.js';
import { createGlobe, countryNameAt, countryName, capitalOf } from './globe3d.js';
import { ask as botAsk, suggestions as botChips, intro as botIntro } from './nasabot.js';
import countryList from './country-names.json';
import { serieChart, COLOR, showTip, hideTip } from './charts.js';

// ---------- Icônes (tracé maison, 24 px) ----------
const P = {
  thermo: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/><path d="M12 9v8"/>',
  sunthermo: '<path d="M11 15V6a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z"/><path d="M9 10v6"/><circle cx="17.5" cy="7" r="2"/><path d="M17.5 2.8v1M17.5 10.2v1M13.3 7h1M21.7 7h-1M14.5 4l.7.7M19.8 9.3l.7.7M20.5 4l-.7.7M15.2 9.3l-.7.7"/>',
  rain: '<path d="M7 14.5a4 4 0 0 1 .4-7.9A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1-.5 6.5"/><path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
  humidity: '<path d="M12 3.5s6 6 6 10.5a6 6 0 0 1-12 0c0-4.500 6-10.500 6-10.500z"/><path d="M9.500 14.500a2.500 2.500 0 0 0 2.500 2.500"/>',
  wind: '<path d="M3 9h10a2.500 2.500 0 1 0-2.500-2.500"/><path d="M3 13h14a2.500 2.500 0 1 1-2.500 2.500"/><path d="M3 17h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.4-8A6 6 0 0 1 18 9.500 4.300 4.300 0 0 1 17.500 18z"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M20 20l-4.200-4.200"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.500 3 3.500 15 0 18M12 3c-3.500 3-3.500 15 0 18"/>',
  map: '<path d="M3 6.500l6-2.500 6 2.500 6-2.500v13.500l-6 2.500-6-2.500-6 2.500z"/><path d="M9 4v13.500M15 6.500V20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="6.500"/><circle cx="12" cy="12" r="1.800"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M12 19V5M5.500 11.500L12 5l6.500 6.500"/>',
  down: '<path d="M12 5v14M5.500 12.500L12 19l6.500-6.500"/>',
  flat: '<path d="M4 9.500c3-2.500 5 2.500 8 0s5 2.500 8 0M4 15c3-2.500 5 2.500 8 0s5 2.500 8 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.800v.01"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2.500"/><path d="M5 15V6.500A2.500 2.500 0 0 1 7.500 4H15"/>',
  compare: '<circle cx="8.500" cy="12" r="5"/><circle cx="15.500" cy="12" r="5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.500l9 5 9-5"/>',
  play: '<path d="M8 5.500l10.500 6.500L8 18.500z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17v.01"/>',
  leaf: '<path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14z"/><path d="M5 19c3-5 6-8 10-10"/>',
  polar: '<path d="M12 3v18M4.200 7.500l15.600 9M4.200 16.500l15.600-9"/><circle cx="12" cy="12" r="2"/>',
  note: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h6M9 17h6"/>',
  tick: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  soil: '<path d="M12 13V9"/><path d="M12 10c0-2.600-1.900-4.200-4.800-4.200 0 2.600 1.900 4.200 4.800 4.200z"/><path d="M12 11c0-2.100 1.600-3.700 4.200-3.700 0 2.100-1.600 3.700-4.200 3.700z"/><path d="M4 16.500c2.700-1.300 5.300 1.300 8 0s5.300 1.300 8 0M5 20.500h14"/>',
  no2: '<circle cx="12" cy="8" r="3"/><circle cx="6" cy="16.500" r="2.600"/><circle cx="18" cy="16.500" r="2.600"/><path d="M10 10.500l-2.500 3.600M14 10.500l2.500 3.600"/>',
  stack: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.500l9 5 9-5M3 17l9 5 9-5"/>'
};
const ico = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
const STORY_ICO = { polar: 'polar', rain: 'rain', compare: 'compare', sun: 'sun', forest: 'leaf', drop: 'humidity' };

const LOGO = `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19.5" fill="none" stroke="#5FD4E6" stroke-width="1.6"/><ellipse cx="22" cy="22" rx="8.5" ry="19.5" fill="none" stroke="rgba(238,244,255,.32)" stroke-width="1.1"/><path d="M2.5 22h39" stroke="rgba(238,244,255,.32)" stroke-width="1.1"/><path d="M9 29l8-7 6 4 11-12" fill="none" stroke="#EEF4FF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34" cy="14" r="2.8" fill="#5FD4E6"/></svg>`;

// ---------- Etat ----------
const LAST = CONFIG.lastYear;
const state = {
  variable: VARIABLES[0].id,
  period: [Math.max(VARIABLES[0].minYear, CONFIG.firstYear), LAST], // toute la période disponible
  alpha: 0.05,
  A: null,
  B: null,
  picking: 'A',
  res: { A: null, B: null },
  loading: false,
  error: null,
  tab: 'serie',
  vue: 'anom', // 'brut' : données brutes ; 'anom' : sans les saisons
  focus: 'A',
  show: { trend: true, band: true, smooth: false, ols: false },
  chartMode: null,
  zoom: null,
  story: null,
  atlasOn: true,
  atlas: { done: 0, total: PLACES.length, busy: false },
  animate: true,
  base: 'relief'
};
let reqId = 0;
let jetonStabilite = 0;
let globe;
let charts = [];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => {
  let id;
  return (...a) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...a), ms);
  };
};
const V = () => VAR_BY_ID[state.variable];
const minYear = () => Math.max(V().minYear, CONFIG.firstYear);
const unitRate = (v) => (v.unit === 'mm' ? (getLang() === 'en' ? 'mm/yr' : 'mm/an') : v.unit);
const aggName = (v) => tl(v.annual);

// ---------- Lieux : noms ----------
function nameOf(loc) {
  if (!loc) return '';
  if (loc.label) return loc.label;
  if (loc.placeId && PLACE_BY_ID[loc.placeId]) return tl(PLACE_BY_ID[loc.placeId]);
  return countryNameAt(loc.lon, loc.lat, getLang()) || t('ocean');
}
const subOf = (loc) => {
  const parts = [];
  const c = countryNameAt(loc.lon, loc.lat, getLang());
  if (c && c !== nameOf(loc)) parts.push(c);
  parts.push(coord(loc.lat, loc.lon, getLang()));
  return parts.join(' · ');
};

// ---------- Scène : question, dock, période, outils ----------
function renderQuestion() {
  const v = V();
  $('#qblock').innerHTML = `<div class="eyebrow">${t('eyQuestion')}</div><h1 key="${v.id}">${tl(v.short)}</h1><p>${tl(v.name)}. ${tl(v.def)}</p><span class="unit">${v.unit === 'mm' ? unitRate(v) : v.unit}</span>`;
}

function renderDock() {
  $('#dock').innerHTML = `<i class="ind"></i>` + VARIABLES.map((v) => `<button class="dk" data-act="var" data-id="${v.id}" title="${tl(v.chip)}" style="--c:#B4C0FF" aria-pressed="false">${ico(v.icon)}<span>${tl(v.chip)}</span></button>`).join('');
  syncDock();
}
let dockRO = null;
function syncDock() {
  const dock = $('#dock');
  const ind = dock.querySelector('.ind');
  let on = null;
  $$('.dk', dock).forEach((b) => {
    const is = b.dataset.id === state.variable;
    b.classList.toggle('on', is);
    b.setAttribute('aria-pressed', is);
    if (is) on = b;
  });
  if (on && ind) {
    // l'étiquette s'ouvre en animation : on suit sa taille réelle jusqu'à la fin
    if (dockRO) dockRO.disconnect();
    const place = () => {
      ind.style.width = on.offsetWidth + 'px';
      ind.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    place();
    dockRO = new ResizeObserver(place);
    dockRO.observe(on);
    dock.querySelectorAll('.dk').forEach((b) => dockRO.observe(b));
    setTimeout(() => dock.scrollTo({ left: on.offsetLeft - (dock.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' }), 500);
  }
}

// Barre de période retirée : l'interface se concentre sur les scénarios.
// La période et le niveau de confiance restent dans `state` (défaut 30 ans, 95 %) pour que le calcul statistique
// de ton code puisse les piloter : voir state.period et state.alpha.
function renderPeriod() {
  const el = $('#period');
  if (el) el.innerHTML = '';
}

function syncRange() {
  const lo = minYear();
  const hi = LAST;
  const [a, b] = state.period;
  const r0 = $('#r0');
  const r1 = $('#r1');
  if (!r0) return;
  for (const r of [r0, r1]) {
    r.min = lo;
    r.max = hi;
  }
  r0.value = a;
  r1.value = b;
  const pa = ((a - lo) / (hi - lo)) * 100;
  const pb = ((b - lo) / (hi - lo)) * 100;
  $('#fill').style.left = pa + '%';
  $('#fill').style.width = pb - pa + '%';
  $('#yr').innerHTML = `${a}<i>–</i>${b}`;
  $('#len').textContent = `${b - a + 1} ${t('years')}`;
  const presets = [[30, `30 ${t('years')}`], [20, `20 ${t('years')}`], [10, `10 ${t('years')}`], [0, t('presetAll')]];
  $('#presets').innerHTML =
    presets
      .map(([n, label]) => {
        const pa2 = n ? Math.max(lo, hi - n + 1) : lo;
        return `<button class="chip ${a === pa2 && b === hi ? 'on' : ''}" data-act="preset" data-n="${n}">${label}</button>`;
      })
      .join('') +
    `<div class="confrow"><span class="conf">${t('confidence')}</span><button class="chip ${state.alpha === 0.05 ? 'on' : ''}" data-act="alpha" data-a="0.05">95 %</button><button class="chip ${state.alpha === 0.01 ? 'on' : ''}" data-act="alpha" data-a="0.01">99 %</button></div>`;
}

function renderTools() {
  const base = state.base;
  $('#tools').innerHTML = `
    <button class="tool" data-act="zin" aria-label="${t('zoomIn')}">${ico('plus')}</button>
    <button class="tool" data-act="zout" aria-label="${t('zoomOut')}">${ico('minus')}</button>
    <div class="tool-sep"></div>
    <button class="tool" data-act="zreset" aria-label="${t('reset')}">${ico('target')}</button>
    <div style="position:relative"><button class="tool" data-act="menu" aria-label="${t('baseLayer')}">${ico('stack')}</button>
      <div class="menu" id="menu"><div class="eyebrow">${t('baseLayer')}</div>
        ${[['relief', 'baseRelief'], ['blue', 'baseBlue'], ['live', 'baseLive']].map(([id, k]) => `<button data-act="base" data-id="${id}" class="${base === id ? 'on' : ''}">${t(k)}${ico('tick', 'tick')}</button>`).join('')}</div></div>`;
}

function renderHint() {
  const h = $('#hint');
  const waitingB = state.picking === 'B';
  h.className = 'hint' + (waitingB ? ' teal' : '') + (state.A && !waitingB ? ' off' : '');
  h.innerHTML = `<span class="dot"></span>${waitingB ? t('compareHint') : state.A ? t('hintDrag') : t('hintPick')}`;
}

function triSvg(dir, color) {
  const c = dir === 'inconclusive' ? 'rgba(154,167,189,.95)' : color;
  const glyph = dir === 'up' ? `<path d="M14 9.600l4 6.400h-8z" fill="${c}"/>` : dir === 'down' ? `<path d="M14 17.400l4-6.400h-8z" fill="${c}"/>` : `<rect x="10.600" y="12.400" width="6.800" height="2.200" rx="1.100" fill="#5D6B85"/>`;
  return `<svg viewBox="0 0 28 36"><path d="M14 35S3 22.500 3 13.500a11 11 0 0 1 22 0C25 22.500 14 35 14 35z" fill="${c}" stroke="rgba(255,255,255,.9)" stroke-width="1.700"/><circle cx="14" cy="13.500" r="6.200" fill="rgba(255,255,255,.96)"/>${glyph}</svg>`;
}

function renderLegend() {
  const v = V();
  const a = state.atlas;
  $('#legend').innerHTML = `
    <div class="lh"><span class="eyebrow">${t('atlas')}</span><button class="switch ${state.atlasOn ? 'on' : ''}" data-act="atlas" aria-label="${t('atlasOn')}" aria-pressed="${state.atlasOn}"></button></div>
    ${state.atlasOn ? `
    <div class="row">${triSvg('up', v.up)}<span>${t('legendUp')}</span></div>
    <div class="row">${triSvg('down', v.down)}<span>${t('legendDown')}</span></div>
    <div class="row">${triSvg('inconclusive')}<span>${t('legendNone')}</span></div>
    ${a.busy ? `<div class="prog"><i style="width:${Math.round((a.done / Math.max(1, a.total)) * 100)}%"></i></div><small>${t('atlasLoading')} ${a.done}/${a.total}</small>` : `<small>${t('legendHint')}</small>`}` : ''}`;
}

function renderStageUI() {
  renderQuestion();
  renderDock();
  renderPeriod();
  renderTools();
  renderHint();
  renderLegend();
}

// ---------- Recherche ----------
const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function searchIndex() {
  const lang = getLang();
  const out = PLACES.map((p) => ({ type: 'place', id: p.id, title: tl(p), sub: tl(KINDS[p.kind]), lat: p.lat, lon: p.lon, key: norm(p.fr + ' ' + p.en) }));
  void lang; // recherche limitée aux régions du catalogue : les données existent par région
  return out;
}
let acIndex = -1;
function fillDrop(text) {
  const drop = $('#drop');
  const s = norm(text.trim());
  let list = searchIndex();
  list = s ? list.filter((x) => x.key.includes(s)).sort((a, b) => (a.key.startsWith(s) ? 0 : 1) - (b.key.startsWith(s) ? 0 : 1)) : list.filter((x) => x.type === 'place');
  list = list.slice(0, 8);
  acIndex = -1;
  drop.innerHTML = list.length
    ? list.map((x, i) => `<button data-act="result" data-i="${i}"><span class="ti">${esc(x.title)}<small>${esc(x.sub)}</small></span><span class="kind">${x.type === 'place' ? t('placeRef') : t('country')}</span></button>`).join('')
    : `<div class="none">${t('noPlace')}</div>`;
  drop._list = list;
  drop.classList.add('on');
}
function chooseResult(x) {
  const slot = state.picking === 'B' ? 'B' : 'A';
  setLoc(slot, x.lat, x.lon, x.type === 'place' ? x.id : null, x.type === 'country' ? x.cap.n : null);
  if (slot === 'B') {
    state.picking = 'A';
    state.chartMode = 'anom';
  }
  $('#q').value = '';
  $('#q').blur();
  $('#drop').classList.remove('on');
  globe.flyTo(x.lat, x.lon);
  afterSelection();
}

// ---------- Survol ----------
const hoverEl = () => $('#hovercard');
function placeCard(x, y, w, h) {
  const stage = $('#stage').getBoundingClientRect();
  let left = x + 18;
  let top = y + 18;
  if (left + w > stage.width - 80) left = x - w - 18;
  if (top + h > stage.height - 90) top = y - h - 18;
  const hc = hoverEl();
  hc.style.left = Math.max(8, left) + 'px';
  hc.style.top = Math.max(8, top) + 'px';
}
function setReadout(info) {
  const r = $('#readout');
  if (!r) return;
  if (!info) { r.classList.remove('on'); return; }
  const f = (v, p, n) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? p : n}`;
  r.innerHTML = `<span>LAT</span><b>${f(info.lat, 'N', 'S')}</b><span>LON</span><b>${f(info.lon, 'E', 'O')}</b>`;
  r.classList.add('on');
}
function renderCredit() {
  const fr = getLang() === 'fr';
  // en mode simulé, rien en bas à gauche (le bandeau du haut prévient déjà)
  $('#credit').innerHTML = CONFIG.mock
    ? ''
    : `<span class="live"></span><div><b>${esc(V().contrat.source)}</b><small>${fr ? 'données NASA · cache local' : 'NASA data · local cache'}</small></div>`;
}
function onHover(info) {
  setReadout(info);
  const hc = hoverEl();
  if (!info) {
    if (!hc.dataset.marker) hc.classList.remove('on');
    return;
  }
  hc.dataset.marker = '';
  const lang = getLang();
  const c = info.countryId ? countryName(info.countryId, lang) : null;
  const cap = info.capital;
  hc.innerHTML = `<h4>${esc(c || t('ocean'))}</h4>
    ${cap ? `<div class="sub">${t('capital')} · ${esc(cap.n)}</div>` : `<div class="sub">${coord(info.lat, info.lon, lang)}</div>`}
    <div class="rows">
      ${cap ? `<div class="r"><span>${esc(cap.n)}</span><b>${coord(cap.lat, cap.lon, lang)}</b></div>` : ''}
      <div class="r"><span>${t('exactPos')}</span><b>${coord(info.lat, info.lon, lang)}</b></div>
    </div><div class="go">${t('hoverClick')}</div>`;
  placeCard(info.x, info.y, hc.offsetWidth || 220, hc.offsetHeight || 120);
  hc.classList.add('on');
}
function onMarkerHover(it, x, y) {
  const hc = hoverEl();
  if (!it) {
    hc.dataset.marker = '';
    hc.classList.remove('on');
    return;
  }
  const v = V();
  const pl = PLACE_BY_ID[it.id];
  const col = it.direction === 'up' ? v.up : it.direction === 'down' ? v.down : 'var(--faint)';
  const lab = it.direction === 'inconclusive' ? t('verdictNone') : `${signed(it.slopePerDecade, dec(it.slopePerDecade))} ${unitRate(v)} ${t('perDecade')}`;
  hc.dataset.marker = '1';
  hc.innerHTML = `<h4>${esc(pl ? tl(pl) : '')}</h4><div class="sub">${pl ? tl(KINDS[pl.kind]) : ''}</div><div class="tr" style="color:${col}">${it.direction === 'inconclusive' ? '' : ico(it.direction)}<span>${lab}</span></div><div class="go">${t('hoverClick')}</div>`;
  placeCard(x - 20, y - 70, hc.offsetWidth || 220, hc.offsetHeight || 100);
  hc.classList.add('on');
}

// ---------- Lieux ----------
function setLoc(k, lat, lon, placeId = null, label = null) {
  const cell = snapToCell(lat, lon);
  state[k] = { lat: cell.lat, lon: cell.lon, rawLat: lat, rawLon: lon, placeId, label };
  if (k === 'A') state.focus = 'A';
}

// Les données du contrat existent par région : un clic libre choisit la région du catalogue la plus proche.
function regionProche(lat, lon) {
  const rad = Math.PI / 180;
  let best = null;
  let dmin = Infinity;
  for (const p of PLACES) {
    const c = Math.sin(lat * rad) * Math.sin(p.lat * rad) + Math.cos(lat * rad) * Math.cos(p.lat * rad) * Math.cos((lon - p.lon) * rad);
    const d = 6371 * Math.acos(Math.max(-1, Math.min(1, c)));
    if (d < dmin) {
      dmin = d;
      best = p;
    }
  }
  return dmin <= 1500 ? best : null;
}

function onPick(clic) {
  hoverEl().classList.remove('on');
  const region = (clic.placeId && PLACE_BY_ID[clic.placeId]) || regionProche(clic.lat, clic.lon);
  if (!region) return toast(t('pickRegion'));
  const { lat, lon } = region;
  const placeId = region.id;
  const k = state.picking;
  const label = null;
  if (k === 'B') {
    setLoc('B', lat, lon, placeId, label);
    state.picking = 'A';
    state.chartMode = 'anom';
  } else {
    setLoc('A', lat, lon, placeId, label);
    globe.flyTo(lat, lon, { duration: 1100 });
    state.story = state.story && state.story.keep ? state.story : null;
  }
  state.zoom = null;
  afterSelection();
}

function afterSelection() {
  updatePins();
  renderHint();
  hardRefresh();
  writeHash();
}
function updatePins() {
  globe.setPins({ A: state.A, B: state.B });
}

// ---------- Analyse ----------
// Codes d'erreur du serveur (app/api.py) vers les messages affichés.
const ERREURS = { network: 'errText', http: 'errText', periode_trop_courte: 'tooShort', noregion: 'pickRegion', pas_en_cache: 'missingVar', inconnu: 'missingVar' };
async function runAnalysis() {
  const id = ++reqId;
  const keys = ['A', 'B'].filter((k) => state[k]);
  const [p0, p1] = state.period;
  const out = {};
  await Promise.all(
    keys.map(async (k) => {
      try {
        out[k] = await analyze({ lat: state[k].lat, lon: state[k].lon, variable: state.variable, start: p0, end: p1, alpha: state.alpha, placeId: state[k].placeId });
      } catch (e) {
        out[k] = { error: t(ERREURS[e.kind] || 'missingVar'), fatal: true, kind: e.kind };
      }
    })
  );
  if (id !== reqId) return null;
  state.res = { A: out.A || null, B: out.B || null };
  return out;
}

async function hardRefresh() {
  if (!state.A) {
    state.res = { A: null, B: null };
    state.loading = false;
    renderResults();
    return;
  }
  state.loading = true;
  state.error = null;
  state.animate = true;
  renderResults();
  const out = await runAnalysis();
  if (!out) return;
  state.loading = false;
  const failed = Object.values(out).every((r) => r.fatal);
  state.error = failed ? Object.values(out)[0].error : null;
  renderResults();
}

const softRefresh = debounce(async () => {
  if (!state.A) {
    reloadAtlas(false);
    return;
  }
  state.animate = false;
  const out = await runAnalysis();
  if (!out) return;
  renderResults();
  writeHash();
  reloadAtlas(false);
}, 90);

// ---------- Atlas ----------
async function reloadAtlas(clear) {
  cancelAtlas();
  if (clear) globe.clearAtlas();
  if (!state.atlasOn) {
    state.atlas.busy = false;
    renderLegend();
    return;
  }
  const v = V();
  globe.setPalette({ up: v.up, down: v.down });
  state.atlas = { done: 0, total: PLACES.length, busy: true };
  renderLegend();
  const myVar = state.variable;
  let n = 0;
  await loadAtlas({ variable: myVar, start: state.period[0], end: state.period[1], alpha: state.alpha }, (item) => {
    if (myVar !== state.variable) return;
    globe.addAtlasItem(item);
    n++;
    state.atlas.done = n;
    if (n % 3 === 0 || n === state.atlas.total) renderLegend();
  });
  if (myVar === state.variable) {
    state.atlas.busy = false;
    renderLegend();
  }
}

function applyPalette() {
  const v = V();
  document.documentElement.style.setProperty('--up', v.up);
  document.documentElement.style.setProperty('--down', v.down);
  globe && globe.setPalette({ up: v.up, down: v.down });
}

// ---------- Résultats ----------
function destroyCharts() {
  charts.forEach((c) => c.destroy && c.destroy());
  charts = [];
  hideTip();
}

function emptyHTML() {
  return `<div class="empty rise">
    <svg class="art" viewBox="0 0 300 150" aria-hidden="true"><defs><linearGradient id="ea" x1="0" x2="1"><stop offset="0" stop-color="#8DA2FF" stop-opacity="0"/><stop offset=".5" stop-color="#8DA2FF"/><stop offset="1" stop-color="#3FD2C7"/></linearGradient></defs>
      <g stroke="rgba(255,255,255,.07)"><path d="M0 30h300M0 75h300M0 120h300"/></g>
      <path d="M6 112C40 108 54 86 84 92s46 24 80-6 56-38 90-52 40-4 44-4" fill="none" stroke="url(#ea)" stroke-width="2.600" stroke-linecap="round"/>
      <circle cx="294" cy="30" r="5" fill="#3FD2C7"/><circle cx="294" cy="30" r="12" fill="none" stroke="#3FD2C7" stroke-opacity=".4"/></svg>
    <div class="eyebrow">${t('eyCase')}</div>
    <h2>${t('emptyTitle')}</h2>
    <p>${t('emptyText')}</p>
    <div class="eyebrow try">${t('emptyTry')}</div>
    <div class="cases-l">${STORIES.map((s) => `<button class="case-row" data-act="story" data-id="${s.id}"><span class="ico">${ico(STORY_ICO[s.emoji] || 'play')}</span><span><b>${tl(s.title)}</b><small>${tl(VAR_BY_ID[s.variable].name)} · ${s.period[0]}–${Math.min(s.period[1], LAST)}</small></span>${ico('arrow', 'arr')}</button>`).join('')}</div>
  </div>`;
}

function skeletonHTML() {
  return `<div class="loading-note rise"><div class="spin"></div><div><b>${t('loadingTitle')}</b><p style="color:var(--mute);font-size:12.5px">${t('loadingText')}</p></div></div>
  <div class="skel" style="height:230px"></div><div class="skel" style="height:44px"></div><div class="skel" style="height:300px"></div>`;
}

function storyBannerHTML() {
  const s = state.story;
  if (!s) return '';
  const lecon = tl(s.lesson) ? `<p class="les"><b>${t('storyLesson')}.</b> ${esc(tl(s.lesson))}</p>` : '';
  const nav = `<div class="snav"><button data-act="storynav" data-d="-1" ${s.etape === 0 ? 'disabled' : ''}>${ico('arrow', 'rev')} ${t('storyPrev')}</button><span>${s.etape + 1} / ${s.nEtapes}</span><button data-act="storynav" data-d="1" ${s.etape === s.nEtapes - 1 ? 'disabled' : ''}>${t('storyNext')} ${ico('arrow')}</button></div>`;
  return `<div class="story rise"><div style="flex:1"><div class="eyebrow" style="margin-bottom:8px">${t('storyBanner')}</div><h3>${esc(tl(s.title))}</h3><p>${esc(tl(s.hook))}</p>${lecon}${nav}</div><button class="x" data-act="storyclose" aria-label="${t('storyClose')}">${ico('close')}</button></div>`;
}

function ppText(p) {
  const nice = p < 0.001 ? 0.1 : p < 0.01 ? 1 : p < 0.05 ? 5 : 10;
  return `${t('ppPrefix')} ${num(nice, nice < 1 ? 1 : 0)} %`;
}

function verdictHTML(k, two) {
  const loc = state[k];
  const r = state.res[k];
  if (!loc || !r) return '';
  const v = V();
  const head = `<div class="vh">${two ? `<span class="L ${k}">${k}</span>` : ''}<b>${esc(nameOf(loc))}</b><small>${coord(loc.lat, loc.lon, getLang())}</small></div>`;
  if (r.error) return `<article class="verdict">${head}<p class="vt" style="display:block">${esc(r.error)}</p></article>`;
  if (!r.ok) return `<article class="verdict">${head}<p class="vt" style="display:block">${t('tooShort')}</p></article>`;
  const tr = r.trend;
  const dir = tr.direction;
  const unit = unitRate(v);
  const d = dec(tr.slopePerDecade);
  const label = dir === 'up' ? t('verdictUp') : dir === 'down' ? t('verdictDown') : t('verdictNone');
  const icon = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'flat';
  const z = Math.abs(tr.zUsed || 0);
  const zc = normalQuantile(1 - state.alpha / 2);
  const zmax = Math.max(4, z + 0.5);
  const text =
    dir === 'inconclusive'
      ? t('explainNone', { slope: signed(tr.slopePerDecade, d), unit })
      : t('explainTrend', { y0: tr.firstYear, y1: tr.lastYear, dir, total: num(Math.abs(tr.totalChange), dec(tr.totalChange)), unit, pp: ppText(tr.p) });
  const ciTxt = tr.ci ? (getLang() === 'fr' ? `<b>${signed(tr.ci[0], d)}</b> à <b>${signed(tr.ci[1], d)}</b>` : `<b>${signed(tr.ci[0], d)}</b> to <b>${signed(tr.ci[1], d)}</b>`) : '–';
  const big = Math.abs(tr.slopePerDecade);
  const vr = VAR_BY_ID[r.contrat.variable.id];
  const phrase = tr.significant && vr ? tl(dir === 'up' ? vr.upMeans : vr.downMeans) : '';
  const clair = phrase ? `<p class="vt"><b>${t('enClair')}</b> ${esc(phrase)}.</p>` : '';
  const courte = r.contrat.periode_courte ? `<p class="tag warn" style="display:block;margin-top:12px;white-space:normal;line-height:1.5">${t('shortPeriod')}</p>` : '';
  return `<article class="verdict ${dir} rise" style="animation-delay:${k === 'B' ? 90 : 0}ms">
    ${head}
    <span class="vlabel">${ico(icon)}${label}</span>
    <div class="vbig"><b data-count="${tr.slopePerDecade}" data-dec="${d}">${signed(tr.slopePerDecade, d)}</b><em>${unit} ${t('perDecade')}</em></div>
    <div class="vci"><span>${t('ciLong', Math.round((1 - state.alpha) * 100))} :</span>${ciTxt}<button class="info" data-tip="tipCI" aria-label="info">${ico('info')}</button></div>
    ${tr.zUsed == null ? '' : `    <div class="meter"><div class="bar"><i data-w="${Math.min(100, (z / zmax) * 100)}"></i><u style="left:${(zc / zmax) * 100}%"></u></div>
      <div class="lab"><span>${t('noise')}</span><span class="num">${t('threshold')} ${num(zc, 2)}</span><span>${t('signal')} ${num(z, 1)} <button class="info" data-tip="tipSigma" aria-label="info" style="vertical-align:-3px">${ico('info')}</button></span></div></div>`}
    <p class="vt">${text}</p>${clair}${courte}
    <div class="vf">
      <span class="tag num">${tr.p < 0.001 ? 'p < ' + pval(0.001) : 'p = ' + pval(tr.p)} <button class="info" data-tip="tipPH" aria-label="info" style="width:15px;height:15px">${ico('info')}</button></span>
      <span class="tag">${t('coverage', r.n, state.period[1] - state.period[0] + 1)}</span>
      ${tr.autocorrelated ? `<span class="tag warn">${t('corrected')}</span>` : ''}
    </div></article>`;
  void big;
}

function bannerHTML() {
  const a = state.res.A;
  const b = state.res.B;
  if (!(state.A && state.B && a && b && a.ok && b.ok)) return '';
  const sa = a.trend.significant;
  const sb = b.trend.significant;
  let cls;
  let title;
  let text;
  if (sa && sb && a.trend.direction !== b.trend.direction) [cls, title, text] = ['opp', t('banOpposite'), t('banOppositeText')];
  else if (sa && sb) [cls, title, text] = ['same', t('banSame'), t('banSameText')];
  else if (sa || sb) [cls, title, text] = ['mixed', t('banMixed'), t('banMixedText')];
  else [cls, title, text] = ['none', t('banNone'), t('banNoneText')];
  return `<div class="banner ${cls} rise">${ico('compare')}<div><b>${title}</b><p>${text}</p></div></div>`;
}

const TABS = [
  ['serie', 'tabSerie'],
  ['dossier', 'tabDossier']
];

function renderResults() {
  destroyCharts();
  const R = $('#results');
  if (!state.A) {
    R.innerHTML = emptyHTML();
    return;
  }
  if (state.loading) {
    R.innerHTML = skeletonHTML();
    return;
  }
  if (state.error) {
    R.innerHTML = `<div class="errbox rise"><h3>${t('errTitle')}</h3><p>${esc(state.error)}</p><button class="pillbtn primary" data-act="retry">${t('retry')}</button></div>`;
    return;
  }
  const v = V();
  const two = !!(state.A && state.B);
  const ok = ['A', 'B'].filter((k) => state[k] && state.res[k] && state.res[k].ok);
  if (!ok.includes(state.focus)) state.focus = ok[0] || 'A';
  const chip = (k) => (state[k] ? `<span class="loc-chip ${k}"><span class="L ${state.A && state.B ? '' : 'solo'}">${state.A && state.B ? k : ''}</span><span class="n">${esc(nameOf(state[k]))}</span><button class="x" data-act="clear" data-k="${k}" aria-label="${t('remove')}">${ico('close')}</button></span>` : '');
  const second = state.B ? chip('B') : state.picking === 'B' ? `<span class="loc-chip B wait"><span class="L">B</span><span class="n">${t('compareHint')}</span></span>` : `<button class="addcmp" data-act="compare">${ico('plus')}${t('compareShort')}</button>`;
  R.innerHTML = `
    <div class="res-top">${chip('A')}${second}</div>
    <div class="res-var rise"><span><b>${tl(v.name)}</b> · ${aggName(v)}</span></div>
    ${periodeHTML()}
    ${storyBannerHTML()}
    ${bannerHTML()}
    <div class="verdicts ${two ? 'two' : ''}">${verdictHTML('A', two)}${two ? verdictHTML('B', two) : ''}</div>
    <div class="tabs rise" role="tablist"><i class="ind"></i>${TABS.map(([id, key]) => `<button class="tab ${state.tab === id ? 'on' : ''}" role="tab" data-act="tab" data-id="${id}">${t(key)}</button>`).join('')}</div>
    <div class="panel rise" id="panel"></div>
    <footer class="prov rise"><span class="live ${CONFIG.mock ? 'sim' : ''}"></span><p>${CONFIG.mock ? t('provMock') : `<b>${esc(v.contrat.source)}</b> · ${esc(v.contrat.giovanni_id)}. ${t('provMethod')}`}</p></footer>`;
  requestAnimationFrame(() => {
    $$('.meter .bar i').forEach((i) => (i.style.width = i.dataset.w + '%'));
    countUp();
    moveInd(false);
  });
  renderTab();
}

function countUp() {
  $$('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    const d = +el.dataset.dec;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1100);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = signed(target * e, d);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function moveInd(animate = true) {
  const tabs = $('.tabs');
  if (!tabs) return;
  const ind = tabs.querySelector('.ind');
  const on = tabs.querySelector('.tab.on');
  if (!on) return;
  if (!animate) ind.style.transition = 'none';
  ind.style.width = on.offsetWidth + 'px';
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!animate) requestAnimationFrame(() => (ind.style.transition = ''));
}

function focusSwitch() {
  if (!(state.A && state.B)) return '';
  return `<div class="seg focus-seg"><button data-act="focus" data-k="A" class="${state.focus === 'A' ? 'on' : ''}">A · ${esc(nameOf(state.A))}</button><button data-act="focus" data-k="B" class="${state.focus === 'B' ? 'on' : ''}">B · ${esc(nameOf(state.B))}</button></div>`;
}

function chartLabels() {
  return {
    vsMean: t('vsMean'),
    rank: t('rank'),
    anomaly: t('anomaly'),
    value: t('value'),
    smooth: t('smooth'),
    ci: t('ci'),
    verdict: '',
    sig: t('sig'),
    notSig: t('notSig'),
    slope: t('slope'),
    from: t('from'),
    chosen: t('chosen')
  };
}

function renderTab() {
  const panel = $('#panel');
  if (!panel) return;
  destroyCharts();
  const v = V();
  const how = (key) => `<p class="how">${ico('info')}<span>${t(key)}</span></p>`;
  const okKeys = ['A', 'B'].filter((k) => state[k] && state.res[k] && state.res[k].ok);
  if (!okKeys.length) {
    panel.innerHTML = `<p class="how">${t('tooShort')}</p>`;
    return;
  }
  const fk = okKeys.includes(state.focus) ? state.focus : okKeys[0];
  const rf = state.res[fk];
  const monthlyUnit = v.unitMonthly || v.unit;
  const mdec = v.decimals === 0 ? 2 : v.decimals;
  const slopeDec = dec(Math.max(...okKeys.map((k) => Math.abs(state.res[k].trend.slopePerDecade))));

  if (state.tab === 'serie') {
    // Série mensuelle : données brutes ou sans les saisons, droite de tendance du moteur en option.
    const vue = state.vue;
    const deux = okKeys.length > 1;
    const bouton = (v, label) => `<button data-act="vue" data-v="${v}" class="${vue === v ? 'on' : ''}">${label}</button>`;
    panel.innerHTML = `<div class="toolbar"><div class="seg">${bouton('brut', t('vueBrut'))}${bouton('anom', t('vueSans'))}</div><span class="sp"></span>
      <button class="tgl ${state.show.trend ? 'on' : ''}" data-act="tgl" data-id="trend"><i></i>${t('montrerPente')}</button></div>
      <div class="chart" id="c1"></div>${how(vue === 'anom' ? 'howSans' : 'howBrut')}`;
    const tons = { up: v.up, down: v.down, inconclusive: '#9AA7BD' };
    const series = okKeys.map((k) => {
      const res = state.res[k];
      const d2 = dec(res.trend.slopePerDecade);
      return {
        key: k,
        name: nameOf(state[k]),
        color: deux ? (k === 'A' ? COLOR.A : COLOR.B) : 'rgba(175,192,218,.85)',
        trendColor: deux ? (k === 'A' ? COLOR.A : COLOR.B) : tons[res.trend.direction],
        points: res.points,
        droite: res.droite,
        niveau: res.niveau,
        penteTxt: `${signed(res.trend.slopePerDecade, d2)} ${unitRate(v)} ${t('perDecade')}`
      };
    });
    const nomVar = tl(v.name);
    const lieu = deux ? series.map((s) => s.name).join(' / ') : series[0].name;
    charts.push(
      serieChart($('#c1'), series, {
        vue,
        pente: state.show.trend,
        decimals: vue === 'anom' ? 1 : v.decimals === 0 ? 0 : 1,
        titre: `${nomVar} · ${lieu} · ${vue === 'anom' ? t('vueSans').toLowerCase() : t('vueBrut').toLowerCase()}`,
        axeY: vue === 'anom' ? t('axeEcart', unitRate(v)) : `${nomVar} (${unitRate(v)})`,
        legValeur: vue === 'anom' ? t('legEcart') : t('legValeur'),
        legTendance: (s) => (deux ? `${s.name} : ${s.penteTxt}` : t('legTendance', s.penteTxt)),
        source: `${t('sourceLabel')} : ${v.contrat.source} · ${v.contrat.giovanni_id}`,
        mois: MONTHS[getLang()]
      })
    );
  } else {
    panel.innerHTML = dossierHTML(fk, slopeDec);
  }
  void slopeDec;
}

// ---------- Textes du moteur en anglais ----------
// trend.stats écrit le résumé et le tableau des tests en français. En anglais, on reconstruit le résumé
// avec les seules valeurs du ResultatTendance, et on traduit les libellés connus du tableau.
function resumeOf(c) {
  if (getLang() === 'fr') return c.resume;
  const v = VAR_BY_ID[c.variable.id];
  const place = PLACE_BY_ID[c.region.id];
  const nom = place ? place.en : c.region.nom;
  const unite = v ? v.unit : c.variable.unite;
  const pente = `${c.pente_decennie >= 0 ? '+' : '−'}${Number(Math.abs(c.pente_decennie).toPrecision(2))}`;
  const p = c.p_value < 0.001 ? 'p < 0.001' : `p = ${c.p_value.toFixed(3)}`;
  const periode = `${c.debut.slice(0, 4)} → ${c.fin.slice(0, 4)}`;
  const sens = c.sens === 'hausse';
  let s = c.significatif
    ? `${nom}, ${periode}: significant ${sens ? 'increase' : 'decrease'} (at the 5% level, ${p}) of about ${pente} ${unite} per decade.` +
      (v ? ` In plain words: ${tl(sens ? v.upMeans : v.downMeans)}.` : '')
    : `${nom}, ${periode}: no significant trend over this period (${p}). The estimated slope (${pente} ${unite} per decade) stays within natural year-to-year variability.`;
  if (c.periode_courte) s += ' Fewer than 30 years of data: this is a recent trend, not yet climate.';
  return s;
}
const TESTS_EN = {
  Valeur: 'Value',
  Significatif: 'Significant',
  'Détail': 'Detail',
  'Mann-Kendall (moyennes annuelles)': 'Mann-Kendall (annual means)',
  'Pente de Sen (par décennie)': "Sen's slope (per decade)",
  'Mann-Kendall corrigé (Hamed et Rao)': 'Mann-Kendall, corrected (Hamed and Rao)',
  'Mann-Kendall saisonnier (mensuel)': 'Seasonal Mann-Kendall (monthly)',
  'Régression linéaire (contrôle)': 'Linear regression (check)'
};
const DETAILS_EN = [
  ['IC 95 % :', '95% CI:'],
  [' à ', ' to '],
  ['/décennie', ' per decade'],
  [' ans. Test principal.', ' years. Main test.'],
  ['Chaque mois calendaire testé séparément, puis combiné (Hirsch et Slack).', 'Each calendar month tested separately, then combined (Hirsch and Slack).'],
  ["Variance corrigée de l'autocorrélation des années.", 'Variance corrected for year-to-year autocorrelation.'],
  ['Pente OLS par décennie', 'OLS slope per decade'],
  ['Sensible aux valeurs extrêmes.', 'Sensitive to extreme values.'],
  ['Non calculable :', 'Not computable:']
];
const libelleTest = (x) => (getLang() === 'en' ? TESTS_EN[x] || x : x);
function detailTest(x, c) {
  if (getLang() === 'fr') return x;
  const v = VAR_BY_ID[c.variable.id];
  let s = v ? x.split(c.variable.unite).join(v.unit) : x;
  for (const [a, b] of DETAILS_EN) s = s.split(a).join(b);
  return s;
}

function dossierHTML(k, sd) {
  const v = V();
  const r = state.res[k];
  const tr = r.trend;
  const c = r.contrat; // ResultatTendance du contrat
  const reg = c.region;
  const zone = c.origine === 'point' ? t('origPoint') : t('origZone', reg.bbox.map((x) => num(x, 1)).join(' ; '));
  const idRows = [
    [t('idRegion'), `${esc(PLACE_BY_ID[reg.id] ? tl(PLACE_BY_ID[reg.id]) : reg.nom)} · ${esc(tl(KINDS[reg.type]) || reg.type)}`],
    [t('idData'), esc(zone)],
    ['Source', `${esc(c.variable.source)} · ${esc(c.variable.giovanni_id)}`],
    [t('idPeriod'), `${c.debut} → ${c.fin}`],
    [t('idYears'), `${num(c.n_annees, 1)} ${t('years')}`],
    [t('idMethod'), t('testMK')]
  ];
  const synthese = [
    [t('rowSen'), `${signed(tr.slopePerDecade, sd)} ${unitRate(v)} ${t('perDecade')} [${tr.ci ? signed(tr.ci[0], sd) : '–'} ; ${tr.ci ? signed(tr.ci[1], sd) : '–'}]`],
    [t('rowMK'), `p = ${pval(tr.p)} · ${tr.significant ? t('sig') : t('notSig')}`],
    [t('totalLabel'), `${signed(tr.totalChange, dec(tr.totalChange))} ${unitRate(v)}`]
  ];
  // Tableau `tests` du contrat, affiché tel quel (colonnes Test, Valeur, p-value, Significatif, Détail).
  const cellule = (col, val) => {
    if (val == null) return '–';
    if (typeof val === 'boolean') return val ? t('sig') : t('notSig');
    if (typeof val === 'number') return col === 'p-value' ? pval(val) : num(val, Math.abs(val) >= 100 ? 0 : 3);
    if (col === 'Détail') return esc(detailTest(String(val), c));
    return esc(libelleTest(val));
  };
  const colonnes = c.tests.length ? Object.keys(c.tests[0]) : [];
  const tests = colonnes.length
    ? `<table class="tests"><thead><tr>${colonnes.map((h) => `<th>${esc(libelleTest(h))}</th>`).join('')}</tr></thead><tbody>${c.tests.map((row) => `<tr>${colonnes.map((h) => `<td>${cellule(h, row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '';
  return `<div class="doc">${focusSwitch()}
    <div><h3>${t('idTitle')}</h3><table class="tests idc"><tbody>${idRows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('')}</tbody></table></div>
    <div><h3>${t('dossierDef')}</h3><p><b>${esc(tl(v.name))}.</b> ${esc(tl(v.def))}</p></div>
    <div><h3>${t('dossierSummary')}</h3><p>${esc(resumeOf(c))}</p></div>
    <div><h3>${t('dossierMethod')}</h3><ol><li>${t('method1')}</li><li>${t('method2')}</li><li>${t('method3')}</li><li>${t('method4', 95)}</li><li>${t('method5')}</li><li>${t('method6')}</li></ol></div>
    <div><h3>${t('dossierTests')}</h3><table class="tests"><thead><tr><th>${t('tTest')}</th><th>${t('tResult')}</th></tr></thead><tbody>${synthese.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('')}</tbody></table>${tests}</div>
    <div><h3>${t('limits')}</h3><ul><li>${t('limit1')}</li><li>${t('limit2')}</li><li>${t('limit3')}</li></ul></div>
    <div class="actions">
      <button class="btnsm" data-act="csv" data-k="${k}" data-kind="annual">${ico('download')}${t('exportAnnual')}</button>
      <button class="btnsm" data-act="csv" data-k="${k}" data-kind="monthly">${ico('download')}${t('exportMonthly')}</button>
      <button class="btnsm" data-act="summary" data-k="${k}">${ico('copy')}${t('copySummary')}</button>
      <button class="btnsm" data-act="link">${ico('link')}${t('copyLink')}</button>
    </div></div>`;
}

// ---------- Export et partage ----------
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => el.classList.remove('on'), 2200);
}
function copyText(txt, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback);
  else fallback();
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (_) {
      /* ignoré */
    }
    ta.remove();
    done();
  }
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv(k, kind) {
  const r = state.res[k];
  if (!r || !r.ok) return toast(t('exportErr'));
  const v = V();
  let csv;
  if (kind === 'annual') csv = 'year,value_' + v.id + '\n' + r.annual.map((d) => `${d.year},${d.value}`).join('\n');
  else csv = 'year,month,value,anomaly\n' + r.monthly.map((d) => `${d.year},${d.month},${Number.isFinite(d.value) ? d.value : ''},${Number.isFinite(d.anomaly) ? d.anomaly : ''}`).join('\n');
  download(`earth-detective_${v.id}_${state[k].lat}_${state[k].lon}_${kind}.csv`, csv);
}
function summaryText(k) {
  const r = state.res[k];
  const v = V();
  const tr = r.trend;
  const d = dec(tr.slopePerDecade);
  const label = tr.direction === 'up' ? t('verdictUp') : tr.direction === 'down' ? t('verdictDown') : t('verdictNone');
  return `${nameOf(state[k])} · ${tl(v.name)} · ${r.contrat.debut} → ${r.contrat.fin}\n${label} : ${signed(tr.slopePerDecade, d)} ${unitRate(v)} ${t('perDecade')} [${tr.ci ? signed(tr.ci[0], d) : '–'} ; ${tr.ci ? signed(tr.ci[1], d) : '–'}], p = ${pval(tr.p)} (${t('testMK')}).\n${resumeOf(r.contrat)}\n${v.contrat.source} · ${v.contrat.giovanni_id} · Earth Detective, NASA Space Apps 2026.`;
}

// ---------- Etat dans l'adresse ----------
function writeHash() {
  const p = new URLSearchParams();
  p.set('v', state.variable);
  if (state.A) p.set('a', `${state.A.lat},${state.A.lon}${state.A.placeId ? ',' + state.A.placeId : ''}`);
  if (state.B) p.set('b', `${state.B.lat},${state.B.lon}${state.B.placeId ? ',' + state.B.placeId : ''}`);
  p.set('p', state.period.join('-'));
  if (state.alpha !== 0.05) p.set('al', state.alpha);
  try {
    history.replaceState(null, '', '#' + p.toString());
  } catch (_) {
    /* ignoré */
  }
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (VAR_BY_ID[h.get('v')]) state.variable = h.get('v');
  const loc = (s) => {
    if (!s) return null;
    const [la, lo, id] = s.split(',');
    return Number.isFinite(+la) && Number.isFinite(+lo) ? { lat: +la, lon: +lo, id: id || null } : null;
  };
  const a = loc(h.get('a'));
  const b = loc(h.get('b'));
  if (a) setLoc('A', a.lat, a.lon, a.id);
  if (b) setLoc('B', b.lat, b.lon, b.id);
  const per = (h.get('p') || '').split('-').map(Number);
  if (per.length === 2 && per.every(Number.isFinite)) state.period = [Math.max(per[0], CONFIG.firstYear), Math.min(per[1], LAST)];
  if (h.get('al') === '0.01') state.alpha = 0.01;
  if (b) state.chartMode = 'anom';
  return !!a;
}

// ---------- Fenêtres ----------
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = html;
  m.hidden = false;
  const first = m.querySelector('button.btn.primary, .case');
  first && first.focus({ preventScroll: true });
}
function closeModal() {
  $('#modal').hidden = true;
  $('#modal').innerHTML = '';
  try {
    localStorage.setItem('ed.welcomed', '1');
  } catch (_) {
    /* ignoré */
  }
}
function casesHTML() {
  return `<div class="cases">${STORIES.filter((s) => s.etape === 0).map((s) => {
    const v = VAR_BY_ID[s.variable];
    return `<button class="case" data-act="story" data-id="${s.id}"><span class="ico">${ico(STORY_ICO[s.emoji] || 'play')}</span><h3>${tl(s.title)}</h3><p>${tl(s.hook)}</p><span class="meta"><span class="tag">${tl(v.name)}</span><span class="tag num">${s.period[0]} – ${Math.min(s.period[1], LAST)}</span>${s.b ? `<span class="tag">A / B</span>` : ''}</span></button>`;
  }).join('')}</div>`;
}
function welcomeHTML() {
  return `<div class="sheet" role="dialog" aria-modal="true"><button class="x close" data-act="closemodal" aria-label="${t('aria').close}">${ico('close')}</button>
  <div class="hero"><div>
    <h1>${getLang() === 'fr' ? 'Devenez <em>détective</em> du climat' : 'Become a climate <em>detective</em>'}</h1>
    <p class="lead">${t('welcomeText')}</p>
    <div class="cta"><button class="pillbtn primary" data-act="closemodal">${t('explore')}</button><button class="pillbtn" data-act="opencases">${ico('play')}${t('stories')}</button></div>
  </div>
  <svg class="orb" viewBox="0 0 300 300" aria-hidden="true"><defs><radialGradient id="og" cx=".33" cy=".28" r=".95"><stop offset="0" stop-color="#1B3A66"/><stop offset=".55" stop-color="#122A4C"/><stop offset="1" stop-color="#0A1A2F"/></radialGradient><radialGradient id="oh" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#5FD4E6" stop-opacity=".35"/><stop offset="1" stop-color="#5FD4E6" stop-opacity="0"/></radialGradient></defs>
    <circle cx="150" cy="150" r="146" fill="url(#oh)"/><circle cx="150" cy="150" r="118" fill="url(#og)"/>
    <path d="M42 150h216M150 32c-48 34-48 202 0 236M150 32c48 34 48 202 0 236M62 96h176M62 204h176" stroke="#EEF4FF" stroke-opacity=".22" stroke-width="1.5" fill="none"/>
    <path d="M70 196l46-46 36 28 66-80" stroke="#EEF4FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="218" cy="98" r="9" fill="#FF6B7D" stroke="#0A1A2F" stroke-width="3.500"/><circle cx="116" cy="150" r="8" fill="#3D9BFF" stroke="#0A1A2F" stroke-width="3.500"/>
    <circle cx="228" cy="226" r="34" fill="#0A1A2F" fill-opacity=".96" stroke="#5FD4E6" stroke-width="9"/><path d="M253 251l30 30" stroke="#5FD4E6" stroke-width="12" stroke-linecap="round"/></svg></div>
  <div class="how3"><div><span class="no">1</span><b>${t('w1t')}</b><span>${t('w1d')}</span></div><div><span class="no">2</span><b>${t('w2t')}</b><span>${t('w2d')}</span></div><div><span class="no">3</span><b>${t('w3t')}</b><span>${t('w3d')}</span></div></div>
  <div class="cta"><button class="pillbtn primary" data-act="story" data-id="${STORIES[0] ? STORIES[0].id : ''}">${ico('play')}${t('start')}</button></div>
  <p class="note">${t('welcomeNote')}</p></div>`;
}
function casesModalHTML() {
  return `<div class="sheet" role="dialog" aria-modal="true"><button class="x close" data-act="closemodal" aria-label="${t('aria').close}">${ico('close')}</button><h2 class="mt">${t('storiesTitle')}</h2><p style="color:var(--mute);margin-top:4px">${t('storiesSub')}</p>${casesHTML()}</div>`;
}

// ---------- Enquêtes guidées ----------
function runStory(id) {
  const s = STORIES.find((x) => x.id === id);
  if (!s) return;
  closeModal();
  state.story = s;
  state.variable = s.variable;
  state.period = [Math.max(s.period[0], VAR_BY_ID[s.variable].minYear, CONFIG.firstYear), Math.min(s.period[1], LAST)];
  const a = PLACE_BY_ID[s.a];
  setLoc('A', a.lat, a.lon, a.id);
  if (s.b) {
    const b = PLACE_BY_ID[s.b];
    setLoc('B', b.lat, b.lon, b.id);
  } else {
    state.B = null;
  }
  // « saisons retirées » : écarts à la moyenne ; sinon valeurs réelles (moyennes annuelles).
  state.vue = s.saisonsRetirees ? 'anom' : 'brut';
  state.picking = 'A';
  state.tab = 'serie';
  state.zoom = null;
  applyPalette();
  syncDock();syncRange();renderQuestion();renderLegend();renderCredit();
  updatePins();
  renderHint();
  globe.flyTo(a.lat, a.lon, { k: s.b ? 1.1 : 1.7 });
  reloadAtlas(true);
  hardRefresh();
  writeHash();
}

// ---------- Interactions ----------
function setBase(id) {
  state.base = id;
  const d = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  Promise.resolve(globe.setBase(id, d)).then((ok) => {
    if (ok === false) {
      state.base = 'relief';
      globe.setBase('relief');
      toast(t('baseFail'));
      renderTools();
    }
  }).catch(() => { state.base = 'relief'; globe.setBase('relief'); toast(t('baseFail')); renderTools(); });
  renderTools();
  $('#menu')?.classList.add('on');
}

function setVariable(id) {
  state.variable = id;
  const lo = minYear();
  state.period = [Math.max(lo, state.period[0]), state.period[1]];
  if (state.period[1] - state.period[0] < 9) state.period = [Math.max(lo, LAST - 29), LAST];
  state.zoom = null;
  applyPalette();
  syncDock();syncRange();renderQuestion();renderLegend();renderCredit();
  reloadAtlas(true);
  hardRefresh();
  writeHash();
}

// ---------- Choix de la période : le moteur recalcule verdict, pente et courbe ----------
const MIN_ANS = 5; // en dessous, le moteur refuse d'analyser
function periodeHTML() {
  const lo = minYear();
  const [a, b] = state.period;
  const options = (sel, de, a2) => Array.from({ length: a2 - de + 1 }, (_, i) => de + i).map((y) => `<option value="${y}" ${y === sel ? 'selected' : ''}>${y}</option>`).join('');
  // Raccourcis plus longs que les données disponibles retirés : « Tout » les remplace (ex. NO₂, depuis 2005).
  const presets = [10, 20, 30, 0].filter((n) => n === 0 || n < LAST - lo + 1).map((n) => {
    const debut = n ? Math.max(lo, LAST - n + 1) : lo;
    const on = a === debut && b === LAST;
    return `<button class="chip ${on ? 'on' : ''}" data-act="preset" data-n="${n}">${n ? `${n} ${t('years')}` : t('presetAll')}</button>`;
  }).join('');
  return `<div class="periode rise"><div class="periode-l"><span class="periode-t">${t('periode')}</span>
    <select data-per="0" aria-label="${t('periodeDebut')}">${options(a, lo, LAST - MIN_ANS + 1)}</select><span class="periode-a">${t('periodeA')}</span>
    <select data-per="1" aria-label="${t('periodeFin')}">${options(b, lo + MIN_ANS - 1, LAST)}</select>
    <span class="periode-n">${b - a + 1} ${t('years')}</span></div>
    <div class="periode-p">${presets}</div></div>
    <p class="periode-aide">${t('periodeAide')}</p>`;
}
document.addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-per]');
  if (!sel) return;
  const y = +sel.value;
  let [a, b] = state.period;
  if (sel.dataset.per === '0') {
    a = y;
    if (b - a + 1 < MIN_ANS) b = Math.min(LAST, a + MIN_ANS - 1);
  } else {
    b = y;
    if (b - a + 1 < MIN_ANS) a = Math.max(minYear(), b - MIN_ANS + 1);
  }
  state.period = [a, b];
  state.story = null;
  softRefresh();
});

document.addEventListener('click', (e) => {
  const tipBtn = e.target.closest('[data-tip]');
  const dropOpen = $('#drop');
  if (dropOpen && !e.target.closest('.search')) dropOpen.classList.remove('on');
  if (!e.target.closest('#tools')) { const m = $('#menu'); if (m) m.classList.remove('on'); }
  const el = e.target.closest('[data-act]');
  if (tipBtn && !el) return;
  if (!el) return;
  const a = el.dataset.act;
  const k = el.dataset.k;
  switch (a) {
    case 'botclose':
      botState.open = false;
      return renderBot();
    case 'botq':
      return sendBot(el.dataset.q);
    case 'var':
      return setVariable(el.dataset.id);
    case 'result': {
      const x = $('#drop')._list[+el.dataset.i];
      return x && chooseResult(x);
    }
    case 'clear':
      if (k === 'B') {
        state.B = null;
        state.picking = 'A';
        state.chartMode = null;
      } else if (state.B) {
        state.A = state.B;
        state.B = null;
        state.picking = 'A';
        state.chartMode = null;
      } else {
        state.A = null;
        state.res = { A: null, B: null };
      }
      state.focus = 'A';
      return afterSelection();
    case 'compare':
      if (!state.A) return;
      state.picking = 'B';
      renderHint();
      return renderResults();
    case 'zin':
      return globe.zoomBy(1.5);
    case 'zout':
      return globe.zoomBy(1 / 1.5);
    case 'zreset':
      return globe.reset();
    case 'menu':
      return $('#menu').classList.toggle('on');
    case 'base':
      return setBase(el.dataset.id);
    case 'preset': {
      const n = +el.dataset.n;
      const lo = minYear();
      state.period = [n ? Math.max(lo, LAST - n + 1) : lo, LAST];
      state.story = null;
      syncRange();
      return softRefresh();
    }
    case 'alpha':
      state.alpha = +el.dataset.a;
      syncRange();
      hardRefresh();
      reloadAtlas(false);
      return writeHash();
    case 'tab':
      state.tab = el.dataset.id;
      $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === state.tab));
      moveInd(true);
      return renderTab();
    case 'focus':
      state.focus = k;
      return renderTab();
    case 'vue':
      state.vue = el.dataset.v;
      return renderTab();
    case 'tgl':
      state.show[el.dataset.id] = !state.show[el.dataset.id];
      return renderTab();
    case 'cmode':
      state.chartMode = el.dataset.m;
      return renderTab();
    case 'zoomreset':
      state.zoom = null;
      return renderTab();
    case 'atlas':
      state.atlasOn = !state.atlasOn;
      if (state.atlasOn) reloadAtlas(true);
      else {
        cancelAtlas();
        globe.clearAtlas();
        state.atlas.busy = false;
        renderLegend();
      }
      return;
    case 'retry':
      return hardRefresh();
    case 'story':
      return runStory(el.dataset.id);
    case 'storynav': {
      const i = STORIES.findIndex((x) => state.story && x.id === state.story.id) + Number(el.dataset.d);
      if (STORIES[i] && STORIES[i].scenario === state.story.scenario) runStory(STORIES[i].id);
      return;
    }
    case 'storyclose':
      state.story = null;
      return renderResults();
    case 'closemodal':
      return closeModal();
    case 'opencases':
      return openModal(casesModalHTML());
    case 'csv':
      return exportCsv(k, el.dataset.kind);
    case 'summary':
      return copyText(summaryText(k), t('copied'));
    case 'link':
      writeHash();
      return copyText(location.href, t('linkCopied'));
    default:
  }
});

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  showTip(`<div class="free">${t(el.dataset.tip)}</div>`, r.left + r.width / 2, r.top);
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('[data-tip]')) hideTip();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});
$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeModal();
});

// ---------- Trendbot ----------
const botState = { open: false, msgs: [], busy: false };
function botContext() {
  const v = V();
  const pack = (k) => {
    const r = state.res[k];
    if (!r || !r.trend || !state[k]) return null;
    const tr = r.trend;
    const d = dec(tr.slopePerDecade);
    return { name: nameOf(state[k]), direction: tr.direction, slope: signed(tr.slopePerDecade, d), p: pval(tr.p), pPct: String(Math.max(0.1, Math.round(tr.p * 1000) / 10)).replace('.', getLang() === 'fr' ? ',' : '.'), ci: tr.ci ? `${signed(tr.ci[0], d)} / ${signed(tr.ci[1], d)}` : '–', total: signed(tr.totalChange, dec(tr.totalChange)), n: r.n, autocorrelated: !!tr.autocorrelated };
  };
  const demande = state.A && state.A.placeId ? { variable: state.variable, placeId: state.A.placeId, start: state.period[0], end: state.period[1] } : null;
  return { variable: tl(v.name).toLowerCase(), unit: unitRate(v), period: state.period, A: pack('A'), B: pack('B'), demande };
}
function renderBot() {
  const btn = $('#botBtn');
  btn.innerHTML = `<span class="botorb"></span>Trendbot`;
  const box = $('#bot');
  box.hidden = !botState.open;
  btn.classList.toggle('on', botState.open);
  if (!botState.open) return;
  const lang = getLang();
  const chips = botChips(lang, !!state.A);
  box.innerHTML = `<div class="bot-h"><span class="botorb"></span><div><b>Trendbot</b><small>${lang === 'fr' ? 'Assistant de lecture des données' : 'Data reading assistant'}</small></div><button class="x" data-act="botclose" aria-label="close">${ico('close')}</button></div>
    <div class="bot-m" id="botM"><div class="msg ai">${esc(botIntro(lang))}</div>${botState.msgs.map((m) => `<div class="msg ${m.who}">${esc(m.text)}</div>`).join('')}${botState.busy ? '<div class="msg ai typing"><i></i><i></i><i></i></div>' : ''}</div>
    <div class="bot-c">${chips.map((c) => `<button class="chip" data-act="botq" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <form class="bot-f" id="botF"><input id="botI" autocomplete="off" placeholder="${lang === 'fr' ? 'Pose une question' : 'Ask a question'}"><button aria-label="send">${ico('arrow')}</button></form>`;
  const m = $('#botM');
  m.scrollTop = m.scrollHeight;
  $('#botF').addEventListener('submit', (e) => {
    e.preventDefault();
    const i = $('#botI');
    if (i.value.trim()) sendBot(i.value.trim());
  });
}
async function sendBot(text) {
  if (botState.busy) return;
  botState.msgs.push({ who: 'me', text });
  botState.busy = true;
  renderBot();
  const { text: ans, suggestion } = await botAsk(text, { ...botContext(), historique: botState.msgs.slice(0, -1).slice(-6) }, getLang());
  await new Promise((r) => setTimeout(r, 450));
  botState.busy = false;
  const msg = { who: 'ai', text: '' };
  botState.msgs.push(msg);
  const words = ans.split(' ');
  for (let i = 1; i <= words.length; i++) {
    msg.text = words.slice(0, i).join(' ');
    renderBot();
    await new Promise((r) => setTimeout(r, 22));
  }
  if (suggestion) appliquerSuggestion(suggestion);
}

// Suggestion de trend.advisor : on ouvre l'enquête sur la variable et la région proposées.
function appliquerSuggestion(sug) {
  const vid = (sug.variable_ids || []).find((id) => VAR_BY_ID[id]);
  const region = sug.region_id && PLACE_BY_ID[sug.region_id];
  if (region) {
    setLoc('A', region.lat, region.lon, region.id);
    state.B = null;
    state.picking = 'A';
    state.story = null;
    globe.flyTo(region.lat, region.lon, { duration: 1100 });
  }
  if (vid && vid !== state.variable) {
    if (region) {
      updatePins();
      renderHint();
    }
    setVariable(vid);
  } else if (region) {
    afterSelection();
  }
  renderBot(); // questions rapides adaptées au nouveau résultat
}

function updateInsets() {
  if (!globe) return;
  const ui = $('#ui');
  const left = $('.left');
  const tools = $('#tools');
  const top = $('.top');
  const bottom = $('.bottom');
  if (!ui || !left || !tools) return;
  $('#stage').style.setProperty('--bottomh', ui.offsetHeight - bottom.offsetTop + 'px');
  globe.setInsets({
    l: left.offsetLeft + left.offsetWidth + 8,
    r: ui.offsetWidth - tools.offsetLeft + 8,
    t: top.offsetTop + top.offsetHeight + 4,
    b: ui.offsetHeight - bottom.offsetTop + 4
  });
}

// ---------- Démarrage ----------
function renderChrome() {
  $('#brandSub').textContent = 'NASA SPACE APPS 2026 · NEURAL NEWTONS';
  $('#btnStories').innerHTML = `${ico('play')}${t('stories')}`;
  $('#btnHelp').innerHTML = ico('help');
  $('#btnHelp').setAttribute('aria-label', t('help'));
  $('#btnHelp').title = t('help');
  $$('#langSeg button').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
}
function renderAll() {
  renderChrome();
  renderCredit();
  renderBot();
  const qq = $('#q');
  if (qq) qq.placeholder = t('searchGlobal');
  renderStageUI();
  renderResults();
}

function init() {
  let saved = null;
  try {
    saved = localStorage.getItem('ed.lang');
  } catch (_) {
    /* ignoré */
  }
  const params = new URLSearchParams(location.search);
  const initial = params.get('lang') || saved || (navigator.language || 'fr').slice(0, 2);
  setLang(initial === 'en' ? 'en' : 'fr');
  setLocale(getLang());
  $('#logo').innerHTML = LOGO;
  if (CONFIG.mock) {
    $('#mockbar').hidden = false;
    $('#mockbar').textContent = t('mockBar');
    document.body.classList.add('has-mock');
  }
  globe = createGlobe($('#globeHost'), { pick: onPick, hover: onHover, markerHover: onMarkerHover });
  const hadLoc = readHash();
  applyPalette();
  renderAll();
  updateInsets();
  setTimeout(updateInsets, 300);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateInsets);
  updatePins();
  reloadAtlas(true);
  if (hadLoc) {
    globe.flyTo(state.A.lat, state.A.lon, { duration: 1 });
    hardRefresh();
  } else {
    let welcomed = false;
    try {
      welcomed = !!localStorage.getItem('ed.welcomed');
    } catch (_) {
      /* ignoré */
    }
    if (!welcomed && !params.get('nowelcome')) openModal(welcomeHTML());
  }
  $('#btnStories').addEventListener('click', () => openModal(casesModalHTML()));
  $('#btnHelp').addEventListener('click', () => openModal(welcomeHTML()));
  $('#langSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setLang(b.dataset.lang);
    setLocale(getLang());
    try {
      localStorage.setItem('ed.lang', getLang());
    } catch (_) {
      /* ignoré */
    }
    if (CONFIG.mock) $('#mockbar').textContent = t('mockBar');
    renderAll();
    if (!$('#modal').hidden) openModal(welcomeHTML());
  });
  const q = $('#q');
  q.placeholder = t('searchGlobal');
  q.addEventListener('input', () => fillDrop(q.value));
  q.addEventListener('focus', () => fillDrop(q.value));
  q.addEventListener('keydown', (e) => {
    const items = $$('#drop button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      acIndex = (acIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
      items.forEach((b, i) => b.classList.toggle('act', i === acIndex));
    } else if (e.key === 'Enter') {
      const x = $('#drop')._list[Math.max(0, acIndex)];
      if (x) chooseResult(x);
    } else if (e.key === 'Escape') {
      q.blur();
      $('#drop').classList.remove('on');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== q && $('#modal').hidden) {
      e.preventDefault();
      q.focus();
    }
  });
  $('#botBtn').addEventListener('click', () => { botState.open = !botState.open; renderBot(); if (botState.open) setTimeout(() => $('#botI') && $('#botI').focus(), 50); });
  window.addEventListener('resize', () => { updateInsets(); syncDock(); moveInd(false); });
  window.__ed = { state, setLoc, afterSelection, runStory, setVariable, globe, dataMode };
}

init();
