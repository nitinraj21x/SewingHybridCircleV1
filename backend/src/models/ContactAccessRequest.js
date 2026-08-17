import mongoose from 'mongoose';

/**
 * ContactAccessRequest — tracks client requests to see a candidate's contact details.
 * Status flow: pending → approved | denied
 */
const contactAccessRequestSchema = new mongoose.Schema({
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  candidateName: { type: String, required: true },
  requestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  requestedByName: { type: String, required: true },
  requestedByEmail: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  note:   { type: String, default: '' },           // optional message from client
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedByName: { type: String, default: null },
  reviewedAt:   { type: Date, default: null },
}, { timestamps: true });

// One pending request per (candidate, client) pair max
contactAccessRequestSchema.index({ candidateId: 1, requestedBy: 1, status: 1 });

export default mongoose.model('ContactAccessRequest', contactAccessRequestSchema);
