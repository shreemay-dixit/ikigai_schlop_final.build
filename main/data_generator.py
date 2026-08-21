import numpy as np
import pandas as pd

def generate_queue_dataset(n_samples: int = 10000, seed: int = 42) -> pd.DataFrame:
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
    # Base task duration mapped by service category
    base_service_mins = np.select(
        [service_type == 0, service_type == 1, service_type == 2],
        [6.0, 14.0, 28.0]
    )

    # Demographic & Intake Adjustments
    walk_in_penalty = is_walk_in * 3.5  # Extra intake/triage time for unannounced visits
    party_multiplier = 1.0 + ((party_size - 1) * 0.25)
    age_pacing_multiplier = np.select(
        [age_bracket == 0, age_bracket == 1, age_bracket == 2],
        [1.10, 1.0, 1.25]
    )

    # Individual service duration calculation
    individual_service_time = (base_service_mins + walk_in_penalty) * party_multiplier * age_pacing_multiplier

    # Rolling velocity (simulated around the individual service time with slight variance)
    rolling_velocity_mins = np.clip(
        individual_service_time * np.random.uniform(0.85, 1.15, size=n_samples), 4.0, 35.0
    ).round(2)

    # Congestion & Peak Hours: Lunch rush (13-15) and evening backlog (17-18)
    peak_multiplier = np.select(
        [(hour_of_day >= 13) & (hour_of_day <= 15), hour_of_day >= 17, (day_of_week == 0) | (day_of_week == 4)],
        [1.35, 1.20, 1.15],
        default=1.0
    )

    # Priority Discount: High priority cases experience fewer queues ahead
    effective_queue = np.maximum(0, queue_length_ahead - (priority_score - 1) * 2.5)

    # 3. Target Variable Calculation (Queue Wait Time)
    # Queue Clearance Time = (Effective Queue / Active Counters) * Rolling Velocity * Peak Multiplier
    queue_wait = (effective_queue / active_counters) * rolling_velocity_mins * peak_multiplier

    # Add real-world Gaussian noise (mean=0, std=2.5 mins)
    noise = np.random.normal(0, 2.5, size=n_samples)
    total_wait_mins = queue_wait + (individual_service_time * 0.5) + noise

    # Enforce realistic bounds (minimum 2 minutes, max 240 minutes)
    actual_wait_mins = np.clip(np.round(total_wait_mins, 1), 2.0, 240.0)

    # 4. Construct Clean DataFrame
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
        'actual_wait_mins': actual_wait_mins
    })

    return df

if __name__ == "__main__":
    dataset = generate_queue_dataset(n_samples=50000)
    dataset.to_csv("synthetic_queue_training_data.csv", index=False)
    print(f"Dataset generated successfully. Shape: {dataset.shape}")
    print(dataset.head(5))