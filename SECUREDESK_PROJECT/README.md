# SecureDesk — Cybersecurity Incident Management Portal

SecureDesk is an enterprise-grade cybersecurity incident response and investigation portal designed for modern security operations centers (SOC) and enterprise IT teams. It provides end-to-end incident lifecycle management, role-based access control, forensics investigation notes, evidence file attachments, and immutable audit logging.

---

## Architecture Overview

The system is architected as a decoupled client-server application:

```
SecureDesk/
├── securedesk/                 # Flask RESTful API Backend
│   ├── app/                    # Application package
│   │   ├── middleware/         # Auth, Rate limiting, Error handlers, Request logging
│   │   ├── models/             # SQLAlchemy ORM models (User, Incident, Note, File, Audit)
│   │   ├── routes/             # REST API Blueprints (auth, incidents, users, audit)
│   │   ├── schemas/            # Marshmallow request/response validation schemas
│   │   ├── services/           # Core business logic & state machine transitions
│   │   └── utils/              # Security (bcrypt, JWT), seeders, constants, responses
│   ├── tests/                  # Pytest test suite (124 comprehensive tests)
│   ├── run.py                  # Backend entry point
│   ├── securedesk.db           # Local SQLite database (auto-seeded)
│   └── requirements.txt        # Python dependencies
│
├── securedesk-frontend/        # Vanilla HTML5 / CSS3 / ES6 Frontend
│   ├── css/                    # Custom design system (dark-accent modern UI)
│   ├── js/                     # Client logic (API client, UI helpers, page controllers)
│   ├── index.html              # Sign-in portal
│   ├── register.html           # User registration
│   ├── verify.html             # Email verification handler
│   ├── dashboard.html          # Incident management dashboard
│   ├── incident.html           # Detailed incident view & forensics workbench
│   ├── users.html              # User management (Admin only)
│   ├── audit.html              # Immutable audit trail (Admin only)
│   └── profile.html            # User profile & credentials manager
│
├── postman/                    # API specification and Postman collection
├── start.bat                   # 1-Click Windows Batch launcher
├── start.ps1                   # 1-Click PowerShell launcher
└── README.md                   # Unified project documentation
```

---

## Key Features

1. **Role-Based Access Control (RBAC):**
   - **Admin:** Full administrative governance, investigator assignment, user role management, system-wide audit visibility, and closing incidents.
   - **Investigator:** Forensic analysis, status progression (`investigating`, `resolved`), technical notes, and evidence upload.
   - **Employee:** Incident reporting, tracking personal incidents, downloading attached artifacts.

2. **Incident Lifecycle State Machine:**
   - Strict transition constraints: `reported` $\to$ `under_review` / `assigned` $\to$ `investigating` $\to$ `resolved` $\to$ `closed`.
   - Prevent unauthorized status skipping or unauthorized resolution.

3. **Forensic Evidence & Notes:**
   - Secure evidence upload with magic byte inspection, size limits, and sanitization.
   - Immutable timestamped investigation notes authored by verified security personnel.

4. **Forensic Audit Trail:**
   - Every security event (login, failed auth, user creation, role modification, status transition, assignment) generates an immutable, IP-attributed audit record.

5. **Multi-Database Support:**
   - **SQLite:** Zero-friction, standalone local development & instant evaluation (automatically seeded).
   - **PostgreSQL:** Production-grade high-throughput relational persistence.

---

## Quick Start (1-Click Run)

### Method 1: Double-click Launcher
Simply double-click **`start.bat`** (or execute `./start.ps1` in PowerShell). This will:
1. Start the Flask Backend on `http://127.0.0.1:5000`
2. Start the Frontend Static Server on `http://127.0.0.1:5500`
3. Automatically launch your default browser to `http://127.0.0.1:5500/index.html`

### Method 2: Manual Terminal Execution

**Terminal 1 — Backend:**
```powershell
cd "c:\Secure Desk\SECUREDESK_PROJECT\securedesk"
.\venv\Scripts\python.exe run.py
```

**Terminal 2 — Frontend:**
```powershell
cd "c:\Secure Desk\SECUREDESK_PROJECT"
.\securedesk\venv\Scripts\python.exe -m http.server 5500 --directory securedesk-frontend
```

Then open your browser to **`http://127.0.0.1:5500/index.html`**.

---

## Pre-Configured Demo Accounts

The database comes pre-seeded with three active accounts and realistic cybersecurity incidents:

| Role | Email | Password | Access Highlights |
|---|---|---|---|
| **Admin** | `admin@securedesk.local` | `AdminPassword123!` | Incident assignment, User management, Audit logs, Close incidents |
| **Investigator** | `investigator@securedesk.local` | `Investigator123!` | Add investigation notes, upload evidence, change status to `investigating` / `resolved` |
| **Employee** | `employee@securedesk.local` | `EmployeePassword123!` | Report new incidents, view self-reported incidents, update profile |

---

## Running the Automated Test Suite

The backend contains 124 unit, integration, and security hardening tests.

To run the complete test suite:
```powershell
cd "c:\Secure Desk\SECUREDESK_PROJECT\securedesk"
.\venv\Scripts\python.exe -m pytest
```

Expected result:
```
======================= 124 passed in ~75s =======================
```

---

## API Summary

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new employee account |
| `POST` | `/api/auth/login` | Public | Authenticate and obtain JWT token |
| `GET` | `/api/auth/verify-email` | Public | Confirm email verification token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |
| `PUT` | `/api/auth/me` | Authenticated | Update user display name |
| `PUT` | `/api/auth/change-password` | Authenticated | Change user password |
| `POST` | `/api/auth/logout` | Authenticated | Revoke JWT session |
| `GET` | `/api/incidents` | Authenticated | List incidents (scoped by role) |
| `POST` | `/api/incidents` | Authenticated | Report a new security incident |
| `GET` | `/api/incidents/<id>` | Authenticated | Get detailed incident report |
| `PUT` | `/api/incidents/<id>` | Reporter/Admin | Update title/description (if reported) |
| `POST` | `/api/incidents/<id>/assign` | Admin | Assign incident to an investigator |
| `PUT` | `/api/incidents/<id>/status` | Role-Restricted | Progress incident lifecycle status |
| `GET` | `/api/incidents/<id>/notes` | Admin/Investigator| List forensics investigation notes |
| `POST` | `/api/incidents/<id>/notes` | Admin/Investigator| Add investigation note |
| `POST` | `/api/incidents/<id>/files` | Authenticated | Upload evidence attachment |
| `GET` | `/api/incidents/<id>/files` | Authenticated | List incident attachments |
| `GET` | `/api/incidents/<id>/files/<id>/download` | Authenticated | Download evidence attachment |
| `GET` | `/api/users` | Admin | List system users with filters |
| `POST` | `/api/users` | Admin | Create user with assigned role |
| `PUT` | `/api/users/<id>/role` | Admin | Update user role |
| `PUT` | `/api/users/<id>/deactivate` | Admin | Deactivate user account |
| `PUT` | `/api/users/<id>/activate` | Admin | Re-activate user account |
| `GET` | `/api/audit-logs` | Admin | Query system-wide forensic audit logs |
| `GET` | `/api/health` | Public | Health check (DB and API status) |
