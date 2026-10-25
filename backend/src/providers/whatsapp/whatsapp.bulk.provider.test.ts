import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MetaWhatsAppProvider,
  WhatsAppSendError,
  parseMetaStatuses,
  parseMetaTemplateStatuses,
} from './index';
import {
  MetaTemplateClient,
  MetaTemplateError,
  buildTemplateComponents,
  countPlaceholders,
} from './metaTemplates';

const config = { accessToken: 'tok', phoneNumberId: 'PN1', appSecret: 's', verifyToken: 'v', graphVersion: 'v23.0' };

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Meta sendTemplate: message id and typed errors', () => {
  const provider = new MetaWhatsAppProvider({ ...config, accessToken: 'SECRET-TOKEN' });
  const template = { name: 'offer', language: 'en', body: ['Asha'] };

  it('returns the id Meta gives the accepted message', async () => {
    fetchMock.mockResolvedValue(json({ messages: [{ id: 'wamid.ABC' }] }));
    expect(await provider.sendTemplate('+919812345678', template)).toEqual({ messageId: 'wamid.ABC' });
  });

  it('returns no id when Meta answers without one', async () => {
    fetchMock.mockResolvedValue(json({}));
    expect(await provider.sendTemplate('+919812345678', template)).toEqual({});
  });

  it('throws a typed, permanent error for a template Meta does not know (132001)', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 132001, message: 'Template name does not exist' } }, 400));
    const err = (await provider.sendTemplate('+919812345678', template).catch((e) => e)) as WhatsAppSendError;
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect(err.code).toBe(132001);
    expect(err.transient).toBe(false);
    expect(err.message).toContain('132001');
  });

  it('marks a rate limit (130429) and a Meta outage (500) as transient', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 130429, message: 'Rate limit hit' } }, 400));
    expect(((await provider.sendTemplate('+919812345678', template).catch((e) => e)) as WhatsAppSendError).transient).toBe(true);
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'down' } }, 503));
    expect(((await provider.sendTemplate('+919812345678', template).catch((e) => e)) as WhatsAppSendError).transient).toBe(true);
  });

  it('keeps the marketing frequency cap (131049) permanent', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 131049, message: 'Not delivered to maintain healthy engagement' } }, 400));
    const err = (await provider.sendTemplate('+919812345678', template).catch((e) => e)) as WhatsAppSendError;
    expect(err.transient).toBe(false);
  });

  it('never puts the token in an error', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 190, message: 'bad token' } }, 401));
    const err = (await provider.sendTemplate('+919812345678', template).catch((e) => e)) as Error;
    expect(err.message).not.toContain('Bearer');
    expect(err.message).not.toContain('SECRET-TOKEN');
  });
});

const statusBody = (statuses: unknown[], phoneNumberId = 'PN1') => ({
  entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, statuses } }] }],
});

describe('parseMetaStatuses', () => {
  it('reads sent, delivered, read and failed receipts with the error code', () => {
    const updates = parseMetaStatuses(
      statusBody([
        { id: 'w1', status: 'sent' },
        { id: 'w2', status: 'delivered' },
        { id: 'w3', status: 'read' },
        { id: 'w4', status: 'failed', errors: [{ code: 131049, title: 'Frequency cap', message: 'Not delivered' }] },
      ]),
      'PN1',
    );
    expect(updates).toEqual([
      { providerMessageId: 'w1', status: 'sent' },
      { providerMessageId: 'w2', status: 'delivered' },
      { providerMessageId: 'w3', status: 'read' },
      { providerMessageId: 'w4', status: 'failed', errorCode: 131049, errorMessage: 'Not delivered' },
    ]);
  });

  it('ignores unknown statuses, receipts without an id and other phone numbers', () => {
    expect(parseMetaStatuses(statusBody([{ id: 'w1', status: 'deleted' }, { status: 'sent' }]), 'PN1')).toEqual([]);
    expect(parseMetaStatuses(statusBody([{ id: 'w1', status: 'sent' }], 'OTHER'), 'PN1')).toEqual([]);
  });

  it('copes with garbage', () => {
    expect(parseMetaStatuses(null)).toEqual([]);
    expect(parseMetaStatuses({ entry: 'x' })).toEqual([]);
  });
});

describe('parseMetaTemplateStatuses', () => {
  const event = (value: unknown) => ({ entry: [{ changes: [{ field: 'message_template_status_update', value }] }] });

  it('reads an approval and a rejection with its reason', () => {
    expect(
      parseMetaTemplateStatuses(event({ event: 'APPROVED', message_template_id: 123, message_template_name: 'offer', message_template_language: 'en' })),
    ).toEqual([{ metaTemplateId: '123', name: 'offer', language: 'en', event: 'APPROVED' }]);
    expect(
      parseMetaTemplateStatuses(
        event({ event: 'rejected', message_template_id: '9', message_template_name: 'x', message_template_language: 'en', reason: 'INVALID_FORMAT' }),
      ),
    ).toEqual([{ metaTemplateId: '9', name: 'x', language: 'en', event: 'REJECTED', reason: 'INVALID_FORMAT' }]);
  });

  it('drops the placeholder reason NONE and events without an id', () => {
    expect(parseMetaTemplateStatuses(event({ event: 'APPROVED', message_template_id: 5, reason: 'NONE' }))[0].reason).toBeUndefined();
    expect(parseMetaTemplateStatuses(event({ event: 'APPROVED' }))).toEqual([]);
  });

  it('does not confuse message changes with template changes', () => {
    expect(parseMetaTemplateStatuses(statusBody([{ id: 'w1', status: 'sent' }]))).toEqual([]);
  });
});

describe('buildTemplateComponents', () => {
  it('builds header, body with examples, footer and buttons', () => {
    const components = buildTemplateComponents({
      name: 'offer',
      category: 'MARKETING',
      language: 'en',
      headerText: 'Big news',
      body: 'Hello {{1}}, order by {{2}}.',
      footer: 'Solomon Bharat',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Interested' },
        { type: 'URL', text: 'Open', url: 'https://solomonbharat.com' },
        { type: 'PHONE_NUMBER', text: 'Call us', phone: '+911234567890' },
      ],
      variableExamples: ['Asha', 'Friday'],
    });
    expect(components).toEqual([
      { type: 'HEADER', format: 'TEXT', text: 'Big news' },
      { type: 'BODY', text: 'Hello {{1}}, order by {{2}}.', example: { body_text: [['Asha', 'Friday']] } },
      { type: 'FOOTER', text: 'Solomon Bharat' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Interested' },
          { type: 'URL', text: 'Open', url: 'https://solomonbharat.com' },
          { type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+911234567890' },
        ],
      },
    ]);
  });

  it('leaves out the example for a body without variables', () => {
    const [body] = buildTemplateComponents({ name: 'n', category: 'UTILITY', language: 'en', body: 'Plain text.', variableExamples: [] });
    expect(body).toEqual({ type: 'BODY', text: 'Plain text.' });
  });

  it('counts the highest placeholder', () => {
    expect(countPlaceholders('a {{1}} b {{3}} c')).toBe(3);
    expect(countPlaceholders('none')).toBe(0);
  });
});

describe('MetaTemplateClient', () => {
  const client = new MetaTemplateClient({ accessToken: 'tok', wabaId: 'WABA1', graphVersion: 'v23.0' });
  const def = { name: 'offer', category: 'UTILITY' as const, language: 'en', body: 'Hi {{1}}, thanks.', variableExamples: ['Asha'] };

  it('submits a template to the WABA and returns Meta\'s id and status', async () => {
    fetchMock.mockResolvedValue(json({ id: '555', status: 'PENDING', category: 'UTILITY' }));
    expect(await client.create(def)).toEqual({ id: '555', status: 'PENDING', category: 'UTILITY' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/WABA1/message_templates');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ name: 'offer', language: 'en', category: 'UTILITY' });
    expect(sent.components[0].example).toEqual({ body_text: [['Asha']] });
  });

  it('shows Meta\'s own explanation when it refuses', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 100, message: 'Invalid parameter', error_user_msg: 'The body has too many variables' } }, 400));
    const err = (await client.create(def).catch((e) => e)) as MetaTemplateError;
    expect(err).toBeInstanceOf(MetaTemplateError);
    expect(err.message).toContain('The body has too many variables');
    expect(err.message).not.toContain('tok');
  });

  it('reads the status and rejection reason', async () => {
    fetchMock.mockResolvedValue(json({ id: '555', name: 'offer', language: 'en', status: 'rejected', rejected_reason: 'INVALID_FORMAT' }));
    expect(await client.get('555')).toMatchObject({ id: '555', status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' });
    expect(fetchMock.mock.calls[0][0]).toContain('/555?fields=');
  });

  it('refuses a template id that is not numeric (no path tricks)', async () => {
    await expect(client.get('../me')).rejects.toBeInstanceOf(MetaTemplateError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes by name', async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    await client.remove('my offer');
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/WABA1/message_templates?name=my%20offer');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
