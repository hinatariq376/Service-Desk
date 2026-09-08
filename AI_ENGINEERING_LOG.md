# AI Engineering & Development Log

## Overview
This document logs the AI-assisted engineering workflow for the **ServiceDesk** platform. In compliance with the technical assessment guidelines, ~90% of the system architecture, refactoring, database migrations, state machine validations, and test scenarios were executed using AI tools and agent workflows.

---

## AI Toolkit & Environment
* **Google Anti-Gravity / Kyro AI:** Architectural planning, system boundary definition, soft-delete data retention strategies, and audit schema design.
* **GitHub Copilot / Continue Agent:** In-line TypeScript code completion, Supabase service layer scaffolding, React context wiring, and Zod schema validation.
* **Gemini LLM:** Dynamic SLA logic calculation, database foreign key constraint audits, and edge-case testing verification.

---

## Engineering Sessions & Execution Logs

### Session 1: Full-Stack Service Desk Upgrade & Core Infrastructure
* **Date:** August 14, 2026
* **AI Tool Used:** Continue Agent / Copilot / Gemini
* **Task:** Refactor mock React/Vite prototype into a production Service Desk platform connected to a live Supabase PostgreSQL database per specs.

#### Execution Steps:
1. **Explored** existing mock-data architecture (screens, `ticketStore`, types).
2. **Designed** Supabase service layer with role-based query filters.
3. **Implemented** `AuthContext` + `TicketContext` replacing the in-memory store.
4. **Wired** React Router for protected routes (`/login`, `/register`).
5. **Enforced** ticket state machine and SLA policies in dedicated library modules.
6. **Connected** Realtime subscriptions for cross-role live updates.
7. **Refactored** agent portal for strict assignment isolation.
8. **Added** admin ticket assignment and live user management.
9. **Updated** UI to zinc/slate enterprise dark theme.
10. **Generated** standard technical documentation artifacts.

#### Key Infrastructure Files Created:
| Path | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client setup |
| `src/lib/database.types.ts` | PostgreSQL schema types |
| `src/lib/sla.ts` | SLA policy calculation engine |
| `src/lib/stateMachine.ts` | Ticket state transition rules |
| `src/lib/mappers.ts` | DB ↔ app object mapping |
| `src/context/AuthContext.tsx` | Authentication & user state |
| `src/context/TicketContext.tsx` | Ticket state + real-time subscriptions |
| `src/services/*.ts` | Data access service layer |
| `src/pages/auth/*.tsx` | Authentication interfaces |

#### Human Review Checklist:
- [x] Confirmed Supabase RLS policies match role isolation requirements.
- [x] Seeded demo users in Auth + `users` table.
- [x] Enabled Realtime on required tables in Supabase dashboard.
- [x] Verified `ticket_comments` table name matches backend schema.

**Outcome:** Clean compile via `npm run build`. Application ready for live evaluation.

---

### Session 2: Environment Audit & Data Retention Policy Correction
* **Date:** August 19, 2026
* **AI Tool Used:** Gemini / Continue Agent
* **Task:** Audit project data retention policy and correct user deletion behavior for compliance.

#### Workflow:
* **Prompt Given:** 
  > "Audit current user deletion policy and missing audit logging tables for enterprise compliance."
* **AI Recommendation:**
  1. Replace `ON DELETE CASCADE` with soft deletion (`is_deleted` flag) or nullable foreign keys on tickets table.
  2. Implement dedicated `audit_logs` table for tracking state transitions and system events.
* **Human Review:** Verified architectural gaps highlighted during code review.
* **Action Taken:** Initialized tracking documentation and scheduled database schema migration.

---

### Session 3: Audit Logging & Soft Delete Implementation
* **Date:** August 20–21, 2026
* **AI Tool Used:** Kyro AI (Anti-Gravity) / Gemini
* **Task:** Create `audit_logs` schema and implement soft deletion for ticket records.

#### Execution Summary:
* **Database Updates:**
  - Created `audit_logs` table tracking `actor_id`, `action`, `entity_type`, and state differences (`old_values`/`new_values`).
  - Added `is_deleted` flag on `tickets` table to replace dangerous `CASCADE` deletes.
* **Human Review:** Checked schema foreign key constraints to ensure user deletion retains ticket history for historical SLA auditing.
* **Result:** Historical ticket data and trace history preserved even if related user entities are modified or deleted.

---

## Final Verification
* **Type Check & Build:** Passed (`npm run build`).
* **Role Isolation:** Enforced via RLS and JWT middleware.
* **Auditability:** Fully compliant with enterprise traceability standards.