import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { REGIONS_MAX_LIMIT, regionsApi } from '../../api/regions'
import type { Region } from '../../api/types'
import { RiskClassBadge } from '../../components/Badges'
import { ErrorNote, Loading } from '../../components/Feedback'
import { DELTA_SHORT, fmt, formatDateTime } from '../../lib/format'
import { useLang, localizedName } from '../../lib/lang'
import { ImportPanel } from './ImportPanel'
import { RegionFormModal } from './RegionFormModal'
import { RespondentsSection } from './RespondentsSection'

export function RegionsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Region | null>(null)

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    // Request the backend maximum instead of the default page of 50.
    queryFn: () => regionsApi.list({ limit: REGIONS_MAX_LIMIT }),
  })

  const deleteMutation = useMutation({
    mutationFn: regionsApi.remove,
    onSuccess: (_data, regionId) => {
      setSelectedId((current) => (current === regionId ? null : current))
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const regions = regionsQuery.data?.items ?? []
  const selected = regions.find((region) => region.id === selectedId) ?? null

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('regions.title')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          {t('regions.createRegion')}
        </button>
      </div>

      <ImportPanel regions={regions} />

      {regionsQuery.isPending && <Loading />}
      {regionsQuery.isError && <ErrorNote error={regionsQuery.error} />}
      {deleteMutation.isError && <ErrorNote error={deleteMutation.error} />}
      {regionsQuery.isSuccess && regions.length === 0 && (
        <p className="muted">{t('regions.noRegions')}</p>
      )}

      <div className="card-grid">
        {regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            selected={region.id === selectedId}
            onSelect={() => setSelectedId(region.id)}
            onEdit={() => setEditing(region)}
            onDelete={() => {
              if (
                window.confirm(
                  t('regions.deleteConfirm', { name: localizedName(region, lang) }),
                )
              ) {
                deleteMutation.mutate(region.id)
              }
            }}
          />
        ))}
      </div>

      {selected && <RespondentsSection key={selected.id} region={selected} />}

      {createOpen && <RegionFormModal onClose={() => setCreateOpen(false)} />}
      {editing && <RegionFormModal region={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

interface RegionCardProps {
  region: Region
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function RegionCard({ region, selected, onSelect, onEdit, onDelete }: RegionCardProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const name = localizedName(region, lang)
  return (
    <article className={selected ? 'region-card region-card-selected' : 'region-card'}>
      <h3 className="region-card-name">{name}</h3>
      <dl className="region-card-facts">
        <div>
          <dt>Ξ</dt>
          <dd>{region.xi != null ? fmt(region.xi, 2) : t('common.notSet')}</dd>
        </div>
        <div>
          <dt>Δ</dt>
          <dd
            title={
              region.delta_level != null ? t(`deltaLevels.${region.delta_level}`) : undefined
            }
          >
            {region.delta_level != null ? DELTA_SHORT[region.delta_level] : t('common.notSet')}
          </dd>
        </div>
        <div>
          <dt>{t('regions.respondents')}</dt>
          <dd>{region.respondent_count}</dd>
        </div>
      </dl>
      <div className="region-card-result">
        {region.latest_result ? (
          <>
            <RiskClassBadge riskClass={region.latest_result.risk_class} compact />
            <span>μ_R = {fmt(region.latest_result.mu, 4)}</span>
            <span className="muted">
              {formatDateTime(region.latest_result.evaluated_at, lang)}
            </span>
          </>
        ) : (
          <span className="muted">{t('regions.noResult')}</span>
        )}
      </div>
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-small"
          aria-pressed={selected}
          aria-label={t('regions.select', { name })}
          onClick={onSelect}
        >
          {t('regions.respondents')}
        </button>
        <button type="button" className="btn btn-small" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
          {t('common.delete')}
        </button>
      </div>
    </article>
  )
}
