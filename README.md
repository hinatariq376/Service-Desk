# Service Desk Platform

Production-ready multi-role Service Desk built with **React 19**, **TypeScript**, **Vite 8**, and **Supabase PostgreSQL**.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default port `8443`).

## Demo Accounts

Pre-filled on the login screen. Password for all demo accounts: **`Demo123!`**

| Role | Email |
|------|-------|
| Customer | `customer@servicedesk.com` |
| Support Agent | `agent@servicedesk.com` |
| Admin | `admin@servicedesk.com` |

Register new accounts at `/register` with role selection (Customer, Support Agent, Admin).

## Features

- **Multi-role authentication** — Supabase Auth + `users` profile table
- **Role-based ticket isolation** — Customers see own tickets; agents see only assigned tickets; admins see all
- **State machine** — Enforced status transitions with error UI on invalid moves
- **SLA engine** — Priority-based response/resolution deadlines with live countdown badges
- **Realtime sync** — Supabase `postgres_changes` for tickets, comments, and audit logs
- **Audit trail** — Automatic `audit_logs` inserts for create, status, priority, and assignment events

## Routes

| Path | Access |
|------|--------|
| `/login` | Public |
| `/register` | Public |
| `/customer/*` | Customer |
| `/agent/*` | Support Agent |
| `/admin/*` | Admin |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design
- [API.md](./API.md) — Supabase tables and client services
- [DECISIONS.md](./DECISIONS.md) — Engineering decisions
- [BUILD_LOG.md](./BUILD_LOG.md) — Build history
- [AI_ENGINEERING_LOG.md](./AI_ENGINEERING_LOG.md) — AI-assisted development log

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Supabase

Live project credentials are configured in `src/lib/supabase.ts` as approved for this deployment.
