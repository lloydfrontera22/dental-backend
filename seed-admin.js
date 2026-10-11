require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Clinic = require('./src/models/Clinic');
const Doctor = require('./src/models/Doctor');
const SlotRule = require('./src/models/SlotRule');

// Demo slot pattern: exactly two windows a day, every day of the week —
// 10:00-12:00 and 14:00-16:00 — each treated as one slot (120 min) so the
// grid on the Slots page shows exactly "10:00-12:00" and "14:00-16:00",
// matching the two example slots requested for the demo.
const DEMO_SLOT_WINDOWS = [
  { startTime: '10:00', endTime: '12:00' },
  { startTime: '14:00', endTime: '16:00' }
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

async function seedAdmin() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing in .env');
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

  let user = await User.findOne({ email });

  if (user) {
    user.name = process.env.ADMIN_NAME || user.name;
    user.passwordHash = passwordHash;
    user.role = 'admin';
    user.isActive = true;
    await user.save();
    console.log(`Updated admin account: ${email}`);
  } else {
    user = await User.create({
      name: process.env.ADMIN_NAME || 'Hospital Administrator',
      email,
      passwordHash,
      role: 'admin',
      isActive: true
    });
    console.log(`Created admin account: ${email}`);
  }

  // --- Demo clinic, so the admin panel has something to show right after login ---
  // Skip this whole block by setting SEED_DEMO_CLINIC=false in .env if you'd
  // rather create the clinic yourself through the onboarding screen.
  if (process.env.SEED_DEMO_CLINIC !== 'false') {
    const slug = (process.env.DEMO_CLINIC_SLUG || 'demo-clinic').toLowerCase();
    let clinic = await Clinic.findOne({ slug }).select('+apiKey');

    if (!clinic) {
      clinic = await Clinic.create({
        name: process.env.DEMO_CLINIC_NAME || 'Demo Dental Clinic',
        slug,
        whatsappNumber: process.env.DEMO_CLINIC_WHATSAPP || '',
        ownerUserId: user._id,
        apiKey: Clinic.generateApiKey()
      });
      console.log(`Created demo clinic: ${clinic.name} (${slug}.yourapp.com)`);
    } else if (!clinic.apiKey) {
      clinic.apiKey = Clinic.generateApiKey();
      await clinic.save();
    }

    if (!user.clinicId) {
      user.clinicId = clinic._id;
      await user.save();
    }

    let doctor = await Doctor.findOne({ clinicId: clinic._id });
    if (!doctor) {
      doctor = await Doctor.create({
        clinicId: clinic._id,
        name: process.env.DEMO_DOCTOR_NAME || 'Dr. Demo',
        isActive: true
      });
      console.log(`Created demo doctor: ${doctor.name}`);
    }

    // Replace any existing rules with exactly the two demo windows, so the
    // grid always shows just 10:00-12:00 and 14:00-16:00 after seeding.
    await SlotRule.deleteMany({ clinicId: clinic._id });
    await SlotRule.insertMany(DEMO_SLOT_WINDOWS.map(w => ({
      clinicId: clinic._id,
      daysOfWeek: ALL_DAYS,
      startTime: w.startTime,
      endTime: w.endTime,
      slotDurationMinutes: 120,
      isActive: true
    })));
    console.log('Seeded demo slot pattern: 10:00-12:00 and 14:00-16:00, every day.');

    console.log('');
    console.log(`n8n / WhatsApp API key for this clinic: ${clinic.apiKey}`);
    console.log('Use it as the "x-api-key" header on GET /api/slots/available and POST /api/bookings.');
  }

  await mongoose.disconnect();
}

seedAdmin().catch(async (error) => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
