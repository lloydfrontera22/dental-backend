const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    patientName: { type: String, required: true, trim: true, maxlength: 100 },
    patientPhone: { type: String, required: true, trim: true },
    source: { type: String, enum: ['admin', 'whatsapp', 'call', 'web'], default: 'admin' },
    status: { type: String, enum: ['booked', 'cancelled', 'completed', 'no_show'], default: 'booked' },
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

// Two bookings for the same clinic/doctor/date/time that are both "booked" is a double-booking.
bookingSchema.index({ clinicId: 1, doctorId: 1, date: 1, startTime: 1 });

// Hard guarantee: only ONE active booking per clinic/doctor/date/start time.
// Cancelled / completed / no-show rows don't count, so a cancelled slot can be rebooked.
bookingSchema.index(
  { clinicId: 1, doctorId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' }, name: 'uniq_active_booking' }
);

module.exports = mongoose.model('Booking', bookingSchema);
