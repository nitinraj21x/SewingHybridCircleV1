import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role:         { type: String, enum: ['t-1', 't-2', 't-3'], required: true },
  avatar:       { type: String, default: '' },
  active:       { type: Boolean, default: true },

  // ── Client invite fields ──────────────────────────────────────────────────
  // tempPassword: the plaintext temp password shown once at invite time
  // (stored only briefly; we also store the hash in passwordHash)
  invitedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sessionExpiresAt:{ type: Date, default: null },   // null = no expiry (staff)
  isTemporary:     { type: Boolean, default: false }, // true = client invite
}, { timestamps: true });

// Virtual: is this client session still valid?
userSchema.virtual('sessionActive').get(function () {
  if (!this.isTemporary) return true;
  if (!this.sessionExpiresAt) return false;
  return new Date() < this.sessionExpiresAt;
});

export default mongoose.model('User', userSchema);
