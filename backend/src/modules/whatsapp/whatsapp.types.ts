/** Media limits for files a seller sends over WhatsApp (WhatsApp itself caps video at 16 MB). */
export const WHATSAPP_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_MAX_VIDEO_BYTES = 16 * 1024 * 1024;

export const WHATSAPP_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const WHATSAPP_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'other';
