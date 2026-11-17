// Minimal stand-in for the Claude dashboard runtime (dash.*), so the same page code runs on a plain website.
(function () {
  let sources = {};
  let status = 'loading';
  const calcs = {}, draws = {}, onDataFns = [];
  let defaults = {}, params = {};
  let cache = new Map();

  const calcVal = (id) => {
    if (cache.has(id)) return cache.get(id);
    const c = calcs[id];
    const args = c.inputs.map((i) => (i in sources ? sources[i] : calcs[i] ? calcVal(i) : []));
    let v;
    try { v = c.fn(...args); } catch (e) { console.error('calc ' + id, e); v = null; }
    cache.set(id, v);
    return v;
  };

  const render = () => {
    cache = new Map();
    for (const fn of onDataFns) { try { fn(); } catch (e) { console.error(e); } }
    for (const el of document.querySelectorAll('[data-draw]')) {
      if (el.parentElement && el.parentElement.closest('[hidden]')) continue;
      const d = draws[el.dataset.draw];
      if (!d) continue;
      try {
        if (d.mount && !el.__gdMounted) { el.__gdMade = d.mount(el); el.__gdMounted = true; }
        if (d.update) d.update(el, el.__gdMade);
      } catch (e) { console.error('draw ' + el.dataset.draw, e); }
    }
  };

  window.dash = {
    calc(id, o) { calcs[id] = o; },
    loader() {},
    draw(name, fn) {
      if (fn === undefined) { render(); return; }
      draws[name] = typeof fn === 'function' ? {update: fn} : fn;
    },
    onData(fn) { onDataFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params() { return {...params}; },
    setParams(p) {
      for (const k of Object.keys(p)) { if (p[k] == null) delete params[k]; else params[k] = p[k]; }
      render();
    },
    resetParams() { params = {...defaults}; render(); },
    setLink() {},
    refresh() {},
    colors: ['#2E4DB5', '#1FBCFF', '#F5A524', '#0EA57A', '#E0464E', '#94A3B8'],
    data(id) {
      if (id in sources) return {status: 'ok', data: sources[id], columns: sources[id][0] ? Object.keys(sources[id][0]) : []};
      if (calcs[id]) return status === 'ok' ? {status: 'ok', data: calcVal(id)} : {status, data: null};
      return {status, data: []};
    },
    // site-only: hand the decrypted data to the page
    _load(data, defaultParams) {
      sources = data; status = 'ok';
      defaults = {...defaultParams}; params = {...defaultParams};
      render();
    },
  };

  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (status === 'ok') render(); }, 150); });
})();
