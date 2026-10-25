import { describe, expect, it, vi } from 'vitest';
import { InboundMessage, WhatsAppProvider } from '../../providers/whatsapp';
import { BulkPort, ProductsPort, SellerLookup, WhatsAppConversation } from './whatsapp.conversation';
import { parseCommand } from './whatsapp.commands';

/** How a seller's message is routed when admin has sent bulk messages: replies vs listing vs commands. */

const PHONE = '+919876543210';
const msg = (body: string, media: InboundMessage['media'] = [], id = 'm1'): InboundMessage => ({
  providerMessageId: id,
  from: PHONE,
  body,
  media,
});
const photo = { url: 'u', contentType: 'image/jpeg' };

function build(opts: { session?: unknown; recentBulk?: boolean; firstReply?: boolean } = {}) {
  const sellers = { findSellerByWhatsAppNumber: vi.fn().mockResolvedValue({ id: 's1' }) } satisfies SellerLookup;
  const port = {
    listForSeller: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    setStockForSeller: vi.fn(),
    resubmitProduct: vi.fn(),
  } satisfies ProductsPort;
  const provider: WhatsAppProvider = {
    sendText: vi.fn().mockResolvedValue(undefined),
    verifyWebhook: vi.fn(),
    parseInbound: vi.fn(),
    downloadMedia: vi.fn(),
  };
  const flow = { findSession: vi.fn().mockResolvedValue(opts.session ?? null), handle: vi.fn().mockResolvedValue(undefined) };
  const bulk = {
    recordReply: vi.fn().mockResolvedValue(opts.recentBulk ? { firstReply: opts.firstReply ?? true } : null),
    hasRecentBulkMessage: vi.fn().mockResolvedValue(opts.recentBulk ?? false),
    setOptOut: vi.fn().mockResolvedValue(undefined),
  } satisfies BulkPort;
  const conversation = new WhatsAppConversation(sellers, port, { countSince: vi.fn().mockResolvedValue(1) }, provider, 'https://app/portal/settings', flow, bulk);
  return { conversation, flow, bulk, port, sent: () => vi.mocked(provider.sendText).mock.calls.map((c) => c[1]) };
}

describe('a reply to a bulk message', () => {
  it('is saved for admin, acknowledged once, and never reaches the listing bot', async () => {
    const t = build({ recentBulk: true, firstReply: true });
    await t.conversation.handle(msg('Thanks, will do'));
    expect(t.bulk.recordReply).toHaveBeenCalled();
    expect(t.flow.handle).not.toHaveBeenCalled();
    expect(t.sent()).toHaveLength(1);
    expect(t.sent()[0]).toContain('team has your message');
    expect(t.sent()[0]).not.toContain('did not understand');
  });

  it('stays silent for a second reply to the same campaign', async () => {
    const t = build({ recentBulk: true, firstReply: false });
    await t.conversation.handle(msg('One more thing'));
    expect(t.bulk.recordReply).toHaveBeenCalled();
    expect(t.sent()).toEqual([]);
  });

  it('treats "ok" and a tapped quick-reply button as replies, not as listing commands', async () => {
    for (const body of ['ok', 'Interested', 'done']) {
      const t = build({ recentBulk: true });
      await t.conversation.handle(msg(body));
      expect(t.bulk.recordReply).toHaveBeenCalled();
      expect(t.flow.handle).not.toHaveBeenCalled();
    }
  });

  it('falls back to the normal "did not understand" when no broadcast was sent recently', async () => {
    const t = build({ recentBulk: false });
    await t.conversation.handle(msg('Thanks, will do'));
    expect(t.bulk.recordReply).toHaveBeenCalled();
    expect(t.sent()[0]).toContain('did not understand');
  });
});

describe('listing and commands keep working around a broadcast', () => {
  it('an open listing wins: the text goes to the listing flow, not to the replies', async () => {
    const t = build({ session: { state: 'COLLECTING' }, recentBulk: true });
    await t.conversation.handle(msg('brass diya 250 rupees'));
    expect(t.flow.handle).toHaveBeenCalled();
    expect(t.bulk.recordReply).not.toHaveBeenCalled();
  });

  it('photos still start a listing', async () => {
    const t = build({ recentBulk: true });
    await t.conversation.handle(msg('', [photo]));
    expect(t.flow.handle).toHaveBeenCalled();
    expect(t.bulk.recordReply).not.toHaveBeenCalled();
  });

  it('"add" still starts a listing', async () => {
    const t = build({ recentBulk: true });
    await t.conversation.handle(msg('add'));
    expect(t.flow.handle).toHaveBeenCalled();
    expect(t.bulk.recordReply).not.toHaveBeenCalled();
  });

  it('"list", "help" and stock commands still run', async () => {
    for (const body of ['list', 'help', 'stock 1 5', 'out of stock 1', 'hello']) {
      const t = build({ recentBulk: true });
      await t.conversation.handle(msg(body));
      expect(t.bulk.recordReply).not.toHaveBeenCalled();
      expect(t.sent().length).toBeGreaterThan(0);
    }
  });
});

describe('stopping and resuming broadcasts', () => {
  it('"unsubscribe" opts the seller out, even in the middle of a listing', async () => {
    const t = build({ session: { state: 'COLLECTING' } });
    await t.conversation.handle(msg('unsubscribe'));
    expect(t.bulk.setOptOut).toHaveBeenCalledWith('s1', true);
    expect(t.flow.handle).not.toHaveBeenCalled();
    expect(t.sent()[0]).toContain('no longer get announcements');
  });

  it('"subscribe" opts back in', async () => {
    const t = build();
    await t.conversation.handle(msg('subscribe'));
    expect(t.bulk.setOptOut).toHaveBeenCalledWith('s1', false);
    expect(t.sent()[0]).toContain('again');
  });

  it('a plain "stop" right after a broadcast opts out', async () => {
    const t = build({ recentBulk: true });
    await t.conversation.handle(msg('STOP'));
    expect(t.bulk.setOptOut).toHaveBeenCalledWith('s1', true);
    expect(t.bulk.recordReply).not.toHaveBeenCalled();
  });

  it('a plain "stop" with no recent broadcast is still just "cancel"', async () => {
    const t = build({ recentBulk: false });
    await t.conversation.handle(msg('stop'));
    expect(t.bulk.setOptOut).not.toHaveBeenCalled();
  });

  it('"stop" during a listing still cancels the listing', async () => {
    const t = build({ session: { state: 'COLLECTING' }, recentBulk: true });
    await t.conversation.handle(msg('stop'));
    expect(t.flow.handle).toHaveBeenCalled();
    expect(t.bulk.setOptOut).not.toHaveBeenCalled();
  });
});

describe('parseCommand opt-out words', () => {
  it('recognises explicit phrases without stealing the listing words', () => {
    expect(parseCommand('Unsubscribe').kind).toBe('optOut');
    expect(parseCommand('stop messages').kind).toBe('optOut');
    expect(parseCommand('opt out').kind).toBe('optOut');
    expect(parseCommand('subscribe').kind).toBe('optIn');
    expect(parseCommand('stop').kind).toBe('cancel');
    expect(parseCommand('start').kind).toBe('help');
  });
});
