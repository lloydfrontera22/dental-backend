// Shared helpers for every admin page: auth guard, API calls, nav, today's date.

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// Every admin page calls this first. Redirects to login or onboarding as needed.
async function guardAdminPage() {
  try {
    const { user } = await api('/auth/me');
    if (!user.clinicId && !location.pathname.endsWith('onboarding.html')) {
      location.href = 'onboarding.html';
      return null;
    }
    document.querySelectorAll('[data-user-name]').forEach(el => (el.textContent = user.name));
    return user;
  } catch (_) {
    location.href = '../index.html';
    return null;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function renderSidebar(activeKey) {
  const links = [
    ['dashboard.html', 'dashboard', 'Dashboard'],
    ['registration.html', 'registration', 'Registration'],
    ['slots.html', 'slots', 'Slots'],
    ['doctors.html', 'doctors', 'Doctors'],
    ['patients.html', 'patients', 'Patients'],
    ['api.html', 'api', 'API'],
    ['settings.html', 'settings', 'Settings']
  ];
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  nav.innerHTML = links.map(([href, key, label]) =>
    `<a class="nav-link${key === activeKey ? ' is-active' : ''}" href="${href}">${label}</a>`
  ).join('');
}

document.addEventListener('click', event => {
  const btn = event.target.closest('#logout-btn');
  if (!btn) return;
  api('/auth/logout', { method: 'POST' }).finally(() => (location.href = '../index.html'));
});
// ===================================
// NEW: SLOT STATUS & MANAGEMENT CODE
// ===================================

// Fetch and display slot status
async function fetchAndDisplaySlotStatus() {
  try {
    const { rules } = await api('/slots/rules');
    const { bookings } = await api('/bookings/today');

    const slotRules = (rules && rules.length) ? rules : [
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '16:00' }
    ];

    slotRules.forEach((slot, index) => {
      const bookedCount = bookings.filter(b => b.startTime === slot.startTime).length;
      const totalSlots = 1;
      const isBooked = bookedCount >= totalSlots;

      const timeEl = document.getElementById(`slot-${index}-time`);
      if (timeEl) timeEl.textContent = `${slot.startTime} - ${slot.endTime}`;

      const statusEl = document.getElementById(`slot-${index}-status`);
      if (statusEl) {
        statusEl.textContent = isBooked
          ? `${bookedCount}/${totalSlots} BOOKED 🔴`
          : `${bookedCount}/${totalSlots} AVAILABLE 🟢`;
        statusEl.style.color = isBooked ? '#f44336' : '#4CAF50';
        statusEl.style.fontWeight = 'bold';
      }

      const barEl = document.getElementById(`slot-${index}-bar`);
      if (barEl) {
        barEl.style.width = (bookedCount / totalSlots) * 100 + '%';
        barEl.style.backgroundColor = isBooked ? '#f44336' : '#4CAF50';
      }
    });
  } catch (error) {
    console.error('Error fetching slot status:', error);
  }
}

// Edit slot times
async function openEditSlotsDialog() {
  try {
    const { rules } = await api('/slots/rules');
    const slots = (rules && rules.length) ? rules : [
      { startTime: '10:00', endTime: '12:00', daysOfWeek: [1,2,3,4,5], slotDurationMinutes: 30 },
      { startTime: '14:00', endTime: '16:00', daysOfWeek: [1,2,3,4,5], slotDurationMinutes: 30 }
    ];

    let updatedSlots = slots.map(s => ({ ...s })); // preserve daysOfWeek/slotDurationMinutes
    let editMore = true;
    let slotIndex = 0;

    while (editMore && slotIndex < updatedSlots.length) {
      const slot = updatedSlots[slotIndex];
      const startTime = prompt(`Slot ${slotIndex + 1} start time (HH:MM)`, slot.startTime);
      if (startTime === null) break;

      const endTime = prompt(`Slot ${slotIndex + 1} end time (HH:MM)`, slot.endTime);
      if (endTime === null) break;

      updatedSlots[slotIndex] = { ...slot, startTime, endTime };

      slotIndex++;
      if (slotIndex < updatedSlots.length) {
        editMore = confirm('Edit next slot?');
      }
    }

    if (slotIndex > 0) {
      await api('/slots/rules', { method: 'PUT', body: { rules: updatedSlots } });
      alert('✓ Slots updated successfully!');
      fetchAndDisplaySlotStatus();
    }
  } catch (error) {
    console.error('Error editing slots:', error);
    alert('Error: ' + error.message);
  }
}  
  (async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('dashboard');
  try {
    const s = await api('/dashboard/summary');
    document.getElementById('clinic-name').textContent = s.clinic.name;
    document.getElementById('c-today').textContent = s.todayAppointmentCount;
    document.getElementById('c-patients').textContent = s.activePatients;
    document.getElementById('c-doctors').textContent = s.doctorCount;

    const { bookings } = await api('/bookings/today');
    const rows = document.getElementById('today-rows');
    rows.innerHTML = bookings.length ? bookings.map(b => `
      <tr><td>${b.startTime}–${b.endTime}</td><td>${b.patientName}</td><td>${b.patientPhone}</td>
      <td>${b.source}</td><td><span class="badge ${b.status}">${b.status}</span></td></tr>`).join('')
      : '<tr><td colspan="5" class="muted">No bookings yet today.</td></tr>';
  } catch (err) { console.error(err); }
})();


// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.getElementById('edit-slots-btn');
  if (editBtn) {
    editBtn.addEventListener('click', openEditSlotsDialog);
  }
});

// Auto-refresh slot status every 5 seconds
setInterval(() => {
  fetchAndDisplaySlotStatus();
}, 5000);

// Initial load
fetchAndDisplaySlotStatus();
