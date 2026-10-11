const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, index: true },
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

patientSchema.index({ clinicId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Patient', patientSchema);
