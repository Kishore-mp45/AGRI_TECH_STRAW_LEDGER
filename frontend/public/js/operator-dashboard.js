/* ============================================================
   THE STRAW LEDGER — Operator Dashboard
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  let dashMap = null;
  let dashMarkers = [];

  function coordinatesOf(item) {
    const longitude = Number(item && (item.longitude ?? item.hub_longitude));
    const latitude = Number(item && (item.latitude ?? item.hub_latitude));
    return Number.isFinite(longitude) && Number.isFinite(latitude)
      ? { longitude, latitude }
      : null;
  }

  /* ---------------- KPI row ---------------- */
  function renderKpis(t, mrv) {
    const kpis = [
      { cls: 'kpi--pine', icon: 'package', label: 'Total straw registered', value: t.feedstock.total_straw_volume_ton, f: (v) => fmt.tonnes(v, 1), foot: `${fmt.num(t.feedstock.total_registered_batches, 0)} batches on ledger` },
      { cls: 'kpi--gold', icon: 'layers', label: 'Available batches', value: t.feedstock.total_available_batches, f: (v) => fmt.num(v, 0), foot: `${fmt.num(t.routing.total_assigned_batches, 0)} assigned to zones` },
      { cls: 'kpi--pine', icon: 'flame', label: 'Estimated biochar', value: t.carbon.total_biochar_ton, f: (v) => fmt.tonnes(v, 1), foot: 'at system yield factor' },
      { cls: 'kpi--dark', icon: 'cloud', label: 'CO₂e sequestration', value: t.carbon.total_co2e_ton, f: (v) => fmt.co2e(v, 1), foot: 'estimated removal potential' },
      { cls: 'kpi--gold', icon: 'coins', label: 'Margin pool', value: t.economics.total_margin_pool_usd, f: (v) => fmt.moneyCompact(v), foot: `farmer payout ${fmt.moneyCompact(t.economics.total_farmer_payout_usd)}` },
      { cls: 'kpi--sky', icon: 'ledger', label: 'MRV verified', value: t.mrv.verified, f: (v) => `${fmt.num(v, 0)} / ${fmt.num(t.mrv.total_records, 0)}`, foot: `${fmt.num(t.mrv.pending, 0)} pending · ${fmt.num(t.mrv.rejected, 0)} rejected` }
    ];
    document.getElementById('kpiRow').innerHTML = kpis.map((k) => `
      <div class="kpi ${k.cls}">
        <div class="kpi__label">${I[k.icon]} ${k.label}</div>
        <div class="kpi__value" data-v="${k.value}">—</div>
        <div class="kpi__foot">${k.foot}</div>
      </div>`).join('');
    document.querySelectorAll('#kpiRow .kpi__value').forEach((el, idx) => {
      UI.countUp(el, kpis[idx].value, kpis[idx].f, 800);
    });
  }

  /* ---------------- Feedstock chart ---------------- */
  function renderFeedstockChart(zones) {
    const box = document.getElementById('feedstockChartBox');
    if (!zones.length) { UI.mountState(box, 'empty', { title: 'No zone data', message: 'Collection zones will chart once batches are aggregated.' }); return; }
    box.innerHTML = '<canvas id="feedstockChart"></canvas>';
    UI.createChart('feedstockChart', (pal) => ({
      type: 'bar',
      data: {
        labels: zones.map((z) => z.zone_name ? z.zone_name.replace(' Collection Hub', '') : z.zone_code),
        datasets: [{
          label: 'Straw volume (t)',
          data: zones.map((z) => z.total_straw_ton),
          backgroundColor: zones.map((_, i) => (i % 2 ? pal.straw : pal.leaf)),
          borderRadius: 6, maxBarThickness: 64
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: UI.tooltipStyle(pal) },
        scales: {
          y: { beginAtZero: true, grid: { color: pal.grid }, ticks: { callback: (v) => v + ' t' } },
          x: { grid: { display: false } }
        }
      }
    }));
  }

  /* ---------------- Carbon / economics overview ---------------- */
  function renderOverview(t) {
    document.getElementById('overviewBody').innerHTML = `
      <div class="calc-summary" style="grid-template-columns:1fr 1fr">
        <div class="summary-tile"><div class="summary-tile__k">Gross value</div><div class="summary-tile__v">${fmt.moneyCompact(t.economics.total_gross_value_usd)}</div></div>
        <div class="summary-tile"><div class="summary-tile__k">Production cost</div><div class="summary-tile__v">${fmt.moneyCompact(t.economics.total_production_cost_usd)}</div></div>
        <div class="summary-tile"><div class="summary-tile__k">Margin pool</div><div class="summary-tile__v">${fmt.moneyCompact(t.economics.total_margin_pool_usd)}</div></div>
        <div class="summary-tile"><div class="summary-tile__k">Farmer payout</div><div class="summary-tile__v">${fmt.moneyCompact(t.economics.total_farmer_payout_usd)}</div></div>
      </div>
      <div class="dlist" style="margin-top:14px">
        <div class="dlist__row"><span class="dlist__k">Collected straw (est.)</span><span class="dlist__v mono">${fmt.tonnes(t.routing.total_routed_straw_ton, 1)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Biochar output</span><span class="dlist__v mono">${fmt.tonnes(t.carbon.total_biochar_ton, 2)}</span></div>
        <div class="dlist__row"><span class="dlist__k">CO₂e sequestered</span><span class="dlist__v mono">${fmt.co2e(t.carbon.total_co2e_ton, 2)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Value per tonne straw</span><span class="dlist__v mono">${t.feedstock.total_straw_volume_ton ? fmt.money(t.economics.total_gross_value_usd / t.feedstock.total_straw_volume_ton) : '—'}</span></div>
      </div>`;
  }

  /* ---------------- Zone aggregation bars ---------------- */
  function renderZoneAgg(zones) {
    const body = document.getElementById('zoneAggBody');
    if (!zones.length) { UI.mountState(body, 'empty', { title: 'No aggregation yet', message: 'Zones appear here once batches are assigned.' }); return; }
    const max = Math.max(...zones.map((z) => z.total_straw_ton), 1);
    body.innerHTML = zones.map((z) => `
      <div class="zone-bar" title="${z.zone_name}">
        <span class="zone-bar__name">${(z.zone_name||z.zone_code).replace(' Collection Hub', '')}</span>
        <span class="zone-bar__track"><span class="zone-bar__fill" style="width:${Math.max(4, (z.total_straw_ton / max) * 100)}%"></span></span>
        <span class="zone-bar__val">${fmt.num(z.total_straw_ton, 1)} t</span>
      </div>
      <div class="small muted" style="margin:-4px 0 8px 130px">${z.batch_count} batches · ${z.province || 'no facility'}</div>`).join('');
  }

  /* ---------------- MRV donut ---------------- */
  function renderMrvChart(mrv) {
    const box = document.getElementById('mrvChartBox');
    const data = [mrv.verified, mrv.pending, mrv.rejected];
    if (!mrv.total_records) { UI.mountState(box, 'empty', { title: 'No MRV records', message: 'Records appear after batches are converted.' }); return; }
    box.innerHTML = '<canvas id="mrvChart"></canvas>';
    UI.createChart('mrvChart', (pal) => ({
      type: 'doughnut',
      data: {
        labels: ['Verified', 'Pending', 'Rejected'],
        datasets: [{ data, backgroundColor: [pal.leaf, pal.straw, pal.rust], borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: UI.tooltipStyle(pal) }
      }
    }));
    document.getElementById('mrvLegendList').innerHTML = [
      ['Verified', mrv.verified, 'var(--st-verified-dot)'],
      ['Pending', mrv.pending, 'var(--st-pending-dot)'],
      ['Rejected', mrv.rejected, 'var(--st-rejected-dot)']
    ].map((r) => `
      <div class="dlist__row">
        <span class="dlist__k" style="display:flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:50%;background:${r[2]}"></i>${r[0]}</span>
        <span class="dlist__v mono">${fmt.num(r[1], 0)} records</span>
      </div>`).join('');
  }

  /* ---------------- Map summary ---------------- */
  async function renderMap(zones, facilities) {
    try {
      if (!dashMap) dashMap = await UI.createMap('dashMap', { zoom: 6.8 });
      const map = dashMap;
      dashMarkers.forEach((m) => m.remove());
      dashMarkers = [];

      (window.__dashBatches || []).forEach((b) => {
        const point = coordinatesOf(b);
        if (!point) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('batch') })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new window.maplibregl.Popup({ offset: 18 }).setHTML(UI.popupHTML(`${b.id}`, [
            ['Farmer', b.farmer_name], ['Village', `${b.village}, ${b.district}`],
            ['Volume', fmt.tonnes(b.straw_volume_t, 1)], ['Harvest', fmt.date(b.harvest_date)]
          ])))
          .addTo(map);
        dashMarkers.push(m);
      });

      zones.forEach((z) => {
        const point = coordinatesOf(z);
        if (!point) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('zone') })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new window.maplibregl.Popup({ offset: 20 }).setHTML(UI.popupHTML(z.zone_name || z.zone_code, [
            ['Batches', z.assigned_batch_count], ['Aggregated', fmt.tonnes(z.aggregated_straw_ton, 1)], ['Facility', z.facility_name]
          ])))
          .addTo(map);
        dashMarkers.push(m);
      });

      facilities.forEach((f) => {
        const point = coordinatesOf(f);
        if (!point) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('facility') })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new window.maplibregl.Popup({ offset: 20 }).setHTML(UI.popupHTML(f.name, [
            ['Capacity', `${f.capacity_t_per_day} t/day`], ['Technology', f.technology]
          ])))
          .addTo(map);
        dashMarkers.push(m);
      });

      /* Flow lines: assigned plot → zone, zone → facility */
      const lineFeatures = [];
      (window.__dashBatches || []).forEach((b) => {
        const z = zones.find((x) => x.zone_id === b.zone_id);
        const batchPoint = coordinatesOf(b);
        const zonePoint = coordinatesOf(z);
        if (batchPoint && zonePoint) lineFeatures.push({ type: 'Feature', properties: { kind: 'plot-zone' }, geometry: { type: 'LineString', coordinates: [[batchPoint.longitude, batchPoint.latitude], [zonePoint.longitude, zonePoint.latitude]] } });
      });
      zones.forEach((z) => {
        const f = facilities.find((x) => x.id === z.facility_id);
        const zonePoint = coordinatesOf(z);
        const facilityPoint = coordinatesOf(f);
        if (zonePoint && facilityPoint) lineFeatures.push({ type: 'Feature', properties: { kind: 'zone-facility' }, geometry: { type: 'LineString', coordinates: [[zonePoint.longitude, zonePoint.latitude], [facilityPoint.longitude, facilityPoint.latitude]] } });
      });

      if (map.getSource('dash-flow')) {
        map.getSource('dash-flow').setData({ type: 'FeatureCollection', features: lineFeatures });
      } else {
        map.addSource('dash-flow', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
        map.addLayer({ id: 'dash-flow-pz', type: 'line', source: 'dash-flow', filter: ['==', ['get', 'kind'], 'plot-zone'],
          paint: { 'line-color': '#3f7d53', 'line-width': 2.2, 'line-opacity': 0.75 } });
        map.addLayer({ id: 'dash-flow-zf', type: 'line', source: 'dash-flow', filter: ['==', ['get', 'kind'], 'zone-facility'],
          paint: { 'line-color': '#c08a2b', 'line-width': 2.6, 'line-opacity': 0.9, 'line-dasharray': [2, 1.6] } });
      }

      const pts = [];
      (window.__dashBatches || []).forEach((b) => { const point = coordinatesOf(b); if (point) pts.push([point.longitude, point.latitude]); });
      zones.forEach((z) => { const point = coordinatesOf(z); if (point) pts.push([point.longitude, point.latitude]); });
      facilities.forEach((f) => { const point = coordinatesOf(f); if (point) pts.push([point.longitude, point.latitude]); });
      UI.fitPoints(map, pts, 80);

      document.getElementById('dashLegend').innerHTML = `
        <div class="map-legend__title">Legend</div>
        <div class="map-legend__item"><span class="map-legend__swatch" style="background:var(--leaf-500)"></span> Straw batch</div>
        <div class="map-legend__item"><span class="map-legend__swatch" style="background:var(--straw-500);border-radius:4px"></span> Collection zone</div>
        <div class="map-legend__item"><span class="map-legend__swatch" style="background:var(--pine-900);border-radius:4px"></span> Facility</div>
        <div class="map-legend__item"><span class="map-legend__line"></span> Plot → zone</div>`;
    } catch (err) {
      document.getElementById('dashMap').innerHTML = UI.stateHTML('error', { title: 'Map unavailable', message: err.message, retry: false });
    }
  }

  /* ---------------- Tables ---------------- */
  function renderBatchTable(batches) {
    const wrap = document.getElementById('batchTableWrap');
    if (!batches.length) { UI.mountState(wrap, 'empty', { title: 'No batches registered', message: 'Onboard a farmer to create the first straw batch.' }); return; }
    const rows = batches.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);
    wrap.innerHTML = `
      <table class="table table--clickable">
        <thead><tr><th>Batch</th><th>District</th><th>Volume</th><th>Harvest</th><th>Status</th></tr></thead>
        <tbody>${rows.map((b) => `
          <tr data-batch="${b.id}">
            <td><span class="cell-main mono">${b.id}</span><span class="cell-sub">${b.farmer_name}</span></td>
            <td>${b.district}<span class="cell-sub">${b.village}</span></td>
            <td class="num">${fmt.tonnes(b.straw_volume_t, 1)}</td>
            <td>${fmt.date(b.harvest_date)}</td>
            <td>${b.zone_id ? UI.badge('verified', 'assigned') : UI.badge('info', 'registered')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    wrap.querySelectorAll('tr[data-batch]').forEach((tr) => {
      tr.addEventListener('click', () => { window.location.href = 'collection-routing.html?batch=' + tr.dataset.batch; });
    });
  }

  function renderFacilityTable(facilities, zones) {
    const wrap = document.getElementById('facilityTableWrap');
    if (!facilities.length) { UI.mountState(wrap, 'empty', { title: 'No facilities configured', message: 'Pyrolysis facilities will appear once configured.' }); return; }
    wrap.innerHTML = `
      <table class="table">
        <thead><tr><th>Facility</th><th>Technology</th><th>Capacity</th><th>Zones served</th><th>Status</th></tr></thead>
        <tbody>${facilities.map((f) => {
          const load = f.total_feedstock_volume_ton;
          const served = f.collection_zones || [];
          return `
          <tr>
            <td><span class="cell-main">${f.facility_name}</span><span class="cell-sub mono">${f.facility_code || f.facility_id}</span></td>
            <td>—</td>
            <td class="num">— t/day</td>
            <td>${served.length ? `${served.length} zones · ${fmt.tonnes(load, 1)}` : '—'}</td>
            <td>${UI.badge('verified', 'active')}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>`;
  }

  /* ---------------- Load ---------------- */
  async function load() {
    const refreshIcon = document.getElementById('refreshBtn');
    try {
      const [summary, batches, flow] = await Promise.all([API.getSummary(), API.getBatches(), API.getRouting()]);
      window.__dashBatches = batches;
      renderKpis(summary, summary.mrv);
      renderFeedstockChart(summary.routing.zones);
      renderOverview(summary);
      renderZoneAgg(summary.routing.zones);
      renderMrvChart(summary.mrv);
      renderBatchTable(batches);
      renderFacilityTable(flow.facilities || [], summary.routing.zones);
      await renderMap(summary.routing.zones, flow.facilities || []);
      if (API.getDataSource() === 'demo') {
        UI.toast('Backend unreachable — dashboard shows the bundled demo dataset.', 'warn');
      }
    } catch (err) {
      ['feedstockChartBox', 'overviewBody', 'zoneAggBody', 'mrvChartBox'].forEach((id) => {
        UI.mountState(document.getElementById(id), 'error', { message: err.message, onRetry: load });
      });
      UI.mountState(document.getElementById('batchTableWrap'), 'error', { message: err.message, onRetry: load });
      UI.mountState(document.getElementById('facilityTableWrap'), 'error', { message: err.message, onRetry: load });
    } finally {
      if (refreshIcon) refreshIcon.disabled = false;
    }
  }

  window.StrawLedgerApp.init(() => {
    document.getElementById('refreshIcon').innerHTML = I.refresh;
    const btn = document.getElementById('refreshBtn');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.querySelector('#refreshIcon').innerHTML = '<span class="spinner"></span>';
      load().finally(() => { btn.querySelector('#refreshIcon').innerHTML = I.refresh; });
    });
    load();
  });
})();
