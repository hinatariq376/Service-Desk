# Supabase Database Setup Instructions

This document explains how to apply the migrations to enable audit logging, RLS policies, and triggers.

## Overview

The Service Desk application uses 4 migrations to set up:
1. **Audit trigger for tickets** - Automatically logs all ticket changes
2. **Audit trigger for comments** - Automatically logs all comment/note changes
3. **SLA breach detection** - Reactive and proactive SLA monitoring
4. **RLS policies + schema** - Row-Level Security and proper permissions

## Quick Start

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Apply all migrations
supabase db push

# Verify migrations
supabase migration list
```

### Option 2: Using Supabase Dashboard

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Apply each migration file in order:
   - `20240001_audit_trigger_tickets.sql`
   - `20240002_audit_trigger_comments.sql`
   - `20240003_audit_trigger_sla_breach.sql`
   - `20240004_rls_policies_and_schema.sql`
4. Click **Run** for each migration

### Option 3: Manual SQL Execution

Connect to your Supabase database using `psql` or any PostgreSQL client:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

Then execute each migration file:

```sql
\i supabase/migrations/20240001_audit_trigger_tickets.sql
\i supabase/migrations/20240002_audit_trigger_comments.sql
\i supabase/migrations/20240003_audit_trigger_sla_breach.sql
\i supabase/migrations/20240004_rls_policies_and_schema.sql
```

## What Each Migration Does

### Migration 20240001: Audit Trigger for Tickets

**Purpose**: Automatically record every ticket creation and update into `audit_logs`.

**Features**:
- Captures INSERT (TICKET_CREATED)
- Captures UPDATE with smart action detection:
  - STATUS_CHANGED
  - PRIORITY_UPDATED
  - AGENT_ASSIGNED
  - SLA_BREACHED
  - TICKET_UPDATED (generic)
- Builds diff of only changed columns
- Resolves actor from JWT claims
- Uses SECURITY DEFINER to bypass RLS

**How it works**:
- Trigger fires AFTER INSERT OR UPDATE on `tickets`
- Extracts actor details from Supabase auth JWT
- Compares OLD and NEW row values
- Writes a single audit log entry per change

### Migration 20240002: Audit Trigger for Comments

**Purpose**: Automatically record all comment and internal note activity.

**Features**:
- Captures INSERT (COMMENT_ADDED or INTERNAL_NOTE_ADDED)
- Captures UPDATE (COMMENT_EDITED)
- Captures DELETE (COMMENT_DELETED)
- Distinguishes public comments from internal notes
- Truncates content to 120 characters to match app behavior

**How it works**:
- Trigger fires AFTER INSERT OR UPDATE OR DELETE on `ticket_comments`
- Checks `is_internal` flag to label action correctly
- Links comment to parent ticket via `ticket_id`

### Migration 20240003: SLA Breach Detection

**Purpose**: Detect and record SLA breaches through two mechanisms.

**Mechanisms**:

1. **Reactive Trigger** (`trg_sla_breach_on_update`)
   - Fires on every ticket UPDATE
   - Checks if SLA deadline has elapsed
   - Writes SLA_BREACHED audit log immediately
   - Auto-flips `sla_breach` flag to `true`

2. **Proactive Scheduled Function** (`fn_check_sla_breaches`)
   - Designed to run on a cron schedule (e.g., every 5 minutes)
   - Scans ALL non-terminal tickets with elapsed deadlines
   - Catches tickets that breach between updates
   - Returns list of breached tickets for logging

**Setup for scheduled checks** (optional):

Using pg_cron (requires Supabase Pro):
```sql
SELECT cron.schedule(
  'sla-breach-sweep',
  '*/5 * * * *',
  $$ SELECT audit.fn_check_sla_breaches(); $$
);
```

Using Supabase Edge Function (any plan):
```typescript
// Deploy an Edge Function that calls:
await supabase.rpc('check_sla_breaches');
// Then schedule it via Supabase Functions scheduled invocations
```

### Migration 20240004: RLS Policies + Schema

**Purpose**: Enable Row-Level Security and grant proper permissions.

**What it does**:
- Creates `audit` schema
- Ensures `audit_logs` table exists with proper indexes
- Enables RLS on all tables (`users`, `tickets`, `ticket_comments`, `audit_logs`)
- Drops old policies (clean slate)
- Creates comprehensive RLS policies:

**Users Table**:
- Users can read their own profile
- Admins can read/insert/update all users
- Users can update their own profile

**Tickets Table**:
- Customers see only their own tickets
- Agents see their assigned tickets + all tickets (if ADMIN)
- Admins see all tickets
- Customers can create tickets
- Admins/Agents/Customers can update tickets (with restrictions)

**Comments Table**:
- Users can view comments on tickets they have access to
- Customers cannot view internal notes
- Users can create comments on accessible tickets

**Audit Logs Table** (CRITICAL):
- **Admins can read ALL audit logs** (no filtering)
- System can insert audit logs (triggers + app code)

**Grants**:
- `authenticated` role can SELECT/INSERT/UPDATE where RLS permits
- `service_role` has full access (for migrations and triggers)

## Verifying the Setup

### 1. Check Tables Exist

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

Should include: `users`, `tickets`, `ticket_comments`, `audit_logs`

### 2. Check Triggers Are Active

```sql
SELECT tgname, tgrelid::regclass, tgtype 
FROM pg_trigger 
WHERE tgname LIKE '%audit%';
```

Should show:
- `trg_audit_tickets`
- `trg_audit_ticket_comments`
- `trg_sla_breach_on_update`

### 3. Check RLS Is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'tickets', 'ticket_comments', 'audit_logs');
```

All should show `rowsecurity = true`.

### 4. Check Policies Exist

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

Should show policies for all four tables.

### 5. Test Audit Logging

As an authenticated user, create a test ticket:

```typescript
await supabase.from('tickets').insert({
  title: 'Test Ticket',
  description: 'Testing audit logs',
  category: 'Test',
  priority: 'LOW',
  customer_id: user.id,
  status: 'OPEN'
});
```

Then check audit logs:

```sql
SELECT * FROM audit_logs WHERE action = 'TICKET_CREATED' ORDER BY created_at DESC LIMIT 1;
```

You should see the newly created audit entry.

### 6. Test Admin Access to Audit Logs

Sign in as an admin user in your app, navigate to **Admin Panel → Audit Logs**, and verify:
- All audit events are visible
- Recent updates appear immediately
- Refresh button works
- Real-time updates appear when other users make changes

## Troubleshooting

### Issue: "Permission denied for table audit_logs"

**Cause**: RLS is blocking your query.

**Solution**: Make sure you're authenticated and your user has role = 'ADMIN' in the `users` table.

```sql
-- Check your user role:
SELECT id, email, role FROM users WHERE email = 'your-email@example.com';

-- If not ADMIN, update it:
UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

### Issue: "Audit logs are not being created"

**Cause**: Trigger is not firing or insert is failing silently.

**Solution**: Check the browser console for errors:
```
Audit log insert failed: [error message]
```

Common causes:
- `actor_id` is null (not authenticated)
- Missing required fields in payload
- RLS policy blocking the insert

Enable detailed logging in `src/services/auditService.ts` (already added in this fix).

### Issue: "Missing the latest 6 updates"

**Causes**:
1. Triggers not applied yet → Apply migrations
2. RLS blocking reads → Verify admin user has role = 'ADMIN'
3. Real-time not subscribed → Check TicketContext subscriptions
4. Audit inserts failing silently → Check browser console

**Solutions**:
- Apply all 4 migrations
- Verify RLS policies with admin role
- Click the Refresh button in Audit Logs
- Check browser console for insert errors

### Issue: "Real-time updates not appearing"

**Cause**: Supabase Realtime not configured for audit_logs table.

**Solution**: Enable Realtime for audit_logs in Supabase Dashboard:
1. Go to **Database → Replication**
2. Find `audit_logs` table
3. Enable Replication
4. Restart your app

## Support

If you encounter issues not covered here:
1. Check the Supabase logs in Dashboard → Logs
2. Check browser console for JavaScript errors
3. Verify your user's role in the database
4. Ensure all 4 migrations have been applied in order
