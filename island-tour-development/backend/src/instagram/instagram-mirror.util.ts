import { CloudinaryService } from '@/media-gallery/cloudinary.service';

/**
 * Delete a synced tile's mirrored Cloudinary assets - the image (poster) and,
 * for a reel, the video. Best-effort: `CloudinaryService.deleteFile` never
 * throws, so a dead asset never blocks the DB delete that precedes it.
 *
 * Shared by the two places a tile disappears - the sync's "gone post" cleanup
 * and the admin DELETE endpoint - so neither can leak an orphaned asset the
 * other cleans up. (Without this, a manual delete left the Cloudinary pair
 * behind forever, and a delete-then-resync re-mirrored the post under a new
 * public id, doubling the orphans.)
 */
export async function deleteInstagramMirror(
  cloudinary: CloudinaryService,
  imagePublicId: string | null,
  videoPublicId: string | null,
): Promise<void> {
  if (imagePublicId) await cloudinary.deleteFile(imagePublicId);
  if (videoPublicId) await cloudinary.deleteFile(videoPublicId);
}
