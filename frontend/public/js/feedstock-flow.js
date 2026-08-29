/* ============================================================
   THE STRAW LEDGER — Feedstock Flow (MapLibre + OpenFreeMap)
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  let map = null;
  const groups = { batches: [], zones: [], facilities: [] };
  const FLOW_LAYERS = ['flow-pz', 'flow-zf'];

  const $ = (id) => document.getElementById(id);

  function selectEntity(kind, data) {
    const panel = $('selectedBody');
    const card = $('selectedPanel');
    card.className = 'card card--pad' + (kind === 'zone' ? ' entity-card entity-card--zone' : kind === 'facility' ? ' entity-card entity-card--facility' : ' entity-card');
    let html = '';
    if (kind === 'batch') {
      html = `
        <div class="mono" style="font-weight:600;font-size:1.02rem">${data.id}</div>
        <span class="badge ${data.zone_id ? 'badge--leaf' : 'badge--info'}" style="margin:6px 0 10px">${data.zone_id ? 'assigned' : 'registered'}</span>
        <div class="dlist">
          <div class="dlist__row"><span class="dlist__k">Farmer</span><span class="dlist__v">${data.farmer_name}</span></div>
          <div class="dlist__row"><span class="dlist__k">Plot</span><span class="dlist__v">${data.village}, ${data.district}</span></div>
          <div class="dlist__row"><span class="dlist__k">Coordinates</span><span class="dlist__v mono">${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Straw volume</span><span class="dlist__v mono">${fmt.tonnes(data.straw_volume_t, 1)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Crop</span><span class="dlist__v">${data.crop_type}</span></div>
          <div class="dlist__row"><span class="dlist__k">Harvest</span><span class="dlist__v">${fmt.date(data.harvest_date)}</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <a class="btn btn--soft btn--sm btn--block" href="collection-routing.html?batch=${data.id}">${I.route} Route this batch</a>
          <a class="btn btn--ghost btn--sm" href="carbon-economics.html?batch=${data.id}">${I.leaf} Calc</a>
        </div>`;
    } else if (kind === 'zone') {
      html = `
        <div style="font-family:var(--font-display);font-weight:600;font-size:1.06rem">${data.zone_name || data.name}</div>
        <span class="badge badge--gold" style="margin:6px 0 10px">collection zone</span>
        <div class="dlist">
          <div class="dlist__row"><span class="dlist__k">Zone code</span><span class="dlist__v mono">${data.zone_code || data.id}</span></div>
          <div class="dlist__row"><span class="dlist__k">Hub</span><span class="dlist__v mono">${(data.latitude||data.hub_latitude||0).toFixed(4)}, ${(data.longitude||data.hub_longitude||0).toFixed(4)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Batches</span><span class="dlist__v mono">${fmt.num(data.batch_count, 0)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Aggregated straw</span><span class="dlist__v mono">${fmt.tonnes(data.aggregated_volume_t, 1)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Facility</span><span class="dlist__v">${data.facility_name || '—'}</span></div>
        </div>`;
    } else {
      html = `
        <div style="font-family:var(--font-display);font-weight:600;font-size:1.06rem">${data.name}</div>
        <span class="badge badge--leaf" style="margin:6px 0 10px">pyrolysis facility</span>
        <div class="dlist">
          <div class="dlist__row"><span class="dlist__k">Facility code</span><span class="dlist__v mono">${data.code || data.id}</span></div>
          <div class="dlist__row"><span class="dlist__k">Feedstock</span><span class="dlist__v mono">${fmt.tonnes(data.total_feedstock_volume_ton, 1)}</span></div>
          <div class="dlist__row"><span class="dlist__k">Zones served</span><span class="dlist__v mono">${(data.collection_zones||[]).length}</span></div>
          <div class="dlist__row"><span class="dlist__k">Coordinates</span><span class="dlist__v mono">${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}</span></div>
        </div>`;
    }
    panel.innerHTML = html;
  }

  function clearMarkers() {
    Object.keys(groups).forEach((k) => { groups[k].forEach((m) => m.remove()); groups[k] = []; });
  }

  function flowFeatures(batches, zones, facilities) {
    const feats = [];
    batches.forEach((b) => {
      if (!b.latitude) return;
      const z = zones.find((x) => x.id === b.zone_id || x.zone_id === b.zone_id);
      if (z) {
        const zLat = z.latitude || z.hub_latitude;
        const zLng = z.longitude || z.hub_longitude;
        if (zLat) feats.push({ type: 'Feature', properties: { kind: 'pz' }, geometry: { type: 'LineString', coordinates: [[b.longitude, b.latitude], [zLng, zLat]] } });
      }
    });
    zones.forEach((z) => {
      const zLat = z.latitude || z.hub_latitude;
      const zLng = z.longitude || z.hub_longitude;
      if (!zLat) return;
      const f = facilities.find((x) => x.id === z.facility_id);
      if (f) feats.push({ type: 'Feature', properties: { kind: 'zf' }, geometry: { type: 'LineString', coordinates: [[zLng, zLat], [f.longitude, f.latitude]] } });
    });
    return { type: 'FeatureCollection', features: feats };
  }

  async function load(showFit) {
    try {
      const [batches, zones, facilities] = await Promise.all([
        API.getBatches(), API.getZones(), API.getFacilities()
      ]);
      if (!map) map = await UI.createMap('flowMap');

      clearMarkers();

      batches.forEach((b) => {
        if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('batch') })
          .setLngLat([b.longitude, b.latitude])
          .setPopup(new window.maplibregl.Popup({ offset: 18 }).setHTML(UI.popupHTML(b.id, [
            ['Farmer', b.farmer_name], ['Village', b.village], ['Volume', fmt.tonnes(b.straw_volume_t, 1)]
          ])))
          .addTo(map);
        m.getElement().addEventListener('click', () => selectEntity('batch', b), true);
        groups.batches.push(m);
      });
      zones.forEach((z) => {
        if (!z.latitude && !z.hub_latitude) return; // skip zones without coords
        const lat = z.latitude || z.hub_latitude;
        const lng = z.longitude || z.hub_longitude;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('zone') })
          .setLngLat([lng, lat])
          .setPopup(new window.maplibregl.Popup({ offset: 20 }).setHTML(UI.popupHTML(z.zone_name || z.name, [
            ['Batches', z.batch_count], ['Aggregated', fmt.tonnes(z.aggregated_volume_t, 1)]
          ])))
          .addTo(map);
        m.getElement().addEventListener('click', () => selectEntity('zone', z), true);
        groups.zones.push(m);
      });
      facilities.forEach((f) => {
        if (!f.latitude) return;
        const m = new window.maplibregl.Marker({ element: UI.markerEl('facility') })
          .setLngLat([f.longitude, f.latitude])
          .setPopup(new window.maplibregl.Popup({ offset: 20 }).setHTML(UI.popupHTML(f.name, [
            ['Feedstock', fmt.tonnes(f.total_feedstock_volume_ton, 1)], ['Zones', (f.collection_zones||[]).length]
          ])))
          .addTo(map);
        m.getElement().addEventListener('click', () => selectEntity('facility', f), true);
        groups.facilities.push(m);
      });

      const fc = flowFeatures(batches, zones, facilities);
      if (map.getSource('flow-src')) map.getSource('flow-src').setData(fc);
      else {
        map.addSource('flow-src', { type: 'geojson', data: fc });
        map.addLayer({ id: 'flow-pz', type: 'line', source: 'flow-src', filter: ['==', ['get', 'kind'], 'pz'],
          paint: { 'line-color': '#3f7d53', 'line-width': 2.2, 'line-opacity': 0.7 } });
        map.addLayer({ id: 'flow-zf', type: 'line', source: 'flow-src', filter: ['==', ['get', 'kind'], 'zf'],
          paint: { 'line-color': '#c08a2b', 'line-width': 2.6, 'line-opacity': 0.9, 'line-dasharray': [2, 1.6] } });
      }
      applyToggles();

      const totalVol = batches.reduce((s, b) => s + (b.straw_volume_t || 0), 0);
      $('networkList').innerHTML = `
        <div class="dlist__row"><span class="dlist__k">Batches</span><span class="dlist__v mono">${fmt.num(batches.length, 0)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Zones</span><span class="dlist__v mono">${fmt.num(zones.filter((z) => z.latitude || z.hub_latitude).length, 0)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Facilities</span><span class="dlist__v mono">${fmt.num(facilities.length, 0)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Straw volume</span><span class="dlist__v mono">${fmt.tonnes(totalVol, 1)}</span></div>`;

      if (showFit !== false) {
        const pts = [];
        batches.forEach((b) => { if (b.latitude) pts.push([b.longitude, b.latitude]); });
        zones.forEach((z) => { const lat = z.latitude || z.hub_latitude; const lng = z.longitude || z.hub_longitude; if (lat) pts.push([lng, lat]); });
        facilities.forEach((f) => { if (f.latitude) pts.push([f.longitude, f.latitude]); });
        UI.fitPoints(map, pts, 80);
      }
    } catch (err) {
      $('flowMap').innerHTML = UI.stateHTML('error', { title: 'Map failed to load', message: err.message, onRetry: () => load() });
    }
  }

  function applyToggles() {
    if (!map) return;
    const vis = {
      batches: $('layerBatches').checked,
      zones: $('layerZones').checked,
      facilities: $('layerFacilities').checked,
      flow: $('layerFlow').checked
    };
    Object.keys(groups).forEach((k) => {
      groups[k].forEach((m) => { m.getElement().style.display = vis[k] ? '' : 'none'; });
    });
    FLOW_LAYERS.forEach((layer) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', vis.flow ? 'visible' : 'none');
    });
  }

  window.StrawLedgerApp.init(() => {
    $('fitIcon').innerHTML = I.crosshair;
    $('mapRefreshIcon').innerHTML = I.refresh;

    ['layerBatches', 'layerZones', 'layerFacilities', 'layerFlow'].forEach((id) => {
      $(id).addEventListener('change', applyToggles);
    });
    $('fitBtn').addEventListener('click', () => load(true));
    $('mapRefreshBtn').addEventListener('click', () => { load(false); UI.toast('Map data reloaded from the API.'); });

    load();
  });
})();
