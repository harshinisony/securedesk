Auth.requireLogin();
initSidebar();

const PAGE_SIZE = 10;
let currentPage = 1;
let currentFilters = { status: "", category: "", search: "" };

// DOM Elements
const tbody = document.getElementById("incidents-tbody");
const loadingEl = document.getElementById("loading-state");
const emptyEl = document.getElementById("empty-state");
const errorAlert = document.getElementById("error-alert");
const noticeAlert = document.getElementById("notice-alert");
const paginationEl = document.getElementById("pagination");

const filterStatus = document.getElementById("filter-status");
const filterCategory = document.getElementById("filter-category");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const topbarSearch = document.getElementById("topbar-search");

const reportDialog = document.getElementById("report-dialog");
const openReportBtn = document.getElementById("open-report-btn");
const closeDialogBtn = document.getElementById("close-dialog-btn");
const cancelDialogBtn = document.getElementById("cancel-dialog-btn");
const reportForm = document.getElementById("report-form");
const createErrorAlert = document.getElementById("create-error-alert");
const createSubmitBtn = document.getElementById("create-submit-btn");

// Metric Stat Elements
const statTotalEl = document.getElementById("stat-total");
const statCriticalEl = document.getElementById("stat-critical");
const statActiveEl = document.getElementById("stat-active");
const statResolvedEl = document.getElementById("stat-resolved");

// Trend Elements
const trendTotalEl = document.getElementById("trend-total");
const trendCriticalEl = document.getElementById("trend-critical");
const trendActiveEl = document.getElementById("trend-active");
const trendResolvedEl = document.getElementById("trend-resolved");

function timeAgo(dateString) {
  if (!dateString) return "just now";
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------- Load Incident Metrics, KPIs & Feed ----------
async function loadMetrics() {
  try {
    const user = Auth.getUser();
    const data = await Api.get("/api/incidents?page=1&limit=100");
    const items = data?.incidents || data?.items || (Array.isArray(data) ? data : []);
    const totalCount = data?.pagination?.total_items ?? items.length;

    let criticalCount = 0;
    let activeCount = 0;
    let resolvedCount = 0;

    const categoryCounts = {};
    const monthCounts = new Array(12).fill(0);

    items.forEach((inc) => {
      const sev = (inc.severity || "").toLowerCase();
      const st = (inc.status || "").toLowerCase();
      const cat = inc.category || "other";

      if (sev === "critical" || sev === "high") criticalCount++;
      if (st === "investigating" || st === "under_review" || st === "assigned" || st === "reported") activeCount++;
      if (st === "resolved" || st === "closed") resolvedCount++;

      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const dateStr = inc.reported_at || inc.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          monthCounts[d.getMonth()]++;
        }
      }
    });

    // Adapt Header and KPI labels based on role
    const pageHeading = document.getElementById("page-main-heading");
    const pageSub = document.getElementById("page-main-sub");
    const labelTotal = document.getElementById("kpi-label-total");
    const labelCritical = document.getElementById("kpi-label-critical");
    const labelActive = document.getElementById("kpi-label-active");
    const labelResolved = document.getElementById("kpi-label-resolved");

    const chartWaveTitle = document.getElementById("chart-wave-title");
    const chartDonutTitle = document.getElementById("chart-donut-title");
    const donutCenterLabel = document.getElementById("donut-center-label");
    const donutCenterPct = document.getElementById("donut-center-pct");

    const widgetActivityTitle = document.getElementById("widget-activity-title");
    const widgetPerfTitle = document.getElementById("widget-perf-title");
    const widgetPerfSub = document.getElementById("widget-perf-sub");

    const radarWidgetTitle = document.getElementById("radar-widget-title");
    const radarGaugePill = document.getElementById("radar-gauge-pill");
    const radarGaugeTitle = document.getElementById("radar-gauge-title");
    const radarGaugeSub = document.getElementById("radar-gauge-sub");

    if (user?.role === "employee") {
      if (pageHeading) pageHeading.textContent = "Incident Queue & Case Command";
      if (pageSub) pageSub.textContent = "Personal cybersecurity threat tracking, triage responses, and incident report status.";
      if (labelTotal) labelTotal.textContent = "My Reported Incidents";
      if (labelCritical) labelCritical.textContent = "Critical Priority";
      if (labelActive) labelActive.textContent = "In Active Triage";
      if (labelResolved) labelResolved.textContent = "Resolved Cases";

      if (chartWaveTitle) chartWaveTitle.textContent = "My Incident Submission Activity";
      if (chartDonutTitle) chartDonutTitle.textContent = "Threat Breakdown (My Reports)";
      if (donutCenterLabel) donutCenterLabel.textContent = "My Cases";

      if (widgetActivityTitle) widgetActivityTitle.textContent = "My Recent Incident History";
      if (widgetPerfTitle) widgetPerfTitle.textContent = "Resolution & Triage Progress";
      if (widgetPerfSub) widgetPerfSub.textContent = "Resolved vs Under Review";

      if (radarWidgetTitle) radarWidgetTitle.textContent = "Personal Cyber Hygiene & Security";
      if (radarGaugePill) radarGaugePill.textContent = "96%";
      if (radarGaugeTitle) radarGaugeTitle.textContent = "96% Defense Rating";
      if (radarGaugeSub) radarGaugeSub.textContent = "Account Verified & Protected";
    } else if (user?.role === "investigator") {
      if (pageHeading) pageHeading.textContent = "Incident Queue & Forensics Command";
      if (pageSub) pageSub.textContent = "Active security cases and forensic triage tickets assigned to you for investigation.";
      if (labelTotal) labelTotal.textContent = "My Assigned Incidents";
      if (labelCritical) labelCritical.textContent = "Urgent Priority Cases";
      if (labelActive) labelActive.textContent = "Active in Investigation";
      if (labelResolved) labelResolved.textContent = "Resolved / Closed";

      if (chartWaveTitle) chartWaveTitle.textContent = "Investigation Workload Timeline";
      if (chartDonutTitle) chartDonutTitle.textContent = "Assigned Threat Breakdown";
      if (donutCenterLabel) donutCenterLabel.textContent = "Assigned";

      if (widgetActivityTitle) widgetActivityTitle.textContent = "Recent Investigation Activity";
      if (widgetPerfTitle) widgetPerfTitle.textContent = "Remediation Velocity";
      if (widgetPerfSub) widgetPerfSub.textContent = "Closed vs In Progress";

      if (radarWidgetTitle) radarWidgetTitle.textContent = "Forensics Defense Radar";
      if (radarGaugePill) radarGaugePill.textContent = "92%";
      if (radarGaugeTitle) radarGaugeTitle.textContent = "92% SOC Efficiency";
      if (radarGaugeSub) radarGaugeSub.textContent = "Triage SLA Compliant";
    } else {
      if (pageHeading) pageHeading.textContent = "SOC Incident Queue & Telemetry";
      if (pageSub) pageSub.textContent = "Enterprise cybersecurity operations, threat detection telemetry, and incident response queue.";
      if (labelTotal) labelTotal.textContent = "Total Incidents";
      if (labelCritical) labelCritical.textContent = "Critical & High";
      if (labelActive) labelActive.textContent = "Active in Triage";
      if (labelResolved) labelResolved.textContent = "Resolved & Closed";

      if (chartWaveTitle) chartWaveTitle.textContent = "Enterprise Incident Trends & Telemetry";
      if (chartDonutTitle) chartDonutTitle.textContent = "Top Threat Vectors (Global)";
      if (donutCenterLabel) donutCenterLabel.textContent = "Live Feed";

      if (widgetActivityTitle) widgetActivityTitle.textContent = "Recent SOC Activity";
      if (widgetPerfTitle) widgetPerfTitle.textContent = "Defense Performance";
      if (widgetPerfSub) widgetPerfSub.textContent = "Resolved vs Logged";

      if (radarWidgetTitle) radarWidgetTitle.textContent = "Global Defense Radar";
      if (radarGaugePill) radarGaugePill.textContent = "88%";
      if (radarGaugeTitle) radarGaugeTitle.textContent = "88% Active Defense";
      if (radarGaugeSub) radarGaugeSub.textContent = "All SOC Sensors Protected";
    }

    // 1. Update Top KPI Cards
    if (statTotalEl) statTotalEl.textContent = totalCount;
    if (statCriticalEl) statCriticalEl.textContent = criticalCount;
    if (statActiveEl) statActiveEl.textContent = activeCount;
    if (statResolvedEl) statResolvedEl.textContent = resolvedCount;

    // 2. Update KPI Dynamic Trends
    if (trendTotalEl) trendTotalEl.textContent = `${totalCount} logged total`;
    if (trendCriticalEl) {
      const critPct = totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0;
      trendCriticalEl.textContent = `${critPct}% of cases`;
    }
    if (trendActiveEl) {
      trendActiveEl.textContent = `${activeCount} in triage`;
    }
    if (trendResolvedEl) {
      const resPct = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
      trendResolvedEl.textContent = `${resPct}% resolved`;
    }

    // 3. Update Category Breakdown & Donut Chart
    const catTotal = Math.max(1, items.length);
    const phishingCount = (categoryCounts["phishing"] || 0) + (categoryCounts["suspicious_email"] || 0);
    const malwareCount = categoryCounts["malware"] || 0;
    const accessCount = (categoryCounts["unauthorized_access"] || 0) + (categoryCounts["account_compromise"] || 0);
    const otherCount = Math.max(0, items.length - (phishingCount + malwareCount + accessCount));

    const phishingPct = Math.round((phishingCount / catTotal) * 100);
    const malwarePct = Math.round((malwareCount / catTotal) * 100);
    const accessPct = Math.round((accessCount / catTotal) * 100);
    const otherPct = Math.max(0, 100 - (phishingPct + malwarePct + accessPct));

    const pEl = document.getElementById("pct-phishing");
    const mEl = document.getElementById("pct-malware");
    const aEl = document.getElementById("pct-access");
    const oEl = document.getElementById("pct-other");

    if (pEl) pEl.textContent = `${phishingPct}% (${phishingCount})`;
    if (mEl) mEl.textContent = `${malwarePct}% (${malwareCount})`;
    if (aEl) aEl.textContent = `${accessPct}% (${accessCount})`;
    if (oEl) oEl.textContent = `${otherPct}% (${otherCount})`;

    if (donutCenterPct) donutCenterPct.textContent = `${totalCount}`;

    // Dynamic Donut SVG stroke-dasharray (perimeter = 100)
    const pathPhishing = document.getElementById("donut-path-phishing");
    const pathMalware = document.getElementById("donut-path-malware");
    const pathAccess = document.getElementById("donut-path-access");
    const pathOther = document.getElementById("donut-path-other");

    if (pathPhishing) {
      pathPhishing.setAttribute("stroke-dasharray", `${phishingPct}, 100`);
      pathPhishing.setAttribute("stroke-dashoffset", "0");
    }
    if (pathMalware) {
      pathMalware.setAttribute("stroke-dasharray", `${malwarePct}, 100`);
      pathMalware.setAttribute("stroke-dashoffset", `-${phishingPct}`);
    }
    if (pathAccess) {
      pathAccess.setAttribute("stroke-dasharray", `${accessPct}, 100`);
      pathAccess.setAttribute("stroke-dashoffset", `-${phishingPct + malwarePct}`);
    }
    if (pathOther) {
      pathOther.setAttribute("stroke-dasharray", `${otherPct}, 100`);
      pathOther.setAttribute("stroke-dashoffset", `-${phishingPct + malwarePct + accessPct}`);
    }

    // 4. Update Dynamic Wave Chart Path
    updateWaveChart(monthCounts);

    // 5. Update Recent Activity Feed (Real live audit / incident events)
    await loadRecentActivity(items);

    // 6. Update Defense Performance Bars (Monthly Distribution)
    updatePerformanceBars(monthCounts);

  } catch (err) {
    console.warn("Metrics load skipped:", err);
  }
}

// ---------- Update Dynamic Wave Chart ----------
function updateWaveChart(monthCounts) {
  const lineEl = document.getElementById("wave-chart-line");
  const areaEl = document.getElementById("wave-chart-area");
  if (!lineEl || !areaEl) return;

  const width = 700;
  const height = 170;
  const baseline = 145;
  const topPad = 25;
  const maxVal = Math.max(1, ...monthCounts);

  const points = monthCounts.map((val, idx) => {
    const x = Math.round((idx / 11) * width);
    const normalized = val / maxVal;
    const y = Math.round(baseline - normalized * (baseline - topPad));
    return { x, y };
  });

  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = Math.round((p0.x + p1.x) / 2);
    pathD += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }

  lineEl.setAttribute("d", pathD);
  areaEl.setAttribute("d", `${pathD} L ${width},${height} L 0,${height} Z`);
}

// ---------- Live Recent Activity Feed ----------
async function loadRecentActivity(items) {
  const container = document.getElementById("activity-feed-list");
  if (!container) return;

  const user = Auth.getUser();

  if (user?.role === "admin") {
    try {
      const res = await Api.get("/api/audit?page=1&limit=4");
      const logs = res?.logs || res?.audit_logs || (Array.isArray(res) ? res : []);
      if (logs.length > 0) {
        container.innerHTML = logs.map(log => {
          const action = (log.action_type || log.action || "Audit").replace(/_/g, " ").toLowerCase();
          const desc = log.description || `Incident #${log.incident_id || ""}`;
          const time = timeAgo(log.created_at || log.timestamp);
          return `
            <div class="activity-feed-item">
              <div class="activity-feed-left">
                <div class="activity-icon-sq" style="background:#ecfdf5;color:#059669;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div>
                  <div class="activity-title" style="text-transform:capitalize;">${escapeHtml(action)}</div>
                  <span style="font-size:0.72rem;color:var(--text-dim);">${escapeHtml(desc)}</span>
                </div>
              </div>
              <span class="activity-time">${time}</span>
            </div>
          `;
        }).join("");
        return;
      }
    } catch (e) {
      // Fallback to incidents
    }
  }

  // Render recent incidents
  if (items && items.length > 0) {
    const sorted = [...items].sort((a, b) => new Date(b.reported_at || 0) - new Date(a.reported_at || 0)).slice(0, 4);
    container.innerHTML = sorted.map(inc => {
      const time = timeAgo(inc.reported_at || inc.created_at);
      return `
        <div class="activity-feed-item" onclick="window.location.href='incident.html?id=${inc.id}'" style="cursor:pointer;">
          <div class="activity-feed-left">
            <div class="activity-icon-sq" style="background:#f0f9ff;color:#0284c7;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <div class="activity-title">${escapeHtml(inc.title)}</div>
              <span style="font-size:0.72rem;color:var(--text-dim);">#INC-${String(inc.id).padStart(4, "0")} &bull; ${escapeHtml(inc.status || "reported")}</span>
            </div>
          </div>
          <span class="activity-time">${time}</span>
        </div>
      `;
    }).join("");
  } else {
    container.innerHTML = `<div class="empty-state" style="padding:1rem 0;font-size:0.82rem;color:var(--text-muted);">No activity recorded yet.</div>`;
  }
}

// ---------- Update Performance Bars ----------
function updatePerformanceBars(monthCounts) {
  const container = document.getElementById("bar-chart-preview");
  if (!container) return;

  const currentMonth = new Date().getMonth();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Show last 7 months
  const indices = [];
  for (let i = 6; i >= 0; i--) {
    indices.push((currentMonth - i + 12) % 12);
  }

  const maxVal = Math.max(1, ...indices.map(idx => monthCounts[idx]));

  const groups = container.querySelectorAll(".bar-group");
  groups.forEach((group, i) => {
    if (i < indices.length) {
      const count = monthCounts[indices[i]];
      const pct = Math.max(15, Math.min(100, Math.round((count / maxVal) * 90)));
      const cols = group.querySelectorAll(".bar-col");
      if (cols[0]) cols[0].style.height = `${pct}%`;
      if (cols[1]) cols[1].style.height = `${Math.max(10, Math.round(pct * 0.65))}%`;
    }
  });
}

// ---------- Load & Render Incidents Queue ----------
async function loadIncidents(highlightId = null) {
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");
  if (tbody) tbody.innerHTML = "";
  if (errorAlert) errorAlert.classList.add("hidden");

  // Adapt titles and labels based on active role
  const user = Auth.getUser();
  const headingTitle = document.getElementById("queue-heading-title");
  const headingDesc = document.getElementById("queue-heading-desc");
  const scopeBadge = document.getElementById("queue-scope-badge");
  const tabQueueLabel = document.getElementById("tab-queue-label");

  if (user?.role === "employee") {
    if (headingTitle) headingTitle.textContent = "My Reported Incidents";
    if (headingDesc) headingDesc.textContent = "Track all previous cybersecurity incident cases you reported, along with triage status and SOC response.";
    if (scopeBadge) scopeBadge.textContent = "My Reported Cases";
    if (tabQueueLabel) tabQueueLabel.textContent = "My Reported Incidents";
  } else if (user?.role === "investigator") {
    if (headingTitle) headingTitle.textContent = "My Assigned Incidents";
    if (headingDesc) headingDesc.textContent = "Active security cases and triage tickets assigned to you for investigation.";
    if (scopeBadge) scopeBadge.textContent = "Assigned to Me";
    if (tabQueueLabel) tabQueueLabel.textContent = "Assigned Queue";
  } else {
    if (headingTitle) headingTitle.textContent = "Incident Triage Queue";
    if (headingDesc) headingDesc.textContent = "Organization-wide cybersecurity incident registry and remediation status.";
    if (scopeBadge) scopeBadge.textContent = "All Incidents (Admin)";
    if (tabQueueLabel) tabQueueLabel.textContent = "Incident Queue & Cases";
  }

  const params = new URLSearchParams({
    page: currentPage,
    limit: PAGE_SIZE,
  });
  if (currentFilters.status) params.set("status", currentFilters.status);
  if (currentFilters.category) params.set("category", currentFilters.category);

  try {
    const data = await Api.get(`/api/incidents?${params.toString()}`);
    let items = data?.incidents || data?.items || (Array.isArray(data) ? data : []);

    // Local search filter if keyword typed
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      items = items.filter(inc => 
        (inc.title && inc.title.toLowerCase().includes(q)) ||
        (inc.category && inc.category.toLowerCase().includes(q)) ||
        (inc.severity && inc.severity.toLowerCase().includes(q)) ||
        (inc.status && inc.status.toLowerCase().includes(q)) ||
        String(inc.id).includes(q)
      );
    }

    const total = data?.pagination?.total_items ?? data?.total ?? items.length;
    const totalPages = data?.pagination?.total_pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Update queue badge count
    const badgeEl = document.getElementById("queue-badge-count");
    if (badgeEl) badgeEl.textContent = total;

    if (loadingEl) loadingEl.classList.add("hidden");

    if (!items.length) {
      if (emptyEl) {
        emptyEl.textContent = user?.role === "employee" 
          ? "You haven't reported any incidents yet. Use 'Report New Incident' above to log a security issue."
          : "No security incidents match the selected filter.";
        emptyEl.classList.remove("hidden");
      }
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }

    if (tbody) {
      tbody.innerHTML = items.map((inc) => {
        const isNew = highlightId && (inc.id === highlightId || inc.id === Number(highlightId));
        const rowClass = isNew ? "row-highlight-new" : "";
        const badgeNew = isNew ? `<span class="badge badge-low" style="margin-left:6px;font-size:0.68rem;padding:2px 6px;">Just Reported</span>` : "";

        return `
          <tr onclick="window.location.href='incident.html?id=${inc.id}'" class="${rowClass}" style="cursor: pointer;">
            <td style="padding-left:1.25rem;">
              <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 0.2rem;">
                ${escapeHtml(inc.title)}${badgeNew}
              </div>
              <span class="mono" style="font-size: 0.76rem; color: var(--lux-green); font-weight: 700;">#INC-${String(inc.id).padStart(4, "0")}</span>
            </td>
            <td><span class="badge-category">${escapeHtml(categoryLabel ? categoryLabel(inc.category) : inc.category)}</span></td>
            <td>${severityBadge ? severityBadge(inc.severity) : (inc.severity || "Unset")}</td>
            <td>${statusBadge ? statusBadge(inc.status) : (inc.status || "Reported")}</td>
            <td class="mono nowrap" style="color: var(--text-muted); font-size: 0.84rem; padding-right:1.25rem;">${formatDate(inc.reported_at || inc.created_at)}</td>
          </tr>
        `;
      }).join("");
    }

    renderPagination(totalPages, total);
  } catch (err) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (errorAlert) {
      errorAlert.textContent = err.message || "Failed to load incidents.";
      errorAlert.classList.remove("hidden");
    }
  }
}


function renderPagination(totalPages, totalCount) {
  if (!paginationEl) return;
  paginationEl.innerHTML = `
    <button class="btn-sm" id="prev-page" ${currentPage <= 1 ? "disabled" : ""}>&larr; Previous</button>
    <span>Page <strong style="color:var(--text-main);">${currentPage}</strong> of ${totalPages} &middot; <span class="mono">${totalCount}</span> incident${totalCount === 1 ? "" : "s"}</span>
    <button class="btn-sm" id="next-page" ${currentPage >= totalPages ? "disabled" : ""}>Next &rarr;</button>
  `;

  document.getElementById("prev-page")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadIncidents();
    }
  });

  document.getElementById("next-page")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadIncidents();
    }
  });
}

// ---------- Filter & Live Search Listeners ----------
filterStatus?.addEventListener("change", () => {
  currentFilters.status = filterStatus.value;
  currentPage = 1;
  loadIncidents();
});

filterCategory?.addEventListener("change", () => {
  currentFilters.category = filterCategory.value;
  currentPage = 1;
  loadIncidents();
});

clearFiltersBtn?.addEventListener("click", () => {
  if (filterStatus) filterStatus.value = "";
  if (filterCategory) filterCategory.value = "";
  if (topbarSearch) topbarSearch.value = "";
  currentFilters = { status: "", category: "", search: "" };
  currentPage = 1;
  loadIncidents();
});

// Live table search on keyup/input with debounce
let searchDebounceTimer;
topbarSearch?.addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentFilters.search = e.target.value.trim();
    currentPage = 1;
    loadIncidents();
  }, 200);
});

// ---------- Modal Dialog & File Attachment Handling ----------
const reportFileInput = document.getElementById("report-file-input");
const reportImagePreview = document.getElementById("report-image-preview");
const reportPreviewImg = document.getElementById("report-preview-img");
const reportPreviewVideo = document.getElementById("report-preview-video");
const reportPreviewTitle = document.getElementById("report-preview-title");
const reportClearImgBtn = document.getElementById("report-clear-img-btn");
let reportPreviewUrl = null;

function isReportImage(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || "");
}

function isReportVideo(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name || "");
}

function resetReportMediaPreview() {
  if (reportPreviewUrl) {
    URL.revokeObjectURL(reportPreviewUrl);
    reportPreviewUrl = null;
  }
  if (reportPreviewVideo) {
    reportPreviewVideo.pause();
    reportPreviewVideo.src = "";
    reportPreviewVideo.style.display = "none";
  }
  if (reportPreviewImg) {
    reportPreviewImg.src = "";
    reportPreviewImg.style.display = "none";
  }
  if (reportImagePreview) reportImagePreview.style.display = "none";
}

reportFileInput?.addEventListener("change", function () {
  const file = this.files?.[0];
  resetReportMediaPreview();

  if (file && isReportImage(file)) {
    reportPreviewUrl = URL.createObjectURL(file);
    if (reportPreviewImg) {
      reportPreviewImg.src = reportPreviewUrl;
      reportPreviewImg.style.display = "block";
    }
    if (reportPreviewTitle) reportPreviewTitle.textContent = "Attached Photo Preview:";
    if (reportImagePreview) reportImagePreview.style.display = "block";
  } else if (file && isReportVideo(file)) {
    reportPreviewUrl = URL.createObjectURL(file);
    if (reportPreviewVideo) {
      reportPreviewVideo.src = reportPreviewUrl;
      reportPreviewVideo.style.display = "block";
    }
    if (reportPreviewTitle) reportPreviewTitle.textContent = "Attached Video Preview (Forensic Media):";
    if (reportImagePreview) reportImagePreview.style.display = "block";
  }
});

reportClearImgBtn?.addEventListener("click", () => {
  if (reportFileInput) reportFileInput.value = "";
  resetReportMediaPreview();
});

openReportBtn?.addEventListener("click", () => {
  createErrorAlert?.classList.add("hidden");
  reportForm?.reset();
  resetReportMediaPreview();
  reportDialog?.showModal();
});

function closeDialog() {
  resetReportMediaPreview();
  reportDialog?.close();
}

closeDialogBtn?.addEventListener("click", closeDialog);
cancelDialogBtn?.addEventListener("click", closeDialog);

reportForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  createErrorAlert?.classList.add("hidden");
  if (createSubmitBtn) {
    createSubmitBtn.disabled = true;
    createSubmitBtn.textContent = "Submitting…";
  }

  const payload = {
    title: document.getElementById("report-title")?.value.trim() || "",
    category: document.getElementById("report-category")?.value || "other",
    description: document.getElementById("report-description")?.value.trim() || "",
  };

  try {
    const created = await Api.post("/api/incidents", payload);

    // If an evidence file/photo was attached, upload it directly to this incident
    const attachedFile = reportFileInput?.files?.[0];
    let fileUploaded = false;
    if (attachedFile && created?.id) {
      const formData = new FormData();
      formData.append("file", attachedFile);
      try {
        await Api.upload(`/api/incidents/${created.id}/files`, formData);
        fileUploaded = true;
      } catch (uploadErr) {
        console.warn("Evidence photo upload failed:", uploadErr);
      }
    }

    closeDialog();
    reportForm.reset();

    // Automatically reveal the incident queue table with the new case and all previous incidents
    showIncidentQueue();

    if (noticeAlert) {
      noticeAlert.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--lux-green);flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <strong>Incident #${created?.id || "New"} Submitted Successfully!</strong>
            <div style="font-size:0.83rem;margin-top:2px;">
              ${fileUploaded ? "Evidence media artifact attached. " : ""}Your case is logged in the incident queue below alongside your previous reported cases.
            </div>
          </div>
        </div>
      `;
      noticeAlert.classList.remove("hidden");
      setTimeout(() => noticeAlert.classList.add("hidden"), 8000);
    }
    
    // Refresh current view & metrics with newly created id highlighted
    currentPage = 1;
    loadIncidents(created?.id);
    loadMetrics();
  } catch (err) {
    if (createErrorAlert) {
      createErrorAlert.textContent = err.message || "Failed to submit incident report.";
      createErrorAlert.classList.remove("hidden");
    }
  } finally {
    if (createSubmitBtn) {
      createSubmitBtn.disabled = false;
      createSubmitBtn.textContent = "Submit Incident Report";
    }
  }
});

// ---------- Unified Incident Queue View (Telemetry + Queue Table) ----------
function showIncidentQueue() {
  const chartsSection = document.getElementById("charts-section");
  const queueSection = document.getElementById("full-queue-section");
  if (chartsSection) chartsSection.style.display = "block";
  if (queueSection) queueSection.style.display = "block";

  document.querySelectorAll("#nav-incidents").forEach(el => el.classList.add("active"));

  // Clean any legacy hash like #overview or #incidents from the URL
  if (window.location.hash && window.history && window.history.replaceState) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

function openReportModal() {
  createErrorAlert?.classList.add("hidden");
  reportForm?.reset();
  if (reportPreviewUrl) {
    URL.revokeObjectURL(reportPreviewUrl);
    reportPreviewUrl = null;
  }
  if (reportPreviewImg) reportPreviewImg.src = "";
  if (reportImagePreview) reportImagePreview.style.display = "none";
  reportDialog?.showModal();
}

window.showIncidentQueue = showIncidentQueue;
window.openReportModal = openReportModal;
window.loadIncidents = loadIncidents;

// Register listeners on topbar navigation
document.querySelectorAll("#nav-incidents").forEach(el => {
  el.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// Initial fetch & unified view presentation
loadMetrics();
loadIncidents();
showIncidentQueue();