"""
app/config/constants.py

Single source of truth for all MVP calculation constants.
All financial values are in USD.
Update CONSTANTS here when assumptions change between phases.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class MVPConstants:
    """
    Immutable MVP calculation constants.
    Financial values are in USD per tonne of biochar.
    """
    # --- Logistics ---
    COLLECTION_FRACTION: float = 0.50       # 50% of straw volume is collected
    GROUPING_RADIUS_KM: float = 10.0        # Radius to find nearby batches for aggregation

    # --- Pyrolysis ---
    BIOCHAR_YIELD: float = 0.28             # 28% of collected straw converts to biochar

    # --- Carbon ---
    CO2_FACTOR: float = 2.15               # tCO2e sequestered per tonne of biochar

    # --- Economics (USD / tonne of biochar) ---
    MARKET_VALUE_USD_PER_TON: float = 350.0
    PRODUCTION_COST_USD_PER_TON: float = 150.0

    # --- Revenue Distribution ---
    FARMER_SHARE: float = 0.30             # 30% of margin pool goes to farmer

    # --- Versioning (for audit trail in calculation_results) ---
    VERSION: str = "1.0-MVP"


# Single shared instance — import this everywhere
CONSTANTS = MVPConstants()