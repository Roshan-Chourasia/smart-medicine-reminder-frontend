// Patient Management Functions
let allPatients = [];
// Expose globally for device.js
window.allPatients = allPatients;

async function loadPatients() {
  try {
    if (!Auth.isAuthenticated()) {
      Auth.redirectToLogin();
      return;
    }

    const patients = await Auth.apiFetch('/api/patient');
    allPatients = Array.isArray(patients) ? patients : [];
    window.allPatients = allPatients; // Update global reference
    renderPatients();
    
    // If patient role, update patient info card
    const role = (window.Auth && window.Auth.getStoredRole && window.Auth.getStoredRole()) || 'patient';
    if (role === 'patient' && window.renderPatientInfo) {
      window.renderPatientInfo();
    }
    
    // If caregiver role, update device selector
    if (role !== 'patient' && window.populateDeviceSelector) {
      window.populateDeviceSelector();
      if (window.populateManualDeviceSelector) {
        window.populateManualDeviceSelector();
      }
      // Auto-select first device if none selected
      if (!window.selectedDeviceId && allPatients.length > 0) {
        const firstWithDevice = allPatients.find(p => p.deviceId && p.deviceActive);
        if (firstWithDevice) {
          window.selectedDeviceId = firstWithDevice.deviceId;
          const selector = document.getElementById("deviceSelector");
          if (selector) selector.value = window.selectedDeviceId;
        }
      }
    }
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast('Failed to load patients: ' + (err.message || 'Unknown error'), 'error');
      allPatients = [];
      renderPatients();
    }
  }
}

function renderPatients() {
  const container = document.getElementById('patientsList');
  if (!container) return;

  const role = (window.Auth && window.Auth.getStoredRole && window.Auth.getStoredRole()) || 'patient';
  const isCaregiver = role === 'caregiver';

  if (allPatients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-text">No patients found. Create your first patient to get started.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = allPatients.map(patient => {
    // Device status badge (Active/Inactive)
    const deviceStatus = patient.deviceId 
      ? `<span class="badge ${patient.deviceActive ? 'badge-success' : 'badge-info'}">${patient.deviceActive ? 'Active' : 'Inactive'}</span>`
      : '<span class="badge badge-info">No Device</span>';

    // Online/Offline status badge (only if device is linked and active)
    let onlineStatusBadge = '';
    if (patient.deviceId && patient.deviceActive) {
      const isOnline = patient.deviceOnline === true;
      onlineStatusBadge = `<span class="badge ${isOnline ? 'badge-success' : 'badge-error'}" style="margin-left: 8px;" title="${isOnline ? 'Device is online' : 'Device is offline'}">
        ${isOnline ? '🟢 Online' : '🔴 Offline'}
      </span>`;
    }

    return `
      <div class="patient-card" style="border: 1px solid var(--alabaster-grey); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-md); background: var(--bg-card);">
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
        ${patient.caregiverName ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;">Caregiver: ${escapeHtml(patient.caregiverName)}</p>` : ''}
        ${patient.deviceId ? `<p style="margin: var(--spacing-xs) 0; color: var(--text-secondary); font-size: 14px;">Device: <strong>${escapeHtml(patient.deviceId)}</strong></p>` : ''}
        ${
          isCaregiver
            ? `<div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md); flex-wrap: wrap;">
                ${
                  !patient.deviceId
                    ? `<button onclick="openLinkDeviceModal('${patient._id}')" class="btn btn-primary" style="font-size: 13px;">Link Device</button>`
                    : ''
                }
                ${
                  patient.deviceId
                    ? `
                      <button onclick="handleDeviceAction('${patient._id}', 'enable')" class="btn btn-primary" style="font-size: 13px;" ${patient.deviceActive ? 'disabled' : ''}>Enable</button>
                      <button onclick="handleDeviceAction('${patient._id}', 'disable')" class="btn btn-secondary" style="font-size: 13px;" ${!patient.deviceActive ? 'disabled' : ''}>Disable</button>
                      <button onclick="handleDeviceAction('${patient._id}', 'unlink')" class="btn btn-danger" style="font-size: 13px;">Unlink</button>
                    `
                    : ''
                }
                <button onclick="deletePatient('${patient._id}')" class="btn btn-danger" style="font-size: 13px;">Delete</button>
              </div>`
            : ''
        }
      </div>
    `;
  }).join('');
}

function showCreatePatientModal() {
  if (!Auth.isAuthenticated()) {
    Auth.redirectToLogin();
    return;
  }
  const modal = document.getElementById('createPatientModal');
  if (modal) modal.style.display = 'flex';
}

function closeCreatePatientModal() {
  const modal = document.getElementById('createPatientModal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('createPatientForm').reset();
  }
}

async function handleCreatePatient(event) {
  event.preventDefault();
  
  try {
    const name = document.getElementById('patientName').value.trim();
    const age = document.getElementById('patientAge').value ? parseInt(document.getElementById('patientAge').value) : null;
    const caregiverName = document.getElementById('caregiverName').value.trim() || null;
    const caregiverPhone = document.getElementById('caregiverPhone').value.trim() || null;
    const caregiverEmailEl = document.getElementById('caregiverEmail');
    const caregiverEmail = caregiverEmailEl ? caregiverEmailEl.value.trim() : null;
    const patientEmailEl = document.getElementById('patientEmail');
    const patientEmail = patientEmailEl ? patientEmailEl.value.trim() : null;

    if (!name) {
      showToast('Patient name is required', 'error');
      return;
    }

    if (!patientEmail) {
      showToast('Patient email is required', 'error');
      return;
    }

    const patientData = { name };
    if (age) patientData.age = age;
    if (caregiverName) patientData.caregiverName = caregiverName;
    if (caregiverPhone) patientData.caregiverPhone = caregiverPhone;
    if (caregiverEmail) patientData.caregiverEmail = caregiverEmail;
    if (patientEmail) patientData.patientEmail = patientEmail;

    await Auth.apiFetch('/api/patient', {
      method: 'POST',
      body: patientData
    });

    showToast('Patient created successfully', 'success');
    closeCreatePatientModal();
    await loadPatients();
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast('Failed to create patient: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

async function deletePatient(patientId) {
  if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
    return;
  }

  try {
    await Auth.apiFetch(`/api/patient/${patientId}`, {
      method: 'DELETE'
    });

    showToast('Patient deleted successfully', 'success');
    await loadPatients();
  } catch (err) {
    if (err.status === 401) {
      Auth.redirectToLogin();
    } else {
      showToast('Failed to delete patient: ' + (err.message || 'Unknown error'), 'error');
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose functions globally
window.loadPatients = loadPatients;
window.showCreatePatientModal = showCreatePatientModal;
window.closeCreatePatientModal = closeCreatePatientModal;
window.handleCreatePatient = handleCreatePatient;
window.deletePatient = deletePatient;
