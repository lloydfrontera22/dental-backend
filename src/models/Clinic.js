const mongoose = require('mongoose');
const crypto = require('crypto');

const clinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]{3,40}$/, 'Slug must be lowercase letters, numbers and hyphens only.'],
      index: true
    },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    whatsappNumber: { type: String, trim: true, default: '' },
    defaultSlotDurationMinutes: { type: Number, default: 30, min: 5, max: 240 },
    apiKey: { type: String, unique: true, sparse: true, select: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

clinicSchema.statics.generateApiKey = function generateApiKey() {
  return `n8n_${crypto.randomBytes(24).toString('hex')}`;
};

module.exports = mongoose.model('Clinic', clinicSchema);
