import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
const getGenerativeModel = vi.fn().mockReturnValue({ generateContent });
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel;
  },
}));

import { ExtractionError, GeminiListingExtractor, MAX_INPUT_CHARS, parseExtraction } from './whatsapp.ai';

describe('parseExtraction', () => {
  it('reads a normal reply', () => {
    const patch = parseExtraction(
      JSON.stringify({
        name: 'Brass Diya',
        price: 250,
        moq: 10,
        stock: 100,
        weightKg: 0.2,
        length: 8,
        width: 8,
        height: 4,
        dimensionUnit: 'cm',
        madeToOrder: false,
        categoryText: 'brass lamp',
      }),
    );
    expect(patch).toMatchObject({ name: 'Brass Diya', price: 250, moq: 10, stock: 100, dimensionUnit: 'cm', madeToOrder: false });
  });

  it('accepts numbers written as strings and strips code fences', () => {
    const patch = parseExtraction('```json\n{"price":"1,250","moq":"12"}\n```');
    expect(patch).toEqual({ price: 1250, moq: 12 });
  });

  it('drops invalid fields instead of failing the whole reply', () => {
    const patch = parseExtraction(
      JSON.stringify({ name: 'Ok', price: -5, moq: 2.5, stock: 'lots', dimensionUnit: 'miles', weightKg: 0 }),
    );
    expect(patch).toEqual({ name: 'Ok' });
  });

  it('strips markup, trims and caps text length', () => {
    const patch = parseExtraction(JSON.stringify({ name: `<b>${'x'.repeat(100)}</b>`, materials: '  <script>alert(1)</script> Brass ' }));
    expect(patch.name).toHaveLength(60);
    expect(patch.name).not.toContain('<');
    expect(patch.materials).toBe('alert(1) Brass');
  });

  it('treats the HSN the seller gave as theirs and a guess as a suggestion', () => {
    expect(parseExtraction('{"hsn":"7418 10","hsnGuess":"9999"}')).toMatchObject({ hsn: '741810', hsnSuggested: false });
    expect(parseExtraction('{"hsnGuess":"7418"}')).toMatchObject({ hsn: '7418', hsnSuggested: true });
    expect(parseExtraction('{"hsn":"12"}')).toEqual({});
  });

  it('rejects replies that are not a JSON object', () => {
    expect(() => parseExtraction('sorry, I cannot')).toThrow(ExtractionError);
    expect(() => parseExtraction('[1,2]')).toThrow(ExtractionError);
    expect(() => parseExtraction('"text"')).toThrow(ExtractionError);
  });
});

describe('GeminiListingExtractor', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  const response = (text: string, usage = { promptTokenCount: 120, candidatesTokenCount: 40 }) => ({
    response: { text: () => text, usageMetadata: usage },
  });

  it('makes one call with a capped input and reports token usage', async () => {
    generateContent.mockResolvedValue(response('{"name":"Diya"}'));
    const extractor = new GeminiListingExtractor(() => 'key');
    const result = await extractor.extract({
      texts: ['x'.repeat(MAX_INPUT_CHARS * 2)],
      known: { price: 5 },
      asked: ['moq'],
    });

    expect(generateContent).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(generateContent.mock.calls[0][0]);
    expect(payload.messages).toHaveLength(MAX_INPUT_CHARS);
    expect(payload.known).toEqual({ price: 5 });
    expect(payload.asked).toEqual(['moq']);
    expect(result).toEqual({ patch: { name: 'Diya' }, inputTokens: 120, outputTokens: 40 });
  });

  it('asks for JSON from a small model with a token cap', async () => {
    generateContent.mockResolvedValue(response('{}'));
    await new GeminiListingExtractor(() => 'key').extract({ texts: ['hi'], known: {}, asked: [] });
    const config = getGenerativeModel.mock.calls.at(-1)![0];
    expect(config.model).toContain('lite');
    expect(config.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: 900 });
  });

  it('lists category options with letters', async () => {
    generateContent.mockResolvedValue(response('{}'));
    await new GeminiListingExtractor(() => 'key').extract({
      texts: ['b'],
      known: {},
      asked: ['category'],
      categoryOptions: [
        { id: '1', name: 'Cotton Sarees', path: 'x' },
        { id: '2', name: 'Silk Sarees', path: 'y' },
      ],
    });
    expect(JSON.parse(generateContent.mock.calls[0][0]).categoryOptions).toEqual(['a) Cotton Sarees', 'b) Silk Sarees']);
  });

  it('fails without calling the API when there is no key', async () => {
    await expect(new GeminiListingExtractor(() => '').extract({ texts: ['hi'], known: {}, asked: [] })).rejects.toThrow(
      ExtractionError,
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('keeps the usage when the reply cannot be read, so the call is still counted', async () => {
    generateContent.mockResolvedValue(response('not json'));
    const err = await new GeminiListingExtractor(() => 'key')
      .extract({ texts: ['hi'], known: {}, asked: [] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExtractionError);
    expect((err as ExtractionError).usage).toEqual({ inputTokens: 120, outputTokens: 40 });
  });
});
