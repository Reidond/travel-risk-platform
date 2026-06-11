import { useTranslation } from 'react-i18next'

import type { RiskClass, RiskTerm } from '../api/types'
import { badgeTextColor, RISK_CLASS_COLORS, TERM_COLORS } from '../lib/colors'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/* Risk colors are contractual (API_CONTRACT.md §Frontend) — applied inline
   from lib/colors.ts, never through theme tokens. */

function ColorBadge({
  background,
  code,
  label,
  compact,
}: {
  background: string
  code: string
  label: string
  compact: boolean
}) {
  const badge = (
    <Badge
      className="border-transparent font-bold"
      style={{ backgroundColor: background, color: badgeTextColor(background) }}
    >
      {compact ? code : `${code} — ${label}`}
      {compact && <span className="sr-only">{label}</span>}
    </Badge>
  )
  if (!compact) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function RiskClassBadge({ riskClass, compact }: { riskClass: RiskClass; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <ColorBadge
      background={RISK_CLASS_COLORS[riskClass]}
      code={riskClass}
      label={t(`riskClasses.${riskClass}`)}
      compact={compact === true}
    />
  )
}

export function TermBadge({ term, compact }: { term: RiskTerm; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <ColorBadge
      background={TERM_COLORS[term]}
      code={term}
      label={t(`terms.${term}`)}
      compact={compact === true}
    />
  )
}
