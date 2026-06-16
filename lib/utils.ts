import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fmt$ = (n: number | null | undefined, d = 2): string => {
  if (n == null || isNaN(n)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(n)
}

export const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(1)}%`

export const today = () => new Date().toISOString().slice(0, 10)

export const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 864e5)

export const isLongTerm = (buyDate: string, saleDate: string) =>
  !!(buyDate && saleDate && daysBetween(buyDate, saleDate) >= 365)

export const monthKey = (d?: string) => (d || today()).slice(0, 7)
