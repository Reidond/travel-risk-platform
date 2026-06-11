import { skipToken, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { configApi } from '../../api/config'
import { evaluationsApi } from '../../api/evaluations'
import {
  RISK_CLASSES,
  RISK_TERMS,
  type CurvesResponse,
  type EvaluationRun,
} from '../../api/types'
import { RiskClassBadge } from '../../components/Badges'
import { EmptyState } from '../../components/EmptyState'
import { ErrorNote, LoadingSkeleton } from '../../components/Feedback'
import { RISK_CLASS_COLORS } from '../../lib/colors'
import { DELTA_SHORT, fmt, formatDateTime } from '../../lib/format'
import { useLang, localizedName } from '../../lib/lang'
import { CurveChart, DistributionChart, MuBarChart } from './charts'
import { IndividualsSection } from './IndividualsSection'

export function DashboardPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)

  const runsQuery = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => evaluationsApi.list({ offset: 0, limit: 100 }),
  })
  const runs = runsQuery.data?.items ?? []
  const runId = selectedRunId ?? runs[0]?.id ?? null

  const runQuery = useQuery({
    queryKey: ['evaluation', runId],
    queryFn: runId === null ? skipToken : () => evaluationsApi.get(runId),
  })
  // Sample the curves of the config version the run was computed with, so
  // historical δ/ω markers sit on the right curves. Runs created before
  // version traceability fall back to the active config's curves.
  const run = runQuery.data
  const curvesQuery = useQuery({
    queryKey: ['curves', run?.config_snapshot.version ?? 'active'],
    queryFn:
      run === undefined ? skipToken : () => configApi.curves(run.config_snapshot.version),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        {runId !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="run-select">{t('dashboard.runSelect')}</Label>
            <Select
              value={String(runId)}
              onValueChange={(value) => setSelectedRunId(Number(value))}
            >
              <SelectTrigger id="run-select" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={String(run.id)}>
                    {t('dashboard.runOption', {
                      id: run.id,
                      date: formatDateTime(run.created_at, lang),
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline">
              <a href={evaluationsApi.exportUrl(runId, 'xlsx', lang)} download>
                {t('dashboard.exportXlsx')}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={evaluationsApi.exportUrl(runId, 'pdf', lang)} download>
                {t('dashboard.exportPdf')}
              </a>
            </Button>
          </div>
        )}
      </div>

      {runsQuery.isPending && <LoadingSkeleton rows={4} />}
      {runsQuery.isError && <ErrorNote error={runsQuery.error} />}
      {runsQuery.isSuccess && runs.length === 0 && (
        <EmptyState
          title={t('emptyStates.dashboardTitle')}
          hint={t('emptyStates.dashboardHint')}
        >
          <Button asChild>
            <Link to="/panel">{t('emptyStates.dashboardCta')}</Link>
          </Button>
        </EmptyState>
      )}

      {runId !== null && runQuery.isPending && (
        <>
          <div className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm">
            <LoadingSkeleton rows={5} />
          </div>
          <div className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm">
            <LoadingSkeleton rows={8} />
          </div>
        </>
      )}
      {runQuery.isError && <ErrorNote error={runQuery.error} />}
      {runQuery.isSuccess && (
        <RunView
          run={runQuery.data}
          curvesError={curvesQuery.error}
          curves={curvesQuery.data ?? null}
        />
      )}
    </div>
  )
}

function RunView({
  run,
  curves,
  curvesError,
}: {
  run: EvaluationRun
  curves: CurvesResponse | null
  curvesError: unknown
}) {
  const { t } = useTranslation()
  const lang = useLang()

  return (
    <>
      <section
        className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        aria-labelledby="comparison-title"
      >
        <h2 id="comparison-title" className="text-lg font-semibold mb-3">
          {t('dashboard.comparisonTitle')}
        </h2>
        <Table>
          <TableCaption className="sr-only">{t('dashboard.comparisonTitle')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t('dashboard.region')}</TableHead>
              <TableHead scope="col" className="text-right">
                {t('values.n')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('values.xi')}
              </TableHead>
              <TableHead scope="col">{t('values.deltaLevel')}</TableHead>
              <TableHead scope="col" className="border-l text-right">
                {t('values.delta')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('values.phi')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('values.mS')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('values.omega')}
              </TableHead>
              <TableHead scope="col" className="border-l text-right">
                {t('values.mu')}
              </TableHead>
              <TableHead scope="col">{t('values.riskClass')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.results.map((result) => (
              <TableRow key={result.region.id}>
                <th
                  scope="row"
                  className="p-2 text-left align-middle font-medium whitespace-nowrap"
                >
                  {localizedName(result.region, lang)}
                </th>
                <TableCell className="text-right tabular-nums">{result.n}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(result.xi, 2)}</TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} title={t(`deltaLevels.${result.delta_level}`)}>
                        {DELTA_SHORT[result.delta_level]}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t(`deltaLevels.${result.delta_level}`)}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="border-l text-right tabular-nums">
                  {fmt(result.delta, 2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(result.phi, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(result.m_s, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(result.omega, 2)}</TableCell>
                <TableCell className="border-l text-right tabular-nums">
                  {fmt(result.mu, 4)}
                </TableCell>
                <TableCell>
                  <RiskClassBadge riskClass={result.risk_class} compact />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section
        className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        aria-labelledby="mu-chart-title"
      >
        <h2 id="mu-chart-title" className="text-lg font-semibold mb-3">
          {t('dashboard.muChartTitle')}
        </h2>
        <MuBarChart results={run.results} />
        <div
          className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm"
          role="list"
          aria-label={t('dashboard.legendTitle')}
        >
          {RISK_CLASSES.map((riskClass) => (
            <span key={riskClass} className="inline-flex items-center gap-1.5" role="listitem">
              <span
                className="size-3.5 rounded-sm inline-block"
                style={{ backgroundColor: RISK_CLASS_COLORS[riskClass] }}
                aria-hidden="true"
              />
              {riskClass} — {t(`riskClasses.${riskClass}`)}
            </span>
          ))}
        </div>
      </section>

      <section
        className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        aria-labelledby="distribution-title"
      >
        <h2 id="distribution-title" className="text-lg font-semibold mb-3">
          {t('dashboard.distributionTitle')}
        </h2>
        <DistributionChart results={run.results} />
      </section>

      <section
        className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        aria-labelledby="curves-title"
      >
        <h2 id="curves-title" className="text-lg font-semibold mb-3">
          {t('dashboard.curvesTitle')}
        </h2>
        {curvesError != null && <ErrorNote error={curvesError} />}
        {curves && (
          <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('dashboard.zSplineTitle')}</h3>
              <CurveChart
                curve={curves.z_spline}
                xLabel="δ"
                yLabel="φ"
                markers={run.results.map((result) => ({
                  x: result.delta,
                  y: result.phi,
                  name: localizedName(result.region, lang),
                  color: RISK_CLASS_COLORS[result.risk_class],
                }))}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('dashboard.sShapeTitle')}</h3>
              <CurveChart
                curve={curves.s_shape}
                xLabel="ω"
                yLabel="μ_R"
                markers={run.results.map((result) => ({
                  x: result.omega,
                  y: result.mu,
                  name: localizedName(result.region, lang),
                  color: RISK_CLASS_COLORS[result.risk_class],
                }))}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('dashboard.coneTitle')}</h3>
              {/* Eq. 4.7 sections: m_S(φ) at Ξ=1 and m_S(Ξ) at φ=1. Region
                  markers are omitted on purpose — each region's m_S is
                  computed with its own Ξ ≠ 1, so the points (φ, m_S) do not
                  lie on either fixed section and would be misleading. */}
              <CurveChart
                curve={curves.cone.xi_fixed}
                curveName={t('dashboard.coneXiFixed')}
                extraCurve={curves.cone.phi_fixed}
                extraCurveName={t('dashboard.conePhiFixed')}
                xLabel="φ, Ξ"
                yLabel="m_S"
              />
            </div>
          </div>
        )}
      </section>

      <IndividualsSection run={run} />

      <section
        className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        aria-labelledby="dist-terms-title"
      >
        <h2 id="dist-terms-title" className="text-lg font-semibold mb-3">
          {t('dashboard.legendTitle')}
        </h2>
        <ul className="list-none space-y-1.5">
          {RISK_TERMS.map((term) => (
            <li key={term} className="text-muted-foreground text-sm">
              {term} — {t(`terms.${term}`)}: χ = {run.config_snapshot.chi_scale[term]}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
