const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const { COOKIE_NAME } = require('./auth');

// For admin-only endpoints: staff must be logged in and belong to an active clinic.
async function requireClinicStaff(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Your account is unavailable.' });
    }
    if (!user.clinicId) {
      return res.status(403).json({ message: 'This account is not linked to a clinic yet.' });
    }
    const clinic = await Clinic.findById(user.clinicId).lean();
    if (!clinic || !clinic.isActive) {
      return res.status(403).json({ message: 'This clinic is not active.' });
    }
    req.user = user;
    req.clinic = clinic;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

// For the two shared endpoints: accepts EITHER a staff JWT cookie (admin panel)
// OR an "x-api-key" header matching the clinic's own key (n8n).
async function requireClinicOrApiKey(req, res, next) {
  const apiKey = (req.header('x-api-key') || '').trim();
  if (apiKey) {
    const clinic = await Clinic.findOne({ apiKey, isActive: true }).select('+apiKey').lean();
    if (!clinic) return res.status(401).json({ message: 'Invalid API key.' });
    req.clinic = clinic;
    req.authVia = 'api_key';
    return next();
  }
  return requireClinicStaff(req, res, () => {
    req.authVia = 'staff';
    next();
  });
}

module.exports = { requireClinicStaff, requireClinicOrApiKey };
