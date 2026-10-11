require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const authRoutes = require('./src/routes/auth');
const onboardingRoutes = require('./src/routes/onboarding');
const slotsRoutes = require('./src/routes/slots');
const bookingsRoutes = require('./src/routes/bookings');
const doctorsRoutes = require('./src/routes/doctors');
const patientsRoutes = require('./src/routes/patients');
const dashboardRoutes = require('./src/routes/dashboard');
const settingsRoutes = require('./src/routes/settings');
const publicRoutes = require('./src/routes/public');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const IS_VERCEL = Boolean(process.env.VERCEL);

// Vercel sits behind a proxy; needed so the rate limiter sees the real client IP.
app.set('trust proxy', 1);

// Locally, fail fast. On Vercel, log only so the function doesn't crash on start.
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  if (!IS_VERCEL) process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and should be at least 32 characters long.');
  if (!IS_VERCEL) process.exit(1);
}

// ---------- Database (cached connection, safe for serverless) ----------
let dbReady = null;

function connectDB() {
  if (!dbReady) {
    dbReady = mongoose.connect(process.env.MONGODB_URI).catch((err) => {
      dbReady = null; // don't cache a failed connection; retry on next request
      throw err;
    });
  }
  return dbReady;
}

// ---------- Middleware ----------
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Every admin page runs its guard/sidebar/data logic from an inline <script>
  // block, so the default script-src 'self' (no inline scripts) blocks the
  // whole app from working. Allow inline scripts while keeping every other
  // Helmet default (including the default style-src, font-src, etc.) intact.
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"]
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// Ensure the database is connected before any API route runs.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connect error:', err.message);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' }
});

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicRoutes);

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html']
}));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});

// ---------- Start ----------
// Locally: connect to MongoDB, then listen. On Vercel: the app is exported
// and each request connects to the database through the /api middleware above.
if (!IS_VERCEL) {
  connectDB()
    .then(() => {
      console.log('MongoDB connected.');
      app.listen(PORT, () => {
        console.log(`Dental login server running at http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      process.exit(1);
    });
}

module.exports = app;