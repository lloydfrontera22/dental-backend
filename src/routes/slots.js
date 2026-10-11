const express = require('express');
const SlotRule = require('../models/SlotRule');
const SlotOverride = require('../models/SlotOverride');
const { requireClinicStaff, requireClinicOrApiKey } = require('../middleware/clinicAuth');
const { getAvailableSlots } = require('../utils/availability');
const { normalizeDate, normalizeId } = require('../utils/normalize');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pickOverrideFields = (b = {}) => Object.fromEntries(
  ['date', 'type', 'startTime', 'endTime', 'slotDurationMinutes', 'doctorId', 'reason']
    .filter(k => b[k] !== undefined).map(k => [k, b[k]])
);

/* ---------- Admin-only: recurring pattern ---------- */

// GET /api/slots/rules
router.get('/rules', requireClinicStaff, async (req, res, next) => {
  try {
    const rules = await SlotRule.find({ clinicId: req.clinic._id }).sort({ createdAt: 1 }).lean();
    res.json({ rules });
  } catch (error) { next(error); }
});

// PUT /api/slots/rules   { rules: [ { daysOfWeek, startTime, endTime, slotDurationMinutes, doctorId? } ] }
// Replaces the whole recurring pattern in one call — simplest for an admin "save" button.
router.put('/rules', requireClinicStaff, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body?.rules) ? req.body.rules : [];
    for (const r of incoming) {
      if (!Array.isArray(r.daysOfWeek) || !r.startTime || !r.endTime || !r.slotDurationMinutes) {
        return res.status(400).json({ message: 'Each rule needs daysOfWeek, startTime, endTime and slotDurationMinutes.' });
      }
    }
    await SlotRule.deleteMany({ clinicId: req.clinic._id });
    const created = incoming.length
      ? await SlotRule.insertMany(incoming.map(r => ({ ...r, clinicId: req.clinic._id })))
      : [];
    res.json({ message: 'Recurring pattern updated.', rules: created });
  } catch (error) { next(error); }
});

/* ---------- Admin-only: one-off slots / overrides (create, update, delete) ---------- */

// POST /api/slots   { date, type: 'block'|'add', startTime?, endTime?, slotDurationMinutes?, doctorId?, reason? }
router.post('/', requireClinicStaff, async (req, res, next) => {
  try {
    const { date, type, startTime, endTime, slotDurationMinutes, doctorId, reason } = req.body || {};
    if (!DATE_RE.test(date || '')) return res.status(400).json({ message: 'A valid date (YYYY-MM-DD) is required.' });
    if (!['block', 'add'].includes(type)) return res.status(400).json({ message: 'type must be "block" or "add".' });
    if (type === 'add' && (!startTime || !endTime)) {
      return res.status(400).json({ message: 'startTime and endTime are required to add an extra slot window.' });
    }
    const override = await SlotOverride.create({
      clinicId: req.clinic._id, date, type, startTime: startTime || null, endTime: endTime || null,
      slotDurationMinutes: slotDurationMinutes || null, doctorId: doctorId || null, reason: reason || ''
    });
    res.status(201).json({ message: 'Slot override created.', override });
  } catch (error) { next(error); }
});

// PUT /api/slots/:id
router.put('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    const override = await SlotOverride.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinic._id },
      pickOverrideFields(req.body),
      { new: true, runValidators: true }
    );
    if (!override) return res.status(404).json({ message: 'Slot override not found.' });
    res.json({ message: 'Slot override updated.', override });
  } catch (error) { next(error); }
});

// DELETE /api/slots/:id
router.delete('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    const result = await SlotOverride.findOneAndDelete({ _id: req.params.id, clinicId: req.clinic._id });
    if (!result) return res.status(404).json({ message: 'Slot override not found.' });
    res.json({ message: 'Slot override deleted.' });
  } catch (error) { next(error); }
});

/* ---------- Shared: admin panel AND n8n ---------- */

// GET /api/slots/available?date=2026-10-05&doctorId=optional
router.get('/available', requireClinicOrApiKey, async (req, res, next) => {
  try {
    const date = normalizeDate(req.query.date);
    const doctorId = normalizeId(req.query.doctorId);
    if (!DATE_RE.test(date)) return res.status(400).json({ message: 'A valid date (YYYY-MM-DD) is required.' });
    // n8n (api key) should never offer a time that has already passed.
    const slots = await getAvailableSlots({
      clinicId: req.clinic._id, date, doctorId: doctorId || null, excludePast: req.authVia === 'api_key'
    });
    res.json({ date, slots });
  } catch (error) { next(error); }
});

module.exports = router;
