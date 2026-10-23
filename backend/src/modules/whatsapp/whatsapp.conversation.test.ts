import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboundMessage, WhatsAppProvider } from '../../providers/whatsapp';
import { AppError } from '../../utils/errors';
import {
  MAX_MESSAGES_PER_HOUR,
  MessageLog,
  ProductsPort,
  ProductSummary,
  SellerLookup,
  WhatsAppConversation,
} from './whatsapp.conversation';

const PORTAL = 'https://app.example.com/portal/settings';

const products: ProductSummary[] = [
  { id: 'p1', name: 'Banarasi Silk Saree', approvalStatus: 'APPROVED', rejectionReason: null, declaredStock: 5 },
  { id: 'p2', name: 'Brass Lamp', approvalStatus: 'REJECTED', rejectionReason: 'Photos are blurry', declaredStock: 0 },
  { id: 'p3', name: 'Cotton Saree', approvalStatus: 'PENDING', rejectionReason: null, declaredStock: 12 },
];

function msg(body: string, media: InboundMessage['media'] = []): InboundMessage {
  return { providerMessageId: 'SM1', from: '+919876543210', body, media };
}

function build(withFlow = false) {
  const sellers = { findSellerByWhatsAppNumber: vi.fn().mockResolvedValue({ id: 's1' }) } satisfies SellerLookup;
  const port = {
    listForSeller: vi.fn().mockResolvedValue({ data: products, total: products.length }),
    setStockForSeller: vi.fn().mockResolvedValue({}),
    resubmitProduct: vi.fn().mockResolvedValue({}),
  } satisfies ProductsPort;
  const log = { countSince: vi.fn().mockResolvedValue(1) } satisfies MessageLog;
  const provider: WhatsAppProvider = {
    sendText: vi.fn().mockResolvedValue(undefined),
    verifyWebhook: vi.fn(),
    parseInbound: vi.fn(),
    downloadMedia: vi.fn(),
  };
  const flow = { findSession: vi.fn().mockResolvedValue(null), handle: vi.fn().mockResolvedValue(undefined) };
  const conversation = new WhatsAppConversation(sellers, port, log, provider, PORTAL, withFlow ? flow : undefined);
  const sent = () => vi.mocked(provider.sendText).mock.calls.map((c) => c[1]);
  return { conversation, sellers, port, log, provider, sent, flow };
}

describe('WhatsAppConversation', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  describe('unlinked numbers', () => {
    beforeEach(() => ctx.sellers.findSellerByWhatsAppNumber.mockResolvedValue(null));

    it('tells a stranger how to link, once', async () => {
      await ctx.conversation.handle(msg('hello'));
      expect(ctx.sent()).toHaveLength(1);
      expect(ctx.sent()[0]).toContain(PORTAL);
      expect(ctx.port.listForSeller).not.toHaveBeenCalled();
    });

    it('stays silent when the stranger already wrote today', async () => {
      ctx.log.countSince.mockResolvedValue(2);
      await ctx.conversation.handle(msg('hello'));
      expect(ctx.sent()).toHaveLength(0);
    });
  });

  it('stays silent after the hourly cap', async () => {
    ctx.log.countSince.mockResolvedValue(MAX_MESSAGES_PER_HOUR + 1);
    await ctx.conversation.handle(msg('list'));
    expect(ctx.sent()).toHaveLength(0);
  });

  it('answers help', async () => {
    await ctx.conversation.handle(msg('help'));
    expect(ctx.sent()[0]).toContain('seller help');
  });

  it('lists products with numbers, status, stock and the rejection reason', async () => {
    await ctx.conversation.handle(msg('list'));
    const text = ctx.sent()[0];
    expect(text).toContain('1. Banarasi Silk Saree');
    expect(text).toContain('Approved | stock 5');
    expect(text).toContain('2. Brass Lamp');
    expect(text).toContain('Reason: Photos are blurry');
    expect(text).toContain('Waiting for approval');
  });

  it('replies in Hinglish to a Hinglish message', async () => {
    await ctx.conversation.handle(msg('mere products dikhao'));
    expect(ctx.sent()[0]).toContain('Aapke products');
  });

  it('says so when there are no products', async () => {
    ctx.port.listForSeller.mockResolvedValue({ data: [], total: 0 });
    await ctx.conversation.handle(msg('status'));
    expect(ctx.sent()[0]).toContain('no products yet');
  });

  describe('stock', () => {
    it('sets stock by list position', async () => {
      await ctx.conversation.handle(msg('stock 1 20'));
      expect(ctx.port.setStockForSeller).toHaveBeenCalledWith('s1', 'p1', 20);
      expect(ctx.sent()[0]).toContain('"Banarasi Silk Saree" stock is now 20');
    });

    it('sets stock by name', async () => {
      await ctx.conversation.handle(msg('stock brass 7'));
      expect(ctx.port.setStockForSeller).toHaveBeenCalledWith('s1', 'p2', 7);
    });

    it('marks out of stock as zero', async () => {
      await ctx.conversation.handle(msg('out of stock 3'));
      expect(ctx.port.setStockForSeller).toHaveBeenCalledWith('s1', 'p3', 0);
      expect(ctx.sent()[0]).toContain('out of stock');
    });

    it('asks which one when the name matches several products, and changes nothing', async () => {
      await ctx.conversation.handle(msg('stock saree 5'));
      expect(ctx.port.setStockForSeller).not.toHaveBeenCalled();
      expect(ctx.sent()[0]).toContain('More than one product matches');
    });

    it('says not found for an unknown product or position', async () => {
      await ctx.conversation.handle(msg('stock 9 5'));
      await ctx.conversation.handle(msg('stock vase 5'));
      expect(ctx.port.setStockForSeller).not.toHaveBeenCalled();
      expect(ctx.sent().every((t) => t.includes('could not find'))).toBe(true);
    });

    it('rejects an absurd quantity', async () => {
      await ctx.conversation.handle(msg('stock 1 5000000'));
      expect(ctx.port.setStockForSeller).not.toHaveBeenCalled();
      expect(ctx.sent()[0]).toContain('That did not work');
    });

    it('relays a service error to the seller', async () => {
      ctx.port.setStockForSeller.mockRejectedValue(AppError.badRequest('This product is made to order'));
      await ctx.conversation.handle(msg('stock 1 5'));
      expect(ctx.sent()[0]).toContain('made to order');
    });

    it('hides unexpected errors behind a generic message', async () => {
      ctx.port.setStockForSeller.mockRejectedValue(new Error('db password leaked'));
      await ctx.conversation.handle(msg('stock 1 5'));
      expect(ctx.sent()[0]).not.toContain('db password');
      expect(ctx.sent()[0]).toContain('Something went wrong');
    });
  });

  describe('resubmit', () => {
    it('resubmits a rejected product', async () => {
      await ctx.conversation.handle(msg('resubmit 2'));
      expect(ctx.port.resubmitProduct).toHaveBeenCalledWith('s1', 'p2');
      expect(ctx.sent()[0]).toContain('sent for review again');
    });

    it('refuses a product that is not rejected', async () => {
      await ctx.conversation.handle(msg('resubmit 1'));
      expect(ctx.port.resubmitProduct).not.toHaveBeenCalled();
      expect(ctx.sent()[0]).toContain('is not rejected');
    });
  });

  describe('photos', () => {
    const photo = [{ url: 'https://api.twilio.com/m', contentType: 'image/jpeg' }];

    it('answers the first photo of a burst only', async () => {
      await ctx.conversation.handle(msg('', photo));
      expect(ctx.sent()[0]).toContain('coming soon');

      ctx.log.countSince.mockResolvedValue(2);
      await ctx.conversation.handle(msg('', photo));
      expect(ctx.sent()).toHaveLength(1);
    });

    it('still runs a command that arrives with media', async () => {
      await ctx.conversation.handle(msg('list', photo));
      expect(ctx.sent()[0]).toContain('Your products');
    });
  });

  it('says it did not understand free text', async () => {
    await ctx.conversation.handle(msg('what is the weather'));
    expect(ctx.sent()[0]).toContain('did not understand');
  });

  it('does not throw when the reply cannot be sent', async () => {
    vi.mocked(ctx.provider.sendText).mockRejectedValue(new Error('twilio down'));
    await expect(ctx.conversation.handle(msg('help'))).resolves.toBeUndefined();
  });
});

describe('WhatsAppConversation help text', () => {
  it('tells the seller how to add a product and no longer says it is coming soon', async () => {
    const ctx = build();
    await ctx.conversation.handle(msg('help'));
    expect(ctx.sent()[0]).toContain('*add*');
    expect(ctx.sent()[0]).not.toContain('coming soon');
  });

  it('says the same in Hindi and Hinglish', async () => {
    const ctx = build();
    await ctx.conversation.handle(msg('मदद'));
    await ctx.conversation.handle(msg('madad'));
    expect(ctx.sent()[0]).toContain('*add*');
    expect(ctx.sent()[1]).toContain('*add*');
    expect(ctx.sent().join(' ')).not.toMatch(/जल्द आ रहा|jaldi aa raha/);
  });
});

describe('WhatsAppConversation with the listing flow', () => {
  let ctx: ReturnType<typeof build>;
  const photo = [{ url: 'https://api.twilio.com/m', contentType: 'image/jpeg' }];
  beforeEach(() => {
    ctx = build(true);
  });

  it('hands photos to the listing flow instead of the "coming soon" reply', async () => {
    await ctx.conversation.handle(msg('', photo));
    expect(ctx.flow.handle).toHaveBeenCalledTimes(1);
    expect(ctx.flow.handle.mock.calls[0][0]).toMatchObject({ sellerId: 's1', session: null });
    expect(ctx.sent()).toHaveLength(0);
  });

  it('opens a listing on "add"', async () => {
    await ctx.conversation.handle(msg('add product'));
    expect(ctx.flow.handle).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary commands working when no listing is open', async () => {
    await ctx.conversation.handle(msg('list'));
    await ctx.conversation.handle(msg('stock 1 5'));
    expect(ctx.flow.handle).not.toHaveBeenCalled();
    expect(ctx.port.setStockForSeller).toHaveBeenCalledWith('s1', 'p1', 5);
  });

  describe('while a listing is open', () => {
    beforeEach(() => ctx.flow.findSession.mockResolvedValue({ phone: '+919876543210' }));

    it('treats stock-like words as part of the product, not as a stock command', async () => {
      await ctx.conversation.handle(msg('stock 50 pieces ready'));
      expect(ctx.flow.handle).toHaveBeenCalledTimes(1);
      expect(ctx.port.setStockForSeller).not.toHaveBeenCalled();
    });

    it('sends answers, done, yes and cancel to the flow', async () => {
      for (const text of ['brass diya 250 rupees', 'done', 'yes', 'cancel']) await ctx.conversation.handle(msg(text));
      expect(ctx.flow.handle).toHaveBeenCalledTimes(4);
    });

    it('still answers help and list normally', async () => {
      await ctx.conversation.handle(msg('help'));
      await ctx.conversation.handle(msg('list'));
      expect(ctx.flow.handle).not.toHaveBeenCalled();
      expect(ctx.sent()).toHaveLength(2);
    });
  });

  it('tells the seller when the flow crashes, without throwing', async () => {
    ctx.flow.handle.mockRejectedValue(new Error('boom'));
    await expect(ctx.conversation.handle(msg('', photo))).resolves.toBeUndefined();
    expect(ctx.sent()[0]).toContain('Something went wrong');
  });
});
