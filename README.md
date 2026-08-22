# Smart Queue Intelligence & Hybrid Wait Prediction Architecture

An end-to-end intelligent queue management platform combining **Classical Queuing Mathematics ($M/M/c$ Erlang-C & Positional Models)**, **Gemini 2.5 Flash Structured Triage**, and a **Residual Random Forest Regression Engine** with Supabase integration and real-time Explainable AI (XAI).

---

## 1. System Architecture & Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory, lifespan cold-start loader & API endpoints
│   │   ├── config.py                # Environment variables via pydantic-settings
│   │   ├── database.py              # Supabase client singleton with connection pooling & offline fallback
│   │   ├── schemas/
│   │   │   ├── intake.py            # Intake request/response schemas
│   │   │   └── queue.py             # Queue snapshots, status updates & health probes
│   │   ├── services/
│   │   │   ├── ai_engine.py         # Google Gemini 2.5 Flash structured triage parser
│   │   │   ├── ml_predictor.py      # Random Forest residual predictor & tree-variance estimator
│   │   │   └── queuing_math.py      # M/M/c Erlang-C & Positional mathematical engine
│   │   └── workers/
│   │       └── velocity_worker.py   # FastAPI background workers for rolling rate tracking
│   ├── models/
│   │   └── wait_predictor_cv.pkl    # Pre-trained Random Forest regression artifact
│   ├── requirements.txt             # Pinned core dependencies
│   └── .env                         # Environment variables configuration
│
├── frontend/
│   ├── index.html                   # Dashboard with Natural LLM and Manual Intake tabs
│   ├── style.css                    # Glassmorphic dark-mode interface with XAI breakdowns
│   └── app.js                       # API client controller
│
├── ml/
│   ├── data/
│   │   ├── synthetic_queue_training_data.csv
│   │   └── clean_queue_data.csv
│   ├── models/
│   │   └── wait_predictor_cv.pkl
│   ├── data_generator.py            # Synthetic queue dataset generator with queuing baselines
│   └── train.py                     # 5-Fold cross-validation & model trainer
│
└── README.md                        # Complete project documentation
```

---

## 2. Core Mathematical & AI Architecture

### A. Discrete Positional Model (Instantaneous Snapshot)
Calculates immediate clearance time for customer at position $N_{\text{ahead}}$:
$$W_{\text{positional}} = \left(\frac{N_{\text{ahead}}}{c}\right) \times \bar{S}_{\text{rolling}} \times K_{\text{priority}}$$
- $N_{\text{ahead}}$: Active tickets waiting ahead
- $c$: Active operational counters
- $\bar{S}_{\text{rolling}}$: Rolling average service duration of completed tickets
- $K_{\text{priority}} = \max(0.25, 1.0 - (\text{priority\_score} - 1) \times 0.15)$

### B. Multi-Server Steady-State Model ($M/M/c$ Erlang-C)
Calculates macro-level system congestion:
- Arrival Rate ($\lambda$): Arrivals per minute over 15-minute sliding window
- Service Rate ($\mu$): $\mu = \frac{1}{\bar{S}_{\text{rolling}}}$
- Offered Load ($a$): $a = \frac{\lambda}{\mu}$
- Utilization ($\rho$): $\rho = \frac{\lambda}{c \cdot \mu}$
- Probability of Waiting ($P_C$):
  $$P_0 = \left[ \sum_{k=0}^{c-1} \frac{a^k}{k!} + \frac{a^c}{c!(1-\rho)} \right]^{-1}, \quad P_C = \frac{a^c}{c!(1-\rho)} P_0$$
- Expected Queue Wait Time:
  $$W_q = \frac{P_C}{c\mu - \lambda}$$

### C. Deterministic Queuing Baseline
$$\text{Baseline} = \max(2.0, 0.70 \cdot W_{\text{positional}} + 0.30 \cdot W_q)$$

### D. Gemini 2.5 Flash Structured Triage
Uses `google-genai` with strict Pydantic schemas (`QueueIntent`) to parse unstructured user intake text into:
- `service_type`: `0` (Quick Task), `1` (Standard Consultation), `2` (Complex Procedure)
- `priority_score`: `1` (Routine) to `5` (Emergency / VIP Triage)
- `is_walk_in`: `1` (Spontaneous), `0` (Pre-booked)
- `party_size`: Total individuals
- `age_bracket`: `0` (Minor), `1` (Adult), `2` (Senior)

### E. Residual Random Forest Regression & Tree Variance
The Random Forest model learns the human and rush-hour turbulence on top of the deterministic baseline:
- **5-Fold Cross-Validation MAE**: **1.58 minutes** (reduced from 27.66 min raw baseline MAE).
- **Adaptive Confidence Intervals**: Derived from tree-variance distributions across all 100 individual estimators.

---

## 3. API Endpoints Specification

### 1. Intake & Triage Pipeline (`POST /api/intake`)
* **Request Body**:
  ```json
  {
    "business_id": "default",
    "user_text": "I brought my elderly mother for urgent consultation",
    "phone_number": "+1234567890"
  }
  ```
* **Response Body**:
  ```json
  {
    "ticket_id": "a756feda-540f-41a1-8a76-ba551478f12a",
    "ticket_number": "T-083940-01",
    "priority_score": 4,
    "predicted_wait_mins": 14.5,
    "display_range": "12 – 17 mins",
    "relative_error_pct": 8.5,
    "queuing_theory_baseline_mins": 12.8,
    "created_at": "2026-08-22T08:39:40.367613"
  }
  ```

### 2. Ticket Status & Staff Advance (`PATCH /api/queue/{ticket_id}/status`)
* **Request Body**: `{"status": "in_progress", "counter_id": "C-1"}` or `{"status": "completed"}`
* Updates timestamps (`served_at`, `completed_at`) and triggers background task to recalculate rolling service velocity.

### 3. Active Queue Snapshot (`GET /api/queue/{business_id}`)
* Returns real-time waiting count, active counters, $\lambda$, $\mu$, $\rho$, rolling velocity, and ticket queue.

### 4. Health & Fallback Probe (`GET /api/health`)
* Returns Supabase connectivity, in-memory ML model state, and Gemini API readiness.

---

## 4. Setup & Running Instructions

### 1. Environment Configuration
Create `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
GEMINI_API_KEY=your-gemini-api-key
ML_MODEL_PATH=models/wait_predictor_cv.pkl
```

### 2. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Start Backend Server
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 4. Open Frontend Dashboard
Open `frontend/index.html` in your browser or run:
```bash
python3 -m http.server 3000 --directory frontend
```
Visit [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 5. Retrain Machine Learning Model
```bash
python3 ml/data_generator.py
python3 ml/train.py
```
