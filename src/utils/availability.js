const SlotRule = require('../models/SlotRule');
const SlotOverride = require('../models/SlotOverride');
const Booking = require('../models/Booking');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Split a start-end window into fixed-length slots.
function windowToSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  let cursor = toMinutes(startTime);
  const end = toMinutes(endTime);
  while (cursor + durationMinutes <= end) {
    slots.push({ startTime: toHHMM(cursor), endTime: toHHMM(cursor + durationMinutes) });
    cursor += durationMinutes;
  }
  return slots;
}

/**
 * Compute the real, bookable slots for one clinic on one date, optionally for one doctor.
 * Order of truth: recurring rules -> "add" overrides -> "block" overrides remove -> existing bookings remove.
 */
const CLINIC_TZ = process.env.CLINIC_TZ || 'Asia/Kolkata';

// Today's date (YYYY-MM-DD) and current minutes-since-midnight in the clinic's timezone.
function nowInClinicTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

async function getAvailableSlots({ clinicId, date, doctorId = null, excludePast = false }) {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

  const ruleQuery = { clinicId, isActive: true, daysOfWeek: dayOfWeek };
  if (doctorId) ruleQuery.$or = [{ doctorId }, { doctorId: null }];
  const rules = await SlotRule.find(ruleQuery).lean();

  const overrideQuery = { clinicId, date };
  if (doctorId) overrideQuery.$or = [{ doctorId }, { doctorId: null }];
  const overrides = await SlotOverride.find(overrideQuery).lean();

  const bookingQuery = { clinicId, date, status: 'booked' };
  if (doctorId) bookingQuery.doctorId = doctorId;
  const bookings = await Booking.find(bookingQuery).lean();
  const bookedKeys = new Set(bookings.map(b => `${b.doctorId || 'any'}_${b.startTime}`));

  // Whole-day block short-circuits everything.
  const wholeDayBlocked = overrides.some(o => o.type === 'block' && !o.startTime);
  if (wholeDayBlocked) return [];

  let slots = [];
  for (const rule of rules) {
    slots.push(...windowToSlots(rule.startTime, rule.endTime, rule.slotDurationMinutes)
      .map(s => ({ ...s, doctorId: rule.doctorId || doctorId || null })));
  }
  for (const o of overrides) {
    if (o.type === 'add' && o.startTime && o.endTime) {
      slots.push(...windowToSlots(o.startTime, o.endTime, o.slotDurationMinutes || 30)
        .map(s => ({ ...s, doctorId: o.doctorId || doctorId || null })));
    }
  }

  // Remove partial-window blocks.
  const blockWindows = overrides.filter(o => o.type === 'block' && o.startTime && o.endTime);
  slots = slots.filter(s => {
    const sMin = toMinutes(s.startTime);
    return !blockWindows.some(b => sMin >= toMinutes(b.startTime) && sMin < toMinutes(b.endTime));
  });

  // Remove already-booked slots and duplicates.
  const seen = new Set();
  const result = [];
  for (const s of slots) {
    const key = `${s.doctorId || 'any'}_${s.startTime}`;
    if (bookedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }
  result.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  if (excludePast) {
    const now = nowInClinicTz();
    if (date < now.date) return [];
    if (date === now.date) return result.filter(s => toMinutes(s.startTime) > now.minutes);
  }
  return result;
}

module.exports = { getAvailableSlots, toMinutes, toHHMM, nowInClinicTz };
