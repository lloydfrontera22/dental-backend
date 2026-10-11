(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('registration');
  const s = await api('/dashboard/summary');
  document.getElementById('c-patients').textContent = s.activePatients;
  document.getElementById('c-doctors').textContent = s.doctorCount;
  document.getElementById('c-today').textContent = s.todayAppointmentCount;
})();