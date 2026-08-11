import fs from 'fs';
import path from 'path';
import { StorageProvider, UploadedImage } from './storageProvider.types';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Dev fallback so image uploads work end-to-end without Cloudinary credentials.
 * Writes to backend/uploads (served statically at /uploads) — swap for
 * CloudinaryStorageProvider once CLOUDINARY_URL is configured (see storage/index.ts).
 */
export class LocalDiskStorageProvider implements StorageProvider {
  async uploadImage(buffer: Buffer, filename: string, folder: string): Promise<UploadedImage> {
    const dir = path.join(UPLOADS_ROOT, folder);
    await fs.promises.mkdir(dir, { recursive: true });
    const relativePath = path.join(folder, filename);
    await fs.promises.writeFile(path.join(UPLOADS_ROOT, relativePath), buffer);
    return { url: `/uploads/${relativePath.replace(/\\/g, '/')}`, publicId: relativePath };
  }

  async deleteImage(publicId: string): Promise<void> {
    const filePath = path.join(UPLOADS_ROOT, publicId);
    await fs.promises.rm(filePath, { force: true });
  }
}

export { UPLOADS_ROOT };
