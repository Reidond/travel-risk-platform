import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { criteriaApi } from '../../api/criteria'
import type { CriteriaConfig, CriteriaGroupInput } from '../../api/types'
import { ErrorNote, Loading } from '../../components/Feedback'

export function CriteriaSection() {
  const { t } = useTranslation()
  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })

  return (
    <section className="panel-card" aria-labelledby="criteria-title">
      <h2 id="criteria-title">{t('parameters.criteria.title')}</h2>
      <p className="alert alert-info">{t('parameters.criteria.warning')}</p>
      {criteriaQuery.isPending && <Loading />}
      {criteriaQuery.isError && <ErrorNote error={criteriaQuery.error} />}
      {criteriaQuery.isSuccess && (
        <CriteriaForm key={criteriaQuery.dataUpdatedAt} initial={criteriaQuery.data} />
      )}
    </section>
  )
}

function cloneGroups(config: CriteriaConfig): CriteriaGroupInput[] {
  return config.groups.map((group) => ({
    code: group.code,
    name_uk: group.name_uk,
    name_en: group.name_en,
    criteria: group.criteria.map((criterion) => ({ ...criterion })),
  }))
}

/** Every code in use (group + criterion); suggestions must avoid them all. */
function allCodes(groups: CriteriaGroupInput[]): Set<string> {
  return new Set(groups.flatMap((group) => [group.code, ...group.criteria.map((c) => c.code)]))
}

/** Next free code following the convention of `last`: "K15" → "K16", "G3" → "G4". */
function nextCode(last: string | undefined, taken: Set<string>, fallbackPrefix: string): string {
  const match = last?.match(/^([A-Za-z]+)(\d+)$/)
  const prefix = match?.[1] ?? fallbackPrefix
  let n = match?.[2] !== undefined ? Number(match[2]) + 1 : 1
  while (taken.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

/** Composition fingerprint: group codes + their criterion codes, in order. */
function structureOf(groups: { code: string; criteria: { code: string }[] }[]): string {
  return JSON.stringify(groups.map((group) => [group.code, group.criteria.map((c) => c.code)]))
}

function CriteriaForm({ initial }: { initial: CriteriaConfig }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [groups, setGroups] = useState<CriteriaGroupInput[]>(() => cloneGroups(initial))
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: criteriaApi.put,
    onSuccess: () => {
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: ['criteria'] })
    },
  })

  const structureChanged = structureOf(groups) !== structureOf(initial.groups)

  const updateGroup = (
    groupIndex: number,
    field: 'code' | 'name_uk' | 'name_en',
    value: string,
  ) => {
    setGroups((prev) =>
      prev.map((group, i) => (i === groupIndex ? { ...group, [field]: value } : group)),
    )
  }

  const updateCriterion = (
    groupIndex: number,
    criterionIndex: number,
    field: 'code' | 'text_uk' | 'text_en',
    value: string,
  ) => {
    setGroups((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              criteria: group.criteria.map((criterion, j) =>
                j === criterionIndex ? { ...criterion, [field]: value } : criterion,
              ),
            }
          : group,
      ),
    )
  }

  const addCriterion = (groupIndex: number) => {
    setGroups((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              criteria: [
                ...group.criteria,
                {
                  code: nextCode(group.criteria.at(-1)?.code, allCodes(prev), 'K'),
                  text_uk: '',
                  text_en: '',
                },
              ],
            }
          : group,
      ),
    )
  }

  const removeCriterion = (groupIndex: number, criterionIndex: number) => {
    setGroups((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? { ...group, criteria: group.criteria.filter((_, j) => j !== criterionIndex) }
          : group,
      ),
    )
  }

  const addGroup = () => {
    setGroups((prev) => {
      const taken = allCodes(prev)
      return [
        ...prev,
        {
          code: nextCode(prev.at(-1)?.code, taken, 'G'),
          name_uk: '',
          name_en: '',
          // The API requires at least one criterion per group.
          criteria: [
            {
              code: nextCode(prev.at(-1)?.criteria.at(-1)?.code, taken, 'K'),
              text_uk: '',
              text_en: '',
            },
          ],
        },
      ]
    })
  }

  const removeGroup = (groupIndex: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== groupIndex))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    const hasBlank = groups.some(
      (group) =>
        group.code.trim() === '' ||
        group.name_uk.trim() === '' ||
        group.name_en.trim() === '' ||
        group.criteria.some(
          (criterion) =>
            criterion.code.trim() === '' ||
            criterion.text_uk.trim() === '' ||
            criterion.text_en.trim() === '',
        ),
    )
    if (hasBlank) {
      setFormError(t('validation.required'))
      return
    }
    setFormError(null)
    mutation.mutate({ groups })
  }

  return (
    <form onSubmit={submit} noValidate>
      {groups.map((group, groupIndex) => (
        // Index keys: codes are editable, so they cannot key the rows.
        <fieldset key={groupIndex} className="criteria-group">
          <legend>{group.code || '…'}</legend>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor={`group-${groupIndex}-code`}>
                {t('parameters.criteria.groupCode')}
              </label>
              <input
                id={`group-${groupIndex}-code`}
                type="text"
                maxLength={16}
                value={group.code}
                onChange={(e) => updateGroup(groupIndex, 'code', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`group-${groupIndex}-uk`}>
                {t('parameters.criteria.groupNameUk')}
              </label>
              <input
                id={`group-${groupIndex}-uk`}
                type="text"
                value={group.name_uk}
                onChange={(e) => updateGroup(groupIndex, 'name_uk', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`group-${groupIndex}-en`}>
                {t('parameters.criteria.groupNameEn')}
              </label>
              <input
                id={`group-${groupIndex}-en`}
                type="text"
                value={group.name_en}
                onChange={(e) => updateGroup(groupIndex, 'name_en', e.target.value)}
              />
            </div>
          </div>
          {group.criteria.map((criterion, criterionIndex) => (
            <div key={criterionIndex} className="criterion-edit-row">
              <div className="form-field">
                <label htmlFor={`criterion-${groupIndex}-${criterionIndex}-code`}>
                  {t('parameters.criteria.code')}
                </label>
                <input
                  id={`criterion-${groupIndex}-${criterionIndex}-code`}
                  type="text"
                  maxLength={16}
                  value={criterion.code}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'code', e.target.value)
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor={`criterion-${groupIndex}-${criterionIndex}-uk`}>
                  {t('parameters.criteria.textUk')}
                </label>
                <input
                  id={`criterion-${groupIndex}-${criterionIndex}-uk`}
                  type="text"
                  value={criterion.text_uk}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'text_uk', e.target.value)
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor={`criterion-${groupIndex}-${criterionIndex}-en`}>
                  {t('parameters.criteria.textEn')}
                </label>
                <input
                  id={`criterion-${groupIndex}-${criterionIndex}-en`}
                  type="text"
                  value={criterion.text_en}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'text_en', e.target.value)
                  }
                />
              </div>
              <button
                type="button"
                className="btn btn-icon"
                disabled={group.criteria.length <= 1}
                aria-label={t('parameters.criteria.removeCriterion', { code: criterion.code })}
                onClick={() => removeCriterion(groupIndex, criterionIndex)}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="form-actions form-actions-start">
            <button type="button" className="btn btn-small" onClick={() => addCriterion(groupIndex)}>
              {t('parameters.criteria.addCriterion')}
            </button>
            <button
              type="button"
              className="btn btn-small btn-danger"
              disabled={groups.length <= 1}
              onClick={() => removeGroup(groupIndex)}
            >
              {t('parameters.criteria.removeGroup')}
            </button>
          </div>
        </fieldset>
      ))}

      <div className="form-actions form-actions-start">
        <button type="button" className="btn" onClick={addGroup}>
          {t('parameters.criteria.addGroup')}
        </button>
      </div>

      {structureChanged && (
        <p className="alert alert-info" role="alert">
          {t('parameters.criteria.structuralChange')}
        </p>
      )}
      {formError !== null && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      {mutation.isError && <ErrorNote error={mutation.error} />}
      {saved && (
        <p className="alert alert-success" role="status">
          {t('parameters.criteria.saved')}
        </p>
      )}

      <div className="form-actions form-actions-start">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
