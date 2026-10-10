import { describe, it, expect } from 'vitest';
import { computeLineCommission, fromPaise, pickRate, splitProRata, toPaise } from './commission';

describe('commission helpers', () => {
  it('pickRate: first paid order uses the first rate, later ones the repeat rate', () => {
    expect(pickRate({ first: 25, repeat: 15 }, true)).toBe(25);
    expect(pickRate({ first: 25, repeat: 15 }, false)).toBe(15);
  });

  it('computes 25% and 15% commission with net + commission == gross', () => {
    expect(computeLineCommission(1000, 10, 25)).toEqual({ commissionAmount: 250, lineNet: 750, unitNet: 75 });
    expect(computeLineCommission(1000, 10, 15)).toEqual({ commissionAmount: 150, lineNet: 850, unitNet: 85 });
  });

  it('supports override rates with decimals', () => {
    const c = computeLineCommission(999.99, 3, 12.5);
    expect(toPaise(c.commissionAmount) + toPaise(c.lineNet)).toBe(toPaise(999.99));
    expect(c.commissionAmount).toBe(125);
  });

  it('keeps net + commission == gross across awkward amounts and rates (rounding)', () => {
    const amounts = [0.01, 0.07, 1.15, 33.33, 99.99, 1234.57, 87654.32];
    const rates = [0, 5, 12.5, 15, 17.33, 25, 100];
    for (const gross of amounts) {
      for (const rate of rates) {
        const c = computeLineCommission(gross, 7, rate);
        expect(toPaise(c.commissionAmount) + toPaise(c.lineNet)).toBe(toPaise(gross));
        expect(c.commissionAmount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rounds the commission to 2dp (half up)', () => {
    // 0.05 * 25% = 0.0125 -> 0.01
    expect(computeLineCommission(0.05, 1, 25).commissionAmount).toBe(0.01);
    // 10.10 * 15% = 1.515 -> 1.52 (15150 paise*... half up)
    expect(computeLineCommission(10.1, 1, 15).commissionAmount).toBe(1.52);
  });

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
