// Graphiques interactifs d'Earth Detective (SVG + d3). Chaque fonction se redessine à chaque changement de taille.
import * as d3 from 'd3';
import { num, signed, pval } from './format.js';
import { MONTHS } from './content.js';

// Lieu A ivoire, lieu B laiton : jamais les couleurs de sens (orange = hausse, bleu = baisse), réservées au verdict.
export const COLOR = { A: '#F3EFE7', B: '#E4C784', ink: '#F3EFE7', mute: 'rgba(243,239,231,.62)', grid: 'rgba(243,239,231,.07)', soft: 'rgba(243,239,231,.22)' };
const PANEL = '#15181D';

// ---------- Infobulle partagée ----------
let tipEl;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
export function showTip(html, clientX, clientY) {
  const t = tip();
  t.innerHTML = html;
  t.classList.add('on');
  const r = t.getBoundingClientRect();
  let x = clientX + 16;
  let y = clientY - r.height - 12;
  if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 16;
  if (y < 8) y = clientY + 18;
  t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
export function hideTip() {
  tip().classList.remove('on');
}
export const tipRows = (title, rows) =>
  `<div class="tip-h">${title}</div>` +
  rows
    .map((r) => `<div class="tip-r">${r.color ? `<i style="background:${r.color}"></i>` : ''}<span>${r.label}</span><b>${r.value}</b></div>`)
    .join('');

// ---------- Montage réactif ----------
export function mount(el, draw) {
  let first = true;
  const render = () => {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    d3.select(el).selectAll('svg').remove();
    const svg = d3.select(el).append('svg').attr('width', r.width).attr('height', r.height).attr('viewBox', `0 0 ${r.width} ${r.height}`);
    draw(svg, r.width, r.height, first);
    first = false;
  };
  const ro = new ResizeObserver(() => requestAnimationFrame(render));
  ro.observe(el);
  render();
  return { redraw: (animate) => ((first = !!animate), render()), destroy: () => ro.disconnect() };
}

function styleAxis(g) {
  g.selectAll('text').attr('fill', COLOR.mute).attr('font-size', 11.5).attr('font-family', 'inherit');
  g.selectAll('.domain').remove();
  g.selectAll('line').attr('stroke', COLOR.soft);
}

function drawIn(path, animate, ms = 900) {
  if (!animate) return;
  const node = path.node();
  if (!node) return;
  const len = node.getTotalLength ? node.getTotalLength() : 0;
  if (!len) return;
  path
    .attr('stroke-dasharray', `${len} ${len}`)
    .attr('stroke-dashoffset', len)
    .transition()
    .duration(ms)
    .ease(d3.easeCubicOut)
    .attr('stroke-dashoffset', 0)
    .on('end', () => path.attr('stroke-dasharray', null));
}

const niceExtent = (vals, pad = 0.08) => {
  const [a, b] = d3.extent(vals);
  const d = b - a || Math.abs(a) * 0.1 || 1;
  return [a - d * pad, b + d * pad];
};

// ============ 1. Évolution annuelle ============
/**
 * series : [{key:'A'|'B', color, name, annual, fullAnnual, trend}]
 * opts   : { unit, decimals, mode:'abs'|'anom', show:{trend,band,smooth,ols}, period:[y0,y1], range:[min,max], onPeriod, lang, animate, labels }
 */
export function annualChart(el, series, opts) {
  return mount(el, (svg, W, H, first) => {
    const m = { t: 20, r: 18, b: 30, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const [p0, p1] = opts.period;
    const anomaly = opts.mode === 'anom';
    const meanOf = (s) => d3.mean(s.annual.map((d) => d.value));
    const shift = (s) => (anomaly ? meanOf(s) : 0);

    const yVals = [];
    series.forEach((s) => {
      const sh = shift(s);
      s.fullAnnual.forEach((d) => yVals.push(d.value - sh));
      if (s.trend && s.trend.ci) {
        const x0 = s.annual[0].year;
        const x1 = s.annual[s.annual.length - 1].year;
        const xm = (x0 + x1) / 2;
        const ym = s.trend.intercept + s.trend.slopePerYear * xm - sh;
        [s.trend.ci[0], s.trend.ci[1]].forEach((c) => {
          yVals.push(ym + (c / 10) * (x0 - xm), ym + (c / 10) * (x1 - xm));
        });
      }
    });
    const x = d3.scaleLinear().domain([opts.range[0] - 0.5, opts.range[1] + 0.5]).range([0, iw]);
    const y = d3.scaleLinear().domain(niceExtent(yVals, 0.1)).nice().range([ih, 0]);

    // grille
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => ''))
      .call((a) => a.selectAll('line').attr('stroke', COLOR.grid).attr('stroke-dasharray', '2 4'))
      .call((a) => a.select('.domain').remove());
    const yA = g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10).tickFormat((v) => num(v, opts.axisDecimals ?? 1)));
    styleAxis(yA);
    const nx = Math.max(2, Math.round(iw / 70));
    const xA = g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(nx).tickSize(4).tickPadding(8).tickFormat(d3.format('d')));
    styleAxis(xA);
    svg.append('text').attr('x', 6).attr('y', 12).attr('fill', COLOR.mute).attr('font-size', 11.5).attr('font-weight', 600).text(anomaly ? `Δ ${opts.unit}` : opts.unit);

    // zone hors période
    g.append('rect').attr('x', 0).attr('y', 0).attr('width', Math.max(0, x(p0 - 0.5))).attr('height', ih).attr('fill', 'rgba(255,255,255,.045)').attr('opacity', 1);
    g.append('rect').attr('x', x(p1 + 0.5)).attr('y', 0).attr('width', Math.max(0, iw - x(p1 + 0.5))).attr('height', ih).attr('fill', 'rgba(255,255,255,.045)').attr('opacity', 1);
    if (anomaly) g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', COLOR.soft).attr('stroke-width', 1.2);

    const line = d3.line().x((d) => x(d.year)).y((d) => y(d.v)).curve(d3.curveMonotoneX);

    series.forEach((s) => {
      const sh = shift(s);
      const inP = s.annual.map((d) => ({ year: d.year, v: d.value - sh }));
      const out = s.fullAnnual.filter((d) => d.year < p0 || d.year > p1).map((d) => ({ year: d.year, v: d.value - sh }));
      // contexte
      g.selectAll(null)
        .data(out)
        .enter()
        .append('circle')
        .attr('cx', (d) => x(d.year))
        .attr('cy', (d) => y(d.v))
        .attr('r', 2.6)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(243,239,231,.4)')
        .attr('stroke-width', 1.2);

      const area = g.append('g');
      if (opts.show.band && s.trend && s.trend.ci && s.annual.length > 2) {
        const x0 = s.annual[0].year;
        const x1 = s.annual[s.annual.length - 1].year;
        const xm = (x0 + x1) / 2;
        const ym = s.trend.intercept + s.trend.slopePerYear * xm - sh;
        const lo = (c) => [ym + (c / 10) * (x0 - xm), ym + (c / 10) * (x1 - xm)];
        const [a0, a1] = lo(s.trend.ci[0]);
        const [b0, b1] = lo(s.trend.ci[1]);
        area
          .append('path')
          .attr('d', `M${x(x0)},${y(a0)} L${x(x1)},${y(a1)} L${x(x1)},${y(b1)} L${x(x0)},${y(b0)} Z`)
          .attr('fill', s.color)
          .attr('opacity', 0)
          .transition()
          .duration(first ? 700 : 0)
          .delay(first ? 650 : 0)
          .attr('opacity', 0.13);
      }
      if (opts.show.smooth && inP.length > 5) {
        const sm = inP.map((d, i) => {
          const w = inP.slice(Math.max(0, i - 2), Math.min(inP.length, i + 3));
          return { year: d.year, v: d3.mean(w, (q) => q.v) };
        });
        g.append('path').attr('d', line(sm)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-opacity', 0.45).attr('stroke-width', 2).attr('stroke-linecap', 'round');
      }
      const pth = g.append('path').attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.v))(inP)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-opacity', 0.22).attr('stroke-width', 1.2);
      drawIn(pth, first, 700);
      if (opts.show.ols && s.trend && s.trend.ols) {
        const x0 = s.annual[0].year;
        const x1 = s.annual[s.annual.length - 1].year;
        const f = (xx) => s.trend.ols.intercept + (s.trend.ols.slopePerDecade / 10) * xx - sh;
        g.append('line').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(f(x0))).attr('y2', y(f(x1))).attr('stroke', COLOR.ink).attr('stroke-width', 1.6).attr('stroke-dasharray', '5 5').attr('opacity', 0.55);
      }
      if (opts.show.trend && s.trend && s.annual.length > 2) {
        const x0 = s.annual[0].year;
        const x1 = s.annual[s.annual.length - 1].year;
        const f = (xx) => s.trend.intercept + s.trend.slopePerYear * xx - sh;
        const l = g.append('line').attr('x1', x(x0)).attr('y1', y(f(x0))).attr('x2', x(x1)).attr('y2', y(f(x1))).attr('stroke', s.color).attr('stroke-width', 3.2).attr('stroke-linecap', 'round');
        if (!s.trend.significant) l.attr('stroke-dasharray', '1 7');
        if (first) {
          l.attr('x2', x(x0)).attr('y2', y(f(x0))).transition().delay(450).duration(800).ease(d3.easeCubicOut).attr('x2', x(x1)).attr('y2', y(f(x1)));
        }
      }
      // points
      const dots = g.selectAll(null).data(inP).enter().append('circle').attr('class', 'dot').attr('cx', (d) => x(d.year)).attr('cy', (d) => y(d.v)).attr('fill', s.color).attr('stroke', PANEL).attr('stroke-width', 1.8);
      if (first) dots.attr('r', 0).transition().delay((d, i) => 80 + i * 14).duration(300).attr('r', 3.8);
      else dots.attr('r', 3.8);
      // extrêmes
      if (series.length === 1 && inP.length > 3) {
        const mx = d3.greatest(inP, (d) => d.v);
        const mn = d3.least(inP, (d) => d.v);
        [[mx, -10], [mn, 17]].forEach(([d, dy]) => {
          g.append('circle').attr('cx', x(d.year)).attr('cy', y(d.v)).attr('r', 6.5).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 1.5).attr('opacity', 0.6);
          g.append('text').attr('x', x(d.year)).attr('y', y(d.v) + dy).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('font-weight', 600).attr('fill', COLOR.mute).text(d.year);
        });
      }
    });

    // survol
    const guide = g.append('line').attr('y1', 0).attr('y2', ih).attr('stroke', COLOR.ink).attr('stroke-opacity', 0.25).attr('stroke-dasharray', '3 3').style('display', 'none');
    const focus = series.map((s) => g.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2.4).style('display', 'none'));

    const onMove = (event) => {
      const [mx] = d3.pointer(event, g.node());
      const yr = Math.round(x.invert(mx));
      if (yr < opts.range[0] || yr > opts.range[1]) return onLeave();
      guide.style('display', null).attr('x1', x(yr)).attr('x2', x(yr));
      const rows = [];
      series.forEach((s, i) => {
        const d = s.fullAnnual.find((q) => q.year === yr);
        if (!d) return focus[i].style('display', 'none');
        const sh = shift(s);
        focus[i].style('display', null).attr('cx', x(yr)).attr('cy', y(d.value - sh));
        const mean = meanOf(s);
        const dev = d.value - mean;
        const rank = [...s.annual].sort((a, b) => b.value - a.value).findIndex((q) => q.year === yr) + 1;
        rows.push({ color: s.color, label: s.name, value: `${num(d.value, opts.decimals ?? 1)} ${opts.unit}` });
        rows.push({ label: opts.labels.vsMean, value: `${signed(dev, opts.decimals ?? 1)}` });
        if (rank) rows.push({ label: opts.labels.rank, value: `${rank} / ${s.annual.length}` });
      });
      showTip(tipRows(String(yr), rows), event.clientX, event.clientY);
    };
    const onLeave = () => {
      guide.style('display', 'none');
      focus.forEach((f) => f.style('display', 'none'));
      hideTip();
    };

    // sélection de période
    let guard = true;
    const brush = d3
      .brushX()
      .extent([[0, 0], [iw, ih]])
      .on('brush end', (event) => {
        if (guard || !event.sourceEvent || !event.selection) return;
        if (event.type !== 'end') return;
        let a = Math.round(x.invert(event.selection[0]) + 0.0);
        let b = Math.round(x.invert(event.selection[1]) - 0.0);
        a = Math.max(opts.range[0], a);
        b = Math.min(opts.range[1], b);
        if (b - a + 1 < 10) {
          const c = (a + b) / 2;
          a = Math.round(c - 5);
          b = a + 9;
          if (a < opts.range[0]) {
            a = opts.range[0];
            b = a + 9;
          }
          if (b > opts.range[1]) {
            b = opts.range[1];
            a = b - 9;
          }
        }
        guard = true;
        gb.call(brush.move, [x(a - 0.5), x(b + 0.5)]);
        guard = false;
        if (a !== p0 || b !== p1) opts.onPeriod && opts.onPeriod([a, b]);
      });
    const gb = g.append('g').attr('class', 'brush').call(brush);
    gb.select('.selection').attr('fill', 'transparent').attr('stroke', COLOR.A).attr('stroke-opacity', 0.55).attr('stroke-width', 1.4).attr('stroke-dasharray', '4 4').attr('shape-rendering', 'geometricPrecision');
    gb.selectAll('.handle')
      .attr('fill', '#fff')
      .attr('stroke', COLOR.A)
      .attr('stroke-width', 1.6)
      .attr('rx', 4)
      .attr('opacity', 0.95);
    gb.call(brush.move, [x(p0 - 0.5), x(p1 + 0.5)]);
    guard = false;
    gb.selectAll('.overlay,.selection').on('mousemove.tip', onMove).on('mouseleave.tip', onLeave);
    gb.selectAll('.handle').on('mouseenter.tip', hideTip);
    gb.select('.selection').style('cursor', 'default');
  });
}

// ============ 2. Mois par mois ============
export function monthlyChart(el, res, opts) {
  return mount(el, (svg, W, H, first) => {
    const m = { t: 20, r: 18, b: 52, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const data = res.monthly.filter((d) => Number.isFinite(d.anomaly)).map((d) => ({ ...d, t: d.year + (d.month - 0.5) / 12 }));
    const full = [d3.min(data, (d) => d.t) - 0.04, d3.max(data, (d) => d.t) + 0.04];
    let dom = opts.zoom && opts.zoom.length === 2 ? opts.zoom : full;
    const x = d3.scaleLinear().domain(dom).range([0, iw]);
    const view = data.filter((d) => d.t >= dom[0] && d.t <= dom[1]);
    const vmax = d3.max(view, (d) => Math.abs(d.anomaly)) || 1;
    const y = d3.scaleLinear().domain([-vmax * 1.08, vmax * 1.08]).range([ih, 0]);
    const clip = 'clip' + Math.random().toString(36).slice(2, 8);
    svg.append('defs').append('clipPath').attr('id', clip).append('rect').attr('width', iw).attr('height', ih + 4).attr('y', -2);

    g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => '')).call((a) => a.selectAll('line').attr('stroke', COLOR.grid).attr('stroke-dasharray', '2 4')).call((a) => a.select('.domain').remove());
    styleAxis(g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10).tickFormat((v) => num(v, vmax < 2 ? 1 : 0))));
    styleAxis(g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.round(iw / 70))).tickSize(4).tickPadding(8).tickFormat(d3.format('d'))));
    svg.append('text').attr('x', 6).attr('y', 12).attr('fill', COLOR.mute).attr('font-size', 11.5).attr('font-weight', 600).text(`Δ ${opts.unit}`);

    const c = g.append('g').attr('clip-path', `url(#${clip})`);
    const bw = Math.max(0.8, (iw / ((dom[1] - dom[0]) * 12)) * 0.82);
    c.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', COLOR.soft);
    c.selectAll('rect.b')
      .data(view)
      .enter()
      .append('rect')
      .attr('class', 'b')
      .attr('x', (d) => x(d.t) - bw / 2)
      .attr('width', bw)
      .attr('y', (d) => (d.anomaly >= 0 ? y(d.anomaly) : y(0)))
      .attr('height', (d) => Math.abs(y(d.anomaly) - y(0)))
      .attr('rx', Math.min(2, bw / 2))
      .attr('fill', (d) => (d.anomaly >= 0 ? opts.up : opts.down))
      .attr('opacity', 0.62);

    // moyenne glissante sur 12 mois
    const sm = data.map((d, i) => {
      if (i < 11) return null;
      const w = data.slice(i - 11, i + 1);
      return { t: d.t, v: d3.mean(w, (q) => q.anomaly) };
    }).filter(Boolean);
    const pth = c.append('path').attr('d', d3.line().x((d) => x(d.t)).y((d) => y(d.v)).curve(d3.curveCatmullRom)(sm)).attr('fill', 'none').attr('stroke', COLOR.ink).attr('stroke-width', 2.6).attr('stroke-linecap', 'round');
    drawIn(pth, first, 1100);

    const guide = g.append('line').attr('y1', 0).attr('y2', ih).attr('stroke', COLOR.ink).attr('stroke-opacity', 0.3).attr('stroke-dasharray', '3 3').style('display', 'none');
    const brush = d3
      .brushX()
      .extent([[0, 0], [iw, ih]])
      .on('end', (event) => {
        if (!event.sourceEvent || !event.selection) return;
        const [a, b] = event.selection.map(x.invert);
        if (b - a < 1) return;
        opts.onZoom && opts.onZoom([a, b]);
      });
    const gb = g.append('g').call(brush);
    gb.select('.selection').attr('fill', COLOR.A).attr('fill-opacity', 0.08).attr('stroke', COLOR.A).attr('stroke-opacity', 0.5);
    gb.selectAll('.overlay')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, g.node());
        const t = x.invert(mx);
        const near = d3.least(view, (d) => Math.abs(d.t - t));
        if (!near) return;
        guide.style('display', null).attr('x1', x(near.t)).attr('x2', x(near.t));
        const smv = sm.find((q) => Math.abs(q.t - near.t) < 0.01);
        const rows = [
          { color: near.anomaly >= 0 ? opts.up : opts.down, label: opts.labels.anomaly, value: `${signed(near.anomaly, opts.decimals)} ${opts.unit}` },
          { label: opts.labels.value, value: `${num(near.value, opts.decimals)} ${opts.unitMonthly || opts.unit}` }
        ];
        if (smv) rows.push({ color: COLOR.ink, label: opts.labels.smooth, value: `${signed(smv.v, opts.decimals)}` });
        showTip(tipRows(`${MONTHS[opts.lang][near.month - 1]} ${near.year}`, rows), event.clientX, event.clientY);
      })
      .on('mouseleave', () => {
        guide.style('display', 'none');
        hideTip();
      })
      .on('dblclick', () => opts.onZoom && opts.onZoom(null));
  });
}

// ============ 3. Calendrier (carte de chaleur année × mois) ============
export function heatmapChart(el, res, opts) {
  return mount(el, (svg, W, H, first) => {
    const m = { t: 8, r: 14, b: 46, l: 46 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const data = res.monthly.filter((d) => Number.isFinite(d.anomaly));
    const years = [...new Set(res.monthly.map((d) => d.year))].sort((a, b) => a - b);
    const x = d3.scaleBand().domain(years).range([0, iw]).paddingInner(0.1);
    const y = d3.scaleBand().domain(d3.range(1, 13)).range([0, ih]).paddingInner(0.12);
    const absSorted = data.map((d) => Math.abs(d.anomaly)).sort(d3.ascending);
    const vmax = d3.quantileSorted(absSorted, 0.97) || 1;
    const lo = d3.color(opts.down);
    const hi = d3.color(opts.up);
    const mid = '#1E3270';
    const col = d3.scaleLinear().domain([-vmax, 0, vmax]).range([lo.brighter(0.15).formatHex(), mid, hi.brighter(0.15).formatHex()]).clamp(true).interpolate(d3.interpolateRgb);

    const cells = g
      .selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.year))
      .attr('y', (d) => y(d.month))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('rx', Math.min(3, x.bandwidth() / 3))
      .attr('fill', (d) => col(d.anomaly));
    if (first) cells.attr('opacity', 0).transition().delay((d) => (d.year - years[0]) * 12).duration(350).attr('opacity', 1);

    const my = g.append('g');
    d3.range(1, 13).forEach((mo) => {
      my.append('text').attr('x', -10).attr('y', y(mo) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', COLOR.mute).text(MONTHS[opts.lang][mo - 1]);
    });
    const step = Math.max(1, Math.round(70 / (iw / years.length)));
    years.filter((yr, i) => i % step === 0).forEach((yr) => {
      g.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', ih + 16).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('fill', COLOR.mute).text(yr);
    });

    // légende
    const lgW = Math.min(220, iw * 0.6);
    const id = 'lg' + Math.random().toString(36).slice(2, 7);
    const defs = svg.append('defs');
    const lg = defs.append('linearGradient').attr('id', id);
    d3.range(0, 1.01, 0.1).forEach((t) => lg.append('stop').attr('offset', t).attr('stop-color', col(-vmax + 2 * vmax * t)));
    const lx = m.l + iw - lgW;
    svg.append('rect').attr('x', lx).attr('y', H - 20).attr('width', lgW).attr('height', 8).attr('rx', 4).attr('fill', `url(#${id})`);
    svg.append('text').attr('x', lx - 6).attr('y', H - 13).attr('text-anchor', 'end').attr('dy', '0.35em').attr('font-size', 11).attr('fill', COLOR.mute).text(`${signed(-vmax, opts.decimals)}`);
    svg.append('text').attr('x', lx + lgW + 6).attr('y', H - 13).attr('dy', '0.35em').attr('font-size', 11).attr('fill', COLOR.mute).text(`${signed(vmax, opts.decimals)} ${opts.unit}`);

    const ring = g.append('rect').attr('fill', 'none').attr('stroke', COLOR.ink).attr('stroke-width', 1.8).attr('rx', 3).style('display', 'none').style('pointer-events', 'none');
    cells
      .on('mouseenter', function (event, d) {
        ring.style('display', null).attr('x', x(d.year) - 1).attr('y', y(d.month) - 1).attr('width', x.bandwidth() + 2).attr('height', y.bandwidth() + 2);
      })
      .on('mousemove', (event, d) => {
        showTip(
          tipRows(`${MONTHS[opts.lang][d.month - 1]} ${d.year}`, [
            { color: col(d.anomaly), label: opts.labels.anomaly, value: `${signed(d.anomaly, opts.decimals)} ${opts.unit}` },
            { label: opts.labels.value, value: `${num(d.value, opts.decimals)} ${opts.unitMonthly || opts.unit}` }
          ]),
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => {
        ring.style('display', 'none');
        hideTip();
      });
  });
}

// ============ 4. Saisons : pente par mois ============
export function seasonalChart(el, series, opts) {
  return mount(el, (svg, W, H, first) => {
    const m = { t: 22, r: 14, b: 32, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const vals = [];
    series.forEach((s) => s.seasonal.forEach((d) => Number.isFinite(d.slope) && vals.push(d.lower * 10, d.upper * 10, 0)));
    const y = d3.scaleLinear().domain(niceExtent(vals, 0.12)).nice().range([ih, 0]);
    const x0 = d3.scaleBand().domain(d3.range(1, 13)).range([0, iw]).paddingInner(0.18);
    const x1 = d3.scaleBand().domain(series.map((s) => s.key)).range([0, x0.bandwidth()]).padding(0.08);
    const defs = svg.append('defs');
    series.forEach((s) => {
      const p = defs.append('pattern').attr('id', 'hatch' + s.key).attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
      p.append('rect').attr('width', 6).attr('height', 6).attr('fill', PANEL);
      p.append('rect').attr('width', 2.4).attr('height', 6).attr('fill', s.color).attr('opacity', 0.45);
    });
    g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => '')).call((a) => a.selectAll('line').attr('stroke', COLOR.grid).attr('stroke-dasharray', '2 4')).call((a) => a.select('.domain').remove());
    styleAxis(g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10).tickFormat((v) => num(v, Math.abs(y.domain()[1]) < 2 ? 1 : 0))));
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', COLOR.ink).attr('stroke-opacity', 0.35);
    svg.append('text').attr('x', 6).attr('y', 12).attr('fill', COLOR.mute).attr('font-size', 11.5).attr('font-weight', 600).text(`${opts.unit} / ${opts.perDecade}`);

    d3.range(1, 13).forEach((mo) => g.append('text').attr('x', x0(mo) + x0.bandwidth() / 2).attr('y', ih + 20).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', COLOR.mute).text(MONTHS[opts.lang][mo - 1].replace('.', '')));

    series.forEach((s) => {
      s.seasonal.forEach((d) => {
        if (!Number.isFinite(d.slope)) return;
        const bx = x0(d.month) + x1(s.key);
        const v = d.slope * 10;
        const top = Math.min(y(0), y(v));
        const hh = Math.abs(y(v) - y(0));
        const r = g.append('rect').attr('x', bx).attr('width', x1.bandwidth()).attr('rx', 4).attr('fill', d.significant ? s.color : `url(#hatch${s.key})`).attr('stroke', s.color).attr('stroke-width', d.significant ? 0 : 1.2).attr('stroke-opacity', 0.55);
        if (first) r.attr('y', y(0)).attr('height', 0).transition().delay(d.month * 35).duration(550).ease(d3.easeCubicOut).attr('y', top).attr('height', hh);
        else r.attr('y', top).attr('height', hh);
        const cx = bx + x1.bandwidth() / 2;
        g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y(d.lower * 10)).attr('y2', y(d.upper * 10)).attr('stroke', COLOR.ink).attr('stroke-opacity', 0.55).attr('stroke-width', 1.3);
        g.append('rect').attr('x', bx).attr('width', x1.bandwidth()).attr('y', 0).attr('height', ih).attr('fill', 'transparent')
          .on('mousemove', (event) => {
            showTip(
              tipRows(MONTHS[opts.lang][d.month - 1], [
                { color: s.color, label: s.name, value: `${signed(v, opts.decimals)} ${opts.unit}` },
                { label: opts.labels.ci, value: `[${signed(d.lower * 10, opts.decimals)} ; ${signed(d.upper * 10, opts.decimals)}]` },
                { label: 'p', value: pval(d.p) },
                { label: opts.labels.verdict, value: d.significant ? opts.labels.sig : opts.labels.notSig }
              ]),
              event.clientX,
              event.clientY
            );
          })
          .on('mouseleave', hideTip);
      });
    });
  });
}

// ============ 5. Stabilité selon l'année de départ ============
export function robustChart(el, rob, opts) {
  return mount(el, (svg, W, H, first) => {
    const m = { t: 22, r: 18, b: 34, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);
    const x = d3.scaleLinear().domain(d3.extent(rob, (d) => d.start)).range([0, iw]);
    const y = d3.scaleLinear().domain(niceExtent(rob.flatMap((d) => [d.lower, d.upper, 0]), 0.1)).nice().range([ih, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(() => '')).call((a) => a.selectAll('line').attr('stroke', COLOR.grid).attr('stroke-dasharray', '2 4')).call((a) => a.select('.domain').remove());
    styleAxis(g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10).tickFormat((v) => num(v, Math.abs(y.domain()[1]) < 2 ? 1 : 0))));
    styleAxis(g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.round(iw / 70))).tickSize(4).tickPadding(8).tickFormat(d3.format('d'))));
    svg.append('text').attr('x', 6).attr('y', 12).attr('fill', COLOR.mute).attr('font-size', 11.5).attr('font-weight', 600).text(`${opts.unit} / ${opts.perDecade}`);
    svg.append('text').attr('x', m.l + iw).attr('y', H - 4).attr('text-anchor', 'end').attr('fill', COLOR.mute).attr('font-size', 11.5).text(opts.xLabel);
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', COLOR.ink).attr('stroke-opacity', 0.35);
    g.append('path').attr('d', d3.area().x((d) => x(d.start)).y0((d) => y(d.lower)).y1((d) => y(d.upper)).curve(d3.curveMonotoneX)(rob)).attr('fill', opts.color).attr('opacity', 0.14);
    const pth = g.append('path').attr('d', d3.line().x((d) => x(d.start)).y((d) => y(d.slope)).curve(d3.curveMonotoneX)(rob)).attr('fill', 'none').attr('stroke', opts.color).attr('stroke-width', 2.8).attr('stroke-linecap', 'round');
    drawIn(pth, first, 900);
    g.selectAll('circle').data(rob).enter().append('circle').attr('cx', (d) => x(d.start)).attr('cy', (d) => y(d.slope)).attr('r', 4.4).attr('fill', (d) => (d.significant ? opts.color : PANEL)).attr('stroke', opts.color).attr('stroke-width', 2);
    const cur = rob.find((d) => d.start === opts.current);
    if (cur) {
      g.append('line').attr('x1', x(cur.start)).attr('x2', x(cur.start)).attr('y1', 0).attr('y2', ih).attr('stroke', COLOR.A).attr('stroke-dasharray', '4 4').attr('opacity', 0.6);
      g.append('text').attr('x', x(cur.start) + 6).attr('y', 10).attr('font-size', 11).attr('font-weight', 600).attr('fill', COLOR.A).text(opts.labels.chosen);
    }
    g.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, g.node());
        const d = d3.least(rob, (q) => Math.abs(x(q.start) - mx));
        showTip(
          tipRows(`${opts.labels.from} ${d.start}`, [
            { color: opts.color, label: opts.labels.slope, value: `${signed(d.slope, opts.decimals)} ${opts.unit}` },
            { label: opts.labels.ci, value: `[${signed(d.lower, opts.decimals)} ; ${signed(d.upper, opts.decimals)}]` },
            { label: opts.labels.verdict, value: d.significant ? opts.labels.sig : opts.labels.notSig }
          ]),
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', hideTip);
  });
}

// ============ Petite courbe pour la carte verdict ============
export function sparkline(el, annual, color) {
  const w = 120;
  const h = 34;
  const x = d3.scaleLinear().domain(d3.extent(annual, (d) => d.year)).range([2, w - 2]);
  const y = d3.scaleLinear().domain(d3.extent(annual, (d) => d.value)).range([h - 3, 3]);
  const d = d3.line().x((q) => x(q.year)).y((q) => y(q.value)).curve(d3.curveMonotoneX)(annual);
  el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".85"/></svg>`;
}
