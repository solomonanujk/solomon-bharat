export function formatCurrency(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}