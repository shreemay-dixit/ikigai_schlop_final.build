import os
import sys
import numpy as np
import pandas as pd

# Add backend directory to sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

for p in [CURRENT_DIR, BACKEND_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.services.queuing_math import compute_queuing_baseline
except ImportError:
    try:
        from queuing_math import compute_queuing_baseline
    except ImportError:
        def compute_queuing_baseline(queue_length_ahead, active_counters, rolling_velocity_mins, priority_score=1, **kwargs):
            return np.maximum(2.0, (queue_length_ahead / np.maximum(1, active_counters)) * rolling_velocity_mins * (1.0 - (priority_score - 1) * 0.12))

def generate_multi_industry_queue_dataset(n_samples: int = 60000, seed: int = 42) -> pd.DataFrame:
    """
    Generates a high-fidelity synthetic queuing and triage dataset across 6 commercial domains:
    - 0: Healthcare & Emergency Clinic
    - 1: Commercial Banking & Financial Advisory
    - 2: Food Shop, Cafe & Restaurant Seating
    - 3: Concert, Theatre & Live Event Ticketing
    - 4: Retail & Tech Support Desk
    - 5: Government & DMV Licensing
    """
    np.random.seed(seed)

    # 1. Industry Domain (0 to 5)
    industry_type = np.random.choice([0, 1, 2, 3, 4, 5], size=n_samples, p=[0.25, 0.15, 0.20, 0.15, 0.15, 0.10])

    # 2. Service Tier & Urgency
    service_type = np.random.choice([0, 1, 2], size=n_samples, p=[0.45, 0.38, 0.17])
    priority_score = np.random.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.28, 0.32, 0.22, 0.12, 0.06])
    is_walk_in = np.random.choice([0, 1], size=n_samples, p=[0.35, 0.65])
    
    # Party sizing (restaurants & concerts have higher party sizes)
    party_size = np.where(
        (industry_type == 2) | (industry_type == 3),
        np.random.choice([1, 2, 3, 4, 6, 8], size=n_samples, p=[0.3, 0.35, 0.15, 0.12, 0.05, 0.03]),
        np.random.choice([1, 2, 3, 4], size=n_samples, p=[0.75, 0.16, 0.06, 0.03])
    )
    
    age_bracket = np.random.choice([0, 1, 2], size=n_samples, p=[0.12, 0.68, 0.20])
    
    queue_length_ahead = np.random.randint(0, 50, size=n_samples)
    active_counters = np.random.randint(1, 8, size=n_samples)
    hour_of_day = np.random.randint(8, 22, size=n_samples)
    day_of_week = np.random.randint(0, 7, size=n_samples)
    calendar_load_factor = np.random.uniform(0.1, 1.0, size=n_samples).round(2)

    # 3. Domain-Specific Base Service Times (Minutes)
    # Healthcare: 8, 16, 32 | Bank: 6, 15, 30 | Restaurant: 12, 25, 45 | Concert: 2, 5, 12 | Tech: 5, 14, 25 | DMV: 4, 10, 20
    base_industry_time = np.select(
        [
            industry_type == 0, # Healthcare
            industry_type == 1, # Banking
            industry_type == 2, # Restaurant/Cafe
            industry_type == 3, # Concert/Events
            industry_type == 4, # Retail/Tech
            industry_type == 5  # DMV
        ],
        [
            np.select([service_type == 0, service_type == 1, service_type == 2], [8.0, 16.0, 32.0]),
            np.select([service_type == 0, service_type == 1, service_type == 2], [6.0, 15.0, 30.0]),
            np.select([service_type == 0, service_type == 1, service_type == 2], [12.0, 25.0, 45.0]),
            np.select([service_type == 0, service_type == 1, service_type == 2], [2.5, 6.0, 14.0]),
            np.select([service_type == 0, service_type == 1, service_type == 2], [5.0, 14.0, 26.0]),
            np.select([service_type == 0, service_type == 1, service_type == 2], [4.0, 10.0, 20.0])
        ]
    )

    walk_in_penalty = is_walk_in * 3.0
    party_multiplier = 1.0 + ((party_size - 1) * 0.20)
    age_multiplier = np.select([age_bracket == 0, age_bracket == 1, age_bracket == 2], [1.05, 1.0, 1.20])

    individual_service_time = (base_industry_time + walk_in_penalty) * party_multiplier * age_multiplier

    rolling_velocity_mins = np.clip(
        individual_service_time * np.random.uniform(0.85, 1.15, size=n_samples), 3.0, 50.0
    ).round(2)

    # 4. Queuing Theory Deterministic Baseline
    rush_factor = np.select(
        [(hour_of_day >= 12) & (hour_of_day <= 14), (hour_of_day >= 18) & (hour_of_day <= 20)],
        [1.35, 1.25],
        default=0.85
    )

    arrival_rate = np.clip(
        (active_counters / rolling_velocity_mins) * rush_factor * (1.0 + calendar_load_factor * 0.3) * np.random.uniform(0.7, 1.1, size=n_samples),
        0.05, 4.0
    )

    k_prio = np.maximum(0.25, 1.0 - (priority_score - 1.0) * 0.15)
    w_pos = (queue_length_ahead / np.maximum(1, active_counters)) * rolling_velocity_mins * k_prio
    queuing_theory_baseline = np.maximum(2.0, np.round(w_pos, 2))

    # 5. Target Actual Wait Time (ML Ground Truth)
    effective_wait = (
        queuing_theory_baseline * (1.0 + calendar_load_factor * 0.15)
        + (walk_in_penalty * 0.35)
        + (party_multiplier * 1.0)
    )
    noise = np.random.normal(0, 1.8, size=n_samples)
    total_wait_mins = np.clip(np.round(effective_wait + noise, 1), 1.5, 300.0)

    # 6. Build Clean Multi-Industry Dataset
    df = pd.DataFrame({
        'industry_type': industry_type,
        'service_type': service_type,
        'priority_score': priority_score,
        'is_walk_in': is_walk_in,
        'party_size': party_size,
        'age_bracket': age_bracket,
        'queue_length_ahead': queue_length_ahead,
        'active_counters': active_counters,
        'hour_of_day': hour_of_day,
        'day_of_week': day_of_week,
        'calendar_load_factor': calendar_load_factor,
        'rolling_velocity_mins': rolling_velocity_mins,
        'queuing_theory_baseline': queuing_theory_baseline,
        'actual_wait_mins': total_wait_mins
    })

    return df

if __name__ == "__main__":
    print("Generating Multi-Industry Queue Training Dataset (60,000 samples across 6 domains)...")
    dataset = generate_multi_industry_queue_dataset(60000)
    
    out_dir = os.path.join(CURRENT_DIR, "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "synthetic_queue_training_data.csv")
    dataset.to_csv(out_path, index=False)
    print(f"Saved dataset to: {out_path}")
    
    root_path = os.path.join(PROJECT_ROOT, "synthetic_queue_training_data.csv")
    dataset.to_csv(root_path, index=False)
    print(f"Synced dataset to root: {root_path}")
    print(dataset.head())
