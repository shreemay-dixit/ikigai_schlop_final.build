import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_score
import joblib

# Load the updated synthetic dataset with classical queuing baseline
DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synthetic_queue_training_data.csv")
df = pd.read_csv(DATA_PATH)

X = df.drop(columns=['actual_wait_mins'])
y = df['actual_wait_mins']

print(f"Dataset loaded: {X.shape[0]} samples, {X.shape[1]} features")
print(f"Features: {list(X.columns)}")

# Configure Random Forest to act as residual learner on top of theoretical baseline
model = RandomForestRegressor(
    n_estimators=100, 
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)

# K-Fold Strategy (5 folds)
kf = KFold(n_splits=5, shuffle=True, random_state=42)

print("\nStarting K-Fold Cross-Validation (Residual Learning on Queuing Baseline)...")
scores = cross_val_score(model, X, y, cv=kf, scoring='neg_mean_absolute_error', n_jobs=-1)
mae_scores = -scores  

print(f"K-Fold MAE Scores: {mae_scores.round(3)}")
print(f"Average MAE: {mae_scores.mean():.3f} minutes")
print(f"Score Standard Deviation: {mae_scores.std():.3f} minutes")

# Evaluate Baseline MAE directly as comparison
baseline_mae = np.mean(np.abs(df['actual_wait_mins'] - df['queuing_theory_baseline']))
print(f"\nPure Theoretical Queuing Baseline MAE: {baseline_mae:.3f} minutes")
print(f"Hybrid ML Improvement: {baseline_mae - mae_scores.mean():.3f} minutes MAE reduction")

# Train final model on full dataset
print("\nTraining final model on full dataset...")
model.fit(X, y)

# Save artifact
MODEL_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wait_predictor_cv.pkl")
joblib.dump(model, MODEL_OUT)
print(f"K-Fold validated hybrid model exported to {MODEL_OUT}")
