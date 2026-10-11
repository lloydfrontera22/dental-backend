/* Drop-in availability widget for the public clinic website.
 *
 *   <div id="dc-slots"></div>
 *   <script src="https://dentalbackend-liart.vercel.app/embed/slots-widget.js"
 *           data-slug="demo-clinic" data-target="#dc-slots"></script>
 *
 * Shows free slots for the chosen date and refreshes every 15s (and when the tab regains focus),
 * so a WhatsApp booking made via n8n disappears from the website within seconds.
 */
(function () {
  const me = document.currentScript;
  const slug = me.dataset.slug;
  const root = document.querySelector(me.dataset.target || '#dc-slots');
  const base = new URL(me.src).origin + '/api/public/' + encodeURIComponent(slug) + '/slots';
  const REFRESH_MS = 15000;
  if (!root) return;

  const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const to12h = t => { const [h, m] = t.split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm'); };

  root.innerHTML = '<label>Date <input type="date" class="dc-date"></label><div class="dc-list" aria-live="polite"></div>';
  const input = root.querySelector('.dc-date');
  const list = root.querySelector('.dc-list');
  input.value = today(); input.min = today();

  async function load() {
    try {
      const res = await fetch(base + '?date=' + input.value, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      list.innerHTML = data.slots.length
        ? data.slots.map(s => '<button type="button" class="dc-slot">' + to12h(s.startTime) + '</button>').join('')
        : '<p>No free slots for this date.</p>';
    } catch (e) { list.innerHTML = '<p>Could not load availability. Please try again.</p>'; }
  }
  input.addEventListener('change', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  load();
})();
