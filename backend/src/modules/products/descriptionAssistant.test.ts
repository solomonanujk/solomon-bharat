import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createMock, envMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  envMock: { ANTHROPIC_API_KEY: 'test-key' } as Record<string, string>,
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { create: createMock } };
  },
}));
vi.mock('../../config/env', async (orig) => ({ ...(await orig<typeof import('../../config/env')>()), env: envMock }));

import { draftProductDescription } from './descriptionAssistant';

describe('draftProductDescription', () => {
  beforeEach(() => {
    createMock.mockReset();
    envMock.ANTHROPIC_API_KEY = 'test-key';
  });

  it('sends the product facts to Claude and returns the text', async () => {
    createMock.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: ' A lovely cushion. ' }] });
    const text = await draftProductDescription({ name: 'Block print cushion', materials: 'Cotton', craftTechnique: '' });
    expect(text).toBe('A lovely cushion.');
    const req = createMock.mock.calls[0][0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.messages[0].content).toContain('materials: Cotton');
    expect(req.messages[0].content).not.toContain('craftTechnique');
  });

  it('turns a refusal into a friendly 400', async () => {
    createMock.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(draftProductDescription({ name: 'X' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('is a 503 when no API key is configured', async () => {
    envMock.ANTHROPIC_API_KEY = '';
    await expect(draftProductDescription({ name: 'X' })).rejects.toMatchObject({ statusCode: 503 });
  });
});
