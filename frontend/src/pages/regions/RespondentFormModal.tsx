import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { respondentsApi } from '../../api/respondents'
import type { CriteriaConfig, Ratings, Respondent, RespondentCreate } from '../../api/types'
import { ErrorNote } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { useLang, localizedName } from '../../lib/lang'

interface RespondentFormModalProps {
  regionId: number
  criteria: CriteriaConfig
  respondent?: Respondent
  onClose: () => void
}

const RATING_VALUES = [1, 2, 3, 4, 5] as const

function initialRatings(criteria: CriteriaConfig, respondent?: Respondent): Ratings {
  const ratings: Ratings = {}
  for (const group of criteria.groups) {
    for (const criterion of group.criteria) {
      ratings[criterion.code] = respondent?.ratings[criterion.code] ?? 3
    }
  }
  return ratings
}

export function RespondentFormModal({
  regionId,
  criteria,
  respondent,
  onClose,
}: RespondentFormModalProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [extId, setExtId] = useState(respondent?.ext_id ?? '')
  // Year/month are free-text (imported data holds e.g. «2021 рік», «Липень»).
  const [year, setYear] = useState(respondent?.year ?? '')
  const [month, setMonth] = useState(respondent?.month ?? '')
  const [accommodation, setAccommodation] = useState(respondent?.accommodation ?? '')
  const [ratings, setRatings] = useState<Ratings>(() => initialRatings(criteria, respondent))
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: RespondentCreate) =>
      respondent ? respondentsApi.update(respondent.id, body) : respondentsApi.create(regionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['respondents'] })
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
      onClose()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (Object.values(ratings).some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
      setFormError(t('validation.ratingRange'))
      return
    }
    setFormError(null)
    mutation.mutate({
      ext_id: extId.trim() === '' ? null : extId.trim(),
      year: year.trim() === '' ? null : year.trim(),
      month: month.trim() === '' ? null : month.trim(),
      accommodation: accommodation.trim() === '' ? null : accommodation.trim(),
      ratings,
    })
  }

  return (
    <Modal
      title={respondent ? t('regions.respondentsTable.edit') : t('regions.respondentsTable.add')}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="resp-ext-id">{t('regions.respondentsTable.extId')}</label>
            <input
              id="resp-ext-id"
              type="text"
              value={extId}
              onChange={(e) => setExtId(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="resp-year">{t('regions.respondentsTable.year')}</label>
            <input
              id="resp-year"
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="resp-month">{t('regions.respondentsTable.month')}</label>
            <input
              id="resp-month"
              type="text"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="resp-accommodation">
              {t('regions.respondentsTable.accommodation')}
            </label>
            <input
              id="resp-accommodation"
              type="text"
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value)}
            />
          </div>
        </div>
        {criteria.groups.map((group) => (
          <fieldset key={group.code} className="criteria-group">
            <legend>
              {group.code} — {localizedName(group, lang)}
            </legend>
            {group.criteria.map((criterion) => {
              const inputId = `rating-${criterion.code}`
              return (
                <div key={criterion.code} className="form-field criterion-field">
                  <label htmlFor={inputId}>
                    {criterion.code}. {lang === 'en' ? criterion.text_en : criterion.text_uk}
                  </label>
                  <select
                    id={inputId}
                    value={ratings[criterion.code] ?? 3}
                    onChange={(e) =>
                      setRatings((prev) => ({
                        ...prev,
                        [criterion.code]: Number(e.target.value),
                      }))
                    }
                  >
                    {RATING_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value} — {t(`scale.l${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </fieldset>
        ))}
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
