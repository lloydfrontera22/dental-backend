const express = require('express');
const Patient = require('../models/Patient');
const Booking = require('../models/Booking');
const { requireClinicStaff } = require('../middleware/clinicAuth');

const router = express.Router();

router.get('/', requireClinicStaff, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { clinicId: req.clinic._id };
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
    const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ patients });
  } catch (error) { next(error); }
});

router.get('/:id/bookings', requireClinicStaff, async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.id, clinicId: req.clinic._id }).lean();
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    const bookings = await Booking.find({ clinicId: req.clinic._id, patientPhone: patient.phone })
      .sort({ date: -1, startTime: -1 }).lean();
    res.json({ patient, bookings });
  } catch (error) { next(error); }
});

module.exports = router;
