import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlertIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { criteriaApi } from '../../api/criteria'
import type { CriteriaConfig, CriteriaGroupInput } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorNote, Loading } from '../../components/Feedback'
import { localizedName, useLang } from '../../lib/lang'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CriteriaSection() {
  const { t } = useTranslation()
  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })

  return (
    <section
      className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
      aria-labelledby="criteria-title"
    >
      <h2 id="criteria-title" className="text-lg font-semibold mb-3">
        {t('parameters.criteria.title')}
      </h2>
      <Alert variant="warning" role="status" className="mb-4">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertDescription>{t('parameters.criteria.warning')}</AlertDescription>
      </Alert>
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
  const lang = useLang()
  const queryClient = useQueryClient()
  const [groups, setGroups] = useState<CriteriaGroupInput[]>(() => cloneGroups(initial))
  const [formError, setFormError] = useState<string | null>(null)
  const [removeGroupIndex, setRemoveGroupIndex] = useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: criteriaApi.put,
    onSuccess: () => {
      toast.success(t('parameters.criteria.saved'))
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

  const pendingRemoveGroup = removeGroupIndex !== null ? groups[removeGroupIndex] : undefined
  const pendingRemoveName =
    pendingRemoveGroup !== undefined
      ? localizedName(pendingRemoveGroup, lang).trim() || pendingRemoveGroup.code
      : ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
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
        <fieldset key={groupIndex} className="rounded-lg border px-4 py-3 mb-4">
          <legend className="px-1.5 text-sm font-semibold">{group.code || '…'}</legend>
          <div className="flex flex-wrap gap-4">
            <div className="grid gap-1.5 w-28">
              <Label htmlFor={`group-${groupIndex}-code`}>
                {t('parameters.criteria.groupCode')}
              </Label>
              <Input
                id={`group-${groupIndex}-code`}
                type="text"
                maxLength={16}
                value={group.code}
                onChange={(e) => updateGroup(groupIndex, 'code', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 flex-1 min-w-40">
              <Label htmlFor={`group-${groupIndex}-uk`}>
                {t('parameters.criteria.groupNameUk')}
              </Label>
              <Input
                id={`group-${groupIndex}-uk`}
                type="text"
                value={group.name_uk}
                onChange={(e) => updateGroup(groupIndex, 'name_uk', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 flex-1 min-w-40">
              <Label htmlFor={`group-${groupIndex}-en`}>
                {t('parameters.criteria.groupNameEn')}
              </Label>
              <Input
                id={`group-${groupIndex}-en`}
                type="text"
                value={group.name_en}
                onChange={(e) => updateGroup(groupIndex, 'name_en', e.target.value)}
              />
            </div>
          </div>
          {group.criteria.map((criterion, criterionIndex) => (
            <div key={criterionIndex} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5 w-28">
                <Label htmlFor={`criterion-${groupIndex}-${criterionIndex}-code`}>
                  {t('parameters.criteria.code')}
                </Label>
                <Input
                  id={`criterion-${groupIndex}-${criterionIndex}-code`}
                  type="text"
                  maxLength={16}
                  value={criterion.code}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'code', e.target.value)
                  }
                />
              </div>
              <div className="grid gap-1.5 flex-1 min-w-40">
                <Label htmlFor={`criterion-${groupIndex}-${criterionIndex}-uk`}>
                  {t('parameters.criteria.textUk')}
                </Label>
                <Input
                  id={`criterion-${groupIndex}-${criterionIndex}-uk`}
                  type="text"
                  value={criterion.text_uk}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'text_uk', e.target.value)
                  }
                />
              </div>
              <div className="grid gap-1.5 flex-1 min-w-40">
                <Label htmlFor={`criterion-${groupIndex}-${criterionIndex}-en`}>
                  {t('parameters.criteria.textEn')}
                </Label>
                <Input
                  id={`criterion-${groupIndex}-${criterionIndex}-en`}
                  type="text"
                  value={criterion.text_en}
                  onChange={(e) =>
                    updateCriterion(groupIndex, criterionIndex, 'text_en', e.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={group.criteria.length <= 1}
                aria-label={t('parameters.criteria.removeCriterion', { code: criterion.code })}
                onClick={() => removeCriterion(groupIndex, criterionIndex)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          ))}
          <div className="mt-4 flex justify-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addCriterion(groupIndex)}
            >
              {t('parameters.criteria.addCriterion')}
            </Button>
            <Button
              type="button"
              variant="outline-destructive"
              size="sm"
              disabled={groups.length <= 1}
              onClick={() => setRemoveGroupIndex(groupIndex)}
            >
              {t('parameters.criteria.removeGroup')}
            </Button>
          </div>
        </fieldset>
      ))}

      <div className="mt-4 flex justify-start gap-2">
        <Button type="button" variant="outline" onClick={addGroup}>
          {t('parameters.criteria.addGroup')}
        </Button>
      </div>

      {structureChanged && (
        <Alert variant="warning" role="alert" className="mt-4">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertDescription>{t('parameters.criteria.structuralChange')}</AlertDescription>
        </Alert>
      )}
      {formError !== null && (
        <p className="text-destructive text-sm mt-3" role="alert">
          {formError}
        </p>
      )}
      {mutation.isError && (
        <div className="mt-3">
          <ErrorNote error={mutation.error} />
        </div>
      )}

      <div className="mt-4 flex justify-start gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      <ConfirmDialog
        open={removeGroupIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveGroupIndex(null)
        }}
        title={t('confirm.removeGroupTitle')}
        description={t('confirm.removeGroupBody', { name: pendingRemoveName })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => {
          if (removeGroupIndex !== null) removeGroup(removeGroupIndex)
          setRemoveGroupIndex(null)
        }}
      />
    </form>
  )
}
