/* ============================================================
   THE STRAW LEDGER — Collection & Routing
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const CFG = window.STRAW_LEDGER_CONFIG;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  let batches = [];
  let facilities = [];
  let routeMap = null;
  let mapMarkers = [];

  const $ = (id) => document.getElementById(id);

  function currentBatch() {
    return batches.find((b) => b.id === $('routeBatchSelect').value) || null;
  }

  /* ---------------- Plot card ---------------- */
  function renderPlotCard(b) {
    $('plotStatus').outerHTML = `<span class="badge ${b.zone_id ? 'badge--leaf' : 'badge--info'}" id="plotStatus">${b.zone_id ? 'assigned' : 'registered'}</span>`;
    $('plotBody').innerHTML = `
      <div class="dlist">
        <div class="dlist__row"><span class="dlist__k">Batch ID</span><span class="dlist__v mono">${b.id}</span></div>
        <div class="dlist__row"><span class="dlist__k">Farmer</span><span class="dlist__v">${b.farmer_name}</span></div>
        <div class="dlist__row"><span class="dlist__k">Plot</span><span class="dlist__v">${b.village}, ${b.district}</span></div>
        <div class="dlist__row"><span class="dlist__k">Latitude</span><span class="dlist__v mono">${b.latitude.toFixed(5)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Longitude</span><span class="dlist__v mono">${b.longitude.toFixed(5)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Straw volume</span><span class="dlist__v mono">${fmt.tonnes(b.straw_volume_t, 1)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Crop</span><span class="dlist__v">${b.crop_type}</span></div>
        <div class="dlist__row"><span class="dlist__k">Harvest</span><span class="dlist__v">${fmt.date(b.harvest_date)}</span></div>
      </div>`;
  }

  /* ---------------- Nearby discovery ---------------- */
  async function findNearby() {
    const b = currentBatch();
    if (!b) { UI.toast('Select a straw batch first.', 'warn'); return; }
    const radius = parseFloat($('radiusInput').value) || CFG.DEFAULT_RADIUS_KM;
    const btn = $('findNearbyBtn');
    btn.disabled = true;
    $('findIcon').innerHTML = '<span class="spinner"></span>';
    $('nearbyBody').innerHTML = UI.stateHTML('loading', { message: 'Searching nearby registered batches…' });

    try {
      const res = await API.findNearby(b.id, radius);

      /* Nearby list */
      $('nearbyCount').textContent = `${res.nearby_count} found`;
      $('nearbySub').textContent = `Within ${fmt.km(res.radius_km)} of ${b.id}`;
      $('radiusChip').textContent = `radius ${fmt.km(res.radius_km)}`;
      if (!res.nearby.length) {
        $('nearbyBody').innerHTML = UI.stateHTML('empty', {
          icon: 'crosshair', title: 'No batches inside the radius',
          message: 'This plot is currently isolated. Widen the radius or onboard nearby farmers to build a local group.'
        });
      } else {
        $('nearbyBody').innerHTML = res.nearby.map((n) => `
          <div class="nearby-item">
            <span class="nearby-item__dist">${fmt.km(n.distance_km)}</span>
            <div style="min-width:0;flex:1">
              <b class="mono small">${n.batch_code || n.id}</b>
              <span class="cell-sub" style="display:block;font-size:0.74rem;color:var(--ink-400)">${n.farmer_name} · ${n.village}${n.district ? ', ' + n.district : ''}</span>
            </div>
            <span class="num mono small">${fmt.tonnes(n.straw_volume_t, 1)}</span>
          </div>`).join('');
      }

      /* Aggregation KPIs */
      UI.countUp($('aggFarmers'), res.farmer_count, (v) => fmt.num(v, 0), 600);
      UI.countUp($('aggBatches'), res.nearby_count + 1, (v) => fmt.num(v, 0), 600);
      UI.countUp($('aggVolume'), res.aggregated_volume_t, (v) => fmt.tonnes(v, 1), 700);

      /* Zone + facility */
      if (res.recommended_zone) {
        const z = res.recommended_zone;
        $('zoneBadge').textContent = res.is_already_assigned ? 'assigned' : 'recommended';
        $('zoneSub').textContent = `${fmt.km(z.distance_km)} from plot`;
        $('zoneBody').innerHTML = `
          <div class="dlist">
            <div class="dlist__row"><span class="dlist__k">Zone</span><span class="dlist__v">${z.name}</span></div>
            <div class="dlist__row"><span class="dlist__k">Zone code</span><span class="dlist__v mono">${z.zone_code || z.id}</span></div>
            <div class="dlist__row"><span class="dlist__k">Hub coordinates</span><span class="dlist__v mono">${(z.hub_latitude||0).toFixed(4)}, ${(z.hub_longitude||0).toFixed(4)}</span></div>
            <div class="dlist__row"><span class="dlist__k">Group volume</span><span class="dlist__v mono">${fmt.tonnes(res.aggregated_volume_t, 1)}</span></div>
            <div class="dlist__row"><span class="dlist__k">Group farmers</span><span class="dlist__v mono">${fmt.num(res.farmer_count, 0)}</span></div>
          </div>`;
        const f = res.associated_facility;
        $('facilityBody').innerHTML = f ? `
          <div class="dlist">
            <div class="dlist__row"><span class="dlist__k">Facility</span><span class="dlist__v">${f.name}</span></div>
            <div class="dlist__row"><span class="dlist__k">Code</span><span class="dlist__v mono">${f.code || f.id}</span></div>
          </div>` : `<p class="muted small">No facility allocated to this zone.</p>`;
      }

      $('routeDetailBtn').disabled = false;
      await drawMap(b, res);
      UI.toast(`Found ${res.nearby_count} nearby batches · ${fmt.tonnes(res.aggregated_volume_t, 1)} aggregated.`);
    } catch (err) {
      UI.mountState($('nearbyBody'), 'error', { message: err.message, onRetry: findNearby });
    } finally {
      btn.disabled = false;
      $('findIcon').innerHTML = I.crosshair;
    }
  }

  /* ---------------- Map ---------------- */
  async function drawMap(source, res) {
    try {
      if (!routeMap) routeMap = await UI.createMap('routeMap', { center: [source.longitude, source.latitude], zoom: 9 });
      const map = routeMap;

      mapMarkers.forEach((m) => m.remove());
      mapMarkers = [];

      const addMarker = (lng, lat, kind, title, rows) => {
        if (!lat || !lng) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl(kind, kind === 'batch' && title.includes(source.id) ? 'mk--focus' : '') })
          .setLngLat([lng, lat])
          .setPopup(new window.maplibregl.Popup({ offset: 18 }).setHTML(UI.popupHTML(title, rows)))
          .addTo(map);
        mapMarkers.push(m);
      };

      addMarker(source.longitude, source.latitude, 'batch', `${source.batch_code || source.id} · selected plot`, [
        ['Farmer', source.farmer_name], ['Volume', fmt.tonnes(source.straw_volume_t, 1)]
      ]);
      res.nearby.forEach((n) => addMarker(n.longitude, n.latitude, 'batch', n.id, [
        ['Farmer', n.farmer_name], ['Distance', fmt.km(n.distance_km)], ['Volume', fmt.tonnes(n.straw_volume_t, 1)]
      ]));
      if (res.recommended_zone) {
        const z = res.recommended_zone;
        addMarker(z.hub_longitude, z.hub_latitude, 'zone', z.name, [['Distance from plot', fmt.km(z.distance_km)]]);
        const f = res.associated_facility;
        if (f) addMarker(f.longitude, f.latitude, 'facility', f.name, [['Code', f.code || f.id]]);
      }

      /* Radius circle */
      const circle = UI.circlePolygon(source.longitude, source.latitude, res.radius_km);
      if (map.getSource('route-radius')) map.getSource('route-radius').setData(circle);
      else {
        map.addSource('route-radius', { type: 'geojson', data: circle });
        map.addLayer({ id: 'route-radius-fill', type: 'fill', source: 'route-radius', paint: { 'fill-color': '#3f7d53', 'fill-opacity': 0.07 } });
        map.addLayer({ id: 'route-radius-line', type: 'line', source: 'route-radius', paint: { 'line-color': '#3f7d53', 'line-width': 1.6, 'line-dasharray': [3, 2] } });
      }

      /* Flow lines */
      const feats = [];
      if (res.recommended_zone) {
        feats.push({ type: 'Feature', properties: { kind: 'pz' }, geometry: { type: 'LineString', coordinates: [[source.longitude, source.latitude], [res.recommended_zone.hub_longitude, res.recommended_zone.hub_latitude]] } });
        const f = facilities.find((x) => x.id === res.recommended_zone.facility_id);
        if (f) feats.push({ type: 'Feature', properties: { kind: 'zf' }, geometry: { type: 'LineString', coordinates: [[res.recommended_zone.hub_longitude, res.recommended_zone.hub_latitude], [f.longitude, f.latitude]] } });
      }
      const fc = { type: 'FeatureCollection', features: feats };
      if (map.getSource('route-flow')) map.getSource('route-flow').setData(fc);
      else {
        map.addSource('route-flow', { type: 'geojson', data: fc });
        map.addLayer({ id: 'route-flow-pz', type: 'line', source: 'route-flow', filter: ['==', ['get', 'kind'], 'pz'], paint: { 'line-color': '#3f7d53', 'line-width': 2.4, 'line-opacity': 0.8 } });
        map.addLayer({ id: 'route-flow-zf', type: 'line', source: 'route-flow', filter: ['==', ['get', 'kind'], 'zf'], paint: { 'line-color': '#c08a2b', 'line-width': 2.6, 'line-dasharray': [2, 1.6] } });
      }

      const pts = [[source.longitude, source.latitude]];
      res.nearby.forEach((n) => pts.push([n.longitude, n.latitude]));
      if (res.recommended_zone) pts.push([res.recommended_zone.hub_longitude, res.recommended_zone.hub_latitude]);
      UI.fitPoints(map, pts, 70);
    } catch (err) {
      UI.toast('Map could not be rendered: ' + err.message, 'error');
    }
  }

  /* ---------------- Routing details ---------------- */
  async function showRouting() {
    const b = currentBatch();
    if (!b) return;
    const section = $('routingSection');
    const body = $('routingBody');
    section.style.display = '';
    body.style.display = '';
    $('routeLegs').innerHTML = UI.stateHTML('loading', { message: 'Loading routing chain…' });
    try {
      const radius = parseFloat($('radiusInput').value) || CFG.DEFAULT_RADIUS_KM;
      const r = await API.findNearby(b.id, radius);
      $('routingTitle').textContent = `Route for ${b.batch_code || b.id}`;
      // Build legs from findNearby result
      const legs = [];
      let totalDist = 0;
      if (r.recommended_zone) {
        const z = r.recommended_zone;
        legs.push({ from: 'plot', to: 'zone', from_label: `${b.village || b.plot_name} plot`, to_label: z.name, distance_km: z.distance_km || 0 });
        totalDist += z.distance_km || 0;
        if (r.associated_facility) {
          const f = r.associated_facility;
          const fDist = z.hub_latitude && f.latitude
            ? +API._internal.haversineKm(z.hub_latitude, z.hub_longitude, f.latitude, f.longitude).toFixed(1)
            : 0;
          legs.push({ from: 'zone', to: 'facility', from_label: z.name, to_label: f.name, distance_km: fDist });
          totalDist += fDist;
        }
      }
      const isAssigned = r.is_already_assigned;
      $('routingSub').textContent = `${isAssigned ? 'Assigned' : 'Recommended'} routing · total straight-line distance ${fmt.km(totalDist)}`;
      if (!legs.length) {
        $('routeLegs').innerHTML = UI.stateHTML('empty', { icon: 'route', title: 'No routing data', message: 'No collection zone recommended yet.' });
        return;
      }
      $('routeLegs').innerHTML = legs.map((leg, idx) => `
        <div class="route-leg">
          <span class="route-leg__node ${idx === 0 ? '' : 'route-leg__node--gold'}">${idx === 0 ? I.pin : I.factory}</span>
          <div><b>${leg.from_label} → ${leg.to_label}</b><span>Leg ${idx + 1} · ${leg.from === 'plot' ? 'field collection' : 'hub transfer'}</span></div>
          <span class="route-leg__dist">${fmt.km(leg.distance_km)}</span>
        </div>`).join('') + `
        <div class="alert alert--info" style="margin-top:6px">${I.route}
          <div class="small">Distances are straight-line estimates from registered coordinates. ${isAssigned ? '' : 'This batch is not yet assigned — the nearest hub is recommended.'}</div>
        </div>`;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      UI.mountState($('routeLegs'), 'error', { message: err.message, onRetry: showRouting });
    }
  }

  /* ---------------- Init ---------------- */
  async function init() {
    $('findIcon').innerHTML = I.crosshair;
    $('routeIcon').innerHTML = I.route;
    $('plotEmptyIcon').innerHTML = I.pin;
    $('nearbyEmptyIcon').innerHTML = I.crosshair;
    $('zoneEmptyIcon').innerHTML = I.layers;
    $('radiusInput').value = CFG.DEFAULT_RADIUS_KM;

    $('findNearbyBtn').addEventListener('click', findNearby);
    $('routeDetailBtn').addEventListener('click', showRouting);
    $('routeBatchSelect').addEventListener('change', () => {
      const b = currentBatch();
      if (b) renderPlotCard(b);
      $('routeDetailBtn').disabled = !b;
    });

    try {
      [batches, facilities] = await Promise.all([API.getBatches(), API.getFacilities()]);
      const sel = $('routeBatchSelect');
      if (!batches.length) {
        sel.innerHTML = '<option value="">No batches registered yet</option>';
        return;
      }
      sel.innerHTML = batches.map((b) =>
        `<option value="${b.id}">${b.id} — ${b.farmer_name} · ${b.village}, ${b.district}</option>`).join('');
      const preset = new URLSearchParams(window.location.search).get('batch');
      if (preset && batches.some((b) => b.id === preset)) sel.value = preset;
      const b = currentBatch();
      if (b) renderPlotCard(b);
    } catch (err) {
      UI.mountState($('plotBody'), 'error', { message: err.message, onRetry: init });
    }
  }

  window.StrawLedgerApp.init(init);
})();
