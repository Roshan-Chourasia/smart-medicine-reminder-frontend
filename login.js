function showToast(message, type = "info") {
  let background = "linear-gradient(to right, #14213d, #3b82f6)";
  if (type === "success") background = "linear-gradient(to right, #10b981, #059669)";
  if (type === "error") background = "linear-gradient(to right, #ef4444, #dc2626)";
  if (type === "warning") background = "linear-gradient(to right, #fca311, #f59e0b)";

  if (typeof Toastify === "function") {
    Toastify({
      text: message,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      style: { background, borderRadius: "8px", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" }
    }).showToast();
  } else {
    alert(message);
  }
}

function getReturnTo() {
  const params = new URLSearchParams(window.location.search);
  return params.get("returnTo") || "index.html";
}

async function handleLogin() {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const btn = document.getElementById("loginBtn");

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    showToast("Please enter email and password", "warning");
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const data = await window.Auth.apiFetch("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });

    if (!data || !data.token) {
      showToast("Login failed: no token returned", "error");
      return;
    }

    // Store token plus user identity (prefer values returned by backend).
    window.Auth.setAuthSession({
      token: data.token,
      email: data.email || email,
      name: data.name || null
    });
    showToast("Logged in successfully", "success");

    window.location.href = getReturnTo();
  } catch (err) {
    showToast(err.message || "Login failed", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Enter-to-submit
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const active = document.activeElement;
    if (active && (active.id === "email" || active.id === "password")) {
      handleLogin();
    }
  }
});

// If already logged in, bounce to home
if (window.Auth.isAuthenticated()) {
  window.location.href = getReturnTo();
}

