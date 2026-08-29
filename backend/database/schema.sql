-- =============================================================================
-- STRAW LEDGER - DATABASE SCHEMA (Phase 2)
-- Database: Supabase PostgreSQL
-- =============================================================================
-- Entity Relationship Overview:
--
--   farmers
--     |-- plot_locations          (one farmer -> many plots)
--     |-- straw_batches           (one farmer -> many batches, via a plot)
--
--   collection_zones
--     |-- routing_assignments     (one zone -> many routing assignments)
--
--   pyrolysis_operators
--     |-- pyrolysis_facilities    (one operator -> many facilities)
--
--   straw_batches
--     |-- routing_assignments     (one batch -> one routing assignment)
--     |-- calculation_results     (one batch -> one calculation result)
--     |-- mrv_records             (one batch -> one MRV record)
--
--   routing_assignments
--     |-- straw_batches           (FK: batch being routed)
--     |-- collection_zones        (FK: zone where straw is collected)
--     |-- pyrolysis_facilities    (FK: facility that processes the batch)
-- =============================================================================

-- Enable the pgcrypto extension for gen_random_uuid() (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. FARMERS
-- Represents individual rice farmers registered in the platform.
-- =============================================================================
CREATE TABLE IF NOT EXISTS farmers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT        NOT NULL,
    phone_number    TEXT        NOT NULL UNIQUE,
    national_id     TEXT        UNIQUE,
    village         TEXT        NOT NULL,
    district        TEXT        NOT NULL,
    province        TEXT        NOT NULL,
    bank_account    TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT farmers_phone_format CHECK (phone_number ~ '^\+?[0-9]{9,15}$'),
    CONSTRAINT farmers_full_name_not_empty CHECK (TRIM(full_name) <> '')
);

COMMENT ON TABLE farmers IS 'Registered rice farmers who participate in the straw collection program.';
COMMENT ON COLUMN farmers.bank_account IS 'Used for automated payouts in future phases.';

-- =============================================================================
-- 2. COLLECTION ZONES
-- Geographical zones where straw is collected. Independent entity - no FK to farmers.
-- Used by routing assignments to specify pick-up areas.
-- =============================================================================
CREATE TABLE IF NOT EXISTS collection_zones (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_code       TEXT           NOT NULL UNIQUE,
    zone_name       TEXT           NOT NULL,
    province        TEXT           NOT NULL,
    district        TEXT           NOT NULL,
    center_lat      NUMERIC(10, 7) NOT NULL,
    center_lon      NUMERIC(10, 7) NOT NULL,
    radius_km       NUMERIC(6, 2)  NOT NULL DEFAULT 10,
    is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT collection_zones_lat_range  CHECK (center_lat  BETWEEN -90  AND 90),
    CONSTRAINT collection_zones_lon_range  CHECK (center_lon  BETWEEN -180 AND 180),
    CONSTRAINT collection_zones_radius_pos CHECK (radius_km > 0)
);

COMMENT ON TABLE collection_zones IS 'Defined geographical zones for straw collection logistics.';
COMMENT ON COLUMN collection_zones.zone_code IS 'Human-readable unique code like CZ-CM-01 for Chiang Mai Zone 1.';

-- =============================================================================
-- 3. PYROLYSIS OPERATORS
-- Companies or organizations that own and operate pyrolysis facilities.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pyrolysis_operators (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    TEXT        NOT NULL,
    contact_person  TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    phone_number    TEXT        NOT NULL,
    license_number  TEXT        UNIQUE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pyrolysis_operators_email_format   CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    CONSTRAINT pyrolysis_operators_name_not_empty CHECK (TRIM(company_name) <> '')
);

COMMENT ON TABLE pyrolysis_operators IS 'Companies that own pyrolysis facilities and process straw into biochar.';

-- =============================================================================
-- 4. PYROLYSIS FACILITIES
-- Physical pyrolysis plant locations, each owned by an operator.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pyrolysis_facilities (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id          UUID           NOT NULL REFERENCES pyrolysis_operators(id) ON DELETE RESTRICT,
    facility_name        TEXT           NOT NULL,
    facility_code        TEXT           NOT NULL UNIQUE,
    address              TEXT,
    province             TEXT           NOT NULL,
    latitude             NUMERIC(10, 7) NOT NULL,
    longitude            NUMERIC(10, 7) NOT NULL,
    capacity_ton_per_day NUMERIC(8, 2)  NOT NULL,
    is_active            BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT pyrolysis_facilities_lat_range    CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT pyrolysis_facilities_lon_range    CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT pyrolysis_facilities_capacity_pos CHECK (capacity_ton_per_day > 0)
);

COMMENT ON TABLE pyrolysis_facilities IS 'Physical pyrolysis plant locations. Each belongs to one operator.';
COMMENT ON COLUMN pyrolysis_facilities.capacity_ton_per_day IS 'Maximum straw intake capacity in metric tonnes per day.';

-- =============================================================================
-- 5. PLOT LOCATIONS
-- Agricultural plots owned by farmers. Each plot is tied to exactly one farmer.
-- =============================================================================
CREATE TABLE IF NOT EXISTS plot_locations (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id   UUID           NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    plot_name   TEXT           NOT NULL,
    latitude    NUMERIC(10, 7) NOT NULL,
    longitude   NUMERIC(10, 7) NOT NULL,
    area_rai    NUMERIC(8, 2)  NOT NULL,
    soil_type   TEXT,
    province    TEXT           NOT NULL,
    district    TEXT           NOT NULL,
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT plot_locations_lat_range      CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT plot_locations_lon_range      CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT plot_locations_area_pos       CHECK (area_rai > 0),
    CONSTRAINT plot_locations_name_not_empty CHECK (TRIM(plot_name) <> '')
);

COMMENT ON TABLE plot_locations IS 'Registered agricultural plots owned by farmers. Used as harvest origin for straw batches.';
COMMENT ON COLUMN plot_locations.area_rai IS 'Area measured in Thai Rai units. 1 Rai = 1,600 m2.';

-- =============================================================================
-- 6. STRAW BATCHES
-- A specific harvest event from a farmer's plot. Central entity that links to
-- routing, calculation, and MRV records.
-- =============================================================================
CREATE TABLE IF NOT EXISTS straw_batches (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id        UUID           NOT NULL REFERENCES farmers(id) ON DELETE RESTRICT,
    plot_id          UUID           NOT NULL REFERENCES plot_locations(id) ON DELETE RESTRICT,
    batch_code       TEXT           NOT NULL UNIQUE,
    harvest_date     DATE           NOT NULL,
    straw_volume_ton NUMERIC(8, 3)  NOT NULL,
    moisture_pct     NUMERIC(5, 2),
    rice_variety     TEXT,
    notes            TEXT,
    status           TEXT           NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'collected', 'processed', 'completed', 'cancelled')),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT straw_batches_volume_pos     CHECK (straw_volume_ton > 0),
    CONSTRAINT straw_batches_moisture_range CHECK (moisture_pct IS NULL OR moisture_pct BETWEEN 0 AND 100)
);

COMMENT ON TABLE straw_batches IS 'A discrete straw harvest event from a specific farmer plot. This is the central entity - routing, calculation, and MRV all reference a batch.';
COMMENT ON COLUMN straw_batches.straw_volume_ton IS 'Estimated straw volume in metric tonnes at time of harvest.';
COMMENT ON COLUMN straw_batches.status IS 'Lifecycle: pending -> collected -> processed -> completed. Can be cancelled at any stage.';

-- =============================================================================
-- 7. ROUTING ASSIGNMENTS
-- Connects a straw batch to a specific collection zone and pyrolysis facility.
-- =============================================================================
CREATE TABLE IF NOT EXISTS routing_assignments (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id           UUID           NOT NULL UNIQUE REFERENCES straw_batches(id) ON DELETE RESTRICT,
    collection_zone_id UUID           NOT NULL REFERENCES collection_zones(id) ON DELETE RESTRICT,
    facility_id        UUID           NOT NULL REFERENCES pyrolysis_facilities(id) ON DELETE RESTRICT,
    assigned_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    scheduled_pickup   DATE,
    scheduled_delivery DATE,
    distance_km        NUMERIC(8, 2),
    transport_cost_thb NUMERIC(12, 2),
    assignment_status  TEXT           NOT NULL DEFAULT 'scheduled'
                       CHECK (assignment_status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
    notes              TEXT,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT routing_distance_pos       CHECK (distance_km IS NULL OR distance_km >= 0),
    CONSTRAINT routing_transport_cost_pos CHECK (transport_cost_thb IS NULL OR transport_cost_thb >= 0),
    CONSTRAINT routing_schedule_order     CHECK (
        scheduled_pickup IS NULL
        OR scheduled_delivery IS NULL
        OR scheduled_delivery >= scheduled_pickup
    )
);

COMMENT ON TABLE routing_assignments IS 'Logistics routing for a straw batch: which collection zone picks it up and which facility processes it. Each batch has at most one routing assignment (UNIQUE on batch_id).';
COMMENT ON COLUMN routing_assignments.distance_km IS 'Distance in km from collection zone centroid to pyrolysis facility.';

-- =============================================================================
-- 8. CALCULATION RESULTS
-- Stores economic and carbon output calculations for a straw batch.
-- =============================================================================
CREATE TABLE IF NOT EXISTS calculation_results (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id             UUID           NOT NULL UNIQUE REFERENCES straw_batches(id) ON DELETE RESTRICT,
    collected_straw_ton  NUMERIC(10, 4) NOT NULL,
    biochar_yield_ton    NUMERIC(10, 4) NOT NULL,
    biochar_yield_pct    NUMERIC(5, 2),
    co2e_sequestered_ton NUMERIC(10, 4) NOT NULL,
    gross_value_thb      NUMERIC(14, 2) NOT NULL,
    production_cost_thb  NUMERIC(14, 2) NOT NULL,
    margin_pool_thb      NUMERIC(14, 2) NOT NULL,
    farmer_payout_thb    NUMERIC(14, 2) NOT NULL,
    calculation_version  TEXT           NOT NULL DEFAULT '1.0',
    calculated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT calc_collected_straw_pos CHECK (collected_straw_ton > 0),
    CONSTRAINT calc_biochar_pos         CHECK (biochar_yield_ton >= 0),
    CONSTRAINT calc_biochar_pct_range   CHECK (biochar_yield_pct IS NULL OR biochar_yield_pct BETWEEN 0 AND 100),
    CONSTRAINT calc_co2e_pos            CHECK (co2e_sequestered_ton >= 0),
    CONSTRAINT calc_gross_value_pos     CHECK (gross_value_thb >= 0),
    CONSTRAINT calc_prod_cost_pos       CHECK (production_cost_thb >= 0),
    CONSTRAINT calc_farmer_payout_pos   CHECK (farmer_payout_thb >= 0)
);

COMMENT ON TABLE calculation_results IS 'Economic and carbon impact calculations for a processed straw batch. Linked 1:1 with straw_batches. calculation_version enables formula auditability.';
COMMENT ON COLUMN calculation_results.margin_pool_thb IS 'gross_value_thb - production_cost_thb. The pool distributed to farmers.';
COMMENT ON COLUMN calculation_results.farmer_payout_thb IS 'Farmer monetary share from the margin pool.';

-- =============================================================================
-- 9. MRV RECORDS
-- Monitoring, Reporting, and Verification records for a straw batch.
-- Tracks source conditions, operational details, and verification status.
-- Does NOT duplicate data from calculation_results or straw_batches.
-- =============================================================================
CREATE TABLE IF NOT EXISTS mrv_records (
    id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id                UUID           NOT NULL UNIQUE REFERENCES straw_batches(id) ON DELETE RESTRICT,
    -- Source / Field Monitoring
    field_verification_date DATE,
    field_officer_name      TEXT,
    gps_verified            BOOLEAN        NOT NULL DEFAULT FALSE,
    field_photos_urls       TEXT[],
    -- Operational Data
    actual_intake_date      DATE,
    pyrolysis_start_date    DATE,
    pyrolysis_end_date      DATE,
    operating_temp_celsius  NUMERIC(6, 2),
    retention_time_hours    NUMERIC(6, 2),
    -- Reporting and Verification
    report_submitted_at     TIMESTAMPTZ,
    verified_by             TEXT,
    verification_date       DATE,
    verification_method     TEXT,
    mrv_status              TEXT           NOT NULL DEFAULT 'pending'
                            CHECK (mrv_status IN ('pending', 'submitted', 'under_review', 'verified', 'rejected')),
    rejection_reason        TEXT,
    carbon_credit_ref       TEXT           UNIQUE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT mrv_pyrolysis_dates_order CHECK (
        pyrolysis_start_date IS NULL
        OR pyrolysis_end_date IS NULL
        OR pyrolysis_end_date >= pyrolysis_start_date
    ),
    CONSTRAINT mrv_temp_positive      CHECK (operating_temp_celsius IS NULL OR operating_temp_celsius > 0),
    CONSTRAINT mrv_retention_positive CHECK (retention_time_hours IS NULL OR retention_time_hours > 0)
);

COMMENT ON TABLE mrv_records IS 'Monitoring, Reporting, and Verification records for a straw batch. Tracks field verification, operational parameters, and audit status. Linked 1:1 with straw_batches.';
COMMENT ON COLUMN mrv_records.field_photos_urls IS 'Array of Supabase Storage URLs to field verification photos.';
COMMENT ON COLUMN mrv_records.carbon_credit_ref IS 'Reference ID from external carbon credit registry (e.g., Verra, Gold Standard).';

-- =============================================================================
-- INDEXES - for common query patterns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_plot_locations_farmer_id        ON plot_locations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_straw_batches_farmer_id         ON straw_batches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_straw_batches_plot_id           ON straw_batches(plot_id);
CREATE INDEX IF NOT EXISTS idx_straw_batches_status            ON straw_batches(status);
CREATE INDEX IF NOT EXISTS idx_straw_batches_harvest_date      ON straw_batches(harvest_date);
CREATE INDEX IF NOT EXISTS idx_routing_assignments_zone_id     ON routing_assignments(collection_zone_id);
CREATE INDEX IF NOT EXISTS idx_routing_assignments_facility_id ON routing_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_pyrolysis_facilities_operator   ON pyrolysis_facilities(operator_id);
CREATE INDEX IF NOT EXISTS idx_mrv_records_status              ON mrv_records(mrv_status);

-- =============================================================================
-- AUTO-UPDATE updated_at TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_farmers_updated_at
    BEFORE UPDATE ON farmers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pyrolysis_operators_updated_at
    BEFORE UPDATE ON pyrolysis_operators
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pyrolysis_facilities_updated_at
    BEFORE UPDATE ON pyrolysis_facilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plot_locations_updated_at
    BEFORE UPDATE ON plot_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_straw_batches_updated_at
    BEFORE UPDATE ON straw_batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_routing_assignments_updated_at
    BEFORE UPDATE ON routing_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_mrv_records_updated_at
    BEFORE UPDATE ON mrv_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();