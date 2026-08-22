import numpy as np
from typing import List, Union

def calculate_wape(y_true: Union[List[float], np.ndarray], y_pred: Union[List[float], np.ndarray]) -> float:
    """
    Calculates the Weighted Absolute Percentage Error (WAPE) between actual and predicted wait times.
    
    Formula:
        WAPE = ( sum(|y_true - y_pred|) / sum(y_true) ) * 100
        
    Prevents division-by-zero or extreme percentage skew on small wait times.
    
    Args:
        y_true: List or array of ground-truth actual wait times (in minutes).
        y_pred: List or array of predicted wait times (in minutes).
        
    Returns:
        float: WAPE percentage rounded to 2 decimal places (e.g., 12.5 for 12.5% error).
    """
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)
    
    if y_t.size == 0 or y_p.size == 0:
        return 0.0
        
    total_actual = float(np.sum(y_t))
    if total_actual == 0.0:
        return 0.0
        
    total_abs_error = float(np.sum(np.abs(y_t - y_p)))
    wape = (total_abs_error / total_actual) * 100.0
    return round(wape, 2)
