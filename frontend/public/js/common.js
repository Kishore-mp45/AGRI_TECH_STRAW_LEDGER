/* ============================================================
   THE STRAW LEDGER — Shell bootstrap
   Injects sidebar / topbar, wires mobile nav, data-source
   indicator and reveal animations on every app page.
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const I = UI.ICONS;
  const CFG = window.STRAW_LEDGER_CONFIG;

  const NAV = [
    {
      group: 'Operations',
      items: [
        { id: 'dashboard', label: 'Operator Dashboard', href: 'operator-dashboard.html', icon: 'dashboard' },
        { id: 'onboarding', label: 'Farmer Onboarding', href: 'farmer-onboarding.html', icon: 'farmer' }
      ]
    },
    {
      group: 'Analytics',
      items: [
        { id: 'carbon', label: 'Carbon & Economics', href: 'carbon-economics.html', icon: 'leaf' },
        { id: 'routing', label: 'Collection & Routing', href: 'collection-routing.html', icon: 'route' },
        { id: 'flow', label: 'Feedstock Flow', href: 'feedstock-flow.html', icon: 'map' }
      ]
    },
    {
      group: 'Assurance',
      items: [
        { id: 'mrv', label: 'MRV Ledger', href: 'mrv-ledger.html', icon: 'ledger', badge: null }
      ]
    }
  ];

  function pageHref(href) { return href; } /* pages live together under pages/ */

  function renderSidebar(host, activeId) {
    const groups = NAV.map((g) => `
      <div class="nav-group">
        <div class="nav-group__label">${g.group}</div>
        ${g.items.map((it) => `
          <a class="nav-link${it.id === activeId ? ' is-active' : ''}" href="${pageHref(it.href)}" ${it.id === activeId ? 'aria-current="page"' : ''}>
            ${I[it.icon]}<span>${it.label}</span>${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
          </a>`).join('')}
      </div>`).join('');

    host.innerHTML = `
      <a class="sidebar__brand" href="../index.html" aria-label="The Straw Ledger home">
        <span class="sidebar__brand-mark">${I.logo}</span>
        <span>
          <span class="sidebar__brand-name">The Straw Ledger</span>
          <span class="sidebar__brand-sub">Feedstock · Carbon · MRV</span>
        </span>
      </a>
      <nav class="sidebar__nav" aria-label="Primary">${groups}</nav>
      <div class="sidebar__footer">
        <div class="system-status">
          <span class="status-dot" id="systemDot"></span>
          <span id="systemLabel">Connecting to backend…</span>
        </div>
        <div style="margin-top:9px;font-size:0.66rem;opacity:0.55">Season ${CFG.SEASON_LABEL} · v2.4</div>
      </div>`;
  }

  function renderTopbar(host, meta) {
    host.innerHTML = `
      <div style="min-width:0">
        <div class="topbar__crumb">
          <span>${CFG.APP_NAME}</span><span>/</span><span>${meta.group || 'Module'}</span><span>/</span><b>${meta.short || meta.title}</b>
        </div>
        <div class="topbar__title" style="font-family:var(--font-display)">${meta.title || ''}
          ${meta.subtitle ? `<span class="topbar__subtitle muted small" style="font-family:var(--font-body);font-weight:400;margin-left:10px">${meta.subtitle}</span>` : ''}
        </div>
      </div>
      <div class="topbar__right">
        <span class="chip chip--demo hidden" id="demoChip" title="Backend unreachable — showing the bundled sample dataset">${I.info} Demo dataset</span>
        <span class="chip">${I.calendar} ${CFG.SEASON_LABEL}</span>
      </div>`;
  }

  function updateSystemStatus(source) {
    const dot = document.getElementById('systemDot');
    const label = document.getElementById('systemLabel');
    const chip = document.getElementById('demoChip');
    if (source === 'demo') {
      if (dot) { dot.className = 'status-dot status-dot--warn'; }
      if (label) label.textContent = 'Demo dataset active';
      if (chip) chip.classList.remove('hidden');
    } else {
      if (dot) { dot.className = 'status-dot'; }
      if (label) label.textContent = 'Backend connected';
      if (chip) chip.classList.add('hidden');
    }
  }

  function wireMobileNav() {
    const btn = document.getElementById('navToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (btn) {
      btn.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => document.body.classList.remove('nav-open'));
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.body.classList.remove('nav-open');
    });
  }

  function bootShell() {
    const body = document.body;
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    if (sidebar) renderSidebar(sidebar, body.dataset.page);
    if (topbar) {
      renderTopbar(topbar, {
        title: body.dataset.title,
        subtitle: body.dataset.subtitle,
        group: body.dataset.group,
        short: body.dataset.short
      });
    }
    wireMobileNav();

    if (window.StrawLedgerAPI) {
      updateSystemStatus(window.StrawLedgerAPI.getDataSource());
      window.StrawLedgerAPI.onDataSourceChange(updateSystemStatus);
    }

    UI.initReveal();
  }

  /* Page scripts register via StrawLedgerApp.init(fn) */
  const initFns = [];
  window.StrawLedgerApp = {
    init: (fn) => initFns.push(fn),
    ready: (fn) => {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
      else fn();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    bootShell();
    initFns.forEach((fn) => {
      try { fn(); } catch (err) { console.error('[StrawLedger] page init failed:', err); }
    });
  });
})();
