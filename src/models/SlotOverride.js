const mongoose = require('mongoose');

// A one-off change to a single date: block the whole day, block a window,
// or add an extra window outside the normal recurring pattern.
const slotOverrideSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }, // "2026-10-05"
    type: { type: String, enum: ['block', 'add'], required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null }, // null + type=block => whole day off
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
    slotDurationMinutes: { type: Number, min: 5, max: 240, default: null }, // used when type=add
    reason: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SlotOverride', slotOverrideSchema);
