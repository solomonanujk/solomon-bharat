import multer from 'multer';
import { AppError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

function fileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
});

const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
export const MAX_VIDEO_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;

function productMediaFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (file.fieldname === 'videos') {
    if (!ALLOWED_VIDEO_MIME_TYPES.has(file.mimetype)) {
      cb(AppError.badRequest(`Unsupported video type: ${file.mimetype}`));
      return;
    }
  } else if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

// A single combined multer instance for product create/update routes, handling both
// the "images" and "videos" fields in one pass — two separate multer instances can't
// each parse the same multipart request (the underlying stream is only readable
// once), so `.fields()` is required whenever a route accepts more than one file field.
// The instance-wide fileSize limit has to accommodate the larger of the two (video);
// the per-image 5MB cap is enforced explicitly in products.service.ts after upload.
export const uploadProductMedia = multer({
  storage,
  fileFilter: productMediaFileFilter,
  limits: { fileSize: MAX_VIDEO_FILE_SIZE_BYTES, files: 13 },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 3 },
]);
