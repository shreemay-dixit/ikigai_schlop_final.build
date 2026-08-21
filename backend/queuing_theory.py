import math
import numpy as np
import pandas as pd
from typing import Union, Dict, Any

def compute_priority_discount(priority_score: Union[int, float, np.ndarray]) -> Union[float, np.ndarray]:
    """
    Computes priority discount factor K_priority:
    K_priority = 1.0 - (priority_score - 1) * 0.15
    Clamped to minimum 0.25 to maintain sanity.
    """
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
    Discrete Positional Model (Instantaneous Snapshot):
    W_positional = (queue_length_ahead / active_counters) * rolling_velocity_mins * K_priority
    """
    k_prio = compute_priority_discount(priority_score)
    c_safe = np.maximum(1, active_counters) if isinstance(active_counters, (np.ndarray, pd.Series)) else max(1, active_counters)
    w_pos = (queue_length_ahead / c_safe) * rolling_velocity_mins * k_prio
    return w_pos

def compute_erlang_c_wait_scalar(
    arrival_rate: float,
    service_rate_per_counter: float,
    active_counters: int
) -> Dict[str, float]:
    """
    Computes M/M/c steady state Erlang-C metrics for scalar values.
    Returns dictionary with:
      - 'P0': Probability of empty queue
      - 'PC': Erlang-C waiting probability P(W > 0)
      - 'Wq': Expected waiting time in queue (mins)
      - 'rho': System utilization
    """
    c = max(1, int(active_counters))
    mu = max(1e-4, float(service_rate_per_counter))
    lam = max(0.0, float(arrival_rate))
    
    offered_load = lam / mu
    rho = offered_load / c
    
    # If system is in overload (rho >= 1.0) or close to unstable
    if rho >= 0.999:
        # Transient queue growth approximation / upper bound
        wq_approx = max(0.0, (lam - c * mu) * 15.0 / (c * mu) + 1.0 / mu)
        return {
            'P0': 0.0,
            'PC': 1.0,
            'Wq': wq_approx,
            'rho': rho
        }
    
    # Calculate P0 sum: sum_{k=0}^{c-1} (a^k / k!)
    sum_terms = 0.0
    for k in range(c):
        sum_terms += (offered_load ** k) / math.factorial(k)
        
    last_term = (offered_load ** c) / (math.factorial(c) * (1.0 - rho))
    p0 = 1.0 / (sum_terms + last_term)
    
    # Erlang-C probability of waiting
    pc = last_term * p0
    pc = min(1.0, max(0.0, pc))
    
    # Expected waiting time Wq = P_C / (c * mu - lam)
    denom = (c * mu) - lam
    wq = (pc / denom) if denom > 1e-5 else 0.0
    
    return {
        'P0': p0,
        'PC': pc,
        'Wq': max(0.0, wq),
        'rho': rho
    }

def compute_erlang_c_wait_vectorized(
    arrival_rates: np.ndarray,
    service_rates_per_counter: np.ndarray,
    active_counters: np.ndarray
) -> np.ndarray:
    """
    Vectorized computation of expected Erlang-C wait time Wq (in minutes).
    """
    n = len(arrival_rates)
    wq_array = np.zeros(n, dtype=float)
    for i in range(n):
        res = compute_erlang_c_wait_scalar(
            arrival_rate=arrival_rates[i],
            service_rate_per_counter=service_rates_per_counter[i],
            active_counters=active_counters[i]
        )
        wq_array[i] = res['Wq']
    return wq_array

def compute_queuing_baseline(
    queue_length_ahead: Union[int, float, np.ndarray],
    active_counters: Union[int, float, np.ndarray],
    rolling_velocity_mins: Union[float, np.ndarray],
    priority_score: Union[int, float, np.ndarray] = 1,
    arrival_rate: Union[float, np.ndarray, None] = None,
    blend_alpha: float = 0.70
) -> Union[float, np.ndarray, Dict[str, Any]]:
    """
    Computes the combined hybrid queuing theory baseline:
    - Blend between discrete positional snapshot and continuous Erlang-C steady-state.
    - Capped at minimum 2.0 minutes to prevent negative or zero estimates.
    """
    w_pos = compute_positional_wait(
        queue_length_ahead=queue_length_ahead,
        active_counters=active_counters,
        rolling_velocity_mins=rolling_velocity_mins,
        priority_score=priority_score
    )
    
    if arrival_rate is not None:
        if isinstance(queue_length_ahead, (np.ndarray, pd.Series)):
            mu_vec = 1.0 / np.maximum(0.5, rolling_velocity_mins)
            lam_vec = np.asarray(arrival_rate)
            w_erlang = compute_erlang_c_wait_vectorized(
                arrival_rates=lam_vec,
                service_rates_per_counter=mu_vec,
                active_counters=np.asarray(active_counters)
            )
            blended = blend_alpha * w_pos + (1.0 - blend_alpha) * w_erlang
            return np.maximum(2.0, np.round(blended, 2))
        else:
            mu = 1.0 / max(0.5, float(rolling_velocity_mins))
            erlang_res = compute_erlang_c_wait_scalar(
                arrival_rate=float(arrival_rate),
                service_rate_per_counter=mu,
                active_counters=int(active_counters)
            )
            w_erlang = erlang_res['Wq']
            blended = blend_alpha * w_pos + (1.0 - blend_alpha) * w_erlang
            baseline = max(2.0, round(float(blended), 2))
            return {
                'queuing_theory_baseline': baseline,
                'positional_wait_mins': round(float(w_pos), 2),
                'erlang_c_wait_mins': round(float(w_erlang), 2),
                'system_utilization_rho': round(float(erlang_res['rho']), 3),
                'probability_of_wait_pc': round(float(erlang_res['PC']), 3)
            }
    else:
        if isinstance(w_pos, (np.ndarray, pd.Series)):
            return np.maximum(2.0, np.round(w_pos, 2))
        return max(2.0, round(float(w_pos), 2))
