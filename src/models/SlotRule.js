const mongoose = require('mongoose');

// One recurring pattern entry, e.g. "Mon-Fri, 10:00-13:00, 30 min slots".
const slotRuleSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    daysOfWeek: {
      type: [Number], // 0 = Sunday ... 6 = Saturday
      required: true,
      validate: v => Array.isArray(v) && v.length > 0 && v.every(d => d >= 0 && d <= 6)
    },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "10:00"
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },   // "13:00"
    slotDurationMinutes: { type: Number, required: true, min: 5, max: 240 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SlotRule', slotRuleSchema);
