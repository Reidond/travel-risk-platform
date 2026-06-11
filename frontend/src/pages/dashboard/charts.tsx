import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { RISK_TERMS, type RegionResult } from '../../api/types'
import { RISK_CLASS_COLORS, TERM_COLORS } from '../../lib/colors'
import { useLang, localizedName } from '../../lib/lang'

/** Horizontal μ_R bar chart, one bar per region, colored by risk class. */
export function MuBarChart({ results }: { results: RegionResult[] }) {
  const lang = useLang()
  const data = results.map((result) => ({
    name: localizedName(result.region, lang),
    mu: Number(result.mu.toFixed(4)),
    riskClass: result.risk_class,
  }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 56 + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} />
        <YAxis type="category" dataKey="name" width={170} />
        <Tooltip />
        <Bar dataKey="mu" name="μ_R" isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={RISK_CLASS_COLORS[entry.riskClass]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Stacked r*(e) distribution per region. */
export function DistributionChart({ results }: { results: RegionResult[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const data = results.map((result) => {
    const row: Record<string, string | number> = {
      name: localizedName(result.region, lang),
    }
    for (const term of RISK_TERMS) {
      row[term] = result.r_star_distribution[term] ?? 0
    }
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        {RISK_TERMS.map((term) => (
          <Bar
            key={term}
            dataKey={term}
            stackId="rstar"
            fill={TERM_COLORS[term]}
            name={`${term} — ${t(`terms.${term}`)}`}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface CurveMarker {
  x: number
  y: number
  name: string
  color: string
}

/** Membership-function line chart with per-region ReferenceDot markers. */
export function CurveChart({
  curve,
  curveName,
  extraCurve,
  extraCurveName,
  markers = [],
  xLabel,
  yLabel,
}: {
  curve: [number, number][]
  /** Legend/tooltip label of the main line (defaults to yLabel). */
  curveName?: string
  /** Optional second line sampled on the same x grid (shows a legend). */
  extraCurve?: [number, number][]
  extraCurveName?: string
  markers?: CurveMarker[]
  xLabel: string
  yLabel: string
}) {
  const data = curve.map(([x, y], index) => ({ x, y, y2: extraCurve?.[index]?.[1] }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 24, right: 32, bottom: 16, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          domain={['dataMin', 'dataMax']}
          label={{ value: xLabel, position: 'insideBottomRight', offset: -8 }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
        />
        <Tooltip />
        {extraCurve && <Legend />}
        <Line type="monotone" dataKey="y" name={curveName ?? yLabel} stroke="#1565c0" dot={false} isAnimationActive={false} />
        {extraCurve && (
          <Line
            type="monotone"
            dataKey="y2"
            name={extraCurveName ?? yLabel}
            stroke="#7b1fa2"
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />
        )}
        {markers.map((marker) => (
          <ReferenceDot
            key={marker.name}
            x={marker.x}
            y={marker.y}
            r={5}
            fill={marker.color}
            stroke="#1f2430"
            label={{ value: marker.name, position: 'top', fontSize: 12 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
