# Enterprise Service Desk Management System

A robust, role-based Service Desk and Ticket Management System built with React, TypeScript, Tailwind CSS, and Supabase. Designed for automated SLA calculations, real-time ticket escalation, audit logging, and role-restricted actions across Customers, Agents, and Administrators.

---

## Key Features

* **Role-Based Access Control (RBAC):** Distinct dashboards and permissions for Customers, Support Agents, and Admins.
* **SLA & Priority Engine:** Dynamic response and resolution timer tracking with automatic SLA breach detection.
* **Audit Trail & Logging:** Automated Supabase database triggers capturing all `INSERT`, `UPDATE`, and `DELETE` actions.
* **Soft Delete Mechanism:** Database-level interception preventing hard deletes while maintaining data integrity.
* **Responsive UI & Dark Mode:** Built with Tailwind CSS supporting high-contrast accessibility across themes.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **State & Router** | React Context API / Zustand, React Router v6 |
| **Backend / DB** | Supabase (PostgreSQL, Row Level Security) |
| **Authentication** | Supabase Auth (JWT & Role Metadata) |

---

## Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/your-username/service-desk.git](https://github.com/your-username/service-desk.git)
   cd service-desk