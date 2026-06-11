import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { criteriaApi } from '../../api/criteria'
import { respondentsApi } from '../../api/respondents'
import type { Region, Respondent, RespondentFilters } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorNote, LoadingSkeleton } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { useLang, localizedName } from '../../lib/lang'
import { RespondentFormModal } from './RespondentFormModal'

const DEFAULT_PAGE_SIZE = 25
const FILTER_DEBOUNCE_MS = 300

export function RespondentsSection({ region }: { region: Region }) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [accommodation, setAccommodation] = useState('')
  const [debouncedFilters, setDebouncedFilters] = useState({
    year: '',
    month: '',
    accommodation: '',
  })
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Respondent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Respondent | null>(null)

  // Debounce filter typing so the list query is not refetched per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedFilters({ year, month, accommodation })
    }, FILTER_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [year, month, accommodation])

  // Year/month are stored as free text (e.g. «2021 рік», «Липень»); the
  // backend filters by exact string match, so the filters pass text verbatim.
  const filters: RespondentFilters = {
    offset,
    limit,
    ...(debouncedFilters.year.trim() !== '' ? { year: debouncedFilters.year.trim() } : {}),
    ...(debouncedFilters.month.trim() !== '' ? { month: debouncedFilters.month.trim() } : {}),
    ...(debouncedFilters.accommodation.trim() !== ''
      ? { accommodation: debouncedFilters.accommodation.trim() }
      : {}),
  }

  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })
  const listQuery = useQuery({
    queryKey: ['respondents', region.id, filters],
    queryFn: () => respondentsApi.list(region.id, filters),
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: respondentsApi.remove,
    onSuccess: () => {
      setDeleteTarget(null)
      toast.success(t('toast.respondentDeleted'))
      void queryClient.invalidateQueries({ queryKey: ['respondents'] })
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const criterionCodes =
    criteriaQuery.data?.groups.flatMap((group) => group.criteria.map((c) => c.code)) ?? []

  return (
    <section
      className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-5 shadow-sm"
      aria-labelledby="respondents-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="respondents-title" className="text-lg font-semibold">
          {t('regions.respondentsTable.title', { name: localizedName(region, lang) })}
        </h2>
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!criteriaQuery.isSuccess}
        >
          {t('regions.respondentsTable.add')}
        </Button>
      </div>

      {criteriaQuery.isError && <ErrorNote error={criteriaQuery.error} />}

      <div className="flex flex-wrap gap-4">
        <div className="grid flex-1 gap-1.5 min-w-40">
          <Label htmlFor="filter-year">{t('regions.respondentsTable.filterYear')}</Label>
          <Input
            id="filter-year"
            type="text"
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <div className="grid flex-1 gap-1.5 min-w-40">
          <Label htmlFor="filter-month">{t('regions.respondentsTable.filterMonth')}</Label>
          <Input
            id="filter-month"
            type="text"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <div className="grid flex-1 gap-1.5 min-w-40">
          <Label htmlFor="filter-accommodation">
            {t('regions.respondentsTable.filterAccommodation')}
          </Label>
          <Input
            id="filter-accommodation"
            type="text"
            value={accommodation}
            onChange={(e) => {
              setAccommodation(e.target.value)
              setOffset(0)
            }}
          />
        </div>
      </div>

      {listQuery.isPending && <LoadingSkeleton rows={6} />}
      {listQuery.isError && <ErrorNote error={listQuery.error} />}
      {deleteMutation.isError && <ErrorNote error={deleteMutation.error} />}
      {listQuery.isSuccess && listQuery.data.items.length === 0 && (
        <div aria-live="polite">
          <p className="text-muted-foreground text-sm">{t('regions.respondentsTable.empty')}</p>
        </div>
      )}
      {listQuery.isSuccess && listQuery.data.items.length > 0 && (
        <div
          className={
            listQuery.isPlaceholderData
              ? 'opacity-60 transition-opacity'
              : 'transition-opacity'
          }
        >
          <Table>
            <TableCaption className="sr-only">
              {t('regions.respondentsTable.title', { name: localizedName(region, lang) })}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('regions.respondentsTable.extId')}</TableHead>
                <TableHead scope="col">{t('regions.respondentsTable.year')}</TableHead>
                <TableHead scope="col">{t('regions.respondentsTable.month')}</TableHead>
                <TableHead scope="col">{t('regions.respondentsTable.accommodation')}</TableHead>
                <TableHead scope="col">{t('regions.respondentsTable.ratings')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.data.items.map((respondent) => (
                <TableRow
                  key={respondent.id}
                  className={
                    deleteMutation.isPending && deleteMutation.variables === respondent.id
                      ? 'opacity-50 pointer-events-none'
                      : undefined
                  }
                >
                  <TableCell>{respondent.ext_id ?? respondent.id}</TableCell>
                  <TableCell>{respondent.year ?? '—'}</TableCell>
                  <TableCell>{respondent.month ?? '—'}</TableCell>
                  <TableCell>{respondent.accommodation ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {criterionCodes
                      .map((code) => respondent.ratings[code] ?? '·')
                      .join(' ')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(respondent)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(respondent)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            offset={offset}
            limit={limit}
            total={listQuery.data.total}
            onOffsetChange={setOffset}
            onLimitChange={setLimit}
          />
        </div>
      )}

      {addOpen && criteriaQuery.data && (
        <RespondentFormModal
          regionId={region.id}
          criteria={criteriaQuery.data}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editing && criteriaQuery.data && (
        <RespondentFormModal
          regionId={region.id}
          criteria={criteriaQuery.data}
          respondent={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('confirm.deleteRespondentTitle')}
        description={
          deleteTarget !== null
            ? t('regions.respondentsTable.deleteConfirm', {
                id: deleteTarget.ext_id ?? deleteTarget.id,
              })
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
    </section>
  )
}
