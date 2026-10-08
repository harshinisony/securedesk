/**
 * auth.js — logic for index.html (login) and register.html.
 * Both pages load api.js first, then this file.
 */

function showAlert(id, message) {
  const el = document.getElementById(id);
  if (el) {
    if (message) el.textContent = message;
    el.classList.remove("hidden");
  }
}

function hideAlert(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></span> Authenticating…`
    : label;
}

// ---------- Login page ----------
const loginForm = document.getElementById("login-form");
if (loginForm) {
  // If we just landed here after a 401 on some other page, say so.
  const params = new URLSearchParams(window.location.search);
  if (params.get("expired")) showAlert("expired-alert");
  if (params.get("switch") || params.get("logout")) {
    Auth.clearSession();
  } else if (Auth.isLoggedIn()) {
    // If already logged in, skip straight to the dashboard.
    window.location.href = "dashboard.html";
  }

  let lastEmail = "";

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("error-alert");
    hideAlert("verify-alert");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    lastEmail = email;

    const btn = document.getElementById("submit-btn");
    setLoading(btn, true, "Sign In to Dashboard");

    try {
      const data = await Api.post("/api/auth/login", { email, password });
      Auth.setSession(data.access_token, data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        showAlert("verify-alert");
      } else {
        showAlert("error-alert", err.message);
      }
    } finally {
      setLoading(btn, false, "Sign In to Dashboard");
    }
  });

  // Demo accounts 1-click instant login
  document.querySelectorAll("[data-demo-email]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      hideAlert("error-alert");
      hideAlert("verify-alert");

      const email = btn.dataset.demoEmail;
      const password = btn.dataset.demoPassword;

      const emailInput = document.getElementById("email");
      const passwordInput = document.getElementById("password");
      if (emailInput) emailInput.value = email;
      if (passwordInput) passwordInput.value = password;

      // Visual feedback on the button
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:4px;"></span> In…`;

      const submitBtn = document.getElementById("submit-btn");
      if (submitBtn) setLoading(submitBtn, true, "Authenticating…");

      try {
        const data = await Api.post("/api/auth/login", { email, password });
        Auth.setSession(data.access_token, data.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (submitBtn) setLoading(submitBtn, false, "Sign In to Dashboard");
        showAlert("error-alert", err.message || "Failed to sign in with demo credentials.");
      }
    });
  });

  document.getElementById("resend-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await Api.post("/api/auth/resend-verification", { email: lastEmail });
      if (res && res.verification_token) {
        document.getElementById("verify-alert").innerHTML = `
          Account needs verification. <a href="verify.html?token=${encodeURIComponent(res.verification_token)}" style="color:#00f2fe;font-weight:600;text-decoration:underline;">Click here to activate your account now &rarr;</a>
        `;
      } else {
        showAlert("verify-alert", "If that address needs verifying, a new link was just sent.");
      }
    } catch {
      showAlert("verify-alert", "If that address needs verifying, a new link was just sent.");
    }
  });
}

// ---------- Register page ----------
const registerForm = document.getElementById("register-form");
if (registerForm) {
  if (Auth.isLoggedIn()) window.location.href = "dashboard.html";

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("error-alert");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const btn = document.getElementById("submit-btn");
    setLoading(btn, true, "Create Account");

    try {
      const data = await Api.post("/api/auth/register", { name, email, password });
      document.getElementById("sent-to").textContent = email;

      if (data && (data.verification_token || data.verification_link)) {
        const verifyBox = document.getElementById("local-verify-box");
        const verifyBtn = document.getElementById("local-verify-btn");
        if (verifyBox && verifyBtn) {
          const token = data.verification_token || "";
          verifyBtn.href = `verify.html?token=${encodeURIComponent(token)}`;
          verifyBox.classList.remove("hidden");
        }
      }

      document.getElementById("register-form-wrap").classList.add("hidden");
      document.getElementById("success-panel").classList.remove("hidden");
    } catch (err) {
      let message = err.message;
      if (err.code === "VALIDATION_ERROR" && err.details) {
        const firstField = Object.keys(err.details)[0];
        message = err.details[firstField]?.[0] || message;
      }
      showAlert("error-alert", message);
      setLoading(btn, false, "Create Account");
    }
  });
}
