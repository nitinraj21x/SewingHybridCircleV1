/**
 * auth.js — POST /api/auth/login
 * Verifies credentials against MongoDB, issues JWT.
 * Client (t-3) sessions with sessionExpiresAt are rejected after expiry.
 */
import { Router }   from 'express';
import bcrypt       from 'bcryptjs';
import jwt          from 'jsonwebtoken';
import { body }     from 'express-validator';
import { validate } from '../middleware/validate.js';
import User         from '../models/User.js';

const router = Router();

const loginRules = [
  body('email').isEmail().normalizeEmail().trim(),
  body('password').isLength({ min: 6 }),
];

// POST /api/auth/login
router.post('/login', validate(loginRules), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check session expiry for temporary client accounts
    if (user.isTemporary && user.sessionExpiresAt && new Date() > user.sessionExpiresAt) {
      return res.status(401).json({ error: 'Your access has expired. Please contact the admin.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id:               user._id,
        name:             user.name,
        email:            user.email,
        role:             user.role,
        avatar:           user.avatar,
        isTemporary:      user.isTemporary,
        sessionExpiresAt: user.sessionExpiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

export default router;
