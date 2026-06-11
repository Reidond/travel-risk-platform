import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { configApi } from '../../api/config'
import { RISK_TERMS, type ConfigParams, type ConfigVersion, type RiskTerm } from '../../api/types'
import { ErrorNote, Loading } from '../../components/Feedback'
import { formatDateTime } from '../../lib/format'
import { useLang } from '../../lib/lang'

export function ConfigSection() {
  const { t } = useTranslation()
  const configQuery = useQuery({ queryKey: ['config'], queryFn: configApi.getActive })
  const versionsQuery = useQuery({ queryKey: ['configVersions'], queryFn: configApi.versions })

  return (
    <section className="panel-card" aria-labelledby="config-title">
      <h2 id="config-title">{t('parameters.config.title')}</h2>
      {configQuery.isPending && <Loading />}
      {configQuery.isError && <ErrorNote error={configQuery.error} />}
      {configQuery.isSuccess && (
        <>
          <p className="muted">
            {t('parameters.config.activeVersion', { version: configQuery.data.version })}
          </p>
          <ConfigForm key={configQuery.data.version} active={configQuery.data} />
        </>
      )}
      <h3>{t('parameters.config.history')}</h3>
      {versionsQuery.isPending && <Loading />}
      {versionsQuery.isError && <ErrorNote error={versionsQuery.error} />}
      {versionsQuery.isSuccess && <VersionHistory versions={versionsQuery.data.items} />}
    </section>
  )
}

function toStrings(values: number[]): string[] {
  return values.map((value) => String(value))
}

function ConfigForm({ active }: { active: ConfigVersion }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const params = active.params

  const [multipliers, setMultipliers] = useState<string[]>(toStrings(params.term_multipliers))
  const [chi, setChi] = useState<Record<RiskTerm, string>>({
    L: String(params.chi_scale.L),
    BA: String(params.chi_scale.BA),
    A: String(params.chi_scale.A),
    AA: String(params.chi_scale.AA),
    H: String(params.chi_scale.H),
  })
  const [zA, setZA] = useState(String(params.z_spline.a))
  const [zB, setZB] = useState(String(params.z_spline.b))
  const [coneBase, setConeBase] = useState<string[]>(toStrings(params.cone.base))
  const [coneScale, setConeScale] = useState<string[]>(toStrings(params.cone.scale))
  const [boundaries, setBoundaries] = useState<string[]>(
    toStrings(params.fuzzification_boundaries),
  )
  const [thresholds, setThresholds] = useState<string[]>(toStrings(params.risk_thresholds))
  const [comment, setComment] = useState('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [savedVersion, setSavedVersion] = useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: (body: { params: ConfigParams; comment: string | null }) =>
      configApi.create(body),
    onSuccess: (data) => {
      setSavedVersion(data.version)
      void queryClient.invalidateQueries({ queryKey: ['config'] })
      void queryClient.invalidateQueries({ queryKey: ['configVersions'] })
      void queryClient.invalidateQueries({ queryKey: ['curves'] })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors: string[] = []
    const allStrings = [...multipliers, ...Object.values(chi), zA, zB, ...coneBase, ...coneScale, ...boundaries, ...thresholds]
    if (allStrings.some((value) => value.trim() === '' || !Number.isFinite(Number(value)))) {
      errors.push(t('validation.numberInvalid'))
      setFormErrors(errors)
      return
    }
    const multiplierValues = multipliers.map(Number)
    const chiValues: Record<RiskTerm, number> = {
      L: Number(chi.L),
      BA: Number(chi.BA),
      A: Number(chi.A),
      AA: Number(chi.AA),
      H: Number(chi.H),
    }
    const boundaryValues = boundaries.map(Number)
    const thresholdValues = thresholds.map(Number)
    const a = Number(zA)
    const b = Number(zB)

    if (
      multiplierValues.some((value, i) => value <= 0 || (i > 0 && value <= (multiplierValues[i - 1] ?? 0)))
    ) {
      errors.push(t('validation.multipliersIncreasing'))
    }
    if (RISK_TERMS.some((term) => chiValues[term] <= 0)) {
      errors.push(t('validation.chiPositive'))
    }
    if (!(a < b)) {
      errors.push(t('validation.zsplineOrder'))
    }
    if (boundaryValues.some((value, i) => i > 0 && value <= (boundaryValues[i - 1] ?? 0))) {
      errors.push(t('validation.boundariesIncreasing'))
    }
    if (
      thresholdValues.some(
        (value, i) => value <= 0 || value >= 1 || (i > 0 && value <= (thresholdValues[i - 1] ?? 0)),
      )
    ) {
      errors.push(t('validation.thresholdsIncreasing'))
    }
    setFormErrors(errors)
    if (errors.length > 0) return

    setSavedVersion(null)
    mutation.mutate({
      params: {
        term_multipliers: multiplierValues,
        chi_scale: chiValues,
        z_spline: { a, b },
        cone: {
          base: [Number(coneBase[0]), Number(coneBase[1])],
          scale: [Number(coneScale[0]), Number(coneScale[1])],
        },
        fuzzification_boundaries: boundaryValues,
        risk_thresholds: thresholdValues,
      },
      comment: comment.trim() === '' ? null : comment.trim(),
    })
  }

  const updateAt = (setter: (updater: (prev: string[]) => string[]) => void, index: number) =>
    (value: string) => {
      setter((prev) => prev.map((item, i) => (i === index ? value : item)))
    }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset className="config-group">
        <legend>{t('parameters.config.termMultipliers')}</legend>
        <div className="form-row">
          {multipliers.map((value, index) => {
            const id = `multiplier-${index}`
            return (
              <div key={id} className="form-field">
                <label htmlFor={id}>{t('parameters.config.multiplier', { index: index + 1 })}</label>
                <input
                  id={id}
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => updateAt(setMultipliers, index)(e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="config-group">
        <legend>{t('parameters.config.chiScale')}</legend>
        <div className="form-row">
          {RISK_TERMS.map((term) => {
            const id = `chi-${term}`
            return (
              <div key={term} className="form-field">
                <label htmlFor={id}>
                  {t('parameters.config.chiFor', { term: `${term} (${t(`terms.${term}`)})` })}
                </label>
                <input
                  id={id}
                  type="number"
                  step="any"
                  value={chi[term]}
                  onChange={(e) => setChi((prev) => ({ ...prev, [term]: e.target.value }))}
                />
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="config-group">
        <legend>{t('parameters.config.zSpline')}</legend>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="z-a">{t('parameters.config.zA')}</label>
            <input id="z-a" type="number" step="any" value={zA} onChange={(e) => setZA(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="z-b">{t('parameters.config.zB')}</label>
            <input id="z-b" type="number" step="any" value={zB} onChange={(e) => setZB(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="config-group">
        <legend>{t('parameters.config.cone')}</legend>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="cone-base-x">{t('parameters.config.coneBaseX')}</label>
            <input
              id="cone-base-x"
              type="number"
              step="any"
              value={coneBase[0] ?? ''}
              onChange={(e) => updateAt(setConeBase, 0)(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="cone-base-y">{t('parameters.config.coneBaseY')}</label>
            <input
              id="cone-base-y"
              type="number"
              step="any"
              value={coneBase[1] ?? ''}
              onChange={(e) => updateAt(setConeBase, 1)(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="cone-scale-x">{t('parameters.config.coneScaleX')}</label>
            <input
              id="cone-scale-x"
              type="number"
              step="any"
              value={coneScale[0] ?? ''}
              onChange={(e) => updateAt(setConeScale, 0)(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="cone-scale-y">{t('parameters.config.coneScaleY')}</label>
            <input
              id="cone-scale-y"
              type="number"
              step="any"
              value={coneScale[1] ?? ''}
              onChange={(e) => updateAt(setConeScale, 1)(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="config-group">
        <legend>{t('parameters.config.boundaries')}</legend>
        <div className="form-row">
          {boundaries.map((value, index) => {
            const id = `boundary-${index}`
            return (
              <div key={id} className="form-field">
                <label htmlFor={id}>{t('parameters.config.boundary', { index: index + 1 })}</label>
                <input
                  id={id}
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => updateAt(setBoundaries, index)(e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="config-group">
        <legend>{t('parameters.config.thresholds')}</legend>
        <div className="form-row">
          {thresholds.map((value, index) => {
            const id = `threshold-${index}`
            return (
              <div key={id} className="form-field">
                <label htmlFor={id}>{t('parameters.config.threshold', { index: index + 1 })}</label>
                <input
                  id={id}
                  type="number"
                  step="any"
                  min={0}
                  max={1}
                  value={value}
                  onChange={(e) => updateAt(setThresholds, index)(e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="config-comment">{t('common.comment')}</label>
        <input
          id="config-comment"
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {formErrors.length > 0 && (
        <ul className="form-error" role="alert">
          {formErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {mutation.isError && <ErrorNote error={mutation.error} />}
      {savedVersion !== null && (
        <p className="alert alert-success" role="status">
          {t('parameters.config.saved', { version: savedVersion })}
        </p>
      )}

      <div className="form-actions form-actions-start">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('parameters.config.saveAsNew')}
        </button>
      </div>
    </form>
  )
}

function VersionHistory({ versions }: { versions: ConfigVersion[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const activateMutation = useMutation({
    mutationFn: configApi.activate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config'] })
      void queryClient.invalidateQueries({ queryKey: ['configVersions'] })
      void queryClient.invalidateQueries({ queryKey: ['curves'] })
    },
  })

  return (
    <>
      {activateMutation.isError && <ErrorNote error={activateMutation.error} />}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('common.version')}</th>
              <th scope="col">{t('common.createdAt')}</th>
              <th scope="col">{t('common.comment')}</th>
              <th scope="col">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.version}>
                <td>{version.version}</td>
                <td>{formatDateTime(version.created_at, lang)}</td>
                <td>{version.comment ?? '—'}</td>
                <td>
                  {version.active ? (
                    <span className="status-badge status-ok">{t('common.active')}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={activateMutation.isPending}
                      onClick={() => activateMutation.mutate(version.version)}
                    >
                      {t('common.activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
