/**
 * resumes.js — resume extraction endpoint
 *
 * POST /api/resumes/extract
 *   Multipart file upload with field name "resume".
 *   Returns canonical extraction JSON plus a portal-friendly payload.
 */
import { Router } from 'express';
import multer from 'multer';
import { requireRecruiter } from '../middleware/auth.js';
import { parseResumeUpload } from '../utils/resume/index.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/octet-stream',
    ]);
    const allowedExtensions = /\.(pdf|doc|docx|txt|png|jpe?g|webp)$/i;
    if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported resume format.'));
    }
  },
});

function buildUnsupportedImageResponse(file) {
  return {
    success: true,
    extraction: {
      schemaVersion: '2.0.0-local',
      document: {
        type: 'image',
        pages: 1,
        layout: { type: 'image', columns: 1, confidence: 0.1 },
        source: file.originalname,
        textLength: 0,
      },
      personal: {},
      professional: {},
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      languages: [],
      links: {},
      preferences: {},
      metadata: {
        parserVersion: '2.0.0-local',
        source: {
          fileName: file.originalname,
          mimeType: file.mimetype,
        },
        warnings: [
          'OCR is not configured in this environment.',
          'Image-based resumes can be uploaded, but extraction will be partial until OCR is enabled.',
        ],
        status: 'partial',
        confidence: { overall: 0.05 },
      },
      candidateProfile: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        location: '',
        locationOptions: [],
        noticePeriod: '2 weeks',
        currentRole: '',
        currentCompany: '',
        totalExperience: 0,
        primarySkill: '',
        secondarySkill: '',
        skills: [],
        education: [],
        workHistory: [],
        notes: '',
        linkedIn: '',
      },
    },
    warnings: [
      'OCR is not configured in this environment.',
      'Image-based resumes can be uploaded, but extraction will be partial until OCR is enabled.',
    ],
    metadata: {
      parserVersion: '2.0.0-local',
      status: 'partial',
      processingTimeMs: 0,
      confidence: { overall: 0.05 },
    },
  };
}

router.post('/extract', requireRecruiter, upload.single('resume'), async (req, res, next) => {
  const startedAt = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resume file is required.' });
    }

    if (/^image\//i.test(req.file.mimetype)) {
      const response = buildUnsupportedImageResponse(req.file);
      response.metadata.processingTimeMs = Date.now() - startedAt;
      return res.status(200).json(response);
    }

    const result = await parseResumeUpload(req.file);
    const payload = {
      ...result.summary,
      payload: result.payload,
      metadata: {
        ...result.summary.metadata,
        processingTimeMs: Date.now() - startedAt,
      },
    };

    return res.status(200).json(payload);
  } catch (err) {
    if (err?.message === 'Unsupported resume format.') {
      return res.status(415).json({ success: false, error: err.message });
    }
    if (err?.name === 'MulterError') {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

export default router;
