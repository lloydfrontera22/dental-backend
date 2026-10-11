(async function () {
  const user = await guardAdminPage(); if (!user) return;
  renderSidebar('settings');
  const s = await api('/dashboard/summary');
  document.getElementById('s-slug').textContent = `${s.clinic.slug}.yourapp.com`;
  document.getElementById('s-whatsapp').textContent = s.clinic.whatsappNumber || 'Not set';

  const keyInput = document.getElementById('api-key');
  try {
    const { apiKey } = await api('/settings/api-key');
    keyInput.value = apiKey;
  } catch (err) {
    keyInput.value = '';
    keyInput.placeholder = err.message;
  }

  document.getElementById('copy-btn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(keyInput.value);
    const btn = document.getElementById('copy-btn');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = original), 1200);
  });

  document.getElementById('regen-btn').addEventListener('click', async () => {
    if (!confirm('This breaks any n8n workflow still using the old key. Continue?')) return;
    try {
      const { apiKey } = await api('/settings/api-key/regenerate', { method: 'POST' });
      keyInput.value = apiKey;
    } catch (err) { alert(err.message); }
  });
})();