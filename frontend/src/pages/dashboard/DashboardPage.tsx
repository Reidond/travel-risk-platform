import { skipToken, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { configApi } from '../../api/config'
import { evaluationsApi } from '../../api/evaluations'
import {
  RISK_CLASSES,
  RISK_TERMS,
  type CurvesResponse,
  type EvaluationRun,
} from '../../api/types'
import { RiskClassBadge } from '../../components/Badges'
import { ErrorNote, Loading } from '../../components/Feedback'
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
    <div className="page">
      <div className="page-head">
        <h1>{t('dashboard.title')}</h1>
        {runId !== null && (
          <div className="row-actions">
            <a className="btn" href={evaluationsApi.exportUrl(runId, 'xlsx', lang)} download>
              {t('dashboard.exportXlsx')}
            </a>
            <a className="btn" href={evaluationsApi.exportUrl(runId, 'pdf', lang)} download>
              {t('dashboard.exportPdf')}
            </a>
          </div>
        )}
      </div>

      {runsQuery.isPending && <Loading />}
      {runsQuery.isError && <ErrorNote error={runsQuery.error} />}
      {runsQuery.isSuccess && runs.length === 0 && (
        <p className="muted">{t('dashboard.noRuns')}</p>
      )}

      {runs.length > 0 && (
        <div className="form-field input-inline">
          <label htmlFor="run-select">{t('dashboard.runSelect')}</label>
          <select
            id="run-select"
            value={runId ?? ''}
            onChange={(e) => setSelectedRunId(Number(e.target.value))}
          >
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {t('dashboard.runOption', {
                  id: run.id,
                  date: formatDateTime(run.created_at, lang),
                })}
              </option>
            ))}
          </select>
        </div>
      )}

      {runId !== null && runQuery.isPending && <Loading />}
      {runQuery.isError && <ErrorNote error={runQuery.error} />}
      {runQuery.isSuccess && <RunView run={runQuery.data} curvesError={curvesQuery.error} curves={curvesQuery.data ?? null} />}
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
      <section className="panel-card" aria-labelledby="comparison-title">
        <h2 id="comparison-title">{t('dashboard.comparisonTitle')}</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('dashboard.region')}</th>
                <th scope="col">{t('values.n')}</th>
                <th scope="col">{t('values.xi')}</th>
                <th scope="col">{t('values.deltaLevel')}</th>
                <th scope="col">{t('values.delta')}</th>
                <th scope="col">{t('values.phi')}</th>
                <th scope="col">{t('values.mS')}</th>
                <th scope="col">{t('values.omega')}</th>
                <th scope="col">{t('values.mu')}</th>
                <th scope="col">{t('values.riskClass')}</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((result) => (
                <tr key={result.region.id}>
                  <th scope="row">{localizedName(result.region, lang)}</th>
                  <td>{result.n}</td>
                  <td>{fmt(result.xi, 2)}</td>
                  <td title={t(`deltaLevels.${result.delta_level}`)}>
                    {DELTA_SHORT[result.delta_level]}
                  </td>
                  <td>{fmt(result.delta, 2)}</td>
                  <td>{fmt(result.phi, 4)}</td>
                  <td>{fmt(result.m_s, 4)}</td>
                  <td>{fmt(result.omega, 2)}</td>
                  <td>{fmt(result.mu, 4)}</td>
                  <td>
                    <RiskClassBadge riskClass={result.risk_class} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card" aria-labelledby="mu-chart-title">
        <h2 id="mu-chart-title">{t('dashboard.muChartTitle')}</h2>
        <MuBarChart results={run.results} />
        <div className="risk-legend" role="list" aria-label={t('dashboard.legendTitle')}>
          {RISK_CLASSES.map((riskClass) => (
            <span key={riskClass} className="risk-legend-item" role="listitem">
              <span
                className="risk-legend-swatch"
                style={{ backgroundColor: RISK_CLASS_COLORS[riskClass] }}
                aria-hidden="true"
              />
              {riskClass} — {t(`riskClasses.${riskClass}`)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel-card" aria-labelledby="distribution-title">
        <h2 id="distribution-title">{t('dashboard.distributionTitle')}</h2>
        <DistributionChart results={run.results} />
      </section>

      <section className="panel-card" aria-labelledby="curves-title">
        <h2 id="curves-title">{t('dashboard.curvesTitle')}</h2>
        {curvesError != null && <ErrorNote error={curvesError} />}
        {curves && (
          <div className="charts-row">
            <div>
              <h3>{t('dashboard.zSplineTitle')}</h3>
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
              <h3>{t('dashboard.sShapeTitle')}</h3>
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
              <h3>{t('dashboard.coneTitle')}</h3>
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

      <section className="panel-card" aria-labelledby="dist-terms-title">
        <h2 id="dist-terms-title">{t('dashboard.legendTitle')}</h2>
        <ul className="distribution-list">
          {RISK_TERMS.map((term) => (
            <li key={term}>
              <span className="muted">
                {term} — {t(`terms.${term}`)}: χ = {run.config_snapshot.chi_scale[term]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
