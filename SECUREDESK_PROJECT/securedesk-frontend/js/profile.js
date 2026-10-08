/**
 * profile.js — logic for profile.html.
 */

Auth.requireLogin();
initSidebar();

const user = Auth.getUser();
document.getElementById("edit-name").value = user?.name || "";
document.getElementById("profile-email").textContent = user?.email || "—";
document.getElementById("profile-role").textContent = user?.role || "—";

document.getElementById("update-name-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const successAlert = document.getElementById("name-success-alert");
  const errorAlert = document.getElementById("name-error-alert");
  successAlert.classList.add("hidden");
  errorAlert.classList.add("hidden");

  const newName = document.getElementById("edit-name").value.trim();
  const btn = document.getElementById("update-name-btn");
  btn.disabled = true;

  try {
    const data = await Api.put("/api/auth/me", { name: newName });
    // Keep the locally-cached user in sync so the sidebar/other pages
    // reflect the new name immediately, without requiring re-login.
    const updatedUser = { ...user, name: data.name };
    localStorage.setItem("securedesk_user", JSON.stringify(updatedUser));
    document.getElementById("user-name").textContent = data.name;
    successAlert.textContent = "Name updated.";
    successAlert.classList.remove("hidden");
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

document.getElementById("change-password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const successAlert = document.getElementById("success-alert");
  const errorAlert = document.getElementById("error-alert");
  successAlert.classList.add("hidden");
  errorAlert.classList.add("hidden");

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (newPassword !== confirmPassword) {
    errorAlert.textContent = "New password and confirmation don't match.";
    errorAlert.classList.remove("hidden");
    return;
  }

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Updating…";

  try {
    await Api.put("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    successAlert.textContent = "Password updated. You'll stay signed in on this device.";
    successAlert.classList.remove("hidden");
    document.getElementById("change-password-form").reset();
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
    btn.textContent = "Update password";
  }
});
