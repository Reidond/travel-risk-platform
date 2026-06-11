import { useTranslation } from 'react-i18next'

import type { RiskClass, RiskTerm } from '../api/types'
import { badgeTextColor, RISK_CLASS_COLORS, TERM_COLORS } from '../lib/colors'

export function RiskClassBadge({ riskClass, compact }: { riskClass: RiskClass; compact?: boolean }) {
  const { t } = useTranslation()
  const background = RISK_CLASS_COLORS[riskClass]
  const label = t(`riskClasses.${riskClass}`)
  return (
    <span
      className="badge"
      style={{ backgroundColor: background, color: badgeTextColor(background) }}
      title={label}
    >
      {compact === true ? riskClass : `${riskClass} — ${label}`}
    </span>
  )
}

export function TermBadge({ term, compact }: { term: RiskTerm; compact?: boolean }) {
  const { t } = useTranslation()
  const background = TERM_COLORS[term]
  const label = t(`terms.${term}`)
  return (
    <span
      className="badge"
      style={{ backgroundColor: background, color: badgeTextColor(background) }}
      title={label}
    >
      {compact === true ? term : `${term} — ${label}`}
    </span>
  )
}
