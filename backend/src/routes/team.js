/**
 * team.js — Admin-only team management routes
 *
 * GET    /api/team              — list all users (admin)
 * POST   /api/team/invite       — invite a client (t-3) with temp password + expiry
 * POST   /api/team/staff        — add a staff member (t-1 or t-2)
 * PATCH  /api/team/:id/extend   — extend a client's session expiry
 * PATCH  /api/team/:id/deactivate — deactivate any user
 * DELETE /api/team/:id          — permanently delete a user
 */
import { Router }      from 'express';
import { body }        from 'express-validator';
import bcrypt          from 'bcryptjs';
import { randomInt }   from 'node:crypto';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate }    from '../middleware/validate.js';
import User            from '../models/User.js';
import AuditLog        from '../models/AuditLog.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ── Helper: generate a readable temp password ────────────────────────────────
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) {
    pwd += chars[randomInt(chars.length)];
  }
  // Format as XXX-XXXX-XXX for readability
  return `${pwd.slice(0,3)}-${pwd.slice(3,7)}-${pwd.slice(7)}`;
}

// ── Helper: hours → expiry Date ──────────────────────────────────────────────
function expiryFromHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// GET /api/team — list all users
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/team/invite — invite a client with temp password
const inviteRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('expiryHours').isIn([6, 12, 24, 48]).withMessage('expiryHours must be 6, 12, 24, or 48'),
];

router.post('/invite', validate(inviteRules), async (req, res, next) => {
  try {
    const { name, email, expiryHours } = req.body;

    // Check for existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // If already exists, just reset their password and extend session
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const sessionExpiresAt = expiryFromHours(expiryHours);

      existing.passwordHash    = passwordHash;
      existing.sessionExpiresAt = sessionExpiresAt;
      existing.isTemporary     = true;
      existing.active          = true;
      existing.invitedBy       = req.user.id;
      await existing.save();

      await AuditLog.create({
        action: 'CLIENT_REINVITED', userId: req.user.id, userName: req.user.name,
        targetId: existing._id, targetName: existing.name,
        detail: `Client re-invited with ${expiryHours}h session. Temp password reset.`,
      });

      return res.json({
        user: { id: existing._id, name: existing.name, email: existing.email, role: existing.role, sessionExpiresAt },
        tempPassword,
        message: `Access reset for ${existing.name}. Session expires in ${expiryHours}h.`,
      });
    }

    // New client
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const sessionExpiresAt = expiryFromHours(expiryHours);
    const avatar = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    const user = await User.create({
      name,
      email,
      passwordHash,
      role:             't-3',
      avatar,
      active:           true,
      isTemporary:      true,
      invitedBy:        req.user.id,
      sessionExpiresAt,
    });

    await AuditLog.create({
      action: 'CLIENT_INVITED', userId: req.user.id, userName: req.user.name,
      targetId: user._id, targetName: user.name,
      detail: `Client invited with ${expiryHours}h session window.`,
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, sessionExpiresAt },
      tempPassword,
      message: `Invite created for ${name}. Share the temp password — it won't be shown again.`,
    });
  } catch (err) { next(err); }
});

// POST /api/team/staff — add a staff member (t-1 or t-2)
const staffRules = [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['t-1', 't-2']).withMessage('Role must be t-1 or t-2'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

router.post('/staff', validate(staffRules), async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const avatar = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    const user = await User.create({
      name, email, passwordHash, role, avatar,
      active: true, isTemporary: false,
    });

    await AuditLog.create({
      action: 'STAFF_ADDED', userId: req.user.id, userName: req.user.name,
      targetId: user._id, targetName: user.name,
      detail: `Staff member added: ${name} (${role}).`,
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      message: `${name} added as ${role === 't-1' ? 'Admin' : 'Recruiter'}.`,
    });
  } catch (err) { next(err); }
});

// PATCH /api/team/:id/extend — extend client session
router.patch('/:id/extend', async (req, res, next) => {
  try {
    const { expiryHours } = req.body;
    if (![6, 12, 24, 48].includes(Number(expiryHours))) {
      return res.status(400).json({ error: 'expiryHours must be 6, 12, 24, or 48.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.sessionExpiresAt = expiryFromHours(Number(expiryHours));
    user.active = true;
    await user.save();

    await AuditLog.create({
      action: 'SESSION_EXTENDED', userId: req.user.id, userName: req.user.name,
      targetId: user._id, targetName: user.name,
      detail: `Session extended by ${expiryHours}h. New expiry: ${user.sessionExpiresAt.toISOString()}.`,
    });

    res.json({ sessionExpiresAt: user.sessionExpiresAt });
  } catch (err) { next(err); }
});

// PATCH /api/team/:id/deactivate — toggle active
router.patch('/:id/deactivate', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    user.active = !user.active;
    await user.save();

    await AuditLog.create({
      action: user.active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      userId: req.user.id, userName: req.user.name,
      targetId: user._id, targetName: user.name,
      detail: `User ${user.active ? 'activated' : 'deactivated'}.`,
    });

    res.json({ active: user.active });
  } catch (err) { next(err); }
});

// DELETE /api/team/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    await user.deleteOne();

    await AuditLog.create({
      action: 'USER_DELETED', userId: req.user.id, userName: req.user.name,
      targetId: req.params.id, targetName: user.name,
      detail: `User "${user.name}" (${user.role}) permanently deleted.`,
    });

    res.json({ message: 'User deleted.' });
  } catch (err) { next(err); }
});

export default router;
