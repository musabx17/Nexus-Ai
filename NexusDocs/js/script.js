const API_BASE_URL = (() => {
  const host = window.location.hostname || 'localhost';
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${host}:8000/api/v1`;
})();

(() => {
  const jsonHeaders = { "Content-Type": "application/json" };
  let currentUser = null;
  let allDocuments = [];
  let activeDocumentType = "all";

  // Chat State
  let chatSessions = [];
  let currentSessionId = null;
  let activeModel = "gemini-flash-latest";
  let activeSpeechUtterance = null;

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = sessionStorage.getItem("nexus_auth_token") || localStorage.getItem("nexus_auth_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.detail || "Request failed");
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  function showToast(message, isSuccess = true) {
    const toastEl = document.getElementById("chatToast");
    if (!toastEl) return;
    const msgEl = document.getElementById("toast-message");
    if (msgEl) msgEl.textContent = message;
    toastEl.className = `toast align-items-center ${isSuccess ? "text-bg-dark" : "text-bg-danger"} border-0`;
    bootstrap.Toast.getOrCreateInstance(toastEl).show();
  }

  function showSettingsAlert(message, isSuccess = true) {
    const el = document.getElementById("settings-feedback-alert");
    if (!el) return;
    el.className = `alert ${isSuccess ? "alert-success" : "alert-danger"} mb-4`;
    el.innerHTML = `<i class="bi ${isSuccess ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2"></i> ${escapeHtml(message)}`;
    el.classList.remove("d-none");
    setTimeout(() => el.classList.add("d-none"), 5000);
  }

  function showError(message) {
    let alert = document.querySelector("#login-alert") || document.querySelector("[data-api-alert]");
    if (alert) {
      alert.classList.remove("d-none");
      alert.className = "alert alert-danger mb-3 d-flex align-items-center gap-2";
      alert.innerHTML = `<i class="bi bi-exclamation-circle-fill flex-shrink-0"></i> <div>${escapeHtml(message)}</div>`;
      return;
    }
    alert = document.createElement("div");
    alert.dataset.apiAlert = "true";
    alert.className = "alert alert-danger mt-3 d-flex align-items-center gap-2";
    alert.innerHTML = `<i class="bi bi-exclamation-circle-fill flex-shrink-0"></i> <div>${escapeHtml(message)}</div>`;
    document.querySelector("main")?.prepend(alert);
  }

  function showSuccess(message) {
    let alert = document.querySelector("[data-api-success]");
    if (!alert) {
      alert = document.createElement("div");
      alert.dataset.apiSuccess = "true";
      alert.className = "alert alert-success mt-3";
      document.querySelector("main")?.prepend(alert);
    }
    alert.textContent = message;
  }

  function redirectToLogin() {
    sessionStorage.removeItem("nexus_auth_token");
    localStorage.removeItem("nexus_auth_token");
    if (!window.location.pathname.endsWith("/index.html") && !window.location.pathname.endsWith("/")) {
      window.location.replace("index.html");
    }
  }

  function bindPasswordToggle() {
    const password = document.querySelector("#password");
    const toggle = document.querySelector(".password-toggle");
    const icon = toggle?.querySelector("i");
    if (!password || !toggle || !icon) return;
    toggle.addEventListener("click", () => {
      const isVisible = password.type === "text";
      password.type = isVisible ? "password" : "text";
      toggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
      icon.className = isVisible ? "bi bi-eye" : "bi bi-eye-slash";
    });
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileClass(contentType) {
    if (contentType.includes("pdf")) return "pdf";
    if (contentType.includes("word")) return "word";
    return "txt";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  async function bindLogin() {
    const form = document.querySelector(".login-card form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const alert = document.querySelector("#login-alert");
      if (alert) alert.classList.add("d-none");

      const emailInput = form.querySelector("#email");
      const passwordInput = form.querySelector("#password");
      const button = form.querySelector("button[type=submit]");
      
      const username = emailInput ? emailInput.value.trim().toLowerCase() : "";
      const password = passwordInput ? passwordInput.value : "";
      
      if (!username || !password) {
        showError("Please enter your email or username and password.");
        return;
      }

      button.disabled = true;
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Authenticating...';

      try {
        const res = await api("/auth/login", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            username: username,
            password: password,
          }),
        });
        if (res.token) {
          sessionStorage.setItem("nexus_auth_token", res.token);
          localStorage.setItem("nexus_auth_token", res.token);
        }
        window.location.href = res.user.role === "Admin" ? "dashboard.html" : "documents.html";
      } catch (error) {
        showError(error.status === 401 ? "Invalid email/username or password." : error.message);
        button.disabled = false;
        button.innerHTML = originalText;
      }
    });
  }

  function bindRegister() {
    const form = document.querySelector("[data-register-form]");
    const trigger = document.querySelector("[data-register-trigger]");
    if (!form || !trigger) return;
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      bootstrap.Modal.getOrCreateInstance(document.querySelector("#registerModal")).show();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await api("/auth/register", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            username: form.querySelector("#register-username").value.trim(),
            password: form.querySelector("#register-password").value,
          }),
        });
        bootstrap.Modal.getOrCreateInstance(document.querySelector("#registerModal")).hide();
        showSuccess("Account created. Sign in to open your private workspace.");
        document.querySelector("#email").value = form.querySelector("#register-username").value.trim().toLowerCase();
        form.reset();
      } catch (error) {
        showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function requireAuthentication() {
    if (!document.querySelector(".dashboard-wrapper")) return;
    try {
      const user = await api("/auth/me");
      currentUser = user;
      
      // Update User Info in Topbar and Welcome headings
      const displayName = user.display_name || user.username;
      updateGlobalUserName(displayName);
      document.querySelectorAll(".navbar-user .user-info span").forEach((roleSpan) => {
        roleSpan.textContent = user.role;
      });

      // Initialize Chat Sessions after user is verified
      if (document.querySelector(".gemini-chat-workspace")) {
        initChatSessions();
        checkAiBackendStatus();
      }
    } catch (error) {
      if (error.status === 401) redirectToLogin();
      else showError(error.message);
    }
  }

  function bindAccountNavigation() {
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      const label = link.textContent.trim().toLowerCase();
      if (label === "profile") link.href = "profile.html";
      if (label === "settings") link.href = "settings.html";
    });
  }

  async function loadProfile() {
    const form = document.querySelector("[data-profile-form]");
    if (!form) return;
    try {
      const [profile, settings] = await Promise.all([api("/auth/profile"), api("/settings")]);
      form.querySelector("#profile-username").value = profile.username;
      form.querySelector("#profile-role").value = profile.role;
      form.querySelector("#profile-display-name").value = profile.display_name;
      const permissions = document.querySelector("[data-profile-permissions]");
      if (permissions) {
        permissions.replaceChildren(
          ...Object.entries(settings.permissions).map(([permission, allowed]) => {
            const item = document.createElement("div");
            item.className = "list-group-item d-flex justify-content-between align-items-center px-0";
            item.innerHTML = `<span>${permission.replaceAll("_", " ")}</span><span class="badge ${
              allowed ? "text-bg-success" : "text-bg-secondary"
            }">${allowed ? "Allowed" : "Not allowed"}</span>`;
            return item;
          })
        );
      }
    } catch (error) {
      if (error.status === 401) redirectToLogin();
      else showError(error.message);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const updated = await api("/auth/profile", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({ display_name: form.querySelector("#profile-display-name").value.trim() }),
        });
        if (currentUser) currentUser.display_name = updated.display_name;
        updateGlobalUserName(updated.display_name);
        showSuccess("Profile updated successfully.");
      } catch (error) {
        if (error.status === 401) redirectToLogin();
        else showError(error.message);
      }
    });
  }

  function updateGlobalUserName(displayName) {
    if (!displayName) return;
    document.querySelectorAll(".navbar-user .user-info strong").forEach((el) => (el.textContent = displayName));
    const welcome = document.getElementById("welcome-user-heading");
    if (welcome) welcome.textContent = `Hello, ${displayName}`;
    const dashWelcome = document.querySelector(".welcome-section h2");
    if (dashWelcome) dashWelcome.textContent = `Welcome back, ${displayName}`;
    const initials = displayName
      .split(/[._@ -]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "U";
    document.querySelectorAll(".navbar-user .user-avatar").forEach((el) => (el.textContent = initials));
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("nexus_theme") || "light";
    applyTheme(savedTheme);

    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        localStorage.setItem("nexus_theme", nextTheme);
      });
    });

    const themeSelect = document.getElementById("settings-theme-select");
    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener("change", (e) => {
        applyTheme(e.target.value);
        localStorage.setItem("nexus_theme", e.target.value);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.innerHTML = theme === "dark" 
        ? '<i class="bi bi-sun-fill text-warning"></i>' 
        : '<i class="bi bi-moon-stars-fill"></i>';
      btn.setAttribute("title", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Theme");
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Theme");
    });
    const themeSelect = document.getElementById("settings-theme-select");
    if (themeSelect && themeSelect.value !== theme) {
      themeSelect.value = theme;
    }
  }

  async function bindProfileIdentitySettings() {
    const form = document.getElementById("settings-identity-form");
    if (!form) return;
    try {
      const profile = await api("/auth/profile");
      const userInput = document.getElementById("settings-username-display");
      const nameInput = document.getElementById("settings-display-name-input");
      const roleBadge = document.getElementById("settings-role-badge");
      if (userInput) userInput.value = profile.username;
      if (nameInput) nameInput.value = profile.display_name || profile.username;
      if (roleBadge) {
        roleBadge.textContent = profile.role;
        roleBadge.className = `badge fs-6 py-2 px-3 ${
          profile.role === "Admin" ? "text-bg-danger" : profile.role === "Auditor" ? "text-bg-info text-dark" : "text-bg-primary"
        }`;
      }
      updateGlobalUserName(profile.display_name || profile.username);
    } catch (e) {
      console.warn("Could not load identity in settings:", e);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newName = document.getElementById("settings-display-name-input")?.value.trim();
      if (!newName) return;
      const saveBtn = document.getElementById("btn-save-display-name");
      if (saveBtn) saveBtn.disabled = true;
      try {
        const res = await api("/auth/profile", {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({ display_name: newName }),
        });
        if (currentUser) currentUser.display_name = res.display_name;
        updateGlobalUserName(res.display_name);
        showSettingsAlert("Display name updated successfully!", true);
        showToast("Display name saved!");
      } catch (err) {
        showSettingsAlert(err.message, false);
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  function bindChangeUsername() {
    const form = document.getElementById("settings-change-username-form") || document.getElementById("profile-change-username-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("#settings-new-username-input") || form.querySelector("#profile-new-username-input");
      const button = form.querySelector("button[type=submit]");
      const newUsername = input ? input.value.trim().toLowerCase() : "";

      if (!newUsername || newUsername.length < 3) {
        showSettingsAlert("Username must be at least 3 characters long.", false);
        return;
      }

      if (button) button.disabled = true;
      try {
        const res = await api("/auth/change-username", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ new_username: newUsername }),
        });

        if (res.token) {
          sessionStorage.setItem("nexus_auth_token", res.token);
          localStorage.setItem("nexus_auth_token", res.token);
        }
        if (currentUser) {
          currentUser.username = res.username;
        }
        const userDisplay = document.getElementById("settings-username-display") || document.getElementById("profile-username");
        if (userDisplay) userDisplay.value = res.username;
        if (input) input.value = "";

        showSettingsAlert(`Username changed successfully to @${res.username}!`, true);
        showToast(`Username updated to @${res.username}`);
      } catch (err) {
        showSettingsAlert(err.message, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindChangePassword() {
    const form = document.getElementById("settings-change-password-form") || document.getElementById("profile-change-password-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentInput = form.querySelector("#settings-current-password") || form.querySelector("#profile-current-password");
      const newInput = form.querySelector("#settings-new-password") || form.querySelector("#profile-new-password");
      const confirmInput = form.querySelector("#settings-confirm-password") || form.querySelector("#profile-confirm-password");
      const button = form.querySelector("button[type=submit]");

      const currentPassword = currentInput ? currentInput.value : "";
      const newPassword = newInput ? newInput.value : "";
      const confirmPassword = confirmInput ? confirmInput.value : "";

      if (!currentPassword) {
        showSettingsAlert("Please provide your current password.", false);
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        showSettingsAlert("New password must be at least 8 characters long.", false);
        return;
      }
      if (newPassword !== confirmPassword) {
        showSettingsAlert("New passwords do not match. Please re-enter.", false);
        return;
      }

      if (button) button.disabled = true;
      try {
        await api("/auth/change-password", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });

        if (currentInput) currentInput.value = "";
        if (newInput) newInput.value = "";
        if (confirmInput) confirmInput.value = "";

        showSettingsAlert("Your password has been changed successfully!", true);
        showToast("Password updated!");
      } catch (err) {
        showSettingsAlert(err.message, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function bindAuditorSettings(userRole) {
    const panel = document.getElementById("auditor-panel");
    if (!panel) return;
    
    const isAuditorOrAdmin = userRole === "Auditor" || userRole === "Admin";
    panel.style.display = isAuditorOrAdmin ? "block" : "none";
    if (!isAuditorOrAdmin) return;

    const runBtn = document.getElementById("btn-run-integrity-check");
    const resultsBox = document.getElementById("auditor-integrity-results");
    const resultsBadge = document.getElementById("auditor-integrity-badge");
    const resultsDetails = document.getElementById("auditor-integrity-details");
    const exportJsonBtn = document.getElementById("btn-export-audit-json");
    const exportCsvBtn = document.getElementById("btn-export-audit-csv");

    if (runBtn) {
      runBtn.addEventListener("click", async () => {
        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verifying disk ciphertext...';
        try {
          const res = await api("/auditor/integrity-check");
          if (resultsBox) resultsBox.classList.remove("d-none");
          if (resultsBadge) {
            resultsBadge.textContent = res.integrity_status.includes("100%") ? "Passed" : "Anomalies Flagged";
            resultsBadge.className = `badge ${res.integrity_status.includes("100%") ? "text-bg-success" : "text-bg-warning text-dark"}`;
          }
          if (resultsDetails) {
            resultsDetails.innerHTML = `
              <p class="mb-1"><strong>Status:</strong> ${escapeHtml(res.integrity_status)}</p>
              <p class="mb-1"><strong>Verified Documents:</strong> ${res.verified_intact} of ${res.total_documents} encrypted files intact</p>
              <p class="mb-0"><strong>DLP Scanning Rules:</strong> Active (7 automated regex rules)</p>
            `;
          }
          showToast("Cryptographic audit complete!");
        } catch (err) {
          showToast(err.message, false);
        } finally {
          runBtn.disabled = false;
          runBtn.innerHTML = '<i class="bi bi-shield-check"></i> Run Cryptographic Integrity Audit';
        }
      });
    }

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", () => {
        const token = sessionStorage.getItem("nexus_auth_token") || localStorage.getItem("nexus_auth_token");
        window.open(`${API_BASE_URL}/auditor/export-log?format=json`, "_blank");
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", () => {
        window.open(`${API_BASE_URL}/auditor/export-log?format=csv`, "_blank");
      });
    }
  }

  async function bindAdminGovernanceSettings(isAdmin) {
    const adminPanel = document.getElementById("admin-governance-panel");
    const adminUsersSection = document.getElementById("admin-users");
    if (!adminPanel) return;

    if (!isAdmin) {
      adminPanel.style.display = "none";
      if (adminUsersSection) adminUsersSection.style.display = "none";
      return;
    }
    adminPanel.style.display = "block";
    if (adminUsersSection) adminUsersSection.style.display = "block";

    const defaultModelSelect = document.getElementById("admin-default-model");
    const tempSlider = document.getElementById("admin-temperature");
    const tempVal = document.getElementById("admin-temp-val");
    const rateLimitSelect = document.getElementById("admin-rate-limit");
    const maxUploadSelect = document.getElementById("admin-max-upload");
    const strictDlpCheck = document.getElementById("admin-strict-dlp");
    const maintCheck = document.getElementById("admin-maintenance-mode");
    const form = document.getElementById("admin-governance-form");

    if (tempSlider && tempVal) {
      tempSlider.addEventListener("input", () => {
        tempVal.textContent = tempSlider.value;
      });
    }

    try {
      const settings = await api("/admin/settings");
      if (defaultModelSelect && settings.default_ai_model) defaultModelSelect.value = settings.default_ai_model;
      if (tempSlider && settings.ai_creativity_temperature !== undefined) {
        tempSlider.value = settings.ai_creativity_temperature;
        if (tempVal) tempVal.textContent = settings.ai_creativity_temperature;
      }
      if (rateLimitSelect && settings.user_rate_limit_rpm) rateLimitSelect.value = settings.user_rate_limit_rpm;
      if (maxUploadSelect && settings.max_upload_size_mb) maxUploadSelect.value = settings.max_upload_size_mb;
      if (strictDlpCheck && settings.strict_dlp_enforcement !== undefined) strictDlpCheck.checked = settings.strict_dlp_enforcement;
      if (maintCheck && settings.system_maintenance_mode !== undefined) maintCheck.checked = settings.system_maintenance_mode;
    } catch (e) {
      console.warn("Could not load admin settings:", e);
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById("btn-save-governance");
        if (saveBtn) saveBtn.disabled = true;
        try {
          await api("/admin/settings", {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              default_ai_model: defaultModelSelect?.value,
              ai_creativity_temperature: Number(tempSlider?.value || 0.2),
              user_rate_limit_rpm: Number(rateLimitSelect?.value || 45),
              max_upload_size_mb: Number(maxUploadSelect?.value || 25),
              strict_dlp_enforcement: strictDlpCheck?.checked,
              system_maintenance_mode: maintCheck?.checked,
            }),
          });
          showSettingsAlert("Platform governance policies updated successfully!", true);
          showToast("Governance policies saved!");
        } catch (err) {
          showSettingsAlert(err.message, false);
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
  }

  async function loadSettings() {
    const form = document.querySelector("[data-settings-form]");
    if (!form && !document.getElementById("settings-identity-form")) return;
    try {
      const settings = await api("/settings");
      if (form) {
        if (form.querySelector("#settings-notifications")) form.querySelector("#settings-notifications").checked = settings.email_notifications;
        if (form.querySelector("#settings-compact")) form.querySelector("#settings-compact").checked = settings.compact_mode;
        if (form.querySelector("#settings-sources")) form.querySelector("#settings-sources").checked = settings.ai_sources;
      }
      
      const permissions = document.querySelector("[data-role-permissions]");
      if (permissions) {
        permissions.innerHTML = `<p class="mb-1"><strong>${settings.role} Role Privileges</strong></p><p class="small text-muted">${
          settings.permissions.can_manage_users
            ? "Full workspace administration, restricted file isolation, user governance, and security quotas."
            : settings.role === "Auditor"
            ? "Independent cryptographic inspection, compliance verification, and regulatory export."
            : "Authorized document search, private storage vault, and intelligent AI assistant."
        }</p>`;
      }
      
      bindProfileIdentitySettings();
      bindAuditorSettings(settings.role);
      bindAdminGovernanceSettings(settings.permissions.can_manage_users);

      if (settings.permissions.can_manage_users) loadAdminUsers();
      
      bindGeminiSettings();
    } catch (error) {
      if (error.status === 401) redirectToLogin();
      else showError(error.message);
    }

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await api("/settings", {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify({
              email_notifications: form.querySelector("#settings-notifications")?.checked,
              compact_mode: form.querySelector("#settings-compact")?.checked,
              ai_sources: form.querySelector("#settings-sources")?.checked,
            }),
          });
          showSettingsAlert("Preferences saved successfully.", true);
          showToast("Preferences saved.");
        } catch (error) {
          if (error.status === 401) redirectToLogin();
          else showError(error.message);
        }
      });
    }
  }

  async function bindGeminiSettings() {
    const statusBadge = document.getElementById("settings-gemini-status-badge");
    const activeModelName = document.getElementById("settings-active-model-name");
    const activeModelDesc = document.getElementById("settings-active-model-desc");
    
    if (!statusBadge && !activeModelName) return;

    try {
      const status = await api("/ai/status");
      if (statusBadge) {
        if (status.gemini_enabled) {
          statusBadge.className = "badge bg-success-subtle text-success";
          statusBadge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Operational';
        } else {
          statusBadge.className = "badge bg-warning-subtle text-warning";
          statusBadge.innerHTML = '<i class="bi bi-cpu"></i> Local Search Active';
        }
      }
      if (activeModelName) {
        activeModelName.textContent = status.active_default_model || "Gemini Flash (Latest)";
      }
      if (activeModelDesc) {
        activeModelDesc.textContent = status.gemini_enabled 
          ? "Enterprise Cloud AI Reasoning Operational" 
          : "Local Knowledge Search Active";
      }
    } catch (e) {
      console.warn("Could not load AI status on settings page:", e);
    }
  }

  async function loadAdminUsers() {
    const container = document.querySelector("[data-admin-users]");
    if (!container) return;
    try {
      const users = await api("/admin/users");
      container.innerHTML = users
        .map(
          (user) =>
            `<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
              <div class="d-flex align-items-center gap-2">
                <div class="user-avatar-small rounded-circle d-flex align-items-center justify-content-center text-white bg-dark" style="width: 34px; height: 34px; font-size: 13px; font-weight: 600;">
                  ${user.username[0].toUpperCase()}
                </div>
                <div>
                  <strong>${escapeHtml(user.username)}</strong>
                  <span class="badge ${user.role === "Admin" ? "text-bg-danger" : user.role === "Auditor" ? "text-bg-info text-dark" : "text-bg-secondary"} ms-1">${escapeHtml(user.role)}</span>
                  <small class="d-block text-muted" style="font-size: 11px;">Status: ${user.active ? "Active" : "Deactivated"}</small>
                </div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <select class="form-select form-select-sm" style="width: 105px;" data-user-role-select="${user.id}">
                  <option value="User" ${user.role === "User" ? "selected" : ""}>User</option>
                  <option value="Auditor" ${user.role === "Auditor" ? "selected" : ""}>Auditor</option>
                  <option value="Admin" ${user.role === "Admin" ? "selected" : ""}>Admin</option>
                </select>
                <button class="btn btn-sm ${
                  user.active ? "btn-outline-danger" : "btn-outline-success"
                }" data-user-status="${user.id}" data-active="${!user.active}">
                  ${user.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>`
        )
        .join("");

      container.querySelectorAll("[data-user-status]").forEach((button) =>
        button.addEventListener("click", async () => {
          try {
            await api(`/admin/users/${button.dataset.userStatus}/status?active=${button.dataset.active}`, {
              method: "PATCH",
            });
            showToast("User status updated");
            await loadAdminUsers();
          } catch (error) {
            showError(error.message);
          }
        })
      );

      container.querySelectorAll("[data-user-role-select]").forEach((select) =>
        select.addEventListener("change", async () => {
          const userId = select.dataset.userRoleSelect;
          const newRole = select.value;
          try {
            await api(`/admin/users/${userId}/role`, {
              method: "PATCH",
              headers: jsonHeaders,
              body: JSON.stringify({ role: newRole }),
            });
            showToast(`User role updated to ${newRole}`);
            await loadAdminUsers();
          } catch (error) {
            showError(error.message);
            await loadAdminUsers();
          }
        })
      );
    } catch (error) {
      if (error.status !== 403) showError(error.message);
    }
  }

  async function logout(event) {
    event.preventDefault();
    sessionStorage.removeItem("nexus_auth_token");
    localStorage.removeItem("nexus_auth_token");
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      window.location.replace("index.html");
    }
  }

  function bindLogout() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest(".sidebar-logout");
      if (link) logout(event);
    });
  }

  function closeNavbarMenus() {
    document.querySelectorAll(".navbar-popover").forEach((menu) => menu.remove());
    document
      .querySelectorAll(".navbar-user[aria-expanded], .navbar-icon-btn[aria-expanded]")
      .forEach((control) => control.setAttribute("aria-expanded", "false"));
  }

  function createNavbarPopover(anchor, content) {
    closeNavbarMenus();
    const menu = document.createElement("div");
    menu.className = "navbar-popover";
    menu.innerHTML = content;
    anchor.parentElement.append(menu);
    anchor.setAttribute("aria-expanded", "true");
    return menu;
  }

  function bindNavbarActions() {
    document.querySelectorAll(".navbar-icon-btn").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.getAttribute("aria-expanded") === "true") return closeNavbarMenus();
        createNavbarPopover(
          button,
          '<div class="navbar-popover-title">Security & Notifications</div><p class="navbar-popover-empty">All encrypted documents are synced & verified.</p>'
        );
      });
    });
    document.querySelectorAll(".navbar-user").forEach((userMenu) => {
      userMenu.setAttribute("role", "button");
      userMenu.setAttribute("tabindex", "0");
      userMenu.setAttribute("aria-expanded", "false");
      const open = (event) => {
        event.stopPropagation();
        if (userMenu.getAttribute("aria-expanded") === "true") return closeNavbarMenus();
        const displayName = userMenu.querySelector(".user-info strong")?.textContent || "Account";
        const role = userMenu.querySelector(".user-info span")?.textContent || "User";
        createNavbarPopover(
          userMenu,
          `<div class="navbar-popover-account"><strong>${escapeHtml(displayName)}</strong><span>${escapeHtml(
            role
          )}</span></div><a class="navbar-menu-link" href="profile.html"><i class="bi bi-person"></i> Profile</a><a class="navbar-menu-link" href="settings.html"><i class="bi bi-gear"></i> Settings</a><a class="navbar-menu-link sidebar-logout" href="index.html"><i class="bi bi-box-arrow-left"></i> Logout</a>`
        );
      };
      userMenu.addEventListener("click", open);
      userMenu.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event);
        }
      });
    });
    document.addEventListener("click", closeNavbarMenus);
  }

  function renderDocuments(documents) {
    const tableBody = document.querySelector(".documents-table tbody");
    if (!tableBody) return;
    if (!documents.length) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="5" class="text-center py-4">No documents found in your authorized library.</td>';
      tableBody.replaceChildren(row);
    } else {
      tableBody.replaceChildren(
        ...documents.map((record) => {
          const row = document.createElement("tr");
          row.innerHTML = `<td><div class="document-name"><div class="document-file-icon ${fileClass(
            record.content_type
          )}"><i class="bi bi-file-earmark-text"></i></div><div><strong>${escapeHtml(
            record.filename
          )}</strong><span>${record.restricted ? "🔒 Restricted" : "Authorized document"}</span></div></div></td><td>${escapeHtml(
            record.content_type.split("/").pop().toUpperCase()
          )}</td><td>${formatSize(record.size)}</td><td>${formatDate(
            record.created_at
          )}</td><td><button class="document-action-btn" data-analyze-id="${
            record.id
          }" title="Analyze document with AI"><i class="bi bi-stars"></i></button><button class="document-action-btn" data-download-id="${
            record.id
          }" title="Download document"><i class="bi bi-download"></i></button><button class="document-action-btn" data-delete-id="${
            record.id
          }" title="Delete document"><i class="bi bi-trash"></i></button></td>`;
          return row;
        })
      );
    }
    renderMobileDocuments(documents);
    const count = document.querySelector(".documents-count");
    if (count) count.textContent = `${documents.length} Files`;
    const summary = document.querySelector(".documents-panel .panel-heading span:not(.documents-count)");
    if (summary) summary.textContent = `${documents.length} document${documents.length === 1 ? "" : "s"} in your workspace`;
    
    tableBody.querySelectorAll("[data-delete-id]").forEach((button) =>
      button.addEventListener("click", async () => {
        if (!window.confirm("Delete this document from encrypted storage?")) return;
        try {
          await api(`/documents/${button.dataset.deleteId}`, { method: "DELETE" });
          showSuccess("Document deleted successfully.");
          await loadDocuments();
        } catch (error) {
          showError(error.message);
        }
      })
    );
    tableBody.querySelectorAll("[data-download-id]").forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          await downloadDocument(button.dataset.downloadId);
        } catch (error) {
          if (error.status === 401) redirectToLogin();
          else showError(error.message);
        }
      })
    );
    tableBody.querySelectorAll("[data-analyze-id]").forEach((button) =>
      button.addEventListener("click", () => analyzeDocument(button.dataset.analyzeId))
    );
  }

  function renderMobileDocuments(documents) {
    const list = document.querySelector(".mobile-document-list");
    if (!list) return;
    list.replaceChildren();
    if (!documents.length) {
      list.innerHTML =
        '<div class="documents-empty-state"><i class="bi bi-folder2-open"></i><strong>No documents yet</strong><span>Upload a PDF or TXT file to start building your private library.</span></div>';
      return;
    }
    documents.forEach((record) => {
      const card = document.createElement("div");
      card.className = "mobile-document-card is-live";
      card.innerHTML = `<div class="mobile-document-top"><div class="mobile-document-info"><div class="document-file-icon ${fileClass(
        record.content_type
      )}"><i class="bi bi-file-earmark-text"></i></div><div><strong>${escapeHtml(
        record.filename
      )}</strong><span>${record.restricted ? "🔒 Restricted" : "Authorized document"}</span></div></div><button class="document-action-btn" data-mobile-analyze-id="${
        record.id
      }" title="Analyze document"><i class="bi bi-stars"></i></button></div><div class="mobile-document-details"><div><span>Type</span><strong>${escapeHtml(
        record.content_type.split("/").pop().toUpperCase()
      )}</strong></div><div><span>Size</span><strong>${formatSize(record.size)}</strong></div><div><span>Date</span><strong>${formatDate(
        record.created_at
      )}</strong></div></div>`;
      list.append(card);
    });
    list.querySelectorAll("[data-mobile-analyze-id]").forEach((button) =>
      button.addEventListener("click", () => analyzeDocument(button.dataset.mobileAnalyzeId))
    );
  }

  async function downloadDocument(id) {
    const headers = {};
    const token = sessionStorage.getItem("nexus_auth_token") || localStorage.getItem("nexus_auth_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/documents/${id}/download`, {
      credentials: "include",
      headers,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.detail || "Download failed");
      error.status = response.status;
      throw error;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = response.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] || "document";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function showAnalysis(analysis) {
    let panel = document.querySelector("[data-analysis-panel]");
    if (!panel) {
      panel = document.createElement("div");
      panel.dataset.analysisPanel = "true";
      panel.className = "analysis-panel";
      document.body.append(panel);
    }
    const findings = analysis.findings.length
      ? analysis.findings
          .map(
            (finding) =>
              `<div class="analysis-finding analysis-${finding.severity}"><div><strong>${escapeHtml(
                finding.title
              )}</strong><span>Line ${finding.line}</span></div><mark>${escapeHtml(
                finding.evidence
              )}</mark><small>${escapeHtml(finding.recommendation)}</small></div>`
          )
          .join("")
      : '<p class="analysis-safe">✅ No common sensitive credentials or keys were detected.</p>';
    panel.innerHTML = `<div class="analysis-panel-header"><div><span class="page-eyebrow">AI DOCUMENT REVIEW</span><h3>${escapeHtml(
      analysis.filename
    )}</h3></div><button type="button" class="analysis-close" aria-label="Close analysis"><i class="bi bi-x-lg"></i></button></div><div class="analysis-summary"><span class="analysis-risk analysis-${
      analysis.risk_level
    }">${escapeHtml(analysis.risk_level)} risk</span><span>${analysis.word_count} words</span><span>${
      analysis.agent === "gemini" ? "Google Gemini Model" : "Local Security Scanner"
    }</span></div><p class="mt-3">${escapeHtml(analysis.summary)}</p><h4>Security & DLP Findings</h4><div>${findings}</div>`;
    panel.querySelector(".analysis-close").addEventListener("click", () => panel.remove());
  }

  async function analyzeDocument(id) {
    try {
      showSuccess("Analyzing document security and extracting summary...");
      showAnalysis(await api(`/ai/analyze/${id}`, { method: "POST" }));
    } catch (error) {
      if (error.status === 401) redirectToLogin();
      else showError(error.message);
    }
  }

  function applyDocumentView() {
    const query = document.querySelector(".documents-search input")?.value.trim().toLowerCase() || "";
    const sort = document.querySelector(".documents-sort select")?.value || "Newest First";
    const filtered = allDocuments.filter((record) => {
      const matchesQuery =
        !query ||
        record.filename.toLowerCase().includes(query) ||
        record.content_type.toLowerCase().includes(query);
      const contentType = record.content_type.toLowerCase();
      const matchesType =
        activeDocumentType === "all" ||
        (activeDocumentType === "other"
          ? !["pdf", "word", "excel", "powerpoint"].some((type) => contentType.includes(type))
          : contentType.includes(activeDocumentType));
      return matchesQuery && matchesType;
    });
    filtered.sort((left, right) => {
      if (sort === "Oldest First") return left.created_at.localeCompare(right.created_at);
      if (sort === "Name A-Z") return left.filename.localeCompare(right.filename);
      if (sort === "Name Z-A") return right.filename.localeCompare(left.filename);
      if (sort === "Largest First") return right.size - left.size;
      return right.created_at.localeCompare(left.created_at);
    });
    renderDocuments(filtered);
  }

  function bindDocumentTools() {
    document.querySelector(".documents-search input")?.addEventListener("input", applyDocumentView);
    document.querySelector(".documents-sort select")?.addEventListener("change", applyDocumentView);
    document.querySelectorAll(".document-filter").forEach((button) =>
      button.addEventListener("click", () => {
        document.querySelectorAll(".document-filter").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const label = button.textContent.trim().toLowerCase();
        activeDocumentType =
          label === "all"
            ? "all"
            : label === "other"
            ? "other"
            : label === "word"
            ? "word"
            : label === "pdf"
            ? "pdf"
            : label === "excel"
            ? "excel"
            : label === "ppt"
            ? "powerpoint"
            : "all";
        applyDocumentView();
      })
    );
  }

  async function loadDocuments() {
    document.querySelector(".mobile-document-list")?.replaceChildren();
    try {
      allDocuments = await api("/documents");
      applyDocumentView();
    } catch (error) {
      if (error.status === 401) redirectToLogin();
      else showError(error.message);
    }
  }

  function bindUpload() {
    const triggers = [...document.querySelectorAll(".primary-action-btn, .sidebar-link")].filter(
      (trigger) =>
        trigger.classList.contains("primary-action-btn") ||
        trigger.textContent.trim().toLowerCase().includes("upload")
    );
    if (!triggers.length) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt,application/pdf,text/plain";
    input.hidden = true;
    document.body.append(input);
    triggers.forEach((trigger) =>
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        input.click();
      })
    );
    input.addEventListener("change", async () => {
      if (!input.files[0]) return;
      const form = new FormData();
      form.append("file", input.files[0]);
      if (
        currentUser?.role === "Admin" &&
        window.confirm("Mark this upload as restricted to administrators and auditors?")
      ) {
        form.append("restricted", "true");
      }
      try {
        const uploadedDocument = await api("/documents/upload", { method: "POST", body: form });
        if (document.querySelector(".documents-table")) {
          await loadDocuments();
          showSuccess(`${uploadedDocument.filename} uploaded and encrypted.`);
        } else {
          window.location.href = "documents.html";
        }
      } catch (error) {
        if (error.status === 401) redirectToLogin();
        else showError(error.message);
      } finally {
        input.value = "";
      }
    });
  }

  function bindDashboard() {
    if (!document.querySelector(".welcome-section")) return;
    api("/auth/me")
      .then((user) => {
        currentUser = user;
        return api("/documents");
      })
      .then((documents) => {
        const storedSessionsRaw = localStorage.getItem(getStoredSessionsKey());
        const sessionCount = storedSessionsRaw ? (JSON.parse(storedSessionsRaw) || []).length : 1;
        const values = [
          documents.length,
          documents.filter((record) => record.owner_id === currentUser.id).length,
          documents.filter((record) => record.owner_id !== currentUser.id).length,
          sessionCount,
        ];
        document.querySelectorAll(".stat-card .stat-content strong").forEach((value, index) => {
          if (values[index] !== undefined) value.textContent = values[index];
        });
        const heading = document.querySelector(".welcome-section h2");
        if (heading) heading.textContent = `Welcome back, ${currentUser.username}`;

        const activityList = document.querySelector(".activity-list");
        if (activityList && documents.length) {
          activityList.innerHTML = documents.slice(0, 4).map((doc) => `
            <div class="activity-item d-flex align-items-center justify-content-between p-2 mb-2 rounded bg-light border">
              <div class="d-flex align-items-center gap-2">
                <div class="stat-icon stat-icon-blue" style="width: 32px; height: 32px; font-size: 15px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(0, 102, 237, 0.1); color: #0066ed;">
                  <i class="bi bi-file-earmark-lock-fill"></i>
                </div>
                <div>
                  <strong class="d-block text-dark small mb-0">${escapeHtml(doc.filename)}</strong>
                  <small class="text-muted" style="font-size: 11px;">${doc.restricted ? "🔒 Restricted" : "Authorized"} &bull; ${formatSize(doc.size)} &bull; ${formatDate(doc.created_at)}</small>
                </div>
              </div>
              <a href="ai-chat.html" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 12px;">
                <i class="bi bi-stars"></i> Ask AI
              </a>
            </div>
          `).join("");
        }
      })
      .catch((error) => {
        if (error.status === 401) redirectToLogin();
        else showError(error.message);
      });
  }

  function bindHeaderSearch() {
    document.querySelectorAll(".dashboard-search input").forEach((input) =>
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && input.value.trim()) {
          window.location.href = `documents.html?search=${encodeURIComponent(input.value.trim())}`;
        }
      })
    );
    const query = new URLSearchParams(window.location.search).get("search");
    const documentSearch = document.querySelector(".documents-search input");
    if (query && documentSearch) {
      documentSearch.value = query;
      applyDocumentView();
    }
  }

  function bindUtilityControls() {
    document.querySelector(".forgot-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      showError("Password reset is managed by your administrator.");
    });
    document.querySelector(".microsoft-btn")?.addEventListener("click", () => {
      showError("Enterprise Single Sign-On (Microsoft Entra) is configured by the Cyber Security Team.");
    });
  }

  /* ==========================================================================
     ADVANCED GEMINI & CHATGPT CHATBOT IMPLEMENTATION
     ========================================================================== */

  function renderMarkdown(rawText) {
    if (window.marked) {
      try {
        return marked.parse(rawText);
      } catch (e) {
        console.warn("Marked parse error:", e);
      }
    }
    // Simple fallback if marked isn't loaded
    return escapeHtml(rawText)
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  function getStoredSessionsKey() {
    return `ai_power_sessions_${currentUser?.id || "guest"}`;
  }

  function initChatSessions() {
    const raw = localStorage.getItem(getStoredSessionsKey());
    if (raw) {
      try {
        chatSessions = JSON.parse(raw);
      } catch (e) {
        chatSessions = [];
      }
    }
    if (!chatSessions.length) {
      createNewChatSession(false);
    } else {
      currentSessionId = chatSessions[0].id;
      renderChatSessionsList();
      renderActiveSessionMessages();
    }
  }

  function saveChatSessions() {
    localStorage.setItem(getStoredSessionsKey(), JSON.stringify(chatSessions));
  }

  function createNewChatSession(render = true) {
    const newSession = {
      id: "session_" + Date.now(),
      title: "New Chat",
      timestamp: new Date().toISOString(),
      messages: [],
    };
    chatSessions.unshift(newSession);
    currentSessionId = newSession.id;
    saveChatSessions();
    if (render) {
      renderChatSessionsList();
      renderActiveSessionMessages();
    }
  }

  function renderChatSessionsList() {
    const list = document.getElementById("chat-sessions-list");
    if (!list) return;
    list.innerHTML = "";
    chatSessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = `session-item ${session.id === currentSessionId ? "active" : ""}`;
      item.innerHTML = `
        <div class="session-title">
          <i class="bi bi-chat-left-text"></i>
          <span>${escapeHtml(session.title)}</span>
        </div>
        <button class="session-delete-btn" title="Delete conversation" data-del-session="${session.id}">
          <i class="bi bi-trash"></i>
        </button>
      `;
      item.addEventListener("click", (e) => {
        if (e.target.closest(".session-delete-btn")) return;
        currentSessionId = session.id;
        renderChatSessionsList();
        renderActiveSessionMessages();
      });
      list.appendChild(item);
    });

    list.querySelectorAll("[data-del-session]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSession(btn.dataset.delSession);
      });
    });
  }

  function deleteSession(sessionId) {
    chatSessions = chatSessions.filter((s) => s.id !== sessionId);
    if (!chatSessions.length) {
      createNewChatSession(true);
    } else {
      if (currentSessionId === sessionId) {
        currentSessionId = chatSessions[0].id;
      }
      saveChatSessions();
      renderChatSessionsList();
      renderActiveSessionMessages();
    }
  }

  function getActiveSession() {
    return chatSessions.find((s) => s.id === currentSessionId);
  }

  function renderActiveSessionMessages() {
    const session = getActiveSession();
    const stream = document.getElementById("chat-stream-container");
    const welcome = document.getElementById("chat-welcome-screen");
    const messagesContainer = document.getElementById("chat-messages");

    if (!stream || !welcome) return;

    if (!session || !session.messages.length) {
      welcome.classList.remove("d-none");
      stream.classList.add("d-none");
      stream.innerHTML = "";
    } else {
      welcome.classList.add("d-none");
      stream.classList.remove("d-none");
      stream.innerHTML = "";

      session.messages.forEach((msg) => {
        appendMessageElement(msg.role, msg.content, msg.sources || [], msg.model, msg.time, false);
      });
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }

  function appendMessageElement(role, text, sources = [], modelName = "Gemini Flash", timeStr = "", autoScroll = true, isStreaming = false) {
    const stream = document.getElementById("chat-stream-container");
    const welcome = document.getElementById("chat-welcome-screen");
    const messagesContainer = document.getElementById("chat-messages");

    if (!stream) return;
    if (welcome && !welcome.classList.contains("d-none")) {
      welcome.classList.add("d-none");
      stream.classList.remove("d-none");
    }

    const item = document.createElement("div");
    item.className = `chat-message ${role}-message`;

    const userInitial = (currentUser?.display_name || currentUser?.username)?.[0]?.toUpperCase() || "U";
    const avatar =
      role === "user"
        ? `<div class="message-avatar user-avatar-small">${userInitial}</div>`
        : `<div class="message-avatar ai-avatar-small"><i class="bi bi-stars"></i></div>`;

    const timeFormatted = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let sourcesHtml = "";
    if (role === "assistant" && sources && sources.length) {
      sourcesHtml = `
        <div class="message-sources-wrapper">
          <div class="sources-label"><i class="bi bi-shield-check text-success"></i> Grounded Document Citations:</div>
          <div class="message-sources">
            ${sources
              .map(
                (s, i) => `
              <span class="source-badge" data-source-index="${i}">
                <i class="bi bi-file-earmark-pdf"></i> ${escapeHtml(s.filename)}
              </span>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    const modelBadge = role === "assistant" ? `<span class="ai-message-model-tag"><i class="bi bi-stars"></i> ${escapeHtml(modelName || "Gemini Flash")}</span>` : "";

    const actionsHtml =
      role === "assistant"
        ? `<div class="message-actions">
            <button class="btn-msg-action" data-action="copy" title="Copy response"><i class="bi bi-clipboard"></i> Copy</button>
            <button class="btn-msg-action" data-action="speak" title="Read response aloud"><i class="bi bi-volume-up"></i> Speak</button>
            <button class="btn-msg-action" data-action="thumbs-up" title="Helpful response"><i class="bi bi-hand-thumbs-up"></i></button>
            <button class="btn-msg-action" data-action="thumbs-down" title="Not helpful"><i class="bi bi-hand-thumbs-down"></i></button>
          </div>`
        : "";

    item.innerHTML = `
      ${avatar}
      <div class="message-bubble">
        <div class="ai-message-header">
          ${modelBadge}
          <span class="ai-message-time">${timeFormatted}</span>
        </div>
        <div class="message-content">
          ${role === "user" ? `<p>${escapeHtml(text)}</p>` : isStreaming ? '<span class="typing-cursor"></span>' : renderMarkdown(text)}
        </div>
        <div class="sources-container-slot">${isStreaming ? "" : sourcesHtml}</div>
        <div class="actions-container-slot">${isStreaming ? "" : actionsHtml}</div>
      </div>
    `;

    function bindMessageBehaviors() {
      // Code copy buttons setup
      item.querySelectorAll("pre").forEach((pre) => {
        if (pre.querySelector(".code-copy-btn")) return;
        const copyBtn = document.createElement("button");
        copyBtn.className = "code-copy-btn";
        copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        copyBtn.addEventListener("click", () => {
          const codeText = pre.querySelector("code")?.innerText || pre.innerText;
          navigator.clipboard.writeText(codeText);
          copyBtn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied!';
          setTimeout(() => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'), 2000);
        });
        pre.appendChild(copyBtn);
      });

      // Syntax Highlighting
      if (window.hljs) {
        item.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block);
        });
      }

      // Bind Message Action Buttons
      item.querySelectorAll(".btn-msg-action").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.action;
          if (act === "copy") {
            navigator.clipboard.writeText(text);
            btn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied';
            showToast("Response copied to clipboard");
            setTimeout(() => (btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'), 2000);
          } else if (act === "speak") {
            toggleSpeech(text, btn);
          } else if (act === "thumbs-up") {
            btn.classList.toggle("text-success");
            showToast("Response feedback recorded");
          } else if (act === "thumbs-down") {
            btn.classList.toggle("text-danger");
            showToast("Feedback recorded. Refining search grounding.");
          }
        });
      });

      // Bind Source Badge Clicks (Modal preview)
      item.querySelectorAll(".source-badge").forEach((badge) => {
        badge.addEventListener("click", () => {
          const idx = Number(badge.dataset.sourceIndex);
          const sourceData = sources[idx];
          if (sourceData) {
            showSourceModal(sourceData);
          }
        });
      });
    }

    stream.appendChild(item);

    if (role === "assistant" && isStreaming) {
      const contentEl = item.querySelector(".message-content");
      const words = text.split(/(\s+)/);
      let idx = 0;
      let buffer = "";

      const streamTimer = setInterval(() => {
        const chunk = words.slice(idx, idx + 4).join("");
        buffer += chunk;
        idx += 4;

        if (contentEl) {
          contentEl.innerHTML = renderMarkdown(buffer) + '<span class="typing-cursor"></span>';
        }

        if (autoScroll && messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (idx >= words.length) {
          clearInterval(streamTimer);
          if (contentEl) {
            contentEl.innerHTML = renderMarkdown(text);
          }
          const sourcesSlot = item.querySelector(".sources-container-slot");
          const actionsSlot = item.querySelector(".actions-container-slot");
          if (sourcesSlot) sourcesSlot.innerHTML = sourcesHtml;
          if (actionsSlot) actionsSlot.innerHTML = actionsHtml;
          bindMessageBehaviors();
          if (autoScroll && messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }, 16);
    } else {
      bindMessageBehaviors();
    }

    if (autoScroll && messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function showSourceModal(source) {
    const filenameEl = document.getElementById("source-modal-filename");
    const snippetEl = document.getElementById("source-modal-snippet");
    if (filenameEl) filenameEl.textContent = source.filename || "Document Chunk";
    if (snippetEl) snippetEl.textContent = source.snippet || "Grounding excerpt extracted from encrypted vault.";
    const modalEl = document.getElementById("sourceSnippetModal");
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function toggleSpeech(text, btn) {
    if (!window.speechSynthesis) {
      showToast("Speech synthesis not supported in this browser.", false);
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btn) btn.innerHTML = '<i class="bi bi-volume-up"></i> Speak';
      return;
    }
    activeSpeechUtterance = new SpeechSynthesisUtterance(text.replace(/[*#`_]/g, ""));
    activeSpeechUtterance.onend = () => {
      if (btn) btn.innerHTML = '<i class="bi bi-volume-up"></i> Speak';
    };
    if (btn) btn.innerHTML = '<i class="bi bi-stop-circle text-danger"></i> Stop';
    window.speechSynthesis.speak(activeSpeechUtterance);
  }

  function appendThinkingElement() {
    const stream = document.getElementById("chat-stream-container");
    if (!stream) return null;
    const item = document.createElement("div");
    item.className = "chat-message ai-message ai-thinking-message";
    item.innerHTML = `
      <div class="message-avatar ai-avatar-small"><i class="bi bi-stars"></i></div>
      <div class="message-bubble">
        <div class="ai-thinking-box">
          <span>AI is searching authorized documents & formulating answer</span>
          <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
    stream.appendChild(item);
    const container = document.getElementById("chat-messages");
    if (container) container.scrollTop = container.scrollHeight;
    return item;
  }

  function bindChat() {
    const input = document.getElementById("chat-query-input");
    const send = document.getElementById("chat-send-btn");
    const attachBtn = document.getElementById("chat-attach-doc-btn");
    const newChatBtn = document.getElementById("btn-new-chat");
    const clearBtn = document.getElementById("clear-chat-btn");
    const exportBtn = document.getElementById("export-chat-btn");
    const sidebarModelSelect = document.getElementById("sidebar-model-select");
    const activeModelLabel = document.getElementById("active-model-label");
    const toggleHistoryBtn = document.getElementById("toggle-chat-history-btn");
    const clearAllSessionsBtn = document.getElementById("btn-clear-all-sessions");
    const securityAuditBtn = document.getElementById("view-security-audit-btn");
    const micBtn = document.getElementById("chat-mic-btn");

    if (!input || !send) return;

    // Sidebar Toggle
    if (toggleHistoryBtn) {
      toggleHistoryBtn.addEventListener("click", () => {
        document.getElementById("chat-history-sidebar")?.classList.toggle("collapsed");
      });
    }

    // Model Selector Change
    if (sidebarModelSelect) {
      sidebarModelSelect.addEventListener("change", () => {
        activeModel = sidebarModelSelect.value;
        if (activeModelLabel) {
          activeModelLabel.textContent = sidebarModelSelect.options[sidebarModelSelect.selectedIndex].text.split("(")[0].trim();
        }
        showToast(`Active model switched to: ${activeModel}`);
      });
    }

    // New Chat
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => createNewChatSession(true));
    }

    // Clear active chat
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const session = getActiveSession();
        if (session) {
          session.messages = [];
          session.title = "New Chat";
          saveChatSessions();
          renderChatSessionsList();
          renderActiveSessionMessages();
          showToast("Conversation cleared.");
        }
      });
    }

    // Clear all sessions
    if (clearAllSessionsBtn) {
      clearAllSessionsBtn.addEventListener("click", () => {
        if (window.confirm("Clear all recent chat sessions?")) {
          chatSessions = [];
          createNewChatSession(true);
        }
      });
    }

    // Export conversation
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const session = getActiveSession();
        if (!session || !session.messages.length) {
          showToast("No messages to export.", false);
          return;
        }
        let md = `# NexusDocs Chat Export - ${session.title}\n*Date: ${new Date().toLocaleString()}*\n\n---\n\n`;
        session.messages.forEach((m) => {
          md += `### ${m.role === "user" ? "User" : "AI Assistant (" + (m.model || "Gemini") + ")"}\n${m.content}\n\n`;
          if (m.sources && m.sources.length) {
            md += `**Sources:** ${m.sources.map((s) => s.filename).join(", ")}\n\n`;
          }
        });
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `chat-export-${Date.now()}.md`;
        a.click();
        showToast("Conversation exported as Markdown.");
      });
    }

    // Security Audit Modal Trigger
    if (securityAuditBtn) {
      securityAuditBtn.addEventListener("click", async () => {
        const modalEl = document.getElementById("securityAuditModal");
        const contentEl = document.getElementById("security-audit-content");
        if (!modalEl || !contentEl) return;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
        try {
          const audit = await api("/security/audit");
          contentEl.innerHTML = `
            <div class="row g-3">
              <div class="col-md-6">
                <div class="p-3 bg-light rounded border h-100">
                  <h6 class="text-primary d-flex align-items-center gap-2"><i class="bi bi-lock-fill"></i> Document Encryption</h6>
                  <p class="small mb-1"><strong>Algorithm:</strong> ${audit.encryption.algorithm}</p>
                  <p class="small mb-1"><strong>Status:</strong> <span class="badge text-bg-success">${audit.encryption.status}</span></p>
                  <p class="small mb-0"><strong>Plaintext on Disk:</strong> <span class="text-success font-monospace">0 bytes (Zero Plaintext)</span></p>
                </div>
              </div>
              <div class="col-md-6">
                <div class="p-3 bg-light rounded border h-100">
                  <h6 class="text-primary d-flex align-items-center gap-2"><i class="bi bi-shield-shaded"></i> Role-Based Access Control</h6>
                  <p class="small mb-1"><strong>Active Role:</strong> <span class="badge text-bg-primary">${audit.access_control.user_role}</span></p>
                  <p class="small mb-1"><strong>Authorized Files:</strong> ${audit.access_control.accessible_documents} of ${audit.access_control.total_documents} total</p>
                  <p class="small mb-0"><strong>Restricted Files Isolated:</strong> ${audit.access_control.restricted_documents} docs</p>
                </div>
              </div>
              <div class="col-12">
                <div class="p-3 bg-light rounded border">
                  <h6 class="text-primary d-flex align-items-center gap-2"><i class="bi bi-eye-slash-fill"></i> Data Loss Prevention (DLP) Redaction</h6>
                  <p class="small text-muted mb-2">Automated regex scanning redacts sensitive tokens before sending context to Gemini AI:</p>
                  <div class="d-flex flex-wrap gap-1">
                    ${audit.data_loss_prevention.redacted_patterns
                      .map((p) => `<span class="badge bg-secondary-subtle text-dark">${escapeHtml(p)}</span>`)
                      .join("")}
                  </div>
                </div>
              </div>
            </div>
          `;
        } catch (e) {
          contentEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
        }
      });
    }

    // Direct File Upload from Chat
    if (attachBtn) {
      const chatFileInput = document.createElement("input");
      chatFileInput.type = "file";
      chatFileInput.accept = ".pdf,.txt,application/pdf,text/plain";
      chatFileInput.hidden = true;
      document.body.appendChild(chatFileInput);

      attachBtn.addEventListener("click", () => chatFileInput.click());

      chatFileInput.addEventListener("change", async () => {
        if (!chatFileInput.files[0]) return;
        const file = chatFileInput.files[0];
        const form = new FormData();
        form.append("file", file);
        if (currentUser?.role === "Admin" && window.confirm("Upload this as a restricted document?")) {
          form.append("restricted", "true");
        }
        showToast(`Encrypting & indexing ${file.name}...`);
        try {
          const doc = await api("/documents/upload", { method: "POST", body: form });
          showToast(`✅ ${doc.filename} successfully added to context!`);
          await loadChatContext();
          // Select the new document in context dropdown
          const contextSelect = document.getElementById("chat-document-context");
          if (contextSelect) contextSelect.value = doc.id;
        } catch (err) {
          showToast(err.message, false);
        } finally {
          chatFileInput.value = "";
        }
      });
    }

    // Voice Dictation Support (SpeechRecognition)
    if (micBtn) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const recognizer = new SpeechRec();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.onstart = () => {
          micBtn.classList.add("text-danger");
          showToast("Listening... speak your document question");
        };
        recognizer.onresult = (evt) => {
          const transcript = evt.results[0][0].transcript;
          input.value = transcript;
          input.style.height = input.scrollHeight + "px";
          send.disabled = false;
        };
        recognizer.onend = () => {
          micBtn.classList.remove("text-danger");
        };
        micBtn.addEventListener("click", () => recognizer.start());
      } else {
        micBtn.style.display = "none";
      }
    }

    // Auto-resize textarea
    input.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 140) + "px";
      send.disabled = this.value.trim() === "";
    });

    const submit = async () => {
      const query = input.value.trim();
      if (!query) return;

      input.value = "";
      input.style.height = "auto";
      send.disabled = true;

      // Update session title if first message
      const session = getActiveSession();
      if (session && !session.messages.length) {
        session.title = query.length > 28 ? query.substring(0, 28) + "..." : query;
        renderChatSessionsList();
      }

      const now = new Date().toISOString();
      appendMessageElement("user", query, [], null, now, true);

      // Save user message to session
      session?.messages.push({ role: "user", content: query, time: now });
      saveChatSessions();

      const thinking = appendThinkingElement();
      input.disabled = true;

      try {
        const documentId = document.getElementById("chat-document-context")?.value || document.getElementById("mobile-chat-context")?.value;
        const result = await api("/ai/chat", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            query,
            document_id: documentId ? Number(documentId) : null,
            model: activeModel,
          }),
        });

        thinking?.remove();
        const assistantTime = new Date().toISOString();
        const modelUsed = result.model || (result.agent === "gemini" ? "Gemini Flash" : "Local Neural Search");

        appendMessageElement("assistant", result.answer, result.sources || [], modelUsed, assistantTime, true, true);

        // Save assistant message to session
        session?.messages.push({
          role: "assistant",
          content: result.answer,
          sources: result.sources || [],
          model: modelUsed,
          time: assistantTime,
        });
        saveChatSessions();
      } catch (error) {
        thinking?.remove();
        if (error.status === 401) {
          redirectToLogin();
        } else {
          appendMessageElement(
            "assistant",
            `⚠️ **Error:** ${error.message}. Please verify your network connection or switch AI model in the sidebar.`,
            [],
            "System",
            new Date().toISOString(),
            true,
            false
          );
        }
      } finally {
        input.disabled = false;
        input.focus();
      }
    };

    send.addEventListener("click", submit);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    document.querySelectorAll(".suggestion-card").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.dataset.prompt || button.querySelector(".suggestion-text span")?.textContent.trim();
        if (prompt) {
          input.value = prompt;
          submit();
        }
      });
    });
  }

  async function loadChatContext() {
    const desktopSelector = document.getElementById("chat-document-context");
    const mobileSelector = document.getElementById("mobile-chat-context");

    if (!desktopSelector && !mobileSelector) return;

    try {
      const documents = await api("/documents");
      const options = [
        new Option(`All authorized documents (${documents.length})`, ""),
        ...documents.map((record) => new Option(record.filename + (record.restricted ? " [Restricted]" : ""), record.id)),
      ];

      if (desktopSelector) {
        desktopSelector.replaceChildren(...options.map((o) => o.cloneNode(true)));
      }
      if (mobileSelector) {
        mobileSelector.replaceChildren(...options.map((o) => o.cloneNode(true)));
      }
    } catch (error) {
      if (error.status === 401) redirectToLogin();
    }
  }

  async function checkAiBackendStatus() {
    try {
      const status = await api("/ai/status");
      const badge = document.getElementById("gemini-api-status-badge");
      const modelLabel = document.getElementById("active-model-label");
      const select = document.getElementById("sidebar-model-select");
      if (status.active_default_model && status.gemini_enabled) {
        activeModel = status.active_default_model;
        if (select) select.value = activeModel;
        if (modelLabel) {
          const matchedOpt = select ? select.options[select.selectedIndex]?.text : null;
          modelLabel.textContent = matchedOpt ? matchedOpt.split("(")[0].trim() : "Gemini Flash";
        }
      }
      if (badge) {
        if (status.gemini_enabled) {
          badge.className = "badge bg-success-subtle text-success";
          badge.textContent = "Gemini Connected";
        } else {
          badge.className = "badge bg-warning-subtle text-warning";
          badge.textContent = "Local Search Active";
        }
      }
    } catch (e) {
      console.warn("AI Status check:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    bindAccountNavigation();
    bindLogin();
    bindRegister();
    bindPasswordToggle();
    bindLogout();
    bindNavbarActions();
    bindUpload();
    bindChat();
    bindDocumentTools();
    bindHeaderSearch();
    bindUtilityControls();
    bindDashboard();
    bindChangeUsername();
    bindChangePassword();
    loadProfile();
    loadSettings();
    requireAuthentication();
    if (document.querySelector(".documents-table")) loadDocuments();
    if (document.querySelector("#chat-document-context") || document.querySelector(".context-select")) loadChatContext();
  });
})();
