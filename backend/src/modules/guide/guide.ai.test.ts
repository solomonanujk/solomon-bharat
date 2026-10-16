import { describe, it, expect, vi, afterEach } from 'vitest';
import { guideReply, setAdminGeminiKey, setAdminOpenRouterKey, summarizeKnowledge } from './guide.ai';

function json(status: number, body: unknown) {
  return { ok: status === 200, status, json: async () => body } as Response;
}

describe('Solomon AI provider routing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAdminOpenRouterKey('');
    setAdminGeminiKey('');
  });

  it('uses OpenRouter free models first, sending the three models in order and the knowledge as the system prompt', async () => {
    setAdminOpenRouterKey('or-key-123456789012345678901234');
    const fetchMock = vi.fn(async () => json(200, { model: 'thinkingmachines/inkling:free', choices: [{ message: { content: 'Minimum order is 50.' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const reply = await guideReply('### Service\nMOQ 50', 'Priya', [{ role: 'user', content: 'MOQ?' }], true);
    expect(reply).toBe('Minimum order is 50.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    expect(body.models).toEqual(['nvidia/nemotron-3-super-120b-a12b:free', 'dots-studio/dots-3-note-preview:free', 'google/gemma-4-31b-it:free']);
    expect(body.messages[0].content).toContain('MOQ 50');
    expect(body.messages[1].content).toContain('[Visitor: Priya]');
  });

  it('falls back to Gemini when OpenRouter is out of free requests', async () => {
    setAdminOpenRouterKey('or-key-123456789012345678901234');
    setAdminGeminiKey('gem-key-123456789012345678901234');
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('openrouter')
        ? json(429, { error: { message: 'Rate limit exceeded: free-models-per-day' } })
        : json(200, { candidates: [{ content: { parts: [{ text: '- Key point' }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await summarizeKnowledge('rates', 'UK 4.20/kg')).toBe('- Key point');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('generativelanguage'))).toBe(true);
  });

  it('explains the free limit when OpenRouter is used up and there is no backup', async () => {
    setAdminOpenRouterKey('or-key-123456789012345678901234');
    vi.stubGlobal('fetch', vi.fn(async () => json(429, { error: { message: 'Rate limit exceeded' } })));
    await expect(summarizeKnowledge('x', 'y')).rejects.toThrow(/\$10 of credit/);
  });
});
