/**
 * auth.js — JWT verification + server-side RBAC middleware
 * Every protected API route must call requireAuth() first,
 * then optionally requireRole() to enforce tier restrictions.
 */
import jwt from 'jsonwebtoken';

// ── Verify JWT ────────────────────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, name }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── Require specific role(s) ──────────────────────────────────────────────────
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// ── Convenience shortcuts ─────────────────────────────────────────────────────
export const requireAdmin     = requireRole('t-1');
export const requireRecruiter = requireRole('t-1', 't-2');
export const requireAnyUser   = requireRole('t-1', 't-2', 't-3');
