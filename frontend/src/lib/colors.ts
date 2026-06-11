import type { RiskClass, RiskTerm } from '../api/types'

/** Risk class colors exactly per API_CONTRACT.md §Frontend. */
export const RISK_CLASS_COLORS: Record<RiskClass, string> = {
  R1: '#c62828',
  R2: '#ef6c00',
  R3: '#f9a825',
  R4: '#9ccc65',
  R5: '#2e7d32',
}

/** r* term colors (L→H = green→red) exactly per API_CONTRACT.md §Frontend. */
export const TERM_COLORS: Record<RiskTerm, string> = {
  L: '#2e7d32',
  BA: '#9ccc65',
  A: '#f9a825',
  AA: '#ef6c00',
  H: '#c62828',
}

const LIGHT_BACKGROUNDS = new Set(['#f9a825', '#9ccc65', '#ef6c00'])

/** Text color with WCAG AA contrast on the given badge background. */
export function badgeTextColor(background: string): string {
  return LIGHT_BACKGROUNDS.has(background) ? '#1f2430' : '#ffffff'
}
