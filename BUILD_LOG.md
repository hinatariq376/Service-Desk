# Build Log

## 2026-08-14 — Production Supabase Integration

### Completed

1. **Supabase client** — `src/lib/supabase.ts` with live project URL and publishable key
2. **Database types** — `src/lib/database.types.ts` for users, tickets, ticket_comments, audit_logs
3. **Auth** — Login (`/login`) and Register (`/register`) with CUSTOMER / SUPPORT_AGENT / ADMIN roles
4. **Profile sync** — `users` table upsert on registration
5. **Ticket services** — CRUD, role filters, assignment, comments, audit logging
6. **State machine** — Legal transitions enforced with error badge UI
7. **SLA engine** — CRITICAL 15m/4h, HIGH 1h/8h, MEDIUM 4h/24h, LOW 8h/72h
8. **Realtime** — postgres_changes listeners on tickets, comments, audit_logs
9. **UI refactor** — Zinc/slate dark theme, dark status badges, admin assignment dropdown
10. **Documentation** — README, ARCHITECTURE, API, DECISIONS, BUILD_LOG, AI_ENGINEERING_LOG

### Dependencies Added

- `react-router-dom`

### Verification

- `npm run build` — passes
- `npm run dev` — Vite dev server on port 8443

### Notes

- Demo accounts must exist in Supabase Auth (register via `/register` or seed in dashboard)
- Demo password constant: `Demo123!`
