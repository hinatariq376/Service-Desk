# System Architecture Document

## 1. System Architecture Overview

The ServiceDesk platform is built following a clean, layered architectural pattern ensuring strict separation of concerns across presentation, business logic, persistence, and observability layers.

```mermaid
graph TD
    Client["React + TypeScript SPA (Vite + Tailwind CSS)"]
    
    subgraph Gateway ["Express 4 API Gateway (:5000)"]
        Security["Helmet + CORS + Rate Limiter"]
        ReqId["Request ID & Pino Logger"]
        AuthMid["JWT Auth & Role-Based RBAC Middleware"]
        ValMid["Zod Request Validation"]
    end
    
    subgraph Controllers ["Controllers Layer"]
        AuthCtrl["AuthController"]
        TicketCtrl["TicketController"]
        CommentCtrl["CommentController"]
        DashCtrl["DashboardController"]
        AuditCtrl["AuditController"]
        AICtrl["AIController"]
    end
    
    subgraph Services ["Domain & Business Logic Services"]
        StateService["StateMachineService"]
        SLAService["SLAEngineService"]
        AuthService["AuthService (Bcrypt + JWT)"]
        TicketService["TicketService"]
        AuditService["AuditService (Forensics)"]
        AIService["AIService (Gemini / Heuristic)"]
    end
    
    subgraph RealTime ["Real-Time Layer"]
        SocketIO["Socket.IO Server"]
    end
    
    subgraph Data ["Database Persistence Layer"]
        Mongo["MongoDB 7.0 + Mongoose ORM"]
        UsersCol[("users Collection")]
        TicketsCol[("tickets Collection (Compound Indexes)")]
        CommentsCol[("comments Collection")]
        AuditCol[("audit_logs Collection")]
        SLACol[("sla_policies Collection")]
    end

    Client -->|HTTPS REST API| Security
    Client <-->|WebSocket Events| SocketIO
    Security --> ReqId --> AuthMid --> ValMid
    ValMid --> Controllers
    
    AuthCtrl --> AuthService
    TicketCtrl --> TicketService & StateService & SLAService
    CommentCtrl --> TicketService
    DashCtrl --> TicketService
    AuditCtrl --> AuditService
    AICtrl --> AIService
    
    TicketService --> Mongo
    AuditService --> Mongo
    AuthService --> Mongo
    TicketService -.->|Broadcast Changes| SocketIO
    
    Mongo --- UsersCol
    Mongo --- TicketsCol
    Mongo --- CommentsCol
    Mongo --- AuditCol
    Mongo --- SLACol
```

---

## 2. Component Architecture & Separation of Concerns

The backend strictly avoids monolithic handler anti-patterns by enforcing four decoupled tiers:

1. **Routing & Middleware Tier** (`src/routes/`, `src/middleware/`):
   * Attaches unique `X-Request-Id` for distributed trace correlation.
   * Enforces security headers via `helmet` and IP rate-limiting.
   * Performs runtime input validation using `Zod` schemas.
   * Decodes and validates JWT tokens, populating `req.user`.

2. **Controllers Tier** (`src/controllers/`):
   * Orchestrates HTTP request/response lifecycles.
   * Maps incoming parameters to domain service calls.
   * Returns standardized JSON envelopes: `{ success: true, data: ..., requestId: ... }`.

3. **Domain Services Tier** (`src/services/`):
   * Implements pure business logic without Express couplings.
   * **`stateMachineService`**: Validates legal state transitions and returns formal error structures.
   * **`slaService`**: Computes response and resolution timestamps in UTC.
   * **`auditService`**: Emits immutable change records with deep object diffs.
   * **`aiService`**: Pluggable provider for intelligent summarization and triage.

4. **Persistence & Data Modeling Tier** (`src/models/`):
   * Mongoose schemas with compound indexes optimized for pagination, filtering, and role-based isolation.
   * Soft-delete data retention enforcement (`deletedAt: null`).

---

## 3. MongoDB Data Model & Entity Relationship (ER) Diagram

```mermaid
erDiagram
    USER ||--o{ TICKET : "creates (customer)"
    USER ||--o{ TICKET : "assigned_to (agent)"
    USER ||--o{ COMMENT : "authors"
    USER ||--o{ AUDIT_LOG : "triggers"
    TICKET ||--o{ COMMENT : "contains"
    TICKET ||--o{ AUDIT_LOG : "generates_trail"

    USER {
        ObjectId _id PK
        string name
        string email UK "Indexed"
        string password "Bcrypt hashed"
        string role "CUSTOMER | SUPPORT_AGENT | ADMIN"
        string avatar
        date createdAt
        date updatedAt
    }

    TICKET {
        ObjectId _id PK
        string displayId UK "Indexed (TCK-XXXXXX)"
        string title
        string description
        string category "Indexed"
        string priority "CRITICAL | HIGH | MEDIUM | LOW (Indexed)"
        string status "OPEN | TRIAGED | ASSIGNED | IN_PROGRESS | WAITING | RESOLVED | CLOSED (Indexed)"
        ObjectId customerId FK "Indexed"
        string customerName
        ObjectId assignedAgentId FK "Indexed"
        string assignedAgentName
        date slaResponseDeadline
        date slaResolutionDeadline
        date slaDeadline
        boolean slaBreach "Indexed"
        array tags
        array attachments
        date deletedAt "Indexed (Soft Delete)"
        date createdAt "Indexed"
        date updatedAt
    }

    COMMENT {
        ObjectId _id PK
        ObjectId ticketId FK "Indexed"
        ObjectId authorId FK
        string authorName
        string authorRole
        string content
        boolean isInternal "Indexed (Hidden from Customers)"
        date deletedAt
        date createdAt "Indexed"
    }

    AUDIT_LOG {
        ObjectId _id PK
        ObjectId actorId FK "Indexed"
        string actorName
        string actorRole
        string action "STATUS_CHANGED | TICKET_CREATED | AGENT_ASSIGNED | etc."
        string entity "Ticket"
        string entityId "Indexed (TCK-XXXXXX)"
        json oldValue "Before mutation state"
        json newValue "After mutation state"
        date timestamp "Indexed"
        json metadata
    }

    SLA_POLICY {
        ObjectId _id PK
        string priority UK
        number responseMinutes
        number resolutionHours
    }
```

### Database Indexing Strategy
To ensure sub-millisecond query performance on datasets exceeding 10,000+ tickets (Section 20):
* `{ customerId: 1, deletedAt: 1, createdAt: -1 }`: Fast customer portal pagination.
* `{ assignedAgentId: 1, deletedAt: 1, status: 1 }`: Fast agent queue filtering.
* `{ status: 1, priority: 1, deletedAt: 1 }`: Accelerated triage and analytics aggregations.
* `{ title: "text", description: "text", category: "text" }`: Full-text search support.

---

## 4. Request Lifecycle & Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Application
    participant Helmet as Security & Rate Limiter
    participant Logger as Pino & OpenTelemetry
    participant Auth as Auth & RBAC Middleware
    participant Val as Zod Schema Validator
    participant Ctrl as TicketController
    participant Service as TicketService
    participant State as StateMachineService
    participant DB as MongoDB
    participant Socket as Socket.IO Hub

    User->>Helmet: HTTP POST /api/v1/tickets/:id/status { status: "RESOLVED" }
    Helmet->>Logger: Assign X-Request-Id & Start Span
    Logger->>Auth: Validate Bearer JWT Token
    Auth->>Val: Check User Role & Authorization
    Val->>Ctrl: Validate Request Body { status: "RESOLVED" }
    Ctrl->>Service: transitionStatus(ticketId, "RESOLVED", req.user)
    Service->>State: validateTransition(fromStatus, toStatus, role)
    alt Invalid Transition
        State-->>Ctrl: { ok: false, code: "INVALID_STATUS_TRANSITION" }
        Ctrl-->>User: HTTP 400 Bad Request { success: false, error: ... }
    else Legal Transition
        State-->>Service: { ok: true }
        Service->>DB: Update Ticket Status & Record Audit Log
        DB-->>Service: Updated Document
        Service->>Socket: Emit "ticket:status_changed" { eventId, displayId, newStatus }
        Service-->>Ctrl: Updated Ticket
        Ctrl-->>User: HTTP 200 OK { success: true, data: { ticket } }
    end
```

---

## 5. Authentication & Token Lifecycle

* **Registration (`POST /api/v1/auth/register`)**: Passwords hashed with `bcryptjs` (salt rounds: 10). Emits access token (15m) and refresh token (7d).
* **Login (`POST /api/v1/auth/login`)**: Validates credentials via `comparePassword()`. Returns scoped tokens containing `userId`, `email`, `role`, and `name`.
* **Token Rotation (`POST /api/v1/auth/refresh`)**: Validates the refresh token secret and verifies user persistence before generating fresh token pairs.
