import { env } from '../../config/env';
import { StorageProvider } from './storageProvider.types';
import { CloudinaryStorageProvider } from './cloudinaryStorageProvider';
import { LocalDiskStorageProvider } from './localDiskStorageProvider';

export const storageProvider: StorageProvider = env.CLOUDINARY_URL
  ? new CloudinaryStorageProvider(env.CLOUDINARY_URL)
  : new LocalDiskStorageProvider();

export * from './storageProvider.types';
export { UPLOADS_ROOT } from './localDiskStorageProvider';
