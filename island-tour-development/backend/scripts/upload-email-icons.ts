/**
 * upload-email-icons.ts - publishes the booking-email line icons to Cloudinary.
 *
 * Run:  pnpm email:icons:upload   (from backend/)
 *
 * Why this exists:
 *   The locked wireframe (technical-doc/emails/island-tours-booking-confirmation-email-wireframe.html)
 *   draws its 14 icon sites with inline <svg>. Gmail strips <svg> outright and
 *   Outlook's Word rendering engine never supported it, so inline SVG would ship
 *   blank gutters to most travelers. The icons are therefore rasterized by
 *   Cloudinary (f_png) and referenced as <img>, which every mail client renders.
 *
 *   The .svg files in src/mail/templates/icons/ stay the source of truth: they
 *   are the wireframe paths verbatim, so re-running this script re-publishes
 *   them. Cloudinary is a delivery cache, never the origin.
 *
 * Idempotent: overwrite + invalidate means re-runs replace the asset in place
 * and purge the CDN, so the template URLs never change.
 */
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/** Mirrors CLOUDINARY_ROOT_FOLDER in src/media-gallery/cloudinary.service.ts. */
const ROOT_FOLDER = 'islandtours';
const ICON_FOLDER = `${ROOT_FOLDER}/email/icons`;
const ICON_DIR = path.join(
  __dirname,
  '..',
  'src',
  'mail',
  'templates',
  'icons',
);

/**
 * Every icon is delivered at 34px and displayed at its wireframe size (16 or
 * 17px). One width keeps the template to a single {emailIconBase} token, and a
 * 34 -> 16 downscale stays crisp where an upscale would not.
 */
const DELIVERY_WIDTH = 34;

async function main(): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in backend/.env',
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const files = fs
    .readdirSync(ICON_DIR)
    .filter((f) => f.endsWith('.svg'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .svg files found in ${ICON_DIR}`);
  }

  console.log(`Uploading ${files.length} icons to ${ICON_FOLDER}/ ...\n`);

  for (const file of files) {
    const publicId = path.basename(file, '.svg');
    const result = await cloudinary.uploader.upload(path.join(ICON_DIR, file), {
      folder: ICON_FOLDER,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
    });
    console.log(`  ok  ${publicId.padEnd(16)} -> ${result.public_id}`);
  }

  const base = `https://res.cloudinary.com/${cloudName}/image/upload/f_png,w_${DELIVERY_WIDTH}/${ICON_FOLDER}`;
  console.log(`\nemailIconBase token value:\n  ${base}\n`);
  console.log('Example rendered src:');
  console.log(`  ${base}/icon-pin.png`);
}

main().catch((err: unknown) => {
  console.error('\nUpload failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
