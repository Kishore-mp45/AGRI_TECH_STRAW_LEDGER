/* ============================================================
   THE STRAW LEDGER — API integration layer
   All backend communication goes through this module.
   Real fetch calls are always attempted first; the bundled
   sample dataset is used ONLY when the backend is unreachable
   AND config.DEMO_FALLBACK is enabled (UI is notified).
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.STRAW_LEDGER_CONFIG;

  function apiBase() {
    try {
      const override = window.localStorage.getItem('STRAW_LEDGER_API_BASE');
      if (override) return override.replace(/\/$/, '');
    } catch (e) { /* storage unavailable */ }
    return (CFG.API_BASE_URL || '').replace(/\/$/, '');
  }

  let dataSource = 'api'; // 'api' | 'demo'
  const sourceListeners = [];
  let sourceAnnounced = false;

  function setSource(src) {
    if (!sourceAnnounced || dataSource !== src) {
      sourceAnnounced = true;
      dataSource = src;
      sourceListeners.forEach((fn) => fn(src));
    }
  }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  /* ---------------- core request ---------------- */
  async function request(path, options = {}) {
    const opts = Object.assign({ headers: {} }, options);
    opts.headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      opts.headers
    );
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);

    let res;
    try {
      res = await fetch(apiBase() + path, opts);
    } catch (networkErr) {
      throw new ApiError('Network error — backend unreachable', 0);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const errorPayload = await res.json();
        detail = errorPayload.detail || errorPayload.message || '';
      } catch (e) { /* ignore */ }
      throw new ApiError(detail || `Request failed with status ${res.status}`, res.status);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    const payload = text ? JSON.parse(text) : null;
    return payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')
      ? payload.data
      : payload;
  }

  /* Try the real endpoint; fall back to sample data only when allowed. */
  async function withFallback(path, options, fallbackFn) {
    try {
      const data = await request(path, options);
      setSource('api');
      return data;
    } catch (err) {
      if (CFG.DEMO_FALLBACK && typeof fallbackFn === 'function') {
        setSource('demo');
        return fallbackFn();
      }
      throw err;
    }
  }

  /* ---------------- geometry helpers ---------------- */
  function haversineKm(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* ============================================================
     SAMPLE DATASET — offline fallback only (never used when the
     backend responds). Mirrors the documented API response shapes.
     ============================================================ */
  const FARMERS = [
    { id: 'FRM-001', name: 'Harpreet Singh', phone: '+91 98150 22317', village: 'Jagraon', district: 'Ludhiana', state: 'Punjab' },
    { id: 'FRM-002', name: 'Gurmeet Kaur', phone: '+91 98722 41086', village: 'Raikot', district: 'Ludhiana', state: 'Punjab' },
    { id: 'FRM-003', name: 'Amarjit Singh', phone: '+91 98140 77512', village: 'Moga Rural', district: 'Moga', state: 'Punjab' },
    { id: 'FRM-004', name: 'Sukhdev Singh', phone: '+91 98880 13465', village: 'Nakodar', district: 'Jalandhar', state: 'Punjab' },
    { id: 'FRM-005', name: 'Balwinder Kaur', phone: '+91 98550 60218', village: 'Sultanpur', district: 'Kapurthala', state: 'Punjab' },
    { id: 'FRM-006', name: 'Joginder Singh', phone: '+91 98760 90341', village: 'Talwandi Sabo', district: 'Bathinda', state: 'Punjab' },
    { id: 'FRM-007', name: 'Manpreet Singh', phone: '+91 98155 48873', village: 'Longowal', district: 'Sangrur', state: 'Punjab' },
    { id: 'FRM-008', name: 'Rajwinder Kaur', phone: '+91 98070 35126', village: 'Samana', district: 'Patiala', state: 'Punjab' }
  ];

  const ZONES = [
    { id: 'CZ-01', name: 'Ludhiana Collection Hub', hub_latitude: 30.926, hub_longitude: 75.825, radius_km: 30, facility_id: 'PF-01', facility_name: 'GreenChar Pyrolysis Unit 1' },
    { id: 'CZ-02', name: 'Jalandhar Collection Hub', hub_latitude: 31.341, hub_longitude: 75.562, radius_km: 28, facility_id: 'PF-02', facility_name: 'Sutlej Biochar Plant' },
    { id: 'CZ-03', name: 'Bathinda Collection Hub', hub_latitude: 30.215, hub_longitude: 74.945, radius_km: 32, facility_id: 'PF-01', facility_name: 'GreenChar Pyrolysis Unit 1' }
  ];

  const FACILITIES = [
    { id: 'PF-01', name: 'GreenChar Pyrolysis Unit 1', latitude: 30.955, longitude: 75.788, capacity_t_per_day: 50, technology: 'Slow pyrolysis · continuous', active: true },
    { id: 'PF-02', name: 'Sutlej Biochar Plant', latitude: 31.305, longitude: 75.605, capacity_t_per_day: 30, technology: 'Slow pyrolysis · batch', active: true }
  ];

  const BATCHES = [
    { id: 'SB-2024-0001', farmer_id: 'FRM-001', farmer_name: 'Harpreet Singh', village: 'Jagraon', district: 'Ludhiana', crop_type: 'Rice (Paddy)', straw_volume_t: 12.5, moisture_pct: 11.8, plot_area_acres: 9.5, latitude: 30.891, longitude: 75.831, harvest_date: '2025-10-28', status: 'assigned', zone_id: 'CZ-01', created_at: '2025-10-29T09:14:00Z' },
    { id: 'SB-2024-0002', farmer_id: 'FRM-002', farmer_name: 'Gurmeet Kaur', village: 'Raikot', district: 'Ludhiana', crop_type: 'Rice (Paddy)', straw_volume_t: 8.2, moisture_pct: 12.4, plot_area_acres: 6.0, latitude: 30.947, longitude: 75.903, harvest_date: '2025-10-30', status: 'assigned', zone_id: 'CZ-01', created_at: '2025-10-30T11:02:00Z' },
    { id: 'SB-2024-0003', farmer_id: 'FRM-003', farmer_name: 'Amarjit Singh', village: 'Moga Rural', district: 'Moga', crop_type: 'Rice (Paddy)', straw_volume_t: 15.0, moisture_pct: 10.9, plot_area_acres: 11.0, latitude: 30.823, longitude: 75.174, harvest_date: '2025-11-02', status: 'registered', zone_id: null, created_at: '2025-11-02T08:41:00Z' },
    { id: 'SB-2024-0004', farmer_id: 'FRM-004', farmer_name: 'Sukhdev Singh', village: 'Nakodar', district: 'Jalandhar', crop_type: 'Rice (Paddy)', straw_volume_t: 9.6, moisture_pct: 13.1, plot_area_acres: 7.2, latitude: 31.332, longitude: 75.581, harvest_date: '2025-11-01', status: 'assigned', zone_id: 'CZ-02', created_at: '2025-11-01T15:26:00Z' },
    { id: 'SB-2024-0005', farmer_id: 'FRM-005', farmer_name: 'Balwinder Kaur', village: 'Sultanpur', district: 'Kapurthala', crop_type: 'Rice (Paddy)', straw_volume_t: 6.4, moisture_pct: 12.0, plot_area_acres: 4.8, latitude: 31.384, longitude: 75.382, harvest_date: '2025-11-03', status: 'assigned', zone_id: 'CZ-02', created_at: '2025-11-03T10:19:00Z' },
    { id: 'SB-2024-0006', farmer_id: 'FRM-006', farmer_name: 'Joginder Singh', village: 'Talwandi Sabo', district: 'Bathinda', crop_type: 'Rice (Paddy)', straw_volume_t: 18.3, moisture_pct: 11.2, plot_area_acres: 13.5, latitude: 30.213, longitude: 74.941, harvest_date: '2025-10-27', status: 'assigned', zone_id: 'CZ-03', created_at: '2025-10-27T07:55:00Z' },
    { id: 'SB-2024-0007', farmer_id: 'FRM-007', farmer_name: 'Manpreet Singh', village: 'Longowal', district: 'Sangrur', crop_type: 'Rice (Paddy)', straw_volume_t: 7.1, moisture_pct: 12.8, plot_area_acres: 5.4, latitude: 30.243, longitude: 75.841, harvest_date: '2025-11-05', status: 'registered', zone_id: null, created_at: '2025-11-05T13:48:00Z' },
    { id: 'SB-2024-0008', farmer_id: 'FRM-008', farmer_name: 'Rajwinder Kaur', village: 'Samana', district: 'Patiala', crop_type: 'Rice (Paddy)', straw_volume_t: 10.8, moisture_pct: 11.6, plot_area_acres: 8.1, latitude: 30.342, longitude: 76.391, harvest_date: '2025-11-06', status: 'registered', zone_id: null, created_at: '2025-11-06T09:33:00Z' }
  ];

  const K = CFG.SYSTEM_CONSTANTS;
  function calcForBatch(b) {
    const collected = b.straw_volume_t * K.COLLECTION_EFFICIENCY;
    const biochar = collected * K.BIOCHAR_YIELD;
    const co2e = biochar * K.CDR_FACTOR;
    const gross = biochar * K.BIOCHAR_PRICE_INR;
    const cost = biochar * K.PRODUCTION_COST_INR;
    const margin = gross - cost;
    const payout = margin * K.FARMER_SHARE;
    return {
      batch_id: b.id,
      straw_t: b.straw_volume_t,
      collected_straw_t: +collected.toFixed(2),
      biochar_t: +biochar.toFixed(2),
      co2e_t: +co2e.toFixed(2),
      gross_value_inr: Math.round(gross),
      production_cost_inr: Math.round(cost),
      margin_pool_inr: Math.round(margin),
      farmer_payout_inr: Math.round(payout),
      constants: Object.assign({}, K)
    };
  }

  function buildMrv(batches) {
    const statuses = ['verified', 'verified', 'pending', 'verified', 'pending', 'rejected', 'verified', 'pending'];
    const notes = {
      verified: 'Chain-of-custody documents and weighbridge slips reconciled.',
      pending: 'Awaiting verifier review of weighbridge documentation.',
      rejected: 'Weighbridge slip mismatch — resubmission requested.'
    };
    return batches.map((b, i) => {
      const c = calcForBatch(b);
      const zone = ZONES.find((z) => z.id === b.zone_id) || null;
      const status = statuses[i] || 'pending';
      return {
        id: 'MRV-2025-' + String(i + 1).padStart(4, '0'),
        batch_id: b.id,
        farmer_name: b.farmer_name,
        village: b.village,
        district: b.district,
        latitude: b.latitude,
        longitude: b.longitude,
        plot_area_acres: b.plot_area_acres,
        straw_volume_t: b.straw_volume_t,
        harvest_date: b.harvest_date,
        zone_id: zone ? zone.id : null,
        zone_name: zone ? zone.name : 'Unassigned',
        facility_id: zone ? zone.facility_id : null,
        facility_name: zone ? zone.facility_name : '—',
        biochar_t: c.biochar_t,
        co2e_t: c.co2e_t,
        gross_value_inr: c.gross_value_inr,
        farmer_payout_inr: c.farmer_payout_inr,
        status,
        verifier_note: notes[status],
        created_at: b.created_at,
        updated_at: b.created_at
      };
    });
  }

  const sampleMrv = buildMrv(BATCHES);
  let sampleBatchSeq = BATCHES.length;

  function zoneAggregates() {
    return ZONES.map((z) => {
      const inZone = BATCHES.filter((b) => b.zone_id === z.id);
      const vol = inZone.reduce((s, b) => s + b.straw_volume_t, 0);
      const calc = inZone.reduce((acc, b) => {
        const c = calcForBatch(b);
        acc.biochar += c.biochar_t; acc.co2e += c.co2e_t;
        acc.gross += c.gross_value_inr; acc.cost += c.production_cost_inr;
        acc.margin += c.margin_pool_inr; acc.payout += c.farmer_payout_inr;
        return acc;
      }, { biochar: 0, co2e: 0, gross: 0, cost: 0, margin: 0, payout: 0 });
      return Object.assign({}, z, {
        batch_count: inZone.length,
        farmer_count: new Set(inZone.map((b) => b.farmer_id)).size,
        aggregated_volume_t: +vol.toFixed(2),
        biochar_t: +calc.biochar.toFixed(2),
        co2e_t: +calc.co2e.toFixed(2),
        gross_value_inr: Math.round(calc.gross),
        production_cost_inr: Math.round(calc.cost),
        margin_pool_inr: Math.round(calc.margin),
        farmer_payout_inr: Math.round(calc.payout)
      });
    });
  }

  function buildSummary() {
    const zones = zoneAggregates();
    const total = BATCHES.reduce((acc, b) => {
      const c = calcForBatch(b);
      acc.straw += b.straw_volume_t; acc.biochar += c.biochar_t; acc.co2e += c.co2e_t;
      acc.gross += c.gross_value_inr; acc.cost += c.production_cost_inr;
      acc.margin += c.margin_pool_inr; acc.payout += c.farmer_payout_inr;
      return acc;
    }, { straw: 0, biochar: 0, co2e: 0, gross: 0, cost: 0, margin: 0, payout: 0 });
    const mrv = {
      total: sampleMrv.length,
      pending: sampleMrv.filter((m) => m.status === 'pending').length,
      verified: sampleMrv.filter((m) => m.status === 'verified').length,
      rejected: sampleMrv.filter((m) => m.status === 'rejected').length
    };
    return {
      totals: {
        farmers: FARMERS.length,
        batches: BATCHES.length,
        available_batches: BATCHES.filter((b) => b.status === 'registered').length,
        assigned_batches: BATCHES.filter((b) => b.status === 'assigned').length,
        straw_volume_t: +total.straw.toFixed(2),
        biochar_t: +total.biochar.toFixed(2),
        co2e_t: +total.co2e.toFixed(2),
        gross_value_inr: Math.round(total.gross),
        production_cost_inr: Math.round(total.cost),
        margin_pool_inr: Math.round(total.margin),
        farmer_payout_inr: Math.round(total.payout)
      },
      mrv,
      zones,
      facilities: FACILITIES
    };
  }

  /* ---------------- public API surface ---------------- */
  window.StrawLedgerAPI = {
    ApiError,
    getDataSource: () => dataSource,
    onDataSourceChange: (fn) => sourceListeners.push(fn),

    getSummary: () => withFallback('/operators/dashboard', null, buildSummary),

    getFarmers: () => withFallback('/farmers/', null, () => FARMERS.slice()),

    getBatches: async () => {
      const raw = await withFallback('/batches/', null, () => BATCHES.slice());
      // Normalize backend shape -> frontend shape
      if (!Array.isArray(raw)) return raw;
      return raw.map((b) => ({
        id: b.batch_id || b.id,
        batch_code: b.batch_code,
        farmer_name: b.farmer_name,
        farmer_id: b.farmer_id,
        plot_name: b.plot_name,
        village: b.plot_name || b.village,
        district: b.province || b.district,
        province: b.province,
        latitude: b.latitude,
        longitude: b.longitude,
        straw_volume_t: b.straw_volume_ton || b.straw_volume_t,
        crop_type: b.crop_type || 'Rice',
        harvest_date: b.harvest_date,
        status: b.status,
        zone_id: b.zone_id,
        has_calculation: b.has_calculation,
        biochar_yield_ton: b.biochar_yield_ton,
        co2e_sequestered_ton: b.co2e_sequestered_ton,
        farmer_payout_usd: b.farmer_payout_usd,
        created_at: b.created_at
      }));
    },

    getBatch: (id) => withFallback(`/batches/${encodeURIComponent(id)}`, null, () => {
      const b = BATCHES.find((x) => x.id === id);
      if (!b) throw new ApiError('Batch not found', 404);
      return b;
    }),

    /* POST farmer + straw batch registration (existing backend contract). */
    onboardFarmer: async (payload) => {
      // Mock onboarding since backend Phase 4 was skipped
      const f = payload.farmer || {};
      const b = payload.batch || {};
      sampleBatchSeq += 1;
      const farmerId = 'FRM-' + String(100 + sampleBatchSeq);
      const batchId = 'SB-2024-' + String(sampleBatchSeq).padStart(4, '0');
      const farmer = { id: farmerId, name: f.name, phone: f.phone, village: f.village, district: f.district, state: f.state };
      FARMERS.push(farmer);
      BATCHES.push({
        id: batchId, farmer_id: farmerId, farmer_name: f.name, village: f.village, district: f.district,
        crop_type: b.crop_type, straw_volume_t: +b.straw_volume_t, moisture_pct: +b.moisture_pct,
        plot_area_acres: +b.plot_area_acres, latitude: +b.latitude, longitude: +b.longitude,
        harvest_date: b.harvest_date, status: 'registered', zone_id: null,
        created_at: new Date().toISOString()
      });
      return { farmer_id: farmerId, batch_id: batchId, status: 'registered' };
    },

    /* GET nearby registered batches within radius. */
    findNearby: async (batchId, radiusKm) => {
      const raw = await withFallback(
        `/routing/analyze/${encodeURIComponent(batchId)}`,
        null,
        () => {
          const source = BATCHES.find((b) => b.id === batchId);
          if (!source) throw new ApiError('Batch not found', 404);
          const r = radiusKm || CFG.DEFAULT_RADIUS_KM;
          const nearby = BATCHES
            .filter((b) => b.id !== batchId)
            .map((b) => Object.assign({}, b, {
              distance_km: +haversineKm(source.latitude, source.longitude, b.latitude, b.longitude).toFixed(1)
            }))
            .filter((b) => b.distance_km <= r)
            .sort((a, b) => a.distance_km - b.distance_km);
          const volume = nearby.reduce((s, b) => s + b.straw_volume_t, source.straw_volume_t);
          let best = null; let bestD = Infinity;
          ZONES.forEach((z) => {
            const d = haversineKm(source.latitude, source.longitude, z.hub_latitude, z.hub_longitude);
            if (d < bestD) { bestD = d; best = z; }
          });
          return { group: { nearby_batches: nearby, total_aggregated_volume_ton: volume, search_radius_km: r }, recommended_zone: best ? Object.assign({}, best, { distance_km: +bestD.toFixed(1), zone_name: best.name, zone_id: best.id }) : null, associated_facility: null };
        }
      );
      // Normalize backend response -> frontend shape
      const group = raw.group || {};
      const zone = raw.recommended_zone || null;
      const facility = raw.associated_facility || null;
      const nearby = (group.nearby_batches || []).map((n) => ({
        id: n.batch_id || n.id,
        batch_code: n.batch_code,
        farmer_name: n.farmer_name,
        village: n.plot_name || n.village,
        district: n.province || n.district,
        latitude: n.latitude,
        longitude: n.longitude,
        straw_volume_t: n.straw_volume_ton || n.straw_volume_t || 0,
        distance_km: n.distance_km || 0
      }));
      return {
        source_batch_id: batchId,
        radius_km: group.search_radius_km || radiusKm || CFG.DEFAULT_RADIUS_KM,
        nearby,
        nearby_count: nearby.length,
        farmer_count: new Set(nearby.map((n) => n.farmer_id || n.id)).size + 1,
        aggregated_volume_t: group.total_aggregated_volume_ton || 0,
        is_already_assigned: raw.is_already_assigned,
        assignment_status: raw.assignment_status,
        recommended_zone: zone ? {
          id: zone.zone_id || zone.id,
          zone_id: zone.zone_id || zone.id,
          zone_code: zone.zone_code,
          name: zone.zone_name || zone.name,
          hub_latitude: zone.latitude,
          hub_longitude: zone.longitude,
          distance_km: zone.distance_km,
          facility_id: facility ? (facility.facility_id || facility.id) : null
        } : null,
        associated_facility: facility ? {
          id: facility.facility_id || facility.id,
          name: facility.facility_name || facility.name,
          code: facility.facility_code,
          latitude: facility.latitude,
          longitude: facility.longitude
        } : null
      };
    },

    /* Returns zones with lat/lng for map plotting, normalized from dashboard payload. */
    getZones: async () => {
      const summary = await withFallback('/operators/dashboard', null, () => ({ routing: { zones: zoneAggregates() } }));
      const zones = (summary.routing || {}).zones || [];
      // Supplement with all zones from feedstock.by_zone for zones with no assigned batches
      const allZones = (summary.feedstock || {}).by_zone || zones;
      const zoneMap = {};
      zones.forEach((z) => { zoneMap[z.zone_id] = z; });
      return allZones.map((z) => ({
        id: z.zone_id,
        zone_id: z.zone_id,
        zone_code: z.zone_code,
        zone_name: z.zone_name,
        name: z.zone_name,
        province: z.province,
        latitude: z.latitude || null,
        longitude: z.longitude || null,
        hub_latitude: z.latitude || null,
        hub_longitude: z.longitude || null,
        batch_count: z.batch_count || (zoneMap[z.zone_id] || {}).assigned_batch_count || 0,
        aggregated_volume_t: z.total_straw_ton || (zoneMap[z.zone_id] || {}).aggregated_straw_ton || 0,
        facility_name: (zoneMap[z.zone_id] || {}).facility_name || null,
        facility_code: (zoneMap[z.zone_id] || {}).facility_code || null
      }));
    },

    getZoneAggregation: (zoneId) => withFallback(`/collection-zones/${encodeURIComponent(zoneId)}/aggregation`, null, () => {
      const z = zoneAggregates().find((x) => x.id === zoneId);
      if (!z) throw new ApiError('Zone not found', 404);
      return Object.assign({}, z, { batches: BATCHES.filter((b) => b.zone_id === zoneId) });
    }),

    /* Returns facilities from flow-visualization endpoint, normalized. */
    getFacilities: async () => {
      const flow = await withFallback('/routing/flow-visualization', null, () => ({ facilities: FACILITIES.slice() }));
      return ((flow || {}).facilities || []).map((f) => ({
        id: f.facility_id || f.id,
        name: f.facility_name || f.name,
        code: f.facility_code || f.code,
        latitude: f.latitude,
        longitude: f.longitude,
        collection_zones: f.collection_zones || [],
        total_feedstock_volume_ton: f.total_feedstock_volume_ton || 0
      }));
    },

    /* GET carbon + economics for one batch. */
    getCalculation: async (batchId) => {
      const calc = await withFallback(`/calculator/batch/${encodeURIComponent(batchId)}`, { method: 'POST' });
      const b = BATCHES.find((x) => x.id === batchId) || { straw_volume_t: calc.collected_straw_ton }; // fallback
      return {
        scope: 'batch',
        straw_t: b.straw_volume_t,
        collected_straw_t: calc.collected_straw_ton,
        biochar_t: calc.biochar_yield_ton,
        co2e_t: calc.co2e_sequestered_ton,
        gross_value_inr: calc.gross_value_usd,
        production_cost_inr: calc.production_cost_usd,
        margin_pool_inr: calc.margin_pool_usd,
        farmer_payout_inr: calc.farmer_payout_usd,
        batch: b
      };
    },

    /* GET aggregated calculations (all batches). */
    getAggregateCalculation: async () => {
      const summary = await withFallback('/operators/dashboard', null);
      return {
        scope: 'all_batches',
        straw_t: summary.feedstock.total_straw_volume_ton,
        collected_straw_t: summary.routing.total_routed_straw_ton,
        biochar_t: summary.carbon.total_biochar_ton,
        co2e_t: summary.carbon.total_co2e_ton,
        gross_value_inr: summary.economics.total_gross_value_usd,
        production_cost_inr: summary.economics.total_production_cost_usd,
        margin_pool_inr: summary.economics.total_margin_pool_usd,
        farmer_payout_inr: summary.economics.total_farmer_payout_usd
      };
    },

    /* GET routing flow visualization: facilities with their collection zones. */
    getRouting: async () => {
      const raw = await withFallback('/routing/flow-visualization', null, () => ({
        facilities: FACILITIES.map((f) => Object.assign({}, f, {
          collection_zones: ZONES.filter((z) => z.facility_id === f.id).map((z) => ({
            zone_id: z.id, zone_code: z.code, zone_name: z.name,
            latitude: z.hub_latitude, longitude: z.hub_longitude,
            total_assigned_volume_ton: 0, assigned_plots: []
          }))
        }))
      }));
      // Normalize facilities to have id/name for map consumers
      if (raw && raw.facilities) {
        raw.facilities = raw.facilities.map((f) => Object.assign({}, f, {
          id: f.facility_id || f.id,
          name: f.facility_name || f.name,
          code: f.facility_code || f.code
        }));
      }
      return raw;
    },

    assignZone: (batchId, zoneId) => withFallback(
      `/routing/assign`,
      { method: 'POST', body: { batch_ids: [batchId], zone_id: zoneId } },
      () => {
        const b = BATCHES.find((x) => x.id === batchId);
        if (!b) throw new ApiError('Batch not found', 404);
        b.zone_id = zoneId; b.status = 'assigned';
        return { batch_id: batchId, zone_id: zoneId, status: 'assigned' };
      }
    ),

    /* ---- MRV ---- */
    getMrvRecords: (filters) => withFallback('/mrv/ledger', null, () => {
      let rows = sampleMrv.slice();
      if (filters) {
        if (filters.status && filters.status !== 'all') rows = rows.filter((m) => m.status === filters.status);
        if (filters.q) {
          const q = filters.q.toLowerCase();
          rows = rows.filter((m) =>
            [m.id, m.batch_id, m.farmer_name, m.village, m.district, m.zone_name].join(' ').toLowerCase().includes(q)
          );
        }
      }
      return rows;
    }),

    getMrvRecord: (id) => withFallback(`/mrv/${encodeURIComponent(id)}`, null, () => {
      const m = sampleMrv.find((x) => x.id === id);
      if (!m) throw new ApiError('MRV record not found', 404);
      return m;
    }),

    updateMrvStatus: (id, status, note) => withFallback(
      `/mrv/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: { status, rejection_reason: status === 'rejected' ? (note || '') : null, notes: status !== 'rejected' ? (note || '') : null } },
      () => {
        const m = sampleMrv.find((x) => x.id === id);
        if (!m) throw new ApiError('MRV record not found', 404);
        m.status = status;
        if (note) m.rejection_reason = note;
        m.updated_at = new Date().toISOString();
        return m;
      }
    ),

    getMrvSummary: () => withFallback('/operators/dashboard', null, () => buildSummary()).then(res => res.data ? res.data.mrv : res.mrv),

    _internal: { haversineKm, calcForBatch }
  };
})();
