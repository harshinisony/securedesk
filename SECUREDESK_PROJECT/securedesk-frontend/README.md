# SecureDesk Frontend

Plain HTML/CSS/JavaScript, no build tools, no npm. Talks to your
Flask API (from the `securedesk` backend project) over `fetch()`.

## Setup

### 1. Point it at your backend

`js/api.js` has the backend URL at the top:
```js
const API_BASE_URL = "http://127.0.0.1:5000";
```
Leave this as-is if you're running the Flask dev server locally on the default port.

### 2. Allow this frontend through CORS

Your backend's `.env` has `CORS_ORIGINS` closed by default (Phase 8).
Add the origin you'll be serving this frontend from:
```
CORS_ORIGINS=http://127.0.0.1:5500
```
(or whatever port your static server uses). Restart `python run.py` after changing `.env`.

### 3. Serve the frontend locally

Don't just double-click `index.html` — use a simple local server so
the origin is a real `http://` URL.

**VS Code:** install the "Live Server" extension, right-click
`index.html` → "Open with Live Server" (usually serves on
`http://127.0.0.1:5500`).

**Or with Python** (terminal in this folder):
```powershell
python -m http.server 5500
```
Then open `http://127.0.0.1:5500` in your browser.

### 4. Run both servers side by side

Two terminals, two servers: backend (`python run.py`, port 5000) and
this frontend (port 5500).

### Test the full loop

1. Open the frontend URL → sign-in page.
2. "Create one" → register a new account.
3. Check the terminal running `python run.py` for a block starting
   with `VERIFICATION EMAIL` — copy the link, open it in your browser
   (lands on `verify.html`).
4. Go back and log in for real.

---

## What's built (all phases complete)

| Phase | Covers |
|---|---|
| 1 | Register, verify email, login, logout |
| 2 | Incident dashboard, create incident, full detail page |
| 3 | Admin: user management, audit log |
| 4 | Profile & change password |
| 5 | Polish: real names instead of `User #id`, no favicon 404 |
| 6 | Top navigation bar (replaced the left sidebar) |

Together with the 12-phase, 121-test backend, this is a complete,
working full-stack incident-response system.

### Phase 1 — Auth
`index.html` (login), `register.html`, `verify.html`, `js/auth.js`.
JWT stored in `localStorage` — the simplest option with no build
step, though it means the token is readable by any JS on the page.
Worth naming explicitly if asked: the more XSS-resistant alternative
is an httpOnly cookie set by the server, which would need backend
cooperation (not built here, to keep the frontend fully decoupled).

### Phase 2 — Incident Dashboard & Detail Page
`dashboard.html` / `js/dashboard.js` — list with status/category
filters, pagination, "Report incident" modal.
`incident.html` / `js/incident.js` — full detail page: everyone sees
details/files; the reporter can edit while still `reported`; admins
set severity and assign investigators; the assigned investigator gets
their own status controls; admin/investigator see investigation
notes.

The frontend never duplicates backend business rules (which status
transitions are legal, who can assign whom) — it just calls the API
and shows whatever it allows or rejects. The backend stays the single
source of truth.

**Known simplification:** reporter/assignee originally showed as
`User #<id>` since there's no public "get user by id" endpoint for
non-admins — resolved for admins in Phase 5 (see below).

### Phase 3 — Admin Pages (Users & Audit Log)
`users.html` / `js/users.js` — list/filter users by role and active
status, create a user with any role directly (closes the
first-admin-bootstrap gap backend Phase 10 addressed), inline role
change, activate/deactivate. Your own row's controls are disabled
client-side, mirroring the backend's self-lockout protection.
`audit.html` / `js/audit.js` — every audit log entry, filterable by
action type, user ID, incident ID.

Both pages check `role === "admin"` client-side for a clean UX, but
that's a nicety only — real enforcement is server-side
(`@role_required(Role.ADMIN)`), so a bypassed frontend check would
still get a `403` from the API.

### Phase 4 — Profile & Change Password
`profile.html` / `js/profile.js` — view your own name/email/role,
change your password (`PUT /api/auth/change-password`, backend
Phase 11). Changing your password does **not** revoke your current
session — matches the backend's actual behavior (only logout revokes
a token) — the page says so directly after a successful change.

### Phase 5 — Polish Pass
- **Real names instead of `User #<id>`** for reporter, assignee, and
  note authors — but only when the viewer is an **admin** (the only
  role allowed to call `GET /api/users/<id>`). Falls back silently to
  `User #<id>` for everyone else. Cached per page load
  (`resolveUserLabel` in `js/ui.js`) so a notes list with five notes
  from one author makes one lookup, not five.
- **Favicon 404 removed** — every page sets an inline SVG favicon
  instead of leaving the browser to request a `/favicon.ico` that
  never existed.

### Phase 6 — Top Navigation Bar
The left sidebar became a horizontal bar across the top of every
page — wordmark left, nav links center, name/role/sign-out right.
Pure CSS/HTML change: `.sidebar`/`.app-shell` (column layout) became
`.topnav`/`.topnav-user` (row layout) in `css/styles.css`, and every
page's `<aside class="sidebar">` became `<header class="topnav">`.
**No JavaScript changed** — `initSidebar()` in `js/ui.js` targets
elements by `id` (`user-name`, `user-role`, `logout-btn`) and by
class (`.admin-only`), none of which moved. That's the payoff of
keeping structure (HTML) and behavior (JS) decoupled from the start.

---

## Project structure

```
securedesk-frontend/
├── index.html            Login
├── register.html         Create account
├── verify.html           Email verification landing page
├── dashboard.html        Incident list
├── incident.html         Incident detail
├── users.html            Admin: user management
├── audit.html            Admin: audit log
├── profile.html          Your account + change password
├── css/styles.css        Shared design system
├── js/
│   ├── api.js             Talks to the backend, handles the token
│   ├── ui.js               Shared helpers: badges, dates, top nav wiring, name lookups
│   ├── auth.js             Login/register page logic
│   ├── dashboard.js
│   ├── incident.js
│   ├── users.js
│   ├── audit.js
│   └── profile.js
└── README.md
```
