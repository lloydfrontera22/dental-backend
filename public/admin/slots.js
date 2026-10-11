const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let overridesCache = [];

function ruleRowHTML(rule = { daysOfWeek: [1,2,3,4,5], startTime: '10:00', endTime: '13:00', slotDurationMinutes: 30 }, idx) {
  const chips = DAYS.map((d, i) => `<button type="button" class="chip${rule.daysOfWeek.includes(i) ? ' is-selected' : ''}" data-day="${i}">${d}</button>`).join('');
  return `<div class="panel" style="background:var(--accent-pale);box-shadow:none" data-rule-idx="${idx}">
    <div class="chip-group" data-role="days">${chips}</div>
    <div class="row3" style="margin-top:12px">
      <div class="field"><label>Start</label><input type="time" data-role="start" value="${rule.startTime}"></div>
      <div class="field"><label>End</label><input type="time" data-role="end" value="${rule.endTime}"></div>
      <div class="field"><label>Slot length (mins)</label><input type="number" data-role="duration" value="${rule.slotDurationMinutes}" min="5" max="240"></div>
    </div>
    <button type="button" class="btn btn-danger btn-sm" data-role="remove">Remove rule</button>
  </div>`;
}

function readRulesFromDOM() {
  return [...document.querySelectorAll('[data-rule-idx]')].map(el => ({
    daysOfWeek: [...el.querySelectorAll('[data-day].is-selected')].map(c => Number(c.dataset.day)),
    startTime: el.querySelector('[data-role="start"]').value,
    endTime: el.querySelector('[data-role="end"]').value,
    slotDurationMinutes: Number(el.querySelector('[data-role="duration"]').value)
  }));
}

document.addEventListener('click', e => {
  const chip = e.target.closest('[data-day]');
  if (chip) chip.classList.toggle('is-selected');
  const removeBtn = e.target.closest('[data-role="remove"]');
  if (removeBtn) removeBtn.closest('[data-rule-idx]').remove();
});

async function loadGrid(date) {
  const grid = document.getElementById('slot-grid');
  const note = document.getElementById('grid-note');
  grid.innerHTML = '<span class="muted">Loading…</span>';
  try {
    const [{ slots }, { bookings }] = await Promise.all([
      api(`/slots/available?date=${date}`),
      api('/bookings/today').catch(() => ({ bookings: [] }))
    ]);
    const bookedTimes = new Set(bookings.filter(b => b.date === date && b.status === 'booked').map(b => b.startTime));
    if (!slots.length && !bookedTimes.size) {
      grid.innerHTML = ''; note.textContent = 'No slots configured for this date. Add a recurring pattern below.';
      return;
    }
    note.textContent = '';
    const merged = [...new Set([...slots.map(s => s.startTime), ...bookedTimes])].sort();
    grid.innerHTML = merged.map(t => {
      const isBooked = bookedTimes.has(t);
      return `<div class="slot ${isBooked ? 'booked' : 'open'}">${t}${isBooked ? ' · booked' : ''}</div>`;
    }).join('');
  } catch (err) { grid.innerHTML = `<span class="status error">${err.message}</span>`; }
}

async function loadRules() {
  const { rules } = await api('/slots/rules');
  const list = document.getElementById('rule-list');
  list.innerHTML = rules.length
    ? rules.map((r, i) => ruleRowHTML(r, i)).join('')
    : ruleRowHTML(undefined, 0);
}

async function loadOverrides() {
  const dateInput = document.getElementById('ov-date').value || todayISO();
  // We don't have a "list all overrides" endpoint yet; show what's cached from creation this session.
  const rows = document.getElementById('override-rows');
  rows.innerHTML = overridesCache.length ? overridesCache.map(o => `
    <tr><td>${o.date}</td><td>${o.type}</td><td>${o.startTime ? `${o.startTime}–${o.endTime}` : 'Whole day'}</td>
    <td>${o.reason || '—'}</td>
    <td><button class="btn btn-danger btn-sm" data-remove-override="${o._id}">Delete</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">No overrides added this session.</td></tr>';
}

document.addEventListener('click', async e => {
  const del = e.target.closest('[data-remove-override]');
  if (!del) return;
  try {
    await api(`/slots/${del.dataset.removeOverride}`, { method: 'DELETE' });
    overridesCache = overridesCache.filter(o => o._id !== del.dataset.removeOverride);
    loadOverrides();
    loadGrid(document.getElementById('grid-date').value);
  } catch (err) { alert(err.message); }
});

(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('slots');
  try { document.getElementById('clinic-name').textContent = (await api('/dashboard/summary')).clinic.name; } catch (_) {}

  const dateInput = document.getElementById('grid-date');
  dateInput.value = todayISO();
  dateInput.addEventListener('change', () => loadGrid(dateInput.value));
  document.getElementById('ov-date').value = todayISO();

  loadGrid(dateInput.value);
  loadRules();
  loadOverrides();

  document.getElementById('add-rule-btn').addEventListener('click', () => {
    document.getElementById('rule-list').insertAdjacentHTML('beforeend',
      ruleRowHTML(undefined, document.querySelectorAll('[data-rule-idx]').length));
  });

  document.getElementById('save-rules-btn').addEventListener('click', async () => {
    const status = document.getElementById('rules-status');
    status.className = 'status'; status.textContent = 'Saving…';
    try {
      const rules = readRulesFromDOM().filter(r => r.daysOfWeek.length && r.startTime && r.endTime && r.slotDurationMinutes);
      await api('/slots/rules', { method: 'PUT', body: { rules } });
      status.className = 'status success'; status.textContent = 'Saved. New timing applies immediately across WhatsApp, calls and this admin panel.';
      loadGrid(dateInput.value);
    } catch (err) { status.className = 'status error'; status.textContent = err.message; }
  });

  document.getElementById('add-override-btn').addEventListener('click', async () => {
    const status = document.getElementById('override-status');
    status.className = 'status'; status.textContent = 'Saving…';
    try {
      const body = {
        date: document.getElementById('ov-date').value,
        type: document.getElementById('ov-type').value,
        startTime: document.getElementById('ov-start').value || null,
        endTime: document.getElementById('ov-end').value || null,
        slotDurationMinutes: Number(document.getElementById('ov-duration').value) || 30,
        reason: document.getElementById('ov-reason').value.trim()
      };
      if (!body.date) throw new Error('Pick a date first.');
      const { override } = await api('/slots', { method: 'POST', body });
      overridesCache.push(override);
      status.className = 'status success'; status.textContent = 'Override added.';
      loadOverrides();
      loadGrid(dateInput.value);
    } catch (err) { status.className = 'status error'; status.textContent = err.message; }
  });
})();