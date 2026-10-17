import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadedFile, UploadedImage } from './storageProvider.types';

export class CloudinaryStorageProvider implements StorageProvider {
  constructor(cloudinaryUrl: string) {
    // The Cloudinary SDK reads CLOUDINARY_URL from process.env by default;
    // setting it explicitly here keeps the provider self-contained/testable.
    cloudinary.config({ cloudinary_url: cloudinaryUrl } as never);
  }

  uploadImage(buffer: Buffer, filename: string, folder: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: filename, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  uploadFile(buffer: Buffer, filename: string, folder: string): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        // 'raw' is required for non-image binaries (e.g. PDFs) — Cloudinary's
        // 'image' resource type only accepts image formats.
        { folder, public_id: filename, resource_type: 'raw' },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  uploadVideo(buffer: Buffer, filename: string, folder: string): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      // Chunked upload (6MB parts), which Cloudinary needs for videos over ~20MB.
      // `upload_chunked_stream` is the v2 API for this: `upload_large_stream` exists
      // only on the v1 uploader, so `cloudinary.v2.uploader.upload_large_stream` is
      // undefined and calling it threw "is not a function" on every video upload.
      // The extension is dropped from public_id: Cloudinary adds the format itself.
      const stream = cloudinary.uploader.upload_chunked_stream(
        {
          folder,
          public_id: filename.replace(/\.[^./]+$/, ''),
          resource_type: 'video',
          chunk_size: 6_000_000,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary video upload failed'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }
}
