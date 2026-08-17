import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { body }   from 'express-validator';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import Event    from '../models/Event.js';
import AuditLog from '../models/AuditLog.js';

const router = Router();

const eventRules = [
  body('title').trim().escape().notEmpty(),
  body('date').trim().escape().notEmpty(),
  body('location').trim().escape().notEmpty(),
  body('type').isIn(['upcoming', 'past']),
  body('eventDate').optional().isISO8601().toDate(),
  body('description').optional().trim(),
  body('images').optional().isArray(),
  body('images.*.url').optional().trim(),
  body('images.*.caption').optional().trim().escape(),
];

function maybeAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), globalThis.process?.env?.JWT_SECRET);
  } catch {
    // Anonymous fallback for the public site. Protected routes still use requireAuth.
  }
  next();
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function parseEventDate(dateLabel, fallbackDate = null) {
  if (fallbackDate) return new Date(fallbackDate);
  const raw = String(dateLabel || '').trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);

  const monthNames = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  };

  const cleaned = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    const month = monthNames[parts[0].toLowerCase()];
    if (month !== undefined) return new Date(new Date().getFullYear(), month, 1);
  }

  if (parts.length === 2) {
    const month = monthNames[parts[0].toLowerCase()];
    const second = Number(parts[1]);
    if (month !== undefined && Number.isFinite(second)) {
      if (second > 31) {
        return new Date(second, month, 1);
      }
      return new Date(new Date().getFullYear(), month, second);
    }
  }

  if (parts.length >= 2) {
    const month = monthNames[parts[0].toLowerCase()];
    const day = Number(parts[1]);
    const year = Number(parts[2]);
    if (month !== undefined && Number.isFinite(day) && Number.isFinite(year)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeEventPayload(body, existingEvent = null) {
  const date = String(body.date ?? existingEvent?.date ?? '').trim();
  const parsedDate = parseEventDate(date, body.eventDate || existingEvent?.eventDate);
  const shouldAutoArchive = String(body.type || existingEvent?.type || 'upcoming') === 'upcoming'
    && parsedDate
    && parsedDate < startOfToday();

  return {
    title: String(body.title ?? existingEvent?.title ?? '').trim(),
    date,
    eventDate: parsedDate || null,
    time: String(body.time ?? existingEvent?.time ?? '').trim(),
    location: String(body.location ?? existingEvent?.location ?? '').trim(),
    venueUrl: String(body.venueUrl ?? existingEvent?.venueUrl ?? '').trim(),
    theme: String(body.theme ?? existingEvent?.theme ?? '').trim(),
    teaser: String(body.teaser ?? existingEvent?.teaser ?? '').trim(),
    description: String(body.description ?? existingEvent?.description ?? '').trim(),
    participants: body.participants === '' || body.participants === null || body.participants === undefined
      ? null
      : Number(body.participants),
    facilitator: String(body.facilitator ?? existingEvent?.facilitator ?? '').trim(),
    duration: String(body.duration ?? existingEvent?.duration ?? '2 hours').trim() || '2 hours',
    images: Array.isArray(body.images) ? body.images : (existingEvent?.images || []),
    coverImageIndex: Number.isFinite(Number(body.coverImageIndex))
      ? Number(body.coverImageIndex)
      : Number(existingEvent?.coverImageIndex ?? 0),
    type: shouldAutoArchive ? 'past' : String(body.type ?? existingEvent?.type ?? 'upcoming'),
    published: shouldAutoArchive ? false : true,
    needsAdminReview: shouldAutoArchive ? true : false,
    reviewRequestedAt: shouldAutoArchive
      ? (existingEvent?.reviewRequestedAt || new Date())
      : null,
    publishedAt: shouldAutoArchive
      ? (existingEvent?.publishedAt || null)
      : new Date(),
  };
}

async function syncEventLifecycle() {
  const events = await Event.find();
  const today = startOfToday();
  const changes = [];

  for (const event of events) {
    const eventDate = parseEventDate(event.date, event.eventDate);
    const isUpcoming = event.type === 'upcoming';
    const isPastDate = eventDate && eventDate < today;

    if (isUpcoming && isPastDate) {
      const shouldLog = !event.needsAdminReview || event.published !== false;
      event.type = 'past';
      event.published = false;
      event.needsAdminReview = true;
      if (!event.reviewRequestedAt) event.reviewRequestedAt = new Date();
      event.updatedAt = new Date();
      await event.save();
      changes.push({ event, shouldLog });
      continue;
    }

    if (isUpcoming && !isPastDate && event.published !== true) {
      event.published = true;
      event.needsAdminReview = false;
      event.updatedAt = new Date();
      await event.save();
    }
  }

  for (const { event, shouldLog } of changes) {
    if (!shouldLog) continue;
    await AuditLog.create({
      action: 'EVENT_REVIEW_REQUIRED',
      userId: null,
      userName: 'System',
      targetId: event._id,
      targetName: event.title,
      detail: `Event "${event.title}" moved to past events and needs admin review before showing on the public site.`,
    });
  }
}

// Public route for the website
router.get('/public', async (req, res, next) => {
  try {
    await syncEventLifecycle();
    const events = await Event.find({ published: true }).sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// Admin route for the portal
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    await syncEventLifecycle();
    res.json(await Event.find().sort({ createdAt: -1 }));
  } catch (err) {
    next(err);
  }
});

// Backwards-compatible GET — behaves like the public route for anonymous users
router.get('/', maybeAuth, async (req, res, next) => {
  try {
    await syncEventLifecycle();
    const query = req.user?.role === 't-1' ? {} : { published: true };
    const events = await Event.find(query).sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// POST — t-1 only
router.post('/', requireAdmin, validate(eventRules), async (req, res, next) => {
  try {
    const event = await Event.create({
      ...normalizeEventPayload(req.body),
      createdBy: req.user.id,
    });
    await AuditLog.create({ action: 'EVENT_ADDED', userId: req.user.id, userName: req.user.name, targetId: event._id, targetName: event.title, detail: `Event "${event.title}" created.` });
    res.status(201).json(event);
  } catch (err) { next(err); }
});

// PATCH — t-1 only
router.patch('/:id', requireAdmin, validate(eventRules), async (req, res, next) => {
  try {
    const existing = await Event.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found.' });

    const payload = normalizeEventPayload(req.body, existing);
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...payload,
        updatedAt: new Date(),
      },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    await AuditLog.create({ action: 'EVENT_EDITED', userId: req.user.id, userName: req.user.name, targetId: event._id, targetName: event.title, detail: `Event "${event.title}" updated.` });
    res.json(event);
  } catch (err) { next(err); }
});

// DELETE — t-1 only
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    await AuditLog.create({ action: 'EVENT_DELETED', userId: req.user.id, userName: req.user.name, targetId: req.params.id, targetName: event.title, detail: `Event "${event.title}" deleted.` });
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
});

export default router;
