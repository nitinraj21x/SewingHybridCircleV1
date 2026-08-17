/**
 * contactRequests.js — /api/contact-requests
 *
 * POST   /api/contact-requests            — client (t-3) requests contact access
 * GET    /api/contact-requests            — t-1 gets all requests (with ?status=pending|approved|denied)
 * GET    /api/contact-requests/mine       — t-3 gets their own requests
 * PATCH  /api/contact-requests/:id/review — t-1 approves or denies a request
 */
import { Router }    from 'express';
import { body }      from 'express-validator';
import { requireAuth, requireAdmin, requireAnyUser } from '../middleware/auth.js';
import { validate }  from '../middleware/validate.js';
import ContactAccessRequest from '../models/ContactAccessRequest.js';
import Candidate     from '../models/Candidate.js';
import AuditLog      from '../models/AuditLog.js';

const router = Router();
router.use(requireAuth);

// ── Client submits a contact-access request ───────────────────────────────────
router.post(
  '/',
  requireAnyUser,
  validate([
    body('candidateId').isMongoId().withMessage('Valid candidateId required.'),
    body('note').optional().trim().isLength({ max: 500 }),
  ]),
  async (req, res, next) => {
    try {
      // Only t-3 clients should be requesting this
      if (req.user.role !== 't-3') {
        return res.status(403).json({ error: 'Only clients can request contact access.' });
      }

      const { candidateId, note } = req.body;

      const candidate = await Candidate.findById(candidateId);
      if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

      // Check that this candidate is shared with the requester
      const isShared = candidate.sharedWith.some(item => String(item.userId) === req.user.id);
      if (!isShared) {
        return res.status(403).json({ error: 'This profile has not been shared with you.' });
      }

      // Check for existing pending request
      const existing = await ContactAccessRequest.findOne({
        candidateId,
        requestedBy: req.user.id,
        status: 'pending',
      });
      if (existing) {
        return res.status(409).json({ error: 'You already have a pending request for this candidate.' });
      }

      const request = await ContactAccessRequest.create({
        candidateId,
        candidateName:     `${candidate.firstName} ${candidate.lastName}`,
        requestedBy:       req.user.id,
        requestedByName:   req.user.name,
        requestedByEmail:  req.user.email,
        note: note || '',
      });

      await AuditLog.create({
        action: 'CONTACT_ACCESS_REQUESTED',
        userId: req.user.id, userName: req.user.name,
        targetId: candidate._id, targetName: `${candidate.firstName} ${candidate.lastName}`,
        detail: `Client requested contact details access.`,
      });

      res.status(201).json(request);
    } catch (err) { next(err); }
  },
);

// ── t-1 gets all requests (optionally filtered by status) ────────────────────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ['pending', 'approved', 'denied'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const requests = await ContactAccessRequest.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) { next(err); }
});

// ── t-3 gets their own requests ──────────────────────────────────────────────
router.get('/mine', async (req, res, next) => {
  try {
    const requests = await ContactAccessRequest.find({ requestedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) { next(err); }
});

// ── t-1 reviews (approve / deny) a request ───────────────────────────────────
router.patch(
  '/:id/review',
  requireAdmin,
  validate([
    body('status').isIn(['approved', 'denied']).withMessage('Status must be approved or denied.'),
  ]),
  async (req, res, next) => {
    try {
      const request = await ContactAccessRequest.findById(req.params.id);
      if (!request) return res.status(404).json({ error: 'Request not found.' });
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'This request has already been reviewed.' });
      }

      request.status         = req.body.status;
      request.reviewedBy     = req.user.id;
      request.reviewedByName = req.user.name;
      request.reviewedAt     = new Date();
      await request.save();

      await AuditLog.create({
        action: req.body.status === 'approved' ? 'CONTACT_ACCESS_APPROVED' : 'CONTACT_ACCESS_DENIED',
        userId: req.user.id, userName: req.user.name,
        targetId: request.candidateId, targetName: request.candidateName,
        detail: `Contact access request from ${request.requestedByName} was ${req.body.status}.`,
      });

      res.json(request);
    } catch (err) { next(err); }
  },
);

export default router;
