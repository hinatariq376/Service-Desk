# Production Deployment Guide

## 1. Containerized Deployment via Docker Compose

The simplest and most robust way to deploy the complete ServiceDesk full-stack application (Frontend + Backend + MongoDB) is with Docker Compose.

### Step 1: Clone Repository & Setup Environment
```bash
git clone https://github.com/hinatariq376/Service-Desk.git
cd Service-Desk
cp .env.example .env
```

### Step 2: Launch Containers
```bash
docker compose up -d --build
```

### Step 3: Verify Container Health
```bash
docker compose ps
curl http://localhost:5000/health
```

---

## 2. Cloud PaaS Deployment Options

### Option A: Railway / Render (Full-Stack Unified Deployment)
1. **Database**: Provision a managed MongoDB database instance (e.g. MongoDB Atlas or Railway MongoDB Plugin).
2. **Web Service**:
   * Connect your GitHub repository.
   * Set **Root Directory** to `/` or `/server`.
   * Set **Build Command**: `npm run build && cd server && npm install && npm run build`
   * Set **Start Command**: `node server/dist/server.js`
3. **Environment Variables**:
   * `NODE_ENV`: `production`
   * `PORT`: `5000` (or PaaS `$PORT`)
   * `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/servicedesk`
   * `JWT_ACCESS_SECRET`: `<generated-32-char-random-key>`
   * `JWT_REFRESH_SECRET`: `<generated-32-char-random-key>`

### Option B: Split Deployment (Vercel Frontend + Render Backend)
* **Frontend (Vercel)**:
  * Framework Preset: **Vite**
  * Build Command: `npm run build`
  * Output Directory: `dist`
  * Environment Variables: `VITE_API_BASE_URL=https://your-backend-api.onrender.com/api/v1`
* **Backend (Render / Railway / Fly.io)**:
  * Runtime: Node.js 20
  * Build: `cd server && npm install && npm run build`
  * Start: `node server/dist/server.js`
  * Environment Variables: `CORS_ORIGIN=https://your-app.vercel.app`

---

## 3. Production Readiness & Health Verification

1. **Liveness & Readiness**: Query `/health` endpoint to verify uptime and process state.
2. **Metrics & Tracing**: Enable OpenTelemetry by setting `ENABLE_OTEL=true` and connecting an OTLP exporter (Jaeger / Grafana Tempo).
3. **Database Indexes**: Run `npm run seed` once to verify compound index creation on `users`, `tickets`, `comments`, and `audit_logs`.
