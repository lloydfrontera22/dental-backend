const express = require('express');
const Doctor = require('../models/Doctor');
const { requireClinicStaff } = require('../middleware/clinicAuth');

const router = express.Router();

router.get('/', requireClinicStaff, async (req, res, next) => {
  try {
    const doctors = await Doctor.find({ clinicId: req.clinic._id }).sort({ name: 1 }).lean();
    res.json({ doctors });
  } catch (error) { next(error); }
});

router.post('/', requireClinicStaff, async (req, res, next) => {
  try {
    const doctor = await Doctor.create({ ...req.body, clinicId: req.clinic._id });
    res.status(201).json({ message: 'Doctor added.', doctor });
  } catch (error) { next(error); }
});

router.put('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinic._id }, req.body, { new: true, runValidators: true }
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
    res.json({ message: 'Doctor updated.', doctor });
  } catch (error) { next(error); }
});

router.delete('/:id', requireClinicStaff, async (req, res, next) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.id, clinicId: req.clinic._id }, { isActive: false }, { new: true }
    );
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
    res.json({ message: 'Doctor deactivated.' });
  } catch (error) { next(error); }
});

module.exports = router;
