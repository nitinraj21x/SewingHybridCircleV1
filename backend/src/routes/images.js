/**
 * images.js — Cloudinary image upload/delete routes
 *
 * POST /api/images/upload
 *   Accepts multipart/form-data with up to 10 images in the "images" field.
 *   Streams each file buffer to Cloudinary; returns array of { url, publicId }.
 *
 * DELETE /api/images/:publicId
 *   Deletes an image from Cloudinary by public_id (admin only).
 */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { upload, uploadToCloudinary, cloudinary } from '../config/cloudinary.js';
import AuditLog from '../models/AuditLog.js';

const router = Router();
router.use(requireAuth);

// POST /api/images/upload
router.post(
  '/upload',
  upload.array('images', 10),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded.' });
      }

      const results = await Promise.all(
        req.files.map((file) =>
          uploadToCloudinary(file.buffer, {
            public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
          })
        )
      );

      const uploaded = results.map((r) => ({
        url:      r.secure_url,
        publicId: r.public_id,
        caption:  '',
      }));

      res.status(201).json({ images: uploaded });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/images/:publicId — admin only
router.delete('/:publicId(*)', requireAdmin, async (req, res, next) => {
  try {
    const { publicId } = req.params;
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result !== 'ok' && result.result !== 'not found') {
      return res.status(500).json({ error: 'Failed to delete image from Cloudinary.' });
    }

    await AuditLog.create({
      action:     'IMAGE_DELETED',
      userId:     req.user.id,
      userName:   req.user.name,
      targetId:   publicId,
      targetName: publicId,
      detail:     `Image "${publicId}" deleted from Cloudinary.`,
    });

    res.json({ message: 'Image deleted.', publicId });
  } catch (err) {
    next(err);
  }
});

export default router;
