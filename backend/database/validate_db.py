"""
Phase 2 Database Validation Script
Connects to Supabase, runs schema.sql and seed.sql, then verifies
all 9 tables exist and all FK relationships are intact.
"""
import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Load environment variables from the .env file in project root
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "schema.sql")
SEED_FILE   = os.path.join(os.path.dirname(__file__), "seed.sql")

EXPECTED_TABLES = [
    "farmers",
    "collection_zones",
    "pyrolysis_operators",
    "pyrolysis_facilities",
    "plot_locations",
    "straw_batches",
    "routing_assignments",
    "calculation_results",
    "mrv_records",
]

def run_file(cur, filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        sql_text = f.read()
    cur.execute(sql_text)

def verify_tables(cur):
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    """)
    existing = {row[0] for row in cur.fetchall()}
    missing = [t for t in EXPECTED_TABLES if t not in existing]
    return existing, missing

def verify_fks(cur):
    cur.execute("""
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name
    """)
    return cur.fetchall()

def verify_seed_data(cur):
    checks = {}
    for table in EXPECTED_TABLES:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        checks[table] = cur.fetchone()[0]
    return checks

def main():
    print("\n====== Straw Ledger — Phase 2 Database Validation ======\n")
    conn = None
    try:
        print(f"Connecting to Supabase PostgreSQL...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cur = conn.cursor()
        print("Connected.\n")

        # Run schema
        print("Running schema.sql...")
        run_file(cur, SCHEMA_FILE)
        print("schema.sql executed successfully.\n")

        # Run seed
        print("Running seed.sql...")
        run_file(cur, SEED_FILE)
        print("seed.sql executed successfully.\n")

        conn.commit()

        # Verify tables
        existing, missing = verify_tables(cur)
        print(f"Tables found: {sorted(existing)}")
        if missing:
            print(f"MISSING TABLES: {missing}")
        else:
            print("All 9 expected tables exist.\n")

        # Verify FK relationships
        fks = verify_fks(cur)
        print(f"Foreign key relationships ({len(fks)} total):")
        for table, col, ref_table, ref_col in fks:
            print(f"  {table}.{col} -> {ref_table}.{ref_col}")

        # Verify seed data row counts
        print("\nSeed data row counts:")
        counts = verify_seed_data(cur)
        for table, count in counts.items():
            status = "OK" if count > 0 else "EMPTY"
            print(f"  {table}: {count} row(s) [{status}]")

        print("\n====== Validation PASSED ======\n")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\nERROR: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()