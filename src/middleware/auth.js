const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'dental_session';

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Your account is unavailable.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { COOKIE_NAME, requireAuth };
