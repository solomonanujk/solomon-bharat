import { Rfq } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLog';
import { PaginationQuery } from '../../utils/pagination';
import { storageProvider } from '../../providers/storage';
import { RfqsRepository, rfqsRepository } from './rfqs.repository';
import { CreateRfqDto, UpdateRfqDto } from './rfqs.validation';

export interface UploadedImageFile {
  buffer: Buffer;
  originalname: string;
}

export const MAX_RFQ_IMAGES = 5;

/** Custom requirements are enquiries handled by the Solomon team, never routed to a seller. */
export class RfqsService {
  constructor(private readonly repo: RfqsRepository = rfqsRepository) {}

  async create(userId: string, input: CreateRfqDto, files: UploadedImageFile[] = []): Promise<Rfq> {
    if (files.length > MAX_RFQ_IMAGES) {
      throw AppError.badRequest(`At most ${MAX_RFQ_IMAGES} reference images`);
    }
    if (input.productId && !(await this.repo.productExists(input.productId))) {
      throw AppError.badRequest('Product not found');
    }
    const uploads = await Promise.all(
      files.map((f, i) => storageProvider.uploadImage(f.buffer, `${Date.now()}-${i}-${f.originalname}`, `rfqs/${userId}`)),
    );
    return this.repo.create({
      userId,
      productId: input.productId ?? null,
      description: input.description,
      quantity: input.quantity,
      targetPrice: input.targetPrice ?? null,
      currency: input.currency ?? null,
      destinationCountry: input.destinationCountry,
      deadline: input.deadline ?? null,
      referenceImages: uploads.map((u) => u.url),
    });
  }

  listMine(userId: string, pagination: PaginationQuery) {
    return this.repo.listForUser(userId, pagination);
  }

  listForAdmin(status: Rfq['status'] | undefined, pagination: PaginationQuery) {
    return this.repo.listForAdmin(status, pagination);
  }

  async update(adminId: string, id: string, input: UpdateRfqDto): Promise<Rfq> {
    const rfq = await this.repo.findById(id);
    if (!rfq) {
      throw AppError.notFound('Request not found');
    }
    const updated = await this.repo.update(id, input);
    await writeAuditLog(adminId, 'RFQ_UPDATED', 'Rfq', id, { from: rfq.status, ...input });
    return updated;
  }
}

export const rfqsService = new RfqsService();
