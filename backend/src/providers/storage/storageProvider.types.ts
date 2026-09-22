export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface UploadedFile {
  url: string;
  publicId?: string;
}

export interface StorageProvider {
  uploadImage(buffer: Buffer, filename: string, folder: string): Promise<UploadedImage>;
  deleteImage(publicId: string): Promise<void>;
  /** For non-image binaries (e.g. generated PDFs) — uses raw/generic file storage rather than image transformation. */
  uploadFile(buffer: Buffer, filename: string, folder: string): Promise<UploadedFile>;
  /** Product videos (PRD §8.5/§9.6-adjacent — Faire-parity Images & Videos section). */
  uploadVideo(buffer: Buffer, filename: string, folder: string): Promise<UploadedFile>;
}
