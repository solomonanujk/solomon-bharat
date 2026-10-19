import { describe, expect, it } from 'vitest';
import { detectLanguage, normalizeText, parseCommand, resolveTarget } from './whatsapp.commands';

describe('parseCommand', () => {
  it.each(['help', 'Help!', 'hi', 'Hello', 'menu', 'namaste', 'madad', 'मदद', '?'])('%s is help', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'help' });
  });

  it.each(['list', 'status', 'my products', 'mere products', 'products', 'सूची'])('%s is list', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'list' });
  });

  it.each(['cancel', 'stop', 'ruko', 'रद्द'])('%s is cancel', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'cancel' });
  });

  it('reads "stock <n> <qty>" as list position and quantity', () => {
    expect(parseCommand('stock 2 20')).toEqual({ kind: 'stock', target: { index: 2 }, quantity: 20 });
    expect(parseCommand('Stock 3 0')).toEqual({ kind: 'stock', target: { index: 3 }, quantity: 0 });
  });

  it('reads "stock <name> <qty>" and the quantity-first form', () => {
    expect(parseCommand('stock banarasi saree 20')).toEqual({
      kind: 'stock',
      target: { name: 'banarasi saree' },
      quantity: 20,
    });
    expect(parseCommand('stock 20 saree')).toEqual({ kind: 'stock', target: { name: 'saree' }, quantity: 20 });
  });

  it('understands Devanagari digits and keywords', () => {
    expect(parseCommand('स्टॉक २ २०')).toEqual({ kind: 'stock', target: { index: 2 }, quantity: 20 });
  });

  it('gives usage help when the stock command is incomplete', () => {
    expect(parseCommand('stock')).toEqual({ kind: 'stockUsage' });
    expect(parseCommand('stock saree')).toEqual({ kind: 'stockUsage' });
    expect(parseCommand('stock 20')).toEqual({ kind: 'stockUsage' });
  });

  it('reads out-of-stock phrases in English and Hinglish', () => {
    expect(parseCommand('out of stock 2')).toEqual({ kind: 'outOfStock', target: { index: 2 } });
    expect(parseCommand('stock khatam saree')).toEqual({ kind: 'outOfStock', target: { name: 'saree' } });
    expect(parseCommand('khatam 3')).toEqual({ kind: 'outOfStock', target: { index: 3 } });
    expect(parseCommand('out of stock')).toEqual({ kind: 'outOfStockUsage' });
  });

  it('reads resubmit commands', () => {
    expect(parseCommand('resubmit 2')).toEqual({ kind: 'resubmit', target: { index: 2 } });
    expect(parseCommand('resubmit my brass lamp')).toEqual({ kind: 'resubmit', target: { name: 'brass lamp' } });
    expect(parseCommand('resubmit')).toEqual({ kind: 'resubmitUsage' });
  });

  it.each(['add', 'Add product', 'add new product', 'naya product', 'sell'])('%s starts a listing', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'add' });
  });

  it.each(['done', 'Done!', 'bas', 'ho gaya', 'finished'])('%s means done', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'done' });
  });

  it.each(['yes', 'Yes please', 'ok', 'haan', 'confirm', 'submit', 'हाँ'])('%s confirms', (text) => {
    expect(parseCommand(text)).toEqual({ kind: 'confirm' });
  });

  it('does not mistake a longer sentence for add, done or confirm', () => {
    expect(parseCommand('add a lot of detail about the weaving and the dye here')).toEqual({ kind: 'unknown' });
    expect(parseCommand('done with the weaving by hand in two weeks')).toEqual({ kind: 'unknown' });
    expect(parseCommand('yes it is made of cotton')).toEqual({ kind: 'unknown' });
  });

  it('treats everything else as unknown', () => {
    expect(parseCommand('')).toEqual({ kind: 'unknown' });
    expect(parseCommand('I want to sell a blue pottery vase')).toEqual({ kind: 'unknown' });
  });
});

describe('detectLanguage', () => {
  it('picks Hindi for Devanagari, Hinglish for roman Hindi words, else English', () => {
    expect(detectLanguage('मेरे प्रोडक्ट दिखाओ')).toBe('hi');
    expect(detectLanguage('mere products dikhao')).toBe('hinglish');
    expect(detectLanguage('stock khatam 2')).toBe('hinglish');
    expect(detectLanguage('list')).toBe('en');
    expect(detectLanguage('naya product')).toBe('hinglish');
  });
});

describe('normalizeText', () => {
  it('lowercases, strips punctuation and converts Devanagari digits', () => {
    expect(normalizeText('  Stock,  २  ५०!! ')).toBe('stock 2 50');
  });
});

describe('resolveTarget', () => {
  const products = [{ name: 'Banarasi Silk Saree' }, { name: 'Cotton Saree' }, { name: 'Brass Lamp' }];

  it('resolves a list position, 1-based', () => {
    expect(resolveTarget({ index: 3 }, products).product).toBe(products[2]);
    expect(resolveTarget({ index: 4 }, products).product).toBeUndefined();
    expect(resolveTarget({ index: 0 }, products).product).toBeUndefined();
  });

  it('resolves a unique name match by words in any order', () => {
    expect(resolveTarget({ name: 'brass' }, products).product).toBe(products[2]);
    expect(resolveTarget({ name: 'silk banarasi' }, products).product).toBe(products[0]);
  });

  it('reports every match when ambiguous and none when nothing matches', () => {
    const ambiguous = resolveTarget({ name: 'saree' }, products);
    expect(ambiguous.product).toBeUndefined();
    expect(ambiguous.matches).toHaveLength(2);
    expect(resolveTarget({ name: 'vase' }, products).matches).toHaveLength(0);
  });

  it('prefers an exact full-name match over partial ones', () => {
    const items = [{ name: 'Lamp' }, { name: 'Brass Lamp' }];
    expect(resolveTarget({ name: 'lamp' }, items).product).toBe(items[0]);
  });
});
