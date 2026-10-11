async function loadDoctors() {
  const { doctors } = await api('/doctors');
  document.getElementById('rows').innerHTML = doctors.length ? doctors.map(d => `
    <tr><td>${d.name}</td><td>${d.specialization || '—'}</td><td>${d.phone || '—'}</td>
    <td><button class="btn btn-danger btn-sm" data-remove="${d._id}">Remove</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No doctors added yet.</td></tr>';
}

document.addEventListener('click', async e => {
  const rm = e.target.closest('[data-remove]');
  if (rm) { await api(`/doctors/${rm.dataset.remove}`, { method: 'DELETE' }); loadDoctors(); }
});

(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('doctors');
  loadDoctors();
  document.getElementById('add-btn').addEventListener('click', async () => {
    const status = document.getElementById('add-status');
    try {
      await api('/doctors', { method: 'POST', body: {
        name: document.getElementById('d-name').value.trim(),
        specialization: document.getElementById('d-spec').value.trim(),
        phone: document.getElementById('d-phone').value.trim()
      }});
      status.className = 'status success'; status.textContent = 'Doctor added.';
      document.getElementById('d-name').value = ''; document.getElementById('d-spec').value = ''; document.getElementById('d-phone').value = '';
      loadDoctors();
    } catch (err) { status.className = 'status error'; status.textContent = err.message; }
  });
})();