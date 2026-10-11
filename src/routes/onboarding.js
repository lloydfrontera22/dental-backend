const express = require('express');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

// GET /api/onboarding/check-slug?name=Happy+Dent -> suggests an available slug
router.get('/check-slug', requireAuth, async (req, res, next) => {
  try {
    const base = slugify(req.query.name || '');
    if (!base) return res.status(400).json({ message: 'Name is required.' });
    let slug = base;
    let n = 1;
    while (await Clinic.exists({ slug })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    res.json({ slug, available: true });
  } catch (error) { next(error); }
});

// POST /api/onboarding/clinic  { name, slug, whatsappNumber }
router.post('/clinic', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = slugify(req.body?.slug || req.body?.name || '');
    const whatsappNumber = String(req.body?.whatsappNumber || '').trim();

    if (!name || !slug) {
      return res.status(400).json({ message: 'Clinic name is required.' });
    }
    if (await Clinic.exists({ slug })) {
      return res.status(409).json({ message: 'That subdomain is already taken. Try another name.' });
    }

    const clinic = await Clinic.create({
      name,
      slug,
      whatsappNumber,
      ownerUserId: req.user._id,
      apiKey: Clinic.generateApiKey()
    });

    await User.findByIdAndUpdate(req.user._id, { clinicId: clinic._id, role: 'admin' });

    res.status(201).json({
      message: 'Clinic created.',
      clinic: { id: clinic._id, name: clinic.name, slug: clinic.slug, subdomainUrl: `${clinic.slug}.yourapp.com` }
    });
  } catch (error) { next(error); }
});

module.exports = router;
