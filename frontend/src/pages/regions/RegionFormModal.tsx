import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { regionsApi } from '../../api/regions'
import { DELTA_LEVELS, type DeltaLevel, type Region, type RegionCreate } from '../../api/types'
import { ErrorNote } from '../../components/Feedback'
import { Modal } from '../../components/Modal'

interface RegionFormModalProps {
  region?: Region
  onClose: () => void
}

/** Radix SelectItem values must not be ''; sentinel for the "not set" option. */
const DELTA_NONE = 'none'

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
      toast.success(region ? t('toast.regionSaved') : t('toast.regionCreated'))
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
      <form onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="region-name-uk">{t('regions.nameUk')}</Label>
          <Input
            id="region-name-uk"
            type="text"
            value={nameUk}
            onChange={(e) => setNameUk(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="region-name-en">{t('regions.nameEn')}</Label>
          <Input
            id="region-name-en"
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="region-xi">{t('values.xi')}</Label>
          <Input
            id="region-xi"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={xi}
            onChange={(e) => setXi(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="region-delta">{t('values.deltaLevel')}</Label>
          <Select
            value={delta === '' ? DELTA_NONE : delta}
            onValueChange={(value) => setDelta(value === DELTA_NONE ? '' : (value as DeltaLevel))}
          >
            <SelectTrigger id="region-delta" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DELTA_NONE}>{t('common.notSet')}</SelectItem>
              {DELTA_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {t(`deltaLevels.${level}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formError !== null && (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        )}
        {mutation.isError && <ErrorNote error={mutation.error} />}
        <div className="flex justify-end gap-2">
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
