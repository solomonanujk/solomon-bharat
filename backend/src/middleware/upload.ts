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
