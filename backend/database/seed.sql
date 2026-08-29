-- =============================================================================
-- STRAW LEDGER - SEED DATA (Phase 2)
-- Run AFTER schema.sql
-- All UUIDs are fixed so that foreign-key references remain consistent.
-- =============================================================================

-- =============================================================================
-- COLLECTION ZONES (seed data - real zones needed for routing)
-- =============================================================================
INSERT INTO collection_zones (id, zone_code, zone_name, province, district, center_lat, center_lon, radius_km, is_active)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'CZ-CM-01', 'Chiang Mai North Zone',    'Chiang Mai', 'Mae Rim',    18.9271, 98.9088, 12.0, TRUE),
    ('a1000000-0000-0000-0000-000000000002', 'CZ-CM-02', 'Chiang Mai South Zone',    'Chiang Mai', 'San Pa Tong', 18.5360, 98.9110, 10.0, TRUE),
    ('a1000000-0000-0000-0000-000000000003', 'CZ-CM-03', 'Chiang Mai East Zone',     'Chiang Mai', 'Mae On',     18.8650, 99.1550, 15.0, TRUE),
    ('a1000000-0000-0000-0000-000000000004', 'CZ-LP-01', 'Lamphun Central Zone',     'Lamphun',    'Mueang',     18.5746, 98.9667, 10.0, TRUE),
    ('a1000000-0000-0000-0000-000000000005', 'CZ-CR-01', 'Chiang Rai North Zone',    'Chiang Rai', 'Mueang',     19.9105, 99.8406, 12.0, TRUE),
    ('a1000000-0000-0000-0000-000000000006', 'CZ-CR-02', 'Chiang Rai South Zone',    'Chiang Rai', 'Wiang Chai', 19.7500, 99.8800, 10.0, TRUE),
    ('a1000000-0000-0000-0000-000000000007', 'CZ-NAN-01','Nan Valley Zone',          'Nan',        'Mueang',     18.7796, 100.7763, 20.0, TRUE),
    ('a1000000-0000-0000-0000-000000000008', 'CZ-PY-01', 'Phayao Central Zone',      'Phayao',     'Mueang',     19.1644, 99.9040, 15.0, TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PYROLYSIS OPERATORS (sample companies)
-- =============================================================================
INSERT INTO pyrolysis_operators (id, company_name, contact_person, email, phone_number, license_number, is_active)
VALUES
    ('b1000000-0000-0000-0000-000000000001',
     'GreenChar Thailand Co., Ltd.',
     'Somchai Pongpan',
     'ops@greenchar.co.th',
     '+66812345678',
     'MOI-2024-0145',
     TRUE),
    ('b1000000-0000-0000-0000-000000000002',
     'BioCycle Agro Processing Co., Ltd.',
     'Nantawan Srisuk',
     'contact@biocycle-agro.com',
     '+66823456789',
     'MOI-2024-0202',
     TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PYROLYSIS FACILITIES
-- =============================================================================
INSERT INTO pyrolysis_facilities (id, operator_id, facility_name, facility_code, address, province, latitude, longitude, capacity_ton_per_day, is_active)
VALUES
    ('c1000000-0000-0000-0000-000000000001',
     'b1000000-0000-0000-0000-000000000001',
     'GreenChar Chiang Mai Plant 1',
     'PF-CM-01',
     '123 Mae Rim Industrial Road, Mae Rim, Chiang Mai 50180',
     'Chiang Mai',
     18.9305,
     98.9150,
     25.00,
     TRUE),
    ('c1000000-0000-0000-0000-000000000002',
     'b1000000-0000-0000-0000-000000000001',
     'GreenChar Lamphun Plant',
     'PF-LP-01',
     '45 Lamphun Industrial Estate, Lamphun 51000',
     'Lamphun',
     18.5640,
     98.9710,
     15.00,
     TRUE),
    ('c1000000-0000-0000-0000-000000000003',
     'b1000000-0000-0000-0000-000000000002',
     'BioCycle Chiang Rai Facility',
     'PF-CR-01',
     '78 Mueang Chiang Rai, Chiang Rai 57000',
     'Chiang Rai',
     19.9200,
     99.8320,
     20.00,
     TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST FARMER
-- =============================================================================
INSERT INTO farmers (id, full_name, phone_number, national_id, village, district, province, bank_account, is_active)
VALUES
    ('d1000000-0000-0000-0000-000000000001',
     'Wanchai Boonmee',
     '+66891234567',
     '5501234567890',
     'Ban Mae Sa',
     'Mae Rim',
     'Chiang Mai',
     '0123456789',
     TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST PLOT LOCATION (belongs to test farmer)
-- =============================================================================
INSERT INTO plot_locations (id, farmer_id, plot_name, latitude, longitude, area_rai, soil_type, province, district, is_active)
VALUES
    ('e1000000-0000-0000-0000-000000000001',
     'd1000000-0000-0000-0000-000000000001',
     'North Rice Field',
     18.9140,
     98.9200,
     8.50,
     'Sandy Loam',
     'Chiang Mai',
     'Mae Rim',
     TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST STRAW BATCH (farmer -> plot -> batch)
-- =============================================================================
INSERT INTO straw_batches (id, farmer_id, plot_id, batch_code, harvest_date, straw_volume_ton, moisture_pct, rice_variety, status)
VALUES
    ('f1000000-0000-0000-0000-000000000001',
     'd1000000-0000-0000-0000-000000000001',
     'e1000000-0000-0000-0000-000000000001',
     'SB-2024-00001',
     '2024-11-15',
     12.500,
     18.50,
     'Khao Hom Mali 105',
     'collected')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST ROUTING ASSIGNMENT (batch -> zone -> facility)
-- =============================================================================
INSERT INTO routing_assignments (id, batch_id, collection_zone_id, facility_id, scheduled_pickup, scheduled_delivery, distance_km, transport_cost_thb, assignment_status)
VALUES
    ('a7000000-0000-0000-0000-000000000001',
     'f1000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001',
     '2024-11-17',
     '2024-11-18',
     18.50,
     2775.00,
     'delivered')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST CALCULATION RESULT (batch -> calculation)
-- =============================================================================
INSERT INTO calculation_results (
    id, batch_id,
    collected_straw_ton, biochar_yield_ton, biochar_yield_pct,
    co2e_sequestered_ton,
    gross_value_thb, production_cost_thb, margin_pool_thb, farmer_payout_thb,
    calculation_version
)
VALUES
    ('a8000000-0000-0000-0000-000000000001',
     'f1000000-0000-0000-0000-000000000001',
     12.2500,      -- collected straw (tonnes, accounting for some loss)
     3.0625,       -- biochar yield (~25% of collected)
     25.00,        -- biochar yield %
     5.5125,       -- CO2e sequestered (tonnes)
     85750.00,     -- gross value (THB)
     37800.00,     -- production cost (THB)
     47950.00,     -- margin pool (THB)
     19180.00,     -- farmer payout (40% of margin pool)
     '1.0')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST MRV RECORD (batch -> MRV)
-- =============================================================================
INSERT INTO mrv_records (
    id, batch_id,
    field_verification_date, field_officer_name, gps_verified,
    actual_intake_date, pyrolysis_start_date, pyrolysis_end_date,
    operating_temp_celsius, retention_time_hours,
    verified_by, verification_date, verification_method,
    mrv_status
)
VALUES
    ('a9000000-0000-0000-0000-000000000001',
     'f1000000-0000-0000-0000-000000000001',
     '2024-11-14',
     'Prida Wongchai',
     TRUE,
     '2024-11-18',
     '2024-11-19',
     '2024-11-20',
     500.00,
     4.00,
     'Dr. Siriporn Klahan',
     '2024-11-25',
     'INTERNAL_REVIEW',
     'verified')
ON CONFLICT (id) DO NOTHING;