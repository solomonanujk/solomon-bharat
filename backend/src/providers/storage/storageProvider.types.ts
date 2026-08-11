export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface StorageProvider {
  uploadImage(buffer: Buffer, filename: string, folder: string): Promise<UploadedImage>;
  deleteImage(publicId: string): Promise<void>;
}
