# Security & Compliance Policy

## 1. Authentication & Identity Management
* **Password Hashing**: Passwords are cryptographically hashed using **Bcrypt** with salt work factor of `10`. Plaintext credentials are never persisted or returned in API responses (`select: false` on Mongoose models).
* **Token Strategy**: Employs an asymmetric short-lived **JWT Access Token (15 minutes)** for stateless authentication and a long-lived **Refresh Token (7 days)** for secure session rotation.
* **Token Invalidation**: Refresh endpoints verify user existence and role validity in MongoDB before rotating tokens.

---

## 2. Authorization & Role-Based Access Control (RBAC)
Authorization is strictly validated at both the routing layer and the domain service layer:

| Role | Permissions & Access Scope |
| :--- | :--- |
| **CUSTOMER** | • Create tickets<br>• View own non-deleted tickets (`customerId = auth.userId`)<br>• Post public comments<br>• Transition only `RESOLVED → CLOSED`<br>• **Denied**: Access to other customer tickets, internal notes, audit logs, priority updates, agent assignments. |
| **SUPPORT_AGENT** | • View assigned tickets (`assignedAgentId = auth.userId`) and unassigned pool<br>• Full forward state machine transitions<br>• Post public replies and internal notes (`isInternal: true`)<br>• **Denied**: Access to audit logs, changing ticket priorities, deleting tickets. |
| **ADMIN** | • Global ticket inspection<br>• User management & role assignment<br>• Assign/reassign tickets<br>• Priority overrides & SLA policy updates<br>• Full forensic audit trail inspection<br>• Soft-delete ticket records. |

---

## 3. Threat Modeling & Defense in Depth

### A. Injection Attacks & SQL/NoSQL Sanitization
* **Mongoose Schema Typing**: Strictly types every query, casting ObjectIds and preventing NoSQL injection (`$where` execution disabled).
* **Zod Schema Validation**: Every API parameter, request body, and query string is verified before reaching controller logic.

### B. DoS / Brute-Force Rate Limiting
* `express-rate-limit` enforces a maximum threshold of **1000 requests per 15-minute window** per IP address, preventing resource exhaustion and automated password cracking.

### C. HTTP Security Headers
* `helmet()` attaches standard defensive HTTP headers:
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY` (Clickjacking prevention)
  * `Strict-Transport-Security` (HSTS)
  * `Content-Security-Policy` (CSP)
  * `X-XSS-Protection`

### D. Centralized Error Sanitization & Data Leaks
* Centralized error middleware ensures that **stack traces and internal database schemas are never exposed** to API clients in production.
* Structured JSON error responses return clean error codes (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_STATUS_TRANSITION`).

### E. File Upload Restrictions
* File uploads enforce strict MIME type whitelists (PNG, JPG, PDF, CSV) with a **10MB maximum file size limit** to mitigate malicious file uploads.

### F. Secret Management
* Secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `GEMINI_API_KEY`) are managed strictly through environment variables.
* A clean template `.env.example` is committed to source control with zero embedded production secrets.
