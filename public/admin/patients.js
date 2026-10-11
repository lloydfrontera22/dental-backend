async function loadPatients(q = '') {
  const { patients } = await api(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  document.getElementById('rows').innerHTML = patients.length ? patients.map(p => `
    <tr><td>${p.name}</td><td>${p.phone}</td><td>${new Date(p.createdAt).toLocaleDateString()}</td>
    <td><a href="#" class="btn btn-ghost btn-sm" data-view="${p._id}">View bookings</a></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No patients yet.</td></tr>';
}

let t;
document.getElementById('search').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => loadPatients(e.target.value), 300); });

(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('patients');
  loadPatients();
})();