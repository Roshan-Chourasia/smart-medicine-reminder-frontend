// Device Management Functions

function openLinkDeviceModal(patientId) {
  if (!Auth.isAuthenticated()) {
    Auth.redirectToLogin();
    return;
  }
  const modal = document.getElementById('linkDeviceModal');
  const patientIdInput = document.getElementById('linkPatientId');
  if (modal && patientIdInput) {
    patientIdInput.value = patientId;
    modal.style.display = 'flex';
  }
}

function closeLinkDeviceModal() {
  const modal = document.getElementById('linkDeviceModal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('linkDeviceForm').reset();
  }
}

async function handleLinkDevice(event) {
  event.preventDefault();
  
  try {
    const patientId = document.getElementById('linkPatientId').value;
    const deviceId = document.getElementById('deviceIdInput').value.trim();

    if (!patientId || !deviceId) {
      showToast('Patient ID and Device ID are required', 'error');
      return;
    }

    await Auth.apiFetch('/api/device/link', {
      method: 'POST',
      body: { patientId, deviceId }
    });

    showToast('Device linked successfully', 'success');
    closeLinkDeviceModal();
    await loadPatients(); // Reload to show updated device status
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast('Failed to link device: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

async function handleDeviceAction(patientId, action) {
  try {
    let endpoint = '';
    let successMessage = '';

    switch (action) {
      case 'enable':
        endpoint = '/api/device/enable';
        successMessage = 'Device enabled successfully';
        break;
      case 'disable':
        endpoint = '/api/device/disable';
        successMessage = 'Device disabled successfully';
        break;
      case 'unlink':
        if (!confirm('Are you sure you want to unlink this device? The patient will need to link a device again to use the system.')) {
          return;
        }
        endpoint = '/api/device/unlink';
        successMessage = 'Device unlinked successfully';
        break;
      default:
        showToast('Invalid action', 'error');
        return;
    }

    await Auth.apiFetch(endpoint, {
      method: 'POST',
      body: { patientId }
    });

    showToast(successMessage, 'success');
    await loadPatients(); // Reload to show updated status
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast('Failed to ' + action + ' device: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

// Get active device ID from patients (for use in schedule/logs)
function getActiveDeviceId() {
  // If a device is explicitly selected (for caregivers), use that
  if (window.selectedDeviceId) {
    // Verify the selected device still exists and is active
    const selectedPatient = window.allPatients && window.allPatients.find(p => p.deviceId === window.selectedDeviceId && p.deviceActive);
    if (selectedPatient) {
      return window.selectedDeviceId;
    }
    // If selected device is no longer valid, clear selection
    window.selectedDeviceId = null;
    if (window.deviceSelector) {
      window.deviceSelector.value = '';
    }
  }
  
  // Fallback: find first active device (for patients or when no selection)
  if (typeof window.allPatients === 'undefined' || !window.allPatients || window.allPatients.length === 0) {
    return null;
  }
  const activePatient = window.allPatients.find(p => p.deviceId && p.deviceActive);
  return activePatient ? activePatient.deviceId : null;
}

// Populate manual control device dropdown (caregiver only)
function populateManualDeviceSelector() {
  const selector = document.getElementById("manualDeviceSelector");
  if (!selector) return;

  // Preserve current selection if it's still valid
  const currentValue = selector.value;
  selector.innerHTML = '<option value="">Select a device...</option>';

  if (!window.allPatients || window.allPatients.length === 0) {
    selector.innerHTML += '<option value="" disabled>No patients available</option>';
    return;
  }

  const patientsWithActiveDevices = window.allPatients.filter(p => p.deviceId && p.deviceActive);
  if (patientsWithActiveDevices.length === 0) {
    selector.innerHTML += '<option value="" disabled>No active devices found</option>';
    return;
  }

  patientsWithActiveDevices.forEach(patient => {
    const option = document.createElement("option");
    option.value = patient.deviceId;
    const status = patient.deviceOnline === true ? "Online" : "Offline";
    option.textContent = `${patient.name || "Unnamed"} – ${patient.deviceId} (${status})`;
    selector.appendChild(option);
  });

  // Prefer current manual selection if it's still present
  if (currentValue && patientsWithActiveDevices.find(p => p.deviceId === currentValue)) {
    selector.value = currentValue;
  }
  // Otherwise prefer current history-selected device if available
  else if (window.selectedDeviceId && patientsWithActiveDevices.find(p => p.deviceId === window.selectedDeviceId)) {
    selector.value = window.selectedDeviceId;
  } else if (!selector.value) {
    // Otherwise auto-select the first device
    selector.value = patientsWithActiveDevices[0].deviceId;
  }
}

async function sendManualCommand(action) {
  try {
    if (!Auth.isAuthenticated()) {
      Auth.redirectToLogin();
      return;
    }

    const deviceId = document.getElementById("manualDeviceSelector")?.value;
    const slot = document.getElementById("manualSlotSelector")?.value;

    if (!deviceId) {
      showToast("Please select a device first", "warning");
      return;
    }
    if (!slot) {
      showToast("Please select a slot first", "warning");
      return;
    }
    if (action !== "open" && action !== "close") {
      showToast("Invalid action", "error");
      return;
    }

    await Auth.apiFetch("/api/device/manual-command", {
      method: "POST",
      body: { deviceId, slot, action }
    });

    showToast(`Command sent: ${action.toUpperCase()} (${slot})`, "success");
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast("Failed to send command: " + (err.message || "Unknown error"), "error");
    }
  }
}

// Expose functions globally
window.openLinkDeviceModal = openLinkDeviceModal;
window.closeLinkDeviceModal = closeLinkDeviceModal;
window.handleLinkDevice = handleLinkDevice;
window.handleDeviceAction = handleDeviceAction;
window.getActiveDeviceId = getActiveDeviceId;
window.populateManualDeviceSelector = populateManualDeviceSelector;
window.sendManualCommand = sendManualCommand;
