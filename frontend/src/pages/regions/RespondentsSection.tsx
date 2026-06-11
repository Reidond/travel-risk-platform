import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { criteriaApi } from '../../api/criteria'
import { respondentsApi } from '../../api/respondents'
import type { Region, Respondent, RespondentFilters } from '../../api/types'
import { ErrorNote, Loading } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { useLang, localizedName } from '../../lib/lang'
import { RespondentFormModal } from './RespondentFormModal'

const PAGE_SIZE = 20

export function RespondentsSection({ region }: { region: Region }) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [accommodation, setAccommodation] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Respondent | null>(null)

  // Year/month are stored as free text (e.g. «2021 рік», «Липень»); the
  // backend filters by exact string match, so the filters pass text verbatim.
  const filters: RespondentFilters = {
    offset,
    limit: PAGE_SIZE,
    ...(year.trim() !== '' ? { year: year.trim() } : {}),
    ...(month.trim() !== '' ? { month: month.trim() } : {}),
    ...(accommodation.trim() !== '' ? { accommodation: accommodation.trim() } : {}),
  }

  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })
  const listQuery = useQuery({
    queryKey: ['respondents', region.id, filters],
    queryFn: () => respondentsApi.list(region.id, filters),
  })

  const deleteMutation = useMutation({
    mutationFn: respondentsApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['respondents'] })
      void queryClient.invalidateQueries({ queryKey: ['regions'] })
    },
  })

  const criterionCodes =
    criteriaQuery.data?.groups.flatMap((group) => group.criteria.map((c) => c.code)) ?? []

  return (
    <section className="panel-card" aria-labelledby="respondents-title">
      <div className="section-head">
        <h2 id="respondents-title">
          {t('regions.respondentsTable.title', { name: localizedName(region, lang) })}
        </h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAddOpen(true)}
          disabled={!criteriaQuery.isSuccess}
        >
          {t('regions.respondentsTable.add')}
        </button>
      </div>

      <div className="filters">
        <div className="form-field">
          <label htmlFor="filter-year">{t('regions.respondentsTable.filterYear')}</label>
          <input
            id="filter-year"
            type="text"
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <div className="form-field">
          <label htmlFor="filter-month">{t('regions.respondentsTable.filterMonth')}</label>
          <input
            id="filter-month"
            type="text"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setOffset(0)
            }}
          />
        </div>
        <div className="form-field">
          <label htmlFor="filter-accommodation">
            {t('regions.respondentsTable.filterAccommodation')}
          </label>
          <input
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

      {listQuery.isPending && <Loading />}
      {listQuery.isError && <ErrorNote error={listQuery.error} />}
      {deleteMutation.isError && <ErrorNote error={deleteMutation.error} />}
      {listQuery.isSuccess && listQuery.data.items.length === 0 && (
        <p className="muted">{t('regions.respondentsTable.empty')}</p>
      )}
      {listQuery.isSuccess && listQuery.data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('regions.respondentsTable.extId')}</th>
                  <th scope="col">{t('regions.respondentsTable.year')}</th>
                  <th scope="col">{t('regions.respondentsTable.month')}</th>
                  <th scope="col">{t('regions.respondentsTable.accommodation')}</th>
                  <th scope="col">{t('regions.respondentsTable.ratings')}</th>
                  <th scope="col">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.items.map((respondent) => (
                  <tr key={respondent.id}>
                    <td>{respondent.ext_id ?? respondent.id}</td>
                    <td>{respondent.year ?? '—'}</td>
                    <td>{respondent.month ?? '—'}</td>
                    <td>{respondent.accommodation ?? '—'}</td>
                    <td className="ratings-cell">
                      {criterionCodes
                        .map((code) => respondent.ratings[code] ?? '·')
                        .join(' ')}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setEditing(respondent)}
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                t('regions.respondentsTable.deleteConfirm', {
                                  id: respondent.ext_id ?? respondent.id,
                                }),
                              )
                            ) {
                              deleteMutation.mutate(respondent.id)
                            }
                          }}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={listQuery.data.total}
            onOffsetChange={setOffset}
          />
        </>
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
    </section>
  )
}
