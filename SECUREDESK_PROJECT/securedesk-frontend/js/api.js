/**
 * api.js — the only file that knows how to talk to the Flask backend.
 *
 * Every page includes this before its own page-specific script. It
 * handles: the base URL, attaching the Authorization header, parsing
 * JSON, and turning API error responses into JS Error objects that
 * page scripts can catch and display.
 */

const API_BASE_URL = "http://127.0.0.1:5000";

const Auth = {
  getToken() {
    return localStorage.getItem("securedesk_token");
  },
  getUser() {
    const raw = localStorage.getItem("securedesk_user");
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem("securedesk_token", token);
    localStorage.setItem("securedesk_user", JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem("securedesk_token");
    localStorage.removeItem("securedesk_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  /** Redirects to login if there's no token. Call at the top of every protected page. */
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = "index.html";
    }
  },
};

/**
 * Core request helper. Returns the parsed `data` field on success.
 * Throws an Error with `.status` and `.code` attached on failure, so
 * callers can branch on specific error codes (e.g. EMAIL_NOT_VERIFIED).
 */
async function apiRequest(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData && body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error(
      "Can't reach the server. Is the Flask API running on http://127.0.0.1:5000?"
    );
    err.status = 0;
    err.code = "NETWORK_ERROR";
    throw err;
  }

  // Session revoked/expired/logged-out elsewhere -- bounce to login.
  if (response.status === 401 && token) {
    Auth.clearSession();
    window.location.href = "index.html?expired=1";
    return null;
  }

  let json;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.message || `Request failed (${response.status}).`;
    const err = new Error(message);
    err.status = response.status;
    err.code = json?.error || null;
    err.details = json?.details || null;
    throw err;
  }

  return json?.data;
}

const Api = {
  get: (path) => apiRequest(path, { method: "GET" }),
  post: (path, body) => apiRequest(path, { method: "POST", body }),
  put: (path, body) => apiRequest(path, { method: "PUT", body }),
  del: (path) => apiRequest(path, { method: "DELETE" }),
  upload: (path, formData) => apiRequest(path, { method: "POST", body: formData, isFormData: true }),
};
