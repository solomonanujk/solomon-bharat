import { ProductApprovalStatus, ProductSource } from '@prisma/client';
import { PaginationQuery } from '../../utils/pagination';
import { productsService } from '../products/products.service';
import { ListingDraft } from './whatsapp.listing';
import { SessionWithSeller, WhatsAppAdminRepository } from './whatsapp.admin.repository';
import { WhatsAppAdminSummary, WhatsAppLinkedSeller, WhatsAppLiveListing } from './whatsapp.admin.types';

export function toLiveListing(session: SessionWithSeller): WhatsAppLiveListing {
  const draft = (session.collected ?? {}) as ListingDraft;
  return {
    sellerId: session.sellerId,
    businessName: session.seller.businessName,
    phone: session.phone,
    state: session.state,
    language: session.language,
    productName: draft.name ?? null,
    categoryPath: draft.categoryPath ?? null,
    missing: session.missing,
    photoCount: session.imageUrls.length,
    videoCount: session.videoUrls.length,
    aiCalls: session.aiCalls,
    startedAt: session.createdAt,
    lastMessageAt: session.lastMessageAt,
    expiresAt: session.expiresAt,
  };
}

export class WhatsAppAdminService {
  constructor(private readonly repo = new WhatsAppAdminRepository()) {}

  async summary(): Promise<WhatsAppAdminSummary> {
    const [pendingProducts, liveListings, linkedSellers] = await Promise.all([
      this.repo.countPendingProducts(),
      this.repo.countLiveSessions(new Date()),
      this.repo.countLinkedSellers(),
    ]);
    return { pendingProducts, liveListings, linkedSellers };
  }

  /** Products created by chat, in the same shape as the main admin products list. */
  products(filter: { approvalStatus?: ProductApprovalStatus; sellerId?: string }, pagination: PaginationQuery) {
    return productsService.listForAdmin({ ...filter, source: ProductSource.WHATSAPP }, pagination);
  }

  async liveListings(pagination: PaginationQuery): Promise<{ data: WhatsAppLiveListing[]; total: number }> {
    const { data, total } = await this.repo.findLiveSessions(new Date(), pagination);
    return { data: data.map(toLiveListing), total };
  }

  async linkedSellers(
    filter: { search?: string },
    pagination: PaginationQuery,
  ): Promise<{ data: WhatsAppLinkedSeller[]; total: number }> {
    const { data, total } = await this.repo.findLinkedSellers(filter, pagination);
    const ids = data.map((s) => s.id);
    const day = new Date().toISOString().slice(0, 10);
    const [products, calls] = await Promise.all([
      this.repo.countWhatsAppProductsBySeller(ids),
      this.repo.aiCallsOn(ids, day),
    ]);
    return {
      data: data.map((s) => ({
        sellerId: s.id,
        businessName: s.businessName,
        whatsappNumber: s.whatsappNumber ?? '',
        linkedAt: s.whatsappVerifiedAt,
        productsByChat: products.get(s.id) ?? 0,
        aiCallsToday: calls.get(s.id) ?? 0,
      })),
      total,
    };
  }
}

export const whatsAppAdminService = new WhatsAppAdminService();
