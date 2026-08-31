/* ============================================================
   THE STRAW LEDGER — Landing / entry page logic
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  const FLOW_STAGES = [
    { key: 'farmers', icon: 'farmer', name: 'Farmer', meta: 'Onboarded with plot & contact' },
    { key: 'batches', icon: 'package', name: 'Straw Batch', meta: 'Volume · moisture · harvest window' },
    { key: 'zones', icon: 'layers', name: 'Collection Zone', meta: 'Geographic aggregation hub' },
    { key: 'facilities', icon: 'factory', name: 'Pyrolysis Facility', meta: 'Conversion to biochar' },
    { key: 'carbon', icon: 'leaf', name: 'Carbon & Economics', meta: 'CO₂e · value · margin · payout' },
    { key: 'mrv', icon: 'ledger', name: 'MRV Ledger', meta: 'Auditable verification record' }
  ];

  const CAPABILITIES = [
    {
      icon: 'farmer', title: 'Farmer Onboarding',
      text: 'Field-ready registration of farmers, plot coordinates, straw volume and harvest timing — issuing a tracked batch ID on the spot.',
      link: 'pages/farmer-onboarding.html', linkLabel: 'Open onboarding'
    },
    {
      icon: 'route', title: 'Feedstock Aggregation & Routing',
      text: 'Nearby-batch discovery around any plot, radius-based grouping into local straw clusters, and zone-to-facility routing with distances.',
      link: 'pages/collection-routing.html', linkLabel: 'Open routing'
    },
    {
      icon: 'leaf', title: 'Carbon & Economics',
      text: 'The full conversion math per batch and in aggregate — collected straw, biochar yield, CO₂e sequestration, gross value, margin pool and farmer payout.',
      link: 'pages/carbon-economics.html', linkLabel: 'Open calculations'
    },
    {
      icon: 'ledger', title: 'Auditable MRV Ledger',
      text: 'Every conversion closes as an MRV record with full traceability — farmer, batch, routing, calculations — and pending / verified / rejected status control.',
      link: 'pages/mrv-ledger.html', linkLabel: 'Open ledger'
    }
  ];

  const MODULES = [
    {
      icon: 'dashboard', title: 'Operator Dashboard', wide: true,
      text: 'One unified view of feedstock supply, routing, carbon potential, economics and MRV status.',
      meta: ['KPIs', 'Charts', 'Flow map'], href: 'pages/operator-dashboard.html', bars: [42, 68, 55, 84, 62, 92, 74]
    },
    { icon: 'farmer', title: 'Farmer Onboarding', text: 'Register farmers and straw batches with inline validation and instant batch IDs.', meta: ['Forms', 'Validation'], href: 'pages/farmer-onboarding.html' },
    { icon: 'leaf', title: 'Carbon & Economics', text: 'Batch, zone and total-level conversion math with currency and tonne formatting.', meta: ['CO₂e', 'Margins'], href: 'pages/carbon-economics.html' },
    { icon: 'route', title: 'Collection & Routing', text: 'Nearby batch discovery, zone recommendation and facility routing per plot.', meta: ['Radius', 'Zones'], href: 'pages/collection-routing.html' },
    { icon: 'map', title: 'Feedstock Flow', text: 'Interactive OpenFreeMap view of plots, zones, facilities and flow lines.', meta: ['MapLibre', 'Legend'], href: 'pages/feedstock-flow.html' },
    { icon: 'ledger', title: 'MRV Ledger', text: 'Searchable verification ledger with status management and traceability drill-down.', meta: ['Audit', 'Status'], href: 'pages/mrv-ledger.html' }
  ];

  function iconInto(id, name) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = I[name];
  }

  function renderStatic() {
    iconInto('brandMark', 'logo');
    iconInto('ctaIcon', 'dashboard');
    iconInto('ctaIcon2', 'dashboard');
    iconInto('ctaIcon3', 'sprout');
    document.getElementById('yearNow').textContent = new Date().getFullYear();

    /* Pipeline trace */
    const trace = document.getElementById('platformTrace');
    if (trace) {
      trace.innerHTML = FLOW_STAGES.map((s, idx) => `
        ${idx > 0 ? `<span class="trace__arrow">${I.arrowRight}</span>` : ''}
        <div class="trace__node">${I[s.icon]}<b>${s.name}</b><span>${s.meta}</span></div>`).join('');
    }

    /* Capabilities */
    const rows = document.getElementById('capabilityRows');
    if (rows) {
      rows.innerHTML = CAPABILITIES.map((c, idx) => `
        <div class="ledger-row">
          <span class="ledger-row__num">0${idx + 1}</span>
          <span class="ledger-row__icon">${I[c.icon]}</span>
          <div><h3>${c.title}</h3><p>${c.text}</p></div>
          <a class="ledger-row__link" href="${c.link}">${c.linkLabel} ${I.arrowRight}</a>
        </div>`).join('');
    }

    /* Module grid */
    const grid = document.getElementById('moduleGrid');
    if (grid) {
      grid.innerHTML = MODULES.map((m) => `
        <a class="module-card${m.wide ? ' module-card--wide' : ''}" href="${m.href}">
          <div style="display:flex;flex-direction:column;gap:10px;flex:1;min-width:0">
            <span class="module-card__icon">${I[m.icon]}</span>
            <h3>${m.title}</h3>
            <p>${m.text}</p>
            <div class="module-card__meta">${m.meta.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
          </div>
          ${m.bars ? `<div class="module-card__bars" aria-hidden="true">${m.bars.map((h, i) => `<i style="height:${h}%;animation-delay:${i * 70}ms"></i>`).join('')}</div>` : ''}
          <span class="module-card__arrow">${I.arrowUpRight}</span>
        </a>`).join('');
    }

    /* Flowboard skeleton */
    const flow = document.getElementById('flowNodes');
    if (flow) {
      flow.innerHTML = FLOW_STAGES.map((s, idx) => `
        ${idx > 0 ? '<div class="flow-link"></div>' : ''}
        <div class="flow-node" style="animation-delay:${idx * 90}ms">
          <span class="flow-node__icon">${I[s.icon]}</span>
          <span>
            <span class="flow-node__name">${s.name}</span>
            <span class="flow-node__meta">${s.meta}</span>
          </span>
          <span class="flow-node__val" data-flow="${s.key}">…</span>
        </div>`).join('');
    }
  }

  function fillFromSummary(summary, flow) {
    const feedstock = summary?.feedstock || {};
    const routing = summary?.routing || {};
    const carbon = summary?.carbon || {};
    const mrv = summary?.mrv || {};
    const farmersOnboarded = Number(feedstock.total_registered_batches || feedstock.total_available_batches || 0);

    const vals = {
      farmers: fmt.num(farmersOnboarded, 0),
      batches: fmt.num(feedstock.total_registered_batches || 0, 0),
      zones: fmt.num((routing.zones || []).length, 0),
      facilities: fmt.num((flow.facilities || []).length, 0),
      carbon: fmt.num(carbon.total_co2e_ton || 0, 1),
      mrv: `${mrv.verified || 0}/${mrv.total_records || 0}`
    };
    document.querySelectorAll('[data-flow]').forEach((el) => {
      el.textContent = vals[el.dataset.flow] != null ? vals[el.dataset.flow] : '—';
    });

    const strip = document.getElementById('statStrip');
    if (strip) {
      const cells = strip.querySelectorAll('.stat-cell__v');
      const data = [
        [farmersOnboarded, (v) => fmt.num(v, 0)],
        [feedstock.total_registered_batches || 0, (v) => fmt.num(v, 0)],
        [feedstock.total_straw_volume_ton || 0, (v) => fmt.tonnes(v, 1)],
        [carbon.total_biochar_ton || 0, (v) => fmt.tonnes(v, 1)],
        [carbon.total_co2e_ton || 0, (v) => fmt.co2e(v, 1)],
        [mrv.verified || 0, (v) => `${fmt.num(v, 0)} rec`]
      ];
      data.forEach((d, idx) => { if (cells[idx]) UI.countUp(cells[idx], d[0], d[1], 850); });
    }
  }

  async function loadSummary() {
    try {
      const [summary, flow] = await Promise.all([API.getSummary(), API.getRouting()]);
      fillFromSummary(summary, flow);
    } catch (err) {
      document.querySelectorAll('[data-flow]').forEach((el) => { el.textContent = 'offline'; });
      console.warn('[StrawLedger] summary unavailable:', err.message);
    }
  }

  /* Scripts run at the end of <body> — DOM is already parsed. */
  renderStatic();
  window.StrawLedgerApp.init(loadSummary);
})();
