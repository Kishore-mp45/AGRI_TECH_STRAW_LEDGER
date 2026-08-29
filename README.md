# Straw Ledger

Agri-Tech platform for managing rice straw collection, pyrolysis processing, biochar calculation, carbon MRV, and farmer payouts.

## Architecture

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Vanilla HTML / CSS / JS (Vercel)    |
| Backend     | Python + FastAPI (Railway)          |
| Database    | Supabase PostgreSQL                 |
| File Store  | Supabase Storage                    |
| API Style   | REST — versioned at `/api/v1`       |

## Project Structure

```
straw-ledger/
├── frontend/               # Vanilla HTML/CSS/JS frontend
│   ├── index.html
│   ├── pages/
│   ├── css/
│   ├── js/
│   └── assets/
│
├── backend/                # FastAPI modular-monolith backend
│   ├── app/
│   │   ├── main.py         # App factory, CORS, error handlers
│   │   ├── api/
│   │   │   └── router.py   # Aggregates all module routers under /api/v1
│   │   ├── config/
│   │   │   └── settings.py # Pydantic Settings (reads from .env)
│   │   ├── database/
│   │   │   └── connection.py # SQLAlchemy engine + session factory
│   │   ├── modules/        # Feature modules (one sub-dir per domain)
│   │   │   ├── farmers/
│   │   │   ├── batches/
│   │   │   ├── routing/
│   │   │   ├── calculator/
│   │   │   ├── mrv/
│   │   │   ├── operators/
│   │   │   └── facilities/
│   │   ├── schemas/
│   │   │   └── common.py   # Shared Pydantic base schemas
│   │   └── utils/
│   │       ├── logger.py   # Logging setup
│   │       └── response.py # Standard API response wrapper
│   ├── database/
│   │   ├── schema.sql      # Phase 2: full DB schema
│   │   └── seed.sql        # Phase 2: seed data
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitignore
│
└── docs/
```

---

## Backend — Setup & Run

### 1. Prerequisites

- Python 3.11+
- A Supabase project with Phase 2 schema applied

### 2. Navigate to backend

```bash
cd straw-ledger/backend
```

### 3. Create and activate a virtual environment

**Windows (PowerShell)**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
python -m venv .venv
source .venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
# Windows
copy .env.example ..\.env

# macOS / Linux
cp .env.example ../.env
```

Edit `../.env` (one level above `backend/`) with your actual values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_API_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
APP_ENV=development
```

> **Note:** The `.env` file is read from the parent directory (`straw-ledger/.env`) so it is shared between tools. Never commit `.env` to Git.

### 6. Run the development server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## API Endpoints

| Method | Path             | Description                          |
|--------|------------------|--------------------------------------|
| GET    | `/health`        | Application health check             |
| GET    | `/health/db`     | Database connectivity check          |
| GET    | `/docs`          | Swagger UI (interactive API docs)    |
| GET    | `/redoc`         | ReDoc API documentation              |
| GET    | `/api/v1/farmers/`    | Farmers module (placeholder)    |
| GET    | `/api/v1/batches/`    | Batches module (placeholder)    |
| GET    | `/api/v1/routing/`    | Routing module (placeholder)    |
| GET    | `/api/v1/calculator/` | Calculator module (placeholder) |
| GET    | `/api/v1/mrv/`        | MRV module (placeholder)        |
| GET    | `/api/v1/operators/`  | Operators module (placeholder)  |
| GET    | `/api/v1/facilities/` | Facilities module (placeholder) |

---

## Database — Setup (Phase 2)

Apply the schema and seed data to your Supabase project:

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard)
2. Run `backend/database/schema.sql`
3. Run `backend/database/seed.sql`

---

## Phase Roadmap

| Phase | Description                          | Status      |
|-------|--------------------------------------|-------------|
| 1     | Project Foundation & Folder Setup    | Done        |
| 2     | Database Design & Data Foundation    | Done        |
| 3     | FastAPI Backend Foundation           | Done        |
| 4     | Business Feature APIs                | Upcoming    |
| 5     | Frontend UI                          | Upcoming    |
| 6     | Deployment (Vercel + Railway)        | Upcoming    |

## Frontend — Setup & Run

The frontend is built with Vanilla HTML, CSS, and JS. It connects to the FastAPI backend running on http://127.0.0.1:8000.

### 1. Prerequisites
- The backend must be running.

### 2. Run the frontend
You can use any local web server. For example, using Python:
`ash
cd straw-ledger/frontend
python -m http.server 5500
`
Then open http://localhost:5500 or http://127.0.0.1:5500 in your browser.