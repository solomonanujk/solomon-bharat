import { WhatsAppSessionState } from '@prisma/client';

export interface WhatsAppAdminSummary {
  /** WhatsApp products waiting for admin approval. */
  pendingProducts: number;
  /** Listings a seller is in the middle of right now. */
  liveListings: number;
  /** Sellers with a verified WhatsApp number. */
  linkedSellers: number;
}

/** A listing in progress. The seller's raw messages are deliberately not included. */
export interface WhatsAppLiveListing {
  sellerId: string;
  businessName: string;
  phone: string;
  state: WhatsAppSessionState;
  language: string;
  productName: string | null;
  categoryPath: string | null;
  /** Fields still to be answered, in question order. */
  missing: string[];
  photoCount: number;
  videoCount: number;
  aiCalls: number;
  startedAt: Date;
  lastMessageAt: Date;
  expiresAt: Date;
}

export interface WhatsAppLinkedSeller {
  sellerId: string;
  businessName: string;
  whatsappNumber: string;
  linkedAt: Date | null;
  productsByChat: number;
  aiCallsToday: number;
}
