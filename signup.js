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

function getSelectedRole() {
  const checked = document.querySelector('input[name="role"]:checked');
  return checked?.value || "patient";
}

async function handleSignup() {
  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const btn = document.getElementById("signupBtn");

  const name = (nameEl?.value || "").trim();
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";
  const role = getSelectedRole(); // "patient" | "caregiver"

  if (!name || !email || !password) {
    showToast("Please enter name, email and password", "warning");
    return;
  }

  if (btn) btn.disabled = true;
  try {
    // Backend currently accepts { email, password }.
    // We also send role and name.
    await window.Auth.apiFetch("/api/auth/signup", {
      method: "POST",
      body: { name, email, password, role }
    });

    showToast("Account created. Please login.", "success");
    window.location.href = "login.html";
  } catch (err) {
    showToast(err.message || "Signup failed", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// If already logged in, bounce to home
if (window.Auth.isAuthenticated()) {
  window.location.href = "index.html";
}

