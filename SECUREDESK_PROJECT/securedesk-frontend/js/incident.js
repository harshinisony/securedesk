
/**
 * incident.js — logic for incident.html.
 * Reads the incident id from ?id=<n> in the URL.
 */

Auth.requireLogin();
initSidebar();

const currentUser = Auth.getUser();
const incidentId = new URLSearchParams(window.location.search).get("id");

if (!incidentId) {
  window.location.href = "dashboard.html";
}

const ALL_STATUSES = [
  "reported", "under_review", "assigned", "investigating", "resolved", "closed", "rejected",
];
const ALL_SEVERITIES = ["low", "medium", "high", "critical"];

const ALLOWED_TRANSITIONS = {
  admin: {
    reported: ["under_review", "rejected"],
    under_review: ["rejected"],
    assigned: ["under_review"],
    investigating: ["assigned"],
    resolved: ["closed", "investigating"],
  },
  investigator: {
    assigned: ["investigating"],
    investigating: ["resolved"],
  },
};

let incident = null;

async function loadIncident() {
  try {
    incident = await Api.get(`/api/incidents/${incidentId}`);
    render();
  } catch (err) {
    document.getElementById("loading-state").classList.add("hidden");
    const alertEl = document.getElementById("error-alert");
    alertEl.textContent = err.status === 404
      ? "This incident doesn't exist, or you don't have access to it."
      : err.message;
    alertEl.classList.remove("hidden");
  }
}

function render() {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("content").classList.remove("hidden");

  document.getElementById("inc-title").textContent = incident.title;
  document.getElementById("inc-status-badge").innerHTML = statusBadge(incident.status);
  document.getElementById("inc-severity-badge").innerHTML = severityBadge(incident.severity);
  document.getElementById("inc-category-badge").textContent = categoryLabel(incident.category);
  document.getElementById("inc-description").textContent = incident.description;
  document.getElementById("inc-reported-at").textContent = formatDate(incident.reported_at);
  document.getElementById("inc-updated-at").textContent = formatDate(incident.updated_at);
  if (incident.reporter_name) {
    document.getElementById("inc-reporter").textContent = `${incident.reporter_name} (${incident.reporter_email})`;
  } else {
    document.getElementById("inc-reporter").textContent = "Loading…";
    resolveUserLabel(incident.reporter_id).then((label) => {
      document.getElementById("inc-reporter").textContent = label;
    });
  }

  if (incident.assigned_to_name) {
    document.getElementById("inc-assigned-to").textContent = `${incident.assigned_to_name} (${incident.assigned_to_email})`;
  } else if (incident.assigned_to_id) {
    document.getElementById("inc-assigned-to").textContent = "Loading…";
    resolveUserLabel(incident.assigned_to_id).then((label) => {
      document.getElementById("inc-assigned-to").textContent = label;
    });
  } else {
    document.getElementById("inc-assigned-to").textContent = "Unassigned";
  }

  if (incident.resolution_notes) {
    document.getElementById("resolution-block").classList.remove("hidden");
    document.getElementById("inc-resolution-notes").textContent = incident.resolution_notes;
  }

  const isReporter = currentUser.id === incident.reporter_id;
  const isAdmin = currentUser.role === "admin";
  const isAssignedInvestigator = currentUser.role === "investigator" && currentUser.id === incident.assigned_to_id;

  // ---- Edit card (reporter, only while still "reported") ----
  if (isReporter && incident.status === "reported") {
    document.getElementById("edit-card").classList.remove("hidden");
    document.getElementById("edit-title").value = incident.title;
    document.getElementById("edit-description").value = incident.description;
  }

  // ---- Admin manage card ----
  if (isAdmin) {
    document.getElementById("admin-manage-card").classList.remove("hidden");
    const sevSelect = document.getElementById("severity-select");
    sevSelect.innerHTML = `<option value="">Unset</option>` +
      ALL_SEVERITIES.map((s) => `<option value="${s}" ${incident.severity === s ? "selected" : ""}>${s}</option>`).join("");
    loadInvestigators();
  }

  // ---- Status change card (admin, or the assigned investigator) ----
  const roleKey = isAdmin ? "admin" : (isAssignedInvestigator ? "investigator" : null);
  const allowedNextStatuses = (roleKey && ALLOWED_TRANSITIONS[roleKey]?.[incident.status]) || [];

  if (allowedNextStatuses.length > 0) {
    document.getElementById("status-card").classList.remove("hidden");
    const statusSelect = document.getElementById("status-select");
    statusSelect.innerHTML = allowedNextStatuses
      .map((s) => `<option value="${s}">${STATUS_LABELS[s] || s}</option>`)
      .join("");
    toggleResolutionField();
  } else {
    document.getElementById("status-card").classList.add("hidden");
  }

  // ---- Notes (admin/investigator only) ----
  if (isAdmin || currentUser.role === "investigator") {
    document.getElementById("notes-card").classList.remove("hidden");
    loadNotes();
  }

  loadFiles();
  loadReporterHistory(incident.reporter_id, incident.id);
}

// ---------- Previous Incidents from Same Reporter ----------
async function loadReporterHistory(reporterId, currentIncId) {
  const tbody = document.getElementById("reporter-history-tbody");
  const countEl = document.getElementById("reporter-cases-count");
  if (!tbody) return;

  try {
    let url = `/api/incidents?limit=50`;
    if (currentUser?.role === "admin" && reporterId) {
      url += `&reporter_id=${reporterId}`;
    }
    const data = await Api.get(url);
    const all = data?.incidents || data?.items || (Array.isArray(data) ? data : []);

    // Filter to cases reported by this same reporter
    const reporterIncidents = all.filter(inc => !reporterId || String(inc.reporter_id) === String(reporterId));

    if (countEl) {
      countEl.textContent = `${reporterIncidents.length} Logged Case${reporterIncidents.length === 1 ? "" : "s"}`;
    }

    if (reporterIncidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.25rem;color:var(--text-muted);">No other incidents found for this reporter.</td></tr>`;
      return;
    }

    tbody.innerHTML = reporterIncidents.map(inc => {
      const isCurrent = inc.id === currentIncId || String(inc.id) === String(currentIncId);
      const rowStyle = isCurrent ? "background: #f0fdf4; font-weight: 700;" : "cursor: pointer;";
      const currentBadge = isCurrent ? ` <span class="badge badge-low" style="font-size:0.65rem;padding:1px 5px;margin-left:4px;">Current</span>` : "";
      const clickHandler = isCurrent ? "" : `onclick="window.location.href='incident.html?id=${inc.id}'"`;

      return `
        <tr ${clickHandler} style="${rowStyle}">
          <td style="padding-left:0.75rem;">
            <span class="mono" style="color:var(--lux-green);font-weight:700;">#INC-${String(inc.id).padStart(4, "0")}</span>${currentBadge}
          </td>
          <td>
            <div style="color:var(--text-main);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(inc.title)}">${escapeHtml(inc.title)}</div>
          </td>
          <td><span class="badge-category" style="font-size:0.72rem;">${escapeHtml(categoryLabel(inc.category))}</span></td>
          <td>${statusBadge(inc.status)}</td>
          <td class="mono nowrap" style="color:var(--text-muted);font-size:0.78rem;padding-right:0.75rem;">${formatDate(inc.reported_at || inc.created_at)}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted);">Could not load reporter history.</td></tr>`;
    }
  }
}

// ---------- Edit (reporter) ----------
document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorAlert = document.getElementById("edit-error-alert");
  errorAlert.classList.add("hidden");
  try {
    await Api.put(`/api/incidents/${incidentId}`, {
      title: document.getElementById("edit-title").value.trim(),
      description: document.getElementById("edit-description").value.trim(),
    });
    loadIncident();
  } catch (err) {
    errorAlert.textContent = err.message;
    errorAlert.classList.remove("hidden");
  }
});

// ---------- Admin: severity ----------
document.getElementById("save-severity-btn").addEventListener("click", async () => {
  const errorAlert = document.getElementById("manage-error-alert");
  errorAlert.classList.add("hidden");
  const value = document.getElementById("severity-select").value;
  try {
    await Api.put(`/api/incidents/${incidentId}`, { severity: value || null });
    loadIncident();
  } catch (err) {
    errorAlert.textContent = err.message;
    errorAlert.classList.remove("hidden");
  }
});

// ---------- Admin: assignment ----------
async function loadInvestigators() {
  const select = document.getElementById("assignee-select");
  try {
    const data = await Api.get("/api/users?role=investigator&is_active=true&limit=100");
    const investigators = data.users || data; // tolerate either shape
    select.innerHTML = investigators.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join("");
    if (incident.assigned_to_id) select.value = incident.assigned_to_id;
  } catch {
    select.innerHTML = `<option value="">Couldn't load investigators</option>`;
  }
}

document.getElementById("assign-btn").addEventListener("click", async () => {
  const errorAlert = document.getElementById("manage-error-alert");
  errorAlert.classList.add("hidden");
  const value = document.getElementById("assignee-select").value;
  if (!value) return;
  try {
    await Api.post(`/api/incidents/${incidentId}/assign`, { assigned_to_id: parseInt(value, 10) });
    loadIncident();
  } catch (err) {
    errorAlert.textContent = err.message;
    errorAlert.classList.remove("hidden");
  }
});

// ---------- Status change ----------
document.getElementById("status-select").addEventListener("change", toggleResolutionField);
function toggleResolutionField() {
  const value = document.getElementById("status-select").value;
  document.getElementById("resolution-notes-field").classList.toggle("hidden", value !== "resolved");
}

document.getElementById("status-btn").addEventListener("click", async () => {
  const errorAlert = document.getElementById("status-error-alert");
  errorAlert.classList.add("hidden");
  const status = document.getElementById("status-select").value;
  const body = { status };
  if (status === "resolved") {
    const notes = document.getElementById("resolution-notes-input").value.trim();
    if (!notes) {
      errorAlert.textContent = "Please provide resolution notes before marking this incident as resolved.";
      errorAlert.classList.remove("hidden");
      return;
    }
    body.resolution_notes = notes;
  }
  try {
    await Api.put(`/api/incidents/${incidentId}/status`, body);
    loadIncident();
  } catch (err) {
    errorAlert.textContent = err.message;
    errorAlert.classList.remove("hidden");
  }
});

// ---------- Notes ----------
async function loadNotes() {
  const listEl = document.getElementById("notes-list");
  try {
    const notes = await Api.get(`/api/incidents/${incidentId}/notes`);
    if (!notes.length) {
      listEl.innerHTML = `<p style="margin:0;">No notes yet.</p>`;
      return;
    }
    listEl.innerHTML = notes.map((n) => {
      const authorLabel = n.author_name ? `${escapeHtml(n.author_name)} (${escapeHtml(n.author_email)})` : `Loading…`;
      return `
      <div class="note-item">
        <div class="note-meta" data-author-id="${n.author_id}">${authorLabel} &middot; ${formatDate(n.created_at)}</div>
        <div>${escapeHtml(n.content)}</div>
      </div>`;
    }).join("");

    // Resolve author names after the initial render only if not already provided
    listEl.querySelectorAll("[data-author-id]").forEach(async (el) => {
      if (el.textContent.startsWith("Loading…")) {
        const label = await resolveUserLabel(el.dataset.authorId);
        el.textContent = el.textContent.replace("Loading…", label);
      }
    });
  } catch (err) {
    listEl.innerHTML = `<p style="margin:0;">Couldn't load notes: ${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById("note-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("note-content");
  try {
    await Api.post(`/api/incidents/${incidentId}/notes`, { content: input.value.trim() });
    input.value = "";
    loadNotes();
  } catch (err) {
    alert(err.message); // small/rare failure path; a simple alert is fine here
  }
});

// ---------- Evidence Files & Lightbox ----------
// ---------- Evidence Files & Lightbox ----------
const fileInput = document.getElementById("file-input");
const imagePreview = document.getElementById("imagePreview");
const previewImage = document.getElementById("previewImage");
const previewVideo = document.getElementById("previewVideo");
const uploadPreviewTitle = document.getElementById("upload-preview-title");
const clearUploadImgBtn = document.getElementById("clear-upload-img-btn");

const lightboxDialog = document.getElementById("image-lightbox-dialog");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");
const lightboxFilename = document.getElementById("lightbox-filename");
const lightboxSubtitle = document.getElementById("lightbox-subtitle");
const lightboxMediaIcon = document.getElementById("lightbox-media-icon");
const lightboxDownloadBtn = document.getElementById("lightbox-download-btn");
const lightboxCloseBtn = document.getElementById("lightbox-close-btn");

const blobUrlCache = new Map();

function isImageFile(f) {
  if (!f) return false;
  if (f.content_type && f.content_type.startsWith("image/")) return true;
  const name = (f.original_filename || f.name || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(name);
}

function isVideoFile(f) {
  if (!f) return false;
  if (f.content_type && f.content_type.startsWith("video/")) return true;
  const name = (f.original_filename || f.name || "").toLowerCase();
  return /\.(mp4|webm|mov|mkv|avi)$/i.test(name);
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1048576) {
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

async function getFileBlobUrl(fileId, declaredType) {
  if (blobUrlCache.has(fileId)) {
    return blobUrlCache.get(fileId);
  }
  const response = await fetch(`${API_BASE_URL}/api/incidents/${incidentId}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${Auth.getToken()}` },
  });
  if (!response.ok) throw new Error("Could not retrieve file data.");
  let blob = await response.blob();
  if (declaredType && (!blob.type || blob.type === "application/octet-stream")) {
    blob = new Blob([blob], { type: declaredType });
  }
  const url = URL.createObjectURL(blob);
  blobUrlCache.set(fileId, url);
  return url;
}

async function loadFiles() {
  const listEl = document.getElementById("files-list");
  if (!listEl) return;

  try {
    const files = await Api.get(`/api/incidents/${incidentId}/files`);
    if (!files || !files.length) {
      listEl.innerHTML = `
        <div style="padding:1.5rem 1rem;text-align:center;color:var(--text-muted);background:var(--bg-surface-subtle);border-radius:var(--radius-md);border:1px dashed var(--border);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom:0.4rem;color:var(--text-faint);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div style="font-size:0.84rem;font-weight:600;">No Evidence Artifacts Uploaded Yet</div>
          <div style="font-size:0.76rem;color:var(--text-dim);margin-top:2px;">Attach videos, photos, or forensic logs below to document this security ticket.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="evidence-files-grid">
        ${files.map((f) => {
          const isImg = isImageFile(f);
          const isVid = isVideoFile(f);
          const ext = (f.original_filename.split(".").pop() || "FILE").toUpperCase();
          const sizeLabel = formatFileSize(f.file_size_bytes);

          if (isVid) {
            return `
              <div class="evidence-file-card evidence-video-card" id="file-card-${f.id}">
                <div class="evidence-video-wrap" id="video-wrap-${f.id}">
                  <div class="evidence-thumb-skeleton" id="thumb-skel-${f.id}" style="width:100%;height:100%;background:#0f172a;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.72rem;">
                    <span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span> Loading Video…
                  </div>
                  <video class="evidence-card-video hidden" id="video-player-${f.id}" controls preload="metadata" playsinline></video>
                </div>
                <div class="evidence-file-meta">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <span class="evidence-filename" title="${escapeHtml(f.original_filename)}">${escapeHtml(f.original_filename)}</span>
                    <span class="badge badge-sky" style="font-size:0.68rem;padding:1px 6px;">${ext}</span>
                  </div>
                  <span class="evidence-filesize mono">${sizeLabel} &bull; Forensic Video</span>
                </div>
                <div class="evidence-card-actions">
                  <button type="button" class="btn-sm btn-view-media" data-file-id="${f.id}" data-filename="${escapeHtml(f.original_filename)}" data-is-video="true" data-mime="${escapeHtml(f.content_type || 'video/mp4')}" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;font-size:0.76rem;height:30px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Fullscreen Theater</span>
                  </button>
                  <button type="button" class="btn-sm download-btn" data-id="${f.id}" data-name="${escapeHtml(f.original_filename)}" title="Download Video Artifact" style="padding:0 8px;height:30px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              </div>
            `;
          }

          if (isImg) {
            return `
              <div class="evidence-file-card" id="file-card-${f.id}">
                <div class="evidence-thumb-wrap btn-view-media" data-file-id="${f.id}" data-filename="${escapeHtml(f.original_filename)}" data-is-video="false" data-mime="${escapeHtml(f.content_type || 'image/png')}" title="Click to view high-resolution photo">
                  <div class="evidence-thumb-skeleton" id="thumb-skel-${f.id}" style="width:100%;height:100%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.72rem;">
                    <span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span> Loading…
                  </div>
                  <img class="hidden" id="thumb-img-${f.id}" alt="${escapeHtml(f.original_filename)}" />
                  <div class="evidence-thumb-overlay">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>View Image</span>
                  </div>
                </div>
                <div class="evidence-file-meta">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <span class="evidence-filename" title="${escapeHtml(f.original_filename)}">${escapeHtml(f.original_filename)}</span>
                    <span class="badge badge-neutral" style="font-size:0.68rem;padding:1px 6px;">${ext}</span>
                  </div>
                  <span class="evidence-filesize mono">${sizeLabel} &bull; Photo Artifact</span>
                </div>
                <div class="evidence-card-actions">
                  <button type="button" class="btn-sm btn-view-media" data-file-id="${f.id}" data-filename="${escapeHtml(f.original_filename)}" data-is-video="false" data-mime="${escapeHtml(f.content_type || 'image/png')}" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;font-size:0.76rem;height:30px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>View Image</span>
                  </button>
                  <button type="button" class="btn-sm download-btn" data-id="${f.id}" data-name="${escapeHtml(f.original_filename)}" title="Download Photo" style="padding:0 8px;height:30px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              </div>
            `;
          }

          return `
            <div class="evidence-file-card" id="file-card-${f.id}">
              <div style="height:140px;background:#f8fafc;border-radius:6px;border:1px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:0.65rem;">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--sky-blue);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span class="mono" style="font-size:0.7rem;font-weight:700;color:var(--text-muted);margin-top:6px;">.${ext}</span>
              </div>
              <div class="evidence-file-meta">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                  <span class="evidence-filename" title="${escapeHtml(f.original_filename)}">${escapeHtml(f.original_filename)}</span>
                  <span class="badge badge-neutral" style="font-size:0.68rem;padding:1px 6px;">${ext}</span>
                </div>
                <span class="evidence-filesize mono">${sizeLabel} &bull; Data Artifact</span>
              </div>
              <div class="evidence-card-actions">
                <button type="button" class="btn-sm download-btn" data-id="${f.id}" data-name="${escapeHtml(f.original_filename)}" style="width:100%;height:30px;display:inline-flex;align-items:center;justify-content:center;gap:4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Download File</span>
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    // Asynchronously stream blob URLs for thumbnails & video cards
    files.forEach((f) => {
      if (isImageFile(f)) {
        getFileBlobUrl(f.id, f.content_type)
          .then((url) => {
            const imgEl = document.getElementById(`thumb-img-${f.id}`);
            const skelEl = document.getElementById(`thumb-skel-${f.id}`);
            if (imgEl) {
              imgEl.src = url;
              imgEl.classList.remove("hidden");
            }
            if (skelEl) skelEl.remove();
          })
          .catch(() => {
            const skelEl = document.getElementById(`thumb-skel-${f.id}`);
            if (skelEl) skelEl.textContent = "Photo Artifact";
          });
      } else if (isVideoFile(f)) {
        getFileBlobUrl(f.id, f.content_type)
          .then((url) => {
            const vidEl = document.getElementById(`video-player-${f.id}`);
            const skelEl = document.getElementById(`thumb-skel-${f.id}`);
            if (vidEl) {
              vidEl.src = url;
              vidEl.classList.remove("hidden");
            }
            if (skelEl) skelEl.remove();
          })
          .catch(() => {
            const skelEl = document.getElementById(`thumb-skel-${f.id}`);
            if (skelEl) skelEl.textContent = "Video Artifact";
          });
      }
    });

    // Wire up Lightbox View triggers for both photos and videos
    listEl.querySelectorAll(".btn-view-media").forEach((el) => {
      el.addEventListener("click", () => {
        const fId = el.dataset.fileId;
        const fName = el.dataset.filename;
        const isVid = el.dataset.isVideo === "true";
        const mime = el.dataset.mime || "";
        if (fId) openMediaLightbox(fId, fName, isVid, mime);
      });
    });

    // Wire up Download buttons
    listEl.querySelectorAll(".download-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        downloadFile(btn.dataset.id, btn.dataset.name);
      });
    });
  } catch (err) {
    listEl.innerHTML = `<p style="margin:0;color:var(--danger);">Couldn't load files: ${escapeHtml(err.message)}</p>`;
  }
}

// ---------- Media Lightbox Modal Handling (Photo & Video) ----------
async function openMediaLightbox(fileId, filename, isVideo, mimeType) {
  if (!lightboxDialog) return;
  if (lightboxFilename) lightboxFilename.textContent = filename || "Evidence Media Artifact";
  
  if (lightboxDownloadBtn) {
    lightboxDownloadBtn.onclick = () => downloadFile(fileId, filename);
  }

  // Reset display states
  if (lightboxImg) {
    lightboxImg.src = "";
    lightboxImg.style.display = "none";
  }
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.src = "";
    lightboxVideo.style.display = "none";
  }

  if (isVideo) {
    if (lightboxSubtitle) lightboxSubtitle.textContent = "Forensic Video Inspection & Playback";
    if (lightboxMediaIcon) {
      lightboxMediaIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    }
  } else {
    if (lightboxSubtitle) lightboxSubtitle.textContent = "High-Resolution Forensic Photo Inspection";
    if (lightboxMediaIcon) {
      lightboxMediaIcon.innerHTML = `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`;
    }
  }

  lightboxDialog.showModal();

  try {
    const url = await getFileBlobUrl(fileId, mimeType);
    if (isVideo && lightboxVideo) {
      lightboxVideo.src = url;
      lightboxVideo.style.display = "block";
      lightboxVideo.play().catch(() => {});
    } else if (lightboxImg) {
      lightboxImg.src = url;
      lightboxImg.style.display = "block";
    }
  } catch (err) {
    alert("Could not load media preview: " + err.message);
    closeLightbox();
  }
}

function closeLightbox() {
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.src = "";
    lightboxVideo.style.display = "none";
  }
  if (lightboxImg) {
    lightboxImg.src = "";
    lightboxImg.style.display = "none";
  }
  lightboxDialog?.close();
}

lightboxCloseBtn?.addEventListener("click", closeLightbox);

lightboxDialog?.addEventListener("click", (e) => {
  if (e.target === lightboxDialog) {
    closeLightbox();
  }
});

// ---------- Media Preview on File Selection (Photo & Video) ----------
let previewUrl = null;

function clearUploadPreview() {
  if (fileInput) fileInput.value = "";
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.src = "";
    previewVideo.style.display = "none";
  }
  if (previewImage) {
    previewImage.src = "";
    previewImage.style.display = "none";
  }
  if (imagePreview) imagePreview.style.display = "none";
}

fileInput?.addEventListener("change", function () {
  const file = this.files?.[0];
  clearUploadPreview();

  if (file && isImageFile(file)) {
    previewUrl = URL.createObjectURL(file);
    if (previewImage) {
      previewImage.src = previewUrl;
      previewImage.style.display = "block";
    }
    if (uploadPreviewTitle) uploadPreviewTitle.textContent = "Attached Photo Preview:";
    if (imagePreview) imagePreview.style.display = "block";
  } else if (file && isVideoFile(file)) {
    previewUrl = URL.createObjectURL(file);
    if (previewVideo) {
      previewVideo.src = previewUrl;
      previewVideo.style.display = "block";
    }
    if (uploadPreviewTitle) uploadPreviewTitle.textContent = "Attached Video Preview (Forensic Media):";
    if (imagePreview) imagePreview.style.display = "block";
  }
});

clearUploadImgBtn?.addEventListener("click", clearUploadPreview);

async function downloadFile(fileId, filename) {
  try {
    const url = await getFileBlobUrl(fileId);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "evidence-file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert(err.message || "Failed to download file.");
  }
}

document.getElementById("upload-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorAlert = document.getElementById("upload-error-alert");
  const submitBtn = document.getElementById("upload-submit-btn");
  errorAlert?.classList.add("hidden");

  if (!fileInput || !fileInput.files.length) return;

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading…";
  }

  try {
    await Api.upload(`/api/incidents/${incidentId}/files`, formData);
    clearUploadPreview();
    loadFiles();
  } catch (err) {
    if (errorAlert) {
      errorAlert.textContent = err.message || "Failed to upload evidence file.";
      errorAlert.classList.remove("hidden");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
        <span>Upload Evidence</span>
      `;
    }
  }
});

loadIncident();

