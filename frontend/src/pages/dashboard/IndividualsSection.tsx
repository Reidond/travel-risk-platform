import { skipToken, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { evaluationsApi } from '../../api/evaluations'
import type { EvaluationRun } from '../../api/types'
import { TermBadge } from '../../components/Badges'
import { ErrorNote, Loading } from '../../components/Feedback'
import { Pagination } from '../../components/Pagination'
import { useLang, localizedName } from '../../lib/lang'

const PAGE_SIZE = 25

/** Per-region drill-down: individual intermediate results, paged. */
export function IndividualsSection({ run }: { run: EvaluationRun }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [regionId, setRegionId] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  const effectiveRegionId = regionId ?? run.results[0]?.region.id ?? null

  const individualsQuery = useQuery({
    queryKey: ['individuals', run.id, effectiveRegionId, offset],
    queryFn:
      effectiveRegionId === null
        ? skipToken
        : () =>
            evaluationsApi.individuals(run.id, effectiveRegionId, {
              offset,
              limit: PAGE_SIZE,
            }),
  })

  if (run.results.length === 0) return null

  const groupCodes = (() => {
    const first = individualsQuery.data?.items[0]
    return first ? Object.keys(first.theta).sort() : []
  })()

  return (
    <section className="panel-card" aria-labelledby="drill-title">
      <h2 id="drill-title">{t('dashboard.drillTitle')}</h2>
      <div className="form-field input-inline">
        <label htmlFor="drill-region">{t('dashboard.drillRegion')}</label>
        <select
          id="drill-region"
          value={effectiveRegionId ?? ''}
          onChange={(e) => {
            setRegionId(Number(e.target.value))
            setOffset(0)
          }}
        >
          {run.results.map((result) => (
            <option key={result.region.id} value={result.region.id}>
              {localizedName(result.region, lang)}
            </option>
          ))}
        </select>
      </div>

      <h3>{t('dashboard.individualsTitle')}</h3>
      {individualsQuery.isPending && <Loading />}
      {individualsQuery.isError && <ErrorNote error={individualsQuery.error} />}
      {individualsQuery.isSuccess && individualsQuery.data.items.length === 0 && (
        <p className="muted">{t('common.noData')}</p>
      )}
      {individualsQuery.isSuccess && individualsQuery.data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.respondentId')}</th>
                  <th scope="col">{t('regions.respondentsTable.extId')}</th>
                  {groupCodes.map((code) => (
                    <th scope="col" key={`theta-${code}`}>
                      θ({code})
                    </th>
                  ))}
                  {groupCodes.map((code) => (
                    <th scope="col" key={`term-${code}`}>
                      T({code})
                    </th>
                  ))}
                  <th scope="col">{t('values.rStar')}</th>
                  <th scope="col">{t('values.chi')}</th>
                </tr>
              </thead>
              <tbody>
                {individualsQuery.data.items.map((item) => (
                  <tr key={item.respondent_id}>
                    <td>{item.respondent_id}</td>
                    <td>{item.ext_id ?? '—'}</td>
                    {groupCodes.map((code) => (
                      <td key={`theta-${code}`}>{item.theta[code] ?? '—'}</td>
                    ))}
                    {groupCodes.map((code) => (
                      <td key={`term-${code}`}>
                        {item.terms[code] != null ? `T${item.terms[code]}` : '—'}
                      </td>
                    ))}
                    <td>
                      <TermBadge term={item.r_star} compact />
                    </td>
                    <td>{item.chi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={individualsQuery.data.total}
            onOffsetChange={setOffset}
          />
        </>
      )}
    </section>
  )
}
