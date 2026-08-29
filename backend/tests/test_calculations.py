from app.modules.calculator.service import run_calculation

def test_reference_case_calculations():
    """Test the reference case from Phase 13 requirements."""
    # 1,000 tonnes straw
    res = run_calculation(straw_volume_ton=1000.0)
    
    # 50% collection fraction -> 500 tonnes collected
    assert res.collected_straw_ton == 500.0
    
    # 28% biochar yield -> 140 tonnes biochar
    assert res.biochar_yield_ton == 140.0
    
    # 2.15 CO2 factor -> 301 tCO2e
    assert round(res.co2e_sequestered_ton, 1) == 301.0
    
    # $350 market value per tonne -> $49,000 gross value
    assert res.gross_value_usd == 49000.0
    
    # $150 production cost per tonne -> $21,000 production cost
    assert res.production_cost_usd == 21000.0
    
    # Margin Pool = $49,000 - $21,000 = $28,000
    assert res.margin_pool_usd == 28000.0
    
    # 30% farmer share -> $8,400 farmer payout
    assert res.farmer_payout_usd == 8400.0
