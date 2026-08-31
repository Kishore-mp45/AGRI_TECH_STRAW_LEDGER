"""
Load realistic Vietnam sample data into the Straw Ledger database.
This script populates all tables with representative data for dashboard demonstration.
"""
import uuid
from datetime import datetime

from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def reset_database(session) -> None:
    """Clear any stale records before loading realistic data."""
    session.execute(text("""
        TRUNCATE TABLE
            mrv_records,
            calculation_results,
            routing_assignments,
            straw_batches,
            plot_locations,
            farmers,
            collection_zones,
            pyrolysis_facilities,
            pyrolysis_operators
        RESTART IDENTITY CASCADE
    """))
    session.commit()


def load_data():
    """Load realistic sample data into the database."""
    session = SessionLocal()

    try:
        print("Loading realistic Vietnam data...")
        reset_database(session)

        farmers_data = [
            {
                "full_name": "Nguyễn Văn An",
                "phone_number": "+84912345678",
                "village": "Láng",
                "district": "Đống Đa",
                "province": "Hà Nội",
                "plot_name": "Plot Láng 1",
                "plot_area_acres": 12.5,
                "latitude": 20.98,
                "longitude": 105.78,
                "straw_volume_ton": 35.5,
            },
            {
                "full_name": "Trần Thị Bình",
                "phone_number": "+84987654321",
                "village": "Nam Hồng",
                "district": "Lý Nhân",
                "province": "Hà Nam",
                "plot_name": "Plot Nam Hồng 1",
                "plot_area_acres": 18.0,
                "latitude": 20.50,
                "longitude": 105.92,
                "straw_volume_ton": 52.0,
            },
            {
                "full_name": "Phạm Quốc Cường",
                "phone_number": "+84913456789",
                "village": "Cầu Giấy",
                "district": "Cầu Giấy",
                "province": "Hà Nội",
                "plot_name": "Plot Cầu Giấy 1",
                "plot_area_acres": 15.0,
                "latitude": 21.02,
                "longitude": 105.75,
                "straw_volume_ton": 42.0,
            },
            {
                "full_name": "Lê Minh Tuấn",
                "phone_number": "+84934567890",
                "village": "Hồ Tây",
                "district": "Ba Đình",
                "province": "Hà Nội",
                "plot_name": "Plot Hồ Tây 1",
                "plot_area_acres": 22.0,
                "latitude": 21.05,
                "longitude": 105.82,
                "straw_volume_ton": 61.5,
            },
            {
                "full_name": "Hoàng Văn Sơn",
                "phone_number": "+84945678901",
                "village": "Lương Xá",
                "district": "Bình Lục",
                "province": "Hà Nam",
                "plot_name": "Plot Lương Xá 1",
                "plot_area_acres": 10.5,
                "latitude": 20.48,
                "longitude": 105.88,
                "straw_volume_ton": 28.5,
            },
            {
                "full_name": "Vũ Thị Hương",
                "phone_number": "+84956789012",
                "village": "Bắc Hà",
                "district": "Duy Tiên",
                "province": "Hà Nam",
                "plot_name": "Plot Bắc Hà 1",
                "plot_area_acres": 16.0,
                "latitude": 20.52,
                "longitude": 105.95,
                "straw_volume_ton": 45.0,
            },
            {
                "full_name": "Đinh Văn Lâm",
                "phone_number": "+84967890123",
                "village": "Trần Phú",
                "district": "Hoàng Mai",
                "province": "Hà Nội",
                "plot_name": "Plot Trần Phú 1",
                "plot_area_acres": 13.5,
                "latitude": 21.00,
                "longitude": 105.80,
                "straw_volume_ton": 37.5,
            },
            {
                "full_name": "Đặng Thị Thanh",
                "phone_number": "+84978901234",
                "village": "Kiến Xương",
                "district": "Kim Bảng",
                "province": "Hà Nam",
                "plot_name": "Plot Kiến Xương 1",
                "plot_area_acres": 20.0,
                "latitude": 20.45,
                "longitude": 105.85,
                "straw_volume_ton": 56.0,
            },
        ]

        batch_ids = []
        for farmer_data in farmers_data:
            farmer_id = str(uuid.uuid4())
            plot_id = str(uuid.uuid4())
            batch_id = str(uuid.uuid4())
            batch_code = f"BATCH-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

            session.execute(text("""
                INSERT INTO farmers (
                    id, full_name, phone_number, national_id, village, district, province,
                    created_at, updated_at
                )
                VALUES (
                    :id, :full_name, :phone_number, NULL, :village, :district, :province,
                    NOW(), NOW()
                )
            """), {
                "id": farmer_id,
                "full_name": farmer_data["full_name"],
                "phone_number": farmer_data["phone_number"],
                "village": farmer_data["village"],
                "district": farmer_data["district"],
                "province": farmer_data["province"],
            })

            session.execute(text("""
                INSERT INTO plot_locations (
                    id, farmer_id, plot_name, latitude, longitude, area_rai,
                    province, district, created_at, updated_at
                )
                VALUES (
                    :id, :farmer_id, :plot_name, :latitude, :longitude, :area_rai,
                    :province, :district, NOW(), NOW()
                )
            """), {
                "id": plot_id,
                "farmer_id": farmer_id,
                "plot_name": farmer_data["plot_name"],
                "latitude": farmer_data["latitude"],
                "longitude": farmer_data["longitude"],
                "area_rai": round(farmer_data["plot_area_acres"] * 0.4047, 2),
                "province": farmer_data["province"],
                "district": farmer_data["district"],
            })

            session.execute(text("""
                INSERT INTO straw_batches (
                    id, farmer_id, plot_id, batch_code, harvest_date, straw_volume_ton,
                    status, created_at, updated_at
                )
                VALUES (
                    :id, :farmer_id, :plot_id, :batch_code, NOW()::DATE - INTERVAL '5 days',
                    :straw_volume_ton, 'registered', NOW(), NOW()
                )
            """), {
                "id": batch_id,
                "farmer_id": farmer_id,
                "plot_id": plot_id,
                "batch_code": batch_code,
                "straw_volume_ton": farmer_data["straw_volume_ton"],
            })

            batch_ids.append({
                "batch_id": batch_id,
                "province": farmer_data["province"],
                "volume": farmer_data["straw_volume_ton"],
            })

        session.commit()
        print(f"✅ Inserted {len(farmers_data)} farmers with registered batches")

        zones_data = [
            {
                "zone_code": "ZONE-HN-01",
                "zone_name": "Hà Nội Central Hub",
                "province": "Hà Nội",
                "district": "Ba Đình",
                "latitude": 21.03,
                "longitude": 105.82,
                "radius_km": 15.0,
            },
            {
                "zone_code": "ZONE-HN-02",
                "zone_name": "Hà Nội South Hub",
                "province": "Hà Nội",
                "district": "Hoàng Mai",
                "latitude": 20.95,
                "longitude": 105.80,
                "radius_km": 12.0,
            },
            {
                "zone_code": "ZONE-HN-03",
                "zone_name": "Hà Nam Hub",
                "province": "Hà Nam",
                "district": "Kim Bảng",
                "latitude": 20.50,
                "longitude": 105.90,
                "radius_km": 18.0,
            },
        ]

        zone_ids = []
        for zone in zones_data:
            zone_id = str(uuid.uuid4())
            session.execute(text("""
                INSERT INTO collection_zones (
                    id, zone_code, zone_name, province, district, center_lat, center_lon,
                    radius_km, is_active, created_at
                )
                VALUES (
                    :id, :zone_code, :zone_name, :province, :district, :latitude, :longitude,
                    :radius_km, TRUE, NOW()
                )
            """), {
                "id": zone_id,
                "zone_code": zone["zone_code"],
                "zone_name": zone["zone_name"],
                "province": zone["province"],
                "district": zone["district"],
                "latitude": zone["latitude"],
                "longitude": zone["longitude"],
                "radius_km": zone["radius_km"],
            })
            zone_ids.append(zone_id)

        session.commit()
        print(f"✅ Inserted {len(zones_data)} collection zones")

        operator_id = str(uuid.uuid4())
        session.execute(text("""
            INSERT INTO pyrolysis_operators (
                id, company_name, contact_person, email, phone_number, is_active,
                created_at, updated_at
            )
            VALUES (
                :id, :company_name, :contact_person, :email, :phone_number, TRUE,
                NOW(), NOW()
            )
        """), {
            "id": operator_id,
            "company_name": "Vietnam Biochar Solutions Ltd.",
            "contact_person": "Nguyễn Hữu Minh",
            "email": "operations@vietnambiochar.vn",
            "phone_number": "+84938123456",
        })
        session.commit()
        print("✅ Inserted pyrolysis operator")

        facilities_data = [
            {
                "facility_code": "FAC-HN-01",
                "facility_name": "Hà Nội Biochar Plant 1",
                "province": "Hà Nội",
                "latitude": 21.03,
                "longitude": 105.82,
                "capacity_ton_per_day": 25.0,
            },
            {
                "facility_code": "FAC-HN-02",
                "facility_name": "Hà Nội Biochar Plant 2",
                "province": "Hà Nội",
                "latitude": 20.95,
                "longitude": 105.80,
                "capacity_ton_per_day": 20.0,
            },
            {
                "facility_code": "FAC-HN-03",
                "facility_name": "Hà Nam Biochar Plant 1",
                "province": "Hà Nam",
                "latitude": 20.50,
                "longitude": 105.90,
                "capacity_ton_per_day": 30.0,
            },
        ]

        facility_ids = []
        for facility in facilities_data:
            facility_id = str(uuid.uuid4())
            session.execute(text("""
                INSERT INTO pyrolysis_facilities (
                    id, operator_id, facility_code, facility_name, province,
                    latitude, longitude, capacity_ton_per_day, is_active,
                    created_at, updated_at
                )
                VALUES (
                    :id, :operator_id, :facility_code, :facility_name, :province,
                    :latitude, :longitude, :capacity_ton_per_day, TRUE,
                    NOW(), NOW()
                )
            """), {
                "id": facility_id,
                "operator_id": operator_id,
                "facility_code": facility["facility_code"],
                "facility_name": facility["facility_name"],
                "province": facility["province"],
                "latitude": facility["latitude"],
                "longitude": facility["longitude"],
                "capacity_ton_per_day": facility["capacity_ton_per_day"],
            })
            facility_ids.append(facility_id)

        session.commit()
        print(f"✅ Inserted {len(facilities_data)} pyrolysis facilities")

        for idx, batch_info in enumerate(batch_ids):
            if batch_info["province"] == "Hà Nội":
                zone_id = zone_ids[idx % 2]
                facility_id = facility_ids[idx % 2]
            else:
                zone_id = zone_ids[2]
                facility_id = facility_ids[2]

            session.execute(text("""
                INSERT INTO routing_assignments (
                    id, batch_id, collection_zone_id, facility_id, assigned_at,
                    scheduled_pickup, scheduled_delivery, assignment_status,
                    created_at, updated_at
                )
                VALUES (
                    :id, :batch_id, :collection_zone_id, :facility_id, NOW(),
                    NOW()::DATE, NOW()::DATE + INTERVAL '2 days', 'scheduled',
                    NOW(), NOW()
                )
            """), {
                "id": str(uuid.uuid4()),
                "batch_id": batch_info["batch_id"],
                "collection_zone_id": zone_id,
                "facility_id": facility_id,
            })

        session.commit()
        print(f"✅ Assigned {len(batch_ids)} batches to zones and facilities")

        for batch_info in batch_ids:
            batch_volume = float(batch_info["volume"])
            biochar_yield = batch_volume * 0.35
            co2e = biochar_yield * 2.5
            gross_value = biochar_yield * 650000
            production_cost = biochar_yield * 270000
            margin_pool = gross_value - production_cost
            farmer_payout = margin_pool * 0.40

            session.execute(text("""
                INSERT INTO calculation_results (
                    id, batch_id, collected_straw_ton, biochar_yield_ton,
                    biochar_yield_pct, co2e_sequestered_ton,
                    gross_value_thb, production_cost_thb, margin_pool_thb,
                    farmer_payout_thb, calculation_version, calculated_at,
                    created_at
                )
                VALUES (
                    :id, :batch_id, :collected_straw_ton, :biochar_yield_ton,
                    :biochar_yield_pct, :co2e_sequestered_ton,
                    :gross_value_thb, :production_cost_thb, :margin_pool_thb,
                    :farmer_payout_thb, :calculation_version, NOW(), NOW()
                )
            """), {
                "id": str(uuid.uuid4()),
                "batch_id": batch_info["batch_id"],
                "collected_straw_ton": batch_volume,
                "biochar_yield_ton": biochar_yield,
                "biochar_yield_pct": 35.0,
                "co2e_sequestered_ton": co2e,
                "gross_value_thb": gross_value,
                "production_cost_thb": production_cost,
                "margin_pool_thb": margin_pool,
                "farmer_payout_thb": farmer_payout,
                "calculation_version": "1.0",
            })

            session.execute(text("""
                INSERT INTO mrv_records (
                    id, batch_id, field_verification_date, field_officer_name,
                    gps_verified, actual_intake_date, pyrolysis_start_date,
                    pyrolysis_end_date, verification_date, verification_method,
                    mrv_status, carbon_credit_ref, notes, created_at, updated_at
                )
                VALUES (
                    :id, :batch_id, NOW()::DATE - INTERVAL '1 day', :field_officer_name,
                    TRUE, NOW()::DATE - INTERVAL '3 days', NOW()::DATE - INTERVAL '2 days',
                    NOW()::DATE - INTERVAL '1 day', NOW()::DATE, 'field_verification',
                    'verified', :carbon_credit_ref, :notes, NOW(), NOW()
                )
            """), {
                "id": str(uuid.uuid4()),
                "batch_id": batch_info["batch_id"],
                "field_officer_name": "Nguyễn Thị Lan",
                "carbon_credit_ref": f"VNM-CR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
                "notes": "Verified through field visit, weighbridge record and chain-of-custody logs.",
            })

        session.commit()
        print(f"✅ Inserted MRV verification records for all {len(batch_ids)} batches")

        total_straw = sum(b["volume"] for b in batch_ids)
        total_biochar = total_straw * 0.35
        total_co2 = total_biochar * 2.5
        total_gross_value = total_biochar * 650000
        total_farmer_payout = total_biochar * 150

        print("\n" + "=" * 60)
        print("📊 DASHBOARD DATA SUMMARY")
        print("=" * 60)
        print(f"✅ Total Farmers Registered: {len(farmers_data)}")
        print(f"✅ Total Batches (Registered): {len(batch_ids)}")
        print(f"✅ Total Straw Volume: {total_straw:.1f} tonnes")
        print(f"✅ Expected Biochar Yield: {total_biochar:.1f} tonnes")
        print(f"✅ CO₂ Sequestration: {total_co2:.1f} tonnes CO₂e")
        print(f"✅ Gross Value: ₫{total_gross_value:,.0f}")
        print(f"✅ Farmer Payout: ${total_farmer_payout:,.0f}")
        print(f"✅ Collection Zones: {len(zone_ids)}")
        print(f"✅ Pyrolysis Facilities: {len(facility_ids)}")
        print("=" * 60)
        print("✅ All realistic data loaded successfully!\n")

    except Exception as exc:
        session.rollback()
        print(f"❌ Error loading data: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    load_data()
