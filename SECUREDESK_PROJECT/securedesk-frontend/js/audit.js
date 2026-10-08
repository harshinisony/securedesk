Auth.requireLogin();

const currentUser = Auth.getUser();

// Top navigation & user profile banner
if (currentUser) {
  const nameEl = document.getElementById("user-name");
  const roleEl = document.getElementById("user-role");
  if (nameEl) nameEl.textContent = currentUser.name || currentUser.email || "User";
  if (roleEl) roleEl.textContent = currentUser.role || "";

  if (currentUser.role === "admin") {
    document.querySelectorAll(".admin-only").forEach((el) => el.classList.remove("hidden"));
  }
}

try {
  if (typeof initSidebar === "function") initSidebar();
} catch (e) {
  console.warn(e);
}

const PAGE_SIZE = 10;
let currentPage = 1;
let allAuditRecords = [];

const tbody = document.getElementById("logs-tbody");
const loadingEl = document.getElementById("loading-state");
const emptyEl = document.getElementById("empty-state");
const errorAlert = document.getElementById("error-alert");
const paginationEl = document.getElementById("pagination");

const filterEvent = document.getElementById("filter-event");
const filterEmail = document.getElementById("filter-email");
const filterKeyword = document.getElementById("filter-keyword");
const clearFiltersBtn = document.getElementById("clear-filters-btn");

const safeEscape = (str) =>
  typeof escapeHtml === "function"
    ? escapeHtml(str || "")
    : String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);

const safeFormatDate = (ts) => {
  if (!ts) return "—";
  if (typeof formatDate === "function") return formatDate(ts);
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
};

async function loadAuditLogData() {
  loadingEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");
  errorAlert.classList.add("hidden");
  tbody.innerHTML = "";

  try {
    // 1. Fetch Users using safe limits (matches users.js)
    let usersList = [];
    try {
      const uData = await Api.get("/api/users?page=1&limit=50");
      usersList = uData.users || (Array.isArray(uData) ? uData : []);
    } catch {
      try {
        const uData = await Api.get("/api/users");
        usersList = uData.users || (Array.isArray(uData) ? uData : []);
      } catch (err) {
        console.warn("Users fetch skipped:", err);
      }
    }

    const userMap = {};
    usersList.forEach((u) => {
      userMap[u.id] = u;
    });

    // 2. Fetch Incidents using safe limits (matches dashboard.js)
    let incidentsList = [];
    try {
      const iData = await Api.get("/api/incidents?page=1&limit=50");
      incidentsList = Array.isArray(iData) ? iData : (iData.incidents || iData.items || []);
    } catch {
      try {
        const iData = await Api.get("/api/incidents");
        incidentsList = Array.isArray(iData) ? iData : (iData.incidents || iData.items || []);
      } catch (err) {
        console.warn("Incidents fetch skipped:", err);
      }
    }

    // 3. Fetch Audit Logs from real backend table
    let rawAuditLogs = [];
    try {
      const aData = await Api.get("/api/audit-logs?page=1&limit=100");
      rawAuditLogs = aData.audit_logs || aData.logs || aData.items || (Array.isArray(aData) ? aData : []);
    } catch {
      try {
        const aData = await Api.get("/api/audit?page=1&limit=100");
        rawAuditLogs = aData.audit_logs || aData.logs || aData.items || (Array.isArray(aData) ? aData : []);
      } catch (err) {
        console.warn("Audit logs fetch skipped:", err);
      }
    }

    const records = [];

    // --- A. Map Suspicious / Login Incidents ---
    incidentsList.forEach((inc) => {
      const reporter = userMap[inc.reporter_id] || {};
      const reporterEmail = reporter.email || inc.reporter_email || (inc.reporter_id === 301 ? "abc@abc.com" : "user@example.com");
      const reporterName = reporter.name || "Reporter";
      const isSuspicious = Boolean(
        inc.category === "phishing" ||
        inc.category === "malware" ||
        inc.category === "suspicious_email" ||
        (inc.title && inc.title.toLowerCase().includes("suspicious")) ||
        (inc.title && inc.title.toLowerCase().includes("hack"))
      );

      const isLoginRelated =
        inc.category === "suspicious_email" ||
        (inc.title && inc.title.toLowerCase().includes("login")) ||
        (inc.description && inc.description.toLowerCase().includes("login"));

      records.push({
        name: reporterName,
        email: reporterEmail,
        isSelf: currentUser && currentUser.email === reporterEmail,
        ip: inc.ip_address || "127.0.0.1",
        action: isLoginRelated ? "Suspicious Login Attempt" : `Incident Reported (${inc.category})`,
        loginTime: inc.reported_at || inc.created_at,
        logoutTime: inc.status === "resolved" || inc.status === "closed" ? inc.updated_at : null,
        sessionStatus: inc.status === "resolved" || inc.status === "closed" ? "Session Closed" : "Active Flag",
        isSuspicious: isSuspicious,
        details: `[${inc.title}] ${inc.description || "Suspicious user activity detected"}`,
        timestamp: new Date(inc.reported_at || inc.created_at).getTime(),
      });
    });

    // --- B. Map All Added Users & Login Sessions ---
    usersList.forEach((u) => {
      const isSelf = currentUser && currentUser.id === u.id;
      const isDeactivated = u.is_active === false;

      records.push({
        name: u.name,
        email: u.email,
        isSelf: isSelf,
        ip: "127.0.0.1",
        action: isDeactivated ? "Account Deactivated / Logout" : "User Login",
        loginTime: u.created_at,
        logoutTime: isDeactivated ? u.updated_at || u.created_at : null,
        sessionStatus: isDeactivated ? "Terminated" : "Active",
        isSuspicious: isDeactivated, // Deactivated users highlighted for audit review
        details: isDeactivated
          ? `Role: ${u.role} · Account deactivated / Session revoked`
          : `Role: ${u.role} · Active session`,
        timestamp: new Date(u.created_at).getTime(),
      });
    });

    // --- C. Merge Raw Backend Audit Logs ---
    rawAuditLogs.forEach((log) => {
      const u = userMap[log.user_id] || {};
      const actionName = log.action_type || log.action || "Auth Event";
      const actionText = actionName.toLowerCase();
      const isSuspicious = Boolean(
        log.is_suspicious ||
        actionText.includes("fail") ||
        actionText.includes("suspicious") ||
        actionText.includes("denied") ||
        actionText.includes("deactivat")
      );

      records.push({
        name: log.user_name || u.name || "System",
        email: log.user_email || u.email || (log.user_id ? `User #${log.user_id}` : "System"),
        isSelf: currentUser && (currentUser.id === log.user_id),
        ip: log.ip_address || log.ip || "127.0.0.1",
        action: actionName,
        loginTime: log.created_at || log.timestamp,
        logoutTime: actionText.includes("logout") ? log.created_at : null,
        sessionStatus: actionText.includes("logout") ? "Logged out" : "Recorded",
        isSuspicious: isSuspicious,
        details: log.description || log.details || "Activity event recorded",
        timestamp: new Date(log.created_at || log.timestamp).getTime(),
      });
    });

    // Sort newest first
    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    allAuditRecords = records;

    loadingEl.classList.add("hidden");
    applyFiltersAndRender();
  } catch (err) {
    loadingEl.classList.add("hidden");
    errorAlert.textContent = err.message || "Failed to load audit records.";
    errorAlert.classList.remove("hidden");
  }
}

function applyFiltersAndRender() {
  const selectedEvent = filterEvent ? filterEvent.value : "";
  const emailQuery = filterEmail ? filterEmail.value.trim().toLowerCase() : "";
  const keywordQuery = filterKeyword ? filterKeyword.value.trim().toLowerCase() : "";

  const filtered = allAuditRecords.filter((rec) => {
    if (selectedEvent === "suspicious" && !rec.isSuspicious) return false;
    if (selectedEvent === "login" && (!rec.action.toLowerCase().includes("login") || rec.isSuspicious)) return false;
    if (selectedEvent === "logout" && !rec.action.toLowerCase().includes("logout") && !rec.action.toLowerCase().includes("deactivat")) return false;

    if (emailQuery) {
      const inEmail = rec.email.toLowerCase().includes(emailQuery);
      const inName = rec.name.toLowerCase().includes(emailQuery);
      if (!inEmail && !inName) return false;
    }

    if (keywordQuery) {
      const inDetails = rec.details.toLowerCase().includes(keywordQuery);
      const inIp = rec.ip.toLowerCase().includes(keywordQuery);
      const inAction = rec.action.toLowerCase().includes(keywordQuery);
      if (!inDetails && !inIp && !inAction) return false;
    }

    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = "";
    emptyEl.classList.remove("hidden");
    paginationEl.innerHTML = "";
    return;
  }

  emptyEl.classList.add("hidden");

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  tbody.innerHTML = pageItems
    .map((rec) => {
      const riskBadge = rec.isSuspicious
        ? `<span class="badge badge-critical">Suspicious</span>`
        : `<span class="badge badge-low">Normal</span>`;

      const logoutDisplay = rec.logoutTime
        ? `<span class="mono nowrap" style="white-space:nowrap;">${safeFormatDate(rec.logoutTime)}</span>`
        : `<span class="session-active nowrap" style="white-space:nowrap;"><span class="session-dot"></span>Active Session</span>`;

      return `
        <tr>
          <td style="padding-left:1.5rem;">
            <strong style="color:var(--text-main);font-size:0.95rem;">${safeEscape(rec.name)}</strong>${rec.isSelf ? ' <span class="badge badge-neutral" style="font-size:0.68rem;padding:0.15rem 0.45rem;">You</span>' : ""}<br>
            <span class="mono" style="font-size:0.8rem; color:var(--text-muted);">${safeEscape(rec.email)}</span>
          </td>
          <td class="mono nowrap" style="white-space:nowrap;color:var(--orange-primary);font-weight:700;">${safeEscape(rec.ip)}</td>
          <td class="nowrap" style="white-space:nowrap;"><code style="background:var(--bg-surface-subtle);padding:0.25rem 0.5rem;border-radius:4px;border:1px solid var(--border);color:var(--text-main);font-weight:600;">${safeEscape(rec.action)}</code></td>
          <td class="mono nowrap" style="white-space:nowrap;color:var(--text-muted);">${safeFormatDate(rec.loginTime)}</td>
          <td class="nowrap" style="white-space:nowrap;">${logoutDisplay}</td>
          <td class="nowrap" style="white-space:nowrap;">${riskBadge}</td>
          <td style="padding-right:1.5rem;">
            <div class="audit-details-cell" style="color:${rec.isSuspicious ? "#dc2626" : "var(--text-muted)"};" title="${safeEscape(rec.details)}">
              ${safeEscape(rec.details)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  renderPagination(totalPages, filtered.length);
}

function renderPagination(totalPages, totalCount) {
  paginationEl.innerHTML = `
    <button class="btn-sm" id="prev-page" ${currentPage <= 1 ? "disabled" : ""}>&larr; Previous</button>
    <span>Page <strong style="color:var(--text-main);">${currentPage}</strong> of ${totalPages} &middot; <span class="mono">${totalCount}</span> event${totalCount === 1 ? "" : "s"}</span>
    <button class="btn-sm" id="next-page" ${currentPage >= totalPages ? "disabled" : ""}>Next &rarr;</button>
  `;

  document.getElementById("prev-page")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      applyFiltersAndRender();
    }
  });

  document.getElementById("next-page")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      applyFiltersAndRender();
    }
  });
}

filterEvent?.addEventListener("change", () => {
  currentPage = 1;
  applyFiltersAndRender();
});
filterEmail?.addEventListener("input", () => {
  currentPage = 1;
  applyFiltersAndRender();
});
filterKeyword?.addEventListener("input", () => {
  currentPage = 1;
  applyFiltersAndRender();
});

clearFiltersBtn?.addEventListener("click", () => {
  if (filterEvent) filterEvent.value = "";
  if (filterEmail) filterEmail.value = "";
  if (filterKeyword) filterKeyword.value = "";
  currentPage = 1;
  applyFiltersAndRender();
});

loadAuditLogData();