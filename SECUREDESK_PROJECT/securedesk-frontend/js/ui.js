/**
 * ui.js — shared modern UI helpers across SecureDesk portal (2026 design).
 * Loaded after api.js, before the page's own script.
 */

const STATUS_LABELS = {
  reported: "Reported",
  under_review: "Under Review",
  assigned: "Assigned",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
};

const STATUS_BADGE_CLASS = {
  reported: "badge-neutral",
  under_review: "badge-medium",
  assigned: "badge-high",
  investigating: "badge-high",
  resolved: "badge-low",
  closed: "badge-low",
  rejected: "badge-critical",
};

const SEVERITY_BADGE_CLASS = {
  low: "badge-low",
  medium: "badge-medium",
  high: "badge-high",
  critical: "badge-critical",
};

const CATEGORY_LABELS = {
  phishing: "Phishing",
  suspicious_email: "Suspicious Email",
  unauthorized_access: "Unauthorized Access",
  lost_device: "Lost Device",
  malware: "Malware",
  data_breach: "Data Breach",
  account_compromise: "Account Compromise",
  suspicious_activity: "Suspicious Activity",
  other: "Other Incident",
};

function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || "badge-neutral";
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge ${cls}">${label}</span>`;
}

function severityBadge(severity) {
  if (!severity) return `<span class="badge badge-neutral">Unset</span>`;
  const cls = SEVERITY_BADGE_CLASS[severity] || "badge-neutral";
  return `<span class="badge ${cls}">${severity.toUpperCase()}</span>`;
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const DEMO_CREDS = {
  admin: { email: "admin@securedesk.local", password: "AdminPassword123!" },
  investigator: { email: "investigator@securedesk.local", password: "Investigator123!" },
  employee: { email: "employee@securedesk.local", password: "EmployeePassword123!" },
};

/** Wires up topbar navigation, user avatar/name/role, logout, and demo role switcher */
function initSidebar() {
  initTopnav();
}

function initTopnav() {
  const user = Auth.getUser();

  // Name targets
  const nameEls = document.querySelectorAll("#user-name, .user-name-text");
  nameEls.forEach(el => el.textContent = user?.name || user?.email || "User");

  // Role targets
  const roleEls = document.querySelectorAll("#user-role, .user-role-text");
  roleEls.forEach(el => el.textContent = user?.role ? user.role.toUpperCase() : "MEMBER");

  // Avatar targets
  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  const avatarEls = document.querySelectorAll("#user-avatar, .user-avatar-circle, #topbar-avatar");
  avatarEls.forEach(el => el.textContent = initial);

  // Active navigation link detection
  const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".sidebar-nav a, .topnav-nav a, .topnav-link").forEach((a) => {
    const rawHref = a.getAttribute("href") || "";
    const href = rawHref.split("?")[0].split("#")[0];
    if (href === currentPath || (currentPath === "" && href === "dashboard.html") ||
        ((currentPath === "dashboard.html" || currentPath === "" || currentPath === "incident.html") && a.id === "nav-incidents")) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });

  // Show admin-only nav links if this user is an admin
  if (user?.role === "admin") {
    document.querySelectorAll(".admin-only").forEach((el) => el.classList.remove("hidden"));
  }

  // Highlight current active demo role in the switcher
  document.querySelectorAll("[data-switch-role]").forEach((btn) => {
    const role = btn.dataset.switchRole;
    if (user?.role === role) {
      btn.classList.add("active-role");
    } else {
      btn.classList.remove("active-role");
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (user?.role === role) return; // already active

      const creds = DEMO_CREDS[role];
      if (!creds) return;

      btn.disabled = true;
      btn.textContent = "…";

      try {
        const data = await Api.post("/api/auth/login", creds);
        Auth.setSession(data.access_token, data.user);
        // If switching from admin to employee while on an admin-only page, redirect to dashboard
        if (role !== "admin" && (currentPath === "users.html" || currentPath === "audit.html")) {
          window.location.href = "dashboard.html";
        } else {
          window.location.reload();
        }
      } catch (err) {
        alert("Failed to switch demo account: " + (err.message || "Unknown error"));
        btn.disabled = false;
        btn.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      }
    });
  });

  // Logout wiring
  const logoutBtns = document.querySelectorAll("#logout-btn, .btn-signout, .btn-signout-compact");
  logoutBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await Api.post("/api/auth/logout");
      } catch {
        // Clear session locally regardless
      }
      Auth.clearSession();
      window.location.href = "index.html?logout=1";
    });
  });
}

/** Resolves a user id to a display label ("Name (email)") */
const _userLabelCache = new Map();
async function resolveUserLabel(userId) {
  if (!userId) return "—";
  if (_userLabelCache.has(userId)) return _userLabelCache.get(userId);

  const currentUser = Auth.getUser();
  if (currentUser && (currentUser.id === userId || currentUser.id === Number(userId))) {
    const label = `${currentUser.name} (${currentUser.email})`;
    _userLabelCache.set(userId, label);
    return label;
  }

  const fallback = `User #${userId}`;
  try {
    const user = await Api.get(`/api/users/${userId}`);
    const label = `${user.name} (${user.email})`;
    _userLabelCache.set(userId, label);
    return label;
  } catch {
    _userLabelCache.set(userId, fallback);
    return fallback;
  }
}
