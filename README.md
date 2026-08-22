# ⚡ Smart Queue Intelligence Platform

An enterprise-grade, hybrid intelligent queue management and wait-time prediction platform combining **Classical Queuing Mathematics ($M/M/c$ Erlang-C & Positional Models)**, a **3-Tier Resilient AI Intent Parser (Gemini 2.5 Flash $\to$ Groq Llama 3.3 70B $\to$ Hardcoded Safety Net)**, and a **Residual Random Forest Regression Engine with Tree-Variance Bounds**.

---

## 📸 System Visuals & Flow Architecture

### 1. Hybrid Wait Prediction & Triage Pipeline

```
+-----------------------------------------------------------------------------------------------+
|                                      CUSTOMER INTAKE                                          |
|                       "My child has a severe fever and is struggling to breathe"              |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────────────+
|                       3-TIER RESILIENT AI TRIAGE ENGINE (ai_engine.py)                        |
|                                                                                               |
|   [Tier 1: Primary]    ──► Google Gemini 2.5 Flash (Structured Outputs with Pydantic)         |
|         │ (on error/timeout)                                                                  |
|   [Tier 2: Fallback]   ──► Groq Llama 3.3 70B Versatile (JSON Mode with Schema Injection)     |
|         │ (on error/timeout)                                                                  |
|   [Tier 3: Safety Net] ──► Deterministic Hardcoded Baseline Defaults                          |
|                                                                                               |
|   Output: { service_type: 2, priority_score: 5, is_walk_in: 1, party_size: 2, age_bracket: 0 }  |
+───────────────────────────────────────────────────────────────────────────────────────────────+
                                                │
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────────────+
|               DETERMINISTIC QUEUING THEORY ANCHOR (queuing_math.py)                          |
|                                                                                               |
|   1. Instantaneous Positional:  W_pos = (N_ahead / c) * S_rolling * K_priority                |
|   2. Steady-State Erlang-C:     W_q = P_C / (c*mu - lambda)  [M/M/c Multi-Server Queue]       |
|   3. Hybrid Baseline:           Baseline = max(2.0, 0.70 * W_pos + 0.30 * W_q)                |
+───────────────────────────────────────────────────────────────────────────────────────────────+
                                                │
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────────────+
|               RESIDUAL RANDOM FOREST REGRESSION ENGINE (ml_predictor.py)                      |
|                                                                                               |
|   Input Vector: [service_type, priority_score, is_walk_in, party_size, age_bracket,           |
|                  queue_length_ahead, active_counters, rolling_velocity, queuing_baseline]     |
|                                                                                               |
|   Inference:    Random Forest Residual Estimation (5-Fold CV MAE: 1.58 min)                   |
|   Tree-Variance:[Estimator Trees 1..100] ──► Mean & StdDev ──► Bounds [Lower, Upper]          |
+───────────────────────────────────────────────────────────────────────────────────────────────+
                                                │
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────────────+
|                         PERSISTENCE & REAL-TIME WEBSOCKETS (Supabase)                         |
|                                                                                               |
|   • Insert Ticket into public.queue_entries                                                   |
|   • Supabase Realtime Broadcasts New Ticket to Dashboard                                      |
|   • Return: { ticket_id, ticket_number, priority: 5, wait: "Under 5 mins", range: "2-4 min" } |
+───────────────────────────────────────────────────────────────────────────────────────────────+
```

### 2. Real-Time Staff Queue Management & Adaptive Velocity Loop

```
+───────────────────────────────────────────────────────────────────────────────────────────────+
|                                  STAFF QUEUE CONTROLS                                         |
|                                                                                               |
|   [Call Next Button] ──► GET /api/queue/{business_id}/next                                    |
|                          • Sorted by: priority_score DESC, created_at ASC                     |
|                          • Triage 5s immediately jump ahead of routine tickets                |
|                                                                                               |
|   [Counter Controls] ──► PATCH /api/tenants/{business_id}/counters                            |
|                          • Dynamically add/remove service windows (c = 1, 2, ..., N)          |
|                                                                                               |
|   [Complete Ticket]  ──► PATCH /api/queue/{ticket_id}/status {"status": "completed"}          |
|                          │                                                                    |
|                          ▼ (FastAPI Background Task)                                          |
|                          recalculate_rolling_velocity(business_id)                            |
|                          • Queries last 5 completed ticket durations                          |
|                          • Clamps mean to [2.0, 45.0] minutes                                 |
|                          • UPDATE tenants SET base_service_time_mins = {clamped_mean}         |
+───────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, lifespan model loader, and master API routes
│   │   ├── config.py                # Environment configuration via pydantic-settings
│   │   ├── database.py              # Supabase singleton client with offline in-memory fallback
│   │   ├── schemas/
│   │   │   ├── intake.py            # Intake request/response Pydantic schemas
│   │   │   └── queue.py             # Queue snapshots, status updates, health schemas
│   │   ├── services/
│   │   │   ├── ai_engine.py         # 3-Tier AI Triage (Gemini 2.5 Flash -> Groq -> Safety Net)
│   │   │   ├── ml_predictor.py      # Random forest inference & tree-variance range estimator
│   │   │   ├── ml_evaluator.py      # Weighted Absolute Percentage Error (WAPE) metric engine
│   │   │   └── queuing_math.py      # M/M/c Erlang-C & Positional Queuing Mathematics engine
│   │   └── workers/
│   │       └── velocity_worker.py   # Background worker for rolling velocity recalculation
│   ├── models/
│   │   └── wait_predictor_cv.pkl    # Pre-trained Scikit-Learn Random Forest artifact
│   ├── supabase_schema.sql          # PostgreSQL DDL with Realtime subscriptions & seed data
│   ├── requirements.txt             # Pinned backend dependencies
│   └── .env                         # Backend environment variables
│
├── frontend/
│   ├── index.html                   # Interactive glassmorphic operations dashboard
│   ├── style.css                    # Dark mode responsive CSS tokens
│   └── app.js                       # Frontend client controller & real-time polling
│
├── ml/
│   ├── data/                        # Training datasets
│   ├── data_generator.py            # Synthetic queue dataset generator with queuing baselines
│   └── train.py                     # 5-Fold cross-validation trainer
│
├── test_pipeline.py                 # Standalone E2E smoke test script
└── README.md                        # Documentation
```

---

## 🚀 Step-by-Step Setup & Usage

### 1. Prerequisites
- Python 3.10+
- Virtual Environment (`venv` or `conda`)
- (Optional) Supabase, Google Gemini, and Groq API Keys

### 2. Environment Configuration
Create or edit `backend/.env`:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key

# LLM Providers (Optional - graceful 3-tier fallback if omitted)
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key

# Machine Learning Artifact Path
ML_MODEL_PATH=models/wait_predictor_cv.pkl

# Defaults
DEFAULT_ACTIVE_COUNTERS=2
DEFAULT_SERVICE_TIME_MIN=12.0
```

### 3. Install Dependencies
```bash
# Create & activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 4. Supabase Database Setup
1. Open your **Supabase Dashboard $\to$ SQL Editor**.
2. Run the script located in [`backend/supabase_schema.sql`](file:///Users/shreemaydixit/Downloads/ikigai_schlop_final.build-main/backend/supabase_schema.sql).
3. This creates:
   - `tenants` table with demo seeds (`metro_urgent_care`, `apex_bank_downtown`, `central_dmv_office`).
   - `queue_entries` table with indexes.
   - Enables `supabase_realtime` replication for live dashboard updates.

### 5. Run the FastAPI Backend Server
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Probe: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 6. Launch Frontend Dashboard
```bash
python3 -m http.server 3000 --directory frontend
```
Visit **[http://127.0.0.1:3000](http://127.0.0.1:3000)** to access the live dashboard.

---

## 🧪 Running the End-to-End Smoke Test

Run the automated smoke test simulating low-priority intake, high-priority emergency walk-ins, priority-based "Call Next" dispatching, ticket lifecycle updates, and counter adjustments:

```bash
python test_pipeline.py
```

### Expected Output Summary:
```plaintext
======================================================================
  STEP A: Low-Priority Intake Request
======================================================================
Ticket ID: 2d7dee2b-a89d-4788-a64e-eaa7cec612d0
Priority Score: 1
Display Range: Under 5 mins

======================================================================
  STEP B: High-Priority Intake Request (Emergency Walk-In)
======================================================================
Ticket ID: d7680918-168f-4551-bb58-63933dd449dc
Priority Score: 5
Display Range: Under 5 mins

======================================================================
  STEP C: Retrieve 'Call Next' Optimal Ticket
======================================================================
>>> SUCCESS: High-priority ticket was returned first despite arriving second!

======================================================================
  STEP D: Complete Ticket & Trigger Velocity Background Worker
======================================================================
Status: completed | Completed At: 2026-08-22T13:46:51.191344

======================================================================
  STEP E: Staff Counter Control (PATCH /api/tenants/{business_id}/counters)
======================================================================
Active Counters Updated: 4
```

---

## 📊 Core API Reference

| Method | Endpoint | Description | Key Payload / Query |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/intake` | Master intake, 3-tier triage, hybrid wait inference & ticket creation | `{"business_id": "...", "user_text": "...", "phone_number": "..."}` |
| `GET` | `/api/queue/{business_id}/next` | Fetches next optimal ticket (`priority DESC`, `created_at ASC`) | Path parameter: `business_id` |
| `PATCH` | `/api/queue/{ticket_id}/status` | Updates ticket status (`in_progress`, `completed`, `cancelled`) | `{"status": "completed"}` |
| `PATCH` | `/api/tenants/{business_id}/counters` | Dynamically updates number of operational counters | `{"active_counters": 4}` |
| `GET` | `/api/queue/{business_id}` | Real-time queue metrics ($\lambda, \mu, \rho$) and active waiting list | Path parameter: `business_id` |
| `GET` | `/api/health` | System health probe (DB, ML model, AI APIs) | None |

---

## 🔬 Mathematical Formulas Reference

### 1. Discrete Positional Wait
$$W_{\text{positional}} = \left(\frac{N_{\text{ahead}}}{c}\right) \times \bar{S}_{\text{rolling}} \times K_{\text{priority}}$$
Where $K_{\text{priority}} = \max(0.25, 1.0 - (\text{priority\_score} - 1) \times 0.15)$.

### 2. Multi-Server Steady-State Erlang-C
$$P_0 = \left[ \sum_{k=0}^{c-1} \frac{a^k}{k!} + \frac{a^c}{c!(1-\rho)} \right]^{-1}, \quad P_C = \frac{a^c}{c!(1-\rho)} P_0, \quad W_q = \frac{P_C}{c\mu - \lambda}$$

### 3. Weighted Absolute Percentage Error (WAPE)
$$\text{WAPE} = \frac{\sum |y_{\text{true}} - y_{\text{pred}}|}{\sum y_{\text{true}}} \times 100$$
Evaluates accuracy across the entire distribution without distortion from low-wait denominators.
