# Architecture

This document describes the high-level architecture of DataLab.

## Components

### 1. Frontend (Next.js)
- Responsibilities: Routing, UI state, rendering visualizations, interacting with APIs.
- Framework: Next.js (App Router).
- Styling: Tailwind CSS, shadcn/ui.
- Deployment: Vercel.

### 2. Backend (FastAPI)
- Responsibilities: Data processing APIs, database interactions, dispatching jobs.
- Framework: FastAPI.
- Deployment: Render/Railway.

### 3. Background Workers (Celery/RQ)
- Responsibilities: Heavy ML training, data cleaning, automated EDA, report generation.
- Technology: Python, Pandas, Scikit-learn.

### 4. Database & Authentication (Supabase)
- PostgreSQL for relational data and JSONB storage.
- Supabase Auth for user identity.
- RLS (Row Level Security) for data isolation.

### 5. Caching & Message Broker (Upstash Redis)
- Redis for caching EDA results, rate-limiting, and functioning as a broker for the job queue.
