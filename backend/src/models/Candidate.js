import mongoose from 'mongoose';

const workHistorySchema = new mongoose.Schema({
  company:     String,
  role:        String,
  from:        String,
  to:          String,
  description: String,
}, { _id: false });

const educationSchema = new mongoose.Schema({
  degree:      String,
  institution: String,
  year:        Number,
}, { _id: false });

// ── Access entry — who has access and what type ───────────────────────────────
// accessType: 'partial' = contact details (name/phone/email) are masked for client
//             'full'    = all data visible to client, no masking
const sharedAccessSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accessType: { type: String, enum: ['partial', 'full'], default: 'partial' },
}, { _id: false });

const candidateSchema = new mongoose.Schema({
  firstName:       { type: String, required: true, trim: true },
  lastName:        { type: String, required: true, trim: true },
  email:           { type: String, required: true, trim: true, lowercase: true },
  phone:           { type: String, trim: true, default: '' },
  location:        { type: String, trim: true, default: '' },
  city:            { type: String, trim: true, default: '' },
  state:           { type: String, trim: true, default: '' },
  country:         { type: String, trim: true, default: '' },
  source:          { type: String, trim: true, default: '' },
  candidateSpokenTo:{ type: String, trim: true, default: '' },
  expInYrs:        { type: Number, default: 0 },
  expInMonths:     { type: Number, default: 0 },
  noticePeriod:    { type: String, default: '2 weeks' },
  currentRole:     { type: String, required: true, trim: true },
  currentCompany:  { type: String, trim: true, default: '' },
  totalExperience: { type: Number, required: true, min: 0 },
  primarySkill:    { type: String, trim: true, default: '' },
  secondarySkill:  { type: String, trim: true, default: '' },
  skills:          [{ type: String, trim: true }],
  certifications:  { type: String, default: '' },
  designationRole: { type: String, trim: true, default: '' },
  aiExperience:    { type: String, trim: true, default: '' },
  itCapability:    { type: String, trim: true, default: '' },
  community:       { type: String, trim: true, default: '' },
  spReference:     { type: String, trim: true, default: '' },
  otherTechnicalSkills: { type: String, default: '' },
  expectedSalary:  { type: String, default: '' },
  discussionStage: { type: String, default: '' },
  vendorName:      { type: String, default: '' },
  comments:        { type: String, default: '' },
  preferredWorkLocation: { type: String, default: '' },
  referredBy:      { type: String, default: '' },
  selected:        { type: String, default: '' },
  workAuthorization:{ type: String, default: '' },
  seniorityLevel:  { type: String, default: '' },
  openToWork:      { type: String, default: '' },
  itNonIT:         { type: String, default: '' },
  domainExperience:{ type: String, default: '' },
  education:       [educationSchema],
  workHistory:     [workHistorySchema],
  status:          { type: String, enum: ['Active','Interviewing','Placed','Inactive','Rejected'], default: 'Active' },
  addedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // sharedWith now stores {userId, accessType} objects
  sharedWith:      [sharedAccessSchema],
  notes:           { type: String, default: '' },
  linkedIn:        { type: String, default: '' },
  resumeUrl:       { type: String, default: null },

  // ── Resume Viewer fields (Sewing Circle visual profile system) ────────────
  headline:       { type: String, default: '' },   // the memorable quote / tagline
  culture:        { type: String, default: '' },   // culture dimension summary
  performance:    { type: String, default: '' },   // performance dimension summary
  capability:     { type: String, default: '' },   // capability dimension summary
  metric1Num:     { type: String, default: '' },   // e.g. "40%"
  metric1Desc:    { type: String, default: '' },   // e.g. "attrition reduction"
  metric2Num:     { type: String, default: '' },
  metric2Desc:    { type: String, default: '' },
  metric3Num:     { type: String, default: '' },
  metric3Desc:    { type: String, default: '' },
  availableFor:   { type: String, default: '' },   // e.g. "GCC · Series B+ · PE Portfolio"
  industries:     { type: String, default: '' },   // e.g. "Tech · Fintech · SaaS"
  accentColor:    { type: String, default: '#B5651D' }, // visual profile accent color
}, { timestamps: true });

export default mongoose.model('Candidate', candidateSchema);
