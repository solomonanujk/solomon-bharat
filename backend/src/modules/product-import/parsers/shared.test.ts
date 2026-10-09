import { describe, it, expect } from 'vitest';
import { finalizeCandidate, isHttpUrl, isMaterialLabel, newDraft, parsePrice, stripHtml } from './shared';

describe('parsePrice', () => {
  it.each([
    ['499', 499],
    ['499.00', 499],
    ['₹1,299.00', 1299],
    ['$ 12', 12],
    ['1,29,999', 129999],
    ['12,50', 12.5],
    ['1.299,50', 1299.5],
    ['1,299', 1299],
    ['19.999', 20],
    ['INR 75', 75],
    ['1.2E+05', 120000],
  ])('%s → %s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '0', '-5', '0.00', '1e12', '999999999'])('%s → null', (raw) => {
    expect(parsePrice(raw)).toBeNull();
  });

  it('handles null/undefined', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});

describe('stripHtml', () => {
  it('removes tags, script/style bodies, and decodes entities', () => {
    expect(stripHtml('<style>p{}</style><p>A&nbsp;&amp;&#39;B&#x41;</p><script>alert(1)</script>')).toBe("A &'BA");
  });

  it('keeps line breaks and bullets', () => {
    expect(stripHtml('one<br>two<ul><li>x</li><li>y</li></ul>')).toBe('one\ntwo\n• x\n• y');
  });

  it('leaves unknown entities untouched and collapses whitespace', () => {
    expect(stripHtml('  a   &bogus;   b  ')).toBe('a &bogus; b');
  });
});

describe('isHttpUrl / isMaterialLabel', () => {
  it('only accepts http(s)', () => {
    expect(isHttpUrl('https://x.test/a.jpg')).toBe(true);
    expect(isHttpUrl('http://x.test/a.jpg')).toBe(true);
    expect(isHttpUrl('ftp://x.test/a.jpg')).toBe(false);
    expect(isHttpUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl(`https://x.test/${'a'.repeat(2100)}`)).toBe(false);
  });

  it('matches material-like labels', () => {
    expect(isMaterialLabel('Material')).toBe(true);
    expect(isMaterialLabel('fabric')).toBe(true);
    expect(isMaterialLabel('meta: materials')).toBe(true);
    expect(isMaterialLabel('Color')).toBe(false);
  });
});

describe('finalizeCandidate', () => {
  it('uses the key as name when the name is missing and shortens long descriptions', () => {
    const draft = newDraft('handle-1');
    draft.descriptionHtml = 'x'.repeat(1200);
    const c = finalizeCandidate(draft);
    expect(c.name).toBe('handle-1');
    expect(c.description).toHaveLength(1000);
    expect(c.issues).toEqual(
      expect.arrayContaining(['No product name in the file — using "handle-1"', 'Description shortened to 1000 characters']),
    );
  });

  it('caps variants at 100 and labels option-less variants', () => {
    const draft = newDraft('k');
    draft.name = 'N';
    for (let i = 0; i < 105; i += 1) draft.variants.push({ name: '', options: [], sku: '', rawPrice: '1' });
    const c = finalizeCandidate(draft);
    expect(c.variants).toHaveLength(100);
    expect(c.variants[0].name).toBe('Default');
    expect(c.issues).toContain('Only the first 100 of 105 variants will be imported');
  });
});
