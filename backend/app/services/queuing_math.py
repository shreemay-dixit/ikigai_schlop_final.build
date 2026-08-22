import math
import numpy as np
import pandas as pd
from typing import Union, Dict, Any, Optional

def compute_priority_discount(priority_score: Union[int, float, np.ndarray]) -> Union[float, np.ndarray]:
    """K_priority = 1.0 - (priority_score - 1) * 0.15, bounded at minimum 0.25."""
    if isinstance(priority_score, (np.ndarray, pd.Series)):
        return np.maximum(0.25, 1.0 - (priority_score - 1.0) * 0.15)
    return max(0.25, 1.0 - (float(priority_score) - 1.0) * 0.15)

def compute_positional_wait(
    queue_length_ahead: Union[int, float, np.ndarray],
    active_counters: Union[int, float, np.ndarray],
    rolling_velocity_mins: Union[float, np.ndarray],
    priority_score: Union[int, float, np.ndarray] = 1
) -> Union[float, np.ndarray]:
    """
    W_positional = (N_ahead / c) * S_bar_rolling * K_priority
    """
    k_prio = compute_priority_discount(priority_score)
    c_safe = np.maximum(1, active_counters) if isinstance(active_counters, (np.ndarray, pd.Series)) else max(1, active_counters)
    return (queue_length_ahead / c_safe) * rolling_velocity_mins * k_prio

def compute_erlang_c_wait_scalar(
    arrival_rate: float,
    service_rate_per_counter: float,
    active_counters: int
) -> Dict[str, float]:
    """
    M/M/c steady-state Erlang-C metrics:
    a = lambda / mu
    rho = a / c
    P0 = [ sum_{k=0}^{c-1} a^k/k! + a^c / (c!(1-rho)) ]^-1
    PC = (a^c / (c!(1-rho))) * P0
    Wq = PC / (c*mu - lambda)
    """
    c = max(1, int(active_counters))
    mu = max(1e-4, float(service_rate_per_counter))
    lam = max(0.0, float(arrival_rate))
    
    offered_load = lam / mu
    rho = offered_load / c
    
    if rho >= 0.999:
        wq_approx = max(0.0, (lam - c * mu) * 15.0 / (c * mu) + 1.0 / mu)
        return {'P0': 0.0, 'PC': 1.0, 'Wq': wq_approx, 'rho': rho}
    
    sum_terms = 0.0
    for k in range(c):
        sum_terms += (offered_load ** k) / math.factorial(k)
        
    last_term = (offered_load ** c) / (math.factorial(c) * (1.0 - rho))
    p0 = 1.0 / (sum_terms + last_term)
    pc = min(1.0, max(0.0, last_term * p0))
    
    denom = (c * mu) - lam
    wq = (pc / denom) if denom > 1e-5 else 0.0
    
    return {
        'P0': p0,
        'PC': pc,
        'Wq': max(0.0, wq),
        'rho': rho
    }

def compute_queuing_baseline(
    queue_length_ahead: Union[int, float],
    active_counters: Union[int, float],
    rolling_velocity_mins: float,
    priority_score: int = 1,
    arrival_rate: Optional[float] = None,
    blend_alpha: float = 0.70
) -> Dict[str, Any]:
    """
    Hybrid queuing baseline bounded at min 2.0 minutes.
    """
    w_pos = compute_positional_wait(
        queue_length_ahead=queue_length_ahead,
        active_counters=active_counters,
        rolling_velocity_mins=rolling_velocity_mins,
        priority_score=priority_score
    )
    
    lam = arrival_rate if arrival_rate is not None else 0.2
    mu = 1.0 / max(0.5, rolling_velocity_mins)
    
    erlang_res = compute_erlang_c_wait_scalar(
        arrival_rate=lam,
        service_rate_per_counter=mu,
        active_counters=int(active_counters)
    )
    
    blended = blend_alpha * float(w_pos) + (1.0 - blend_alpha) * erlang_res['Wq']
    baseline = max(2.0, round(float(blended), 2))
    
    return {
        'queuing_theory_baseline': baseline,
        'positional_wait_mins': round(float(w_pos), 2),
        'erlang_c_wait_mins': round(float(erlang_res['Wq']), 2),
        'system_utilization_rho': round(float(erlang_res['rho']), 3),
        'probability_of_wait_pc': round(float(erlang_res['PC']), 3)
    }

class QueuingTheoryEngine:
    """
    QueuingTheoryEngine class exposing calculate_baseline for unified queuing theory calculations.
    """
    @staticmethod
    def calculate_baseline(
        live_queue_count: int,
        active_counters: int,
        base_service_time_mins: float,
        priority_score: int = 1,
        arrival_rate: Optional[float] = None
    ) -> float:
        res = compute_queuing_baseline(
            queue_length_ahead=live_queue_count,
            active_counters=active_counters,
            rolling_velocity_mins=base_service_time_mins,
            priority_score=priority_score,
            arrival_rate=arrival_rate
        )
        return res['queuing_theory_baseline']
