// ---------- shared helpers (GD brand look) ----------
window.gdFmt = (v, kind) => {
  if (v == null || v === '') return '—';
  if (kind === 'int') return d3.format(',')(v);
  if (kind === 'pct') return d3.format('.1f')(v) + '%';
  if (kind === 'lakh') return '₹' + d3.format('.2f')(v) + ' L';
  if (kind === 'dec2') return d3.format('.2f')(v);
  if (kind === 'date') return d3.utcFormat('%-d %b %Y')(new Date(v + 'T00:00:00Z'));
  return String(v);
};
window.GD_GROUPS = ['Sale', 'Visit / Booked', 'Follow-up pending', 'Not reached', 'Lost', 'Junk', 'Not called yet'];
window.GD_GROUP_COLOR = {'Sale': '#0EA57A', 'Visit / Booked': '#2E4DB5', 'Follow-up pending': '#379EFF', 'Not reached': '#F5A524',
  'Lost': '#E0464E', 'Junk': '#94A3B8', 'Not called yet': '#D5DEEA', 'Unmapped': '#B9C4D3'};
window.gdGroupColor = (g) => window.GD_GROUP_COLOR[g] || '#B9C4D3';
window.GD_PLATFORMS = ['Google Ads', 'Meta Ads', 'Non-paid'];
window.GD_PLATFORM_COLOR = {'Google Ads': '#1FBCFF', 'Meta Ads': '#2E4DB5', 'Non-paid': '#F5A524'};
window.gdPlatformColor = (s) => window.GD_PLATFORM_COLOR[s] || '#94A3B8';
window.gdMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
window.gdDrawn = window.gdDrawn || {};
window.gdFirst = (key) => { const f = !window.gdDrawn[key]; window.gdDrawn[key] = true; return f && window.gdMotion(); };
window.gdPickChannel = (c) => dash.setParams({channel: dash.params().channel === c ? '' : c});

window.gdTip = (box) => {
  const tip = document.createElement('div');
  tip.className = 'gd-tip'; tip.hidden = true; box.appendChild(tip);
  return {
    show(lines, x, y) {
      tip.replaceChildren(...lines.map((l) => {
        const d = document.createElement('div');
        if (Array.isArray(l)) { const s = document.createElement('span'); s.textContent = l[0] + '  '; d.append(s, document.createTextNode(l[1])); }
        else d.textContent = l;
        return d;
      }));
      tip.hidden = false;
      const bw = box.clientWidth, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(bw - tw, x + 14)) + 'px';
      tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + 'px';
    },
    hide() { tip.hidden = true; },
  };
};

window.gdTextWidth = (svg, texts) => {
  const g = svg.append('g');
  const w = d3.max(texts.map((t) => g.append('text').text(t).node().getComputedTextLength())) || 0;
  g.remove();
  return w || 7 * (d3.max(texts.map((t) => String(t).length)) || 1);
};

// weekly area/line chart. rows {week, platform, leads, sales}; metric leads | sales | conv
window.gdWeekly = (el, rows, metric) => {
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), H = 260, top = 12, bottom = 28;
  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  if (!weeks.length) { el.textContent = 'No leads for this source.'; return; }
  const by = new Map(rows.map((r) => [r.week + '|' + r.platform, r]));
  const val = (w, s) => { const r = by.get(w + '|' + s); if (!r) return metric === 'conv' ? null : 0; return metric === 'conv' ? (r.leads ? (r.sales / r.leads) * 100 : null) : r[metric]; };
  const series = window.GD_PLATFORMS.filter((s) => rows.some((r) => r.platform === s));
  const fmtV = metric === 'conv' ? (v) => (v == null ? '—' : d3.format('.1f')(v) + '%') : d3.format(',');
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
    .attr('aria-label', 'Weekly ' + (metric === 'conv' ? 'lead to sale rate' : metric) + ' by platform');
  const ymax = d3.max(weeks.flatMap((w) => series.map((s) => val(w, s) || 0))) || 1;
  const y = d3.scaleLinear().domain([0, ymax]).nice().range([H - bottom, top]);
  const ticks = y.ticks(4);
  const mL = window.gdTextWidth(svg, ticks.map(fmtV)) + 12;
  const x = d3.scalePoint().domain(weeks).range([mL, W - 12]);
  svg.append('g').attr('class', 'grid').selectAll('line').data(ticks).join('line').attr('x1', mL).attr('x2', W - 12).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', mL - 8).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fmtV);
  const fmtW = d3.utcFormat('%-d %b');
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(2, Math.floor((W - mL) / 70))));
  svg.append('g').selectAll('text').data(weeks.filter((w, i) => i % every === 0)).join('text').attr('x', (d) => x(d)).attr('y', H - 8).attr('text-anchor', 'middle').text((d) => fmtW(new Date(d + 'T00:00:00Z')));
  const defs = svg.append('defs');
  const anim = window.gdFirst('weekly-' + metric);
  series.forEach((s, i) => {
    const id = 'gdx-grad-' + i;
    const g = defs.append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    g.append('stop').attr('offset', '0%').attr('stop-color', window.gdPlatformColor(s)).attr('stop-opacity', 0.28);
    g.append('stop').attr('offset', '100%').attr('stop-color', window.gdPlatformColor(s)).attr('stop-opacity', 0);
    const pts = weeks.map((w) => [x(w), val(w, s)]).filter((p) => p[1] != null).map((p) => [p[0], y(p[1])]);
    if (metric !== 'conv') svg.append('path').attr('d', d3.area().x((d) => d[0]).y0(y(0)).y1((d) => d[1])(pts)).attr('fill', `url(#${id})`);
    const line = svg.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', window.gdPlatformColor(s)).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round');
    if (anim) { const L = line.node().getTotalLength(); line.attr('stroke-dasharray', L).attr('stroke-dashoffset', L).transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0); }
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (d) => d[0]).attr('cy', (d) => d[1]).attr('r', 3).attr('fill', '#fff').attr('stroke', window.gdPlatformColor(s)).attr('stroke-width', 2);
  });
  const rule = svg.append('line').attr('class', 'rule').attr('y1', top).attr('y2', H - bottom).style('display', 'none');
  const tip = window.gdTip(el);
  svg.append('rect').attr('x', mL).attr('y', 0).attr('width', Math.max(1, W - 12 - mL)).attr('height', H - bottom).attr('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [mx] = d3.pointer(ev);
      const step = (W - 12 - mL) / Math.max(1, weeks.length - 1);
      const w = weeks[Math.max(0, Math.min(weeks.length - 1, Math.round((mx - mL) / step)))];
      rule.style('display', null).attr('x1', x(w)).attr('x2', x(w));
      tip.show(['Week of ' + fmtW(new Date(w + 'T00:00:00Z')), ...series.map((s) => [s, fmtV(val(w, s))])], x(w) * (el.clientWidth / W), 30);
    })
    .on('pointerleave', () => { rule.style('display', 'none'); tip.hide(); });
};

// 100% stacked horizontal bars. rows {cat, group, count, share, total}
window.gdStack = (el, rows, cats, groups, label, unit, onPick, selected) => {
  el.replaceChildren();
  if (!rows.length) { el.textContent = 'Nothing to show for this choice.'; return; }
  const W = Math.max(280, el.clientWidth), bh = 24, gap = 10;
  const H = cats.length * (bh + gap);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const totals = new Map(rows.map((r) => [r.cat, r.total]));
  const catLabel = (c) => c + '  ' + d3.format(',')(totals.get(c) || 0);
  const mL = Math.min(W * 0.42, window.gdTextWidth(svg, cats.map(catLabel)) + 14);
  const x = d3.scaleLinear().domain([0, 100]).range([mL, W - 2]);
  const tip = window.gdTip(el);
  const anim = window.gdFirst('stack-' + label);
  cats.forEach((c, i) => {
    const yy = i * (bh + gap);
    const g = svg.append('g').attr('class', onPick ? 'hit' : null).attr('opacity', selected && selected !== c ? 0.35 : 1);
    if (onPick) g.on('click', () => onPick(c));
    g.append('text').attr('class', selected === c ? 'lbl-strong' : null).attr('x', mL - 10).attr('y', yy + bh / 2).attr('dy', '0.32em').attr('text-anchor', 'end').text(catLabel(c));
    const clip = 'gdx-clip-' + label.replace(/\W/g, '') + i;
    svg.append('clipPath').attr('id', clip).append('rect').attr('x', mL).attr('y', yy).attr('width', W - 2 - mL).attr('height', bh).attr('rx', bh / 2);
    const bars = g.append('g').attr('clip-path', `url(#${clip})`);
    let acc = 0;
    for (const grp of groups) {
      const r = rows.find((d) => d.cat === c && d.group === grp);
      if (!r) continue;
      const x0 = x(acc), x1 = x(acc + r.share);
      acc += r.share;
      const rect = bars.append('rect').attr('x', x0).attr('y', yy).attr('height', bh).attr('fill', window.gdGroupColor(grp))
        .attr('width', anim ? 0 : Math.max(0, x1 - x0 - 1.5))
        .on('pointermove', (ev) => { const [mx, my] = d3.pointer(ev, el); tip.show([c, [grp, d3.format(',')(r.count) + ' ' + unit + ' · ' + d3.format('.1f')(r.share) + '%']], mx, my); })
        .on('pointerleave', () => tip.hide());
      if (anim) rect.transition().delay(i * 40).duration(700).ease(d3.easeCubicOut).attr('width', Math.max(0, x1 - x0 - 1.5));
      if (x1 - x0 > 34) g.append('text').attr('class', 'lbl-in').attr('x', (x0 + x1) / 2).attr('y', yy + bh / 2).attr('dy', '0.32em').attr('text-anchor', 'middle').attr('pointer-events', 'none').text(Math.round(r.share) + '%');
    }
  });
};

// stacked columns. rows {cat, group, count}
window.gdCols = (el, rows, cats, groups, label) => {
  el.replaceChildren();
  if (!rows.length) { el.textContent = 'No open leads for this choice.'; return; }
  const W = Math.max(280, el.clientWidth), H = 230, top = 22, bottom = 26;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const tot = new Map(cats.map((c) => [c, d3.sum(rows.filter((r) => r.cat === c), (r) => r.count)]));
  const y = d3.scaleLinear().domain([0, d3.max([...tot.values()]) || 1]).range([H - bottom, top]);
  const x = d3.scaleBand().domain(cats).range([4, W - 4]).padding(0.3);
  const tip = window.gdTip(el);
  const anim = window.gdFirst('cols');
  cats.forEach((c, ci) => {
    let acc = 0;
    const segs = groups.map((g) => rows.find((d) => d.cat === c && d.group === g)).filter(Boolean);
    segs.forEach((r, si) => {
      const y0 = y(acc), y1 = y(acc + r.count);
      acc += r.count;
      const rect = svg.append('rect').attr('x', x(c)).attr('width', x.bandwidth()).attr('fill', window.gdGroupColor(r.group))
        .attr('rx', si === segs.length - 1 ? 6 : 0)
        .attr('y', anim ? H - bottom : y1).attr('height', anim ? 0 : Math.max(0, y0 - y1 - 1))
        .on('pointermove', (ev) => { const [mx, my] = d3.pointer(ev, el); tip.show([c, [r.group, d3.format(',')(r.count) + ' leads']], mx, my); })
        .on('pointerleave', () => tip.hide());
      if (anim) rect.transition().delay(ci * 60).duration(700).ease(d3.easeCubicOut).attr('y', y1).attr('height', Math.max(0, y0 - y1 - 1));
    });
    svg.append('text').attr('class', 'lbl-strong').attr('x', x(c) + x.bandwidth() / 2).attr('y', y(tot.get(c)) - 7).attr('text-anchor', 'middle').text(d3.format(',')(tot.get(c)));
    svg.append('text').attr('x', x(c) + x.bandwidth() / 2).attr('y', H - 7).attr('text-anchor', 'middle').text(c);
  });
};

// two-column flow: from groups (left) to groups (right), ribbon width = leads moved. rows {from_group,to_group,changes}
window.gdFlow = (el, rows) => {
  el.replaceChildren();
  if (!rows.length) return;
  const W = Math.max(280, el.clientWidth), pad = 8, gapN = 10, nodeW = 12;
  const total = d3.sum(rows, (r) => r.changes);
  const order = window.GD_GROUPS.concat(['Unmapped']);
  const sortG = (a, b) => order.indexOf(a) - order.indexOf(b);
  const froms = [...new Set(rows.map((r) => r.from_group))].sort(sortG), tos = [...new Set(rows.map((r) => r.to_group))].sort(sortG);
  const H = Math.max(180, Math.max(froms.length, tos.length) * 46);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Flow of status changes from one status group to another');
  const lab = (g, side) => g + '  ' + d3.format(',')(d3.sum(rows.filter((r) => r[side] === g), (r) => r.changes));
  const wL = window.gdTextWidth(svg, froms.map((g) => lab(g, 'from_group'))) + 10, wR = window.gdTextWidth(svg, tos.map((g) => lab(g, 'to_group'))) + 10;
  const xL = Math.min(W * 0.4, wL), xR = Math.max(W * 0.6, W - wR - nodeW);
  const place = (list, side) => {
    const usable = H - pad * 2 - gapN * (list.length - 1), k = usable / total, pos = new Map();
    let yy = pad;
    for (const g of list) { const v = d3.sum(rows.filter((r) => r[side] === g), (r) => r.changes); pos.set(g, {y: yy, h: Math.max(2, v * k), off: 0}); yy += v * k + gapN; }
    return {pos, k};
  };
  const L = place(froms, 'from_group'), R = place(tos, 'to_group');
  const tip = window.gdTip(el);
  const anim = window.gdFirst('flow');
  const sorted = rows.slice().sort((a, b) => sortG(a.from_group, b.from_group) || sortG(a.to_group, b.to_group));
  for (const r of sorted) {
    const a = L.pos.get(r.from_group), b = R.pos.get(r.to_group), h = r.changes * L.k;
    const y0 = a.y + a.off, y1 = b.y + b.off; a.off += h; b.off += h;
    const x0 = xL + nodeW, x1 = xR, mx = (x0 + x1) / 2;
    const d = `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z`;
    const p = svg.append('path').attr('d', d).attr('fill', window.gdGroupColor(r.to_group)).attr('fill-opacity', anim ? 0 : 0.38)
      .on('pointermove', (ev) => { d3.select(ev.currentTarget).attr('fill-opacity', 0.65); const [px, py] = d3.pointer(ev, el); tip.show([r.from_group + ' → ' + r.to_group, ['Leads', d3.format(',')(r.changes) + ' · ' + d3.format('.1f')((r.changes / total) * 100) + '%']], px, py); })
      .on('pointerleave', (ev) => { d3.select(ev.currentTarget).attr('fill-opacity', 0.38); tip.hide(); });
    if (anim) p.transition().duration(800).attr('fill-opacity', 0.38);
  }
  for (const [g, v] of L.pos) {
    svg.append('rect').attr('x', xL).attr('y', v.y).attr('width', nodeW).attr('height', v.h).attr('rx', 3).attr('fill', window.gdGroupColor(g));
    svg.append('text').attr('class', 'lbl-strong').attr('x', xL - 6).attr('y', v.y + v.h / 2).attr('dy', '0.32em').attr('text-anchor', 'end').text(lab(g, 'from_group'));
  }
  for (const [g, v] of R.pos) {
    svg.append('rect').attr('x', xR).attr('y', v.y).attr('width', nodeW).attr('height', v.h).attr('rx', 3).attr('fill', window.gdGroupColor(g));
    svg.append('text').attr('class', 'lbl-strong').attr('x', xR + nodeW + 6).attr('y', v.y + v.h / 2).attr('dy', '0.32em').text(lab(g, 'to_group'));
  }
};

// ---------- controls ----------
const gdSyncControls = () => {
  const p = dash.params();
  for (const b of document.querySelectorAll('.gdx-seg button[data-range]')) b.classList.toggle('on', b.dataset.range === (p.range || '35'));
  for (const b of document.querySelectorAll('.gdx-mtog button[data-metric]')) b.classList.toggle('on', b.dataset.metric === (p.metric || 'leads'));
  for (const s of document.querySelectorAll('#f-channel')) if (document.activeElement !== s) s.value = p.channel || '';
};
for (const b of document.querySelectorAll('.gdx-seg button[data-range]')) b.addEventListener('click', () => { dash.setParams({range: b.dataset.range}); gdSyncControls(); });
for (const b of document.querySelectorAll('.gdx-mtog button[data-metric]')) b.addEventListener('click', () => { dash.setParams({metric: b.dataset.metric}); gdSyncControls(); });
for (const s of document.querySelectorAll('#f-channel')) s.addEventListener('change', () => { dash.setParams({channel: s.value}); gdSyncControls(); });
for (const sw of document.querySelectorAll('.gd-sw[data-group]')) sw.style.background = window.gdGroupColor(sw.dataset.group);
for (const sw of document.querySelectorAll('.gd-sw[data-platform]')) sw.style.background = window.gdPlatformColor(sw.dataset.platform);
gdSyncControls();

dash.onData(() => {
  gdSyncControls();
  const t = dash.data('transitions');
  const empty = t.status === 'ok' && (!t.data || t.data.length === 0);
  for (const el of document.querySelectorAll('#changes-empty')) el.hidden = !empty;
  for (const el of document.querySelectorAll('#changes-wrap')) el.hidden = empty;
});

// ---------- drawings ----------
dash.draw('val', (el) => {
  const d = dash.data(el.dataset.source);
  const row = d.status === 'ok' && Array.isArray(d.data) ? d.data[Number(el.dataset.row || 0)] : null;
  el.textContent = row ? window.gdFmt(row[el.dataset.field], el.dataset.fmt) : '—';
});

dash.draw('delta', (el) => {
  const d = dash.data('kpi');
  const row = d.status === 'ok' && d.data ? d.data[0] : null;
  const v = row ? row[el.dataset.field] : null;
  el.classList.remove('gd-good', 'gd-bad');
  if (v == null) { el.textContent = dash.params().range === 'all' ? '' : '—'; el.hidden = dash.params().range === 'all'; return; }
  el.hidden = false;
  el.textContent = (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '± ') + Math.abs(v) + el.dataset.unit;
  if (v !== 0) el.classList.add((v > 0) === (el.dataset.good === 'up') ? 'gd-good' : 'gd-bad');
});

dash.draw('period', (el) => {
  const r = dash.params().range;
  el.textContent = r === 'all' ? 'all time' : 'vs previous ' + r + ' days';
});

dash.draw('filter-chip', (el) => {
  const c = dash.params().channel;
  if (!c) { el.replaceChildren(); return; }
  const names = {paid: 'Paid media', google: 'Google Ads (all)'};
  const chip = document.createElement('span'); chip.className = 'gdx-chip';
  chip.append(document.createTextNode('Filtered: ' + (names[c] || c)));
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Clear ✕';
  b.onclick = () => { dash.setParams({channel: ''}); gdSyncControls(); };
  chip.append(b); el.replaceChildren(chip);
});

dash.draw('spark', (el) => {
  const d = dash.data('weekly');
  const s = d3.select(el); s.selectAll('*').remove();
  if (d.status !== 'ok' || !d.data.length) return;
  const k = el.dataset.key;
  const wk = d3.rollups(d.data, (v) => d3.sum(v, (r) => r[k]), (r) => r.week).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-13, -1);
  if (wk.length < 2) return;
  const W = 76, H = 30, x = d3.scaleLinear().domain([0, wk.length - 1]).range([2, W - 2]), y = d3.scaleLinear().domain([0, d3.max(wk, (w) => w[1]) || 1]).range([H - 2, 3]);
  s.attr('viewBox', `0 0 ${W} ${H}`);
  s.append('path').attr('d', d3.area().x((w, i) => x(i)).y0(H).y1((w) => y(w[1]))(wk)).attr('fill', '#379EFF').attr('fill-opacity', 0.14);
  s.append('path').attr('d', d3.line().x((w, i) => x(i)).y((w) => y(w[1]))(wk)).attr('fill', 'none').attr('stroke', '#2E4DB5').attr('stroke-width', 1.8);
  const last = wk[wk.length - 1];
  s.append('circle').attr('cx', x(wk.length - 1)).attr('cy', y(last[1])).attr('r', 2.5).attr('fill', '#2E4DB5');
});

const gdTable = (src, fields, fmts, opts = {}) => (tbody) => {
  const d = dash.data(src);
  if (d.status !== 'ok' || !d.data) { tbody.replaceChildren(); return; }
  const sel = dash.params().channel;
  const maxLeads = d3.max(d.data.filter((r) => r[fields[0]] !== opts.totalKey), (r) => r.leads) || 1;
  tbody.replaceChildren(...d.data.map((r) => {
    const tr = document.createElement('tr');
    const key = r[fields[0]];
    tr.dataset.key = encodeURIComponent(key);
    if (opts.totalKey && key === opts.totalKey) tr.className = 'gd-total';
    else if (opts.pick) { tr.className = 'click' + (sel === key ? ' sel' : ''); tr.onclick = () => window.gdPickChannel(key); }
    fields.forEach((f, i) => {
      const td = document.createElement('td');
      if (i === 0) {
        if (opts.avatar) { const a = document.createElement('span'); a.className = 'gdx-av'; a.textContent = String(key).slice(0, 2).toUpperCase(); td.append(a); }
        if (opts.dot) { const dot = document.createElement('span'); dot.className = 'gdx-dot'; dot.style.background = window.gdPlatformColor(String(key).startsWith('Google') ? 'Google Ads' : key === 'Meta' ? 'Meta Ads' : 'Non-paid'); if (key !== opts.totalKey) td.append(dot); }
        td.append(document.createTextNode(String(key)));
      } else {
        td.append(document.createTextNode(window.gdFmt(r[f], fmts[i])));
        if (f === 'leads' && opts.bars && key !== opts.totalKey) { const b = document.createElement('span'); b.className = 'gdx-bar'; b.style.width = Math.round((r.leads / maxLeads) * 60) + 'px'; td.append(b); }
        if (f === 'stale_open' && r[f] > 0) td.className = 'gdx-hot';
      }
      tr.appendChild(td);
    });
    return tr;
  }));
};

dash.draw('source-table', gdTable('by_channel',
  ['channel', 'leads', 'contact_rate', 'booked', 'sales', 'conv', 'revenue_lakh', 'junk_rate', 'repeat_rate'],
  ['text', 'int', 'pct', 'int', 'int', 'pct', 'dec2', 'pct', 'pct'], {totalKey: 'All sources', pick: true, bars: true, dot: true}));

dash.draw('caller-table', gdTable('callers',
  ['caller', 'leads', 'contact_rate', 'booked', 'sales', 'conv', 'revenue_lakh', 'open_now', 'stale_open'],
  ['text', 'int', 'pct', 'int', 'int', 'pct', 'dec2', 'int', 'int'], {avatar: true, bars: true}));

dash.draw('quality-table', gdTable('quality', ['check', 'rows'], ['text', 'int']));

dash.draw('transition-table', (tbody) => {
  const d = dash.data('transitions');
  if (d.status !== 'ok' || !d.data) { tbody.replaceChildren(); return; }
  tbody.replaceChildren(...d.data.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = encodeURIComponent(r.move);
    [[r.from_group, 'text', true], [r.to_group, 'text', true], [r.changes, 'int'], [r.share, 'pct']].forEach(([v, f, dot]) => {
      const td = document.createElement('td');
      if (dot) { const s = document.createElement('span'); s.className = 'gdx-dot'; s.style.background = window.gdGroupColor(v); td.append(s); }
      td.append(document.createTextNode(window.gdFmt(v, f))); tr.appendChild(td);
    });
    return tr;
  }));
});

dash.draw('weekly', (el) => {
  const d = dash.data('weekly');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  window.gdWeekly(el, d.data, dash.params().metric || 'leads');
});

dash.draw('status-mix', (el) => {
  const d = dash.data('status_mix');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const tot = new Map(d.data.map((r) => [r.channel, r.channel_leads]));
  const cats = [...tot.keys()].sort((a, b) => tot.get(b) - tot.get(a));
  const sel = dash.params().channel;
  window.gdStack(el, d.data.map((r) => ({cat: r.channel, group: r.group, count: r.leads, share: r.share, total: r.channel_leads})),
    cats, window.GD_GROUPS, 'Share of each source\'s leads in each status group', 'leads', window.gdPickChannel, cats.includes(sel) ? sel : null);
});

dash.draw('flow', (el) => {
  const d = dash.data('transitions');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  window.gdFlow(el, d.data);
});

dash.draw('backlog', (el) => {
  const d = dash.data('backlog_age');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  window.gdCols(el, d.data.map((r) => ({cat: r.age, group: r.group, count: r.leads})),
    ['0-3 days', '4-7 days', '8-14 days', '15-30 days', '30+ days'], ['Not called yet', 'Not reached', 'Follow-up pending'],
    'Open leads by days since their status last changed');
});

dash.draw('refollow-mix', (el) => {
  const d = dash.data('refollow_mix');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const cats = [...new Set(d.data.map((r) => r.recaller))].sort();
  window.gdStack(el, d.data.map((r) => ({cat: r.recaller, group: r.outcome_group, count: r.calls, share: r.share, total: r.recaller_calls})),
    cats, window.GD_GROUPS, 'Outcome of logged re-follow-up calls by caller', 'calls');
});

// ---------- weekly re-follow-up view ----------
const gdWeekLabel = (w) => d3.utcFormat('%-d %b')(new Date(w + 'T00:00:00Z'));

dash.onData(() => {
  const d = dash.data('wk_changes');
  const empty = d.status === 'ok' && (!d.data || d.data.every((r) => r.changes === 0));
  for (const el of document.querySelectorAll('#wk-empty')) el.hidden = !empty;
});

dash.draw('wk-delta', (el) => {
  const d = dash.data('wk_kpi');
  const row = d.status === 'ok' && d.data ? d.data[0] : null;
  el.classList.remove('gd-good', 'gd-bad');
  const f = el.dataset.field, prev = row ? row['prev_' + f] : null;
  if (!row || prev == null) { el.textContent = '—'; return; }
  const diff = row[f] - prev;
  el.textContent = (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '± ') + d3.format(',')(Math.abs(diff));
  if (diff !== 0) el.classList.add((diff > 0) === (el.dataset.good === 'up') ? 'gd-good' : 'gd-bad');
});

dash.draw('wk-chart', (el) => {
  const d = dash.data('wk_changes');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const wk = d.data.slice(0, 10).reverse();
  if (!wk.some((r) => r.changes)) { el.replaceChildren(); el.textContent = 'No status changes seen yet.'; return; }
  const rows = wk.flatMap((r) => [
    {cat: gdWeekLabel(r.week), group: 'Visit / Booked', count: r.to_booked},
    {cat: gdWeekLabel(r.week), group: 'Follow-up pending', count: r.still_open},
    {cat: gdWeekLabel(r.week), group: 'Lost', count: r.to_lost},
  ]).filter((r) => r.count > 0);
  window.gdCols(el, rows, wk.map((r) => gdWeekLabel(r.week)), ['Visit / Booked', 'Follow-up pending', 'Lost'], 'Status changes per week by where the lead moved to');
});

dash.draw('wk-table', (tbody) => {
  const d = dash.data('wk_changes');
  if (d.status !== 'ok' || !d.data) { tbody.replaceChildren(); return; }
  tbody.replaceChildren(...d.data.map((r, i) => {
    const tr = document.createElement('tr');
    tr.dataset.key = encodeURIComponent(r.week);
    [[gdWeekLabel(r.week) + (i === 0 ? ' (this week)' : ''), 'text'], [r.changes, 'int'], [r.to_booked, 'int'], [r.to_lost, 'int'], [r.still_open, 'int'], [r.win_rate, 'pct']]
      .forEach(([v, f]) => { const td = document.createElement('td'); td.textContent = window.gdFmt(v, f); tr.appendChild(td); });
    return tr;
  }));
});

dash.draw('wk-caller-table', gdTable('wk_callers',
  ['caller', 'this_changes', 'this_booked', 'last_changes', 'last_booked', 'open_now', 'stale_open'],
  ['text', 'int', 'int', 'int', 'int', 'int', 'int'], {avatar: true}));

dash.draw('wk-refollow', (el) => {
  const d = dash.data('wk_refollow');
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const weeks = [...new Set(d.data.map((r) => r.week))].sort();
  if (!weeks.length) { el.replaceChildren(); el.textContent = 'No re-follow-up calls logged in the sheet yet.'; return; }
  window.gdCols(el, d.data.map((r) => ({cat: gdWeekLabel(r.week), group: r.outcome_group, count: r.calls})),
    weeks.map(gdWeekLabel), window.GD_GROUPS, 'Logged re-follow-up calls by lead week and outcome');
});
