import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_score
# pyrefly: ignore [missing-import]
import joblib

# Load the synthetic dataset
df = pd.read_csv("synthetic_queue_training_data.csv")
X = df.drop(columns=['actual_wait_mins'])
y = df['actual_wait_mins']

# Configure the Random Forest Model
model = RandomForestRegressor(
    n_estimators=100, 
    max_depth=10, 
    random_state=42,
    n_jobs=-1
)

# Define the K-Fold Strategy
# n_splits=5 means 80% training / 20% validation, rotated 5 times
kf = KFold(n_splits=5, shuffle=True, random_state=42)

print("Starting K-Fold Cross-Validation...")
# Execute Cross-Validation using Mean Absolute Error (MAE)
# Scikit-learn uses negative MAE for scoring optimization, so we invert it
scores = cross_val_score(model, X, y, cv=kf, scoring='neg_mean_absolute_error', n_jobs=-1)
mae_scores = -scores  

print(f"K-Fold MAE Scores: {mae_scores.round(2)}")
print(f"Average MAE: {mae_scores.mean():.2f} minutes")
print(f"Score Variance: {mae_scores.std():.2f} minutes")

# Train the final model on the entire dataset for production
print("Training final model on full dataset...")
model.fit(X, y)
joblib.dump(model, "wait_predictor_cv.pkl")
print("K-Fold validated model exported to wait_predictor_cv.pkl")
