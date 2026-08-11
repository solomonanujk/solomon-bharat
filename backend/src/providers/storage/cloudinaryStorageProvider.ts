import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadedImage } from './storageProvider.types';

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
}
