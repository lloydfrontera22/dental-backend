const express = require('express');
const Clinic = require('../models/Clinic');
const { requireClinicStaff } = require('../middleware/clinicAuth');

const router = express.Router();

// GET /api/settings/api-key — admin only. Reveals the key n8n's HTTP Request
// nodes send back as the "x-api-key" header on /slots/available and /bookings.
router.get('/api-key', requireClinicStaff, async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.clinic._id).select('+apiKey');
    if (!clinic.apiKey) {
      clinic.apiKey = Clinic.generateApiKey();
      await clinic.save();
    }
    res.json({ apiKey: clinic.apiKey });
  } catch (error) { next(error); }
});

// POST /api/settings/api-key/regenerate — admin only. Breaks any n8n workflow
// still using the old key, so the UI warns before calling this.
router.post('/api-key/regenerate', requireClinicStaff, async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.clinic._id).select('+apiKey');
    clinic.apiKey = Clinic.generateApiKey();
    await clinic.save();
    res.json({ apiKey: clinic.apiKey });
  } catch (error) { next(error); }
});

module.exports = router;
