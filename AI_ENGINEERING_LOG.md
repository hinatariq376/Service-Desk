# AI Engineering Log

## Session: 2026-08-14 — Full-Stack Service Desk Upgrade

### Objective

Refactor mock React/Vite prototype into production Service Desk connected to live Supabase PostgreSQL per VP-approved specs.

### Approach

1. **Explored** existing mock-data architecture (screens, ticketStore, types)
2. **Designed** Supabase service layer with role-based query filters
3. **Implemented** AuthContext + TicketContext replacing in-memory store
4. **Wired** React Router for `/login` and `/register`
5. **Enforced** state machine and SLA policies in dedicated lib modules
6. **Connected** Realtime subscriptions for cross-role live updates
7. **Refactored** agent portal for strict assignment isolation
8. **Added** admin ticket assignment and live user management
9. **Updated** UI to zinc/slate enterprise dark theme
10. **Generated** standard documentation artifacts

### Key Files Created

| Path | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/database.types.ts` | PG schema types |
| `src/lib/sla.ts` | SLA policy engine |
| `src/lib/stateMachine.ts` | Transition rules |
| `src/lib/mappers.ts` | DB ↔ app mapping |
| `src/context/AuthContext.tsx` | Auth state |
| `src/context/TicketContext.tsx` | Tickets + realtime |
| `src/services/*.ts` | Data access |
| `src/pages/auth/*.tsx` | Login/register |

### Human Review Checklist

- [ ] Confirm Supabase RLS policies match role isolation requirements
- [ ] Seed demo users in Auth + `users` table
- [ ] Enable Realtime on required tables in Supabase dashboard
- [ ] Verify `ticket_comments` table name matches backend schema

### Outcome

Clean compile via `npm run build`. Application ready for live evaluation once demo accounts are seeded in Supabase.






# AI Engineering Log

## Initial Environment & Architecture Audit
* **Date:** August 19, 2026
* **AI Tool Used:** Gemini / Continue Agent
* **Task:** Initialize project audit log system and correct database data-retention policies.

### Workflow
* **Prompt Given:** Audit current user deletion policy and missing audit logging tables for enterprise compliance.
* **AI Recommendation:** 
  1. Replace `ON DELETE CASCADE` with soft deletion or nullable foreign keys on tickets table.
  2. Implement dedicated `audit_logs` table for tracking state transitions.
* **Human Review:** Verified architectural gaps highlighted during code review.
* **Action Taken:** Initialized tracking documentation and scheduled database schema migration.



# AI Engineering Log

## Audit Logging & Data Retention Implementation
* **Date:** August 20, 2026
* **AI Tool Used:** Kyro AI / Gemini
* **Task:** Add `audit_logs` table and implement soft deletion for ticket records.

### Execution Summary
* **Database Updates:**
  - Created `audit_logs` table tracking `actor_id`, `action`, `entity_type`, and state differences (`old_values`/`new_values`).
  - Added `is_deleted` flag on `tickets` table to replace dangerous `CASCADE` deletes.
* **Human Review:** Checked foreign key constraints to ensure user deletion retains ticket history for SLA auditing.
* **Next Action:** Implement backend trigger / Supabase client service for automated log insertion.