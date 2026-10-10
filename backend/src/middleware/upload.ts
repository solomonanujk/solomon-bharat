import { NextFunction, Request, Response } from 'express';
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
  limits: { fileSize: MAX_VIDEO_FILE_SIZE_BYTES, files: 14 },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 3 },
  { name: 'craftImage', maxCount: 1 },
]);

// ─── Spreadsheet uploads (product import from a Shopify/WooCommerce export) ─────

export const MAX_SPREADSHEET_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type SpreadsheetKind = 'csv' | 'xlsx';

// Browsers/OSes are inconsistent about the mimetype they attach to a spreadsheet
// (Windows + Excel installed sends application/vnd.ms-excel for .csv; some clients
// fall back to application/octet-stream), so the extension decides the kind and the
// mimetype only has to be plausible for it. The parser then checks the real bytes.
const SPREADSHEET_MIME_TYPES: Record<SpreadsheetKind, Set<string>> = {
  csv: new Set([
    'text/csv',
    'application/csv',
    'text/x-csv',
    'text/comma-separated-values',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ]),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream']),
};

/** Returns the spreadsheet kind for a filename, or null when the extension isn't one we accept. */
export function spreadsheetKindFromFilename(filename: string): SpreadsheetKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

function spreadsheetFileFilter(_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  const kind = spreadsheetKindFromFilename(file.originalname);
  if (!kind || !SPREADSHEET_MIME_TYPES[kind].has(file.mimetype.toLowerCase())) {
    cb(AppError.badRequest('Upload a .csv or .xlsx spreadsheet'));
    return;
  }
  cb(null, true);
}

const spreadsheetMulter = multer({
  storage,
  fileFilter: spreadsheetFileFilter,
  limits: { fileSize: MAX_SPREADSHEET_FILE_SIZE_BYTES, files: 1 },
}).single('file');

/** Single `file` field, memory storage, 5MB. Multer's own errors (oversize, wrong
 *  field name) are converted to 400s here — the global error handler doesn't know
 *  about MulterError and would otherwise answer 500. */
export function uploadSpreadsheet(req: Request, res: Response, next: NextFunction): void {
  spreadsheetMulter(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large — the maximum is 5 MB'
          : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
            ? 'Upload exactly one spreadsheet in the "file" field'
            : err.message;
      next(AppError.badRequest(message));
      return;
    }
    next(err as Error | undefined);
  });
}
