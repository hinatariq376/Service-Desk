# ServiceDesk — Production-Grade Support & Operations Platform

[![CI/CD Pipeline](https://github.com/hinatariq376/Service-Desk/actions/workflows/ci.yml/badge.svg)](https://github.com/hinatariq376/Service-Desk/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, multi-user service and request management platform engineered for software enterprises. Built with a robust full-stack architecture (**React + TypeScript + Vite + Tailwind CSS** frontend paired with a **Node.js + Express + TypeScript + MongoDB** backend), featuring real-time **Socket.IO** updates, an automated **SLA & Priority Engine**, a strict **Ticket State Machine**, immutable **Audit Logging**, **OpenTelemetry** observability, structured **Pino** logging, and an **AI Assistant** module for automated ticket summarization and triage.

---

## Candidate Brief
* **Candidate**: Hina Tariq
* **Target Track**: Full-Stack Engineer / Software Engineer
* **Primary Stack**: React + TypeScript + Node.js + Express + MongoDB + Docker

---

## Key System Capabilities

### 1. Role-Based Access Control (RBAC) & Multi-Tenant Portals
* **Customer Portal**: Create service requests, view and search own tickets, post customer replies, view real-time SLA countdowns, and close resolved tickets.
* **Agent Workspace**: Manage assigned queues, active work, and SLA-breached queues, transition tickets along the state machine, post internal notes vs. customer replies, and access AI-generated summaries and suggested responses.
* **Administrator Control Center**: Full system ticket visibility, dynamic agent assignment, user and role management, live analytics with Recharts visualization, forensic audit trail with JSON diff viewer, and SLA policy configuration.

### 2. Deterministic Ticket State Machine
* Enforces strict status progression:
  $$\text{OPEN} \longrightarrow \text{TRIAGED} \longrightarrow \text{ASSIGNED} \longrightarrow \text{IN\_PROGRESS} \underset{\text{customer}}{\overset{\text{wait}}{\rightleftharpoons}} \text{WAITING\_FOR\_CUSTOMER} \longrightarrow \text{RESOLVED} \longrightarrow \text{CLOSED}$$
* Prevents illegal transitions at both the API and database levels, returning structured `400 Bad Request` responses with `{ success: false, error: { code: "INVALID_STATUS_TRANSITION" } }`.

### 3. Automated SLA & Priority Engine
* Dynamic computation of **First-Response Deadlines** and **Resolution Deadlines** using UTC timestamps:
  * **CRITICAL**: 15 min Response | 4 hour Resolution
  * **HIGH**: 1 hour Response | 8 hour Resolution
  * **MEDIUM**: 4 hour Response | 24 hour Resolution
  * **LOW**: 8 hour Response | 72 hour Resolution
* Live client-side countdown timer, visual warning thresholds, and automatic breach detection.

### 4. Forensic Audit Trail & Data Traceability
* Every mutating action (`TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_UPDATED`, `AGENT_ASSIGNED`, `COMMENT_ADDED`, `INTERNAL_NOTE_ADDED`, `TICKET_SOFT_DELETED`) is immutably recorded with actor ID, timestamp, before/after JSON state diffs, and entity metadata.

### 5. Real-Time Socket.IO Synchronization
* Real-time events for ticket creation, assignments, status transitions, and comments with client-side deduplication.

### 6. Replaceable AI Service Abstraction
* Built-in AI module for ticket summarization, categorization, priority suggestion, and canned response generation (supports Google Gemini API or zero-dependency NLP heuristics fallback).

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite, Tailwind CSS 4 | Responsive, accessible SPA interface |
| **Icons & Charts** | Lucide React, Recharts | Data visualization & iconography |
| **Backend API** | Node.js 20, Express, TypeScript | Layered REST API (`/api/v1/*`) |
| **Database** | MongoDB 7.0 + Mongoose ORM | Compound-indexed persistent document store |
| **Real-time** | Socket.IO | Asynchronous bidirectional event pipeline |
| **Validation** | Zod | Runtime schema validation for requests and query params |
| **Security** | Bcrypt.js, JWT (Access + Refresh), Helmet, Rate-Limit | Authentication & security hardening |
| **Observability** | Pino, Pino-HTTP, OpenTelemetry | Structured JSON logging & request tracing |
| **Testing** | Vitest, Supertest, V8 Coverage | Automated unit and integration testing |
| **DevOps** | Docker, Docker Compose, GitHub Actions | Multi-stage containerization & CI/CD |

---

## Project Structure

```
Service-Desk/
├── .github/workflows/ci.yml       # GitHub Actions CI/CD pipeline
├── Dockerfile                      # Production multi-stage Docker build
├── docker-compose.yml              # MongoDB + Full-Stack App orchestration
├── .env.example                    # Template environment variables
├── package.json                    # Frontend & root dependencies
├── tsconfig.json                   # Frontend TypeScript configuration
├── src/                            # Frontend Application (React + Vite)
│   ├── components/                 # AppLayout, SLATimer, StatusBadge, CreateTicketModal
│   ├── context/                    # AuthContext, TicketContext
│   ├── pages/                      # Role-scoped page views (customer, agent, admin, auth)
│   ├── screens/                    # Dashboard containers
│   ├── services/                   # API / Supabase data access layer
│   └── lib/                        # State machine, SLA calculations, database types
├── server/                         # Backend Application (Node.js + Express + TypeScript)
│   ├── package.json                # Server dependencies & scripts
│   ├── tsconfig.json               # Server TypeScript configuration
│   ├── src/
│   │   ├── config/                 # Environment variables & SLA policies
│   │   ├── controllers/            # Auth, Ticket, Comment, Dashboard, Audit, AI
│   │   ├── services/               # State machine, SLA, Auth, Ticket, AI services
│   │   ├── models/                 # Mongoose schemas (User, Ticket, Comment, AuditLog, SLAPolicy)
│   │   ├── routes/                 # REST API routers (/api/v1/*)
│   │   ├── middleware/             # Auth, RBAC, Zod validation, Rate limiting, Error handler
│   │   ├── validators/             # Zod validation schemas
│   │   ├── observability/          # Pino logger & OpenTelemetry tracing
│   │   ├── events/                 # Socket.IO event handlers
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # HTTP & Socket.IO server entrypoint
│   ├── scripts/
│   │   └── seed.ts                 # Seeding & 10,000-ticket performance benchmark
│   └── tests/                      # Supertest & Vitest backend integration tests
└── docs/                           # Comprehensive technical documentation
    ├── ARCHITECTURE.md             # System design, data model & request lifecycles
    ├── API.md                      # REST API endpoint reference
    ├── SECURITY.md                 # Threat model & security controls
    ├── TESTING.md                  # Test suites & verification reports
    ├── DEPLOYMENT.md               # Production deployment guide
    ├── DECISIONS.md                # Architectural Decision Records (ADRs)
    ├── BUILD_LOG.md                # Feature engineering log
    └── AI_ENGINEERING_LOG.md       # AI pair programming trajectory
```

---

## Quickstart & Local Setup

### Prerequisites
* **Node.js**: v20.x or higher
* **npm**: v10.x or higher
* **MongoDB**: Local MongoDB instance running on `mongodb://localhost:27017` (or Docker)

### 1. Installation

```bash
# Clone repository
git clone https://github.com/hinatariq376/Service-Desk.git
cd Service-Desk

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2. Environment Configuration

```bash
cp .env.example .env
cp .env.example server/.env
```

### 3. Run with Docker Compose (Recommended)

To spin up MongoDB and the full-stack application in a single command:

```bash
docker compose up --build
```
* **Frontend Application**: `http://localhost:5000`
* **Health Check**: `http://localhost:5000/health`
* **REST API**: `http://localhost:5000/api/v1`

### 4. Run in Development Mode

```bash
# Terminal 1: Start Backend
cd server
npm run dev

# Terminal 2: Start Frontend
npm run dev
```

---

## Seed Data & Performance Challenge (Section 20)

To seed standard demo users, tickets, comments, and audit logs:
```bash
cd server
npm run seed
```

To run the **10,000 Ticket Performance Benchmark Challenge**:
```bash
cd server
npm run seed:perf
```

### Pre-configured Demo Accounts

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@servicedesk.com` | `DemoPassword123!` | Submit & track requests, customer comments, close tickets |
| **Support Agent** | `agent@servicedesk.com` | `DemoPassword123!` | Assigned queue, active work, internal notes, transitions |
| **Administrator** | `admin@servicedesk.com` | `DemoPassword123!` | System analytics, user management, audit logs, SLA config |

---

## Automated Test Suites

```bash
# Run Frontend & Domain Tests (223 tests)
npm test

# Run Backend API & Integration Tests (16 tests)
cd server && npm test
```

---

## Documentation Directory
* [Architecture Design](ARCHITECTURE.md)
* [REST API Reference](API.md)
* [Security & Compliance](SECURITY.md)
* [Testing Report](TESTING.md)
* [Deployment Guide](DEPLOYMENT.md)
* [Architectural Decisions (ADRs)](DECISIONS.md)
* [Build Log](BUILD_LOG.md)
* [AI Engineering Log](AI_ENGINEERING_LOG.md)