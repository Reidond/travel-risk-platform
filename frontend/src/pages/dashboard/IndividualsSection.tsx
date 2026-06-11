import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { evaluationsApi } from '../../api/evaluations'
import type { EvaluationRun } from '../../api/types'
import { TermBadge } from '../../components/Badges'
import { ErrorNote, LoadingSkeleton } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { useLang, localizedName } from '../../lib/lang'

const DEFAULT_PAGE_SIZE = 25

/** Per-region drill-down: individual intermediate results, paged. */
export function IndividualsSection({ run }: { run: EvaluationRun }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [regionId, setRegionId] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const effectiveRegionId = regionId ?? run.results[0]?.region.id ?? null

  const individualsQuery = useQuery({
    queryKey: ['individuals', run.id, effectiveRegionId, offset, limit],
    queryFn:
      effectiveRegionId === null
        ? skipToken
        : () =>
            evaluationsApi.individuals(run.id, effectiveRegionId, {
              offset,
              limit,
            }),
    placeholderData: keepPreviousData,
  })

  // Stable θ/T column set: sorted union of group codes over the fetched page.
  // Every individual in a run shares the same criteria snapshot, so the
  // sorted union is identical on every page (unlike the keys of whichever
  // row happens to be first), keeping columns stable while paging.
  const groupCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const item of individualsQuery.data?.items ?? []) {
      for (const code of Object.keys(item.theta)) codes.add(code)
    }
    // Numeric-aware sort keeps natural criteria order (G1C2 before G1C10).
    return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [individualsQuery.data])

  if (run.results.length === 0 || effectiveRegionId === null) return null

  return (
    <section
      className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
      aria-labelledby="drill-title"
    >
      <h2 id="drill-title" className="text-lg font-semibold mb-3">
        {t('dashboard.drillTitle')}
      </h2>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label htmlFor="drill-region">{t('dashboard.drillRegion')}</Label>
        <Select
          value={String(effectiveRegionId)}
          onValueChange={(value) => {
            setRegionId(Number(value))
            setOffset(0)
          }}
        >
          <SelectTrigger id="drill-region" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {run.results.map((result) => (
              <SelectItem key={result.region.id} value={String(result.region.id)}>
                {localizedName(result.region, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <h3 className="text-sm font-semibold mb-2">{t('dashboard.individualsTitle')}</h3>
      {individualsQuery.isPending && <LoadingSkeleton rows={6} />}
      {individualsQuery.isError && <ErrorNote error={individualsQuery.error} />}
      {individualsQuery.isSuccess && individualsQuery.data.items.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
      )}
      {individualsQuery.isSuccess && individualsQuery.data.items.length > 0 && (
        <>
          <Table>
            <TableCaption className="sr-only">{t('dashboard.individualsTitle')}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="text-right">
                  {t('dashboard.respondentId')}
                </TableHead>
                <TableHead scope="col">{t('regions.respondentsTable.extId')}</TableHead>
                {groupCodes.map((code) => (
                  <TableHead scope="col" className="text-right" key={`theta-${code}`}>
                    θ({code})
                  </TableHead>
                ))}
                {groupCodes.map((code) => (
                  <TableHead scope="col" key={`term-${code}`}>
                    T({code})
                  </TableHead>
                ))}
                <TableHead scope="col">{t('values.rStar')}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t('values.chi')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {individualsQuery.data.items.map((item) => (
                <TableRow key={item.respondent_id}>
                  <TableCell className="text-right tabular-nums">{item.respondent_id}</TableCell>
                  <TableCell>{item.ext_id ?? '—'}</TableCell>
                  {groupCodes.map((code) => (
                    <TableCell
                      className="text-right font-mono text-xs tabular-nums whitespace-nowrap"
                      key={`theta-${code}`}
                    >
                      {item.theta[code] ?? '—'}
                    </TableCell>
                  ))}
                  {groupCodes.map((code) => (
                    <TableCell
                      className="font-mono text-xs whitespace-nowrap"
                      key={`term-${code}`}
                    >
                      {item.terms[code] != null ? `T${item.terms[code]}` : '—'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <TermBadge term={item.r_star} compact />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.chi}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            offset={offset}
            limit={limit}
            total={individualsQuery.data.total}
            onOffsetChange={setOffset}
            onLimitChange={setLimit}
          />
        </>
      )}
    </section>
  )
}
