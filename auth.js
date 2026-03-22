// Shared auth + API helper for the vanilla frontend
const BASE_URL = window.API_URL || "http://localhost:5000";

const TOKEN_KEY = "token";
const EMAIL_KEY = "userEmail";
const NAME_KEY = "userName";
const ROLE_KEY = "userRole";

// Decode a JWT payload without verifying signature (for frontend convenience)
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json);
  } catch (e) {
    console.warn("Failed to decode JWT", e);
    return null;
  }
}

function setAuthSession({ token, email, name, role }) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);

    // Try to derive role from JWT payload
    const payload = decodeJwt(token);
    const derivedRole = payload && payload.role;

    if (derivedRole) {
      localStorage.setItem(ROLE_KEY, derivedRole);
    } else if (role) {
      // Fallback to explicitly provided role if token doesn't include it
      localStorage.setItem(ROLE_KEY, role);
    }
  }

  if (email) {
    localStorage.setItem(EMAIL_KEY, email);
  }
  if (name) {
    localStorage.setItem(NAME_KEY, name);
  }
}

function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredEmail() {
  return localStorage.getItem(EMAIL_KEY);
}

function getStoredName() {
  return localStorage.getItem(NAME_KEY);
}

function getStoredRole() {
  return localStorage.getItem(ROLE_KEY);
}

function isAuthenticated() {
  return Boolean(getToken());
}

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  const headers = getAuthHeaders(options.headers || {});

  // Default JSON handling when body is a plain object
  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(url, { ...options, headers, body });

  // Try to parse JSON, but don’t crash if backend returns empty/non-json
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && data.message) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function redirectToLogin(returnTo = window.location.pathname) {
  const url = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
  window.location.href = url;
}

function logoutAndRedirect() {
  clearAuthSession();
  window.location.href = "login.html";
}

// Expose for inline handlers if needed
window.Auth = {
  BASE_URL,
  setAuthSession,
  clearAuthSession,
  getToken,
  getStoredEmail,
  getStoredName,
  getStoredRole,
  isAuthenticated,
  getAuthHeaders,
  apiFetch,
  redirectToLogin,
  logoutAndRedirect
};

