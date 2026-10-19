import type { WhatsAppSession } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InboundMessage } from '../../providers/whatsapp';
import { AppError } from '../../utils/errors';
import { ExtractionError, ExtractPatch, ListingExtractor } from './whatsapp.ai';
import { Command, detectLanguage, parseCommand } from './whatsapp.commands';
import { CategoryOption, ListingDraft } from './whatsapp.listing';
import {
  FlowConfig,
  SessionStore,
  WhatsAppListingFlow,
  shortcutPatch,
} from './whatsapp.listing.flow';

const PHONE = '+919876543210';
const SELLER = 's1';

const leaves: CategoryOption[] = [
  { id: 'c-lamp', name: 'Brass Lamps', path: 'Home Decor > Lighting > Brass Lamps' },
  { id: 'c-cotton', name: 'Cotton Sarees', path: 'Textiles > Sarees > Cotton Sarees' },
  { id: 'c-silk', name: 'Silk Sarees', path: 'Textiles > Sarees > Silk Sarees' },
];

const fullPatch: ExtractPatch = {
  name: 'Brass Diya',
  description: 'Hand finished brass diya.',
  categoryText: 'brass lamp',
  materials: 'Brass',
  craftTechnique: 'Hand cast',
  placeOfOrigin: 'Moradabad',
  price: 250,
  moq: 10,
  stock: 100,
  weightKg: 0.2,
  length: 8,
  width: 8,
  height: 4,
  dimensionUnit: 'cm',
  leadTime: '7-10 days',
  careInstructions: 'Wipe dry',
  hsn: '7418',
  hsnSuggested: true,
};

/** In-memory stand-in for the session table and the daily usage counter. */
class MemoryStore implements SessionStore {
  sessions = new Map<string, WhatsAppSession>();
  usage = new Map<string, number>();
  recorded: { input: number; output: number }[] = [];

  async findActive(phone: string) {
    return this.sessions.get(phone) ?? null;
  }
  async start(sellerId: string, phone: string, language: string) {
    const existing = this.sessions.get(phone);
    if (existing) return { session: existing, created: false };
    const session = {
      id: `sess-${phone}`, sellerId, phone, state: 'COLLECTING', language, texts: [], imageUrls: [], videoUrls: [],
      collected: {}, missing: [], aiCalls: 0, lastMessageAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date(),
    } as unknown as WhatsAppSession;
    this.sessions.set(phone, session);
    return { session, created: true };
  }
  private patch(phone: string, data: Partial<WhatsAppSession>) {
    const next = { ...this.sessions.get(phone)!, ...data, lastMessageAt: new Date() } as WhatsAppSession;
    this.sessions.set(phone, next);
    return next;
  }
  async appendText(phone: string, text: string) {
    return this.patch(phone, { texts: [...this.sessions.get(phone)!.texts, text] });
  }
  async appendImage(phone: string, url: string) {
    return this.patch(phone, { imageUrls: [...this.sessions.get(phone)!.imageUrls, url] });
  }
  async appendVideo(phone: string, url: string) {
    return this.patch(phone, { videoUrls: [...this.sessions.get(phone)!.videoUrls, url] });
  }
  async update(phone: string, data: Record<string, unknown>) {
    return this.patch(phone, data as Partial<WhatsAppSession>);
  }
  async delete(phone: string) {
    this.sessions.delete(phone);
  }
  async callsOn(sellerId: string, day: string) {
    return this.usage.get(`${sellerId}:${day}`) ?? 0;
  }
  async recordCall(sellerId: string, day: string, input: number, output: number) {
    const key = `${sellerId}:${day}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + 1);
    this.recorded.push({ input, output });
  }
}

function build(config: Partial<FlowConfig> = {}) {
  const store = new MemoryStore();
  const extractor = { extract: vi.fn().mockResolvedValue({ patch: fullPatch, inputTokens: 100, outputTokens: 30 }) };
  const media = {
    fetch: vi.fn().mockImplementation(async (m: { contentType: string }) => ({
      buffer: Buffer.from('x'),
      contentType: m.contentType,
      kind: m.contentType.startsWith('video/') ? 'video' : 'image',
    })),
  };
  const files = {
    uploadImage: vi.fn().mockImplementation(async (_b: Buffer, name: string) => ({ url: `https://cdn/img-${name}` })),
    uploadVideo: vi.fn().mockImplementation(async (_b: Buffer, name: string) => ({ url: `https://cdn/vid-${name}` })),
  };
  const categories = { leaves: vi.fn().mockResolvedValue(leaves) };
  const products = { createFromWhatsApp: vi.fn().mockResolvedValue({ name: 'Brass Diya' }) };
  const sent: string[] = [];
  const reply = vi.fn().mockImplementation(async (_to: string, body: string) => {
    sent.push(body);
  });
  const scheduled = new Map<string, () => void>();
  const flow = new WhatsAppListingFlow(
    store,
    extractor as unknown as ListingExtractor,
    media,
    files,
    categories,
    products,
    reply,
    { aiEnabled: true, dailyCap: 20, maxAiCallsPerSession: 4, debounceMs: 0, ...config },
    (key, fn) => void scheduled.set(key, fn),
  );

  /** Sends one message through the flow the way the conversation does. */
  const send = async (body: string, media: InboundMessage['media'] = [], lang?: ReturnType<typeof detectLanguage>) => {
    const command: Command = body ? parseCommand(body) : { kind: 'unknown' };
    const message: InboundMessage = { providerMessageId: `SM${Math.random()}`, from: PHONE, body, media };
    await flow.handle({ sellerId: SELLER, message, command, lang: lang ?? detectLanguage(body), session: await flow.findSession(PHONE) });
  };
  /** Runs the debounce timer, as if the seller went quiet. */
  const settle = async () => {
    scheduled.get(PHONE)?.();
    scheduled.delete(PHONE);
    // processLater is fire-and-forget; let it finish.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  const last = () => sent[sent.length - 1];
  const session = () => store.sessions.get(PHONE);
  return { flow, store, extractor, media, files, categories, products, sent, last, send, settle, session, scheduled, reply };
}

const photo = (n = 0) => ({ url: `https://api.twilio.com/m/${n}`, contentType: 'image/jpeg' });

describe('starting a listing', () => {
  it('a photo opens a listing, stores it and replies once, even for a burst', async () => {
    const t = build();
    await Promise.all([t.send('', [photo(1)]), t.send('', [photo(2)]), t.send('', [photo(3)])]);
    expect(t.session()?.imageUrls).toHaveLength(3);
    expect(t.sent.filter((s) => s.includes("Let's add a product"))).toHaveLength(1);
    expect(t.extractor.extract).not.toHaveBeenCalled();
    expect(t.files.uploadImage).toHaveBeenCalledTimes(3);
  });

  it('"add" opens a listing with instructions', async () => {
    const t = build();
    await t.send('add product');
    expect(t.session()).toBeDefined();
    expect(t.last()).toContain("Let's add a product");
  });

  it('replies in Hinglish when the seller writes Hinglish', async () => {
    const t = build();
    await t.send('naya product');
    expect(t.last()).toContain('Chaliye product jodte hain');
  });

  it('refuses voice notes without opening a listing', async () => {
    const t = build();
    await t.send('', [{ url: 'https://api.twilio.com/a', contentType: 'audio/ogg' }]);
    expect(t.session()).toBeUndefined();
    expect(t.last()).toContain('Voice notes do not work yet');
  });

  it('says so when a file cannot be saved and does not open a listing for it', async () => {
    const t = build();
    t.media.fetch.mockRejectedValue(new Error('Unsupported media type: image/heic'));
    await t.send('', [{ url: 'https://api.twilio.com/h', contentType: 'image/heic' }]);
    expect(t.session()).toBeUndefined();
    expect(t.last()).toContain('could not save that file');
  });

  it('keeps videos separate from photos and caps photos at ten', async () => {
    const t = build();
    await t.send('', [photo(0), { url: 'https://api.twilio.com/v', contentType: 'video/mp4' }]);
    expect(t.session()?.videoUrls).toHaveLength(1);
    for (let i = 1; i <= 11; i += 1) await t.send('', [photo(i)]);
    expect(t.session()?.imageUrls).toHaveLength(10);
  });
});

describe('reading the description', () => {
  it('reads buffered text with ONE AI call and asks every missing field in ONE message', async () => {
    const t = build();
    t.extractor.extract.mockResolvedValue({
      patch: { name: 'Brass Diya', categoryText: 'brass lamp', price: 250, materials: 'Brass', hsn: '7418', hsnSuggested: true },
      inputTokens: 90,
      outputTokens: 20,
    });
    await t.send('', [photo(1)]);
    await t.send('brass diya 250 rupees');
    await t.send('hand made');
    expect(t.extractor.extract).not.toHaveBeenCalled(); // still buffering
    await t.settle();

    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    expect(t.extractor.extract.mock.calls[0][0].texts).toEqual(['brass diya 250 rupees', 'hand made']);
    expect(t.session()?.state).toBe('AWAITING_ANSWERS');
    expect(t.session()?.texts).toEqual([]);
    const questions = t.last();
    expect(questions).toContain('I still need these');
    expect(questions).toContain('Minimum order quantity');
    expect(questions).toContain('At least 2 photos');
    expect(questions).not.toContain('Product name');
    expect(questions).not.toContain('Price per piece');
    expect(t.sent.filter((s) => s.includes('I still need'))).toHaveLength(1);
    expect(t.store.recorded).toEqual([{ input: 90, output: 20 }]);
  });

  it('matches the category in code and shows a summary when nothing is missing', async () => {
    const t = build();
    await t.send('', [photo(1), photo(2)]);
    await t.send('everything about the diya');
    await t.settle();
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
    expect((t.session()?.collected as ListingDraft).categoryId).toBe('c-lamp');
    expect(t.last()).toContain('Please check your listing');
    expect(t.last()).toContain('Home Decor > Lighting > Brass Lamps');
    expect(t.last()).toContain('HSN: 7418 (my suggestion, please check)');
  });

  it('"done" reads the text straight away instead of waiting', async () => {
    const t = build();
    await t.send('', [photo(1), photo(2)]);
    await t.send('brass diya');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
  });

  it('does nothing when a newer message re-armed the timer', async () => {
    const t = build({ debounceMs: 25_000 });
    await t.send('', [photo(1)]);
    await t.send('brass diya');
    await t.settle(); // lastMessageAt is "now", far less than the debounce
    expect(t.extractor.extract).not.toHaveBeenCalled();
  });

  it('"done" with nothing sent yet says so', async () => {
    const t = build();
    await t.send('add');
    await t.send('done');
    expect(t.last()).toContain('no details or photos yet');
  });
});

describe('answers', () => {
  it('maps the answers and moves on to the summary', async () => {
    const t = build();
    t.extractor.extract.mockResolvedValueOnce({ patch: { name: 'Brass Diya', categoryText: 'brass lamp' }, inputTokens: 1, outputTokens: 1 });
    await t.send('', [photo(1), photo(2)]);
    await t.send('brass diya');
    await t.send('done');
    expect(t.session()?.state).toBe('AWAITING_ANSWERS');

    t.extractor.extract.mockResolvedValueOnce({ patch: fullPatch, inputTokens: 1, outputTokens: 1 });
    await t.send('250 rupees, moq 10, stock 100, brass, hand cast, Moradabad, 200 g, 8x8x4 cm, 7-10 days, wipe dry');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(2);
    expect(t.extractor.extract.mock.calls[1][0].asked).toContain('price');
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
  });

  it('a lone number answering a lone question skips the AI entirely', async () => {
    const t = build();
    t.extractor.extract.mockResolvedValueOnce({ patch: { ...fullPatch, price: undefined }, inputTokens: 1, outputTokens: 1 });
    await t.send('', [photo(1), photo(2)]);
    await t.send('diya details');
    await t.send('done');
    expect(t.session()?.missing).toEqual(['price']);

    await t.send('₹450');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
    expect((t.session()?.collected as ListingDraft).price).toBe(450);
  });

  it('late photos satisfy a missing-photos question without any AI call', async () => {
    const t = build();
    await t.send('', [photo(1)]);
    await t.send('diya');
    await t.send('done');
    expect(t.session()?.missing).toContain('photos');
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);

    await t.send('', [photo(2)]);
    await t.settle();
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
  });
});

describe('category choice', () => {
  it('offers the close matches and takes the one the seller picks', async () => {
    const t = build();
    t.extractor.extract.mockResolvedValueOnce({
      patch: { ...fullPatch, name: 'Handloom Saree', categoryText: 'saree' },
      inputTokens: 1,
      outputTokens: 1,
    });
    await t.send('', [photo(1), photo(2)]);
    await t.send('handloom saree');
    await t.send('done');
    expect(t.session()?.state).toBe('AWAITING_ANSWERS');
    expect(t.last()).toContain('a) Cotton Sarees');
    expect(t.last()).toContain('b) Silk Sarees');

    t.extractor.extract.mockResolvedValueOnce({ patch: { categoryChoice: 'Silk Sarees' }, inputTokens: 1, outputTokens: 1 });
    await t.send('b');
    await t.send('done');
    expect((t.session()?.collected as ListingDraft).categoryId).toBe('c-silk');
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
  });
});

describe('confirming', () => {
  async function reachSummary() {
    const t = build();
    await t.send('', [photo(1), photo(2), { url: 'https://api.twilio.com/v', contentType: 'video/mp4' }]);
    await t.send('brass diya');
    await t.send('done');
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');
    return t;
  }

  it('"yes" submits for approval with the stored photos and videos, then clears the listing', async () => {
    const t = await reachSummary();
    await t.send('yes');
    expect(t.products.createFromWhatsApp).toHaveBeenCalledTimes(1);
    const [sellerId, input, images, videos] = t.products.createFromWhatsApp.mock.calls[0];
    expect(sellerId).toBe(SELLER);
    expect(input).toMatchObject({ name: 'Brass Diya', categoryId: 'c-lamp', sellerPrice: 250, tariffCode: '7418' });
    expect(images).toHaveLength(2);
    expect(videos).toHaveLength(1);
    expect(t.session()).toBeUndefined();
    expect(t.last()).toContain('is waiting for approval');
  });

  it('confirms in Hindi words too', async () => {
    const t = await reachSummary();
    await t.send('haan');
    expect(t.products.createFromWhatsApp).toHaveBeenCalled();
  });

  it('keeps the listing and explains when submitting fails', async () => {
    const t = await reachSummary();
    t.products.createFromWhatsApp.mockRejectedValue(AppError.badRequest('Products require between 2 and 10 images'));
    await t.send('yes');
    expect(t.session()).toBeDefined();
    expect(t.last()).toContain('Products require between 2 and 10 images');
  });

  it('a correction goes through the AI once and shows the summary again', async () => {
    const t = await reachSummary();
    t.extractor.extract.mockResolvedValueOnce({ patch: { price: 300 }, inputTokens: 1, outputTokens: 1 });
    await t.send('price is 300');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(2);
    expect((t.session()?.collected as ListingDraft).price).toBe(300);
    expect(t.last()).toContain('₹300');
    expect(t.products.createFromWhatsApp).not.toHaveBeenCalled();
  });

  it('"yes" before the listing is complete asks for what is missing instead of submitting', async () => {
    const t = build();
    await t.send('', [photo(1), photo(2)]);
    await t.send('yes');
    expect(t.products.createFromWhatsApp).not.toHaveBeenCalled();
  });

  it('a stray "yes" while collecting is not treated as a description', async () => {
    const t = build();
    await t.send('', [photo(1)]);
    await t.send('yes');
    expect(t.session()?.texts).toEqual([]);
  });
});

describe('number re-linked to another seller', () => {
  it('drops the previous seller listing so the new owner cannot confirm it', async () => {
    const t = build();
    await t.send('', [photo(1), photo(2)]);
    await t.send('brass diya');
    await t.send('done');
    expect(t.session()?.state).toBe('AWAITING_CONFIRM');

    const command = parseCommand('yes');
    const message: InboundMessage = { providerMessageId: 'SMx', from: PHONE, body: 'yes', media: [] };
    await t.flow.handle({ sellerId: 'someone-else', message, command, lang: 'en', session: t.session() ?? null });
    expect(t.products.createFromWhatsApp).not.toHaveBeenCalled();
    expect(t.session()).toBeUndefined();
  });
});

describe('cancel', () => {
  it('discards the listing', async () => {
    const t = build();
    await t.send('', [photo(1)]);
    await t.send('cancel');
    expect(t.session()).toBeUndefined();
    expect(t.last()).toContain('Listing cancelled');
  });
});

describe('AI cost guards', () => {
  it('stops when the daily cap is reached, without calling the AI', async () => {
    const t = build({ dailyCap: 2 });
    const day = new Date().toISOString().slice(0, 10);
    t.store.usage.set(`${SELLER}:${day}`, 2);
    await t.send('', [photo(1), photo(2)]);
    await t.send('diya');
    await t.send('done');
    expect(t.extractor.extract).not.toHaveBeenCalled();
    expect(t.last()).toContain("today's limit");
    expect(t.session()).toBeUndefined();
  });

  it('stops when the AI is switched off', async () => {
    const t = build({ aiEnabled: false });
    await t.send('', [photo(1)]);
    await t.send('diya');
    await t.send('done');
    expect(t.extractor.extract).not.toHaveBeenCalled();
    expect(t.last()).toContain('add the product on the website');
    expect(t.session()).toBeUndefined();
  });

  it('sends the seller to the website after too many rounds on one listing', async () => {
    const t = build({ maxAiCallsPerSession: 1 });
    t.extractor.extract.mockResolvedValue({ patch: { name: 'Diya' }, inputTokens: 1, outputTokens: 1 });
    await t.send('', [photo(1), photo(2)]);
    await t.send('diya');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    await t.send('more words that need reading');
    await t.send('done');
    expect(t.extractor.extract).toHaveBeenCalledTimes(1);
    expect(t.last()).toContain('too many rounds');
    expect(t.session()).toBeUndefined();
  });

  it('counts an unreadable AI reply, drops the text and lets the seller try again', async () => {
    const t = build();
    t.extractor.extract.mockRejectedValue(new ExtractionError('bad json', { inputTokens: 50, outputTokens: 5 }));
    await t.send('', [photo(1), photo(2)]);
    await t.send('diya');
    await t.send('done');
    expect(t.last()).toContain('could not understand that');
    expect(t.session()?.texts).toEqual([]);
    expect(t.store.recorded).toEqual([{ input: 50, output: 5 }]);
  });

  it('keeps the listing when the AI service itself fails', async () => {
    const t = build();
    t.extractor.extract.mockRejectedValue(new Error('network down'));
    await t.send('', [photo(1), photo(2)]);
    await t.send('diya');
    await t.send('done');
    expect(t.last()).toContain('could not understand that');
    expect(t.session()).toBeDefined();
    expect(t.store.recorded).toEqual([]);
  });
});

describe('shortcutPatch', () => {
  it('reads a bare number for a single numeric question', () => {
    expect(shortcutPatch(['price'], ['450'])).toEqual({ price: 450 });
    expect(shortcutPatch(['price'], ['Rs. 1,250'])).toEqual({ price: 1250 });
    expect(shortcutPatch(['moq'], ['12 pcs'])).toEqual({ moq: 12 });
    expect(shortcutPatch(['stock'], ['100'])).toEqual({ stock: 100 });
  });

  it('needs a unit for weight and converts grams', () => {
    expect(shortcutPatch(['weight'], ['500 g'])).toEqual({ weightKg: 0.5 });
    expect(shortcutPatch(['weight'], ['2 kg'])).toEqual({ weightKg: 2 });
    expect(shortcutPatch(['weight'], ['500'])).toBeNull();
  });

  it('declines anything that is not one number answering one question', () => {
    expect(shortcutPatch(['price', 'moq'], ['450'])).toBeNull();
    expect(shortcutPatch(['price'], ['450', '10'])).toBeNull();
    expect(shortcutPatch(['price'], ['around 450 maybe'])).toBeNull();
    expect(shortcutPatch(['moq'], ['2.5'])).toBeNull();
    expect(shortcutPatch(['price'], ['5 kg'])).toBeNull();
    expect(shortcutPatch(['materials'], ['450'])).toBeNull();
    expect(shortcutPatch(['price'], ['0'])).toBeNull();
  });
});
