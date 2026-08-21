import os
import sys
import numpy as np
import pandas as pd

# Add current and backend directories to path for queuing math imports
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

for p in [CURRENT_DIR, BACKEND_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from queuing_theory import compute_queuing_baseline

def generate_queue_dataset(n_samples: int = 50000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)

    # 1. Generate Input Features
    service_type = np.random.choice([0, 1, 2], size=n_samples, p=[0.5, 0.35, 0.15])
    priority_score = np.random.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.3, 0.35, 0.2, 0.1, 0.05])
    is_walk_in = np.random.choice([0, 1], size=n_samples, p=[0.4, 0.6])
    party_size = np.random.choice([1, 2, 3, 4], size=n_samples, p=[0.7, 0.18, 0.08, 0.04])
    age_bracket = np.random.choice([0, 1, 2], size=n_samples, p=[0.15, 0.65, 0.20])
    
    queue_length_ahead = np.random.randint(0, 46, size=n_samples)
    active_counters = np.random.randint(1, 7, size=n_samples)
    hour_of_day = np.random.randint(9, 19, size=n_samples)
    day_of_week = np.random.randint(0, 7, size=n_samples)

    # 2. Domain-Specific Mathematical Rules
    base_service_mins = np.select(
        [service_type == 0, service_type == 1, service_type == 2],
        [6.0, 14.0, 28.0]
    )

    walk_in_penalty = is_walk_in * 3.5
    party_multiplier = 1.0 + ((party_size - 1) * 0.25)
    age_pacing_multiplier = np.select(
        [age_bracket == 0, age_bracket == 1, age_bracket == 2],
        [1.10, 1.0, 1.25]
    )

    individual_service_time = (base_service_mins + walk_in_penalty) * party_multiplier * age_pacing_multiplier

    rolling_velocity_mins = np.clip(
        individual_service_time * np.random.uniform(0.85, 1.15, size=n_samples), 4.0, 35.0
    ).round(2)

    # 3. Queuing Theory Deterministic Baseline
    rush_arrival_factor = np.select(
        [(hour_of_day >= 12) & (hour_of_day <= 15), hour_of_day >= 17],
        [1.4, 1.2],
        default=0.8
    )
    arrival_rate = np.clip(
        (active_counters / rolling_velocity_mins) * rush_arrival_factor * np.random.uniform(0.7, 1.1, size=n_samples),
        0.05, 3.0
    )

    queuing_theory_baseline = compute_queuing_baseline(
        queue_length_ahead=queue_length_ahead,
        active_counters=active_counters,
        rolling_velocity_mins=rolling_velocity_mins,
        priority_score=priority_score,
        arrival_rate=arrival_rate,
        blend_alpha=0.70
    )

    # 4. Target Variable (Actual Wait with Peak Turbulence & Residual Variance)
    peak_multiplier = np.select(
        [(hour_of_day >= 13) & (hour_of_day <= 15), hour_of_day >= 17, (day_of_week == 0) | (day_of_week == 4)],
        [1.30, 1.18, 1.12],
        default=1.0
    )

    effective_wait = queuing_theory_baseline * peak_multiplier + (walk_in_penalty * 0.4) + (party_multiplier * 1.2)
    noise = np.random.normal(0, 2.0, size=n_samples)
    total_wait_mins = effective_wait + noise
    actual_wait_mins = np.clip(np.round(total_wait_mins, 1), 2.0, 240.0)

    # 5. Construct Clean DataFrame
    df = pd.DataFrame({
        'service_type': service_type,
        'priority_score': priority_score,
        'is_walk_in': is_walk_in,
        'party_size': party_size,
        'age_bracket': age_bracket,
        'queue_length_ahead': queue_length_ahead,
        'active_counters': active_counters,
        'hour_of_day': hour_of_day,
        'day_of_week': day_of_week,
        'rolling_velocity_mins': rolling_velocity_mins,
        'queuing_theory_baseline': queuing_theory_baseline,
        'actual_wait_mins': actual_wait_mins
    })

    return df

if __name__ == "__main__":
    out_dir = os.path.join(PROJECT_ROOT, "ml", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "synthetic_queue_training_data.csv")
    
    dataset = generate_queue_dataset(n_samples=50000)
    dataset.to_csv(out_path, index=False)
    print(f"Dataset generated in ml/data/: {dataset.shape}")
    
    # Also save to root for compatibility
    root_out = os.path.join(PROJECT_ROOT, "synthetic_queue_training_data.csv")
    dataset.to_csv(root_out, index=False)
    print(f"Dataset synced to root: {root_out}")
