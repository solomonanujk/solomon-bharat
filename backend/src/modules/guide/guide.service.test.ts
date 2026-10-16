import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuideService, MAX_VISITOR_MESSAGES, parseGuideReply, weightKg } from './guide.service';
import { guideReply, suggestUploads } from './guide.ai';

vi.mock('./guide.ai', () => ({
  guideReply: vi.fn().mockResolvedValue('Here is your plan.'),
  suggestUploads: vi.fn().mockResolvedValue('- Upload shipping rates'),
  extractTextFromPdf: vi.fn().mockResolvedValue('PDF text'),
  extractTextFromImage: vi.fn().mockResolvedValue('Image text'),
  setAdminGeminiKey: vi.fn(),
  setAdminOpenRouterKey: vi.fn(),
  setAdminAnthropicKey: vi.fn(),
  verifyAnthropicKey: vi.fn(async (k: string) => k.startsWith('good')),
  verifyOpenRouterKey: vi.fn(async (k: string) => k.startsWith('good')),
  summarizeKnowledge: vi.fn().mockResolvedValue('- Duty UK 12%'),
  verifyGeminiKey: vi.fn(async (k: string) => k.startsWith('good')),
}));
vi.mock('./guide.images', () => ({
  findWebPhotos: vi.fn(async (qs: string[]) => qs.map((q) => ({ query: q, title: q, image: `https://photos/${q}`, link: 'https://src', credit: 'A', license: 'CC BY' }))),
}));
vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../providers/storage', () => ({ storageProvider: { uploadFile: vi.fn().mockResolvedValue({ url: 'https://files/x' }) } }));

function makeDb(conversation: Record<string, unknown> | null = null, settings: unknown = null) {
  return {
    guideConversation: {
      create: vi.fn(async ({ data }) => ({ id: 'c1', ...data })),
      findUnique: vi.fn().mockResolvedValue(conversation),
      update: vi.fn().mockResolvedValue({}),
    },
    guideKnowledge: {
      findUnique: vi.fn().mockResolvedValue({ id: 'k1' }),
      findMany: vi.fn().mockResolvedValue([{ title: 'Shipping', content: 'UK air £1.60/kg', kind: 'TEXT' }]),
      create: vi.fn(async ({ data }) => ({ id: 'k1', ...data })),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        { slug: 'jute-tote', name: 'Block-print jute tote', materials: 'Jute', description: 'Hand block printed in Bagru.', howItIsMade: null, placeOfOrigin: 'Bagru, Rajasthan', moq: 10, adminPrice: null, weight: '400 g', dimensions: null, variants: [], priceTiers: [{ adminPrice: 450 }, { adminPrice: 380 }], category: { name: 'Bags' }, images: [{ url: 'https://img/tote.jpg' }] },
      ]),
    },
    platformSetting: {
      findUnique: vi.fn().mockResolvedValue(settings),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('GuideService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('start() stores the visitor details and returns a long random token', async () => {
    const db = makeDb();
    const r = await new GuideService(db as never).start({ name: ' Asha ', email: 'ASHA@X.COM', phone: '+44 7700 900123', country: 'United Kingdom' });
    expect(r.token).toMatch(/^[0-9a-f]{48}$/);
    expect(db.guideConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Asha', email: 'asha@x.com', phone: '+44 7700 900123', country: 'United Kingdom' }),
    });
  });

  it('chat() answers from the knowledge, with web search on by default, and saves both turns', async () => {
    const db = makeDb({ id: 'c1', name: 'Asha', country: 'United Kingdom', messages: [] });
    const r = await new GuideService(db as never).chat('t'.repeat(48), 'What can I sell?');
    expect(r.reply).toBe('Here is your plan.');
    expect(guideReply).toHaveBeenCalledWith(
      expect.stringContaining('UK air £1.60/kg'),
      'Asha, lives in United Kingdom',
      [{ role: 'user', content: 'What can I sell?' }],
      true,
    );
    const saved = db.guideConversation.update.mock.calls[0][0].data;
    expect(saved.messageCount).toBe(2);
  });

  it('chat() respects web search being turned off', async () => {
    const db = makeDb({ id: 'c1', name: 'Asha', country: null, messages: [] }, { value: { allowWebSearch: false } });
    await new GuideService(db as never).chat('t'.repeat(48), 'Hi');
    expect(vi.mocked(guideReply).mock.calls[0][3]).toBe(false);
  });

  it('chat() stops at the message limit and rejects an unknown token', async () => {
    const full = Array.from({ length: MAX_VISITOR_MESSAGES }, () => ({ role: 'user', content: 'q', at: '' }));
    await expect(new GuideService(makeDb({ id: 'c1', name: 'A', messages: full }) as never).chat('t'.repeat(48), 'more')).rejects.toThrow(/limit/);
    await expect(new GuideService(makeDb(null) as never).chat('t'.repeat(48), 'hi')).rejects.toThrow(/expired/);
  });

  it('addFile() returns at once, then reads a spreadsheet in the background, summarises it and refreshes suggestions', async () => {
    const db = makeDb();
    const svc = new GuideService(db as never);
    const csv = Buffer.from('country,rate\nUK,12%\nUS,6%\n');
    const row = await svc.addFile('admin', { buffer: csv, originalname: 'duty.csv', mimetype: 'text/csv', size: csv.length });
    expect(row).toMatchObject({ kind: 'SPREADSHEET', title: 'duty', status: 'PROCESSING' });
    await (svc as unknown as { queue: Promise<void> }).queue;
    await (svc as unknown as { summaryQueue: Promise<void> }).summaryQueue;
    const updates = db.guideKnowledge.update.mock.calls.map((c) => c[0].data);
    expect(updates[0]).toMatchObject({ status: 'READY', fileUrl: 'https://files/x' });
    expect(String(updates[0].content)).toContain('UK | 12%');
    expect(updates[1]).toEqual({ summary: '- Duty UK 12%' });
    // Suggestions run once, 20 s after the batch settles.
    expect(suggestUploads).not.toHaveBeenCalled();
    vi.useFakeTimers();
    try {
      (svc as unknown as { scheduleSuggestions: () => void }).scheduleSuggestions();
      vi.advanceTimersByTime(20_000);
    } finally {
      vi.useRealTimers();
    }
    await (svc as unknown as { summaryQueue: Promise<void> }).summaryQueue;
    expect(suggestUploads).toHaveBeenCalledTimes(1);
  });

  it('a file that cannot be read is marked FAILED with the reason', async () => {
    const db = makeDb();
    const svc = new GuideService(db as never);
    await svc.addFile('admin', { buffer: Buffer.from('   '), originalname: 'empty.txt', mimetype: 'text/plain', size: 3 });
    await (svc as unknown as { queue: Promise<void> }).queue;
    expect(db.guideKnowledge.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', error: 'Nothing readable was found in this file.' });
  });

  it('addFile() refuses unsupported files such as Word documents', async () => {
    const db = makeDb();
    await expect(
      new GuideService(db as never).addFile('admin', { buffer: Buffer.from('x'), originalname: 'a.docx', mimetype: 'application/octet-stream', size: 1 }),
    ).rejects.toThrow(/save as PDF/);
  });

  it('saveAiKey() refuses a key Google rejects, and stores an accepted key encrypted (never in plain text)', async () => {
    const db = makeDb();
    const svc = new GuideService(db as never);
    await expect(svc.saveAiKey('admin', 'bad-key-xxxxxxxxxxxxxxxxxxxx')).rejects.toThrow(/did not accept/);
    await svc.saveAiKey('admin', 'good-key-1234567890abcdefWXYZ');
    const stored = JSON.stringify(db.platformSetting.upsert.mock.calls[0][0].create.value);
    expect(stored).not.toContain('good-key');
    expect(stored).toContain('encrypted');
  });

  it('deleteAllKnowledge() removes every item and the old suggestions, but not visitor chats', async () => {
    const db = makeDb();
    expect(await new GuideService(db as never).deleteAllKnowledge('admin')).toEqual({ removed: 7 });
    expect(db.guideKnowledge.deleteMany).toHaveBeenCalledWith({});
    expect(db.platformSetting.deleteMany).toHaveBeenCalledWith({ where: { key: 'guide_upload_suggestions' } });
  });

  it('parseGuideReply() turns the hidden lines into follow-up buttons and the WhatsApp flag', () => {
    expect(parseGuideReply('Nice! Where do you live?\n<<FOLLOWUPS>> I live in the UK | **Just exploring**\n')).toEqual({
      content: 'Nice! Where do you live?', followUps: ['I live in the UK', 'Just exploring'], whatsapp: false, productSlugs: [], imageQueries: [], picks: [], note: '',
    });
    expect(parseGuideReply('Great choice.\n<<FOLLOWUPS>> How do samples work?\n<<WHATSAPP>>').whatsapp).toBe(true);
    expect(parseGuideReply('Plain answer')).toEqual({ content: 'Plain answer', followUps: [], whatsapp: false, productSlugs: [], imageQueries: [], picks: [], note: '' });
  });

  it('chat() shows catalogue products as picture cards and strips asterisks', async () => {
    vi.mocked(guideReply).mockResolvedValueOnce('A **lovely** pick for France.\n<<PRODUCTS>> jute-tote | made-up-slug\n<<FOLLOWUPS>> Tell me more');
    const db = makeDb({ id: 'c1', name: 'Asha', country: 'France', messages: [] });
    const r = await new GuideService(db as never).chat('t'.repeat(48), 'Bags under 30 euros?');
    expect(vi.mocked(guideReply).mock.calls[0][0]).toContain('jute-tote: Block-print jute tote | Bags | Jute | from INR 380 per piece, MOQ 10 | weight 0.4 kg | Bagru, Rajasthan');
    expect(r.reply).toBe('A lovely pick for France.');
    expect(r.products).toEqual([{ slug: 'jute-tote', name: 'Block-print jute tote', image: 'https://img/tote.jpg', category: 'Bags' }]);
  });

  it('chat() turns <<IMAGES>> searches into credited web photos', async () => {
    vi.mocked(guideReply).mockResolvedValueOnce('Some ideas.\n<<IMAGES>> raffia bucket bag | sari silk pouch');
    const db = makeDb({ id: 'c1', name: 'Asha', country: 'France', messages: [] });
    const r = await new GuideService(db as never).chat('t'.repeat(48), 'Ideas?');
    expect(r.photos.map((p) => p.image)).toEqual(['https://photos/raffia bucket bag', 'https://photos/sari silk pouch']);
  });

  it('chat() turns <<PICK>> lines into product cards with real catalogue price, story and a web photo for ideas', async () => {
    vi.mocked(guideReply).mockResolvedValueOnce(
      'Got it, here is where I would start.\n' +
        '<<PICK>> {"code":"jute-tote","why":"Eco shoppers love it","shipping":"~€1.20","duty":"~€1.10","landed":"~€6.50","sell":"€22–28"}\n' +
        '<<PICK>> {"name":"Sari silk potli","photo":"sari silk pouch","story":"Made from old saris.","why":"Gift buyers","sell":"€18–25"}\n' +
        '<<PICK>> {not json}\nSell them on Instagram first.\n<<FOLLOWUPS>> Show me more products',
    );
    const db = makeDb({ id: 'c1', name: 'Asha', country: 'France', messages: [], saved: [{ key: 'p:x', name: 'Brass bell', liked: true, saved: false }] });
    const r = await new GuideService(db as never).chat('t'.repeat(48), 'About me');
    expect(r.reply).toBe('Got it, here is where I would start.');
    expect(r.note).toBe('Sell them on Instagram first.');
    expect(vi.mocked(guideReply).mock.calls[0][1]).toContain('liked or saved so far: Brass bell');
    expect(r.picks).toHaveLength(2);
    expect(r.picks[0]).toMatchObject({ key: 'p:jute-tote', source: 'catalogue', image: 'https://img/tote.jpg', link: '/products/jute-tote', cost: 'from ₹380', weightKg: 0.4, story: 'Hand block printed in Bagru.', origin: 'Bagru, Rajasthan', landed: '~€6.50' });
    expect(r.picks[1]).toMatchObject({ source: 'idea', name: 'Sari silk potli', image: 'https://photos/sari silk pouch', story: 'Made from old saris.' });
  });

  it('toggleSaved() likes, saves and unlikes items on the chat', async () => {
    const db = makeDb({ id: 'c1', name: 'Asha', messages: [], saved: [] });
    const svc = new GuideService(db as never);
    const item = { key: 'p:jute-tote', name: 'Jute tote', image: null, link: '/products/jute-tote' };
    const list = await svc.toggleSaved('t'.repeat(48), item, 'liked', true);
    expect(list).toEqual([{ ...item, liked: true, saved: false }]);
    db.guideConversation.findUnique.mockResolvedValueOnce({ id: 'c1', saved: list });
    expect(await svc.toggleSaved('t'.repeat(48), item, 'liked', false)).toEqual([]);
  });

  it('weightKg() reads product weights written in grams, kilograms or pounds', () => {
    expect(weightKg('400 g')).toBe(0.4);
    expect(weightKg('1.2 kg')).toBe(1.2);
    expect(weightKg('0,5kg')).toBe(0.5);
    expect(weightKg('2', 'lb')).toBeCloseTo(0.907, 3);
    expect(weightKg('1.5', 'kg')).toBe(1.5);
    expect(weightKg('')).toBeNull();
    expect(weightKg('n/a')).toBeNull();
  });
});
