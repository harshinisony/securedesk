/**
 * users.js — logic for users.html (2026 Modern Design). Admin-only page.
 */

Auth.requireLogin();
initSidebar();

const currentUser = Auth.getUser();
const state = { page: 1, limit: 10, role: "", isActive: "" };

if (currentUser?.role !== "admin") {
  document.getElementById("loading-state")?.classList.add("hidden");
  const errEl = document.getElementById("error-alert");
  if (errEl) {
    errEl.textContent = "Access Restricted: This section requires Administrator privileges.";
    errEl.classList.remove("hidden");
  }
} else {
  init();
}

function init() {
  document.getElementById("filter-role")?.addEventListener("change", (e) => {
    state.role = e.target.value; state.page = 1; loadUsers();
  });
  document.getElementById("filter-active")?.addEventListener("change", (e) => {
    state.isActive = e.target.value; state.page = 1; loadUsers();
  });
  document.getElementById("clear-filters-btn")?.addEventListener("click", () => {
    state.role = ""; state.isActive = ""; state.page = 1;
    if (document.getElementById("filter-role")) document.getElementById("filter-role").value = "";
    if (document.getElementById("filter-active")) document.getElementById("filter-active").value = "";
    loadUsers();
  });

  const dialog = document.getElementById("new-user-dialog");
  const form = document.getElementById("new-user-form");
  document.getElementById("new-user-btn")?.addEventListener("click", () => {
    form.reset();
    document.getElementById("create-error-alert").classList.add("hidden");
    dialog.showModal();
  });
  document.getElementById("close-dialog-btn")?.addEventListener("click", () => dialog.close());
  document.getElementById("cancel-dialog-btn")?.addEventListener("click", () => dialog.close());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorAlert = document.getElementById("create-error-alert");
    errorAlert.classList.add("hidden");
    const btn = document.getElementById("create-submit-btn");
    btn.disabled = true;

    try {
      await Api.post("/api/users", {
        name: document.getElementById("new-name").value.trim(),
        email: document.getElementById("new-email").value.trim(),
        password: document.getElementById("new-password").value,
        role: document.getElementById("new-role").value,
      });
      dialog.close();
      state.page = 1;
      loadUsers();
      loadUserMetrics();
      showNotice("New user provisioned successfully.");
    } catch (err) {
      let message = err.message;
      if (err.code === "VALIDATION_ERROR" && err.details) {
        const firstField = Object.keys(err.details)[0];
        message = err.details[firstField]?.[0] || message;
      }
      errorAlert.textContent = message;
      errorAlert.classList.remove("hidden");
    } finally {
      btn.disabled = false;
    }
  });

  loadUserMetrics();
  loadUsers();
}

async function loadUserMetrics() {
  try {
    const res = await Api.get("/api/users?page=1&limit=100");
    const users = res?.users || [];
    const total = users.length;
    if (total === 0) {
      const elTotal = document.getElementById("kpi-users-total");
      if (elTotal) elTotal.textContent = "0";
      return;
    }

    let activeCount = 0;
    let employeeCount = 0;
    let investigatorCount = 0;
    let adminCount = 0;
    let verifiedCount = 0;

    users.forEach(u => {
      if (u.is_active) activeCount++;
      if (u.is_verified) verifiedCount++;
      if (u.role === "employee") employeeCount++;
      else if (u.role === "investigator") investigatorCount++;
      else if (u.role === "admin") adminCount++;
    });

    const activePct = Math.round((activeCount / total) * 100);
    const verifiedPct = Math.round((verifiedCount / total) * 100);
    const empPct = Math.round((employeeCount / total) * 100);
    const invPct = Math.round((investigatorCount / total) * 100);
    const admPct = Math.max(0, 100 - (empPct + invPct));

    // KPI Cards
    const elTotal = document.getElementById("kpi-users-total");
    const elActive = document.getElementById("kpi-users-active");
    const elInv = document.getElementById("kpi-users-investigators");
    const elEmp = document.getElementById("kpi-users-employees");

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = activeCount;
    if (elInv) elInv.textContent = investigatorCount;
    if (elEmp) elEmp.textContent = employeeCount;

    const trActive = document.getElementById("trend-users-active");
    if (trActive) trActive.textContent = `${activePct}% enabled`;

    // Donut Chart
    const donutCenter = document.getElementById("users-donut-center-total");
    if (donutCenter) donutCenter.textContent = total;

    const pEmp = document.getElementById("pct-role-employee");
    const pInv = document.getElementById("pct-role-investigator");
    const pAdm = document.getElementById("pct-role-admin");

    if (pEmp) pEmp.textContent = `${empPct}% (${employeeCount})`;
    if (pInv) pInv.textContent = `${invPct}% (${investigatorCount})`;
    if (pAdm) pAdm.textContent = `${admPct}% (${adminCount})`;

    const pathEmp = document.getElementById("donut-users-employee");
    const pathInv = document.getElementById("donut-users-investigator");
    const pathAdm = document.getElementById("donut-users-admin");

    if (pathEmp) {
      pathEmp.setAttribute("stroke-dasharray", `${empPct}, 100`);
      pathEmp.setAttribute("stroke-dashoffset", "0");
    }
    if (pathInv) {
      pathInv.setAttribute("stroke-dasharray", `${invPct}, 100`);
      pathInv.setAttribute("stroke-dashoffset", `-${empPct}`);
    }
    if (pathAdm) {
      pathAdm.setAttribute("stroke-dasharray", `${admPct}, 100`);
      pathAdm.setAttribute("stroke-dashoffset", `-${empPct + invPct}`);
    }

    // Health ratios
    const metricActive = document.getElementById("metric-active-ratio");
    const barActive = document.getElementById("bar-active-ratio");
    if (metricActive) metricActive.textContent = `${activePct}% (${activeCount}/${total})`;
    if (barActive) barActive.style.width = `${activePct}%`;

    const metricVer = document.getElementById("metric-verified-ratio");
    const barVer = document.getElementById("bar-verified-ratio");
    if (metricVer) metricVer.textContent = `${verifiedPct}% (${verifiedCount}/${total})`;
    if (barVer) barVer.style.width = `${verifiedPct}%`;

    const healthScore = document.getElementById("account-health-score");
    if (healthScore) {
      healthScore.textContent = activePct >= 90 ? "100% Compliant" : `${activePct}% Healthy`;
    }
  } catch (err) {
    console.warn("Failed to load user metrics:", err);
  }
}

async function loadUsers() {
  const tbody = document.getElementById("users-tbody");
  const loading = document.getElementById("loading-state");
  const empty = document.getElementById("empty-state");
  const errorAlert = document.getElementById("error-alert");

  loading?.classList.remove("hidden");
  empty?.classList.add("hidden");
  errorAlert?.classList.add("hidden");
  if (tbody) tbody.innerHTML = "";

  const params = new URLSearchParams({ page: state.page, limit: state.limit });
  if (state.role) params.set("role", state.role);
  if (state.isActive) params.set("is_active", state.isActive);

  try {
    const data = await Api.get(`/api/users?${params}`);
    loading?.classList.add("hidden");

    if (data.users.length === 0) {
      empty?.classList.remove("hidden");
    } else {
      if (tbody) {
        tbody.innerHTML = data.users.map(rowHtml).join("");
        wireRowActions(data.users);
      }
    }
    renderPagination(data.pagination);
  } catch (err) {
    loading?.classList.add("hidden");
    if (errorAlert) {
      errorAlert.textContent = err.message;
      errorAlert.classList.remove("hidden");
    }
  }
}

function rowHtml(u) {
  const isSelf = u.id === currentUser.id;
  const initial = (u.name || u.email || "U").trim().charAt(0).toUpperCase();
  return `
    <tr data-id="${u.id}">
      <td style="padding-left:1.5rem;">
        <div style="display:flex;align-items:center;gap:0.85rem;">
          <div class="user-avatar-circle" style="width:34px;height:34px;font-size:0.8rem;">${initial}</div>
          <div>
            <div style="font-weight:700;color:var(--text-main);font-size:0.95rem;">${escapeHtml(u.name)}${isSelf ? ' <span class="badge badge-neutral" style="font-size:0.68rem;padding:0.15rem 0.45rem;">You</span>' : ""}</div>
          </div>
        </div>
      </td>
      <td class="mono" style="color:var(--text-muted);font-weight:500;">${escapeHtml(u.email)}</td>
      <td>
        <select class="role-select btn-sm" data-id="${u.id}" ${isSelf ? "disabled" : ""} style="padding:0.35rem 0.65rem;border-radius:var(--radius-xs);background:var(--bg-surface-subtle);font-weight:700;">
          <option value="employee" ${u.role === "employee" ? "selected" : ""}>Employee</option>
          <option value="investigator" ${u.role === "investigator" ? "selected" : ""}>Investigator</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td>${u.is_active ? '<span class="badge badge-low">Active</span>' : '<span class="badge badge-critical">Deactivated</span>'}</td>
      <td class="mono nowrap" style="color:var(--text-dim);font-size:0.82rem;">${formatDate(u.created_at)}</td>
      <td style="padding-right:1.5rem;">
        <button class="btn-sm toggle-active-btn ${u.is_active ? "btn-danger" : "btn-primary"}" data-id="${u.id}" data-active="${u.is_active}" ${isSelf ? "disabled" : ""}>
          ${u.is_active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>`;
}

function wireRowActions() {
  document.querySelectorAll(".role-select").forEach((select) => {
    select.addEventListener("change", async () => {
      const errorAlert = document.getElementById("error-alert");
      errorAlert?.classList.add("hidden");
      try {
        await Api.put(`/api/users/${select.dataset.id}/role`, { role: select.value });
        showNotice(`User permissions & role updated.`);
        loadUserMetrics();
      } catch (err) {
        if (errorAlert) {
          errorAlert.textContent = err.message;
          errorAlert.classList.remove("hidden");
        }
        loadUsers();
      }
    });
  });

  document.querySelectorAll(".toggle-active-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const errorAlert = document.getElementById("error-alert");
      errorAlert?.classList.add("hidden");
      const isCurrentlyActive = btn.dataset.active === "true";
      const action = isCurrentlyActive ? "deactivate" : "activate";
      try {
        await Api.put(`/api/users/${btn.dataset.id}/${action}`);
        showNotice(`User account ${action}d successfully.`);
        loadUsers();
        loadUserMetrics();
      } catch (err) {
        if (errorAlert) {
          errorAlert.textContent = err.message;
          errorAlert.classList.remove("hidden");
        }
      }
    });
  });
}

function showNotice(message) {
  const el = document.getElementById("notice-alert");
  if (el) {
    el.textContent = message;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3000);
  }
}

function renderPagination(p) {
  const el = document.getElementById("pagination");
  if (!el) return;
  if (!p || p.total_items === 0) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <button class="btn-sm" id="prev-page" ${p.page <= 1 ? "disabled" : ""}>&larr; Previous</button>
    <span>Page <strong style="color:var(--text-main);">${p.page}</strong> of ${p.total_pages} &middot; <span class="mono">${p.total_items}</span> user${p.total_items === 1 ? "" : "s"}</span>
    <button class="btn-sm" id="next-page" ${p.page >= p.total_pages ? "disabled" : ""}>Next &rarr;</button>
  `;
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page--; loadUsers(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page++; loadUsers(); });
}
