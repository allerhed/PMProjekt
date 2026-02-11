import sharp from 'sharp';
import { readFile, writeFile } from './storage.service';
import { logger } from '../utils/logger';

const PHOTO_THUMBNAIL_SIZE = { width: 200, height: 200 };
const BLUEPRINT_THUMBNAIL_SIZE = { width: 300, height: 400 };
const THUMBNAIL_QUALITY = 85;

/**
 * Generate a thumbnail for an image stored in S3 or local filesystem.
 * Downloads the original, resizes with sharp, uploads the thumbnail.
 * Returns the storage key of the generated thumbnail.
 */
export async function generateThumbnail(
  sourceKey: string,
  type: 'photo' | 'blueprint',
): Promise<string> {
  const thumbnailKey = buildThumbnailKey(sourceKey);
  const size = type === 'photo' ? PHOTO_THUMBNAIL_SIZE : BLUEPRINT_THUMBNAIL_SIZE;

  try {
    // Download original
    const originalBuffer = await readFile(sourceKey);

    // Resize with sharp
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    // Upload thumbnail
    await writeFile(thumbnailKey, thumbnailBuffer, 'image/jpeg');

    logger.debug({ sourceKey, thumbnailKey, type }, 'Thumbnail generated');

    return thumbnailKey;
  } catch (err) {
    logger.error({ err, sourceKey, type }, 'Failed to generate thumbnail');
    throw err;
  }
}

/**
 * Build the thumbnail key from the source key.
 * E.g., photos/org-1/task-1/photo-1/image.jpg → photos/org-1/task-1/photo-1/thumb_image.jpg
 */
function buildThumbnailKey(sourceKey: string): string {
  const lastSlash = sourceKey.lastIndexOf('/');
  if (lastSlash === -1) {
    return `thumb_${sourceKey}`;
  }
  const dir = sourceKey.substring(0, lastSlash);
  const filename = sourceKey.substring(lastSlash + 1);
  // Replace extension with .jpg for thumbnail
  const baseName = filename.replace(/\.[^.]+$/, '');
  return `${dir}/thumb_${baseName}.jpg`;
}
