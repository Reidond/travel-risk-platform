import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { evaluationsApi } from '../../api/evaluations'
import { REGIONS_MAX_LIMIT, regionsApi } from '../../api/regions'
import {
  DELTA_LEVELS,
  RISK_TERMS,
  type DeltaLevel,
  type EvaluationRun,
  type Region,
  type RegionResult,
} from '../../api/types'
import { RiskClassBadge, TermBadge } from '../../components/Badges'
import { ErrorNote, Loading } from '../../components/Feedback'
import { DELTA_SHORT, fmt } from '../../lib/format'
import { useLang, localizedName } from '../../lib/lang'

export function PanelPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set())
  const [run, setRun] = useState<EvaluationRun | null>(null)

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    // Request the backend maximum instead of the default page of 50.
    queryFn: () => regionsApi.list({ limit: REGIONS_MAX_LIMIT }),
  })
  const regions = regionsQuery.data?.items ?? []

  const evalMutation = useMutation({
    mutationFn: (regionIds: number[] | null) =>
      evaluationsApi.create({ region_ids: regionIds }),
    onSuccess: (data) => {
      setRun(data)
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] })
    },
  })

  const toggleRegion = (regionId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(regionId)) {
        next.delete(regionId)
      } else {
        next.add(regionId)
      }
      return next
    })
  }

  return (
    <div className="page">
      <h1>{t('panel.title')}</h1>
      <p className="muted">{t('panel.intro')}</p>

      {regionsQuery.isPending && <Loading />}
      {regionsQuery.isError && <ErrorNote error={regionsQuery.error} />}
      {regionsQuery.isSuccess && regions.length === 0 && (
        <p className="muted">{t('panel.noRegions')}</p>
      )}

      {regions.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{t('dashboard.region')}</th>
                <th scope="col">
                  <abbr title={t('values.xi')}>Ξ</abbr>
                </th>
                <th scope="col">
                  <abbr title={t('values.deltaLevel')}>Δ</abbr>
                </th>
                <th scope="col">
                  <abbr title={t('values.n')}>n</abbr>
                </th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <PanelRow
                  key={region.id}
                  region={region}
                  checked={selectedIds.has(region.id)}
                  onToggle={() => toggleRegion(region.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {regions.length > 0 && (
        <div className="form-actions form-actions-start">
          <button
            type="button"
            className="btn btn-primary"
            disabled={evalMutation.isPending || selectedIds.size === 0}
            onClick={() => evalMutation.mutate([...selectedIds])}
          >
            {evalMutation.isPending
              ? t('panel.running')
              : t('panel.runSelected', { n: selectedIds.size })}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={evalMutation.isPending}
            onClick={() => evalMutation.mutate(null)}
          >
            {evalMutation.isPending ? t('panel.running') : t('panel.runAll')}
          </button>
        </div>
      )}

      {evalMutation.isError && (
        <div className="alert alert-error" role="alert">
          <strong>{t('panel.evalConflict')} </strong>
          <ErrorNote error={evalMutation.error} />
        </div>
      )}

      {run && (
        <section className="panel-card" aria-labelledby="run-results-title">
          <div className="section-head">
            <h2 id="run-results-title">{t('panel.results', { id: run.id })}</h2>
            <Link className="btn" to="/dashboard">
              {t('panel.toDashboard')}
            </Link>
          </div>
          {run.results.map((result) => (
            <ResultCard key={result.region.id} result={result} />
          ))}
          <div className="alert alert-info callout">
            <span>{t('panel.adjustCallout')}</span>{' '}
            <Link to="/parameters">{t('panel.adjustLink')}</Link>
          </div>
        </section>
      )}
    </div>
  )
}

function PanelRow({
  region,
  checked,
  onToggle,
}: {
  region: Region
  checked: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const name = localizedName(region, lang)
  const [xi, setXi] = useState(region.xi != null ? String(region.xi) : '')
  const [delta, setDelta] = useState<DeltaLevel | ''>(region.delta_level ?? '')
  const [rowError, setRowError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (body: { xi: number | null; delta_level: DeltaLevel | null }) =>
      regionsApi.update(region.id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const save = (event: FormEvent) => {
    event.preventDefault()
    let xiValue: number | null = null
    if (xi.trim() !== '') {
      const parsed = Number(xi)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        setRowError(t('validation.xiRange'))
        return
      }
      xiValue = parsed
    }
    setRowError(null)
    saveMutation.mutate({ xi: xiValue, delta_level: delta === '' ? null : delta })
  }

  const ready =
    region.xi != null && region.delta_level != null && region.respondent_count > 0

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={t('panel.selectRegion', { name })}
        />
      </td>
      <th scope="row">{name}</th>
      <td>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={xi}
          onChange={(e) => setXi(e.target.value)}
          aria-label={t('panel.xiInput', { name })}
          className="input-narrow"
        />
      </td>
      <td>
        <select
          value={delta}
          onChange={(e) => setDelta(e.target.value as DeltaLevel | '')}
          aria-label={t('panel.deltaSelect', { name })}
        >
          <option value="">{t('common.notSet')}</option>
          {DELTA_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`deltaLevels.${level}`)}
            </option>
          ))}
        </select>
      </td>
      <td>{region.respondent_count}</td>
      <td>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={save}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
          {ready ? (
            <span className="status-badge status-ok">{t('panel.ready')}</span>
          ) : (
            <>
              {region.xi == null && (
                <span className="status-badge status-warn">{t('panel.missingXi')}</span>
              )}
              {region.delta_level == null && (
                <span className="status-badge status-warn">{t('panel.missingDelta')}</span>
              )}
              {region.respondent_count === 0 && (
                <span className="status-badge status-warn">{t('panel.noRespondents')}</span>
              )}
            </>
          )}
        </div>
        {rowError !== null && (
          <p className="form-error" role="alert">
            {rowError}
          </p>
        )}
        {saveMutation.isError && <ErrorNote error={saveMutation.error} />}
      </td>
    </tr>
  )
}

function ResultCard({ result }: { result: RegionResult }) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <article className="result-card">
      <h3>{localizedName(result.region, lang)}</h3>
      <div className="steps">
        <section className="step-card">
          <h4>{t('panel.step1')}</h4>
          <p className="muted">
            {t('values.n')}: {result.n}
          </p>
          <ul className="distribution-list">
            {RISK_TERMS.map((term) => (
              <li key={term}>
                <TermBadge term={term} compact />{' '}
                <span>{result.r_star_distribution[term] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <span className="step-arrow" aria-hidden="true">
          →
        </span>
        <section className="step-card">
          <h4>{t('panel.step2')}</h4>
          <p>δ = {fmt(result.delta, 2)}</p>
          <p>φ = {fmt(result.phi, 4)}</p>
          <p>
            m_S = {fmt(result.m_s, 4)} (Ξ = {fmt(result.xi, 2)})
          </p>
        </section>
        <span className="step-arrow" aria-hidden="true">
          →
        </span>
        <section className="step-card">
          <h4>{t('panel.step3')}</h4>
          <p>
            ω = {fmt(result.omega, 2)} ({DELTA_SHORT[result.delta_level]})
          </p>
          <p>μ_R = {fmt(result.mu, 4)}</p>
          <p>
            <RiskClassBadge riskClass={result.risk_class} />
          </p>
        </section>
      </div>
    </article>
  )
}
