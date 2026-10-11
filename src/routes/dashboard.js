const express = require('express');
const Booking = require('../models/Booking');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { requireClinicStaff } = require('../middleware/clinicAuth');
const { nowInClinicTz } = require('../utils/availability');

const router = express.Router();

router.get('/summary', requireClinicStaff, async (req, res, next) => {
  try {
    const today = nowInClinicTz().date;
    const [todayCount, upcomingCount, activePatients, doctorCount] = await Promise.all([
      Booking.countDocuments({ clinicId: req.clinic._id, date: today, status: 'booked' }),
      Booking.countDocuments({ clinicId: req.clinic._id, date: { $gte: today }, status: 'booked' }),
      Patient.countDocuments({ clinicId: req.clinic._id }),
      Doctor.countDocuments({ clinicId: req.clinic._id, isActive: true })
    ]);
    res.json({
      clinic: { name: req.clinic.name, slug: req.clinic.slug, whatsappNumber: req.clinic.whatsappNumber },
      todayAppointmentCount: todayCount,
      upcomingAppointmentCount: upcomingCount,
      activePatients,
      doctorCount
    });
  } catch (error) { next(error); }
});

module.exports = router;
