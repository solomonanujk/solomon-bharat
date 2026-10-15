import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuideService, MAX_VISITOR_MESSAGES } from './guide.service';
import { guideReply, suggestUploads } from './guide.ai';

vi.mock('./guide.ai', () => ({
  guideReply: vi.fn().mockResolvedValue('Here is your plan.'),
  suggestUploads: vi.fn().mockResolvedValue('- Upload shipping rates'),
  extractTextFromPdf: vi.fn().mockResolvedValue('PDF text'),
  extractTextFromImage: vi.fn().mockResolvedValue('Image text'),
  setAdminGeminiKey: vi.fn(),
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
    },
    platformSetting: {
      findUnique: vi.fn().mockResolvedValue(settings),
      upsert: vi.fn().mockResolvedValue({}),
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

  it('addFile() turns a spreadsheet into text rows and refreshes the suggestions', async () => {
    const db = makeDb();
    const csv = Buffer.from('country,rate\nUK,12%\nUS,6%\n');
    const row = await new GuideService(db as never).addFile('admin', { buffer: csv, originalname: 'duty.csv', mimetype: 'text/csv', size: csv.length });
    expect(row).toMatchObject({ kind: 'SPREADSHEET', title: 'duty', fileUrl: 'https://files/x' });
    expect(String(row.content)).toContain('UK | 12%');
    await new Promise((r) => setTimeout(r, 0));
    expect(suggestUploads).toHaveBeenCalled();
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
});
