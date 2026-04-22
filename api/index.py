from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="CS2 Predictions Calculations API", version="1.0.0")

class PayoutRequest(BaseModel):
    wager_amount: float
    odds_percent: float

class PayoutResponse(BaseModel):
    potential_payout: float
    profit: float

@app.post("/calculate-payout", response_model=PayoutResponse)
def calculate_payout(req: PayoutRequest):
    if req.odds_percent <= 0:
        return PayoutResponse(potential_payout=0.0, profit=0.0)
    
    payout = req.wager_amount / (req.odds_percent / 100.0)
    profit = payout - req.wager_amount
    
    return PayoutResponse(
        potential_payout=round(payout, 2),
        profit=round(profit, 2)
    )

class CoefficientRequest(BaseModel):
    odds_percent: float

class CoefficientResponse(BaseModel):
    coefficient: float

@app.post("/calculate-coefficient", response_model=CoefficientResponse)
def calculate_coefficient(req: CoefficientRequest):
    if req.odds_percent <= 0:
        return CoefficientResponse(coefficient=0.0)
    
    coefficient = 100.0 / req.odds_percent
    return CoefficientResponse(coefficient=round(coefficient, 2))

class OddsRequest(BaseModel):
    initial_a_odds_percent: float
    initial_b_odds_percent: float
    total_wager_a: float
    total_wager_b: float
    liquidity: float = 1000.0
    new_wager_amount: float
    predicted_team: str  # 'team_a' or 'team_b'

class OddsResponse(BaseModel):
    new_a_odds_percent: float
    new_b_odds_percent: float

@app.post("/calculate-odds", response_model=OddsResponse)
def calculate_odds(req: OddsRequest):
    # Simulate adding the new wager
    current_wager_a = req.total_wager_a
    current_wager_b = req.total_wager_b
    
    if req.predicted_team == 'team_a':
        current_wager_a += req.new_wager_amount
    elif req.predicted_team == 'team_b':
        current_wager_b += req.new_wager_amount
        
    # Calculate virtual pools using liquidity knob and initial odds
    virtual_a = (req.liquidity * (req.initial_a_odds_percent / 100.0)) + current_wager_a
    virtual_b = (req.liquidity * (req.initial_b_odds_percent / 100.0)) + current_wager_b
    
    total_virtual = virtual_a + virtual_b
    
    if total_virtual == 0:
        return OddsResponse(new_a_odds_percent=50.0, new_b_odds_percent=50.0)
        
    # Calculate new odds using net stake imbalance
    new_a_odds = round((virtual_a / total_virtual) * 100.0, 2)
    new_b_odds = round((virtual_b / total_virtual) * 100.0, 2)
    
    # Apply Cap range (controlled band between 5% and 95%) 
    if new_a_odds > 95:
        new_a_odds = 95.0
        new_b_odds = 5.0
    elif new_a_odds < 5:
        new_a_odds = 5.0
        new_b_odds = 95.0
        
    return OddsResponse(
        new_a_odds_percent=new_a_odds,
        new_b_odds_percent=new_b_odds
    )
