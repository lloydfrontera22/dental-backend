(async function () {
  const user = await (async () => {
    try { const { user } = await api('/auth/me'); return user; } catch (_) { location.href = '../index.html'; }
  })();
  if (user && user.clinicId) { location.href = 'dashboard.html'; return; }

  const nameInput = document.getElementById('name');
  const slugPreview = document.getElementById('slug-preview');
  const status = document.getElementById('status');
  let currentSlug = '';
  let debounceTimer = null;

  nameInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!nameInput.value.trim()) { slugPreview.textContent = 'Your admin panel: —'; return; }
      try {
        const { slug } = await api(`/onboarding/check-slug?name=${encodeURIComponent(nameInput.value)}`);
        currentSlug = slug;
        slugPreview.textContent = `Your admin panel: ${slug}.yourapp.com`;
      } catch (_) {}
    }, 350);
  });

  document.getElementById('form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    status.className = 'status'; status.textContent = '';
    try {
      await api('/onboarding/clinic', {
        method: 'POST',
        body: { name: nameInput.value.trim(), slug: currentSlug, whatsappNumber: document.getElementById('whatsapp').value.trim() }
      });
      status.className = 'status success'; status.textContent = 'Clinic created. Redirecting…';
      location.href = 'dashboard.html';
    } catch (err) {
      status.className = 'status error'; status.textContent = err.message;
      btn.disabled = false; btn.textContent = 'Create clinic';
    }
  });
})();