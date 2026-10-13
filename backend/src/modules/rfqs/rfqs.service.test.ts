import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RfqStatus } from '@prisma/client';

vi.mock('../../providers/storage', () => ({
  storageProvider: { uploadImage: vi.fn(async (_b: Buffer, name: string) => ({ url: `https://img/${name}`, publicId: name })) },
}));
vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn() }));

import { writeAuditLog } from '../../utils/auditLog';
import { RfqsRepository } from './rfqs.repository';
import { RfqsService } from './rfqs.service';

function buildRepo(): RfqsRepository {
  return {
    create: vi.fn(async (data) => ({ id: 'rfq-1', ...data })),
    productExists: vi.fn().mockResolvedValue(true),
    listForUser: vi.fn(),
    listForAdmin: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  } as unknown as RfqsRepository;
}

const INPUT = { description: 'Block-printed cushion covers in our colours', quantity: 500, destinationCountry: 'United Kingdom' };

describe('RfqsService', () => {
  let repo: RfqsRepository;
  let service: RfqsService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = buildRepo();
    service = new RfqsService(repo);
  });

  it('stores the request with uploaded reference image URLs', async () => {
    await service.create('user-1', { ...INPUT, productId: 'p-1', targetPrice: 4.5, currency: 'GBP' }, [
      { buffer: Buffer.from('x'), originalname: 'ref.jpg' },
    ]);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        productId: 'p-1',
        quantity: 500,
        targetPrice: 4.5,
        currency: 'GBP',
        referenceImages: [expect.stringContaining('ref.jpg')],
      }),
    );
  });

  it('rejects an unknown product and too many images', async () => {
    vi.mocked(repo.productExists).mockResolvedValueOnce(false);
    await expect(service.create('u', { ...INPUT, productId: 'nope' })).rejects.toMatchObject({ statusCode: 400 });

    const six = Array.from({ length: 6 }, () => ({ buffer: Buffer.from('x'), originalname: 'a.jpg' }));
    await expect(service.create('u', INPUT, six)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('admin update writes an audit log, 404s on unknown ids', async () => {
    vi.mocked(repo.findById).mockResolvedValueOnce({ id: 'rfq-1', status: RfqStatus.NEW } as never);
    await service.update('admin-1', 'rfq-1', { status: RfqStatus.QUOTED });
    expect(repo.update).toHaveBeenCalledWith('rfq-1', { status: RfqStatus.QUOTED });
    expect(writeAuditLog).toHaveBeenCalledWith('admin-1', 'RFQ_UPDATED', 'Rfq', 'rfq-1', {
      from: RfqStatus.NEW,
      status: RfqStatus.QUOTED,
    });

    vi.mocked(repo.findById).mockResolvedValueOnce(null);
    await expect(service.update('admin-1', 'x', { adminNotes: 'n' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
