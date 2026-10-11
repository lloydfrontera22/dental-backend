// ===================================
// SLOT STATUS & MANAGEMENT
// ===================================

async function fetchAndDisplaySlotStatus() {
  const container = document.getElementById('slots-container');
  try {
    const { rules } = await api('/slots/rules');
    const { bookings } = await api('/bookings/today');

    const slotRules = (rules && rules.length) ? rules : [
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '16:00' }
    ];

    const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    container.innerHTML = slotRules.map(slot => {
      // A rule like 10:00-12:00 with 30-minute slots is 4 bookable slots, not 1.
      const span = toMin(slot.endTime) - toMin(slot.startTime);
      const totalSlots = Math.max(1, slot.slotDurationMinutes ? Math.floor(span / slot.slotDurationMinutes) : 1);
      const bookedCount = bookings.filter(b => b.status === 'booked'
        && toMin(b.startTime) >= toMin(slot.startTime) && toMin(b.startTime) < toMin(slot.endTime)).length;
      const isBooked = bookedCount >= totalSlots;
      const free = Math.max(0, totalSlots - bookedCount);
      const statusText = isBooked
        ? `FULL 🔴`
        : `${free}/${totalSlots} AVAILABLE 🟢`;
      const color = isBooked ? '#f44336' : '#4CAF50';
      const width = Math.min(100, (bookedCount / totalSlots) * 100);

      return `<div class="slot-card">
        <div style="display: flex; justify-content: space-between;">
          <span class="slot-time">${slot.startTime} - ${slot.endTime}</span>
          <span class="slot-status" style="color:${color};font-weight:bold">${statusText}</span>
        </div>
        <div class="slot-progress">
          <div class="slot-progress-bar" style="width:${width}%;background-color:${color}"></div>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    console.error('Error fetching slot status:', error);
    container.innerHTML = '<span class="status error">Could not load slots.</span>';
  }
}

async function openEditSlotsDialog() {
  try {
    const { rules } = await api('/slots/rules');
    const slots = (rules && rules.length) ? rules : [
      { startTime: '10:00', endTime: '12:00', daysOfWeek: [1,2,3,4,5], slotDurationMinutes: 30 },
      { startTime: '14:00', endTime: '16:00', daysOfWeek: [1,2,3,4,5], slotDurationMinutes: 30 }
    ];

    let updatedSlots = slots.map(s => ({ ...s }));
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

// ===================================
// MAIN DASHBOARD LOAD
// ===================================

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadSummaryAndBookings() {
  try {
    const s = await api('/dashboard/summary');
    document.getElementById('clinic-name').textContent = s.clinic.name;
    document.getElementById('c-today').textContent = s.todayAppointmentCount;
    document.getElementById('c-patients').textContent = s.activePatients;
    document.getElementById('c-doctors').textContent = s.doctorCount;

    // Everything booked from today onward, so a WhatsApp booking for tomorrow shows up too.
    const { from, bookings } = await api('/bookings/upcoming');
    const rows = document.getElementById('today-rows');
    rows.innerHTML = bookings.length ? bookings.map(b => `
      <tr><td>${escapeHtml(b.date === from ? 'Today' : b.date)}</td>
      <td>${escapeHtml(b.startTime)}–${escapeHtml(b.endTime)}</td><td>${escapeHtml(b.patientName)}</td>
      <td>${escapeHtml(b.patientPhone)}</td><td>${escapeHtml(b.source)}</td>
      <td><span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">No upcoming bookings.</td></tr>';
  } catch (err) { console.error(err); }
}

(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('dashboard');
  await loadSummaryAndBookings();
  setInterval(loadSummaryAndBookings, 10000); // pick up bookings made through n8n without a manual refresh
})();

// ===================================
// EVENT LISTENERS
// ===================================

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