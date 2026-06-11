import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircleIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { errorDetailText } from '../../api/client'
import { evaluationsApi } from '../../api/evaluations'
import { REGIONS_MAX_LIMIT, regionsApi } from '../../api/regions'
import {
  DELTA_LEVELS,
  RISK_TERMS,
  type DeltaLevel,
  type EvaluationRun,
  type Region,
  type RegionResult,
} from '../../api/types'
import { RiskClassBadge, TermBadge } from '../../components/Badges'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ErrorNote, LoadingSkeleton } from '../../components/Feedback'
import { DELTA_SHORT, fmt } from '../../lib/format'
import { useLang, localizedName } from '../../lib/lang'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function PanelPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set())
  const [run, setRun] = useState<EvaluationRun | null>(null)
  const [runAllOpen, setRunAllOpen] = useState(false)

  const regionsQuery = useQuery({
    queryKey: ['regions'],
    // Request the backend maximum instead of the default page of 50.
    queryFn: () => regionsApi.list({ limit: REGIONS_MAX_LIMIT }),
  })
  const regions = regionsQuery.data?.items ?? []

  const evalMutation = useMutation({
    mutationFn: (regionIds: number[] | null) =>
      evaluationsApi.create({ region_ids: regionIds }),
    onSuccess: (data) => {
      setRun(data)
      toast.success(t('toast.evaluated', { id: data.id }))
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] })
    },
    onSettled: () => {
      setRunAllOpen(false)
    },
  })

  const toggleRegion = (regionId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(regionId)) {
        next.delete(regionId)
      } else {
        next.add(regionId)
      }
      return next
    })
  }

  const allSelected =
    regions.length > 0 && regions.every((region) => selectedIds.has(region.id))
  const headerChecked: boolean | 'indeterminate' = allSelected
    ? true
    : selectedIds.size > 0
      ? 'indeterminate'
      : false

  const toggleAll = () => {
    setSelectedIds(
      allSelected ? new Set<number>() : new Set(regions.map((region) => region.id)),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('panel.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('panel.intro')}</p>
      </div>

      {regionsQuery.isPending && <LoadingSkeleton rows={6} />}
      {regionsQuery.isError && <ErrorNote error={regionsQuery.error} />}
      {regionsQuery.isSuccess && regions.length === 0 && (
        <EmptyState title={t('emptyStates.panelTitle')} hint={t('emptyStates.panelHint')}>
          <Button asChild>
            <Link to="/regions">{t('emptyStates.panelCta')}</Link>
          </Button>
        </EmptyState>
      )}

      {regions.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{t('panel.title')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    <Checkbox
                      checked={headerChecked}
                      onCheckedChange={toggleAll}
                      aria-label={t('panel.selectAll')}
                    />
                  </TableHead>
                  <TableHead scope="col">{t('dashboard.region')}</TableHead>
                  <TableHead scope="col">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <abbr title={t('values.xi')}>Ξ</abbr>
                      </TooltipTrigger>
                      <TooltipContent>{t('values.xi')}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead scope="col">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <abbr title={t('values.deltaLevel')}>Δ</abbr>
                      </TooltipTrigger>
                      <TooltipContent>{t('values.deltaLevel')}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <abbr title={t('values.n')}>n</abbr>
                      </TooltipTrigger>
                      <TooltipContent>{t('values.n')}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((region) => (
                  <PanelRow
                    key={region.id}
                    region={region}
                    checked={selectedIds.has(region.id)}
                    onToggle={() => toggleRegion(region.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-card/95 sticky bottom-0 -mx-1 mt-2 flex flex-wrap items-center gap-3 rounded-lg border p-3 shadow-sm backdrop-blur">
            <span className="text-muted-foreground text-sm" aria-live="polite">
              {t('panel.selectedCount', { n: selectedIds.size })}
            </span>
            <Button
              disabled={evalMutation.isPending || selectedIds.size === 0}
              onClick={() => evalMutation.mutate([...selectedIds])}
            >
              {evalMutation.isPending
                ? t('panel.running')
                : t('panel.runSelected', { n: selectedIds.size })}
            </Button>
            <Button
              variant="outline"
              disabled={evalMutation.isPending}
              onClick={() => setRunAllOpen(true)}
            >
              {t('panel.runAll')}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={runAllOpen}
        onOpenChange={setRunAllOpen}
        title={t('confirm.runAllTitle')}
        description={t('confirm.runAllBody')}
        confirmLabel={t('panel.runAll')}
        pendingLabel={t('panel.running')}
        onConfirm={() => evalMutation.mutate(null)}
        isPending={evalMutation.isPending}
      />

      {evalMutation.isError && (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>{t('panel.evalConflict')}</AlertTitle>
          <AlertDescription>
            {errorDetailText(evalMutation.error) ?? t('errors.generic')}
          </AlertDescription>
        </Alert>
      )}

      {run && (
        <section
          aria-labelledby="run-results-title"
          className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
            <h2 id="run-results-title" className="text-lg font-semibold">
              {t('panel.results', { id: run.id })}
            </h2>
            <Button asChild variant="outline">
              <Link to="/dashboard">{t('panel.toDashboard')}</Link>
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {run.results.map((result) => (
              <ResultCard key={result.region.id} result={result} />
            ))}
          </div>
          <Alert variant="info" role="status" className="mt-4">
            <AlertDescription>
              <p>
                {t('panel.adjustCallout')}{' '}
                <Link to="/parameters?tab=rules" className="text-primary underline">
                  {t('panel.adjustLink')}
                </Link>
              </p>
            </AlertDescription>
          </Alert>
        </section>
      )}
    </div>
  )
}

function PanelRow({
  region,
  checked,
  onToggle,
}: {
  region: Region
  checked: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const name = localizedName(region, lang)
  const [xi, setXi] = useState(region.xi != null ? String(region.xi) : '')
  const [delta, setDelta] = useState<DeltaLevel | ''>(region.delta_level ?? '')
  const [rowError, setRowError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (body: { xi: number | null; delta_level: DeltaLevel | null }) =>
      regionsApi.update(region.id, body),
    onSuccess: () => {
      toast.success(t('toast.panelRowSaved'))
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const save = (event: FormEvent) => {
    event.preventDefault()
    let xiValue: number | null = null
    if (xi.trim() !== '') {
      const parsed = Number(xi)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        setRowError(t('validation.xiRange'))
        return
      }
      xiValue = parsed
    }
    setRowError(null)
    saveMutation.mutate({ xi: xiValue, delta_level: delta === '' ? null : delta })
  }

  const ready =
    region.xi != null && region.delta_level != null && region.respondent_count > 0

  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={t('panel.selectRegion', { name })}
        />
      </TableCell>
      <TableHead scope="row">{name}</TableHead>
      <TableCell>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={xi}
          onChange={(e) => setXi(e.target.value)}
          aria-label={t('panel.xiInput', { name })}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        <select
          value={delta}
          onChange={(e) => setDelta(e.target.value as DeltaLevel | '')}
          aria-label={t('panel.deltaSelect', { name })}
          className="border-input bg-background h-9 rounded-md border px-2.5 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:border-ring outline-none"
        >
          <option value="">{t('common.notSet')}</option>
          {DELTA_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`deltaLevels.${level}`)}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="text-right tabular-nums">{region.respondent_count}</TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={save}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
          {ready ? (
            <Badge variant="success">{t('panel.ready')}</Badge>
          ) : (
            <>
              {region.xi == null && (
                <Badge variant="warning">{t('panel.missingXi')}</Badge>
              )}
              {region.delta_level == null && (
                <Badge variant="warning">{t('panel.missingDelta')}</Badge>
              )}
              {region.respondent_count === 0 && (
                <Badge variant="warning">{t('panel.noRespondents')}</Badge>
              )}
            </>
          )}
        </div>
        {rowError !== null && (
          <p className="text-destructive mt-1.5 text-sm" role="alert">
            {rowError}
          </p>
        )}
        {saveMutation.isError && (
          <div className="mt-2">
            <ErrorNote error={saveMutation.error} />
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

function ResultCard({ result }: { result: RegionResult }) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <article className="rounded-lg border p-4">
      <h3 className="mb-2 text-base font-semibold">
        {localizedName(result.region, lang)}
      </h3>
      <div className="flex flex-wrap items-stretch gap-2.5 max-sm:flex-col">
        <section className="step-card flex-1 basis-56 space-y-1.5 rounded-lg border bg-muted/50 px-4 py-3">
          <h4 className="text-sm font-semibold">{t('panel.step1')}</h4>
          <p className="text-muted-foreground text-sm">
            {t('values.n')}: {result.n}
          </p>
          <ul className="list-none space-y-1.5">
            {RISK_TERMS.map((term) => (
              <li key={term} className="flex items-center gap-2">
                <TermBadge term={term} compact />
                <span>{result.r_star_distribution[term] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <span
          className="text-muted-foreground self-center text-2xl max-sm:ml-4 max-sm:rotate-90 max-sm:self-start"
          aria-hidden="true"
        >
          →
        </span>
        <section className="step-card flex-1 basis-56 space-y-1.5 rounded-lg border bg-muted/50 px-4 py-3">
          <h4 className="text-sm font-semibold">{t('panel.step2')}</h4>
          <p className="text-sm">δ = {fmt(result.delta, 2)}</p>
          <p className="text-sm">φ = {fmt(result.phi, 4)}</p>
          <p className="text-sm">
            m_S = {fmt(result.m_s, 4)} (Ξ = {fmt(result.xi, 2)})
          </p>
        </section>
        <span
          className="text-muted-foreground self-center text-2xl max-sm:ml-4 max-sm:rotate-90 max-sm:self-start"
          aria-hidden="true"
        >
          →
        </span>
        <section className="step-card flex-1 basis-56 space-y-1.5 rounded-lg border bg-muted/50 px-4 py-3">
          <h4 className="text-sm font-semibold">{t('panel.step3')}</h4>
          <p className="text-sm">
            ω = {fmt(result.omega, 2)} ({DELTA_SHORT[result.delta_level]})
          </p>
          <p className="text-sm">μ_R = {fmt(result.mu, 4)}</p>
          <p className="text-sm">
            <RiskClassBadge riskClass={result.risk_class} />
          </p>
        </section>
      </div>
    </article>
  )
}
