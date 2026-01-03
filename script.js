// API Configuration
// After deployment: Update window.API_URL in index.html with your Render backend URL
// Format: https://your-backend.onrender.com
const BASE_URL = window.API_URL || "http://localhost:5000";

const DEVICE_ID = "DEVICE_001";

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
  const data = {
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
    await fetch(`${BASE_URL}/api/dose-time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (showAlert) {
      showToast(alertMessage, "success");
    }
  } catch (err) {
    console.error("Failed to save dose times", err);
    showToast("Failed to save dose times", "error");
  }
}

// ---------------- LOAD SAVED DOSE TIMES INTO INPUTS ----------------
function loadSavedDoseTimes() {
  const stored = localStorage.getItem("doseTimes");
  if (!stored) return;

  try {
    const data = JSON.parse(stored);

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
  } catch (e) {
    console.error("Failed to load saved dose times", e);
  }
}

// ---------------- UPDATE / DELETE SINGLE DOSE TIME ----------------
function updateDoseTime(meal, timing) {
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
        <div class="empty-state-text">No dose history found for selected filters</div>
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
  const res = await fetch(`${BASE_URL}/api/dose-log?deviceId=${DEVICE_ID}`);
  const logs = await res.json();

  allDoseLogs = Array.isArray(logs) ? logs : [];
  filteredDoseLogs = allDoseLogs.slice();
  currentPage = 1;
  renderCurrentPage();
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

// On initial load, set up repeat controls, populate saved dose times and load logs
initRepeatControls();
loadSavedRepeatOptions();
loadSavedDoseTimes();
loadDoseLogs();
