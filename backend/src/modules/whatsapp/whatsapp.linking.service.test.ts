import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SellerProfile, WhatsAppLinkCode } from '@prisma/client';
import { EMPTY_TEMPLATE_SETTINGS, WhatsAppProvider, createTemplateCatalog } from '../../providers/whatsapp';
import { WhatsAppLinkingRepository } from './whatsapp.linking.repository';
import { LINK_MAX_ATTEMPTS, LINK_MAX_CODES_PER_HOUR, WhatsAppLinkingService } from './whatsapp.linking.service';

vi.mock('../../utils/auditLog', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

const seller = { id: 's1', userId: 'u1', whatsappNumber: null, whatsappVerifiedAt: null } as unknown as SellerProfile;

function build() {
  const repo = {
    findSellerByUserId: vi.fn().mockResolvedValue(seller),
    findSellerByWhatsAppNumber: vi.fn().mockResolvedValue(null),
    countCodesSince: vi.fn().mockResolvedValue(0),
    createCode: vi.fn().mockImplementation(async (input) => ({ id: 'c1', attempts: 0, ...input })),
    deleteCode: vi.fn().mockResolvedValue(undefined),
    latestCode: vi.fn(),
    incrementAttempts: vi.fn().mockResolvedValue(undefined),
    link: vi.fn().mockResolvedValue(true),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  const provider: WhatsAppProvider = {
    sendText: vi.fn().mockResolvedValue(undefined),
    verifyWebhook: vi.fn(),
    parseInbound: vi.fn(),
    downloadMedia: vi.fn(),
  };
  const service = new WhatsAppLinkingService(repo as unknown as WhatsAppLinkingRepository, provider);
  return { service, repo, provider };
}

/** Requests a code and returns the 6 digits that were sent, plus the stored row. */
async function requestAndCapture(ctx: ReturnType<typeof build>) {
  await ctx.service.requestCode('u1', '+91 98765 43210');
  const body = vi.mocked(ctx.provider.sendText).mock.calls[0][1];
  const code = /(\d{6})/.exec(body)![1];
  const row = (await ctx.repo.createCode.mock.results[0].value) as WhatsAppLinkCode;
  return { code, row };
}

describe('WhatsAppLinkingService.requestCode', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('normalises the number, stores only a hash and sends the code', async () => {
    const { code, row } = await requestAndCapture(ctx);
    expect(ctx.provider.sendText).toHaveBeenCalledWith('+919876543210', expect.stringContaining(code));
    expect(row.phone).toBe('+919876543210');
    expect(row.codeHash).not.toContain(code);
  });

  it('rejects an invalid number without sending anything', async () => {
    await expect(ctx.service.requestCode('u1', 'abc')).rejects.toMatchObject({ statusCode: 400 });
    expect(ctx.provider.sendText).not.toHaveBeenCalled();
  });

  it('rejects a number already linked to another seller', async () => {
    ctx.repo.findSellerByWhatsAppNumber.mockResolvedValue({ id: 'other' });
    await expect(ctx.service.requestCode('u1', '+919876543210')).rejects.toMatchObject({ statusCode: 409 });
    expect(ctx.provider.sendText).not.toHaveBeenCalled();
  });

  it('rate-limits code requests', async () => {
    ctx.repo.countCodesSince.mockResolvedValue(LINK_MAX_CODES_PER_HOUR);
    await expect(ctx.service.requestCode('u1', '+919876543210')).rejects.toMatchObject({ statusCode: 429 });
    expect(ctx.provider.sendText).not.toHaveBeenCalled();
  });

  it('removes the code and reports an error when WhatsApp sending fails', async () => {
    vi.mocked(ctx.provider.sendText).mockRejectedValue(new Error('boom'));
    await expect(ctx.service.requestCode('u1', '+919876543210')).rejects.toMatchObject({ statusCode: 502 });
    expect(ctx.repo.deleteCode).toHaveBeenCalledWith('c1');
  });

  it('404s for a user with no seller profile', async () => {
    ctx.repo.findSellerByUserId.mockResolvedValue(null);
    await expect(ctx.service.requestCode('u1', '+919876543210')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('WhatsAppLinkingService.verifyCode', () => {
  it('links the number when the code is right', async () => {
    const ctx = build();
    const { code, row } = await requestAndCapture(ctx);
    ctx.repo.latestCode.mockResolvedValue(row);
    const status = await ctx.service.verifyCode('u1', code);
    expect(ctx.repo.link).toHaveBeenCalledWith('s1', '+919876543210');
    expect(status).toMatchObject({ linked: true, number: '+919876543210' });
  });

  it('counts a wrong code as an attempt and does not link', async () => {
    const ctx = build();
    const { code, row } = await requestAndCapture(ctx);
    ctx.repo.latestCode.mockResolvedValue(row);
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(ctx.service.verifyCode('u1', wrong)).rejects.toMatchObject({ statusCode: 400 });
    expect(ctx.repo.incrementAttempts).toHaveBeenCalledWith('c1');
    expect(ctx.repo.link).not.toHaveBeenCalled();
  });

  it('refuses after too many attempts even with the right code', async () => {
    const ctx = build();
    const { code, row } = await requestAndCapture(ctx);
    ctx.repo.latestCode.mockResolvedValue({ ...row, attempts: LINK_MAX_ATTEMPTS });
    await expect(ctx.service.verifyCode('u1', code)).rejects.toMatchObject({ statusCode: 429 });
    expect(ctx.repo.link).not.toHaveBeenCalled();
  });

  it('refuses an expired code or when none was requested', async () => {
    const ctx = build();
    const { code, row } = await requestAndCapture(ctx);
    ctx.repo.latestCode.mockResolvedValue({ ...row, expiresAt: new Date(Date.now() - 1000) });
    await expect(ctx.service.verifyCode('u1', code)).rejects.toMatchObject({ statusCode: 400 });
    ctx.repo.latestCode.mockResolvedValue(null);
    await expect(ctx.service.verifyCode('u1', code)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('reports a conflict if the number was claimed in the meantime', async () => {
    const ctx = build();
    const { code, row } = await requestAndCapture(ctx);
    ctx.repo.latestCode.mockResolvedValue(row);
    ctx.repo.link.mockResolvedValue(false);
    await expect(ctx.service.verifyCode('u1', code)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('WhatsAppLinkingService status and unlink', () => {
  it('reports the linked number', async () => {
    const ctx = build();
    ctx.repo.findSellerByUserId.mockResolvedValue({ ...seller, whatsappNumber: '+919876543210', whatsappVerifiedAt: new Date() });
    expect(await ctx.service.getStatus('u1')).toMatchObject({ linked: true, number: '+919876543210' });
  });

  it('unlinks only when a number is linked', async () => {
    const ctx = build();
    await ctx.service.unlink('u1');
    expect(ctx.repo.unlink).not.toHaveBeenCalled();
    ctx.repo.findSellerByUserId.mockResolvedValue({ ...seller, whatsappNumber: '+919876543210' });
    expect(await ctx.service.unlink('u1')).toMatchObject({ linked: false });
    expect(ctx.repo.unlink).toHaveBeenCalledWith('s1');
  });
});

describe('WhatsAppLinkingService with a link-code template', () => {
  const catalog = createTemplateCatalog({ ...EMPTY_TEMPLATE_SETTINGS, WHATSAPP_TEMPLATE_AUTH: 'auth_code' });

  function buildWithTemplates() {
    const ctx = build();
    const provider = { ...ctx.provider, sendTemplate: vi.fn().mockResolvedValue(undefined) } as WhatsAppProvider;
    const service = new WhatsAppLinkingService(ctx.repo as unknown as WhatsAppLinkingRepository, provider, catalog);
    return { ...ctx, provider, service };
  }

  it('sends the code through the approved template so a cold number receives it', async () => {
    const ctx = buildWithTemplates();
    await ctx.service.requestCode('u1', '+91 98765 43210');
    const [to, template] = vi.mocked(ctx.provider.sendTemplate!).mock.calls[0];
    expect(to).toBe('+919876543210');
    expect(template).toMatchObject({ name: 'auth_code', language: 'en' });
    expect(template.body).toHaveLength(1);
    expect(template.copyCode).toBe(template.body[0]);
    expect(template.body[0]).toMatch(/^\d{6}$/);
    expect(ctx.provider.sendText).not.toHaveBeenCalled();
  });

  it('falls back to plain text, with the same code, when the template fails', async () => {
    const ctx = buildWithTemplates();
    vi.mocked(ctx.provider.sendTemplate!).mockRejectedValue(new Error('template not approved'));
    await ctx.service.requestCode('u1', '+91 98765 43210');
    const code = vi.mocked(ctx.provider.sendTemplate!).mock.calls[0][1].body[0];
    expect(ctx.provider.sendText).toHaveBeenCalledWith('+919876543210', expect.stringContaining(code));
  });

  it('reports a send failure only when both the template and the text fail', async () => {
    const ctx = buildWithTemplates();
    vi.mocked(ctx.provider.sendTemplate!).mockRejectedValue(new Error('no template'));
    vi.mocked(ctx.provider.sendText).mockRejectedValue(new Error('window closed'));
    await expect(ctx.service.requestCode('u1', '+919876543210')).rejects.toMatchObject({ statusCode: 502 });
    expect(ctx.repo.deleteCode).toHaveBeenCalledWith('c1');
  });
});
