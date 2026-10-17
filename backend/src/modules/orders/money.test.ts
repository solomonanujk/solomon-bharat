import { describe, it, expect } from 'vitest';
import { fromPaise, splitProRata, toPaise } from './money';

describe('money helpers', () => {
  it('paise round-trip', () => {
    expect(fromPaise(toPaise(19.99))).toBe(19.99);
  });

  describe('splitProRata', () => {
    it('splits proportionally', () => {
      expect(splitProRata(100, [1, 3])).toEqual([25, 75]);
    });

    it('puts the rounding remainder on the last share so the sum always equals the total', () => {
      const shares = splitProRata(100, [1, 1, 1]);
      expect(shares).toEqual([33.33, 33.33, 33.34]);
      expect(shares.reduce((a, b) => a + toPaise(b), 0)).toBe(10000);
    });

    it('always sums exactly to the total for awkward weights', () => {
      const weights = [123.45, 0.01, 999.99, 5000];
      for (const total of [0.01, 1.44, 4.2, 99.99, 12345.67]) {
        const shares = splitProRata(total, weights);
        expect(shares.reduce((a, b) => a + toPaise(b), 0)).toBe(toPaise(total));
      }
    });

    it('handles one share and no shares', () => {
      expect(splitProRata(5.5, [10])).toEqual([5.5]);
      expect(splitProRata(5.5, [])).toEqual([]);
    });
  });
});
