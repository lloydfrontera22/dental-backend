const express = require('express');
const rateLimit = require('express-rate-limit');
const Clinic = require('../models/Clinic');
const { getAvailableSlots } = require('../utils/availability');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Read-only, no login, no API key. Safe to call from the public website.
// Set CORS_ORIGINS="https://yourclinic.com,https://www.yourclinic.com" on Vercel (defaults to "*").
const allowed = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
router.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowed.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

router.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' } }));

// GET /api/public/:slug/slots?date=YYYY-MM-DD
// Returns ONLY free, future slots. Never returns patient names or phone numbers.
router.get('/:slug/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!DATE_RE.test(date || '')) return res.status(400).json({ message: 'A valid date (YYYY-MM-DD) is required.' });
    const clinic = await Clinic.findOne({ slug: req.params.slug.toLowerCase(), isActive: true }).lean();
    if (!clinic) return res.status(404).json({ message: 'Clinic not found.' });

    const slots = await getAvailableSlots({ clinicId: clinic._id, date, excludePast: true });
    res.set('Cache-Control', 'no-store');
    res.json({
      clinic: clinic.name, date,
      slots: slots.map(({ startTime, endTime }) => ({ startTime, endTime }))
    });
  } catch (error) { next(error); }
});

module.exports = router;
