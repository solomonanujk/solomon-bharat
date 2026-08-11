import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats a numeric value as USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats a string value as USD', () => {
    expect(formatCurrency('99.9')).toBe('$99.90');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});
