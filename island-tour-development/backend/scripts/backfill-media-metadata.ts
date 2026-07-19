/**
 * backfill-media-metadata.ts - fills the media_gallery metadata columns
 * (bytes, format, width, height, mimeType) for rows uploaded before those
 * columns existed, by reading each asset from the Cloudinary admin API.
 *
 * Run:  pnpm media:backfill   (from backend/)
 *
 * Notes:
 *  - originalName is NOT recoverable (Cloudinary never stored the client
 *    filename) - those stay null until re-uploaded or named in the dashboard.
 *  - Idempotent: only rows missing bytes/width are touched; re-runs skip
 *    already-filled rows.
 *  - Assets deleted on Cloudinary but still in the DB are logged and skipped.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Audio containers Cloudinary stores under resource_type 'video'. */
const AUDIO_FORMATS = new Set([
  'mp3',
  'wav',
  'ogg',
  'aac',
  'm4a',
  'flac',
  'opus',
  'weba',
  'aiff',
  'amr',
]);

/** Derive a browser mimeType from Cloudinary resource_type + format. */
function deriveMimeType(resourceType: string, format?: string): string | null {
  if (!format) return null;
  const f = format.toLowerCase();
  if (resourceType === 'image') {
    if (f === 'jpg') return 'image/jpeg';
    if (f === 'svg') return 'image/svg+xml';
    if (f === 'ico') return 'image/x-icon';
    if (f === 'tif') return 'image/tiff';
    return `image/${f}`;
  }
  if (resourceType === 'video') {
    if (AUDIO_FORMATS.has(f)) {
      if (f === 'mp3') return 'audio/mpeg';
      if (f === 'm4a') return 'audio/mp4';
      return `audio/${f}`;
    }
    if (f === 'mov') return 'video/quicktime';
    if (f === 'mkv') return 'video/x-matroska';
    return `video/${f}`;
  }
  return null;
}

async function main() {
  const rows = await prisma.mediaGallery.findMany({
    // Audio rows legitimately have no dimensions - they just resolve to no-op
    // updates on re-runs.
    where: { OR: [{ bytes: null }, { width: null }] },
    select: { id: true, publicId: true, resourceType: true },
    orderBy: { uploadedAt: 'asc' },
  });

  console.log(`Backfilling ${rows.length} media rows...`);
  let filled = 0;
  let missing = 0;

  for (const row of rows) {
    try {
      const resource = await cloudinary.api
        .resource(row.publicId, { resource_type: 'image' })
        .catch(() =>
          cloudinary.api.resource(row.publicId, { resource_type: 'video' }),
        );

      await prisma.mediaGallery.update({
        where: { id: row.id },
        data: {
          bytes: resource.bytes ?? undefined,
          format: resource.format ?? undefined,
          width: resource.width ?? undefined,
          height: resource.height ?? undefined,
          mimeType:
            deriveMimeType(resource.resource_type, resource.format) ??
            undefined,
          resourceType: resource.resource_type,
        },
      });
      filled++;
      if (filled % 25 === 0) console.log(`  ${filled}/${rows.length}`);
    } catch (err) {
      missing++;
      console.warn(
        `  SKIP ${row.publicId}: ${(err as Error)?.message ?? 'not found on Cloudinary'}`,
      );
    }
  }

  console.log(`Done. Filled ${filled}, skipped ${missing}.`);
  await prisma.$disconnect();
}

void main();
