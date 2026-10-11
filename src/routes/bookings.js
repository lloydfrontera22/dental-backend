const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Patient = require('../models/Patient');
const { requireClinicStaff, requireClinicOrApiKey } = require('../middleware/clinicAuth');
const { getAvailableSlots, nowInClinicTz } = require('../utils/availability');
const { DATE_RE, TIME_RE, normalizeDate, normalizeTime, normalizePhone, normalizeId } = require('../utils/normalize');

const router = express.Router();

// POST /api/bookings  { date, startTime, endTime, patientName, patientPhone, doctorId?, source? }
// Shared by the admin panel (walk-ins) and n8n (WhatsApp / call bookings).
router.post('/', requireClinicOrApiKey, async (req, res, next) => {
  try {
    const body = req.body || {};
    // Accept the field names an AI agent is likely to use as well as the documented ones.
    const date = normalizeDate(body.date);
    const startTime = normalizeTime(body.startTime ?? body.time);
    const patientName = String(body.patientName ?? body.name ?? '').trim();
    const patientPhone = normalizePhone(body.patientPhone ?? body.phone);
    const doctorId = normalizeId(body.doctorId);
    const { source, notes } = body;

    const problems = [];
    if (!DATE_RE.test(date)) problems.push('date (YYYY-MM-DD)');
    if (!TIME_RE.test(startTime)) problems.push('startTime (HH:MM, 24-hour, must be one of the available slots)');
    if (!patientName) problems.push('patientName');
    if (!patientPhone) problems.push('patientPhone');
    if (doctorId && !mongoose.isValidObjectId(doctorId)) problems.push('doctorId (must be a valid id or omitted)');
    if (problems.length) {
      return res.status(400).json({ message: `Missing or invalid: ${problems.join(', ')}.` });
    }

    // Re-check availability at the moment of booking to prevent a race between two channels.
    const open = await getAvailableSlots({
      clinicId: req.clinic._id, date, doctorId, excludePast: true
    });
    const openSlot = open.find(s => s.startTime === startTime);
    if (!openSlot) {
      return res.status(409).json({
        message: 'That slot is not available. Please choose one of the available slots.',
        availableSlots: open.map(({ startTime: st, endTime: et }) => ({ startTime: st, endTime: et }))
      });
    }

    await Patient.findOneAndUpdate(
      { clinicId: req.clinic._id, phone: patientPhone },
      { $setOnInsert: { name: patientName } },
      { upsert: true }
    );

    const booking = await Booking.create({
      clinicId: req.clinic._id, doctorId, date, startTime,
      endTime: openSlot.endTime, // trust the server's slot length, not the caller's
      patientName, patientPhone, source: source || (req.authVia === 'api_key' ? 'whatsapp' : 'admin'),
      notes: notes || ''
    });

    res.status(201).json({ message: 'Booking confirmed.', booking });
  } catch (error) {
    // Two people grabbed the same slot at the same instant: the unique index rejects the loser.
    if (error.code === 11000) return res.status(409).json({ message: 'That slot was just taken. Please choose another.' });
    next(error);
  }
});

// GET /api/bookings/today  — admin dashboard feed
router.get('/today', requireClinicStaff, async (req, res, next) => {
  try {
    const today = nowInClinicTz().date;
    const bookings = await Booking.find({ clinicId: req.clinic._id, date: today })
      .sort({ startTime: 1 }).lean();
    res.json({ date: today, bookings });
  } catch (error) { next(error); }
});

// GET /api/bookings/upcoming  — admin dashboard feed: every active booking from today onward
router.get('/upcoming', requireClinicStaff, async (req, res, next) => {
  try {
    const today = nowInClinicTz().date;
    const bookings = await Booking.find({ clinicId: req.clinic._id, date: { $gte: today }, status: 'booked' })
      .sort({ date: 1, startTime: 1 }).limit(200).lean();
    res.json({ from: today, bookings });
  } catch (error) { next(error); }
});

// PUT /api/bookings/:id  — reschedule or change status (admin only)
router.put('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    // Whitelist fields: never let the request body change clinicId or source.
    const allowed = ['date', 'startTime', 'endTime', 'doctorId', 'patientName', 'patientPhone', 'status', 'notes'];
    const update = {};
    for (const k of allowed) if (req.body && req.body[k] !== undefined) update[k] = req.body[k];
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinic._id }, update, { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ message: 'Booking updated.', booking });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That slot is already booked.' });
    next(error);
  }
});

// DELETE /api/bookings/:id — cancel, never hard-delete
router.delete('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinic._id }, { status: 'cancelled' }, { new: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ message: 'Booking cancelled.', booking });
  } catch (error) { next(error); }
});

module.exports = router;
