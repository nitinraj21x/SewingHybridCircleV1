/**
 * candidates.js — CRUD for /api/candidates
 * All routes require authentication.
 * Write operations enforce server-side RBAC.
 */
import { Router }          from 'express';
import { body, param }     from 'express-validator';
import { requireAuth, requireRecruiter, requireAdmin } from '../middleware/auth.js';
import { validate }        from '../middleware/validate.js';
import Candidate           from '../models/Candidate.js';
import ContactAccessRequest from '../models/ContactAccessRequest.js';
import AuditLog            from '../models/AuditLog.js';

const router = Router();
router.use(requireAuth); // all routes require login

function normalizeSkillList(skills) {
  if (!Array.isArray(skills)) return [];
  return skills.map((skill) => String(skill).trim()).filter(Boolean);
}

function normalizeExperienceValue(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeTextValue(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function parseSelectedFlag(value, fallback = '') {
  const text = normalizeTextValue(value, fallback).toLowerCase();
  if (!text) return '';
  if (['true', 'yes', 'selected', 'y', '1'].includes(text)) return 'Selected';
  return value;
}

function normalizeCandidatePayload(body, existingCandidate = null) {
  const skills = normalizeSkillList(body.skills ?? existingCandidate?.skills ?? []);
  const primarySkill = String(body.primarySkill ?? existingCandidate?.primarySkill ?? skills[0] ?? '').trim();
  const secondarySkill = String(body.secondarySkill ?? existingCandidate?.secondarySkill ?? skills[1] ?? '').trim();
  const expInYrs = normalizeExperienceValue(
    body.expInYrs ?? existingCandidate?.expInYrs ?? body.totalExperience ?? existingCandidate?.totalExperience ?? 0
  );
  const expInMonths = normalizeExperienceValue(body.expInMonths ?? existingCandidate?.expInMonths ?? 0);
  const totalExperience = body.totalExperience !== undefined
    ? normalizeExperienceValue(body.totalExperience, 0)
    : Number((expInYrs + (expInMonths / 12)).toFixed(2));

  return {
    ...body,
    firstName: normalizeTextValue(body.firstName ?? existingCandidate?.firstName ?? ''),
    lastName: normalizeTextValue(body.lastName ?? existingCandidate?.lastName ?? ''),
    email: normalizeTextValue(body.email ?? existingCandidate?.email ?? '').toLowerCase(),
    phone: body.phone !== undefined ? normalizeTextValue(body.phone) : (existingCandidate?.phone || ''),
    location: body.location !== undefined ? normalizeTextValue(body.location) : (existingCandidate?.location || ''),
    city: body.city !== undefined ? normalizeTextValue(body.city) : (existingCandidate?.city || ''),
    state: body.state !== undefined ? normalizeTextValue(body.state) : (existingCandidate?.state || ''),
    country: body.country !== undefined ? normalizeTextValue(body.country) : (existingCandidate?.country || ''),
    source: body.source !== undefined ? normalizeTextValue(body.source) : (existingCandidate?.source || ''),
    candidateSpokenTo: body.candidateSpokenTo !== undefined ? normalizeTextValue(body.candidateSpokenTo) : (existingCandidate?.candidateSpokenTo || ''),
    expInYrs,
    expInMonths,
    noticePeriod: body.noticePeriod ?? existingCandidate?.noticePeriod ?? '2 weeks',
    currentRole: normalizeTextValue(body.currentRole ?? existingCandidate?.currentRole ?? ''),
    currentCompany: body.currentCompany !== undefined ? normalizeTextValue(body.currentCompany) : (existingCandidate?.currentCompany || ''),
    designationRole: body.designationRole !== undefined ? normalizeTextValue(body.designationRole) : (existingCandidate?.designationRole || ''),
    totalExperience,
    primarySkill,
    secondarySkill,
    skills,
    certifications: body.certifications !== undefined ? normalizeTextValue(body.certifications) : (existingCandidate?.certifications || ''),
    aiExperience: body.aiExperience !== undefined ? normalizeTextValue(body.aiExperience) : (existingCandidate?.aiExperience || ''),
    itCapability: body.itCapability !== undefined ? normalizeTextValue(body.itCapability) : (existingCandidate?.itCapability || ''),
    community: body.community !== undefined ? normalizeTextValue(body.community) : (existingCandidate?.community || ''),
    spReference: body.spReference !== undefined ? normalizeTextValue(body.spReference) : (existingCandidate?.spReference || ''),
    otherTechnicalSkills: body.otherTechnicalSkills !== undefined ? normalizeTextValue(body.otherTechnicalSkills) : (existingCandidate?.otherTechnicalSkills || ''),
    expectedSalary: body.expectedSalary !== undefined ? normalizeTextValue(body.expectedSalary) : (existingCandidate?.expectedSalary || ''),
    discussionStage: body.discussionStage !== undefined ? normalizeTextValue(body.discussionStage) : (existingCandidate?.discussionStage || ''),
    vendorName: body.vendorName !== undefined ? normalizeTextValue(body.vendorName) : (existingCandidate?.vendorName || ''),
    status: body.status ?? existingCandidate?.status ?? 'Active',
    comments: body.comments !== undefined ? normalizeTextValue(body.comments) : (existingCandidate?.comments || ''),
    preferredWorkLocation: body.preferredWorkLocation !== undefined ? normalizeTextValue(body.preferredWorkLocation) : (existingCandidate?.preferredWorkLocation || ''),
    referredBy: body.referredBy !== undefined ? normalizeTextValue(body.referredBy) : (existingCandidate?.referredBy || ''),
    selected: parseSelectedFlag(body.selected ?? existingCandidate?.selected ?? ''),
    workAuthorization: body.workAuthorization !== undefined ? normalizeTextValue(body.workAuthorization) : (existingCandidate?.workAuthorization || ''),
    seniorityLevel: body.seniorityLevel !== undefined ? normalizeTextValue(body.seniorityLevel) : (existingCandidate?.seniorityLevel || ''),
    openToWork: body.openToWork !== undefined ? normalizeTextValue(body.openToWork) : (existingCandidate?.openToWork || ''),
    itNonIT: body.itNonIT !== undefined ? normalizeTextValue(body.itNonIT) : (existingCandidate?.itNonIT || ''),
    domainExperience: body.domainExperience !== undefined ? normalizeTextValue(body.domainExperience) : (existingCandidate?.domainExperience || ''),
    notes: body.notes !== undefined ? normalizeTextValue(body.notes) : (existingCandidate?.notes || ''),
    linkedIn: body.linkedIn !== undefined ? normalizeTextValue(body.linkedIn) : (existingCandidate?.linkedIn || ''),
  };
}

function toPlainCandidate(candidate) {
  return typeof candidate.toObject === 'function'
    ? candidate.toObject()
    : JSON.parse(JSON.stringify(candidate));
}

function isCandidateSharedWithUser(candidate, userId) {
  return (candidate.sharedWith || []).some((item) => String(item.userId) === String(userId));
}

function redactedCandidate(candidate, userId, approvedCandidateIds = new Set()) {
  const plain = toPlainCandidate(candidate);
  const sharedEntry = (plain.sharedWith || []).find((item) => String(item.userId) === String(userId));
  const hasApprovedContactAccess = approvedCandidateIds.has(String(plain._id));
  const canSeeContactDetails = hasApprovedContactAccess || sharedEntry?.accessType === 'full';

  if (!canSeeContactDetails) {
    plain.email = '';
    plain.phone = '';
    plain.linkedIn = '';
    plain.resumeUrl = null;
    plain.notes = '';
  }

  plain.sharedWith = sharedEntry ? [sharedEntry] : [];
  return plain;
}

const candidateRules = [
  body('firstName').trim().escape().notEmpty().withMessage('First name required.'),
  body('lastName').trim().escape().notEmpty().withMessage('Last name required.'),
  body('email').isEmail().trim().withMessage('Valid email required.'),
  body('phone').optional().trim().escape(),
  body('location').optional().trim().escape(),
  body('currentRole').trim().escape().notEmpty().withMessage('Current role required.'),
  body('totalExperience').isFloat({ min: 0, max: 60 }).withMessage('Experience must be 0–60.'),
  body('skills').isArray({ min: 1 }).withMessage('At least one skill required.'),
  body('skills.*').trim().escape(),
  body('primarySkill').optional().trim().escape(),
  body('secondarySkill').optional().trim().escape(),
  body('status').isIn(['Active','Interviewing','Placed','Inactive','Rejected']).withMessage('Invalid status.'),
];

// GET /api/candidates — t-1 and t-2 see all; t-3 sees only shared
router.get('/', async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 't-3') {
      query = { 'sharedWith.userId': req.user.id };
    }
    const candidates = await Candidate.find(query).sort({ createdAt: -1 });

    if (req.user.role !== 't-3') {
      return res.json(candidates);
    }

    const approvedRequests = await ContactAccessRequest.find({
      requestedBy: req.user.id,
      status: 'approved',
    }).select('candidateId');
    const approvedCandidateIds = new Set(approvedRequests.map((r) => String(r.candidateId)));

    res.json(candidates.map((candidate) => redactedCandidate(candidate, req.user.id, approvedCandidateIds)));
  } catch (err) { next(err); }
});

// GET /api/candidates/:id
router.get('/:id', param('id').isMongoId(), validate([param('id').isMongoId()]), async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    // t-3 can only view shared candidates
    if (req.user.role === 't-3') {
      const isShared = isCandidateSharedWithUser(candidate, req.user.id);
      if (!isShared) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const approvedRequests = await ContactAccessRequest.find({
        requestedBy: req.user.id,
        status: 'approved',
        candidateId: candidate._id,
      }).select('candidateId');
      const approvedCandidateIds = new Set(approvedRequests.map((r) => String(r.candidateId)));
      return res.json(redactedCandidate(candidate, req.user.id, approvedCandidateIds));
    }
    res.json(candidate);
  } catch (err) { next(err); }
});

// POST /api/candidates — t-1 and t-2 only
router.post('/', requireRecruiter, validate(candidateRules), async (req, res, next) => {
  try {
    const candidate = await Candidate.create({
      ...normalizeCandidatePayload(req.body),
      addedBy: req.user.id,
      sharedWith: [],
    });
    await AuditLog.create({ action: 'CANDIDATE_ADDED', userId: req.user.id, userName: req.user.name, targetId: candidate._id, targetName: `${candidate.firstName} ${candidate.lastName}`, detail: 'Candidate profile created.' });
    res.status(201).json(candidate);
  } catch (err) { next(err); }
});

// PATCH /api/candidates/:id — t-1 full; t-2 own only
router.patch('/:id', requireRecruiter, validate(candidateRules), async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    // t-2 can only edit their own candidates
    if (req.user.role === 't-2' && String(candidate.addedBy) !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit candidates you added.' });
    }
    const updated = await Candidate.findByIdAndUpdate(
      req.params.id,
      { ...normalizeCandidatePayload(req.body, candidate.toObject()), updatedAt: new Date() },
      { new: true }
    );
    await AuditLog.create({ action: 'CANDIDATE_EDITED', userId: req.user.id, userName: req.user.name, targetId: updated._id, targetName: `${updated.firstName} ${updated.lastName}`, detail: 'Candidate profile updated.' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/candidates/:id — t-1 only
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    await AuditLog.create({ action: 'CANDIDATE_DELETED', userId: req.user.id, userName: req.user.name, targetId: req.params.id, targetName: `${candidate.firstName} ${candidate.lastName}`, detail: 'Candidate permanently deleted.' });
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
});

// POST /api/candidates/bulk — t-1 only; import array of candidates from CSV parse
router.post('/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'candidates array is required.' });
    }
    if (candidates.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 candidates per bulk import.' });
    }

    const created = [];
    const errors  = [];

    for (let i = 0; i < candidates.length; i++) {
      const raw = candidates[i];
      try {
        // Minimal required fields
        if (!raw.firstName || !raw.lastName || !raw.email || !raw.currentRole) {
          errors.push({ row: i + 1, error: 'Missing required fields (firstName, lastName, email, currentRole).' });
          continue;
        }
        const skillsArr = typeof raw.skills === 'string'
          ? raw.skills.split(';').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(raw.skills) ? raw.skills : [];

        const candidate = await Candidate.create({
          ...normalizeCandidatePayload({
            ...raw,
            skills: skillsArr,
          }),
          totalExperience: Number(raw.totalExperience) || 0,
          status: ['Active','Interviewing','Placed','Inactive','Rejected'].includes(raw.status)
            ? raw.status : 'Active',
          addedBy: req.user.id,
          sharedWith: [],
        });
        created.push(candidate);
        await AuditLog.create({
          action: 'CANDIDATE_ADDED', userId: req.user.id, userName: req.user.name,
          targetId: candidate._id, targetName: `${candidate.firstName} ${candidate.lastName}`,
          detail: 'Candidate added via bulk CSV import.',
        });
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    res.status(201).json({ created: created.length, errors });
  } catch (err) { next(err); }
});

// PATCH /api/candidates/:id/share — t-1 and t-2
router.patch('/:id/share', requireRecruiter, async (req, res, next) => {
  try {
    const { clientUserId, accessType = 'partial' } = req.body;
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

    const index = candidate.sharedWith.findIndex((item) => String(item.userId) === clientUserId);
    let actionDetail = '';
    
    if (index > -1) {
      // Check if we are updating accessType, or removing it if same accessType
      if (candidate.sharedWith[index].accessType === accessType) {
        candidate.sharedWith.splice(index, 1);
        actionDetail = `Unshared from user ${clientUserId}.`;
      } else {
        candidate.sharedWith[index].accessType = accessType;
        actionDetail = `Updated access for user ${clientUserId} to ${accessType}.`;
      }
    } else {
      candidate.sharedWith.push({ userId: clientUserId, accessType });
      actionDetail = `Shared with user ${clientUserId} (${accessType} access).`;
    }

    candidate.updatedAt = new Date();
    await candidate.save();

    await AuditLog.create({
      action: 'PROFILE_SHARED',
      userId: req.user.id,
      userName: req.user.name,
      targetId: candidate._id,
      targetName: `${candidate.firstName} ${candidate.lastName}`,
      detail: actionDetail
    });

    res.json(candidate);
  } catch (err) { next(err); }
});

export default router;
