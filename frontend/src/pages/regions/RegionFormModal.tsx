import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { regionsApi } from '../../api/regions'
import { DELTA_LEVELS, type DeltaLevel, type Region, type RegionCreate } from '../../api/types'
import { ErrorNote } from '../../components/Feedback'
import { Modal } from '../../components/Modal'

interface RegionFormModalProps {
  region?: Region
  onClose: () => void
}

export function RegionFormModal({ region, onClose }: RegionFormModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [nameUk, setNameUk] = useState(region?.name_uk ?? '')
  const [nameEn, setNameEn] = useState(region?.name_en ?? '')
  const [xi, setXi] = useState(region?.xi != null ? String(region.xi) : '')
  const [delta, setDelta] = useState<DeltaLevel | ''>(region?.delta_level ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: RegionCreate) =>
      region ? regionsApi.update(region.id, body) : regionsApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
      onClose()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (nameUk.trim() === '' || nameEn.trim() === '') {
      setFormError(t('validation.required'))
      return
    }
    let xiValue: number | null = null
    if (xi.trim() !== '') {
      const parsed = Number(xi)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        setFormError(t('validation.xiRange'))
        return
      }
      xiValue = parsed
    }
    setFormError(null)
    mutation.mutate({
      name_uk: nameUk.trim(),
      name_en: nameEn.trim(),
      xi: xiValue,
      delta_level: delta === '' ? null : delta,
    })
  }

  return (
    <Modal title={region ? t('regions.editRegion') : t('regions.createRegion')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="region-name-uk">{t('regions.nameUk')}</label>
          <input
            id="region-name-uk"
            type="text"
            value={nameUk}
            onChange={(e) => setNameUk(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="region-name-en">{t('regions.nameEn')}</label>
          <input
            id="region-name-en"
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="region-xi">{t('values.xi')}</label>
          <input
            id="region-xi"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={xi}
            onChange={(e) => setXi(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="region-delta">{t('values.deltaLevel')}</label>
          <select
            id="region-delta"
            value={delta}
            onChange={(e) => setDelta(e.target.value as DeltaLevel | '')}
          >
            <option value="">{t('common.notSet')}</option>
            {DELTA_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`deltaLevels.${level}`)}
              </option>
            ))}
          </select>
        </div>
        {formError !== null && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        {mutation.isError && <ErrorNote error={mutation.error} />}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
