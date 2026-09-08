# ServiceDesk REST API Specification (v1)

Base URL: `http://localhost:5000/api/v1`

All requests and responses use standard `application/json` formatting. Every response includes a unique `requestId` and follows a consistent envelope.

---

## Standard Response Envelopes

### Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "requestId": "req_a1b2c3d4e5"
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "A ticket in RESOLVED status cannot transition directly to IN PROGRESS.",
    "details": []
  },
  "requestId": "req_a1b2c3d4e5"
}
```

---

## Authentication Endpoints

### 1. Register Account
`POST /api/v1/auth/register`

#### Request Body
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "role": "CUSTOMER"
}
```
*Roles: `CUSTOMER` | `SUPPORT_AGENT` | `ADMIN`*

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "67151e2a59e14d6c00000001",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "CUSTOMER"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  },
  "requestId": "req_998877"
}
```

---

### 2. Login
`POST /api/v1/auth/login`

#### Request Body
```json
{
  "email": "customer@servicedesk.com",
  "password": "DemoPassword123!"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "67151e2a59e14d6c00000001",
      "name": "Customer Alice",
      "email": "customer@servicedesk.com",
      "role": "CUSTOMER"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  },
  "requestId": "req_112233"
}
```

---

### 3. Refresh Token
`POST /api/v1/auth/refresh`

#### Request Body
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  },
  "requestId": "req_445566"
}
```

---

## Ticket Management Endpoints

*All ticket endpoints require Header: `Authorization: Bearer <accessToken>`*

### 4. Query Tickets (Paginated & Filtered)
`GET /api/v1/tickets`

#### Query Parameters
* `status`: `OPEN` | `TRIAGED` | `ASSIGNED` | `IN_PROGRESS` | `WAITING_FOR_CUSTOMER` | `RESOLVED` | `CLOSED` | `ALL`
* `priority`: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `ALL`
* `category`: string filter
* `search`: text query across `displayId`, `title`, `customerName`, `category`
* `page`: integer (default: `1`)
* `limit`: integer (default: `20`, max: `100`)
* `sortBy`: `createdAt` | `priority` | `status` | `displayId` | `slaDeadline`
* `sortOrder`: `asc` | `desc`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "67151e2a59e14d6c00000010",
        "displayId": "TCK-80491",
        "title": "Payment API returning HTTP 500 errors",
        "description": "Our checkout gateway is timing out when processing Visa cards.",
        "category": "Infrastructure",
        "priority": "CRITICAL",
        "status": "IN_PROGRESS",
        "customerId": "67151e2a59e14d6c00000001",
        "customerName": "Customer Alice",
        "assignedAgentId": "67151e2a59e14d6c00000002",
        "assignedAgentName": "Support Agent Alex",
        "slaResponseDeadline": "2026-09-07T12:15:00.000Z",
        "slaResolutionDeadline": "2026-09-07T16:00:00.000Z",
        "slaDeadline": "2026-09-07T16:00:00.000Z",
        "slaBreach": false,
        "tags": ["payment", "critical", "api"],
        "attachments": [],
        "createdAt": "2026-09-07T12:00:00.000Z",
        "updatedAt": "2026-09-07T12:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "requestId": "req_887766"
}
```

---

### 5. Create Ticket
`POST /api/v1/tickets`

#### Request Body
```json
{
  "title": "Database connection pool timeout on checkout",
  "description": "Seeing severe connection timeouts on postgres pool during peak volume.",
  "category": "Infrastructure",
  "priority": "CRITICAL",
  "tags": ["postgres", "timeout"]
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "ticket": {
      "displayId": "TCK-99214A",
      "title": "Database connection pool timeout on checkout",
      "status": "OPEN",
      "priority": "CRITICAL",
      "slaResponseDeadline": "2026-09-07T12:15:00.000Z",
      "slaResolutionDeadline": "2026-09-07T16:00:00.000Z",
      "slaBreach": false
    }
  },
  "requestId": "req_554433"
}
```

---

### 6. Transition Ticket Status (State Machine)
`POST /api/v1/tickets/:id/status`

#### Request Body
```json
{
  "status": "IN_PROGRESS"
}
```

#### Response (`200 OK` on Success)
```json
{
  "success": true,
  "data": {
    "ticket": {
      "displayId": "TCK-99214A",
      "status": "IN_PROGRESS"
    }
  },
  "requestId": "req_114477"
}
```

#### Error Response (`400 Bad Request` on Illegal Transition)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "A ticket in RESOLVED status cannot transition directly to IN PROGRESS."
  },
  "requestId": "req_114478"
}
```

---

### 7. Assign Ticket to Agent (Admin Only)
`POST /api/v1/tickets/:id/assign`

#### Request Body
```json
{
  "agentId": "67151e2a59e14d6c00000002"
}
```

---

### 8. Post Comment / Internal Note
`POST /api/v1/tickets/:id/comments`

#### Request Body
```json
{
  "content": "Root cause identified: Redis cache eviction threshold was too low.",
  "isInternal": true
}
```
*Note: `isInternal: true` is strictly restricted to Support Agents and Admins.*

---

## Analytics & Audit Trail Endpoints

### 9. Dashboard Analytics
`GET /api/v1/dashboard/analytics`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 10000,
      "open": 1842,
      "inProgress": 2203,
      "resolved": 4891,
      "closed": 1064,
      "critical": 847,
      "slaBreaches": 142,
      "avgResolutionHours": 3.4,
      "slaBreachRate": 1.4
    },
    "byPriority": [
      { "priority": "CRITICAL", "name": "Critical", "count": 847 },
      { "priority": "HIGH", "name": "High", "count": 2341 },
      { "priority": "MEDIUM", "name": "Medium", "count": 4102 },
      { "priority": "LOW", "name": "Low", "count": 2710 }
    ],
    "byStatus": [
      { "status": "OPEN", "name": "Open", "count": 1842 },
      { "status": "IN_PROGRESS", "name": "In Progress", "count": 2203 },
      { "status": "RESOLVED", "name": "Resolved", "count": 4891 },
      { "status": "CLOSED", "name": "Closed", "count": 1064 }
    ]
  },
  "requestId": "req_998811"
}
```

---

### 10. Audit Trail (Admin Only)
`GET /api/v1/audit-logs`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "67151e2a59e14d6c00000099",
        "actorName": "Support Agent Alex",
        "actorRole": "SUPPORT_AGENT",
        "action": "STATUS_CHANGED",
        "entityId": "TCK-80491",
        "oldValue": { "status": "ASSIGNED" },
        "newValue": { "status": "IN_PROGRESS" },
        "timestamp": "2026-09-07T12:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50
  },
  "requestId": "req_332211"
}
```

---

### 11. AI Assistant Summarize & Classify
`POST /api/v1/ai/summarize`
`POST /api/v1/ai/classify`
