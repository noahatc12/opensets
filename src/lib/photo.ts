/**
 * Progress photo sizing (2026-10). A phone photo is 3 to 5 MB at 12 MP; shrunk to
 * 1,600 px on the long edge it stays sharp on any phone screen at a few hundred KB,
 * so the photo store and the backups that now carry photos stay small.
 *
 * Shrinking must never cost a photo: any failure (a format this browser cannot
 * decode, no canvas, a canvas that will not encode) keeps the original file.
 */

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.85;

/** Scale (width, height) so the long edge is at most `max`. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Photo could not be decoded.'));
    };
    img.src = url;
  });
}

/**
 * A JPEG no larger than PHOTO_MAX_EDGE on its long edge. Drawing through an <img>
 * applies the camera's EXIF rotation, so a portrait photo stays upright. A JPEG
 * already within the limit is kept as it is.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  try {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return file;
    }
    const img = await loadImage(file);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;
    if (Math.max(w, h) <= PHOTO_MAX_EDGE && file.type === 'image/jpeg') {
      return file;
    }
    const size = fitWithin(w, h, PHOTO_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY),
    );
    return out ?? file;
  } catch {
    return file;
  }
}
