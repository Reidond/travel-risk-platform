import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { importApi } from '../../api/importApi'
import type { ImportReport, Region } from '../../api/types'
import { ErrorNote } from '../../components/Feedback'
import { useLang, localizedName } from '../../lib/lang'

export function ImportPanel({ regions }: { regions: Region[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [regionId, setRegionId] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)

  const invalidateData = () => {
    void queryClient.invalidateQueries({ queryKey: ['regions'] })
    void queryClient.invalidateQueries({ queryKey: ['respondents'] })
  }

  const importMutation = useMutation({
    mutationFn: ({ file, targetRegionId }: { file: File; targetRegionId: number | null }) =>
      importApi.importFile(file, targetRegionId),
    onSuccess: invalidateData,
  })

  const demoMutation = useMutation({
    mutationFn: importApi.loadDemo,
    onSuccess: invalidateData,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setFileError(t('regions.import.noFile'))
      return
    }
    setFileError(null)
    importMutation.mutate({
      file,
      targetRegionId: regionId === '' ? null : Number(regionId),
    })
  }

  const demoConflict =
    demoMutation.isError &&
    demoMutation.error instanceof ApiError &&
    demoMutation.error.status === 409

  return (
    <section className="panel-card" aria-labelledby="import-title">
      <h2 id="import-title">{t('regions.import.title')}</h2>
      <form className="import-form" onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="import-file">{t('regions.import.file')}</label>
          <input id="import-file" ref={fileRef} type="file" accept=".xlsx,.csv" />
        </div>
        <div className="form-field">
          <label htmlFor="import-region">{t('regions.import.targetRegion')}</label>
          <select
            id="import-region"
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
          >
            <option value="">{t('regions.import.autoDetect')}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {localizedName(region, lang)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions form-actions-start">
          <button type="submit" className="btn btn-primary" disabled={importMutation.isPending}>
            {importMutation.isPending ? t('regions.import.importing') : t('regions.import.submit')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={demoMutation.isPending}
            onClick={() => demoMutation.mutate()}
          >
            {demoMutation.isPending ? t('regions.import.demoLoading') : t('regions.import.demo')}
          </button>
        </div>
      </form>
      {fileError !== null && (
        <p className="form-error" role="alert">
          {fileError}
        </p>
      )}
      {importMutation.isError && <ErrorNote error={importMutation.error} />}
      {demoConflict ? (
        <p className="alert alert-info" role="status">
          {t('regions.import.demoConflict')}
        </p>
      ) : (
        demoMutation.isError && <ErrorNote error={demoMutation.error} />
      )}
      {demoMutation.isSuccess && (
        <p className="alert alert-success" role="status">
          {t('regions.import.demoDone', { imported: demoMutation.data.imported })}
        </p>
      )}
      {importMutation.isSuccess && <ImportReportView report={importMutation.data} />}
    </section>
  )
}

function ImportReportView({ report }: { report: ImportReport }) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <div className="import-report">
      <h3>{t('regions.import.result')}</h3>
      <p>
        {t('regions.import.imported')}: <strong>{report.imported}</strong>
        {' · '}
        {t('regions.import.skipped')}: <strong>{report.skipped}</strong>
      </p>
      {report.created_regions.length > 0 && (
        <p>
          {t('regions.import.createdRegions')}:{' '}
          {report.created_regions.map((region) => localizedName(region, lang)).join(', ')}
        </p>
      )}
      {report.errors.length > 0 && (
        <table className="data-table">
          <caption>{t('regions.import.rowErrors')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('regions.import.row')}</th>
              <th scope="col">{t('regions.import.message')}</th>
            </tr>
          </thead>
          <tbody>
            {report.errors.map((error) => (
              <tr key={`${error.row}-${error.message}`}>
                <td>{error.row}</td>
                <td>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
