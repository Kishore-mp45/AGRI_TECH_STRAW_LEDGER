/* ============================================================
   THE STRAW LEDGER — Carbon & Economics
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  let scope = 'batch';
  let batches = [];

  const FLOW_DEF = [
    { key: 'straw_t', label: 'Registered straw', unit: 't', icon: 'package', cls: '' },
    { key: 'collected_straw_t', label: 'Collected straw', unit: 't', icon: 'route', cls: '' },
    { key: 'biochar_t', label: 'Biochar produced', unit: 't', icon: 'flame', cls: 'flow-step--gold' },
    { key: 'co2e_t', label: 'CO₂e sequestered', unit: 'tCO₂e', icon: 'cloud', cls: 'flow-step--dark' },
    { key: 'gross_value_inr', label: 'Gross value', unit: 'VND', icon: 'coins', cls: 'flow-step--gold' },
    { key: 'production_cost_inr', label: 'Production cost', unit: 'VND', icon: 'factory', cls: '' },
    { key: 'margin_pool_inr', label: 'Margin pool', unit: 'VND', icon: 'scale', cls: 'flow-step--gold' },
    { key: 'farmer_payout_inr', label: 'Farmer payout', unit: 'VND', icon: 'farmer', cls: 'flow-step--dark' }
  ];

  function fmtUnit(v, unit) {
    if (unit === 'VND') return fmt.money(v);
    if (unit === 'tCO₂e') return fmt.co2e(v, 2);
    return fmt.tonnes(v, 2);
  }

  function renderFlow(calc, label) {
    document.getElementById('flowScopeBadge').textContent = label;
    document.getElementById('calcFlow').innerHTML = FLOW_DEF.map((s, idx) => `
      ${idx > 0 ? '<div class="flow-connector"></div>' : ''}
      <div class="flow-step ${s.cls}">
        <span class="flow-step__icon">${I[s.icon]}</span>
        <span class="flow-step__label">${s.label}</span>
        <span class="flow-step__value">${fmtUnit(calc[s.key], s.unit)}<small>${s.unit === 'INR' ? '' : s.unit}</small></span>
      </div>`).join('');

    const c = calc.constants || window.STRAW_LEDGER_CONFIG.SYSTEM_CONSTANTS;
    document.getElementById('constantsNote').innerHTML =
      `System constants — collection efficiency <b class="mono">${Math.round((c.COLLECTION_EFFICIENCY || 0.85) * 100)}%</b> · ` +
      `biochar yield <b class="mono">${Math.round((c.BIOCHAR_YIELD || 0.3) * 100)}%</b> · ` +
      `CDR factor <b class="mono">${c.CDR_FACTOR || 2.5} tCO₂e/t</b> · ` +
      `biochar price <b class="mono">${fmt.money(c.BIOCHAR_PRICE_VND || c.BIOCHAR_PRICE_INR || 0)}/t</b> · ` +
      `farmer share <b class="mono">${Math.round((c.FARMER_SHARE || 0.4) * 100)}%</b> of margin pool. Backend values take precedence.`;
  }

  function renderSummary(calc) {
    const tiles = [
      ['Biochar output', `${fmt.num(calc.biochar_t, 2)} <small>t</small>`],
      ['CO₂e removal', `${fmt.num(calc.co2e_t, 2)} <small>tCO₂e</small>`],
      ['Margin pool', fmt.moneyCompact(calc.margin_pool_inr)],
      ['Farmer payout', fmt.moneyCompact(calc.farmer_payout_inr)]
    ];
    document.getElementById('calcSummary').innerHTML = tiles.map((t) =>
      `<div class="summary-tile"><div class="summary-tile__k">${t[0]}</div><div class="summary-tile__v">${t[1]}</div></div>`).join('');
  }

  function renderCharts(calc) {
    const operatorMargin = Math.max(0, (calc.margin_pool_inr || 0) - (calc.farmer_payout_inr || 0));
    const econBox = document.getElementById('econChartBox');
    if (!calc.gross_value_inr) {
      UI.mountState(econBox, 'empty', { title: 'No value to split', message: 'Gross value is zero for this selection.' });
    } else {
      econBox.innerHTML = '<canvas id="econChart"></canvas>';
      UI.createChart('econChart', (pal) => ({
        type: 'doughnut',
        data: {
          labels: ['Production cost', 'Farmer payout', 'Operator margin'],
          datasets: [{
            data: [calc.production_cost_inr, calc.farmer_payout_inr, operatorMargin],
            backgroundColor: [pal.sky, pal.straw, pal.leaf],
            borderWidth: 3, borderColor: '#fff', hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, padding: 14 } },
            tooltip: Object.assign(UI.tooltipStyle(pal), { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt.money(ctx.parsed)}` } })
          }
        }
      }));
    }

    const massBox = document.getElementById('massChartBox');
    massBox.innerHTML = '<canvas id="massChart"></canvas>';
    UI.createChart('massChart', (pal) => ({
      type: 'bar',
      data: {
        labels: ['Registered straw', 'Collected straw', 'Biochar'],
        datasets: [{
          label: 'tonnes',
          data: [calc.straw_t, calc.collected_straw_t, calc.biochar_t],
          backgroundColor: [pal.leafLight, pal.leaf, pal.pine],
          borderRadius: 6, maxBarThickness: 70
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: Object.assign(UI.tooltipStyle(pal), { callbacks: { label: (ctx) => ` ${fmt.tonnes(ctx.parsed.x, 2)}` } }) },
        scales: {
          x: { beginAtZero: true, grid: { color: pal.grid }, ticks: { callback: (v) => v + ' t' } },
          y: { grid: { display: false } }
        }
      }
    }));
  }

  async function load() {
    const flow = document.getElementById('calcFlow');
    flow.innerHTML = '<div class="skeleton skeleton--block"></div><div class="skeleton skeleton--block" style="margin-top:10px"></div>';
    try {
      let calc; let label;
      if (scope === 'total') {
        calc = await API.getAggregateCalculation();
        label = 'all batches';
        document.getElementById('batchContext').textContent = 'Network aggregate';
      } else {
        const batchId = document.getElementById('batchSelect').value;
        if (!batchId) {
          UI.mountState(flow, 'empty', { icon: 'leaf', title: 'Select a straw batch', message: 'Pick a registered batch above to see its full conversion math.' });
          return;
        }
        calc = await API.getCalculation(batchId);
        const b = batches.find((x) => x.id === batchId);
        label = b ? (b.batch_code || batchId) : batchId;
        document.getElementById('batchContext').textContent = b ? `${b.province || b.district} · ${fmt.tonnes(b.straw_volume_t, 1)}` : batchId;
      }
      renderFlow(calc, label);
      renderSummary(calc);
      renderCharts(calc);
    } catch (err) {
      UI.mountState(flow, 'error', { message: err.message, onRetry: load });
    }
  }

  async function init() {
    document.getElementById('recalcIcon').innerHTML = I.refresh;
    document.getElementById('constIcon').innerHTML = I.info;

    document.querySelectorAll('#scopeTabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#scopeTabs .tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        scope = tab.dataset.scope;
        const bar = document.getElementById('scopeBar');
        bar.style.opacity = scope === 'batch' ? '1' : '0.45';
        bar.style.pointerEvents = scope === 'batch' ? 'auto' : 'none';
        load();
      });
    });

    document.getElementById('recalcBtn').addEventListener('click', load);
    document.getElementById('batchSelect').addEventListener('change', load);

    try {
      batches = await API.getBatches();
      const sel = document.getElementById('batchSelect');
      if (!batches.length) {
        sel.innerHTML = '<option value="">No batches registered yet</option>';
        UI.mountState(document.getElementById('calcFlow'), 'empty', { icon: 'package', title: 'No straw batches', message: 'Register a farmer and batch first — calculations will appear here.' });
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const preset = params.get('batch');
      sel.innerHTML = batches.map((b) =>
        `<option value="${b.id}">${b.batch_code || b.id} — ${b.farmer_name} · ${b.village}${b.district ? ', ' + b.district : ''} (${fmt.tonnes(b.straw_volume_t, 1)})</option>`).join('');
      if (preset && batches.some((b) => b.id === preset)) sel.value = preset;
      load();
    } catch (err) {
      UI.mountState(document.getElementById('calcFlow'), 'error', { message: err.message, onRetry: init });
    }
  }

  window.StrawLedgerApp.init(init);
})();
