/**
 * cloudinary.js — Cloudinary image URL registry
 *
 * All images are hosted on Cloudinary. Replace the CLOUD_NAME and each
 * public_id with the actual values after uploading to your Cloudinary account.
 *
 * URL pattern:
 *   https://res.cloudinary.com/<CLOUD_NAME>/image/upload/<transformations>/<public_id>
 *
 * Helper: cloudinaryUrl(publicId, transforms)
 *   Returns a full Cloudinary delivery URL with optional transformations.
 *   Defaults to quality-auto + format-auto for optimal delivery.
 *
 * Environment override:
 *   Set VITE_CLOUDINARY_CLOUD_NAME in your .env file.
 */

export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'abvjgsog';

// cache-bust: 1

/**
 * Build a Cloudinary image URL.
 * @param {string} publicId  - Cloudinary public ID (e.g. 'sewing-circle/logo')
 * @param {string} [transforms] - Optional Cloudinary transformation string
 * @returns {string}
 */
export function cloudinaryUrl(publicId, transforms = 'q_auto,f_auto') {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

// ── Image public IDs ──────────────────────────────────────────────────────────
// Update these after uploading images to Cloudinary.
// Suggested folder structure: sewing-circle/<category>/<filename>

export const IMAGES = {
  // ── Logo
  logo: cloudinaryUrl('sewing-circle/logo/logoSWTransparent'),

  // ── Hero (background)
  heroBg: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',

  // ── Static backgrounds
  aboutUs:  cloudinaryUrl('sewing-circle/backgrounds/abtUsImg'),
  visionBg: cloudinaryUrl('sewing-circle/backgrounds/visionBg'),

  // ── Event images — 2025
  feb25_1:  cloudinaryUrl('sewing-circle/events/2025/February/feb1'),
  feb25_2:  cloudinaryUrl('sewing-circle/events/2025/February/feb2'),
  april25_1: cloudinaryUrl('sewing-circle/events/2025/April/april1'),
  april25_2: cloudinaryUrl('sewing-circle/events/2025/April/april2'),
  april25_3: cloudinaryUrl('sewing-circle/events/2025/April/april3'),
  june25_1: cloudinaryUrl('sewing-circle/events/2025/June/june1'),
  june25_2: cloudinaryUrl('sewing-circle/events/2025/June/june2'),
  oct25_1:  cloudinaryUrl('sewing-circle/events/2025/October/oct1'),
  oct25_2:  cloudinaryUrl('sewing-circle/events/2025/October/oct2'),
  oct25_3:  cloudinaryUrl('sewing-circle/events/2025/October/oct3'),
  dec25_1:  cloudinaryUrl('sewing-circle/events/2025/December/dec1'),
  dec25_2:  cloudinaryUrl('sewing-circle/events/2025/December/dec2'),

  // ── Event images — 2026
  feb26_1:  cloudinaryUrl('sewing-circle/events/2026/February/feb26'),
};
