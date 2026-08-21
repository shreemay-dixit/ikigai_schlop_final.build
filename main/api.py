import os
import sys
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

# Ensure module path resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from queuing_theory import compute_queuing_baseline, compute_positional_wait, compute_erlang_c_wait_scalar
from rate_tracker import tracker
from intent_extractor import extract_queue_intent, QueueIntent

app = FastAPI(
    title="Hybrid Queue Wait Predictor & Intake API",
    description="Deterministic M/M/c Erlang-C + Positional Queuing Baseline + Random Forest Residual Model + Gemini Intent Extraction",
    version="2.1.0"
)

# Enable CORS for frontend web integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model path resolution
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wait_predictor_cv.pkl")
model = None

def get_model():
    global model
    if model is None and os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
        except Exception as e:
            print(f"Warning: Could not load model from {MODEL_PATH}: {e}")
            model = None
    return model

# Initial load
get_model()

class NaturalIntakeRequest(BaseModel):
    user_text: str = Field(..., description="Unstructured natural language input from customer")
    tenant_persona: str = Field("general service desk", description="Business context (e.g., 'bank', 'hospital', 'DMV')")
    queue_length_ahead: int = Field(..., ge=0, description="Active waiting tickets ahead in queue")
    active_counters: int = Field(..., ge=1, description="Number of operational service desks")
    hour_of_day: Optional[int] = Field(None, ge=0, le=23, description="Hour (0-23)")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Mon ... 6=Sun)")
    rolling_velocity_mins: Optional[float] = Field(None, gt=0.0, description="Optional override for rolling S_bar service duration")

class IntakeRequest(BaseModel):
    service_type: int = Field(0, ge=0, le=2, description="Service tier (0=Quick, 1=Standard, 2=Complex)")
    priority_score: int = Field(1, ge=1, le=5, description="Priority scale 1 (normal) to 5 (VIP/Urgent)")
    is_walk_in: int = Field(1, ge=0, le=1, description="1 if unannounced walk-in, 0 if scheduled")
    party_size: int = Field(1, ge=1, le=10, description="Number of people in group")
    age_bracket: int = Field(1, ge=0, le=2, description="0=Youth, 1=Adult, 2=Senior")
    queue_length_ahead: int = Field(..., ge=0, description="Active waiting tickets ahead in queue")
    active_counters: int = Field(..., ge=1, description="Number of operational service desks")
    hour_of_day: Optional[int] = Field(None, ge=0, le=23, description="Hour (0-23)")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Mon ... 6=Sun)")
    rolling_velocity_mins: Optional[float] = Field(None, gt=0.0, description="Optional override for rolling S_bar service duration")

class CompletionRequest(BaseModel):
    duration_mins: float = Field(..., gt=0.0, description="Actual duration of completed service in minutes")
    counter_id: Optional[str] = Field(None, description="Identifier for service desk")

@app.get("/")
def health_check():
    rf = get_model()
    return {
        "status": "online",
        "model_loaded": rf is not None,
        "metrics": tracker.get_metrics_snapshot()
    }

@app.post("/intake/natural")
def intake_natural_ticket(req: NaturalIntakeRequest) -> Dict[str, Any]:
    """
    End-to-End LLM Intake:
    1. Extracts structured demographic, urgency, and operational features using Gemini Structured Outputs.
    2. Hands extracted features seamlessly to the queuing baseline + Random Forest prediction pipeline.
    """
    extracted_features = extract_queue_intent(
        user_text=req.user_text,
        tenant_persona=req.tenant_persona
    )

    structured_req = IntakeRequest(
        service_type=extracted_features["service_type"],
        priority_score=extracted_features["priority_score"],
        is_walk_in=extracted_features["is_walk_in"],
        party_size=extracted_features["party_size"],
        age_bracket=extracted_features["age_bracket"],
        queue_length_ahead=req.queue_length_ahead,
        active_counters=req.active_counters,
        hour_of_day=req.hour_of_day,
        day_of_week=req.day_of_week,
        rolling_velocity_mins=req.rolling_velocity_mins
    )

    result = intake_ticket(structured_req)
    result["extracted_features"] = extracted_features
    result["input_text"] = req.user_text
    result["tenant_persona"] = req.tenant_persona
    return result

@app.post("/intake")
def intake_ticket(req: IntakeRequest) -> Dict[str, Any]:
    """
    Intake a ticket:
    1. Records arrival in rate tracker.
    2. Calculates classical queuing baseline (M/M/c Erlang-C + Positional Model) synchronously in <1ms.
    3. Feeds features + queuing baseline into Random Forest to predict final wait time.
    4. Provides transparent XAI breakdown and confidence intervals.
    """
    # 1. Register arrival in tracker
    tracker.record_arrival()
    
    # 2. Get dynamic rate metrics
    s_bar = req.rolling_velocity_mins if req.rolling_velocity_mins is not None else tracker.get_rolling_service_duration()
    lam = tracker.get_arrival_rate()
    mu = 1.0 / max(0.5, s_bar)
    
    # Default temporal features if not provided
    now = datetime.now()
    hour = req.hour_of_day if req.hour_of_day is not None else now.hour
    dow = req.day_of_week if req.day_of_week is not None else now.weekday()
    
    # 3. Synchronous Queuing Theory Calculations (<1ms)
    queuing_metrics = compute_queuing_baseline(
        queue_length_ahead=req.queue_length_ahead,
        active_counters=req.active_counters,
        rolling_velocity_mins=s_bar,
        priority_score=req.priority_score,
        arrival_rate=lam,
        blend_alpha=0.70
    )
    
    if isinstance(queuing_metrics, dict):
        baseline_mins = queuing_metrics['queuing_theory_baseline']
        pos_wait = queuing_metrics['positional_wait_mins']
        erlang_wait = queuing_metrics['erlang_c_wait_mins']
        rho = queuing_metrics['system_utilization_rho']
        pc = queuing_metrics['probability_of_wait_pc']
    else:
        baseline_mins = float(queuing_metrics)
        pos_wait = baseline_mins
        erlang_wait = 0.0
        rho = round(lam / (req.active_counters * mu), 3)
        pc = 0.0
    
    # 4. Hybrid ML Prediction Layer with Fallback
    ml_prediction_mins = None
    rf_used = False
    rf = get_model()
    
    if rf is not None:
        try:
            feature_dict = {
                'service_type': [req.service_type],
                'priority_score': [req.priority_score],
                'is_walk_in': [req.is_walk_in],
                'party_size': [req.party_size],
                'age_bracket': [req.age_bracket],
                'queue_length_ahead': [req.queue_length_ahead],
                'active_counters': [req.active_counters],
                'hour_of_day': [hour],
                'day_of_week': [dow],
                'rolling_velocity_mins': [s_bar],
                'queuing_theory_baseline': [baseline_mins]
            }
            features_df = pd.DataFrame(feature_dict)
            
            if hasattr(rf, 'feature_names_in_'):
                cols_to_use = [c for c in rf.feature_names_in_ if c in features_df.columns]
                features_df = features_df[cols_to_use]
            
            pred = float(rf.predict(features_df)[0])
            ml_prediction_mins = max(2.0, round(pred, 1))
            rf_used = True
        except Exception as e:
            print(f"ML inference error, falling back to deterministic baseline: {e}")
            ml_prediction_mins = baseline_mins
    else:
        ml_prediction_mins = baseline_mins
        
    final_estimated_wait = ml_prediction_mins if rf_used else baseline_mins
    learned_residual = round(final_estimated_wait - baseline_mins, 2)
    
    return {
        "estimated_wait_mins": final_estimated_wait,
        "confidence_interval": {
            "lower_bound_mins": max(2.0, round(final_estimated_wait - 2.5, 1)),
            "upper_bound_mins": round(final_estimated_wait + 3.0, 1)
        },
        "explainable_ai_breakdown": {
            "deterministic_queuing_baseline_mins": baseline_mins,
            "discrete_positional_wait_mins": pos_wait,
            "erlang_c_steady_state_wait_mins": erlang_wait,
            "learned_human_variance_residual_mins": learned_residual,
            "system_utilization_rho": rho,
            "probability_of_wait_erlang_c": pc,
            "ml_model_active": rf_used
        },
        "dynamic_rates": {
            "arrival_rate_lambda_per_min": round(lam, 3),
            "service_rate_mu_per_counter_min": round(mu, 3),
            "rolling_avg_service_mins": round(s_bar, 2)
        }
    }

@app.post("/complete")
def complete_service(req: CompletionRequest):
    """Records a completed service ticket to continuously adapt dynamic rate metrics."""
    tracker.record_completion(duration_mins=req.duration_mins)
    return {
        "status": "success",
        "updated_metrics": tracker.get_metrics_snapshot()
    }

@app.get("/metrics")
def get_metrics(active_counters: int = 1):
    """Returns current real-time queuing statistics."""
    return tracker.get_metrics_snapshot(active_counters=active_counters)
