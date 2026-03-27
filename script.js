// Device ID will be fetched from linked patient
let DEVICE_ID = null;
// Selected device ID for caregivers (multi-device support)
let selectedDeviceId = null;

function getCurrentRole() {
  return (window.Auth && window.Auth.getStoredRole && window.Auth.getStoredRole()) || "patient";
}

function isPatientRole() {
  return getCurrentRole() === "patient";
}

// ---------------- TOAST NOTIFICATIONS (Toastify) ----------------
function showToast(message, type = "info") {
  // type: "success", "error", "info"
  let background = "linear-gradient(to right, #14213d, #3b82f6)"; // default/info - using prussian blue

  if (type === "success") {
    background = "linear-gradient(to right, #10b981, #059669)"; // green
  } else if (type === "error") {
    background = "linear-gradient(to right, #ef4444, #dc2626)"; // red
  } else if (type === "warning") {
    background = "linear-gradient(to right, #fca311, #f59e0b)"; // orange
  }

  if (typeof Toastify === "function") {
    Toastify({
      text: message,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      style: {
        background,
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
      }
    }).showToast();
  } else {
    // Fallback to alert if Toastify is not loaded for some reason
    alert(message);
  }
}

// ---------------- REPEAT CONTROLS HELPERS ----------------
function getRepeatDays() {
  const presetSelect = document.getElementById("repeatPreset");
  if (!presetSelect) return 0;

  const presetValue = presetSelect.value;

  if (presetValue !== "custom") {
    const days = parseInt(presetValue, 10);
    return Number.isNaN(days) ? 0 : days;
  }

  const numInput = document.getElementById("customRepeatNumber");
  const unitSelect = document.getElementById("customRepeatUnit");
  if (!numInput || !unitSelect) return 0;

  const amount = parseInt(numInput.value, 10);
  if (Number.isNaN(amount) || amount <= 0) return 0;

  const unit = unitSelect.value;
  if (unit === "weeks") return amount * 7;
  if (unit === "months") return amount * 30; // simple month approximation
  return amount; // days
}

function showOrHideCustomRepeatControls() {
  const presetSelect = document.getElementById("repeatPreset");
  const customSpan = document.getElementById("customRepeatControls");
  if (!presetSelect || !customSpan) return;

  if (presetSelect.value === "custom") {
    customSpan.style.display = "inline-block";
  } else {
    customSpan.style.display = "none";
  }
}

function loadSavedRepeatOptions() {
  const stored = localStorage.getItem("doseRepeat");
  const presetSelect = document.getElementById("repeatPreset");
  const numInput = document.getElementById("customRepeatNumber");
  const unitSelect = document.getElementById("customRepeatUnit");

  if (!stored || !presetSelect) return;

  try {
    const data = JSON.parse(stored);

    if (data.preset != null) {
      presetSelect.value = data.preset;
    }

    if (data.preset === "custom" && numInput && unitSelect) {
      if (data.number != null) numInput.value = data.number;
      if (data.unit) unitSelect.value = data.unit;
    }
  } catch (e) {
    console.error("Failed to load saved repeat options", e);
  }

  // Ensure correct visibility
  showOrHideCustomRepeatControls();
}

function initRepeatControls() {
  const presetSelect = document.getElementById("repeatPreset");
  if (!presetSelect) return;

  presetSelect.addEventListener("change", showOrHideCustomRepeatControls);
}

// ---------------- SAVE DOSE TIMES ----------------
async function saveDoseTimes(showAlert = true, alertMessage = "Dose times saved successfully") {
  if (isPatientRole()) {
    showToast("Only caregivers can change dose times", "warning");
    return;
  }

  // Get active device ID
  const activeDeviceId = getActiveDeviceId();
  if (!activeDeviceId) {
    showToast("Please link a device to a patient first", "warning");
    return;
  }

  const data = {
    deviceId: activeDeviceId,
    morning: {
      before: document.getElementById("morningBefore").value || null,
      after: document.getElementById("morningAfter").value || null
    },
    afternoon: {
      before: document.getElementById("afternoonBefore").value || null,
      after: document.getElementById("afternoonAfter").value || null
    },
    night: {
      before: document.getElementById("nightBefore").value || null,
      after: document.getElementById("nightAfter").value || null
    }
  };

  // Include repeat info for potential backend use
  const repeatDays = getRepeatDays();
  data.repeatDays = repeatDays;

  // Persist locally so values remain after page refresh
  localStorage.setItem("doseTimes", JSON.stringify(data));
  localStorage.setItem(
    "doseRepeat",
    JSON.stringify({
      preset: document.getElementById("repeatPreset")?.value ?? "0",
      number: document.getElementById("customRepeatNumber")?.value ?? null,
      unit: document.getElementById("customRepeatUnit")?.value ?? "days"
    })
  );

  try {
    await Auth.apiFetch('/api/dose-time', {
      method: "POST",
      body: data
    });

    if (showAlert) {
      showToast(alertMessage, "success");
    }
  } catch (err) {
    console.error("Failed to save dose times", err);
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast("Failed to save dose times: " + (err.message || "Unknown error"), "error");
    }
  }
}

// ---------------- LOAD SAVED DOSE TIMES INTO INPUTS ----------------
async function loadSavedDoseTimes() {
  // First try to load from backend if authenticated and device is linked
  if (Auth.isAuthenticated()) {
    const activeDeviceId = getActiveDeviceId();
    if (activeDeviceId) {
      try {
        const data = await Auth.apiFetch(`/api/dose-time?deviceId=${activeDeviceId}`);
        if (data && (data.morning || data.afternoon || data.night)) {
          populateDoseTimeInputs(data);
          updateSetTimeHeader();
          return;
        }
      } catch (err) {
        // Fall back to localStorage if API fails
        console.warn("Failed to load dose times from API, using localStorage", err);
      }
    }
  }

  // Fallback to localStorage (only if it matches current device)
  const stored = localStorage.getItem("doseTimes");
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Only use localStorage data if it matches the currently selected device
      const activeDeviceId = getActiveDeviceId();
      if (!activeDeviceId || data.deviceId === activeDeviceId) {
        populateDoseTimeInputs(data);
        updateSetTimeHeader();
      }
    } catch (e) {
      console.error("Failed to load saved dose times", e);
    }
  }
}

function populateDoseTimeInputs(data) {
  if (data.morning) {
    if (data.morning.before) document.getElementById("morningBefore").value = data.morning.before;
    if (data.morning.after) document.getElementById("morningAfter").value = data.morning.after;
  }

  if (data.afternoon) {
    if (data.afternoon.before) document.getElementById("afternoonBefore").value = data.afternoon.before;
    if (data.afternoon.after) document.getElementById("afternoonAfter").value = data.afternoon.after;
  }

  if (data.night) {
    if (data.night.before) document.getElementById("nightBefore").value = data.night.before;
    if (data.night.after) document.getElementById("nightAfter").value = data.night.after;
  }
}

// ---------------- UPDATE / DELETE SINGLE DOSE TIME ----------------
function updateDoseTime(meal, timing) {
  if (isPatientRole()) {
    showToast("Only caregivers can change dose times", "warning");
    return;
  }

  const id = `${meal}${timing.charAt(0).toUpperCase()}${timing.slice(1)}`; // e.g. morningBefore
  const input = document.getElementById(id);
  if (!input) return;

  // Open the time picker for a better UX
  input.focus();
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch (e) {
      // Some browsers may throw; ignore and rely on focus only
    }
  }

  // When user picks a new time, save silently (no alert)
  const handler = () => {
    saveDoseTimes(false);
    input.removeEventListener("change", handler);
  };
  input.addEventListener("change", handler);
}

function deleteDoseTime(meal, timing) {
  if (isPatientRole()) {
    showToast("Only caregivers can change dose times", "warning");
    return;
  }

  const id = `${meal}${timing.charAt(0).toUpperCase()}${timing.slice(1)}`; // e.g. morningBefore
  const input = document.getElementById(id);
  if (input) {
    input.value = "";
  }
  // Persist the deletion
  saveDoseTimes(true, "Dose time deleted successfully");
}

// ---------------- LOAD DOSE LOGS ----------------
function formatTimingWithMeal(meal, timing) {
  const mealMap = {
    morning: "breakfast",
    afternoon: "lunch",
    night: "dinner"
  };

  const mealName = mealMap[meal?.toLowerCase?.()] || meal;

  if ((timing === "before" || timing === "after") && mealName) {
    return `${timing} ${mealName}`;
  }

  return timing || "";
}

let allDoseLogs = [];
let filteredDoseLogs = [];
let currentPage = 1;
let doseHistoryEmptyMessage = "No dose history found for selected filters";

function getStatusBadge(status) {
  if (status?.toLowerCase() === "taken") {
    return '<span class="badge badge-success"><lord-icon src="https://cdn.lordicon.com/rnbuzxxk.json" trigger="hover" stroke="bold" colors="primary:#000000,secondary:#109121" style="width:20px;height:20px"></lord-icon> Taken</span>';
  } else if (status?.toLowerCase() === "missed") {
    return '<span class="badge badge-error"><lord-icon src="https://cdn.lordicon.com/pilfbsjh.json" trigger="hover" style="width:20px;height:20px"></lord-icon> Missed</span>';
  }
  return `<span class="badge badge-info">${status || "Unknown"}</span>`;
}

function getMealIcon(meal) {
  const mealIcons = {
    morning: "🌅",
    afternoon: "☀️",
    night: "🌙"
  };
  return mealIcons[meal?.toLowerCase()] || "";
}

function renderDoseLogs(logs) {
  const table = document.getElementById("logTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // Clear all rows
  tbody.innerHTML = "";

  if (logs.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="5" class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">${doseHistoryEmptyMessage}</div>
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  logs.forEach(log => {
    const timingDisplay = formatTimingWithMeal(log.meal, log.timing);
    const mealIcon = getMealIcon(log.meal);
    const statusBadge = getStatusBadge(log.status);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${log.date || "N/A"}</td>
      <td>${mealIcon} ${log.meal || "N/A"}</td>
      <td>${timingDisplay || "N/A"}</td>
      <td style="text-align: left;">${log.scheduledTime || "N/A"}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(row);
  });
}

function getPageSize() {
  const select = document.getElementById("rowsPerPage");
  const defaultSize = 10;
  if (!select) return defaultSize;

  const value = parseInt(select.value, 10);
  return Number.isNaN(value) || value <= 0 ? defaultSize : value;
}

function renderCurrentPage() {
  const pageSize = getPageSize();
  const totalRecords = Array.isArray(filteredDoseLogs) ? filteredDoseLogs.length : 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  if (currentPage < 1) {
    currentPage = 1;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageLogs = (filteredDoseLogs || []).slice(startIndex, endIndex);

  renderDoseLogs(pageLogs);

  const info = document.getElementById("paginationInfo");
  if (info) {
    info.textContent = `Page ${currentPage} of ${totalPages} (${totalRecords} records)`;
  }

  const prevBtn = document.getElementById("prevPageButton");
  const nextBtn = document.getElementById("nextPageButton");

  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
}

function changeRowsPerPage() {
  currentPage = 1;
  renderCurrentPage();
}

function goToPrevPage() {
  if (currentPage > 1) {
    currentPage -= 1;
    renderCurrentPage();
  }
}

function goToNextPage() {
  const pageSize = getPageSize();
  const totalRecords = Array.isArray(filteredDoseLogs) ? filteredDoseLogs.length : 0;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;

  if (currentPage < totalPages) {
    currentPage += 1;
    renderCurrentPage();
  }
}

async function loadDoseLogs() {
  const role = (window.Auth && window.Auth.getStoredRole && window.Auth.getStoredRole()) || "patient";

  // Patient view: fetch own history directly (no device selector dependency)
  if (role === "patient" && Auth.isAuthenticated()) {
    const myPatient = Array.isArray(window.allPatients) && window.allPatients.length > 0
      ? window.allPatients[0]
      : null;
    const hasActiveDevice = Boolean(myPatient && myPatient.deviceId && myPatient.deviceActive);
    doseHistoryEmptyMessage = hasActiveDevice
      ? "No dose history found yet."
      : "No linked active device found. Ask your caregiver to link and enable your device.";

    try {
      const logs = await Auth.apiFetch("/api/dose-log/my");
      allDoseLogs = Array.isArray(logs) ? logs : [];
      filteredDoseLogs = allDoseLogs.slice();
      currentPage = 1;
      renderCurrentPage();
      return;
    } catch (err) {
      if (err.status === 401) {
        Auth.redirectToLogin();
      } else {
        console.error("Failed to load patient dose logs", err);
        allDoseLogs = [];
        filteredDoseLogs = [];
        renderCurrentPage();
      }
      return;
    }
  }

  // Caregiver (or fallback): use selected/active device ID
  doseHistoryEmptyMessage = "No dose history found for selected filters";
  const activeDeviceId = getActiveDeviceId();
  if (!activeDeviceId) {
    allDoseLogs = [];
    filteredDoseLogs = [];
    renderCurrentPage();
    return;
  }

  try {
    const logs = await Auth.apiFetch(`/api/dose-log?deviceId=${activeDeviceId}`);
    allDoseLogs = Array.isArray(logs) ? logs : [];
    filteredDoseLogs = allDoseLogs.slice();
    currentPage = 1;
    renderCurrentPage();
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      console.error("Failed to load dose logs", err);
      allDoseLogs = [];
      filteredDoseLogs = [];
      renderCurrentPage();
    }
  }
}

// ---------------- FILTER CONTROLS FOR DOSE HISTORY ----------------
function toggleFilterPanel() {
  const panel = document.getElementById("filterPanel");
  if (!panel) return;
  panel.classList.toggle("active");
}

function applyFilters() {
  if (!Array.isArray(allDoseLogs)) return;

  const fromInput = document.getElementById("filterDateFrom");
  const toInput = document.getElementById("filterDateTo");

  const fromVal = fromInput?.value || "";
  const toVal = toInput?.value || "";

  const mealMorning = document.getElementById("filterMealMorning")?.checked;
  const mealAfternoon = document.getElementById("filterMealAfternoon")?.checked;
  const mealNight = document.getElementById("filterMealNight")?.checked;

  const timingBefore = document.getElementById("filterTimingBefore")?.checked;
  const timingAfter = document.getElementById("filterTimingAfter")?.checked;

  const statusTaken = document.getElementById("filterStatusTaken")?.checked;
  const statusMissed = document.getElementById("filterStatusMissed")?.checked;

  const filtered = allDoseLogs.filter(log => {
    // Date filter: log.date is assumed to be in YYYY-MM-DD or compatible format
    if (fromVal && log.date < fromVal) {
      return false;
    }
    if (toVal && log.date > toVal) {
      return false;
    }

    // Meal filter
    if (log.meal === "morning" && !mealMorning) return false;
    if (log.meal === "afternoon" && !mealAfternoon) return false;
    if (log.meal === "night" && !mealNight) return false;

    // Timing filter
    if (log.timing === "before" && !timingBefore) return false;
    if (log.timing === "after" && !timingAfter) return false;

    // Status filter
    if (log.status === "taken" && !statusTaken) return false;
    if (log.status === "missed" && !statusMissed) return false;

    return true;
  });

  filteredDoseLogs = filtered;
  currentPage = 1;
  renderCurrentPage();
}

function clearFilters() {
  const fromInput = document.getElementById("filterDateFrom");
  const toInput = document.getElementById("filterDateTo");

  if (fromInput) fromInput.value = "";
  if (toInput) toInput.value = "";

  const checkIds = [
    "filterMealMorning",
    "filterMealAfternoon",
    "filterMealNight",
    "filterTimingBefore",
    "filterTimingAfter",
    "filterStatusTaken",
    "filterStatusMissed"
  ];

  checkIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = true;
  });

  filteredDoseLogs = allDoseLogs.slice();
  currentPage = 1;
  renderCurrentPage();
}

// ---------------- NAVIGATION SCROLL FUNCTION ----------------
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    const navbarHeight = 70; // Height of fixed navbar
    const sectionPosition = section.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = sectionPosition - navbarHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}
// Expose globally for onclick handlers
window.scrollToSection = scrollToSection;

// ---------------- ROLE-BASED UI ----------------
function applyRoleUi() {
  if (!window.Auth || !window.Auth.getStoredRole) return;
  const role = window.Auth.getStoredRole() || "patient";
  const isPatient = role === "patient";

  // Navbar: Hide Patients and Devices links for patients
  const navPatients = document.getElementById("navPatients");
  const navDevices = document.getElementById("navDevices");
  if (navPatients) navPatients.style.display = isPatient ? "none" : "";
  if (navDevices) navDevices.style.display = isPatient ? "none" : "";

  // Sections: Hide Patient Management and Device Management for patients
  const patientsSection = document.getElementById("patients");
  const devicesSection = document.getElementById("devices");
  if (patientsSection) patientsSection.style.display = isPatient ? "none" : "";
  if (devicesSection) devicesSection.style.display = isPatient ? "none" : "";

  // Show Patient Info card for patients
  const patientInfoSection = document.getElementById("patientInfo");
  if (patientInfoSection) {
    patientInfoSection.style.display = isPatient ? "" : "none";
    if (isPatient) {
      renderPatientInfo();
    }
  }

  // Show device selector for caregivers only
  const deviceSelectorSection = document.getElementById("deviceSelectorSection");
  if (deviceSelectorSection) {
    deviceSelectorSection.style.display = isPatient ? "none" : "";
    if (!isPatient) {
      populateDeviceSelector();
      if (window.populateManualDeviceSelector) {
        window.populateManualDeviceSelector();
      }
    }
  }

  toggleSetTimeAccess(isPatient);
}

function toggleSetTimeAccess(isPatient) {
  const setTimeSection = document.getElementById("set-time");
  if (!setTimeSection) return;

  const controls = setTimeSection.querySelectorAll("input, select, button, textarea");
  controls.forEach((control) => {
    const tag = control.tagName.toLowerCase();

    if (tag === "input" && control.type === "time") {
      control.readOnly = isPatient;
      control.disabled = isPatient;
      return;
    }

    control.disabled = isPatient;
  });

  if (isPatient) {
    setTimeSection.setAttribute("aria-disabled", "true");
    setTimeSection.title = "Only caregivers can edit dose times";
  } else {
    setTimeSection.removeAttribute("aria-disabled");
    setTimeSection.removeAttribute("title");
  }
}

// Render patient info card (for patient role)
function renderPatientInfo() {
  const container = document.getElementById("patientInfoContent");
  if (!container) return;

  // Get patient's own record
  const patient = window.allPatients && window.allPatients.length > 0 
    ? window.allPatients[0] 
    : null;

  if (!patient) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-text">No patient information found.</div>
      </div>
    `;
    return;
  }

  // Device status badge (Active/Inactive)
  const deviceStatus = patient.deviceId 
    ? `<span class="badge ${patient.deviceActive ? 'badge-success' : 'badge-info'}">${patient.deviceActive ? 'Device Active' : 'Device Inactive'}</span>`
    : '<span class="badge badge-info">No Device Linked</span>';

  // Online/Offline status badge (only if device is linked and active)
  let onlineStatusBadge = '';
  if (patient.deviceId && patient.deviceActive) {
    const isOnline = patient.deviceOnline === true;
    onlineStatusBadge = `<span class="badge ${isOnline ? 'badge-success' : 'badge-error'}" style="margin-left: 8px;" title="${isOnline ? 'Device is online' : 'Device is offline'}">
      ${isOnline ? '🟢 Online' : '🔴 Offline'}
    </span>`;
  }

  container.innerHTML = `
    <div class="patient-card" style="border: 1px solid var(--alabaster-grey); border-radius: var(--radius-md); padding: var(--spacing-md); background: var(--bg-card);">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-sm);">
        <div>
          <h3 style="margin: 0 0 var(--spacing-xs) 0; color: var(--prussian-blue);">${escapeHtml(patient.name || 'Unnamed')}</h3>
          ${patient.age ? `<p style="margin: 0; color: var(--text-secondary); font-size: 14px;">Age: ${patient.age}</p>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          ${deviceStatus}
          ${onlineStatusBadge}
        </div>
      </div>
      ${patient.caregiverName ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;"><strong>Caregiver:</strong> ${escapeHtml(patient.caregiverName)}</p>` : ''}
      ${patient.caregiverPhone ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;"><strong>Caregiver Phone:</strong> ${escapeHtml(patient.caregiverPhone)}</p>` : ''}
      ${patient.deviceId ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;"><strong>Device ID:</strong> <code style="background: var(--alabaster-grey); padding: 2px 6px; border-radius: 4px;">${escapeHtml(patient.deviceId)}</code></p>` : '<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;">No device linked yet. Contact your caregiver to link a device.</p>'}
      ${onlineStatusBadge ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;"><strong>Device Status:</strong> ${onlineStatusBadge}</p>` : ''}
    </div>
  `;
}

// Helper function for HTML escaping (if not already available)
function escapeHtml(text) {
  if (typeof text === 'undefined' || text === null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose renderPatientInfo globally so it can be called from patient.js
window.renderPatientInfo = renderPatientInfo;

// ---------------- DEVICE SELECTOR (for caregivers) ----------------
function populateDeviceSelector() {
  const selector = document.getElementById("deviceSelector");
  if (!selector) return;

  // Clear existing options except the first placeholder
  selector.innerHTML = '<option value="">Select a patient...</option>';

  if (!window.allPatients || window.allPatients.length === 0) {
    selector.innerHTML += '<option value="" disabled>No patients with devices found</option>';
    window.selectedDeviceId = null;
    localStorage.removeItem("selectedDeviceId");
    return;
  }

  // Add options for each patient with a linked device
  const patientsWithDevices = window.allPatients.filter(p => p.deviceId && p.deviceActive);
  
  if (patientsWithDevices.length === 0) {
    selector.innerHTML += '<option value="" disabled>No active devices found</option>';
    window.selectedDeviceId = null;
    localStorage.removeItem("selectedDeviceId");
    return;
  }

  patientsWithDevices.forEach(patient => {
    const option = document.createElement("option");
    option.value = patient.deviceId;
    option.textContent = `${patient.name || 'Unnamed'} – ${patient.deviceId}`;
    selector.appendChild(option);
  });

  // Restore saved selection or auto-select first device
  const savedDeviceId = localStorage.getItem("selectedDeviceId");
  if (savedDeviceId && patientsWithDevices.find(p => p.deviceId === savedDeviceId)) {
    // Restore saved selection if it still exists
    window.selectedDeviceId = savedDeviceId;
    selector.value = savedDeviceId;
  } else if (!window.selectedDeviceId && patientsWithDevices.length > 0) {
    // Auto-select first device if no selection
    window.selectedDeviceId = patientsWithDevices[0].deviceId;
    selector.value = window.selectedDeviceId;
    localStorage.setItem("selectedDeviceId", window.selectedDeviceId);
  } else if (window.selectedDeviceId) {
    // Check if current selection is still valid
    const stillValid = patientsWithDevices.find(p => p.deviceId === window.selectedDeviceId);
    if (stillValid) {
      selector.value = window.selectedDeviceId;
    } else {
      // Current selection is invalid, reset to first
      window.selectedDeviceId = patientsWithDevices[0].deviceId;
      selector.value = window.selectedDeviceId;
      localStorage.setItem("selectedDeviceId", window.selectedDeviceId);
    }
  }
}

function handleDeviceSelectionChange() {
  const selector = document.getElementById("deviceSelector");
  if (!selector) return;

  const newDeviceId = selector.value || null;
  window.selectedDeviceId = newDeviceId;

  // Keep manual device dropdown in sync (caregiver device management)
  const manualSelector = document.getElementById("manualDeviceSelector");
  if (manualSelector) {
    manualSelector.value = newDeviceId || "";
  }
  
  // Persist selection in localStorage
  if (newDeviceId) {
    localStorage.setItem("selectedDeviceId", newDeviceId);
  } else {
    localStorage.removeItem("selectedDeviceId");
  }

  // Reload dose times and history for the selected device
  if (newDeviceId) {
    loadSavedDoseTimes();
    loadDoseLogs();
    updateSetTimeHeader();
  } else {
    // Clear if no device selected
    allDoseLogs = [];
    filteredDoseLogs = [];
    renderCurrentPage();
    updateSetTimeHeader();
  }
}

// Update Set Time card header to show selected device
function updateSetTimeHeader() {
  const header = document.querySelector("#set-time .card-title");
  if (!header) return;
  
  const deviceId = getActiveDeviceId();
  if (deviceId && window.allPatients) {
    const patient = window.allPatients.find(p => p.deviceId === deviceId);
    if (patient) {
      const originalText = header.innerHTML;
      // Check if we already added device info
      if (!originalText.includes("device-info")) {
        const deviceInfo = document.createElement("span");
        deviceInfo.className = "device-info";
        deviceInfo.style.cssText = "font-size: 0.85em; font-weight: normal; color: var(--text-secondary); margin-left: 10px;";
        deviceInfo.textContent = `(${patient.name || 'Unnamed'} – ${deviceId})`;
        header.appendChild(deviceInfo);
      } else {
        // Update existing device info
        const existingInfo = header.querySelector(".device-info");
        if (existingInfo) {
          existingInfo.textContent = `(${patient.name || 'Unnamed'} – ${deviceId})`;
        }
      }
    }
  } else {
    // Remove device info if no device selected
    const deviceInfo = header.querySelector(".device-info");
    if (deviceInfo) {
      deviceInfo.remove();
    }
  }
}

// Expose globally
window.populateDeviceSelector = populateDeviceSelector;
window.handleDeviceSelectionChange = handleDeviceSelectionChange;
window.updateSetTimeHeader = updateSetTimeHeader;

// ---------------- AUTH LINK (LOGIN/LOGOUT) ----------------
function initAuthLink() {
  const link = document.getElementById("authLink");
  if (!link) return;
  
  // Wait for Auth to be available
  if (!window.Auth) {
    setTimeout(initAuthLink, 100);
    return;
  }

  if (window.Auth.isAuthenticated()) {
    const name = window.Auth.getStoredName ? window.Auth.getStoredName() : null;
    const email = window.Auth.getStoredEmail ? window.Auth.getStoredEmail() : null;
    const label = name || email;
    link.textContent = label ? `Logout (${label})` : "Logout";
    link.href = "#";
    link.onclick = (e) => {
      e.preventDefault();
      window.Auth.logoutAndRedirect();
    };
  } else {
    link.textContent = "Login";
    link.href = "login.html?returnTo=index.html";
    link.onclick = null;
  }
}

// On initial load
initRepeatControls();
loadSavedRepeatOptions();
loadSavedDoseTimes();

// Apply role-based UI slightly after Auth is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      initAuthLink();
      applyRoleUi();
    }, 100);
  });
} else {
  setTimeout(() => {
    initAuthLink();
    applyRoleUi();
  }, 100);
}

// Load patients first, then logs (so we can get deviceId)
if (Auth.isAuthenticated()) {
  // Restore selected device from localStorage (for caregivers)
  const savedDeviceId = localStorage.getItem("selectedDeviceId");
  if (savedDeviceId) {
    window.selectedDeviceId = savedDeviceId;
  }
  
  loadPatients().then(() => {
    loadDoseLogs();
    // Re-apply role UI after patients are loaded (to show patient info card)
    setTimeout(() => {
      applyRoleUi();
      updateSetTimeHeader();
    }, 100);
  });

  // Periodically refresh patient data to update online/offline status (every 30 seconds)
  setInterval(() => {
    if (Auth.isAuthenticated()) {
      loadPatients();
    }
  }, 30000);
} else {
  // If not authenticated, still try to load logs (for backward compatibility)
  loadDoseLogs();
}