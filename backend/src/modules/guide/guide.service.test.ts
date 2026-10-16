import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuideService, MAX_VISITOR_MESSAGES } from './guide.service';
import { guideReply, suggestUploads } from './guide.ai';

vi.mock('./guide.ai', () => ({
  guideReply: vi.fn().mockResolvedValue('Here is your plan.'),
  suggestUploads: vi.fn().mockResolvedValue('- Upload shipping rates'),
  extractTextFromPdf: vi.fn().mockResolvedValue('PDF text'),
  extractTextFromImage: vi.fn().mockResolvedValue('Image text'),
  setAdminGeminiKey: vi.fn(),
  setAdminOpenRouterKey: vi.fn(),
  verifyOpenRouterKey: vi.fn(async (k: string) => k.startsWith('good')),
  summarizeKnowledge: vi.fn().mockResolvedValue('- Duty UK 12%'),
  verifyGeminiKey: vi.fn(async (k: string) => k.startsWith('good')),
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
      findMany: vi.fn().mockResolvedValue([{ title: 'Shipping', content: 'UK air £1.60/kg', kind: 'TEXT' }]),
      create: vi.fn(async ({ data }) => ({ id: 'k1', ...data })),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
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
    await (svc as unknown as { queue: Promise<void> }).queue;
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
});
