# Cloudinary Upload List

All images that need to be uploaded to Cloudinary for the kiroIntegrated project.

## Setup

1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com) (free tier is sufficient)
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary Dashboard
3. Fill in `.env.example` → `.env` (frontend) and `backend/.env.example` → `backend/.env`
4. Upload each image below to your Cloudinary account using the **exact public ID** shown

---

## How to Upload

**Option A — Cloudinary Dashboard (Manual)**
1. Go to Media Library → Create the folder path → Upload the image
2. After upload, rename the asset's public ID to match exactly what's listed below

**Option B — Cloudinary CLI**
```bash
npx cloudinary-cli upload <local-file> --public-id <public-id> --folder sewing-circle/...
```

**Option C — Bulk upload script**
Run from the kS1 project (which still has the local files):
```bash
node scripts/uploadToCloudinary.js
```
(See the script template at the bottom of this file)

---

## Images to Upload

### Logo

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/logo/logoSWTransparent.png` | `sewing-circle/logo/logoSWTransparent` | Navigation, loading overlay |

---

### Backgrounds

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/backgrounds/abtUsImg.jpg` | `sewing-circle/backgrounds/abtUsImg` | About Us section |
| `src/public-site/image/backgrounds/visionBg.png` | `sewing-circle/backgrounds/visionBg` | Vision section background |

---

### Event Photos — 2025 February

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2025/February/feb1.jpg` | `sewing-circle/events/2025/February/feb1` | EventsSection, EventSlider |
| `src/public-site/image/2025/February/feb2.jpg` | `sewing-circle/events/2025/February/feb2` | EventsSection modal gallery |

---

### Event Photos — 2025 April

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2025/April/april1.jpg` | `sewing-circle/events/2025/April/april1` | EventsSection, EventSlider |
| `src/public-site/image/2025/April/april2.jpg` | `sewing-circle/events/2025/April/april2` | EventsSection modal gallery |
| `src/public-site/image/2025/April/april3.jpg` | `sewing-circle/events/2025/April/april3` | EventsSection modal gallery |

---

### Event Photos — 2025 June

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2025/June/june1.jpg` | `sewing-circle/events/2025/June/june1` | EventsSection, EventSlider |
| `src/public-site/image/2025/June/june2.jpg` | `sewing-circle/events/2025/June/june2` | EventsSection modal gallery |

---

### Event Photos — 2025 October

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2025/October/oct1.png` | `sewing-circle/events/2025/October/oct1` | EventsSection, EventSlider |
| `src/public-site/image/2025/October/oct2.png` | `sewing-circle/events/2025/October/oct2` | EventsSection modal gallery |
| `src/public-site/image/2025/October/oct3.png` | `sewing-circle/events/2025/October/oct3` | EventsSection modal gallery |

---

### Event Photos — 2025 December

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2025/December/dec1.jpg` | `sewing-circle/events/2025/December/dec1` | EventsSection, EventSlider |
| `src/public-site/image/2025/December/dec2.jpg` | `sewing-circle/events/2025/December/dec2` | EventsSection modal gallery |

---

### Event Photos — 2026 February

| Local File (in kS1) | Cloudinary Public ID | Used In |
|---|---|---|
| `src/public-site/image/2026/Feb/feb26.jpg` | `sewing-circle/events/2026/February/feb26` | EventsSection, EventSlider |

---

## Total: 18 images

| Category | Count |
|---|---|
| Logo | 1 |
| Backgrounds | 2 |
| Event photos (2025 Feb) | 2 |
| Event photos (2025 April) | 3 |
| Event photos (2025 June) | 2 |
| Event photos (2025 October) | 3 |
| Event photos (2025 December) | 2 |
| Event photos (2026 February) | 1 |
| **Total** | **16** |

> **Note:** The Hero section background uses an Unsplash URL and does not need to be uploaded.
> The portal watermark (`src/portal/assets/watermark.png`) is used in the kS1 version only; kiroIntegrated uploads directly to Cloudinary.

---

## Bulk Upload Script Template

Create `scripts/uploadToCloudinary.js` in the kS1 project and run it once:

```js
// scripts/uploadToCloudinary.js
// Run from the kS1 project root: node scripts/uploadToCloudinary.js
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploads = [
  // [localPath, publicId]
  ['src/public-site/image/logo/logoSWTransparent.png',   'sewing-circle/logo/logoSWTransparent'],
  ['src/public-site/image/backgrounds/abtUsImg.jpg',     'sewing-circle/backgrounds/abtUsImg'],
  ['src/public-site/image/backgrounds/visionBg.png',     'sewing-circle/backgrounds/visionBg'],
  ['src/public-site/image/2025/February/feb1.jpg',       'sewing-circle/events/2025/February/feb1'],
  ['src/public-site/image/2025/February/feb2.jpg',       'sewing-circle/events/2025/February/feb2'],
  ['src/public-site/image/2025/April/april1.jpg',        'sewing-circle/events/2025/April/april1'],
  ['src/public-site/image/2025/April/april2.jpg',        'sewing-circle/events/2025/April/april2'],
  ['src/public-site/image/2025/April/april3.jpg',        'sewing-circle/events/2025/April/april3'],
  ['src/public-site/image/2025/June/june1.jpg',          'sewing-circle/events/2025/June/june1'],
  ['src/public-site/image/2025/June/june2.jpg',          'sewing-circle/events/2025/June/june2'],
  ['src/public-site/image/2025/October/oct1.png',        'sewing-circle/events/2025/October/oct1'],
  ['src/public-site/image/2025/October/oct2.png',        'sewing-circle/events/2025/October/oct2'],
  ['src/public-site/image/2025/October/oct3.png',        'sewing-circle/events/2025/October/oct3'],
  ['src/public-site/image/2025/December/dec1.jpg',       'sewing-circle/events/2025/December/dec1'],
  ['src/public-site/image/2025/December/dec2.jpg',       'sewing-circle/events/2025/December/dec2'],
  ['src/public-site/image/2026/Feb/feb26.jpg',           'sewing-circle/events/2026/February/feb26'],
];

for (const [localPath, publicId] of uploads) {
  const fullPath = path.join(__dirname, localPath);
  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      public_id:        publicId,
      overwrite:        false,
      unique_filename:  false,
      use_filename:     false,
    });
    console.log(`✓ ${publicId} → ${result.secure_url}`);
  } catch (err) {
    console.error(`✗ ${publicId}: ${err.message}`);
  }
}
```
