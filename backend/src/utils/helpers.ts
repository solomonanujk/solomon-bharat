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

/** Builds a stable, human-readable Cloudinary/local-disk folder path for one entity:
 *  e.g. entityFolder('products', 'handwoven-cotton-table-runner', 'a3f9e2b1-...')
 *  -> 'products/handwoven-cotton-table-runner--a3f9e2b1'. The slug makes it
 *  recognizable when browsing Cloudinary directly; the id suffix keeps it stable
 *  forever even if the entity is later renamed/re-slugged. */
export function entityFolder(type: string, slug: string, id: string): string {
  return `${type}/${slug}--${id.slice(0, 8)}`;
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 14; i += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}
