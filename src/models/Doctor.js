const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
