import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── Class Name Utility ───────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Currency Formatting ──────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatINR(amount: number): string {
  return formatCurrency(amount, 'INR')
}

// ─── String Utilities ─────────────────────────────────────────────────────────

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length).trimEnd() + '…'
}
