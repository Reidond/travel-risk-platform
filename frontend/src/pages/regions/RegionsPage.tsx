import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { REGIONS_MAX_LIMIT, regionsApi } from '../../api/regions'
import type { Region } from '../../api/types'
import { RiskClassBadge } from '../../components/Badges'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorNote, LoadingSkeleton } from '../../components/Feedback'
import { DELTA_SHORT, fmt, formatDateTime } from '../../lib/format'
import { useLang, localizedName } from '../../lib/lang'
import { ImportPanel } from './ImportPanel'
import { RegionFormModal } from './RegionFormModal'
import { RespondentsSection } from './RespondentsSection'

const CARD_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4'

export function RegionsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Region | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Region | null>(null)

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    // Request the backend maximum instead of the default page of 50.
    queryFn: () => regionsApi.list({ limit: REGIONS_MAX_LIMIT }),
  })

  const deleteMutation = useMutation({
    mutationFn: regionsApi.remove,
    onSuccess: (_data, regionId) => {
      setSelectedId((current) => (current === regionId ? null : current))
      setDeleteTarget(null)
      toast.success(t('toast.regionDeleted'))
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const regions = regionsQuery.data?.items ?? []
  const selected = regions.find((region) => region.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('regions.title')}</h1>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t('regions.createRegion')}
        </Button>
      </div>

      <ImportPanel
        regions={regions}
        defaultOpen={regionsQuery.isSuccess && regions.length === 0}
      />

      {regionsQuery.isPending && (
        <LoadingSkeleton rows={3} className={`${CARD_GRID} *:h-36`} />
      )}
      {regionsQuery.isError && <ErrorNote error={regionsQuery.error} />}
      {deleteMutation.isError && <ErrorNote error={deleteMutation.error} />}
      {regionsQuery.isSuccess && regions.length === 0 && (
        <EmptyState title={t('emptyStates.regionsTitle')} hint={t('emptyStates.regionsHint')}>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            {t('regions.createRegion')}
          </Button>
        </EmptyState>
      )}

      {regions.length > 0 && (
        <div className={CARD_GRID}>
          {regions.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              selected={region.id === selectedId}
              deleting={deleteMutation.isPending && deleteMutation.variables === region.id}
              onSelect={() => setSelectedId(region.id)}
              onEdit={() => setEditing(region)}
              onDelete={() => setDeleteTarget(region)}
            />
          ))}
        </div>
      )}

      {selected && <RespondentsSection key={selected.id} region={selected} />}

      {createOpen && <RegionFormModal onClose={() => setCreateOpen(false)} />}
      {editing && <RegionFormModal region={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('confirm.deleteRegionTitle')}
        description={
          deleteTarget !== null
            ? t('regions.deleteConfirm', { name: localizedName(deleteTarget, lang) })
            : ''
        }
        confirmLabel={t('common.delete')}
        pendingLabel={t('common.deleting')}
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </div>
  )
}

interface RegionCardProps {
  region: Region
  selected: boolean
  deleting: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function RegionCard({ region, selected, deleting, onSelect, onEdit, onDelete }: RegionCardProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = localizedName(region, lang)
  return (
    <article
      className={[
        'bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
        selected ? 'ring-2 ring-primary' : '',
        deleting ? 'opacity-50 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3 className="text-base font-semibold">{name}</h3>
      <dl className="flex flex-wrap gap-5 text-sm">
        <div>
          <dt className="font-semibold">Ξ</dt>
          <dd>{region.xi != null ? fmt(region.xi, 2) : t('common.notSet')}</dd>
        </div>
        <div>
          <dt className="font-semibold">Δ</dt>
          <dd
            title={
              region.delta_level != null ? t(`deltaLevels.${region.delta_level}`) : undefined
            }
          >
            {region.delta_level != null ? DELTA_SHORT[region.delta_level] : t('common.notSet')}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{t('regions.respondents')}</dt>
          <dd>{region.respondent_count}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {region.latest_result ? (
          <>
            <RiskClassBadge riskClass={region.latest_result.risk_class} compact />
            <span>μ_R = {fmt(region.latest_result.mu, 4)}</span>
            <span className="text-muted-foreground">
              {formatDateTime(region.latest_result.evaluated_at, lang)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{t('regions.noResult')}</span>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={selected}
          aria-label={t('regions.select', { name })}
          onClick={onSelect}
        >
          {t('regions.respondents')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t('common.edit')}
        </Button>
        <Button type="button" variant="outline-destructive" size="sm" onClick={onDelete}>
          {t('common.delete')}
        </Button>
      </div>
    </article>
  )
}
