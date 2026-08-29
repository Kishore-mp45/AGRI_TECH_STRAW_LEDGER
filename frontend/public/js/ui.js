/* ============================================================
   THE STRAW LEDGER — UI toolkit
   Icons, formatters, toasts, states, chart + map helpers.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.STRAW_LEDGER_CONFIG;

  /* ---------------- Inline SVG icon set ---------------- */
  const svg = (body, vb) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  const ICONS = {
    logo: svg('<path d="M12 22V8"/><path d="M12 8c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M12 8C12 5 10 3 7 3c0 3 2 5 5 5Z"/><path d="M12 15c0-2.6 1.8-4.4 4.4-4.4 0 2.6-1.8 4.4-4.4 4.4Z"/><path d="M12 15c0-2.6-1.8-4.4-4.4-4.4 0 2.6 1.8 4.4 4.4 4.4Z"/><path d="M7 22h10"/>'),
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    farmer: svg('<circle cx="12" cy="7" r="4"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M12 3V1.5"/>'),
    sprout: svg('<path d="M12 22v-9"/><path d="M12 13c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6Z"/><path d="M12 13c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6Z"/>'),
    leaf: svg('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
    route: svg('<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/>'),
    map: svg('<path d="M14.1 6 9.9 4 3.6 6.7A1 1 0 0 0 3 7.6v10.8a1 1 0 0 0 1.4.9L9.9 17l4.2 2 6.3-2.7a1 1 0 0 0 .6-.9V4.6a1 1 0 0 0-1.4-.9L14.1 6Z"/><path d="M9.9 4v13"/><path d="M14.1 6v13"/>'),
    ledger: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="m9 12 2 2 4-4"/>'),
    factory: svg('<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>'),
    layers: svg('<path d="m12 2 8.5 4.5-8.5 4.5L3.5 6.5 12 2Z"/><path d="m3.5 12 8.5 4.5L20.5 12"/><path d="m3.5 17.5 8.5 4.5 8.5-4.5"/>'),
    coins: svg('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>'),
    scale: svg('<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    refresh: svg('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    arrowRight: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    arrowUpRight: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
    chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
    menu: svg('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'),
    pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'),
    filter: svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"/>'),
    crosshair: svg('<circle cx="12" cy="12" r="10"/><path d="M22 12h-4"/><path d="M6 12H2"/><path d="M12 6V2"/><path d="M12 22v-4"/>'),
    package: svg('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
    flame: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.07-2.14 2.14-3.42 3.5-4.5.62 1.13 1.5 2.5 1.5 5a6.5 6.5 0 1 1-13 0c0-1.5.5-3 1.5-4 0 2 .5 3.5 2 4.5.35.23.85.5 1.5.5Z"/>'),
    ruler: svg('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>'),
    clipboard: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'),
    database: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'),
    cloud: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
    shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>')
  };

  /* ---------------- Formatters ---------------- */
  const locale = CFG.LOCALE || 'en-IN';
  const nf = (d) => new Intl.NumberFormat(locale, { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 });
  const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: CFG.CURRENCY || 'INR', maximumFractionDigits: 0 });

  const fmt = {
    num: (n, d) => (n == null || isNaN(n) ? '—' : nf(d).format(n)),
    tonnes: (n, d) => (n == null || isNaN(n) ? '—' : `${nf(d == null ? 1 : d).format(n)} t`),
    co2e: (n, d) => (n == null || isNaN(n) ? '—' : `${nf(d == null ? 1 : d).format(n)} tCO₂e`),
    money: (n) => (n == null || isNaN(n) ? '—' : moneyFmt.format(n)),
    moneyCompact: (n) => {
      if (n == null || isNaN(n)) return '—';
      const abs = Math.abs(n);
      if (abs >= 1e7) return `₹${nf(2).format(n / 1e7)} Cr`;
      if (abs >= 1e5) return `₹${nf(2).format(n / 1e5)} L`;
      return moneyFmt.format(n);
    },
    km: (n) => (n == null || isNaN(n) ? '—' : `${nf(1).format(n)} km`),
    date: (iso) => {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }); }
      catch (e) { return iso; }
    },
    dateTime: (iso) => {
      if (!iso) return '—';
      try {
        return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return iso; }
    }
  };

  /* ---------------- Badges & states ---------------- */
  function badge(status, label) {
    const s = String(status || '').toLowerCase();
    const cls = ['verified', 'pending', 'rejected', 'info'].includes(s) ? s : 'info';
    return `<span class="badge badge--${cls}">${label || s || 'unknown'}</span>`;
  }

  function stateHTML(kind, opts) {
    opts = opts || {};
    if (kind === 'loading') {
      return `<div class="state-block"><div class="spinner" style="width:26px;height:26px;color:var(--moss-600)"></div><p>${opts.message || 'Loading data from the platform…'}</p></div>`;
    }
    if (kind === 'error') {
      return `<div class="state-block state-block--error">
        <div class="state-block__icon">${ICONS.alert}</div>
        <h3>${opts.title || 'Unable to load data'}</h3>
        <p>${opts.message || 'The backend did not respond. Check the API connection and try again.'}</p>
        ${opts.retry !== false ? `<button class="btn btn--ghost btn--sm" data-retry style="margin-top:10px">${ICONS.refresh} Retry</button>` : ''}
      </div>`;
    }
    return `<div class="state-block">
      <div class="state-block__icon">${opts.icon ? ICONS[opts.icon] : ICONS.database}</div>
      <h3>${opts.title || 'Nothing here yet'}</h3>
      <p>${opts.message || 'Records will appear here as soon as they are registered.'}</p>
      ${opts.action || ''}
    </div>`;
  }

  function mountState(el, kind, opts) {
    if (!el) return;
    el.innerHTML = stateHTML(kind, opts);
    const retryBtn = el.querySelector('[data-retry]');
    if (retryBtn && opts && typeof opts.onRetry === 'function') {
      retryBtn.addEventListener('click', opts.onRetry);
    }
  }

  /* ---------------- Toasts ---------------- */
  function toast(message, type) {
    const root = document.getElementById('toastRoot') || (() => {
      const d = document.createElement('div'); d.className = 'toast-root'; d.id = 'toastRoot';
      document.body.appendChild(d); return d;
    })();
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ` toast--${type}` : '');
    const icon = type === 'error' ? ICONS.alert : type === 'warn' ? ICONS.info : ICONS.check;
    t.innerHTML = `${icon}<span>${message}</span>`;
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3600);
    setTimeout(() => t.remove(), 4000);
  }

  /* ---------------- Count-up animation ---------------- */
  function countUp(el, value, formatter, duration) {
    if (!el) return;
    if (value == null || isNaN(value)) { el.textContent = '—'; return; }
    const dur = duration || 750;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatter ? formatter(value * eased) : nf(0).format(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- Scroll reveal ---------------- */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------------- Chart.js helpers ---------------- */
  const chartInstances = new Map();
  function chartPalette() {
    const cs = getComputedStyle(document.documentElement);
    return {
      ink: cs.getPropertyValue('--ink-500').trim() || '#5a6e60',
      grid: cs.getPropertyValue('--line-200').trim() || '#e3e8db',
      pine: cs.getPropertyValue('--pine-800').trim() || '#173624',
      leaf: cs.getPropertyValue('--leaf-500').trim() || '#3f7d53',
      leafLight: cs.getPropertyValue('--leaf-200').trim() || '#bfdcc5',
      straw: cs.getPropertyValue('--straw-500').trim() || '#d9a441',
      strawDark: cs.getPropertyValue('--straw-700').trim() || '#97701f',
      rust: cs.getPropertyValue('--rust-600').trim() || '#a6402c',
      sky: cs.getPropertyValue('--sky-600').trim() || '#2f6f8f'
    };
  }

  function createChart(canvasId, buildConfig) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof window.Chart === 'undefined') return null;
    if (chartInstances.has(canvasId)) { chartInstances.get(canvasId).destroy(); chartInstances.delete(canvasId); }
    const pal = chartPalette();
    if (window.Chart.defaults) {
      window.Chart.defaults.font.family = "'Archivo', sans-serif";
      window.Chart.defaults.font.size = 11.5;
      window.Chart.defaults.color = pal.ink;
    }
    const chart = new window.Chart(canvas, buildConfig(pal));
    chartInstances.set(canvasId, chart);
    return chart;
  }
  function destroyChart(canvasId) {
    if (chartInstances.has(canvasId)) { chartInstances.get(canvasId).destroy(); chartInstances.delete(canvasId); }
  }

  /* Shared tooltip look */
  function tooltipStyle(pal) {
    return {
      backgroundColor: pal.pine, titleColor: '#fff', bodyColor: '#dbe8dc',
      padding: 11, cornerRadius: 8, displayColors: true, boxPadding: 4,
      titleFont: { family: "'Archivo', sans-serif", weight: '600' }
    };
  }

  /* ---------------- MapLibre / OpenFreeMap helpers ---------------- */
  let mapStyleInjected = false;
  function ensureMapCss() {
    if (mapStyleInjected || document.getElementById('maplibreCss')) return;
    const l = document.createElement('link');
    l.id = 'maplibreCss'; l.rel = 'stylesheet';
    l.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    document.head.appendChild(l);
    mapStyleInjected = true;
  }

  function createMap(containerId, opts) {
    ensureMapCss();
    return new Promise((resolve, reject) => {
      if (typeof window.maplibregl === 'undefined') {
        reject(new Error('MapLibre GL not loaded'));
        return;
      }
      opts = opts || {};
      const map = new window.maplibregl.Map({
        container: containerId,
        style: CFG.MAP_STYLE,
        center: opts.center || CFG.MAP_CENTER,
        zoom: opts.zoom != null ? opts.zoom : CFG.MAP_ZOOM,
        attributionControl: { compact: true }
      });
      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.once('load', () => resolve(map));
      map.once('error', () => reject(new Error('Map failed to load')));
    });
  }

  function fitPoints(map, points, padding) {
    if (!points || points.length === 0) return;
    if (points.length === 1) { map.easeTo({ center: points[0], zoom: 11.5 }); return; }
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      new window.maplibregl.LngLatBounds(points[0], points[0])
    );
    map.fitBounds(bounds, { padding: padding || 70, duration: 900, maxZoom: 12.5 });
  }

  function circlePolygon(lng, lat, radiusKm, segments) {
    const n = segments || 64;
    const coords = [];
    const distRadians = radiusKm / 6371;
    const latR = (lat * Math.PI) / 180;
    const lngR = (lng * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const brg = (2 * Math.PI * i) / n;
      const pLat = Math.asin(Math.sin(latR) * Math.cos(distRadians) + Math.cos(latR) * Math.sin(distRadians) * Math.cos(brg));
      const pLng = lngR + Math.atan2(Math.sin(brg) * Math.sin(distRadians) * Math.cos(latR), Math.cos(distRadians) - Math.sin(latR) * Math.sin(pLat));
      coords.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI]);
    }
    coords.push(coords[0]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
  }

  function markerEl(kind, extraClass) {
    const el = document.createElement('div');
    el.className = `mk mk--${kind}` + (extraClass ? ' ' + extraClass : '');
    const icon = kind === 'zone' ? ICONS.layers : kind === 'facility' ? ICONS.factory : ICONS.pin;
    el.innerHTML = icon;
    return el;
  }

  function popupHTML(title, rows) {
    const body = rows
      .filter((r) => r[1] != null && r[1] !== '')
      .map((r) => `<div class="pp-row"><span>${r[0]}</span><b style="font-family:var(--font-body);font-size:0.8rem">${r[1]}</b></div>`)
      .join('');
    return `<div class="map-popup"><b>${title}</b>${body}</div>`;
  }

  /* ---------------- Public ---------------- */
  window.StrawLedgerUI = {
    ICONS, fmt, badge, stateHTML, mountState, toast, countUp, initReveal,
    createChart, destroyChart, chartPalette, tooltipStyle,
    createMap, fitPoints, circlePolygon, markerEl, popupHTML
  };
})();
