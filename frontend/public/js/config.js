/* ============================================================
   THE STRAW LEDGER — Frontend configuration
   Single source for API base URL and display constants.
   ============================================================ */
window.STRAW_LEDGER_CONFIG = {
  /*
   * Base URL of the existing FastAPI backend.
   * Leave '' for same-origin deployments, or set e.g. 'http://localhost:8000/api'.
   * Can be overridden at runtime via localStorage key STRAW_LEDGER_API_BASE.
   */
  API_BASE_URL: 'http://127.0.0.1:8010/api/v1',

  /*
   * When true (and ONLY when the backend cannot be reached), the API layer
   * resolves with a bundled sample dataset and the UI shows a "demo data"
   * indicator. Set to false to fail hard on API errors in production.
   */
  DEMO_FALLBACK: false,

  /* Default search radius for nearby-batch discovery (km) — mirrors backend default. */
  DEFAULT_RADIUS_KM: 25,

  /* Display locale / currency formatting. */
  LOCALE: 'en-IN',
  CURRENCY: 'INR',

  /* OpenFreeMap style for MapLibre GL (no API key required). */
  MAP_STYLE: 'https://tiles.openfreemap.org/styles/positron',
  MAP_CENTER: [75.6, 30.9],
  MAP_ZOOM: 7.4,

  /*
   * System constants shown for transparency in calculation views.
   * The backend remains the source of truth — values returned by the API
   * always take precedence over these.
   */
  SYSTEM_CONSTANTS: {
    COLLECTION_EFFICIENCY: 0.85,   // fraction of registered straw actually collected
    BIOCHAR_YIELD: 0.30,           // tonnes biochar per tonne collected straw
    CDR_FACTOR: 2.5,               // tCO2e sequestered per tonne biochar
    BIOCHAR_PRICE_INR: 22000,      // per tonne biochar
    PRODUCTION_COST_INR: 9000,     // per tonne biochar
    FARMER_SHARE: 0.40             // fraction of margin pool paid to farmers
  },

  APP_NAME: 'The Straw Ledger',
  SEASON_LABEL: 'Rabi 2025–26'
};
