// Forgiving input cleaners for values that arrive from n8n / an AI agent.
// They only reshape the text; the routes still validate the result strictly.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// "2026-10-12", "2026-10-12T00:00:00Z", "12/10/2026", "12-10-2026"  ->  "2026-10-12"
function normalizeDate(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  if (DATE_RE.test(s)) return s;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // day first (India)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// "10:00", "10:00:00", "10.00", "10 AM", "10:00 AM", "10:00 - 12:00", "2:30 pm"  ->  "HH:MM" (24h)
function normalizeTime(value) {
  if (value === undefined || value === null) return '';
  let s = String(value).trim().toLowerCase();
  s = s.split(/\s*(?:-|–|—|to)\s*/)[0].trim(); // keep only the start of a range
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return s;
  let h = Number(m[1]);
  const min = m[2] || '00';
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23) return s;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function normalizePhone(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/[\s\-()]/g, '');
}

// "", "null", "undefined", "none" from an AI tool call mean "no doctor chosen".
function normalizeId(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return !s || ['null', 'undefined', 'none', 'any'].includes(s.toLowerCase()) ? null : s;
}

module.exports = { DATE_RE, TIME_RE, normalizeDate, normalizeTime, normalizePhone, normalizeId };
