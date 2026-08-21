import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_score
import joblib

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)

# Locate dataset: check ml/data/ first, then fallback to project root
DATA_CANDIDATES = [
    os.path.join(CURRENT_DIR, "data", "synthetic_queue_training_data.csv"),
    os.path.join(PROJECT_ROOT, "synthetic_queue_training_data.csv")
]

data_path = None
for p in DATA_CANDIDATES:
    if os.path.exists(p):
        data_path = p
        break

if data_path is None:
    raise FileNotFoundError(f"Could not find synthetic_queue_training_data.csv in {DATA_CANDIDATES}")

print(f"Loading training data from: {data_path}")
df = pd.read_csv(data_path)

X = df.drop(columns=['actual_wait_mins'])
y = df['actual_wait_mins']

print(f"Dataset loaded: {X.shape[0]} samples, {X.shape[1]} features")
print(f"Features: {list(X.columns)}")

# Configure Random Forest residual learner
model = RandomForestRegressor(
    n_estimators=100, 
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)

# 5-Fold Cross Validation
kf = KFold(n_splits=5, shuffle=True, random_state=42)

print("\nStarting K-Fold Cross-Validation (Residual Learning on Queuing Baseline)...")
scores = cross_val_score(model, X, y, cv=kf, scoring='neg_mean_absolute_error', n_jobs=-1)
mae_scores = -scores  

print(f"K-Fold MAE Scores: {mae_scores.round(3)}")
print(f"Average MAE: {mae_scores.mean():.3f} minutes")
print(f"Score Standard Deviation: {mae_scores.std():.3f} minutes")

baseline_mae = np.mean(np.abs(df['actual_wait_mins'] - df['queuing_theory_baseline']))
print(f"\nPure Theoretical Queuing Baseline MAE: {baseline_mae:.3f} minutes")
print(f"Hybrid ML Improvement: {baseline_mae - mae_scores.mean():.3f} minutes MAE reduction")

# Fit final model
print("\nTraining final model on full dataset...")
model.fit(X, y)

# Save artifact in ml/models/ and root for backwards compatibility
models_dir = os.path.join(CURRENT_DIR, "models")
os.makedirs(models_dir, exist_ok=True)
model_out = os.path.join(models_dir, "wait_predictor_cv.pkl")
joblib.dump(model, model_out)
print(f"Model saved to: {model_out}")

root_model_out = os.path.join(PROJECT_ROOT, "wait_predictor_cv.pkl")
joblib.dump(model, root_model_out)
print(f"Model synced to root: {root_model_out}")
