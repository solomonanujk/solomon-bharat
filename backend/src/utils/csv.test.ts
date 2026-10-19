import { describe, it, expect } from 'vitest';
import { buildCsv, csvCell, toIsoDate, UTF8_BOM } from './csv';

describe('csvCell', () => {
  it('renders empty for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('renders booleans as Yes/No', () => {
    expect(csvCell(true)).toBe('Yes');
    expect(csvCell(false)).toBe('No');
  });

  it('renders dates as YYYY-MM-DD and ignores invalid ones', () => {
    expect(csvCell(new Date('2026-03-04T11:22:33Z'))).toBe('2026-03-04');
    expect(csvCell(new Date('nonsense'))).toBe('');
  });

  it('semicolon-joins arrays', () => {
    expect(csvCell(['Textiles', 'Pottery'])).toBe('Textiles; Pottery');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvCell('Ravi "Raj" Kumar')).toBe('"Ravi ""Raj"" Kumar"');
  });

  it('quotes values containing a comma or a newline', () => {
    expect(csvCell('Jaipur, Rajasthan')).toBe('"Jaipur, Rajasthan"');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('leaves non-Latin text and the rupee sign untouched', () => {
    expect(csvCell('आशा शर्मा ₹1,000')).toBe('"आशा शर्मा ₹1,000"');
  });

  it('neutralises spreadsheet formulas with a leading apostrophe', () => {
    expect(csvCell('=HYPERLINK("http://evil.test","click")')).toBe(
      `"'=HYPERLINK(""http://evil.test"",""click"")"`,
    );
    expect(csvCell('+1-555-0000')).toBe("'+1-555-0000");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('does not touch a value that merely contains those characters', () => {
    expect(csvCell('a=b')).toBe('a=b');
  });
});

describe('buildCsv', () => {
  it('prefixes a UTF-8 BOM so Excel decodes the file as UTF-8', () => {
    const csv = buildCsv(['Name'], [['आशा']]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it('writes a header row, CRLF line endings and a trailing newline', () => {
    const csv = buildCsv(['Name', 'City'], [['Asha', 'Jaipur'], ['Ravi', 'Delhi']]);
    expect(csv).toBe(`${UTF8_BOM}Name,City\r\nAsha,Jaipur\r\nRavi,Delhi\r\n`);
  });

  it('writes a header-only document when there are no rows', () => {
    expect(buildCsv(['Name'], [])).toBe(`${UTF8_BOM}Name\r\n`);
  });

  it('keeps a multi-line cell inside one quoted field, preserving the column grid', () => {
    const csv = buildCsv(['Notes', 'City'], [['first\nsecond', 'Jaipur']]);
    expect(csv).toBe(`${UTF8_BOM}Notes,City\r\n"first\nsecond",Jaipur\r\n`);
  });
});

describe('toIsoDate', () => {
  it('formats in UTC, independent of the server timezone', () => {
    expect(toIsoDate(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
  });
});
