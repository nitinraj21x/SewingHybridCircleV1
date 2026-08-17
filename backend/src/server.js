/**
 * server.js — Sewing Circle kiroIntegrated Express API
 *
 * Security stack:
 *   helmet          — secure HTTP headers
 *   cors            — restrict to frontend origin only
 *   express-rate-limit — brute-force protection
 *   express-validator  — input sanitization on every route
 *   bcryptjs        — password hashing
 *   jsonwebtoken    — stateless auth tokens
 *   mongoose        — MongoDB ODM
 *   cloudinary      — image hosting (upload/delete via /api/images)
 *   multer          — multipart file handling for image uploads
 */
import 'dotenv/config';
import express      from 'express';
import helmet       from 'helmet';
import cors         from 'cors';
import rateLimit    from 'express-rate-limit';
import mongoose     from 'mongoose';

import authRoutes            from './routes/auth.js';
import candidateRoutes       from './routes/candidates.js';
import jobRoutes             from './routes/jobs.js';
import eventRoutes           from './routes/events.js';
import auditRoutes           from './routes/audit.js';
import imageRoutes           from './routes/images.js';
import teamRoutes            from './routes/team.js';
import contactRequestRoutes  from './routes/contactRequests.js';
import resumeRoutes          from './routes/resumes.js';

const app  = express();
const PORT = globalThis.process?.env?.PORT || 4000;

// ── Trust Render's reverse proxy (fixes rate-limiter IP detection) ────────────
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — only allow the frontend origin ─────────────────────────────────────
app.use(cors({
  origin:      globalThis.process?.env?.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));   // 10MB for base64 images
app.use(express.urlencoded({ extended: true }));

// ── Global rate limiter — 100 req / 15 min per IP ────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Stricter limiter for auth endpoints ───────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api/auth/', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/jobs',       jobRoutes);
app.use('/api/events',     eventRoutes);
app.use('/api/audit',      auditRoutes);
app.use('/api/images',     imageRoutes);
app.use('/api/team',            teamRoutes);
app.use('/api/contact-requests', contactRequestRoutes);
app.use('/api/resumes',    resumeRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message,
  });
});

// ── Connect to MongoDB then start ─────────────────────────────────────────────
// Note: candidate seeding is intentionally NOT run on startup.
// Data is already seeded. To re-seed run: npm run seed:candidates
mongoose
  .connect(globalThis.process?.env?.MONGODB_URI)
  .then(() => {
    console.log('[db] Connected to MongoDB Atlas');
    app.listen(PORT, () => console.log(`[server] Running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[db] Connection failed:', err.message);
    globalThis.process.exit(1);
  });
