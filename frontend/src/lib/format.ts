import type { DeltaLevel, Lang } from '../api/types'

/** Short Δ notation for compact display (full label via i18n `deltaLevels.*`). */
export const DELTA_SHORT: Record<DeltaLevel, string> = {
  D1: 'Δ₁',
  D2: 'Δ₂',
  D3: 'Δ₃',
  D4: 'Δ₄',
  D5: 'Δ₅',
}

/** Presentation rounding per MATH_SPEC §6 (no rounding happens server-side). */
export function fmt(value: number, digits: number): string {
  return value.toFixed(digits)
}

export function formatDateTime(iso: string, lang: Lang): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
