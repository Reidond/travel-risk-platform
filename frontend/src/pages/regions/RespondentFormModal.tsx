import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

/** Static lookup so the i18n keys stay greppable (no string-built keys). */
const SCALE_LABEL_KEYS = {
  1: 'scale.l1',
  2: 'scale.l2',
  3: 'scale.l3',
  4: 'scale.l4',
  5: 'scale.l5',
} as const

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
      toast.success(respondent ? t('toast.respondentSaved') : t('toast.respondentCreated'))
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
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="grid flex-1 gap-1.5 min-w-40">
            <Label htmlFor="resp-ext-id">{t('regions.respondentsTable.extId')}</Label>
            <Input
              id="resp-ext-id"
              type="text"
              value={extId}
              onChange={(e) => setExtId(e.target.value)}
            />
          </div>
          <div className="grid flex-1 gap-1.5 min-w-40">
            <Label htmlFor="resp-year">{t('regions.respondentsTable.year')}</Label>
            <Input
              id="resp-year"
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="grid flex-1 gap-1.5 min-w-40">
            <Label htmlFor="resp-month">{t('regions.respondentsTable.month')}</Label>
            <Input
              id="resp-month"
              type="text"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="grid flex-1 gap-1.5 min-w-40">
            <Label htmlFor="resp-accommodation">
              {t('regions.respondentsTable.accommodation')}
            </Label>
            <Input
              id="resp-accommodation"
              type="text"
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value)}
            />
          </div>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          {RATING_VALUES.map((value) => `${value} = ${t(SCALE_LABEL_KEYS[value])}`).join(' · ')}
        </p>
        {criteria.groups.map((group) => (
          <fieldset key={group.code} className="rounded-lg border px-4 py-3 mb-4">
            <legend className="px-1.5 text-sm font-semibold">
              {group.code} — {localizedName(group, lang)}
            </legend>
            <div className="grid gap-2.5">
              {group.criteria.map((criterion) => {
                const labelId = `rating-label-${criterion.code}`
                return (
                  <div
                    key={criterion.code}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                  >
                    <span id={labelId} className="flex-1 text-sm min-w-56">
                      {criterion.code}. {lang === 'en' ? criterion.text_en : criterion.text_uk}
                    </span>
                    <RadioGroup
                      className="flex gap-1"
                      aria-labelledby={labelId}
                      value={String(ratings[criterion.code] ?? 3)}
                      onValueChange={(value) =>
                        setRatings((prev) => ({
                          ...prev,
                          [criterion.code]: Number(value),
                        }))
                      }
                    >
                      {RATING_VALUES.map((value) => {
                        const itemId = `rating-${criterion.code}-${value}`
                        return (
                          <span key={value} className="flex items-center gap-1">
                            <RadioGroupItem
                              id={itemId}
                              value={String(value)}
                              aria-label={t(SCALE_LABEL_KEYS[value])}
                            />
                            <Label htmlFor={itemId} className="font-normal">
                              {value}
                            </Label>
                          </span>
                        )
                      })}
                    </RadioGroup>
                  </div>
                )
              })}
            </div>
          </fieldset>
        ))}
        {formError !== null && (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        )}
        {mutation.isError && <ErrorNote error={mutation.error} />}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
