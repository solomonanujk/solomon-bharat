export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (e-acute -> e) instead of dropping the letter
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function uniqueSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function toDecimalString(value: number | string): string {
  return Number(value).toFixed(2);
}

export function calculateMargin(adminPrice: number, sellerPrice: number): number {
  return Math.round((adminPrice - sellerPrice) * 100) / 100;
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 14; i += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}
